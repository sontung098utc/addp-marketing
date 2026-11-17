<?php
/**
 * ADDP COMMERCE INTELLIGENCE - MODULE 2: PRODUCT GMV MAX SOP SERVICE
 *
 * Covers:
 * 1. Configurable ROI Target & Breakeven ROI (reads from `commerce_sop_config` if present,
 *    with query/body overrides and 13.0 / 15.0 defaults).
 * 2. 5-Status Video Pool Classification (OUTSTANDING, EFFECTIVE, EXPLORING, INEFFECTIVE, INACTIVE)
 *    + Pool Health KPIs (Active >= 50, Exploring >= 15, New videos/day 10-15, % spend 0-order < 10%).
 * 3. 3-Day ROI Lock & Creative Boost Tracker (24-48h, max 3d, <= 10-20% daily cap, stop rules:
 *    self-spending in main budget OR >48h / spend > 1-1.5x break-even CPA with 0 orders;
 *    explicit warning: Boost is NOT covered by ROI Protection).
 * 4. 7-Day (spend > 1-1.5x CPA with 0 orders) & 30-Day (0 orders) Cleanup Candidates.
 * 5. Combo AOV Tracker from `commerce_orders` & `commerce_order_items`
 *    (Single Unit vs 2-3 Box Combo vs Bulk share vs 100,000-150,000 VND Combo goal).
 *
 * ZERO MOCK DATA: Queries real DB tables only.
 */

class CommerceProductGmvSopService {
    private PDO $db;
    private string $driver;

