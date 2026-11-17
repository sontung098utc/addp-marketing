/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SPRINT V2-05.2.2 REGRESSION TEST SUITE
 * Test: Customer 360 Trust Status & Priority Recovery UX Fix
 * File: tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs
 * Requirements: 17 Regression Test Cases (Section 9)
 * ====================================================================
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

function resolvePhpCommand() {
  const candidates = [
    process.env.PHP_BINARY_PATH,
    'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe',
    'C:\\xampp\\php\\php.exe',
    'C:\\php\\php.exe',
    'php'
  ];
  let chosenBin = 'php';
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      chosenBin = c;
      break;
    }
  }

  return `"${chosenBin}"`;
}

const phpCmd = resolvePhpCommand();
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('====================================================================');
console.log('  SPRINT V2-05.2.2: CUSTOMER 360 TRUST & PRIORITY UX TEST SUITE (17 TESTS)');
console.log(`  Resolved PHP Command: ${phpCmd}`);
console.log('====================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runPhpCode(code, envOverrides = {}) {
  const tempScript = path.join(__dirname, `_temp_v2_05_2_2_test_${Date.now()}_${Math.floor(Math.random() * 1000)}.php`);
  
  let envPuts = '';
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === null) {
      envPuts += `putenv('${k}'); unset($_ENV['${k}']); unset($_SERVER['${k}']);\n`;
    } else {
      const escaped = v.replace(/'/g, "\\'");
      envPuts += `putenv('${k}=${escaped}'); $_ENV['${k}'] = '${escaped}'; $_SERVER['${k}'] = '${escaped}';\n`;
    }
  }

  const wrappedCode = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_password');
putenv('FEATURE_ENABLE_COMMERCE_V2=true');
$_ENV['FEATURE_ENABLE_COMMERCE_V2'] = 'true';
$_SERVER['FEATURE_ENABLE_COMMERCE_V2'] = 'true';
putenv('CUSTOMER_IDENTITY_HMAC_KEY=cust_hmac_secret_key_32_bytes_test_ok!');
$_ENV['CUSTOMER_IDENTITY_HMAC_KEY'] = 'cust_hmac_secret_key_32_bytes_test_ok!';
$_SERVER['CUSTOMER_IDENTITY_HMAC_KEY'] = 'cust_hmac_secret_key_32_bytes_test_ok!';
putenv('CUSTOMER_RECIPIENT_ENCRYPTION_KEY=cust_enc_aes256gcm_32b_secret_key!');
$_ENV['CUSTOMER_RECIPIENT_ENCRYPTION_KEY'] = 'cust_enc_aes256gcm_32b_secret_key!';
$_SERVER['CUSTOMER_RECIPIENT_ENCRYPTION_KEY'] = 'cust_enc_aes256gcm_32b_secret_key!';
putenv('AUTH_SIGNING_KEY=auth_signing_key_32_bytes_test_ok_12345');
putenv('TIKTOK_APP_SECRET=tiktok_partner_secret_test_ok_12345');
${envPuts}
${code}
`;

  fs.writeFileSync(tempScript, wrappedCode, 'utf8');
  try {
    const output = execSync(`${phpCmd} "${tempScript}"`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 30000
    });
    return { success: true, output: output.trim() };
  } catch (err) {
    return {
      success: false,
      output: (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : err.message)
    };
  } finally {
    try {
      if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    } catch (e) {}
  }
}

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         ${err.message}`);
  }
}

const VALID_HMAC_KEY = 'c7a8b9e0f1d2c3b4a5968778695a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a';
const VALID_ENC_KEY  = 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2';

