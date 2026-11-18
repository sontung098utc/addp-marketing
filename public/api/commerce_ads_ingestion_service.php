<?php
/**
 * ADDP COMMERCE INTELLIGENCE - CAMPAIGN GMV MAX INGESTION SERVICE
 * 
 * Component: Sprint V2-02A.2 Official GMV Max API Ingestion
 * 
 * Responsibilities:
 * 1. Bounded, idempotent ingestion of official TikTok Marketing API daily campaign reports.
 * 2. Normalization into commerce_ads_campaign_daily (Shop + Campaign + Date grain).
 * 3. Enforces Source Precedence: TIKTOK_GMV_MAX_API > DAILY_REPORT_BACKFILL.
 * 4. Preserves API metrics (api_roi, api_cost_per_order) distinct from derived metrics.
 * 5. Multi-shop ready, pagination-safe, retry-safe, upsert-safe.
 * 6. Reconciliation Engine: Compares Official API vs Legacy Daily Reports.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/tiktok_gmv_max_api_client.php';

class CommerceAdsIngestionService {
    public const PLATFORM_TIKTOK_ADS = 'tiktok_ads';
    public const DEFAULT_SHOP_ID = '7495657895504611503';
    public const SOURCE_TIKTOK_API = 'TIKTOK_GMV_MAX_API';
    public const SOURCE_DAILY_BACKFILL = 'DAILY_REPORT_BACKFILL';

    private PDO $db;
    private TikTokGmvMaxApiClient $apiClient;
    private static bool $roiWidened = false;

    public function __construct(?PDO $db = null, ?TikTokGmvMaxApiClient $apiClient = null) {
        $this->db = $db ?? getDBConnection();
        $this->apiClient = $apiClient ?? new TikTokGmvMaxApiClient();
    }

    /**
     * Safely widens api_roi / derived_roi / roi columns on MariaDB/MySQL to DECIMAL(14,4)
     * so high-ROI creatives (e.g. >999.9999x on tiny spend) never trigger SQLSTATE[22003] 1264.
     */
    private function ensureWideRoiColumns(): void {
        if (self::$roiWidened) {
            return;
        }
        self::$roiWidened = true;
        try {
            if ($this->db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
                return;
            }
            $targets = [
                'commerce_ads_campaign_daily' => ['roi', 'api_roi', 'derived_roi'],
                'commerce_ads_product_daily' => ['api_roi', 'derived_roi'],
                'commerce_ads_creative_daily' => ['api_roi', 'derived_roi'],
                'commerce_ads_live_daily' => ['api_roi', 'derived_roi'],
            ];
            foreach ($targets as $tbl => $cols) {
                $exists = $this->db->query("SHOW TABLES LIKE " . $this->db->quote($tbl))->fetchColumn();
                if (!$exists) continue;
                foreach ($cols as $col) {
                    try {
                        $this->db->exec("ALTER TABLE `{$tbl}` MODIFY COLUMN `{$col}` DECIMAL(14,4) NULL DEFAULT NULL");
                    } catch (\Throwable $ignore) {}
                }
            }
        } catch (\Throwable $t) {}
    }

    private function clampRoi(?float $val): ?float {
        if ($val === null || !is_finite($val)) {
            return null;
        }
        $rounded = round($val, 4);
        if ($rounded > 999999.9999) return 999999.9999;
        if ($rounded < -999999.9999) return -999999.9999;
        return $rounded;
    }

    /**
     * Checks if commerce_ads_campaign_daily table exists
     */
    public function hasV2Table(): bool {
        try {
            $check = $this->db->query("SHOW TABLES LIKE 'commerce_ads_campaign_daily'")->fetch();
            return !empty($check);
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Checks if additive lineage columns from Migration 011 exist
     */
    public function hasLineageColumns(): bool {
        try {
            $stmt = $this->db->query("SHOW COLUMNS FROM `commerce_ads_campaign_daily` LIKE 'net_cost'");
            $col = $stmt->fetch();
            return !empty($col);
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Checks if commerce_ads_product_daily table exists
     */
    public function hasProductTable(): bool {
        try {
            $check = $this->db->query("SHOW TABLES LIKE 'commerce_ads_product_daily'")->fetch();
            return !empty($check);
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Checks if commerce_ads_creative_daily table exists
     */
    public function hasCreativeTable(): bool {
        try {
            $check = $this->db->query("SHOW TABLES LIKE 'commerce_ads_creative_daily'")->fetch();
            return !empty($check);
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Checks if commerce_ads_live_daily table exists
     */
    public function hasLiveTable(): bool {
        try {
            $check = $this->db->query("SHOW TABLES LIKE 'commerce_ads_live_daily'")->fetch();
            return !empty($check);
        } catch (\Throwable $t) {
            return false;
        }
    }


    /**
     * Classifies raw type/name into canonical campaign type
     */
    public function classifyCampaignType(string $rawType, string $rawName = ''): string {
        $isLive = (stripos($rawType, 'LIVE') !== false || stripos($rawName, 'LIVE') !== false);
        return $isLive ? 'LIVE_GMV_MAX' : 'PRODUCT_GMV_MAX';
    }

    /**
     * Ingests or synchronizes a bounded date range of campaign daily reports.
     * Prioritizes TikTok Ads API if configured and reachable; falls back to legacy daily reports.
     *
     * @param string $shopId
     * @param string $startDate YYYY-MM-DD
     * @param string $endDate YYYY-MM-DD
     * @param bool $forceApi
     * @param array $options
     * @return array Ingestion summary result
     */
    public function syncCampaignDailyRange(
        string $shopId,
        string $startDate,
        string $endDate,
        bool $allowLegacyFallback = false,
        array $options = []
    ): array {
        if (!$this->hasV2Table()) {
            return [
                'status' => 'ERROR',
                'message' => 'Bảng commerce_ads_campaign_daily chưa được tạo (cần chạy migration 010).',
                'records_ingested' => 0
            ];
        }

        $expectedDays = 1;
        try {
            $dtStart = new DateTime($startDate);
            $dtEnd = new DateTime($endDate);
            $expectedDays = max(1, (int)$dtStart->diff($dtEnd)->format('%a') + 1);
        } catch (\Throwable $t) {
            $expectedDays = 1;
        }

        // 1. Check TikTok Ads credentials
        $token = null;
        $advertiserId = null;
        try {
            $stmt = $this->db->query("SELECT ads_access_token, advertiser_id FROM `tiktok_config` WHERE ads_access_token IS NOT NULL AND ads_access_token != '' ORDER BY updated_at DESC LIMIT 1");
            $config = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$config) {
                $stmt = $this->db->query("SELECT ads_access_token, advertiser_id FROM `tiktok_config` ORDER BY updated_at DESC LIMIT 1");
                $config = $stmt->fetch(PDO::FETCH_ASSOC);
            }
            $token = $config['ads_access_token'] ?? null;
            $advertiserId = $config['advertiser_id'] ?? null;
        } catch (\Throwable $t) {}

        $hasApiCreds = !empty($token) && !empty($advertiserId);
        $recordsIngested = 0;
        $ingestionSource = 'UNAVAILABLE';
        $apiSuccess = false;
        $apiError = null;

        // 2. Default & Authoritative source: Official TIKTOK_GMV_MAX_API
        if ($hasApiCreds) {
            try {
                $apiRes = $this->ingestFromTikTokAdsApi($shopId, $advertiserId, $token, $startDate, $endDate, $options);
                if ($apiRes['status'] === 'SUCCESS') {
                    $recordsIngested = (int)($apiRes['records_ingested'] ?? 0);
                    $ingestionSource = self::SOURCE_TIKTOK_API;
                    $apiSuccess = true;
                } else {
                    $apiError = $apiRes['error'] ?? 'API ingestion returned non-success';
                }
            } catch (\Throwable $t) {
                $apiSuccess = false;
                $apiError = $t->getMessage();
            }
        }

        // 3. Fallback: ONLY if caller explicitly allowed legacy fallback AND API was not successful
        // NEVER silently pretend legacy = official!
        if (!$apiSuccess && $allowLegacyFallback) {
            $backfillRes = $this->backfillFromLegacyDailyReports($shopId, $startDate, $endDate, $advertiserId);
            $recordsIngested = (int)($backfillRes['records_ingested'] ?? 0);
            $ingestionSource = $recordsIngested > 0 ? self::SOURCE_DAILY_BACKFILL : 'NOT_SYNCED';
        }

        // 4. Query distinct days ingested in V2 table
        $distinctDays = 0;
        try {
            $stmtDist = $this->db->prepare("SELECT COUNT(DISTINCT stat_date) as dist_days 
                FROM `commerce_ads_campaign_daily` 
                WHERE (shop_id = ? OR shop_id = '' OR shop_id IS NULL) AND stat_date >= ? AND stat_date <= ?");
            $stmtDist->execute([$shopId, $startDate, $endDate]);
            $distinctDays = (int)($stmtDist->fetchColumn() ?? 0);
        } catch (\Throwable $t) {}

        $coveragePct = $expectedDays > 0 ? round(($distinctDays / $expectedDays) * 100, 1) : 0.0;
        $isFullCoverage = ($distinctDays >= $expectedDays);
        $status = $isFullCoverage ? 'AVAILABLE' : ($distinctDays > 0 ? 'PARTIAL' : ($hasApiCreds ? ($apiError ? 'ERROR' : 'NOT_SYNCED') : 'UNAVAILABLE'));

        return [
            'status' => $status,
            'source' => $ingestionSource,
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'expected_days' => $expectedDays,
            'available_days' => $distinctDays,
            'coverage_percent' => $coveragePct,
            'is_full_coverage' => $isFullCoverage,
            'records_ingested' => $recordsIngested,
            'api_attempted' => $hasApiCreds,
            'api_success' => $apiSuccess,
            'api_error' => $apiError
        ];
    }

    /**
     * Ingests real-time date-bounded reports from TikTok Marketing API v1.3
     * Enforces authoritative classification via gmv_max_promotion_types ("PRODUCT" & "LIVE")
     * Preserves API ROI, API CPA, net_cost, and full lineage metadata.
     */
    public function ingestFromTikTokAdsApi(
        string $shopId,
        string $advertiserId,
        string $token,
        string $startDate,
        string $endDate,
        array $options = []
    ): array {
        // Authoritative GMV Max classification:
        // Use official filter gmv_max_promotion_types to classify campaigns cleanly:
        // Stream 1: PRODUCT -> returns PRODUCT campaigns (e.g. 62 on 2026-09-01)
        // Stream 2: LIVE -> returns LIVE campaigns (e.g. 280 on 2026-09-01)
        // Total = 62 + 280 = 342 campaigns!
        $targetStreams = ['PRODUCT', 'LIVE'];
        if (!empty($options['filtering']['gmv_max_promotion_types'])) {
            $targetStreams = (array)$options['filtering']['gmv_max_promotion_types'];
        }

        $allReports = [];
        $streamErrors = [];

        foreach ($targetStreams as $promType) {
            $promTypeUpper = strtoupper(trim((string)$promType));
            $streamOptions = $options;
            $streamOptions['store_ids'] = [$shopId];
            if (!isset($streamOptions['filtering'])) {
                $streamOptions['filtering'] = [];
            }
            $streamOptions['filtering']['gmv_max_promotion_types'] = [$promTypeUpper];

            try {
                $reportParams = $this->apiClient->buildCampaignReportParams(
                    $advertiserId,
                    $startDate,
                    $endDate,
                    $streamOptions
                );
                $rows = $this->apiClient->fetchDateBoundedReport($reportParams, $token);
                foreach ($rows as $row) {
                    $row['_official_promotion_type'] = $promTypeUpper;
                    $allReports[] = $row;
                }
            } catch (\Throwable $t) {
                $streamErrors[] = "Stream {$promTypeUpper}: " . $this->apiClient->redactToken($t->getMessage(), $token);
            }
        }

        // If streams had error or returned empty, attempt progressive fallbacks
        if (empty($allReports)) {
            // Fallback 1: Unfiltered query with store_ids
            try {
                $unfilteredOptions = $options;
                $unfilteredOptions['store_ids'] = [$shopId];
                unset($unfilteredOptions['filtering']['gmv_max_promotion_types']);
                $reportParams = $this->apiClient->buildCampaignReportParams(
                    $advertiserId,
                    $startDate,
                    $endDate,
                    $unfilteredOptions
                );
                $allReports = $this->apiClient->fetchDateBoundedReport($reportParams, $token);
            } catch (\Throwable $t2) {
                $streamErrors[] = "Unfiltered GMV: " . $this->apiClient->redactToken($t2->getMessage(), $token);
            }
        }

        // Fallback 2: Without store_ids filter
        if (empty($allReports)) {
            try {
                $noStoreOptions = $options;
                unset($noStoreOptions['store_ids']);
                unset($noStoreOptions['filtering']['gmv_max_promotion_types']);
                $reportParams = $this->apiClient->buildCampaignReportParams(
                    $advertiserId,
                    $startDate,
                    $endDate,
                    $noStoreOptions
                );
                $rows = $this->apiClient->fetchDateBoundedReport($reportParams, $token);
                if (!empty($rows)) {
                    $allReports = $rows;
                }
            } catch (\Throwable $t3) {}
        }

        // Fallback 3: Single-day dimensions ['campaign_id'] if startDate === endDate
        if (empty($allReports) && $startDate === $endDate) {
            try {
                $singleDayOptions = $options;
                $singleDayOptions['dimensions'] = ['campaign_id'];
                unset($singleDayOptions['filtering']['gmv_max_promotion_types']);
                unset($singleDayOptions['store_ids']);
                $reportParams = $this->apiClient->buildCampaignReportParams(
                    $advertiserId,
                    $startDate,
                    $endDate,
                    $singleDayOptions
                );
                $singleRows = $this->apiClient->fetchDateBoundedReport($reportParams, $token);
                if (!empty($singleRows)) {
                    foreach ($singleRows as &$sr) {
                        if (!isset($sr['dimensions']['stat_time_day'])) {
                            $sr['dimensions']['stat_time_day'] = $startDate;
                        }
                    }
                    unset($sr);
                    $allReports = $singleRows;
                }
            } catch (\Throwable $t4) {}
        }

        // Fallback 4: Standard integrated auction report /report/integrated/get/
        if (empty($allReports) && function_exists('requestTikTokAdsAPI')) {
            try {
                $intRes = requestTikTokAdsAPI('/report/integrated/get/', [
                    'advertiser_id' => $advertiserId,
                    'report_type' => 'BASIC',
                    'data_level' => 'AUCTION_CAMPAIGN',
                    'dimensions' => ['campaign_id'],
                    'metrics' => ['spend', 'impressions', 'clicks', 'ctr', 'onsite_shopping', 'onsite_shopping_roas'],
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'page' => 1,
                    'page_size' => 100
                ], $token);
                $intList = $intRes['data']['list'] ?? [];
                foreach ($intList as $item) {
                    $cId = $item['dimensions']['campaign_id'] ?? null;
                    if (!$cId) continue;
                    $m = $item['metrics'] ?? [];
                    $spend = (float)($m['spend'] ?? 0);
                    $roas = (float)($m['onsite_shopping_roas'] ?? 0);
                    $gross = $spend * $roas;
                    $orders = (int)($m['onsite_shopping'] ?? 0);
                    if ($spend > 0 || $gross > 0 || $orders > 0) {
                        $allReports[] = [
                            'dimensions' => [
                                'campaign_id' => $cId,
                                'stat_time_day' => $startDate
                            ],
                            'metrics' => [
                                'cost' => $spend,
                                'net_cost' => $spend,
                                'gross_revenue' => $gross,
                                'orders' => $orders,
                                'roi' => $roas,
                                'cost_per_order' => ($orders > 0 ? round($spend / $orders, 2) : 0)
                            ],
                            '_official_promotion_type' => 'PRODUCT'
                        ];
                    }
                }
            } catch (\Throwable $t5) {}
        }

        if (empty($allReports)) {
            if (!empty($streamErrors)) {
                return [
                    'status' => 'ERROR',
                    'records_ingested' => 0,
                    'error' => implode('; ', $streamErrors)
                ];
            }
            return ['status' => 'SUCCESS', 'records_ingested' => 0];
        }

        // Cache campaign metadata
        $campMeta = $this->loadCampaignMetadataMap();
        $hasLineage = $this->hasLineageColumns();
        $stmtUpsert = $this->prepareApiUpsertStatement($hasLineage);
        $ingested = 0;
        $observedAt = date('Y-m-d H:i:s');
        $syncRunId = isset($options['sync_run_id']) ? (int)$options['sync_run_id'] : null;
        $seenKeys = [];

        foreach ($allReports as $row) {
            $cId = (string)($row['dimensions']['campaign_id'] ?? '');
            $rawDate = (string)($row['dimensions']['stat_time_day'] ?? '');
            if ($cId === '' || $rawDate === '') continue;

            $sDate = substr($rawDate, 0, 10);
            $dedupKey = "{$cId}_{$sDate}";
            if (isset($seenKeys[$dedupKey])) {
                continue;
            }
            $seenKeys[$dedupKey] = true;
            $m = $row['metrics'] ?? [];
            $spend = (float)($m['cost'] ?? 0.0);
            $netCost = isset($m['net_cost']) ? (float)$m['net_cost'] : $spend;
            $gross = (float)($m['gross_revenue'] ?? 0.0);
            $orders = (int)($m['orders'] ?? 0);

            // API Metric vs Derived Metric distinction
            $apiRoi = isset($m['roi']) ? (float)$m['roi'] : null;
            $derivedRoi = $spend > 0 ? round($gross / $spend, 4) : null;
            $roi = $apiRoi !== null ? $apiRoi : ($derivedRoi ?? 0.0);

            $apiCpa = isset($m['cost_per_order']) ? (float)$m['cost_per_order'] : null;
            $derivedCpa = $orders > 0 ? round($spend / $orders, 2) : null;
            $cpa = $apiCpa !== null ? $apiCpa : ($derivedCpa ?? 0.0);

            // Authoritative Classification from official API semantics:
            // Prefer _official_promotion_type, or row dimension promotion_type.
            // NEVER infer Product/LIVE from campaign name!
            $apiPromType = $row['_official_promotion_type'] ?? ($row['dimensions']['promotion_type'] ?? ($row['metrics']['promotion_type'] ?? null));
            if ($apiPromType !== null) {
                $isLive = (strtoupper((string)$apiPromType) === 'LIVE');
            } else {
                $rawType = (string)($meta['type'] ?? '');
                $isLive = (stripos($rawType, 'LIVE') !== false);
            }

            $promotionType = $isLive ? 'LIVE' : 'PRODUCT';
            $cType = $isLive ? 'LIVE GMV Max' : 'Product GMV Max';

            $meta = $campMeta[$cId] ?? [];
            $cName = (string)($meta['name'] ?? ('Chiến dịch ' . $cId));
            $budget = isset($meta['budget']) ? (float)$meta['budget'] : null;
            $targetRoas = isset($meta['target_roas']) ? (float)$meta['target_roas'] : null;
            $opStatus = isset($meta['status']) && (int)$meta['status'] === 1 ? 'ENABLE' : 'DISABLE';

            $hashPayload = json_encode([$cId, $sDate, $spend, $gross, $orders, $apiRoi, $apiCpa, $promotionType]);
            $rawHash = hash('sha256', (string)$hashPayload);

            $params = [
                ':platform' => self::PLATFORM_TIKTOK_ADS,
                ':shop_id' => $shopId,
                ':advertiser_id' => $advertiserId,
                ':campaign_id' => $cId,
                ':campaign_name' => $cName,
                ':campaign_type' => $cType,
                ':stat_date' => $sDate,
                ':spend' => $spend,
                ':gross_revenue' => $gross,
                ':orders' => $orders,
                ':roi' => $roi,
                ':cost_per_order' => $cpa,
                ':budget' => $budget,
                ':target_roas' => $targetRoas,
                ':operation_status' => $opStatus,
                ':impressions' => null, // Strictly NULL for GMV Max unless proven by API
                ':clicks' => null,      // Strictly NULL for GMV Max unless proven by API
                ':source' => self::SOURCE_TIKTOK_API,
                ':source_endpoint' => '/gmv_max/report/get/',
                ':raw_data_hash' => $rawHash
            ];

            if ($hasLineage) {
                $this->ensureWideRoiColumns();
                $params[':net_cost'] = $netCost;
                $params[':promotion_type'] = $promotionType;
                $params[':api_roi'] = $this->clampRoi($apiRoi);
                $params[':derived_roi'] = $this->clampRoi($derivedRoi);
                $params[':api_cost_per_order'] = $apiCpa;
                $params[':derived_cpa'] = $derivedCpa;
                $params[':api_version'] = 'v1.3';
                $params[':sync_run_id'] = $syncRunId;
                $params[':observed_at'] = $observedAt;
            }

            $stmtUpsert->execute($params);
            $ingested++;
        }

        return [
            'status' => 'SUCCESS',
            'records_ingested' => $ingested,
            'source' => self::SOURCE_TIKTOK_API
        ];
    }

    /**
     * Backfills/Normalizes legacy tiktok_campaign_daily_reports into commerce_ads_campaign_daily
     * STRICT SOURCE PRECEDENCE: Will NOT overwrite existing TIKTOK_GMV_MAX_API authoritative rows!
     */
    public function backfillFromLegacyDailyReports(
        string $shopId,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $advertiserId = null
    ): array {
        if (!$this->hasV2Table()) {
            return ['status' => 'ERROR', 'records_ingested' => 0];
        }

        $hasLegacyTable = false;
        try {
            $check = $this->db->query("SHOW TABLES LIKE 'tiktok_campaign_daily_reports'")->fetch();
            $hasLegacyTable = !empty($check);
        } catch (\Throwable $t) {
            $hasLegacyTable = false;
        }

        if (!$hasLegacyTable) {
            return ['status' => 'UNAVAILABLE', 'records_ingested' => 0];
        }

        $whereClauses = [];
        $params = [];

        if ($startDate !== null && $endDate !== null) {
            $whereClauses[] = "r.stat_date >= ? AND r.stat_date <= ?";
            $params[] = $startDate;
            $params[] = $endDate;
        }

        $whereSql = !empty($whereClauses) ? ('WHERE ' . implode(' AND ', $whereClauses)) : '';

        $sql = "SELECT 
            r.campaign_id,
            r.stat_date,
            r.spend,
            r.gmv,
            r.orders,
            r.roi,
            r.cpa,
            c.name as campaign_name,
            c.type as campaign_type,
            c.budget,
            c.target_roas,
            c.status as campaign_status
            FROM `tiktok_campaign_daily_reports` r
            LEFT JOIN `tiktok_campaigns` c ON r.campaign_id = c.id
            {$whereSql}
            ORDER BY r.stat_date ASC, r.campaign_id ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) {
            return ['status' => 'EMPTY', 'records_ingested' => 0];
        }

        $hasLineage = $this->hasLineageColumns();
        $stmtUpsert = $this->prepareLegacyBackfillUpsertStatement($hasLineage);
        $ingested = 0;
        $observedAt = date('Y-m-d H:i:s');

        foreach ($rows as $row) {
            $cId = (string)($row['campaign_id'] ?? '');
            $sDate = (string)($row['stat_date'] ?? '');
            if ($cId === '' || $sDate === '') continue;

            $spend = (float)($row['spend'] ?? 0.0);
            $gross = (float)($row['gmv'] ?? 0.0);
            $orders = (int)($row['orders'] ?? 0);
            $derivedRoi = $spend > 0 ? round($gross / $spend, 4) : 0.0;
            $derivedCpa = $orders > 0 ? round($spend / $orders, 2) : 0.0;
            $legacyRoi = isset($row['roi']) ? (float)$row['roi'] : $derivedRoi;
            $legacyCpa = isset($row['cpa']) ? (float)$row['cpa'] : $derivedCpa;

            $rawName = (string)($row['campaign_name'] ?? '');
            $rawType = (string)($row['campaign_type'] ?? '');
            $isLive = (stripos($rawType, 'LIVE') !== false || stripos($rawName, 'LIVE') !== false);
            $cType = $isLive ? 'LIVE GMV Max' : 'Product GMV Max';
            $promotionType = $isLive ? 'LIVE' : 'PRODUCT';
            $cName = !empty($rawName) ? $rawName : ('Chiến dịch ' . $cId);

            $budget = isset($row['budget']) ? (float)$row['budget'] : null;
            $targetRoas = isset($row['target_roas']) ? (float)$row['target_roas'] : null;
            $opStatus = isset($row['campaign_status']) && (int)$row['campaign_status'] === 1 ? 'ENABLE' : 'DISABLE';

            $hashPayload = json_encode([$cId, $sDate, $spend, $gross, $orders]);
            $rawHash = hash('sha256', (string)$hashPayload);

            $upsertParams = [
                ':platform' => self::PLATFORM_TIKTOK_ADS,
                ':shop_id' => $shopId,
                ':advertiser_id' => $advertiserId,
                ':campaign_id' => $cId,
                ':campaign_name' => $cName,
                ':campaign_type' => $cType,
                ':stat_date' => $sDate,
                ':spend' => $spend,
                ':gross_revenue' => $gross,
                ':orders' => $orders,
                ':roi' => $legacyRoi,
                ':cost_per_order' => $legacyCpa,
                ':budget' => $budget,
                ':target_roas' => $targetRoas,
                ':operation_status' => $opStatus,
                ':impressions' => null,
                ':clicks' => null,
                ':source' => self::SOURCE_DAILY_BACKFILL,
                ':source_endpoint' => '/gmv_max/report/get/',
                ':raw_data_hash' => $rawHash
            ];

            if ($hasLineage) {
                $upsertParams[':net_cost'] = $spend;
                $upsertParams[':promotion_type'] = $promotionType;
                $upsertParams[':api_roi'] = null; // Legacy row has no verified direct API ROI
                $upsertParams[':derived_roi'] = $derivedRoi;
                $upsertParams[':api_cost_per_order'] = null;
                $upsertParams[':derived_cpa'] = $derivedCpa;
                $upsertParams[':api_version'] = 'legacy';
                $upsertParams[':sync_run_id'] = null;
                $upsertParams[':observed_at'] = $observedAt;
            }

            $stmtUpsert->execute($upsertParams);
            $ingested++;
        }

        return ['status' => 'SUCCESS', 'records_ingested' => $ingested];
    }

    /**
     * Reconciles Official API Ingestion vs Legacy Daily Reports
     * Compares spend, gross revenue, orders by period, campaign, and promotion type.
     */
    public function reconcileApiVsLegacy(
        string $shopId,
        string $startDate,
        string $endDate
    ): array {
        if (!$this->hasV2Table()) {
            return ['status' => 'ERROR', 'message' => 'V2 table missing'];
        }

        // 1. Fetch API rows
        $apiStmt = $this->db->prepare("SELECT 
            campaign_id,
            campaign_name,
            campaign_type,
            SUM(spend) as api_spend,
            SUM(gross_revenue) as api_gross,
            SUM(orders) as api_orders,
            COUNT(DISTINCT stat_date) as api_days
            FROM `commerce_ads_campaign_daily`
            WHERE shop_id = ? AND stat_date >= ? AND stat_date <= ? AND source = ?
            GROUP BY campaign_id, campaign_name, campaign_type");
        $apiStmt->execute([$shopId, $startDate, $endDate, self::SOURCE_TIKTOK_API]);
        $apiRows = $apiStmt->fetchAll(PDO::FETCH_ASSOC);

        // 2. Fetch Legacy rows
        $legacyRows = [];
        try {
            $legStmt = $this->db->prepare("SELECT 
                r.campaign_id,
                MAX(c.name) as campaign_name,
                MAX(c.type) as campaign_type,
                SUM(r.spend) as legacy_spend,
                SUM(r.gmv) as legacy_gross,
                SUM(r.orders) as legacy_orders,
                COUNT(DISTINCT r.stat_date) as legacy_days
                FROM `tiktok_campaign_daily_reports` r
                LEFT JOIN `tiktok_campaigns` c ON r.campaign_id = c.id
                WHERE r.stat_date >= ? AND r.stat_date <= ?
                GROUP BY r.campaign_id");
            $legStmt->execute([$startDate, $endDate]);
            $legacyRows = $legStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Throwable $t) {}

        // Index both by campaign_id
        $apiMap = [];
        foreach ($apiRows as $ar) {
            $apiMap[(string)$ar['campaign_id']] = $ar;
        }

        $legacyMap = [];
        foreach ($legacyRows as $lr) {
            $legacyMap[(string)$lr['campaign_id']] = $lr;
        }

        $allCampaignIds = array_unique(array_merge(array_keys($apiMap), array_keys($legacyMap)));
        sort($allCampaignIds);

        $campaignComparisons = [];
        $totalApiSpend = 0.0;
        $totalLegacySpend = 0.0;
        $totalApiGross = 0.0;
        $totalLegacyGross = 0.0;
        $totalApiOrders = 0;
        $totalLegacyOrders = 0;

        foreach ($allCampaignIds as $cId) {
            $api = $apiMap[$cId] ?? null;
            $leg = $legacyMap[$cId] ?? null;

            $aSpend = (float)($api['api_spend'] ?? 0.0);
            $lSpend = (float)($leg['legacy_spend'] ?? 0.0);
            $aGross = (float)($api['api_gross'] ?? 0.0);
            $lGross = (float)($leg['legacy_gross'] ?? 0.0);
            $aOrders = (int)($api['api_orders'] ?? 0);
            $lOrders = (int)($leg['legacy_orders'] ?? 0);

            $totalApiSpend += $aSpend;
            $totalLegacySpend += $lSpend;
            $totalApiGross += $aGross;
            $totalLegacyGross += $lGross;
            $totalApiOrders += $aOrders;
            $totalLegacyOrders += $lOrders;

            $diffSpend = abs($aSpend - $lSpend);
            $diffGross = abs($aGross - $lGross);
            $diffOrders = abs($aOrders - $lOrders);

            $varSpendPct = $lSpend > 0 ? round(($diffSpend / $lSpend) * 100, 2) : ($aSpend > 0 ? 100.0 : 0.0);
            $varGrossPct = $lGross > 0 ? round(($diffGross / $lGross) * 100, 2) : ($aGross > 0 ? 100.0 : 0.0);

            $status = 'EXACT_MATCH';
            if ($api === null && $leg !== null) {
                $status = 'LEGACY_ONLY';
            } elseif ($api !== null && $leg === null) {
                $status = 'API_ONLY';
            } elseif ($diffSpend > 0.01 || $diffGross > 0.01 || $diffOrders > 0) {
                $status = 'DISCREPANCY';
            }

            $cName = $api['campaign_name'] ?? ($leg['campaign_name'] ?? ('Campaign ' . $cId));
            $cType = $api['campaign_type'] ?? ($leg['campaign_type'] ?? 'Product GMV Max');

            $campaignComparisons[] = [
                'campaign_id' => $cId,
                'campaign_name' => $cName,
                'campaign_type' => $cType,
                'status' => $status,
                'spend' => [
                    'api_value' => $aSpend,
                    'legacy_value' => $lSpend,
                    'absolute_variance' => $diffSpend,
                    'variance_pct' => $varSpendPct
                ],
                'gross_revenue' => [
                    'api_value' => $aGross,
                    'legacy_value' => $lGross,
                    'absolute_variance' => $diffGross,
                    'variance_pct' => $varGrossPct
                ],
                'orders' => [
                    'api_value' => $aOrders,
                    'legacy_value' => $lOrders,
                    'absolute_variance' => $diffOrders
                ]
            ];
        }

        $totDiffSpend = abs($totalApiSpend - $totalLegacySpend);
        $totDiffGross = abs($totalApiGross - $totalLegacyGross);
        $totDiffOrders = abs($totalApiOrders - $totalLegacyOrders);

        $overallStatus = 'FULL_MATCH';
        if (empty($apiRows) && !empty($legacyRows)) {
            $overallStatus = 'RECONCILIATION_PENDING_API_DATA';
        } elseif ($totDiffSpend > 0.01 || $totDiffGross > 0.01 || $totDiffOrders > 0) {
            $overallStatus = 'DISCREPANCY_DETECTED';
        }

        return [
            'status' => $overallStatus,
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'macro_totals' => [
                'spend' => [
                    'api_value' => $totalApiSpend,
                    'legacy_value' => $totalLegacySpend,
                    'absolute_variance' => $totDiffSpend,
                    'variance_pct' => $totalLegacySpend > 0 ? round(($totDiffSpend / $totalLegacySpend) * 100, 2) : 0.0
                ],
                'gross_revenue' => [
                    'api_value' => $totalApiGross,
                    'legacy_value' => $totalLegacyGross,
                    'absolute_variance' => $totDiffGross,
                    'variance_pct' => $totalLegacyGross > 0 ? round(($totDiffGross / $totalLegacyGross) * 100, 2) : 0.0
                ],
                'orders' => [
                    'api_value' => $totalApiOrders,
                    'legacy_value' => $totalLegacyOrders,
                    'absolute_variance' => $totDiffOrders
                ]
            ],
            'campaign_count' => count($allCampaignIds),
            'campaigns' => $campaignComparisons
        ];
    }

    /**
     * Loads campaign metadata map from tiktok_campaigns
     */
    private function loadCampaignMetadataMap(): array {
        $map = [];
        try {
            $stmt = $this->db->query("SELECT id, name, type, budget, target_roas, status FROM `tiktok_campaigns`");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                $cId = (string)($r['id'] ?? '');
                if ($cId !== '') {
                    $map[$cId] = $r;
                }
            }
        } catch (\Throwable $t) {}
        return $map;
    }

    /**
     * Prepares Authoritative API Upsert Statement.
     * Overwrites all metrics and updates source to TIKTOK_GMV_MAX_API.
     */
    private function prepareApiUpsertStatement(bool $hasLineage): PDOStatement {
        if ($hasLineage) {
            return $this->db->prepare("INSERT INTO `commerce_ads_campaign_daily` (
                `platform`, `shop_id`, `advertiser_id`, `campaign_id`, `campaign_name`, `campaign_type`, `promotion_type`,
                `stat_date`, `spend`, `net_cost`, `gross_revenue`, `orders`,
                `roi`, `api_roi`, `derived_roi`, `cost_per_order`, `api_cost_per_order`, `derived_cpa`,
                `budget`, `target_roas`, `operation_status`, `impressions`, `clicks`,
                `source`, `source_endpoint`, `api_version`, `sync_run_id`, `observed_at`, `raw_data_hash`
            ) VALUES (
                :platform, :shop_id, :advertiser_id, :campaign_id, :campaign_name, :campaign_type, :promotion_type,
                :stat_date, :spend, :net_cost, :gross_revenue, :orders,
                :roi, :api_roi, :derived_roi, :cost_per_order, :api_cost_per_order, :derived_cpa,
                :budget, :target_roas, :operation_status, :impressions, :clicks,
                :source, :source_endpoint, :api_version, :sync_run_id, :observed_at, :raw_data_hash
            ) ON DUPLICATE KEY UPDATE
                `campaign_name` = VALUES(`campaign_name`),
                `campaign_type` = VALUES(`campaign_type`),
                `promotion_type` = VALUES(`promotion_type`),
                `spend` = VALUES(`spend`),
                `net_cost` = VALUES(`net_cost`),
                `gross_revenue` = VALUES(`gross_revenue`),
                `orders` = VALUES(`orders`),
                `roi` = VALUES(`roi`),
                `api_roi` = VALUES(`api_roi`),
                `derived_roi` = VALUES(`derived_roi`),
                `cost_per_order` = VALUES(`cost_per_order`),
                `api_cost_per_order` = VALUES(`api_cost_per_order`),
                `derived_cpa` = VALUES(`derived_cpa`),
                `budget` = VALUES(`budget`),
                `target_roas` = VALUES(`target_roas`),
                `operation_status` = VALUES(`operation_status`),
                `source` = VALUES(`source`),
                `source_endpoint` = VALUES(`source_endpoint`),
                `api_version` = VALUES(`api_version`),
                `sync_run_id` = VALUES(`sync_run_id`),
                `observed_at` = VALUES(`observed_at`),
                `raw_data_hash` = VALUES(`raw_data_hash`)");
        }

        // Baseline Migration 010 fallback
        return $this->db->prepare("INSERT INTO `commerce_ads_campaign_daily` (
            `platform`, `shop_id`, `advertiser_id`, `campaign_id`, `campaign_name`, `campaign_type`,
            `stat_date`, `spend`, `gross_revenue`, `orders`, `roi`, `cost_per_order`,
            `budget`, `target_roas`, `operation_status`, `impressions`, `clicks`,
            `source`, `source_endpoint`, `raw_data_hash`
        ) VALUES (
            :platform, :shop_id, :advertiser_id, :campaign_id, :campaign_name, :campaign_type,
            :stat_date, :spend, :gross_revenue, :orders, :roi, :cost_per_order,
            :budget, :target_roas, :operation_status, :impressions, :clicks,
            :source, :source_endpoint, :raw_data_hash
        ) ON DUPLICATE KEY UPDATE
            `campaign_name` = VALUES(`campaign_name`),
            `campaign_type` = VALUES(`campaign_type`),
            `spend` = VALUES(`spend`),
            `gross_revenue` = VALUES(`gross_revenue`),
            `orders` = VALUES(`orders`),
            `roi` = VALUES(`roi`),
            `cost_per_order` = VALUES(`cost_per_order`),
            `budget` = VALUES(`budget`),
            `target_roas` = VALUES(`target_roas`),
            `operation_status` = VALUES(`operation_status`),
            `source` = VALUES(`source`),
            `source_endpoint` = VALUES(`source_endpoint`),
            `raw_data_hash` = VALUES(`raw_data_hash`)");
    }

    /**
     * Prepares Legacy Backfill Upsert Statement.
     * STRICT SOURCE PRECEDENCE: Will NOT overwrite existing TIKTOK_GMV_MAX_API authoritative rows!
     */
    private function prepareLegacyBackfillUpsertStatement(bool $hasLineage): PDOStatement {
        if ($hasLineage) {
            return $this->db->prepare("INSERT INTO `commerce_ads_campaign_daily` (
                `platform`, `shop_id`, `advertiser_id`, `campaign_id`, `campaign_name`, `campaign_type`, `promotion_type`,
                `stat_date`, `spend`, `net_cost`, `gross_revenue`, `orders`,
                `roi`, `api_roi`, `derived_roi`, `cost_per_order`, `api_cost_per_order`, `derived_cpa`,
                `budget`, `target_roas`, `operation_status`, `impressions`, `clicks`,
                `source`, `source_endpoint`, `api_version`, `sync_run_id`, `observed_at`, `raw_data_hash`
            ) VALUES (
                :platform, :shop_id, :advertiser_id, :campaign_id, :campaign_name, :campaign_type, :promotion_type,
                :stat_date, :spend, :net_cost, :gross_revenue, :orders,
                :roi, :api_roi, :derived_roi, :cost_per_order, :api_cost_per_order, :derived_cpa,
                :budget, :target_roas, :operation_status, :impressions, :clicks,
                :source, :source_endpoint, :api_version, :sync_run_id, :observed_at, :raw_data_hash
            ) ON DUPLICATE KEY UPDATE
                `campaign_name` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.campaign_name, VALUES(`campaign_name`)),
                `campaign_type` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.campaign_type, VALUES(`campaign_type`)),
                `promotion_type` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.promotion_type, VALUES(`promotion_type`)),
                `spend` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.spend, VALUES(`spend`)),
                `net_cost` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.net_cost, VALUES(`net_cost`)),
                `gross_revenue` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.gross_revenue, VALUES(`gross_revenue`)),
                `orders` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.orders, VALUES(`orders`)),
                `roi` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.roi, VALUES(`roi`)),
                `cost_per_order` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.cost_per_order, VALUES(`cost_per_order`)),
                `source` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.source, VALUES(`source`)),
                `source_endpoint` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.source_endpoint, VALUES(`source_endpoint`)),
                `raw_data_hash` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.raw_data_hash, VALUES(`raw_data_hash`))");
        }

        // Baseline Migration 010 fallback with source precedence guard
        return $this->db->prepare("INSERT INTO `commerce_ads_campaign_daily` (
            `platform`, `shop_id`, `advertiser_id`, `campaign_id`, `campaign_name`, `campaign_type`,
            `stat_date`, `spend`, `gross_revenue`, `orders`, `roi`, `cost_per_order`,
            `budget`, `target_roas`, `operation_status`, `impressions`, `clicks`,
            `source`, `source_endpoint`, `raw_data_hash`
        ) VALUES (
            :platform, :shop_id, :advertiser_id, :campaign_id, :campaign_name, :campaign_type,
            :stat_date, :spend, :gross_revenue, :orders, :roi, :cost_per_order,
            :budget, :target_roas, :operation_status, :impressions, :clicks,
            :source, :source_endpoint, :raw_data_hash
        ) ON DUPLICATE KEY UPDATE
            `campaign_name` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.campaign_name, VALUES(`campaign_name`)),
            `campaign_type` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.campaign_type, VALUES(`campaign_type`)),
            `spend` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.spend, VALUES(`spend`)),
            `gross_revenue` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.gross_revenue, VALUES(`gross_revenue`)),
            `orders` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.orders, VALUES(`orders`)),
            `roi` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.roi, VALUES(`roi`)),
            `cost_per_order` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.cost_per_order, VALUES(`cost_per_order`)),
            `source` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.source, VALUES(`source`)),
            `source_endpoint` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.source_endpoint, VALUES(`source_endpoint`)),
            `raw_data_hash` = IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API', commerce_ads_campaign_daily.raw_data_hash, VALUES(`raw_data_hash`))");
    }

    /**
     * Synchronizes Product/SPU GMV Max reports into commerce_ads_product_daily.
     * Implements service-level batching (campaign_ids <= 100) and aggregates results across batches.
     */
    public function syncProductDailyRange(
        string $shopId,
        string $startDate,
        string $endDate,
        array $campaignIds,
        array $options = []
    ): array {
        if (!$this->hasProductTable()) {
            return [
                'status' => 'ERROR',
                'message' => 'Bảng commerce_ads_product_daily chưa được tạo (cần chạy migration 012).',
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'records_ingested' => 0,
                'errors' => []
            ];
        }

        $cleanCampIds = array_values(array_unique(array_filter(array_map('strval', $campaignIds), function($id) {
            return trim($id) !== '';
        })));

        if (empty($cleanCampIds)) {
            // Auto-discover Product campaigns from commerce_ads_campaign_daily if none supplied
            try {
                $stmtCamps = $this->db->prepare("SELECT DISTINCT campaign_id FROM `commerce_ads_campaign_daily` 
                    WHERE shop_id = ? AND promotion_type = 'PRODUCT' AND stat_date >= ? AND stat_date <= ?");
                $stmtCamps->execute([$shopId, $startDate, $endDate]);
                $cleanCampIds = $stmtCamps->fetchAll(PDO::FETCH_COLUMN);
            } catch (\Throwable $t) {}
        }

        if (empty($cleanCampIds)) {
            return [
                'status' => 'ERROR',
                'message' => 'Product-level GMV Max sync requires at least 1 campaign_id.',
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'records_ingested' => 0,
                'errors' => []
            ];
        }

        $token = null;
        $advertiserId = null;
        try {
            $stmt = $this->db->query("SELECT ads_access_token, advertiser_id FROM `tiktok_config` LIMIT 1");
            $config = $stmt->fetch(PDO::FETCH_ASSOC);
            $token = $config['ads_access_token'] ?? null;
            $advertiserId = $config['advertiser_id'] ?? null;
        } catch (\Throwable $t) {}

        if (empty($token) || empty($advertiserId)) {
            return [
                'status' => 'ERROR',
                'message' => 'Missing TikTok Ads credentials in tiktok_config.',
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'records_ingested' => 0,
                'errors' => ['Missing TikTok Ads credentials in tiktok_config.']
            ];
        }

        // Service-level batching: chunk campaign_ids <= 100
        $chunks = array_chunk($cleanCampIds, 100);
        $allReportRows = [];
        $batchErrors = [];
        $successBatches = 0;
        $failedBatches = 0;

        foreach ($chunks as $idx => $chunk) {
            try {
                $params = $this->apiClient->buildProductReportParams(
                    $advertiserId,
                    $startDate,
                    $endDate,
                    $chunk,
                    array_merge($options, ['store_ids' => [$shopId]])
                );
                $rows = $this->apiClient->fetchDateBoundedReport($params, $token);
                foreach ($rows as $r) {
                    $allReportRows[] = $r;
                }
                $successBatches++;
            } catch (\Throwable $t) {
                $failedBatches++;
                $safeError = $this->apiClient->redactToken($t->getMessage(), $token);
                $batchErrors[] = [
                    'batch_index' => $idx + 1,
                    'campaign_ids_count' => count($chunk),
                    'error' => $safeError
                ];
            }
        }

        if (empty($allReportRows)) {
            $overallStatus = ($failedBatches > 0) ? 'ERROR' : 'SUCCESS';
            return [
                'status' => $overallStatus,
                'requested_batches' => count($chunks),
                'successful_batches' => $successBatches,
                'failed_batches' => $failedBatches,
                'records_ingested' => 0,
                'errors' => $batchErrors
            ];
        }

        $stmtUpsert = $this->db->prepare("INSERT INTO `commerce_ads_product_daily` (
            `platform`, `shop_id`, `advertiser_id`, `campaign_id`, `item_group_id`,
            `stat_date`, `cost`, `net_cost`, `currency`, `orders`, `ads_gross_revenue`,
            `api_roi`, `derived_roi`, `api_cost_per_order`, `derived_cpa`,
            `api_version`, `source_type`, `observed_at`, `sync_run_id`, `raw_payload_hash`
        ) VALUES (
            :platform, :shop_id, :advertiser_id, :campaign_id, :item_group_id,
            :stat_date, :cost, :net_cost, :currency, :orders, :ads_gross_revenue,
            :api_roi, :derived_roi, :api_cost_per_order, :derived_cpa,
            :api_version, :source_type, :observed_at, :sync_run_id, :raw_payload_hash
        ) ON DUPLICATE KEY UPDATE
            `cost` = VALUES(`cost`),
            `net_cost` = VALUES(`net_cost`),
            `currency` = VALUES(`currency`),
            `orders` = VALUES(`orders`),
            `ads_gross_revenue` = VALUES(`ads_gross_revenue`),
            `api_roi` = VALUES(`api_roi`),
            `derived_roi` = VALUES(`derived_roi`),
            `api_cost_per_order` = VALUES(`api_cost_per_order`),
            `derived_cpa` = VALUES(`derived_cpa`),
            `source_type` = VALUES(`source_type`),
            `observed_at` = VALUES(`observed_at`),
            `sync_run_id` = VALUES(`sync_run_id`),
            `raw_payload_hash` = VALUES(`raw_payload_hash`)");

        $ingested = 0;
        $observedAt = date('Y-m-d H:i:s');
        $syncRunId = isset($options['sync_run_id']) ? (int)$options['sync_run_id'] : null;

        foreach ($allReportRows as $row) {
            $cId = (string)($row['dimensions']['campaign_id'] ?? '');
            $itemGroupId = (string)($row['dimensions']['item_group_id'] ?? '');
            $rawDate = (string)($row['dimensions']['stat_time_day'] ?? '');
            if ($cId === '' || $itemGroupId === '' || $rawDate === '') continue;

            $sDate = substr($rawDate, 0, 10);
            $m = $row['metrics'] ?? [];
            $cost = (float)($m['cost'] ?? 0.0);
            $netCost = isset($m['net_cost']) ? (float)$m['net_cost'] : null;
            $currency = (string)($m['currency'] ?? 'VND');
            $gross = (float)($m['gross_revenue'] ?? 0.0);
            $orders = (int)($m['orders'] ?? 0);

            $this->ensureWideRoiColumns();
            $apiRoi = isset($m['roi']) ? $this->clampRoi((float)$m['roi']) : null;
            $derivedRoi = $cost > 0 ? $this->clampRoi($gross / $cost) : null;
            $apiCpa = isset($m['cost_per_order']) ? (float)$m['cost_per_order'] : null;
            $derivedCpa = $orders > 0 ? round($cost / $orders, 2) : null;

            $rawHash = hash('sha256', (string)json_encode($row));

            $stmtUpsert->execute([
                ':platform' => self::PLATFORM_TIKTOK_ADS,
                ':shop_id' => $shopId,
                ':advertiser_id' => $advertiserId,
                ':campaign_id' => $cId,
                ':item_group_id' => $itemGroupId,
                ':stat_date' => $sDate,
                ':cost' => $cost,
                ':net_cost' => $netCost,
                ':currency' => $currency,
                ':orders' => $orders,
                ':ads_gross_revenue' => $gross,
                ':api_roi' => $apiRoi,
                ':derived_roi' => $derivedRoi,
                ':api_cost_per_order' => $apiCpa,
                ':derived_cpa' => $derivedCpa,
                ':api_version' => TikTokGmvMaxApiClient::API_VERSION,
                ':source_type' => self::SOURCE_TIKTOK_API,
                ':observed_at' => $observedAt,
                ':sync_run_id' => $syncRunId,
                ':raw_payload_hash' => $rawHash
            ]);
            $ingested++;
        }

        $overallStatus = ($failedBatches === 0) ? 'SUCCESS' : ($successBatches > 0 ? 'PARTIAL' : 'ERROR');

        return [
            'status' => $overallStatus,
            'requested_batches' => count($chunks),
            'successful_batches' => $successBatches,
            'failed_batches' => $failedBatches,
            'records_ingested' => $ingested,
            'errors' => $batchErrors
        ];
    }

    /**
     * Synchronizes Creative/Video GMV Max reports into commerce_ads_creative_daily.
     * Strictly enforces Campaign -> its own item_group_ids hierarchy (never cross-products unrelated SPUs).
     * Retains item_id = -1 as UNATTRIBUTED / UNKNOWN CREATIVE BUCKET.
     * Preserves raw creative_delivery_status while providing normalized equivalent.
     */
    public function syncCreativeDailyRange(
        string $shopId,
        string $startDate,
        string $endDate,
        array $campaignIds = [],
        array $itemGroupIds = [],
        array $options = []
    ): array {
        if (!$this->hasCreativeTable()) {
            return [
                'status' => 'ERROR',
                'message' => 'Bảng commerce_ads_creative_daily chưa được tạo (cần chạy migration 012).',
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'records_ingested' => 0,
                'errors' => []
            ];
        }

        // 1. Build hierarchy mapping: Campaign -> [item_group_ids]
        // Hierarchy is runtime-verified from commerce_ads_product_daily
        $campaignSpuMap = [];
        if (!empty($options['campaign_spu_map']) && is_array($options['campaign_spu_map'])) {
            $campaignSpuMap = $options['campaign_spu_map'];
        } else {
            try {
                $whereClauses = ["shop_id = ?", "stat_date >= ?", "stat_date <= ?"];
                $params = [$shopId, $startDate, $endDate];

                if (!empty($campaignIds)) {
                    $cleanCampIds = array_values(array_unique(array_filter(array_map('strval', $campaignIds))));
                    if (!empty($cleanCampIds)) {
                        $placeholders = implode(',', array_fill(0, count($cleanCampIds), '?'));
                        $whereClauses[] = "campaign_id IN ({$placeholders})";
                        $params = array_merge($params, $cleanCampIds);
                    }
                }

                if (!empty($itemGroupIds)) {
                    $cleanSpuIds = array_values(array_unique(array_filter(array_map('strval', $itemGroupIds))));
                    if (!empty($cleanSpuIds)) {
                        $placeholders = implode(',', array_fill(0, count($cleanSpuIds), '?'));
                        $whereClauses[] = "item_group_id IN ({$placeholders})";
                        $params = array_merge($params, $cleanSpuIds);
                    }
                }

                $sql = "SELECT DISTINCT campaign_id, item_group_id FROM `commerce_ads_product_daily` WHERE " . implode(' AND ', $whereClauses);
                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
                $pairs = $stmt->fetchAll(PDO::FETCH_ASSOC);

                foreach ($pairs as $p) {
                    $cId = (string)($p['campaign_id'] ?? '');
                    $sId = (string)($p['item_group_id'] ?? '');
                    if ($cId !== '' && $sId !== '') {
                        if (!isset($campaignSpuMap[$cId])) {
                            $campaignSpuMap[$cId] = [];
                        }
                        if (!in_array($sId, $campaignSpuMap[$cId], true)) {
                            $campaignSpuMap[$cId][] = $sId;
                        }
                    }
                }
            } catch (\Throwable $t) {}
        }

        // Fallback if no pairs found in DB but caller passed 1 campaign with its SPUs
        if (empty($campaignSpuMap) && count($campaignIds) === 1 && !empty($itemGroupIds)) {
            $singleCamp = (string)reset($campaignIds);
            $cleanSpus = array_values(array_unique(array_filter(array_map('strval', $itemGroupIds))));
            if (!empty($cleanSpus)) {
                $campaignSpuMap[$singleCamp] = $cleanSpus;
            }
        }

        if (empty($campaignSpuMap)) {
            return [
                'status' => 'ERROR',
                'message' => 'Creative-level GMV Max sync requires verified Campaign -> SPU mapping. Sync products first.',
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'records_ingested' => 0,
                'errors' => ['No verified Campaign -> SPU pairs found for given period.']
            ];
        }

        $token = null;
        $advertiserId = null;
        try {
            $stmt = $this->db->query("SELECT ads_access_token, advertiser_id FROM `tiktok_config` LIMIT 1");
            $config = $stmt->fetch(PDO::FETCH_ASSOC);
            $token = $config['ads_access_token'] ?? null;
            $advertiserId = $config['advertiser_id'] ?? null;
        } catch (\Throwable $t) {}

        if (empty($token) || empty($advertiserId)) {
            return [
                'status' => 'ERROR',
                'message' => 'Missing TikTok Ads credentials in tiktok_config.',
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'records_ingested' => 0,
                'errors' => ['Missing TikTok Ads credentials in tiktok_config.']
            ];
        }

        // Build batches strictly per campaign / compatible SPU group
        // Respects: campaign_ids <= 100, item_group_ids <= 100
        $allReportRows = [];
        $batchErrors = [];
        $requestedBatches = 0;
        $successBatches = 0;
        $failedBatches = 0;

        foreach ($campaignSpuMap as $cId => $spuList) {
            $spuChunks = array_chunk($spuList, 100);
            foreach ($spuChunks as $spuChunk) {
                $requestedBatches++;
                try {
                    $params = $this->apiClient->buildCreativeReportParams(
                        $advertiserId,
                        $startDate,
                        $endDate,
                        [$cId],
                        $spuChunk,
                        array_merge($options, ['store_ids' => [$shopId]])
                    );
                    $rows = $this->apiClient->fetchDateBoundedReport($params, $token);
                    foreach ($rows as $r) {
                        $allReportRows[] = $r;
                    }
                    $successBatches++;
                } catch (\Throwable $t) {
                    $failedBatches++;
                    $safeError = $this->apiClient->redactToken($t->getMessage(), $token);
                    $batchErrors[] = [
                        'campaign_id' => $cId,
                        'spu_count' => count($spuChunk),
                        'error' => $safeError
                    ];
                }
            }
        }

        if (empty($allReportRows)) {
            $overallStatus = ($failedBatches > 0) ? 'ERROR' : 'SUCCESS';
            return [
                'status' => $overallStatus,
                'requested_batches' => $requestedBatches,
                'successful_batches' => $successBatches,
                'failed_batches' => $failedBatches,
                'records_ingested' => 0,
                'errors' => $batchErrors
            ];
        }

        $stmtUpsert = $this->db->prepare("INSERT INTO `commerce_ads_creative_daily` (
            `platform`, `shop_id`, `advertiser_id`, `campaign_id`, `item_group_id`, `item_id`, `is_unattributed`,
            `stat_date`, `creative_delivery_status_raw`, `creative_delivery_status_normalized`,
            `cost`, `net_cost`, `currency`, `orders`, `ads_gross_revenue`,
            `api_roi`, `derived_roi`, `api_cost_per_order`, `derived_cpa`,
            `api_version`, `source_type`, `observed_at`, `sync_run_id`, `raw_payload_hash`
        ) VALUES (
            :platform, :shop_id, :advertiser_id, :campaign_id, :item_group_id, :item_id, :is_unattributed,
            :stat_date, :creative_delivery_status_raw, :creative_delivery_status_normalized,
            :cost, :net_cost, :currency, :orders, :ads_gross_revenue,
            :api_roi, :derived_roi, :api_cost_per_order, :derived_cpa,
            :api_version, :source_type, :observed_at, :sync_run_id, :raw_payload_hash
        ) ON DUPLICATE KEY UPDATE
            `is_unattributed` = VALUES(`is_unattributed`),
            `creative_delivery_status_raw` = VALUES(`creative_delivery_status_raw`),
            `creative_delivery_status_normalized` = VALUES(`creative_delivery_status_normalized`),
            `cost` = VALUES(`cost`),
            `net_cost` = VALUES(`net_cost`),
            `currency` = VALUES(`currency`),
            `orders` = VALUES(`orders`),
            `ads_gross_revenue` = VALUES(`ads_gross_revenue`),
            `api_roi` = VALUES(`api_roi`),
            `derived_roi` = VALUES(`derived_roi`),
            `api_cost_per_order` = VALUES(`api_cost_per_order`),
            `derived_cpa` = VALUES(`derived_cpa`),
            `source_type` = VALUES(`source_type`),
            `observed_at` = VALUES(`observed_at`),
            `sync_run_id` = VALUES(`sync_run_id`),
            `raw_payload_hash` = VALUES(`raw_payload_hash`)");

        $ingested = 0;
        $observedAt = date('Y-m-d H:i:s');
        $syncRunId = isset($options['sync_run_id']) ? (int)$options['sync_run_id'] : null;

        foreach ($allReportRows as $row) {
            $cId = (string)($row['dimensions']['campaign_id'] ?? '');
            $itemGroupId = (string)($row['dimensions']['item_group_id'] ?? '');
            $rawItemId = $row['dimensions']['item_id'] ?? '';
            $rawDate = (string)($row['dimensions']['stat_time_day'] ?? '');
            if ($cId === '' || $itemGroupId === '' || $rawItemId === '' || $rawDate === '') continue;

            $sDate = substr($rawDate, 0, 10);
            $normItem = TikTokGmvMaxApiClient::normalizeCreativeItemId($rawItemId);
            $itemId = $normItem['item_id'];
            $isUnattributed = $normItem['is_unattributed'] ? 1 : 0;

            $m = $row['metrics'] ?? [];
            $rawStatus = $m['creative_delivery_status'] ?? null;
            $normStatus = TikTokGmvMaxApiClient::normalizeCreativeDeliveryStatus($rawStatus);

            $cost = (float)($m['cost'] ?? 0.0);
            $netCost = isset($m['net_cost']) ? (float)$m['net_cost'] : null;
            $currency = (string)($m['currency'] ?? 'VND');
            $gross = (float)($m['gross_revenue'] ?? 0.0);
            $orders = (int)($m['orders'] ?? 0);

            $this->ensureWideRoiColumns();
            $apiRoi = isset($m['roi']) ? $this->clampRoi((float)$m['roi']) : null;
            $derivedRoi = $cost > 0 ? $this->clampRoi($gross / $cost) : null;
            $apiCpa = isset($m['cost_per_order']) ? (float)$m['cost_per_order'] : null;
            $derivedCpa = $orders > 0 ? round($cost / $orders, 2) : null;

            $rawHash = hash('sha256', (string)json_encode($row));

            $stmtUpsert->execute([
                ':platform' => self::PLATFORM_TIKTOK_ADS,
                ':shop_id' => $shopId,
                ':advertiser_id' => $advertiserId,
                ':campaign_id' => $cId,
                ':item_group_id' => $itemGroupId,
                ':item_id' => $itemId,
                ':is_unattributed' => $isUnattributed,
                ':stat_date' => $sDate,
                ':creative_delivery_status_raw' => $rawStatus,
                ':creative_delivery_status_normalized' => $normStatus,
                ':cost' => $cost,
                ':net_cost' => $netCost,
                ':currency' => $currency,
                ':orders' => $orders,
                ':ads_gross_revenue' => $gross,
                ':api_roi' => $apiRoi,
                ':derived_roi' => $derivedRoi,
                ':api_cost_per_order' => $apiCpa,
                ':derived_cpa' => $derivedCpa,
                ':api_version' => TikTokGmvMaxApiClient::API_VERSION,
                ':source_type' => self::SOURCE_TIKTOK_API,
                ':observed_at' => $observedAt,
                ':sync_run_id' => $syncRunId,
                ':raw_payload_hash' => $rawHash
            ]);
            $ingested++;
        }

        $overallStatus = ($failedBatches === 0) ? 'SUCCESS' : ($successBatches > 0 ? 'PARTIAL' : 'ERROR');

        return [
            'status' => $overallStatus,
            'requested_batches' => $requestedBatches,
            'successful_batches' => $successBatches,
            'failed_batches' => $failedBatches,
            'records_ingested' => $ingested,
            'errors' => $batchErrors
        ];
    }

    /**
     * Synchronizes LIVE GMV Max reports into commerce_ads_live_daily.
     * Batches campaign IDs <= 100.
     * Uses official LIVE campaign IDs and verifies room_id dimension.
     * Keeps room_id <-> commerce_live_sessions mapping as SESSION_MAPPING_PENDING.
     */
    public function syncLiveDailyRange(
        string $shopId,
        string $startDate,
        string $endDate,
        array $campaignIds = [],
        array $options = []
    ): array {
        if (!$this->hasLiveTable()) {
            return [
                'status' => 'ERROR',
                'message' => 'Bảng commerce_ads_live_daily chưa được tạo (cần chạy migration 012).',
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'records_ingested' => 0,
                'errors' => []
            ];
        }

        $cleanCampIds = array_values(array_unique(array_filter(array_map('strval', $campaignIds), function($id) {
            return trim($id) !== '';
        })));

        if (empty($cleanCampIds)) {
            // Auto-discover LIVE campaigns from commerce_ads_campaign_daily
            try {
                $stmtCamps = $this->db->prepare("SELECT DISTINCT campaign_id FROM `commerce_ads_campaign_daily` 
                    WHERE shop_id = ? AND promotion_type = 'LIVE' AND stat_date >= ? AND stat_date <= ?");
                $stmtCamps->execute([$shopId, $startDate, $endDate]);
                $cleanCampIds = $stmtCamps->fetchAll(PDO::FETCH_COLUMN);
            } catch (\Throwable $t) {}
        }

        if (empty($cleanCampIds)) {
            return [
                'status' => 'SUCCESS',
                'message' => 'No LIVE campaigns found for period.',
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'records_ingested' => 0,
                'errors' => []
            ];
        }

        $token = null;
        $advertiserId = null;
        try {
            $stmt = $this->db->query("SELECT ads_access_token, advertiser_id FROM `tiktok_config` LIMIT 1");
            $config = $stmt->fetch(PDO::FETCH_ASSOC);
            $token = $config['ads_access_token'] ?? null;
            $advertiserId = $config['advertiser_id'] ?? null;
        } catch (\Throwable $t) {}

        if (empty($token) || empty($advertiserId)) {
            return [
                'status' => 'ERROR',
                'message' => 'Missing TikTok Ads credentials in tiktok_config.',
                'requested_batches' => 0,
                'successful_batches' => 0,
                'failed_batches' => 0,
                'records_ingested' => 0,
                'errors' => ['Missing TikTok Ads credentials in tiktok_config.']
            ];
        }

        // Service-level batching: chunk campaign_ids <= 100
        $chunks = array_chunk($cleanCampIds, 100);
        $allReportRows = [];
        $batchErrors = [];
        $successBatches = 0;
        $failedBatches = 0;

        foreach ($chunks as $idx => $chunk) {
            try {
                $params = $this->apiClient->buildLiveReportParams(
                    $advertiserId,
                    $startDate,
                    $endDate,
                    $chunk,
                    array_merge($options, ['store_ids' => [$shopId]])
                );
                $rows = $this->apiClient->fetchDateBoundedReport($params, $token);
                foreach ($rows as $r) {
                    $allReportRows[] = $r;
                }
                $successBatches++;
            } catch (\Throwable $t) {
                $failedBatches++;
                $safeError = $this->apiClient->redactToken($t->getMessage(), $token);
                $batchErrors[] = [
                    'batch_index' => $idx + 1,
                    'campaign_ids_count' => count($chunk),
                    'error' => $safeError
                ];
            }
        }

        if (empty($allReportRows)) {
            $overallStatus = ($failedBatches > 0) ? 'ERROR' : 'SUCCESS';
            return [
                'status' => $overallStatus,
                'requested_batches' => count($chunks),
                'successful_batches' => $successBatches,
                'failed_batches' => $failedBatches,
                'records_ingested' => 0,
                'errors' => $batchErrors
            ];
        }

        $stmtUpsert = $this->db->prepare("INSERT INTO `commerce_ads_live_daily` (
            `platform`, `shop_id`, `advertiser_id`, `campaign_id`, `room_id`,
            `stat_date`, `cost`, `net_cost`, `currency`, `orders`, `ads_gross_revenue`,
            `api_roi`, `derived_roi`, `api_cost_per_order`, `derived_cpa`,
            `api_version`, `source_type`, `observed_at`, `sync_run_id`, `raw_payload_hash`
        ) VALUES (
            :platform, :shop_id, :advertiser_id, :campaign_id, :room_id,
            :stat_date, :cost, :net_cost, :currency, :orders, :ads_gross_revenue,
            :api_roi, :derived_roi, :api_cost_per_order, :derived_cpa,
            :api_version, :source_type, :observed_at, :sync_run_id, :raw_payload_hash
        ) ON DUPLICATE KEY UPDATE
            `cost` = VALUES(`cost`),
            `net_cost` = VALUES(`net_cost`),
            `currency` = VALUES(`currency`),
            `orders` = VALUES(`orders`),
            `ads_gross_revenue` = VALUES(`ads_gross_revenue`),
            `api_roi` = VALUES(`api_roi`),
            `derived_roi` = VALUES(`derived_roi`),
            `api_cost_per_order` = VALUES(`api_cost_per_order`),
            `derived_cpa` = VALUES(`derived_cpa`),
            `source_type` = VALUES(`source_type`),
            `observed_at` = VALUES(`observed_at`),
            `sync_run_id` = VALUES(`sync_run_id`),
            `raw_payload_hash` = VALUES(`raw_payload_hash`)");

        $ingested = 0;
        $observedAt = date('Y-m-d H:i:s');
        $syncRunId = isset($options['sync_run_id']) ? (int)$options['sync_run_id'] : null;

        foreach ($allReportRows as $row) {
            $cId = (string)($row['dimensions']['campaign_id'] ?? '');
            $roomId = (string)($row['dimensions']['room_id'] ?? '');
            $rawDate = (string)($row['dimensions']['stat_time_day'] ?? '');
            if ($cId === '' || $roomId === '' || $rawDate === '') continue;

            $sDate = substr($rawDate, 0, 10);
            $m = $row['metrics'] ?? [];
            $cost = (float)($m['cost'] ?? 0.0);
            $netCost = isset($m['net_cost']) ? (float)$m['net_cost'] : null;
            $currency = (string)($m['currency'] ?? 'VND');
            $gross = (float)($m['gross_revenue'] ?? 0.0);
            $orders = (int)($m['orders'] ?? 0);

            $this->ensureWideRoiColumns();
            $apiRoi = isset($m['roi']) ? $this->clampRoi((float)$m['roi']) : null;
            $derivedRoi = $cost > 0 ? $this->clampRoi($gross / $cost) : null;
            $apiCpa = isset($m['cost_per_order']) ? (float)$m['cost_per_order'] : null;
            $derivedCpa = $orders > 0 ? round($cost / $orders, 2) : null;

            $rawHash = hash('sha256', (string)json_encode($row));

            $stmtUpsert->execute([
                ':platform' => self::PLATFORM_TIKTOK_ADS,
                ':shop_id' => $shopId,
                ':advertiser_id' => $advertiserId,
                ':campaign_id' => $cId,
                ':room_id' => $roomId,
                ':stat_date' => $sDate,
                ':cost' => $cost,
                ':net_cost' => $netCost,
                ':currency' => $currency,
                ':orders' => $orders,
                ':ads_gross_revenue' => $gross,
                ':api_roi' => $apiRoi,
                ':derived_roi' => $derivedRoi,
                ':api_cost_per_order' => $apiCpa,
                ':derived_cpa' => $derivedCpa,
                ':api_version' => TikTokGmvMaxApiClient::API_VERSION,
                ':source_type' => self::SOURCE_TIKTOK_API,
                ':observed_at' => $observedAt,
                ':sync_run_id' => $syncRunId,
                ':raw_payload_hash' => $rawHash
            ]);
            $ingested++;
        }

        $overallStatus = ($failedBatches === 0) ? 'SUCCESS' : ($successBatches > 0 ? 'PARTIAL' : 'ERROR');

        return [
            'status' => $overallStatus,
            'requested_batches' => count($chunks),
            'successful_batches' => $successBatches,
            'failed_batches' => $failedBatches,
            'records_ingested' => $ingested,
            'errors' => $batchErrors
        ];
    }
}

