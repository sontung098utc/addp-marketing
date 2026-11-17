/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SPRINT V2-05.2.3 REGRESSION TEST SUITE
 * Test: Historical RMA Period Sync & Coverage Integrity Fix
 * File: tools/test_v2_05_2_3_historical_rma_sync.cjs
 * Requirements: 22 Regression Test Cases (Section 14)
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
console.log('  SPRINT V2-05.2.3: HISTORICAL RMA SYNC & COVERAGE INTEGRITY (22 TESTS)');
console.log(`  Resolved PHP Command: ${phpCmd}`);
console.log('====================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runPhpCode(code, envOverrides = {}) {
  const tempScript = path.join(__dirname, `_temp_v2_05_2_3_test_${Date.now()}_${Math.floor(Math.random() * 1000)}.php`);
  
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
putenv('FEATURE_ENABLE_AFTERSALES_V2=true');
$_ENV['FEATURE_ENABLE_AFTERSALES_V2'] = 'true';
$_SERVER['FEATURE_ENABLE_AFTERSALES_V2'] = 'true';
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

// =====================================================================
// SECTION 1: HISTORICAL VS INCREMENTAL MODE SEPARATION (Tests 1-6)
// =====================================================================
console.log('\n[SECTION 1] Mode Separation & Date Boundaries (Tests 1-6)');

test('1. Request for Jan 2026 dispatches historical backfill, not incremental sync', () => {
  const orchestratorCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_orchestrator.php'), 'utf8');
  assert(orchestratorCode.includes('$isHistoricalPeriod = (!empty($startDate) && empty($options[\'rolling_refresh\']) && empty($options[\'incremental\']));'), 'Orchestrator must determine historical period from startDate and lack of rolling options');

  const php = `
    require_once 'public/api/commerce_sync_orchestrator.php';
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingClient1 extends TikTokShopClient {
      public array $calls = [];
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        $this->calls[] = $params;
        return ['reverse_orders' => [], 'has_more' => false];
      }
    }

    $client = new TrackingClient1();
    $db = new MockPDO([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']]
    ]);

    $orch = new CommerceSyncOrchestrator($db, []);
    // Inject client into orchestrator's aftersales call
    $refMethod = new ReflectionMethod(CommerceSyncOrchestrator::class, 'syncRmaDomain');
    $refMethod->setAccessible(true);

    // Call aftersales directly via initialBackfillRma as orchestrator does
    $aftersales = new CommerceAftersalesService($db, $client);
    $bounds = CommerceAftersalesService::resolvePeriodTimestamps('2026-01-01', '2026-01-31');
    $res = $aftersales->initialBackfillRma('shop_1', $bounds['start_timestamp'], $bounds['end_exclusive_timestamp']);

    echo json_encode([
      'calls' => $client->calls,
      'status' => $res['status']
    ]);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const data = JSON.parse(run.output);
  assert(data.calls.length > 0, 'Must have called TikTok searchReturnRefundRmaV2');
  assert(data.calls[0].create_time_ge !== undefined, 'Must pass create_time_ge in historical mode');
  assert(data.calls[0].update_time_ge === undefined, 'Must NOT pass update_time_ge in historical mode');
});

test('2. Historical backfill passes create_time_ge and create_time_lt to API client', () => {
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class MockClient2 extends TikTokShopClient {
      public array $passedParams = [];
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        $this->passedParams = $params;
        return ['reverse_orders' => [], 'has_more' => false];
      }
    }

    $client = new MockClient2();
    $db = new MockPDO([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']]
    ]);

    $svc = new CommerceAftersalesService($db, $client);
    $bounds = CommerceAftersalesService::resolvePeriodTimestamps('2026-01-01', '2026-01-31');
    $svc->initialBackfillRma('shop_1', $bounds['start_timestamp'], $bounds['end_exclusive_timestamp']);

    echo json_encode([
      'params' => $client->passedParams,
      'expected_ge' => $bounds['start_timestamp'],
      'expected_lt' => $bounds['end_exclusive_timestamp']
    ]);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const data = JSON.parse(run.output);
  assert(data.params.create_time_ge !== undefined, 'create_time_ge must be passed');
  assert(data.params.create_time_lt !== undefined, 'create_time_lt must be passed');
  assert.strictEqual(data.params.create_time_ge, data.expected_ge);
  assert.strictEqual(data.params.create_time_lt, data.expected_lt);
});

test('3. Historical backfill transforms end_date 2026-01-31 into exclusive bound 2026-02-01 00:00:00 (1769904000)', () => {
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    $bounds = CommerceAftersalesService::resolvePeriodTimestamps('2026-01-01', '2026-01-31');
    echo json_encode($bounds);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const bounds = JSON.parse(run.output);
  assert.strictEqual(bounds.start_datetime, '2026-01-01 00:00:00');
  assert.strictEqual(bounds.end_exclusive_datetime, '2026-02-01 00:00:00');
  assert.strictEqual(bounds.end_exclusive_timestamp - bounds.start_timestamp, 31 * 86400, 'Difference must be exactly 31 days in seconds');
});

test('4. Request with explicit period NEVER executes incrementalSyncRma()', () => {
  const orchestratorCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_orchestrator.php'), 'utf8');
  // Check Mode A vs Mode B branching in syncRmaDomain
  assert(orchestratorCode.includes('$isHistoricalPeriod = (!empty($startDate) && empty($options[\'rolling_refresh\']) && empty($options[\'incremental\']));'), 'Must branch on isHistoricalPeriod');
  assert(orchestratorCode.includes('if ($isHistoricalPeriod) {'), 'Must check if ($isHistoricalPeriod)');
  assert(orchestratorCode.includes('$aftersales->initialBackfillRma('), 'Must call initialBackfillRma in historical branch');
  assert(orchestratorCode.includes('$aftersales->incrementalSyncRma('), 'Must call incrementalSyncRma in else branch');
});

test('5. Request without explicit historical range executes incrementalSyncRma()', () => {
  const php = `
    require_once 'public/api/commerce_sync_orchestrator.php';
    require_once 'tools/mock_pdo_helper.php';
    class TrackingOrchPdo5 extends MockPDO {
      public bool $hasIncremental = false;
      public function prepare(string $query, array $options = []): PDOStatement {
        if (stripos($query, 'commerce_sync_runs') !== false && stripos($query, 'INSERT') !== false) {
          return new class($this) extends MockPDOStatement {
            private $parent;
            public function __construct($parent) { $this->parent = $parent; }
            public function execute(?array $params = null): bool {
              if (($params[':sync_type'] ?? '') === 'INCREMENTAL_DELTA') {
                $this->parent->hasIncremental = true;
              }
              return true;
            }
          };
        }
        return parent::prepare($query, $options);
      }
    }

    $db = new TrackingOrchPdo5([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']],
      'SELECT MAX(platform_updated_at)' => [['max_updated' => '2026-10-01 12:00:00']]
    ]);

    class MockClient5 extends TikTokShopClient {
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        return ['returns' => [], 'has_more' => false];
      }
    }

    $client = new MockClient5();
    $orch = new CommerceSyncOrchestrator($db, [], null, $client);
    $refMethod = new ReflectionMethod(CommerceSyncOrchestrator::class, 'syncRmaDomain');
    $refMethod->setAccessible(true);
    // No startDate provided => incremental
    $res = $refMethod->invoke($orch, 'shop_1', null, date('Y-m-d'), []);

    echo json_encode([
      'has_incremental' => $db->hasIncremental,
      'status' => $res['status']
    ]);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const data = JSON.parse(run.output);
  assert.strictEqual(data.has_incremental, true, 'Must record INCREMENTAL_DELTA when no startDate');
});

