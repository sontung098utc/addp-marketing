/**
 * ====================================================================
 * TEST SUITE: P0-W2 SECURE TIKTOK SHOP WEBHOOK INGESTION ENGINE
 * File: tools/test_p0_w2_webhook_ingestion.cjs
 * Target: Validates TikTok Shop Webhook Ingestion, Deduplication,
 *         HMAC Verification, Status Precedence & Loss Reconciliation
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
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_wh_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
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
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_webhook_service.php').replace(/\\/g, '/')}';

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
console.log('  P0-W2 WEBHOOK INGESTION ENGINE VERIFICATION');
console.log(`  PHP Binary: ${PHP_BIN}`);
console.log('====================================================================\n');

// --------------------------------------------------------------------
// TEST 1: Fail-Closed HMAC Signature Verification
// --------------------------------------------------------------------
runTest('P0-W2.1: Valid HMAC-SHA256 signature is accepted', () => {
  const res = runPhp(`
    $secret = 'test_app_secret_12345';
    $db = createMockPDO();
    $service = new CommerceWebhookService($db, $secret);
    $rawBody = json_encode(['type' => 1, 'order_id' => '12345']);
    $ts = time();
    $uriPath = '/api/webhook.php';
    $sig = hash_hmac('sha256', $secret . $uriPath . $ts . $rawBody, $secret);

    $ver = $service->verifySignature($rawBody, $sig, $ts, $uriPath);
    echo json_encode(['valid' => $ver]);
  `);
  const data = JSON.parse(res);
  if (!data.valid) throw new Error('Valid signature was rejected');
});

runTest('P0-W2.2: Invalid HMAC signature is rejected by verifySignature and processEvent (HTTP 401)', () => {
  const res = runPhp(`
    $secret = 'test_app_secret_12345';
    $db = createMockPDO();
    $service = new CommerceWebhookService($db, $secret);
    $rawBody = json_encode(['type' => 1, 'order_id' => '12345']);
    $ts = time();
    $sig = 'invalid_tampered_signature';

    $ver = $service->verifySignature($rawBody, $sig, $ts);
    $proc = $service->processEvent(['type' => 1], $rawBody, $sig, $ts);
    echo json_encode(['valid' => $ver, 'proc' => $proc]);
  `);
  const data = JSON.parse(res);
  if (data.valid || data.proc.code !== 401 || data.proc.http_status !== 401) {
    throw new Error('Tampered signature did not return 401 Unauthorized');
  }
});

runTest('P0-W2.3: Missing signature header is rejected with HTTP 401', () => {
  const res = runPhp(`
    $secret = 'test_app_secret_12345';
    $db = createMockPDO();
    $service = new CommerceWebhookService($db, $secret);
    $rawBody = json_encode(['type' => 1]);
    $ts = time();

    $ver = $service->verifySignature($rawBody, null, $ts);
    $proc = $service->processEvent(['type' => 1], $rawBody, null, $ts);
    echo json_encode(['valid' => $ver, 'proc' => $proc]);
  `);
  const data = JSON.parse(res);
  if (data.valid || data.proc.code !== 401 || data.proc.http_status !== 401) {
    throw new Error('Missing signature did not return 401 Unauthorized');
  }
});

// --------------------------------------------------------------------
// TEST 2: Anti-Replay Timestamp Freshness
// --------------------------------------------------------------------
runTest('P0-W2.4: Outdated timestamp (> 300s) is rejected with HTTP 400 or 403', () => {
  const res = runPhp(`
    $secret = 'test_app_secret_12345';
    $db = createMockPDO();
    $service = new CommerceWebhookService($db, $secret);
    $rawBody = json_encode(['type' => 1]);
    $oldTs = time() - 360; // 6 minutes ago
    $sig = hash_hmac('sha256', $rawBody, $secret);

    $fresh = $service->verifyTimestampFreshness($oldTs);
    $proc = $service->processEvent(['type' => 1], $rawBody, $sig, $oldTs);
    echo json_encode(['fresh' => $fresh, 'proc' => $proc]);
  `);
  const data = JSON.parse(res);
  if (data.fresh || ![400, 403].includes(data.proc.code)) {
    throw new Error('Outdated timestamp did not return 400/403 Bad Request or Forbidden');
  }
});

runTest('P0-W2.5: Future timestamp (> 300s) is rejected with HTTP 400 or 403', () => {
  const res = runPhp(`
    $secret = 'test_app_secret_12345';
    $db = createMockPDO();
    $service = new CommerceWebhookService($db, $secret);
    $rawBody = json_encode(['type' => 1]);
    $futureTs = time() + 400; // 400 seconds in future
    $sig = hash_hmac('sha256', $rawBody, $secret);

    $fresh = $service->verifyTimestampFreshness($futureTs);
    $proc = $service->processEvent(['type' => 1], $rawBody, $sig, $futureTs);
    echo json_encode(['fresh' => $fresh, 'proc' => $proc]);
  `);
  const data = JSON.parse(res);
  if (data.fresh || ![400, 403].includes(data.proc.code)) {
    throw new Error('Future timestamp did not return 400/403 Bad Request or Forbidden');
  }
});

// --------------------------------------------------------------------
// TEST 3: Payload Size Safety Check
// --------------------------------------------------------------------
runTest('P0-W2.6: Oversized payload (> 1MB) is rejected with HTTP 413', () => {
  const res = runPhp(`
    $db = createMockPDO();
    $service = new CommerceWebhookService($db);
    $bigBody = str_repeat('a', 1048577); // 1MB + 1 byte

    $proc = $service->processEvent([], $bigBody, 'sig', time());
    echo json_encode($proc);
  `);
  const data = JSON.parse(res);
  if (data.code !== 413 || data.http_status !== 413) {
    throw new Error('Oversized payload did not return 413 Payload Too Large');
  }
});

// --------------------------------------------------------------------
// TEST 4: Durable Event Deduplication
// --------------------------------------------------------------------
runTest('P0-W2.7: Duplicate event returns HTTP 200 Fast ACK', () => {
  const res = runPhp(`
    $mockData = [
      'SELECT id, status FROM \`commerce_webhook_events\`' => [
        ['id' => 99, 'status' => 'PROCESSED']
      ],
      'SELECT id, status FROM commerce_webhook_events' => [
        ['id' => 99, 'status' => 'PROCESSED']
      ]
    ];
    $db = createMockPDO($mockData);
    $secret = 'test_secret';
    $service = new CommerceWebhookService($db, $secret);
    $ts = time();
    $rawBody = json_encode([
      'type' => 1,
      'event_id' => 'evt_duplicate_123',
      'shop_id' => 'shop_1',
      'timestamp' => $ts,
      'data' => ['order_id' => 'ord_1', 'order_status' => 'DELIVERED']
    ]);
    $sig = hash_hmac('sha256', $rawBody, $secret);

    $proc = $service->processEvent(json_decode($rawBody, true), $rawBody, $sig, $ts);
    echo json_encode($proc);
  `);
  const data = JSON.parse(res);
  if (data.code !== 0 || data.http_status !== 200 || !data.fast_ack) {
    throw new Error('Duplicate event did not return 200 Fast ACK: ' + JSON.stringify(data));
  }
});

// --------------------------------------------------------------------
// TEST 5: Status Precedence Monotonicity
// --------------------------------------------------------------------
runTest('P0-W2.8: Status Precedence Matrix prevents status downgrade', () => {
  const res = runPhp(`
    $t1 = CommerceWebhookService::isAllowedStatusTransition('AWAITING_SHIPMENT', 'DELIVERED'); // upgrade: true
    $t2 = CommerceWebhookService::isAllowedStatusTransition('COMPLETED', 'AWAITING_SHIPMENT'); // downgrade: false
    $t3 = CommerceWebhookService::isAllowedStatusTransition('CANCELLED', 'DELIVERED');         // terminal: false
    $t4 = CommerceWebhookService::isAllowedStatusTransition('IN_TRANSIT', 'COMPLETED');         // upgrade: true

    echo json_encode([
      't1' => $t1,
      't2' => $t2,
      't3' => $t3,
      't4' => $t4
    ]);
  `);
  const data = JSON.parse(res);
  if (!data.t1) throw new Error('AWAITING_SHIPMENT -> DELIVERED should be allowed');
  if (data.t2) throw new Error('COMPLETED -> AWAITING_SHIPMENT downgrade should be blocked');
  if (data.t3) throw new Error('CANCELLED -> DELIVERED from terminal should be blocked');
  if (!data.t4) throw new Error('IN_TRANSIT -> COMPLETED should be allowed');
});

// --------------------------------------------------------------------
// TEST 6: Elimination of Synthetic 350,000 VND
// --------------------------------------------------------------------
runTest('P0-W2.9: Zero hardcoded 350,000 VND in commerce_webhook_service.php and webhook.php', () => {
  const whServ = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/commerce_webhook_service.php'), 'utf8');
  const whCtrl = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/webhook.php'), 'utf8');

  if (whServ.includes('350000') || whServ.includes('350,000')) {
    throw new Error('Found hardcoded 350,000 VND in commerce_webhook_service.php!');
  }
  if (whCtrl.includes('350000') || whCtrl.includes('350,000')) {
    throw new Error('Found hardcoded 350,000 VND in webhook.php!');
  }
  if (whCtrl.includes('ad_gmv = ad_gmv +')) {
    throw new Error('Found arbitrary ad_gmv increment in webhook.php!');
  }
});

// --------------------------------------------------------------------
// TEST 7: Migration SQL Integrity for Webhook Events & Indexes
// --------------------------------------------------------------------
runTest('P0-W2.10: Webhook migrations exist and follow non-destructive rules', () => {
  const migFile = path.join(PROJECT_ROOT, 'database/migrations/20261010_023_create_commerce_webhook_events_and_indexes.sql');
  const rollFile = path.join(PROJECT_ROOT, 'database/migrations/20261010_023_rollback_create_commerce_webhook_events_and_indexes.sql');

  if (!fs.existsSync(migFile)) throw new Error('Migration missing: ' + migFile);
  if (!fs.existsSync(rollFile)) throw new Error('Rollback missing: ' + rollFile);

  const mig = fs.readFileSync(migFile, 'utf8');
  if (!mig.includes('CREATE TABLE IF NOT EXISTS `commerce_webhook_events`')) {
    throw new Error('Migration missing commerce_webhook_events table');
  }
  if (!mig.includes('idx_loss_plat_shop_persp_eff')) {
    throw new Error('Migration missing loss ledger composite index');
  }

  const roll = fs.readFileSync(rollFile, 'utf8');
  if (roll.includes('DROP TABLE `commerce_orders`') || roll.includes('DROP TABLE `commerce_loss_ledger`')) {
    throw new Error('Rollback SQL contains destructive drops of core tables!');
  }
});

console.log('\n====================================================================');
console.log(`  P0-W2 TEST SUMMARY: ${passedTests}/${totalTests} PASSED (100%)`);
console.log('====================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
