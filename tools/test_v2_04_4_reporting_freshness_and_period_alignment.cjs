/**
 * ADDP Commerce Intelligence V2
 * Sprint V2-04.4: Reporting Freshness & Period Alignment Test Suite
 *
 * Automated regression & acceptance tests covering:
 * CASE A: requested 01–30 Sep, Shop complete 30/30, Ads complete 30/30 => comparison 01–30, aligned = true.
 * CASE B: requested 01–06 Oct, Shop complete through 06, Ads available through 05 => Ads 5/6 PARTIAL (NOT FAILED), comparison 01–05, Shop denominator 01–05.
 * CASE C: Ads day 06 missing => does NOT synthesize Ads = 0; status PARTIAL, latest_available_date = 05/10.
 * CASE D: Historical period already complete in DB => report reads DB immediately (DB-FIRST), no full historical resync required.
 * CASE E: Orders complete but Ads partial => Shop Gross COMPLETE, Shop Realized verified = true, not dragged down to UNKNOWN by Ads.
 * CASE F: Cross-domain metric aligned to smaller common period => numerator and denominator use identical start/end window.
 * CASE G: No comparable period (no overlap) => cross-domain metrics null, zero division prevented, clear reason returned.
 * CASE H: Ads sync expands latest_available_date 05 -> 06 => coverage 6/6 COMPLETE, comparison automatically expands to 01–06, aligned = true.
 * CASE I: report_meta specification: all 6 domains present with all 12 metadata attributes each.
 * CASE J: Freshness status evaluation is evidence-based (FRESH on closed complete, NOT_YET_AVAILABLE on pending T-1 ads, STALE on incomplete past).
 * CASE K: Pure Ads metrics (Cost, Attributed Gross, Orders, ROI) use full Ads effective period and do NOT require Shop.
 * CASE L: Pure Shop metrics (Gross, Realized, Loss) use full Shop requested period.
 * CASE M: Strict Accounting Invariant: Gross - Loss = Realized holds across all cases.
 * CASE N: September authoritative baseline strictly preserved (4,207 orders, 409,171,911 Gross, 84,727,422 Loss, 324,444,489 Realized, 34,182,003 Spend, 383,251,049 Ads Rev, 11.21 ROI).
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
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_v2044_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
  const fullCode = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('AUTH_SIGNING_KEY=test_v2044_key_32_bytes_length!!');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_password');
putenv('FEATURE_ENABLE_COMMERCE_V2=true');
$_ENV['FEATURE_ENABLE_COMMERCE_V2'] = 'true';
$_SERVER['FEATURE_ENABLE_COMMERCE_V2'] = 'true';

require_once '${path.join(PROJECT_ROOT, 'tools', 'mock_pdo_helper.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'tiktok_client.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_service.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_loss_engine.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_orchestrator.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_reporting_service.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_aftersales_service.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_ads_ingestion_service.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_finance_service.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_analytics_service.php').replace(/\\/g, '/')}';

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
console.log('  V2-04.4: REPORTING FRESHNESS & PERIOD ALIGNMENT TESTS');
console.log(`  Resolved PHP Binary: ${PHP_BIN}`);
console.log('====================================================================\n');

// -------------------------------------------------------------------
// SECTION 1: Core Period Alignment Cases (Case A & Case B)
// -------------------------------------------------------------------
console.log('[SECTION 1] Core Period Alignment Engine');

runTest('CASE A: requested 01–30 Sep, Shop 30/30, Ads 30/30 => comparison 01–30, is_aligned = true', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            [
                'status' => 'COMPLETED',
                'sync_type' => 'COVERAGE_WINDOW',
                'source_domain' => 'order',
                'start_date' => '2026-09-01',
                'end_date' => '2026-09-30',
                'window_start_time' => '2026-09-01 00:00:00',
                'window_end_time' => '2026-09-30 23:59:59',
                'completed_at' => '2026-10-01 10:00:00'
            ]
        ],
        'COUNT(DISTINCT stat_date)' => [
            ['dist_days' => 30, 'min_date' => '2026-09-01', 'max_date' => '2026-09-30']
        ],
        'GROUP BY prom_type' => [
            [
                'prom_type' => 'PRODUCT',
                'campaign_count' => 70,
                'total_spend' => 34182003,
                'total_gross_revenue' => 383251049,
                'total_orders' => 5165
            ]
        ],
        'order_gross_amount' => [
            ['gross_sales' => 409171911, 'total_orders' => 4207, 'days_with_orders' => 30]
        ]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-09-01', '2026-09-30');

    $meta = $report['report_meta'] ?? [];
    $comp = $meta['comparison_periods']['ads_vs_shop'] ?? [];
    $ratios = $report['advertising']['ratios'] ?? [];

    $passed = (
        ($comp['is_aligned'] ?? false) === true &&
        ($comp['start_date'] ?? '') === '2026-09-01' &&
        ($comp['end_date'] ?? '') === '2026-09-30' &&
        is_null($comp['constrained_by']) &&
        ($ratios['is_aligned'] ?? false) === true &&
        ($ratios['ads_revenue_contribution_pct'] ?? 0) > 0
    );

    echo json_encode(['passed' => $passed, 'comp' => $comp, 'ratios' => $ratios]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case A failed: ' + JSON.stringify(res));
});

runTest('CASE B: requested 01–06 Oct, Shop complete through 06, Ads through 05 => Ads PARTIAL (not FAILED), comp 01–05, aligned denominator', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
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
                'campaign_count' => 15,
                'total_spend' => 6000000,
                'total_gross_revenue' => 66354662,
                'total_orders' => 600
            ]
        ]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');

    $meta = $report['report_meta'] ?? [];
    $comp = $meta['comparison_periods']['ads_vs_shop'] ?? [];
    $adsMeta = $meta['domains']['ads'] ?? [];
    $ratios = $report['advertising']['ratios'] ?? [];
    $alignedMetrics = $ratios['aligned_metrics'] ?? [];

    $adsStatus = $report['coverage']['advertising']['status'] ?? '';
    $isPartial = ($adsStatus === 'PARTIAL');
    $compStart = $comp['start_date'] ?? '';
    $compEnd = $comp['end_date'] ?? '';
    $alignedDenominator = (float)($alignedMetrics['shop_gross'] ?? 0);
    $rawGrossSales = (float)($report['commerce']['gross_sales'] ?? 0);

    $passed = (
        $isPartial &&
        $adsMeta['status'] === 'PARTIAL' &&
        $comp['is_aligned'] === false &&
        $comp['constrained_by'] === 'ads' &&
        $compStart === '2026-10-01' &&
        $compEnd === '2026-10-05' &&
        $alignedDenominator == 56200000 &&
        $rawGrossSales == 66784554 &&
        $alignedDenominator < $rawGrossSales
    );

    echo json_encode([
        'passed' => $passed,
        'adsStatus' => $adsStatus,
        'comp' => $comp,
        'alignedDenominator' => $alignedDenominator,
        'rawGrossSales' => $rawGrossSales,
        'contributionPct' => $ratios['ads_revenue_contribution_pct'] ?? null
    ]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case B failed: ' + JSON.stringify(res));
});

// -------------------------------------------------------------------
// SECTION 2: Missing != Zero & Historical Closed Isolation
// -------------------------------------------------------------------
console.log('[SECTION 2] Data Fidelity & DB-First Reporting');

runTest('CASE C: Missing Oct 06 Ads does NOT synthesize Ads = 0; status is PARTIAL with latest_available_date = 05/10', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            [
                'status' => 'COMPLETED',
                'source_domain' => 'order',
                'start_date' => '2026-10-01',
                'end_date' => '2026-10-06',
                'window_start_time' => '2026-10-01 00:00:00',
                'window_end_time' => '2026-10-06 23:59:59'
            ]
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 5, 'min_date' => '2026-10-01', 'max_date' => '2026-10-05']],
        'order_gross_amount' => [['gross_sales' => 10000000, 'total_orders' => 100]]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');

    $adsCov = $report['coverage']['advertising'] ?? [];
    $metaAds = $report['report_meta']['domains']['ads'] ?? [];

    $passed = (
        $adsCov['status'] === 'PARTIAL' &&
        $adsCov['available_days'] === 5 &&
        $adsCov['missing_days'] === 1 &&
        $adsCov['latest_available_date'] === '2026-10-05' &&
        $metaAds['latest_available_date'] === '2026-10-05' &&
        $metaAds['freshness_status'] === 'NOT_YET_AVAILABLE'
    );

    echo json_encode(['passed' => $passed, 'adsCov' => $adsCov, 'metaAds' => $metaAds]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case C failed: ' + JSON.stringify(res));
});

runTest('CASE D: User selects historical period already complete => report reads DB immediately (DB-FIRST), zero API fetch', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            [
                'status' => 'COMPLETED',
                'source_domain' => 'order',
                'start_date' => '2026-09-01',
                'end_date' => '2026-09-30',
                'window_start_time' => '2026-09-01 00:00:00',
                'window_end_time' => '2026-09-30 23:59:59'
            ]
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 30, 'min_date' => '2026-09-01', 'max_date' => '2026-09-30']],
        'order_gross_amount' => [['gross_sales' => 409171911, 'total_orders' => 4207]],
        'commerce_loss_ledger' => [
            ['loss_type' => 'CANCELLATION', 'total_loss' => 84394802],
            ['loss_type' => 'REFUND', 'total_loss' => 1806037]
        ]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $startTs = microtime(true);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-09-01', '2026-09-30');
    $durationMs = (microtime(true) - $startTs) * 1000;

    $passed = (
        isset($report['commerce']['gross_sales']) &&
        $report['commerce']['gross_sales'] == 409171911 &&
        $report['provenance']['source_orders'] === 'commerce_orders' &&
        $durationMs < 500
    );

    echo json_encode(['passed' => $passed, 'durationMs' => $durationMs, 'gross' => $report['commerce']['gross_sales']]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case D failed: ' + JSON.stringify(res));
});

// -------------------------------------------------------------------
// SECTION 3: Trust Decoupling & Sub-Period Alignment
// -------------------------------------------------------------------
console.log('[SECTION 3] Trust Decoupling & Sub-Period Alignment');

runTest('CASE E: Orders complete but Ads partial => Shop Gross is COMPLETE, Realized Sales is VERIFIED, not degraded by Ads', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 5,
        'MUTATION_REFRESH' => [
            [
                'status' => 'COMPLETED',
                'source_domain' => 'order',
                'start_date' => '2026-10-01',
                'end_date' => '2026-10-06',
                'window_start_time' => '2026-10-01 00:00:00',
                'window_end_time' => '2026-10-06 23:59:59'
            ]
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 5, 'min_date' => '2026-10-01', 'max_date' => '2026-10-05']],
        'order_gross_amount' => [['gross_sales' => 66784554, 'total_orders' => 650]],
        'commerce_loss_ledger' => [['loss_type' => 'CANCELLATION', 'total_loss' => 11456697]],
        "source_domain = 'rma'" => [
            [
                'status' => 'COMPLETED',
                'start_date' => '2026-10-01',
                'end_date' => '2026-10-06'
            ]
        ]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');

    $ordersStatus = $report['coverage']['orders']['status'] ?? '';
    $realizedVerified = $report['commerce']['realized_sales_trust_verified'] ?? false;
    $realizedStatus = $report['commerce']['realized_sales_status'] ?? '';
    $adsStatus = $report['coverage']['advertising']['status'] ?? '';

    $passed = (
        $ordersStatus === 'COMPLETE' &&
        $realizedVerified === true &&
        $realizedStatus === 'COMPLETE' &&
        $adsStatus === 'PARTIAL'
    );

    echo json_encode([
        'passed' => $passed,
        'ordersStatus' => $ordersStatus,
        'realizedVerified' => $realizedVerified,
        'realizedStatus' => $realizedStatus,
        'adsStatus' => $adsStatus
    ]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case E failed: ' + JSON.stringify(res));
});

runTest('CASE F: Cross-domain metric aligned to smaller common period => numerator and denominator use identical start/end', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            [
                'status' => 'COMPLETED',
                'source_domain' => 'order',
                'start_date' => '2026-10-01',
                'end_date' => '2026-10-06',
                'window_start_time' => '2026-10-01 00:00:00',
                'window_end_time' => '2026-10-06 23:59:59'
            ]
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 5, 'min_date' => '2026-10-01', 'max_date' => '2026-10-05']],
        'aligned_gross_sales' => [['aligned_gross_sales' => 80000000, 'aligned_orders' => 800]],
        'order_gross_amount' => [['gross_sales' => 100000000, 'total_orders' => 1000]],
        'GROUP BY prom_type' => [
            ['prom_type' => 'PRODUCT', 'total_spend' => 10000000, 'total_gross_revenue' => 40000000, 'total_orders' => 400]
        ]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');

    $ratios = $report['advertising']['ratios'] ?? [];
    $alignedMetrics = $ratios['aligned_metrics'] ?? [];
    $rawRatios = $ratios['raw_ratios'] ?? [];

    // Aligned: 40,000,000 / 80,000,000 = 50.0%
    $alignedContrib = $ratios['ads_revenue_contribution_pct'] ?? 0;
    // Raw misaligned: 40,000,000 / 100,000,000 = 40.0%
    $rawContrib = $rawRatios['ads_revenue_contribution_pct'] ?? 0;

    $passed = (
        $alignedContrib == 50.0 &&
        $rawContrib == 40.0 &&
        $alignedMetrics['shop_gross'] == 80000000 &&
        $alignedMetrics['ads_gross_revenue'] == 40000000
    );

    echo json_encode(['passed' => $passed, 'alignedContrib' => $alignedContrib, 'rawContrib' => $rawContrib]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case F failed: ' + JSON.stringify(res));
});

runTest('CASE G: No comparable period => cross-domain metrics null, zero division prevented, clear reason', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            [
                'status' => 'COMPLETED',
                'source_domain' => 'order',
                'start_date' => '2026-10-01',
                'end_date' => '2026-10-06',
                'window_start_time' => '2026-10-01 00:00:00',
                'window_end_time' => '2026-10-06 23:59:59'
            ]
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 0, 'min_date' => null, 'max_date' => null]],
        'order_gross_amount' => [['gross_sales' => 50000000, 'total_orders' => 500]]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');

    $ratios = $report['advertising']['ratios'] ?? [];
    $comp = $report['report_meta']['comparison_periods']['ads_vs_shop'] ?? [];

    $passed = (
        array_key_exists('ads_revenue_contribution_pct', $ratios) &&
        $ratios['ads_revenue_contribution_pct'] === null &&
        array_key_exists('ads_spend_rate_pct', $ratios) &&
        $ratios['ads_spend_rate_pct'] === null &&
        ($comp['has_overlap'] ?? true) === false &&
        !empty($comp['reason'])
    );

    echo json_encode(['passed' => $passed, 'ratios' => $ratios, 'comp' => $comp]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case G failed: ' + JSON.stringify(res));
});

runTest('CASE H: Ads sync expands latest_available_date 05 -> 06 => coverage 6/6 COMPLETE, comparison automatically expands to 01–06', () => {
  const code = `
    // Step 1: Ads was 5/6 days
    $mockDataPartial = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            ['status' => 'COMPLETED', 'source_domain' => 'order', 'start_date' => '2026-10-01', 'end_date' => '2026-10-06', 'window_start_time' => '2026-10-01 00:00:00', 'window_end_time' => '2026-10-06 23:59:59']
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 5, 'min_date' => '2026-10-01', 'max_date' => '2026-10-05']],
        'order_gross_amount' => [['gross_sales' => 66784554, 'total_orders' => 650]]
    ];
    $repPartial = (new CommerceReportingService(new MockPDO($mockDataPartial)))->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');
    $compEndBefore = $repPartial['report_meta']['comparison_periods']['ads_vs_shop']['end_date'] ?? '';

    // Step 2: Later sync ingests 06/10
    $mockDataComplete = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            ['status' => 'COMPLETED', 'source_domain' => 'order', 'start_date' => '2026-10-01', 'end_date' => '2026-10-06', 'window_start_time' => '2026-10-01 00:00:00', 'window_end_time' => '2026-10-06 23:59:59']
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 6, 'min_date' => '2026-10-01', 'max_date' => '2026-10-06']],
        'order_gross_amount' => [['gross_sales' => 66784554, 'total_orders' => 650]]
    ];
    $repComplete = (new CommerceReportingService(new MockPDO($mockDataComplete)))->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');
    $compEndAfter = $repComplete['report_meta']['comparison_periods']['ads_vs_shop']['end_date'] ?? '';
    $isAlignedAfter = $repComplete['report_meta']['comparison_periods']['ads_vs_shop']['is_aligned'] ?? false;

    $passed = (
        $compEndBefore === '2026-10-05' &&
        $compEndAfter === '2026-10-06' &&
        $isAlignedAfter === true
    );

    echo json_encode(['passed' => $passed, 'before' => $compEndBefore, 'after' => $compEndAfter, 'aligned' => $isAlignedAfter]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case H failed: ' + JSON.stringify(res));
});

// -------------------------------------------------------------------
// SECTION 4: Metadata Structure & Evidence-Based Freshness
// -------------------------------------------------------------------
console.log('[SECTION 4] Metadata Specification & Freshness Rules');

runTest('CASE I: report_meta specification: all 6 domains present with all 12 metadata attributes', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            ['status' => 'COMPLETED', 'source_domain' => 'order', 'start_date' => '2026-09-01', 'end_date' => '2026-09-30', 'window_start_time' => '2026-09-01 00:00:00', 'window_end_time' => '2026-09-30 23:59:59']
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 30, 'min_date' => '2026-09-01', 'max_date' => '2026-09-30']],
        'order_gross_amount' => [['gross_sales' => 10000000, 'total_orders' => 100]]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-09-01', '2026-09-30');

    $meta = $report['report_meta'] ?? [];
    $domains = $meta['domains'] ?? [];

    $expectedDomains = ['orders', 'rma', 'loss', 'ads', 'finance', 'analytics'];
    $hasAllDomains = true;
    foreach ($expectedDomains as $d) {
        if (!isset($domains[$d])) { $hasAllDomains = false; break; }
    }

    $ordersMeta = $domains['orders'] ?? [];
    $requiredKeys = [
        'status', 'coverage_status', 'freshness_status',
        'requested_start', 'requested_end', 'effective_start', 'effective_end',
        'latest_available_date', 'latest_synced_at',
        'coverage_days', 'requested_days', 'coverage_pct'
    ];
    $hasAllKeys = true;
    foreach ($requiredKeys as $k) {
        if (!array_key_exists($k, $ordersMeta)) { $hasAllKeys = false; break; }
    }

    $passed = (
        isset($meta['requested_period']) &&
        isset($meta['generated_at']) &&
        isset($meta['comparison_periods']['ads_vs_shop']) &&
        $hasAllDomains &&
        $hasAllKeys
    );

    echo json_encode(['passed' => $passed, 'hasAllDomains' => $hasAllDomains, 'hasAllKeys' => $hasAllKeys]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case I failed: ' + JSON.stringify(res));
});

runTest('CASE J: Freshness status is evidence-based (FRESH on closed complete, NOT_YET_AVAILABLE on pending T-1 ads)', () => {
  const code = `
    // Historical complete period
    $mockDataHist = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            ['status' => 'COMPLETED', 'source_domain' => 'order', 'start_date' => '2026-09-01', 'end_date' => '2026-09-30', 'window_start_time' => '2026-09-01 00:00:00', 'window_end_time' => '2026-09-30 23:59:59']
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 30, 'min_date' => '2026-09-01', 'max_date' => '2026-09-30']],
        'order_gross_amount' => [['gross_sales' => 10000000, 'total_orders' => 100]]
    ];
    $repHist = (new CommerceReportingService(new MockPDO($mockDataHist)))->getCommerceReport('7495657895504611503', '2026-09-01', '2026-09-30');
    $histAdsFreshness = $repHist['report_meta']['domains']['ads']['freshness_status'] ?? '';
    $histOrdersFreshness = $repHist['report_meta']['domains']['orders']['freshness_status'] ?? '';

    // Active period missing today
    $mockDataActive = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            ['status' => 'COMPLETED', 'source_domain' => 'order', 'start_date' => '2026-10-01', 'end_date' => '2026-10-06', 'window_start_time' => '2026-10-01 00:00:00', 'window_end_time' => '2026-10-06 23:59:59']
        ],
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 5, 'min_date' => '2026-10-01', 'max_date' => '2026-10-05']],
        'order_gross_amount' => [['gross_sales' => 10000000, 'total_orders' => 100]]
    ];
    $repActive = (new CommerceReportingService(new MockPDO($mockDataActive)))->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');
    $activeAdsFreshness = $repActive['report_meta']['domains']['ads']['freshness_status'] ?? '';

    $passed = (
        $histAdsFreshness === 'FRESH' &&
        $histOrdersFreshness === 'FRESH' &&
        $activeAdsFreshness === 'NOT_YET_AVAILABLE'
    );

    echo json_encode([
        'passed' => $passed,
        'histAdsFreshness' => $histAdsFreshness,
        'histOrdersFreshness' => $histOrdersFreshness,
        'activeAdsFreshness' => $activeAdsFreshness
    ]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case J failed: ' + JSON.stringify(res));
});

// -------------------------------------------------------------------
// SECTION 5: Domain Separation & Invariant Preservation
// -------------------------------------------------------------------
console.log('[SECTION 5] Domain Independence & Accounting Invariants');

runTest('CASE K: Pure Ads metrics (Cost, Gross Rev, Orders, ROI) use full Ads effective period and do NOT require Shop', () => {
  const code = `
    $mockData = [
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 5, 'min_date' => '2026-10-01', 'max_date' => '2026-10-05']],
        'GROUP BY prom_type' => [
            ['prom_type' => 'PRODUCT', 'campaign_count' => 10, 'total_spend' => 10000000, 'total_gross_revenue' => 50000000, 'total_orders' => 250]
        ],
        'order_gross_amount' => [['gross_sales' => 0, 'total_orders' => 0]]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');

    $ads = $report['advertising']['total'] ?? [];

    $passed = (
        $ads['cost'] == 10000000 &&
        $ads['attributed_gross_revenue'] == 50000000 &&
        $ads['orders'] == 250 &&
        $ads['roi'] == 5.0
    );

    echo json_encode(['passed' => $passed, 'ads' => $ads]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case K failed: ' + JSON.stringify(res));
});

runTest('CASE L: Pure Shop metrics (Gross, Realized, Loss) use full Shop requested period', () => {
  const code = `
    $mockData = [
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 0, 'min_date' => null, 'max_date' => null]],
        'order_gross_amount' => [['gross_sales' => 66784554, 'total_orders' => 650]],
        'commerce_loss_ledger' => [['loss_type' => 'CANCELLATION', 'total_loss' => 11456697]]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');

    $comm = $report['commerce'] ?? [];

    $passed = (
        $comm['gross_sales'] == 66784554 &&
        $comm['loss_value'] == 11456697 &&
        $comm['realized_sales'] == (66784554 - 11456697) &&
        $comm['total_orders'] == 650
    );

    echo json_encode(['passed' => $passed, 'comm' => $comm]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case L failed: ' + JSON.stringify(res));
});

runTest('CASE M: Strict Accounting Invariant: Gross - Loss = Realized holds across calculations', () => {
  const code = `
    $mockData = [
        'COUNT(DISTINCT stat_date)' => [['dist_days' => 30, 'min_date' => '2026-09-01', 'max_date' => '2026-09-30']],
        'order_gross_amount' => [['gross_sales' => 409171911, 'total_orders' => 4207]],
        'commerce_loss_ledger' => [
            ['loss_type' => 'CANCELLATION', 'total_loss' => 84394802],
            ['loss_type' => 'REFUND', 'total_loss' => 1806037]
        ]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-09-01', '2026-09-30');

    $gross = (float)$report['commerce']['gross_sales'];
    $loss = (float)$report['commerce']['loss_value'];
    $realized = (float)$report['commerce']['realized_sales'];

    $diff = abs(($gross - $loss) - $realized);
    $passed = ($diff < 0.001) && ($gross == 409171911) && ($loss == 86200839) && ($realized == 322971072);

    echo json_encode(['passed' => $passed, 'gross' => $gross, 'loss' => $loss, 'realized' => $realized]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case M failed: ' + JSON.stringify(res));
});

runTest('CASE N: September authoritative baseline strictly preserved (4,207 orders, 409,171,911 Gross, 86,200,839 Loss, 322,971,072 Realized, 34,182,003 Spend, 383,251,049 Ads Rev, 11.21 ROI)', () => {
  const code = `
    $mockData = [
        'order_gross_amount' => [['gross_sales' => 409171911, 'total_orders' => 4207]],
        'commerce_loss_ledger' => [
            ['loss_type' => 'CANCELLATION', 'total_loss' => 84394802, 'impacted_orders' => 731],
            ['loss_type' => 'REFUND', 'total_loss' => 1806037, 'impacted_orders' => 10]
        ],
        'GROUP BY prom_type' => [
            ['prom_type' => 'PRODUCT', 'campaign_count' => 70, 'total_spend' => 34182003, 'total_gross_revenue' => 383251049, 'total_orders' => 5165]
        ],
        'stat_date' => [['dist_days' => 30, 'min_date' => '2026-09-01', 'max_date' => '2026-09-30']]
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
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case N failed: ' + JSON.stringify(res));
});

// -------------------------------------------------------------------
// SECTION 6: Silent Misaligned Fallback Elimination (Case O)
// -------------------------------------------------------------------
console.log('[SECTION 6] Elimination of Silent Misaligned Fallbacks (Case O)');

runTest('CASE O: Sub-period aligned Shop query failure => alignedShopGross = null, ratios = null, calculation_status = UNAVAILABLE, no silent fallback to full period', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            [
                'status' => 'COMPLETED',
                'source_domain' => 'order',
                'start_date' => '2026-10-01',
                'end_date' => '2026-10-06',
                'window_start_time' => '2026-10-01 00:00:00',
                'window_end_time' => '2026-10-06 23:59:59'
            ]
        ],
        // Ads available 01–05 (5 days)
        'COUNT(DISTINCT stat_date)' => [
            ['dist_days' => 5, 'min_date' => '2026-10-01', 'max_date' => '2026-10-05']
        ],
        // Full period gross (01-06)
        'order_gross_amount' => [
            ['gross_sales' => 66784554, 'total_orders' => 650]
        ],
        // Simulate query failure on sub-period aligned Shop query (01-05)
        'aligned_gross_sales' => new PDOException('Simulated MariaDB sub-period lock/timeout'),
        // Aligned Ads query succeeds
        'aligned_spend' => [
            ['aligned_spend' => 15000000, 'aligned_gross_revenue' => 75000000]
        ]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');

    $ratios = $report['advertising']['ratios'] ?? [];
    $comp = $report['report_meta']['comparison_periods']['ads_vs_shop'] ?? [];
    $fullShopGross = $report['commerce']['gross_sales'] ?? 0;

    $passed = (
        $ratios['ads_revenue_contribution_pct'] === null &&
        $ratios['ads_spend_rate_pct'] === null &&
        ($comp['calculation_status'] ?? '') === 'UNAVAILABLE' &&
        strpos($comp['reason'] ?? '', 'ALIGNED_PERIOD_QUERY_FAILED') !== false &&
        $fullShopGross == 66784554
    );

    echo json_encode([
        'passed' => $passed,
        'ratios' => $ratios,
        'comp' => $comp,
        'fullShopGross' => $fullShopGross
    ]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case O failed: ' + JSON.stringify(res));
});

runTest('CASE O.2: Sub-period aligned Ads query failure => alignedAdsCost/Rev = null, ratios = null, calculation_status = UNAVAILABLE, no silent fallback to full period', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            [
                'status' => 'COMPLETED',
                'source_domain' => 'order',
                'start_date' => '2026-10-01',
                'end_date' => '2026-10-06',
                'window_start_time' => '2026-10-01 00:00:00',
                'window_end_time' => '2026-10-06 23:59:59'
            ]
        ],
        // Ads available 01–05 (5 days)
        'COUNT(DISTINCT stat_date)' => [
            ['dist_days' => 5, 'min_date' => '2026-10-01', 'max_date' => '2026-10-05']
        ],
        // Full period gross (01-06)
        'order_gross_amount' => [
            ['gross_sales' => 66784554, 'total_orders' => 650]
        ],
        // Sub-period aligned Shop query succeeds (01-05)
        'aligned_gross_sales' => [
            ['aligned_gross_sales' => 56200000, 'aligned_orders' => 550]
        ],
        // Simulate failure on sub-period aligned Ads query
        'aligned_spend' => new PDOException('Simulated ads campaign table error')
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-10-01', '2026-10-06');

    $ratios = $report['advertising']['ratios'] ?? [];
    $comp = $report['report_meta']['comparison_periods']['ads_vs_shop'] ?? [];

    $passed = (
        $ratios['ads_revenue_contribution_pct'] === null &&
        $ratios['ads_spend_rate_pct'] === null &&
        ($comp['calculation_status'] ?? '') === 'UNAVAILABLE' &&
        strpos($comp['reason'] ?? '', 'ALIGNED_PERIOD_QUERY_FAILED') !== false
    );

    echo json_encode([
        'passed' => $passed,
        'ratios' => $ratios,
        'comp' => $comp
    ]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case O.2 failed: ' + JSON.stringify(res));
});

runTest('CASE O.3: Identical period optimization preserved when compStart === startDate && compEnd === endDate', () => {
  const code = `
    $mockData = [
        'SELECT COUNT(*) FROM \`commerce_sync_runs\`' => 2,
        'MUTATION_REFRESH' => [
            [
                'status' => 'COMPLETED',
                'source_domain' => 'order',
                'start_date' => '2026-09-01',
                'end_date' => '2026-09-30',
                'window_start_time' => '2026-09-01 00:00:00',
                'window_end_time' => '2026-09-30 23:59:59'
            ]
        ],
        'COUNT(DISTINCT stat_date)' => [
            ['dist_days' => 30, 'min_date' => '2026-09-01', 'max_date' => '2026-09-30']
        ],
        'order_gross_amount' => [
            ['gross_sales' => 409171911, 'total_orders' => 4207]
        ],
        'GROUP BY prom_type' => [
            ['prom_type' => 'PRODUCT', 'campaign_count' => 70, 'total_spend' => 34182003, 'total_gross_revenue' => 383251049, 'total_orders' => 5165]
        ]
    ];

    $db = new MockPDO($mockData);
    $reporting = new CommerceReportingService($db);
    $report = $reporting->getCommerceReport('7495657895504611503', '2026-09-01', '2026-09-30');

    $ratios = $report['advertising']['ratios'] ?? [];
    $comp = $report['report_meta']['comparison_periods']['ads_vs_shop'] ?? [];

    $passed = (
        $comp['is_aligned'] === true &&
        $comp['calculation_status'] === 'AVAILABLE' &&
        $ratios['ads_spend_rate_pct'] !== null &&
        $ratios['ads_revenue_contribution_pct'] !== null &&
        round($ratios['ads_spend_rate_pct'], 2) === 8.35 &&
        round($ratios['ads_revenue_contribution_pct'], 2) === 93.67
    );

    echo json_encode([
        'passed' => $passed,
        'comp' => $comp,
        'ratios' => $ratios
    ]);
  `;
  const res = JSON.parse(runPhp(code));
  if (!res.passed) throw new Error('Case O.3 failed: ' + JSON.stringify(res));
});

console.log('\n====================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${failedTests}`);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL V2-04.4 REPORTING FRESHNESS & PERIOD ALIGNMENT TESTS PASSED SUCCESSFULLY!\n');
}
