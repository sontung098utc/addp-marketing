<?php
/**
 * ADDP COMMERCE INTELLIGENCE - MODULE 3: LIVE GMV MAX SOP SERVICE
 *
 * Provides:
 * 1. Configurable ROI & 2-Session LIVE Budget Targets (reads `commerce_sop_config` if available + UI overrides).
 * 2. 2-Session Tracking (Session 1: <14:00, Session 2: >=14:00) with real DB queries only.
 * 3. 60% Budget Pacing Alert (warn >= 60%, critical >= 90%) & Session Duration Alert (<3h normal / <5h sale).
 * 4. 8-Metric Funnel Diagnosis Engine (Impressions, Spend/Pacing, CPM, CTR into Live, Cart CTOR, CVR, Session GMV, Session ROI)
 *    with automatic Weakest-Link detection & department-assigned SOP prescriptions.
 *
 * ZERO MOCK DATA: Missing DB/API metrics are returned as `null` with honest status.
 */

declare(strict_types=1);

class CommerceLiveSopService {
    private PDO $db;

    // SOP Default Constants
    public const DEFAULT_MONTHLY_GMV_TARGET = 600000000.0;
    public const DEFAULT_DAILY_GMV_TARGET   = 20000000.0;
    public const DEFAULT_TARGET_ROI         = 13.0;
    public const DEFAULT_LIVE_BUDGET_PCT    = 25.0; // 25% of total daily spend cap
    public const DEFAULT_SESSIONS_PER_DAY   = 2;
    public const DEFAULT_CPM_TARGET         = 5000.0; // <= 5,000 VND
    public const DEFAULT_CTR_LIVE_TARGET    = 5.0;    // >= 5% enter room rate
    public const DEFAULT_CTOR_NORMAL_MIN    = 30.0;   // 30-50% normal
    public const DEFAULT_CTOR_NORMAL_MAX    = 50.0;
    public const DEFAULT_CTOR_INTERACTIVE_MIN = 60.0; // 60-90% interactive
    public const DEFAULT_CTOR_INTERACTIVE_MAX = 90.0;
    public const DEFAULT_CVR_TARGET         = 5.0;    // >= 5%
    public const NORMAL_MIN_DURATION_HOURS  = 3.0;
    public const SALE_MIN_DURATION_HOURS    = 5.0;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? getDBConnection();
    }

    /**
     * Loads SOP config from `commerce_sop_config` if the table exists,
     * then applies any explicit runtime overrides passed by UI/API.
     */
    public function resolveConfig(string $shopId, array $overrides = []): array {
        $config = [
            'source' => 'SOP_DEFAULTS',
            'monthly_gmv_target' => self::DEFAULT_MONTHLY_GMV_TARGET,
            'daily_gmv_target' => self::DEFAULT_DAILY_GMV_TARGET,
            'target_roi' => self::DEFAULT_TARGET_ROI,
            'live_budget_pct' => self::DEFAULT_LIVE_BUDGET_PCT,
            'sessions_per_day' => self::DEFAULT_SESSIONS_PER_DAY,
            'daily_spend_cap' => null,
            'live_daily_budget' => null,
            'session_budget_cap' => null,
            'session_gmv_target' => null,
            'session_impressions_target' => null,
            'cpm_target' => self::DEFAULT_CPM_TARGET,
            'ctr_live_target' => self::DEFAULT_CTR_LIVE_TARGET,
            'cvr_target' => self::DEFAULT_CVR_TARGET,
            'is_sale_day' => !empty($overrides['is_sale_day']),
            'is_interactive_mode' => !empty($overrides['is_interactive_mode']),
        ];

        // 1. Try reading from `commerce_sop_config` if created by Module 1
        try {
            $tbl = $this->db->query("SHOW TABLES LIKE 'commerce_sop_config'")->fetch();
            if ($tbl) {
                $stmt = $this->db->prepare("SELECT * FROM `commerce_sop_config` WHERE shop_id = ? LIMIT 1");
                $stmt->execute([$shopId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $config['source'] = 'COMMERCE_SOP_CONFIG';
                    if (isset($row['monthly_gmv_target']) && (float)$row['monthly_gmv_target'] > 0) {
                        $config['monthly_gmv_target'] = (float)$row['monthly_gmv_target'];
                    }
                    if (isset($row['daily_gmv_target']) && (float)$row['daily_gmv_target'] > 0) {
                        $config['daily_gmv_target'] = (float)$row['daily_gmv_target'];
                    }
                    // Prefer live_roi_target / live_target_roi if present, else target_roi / default_roi_target
                    foreach (['live_target_roi', 'live_roi_target', 'target_roi', 'default_roi_target', 'roi_target'] as $roiCol) {
                        if (isset($row[$roiCol]) && (float)$row[$roiCol] > 0) {
                            $config['target_roi'] = (float)$row[$roiCol];
                            break;
                        }
                    }
                    foreach (['live_budget_pct', 'live_split_pct'] as $pctCol) {
                        if (isset($row[$pctCol]) && (float)$row[$pctCol] > 0) {
                            $config['live_budget_pct'] = (float)$row[$pctCol];
                            break;
                        }
                    }
                    if (isset($row['live_sessions_per_day']) && (int)$row['live_sessions_per_day'] > 0) {
                        $config['sessions_per_day'] = (int)$row['live_sessions_per_day'];
                    } elseif (isset($row['sessions_per_day']) && (int)$row['sessions_per_day'] > 0) {
                        $config['sessions_per_day'] = (int)$row['sessions_per_day'];
                    }
                }
            }
        } catch (\Throwable $t) {
            // Silently fallback to SOP defaults if table/column doesn't exist
        }

        // 2. Apply explicit UI/API overrides
        if (isset($overrides['target_roi']) && is_numeric($overrides['target_roi']) && (float)$overrides['target_roi'] > 0) {
            $config['target_roi'] = (float)$overrides['target_roi'];
            $config['source'] .= '+UI_OVERRIDE';
        }
        if (isset($overrides['daily_gmv_target']) && is_numeric($overrides['daily_gmv_target']) && (float)$overrides['daily_gmv_target'] > 0) {
            $config['daily_gmv_target'] = (float)$overrides['daily_gmv_target'];
        }
        if (isset($overrides['sessions_per_day']) && is_numeric($overrides['sessions_per_day']) && (int)$overrides['sessions_per_day'] > 0) {
            $config['sessions_per_day'] = (int)$overrides['sessions_per_day'];
        }

        // 3. Derived caps
        $dailySpendCap = $config['daily_gmv_target'] / max(0.1, $config['target_roi']);
        $liveDailyBudget = $dailySpendCap * ($config['live_budget_pct'] / 100.0);

        if (isset($overrides['live_daily_budget']) && is_numeric($overrides['live_daily_budget']) && (float)$overrides['live_daily_budget'] > 0) {
            $liveDailyBudget = (float)$overrides['live_daily_budget'];
            $config['source'] .= '+BUDGET_OVERRIDE';
        }

        $sessionBudgetCap = $liveDailyBudget / max(1, $config['sessions_per_day']);
        if (isset($overrides['session_budget_cap']) && is_numeric($overrides['session_budget_cap']) && (float)$overrides['session_budget_cap'] > 0) {
            $sessionBudgetCap = (float)$overrides['session_budget_cap'];
        }

        $sessionGmvTarget = $sessionBudgetCap * $config['target_roi'];
        if (isset($overrides['session_gmv_target']) && is_numeric($overrides['session_gmv_target']) && (float)$overrides['session_gmv_target'] > 0) {
            $sessionGmvTarget = (float)$overrides['session_gmv_target'];
        }

        $sessionImpressionsTarget = (int)round(($sessionBudgetCap / $config['cpm_target']) * 1000);

        $config['daily_spend_cap'] = round($dailySpendCap, 0);
        $config['live_daily_budget'] = round($liveDailyBudget, 0);
        $config['session_budget_cap'] = round($sessionBudgetCap, 0);
        $config['session_gmv_target'] = round($sessionGmvTarget, 0);
        $config['session_impressions_target'] = $sessionImpressionsTarget;
        $config['ctor_target_min'] = $config['is_interactive_mode'] ? self::DEFAULT_CTOR_INTERACTIVE_MIN : self::DEFAULT_CTOR_NORMAL_MIN;
        $config['ctor_target_max'] = $config['is_interactive_mode'] ? self::DEFAULT_CTOR_INTERACTIVE_MAX : self::DEFAULT_CTOR_NORMAL_MAX;
        $config['min_duration_hours'] = $config['is_sale_day'] ? self::SALE_MIN_DURATION_HOURS : self::NORMAL_MIN_DURATION_HOURS;

        return $config;
    }

    /**
     * Main entry point: returns 2-session tracking, 60% budget alerts,
     * and 8-metric funnel diagnosis for the given shop & date range.
     */
    public function getLiveSopDashboard(
        string $shopId,
        string $startDate,
        string $endDate,
        array $overrides = []
    ): array {
        $config = $this->resolveConfig($shopId, $overrides);

        // 1. Load LIVE sessions from commerce_live_sessions
        $sessions = $this->fetchLiveSessions($shopId, $startDate, $endDate);

        // 2. Load LIVE Ads spend & attributed revenue (room-level first, then daily campaign-level)
        $roomAdsMap = $this->fetchRoomLevelAds($shopId, $startDate, $endDate);
        $dailyCampaignAds = $this->fetchDailyCampaignLiveAds($shopId, $startDate, $endDate);

        // 3. Group sessions into Ca 1 (Session 1: <14:00) and Ca 2 (Session 2: >=14:00)
        //    and attach Ads Spend + 60% Pacing Alert + Duration Alert
        $enrichedSessions = [];
        $sessionSlotBuckets = [
            'session_1' => $this->initSlotBucket(1, 'Ca 1 (Sáng / Trưa < 14:00)'),
            'session_2' => $this->initSlotBucket(2, 'Ca 2 (Chiều / Tối ≥ 14:00)'),
        ];

        // Count sessions per date for fair day-level spend allocation fallback
        $sessionsCountByDate = [];
        foreach ($sessions as $s) {
            $d = substr((string)$s['start_time'], 0, 10);
            $sessionsCountByDate[$d] = ($sessionsCountByDate[$d] ?? 0) + 1;
        }

        foreach ($sessions as $s) {
            $sid = (string)$s['session_id'];
            $sDate = substr((string)$s['start_time'], 0, 10);
            $hour = (int)date('G', strtotime((string)$s['start_time']));
            $slotKey = $hour < 14 ? 'session_1' : 'session_2';

            // Determine Ads spend & attributed revenue for this session
            $spend = null;
            $attributedGmv = null;
            $attributedOrders = null;
            $spendAttributionMode = 'UNAVAILABLE';

            if (isset($roomAdsMap[$sid])) {
                $spend = (float)$roomAdsMap[$sid]['spend'];
                $attributedGmv = (float)$roomAdsMap[$sid]['ads_gross_revenue'];
                $attributedOrders = (int)$roomAdsMap[$sid]['orders'];
                $spendAttributionMode = 'EXACT_ROOM_ID';
            } elseif (isset($dailyCampaignAds[$sDate]) && $dailyCampaignAds[$sDate]['spend'] > 0) {
                $daySessCount = max(1, $sessionsCountByDate[$sDate] ?? 1);
                $spend = round($dailyCampaignAds[$sDate]['spend'] / $daySessCount, 0);
                $attributedGmv = round($dailyCampaignAds[$sDate]['gross_revenue'] / $daySessCount, 0);
                $attributedOrders = (int)round($dailyCampaignAds[$sDate]['orders'] / $daySessCount);
                $spendAttributionMode = 'DAY_EQUAL_SPLIT';
            }

            $durationSec = isset($s['duration_seconds']) ? (int)$s['duration_seconds'] : null;
            $durationHours = $durationSec !== null ? round($durationSec / 3600, 2) : null;

            $pacingAlert = $this->evaluateBudgetPacing($spend, $config['session_budget_cap']);
            $durationAlert = $this->evaluateDuration($durationHours, $config['min_duration_hours'], $config['is_sale_day']);

            $funnel = $this->buildFunnelDiagnosis([
                'impressions' => isset($s['impressions']) && (int)$s['impressions'] > 0 ? (int)$s['impressions'] : null,
                'total_views' => isset($s['total_views']) ? (int)$s['total_views'] : null,
                'clicks' => isset($s['clicks']) ? (int)$s['clicks'] : null,
                'orders_count' => isset($s['orders_count']) ? (int)$s['orders_count'] : null,
                'gmv' => isset($s['gmv']) ? (float)$s['gmv'] : null,
                'spend' => $spend,
                'attributed_gmv' => $attributedGmv,
            ], $config, 1);

            $isActiveSession = (($spend !== null && $spend > 0) || ((float)($s['gmv'] ?? 0) > 0) || ((int)($s['orders_count'] ?? 0) > 0));

            $item = [
                'session_id' => $sid,
                'title' => (string)($s['title'] ?: ('Phiên LIVE ' . $sid)),
                'creator_username' => (string)($s['creator_username'] ?? ''),
                'start_time' => $s['start_time'],
                'end_time' => $s['end_time'],
                'stat_date' => $sDate,
                'slot_key' => $slotKey,
                'slot_label' => $slotKey === 'session_1' ? 'Ca 1' : 'Ca 2',
                'is_active' => $isActiveSession,
                'duration_seconds' => $durationSec,
                'duration_hours' => $durationHours,
                'impressions' => isset($s['impressions']) ? (int)$s['impressions'] : null,
                'total_views' => isset($s['total_views']) ? (int)$s['total_views'] : null,
                'clicks' => isset($s['clicks']) ? (int)$s['clicks'] : null,
                'orders_count' => isset($s['orders_count']) ? (int)$s['orders_count'] : null,
                'gmv' => isset($s['gmv']) ? (float)$s['gmv'] : null,
                'spend' => $spend,
                'attributed_gmv' => $attributedGmv,
                'attributed_orders' => $attributedOrders,
                'spend_attribution_mode' => $spendAttributionMode,
                'pacing_alert' => $pacingAlert,
                'duration_alert' => $durationAlert,
                'weakest_link' => $funnel['weakest_link'],
                'funnel' => $funnel,
            ];

            $enrichedSessions[] = $item;
            if ($isActiveSession) {
                $this->accumulateSlotBucket($sessionSlotBuckets[$slotKey], $item);
            }
        }

        // Finalize Ca 1 & Ca 2 bucket diagnoses
        foreach ($sessionSlotBuckets as $k => &$bucket) {
            $sessionCountInBucket = max(1, $bucket['sessions_count']);
            $bucket['pacing_alert'] = $this->evaluateBudgetPacing(
                $bucket['has_spend_data'] ? $bucket['total_spend'] : null,
                $config['session_budget_cap'] * $sessionCountInBucket
            );
            $avgDur = $bucket['sessions_count'] > 0 && $bucket['has_duration_data']
                ? round($bucket['total_duration_hours'] / $bucket['sessions_count'], 2)
                : null;
            $bucket['avg_duration_hours'] = $avgDur;
            $bucket['duration_alert'] = $this->evaluateDuration($avgDur, $config['min_duration_hours'], $config['is_sale_day']);
            $bucket['funnel'] = $this->buildFunnelDiagnosis([
                'impressions' => $bucket['sessions_count'] > 0 && $bucket['total_impressions'] > 0 ? $bucket['total_impressions'] : null,
                'total_views' => $bucket['sessions_count'] > 0 ? $bucket['total_views'] : null,
                'clicks' => $bucket['sessions_count'] > 0 ? $bucket['total_clicks'] : null,
                'orders_count' => $bucket['sessions_count'] > 0 ? $bucket['total_orders'] : null,
                'gmv' => $bucket['sessions_count'] > 0 ? $bucket['total_gmv'] : null,
                'spend' => $bucket['has_spend_data'] ? $bucket['total_spend'] : null,
                'attributed_gmv' => $bucket['has_spend_data'] ? $bucket['total_attributed_gmv'] : null,
            ], $config, $sessionCountInBucket);
        }
        unset($bucket);

        // 4. Overall Period Totals (using actual period LIVE Ads Spend from daily campaign table if room spend wasn't complete)
        $periodTotalSpend = 0.0;
        $periodAttributedGmv = 0.0;
        $hasPeriodSpend = false;

        if (!empty($roomAdsMap)) {
            foreach ($roomAdsMap as $ra) {
                $periodTotalSpend += (float)$ra['spend'];
                $periodAttributedGmv += (float)$ra['ads_gross_revenue'];
            }
            $hasPeriodSpend = $periodTotalSpend > 0;
        }
        if (!$hasPeriodSpend && !empty($dailyCampaignAds)) {
            foreach ($dailyCampaignAds as $da) {
                $periodTotalSpend += (float)$da['spend'];
                $periodAttributedGmv += (float)$da['gross_revenue'];
            }
            $hasPeriodSpend = $periodTotalSpend > 0;
        }

        $activeSessions = array_values(array_filter($enrichedSessions, fn($x) => !empty($x['is_active'])));
        $inactiveSessionsCount = count($enrichedSessions) - count($activeSessions);

        $totalSessions = count($activeSessions);
        $totalImpressions = 0;
        $totalViews = 0;
        $totalClicks = 0;
        $totalOrders = 0;
        $totalGmv = 0.0;
        $totalDurationHours = 0.0;

        foreach ($activeSessions as $es) {
            $totalImpressions += (int)($es['impressions'] ?? 0);
            $totalViews += (int)($es['total_views'] ?? 0);
            $totalClicks += (int)($es['clicks'] ?? 0);
            $totalOrders += (int)($es['orders_count'] ?? 0);
            $totalGmv += (float)($es['gmv'] ?? 0);
            $totalDurationHours += (float)($es['duration_hours'] ?? 0);
        }

        $effectiveSessionScale = max(1, $totalSessions);
        $overallFunnel = $this->buildFunnelDiagnosis([
            'impressions' => $totalImpressions > 0 ? $totalImpressions : null,
            'total_views' => $totalSessions > 0 ? $totalViews : null,
            'clicks' => $totalSessions > 0 ? $totalClicks : null,
            'orders_count' => $totalSessions > 0 ? $totalOrders : null,
            'gmv' => $totalSessions > 0 ? $totalGmv : null,
            'spend' => $hasPeriodSpend ? $periodTotalSpend : null,
            'attributed_gmv' => $hasPeriodSpend ? $periodAttributedGmv : null,
        ], $config, $effectiveSessionScale);

        // Overall 60% alert (for latest active session or daily cap)
        $latestSessionAlert = !empty($activeSessions) ? $activeSessions[0]['pacing_alert'] : $this->evaluateBudgetPacing(
            $hasPeriodSpend ? $periodTotalSpend : null,
            $config['live_daily_budget']
        );

        return [
            'status' => $totalSessions > 0 || $hasPeriodSpend ? 'OK' : 'NO_DATA',
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'sessions_count' => $totalSessions,
                'active_sessions_count' => $totalSessions,
                'inactive_sessions_count' => $inactiveSessionsCount,
                'total_duration_hours' => round($totalDurationHours, 2),
            ],
            'config' => $config,
            'alerts' => [
                'latest_pacing_alert' => $latestSessionAlert,
                'sessions_at_60_pct' => count(array_filter($activeSessions, fn($x) => in_array($x['pacing_alert']['level'], ['WARNING_60', 'CRITICAL_90'], true))),
                'sessions_short_duration' => count(array_filter($activeSessions, fn($x) => $x['duration_alert']['is_short'] === true)),
            ],
            'slots' => $sessionSlotBuckets,
            'overall_funnel' => $overallFunnel,
            'sessions' => $enrichedSessions,
        ];
    }

    /**
     * Evaluates 60% Budget Pacing Alert (SOP: top up at 60%, never wait until 90%).
     */
    public function evaluateBudgetPacing(?float $spend, float $cap): array {
        if ($spend === null || $cap <= 0) {
            return [
                'level' => 'NO_DATA',
                'pacing_pct' => null,
                'spend' => $spend,
                'cap' => round($cap, 0),
                'remaining' => null,
                'message' => 'Chưa có dữ liệu chi tiêu QC LIVE hoặc chưa cấu hình hạn mức.',
                'action' => null,
            ];
        }

        $pct = round(($spend / $cap) * 100, 1);
        $remaining = max(0.0, round($cap - $spend, 0));

        if ($pct >= 90.0) {
            return [
                'level' => 'CRITICAL_90',
                'pacing_pct' => $pct,
                'spend' => round($spend, 0),
                'cap' => round($cap, 0),
                'remaining' => $remaining,
                'message' => "KHẨN CẤP ({$pct}%): Chi tiêu đã chạm ≥90% hạn mức phiên! Nguy cơ đứt gãy phân phối (distribution break).",
                'action' => 'Team Ads kiểm tra ROI ngay và tăng/châm ngân sách tức thì nếu ROI đạt mục tiêu.',
            ];
        }

        if ($pct >= 60.0) {
            return [
                'level' => 'WARNING_60',
                'pacing_pct' => $pct,
                'spend' => round($spend, 0),
                'cap' => round($cap, 0),
                'remaining' => $remaining,
                'message' => "CẢNH BÁO 60% (SOP): Đã tiêu {$pct}% hạn mức phiên (≥60%). Không đợi tới 90%!",
                'action' => 'Team Ads chủ động châm thêm ngân sách ngay nếu phiên đang ra đơn để giữ nhịp phân phối.',
            ];
        }

        return [
            'level' => 'OK',
            'pacing_pct' => $pct,
            'spend' => round($spend, 0),
            'cap' => round($cap, 0),
            'remaining' => $remaining,
            'message' => "An toàn ({$pct}% hạn mức phiên).",
            'action' => null,
        ];
    }

    /**
     * Evaluates session duration against SOP minimum (3h normal day, 5-8h sale day).
     */
    public function evaluateDuration(?float $durationHours, float $minHours, bool $isSaleDay): array {
        if ($durationHours === null) {
            return [
                'is_short' => null,
                'duration_hours' => null,
                'min_hours' => $minHours,
                'message' => 'Chưa có dữ liệu thời lượng phiên LIVE.',
            ];
        }

        $dayLabel = $isSaleDay ? 'Ngày Sale (chuẩn 5–8h)' : 'Ngày thường (chuẩn ≥ 3h)';
        if ($durationHours < $minHours) {
            return [
                'is_short' => true,
                'duration_hours' => $durationHours,
                'min_hours' => $minHours,
                'message' => "Thời lượng {$durationHours}h < {$minHours}h ({$dayLabel}). Chưa đủ thời gian để thuật toán TikTok tích lũy và phân phối tối ưu.",
            ];
        }

        return [
            'is_short' => false,
            'duration_hours' => $durationHours,
            'min_hours' => $minHours,
            'message' => "Đạt chuẩn thời lượng ({$durationHours}h / {$dayLabel}).",
        ];
    }

    /**
     * 8-Metric Funnel Diagnosis Engine (SOP Appendix Table).
     * Missing metrics remain `null` (ZERO mock data).
     */
    public function buildFunnelDiagnosis(array $raw, array $config, int $sessionScale = 1): array {
        $scale = max(1, $sessionScale);

        $impressions = $raw['impressions']; // int|null
        $views       = $raw['total_views']; // int|null
        $clicks      = $raw['clicks'];      // int|null
        $orders      = $raw['orders_count'];// int|null
        $gmv         = $raw['gmv'];         // float|null
        $spend       = $raw['spend'];       // float|null
        $attrGmv     = $raw['attributed_gmv']; // float|null

        // Derived metrics (strict null if denominator missing/zero)
        $cpm = ($spend !== null && $impressions !== null && $impressions > 0)
            ? round(($spend / $impressions) * 1000, 0)
            : null;

        $ctrIntoLive = ($views !== null && $impressions !== null && $impressions > 0)
            ? round(($views / $impressions) * 100, 2)
            : null;

        $cartCtor = ($clicks !== null && $views !== null && $views > 0)
            ? round(($clicks / $views) * 100, 2)
            : null;

        $cvr = ($orders !== null && $clicks !== null && $clicks > 0)
            ? round(($orders / $clicks) * 100, 2)
            : null;

        $adsRoas = ($spend !== null && $spend > 0 && $attrGmv !== null)
            ? round($attrGmv / $spend, 2)
            : null;

        $blendedRoi = ($spend !== null && $spend > 0 && $gmv !== null)
            ? round($gmv / $spend, 2)
            : null;

        $impTarget = $config['session_impressions_target'] * $scale;
        $spendTarget = $config['session_budget_cap'] * $scale;
        $gmvTarget = $config['session_gmv_target'] * $scale;
        $roiTarget = $config['target_roi'];
        $ctorMin = $config['ctor_target_min'];
        $ctorMax = $config['ctor_target_max'];

        $metrics = [
            $this->scoreMetric(
                'impressions',
                '1. Lượt hiển thị (Impressions)',
                $impressions,
                $impTarget,
                'higher_better',
                'number',
                '~' . number_format($impTarget, 0, ',', '.') . ' (' . $scale . ' ca)',
                'Ads + Nội dung',
                'Ngân sách QC chưa đủ, giá thầu ROI đặt quá cao khiến máy học bóp reach, hoặc nội dung phòng LIVE không giữ được người xem đầu phễu.',
                [
                    ['dept' => 'Ads', 'action' => 'Kiểm tra lại Target ROI (giảm nhẹ 1-2 điểm nếu đang bị bóp phân phối) và kiểm tra tốc độ cắn tiền.'],
                    ['dept' => 'Nội dung', 'action' => 'Quay thêm video mồi (teaser) kéo traffic vào phòng LIVE và tối ưu khung cảnh/hook 3 giây đầu phiên.'],
                ]
            ),
            $this->scoreMetric(
                'spend_pacing',
                '2. Chi tiêu / Pacing (Spend)',
                $spend,
                $spendTarget,
                'pacing',
                'vnd',
                number_format($spendTarget, 0, ',', '.') . ' ₫ (cảnh báo ≥60%)',
                'Ads',
                'Nếu < 30%: Target ROI quá cao hoặc thời lượng LIVE quá ngắn khiến ads không cắn tiền. Nếu ≥ 60%: sắp cạn ngân sách, cần nạp kịp trước 90%.',
                [
                    ['dept' => 'Ads', 'action' => 'Cảnh báo 60%: Châm thêm ngân sách ngay nếu ROI đạt; không để chạm 90% gây đứt phân phối. Nếu cắn chậm (<30%), nới ROI target tạm thời.'],
                ]
            ),
            $this->scoreMetric(
                'cpm',
                '3. CPM (Chi phí / 1.000 hiển thị)',
                $cpm,
                $config['cpm_target'],
                'lower_better',
                'vnd',
                '≤ ' . number_format($config['cpm_target'], 0, ',', '.') . ' ₫',
                'Ads + Livestream',
                'CPM cao (> 5.000 ₫) do cạnh tranh khung giờ cao điểm hoặc chỉ số giữ chân phòng LIVE (retention, tương tác) thấp khiến sàn thu phí đắt.',
                [
                    ['dept' => 'Ads', 'action' => 'Đổi khung giờ hoặc tách chiến dịch LIVE GMV Max theo sản phẩm chủ lực để hạ giá thầu CPM.'],
                    ['dept' => 'Livestream', 'action' => 'Tăng tương tác 15 phút đầu (mini-game, hỏi đáp, ghim deal) để tăng điểm chất lượng phòng LIVE.'],
                ]
            ),
            $this->scoreMetric(
                'ctr_into_live',
                '4. CTR vào phòng LIVE (Enter Room)',
                $ctrIntoLive,
                $config['ctr_live_target'],
                'higher_better',
                'pct',
                '≥ ' . $config['ctr_live_target'] . '%',
                'Livestream + Nội dung',
                'Khách hàng lướt qua nhưng không bấm vào xem LIVE do hình ảnh/ánh sáng kém thu hút, tiêu đề LIVE mờ nhạt hoặc thiếu deal mồi trên màn hình.',
                [
                    ['dept' => 'Livestream', 'action' => 'Thay đổi góc máy sáng rõ, đặt bảng giá/deal sốc ngay khung hình chính và host đọc hook kêu gọi liên tục.'],
                    ['dept' => 'Nội dung', 'action' => 'Cập nhật tiêu đề LIVE đánh trúng nỗi đau/ưu đãi (VD: "Sale 50% + Quà tặng") và ảnh bìa rõ nét.'],
                ]
            ),
            $this->scoreMetric(
                'cart_ctor',
                '5. Cart CTOR (Click giỏ hàng)',
                $cartCtor,
                $ctorMin,
                'higher_better',
                'pct',
                $ctorMin . '–' . $ctorMax . '% (' . ($config['is_interactive_mode'] ? 'Tương tác' : 'Thường') . ')',
                'Livestream + Sản phẩm',
                'Người xem vào phòng nhưng không bấm giỏ hàng do Host chưa kêu gọi hành động (CTA) chỉ tay vào giỏ, hoặc sản phẩm ghim chưa đúng nhu cầu.',
                [
                    ['dept' => 'Livestream', 'action' => 'Host thực hiện CTA ghim sản phẩm mỗi 3–5 phút, đếm ngược suất ưu đãi và hướng dẫn khách bấm giỏ hàng góc trái.'],
                    ['dept' => 'Sản phẩm', 'action' => 'Đẩy các SKU mồi/Combo bán chạy lên vị trí số 1-3 trong giỏ hàng.'],
                ]
            ),
            $this->scoreMetric(
                'cvr',
                '6. CVR (Tỷ lệ chốt đơn)',
                $cvr,
                $config['cvr_target'],
                'higher_better',
                'pct',
                '≥ ' . $config['cvr_target'] . '%',
                'Sản phẩm + CSKH + KT-VH',
                'Khách đã mở giỏ hàng nhưng thoát ra không thanh toán do giá chưa cạnh tranh, thiếu combo/voucher, phí ship cao, hoặc phản hồi bình luận chậm.',
                [
                    ['dept' => 'Sản phẩm', 'action' => 'Bổ sung voucher LIVE độc quyền, tạo Combo 2-3 hộp để tăng giá trị đơn & freeship.'],
                    ['dept' => 'CSKH', 'action' => 'Trực bình luận giải đáp thắc mắc công dụng/chính sách đổi trả trong < 30 giây.'],
                    ['dept' => 'KT-VH', 'action' => 'Kiểm tra tồn kho SKU chủ lực (tránh hết size/hết hàng) và xác nhận giá niêm yết không bị lỗi.'],
                ]
            ),
            $this->scoreMetric(
                'session_gmv',
                '7. Session GMV (Doanh thu phiên)',
                $gmv,
                $gmvTarget,
                'higher_better',
                'vnd',
                number_format($gmvTarget, 0, ',', '.') . ' ₫ (' . $scale . ' ca)',
                'Livestream + Ads + Sản phẩm',
                'Tổng doanh thu phiên chưa đạt mục tiêu do thiếu lưu lượng đầu vào, thời lượng LIVE ngắn (<3h/5h), hoặc AOV đơn hàng còn thấp.',
                [
                    ['dept' => 'Livestream', 'action' => 'Kéo dài thời lượng phiên đạt chuẩn (≥3h ngày thường / 5–8h ngày Sale) và đẩy bán Combo giá trị cao.'],
                    ['dept' => 'Ads', 'action' => 'Mở rộng ngân sách ở khung giờ vàng có chuyển đổi cao nhất.'],
                ]
            ),
            $this->scoreMetric(
                'session_roi',
                '8. Session ROI (Blended / Ads ROAS)',
                $blendedRoi ?? $adsRoas,
                $roiTarget,
                'higher_better',
                'x',
                '≥ ' . $roiTarget . 'x (Ads: ' . ($adsRoas !== null ? $adsRoas . 'x' : 'N/A') . ' | Blended: ' . ($blendedRoi !== null ? $blendedRoi . 'x' : 'N/A') . ')',
                'Ads + KT-VH + Livestream',
                'ROI dưới ngưỡng mục tiêu do chi phí QC tăng cao (CPM đắt) hoặc tỷ lệ chuyển đổi (CTR/CTOR/CVR) đang bị gãy ở một khâu trong phễu.',
                [
                    ['dept' => 'Ads', 'action' => 'Siết lại Target ROI về mức hòa vốn/mục tiêu nếu đang lỗ, tạm dừng các nhóm quảng cáo đốt tiền không ra đơn.'],
                    ['dept' => 'KT-VH', 'action' => 'Đối soát lại giá vốn, phí sàn & tỷ lệ hoàn hủy để đảm bảo ROI mục tiêu phản ánh đúng lợi nhuận thực.'],
                ]
            ),
        ];

        // Attach extra ROI breakdown to metric #8
        $metrics[7]['ads_roas'] = $adsRoas;
        $metrics[7]['blended_roi'] = $blendedRoi;

        // Find Weakest Link among metrics that have data and are not passing
        $weakest = null;
        $lowestScore = 999.0;
        foreach ($metrics as $m) {
            if ($m['actual'] === null || $m['achievement_ratio'] === null) {
                continue;
            }
            if (!$m['passed'] && $m['achievement_ratio'] < $lowestScore) {
                $lowestScore = $m['achievement_ratio'];
                $weakest = $m;
            }
        }

        return [
            'metrics' => $metrics,
            'weakest_link' => $weakest ? [
                'key' => $weakest['key'],
                'label' => $weakest['label'],
                'actual' => $weakest['actual'],
                'target' => $weakest['target'],
                'achievement_pct' => round($weakest['achievement_ratio'] * 100, 1),
                'owner_departments' => $weakest['owner_departments'],
                'root_cause' => $weakest['root_cause'],
                'prescriptions' => $weakest['prescriptions'],
            ] : null,
        ];
    }

    private function scoreMetric(
        string $key,
        string $label,
        $actual,
        float $target,
        string $mode,
        string $unit,
        string $targetDisplay,
        string $ownerDepts,
        string $rootCause,
        array $prescriptions
    ): array {
        if ($actual === null) {
            return [
                'key' => $key,
                'label' => $label,
                'actual' => null,
                'target' => $target,
                'target_display' => $targetDisplay,
                'unit' => $unit,
                'status' => 'NO_DATA',
                'passed' => null,
                'achievement_ratio' => null,
                'owner_departments' => $ownerDepts,
                'root_cause' => $rootCause,
                'prescriptions' => $prescriptions,
            ];
        }

        $num = (float)$actual;
        $passed = false;
        $ratio = 1.0;

        if ($mode === 'higher_better') {
            $passed = $num >= $target;
            $ratio = $target > 0 ? ($num / $target) : 1.0;
        } elseif ($mode === 'lower_better') {
            $passed = $num <= $target;
            $ratio = $num > 0 ? ($target / $num) : 1.0;
        } elseif ($mode === 'pacing') {
            $pct = $target > 0 ? ($num / $target) * 100.0 : 0.0;
            $passed = ($pct >= 30.0 && $pct < 60.0);
            if ($pct >= 90.0) {
                $ratio = 0.2;
            } elseif ($pct >= 60.0) {
                $ratio = 0.5;
            } elseif ($pct < 30.0) {
                $ratio = max(0.0, $pct / 30.0);
            } else {
                $ratio = 1.0;
            }
        }

        return [
            'key' => $key,
            'label' => $label,
            'actual' => $num,
            'target' => $target,
            'target_display' => $targetDisplay,
            'unit' => $unit,
            'status' => $passed ? 'PASS' : 'NEEDS_ACTION',
            'passed' => $passed,
            'achievement_ratio' => round($ratio, 4),
            'owner_departments' => $ownerDepts,
            'root_cause' => $rootCause,
            'prescriptions' => $prescriptions,
        ];
    }

    private function initSlotBucket(int $slotNumber, string $label): array {
        return [
            'slot_number' => $slotNumber,
            'label' => $label,
            'sessions_count' => 0,
            'total_duration_hours' => 0.0,
            'avg_duration_hours' => null,
            'has_duration_data' => false,
            'total_impressions' => 0,
            'total_views' => 0,
            'total_clicks' => 0,
            'total_orders' => 0,
            'total_gmv' => 0.0,
            'total_spend' => 0.0,
            'total_attributed_gmv' => 0.0,
            'has_spend_data' => false,
        ];
    }

    private function accumulateSlotBucket(array &$bucket, array $item): void {
        $bucket['sessions_count']++;
        if ($item['duration_hours'] !== null) {
            $bucket['total_duration_hours'] = round($bucket['total_duration_hours'] + $item['duration_hours'], 2);
            $bucket['has_duration_data'] = true;
        }
        $bucket['total_impressions'] += (int)($item['impressions'] ?? 0);
        $bucket['total_views'] += (int)($item['total_views'] ?? 0);
        $bucket['total_clicks'] += (int)($item['clicks'] ?? 0);
        $bucket['total_orders'] += (int)($item['orders_count'] ?? 0);
        $bucket['total_gmv'] += (float)($item['gmv'] ?? 0);
        if ($item['spend'] !== null) {
            $bucket['total_spend'] += (float)$item['spend'];
            $bucket['total_attributed_gmv'] += (float)($item['attributed_gmv'] ?? 0);
            $bucket['has_spend_data'] = true;
        }
    }

    private function fetchLiveSessions(string $shopId, string $startDate, string $endDate): array {
        try {
            $stmt = $this->db->prepare("SELECT 
                session_id, title, creator_username, start_time, end_time, duration_seconds,
                gmv, orders_count, units_sold, customer_count, total_views, impressions, clicks,
                comments_count, shares_count, follows_count, peak_concurrent_users
                FROM `commerce_live_sessions`
                WHERE shop_id = ? AND start_time >= ? AND start_time <= ?
                ORDER BY start_time DESC");
            $stmt->execute([$shopId, $startDate . ' 00:00:00', $endDate . ' 23:59:59']);
            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $t) {
            return [];
        }
    }

    private function fetchRoomLevelAds(string $shopId, string $startDate, string $endDate): array {
        $map = [];
        try {
            $tbl = $this->db->query("SHOW TABLES LIKE 'commerce_ads_live_daily'")->fetch();
            if (!$tbl) {
                return [];
            }
            $stmt = $this->db->prepare("SELECT 
                room_id,
                SUM(cost) as spend,
                SUM(ads_gross_revenue) as ads_gross_revenue,
                SUM(orders) as orders
                FROM `commerce_ads_live_daily`
                WHERE shop_id = ? AND stat_date >= ? AND stat_date <= ?
                GROUP BY room_id");
            $stmt->execute([$shopId, $startDate, $endDate]);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $rid = (string)$row['room_id'];
                if ($rid !== '') {
                    $map[$rid] = $row;
                }
            }
        } catch (\Throwable $t) {
            return [];
        }
        return $map;
    }

    private function fetchDailyCampaignLiveAds(string $shopId, string $startDate, string $endDate): array {
        $map = [];
        try {
            $stmt = $this->db->prepare("SELECT 
                stat_date,
                COALESCE(SUM(spend), 0) as spend,
                COALESCE(SUM(gross_revenue), 0) as gross_revenue,
                COALESCE(SUM(orders), 0) as orders
                FROM `commerce_ads_campaign_daily`
                WHERE shop_id = ? AND stat_date >= ? AND stat_date <= ?
                  AND (promotion_type = 'LIVE' OR campaign_type LIKE '%LIVE%' OR campaign_name LIKE '%LIVE%')
                GROUP BY stat_date");
            $stmt->execute([$shopId, $startDate, $endDate]);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $map[(string)$row['stat_date']] = [
                    'spend' => (float)$row['spend'],
                    'gross_revenue' => (float)$row['gross_revenue'],
                    'orders' => (int)$row['orders'],
                ];
            }
        } catch (\Throwable $t) {
            return [];
        }
        return $map;
    }
}