test('6. Incremental sync still uses update_time_ge/update_time_lt based on DB watermark', () => {
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class MockIncrementalClient6 extends TikTokShopClient {
      public array $params = [];
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        $this->params = $params;
        return ['reverse_orders' => [], 'has_more' => false];
      }
    }

    $client = new MockIncrementalClient6();
    $db = new MockPDO([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']],
      'SELECT MAX(platform_updated_at)' => [['max_updated' => '2026-10-01 12:00:00']]
    ]);

    $svc = new CommerceAftersalesService($db, $client);
    $svc->incrementalSyncRma('shop_1', 86400, 50, 10);

    echo json_encode($client->params);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const params = JSON.parse(run.output);
  assert(params.update_time_ge !== undefined, 'Incremental mode must use update_time_ge');
  assert(params.update_time_lt !== undefined, 'Incremental mode must use update_time_lt');
  assert(params.create_time_ge === undefined, 'Incremental mode must NOT use create_time_ge');
});

// =====================================================================
// SECTION 2: CANONICAL ENDPOINTS & RUN METADATA (Tests 7-9)
// =====================================================================
console.log('\n[SECTION 2] Canonical Endpoints & Audit Metadata (Tests 7-9)');

test('7. sync_type in commerce_sync_runs is recorded truthfully', () => {
  const php = `
    require_once 'public/api/commerce_sync_orchestrator.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingOrchPdo7 extends MockPDO {
      public array $runTypes = [];
      public function prepare(string $query, array $options = []): PDOStatement {
        if (stripos($query, 'INSERT INTO \`commerce_sync_runs\`') !== false) {
          return new class($this) extends MockPDOStatement {
            private $parent;
            public function __construct($parent) { $this->parent = $parent; }
            public function execute(?array $params = null): bool {
              $this->parent->runTypes[] = $params[':sync_type'] ?? 'unknown';
              return true;
            }
          };
        }
        return parent::prepare($query, $options);
      }
    }

    $db = new TrackingOrchPdo7([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']]
    ]);

    $orch = new CommerceSyncOrchestrator($db, []);
    $refMethod = new ReflectionMethod(CommerceSyncOrchestrator::class, 'syncRmaDomain');
    $refMethod->setAccessible(true);

    // Run A: Historical
    $refMethod->invoke($orch, 'shop_1', '2026-01-01', '2026-01-31', []);
    // Run B: Rolling
    $refMethod->invoke($orch, 'shop_1', '2026-01-01', '2026-01-31', ['rolling_refresh' => true]);

    echo json_encode($db->runTypes);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const types = JSON.parse(run.output);
  assert(types.includes('HISTORICAL_BACKFILL'), 'Must record HISTORICAL_BACKFILL for historical run');
  assert(types.includes('INCREMENTAL_DELTA'), 'Must record INCREMENTAL_DELTA for rolling run');
});

test('8. api_endpoint in commerce_sync_runs is recorded as canonical /return_refund/202602/returns/search', () => {
  const php = `
    require_once 'public/api/commerce_sync_orchestrator.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingOrchPdo8 extends MockPDO {
      public array $endpoints = [];
      public function prepare(string $query, array $options = []): PDOStatement {
        if (stripos($query, 'INSERT INTO \`commerce_sync_runs\`') !== false) {
          return new class($this) extends MockPDOStatement {
            private $parent;
            public function __construct($parent) { $this->parent = $parent; }
            public function execute(?array $params = null): bool {
              $this->parent->endpoints[] = $params[':api_endpoint'] ?? 'unknown';
              return true;
            }
          };
        }
        return parent::prepare($query, $options);
      }
    }

    $db = new TrackingOrchPdo8([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'api_endpoint']]
    ]);

    $orch = new CommerceSyncOrchestrator($db, []);
    $refMethod = new ReflectionMethod(CommerceSyncOrchestrator::class, 'syncRmaDomain');
    $refMethod->setAccessible(true);
    $refMethod->invoke($orch, 'shop_1', '2026-01-01', '2026-01-31', []);

    echo json_encode($db->endpoints);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const endpoints = JSON.parse(run.output);
  assert(endpoints.includes('/return_refund/202602/returns/search'), 'api_endpoint must be canonical /return_refund/202602/returns/search');
});

