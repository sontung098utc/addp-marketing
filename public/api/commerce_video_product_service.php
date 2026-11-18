<?php
/**
 * ADDP COMMERCE INTELLIGENCE - PRODUCT-CENTRIC VIDEO & KOC/KOL INTELLIGENCE SERVICE
 *
 * Provides:
 * 1. Reporting by Product Code (Mã sản phẩm - SPU):
 *    - Each product lists all associated Videos (Ads Creative, Shop Short Videos, Affiliate KOC/KOL Videos).
 *    - Per-video metrics: Gross Revenue, Cancel/Refund Loss, Realized Net Revenue, Ad Spend,
 *      Affiliate Commission (Estimated & Settled), Total Orders, Cancelled Orders, Refunded Orders,
 *      Views, Clicks, CTR, CVR, GPM, CPA, Gross ROI, Net ROI.
 * 2. Automated KOC/KOL Video Evaluation (KEEP / TEST / DROP):
 *    - Recommends which videos to KEEP & SCALE (Nên giữ & đẩy mạnh), TEST/OPTIMIZE (Theo dõi thêm),
 *      or DROP/EXCLUDE (Nên loại trừ) with plain Vietnamese explanations.
 * 3. Daily New Video Production Quota Tracker (Target: 10–15 new videos/day):
 *    - Tracks daily new videos produced/published broken down by day and by Product Code,
 *      evaluating whether the team achieved the 10–15 videos/day SOP target.
 *
 * ZERO MOCK DATA: 100% sourced from real database tables synced from TikTok Shop & TikTok Ads.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

class CommerceVideoProductService {
    public const DEFAULT_VIDEO_ROI_TARGET = 15.0;
    public const DEFAULT_MIN_NEW_VIDEOS_PER_DAY = 10;
    public const DEFAULT_MAX_NEW_VIDEOS_PER_DAY = 15;

    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? getDBConnection();
    }

    private function tableExists(string $tableName): bool {
        try {
            $quoted = $this->db->quote($tableName);
            $stmt = $this->db->query("SHOW TABLES LIKE {$quoted}");
            return $stmt !== false && (bool)$stmt->fetchColumn();
        } catch (\Throwable $t) {
            return false;
        }
    }

    public function resolveConfig(string $shopId, array $options = []): array {
        $targetRoi = self::DEFAULT_VIDEO_ROI_TARGET;
        $minVideosPerDay = self::DEFAULT_MIN_NEW_VIDEOS_PER_DAY;
        $maxVideosPerDay = self::DEFAULT_MAX_NEW_VIDEOS_PER_DAY;
        $mainSkuKeyword = 'Viên sủi mát gan';

        if ($this->tableExists('commerce_sop_config')) {
            try {
                $stmt = $this->db->prepare("SELECT * FROM `commerce_sop_config` WHERE shop_id = ? LIMIT 1");
                $stmt->execute([$shopId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    foreach (['video_roi_target', 'video_target_roi', 'shop_roi_target', 'target_roi'] as $col) {
                        if (isset($row[$col]) && (float)$row[$col] > 0) {
                            $targetRoi = (float)$row[$col];
                            break;
                        }
                    }
                    if (!empty($row['main_sku_keyword'])) {
                        $mainSkuKeyword = (string)$row['main_sku_keyword'];
                    }
                }
            } catch (\Throwable $t) {}
        }

        if (isset($options['target_roi']) && is_numeric($options['target_roi']) && (float)$options['target_roi'] > 0) {
            $targetRoi = (float)$options['target_roi'];
        }

        return [
            'video_roi_target' => round($targetRoi, 2),
            'min_new_videos_per_day' => $minVideosPerDay,
            'max_new_videos_per_day' => $maxVideosPerDay,
            'main_sku_keyword' => $mainSkuKeyword,
        ];
    }

    /**
     * Main entry point for Product-Centric Video Intelligence, KOC/KOL Evaluation & Daily 10-15 Video Quota.
     */
    public function getVideoProductIntelligence(
        string $shopId,
        string $startDate,
        string $endDate,
        array $options = []
    ): array {
        $config = $this->resolveConfig($shopId, $options);
        $targetRoi = $config['video_roi_target'];

        $expectedDays = 1;
        try {
            $dtStart = new DateTime($startDate);
            $dtEnd = new DateTime($endDate);
            $expectedDays = max(1, (int)$dtStart->diff($dtEnd)->format('%a') + 1);
        } catch (\Throwable $t) {
            $expectedDays = 1;
        }

        // 1. Load Shop Overall & Per-Product Order + Cancel + Refund stats in period
        $shopLossStats = $this->fetchShopAndProductOrderStats($shopId, $startDate, $endDate, $config['main_sku_keyword']);
        $productsCatalogMap = $shopLossStats['products_map'];
        $shopCancelRate = $shopLossStats['shop_cancel_rate'];
        $shopRefundRate = $shopLossStats['shop_refund_rate'];
        $shopLossRate = $shopLossStats['shop_loss_rate'];
        $mainProductId = $shopLossStats['main_product_id'];

        // 2. Load Video Analytics Metadata & Performance (`commerce_video_analytics` & `tiktok_video_ads`)
        $videoAnalyticsMap = $this->fetchVideoAnalyticsMap($shopId, $startDate, $endDate);

        // 3. Load Affiliate / KOC / KOL Orders (`commerce_affiliate_orders` joined with `commerce_orders`)
        $affiliateData = $this->fetchAffiliateVideoStats($shopId, $startDate, $endDate);
        $affiliateByVideoProduct = $affiliateData['by_video_product'];
        $affiliateByVideoOnly = $affiliateData['by_video'];
        $videoToProductHint = $affiliateData['video_to_product_hint'];

        // 4. Load Ads Creative Daily (`commerce_ads_creative_daily`) + First Seen Dates
        $creativeData = $this->fetchAdsCreativeStats($shopId, $startDate, $endDate);
        $creativeRows = $creativeData['rows'];
        $creativeFirstSeenMap = $creativeData['first_seen_map'];
        foreach ($creativeData['video_to_product_hint'] as $vid => $pid) {
            if (!isset($videoToProductHint[$vid]) && $pid !== '') {
                $videoToProductHint[$vid] = $pid;
            }
        }

        // 5. Merge all videos into a unified list of (product_id, video_id) items
        $unifiedVideosByKey = [];

        // 5A. From commerce_ads_creative_daily
        foreach ($creativeRows as $cr) {
            $vid = (string)($cr['item_id'] ?? '');
            if ($vid === '') continue;
            $pid = (string)($cr['item_group_id'] ?? '');
            if ($pid === '' || $pid === '-1') {
                $pid = $videoToProductHint[$vid] ?? ($mainProductId ?: 'UNMAPPED_PRODUCT');
            }

            $key = $pid . '::' . $vid;
            $va = $videoAnalyticsMap[$vid] ?? null;
            $aff = $affiliateByVideoProduct[$key] ?? ($affiliateByVideoOnly[$vid] ?? null);

            $firstDate = $va['produced_date'] ?? ($creativeFirstSeenMap[$vid] ?? ($aff['first_order_date'] ?? $cr['first_stat_date']));

            $unifiedVideosByKey[$key] = [
                'product_id' => $pid,
                'video_id' => $vid,
                'is_unattributed' => ($vid === '-1' || (int)($cr['is_unattributed'] ?? 0) === 1),
                'campaign_id' => (string)($cr['campaign_id'] ?? ''),
                'campaign_count' => (int)($cr['campaign_count'] ?? 1),
                'delivery_status' => (string)($cr['norm_status'] ?? 'DELIVERING'),
                'ad_spend' => (float)($cr['spend'] ?? 0.0),
                'ads_gross_revenue' => (float)($cr['ads_gross_revenue'] ?? 0.0),
                'ads_orders' => (int)($cr['ads_orders'] ?? 0),
                'produced_date' => $firstDate,
                'first_stat_date' => $cr['first_stat_date'] ?? null,
                'latest_stat_date' => $cr['latest_stat_date'] ?? null,
                'active_days' => (int)($cr['active_days'] ?? 1),
                'va' => $va,
                'aff' => $aff,
                'source_tags' => ['ADS_GMV_MAX'],
            ];
            if ($va) $unifiedVideosByKey[$key]['source_tags'][] = 'SHOP_VIDEO';
            if ($aff) $unifiedVideosByKey[$key]['source_tags'][] = 'AFFILIATE_KOC';
        }

        // 5B. From commerce_affiliate_orders (KOC/KOL videos not yet in unifiedVideosByKey)
        foreach ($affiliateByVideoProduct as $key => $aff) {
            if (isset($unifiedVideosByKey[$key])) {
                continue;
            }
            $pid = (string)$aff['product_id'];
            $vid = (string)$aff['video_id'];
            $va = $videoAnalyticsMap[$vid] ?? null;
            $firstDate = $va['produced_date'] ?? ($creativeFirstSeenMap[$vid] ?? ($aff['first_order_date'] ?? null));

            $unifiedVideosByKey[$key] = [
                'product_id' => $pid !== '' ? $pid : ($mainProductId ?: 'UNMAPPED_PRODUCT'),
                'video_id' => $vid,
                'is_unattributed' => false,
                'campaign_id' => '',
                'campaign_count' => 0,
                'delivery_status' => 'ORGANIC_AFFILIATE',
                'ad_spend' => 0.0,
                'ads_gross_revenue' => 0.0,
                'ads_orders' => 0,
                'produced_date' => $firstDate,
                'first_stat_date' => $aff['first_order_date'] ?? null,
                'latest_stat_date' => $aff['last_order_date'] ?? null,
                'active_days' => (int)($aff['active_days'] ?? 1),
                'va' => $va,
                'aff' => $aff,
                'source_tags' => ['AFFILIATE_KOC'],
            ];
            if ($va) $unifiedVideosByKey[$key]['source_tags'][] = 'SHOP_VIDEO';
        }

        // 5C. From commerce_video_analytics (Shop short videos not yet in unifiedVideosByKey)
        foreach ($videoAnalyticsMap as $vid => $va) {
            // Check if already attached to any product
            $alreadyAttached = false;
            foreach ($unifiedVideosByKey as $uItem) {
                if ($uItem['video_id'] === (string)$vid) {
                    $alreadyAttached = true;
                    break;
                }
            }
            if ($alreadyAttached) {
                continue;
            }

            // Infer product_id from hint or title keyword or main product
            $pid = $videoToProductHint[$vid] ?? $this->inferProductIdFromTitle((string)($va['title'] ?? ''), $productsCatalogMap, $mainProductId);
            $key = $pid . '::' . $vid;
            $aff = $affiliateByVideoProduct[$key] ?? ($affiliateByVideoOnly[$vid] ?? null);

            $unifiedVideosByKey[$key] = [
                'product_id' => $pid,
                'video_id' => (string)$vid,
                'is_unattributed' => false,
                'campaign_id' => '',
                'campaign_count' => 0,
                'delivery_status' => ((float)($va['period_gross_revenue'] ?? 0) > 0 || (int)($va['period_views'] ?? 0) > 0) ? 'DELIVERING' : 'ORGANIC_VIDEO',
                'ad_spend' => 0.0,
                'ads_gross_revenue' => 0.0,
                'ads_orders' => 0,
                'produced_date' => $va['produced_date'] ?? $va['first_stat_date'],
                'first_stat_date' => $va['first_stat_date'] ?? null,
                'latest_stat_date' => $va['latest_stat_date'] ?? null,
                'active_days' => (int)($va['active_days'] ?? 1),
                'va' => $va,
                'aff' => $aff,
                'source_tags' => ['SHOP_VIDEO'],
            ];
            if ($aff) $unifiedVideosByKey[$key]['source_tags'][] = 'AFFILIATE_KOC';
        }

        // 5D. Fallback: If commerce_ads_creative_daily, commerce_affiliate_orders, and commerce_video_analytics
        // had 0 videos for a sold product that ran Product GMV Max ads, synthesize a campaign/product video entry
        // so the user still sees real Product GMV Max spend, orders, cancel/refund & ROI per product!
        if (empty($unifiedVideosByKey)) {
            $fallbackItems = $this->buildProductCampaignFallbackItems($shopId, $startDate, $endDate, $productsCatalogMap, $mainProductId);
            foreach ($fallbackItems as $fbKey => $fbVal) {
                $unifiedVideosByKey[$fbKey] = $fbVal;
            }
        }

        // 6. Enrich & Evaluate every video (KEEP / TEST / DROP) and group by Product Code
        $productsBuckets = [];
        foreach ($productsCatalogMap as $pid => $pInfo) {
            $productsBuckets[$pid] = $this->initProductBucket($pInfo);
        }

        $allEvaluatedVideos = [];
        $keepCount = 0;
        $testCount = 0;
        $dropCount = 0;

        foreach ($unifiedVideosByKey as $u) {
            $pid = (string)$u['product_id'];
            if (!isset($productsBuckets[$pid])) {
                $productsBuckets[$pid] = $this->initProductBucket([
                    'product_id' => $pid,
                    'product_name' => $pid === 'UNMAPPED_PRODUCT' ? 'Sản phẩm chưa gắn mã định danh' : ('Sản phẩm ' . $pid),
                    'product_image' => null,
                    'is_main_sku' => false,
                    'shop_orders' => 0,
                    'cancelled_orders' => 0,
                    'refunded_orders' => 0,
                    'shop_gross_revenue' => 0.0,
                    'shop_cancel_refund_loss' => 0.0,
                    'shop_realized_revenue' => 0.0,
                    'cancel_rate' => $shopCancelRate,
                    'refund_rate' => $shopRefundRate,
                    'loss_rate' => $shopLossRate,
                ]);
            }

            $pBucket = &$productsBuckets[$pid];
            $evaluated = $this->evaluateSingleVideo($u, $pBucket, $targetRoi, $shopCancelRate, $shopRefundRate, $shopLossRate);

            if ($evaluated['decision_code'] === 'KEEP') $keepCount++;
            elseif ($evaluated['decision_code'] === 'DROP') $dropCount++;
            else $testCount++;

            $allEvaluatedVideos[] = $evaluated;
            $this->accumulateProductBucket($pBucket, $evaluated, $startDate, $endDate);
            unset($pBucket);
        }

        // Sort videos inside each product by realized_revenue DESC, ad_spend DESC
        $finalProducts = [];
        $totalAdSpendAll = 0.0;
        $totalCommissionAll = 0.0;
        $totalGrossRevAll = 0.0;
        $totalRealizedRevAll = 0.0;
        $totalOrdersAll = 0;
        $totalCancelledAll = 0;
        $totalRefundedAll = 0;

        foreach ($productsBuckets as $pid => $bucket) {
            if (empty($bucket['videos']) && $bucket['shop_orders'] <= 0 && $bucket['total_ad_spend'] <= 0) {
                continue;
            }
            usort($bucket['videos'], function (array $a, array $b): int {
                $cmp = ($b['realized_revenue'] <=> $a['realized_revenue']);
                if ($cmp !== 0) return $cmp;
                return ($b['ad_spend'] <=> $a['ad_spend']);
            });

            $bucketTotalCost = $bucket['total_ad_spend'] + $bucket['total_commission'];
            $bucket['total_marketing_cost'] = round($bucketTotalCost, 0);
            $bucket['gross_roi'] = $bucket['total_ad_spend'] > 0
                ? round($bucket['total_gross_revenue'] / $bucket['total_ad_spend'], 2)
                : null;
            $bucket['net_roi'] = $bucketTotalCost > 0
                ? round($bucket['total_realized_revenue'] / $bucketTotalCost, 2)
                : ($bucket['total_ad_spend'] > 0 ? round($bucket['total_realized_revenue'] / $bucket['total_ad_spend'], 2) : null);

            $bucket['cancel_refund_rate_pct'] = $bucket['total_orders'] > 0
                ? round((($bucket['cancelled_orders'] + $bucket['refunded_orders']) / $bucket['total_orders']) * 100, 1)
                : round($bucket['loss_rate'] * 100, 1);

            $totalAdSpendAll += $bucket['total_ad_spend'];
            $totalCommissionAll += $bucket['total_commission'];
            $totalGrossRevAll += $bucket['total_gross_revenue'];
            $totalRealizedRevAll += $bucket['total_realized_revenue'];
            $totalOrdersAll += $bucket['total_orders'];
            $totalCancelledAll += $bucket['cancelled_orders'];
            $totalRefundedAll += $bucket['refunded_orders'];

            $finalProducts[] = $bucket;
        }

        // Sort products: Main SKU first, then by total_realized_revenue DESC, shop_realized_revenue DESC
        usort($finalProducts, function (array $a, array $b): int {
            if ($a['is_main_sku'] !== $b['is_main_sku']) {
                return $a['is_main_sku'] ? -1 : 1;
            }
            $cmp = ($b['total_realized_revenue'] <=> $a['total_realized_revenue']);
            if ($cmp !== 0) return $cmp;
            return ($b['shop_realized_revenue'] <=> $a['shop_realized_revenue']);
        });

        // 7. Build Daily New Video Production Quota Report (10–15 videos/day by Product Code)
        $dailyProductionReport = $this->buildDailyVideoProductionReport(
            $shopId,
            $startDate,
            $endDate,
            $allEvaluatedVideos,
            $finalProducts,
            $config
        );

        $totalMarketingCostAll = $totalAdSpendAll + $totalCommissionAll;
        $overallGrossRoi = $totalAdSpendAll > 0 ? round($totalGrossRevAll / $totalAdSpendAll, 2) : null;
        $overallNetRoi = $totalMarketingCostAll > 0 ? round($totalRealizedRevAll / $totalMarketingCostAll, 2) : null;

        return [
            'status' => 'AVAILABLE',
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'expected_days' => $expectedDays,
            ],
            'config' => $config,
            'summary' => [
                'products_count' => count($finalProducts),
                'total_videos_count' => count($allEvaluatedVideos),
                'keep_videos_count' => $keepCount,
                'test_videos_count' => $testCount,
                'drop_videos_count' => $dropCount,
                'total_ad_spend' => round($totalAdSpendAll, 0),
                'total_commission' => round($totalCommissionAll, 0),
                'total_marketing_cost' => round($totalMarketingCostAll, 0),
                'total_gross_revenue' => round($totalGrossRevAll, 0),
                'total_cancel_refund_loss' => max(0.0, round($totalGrossRevAll - $totalRealizedRevAll, 0)),
                'total_realized_revenue' => round($totalRealizedRevAll, 0),
                'total_orders' => $totalOrdersAll,
                'total_cancelled_orders' => $totalCancelledAll,
                'total_refunded_orders' => $totalRefundedAll,
                'cancel_refund_rate_pct' => $totalOrdersAll > 0
                    ? round((($totalCancelledAll + $totalRefundedAll) / $totalOrdersAll) * 100, 1)
                    : round($shopLossRate * 100, 1),
                'gross_roi' => $overallGrossRoi,
                'net_roi' => $overallNetRoi,
                'target_roi' => $targetRoi,
            ],
            'daily_production' => $dailyProductionReport,
            'products' => $finalProducts,
        ];
    }

    /**
     * Evaluates a single video (Ads / KOC / Shop) and assigns KEEP / TEST / DROP recommendation.
     */
    private function evaluateSingleVideo(
        array $u,
        array $pBucket,
        float $targetRoi,
        float $shopCancelRate,
        float $shopRefundRate,
        float $shopLossRate
    ): array {
        $vid = (string)$u['video_id'];
        $pid = (string)$u['product_id'];
        $va = $u['va'];
        $aff = $u['aff'];

        $adSpend = (float)($u['ad_spend'] ?? 0.0);
        $adsGross = (float)($u['ads_gross_revenue'] ?? 0.0);
        $adsOrders = (int)($u['ads_orders'] ?? 0);

        $affGross = $aff ? (float)($aff['gross_revenue'] ?? 0.0) : 0.0;
        $affOrders = $aff ? (int)($aff['orders_count'] ?? 0) : 0;
        $affCancelled = $aff ? (int)($aff['cancelled_orders'] ?? 0) : null;
        $affRefunded = $aff ? (int)($aff['refunded_orders'] ?? 0) : null;
        $estComm = $aff ? (float)($aff['estimated_commission'] ?? 0.0) : 0.0;
        $settledComm = $aff ? (float)($aff['settled_commission'] ?? 0.0) : 0.0;
        $commission = $settledComm > 0 ? $settledComm : $estComm;

        $vaGross = $va ? (float)($va['period_gross_revenue'] ?? $va['gross_revenue'] ?? 0.0) : 0.0;
        $vaOrders = $va ? (int)($va['period_orders'] ?? $va['orders'] ?? 0) : 0;
        $views = $va ? (int)($va['period_views'] ?? $va['views'] ?? 0) : null;
        $ctrPct = $va && isset($va['ctr_pct']) ? (float)$va['ctr_pct'] : null;
        $gpm = $va && isset($va['gpm']) ? (float)$va['gpm'] : null;

        // Effective Gross Revenue & Orders of this video (avoid double-counting when same video appears in Ads & VA)
        $grossRevenue = max($adsGross, $affGross, $vaGross);
        $ordersCount = max($adsOrders, $affOrders, $vaOrders);

        // Determine Cancelled & Refunded Orders + Loss Amount
        $pCancelRate = $pBucket['cancel_rate'] ?? $shopCancelRate;
        $pRefundRate = $pBucket['refund_rate'] ?? $shopRefundRate;
        $pLossRate = $pBucket['loss_rate'] ?? $shopLossRate;

        if ($affCancelled !== null && $affOrders > 0 && $ordersCount === $affOrders) {
            $cancelledOrders = $affCancelled;
            $refundedOrders = $affRefunded ?? (int)round($ordersCount * $pRefundRate);
        } else {
            $cancelledOrders = $ordersCount > 0 ? (int)round($ordersCount * $pCancelRate) : 0;
            $refundedOrders = $ordersCount > 0 ? (int)round($ordersCount * $pRefundRate) : 0;
        }
        $totalLostOrders = min($ordersCount, $cancelledOrders + $refundedOrders);
        $realizedOrders = max(0, $ordersCount - $totalLostOrders);

        $lossRateForVideo = $ordersCount > 0
            ? max($pLossRate, min(1.0, $totalLostOrders / $ordersCount))
            : $pLossRate;
        $cancelRefundAmount = round($grossRevenue * $lossRateForVideo, 0);
        $realizedRevenue = max(0.0, round($grossRevenue - $cancelRefundAmount, 0));
        $cancelRefundRatePct = round($lossRateForVideo * 100, 1);

        $totalMarketingCost = round($adSpend + $commission, 0);
        $grossRoi = $adSpend > 0 ? round($grossRevenue / $adSpend, 2) : null;
        $netRoi = $totalMarketingCost > 0
            ? round($realizedRevenue / $totalMarketingCost, 2)
            : ($adSpend > 0 ? round($realizedRevenue / $adSpend, 2) : null);
        $cpa = $ordersCount > 0 && $totalMarketingCost > 0 ? round($totalMarketingCost / $ordersCount, 0) : null;

        $clicks = ($views !== null && $views > 0 && $ctrPct !== null && $ctrPct > 0)
            ? (int)round($views * ($ctrPct / 100.0))
            : null;
        $cvrPct = ($clicks !== null && $clicks > 0 && $ordersCount > 0)
            ? round(($ordersCount / $clicks) * 100.0, 2)
            : null;
        if ($gpm === null && $views !== null && $views > 0 && $grossRevenue > 0) {
            $gpm = round(($grossRevenue / $views) * 1000.0, 0);
        }

        // Creator / KOC / KOL identity
        $creatorUsername = '';
        $creatorNickname = '';
        $creatorType = 'ADS_CREATIVE';
        $creatorBadge = 'Video chạy Quảng cáo';

        if ($aff && !empty($aff['creator_username'])) {
            $creatorUsername = (string)$aff['creator_username'];
            $creatorNickname = (string)($aff['creator_nickname'] ?: $aff['creator_username']);
            $creatorType = 'AFFILIATE';
            $creatorBadge = 'KOC / KOL Liên kết';
        } elseif ($va && !empty($va['creator_name'])) {
            $creatorUsername = (string)$va['creator_name'];
            $creatorNickname = (string)$va['creator_name'];
            $rawCtype = strtoupper((string)($va['creator_type'] ?? 'OFFICIAL'));
            if ($rawCtype === 'AFFILIATE' || $rawCtype === 'CREATOR') {
                $creatorType = 'AFFILIATE';
                $creatorBadge = 'KOC / KOL Liên kết';
            } elseif ($rawCtype === 'MARKETING') {
                $creatorType = 'MARKETING';
                $creatorBadge = 'Kênh Marketing';
            } else {
                $creatorType = 'OFFICIAL';
                $creatorBadge = 'Kênh chính thức Shop';
            }
        }

        if ($creatorUsername !== '' && $creatorUsername[0] !== '@' && stripos($creatorUsername, 'TikTok') === false) {
            $creatorUsername = '@' . ltrim($creatorUsername, '@');
        }

        $videoTitle = '';
        if ($va && !empty($va['title'])) {
            $videoTitle = (string)$va['title'];
        } elseif ($aff && !empty($aff['creator_username'])) {
            $videoTitle = 'Video KOC ' . $creatorUsername . ' — ' . $pBucket['product_name'];
        } elseif ($vid === '-1') {
            $videoTitle = 'Nhóm lưu lượng chưa tách mã Video (-1) — ' . $pBucket['product_name'];
        } else {
            $videoTitle = 'Video #' . $vid . ' — ' . $pBucket['product_name'];
        }

        $thumbnailUrl = ($va && !empty($va['cover_url'])) ? (string)$va['cover_url'] : ($pBucket['product_image'] ?? null);
        $videoUrl = ($va && !empty($va['video_url']))
            ? (string)$va['video_url']
            : (($vid !== '' && $vid !== '-1' && strpos($vid, 'CAMP-') === false && strpos($vid, 'SPU-') === false)
                ? ('https://www.tiktok.com/' . ($creatorUsername !== '' ? $creatorUsername : '@tiktok') . '/video/' . $vid)
                : null);

        // Automated KOC / KOL / Ads Video Decision: KEEP vs TEST vs DROP
        $decisionCode = 'TEST';
        $decisionLabel = 'THEO DÕI THÊM';
        $decisionReason = '';
        $actionRecommendation = '';

        $deliveryStatus = (string)($u['delivery_status'] ?? 'DELIVERING');

        if ($adSpend >= 50000 && $ordersCount === 0) {
            $decisionCode = 'DROP';
            $decisionLabel = 'NÊN LOẠI TRỪ';
            $decisionReason = 'Đã tiêu ' . number_format($adSpend, 0, ',', '.') . ' ₫ tiền quảng cáo nhưng 0 đơn hàng (đốt tiền không ra đơn).';
            $actionRecommendation = 'Tắt quảng cáo video này ngay để cắt lỗ ngân sách; yêu cầu KOC/đội nội dung sửa lại 3 giây mở đầu.';
        } elseif ($ordersCount >= 3 && $cancelRefundRatePct >= 30.0) {
            $decisionCode = 'DROP';
            $decisionLabel = 'NÊN LOẠI TRỪ';
            $decisionReason = "Tỷ lệ đơn hủy & hoàn quá cao ({$cancelRefundRatePct}% — {$cancelledOrders} hủy, {$refundedOrders} hoàn / {$ordersCount} đơn).";
            $actionRecommendation = 'Loại trừ khỏi chiến dịch đẩy ngân sách; kiểm tra xem video KOC có nói quá công dụng hoặc lệch giá với giỏ hàng không.';
        } elseif ($adSpend >= 100000 && $netRoi !== null && $netRoi < ($targetRoi * 0.5)) {
            $decisionCode = 'DROP';
            $decisionLabel = 'NÊN LOẠI TRỪ';
            $decisionReason = "Thu/chi thực chỉ đạt {$netRoi} lần (thấp hơn 50% mục tiêu {$targetRoi} lần) sau khi chi " . number_format($totalMarketingCost, 0, ',', '.') . " ₫.";
            $actionRecommendation = 'Nên loại trừ khỏi nhóm chạy quảng cáo chính vì chi phí quảng cáo + hoa hồng đang ăn mòn lợi nhuận.';
        } elseif ($netRoi !== null && $netRoi >= $targetRoi && $realizedOrders >= 1) {
            $decisionCode = 'KEEP';
            $decisionLabel = 'NÊN GIỮ & ĐẨY MẠNH';
            $decisionReason = "Đạt chuẩn mục tiêu: Thu/chi thực đạt {$netRoi} lần (mục tiêu {$targetRoi} lần), mang về {$realizedOrders} đơn thực nhận (" . number_format($realizedRevenue, 0, ',', '.') . " ₫).";
            $actionRecommendation = 'Giữ lại làm video chủ lực: Tăng ngân sách 15–20%/ngày, xin gia hạn mã quảng cáo từ KOC và nhân bản thêm 3–5 video cùng kịch bản.';
        } elseif ($adSpend <= 0 && $realizedOrders >= 2 && $cancelRefundRatePct < 25.0) {
            $decisionCode = 'KEEP';
            $decisionLabel = 'NÊN GIỮ & CẤP NGÂN SÁCH';
            $decisionReason = "Video KOC/Tự nhiên ra {$realizedOrders} đơn thực nhận (" . number_format($realizedRevenue, 0, ',', '.') . " ₫) mà chưa tốn tiền quảng cáo.";
            $actionRecommendation = 'Video có chuyển đổi tự nhiên rất tốt! Nên lấy mã ủy quyền quảng cáo (Spark Ads) từ KOC để đưa vào chiến dịch GMV Max.';
        } elseif ($netRoi !== null && $netRoi >= ($targetRoi * 0.75) && $realizedOrders >= 5 && $cancelRefundRatePct < 20.0) {
            $decisionCode = 'KEEP';
            $decisionLabel = 'NÊN GIỮ & TỐI ƯU';
            $decisionReason = "Sức mua tốt ({$realizedOrders} đơn thực nhận, thu/chi thực {$netRoi} lần, tiệm cận mốc {$targetRoi} lần).";
            $actionRecommendation = 'Giữ lại trong chiến dịch, kết hợp ghim gói Combo 2–3 hộp lên đầu giỏ hàng để kéo thu/chi vượt mốc ' . $targetRoi . ' lần.';
        } elseif ($deliveryStatus === 'AUTHORIZATION_NEEDED') {
            $decisionCode = 'TEST';
            $decisionLabel = 'CẦN GIA HẠN MÃ KOC';
            $decisionReason = 'Video đang bị tạm ngừng phân phối do hết hạn mã ủy quyền quảng cáo (Spark Ads) từ tài khoản KOC.';
            $actionRecommendation = 'Liên hệ KOC/KOL xin cấp lại mã ủy quyền video để mở khóa phân phối.';
        } elseif ($adSpend <= 0 && $ordersCount === 0) {
            $decisionCode = 'TEST';
            $decisionLabel = 'CHƯA RA ĐƠN / MỚI ĐĂNG';
            $decisionReason = 'Video ghi nhận ' . number_format((int)$views, 0, ',', '.') . ' lượt xem nhưng chưa phát sinh đơn hàng và chi phí quảng cáo.';
            $actionRecommendation = 'Theo dõi thêm 48 giờ; nếu lượt xem < 500 và tỷ lệ bấm giỏ hàng < 1% thì không đưa vào chạy quảng cáo.';
        } else {
            $decisionCode = 'TEST';
            $decisionLabel = 'THEO DÕI THÊM';
            $roiText = $netRoi !== null ? "{$netRoi} lần" : 'chưa xác định';
            $decisionReason = "Video đã có {$ordersCount} đơn (thu/chi thực {$roiText} / mục tiêu {$targetRoi} lần).";
            $actionRecommendation = 'Theo dõi thêm 24–48 giờ; tối ưu lại giá/mã giảm giá trên giỏ hàng trước khi quyết định giữ hay loại trừ.';
        }

        return [
            'video_id' => $vid,
            'product_id' => $pid,
            'product_name' => $pBucket['product_name'],
            'video_title' => $videoTitle,
            'thumbnail_url' => $thumbnailUrl,
            'video_url' => $videoUrl,
            'produced_date' => $u['produced_date'],
            'first_stat_date' => $u['first_stat_date'],
            'latest_stat_date' => $u['latest_stat_date'],
            'active_days' => $u['active_days'],
            'delivery_status' => $deliveryStatus,
            'creator_username' => $creatorUsername ?: 'Kênh Shop / Ads',
            'creator_nickname' => $creatorNickname ?: 'Kênh Shop / Ads',
            'creator_type' => $creatorType,
            'creator_badge' => $creatorBadge,
            'source_tags' => array_values(array_unique($u['source_tags'])),
            'gross_revenue' => round($grossRevenue, 0),
            'cancel_refund_amount' => $cancelRefundAmount,
            'realized_revenue' => $realizedRevenue,
            'ad_spend' => round($adSpend, 0),
            'estimated_commission' => round($estComm, 0),
            'settled_commission' => round($settledComm, 0),
            'commission_amount' => round($commission, 0),
            'total_marketing_cost' => $totalMarketingCost,
            'orders_count' => $ordersCount,
            'cancelled_orders' => $cancelledOrders,
            'refunded_orders' => $refundedOrders,
            'realized_orders' => $realizedOrders,
            'cancel_refund_rate_pct' => $cancelRefundRatePct,
            'video_views' => $views,
            'clicks' => $clicks,
            'ctr_pct' => $ctrPct !== null ? round($ctrPct, 2) : null,
            'cvr_pct' => $cvrPct,
            'gpm' => $gpm,
            'cpa' => $cpa,
            'gross_roi' => $grossRoi,
            'net_roi' => $netRoi,
            'target_roi' => $targetRoi,
            'decision_code' => $decisionCode,
            'decision_label' => $decisionLabel,
            'decision_reason' => $decisionReason,
            'action_recommendation' => $actionRecommendation,
        ];
    }

    /**
     * Builds the Daily New Video Production Quota report (10–15 new videos/day target)
     * broken down by Date and by Product Code.
     */
    private function buildDailyVideoProductionReport(
        string $shopId,
        string $startDate,
        string $endDate,
        array $allEvaluatedVideos,
        array $finalProducts,
        array $config
    ): array {
        $minTarget = (int)$config['min_new_videos_per_day']; // 10
        $maxTarget = (int)$config['max_new_videos_per_day']; // 15

        // Build product name lookup
        $prodNameMap = [];
        foreach ($finalProducts as $fp) {
            $prodNameMap[(string)$fp['product_id']] = (string)$fp['product_name'];
        }

        // Also query ALL historical video first-seen dates in the selected period so even videos with 0 spend in period are counted on the day they were published
        $videoPublishedByDateProduct = [];
        $seenVideoIdsGlobal = [];

        foreach ($allEvaluatedVideos as $ev) {
            $vid = (string)$ev['video_id'];
            if ($vid === '' || $vid === '-1' || strpos($vid, 'CAMP-') === 0 || strpos($vid, 'SPU-') === 0) {
                continue;
            }
            $pDate = !empty($ev['produced_date']) ? substr((string)$ev['produced_date'], 0, 10) : null;
            if (!$pDate || $pDate < $startDate || $pDate > $endDate) {
                continue;
            }
            if (isset($seenVideoIdsGlobal[$vid])) {
                continue;
            }
            $seenVideoIdsGlobal[$vid] = true;

            $pid = (string)$ev['product_id'];
            $isKoc = ($ev['creator_type'] === 'AFFILIATE');
            if (!isset($videoPublishedByDateProduct[$pDate])) {
                $videoPublishedByDateProduct[$pDate] = [
                    'total' => 0,
                    'koc_count' => 0,
                    'shop_count' => 0,
                    'by_product' => []
                ];
            }
            $videoPublishedByDateProduct[$pDate]['total']++;
            if ($isKoc) {
                $videoPublishedByDateProduct[$pDate]['koc_count']++;
            } else {
                $videoPublishedByDateProduct[$pDate]['shop_count']++;
            }
            if (!isset($videoPublishedByDateProduct[$pDate]['by_product'][$pid])) {
                $videoPublishedByDateProduct[$pDate]['by_product'][$pid] = [
                    'product_id' => $pid,
                    'product_name' => $prodNameMap[$pid] ?? ('Sản phẩm ' . $pid),
                    'new_videos_count' => 0,
                    'koc_videos_count' => 0,
                    'shop_videos_count' => 0,
                ];
            }
            $videoPublishedByDateProduct[$pDate]['by_product'][$pid]['new_videos_count']++;
            if ($isKoc) {
                $videoPublishedByDateProduct[$pDate]['by_product'][$pid]['koc_videos_count']++;
            } else {
                $videoPublishedByDateProduct[$pDate]['by_product'][$pid]['shop_videos_count']++;
            }
        }

        // Generate full calendar days from endDate down to startDate
        $dailyRows = [];
        $totalNewVideosInPeriod = 0;
        $daysAchievedCount = 0;
        $totalDaysCount = 0;
        $productNewVideosTotals = [];

        try {
            $cur = new DateTime($endDate);
            $startDt = new DateTime($startDate);
            while ($cur >= $startDt) {
                $dStr = $cur->format('Y-m-d');
                $totalDaysCount++;
                $dayBucket = $videoPublishedByDateProduct[$dStr] ?? [
                    'total' => 0,
                    'koc_count' => 0,
                    'shop_count' => 0,
                    'by_product' => []
                ];

                $cnt = (int)$dayBucket['total'];
                $totalNewVideosInPeriod += $cnt;

                if ($cnt >= $minTarget) {
                    $daysAchievedCount++;
                }

                $statusCode = 'ZERO';
                $statusLabel = "0 video mới (Thiếu {$minTarget}–{$maxTarget} video)";
                if ($cnt >= $maxTarget) {
                    $statusCode = 'OPTIMAL';
                    $statusLabel = "Vượt chuẩn ({$cnt} video / mục tiêu {$minTarget}–{$maxTarget})";
                } elseif ($cnt >= $minTarget) {
                    $statusCode = 'ACHIEVED';
                    $statusLabel = "Đạt mục tiêu ({$cnt} video / chuẩn {$minTarget}–{$maxTarget})";
                } elseif ($cnt > 0) {
                    $missing = $minTarget - $cnt;
                    $statusCode = 'BELOW_TARGET';
                    $statusLabel = "Chưa đạt ({$cnt}/{$minTarget} video — thiếu {$missing} video)";
                }

                foreach ($dayBucket['by_product'] as $pid => $pb) {
                    if (!isset($productNewVideosTotals[$pid])) {
                        $productNewVideosTotals[$pid] = [
                            'product_id' => $pid,
                            'product_name' => $pb['product_name'],
                            'total_new_videos' => 0,
                            'koc_new_videos' => 0,
                            'shop_new_videos' => 0,
                        ];
                    }
                    $productNewVideosTotals[$pid]['total_new_videos'] += $pb['new_videos_count'];
                    $productNewVideosTotals[$pid]['koc_new_videos'] += $pb['koc_videos_count'];
                    $productNewVideosTotals[$pid]['shop_new_videos'] += $pb['shop_videos_count'];
                }

                $dailyRows[] = [
                    'date' => $dStr,
                    'total_new_videos' => $cnt,
                    'koc_new_videos' => (int)$dayBucket['koc_count'],
                    'shop_new_videos' => (int)$dayBucket['shop_count'],
                    'target_min' => $minTarget,
                    'target_max' => $maxTarget,
                    'achievement_pct' => round(($cnt / max(1, $minTarget)) * 100, 1),
                    'status_code' => $statusCode,
                    'status_label' => $statusLabel,
                    'products_breakdown' => array_values($dayBucket['by_product']),
                ];

                $cur->modify('-1 day');
            }
        } catch (\Throwable $t) {}

        $avgPerDay = $totalDaysCount > 0 ? round($totalNewVideosInPeriod / $totalDaysCount, 1) : 0.0;
        $periodTargetMin = $totalDaysCount * $minTarget;
        $periodTargetMax = $totalDaysCount * $maxTarget;

        return [
            'target_min_per_day' => $minTarget,
            'target_max_per_day' => $maxTarget,
            'total_days' => $totalDaysCount,
            'days_achieved_count' => $daysAchievedCount,
            'total_new_videos_in_period' => $totalNewVideosInPeriod,
            'avg_new_videos_per_day' => $avgPerDay,
            'period_target_min' => $periodTargetMin,
            'period_target_max' => $periodTargetMax,
            'is_period_achieved' => $avgPerDay >= $minTarget,
            'overall_assessment' => $avgPerDay >= $minTarget
                ? "Đạt chuẩn sản xuất video mới: Trung bình {$avgPerDay} video/ngày (Mục tiêu {$minTarget}–{$maxTarget} video/ngày)."
                : "Chưa đạt chỉ tiêu số lượng video mới: Trung bình chỉ đạt {$avgPerDay} video/ngày (Mục tiêu {$minTarget}–{$maxTarget} video/ngày; cần bổ sung thêm " . max(1, (int)ceil($minTarget - $avgPerDay)) . " video/ngày).",
            'by_product_totals' => array_values($productNewVideosTotals),
            'daily_rows' => $dailyRows,
        ];
    }

    private function initProductBucket(array $pInfo): array {
        return [
            'product_id' => (string)$pInfo['product_id'],
            'product_name' => (string)$pInfo['product_name'],
            'product_image' => $pInfo['product_image'] ?? null,
            'is_main_sku' => !empty($pInfo['is_main_sku']),
            'sku_role_label' => !empty($pInfo['is_main_sku']) ? 'Sản phẩm chủ lực (Mục tiêu 80%)' : 'Sản phẩm phụ (Mục tiêu 20%)',
            'shop_orders' => (int)($pInfo['shop_orders'] ?? 0),
            'shop_cancelled_orders' => (int)($pInfo['cancelled_orders'] ?? 0),
            'shop_refunded_orders' => (int)($pInfo['refunded_orders'] ?? 0),
            'shop_gross_revenue' => round((float)($pInfo['shop_gross_revenue'] ?? 0.0), 0),
            'shop_cancel_refund_loss' => round((float)($pInfo['shop_cancel_refund_loss'] ?? 0.0), 0),
            'shop_realized_revenue' => round((float)($pInfo['shop_realized_revenue'] ?? 0.0), 0),
            'cancel_rate' => (float)($pInfo['cancel_rate'] ?? 0.0),
            'refund_rate' => (float)($pInfo['refund_rate'] ?? 0.0),
            'loss_rate' => (float)($pInfo['loss_rate'] ?? 0.0),
            'videos_count' => 0,
            'new_videos_in_period' => 0,
            'keep_videos_count' => 0,
            'test_videos_count' => 0,
            'drop_videos_count' => 0,
            'koc_videos_count' => 0,
            'total_ad_spend' => 0.0,
            'total_commission' => 0.0,
            'total_marketing_cost' => 0.0,
            'total_gross_revenue' => 0.0,
            'total_cancel_refund_loss' => 0.0,
            'total_realized_revenue' => 0.0,
            'total_orders' => 0,
            'cancelled_orders' => 0,
            'refunded_orders' => 0,
            'realized_orders' => 0,
            'total_views' => 0,
            'gross_roi' => null,
            'net_roi' => null,
            'videos' => [],
        ];
    }

    private function accumulateProductBucket(array &$bucket, array $video, string $startDate, string $endDate): void {
        $bucket['videos'][] = $video;
        $bucket['videos_count']++;

        $pDate = !empty($video['produced_date']) ? substr((string)$video['produced_date'], 0, 10) : null;
        if ($pDate && $pDate >= $startDate && $pDate <= $endDate) {
            $bucket['new_videos_in_period']++;
        }

        if ($video['decision_code'] === 'KEEP') $bucket['keep_videos_count']++;
        elseif ($video['decision_code'] === 'DROP') $bucket['drop_videos_count']++;
        else $bucket['test_videos_count']++;

        if ($video['creator_type'] === 'AFFILIATE') {
            $bucket['koc_videos_count']++;
        }

        $bucket['total_ad_spend'] += (float)$video['ad_spend'];
        $bucket['total_commission'] += (float)$video['commission_amount'];
        $bucket['total_gross_revenue'] += (float)$video['gross_revenue'];
        $bucket['total_cancel_refund_loss'] += (float)$video['cancel_refund_amount'];
        $bucket['total_realized_revenue'] += (float)$video['realized_revenue'];
        $bucket['total_orders'] += (int)$video['orders_count'];
        $bucket['cancelled_orders'] += (int)$video['cancelled_orders'];
        $bucket['refunded_orders'] += (int)$video['refunded_orders'];
        $bucket['realized_orders'] += (int)$video['realized_orders'];
        $bucket['total_views'] += (int)($video['video_views'] ?? 0);
    }

    private function fetchShopAndProductOrderStats(
        string $shopId,
        string $startDate,
        string $endDate,
        string $mainSkuKeyword
    ): array {
        $productsMap = [];
        $shopGross = 0.0;
        $shopCancel = 0.0;
        $shopRefund = 0.0;
        $mainProductId = null;

        // 1. Load catalog first
        if ($this->tableExists('commerce_product_catalog')) {
            try {
                $stmtCat = $this->db->prepare("SELECT
                    product_id,
                    MAX(product_name) as product_name,
                    MAX(COALESCE(display_image_url, product_image, sku_image)) as img_url
                    FROM `commerce_product_catalog`
                    WHERE shop_id = ?
                    GROUP BY product_id");
                $stmtCat->execute([$shopId]);
                while ($cr = $stmtCat->fetch(PDO::FETCH_ASSOC)) {
                    $pid = (string)$cr['product_id'];
                    $pName = (string)($cr['product_name'] ?: ('Sản phẩm ' . $pid));
                    $isMain = (mb_stripos($pName, 'sủi', 0, 'UTF-8') !== false || mb_stripos($pName, 'mát gan', 0, 'UTF-8') !== false);
                    if ($isMain && $mainProductId === null) {
                        $mainProductId = $pid;
                    }
                    $productsMap[$pid] = [
                        'product_id' => $pid,
                        'product_name' => $pName,
                        'product_image' => !empty($cr['img_url']) ? (string)$cr['img_url'] : null,
                        'is_main_sku' => $isMain,
                        'shop_orders' => 0,
                        'cancelled_orders' => 0,
                        'refunded_orders' => 0,
                        'shop_gross_revenue' => 0.0,
                        'shop_cancel_refund_loss' => 0.0,
                        'shop_realized_revenue' => 0.0,
                        'cancel_rate' => 0.0,
                        'refund_rate' => 0.0,
                        'loss_rate' => 0.0,
                    ];
                }
            } catch (\Throwable $t) {}
        }

        // 2. Load order items + orders in period
        try {
            $stmtOrd = $this->db->prepare("SELECT
                oi.product_id,
                MAX(oi.product_name) as product_name,
                MAX(oi.sku_image) as sku_image,
                COUNT(DISTINCT o.platform_order_id) as shop_orders,
                COUNT(DISTINCT CASE WHEN o.order_status = 'CANCELLED' THEN o.platform_order_id ELSE NULL END) as cancelled_orders,
                COUNT(DISTINCT CASE WHEN o.order_status IN ('RETURNED','REFUNDED') THEN o.platform_order_id ELSE NULL END) as refunded_orders,
                SUM(oi.sale_price * oi.quantity) as gross_revenue,
                SUM(CASE WHEN o.order_status = 'CANCELLED' THEN (oi.sale_price * oi.quantity) ELSE 0 END) as cancel_gross,
                SUM(CASE WHEN o.order_status IN ('RETURNED','REFUNDED') THEN (oi.sale_price * oi.quantity) ELSE 0 END) as refund_gross
                FROM `commerce_order_items` oi
                INNER JOIN `commerce_orders` o ON oi.order_id = o.id
                WHERE o.shop_id = ? AND o.platform_created_at >= ? AND o.platform_created_at <= ?
                GROUP BY oi.product_id
                ORDER BY gross_revenue DESC");
            $stmtOrd->execute([$shopId, $startDate . ' 00:00:00', $endDate . ' 23:59:59']);
            while ($or = $stmtOrd->fetch(PDO::FETCH_ASSOC)) {
                $pid = (string)$or['product_id'];
                $pName = !empty($or['product_name']) ? (string)$or['product_name'] : ($productsMap[$pid]['product_name'] ?? ('Sản phẩm ' . $pid));
                $pImg = !empty($or['sku_image']) ? (string)$or['sku_image'] : ($productsMap[$pid]['product_image'] ?? null);
                $isMain = (mb_stripos($pName, 'sủi', 0, 'UTF-8') !== false || mb_stripos($pName, 'mát gan', 0, 'UTF-8') !== false);
                if ($isMain && $mainProductId === null) {
                    $mainProductId = $pid;
                }

                $gross = (float)($or['gross_revenue'] ?? 0.0);
                $cancG = (float)($or['cancel_gross'] ?? 0.0);
                $refG = (float)($or['refund_gross'] ?? 0.0);
                $lossG = $cancG + $refG;
                $realizedG = max(0.0, $gross - $lossG);

                $totOrd = (int)($or['shop_orders'] ?? 0);
                $cancOrd = (int)($or['cancelled_orders'] ?? 0);
                $refOrd = (int)($or['refunded_orders'] ?? 0);

                $shopGross += $gross;
                $shopCancel += $cancG;
                $shopRefund += $refG;

                $productsMap[$pid] = [
                    'product_id' => $pid,
                    'product_name' => $pName,
                    'product_image' => $pImg,
                    'is_main_sku' => $isMain,
                    'shop_orders' => $totOrd,
                    'cancelled_orders' => $cancOrd,
                    'refunded_orders' => $refOrd,
                    'shop_gross_revenue' => $gross,
                    'shop_cancel_refund_loss' => $lossG,
                    'shop_realized_revenue' => $realizedG,
                    'cancel_rate' => $totOrd > 0 ? min(1.0, max(0.0, $cancOrd / $totOrd)) : 0.0,
                    'refund_rate' => $totOrd > 0 ? min(1.0, max(0.0, $refOrd / $totOrd)) : 0.0,
                    'loss_rate' => $gross > 0 ? min(1.0, max(0.0, $lossG / $gross)) : 0.0,
                ];
            }
        } catch (\Throwable $t) {}

        $shopCancelRate = $shopGross > 0 ? min(1.0, max(0.0, $shopCancel / $shopGross)) : 0.0;
        $shopRefundRate = $shopGross > 0 ? min(1.0, max(0.0, $shopRefund / $shopGross)) : 0.0;
        $shopLossRate = $shopGross > 0 ? min(1.0, max(0.0, ($shopCancel + $shopRefund) / $shopGross)) : 0.0;

        // Backfill default rates on catalog products with 0 orders in period
        foreach ($productsMap as $pid => &$pm) {
            if ($pm['shop_orders'] <= 0) {
                $pm['cancel_rate'] = $shopCancelRate;
                $pm['refund_rate'] = $shopRefundRate;
                $pm['loss_rate'] = $shopLossRate;
            }
        }
        unset($pm);

        return [
            'products_map' => $productsMap,
            'shop_cancel_rate' => $shopCancelRate,
            'shop_refund_rate' => $shopRefundRate,
            'shop_loss_rate' => $shopLossRate,
            'main_product_id' => $mainProductId,
        ];
    }

    private function fetchVideoAnalyticsMap(string $shopId, string $startDate, string $endDate): array {
        $map = [];
        if ($this->tableExists('commerce_video_analytics')) {
            try {
                // Global metadata + first seen date
                $stmtGlobal = $this->db->prepare("SELECT
                    video_id,
                    MAX(title) as title,
                    MAX(cover_url) as cover_url,
                    MAX(video_url) as video_url,
                    MAX(creator_name) as creator_name,
                    MAX(creator_type) as creator_type,
                    MIN(DATE(video_post_time)) as post_date,
                    MIN(stat_date) as first_stat_date,
                    MAX(stat_date) as latest_stat_date,
                    SUM(video_views) as all_views,
                    SUM(units_sold) as all_orders,
                    SUM(gross_revenue) as all_gross,
                    AVG(ctr) as avg_ctr,
                    AVG(gpm) as avg_gpm
                    FROM `commerce_video_analytics`
                    WHERE shop_id = ?
                    GROUP BY video_id");
                $stmtGlobal->execute([$shopId]);
                while ($r = $stmtGlobal->fetch(PDO::FETCH_ASSOC)) {
                    $vid = (string)$r['video_id'];
                    if ($vid === '') continue;
                    $rawCtr = (float)($r['avg_ctr'] ?? 0.0);
                    $ctrPct = $rawCtr <= 1.0 ? round($rawCtr * 100.0, 2) : round($rawCtr, 2);
                    $map[$vid] = [
                        'video_id' => $vid,
                        'title' => (string)($r['title'] ?? ''),
                        'cover_url' => !empty($r['cover_url']) ? (string)$r['cover_url'] : null,
                        'video_url' => !empty($r['video_url']) ? (string)$r['video_url'] : null,
                        'creator_name' => (string)($r['creator_name'] ?? ''),
                        'creator_type' => (string)($r['creator_type'] ?? 'OFFICIAL'),
                        'produced_date' => !empty($r['post_date']) ? (string)$r['post_date'] : (string)($r['first_stat_date'] ?? ''),
                        'first_stat_date' => (string)($r['first_stat_date'] ?? ''),
                        'latest_stat_date' => (string)($r['latest_stat_date'] ?? ''),
                        'views' => (int)($r['all_views'] ?? 0),
                        'orders' => (int)($r['all_orders'] ?? 0),
                        'gross_revenue' => (float)($r['all_gross'] ?? 0.0),
                        'period_views' => 0,
                        'period_orders' => 0,
                        'period_gross_revenue' => 0.0,
                        'active_days' => 1,
                        'ctr_pct' => $ctrPct,
                        'gpm' => (float)($r['avg_gpm'] ?? 0.0),
                    ];
                }

                // Period-specific metrics
                $stmtPeriod = $this->db->prepare("SELECT
                    video_id,
                    COUNT(DISTINCT stat_date) as active_days,
                    SUM(video_views) as p_views,
                    SUM(units_sold) as p_orders,
                    SUM(gross_revenue) as p_gross
                    FROM `commerce_video_analytics`
                    WHERE shop_id = ? AND stat_date >= ? AND stat_date <= ?
                    GROUP BY video_id");
                $stmtPeriod->execute([$shopId, $startDate, $endDate]);
                while ($pr = $stmtPeriod->fetch(PDO::FETCH_ASSOC)) {
                    $vid = (string)$pr['video_id'];
                    if (isset($map[$vid])) {
                        $map[$vid]['period_views'] = (int)($pr['p_views'] ?? 0);
                        $map[$vid]['period_orders'] = (int)($pr['p_orders'] ?? 0);
                        $map[$vid]['period_gross_revenue'] = (float)($pr['p_gross'] ?? 0.0);
                        $map[$vid]['active_days'] = (int)($pr['active_days'] ?? 1);
                    }
                }
            } catch (\Throwable $t) {}
        }
        return $map;
    }

    private function fetchAffiliateVideoStats(string $shopId, string $startDate, string $endDate): array {
        $byVideoProduct = [];
        $byVideo = [];
        $videoToProductHint = [];

        if (!$this->tableExists('commerce_affiliate_orders')) {
            return [
                'by_video_product' => [],
                'by_video' => [],
                'video_to_product_hint' => [],
            ];
        }

        try {
            // Map video_id -> product_id globally from affiliate orders
            $stmtHint = $this->db->prepare("SELECT content_id, MAX(product_id) as product_id
                FROM `commerce_affiliate_orders`
                WHERE shop_id = ? AND content_id IS NOT NULL AND content_id != '' AND product_id IS NOT NULL AND product_id != ''
                GROUP BY content_id");
            $stmtHint->execute([$shopId]);
            while ($hr = $stmtHint->fetch(PDO::FETCH_ASSOC)) {
                $videoToProductHint[(string)$hr['content_id']] = (string)$hr['product_id'];
            }

            // Query affiliate orders in period (left joined with commerce_orders for exact refund/cancel status)
            $stmt = $this->db->prepare("SELECT
                a.product_id,
                MAX(a.product_name) as product_name,
                COALESCE(NULLIF(a.content_id, ''), CONCAT('KOC-', COALESCE(NULLIF(a.creator_username, ''), a.creator_id, 'UNKNOWN'))) as eff_video_id,
                MAX(a.creator_id) as creator_id,
                MAX(a.creator_username) as creator_username,
                MAX(a.creator_nickname) as creator_nickname,
                MAX(a.creator_type) as creator_type,
                MIN(DATE(a.order_created_at)) as first_order_date,
                MAX(DATE(a.order_created_at)) as last_order_date,
                COUNT(DISTINCT DATE(a.order_created_at)) as active_days,
                COUNT(DISTINCT a.platform_order_id) as orders_count,
                COUNT(DISTINCT CASE WHEN a.order_status = 'CANCELLED' OR o.order_status = 'CANCELLED' THEN a.platform_order_id ELSE NULL END) as cancelled_orders,
                COUNT(DISTINCT CASE WHEN o.order_status IN ('RETURNED','REFUNDED') THEN a.platform_order_id ELSE NULL END) as refunded_orders,
                SUM(a.order_amount) as gross_revenue,
                SUM(a.estimated_commission) as estimated_commission,
                SUM(a.settled_commission) as settled_commission
                FROM `commerce_affiliate_orders` a
                LEFT JOIN `commerce_orders` o ON a.shop_id = o.shop_id AND a.platform_order_id = o.platform_order_id
                WHERE a.shop_id = ?
                  AND a.order_created_at >= ? AND a.order_created_at <= ?
                  AND (a.content_type = 'VIDEO' OR a.content_type IS NULL OR a.content_type = '' OR a.content_type = 'SHOWCASE')
                GROUP BY a.product_id, eff_video_id");
            $stmt->execute([$shopId, $startDate . ' 00:00:00', $endDate . ' 23:59:59']);
            while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $pid = (string)($r['product_id'] ?? '');
                $vid = (string)($r['eff_video_id'] ?? '');
                if ($vid === '') continue;

                $item = [
                    'product_id' => $pid,
                    'video_id' => $vid,
                    'creator_id' => (string)($r['creator_id'] ?? ''),
                    'creator_username' => (string)($r['creator_username'] ?? ''),
                    'creator_nickname' => (string)($r['creator_nickname'] ?? ''),
                    'creator_type' => (string)($r['creator_type'] ?? 'AFFILIATE'),
                    'first_order_date' => $r['first_order_date'],
                    'last_order_date' => $r['last_order_date'],
                    'active_days' => (int)($r['active_days'] ?? 1),
                    'orders_count' => (int)($r['orders_count'] ?? 0),
                    'cancelled_orders' => (int)($r['cancelled_orders'] ?? 0),
                    'refunded_orders' => (int)($r['refunded_orders'] ?? 0),
                    'gross_revenue' => (float)($r['gross_revenue'] ?? 0.0),
                    'estimated_commission' => (float)($r['estimated_commission'] ?? 0.0),
                    'settled_commission' => (float)($r['settled_commission'] ?? 0.0),
                ];

                $key = $pid . '::' . $vid;
                $byVideoProduct[$key] = $item;
                if (!isset($byVideo[$vid])) {
                    $byVideo[$vid] = $item;
                }
            }
        } catch (\Throwable $t) {}

        return [
            'by_video_product' => $byVideoProduct,
            'by_video' => $byVideo,
            'video_to_product_hint' => $videoToProductHint,
        ];
    }

    private function fetchAdsCreativeStats(string $shopId, string $startDate, string $endDate): array {
        $rows = [];
        $firstSeenMap = [];
        $videoToProductHint = [];

        if (!$this->tableExists('commerce_ads_creative_daily')) {
            return [
                'rows' => [],
                'first_seen_map' => [],
                'video_to_product_hint' => [],
            ];
        }

        try {
            // Global first seen date per item_id
            $stmtFirst = $this->db->prepare("SELECT
                item_id,
                MIN(stat_date) as first_seen_date,
                MAX(item_group_id) as item_group_id
                FROM `commerce_ads_creative_daily`
                WHERE (shop_id = ? OR shop_id = '' OR shop_id IS NULL)
                GROUP BY item_id");
            $stmtFirst->execute([$shopId]);
            while ($fr = $stmtFirst->fetch(PDO::FETCH_ASSOC)) {
                $vid = (string)$fr['item_id'];
                $firstSeenMap[$vid] = (string)$fr['first_seen_date'];
                if (!empty($fr['item_group_id']) && (string)$fr['item_group_id'] !== '-1') {
                    $videoToProductHint[$vid] = (string)$fr['item_group_id'];
                }
            }

            // Period stats grouped by item_id, item_group_id
            $stmt = $this->db->prepare("SELECT
                c.item_id,
                c.item_group_id,
                MAX(c.campaign_id) as campaign_id,
                COUNT(DISTINCT c.campaign_id) as campaign_count,
                MAX(c.is_unattributed) as is_unattributed,
                MAX(c.creative_delivery_status_normalized) as norm_status,
                MIN(c.stat_date) as first_stat_date,
                MAX(c.stat_date) as latest_stat_date,
                COUNT(DISTINCT c.stat_date) as active_days,
                SUM(c.cost) as spend,
                SUM(c.ads_gross_revenue) as ads_gross_revenue,
                SUM(c.orders) as ads_orders
                FROM `commerce_ads_creative_daily` c
                WHERE (c.shop_id = ? OR c.shop_id = '' OR c.shop_id IS NULL)
                  AND c.stat_date >= ? AND c.stat_date <= ?
                GROUP BY c.item_id, c.item_group_id
                ORDER BY spend DESC, ads_gross_revenue DESC");
            $stmt->execute([$shopId, $startDate, $endDate]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $t) {}

        return [
            'rows' => $rows,
            'first_seen_map' => $firstSeenMap,
            'video_to_product_hint' => $videoToProductHint,
        ];
    }

    private function inferProductIdFromTitle(string $title, array $productsCatalogMap, ?string $mainProductId): string {
        if ($title !== '') {
            foreach ($productsCatalogMap as $pid => $pInfo) {
                $pName = (string)($pInfo['product_name'] ?? '');
                if ($pName !== '' && mb_stripos($title, $pName, 0, 'UTF-8') !== false) {
                    return (string)$pid;
                }
            }
            if (mb_stripos($title, 'sủi', 0, 'UTF-8') !== false || mb_stripos($title, 'mát gan', 0, 'UTF-8') !== false) {
                if ($mainProductId !== null) {
                    return $mainProductId;
                }
            }
        }
        if ($mainProductId !== null) {
            return $mainProductId;
        }
        $firstKey = array_key_first($productsCatalogMap);
        return $firstKey !== null ? (string)$firstKey : 'UNMAPPED_PRODUCT';
    }

    /**
     * When creative/video tables have not been synced yet, synthesize per-product campaign video items
     * from commerce_ads_product_daily / commerce_ads_campaign_daily so the product-centric report
     * still shows accurate Product GMV Max spend, revenue, orders, cancel/refund & ROI.
     */
    private function buildProductCampaignFallbackItems(
        string $shopId,
        string $startDate,
        string $endDate,
        array $productsCatalogMap,
        ?string $mainProductId
    ): array {
        $items = [];
        // Try commerce_ads_product_daily first
        if ($this->tableExists('commerce_ads_product_daily')) {
            try {
                $stmt = $this->db->prepare("SELECT
                    p.item_group_id,
                    p.campaign_id,
                    MIN(p.stat_date) as first_stat_date,
                    MAX(p.stat_date) as latest_stat_date,
                    COUNT(DISTINCT p.stat_date) as active_days,
                    SUM(p.cost) as spend,
                    SUM(p.ads_gross_revenue) as ads_gross_revenue,
                    SUM(p.orders) as ads_orders
                    FROM `commerce_ads_product_daily` p
                    WHERE (p.shop_id = ? OR p.shop_id = '' OR p.shop_id IS NULL)
                      AND p.stat_date >= ? AND p.stat_date <= ?
                      AND (p.cost > 0 OR p.ads_gross_revenue > 0 OR p.orders > 0)
                    GROUP BY p.item_group_id, p.campaign_id
                    ORDER BY spend DESC");
                $stmt->execute([$shopId, $startDate, $endDate]);
                while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $pid = (string)$r['item_group_id'];
                    $cid = (string)$r['campaign_id'];
                    $vid = 'SPU-CAMP-' . $cid;
                    $key = $pid . '::' . $vid;
                    $items[$key] = [
                        'product_id' => $pid,
                        'video_id' => $vid,
                        'is_unattributed' => false,
                        'campaign_id' => $cid,
                        'campaign_count' => 1,
                        'delivery_status' => (float)$r['spend'] > 0 ? 'DELIVERING' : 'NOT_DELIVERING',
                        'ad_spend' => (float)$r['spend'],
                        'ads_gross_revenue' => (float)$r['ads_gross_revenue'],
                        'ads_orders' => (int)$r['ads_orders'],
                        'produced_date' => $r['first_stat_date'],
                        'first_stat_date' => $r['first_stat_date'],
                        'latest_stat_date' => $r['latest_stat_date'],
                        'active_days' => (int)$r['active_days'],
                        'va' => null,
                        'aff' => null,
                        'source_tags' => ['ADS_GMV_MAX'],
                    ];
                }
            } catch (\Throwable $t) {}
        }

        // If still empty, allocate Product GMV Max campaigns across sold products
        if (empty($items) && $this->tableExists('commerce_ads_campaign_daily')) {
            try {
                $stmt = $this->db->prepare("SELECT
                    d.campaign_id,
                    MAX(d.campaign_name) as campaign_name,
                    MIN(CASE WHEN d.spend > 0 OR d.orders > 0 THEN d.stat_date ELSE NULL END) as first_stat_date,
                    MAX(d.stat_date) as latest_stat_date,
                    COUNT(DISTINCT CASE WHEN d.spend > 0 OR d.orders > 0 THEN d.stat_date ELSE NULL END) as active_days,
                    SUM(d.spend) as spend,
                    SUM(d.gross_revenue) as ads_gross_revenue,
                    SUM(d.orders) as ads_orders
                    FROM `commerce_ads_campaign_daily` d
                    WHERE (d.shop_id = ? OR d.shop_id = '' OR d.shop_id IS NULL)
                      AND d.stat_date >= ? AND d.stat_date <= ?
                      AND (d.promotion_type = 'PRODUCT' OR (d.promotion_type IS NULL AND d.campaign_type NOT LIKE '%LIVE%' AND d.campaign_name NOT LIKE '%LIVE%'))
                      AND (d.spend > 0 OR d.gross_revenue > 0 OR d.orders > 0)
                    GROUP BY d.campaign_id
                    ORDER BY spend DESC");
                $stmt->execute([$shopId, $startDate, $endDate]);
                while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $cid = (string)$r['campaign_id'];
                    $pid = $mainProductId ?? (string)(array_key_first($productsCatalogMap) ?: 'UNMAPPED_PRODUCT');
                    $vid = 'CAMP-' . $cid;
                    $key = $pid . '::' . $vid;
                    $items[$key] = [
                        'product_id' => $pid,
                        'video_id' => $vid,
                        'is_unattributed' => false,
                        'campaign_id' => $cid,
                        'campaign_count' => 1,
                        'delivery_status' => (float)$r['spend'] > 0 ? 'DELIVERING' : 'NOT_DELIVERING',
                        'ad_spend' => (float)$r['spend'],
                        'ads_gross_revenue' => (float)$r['ads_gross_revenue'],
                        'ads_orders' => (int)$r['ads_orders'],
                        'produced_date' => $r['first_stat_date'],
                        'first_stat_date' => $r['first_stat_date'],
                        'latest_stat_date' => $r['latest_stat_date'],
                        'active_days' => (int)$r['active_days'],
                        'va' => [
                            'title' => (string)($r['campaign_name'] ?: ('Chiến dịch Product GMV Max #' . $cid)),
                            'creator_name' => 'TikTok Product GMV Max',
                            'creator_type' => 'MARKETING',
                        ],
                        'aff' => null,
                        'source_tags' => ['ADS_GMV_MAX'],
                    ];
                }
            } catch (\Throwable $t) {}
        }

        return $items;
    }
}

// Direct HTTP Endpoint Handler
if (isset($_SERVER['SCRIPT_FILENAME']) && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    require_once __DIR__ . '/auth_guard.php';
    header('Content-Type: application/json; charset=utf-8');
    if (function_exists('requireAuth')) {
        requireAuth();
    }

    $action = $_GET['action'] ?? $_POST['action'] ?? 'get_video_product_intelligence';
    $shopId = trim((string)($_GET['shop_id'] ?? $_POST['shop_id'] ?? ''));
    $startDate = trim((string)($_GET['start_date'] ?? $_POST['start_date'] ?? date('Y-m-d', strtotime('-7 days'))));
    $endDate = trim((string)($_GET['end_date'] ?? $_POST['end_date'] ?? date('Y-m-d')));
    $targetRoi = isset($_GET['target_roi']) && is_numeric($_GET['target_roi']) ? (float)$_GET['target_roi'] : null;

    if ($shopId === '') {
        echo json_encode(['success' => false, 'message' => 'Thiếu tham số shop_id'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        $service = new CommerceVideoProductService();
        $data = $service->getVideoProductIntelligence($shopId, $startDate, $endDate, [
            'target_roi' => $targetRoi,
        ]);
        echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    } catch (\Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Lỗi báo cáo Video theo Sản phẩm: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    exit;
}
