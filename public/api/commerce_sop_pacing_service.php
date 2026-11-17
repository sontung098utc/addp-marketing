<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SOP PACING, ROI & ALERT CENTER SERVICE
 * Module 1: Configurable ROI & Budget Targets, Real-Time SOP Pacing,
 *           and Red/Yellow/Green Alert Engine.
 * ====================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

class CommerceSopPacingService {
    public const PLATFORM = 'tiktok_shop';

    public const DEFAULT_CONFIG = [
        'target_roi' => 13.0,
        'video_target_roi' => 15.0,
        'live_target_roi' => 13.0,
        'monthly_gmv_target' => 600000000.0,
        'daily_gmv_target' => 20000000.0,
        'video_split_pct' => 75.0,
        'live_split_pct' => 25.0,
        'main_sku_split_pct' => 80.0,
        'sub_sku_split_pct' => 20.0,
        'main_sku_keyword' => 'Viên sủi mát gan',
        'main_sku_product_id' => null,
        'live_sessions_per_day' => 2,
        'red_flag_roi_threshold' => 10.0,
        'red_flag_spend_pct' => 50.0,
        'red_flag_min_clicks' => 50,
        'yellow_flag_hour' => 14,
        'yellow_flag_spend_pct' => 50.0,
        'green_flag_roi_buffer' => 2.0,
        'green_flag_spend_pct' => 80.0,
    ];