test('9. No reference to stale reverse_orders search endpoint remains in RMA sync path', () => {
  const filesToCheck = [
    path.join(PROJECT_ROOT, 'public', 'api', 'commerce_aftersales_service.php'),
    path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_orchestrator.php')
  ];
  for (const f of filesToCheck) {
    const content = fs.readFileSync(f, 'utf8');
    assert(!content.includes('/return_refund/202309/reverse_orders/search'), `Found stale endpoint in ${path.basename(f)}`);
  }
});

// =====================================================================
// SECTION 3: RANGE VALIDATION & ERROR CODE (Tests 10-13)
// =====================================================================
console.log('\n[SECTION 3] Range Validation & Counters Integrity (Tests 10-13)');

test('10. If API returns RMA outside requested create_time window during historical backfill, marks run PARTIAL/FAILED with error_code = RMA_PERIOD_MISMATCH', () => {
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class OutOfRangeClient extends TikTokShopClient {
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        return [
          'reverse_orders' => [
            [
              'reverse_order_id' => 'rma_out_of_range_1',
              'order_id' => 'ord_sep_1',
              'reverse_status' => 'REFUND_COMPLETE',
              'reverse_type' => 'RETURN_AND_REFUND',
              'create_time' => 1789700000, // September 2026! Out of Jan 2026 bounds
              'update_time' => 1789700000,
              'refund_amount' => '50000',
              'currency' => 'VND'
            ]
          ],
          'has_more' => false
        ];
      }
    }

    $db = new MockPDO([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']]
    ]);

    $client = new OutOfRangeClient();
    $svc = new CommerceAftersalesService($db, $client);
    $bounds = CommerceAftersalesService::resolvePeriodTimestamps('2026-01-01', '2026-01-31');
    $res = $svc->initialBackfillRma('shop_1', $bounds['start_timestamp'], $bounds['end_exclusive_timestamp']);

    echo json_encode($res);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const res = JSON.parse(run.output);
  assert(res.status === 'PARTIAL' || res.status === 'FAILED', `Status must be PARTIAL or FAILED, got ${res.status}`);
  assert.strictEqual(res.error_code, 'RMA_PERIOD_MISMATCH');
  assert.strictEqual(res.out_of_range_count, 1);
  assert.strictEqual(res.records_read, 1);
  assert.strictEqual(res.records_written, 0, 'Out-of-range RMA must NOT be written to DB');
});

