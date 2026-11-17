<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE V2 - AUTOMATED SYNC ORCHESTRATOR
 * File: public/api/commerce_sync_orchestrator.php
 * Target: Sprint V2-04 Central Sync Orchestrator
 *
 * Responsibilities:
 * 1. Orchestrates incremental ingestion across 5 core domains:
 *    - ORDERS (commerce_orders, commerce_order_items)
 *    - RMA / RETURNS / REFUNDS (commerce_aftersales, commerce_loss_ledger)
 *    - ADS_CAMPAIGN (commerce_ads_campaign_daily)
 *    - FINANCE (commerce_finance_statements, commerce_finance_transactions)
 *    - ANALYTICS (commerce_shop_analytics_daily, compass overview)
 *    Plus future-ready domains (ADS_PRODUCT, ADS_CREATIVE, ADS_LIVE, FULFILLMENT).
 * 2. Incremental Sync: Only queries missing/new data past last synced checkpoint.
 * 3. Idempotent execution: Running the same range twice never duplicates facts.
 * 4. Safe Latency & Freshness: Recognizes API publishing latency (T-1, T-2).
 *    Never creates synthetic zero facts. Missing != 0.
 * 5. Rolling Refresh Window (HOT/WARM/MATURED):
 *    - HOT (last 3 days): Refreshes mutable recent orders/RMA statuses.
 *    - WARM (last 14 days): Periodic refresh.
 *    - MATURED: Immutable historical facts preserved.
 * 6. Authoritative Audit Evidence in commerce_sync_runs:
 *    Records platform, shop_id, domain, start_date, end_date, started_at, completed_at,
 *    status, records_read, records_written, cursor, api_endpoint, error, latest_available_date.
 * 7. Two trigger mechanisms:
 *    - Background / scheduled cron incremental capability.
 *    - Safe manual "Đồng bộ ngay" trigger.
 * ====================================================================
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/commerce_sync_service.php';
require_once __DIR__ . '/commerce_aftersales_service.php';
require_once __DIR__ . '/commerce_finance_service.php';
require_once __DIR__ . '/commerce_analytics_service.php';
require_once __DIR__ . '/commerce_ads_ingestion_service.php';
require_once __DIR__ . '/commerce_daily_aggregate_service.php';
require_once __DIR__ . '/commerce_affiliate_service.php';

class CommerceSyncOrchestrator {
    // Platform
    public const PLATFORM = 'tiktok_shop';

    // Core Domains
    public const DOMAIN_ORDERS       = 'order';
    public const DOMAIN_RMA          = 'rma';
    public const DOMAIN_LOSS         = 'loss';
    public const DOMAIN_ADS_CAMPAIGN = 'ads_campaign';
    public const DOMAIN_FINANCE      = 'finance';
    public const DOMAIN_ANALYTICS    = 'analytics';
    public const DOMAIN_CUSTOMER     = 'customer_ingestion';

    // Domain Arrays
    public const CORE_DOMAINS = [
        self::DOMAIN_ORDERS,
        self::DOMAIN_RMA,
        self::DOMAIN_LOSS,
        self::DOMAIN_ADS_CAMPAIGN,
        self::DOMAIN_FINANCE,
        self::DOMAIN_ANALYTICS
    ];

    // Future-Ready Domains
    public const DOMAIN_ADS_PRODUCT  = 'ads_product';
    public const DOMAIN_ADS_CREATIVE = 'ads_creative';
    public const DOMAIN_ADS_LIVE     = 'ads_live';
    public const DOMAIN_FULFILLMENT  = 'fulfillment';
    public const DOMAIN_AFFILIATE    = 'affiliate';

    public const FUTURE_DOMAINS = [
        self::DOMAIN_ADS_PRODUCT,
        self::DOMAIN_ADS_CREATIVE,
        self::DOMAIN_ADS_LIVE,
        self::DOMAIN_FULFILLMENT,
        self::DOMAIN_AFFILIATE
    ];

    // Window Configuration
    public const HOT_WINDOW_DAYS     = 3;   // Days refreshed for mutable order/refund lifecycles
    public const WARM_WINDOW_DAYS    = 14;  // Periodic reconciliation
    public const MATURED_WINDOW_DAYS = 90;  // Historical immutable boundary

    // Sync Modes
    public const MODE_INCREMENTAL    = 'INCREMENTAL';
    public const MODE_MANUAL_RANGE   = 'MANUAL_RANGE';
    public const MODE_HOT_REFRESH    = 'HOT_REFRESH';

    // Domain Availability States
    public const STATE_AVAILABLE         = 'AVAILABLE';
    public const STATE_PARTIAL           = 'PARTIAL';
    public const STATE_NOT_YET_AVAILABLE = 'NOT_YET_AVAILABLE';
    public const STATE_NOT_AVAILABLE     = 'NOT_AVAILABLE';
    public const STATE_UNKNOWN           = 'UNKNOWN';
    public const STATE_ERROR             = 'ERROR';

    // Job Lifecycle Statuses (Sprint V2-04.3)
    public const JOB_STATUS_QUEUED    = 'QUEUED';
    public const JOB_STATUS_RUNNING   = 'RUNNING';
    public const JOB_STATUS_COMPLETED = 'COMPLETED';
    public const JOB_STATUS_PARTIAL   = 'PARTIAL';
    public const JOB_STATUS_FAILED    = 'FAILED';
    public const JOB_STATUS_CANCELLED = 'CANCELLED';

    // Stale Heartbeat Threshold (Sprint V2-04.3)
    public const STALE_HEARTBEAT_THRESHOLD_SECONDS = 180;

    public function resolveIncrementalDateRange(string $domain, ?string $latestSyncedDate, string $targetDate): array {
        if (!$latestSyncedDate) {
            $start = date('Y-m-d', strtotime('-30 days', strtotime($targetDate)));
            return ['start_date' => $start, 'end_date' => $targetDate];
        }

        if (in_array($domain, [self::DOMAIN_ORDERS, self::DOMAIN_RMA, 'order', 'rma'], true)) {
            $hotStart = date('Y-m-d', strtotime('-' . self::HOT_WINDOW_DAYS . ' days', strtotime($targetDate)));
            $start = min($latestSyncedDate, $hotStart);
        } else {
            $nextDay = date('Y-m-d', strtotime('+1 day', strtotime($latestSyncedDate)));
            $start = min($nextDay, $targetDate);
        }

        return [
            'start_date' => $start,
            'end_date' => $targetDate
        ];
    }

    public function calculateRefreshWindows(?string $referenceDate = null): array {
        $ref = $referenceDate ?: date('Y-m-d');
        $hotStart = date('Y-m-d', strtotime('-' . self::HOT_WINDOW_DAYS . ' days', strtotime($ref)));
        $warmStart = date('Y-m-d', strtotime('-' . (self::HOT_WINDOW_DAYS + self::WARM_WINDOW_DAYS) . ' days', strtotime($ref)));
        $warmEnd = date('Y-m-d', strtotime('-1 day', strtotime($hotStart)));

        return [
            'HOT' => [
                'start_date' => $hotStart,
                'end_date' => $ref,
                'window_days' => self::HOT_WINDOW_DAYS,
                'description' => 'Mutable active order and refund lifecycle refresh'
            ],
            'WARM' => [
                'start_date' => $warmStart,
                'end_date' => $warmEnd,
                'window_days' => self::WARM_WINDOW_DAYS,
                'description' => 'Periodic reconciliation window'
            ],
            'MATURED' => [
                'end_date' => date('Y-m-d', strtotime('-1 day', strtotime($warmStart))),
                'description' => 'Immutable historical facts'
            ]
        ];
    }

    public function getSafeAvailability(string $domain, string $targetDate): array {
        $today = date('Y-m-d');
        $latencyDays = in_array($domain, [self::DOMAIN_ADS_CAMPAIGN, 'ads_campaign', self::DOMAIN_ANALYTICS, 'analytics'], true) ? 1 : 0;
        $latestPublishDate = date('Y-m-d', strtotime("-{$latencyDays} day", strtotime($today)));

        if ($targetDate > $latestPublishDate) {
            return [
                'status' => self::STATE_NOT_YET_AVAILABLE,
                'latest_available_date' => $latestPublishDate,
                'message' => "Dữ liệu kỳ {$targetDate} chưa được TikTok công bố (Độ trễ API: T-{$latencyDays})"
            ];
        }

        return [
            'status' => self::STATE_AVAILABLE,
            'latest_available_date' => $latestPublishDate,
            'message' => 'Dữ liệu khả dụng'
        ];
    }

    public static function normalizeDomainStatus(?string $status): string {
        $allowed = [
            self::STATE_AVAILABLE,
            self::STATE_PARTIAL,
            self::STATE_NOT_YET_AVAILABLE,
            self::STATE_NOT_AVAILABLE,
            self::STATE_UNKNOWN,
            self::STATE_ERROR,
            'COMPLETED',
            'SUCCESS',
            'DISABLED'
        ];
        if (!$status || !in_array(strtoupper($status), $allowed, true)) {
            return self::STATE_UNKNOWN;
        }
        return strtoupper($status);
    }

    public function recordSyncRun(string $shopId, string $domain, string $status, array $meta = [], ?int $existingRunId = null): int {
        if ($existingRunId) {
            $this->recordSyncRunEnd($existingRunId, $status, $meta['records_read'] ?? ($meta['records_processed'] ?? 0), $meta['records_written'] ?? 0, $meta['error_message'] ?? null, $meta['latest_available_date'] ?? null);
            return $existingRunId;
        }
        return $this->recordSyncRunStart($shopId, $domain, $meta['sync_type'] ?? self::MODE_INCREMENTAL, $meta['start_date'] ?? null, $meta['end_date'] ?? null, $meta['api_endpoint'] ?? null);
    }

    private PDO $db;
    private array $config;
    private ?CommerceSyncService $syncService;
    private ?TikTokShopClient $client;

    public function __construct(?PDO $db = null, array $config = [], ?CommerceSyncService $syncService = null, ?TikTokShopClient $client = null) {
        $this->db = $db ?? getDBConnection();
        $this->syncService = $syncService;
        $this->client = $client;
        $this->config = array_merge([
            'hot_window_days' => self::HOT_WINDOW_DAYS,
            'warm_window_days' => self::WARM_WINDOW_DAYS,
            'batch_size' => 50,
            'max_pages' => 200
        ], $config);
    }

    /**
     * Synchronizes a single domain with audit logging and latency awareness.
     *
     * @param string $shopId
     * @param string $domain
     * @param string|null $startDate YYYY-MM-DD
     * @param string|null $endDate YYYY-MM-DD
     * @param array $options
     * @return array
     */
    public function syncDomain(
        string $shopId,
        string $domain,
        ?string $startDate = null,
        ?string $endDate = null,
        array $options = []
    ): array {
        $today = date('Y-m-d');
        $resolvedEnd = $endDate ?: $today;
        $resolvedStart = $startDate;

        switch ($domain) {
            case self::DOMAIN_ORDERS:
            case 'orders':
                return $this->syncOrdersDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_RMA:
            case 'returns':
            case 'refunds':
            case 'aftersales':
                return $this->syncRmaDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_LOSS:
            case 'loss':
            case 'loss_reconciliation':
            case 'reconciliation':
                return $this->syncLossDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_ADS_CAMPAIGN:
            case 'ads':
            case 'ads_campaigns':
                return $this->syncAdsCampaignDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_FINANCE:
            case 'settlement':
                return $this->syncFinanceDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_ANALYTICS:
            case 'compass':
                return $this->syncAnalyticsDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_CUSTOMER:
            case 'customer':
            case 'customer_ingestion':
            case 'customers':
                return $this->syncCustomerDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_ADS_PRODUCT:
            case 'ads_products':
                return $this->syncAdsProductDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_ADS_CREATIVE:
            case 'ads_creatives':
                return $this->syncAdsCreativeDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_ADS_LIVE:
            case 'ads_lives':
                return $this->syncAdsLiveDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_FULFILLMENT:
                return $this->syncFulfillmentDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            case self::DOMAIN_AFFILIATE:
            case 'affiliate':
            case 'creator':
                return $this->syncAffiliateDomain($shopId, $resolvedStart, $resolvedEnd, $options);

            default:
                return [
                    'domain' => $domain,
                    'status' => self::STATE_ERROR,
                    'message' => "Miền dữ liệu không hợp lệ: '{$domain}'",
                    'records_read' => 0,
                    'records_written' => 0
                ];
        }
    }

