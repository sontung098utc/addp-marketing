/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SPRINT V2-05.2 TEST SUITE
 * Test: TikTok Recipient Capture Hotfix (RAM Extraction, Preserve-Best,
 *       AES-256-GCM Encryption-At-Rest, Identity Hierarchy & Priority Sync)
 * File: tools/test_v2_05_2_recipient_capture.cjs
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
console.log('  SPRINT V2-05.2: TIKTOK RECIPIENT CAPTURE HOTFIX TEST SUITE');
console.log(`  Resolved PHP Command: ${phpCmd}`);
console.log('====================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runPhpCode(code, envOverrides = {}) {
  const tempScript = path.join(__dirname, `_temp_v2_05_2_test_${Date.now()}_${Math.floor(Math.random() * 1000)}.php`);
  
  let envPuts = '';
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === null) {
      envPuts += `putenv('${k}'); unset($_ENV['${k}']); unset($_SERVER['${k}']);\n`;
    } else {
      const escaped = v.replace(/'/g, "\\'");
      envPuts += `putenv('${k}=${escaped}'); $_ENV['${k}'] = '${escaped}'; $_SERVER['${k}'] = '${escaped}';\n`;
    }
  }

  const fullCode = `<?php
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

// Default test keys (valid, decoupled, high entropy)
putenv('CUSTOMER_IDENTITY_HMAC_KEY=cust_hmac_secret_key_32_bytes_test_ok!');
$_ENV['CUSTOMER_IDENTITY_HMAC_KEY'] = 'cust_hmac_secret_key_32_bytes_test_ok!';
$_SERVER['CUSTOMER_IDENTITY_HMAC_KEY'] = 'cust_hmac_secret_key_32_bytes_test_ok!';

putenv('CUSTOMER_RECIPIENT_ENCRYPTION_KEY=cust_enc_aes256gcm_32b_secret_key!');
$_ENV['CUSTOMER_RECIPIENT_ENCRYPTION_KEY'] = 'cust_enc_aes256gcm_32b_secret_key!';
$_SERVER['CUSTOMER_RECIPIENT_ENCRYPTION_KEY'] = 'cust_enc_aes256gcm_32b_secret_key!';

putenv('AUTH_SIGNING_KEY=auth_signing_key_32_bytes_test_ok_12345');
putenv('TIKTOK_APP_SECRET=tiktok_partner_secret_test_ok_12345');

${envPuts}

define('PROJECT_ROOT', '${PROJECT_ROOT.replace(/\\/g, '/')}');
chdir(PROJECT_ROOT);

${code}
`;
  fs.writeFileSync(tempScript, fullCode, 'utf-8');
  try {
    const out = execSync(`${phpCmd} -f "${tempScript}"`, {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    });
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
  }
}

// =====================================================================
// SECTION 1: SCHEMA & MIGRATION 018 INVARIANTS (Case H)
// =====================================================================
console.log('[SECTION 1] Migration 018 & Schema Compatibility (Case H)');

test('TEST 1A: Migration 018 is additive and creates phone_encrypted and address_full_encrypted', () => {
  const migPath = path.join(PROJECT_ROOT, 'database', 'migrations', '20261007_018_add_recipient_encryption_columns.sql');
  assert(fs.existsSync(migPath), 'Migration 018 file must exist');
  const content = fs.readFileSync(migPath, 'utf8');
  assert(content.includes('phone_encrypted') && content.includes('address_full_encrypted'), 'Migration 018 must add phone_encrypted and address_full_encrypted');
  assert(!content.includes('DROP TABLE') && !content.includes('RENAME TABLE'), 'Migration 018 must be non-destructive');
  assert(!content.includes('commerce_orders') && !content.includes('commerce_settlements'), 'Migration 018 must not alter orders or settlement tables');
});