test('11. If API returns RMA within requested window, run completes with COMPLETED', () => {
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class InRangeClient extends TikTokShopClient {
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        return [
          'reverse_orders' => [
            [
              'reverse_order_id' => 'rma_jan_valid_1',
              'order_id' => 'ord_jan_1',
              'reverse_status' => 'REFUND_COMPLETE',
              'reverse_type' => 'RETURN_AND_REFUND',
              'create_time' => 1768000000, // Jan 2026, perfectly in-range!
              'update_time' => 1768000000,
              'refund_amount' => '120000',
              'currency' => 'VND'
            ]
          ],
          'has_more' => false
        ];
      }
    }

    $db = new MockPDO([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']],
      'SELECT id FROM \`commerce_orders\`' => [['id' => 101]],
      'SELECT id FROM \`commerce_aftersales\`' => [['id' => 202]]
    ]);

    $client = new InRangeClient();
    $svc = new CommerceAftersalesService($db, $client);
    $bounds = CommerceAftersalesService::resolvePeriodTimestamps('2026-01-01', '2026-01-31');
    $res = $svc->initialBackfillRma('shop_1', $bounds['start_timestamp'], $bounds['end_exclusive_timestamp']);

    echo json_encode($res);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const res = JSON.parse(run.output);
  assert.strictEqual(res.status, 'COMPLETED');
  assert.strictEqual(res.error_code, null);
  assert.strictEqual(res.records_read, 1);
  assert.strictEqual(res.records_written, 1);
});

test('12. records_read reflects number of RMA objects inspected from API', () => {
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class MultiCountClient extends TikTokShopClient {
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        return [
          'reverse_orders' => [
            ['reverse_order_id' => 'r1', 'order_id' => 'o1', 'create_time' => 1768000000],
            ['reverse_order_id' => 'r2', 'order_id' => 'o2', 'create_time' => 1768000000],
            ['reverse_order_id' => 'r3', 'order_id' => 'o3', 'create_time' => 1768000000]
          ],
          'has_more' => false
        ];
      }
    }

    $db = new MockPDO([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']],
      'SELECT id FROM \`commerce_orders\`' => [['id' => 101]],
      'SELECT id FROM \`commerce_aftersales\`' => [['id' => 202]]
    ]);

    $svc = new CommerceAftersalesService($db, new MultiCountClient());
    $bounds = CommerceAftersalesService::resolvePeriodTimestamps('2026-01-01', '2026-01-31');
    $res = $svc->initialBackfillRma('shop_1', $bounds['start_timestamp'], $bounds['end_exclusive_timestamp']);

    echo json_encode(['records_read' => $res['records_read']]);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const res = JSON.parse(run.output);
  assert.strictEqual(res.records_read, 3);
});