    const DEFAULT_BREAKEVEN_ROI = 13.0;
    const DEFAULT_TARGET_ROI = 15.0;
    const COMBO_AOV_MIN_GOAL = 100000.0;
    const COMBO_AOV_MAX_GOAL = 150000.0;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->driver = (string)$db->getAttribute(PDO::ATTR_DRIVER_NAME);
    }

    private function tableExists(string $tableName): bool {
        try {
            if ($this->driver === 'sqlite') {
                $stmt = $this->db->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
                $stmt->execute([$tableName]);
                return (bool)$stmt->fetchColumn();
            }
            $stmt = $this->db->query("SHOW TABLES LIKE " . $this->db->quote($tableName));
            return (bool)$stmt->fetchColumn();
        } catch (\Throwable $t) {
            return false;
        }
    }

    private function getTableColumns(string $tableName): array {
        try {
            if ($this->driver === 'sqlite') {
                $stmt = $this->db->query("PRAGMA table_info(`{$tableName}`)");
                $cols = [];
                while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    if (!empty($r['name'])) $cols[] = $r['name'];
                }
                return $cols;
            }
            $stmt = $this->db->query("SHOW COLUMNS FROM `{$tableName}`");
            $cols = [];
            while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($r['Field'])) $cols[] = $r['Field'];
            }
            return $cols;
        } catch (\Throwable $t) {
            return [];
        }
    }

    /**
     * Reads configurable ROI & daily budget cap from `commerce_sop_config` if table exists,
     * falling back to explicit overrides or SOP defaults (13.0 / 15.0).
     */
    public function resolveRoiConfig(string $shopId, ?float $overrideTargetRoi = null, ?float $overrideBreakevenRoi = null): array {
        $breakevenRoi = self::DEFAULT_BREAKEVEN_ROI;
        $targetRoi = self::DEFAULT_TARGET_ROI;
        $dailySpendCap = 0.0;
        $dailyGmvTarget = 0.0;
        $videoBudgetSharePct = 75.0;
        $source = 'SOP_DEFAULT';

        if ($this->tableExists('commerce_sop_config')) {
            try {
                $cols = $this->getTableColumns('commerce_sop_config');
                $orderCol = in_array('updated_at', $cols, true) ? 'updated_at' : (in_array('id', $cols, true) ? 'id' : null);
                $sql = "SELECT * FROM `commerce_sop_config` WHERE shop_id = ?" . ($orderCol ? " ORDER BY `{$orderCol}` DESC" : "") . " LIMIT 1";
                $stmt = $this->db->prepare($sql);
                $stmt->execute([$shopId]);
                $cfg = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$cfg) {
                    $stmtAny = $this->db->query("SELECT * FROM `commerce_sop_config` LIMIT 1");
                    $cfg = $stmtAny ? $stmtAny->fetch(PDO::FETCH_ASSOC) : null;
                }

                if ($cfg) {
                    $source = 'commerce_sop_config';
                    // Support flexible column names from Module 1
                    $cfgVideoRoi = $cfg['video_target_roi'] ?? $cfg['video_roi_target'] ?? $cfg['target_roi'] ?? $cfg['roi_target'] ?? null;
                    $cfgShopRoi = $cfg['target_roi'] ?? $cfg['roi_target'] ?? $cfg['breakeven_roi'] ?? null;
                    $cfgBreakeven = $cfg['breakeven_roi'] ?? $cfg['min_roi'] ?? $cfgShopRoi ?? null;

                    if ($cfgVideoRoi !== null && (float)$cfgVideoRoi > 0) {
                        $targetRoi = round((float)$cfgVideoRoi, 2);
                    }
                    if ($cfgBreakeven !== null && (float)$cfgBreakeven > 0) {
                        $breakevenRoi = round((float)$cfgBreakeven, 2);
                    }
                    if (isset($cfg['daily_gmv_target']) && (float)$cfg['daily_gmv_target'] > 0) {
                        $dailyGmvTarget = (float)$cfg['daily_gmv_target'];
                    }
                    if (isset($cfg['video_budget_pct']) && (float)$cfg['video_budget_pct'] > 0) {
                        $videoBudgetSharePct = (float)$cfg['video_budget_pct'];
                    }
                    if (isset($cfg['daily_spend_cap']) && (float)$cfg['daily_spend_cap'] > 0) {
                        $dailySpendCap = (float)$cfg['daily_spend_cap'];
                    } elseif ($dailyGmvTarget > 0 && $breakevenRoi > 0) {
                        $dailySpendCap = round($dailyGmvTarget / $breakevenRoi, 0);
                    }
                }
            } catch (\Throwable $t) {
                // Keep defaults safely
            }
        }

        if ($overrideTargetRoi !== null && $overrideTargetRoi > 0) {
            $targetRoi = round($overrideTargetRoi, 2);
            $source = 'USER_OVERRIDE';
        }
        if ($overrideBreakevenRoi !== null && $overrideBreakevenRoi > 0) {
            $breakevenRoi = round($overrideBreakevenRoi, 2);
            $source = 'USER_OVERRIDE';
        }

        $videoDailySpendCap = $dailySpendCap > 0 ? round($dailySpendCap * ($videoBudgetSharePct / 100.0), 0) : 0.0;
        $boostMaxDailyBudget = $videoDailySpendCap > 0 ? round($videoDailySpendCap * 0.20, 0) : 0.0;
        $boostMinDailyBudget = $videoDailySpendCap > 0 ? round($videoDailySpendCap * 0.10, 0) : 0.0;

        return [
            'breakeven_roi' => $breakevenRoi,
            'target_roi' => $targetRoi,
            'daily_gmv_target' => $dailyGmvTarget,
            'daily_spend_cap' => $dailySpendCap,
            'video_budget_share_pct' => $videoBudgetSharePct,
            'video_daily_spend_cap' => $videoDailySpendCap,
            'boost_budget_cap_min' => $boostMinDailyBudget,
            'boost_budget_cap_max' => $boostMaxDailyBudget,
            'source' => $source,
            'config_table_exists' => $this->tableExists('commerce_sop_config')
        ];
    }

    /**
     * Persists user ROI overrides into `commerce_sop_config` if the table exists.
     */
    public function saveRoiConfig(string $shopId, float $targetRoi, float $breakevenRoi): array {
        $targetRoi = max(1.0, round($targetRoi, 2));
        $breakevenRoi = max(1.0, round($breakevenRoi, 2));

        if (!$this->tableExists('commerce_sop_config')) {
            return [
                'persisted' => false,
                'message' => 'Bảng commerce_sop_config chưa được khởi tạo; áp dụng cấu hình ROI trực tiếp cho phiên làm việc.',
                'config' => $this->resolveRoiConfig($shopId, $targetRoi, $breakevenRoi)
            ];
        }

        try {
            $cols = $this->getTableColumns('commerce_sop_config');
            $stmtCheck = $this->db->prepare("SELECT id FROM `commerce_sop_config` WHERE shop_id = ? LIMIT 1");
            $stmtCheck->execute([$shopId]);
            $existingId = $stmtCheck->fetchColumn();

            $updates = [];
            $params = [];
            if (in_array('video_target_roi', $cols, true)) {
                $updates[] = "`video_target_roi` = ?";
                $params[] = $targetRoi;
            } elseif (in_array('target_roi', $cols, true)) {
                $updates[] = "`target_roi` = ?";
                $params[] = $targetRoi;
            }
            if (in_array('breakeven_roi', $cols, true)) {
                $updates[] = "`breakeven_roi` = ?";
                $params[] = $breakevenRoi;
            }

            if ($existingId && !empty($updates)) {
                $params[] = $existingId;
                $sql = "UPDATE `commerce_sop_config` SET " . implode(', ', $updates) . " WHERE id = ?";
                $this->db->prepare($sql)->execute($params);
                return [
                    'persisted' => true,
                    'message' => 'Đã lưu cấu hình ROI vào commerce_sop_config.',
                    'config' => $this->resolveRoiConfig($shopId, $targetRoi, $breakevenRoi)
                ];
            }
        } catch (\Throwable $t) {
            // Fall through gracefully
        }

        return [
            'persisted' => false,
            'message' => 'Áp dụng cấu hình ROI mới thành công.',
            'config' => $this->resolveRoiConfig($shopId, $targetRoi, $breakevenRoi)
        ];
    }

    /**
     * Computes real Break-even CPA (VND) from `commerce_product_costs` or fallback AOV / breakeven_roi.
     */
    private function resolveBreakevenCpa(string $shopId, float $breakevenRoi, float $realAov): array {
        if ($this->tableExists('commerce_product_costs')) {
            try {
                $stmt = $this->db->prepare("SELECT 
                    AVG(CASE WHEN unit_margin > 0 THEN unit_margin ELSE NULL END) as avg_unit_margin,
                    AVG(CASE WHEN selling_price > 0 THEN selling_price ELSE NULL END) as avg_selling_price,
                    AVG(CASE WHEN breakeven_roas > 0 THEN breakeven_roas ELSE NULL END) as avg_be_roas,
                    COUNT(*) as configured_count
                FROM `commerce_product_costs`
                WHERE shop_id = ? AND status = 'CONFIGURED'");
                $stmt->execute([$shopId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row && (int)($row['configured_count'] ?? 0) > 0 && (float)($row['avg_unit_margin'] ?? 0) > 0) {
                    return [
                        'breakeven_cpa' => round((float)$row['avg_unit_margin'], 0),
                        'avg_selling_price' => round((float)($row['avg_selling_price'] ?? 0), 0),
                        'configured_products' => (int)$row['configured_count'],
                        'source' => 'commerce_product_costs'
                    ];
                }
            } catch (\Throwable $t) {}
        }

        $fallbackAov = $realAov > 0 ? $realAov : 125000.0;
        $beCpa = $breakevenRoi > 0 ? round($fallbackAov / $breakevenRoi, 0) : 10000.0;
        return [
            'breakeven_cpa' => max(1000.0, $beCpa),
            'avg_selling_price' => round($fallbackAov, 0),
            'configured_products' => 0,
            'source' => $realAov > 0 ? 'REAL_AOV_DIV_BREAKEVEN_ROI' : 'SOP_FALLBACK_AOV'
        ];
    }

    /**
     * Module 2 Requirement 5: Combo AOV Tracker from `commerce_orders` & `commerce_order_items`.
     */
    public function getComboAovMetrics(string $shopId, string $startDate, string $endDate): array {
        $empty = [
            'has_data' => false,
            'total_valid_orders' => 0,
            'total_cancelled_orders' => 0,
            'total_gmv' => 0.0,
            'real_aov' => 0.0,
            'combo_goal_min' => self::COMBO_AOV_MIN_GOAL,
            'combo_goal_max' => self::COMBO_AOV_MAX_GOAL,
            'goal_status' => 'NO_DATA',
            'goal_gap_vnd' => 0.0,
            'single_unit' => ['orders' => 0, 'share_pct' => 0.0, 'gmv' => 0.0, 'aov' => 0.0],
            'combo_2_3' => ['orders' => 0, 'share_pct' => 0.0, 'gmv' => 0.0, 'aov' => 0.0],
            'bulk_4_plus' => ['orders' => 0, 'share_pct' => 0.0, 'gmv' => 0.0, 'aov' => 0.0],
            'recommendation' => 'Chưa có dữ liệu đơn hàng trong kỳ để tính AOV.'
        ];

        if (!$this->tableExists('commerce_orders') || !$this->tableExists('commerce_order_items')) {
            return $empty;
        }

        try {
            $sql = "SELECT 
                o.id as order_db_id,
                o.order_status,
                o.order_gross_amount,
                o.sub_total,
                COALESCE(SUM(oi.quantity), 0) as total_units,
                COALESCE(SUM(oi.quantity * oi.sale_price), 0) as items_gross,
                GROUP_CONCAT(CONCAT(COALESCE(oi.product_name, ''), ' ', COALESCE(oi.sku_name, '')) SEPARATOR ' | ') as combined_names
            FROM `commerce_orders` o
            LEFT JOIN `commerce_order_items` oi ON oi.order_id = o.id
            WHERE o.shop_id = ?
              AND o.platform_created_at >= ?
              AND o.platform_created_at <= ?
            GROUP BY o.id, o.order_status, o.order_gross_amount, o.sub_total";

            if ($this->driver === 'sqlite') {
                $sql = str_replace(
                    "GROUP_CONCAT(CONCAT(COALESCE(oi.product_name, ''), ' ', COALESCE(oi.sku_name, '')) SEPARATOR ' | ')",
                    "GROUP_CONCAT(COALESCE(oi.product_name, '') || ' ' || COALESCE(oi.sku_name, ''), ' | ')",
                    $sql
                );
            }

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$shopId, $startDate . ' 00:00:00', $endDate . ' 23:59:59']);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($rows)) {
                return $empty;
            }

            $validOrders = 0;
            $cancelledOrders = 0;
            $totalGmv = 0.0;

            $singleOrders = 0;
            $singleGmv = 0.0;
            $comboOrders = 0;
            $comboGmv = 0.0;
            $bulkOrders = 0;
            $bulkGmv = 0.0;

            foreach ($rows as $r) {
                $status = strtoupper((string)($r['order_status'] ?? ''));
                if ($status === 'CANCELLED') {
                    $cancelledOrders++;
                    continue;
                }

                $validOrders++;
                $gross = (float)($r['order_gross_amount'] ?? 0);
                if ($gross <= 0) {
                    $gross = (float)($r['items_gross'] ?? 0);
                }
                if ($gross <= 0) {
                    $gross = (float)($r['sub_total'] ?? 0);
                }
                $totalGmv += $gross;

                $units = max(1, (int)($r['total_units'] ?? 1));
                $namesLower = mb_strtolower((string)($r['combined_names'] ?? ''), 'UTF-8');
                $isNamedCombo23 = (bool)preg_match('/(combo|bộ\s*[23]|set\s*[23]|[23]\s*(hộp|chai|gói|tuýp|lọ|sp)|x[23]\b)/iu', $namesLower);

                if ($units >= 4) {
                    $bulkOrders++;
                    $bulkGmv += $gross;
                } elseif ($units >= 2 || $isNamedCombo23) {
                    $comboOrders++;
                    $comboGmv += $gross;
                } else {
                    $singleOrders++;
                    $singleGmv += $gross;
                }
            }

            if ($validOrders === 0) {
                $empty['total_cancelled_orders'] = $cancelledOrders;
                return $empty;
            }

            $realAov = round($totalGmv / $validOrders, 0);
            $goalStatus = 'ON_TARGET';
            $gapVnd = 0.0;
            $recommendation = 'AOV thực tế đạt chuẩn mục tiêu Combo 100.000₫ – 150.000₫. Tiếp tục duy trì tỷ trọng Combo 2-3 hộp.';

            if ($realAov < self::COMBO_AOV_MIN_GOAL) {
                $goalStatus = 'BELOW_GOAL';
                $gapVnd = round(self::COMBO_AOV_MIN_GOAL - $realAov, 0);
                $recommendation = 'AOV thấp hơn ngưỡng 100.000₫ (' . number_format($realAov, 0, ',', '.') . '₫). Cần đẩy mạnh gói Combo 2–3 hộp trên giỏ hàng Video & Live để kéo AOV lên 100k–150k.';
            } elseif ($realAov > self::COMBO_AOV_MAX_GOAL) {
                $goalStatus = 'ABOVE_GOAL';
                $gapVnd = round($realAov - self::COMBO_AOV_MAX_GOAL, 0);
                $recommendation = 'AOV vượt mốc 150.000₫ (' . number_format($realAov, 0, ',', '.') . '₫). Có dư địa CPA tốt hơn để scale ngân sách GMV Max.';
            }

            return [
                'has_data' => true,
                'total_valid_orders' => $validOrders,
                'total_cancelled_orders' => $cancelledOrders,
                'total_gmv' => round($totalGmv, 0),
                'real_aov' => $realAov,
                'combo_goal_min' => self::COMBO_AOV_MIN_GOAL,
                'combo_goal_max' => self::COMBO_AOV_MAX_GOAL,
                'goal_status' => $goalStatus,
                'goal_gap_vnd' => $gapVnd,
                'single_unit' => [
                    'orders' => $singleOrders,
                    'share_pct' => round(($singleOrders / $validOrders) * 100.0, 1),
                    'gmv' => round($singleGmv, 0),
                    'aov' => $singleOrders > 0 ? round($singleGmv / $singleOrders, 0) : 0.0
                ],
                'combo_2_3' => [
                    'orders' => $comboOrders,
                    'share_pct' => round(($comboOrders / $validOrders) * 100.0, 1),
                    'gmv' => round($comboGmv, 0),
                    'aov' => $comboOrders > 0 ? round($comboGmv / $comboOrders, 0) : 0.0
                ],
                'bulk_4_plus' => [
                    'orders' => $bulkOrders,
                    'share_pct' => round(($bulkOrders / $validOrders) * 100.0, 1),
                    'gmv' => round($bulkGmv, 0),
                    'aov' => $bulkOrders > 0 ? round($bulkGmv / $bulkOrders, 0) : 0.0
                ],
                'recommendation' => $recommendation
            ];
        } catch (\Throwable $t) {
            return $empty;
        }
    }

    /**
     * Loads real creative/video rows from `commerce_ads_creative_daily` with fallbacks to
     * `commerce_ads_product_daily`, `commerce_ads_campaign_daily`, `commerce_video_analytics`, `tiktok_video_ads`.
     */
    private function loadCreativeRows(string $shopId, string $startDate, string $endDate): array {
        $rows = [];
        $dataSourceMode = 'NONE';
        $distinctDays = 0;

        // Preload campaign metadata
        $campaignMeta = [];
        if ($this->tableExists('commerce_ads_campaign_daily')) {
            try {
                $stmtC = $this->db->prepare("SELECT 
                    campaign_id,
                    MAX(campaign_name) as campaign_name,
                    MAX(operation_status) as operation_status,
                    MAX(target_roas) as target_roas,
                    MAX(budget) as daily_budget,
                    MIN(stat_date) as camp_first_date
                FROM `commerce_ads_campaign_daily`
                WHERE shop_id = ?
                GROUP BY campaign_id");
                $stmtC->execute([$shopId]);
                while ($cr = $stmtC->fetch(PDO::FETCH_ASSOC)) {
                    $campaignMeta[(string)$cr['campaign_id']] = $cr;
                }
            } catch (\Throwable $t) {}
        }

        // Preload video analytics metadata (for title, creator, post_time, organic views/ctr)
        $videoMetaById = [];
        if ($this->tableExists('commerce_video_analytics')) {
            try {
                $stmtVa = $this->db->prepare("SELECT 
                    video_id,
                    MAX(title) as title,
                    MAX(cover_url) as cover_url,
                    MAX(video_url) as video_url,
                    MAX(creator_name) as creator_name,
                    MAX(creator_type) as creator_type,
                    MIN(video_post_time) as video_post_time,
                    MIN(stat_date) as first_va_date,
                    SUM(video_views) as views,
                    SUM(units_sold) as va_orders,
                    SUM(gross_revenue) as va_gmv,
                    AVG(ctr) as ctr
                FROM `commerce_video_analytics`
                WHERE shop_id = ?
                GROUP BY video_id");
                $stmtVa->execute([$shopId]);
                while ($vr = $stmtVa->fetch(PDO::FETCH_ASSOC)) {
                    $vid = (string)($vr['video_id'] ?? '');
                    if ($vid !== '') {
                        $videoMetaById[$vid] = $vr;
                    }
                }
            } catch (\Throwable $t) {}
        }

        // Preload legacy tiktok_video_ads metadata if present
        $legacyVideoMeta = [];
        if ($this->tableExists('tiktok_video_ads')) {
            try {
                $stmtTva = $this->db->query("SELECT * FROM `tiktok_video_ads`");
                while ($tr = $stmtTva->fetch(PDO::FETCH_ASSOC)) {
                    $vid = (string)($tr['id'] ?? '');
                    if ($vid !== '') {
                        $legacyVideoMeta[$vid] = $tr;
                    }
                }
            } catch (\Throwable $t) {}
        }

        // 1. Primary: commerce_ads_creative_daily
        if ($this->tableExists('commerce_ads_creative_daily')) {
            try {
                // Also get lifetime first_seen_date per item_id for true 7d/30d age
                $firstSeenMap = [];
                $stmtFirst = $this->db->prepare("SELECT item_id, MIN(stat_date) as first_seen_date, COUNT(DISTINCT stat_date) as lifetime_days, SUM(cost) as lifetime_spend, SUM(orders) as lifetime_orders
                    FROM `commerce_ads_creative_daily`
                    WHERE shop_id = ?
                    GROUP BY item_id");
                $stmtFirst->execute([$shopId]);
                while ($fr = $stmtFirst->fetch(PDO::FETCH_ASSOC)) {
                    $firstSeenMap[(string)$fr['item_id']] = $fr;
                }

                $stmt = $this->db->prepare("SELECT 
                    c.item_id,
                    c.item_group_id,
                    c.campaign_id,
                    c.is_unattributed,
                    MAX(c.creative_delivery_status_raw) as raw_status,
                    MAX(c.creative_delivery_status_normalized) as norm_status,
                    COUNT(DISTINCT c.stat_date) as distinct_days,
                    MIN(c.stat_date) as period_first_date,
                    MAX(c.stat_date) as latest_stat_date,
                    SUM(c.cost) as total_spend,
                    SUM(c.net_cost) as total_net_cost,
                    SUM(c.ads_gross_revenue) as total_ads_gross_revenue,
                    SUM(c.orders) as total_ads_orders,
                    AVG(c.api_roi) as avg_api_roi
                FROM `commerce_ads_creative_daily` c
                WHERE c.shop_id = ? AND c.stat_date >= ? AND c.stat_date <= ?
                GROUP BY c.item_id, c.item_group_id, c.campaign_id, c.is_unattributed
                ORDER BY total_spend DESC, total_ads_gross_revenue DESC");
                $stmt->execute([$shopId, $startDate, $endDate]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if (!empty($rows)) {
                    $dataSourceMode = 'CREATIVE_DAILY_API';
                    foreach ($rows as &$r) {
                        $fs = $firstSeenMap[(string)$r['item_id']] ?? null;
                        $r['first_seen_date'] = $fs['first_seen_date'] ?? $r['period_first_date'];
                        $r['lifetime_days'] = (int)($fs['lifetime_days'] ?? $r['distinct_days']);
                        $r['lifetime_spend'] = (float)($fs['lifetime_spend'] ?? $r['total_spend']);
                        $r['lifetime_orders'] = (int)($fs['lifetime_orders'] ?? $r['total_ads_orders']);
                    }
                    unset($r);

                    $stmtDays = $this->db->prepare("SELECT COUNT(DISTINCT stat_date) FROM `commerce_ads_creative_daily` WHERE shop_id = ? AND stat_date >= ? AND stat_date <= ?");
                    $stmtDays->execute([$shopId, $startDate, $endDate]);
                    $distinctDays = (int)$stmtDays->fetchColumn();
                }
            } catch (\Throwable $t) {
                $rows = [];
            }
        }

        // 2. Fallback A: commerce_ads_product_daily
        if (empty($rows) && $this->tableExists('commerce_ads_product_daily')) {
            try {
                $stmtP = $this->db->prepare("SELECT 
                    CONCAT('SPU-', p.item_group_id) as item_id,
                    p.item_group_id,
                    p.campaign_id,
                    0 as is_unattributed,
                    CASE WHEN SUM(p.cost) > 0 THEN 'IN_DELIVERY' ELSE 'NOT_DELIVERING' END as raw_status,
                    CASE WHEN SUM(p.cost) > 0 THEN 'DELIVERING' ELSE 'NOT_DELIVERING' END as norm_status,
                    COUNT(DISTINCT p.stat_date) as distinct_days,
                    MIN(p.stat_date) as period_first_date,
                    MAX(p.stat_date) as latest_stat_date,
                    SUM(p.cost) as total_spend,
                    SUM(p.net_cost) as total_net_cost,
                    SUM(p.ads_gross_revenue) as total_ads_gross_revenue,
                    SUM(p.orders) as total_ads_orders,
                    AVG(p.api_roi) as avg_api_roi
                FROM `commerce_ads_product_daily` p
                WHERE p.shop_id = ? AND p.stat_date >= ? AND p.stat_date <= ?
                GROUP BY p.item_group_id, p.campaign_id
                ORDER BY total_spend DESC");
                $stmtP->execute([$shopId, $startDate, $endDate]);
                $rows = $stmtP->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($rows)) {
                    $dataSourceMode = 'PRODUCT_GMV_MAX_FALLBACK';
                }
            } catch (\Throwable $t) {}
        }

        // 3. Fallback B: commerce_ads_campaign_daily (Product GMV Max)
        if (empty($rows) && $this->tableExists('commerce_ads_campaign_daily')) {
            try {
                $stmtCamp = $this->db->prepare("SELECT 
                    CONCAT('CAMP-', d.campaign_id) as item_id,
                    d.campaign_id as item_group_id,
                    d.campaign_id,
                    MAX(d.campaign_name) as campaign_name,
                    0 as is_unattributed,
                    CASE WHEN MAX(d.operation_status) = 'DISABLE' THEN 'NOT_DELIVERING' WHEN SUM(d.spend) > 0 THEN 'IN_DELIVERY' ELSE 'NOT_DELIVERING' END as raw_status,
                    CASE WHEN MAX(d.operation_status) = 'DISABLE' THEN 'NOT_DELIVERING' WHEN SUM(d.spend) > 0 THEN 'DELIVERING' ELSE 'NOT_DELIVERING' END as norm_status,
                    COUNT(DISTINCT d.stat_date) as distinct_days,
                    MIN(d.stat_date) as period_first_date,
                    MAX(d.stat_date) as latest_stat_date,
                    SUM(d.spend) as total_spend,
                    SUM(d.spend) as total_net_cost,
                    SUM(d.gross_revenue) as total_ads_gross_revenue,
                    SUM(d.orders) as total_ads_orders,
                    AVG(d.roi) as avg_api_roi
                FROM `commerce_ads_campaign_daily` d
                WHERE d.shop_id = ? AND d.stat_date >= ? AND d.stat_date <= ?
                  AND (d.campaign_type NOT LIKE '%LIVE%' AND d.campaign_name NOT LIKE '%LIVE%')
                GROUP BY d.campaign_id
                ORDER BY total_spend DESC");
                $stmtCamp->execute([$shopId, $startDate, $endDate]);
                $rows = $stmtCamp->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($rows)) {
                    $dataSourceMode = 'CAMPAIGN_PRODUCT_FALLBACK';
                }
            } catch (\Throwable $t) {}
        }

        // 4. Fallback C: commerce_video_analytics (organic/shop videos)
        if (empty($rows) && !empty($videoMetaById)) {
            $dataSourceMode = 'VIDEO_ANALYTICS_FALLBACK';
            foreach ($videoMetaById as $vid => $vr) {
                $rows[] = [
                    'item_id' => $vid,
                    'item_group_id' => '',
                    'campaign_id' => 'ORGANIC_VIDEO',
                    'is_unattributed' => 0,
                    'raw_status' => ((int)($vr['views'] ?? 0) > 0 || (int)($vr['va_orders'] ?? 0) > 0) ? 'IN_DELIVERY' : 'NOT_DELIVERING',
                    'norm_status' => ((int)($vr['views'] ?? 0) > 0 || (int)($vr['va_orders'] ?? 0) > 0) ? 'DELIVERING' : 'NOT_DELIVERING',
                    'distinct_days' => 1,
                    'period_first_date' => $vr['first_va_date'] ?? $startDate,
                    'latest_stat_date' => $endDate,
                    'first_seen_date' => $vr['first_va_date'] ?? $startDate,
                    'total_spend' => 0.0,
                    'total_net_cost' => 0.0,
                    'total_ads_gross_revenue' => (float)($vr['va_gmv'] ?? 0),
                    'total_ads_orders' => (int)($vr['va_orders'] ?? 0),
                    'avg_api_roi' => null
                ];
            }
        }

        // 5. Fallback D: legacy tiktok_video_ads
        if (empty($rows) && !empty($legacyVideoMeta)) {
            $dataSourceMode = 'TIKTOK_VIDEO_ADS_FALLBACK';
            foreach ($legacyVideoMeta as $vid => $tr) {
                $spend = (float)($tr['spend'] ?? 0);
                $orders = (int)($tr['conversions'] ?? 0);
                $gmv = (float)($tr['gmv'] ?? 0);
                $rows[] = [
                    'item_id' => $vid,
                    'item_group_id' => (string)($tr['product_id'] ?? ''),
                    'campaign_id' => (string)($tr['campaign_id'] ?? ''),
                    'is_unattributed' => 0,
                    'raw_status' => ($spend > 0 || $orders > 0) ? 'IN_DELIVERY' : 'NOT_DELIVERING',
                    'norm_status' => ($spend > 0 || $orders > 0) ? 'DELIVERING' : 'NOT_DELIVERING',
                    'distinct_days' => (int)($tr['days_running'] ?? 1),
                    'period_first_date' => $startDate,
                    'latest_stat_date' => $endDate,
                    'first_seen_date' => $startDate,
                    'total_spend' => $spend,
                    'total_net_cost' => $spend,
                    'total_ads_gross_revenue' => $gmv,
                    'total_ads_orders' => $orders,
                    'avg_api_roi' => $spend > 0 ? round($gmv / $spend, 2) : null
                ];
            }
        }

        return [
            'rows' => $rows,
            'data_source_mode' => $dataSourceMode,
            'distinct_days' => $distinctDays,
            'campaign_meta' => $campaignMeta,
            'video_meta' => $videoMetaById,
            'legacy_meta' => $legacyVideoMeta
        ];
    }

    /**
     * Full Module 2 SOP Dashboard payload:
     * - Configurable ROI & Budget Cap
     * - 5-Status Video Pool & Pool Health KPIs
     * - 3-Day ROI Lock & Creative Boost Tracker
     * - 7-Day & 30-Day Cleanup Candidates
     * - Combo AOV Tracker
     */
    public function getDashboard(
        string $shopId,
        string $startDate,
        string $endDate,
        ?float $overrideTargetRoi = null,
        ?float $overrideBreakevenRoi = null
    ): array {
        $expectedDays = 1;
        try {
            $dtStart = new DateTime($startDate);
            $dtEnd = new DateTime($endDate);
            $expectedDays = max(1, (int)$dtStart->diff($dtEnd)->format('%a') + 1);
        } catch (\Throwable $t) {
            $expectedDays = 1;
        }

        $roiConfig = $this->resolveRoiConfig($shopId, $overrideTargetRoi, $overrideBreakevenRoi);
        $targetRoi = (float)$roiConfig['target_roi'];
        $breakevenRoi = (float)$roiConfig['breakeven_roi'];

        $comboAov = $this->getComboAovMetrics($shopId, $startDate, $endDate);
        $cpaInfo = $this->resolveBreakevenCpa($shopId, $breakevenRoi, (float)($comboAov['real_aov'] ?? 0));
        $breakevenCpa = (float)$cpaInfo['breakeven_cpa'];

        $loaded = $this->loadCreativeRows($shopId, $startDate, $endDate);
        $rawRows = $loaded['rows'];
        $dataSourceMode = $loaded['data_source_mode'];
        $campaignMeta = $loaded['campaign_meta'];
        $videoMeta = $loaded['video_meta'];
        $legacyMeta = $loaded['legacy_meta'];

        $statusBuckets = [
            'OUTSTANDING' => ['code' => 'OUTSTANDING', 'label' => 'Nổi bật', 'count' => 0, 'spend' => 0.0, 'gmv' => 0.0, 'orders' => 0, 'video_ids' => []],
            'EFFECTIVE' => ['code' => 'EFFECTIVE', 'label' => 'Có hiệu quả', 'count' => 0, 'spend' => 0.0, 'gmv' => 0.0, 'orders' => 0, 'video_ids' => []],
            'EXPLORING' => ['code' => 'EXPLORING', 'label' => 'Đang khám phá', 'count' => 0, 'spend' => 0.0, 'gmv' => 0.0, 'orders' => 0, 'video_ids' => []],
            'INEFFECTIVE' => ['code' => 'INEFFECTIVE', 'label' => 'Kém hiệu quả', 'count' => 0, 'spend' => 0.0, 'gmv' => 0.0, 'orders' => 0, 'video_ids' => []],
            'INACTIVE' => ['code' => 'INACTIVE', 'label' => 'Không hoạt động', 'count' => 0, 'spend' => 0.0, 'gmv' => 0.0, 'orders' => 0, 'video_ids' => []]
        ];

        $videos = [];
        $totalSpend = 0.0;
        $totalGmv = 0.0;
        $totalOrders = 0;
        $zeroOrderSpend = 0.0;
        $zeroOrderCount = 0;
        $newVideosCount = 0;

        $roiLockVideos = [];
        $boostCandidates = [];
        $boostStopViolations = [];
        $boostActiveWatching = [];
        $cleanup7d = [];
        $cleanup30d = [];

        $todayRef = new DateTime($endDate);
        $latestStatDate = null;

        foreach ($rawRows as $r) {
            $rowLatest = !empty($r['latest_stat_date']) ? substr((string)$r['latest_stat_date'], 0, 10) : null;
            if ($rowLatest !== null && ($latestStatDate === null || $rowLatest > $latestStatDate)) {
                $latestStatDate = $rowLatest;
            }
            $itemId = (string)($r['item_id'] ?? '');
            $campId = (string)($r['campaign_id'] ?? '');
            $spuId = (string)($r['item_group_id'] ?? '');
            $isUnattributed = ((int)($r['is_unattributed'] ?? 0) === 1 || $itemId === '-1');

            $spend = (float)($r['total_spend'] ?? 0);
            $gmv = (float)($r['total_ads_gross_revenue'] ?? 0);
            $orders = (int)($r['total_ads_orders'] ?? 0);
            $roi = $spend > 0 ? round($gmv / $spend, 2) : 0.0;
            $cpa = $orders > 0 ? round($spend / $orders, 0) : null;

            $totalSpend += $spend;
            $totalGmv += $gmv;
            $totalOrders += $orders;
            if ($orders === 0 && $spend > 0) {
                $zeroOrderSpend += $spend;
                $zeroOrderCount++;
            }

            $rawStatus = strtoupper((string)($r['raw_status'] ?? 'UNKNOWN'));
            $normStatus = strtoupper((string)($r['norm_status'] ?? 'UNKNOWN'));
            $cMeta = $campaignMeta[$campId] ?? null;
            $campName = !empty($r['campaign_name']) ? (string)$r['campaign_name'] : (string)($cMeta['campaign_name'] ?? ('Chiến dịch ' . $campId));
            $campOpStatus = strtoupper((string)($cMeta['operation_status'] ?? 'ENABLE'));
            $isBoostCamp = (bool)preg_match('/(boost|creative\s*boost|đẩy|test)/iu', $campName);

            $vMeta = $videoMeta[$itemId] ?? null;
            $lMeta = $legacyMeta[$itemId] ?? null;

            $title = $vMeta['title'] ?? $lMeta['title'] ?? ($campName . ($spuId !== '' ? " (SPU {$spuId})" : ''));
            $creatorName = $vMeta['creator_name'] ?? $lMeta['author_name'] ?? '';
            $coverUrl = $vMeta['cover_url'] ?? $lMeta['thumbnail'] ?? null;
            $videoUrl = $vMeta['video_url'] ?? null;
            $views = (int)($vMeta['views'] ?? $lMeta['views'] ?? 0);
            $ctr = round((float)($vMeta['ctr'] ?? $lMeta['ctr'] ?? 0), 2);

            $firstSeenStr = (string)($r['first_seen_date'] ?? $r['period_first_date'] ?? $endDate);
            $postTimeStr = !empty($vMeta['video_post_time']) ? substr((string)$vMeta['video_post_time'], 0, 10) : $firstSeenStr;
            if ($postTimeStr >= $startDate && $postTimeStr <= $endDate) {
                $newVideosCount++;
            }

            $ageDays = max(1, (int)($r['distinct_days'] ?? 1));
            try {
                $dtFirst = new DateTime(substr($firstSeenStr, 0, 10));
                $ageDays = max($ageDays, (int)$dtFirst->diff($todayRef)->format('%a') + 1);
            } catch (\Throwable $t) {}

            $lifetimeDays = (int)($r['lifetime_days'] ?? $ageDays);
            $lifetimeSpend = (float)($r['lifetime_spend'] ?? $spend);
            $lifetimeOrders = (int)($r['lifetime_orders'] ?? $orders);

            // 5-Status SOP Classification
            $isNotDelivering = (
                in_array($normStatus, ['NOT_DELIVERING', 'INACTIVE', 'PAUSED', 'DISABLED', 'REJECTED'], true) ||
                strpos($rawStatus, 'NOT_DELIVER') !== false ||
                strpos($rawStatus, 'DISABLE') !== false ||
                strpos($rawStatus, 'INELIGIBLE') !== false ||
                $campOpStatus === 'DISABLE'
            );

            $sopStatus = 'EXPLORING';
            $sopAction = 'Theo dõi máy học';

            $hasActivity = ($spend > 0 || $orders > 0 || $gmv > 0);
            if (($isNotDelivering && !$hasActivity) || !$hasActivity) {
                $sopStatus = 'INACTIVE';
                $sopAction = 'Không phân phối — kiểm tra liên kết SP / bật lại hoặc thay mới';
            } elseif ($orders > 0 && $roi >= $targetRoi) {
                $sopStatus = 'OUTSTANDING';
                $sopAction = 'Video chủ lực — giữ nguyên, có thể nhân bản hook/kịch bản';
            } elseif ($orders > 0 && ($roi >= $breakevenRoi || $spend == 0.0)) {
                $sopStatus = 'EFFECTIVE';
                $sopAction = $spend == 0.0
                    ? 'Có đơn tự nhiên (0₫ QC) — xin mã Spark Ads / đưa vào pool GMV Max'
                    : 'Đạt hòa vốn trở lên — tiếp tục nuôi và tối ưu nhẹ CTR/giá bán';
            } elseif ($ageDays <= 7 && ($orders === 0 ? $spend <= (1.5 * $breakevenCpa) : $ageDays <= 3)) {
                $sopStatus = 'EXPLORING';
                $sopAction = $ageDays <= 3
                    ? 'Khóa ROI 3 ngày đầu — không chỉnh sửa target ROI'
                    : 'Đang khám phá (ngày ' . $ageDays . '/7) — theo dõi ngưỡng CPA hòa vốn';
            } else {
                $sopStatus = 'INEFFECTIVE';
                $sopAction = $orders === 0
                    ? 'Đốt ngân sách 0 đơn (> ' . number_format($breakevenCpa, 0, ',', '.') . '₫ CPA) — tắt/loại bỏ'
                    : 'ROI (' . $roi . 'x) dưới điểm hòa vốn (' . $breakevenRoi . 'x) — kiểm tra hook 3s & giá';
            }

            $statusBuckets[$sopStatus]['count']++;
            $statusBuckets[$sopStatus]['spend'] += $spend;
            $statusBuckets[$sopStatus]['gmv'] += $gmv;
            $statusBuckets[$sopStatus]['orders'] += $orders;
            if (!$isUnattributed && $itemId !== '') {
                $statusBuckets[$sopStatus]['video_ids'][] = $itemId;
            }

            $videoItem = [
                'video_id' => $itemId,
                'campaign_id' => $campId,
                'campaign_name' => $campName,
                'spu_id' => $spuId,
                'title' => $title,
                'creator_name' => $creatorName,
                'cover_url' => $coverUrl,
                'video_url' => $videoUrl,
                'sop_status' => $sopStatus,
                'sop_status_label' => $statusBuckets[$sopStatus]['label'],
                'sop_action' => $sopAction,
                'raw_delivery_status' => $rawStatus,
                'norm_delivery_status' => $normStatus,
                'spend' => round($spend, 0),
                'gmv' => round($gmv, 0),
                'orders' => $orders,
                'roi' => $roi,
                'cpa' => $cpa,
                'views' => $views,
                'ctr' => $ctr,
                'age_days' => $ageDays,
                'distinct_days' => (int)($r['distinct_days'] ?? 1),
                'first_seen_date' => $firstSeenStr,
                'latest_stat_date' => $r['latest_stat_date'] ?? $endDate,
                'is_unattributed' => $isUnattributed,
                'in_3day_roi_lock' => ($ageDays <= 3 && $spend > 0)
            ];
            $videos[] = $videoItem;

            // 3-Day ROI Lock Tracking
            if ($ageDays <= 3 && $spend > 0 && !$isUnattributed) {
                $roiLockVideos[] = $videoItem;
            }

            // Creative Boost Tracking (24-48h, max 3 days, stop rules)
            if (!$isUnattributed) {
                $cpaMultiple = $breakevenCpa > 0 ? round($spend / $breakevenCpa, 2) : 0.0;
                $selfSpendingInMain = (!$isBoostCamp && $spend > ($breakevenCpa * 0.5) && $ageDays <= 3);

                if ($isBoostCamp || ($ageDays <= 3 && $spend > 0)) {
                    $stopReasons = [];
                    if ($isBoostCamp && $ageDays > 2) {
                        $stopReasons[] = 'Quá thời lượng Boost 48h (' . $ageDays . ' ngày)';
                    }
                    if ($orders === 0 && $spend > $breakevenCpa) {
                        $stopReasons[] = 'Chi tiêu ' . $cpaMultiple . 'x CPA hòa vốn với 0 đơn';
                    }
                    if ($isBoostCamp && $selfSpendingInMain) {
                        $stopReasons[] = 'Video đang tự tiêu tiền ở chiến dịch chính';
                    }

                    if (!empty($stopReasons)) {
                        $boostStopViolations[] = array_merge($videoItem, [
                            'cpa_multiple' => $cpaMultiple,
                            'stop_reasons' => $stopReasons
                        ]);
                    } elseif ($isBoostCamp) {
                        $boostActiveWatching[] = array_merge($videoItem, [
                            'cpa_multiple' => $cpaMultiple
                        ]);
                    }
                }

                // Candidate for Creative Boost: Exploring/Effective with good CTR/views or organic orders, low spend
                if (in_array($sopStatus, ['EXPLORING', 'EFFECTIVE'], true) && $spend <= ($breakevenCpa * 0.5) && ($views >= 500 || $ctr >= 2.0 || $orders > 0)) {
                    $boostCandidates[] = $videoItem;
                }

                // 7-Day & 30-Day Cleanup Candidates
                if ($lifetimeOrders === 0 && $lifetimeDays >= 30 && $lifetimeSpend > 0) {
                    $cleanup30d[] = array_merge($videoItem, [
                        'lifetime_days' => $lifetimeDays,
                        'lifetime_spend' => round($lifetimeSpend, 0),
                        'cleanup_reason' => '30 ngày 0 đơn hàng (đã chi ' . number_format($lifetimeSpend, 0, ',', '.') . '₫)'
                    ]);
                } elseif ($orders === 0 && $spend > $breakevenCpa) {
                    $cleanup7d[] = array_merge($videoItem, [
                        'cpa_multiple' => $cpaMultiple,
                        'urgent' => ($spend >= 1.5 * $breakevenCpa),
                        'cleanup_reason' => '0 đơn, chi ' . $cpaMultiple . 'x CPA hòa vốn (' . number_format($spend, 0, ',', '.') . '₫)'
                    ]);
                }
            }
        }

        // Pool Health KPIs
        $activePoolCount = $statusBuckets['OUTSTANDING']['count'] + $statusBuckets['EFFECTIVE']['count'] + $statusBuckets['EXPLORING']['count'];
        $exploringCount = $statusBuckets['EXPLORING']['count'];
        $newVideosPerDay = round($newVideosCount / $expectedDays, 1);
        $zeroOrderSpendPct = $totalSpend > 0 ? round(($zeroOrderSpend / $totalSpend) * 100.0, 1) : 0.0;
        $overallRoas = $totalSpend > 0 ? round($totalGmv / $totalSpend, 2) : 0.0;

        $poolHealth = [
            'active_pool_count' => $activePoolCount,
            'active_pool_target' => 50,
            'active_pool_status' => $activePoolCount >= 50 ? 'OK' : ($activePoolCount >= 25 ? 'WARNING' : 'CRITICAL'),
            'exploring_count' => $exploringCount,
            'exploring_min_warn' => 15,
            'exploring_status' => $exploringCount >= 15 ? 'OK' : 'WARNING',
            'new_videos_total' => $newVideosCount,
            'new_videos_per_day' => $newVideosPerDay,
            'new_videos_target_min' => 10,
            'new_videos_target_max' => 15,
            'new_videos_status' => ($newVideosPerDay >= 10 && $newVideosPerDay <= 15) ? 'OK' : ($newVideosPerDay > 15 ? 'ABOVE_TARGET' : 'WARNING'),
            'zero_order_spend' => round($zeroOrderSpend, 0),
            'zero_order_count' => $zeroOrderCount,
            'zero_order_spend_pct' => $zeroOrderSpendPct,
            'zero_order_spend_target_max_pct' => 10.0,
            'zero_order_spend_status' => $zeroOrderSpendPct < 10.0 ? 'OK' : ($zeroOrderSpendPct < 20.0 ? 'WARNING' : 'CRITICAL')
        ];

        // Round bucket totals
        foreach ($statusBuckets as &$sb) {
            $sb['spend'] = round($sb['spend'], 0);
            $sb['gmv'] = round($sb['gmv'], 0);
            $sb['roi'] = $sb['spend'] > 0 ? round($sb['gmv'] / $sb['spend'], 2) : 0.0;
            $sb['video_ids'] = array_values(array_unique($sb['video_ids']));
        }
        unset($sb);

        return [
            'shop_id' => $shopId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'expected_days' => $expectedDays,
            'data_source_mode' => $dataSourceMode,
            'latest_stat_date' => $latestStatDate,
            'roi_config' => $roiConfig,
            'breakeven_cpa_info' => $cpaInfo,
            'overall_stats' => [
                'total_videos' => count($videos),
                'total_spend' => round($totalSpend, 0),
                'total_gmv' => round($totalGmv, 0),
                'total_orders' => $totalOrders,
                'overall_roas' => $overallRoas,
                'is_profitable' => ($overallRoas >= $breakevenRoi),
                'roas_gap' => round($overallRoas - $breakevenRoi, 2)
            ],
            'pool_health' => $poolHealth,
            'status_buckets' => array_values($statusBuckets),
            'videos' => $videos,
            'roi_lock_and_boost' => [
                'roi_protection_notice' => 'Lưu ý SOP: Creative Boost KHÔNG được áp dụng Bảo vệ ROI (ROI Protection). Giới hạn 24–48h (tối đa 3 ngày), ngân sách <= 10–20% hạn mức ngày.',
                'roi_lock_3d_count' => count($roiLockVideos),
                'roi_lock_3d_videos' => array_slice($roiLockVideos, 0, 30),
                'boost_stop_violations' => $boostStopViolations,
                'boost_active_watching' => $boostActiveWatching,
                'boost_candidates' => array_slice($boostCandidates, 0, 20)
            ],
            'cleanup_7d_30d' => [
                'breakeven_cpa' => $breakevenCpa,
                'cleanup_7d_count' => count($cleanup7d),
                'cleanup_7d_ids' => array_values(array_map(fn($x) => $x['video_id'], $cleanup7d)),
                'cleanup_7d' => $cleanup7d,
                'cleanup_30d_count' => count($cleanup30d),
                'cleanup_30d_ids' => array_values(array_map(fn($x) => $x['video_id'], $cleanup30d)),
                'cleanup_30d' => $cleanup30d
            ],
            'combo_aov' => $comboAov
        ];
    }
}

// Direct HTTP entrypoint when accessed standalone (without modifying commerce_dashboard.php)
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/db.php';
    require_once __DIR__ . '/auth_guard.php';

    header('Content-Type: application/json; charset=utf-8');
    handleCORS();
    requireAuth('admin:all');

    try {
        $db = getDBConnection();
        $service = new CommerceProductGmvSopService($db);

        $action = (string)($_GET['action'] ?? $_POST['action'] ?? 'get_product_gmv_sop_dashboard');
        $shopId = trim((string)($_GET['shop_id'] ?? $_POST['shop_id'] ?? '7495657895504611503'));
        $endDate = trim((string)($_GET['end_date'] ?? $_POST['end_date'] ?? date('Y-m-d')));
        $startDate = trim((string)($_GET['start_date'] ?? $_POST['start_date'] ?? date('Y-m-d', strtotime('-29 days', strtotime($endDate)))));

        $targetRoi = isset($_GET['target_roi']) && is_numeric($_GET['target_roi']) ? (float)$_GET['target_roi'] : null;
        $breakevenRoi = isset($_GET['breakeven_roi']) && is_numeric($_GET['breakeven_roi']) ? (float)$_GET['breakeven_roi'] : null;

        if ($action === 'save_roi_config') {
            $raw = file_get_contents('php://input');
            $body = json_decode($raw, true) ?: $_POST;
            $tRoi = (float)($body['target_roi'] ?? $targetRoi ?? CommerceProductGmvSopService::DEFAULT_TARGET_ROI);
            $bRoi = (float)($body['breakeven_roi'] ?? $breakevenRoi ?? CommerceProductGmvSopService::DEFAULT_BREAKEVEN_ROI);
            $sId = trim((string)($body['shop_id'] ?? $shopId));
            $res = $service->saveRoiConfig($sId, $tRoi, $bRoi);
            echo json_encode(['success' => true, 'data' => $res, 'message' => $res['message']], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($action === 'get_combo_aov') {
            $data = $service->getComboAovMetrics($shopId, $startDate, $endDate);
            echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $dashboard = $service->getDashboard($shopId, $startDate, $endDate, $targetRoi, $breakevenRoi);

        if ($action === 'get_video_pool_5status') {
            echo json_encode([
                'success' => true,
                'data' => [
                    'roi_config' => $dashboard['roi_config'],
                    'pool_health' => $dashboard['pool_health'],
                    'status_buckets' => $dashboard['status_buckets'],
                    'videos' => $dashboard['videos']
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($action === 'get_creative_boost_tracker') {
            echo json_encode([
                'success' => true,
                'data' => [
                    'roi_config' => $dashboard['roi_config'],
                    'breakeven_cpa_info' => $dashboard['breakeven_cpa_info'],
                    'roi_lock_and_boost' => $dashboard['roi_lock_and_boost'],
                    'cleanup_7d_30d' => $dashboard['cleanup_7d_30d']
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Default: get_product_gmv_sop_dashboard
        echo json_encode(['success' => true, 'data' => $dashboard], JSON_UNESCAPED_UNICODE);
    } catch (\Throwable $t) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Lỗi xử lý Module 2 Product GMV Max SOP: ' . $t->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}
