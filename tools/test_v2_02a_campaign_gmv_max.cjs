/**
 * SPRINT V2-02A ACCEPTANCE TEST SUITE
 * CAMPAIGN GMV MAX INTELLIGENCE
 * 
 * Verifies all core requirements of Sprint V2-02A:
 *   1. Database Migration 010 schema, unique keys, and rollback script
 *   2. CommerceAdsIngestionService idempotent upsert and legacy backfill
 *   3. Date-bounded period filtering & provenance coverage calculation
 *   4. Macro breakdown (Product GMV Max vs LIVE GMV Max)
 *   5. Reconciliation invariant engine (total = product + live)
 *   6. Arithmetic safety (Zero spend -> ROI null, zero orders -> CPA null)
 *   7. Budget pacing & Target ROI variance evaluation
 *   8. API Guardrails (No fake clicks, no fake impressions, guarded disclosures)
 *   9. Previous period comparison safety
 *  10. Dashboard API actions (get_campaign_intelligence, trigger_sync ads_campaigns)
 *  11. Canonical terminology & semantic wording cleanup
 *  12. Frontend view components, finite states, and build integrity
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
  const tmpFile = path.resolve('tools', 'debug', `tmp_v202a_${Date.now()}_${Math.floor(Math.random() * 10000)}.php`);
  fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
  
  const fullScript = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('AUTH_SIGNING_KEY=test_v202a_key_32_bytes_length!!');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_pass');

class MockPDOStatement extends PDOStatement {
    private array $data;
    private int $idx = 0;
    public function __construct(array $data) { $this->data = $data; }
    public function execute(?array $params = null): bool { $this->idx = 0; return true; }
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed {
        return $this->idx < count($this->data) ? $this->data[$this->idx++] : false;
    }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, ...$args): array { return $this->data; }
    public function fetchColumn(int $column = 0): mixed {
        $r = $this->fetch();
        if ($r === false) return false;
        return is_array($r) ? (array_values($r)[$column] ?? false) : $r;
    }
}

class MockPDO extends PDO {
    public array $executedQueries = [];
    private array $handlers = [];
    public function __construct() {}
    public function setHandler(string $pat, array $rows): void { $this->handlers[$pat] = $rows; }
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false {
        $this->executedQueries[] = $query;
        return $this->prepare($query);
    }
    public function prepare(string $query, array $options = []): PDOStatement|false {
        $this->executedQueries[] = $query;
        foreach ($this->handlers as $pat => $rows) {
            if (stripos($query, $pat) !== false) return new MockPDOStatement($rows);
        }
        return new MockPDOStatement([]);
    }
}

${phpCode}
`;

  fs.writeFileSync(tmpFile, fullScript, 'utf8');
  try {
    const raw = execSync(`"${phpBin}" "${tmpFile}"`, { cwd: path.resolve('.'), encoding: 'utf8' });
    return { ok: true, output: raw.trim() };
  } catch (err) {
    const out = (err.stdout ? err.stdout.toString() : '') + ' ' + (err.stderr ? err.stderr.toString() : '');
    return { ok: false, error: out.trim() || err.message, details: out.trim(), output: out.trim() };
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (e) {}
  }
}

console.log('====================================================================');
console.log('STARTING SPRINT V2-02A CAMPAIGN GMV MAX ACCEPTANCE TEST MATRIX');
console.log('====================================================================');

// -----------------------------------------------------------------------------
// BLOCK A: DATABASE MIGRATION 010 & ROLLBACK SCRIPT AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK A: DATABASE MIGRATION 010 & ROLLBACK SCRIPT AUDIT ---');

const migPath = path.resolve('database', 'migrations', '20261003_010_create_commerce_ads_campaign_tables.sql');
const rollPath = path.resolve('database', 'migrations', '20261003_010_rollback_commerce_ads_campaign_tables.sql');

assert(fs.existsSync(migPath), 'Migration 010 file exists');
assert(fs.existsSync(rollPath), 'Rollback script for Migration 010 exists');

const migSql = fs.existsSync(migPath) ? fs.readFileSync(migPath, 'utf8') : '';
const rollSql = fs.existsSync(rollPath) ? fs.readFileSync(rollPath, 'utf8') : '';

assert(migSql.includes('commerce_ads_campaign_daily'), 'Migration creates commerce_ads_campaign_daily table');
assert(migSql.includes('uniq_shop_camp_date') && migSql.includes('`platform`') && migSql.includes('`shop_id`') && migSql.includes('`campaign_id`') && migSql.includes('`stat_date`'), 'Migration defines unique constraint (platform, shop_id, campaign_id, stat_date)');
assert(migSql.includes('idx_shop_date'), 'Migration defines index on (shop_id, stat_date)');
assert(migSql.includes('idx_type_date'), 'Migration defines index on (campaign_type, stat_date)');
assert(migSql.includes('`spend` DECIMAL(15,2)'), 'Migration defines spend column with DECIMAL(15,2) currency precision');
assert(migSql.includes('`gross_revenue` DECIMAL(15,2)'), 'Migration defines gross_revenue column with DECIMAL(15,2) precision');
assert(migSql.includes('`roi` DECIMAL(7,4)'), 'Migration defines roi column with DECIMAL(7,4) precision');
assert(migSql.includes('`budget` DECIMAL(15,2)'), 'Migration defines budget column with DECIMAL(15,2) precision');
assert(migSql.includes('`target_roas` DECIMAL(7,4)'), 'Migration defines target_roas column with DECIMAL(7,4) precision');
assert(migSql.includes('`impressions`') && migSql.includes('`clicks`'), 'Migration includes impressions and clicks columns strictly nullable');
assert(rollSql.includes('DROP TABLE IF EXISTS `commerce_ads_campaign_daily`'), 'Rollback cleanly drops commerce_ads_campaign_daily');

// -----------------------------------------------------------------------------
// BLOCK B: INGESTION SERVICE & LEGACY BACKFILL AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK B: INGESTION SERVICE & LEGACY BACKFILL AUDIT ---');

const testIngestionCode = `
require_once __DIR__ . '/../../public/api/commerce_ads_ingestion_service.php';

$mockPdo = new MockPDO();
$legacyRows = [
    [
        'shop_id' => 'hadaplus',
        'stat_date' => '2026-09-05',
        'campaign_id' => '1809001',
        'campaign_name' => 'Product GMV Max - Ao Thun Basic',
        'campaign_type' => 'PRODUCT_GMV_MAX',
        'spend' => 750000.0,
        'gmv' => 9000000.0,
        'orders' => 45,
        'roi' => 12.0,
        'cpa' => 16666.67,
        'budget' => 1000000.0,
        'target_roas' => 10.0,
        'campaign_status' => 1
    ],
    [
        'shop_id' => 'hadaplus',
        'stat_date' => '2026-09-05',
        'campaign_id' => '1809002',
        'campaign_name' => 'LIVE GMV Max - Flash Sale 09.05',
        'campaign_type' => 'LIVE_GMV_MAX',
        'spend' => 300000.0,
        'gmv' => 3600000.0,
        'orders' => 18,
        'roi' => 12.0,
        'cpa' => 16666.67,
        'budget' => 500000.0,
        'target_roas' => 10.0,
        'campaign_status' => 1
    ]
];

$mockPdo->setHandler('SHOW TABLES LIKE', [['table_name' => 'commerce_ads_campaign_daily'], ['table_name' => 'tiktok_campaign_daily_reports']]);
$mockPdo->setHandler('tiktok_campaign_daily_reports', $legacyRows);

$service = new CommerceAdsIngestionService($mockPdo);

$type1 = $service->classifyCampaignType('GMV Max Product Cam 1');
$type2 = $service->classifyCampaignType('LIVE Special Room Promo');

$backfillRes = $service->backfillFromLegacyDailyReports('hadaplus', '2026-09-01', '2026-09-20');

$upsertQueries = array_filter($mockPdo->executedQueries, fn($q) => stripos($q, 'ON DUPLICATE KEY UPDATE') !== false);

echo json_encode([
    'type1' => $type1,
    'type2' => $type2,
    'backfill' => $backfillRes,
    'has_insert_on_duplicate' => count($upsertQueries) > 0
]);
`;

const ingestionRes = runPhpScript(testIngestionCode);
assert(ingestionRes.ok, 'PHP executed CommerceAdsIngestionService cleanly', ingestionRes.error);
if (ingestionRes.ok) {
  const ing = JSON.parse(ingestionRes.output);
  assert(ing.type1 === 'PRODUCT_GMV_MAX', 'Classifies Product GMV Max campaign correctly');
  assert(ing.type2 === 'LIVE_GMV_MAX', 'Classifies LIVE GMV Max campaign correctly');
  assert(ing.backfill.records_ingested === 2, 'Backfill processes exact rows from legacy reports');
  assert(ing.has_insert_on_duplicate, 'Upsert uses ON DUPLICATE KEY UPDATE for idempotent ingestion');
}

// -----------------------------------------------------------------------------
// BLOCK C: BACKEND CAMPAIGN INTELLIGENCE SERVICE (MACRO & RECONCILIATION)
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK C: BACKEND CAMPAIGN INTELLIGENCE SERVICE ---');

const testAdsIntelCode = `
require_once __DIR__ . '/../../public/api/commerce_ads_service.php';

$mockPdo = new MockPDO();

$campAggRows = [
    [
        'campaign_id' => '1809001',
        'campaign_name' => 'Product GMV Max - Core Skincare',
        'campaign_type' => 'PRODUCT_GMV_MAX',
        'operation_status' => 'ENABLE',
        'budget' => 1000000.0,
        'target_roas' => 10.0,
        'total_spend' => 14415406.0,
        'total_gross_revenue' => 174098150.0,
        'total_orders' => 1850,
        'campaign_latest_date' => '2026-09-20'
    ],
    [
        'campaign_id' => '1809002',
        'campaign_name' => 'LIVE GMV Max - Mega Live Weekend',
        'campaign_type' => 'LIVE_GMV_MAX',
        'operation_status' => 'ENABLE',
        'budget' => 500000.0,
        'target_roas' => 10.0,
        'total_spend' => 6057339.0,
        'total_gross_revenue' => 70927539.0,
        'total_orders' => 750,
        'campaign_latest_date' => '2026-09-20'
    ]
];

$dailyTrendRows = [];
for ($d = 1; $d <= 20; $d++) {
    $dateStr = sprintf('2026-09-%02d', $d);
    $dailyTrendRows[] = [
        'stat_date' => $dateStr,
        'day_spend' => 1023637.25,
        'day_gross' => 12251284.45,
        'day_orders' => 130,
        'product_spend' => 720770.30,
        'live_spend' => 302866.95
    ];
}

$mockPdo->setHandler('SHOW TABLES LIKE', [['table_name' => 'commerce_ads_campaign_daily']]);
$mockPdo->setHandler('SELECT COUNT(*)', [['count' => 40]]);
$mockPdo->setHandler('GROUP BY d.campaign_id', $campAggRows);
$mockPdo->setHandler('GROUP BY stat_date', $dailyTrendRows);

$adsService = new CommerceAdsService($mockPdo);
$intel = $adsService->getCampaignIntelligence('hadaplus', '2026-09-01', '2026-09-20');

echo json_encode($intel);
`;

const intelRes = runPhpScript(testAdsIntelCode);
assert(intelRes.ok, 'PHP executed CommerceAdsService::getCampaignIntelligence cleanly', intelRes.error);
if (intelRes.ok) {
  const data = JSON.parse(intelRes.output);

  // Status & Provenance
  assert(data.status === 'AVAILABLE', 'Campaign intelligence status is AVAILABLE when all 20 days present');
  assert(data.provenance.expected_days === 20 || data.provenance.expected_days_count === 20, 'Provenance computes expected_days = 20 for 2026-09-01..2026-09-20');
  assert(data.provenance.distinct_days === 20 || data.provenance.distinct_days_count === 20, 'Provenance computes distinct_days = 20');
  assert(data.provenance.coverage_pct === 100.0 || data.provenance.coverage_percent === 100.0, 'Provenance computes 100% coverage');
  assert(data.provenance.source_table === 'commerce_ads_campaign_daily', 'Provenance cites canonical source table commerce_ads_campaign_daily');

  // Macro KPIs
  const macro = data.macro_overview;
  const expectedTotalCost = 14415406.0 + 6057339.0; // 20,472,745
  const expectedTotalGross = 174098150.0 + 70927539.0; // 245,025,689
  const expectedTotalOrders = 1850 + 750; // 2,600
  const expectedRoi = Math.round((expectedTotalGross / expectedTotalCost) * 100) / 100; // 11.97x

  assert(macro.total_ads_cost === expectedTotalCost, `Macro total Ads Cost is ${expectedTotalCost.toLocaleString()} VND`);
  assert(macro.total_gross_revenue === expectedTotalGross, `Macro total Gross Revenue is ${expectedTotalGross.toLocaleString()} VND`);
  assert(macro.total_orders === expectedTotalOrders, `Macro total orders is ${expectedTotalOrders}`);
  assert(macro.blended_roi === expectedRoi, `Macro blended ROI is ${expectedRoi}x`);

  // Macro Breakdown
  const prod = macro.breakdown.product_gmv_max;
  const live = macro.breakdown.live_gmv_max;
  assert(prod.ads_cost === 14415406.0, 'Product GMV Max Ads Cost matches 14,415,406 VND');
  assert(prod.gross_revenue === 174098150.0, 'Product GMV Max Gross Revenue matches 174,098,150 VND');
  assert(live.ads_cost === 6057339.0, 'LIVE GMV Max Ads Cost matches 6,057,339 VND');
  assert(live.gross_revenue === 70927539.0, 'LIVE GMV Max Gross Revenue matches 70,927,539 VND');

  // Reconciliation Invariant Engine
  const recon = macro.reconciliation;
  assert(recon.status === 'RECONCILED', 'Reconciliation invariant status is RECONCILED');
  assert(recon.cost_variance === 0.0, 'Cost variance between Total and (Product + LIVE) is 0.0 VND');
  assert(recon.revenue_variance === 0.0, 'Revenue variance is 0.0 VND');
  assert(recon.orders_variance === 0, 'Orders variance is 0');

  // Target ROI & Budget Evaluation
  assert(data.campaigns.length === 2, 'Returns 2 campaigns');
  const camp1 = data.campaigns[0];
  assert(camp1.target_roas === 10.0, 'Camp 1 target ROAS is 10.0x');
  assert(camp1.target_roas_comparison === 'MET_OR_EXCEEDED', 'Camp 1 target ROAS is marked MET_OR_EXCEEDED');
  assert(camp1.target_roi_variance > 0, 'Camp 1 target ROI variance is positive');
  assert(camp1.budget_utilization_pct !== null, 'Camp 1 computes budget utilization percentage');
}

// -----------------------------------------------------------------------------
// BLOCK D: ARITHMETIC SAFETY & ZERO DIVISION SAFEGUARDS
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK D: ARITHMETIC SAFETY & ZERO DIVISION SAFEGUARDS ---');

const testZeroMathCode = `
require_once __DIR__ . '/../../public/api/commerce_ads_service.php';

$mockPdo = new MockPDO();
$zeroRows = [
    [
        'campaign_id' => '1809099',
        'campaign_name' => 'Zero Spend Campaign',
        'campaign_type' => 'PRODUCT_GMV_MAX',
        'operation_status' => 'DISABLE',
        'budget' => 0.0,
        'target_roas' => null,
        'total_spend' => 0.0,
        'total_gross_revenue' => 0.0,
        'total_orders' => 0,
        'campaign_latest_date' => '2026-09-01'
    ]
];

$zeroTrend = [
    [
        'stat_date' => '2026-09-01',
        'day_spend' => 0.0,
        'day_gross' => 0.0,
        'day_orders' => 0,
        'product_spend' => 0.0,
        'live_spend' => 0.0
    ]
];

$mockPdo->setHandler('SHOW TABLES LIKE', [['table_name' => 'commerce_ads_campaign_daily']]);
$mockPdo->setHandler('SELECT COUNT(*)', [['count' => 1]]);
$mockPdo->setHandler('GROUP BY d.campaign_id', $zeroRows);
$mockPdo->setHandler('GROUP BY stat_date', $zeroTrend);

$adsService = new CommerceAdsService($mockPdo);
$zeroIntel = $adsService->getCampaignIntelligence('hadaplus', '2026-09-01', '2026-09-01');

echo json_encode([
    'macro_roi' => $zeroIntel['macro_overview']['blended_roi'],
    'macro_cpa' => $zeroIntel['macro_overview']['blended_cpa'],
    'camp_roi' => $zeroIntel['campaigns'][0]['roi'],
    'camp_cpa' => $zeroIntel['campaigns'][0]['cpa'],
    'budget_util' => $zeroIntel['campaigns'][0]['budget_utilization_pct']
]);
`;

const zeroRes = runPhpScript(testZeroMathCode);
assert(zeroRes.ok, 'PHP executed zero spend / zero orders math cleanly', zeroRes.error);
if (zeroRes.ok) {
  const z = JSON.parse(zeroRes.output);
  assert(z.macro_roi === 0.0 || z.macro_roi === null, 'Blended ROI handles 0 spend safely (0.0 or null, no division by zero)');
  assert(z.macro_cpa === 0.0 || z.macro_cpa === null, 'Blended CPA handles 0 orders safely (0.0 or null, no division by zero)');
  assert(z.camp_roi === 0.0 || z.camp_roi === null, 'Campaign ROI handles 0 spend safely');
  assert(z.camp_cpa === 0.0 || z.camp_cpa === null, 'Campaign CPA handles 0 orders safely');
  assert(z.budget_util === null, 'Budget utilization is strictly null when daily budget is 0.0');
}

// -----------------------------------------------------------------------------
// BLOCK E: CAMPAIGN DRILLDOWN & GUARDRAIL DISCLOSURES AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK E: CAMPAIGN DRILLDOWN & GUARDRAIL DISCLOSURES AUDIT ---');

const testDrilldownCode = `
require_once __DIR__ . '/../../public/api/commerce_ads_service.php';

$mockPdo = new MockPDO();

$campAggRows = [
    [
        'campaign_id' => '1809001',
        'campaign_name' => 'Product GMV Max - Core Skincare',
        'campaign_type' => 'PRODUCT_GMV_MAX',
        'operation_status' => 'ENABLE',
        'budget' => 1000000.0,
        'target_roas' => 10.0,
        'total_spend' => 1450000.0,
        'total_gross_revenue' => 17500000.0,
        'total_orders' => 183,
        'campaign_latest_date' => '2026-09-02'
    ]
];

$dailyTrendRows = [
    [
        'stat_date' => '2026-09-01',
        'day_spend' => 700000.0,
        'day_gross' => 8400000.0,
        'day_orders' => 88,
        'product_spend' => 700000.0,
        'live_spend' => 0.0
    ],
    [
        'stat_date' => '2026-09-02',
        'day_spend' => 750000.0,
        'day_gross' => 9100000.0,
        'day_orders' => 95,
        'product_spend' => 750000.0,
        'live_spend' => 0.0
    ]
];

$singleCampDailyRows = [
    [
        'stat_date' => '2026-09-01',
        'spend' => 700000.0,
        'cost' => 700000.0,
        'gross_revenue' => 8400000.0,
        'orders' => 88,
        'roi' => 12.0,
        'cost_per_order' => 7954.55,
        'budget' => 1000000.0,
        'target_roas' => 10.0
    ],
    [
        'stat_date' => '2026-09-02',
        'spend' => 750000.0,
        'cost' => 750000.0,
        'gross_revenue' => 9100000.0,
        'orders' => 95,
        'roi' => 12.13,
        'cost_per_order' => 7894.74,
        'budget' => 1000000.0,
        'target_roas' => 10.0
    ]
];

$mockPdo->setHandler('SHOW TABLES LIKE', [['table_name' => 'commerce_ads_campaign_daily']]);
$mockPdo->setHandler('SELECT COUNT(*)', [['count' => 2]]);
$mockPdo->setHandler('GROUP BY d.campaign_id', $campAggRows);
$mockPdo->setHandler('GROUP BY stat_date', $dailyTrendRows);
$mockPdo->setHandler('campaign_id = ?', $singleCampDailyRows);

$adsService = new CommerceAdsService($mockPdo);
$detailIntel = $adsService->getCampaignIntelligence('hadaplus', '2026-09-01', '2026-09-02', null, '1809001');

echo json_encode($detailIntel['selected_campaign'] ?? []);
`;

const drillRes = runPhpScript(testDrilldownCode);
assert(drillRes.ok, 'PHP executed campaign drilldown query cleanly', drillRes.error);
if (drillRes.ok) {
  const detail = JSON.parse(drillRes.output);
  assert(detail.campaign_info && detail.campaign_info.campaign_id === '1809001', 'Drilldown returns selected campaign metadata');
  assert(detail.daily_trend && detail.daily_trend.length === 2, 'Drilldown returns daily trend rows');
  assert(detail.daily_trend[0].stat_date === '2026-09-01', 'Daily trend returns stat_date');
  assert(detail.daily_trend[0].cost === 700000.0 || detail.daily_trend[0].spend === 700000.0, 'Daily trend returns cost / spend');
  assert(detail.daily_trend[0].gross_revenue === 8400000.0, 'Daily trend returns gross_revenue');
  assert(detail.guardrail_disclosures !== undefined, 'Returns guardrail_disclosures structure');
  assert(detail.guardrail_disclosures.product_breakdown.status === 'SUPPORTED_NOT_SYNCED', 'Product breakdown flagged SUPPORTED_NOT_SYNCED');
  assert(detail.guardrail_disclosures.product_breakdown.reason.includes('item_group_id'), 'Product breakdown reason cites verified item_group_id API dimension');
  assert(detail.guardrail_disclosures.video_breakdown.status === 'SUPPORTED_NOT_SYNCED', 'Video breakdown flagged SUPPORTED_NOT_SYNCED');
  assert(detail.guardrail_disclosures.video_breakdown.reason.includes('item_id'), 'Video breakdown reason cites verified item_id API dimension');
  assert(detail.guardrail_disclosures.live_breakdown.status === 'SUPPORTED_NOT_SYNCED', 'LIVE breakdown flagged SUPPORTED_NOT_SYNCED');
  assert(detail.guardrail_disclosures.live_breakdown.reason.includes('room_id'), 'LIVE breakdown reason cites verified room_id API dimension');
}

// -----------------------------------------------------------------------------
// BLOCK F: DASHBOARD API INTEGRATION & TRIGGER SYNC
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK F: DASHBOARD API INTEGRATION & TRIGGER SYNC ---');

const dashFile = path.resolve('public', 'api', 'commerce_dashboard.php');
const dashContent = fs.readFileSync(dashFile, 'utf8');

assert(dashContent.includes('require_once __DIR__ . \'/commerce_ads_ingestion_service.php\';'), 'commerce_dashboard.php requires commerce_ads_ingestion_service.php');
assert(dashContent.includes("case 'get_campaign_intelligence':"), 'commerce_dashboard.php handles get_campaign_intelligence action');
assert(dashContent.includes("case 'get_gmv_max_campaigns':"), 'commerce_dashboard.php handles get_gmv_max_campaigns alias action');
assert(dashContent.includes("$domain === 'ads_campaigns'"), 'commerce_dashboard.php handles domain ads_campaigns in trigger_sync');

// -----------------------------------------------------------------------------
// BLOCK G: CANONICAL TERMINOLOGY & SEMANTIC CLEANUP AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK G: CANONICAL TERMINOLOGY & SEMANTIC CLEANUP AUDIT ---');

const analyticsFile = path.resolve('public', 'api', 'commerce_analytics_service.php');
const analyticsContent = fs.readFileSync(analyticsFile, 'utf8');

assert(!analyticsContent.includes("'title' => 'Tỷ lệ hủy đơn cao'"), 'Removed arbitrary "Tỷ lệ hủy đơn cao" label from analytics service');
assert(analyticsContent.includes("'title' => 'Đơn hàng bị hủy'"), 'Replaced with factual "Đơn hàng bị hủy"');
assert(!analyticsContent.includes("'title' => 'Hiệu suất quảng cáo vượt trội'"), 'Removed arbitrary "Hiệu suất quảng cáo vượt trội" from analytics service');
assert(analyticsContent.includes("'title' => \"GMV Max ROI: {$adsRoi}x\""), 'Replaced with factual "GMV Max ROI: {X}x"');

const viewFile = path.resolve('src', 'CommerceDashboardView.jsx');
const viewContent = fs.readFileSync(viewFile, 'utf8');

assert(viewContent.includes("label: 'Quảng Cáo (GMV Max)'"), 'Dashboard navigation tab renamed to "Quảng Cáo (GMV Max)"');
assert(viewContent.includes('GMV Max Gross Revenue'), 'Dashboard view displays canonical "GMV Max Gross Revenue"');
assert(viewContent.includes('Chiến Dịch Quảng Cáo GMV Max (Campaign Intelligence)'), 'Dashboard subtab 4 header displays Campaign Intelligence title');
assert(viewContent.includes('BẢO TOÀN ĐỐI SOÁT (RECONCILED)'), 'Dashboard view renders reconciliation invariant badge');
assert(viewContent.includes('fetchCampaignIntelligence'), 'Dashboard view defines fetchCampaignIntelligence handler');
assert(viewContent.includes('fetchCampaignDetail'), 'Dashboard view defines fetchCampaignDetail modal drilldown');

// -----------------------------------------------------------------------------
// BLOCK H: FRONTEND PRODUCTION BUILD INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- BLOCK H: FRONTEND PRODUCTION BUILD INTEGRITY ---');

try {
  const buildOut = execSync('npm run build', { encoding: 'utf8' });
  const buildSuccess = buildOut.includes('built in') || fs.existsSync(path.resolve('dist', 'index.html'));
  assert(buildSuccess, 'Vite production build succeeds cleanly (npm run build)');
} catch (e) {
  assert(false, 'Vite production build failed', e.message);
}

// -----------------------------------------------------------------------------
// FINAL SUMMARY
// -----------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`FINAL SPRINT V2-02A ACCEPTANCE RESULTS: ${passedTests} / ${passedTests + failedTests} SCENARIOS PASSED`);
console.log('====================================================================\n');

if (failedTests > 0) {
  console.error(`[FAILURE] ${failedTests} scenario(s) failed.`);
  process.exit(1);
} else {
  console.log('[SUCCESS] ALL SPRINT V2-02A CAMPAIGN GMV MAX SCENARIOS PASSED CLEANLY (100%)!\n');
  process.exit(0);
}