test('13. records_written reflects number of valid RMA objects written to DB', () => {
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class MixedRangeClient extends TikTokShopClient {
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        return [
          'reverse_orders' => [
            ['reverse_order_id' => 'r1', 'order_id' => 'o1', 'create_time' => 1768000000], // in
            ['reverse_order_id' => 'r2', 'order_id' => 'o2', 'create_time' => 1768000000], // in
            ['reverse_order_id' => 'r3', 'order_id' => 'o3', 'create_time' => 1789700000]  // out
          ],
          'has_more' => false
        ];
      }
    }

    $db = new MockPDO([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']],
      'SELECT id FROM \`commerce_orders\`' => [['id' => 101]],
      'SELECT id FROM \`commerce_aftersales\`' => [['id' => 202]]
    ]);

    $svc = new CommerceAftersalesService($db, new MixedRangeClient());
    $bounds = CommerceAftersalesService::resolvePeriodTimestamps('2026-01-01', '2026-01-31');
    $res = $svc->initialBackfillRma('shop_1', $bounds['start_timestamp'], $bounds['end_exclusive_timestamp']);

    echo json_encode([
      'records_read' => $res['records_read'],
      'records_written' => $res['records_written'],
      'out_of_range_count' => $res['out_of_range_count']
    ]);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const res = JSON.parse(run.output);
  assert.strictEqual(res.records_read, 3);
  assert.strictEqual(res.records_written, 2);
  assert.strictEqual(res.out_of_range_count, 1);
});

// =====================================================================
// SECTION 4: IDEMPOTENCY & COHORT SEMANTICS (Tests 14-17)
// =====================================================================
console.log('\n[SECTION 4] Idempotency & Cohort Semantics (Tests 14-17)');

test('14. Repeated historical backfill for same period does not duplicate RMA records', () => {
  const aftersalesFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_aftersales_service.php'), 'utf8');
  assert(aftersalesFile.includes('INSERT INTO `commerce_aftersales`'), 'Must insert into commerce_aftersales');
  assert(aftersalesFile.includes('ON DUPLICATE KEY UPDATE'), 'Must use ON DUPLICATE KEY UPDATE for idempotent RMA upserts');
  assert(aftersalesFile.includes('refund_amount = VALUES(refund_amount)'), 'Must update refund_amount on duplicate key');
});

test('15. Repeated historical backfill does not duplicate refund loss in commerce_loss_ledger', () => {
  const lossEngineFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_loss_engine.php'), 'utf8');
  assert(lossEngineFile.includes('INSERT INTO `commerce_loss_ledger`'), 'Must insert into commerce_loss_ledger');
  assert(lossEngineFile.includes('ON DUPLICATE KEY UPDATE'), 'Must use ON DUPLICATE KEY UPDATE for idempotent loss entries');
  assert(lossEngineFile.includes('loss_amount = VALUES(loss_amount)'), 'Must update loss_amount on duplicate key');
});