// Helper to create SQLite test DB with commerce_orders, commerce_order_recipients, commerce_customer_profiles
function getSqliteInitPhpCode() {
  return `
    $pdo = new PDO('sqlite::memory:');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create tables
    $pdo->exec("CREATE TABLE commerce_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      shop_id TEXT,
      platform_order_id TEXT,
      order_status TEXT,
      order_gross_amount REAL,
      platform_created_at TEXT
    );");

    $pdo->exec("CREATE TABLE commerce_order_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      shop_id TEXT,
      platform_order_id TEXT,
      customer_identifier_hash TEXT,
      phone_hash TEXT,
      identity_method TEXT,
      recipient_name_encrypted TEXT,
      phone_encrypted TEXT,
      address_full_encrypted TEXT,
      phone_masked TEXT,
      address_masked TEXT,
      province TEXT,
      district TEXT,
      ward TEXT,
      postal_code TEXT,
      is_masked_by_platform INTEGER,
      synced_at TEXT
    );");

    $pdo->exec("CREATE TABLE commerce_customer_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      shop_id TEXT,
      customer_identifier_hash TEXT,
      identity_method TEXT,
      customer_display_name TEXT,
      phone_masked TEXT,
      province TEXT,
      total_orders_count INTEGER,
      order_gross_amount REAL,
      realized_purchase_value REAL,
      cancelled_orders_count INTEGER,
      refund_amount REAL,
      return_refund_count INTEGER,
      first_order_at TEXT,
      last_order_at TEXT
    );");

    $pdo->exec("CREATE TABLE commerce_loss_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      shop_id TEXT,
      platform_order_id TEXT,
      loss_type TEXT,
      loss_amount REAL,
      effective_at TEXT
    );");
  `;
}

// =====================================================================
// SECTION 1: SQL ALIASES & AMBIGUITY REGRESSION (Test 1)
// =====================================================================
console.log('\n[SECTION 1] SQL Table Alias Integrity (Test 1)');

test('1. Trust SQL uses explicit alias `o` in WHERE conditions to prevent ambiguous column errors', () => {
  const custServiceFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_customer_service.php'), 'utf8');
  const trustSec = custServiceFile.slice(custServiceFile.indexOf('function getCustomerTrustMetrics'));
  const trustBody = trustSec.slice(0, trustSec.indexOf('function getCustomerList'));

  assert(trustBody.includes('"o.platform = ?"'), 'whereOrders must explicitly prefix platform with o.');
  assert(trustBody.includes('"o.shop_id = ?"'), 'whereOrders must explicitly prefix shop_id with o.');
  assert(trustBody.includes('o.platform_created_at >='), 'whereOrders must prefix platform_created_at with o.');
  assert(trustBody.includes('FROM `commerce_orders` o'), 'Total orders query must alias commerce_orders as o');

  // Verify in SQLite execution that query with both tables having `platform` and `shop_id` succeeds cleanly
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    // Insert 1 order and 1 recipient
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_1', 'COMPLETED', 100000, '2026-10-02 10:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, customer_identifier_hash, identity_method, synced_at) VALUES ('tiktok_shop', 'shop1', 'ord_1', 'hash_1', 'USER_ID', '2026-10-02 10:00:00');");

    $metrics = $svc->getCustomerTrustMetrics('shop1', '2026-10-01', '2026-10-07');
    echo json_encode($metrics);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'AVAILABLE');
  assert.strictEqual(data.total_orders, 1);
  assert.strictEqual(data.matched_orders, 1);
});

// =====================================================================
// SECTION 2: TRUST STATUS SEMANTICS (Tests 2-5)
// =====================================================================
console.log('\n[SECTION 2] Trust Status Truthful Semantics (Tests 2-5)');

test('2. September 01-20 with orders but zero verified identities does not return misleading CUSTOMER_DATA_NOT_INGESTED', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    // Simulate September 01-20 with 2777 orders, no verified recipient
    for ($i = 1; $i <= 10; $i++) {
      $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'sep_ord_' || $i, 'COMPLETED', 100000, '2026-09-05 10:00:00');");
      $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, identity_method) VALUES ('tiktok_shop', 'shop1', 'sep_ord_' || $i, 'UNMATCHED');");
    }
    // Also simulate lifetime profiles exist elsewhere (e.g. October)
    $pdo->exec("INSERT INTO commerce_customer_profiles (platform, shop_id, customer_identifier_hash, identity_method, total_orders_count) VALUES ('tiktok_shop', 'shop1', 'oct_cust_1', 'USER_ID', 1);");

    $metrics = $svc->getCustomerTrustMetrics('shop1', '2026-09-01', '2026-09-20');
    echo json_encode($metrics);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.notStrictEqual(data.status, 'CUSTOMER_DATA_NOT_INGESTED', 'Must not return misleading CUSTOMER_DATA_NOT_INGESTED');
  assert(!data.message.includes('Nhấn Đồng bộ'), 'Message must not misleadingly prompt to click Sync');
  assert(!data.message.includes('chưa đồng bộ'), 'Message must not claim data was not synced');
});

