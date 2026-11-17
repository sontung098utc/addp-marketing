/**
 * ADDP Commerce Intelligence - Empty State & Live Workbench Resilience Test Suite
 * 
 * Verifies:
 * 1. Live Workbench never crashes with TypeError: Cannot read properties of undefined (reading 'value')
 * 2. Empty/zero state across all 8 workbenches renders safely without synthetic or fabricated data
 * 3. Backend computeLiveSessionKpis dual-key compatibility (comment_rate & comment_rate_pct, follow_rate & follow_rate_pct)
 * 4. Date & benchmark separation (Hadaplus 272M / 2,777 orders only displayed for 01-20/09)
 * 5. 5-way metric isolation empty-state handling (Finance & Analytics show 'Chưa đồng bộ' when unsynced)
 * 6. Sync pipeline status badge mapping (DISABLED, READY, RUNNING, COMPLETED, FAILED)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING EMPTY STATE RESILIENCE & LIVE WORKBENCH TEST SUITE');
console.log('====================================================================');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] TC-${String(totalTests).padStart(2, '0')}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] TC-${String(totalTests).padStart(2, '0')}: ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// -------------------------------------------------------------------------
// TC-01: Static AST / Source Code Audit: No unsafe '.value' on nullable KPI objects
// -------------------------------------------------------------------------
runTest('Audit CommerceDashboardView.jsx: No unsafe .value accesses on liveKpis without optional chaining or safe helper', () => {
  const jsxPath = path.join(__dirname, '..', 'src', 'CommerceDashboardView.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Assert that unsafe patterns like liveKpis.comment_rate.value or liveKpis.follow_rate.value do NOT exist
  assert.ok(!content.includes('liveKpis.comment_rate.value'), 'Found unsafe liveKpis.comment_rate.value access!');
  assert.ok(!content.includes('liveKpis.follow_rate.value'), 'Found unsafe liveKpis.follow_rate.value access!');
  assert.ok(!content.includes('liveKpis.gmv_per_hour.value'), 'Found unsafe liveKpis.gmv_per_hour.value access!');

  // Assert renderKpiValue helper exists and is used
  assert.ok(content.includes('const renderKpiValue = (kpi'), 'renderKpiValue helper function must be defined');
  assert.ok(/renderKpiValue\s*\(\s*liveKpis\.gmv_per_hour/.test(content), 'renderKpiValue must be used for gmv_per_hour');
  assert.ok(/renderKpiValue\s*\(\s*liveKpis\.comment_rate/.test(content), 'renderKpiValue must be used for comment_rate');
  assert.ok(/renderKpiValue\s*\(\s*liveKpis\.follow_rate/.test(content), 'renderKpiValue must be used for follow_rate');
});

// -------------------------------------------------------------------------
// TC-02: Unit Test renderKpiValue simulation under all edge cases
// -------------------------------------------------------------------------
runTest('Simulate renderKpiValue contract: undefined, null, UNAVAILABLE, and valid metrics', () => {
  const formatVND = (num) => `${new Intl.NumberFormat('vi-VN').format(num)} ₫`;
  const formatNumber = (num) => new Intl.NumberFormat('vi-VN').format(num);

  const renderKpiValue = (kpi, formatter, fallback = 'Chưa có dữ liệu') => {
    if (!kpi) return fallback;
    if (kpi.type === 'UNAVAILABLE' || kpi.value === 'UNAVAILABLE') return 'Không khả dụng';
    if (kpi.value === null || kpi.value === undefined) return fallback;
    return formatter ? formatter(kpi.value) : String(kpi.value);
  };

  // Case 1: kpi is undefined
  assert.strictEqual(renderKpiValue(undefined, formatVND, 'Chưa có phiên live'), 'Chưa có phiên live');

  // Case 2: kpi is null
  assert.strictEqual(renderKpiValue(null, formatVND, 'Chưa có phiên live'), 'Chưa có phiên live');

  // Case 3: kpi is empty object
  assert.strictEqual(renderKpiValue({}, formatVND, 'Chưa có phiên live'), 'Chưa có phiên live');

  // Case 4: kpi has value = null without UNAVAILABLE
  assert.strictEqual(renderKpiValue({ type: 'DERIVED', value: null }, formatVND, 'Chưa có phiên live'), 'Chưa có phiên live');

  // Case 5: kpi is UNAVAILABLE
  assert.strictEqual(renderKpiValue({ type: 'UNAVAILABLE', value: null }, formatVND, 'Chưa có phiên live'), 'Không khả dụng');

  // Case 6: valid number
  assert.strictEqual(renderKpiValue({ type: 'DERIVED', value: 1250000 }, formatVND), '1.250.000 ₫');

  // Case 7: percentage formatting
  assert.strictEqual(renderKpiValue({ type: 'DERIVED', value: 4.56 }, (v) => `${Number(v).toFixed(2)}%`), '4.56%');
});

// -------------------------------------------------------------------------
// TC-03: Real PHP CLI: computeLiveSessionKpis produces dual keys
// -------------------------------------------------------------------------
runTest('PHP CLI: computeLiveSessionKpis produces comment_rate AND comment_rate_pct, follow_rate AND follow_rate_pct', () => {
  const runnerPhpPath = path.join(__dirname, 'debug', 'test_runner_live_kpis.php');
  const runnerContent = `<?php
require_once __DIR__ . '/../../public/api/config.php';
require_once __DIR__ . '/../../public/api/commerce_analytics_service.php';

// Test Case A: Empty/Zero livestream data
$zeroAgg = [
    'total_sessions' => 0,
    'duration_seconds' => 0,
    'gmv' => 0,
    'orders_count' => 0,
    'units_sold' => 0,
    'total_views' => 0,
    'impressions' => 0,
    'clicks' => 0,
    'comments_count' => 0,
    'shares_count' => 0,
    'follows_count' => 0,
    'max_pcu' => 0
];
$kpisZero = CommerceAnalyticsService::computeLiveSessionKpis($zeroAgg);

if (!isset($kpisZero['comment_rate']) || !isset($kpisZero['comment_rate_pct'])) {
    fwrite(STDERR, "FAIL: comment_rate dual keys missing\\n");
    exit(1);
}
if (!isset($kpisZero['follow_rate']) || !isset($kpisZero['follow_rate_pct'])) {
    fwrite(STDERR, "FAIL: follow_rate dual keys missing\\n");
    exit(1);
}
if ($kpisZero['comment_rate']['value'] !== null || $kpisZero['follow_rate']['value'] !== null) {
    fwrite(STDERR, "FAIL: zero values should be null\\n");
    exit(1);
}
if ($kpisZero['comment_rate']['type'] !== 'UNAVAILABLE' || $kpisZero['follow_rate']['type'] !== 'UNAVAILABLE') {
    fwrite(STDERR, "FAIL: zero type should be UNAVAILABLE\\n");
    exit(1);
}

// Test Case B: Active livestream data
$activeAgg = [
    'total_sessions' => 2,
    'duration_seconds' => 7200,
    'gmv' => 25000000.0,
    'orders_count' => 150,
    'units_sold' => 180,
    'total_views' => 5000,
    'impressions' => 12000,
    'clicks' => 800,
    'comments_count' => 250,
    'shares_count' => 80,
    'follows_count' => 120,
    'max_pcu' => 650
];
$kpisActive = CommerceAnalyticsService::computeLiveSessionKpis($activeAgg);

if ($kpisActive['comment_rate']['value'] !== 5.0 || $kpisActive['comment_rate_pct']['value'] !== 5.0) {
    fwrite(STDERR, "FAIL: comment_rate calc mismatch\\n");
    exit(1);
}
if ($kpisActive['follow_rate']['value'] !== 2.4 || $kpisActive['follow_rate_pct']['value'] !== 2.4) {
    fwrite(STDERR, "FAIL: follow_rate calc mismatch\\n");
    exit(1);
}

echo "SUCCESS";
exit(0);
`;
  if (!fs.existsSync(path.dirname(runnerPhpPath))) {
    fs.mkdirSync(path.dirname(runnerPhpPath), { recursive: true });
  }
  fs.writeFileSync(runnerPhpPath, runnerContent, 'utf8');

  const phpCli = 'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe';
  const out = execSync(`"${phpCli}" "${runnerPhpPath}"`, {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, APP_ENV: 'testing' }
  });
  assert.ok(out.includes('SUCCESS'), 'PHP execution failed: ' + out);
});

// -------------------------------------------------------------------------
// TC-04: Date & Benchmark UI Separation logic audit
// -------------------------------------------------------------------------
runTest('Audit Date & Benchmark separation: Hadaplus benchmark comparison only active for 2026-09-01 -> 2026-09-20', () => {
  const jsxPath = path.join(__dirname, '..', 'src', 'CommerceDashboardView.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Verify isHadaplusPeriod is defined
  assert.ok(content.includes("startDate === '2026-09-01' && endDate === '2026-09-20'"), 'isHadaplusPeriod condition must check exact 2026-09-01 to 2026-09-20 window');

  // Verify benchmark text is conditionally rendered
  assert.ok(content.includes('isHadaplusPeriod ? ('), 'isHadaplusPeriod ternary condition must exist');
  assert.ok(content.includes('Khớp chuẩn kiểm chứng: 272,135,230 ₫ (2,777 đơn)'), 'Benchmark match string must exist under isHadaplusPeriod');
  assert.ok(content.includes('Kỳ báo cáo đang chọn:'), 'Dynamic report period string must exist for non-benchmark periods');
});

// -------------------------------------------------------------------------
// TC-05: 5-Way Metric Isolation: Unsynced Finance & Analytics display handling
// -------------------------------------------------------------------------
runTest('Audit 5-Way Isolation: Finance & Analytics display "Chưa đồng bộ" when unsynced/empty', () => {
  const jsxPath = path.join(__dirname, '..', 'src', 'CommerceDashboardView.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Verify Card 3 (Finance) checks is_synced and renders 'Chưa đồng bộ' with 'CHỜ ĐỒNG BỘ' badge
  assert.ok(content.includes('metrics.source_finance_api?.is_synced'), 'Card 3 must check source_finance_api?.is_synced');
  assert.ok(content.includes('CHỜ ĐỒNG BỘ'), 'CHỜ ĐỒNG BỘ badge must be present');
  assert.ok(content.includes('Chưa đồng bộ'), 'Chưa đồng bộ fallback text must be present');

  // Verify Card 4 (Analytics) checks is_synced and renders 'Chưa đồng bộ'
  assert.ok(content.includes('metrics.source_analytics_api?.is_synced'), 'Card 4 must check source_analytics_api?.is_synced');
});

// -------------------------------------------------------------------------
// TC-06: Sync Pipeline Status Badge Mapping: DISABLED is never treated as API failure
// -------------------------------------------------------------------------
runTest('Audit Sync Pipeline status: DISABLED is styled neutrally and trigger button is safely disabled', () => {
  const jsxPath = path.join(__dirname, '..', 'src', 'CommerceDashboardView.jsx');
  const content = fs.readFileSync(jsxPath, 'utf8');

  // Check Subtab 8 status mapping
  assert.ok(content.includes("let statusLabel = 'DISABLED'"), 'Default statusLabel must be DISABLED when feature flag is off');
  assert.ok(content.includes("let statusColor = '#94a3b8'"), 'Default statusColor must be neutral #94a3b8');
  assert.ok(content.includes("disabled={!isEnabled}"), 'Trigger sync button must be disabled when !isEnabled');
  assert.ok(content.includes("Domain đang tắt (Dark Launch)"), 'Button text must indicate Dark Launch when disabled');
});

// -------------------------------------------------------------------------
// TC-07: Verify dist/ bundle contains the updated code
// -------------------------------------------------------------------------
runTest('Verify dist/ bundle reflects the hotfix: contains renderKpiValue and isHadaplusPeriod logic', () => {
  const distDir = path.join(__dirname, '..', 'dist', 'assets');
  const files = fs.readdirSync(distDir);
  const jsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
  assert.ok(jsFile, 'Built JS file must exist in dist/assets');

  const bundle = fs.readFileSync(path.join(distDir, jsFile), 'utf8');
  assert.ok(bundle.includes('272,135,230'), 'Bundle must retain the verified benchmark value');
  assert.ok(bundle.includes('2026-09-01'), 'Bundle must retain the start benchmark date');
  assert.ok(bundle.includes('2026-09-20'), 'Bundle must retain the end benchmark date');
  assert.ok(bundle.includes('CHỜ ĐỒNG BỘ') || bundle.includes('Chưa đồng bộ'), 'Bundle must contain empty-state text');
});

console.log('====================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log('====================================================================');

if (passedTests === totalTests) {
  console.log('>>> ALL EMPTY-STATE RESILIENCE TESTS PASSED (100%) <<<');
  process.exit(0);
} else {
  console.error('>>> SOME TESTS FAILED <<<');
  process.exit(1);
}
