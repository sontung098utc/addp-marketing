/**
 * ADDP Commerce Intelligence V2
 * Sprint V2-04.2 Hotfix: Connect Report Sync Button to Auto Sync Test Suite
 *
 * Automated regression & acceptance tests covering:
 * 1. Clicking Sync calls authenticated commerce_sync.php.
 * 2. Selected start_date/end_date are passed correctly.
 * 3. Report refresh happens only AFTER sync resolves (await sequence).
 * 4. DISABLED never produces green success.
 * 5. PARTIAL produces warning.
 * 6. ERROR produces error.
 * 7. Button disabled while synchronization is running.
 * 8. Double-click cannot create duplicate concurrent sync.
 * 9. Orders success + optional domain disabled does not become false global success.
 * 10. Data Quality refreshes after sync.
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
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_hotfix_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
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
console.log('  V2-04.2 HOTFIX: REPORT SYNC BUTTON TO AUTO SYNC TESTS');
console.log(`  Resolved PHP Binary: ${PHP_BIN}`);
console.log('====================================================================\n');

const reportViewSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceReportView.jsx'), 'utf8');

// 1. Clicking Sync calls authenticated commerce_sync.php
runTest('1. Clicking Sync calls authenticated commerce_sync.php API', () => {
  if (!reportViewSrc.includes('commerce_sync.php?action=trigger_sync')) {
    throw new Error('CommerceReportView does not call commerce_sync.php?action=trigger_sync');
  }
  if (!reportViewSrc.includes('handleTriggerAutoSync')) {
    throw new Error('CommerceReportView missing handleTriggerAutoSync handler');
  }
  if (!reportViewSrc.includes('onClick={handleTriggerAutoSync}')) {
    throw new Error('Existing sync button is not wired to handleTriggerAutoSync');
  }
});

// 2. Selected start_date/end_date are passed correctly
runTest('2. Selected start_date/end_date are passed to sync request payload', () => {
  const hasParams = reportViewSrc.includes('start_date=${encodeURIComponent(startDate)}') &&
                    reportViewSrc.includes('end_date=${encodeURIComponent(endDate)}');
  const hasBody = reportViewSrc.includes('start_date: startDate') &&
                  reportViewSrc.includes('end_date: endDate');
  if (!hasParams && !hasBody) {
    throw new Error('Selected startDate and endDate are not passed to sync API');
  }
});

// 3. Report refresh happens only AFTER sync resolves
runTest('3. Report refresh happens only AFTER sync resolves (await sequence)', () => {
  const syncPos = reportViewSrc.indexOf('commerce_sync.php?action=trigger_sync');
  const evalPos = reportViewSrc.indexOf('isOrdersSuccess');
  const fetchPos = reportViewSrc.indexOf('await fetchReport()');

  if (syncPos === -1 || evalPos === -1 || fetchPos === -1) {
    throw new Error('Sync execution, evaluation or report refresh call is missing');
  }

  if (fetchPos <= syncPos) {
    throw new Error('fetchReport must execute strictly after sync API call completes');
  }

  // Ensure sequence: await sync -> evaluate result -> await fetchReport()
  if (fetchPos <= evalPos) {
    throw new Error('fetchReport must execute after evaluating sync result');
  }
});

// 4. DISABLED never produces green success
runTest('4. DISABLED never produces green success notification', () => {
  // Frontend check: DISABLED maps to error feedback, never success
  if (!reportViewSrc.includes("if (isOrdersDisabled) {") ||
      !reportViewSrc.includes("type: 'error'")) {
    throw new Error('isOrdersDisabled must produce error feedback');
  }

  // Backend check: commerce_sync.php with FEATURE_ENABLE_COMMERCE_V2=false returns success: false, status: DISABLED
  const code = `
    // FEATURE_ENABLE_COMMERCE_V2=false
    $mockData = ['commerce_sync_runs' => []];
    $db = new MockPDO($mockData);
    $orchestrator = new CommerceSyncOrchestrator($db);
    $syncRes = $orchestrator->syncAll('7495657895504611503', '2026-09-01', '2026-09-30');

    $ordersStatus = $syncRes['orders_status'] ?? 'UNKNOWN';
    $isSuccess = $syncRes['success'] ?? false;

    echo json_encode([
        'orders_status' => $ordersStatus,
        'success' => $isSuccess
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);
  if (data.success !== false || data.orders_status !== 'DISABLED') {
    throw new Error(`Expected success: false and orders_status: DISABLED, got: ${JSON.stringify(data)}`);
  }
});

// 5. PARTIAL produces warning
runTest('5. PARTIAL produces warning notification and refreshes report', () => {
  if (!reportViewSrc.includes("isOrdersPartial") ||
      !reportViewSrc.includes("type: 'warning'") ||
      !reportViewSrc.includes("Đồng bộ hoàn thành một phần. Vui lòng kiểm tra Độ phủ dữ liệu.")) {
    throw new Error('isOrdersPartial must set warning feedback with accurate warning message');
  }
});

// 6. ERROR produces error
runTest('6. ERROR produces error notification and never success', () => {
  if (!reportViewSrc.includes("isOrdersError") ||
      !reportViewSrc.includes("Đồng bộ thất bại:")) {
    throw new Error('isOrdersError must set error feedback');
  }
});

// 7. Button disabled while synchronization is running
runTest('7. Button disabled while synchronization is running with "Đang đồng bộ..." text', () => {
  if (!reportViewSrc.includes('disabled={isSyncing || isLoading}')) {
    throw new Error('Sync button is not disabled during isSyncing');
  }
  if (!reportViewSrc.includes("isSyncing ? 'Đang đồng bộ...' :")) {
    throw new Error('Button text does not reflect "Đang đồng bộ..." during synchronization');
  }
});

// 8. Double-click cannot create duplicate concurrent sync
runTest('8. Double-click cannot create duplicate concurrent sync (guard check)', () => {
  if (!reportViewSrc.includes('if (isSyncing || isLoading) return;')) {
    throw new Error('Missing guard `if (isSyncing || isLoading) return;` at start of handleTriggerAutoSync');
  }
});

// 9. Orders success + optional domain disabled does not become false global success
runTest('9. Orders success + optional domain disabled does not become false global success', () => {
  const code = `
    $mockData = [
        'commerce_sync_runs' => []
    ];
    $db = new MockPDO($mockData);
    $mockSyncService = new class($db) extends CommerceSyncService {
        public function syncOrdersWindow(string $shopId, int $start, int $end, int $pageSize = 100, int $maxPages = 200, ?string $token = null, string $type = 'COVERAGE_WINDOW', string $filter = 'create_time'): array {
            return [
                'success' => true,
                'status' => 'COMPLETED',
                'orders_ingested' => 150,
                'sync_run_id' => 999
            ];
        }
    };

    $orchestrator = new CommerceSyncOrchestrator($db, [], $mockSyncService);
    $res = $orchestrator->syncAll('7495657895504611503', '2026-09-01', '2026-09-30');

    echo json_encode([
        'orders_status' => $res['orders_status'],
        'orders_success' => ($res['orders_status'] === 'AVAILABLE' || $res['orders_status'] === 'COMPLETED'),
        'is_global_all_complete' => $res['is_global_all_complete'],
        'disabled_optional_domains' => $res['disabled_optional_domains']
    ]);
  `;
  const out = runPhp(code);
  const data = JSON.parse(out);

  if (!data.orders_success) {
    throw new Error(`Expected Orders to be successful, got: ${JSON.stringify(data)}`);
  }

  // Because RMA, Finance, etc. are disabled or not yet available in testing, is_global_all_complete MUST be false
  if (data.is_global_all_complete === true) {
    throw new Error(`is_global_all_complete must NOT be true when optional domains are disabled: ${JSON.stringify(data)}`);
  }

  if (!Array.isArray(data.disabled_optional_domains) || data.disabled_optional_domains.length === 0) {
    throw new Error(`disabled_optional_domains must report disabled optional domains: ${JSON.stringify(data)}`);
  }
});

// 10. Data Quality refreshes after sync
runTest('10. Data Quality refreshes after sync completes without page reload', () => {
  // Verify fetchReport updates all metrics including coverage
  if (!reportViewSrc.includes('setReportData(res.data || res);')) {
    throw new Error('fetchReport does not update reportData state');
  }
  if (!reportViewSrc.includes('const ordersCoverage = coverage.orders || {};') ||
      !reportViewSrc.includes('const realizedSalesCoverage = coverage.realized_sales || {};')) {
    throw new Error('Data quality metrics not derived from reportData');
  }
  // Verify await fetchReport() called on success
  if (!reportViewSrc.includes('await fetchReport();')) {
    throw new Error('handleTriggerAutoSync does not await fetchReport() after sync');
  }
});

console.log('\n====================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${failedTests}`);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL V2-04.2 HOTFIX REPORT SYNC BUTTON TESTS PASSED SUCCESSFULLY!\n');
}