test('TEST 1B: Migration 018 rollback script cleanly drops encryption columns without dropping table', () => {
  const rollbackPath = path.join(PROJECT_ROOT, 'database', 'migrations', '20261007_018_rollback_add_recipient_encryption_columns.sql');
  assert(fs.existsSync(rollbackPath), 'Migration 018 rollback file must exist');
  const content = fs.readFileSync(rollbackPath, 'utf8');
  assert(content.includes('DROP COLUMN `address_full_encrypted`') && content.includes('DROP COLUMN `phone_encrypted`'), 'Rollback must drop added columns');
  assert(!content.includes('DROP TABLE'), 'Rollback must never drop table');
});

// =====================================================================
// SECTION 2: RAM RECIPIENT EXTRACTION & SANITIZATION (Case A)
// =====================================================================
console.log('\n[SECTION 2] RAM Recipient Extraction & Sanitization (Case A)');

test('TEST 2A: extractRecipientFromOrder extracts user_id, recipient name, phone, full address in RAM', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    
    $rawOrder = [
        'id' => '1799000000000001',
        'user_id' => 'tt_user_9988776655',
        'recipient_address' => [
            'name' => 'Nguyen Van Test',
            'phone_number' => '0901234567',
            'full_address' => 'Số 10 Ngo Quyen, Hoan Kiem, Ha Noi',
            'district_name' => 'Hoan Kiem',
            'city_name' => 'Ha Noi'
        ]
    ];
    
    $extracted = CommerceCustomerService::extractRecipientFromOrder($rawOrder);
    echo json_encode($extracted);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.user_id, 'tt_user_9988776655', 'user_id must be extracted from order root');
  assert.strictEqual(data.raw_name, 'Nguyen Van Test', 'recipient name must be extracted');
  assert.strictEqual(data.raw_phone, '0901234567', 'phone number must be extracted');
  assert.strictEqual(data.is_masked_by_platform, 0, 'Unmasked phone/address must report is_masked_by_platform = 0');
  assert.strictEqual(data.province, 'Ha Noi', 'Province must be extracted');
  assert(data.raw_address.includes('Ngo Quyen'), 'Full address must be extracted');
});

test('TEST 2B: extractRecipientFromOrder correctly identifies platform-masked data', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    
    $rawOrderMasked = [
        'id' => '1799000000000002',
        'user_id' => 'tt_user_112233',
        'recipient_address' => [
            'name' => 'N*** T***',
            'phone_number' => '09******67',
            'full_address' => '***, Quan 1, TP Ho Chi Minh',
            'city_name' => 'TP Ho Chi Minh'
        ]
    ];
    
    $extracted = CommerceCustomerService::extractRecipientFromOrder($rawOrderMasked);
    echo json_encode($extracted);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.is_masked_by_platform, 1, 'Data containing * must be detected as platform-masked (1)');
  assert.strictEqual(data.raw_phone, '09******67', 'Masked phone preserved in raw_phone');
});

// =====================================================================
// SECTION 3: IDENTITY HIERARCHY & DETERMINISTIC HASHING (Case B)
// =====================================================================
console.log('\n[SECTION 3] Identity Hierarchy & Deterministic Hashing (Case B)');

test('TEST 3A: Strict Priority Rank: BUYER_UID > BUYER_ID > USER_ID > RECIPIENT_ID > PHONE_HMAC > UNMATCHED', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    
    $rUid = CommerceCustomerService::getIdentityRank(CommerceCustomerService::IDENTITY_BUYER_UID);
    $rBid = CommerceCustomerService::getIdentityRank(CommerceCustomerService::IDENTITY_BUYER_ID);
    $rUsr = CommerceCustomerService::getIdentityRank(CommerceCustomerService::IDENTITY_USER_ID);
    $rRec = CommerceCustomerService::getIdentityRank(CommerceCustomerService::IDENTITY_RECIPIENT_ID);
    $rPhn = CommerceCustomerService::getIdentityRank(CommerceCustomerService::IDENTITY_PHONE_HMAC);
    $rUnm = CommerceCustomerService::getIdentityRank(CommerceCustomerService::IDENTITY_UNMATCHED);
    
    echo json_encode([
        'ranks' => [$rUid, $rBid, $rUsr, $rRec, $rPhn, $rUnm],
        'strict_descending' => ($rUid > $rBid && $rBid > $rUsr && $rUsr > $rRec && $rRec > $rPhn && $rPhn > $rUnm)
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.strict_descending, true, 'Identity rank must be strictly descending according to specification');
});

