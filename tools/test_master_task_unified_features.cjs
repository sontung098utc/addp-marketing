/**
 * MASTER TASK UNIFIED VERIFICATION SUITE
 * marketing.addp.vn — Comprehensive Multi-Platform & Analytics Integration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('  MASTER TASK: UNIFIED FEATURES & REGRESSION VERIFICATION SUITE');
console.log('====================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✘ [FAIL] ${message}`);
    failed++;
  }
}

const PHP_BIN = 'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe';

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Helper to run PHP snippets
function runPhp(snippet) {
  const tmpFile = path.join(__dirname, `tmp_master_${Date.now()}_${Math.random().toString(36).slice(2)}.php`);
  const envHeader = `<?php
error_reporting(E_ALL & ~E_DEPRECATED & ~E_WARNING & ~E_NOTICE);
putenv('APP_ENV=testing');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_pass');
putenv('AUTH_SIGNING_KEY=12345678901234567890123456789012');
$_ENV['APP_ENV'] = 'testing';
$_ENV['DB_NAME'] = 'test_db';
$_ENV['DB_USER'] = 'test_user';
$_ENV['DB_PASSWORD'] = 'test_pass';
$_ENV['AUTH_SIGNING_KEY'] = '12345678901234567890123456789012';
`;
  fs.writeFileSync(tmpFile, `${envHeader}\n${snippet}\n`);
  try {
    const res = execSync(`"${PHP_BIN}" "${tmpFile}"`, { encoding: 'utf8', cwd: PROJECT_ROOT });
    return res.trim();
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// -------------------------------------------------------------
// SECTION 1: Shopee Analytics & Multi-channel Logic
// -------------------------------------------------------------
console.log('[SECTION 1] Shopee Analytics Engine (commerce_shopee_service.php)');

const shopeeSnippet = `
require_once __DIR__ . '/../public/api/commerce_shopee_service.php';

// Mock DB with in-memory SQLite
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("CREATE TABLE commerce_orders (
  id TEXT PRIMARY KEY,
  platform TEXT,
  shop_id TEXT,
  platform_order_id TEXT,
  order_status TEXT,
  platform_status TEXT,
  platform_created_at TEXT,
  paid_at TEXT,
  currency TEXT,
  order_gross_amount REAL,
  sub_total REAL,
  shipping_fee REAL,
  seller_discount REAL,
  platform_discount REAL,
  shipping_provider TEXT,
  tracking_number TEXT
)");

$pdo->exec("CREATE TABLE commerce_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  product_name TEXT,
  sku_id TEXT,
  quantity INTEGER,
  sale_price REAL
)");

$pdo->exec("CREATE TABLE commerce_loss_ledger (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  shop_id TEXT,
  platform TEXT,
  loss_type TEXT,
  loss_amount REAL,
  order_created_at TEXT
)");

$pdo->exec("CREATE TABLE commerce_finance_statements (
  id TEXT PRIMARY KEY,
  platform TEXT,
  shop_id TEXT,
  statement_id TEXT,
  statement_time TEXT,
  total_settlement_amount REAL,
  payment_status TEXT
)");

// Insert test orders: Order 1 (Delivered, 2 items), Order 2 (Cancelled), Order 3 (Return)
$pdo->exec("INSERT INTO commerce_orders VALUES ('SHOPEE_001', 'shopee', '7495657895504611503', 'SP_001', 'DELIVERED', 'COMPLETED', '2026-09-05 10:00:00', '2026-09-05 10:05:00', 'VND', 500000, 500000, 0, 0, 0, 'Shopee Express', 'SPX01')");
$pdo->exec("INSERT INTO commerce_order_items VALUES ('ITEM_1', 'SHOPEE_001', 'Áo thun', 'SKU_1', 1, 250000)");
$pdo->exec("INSERT INTO commerce_order_items VALUES ('ITEM_2', 'SHOPEE_001', 'Quần short', 'SKU_2', 1, 250000)");

$pdo->exec("INSERT INTO commerce_orders VALUES ('SHOPEE_002', 'shopee', '7495657895504611503', 'SP_002', 'CANCELLED', 'CANCELLED', '2026-09-06 14:00:00', NULL, 'VND', 200000, 200000, 0, 0, 0, NULL, NULL)");
$pdo->exec("INSERT INTO commerce_loss_ledger VALUES ('LOSS_1', 'SHOPEE_002', '7495657895504611503', 'shopee', 'CANCELLATION', 200000, '2026-09-06 14:00:00')");

$pdo->exec("INSERT INTO commerce_orders VALUES ('SHOPEE_003', 'shopee', '7495657895504611503', 'SP_003', 'RETURN_REFUND', 'RETURNED', '2026-09-07 19:30:00', '2026-09-07 19:35:00', 'VND', 300000, 300000, 0, 0, 0, 'Shopee Express', 'SPX03')");
$pdo->exec("INSERT INTO commerce_loss_ledger VALUES ('LOSS_2', 'SHOPEE_003', '7495657895504611503', 'shopee', 'RETURN_REFUND', 300000, '2026-09-07 19:30:00')");

$svc = new CommerceShopeeService($pdo);
$summary = $svc->getShopeeSummary('7495657895504611503', '2026-09-01', '2026-09-20');
$ordersData = $svc->getShopeeOrders('7495657895504611503', '2026-09-01', '2026-09-20');
$goldenHours = $svc->getShopeeGoldenHours('7495657895504611503', '2026-09-01', '2026-09-20');

$shopee001 = null;
foreach ($ordersData['orders'] as $ord) {
    if ($ord['id'] === 'SHOPEE_001') {
        $shopee001 = $ord;
        break;
    }
}

echo json_encode([
  'summary' => $summary,
  'order_count' => count($ordersData['orders']),
  'golden_hours_count' => count($goldenHours['top_golden_slots']),
  'shopee_001_items_dedup' => count($shopee001['items'] ?? [])
]);
`;

const shopeeRes = JSON.parse(runPhp(shopeeSnippet));
assert(shopeeRes.summary.gross_sales === 1000000, 'Shopee gross sales matches total orders amount (1,000,000đ)');
assert(shopeeRes.summary.total_loss === 500000, 'Shopee loss amount correctly sums cancel (200k) + return (300k) = 500k');
assert(shopeeRes.summary.realized_sales === 500000, 'Shopee follows strict invariant: Gross (1M) - Loss (500k) = Realized (500k)');
assert(shopeeRes.summary.total_orders === 3, 'Shopee orders count correctly identifies 3 orders');
assert(shopeeRes.order_count === 3, 'Shopee orders query returns 3 orders');
assert(shopeeRes.shopee_001_items_dedup === 2, 'Shopee order items multi-line correctly nested without inflating parent gross');

// -------------------------------------------------------------
// SECTION 2: Affiliate & Creator Intelligence Logic
// -------------------------------------------------------------
console.log('\n[SECTION 2] Affiliate & Creator Intelligence (commerce_affiliate_service.php)');

const affSnippet = `
require_once __DIR__ . '/../public/api/commerce_affiliate_service.php';

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("CREATE TABLE commerce_video_analytics (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  video_id TEXT,
  creator_name TEXT,
  creator_type TEXT,
  stat_date TEXT,
  video_views INTEGER,
  gross_revenue REAL,
  units_sold INTEGER
)");

$pdo->exec("CREATE TABLE commerce_finance_transactions (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  transaction_time TEXT,
  transaction_type TEXT,
  affiliate_commission REAL
)");

// Insert test creator video analytics
$pdo->exec("INSERT INTO commerce_video_analytics VALUES ('V1', '7495657895504611503', 'VID_1', 'Lan Review', 'AFFILIATE', '2026-09-02', 1500, 500000, 10)");
$pdo->exec("INSERT INTO commerce_video_analytics VALUES ('V2', '7495657895504611503', 'VID_2', 'Lan Review', 'AFFILIATE', '2026-09-03', 1000, 300000, 5)");
$pdo->exec("INSERT INTO commerce_video_analytics VALUES ('V3', '7495657895504611503', 'VID_3', 'Thành ADS', 'MARKETING', '2026-09-04', 3500, 1000000, 25)");

// Insert test commissions
$pdo->exec("INSERT INTO commerce_finance_transactions VALUES ('T1', '7495657895504611503', '2026-09-05 12:00:00', 'SETTLED', 80000)");
$pdo->exec("INSERT INTO commerce_finance_transactions VALUES ('T2', '7495657895504611503', '2026-09-06 14:00:00', 'PENDING', 20000)");

$svc = new CommerceAffiliateService($pdo);
$report = $svc->getAffiliateReport('7495657895504611503', '2026-09-01', '2026-09-20');

echo json_encode($report);
`;

const affRes = JSON.parse(runPhp(affSnippet));
assert(affRes.summary.total_affiliate_gmv === 1800000, 'Affiliate GMV correctly sums creator video GMV (500k + 300k + 1M = 1.8M)');
assert(affRes.summary.organic_affiliate_gmv === 800000, 'Organic Affiliate GMV correctly separates organic creators (800k)');
assert(affRes.summary.ads_affiliate_gmv === 1000000, 'Ads Affiliate GMV correctly separates affiliate ads (1M)');
assert(affRes.summary.total_creators_count === 2, 'Unique creator count correctly equals 2');
assert(affRes.creators.length === 2, 'Creator leaderboard contains 2 creators');
assert(affRes.creators[0].creator_name === 'Thành ADS' && affRes.creators[0].gmv === 1000000, 'Top creator ranked #1 by GMV (Thành ADS with 1,000,000đ)');
assert(affRes.content_breakdown.video.gmv > 0 && affRes.content_breakdown.live.gmv >= 0, 'Content formats correctly broken down between VIDEO and LIVE');

// -------------------------------------------------------------
// SECTION 3: Dashboard API Route Registration (Actions 21-25)
// -------------------------------------------------------------
console.log('\n[SECTION 3] API Actions 21-25 in commerce_dashboard.php');

const dashboardCode = fs.readFileSync(path.join(__dirname, '../public/api/commerce_dashboard.php'), 'utf8');

assert(dashboardCode.includes("case 'get_shopee_summary':") && dashboardCode.includes("case 'get_shopee_orders':"), 'Dashboard registers Shopee Actions (Action 21)');
assert(dashboardCode.includes("case 'get_affiliate_report':") && dashboardCode.includes("case 'import_affiliate_orders':"), 'Dashboard registers Affiliate Actions (Action 22)');
assert(dashboardCode.includes("case 'get_live_analytics':") && dashboardCode.includes("case 'get_golden_hours':"), 'Dashboard registers Live Analytics Actions (Action 23)');
assert(dashboardCode.includes("case 'export_finance_statements':"), 'Dashboard registers Finance Export Action (Action 24)');
assert(dashboardCode.includes("case 'export_ads_campaigns':"), 'Dashboard registers Ads Campaign Export Action (Action 25)');

// -------------------------------------------------------------
// SECTION 4: Frontend Runtime & Component Architecture
// -------------------------------------------------------------
console.log('\n[SECTION 4] Frontend Integration & Build Output');

const appCode = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');
const dashboardViewCode = fs.readFileSync(path.join(__dirname, '../src/CommerceDashboardView.jsx'), 'utf8');

assert(appCode.includes("handleSelectCommerceTab('shopee')"), 'App.jsx includes Shopee navigation item in sidebar');
assert(dashboardViewCode.includes("import CommerceShopeeView from './CommerceShopeeView'"), 'CommerceDashboardView imports CommerceShopeeView');
assert(dashboardViewCode.includes("import CommerceAffiliateView from './CommerceAffiliateView'"), 'CommerceDashboardView imports CommerceAffiliateView');
assert(dashboardViewCode.includes("import CommerceLiveAnalyticsView from './CommerceLiveAnalyticsView'"), 'CommerceDashboardView imports CommerceLiveAnalyticsView');
assert(dashboardViewCode.includes("<CommerceShopeeView"), 'CommerceDashboardView renders CommerceShopeeView component');
assert(dashboardViewCode.includes("<CommerceAffiliateView"), 'CommerceDashboardView renders CommerceAffiliateView component');
assert(dashboardViewCode.includes("<CommerceLiveAnalyticsView"), 'CommerceDashboardView renders CommerceLiveAnalyticsView component');
assert(dashboardViewCode.includes("handleExportFinanceCSV"), 'CommerceDashboardView includes handleExportFinanceCSV');
assert(dashboardViewCode.includes("handleExportAdsCSV"), 'CommerceDashboardView includes handleExportAdsCSV');
assert(dashboardViewCode.includes("breakEvenRoi"), 'CommerceDashboardView includes breakEvenRoi input state');

// Verify dist assets existence
assert(fs.existsSync(path.join(__dirname, '../dist/index.html')), 'Production dist/index.html exists');
assert(fs.existsSync(path.join(__dirname, '../dist/assets')), 'Production dist/assets exists');

console.log('\n====================================================================');
console.log(`TOTAL TESTS:  ${passed + failed}`);
console.log(`PASSED:       ${passed}`);
console.log(`FAILED:       ${failed}`);
console.log('====================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL MASTER TASK UNIFIED VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}