    /**
     * Executes incremental synchronization across all 5 core domains in prioritized sequence.
     *
     * @param string $shopId
     * @param string|null $startDate
     * @param string|null $endDate
     * @param string $mode
     * @return array
     */
    public function syncAll(
        string $shopId,
        ?string $startDate = null,
        ?string $endDate = null,
        string $mode = self::MODE_INCREMENTAL
    ): array {
        $startTime = microtime(true);
        $results = [];
        $coreDomains = [
            self::DOMAIN_ORDERS,
            self::DOMAIN_RMA,
            self::DOMAIN_LOSS,
            self::DOMAIN_ADS_CAMPAIGN,
            self::DOMAIN_FINANCE,
            self::DOMAIN_ANALYTICS
        ];

        $overallSuccess = true;
        $totalRecordsWritten = 0;

        foreach ($coreDomains as $dom) {
            try {
                $domResult = $this->syncDomain($shopId, $dom, $startDate, $endDate, ['mode' => $mode]);
                $results[$dom] = $domResult;
                $totalRecordsWritten += ($domResult['records_written'] ?? 0);
                if (in_array($domResult['status'] ?? '', [self::STATE_ERROR, 'FAILED'], true)) {
                    $overallSuccess = false;
                }
            } catch (\Throwable $t) {
                $overallSuccess = false;
                $results[$dom] = [
                    'domain' => $dom,
                    'status' => self::STATE_ERROR,
                    'message' => $t->getMessage(),
                    'records_read' => 0,
                    'records_written' => 0
                ];
            }
        }

        $ordersRes = $results[self::DOMAIN_ORDERS] ?? [];
        $ordersRawStatus = $ordersRes['status'] ?? 'UNKNOWN';
        $ordersStatus = self::normalizeDomainStatus($ordersRawStatus);

        $isOrdersDisabled = ($ordersStatus === 'DISABLED');
        $isOrdersError = in_array($ordersStatus, [self::STATE_ERROR, 'FAILED'], true);
        $isOrdersPartial = in_array($ordersStatus, [self::STATE_PARTIAL, 'INTERRUPTED'], true);
        $isOrdersSuccess = in_array($ordersStatus, ['COMPLETED', 'COMPLETE', self::STATE_AVAILABLE, 'SUCCESS'], true);

        // Orders is mandatory: if Orders is not successful, overallSuccess is false
        if (!$isOrdersSuccess) {
            $overallSuccess = false;
        }

        $disabledOptional = [];
        $errorOptional = [];
        foreach ($results as $dKey => $dRes) {
            if ($dKey === self::DOMAIN_ORDERS) continue;
            $st = self::normalizeDomainStatus($dRes['status'] ?? '');
            if ($st === 'DISABLED') {
                $disabledOptional[] = $dKey;
            } elseif (in_array($st, [self::STATE_ERROR, 'FAILED'], true)) {
                $errorOptional[] = $dKey;
            }
        }

        // True global success ONLY when Orders succeeded AND no optional domain had errors or was disabled
        $isGlobalAllComplete = ($isOrdersSuccess && empty($disabledOptional) && empty($errorOptional));

        $elapsed = round(microtime(true) - $startTime, 2);

        return [
            'success' => $overallSuccess,
            'orders_status' => $ordersStatus,
            'is_global_all_complete' => $isGlobalAllComplete,
            'disabled_optional_domains' => $disabledOptional,
            'shop_id' => $shopId,
            'mode' => $mode,
            'domains' => $results,
            'total_records_written' => $totalRecordsWritten,
            'elapsed_seconds' => $elapsed,
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Scheduled / Background automated incremental sync entry point.
     * Safe to invoke via Cron or CLI runner.
     *
     * @param string $shopId
     * @return array
     */
    public function runScheduledIncrementalSync(string $shopId): array {
        return $this->syncAll($shopId, null, null, self::MODE_INCREMENTAL);
    }

    /**
     * Returns comprehensive multi-domain synchronization health and data availability.
     *
     * @param string $shopId
     * @return array
     */
    public function getSyncHealth(string $shopId): array {
        $domains = [
            self::DOMAIN_ORDERS => [
                'name' => 'ORDERS',
                'label' => 'Đơn hàng (TikTok Shop)',
                'table' => 'commerce_orders',
                'date_col' => 'platform_created_at',
                'update_col' => 'platform_updated_at',
                'feature_flag' => 'FEATURE_ENABLE_COMMERCE_V2'
            ],
            self::DOMAIN_RMA => [
                'name' => 'RMA',
                'label' => 'Hao hụt & Đổi trả (RMA)',
                'table' => 'commerce_aftersales',
                'date_col' => 'platform_created_at',
                'update_col' => 'platform_updated_at',
                'feature_flag' => 'FEATURE_ENABLE_AFTERSALES_V2'
            ],
            self::DOMAIN_LOSS => [
                'name' => 'LOSS',
                'label' => 'Hao hụt & Đối soát (Loss Ledger)',
                'table' => 'commerce_loss_ledger',
                'date_col' => 'effective_at',
                'update_col' => 'created_at',
                'feature_flag' => 'FEATURE_ENABLE_AFTERSALES_V2'
            ],
            self::DOMAIN_ADS_CAMPAIGN => [
                'name' => 'ADS_CAMPAIGN',
                'label' => 'Quảng cáo Chiến dịch GMV Max',
                'table' => 'commerce_ads_campaign_daily',
                'date_col' => 'stat_date',
                'update_col' => 'updated_at',
                'feature_flag' => 'FEATURE_ENABLE_COMMERCE_V2'
            ],
            self::DOMAIN_FINANCE => [
                'name' => 'FINANCE',
                'label' => 'Tài chính & Settlement',
                'table' => 'commerce_finance_statements',
                'date_col' => 'statement_time',
                'update_col' => 'created_at',
                'feature_flag' => 'FEATURE_ENABLE_FINANCE_V2'
            ],
            self::DOMAIN_ANALYTICS => [
                'name' => 'ANALYTICS',
                'label' => 'Chỉ số Shop Daily (Compass)',
                'table' => 'commerce_shop_analytics_daily',
                'date_col' => 'stat_date',
                'update_col' => 'created_at',
                'feature_flag' => 'FEATURE_ENABLE_ANALYTICS_V2'
            ]
        ];

        $today = date('Y-m-d');
        $healthList = [];

        foreach ($domains as $domainKey => $meta) {
            $isFeatureEnabled = defined($meta['feature_flag']) ? constant($meta['feature_flag']) : true;

            // 1. Get latest sync run from commerce_sync_runs
            $latestRun = null;
            try {
                $hasSourceDomain = $this->hasColumn('commerce_sync_runs', 'source_domain');
                if ($hasSourceDomain) {
                    $stmtRun = $this->db->prepare("SELECT * FROM `commerce_sync_runs` 
                        WHERE platform = :plat AND shop_id = :shop_id 
                          AND (source_domain = :dom OR source_domain = :dom_alt)
                        ORDER BY id DESC LIMIT 1");
                    $altDom = ($domainKey === self::DOMAIN_RMA) ? 'return_refund' : $domainKey;
                    $stmtRun->execute([
                        ':plat' => self::PLATFORM,
                        ':shop_id' => $shopId,
                        ':dom' => $domainKey,
                        ':dom_alt' => $altDom
                    ]);
                } else {
                    $stmtRun = $this->db->prepare("SELECT * FROM `commerce_sync_runs` 
                        WHERE platform = :plat AND shop_id = :shop_id ORDER BY id DESC LIMIT 1");
                    $stmtRun->execute([':plat' => self::PLATFORM, ':shop_id' => $shopId]);
                }
                $latestRun = $stmtRun->fetch(PDO::FETCH_ASSOC) ?: null;
            } catch (\Throwable $t) {}

            // 2. Query table fact metrics (latest fact date, total record count)
            $latestDataDate = null;
            $recordsCount = 0;
            try {
                if ($this->hasTable($meta['table'])) {
                    $stmtCount = $this->db->prepare("SELECT COUNT(*), MAX({$meta['date_col']}) FROM `{$meta['table']}` WHERE shop_id = ?");
                    $stmtCount->execute([$shopId]);
                    $row = $stmtCount->fetch(PDO::FETCH_NUM);
                    $recordsCount = (int)($row[0] ?? 0);
                    if (!empty($row[1])) {
                        $latestDataDate = substr((string)$row[1], 0, 10);
                    }
                }
            } catch (\Throwable $t) {}

            // 3. Determine status and latest_available_date
            $latestAvailDate = $latestRun['latest_available_date'] ?? null;
            if (!$latestAvailDate) {
                // Infer safe platform publishing latency
                if ($domainKey === self::DOMAIN_ANALYTICS) {
                    $latestAvailDate = date('Y-m-d', strtotime('-1 day'));
                } else {
                    $latestAvailDate = $today;
                }
            }

            $status = self::STATE_NOT_AVAILABLE;
            if (!$isFeatureEnabled) {
                $status = 'DISABLED';
            } elseif ($latestRun) {
                if ($latestRun['status'] === 'COMPLETED') {
                    $status = self::STATE_AVAILABLE;
                    if ($latestDataDate && $latestAvailDate && $latestDataDate < $latestAvailDate) {
                        $status = self::STATE_PARTIAL;
                    }
                } elseif ($latestRun['status'] === 'FAILED') {
                    $status = self::STATE_ERROR;
                } elseif ($latestRun['status'] === 'RUNNING' || $latestRun['status'] === 'PENDING') {
                    $status = 'SYNCING';
                } elseif ($latestRun['status'] === 'SKIPPED_NOT_AVAILABLE') {
                    $status = self::STATE_NOT_YET_AVAILABLE;
                } else {
                    $status = $latestRun['status'];
                }
            } elseif ($recordsCount > 0) {
                $status = self::STATE_AVAILABLE;
            }

            $healthList[$domainKey] = [
                'domain' => $domainKey,
                'name' => $meta['name'],
                'label' => $meta['label'],
                'feature_enabled' => $isFeatureEnabled,
                'status' => $status,
                'last_successful_sync' => ($latestRun && $latestRun['status'] === 'COMPLETED') ? $latestRun['completed_at'] : null,
                'latest_sync_attempt' => $latestRun['completed_at'] ?? $latestRun['started_at'] ?? null,
                'latest_data_date' => $latestDataDate,
                'latest_available_date' => $latestAvailDate,
                'records_count' => $recordsCount,
                'last_records_read' => (int)($latestRun['records_read'] ?? $latestRun['orders_ingested'] ?? 0),
                'last_records_written' => (int)($latestRun['records_written'] ?? $latestRun['orders_updated'] ?? 0),
                'last_error' => $latestRun['error_message'] ?? null,
                'run_id' => $latestRun['id'] ?? null
            ];
        }

        // V2-04.1: Cross-domain integrity check for orphan RMAs & loss coverage
        $orphanRmaCount = 0;
        try {
            $stmtOrphan = $this->db->prepare("SELECT COUNT(DISTINCT a.platform_order_id)
                FROM `commerce_aftersales` a
                LEFT JOIN `commerce_orders` o ON a.platform = o.platform AND a.shop_id = o.shop_id AND a.platform_order_id = o.platform_order_id
                WHERE a.platform = :plat AND a.shop_id = :shop_id
                  AND a.aftersales_status = 'SUCCESS'
                  AND o.id IS NULL");
            $stmtOrphan->execute([':plat' => self::PLATFORM, ':shop_id' => $shopId]);
            $orphanRmaCount = (int)$stmtOrphan->fetchColumn();
        } catch (\Throwable $t) {}

        if ($orphanRmaCount > 0) {
            // Mark RMA/Loss domain coverage PARTIAL or UNKNOWN, never COMPLETE/AVAILABLE!
            if (isset($healthList[self::DOMAIN_RMA])) {
                $healthList[self::DOMAIN_RMA]['status'] = self::STATE_PARTIAL;
                $healthList[self::DOMAIN_RMA]['orphan_count'] = $orphanRmaCount;
                $healthList[self::DOMAIN_RMA]['last_error'] = "Tồn tại {$orphanRmaCount} đơn đổi trả (RMA) thiếu thông tin đơn hàng gốc.";
            }
            if (isset($healthList[self::DOMAIN_LOSS])) {
                $healthList[self::DOMAIN_LOSS]['status'] = self::STATE_PARTIAL;
                $healthList[self::DOMAIN_LOSS]['orphan_count'] = $orphanRmaCount;
                $healthList[self::DOMAIN_LOSS]['last_error'] = "Tồn tại {$orphanRmaCount} đơn đổi trả (RMA) thiếu thông tin đơn hàng gốc chưa đối soát được.";
            }
        } else {
            // Do not infer Loss completeness solely from existence of commerce_loss_ledger rows
            if (isset($healthList[self::DOMAIN_LOSS])) {
                $ordersHealth = $healthList[self::DOMAIN_ORDERS]['status'] ?? '';
                $rmaHealth = $healthList[self::DOMAIN_RMA]['status'] ?? '';
                if ($ordersHealth !== self::STATE_AVAILABLE || $rmaHealth !== self::STATE_AVAILABLE) {
                    $healthList[self::DOMAIN_LOSS]['status'] = self::STATE_PARTIAL;
                }
            }
        }

        return [
            'shop_id' => $shopId,
            'domains' => $healthList,
            'summary_status' => $this->computeSummaryHealth($healthList),
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    // ====================================================================
    // DOMAIN INGESTION RUNNERS
    // ====================================================================

    /**
     * Orders Domain: Coverage window sync + HOT rolling mutation refresh for mutable lifecycles.
     */
    private function syncOrdersDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        if (defined('FEATURE_ENABLE_COMMERCE_V2') && !FEATURE_ENABLE_COMMERCE_V2) {
            return [
                'domain' => self::DOMAIN_ORDERS,
                'status' => 'DISABLED',
                'message' => 'FEATURE_ENABLE_COMMERCE_V2 is disabled',
                'records_read' => 0,
                'records_written' => 0
            ];
        }

        $syncService = $this->syncService ?? new CommerceSyncService($this->db);

        // 1. Resolve actual sync window
        if ($startDate) {
            $runStartDate = $startDate;
            $runEndDate = $endDate;
            $syncStart = strtotime($runStartDate . ' 00:00:00');
            $syncEnd = strtotime($runEndDate . ' +1 day 00:00:00');
        } else {
            // Coverage watermark: find last complete created-time window
            $lastCompletedEnd = null;
            try {
                $stmtWatermark = $this->db->prepare("SELECT MAX(end_date) FROM `commerce_sync_runs` 
                    WHERE platform = :p AND shop_id = :s 
                      AND (source_domain = 'order' OR source_domain = 'orders' OR source_domain IS NULL)
                      AND status = 'COMPLETED' 
                      AND sync_type != 'MUTATION_REFRESH'
                      AND end_date IS NOT NULL");
                $stmtWatermark->execute([':p' => self::PLATFORM, ':s' => $shopId]);
                $lastCompletedEnd = $stmtWatermark->fetchColumn();
            } catch (\Throwable $t) {}

            if (!empty($lastCompletedEnd)) {
                $runStartDate = date('Y-m-d', strtotime($lastCompletedEnd . ' -1 day'));
            } else {
                $runStartDate = date('Y-m-d', strtotime('-30 days'));
            }
            $runEndDate = $endDate;
            $syncStart = strtotime($runStartDate . ' 00:00:00');
            $syncEnd = strtotime($runEndDate . ' +1 day 00:00:00');
        }

        try {
            // 2. Execute authoritative coverage window sync
            $maxPages = $options['max_pages'] ?? ($this->config['max_pages'] ?? 200);
            $resumeToken = $options['resume_token'] ?? null;
            $res = $syncService->syncOrdersWindow(
                $shopId,
                $syncStart,
                $syncEnd,
                100,
                $maxPages,
                $resumeToken,
                'COVERAGE_WINDOW',
                'create_time'
            );

            $runId = (int)($res['sync_run_id'] ?? 0);
            $read = (int)($res['records_read'] ?? $res['orders_ingested'] ?? 0);
            $written = (int)($res['records_written'] ?? $res['orders_ingested'] ?? 0);
            $rawStatus = $res['status'] ?? 'COMPLETED';

            $orderStatus = match ($rawStatus) {
                'COMPLETED' => self::STATE_AVAILABLE,
                'PARTIAL', 'INTERRUPTED' => self::STATE_PARTIAL,
                default => self::STATE_ERROR,
            };

            // 3. Immediately reconcile any orphan RMAs that now have order records
            try {
                require_once __DIR__ . '/commerce_loss_engine.php';
                $lossEngine = new CommerceLossEngine($this->db);
                $stmtCheckOrphans = $this->db->prepare("SELECT DISTINCT a.platform_order_id 
                    FROM `commerce_aftersales` a
                    INNER JOIN `commerce_orders` o ON a.platform = o.platform AND a.shop_id = o.shop_id AND a.platform_order_id = o.platform_order_id
                    LEFT JOIN `commerce_loss_ledger` l ON a.platform = l.platform AND a.shop_id = l.shop_id AND a.platform_order_id = l.platform_order_id
                    WHERE a.platform = :plat AND a.shop_id = :shop_id
                      AND a.aftersales_status = 'SUCCESS'
                      AND l.id IS NULL");
                $stmtCheckOrphans->execute([':plat' => self::PLATFORM, ':shop_id' => $shopId]);
                $recomputeIds = $stmtCheckOrphans->fetchAll(PDO::FETCH_COLUMN) ?: [];
                foreach ($recomputeIds as $recId) {
                    $lossEngine->computeAndPersistLossLedger($shopId, $recId, 'MATURED_LIFECYCLE');
                }
            } catch (\Throwable $t) {}

            // 3b. Non-fatal Customer 360 Ingestion & Profile Materialization (Sprint V2-05)
            // F11 fix: Skip heavy synchronous backfill in micro-batch or coverage-only ticks
            if (empty($options['coverage_only']) && empty($options['micro_batch'])) {
                try {
                    require_once __DIR__ . '/commerce_customer_service.php';
                    $customerService = new CommerceCustomerService($this->db);
                    $customerService->backfillCustomerProfilesFromDb($shopId, $runStartDate, $runEndDate);
                } catch (\Throwable $custEx) {
                    // Non-fatal safety guard: Customer ingestion errors must NEVER fail Orders sync
                }
            }

            // 4. Mutation refresh: periodically re-fetch recent orders so status changes are captured
            // F11 fix: NEVER execute synchronous 50-page mutation refresh inside coverage_only or micro-batch ticks
            if (!empty($options['rolling_refresh']) && empty($options['coverage_only'])) {
                try {
                    $hotDays = $this->config['hot_window_days'] ?? 3;
                    $mutationStart = time() - ($hotDays * 86400);
                    $mutationEnd = time();
                    $maxPages = !empty($options['max_pages']) ? (int)$options['max_pages'] : 20;
                    $syncService->syncOrdersWindow(
                        $shopId,
                        $mutationStart,
                        $mutationEnd,
                        100,
                        $maxPages,
                        null,
                        'MUTATION_REFRESH',
                        'update_time'
                    );
                } catch (\Throwable $t) {}
            }

            return [
                'domain' => self::DOMAIN_ORDERS,
                'status' => $orderStatus,
                'run_id' => $runId,
                'start_date' => $runStartDate,
                'end_date' => $runEndDate,
                'records_read' => $read,
                'records_written' => $written,
                'latest_available_date' => ($orderStatus === self::STATE_AVAILABLE ? $runEndDate : null),
                'resume_token' => $res['last_resume_token'] ?? null,
                'pages_processed' => $res['pages_processed'] ?? 0,
                'message' => $res['error_message'] ?? null
            ];
        } catch (\Throwable $t) {
            return [
                'domain' => self::DOMAIN_ORDERS,
                'status' => self::STATE_ERROR,
                'run_id' => 0,
                'start_date' => $runStartDate,
                'end_date' => $runEndDate,
                'message' => $t->getMessage(),
                'records_read' => 0,
                'records_written' => 0
            ];
        }
    }

    /**
     * RMA / Returns / Refunds Domain.
     * V2-05.2.3: Strictly separates explicit historical period backfill (create_time range)
     * from rolling incremental refresh (update_time watermark).
     */
    private function syncRmaDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        if (defined('FEATURE_ENABLE_AFTERSALES_V2') && !FEATURE_ENABLE_AFTERSALES_V2) {
            return ['domain' => self::DOMAIN_RMA, 'status' => 'DISABLED', 'message' => 'FEATURE_ENABLE_AFTERSALES_V2 is disabled'];
        }

        $aftersales = new CommerceAftersalesService($this->db, $this->client);
        $endpoint = defined('TIKTOK_API_RMA_SEARCH_ENDPOINT') ? TIKTOK_API_RMA_SEARCH_ENDPOINT : '/return_refund/202602/returns/search';

        // V2-05.2.3: Distinction between Historical Period Backfill and Incremental/Rolling Sync
        $isHistoricalPeriod = (!empty($startDate) && empty($options['rolling_refresh']) && empty($options['incremental']));

        if ($isHistoricalPeriod) {
            // Mode A: HISTORICAL / REQUESTED PERIOD SYNC
            $runStartDate = $startDate;
            $runEndDate = $endDate;
            $bounds = CommerceAftersalesService::resolvePeriodTimestamps($runStartDate, $runEndDate);
            $syncStart = $bounds['start_timestamp'];
            $syncEnd = $bounds['end_exclusive_timestamp'];

            $runId = $this->recordSyncRunStart(
                $shopId,
                self::DOMAIN_RMA,
                'HISTORICAL_BACKFILL',
                $runStartDate,
                $runEndDate,
                $endpoint,
                $bounds['start_datetime'],
                $bounds['end_exclusive_datetime']
            );

            try {
                $maxPages = $options['max_pages'] ?? ($this->config['max_pages'] ?? 100);
                $resumeToken = $options['resume_token'] ?? null;
                $rmaResult = $aftersales->initialBackfillRma(
                    $shopId,
                    $syncStart,
                    $syncEnd,
                    50,
                    $maxPages,
                    $resumeToken,
                    $runId,
                    'HISTORICAL_BACKFILL'
                );

                $written = (int)($rmaResult['records_written'] ?? $rmaResult['rmas_ingested'] ?? 0);
                $read = (int)($rmaResult['records_read'] ?? $rmaResult['rmas_read'] ?? $written);
                $resStatus = $rmaResult['status'] ?? 'COMPLETED';
                $errorCode = $rmaResult['error_code'] ?? null;
                $errorMessage = $rmaResult['error_message'] ?? null;
                $unresolved = $rmaResult['unresolved_order_dependencies'] ?? [];

                if ($resStatus === 'FAILED') {
                    $this->recordSyncRunEnd($runId, 'FAILED', $read, $written, null, $errorCode ?? 'RMA_PERIOD_MISMATCH', $errorMessage);
                    return [
                        'domain' => self::DOMAIN_RMA,
                        'status' => self::STATE_ERROR,
                        'run_id' => $runId,
                        'start_date' => $runStartDate,
                        'end_date' => $runEndDate,
                        'records_read' => $read,
                        'records_written' => $written,
                        'error_code' => $errorCode ?? 'RMA_PERIOD_MISMATCH',
                        'message' => $errorMessage
                    ];
                }

                if ($resStatus === 'PARTIAL' || !empty($unresolved)) {
                    $this->recordSyncRunEnd($runId, 'PARTIAL', $read, $written, null, $errorCode ?? 'RMA_DEPENDENCY_MISSING', $errorMessage);
                    return [
                        'domain' => self::DOMAIN_RMA,
                        'status' => self::STATE_PARTIAL,
                        'run_id' => $runId,
                        'start_date' => $runStartDate,
                        'end_date' => $runEndDate,
                        'records_read' => $read,
                        'records_written' => $written,
                        'unresolved_order_dependencies' => $unresolved,
                        'resume_token' => $rmaResult['last_resume_token'] ?? null,
                        'error_code' => $errorCode,
                        'message' => $errorMessage
                    ];
                }

                // Upon full completion, latest available verified data date is the end of the historical period
                $latestAvailableDate = $runEndDate;
                $this->recordSyncRunEnd($runId, 'COMPLETED', $read, $written, $latestAvailableDate, null, null);

                return [
                    'domain' => self::DOMAIN_RMA,
                    'status' => self::STATE_AVAILABLE,
                    'run_id' => $runId,
                    'start_date' => $runStartDate,
                    'end_date' => $runEndDate,
                    'records_read' => $read,
                    'records_written' => $written,
                    'resume_token' => $rmaResult['last_resume_token'] ?? null,
                    'latest_available_date' => $latestAvailableDate
                ];
            } catch (\Throwable $t) {
                $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'RMA_SYNC_ERROR', $t->getMessage());
                return [
                    'domain' => self::DOMAIN_RMA,
                    'status' => self::STATE_ERROR,
                    'run_id' => $runId,
                    'message' => $t->getMessage(),
                    'records_read' => 0,
                    'records_written' => 0
                ];
            }
        } else {
            // Mode B: INCREMENTAL / ROLLING SYNC
            $hotDays = $this->config['hot_window_days'] ?? 14;
            $runStartDate = $startDate ?: date('Y-m-d', strtotime("-{$hotDays} days"));
            $runEndDate = $endDate;

            $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_RMA, 'INCREMENTAL_DELTA', $runStartDate, $runEndDate, $endpoint);

            try {
                $rmaResult = $aftersales->incrementalSyncRma($shopId, $hotDays * 86400, 50, $this->config['max_pages'] ?? 100, $runId);
                $written = (int)($rmaResult['records_written'] ?? $rmaResult['rmas_ingested'] ?? 0);
                $read = (int)($rmaResult['records_read'] ?? $rmaResult['rmas_read'] ?? $written);
                $resStatus = $rmaResult['status'] ?? 'COMPLETED';
                $unresolved = $rmaResult['unresolved_order_dependencies'] ?? [];
                $unresolvedCount = count($unresolved);

                if ($resStatus === 'FAILED') {
                    $this->recordSyncRunEnd($runId, 'FAILED', $read, $written, null, $rmaResult['error_code'] ?? 'RMA_SYNC_ERROR', $rmaResult['error_message'] ?? null);
                    return [
                        'domain' => self::DOMAIN_RMA,
                        'status' => self::STATE_ERROR,
                        'run_id' => $runId,
                        'message' => $rmaResult['error_message'] ?? null,
                        'records_read' => $read,
                        'records_written' => $written
                    ];
                }

                if ($unresolvedCount > 0 || $resStatus === 'PARTIAL') {
                    $errMsg = $rmaResult['error_message'] ?: "Unresolved RMA dependencies: {$unresolvedCount} orders missing";
                    $this->recordSyncRunEnd($runId, 'PARTIAL', $read, $written, date('Y-m-d'), 'RMA_DEPENDENCY_MISSING', $errMsg);

                    return [
                        'domain' => self::DOMAIN_RMA,
                        'status' => self::STATE_PARTIAL,
                        'run_id' => $runId,
                        'start_date' => $runStartDate,
                        'end_date' => $runEndDate,
                        'records_read' => $read,
                        'records_written' => $written,
                        'latest_available_date' => date('Y-m-d'),
                        'unresolved_order_dependencies' => $unresolved,
                        'message' => $errMsg
                    ];
                }

                $this->recordSyncRunEnd($runId, 'COMPLETED', $read, $written, date('Y-m-d'), null, null);

                return [
                    'domain' => self::DOMAIN_RMA,
                    'status' => self::STATE_AVAILABLE,
                    'run_id' => $runId,
                    'start_date' => $runStartDate,
                    'end_date' => $runEndDate,
                    'records_read' => $read,
                    'records_written' => $written,
                    'latest_available_date' => date('Y-m-d')
                ];
            } catch (\Throwable $t) {
                $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'RMA_SYNC_ERROR', $t->getMessage());
                return [
                    'domain' => self::DOMAIN_RMA,
                    'status' => self::STATE_ERROR,
                    'run_id' => $runId,
                    'message' => $t->getMessage(),
                    'records_read' => 0,
                    'records_written' => 0
                ];
            }
        }
    }

    /**
     * Loss / Reconciliation Domain.
     * Recomputes and persists MATURED_LIFECYCLE loss ledger entries.
     * Identifies unresolved orphan RMAs and ensures loss completeness is never fabricated.
     */
    private function syncLossDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        if (defined('FEATURE_ENABLE_AFTERSALES_V2') && !FEATURE_ENABLE_AFTERSALES_V2) {
            return ['domain' => self::DOMAIN_LOSS, 'status' => 'DISABLED', 'message' => 'FEATURE_ENABLE_AFTERSALES_V2 is disabled'];
        }

        $hotDays = $this->config['hot_window_days'];
        $runStartDate = $startDate ?: date('Y-m-d', strtotime("-{$hotDays} days"));
        $runEndDate = $endDate;

        $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_LOSS, 'RECONCILIATION', $runStartDate, $runEndDate, 'internal://commerce_loss_engine');

        try {
            require_once __DIR__ . '/commerce_loss_engine.php';
            $lossEngine = new CommerceLossEngine($this->db);

            // 1. Detect any orphan RMAs
            $stmtOrphans = $this->db->prepare("SELECT DISTINCT a.platform_order_id 
                FROM `commerce_aftersales` a
                LEFT JOIN `commerce_orders` o ON a.platform = o.platform AND a.shop_id = o.shop_id AND a.platform_order_id = o.platform_order_id
                WHERE a.platform = :plat AND a.shop_id = :shop_id
                  AND a.aftersales_status = 'SUCCESS'
                  AND o.id IS NULL");
            $stmtOrphans->execute([':plat' => self::PLATFORM, ':shop_id' => $shopId]);
            $missingOrderIds = $stmtOrphans->fetchAll(PDO::FETCH_COLUMN) ?: [];

            $recoveredCount = 0;
            $unresolvedIds = $missingOrderIds;

            // 2. Safe bounded recovery of missing orders (max 50)
            if (!empty($missingOrderIds)) {
                $syncService = new CommerceSyncService($this->db);
                $recoveryRes = $syncService->syncOrdersByIds($shopId, array_slice($missingOrderIds, 0, 50));
                $recoveredIds = $recoveryRes['recovered_order_ids'] ?? [];
                $unresolvedIds = $recoveryRes['unresolved_order_ids'] ?? [];
                $recoveredCount = count($recoveredIds);

                foreach ($recoveredIds as $recOrderId) {
                    $lossEngine->computeAndPersistLossLedger($shopId, $recOrderId, 'MATURED_LIFECYCLE');
                }
            }

            // 3. Recompute loss ledger for orders with cancellations or aftersales in the period
            $startDt = $runStartDate . ' 00:00:00';
            $endDt = $runEndDate . ' 23:59:59';
            $stmtOrdersToRecompute = $this->db->prepare("SELECT DISTINCT o.platform_order_id
                FROM `commerce_orders` o
                LEFT JOIN `commerce_aftersales` a ON o.platform = a.platform AND o.shop_id = a.shop_id AND o.platform_order_id = a.platform_order_id
                WHERE o.platform = :plat AND o.shop_id = :shop_id
                  AND o.platform_created_at >= :sdt AND o.platform_created_at <= :edt
                  AND (o.order_status = 'CANCELLED' OR a.id IS NOT NULL)");
            $stmtOrdersToRecompute->execute([
                ':plat' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':sdt' => $startDt,
                ':edt' => $endDt
            ]);
            $ordersToRecompute = $stmtOrdersToRecompute->fetchAll(PDO::FETCH_COLUMN) ?: [];

            $recordsWritten = 0;
            foreach ($ordersToRecompute as $ordId) {
                $res = $lossEngine->computeAndPersistLossLedger($shopId, $ordId, 'MATURED_LIFECYCLE');
                $recordsWritten += count($res['loss_entries'] ?? []);
            }

            $hasUnresolved = count($unresolvedIds) > 0;
            $status = $hasUnresolved ? self::STATE_PARTIAL : self::STATE_AVAILABLE;
            $errMsg = $hasUnresolved 
                ? "Tồn tại " . count($unresolvedIds) . " đơn hàng thiếu trong đối soát hao hụt: " . implode(', ', array_slice($unresolvedIds, 0, 5))
                : null;

            $this->recordSyncRunEnd($runId, $hasUnresolved ? 'PARTIAL' : 'COMPLETED', count($ordersToRecompute), $recordsWritten, date('Y-m-d'), null, $errMsg);

            return [
                'domain' => self::DOMAIN_LOSS,
                'status' => $status,
                'run_id' => $runId,
                'start_date' => $runStartDate,
                'end_date' => $runEndDate,
                'records_read' => count($ordersToRecompute),
                'records_written' => $recordsWritten,
                'recovered_orders' => $recoveredCount,
                'unresolved_order_ids' => $unresolvedIds,
                'message' => $errMsg ?: 'Đã đối soát sổ cái hao hụt thành công',
                'latest_available_date' => date('Y-m-d')
            ];
        } catch (\Throwable $t) {
            $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'LOSS_SYNC_ERROR', $t->getMessage());
            return [
                'domain' => self::DOMAIN_LOSS,
                'status' => self::STATE_ERROR,
                'run_id' => $runId,
                'message' => $t->getMessage(),
                'records_read' => 0,
                'records_written' => 0
            ];
        }
    }

    /**
     * Advertising Campaign GMV Max Domain:
     * Incremental sweep starting past DB MAX(stat_date) up to safe available date.
     * Never creates synthetic zeroes if date not yet published.
     */
    private function syncAdsCampaignDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        $adsService = new CommerceAdsIngestionService($this->db);

        // 1. Determine latest synced date in DB
        $dbMaxDate = null;
        try {
            $stmt = $this->db->prepare("SELECT MAX(stat_date) FROM `commerce_ads_campaign_daily` WHERE (shop_id = ? OR shop_id = '' OR shop_id IS NULL)");
            $stmt->execute([$shopId]);
            $dbMaxDate = $stmt->fetchColumn() ?: null;
        } catch (\Throwable $t) {}

        $today = date('Y-m-d');
        $safeAvailableDate = $today; // TikTok Marketing API v1.3 provides real-time/intraday data for T-0 (today)
        $reqStart = $startDate ?: ($dbMaxDate ? min($dbMaxDate, $safeAvailableDate) : '2026-09-01');
        $reqEnd = min($endDate, $safeAvailableDate);

        // Check if requested window is strictly in unpublished future
        if ($reqStart > $safeAvailableDate) {
            $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_ADS_CAMPAIGN, 'INCREMENTAL_DELTA', $reqStart, $endDate, '/open_api/v1.3/report/integrated/get/');
            $msg = "Dữ liệu quảng cáo từ {$reqStart} chưa diễn ra (trong tương lai).";
            $this->recordSyncRunEnd($runId, 'SKIPPED_NOT_AVAILABLE', 0, 0, $safeAvailableDate, 'LATENCY_PENDING', $msg);

            return [
                'domain' => self::DOMAIN_ADS_CAMPAIGN,
                'status' => self::STATE_NOT_YET_AVAILABLE,
                'run_id' => $runId,
                'latest_available_date' => $safeAvailableDate,
                'message' => $msg,
                'records_read' => 0,
                'records_written' => 0
            ];
        }

        if ($reqStart > $reqEnd) {
            // Already completely synchronized up to safe date!
            return [
                'domain' => self::DOMAIN_ADS_CAMPAIGN,
                'status' => self::STATE_AVAILABLE,
                'latest_available_date' => $safeAvailableDate,
                'message' => "Dữ liệu quảng cáo đã đồng bộ đầy đủ đến {$dbMaxDate}.",
                'records_read' => 0,
                'records_written' => 0
            ];
        }

        $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_ADS_CAMPAIGN, 'INCREMENTAL_DELTA', $reqStart, $reqEnd, '/open_api/v1.3/report/integrated/get/');

        try {
            // Ingest official API range with legacy fallback enabled if API returns empty
            $ingestRes = $adsService->syncCampaignDailyRange($shopId, $reqStart, $reqEnd, true, $options);
            $written = (int)($ingestRes['records_ingested'] ?? 0);
            $rawStatus = strtoupper((string)($ingestRes['status'] ?? ''));
            $apiSuccess = !empty($ingestRes['api_success']);
            $apiError = $ingestRes['api_error'] ?? null;

            if (in_array($rawStatus, ['AVAILABLE', 'SUCCESS', 'COMPLETED'], true) || ($written > 0 && empty($apiError)) || ($apiSuccess && empty($apiError))) {
                $statusStr = 'COMPLETED';
            } elseif ($rawStatus === 'PARTIAL' || ($written > 0 && !empty($apiError))) {
                $statusStr = 'PARTIAL';
            } else {
                $statusStr = ($written > 0) ? 'COMPLETED' : 'FAILED';
            }

            $err = $apiError ?: ($ingestRes['message'] ?? null);
            $errCode = ($statusStr === 'FAILED') ? 'ADS_SYNC_ERROR' : null;

            $this->recordSyncRunEnd($runId, $statusStr, $written, $written, $reqEnd, $errCode, $err);

            $domainStatus = match ($statusStr) {
                'COMPLETED' => self::STATE_AVAILABLE,
                'PARTIAL' => self::STATE_PARTIAL,
                default => self::STATE_ERROR,
            };
            if ($endDate > $reqEnd && $domainStatus === self::STATE_AVAILABLE) {
                // Requested past safe available date
                $domainStatus = self::STATE_PARTIAL;
            }

            return [
                'domain' => self::DOMAIN_ADS_CAMPAIGN,
                'status' => $domainStatus,
                'run_id' => $runId,
                'start_date' => $reqStart,
                'end_date' => $reqEnd,
                'latest_available_date' => $reqEnd,
                'records_read' => $written,
                'records_written' => $written,
                'message' => $ingestRes['message'] ?? 'Thành công'
            ];
        } catch (\Throwable $t) {
            $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'ADS_SYNC_ERROR', $t->getMessage());
            return [
                'domain' => self::DOMAIN_ADS_CAMPAIGN,
                'status' => self::STATE_ERROR,
                'run_id' => $runId,
                'message' => $t->getMessage(),
                'records_read' => 0,
                'records_written' => 0
            ];
        }
    }

    /**
     * Finance Domain: Checkpointed bounded batch statements.
     */
    private function syncFinanceDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        if (defined('FEATURE_ENABLE_FINANCE_V2') && !FEATURE_ENABLE_FINANCE_V2) {
            return ['domain' => self::DOMAIN_FINANCE, 'status' => 'DISABLED', 'message' => 'FEATURE_ENABLE_FINANCE_V2 is disabled'];
        }

        $financeService = new CommerceFinanceService($this->db);
        $runStartDate = $startDate ?: date('Y-m-d', strtotime('-30 days'));
        $runEndDate = $endDate;

        $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_FINANCE, 'BOUNDED_BATCH', $runStartDate, $runEndDate, '/finance/202309/statements/search');

        try {
            $stmtRes = $financeService->syncStatements($shopId, strtotime($runStartDate), strtotime($runEndDate));
            $this->recordSyncRunEnd($runId, 'COMPLETED', 0, 0, $runEndDate, null, null);

            return [
                'domain' => self::DOMAIN_FINANCE,
                'status' => self::STATE_AVAILABLE,
                'run_id' => $runId,
                'start_date' => $runStartDate,
                'end_date' => $runEndDate,
                'latest_available_date' => $runEndDate
            ];
        } catch (\Throwable $t) {
            $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'FINANCE_SYNC_ERROR', $t->getMessage());
            return [
                'domain' => self::DOMAIN_FINANCE,
                'status' => self::STATE_ERROR,
                'run_id' => $runId,
                'message' => $t->getMessage()
            ];
        }
    }

    /**
     * Analytics Domain (Compass overview & shop daily metrics).
     * Guards against fabricating synthetic zeroes for unpublished date windows.
     */
    private function syncAnalyticsDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        if (defined('FEATURE_ENABLE_ANALYTICS_V2') && !FEATURE_ENABLE_ANALYTICS_V2) {
            return ['domain' => self::DOMAIN_ANALYTICS, 'status' => 'DISABLED', 'message' => 'FEATURE_ENABLE_ANALYTICS_V2 is disabled'];
        }

        $analyticsService = new CommerceAnalyticsService($this->db);
        $runStartDate = $startDate ?: date('Y-m-d', strtotime('-14 days'));
        $runEndDate = $endDate;

        $freshness = CommerceAnalyticsService::evaluateAnalyticsFreshness($runStartDate, $runEndDate);
        $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_ANALYTICS, 'DAILY_COMPASS', $runStartDate, $runEndDate, '/analytics/202309/shop/performance');

        if ($freshness['status'] === 'NOT_YET_AVAILABLE') {
            $msg = $freshness['message'] ?? 'Dữ liệu phân tích chưa được TikTok Compass công bố';
            $this->recordSyncRunEnd($runId, 'SKIPPED_NOT_AVAILABLE', 0, 0, CommerceAnalyticsService::LATEST_ANALYTICS_AVAILABLE_DATE, 'LATENCY_PENDING', $msg);

            return [
                'domain' => self::DOMAIN_ANALYTICS,
                'status' => self::STATE_NOT_YET_AVAILABLE,
                'run_id' => $runId,
                'latest_available_date' => CommerceAnalyticsService::LATEST_ANALYTICS_AVAILABLE_DATE,
                'message' => $msg,
                'records_read' => 0,
                'records_written' => 0
            ];
        }

        try {
            $analyticsRunId = $analyticsService->syncShopDailyAnalytics($shopId, $runStartDate, $runEndDate);
            $videoRes = $analyticsService->syncShopVideosAnalytics($shopId, $runStartDate, $runEndDate, $options);
            $latestAvail = CommerceAnalyticsService::getLatestAnalyticsAvailableDate();
            $this->recordSyncRunEnd($runId, 'COMPLETED', 0, 0, min($runEndDate, $latestAvail), null, null);

            return [
                'domain' => self::DOMAIN_ANALYTICS,
                'status' => self::STATE_AVAILABLE,
                'run_id' => $runId,
                'start_date' => $runStartDate,
                'end_date' => $runEndDate,
                'video_sync' => $videoRes,
                'latest_available_date' => min($runEndDate, $latestAvail)
            ];
        } catch (\Throwable $t) {
            $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'ANALYTICS_SYNC_ERROR', $t->getMessage());
            return [
                'domain' => self::DOMAIN_ANALYTICS,
                'status' => self::STATE_ERROR,
                'run_id' => $runId,
                'message' => $t->getMessage()
            ];
        }
    }

    /**
     * Customer 360 Ingestion Domain (Sprint V2-05: Non-fatal, privacy-preserving)
     */
    public function syncCustomerDomain(string $shopId, ?string $startDate = null, ?string $endDate = null, array $options = []): array {
        $today = date('Y-m-d');
        $resolvedStart = $startDate ?: date('Y-m-d', strtotime('-30 days'));
        $resolvedEnd = $endDate ?: $today;

        try {
            require_once __DIR__ . '/commerce_customer_service.php';
            $customerService = new CommerceCustomerService($this->db);

            if (!$customerService->isConfigured()) {
                return [
                    'domain' => self::DOMAIN_CUSTOMER,
                    'status' => CommerceCustomerService::STATUS_CONFIGURATION_ERROR,
                    'reason' => $customerService->getConfigReason() ?? CommerceCustomerService::REASON_HMAC_KEY_MISSING,
                    'start_date' => $resolvedStart,
                    'end_date' => $resolvedEnd,
                    'records_read' => 0,
                    'records_written' => 0,
                    'unmatched_orders' => 0,
                    'message' => 'CUSTOMER_IDENTITY_HMAC_KEY chưa được cấu hình hoặc không hợp lệ. Hệ thống áp dụng nguyên tắc fail-closed.'
                ];
            }

            $res = $customerService->backfillCustomerProfilesFromDb($shopId, $resolvedStart, $resolvedEnd);
            $trust = $customerService->getCustomerTrustMetrics($shopId, $resolvedStart, $resolvedEnd);

            return [
                'domain' => self::DOMAIN_CUSTOMER,
                'status' => ($trust['status'] === CommerceCustomerService::STATUS_AVAILABLE) ? self::STATE_AVAILABLE : self::STATE_PARTIAL,
                'start_date' => $resolvedStart,
                'end_date' => $resolvedEnd,
                'records_read' => $res['orders_linked'] ?? 0,
                'records_written' => $res['profiles_created'] ?? 0,
                'unmatched_orders' => $res['unmatched_orders'] ?? 0,
                'message' => 'Đồng bộ hồ sơ khách hàng hoàn tất (Bảo vệ PII).'
            ];
        } catch (\CustomerConfigurationException $cce) {
            return [
                'domain' => self::DOMAIN_CUSTOMER,
                'status' => CommerceCustomerService::STATUS_CONFIGURATION_ERROR,
                'reason' => $cce->getReason(),
                'start_date' => $resolvedStart,
                'end_date' => $resolvedEnd,
                'records_read' => 0,
                'records_written' => 0,
                'unmatched_orders' => 0,
                'message' => 'Lỗi cấu hình bảo mật khách hàng: ' . $cce->getReason()
            ];
        } catch (\Throwable $t) {
            return [
                'domain' => self::DOMAIN_CUSTOMER,
                'status' => self::STATE_PARTIAL,
                'start_date' => $resolvedStart,
                'end_date' => $resolvedEnd,
                'records_read' => 0,
                'records_written' => 0,
                'message' => 'Lỗi đồng bộ hồ sơ khách hàng: ' . $t->getMessage()
            ];
        }
    }

    /**
     * Sprint V2-05.2: Bounded priority recipient capture via orchestrator.
     */
    public function syncPriorityRecipients(string $shopId, array $orderIds = [], int $limit = 50): array {
        require_once __DIR__ . '/commerce_sync_service.php';
        $syncService = new CommerceSyncService($this->db, $this->client);
        return $syncService->syncPriorityRecipients($shopId, $orderIds, $limit);
    }

    /**
     * Authoritative count of remaining priority orders needing unmasked recipient capture.
     */
    public function getRemainingPriorityOrdersCount(string $shopId): int {
        require_once __DIR__ . '/commerce_sync_service.php';
        $syncService = new CommerceSyncService($this->db, $this->client);
        return $syncService->getRemainingPriorityOrdersCount($shopId);
    }

    /**
     * Sprint V2-05.2: Rebuilds customer profiles safely from valid matched identities.
     */
    public function rebuildCustomerProfiles(string $shopId): array {
        require_once __DIR__ . '/commerce_customer_service.php';
        $customerService = new CommerceCustomerService($this->db);
        return $customerService->rebuildCustomerProfiles($shopId);
    }

    /**
     * Future-Ready Domain: ADS_PRODUCT
     */
    private function syncAdsProductDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        $runStartDate = $startDate ?: '2026-09-01';
        $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_ADS_PRODUCT, 'INCREMENTAL_DELTA', $runStartDate, $endDate, '/open_api/v1.3/report/integrated/get/product');
        try {
            $adsService = new CommerceAdsIngestionService($this->db);
            $res = $adsService->syncProductDailyRange($shopId, $runStartDate, $endDate, false);
            $written = (int)($res['records_ingested'] ?? 0);
            $this->recordSyncRunEnd($runId, 'COMPLETED', $written, $written, $endDate, null, null);
            return ['domain' => self::DOMAIN_ADS_PRODUCT, 'status' => self::STATE_AVAILABLE, 'records_written' => $written];
        } catch (\Throwable $t) {
            $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'ADS_PRODUCT_ERROR', $t->getMessage());
            return ['domain' => self::DOMAIN_ADS_PRODUCT, 'status' => self::STATE_ERROR, 'message' => $t->getMessage()];
        }
    }

    /**
     * Future-Ready Domain: ADS_CREATIVE
     */
    private function syncAdsCreativeDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        $runStartDate = $startDate ?: '2026-09-01';
        $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_ADS_CREATIVE, 'INCREMENTAL_DELTA', $runStartDate, $endDate, '/open_api/v1.3/report/integrated/get/creative');
        try {
            $adsService = new CommerceAdsIngestionService($this->db);
            $res = $adsService->syncCreativeDailyRange($shopId, $runStartDate, $endDate, false);
            $written = (int)($res['records_ingested'] ?? 0);
            $this->recordSyncRunEnd($runId, 'COMPLETED', $written, $written, $endDate, null, null);
            return ['domain' => self::DOMAIN_ADS_CREATIVE, 'status' => self::STATE_AVAILABLE, 'records_written' => $written];
        } catch (\Throwable $t) {
            $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'ADS_CREATIVE_ERROR', $t->getMessage());
            return ['domain' => self::DOMAIN_ADS_CREATIVE, 'status' => self::STATE_ERROR, 'message' => $t->getMessage()];
        }
    }

    /**
     * Future-Ready Domain: ADS_LIVE
     */
    private function syncAdsLiveDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        $runStartDate = $startDate ?: '2026-09-01';
        $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_ADS_LIVE, 'INCREMENTAL_DELTA', $runStartDate, $endDate, '/open_api/v1.3/report/integrated/get/live');
        try {
            $adsService = new CommerceAdsIngestionService($this->db);
            $res = $adsService->syncLiveDailyRange($shopId, $runStartDate, $endDate, false);
            $written = (int)($res['records_ingested'] ?? 0);
            $this->recordSyncRunEnd($runId, 'COMPLETED', $written, $written, $endDate, null, null);
            return ['domain' => self::DOMAIN_ADS_LIVE, 'status' => self::STATE_AVAILABLE, 'records_written' => $written];
        } catch (\Throwable $t) {
            $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'ADS_LIVE_ERROR', $t->getMessage());
            return ['domain' => self::DOMAIN_ADS_LIVE, 'status' => self::STATE_ERROR, 'message' => $t->getMessage()];
        }
    }

    /**
     * Future-Ready Domain: FULFILLMENT
     */
    private function syncFulfillmentDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        $runStartDate = $startDate ?: date('Y-m-d', strtotime('-7 days'));
        $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_FULFILLMENT, 'INCREMENTAL_DELTA', $runStartDate, $endDate, '/fulfillment/202309/packages/search');
        try {
            $aftersales = new CommerceAftersalesService($this->db);
            $res = $aftersales->incrementalSyncFulfillment($shopId);
            $this->recordSyncRunEnd($runId, 'COMPLETED', 0, 0, $endDate, null, null);
            return ['domain' => self::DOMAIN_FULFILLMENT, 'status' => self::STATE_AVAILABLE];
        } catch (\Throwable $t) {
            $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'FULFILLMENT_ERROR', $t->getMessage());
            return ['domain' => self::DOMAIN_FULFILLMENT, 'status' => self::STATE_ERROR, 'message' => $t->getMessage()];
        }
    }

    /**
     * Future-Ready Domain: AFFILIATE (P0-01 API ONLY)
     */
    private function syncAffiliateDomain(string $shopId, ?string $startDate, string $endDate, array $options): array {
        $runStartDate = $startDate ?: date('Y-m-d', strtotime('-30 days'));
        $runId = $this->recordSyncRunStart($shopId, self::DOMAIN_AFFILIATE, 'INCREMENTAL_DELTA', $runStartDate, $endDate, '/affiliate_seller/202410/orders/search');
        try {
            $affiliateService = new CommerceAffiliateService($this->db, $this->client);
            $res = $affiliateService->syncAffiliateOrders($shopId, $runStartDate, $endDate, $options);
            $written = (int)($res['records_synced'] ?? 0);
            $status = ($res['status'] ?? '') === 'COMPLETED' ? 'COMPLETED' : (($res['status'] ?? '') === 'PERMISSION_REQUIRED' ? 'PERMISSION_REQUIRED' : 'PARTIAL');
            $this->recordSyncRunEnd($runId, $status, $written, $written, $endDate, null, $res['message'] ?? null);
            return array_merge(['domain' => self::DOMAIN_AFFILIATE, 'status' => self::STATE_AVAILABLE, 'records_written' => $written], $res);
        } catch (\Throwable $t) {
            $this->recordSyncRunEnd($runId, 'FAILED', 0, 0, null, 'AFFILIATE_ERROR', $t->getMessage());
            return ['domain' => self::DOMAIN_AFFILIATE, 'status' => self::STATE_ERROR, 'message' => $t->getMessage()];
        }
    }

    // ====================================================================
    // AUDIT LOGGING HELPERS (commerce_sync_runs)
    // ====================================================================

    /**
     * Initializes an audit record in commerce_sync_runs.
     */
    private function recordSyncRunStart(
        string $shopId,
        string $domain,
        string $syncType,
        ?string $startDate,
        ?string $endDate,
        ?string $endpoint,
        ?string $windowStartTime = null,
        ?string $windowEndTime = null
    ): int {
        try {
            $cols = ['platform', 'shop_id', 'sync_type', 'status', 'started_at'];
            $vals = [':platform' => self::PLATFORM, ':shop_id' => $shopId, ':sync_type' => $syncType, ':status' => 'RUNNING'];

            if ($this->hasColumn('commerce_sync_runs', 'source_domain')) {
                $cols[] = 'source_domain';
                $vals[':source_domain'] = $domain;
            }
            if ($startDate || $windowStartTime) {
                if ($this->hasColumn('commerce_sync_runs', 'start_date') && $startDate) {
                    $cols[] = 'start_date';
                    $vals[':start_date'] = $startDate;
                }
                if ($this->hasColumn('commerce_sync_runs', 'window_start_time')) {
                    $cols[] = 'window_start_time';
                    $vals[':window_start_time'] = $windowStartTime ?: ($startDate ? $startDate . ' 00:00:00' : null);
                }
            }
            if ($endDate || $windowEndTime) {
                if ($this->hasColumn('commerce_sync_runs', 'end_date') && $endDate) {
                    $cols[] = 'end_date';
                    $vals[':end_date'] = $endDate;
                }
                if ($this->hasColumn('commerce_sync_runs', 'window_end_time')) {
                    $cols[] = 'window_end_time';
                    $vals[':window_end_time'] = $windowEndTime ?: ($endDate ? $endDate . ' 23:59:59' : null);
                }
            }
            if ($endpoint && $this->hasColumn('commerce_sync_runs', 'api_endpoint')) {
                $cols[] = 'api_endpoint';
                $vals[':api_endpoint'] = $endpoint;
            }

            $colList = implode(', ', array_map(fn($c) => "`{$c}`", $cols));
            $paramList = implode(', ', array_map(fn($c) => $c === 'started_at' ? 'NOW()' : ":{$c}", $cols));

            // Clean started_at from parameter array if literal NOW()
            $cleanVals = [];
            foreach ($vals as $k => $v) {
                if ($k !== ':started_at') {
                    $cleanVals[$k] = $v;
                }
            }

            $sql = "INSERT INTO `commerce_sync_runs` ({$colList}) VALUES ({$paramList})";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($cleanVals);
            return (int)$this->db->lastInsertId();
        } catch (\Throwable $t) {
            return 0;
        }
    }

    /**
     * Finalizes audit record in commerce_sync_runs with results.
     */
    private function recordSyncRunEnd(
        int $runId,
        string $status,
        int $recordsRead = 0,
        int $recordsWritten = 0,
        ?string $latestAvailableDate = null,
        ?string $errorCode = null,
        ?string $errorMessage = null
    ): void {
        if ($runId <= 0) return;
        try {
            $updates = ["status = :status", "completed_at = NOW()"];
            $params = [':status' => $status, ':id' => $runId];

            if ($this->hasColumn('commerce_sync_runs', 'records_read')) {
                $updates[] = "records_read = :records_read";
                $params[':records_read'] = $recordsRead;
            }
            if ($this->hasColumn('commerce_sync_runs', 'records_written')) {
                $updates[] = "records_written = :records_written";
                $params[':records_written'] = $recordsWritten;
            }
            if ($this->hasColumn('commerce_sync_runs', 'orders_ingested')) {
                $updates[] = "orders_ingested = :orders_ingested";
                $params[':orders_ingested'] = $recordsWritten;
            }
            if ($latestAvailableDate && $this->hasColumn('commerce_sync_runs', 'latest_available_date')) {
                $updates[] = "latest_available_date = :latest_available_date";
                $params[':latest_available_date'] = $latestAvailableDate;
            }
            if ($errorCode && $this->hasColumn('commerce_sync_runs', 'error_code')) {
                $updates[] = "error_code = :error_code";
                $params[':error_code'] = $errorCode;
            }
            if ($errorMessage && $this->hasColumn('commerce_sync_runs', 'error_message')) {
                $updates[] = "error_message = :error_message";
                $params[':error_message'] = substr($errorMessage, 0, 1000);
            }

            $setClause = implode(', ', $updates);
            $stmt = $this->db->prepare("UPDATE `commerce_sync_runs` SET {$setClause} WHERE id = :id");
            $stmt->execute($params);
        } catch (\Throwable $t) {}
    }

    /**
     * Computes high-level sync summary health.
     */
    private function computeSummaryHealth(array $domains): string {
        $hasError = false;
        $hasPending = false;
        $allComplete = true;

        foreach ($domains as $d) {
            if ($d['status'] === self::STATE_ERROR) $hasError = true;
            if ($d['status'] === 'SYNCING') $hasPending = true;
            if ($d['status'] !== self::STATE_AVAILABLE) $allComplete = false;
        }

        if ($hasPending) return 'SYNCING';
        if ($hasError) return 'PARTIAL_ERROR';
        if ($allComplete) return 'ALL_SYNCHRONIZED';
        return 'PARTIAL';
    }

    /**
     * Checks if a table exists in the connected database.
     */
    private function hasTable(string $table): bool {
        if (($_SERVER['APP_ENV'] ?? '') === 'testing' || getenv('APP_ENV') === 'testing') {
            return true;
        }
        try {
            $stmt = $this->db->query("SHOW TABLES LIKE '{$table}'");
            return !empty($stmt->fetch());
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Checks if a column exists on a table.
     */
    private function hasColumn(string $table, string $column): bool {
        if (($_SERVER['APP_ENV'] ?? '') === 'testing' || getenv('APP_ENV') === 'testing') {
            return true;
        }
        try {
            $stmt = $this->db->query("SHOW COLUMNS FROM `{$table}` LIKE '{$column}'");
            return !empty($stmt->fetch());
        } catch (\Throwable $t) {
            return false;
        }
    }

    // ====================================================================
    // ASYNC JOB ORCHESTRATION & RUN RECOVERY (Sprint V2-04.3 & P0-W3)
    // ====================================================================

    /**
     * Acquires a cooperative named lock for the shop to prevent concurrent sync execution.
     * Compatible with MySQL/MariaDB GET_LOCK, with safe fallback for testing environments.
     */
    public function acquireShopLock(string $shopId, int $timeoutSeconds = 0): bool {
        try {
            $lockName = 'addp_commerce_sync_' . preg_replace('/[^a-zA-Z0-9_]/', '', $shopId);
            $stmt = $this->db->prepare("SELECT GET_LOCK(?, ?)");
            $stmt->execute([$lockName, $timeoutSeconds]);
            $res = $stmt->fetchColumn();
            if (($_SERVER['APP_ENV'] ?? '') === 'testing' || getenv('APP_ENV') === 'testing') {
                return ($res === false || $res === null || (int)$res === 1);
            }
            return ((int)$res === 1);
        } catch (\Throwable $t) {
            // Graceful fallback for environments not supporting GET_LOCK (e.g. SQLite tests)
            return true;
        }
    }

    /**
     * Releases the cooperative named lock for the shop.
     */
    public function releaseShopLock(string $shopId): bool {
        try {
            $lockName = 'addp_commerce_sync_' . preg_replace('/[^a-zA-Z0-9_]/', '', $shopId);
            $stmt = $this->db->prepare("SELECT RELEASE_LOCK(?)");
            $stmt->execute([$lockName]);
            $res = $stmt->fetchColumn();
            if (($_SERVER['APP_ENV'] ?? '') === 'testing' || getenv('APP_ENV') === 'testing') {
                return true;
            }
            return ((int)$res === 1);
        } catch (\Throwable $t) {
            return true;
        }
    }

    /**
     * Checks whether MySQL named lock for shop is currently held by an active thread (F13 fix).
     */
    public function isShopLockHeld(string $shopId): bool {
        try {
            $lockName = 'addp_commerce_sync_' . preg_replace('/[^a-zA-Z0-9_]/', '', $shopId);
            $stmt = $this->db->prepare("SELECT IS_FREE_LOCK(?)");
            $stmt->execute([$lockName]);
            $res = $stmt->fetchColumn();
            if ($res === null || $res === false) return false;
            return ((int)$res === 0);
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Resolves local PHP CLI binary for spawning background worker.
     */
    public function resolvePhpCli(): ?string {
        $envPhp = getenv('PHP_BINARY_PATH') ?: ($_ENV['PHP_BINARY_PATH'] ?? null);
        if ($envPhp && file_exists($envPhp)) {
            return $envPhp;
        }
        $candidates = [
            PHP_BINARY,
            'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe',
            'C:\\xampp\\php\\php.exe',
            'C:\\php\\php.exe',
            '/usr/bin/php8.2',
            '/usr/local/bin/php8.2',
            '/usr/bin/php',
            '/usr/local/bin/php',
            '/usr/bin/php82',
            '/usr/local/cpanel/3rdparty/bin/php'
        ];
        foreach ($candidates as $c) {
            if ($c && file_exists($c) && !is_dir($c)) {
                return $c;
            }
        }
        return PHP_BINARY ?: 'php';
    }

    /**
     * Spawns background worker process asynchronously without blocking HTTP request.
     */
    public function spawnBackgroundWorker(int $jobId): bool {
        try {
            $phpCli = $this->resolvePhpCli();
            if (!$phpCli) return false;

            $cliScript = realpath(__DIR__ . '/../../tools/sync_worker_cli.php')
                ?: (realpath(__DIR__ . '/../tools/sync_worker_cli.php')
                ?: realpath(__DIR__ . '/tools/sync_worker_cli.php'));
            if (!$cliScript || !file_exists($cliScript)) return false;

            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                $cmd = 'start "" /B "' . $phpCli . '" "' . $cliScript . '" --job-id=' . (int)$jobId . ' > NUL 2>&1';
                $p = popen($cmd, 'r');
                if ($p) {
                    pclose($p);
                    return true;
                }
            } else {
                if (function_exists('exec')) {
                    $cmd = '"' . $phpCli . '" "' . $cliScript . '" --job-id=' . (int)$jobId . ' > /dev/null 2>&1 &';
                    @exec($cmd);
                    return true;
                }
            }
            return false;
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Recovers abandoned jobs and sync runs that were left in RUNNING past the heartbeat threshold.
     */
    public function recoverStaleJobsAndRuns(?string $shopId = null): array {
        $recoveredJobs = 0;
        $recoveredRuns = 0;
        $thresholdSec = self::STALE_HEARTBEAT_THRESHOLD_SECONDS;

        // F13 fix: If named lock is actively held by a running worker process, skip stale recovery
        if ($shopId && $this->isShopLockHeld($shopId)) {
            return [
                'recovered_jobs' => 0,
                'recovered_runs' => 0,
                'message' => 'Shop lock is actively held by active worker; skipping stale recovery.'
            ];
        }

        // 1. Recover stale commerce_sync_jobs
        if ($this->hasTable('commerce_sync_jobs')) {
            try {
                $sqlJobs = "UPDATE `commerce_sync_jobs` SET
                    status = 'FAILED',
                    error_code = 'STALE_JOB_RECOVERED',
                    error_message = 'Job execution timed out without heartbeat; recovered from stale RUNNING state.',
                    completed_at = NOW()
                    WHERE status IN ('QUEUED', 'RUNNING')
                      AND (
                        (heartbeat_at IS NOT NULL AND heartbeat_at < NOW() - INTERVAL {$thresholdSec} SECOND)
                        OR
                        (heartbeat_at IS NULL AND created_at < NOW() - INTERVAL {$thresholdSec} SECOND)
                      )";
                $params = [];
                if ($shopId) {
                    $sqlJobs .= " AND shop_id = :shop_id";
                    $params[':shop_id'] = $shopId;
                }
                $stmtJ = $this->db->prepare($sqlJobs);
                $stmtJ->execute($params);
                $recoveredJobs = $stmtJ->rowCount();
            } catch (\Throwable $t) {}
        }

        // 2. Recover stale commerce_sync_runs
        if ($this->hasTable('commerce_sync_runs')) {
            try {
                $sqlRuns = "UPDATE `commerce_sync_runs` SET
                    status = 'FAILED',
                    error_code = 'STALE_RUN_RECOVERED',
                    error_message = 'Sync run abandoned or timed out; recovered from stale RUNNING state.',
                    completed_at = NOW()
                    WHERE status = 'RUNNING'
                      AND started_at < NOW() - INTERVAL {$thresholdSec} SECOND";
                $params = [];
                if ($shopId) {
                    $sqlRuns .= " AND shop_id = :shop_id";
                    $params[':shop_id'] = $shopId;
                }
                $stmtR = $this->db->prepare($sqlRuns);
                $stmtR->execute($params);
                $recoveredRuns = $stmtR->rowCount();
            } catch (\Throwable $t) {}
        }

        return [
            'recovered_jobs' => $recoveredJobs,
            'recovered_runs' => $recoveredRuns
        ];
    }

    /**
     * Creates a new sync job or returns existing active job (concurrency & double-click guard).
     */
    public function createOrGetActiveSyncJob(
        string $shopId,
        string $startDate,
        string $endDate,
        string $createdBy = 'user'
    ): array {
        // 1. Clean up stale jobs/runs first
        $this->recoverStaleJobsAndRuns($shopId);

        // 2. Check for active job for this shop
        if ($this->hasTable('commerce_sync_jobs')) {
            try {
                $stmtCheck = $this->db->prepare("SELECT * FROM `commerce_sync_jobs` 
                    WHERE shop_id = ? AND status IN ('QUEUED', 'RUNNING') 
                    ORDER BY id DESC LIMIT 1");
                $stmtCheck->execute([$shopId]);
                $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

                if (!empty($existing)) {
                    $chk = json_decode($existing['checkpoint_data'] ?? '{}', true) ?: [];
                    return [
                        'success' => true,
                        'job_id' => (int)$existing['id'],
                        'status' => (string)$existing['status'],
                        'current_domain' => $existing['current_domain'],
                        'progress_percent' => (float)$existing['progress_percent'],
                        'already_running' => true,
                        'requested_start_date' => $existing['requested_start_date'],
                        'requested_end_date' => $existing['requested_end_date'],
                        'domains' => $chk['domains'] ?? [],
                        'message' => 'Một tác vụ đồng bộ đang được thực thi cho cửa hàng này.'
                    ];
                }
            } catch (\Throwable $t) {}
        }

        // Concurrency Guard: Try to acquire shop lock before initializing new job
        $locked = $this->acquireShopLock($shopId, 0);
        if (!$locked) {
            // Another worker or request is concurrently starting a job; re-check active job
            if ($this->hasTable('commerce_sync_jobs')) {
                try {
                    $stmtCheck2 = $this->db->prepare("SELECT * FROM `commerce_sync_jobs` 
                        WHERE shop_id = ? AND status IN ('QUEUED', 'RUNNING') 
                        ORDER BY id DESC LIMIT 1");
                    $stmtCheck2->execute([$shopId]);
                    $existing2 = $stmtCheck2->fetch(PDO::FETCH_ASSOC);
                    if (!empty($existing2)) {
                        $chk2 = json_decode($existing2['checkpoint_data'] ?? '{}', true) ?: [];
                        return [
                            'success' => true,
                            'job_id' => (int)$existing2['id'],
                            'status' => (string)$existing2['status'],
                            'current_domain' => $existing2['current_domain'],
                            'progress_percent' => (float)$existing2['progress_percent'],
                            'already_running' => true,
                            'requested_start_date' => $existing2['requested_start_date'],
                            'requested_end_date' => $existing2['requested_end_date'],
                            'domains' => $chk2['domains'] ?? [],
                            'message' => 'Một tác vụ đồng bộ đang được thực thi cho cửa hàng này.'
                        ];
                    }
                } catch (\Throwable $t) {}
            }
        }

        // 3. Create new job
        $initCheckpoint = json_encode([
            'step_index' => 0,
            'domains' => [],
            'created_at' => date('Y-m-d H:i:s')
        ], JSON_UNESCAPED_UNICODE);

        $jobId = 0;
        try {
            $stmtIns = $this->db->prepare("INSERT INTO `commerce_sync_jobs` (
                platform, shop_id, requested_start_date, requested_end_date,
                status, current_domain, progress_percent, checkpoint_data,
                created_by, created_at, updated_at
            ) VALUES (
                :plat, :shop_id, :s_date, :e_date,
                'QUEUED', 'order', 0.00, :checkpoint,
                :created_by, NOW(), NOW()
            )");
            $stmtIns->execute([
                ':plat' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':s_date' => $startDate,
                ':e_date' => $endDate,
                ':checkpoint' => $initCheckpoint,
                ':created_by' => substr($createdBy, 0, 64)
            ]);
            $jobId = (int)$this->db->lastInsertId();
        } catch (\Throwable $t) {
            $this->releaseShopLock($shopId);
            return [
                'success' => false,
                'error' => 'DATABASE_ERROR',
                'message' => 'Không thể khởi tạo tác vụ đồng bộ: ' . $t->getMessage()
            ];
        }

        // Release init lock so background worker or ticks can proceed
        $this->releaseShopLock($shopId);

        // 4. Attempt asynchronous worker launch
        $this->spawnBackgroundWorker($jobId);

        return [
            'success' => true,
            'job_id' => $jobId,
            'status' => 'QUEUED',
            'current_domain' => 'order',
            'progress_percent' => 0.0,
            'already_running' => false,
            'requested_start_date' => $startDate,
            'requested_end_date' => $endDate,
            'domains' => [],
            'message' => 'Tác vụ đồng bộ đã được khởi tạo.'
        ];
    }

    /**
     * Retrieves current job status with optional cooperative execution tick.
     */
    public function getJobStatus(int $jobId, bool $tick = false): array {
        if (!$this->hasTable('commerce_sync_jobs')) {
            return ['success' => false, 'error' => 'TABLE_NOT_FOUND', 'message' => 'Bảng commerce_sync_jobs không tồn tại'];
        }

        // Periodic stale recovery on query
        $this->recoverStaleJobsAndRuns();

        try {
            $stmt = $this->db->prepare("SELECT * FROM `commerce_sync_jobs` WHERE id = ? LIMIT 1");
            $stmt->execute([$jobId]);
            $job = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$job) {
                return ['success' => false, 'error' => 'JOB_NOT_FOUND', 'message' => "Không tìm thấy tác vụ #{$jobId}"];
            }

            // If tick requested and job is active:
            if ($tick && in_array($job['status'], ['QUEUED', 'RUNNING'], true)) {
                $lastHb = $job['heartbeat_at'] ? strtotime($job['heartbeat_at']) : 0;
                // If job has not ticked in the last 2 seconds, or was QUEUED, step forward via micro-batch tick!
                if ($job['status'] === 'QUEUED' || (time() - $lastHb) >= 2) {
                    $this->executeJobStep($jobId, ['micro_batch' => true]);
                    $stmt->execute([$jobId]);
                    $job = $stmt->fetch(PDO::FETCH_ASSOC);
                }
            }

            $chk = json_decode($job['checkpoint_data'] ?? '{}', true) ?: [];
            $domains = $chk['domains'] ?? [];

            $ordersRes = $domains['order'] ?? ($domains['orders'] ?? []);
            $ordersRawStatus = $ordersRes['status'] ?? 'UNKNOWN';
            $ordersStatus = self::normalizeDomainStatus($ordersRawStatus);

            return [
                'success' => true,
                'job_id' => (int)$job['id'],
                'platform' => $job['platform'],
                'shop_id' => $job['shop_id'],
                'status' => $job['status'],
                'requested_start_date' => $job['requested_start_date'],
                'requested_end_date' => $job['requested_end_date'],
                'current_domain' => $job['current_domain'],
                'progress_percent' => (float)$job['progress_percent'],
                'started_at' => $job['started_at'],
                'heartbeat_at' => $job['heartbeat_at'],
                'completed_at' => $job['completed_at'],
                'error_code' => $job['error_code'],
                'error_message' => $job['error_message'],
                'domains' => $domains,
                'orders_status' => $ordersStatus,
                'is_terminal' => in_array($job['status'], [self::JOB_STATUS_COMPLETED, self::JOB_STATUS_PARTIAL, self::JOB_STATUS_FAILED, self::JOB_STATUS_CANCELLED], true)
            ];
        } catch (\Throwable $t) {
            return [
                'success' => false,
                'error' => 'DATABASE_ERROR',
                'message' => $t->getMessage()
            ];
        }
    }

    /**
     * Executes the next sequential domain step for a sync job.
     * Supports micro-batch execution mode for fast HTTP cooperative ticks (< 2-3s).
     */
    public function executeJobStep(int $jobId, array $stepOptions = []): array {
        if (!$this->hasTable('commerce_sync_jobs')) {
            return ['success' => false, 'error' => 'TABLE_NOT_FOUND'];
        }

        $stmt = $this->db->prepare("SELECT * FROM `commerce_sync_jobs` WHERE id = ? LIMIT 1");
        $stmt->execute([$jobId]);
        $job = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$job) {
            return ['success' => false, 'error' => 'JOB_NOT_FOUND'];
        }

        // If job already terminal, return current status
        if (in_array($job['status'], [self::JOB_STATUS_COMPLETED, self::JOB_STATUS_PARTIAL, self::JOB_STATUS_FAILED, self::JOB_STATUS_CANCELLED], true)) {
            return $this->getJobStatus($jobId, false);
        }

        $shopId = (string)$job['shop_id'];
        $startDate = (string)$job['requested_start_date'];
        $endDate = (string)$job['requested_end_date'];

        // Mutual exclusion: Prevent concurrent step execution for the same shop
        $locked = $this->acquireShopLock($shopId, 0);
        if (!$locked) {
            // Another worker or process holds the execution lock right now; return current status
            return $this->getJobStatus($jobId, false);
        }

        try {
            // F12 fix: Re-read authoritative job row IMMEDIATELY after acquiring lock!
            $stmt = $this->db->prepare("SELECT * FROM `commerce_sync_jobs` WHERE id = ? LIMIT 1");
            $stmt->execute([$jobId]);
            $job = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$job) {
                return ['success' => false, 'error' => 'JOB_NOT_FOUND'];
            }

            // If job already terminal, return current status
            if (in_array($job['status'], [self::JOB_STATUS_COMPLETED, self::JOB_STATUS_PARTIAL, self::JOB_STATUS_FAILED, self::JOB_STATUS_CANCELLED], true)) {
                return $this->getJobStatus($jobId, false);
            }

            $chk = json_decode($job['checkpoint_data'] ?? '{}', true) ?: [];
            $stepIndex = (int)($chk['step_index'] ?? 0);
            $domains = (array)($chk['domains'] ?? []);
            $isMicroBatch = !empty($stepOptions['micro_batch']);

            // Transition from QUEUED to RUNNING if needed
            if ($job['status'] === self::JOB_STATUS_QUEUED) {
                $this->db->prepare("UPDATE `commerce_sync_jobs` SET status = 'RUNNING', started_at = IFNULL(started_at, NOW()), heartbeat_at = NOW() WHERE id = ?")
                         ->execute([$jobId]);
            } else {
                $this->db->prepare("UPDATE `commerce_sync_jobs` SET heartbeat_at = NOW() WHERE id = ?")
                         ->execute([$jobId]);
            }

            // Domain Pipeline Steps:
            // 0: orders_coverage (authoritative requested range, paginated)
            // 1: orders_mutation (HOT rolling refresh last 3 days)
            // 2: rma (returns & refunds)
            // 3: loss (loss ledger reconciliation)
            // 4: ads_campaign (Marketing API GMV Max)
            // 5: finance (Settlement statements)
            // 6: analytics (Shop daily performance)

            $nextDomain = null;
            $progress = 0.0;

            try {
                switch ($stepIndex) {
                    case 0: // Orders coverage (Micro-batch resumable)
                        $this->db->prepare("UPDATE `commerce_sync_jobs` SET current_domain = 'order', heartbeat_at = NOW() WHERE id = ?")->execute([$jobId]);
                        
                        $orderSyncOptions = [
                            'coverage_only' => true,
                            'resume_token' => $chk['order_resume_token'] ?? null
                        ];
                        if ($isMicroBatch) {
                            $orderSyncOptions['max_pages'] = 1; // Bounded micro-batch: 1 page per tick (< 2s)
                        }

                        $ordRes = $this->syncOrdersDomain($shopId, $startDate, $endDate, $orderSyncOptions);

                        // Check if further pages remain (micro-batch continuation)
                        $hasMorePages = ($ordRes['status'] === self::STATE_PARTIAL && !empty($ordRes['resume_token']));
                        if ($isMicroBatch && $hasMorePages) {
                            $chk['order_resume_token'] = $ordRes['resume_token'];
                            $pagesDone = (int)($chk['order_pages_done'] ?? 0) + (int)($ordRes['pages_processed'] ?? 1);
                            $chk['order_pages_done'] = $pagesDone;

                            // Smoothly increment progress within Step 0 (from 5% up to 24%)
                            $progress = min(24.0, 5.0 + ($pagesDone * 3.0));
                            $nextDomain = 'order';
                            // Step index stays at 0 to fetch next page on subsequent tick
                        } else {
                            // Step 0 completed
                            unset($chk['order_resume_token']);
                            $domains['order'] = $ordRes;
                            $stepIndex = 1;
                            $nextDomain = 'order';
                            $progress = 25.0;
                            try {
                                $dailyAgg = new CommerceDailyAggregateService($this->db);
                                $dailyAgg->rebuildDateRange($shopId, $startDate, $endDate);
                            } catch (\Throwable $t) {}
                        }
                        break;

                    case 1: // Orders mutation refresh (last 3 days, resumable in micro-batch)
                        $this->db->prepare("UPDATE `commerce_sync_jobs` SET current_domain = 'order', heartbeat_at = NOW() WHERE id = ?")->execute([$jobId]);
                        $mutOptions = [
                            'rolling_refresh' => true,
                            'resume_token' => $chk['mutation_resume_token'] ?? null
                        ];
                        if ($isMicroBatch) {
                            $mutOptions['max_pages'] = 1;
                            $mutOptions['micro_batch'] = true;
                        } else {
                            $mutOptions['max_pages'] = 20;
                        }
                        $mutRes = $this->syncOrdersDomain($shopId, null, date('Y-m-d'), $mutOptions);
                        $hasMoreMut = ($mutRes['status'] === self::STATE_PARTIAL && !empty($mutRes['resume_token']));
                        if ($isMicroBatch && $hasMoreMut) {
                            $chk['mutation_resume_token'] = $mutRes['resume_token'];
                            $pagesDone = (int)($chk['mutation_pages_done'] ?? 0) + 1;
                            $chk['mutation_pages_done'] = $pagesDone;
                            $progress = min(39.0, 25.0 + ($pagesDone * 3.0));
                            $nextDomain = 'order';
                            // Step index stays at 1 for next tick
                        } else {
                            unset($chk['mutation_resume_token']);
                            $domains['order_mutation'] = $mutRes;
                            $stepIndex = 2;
                            $nextDomain = 'rma';
                            $progress = 40.0;
                            try {
                                $dailyAgg = new CommerceDailyAggregateService($this->db);
                                $dailyAgg->rebuildDateRange($shopId, date('Y-m-d', strtotime('-3 days')), date('Y-m-d'));
                            } catch (\Throwable $t) {}
                        }
                        break;

                    case 2: // RMA / returns / refunds (resumable in micro-batch)
                        $this->db->prepare("UPDATE `commerce_sync_jobs` SET current_domain = 'rma', heartbeat_at = NOW() WHERE id = ?")->execute([$jobId]);
                        $rmaOptions = [
                            'max_pages' => $isMicroBatch ? 1 : 50,
                            'resume_token' => $chk['rma_resume_token'] ?? null
                        ];
                        $rmaRes = $this->syncRmaDomain($shopId, $startDate, $endDate, $rmaOptions);
                        $hasMoreRma = ($rmaRes['status'] === self::STATE_PARTIAL && !empty($rmaRes['resume_token']));
                        if ($isMicroBatch && $hasMoreRma) {
                            $chk['rma_resume_token'] = $rmaRes['resume_token'];
                            $pagesDone = (int)($chk['rma_pages_done'] ?? 0) + 1;
                            $chk['rma_pages_done'] = $pagesDone;
                            $progress = min(54.0, 40.0 + ($pagesDone * 3.0));
                            $nextDomain = 'rma';
                            // Step index stays at 2 for next tick
                        } else {
                            unset($chk['rma_resume_token']);
                            $domains['rma'] = $rmaRes;
                            $stepIndex = 3;
                            $nextDomain = 'loss';
                            $progress = 55.0;
                            try {
                                $dailyAgg = new CommerceDailyAggregateService($this->db);
                                $runId = (int)($rmaRes['sync_run_id'] ?? 0);
                                if ($runId > 0 && $dailyAgg->hasTable('commerce_aftersales')) {
                                    $stmtRmaOrders = $this->db->prepare("SELECT DISTINCT platform_order_id FROM commerce_aftersales WHERE platform = ? AND shop_id = ? AND sync_run_id = ?");
                                    $stmtRmaOrders->execute([self::PLATFORM, $shopId, $runId]);
                                    $rmaOrderIds = $stmtRmaOrders->fetchAll(PDO::FETCH_COLUMN) ?: [];
                                    if (!empty($rmaOrderIds)) {
                                        $dailyAgg->rebuildDatesForOrders($shopId, $rmaOrderIds);
                                    }
                                }
                            } catch (\Throwable $t) {}
                        }
                        break;

                    case 3: // Loss reconciliation
                        $this->db->prepare("UPDATE `commerce_sync_jobs` SET current_domain = 'loss', heartbeat_at = NOW() WHERE id = ?")->execute([$jobId]);
                        $lossRes = $this->syncLossDomain($shopId, $startDate, $endDate, []);
                        $domains['loss'] = $lossRes;
                        $stepIndex = 4;
                        $nextDomain = 'ads_campaign';
                        $progress = 70.0;
                        try {
                            $dailyAgg = new CommerceDailyAggregateService($this->db);
                            $dailyAgg->rebuildDateRange($shopId, $startDate, $endDate);
                        } catch (\Throwable $t) {}
                        break;

                    case 4: // Advertising GMV Max
                        $this->db->prepare("UPDATE `commerce_sync_jobs` SET current_domain = 'ads_campaign', heartbeat_at = NOW() WHERE id = ?")->execute([$jobId]);
                        $adsRes = $this->syncAdsCampaignDomain($shopId, $startDate, $endDate, []);
                        $domains['ads_campaign'] = $adsRes;
                        $stepIndex = 5;
                        $nextDomain = 'finance';
                        $progress = 85.0;
                        try {
                            $dailyAgg = new CommerceDailyAggregateService($this->db);
                            $dailyAgg->rebuildDateRange($shopId, $startDate, $endDate);
                        } catch (\Throwable $t) {}
                        break;

                    case 5: // Finance statements
                        $this->db->prepare("UPDATE `commerce_sync_jobs` SET current_domain = 'finance', heartbeat_at = NOW() WHERE id = ?")->execute([$jobId]);
                        $finRes = $this->syncFinanceDomain($shopId, $startDate, $endDate, []);
                        $domains['finance'] = $finRes;
                        $stepIndex = 6;
                        $nextDomain = 'analytics';
                        $progress = 92.0;
                        try {
                            $dailyAgg = new CommerceDailyAggregateService($this->db);
                            $dailyAgg->rebuildDateRange($shopId, $startDate, $endDate);
                        } catch (\Throwable $t) {}
                        break;

                    case 6: // Analytics / Compass
                    default:
                        $this->db->prepare("UPDATE `commerce_sync_jobs` SET current_domain = 'analytics', heartbeat_at = NOW() WHERE id = ?")->execute([$jobId]);
                        $anaRes = $this->syncAnalyticsDomain($shopId, $startDate, $endDate, []);
                        $domains['analytics'] = $anaRes;
                        $stepIndex = 7; // Finished all steps
                        $nextDomain = null;
                        $progress = 100.0;
                        break;
                }
            } catch (\Throwable $stepEx) {
                $currDom = match ($stepIndex) {
                    0, 1 => 'order',
                    2 => 'rma',
                    3 => 'loss',
                    4 => 'ads_campaign',
                    5 => 'finance',
                    default => 'analytics'
                };
                $domains[$currDom] = [
                    'domain' => $currDom,
                    'status' => self::STATE_ERROR,
                    'message' => $stepEx->getMessage()
                ];
                $stepIndex++;
            }

            $chk['step_index'] = $stepIndex;
            $chk['domains'] = $domains;
            $chkJson = json_encode($chk, JSON_UNESCAPED_UNICODE);

            // Terminal check
            if ($stepIndex >= 7) {
                $ordersRes = $domains['order'] ?? [];
                $ordersRawStatus = $ordersRes['status'] ?? 'UNKNOWN';
                $ordersStatus = self::normalizeDomainStatus($ordersRawStatus);

                $isOrdersDisabled = ($ordersStatus === 'DISABLED');
                $isOrdersError = in_array($ordersStatus, [self::STATE_ERROR, 'FAILED'], true);
                $isOrdersPartial = in_array($ordersStatus, [self::STATE_PARTIAL, 'INTERRUPTED'], true);
                $isOrdersSuccess = in_array($ordersStatus, ['COMPLETED', 'COMPLETE', self::STATE_AVAILABLE, 'SUCCESS'], true);

                // Optional domains analysis
                $hasOptionalError = false;
                $hasOptionalPartial = false;
                foreach (['rma', 'loss', 'ads_campaign', 'finance', 'analytics'] as $optDom) {
                    $optRes = $domains[$optDom] ?? [];
                    $optSt = self::normalizeDomainStatus($optRes['status'] ?? '');
                    if (in_array($optSt, [self::STATE_ERROR, 'FAILED'], true)) {
                        $hasOptionalError = true;
                    } elseif ($optSt === self::STATE_PARTIAL) {
                        $hasOptionalPartial = true;
                    }
                }

                if ($isOrdersDisabled) {
                    $finalStatus = self::JOB_STATUS_FAILED;
                    $errCode = 'ORDERS_DISABLED';
                    $errMsg = 'Tính năng đồng bộ đơn hàng đang bị tắt (FEATURE_ENABLE_COMMERCE_V2=false).';
                } elseif ($isOrdersError) {
                    $finalStatus = self::JOB_STATUS_FAILED;
                    $errCode = 'ORDERS_SYNC_ERROR';
                    $errMsg = 'Đồng bộ thất bại: ' . ($ordersRes['message'] ?? 'Lỗi không xác định khi đồng bộ đơn hàng');
                } elseif ($isOrdersPartial) {
                    $finalStatus = self::JOB_STATUS_PARTIAL;
                    $errCode = 'ORDERS_PARTIAL';
                    $errMsg = 'Đồng bộ hoàn thành một phần. Vui lòng kiểm tra Độ phủ dữ liệu.';
                } elseif ($isOrdersSuccess) {
                    if ($hasOptionalError || $hasOptionalPartial) {
                        $finalStatus = self::JOB_STATUS_PARTIAL;
                        $errCode = 'OPTIONAL_DOMAIN_INCOMPLETE';
                        $errMsg = 'Đồng bộ đơn hàng hoàn tất. Một số miền dữ liệu tùy chọn chưa hoàn tất.';
                    } else {
                        $finalStatus = self::JOB_STATUS_COMPLETED;
                        $errCode = null;
                        $errMsg = 'Đồng bộ đơn hàng hoàn tất. Báo cáo đã được cập nhật.';
                    }
                } else {
                    $finalStatus = self::JOB_STATUS_FAILED;
                    $errCode = 'ORDERS_UNKNOWN_STATUS';
                    $errMsg = "Trạng thái đơn hàng: {$ordersStatus}";
                }

                $stmtUpd = $this->db->prepare("UPDATE `commerce_sync_jobs` SET
                    status = :status,
                    progress_percent = 100.00,
                    checkpoint_data = :chk,
                    current_domain = NULL,
                    heartbeat_at = NOW(),
                    completed_at = NOW(),
                    error_code = :err_code,
                    error_message = :err_msg
                    WHERE id = :id");
                $stmtUpd->execute([
                    ':status' => $finalStatus,
                    ':chk' => $chkJson,
                    ':err_code' => $errCode,
                    ':err_msg' => $errMsg,
                    ':id' => $jobId
                ]);
            } else {
                $stmtUpd = $this->db->prepare("UPDATE `commerce_sync_jobs` SET
                    progress_percent = :progress,
                    checkpoint_data = :chk,
                    current_domain = :current_domain,
                    heartbeat_at = NOW()
                    WHERE id = :id");
                $stmtUpd->execute([
                    ':progress' => $progress,
                    ':chk' => $chkJson,
                    ':current_domain' => $nextDomain,
                    ':id' => $jobId
                ]);
            }

            return $this->getJobStatus($jobId, false);
        } finally {
            $this->releaseShopLock($shopId);
        }
    }

    /**
     * Executes all sequential steps until job reaches terminal state.
     */
    public function executeJobAllSteps(int $jobId, int $maxSteps = 25): array {
        $step = 0;
        $state = [];
        while ($step < $maxSteps) {
            $state = $this->executeJobStep($jobId, ['micro_batch' => false]);
            $status = $state['status'] ?? 'UNKNOWN';
            if (in_array($status, [self::JOB_STATUS_COMPLETED, self::JOB_STATUS_PARTIAL, self::JOB_STATUS_FAILED, self::JOB_STATUS_CANCELLED], true)) {
                break;
            }
            $step++;
        }
        return $state;
    }
}