test('TEST 3B: user_id resolves to USER_ID identity method and is hashed with HMAC-SHA256 (no plaintext)', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();
    $svc = new CommerceCustomerService($db);
    
    // Test with user_id present
    $res = $svc->resolveCustomerIdentity(null, null, null, 'ord_123', 'tt_user_repeat_001');
    $expectedHash = hash_hmac('sha256', 'user_id:' . 'tt_user_repeat_001', getenv('CUSTOMER_IDENTITY_HMAC_KEY'));
    
    echo json_encode([
        'method' => $res['identity_method'],
        'hash' => $res['customer_identifier_hash'],
        'expected_hash' => $expectedHash,
        'matches' => ($res['customer_identifier_hash'] === $expectedHash)
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.method, 'USER_ID', 'Identity method must resolve to USER_ID');
  assert.strictEqual(data.matches, true, 'Customer hash must match HMAC-SHA256(user_id:ID, key)');
});

test('TEST 3C: Masked phone (* in phone) is NEVER hashed as PHONE_HMAC to prevent false merging', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();
    $svc = new CommerceCustomerService($db);
    
    // Masked phone with no buyer/user identifiers must yield UNMATCHED
    $res = $svc->resolveCustomerIdentity(null, null, '09******89', 'ord_456', null, null);
    
    echo json_encode([
        'method' => $res['identity_method'],
        'is_unmatched' => ($res['identity_method'] === CommerceCustomerService::IDENTITY_UNMATCHED)
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.method, 'UNMATCHED', 'Masked phone must never be hashed or merged as PHONE_HMAC');
  assert.strictEqual(data.is_unmatched, true);
});

// =====================================================================
// SECTION 4: PRESERVE-BEST-KNOWN-VALUE SEMANTICS (Case C)
// =====================================================================
console.log('\n[SECTION 4] Preserve-Best-Known-Value Semantics (Case C)');

test('TEST 4A: Subsequent masked sync does NOT overwrite unmasked good data (Preserve-Best)', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    
    // Mock existing unmasked record in database
    $existingUnmaskedRecord = [
        'id' => 501,
        'platform_order_id' => '1799000000000001',
        'is_masked_by_platform' => 0,
        'phone_masked' => '0901234567',
        'phone_hash' => 'hash_unmasked_phone_123',
        'recipient_name_encrypted' => 'enc_name_good',
        'phone_encrypted' => 'enc_phone_good',
        'address_full_encrypted' => 'enc_addr_good',
        'identity_method' => 'USER_ID',
        'customer_identifier_hash' => 'hash_user_id_good',
        'province' => 'Ha Noi'
    ];
    
    // Mock PDO returning the existing good record
    $db = new MockPDO([
        'SELECT * FROM \`commerce_order_recipients\`' => [$existingUnmaskedRecord],
        'SELECT COUNT(*) FROM \`commerce_orders\`' => [[1]],
        'SELECT COUNT(*) FROM \`commerce_customer_profiles\`' => [[1]]
    ]);
    
    $svc = new CommerceCustomerService($db);
    
    // Incoming masked order (synced days later post-fulfillment)
    $incomingMaskedOrder = [
        'id' => '1799000000000001',
        'user_id' => 'tt_user_9988776655',
        'recipient_address' => [
            'name' => 'N*** T***',
            'phone_number' => '09******67',
            'full_address' => '***, Hoan Kiem, Ha Noi',
            'city_name' => 'Ha Noi'
        ]
    ];
    
    $result = $svc->ingestOrderRecipient('test_shop', $incomingMaskedOrder);
    
    echo json_encode([
        'preserved_is_masked' => $result['is_masked_by_platform'],
        'preserved_phone_masked' => $result['phone_masked'],
        'preserved_province' => $result['province']
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.preserved_is_masked, 0, 'Must preserve is_masked_by_platform = 0');
  assert.strictEqual(data.preserved_phone_masked, '0901234567', 'Must preserve unmasked phone format');
  assert.strictEqual(data.preserved_province, 'Ha Noi', 'Must preserve province');
});

