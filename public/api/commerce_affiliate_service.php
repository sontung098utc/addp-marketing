<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - AFFILIATE & CREATOR INTELLIGENCE SERVICE
 * Component: P0-01 Affiliate Data Integrity & Official TikTok Shop API
 * 
 * Target:
 * 1. API ONLY Data Ingestion: Official TikTok Shop Seller Affiliate Orders API
 *    Endpoint: POST /affiliate_seller/202410/orders/search (Scope: seller.affiliate_collaboration.read)
 * 2. Zero Fabrication & Data Integrity:
 *    - Removed all hardcoded commission rates (10%, 9%, 1%).
 *    - Removed arbitrary Organic/Ads split (70%/30%).
 *    - Real settled commissions from commerce_finance_transactions.affiliate_commission.
 *    - Real order-level commissions from commerce_affiliate_orders.
 * 3. Graceful Scope & Permission Management:
 *    - Structured PERMISSION_REQUIRED state when API scope is unauthorized.
 *    - Missing data yields null / PENDING_API_DATA, never fabricated percentages.
 * 4. Accounting Invariant:
 *    - Gross GMV, Estimated Commission, Settled Commission, and Ineligible Commission strictly tracked.
 * 5. UTF-8 BOM CSV Export with authentic metrics.
 * ====================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/tiktok_client.php';

class CommerceAffiliateService {
    public const PLATFORM = 'tiktok_shop';
    public const SCOPE_AFFILIATE_ORDERS = 'seller.affiliate_collaboration.read';

    private PDO $db;
    private TikTokShopClient $client;
    private ?bool $affiliateTableExists = null;

    public function __construct(?PDO $db = null, ?TikTokShopClient $client = null) {
        $this->db = $db ?? getDBConnection();
        $this->client = $client ?? new TikTokShopClient();
    }

    /**
     * Checks if commerce_affiliate_orders table exists in current database schema
     */
    private function checkTableExists(): bool {
        if ($this->affiliateTableExists !== null) {
            return $this->affiliateTableExists;
        }

        try {
            $stmt = $this->db->query("SHOW TABLES LIKE 'commerce_affiliate_orders'");
            $this->affiliateTableExists = (bool)($stmt && $stmt->fetchColumn());
        } catch (\Throwable $t) {
            $this->affiliateTableExists = false;
        }

        return $this->affiliateTableExists;
    }

