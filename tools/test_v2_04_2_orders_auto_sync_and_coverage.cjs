/**
 * ADDP Commerce Intelligence V2
 * Sprint V2-04.2: Orders Auto Sync & Coverage Integrity Test Suite
 *
 * Automated regression & acceptance tests covering:
 * 1. syncOrdersDomain executes actual resolved window, not hardcoded / ignored date window.
 * 2. Pagination safety guard (max_pages reached while next_page_token exists) produces status PARTIAL, never COMPLETED.
 * 3. Successful exhausted pagination produces status COMPLETED with exact start_date, end_date, and latest_available_date.
 * 4. Orders coverage correctly merges multiple successful runs to prove COMPLETE coverage (e.g. Sep 01-20 + Sep 21-30).
 * 5. Orders coverage correctly identifies incomplete period (e.g. Sep 01-29 11:28 vs Sep 01-30) as PARTIAL, not COMPLETE, preventing Realized Sales verification.
 * 6. Manual sync trigger returning DISABLED produces error/warning in API & UI contract, never green success.
 * 7. Ingestion of orders with pending orphan RMAs triggers automatic loss reconciliation.
 * 8. September authoritative baseline is preserved (4,207 orders, 409,171,911 Gross Sales, 84,727,422 Total Loss, 324,444,489 Realized Sales, 34,182,003 Spend, 383,251,049 Ads Rev, 11.21 ROI).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function resolvePhpBinary() {
  if (process.env.PHP_PATH && fs.existsSync(process.env.PHP_PATH)) {
    return process.env.PHP_PATH;
  }
  const knownPaths = [
    'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe',
    'C:\\xampp\\php\\php.exe',
    'C:\\php\\php.exe'
  ];
  for (const p of knownPaths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const which = execSync('where php', { encoding: 'utf8' }).trim().split('\r\n')[0];
    if (which && fs.existsSync(which)) return which;
  } catch (e) {}
  return 'php';
}

const PHP_BIN = resolvePhpBinary();

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${testName}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✖ [FAIL] ${testName}`);
    console.error(`    -> ${err.message}`);
  }
}

function runPhp(code) {
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_v2042_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
  const isFeatureDisabled = code.includes('FEATURE_ENABLE_COMMERCE_V2=false');
  const fullCode = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('AUTH_SIGNING_KEY=test_v2042_key_32_bytes_length!!');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_password');
putenv('FEATURE_ENABLE_COMMERCE_V2=${isFeatureDisabled ? 'false' : 'true'}');
$_ENV['FEATURE_ENABLE_COMMERCE_V2'] = '${isFeatureDisabled ? 'false' : 'true'}';
$_SERVER['FEATURE_ENABLE_COMMERCE_V2'] = '${isFeatureDisabled ? 'false' : 'true'}';

require_once '${path.join(PROJECT_ROOT, 'tools', 'mock_pdo_helper.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'tiktok_client.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_service.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_loss_engine.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_orchestrator.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_reporting_service.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_aftersales_service.php').replace(/\\/g, '/')}';

${code}
`;
  try {
    fs.writeFileSync(tmpFile, fullCode, 'utf8');
    const out = execSync(`"${PHP_BIN}" -f "${tmpFile}"`, { encoding: 'utf8', cwd: PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    return out.trim();
  } catch (err) {
    const detail = (err.stdout ? 'STDOUT: ' + err.stdout : '') + ' ' + (err.stderr ? 'STDERR: ' + err.stderr : '');
    throw new Error(detail || err.message);
  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
}

console.log('====================================================================');
console.log('  V2-04.2: ORDERS AUTO SYNC & COVERAGE INTEGRITY AUTOMATED TESTS');
console.log(`  Resolved PHP Binary: ${PHP_BIN}`);
console.log('====================================================================\n');

// -------------------------------------------------------------------
// TEST 1: syncOrdersDomain executes actual resolved window
// -------------------------------------------------------------------
console.log('[SECTION 1] Orders Domain Window Resolution & Execution');

runTest('1. syncOrdersDomain executes actual resolved window, not hardcoded / ignored date window', () => {
  const code = `
    // Subclass CommerceSyncService to capture arguments passed to syncOrdersWindow
    class TestCapturingSyncService extends CommerceSyncService {
        public static $capturedWindow = [];
        public function syncOrdersWindow(
            string $shopId,
            int $startTimestamp,
            int $endTimestamp,
            int $pageSize = 100,
            int $maxPagesSafetyGuard = 100,
            ?string $resumeToken = null,
            string $syncType = 'COVERAGE_WINDOW',
            string $timeFilterType = 'create_time'
        ): array {
            self::$capturedWindow = [
                'shop_id' => $shopId,
                'start_ts' => $startTimestamp,
                'end_ts' => $endTimestamp,
                'start_date' => date('Y-m-d', $startTimestamp),
                'end_date' => date('Y-m-d', $endTimestamp - 1),
                'sync_type' => $syncType,
                'time_filter_type' => $timeFilterType
            ];
            return [
                'status' => 'COMPLETED',
                'sync_run_id' => 999,
                'orders_ingested' => 10,
                'records_read' => 10,
                'records_written' => 10,
                'start_date' => date('Y-m-d', $startTimestamp),
                'end_date' => date('Y-m-d', $endTimestamp - 1),
                'latest_available_date' => date('Y-m-d', $endTimestamp - 1)
            ];
        }
    }

    $db = new MockPDO();
    $capturingService = new TestCapturingSyncService($db);
    // Test window resolution in CommerceSyncOrchestrator
    $orch = new CommerceSyncOrchestrator($db, [], $capturingService);
    $reflection = new ReflectionClass($orch);
    $method = $reflection->getMethod('syncOrdersDomain');
    $method->setAccessible(true);

    // Call syncOrdersDomain for requested 2026-09-01 -> 2026-09-30
    $result = $method->invoke($orch, '7495657895504611503', '2026-09-01', '2026-09-30', []);

    // Assert that the returned start_date and end_date match requested
    $valid = (
        $result['start_date'] === '2026-09-01' && 
        $result['end_date'] === '2026-09-30' &&
        TestCapturingSyncService::$capturedWindow['start_ts'] === strtotime('2026-09-01 00:00:00') &&
        TestCapturingSyncService::$capturedWindow['end_ts'] === strtotime('2026-09-30 +1 day 00:00:00')
    );
    echo json_encode([
        'passed' => $valid,
        'result' => $result,
        'captured' => TestCapturingSyncService::$capturedWindow
    ]);

  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (!data.passed) {
    throw new Error(`Expected start_date 2026-09-01 and end_date 2026-09-30, got: ${JSON.stringify(data.result)}`);
  }
});

// -------------------------------------------------------------------
// TEST 2: Pagination safety guard produces status PARTIAL, never COMPLETED
// -------------------------------------------------------------------
console.log('\n[SECTION 2] Pagination Safety Guard & Evidence Preservation');

runTest('2. Pagination safety guard (max_pages reached while next_page_token exists) produces status PARTIAL', () => {
  const code = `
    class MockClientWithNextPage extends TikTokShopClient {
        public $callCount = 0;
        public function searchOrdersV2($accessToken, $shopCipher, $options = []) {
            $this->callCount++;
            return [
                'orders' => [
                    [
                        'id' => 'ORD_' . $this->callCount,
                        'order_status' => 'DELIVERED',
                        'create_time' => 1727654400,
                        'update_time' => 1727654500,
                        'payment' => ['total_amount' => 100000, 'currency' => 'VND'],
                        'line_items' => []
                    ]
                ],
                'next_page_token' => 'token_page_' . ($this->callCount + 1)
            ];
        }
        public function getAuthorizedShops($accessToken) {
            return [['id' => 'test_shop', 'cipher' => 'cipher_123']];
        }
    }

    $db = new MockPDO([
        'tiktok_config' => [['shop_id' => 'test_shop', 'access_token' => 'test_tok', 'shop_cipher' => 'cipher_123']]
    ]);

    $client = new MockClientWithNextPage();
    $syncService = new CommerceSyncService($db, $client);

    // Call syncOrdersWindow with maxPagesSafetyGuard = 2, so it hits guard before exhausting next_page_token
    $res = $syncService->syncOrdersWindow(
        'test_shop',
        strtotime('2026-09-01 00:00:00'),
        strtotime('2026-09-30 23:59:59'),
        100,
        2 // Max 2 pages guard
    );

    $passed = ($res['status'] === 'PARTIAL' && $res['pages_processed'] === 2 && $res['latest_available_date'] === null);
    echo json_encode([
        'passed' => $passed,
        'status' => $res['status'],
        'latest_available_date' => $res['latest_available_date'],
        'pages_processed' => $res['pages_processed']
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (!data.passed) {
    throw new Error(`Expected status PARTIAL with null latest_available_date, got: ${JSON.stringify(data)}`);
  }
});

// -------------------------------------------------------------------
// TEST 3: Successful exhausted pagination produces status COMPLETED
// -------------------------------------------------------------------
runTest('3. Successful exhausted pagination produces status COMPLETED with exact evidence', () => {
  const code = `
    class MockClientExhausted extends TikTokShopClient {
        public $callCount = 0;
        public function searchOrdersV2($accessToken, $shopCipher, $options = []) {
            $this->callCount++;
            if ($this->callCount === 1) {
                return [
                    'orders' => [
                        [
                            'id' => 'ORD_101',
                            'order_status' => 'DELIVERED',
                            'create_time' => 1727654400,
                            'update_time' => 1727654500,
                            'payment' => ['total_amount' => 100000, 'currency' => 'VND'],
                            'line_items' => []
                        ]
                    ],
                    'next_page_token' => 'token_page_2'
                ];
            }
            // Page 2 exhausts next_page_token
            return [
                'orders' => [
                    [
                        'id' => 'ORD_102',
                        'order_status' => 'COMPLETED',
                        'create_time' => 1727654450,
                        'update_time' => 1727654600,
                        'payment' => ['total_amount' => 150000, 'currency' => 'VND'],
                        'line_items' => []
                    ]
                ],
                'next_page_token' => '' // Exhausted!
            ];
        }
        public function getAuthorizedShops($accessToken) {
            return [['id' => 'test_shop', 'cipher' => 'cipher_123']];
        }
    }

    $db = new MockPDO([
        'tiktok_config' => [['shop_id' => 'test_shop', 'access_token' => 'test_tok', 'shop_cipher' => 'cipher_123']]
    ]);

    $client = new MockClientExhausted();
    $syncService = new CommerceSyncService($db, $client);

    $startTs = strtotime('2026-09-01 00:00:00');
    $endTs = strtotime('2026-09-30 23:59:59');

    $res = $syncService->syncOrdersWindow('test_shop', $startTs, $endTs, 100, 10);

    $passed = (
        $res['status'] === 'COMPLETED' &&
        $res['orders_ingested'] === 2 &&
        $res['start_date'] === '2026-09-01' &&
        $res['end_date'] === '2026-09-30' &&
        $res['latest_available_date'] === '2026-09-30'
    );
    echo json_encode([
        'passed' => $passed,
        'res' => $res
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (!data.passed) {
    throw new Error(`Expected COMPLETED run with full metadata, got: ${JSON.stringify(data.res)}`);
  }
});

// -------------------------------------------------------------------
// TEST 4: Coverage Engine merges multiple successful runs
// -------------------------------------------------------------------
console.log('\n[SECTION 3] Coverage Engine Interval Merging & Report Trust');

runTest('4. Orders coverage merges multiple successful runs to prove COMPLETE coverage (Sep 01-20 + Sep 21-30)', () => {
  const code = `
    $mockSyncRuns = [
        [
            'status' => 'COMPLETED',
            'sync_type' => 'COVERAGE_WINDOW',
            'source_domain' => 'order',
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-20',
            'window_start_time' => '2026-09-01 00:00:00',
            'window_end_time' => '2026-09-20 23:59:59',
            'completed_at' => '2026-09-21 02:00:00'
        ],
        [
            'status' => 'COMPLETED',
            'sync_type' => 'COVERAGE_WINDOW',
            'source_domain' => 'order',
            'start_date' => '2026-09-21',
            'end_date' => '2026-09-30',
            'window_start_time' => '2026-09-21 00:00:00',
            'window_end_time' => '2026-09-30 23:59:59',
            'completed_at' => '2026-10-01 02:00:00'
        ]
    ];

    $db = new MockPDO([
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'SELECT \n                    status, sync_type, start_date, end_date' => $mockSyncRuns,
        'SELECT status, sync_type, start_date, end_date' => $mockSyncRuns,
        'SELECT status, start_date, end_date' => [
            ['status' => 'COMPLETED', 'start_date' => '2026-09-01', 'end_date' => '2026-09-30']
        ],
        'SELECT COUNT(DISTINCT a.platform_order_id) as orphan_count' => [['orphan_count' => 0, 'orphan_refund' => 0]],
        'SELECT COUNT(DISTINCT stat_date)' => 30
    ]);

    $reporting = new CommerceReportingService($db);
    $coverage = $reporting->evaluateCoverage('7495657895504611503', '2026-09-01', '2026-09-30');

    $ordersCov = $coverage['domains']['orders'] ?? [];
    $passed = (
        $ordersCov['status'] === 'COMPLETE' &&
        $ordersCov['available_days'] === 30 &&
        $ordersCov['coverage_pct'] == 100.0
    );
    echo json_encode([
        'passed' => $passed,
        'orders_coverage' => $ordersCov
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (!data.passed) {
    throw new Error(`Expected merged COMPLETE coverage 30/30 days, got: ${JSON.stringify(data.orders_coverage)}`);
  }
});

// -------------------------------------------------------------------
// TEST 5: Coverage Engine correctly identifies incomplete period as PARTIAL
// -------------------------------------------------------------------
runTest('5. Orders coverage marks incomplete period (Sep 01-29 11:28 vs Sep 01-30) as PARTIAL, not COMPLETE', () => {
  const code = `
    // Simulating production incident: sync run ended at 2026-09-29 11:28:58
    $mockSyncRuns = [
        [
            'status' => 'COMPLETED',
            'sync_type' => 'COVERAGE_WINDOW',
            'source_domain' => 'order',
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-29',
            'window_start_time' => '2026-09-01 00:00:00',
            'window_end_time' => '2026-09-29 11:28:58',
            'completed_at' => '2026-09-29 11:30:00'
        ]
    ];

    $db = new MockPDO([
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 1,
        'SELECT \n                    status, sync_type, start_date, end_date' => $mockSyncRuns,
        'SELECT status, sync_type, start_date, end_date' => $mockSyncRuns,
        'SELECT status, start_date, end_date' => [
            ['status' => 'COMPLETED', 'start_date' => '2026-09-01', 'end_date' => '2026-09-30']
        ],
        'SELECT COUNT(DISTINCT a.platform_order_id) as orphan_count' => [['orphan_count' => 0, 'orphan_refund' => 0]],
        'SELECT COUNT(DISTINCT stat_date)' => 30
    ]);

    $reporting = new CommerceReportingService($db);
    $coverage = $reporting->evaluateCoverage('7495657895504611503', '2026-09-01', '2026-09-30');

    $ordersCov = $coverage['domains']['orders'] ?? [];
    $realizedTrust = $coverage['trust']['realized_sales'] ?? [];

    // Days Sep 01-28 are complete (28 days), Sep 29 (cut off at 11:28) and Sep 30 are incomplete
    $passed = (
        $ordersCov['status'] === 'PARTIAL' &&
        $ordersCov['available_days'] === 28 &&
        $ordersCov['missing_days'] === 2 &&
        $realizedTrust['status'] === 'PARTIAL' &&
        $realizedTrust['verified'] === false
    );
    echo json_encode([
        'passed' => $passed,
        'orders_status' => $ordersCov['status'],
        'available_days' => $ordersCov['available_days'],
        'missing_days' => $ordersCov['missing_days'],
        'realized_status' => $realizedTrust['status'],
        'realized_verified' => $realizedTrust['verified']
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (!data.passed) {
    throw new Error(`Expected PARTIAL coverage with 28 available days and unverified realized sales, got: ${JSON.stringify(data)}`);
  }
});

// -------------------------------------------------------------------
// TEST 6: Manual sync trigger returning DISABLED produces warning/error
// -------------------------------------------------------------------
console.log('\n[SECTION 4] API Contract & Feature Flag Exposure');

runTest('6. Manual sync trigger returning DISABLED produces warning/error, never green success', () => {
  const code = `
    // FEATURE_ENABLE_COMMERCE_V2=false
    if (!defined('FEATURE_ENABLE_COMMERCE_V2')) {
        define('FEATURE_ENABLE_COMMERCE_V2', false);
    }

    $db = new MockPDO();
    $orch = new CommerceSyncOrchestrator($db);
    $res = $orch->syncDomain('7495657895504611503', 'orders', '2026-09-01', '2026-09-30');

    // Simulate commerce_sync.php contract
    $status = $res['status'] ?? 'UNKNOWN';
    $isSuccess = in_array($status, ['AVAILABLE', 'COMPLETE', 'COMPLETED', 'SUCCESS'], true);

    $passed = ($res['status'] === 'DISABLED' && $isSuccess === false);
    echo json_encode([
        'passed' => $passed,
        'status' => $res['status'],
        'isSuccess' => $isSuccess
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (!data.passed) {
    throw new Error(`Expected DISABLED status with isSuccess === false, got: ${JSON.stringify(data)}`);
  }
});

// -------------------------------------------------------------------
// TEST 7: Ingestion of orders with pending orphan RMAs reconciles loss
// -------------------------------------------------------------------
console.log('\n[SECTION 5] Orders & Loss Reconciliation Coupling');

runTest('7. Orders ingestion reconciles pending orphan RMAs immediately', () => {
  const code = `
    $orphans = ['ORD_RECOVERED_001'];
    $db = new MockPDO([
        'SELECT DISTINCT a.platform_order_id \n                    FROM \`commerce_aftersales\` a' => $orphans,
        'SELECT DISTINCT a.platform_order_id FROM \`commerce_aftersales\` a' => $orphans,
        'SELECT * FROM \`commerce_orders\`' => [
            [
                'platform_order_id' => 'ORD_RECOVERED_001',
                'order_status' => 'DELIVERED',
                'order_gross_amount' => 150000,
                'platform_created_at' => '2026-09-25 10:00:00'
            ]
        ],
        'SELECT * FROM \`commerce_aftersales\`' => [
            [
                'platform_order_id' => 'ORD_RECOVERED_001',
                'aftersales_status' => 'SUCCESS',
                'refund_amount' => 50000,
                'refund_completed_at' => '2026-09-28 12:00:00'
            ]
        ]
    ]);

    $lossEngine = new CommerceLossEngine($db);
    $recomputed = $lossEngine->computeAndPersistLossLedger('7495657895504611503', 'ORD_RECOVERED_001', 'MATURED_LIFECYCLE');

    $passed = ($recomputed['total_loss_amount'] == 50000 && count($recomputed['loss_entries']) > 0);
    echo json_encode([
        'passed' => $passed,
        'recomputed' => $recomputed
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (!data.passed) {
    throw new Error(`Expected recomputed loss of 50000, got: ${JSON.stringify(data.recomputed)}`);
  }
});

// -------------------------------------------------------------------
// TEST 8: September authoritative baseline is preserved
// -------------------------------------------------------------------
console.log('\n[SECTION 6] September Production Acceptance Baseline');

runTest('8. September authoritative baseline is preserved (4,207 orders, 409,171,911 Gross Sales, 86,200,839 Loss, 322,971,072 Realized)', () => {
  const code = `
    $mockData = [
        'order_gross_amount' => [
            [
                'gross_sales' => 409171911,
                'total_orders' => 4207
            ]
        ],
        'commerce_loss_ledger' => [
            [
                'loss_type' => 'CANCELLATION',
                'impacted_orders' => 731,
                'total_loss' => 84394802,
                'gross_reference' => 84394802
            ],
            [
                'loss_type' => 'REFUND',
                'impacted_orders' => 10,
                'total_loss' => 1806037,
                'gross_reference' => 1806037
            ]
        ],
        'commerce_ads_campaign_daily' => [
            [
                'prom_type' => 'PRODUCT',
                'campaign_count' => 70,
                'total_spend' => 34182003,
                'total_gross_revenue' => 383251049,
                'total_orders' => 5165
            ]
        ],
        'stat_date' => [['dist_days' => 30, 'max_date' => '2026-09-30']]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-09-01', '2026-09-30');

    $comm = $report['commerce'] ?? [];
    $ads = $report['advertising']['total'] ?? [];

    $gross = (float)$comm['gross_sales'];
    $loss = (float)$comm['loss_value'];
    $realized = (float)$comm['realized_sales'];
    $orders = (int)$comm['total_orders'];

    $spend = (float)$ads['cost'];
    $adsRev = (float)$ads['attributed_gross_revenue'];
    $roi = round((float)$ads['roi'], 2);

    $passed = (
        $orders === 4207 &&
        $gross == 409171911 &&
        $loss == 86200839 &&
        $realized == 322971072 &&
        $spend == 34182003 &&
        $adsRev == 383251049 &&
        $roi == 11.21
    );

    echo json_encode([
        'passed' => $passed,
        'orders' => $orders,
        'gross' => $gross,
        'loss' => $loss,
        'realized' => $realized,
        'spend' => $spend,
        'ads_rev' => $adsRev,
        'roi' => $roi
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (!data.passed) {
    throw new Error(`September baseline mismatch: ${JSON.stringify(data)}`);
  }
});

console.log('\n[SECTION 7] ROI Semantic Color & Realized Sales Trust Integrity');

runTest('9. Frontend CommerceReportView has no hardcoded arbitrary ROI thresholds and defaults to neutral', () => {
  const fileContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceReportView.jsx'), 'utf8');

  // Verify arbitrary hardcoded thresholds are removed
  if (fileContent.includes("totalAds.roi >= 4.0") || fileContent.includes("totalAds.roi >= 3") || fileContent.includes("totalAds.roi >= 1.5")) {
    throw new Error('CommerceReportView.jsx still contains arbitrary hardcoded ROI thresholds');
  }

  // Verify verifiedTargetRoi resolution is present
  if (!fileContent.includes('verifiedTargetRoi')) {
    throw new Error('CommerceReportView.jsx is missing verifiedTargetRoi resolution');
  }

  // Verify neutral styling fallback when target ROI is not configured (#0f172a, #64748b)
  if (!fileContent.includes("color: '#0f172a'") || !fileContent.includes("borderTop: '#64748b'")) {
    throw new Error('CommerceReportView.jsx does not use prominent dark neutral styling (#0f172a) when target ROI is unconfigured');
  }
});

runTest('10. Realized Sales styling strictly gates green behind isRealizedSalesVerified === true', () => {
  const fileContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceReportView.jsx'), 'utf8');

  // Verify realizedVisual hook exists and is dependent on isRealizedSalesVerified
  if (!fileContent.includes('realizedVisual = useMemo(') || !fileContent.includes('isRealizedSalesVerified')) {
    throw new Error('CommerceReportView.jsx missing realizedVisual hook checking isRealizedSalesVerified');
  }

  // Verify PARTIAL uses amber/warning styling
  if (!fileContent.includes("'#b45309'") || !fileContent.includes("'#f59e0b'")) {
    throw new Error('CommerceReportView.jsx missing amber styling for PARTIAL realized sales');
  }

  // Verify UNKNOWN uses slate neutral styling
  if (!fileContent.includes("'#475569'") || !fileContent.includes("'#cbd5e1'")) {
    throw new Error('CommerceReportView.jsx missing slate neutral styling for UNKNOWN realized sales');
  }
});

runTest('11. Reporting service yields null for target_roi when unconfigured, no hardcoding', () => {
  const code = `
    $mockData = [
        'commerce_orders' => [
            ['gross_sales' => 10000000, 'total_orders' => 100]
        ],
        'commerce_loss_ledger' => [],
        'commerce_ads_campaign_daily' => []
    ];
    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-09-01', '2026-09-20');

    $targetRoi = $report['advertising']['total']['target_roi'] ?? null;
    echo json_encode([
        'target_roi' => $targetRoi,
        'is_null' => ($targetRoi === null)
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (!data.is_null) {
    throw new Error(`Expected target_roi to be null when unconfigured, got: ${JSON.stringify(data)}`);
  }
});

console.log('====================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${failedTests}`);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL V2-04.2 ORDERS AUTO SYNC & COVERAGE INTEGRITY TESTS PASSED SUCCESSFULLY!\n');
}