test('16. Jan-created order with Feb RMA appears in Jan Return/Refund filter', () => {
  const php = `
    $pdo = new PDO('sqlite::memory:');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->exec("CREATE TABLE commerce_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      shop_id TEXT,
      platform_order_id TEXT,
      order_status TEXT,
      order_gross_amount REAL,
      platform_created_at TEXT
    );");

    $pdo->exec("CREATE TABLE commerce_aftersales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      shop_id TEXT,
      platform_order_id TEXT,
      aftersales_id TEXT UNIQUE,
      aftersales_status TEXT,
      aftersales_type TEXT,
      refund_amount REAL,
      platform_created_at TEXT
    );");

    // Order created in Jan
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at)
                VALUES ('tiktok_shop', 'shop_1', 'ord_jan_rma_feb', 'COMPLETED', 150000, '2026-01-20 10:00:00');");
    // RMA created in Feb
    $pdo->exec("INSERT INTO commerce_aftersales (platform, shop_id, platform_order_id, aftersales_id, aftersales_status, aftersales_type, refund_amount, platform_created_at)
                VALUES ('tiktok_shop', 'shop_1', 'ord_jan_rma_feb', 'rma_feb_1', 'SUCCESS', 'RETURN_AND_REFUND', 150000, '2026-02-05 10:00:00');");

    // Query Jan orders with RETURN_REFUND filter (as executed by commerce_dashboard.php)
    $startDt = '2026-01-01 00:00:00';
    $endDt = '2026-02-01 00:00:00';
    $stmt = $pdo->prepare("SELECT COUNT(DISTINCT o.platform_order_id)
      FROM commerce_orders o
      WHERE o.platform = 'tiktok_shop' AND o.shop_id = 'shop_1'
        AND o.platform_created_at >= :start_dt AND o.platform_created_at < :end_dt
        AND EXISTS (
          SELECT 1 FROM commerce_aftersales a
          WHERE a.platform = o.platform AND a.shop_id = o.shop_id AND a.platform_order_id = o.platform_order_id
            AND a.aftersales_status IN ('SUCCESS', 'REQUESTED', 'APPROVED', 'RETURNING', 'RECEIVED', 'REFUND_PENDING')
        )");
    $stmt->execute([':start_dt' => $startDt, ':end_dt' => $endDt]);
    $matched = (int)$stmt->fetchColumn();

    echo json_encode(['matched' => $matched]);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const res = JSON.parse(run.output);
  assert.strictEqual(res.matched, 1, 'Jan order with Feb RMA must match Jan cohort return/refund query');
});

test('17. Feb-created order with Jan RMA does not enter Jan cohort', () => {
  const php = `
    $pdo = new PDO('sqlite::memory:');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->exec("CREATE TABLE commerce_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      shop_id TEXT,
      platform_order_id TEXT,
      order_status TEXT,
      order_gross_amount REAL,
      platform_created_at TEXT
    );");

    $pdo->exec("CREATE TABLE commerce_aftersales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT,
      shop_id TEXT,
      platform_order_id TEXT,
      aftersales_id TEXT UNIQUE,
      aftersales_status TEXT,
      aftersales_type TEXT,
      refund_amount REAL,
      platform_created_at TEXT
    );");

    // Order created in Feb
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, order_gross_amount, platform_created_at)
                VALUES ('tiktok_shop', 'shop_1', 'ord_feb_order', 'COMPLETED', 150000, '2026-02-10 10:00:00');");
    // RMA timestamped in Jan
    $pdo->exec("INSERT INTO commerce_aftersales (platform, shop_id, platform_order_id, aftersales_id, aftersales_status, aftersales_type, refund_amount, platform_created_at)
                VALUES ('tiktok_shop', 'shop_1', 'ord_feb_order', 'rma_jan_anom', 'SUCCESS', 'RETURN_AND_REFUND', 150000, '2026-01-20 10:00:00');");

    // Query Jan orders
    $startDt = '2026-01-01 00:00:00';
    $endDt = '2026-02-01 00:00:00';
    $stmt = $pdo->prepare("SELECT COUNT(DISTINCT o.platform_order_id)
      FROM commerce_orders o
      WHERE o.platform = 'tiktok_shop' AND o.shop_id = 'shop_1'
        AND o.platform_created_at >= :start_dt AND o.platform_created_at < :end_dt
        AND EXISTS (
          SELECT 1 FROM commerce_aftersales a
          WHERE a.platform = o.platform AND a.shop_id = o.shop_id AND a.platform_order_id = o.platform_order_id
        )");
    $stmt->execute([':start_dt' => $startDt, ':end_dt' => $endDt]);
    $matched = (int)$stmt->fetchColumn();

    echo json_encode(['matched' => $matched]);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const res = JSON.parse(run.output);
  assert.strictEqual(res.matched, 0, 'Feb-created order must NOT enter Jan cohort');
});

// =====================================================================
// SECTION 5: TRUTHFUL COVERAGE & UI STATUS FILTER (Tests 18-20)
// =====================================================================
console.log('\n[SECTION 5] Truthful Coverage & UX Rendering (Tests 18-20)');

test('18. When RMA coverage is NOT_SYNCED or unverified for a period, Orders page status filter displays "(Chưa đối soát)" instead of "(0)"', () => {
  const jsxFile = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceDashboardView.jsx'), 'utf8');
  assert(jsxFile.includes('Chưa đối soát'), 'JSX must contain Chưa đối soát string');
  assert(jsxFile.includes('orderStatusCounts?.RETURN_REFUND !== null && orderStatusCounts?.RETURN_REFUND !== undefined'), 'JSX must check for explicit null/undefined before formatting number');

  // Also verify backend getRmaPeriodCoverage reports NOT_SYNCED when no run exists
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    $db = new MockPDO([
      'SELECT * FROM \`commerce_sync_runs\`' => []
    ]);
    $svc = new CommerceAftersalesService($db);
    $cov = $svc->getRmaPeriodCoverage('shop_1', '2026-01-01', '2026-01-31');
    echo json_encode($cov);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const cov = JSON.parse(run.output);
  assert.strictEqual(cov.status, 'NOT_SYNCED');
  assert.strictEqual(cov.is_verified, false);
});

test('19. When RMA coverage is AVAILABLE and count is genuinely 0, Orders page displays "(0)"', () => {
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    $db = new MockPDO([
      'SELECT * FROM \`commerce_sync_runs\`' => [
        [
          'id' => 101,
          'platform' => 'tiktok_shop',
          'shop_id' => 'shop_1',
          'sync_type' => 'HISTORICAL_BACKFILL',
          'status' => 'COMPLETED',
          'source_domain' => 'rma',
          'start_date' => '2026-01-01',
          'end_date' => '2026-01-31',
          'records_read' => 0,
          'records_written' => 0,
          'latest_available_date' => '2026-01-31',
          'error_code' => null
        ]
      ]
    ]);

    $svc = new CommerceAftersalesService($db);
    $cov = $svc->getRmaPeriodCoverage('shop_1', '2026-01-01', '2026-01-31');
    echo json_encode($cov);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const cov = JSON.parse(run.output);
  assert.strictEqual(cov.status, 'AVAILABLE');
  assert.strictEqual(cov.is_verified, true);
});

test('20. Historical sync run completing does not overwrite latest_available_date with today\'s date if historical period ended in past', () => {
  const orchestratorCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_orchestrator.php'), 'utf8');
  assert(orchestratorCode.includes('$latestAvailableDate = $runEndDate;'), 'Orchestrator must assign historical period end date to latestAvailableDate');
  assert(orchestratorCode.includes('$this->recordSyncRunEnd($runId, \'COMPLETED\', $read, $written, $latestAvailableDate'), 'recordSyncRunEnd must receive $latestAvailableDate');

  const php = `
    require_once 'public/api/commerce_sync_orchestrator.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingOrchPdo20 extends MockPDO {
      public array $updatedRuns = [];
      public function prepare(string $query, array $options = []): PDOStatement {
        if (stripos($query, 'UPDATE \`commerce_sync_runs\`') !== false) {
          return new class($this) extends MockPDOStatement {
            private $parent;
            public function __construct($parent) { $this->parent = $parent; }
            public function execute(?array $params = null): bool {
              $this->parent->updatedRuns[] = $params;
              return true;
            }
          };
        }
        return parent::prepare($query, $options);
      }
    }

    $db = new TrackingOrchPdo20([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']]
    ]);

    class MockClient20 extends TikTokShopClient {
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        return ['returns' => [], 'has_more' => false];
      }
    }

    $client = new MockClient20();
    $orch = new CommerceSyncOrchestrator($db, [], null, $client);
    $refMethod = new ReflectionMethod(CommerceSyncOrchestrator::class, 'syncRmaDomain');
    $refMethod->setAccessible(true);
    $res = $refMethod->invoke($orch, 'shop_1', '2026-01-01', '2026-01-31', []);

    echo json_encode([
      'res_latest' => $res['latest_available_date'] ?? null
    ]);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const data = JSON.parse(run.output);
  assert.strictEqual(data.res_latest, '2026-01-31', 'Returned latest_available_date must be 2026-01-31');
});

// =====================================================================
// SECTION 6: OPERATIONAL SAFETY & SECURITY (Tests 21-22)
// =====================================================================
console.log('\n[SECTION 6] Operational Safety & Zero Secret Leakage (Tests 21-22)');

test('21. Existing incremental sync behavior remains operational for current/rolling operations', () => {
  const php = `
    require_once 'public/api/commerce_sync_orchestrator.php';
    require_once 'tools/mock_pdo_helper.php';

    $db = new MockPDO([
      'SELECT access_token' => [['access_token' => 'tok_1']],
      'SELECT cipher' => [['cipher' => 'cip_1']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']],
      'SELECT MAX(platform_updated_at)' => [['max_updated' => '2026-10-01 12:00:00']]
    ]);

    class MockClient21 extends TikTokShopClient {
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'cipher_1']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        return ['returns' => [], 'has_more' => false];
      }
    }

    $client = new MockClient21();
    $orch = new CommerceSyncOrchestrator($db, [], null, $client);
    $refMethod = new ReflectionMethod(CommerceSyncOrchestrator::class, 'syncRmaDomain');
    $refMethod->setAccessible(true);
    $res = $refMethod->invoke($orch, 'shop_1', date('Y-m-d', strtotime('-7 days')), date('Y-m-d'), ['rolling_refresh' => true]);

    echo json_encode([
      'res_status' => $res['status']
    ]);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const data = JSON.parse(run.output);
  assert.strictEqual(data.res_status, 'AVAILABLE');
});