    /**
     * Resolves TikTok Shop access token and shop cipher
     */
    private function resolveShopAuth(string $shopId): array {
        $accessToken = '';
        $shopCipher = '';

        // 1. Try tiktok_shops table
        try {
            $stmt = $this->db->prepare("SELECT access_token, cipher FROM `tiktok_shops` WHERE shop_id = ? LIMIT 1");
            $stmt->execute([$shopId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $accessToken = (string)($row['access_token'] ?? '');
                $shopCipher = (string)($row['cipher'] ?? '');
            }
        } catch (\Throwable $t) {}

        // 2. Fallback to environment / config constants
        if ($accessToken === '' && defined('TIKTOK_ACCESS_TOKEN')) {
            $accessToken = (string)TIKTOK_ACCESS_TOKEN;
        }
        if ($shopCipher === '' && defined('TIKTOK_SHOP_CIPHER')) {
            $shopCipher = (string)TIKTOK_SHOP_CIPHER;
        }

        // 3. Resolve shop cipher via client if access token is present
        if ($accessToken !== '' && $shopCipher === '') {
            try {
                $shopCipher = $this->client->resolveShopCipher($shopId, $accessToken);
            } catch (\Throwable $t) {}
        }

        return [$accessToken, $shopCipher];
    }

    /**
     * Synchronizes authenticated affiliate orders from TikTok Shop Open API
     * Endpoint: POST /affiliate_seller/202410/orders/search
     * Scope: seller.affiliate_collaboration.read
     */
    public function syncAffiliateOrders(string $shopId, ?string $startDate = null, ?string $endDate = null, array $options = []): array {
        [$accessToken, $shopCipher] = $this->resolveShopAuth($shopId);

        if (empty($accessToken)) {
            return [
                'success' => false,
                'status' => 'TOKEN_REQUIRED',
                'message' => "Shop {$shopId} chưa kết nối TikTok Shop API hoặc thiếu Access Token hợp lệ.",
                'records_synced' => 0
            ];
        }

        if (empty($shopCipher)) {
            return [
                'success' => false,
                'status' => 'CIPHER_REQUIRED',
                'message' => "Không tìm thấy Shop Cipher hợp lệ cho shop {$shopId}.",
                'records_synced' => 0
            ];
        }

        if (!$this->checkTableExists()) {
            return [
                'success' => false,
                'status' => 'SCHEMA_MIGRATION_REQUIRED',
                'message' => 'Bảng commerce_affiliate_orders chưa được tạo. Vui lòng chạy migration 20261009_021_create_commerce_affiliate_orders.sql.',
                'records_synced' => 0
            ];
        }

        $startTs = $startDate ? strtotime($startDate . ' 00:00:00') : strtotime('-30 days 00:00:00');
        $endTs = $endDate ? strtotime($endDate . ' 23:59:59') : time();

        $pageSize = isset($options['page_size']) ? (int)$options['page_size'] : 50;
        $maxPages = isset($options['max_pages']) ? (int)$options['max_pages'] : 20;
        $pageToken = null;
        $pageCount = 0;
        $totalSynced = 0;

        $upsertSql = "INSERT INTO `commerce_affiliate_orders` (
            `platform`, `shop_id`, `affiliate_order_id`, `platform_order_id`, `sku_id`,
            `product_id`, `product_name`, `creator_id`, `creator_username`, `creator_nickname`,
            `creator_type`, `content_type`, `content_id`, `traffic_source`, `order_status`,
            `commission_status`, `order_amount`, `commission_rate_pct`, `estimated_commission`,
            `settled_commission`, `ineligible_commission`, `currency`, `order_created_at`,
            `settled_at`, `raw_payload`
        ) VALUES (
            :platform, :shop_id, :affiliate_order_id, :platform_order_id, :sku_id,
            :product_id, :product_name, :creator_id, :creator_username, :creator_nickname,
            :creator_type, :content_type, :content_id, :traffic_source, :order_status,
            :commission_status, :order_amount, :commission_rate_pct, :estimated_commission,
            :settled_commission, :ineligible_commission, :currency, :order_created_at,
            :settled_at, :raw_payload
        ) ON DUPLICATE KEY UPDATE
            `product_name` = VALUES(`product_name`),
            `creator_username` = VALUES(`creator_username`),
            `creator_nickname` = VALUES(`creator_nickname`),
            `content_type` = VALUES(`content_type`),
            `traffic_source` = VALUES(`traffic_source`),
            `order_status` = VALUES(`order_status`),
            `commission_status` = VALUES(`commission_status`),
            `order_amount` = VALUES(`order_amount`),
            `commission_rate_pct` = VALUES(`commission_rate_pct`),
            `estimated_commission` = VALUES(`estimated_commission`),
            `settled_commission` = VALUES(`settled_commission`),
            `ineligible_commission` = VALUES(`ineligible_commission`),
            `settled_at` = VALUES(`settled_at`),
            `raw_payload` = VALUES(`raw_payload`),
            `updated_at` = CURRENT_TIMESTAMP";

        $stmtUpsert = $this->db->prepare($upsertSql);

        while ($pageCount < $maxPages) {
            $pageCount++;

            try {
                $apiRes = $this->client->searchAffiliateOrders($accessToken, $shopCipher, [
                    'page_size' => $pageSize,
                    'page_token' => $pageToken,
                    'create_time_ge' => $startTs,
                    'create_time_lt' => $endTs
                ]);
            } catch (\Throwable $e) {
                $msg = $e->getMessage();
                // Check if error is due to scope / permissions
                if (
                    str_contains($msg, '105001') ||
                    stripos($msg, 'scope') !== false ||
                    stripos($msg, 'permission') !== false ||
                    stripos($msg, 'access denied') !== false ||
                    stripos($msg, 'unauthorized') !== false ||
                    stripos($msg, 'forbidden') !== false
                ) {
                    return [
                        'success' => false,
                        'status' => 'PERMISSION_REQUIRED',
                        'scope' => self::SCOPE_AFFILIATE_ORDERS,
                        'message' => 'Ứng dụng chưa được cấp quyền ' . self::SCOPE_AFFILIATE_ORDERS . ' trên TikTok Shop App Console. Vui lòng bật scope này trên Partner Center.',
                        'records_synced' => $totalSynced,
                        'pages_fetched' => $pageCount - 1
                    ];
                }

                return [
                    'success' => false,
                    'status' => 'API_ERROR',
                    'message' => 'Lỗi kết nối TikTok Affiliate API: ' . $msg,
                    'records_synced' => $totalSynced
                ];
            }

            $orders = $apiRes['data']['orders'] ?? $apiRes['data']['affiliate_orders'] ?? [];
            if (empty($orders)) {
                break;
            }

            $this->db->beginTransaction();
            try {
                foreach ($orders as $ord) {
                    $affId = (string)($ord['affiliate_order_id'] ?? $ord['order_id'] ?? '');
                    if ($affId === '') continue;

                    $platOrderId = (string)($ord['order_id'] ?? $ord['platform_order_id'] ?? $affId);
                    $skuId = (string)($ord['sku_id'] ?? '');
                    $prodId = (string)($ord['product_id'] ?? '');
                    $prodName = (string)($ord['product_name'] ?? '');
                    $creatorId = (string)($ord['creator_id'] ?? $ord['kol_id'] ?? '');
                    $creatorUser = (string)($ord['creator_username'] ?? $ord['kol_username'] ?? '');
                    $creatorNick = (string)($ord['creator_nickname'] ?? $ord['kol_nickname'] ?? '');
                    $creatorType = (string)($ord['creator_type'] ?? 'AFFILIATE');

                    $contentType = strtoupper((string)($ord['content_type'] ?? $ord['traffic_type'] ?? 'UNKNOWN'));
                    $contentId = (string)($ord['content_id'] ?? $ord['video_id'] ?? $ord['room_id'] ?? '');
                    
                    // Strict traffic source attribution
                    $isAds = !empty($ord['is_ads']) || !empty($ord['ads_amplified']) || (isset($ord['traffic_source']) && strtoupper((string)$ord['traffic_source']) === 'PAID_ADS');
                    $trafficSource = $isAds ? 'PAID_ADS' : (!empty($ord['traffic_source']) ? strtoupper((string)$ord['traffic_source']) : 'ORGANIC');

                    $orderStatus = strtoupper((string)($ord['order_status'] ?? 'PENDING'));
                    $commStatus = strtoupper((string)($ord['commission_status'] ?? 'PENDING'));

                    $orderAmount = isset($ord['order_amount']) ? (float)$ord['order_amount'] : (float)($ord['subtotal'] ?? 0.0);
                    $commRate = isset($ord['commission_rate']) ? (float)$ord['commission_rate'] : (isset($ord['commission_rate_pct']) ? (float)$ord['commission_rate_pct'] : null);
                    
                    $estComm = isset($ord['estimated_commission']) ? (float)$ord['estimated_commission'] : (isset($ord['commission_amount']) ? (float)$ord['commission_amount'] : null);
                    $settledComm = isset($ord['settled_commission']) ? (float)$ord['settled_commission'] : (isset($ord['actual_commission']) ? (float)$ord['actual_commission'] : null);
                    $ineligibleComm = isset($ord['ineligible_commission']) ? (float)$ord['ineligible_commission'] : null;

                    $curr = (string)($ord['currency'] ?? 'VND');
                    $createdAt = !empty($ord['create_time']) ? date('Y-m-d H:i:s', (int)$ord['create_time']) : (!empty($ord['order_created_at']) ? (string)$ord['order_created_at'] : null);
                    $settledAt = !empty($ord['settle_time']) ? date('Y-m-d H:i:s', (int)$ord['settle_time']) : (!empty($ord['settled_at']) ? (string)$ord['settled_at'] : null);

                    $rawJson = json_encode($ord, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

                    $stmtUpsert->execute([
                        ':platform' => self::PLATFORM,
                        ':shop_id' => $shopId,
                        ':affiliate_order_id' => $affId,
                        ':platform_order_id' => $platOrderId,
                        ':sku_id' => $skuId,
                        ':product_id' => $prodId ?: null,
                        ':product_name' => $prodName ?: null,
                        ':creator_id' => $creatorId ?: null,
                        ':creator_username' => $creatorUser ?: null,
                        ':creator_nickname' => $creatorNick ?: null,
                        ':creator_type' => $creatorType,
                        ':content_type' => $contentType ?: null,
                        ':content_id' => $contentId ?: null,
                        ':traffic_source' => $trafficSource,
                        ':order_status' => $orderStatus,
                        ':commission_status' => $commStatus,
                        ':order_amount' => $orderAmount,
                        ':commission_rate_pct' => $commRate,
                        ':estimated_commission' => $estComm,
                        ':settled_commission' => $settledComm,
                        ':ineligible_commission' => $ineligibleComm,
                        ':currency' => $curr,
                        ':order_created_at' => $createdAt,
                        ':settled_at' => $settledAt,
                        ':raw_payload' => $rawJson
                    ]);

                    $totalSynced++;
                }
                $this->db->commit();
            } catch (\Throwable $t) {
                $this->db->rollBack();
                error_log("Failed to insert affiliate orders batch: " . $t->getMessage());
                throw $t;
            }

            $pageToken = $apiRes['data']['next_page_token'] ?? null;
            if (empty($pageToken)) {
                break;
            }
        }

        return [
            'success' => true,
            'status' => 'COMPLETED',
            'records_synced' => $totalSynced,
            'pages_fetched' => $pageCount,
            'message' => "Đã đồng bộ thành công {$totalSynced} dòng đơn hàng tiếp thị liên kết từ TikTok Shop Affiliate API."
        ];
    }

    /**
     * Retrieves aggregated Affiliate and Creator intelligence report
     * Complies with P0-01: Zero fabrication, zero hardcoded commission rates or splits.
     */
    public function getAffiliateReport(string $shopId, string $startDate, string $endDate): array {
        $startDt = $startDate . ' 00:00:00';
        $endDt = date('Y-m-d 23:59:59', strtotime($endDate));

        $report = [
            'shop_id' => $shopId,
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'summary' => [
                'total_affiliate_gmv' => 0.0,
                'organic_affiliate_gmv' => 0.0,
                'ads_affiliate_gmv' => 0.0,
                'unclassified_affiliate_gmv' => 0.0,
                'total_commission_estimated' => null,
                'total_commission_settled' => 0.0,
                'ineligible_commission' => 0.0,
                'total_affiliate_orders' => 0,
                'total_creators_count' => 0,
                'avg_commission_rate_pct' => null
            ],
            'content_breakdown' => [
                'video' => ['gmv' => 0.0, 'orders' => 0, 'share_pct' => 0.0],
                'live' => ['gmv' => 0.0, 'orders' => 0, 'share_pct' => 0.0],
                'showcase' => ['gmv' => 0.0, 'orders' => 0, 'share_pct' => 0.0]
            ],
            'creators' => [],
            'has_data' => false,
            'data_status' => 'NO_DATA',
            'data_source' => 'NONE'
        ];

        try {
            // Check if commerce_affiliate_orders table exists and has rows for this period
            $hasAffiliateOrders = false;
            if ($this->checkTableExists()) {
                $stmtCheck = $this->db->prepare("SELECT COUNT(*) FROM `commerce_affiliate_orders` 
                    WHERE shop_id = :shop_id AND order_created_at >= :start_dt AND order_created_at <= :end_dt");
                $stmtCheck->execute([':shop_id' => $shopId, ':start_dt' => $startDt, ':end_dt' => $endDt]);
                $hasAffiliateOrders = ((int)$stmtCheck->fetchColumn() > 0);
            }

            if ($hasAffiliateOrders) {
                // =========================================================
                // PATH 1: AUTHORITATIVE TIKTOK AFFILIATE ORDERS TABLE
                // =========================================================
                $stmtSummary = $this->db->prepare("SELECT 
                    COALESCE(SUM(order_amount), 0.0) as total_gmv,
                    COALESCE(SUM(CASE WHEN traffic_source = 'ORGANIC' THEN order_amount ELSE 0.0 END), 0.0) as organic_gmv,
                    COALESCE(SUM(CASE WHEN traffic_source = 'PAID_ADS' THEN order_amount ELSE 0.0 END), 0.0) as ads_gmv,
                    COALESCE(SUM(CASE WHEN traffic_source NOT IN ('ORGANIC', 'PAID_ADS') THEN order_amount ELSE 0.0 END), 0.0) as unclassified_gmv,
                    SUM(estimated_commission) as total_est_comm,
                    COALESCE(SUM(settled_commission), 0.0) as total_settled_comm,
                    COALESCE(SUM(ineligible_commission), 0.0) as total_ineligible_comm,
                    COUNT(DISTINCT affiliate_order_id) as total_orders,
                    COUNT(DISTINCT creator_id) as total_creators
                    FROM `commerce_affiliate_orders`
                    WHERE shop_id = :shop_id
                      AND order_created_at >= :start_dt AND order_created_at <= :end_dt");
                $stmtSummary->execute([':shop_id' => $shopId, ':start_dt' => $startDt, ':end_dt' => $endDt]);
                $sRow = $stmtSummary->fetch(PDO::FETCH_ASSOC) ?: [];

                $totGmv = (float)($sRow['total_gmv'] ?? 0.0);
                $orgGmv = (float)($sRow['organic_gmv'] ?? 0.0);
                $adsGmv = (float)($sRow['ads_gmv'] ?? 0.0);
                $unclassGmv = (float)($sRow['unclassified_gmv'] ?? 0.0);
                $estComm = $sRow['total_est_comm'] !== null ? (float)$sRow['total_est_comm'] : null;
                $setComm = (float)($sRow['total_settled_comm'] ?? 0.0);
                $inelComm = (float)($sRow['total_ineligible_comm'] ?? 0.0);
                $totOrders = (int)($sRow['total_orders'] ?? 0);
                $totCreators = (int)($sRow['total_creators'] ?? 0);

                $report['summary']['total_affiliate_gmv'] = round($totGmv, 2);
                $report['summary']['organic_affiliate_gmv'] = round($orgGmv, 2);
                $report['summary']['ads_affiliate_gmv'] = round($adsGmv, 2);
                $report['summary']['unclassified_affiliate_gmv'] = round($unclassGmv, 2);
                $report['summary']['total_commission_estimated'] = $estComm !== null ? round($estComm, 2) : null;
                $report['summary']['total_commission_settled'] = round($setComm, 2);
                $report['summary']['ineligible_commission'] = round($inelComm, 2);
                $report['summary']['total_affiliate_orders'] = $totOrders;
                $report['summary']['total_creators_count'] = $totCreators;

                // Authentic commission rate calculation
                if ($totGmv > 0 && $setComm > 0) {
                    $report['summary']['avg_commission_rate_pct'] = round(($setComm / $totGmv) * 100, 2);
                } elseif ($totGmv > 0 && $estComm !== null && $estComm > 0) {
                    $report['summary']['avg_commission_rate_pct'] = round(($estComm / $totGmv) * 100, 2);
                } else {
                    $report['summary']['avg_commission_rate_pct'] = null;
                }

                // Authentic Content Breakdown
                $stmtBreakdown = $this->db->prepare("SELECT 
                    content_type,
                    COALESCE(SUM(order_amount), 0.0) as type_gmv,
                    COUNT(DISTINCT affiliate_order_id) as type_orders
                    FROM `commerce_affiliate_orders`
                    WHERE shop_id = :shop_id
                      AND order_created_at >= :start_dt AND order_created_at <= :end_dt
                    GROUP BY content_type");
                $stmtBreakdown->execute([':shop_id' => $shopId, ':start_dt' => $startDt, ':end_dt' => $endDt]);
                $bRows = $stmtBreakdown->fetchAll(PDO::FETCH_ASSOC) ?: [];

                foreach ($bRows as $br) {
                    $type = strtolower((string)($br['content_type'] ?? 'other'));
                    $typeGmv = (float)$br['type_gmv'];
                    $typeOrders = (int)$br['type_orders'];
                    $sharePct = $totGmv > 0 ? round(($typeGmv / $totGmv) * 100, 1) : 0.0;

                    if ($type === 'video') {
                        $report['content_breakdown']['video'] = ['gmv' => round($typeGmv, 2), 'orders' => $typeOrders, 'share_pct' => $sharePct];
                    } elseif ($type === 'live') {
                        $report['content_breakdown']['live'] = ['gmv' => round($typeGmv, 2), 'orders' => $typeOrders, 'share_pct' => $sharePct];
                    } elseif ($type === 'showcase') {
                        $report['content_breakdown']['showcase'] = ['gmv' => round($typeGmv, 2), 'orders' => $typeOrders, 'share_pct' => $sharePct];
                    }
                }

                // Creator Leaderboard
                $stmtCreators = $this->db->prepare("SELECT 
                    COALESCE(creator_nickname, creator_username, 'KOC / Creator Đối Tác') as creator_name,
                    creator_type,
                    COUNT(DISTINCT affiliate_order_id) as orders,
                    COALESCE(SUM(order_amount), 0.0) as gmv,
                    SUM(estimated_commission) as comm_est,
                    COALESCE(SUM(settled_commission), 0.0) as comm_settled,
                    COALESCE(SUM(ineligible_commission), 0.0) as comm_ineligible,
                    COUNT(DISTINCT content_id) as video_count
                    FROM `commerce_affiliate_orders`
                    WHERE shop_id = :shop_id
                      AND order_created_at >= :start_dt AND order_created_at <= :end_dt
                    GROUP BY creator_id, creator_nickname, creator_username, creator_type
                    ORDER BY gmv DESC
                    LIMIT 50");
                $stmtCreators->execute([':shop_id' => $shopId, ':start_dt' => $startDt, ':end_dt' => $endDt]);
                $cRows = $stmtCreators->fetchAll(PDO::FETCH_ASSOC) ?: [];

                foreach ($cRows as $cr) {
                    $cGmv = (float)$cr['gmv'];
                    $cSettled = (float)$cr['comm_settled'];
                    $cEst = $cr['comm_est'] !== null ? (float)$cr['comm_est'] : null;

                    $cRate = null;
                    if ($cGmv > 0 && $cSettled > 0) {
                        $cRate = round(($cSettled / $cGmv) * 100, 2);
                    } elseif ($cGmv > 0 && $cEst !== null && $cEst > 0) {
                        $cRate = round(($cEst / $cGmv) * 100, 2);
                    }

                    $report['creators'][] = [
                        'creator_name' => $cr['creator_name'],
                        'creator_type' => $cr['creator_type'],
                        'video_count' => (int)$cr['video_count'],
                        'total_views' => 0,
                        'gmv' => round($cGmv, 2),
                        'orders' => (int)$cr['orders'],
                        'commission_estimated' => $cEst !== null ? round($cEst, 2) : null,
                        'commission_settled' => round($cSettled, 2),
                        'ineligible_commission' => round((float)$cr['comm_ineligible'], 2),
                        'commission_rate_pct' => $cRate
                    ];
                }

                $report['has_data'] = true;
                $report['data_status'] = 'AVAILABLE';
                $report['data_source'] = 'TIKTOK_AFFILIATE_API';

            } else {
                // =========================================================
                // PATH 2: FALLBACK TO VERIFIED VIDEO ANALYTICS & FINANCE
                // Strict rules: NO FABRICATION (No 10%, no 9%, no 70/30 split).
                // =========================================================

                // 1. Video Creators from commerce_video_analytics
                $videoRows = [];
                try {
                    $stmtVideos = $this->db->prepare("SELECT 
                        creator_name,
                        creator_type,
                        COUNT(DISTINCT video_id) as video_count,
                        COALESCE(SUM(video_views), 0) as total_views,
                        COALESCE(SUM(gross_revenue), 0) as total_gmv,
                        COALESCE(SUM(units_sold), 0) as total_orders
                        FROM `commerce_video_analytics`
                        WHERE shop_id = :shop_id
                          AND stat_date >= :sdate AND stat_date <= :edate
                          AND creator_type IN ('AFFILIATE', 'MARKETING')
                        GROUP BY creator_name, creator_type");
                    $stmtVideos->execute([
                        ':shop_id' => $shopId,
                        ':sdate' => $startDate,
                        ':edate' => $endDate
                    ]);
                    $videoRows = $stmtVideos->fetchAll(PDO::FETCH_ASSOC) ?: [];
                } catch (\Throwable $t) {}

                // 2. Authoritative settled commissions from commerce_finance_transactions
                $commRow = [];
                try {
                    $stmtComms = $this->db->prepare("SELECT 
                        COALESCE(SUM(affiliate_commission), 0.0) as total_affiliate_comm,
                        COALESCE(SUM(CASE WHEN transaction_type != 'CANCELLED' THEN affiliate_commission ELSE 0.0 END), 0.0) as settled_comm,
                        COALESCE(SUM(CASE WHEN transaction_type = 'CANCELLED' THEN affiliate_commission ELSE 0.0 END), 0.0) as cancelled_comm
                        FROM `commerce_finance_transactions`
                        WHERE shop_id = :shop_id
                          AND transaction_time >= :start_dt AND transaction_time <= :end_dt
                          AND affiliate_commission > 0");
                    $stmtComms->execute([
                        ':shop_id' => $shopId,
                        ':start_dt' => $startDt,
                        ':end_dt' => $endDt
                    ]);
                    $commRow = $stmtComms->fetch(PDO::FETCH_ASSOC) ?: [];
                } catch (\Throwable $t) {}

                // 3. LIVE Sessions from commerce_live_sessions
                $liveGmvActual = 0.0;
                $liveOrdersActual = 0;
                try {
                    $stmtLive = $this->db->prepare("SELECT 
                        COALESCE(SUM(gmv), 0.0) as live_gmv,
                        COALESCE(SUM(orders_count), 0) as live_orders
                        FROM `commerce_live_sessions`
                        WHERE shop_id = :shop_id
                          AND start_time >= :sdate AND start_time <= :edate
                          AND account_type IN ('AFFILIATE_ACCOUNTS', 'MARKETING_ACCOUNTS')");
                    $stmtLive->execute([':shop_id' => $shopId, ':sdate' => $startDt, ':edate' => $endDt]);
                    $liveRow = $stmtLive->fetch(PDO::FETCH_ASSOC);
                    if ($liveRow) {
                        $liveGmvActual = (float)($liveRow['live_gmv'] ?? 0.0);
                        $liveOrdersActual = (int)($liveRow['live_orders'] ?? 0);
                    }
                } catch (\Throwable $t) {}

                $videoGmvActual = 0.0;
                $videoOrdersActual = 0;
                $organicGmv = 0.0;
                $adsGmv = 0.0;
                $unclassGmv = 0.0;
                $creatorMap = [];

                foreach ($videoRows as $vr) {
                    $name = trim((string)($vr['creator_name'] ?: 'KOC / Affiliate Đối Tác'));
                    $gmv = (float)$vr['total_gmv'];
                    $orders = (int)$vr['total_orders'];
                    $views = (int)$vr['total_views'];
                    $type = (string)($vr['creator_type'] ?? 'AFFILIATE');

                    $videoGmvActual += $gmv;
                    $videoOrdersActual += $orders;

                    // Strict attribution: MARKETING or explicit ads tag is Ads; AFFILIATE is Organic
                    if ($type === 'MARKETING') {
                        $adsGmv += $gmv;
                    } elseif ($type === 'AFFILIATE') {
                        $organicGmv += $gmv;
                    } else {
                        $unclassGmv += $gmv;
                    }

                    if (!isset($creatorMap[$name])) {
                        $creatorMap[$name] = [
                            'creator_name' => $name,
                            'creator_type' => $type,
                            'video_count' => 0,
                            'total_views' => 0,
                            'gmv' => 0.0,
                            'orders' => 0,
                            'commission_estimated' => null, // DO NOT fabricate 10%
                            'commission_settled' => null,   // DO NOT fabricate 9%
                            'ineligible_commission' => 0.0,
                            'commission_rate_pct' => null   // DO NOT fabricate 10.0%
                        ];
                    }

                    $creatorMap[$name]['video_count'] += (int)$vr['video_count'];
                    $creatorMap[$name]['total_views'] += $views;
                    $creatorMap[$name]['gmv'] += $gmv;
                    $creatorMap[$name]['orders'] += $orders;
                }

                $totalGmv = $videoGmvActual + $liveGmvActual;
                $totalOrders = $videoOrdersActual + $liveOrdersActual;

                $settledComm = (float)($commRow['settled_comm'] ?? 0.0);
                $cancelledComm = (float)($commRow['cancelled_comm'] ?? 0.0);

                $report['summary']['total_affiliate_gmv'] = round($totalGmv, 2);
                $report['summary']['organic_affiliate_gmv'] = round($organicGmv, 2);
                $report['summary']['ads_affiliate_gmv'] = round($adsGmv, 2);
                $report['summary']['unclassified_affiliate_gmv'] = round($unclassGmv, 2);
                $report['summary']['total_commission_estimated'] = ($settledComm > 0) ? round($settledComm, 2) : null;
                $report['summary']['total_commission_settled'] = round($settledComm, 2);
                $report['summary']['ineligible_commission'] = round($cancelledComm, 2);
                $report['summary']['total_affiliate_orders'] = $totalOrders;
                $report['summary']['total_creators_count'] = count($creatorMap);

                // Authentic commission rate
                if ($totalGmv > 0 && $settledComm > 0) {
                    $report['summary']['avg_commission_rate_pct'] = round(($settledComm / $totalGmv) * 100, 2);
                } else {
                    $report['summary']['avg_commission_rate_pct'] = null;
                }

                // Authentic content breakdown (NO 70/30 split)
                if ($totalGmv > 0) {
                    $vShare = round(($videoGmvActual / $totalGmv) * 100, 1);
                    $lShare = round(($liveGmvActual / $totalGmv) * 100, 1);
                    $sShare = max(0.0, round(100.0 - $vShare - $lShare, 1));
                    $report['content_breakdown']['video'] = ['gmv' => round($videoGmvActual, 2), 'orders' => $videoOrdersActual, 'share_pct' => $vShare];
                    $report['content_breakdown']['live'] = ['gmv' => round($liveGmvActual, 2), 'orders' => $liveOrdersActual, 'share_pct' => $lShare];
                    $report['content_breakdown']['showcase'] = ['gmv' => 0.0, 'orders' => 0, 'share_pct' => $sShare];
                }

                $creatorsList = array_values($creatorMap);
                usort($creatorsList, function($a, $b) {
                    return $b['gmv'] <=> $a['gmv'];
                });
                $report['creators'] = array_slice($creatorsList, 0, 50);

                $report['has_data'] = ($totalGmv > 0 || count($creatorMap) > 0 || $settledComm > 0);
                $report['data_status'] = $report['has_data'] ? 'PARTIAL_HISTORICAL' : 'NO_DATA';
                $report['data_source'] = $report['has_data'] ? 'ANALYTICS_AND_FINANCE_FALLBACK' : 'NONE';
            }

        } catch (\Throwable $t) {
            error_log("Failed to build affiliate report: " . $t->getMessage());
            $report['data_status'] = 'ERROR';
            $report['error_message'] = $t->getMessage();
        }

        return $report;
    }

    /**
     * CSV Import is strictly disabled per Product Owner decision:
     * Affiliate data source: API ONLY. No Excel/CSV import fallback.
     */
    public function importAffiliateOrders(string $shopId, string $csvContent): array {
        return [
            'success' => false,
            'code' => 'API_ONLY_POLICY',
            'message' => 'Hệ thống đã chuyển đổi sang cơ chế đồng bộ trực tiếp qua TikTok Shop Open API (API ONLY). Tính năng nhập tệp CSV đã được vô hiệu hóa để bảo đảm tính toàn vẹn dữ liệu.'
        ];
    }

    /**
     * Exports Affiliate Report to UTF-8 BOM CSV with authentic non-fabricated metrics
     */
    public function exportAffiliateReportCsv(string $shopId, string $startDate, string $endDate): string {
        $data = $this->getAffiliateReport($shopId, $startDate, $endDate);
        $creators = $data['creators'] ?? [];

        $bom = chr(0xEF) . chr(0xBB) . chr(0xBF);
        $headers = [
            'Hạng',
            'Nhà Sáng Tạo / KOC',
            'Loại Tài Khoản',
            'Số Lượng Video / LIVE',
            'Lượt Xem Tương Tác',
            'Tổng Đơn Hàng',
            'Doanh Thu Affiliate (₫)',
            'Tỷ Lệ Hoa Hồng (%)',
            'Hoa Hồng Dự Kiến (₫)',
            'Hoa Hồng Thực Nhận (₫)',
            'Hoa Hồng Bị Hủy/Hoàn (₫)'
        ];

        $output = fopen('php://temp', 'r+');
        fputcsv($output, $headers);

        foreach ($creators as $idx => $c) {
            $rateStr = ($c['commission_rate_pct'] !== null) ? ($c['commission_rate_pct'] . '%') : 'Chờ API';
            $estStr = ($c['commission_estimated'] !== null) ? number_format((float)$c['commission_estimated'], 0, '', '') : 'Chờ API';
            $settledStr = ($c['commission_settled'] !== null) ? number_format((float)$c['commission_settled'], 0, '', '') : 'Chờ quyết toán';
            $inelStr = ($c['ineligible_commission'] !== null) ? number_format((float)$c['ineligible_commission'], 0, '', '') : '0';

            fputcsv($output, [
                $idx + 1,
                $c['creator_name'],
                $c['creator_type'],
                $c['video_count'],
                $c['total_views'],
                $c['orders'],
                number_format((float)$c['gmv'], 0, '', ''),
                $rateStr,
                $estStr,
                $settledStr,
                $inelStr
            ]);
        }

        rewind($output);
        $csvBody = stream_get_contents($output);
        fclose($output);

        return $bom . $csvBody;
    }
}