// =========================================================================
// Direct HTTP Endpoint Handler (allows standalone calls via apiRequest)
// =========================================================================
if (isset($_SERVER['SCRIPT_FILENAME']) && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/db.php';
    require_once __DIR__ . '/auth_guard.php';

    header('Content-Type: application/json; charset=utf-8');
    if (function_exists('requireAuth')) {
        requireAuth();
    }

    $action = $_GET['action'] ?? $_POST['action'] ?? 'get_live_sop_dashboard';
    $shopId = trim((string)($_GET['shop_id'] ?? $_POST['shop_id'] ?? ''));
    $startDate = trim((string)($_GET['start_date'] ?? $_POST['start_date'] ?? date('Y-m-d', strtotime('-7 days'))));
    $endDate = trim((string)($_GET['end_date'] ?? $_POST['end_date'] ?? date('Y-m-d')));

    if ($shopId === '') {
        echo json_encode(['success' => false, 'message' => 'Thiếu tham số shop_id'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $overrides = [
        'target_roi' => $_GET['target_roi'] ?? $_POST['target_roi'] ?? null,
        'daily_gmv_target' => $_GET['daily_gmv_target'] ?? $_POST['daily_gmv_target'] ?? null,
        'live_daily_budget' => $_GET['live_daily_budget'] ?? $_POST['live_daily_budget'] ?? null,
        'session_budget_cap' => $_GET['session_budget_cap'] ?? $_POST['session_budget_cap'] ?? null,
        'session_gmv_target' => $_GET['session_gmv_target'] ?? $_POST['session_gmv_target'] ?? null,
        'sessions_per_day' => $_GET['sessions_per_day'] ?? $_POST['sessions_per_day'] ?? null,
        'is_sale_day' => filter_var($_GET['is_sale_day'] ?? $_POST['is_sale_day'] ?? false, FILTER_VALIDATE_BOOLEAN),
        'is_interactive_mode' => filter_var($_GET['is_interactive_mode'] ?? $_POST['is_interactive_mode'] ?? false, FILTER_VALIDATE_BOOLEAN),
    ];

    try {
        $service = new CommerceLiveSopService();
        switch ($action) {
            case 'get_live_sop_dashboard':
                $data = $service->getLiveSopDashboard($shopId, $startDate, $endDate, $overrides);
                echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
                break;

            case 'get_live_sop_config':
                $cfg = $service->resolveConfig($shopId, $overrides);
                echo json_encode(['success' => true, 'data' => $cfg], JSON_UNESCAPED_UNICODE);
                break;

            default:
                echo json_encode(['success' => false, 'message' => 'Action không hợp lệ: ' . $action], JSON_UNESCAPED_UNICODE);
                break;
        }
    } catch (\Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống LIVE SOP: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    exit;
}