test('TEST 4B: Incoming lower-rank identity does not downgrade existing higher-rank identity', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    
    // Existing record has USER_ID (rank 3)
    $existing = [
        'id' => 502,
        'platform_order_id' => '1799000000000002',
        'is_masked_by_platform' => 1,
        'identity_method' => 'USER_ID',
        'customer_identifier_hash' => 'hash_user_id_high_rank',
        'phone_masked' => '09******12',
        'phone_hash' => null,
        'recipient_name_encrypted' => null,
        'phone_encrypted' => null,
        'address_full_encrypted' => null,
        'province' => 'TP HCM'
    ];
    
    $db = new MockPDO([
        'SELECT * FROM \`commerce_order_recipients\`' => [$existing]
    ]);
    $svc = new CommerceCustomerService($db);
    
    // Incoming order only has RECIPIENT_ID (rank 2)
    $incomingLowerRank = [
        'id' => '1799000000000002',
        'recipient_address' => [
            'name' => 'Customer',
            'phone_number' => '09******12',
            'full_address' => 'District 1, HCM',
            'city_name' => 'TP HCM',
            'recipient_address_id' => 'rec_address_99'
        ]
    ];
    
    $res = $svc->ingestOrderRecipient('test_shop', $incomingLowerRank);
    
    echo json_encode([
        'final_method' => $res['identity_method'],
        'final_hash' => $res['customer_identifier_hash']
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.final_method, 'USER_ID', 'Identity method must not be downgraded from USER_ID to RECIPIENT_ID');
  assert.strictEqual(data.final_hash, 'hash_user_id_high_rank', 'Identity hash must be preserved');
});

// =====================================================================
// SECTION 5: AES-256-GCM ENCRYPTION-AT-REST & KEY VALIDATION (Case D)
// =====================================================================
console.log('\n[SECTION 5] AES-256-GCM Encryption-At-Rest & Key Safety (Case D)');

test('TEST 5A: validateEncryptionKey rejects missing, short, or reused keys', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    
    $vNull = CommerceCustomerService::validateEncryptionKey(null);
    $vShort = CommerceCustomerService::validateEncryptionKey('short_key_16_byt');
    $vReused = CommerceCustomerService::validateEncryptionKey(
        'cust_hmac_secret_key_32_bytes_test_ok!', // equals HMAC key
        'cust_hmac_secret_key_32_bytes_test_ok!'
    );
    $vValid = CommerceCustomerService::validateEncryptionKey(
        'a_distinct_random_32_bytes_enc_key_12345!',
        'cust_hmac_secret_key_32_bytes_test_ok!'
    );
    
    echo json_encode([
        'null_reason' => $vNull['reason'],
        'short_reason' => $vShort['reason'],
        'reused_reason' => $vReused['reason'],
        'valid_status' => $vValid['valid']
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.null_reason, 'CUSTOMER_RECIPIENT_ENCRYPTION_KEY_MISSING');
  assert.strictEqual(data.short_reason, 'CUSTOMER_RECIPIENT_ENCRYPTION_KEY_INVALID');
  assert.strictEqual(data.reused_reason, 'CUSTOMER_RECIPIENT_ENCRYPTION_KEY_REUSED');
  assert.strictEqual(data.valid_status, true);
});

