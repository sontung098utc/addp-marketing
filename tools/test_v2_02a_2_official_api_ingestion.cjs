/**
 * SPRINT V2-02A.2 ACCEPTANCE TEST SUITE
 * OFFICIAL GMV MAX API INGESTION PIPELINE
 * 
 * Verifies all requirements of Sprint V2-02A.2:
 *   BLOCK A: Additive Migration 011 & Rollback Script Audit
 *   BLOCK B: Official TikTok GMV Max API Client (Request Builder, Transport, Redaction)
 *   BLOCK C: Pagination, Date Bounding & Auto-Chunking (Zero Truncation)
 *   BLOCK D: Error Handling, Rate-Limit Backoff & Zero Token Leakage
 *   BLOCK E: Normalization, API ROI vs Derived ROI, Zero-Division Safety
 *   BLOCK F: Source Precedence (TIKTOK_GMV_MAX_API > DAILY_REPORT_BACKFILL)
 *   BLOCK G: API vs Legacy Reconciliation Engine
 *   BLOCK H: Dashboard API Integration (reconcile_ads_campaigns)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`  [PASS] Scenario ${String(passedTests + failedTests + 1).padStart(2, ' ')}: ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] Scenario ${String(passedTests + failedTests + 1).padStart(2, ' ')}: ${message}`);
    if (details) console.error(`         Details: ${details}`);
    failedTests++;
  }
}

const phpBin = 'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe';

function runPhpScript(phpCode) {
  const tmpFile = path.resolve('tools', 'debug', `tmp_v202a2_${Date.now()}_${Math.floor(Math.random() * 10000)}.php`);
  fs.mkdirSync(path.dirname(tmpFile), { recursive: true });

  const fullScript = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('AUTH_SIGNING_KEY=test_v202a2_key_32_bytes_length!');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_pass');

class MockPDOStatement extends PDOStatement {
    private array $data;
    private int $idx = 0;
    public ?array $lastExecutedParams = null;
    public function __construct(array $data) { $this->data = $data; }
    public function execute(?array $params = null): bool { 
        $this->lastExecutedParams = $params;
        $this->idx = 0; 
        return true; 
    }
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed {
        return $this->idx < count($this->data) ? $this->data[$this->idx++] : false;
    }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array {
        return $this->data;
    }
    public function fetchColumn(int $column = 0): mixed {
        $row = $this->fetch();
        if ($row === false) return false;
        if (is_array($row)) {
            $vals = array_values($row);
            return $vals[$column] ?? false;
        }
        return $row;
    }
}

class MockPDO extends PDO {
    private array $handlers = [];
    public array $queries = [];
    public function __construct() {}
    public function setHandler(string $querySubstring, array $results): void {
        $this->handlers[$querySubstring] = $results;
    }
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement {
        $this->queries[] = $query;
        foreach ($this->handlers as $sub => $rows) {
            if (stripos($query, $sub) !== false) {
                return new MockPDOStatement($rows);
            }
        }
        return new MockPDOStatement([]);
    }
    public function prepare(string $query, array $options = []): PDOStatement {
        $this->queries[] = $query;
        foreach ($this->handlers as $sub => $rows) {
            if (stripos($query, $sub) !== false) {
                return new MockPDOStatement($rows);
            }
        }
        return new MockPDOStatement([]);
    }
    public function exec(string $statement): int|false {
        $this->queries[] = $statement;
        return 1;
    }
}

${phpCode}
`;

  fs.writeFileSync(tmpFile, fullScript, 'utf8');
  try {
    const stdout = execSync(`"${phpBin}" "${tmpFile}"`, { encoding: 'utf8', timeout: 15000 });
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    return { ok: true, output: stdout.trim() };
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    return { ok: false, error: err.message, output: err.stdout ? err.stdout.toString() : '' };
  }
}

console.log('====================================================================');
console.log('STARTING SPRINT V2-02A.2 OFFICIAL GMV MAX API INGESTION TEST MATRIX');
console.log('====================================================================\n');

// -----------------------------------------------------------------------------
// BLOCK A: ADDITIVE MIGRATION 011 & ROLLBACK SCRIPT AUDIT
// -----------------------------------------------------------------------------
console.log('--- BLOCK A: ADDITIVE MIGRATION 011 & ROLLBACK SCRIPT AUDIT ---');

const mig011Path = path.resolve('database', 'migrations', '20261004_011_add_commerce_ads_campaign_api_lineage_columns.sql');
const roll011Path = path.resolve('database', 'migrations', '20261004_011_rollback_commerce_ads_campaign_api_lineage_columns.sql');

assert(fs.existsSync(mig011Path), 'Migration 011 file exists');
assert(fs.existsSync(roll011Path), 'Rollback script for Migration 011 exists');

const mig011Content = fs.readFileSync(mig011Path, 'utf8');
assert(mig011Content.includes('`net_cost` DECIMAL(15,2)'), 'Migration defines net_cost column with DECIMAL(15,2)');
assert(mig011Content.includes('`promotion_type` VARCHAR(32)'), 'Migration defines promotion_type column (PRODUCT, LIVE)');
assert(mig011Content.includes('`api_roi` DECIMAL(7,4)'), 'Migration defines api_roi column');
assert(mig011Content.includes('`derived_roi` DECIMAL(7,4)'), 'Migration defines derived_roi column');
assert(mig011Content.includes('`api_cost_per_order` DECIMAL(15,2)'), 'Migration defines api_cost_per_order column');
assert(mig011Content.includes('`derived_cpa` DECIMAL(15,2)'), 'Migration defines derived_cpa column');
assert(mig011Content.includes('`api_version` VARCHAR(32)'), 'Migration defines api_version column');
assert(mig011Content.includes('`observed_at` DATETIME'), 'Migration defines observed_at column');

const roll011Content = fs.readFileSync(roll011Path, 'utf8');
assert(roll011Content.includes('DROP COLUMN `net_cost`'), 'Rollback cleanly drops net_cost');
assert(roll011Content.includes('DROP COLUMN `promotion_type`'), 'Rollback cleanly drops promotion_type');
assert(roll011Content.includes('DROP COLUMN `api_roi`'), 'Rollback cleanly drops api_roi');

// -----------------------------------------------------------------------------
// BLOCK B: OFFICIAL TIKTOK GMV MAX API CLIENT AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK B: OFFICIAL TIKTOK GMV MAX API CLIENT AUDIT ---');

const testClientCode = `
require_once 'public/api/tiktok_gmv_max_api_client.php';

$client = new TikTokGmvMaxApiClient();
$params = $client->buildCampaignReportParams('adv_999', '2026-09-01', '2026-09-10', [
    'store_ids' => ['shop_123'],
    'page' => 1,
    'page_size' => 50
]);

$queryStr = $client->buildQueryString($params);

echo json_encode([
    'params' => $params,
    'query' => $queryStr
]);
`;

const clientRes = runPhpScript(testClientCode);
assert(clientRes.ok, 'PHP executed TikTokGmvMaxApiClient cleanly', clientRes.error);
if (clientRes.ok) {
  const cData = JSON.parse(clientRes.output);
  assert(cData.params.advertiser_id === 'adv_999', 'Client builds advertiser_id');
  assert(cData.params.start_date === '2026-09-01', 'Client builds start_date');
  assert(cData.params.end_date === '2026-09-10', 'Client builds end_date');
  assert(Array.isArray(cData.params.dimensions) && cData.params.dimensions.includes('campaign_id'), 'Dimensions include campaign_id');
  assert(Array.isArray(cData.params.dimensions) && cData.params.dimensions.includes('stat_time_day'), 'Dimensions include stat_time_day');
  assert(cData.params.metrics.includes('cost') && cData.params.metrics.includes('gross_revenue') && cData.params.metrics.includes('roi'), 'Metrics include official cost, gross_revenue, roi');
  assert(cData.params.metrics.includes('net_cost') && cData.params.metrics.includes('cost_per_order'), 'Metrics include net_cost and cost_per_order');
  assert(cData.query.includes('advertiser_id=adv_999'), 'Query string encodes advertiser_id');
  assert(cData.query.includes('dimensions='), 'Query string JSON encodes dimensions');
  assert(cData.query.includes('metrics='), 'Query string JSON encodes metrics');
}

// -----------------------------------------------------------------------------
// BLOCK C: PAGINATION, DATE BOUNDING & AUTO-CHUNKING
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK C: PAGINATION, DATE BOUNDING & AUTO-CHUNKING ---');

const testPaginationCode = `
require_once 'public/api/tiktok_gmv_max_api_client.php';

$callCount = 0;
$mockTransport = function($url, $method, $headers, $queryParams, $timeout) use (&$callCount) {
    $callCount++;
    $page = (int)($queryParams['page'] ?? 1);
    if ($page === 1) {
        return json_encode([
            'code' => 0,
            'message' => 'OK',
            'data' => [
                'list' => [
                    ['dimensions' => ['campaign_id' => 'camp_1', 'stat_time_day' => '2026-09-01 00:00:00'], 'metrics' => ['cost' => 100, 'gross_revenue' => 1200, 'orders' => 10, 'roi' => 12.0]]
                ],
                'page_info' => ['page' => 1, 'page_size' => 1, 'total_number' => 2, 'total_page' => 2]
            ]
        ]);
    } else {
        return json_encode([
            'code' => 0,
            'message' => 'OK',
            'data' => [
                'list' => [
                    ['dimensions' => ['campaign_id' => 'camp_2', 'stat_time_day' => '2026-09-02 00:00:00'], 'metrics' => ['cost' => 200, 'gross_revenue' => 2400, 'orders' => 20, 'roi' => 12.0]]
                ],
                'page_info' => ['page' => 2, 'page_size' => 1, 'total_number' => 2, 'total_page' => 2]
            ]
        ]);
    }
};

$client = new TikTokGmvMaxApiClient(null, $mockTransport);
$params = $client->buildCampaignReportParams('adv_1', '2026-09-01', '2026-09-02', ['page_size' => 1]);
$allRes = $client->fetchAllPages($params, 'fake_secret_token_abc');

echo json_encode([
    'call_count' => $callCount,
    'total_rows' => count($allRes['list']),
    'first_camp' => $allRes['list'][0]['dimensions']['campaign_id'],
    'second_camp' => $allRes['list'][1]['dimensions']['campaign_id']
]);
`;

const pagRes = runPhpScript(testPaginationCode);
assert(pagRes.ok, 'PHP executed pagination handler cleanly', pagRes.error);
if (pagRes.ok) {
  const pData = JSON.parse(pagRes.output);
  assert(pData.call_count === 2, 'Client iterated through 2 pages');
  assert(pData.total_rows === 2, 'Aggregated both pages into single list');
  assert(pData.first_camp === 'camp_1' && pData.second_camp === 'camp_2', 'Maintains row order across pagination');
}

// Test Date Chunking (> 30 days)
const testChunkingCode = `
require_once 'public/api/tiktok_gmv_max_api_client.php';

$requestedRanges = [];
$mockChunkTransport = function($url, $method, $headers, $queryParams, $timeout) use (&$requestedRanges) {
    $requestedRanges[] = [$queryParams['start_date'], $queryParams['end_date']];
    return json_encode([
        'code' => 0,
        'message' => 'OK',
        'data' => [
            'list' => [
                ['dimensions' => ['campaign_id' => 'chunk_row', 'stat_time_day' => $queryParams['start_date'] . ' 00:00:00'], 'metrics' => ['cost' => 50, 'gross_revenue' => 500, 'orders' => 5, 'roi' => 10.0]]
            ],
            'page_info' => ['page' => 1, 'page_size' => 100, 'total_number' => 1, 'total_page' => 1]
        ]
    ]);
};

$client = new TikTokGmvMaxApiClient(null, $mockChunkTransport);
// 45 days range (exceeds 30 days limit)
$params = $client->buildCampaignReportParams('adv_1', '2026-08-01', '2026-09-14');
$boundedRows = $client->fetchDateBoundedReport($params, 'fake_secret_token_xyz');

echo json_encode([
    'chunk_count' => count($requestedRanges),
    'chunks' => $requestedRanges,
    'total_rows' => count($boundedRows)
]);
`;

const chunkRes = runPhpScript(testChunkingCode);
assert(chunkRes.ok, 'PHP executed date chunking cleanly', chunkRes.error);
if (chunkRes.ok) {
  const chData = JSON.parse(chunkRes.output);
  assert(chData.chunk_count === 2, '45-day request split into 2 chunks');
  assert(chData.chunks[0][0] === '2026-08-01' && chData.chunks[0][1] === '2026-08-30', 'First chunk bounded exactly to 30 days');
  assert(chData.chunks[1][0] === '2026-08-31' && chData.chunks[1][1] === '2026-09-14', 'Second chunk covers remaining 15 days without overlap');
  assert(chData.total_rows === 2, 'Combined all chunk results without truncation');
}

// -----------------------------------------------------------------------------
// BLOCK D: ERROR HANDLING, RATE-LIMIT BACKOFF & TOKEN REDACTION
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK D: ERROR HANDLING, RATE-LIMIT BACKOFF & TOKEN REDACTION ---');

const testErrorAndRedactionCode = `
require_once 'public/api/tiktok_gmv_max_api_client.php';

$attemptCount = 0;
$mockRateLimitTransport = function($url, $method, $headers, $queryParams, $timeout) use (&$attemptCount) {
    $attemptCount++;
    if ($attemptCount < 3) {
        // Return rate-limited response
        return json_encode([
            'code' => 40100,
            'message' => 'Rate limit exceeded for token secret_token_super_private_123',
            'data' => []
        ]);
    }
    // Success on 3rd attempt
    return json_encode([
        'code' => 0,
        'message' => 'OK',
        'data' => [
            'list' => [
                ['dimensions' => ['campaign_id' => 'recovered_camp', 'stat_time_day' => '2026-09-01 00:00:00'], 'metrics' => ['cost' => 10, 'gross_revenue' => 100, 'orders' => 1, 'roi' => 10.0]]
            ],
            'page_info' => ['page' => 1, 'page_size' => 100, 'total_number' => 1, 'total_page' => 1]
        ]
    ]);
};

$secretToken = 'secret_token_super_private_123';
$client = new TikTokGmvMaxApiClient(null, $mockRateLimitTransport);
$params = $client->buildCampaignReportParams('adv_1', '2026-09-01', '2026-09-01');
$res = $client->fetchReportPage($params, $secretToken);

// Test Redaction on unrecoverable error
$mockFatalTransport = function() {
    return json_encode([
        'code' => 40001,
        'message' => 'Invalid credentials with token secret_token_super_private_123'
    ]);
};
$fatalClient = new TikTokGmvMaxApiClient(null, $mockFatalTransport);
$redactedError = '';
try {
    $fatalClient->fetchReportPage($params, $secretToken);
} catch (TikTokAdsApiException $e) {
    $redactedError = $e->getMessage();
}

echo json_encode([
    'attempt_count' => $attemptCount,
    'recovered_camp' => $res['data']['list'][0]['dimensions']['campaign_id'],
    'has_secret_in_error' => strpos($redactedError, 'secret_token_super_private_123') !== false,
    'has_redacted_tag' => strpos($redactedError, '[REDACTED_ACCESS_TOKEN]') !== false
]);
`;

const errRes = runPhpScript(testErrorAndRedactionCode);
assert(errRes.ok, 'PHP executed error and redaction tests cleanly', errRes.error);
if (errRes.ok) {
  const eData = JSON.parse(errRes.output);
  assert(eData.attempt_count === 3, 'Client retried rate-limited request up to 3 times');
  assert(eData.recovered_camp === 'recovered_camp', 'Request recovered successfully on retry');
  assert(eData.has_secret_in_error === false, 'Zero access token leaked in error message');
  assert(eData.has_redacted_tag === true, 'Access token safely masked with [REDACTED_ACCESS_TOKEN]');
}

// -----------------------------------------------------------------------------
// BLOCK E: NORMALIZATION, API ROI VS DERIVED ROI, ZERO-DIVISION SAFETY
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK E: NORMALIZATION, API ROI VS DERIVED ROI, ZERO-DIVISION SAFETY ---');

const testNormCode = `
require_once 'public/api/commerce_ads_ingestion_service.php';

$mockPdo = new MockPDO();
$mockPdo->setHandler('SHOW TABLES LIKE', [['table' => 'commerce_ads_campaign_daily']]);
$mockPdo->setHandler('SHOW COLUMNS FROM', [['Field' => 'net_cost']]);
$mockPdo->setHandler('SELECT id, name, type', [
    ['id' => '1809001', 'name' => 'Chiến dịch GMV Max Áo Thun', 'type' => 'Product GMV Max', 'budget' => 1000000, 'target_roas' => 10.0, 'status' => 1]
]);

$mockTransport = function($url, $method, $headers, $queryParams, $timeout) {
    return json_encode([
        'code' => 0,
        'message' => 'OK',
        'data' => [
            'list' => [
                [
                    'dimensions' => ['campaign_id' => '1809001', 'stat_time_day' => '2026-09-01 00:00:00'],
                    'metrics' => [
                        'cost' => '700000.00',
                        'net_cost' => '680000.00',
                        'gross_revenue' => '8400000.00',
                        'orders' => 120,
                        'roi' => '12.0000',
                        'cost_per_order' => '5833.33'
                    ]
                ],
                [
                    // Edge case: zero spend & zero orders
                    'dimensions' => ['campaign_id' => '1809001', 'stat_time_day' => '2026-09-02 00:00:00'],
                    'metrics' => [
                        'cost' => '0.00',
                        'net_cost' => '0.00',
                        'gross_revenue' => '0.00',
                        'orders' => 0,
                        'roi' => '0.0000',
                        'cost_per_order' => '0.00'
                    ]
                ]
            ],
            'page_info' => ['page' => 1, 'page_size' => 100, 'total_number' => 2, 'total_page' => 1]
        ]
    ]);
};

$apiClient = new TikTokGmvMaxApiClient(null, $mockTransport);
$service = new CommerceAdsIngestionService($mockPdo, $apiClient);

$res = $service->ingestFromTikTokAdsApi('hadaplus', 'adv_100', 'valid_token_123', '2026-09-01', '2026-09-02');

echo json_encode([
    'status' => $res['status'],
    'records_ingested' => $res['records_ingested'],
    'source' => $res['source'],
    'queries_count' => count($mockPdo->queries)
]);
`;

const normRes = runPhpScript(testNormCode);
assert(normRes.ok, 'PHP executed API ingestion & normalization cleanly', normRes.error);
if (normRes.ok) {
  const nData = JSON.parse(normRes.output);
  assert(nData.status === 'SUCCESS', 'API Ingestion status is SUCCESS');
  assert(nData.records_ingested === 2, 'Normalized and inserted exactly 2 records');
  assert(nData.source === 'TIKTOK_GMV_MAX_API', 'Source is canonically TIKTOK_GMV_MAX_API');
}

// -----------------------------------------------------------------------------
// BLOCK F: SOURCE PRECEDENCE (TIKTOK_GMV_MAX_API > DAILY_REPORT_BACKFILL)
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK F: SOURCE PRECEDENCE (TIKTOK_GMV_MAX_API > DAILY_REPORT_BACKFILL) ---');

const testPrecedenceCode = `
require_once 'public/api/commerce_ads_ingestion_service.php';

$mockPdo = new MockPDO();
$mockPdo->setHandler('SHOW TABLES LIKE', [['table' => 'commerce_ads_campaign_daily']]);
$mockPdo->setHandler('tiktok_campaign_daily_reports', [
    ['campaign_id' => '1809001', 'stat_date' => '2026-09-01', 'spend' => 999999, 'gmv' => 9999999, 'orders' => 99, 'roi' => 10.0, 'cpa' => 10101, 'campaign_name' => 'Legacy Name', 'campaign_type' => 'Product GMV Max', 'budget' => 500000, 'target_roas' => 5.0, 'campaign_status' => 1]
]);

$service = new CommerceAdsIngestionService($mockPdo);
$backfillRes = $service->backfillFromLegacyDailyReports('hadaplus', '2026-09-01', '2026-09-01');

// Verify prepare statement has conditional update guard
$prepQuery = '';
foreach ($mockPdo->queries as $q) {
    if (stripos($q, 'INSERT INTO \`commerce_ads_campaign_daily\`') !== false) {
        $prepQuery = $q;
        break;
    }
}

$hasGuard = (stripos($prepQuery, "IF(commerce_ads_campaign_daily.source = 'TIKTOK_GMV_MAX_API'") !== false);

echo json_encode([
    'backfill_status' => $backfillRes['status'],
    'has_source_precedence_guard' => $hasGuard
]);
`;

const precRes = runPhpScript(testPrecedenceCode);
assert(precRes.ok, 'PHP executed source precedence check cleanly', precRes.error);
if (precRes.ok) {
  const prData = JSON.parse(precRes.output);
  assert(prData.backfill_status === 'SUCCESS', 'Legacy backfill executed successfully');
  assert(prData.has_source_precedence_guard === true, 'Upsert SQL contains IF(source = TIKTOK_GMV_MAX_API) protection');
}

// -----------------------------------------------------------------------------
// BLOCK G: API VS LEGACY RECONCILIATION ENGINE
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK G: API VS LEGACY RECONCILIATION ENGINE ---');

const testReconciliationCode = `
require_once 'public/api/commerce_ads_ingestion_service.php';

$mockPdo = new MockPDO();
$mockPdo->setHandler('SHOW TABLES LIKE', [['table' => 'commerce_ads_campaign_daily']]);

// 1. API rows: camp_1 matches, camp_2 has minor difference
$apiData = [
    ['campaign_id' => '1809001', 'campaign_name' => 'Product GMV Max', 'campaign_type' => 'Product GMV Max', 'api_spend' => 14415406, 'api_gross' => 174098150, 'api_orders' => 1800, 'api_days' => 20],
    ['campaign_id' => '1809002', 'campaign_name' => 'LIVE GMV Max', 'campaign_type' => 'LIVE GMV Max', 'api_spend' => 6057339, 'api_gross' => 70927539, 'api_orders' => 800, 'api_days' => 20]
];
$mockPdo->setHandler('FROM \`commerce_ads_campaign_daily\`', $apiData);

// 2. Legacy rows
$legacyData = [
    ['campaign_id' => '1809001', 'campaign_name' => 'Product GMV Max', 'campaign_type' => 'Product GMV Max', 'legacy_spend' => 14415406, 'legacy_gross' => 174098150, 'legacy_orders' => 1800, 'legacy_days' => 20],
    ['campaign_id' => '1809002', 'campaign_name' => 'LIVE GMV Max', 'campaign_type' => 'LIVE GMV Max', 'legacy_spend' => 6057339, 'legacy_gross' => 70927539, 'legacy_orders' => 800, 'legacy_days' => 20]
];
$mockPdo->setHandler('FROM \`tiktok_campaign_daily_reports\`', $legacyData);

$service = new CommerceAdsIngestionService($mockPdo);
$report = $service->reconcileApiVsLegacy('hadaplus', '2026-09-01', '2026-09-20');

echo json_encode($report);
`;

const recRes = runPhpScript(testReconciliationCode);
assert(recRes.ok, 'PHP executed reconcileApiVsLegacy cleanly', recRes.error);
if (recRes.ok) {
  const rData = JSON.parse(recRes.output);
  assert(rData.status === 'FULL_MATCH', 'Reconciliation reports FULL_MATCH when exact');
  assert(rData.macro_totals.spend.api_value === 20472745, 'Total API spend matches benchmark 20.472.745');
  assert(rData.macro_totals.spend.legacy_value === 20472745, 'Total Legacy spend matches benchmark 20.472.745');
  assert(rData.macro_totals.spend.absolute_variance === 0, 'Spend absolute variance is 0');
  assert(rData.macro_totals.gross_revenue.absolute_variance === 0, 'Gross revenue absolute variance is 0');
  assert(rData.campaign_count === 2, 'Reconciled 2 campaigns');
  assert(rData.campaigns[0].status === 'EXACT_MATCH', 'Campaign 1 status is EXACT_MATCH');
  assert(rData.campaigns[1].status === 'EXACT_MATCH', 'Campaign 2 status is EXACT_MATCH');
}

// -----------------------------------------------------------------------------
// BLOCK H: DASHBOARD API INTEGRATION
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK H: DASHBOARD API INTEGRATION ---');

const dashFile = path.resolve('public', 'api', 'commerce_dashboard.php');
const dashContent = fs.readFileSync(dashFile, 'utf8');

assert(dashContent.includes('reconcile_ads_campaigns'), 'commerce_dashboard.php handles reconcile_ads_campaigns action');
assert(dashContent.includes('reconcile_api_vs_legacy'), 'commerce_dashboard.php handles reconcile_api_vs_legacy alias action');
assert(dashContent.includes('$adsIngestionService->reconcileApiVsLegacy'), 'commerce_dashboard.php invokes reconcileApiVsLegacy');

// -----------------------------------------------------------------------------
// BLOCK I: PROVENANCE SOURCE LINEAGE VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK I: PROVENANCE SOURCE LINEAGE VERIFICATION ---');

const testProvCode = `
require_once 'public/api/commerce_ads_service.php';

$mockPdo = new MockPDO();
$mockPdo->setHandler('SHOW TABLES LIKE', [['table' => 'commerce_ads_campaign_daily']]);
$mockPdo->setHandler('COUNT(*) FROM', [['cnt' => 20]]);
$mockPdo->setHandler('d.campaign_id', []);
$mockPdo->setHandler('stat_date', [['stat_date' => '2026-09-01', 'day_spend' => 100, 'day_gross' => 1000, 'day_orders' => 1]]);
$mockPdo->setHandler('TIKTOK_GMV_MAX_API', [['api_count' => 0, 'backfill_count' => 20]]);

$service = new CommerceAdsService($mockPdo);
$intel = $service->getCampaignIntelligence('hadaplus', '2026-09-01', '2026-09-20');

echo json_encode($intel['provenance'] ?? []);
`;

const provRes = runPhpScript(testProvCode);
assert(provRes.ok, 'PHP executed provenance lineage evaluation cleanly', provRes.error);
if (provRes.ok) {
  const prData = JSON.parse(provRes.output);
  assert(prData.data_source_lineage === 'DAILY_REPORT_BACKFILL', 'Provenance correctly flags legacy data as DAILY_REPORT_BACKFILL', JSON.stringify(prData));
  assert(prData.api_lineage_status === 'DAILY_REPORT_BACKFILL', 'API lineage status is DAILY_REPORT_BACKFILL (not falsely claiming API verified)');
}

// -----------------------------------------------------------------------------
// FINAL SUMMARY
// -----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`FINAL SPRINT V2-02A.2 ACCEPTANCE RESULTS: ${passedTests} / ${passedTests + failedTests} SCENARIOS PASSED`);
console.log('====================================================================');

if (failedTests > 0) {
  console.error(`\n[ERROR] ${failedTests} SCENARIO(S) FAILED.`);
  process.exit(1);
} else {
  console.log('\n[SUCCESS] ALL SPRINT V2-02A.2 OFFICIAL API INGESTION SCENARIOS PASSED CLEANLY (100%)!\n');
}
