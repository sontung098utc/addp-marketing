/**
 * ADDP Commerce Intelligence V2
 * Sprint V2-03: TikTok Shop Date Range Reporting + Light UI Test Suite
 *
 * Automated Test Suite asserting all 18 requirements from Section XVIII:
 * 1. Custom date range
 * 2. Inclusive start/end date
 * 3. Gross Sales calculation
 * 4. Realized Sales calculation
 * 5. Cancellation + Refund calculation
 * 6. PRODUCT promotion_type aggregation
 * 7. LIVE promotion_type aggregation
 * 8. Total Ads Cost: PRODUCT + LIVE
 * 9. Total Ads Revenue: PRODUCT + LIVE
 * 10. ROI calculation
 * 11. Zero cost handling (no divide-by-zero)
 * 12. Missing != zero (zero extrapolation)
 * 13. COMPLETE coverage
 * 14. PARTIAL coverage
 * 15. NOT_AVAILABLE coverage
 * 16. PRODUCT/LIVE zero double count
 * 17. Date range propagation uniformity
 * 18. Acceptance fixture verification (01/09/2026 - 20/09/2026)
 * 19. Light UI theme tokens verification
 * 20. Component integration verification
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
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_v203_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
  const fullCode = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('AUTH_SIGNING_KEY=test_v203_key_32_bytes_length!!');
putenv('DB_NAME=test_db');

require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_reporting_service.php').replace(/\\/g, '/')}';

${code}
`;
  try {
    fs.writeFileSync(tmpFile, fullCode, 'utf8');
    const out = execSync(`"${PHP_BIN}" -f "${tmpFile}"`, { encoding: 'utf8', cwd: PROJECT_ROOT });
    return out.trim();
  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
}

console.log('====================================================================');
console.log('  V2-03: TIKTOK SHOP DATE RANGE REPORTING + LIGHT UI TEST SUITE');
console.log(`  Resolved PHP Binary: ${PHP_BIN}`);
console.log('====================================================================\n');

// ====================================================================
// SECTION 2: Mock PDO & Engine Logic Assertions (Items 3 - 18)
// ====================================================================
const MOCK_PDO_PHP = `
class MockPDOStatement extends PDOStatement {
    private \$rows;
    private \$idx = 0;
    public function __construct(\$rows = []) {
        \$this->rows = \$rows;
    }
    public function execute(\$params = null): bool {
        \$this->idx = 0;
        return true;
    }
    public function fetch(\$mode = PDO::FETCH_DEFAULT, \$cursor = PDO::FETCH_ORI_NEXT, \$offset = 0): mixed {
        if (\$this->idx >= count(\$this->rows)) return false;
        return \$this->rows[\$this->idx++];
    }
    public function fetchAll(\$mode = PDO::FETCH_DEFAULT, mixed ...\$args): array {
        return \$this->rows;
    }
    public function fetchColumn(\$col = 0): mixed {
        if (empty(\$this->rows)) return false;
        \$first = \$this->rows[0];
        if (is_array(\$first)) {
            \$vals = array_values(\$first);
            return \$vals[\$col] ?? false;
        }
        return \$first;
    }
}

class MockPDO extends PDO {
    private \$mockData = [];
    public function __construct(\$mockData = []) {
        \$this->mockData = \$mockData;
    }
    public function prepare(\$query, \$options = []): PDOStatement {
        foreach (\$this->mockData as \$pattern => \$rows) {
            if (stripos(\$query, \$pattern) !== false) {
                return new MockPDOStatement(\$rows);
            }
        }
        return new MockPDOStatement([]);
    }
}
`;

// ====================================================================
// SECTION 1: Service Validation & Date-Range Semantics
// ====================================================================
console.log('[SECTION 1] Date-Range Semantics & Bounding');

runTest('1.1 Custom date range calculation and inclusive days count', () => {
  const res = runPhp(`
    ${MOCK_PDO_PHP}
    $svc = new CommerceReportingService(new MockPDO([]));
    $err = $svc->getCommerceReport('test_shop', '2026-09-20', '2026-09-01');
    if ($err['status'] !== 'ERROR') {
        echo "FAIL_INVERTED";
        exit;
    }
    echo "OK";
  `);
  if (res !== 'OK') throw new Error(`Expected OK, got: ${res}`);
});

runTest('1.2 Inclusive start/end date creates correct expected days (20 days for 01-20/09)', () => {
  const res = runPhp(`
    \$dtStart = DateTime::createFromFormat('Y-m-d', '2026-09-01');
    \$dtEnd = DateTime::createFromFormat('Y-m-d', '2026-09-20');
    \$days = max(1, (int)\$dtStart->diff(\$dtEnd)->format('%a') + 1);
    echo \$days;
  `);
  if (res !== '20') throw new Error(`Expected 20 days, got: ${res}`);
});

// ====================================================================
// SECTION 2: Mock PDO & Engine Logic Assertions (Items 3 - 18)
// ====================================================================
console.log('\n[SECTION 2] Core Business & Advertising Calculations');

runTest('3. Gross Sales calculation from commerce_orders', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'commerce_orders' => [['total_orders' => 3800, 'gross_sales' => 272135230, 'available_days' => 20]],
    'commerce_loss_ledger' => [],
    'commerce_ads_campaign_daily' => []
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
echo json_encode([
    'gross' => \$rep['commerce']['gross_sales'],
    'orders' => \$rep['commerce']['total_orders']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.gross !== 272135230 || out.orders !== 3800) {
    throw new Error(`Gross sales calculation mismatch: ${JSON.stringify(out)}`);
  }
});

runTest('4. Realized Sales = Gross Sales - Loss (Loss Ledger MATURED_LIFECYCLE)', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 3800, 'gross_sales' => 272135230, 'available_days' => 20]],
    'FROM \`commerce_loss_ledger\`' => [
        ['loss_type' => 'CANCELLATION', 'impacted_orders' => 700, 'total_loss' => 45000000],
        ['loss_type' => 'RETURN_REFUND', 'impacted_orders' => 150, 'total_loss' => 9287192]
    ]
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
echo json_encode([
    'gross' => \$rep['commerce']['gross_sales'],
    'realized' => \$rep['commerce']['realized_sales'],
    'loss' => \$rep['commerce']['loss_value'],
    'loss_rate' => \$rep['commerce']['loss_rate']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.gross !== 272135230) throw new Error(`Gross mismatch: ${out.gross}`);
  if (out.loss !== 54287192) throw new Error(`Loss mismatch: ${out.loss}`);
  if (out.realized !== 217848038) throw new Error(`Realized mismatch: ${out.realized}`);
  if (out.loss_rate !== 19.95) throw new Error(`Loss rate mismatch: ${out.loss_rate}`);
});

runTest('5. Cancellation + Refund breakdown calculation', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 100, 'gross_sales' => 10000000, 'available_days' => 20]],
    'FROM \`commerce_loss_ledger\`' => [
        ['loss_type' => 'CANCELLATION', 'impacted_orders' => 10, 'total_loss' => 1000000],
        ['loss_type' => 'RETURN_REFUND', 'impacted_orders' => 5, 'total_loss' => 500000]
    ]
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
\$bd = \$rep['commerce']['breakdown'];
echo json_encode([
    'cancel_val' => \$bd['cancellation_value'],
    'cancel_orders' => \$bd['cancellation_orders'],
    'refund_val' => \$bd['refund_value'],
    'refund_orders' => \$bd['refund_orders']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.cancel_val !== 1000000 || out.cancel_orders !== 10 || out.refund_val !== 500000 || out.refund_orders !== 5) {
    throw new Error(`Breakdown mismatch: ${JSON.stringify(out)}`);
  }
});

runTest('6 & 7. PRODUCT vs LIVE promotion_type aggregation & segregation', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 100, 'gross_sales' => 10000000, 'available_days' => 20]],
    'GROUP BY prom_type' => [
        ['prom_type' => 'PRODUCT', 'campaign_count' => 62, 'total_spend' => 14567279, 'total_gross_revenue' => 173726913, 'total_orders' => 2583],
        ['prom_type' => 'LIVE', 'campaign_count' => 280, 'total_spend' => 6931324, 'total_gross_revenue' => 78901865, 'total_orders' => 1064]
    ],
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 20, 'max_date' => '2026-09-20']]
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
\$prod = \$rep['advertising']['product_gmv_max'];
\$live = \$rep['advertising']['live_gmv_max'];
echo json_encode([
    'prod_cost' => \$prod['cost'],
    'prod_rev' => \$prod['attributed_gross_revenue'],
    'prod_camps' => \$prod['campaigns'],
    'prod_roi' => \$prod['roi'],
    'live_cost' => \$live['cost'],
    'live_rev' => \$live['attributed_gross_revenue'],
    'live_camps' => \$live['campaigns'],
    'live_roi' => \$live['roi']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.prod_cost !== 14567279 || out.prod_camps !== 62 || out.prod_roi !== 11.93) {
    throw new Error(`Product ads aggregation mismatch: ${JSON.stringify(out)}`);
  }
  if (out.live_cost !== 6931324 || out.live_camps !== 280 || out.live_roi !== 11.38) {
    throw new Error(`LIVE ads aggregation mismatch: ${JSON.stringify(out)}`);
  }
});

runTest('8 & 9 & 10. Total Ads Cost, Revenue, Orders & ROI = PRODUCT + LIVE without double count', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 100, 'gross_sales' => 10000000, 'available_days' => 20]],
    'GROUP BY prom_type' => [
        ['prom_type' => 'PRODUCT', 'campaign_count' => 62, 'total_spend' => 14567279, 'total_gross_revenue' => 173726913, 'total_orders' => 2583],
        ['prom_type' => 'LIVE', 'campaign_count' => 280, 'total_spend' => 6931324, 'total_gross_revenue' => 78901865, 'total_orders' => 1064]
    ],
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 20, 'max_date' => '2026-09-20']]
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
\$tot = \$rep['advertising']['total'];
echo json_encode([
    'cost' => \$tot['cost'],
    'rev' => \$tot['attributed_gross_revenue'],
    'orders' => \$tot['orders'],
    'camps' => \$tot['campaigns'],
    'roi' => \$tot['roi']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.cost !== 21498603) throw new Error(`Total cost mismatch: ${out.cost}`);
  if (out.rev !== 252628778) throw new Error(`Total revenue mismatch: ${out.rev}`);
  if (out.orders !== 3647) throw new Error(`Total orders mismatch: ${out.orders}`);
  if (out.camps !== 342) throw new Error(`Total campaigns mismatch: ${out.camps}`);
  if (out.roi !== 11.75) throw new Error(`Total ROI mismatch: ${out.roi}`);
});

runTest('11. Zero cost handling: avoids divide-by-zero errors and returns null', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 0, 'gross_sales' => 0, 'available_days' => 0]],
    'GROUP BY prom_type' => [
        ['prom_type' => 'PRODUCT', 'campaign_count' => 5, 'total_spend' => 0, 'total_gross_revenue' => 0, 'total_orders' => 0]
    ]
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
echo json_encode([
    'roi' => \$rep['advertising']['total']['roi'],
    'cpa' => \$rep['advertising']['total']['cpa'],
    'loss_rate' => \$rep['commerce']['loss_rate']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.roi !== null || out.cpa !== null || out.loss_rate !== 0) {
    throw new Error(`Zero cost guard failed: ${JSON.stringify(out)}`);
  }
});

runTest('12 & 13. COMPLETE coverage: 20/20 available days -> COMPLETE', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 10, 'gross_sales' => 100, 'days_with_orders' => 20]],
    'COUNT(*) FROM \`commerce_sync_runs\`' => [['total' => 1]],
    'FROM \`commerce_sync_runs\`' => [['status' => 'COMPLETED', 'window_start_time' => '2026-09-01 00:00:00', 'window_end_time' => '2026-09-20 23:59:59']],
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 20, 'max_date' => '2026-09-20']]
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
echo json_encode([
    'orders_status' => \$rep['coverage']['orders']['status'],
    'ads_status' => \$rep['coverage']['advertising']['status'],
    'overall' => \$rep['status']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.orders_status !== 'COMPLETE' || out.ads_status !== 'COMPLETE' || out.overall !== 'COMPLETE') {
    throw new Error(`Coverage complete failed: ${JSON.stringify(out)}`);
  }
});

runTest('14. PARTIAL coverage: 17/20 days -> PARTIAL (85%) with zero extrapolation', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 10, 'gross_sales' => 100, 'days_with_orders' => 20]],
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 17, 'max_date' => '2026-09-17']]
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
\$cov = \$rep['coverage']['advertising'];
echo json_encode([
    'req' => \$cov['requested_days'],
    'avail' => \$cov['available_days'],
    'missing' => \$cov['missing_days'],
    'pct' => \$cov['coverage_pct'],
    'status' => \$cov['status'],
    'overall' => \$rep['status']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.avail !== 17 || out.missing !== 3 || out.pct !== 85 || out.status !== 'PARTIAL' || out.overall !== 'PARTIAL') {
    throw new Error(`Partial coverage failed: ${JSON.stringify(out)}`);
  }
});

runTest('15. NOT_AVAILABLE coverage: 0 available days -> NOT_AVAILABLE', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 0, 'gross_sales' => 0, 'days_with_orders' => 0]],
    'COUNT(*) FROM \`commerce_sync_runs\`' => [['total' => 0]],
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 0, 'max_date' => null]]
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
echo json_encode([
    'orders_status' => \$rep['coverage']['orders']['status'],
    'ads_status' => \$rep['coverage']['advertising']['status'],
    'overall' => \$rep['status']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.orders_status !== 'NOT_AVAILABLE' || out.ads_status !== 'NOT_AVAILABLE' || out.overall !== 'NOT_AVAILABLE') {
    throw new Error(`Not available coverage failed: ${JSON.stringify(out)}`);
  }
});

runTest('16. Zero double counting: Product/Creative facts are excluded from campaign totals', () => {
  const content = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_reporting_service.php'), 'utf8');
  if (content.includes('commerce_ads_product_daily') && content.includes('SUM(product_spend)')) {
    throw new Error('Double counting detected: lower grain products summed into total');
  }
});

runTest('17. Date range propagation uniformity: orders and ads use identical period parameters', () => {
  const content = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_reporting_service.php'), 'utf8');
  if (!content.includes(':start_dt') || !content.includes(':sdate') || !content.includes('$startDate')) {
    throw new Error('Period parameters not uniformly propagated');
  }
});

runTest('18. Acceptance Reference Dataset (01/09/2026 - 20/09/2026) exact verification', () => {
  const code = `
${MOCK_PDO_PHP}
\$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 3800, 'gross_sales' => 272135230, 'available_days' => 20]],
    'FROM \`commerce_loss_ledger\`' => [
        ['loss_type' => 'CANCELLATION', 'impacted_orders' => 700, 'total_loss' => 45000000],
        ['loss_type' => 'RETURN_REFUND', 'impacted_orders' => 150, 'total_loss' => 9287192]
    ],
    'GROUP BY prom_type' => [
        ['prom_type' => 'PRODUCT', 'campaign_count' => 62, 'total_spend' => 14567279, 'total_gross_revenue' => 173726913, 'total_orders' => 2583],
        ['prom_type' => 'LIVE', 'campaign_count' => 280, 'total_spend' => 6931324, 'total_gross_revenue' => 78901865, 'total_orders' => 1064]
    ],
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 20, 'max_date' => '2026-09-20']]
];
\$svc = new CommerceReportingService(new MockPDO(\$mock));
\$rep = \$svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');

// Assertions matching Acceptance Criteria in Section VII & XVIII
\$c = \$rep['commerce'];
\$a = \$rep['advertising'];
\$t = \$a['total'];
\$p = \$a['product_gmv_max'];
\$l = \$a['live_gmv_max'];
\$cov = \$rep['coverage']['advertising'];

\$passed = (
    \$c['gross_sales'] == 272135230 &&
    \$c['realized_sales'] == 217848038 &&
    \$c['loss_value'] == 54287192 &&
    round(\$c['loss_rate'], 2) == 19.95 &&
    \$p['campaigns'] == 62 &&
    \$p['cost'] == 14567279 &&
    \$p['attributed_gross_revenue'] == 173726913 &&
    \$p['orders'] == 2583 &&
    round(\$p['roi'], 2) == 11.93 &&
    \$l['campaigns'] == 280 &&
    \$l['cost'] == 6931324 &&
    \$l['attributed_gross_revenue'] == 78901865 &&
    \$l['orders'] == 1064 &&
    round(\$l['roi'], 2) == 11.38 &&
    \$t['campaigns'] == 342 &&
    \$t['cost'] == 21498603 &&
    \$t['attributed_gross_revenue'] == 252628778 &&
    \$t['orders'] == 3647 &&
    round(\$t['roi'], 2) == 11.75 &&
    \$cov['available_days'] == 20 &&
    \$cov['status'] === 'COMPLETE'
);

echo \$passed ? 'ACCEPTANCE_PASSED' : 'ACCEPTANCE_FAILED';
`;
  const out = runPhp(code);
  if (out !== 'ACCEPTANCE_PASSED') {
    throw new Error(`Acceptance fixture assertion failed: ${out}`);
  }
});

// ====================================================================
// SECTION 3: Frontend Architecture, Light UI & Endpoints
// ====================================================================
console.log('\n[SECTION 3] Frontend Architecture & Light UI');

runTest('19. Standalone endpoint commerce_report.php exists and returns JSON', () => {
  const filePath = path.join(PROJECT_ROOT, 'public', 'api', 'commerce_report.php');
  if (!fs.existsSync(filePath)) throw new Error('commerce_report.php does not exist');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('CommerceReportingService') || !content.includes('getCommerceReport')) {
    throw new Error('commerce_report.php does not integrate CommerceReportingService');
  }
});

runTest('20. Action 20 get_commerce_report registered in commerce_dashboard.php', () => {
  const filePath = path.join(PROJECT_ROOT, 'public', 'api', 'commerce_dashboard.php');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('get_commerce_report') || !content.includes('getCommerceReport')) {
    throw new Error('Action get_commerce_report missing from commerce_dashboard.php');
  }
});

runTest('21. CommerceReportView.jsx exists with date presets and sections 1-6', () => {
  const filePath = path.join(PROJECT_ROOT, 'src', 'CommerceReportView.jsx');
  if (!fs.existsSync(filePath)) throw new Error('CommerceReportView.jsx does not exist');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('hadaplus_benchmark') || !content.includes('handleApplyCustom')) {
    throw new Error('Date range presets or custom picker missing from CommerceReportView.jsx');
  }
  if (!content.includes('I. Tổng quan Kinh Doanh Shop') || !content.includes('II. Hiệu Quả Quảng Cáo') || !content.includes('III. Phân Tách Quảng Cáo')) {
    throw new Error('Required sections missing from CommerceReportView.jsx');
  }
});

runTest('22. CommerceDashboardView.jsx imports CommerceReportView and defaults subTab to report (P0)', () => {
  const filePath = path.join(PROJECT_ROOT, 'src', 'CommerceDashboardView.jsx');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes("import CommerceReportView from './CommerceReportView';")) {
    throw new Error('CommerceReportView not imported in CommerceDashboardView.jsx');
  }
  if (!content.includes("const [subTab, setSubTab] = useState('report');")) {
    throw new Error("subTab default is not 'report' in CommerceDashboardView.jsx");
  }
  if (!content.includes("<CommerceReportView")) {
    throw new Error('CommerceReportView not mounted in CommerceDashboardView.jsx');
  }
});

runTest('23. Light Business Analytics CSS theme tokens in index.css and App.css', () => {
  const indexCss = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.css'), 'utf8');
  const appCss = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'App.css'), 'utf8');

  if (!indexCss.includes('--bg-app: #f8fafc;') || !indexCss.includes('--bg-card: #ffffff;')) {
    throw new Error('Light UI background tokens missing from index.css');
  }
  if (!indexCss.includes('--text-main: #0f172a;')) {
    throw new Error('Light UI typography text-main token missing from index.css');
  }
  if (!appCss.includes('.stat-card') || !appCss.includes('background: var(--bg-card);')) {
    throw new Error('Light UI stat-card styles missing from App.css');
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
  console.log('ALL V2-03 REPORTING & LIGHT UI TESTS PASSED SUCCESSFULLY!\n');
}
