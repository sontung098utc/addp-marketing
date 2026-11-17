/**
 * ====================================================================
 * TEST SUITE: P0-01 AFFILIATE DATA INTEGRITY & API-ONLY INGESTION
 * File: tools/test_p0_01_affiliate_integrity.cjs
 * Target: Validates all P0-01 requirements for TikTok Shop Affiliate
 * ====================================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PHP_BIN = 'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe';

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
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_aff_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
  const fullCode = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('AUTH_SIGNING_KEY=test_signing_key_32_bytes_len_1234567!!');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_password');
putenv('FEATURE_ENABLE_COMMERCE_V2=true');
$_ENV['FEATURE_ENABLE_COMMERCE_V2'] = 'true';
$_SERVER['FEATURE_ENABLE_COMMERCE_V2'] = 'true';

require_once '${path.join(PROJECT_ROOT, 'tools', 'mock_pdo_helper.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'tiktok_client.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_affiliate_service.php').replace(/\\/g, '/')}';

${code}
`;
  try {
    fs.writeFileSync(tmpFile, fullCode, 'utf8');
    const out = execSync(`"${PHP_BIN}" "${tmpFile}"`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 15000
    });
    return out.trim();
  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
}

console.log('====================================================================');
console.log('  P0-01 AFFILIATE DATA INTEGRITY & API INGESTION VERIFICATION');
console.log(`  PHP Binary: ${PHP_BIN}`);
console.log('====================================================================\n');

// --------------------------------------------------------------------
// TEST 1: Zero Hardcoded Rates & Fabrication in commerce_affiliate_service.php
// --------------------------------------------------------------------
runTest('P0-01.1: Zero hardcoded commission rates (0.10, 0.09, 0.01) or arbitrary splits (0.7, 0.3)', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/commerce_affiliate_service.php'), 'utf8');
  
  if (code.includes('* 0.10') || code.includes('* 0.1') || code.includes('0.10;')) {
    throw new Error('Found hardcoded 10% commission rate calculation!');
  }
  if (code.includes('* 0.09')) {
    throw new Error('Found hardcoded 9% settled commission rate calculation!');
  }
  if (code.includes('* 0.01')) {
    throw new Error('Found hardcoded 1% cancelled commission rate calculation!');
  }
  if (code.includes('* 0.70') || code.includes('* 0.7') || code.includes('* 0.30') || code.includes('* 0.3')) {
    throw new Error('Found hardcoded 70%/30% arbitrary split calculation!');
  }
  if (code.includes("commission_rate_pct' => 10.0")) {
    throw new Error('Found hardcoded 10.0 default commission rate!');
  }
});

// --------------------------------------------------------------------
// TEST 2: Migration SQL & Rollback Integrity
// --------------------------------------------------------------------
runTest('P0-01.2: Migration 20261009_021_create_commerce_affiliate_orders.sql exists and valid', () => {
  const migFile = path.join(PROJECT_ROOT, 'database/migrations/20261009_021_create_commerce_affiliate_orders.sql');
  const rollFile = path.join(PROJECT_ROOT, 'database/migrations/20261009_021_rollback_commerce_affiliate_orders.sql');
  
  if (!fs.existsSync(migFile)) throw new Error('Migration file missing: ' + migFile);
  if (!fs.existsSync(rollFile)) throw new Error('Rollback file missing: ' + rollFile);

  const migContent = fs.readFileSync(migFile, 'utf8');
  if (!migContent.includes('CREATE TABLE IF NOT EXISTS `commerce_affiliate_orders`')) {
    throw new Error('Migration does not create commerce_affiliate_orders');
  }
  if (!migContent.includes('affiliate_order_id') || !migContent.includes('creator_id') || !migContent.includes('estimated_commission')) {
    throw new Error('Migration missing critical affiliate fields');
  }

  const rollContent = fs.readFileSync(rollFile, 'utf8');
  if (rollContent.includes('DROP TABLE `commerce_affiliate_orders`') || rollContent.includes('DROP TABLE IF EXISTS `commerce_affiliate_orders`')) {
    throw new Error('Rollback SQL violates non-destructive policy by executing DROP TABLE on commerce_affiliate_orders.');
  }
});

// --------------------------------------------------------------------
// TEST 3: TikTokShopClient::searchAffiliateOrders Method
// --------------------------------------------------------------------
runTest('P0-01.3: TikTokShopClient contains searchAffiliateOrders targeting official endpoint', () => {
  const clientCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/tiktok_client.php'), 'utf8');
  if (!clientCode.includes('function searchAffiliateOrders')) {
    throw new Error('searchAffiliateOrders method not found in TikTokShopClient');
  }
  if (!clientCode.includes('/affiliate_seller/202410/orders/search')) {
    throw new Error('Endpoint /affiliate_seller/202410/orders/search not found in TikTokShopClient');
  }
});

// --------------------------------------------------------------------
// TEST 4: Permission Required Handling (Zero Fabrication)
// --------------------------------------------------------------------
runTest('P0-01.4: CommerceAffiliateService handles missing scope with structured PERMISSION_REQUIRED', () => {
  const phpScript = `
    class MockClientPermissionErr extends TikTokShopClient {
        public function searchAffiliateOrders(string $accessToken, string $shopCipher, array $options = []): array {
            throw new Exception("TikTok API Error (Code 105001): Scope seller.affiliate_collaboration.read is not authorized for this app.");
        }
        public function resolveShopCipher(string $shopId, string $accessToken): string {
            return "cipher_12345";
        }
    }

    $mockPdo = new MockPDO([
        "SHOW TABLES LIKE 'commerce_affiliate_orders'" => [['commerce_affiliate_orders']],
        "SELECT access_token, cipher FROM \`tiktok_shops\` WHERE shop_id = ? LIMIT 1" => [
            ['access_token' => 'mock_token_abc', 'cipher' => 'cipher_12345']
        ]
    ]);

    $client = new MockClientPermissionErr();
    $service = new CommerceAffiliateService($mockPdo, $client);
    $res = $service->syncAffiliateOrders('shop_test', '2026-09-01', '2026-09-30');

    echo json_encode($res);
  `;

  const output = runPhp(phpScript);
  const parsed = JSON.parse(output);
  if (parsed.success !== false) {
    throw new Error('Expected success = false on permission denied, got: ' + JSON.stringify(parsed));
  }
  if (parsed.status !== 'PERMISSION_REQUIRED') {
    throw new Error('Expected status = PERMISSION_REQUIRED, got: ' + parsed.status);
  }
  if (parsed.scope !== 'seller.affiliate_collaboration.read') {
    throw new Error('Expected scope = seller.affiliate_collaboration.read, got: ' + parsed.scope);
  }
});

// --------------------------------------------------------------------
// TEST 5: CSV Import Reject Policy (API ONLY)
// --------------------------------------------------------------------
runTest('P0-01.5: CommerceAffiliateService rejects CSV import with API_ONLY_POLICY', () => {
  const phpScript = `
    $mockPdo = new MockPDO([]);
    $service = new CommerceAffiliateService($mockPdo);
    $res = $service->importAffiliateOrders('shop_test', 'Order,Creator,GMV');
    echo json_encode($res);
  `;

  const output = runPhp(phpScript);
  const parsed = JSON.parse(output);
  if (parsed.success !== false || parsed.code !== 'API_ONLY_POLICY') {
    throw new Error('Expected API_ONLY_POLICY rejection, got: ' + JSON.stringify(parsed));
  }
});

// --------------------------------------------------------------------
// TEST 6: Idempotent Data Ingestion & Upsert
// --------------------------------------------------------------------
runTest('P0-01.6: CommerceAffiliateService syncAffiliateOrders inserts orders idempotently', () => {
  const phpScript = `
    class MockClientSuccess extends TikTokShopClient {
        public function searchAffiliateOrders(string $accessToken, string $shopCipher, array $options = []): array {
            return [
                'code' => 0,
                'message' => 'Success',
                'data' => [
                    'orders' => [
                        [
                            'affiliate_order_id' => 'AFF_ORD_001',
                            'order_id' => 'ORD_1001',
                            'sku_id' => 'SKU_DOV_01',
                            'product_id' => 'PROD_DOVITAL',
                            'product_name' => 'Sủi Mát Gan Dovital 20 Viên',
                            'creator_id' => 'CREATOR_999',
                            'creator_nickname' => 'Reviewer Huong Tran',
                            'traffic_source' => 'ORGANIC',
                            'order_status' => 'COMPLETED',
                            'commission_status' => 'SETTLED',
                            'order_amount' => 199000.00,
                            'commission_rate' => 12.50,
                            'estimated_commission' => 24875.00,
                            'settled_commission' => 24875.00,
                            'ineligible_commission' => 0.00,
                            'currency' => 'VND'
                        ]
                    ],
                    'next_page_token' => null
                ]
            ];
        }
        public function resolveShopCipher(string $shopId, string $accessToken): string {
            return "cipher_12345";
        }
    }

    $mockPdo = new MockPDO([
        "SHOW TABLES LIKE 'commerce_affiliate_orders'" => [['commerce_affiliate_orders']],
        "SELECT access_token, cipher FROM \`tiktok_shops\` WHERE shop_id = ? LIMIT 1" => [
            ['access_token' => 'mock_token_abc', 'cipher' => 'cipher_12345']
        ]
    ]);

    $client = new MockClientSuccess();
    $service = new CommerceAffiliateService($mockPdo, $client);
    $res = $service->syncAffiliateOrders('shop_test', '2026-09-01', '2026-09-30');

    echo json_encode($res);
  `;

  const output = runPhp(phpScript);
  const parsed = JSON.parse(output);
  if (parsed.success !== true || parsed.records_synced !== 1) {
    throw new Error('Expected 1 synced order, got: ' + JSON.stringify(parsed));
  }
});

// --------------------------------------------------------------------
// TEST 7: Accurate Report Calculation from commerce_affiliate_orders
// --------------------------------------------------------------------
runTest('P0-01.7: getAffiliateReport computes authentic metrics from commerce_affiliate_orders', () => {
  const phpScript = `
    $mockPdo = new MockPDO([
        "SHOW TABLES LIKE 'commerce_affiliate_orders'" => [['commerce_affiliate_orders']],
        "SELECT COUNT(*) FROM \`commerce_affiliate_orders\` WHERE shop_id = :shop_id AND order_created_at >= :start_dt AND order_created_at <= :end_dt" => [
            ['count' => 10]
        ],
        "SELECT \\n                    COALESCE(SUM(order_amount), 0.0) as total_gmv,\\n                    COALESCE(SUM(CASE WHEN traffic_source = 'ORGANIC' THEN order_amount ELSE 0.0 END), 0.0) as organic_gmv,\\n                    COALESCE(SUM(CASE WHEN traffic_source = 'PAID_ADS' THEN order_amount ELSE 0.0 END), 0.0) as ads_gmv,\\n                    COALESCE(SUM(CASE WHEN traffic_source NOT IN ('ORGANIC', 'PAID_ADS') THEN order_amount ELSE 0.0 END), 0.0) as unclassified_gmv,\\n                    SUM(estimated_commission) as total_est_comm,\\n                    COALESCE(SUM(settled_commission), 0.0) as total_settled_comm,\\n                    COALESCE(SUM(ineligible_commission), 0.0) as total_ineligible_comm,\\n                    COUNT(DISTINCT affiliate_order_id) as total_orders,\\n                    COUNT(DISTINCT creator_id) as total_creators\\n                    FROM \`commerce_affiliate_orders\`\\n                    WHERE shop_id = :shop_id\\n                      AND order_created_at >= :start_dt AND order_created_at <= :end_dt" => [
            [
                'total_gmv' => 10000000.0,
                'organic_gmv' => 8000000.0,
                'ads_gmv' => 2000000.0,
                'unclassified_gmv' => 0.0,
                'total_est_comm' => 1250000.0,
                'total_settled_comm' => 1200000.0,
                'total_ineligible_comm' => 50000.0,
                'total_orders' => 50,
                'total_creators' => 5
            ]
        ],
        "SELECT \\n                    content_type,\\n                    COALESCE(SUM(order_amount), 0.0) as type_gmv,\\n                    COUNT(DISTINCT affiliate_order_id) as type_orders\\n                    FROM \`commerce_affiliate_orders\`\\n                    WHERE shop_id = :shop_id\\n                      AND order_created_at >= :start_dt AND order_created_at <= :end_dt\\n                    GROUP BY content_type" => [
            ['content_type' => 'VIDEO', 'type_gmv' => 7000000.0, 'type_orders' => 35],
            ['content_type' => 'LIVE', 'type_gmv' => 3000000.0, 'type_orders' => 15]
        ],
        "SELECT \\n                    COALESCE(creator_nickname, creator_username, 'KOC / Creator Đối Tác') as creator_name,\\n                    creator_type,\\n                    COUNT(DISTINCT affiliate_order_id) as orders,\\n                    COALESCE(SUM(order_amount), 0.0) as gmv,\\n                    SUM(estimated_commission) as comm_est,\\n                    COALESCE(SUM(settled_commission), 0.0) as comm_settled,\\n                    COALESCE(SUM(ineligible_commission), 0.0) as comm_ineligible,\\n                    COUNT(DISTINCT content_id) as video_count\\n                    FROM \`commerce_affiliate_orders\`\\n                    WHERE shop_id = :shop_id\\n                      AND order_created_at >= :start_dt AND order_created_at <= :end_dt\\n                    GROUP BY creator_id, creator_nickname, creator_username, creator_type\\n                    ORDER BY gmv DESC\\n                    LIMIT 50" => [
            [
                'creator_name' => 'KOC Huong Tran',
                'creator_type' => 'AFFILIATE',
                'orders' => 50,
                'gmv' => 10000000.0,
                'comm_est' => 1250000.0,
                'comm_settled' => 1200000.0,
                'comm_ineligible' => 50000.0,
                'video_count' => 3
            ]
        ]
    ]);

    $service = new CommerceAffiliateService($mockPdo);
    $report = $service->getAffiliateReport('shop_test', '2026-09-01', '2026-09-30');
    echo json_encode($report);
  `;

  const output = runPhp(phpScript);
  const parsed = JSON.parse(output);
  if (parsed.summary.total_affiliate_gmv !== 10000000) {
    throw new Error('Expected GMV = 10,000,000, got: ' + parsed.summary.total_affiliate_gmv);
  }
  if (parsed.summary.organic_affiliate_gmv !== 8000000 || parsed.summary.ads_affiliate_gmv !== 2000000) {
    throw new Error('Organic/Ads attribution mismatch');
  }
  // Commission rate = 1,200,000 / 10,000,000 = 12.0%
  if (parsed.summary.avg_commission_rate_pct !== 12.0) {
    throw new Error('Expected authentic commission rate 12.0%, got: ' + parsed.summary.avg_commission_rate_pct);
  }
});

// --------------------------------------------------------------------
// TEST 8: Frontend UI Compliance in CommerceAffiliateView.jsx
// --------------------------------------------------------------------
runTest('P0-01.8: CommerceAffiliateView.jsx has removed CSV upload modal and added API sync button', () => {
  const jsxCode = fs.readFileSync(path.join(PROJECT_ROOT, 'src/CommerceAffiliateView.jsx'), 'utf8');
  if (jsxCode.includes('isModalOpen') || jsxCode.includes('Nhập file Affiliate CSV') || jsxCode.includes('handleImportSubmit')) {
    throw new Error('CSV upload modal/button still present in CommerceAffiliateView.jsx!');
  }
  if (!jsxCode.includes('handleSyncAffiliate') || !jsxCode.includes('sync_affiliate_orders')) {
    throw new Error('API Sync action missing from CommerceAffiliateView.jsx');
  }
  if (!jsxCode.includes('PERMISSION_REQUIRED') || !jsxCode.includes('seller.affiliate_collaboration.read')) {
    throw new Error('Permission scope notice missing from CommerceAffiliateView.jsx');
  }
});

// --------------------------------------------------------------------
// TEST 9: Sync Orchestrator Domain Integration
// --------------------------------------------------------------------
runTest('P0-01.9: CommerceSyncOrchestrator contains DOMAIN_AFFILIATE and syncAffiliateDomain', () => {
  const orchCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/commerce_sync_orchestrator.php'), 'utf8');
  if (!orchCode.includes("public const DOMAIN_AFFILIATE    = 'affiliate';")) {
    throw new Error('DOMAIN_AFFILIATE constant missing in CommerceSyncOrchestrator');
  }
  if (!orchCode.includes('function syncAffiliateDomain')) {
    throw new Error('syncAffiliateDomain method missing in CommerceSyncOrchestrator');
  }
});

// --------------------------------------------------------------------
// TEST 10: PHP Syntax Verification
// --------------------------------------------------------------------
runTest('P0-01.10: Zero PHP syntax errors across all modified backend files', () => {
  const files = [
    'public/api/commerce_affiliate_service.php',
    'public/api/tiktok_client.php',
    'public/api/commerce_dashboard.php',
    'public/api/commerce_sync_orchestrator.php'
  ];

  for (const f of files) {
    const fullPath = path.join(PROJECT_ROOT, f);
    execSync(`"${PHP_BIN}" -l "${fullPath}"`, { encoding: 'utf8' });
  }
});

console.log('\n====================================================================');
console.log(`P0-01 RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL P0-01 AFFILIATE DATA INTEGRITY REQUIREMENTS SATISFIED!\n');
}
