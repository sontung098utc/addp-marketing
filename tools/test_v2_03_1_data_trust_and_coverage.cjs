/**
 * ADDP Commerce Intelligence V2
 * Sprint V2-03.1: Data Trust, Refund Loss & Coverage Semantics Test Suite
 *
 * Automated Test Suite asserting all requirements from Section 7:
 * A. REFUND canonical loss_type is included in refund bucket.
 * B. RETURN_REFUND backward-compatible mapping.
 * C. No double counting of losses & unknown loss_type preservation.
 * D. Ads 30/30 => advertising.status COMPLETE.
 * E. Ads 20/30 => advertising.status PARTIAL.
 * F. Orders zero-transaction day does not automatically mean missing data.
 * G. Orders coverage UNKNOWN if sync metadata cannot prove daily coverage.
 * H. Overall PARTIAL/UNKNOWN does not cause frontend to falsely claim Ads partial.
 * I. ads attributed gross / shop gross > 100% is valid and not treated as error.
 * J. Campaign count label does not claim active unless filtered by active status.
 * K. Sep 01-20 Historical Baseline: CANCELLATION=53,734,292; REFUND=552,900; TOTAL=54,287,192; GROSS=272,135,230.
 * L. Sep 01-30 Authoritative Ads Reference: Cost=34,182,003; Rev=383,251,049; Orders=5,165; ROI=11.21; Cov=30/30.
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
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_v2031_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
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
  } catch (err) {
    if (err.stdout) console.error("PHP STDOUT:", err.stdout);
    if (err.stderr) console.error("PHP STDERR:", err.stderr);
    throw err;
  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
}

const MOCK_PDO_PHP = `
class MockPDOStatement extends PDOStatement {
    private $rows;
    private $idx = 0;
    public function __construct($rows = []) {
        $this->rows = $rows;
    }
    public function execute($params = null): bool {
        $this->idx = 0;
        return true;
    }
    public function fetch($mode = PDO::FETCH_DEFAULT, $cursor = PDO::FETCH_ORI_NEXT, $offset = 0): mixed {
        if ($this->idx >= count($this->rows)) return false;
        return $this->rows[$this->idx++];
    }
    public function fetchAll($mode = PDO::FETCH_DEFAULT, mixed ...$args): array {
        return $this->rows;
    }
    public function fetchColumn($col = 0): mixed {
        if (empty($this->rows)) return false;
        $first = $this->rows[0];
        if (is_array($first)) {
            $vals = array_values($first);
            return $vals[$col] ?? false;
        }
        return $first;
    }
}

class MockPDO extends PDO {
    private $mockData = [];
    public function __construct($mockData = []) {
        parent::__construct('sqlite::memory:');
        $this->mockData = $mockData;
    }
    public function prepare($query, $options = []): PDOStatement {
        foreach ($this->mockData as $pattern => $rows) {
            if (stripos($query, $pattern) !== false) {
                return new MockPDOStatement($rows);
            }
        }
        return new MockPDOStatement([]);
    }
}
`;

console.log('====================================================================');
console.log('  V2-03.1: REPORTING DATA TRUST, REFUND LOSS & COVERAGE TESTS');
console.log(`  Resolved PHP Binary: ${PHP_BIN}`);
console.log('====================================================================\n');

// ====================================================================
// SECTION A, B, C: Loss Ledger Refund Mapping & Anti-Double-Counting
// ====================================================================
console.log('[SECTION 1] Loss Ledger Mapping & Baseline Verification');

runTest('A. REFUND canonical loss_type is included in refund bucket', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 100, 'gross_sales' => 10000000, 'days_with_orders' => 20]],
    'FROM \`commerce_loss_ledger\`' => [
        ['loss_type' => 'CANCELLATION', 'impacted_orders' => 10, 'total_loss' => 1000000],
        ['loss_type' => 'REFUND', 'impacted_orders' => 5, 'total_loss' => 550000]
    ]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
$bd = $rep['commerce']['breakdown'];
echo json_encode([
    'cancellation_value' => $bd['cancellation_value'],
    'refund_value' => $bd['refund_value'],
    'total_loss' => $rep['commerce']['loss_value']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.cancellation_value !== 1000000) throw new Error(`Cancellation mismatch: ${out.cancellation_value}`);
  if (out.refund_value !== 550000) throw new Error(`REFUND was not mapped to refund bucket: ${out.refund_value}`);
  if (out.total_loss !== 1550000) throw new Error(`Total loss mismatch: ${out.total_loss}`);
});

runTest('B. RETURN_REFUND backward-compatible mapping to refund bucket', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 100, 'gross_sales' => 10000000, 'days_with_orders' => 20]],
    'FROM \`commerce_loss_ledger\`' => [
        ['loss_type' => 'RETURN_REFUND', 'impacted_orders' => 3, 'total_loss' => 300000]
    ]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
$bd = $rep['commerce']['breakdown'];
echo json_encode([
    'refund_value' => $bd['refund_value'],
    'total_loss' => $rep['commerce']['loss_value']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.refund_value !== 300000) throw new Error(`RETURN_REFUND not mapped to refund bucket: ${out.refund_value}`);
});

runTest('C. No double counting of losses & unknown loss_type preservation', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 100, 'gross_sales' => 10000000, 'days_with_orders' => 20]],
    'FROM \`commerce_loss_ledger\`' => [
        ['loss_type' => 'CANCELLATION', 'impacted_orders' => 10, 'total_loss' => 1000000],
        ['loss_type' => 'REFUND', 'impacted_orders' => 5, 'total_loss' => 500000],
        ['loss_type' => 'RETURN_REFUND', 'impacted_orders' => 2, 'total_loss' => 200000],
        ['loss_type' => 'DAMAGED_TRANSIT', 'impacted_orders' => 1, 'total_loss' => 150000]
    ]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
$bd = $rep['commerce']['breakdown'];
echo json_encode([
    'cancel' => $bd['cancellation_value'],
    'refund' => $bd['refund_value'],
    'other' => $bd['other_value'],
    'total_loss' => $rep['commerce']['loss_value']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.cancel !== 1000000) throw new Error(`Cancel mismatch: ${out.cancel}`);
  if (out.refund !== 700000) throw new Error(`Refund mismatch (expected 500k + 200k = 700k): ${out.refund}`);
  if (out.other !== 150000) throw new Error(`Unknown type DAMAGED_TRANSIT not preserved: ${out.other}`);
  if (out.total_loss !== 1850000) throw new Error(`Total loss mismatch: ${out.total_loss}`);
});

runTest('K. Sep 01-20 Historical Baseline Verification (exact cents match)', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 3800, 'gross_sales' => 272135230, 'days_with_orders' => 20]],
    'FROM \`commerce_loss_ledger\`' => [
        ['loss_type' => 'CANCELLATION', 'impacted_orders' => 700, 'total_loss' => 53734292],
        ['loss_type' => 'REFUND', 'impacted_orders' => 25, 'total_loss' => 552900]
    ]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-20');
$c = $rep['commerce'];
$bd = $c['breakdown'];
echo json_encode([
    'gross' => $c['gross_sales'],
    'cancel' => $bd['cancellation_value'],
    'refund' => $bd['refund_value'],
    'total_loss' => $c['loss_value'],
    'realized' => $c['realized_sales'],
    'loss_rate' => $c['loss_rate']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.gross !== 272135230) throw new Error(`Gross mismatch: ${out.gross}`);
  if (out.cancel !== 53734292) throw new Error(`Cancel mismatch: ${out.cancel}`);
  if (out.refund !== 552900) throw new Error(`Refund mismatch: ${out.refund}`);
  if (out.total_loss !== 54287192) throw new Error(`Total loss mismatch: ${out.total_loss}`);
  if (out.realized !== 217848038) throw new Error(`Realized mismatch: ${out.realized}`);
  if (out.loss_rate !== 19.95) throw new Error(`Loss rate mismatch: ${out.loss_rate}`);
});

// ====================================================================
// SECTION D, E: Advertising Coverage Semantics
// ====================================================================
console.log('\n[SECTION 2] Advertising Coverage Semantics');

runTest('D. Ads 30/30 => advertising.status COMPLETE (100%)', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 30, 'max_date' => '2026-09-30']]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-30');
$adv = $rep['coverage']['advertising'];
echo json_encode([
    'req' => $adv['requested_days'],
    'avail' => $adv['available_days'],
    'pct' => $adv['coverage_pct'],
    'status' => $adv['status']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.req !== 30 || out.avail !== 30 || out.pct !== 100 || out.status !== 'COMPLETE') {
    throw new Error(`Ads 30/30 COMPLETE assertion failed: ${JSON.stringify(out)}`);
  }
});

runTest('E. Ads 20/30 => advertising.status PARTIAL (66.7%) with zero extrapolation', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 20, 'max_date' => '2026-09-20']]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-30');
$adv = $rep['coverage']['advertising'];
echo json_encode([
    'req' => $adv['requested_days'],
    'avail' => $adv['available_days'],
    'missing' => $adv['missing_days'],
    'pct' => $adv['coverage_pct'],
    'status' => $adv['status']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.req !== 30 || out.avail !== 20 || out.missing !== 10 || out.pct !== 66.7 || out.status !== 'PARTIAL') {
    throw new Error(`Ads 20/30 PARTIAL assertion failed: ${JSON.stringify(out)}`);
  }
});

runTest('L. Sep 01-30 Authoritative Ads Reference Verification (Cost=34,182,003, Rev=383,251,049, Orders=5,165, ROI=11.21)', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    'GROUP BY prom_type' => [
        ['prom_type' => 'PRODUCT', 'campaign_count' => 62, 'total_spend' => 20000000, 'total_gross_revenue' => 230000000, 'total_orders' => 3100],
        ['prom_type' => 'LIVE', 'campaign_count' => 280, 'total_spend' => 14182003, 'total_gross_revenue' => 153251049, 'total_orders' => 2065]
    ],
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 30, 'max_date' => '2026-09-30']]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-30');
$t = $rep['advertising']['total'];
echo json_encode([
    'cost' => $t['cost'],
    'revenue' => $t['attributed_gross_revenue'],
    'orders' => $t['orders'],
    'roi' => $t['roi']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.cost !== 34182003) throw new Error(`Ads cost mismatch: ${out.cost}`);
  if (out.revenue !== 383251049) throw new Error(`Ads revenue mismatch: ${out.revenue}`);
  if (out.orders !== 5165) throw new Error(`Ads orders mismatch: ${out.orders}`);
  if (out.roi !== 11.21) throw new Error(`Ads ROI mismatch: ${out.roi}`);
});

// ====================================================================
// SECTION F, G, H: Orders Coverage & Trust Semantics
// ====================================================================
console.log('\n[SECTION 3] Order Coverage & Trust Semantics');

runTest('F. Orders zero-transaction day does not automatically mean missing data', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    // 15 days had orders placed, but 15 days had zero transactions in a 30-day period
    'FROM \`commerce_orders\`' => [['total_orders' => 50, 'gross_sales' => 15000000, 'days_with_orders' => 15]],
    'COUNT(*) FROM \`commerce_sync_runs\`' => [['total' => 1]],
    // Authoritative sync run proves full 30-day range [01-30/09] was synced successfully
    'FROM \`commerce_sync_runs\`' => [['status' => 'COMPLETED', 'window_start_time' => '2026-09-01 00:00:00', 'window_end_time' => '2026-09-30 23:59:59']],
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 30, 'max_date' => '2026-09-30']]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-30');
$ord = $rep['coverage']['orders'];
echo json_encode([
    'req' => $ord['requested_days'],
    'avail' => $ord['available_days'],
    'days_with_orders' => $ord['days_with_orders'],
    'status' => $ord['status']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.days_with_orders !== 15) throw new Error(`Days with orders should be 15, got: ${out.days_with_orders}`);
  if (out.status !== 'COMPLETE') throw new Error(`Proven sync run should yield COMPLETE, got: ${out.status}`);
  if (out.avail !== 30) throw new Error(`Available days should be 30 when sync run proves coverage, not 15`);
});

runTest('G. Orders coverage UNKNOWN if sync metadata cannot prove daily coverage', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    'FROM \`commerce_orders\`' => [['total_orders' => 100, 'gross_sales' => 20000000, 'days_with_orders' => 28]],
    'COUNT(*) FROM \`commerce_sync_runs\`' => [['total' => 5]],
    // Sync runs do not span the requested 30-day window
    'FROM \`commerce_sync_runs\`' => [['status' => 'COMPLETED', 'window_start_time' => '2026-09-10 00:00:00', 'window_end_time' => '2026-09-15 23:59:59']],
    'COUNT(DISTINCT stat_date)' => [['dist_days' => 30, 'max_date' => '2026-09-30']]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-30');
$ord = $rep['coverage']['orders'];
echo json_encode([
    'req' => $ord['requested_days'],
    'avail' => $ord['available_days'],
    'pct' => $ord['coverage_pct'],
    'status' => $ord['status']
]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.status !== 'UNKNOWN') throw new Error(`Unproven order coverage must be UNKNOWN, got: ${out.status}`);
  if (out.avail !== null) throw new Error(`Available days must be null when UNKNOWN, got: ${out.avail}`);
  if (out.pct !== null) throw new Error(`Coverage pct must be null when UNKNOWN, got: ${out.pct}`);
});

runTest('H. Overall PARTIAL/UNKNOWN does not cause frontend to falsely claim Ads partial', () => {
  const fileContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceReportView.jsx'), 'utf8');
  // Check that header status badge checks adsCoverage independently
  if (fileContent.includes("isPartial ? `Dữ liệu một phần (PARTIAL ${coverage.advertising?.available_days")) {
    throw new Error('Detected old bug: UI collapsed overall isPartial into advertising available days string');
  }
  // Check that warning box identifies actual domain and does not say "Dữ liệu quảng cáo mới có 30/30"
  if (fileContent.includes("Cảnh báo: Dữ liệu quảng cáo mới có {coverage.advertising?.available_days")) {
    throw new Error('Detected old bug: UI showed advertising warning when overall was partial');
  }
});

// ====================================================================
// SECTION I, J: Ads Attribution Ratio & Campaign Factual Labeling
// ====================================================================
console.log('\n[SECTION 4] Metric Labels & Semantic Rules');

runTest('I. ads attributed gross / shop gross > 100% is valid and supported', () => {
  const code = `
${MOCK_PDO_PHP}
$mock = [
    // Shop Gross Sales: 100,000,000 VND
    'FROM \`commerce_orders\`' => [['total_orders' => 1000, 'gross_sales' => 100000000, 'days_with_orders' => 30]],
    // Ads Attributed Gross: 140,000,000 VND (attributed by TikTok Ads with multi-touch attribution)
    'GROUP BY prom_type' => [
        ['prom_type' => 'PRODUCT', 'campaign_count' => 50, 'total_spend' => 10000000, 'total_gross_revenue' => 140000000, 'total_orders' => 1200]
    ]
];
$svc = new CommerceReportingService(new MockPDO($mock));
$rep = $svc->getCommerceReport('hadaplus', '2026-09-01', '2026-09-30');
$ratio = $rep['advertising']['ratios']['ads_revenue_contribution_pct'];
echo json_encode(['ratio' => $ratio]);
`;
  const out = JSON.parse(runPhp(code));
  if (out.ratio !== 140.0) throw new Error(`Ratio > 100% should be 140.0, got: ${out.ratio}`);
});

runTest('J. Campaign count label does not claim active unless filtered by active status', () => {
  const fileContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceReportView.jsx'), 'utf8');
  if (fileContent.includes('Số chiến dịch hoạt động')) {
    throw new Error('Detected inaccurate label: "Số chiến dịch hoạt động" when only distinct campaign_id was counted');
  }
  if (!fileContent.includes('Số chiến dịch ghi nhận')) {
    throw new Error('Expected factual label "Số chiến dịch ghi nhận" in CommerceReportView.jsx');
  }
});

console.log('\n====================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${failedTests}`);
console.log('====================================================================');

if (failedTests > 0) {
  console.error('\nSOME V2-03.1 TESTS FAILED!');
  process.exit(1);
} else {
  console.log('\nALL V2-03.1 REPORTING DATA TRUST & COVERAGE TESTS PASSED SUCCESSFULLY!\n');
}