    private PDO $db;
    private ?bool $configTableReady = null;
    private array $tableExistsCache = [];

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? getDBConnection();
    }

    /**
     * Checks if a table exists in MySQL/MariaDB or SQLite.
     */
    private function tableExists(string $tableName): bool {
        if (array_key_exists($tableName, $this->tableExistsCache)) {
            return $this->tableExistsCache[$tableName];
        }
        try {
            $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $stmt = $this->db->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
                $stmt->execute([$tableName]);
                $exists = (bool)$stmt->fetchColumn();
            } else {
                $stmt = $this->db->query("SHOW TABLES LIKE " . $this->db->quote($tableName));
                $exists = (bool)$stmt->fetchColumn();
            }
        } catch (\Throwable $t) {
            $exists = false;
        }
        $this->tableExistsCache[$tableName] = $exists;
        return $exists;
    }

    /**
     * Auto-creates commerce_sop_config table if it does not exist.
     */
    private function ensureConfigTable(): void {
        if ($this->configTableReady === true) {
            return;
        }

        $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'sqlite') {
            $this->db->exec("CREATE TABLE IF NOT EXISTS `commerce_sop_config` (
                `id` INTEGER PRIMARY KEY AUTOINCREMENT,
                `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
                `shop_id` VARCHAR(64) NOT NULL,
                `target_roi` DECIMAL(8,2) NOT NULL DEFAULT 13.00,
                `video_target_roi` DECIMAL(8,2) NOT NULL DEFAULT 15.00,
                `live_target_roi` DECIMAL(8,2) NOT NULL DEFAULT 13.00,
                `monthly_gmv_target` DECIMAL(18,2) NOT NULL DEFAULT 600000000.00,
                `daily_gmv_target` DECIMAL(18,2) NOT NULL DEFAULT 20000000.00,
                `video_split_pct` DECIMAL(5,2) NOT NULL DEFAULT 75.00,
                `live_split_pct` DECIMAL(5,2) NOT NULL DEFAULT 25.00,
                `main_sku_split_pct` DECIMAL(5,2) NOT NULL DEFAULT 80.00,
                `sub_sku_split_pct` DECIMAL(5,2) NOT NULL DEFAULT 20.00,
                `main_sku_keyword` VARCHAR(255) NOT NULL DEFAULT 'Viên sủi mát gan',
                `main_sku_product_id` VARCHAR(64) DEFAULT NULL,
                `live_sessions_per_day` INTEGER NOT NULL DEFAULT 2,
                `red_flag_roi_threshold` DECIMAL(8,2) NOT NULL DEFAULT 10.00,
                `red_flag_spend_pct` DECIMAL(5,2) NOT NULL DEFAULT 50.00,
                `red_flag_min_clicks` INTEGER NOT NULL DEFAULT 50,
                `yellow_flag_hour` INTEGER NOT NULL DEFAULT 14,
                `yellow_flag_spend_pct` DECIMAL(5,2) NOT NULL DEFAULT 50.00,
                `green_flag_roi_buffer` DECIMAL(8,2) NOT NULL DEFAULT 2.00,
                `green_flag_spend_pct` DECIMAL(5,2) NOT NULL DEFAULT 80.00,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(`platform`, `shop_id`)
            )");
        } else {
            $this->db->exec("CREATE TABLE IF NOT EXISTS `commerce_sop_config` (
                `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
                `shop_id` VARCHAR(64) NOT NULL,
                `target_roi` DECIMAL(8,2) NOT NULL DEFAULT 13.00,
                `video_target_roi` DECIMAL(8,2) NOT NULL DEFAULT 15.00,
                `live_target_roi` DECIMAL(8,2) NOT NULL DEFAULT 13.00,
                `monthly_gmv_target` DECIMAL(18,2) NOT NULL DEFAULT 600000000.00,
                `daily_gmv_target` DECIMAL(18,2) NOT NULL DEFAULT 20000000.00,
                `video_split_pct` DECIMAL(5,2) NOT NULL DEFAULT 75.00,
                `live_split_pct` DECIMAL(5,2) NOT NULL DEFAULT 25.00,
                `main_sku_split_pct` DECIMAL(5,2) NOT NULL DEFAULT 80.00,
                `sub_sku_split_pct` DECIMAL(5,2) NOT NULL DEFAULT 20.00,
                `main_sku_keyword` VARCHAR(255) NOT NULL DEFAULT 'Viên sủi mát gan',
                `main_sku_product_id` VARCHAR(64) DEFAULT NULL,
                `live_sessions_per_day` INT NOT NULL DEFAULT 2,
                `red_flag_roi_threshold` DECIMAL(8,2) NOT NULL DEFAULT 10.00,
                `red_flag_spend_pct` DECIMAL(5,2) NOT NULL DEFAULT 50.00,
                `red_flag_min_clicks` INT NOT NULL DEFAULT 50,
                `yellow_flag_hour` INT NOT NULL DEFAULT 14,
                `yellow_flag_spend_pct` DECIMAL(5,2) NOT NULL DEFAULT 50.00,
                `green_flag_roi_buffer` DECIMAL(8,2) NOT NULL DEFAULT 2.00,
                `green_flag_spend_pct` DECIMAL(5,2) NOT NULL DEFAULT 80.00,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `uk_sop_config_shop` (`platform`, `shop_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }

        $this->configTableReady = true;
        $this->tableExistsCache['commerce_sop_config'] = true;
    }

    /**
     * Enriches raw config row with derived SOP targets & daily spend caps.
     */
    private function enrichConfig(string $shopId, array $row): array {
        $targetRoi = max(0.1, (float)($row['target_roi'] ?? self::DEFAULT_CONFIG['target_roi']));
        $videoTargetRoi = max(0.1, (float)($row['video_target_roi'] ?? self::DEFAULT_CONFIG['video_target_roi']));
        $liveTargetRoi = max(0.1, (float)($row['live_target_roi'] ?? self::DEFAULT_CONFIG['live_target_roi']));

        $monthlyGmvTarget = max(0.0, (float)($row['monthly_gmv_target'] ?? self::DEFAULT_CONFIG['monthly_gmv_target']));
        $dailyGmvTarget = max(0.0, (float)($row['daily_gmv_target'] ?? self::DEFAULT_CONFIG['daily_gmv_target']));

        $videoSplitPct = max(0.0, min(100.0, (float)($row['video_split_pct'] ?? self::DEFAULT_CONFIG['video_split_pct'])));
        $liveSplitPct = max(0.0, min(100.0, (float)($row['live_split_pct'] ?? (100.0 - $videoSplitPct))));
        $mainSkuSplitPct = max(0.0, min(100.0, (float)($row['main_sku_split_pct'] ?? self::DEFAULT_CONFIG['main_sku_split_pct'])));
        $subSkuSplitPct = max(0.0, min(100.0, (float)($row['sub_sku_split_pct'] ?? (100.0 - $mainSkuSplitPct))));

        $liveSessionsPerDay = max(1, (int)($row['live_sessions_per_day'] ?? self::DEFAULT_CONFIG['live_sessions_per_day']));

        $dailySpendCap = round($dailyGmvTarget / $targetRoi, 2);
        $videoDailyGmvTarget = round($dailyGmvTarget * ($videoSplitPct / 100.0), 2);
        $liveDailyGmvTarget = round($dailyGmvTarget * ($liveSplitPct / 100.0), 2);

        $videoDailySpendCap = round($videoDailyGmvTarget / $videoTargetRoi, 2);
        $liveDailySpendCap = round($liveDailyGmvTarget / $liveTargetRoi, 2);
        $livePerSessionGmvTarget = round($liveDailyGmvTarget / $liveSessionsPerDay, 2);

        $mainSkuDailyGmvTarget = round($videoDailyGmvTarget * ($mainSkuSplitPct / 100.0), 2);
        $subSkuDailyGmvTarget = round($videoDailyGmvTarget * ($subSkuSplitPct / 100.0), 2);

        return [
            'shop_id' => $shopId,
            'target_roi' => round($targetRoi, 2),
            'video_target_roi' => round($videoTargetRoi, 2),
            'live_target_roi' => round($liveTargetRoi, 2),
            'monthly_gmv_target' => round($monthlyGmvTarget, 2),
            'daily_gmv_target' => round($dailyGmvTarget, 2),
            'video_split_pct' => round($videoSplitPct, 2),
            'live_split_pct' => round($liveSplitPct, 2),
            'main_sku_split_pct' => round($mainSkuSplitPct, 2),
            'sub_sku_split_pct' => round($subSkuSplitPct, 2),
            'main_sku_keyword' => trim((string)($row['main_sku_keyword'] ?? self::DEFAULT_CONFIG['main_sku_keyword'])),
            'main_sku_product_id' => !empty($row['main_sku_product_id']) ? (string)$row['main_sku_product_id'] : null,
            'live_sessions_per_day' => $liveSessionsPerDay,
            'red_flag_roi_threshold' => round((float)($row['red_flag_roi_threshold'] ?? self::DEFAULT_CONFIG['red_flag_roi_threshold']), 2),
            'red_flag_spend_pct' => round((float)($row['red_flag_spend_pct'] ?? self::DEFAULT_CONFIG['red_flag_spend_pct']), 2),
            'red_flag_min_clicks' => max(1, (int)($row['red_flag_min_clicks'] ?? self::DEFAULT_CONFIG['red_flag_min_clicks'])),
            'yellow_flag_hour' => max(0, min(23, (int)($row['yellow_flag_hour'] ?? self::DEFAULT_CONFIG['yellow_flag_hour']))),
            'yellow_flag_spend_pct' => round((float)($row['yellow_flag_spend_pct'] ?? self::DEFAULT_CONFIG['yellow_flag_spend_pct']), 2),
            'green_flag_roi_buffer' => round(max(0.0, (float)($row['green_flag_roi_buffer'] ?? self::DEFAULT_CONFIG['green_flag_roi_buffer'])), 2),
            'green_flag_spend_pct' => round((float)($row['green_flag_spend_pct'] ?? self::DEFAULT_CONFIG['green_flag_spend_pct']), 2),
            'updated_at' => $row['updated_at'] ?? null,
            // Derived SOP Targets
            'daily_spend_cap' => $dailySpendCap,
            'video_daily_gmv_target' => $videoDailyGmvTarget,
            'video_daily_spend_cap' => $videoDailySpendCap,
            'live_daily_gmv_target' => $liveDailyGmvTarget,
            'live_daily_spend_cap' => $liveDailySpendCap,
            'live_per_session_gmv_target' => $livePerSessionGmvTarget,
            'main_sku_daily_gmv_target' => $mainSkuDailyGmvTarget,
            'sub_sku_daily_gmv_target' => $subSkuDailyGmvTarget,
        ];
    }

    /**
     * Gets SOP configuration for a shop (auto-seeding default row if not present).
     */
    public function getConfig(string $shopId): array {
        $this->ensureConfigTable();
        $stmt = $this->db->prepare("SELECT * FROM `commerce_sop_config` WHERE platform = ? AND shop_id = ? LIMIT 1");
        $stmt->execute([self::PLATFORM, $shopId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            $this->saveConfig($shopId, self::DEFAULT_CONFIG);
            $stmt->execute([self::PLATFORM, $shopId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: self::DEFAULT_CONFIG;
        }

        return $this->enrichConfig($shopId, $row);
    }

    /**
     * Saves/updates SOP configuration for a shop.
     */
    public function saveConfig(string $shopId, array $input): array {
        $this->ensureConfigTable();

        $stmtExisting = $this->db->prepare("SELECT * FROM `commerce_sop_config` WHERE platform = ? AND shop_id = ? LIMIT 1");
        $stmtExisting->execute([self::PLATFORM, $shopId]);
        $existing = $stmtExisting->fetch(PDO::FETCH_ASSOC) ?: self::DEFAULT_CONFIG;

        $targetRoi = isset($input['target_roi']) ? max(0.5, (float)$input['target_roi']) : (float)$existing['target_roi'];
        $videoTargetRoi = isset($input['video_target_roi']) ? max(0.5, (float)$input['video_target_roi']) : (float)$existing['video_target_roi'];
        $liveTargetRoi = isset($input['live_target_roi']) ? max(0.5, (float)$input['live_target_roi']) : (float)$existing['live_target_roi'];

        $monthlyGmvTarget = isset($input['monthly_gmv_target']) ? max(0.0, (float)$input['monthly_gmv_target']) : (float)$existing['monthly_gmv_target'];
        $dailyGmvTarget = isset($input['daily_gmv_target']) ? max(0.0, (float)$input['daily_gmv_target']) : (float)$existing['daily_gmv_target'];

        $videoSplitPct = isset($input['video_split_pct']) ? max(0.0, min(100.0, (float)$input['video_split_pct'])) : (float)$existing['video_split_pct'];
        $liveSplitPct = isset($input['live_split_pct']) ? max(0.0, min(100.0, (float)$input['live_split_pct'])) : round(100.0 - $videoSplitPct, 2);

        $mainSkuSplitPct = isset($input['main_sku_split_pct']) ? max(0.0, min(100.0, (float)$input['main_sku_split_pct'])) : (float)$existing['main_sku_split_pct'];
        $subSkuSplitPct = isset($input['sub_sku_split_pct']) ? max(0.0, min(100.0, (float)$input['sub_sku_split_pct'])) : round(100.0 - $mainSkuSplitPct, 2);

        $mainSkuKeyword = array_key_exists('main_sku_keyword', $input)
            ? trim((string)$input['main_sku_keyword'])
            : (string)$existing['main_sku_keyword'];
        if ($mainSkuKeyword === '') {
            $mainSkuKeyword = self::DEFAULT_CONFIG['main_sku_keyword'];
        }

        $mainSkuProductId = array_key_exists('main_sku_product_id', $input)
            ? (trim((string)$input['main_sku_product_id']) !== '' ? trim((string)$input['main_sku_product_id']) : null)
            : ($existing['main_sku_product_id'] ?? null);

        $liveSessionsPerDay = isset($input['live_sessions_per_day']) ? max(1, (int)$input['live_sessions_per_day']) : (int)$existing['live_sessions_per_day'];

        $redFlagRoiThreshold = isset($input['red_flag_roi_threshold']) ? max(0.1, (float)$input['red_flag_roi_threshold']) : (float)$existing['red_flag_roi_threshold'];
        $redFlagSpendPct = isset($input['red_flag_spend_pct']) ? max(1.0, min(100.0, (float)$input['red_flag_spend_pct'])) : (float)$existing['red_flag_spend_pct'];
        $redFlagMinClicks = isset($input['red_flag_min_clicks']) ? max(1, (int)$input['red_flag_min_clicks']) : (int)$existing['red_flag_min_clicks'];

        $yellowFlagHour = isset($input['yellow_flag_hour']) ? max(0, min(23, (int)$input['yellow_flag_hour'])) : (int)$existing['yellow_flag_hour'];
        $yellowFlagSpendPct = isset($input['yellow_flag_spend_pct']) ? max(1.0, min(100.0, (float)$input['yellow_flag_spend_pct'])) : (float)$existing['yellow_flag_spend_pct'];

        $greenFlagRoiBuffer = isset($input['green_flag_roi_buffer']) ? max(0.0, (float)$input['green_flag_roi_buffer']) : (float)$existing['green_flag_roi_buffer'];
        $greenFlagSpendPct = isset($input['green_flag_spend_pct']) ? max(1.0, min(100.0, (float)$input['green_flag_spend_pct'])) : (float)$existing['green_flag_spend_pct'];

        $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'sqlite') {
            $sql = "INSERT INTO `commerce_sop_config` (
                platform, shop_id, target_roi, video_target_roi, live_target_roi,
                monthly_gmv_target, daily_gmv_target, video_split_pct, live_split_pct,
                main_sku_split_pct, sub_sku_split_pct, main_sku_keyword, main_sku_product_id,
                live_sessions_per_day, red_flag_roi_threshold, red_flag_spend_pct, red_flag_min_clicks,
                yellow_flag_hour, yellow_flag_spend_pct, green_flag_roi_buffer, green_flag_spend_pct,
                updated_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                CURRENT_TIMESTAMP
            ) ON CONFLICT(platform, shop_id) DO UPDATE SET
                target_roi = excluded.target_roi,
                video_target_roi = excluded.video_target_roi,
                live_target_roi = excluded.live_target_roi,
                monthly_gmv_target = excluded.monthly_gmv_target,
                daily_gmv_target = excluded.daily_gmv_target,
                video_split_pct = excluded.video_split_pct,
                live_split_pct = excluded.live_split_pct,
                main_sku_split_pct = excluded.main_sku_split_pct,
                sub_sku_split_pct = excluded.sub_sku_split_pct,
                main_sku_keyword = excluded.main_sku_keyword,
                main_sku_product_id = excluded.main_sku_product_id,
                live_sessions_per_day = excluded.live_sessions_per_day,
                red_flag_roi_threshold = excluded.red_flag_roi_threshold,
                red_flag_spend_pct = excluded.red_flag_spend_pct,
                red_flag_min_clicks = excluded.red_flag_min_clicks,
                yellow_flag_hour = excluded.yellow_flag_hour,
                yellow_flag_spend_pct = excluded.yellow_flag_spend_pct,
                green_flag_roi_buffer = excluded.green_flag_roi_buffer,
                green_flag_spend_pct = excluded.green_flag_spend_pct,
                updated_at = CURRENT_TIMESTAMP";
        } else {
            $sql = "INSERT INTO `commerce_sop_config` (
                platform, shop_id, target_roi, video_target_roi, live_target_roi,
                monthly_gmv_target, daily_gmv_target, video_split_pct, live_split_pct,
                main_sku_split_pct, sub_sku_split_pct, main_sku_keyword, main_sku_product_id,
                live_sessions_per_day, red_flag_roi_threshold, red_flag_spend_pct, red_flag_min_clicks,
                yellow_flag_hour, yellow_flag_spend_pct, green_flag_roi_buffer, green_flag_spend_pct
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?
            ) ON DUPLICATE KEY UPDATE
                target_roi = VALUES(target_roi),
                video_target_roi = VALUES(video_target_roi),
                live_target_roi = VALUES(live_target_roi),
                monthly_gmv_target = VALUES(monthly_gmv_target),
                daily_gmv_target = VALUES(daily_gmv_target),
                video_split_pct = VALUES(video_split_pct),
                live_split_pct = VALUES(live_split_pct),
                main_sku_split_pct = VALUES(main_sku_split_pct),
                sub_sku_split_pct = VALUES(sub_sku_split_pct),
                main_sku_keyword = VALUES(main_sku_keyword),
                main_sku_product_id = VALUES(main_sku_product_id),
                live_sessions_per_day = VALUES(live_sessions_per_day),
                red_flag_roi_threshold = VALUES(red_flag_roi_threshold),
                red_flag_spend_pct = VALUES(red_flag_spend_pct),
                red_flag_min_clicks = VALUES(red_flag_min_clicks),
                yellow_flag_hour = VALUES(yellow_flag_hour),
                yellow_flag_spend_pct = VALUES(yellow_flag_spend_pct),
                green_flag_roi_buffer = VALUES(green_flag_roi_buffer),
                green_flag_spend_pct = VALUES(green_flag_spend_pct)";
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            self::PLATFORM,
            $shopId,
            $targetRoi,
            $videoTargetRoi,
            $liveTargetRoi,
            $monthlyGmvTarget,
            $dailyGmvTarget,
            $videoSplitPct,
            $liveSplitPct,
            $mainSkuSplitPct,
            $subSkuSplitPct,
            $mainSkuKeyword,
            $mainSkuProductId,
            $liveSessionsPerDay,
            $redFlagRoiThreshold,
            $redFlagSpendPct,
            $redFlagMinClicks,
            $yellowFlagHour,
            $yellowFlagSpendPct,
            $greenFlagRoiBuffer,
            $greenFlagSpendPct,
        ]);

        return $this->getConfig($shopId);
    }

    /**
     * Computes real-time SOP pacing, channel split, and Red/Yellow/Green alerts from real DB tables.
     */
    public function getPacingOverview(string $shopId, ?string $date = null, ?int $currentHour = null): array {
        $targetDate = ($date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) ? $date : date('Y-m-d');
        $evalHour = $currentHour !== null ? max(0, min(23, $currentHour)) : (int)date('G');
        $monthStart = substr($targetDate, 0, 7) . '-01';

        $config = $this->getConfig($shopId);

        // 1. Real Orders & Shop GMV (Daily + Month-to-Date) from commerce_orders
        $ordersDaily = $this->queryOrdersSummary($shopId, $targetDate, $targetDate);
        $ordersMtd = $this->queryOrdersSummary($shopId, $monthStart, $targetDate);

        // 2. Main SKU vs Secondary SKUs GMV from commerce_order_items + commerce_orders
        $skuSplitDaily = $this->querySkuSplitGmv(
            $shopId,
            $targetDate,
            $config['main_sku_keyword'],
            $config['main_sku_product_id']
        );

        // 3. Real Ads Performance (Product/Video vs LIVE) from commerce_ads_campaign_daily
        $adsData = $this->queryAdsDaily($shopId, $targetDate);

        // 4. Real LIVE Sessions from commerce_live_sessions
        $liveSessions = $this->queryLiveSessions($shopId, $targetDate);

        // 5. Real Video Analytics from commerce_video_analytics
        $videoStats = $this->queryVideoAnalytics($shopId, $targetDate);

        // Combine & compute metrics
        $totalShopGmv = $ordersDaily['gross_gmv'];
        $totalShopOrders = $ordersDaily['order_count'];
        $totalSpend = $adsData['total_spend'];
        $totalAdsGmv = $adsData['total_ads_gmv'];
        $totalAdsOrders = $adsData['total_ads_orders'];
        $totalClicks = $adsData['total_clicks'];
        $totalImpressions = $adsData['total_impressions'];

        // Shop ROI uses shop GMV / total ads spend (and we also expose ads_roi = ads_gmv / spend)
        $shopActualRoi = $totalSpend > 0 ? round($totalShopGmv / $totalSpend, 2) : null;
        $adsActualRoi = $totalSpend > 0 ? round($totalAdsGmv / $totalSpend, 2) : null;

        $videoSpend = $adsData['video_spend'];
        $videoAdsGmv = $adsData['video_ads_gmv'];
        $videoOrders = $adsData['video_orders'];
        $videoClicks = $adsData['video_clicks'];
        $videoRoi = $videoSpend > 0 ? round($videoAdsGmv / $videoSpend, 2) : null;

        $liveSpend = $adsData['live_spend'];
        // Prefer LIVE Ads GMV for Ads ROI, and also track organic+ads session GMV from commerce_live_sessions
        $liveAdsGmv = $adsData['live_ads_gmv'];
        $liveSessionGmv = $liveSessions['total_gmv'];
        $liveEffectiveGmv = $liveSessionGmv > 0 ? $liveSessionGmv : $liveAdsGmv;
        $liveRoi = $liveSpend > 0 ? round($liveAdsGmv / $liveSpend, 2) : null;
        $liveBlendedRoi = $liveSpend > 0 ? round($liveEffectiveGmv / $liveSpend, 2) : null;

        // Pacing percentages
        $dailyGmvPacingPct = $config['daily_gmv_target'] > 0
            ? round(($totalShopGmv / $config['daily_gmv_target']) * 100.0, 1)
            : 0.0;
        $dailySpendCapPct = $config['daily_spend_cap'] > 0
            ? round(($totalSpend / $config['daily_spend_cap']) * 100.0, 1)
            : 0.0;
        $monthlyGmvPacingPct = $config['monthly_gmv_target'] > 0
            ? round(($ordersMtd['gross_gmv'] / $config['monthly_gmv_target']) * 100.0, 1)
            : 0.0;

        $videoSpendCapPct = $config['video_daily_spend_cap'] > 0
            ? round(($videoSpend / $config['video_daily_spend_cap']) * 100.0, 1)
            : 0.0;
        $videoGmvPacingPct = $config['video_daily_gmv_target'] > 0
            ? round(($videoAdsGmv / $config['video_daily_gmv_target']) * 100.0, 1)
            : 0.0;

        $liveSpendCapPct = $config['live_daily_spend_cap'] > 0
            ? round(($liveSpend / $config['live_daily_spend_cap']) * 100.0, 1)
            : 0.0;
        $liveGmvPacingPct = $config['live_daily_gmv_target'] > 0
            ? round(($liveEffectiveGmv / $config['live_daily_gmv_target']) * 100.0, 1)
            : 0.0;

        $mainSkuGmvPacingPct = $config['main_sku_daily_gmv_target'] > 0
            ? round(($skuSplitDaily['main_sku_gmv'] / $config['main_sku_daily_gmv_target']) * 100.0, 1)
            : 0.0;
        $subSkuGmvPacingPct = $config['sub_sku_daily_gmv_target'] > 0
            ? round(($skuSplitDaily['sub_sku_gmv'] / $config['sub_sku_daily_gmv_target']) * 100.0, 1)
            : 0.0;

        $totalSkuGmv = $skuSplitDaily['main_sku_gmv'] + $skuSplitDaily['sub_sku_gmv'];
        $mainSkuActualSharePct = $totalSkuGmv > 0 ? round(($skuSplitDaily['main_sku_gmv'] / $totalSkuGmv) * 100.0, 1) : 0.0;
        $subSkuActualSharePct = $totalSkuGmv > 0 ? round(($skuSplitDaily['sub_sku_gmv'] / $totalSkuGmv) * 100.0, 1) : 0.0;

        // 6. Red / Yellow / Green Alert Engine
        $alerts = $this->evaluateAlerts(
            $config,
            $evalHour,
            [
                'total_spend' => $totalSpend,
                'total_shop_gmv' => $totalShopGmv,
                'total_ads_gmv' => $totalAdsGmv,
                'total_orders' => $totalShopOrders,
                'total_ads_orders' => $totalAdsOrders,
                'total_clicks' => $totalClicks,
                'daily_spend_cap_pct' => $dailySpendCapPct,
                'ads_roi' => $adsActualRoi,
                'shop_roi' => $shopActualRoi,
                'video_spend' => $videoSpend,
                'video_spend_cap_pct' => $videoSpendCapPct,
                'video_roi' => $videoRoi,
                'video_clicks' => $videoClicks,
                'video_orders' => $videoOrders,
                'live_spend' => $liveSpend,
                'live_spend_cap_pct' => $liveSpendCapPct,
                'live_roi' => $liveRoi,
                'live_clicks' => $adsData['live_clicks'],
                'live_orders' => $adsData['live_orders'],
                'campaigns' => $adsData['campaigns'],
            ]
        );

        // 7. Build Morning Briefing (09:30) text
        $briefing = $this->buildMorningBriefing(
            $targetDate,
            $evalHour,
            $config,
            [
                'total_shop_gmv' => $totalShopGmv,
                'total_shop_orders' => $totalShopOrders,
                'mtd_gmv' => $ordersMtd['gross_gmv'],
                'monthly_gmv_pacing_pct' => $monthlyGmvPacingPct,
                'daily_gmv_pacing_pct' => $dailyGmvPacingPct,
                'total_spend' => $totalSpend,
                'daily_spend_cap_pct' => $dailySpendCapPct,
                'ads_roi' => $adsActualRoi,
                'shop_roi' => $shopActualRoi,
                'video_spend' => $videoSpend,
                'video_ads_gmv' => $videoAdsGmv,
                'video_roi' => $videoRoi,
                'live_spend' => $liveSpend,
                'live_gmv' => $liveEffectiveGmv,
                'live_roi' => $liveRoi,
                'live_sessions_count' => $liveSessions['session_count'],
                'main_sku_gmv' => $skuSplitDaily['main_sku_gmv'],
                'sub_sku_gmv' => $skuSplitDaily['sub_sku_gmv'],
            ],
            $alerts
        );

        return [
            'shop_id' => $shopId,
            'stat_date' => $targetDate,
            'evaluated_hour' => $evalHour,
            'config' => $config,
            'data_sources' => [
                'orders_available' => $ordersDaily['source_available'],
                'ads_available' => $adsData['source_available'],
                'ads_source_table' => $adsData['source_table'],
                'live_sessions_available' => $liveSessions['source_available'],
                'video_analytics_available' => $videoStats['source_available'],
            ],
            'pacing' => [
                'total_shop' => [
                    'actual_gmv' => round($totalShopGmv, 2),
                    'target_gmv' => $config['daily_gmv_target'],
                    'gmv_pacing_pct' => $dailyGmvPacingPct,
                    'actual_orders' => $totalShopOrders,
                    'actual_spend' => round($totalSpend, 2),
                    'daily_spend_cap' => $config['daily_spend_cap'],
                    'spend_pacing_pct' => $dailySpendCapPct,
                    'ads_gmv' => round($totalAdsGmv, 2),
                    'ads_roi' => $adsActualRoi,
                    'shop_roi' => $shopActualRoi,
                    'target_roi' => $config['target_roi'],
                    'clicks' => $totalClicks,
                    'impressions' => $totalImpressions,
                    'mtd_gmv' => round($ordersMtd['gross_gmv'], 2),
                    'mtd_orders' => $ordersMtd['order_count'],
                    'monthly_gmv_target' => $config['monthly_gmv_target'],
                    'monthly_gmv_pacing_pct' => $monthlyGmvPacingPct,
                ],
                'video_channel' => [
                    'split_pct' => $config['video_split_pct'],
                    'actual_spend' => round($videoSpend, 2),
                    'daily_spend_cap' => $config['video_daily_spend_cap'],
                    'spend_pacing_pct' => $videoSpendCapPct,
                    'actual_gmv' => round($videoAdsGmv, 2),
                    'target_gmv' => $config['video_daily_gmv_target'],
                    'gmv_pacing_pct' => $videoGmvPacingPct,
                    'actual_roi' => $videoRoi,
                    'target_roi' => $config['video_target_roi'],
                    'orders' => $videoOrders,
                    'clicks' => $videoClicks,
                    'videos_posted_today' => $videoStats['video_count'],
                    'video_views_today' => $videoStats['total_views'],
                    'main_sku' => [
                        'keyword' => $config['main_sku_keyword'],
                        'split_pct' => $config['main_sku_split_pct'],
                        'actual_gmv' => round($skuSplitDaily['main_sku_gmv'], 2),
                        'target_gmv' => $config['main_sku_daily_gmv_target'],
                        'gmv_pacing_pct' => $mainSkuGmvPacingPct,
                        'actual_share_pct' => $mainSkuActualSharePct,
                        'orders' => $skuSplitDaily['main_sku_orders'],
                    ],
                    'sub_sku' => [
                        'split_pct' => $config['sub_sku_split_pct'],
                        'actual_gmv' => round($skuSplitDaily['sub_sku_gmv'], 2),
                        'target_gmv' => $config['sub_sku_daily_gmv_target'],
                        'gmv_pacing_pct' => $subSkuGmvPacingPct,
                        'actual_share_pct' => $subSkuActualSharePct,
                        'orders' => $skuSplitDaily['sub_sku_orders'],
                    ],
                ],
                'live_channel' => [
                    'split_pct' => $config['live_split_pct'],
                    'actual_spend' => round($liveSpend, 2),
                    'daily_spend_cap' => $config['live_daily_spend_cap'],
                    'spend_pacing_pct' => $liveSpendCapPct,
                    'actual_gmv' => round($liveEffectiveGmv, 2),
                    'ads_gmv' => round($liveAdsGmv, 2),
                    'session_gmv' => round($liveSessionGmv, 2),
                    'target_gmv' => $config['live_daily_gmv_target'],
                    'gmv_pacing_pct' => $liveGmvPacingPct,
                    'actual_roi' => $liveRoi,
                    'blended_roi' => $liveBlendedRoi,
                    'target_roi' => $config['live_target_roi'],
                    'sessions_today' => $liveSessions['session_count'],
                    'sessions_target' => $config['live_sessions_per_day'],
                    'per_session_gmv_target' => $config['live_per_session_gmv_target'],
                    'live_views_today' => $liveSessions['total_views'],
                ],
            ],
            'campaigns' => $adsData['campaigns'],
            'alerts' => $alerts,
            'morning_briefing_text' => $briefing,
        ];
    }

    /**
     * Queries real order count and gross GMV from commerce_orders.
     */
    private function queryOrdersSummary(string $shopId, string $startDate, string $endDate): array {
        if (!$this->tableExists('commerce_orders')) {
            return ['source_available' => false, 'order_count' => 0, 'gross_gmv' => 0.0];
        }

        try {
            $stmt = $this->db->prepare("SELECT
                COUNT(DISTINCT CASE WHEN UPPER(COALESCE(order_status, '')) != 'CANCELLED' THEN platform_order_id ELSE NULL END) AS valid_orders,
                COALESCE(SUM(CASE WHEN UPPER(COALESCE(order_status, '')) != 'CANCELLED' THEN order_gross_amount ELSE 0 END), 0) AS gross_gmv
            FROM `commerce_orders`
            WHERE shop_id = ? AND platform_created_at >= ? AND platform_created_at <= ?");
            $stmt->execute([$shopId, $startDate . ' 00:00:00', $endDate . ' 23:59:59']);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            return [
                'source_available' => true,
                'order_count' => (int)($row['valid_orders'] ?? 0),
                'gross_gmv' => (float)($row['gross_gmv'] ?? 0.0),
            ];
        } catch (\Throwable $t) {
            return ['source_available' => false, 'order_count' => 0, 'gross_gmv' => 0.0];
        }
    }

    /**
     * Queries Main SKU vs Secondary SKUs GMV from commerce_order_items + commerce_orders.
     */
    private function querySkuSplitGmv(string $shopId, string $date, string $mainKeyword, ?string $mainProductId): array {
        if (!$this->tableExists('commerce_order_items') || !$this->tableExists('commerce_orders')) {
            return [
                'main_sku_gmv' => 0.0,
                'main_sku_orders' => 0,
                'sub_sku_gmv' => 0.0,
                'sub_sku_orders' => 0,
            ];
        }

        try {
            $stmt = $this->db->prepare("SELECT
                i.product_id,
                MAX(i.product_name) AS product_name,
                COUNT(DISTINCT o.platform_order_id) AS order_cnt,
                COALESCE(SUM(i.quantity * i.sale_price), 0) AS gross_rev
            FROM `commerce_order_items` i
            INNER JOIN `commerce_orders` o ON i.order_id = o.id
            WHERE o.shop_id = ?
              AND UPPER(COALESCE(o.order_status, '')) != 'CANCELLED'
              AND o.platform_created_at >= ?
              AND o.platform_created_at <= ?
            GROUP BY i.product_id");
            $stmt->execute([$shopId, $date . ' 00:00:00', $date . ' 23:59:59']);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $mainGmv = 0.0;
            $mainOrders = 0;
            $subGmv = 0.0;
            $subOrders = 0;
            $kwLower = mb_strtolower(trim($mainKeyword), 'UTF-8');

            foreach ($rows as $r) {
                $pid = (string)($r['product_id'] ?? '');
                $pname = mb_strtolower((string)($r['product_name'] ?? ''), 'UTF-8');
                $rev = (float)($r['gross_rev'] ?? 0.0);
                $cnt = (int)($r['order_cnt'] ?? 0);

                $isMain = false;
                if ($mainProductId !== null && $mainProductId !== '' && $pid === $mainProductId) {
                    $isMain = true;
                } elseif ($kwLower !== '' && mb_strpos($pname, $kwLower, 0, 'UTF-8') !== false) {
                    $isMain = true;
                }

                if ($isMain) {
                    $mainGmv += $rev;
                    $mainOrders += $cnt;
                } else {
                    $subGmv += $rev;
                    $subOrders += $cnt;
                }
            }

            return [
                'main_sku_gmv' => $mainGmv,
                'main_sku_orders' => $mainOrders,
                'sub_sku_gmv' => $subGmv,
                'sub_sku_orders' => $subOrders,
            ];
        } catch (\Throwable $t) {
            return [
                'main_sku_gmv' => 0.0,
                'main_sku_orders' => 0,
                'sub_sku_gmv' => 0.0,
                'sub_sku_orders' => 0,
            ];
        }
    }

    /**
     * Queries real daily Ads spend, GMV, clicks, impressions, orders by channel (LIVE vs PRODUCT/Video).
     */
    private function queryAdsDaily(string $shopId, string $date): array {
        $result = [
            'source_available' => false,
            'source_table' => 'NONE',
            'total_spend' => 0.0,
            'total_ads_gmv' => 0.0,
            'total_ads_orders' => 0,
            'total_clicks' => 0,
            'total_impressions' => 0,
            'video_spend' => 0.0,
            'video_ads_gmv' => 0.0,
            'video_orders' => 0,
            'video_clicks' => 0,
            'live_spend' => 0.0,
            'live_ads_gmv' => 0.0,
            'live_orders' => 0,
            'live_clicks' => 0,
            'campaigns' => [],
        ];

        if ($this->tableExists('commerce_ads_campaign_daily')) {
            try {
                $stmt = $this->db->prepare("SELECT
                    campaign_id,
                    MAX(campaign_name) AS campaign_name,
                    COALESCE(MAX(promotion_type), CASE WHEN MAX(campaign_type) LIKE '%LIVE%' THEN 'LIVE' ELSE 'PRODUCT' END) AS prom_type,
                    MAX(operation_status) AS operation_status,
                    MAX(target_roas) AS target_roas,
                    MAX(budget) AS budget,
                    COALESCE(SUM(spend), 0) AS spend,
                    COALESCE(SUM(gross_revenue), 0) AS ads_gmv,
                    COALESCE(SUM(orders), 0) AS orders,
                    COALESCE(SUM(clicks), 0) AS clicks,
                    COALESCE(SUM(impressions), 0) AS impressions
                FROM `commerce_ads_campaign_daily`
                WHERE shop_id = ? AND stat_date = ?
                GROUP BY campaign_id
                ORDER BY spend DESC");
                $stmt->execute([$shopId, $date]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $result['source_available'] = true;
                $result['source_table'] = 'commerce_ads_campaign_daily';

                foreach ($rows as $r) {
                    $spend = (float)($r['spend'] ?? 0.0);
                    $gmv = (float)($r['ads_gmv'] ?? 0.0);
                    $orders = (int)($r['orders'] ?? 0);
                    $clicks = (int)($r['clicks'] ?? 0);
                    $impr = (int)($r['impressions'] ?? 0);
                    $promType = strtoupper((string)($r['prom_type'] ?? 'PRODUCT'));
                    $isLive = ($promType === 'LIVE' || stripos((string)($r['campaign_name'] ?? ''), 'LIVE') !== false);
                    $roi = $spend > 0 ? round($gmv / $spend, 2) : null;

                    $result['total_spend'] += $spend;
                    $result['total_ads_gmv'] += $gmv;
                    $result['total_ads_orders'] += $orders;
                    $result['total_clicks'] += $clicks;
                    $result['total_impressions'] += $impr;

                    if ($isLive) {
                        $result['live_spend'] += $spend;
                        $result['live_ads_gmv'] += $gmv;
                        $result['live_orders'] += $orders;
                        $result['live_clicks'] += $clicks;
                    } else {
                        $result['video_spend'] += $spend;
                        $result['video_ads_gmv'] += $gmv;
                        $result['video_orders'] += $orders;
                        $result['video_clicks'] += $clicks;
                    }

                    $isActive = (strtoupper((string)($r['operation_status'] ?? 'ENABLE')) === 'ENABLE' || $spend > 0 || $gmv > 0);
                    $result['campaigns'][] = [
                        'campaign_id' => (string)$r['campaign_id'],
                        'campaign_name' => (string)($r['campaign_name'] ?? ('Chiến dịch ' . $r['campaign_id'])),
                        'channel' => $isLive ? 'LIVE' : 'VIDEO_PRODUCT',
                        'operation_status' => (string)($r['operation_status'] ?? 'ENABLE'),
                        'is_active' => $isActive,
                        'target_roas' => ($r['target_roas'] !== null && (float)$r['target_roas'] > 0) ? (float)$r['target_roas'] : null,
                        'budget' => (float)($r['budget'] ?? 0.0),
                        'spend' => round($spend, 2),
                        'ads_gmv' => round($gmv, 2),
                        'orders' => $orders,
                        'clicks' => $clicks,
                        'impressions' => $impr,
                        'roi' => $roi,
                    ];
                }

                usort($result['campaigns'], static function (array $a, array $b): int {
                    if ($a['is_active'] !== $b['is_active']) {
                        return $a['is_active'] ? -1 : 1;
                    }
                    if ($a['spend'] !== $b['spend']) {
                        return $b['spend'] <=> $a['spend'];
                    }
                    return $b['ads_gmv'] <=> $a['ads_gmv'];
                });

                return $result;
            } catch (\Throwable $t) {
                // Fall through to legacy check
            }
        }

        if ($this->tableExists('tiktok_campaign_daily_reports')) {
            try {
                $stmt = $this->db->prepare("SELECT
                    campaign_id,
                    COALESCE(SUM(spend), 0) AS spend,
                    COALESCE(SUM(gmv), 0) AS ads_gmv,
                    COALESCE(SUM(orders), 0) AS orders
                FROM `tiktok_campaign_daily_reports`
                WHERE stat_date = ?
                GROUP BY campaign_id");
                $stmt->execute([$date]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $result['source_available'] = true;
                $result['source_table'] = 'tiktok_campaign_daily_reports';

                foreach ($rows as $r) {
                    $spend = (float)($r['spend'] ?? 0.0);
                    $gmv = (float)($r['ads_gmv'] ?? 0.0);
                    $orders = (int)($r['orders'] ?? 0);
                    $result['total_spend'] += $spend;
                    $result['total_ads_gmv'] += $gmv;
                    $result['total_ads_orders'] += $orders;
                    $result['video_spend'] += $spend;
                    $result['video_ads_gmv'] += $gmv;
                    $result['video_orders'] += $orders;
                    $isActive = ($spend > 0 || $gmv > 0);
                    $result['campaigns'][] = [
                        'campaign_id' => (string)$r['campaign_id'],
                        'campaign_name' => 'Chiến dịch ' . $r['campaign_id'],
                        'channel' => 'VIDEO_PRODUCT',
                        'operation_status' => 'ENABLE',
                        'is_active' => $isActive,
                        'target_roas' => null,
                        'budget' => 0.0,
                        'spend' => round($spend, 2),
                        'ads_gmv' => round($gmv, 2),
                        'orders' => $orders,
                        'clicks' => 0,
                        'impressions' => 0,
                        'roi' => $spend > 0 ? round($gmv / $spend, 2) : null,
                    ];
                }
            } catch (\Throwable $t) {}
        }

        return $result;
    }

    /**
     * Queries real LIVE session counts & GMV from commerce_live_sessions.
     */
    private function queryLiveSessions(string $shopId, string $date): array {
        if (!$this->tableExists('commerce_live_sessions')) {
            return ['source_available' => false, 'session_count' => 0, 'total_gmv' => 0.0, 'total_views' => 0];
        }

        try {
            $stmt = $this->db->prepare("SELECT
                COUNT(DISTINCT session_id) AS session_count,
                COALESCE(SUM(gmv), 0) AS total_gmv,
                COALESCE(SUM(total_views), 0) AS total_views
            FROM `commerce_live_sessions`
            WHERE shop_id = ? AND start_time >= ? AND start_time <= ?");
            $stmt->execute([$shopId, $date . ' 00:00:00', $date . ' 23:59:59']);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            return [
                'source_available' => true,
                'session_count' => (int)($row['session_count'] ?? 0),
                'total_gmv' => (float)($row['total_gmv'] ?? 0.0),
                'total_views' => (int)($row['total_views'] ?? 0),
            ];
        } catch (\Throwable $t) {
            return ['source_available' => false, 'session_count' => 0, 'total_gmv' => 0.0, 'total_views' => 0];
        }
    }

    /**
     * Queries real video analytics from commerce_video_analytics.
     */
    private function queryVideoAnalytics(string $shopId, string $date): array {
        if (!$this->tableExists('commerce_video_analytics')) {
            return ['source_available' => false, 'video_count' => 0, 'total_views' => 0, 'attributed_gmv' => 0.0];
        }

        try {
            $stmt = $this->db->prepare("SELECT
                COUNT(DISTINCT video_id) AS video_count,
                COALESCE(SUM(video_views), 0) AS total_views,
                COALESCE(SUM(attributed_gmv), 0) AS attributed_gmv
            FROM `commerce_video_analytics`
            WHERE shop_id = ? AND stat_date = ?");
            $stmt->execute([$shopId, $date]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            return [
                'source_available' => true,
                'video_count' => (int)($row['video_count'] ?? 0),
                'total_views' => (int)($row['total_views'] ?? 0),
                'attributed_gmv' => (float)($row['attributed_gmv'] ?? 0.0),
            ];
        } catch (\Throwable $t) {
            return ['source_available' => false, 'video_count' => 0, 'total_views' => 0, 'attributed_gmv' => 0.0];
        }
    }

    /**
     * Evaluates Red / Yellow / Green SOP flags.
     */
    private function evaluateAlerts(array $config, int $evalHour, array $metrics): array {
        $alerts = [];

        $redRoiThreshold = (float)$config['red_flag_roi_threshold'];
        $redSpendPct = (float)$config['red_flag_spend_pct'];
        $redMinClicks = (int)$config['red_flag_min_clicks'];
        $yellowHour = (int)$config['yellow_flag_hour'];
        $yellowSpendPct = (float)$config['yellow_flag_spend_pct'];
        $greenSpendPct = (float)$config['green_flag_spend_pct'];
        $greenTargetRoi = (float)$config['target_roi'] + (float)$config['green_flag_roi_buffer'];

        // 1. RED FLAG: Spend > 50% daily cap while ROI < 10 (Shop level)
        if (
            $metrics['total_spend'] > 0 &&
            $metrics['daily_spend_cap_pct'] > $redSpendPct &&
            $metrics['ads_roi'] !== null &&
            $metrics['ads_roi'] < $redRoiThreshold
        ) {
            $alerts[] = [
                'id' => 'red_shop_burn',
                'severity' => 'RED',
                'scope' => 'TOTAL_SHOP',
                'title' => 'Cảnh báo Đỏ: Tiêu ngân sách nhanh nhưng hiệu quả thu/chi thấp',
                'action_tag' => 'Xử lý dưới 30 phút: Kiểm tra giá, giỏ hàng & mã giảm giá',
                'message' => sprintf(
                    'Đã tiêu %.1f%% giới hạn chi/ngày nhưng hiệu quả thu/chi mới đạt %.2fx (dưới ngưỡng %.2fx). Cần kiểm tra ngay trong 30 phút: giá bán, giỏ hàng, mã giảm giá và tồn kho.',
                    $metrics['daily_spend_cap_pct'],
                    $metrics['ads_roi'],
                    $redRoiThreshold
                ),
            ];
        }

        // 2. RED FLAG: High traffic with 0 orders (Shop or Campaign level)
        if ($metrics['total_clicks'] >= $redMinClicks && $metrics['total_ads_orders'] === 0 && $metrics['total_orders'] === 0) {
            $alerts[] = [
                'id' => 'red_zero_orders_shop',
                'severity' => 'RED',
                'scope' => 'TOTAL_SHOP',
                'title' => 'Cảnh báo Đỏ: Lượt bấm cao nhưng chưa có đơn hàng',
                'action_tag' => 'Xử lý dưới 30 phút: Kiểm tra giá & giỏ hàng',
                'message' => sprintf(
                    'Toàn cửa hàng ghi nhận %d lượt bấm nhưng chưa có đơn hàng nào. Cần kiểm tra ngay giá bán, giỏ hàng và tồn kho sản phẩm.',
                    $metrics['total_clicks']
                ),
            ];
        }

        foreach ($metrics['campaigns'] as $camp) {
            if ($camp['clicks'] >= $redMinClicks && $camp['orders'] === 0) {
                $alerts[] = [
                    'id' => 'red_camp_zero_orders_' . $camp['campaign_id'],
                    'severity' => 'RED',
                    'scope' => 'CAMPAIGN',
                    'campaign_id' => $camp['campaign_id'],
                    'title' => 'Cảnh báo Đỏ Chiến dịch: Bấm nhiều nhưng 0 đơn (' . $camp['campaign_name'] . ')',
                    'action_tag' => 'Xử lý dưới 30 phút: Kiểm tra giá & giỏ hàng',
                    'message' => sprintf(
                        'Chiến dịch "%s" có %d lượt bấm nhưng chưa có đơn nào. Cần kiểm tra ngay giá bán, giỏ hàng và nội dung video/phiên Live.',
                        $camp['campaign_name'],
                        $camp['clicks']
                    ),
                ];
            }
        }

        // 3. YELLOW FLAG: Spend < 50% daily cap after 14:00
        if ($evalHour >= $yellowHour && $metrics['daily_spend_cap_pct'] < $yellowSpendPct) {
            $alerts[] = [
                'id' => 'yellow_slow_pacing_shop',
                'severity' => 'YELLOW',
                'scope' => 'TOTAL_SHOP',
                'title' => 'Cảnh báo Vàng: Tốc độ chi ngân sách chậm sau ' . sprintf('%02d:00', $yellowHour),
                'action_tag' => 'Kiểm tra mục tiêu hoàn vốn quá cao hoặc thiếu video mới',
                'message' => sprintf(
                    'Lúc %02d:00 mới tiêu %.1f%% giới hạn chi/ngày (dưới %.0f%%). Kiểm tra lại mức hoàn vốn mục tiêu (%.1fx) có bị đặt quá cao hoặc đang thiếu video mới.',
                    $evalHour,
                    $metrics['daily_spend_cap_pct'],
                    $yellowSpendPct,
                    $config['target_roi']
                ),
            ];
        }

        if ($evalHour >= $yellowHour && $config['video_daily_spend_cap'] > 0 && $metrics['video_spend_cap_pct'] < $yellowSpendPct) {
            $alerts[] = [
                'id' => 'yellow_slow_pacing_video',
                'severity' => 'YELLOW',
                'scope' => 'VIDEO_CHANNEL',
                'title' => 'Cảnh báo Vàng Kênh Video: Tiền chạy chậm',
                'action_tag' => 'Kiểm tra mục tiêu hoàn vốn hoặc bổ sung video mới',
                'message' => sprintf(
                    'Kênh Video & Sản phẩm mới tiêu %.1f%% giới hạn chi/ngày sau %02d:00. Nên hạ nhẹ mục tiêu hoàn vốn (%.1fx) hoặc nạp thêm video mới.',
                    $metrics['video_spend_cap_pct'],
                    $yellowHour,
                    $config['video_target_roi']
                ),
            ];
        }

        // 4. GREEN FLAG: ROI > target + buffer (e.g., 15) and spend near/at cap
        if (
            $metrics['total_spend'] > 0 &&
            $metrics['daily_spend_cap_pct'] >= $greenSpendPct &&
            $metrics['ads_roi'] !== null &&
            $metrics['ads_roi'] >= $greenTargetRoi
        ) {
            $alerts[] = [
                'id' => 'green_scale_shop',
                'severity' => 'GREEN',
                'scope' => 'TOTAL_SHOP',
                'title' => 'Tín hiệu Xanh: Hiệu quả vượt mục tiêu — Sẵn sàng mở rộng',
                'action_tag' => 'Đề xuất tăng 10–20% ngân sách',
                'message' => sprintf(
                    'Hiệu quả thu/chi đạt %.2fx (vượt ngưỡng %.2fx) và đã tiêu %.1f%% giới hạn chi/ngày. Đề xuất xin tăng thêm 10–20%% ngân sách.',
                    $metrics['ads_roi'],
                    $greenTargetRoi,
                    $metrics['daily_spend_cap_pct']
                ),
            ];
        }

        $videoGreenRoi = (float)$config['video_target_roi'] + (float)$config['green_flag_roi_buffer'];
        if (
            $metrics['video_spend'] > 0 &&
            $metrics['video_spend_cap_pct'] >= $greenSpendPct &&
            $metrics['video_roi'] !== null &&
            $metrics['video_roi'] >= $videoGreenRoi
        ) {
            $alerts[] = [
                'id' => 'green_scale_video',
                'severity' => 'GREEN',
                'scope' => 'VIDEO_CHANNEL',
                'title' => 'Tín hiệu Xanh Kênh Video: Hiệu quả cao & gần chạm trần chi',
                'action_tag' => 'Đề xuất tăng 10–20% ngân sách',
                'message' => sprintf(
                    'Kênh Video đạt hiệu quả %.2fx (ngưỡng %.2fx) ở mức %.1f%% giới hạn chi. Đề xuất tăng ngân sách 10–20%%.',
                    $metrics['video_roi'],
                    $videoGreenRoi,
                    $metrics['video_spend_cap_pct']
                ),
            ];
        }

        if (empty($alerts)) {
            $alerts[] = [
                'id' => 'on_track',
                'severity' => 'INFO',
                'scope' => 'TOTAL_SHOP',
                'title' => 'Đang đi đúng hướng',
                'action_tag' => 'Tiếp tục theo dõi',
                'message' => $metrics['total_spend'] > 0
                    ? sprintf(
                        'Cửa hàng đã tiêu %.1f%% giới hạn chi/ngày với hiệu quả thu/chi %.2fx. Chưa phát hiện cảnh báo Đỏ hoặc Vàng.',
                        $metrics['daily_spend_cap_pct'],
                        $metrics['ads_roi'] ?? 0.0
                    )
                    : 'Chưa ghi nhận chi tiêu quảng cáo trong ngày được chọn. Hãy kiểm tra đồng bộ dữ liệu hoặc trạng thái chiến dịch.',
            ];
        }

        return $alerts;
    }

    /**
     * Generates a ready-to-copy 09:30 Morning Briefing text block.
     */
    private function buildMorningBriefing(
        string $date,
        int $evalHour,
        array $config,
        array $m,
        array $alerts
    ): string {
        $fmtVnd = static fn(float $val): string => number_format($val, 0, ',', '.') . 'đ';
        $fmtRoi = static fn(?float $val): string => $val !== null ? number_format($val, 2) . 'x' : 'N/A';

        $topAlert = $alerts[0] ?? null;
        $alertLine = $topAlert
            ? sprintf('[%s] %s — %s', $topAlert['severity'], $topAlert['title'], $topAlert['action_tag'])
            : 'Đang đi đúng hướng';

        $lines = [
            "📊 [BÁO CÁO SÁNG 09:30] TikTok Shop — Ngày {$date} (Cập nhật {$evalHour}:00)",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "1. MỤC TIÊU & TIẾN ĐỘ TOÀN CỬA HÀNG:",
            "• Doanh số ngày: {$fmtVnd($m['total_shop_gmv'])} / {$fmtVnd($config['daily_gmv_target'])} ({$m['daily_gmv_pacing_pct']}%) | Đơn hàng: {$m['total_shop_orders']}",
            "• Doanh số từ đầu tháng: {$fmtVnd($m['mtd_gmv'])} / {$fmtVnd($config['monthly_gmv_target'])} ({$m['monthly_gmv_pacing_pct']}%)",
            "• Chi tiêu quảng cáo: {$fmtVnd($m['total_spend'])} / Giới hạn chi {$fmtVnd($config['daily_spend_cap'])} ({$m['daily_spend_cap_pct']}%)",
            "• Hiệu quả thu/chi thực tế (Quảng cáo / Toàn shop): {$fmtRoi($m['ads_roi'])} / {$fmtRoi($m['shop_roi'])} (Mục tiêu: {$config['target_roi']}x)",
            "",
            "2. PHÂN BỔ KÊNH ({$config['video_split_pct']}% Video & Tiếp thị liên kết / {$config['live_split_pct']}% Livestream):",
            "• Kênh Video & Tiếp thị liên kết ({$config['video_split_pct']}%): Đã chi {$fmtVnd($m['video_spend'])} / {$fmtVnd($config['video_daily_spend_cap'])} | Doanh số {$fmtVnd($m['video_ads_gmv'])} | Hiệu quả {$fmtRoi($m['video_roi'])} (Mục tiêu {$config['video_target_roi']}x)",
            "  ↳ Tỷ trọng sản phẩm: Sản phẩm chính '{$config['main_sku_keyword']}' ({$config['main_sku_split_pct']}%) = {$fmtVnd($m['main_sku_gmv'])} | Sản phẩm phụ ({$config['sub_sku_split_pct']}%) = {$fmtVnd($m['sub_sku_gmv'])}",
            "• Kênh Livestream ({$config['live_split_pct']}% - {$config['live_sessions_per_day']} phiên/ngày): Đã chi {$fmtVnd($m['live_spend'])} / {$fmtVnd($config['live_daily_spend_cap'])} | Doanh số {$fmtVnd($m['live_gmv'])} | Hiệu quả {$fmtRoi($m['live_roi'])} (Mục tiêu {$config['live_target_roi']}x) | Số phiên hôm nay: {$m['live_sessions_count']}/{$config['live_sessions_per_day']}",
            "",
            "3. CẢNH BÁO & HÀNH ĐỘNG:",
            "• {$alertLine}",
        ];

        return implode("\n", $lines);
    }

    /**
     * Returns 7-bucket video status breakdown + target quotas + content guidance for a campaign.
     */
    public function getCampaignVideoBreakdown(string $shopId, string $campaignId, ?string $date = null): array {
        $targetDate = ($date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) ? $date : date('Y-m-d');
        $config = $this->getConfig($shopId);
        $videoTargetRoi = (float)$config['video_target_roi'];

        $counts = [
            'total_videos' => 0,
            'outstanding' => 0,
            'effective' => 0,
            'exploring' => 0,
            'ineffective' => 0,
            'not_delivering' => 0,
            'violating' => 0,
        ];
        $sourceTable = 'NONE';
        $videos = [];

        if ($this->tableExists('commerce_ads_creative_daily')) {
            try {
                $stmt = $this->db->prepare("SELECT
                    item_id,
                    MAX(creative_delivery_status_raw) AS raw_status,
                    MAX(creative_delivery_status_normalized) AS norm_status,
                    COALESCE(SUM(cost), 0) AS spend,
                    COALESCE(SUM(ads_gross_revenue), 0) AS ads_gmv,
                    COALESCE(SUM(orders), 0) AS orders,
                    AVG(api_roi) AS avg_api_roi
                FROM `commerce_ads_creative_daily`
                WHERE shop_id = ? AND campaign_id = ? AND stat_date = ?
                GROUP BY item_id
                ORDER BY spend DESC");
                $stmt->execute([$shopId, $campaignId, $targetDate]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if (!empty($rows)) {
                    $sourceTable = 'commerce_ads_creative_daily';
                    foreach ($rows as $r) {
                        $spend = (float)($r['spend'] ?? 0.0);
                        $gmv = (float)($r['ads_gmv'] ?? 0.0);
                        $orders = (int)($r['orders'] ?? 0);
                        $roi = $spend > 0 ? round($gmv / $spend, 2) : (float)($r['avg_api_roi'] ?? 0.0);
                        $rawSt = strtoupper((string)($r['raw_status'] ?? ''));
                        $normSt = strtoupper((string)($r['norm_status'] ?? ''));
                        $combinedSt = $rawSt . ' ' . $normSt;

                        $bucket = 'not_delivering';
                        if (
                            strpos($combinedSt, 'VIOLAT') !== false ||
                            strpos($combinedSt, 'REJECT') !== false ||
                            strpos($combinedSt, 'DISAPPROVED') !== false ||
                            strpos($combinedSt, 'AUDIT_FAIL') !== false ||
                            strpos($combinedSt, 'BAN') !== false
                        ) {
                            $bucket = 'violating';
                        } elseif ($spend > 0 && $orders > 0 && $roi >= $videoTargetRoi) {
                            $bucket = 'outstanding';
                        } elseif ($spend > 0 && $orders > 0) {
                            $bucket = 'effective';
                        } elseif (
                            $spend > 0 &&
                            $orders === 0 &&
                            (strpos($combinedSt, 'EXPLOR') !== false || strpos($combinedSt, 'LEARN') !== false || strpos($combinedSt, 'DELIVER') !== false)
                        ) {
                            $bucket = 'exploring';
                        } elseif ($spend > 0 && $orders === 0) {
                            $bucket = 'ineffective';
                        }

                        $counts['total_videos']++;
                        $counts[$bucket]++;
                        $videos[] = [
                            'video_id' => (string)$r['item_id'],
                            'status' => $bucket,
                            'raw_status' => $rawSt,
                            'spend' => round($spend, 2),
                            'ads_gmv' => round($gmv, 2),
                            'orders' => $orders,
                            'roi' => $spend > 0 ? $roi : null,
                        ];
                    }
                }
            } catch (\Throwable $t) {}
        }

        if ($counts['total_videos'] === 0 && $this->tableExists('tiktok_video_ads')) {
            try {
                $stmt = $this->db->prepare("SELECT
                    video_id,
                    delivery_status,
                    delivery_group,
                    COALESCE(spend, 0) AS spend,
                    COALESCE(gmv, 0) AS ads_gmv,
                    COALESCE(orders, 0) AS orders
                FROM `tiktok_video_ads`
                WHERE campaign_id = ?");
                $stmt->execute([$campaignId]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($rows)) {
                    $sourceTable = 'tiktok_video_ads';
                    foreach ($rows as $r) {
                        $spend = (float)($r['spend'] ?? 0.0);
                        $gmv = (float)($r['ads_gmv'] ?? 0.0);
                        $orders = (int)($r['orders'] ?? 0);
                        $roi = $spend > 0 ? round($gmv / $spend, 2) : 0.0;
                        $st = strtoupper((string)($r['delivery_status'] ?? ''));

                        $bucket = 'not_delivering';
                        if (strpos($st, 'VIOLAT') !== false || strpos($st, 'REJECT') !== false) {
                            $bucket = 'violating';
                        } elseif ($spend > 0 && $orders > 0 && $roi >= $videoTargetRoi) {
                            $bucket = 'outstanding';
                        } elseif ($spend > 0 && $orders > 0) {
                            $bucket = 'effective';
                        } elseif ($spend > 0 && $orders === 0) {
                            $bucket = (strpos($st, 'EXPLOR') !== false) ? 'exploring' : 'ineffective';
                        }

                        $counts['total_videos']++;
                        $counts[$bucket]++;
                    }
                }
            } catch (\Throwable $t) {}
        }

        return [
            'shop_id' => $shopId,
            'campaign_id' => $campaignId,
            'stat_date' => $targetDate,
            'source_table' => $sourceTable,
            'counts' => $counts,
            'targets' => [
                'total_active_min' => 50,
                'outstanding_min' => 5,
                'effective_min' => 15,
                'exploring_min' => 15,
                'new_videos_per_day' => '10–15 video mới/ngày',
                'ineffective_spend_pct_max' => 10,
                'violating_max' => 0,
            ],
            'content_guidance' => [
                '3 giây đầu (Hook): Mở đầu bằng nỗi đau nóng trong, nổi mề đay, men gan cao hoặc hình ảnh viên sủi tan sủi bọt bắt mắt để giữ chân người xem.',
                'Gắn Combo 2–3 hộp: Điều hướng rõ ưu đãi mua 2 hộp / 3 hộp trong video để đẩy giá trị đơn hàng trung bình lên 100.000đ–150.000đ.',
                'Né từ khóa vi phạm TPBVSK: Tránh tuyệt đối các từ khẳng định "chữa khỏi", "đặc trị", "cam kết 100%", "thay thế thuốc" trong lời thoại và chữ trên màn hình.',
            ],
            'top_videos' => array_slice($videos, 0, 15),
        ];
    }

    /**
     * Returns the 8 LIVE session KPIs for Session 1 (Ca 1) and Session 2 (Ca 2) vs targets.
     */
    public function getCampaignLiveDetail(string $shopId, string $campaignId, ?string $date = null): array {
        $targetDate = ($date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) ? $date : date('Y-m-d');
        $config = $this->getConfig($shopId);
        $perSessionCap = $config['live_sessions_per_day'] > 0
            ? round($config['live_daily_spend_cap'] / $config['live_sessions_per_day'], 2)
            : $config['live_daily_spend_cap'];

        $campAds = [
            'impressions' => 0,
            'clicks' => 0,
            'spend' => 0.0,
            'ads_gmv' => 0.0,
            'orders' => 0,
        ];

        if ($this->tableExists('commerce_ads_campaign_daily')) {
            try {
                $stmt = $this->db->prepare("SELECT
                    COALESCE(SUM(impressions), 0) AS impressions,
                    COALESCE(SUM(clicks), 0) AS clicks,
                    COALESCE(SUM(spend), 0) AS spend,
                    COALESCE(SUM(gross_revenue), 0) AS ads_gmv,
                    COALESCE(SUM(orders), 0) AS orders
                FROM `commerce_ads_campaign_daily`
                WHERE shop_id = ? AND campaign_id = ? AND stat_date = ?");
                $stmt->execute([$shopId, $campaignId, $targetDate]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $campAds = [
                        'impressions' => (int)($row['impressions'] ?? 0),
                        'clicks' => (int)($row['clicks'] ?? 0),
                        'spend' => (float)($row['spend'] ?? 0.0),
                        'ads_gmv' => (float)($row['ads_gmv'] ?? 0.0),
                        'orders' => (int)($row['orders'] ?? 0),
                    ];
                }
            } catch (\Throwable $t) {}
        }

        $sessionsRaw = [];
        if ($this->tableExists('commerce_live_sessions')) {
            try {
                $stmtS = $this->db->prepare("SELECT
                    session_id, title, start_time, end_time,
                    COALESCE(impressions, 0) AS impressions,
                    COALESCE(clicks, 0) AS clicks,
                    COALESCE(gmv, 0) AS gmv,
                    COALESCE(orders_count, 0) AS orders_count,
                    COALESCE(total_views, 0) AS total_views
                FROM `commerce_live_sessions`
                WHERE shop_id = ? AND start_time >= ? AND start_time <= ?
                ORDER BY start_time ASC");
                $stmtS->execute([$shopId, $targetDate . ' 00:00:00', $targetDate . ' 23:59:59']);
                $sessionsRaw = $stmtS->fetchAll(PDO::FETCH_ASSOC);
            } catch (\Throwable $t) {}
        }

        $buildSlot = static function (string $label, int $impr, float $spend, int $clicks, ?float $cartRate, int $orders, float $gmv, float $cap) use ($config): array {
            $cpm = $impr > 0 ? round(($spend / $impr) * 1000.0, 2) : null;
            $liveCtr = $impr > 0 ? round(($clicks / $impr) * 100.0, 2) : null;
            $orderCvr = $clicks > 0 ? round(($orders / $clicks) * 100.0, 2) : null;
            $roi = $spend > 0 ? round($gmv / $spend, 2) : null;
            $spendPct = $cap > 0 ? round(($spend / $cap) * 100.0, 1) : 0.0;

            return [
                'label' => $label,
                'impressions' => $impr,
                'spend' => round($spend, 2),
                'spend_cap' => round($cap, 2),
                'spend_pct_of_cap' => $spendPct,
                'reached_60_pct_cap' => $spendPct >= 60.0,
                'cpm' => $cpm,
                'live_ctr_pct' => $liveCtr,
                'cart_click_rate_pct' => $cartRate,
                'order_cvr_pct' => $orderCvr,
                'orders' => $orders,
                'gmv' => round($gmv, 2),
                'target_gmv' => $config['live_per_session_gmv_target'],
                'roi' => $roi,
                'target_roi' => $config['live_target_roi'],
            ];
        };

        $ca1Sess = $sessionsRaw[0] ?? null;
        $ca2Sess = $sessionsRaw[1] ?? null;

        $ca1 = $buildSlot(
            'Ca 1 (Sáng / Trưa)',
            (int)($ca1Sess['impressions'] ?? 0),
            $ca1Sess ? round($campAds['spend'] * (count($sessionsRaw) > 1 ? 0.5 : 1.0), 2) : 0.0,
            (int)($ca1Sess['clicks'] ?? 0),
            null,
            (int)($ca1Sess['orders_count'] ?? 0),
            (float)($ca1Sess['gmv'] ?? 0.0),
            $perSessionCap
        );

        $ca2 = $buildSlot(
            'Ca 2 (Chiều / Tối)',
            (int)($ca2Sess['impressions'] ?? 0),
            $ca2Sess ? round($campAds['spend'] * 0.5, 2) : 0.0,
            (int)($ca2Sess['clicks'] ?? 0),
            null,
            (int)($ca2Sess['orders_count'] ?? 0),
            (float)($ca2Sess['gmv'] ?? 0.0),
            $perSessionCap
        );

        $totalSlot = $buildSlot(
            'Tổng cả ngày',
            $campAds['impressions'],
            $campAds['spend'],
            $campAds['clicks'],
            null,
            $campAds['orders'],
            $campAds['ads_gmv'],
            $config['live_daily_spend_cap']
        );

        return [
            'shop_id' => $shopId,
            'campaign_id' => $campaignId,
            'stat_date' => $targetDate,
            'sessions_found' => count($sessionsRaw),
            'slots' => [
                'ca_1' => $ca1,
                'ca_2' => $ca2,
                'total' => $totalSlot,
            ],
            'targets' => [
                'spend_milestone_pct' => 60.0,
                'cpm_max' => 40000,
                'live_ctr_min_pct' => 3.0,
                'cart_click_rate_min_pct' => 8.0,
                'order_cvr_min_pct' => 2.5,
                'per_session_gmv_target' => $config['live_per_session_gmv_target'],
                'target_roi' => $config['live_target_roi'],
            ],
        ];
    }
}
