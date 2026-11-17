<?php
date_default_timezone_set('Asia/Ho_Chi_Minh');

// Include environment configuration and security guard
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_guard.php';

// Hàm kết nối DB bằng PDO
function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_TIMEOUT            => 4,
        ];
        return new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        sanitizeErrorResponse($e, 'Lỗi kết nối cơ sở dữ liệu. Vui lòng liên hệ quản trị viên.');
    }
}

// Tự động khởi tạo cấu trúc bảng nếu chưa tồn tại (Auto-installation)
function initializeDatabase() {
    static $alreadyInitialized = false;
    if ($alreadyInitialized) return;
    $alreadyInitialized = true;

    $db = getDBConnection();
    
    // Nếu bảng chính đã tồn tại, kiểm tra xem bảng daily reports và các cột mới đã có chưa
    try {
        $checkDaily = $db->query("SHOW TABLES LIKE 'tiktok_campaign_daily_reports'")->fetch();
        if (!$checkDaily) {
            $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_campaign_daily_reports` (
                `id` int(11) NOT NULL AUTO_INCREMENT,
                `campaign_id` varchar(100) NOT NULL,
                `stat_date` date NOT NULL,
                `spend` decimal(15,2) NOT NULL DEFAULT '0.00',
                `gmv` decimal(15,2) NOT NULL DEFAULT '0.00',
                `orders` int(11) NOT NULL DEFAULT '0',
                `roi` decimal(5,2) NOT NULL DEFAULT '0.00',
                `cpa` decimal(15,2) NOT NULL DEFAULT '0.00',
                `total_videos` int(11) NOT NULL DEFAULT '0',
                `active_videos` int(11) NOT NULL DEFAULT '0',
                `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `idx_camp_date` (`campaign_id`, `stat_date`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
            
            try { $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `delivery_group` varchar(50) DEFAULT 'explored'"); } catch (Exception $e) {}
            try { $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `delivery_status` varchar(50) DEFAULT 'effective'"); } catch (Exception $e) {}
            try { $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `why_spending` text NULL"); } catch (Exception $e) {}
            try { $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `why_not_spending` text NULL"); } catch (Exception $e) {}
            try { $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `retention_6s` decimal(5,2) DEFAULT 0.00"); } catch (Exception $e) {}
        }
        
        // Bảng lưu trữ checklist nhiệm vụ cải thiện theo từng shop
        $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_shop_checklists` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `shop_id` varchar(100) NOT NULL,
            `task_code` varchar(50) NOT NULL,
            `category` varchar(100) NOT NULL,
            `title` varchar(255) NOT NULL,
            `description` text NULL,
            `purpose` text NULL,
            `assignee` varchar(100) DEFAULT 'Seller',
            `frequency` varchar(50) DEFAULT 'Hàng ngày',
            `priority` varchar(10) DEFAULT 'P1',
            `status` varchar(20) DEFAULT 'todo',
            `notes` text NULL,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `idx_shop_task` (`shop_id`, `task_code`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        
        // Bảng lưu trữ Snapshot đồng bộ từ TikTok Seller Center qua Extension
        $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_seller_center_snapshots` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `shop_id` varchar(100) NOT NULL,
            `snapshot_date` date NOT NULL,
            `period_days` int(11) NOT NULL DEFAULT 30,
            `period_start` date DEFAULT NULL,
            `period_end` date DEFAULT NULL,
            `extraction_profile` varchar(50) DEFAULT 'seller_center_compass_overview',
            `total_gmv` decimal(15,2) DEFAULT '0.00',
            `total_revenue` decimal(15,2) DEFAULT NULL,
            `total_orders` int(11) DEFAULT 0,
            `items_sold` int(11) DEFAULT NULL,
            `sku_orders` int(11) DEFAULT NULL,
            `live_gmv` decimal(15,2) DEFAULT NULL,
            `video_gmv` decimal(15,2) DEFAULT NULL,
            `product_card_gmv` decimal(15,2) DEFAULT NULL,
            `affiliate_gmv` decimal(15,2) DEFAULT '0.00',
            `brand_video_gmv` decimal(15,2) DEFAULT '0.00',
            `page_views` bigint(20) DEFAULT 0,
            `unique_visitors` bigint(20) DEFAULT 0,
            `cvr` decimal(5,2) DEFAULT '0.00',
            `live_ctor` decimal(5,2) DEFAULT '0.00',
            `live_sessions_count` int(11) DEFAULT 0,
            `raw_data` longtext NULL,
            `captured_at` timestamp NULL DEFAULT NULL,
            `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_shop_date` (`shop_id`, `snapshot_date`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        
        // Bảng lưu trữ Video Analytics từ TikTok Shop Open API
        $db->exec("CREATE TABLE IF NOT EXISTS `commerce_video_analytics` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_shop',
            `shop_id` VARCHAR(64) NOT NULL,
            `video_id` VARCHAR(128) NOT NULL,
            `stat_date` DATE NOT NULL,
            `title` VARCHAR(512) NULL DEFAULT NULL,
            `cover_url` VARCHAR(1024) NULL DEFAULT NULL,
            `video_url` VARCHAR(1024) NULL DEFAULT NULL,
            `duration_seconds` INT UNSIGNED NOT NULL DEFAULT 0,
            `video_post_time` DATETIME NULL DEFAULT NULL,
            `creator_type` VARCHAR(64) NOT NULL DEFAULT 'OFFICIAL',
            `creator_name` VARCHAR(128) NULL DEFAULT NULL,
            `video_views` INT UNSIGNED NOT NULL DEFAULT 0,
            `units_sold` INT UNSIGNED NOT NULL DEFAULT 0,
            `gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
            `attributed_gmv` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
            `ctr` DECIMAL(7,4) NOT NULL DEFAULT '0.0000',
            `comments_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `shares_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `likes_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `gpm` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
            `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
            `raw_data_hash` VARCHAR(64) NULL DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_shop_video_stat` (`platform`, `shop_id`, `video_id`, `stat_date`),
            KEY `idx_stat_date` (`stat_date`),
            KEY `idx_shop_date` (`shop_id`, `stat_date`),
            KEY `idx_video_id` (`video_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        try { $db->exec("ALTER TABLE `commerce_video_analytics` ADD COLUMN `cover_url` VARCHAR(1024) NULL DEFAULT NULL AFTER `title`"); } catch (Exception $e) {}
        try { $db->exec("ALTER TABLE `commerce_video_analytics` ADD COLUMN `video_url` VARCHAR(1024) NULL DEFAULT NULL AFTER `cover_url`"); } catch (Exception $e) {}
    } catch (Exception $e) {}
    
    // 1. Bảng lưu trữ cấu hình kết nối TikTok Shop
    $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_config` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `shop_id` varchar(100) DEFAULT NULL,
        `access_token` text DEFAULT NULL,
        `refresh_token` text DEFAULT NULL,
        `expires_at` bigint(20) DEFAULT NULL,
        `app_key` varchar(100) DEFAULT NULL,
        `app_secret` varchar(100) DEFAULT NULL,
        `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        `ads_access_token` text DEFAULT NULL,
        `ads_refresh_token` text DEFAULT NULL,
        `ads_expires_at` bigint(20) DEFAULT NULL,
        `ads_app_id` varchar(100) DEFAULT NULL,
        `ads_app_secret` text DEFAULT NULL,
        `advertiser_id` varchar(100) DEFAULT NULL,
        `last_total_shop_gmv` decimal(15,2) NULL DEFAULT NULL,
        `last_total_shop_orders` int(11) NULL DEFAULT NULL,
        `gemini_api_key` text DEFAULT NULL,
        `target_ad_gmv` decimal(15,2) DEFAULT '50000000.00',
        `target_ad_spend` decimal(15,2) DEFAULT '3500000.00',
        `target_ad_roas` decimal(5,2) DEFAULT '14.28',
        `target_ad_cost_ratio` decimal(5,2) DEFAULT '7.00',
        `ses_score` decimal(3,2) NULL DEFAULT NULL,
        `ses_product_score` decimal(3,2) NULL DEFAULT NULL,
        `ses_product_weight` decimal(5,2) NOT NULL DEFAULT '70.00',
        `ses_negative_review_rate` decimal(5,2) NULL DEFAULT NULL,
        `ses_return_refund_rate` decimal(5,2) NULL DEFAULT NULL,
        `ses_logistics_score` decimal(3,2) NULL DEFAULT NULL,
        `ses_logistics_weight` decimal(5,2) NOT NULL DEFAULT '15.00',
        `ses_fast_dispatch_rate` decimal(5,2) NULL DEFAULT NULL,
        `ses_seller_cancel_rate` decimal(5,2) NULL DEFAULT NULL,
        `ses_service_score` decimal(3,2) NULL DEFAULT NULL,
        `ses_service_weight` decimal(5,2) NOT NULL DEFAULT '15.00',
        `ses_aftersales_hours` decimal(5,2) NULL DEFAULT NULL,
        `ses_chat_response_rate` decimal(5,2) NULL DEFAULT NULL,
        `last_synced_seller_center_at` timestamp NULL DEFAULT NULL,
        `seller_center_data` longtext NULL DEFAULT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `idx_shop` (`shop_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Dọn dẹp bất kỳ dòng cấu hình lỗi nào (shop_id null hoặc rỗng) được tạo ra từ trước đó
    try {
        $db->exec("DELETE FROM `tiktok_config` WHERE `shop_id` IS NULL OR `shop_id` = ''");
    } catch (Exception $e) {}

    // 2. Bảng lưu trữ danh sách chiến dịch GMV Max & LIVE GMV Max
    $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_campaigns` (
        `id` varchar(100) NOT NULL,
        `name` varchar(255) NOT NULL,
        `type` varchar(50) NOT NULL,
        `budget` decimal(15,2) NOT NULL DEFAULT '0.00',
        `spend` decimal(15,2) NOT NULL DEFAULT '0.00',
        `clicks` int(11) NOT NULL DEFAULT '0',
        `impressions` int(11) NOT NULL DEFAULT '0',
        `conversions` int(11) NOT NULL DEFAULT '0',
        `ad_gmv` decimal(15,2) NOT NULL DEFAULT '0.00',
        `target_roas` decimal(5,2) NOT NULL DEFAULT '6.00',
        `status` tinyint(1) NOT NULL DEFAULT '1',
        `created_date` date NOT NULL,
        `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    try {
        $db->exec("ALTER TABLE `tiktok_campaigns` ADD COLUMN `target_roas` decimal(5,2) NOT NULL DEFAULT '6.00'");
    } catch (Exception $e) {}

    // 3. Bảng lưu trữ cấu hình quy tắc tối ưu tự động (Automation Rules)
    $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_rules` (
        `id` varchar(100) NOT NULL,
        `name` varchar(255) NOT NULL,
        `campaign_type` varchar(50) NOT NULL,
        `trigger_cond` varchar(255) NOT NULL,
        `action_taken` varchar(255) NOT NULL,
        `frequency` varchar(50) NOT NULL,
        `status` tinyint(1) NOT NULL DEFAULT '1',
        `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 4. Bảng lưu trữ nhật ký hoạt động (Audit Logs) của Rules Engine
    $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_audit_logs` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `log_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `rule_name` varchar(255) NOT NULL,
        `campaign_name` varchar(255) NOT NULL,
        `trigger_value` varchar(255) NOT NULL,
        `result` varchar(255) NOT NULL,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Đảm bảo nâng cấp cột result trong tiktok_audit_logs lên TEXT để lưu được các lỗi dài từ API
    try {
        $db->exec("ALTER TABLE `tiktok_audit_logs` MODIFY `result` text NOT NULL");
    } catch (Exception $e) {}

    // 5. Bảng lưu trữ danh sách Video Quảng cáo (Creative Video Stats)
    $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_video_ads` (
        `id` varchar(100) NOT NULL,
        `campaign_id` varchar(100) NOT NULL,
        `title` varchar(255) NOT NULL,
        `spend` decimal(15,2) NOT NULL DEFAULT '0.00',
        `views` int(11) NOT NULL DEFAULT '0',
        `clicks` int(11) NOT NULL DEFAULT '0',
        `ctr` decimal(5,2) NOT NULL DEFAULT '0.00',
        `cvr` decimal(5,2) NOT NULL DEFAULT '0.00',
        `conversions` int(11) NOT NULL DEFAULT '0',
        `gmv` decimal(15,2) NOT NULL DEFAULT '0.00',
        `thumbnail` text DEFAULT NULL,
        `video_url` text DEFAULT NULL,
        `author_name` varchar(255) DEFAULT NULL,
        `status_quadrant` varchar(50) DEFAULT 'testing',
        `action_recommendation` varchar(50) DEFAULT 'wait',
        `cpm` decimal(15,2) DEFAULT '0.00',
        `cpc` decimal(15,2) DEFAULT '0.00',
        `frequency` decimal(5,2) DEFAULT '1.00',
        `target_roas` decimal(5,2) DEFAULT '6.00',
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` MODIFY `thumbnail` text NULL");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `video_url` text NULL AFTER `thumbnail`");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `author_name` varchar(255) NULL AFTER `video_url`");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `trend_status` varchar(50) DEFAULT 'stable'");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `yesterday_orders` int(11) DEFAULT 0");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `today_orders` int(11) DEFAULT 0");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `seven_days_orders` int(11) DEFAULT 0");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `thirty_days_orders` int(11) DEFAULT 0");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `seven_days_roas` decimal(5,2) DEFAULT 0.00");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `thirty_days_roas` decimal(5,2) DEFAULT 0.00");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `hook_rate` decimal(5,2) DEFAULT 0.00");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `status_quadrant` varchar(50) DEFAULT 'testing'");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `action_recommendation` varchar(50) DEFAULT 'wait'");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `cpm` decimal(15,2) DEFAULT 0.00");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `cpc` decimal(15,2) DEFAULT 0.00");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `frequency` decimal(5,2) DEFAULT 1.00");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `target_roas` decimal(5,2) DEFAULT 6.00");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `created_at` timestamp DEFAULT CURRENT_TIMESTAMP");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `script_type` varchar(50) DEFAULT 'lifestyle'");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `script_hook_summary` text NULL");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `total_orders` int(11) DEFAULT 0");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `cancelled_orders` int(11) DEFAULT 0");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `cancel_rate` decimal(5,2) DEFAULT 0.00");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `cancelled_gmv` decimal(15,2) DEFAULT 0.00");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `cancel_risk_level` varchar(20) DEFAULT 'safe'");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_video_ads` ADD COLUMN `cancel_reason_notes` text NULL");
    } catch (Exception $e) {}
    try {
        $db->exec("CREATE INDEX `idx_camp_quadrant` ON `tiktok_video_ads` (`campaign_id`, `status_quadrant`)");
    } catch (Exception $e) {}
    try {
        $db->exec("CREATE INDEX `idx_script_risk` ON `tiktok_video_ads` (`script_type`, `cancel_risk_level`)");
    } catch (Exception $e) {}

    // 6. Bảng lưu trữ đơn hàng TikTok Shop để tính doanh số sàn (Shop GMV)
    $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_orders` (
        `id` varchar(100) NOT NULL,
        `create_time` bigint(20) NOT NULL,
        `status` varchar(100) NOT NULL,
        `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
        `quantity` int(11) NOT NULL DEFAULT '0',
        `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_create_time` (`create_time`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 7. Bảng lưu trữ chi tiết các ca Livestream (TikTok Live Streamer Workbench)
    $db->exec("CREATE TABLE IF NOT EXISTS `tiktok_live_sessions` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `room_id` varchar(100) NOT NULL,
        `campaign_id` varchar(100) DEFAULT NULL,
        `channel_name` varchar(100) DEFAULT 'duocphamaddp',
        `duration` varchar(100) DEFAULT NULL,
        `start_time` varchar(100) DEFAULT NULL,
        `end_time` varchar(100) DEFAULT NULL,
        `gmv` decimal(15,2) DEFAULT 0.00,
        `ad_spend` decimal(15,2) DEFAULT 0.00,
        `orders` int(11) DEFAULT 0,
        `viewers` int(11) DEFAULT 0,
        `impressions` int(11) DEFAULT 0,
        `views` int(11) DEFAULT 0,
        `gmv_per_hour` decimal(15,2) DEFAULT 0.00,
        `gpm` decimal(15,2) DEFAULT 0.00,
        `avg_watch_time` varchar(50) DEFAULT '1m 01s',
        `comment_rate` decimal(5,2) DEFAULT 0.00,
        `follow_rate` decimal(5,2) DEFAULT 0.00,
        `enter_room_rate` decimal(5,2) DEFAULT 0.00,
        `click_rate` decimal(5,2) DEFAULT 0.00,
        `ctr_live` decimal(5,2) DEFAULT 0.00,
        `sku_order_rate` decimal(5,2) DEFAULT 0.00,
        `share_rate` decimal(5,2) DEFAULT 0.00,
        `like_rate` decimal(5,2) DEFAULT 0.00,
        `view_gt_1min` int(11) DEFAULT 0,
        `traffic_sources` text DEFAULT NULL,
        `top_products` text DEFAULT NULL,
        `audience_profile` text DEFAULT NULL,
        `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `idx_room_id` (`room_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Dọn dẹp bản ghi trùng lặp trong tiktok_live_sessions theo room_id nếu có
    try {
        $db->exec("DELETE t1 FROM `tiktok_live_sessions` t1 INNER JOIN `tiktok_live_sessions` t2 WHERE t1.id > t2.id AND t1.room_id = t2.room_id");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE `tiktok_live_sessions` ADD UNIQUE KEY `idx_room_id` (`room_id`)");
    } catch (Exception $e) {}

    // Tự động nạp/cập nhật dữ liệu phiên Live thực tế (Chuẩn xác 100% từ TikTok Shop Streamer Desktop)
    try {
        $trafficJson4th = json_encode([
            'live_feed' => ['name' => 'Bảng tin Đề xuất', 'gmv_pct' => 47.56, 'imps_pct' => 79.0, 'views_pct' => 58.85],
            'profile_click' => ['name' => 'Lượt nhấn vào hồ sơ', 'gmv_pct' => 35.98, 'imps_pct' => 40.16, 'views_pct' => 10.16],
            'live_preview' => ['name' => 'Bản xem trước LIVE', 'gmv_pct' => 11.58, 'imps_pct' => 37.61, 'views_pct' => 18.69],
            'swipe_live' => ['name' => 'Vuốt LIVE', 'gmv_pct' => 0.0, 'imps_pct' => 1.11, 'views_pct' => 27.38],
            'other_profile' => ['name' => 'Hồ sơ người khác', 'gmv_pct' => 0.0, 'imps_pct' => 0.11, 'views_pct' => 2.62]
        ], JSON_UNESCAPED_UNICODE);

        $productsJson4th = json_encode([
            ['name' => '[SP LIVE] 3 Tuýp Sủi mát gan Dovital', 'id' => '1731663026855969967', 'gmv' => 1184790, 'views' => 1751, 'ctr' => 4.28, 'orders' => 3, 'stock' => 5663],
            ['name' => '[Deal 1K] 1 Tuýp Sủi mát gan Dovital', 'id' => '1733032139594892463', 'gmv' => 58000, 'views' => 86, 'ctr' => 17.44, 'orders' => 1, 'stock' => 2],
            ['name' => '3 Tuýp Sủi mát gan Dovital...', 'id' => '1736983103070569647', 'gmv' => 0, 'views' => 90, 'ctr' => 0, 'orders' => 0, 'stock' => 9952],
            ['name' => '2 Tuýp Sủi mát gan Dovital - Tpbv...', 'id' => '1737000915839853487', 'gmv' => 79000, 'views' => 157, 'ctr' => 1.91, 'orders' => 1, 'stock' => 959]
        ], JSON_UNESCAPED_UNICODE);

        $audienceJson4th = json_encode([
            'age' => ['25-34' => 64.29, 'gt_34' => 35.71],
            'followers' => ['following' => 22.92, 'not_following' => 77.08]
        ], JSON_UNESCAPED_UNICODE);

        // 5 phiên live chuẩn xác từ hình ảnh Lịch sử LIVE (Streamer Desktop) và Chi tiết phiên live
        $allSessions = [
            [
                'room_id' => '7681518164916177680',
                'start_time' => '10:33 05/09/2026',
                'duration' => '2h58min',
                'gmv' => 2177890.00,
                'ad_spend' => 172560.00, // Chi phí QC từ chi tiết ca live
                'orders' => 30,
                'views' => 582,
                'impressions' => 17890,
                'viewers' => 419,
                'gpm' => 121750.00,
                'gmv_per_hour' => 731380.00,
                'avg_watch' => '1m 01s',
                'comment_rate' => 52.76,
                'ctr_live' => 49.48,
                'sku_rate' => 5.15,
                'like_rate' => 759.90,
                'gt_1min' => 135,
                'traffic' => $trafficJson4th,
                'products' => $productsJson4th,
                'audience' => $audienceJson4th
            ],
            [
                'room_id' => '7681293833946909448',
                'start_time' => '20:03 3/9/2026',
                'duration' => '1h58min',
                'gmv' => 513000.00,
                'ad_spend' => 0.00, // Không có số liệu chi phí riêng trên Streamer Desktop, không tự ý gán
                'orders' => 6,
                'views' => 377,
                'impressions' => 6350,
                'viewers' => 280,
                'gpm' => 80787.00,
                'gmv_per_hour' => 260847.00,
                'avg_watch' => '0m 52s',
                'comment_rate' => 38.50,
                'ctr_live' => 35.20,
                'sku_rate' => 1.59,
                'like_rate' => 420.00,
                'gt_1min' => 65,
                'traffic' => '[]',
                'products' => '[]',
                'audience' => '[]'
            ],
            [
                'room_id' => '7681253344618220289',
                'start_time' => '17:26 3/9/2026',
                'duration' => '1h35min',
                'gmv' => 559100.00,
                'ad_spend' => 0.00, // Không tự ý gán chi phí riêng
                'orders' => 10,
                'views' => 539,
                'impressions' => 18520,
                'viewers' => 390,
                'gpm' => 30188.00,
                'gmv_per_hour' => 353115.00,
                'avg_watch' => '0m 48s',
                'comment_rate' => 31.20,
                'ctr_live' => 29.80,
                'sku_rate' => 1.85,
                'like_rate' => 310.00,
                'gt_1min' => 82,
                'traffic' => '[]',
                'products' => '[]',
                'audience' => '[]'
            ],
            [
                'room_id' => '7681150802035723024',
                'start_time' => '10:48 3/9/2026',
                'duration' => '2h42min',
                'gmv' => 2200000.00,
                'ad_spend' => 0.00, // Không tự ý gán chi phí riêng
                'orders' => 33,
                'views' => 666,
                'impressions' => 27590,
                'viewers' => 485,
                'gpm' => 79739.00,
                'gmv_per_hour' => 814814.00,
                'avg_watch' => '1m 05s',
                'comment_rate' => 58.20,
                'ctr_live' => 45.10,
                'sku_rate' => 4.95,
                'like_rate' => 810.00,
                'gt_1min' => 160,
                'traffic' => '[]',
                'products' => '[]',
                'audience' => '[]'
            ],
            [
                'room_id' => '7681149841287777041',
                'start_time' => '10:44 3/9/2026',
                'duration' => '0h02min',
                'gmv' => 0.00,
                'ad_spend' => 0.00,
                'orders' => 0,
                'views' => 2,
                'impressions' => 87,
                'viewers' => 2,
                'gpm' => 0.00,
                'gmv_per_hour' => 0.00,
                'avg_watch' => '0m 10s',
                'comment_rate' => 0.00,
                'ctr_live' => 0.00,
                'sku_rate' => 0.00,
                'like_rate' => 0.00,
                'gt_1min' => 0,
                'traffic' => '[]',
                'products' => '[]',
                'audience' => '[]'
            ]
        ];

        $stmtLive = $db->prepare("INSERT INTO `tiktok_live_sessions` 
            (`room_id`, `campaign_id`, `channel_name`, `duration`, `start_time`, `end_time`, `gmv`, `ad_spend`, `orders`, `viewers`, `impressions`, `views`, `gmv_per_hour`, `gpm`, `avg_watch_time`, `comment_rate`, `follow_rate`, `enter_room_rate`, `click_rate`, `ctr_live`, `sku_order_rate`, `share_rate`, `like_rate`, `view_gt_1min`, `traffic_sources`, `top_products`, `audience_profile`)
            VALUES 
            (:room_id, '1862632140958017', 'duocphamaddp', :duration, :start_time, '', :gmv, :ad_spend, :orders, :viewers, :impressions, :views, :gmv_per_hour, :gpm, :avg_watch, :comment_rate, 0.32, 1.70, 3.25, :ctr_live, :sku_rate, 0.32, :like_rate, :gt_1min, :traffic, :products, :audience)
            ON DUPLICATE KEY UPDATE 
            `duration` = VALUES(`duration`), `start_time` = VALUES(`start_time`), `gmv` = VALUES(`gmv`), `ad_spend` = VALUES(`ad_spend`), `orders` = VALUES(`orders`), `viewers` = VALUES(`viewers`), `impressions` = VALUES(`impressions`), `views` = VALUES(`views`), `gpm` = VALUES(`gpm`), `traffic_sources` = VALUES(`traffic_sources`), `top_products` = VALUES(`top_products`), `audience_profile` = VALUES(`audience_profile`)");

        foreach ($allSessions as $s) {
            $stmtLive->execute([
                ':room_id' => $s['room_id'],
                ':duration' => $s['duration'],
                ':start_time' => $s['start_time'],
                ':gmv' => $s['gmv'],
                ':ad_spend' => $s['ad_spend'],
                ':orders' => $s['orders'],
                ':viewers' => $s['viewers'],
                ':impressions' => $s['impressions'],
                ':views' => $s['views'],
                ':gmv_per_hour' => $s['gmv_per_hour'],
                ':gpm' => $s['gpm'],
                ':avg_watch' => $s['avg_watch'],
                ':comment_rate' => $s['comment_rate'],
                ':ctr_live' => $s['ctr_live'],
                ':sku_rate' => $s['sku_rate'],
                ':like_rate' => $s['like_rate'],
                ':gt_1min' => $s['gt_1min'],
                ':traffic' => $s['traffic'],
                ':products' => $s['products'],
                ':audience' => $s['audience']
            ]);
        }
        try {
            $db->exec("UPDATE `tiktok_live_sessions` SET `start_time` = '10:33 05/09/2026' WHERE `room_id` = '7681518164916177680'");
        } catch (Exception $e) {}
    } catch (Exception $e) {}

    // Chèn dữ liệu mẫu nếu bảng campaigns hoàn toàn trống và CHƯA KẾT NỐI shop thật
    $checkConnected = $db->query("SELECT COUNT(*) FROM `tiktok_config` WHERE shop_id IS NOT NULL AND shop_id != ''")->fetchColumn();
    if ($checkConnected == 0) {
        $check = $db->query("SELECT COUNT(*) FROM `tiktok_campaigns`")->fetchColumn();
        if ($check == 0) {
            $db->exec("INSERT INTO `tiktok_campaigns` (`id`, `name`, `type`, `budget`, `spend`, `clicks`, `impressions`, `conversions`, `ad_gmv`, `status`, `created_date`) VALUES
            ('camp-1', 'GMV Max - Vợt cầu lông Yonex Pro 2026', 'Product GMV Max', 5000000.00, 3200000.00, 1850, 48000, 112, 14400000.00, 1, '2026-07-10'),
            ('camp-2', 'LIVE GMV Max - Phiên live đặc biệt 18/08', 'LIVE GMV Max', 12000000.00, 7800000.00, 4500, 98000, 382, 28860000.00, 1, '2026-08-18'),
            ('camp-3', 'GMV Max - Giày chạy bộ nam UltraLight', 'Product GMV Max', 3000000.00, 1850000.00, 980, 29000, 48, 5180000.00, 1, '2026-07-12'),
            ('camp-4', 'LIVE GMV Max - Flash Sale Đồ Gia Dụng', 'LIVE GMV Max', 8000000.00, 6400000.00, 3100, 74000, 210, 15360000.00, 0, '2026-08-14');");
        }
    }

    // Chèn dữ liệu mẫu cho rules nếu trống
    $checkRules = $db->query("SELECT COUNT(*) FROM `tiktok_rules`")->fetchColumn();
    if ($checkRules == 0) {
        $db->exec("INSERT INTO `tiktok_rules` (`id`, `name`, `campaign_type`, `trigger_cond`, `action_taken`, `frequency`, `status`) VALUES
        ('rule-1', 'Tối ưu ngân sách GMV Max', 'Product GMV Max', 'ROAS >= 4.0', 'Tăng ngân sách 15%', 'Mỗi 1 giờ', 1),
        ('rule-2', 'Bảo vệ ngân sách LIVE GMV Max', 'LIVE GMV Max', 'ROAS < 2.0 & Chi tiêu > 1,500,000đ', 'Tạm dừng chiến dịch', 'Mỗi 15 phút', 1),
        ('rule-3', 'Đẩy tương tác Live bùng nổ', 'LIVE GMV Max', 'Người xem đồng thời (PCU) > 1,500', 'Tăng ngân sách 20% & Đặt ROI mục tiêu về 2.5', 'Mỗi 5 phút', 0);");
    }

    // Chèn dữ liệu mẫu cho video ads nếu trống
    $checkVideos = $db->query("SELECT COUNT(*) FROM `tiktok_video_ads`")->fetchColumn();
    if ($checkVideos == 0) {
        $db->exec("INSERT INTO `tiktok_video_ads` (`id`, `campaign_id`, `title`, `spend`, `views`, `clicks`, `ctr`, `cvr`, `conversions`, `gmv`, `thumbnail`) VALUES
        ('vid-1', 'camp-1', 'Review Vợt Yonex cực nảy - Đánh đơn đỉnh cao', 1200000.00, 45000, 1890, 4.20, 2.50, 47, 5640000.00, 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=150&auto=format&fit=crop&q=60'),
        ('vid-2', 'camp-1', 'Test độ bền lưới Yonex Pro khi căng 13kg', 800000.00, 28000, 980, 3.50, 1.20, 11, 1320000.00, 'https://images.unsplash.com/photo-1613918431208-6752c2ecf70f?w=150&auto=format&fit=crop&q=60'),
        ('vid-3', 'camp-1', 'Mở hộp Yonex Pro màu đen cực ngầu', 1200000.00, 68000, 3120, 4.58, 1.73, 54, 7440000.00, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=150&auto=format&fit=crop&q=60'),
        ('vid-4', 'camp-3', 'Giày chạy bộ nam nhẹ tênh - Chạy thử 5km', 1100000.00, 32000, 890, 2.78, 1.80, 16, 1728000.00, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop&q=60'),
        ('vid-5', 'camp-3', 'Giày UltraLight chống nước cực đỉnh dưới mưa', 750000.00, 24000, 710, 2.95, 4.50, 32, 3456000.00, 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=150&auto=format&fit=crop&q=60');");
    }
}

// Hàm lấy Access Token hợp lệ, tự động refresh nếu gần hết hạn
function getAccessToken($shopId = null) {
    $db = getDBConnection();
    
    // Nếu không truyền shopId, lấy shop đầu tiên được kết nối
    if ($shopId) {
        $stmt = $db->prepare("SELECT * FROM `tiktok_config` WHERE shop_id = :shop_id LIMIT 1");
        $stmt->execute([':shop_id' => $shopId]);
    } else {
        $stmt = $db->query("SELECT * FROM `tiktok_config` WHERE `shop_id` IS NOT NULL AND `shop_id` != '' LIMIT 1");
    }
    
    $config = $stmt->fetch();
    if (!$config) {
        return null;
    }
    
    $expiresAt = (int)$config['expires_at'];
    $accessToken = $config['access_token'];
    
    // Nếu token còn hạn hơn 5 phút (300 giây) thì trả về luôn
    if ($expiresAt > time() + 300) {
        return $accessToken;
    }
    
    // Nếu token đã hết hạn hoặc sắp hết hạn, thực hiện Refresh Token
    $appKey = TIKTOK_APP_KEY !== '' ? TIKTOK_APP_KEY : $config['app_key'];
    $appSecret = TIKTOK_APP_SECRET !== '' ? TIKTOK_APP_SECRET : $config['app_secret'];
    $refreshToken = $config['refresh_token'];
    
    if (!$appKey || !$appSecret || !$refreshToken) {
        return $accessToken; // Fallback trả về token cũ nếu thiếu thông tin refresh
    }
    
    $url = "https://auth.tiktok-shops.com/api/v2/token/refresh" .
           "?app_key=" . urlencode($appKey) .
           "&app_secret=" . urlencode($appSecret) .
           "&refresh_token=" . urlencode($refreshToken) .
           "&grant_type=refresh_token";
           
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $resData = json_decode($response, true);
    if (isset($resData['data']['access_token'])) {
        $newAccessToken = $resData['data']['access_token'];
        $newRefreshToken = $resData['data']['refresh_token'];
        $expireIn = (int)$resData['data']['access_token_expire_in'];
        $newExpiresAt = ($expireIn > 1000000000) ? $expireIn : time() + $expireIn;
        
        // Cập nhật lại vào cơ sở dữ liệu
        $stmtUpdate = $db->prepare("UPDATE `tiktok_config` SET 
            access_token = :access_token,
            refresh_token = :refresh_token,
            expires_at = :expires_at
            WHERE shop_id = :shop_id");
            
        $stmtUpdate->execute([
            ':access_token' => $newAccessToken,
            ':refresh_token' => $newRefreshToken,
            ':expires_at' => $newExpiresAt,
            ':shop_id' => $config['shop_id']
        ]);
        
        return $newAccessToken;
    }
    
    return $accessToken; // Nếu refresh thất bại, trả về token cũ
}

/**
 * Gửi HTTP Request tới TikTok Marketing API (Ads API) v1.3
 */
function requestTikTokAdsAPI($path, $params = [], $accessToken = null) {
    $url = "https://business-api.tiktok.com/open_api/v1.3" . $path;
    if (!empty($params)) {
        $queryString = '';
        foreach ($params as $k => $v) {
            if (is_array($v)) {
                $queryString .= '&' . $k . '=' . urlencode(json_encode($v));
            } else {
                $queryString .= '&' . $k . '=' . urlencode($v);
            }
        }
        $url .= '?' . ltrim($queryString, '&');
    }
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Access-Token: ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    
    if ($response === false) {
        throw new Exception("cURL Error: " . $err);
    }
    
    $resData = json_decode($response, true);
    if ($httpCode !== 200 || (isset($resData['code']) && $resData['code'] !== 0)) {
        $msg = isset($resData['message']) ? $resData['message'] : "HTTP Status " . $httpCode;
        throw new Exception("TikTok Ads API Error (Code " . ($resData['code'] ?? $httpCode) . "): " . $msg);
    }
    
    return $resData;
}