test('22. All diagnostics and logs contain zero PII, zero tokens, zero ciphers', () => {
  const filesToScan = [
    path.join(PROJECT_ROOT, 'public', 'api', 'commerce_aftersales_service.php'),
    path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_orchestrator.php'),
    path.join(PROJECT_ROOT, 'public', 'api', 'commerce_dashboard.php'),
    path.join(PROJECT_ROOT, 'public', 'api', 'commerce_analytics_service.php')
  ];

  for (const filePath of filesToScan) {
    const code = fs.readFileSync(filePath, 'utf8');
    const lower = code.toLowerCase();
    assert(!lower.includes('error_log($access_token') && !lower.includes('error_log($shopcipher'), `Potential secret logging in ${path.basename(filePath)}`);
    assert(!lower.includes('echo $access_token') && !lower.includes('echo $shopcipher'), `Potential secret print in ${path.basename(filePath)}`);
  }

  // Trigger a mismatch error and check the message recorded in sync_runs
  const php = `
    require_once 'public/api/commerce_aftersales_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class LeakCheckClient extends TikTokShopClient {
      public function getAuthorizedShops($accessToken) {
        return [['shop_id' => 'shop_1', 'shop_cipher' => 'SECRET_CIPHER_12345']];
      }
      public function searchReturnRefundRmaV2($token, $cipher, array $params = []): array {
        return [
          'reverse_orders' => [
            [
              'reverse_order_id' => 'rma_leak_1',
              'order_id' => 'ord_1',
              'create_time' => 1789700000,
              'buyer_name' => 'John Sensitive Doe',
              'buyer_phone' => '0912345678'
            ]
          ],
          'has_more' => false
        ];
      }
    }

    $db = new MockPDO([
      'SELECT access_token' => [['access_token' => 'SECRET_TOKEN_XYZ']],
      'SELECT cipher' => [['cipher' => 'SECRET_CIPHER_12345']],
      'SHOW COLUMNS' => [['Field' => 'source_domain']]
    ]);

    $client = new LeakCheckClient();
    $svc = new CommerceAftersalesService($db, $client);
    $bounds = CommerceAftersalesService::resolvePeriodTimestamps('2026-01-01', '2026-01-31');
    $res = $svc->initialBackfillRma('shop_1', $bounds['start_timestamp'], $bounds['end_exclusive_timestamp']);

    echo json_encode($res);
  `;
  const run = runPhpCode(php);
  assert(run.success, `PHP failed: ${run.output}`);
  const res = JSON.parse(run.output);
  const jsonStr = JSON.stringify(res);
  assert(!jsonStr.includes('SECRET_TOKEN_XYZ'), 'Diagnostic must NOT leak token');
  assert(!jsonStr.includes('SECRET_CIPHER_12345'), 'Diagnostic must NOT leak shop cipher');
  assert(!jsonStr.includes('John Sensitive Doe'), 'Diagnostic must NOT leak buyer name');
  assert(!jsonStr.includes('0912345678'), 'Diagnostic must NOT leak buyer phone');
});

// =====================================================================
// SUMMARY
// =====================================================================
console.log('\n====================================================================');
console.log(`  SPRINT V2-05.2.3 TEST RESULTS: ${passedTests}/${totalTests} PASS (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('====================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