test('3. Zero identity historical period returns NO_VERIFIED_IDENTITY_IN_PERIOD with exact message', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_sep', 'COMPLETED', 100000, '2026-09-10 10:00:00');");

    $metrics = $svc->getCustomerTrustMetrics('shop1', '2026-09-01', '2026-09-20');
    echo json_encode($metrics);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'NO_VERIFIED_IDENTITY_IN_PERIOD');
  assert(data.message.includes('Chưa có danh tính khách hàng xác thực trong kỳ đã chọn'));
  assert(data.message.includes('TikTok bảo vệ/che mờ'));
});

test('4. AVAILABLE when matched_orders > 0', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'oct_1', 'COMPLETED', 100000, '2026-10-02 10:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, customer_identifier_hash, identity_method) VALUES ('tiktok_shop', 'shop1', 'oct_1', 'cust_hash_1', 'USER_ID');");

    $metrics = $svc->getCustomerTrustMetrics('shop1', '2026-10-01', '2026-10-07');
    echo json_encode($metrics);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'AVAILABLE');
});

test('5. Partial coverage calculated correctly (e.g. 164/709 = 23.1%)', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    // Insert 164 matched orders and 545 unmatched orders = 709 total
    for ($i = 1; $i <= 164; $i++) {
      $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'm_' || $i, 'COMPLETED', 100000, '2026-10-02 10:00:00');");
      $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, customer_identifier_hash, identity_method) VALUES ('tiktok_shop', 'shop1', 'm_' || $i, 'cust_' || $i, 'USER_ID');");
    }
    for ($i = 1; $i <= 545; $i++) {
      $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'u_' || $i, 'COMPLETED', 100000, '2026-10-02 10:00:00');");
      $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, identity_method) VALUES ('tiktok_shop', 'shop1', 'u_' || $i, 'UNMATCHED');");
    }

    $metrics = $svc->getCustomerTrustMetrics('shop1', '2026-10-01', '2026-10-07');
    echo json_encode($metrics);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.total_orders, 709);
  assert.strictEqual(data.matched_orders, 164);
  assert.strictEqual(data.unmatched_orders, 545);
  assert.strictEqual(data.identity_coverage_pct, 23.1);
  assert(data.message.includes('164/709'));
  assert(data.message.includes('23,1%'));
  assert(data.message.includes('545 đơn chưa có danh tính xác thực'));
});

// =====================================================================
// SECTION 3: PRIORITY RECOVERY SELECTOR & DYNAMIC COUNT (Tests 6-8)
// =====================================================================
console.log('\n[SECTION 3] Priority Recovery Selector & Dynamic Count (Tests 6-8)');

test('6. priority count uses unmatched active selector (AWAITING_SHIPMENT & IN_TRANSIT only)', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_sync_service.php';
    $sync = new CommerceSyncService($pdo);

    // Active orders needing capture
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_await', 'AWAITING_SHIPMENT', '2026-10-06 10:00:00');");
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_transit', 'IN_TRANSIT', '2026-10-06 11:00:00');");
    
    // Inactive orders without recipient - MUST BE EXCLUDED
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_deliv', 'DELIVERED', '2026-10-01 10:00:00');");
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_comp', 'COMPLETED', '2026-10-01 10:00:00');");
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_canc', 'CANCELLED', '2026-10-01 10:00:00');");

    $count = $sync->getRemainingPriorityOrdersCount('shop1');
    echo json_encode(['count' => $count]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.count, 2, 'Only AWAITING_SHIPMENT and IN_TRANSIT orders must be counted');
});

