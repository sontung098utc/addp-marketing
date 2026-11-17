/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SPRINT V2-05 TEST SUITE
 * Test: Requested Period Semantics, UI Design Tokens & Business Labels
 * File: tools/test_v2_05_requested_period_and_ui_tokens.cjs
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function resolvePhpBinary() {
  const candidates = [
    process.env.PHP_BINARY_PATH,
    'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe',
    'C:\\xampp\\php\\php.exe',
    'C:\\php\\php.exe',
    'php'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'php';
}

const phpCli = resolvePhpBinary();

console.log('====================================================================');
console.log('  SPRINT V2-05: REQUESTED PERIOD SEMANTICS & UI TOKENS TESTS');
console.log(`  Resolved PHP Binary: ${phpCli}`);
console.log('====================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✘ [FAIL] ${name}`);
    console.error(`     Reason: ${err.message}`);
    process.exitCode = 1;
  }
}

function runPhpCode(code) {
  const tempScript = path.join(__dirname, `_temp_v2_05_ptest_${Date.now()}_${Math.floor(Math.random() * 1000)}.php`);
  const fullCode = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('AUTH_SIGNING_KEY=test_v205_key_32_bytes_length!!');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_password');
putenv('FEATURE_ENABLE_COMMERCE_V2=true');
$_ENV['FEATURE_ENABLE_COMMERCE_V2'] = 'true';
$_SERVER['FEATURE_ENABLE_COMMERCE_V2'] = 'true';

define('PROJECT_ROOT', '${PROJECT_ROOT.replace(/\\/g, '/')}');
chdir(PROJECT_ROOT);

${code}
`;
  fs.writeFileSync(tempScript, fullCode, 'utf-8');
  try {
    const out = execSync(`"${phpCli}" -f "${tempScript}"`, { encoding: 'utf-8', cwd: PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: out.trim() };
  } catch (err) {
    const detail = (err.stdout ? 'STDOUT: ' + err.stdout : '') + ' ' + (err.stderr ? 'STDERR: ' + err.stderr : '');
    return { success: false, error: detail || err.message, output: err.stdout?.toString() || '' };
  } finally {
    if (fs.existsSync(tempScript)) {
      try { fs.unlinkSync(tempScript); } catch (e) {}
    }
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: Requested Period Semantics (01-06 vs 01-05)
// -----------------------------------------------------------------------------
console.log('[SECTION 1] Requested Period Semantics & Alignment Metadata');

runTest('Reporting API payload provides requested_start_date & requested_end_date', () => {
  const php = `
    require_once PROJECT_ROOT . '/tools/mock_pdo_helper.php';
    require_once PROJECT_ROOT . '/public/api/tiktok_client.php';
    require_once PROJECT_ROOT . '/public/api/commerce_sync_service.php';
    require_once PROJECT_ROOT . '/public/api/commerce_loss_engine.php';
    require_once PROJECT_ROOT . '/public/api/commerce_reporting_service.php';
    
    $mockData = [
      'commerce_sync_runs' => 2,
      'MUTATION_REFRESH' => [
        [
          'status' => 'COMPLETED',
          'sync_type' => 'COVERAGE_WINDOW',
          'source_domain' => 'order',
          'start_date' => '2026-10-01',
          'end_date' => '2026-10-06',
          'window_start_time' => '2026-10-01 00:00:00',
          'window_end_time' => '2026-10-06 23:59:59',
          'completed_at' => '2026-10-06 10:00:00'
        ]
      ],
      'COUNT(DISTINCT stat_date)' => [
        ['dist_days' => 5, 'min_date' => '2026-10-01', 'max_date' => '2026-10-05']
      ],
      'aligned_gross_sales' => [
        ['aligned_gross_sales' => 56200000, 'aligned_orders' => 550]
      ],
      'order_gross_amount' => [
        ['gross_sales' => 66784554, 'total_orders' => 650, 'days_with_orders' => 6]
      ],
      'GROUP BY prom_type' => [
        [
          'prom_type' => 'PRODUCT',
          'campaign_count' => 10,
          'total_spend' => 5000000,
          'total_gross_revenue' => 25000000,
          'total_orders' => 200
        ]
      ]
    ];
    
    $db = MockPdoHelper::createMockPdo($mockData);
    $service = new CommerceReportingService($db);
    $res = $service->getCommerceReport('test_shop', '2026-10-01', '2026-10-06');
    
    echo json_encode([
      'requested_start' => $res['period']['requested_start_date'],
      'requested_end' => $res['period']['requested_end_date'],
      'shop_latest' => $res['report_meta']['domains']['orders']['latest_available_date'],
      'ads_latest' => $res['report_meta']['domains']['ads']['latest_available_date'],
      'comp_start' => $res['report_meta']['comparison_periods']['ads_vs_shop']['start_date'],
      'comp_end' => $res['report_meta']['comparison_periods']['ads_vs_shop']['end_date'],
      'is_aligned' => $res['report_meta']['comparison_periods']['ads_vs_shop']['is_aligned']
    ]);
  `;
  const res = runPhpCode(php);
  if (!res.success) throw new Error(res.error);
  let data;
  try {
    data = JSON.parse(res.output);
  } catch (e) {
    throw new Error(`Failed to parse JSON. Output was: [${res.output}]`);
  }
  
  if (data.requested_start !== '2026-10-01') throw new Error(`Requested start mismatch: ${data.requested_start}`);
  if (data.requested_end !== '2026-10-06') throw new Error(`Requested end mismatch: ${data.requested_end}`);
  if (data.shop_latest !== '2026-10-06') throw new Error(`Shop latest mismatch: ${data.shop_latest}`);
  if (data.ads_latest !== '2026-10-05') throw new Error(`Ads latest mismatch: ${data.ads_latest}`);
  if (data.comp_start !== '2026-10-01') throw new Error(`Comparison start mismatch: ${data.comp_start}`);
  if (data.comp_end !== '2026-10-05') throw new Error(`Comparison end mismatch: ${data.comp_end}`);
  if (data.is_aligned !== false) throw new Error(`Expected is_aligned = false for partial ads`);
});

// -----------------------------------------------------------------------------
// SECTION 2: UI Design System & CSS Tokens
// -----------------------------------------------------------------------------
console.log('\n[SECTION 2] UI Design System Tokens & Semantic Colors');

runTest('index.css declares standardized semantic color variables without neon glow', () => {
  const css = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.css'), 'utf-8');
  
  const requiredTokens = [
    '--color-primary',
    '--color-primary-dark',
    '--color-primary-light',
    '--color-success',
    '--color-success-dark',
    '--color-success-light',
    '--color-warning',
    '--color-warning-dark',
    '--color-warning-light',
    '--color-danger',
    '--color-danger-dark',
    '--color-danger-light',
    '--color-neutral',
    '--color-neutral-subtle'
  ];
  
  for (const token of requiredTokens) {
    if (!css.includes(token)) {
      throw new Error(`Missing required design token: ${token}`);
    }
  }
  
  // Verify clean professional Light Business styling
  if (!css.includes('--bg-app: #f8fafc') && !css.includes('--bg-card: #ffffff')) {
    throw new Error('Light Business theme base variables missing in index.css');
  }
});

// -----------------------------------------------------------------------------
// SECTION 3: Business Labels & Typography
// -----------------------------------------------------------------------------
console.log('\n[SECTION 3] Business Labels & Typography Invariants');

runTest('CommerceDashboardView.jsx adheres to strict business naming conventions', () => {
  const jsx = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceDashboardView.jsx'), 'utf-8');
  
  // Invariant 1: Export CSV button label
  if (!jsx.includes('Xuất CSV')) {
    throw new Error('Missing "Xuất CSV" button label');
  }
  if (jsx.includes('Xuất Excel')) {
    throw new Error('Found deprecated "Xuất Excel" button label');
  }
  
  // Invariant 2: Loss Ledger table title
  if (!jsx.includes('Hạch Toán Hao Hụt')) {
    throw new Error('Missing "Hạch Toán Hao Hụt" table title');
  }
  if (jsx.includes('Sổ Cái Hao Hụt')) {
    throw new Error('Found deprecated "Sổ Cái Hao Hụt" table title');
  }
  
  // Invariant 3: Sub-header metadata displays 3 facts
  if (!jsx.includes('Dữ liệu Shop: đến') || !jsx.includes('Dữ liệu Ads: đến') || !jsx.includes('Kỳ so sánh khả dụng:')) {
    throw new Error('Sub-header missing one of the 3 required facts (Shop, Ads, comparison period)');
  }
});

runTest('Executive AI Summary uses high-contrast light business styling', () => {
  const jsx = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceDashboardView.jsx'), 'utf-8');
  
  // Must use light clean card background, not dark gradient
  if (!jsx.includes('background: \'#ffffff\'') || !jsx.includes('border: \'1px solid #e2e8f0\'')) {
    throw new Error('Executive AI Summary missing clean light background or border');
  }
  if (!jsx.includes('TÓM TẮT HÔM NAY (Executive AI Summary)')) {
    throw new Error('Executive AI Summary title missing');
  }
});

console.log('\n====================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${totalTests - passedTests}`);
console.log('====================================================================');

if (passedTests === totalTests) {
  console.log('ALL SPRINT V2-05 REQUESTED PERIOD & UI TOKEN TESTS PASSED!\n');
  process.exit(0);
} else {
  process.exit(1);
}