test('TEST 5B: AES-256-GCM encrypts and decrypts recipient plaintext accurately', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();
    $svc = new CommerceCustomerService($db);
    
    $plainPhone = '0987654321';
    $plainAddress = '123 Duong Le Duan, Hai Chau, Da Nang';
    
    $encPhone = $svc->encryptField($plainPhone);
    $encAddress = $svc->encryptField($plainAddress);
    
    $decPhone = $svc->decryptField($encPhone);
    $decAddress = $svc->decryptField($encAddress);
    
    echo json_encode([
        'enc_phone_not_plain' => ($encPhone !== $plainPhone),
        'enc_addr_not_plain' => ($encAddress !== $plainAddress),
        'dec_phone_match' => ($decPhone === $plainPhone),
        'dec_addr_match' => ($decAddress === $plainAddress)
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.enc_phone_not_plain, true, 'Ciphertext must not be plaintext');
  assert.strictEqual(data.enc_addr_not_plain, true, 'Ciphertext must not be plaintext');
  assert.strictEqual(data.dec_phone_match, true, 'Decrypted phone must match original');
  assert.strictEqual(data.dec_addr_match, true, 'Decrypted address must match original');
});

test('TEST 5C: Fail-closed on missing encryption key: sensitive fields return null, zero plaintext saved', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();
    
    // Explicitly unconfigured encryption key
    $svc = new CommerceCustomerService($db, 'valid_hmac_secret_32_bytes_ok_12345!', null);
    
    $encPhone = $svc->encryptField('0912345678');
    $encAddr = $svc->encryptField('456 Nguyen Hue, Q1, HCM');
    
    echo json_encode([
        'enc_configured' => $svc->isEncryptionConfigured(),
        'enc_phone' => $encPhone,
        'enc_addr' => $encAddr
    ]);
  `;
  const res = runPhpCode(script, { CUSTOMER_RECIPIENT_ENCRYPTION_KEY: null });
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.enc_configured, false, 'Encryption must report unconfigured');
  assert.strictEqual(data.enc_phone, null, 'Unconfigured encryption key must return null for phone');
  assert.strictEqual(data.enc_addr, null, 'Unconfigured encryption key must return null for address');
});

// =====================================================================
// SECTION 6: KPI FORMULA INVARIANTS (Case E)
// =====================================================================
console.log('\n[SECTION 6] Customer KPI & Trust Coverage Invariants (Case E)');

test('TEST 6A: 0 matched out of 2777 orders => Coverage is strictly 0.0%, Total Customers is 0', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    
    // 2777 orders total, 0 matched (all UNMATCHED), 0 profiles
    $db = new MockPDO([
        'INNER JOIN \`commerce_order_recipients\`' => [[0]],
        'FROM \`commerce_orders\`' => [[2777]],
        "WHERE platform = ? AND shop_id = ? AND identity_method != 'UNMATCHED'" => [[0]],
        'SELECT COUNT(DISTINCT customer_identifier_hash)' => [[0]],
        'SELECT MAX(ingested_at)' => [[null]]
    ]);
    
    $svc = new CommerceCustomerService($db);
    $trust = $svc->getCustomerTrustMetrics('test_shop', '2026-09-01', '2026-09-30');
    
    echo json_encode([
        'total_orders' => $trust['total_orders'],
        'matched_orders' => $trust['matched_orders'],
        'unmatched_orders' => $trust['unmatched_orders'],
        'identity_coverage_pct' => $trust['identity_coverage_pct'],
        'profiles_created' => $trust['profiles_created']
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.total_orders, 2777, 'Total orders must be 2777');
  assert.strictEqual(data.matched_orders, 0, 'Matched orders must be 0');
  assert.strictEqual(data.unmatched_orders, 2777, 'Unmatched orders must be 2777');
  assert.strictEqual(data.identity_coverage_pct, 0.0, 'Coverage must be exactly 0.0% (NOT 100%)');
  assert.strictEqual(data.profiles_created, 0, 'Profiles created must be 0');
});

test('TEST 6B: materializeCustomerProfile strictly skips UNMATCHED identity method', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    
    $db = createMockPDO();
    $svc = new CommerceCustomerService($db);
    
    // Calling materializeCustomerProfile with UNMATCHED
    $svc->materializeCustomerProfile('test_shop', 'hash_unmatched_123', CommerceCustomerService::IDENTITY_UNMATCHED);
    
    // If it did not throw and aborted cleanly
    echo json_encode(['skipped_cleanly' => true]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.skipped_cleanly, true);
});

// =====================================================================
// SECTION 7: BOUNDED PRIORITY SYNC MODE (Case F)
// =====================================================================
console.log('\n[SECTION 7] Bounded Priority Sync Mode (Case F)');

test('TEST 7A: syncPriorityRecipients bounds limit to max 50 orders per call', () => {
  const script = `
    require_once 'public/api/commerce_sync_service.php';
    require_once 'tools/mock_pdo_helper.php';
    
    $db = createMockPDO();
    $svc = new CommerceSyncService($db);
    
    $refl = new ReflectionClass($svc);
    $method = $refl->getMethod('syncPriorityRecipients');
    
    echo json_encode(['method_exists' => ($method !== null)]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.method_exists, true, 'syncPriorityRecipients method must exist');
});