test('7. matched USER_ID recipient excluded from priority count', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_sync_service.php';
    $sync = new CommerceSyncService($pdo);

    // Order 1: AWAITING_SHIPMENT, MATCHED via USER_ID -> EXCLUDED
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_matched_1', 'AWAITING_SHIPMENT', '2026-10-06 10:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, identity_method) VALUES ('tiktok_shop', 'shop1', 'ord_matched_1', 'USER_ID');");

    // Order 2: IN_TRANSIT, MATCHED via PHONE_HMAC -> EXCLUDED
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_matched_2', 'IN_TRANSIT', '2026-10-06 11:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, identity_method) VALUES ('tiktok_shop', 'shop1', 'ord_matched_2', 'PHONE_HMAC');");

    // Order 3: IN_TRANSIT, UNMATCHED -> INCLUDED
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_unmatched', 'IN_TRANSIT', '2026-10-06 12:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, identity_method) VALUES ('tiktok_shop', 'shop1', 'ord_unmatched', 'UNMATCHED');");

    // Order 4: AWAITING_SHIPMENT, no recipient row at all -> INCLUDED
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_no_recip', 'AWAITING_SHIPMENT', '2026-10-06 13:00:00');");

    $count = $sync->getRemainingPriorityOrdersCount('shop1');
    echo json_encode(['count' => $count]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.count, 2, 'Matched USER_ID and PHONE_HMAC must be excluded from priority count');
});

test('8. remaining_priority_count=0 hides/disables recovery action in UI without hardcoded count', () => {
  const jsxContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceDashboardView.jsx'), 'utf8');

  assert(!jsxContent.includes('Thu thập ưu tiên (164 đơn)'), 'Must not contain hardcoded "(164 đơn)"');
  assert(jsxContent.includes('Không có đơn cần thu thập ưu tiên'), 'Must display "Không có đơn cần thu thập ưu tiên" when count is 0');
  assert(jsxContent.includes('remainingPriorityCount === 0'), 'Button must check remainingPriorityCount === 0');
});

// =====================================================================
// SECTION 4: SEPARATION OF LIFETIME VS PERIOD CUSTOMER METRICS (Test 9)
// =====================================================================
console.log('\n[SECTION 4] Lifetime vs Period Customer Separation (Test 9)');

test('9. lifetime profiles not used as period customer count', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    // Insert 168 lifetime profiles
    for ($i = 1; $i <= 168; $i++) {
      $pdo->exec("INSERT INTO commerce_customer_profiles (platform, shop_id, customer_identifier_hash, identity_method, total_orders_count, first_order_at) VALUES ('tiktok_shop', 'shop1', 'cust_' || $i, 'USER_ID', 1, '2026-10-02 10:00:00');");
    }

    // Orders exist in September 01-20 (unmatched)
    for ($i = 1; $i <= 5; $i++) {
      $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'sep_' || $i, 'COMPLETED', 100000, '2026-09-05 10:00:00');");
      $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, identity_method) VALUES ('tiktok_shop', 'shop1', 'sep_' || $i, 'UNMATCHED');");
    }

    $listRes = $svc->getCustomerList('shop1', [], 1, 25, '2026-09-01', '2026-09-20');
    echo json_encode([
      'period_customers' => $listRes['cohort_summary']['total_customers'],
      'lifetime_profiles' => $listRes['total_lifetime_profiles'],
      'records' => $listRes['pagination']['total_records']
    ]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.period_customers, 0, 'Period customers must be 0 for September');
  assert.strictEqual(data.lifetime_profiles, 168, 'Lifetime profiles must remain 168');
  assert.strictEqual(data.records, 0, 'Pagination records for period must be 0');
});

// =====================================================================
// SECTION 5: NEW VS RETURNING SEMANTICS (Tests 10-14)
// =====================================================================
console.log('\n[SECTION 5] New vs Returning Customer Classification (Tests 10-14)');

test('10. UNMATCHED excluded from verified customers', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    // 1 matched order, 3 unmatched orders
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_m1', 'COMPLETED', 100000, '2026-10-02 10:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, customer_identifier_hash, identity_method) VALUES ('tiktok_shop', 'shop1', 'ord_m1', 'hash_m1', 'USER_ID');");

    for ($i = 1; $i <= 3; $i++) {
      $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_u' || $i, 'COMPLETED', 100000, '2026-10-02 10:00:00');");
      $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, identity_method) VALUES ('tiktok_shop', 'shop1', 'ord_u' || $i, 'UNMATCHED');");
    }

    $list = $svc->getCustomerList('shop1', [], 1, 25, '2026-10-01', '2026-10-07');
    echo json_encode($list['cohort_summary']);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.total_customers, 1, 'Only matched customer is counted in total_customers');
  assert.strictEqual(data.verified_orders_count, 1);
  assert.strictEqual(data.unmatched_orders_count, 3);
});

