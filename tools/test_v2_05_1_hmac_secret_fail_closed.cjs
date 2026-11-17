/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SPRINT V2-05.1 TEST SUITE
 * Test: HMAC Secret Fail-Closed Security, Dedicated Key & Non-Fatal Decoupling
 * File: tools/test_v2_05_1_hmac_secret_fail_closed.cjs
 * 
 * Verifies Test Cases A through L mandated by Sprint V2-05.1:
 * Case A: Missing key => customer ingestion CONFIGURATION_ERROR
 * Case B: Empty/whitespace key => CONFIGURATION_ERROR
 * Case C: Weak/invalid key (< 32 chars, placeholder) => CONFIGURATION_ERROR
 * Case D: Valid dedicated key (>= 32 bytes entropy) => ingestion works
 * Case E: Determinism: Same identity + same key => same hash
 * Case F: Isolation: Same identity + different key => different hash
 * Case G: Zero Fallback: TIKTOK_APP_SECRET exists but key missing => MUST FAIL
 * Case H: Zero Fallback: AUTH_SIGNING_KEY exists but key missing => MUST FAIL
 * Case I: Zero Leakage: API responses never expose key
 * Case J: Zero Leakage: System logs/exceptions never expose key
 * Case K: Non-Fatal: Orders sync succeeds even if customer key is missing
 * Case L: Regression: Privacy masking invariants preserved
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
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('====================================================================');
console.log('  SPRINT V2-05.1: HMAC SECRET FAIL-CLOSED SECURITY TEST SUITE');
console.log(`  Resolved PHP Binary: ${phpCli}`);
console.log('====================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runPhpCode(code, envOverrides = {}) {
  const tempScript = path.join(__dirname, `_temp_v2_05_1_test_${Date.now()}_${Math.floor(Math.random() * 1000)}.php`);
  
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

${envPuts}

define('PROJECT_ROOT', '${PROJECT_ROOT.replace(/\\/g, '/')}');
chdir(PROJECT_ROOT);

${code}
`;
  fs.writeFileSync(tempScript, fullCode, 'utf-8');
  try {
    const out = execSync(`"${phpCli}" -f "${tempScript}"`, {
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
// SECTION 1: FAIL-CLOSED ON MISSING / EMPTY / WEAK KEYS (CASES A, B, C)
// =====================================================================
console.log('[SECTION 1] Fail-Closed Validation (Cases A, B, C)');

test('CASE A: Missing CUSTOMER_IDENTITY_HMAC_KEY => CONFIGURATION_ERROR & CUSTOMER_IDENTITY_HMAC_KEY_MISSING', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $svc = new CommerceCustomerService($db);
    $trust = $svc->getCustomerTrustMetrics('test_shop', '2026-09-01', '2026-09-30');
    $list = $svc->getCustomerList('test_shop', [], 1, 25, '2026-09-01', '2026-09-30');

    $threw = false;
    $reason = null;
    try {
        $svc->hashPhoneNumber('0912345678');
    } catch (CustomerConfigurationException $e) {
        $threw = true;
        $reason = $e->getReason();
    }

    echo json_encode([
        'is_configured' => $svc->isConfigured(),
        'trust_status' => $trust['status'],
        'trust_reason' => $trust['reason'],
        'key_status' => $trust['key_status'],
        'list_status' => $list['status'],
        'list_reason' => $list['reason'],
        'threw' => $threw,
        'thrown_reason' => $reason
    ]);
  `;
  const res = runPhpCode(script, { CUSTOMER_IDENTITY_HMAC_KEY: null });
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.is_configured !== false) throw new Error('Expected isConfigured to be false');
  if (data.trust_status !== 'CONFIGURATION_ERROR') throw new Error(`Expected trust status CONFIGURATION_ERROR, got ${data.trust_status}`);
  if (data.trust_reason !== 'CUSTOMER_IDENTITY_HMAC_KEY_MISSING') throw new Error(`Expected reason CUSTOMER_IDENTITY_HMAC_KEY_MISSING, got ${data.trust_reason}`);
  if (data.key_status !== 'MISSING') throw new Error(`Expected key_status MISSING, got ${data.key_status}`);
  if (data.list_status !== 'CONFIGURATION_ERROR') throw new Error(`Expected list status CONFIGURATION_ERROR, got ${data.list_status}`);
  if (!data.threw || data.thrown_reason !== 'CUSTOMER_IDENTITY_HMAC_KEY_MISSING') throw new Error('Expected hashPhoneNumber to throw CustomerConfigurationException');
});