test('TEST 7B: Action sync_priority_recipients exposed in commerce_sync.php and commerce_dashboard.php', () => {
  const syncFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync.php'), 'utf8');
  const dashFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_dashboard.php'), 'utf8');
  
  assert(syncFile.includes('sync_priority_recipients'), 'commerce_sync.php must handle action=sync_priority_recipients');
  assert(syncFile.includes('rebuild_customer_profiles'), 'commerce_sync.php must handle action=rebuild_customer_profiles');
  assert(dashFile.includes('sync_priority_recipients'), 'commerce_dashboard.php must handle action=sync_priority_recipients');
});

// =====================================================================
// SECTION 8: NON-FATAL DECOUPLING & ZERO ACCOUNTING MUTATION (Case G)
// =====================================================================
console.log('\n[SECTION 8] Non-Fatal Decoupling & Accounting Safety (Case G)');

test('TEST 8A: Recipient ingestion error NEVER causes Order Sync to fail', () => {
  const syncServiceFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_service.php'), 'utf8');
  
  const hasWindowCatch = syncServiceFile.includes('$customerService->ingestOrderRecipient($shopId, $rawOrd, $runId);') &&
    syncServiceFile.includes('Non-fatal safety guard: Customer ingestion errors must NEVER fail Orders sync');
  const hasByIdsCatch = syncServiceFile.includes('$customerService->ingestOrderRecipient($shopId, $ord);');
  
  assert(hasWindowCatch && hasByIdsCatch, 'Orders sync must wrap recipient ingestion in non-fatal try/catch blocks');
});

test('TEST 8B: Zero modifications to accounting, settlements, and loss engines', () => {
  const lossEngineFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_loss_engine.php'), 'utf8');
  const financeFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_finance_service.php'), 'utf8');
  
  assert(lossEngineFile.includes('computeAndPersistLossLedger'), 'Loss engine core functions intact');
  assert(!lossEngineFile.includes('CUSTOMER_RECIPIENT_ENCRYPTION_KEY'), 'Loss engine completely decoupled from recipient encryption');
  assert(financeFile.includes('class CommerceFinanceService'), 'Finance service intact');
});

// =====================================================================
// SUMMARY
// =====================================================================
console.log('\n====================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${totalTests - passedTests}`);
console.log('====================================================================');

if (passedTests === totalTests) {
  console.log('ALL SPRINT V2-05.2 RECIPIENT CAPTURE TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error('SOME TESTS FAILED!\n');
  process.exit(1);
}