test('11. UNMATCHED excluded from new/returning', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    // 2 matched orders from same customer
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'ord_1', 'COMPLETED', 100000, '2026-10-02 10:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, customer_identifier_hash, identity_method) VALUES ('tiktok_shop', 'shop1', 'ord_1', 'c1', 'USER_ID');");
    $pdo->exec("INSERT INTO commerce_customer_profiles (platform, shop_id, customer_identifier_hash, identity_method, total_orders_count, first_order_at) VALUES ('tiktok_shop', 'shop1', 'c1', 'USER_ID', 1, '2026-10-02 10:00:00');");

    // 5 unmatched orders
    for ($i = 1; $i <= 5; $i++) {
      $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'u' || $i, 'COMPLETED', 50000, '2026-10-03 10:00:00');");
      $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, identity_method) VALUES ('tiktok_shop', 'shop1', 'u' || $i, 'UNMATCHED');");
    }

    $list = $svc->getCustomerList('shop1', [], 1, 25, '2026-10-01', '2026-10-07');
    echo json_encode($list['cohort_summary']);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.total_customers, 1);
  assert.strictEqual(data.new_customers + data.returning_customers, 1);
});

test('12. new customer based on first verified known order inside selected period', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'o1', 'COMPLETED', 100000, '2026-10-03 10:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, customer_identifier_hash, identity_method) VALUES ('tiktok_shop', 'shop1', 'o1', 'c_new', 'USER_ID');");
    $pdo->exec("INSERT INTO commerce_customer_profiles (platform, shop_id, customer_identifier_hash, identity_method, total_orders_count, first_order_at) VALUES ('tiktok_shop', 'shop1', 'c_new', 'USER_ID', 1, '2026-10-03 10:00:00');");

    $list = $svc->getCustomerList('shop1', [], 1, 25, '2026-10-01', '2026-10-07');
    echo json_encode($list['cohort_summary']);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.new_customers, 1);
  assert.strictEqual(data.returning_customers, 0);
});

test('13. returning customer requires verified known order before period start', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    // Customer has order in October (2026-10-03), but first verified order was in September (2026-09-25)
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'o_oct', 'COMPLETED', 100000, '2026-10-03 10:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, customer_identifier_hash, identity_method) VALUES ('tiktok_shop', 'shop1', 'o_oct', 'c_ret', 'USER_ID');");
    $pdo->exec("INSERT INTO commerce_customer_profiles (platform, shop_id, customer_identifier_hash, identity_method, total_orders_count, first_order_at) VALUES ('tiktok_shop', 'shop1', 'c_ret', 'USER_ID', 2, '2026-09-25 10:00:00');");

    $list = $svc->getCustomerList('shop1', [], 1, 25, '2026-10-01', '2026-10-07');
    echo json_encode($list['cohort_summary']);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.new_customers, 0);
  assert.strictEqual(data.returning_customers, 1);
  assert.strictEqual(data.repeat_rate, 100.0);
});