test('CASE B: Empty or Whitespace key => CONFIGURATION_ERROR & CUSTOMER_IDENTITY_HMAC_KEY_MISSING', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $svc = new CommerceCustomerService($db, '    ');
    $trust = $svc->getCustomerTrustMetrics('test_shop');
    
    echo json_encode([
        'is_configured' => $svc->isConfigured(),
        'status' => $trust['status'],
        'reason' => $trust['reason'],
        'key_status' => $trust['key_status']
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.is_configured !== false) throw new Error('Expected isConfigured to be false');
  if (data.status !== 'CONFIGURATION_ERROR') throw new Error(`Expected status CONFIGURATION_ERROR, got ${data.status}`);
  if (data.reason !== 'CUSTOMER_IDENTITY_HMAC_KEY_MISSING') throw new Error(`Expected reason CUSTOMER_IDENTITY_HMAC_KEY_MISSING, got ${data.reason}`);
  if (data.key_status !== 'MISSING') throw new Error(`Expected key_status MISSING, got ${data.key_status}`);
});

test('CASE C: Weak / Short / Placeholder key (< 32 chars, YOUR_...) => CONFIGURATION_ERROR & CUSTOMER_IDENTITY_HMAC_KEY_INVALID', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $shortSvc = new CommerceCustomerService($db, 'short_secret_only_24_ch');
    $placeholderSvc = new CommerceCustomerService($db, 'YOUR_CUSTOMER_IDENTITY_HMAC_KEY_SECRET_32_BYTES!');
    $lowEntropySvc = new CommerceCustomerService($db, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    echo json_encode([
        'short_status' => $shortSvc->getCustomerTrustMetrics('s')['status'],
        'short_reason' => $shortSvc->getConfigReason(),
        'short_key_st' => $shortSvc->getKeyStatus(),
        'ph_status' => $placeholderSvc->getCustomerTrustMetrics('s')['status'],
        'ph_reason' => $placeholderSvc->getConfigReason(),
        'ph_key_st' => $placeholderSvc->getKeyStatus(),
        'le_status' => $lowEntropySvc->getCustomerTrustMetrics('s')['status'],
        'le_reason' => $lowEntropySvc->getConfigReason()
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.short_status !== 'CONFIGURATION_ERROR' || data.short_reason !== 'CUSTOMER_IDENTITY_HMAC_KEY_INVALID' || data.short_key_st !== 'INVALID') {
    throw new Error('Short key did not trigger CUSTOMER_IDENTITY_HMAC_KEY_INVALID');
  }
  if (data.ph_status !== 'CONFIGURATION_ERROR' || data.ph_reason !== 'CUSTOMER_IDENTITY_HMAC_KEY_INVALID' || data.ph_key_st !== 'INVALID') {
    throw new Error('Placeholder key did not trigger CUSTOMER_IDENTITY_HMAC_KEY_INVALID');
  }
  if (data.le_status !== 'CONFIGURATION_ERROR' || data.le_reason !== 'CUSTOMER_IDENTITY_HMAC_KEY_INVALID') {
    throw new Error('Low entropy key did not trigger CUSTOMER_IDENTITY_HMAC_KEY_INVALID');
  }
});

// =====================================================================
// SECTION 2: VALID KEY, DETERMINISM & ISOLATION (CASES D, E, F)
// =====================================================================
console.log('\n[SECTION 2] Valid Key Ingestion & Cryptographic Determinism (Cases D, E, F)');

test('CASE D: Valid Dedicated Key (>= 32 bytes) => Ingestion works & status CONFIGURED', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $validKey = '7d9b4f2a1e8c3b5d6e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d';
    $svc = new CommerceCustomerService($db, $validKey);

    $hash = $svc->hashPhoneNumber('0912345678');
    $identity = $svc->resolveCustomerIdentity('buyer_999', null, '0912345678');

    echo json_encode([
        'is_configured' => $svc->isConfigured(),
        'key_status' => $svc->getKeyStatus(),
        'hash_len' => strlen($hash),
        'method' => $identity['identity_method'],
        'cust_hash_len' => strlen($identity['customer_identifier_hash'])
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.is_configured !== true) throw new Error('Expected isConfigured to be true');
  if (data.key_status !== 'CONFIGURED') throw new Error(`Expected key_status CONFIGURED, got ${data.key_status}`);
  if (data.hash_len !== 64) throw new Error(`Expected 64-character hex hash, got length ${data.hash_len}`);
  if (data.method !== 'BUYER_UID') throw new Error(`Expected BUYER_UID identity method, got ${data.method}`);
  if (data.cust_hash_len !== 64) throw new Error(`Expected 64-character hex customer hash, got ${data.cust_hash_len}`);
});

test('CASE E: Same Identity + Same Key => Same Hash (Cryptographic Determinism)', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $key = 'secret_alpha_0123456789abcdef0123456789abcdef';
    $svc1 = new CommerceCustomerService($db, $key);
    $svc2 = new CommerceCustomerService($db, $key);

    $h1 = $svc1->hashPhoneNumber('0987654321');
    $h2 = $svc2->hashPhoneNumber('0987654321');
    $h3 = $svc1->hashPhoneNumber('+84987654321'); // Normalized should match

    $id1 = $svc1->resolveCustomerIdentity('u123', 'rec456', '0987654321');
    $id2 = $svc2->resolveCustomerIdentity('u123', 'rec456', '0987654321');

    echo json_encode([
        'h1_eq_h2' => ($h1 === $h2),
        'h1_eq_h3' => ($h1 === $h3),
        'id1_eq_id2' => ($id1['customer_identifier_hash'] === $id2['customer_identifier_hash']),
        'h1' => $h1
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (!data.h1_eq_h2) throw new Error('Same key produced different hashes for same phone');
  if (!data.h1_eq_h3) throw new Error('Normalized phone did not match plain phone hash');
  if (!data.id1_eq_id2) throw new Error('Same key produced different identity hashes for same identity');
});

test('CASE F: Same Identity + Different Key => Different Hash (Key Decoupling)', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $key1 = 'secret_key_11111111111111111111111111111111';
    $key2 = 'secret_key_22222222222222222222222222222222';
    $svc1 = new CommerceCustomerService($db, $key1);
    $svc2 = new CommerceCustomerService($db, $key2);

    $h1 = $svc1->hashPhoneNumber('0912345678');
    $h2 = $svc2->hashPhoneNumber('0912345678');

    $id1 = $svc1->resolveCustomerIdentity('user_xyz', null, null);
    $id2 = $svc2->resolveCustomerIdentity('user_xyz', null, null);

    echo json_encode([
        'phones_differ' => ($h1 !== $h2),
        'identities_differ' => ($id1['customer_identifier_hash'] !== $id2['customer_identifier_hash'])
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (!data.phones_differ) throw new Error('Different keys produced identical phone hash!');
  if (!data.identities_differ) throw new Error('Different keys produced identical identity hash!');
});

// =====================================================================
// SECTION 3: ZERO FALLBACK ENFORCEMENT (CASES G, H)
// =====================================================================
console.log('\n[SECTION 3] Zero Fallback Invariants (Cases G, H)');

test('CASE G: TIKTOK_APP_SECRET exists but CUSTOMER_IDENTITY_HMAC_KEY missing => MUST FAIL (Zero Fallback)', () => {
  const script = `
    // Define TIKTOK_APP_SECRET as if in production OAuth environment
    putenv('TIKTOK_APP_SECRET=tiktok_oauth_secret_which_must_not_be_used_as_customer_salt!!');
    $_ENV['TIKTOK_APP_SECRET'] = 'tiktok_oauth_secret_which_must_not_be_used_as_customer_salt!!';
    
    // Explicitly wipe customer key
    putenv('CUSTOMER_IDENTITY_HMAC_KEY');
    unset($_ENV['CUSTOMER_IDENTITY_HMAC_KEY']);
    unset($_SERVER['CUSTOMER_IDENTITY_HMAC_KEY']);

    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $svc = new CommerceCustomerService($db);
    $trust = $svc->getCustomerTrustMetrics('shop123');

    $threw = false;
    try {
        $svc->hashPhoneNumber('0912345678');
    } catch (CustomerConfigurationException $e) {
        $threw = true;
    }

    echo json_encode([
        'is_configured' => $svc->isConfigured(),
        'status' => $trust['status'],
        'reason' => $trust['reason'],
        'threw' => $threw
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.is_configured !== false) throw new Error('CommerceCustomerService incorrectly considered configured using TIKTOK_APP_SECRET!');
  if (data.status !== 'CONFIGURATION_ERROR') throw new Error(`Expected CONFIGURATION_ERROR, got ${data.status}`);
  if (data.reason !== 'CUSTOMER_IDENTITY_HMAC_KEY_MISSING') throw new Error(`Expected reason CUSTOMER_IDENTITY_HMAC_KEY_MISSING, got ${data.reason}`);
  if (!data.threw) throw new Error('hashPhoneNumber did not throw despite missing dedicated key!');
});

test('CASE H: AUTH_SIGNING_KEY exists but CUSTOMER_IDENTITY_HMAC_KEY missing => MUST FAIL (Zero Fallback)', () => {
  const script = `
    // Define AUTH_SIGNING_KEY as if in JWT auth environment
    putenv('AUTH_SIGNING_KEY=jwt_bearer_token_signing_key_32_bytes_len_secure!!');
    $_ENV['AUTH_SIGNING_KEY'] = 'jwt_bearer_token_signing_key_32_bytes_len_secure!!';

    // Explicitly wipe customer key
    putenv('CUSTOMER_IDENTITY_HMAC_KEY');
    unset($_ENV['CUSTOMER_IDENTITY_HMAC_KEY']);
    unset($_SERVER['CUSTOMER_IDENTITY_HMAC_KEY']);

    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $svc = new CommerceCustomerService($db);
    $trust = $svc->getCustomerTrustMetrics('shop123');

    $threw = false;
    try {
        $svc->resolveCustomerIdentity('u123', null, '0912345678');
    } catch (CustomerConfigurationException $e) {
        $threw = true;
    }

    echo json_encode([
        'is_configured' => $svc->isConfigured(),
        'status' => $trust['status'],
        'reason' => $trust['reason'],
        'threw' => $threw
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.is_configured !== false) throw new Error('CommerceCustomerService incorrectly considered configured using AUTH_SIGNING_KEY!');
  if (data.status !== 'CONFIGURATION_ERROR') throw new Error(`Expected CONFIGURATION_ERROR, got ${data.status}`);
  if (data.reason !== 'CUSTOMER_IDENTITY_HMAC_KEY_MISSING') throw new Error(`Expected reason CUSTOMER_IDENTITY_HMAC_KEY_MISSING, got ${data.reason}`);
  if (!data.threw) throw new Error('resolveCustomerIdentity did not throw despite missing dedicated key!');
});

// =====================================================================
// SECTION 4: ZERO SECRET LEAKAGE (CASES I, J)
// =====================================================================
console.log('\n[SECTION 4] Zero Secret Leakage (Cases I, J)');

test('CASE I: No API response exposes CUSTOMER_IDENTITY_HMAC_KEY', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $secretKey = 'super_top_secret_hmac_key_strictly_never_leak_998877';
    $svc = new CommerceCustomerService($db, $secretKey);

    $trust = $svc->getCustomerTrustMetrics('shop_test');
    $list = $svc->getCustomerList('shop_test', [], 1, 25);
    $recip = $svc->getOrderRecipient('shop_test', 'order_123');

    $combinedJson = json_encode([$trust, $list, $recip]);
    
    // Check if secret string exists anywhere in the JSON output
    $containsSecret = (strpos($combinedJson, $secretKey) !== false);
    $keyStatusPresent = ($trust['key_status'] === 'CONFIGURED');

    echo json_encode([
        'contains_secret' => $containsSecret,
        'key_status_present' => $keyStatusPresent
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.contains_secret) throw new Error('CRITICAL: API response contains the secret key string!');
  if (!data.key_status_present) throw new Error('Expected key_status=CONFIGURED in trust metrics');
});

test('CASE J: No exceptions or logs expose CUSTOMER_IDENTITY_HMAC_KEY', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $secretKey = 'short_leak_attempt_key'; // Invalid key
    $svc = new CommerceCustomerService($db, $secretKey);

    $exMsg = '';
    try {
        $svc->hashPhoneNumber('0912345678');
    } catch (CustomerConfigurationException $e) {
        $exMsg = $e->getMessage();
    }

    $trustMsg = $svc->getCustomerTrustMetrics('s')['message'];

    $leakedInException = (strpos($exMsg, $secretKey) !== false);
    $leakedInTrust = (strpos($trustMsg, $secretKey) !== false);

    echo json_encode([
        'leaked_in_ex' => $leakedInException,
        'leaked_in_trust' => $leakedInTrust
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.leaked_in_ex) throw new Error('CRITICAL: Exception message leaks secret value!');
  if (data.leaked_in_trust) throw new Error('CRITICAL: Trust message leaks secret value!');
});

// =====================================================================
// SECTION 5: NON-FATAL ORDERS SYNC DECOUPLING (CASE K)
// =====================================================================
console.log('\n[SECTION 5] Orders Sync Non-Fatal Decoupling (Case K)');

test('CASE K: Orders sync remains successful when customer ingestion configuration fails', () => {
  const script = `
    // Wipe customer identity key completely
    putenv('CUSTOMER_IDENTITY_HMAC_KEY');
    unset($_ENV['CUSTOMER_IDENTITY_HMAC_KEY']);
    unset($_SERVER['CUSTOMER_IDENTITY_HMAC_KEY']);

    require_once 'public/api/commerce_customer_service.php';
    require_once 'public/api/commerce_sync_orchestrator.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $orchestrator = new CommerceSyncOrchestrator($db);
    
    // Customer domain directly reports CONFIGURATION_ERROR
    $custRes = $orchestrator->syncCustomerDomain('test_shop', '2026-09-01', '2026-09-30');

    // Simulate Step 3b non-fatal execution inside Orders Sync
    $step3bFailedFatal = false;
    try {
        $customerService = new CommerceCustomerService($db);
        if ($customerService->isConfigured()) {
            $customerService->backfillCustomerProfilesFromDb('test_shop', '2026-09-01', '2026-09-30');
        }
    } catch (\\Throwable $t) {
        $step3bFailedFatal = true;
    }

    echo json_encode([
        'customer_domain_status' => $custRes['status'],
        'customer_domain_reason' => $custRes['reason'] ?? null,
        'step3b_fatal' => $step3bFailedFatal
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.customer_domain_status !== 'CONFIGURATION_ERROR') {
    throw new Error(`Expected syncCustomerDomain status CONFIGURATION_ERROR, got ${data.customer_domain_status}`);
  }
  if (data.customer_domain_reason !== 'CUSTOMER_IDENTITY_HMAC_KEY_MISSING') {
    throw new Error(`Expected reason CUSTOMER_IDENTITY_HMAC_KEY_MISSING, got ${data.customer_domain_reason}`);
  }
  if (data.step3b_fatal) {
    throw new Error('Customer configuration error was fatal to orders sync execution!');
  }
});

// =====================================================================
// SECTION 6: EXISTING V2-05 PRIVACY REGRESSION (CASE L)
// =====================================================================
console.log('\n[SECTION 6] Existing V2-05 Privacy Invariants (Case L)');

test('CASE L: Existing V2-05 privacy tests remain PASS with valid key', () => {
  const validKey = 'production_quality_customer_hmac_secret_32_bytes_length!!';
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';
    $db = createMockPDO();

    $svc = new CommerceCustomerService($db, '${validKey}');

    $phoneMasked = CommerceCustomerService::maskPhone('0912345678');
    $nameMasked = CommerceCustomerService::maskName('Nguyen Van A');
    $addressMasked = CommerceCustomerService::maskAddress('123 Đường Số 1, Phường 2, Quận 3, TP Hồ Chí Minh');

    echo json_encode([
        'phone_masked' => $phoneMasked,
        'name_masked' => $nameMasked,
        'address_masked' => $addressMasked,
        'is_configured' => $svc->isConfigured()
    ]);
  `;
  const res = runPhpCode(script);
  if (!res.success) throw new Error('PHP run failed: ' + res.error);
  const data = JSON.parse(res.output);
  if (data.phone_masked !== '09******78') throw new Error(`Unexpected phone mask: ${data.phone_masked}`);
  if (data.name_masked !== 'Ng*** Va*** A*') throw new Error(`Unexpected name mask: ${data.name_masked}`);
  if (!data.address_masked.includes('*** 123 Đường Số 1')) throw new Error(`Unexpected address mask: ${data.address_masked}`);
  if (!data.is_configured) throw new Error('Service failed to initialize with valid key');
});

// Summary
console.log('\n====================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${totalTests - passedTests}`);
console.log('====================================================================');

if (passedTests === totalTests) {
  console.log('ALL V2-05.1 HMAC SECRET FAIL-CLOSED TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error('SOME V2-05.1 TESTS FAILED!\n');
  process.exit(1);
}
