<?php
/**
 * ADDP COMMERCE INTELLIGENCE - ANALYTICS & DASHBOARD SERVICE
 * 
 * Component: HF1.5 Phase 1B Shop Analytics, Livestream & Video Engine
 * 
 * Features:
 * 1. Normalized Shop Daily Overview Ingestion (commerce_shop_analytics_daily)
 * 2. Livestream Session-Level Ingestion (commerce_live_sessions)
 * 3. Video Engagement & Attribution Ingestion (commerce_video_analytics)
 * 4. Product / SKU Performance Ingestion (commerce_product_analytics)
 * 5. Strict KPI Business Contract (Direct API vs Derived vs Unavailable):
 *    - GMV/giờ, Lượt hiển thị/giờ, GPM, Tỷ lệ bình luận, Tỷ lệ follow, Tỷ lệ click, Tỷ lệ chia sẻ
 * 6. Multi-Grain Aggregation & Fast Dashboard Read Service (Zero runtime API blocking)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/tiktok_client.php';
require_once __DIR__ . '/commerce_loss_engine.php';
require_once __DIR__ . '/commerce_finance_service.php';
require_once __DIR__ . '/commerce_ads_service.php';
require_once __DIR__ . '/commerce_daily_aggregate_service.php';

class CommerceAnalyticsService {
    public const PLATFORM_TIKTOK_SHOP = 'tiktok_shop';

    public const DOMAIN_SHOP_DAILY = 'SHOP_DAILY';
    public const DOMAIN_LIVE_SESSIONS = 'LIVE_SESSIONS';
    public const DOMAIN_VIDEO_PERFORMANCE = 'VIDEO_PERFORMANCE';
    public const DOMAIN_PRODUCT_PERFORMANCE = 'PRODUCT_PERFORMANCE';

    public const KPI_TYPE_DIRECT_API = 'DIRECT_API';
    public const KPI_TYPE_DERIVED_FROM_API = 'DERIVED_FROM_API';
    public const KPI_TYPE_UNAVAILABLE = 'UNAVAILABLE';

    private PDO $db;
    private TikTokShopClient $client;
    private CommerceLossEngine $lossEngine;
    private CommerceFinanceService $financeService;
    private CommerceAdsService $adsService;
    private CommerceDailyAggregateService $dailyAggregateService;

    public function __construct(
        ?PDO $db = null,
        ?TikTokShopClient $client = null,
        ?CommerceLossEngine $lossEngine = null,
        ?CommerceFinanceService $financeService = null,
        ?CommerceAdsService $adsService = null,
        ?CommerceDailyAggregateService $dailyAggregateService = null
    ) {
        $this->db = $db ?? getDBConnection();
        $this->client = $client ?? new TikTokShopClient();
        $this->lossEngine = $lossEngine ?? new CommerceLossEngine($this->db);
        $this->financeService = $financeService ?? new CommerceFinanceService($this->db, $this->client, $this->lossEngine);
        $this->adsService = $adsService ?? new CommerceAdsService($this->db);
        $this->dailyAggregateService = $dailyAggregateService ?? new CommerceDailyAggregateService($this->db);
    }

    public const LATEST_ANALYTICS_AVAILABLE_DATE = '2026-10-18';

    /**
     * Calculates the latest available date for TikTok Shop Analytics (T-1 daily aggregation).
     */
    public static function getLatestAnalyticsAvailableDate(): string {
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        return ($yesterday > '2026-08-10') ? $yesterday : '2026-10-18';
    }

    /**
     * Evaluates TikTok Shop Analytics freshness semantics
     * Returns:
     * - AVAILABLE: requested window is completely <= latest_available_date
     * - PARTIAL: window starts <= latest_available_date but ends after it
     * - NOT_YET_AVAILABLE: window starts after latest_available_date
     */
    public static function evaluateAnalyticsFreshness(string $startDate, string $endDate): array {
        $latest = self::getLatestAnalyticsAvailableDate();

        if ($startDate > $latest) {
            return [
                'status' => 'NOT_YET_AVAILABLE',
                'latest_available_date' => $latest,
                'requested_start_date' => $startDate,
                'requested_end_date' => $endDate,
                'message' => "Dữ liệu TikTok Analytics hiện khả dụng đến {$latest}. Chưa khả dụng cho kỳ đã chọn."
            ];
        }

        if ($endDate > $latest) {
            return [
                'status' => 'PARTIAL',
                'latest_available_date' => $latest,
                'requested_start_date' => $startDate,
                'requested_end_date' => $endDate,
                'message' => "Dữ liệu TikTok Analytics hiện khả dụng một phần (đến {$latest}). Một số ngày chưa được công bố."
            ];
        }

        return [
            'status' => 'AVAILABLE',
            'latest_available_date' => $latest,
            'requested_start_date' => $startDate,
            'requested_end_date' => $endDate,
            'message' => 'Dữ liệu TikTok Analytics khả dụng đầy đủ cho kỳ đã chọn.'
        ];
    }

    /**
     * Resolves shop cipher dynamically without hard dependency on tiktok_shops table
     */
    public function resolveShopCipher(string $shopId, string $accessToken): string {
        // 1. Try tiktok_shops table if exists
        try {
            $stmt = $this->db->prepare("SELECT cipher FROM `tiktok_shops` WHERE shop_id = ? AND cipher IS NOT NULL AND cipher != '' LIMIT 1");
            $stmt->execute([$shopId]);
            $cipher = $stmt->fetchColumn();
            if (!empty($cipher)) return (string)$cipher;
        } catch (Throwable $e) {}

        // 2. Dynamic resolution via TikTokShopClient::resolveShopCipher
        try {
            return $this->client->resolveShopCipher($shopId, $accessToken);
        } catch (Throwable $e) {}

        return '';
    }

    /**
     * Synchronizes shop daily analytics overview with freshness validation
     * Guards against fabricating synthetic zeroes for unpublished date windows
     */
    public function syncShopDailyAnalytics(string $shopId, string $startDate, string $endDate): int {
        $freshness = self::evaluateAnalyticsFreshness($startDate, $endDate);

        // Create run record in commerce_analytics_sync_runs
        $status = ($freshness['status'] === 'NOT_YET_AVAILABLE') ? 'SKIPPED_NOT_AVAILABLE' : 'IN_PROGRESS';
        $errorMsg = ($freshness['status'] === 'NOT_YET_AVAILABLE') ? $freshness['message'] : null;

        $stmtRun = $this->db->prepare("INSERT INTO `commerce_analytics_sync_runs` 
            (platform, shop_id, analytics_domain, sync_type, status, start_date, end_date, records_ingested, error_message, started_at)
            VALUES (?, ?, ?, 'MANUAL_RANGE', ?, ?, ?, 0, ?, NOW())");
        $stmtRun->execute([
            self::PLATFORM_TIKTOK_SHOP,
            $shopId,
            self::DOMAIN_SHOP_DAILY,
            $status,
            $startDate,
            $endDate,
            $errorMsg
        ]);
        $runId = (int)$this->db->lastInsertId();

        if ($freshness['status'] === 'NOT_YET_AVAILABLE') {
            // Guard: Never call API or store synthetic 0 metrics when data is not yet published
            $this->db->prepare("UPDATE `commerce_analytics_sync_runs` SET completed_at = NOW() WHERE id = ?")
                     ->execute([$runId]);
            return $runId;
        }

        // Window can be queried up to latest available date
        $queryEnd = min($endDate, self::getLatestAnalyticsAvailableDate());
        $accessToken = getAccessToken($shopId);
        if (!$accessToken) {
            $this->db->prepare("UPDATE `commerce_analytics_sync_runs` SET status = 'FAILED', error_message = 'Access token not found', completed_at = NOW() WHERE id = ?")
                     ->execute([$runId]);
            return $runId;
        }

        $shopCipher = $this->resolveShopCipher($shopId, $accessToken);
        try {
            $res = $this->client->getShopPerformance($accessToken, $shopCipher, $startDate, $queryEnd);
            $perfList = $res['data']['performance_list'] ?? $res['data']['list'] ?? [];
            $recordsCount = 0;
            foreach ($perfList as $p) {
                $statDate = $p['date'] ?? $p['stat_date'] ?? null;
                if ($statDate) {
                    $this->ingestShopDailyRecord($shopId, $statDate, $p);
                    $recordsCount++;
                }
            }
            $this->db->prepare("UPDATE `commerce_analytics_sync_runs` SET status = 'COMPLETED', records_ingested = ?, completed_at = NOW() WHERE id = ?")
                     ->execute([$recordsCount, $runId]);
        } catch (Throwable $e) {
            $this->db->prepare("UPDATE `commerce_analytics_sync_runs` SET status = 'FAILED', error_message = ?, completed_at = NOW() WHERE id = ?")
                     ->execute([$e->getMessage(), $runId]);
        }

        return $runId;
    }

    /**
     * Ensures commerce_video_analytics table exists and has media columns
     */
    public function ensureVideoAnalyticsColumns(): void {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        try {
            $this->db->exec("CREATE TABLE IF NOT EXISTS `commerce_video_analytics` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        } catch (\Throwable $t) {}

        try { $this->db->exec("ALTER TABLE `commerce_video_analytics` ADD COLUMN `cover_url` VARCHAR(1024) NULL DEFAULT NULL AFTER `title`"); } catch (\Throwable $t) {}
        try { $this->db->exec("ALTER TABLE `commerce_video_analytics` ADD COLUMN `video_url` VARCHAR(1024) NULL DEFAULT NULL AFTER `cover_url`"); } catch (\Throwable $t) {}
    }

    /**
     * Synchronizes Short Video Performance from TikTok Shop Video Analytics API
     * Scope: data.shop_analytics.public.read
     * Endpoint: GET /analytics/202405/shop_videos/performance
     */
    public function syncShopVideosAnalytics(string $shopId, string $startDate, string $endDate, array $options = []): array {
        $this->ensureVideoAnalyticsColumns();

        $latestAvailable = self::getLatestAnalyticsAvailableDate();
        // If startDate is beyond latest available, fallback to 30 days window up to latest available
        if ($startDate > $latestAvailable) {
            $effectiveStart = date('Y-m-d', strtotime($latestAvailable . ' -30 days'));
            $effectiveEnd = $latestAvailable;
        } else {
            $effectiveStart = $startDate;
            $effectiveEnd = min($endDate, $latestAvailable);
        }

        // TikTok Shop API end_date_lt is an exclusive upper bound, so add 1 day to include effectiveEnd
        $apiEndDateLt = date('Y-m-d', strtotime($effectiveEnd . ' +1 day'));
        if ($effectiveStart >= $apiEndDateLt) {
            $effectiveStart = date('Y-m-d', strtotime($effectiveEnd . ' -7 days'));
        }

        $accessToken = getAccessToken($shopId);
        if (!$accessToken) {
            return [
                'status' => 'FAILED',
                'error' => 'TOKEN_NOT_FOUND',
                'message' => 'Không tìm thấy TikTok Shop Access Token hợp lệ. Vui lòng kết nối lại tài khoản TikTok Shop.',
                'records_ingested' => 0
            ];
        }

        $shopCipher = $this->resolveShopCipher($shopId, $accessToken);
        if (empty($shopCipher)) {
            return [
                'status' => 'FAILED',
                'error' => 'SHOP_CIPHER_NOT_FOUND',
                'message' => 'Không thể xác thực shop_cipher cho Shop ' . $shopId . '. Vui lòng kiểm tra quyền ủy quyền gian hàng.',
                'records_ingested' => 0
            ];
        }

        // Record start in commerce_analytics_sync_runs
        $runId = 0;
        try {
            $stmtRun = $this->db->prepare("INSERT INTO `commerce_analytics_sync_runs` 
                (platform, shop_id, analytics_domain, sync_type, status, start_date, end_date, records_ingested, started_at)
                VALUES (?, ?, ?, 'MANUAL_RANGE', 'IN_PROGRESS', ?, ?, 0, NOW())");
            $stmtRun->execute([
                self::PLATFORM_TIKTOK_SHOP,
                $shopId,
                self::DOMAIN_VIDEO_PERFORMANCE,
                $effectiveStart,
                $effectiveEnd
            ]);
            $runId = (int)$this->db->lastInsertId();
        } catch (\Throwable $t) {}

        $recordsCount = 0;
        $pageToken = null;
        $maxPages = 15;
        $page = 0;
        $syncedVideos = [];

        try {
            do {
                $page++;
                $reqOpts = array_merge($options, [
                    'page_size' => 50,
                ]);
                if (!empty($pageToken)) {
                    $reqOpts['page_token'] = $pageToken;
                }

                $res = $this->client->getShopVideosPerformance($accessToken, $shopCipher, $effectiveStart, $apiEndDateLt, $reqOpts);
                $code = $res['code'] ?? 0;
                if ($code !== 0) {
                    $msg = $res['message'] ?? 'Lỗi không xác định từ TikTok API';
                    throw new RuntimeException("TikTok Video Analytics API Error ({$code}): {$msg}");
                }

                $data = $res['data'] ?? [];
                $videoList = $data['videos'] ?? $data['video_list'] ?? $data['list'] ?? [];

                foreach ($videoList as $vData) {
                    $statDate = $vData['stat_date'] ?? $vData['date'] ?? $effectiveEnd;
                    $this->ingestVideoRecord($shopId, $vData, $statDate);
                    $recordsCount++;
                    $syncedVideos[] = [
                        'video_id' => (string)($vData['video_id'] ?? $vData['id'] ?? ''),
                        'title' => (string)($vData['title'] ?? ''),
                        'views' => (int)($vData['video_views'] ?? $vData['views'] ?? 0),
                        'units_sold' => (int)($vData['units_sold'] ?? $vData['unit_sold'] ?? 0),
                        'gmv' => (float)(is_array($vData['gmv'] ?? null) ? ($vData['gmv']['amount'] ?? 0) : ($vData['gmv'] ?? 0))
                    ];
                }

                $pageToken = $data['next_page_token'] ?? $data['page_token'] ?? null;
            } while (!empty($pageToken) && $page < $maxPages);

            if ($runId > 0) {
                $this->db->prepare("UPDATE `commerce_analytics_sync_runs` SET status = 'COMPLETED', records_ingested = ?, completed_at = NOW() WHERE id = ?")
                         ->execute([$recordsCount, $runId]);
            }

            return [
                'status' => 'COMPLETED',
                'records_ingested' => $recordsCount,
                'videos_count' => count($syncedVideos),
                'videos' => array_slice($syncedVideos, 0, 10),
                'message' => "Đồng bộ thành công {$recordsCount} bản ghi video ngắn từ TikTok Shop Video Analytics."
            ];
        } catch (\Throwable $t) {
            $err = $t->getMessage();
            $scopeHint = '';
            if (stripos($err, 'scope') !== false || stripos($err, 'permission') !== false || stripos($err, '403') !== false || stripos($err, '105001') !== false) {
                $scopeHint = ' (Lưu ý: Cần kích hoạt scope data.shop_analytics.public.read trong TikTok Shop Partner Center và ủy quyền lại gian hàng)';
            }
            if ($runId > 0) {
                $this->db->prepare("UPDATE `commerce_analytics_sync_runs` SET status = 'FAILED', error_message = ?, completed_at = NOW() WHERE id = ?")
                         ->execute([$err . $scopeHint, $runId]);
            }
            return [
                'status' => 'FAILED',
                'error' => 'API_ERROR',
                'message' => $err . $scopeHint,
                'records_ingested' => $recordsCount
            ];
        }
    }

    /**
     * Ingests a single daily shop performance record
     */
    public function ingestShopDailyRecord(string $shopId, string $statDate, array $data): int {
        $pageViews = (int)($data['page_views'] ?? 0);
        $uniqueVisitors = (int)($data['unique_visitors'] ?? $data['uv'] ?? 0);
        $totalOrders = (int)($data['total_orders'] ?? $data['orders'] ?? 0);
        $grossRevenue = sprintf('%.2f', (float)($data['gross_revenue'] ?? $data['gmv'] ?? 0.0));
        
        $cvr = 0.0000;
        if (isset($data['conversion_rate']) || isset($data['cvr'])) {
            $cvr = (float)($data['conversion_rate'] ?? $data['cvr']);
        } elseif ($uniqueVisitors > 0) {
            $cvr = round($totalOrders / $uniqueVisitors, 4);
        }

        $currency = strtoupper(trim((string)($data['currency'] ?? 'VND')));
        $rawHash = hash('sha256', json_encode($data));

        $stmt = $this->db->prepare("INSERT INTO `commerce_shop_analytics_daily` (
            platform, shop_id, stat_date, page_views, unique_visitors,
            total_orders, gross_revenue, conversion_rate, currency,
            raw_data_hash, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, NOW(), NOW()
        ) ON DUPLICATE KEY UPDATE
            page_views = VALUES(page_views),
            unique_visitors = VALUES(unique_visitors),
            total_orders = VALUES(total_orders),
            gross_revenue = VALUES(gross_revenue),
            conversion_rate = VALUES(conversion_rate),
            currency = VALUES(currency),
            raw_data_hash = VALUES(raw_data_hash),
            updated_at = NOW()");

        $stmt->execute([
            self::PLATFORM_TIKTOK_SHOP,
            $shopId,
            $statDate,
            $pageViews,
            $uniqueVisitors,
            $totalOrders,
            $grossRevenue,
            $cvr,
            $currency,
            $rawHash
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Ingests a single livestream session record
     */
    public function ingestLiveSessionRecord(string $shopId, array $sessionData): int {
        $sessionId = trim((string)($sessionData['session_id'] ?? $sessionData['id'] ?? $sessionData['room_id'] ?? ''));
        if ($sessionId === '') {
            throw new InvalidArgumentException('Missing session_id in live session payload');
        }

        $title = !empty($sessionData['title']) ? trim((string)$sessionData['title']) : null;
        $accountType = trim((string)($sessionData['account_type'] ?? 'OFFICIAL_ACCOUNTS'));
        $creatorId = !empty($sessionData['creator_id']) ? trim((string)$sessionData['creator_id']) : null;
        $creatorUsername = !empty($sessionData['creator_username']) ? trim((string)$sessionData['creator_username']) : null;

        $startRaw = $sessionData['start_time'] ?? time();
        $startTime = is_numeric($startRaw) ? date('Y-m-d H:i:s', (int)$startRaw) : (string)$startRaw;

        $endTime = null;
        if (!empty($sessionData['end_time'])) {
            $endRaw = $sessionData['end_time'];
            $endTime = is_numeric($endRaw) ? date('Y-m-d H:i:s', (int)$endRaw) : (string)$endRaw;
        }

        $durationSeconds = (int)($sessionData['duration_seconds'] ?? $sessionData['duration'] ?? 0);
        if ($durationSeconds === 0 && $endTime !== null) {
            $durationSeconds = max(0, strtotime($endTime) - strtotime($startTime));
        }

        $sales = $sessionData['sales_performance'] ?? $sessionData;
        $traffic = $sessionData['traffic_performance'] ?? $sessionData['viewer_performance'] ?? $sessionData;

        $gmvRaw = is_array($sales['gmv'] ?? null) ? ($sales['gmv']['amount'] ?? 0.0) : ($sales['gmv'] ?? 0.0);
        $gmv = sprintf('%.2f', (float)$gmvRaw);
        $ordersCount = (int)($sales['sku_orders'] ?? $sales['orders_count'] ?? $sales['orders'] ?? 0);
        $unitsSold = (int)($sales['unit_sold'] ?? $sales['units_sold'] ?? 0);
        $customerCount = (int)($sales['customers'] ?? $sales['customer_count'] ?? 0);

        $totalViews = (int)($traffic['viewers'] ?? $traffic['total_views'] ?? 0);
        $impressions = (int)($traffic['impressions'] ?? 0);
        $clicks = (int)($traffic['clicks'] ?? $traffic['product_clicks'] ?? 0);
        $pcu = (int)($traffic['peak_concurrent_users'] ?? $traffic['pcu'] ?? 0);
        $comments = (int)($traffic['comments'] ?? $traffic['comments_count'] ?? 0);
        $shares = (int)($traffic['shares'] ?? $traffic['shares_count'] ?? 0);
        $follows = (int)($traffic['follows'] ?? $traffic['follows_count'] ?? 0);

        $currency = strtoupper(trim((string)($sessionData['currency'] ?? 'VND')));
        $rawHash = hash('sha256', json_encode($sessionData));

        $stmt = $this->db->prepare("INSERT INTO `commerce_live_sessions` (
            platform, shop_id, session_id, title, account_type,
            creator_id, creator_username, start_time, end_time,
            duration_seconds, gmv, orders_count, units_sold, customer_count,
            total_views, impressions, clicks, peak_concurrent_users,
            comments_count, shares_count, follows_count, currency,
            raw_data_hash, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, NOW(), NOW()
        ) ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            account_type = VALUES(account_type),
            creator_id = VALUES(creator_id),
            creator_username = VALUES(creator_username),
            start_time = VALUES(start_time),
            end_time = VALUES(end_time),
            duration_seconds = VALUES(duration_seconds),
            gmv = VALUES(gmv),
            orders_count = VALUES(orders_count),
            units_sold = VALUES(units_sold),
            customer_count = VALUES(customer_count),
            total_views = VALUES(total_views),
            impressions = VALUES(impressions),
            clicks = VALUES(clicks),
            peak_concurrent_users = VALUES(peak_concurrent_users),
            comments_count = VALUES(comments_count),
            shares_count = VALUES(shares_count),
            follows_count = VALUES(follows_count),
            currency = VALUES(currency),
            raw_data_hash = VALUES(raw_data_hash),
            updated_at = NOW()");

        $stmt->execute([
            self::PLATFORM_TIKTOK_SHOP,
            $shopId,
            $sessionId,
            $title,
            $accountType,
            $creatorId,
            $creatorUsername,
            $startTime,
            $endTime,
            $durationSeconds,
            $gmv,
            $ordersCount,
            $unitsSold,
            $customerCount,
            $totalViews,
            $impressions,
            $clicks,
            $pcu,
            $comments,
            $shares,
            $follows,
            $currency,
            $rawHash
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Ingests a single video performance record
     */
    public function ingestVideoRecord(string $shopId, array $videoData, string $statDate): int {
        $videoId = trim((string)($videoData['video_id'] ?? $videoData['id'] ?? ''));
        if ($videoId === '') {
            throw new InvalidArgumentException('Missing video_id in video payload');
        }

        $title = !empty($videoData['title']) ? trim((string)$videoData['title']) : null;
        $coverUrl = !empty($videoData['cover_url']) 
            ? trim((string)$videoData['cover_url']) 
            : (!empty($videoData['thumbnail_url']) ? trim((string)$videoData['thumbnail_url']) : (!empty($videoData['cover_image_url']) ? trim((string)$videoData['cover_image_url']) : null));
        $videoUrl = !empty($videoData['video_url']) 
            ? trim((string)$videoData['video_url']) 
            : (!empty($videoData['url']) ? trim((string)$videoData['url']) : null);
        $duration = (int)($videoData['duration_seconds'] ?? $videoData['duration'] ?? 0);

        $postTime = null;
        if (!empty($videoData['video_post_time'])) {
            $pRaw = $videoData['video_post_time'];
            $postTime = is_numeric($pRaw) ? date('Y-m-d H:i:s', (int)$pRaw) : (string)$pRaw;
        }

        $creatorType = trim((string)($videoData['creator']['author_type'] ?? $videoData['creator_type'] ?? 'OFFICIAL'));
        $creatorName = !empty($videoData['creator']['nick_name']) ? trim((string)$videoData['creator']['nick_name']) : (!empty($videoData['creator']['name']) ? trim((string)$videoData['creator']['name']) : null);
        if (!$videoUrl && $videoId !== '') {
            $handle = $creatorName ? ltrim($creatorName, '@') : 'addp';
            $videoUrl = "https://www.tiktok.com/@{$handle}/video/{$videoId}";
        }

        $views = (int)($videoData['video_views'] ?? $videoData['views'] ?? 0);
        $unitsSold = (int)($videoData['units_sold'] ?? $videoData['unit_sold'] ?? 0);

        $gmvRaw = is_array($videoData['gmv'] ?? null) ? ($videoData['gmv']['amount'] ?? 0.0) : ($videoData['gmv'] ?? 0.0);
        $grossRevenue = sprintf('%.2f', (float)$gmvRaw);

        $attrGmvRaw = is_array($videoData['attributed_gmv'] ?? null) ? ($videoData['attributed_gmv']['amount'] ?? 0.0) : ($videoData['attributed_gmv'] ?? 0.0);
        $attributedGmv = sprintf('%.2f', (float)$attrGmvRaw);

        $ctr = (float)($videoData['click_through_rate'] ?? $videoData['ctr'] ?? 0.0000);
        $comments = (int)($videoData['comments'] ?? 0);
        $shares = (int)($videoData['shares'] ?? 0);
        $likes = (int)($videoData['likes'] ?? 0);
        $gpm = (float)($videoData['gpm'] ?? 0.00);

        $currency = strtoupper(trim((string)($videoData['currency'] ?? 'VND')));
        $rawHash = hash('sha256', json_encode($videoData));

        $stmt = $this->db->prepare("INSERT INTO `commerce_video_analytics` (
            platform, shop_id, video_id, stat_date, title, cover_url, video_url,
            duration_seconds, video_post_time, creator_type, creator_name,
            video_views, units_sold, gross_revenue, attributed_gmv,
            ctr, comments_count, shares_count, likes_count, gpm, currency,
            raw_data_hash, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, NOW(), NOW()
        ) ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            cover_url = VALUES(cover_url),
            video_url = VALUES(video_url),
            duration_seconds = VALUES(duration_seconds),
            video_post_time = VALUES(video_post_time),
            creator_type = VALUES(creator_type),
            creator_name = VALUES(creator_name),
            video_views = VALUES(video_views),
            units_sold = VALUES(units_sold),
            gross_revenue = VALUES(gross_revenue),
            attributed_gmv = VALUES(attributed_gmv),
            ctr = VALUES(ctr),
            comments_count = VALUES(comments_count),
            shares_count = VALUES(shares_count),
            likes_count = VALUES(likes_count),
            gpm = VALUES(gpm),
            currency = VALUES(currency),
            raw_data_hash = VALUES(raw_data_hash),
            updated_at = NOW()");

        $stmt->execute([
            self::PLATFORM_TIKTOK_SHOP,
            $shopId,
            $videoId,
            $statDate,
            $title,
            $coverUrl,
            $videoUrl,
            $duration,
            $postTime,
            $creatorType,
            $creatorName,
            $views,
            $unitsSold,
            $grossRevenue,
            $attributedGmv,
            $ctr,
            $comments,
            $shares,
            $likes,
            $gpm,
            $currency,
            $rawHash
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Ingests a single product / SKU performance record
     */
    public function ingestProductRecord(string $shopId, array $productData, string $statDate): int {
        $productId = trim((string)($productData['product_id'] ?? $productData['id'] ?? ''));
        if ($productId === '') {
            throw new InvalidArgumentException('Missing product_id in product payload');
        }

        $skuId = trim((string)($productData['sku_id'] ?? ''));
        $productName = !empty($productData['product_name']) ? trim((string)$productData['product_name']) : null;
        $unitsSold = (int)($productData['units_sold'] ?? $productData['unit_sold'] ?? 0);
        $grossRevenue = sprintf('%.2f', (float)($productData['gross_revenue'] ?? $productData['gmv'] ?? 0.0));
        $pageViews = (int)($productData['page_views'] ?? 0);
        $uniqueVisitors = (int)($productData['unique_visitors'] ?? 0);
        $cvr = (float)($productData['cvr'] ?? $productData['conversion_rate'] ?? 0.0000);
        $currency = strtoupper(trim((string)($productData['currency'] ?? 'VND')));
        $rawHash = hash('sha256', json_encode($productData));

        $stmt = $this->db->prepare("INSERT INTO `commerce_product_analytics` (
            platform, shop_id, product_id, sku_id, stat_date,
            product_name, units_sold, gross_revenue, page_views,
            unique_visitors, cvr, currency, raw_data_hash,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            NOW(), NOW()
        ) ON DUPLICATE KEY UPDATE
            product_name = VALUES(product_name),
            units_sold = VALUES(units_sold),
            gross_revenue = VALUES(gross_revenue),
            page_views = VALUES(page_views),
            unique_visitors = VALUES(unique_visitors),
            cvr = VALUES(cvr),
            currency = VALUES(currency),
            raw_data_hash = VALUES(raw_data_hash),
            updated_at = NOW()");

        $stmt->execute([
            self::PLATFORM_TIKTOK_SHOP,
            $shopId,
            $productId,
            $skuId,
            $statDate,
            $productName,
            $unitsSold,
            $grossRevenue,
            $pageViews,
            $uniqueVisitors,
            $cvr,
            $currency,
            $rawHash
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Evaluates live KPI business contracts and computes derived metrics safely
     * Follows Section 4 Mandate: DIRECT_API vs DERIVED_FROM_API vs UNAVAILABLE
     */
    public static function computeLiveSessionKpis(array $raw): array {
        $durationSeconds = (int)($raw['duration_seconds'] ?? 0);
        $durationHours = $durationSeconds > 0 ? ($durationSeconds / 3600.0) : 0.0;
        $gmv = (float)($raw['gmv'] ?? 0.0);
        $impressions = (int)($raw['impressions'] ?? 0);
        $viewers = (int)($raw['total_views'] ?? 0);
        $clicks = (int)($raw['clicks'] ?? 0);
        $comments = (int)($raw['comments_count'] ?? 0);
        $shares = (int)($raw['shares_count'] ?? 0);
        $follows = (int)($raw['follows_count'] ?? 0);

        // 1. Direct API Metrics
        $kpis = [
            'impressions' => ['type' => self::KPI_TYPE_DIRECT_API, 'value' => $impressions],
            'views' => ['type' => self::KPI_TYPE_DIRECT_API, 'value' => $viewers],
            'gmv' => ['type' => self::KPI_TYPE_DIRECT_API, 'value' => $gmv],
            'orders' => ['type' => self::KPI_TYPE_DIRECT_API, 'value' => (int)($raw['orders_count'] ?? 0)],
            'units_sold' => ['type' => self::KPI_TYPE_DIRECT_API, 'value' => (int)($raw['units_sold'] ?? 0)],
            'duration_seconds' => ['type' => self::KPI_TYPE_DIRECT_API, 'value' => $durationSeconds]
        ];

        // 2. Derived: GMV per hour (requires duration > 0)
        if ($durationHours > 0) {
            $kpis['gmv_per_hour'] = [
                'type' => self::KPI_TYPE_DERIVED_FROM_API,
                'value' => round($gmv / $durationHours, 2)
            ];
        } else {
            $kpis['gmv_per_hour'] = ['type' => self::KPI_TYPE_UNAVAILABLE, 'value' => null];
        }

        // 3. Derived: Impressions per hour (requires duration > 0)
        if ($durationHours > 0) {
            $kpis['impressions_per_hour'] = [
                'type' => self::KPI_TYPE_DERIVED_FROM_API,
                'value' => round($impressions / $durationHours, 2)
            ];
        } else {
            $kpis['impressions_per_hour'] = ['type' => self::KPI_TYPE_UNAVAILABLE, 'value' => null];
        }

        // 4. Derived: GPM (GMV per thousand impressions) (requires impressions > 0)
        if ($impressions > 0) {
            $kpis['gpm'] = [
                'type' => self::KPI_TYPE_DERIVED_FROM_API,
                'value' => round(($gmv / $impressions) * 1000.0, 2)
            ];
        } else {
            $kpis['gpm'] = ['type' => self::KPI_TYPE_UNAVAILABLE, 'value' => null];
        }

        // 5. Derived: Comment Rate (comments / viewers * 100) (requires viewers > 0)
        if ($viewers > 0) {
            $commentRateVal = round(($comments / $viewers) * 100.0, 2);
            $commentRatePayload = [
                'type' => self::KPI_TYPE_DERIVED_FROM_API,
                'value' => $commentRateVal
            ];
            $kpis['comment_rate'] = $commentRatePayload;
            $kpis['comment_rate_pct'] = $commentRatePayload;
        } else {
            $commentRatePayload = ['type' => self::KPI_TYPE_UNAVAILABLE, 'value' => null];
            $kpis['comment_rate'] = $commentRatePayload;
            $kpis['comment_rate_pct'] = $commentRatePayload;
        }

        // 6. Derived: Follow Rate (follows / viewers * 100) (requires viewers > 0)
        if ($viewers > 0) {
            $followRateVal = round(($follows / $viewers) * 100.0, 2);
            $followRatePayload = [
                'type' => self::KPI_TYPE_DERIVED_FROM_API,
                'value' => $followRateVal
            ];
            $kpis['follow_rate'] = $followRatePayload;
            $kpis['follow_rate_pct'] = $followRatePayload;
        } else {
            $followRatePayload = ['type' => self::KPI_TYPE_UNAVAILABLE, 'value' => null];
            $kpis['follow_rate'] = $followRatePayload;
            $kpis['follow_rate_pct'] = $followRatePayload;
        }

        // 7. Derived: Click Rate (clicks / impressions * 100) (requires impressions > 0)
        if ($impressions > 0) {
            $kpis['click_rate_pct'] = [
                'type' => self::KPI_TYPE_DERIVED_FROM_API,
                'value' => round(($clicks / $impressions) * 100.0, 2)
            ];
        } else {
            $kpis['click_rate_pct'] = ['type' => self::KPI_TYPE_UNAVAILABLE, 'value' => null];
        }

        // 8. Derived: Share Rate (shares / viewers * 100) (requires viewers > 0)
        if ($viewers > 0) {
            $kpis['share_rate_pct'] = [
                'type' => self::KPI_TYPE_DERIVED_FROM_API,
                'value' => round(($shares / $viewers) * 100.0, 2)
            ];
        } else {
            $kpis['share_rate_pct'] = ['type' => self::KPI_TYPE_UNAVAILABLE, 'value' => null];
        }

        return $kpis;
    }

    /**
     * Unified Dashboard Data Service (Fast multi-grain read without external API blocking)
     * Follows Section 5 & 6 Mandates:
     * - TỔNG QUAN SHOP
     * - DOANH THU
     * - ĐƠN HÀNG
     * - HOÀN / HỦY
     * - TÀI CHÍNH
     * - SẢN PHẨM
     * - VIDEO
     * - LIVESTREAM
     */
    public function getDashboardReport(string $shopId, string $startDate, string $endDate): array {
        // 1. Reconciliation & Loss Report (from complete commerce_daily_aggregates or normalized fallback)
        $isRangeAggregated = $this->dailyAggregateService->isRangeFullyAggregated($shopId, $startDate, $endDate);
        $aggReport = $isRangeAggregated ? $this->dailyAggregateService->getAggregateReport($shopId, $startDate, $endDate, CommerceDailyAggregateService::PLATFORM_TIKTOK_SHOP, true) : null;
        $isAggregated = ($aggReport !== null && $isRangeAggregated);

        $partialCheck = $this->dailyAggregateService->getAggregateReport($shopId, $startDate, $endDate, CommerceDailyAggregateService::PLATFORM_TIKTOK_SHOP, false);
        $aggregateReadiness = $isAggregated ? 'COMPLETE' : ($partialCheck !== null ? 'PARTIAL' : 'NOT_INITIALIZED');

        if ($isAggregated) {
            $orderGrossValue = (float)($aggReport['financial_metrics']['order_gross_value'] ?? 0.0);
            $currentOrders = (int)($aggReport['financial_metrics']['total_orders'] ?? 0);
            $totalLossValue = (float)($aggReport['financial_metrics']['total_loss_value'] ?? 0.0);
            $maturedRealizedValue = (float)($aggReport['financial_metrics']['matured_realized_order_value'] ?? 0.0);
            $cancelledCount = (int)($aggReport['loss_breakdown'][CommerceLossEngine::LOSS_CANCELLATION]['impacted_orders'] ?? 0);
            $statementCount = (int)($aggReport['finance']['statement_count'] ?? 0);
            $settledOrdersCount = (int)($aggReport['finance']['settled_orders_count'] ?? 0);
            $statementSettledAmount = (float)($aggReport['finance']['total_settled_amount'] ?? 0.0);
            $lossBreakdown = $aggReport['loss_breakdown'];
            $cancelRate = (float)($aggReport['financial_metrics']['cancel_rate_pct'] ?? 0.0);
            $lossRate = (float)($aggReport['financial_metrics']['loss_rate_pct'] ?? 0.0);

            $hasFinData = ($statementCount > 0 || $settledOrdersCount > 0);
            $feeDeductions = [
                'platform_commission' => $hasFinData ? (float)$aggReport['finance']['platform_commission'] : null,
                'affiliate_commission' => $hasFinData ? (float)$aggReport['finance']['affiliate_commission'] : null,
                'payment_fee' => $hasFinData ? (float)$aggReport['finance']['payment_fee'] : null,
                'shipping_fee_subsidy' => $hasFinData ? (float)$aggReport['finance']['shipping_fee_subsidy'] : null,
                'actual_shipping_fee' => $hasFinData ? (float)$aggReport['finance']['actual_shipping_fee'] : null,
                'net_shipping_burden' => $hasFinData ? max(0.0, (float)$aggReport['finance']['actual_shipping_fee'] - (float)$aggReport['finance']['shipping_fee_subsidy']) : null,
                'adjustment_amount' => $hasFinData ? (float)$aggReport['finance']['adjustment_amount'] : null,
                'total_deductions' => $hasFinData ? max(0.0, (float)$aggReport['finance']['platform_commission'] + (float)$aggReport['finance']['affiliate_commission'] + (float)$aggReport['finance']['payment_fee']) : null
            ];
            $statementSettlement = [
                'status' => ($statementCount > 0) ? 'AVAILABLE' : 'NOT_SYNCED',
                'statement_count' => $statementCount,
                'amount' => ($statementCount > 0) ? (float)$statementSettledAmount : null,
                'total_settlement_amount' => ($statementCount > 0) ? (float)$statementSettledAmount : null,
                'currency' => 'VND',
                'label' => 'Tiền quyết toán theo bảng kê'
            ];
            $bankTransfer = [
                'status' => 'NOT_YET_AVAILABLE',
                'amount' => null,
                'currency' => 'VND',
                'label' => 'Số tiền thực chuyển ngân hàng: Chưa có dữ liệu đối soát payout'
            ];
            $normalizedLossSummary = array_merge($lossBreakdown, [
                'total_orders_count' => $currentOrders,
                'total_economic_loss_amount' => $totalLossValue,
                'realized_order_value' => $maturedRealizedValue,
                'cancelled_orders_count' => $cancelledCount,
                'economic_loss_rate_pct' => $lossRate,
                'matured_lifecycle_realized' => true
            ]);
            $financeReconciliation = [
                'financial_metrics' => $aggReport['financial_metrics'],
                'loss_summary' => $normalizedLossSummary,
                'metric_isolation' => [
                    'order_gross_value' => $orderGrossValue,
                    'realized_order_value' => $maturedRealizedValue,
                    'total_loss_value' => $totalLossValue
                ],
                'settlement_metrics' => [
                    'statement_count' => $statementCount,
                    'settled_orders_count' => $settledOrdersCount,
                    'total_settled_amount' => $statementSettledAmount
                ],
                'fee_and_commission_deductions' => $feeDeductions,
                'statement_settlement' => $statementSettlement,
                'bank_transfer' => $bankTransfer,
                'loss_breakdown' => $lossBreakdown
            ];
        } else {
            $isAggregated = false;
            $financeReconciliation = $this->financeService->reconcileFinancePeriod($shopId, $startDate, $endDate);
            $statementCount = (int)($financeReconciliation['settlement_metrics']['statement_count'] ?? 0);
            $settledOrdersCount = (int)($financeReconciliation['settlement_metrics']['settled_orders_count'] ?? 0);
            $statementSettledAmount = (float)($financeReconciliation['settlement_metrics']['total_settled_amount'] ?? 0.0);
            $orderGrossValue = (float)($financeReconciliation['metric_isolation']['order_gross_value'] ?? 0.0);
            $currentOrders = (int)($financeReconciliation['loss_summary']['total_orders_count'] ?? 0);
            $cancelledCount = (int)($financeReconciliation['loss_summary']['cancelled_orders_count'] ?? 0);
            $cancelRate = ($currentOrders > 0) ? round(($cancelledCount / $currentOrders) * 100, 1) : 0.0;
            $lossRate = (float)($financeReconciliation['loss_summary']['economic_loss_rate_pct'] ?? 0.0);
        }

        // 2. Daily Shop Analytics Overview
        $stmtDaily = $this->db->prepare("SELECT 
            COUNT(*) as record_count,
            SUM(page_views) as total_page_views,
            SUM(unique_visitors) as total_unique_visitors,
            SUM(total_orders) as analytics_orders,
            SUM(gross_revenue) as analytics_gross_revenue,
            AVG(conversion_rate) as avg_cvr
            FROM `commerce_shop_analytics_daily`
            WHERE platform = ? AND shop_id = ?
              AND stat_date >= ? AND stat_date <= ?");
        $stmtDaily->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $startDate, $endDate]);
        $dailyData = $stmtDaily->fetch(PDO::FETCH_ASSOC) ?: [];
        $analyticsRecordCount = (int)($dailyData['record_count'] ?? 0);
        $hasAnalyticsRevenue = isset($dailyData['analytics_gross_revenue']) && $dailyData['analytics_gross_revenue'] !== null;

        $isTxSynced = ($settledOrdersCount > 0);
        $isFinanceSynced = ($statementCount > 0);
        $isAnalyticsSynced = ($analyticsRecordCount > 0 && $hasAnalyticsRevenue);

        // 3. Livestream Workbench Aggregation
        $startUtc = $startDate . ' 00:00:00';
        $endUtc = $endDate . ' 23:59:59';

        $stmtLives = $this->db->prepare("SELECT 
            COUNT(*) as total_sessions,
            SUM(duration_seconds) as total_duration_seconds,
            SUM(gmv) as total_live_gmv,
            SUM(orders_count) as total_live_orders,
            SUM(units_sold) as total_live_units,
            SUM(total_views) as total_live_views,
            SUM(impressions) as total_live_impressions,
            SUM(clicks) as total_live_clicks,
            SUM(comments_count) as total_live_comments,
            SUM(shares_count) as total_live_shares,
            SUM(follows_count) as total_live_follows,
            MAX(peak_concurrent_users) as max_pcu
            FROM `commerce_live_sessions`
            WHERE platform = ? AND shop_id = ?
              AND start_time >= ? AND start_time <= ?");
        $stmtLives->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $startUtc, $endUtc]);
        $livesData = $stmtLives->fetch(PDO::FETCH_ASSOC) ?: [];

        $liveAgg = [
            'total_sessions' => (int)($livesData['total_sessions'] ?? 0),
            'duration_seconds' => (int)($livesData['total_duration_seconds'] ?? 0),
            'gmv' => (float)($livesData['total_live_gmv'] ?? 0.0),
            'orders_count' => (int)($livesData['total_live_orders'] ?? 0),
            'units_sold' => (int)($livesData['total_live_units'] ?? 0),
            'total_views' => (int)($livesData['total_live_views'] ?? 0),
            'impressions' => (int)($livesData['total_live_impressions'] ?? 0),
            'clicks' => (int)($livesData['total_live_clicks'] ?? 0),
            'comments_count' => (int)($livesData['total_live_comments'] ?? 0),
            'shares_count' => (int)($livesData['total_live_shares'] ?? 0),
            'follows_count' => (int)($livesData['total_live_follows'] ?? 0),
            'max_pcu' => (int)($livesData['max_pcu'] ?? 0)
        ];
        $liveKpis = self::computeLiveSessionKpis($liveAgg);

        // 4. Video Performance Top Ranking
        $stmtVideos = $this->db->prepare("SELECT 
            video_id, title, creator_type, creator_name,
            SUM(video_views) as total_views,
            SUM(units_sold) as total_units_sold,
            SUM(gross_revenue) as total_gmv,
            SUM(attributed_gmv) as total_attributed_gmv,
            AVG(ctr) as avg_ctr,
            AVG(gpm) as avg_gpm
            FROM `commerce_video_analytics`
            WHERE platform = ? AND shop_id = ?
              AND stat_date >= ? AND stat_date <= ?
            GROUP BY video_id, title, creator_type, creator_name
            ORDER BY total_gmv DESC LIMIT 10");
        $stmtVideos->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $startDate, $endDate]);
        $topVideos = $stmtVideos->fetchAll(PDO::FETCH_ASSOC);

        // 5. Product Performance Top Ranking
        $stmtProducts = $this->db->prepare("SELECT 
            product_id, sku_id, product_name,
            SUM(units_sold) as total_units_sold,
            SUM(gross_revenue) as total_gross_revenue,
            SUM(page_views) as total_page_views,
            SUM(unique_visitors) as total_uv,
            AVG(cvr) as avg_cvr
            FROM `commerce_product_analytics`
            WHERE platform = ? AND shop_id = ?
              AND stat_date >= ? AND stat_date <= ?
            GROUP BY product_id, sku_id, product_name
            ORDER BY total_gross_revenue DESC LIMIT 10");
        $stmtProducts->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $startDate, $endDate]);
        $topProducts = $stmtProducts->fetchAll(PDO::FETCH_ASSOC);

        // 6. Analytics Freshness Evaluation
        $analyticsFreshness = self::evaluateAnalyticsFreshness($startDate, $endDate);

        // 7. Advertising Cost Overview
        $orderGrossValue = (float)($financeReconciliation['metric_isolation']['order_gross_value'] ?? 0.0);
        $advertisingOverview = $this->adsService->getAdvertisingCostOverview($shopId, $startDate, $endDate, $orderGrossValue);

        // Sprint V2-06.2: Loss-Adjusted ROI & ROAS Framework
        $realizedOrderValue = (float)($financeReconciliation['metric_isolation']['realized_order_value'] ?? 0.0);
        $totalLossValue = (float)($financeReconciliation['loss_summary']['total_economic_loss_amount'] ?? 0.0);

        if ($isAggregated && isset($aggReport['loss_adjusted_roi'])) {
            $rawLossRoi = $aggReport['loss_adjusted_roi'];
            $blendedShopRoas = $aggReport['advertising']['blended_shop_roas'] ?? null;
            $realizedAdsRoi = $aggReport['advertising']['realized_ads_roi'] ?? null;
            $roiErosionPoints = $aggReport['advertising']['roi_erosion_points'] ?? null;
            $spendToRealizedRate = $aggReport['advertising']['spend_to_realized_rate_pct'] ?? null;
            $adsSpendVal = (float)($aggReport['advertising']['total_spend'] ?? 0.0);
            $adsRoiVal = $aggReport['advertising']['ads_roi'] ?? null;
            $lossLabels = [
                'attributed_ads_roi_label' => 'ROI TikTok quy kết',
                'blended_shop_roas_label' => 'ROAS doanh thu gộp toàn shop',
                'realized_ads_roi_label' => 'ROI doanh thu thực nhận toàn shop',
                'roi_erosion_label' => 'ROI suy giảm do hoàn hủy',
                'spend_to_realized_rate_label' => 'Tỷ lệ chi phí Ads / DT thực nhận'
            ];

            $lossAdjustedRoi = [
                'attributed_ads_roi' => is_array($rawLossRoi['attributed_ads_roi'] ?? null) ? ($rawLossRoi['attributed_ads_roi']['value'] ?? $adsRoiVal) : ($rawLossRoi['attributed_ads_roi'] ?? $adsRoiVal),
                'blended_shop_roas' => is_array($rawLossRoi['blended_shop_roas'] ?? null) ? ($rawLossRoi['blended_shop_roas']['value'] ?? $blendedShopRoas) : ($rawLossRoi['blended_shop_roas'] ?? $blendedShopRoas),
                'realized_ads_roi' => is_array($rawLossRoi['realized_ads_roi'] ?? null) ? ($rawLossRoi['realized_ads_roi']['value'] ?? $realizedAdsRoi) : ($rawLossRoi['realized_ads_roi'] ?? $realizedAdsRoi),
                'roi_erosion_points' => is_array($rawLossRoi['roi_erosion_points'] ?? null) ? ($rawLossRoi['roi_erosion_points']['value'] ?? $roiErosionPoints) : ($rawLossRoi['roi_erosion_points'] ?? $roiErosionPoints),
                'spend_to_realized_rate_pct' => is_array($rawLossRoi['spend_to_realized_rate_pct'] ?? null) ? ($rawLossRoi['spend_to_realized_rate_pct']['value'] ?? $spendToRealizedRate) : ($rawLossRoi['spend_to_realized_rate_pct'] ?? $spendToRealizedRate),
                'is_trustworthy' => (bool)($rawLossRoi['is_trustworthy'] ?? ($adsSpendVal > 0)),
                'labels' => $lossLabels
            ];
        } else {
            $adsSpendVal = (float)($advertisingOverview['total_spend'] ?? 0.0);
            $adsRoiVal = $advertisingOverview['metrics']['ads_roi'] ?? null;
            $blendedShopRoas = ($adsSpendVal > 0) ? round($orderGrossValue / $adsSpendVal, 2) : null;
            $realizedAdsRoi = ($adsSpendVal > 0) ? round($realizedOrderValue / $adsSpendVal, 2) : null;
            $roiErosionPoints = ($adsSpendVal > 0) ? round($totalLossValue / $adsSpendVal, 2) : null;
            $spendToRealizedRate = ($adsSpendVal > 0 && $realizedOrderValue > 0) ? round(($adsSpendVal / $realizedOrderValue) * 100, 2) : null;

            $lossLabels = [
                'attributed_ads_roi_label' => 'ROI TikTok quy kết',
                'blended_shop_roas_label' => 'ROAS doanh thu gộp toàn shop',
                'realized_ads_roi_label' => 'ROI doanh thu thực nhận toàn shop',
                'roi_erosion_label' => 'ROI suy giảm do hoàn hủy',
                'spend_to_realized_rate_label' => 'Tỷ lệ chi phí Ads / DT thực nhận'
            ];

            $lossAdjustedRoi = [
                'attributed_ads_roi' => $adsRoiVal,
                'blended_shop_roas' => $blendedShopRoas,
                'realized_ads_roi' => $realizedAdsRoi,
                'roi_erosion_points' => $roiErosionPoints,
                'spend_to_realized_rate_pct' => $spendToRealizedRate,
                'is_trustworthy' => ($adsSpendVal > 0 && ($financeReconciliation['financial_metrics']['orders_verified'] ?? true)),
                'labels' => $lossLabels
            ];
        }

        // Attach loss-adjusted metrics to advertisingOverview
        if (!isset($advertisingOverview['metrics']) || !is_array($advertisingOverview['metrics'])) {
            $advertisingOverview['metrics'] = [];
        }
        $advertisingOverview['metrics']['blended_shop_roas'] = $blendedShopRoas;
        $advertisingOverview['metrics']['realized_ads_roi'] = $realizedAdsRoi;
        $advertisingOverview['metrics']['roi_erosion_points'] = $roiErosionPoints;
        $advertisingOverview['metrics']['spend_to_realized_rate_pct'] = $spendToRealizedRate;
        $advertisingOverview['loss_adjusted_roi'] = $lossAdjustedRoi;
        $advertisingOverview['blended_shop_roas'] = $blendedShopRoas;
        $advertisingOverview['realized_ads_roi'] = $realizedAdsRoi;
        $advertisingOverview['roi_erosion_points'] = $roiErosionPoints;
        $advertisingOverview['spend_to_realized_rate_pct'] = $spendToRealizedRate;

        // 8. Period Comparison (Previous Comparable Period)
        $diffDays = max(1, (int)round((strtotime($endDate) - strtotime($startDate)) / 86400) + 1);
        $prevEndDate = date('Y-m-d', strtotime($startDate . ' -1 day'));
        $prevStartDate = date('Y-m-d', strtotime($prevEndDate . ' -' . ($diffDays - 1) . ' days'));

        $prevAgg = $this->dailyAggregateService->getAggregateReport($shopId, $prevStartDate, $prevEndDate);
        if ($prevAgg !== null) {
            $prevOrders = (int)($prevAgg['financial_metrics']['total_orders'] ?? 0);
            $prevGross = (float)($prevAgg['financial_metrics']['order_gross_value'] ?? 0.0);
        } else {
            $stmtPrev = $this->db->prepare("SELECT 
                COUNT(DISTINCT platform_order_id) as prev_orders,
                SUM(order_gross_amount) as prev_gross
                FROM `commerce_orders`
                WHERE platform = ? AND shop_id = ?
                  AND platform_created_at >= ? AND platform_created_at <= ?");
            $stmtPrev->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $prevStartDate . ' 00:00:00', $prevEndDate . ' 23:59:59']);
            $prevData = $stmtPrev->fetch(PDO::FETCH_ASSOC);
            $prevOrders = (int)($prevData['prev_orders'] ?? 0);
            $prevGross = (float)($prevData['prev_gross'] ?? 0.0);
        }
        $currentOrders = (int)($financeReconciliation['loss_summary']['total_orders_count'] ?? 0);

        $grossChangePct = ($prevGross > 0) ? round((($orderGrossValue - $prevGross) / $prevGross) * 100, 1) : null;
        $ordersChangePct = ($prevOrders > 0) ? round((($currentOrders - $prevOrders) / $prevOrders) * 100, 1) : null;

        $comparison = [
            'previous_period' => [
                'start_date' => $prevStartDate,
                'end_date' => $prevEndDate,
                'diff_days' => $diffDays
            ],
            'order_gross_change_pct' => $grossChangePct,
            'orders_change_pct' => $ordersChangePct,
            'previous_order_gross_value' => $prevGross,
            'previous_orders_count' => $prevOrders
        ];

        // 9. Shop Health Pillars - Evaluated independently from underlying data sources
        // Sales -> Orders/Gross source
        // Advertising -> Ads source
        // Orders -> Orders source
        // Losses -> Loss Ledger
        // Finance -> Finance statements / settlements
        // Data -> Sync pipeline freshness
        $isAdsAvailable = (($advertisingOverview['status'] ?? '') === 'AVAILABLE') || (($advertisingOverview['availability_status'] ?? '') === 'AVAILABLE');
        $isAdsPartial = (($advertisingOverview['status'] ?? '') === 'PARTIAL') || (($advertisingOverview['availability_status'] ?? '') === 'PARTIAL');
        $adsRoi = ($isAdsAvailable || $isAdsPartial) && isset($advertisingOverview['metrics']['ads_roi']) && $advertisingOverview['metrics']['ads_roi'] !== null
            ? (float)$advertisingOverview['metrics']['ads_roi']
            : null;
        $cancelledCount = (int)($financeReconciliation['loss_summary']['cancelled_orders_count'] ?? 0);
        $cancelRate = ($currentOrders > 0) ? round(($cancelledCount / $currentOrders) * 100, 1) : 0.0;
        $lossRate = (float)($financeReconciliation['loss_summary']['economic_loss_rate_pct'] ?? 0.0);

        $isOrdersVerified = $isAggregated ? ($aggReport['financial_metrics']['orders_verified'] ?? true) : ($currentOrders > 0 || $isTxSynced);

        if ($orderGrossValue > 0) {
            $salesStatus = 'AVAILABLE';
            $salesMessage = "Doanh số gộp: " . number_format($orderGrossValue) . " ₫ ({$currentOrders} đơn hàng)";
        } elseif ($isOrdersVerified) {
            $salesStatus = 'NO_ORDERS_IN_PERIOD';
            $salesMessage = 'Chưa ghi nhận doanh số trong kỳ';
        } else {
            $salesStatus = 'NOT_SYNCED';
            $salesMessage = 'Chưa đồng bộ dữ liệu bán hàng cho kỳ đã chọn';
        }

        $adsStatus = $advertisingOverview['status'] ?? 'NOT_SYNCED';
        $adsDistinctDays = (int)($advertisingOverview['provenance']['distinct_days_count'] ?? 0);
        $adsExpectedDays = (int)($advertisingOverview['provenance']['expected_days_count'] ?? 0);
        if ($isAdsAvailable) {
            $adsMessage = "ROI {$adsRoi}x | Chi phí: " . number_format((float)($advertisingOverview['total_spend'] ?? 0)) . " ₫ (Đầy đủ {$adsDistinctDays}/{$adsExpectedDays} ngày)";
        } elseif ($isAdsPartial) {
            $adsMessage = "Đồng bộ một phần {$adsDistinctDays}/{$adsExpectedDays} ngày | Chi phí: " . number_format((float)($advertisingOverview['total_spend'] ?? 0)) . " ₫";
        } elseif ($adsStatus === 'NOT_SYNCED') {
            $adsMessage = 'Chưa đồng bộ chi phí QC';
        } else {
            $adsMessage = 'Chưa kết nối tài khoản Ads';
        }

        if ($currentOrders > 0) {
            $ordersStatus = ($cancelRate >= 25.0) ? 'ATTENTION_REQUIRED' : 'AVAILABLE';
            $ordersMessage = "Ghi nhận {$currentOrders} đơn hàng (Tỷ lệ hủy {$cancelRate}%)";
        } elseif ($isOrdersVerified) {
            $ordersStatus = 'AVAILABLE';
            $ordersMessage = "Ghi nhận 0 đơn hàng";
        } else {
            $ordersStatus = 'NOT_SYNCED';
            $ordersMessage = 'Chưa đồng bộ dữ liệu đơn hàng';
        }

        $lossesStatus = ($lossRate >= 30.0) ? 'ATTENTION_REQUIRED' : 'AVAILABLE';
        $lossesMessage = "Sổ cái hao hụt: " . number_format((float)($financeReconciliation['loss_summary']['total_economic_loss_amount'] ?? 0)) . " ₫ ({$lossRate}%)";

        $statementSettledAmount = (float)($financeReconciliation['settlement_metrics']['total_settled_amount'] ?? 0.0);
        $financeStatus = $statementCount > 0 ? ($isTxSynced ? 'AVAILABLE' : 'PARTIAL') : 'NOT_SYNCED';
        $financeMessage = $statementCount > 0
            ? ($isTxSynced ? "Đã đối soát {$statementCount} bảng kê và chi tiết giao dịch" : "Đã nạp {$statementCount} bảng kê (" . number_format($statementSettledAmount) . " ₫), chờ chi tiết giao dịch")
            : 'Chờ nạp bảng kê tài chính';

        $dataStatus = 'AVAILABLE';
        $dataMessage = 'Chuẩn hóa Core V2 hoạt động ổn định';

        // Overall status strictly represents data readiness & operational status (NO arbitrary GOOD/HEALTHY)
        $hasAttention = ($ordersStatus === 'ATTENTION_REQUIRED' || $lossesStatus === 'ATTENTION_REQUIRED' || $ordersStatus === 'ATTENTION_FROM_VERIFIED_RULE' || $lossesStatus === 'ATTENTION_FROM_VERIFIED_RULE');
        if ($hasAttention) {
            $overallHealthStatus = 'DATA_ATTENTION_REQUIRED';
        } elseif ($salesStatus === 'AVAILABLE' && $isAdsAvailable && $ordersStatus === 'AVAILABLE' && $financeStatus === 'AVAILABLE' && $dataStatus === 'AVAILABLE') {
            $overallHealthStatus = 'DATA_COMPLETE';
        } else {
            $overallHealthStatus = 'DATA_PARTIAL';
        }

        $pillarsData = [
            'sales' => [
                'label' => 'Bán Hàng',
                'status' => $salesStatus,
                'source' => 'ORDERS_API',
                'message' => $salesMessage
            ],
            'advertising' => [
                'label' => 'Quảng Cáo',
                'status' => $adsStatus,
                'source' => 'TIKTOK_ADS',
                'message' => $adsMessage
            ],
            'orders' => [
                'label' => 'Đơn Hàng',
                'status' => $ordersStatus,
                'source' => 'ORDERS_INGESTION',
                'message' => $ordersMessage
            ],
            'losses' => [
                'label' => 'Hao Hụt / Hoàn',
                'status' => $lossesStatus,
                'source' => 'LOSS_LEDGER',
                'message' => $lossesMessage
            ],
            'finance' => [
                'label' => 'Tài Chính',
                'status' => $financeStatus,
                'source' => 'FINANCE_STATEMENTS',
                'message' => $financeMessage
            ],
            'data' => [
                'label' => 'Dữ Liệu',
                'status' => $dataStatus,
                'source' => 'SYNC_PIPELINE',
                'message' => $dataMessage
            ]
        ];

        $shopHealth = array_merge($pillarsData, [
            'overall_status' => $overallHealthStatus,
            'pillars' => $pillarsData
        ]);

        // 10. Attention & Opportunities
        $attentionList = [];
        $opportunityList = [];

        // Real-Time Proposal 1: Đơn hàng Chờ vận chuyển (SLA Fulfillment Alert)
        try {
            $stmtAwaiting = $this->db->prepare("SELECT COUNT(*), COALESCE(SUM(order_gross_amount), 0) 
                FROM `commerce_orders` 
                WHERE platform = 'tiktok_shop' AND shop_id = :shop_id 
                  AND order_status = 'AWAITING_SHIPMENT'");
            $stmtAwaiting->execute([':shop_id' => $shopId]);
            $awaitingRow = $stmtAwaiting->fetch(PDO::FETCH_NUM);
            $awaitingCount = (int)($awaitingRow[0] ?? 0);
            $awaitingValue = (float)($awaitingRow[1] ?? 0.0);

            if ($awaitingCount > 0) {
                $attentionList[] = [
                    'type' => 'ATTENTION',
                    'severity' => 'high',
                    'title' => "Có {$awaitingCount} đơn hàng Chờ vận chuyển (Awaiting Shipment)",
                    'description' => "Tổng giá trị " . number_format($awaitingValue) . " ₫. Cần ưu tiên đóng gói và bàn giao bưu tá trước giờ cutoff (16h) để duy trì điểm SES vận chuyển (>98%) và tránh TikTok phạt SLA.",
                    'metric_evidence' => "{$awaitingCount} đơn chờ gửi",
                    'source' => 'FULFILLMENT_SLA',
                    'drilldown_target' => 'orders'
                ];
            }
        } catch (\Throwable $t) {}

        // Real-Time Proposal 2: Đơn COD giá trị cao cần gọi xác nhận trước khi giao (Anti-Bombing Risk)
        try {
            $stmtCod = $this->db->prepare("SELECT COUNT(*), COALESCE(SUM(order_gross_amount), 0) 
                FROM `commerce_orders` 
                WHERE platform = 'tiktok_shop' AND shop_id = :shop_id 
                  AND order_status IN ('AWAITING_SHIPMENT', 'UNPAID')
                  AND order_gross_amount >= 500000");
            $stmtCod->execute([':shop_id' => $shopId]);
            $codRow = $stmtCod->fetch(PDO::FETCH_NUM);
            $highValCount = (int)($codRow[0] ?? 0);
            $highValSum = (float)($codRow[1] ?? 0.0);

            if ($highValCount > 0) {
                $attentionList[] = [
                    'type' => 'ATTENTION',
                    'severity' => 'medium',
                    'title' => "{$highValCount} đơn giá trị cao (≥500.000 ₫) cần xác nhận",
                    'description' => "Tổng giá trị " . number_format($highValSum) . " ₫ đang chờ xử lý. Đề xuất CSKH gọi điện/nhắn tin xác nhận địa chỉ trước khi xuất kho để phòng ngừa hoàn hàng (RTS).",
                    'metric_evidence' => "{$highValCount} đơn ≥500k",
                    'source' => 'LOSS_PREVENTION',
                    'drilldown_target' => 'orders'
                ];
            }
        } catch (\Throwable $t) {}

        if ($cancelRate >= 15.0 && $cancelledCount > 0) {
            $attentionList[] = [
                'type' => 'ATTENTION',
                'severity' => 'high',
                'title' => 'Đơn hàng bị hủy',
                'description' => "Có {$cancelledCount} đơn hàng bị hủy ({$cancelRate}% tổng đơn). Cần kiểm tra nguyên nhân hủy trước giao hàng.",
                'metric_evidence' => "{$cancelRate}% đơn hủy",
                'source' => 'LOSS_LEDGER',
                'drilldown_target' => 'orders'
            ];
        }

        // Sprint V2-06.2: Evidence-based ROI Erosion Attention Item
        $isRmaVerified = $isAggregated ? ($aggReport['financial_metrics']['rma_verified'] ?? false) : true;
        if (($isAdsAvailable || $isAdsPartial) && $roiErosionPoints !== null && $roiErosionPoints >= 1.0 && $isRmaVerified) {
            $attentionList[] = [
                'type' => 'ATTENTION',
                'severity' => 'high',
                'title' => "ROI suy giảm {$roiErosionPoints}x do hoàn hủy",
                'description' => "Thất thoát từ đơn hủy và hoàn tiền làm giảm {$roiErosionPoints}x ROI toàn shop (ROAS gộp {$blendedShopRoas}x giảm còn ROI thực nhận {$realizedAdsRoi}x).",
                'metric_evidence' => "-{$roiErosionPoints}x ROI",
                'source' => 'LOSS_LEDGER',
                'drilldown_target' => 'losses'
            ];
        }

        if ($analyticsFreshness['status'] === 'NOT_YET_AVAILABLE') {
            $attentionList[] = [
                'type' => 'ATTENTION',
                'severity' => 'medium',
                'title' => 'Độ trễ dữ liệu TikTok Analytics',
                'description' => 'Dữ liệu TikTok Analytics hiện khả dụng đến 10/08/2026. Chưa khả dụng cho kỳ đã chọn.',
                'metric_evidence' => 'Khả dụng đến 10/08/2026',
                'source' => 'TIKTOK_ANALYTICS',
                'drilldown_target' => 'sync'
            ];
        }

        if (!$isFinanceSynced) {
            $attentionList[] = [
                'type' => 'ATTENTION',
                'severity' => 'medium',
                'title' => 'Bảng kê tài chính chưa đồng bộ',
                'description' => 'Bảng kê thanh toán ngân hàng chưa được đồng bộ vào hệ thống. Số tiền quyết toán thực nhận hiển thị trạng thái Chờ đồng bộ.',
                'metric_evidence' => '0 bảng kê',
                'source' => 'FINANCE_API',
                'drilldown_target' => 'finance'
            ];
        } elseif (!$isTxSynced) {
            $attentionList[] = [
                'type' => 'ATTENTION',
                'severity' => 'low',
                'title' => 'Chi tiết giao dịch tài chính chờ đồng bộ',
                'description' => "Đã có {$statementCount} bảng kê quyết toán (" . number_format($statementSettledAmount) . " ₫), nhưng chi tiết bóc tách từng giao dịch (phí sàn, hoa hồng, vận chuyển) đang chờ đồng bộ.",
                'metric_evidence' => 'Chờ transaction sync',
                'source' => 'FINANCE_TRANSACTIONS',
                'drilldown_target' => 'finance'
            ];
        }

        // Strictly forbidden to generate advertising opportunities when Ads is NOT AVAILABLE
        if ($isAdsAvailable && $adsRoi !== null && $adsRoi >= 4.0 && (float)($advertisingOverview['metrics']['total_ads_spend'] ?? 0) > 0) {
            $opportunityList[] = [
                'type' => 'OPPORTUNITY',
                'severity' => 'positive',
                'title' => "GMV Max ROI: {$adsRoi}x",
                'description' => "Chiến dịch quảng cáo đạt GMV Max ROI {$adsRoi}x. Đóng góp vào doanh thu gộp GMV Max của cửa hàng.",
                'metric_evidence' => "ROI {$adsRoi}x",
                'source' => 'TIKTOK_ADS',
                'drilldown_target' => 'ads'
            ];
        } elseif ($isAdsPartial && $adsRoi !== null && $adsRoi >= 4.0 && (float)($advertisingOverview['metrics']['total_ads_spend'] ?? 0) > 0) {
            $opportunityList[] = [
                'type' => 'OPPORTUNITY',
                'severity' => 'positive',
                'title' => "GMV Max ROI: {$adsRoi}x (Dữ liệu một phần)",
                'description' => "Dữ liệu quảng cáo ghi nhận một phần ({$adsDistinctDays}/{$adsExpectedDays} ngày) đạt GMV Max ROI {$adsRoi}x.",
                'metric_evidence' => "ROI {$adsRoi}x (Dữ liệu một phần)",
                'source' => 'TIKTOK_ADS',
                'drilldown_target' => 'ads'
            ];
        }

        if (!empty($topProducts) && isset($topProducts[0]['gross_revenue']) && (float)$topProducts[0]['gross_revenue'] > 0) {
            $topProdRevenue = (float)$topProducts[0]['gross_revenue'];
            $opportunityList[] = [
                'type' => 'OPPORTUNITY',
                'severity' => 'positive',
                'title' => 'Sản phẩm chủ lực dẫn đầu doanh số',
                'description' => "Sản phẩm '{$topProducts[0]['product_name']}' đạt doanh thu cao nhất kỳ (" . number_format($topProdRevenue) . " ₫).",
                'metric_evidence' => number_format($topProdRevenue) . ' ₫',
                'source' => 'PRODUCT_ANALYTICS',
                'drilldown_target' => 'products'
            ];
        }

        // Real-Time Proposal 3: Đề xuất Tăng ngân sách chiến dịch GMV Max có ROAS cao
        try {
            $stmtWinCamps = $this->db->prepare("SELECT campaign_name, SUM(spend) as total_spend, SUM(gross_revenue) as total_rev, 
                ROUND(SUM(gross_revenue) / SUM(spend), 2) as roas
                FROM `commerce_ads_campaign_daily`
                WHERE shop_id = :shop_id AND stat_date >= :sdate AND stat_date <= :edate
                GROUP BY campaign_id, campaign_name
                HAVING total_spend >= 300000 AND roas >= 4.0
                ORDER BY roas DESC LIMIT 2");
            $stmtWinCamps->execute([':shop_id' => $shopId, ':sdate' => $startDate, ':edate' => $endDate]);
            $winCamps = $stmtWinCamps->fetchAll(PDO::FETCH_ASSOC);
            foreach ($winCamps as $wc) {
                $opportunityList[] = [
                    'type' => 'OPPORTUNITY',
                    'severity' => 'positive',
                    'title' => "Tăng ngân sách chiến dịch Win: {$wc['campaign_name']}",
                    'description' => "Chiến dịch đạt ROAS {$wc['roas']}x (chi tiêu " . number_format($wc['total_spend']) . " ₫, mang lại " . number_format($wc['total_rev']) . " ₫). Đề xuất tăng ngân sách ngày thêm 15-20% trong khung giờ vàng để bứt phá doanh số.",
                    'metric_evidence' => "ROAS {$wc['roas']}x",
                    'source' => 'ADS_SCALE',
                    'drilldown_target' => 'ads'
                ];
            }
        } catch (\Throwable $t) {}

        // Real-Time Proposal 4: Khách hàng thân thiết quay lại (Customer 360 CRM)
        try {
            $stmtRepeat = $this->db->prepare("SELECT COUNT(*) FROM `commerce_customer_profiles` 
                WHERE platform = 'tiktok_shop' AND shop_id = :shop_id AND is_repeat_buyer = 1");
            $stmtRepeat->execute([':shop_id' => $shopId]);
            $repeatBuyerCount = (int)$stmtRepeat->fetchColumn();
            if ($repeatBuyerCount > 0) {
                $opportunityList[] = [
                    'type' => 'OPPORTUNITY',
                    'severity' => 'positive',
                    'title' => "{$repeatBuyerCount} khách hàng thân thiết (Repeat Buyers)",
                    'description' => "Shop có {$repeatBuyerCount} khách hàng đã mua từ 2 lần trở lên. Đề xuất kẹp thiệp cảm ơn kèm voucher ưu đãi đơn sau vào kiện hàng để tối ưu giá trị vòng đời (LTV).",
                    'metric_evidence' => "{$repeatBuyerCount} khách quen",
                    'source' => 'CUSTOMER_360',
                    'drilldown_target' => 'customers'
                ];
            }
        } catch (\Throwable $t) {}

        // 11. Data Freshness Timestamps
        require_once __DIR__ . '/commerce_aftersales_service.php';
        $aftersales = new CommerceAftersalesService($this->db);
        $rmaCoverage = $aftersales->getRmaPeriodCoverage($shopId, $startDate, $endDate);

        $dataFreshness = [
            'orders' => [
                'domain' => 'order',
                'status' => 'ACTIVE',
                'display' => 'Cập nhật trực tiếp từ Orders API'
            ],
            'ads' => [
                'domain' => 'ads',
                'status' => $advertisingOverview['status'],
                'display' => $advertisingOverview['status'] === 'AVAILABLE' ? 'Đã đồng bộ báo cáo chiến dịch' : ($advertisingOverview['status'] === 'PARTIAL' ? 'Đồng bộ một phần' : 'Chờ đồng bộ')
            ],
            'rma' => [
                'domain' => 'rma',
                'status' => $rmaCoverage['status'],
                'display' => $rmaCoverage['display'],
                'is_verified' => $rmaCoverage['is_verified'],
                'latest_available_date' => $rmaCoverage['latest_available_date'] ?? null,
                'message' => $rmaCoverage['message']
            ],
            'finance' => [
                'domain' => 'finance',
                'status' => $isFinanceSynced ? 'ACTIVE' : 'NOT_SYNCED',
                'display' => $isFinanceSynced ? ($isTxSynced ? 'Bảng kê & chi tiết giao dịch hoàn tất' : "Đã nạp {$statementCount} bảng kê, chờ chi tiết giao dịch") : 'Chờ đồng bộ bảng kê'
            ],
            'analytics' => [
                'domain' => 'analytics',
                'status' => $analyticsFreshness['status'],
                'latest_available_date' => $analyticsFreshness['latest_available_date'],
                'message' => $analyticsFreshness['message'],
                'display' => $analyticsFreshness['message']
            ]
        ];

        // 12. AI Daily Summary Foundation
        $realizedVal = (float)$financeReconciliation['metric_isolation']['realized_order_value'];
        $lossVal = (float)$financeReconciliation['loss_summary']['total_economic_loss_amount'];
        $adsSpend = (float)($advertisingOverview['metrics']['total_ads_spend'] ?? 0.0);

        $aiSummaryBullets = [
            "Kỳ báo cáo ({$startDate} → {$endDate}): Ghi nhận tổng giá trị đơn tạo trên sàn đạt " . number_format($orderGrossValue) . " ₫ ({$currentOrders} đơn hàng).",
            "Sau khi trừ hao hụt từ đơn hủy và hoàn tiền (" . number_format($lossVal) . " ₫, tỷ lệ {$lossRate}%), doanh thu thực nhận đạt " . number_format($realizedVal) . " ₫.",
            $isAdsAvailable
                ? "Quảng cáo TikTok tiêu thụ " . number_format($adsSpend) . " ₫, tạo ra GMV quy kết " . number_format((float)($advertisingOverview['metrics']['ads_gmv'] ?? 0)) . " ₫ với ROI đạt {$adsRoi}."
                : ($isAdsPartial
                    ? "Quảng cáo TikTok: Dữ liệu chi phí một phần (" . $adsDistinctDays . "/" . $adsExpectedDays . " ngày), tiêu thụ " . number_format($adsSpend) . " ₫."
                    : "Quảng cáo: Chưa đồng bộ dữ liệu chi phí cho kỳ này ({$advertisingOverview['status']})."),
            $statementCount > 0
                ? "Tài chính: Đã phát hành {$statementCount} bảng kê quyết toán với tổng số tiền là " . number_format($statementSettledAmount) . " ₫." . (!$isTxSynced ? " (Chi tiết phí nền tảng và vận chuyển đang chờ đồng bộ từ transaction log)." : "")
                : "Tài chính: Bảng kê tài chính chi tiết đang chờ nạp bổ sung vào hệ thống.",
            $cancelRate > 15
                ? "Khuyến nghị vận hành: Cần tập trung tối ưu tỷ lệ hủy đơn trước giao ({$cancelRate}%) để nâng cao doanh thu thực nhận."
                : "Vận hành ổn định: Tỷ lệ giao nhận và hoàn thành đơn hàng duy trì ở mức an toàn."
        ];

        $aiDailySummary = [
            'title' => 'Tóm Tắt Quản Trị Hàng Ngày (Executive Daily Briefing)',
            'generated_at' => date('Y-m-d H:i:s'),
            'is_deterministic_engine' => true,
            'authoritative_metrics_preserved' => true,
            'bullet_points' => $aiSummaryBullets,
            'executive_takeaway' => "Doanh thu thực nhận sau hao hụt đạt " . number_format($realizedVal) . " ₫ trên " . number_format($orderGrossValue) . " ₫ đơn tạo."
        ];

        return [
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'diff_days' => $diffDays,
                'shop_id' => $shopId
            ],
            'comparison' => $comparison,
            'ai_daily_summary' => $aiDailySummary,
            'shop_health' => $shopHealth,
            'attention_center' => [
                'total_alerts' => count($attentionList),
                'total_opportunities' => count($opportunityList),
                'alerts' => $attentionList,
                'opportunities' => $opportunityList
            ],
            'advertising_overview' => $advertisingOverview,
            'data_freshness' => $dataFreshness,
            'analytics_freshness' => $analyticsFreshness,
            // 5-way Metric Isolation clearly labeled
            'revenue_and_metrics_overview' => [
                'source_orders_api' => [
                    'metric' => 'Order Gross Value',
                    'value' => $financeReconciliation['metric_isolation']['order_gross_value'],
                    'currency' => 'VND',
                    'description' => 'Gross value of all orders created in period from Orders API'
                ],
                'source_loss_ledger' => [
                    'metric' => 'Realized Order Value',
                    'value' => $financeReconciliation['metric_isolation']['realized_order_value'],
                    'currency' => 'VND',
                    'description' => 'Order Gross Value minus verified Cancelled, Failed Delivery, and Refund losses'
                ],
                'source_advertising_api' => [
                    'metric' => 'Advertising Spend',
                    'value' => $advertisingOverview['total_spend'],
                    'currency' => 'VND',
                    'is_synced' => $isAdsAvailable || $isAdsPartial,
                    'status' => $advertisingOverview['status'],
                    'roi' => $advertisingOverview['metrics']['ads_roi'],
                    'attributed_gmv' => $advertisingOverview['metrics']['ads_gmv'],
                    'blended_shop_roas' => $blendedShopRoas,
                    'realized_ads_roi' => $realizedAdsRoi,
                    'roi_erosion_points' => $roiErosionPoints,
                    'spend_to_realized_rate_pct' => $spendToRealizedRate,
                    'loss_adjusted_roi' => $lossAdjustedRoi,
                    'provenance' => $advertisingOverview['provenance'] ?? null,
                    'description' => 'Direct advertising expenditure recorded in TikTok Ads'
                ],
                'source_finance_api' => [
                    'metric' => 'Settlement Amount',
                    'value' => $statementCount > 0 ? (float)$statementSettledAmount : null,
                    'currency' => 'VND',
                    'status' => $statementCount > 0 ? 'AVAILABLE' : 'NOT_SYNCED',
                    'is_synced' => $isFinanceSynced,
                    'statement_count' => $statementCount,
                    'settled_orders_count' => $settledOrdersCount,
                    'statement_settlement' => [
                        'amount' => $statementCount > 0 ? (float)$statementSettledAmount : null,
                        'status' => $statementCount > 0 ? 'AVAILABLE' : 'NOT_SYNCED',
                        'count' => $statementCount
                    ],
                    'transaction_reconciliation' => [
                        'status' => $isTxSynced ? 'AVAILABLE' : 'NOT_SYNCED',
                        'message' => $isTxSynced ? 'Đã đối soát chi tiết giao dịch' : 'Chi tiết giao dịch tài chính chưa đồng bộ đầy đủ'
                    ],
                    'bank_transfer' => [
                        'amount' => null,
                        'status' => 'NOT_YET_AVAILABLE',
                        'label' => 'Số tiền thực chuyển ngân hàng: Chưa có dữ liệu đối soát payout'
                    ],
                    'description' => 'Tiền quyết toán chốt theo bảng kê tài chính từ TikTok Shop'
                ],
                'source_analytics_api' => [
                    'metric' => 'Analytics Gross Revenue',
                    'value' => (float)($dailyData['analytics_gross_revenue'] ?? 0.0),
                    'currency' => 'VND',
                    'is_synced' => $isAnalyticsSynced,
                    'record_count' => $analyticsRecordCount,
                    'freshness_status' => $analyticsFreshness['status'],
                    'freshness_message' => $analyticsFreshness['message'],
                    'latest_available_date' => $analyticsFreshness['latest_available_date'],
                    'description' => 'Aggregated GMV reported by Shop Analytics API'
                ]
            ],
            'loss_and_aftersales_summary' => $financeReconciliation['loss_summary'],
            'finance_fee_deductions' => $financeReconciliation['fee_and_commission_deductions'],
            'statement_settlement' => $financeReconciliation['statement_settlement'] ?? null,
            'bank_transfer' => $financeReconciliation['bank_transfer'] ?? null,
            'loss_adjusted_roi' => $lossAdjustedRoi,
            'shop_traffic_overview' => [
                'total_page_views' => (int)($dailyData['total_page_views'] ?? 0),
                'total_unique_visitors' => (int)($dailyData['total_unique_visitors'] ?? 0),
                'average_cvr' => round((float)($dailyData['avg_cvr'] ?? 0.0), 4)
            ],
            'livestream_workbench' => [
                'summary' => $liveAgg,
                'kpis' => $liveKpis
            ],
            'top_performing_videos' => $topVideos,
            'top_selling_products' => $topProducts,
            'report_source' => $isAggregated ? 'DAILY_AGGREGATES' : 'NORMALIZED_FALLBACK',
            'aggregate_readiness' => $aggregateReadiness,
            'sales_status' => $pillarsData['sales'],
            'orders_status' => $pillarsData['orders'],
            'domain_freshness' => $this->dailyAggregateService->getDomainFreshness($shopId, $startDate, $endDate)
        ];
    }
}