test('14. historical UNMATCHED does not make customer returning', () => {
  const php = `
    ${getSqliteInitPhpCode()}
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    // Customer has UNMATCHED orders in September (no profile was created for them in September)
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'o_sep_unmatched', 'COMPLETED', 100000, '2026-09-15 10:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, identity_method) VALUES ('tiktok_shop', 'shop1', 'o_sep_unmatched', 'UNMATCHED');");

    // First verified order is captured in October
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at) VALUES ('tiktok_shop', 'shop1', 'o_oct_verified', 'COMPLETED', 100000, '2026-10-02 10:00:00');");
    $pdo->exec("INSERT INTO commerce_order_recipients (platform, shop_id, platform_order_id, customer_identifier_hash, identity_method) VALUES ('tiktok_shop', 'shop1', 'o_oct_verified', 'c_oct', 'USER_ID');");
    $pdo->exec("INSERT INTO commerce_customer_profiles (platform, shop_id, customer_identifier_hash, identity_method, total_orders_count, first_order_at) VALUES ('tiktok_shop', 'shop1', 'c_oct', 'USER_ID', 1, '2026-10-02 10:00:00');");

    $list = $svc->getCustomerList('shop1', [], 1, 25, '2026-10-01', '2026-10-07');
    echo json_encode($list['cohort_summary']);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.new_customers, 1, 'Customer with first verified order in period must remain NEW');
  assert.strictEqual(data.returning_customers, 0);
});

// =====================================================================
// SECTION 6: OBSERVABILITY & FAIL-SAFE (Tests 15-16)
// =====================================================================
console.log('\n[SECTION 6] Observability & Safe Diagnostics (Tests 15-16)');

test('15. trust SQL exception does not silently become valid zero metrics', () => {
  const php = `
    $pdo = new PDO('sqlite::memory:');
    // Drop table to cause query error
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';
    $svc = new CommerceCustomerService($pdo, '${VALID_HMAC_KEY}', '${VALID_ENC_KEY}');

    $metrics = $svc->getCustomerTrustMetrics('shop1', '2026-10-01', '2026-10-07');
    echo json_encode($metrics);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'ERROR', 'Must return status ERROR on query failure');
  assert(data.message.includes('Lỗi truy vấn'), 'Must indicate query error');
  assert.notStrictEqual(data.status, 'AVAILABLE');
  assert.notStrictEqual(data.status, 'NO_CUSTOMERS_IN_PERIOD');
});

test('16. no PII/secrets in diagnostics', () => {
  const php = `
    require_once dirname(__DIR__) . '/public/api/commerce_customer_service.php';

    // Mock error_log using ini override
    ini_set('error_log', sys_get_temp_dir() . '/diag_test.log');

    CommerceCustomerService::logDiagnostic('TestComp', 'testOp', [
      'token' => 'access_token_12345',
      'shop_cipher' => 'cipher_secret_abc',
      'key' => 'hmac_key_999',
      'phone' => '0912345678',
      'recipient_name' => 'Nguyen Van A',
      'address' => '123 Le Loi',
      'error_code' => 42
    ]);

    $logContent = file_get_contents(sys_get_temp_dir() . '/diag_test.log');
    unlink(sys_get_temp_dir() . '/diag_test.log');
    echo $logContent;
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  assert(!res.output.includes('access_token_12345'), 'Token must be redacted');
  assert(!res.output.includes('cipher_secret_abc'), 'Cipher must be redacted');
  assert(!res.output.includes('hmac_key_999'), 'Key must be redacted');
  assert(!res.output.includes('0912345678'), 'Phone must be redacted');
  assert(!res.output.includes('Nguyen Van A'), 'Name must be redacted');
  assert(!res.output.includes('123 Le Loi'), 'Address must be redacted');
  assert(res.output.includes('[REDACTED]'), 'Redaction placeholder must be used');
});

// =====================================================================
// SECTION 7: FRONTEND PRODUCTION BUILD & RUNTIME (Test 17)
// =====================================================================
console.log('\n[SECTION 7] Frontend Production Build & Bundle Inspection (Test 17)');

test('17. frontend build/runtime passes and contains required UX updates', () => {
  const distDir = path.join(PROJECT_ROOT, 'dist');
  assert(fs.existsSync(distDir), 'dist directory must exist');
  assert(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist');

  const assets = fs.readdirSync(path.join(distDir, 'assets'));
  const jsBundle = assets.find(f => f.startsWith('index-') && f.endsWith('.js'));
  assert(jsBundle, 'dist/assets/index-*.js bundle must exist');

  const bundleContent = fs.readFileSync(path.join(distDir, 'assets', jsBundle), 'utf8');
  assert(!bundleContent.includes('Thu thập ưu tiên (164 đơn)'), 'Bundle must not contain hardcoded "(164 đơn)"');
  assert(bundleContent.includes('Không có đơn cần thu thập ưu tiên'), 'Bundle must contain "Không có đơn cần thu thập ưu tiên"');
  assert(bundleContent.includes('NO_VERIFIED_IDENTITY_IN_PERIOD'), 'Bundle must handle NO_VERIFIED_IDENTITY_IN_PERIOD');
});

// =====================================================================
// SUMMARY
// =====================================================================
console.log('\n====================================================================');
console.log(`  SPRINT V2-05.2.2 TEST RESULTS: ${passedTests}/${totalTests} PASS (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('====================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
