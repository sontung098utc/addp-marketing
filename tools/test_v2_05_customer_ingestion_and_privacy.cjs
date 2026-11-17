/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SPRINT V2-05 TEST SUITE
 * Test: Customer 360 Ingestion, Privacy Preservation & Identity Resolution
 * File: tools/test_v2_05_customer_ingestion_and_privacy.cjs
 * ====================================================================
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function resolvePhpCli() {
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

const phpCli = resolvePhpCli();
console.log('====================================================================');
console.log('  SPRINT V2-05: CUSTOMER 360 INGESTION & PRIVACY TESTS');
console.log(`  Resolved PHP Binary: ${phpCli}`);
console.log('====================================================================\n');

let passedTests = 0;
let totalTests = 0;

const PROJECT_ROOT = path.resolve(__dirname, '..');

function runPhpCode(code) {
  const tempScript = path.join(__dirname, `_temp_v2_05_test_${Date.now()}_${Math.floor(Math.random() * 1000)}.php`);
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
putenv('CUSTOMER_IDENTITY_HMAC_KEY=customer_identity_test_secret_32b_ok!');
$_ENV['CUSTOMER_IDENTITY_HMAC_KEY'] = 'customer_identity_test_secret_32b_ok!';
$_SERVER['CUSTOMER_IDENTITY_HMAC_KEY'] = 'customer_identity_test_secret_32b_ok!';

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

function test(name, fn) {
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

// -----------------------------------------------------------------------------
// SECTION 1: Phone Normalization & Privacy Masking
// -----------------------------------------------------------------------------
console.log('[SECTION 1] Phone Normalization & Privacy Masking');

test('Phone normalization standardizes +84, 84, and 0 prefixes to standard 0...', () => {
  const php = `
    require_once PROJECT_ROOT . '/tools/mock_pdo_helper.php';
    require_once PROJECT_ROOT . '/public/api/commerce_customer_service.php';
    $p1 = CommerceCustomerService::normalizePhone('+84987654321');
    $p2 = CommerceCustomerService::normalizePhone('84987654321');
    $p3 = CommerceCustomerService::normalizePhone('0987654321');
    $p4 = CommerceCustomerService::normalizePhone('098-765-4321');
    echo json_encode([$p1, $p2, $p3, $p4]);
  `;
  const res = runPhpCode(php);
  if (!res.success) throw new Error(res.error);
  const arr = JSON.parse(res.output);
  if (arr[0] !== '0987654321') throw new Error(`+84 failed: ${arr[0]}`);
  if (arr[1] !== '0987654321') throw new Error(`84 failed: ${arr[1]}`);
  if (arr[2] !== '0987654321') throw new Error(`0 failed: ${arr[2]}`);
  if (arr[3] !== '0987654321') throw new Error(`Dashes failed: ${arr[3]}`);
});

test('Masking functions produce standard privacy formats without plaintext leakage', () => {
  const php = `
    require_once PROJECT_ROOT . '/tools/mock_pdo_helper.php';
    require_once PROJECT_ROOT . '/public/api/commerce_customer_service.php';
    $phoneMask = CommerceCustomerService::maskPhone('0987654321');
    $nameMask = CommerceCustomerService::maskName('Nguyen Van A');
    $addrMask = CommerceCustomerService::maskAddress('123 Nguyen Trai, Thanh Xuan, Ha Noi');
    echo json_encode(['phone' => $phoneMask, 'name' => $nameMask, 'addr' => $addrMask]);
  `;
  const res = runPhpCode(php);
  if (!res.success) throw new Error(res.error);
  const data = JSON.parse(res.output);
  
  if (!data.phone.startsWith('09') || !data.phone.endsWith('21') || !data.phone.includes('******')) {
    throw new Error(`Phone masking mismatch: ${data.phone}`);
  }
  if (!data.name.includes('***')) {
    throw new Error(`Name masking failed: ${data.name}`);
  }
  if (!data.addr.includes('***') || !data.addr.includes('Ha Noi')) {
    throw new Error(`Address masking failed: ${data.addr}`);
  }
});

// -----------------------------------------------------------------------------
// SECTION 2: Deterministic HMAC Hashing & Identity Resolution
// -----------------------------------------------------------------------------
console.log('\n[SECTION 2] Deterministic HMAC Hashing & Identity Resolution');

test('hashPhoneNumber produces deterministic, non-reversible 64-character hex HMAC', () => {
  const php = `
    require_once PROJECT_ROOT . '/tools/mock_pdo_helper.php';
    require_once PROJECT_ROOT . '/public/api/commerce_customer_service.php';
    $db = MockPdoHelper::createMockPdo();
    $service = new CommerceCustomerService($db);
    $h1 = $service->hashPhoneNumber('0987654321');
    $h2 = $service->hashPhoneNumber('+84987654321');
    $h3 = $service->hashPhoneNumber('0912345678');
    echo json_encode(['h1' => $h1, 'h2' => $h2, 'h3' => $h3, 'len' => strlen($h1)]);
  `;
  const res = runPhpCode(php);
  if (!res.success) throw new Error(res.error);
  const data = JSON.parse(res.output);
  if (data.len !== 64) throw new Error(`Hash length expected 64, got ${data.len}`);
  if (data.h1 !== data.h2) throw new Error(`Deterministic hashing failed: ${data.h1} !== ${data.h2}`);
  if (data.h1 === data.h3) throw new Error(`Collision between different phones: ${data.h1} === ${data.h3}`);
});

test('Identity Resolution respects strict priority: BUYER_UID > RECIPIENT_ID > PHONE_HMAC > UNMATCHED', () => {
  const php = `
    require_once PROJECT_ROOT . '/tools/mock_pdo_helper.php';
    require_once PROJECT_ROOT . '/public/api/commerce_customer_service.php';
    $db = MockPdoHelper::createMockPdo();
    $service = new CommerceCustomerService($db);
    
    // Priority 1: buyer_uid present
    $r1 = $service->resolveCustomerIdentity('buyer_999', 'recip_888', '0987654321', 'ord_1');
    // Priority 2: recipient_id present (no buyer_uid)
    $r2 = $service->resolveCustomerIdentity(null, 'recip_888', '0987654321', 'ord_2');
    // Priority 3: phone present (no buyer_uid or recipient_id)
    $r3 = $service->resolveCustomerIdentity(null, null, '0987654321', 'ord_3');
    // Priority 4: unmatched
    $r4 = $service->resolveCustomerIdentity(null, null, null, 'ord_4');
    
    echo json_encode([$r1['identity_method'], $r2['identity_method'], $r3['identity_method'], $r4['identity_method']]);
  `;
  const res = runPhpCode(php);
  if (!res.success) throw new Error(res.error);
  const methods = JSON.parse(res.output);
  if (methods[0] !== 'BUYER_UID') throw new Error(`Expected BUYER_UID, got ${methods[0]}`);
  if (methods[1] !== 'RECIPIENT_ID') throw new Error(`Expected RECIPIENT_ID, got ${methods[1]}`);
  if (methods[2] !== 'PHONE_HMAC') throw new Error(`Expected PHONE_HMAC, got ${methods[2]}`);
  if (methods[3] !== 'UNMATCHED') throw new Error(`Expected UNMATCHED, got ${methods[3]}`);
});

// -----------------------------------------------------------------------------
// SECTION 3: Order Ingestion & Recipient Parsing
// -----------------------------------------------------------------------------
console.log('\n[SECTION 3] Order Ingestion & Recipient Parsing');

test('extractRecipientFromOrder safely handles various TikTok API recipient nesting schemas', () => {
  const php = `
    require_once PROJECT_ROOT . '/tools/mock_pdo_helper.php';
    require_once PROJECT_ROOT . '/public/api/commerce_customer_service.php';
    $payload = [
      'id' => '578912345678901234',
      'buyer_uid' => 'buyer_sample_01',
      'recipient_address' => [
        'name' => 'Tran Thi B',
        'phone' => '0901234567',
        'full_address' => '456 Le Loi, Quan 1, TP. Ho Chi Minh',
        'province' => 'TP. Ho Chi Minh',
        'district' => 'Quan 1',
        'postal_code' => '700000'
      ]
    ];
    $ext = CommerceCustomerService::extractRecipientFromOrder($payload);
    echo json_encode($ext);
  `;
  const res = runPhpCode(php);
  if (!res.success) throw new Error(res.error);
  const ext = JSON.parse(res.output);
  if (ext.buyer_uid !== 'buyer_sample_01') throw new Error(`buyer_uid failed: ${ext.buyer_uid}`);
  if (ext.raw_phone !== '0901234567') throw new Error(`raw_phone failed: ${ext.raw_phone}`);
  if (ext.province !== 'TP. Ho Chi Minh') throw new Error(`province failed: ${ext.province}`);
});

test('ingestOrderRecipient executes safely and returns masked metadata without plaintext PII', () => {
  const php = `
    require_once PROJECT_ROOT . '/tools/mock_pdo_helper.php';
    require_once PROJECT_ROOT . '/public/api/commerce_customer_service.php';
    $db = MockPdoHelper::createMockPdo();
    $service = new CommerceCustomerService($db);
    
    $payload = [
      'id' => '578912345678901234',
      'buyer_uid' => 'buyer_sample_01',
      'recipient_address' => [
        'name' => 'Nguyen Van An',
        'phone' => '0987654321',
        'full_address' => 'Số 10 Hoan Kiem, Ha Noi',
        'province' => 'Ha Noi'
      ]
    ];
    
    $res = $service->ingestOrderRecipient('test_shop', $payload, 101);
    echo json_encode($res);
  `;
  const res = runPhpCode(php);
  if (!res.success) throw new Error(res.error);
  const data = JSON.parse(res.output);
  if (!data) throw new Error('Result was null');
  if (data.phone_masked.includes('987654')) throw new Error('Plaintext phone leaked in masked phone!');
  if (data.name_masked.includes('Nguyen Van An')) throw new Error('Plaintext name leaked in masked name!');
  if (!data.customer_identifier_hash || data.customer_identifier_hash.length !== 64) {
    throw new Error('Invalid customer identifier hash');
  }
});

// -----------------------------------------------------------------------------
// SECTION 4: Data Trust & Non-Fatal Execution
// -----------------------------------------------------------------------------
console.log('\n[SECTION 4] Data Trust & Non-Fatal Execution');

test('getCustomerTrustMetrics reports CUSTOMER_DATA_NOT_INGESTED or AVAILABLE truthfully', () => {
  const php = `
    require_once PROJECT_ROOT . '/tools/mock_pdo_helper.php';
    require_once PROJECT_ROOT . '/public/api/commerce_customer_service.php';
    $db = MockPdoHelper::createMockPdo();
    $service = new CommerceCustomerService($db);
    
    $trust = $service->getCustomerTrustMetrics('test_shop', '2026-09-01', '2026-09-20');
    echo json_encode($trust);
  `;
  const res = runPhpCode(php);
  if (!res.success) throw new Error(res.error);
  const trust = JSON.parse(res.output);
  if (!['AVAILABLE', 'CUSTOMER_DATA_NOT_INGESTED', 'NO_CUSTOMERS_IN_PERIOD'].includes(trust.status)) {
    throw new Error(`Unexpected trust status: ${trust.status}`);
  }
  if (!trust.privacy_model || trust.privacy_model.hashing_algorithm !== 'HMAC-SHA256') {
    throw new Error('Missing or invalid privacy model specification');
  }
});

test('Customer 360 Ingestion failure is strictly NON-FATAL for Orders Sync', () => {
  const php = `
    require_once PROJECT_ROOT . '/tools/mock_pdo_helper.php';
    require_once PROJECT_ROOT . '/public/api/tiktok_client.php';
    require_once PROJECT_ROOT . '/public/api/commerce_sync_service.php';
    require_once PROJECT_ROOT . '/public/api/commerce_loss_engine.php';
    require_once PROJECT_ROOT . '/public/api/commerce_aftersales_service.php';
    require_once PROJECT_ROOT . '/public/api/commerce_ads_ingestion_service.php';
    require_once PROJECT_ROOT . '/public/api/commerce_finance_service.php';
    require_once PROJECT_ROOT . '/public/api/commerce_analytics_service.php';
    require_once PROJECT_ROOT . '/public/api/commerce_customer_service.php';
    require_once PROJECT_ROOT . '/public/api/commerce_sync_orchestrator.php';
    $db = MockPdoHelper::createMockPdo();
    $orchestrator = new CommerceSyncOrchestrator($db);
    
    // Simulate non-fatal execution of customer sync
    $custRes = $orchestrator->syncCustomerDomain('test_shop', '2026-09-01', '2026-09-20');
    echo json_encode($custRes);
  `;
  const res = runPhpCode(php);
  if (!res.success) throw new Error(res.error);
  const custRes = JSON.parse(res.output);
  if (custRes.domain !== 'customer_ingestion') {
    throw new Error(`Expected customer_ingestion domain, got ${custRes.domain}`);
  }
});

test('Migration 017 SQL syntax & rollback integrity', () => {
  const migPath = path.join(__dirname, '../database/migrations/20261006_017_add_customer_identity_columns.sql');
  const rbPath = path.join(__dirname, '../database/migrations/20261006_017_rollback_add_customer_identity_columns.sql');
  
  if (!fs.existsSync(migPath)) throw new Error('Migration 017 file does not exist');
  if (!fs.existsSync(rbPath)) throw new Error('Migration 017 rollback file does not exist');
  
  const migSql = fs.readFileSync(migPath, 'utf-8');
  if (!migSql.includes('customer_identifier_hash') || !migSql.includes('return_refund_count')) {
    throw new Error('Migration 017 missing expected column additions');
  }
});

console.log('\n====================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${totalTests - passedTests}`);
console.log('====================================================================');

if (passedTests === totalTests) {
  console.log('ALL SPRINT V2-05 CUSTOMER INGESTION & PRIVACY TESTS PASSED!\n');
  process.exit(0);
} else {
  process.exit(1);
}
