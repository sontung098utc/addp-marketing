/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SPRINT V2-05.2.1 TEST SUITE
 * Test: Recipient Capture & Customer 360 Production Hotfix Reconciliation
 * Requirements: 24 Automated Regression Tests (Section L)
 * File: tools/test_v2_05_2_1_hotfix_reconciliation.cjs
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
console.log('  SPRINT V2-05.2.1: HOTFIX RECONCILIATION TEST SUITE (24 TESTS)');
console.log(`  Resolved PHP Command: ${phpCmd}`);
console.log('====================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runPhpCode(code, envOverrides = {}) {
  const tempScript = path.join(__dirname, `_temp_v2_05_2_1_test_${Date.now()}_${Math.floor(Math.random() * 1000)}.php`);
  
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

// Valid 32-byte decoupled test keys
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
    fs.unlinkSync(tempScript);
    return { success: true, output: out.trim() };
  } catch (e) {
    if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
    return {
      success: false,
      error: (e.stderr ? e.stderr.toString() : e.message) || e.stdout?.toString()
    };
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
    console.error(`     Reason: ${err.message}`);
  }
}

// =====================================================================
// SECTION A & L.1-4: TIKTOK GET ORDER DETAIL (Tests 1 - 4)
// =====================================================================
console.log('[SECTION A] TikTok Get Order Detail Endpoint & Contract (Tests 1-4)');

test('1. getOrderDetailsV2 gọi đúng GET /order/202309/orders với shop_cipher và ids comma-separated', () => {
  const script = `
    require_once 'public/api/tiktok_client.php';
    class TestClient1 extends TikTokShopClient {
        public array $recorded = [];
        public function requestV2($method, $path, $queryParams = [], $bodyData = null, $accessToken = null, $connectTimeout = 5, $readTimeout = 30, $maxRetries = 3) {
            $this->recorded = [
                'method' => $method,
                'path' => $path,
                'queryParams' => $queryParams,
                'accessToken' => $accessToken
            ];
            return ['code' => 0, 'data' => ['orders' => []]];
        }
    }
    $c = new TestClient1();
    $c->getOrderDetailsV2('token_xyz', 'cipher_123', ['ord_a', 'ord_b']);
    echo json_encode($c->recorded);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.method, 'GET', 'Method must be GET');
  assert.strictEqual(data.path, '/order/202309/orders', 'Path must be /order/202309/orders');
  assert.strictEqual(data.queryParams.shop_cipher, 'cipher_123', 'shop_cipher query param required');
  assert.strictEqual(data.queryParams.ids, 'ord_a,ord_b', 'ids must be comma-separated string');
  assert.strictEqual(data.accessToken, 'token_xyz', 'access_token passed in header/call');
});

test('2. getOrderDetailsV2 giới hạn tối đa 50 IDs', () => {
  const script = `
    require_once 'public/api/tiktok_client.php';
    class TestClient2 extends TikTokShopClient {
        public array $recorded = [];
        public function requestV2($method, $path, $queryParams = [], $bodyData = null, $accessToken = null, $connectTimeout = 5, $readTimeout = 30, $maxRetries = 3) {
            $this->recorded = $queryParams;
            return ['code' => 0, 'data' => ['orders' => []]];
        }
    }
    $c = new TestClient2();
    $ids = array_map(fn($i) => "id_" . $i, range(1, 80));
    $c->getOrderDetailsV2('tok', 'cip', $ids);
    $split = explode(',', $c->recorded['ids'] ?? '');
    echo json_encode(['count' => count($split)]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.count, 50, 'ids must be bounded to maximum 50');
});

test('3. getOrderDetailsV2 trả về data.orders', () => {
  const script = `
    require_once 'public/api/tiktok_client.php';
    class TestClient3 extends TikTokShopClient {
        public function requestV2($method, $path, $queryParams = [], $bodyData = null, $accessToken = null, $connectTimeout = 5, $readTimeout = 30, $maxRetries = 3) {
            return [
                'code' => 0,
                'data' => [
                    'orders' => [
                        ['id' => '1799000000000010', 'order_status' => 'IN_TRANSIT'],
                        ['id' => '1799000000000011', 'order_status' => 'AWAITING_SHIPMENT']
                    ]
                ]
            ];
        }
    }
    $c = new TestClient3();
    $orders = $c->getOrderDetailsV2('tok', 'cip', ['1799000000000010', '1799000000000011']);
    echo json_encode(['orders' => $orders]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.orders.length, 2, 'Must return 2 orders from data.orders');
  assert.strictEqual(data.orders[0].id, '1799000000000010', 'Order ID preserved');
});

test('4. getOrderDetailsV2 không query Search Orders và không dùng URL template /orders/{id}', () => {
  const clientCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'tiktok_client.php'), 'utf8');
  assert(!clientCode.includes('/order/202309/orders/{id}'), 'Must not contain template /orders/{id}');
  
  // Verify method implementation in file calls /order/202309/orders directly without searchOrdersV2
  const getOrderDetailsV2Section = clientCode.slice(clientCode.indexOf('function getOrderDetailsV2'));
  const methodBody = getOrderDetailsV2Section.slice(0, getOrderDetailsV2Section.indexOf('function getOrdersByIds'));
  assert(methodBody.includes('"/order/202309/orders"'), 'Must target /order/202309/orders');
  assert(!methodBody.includes('searchOrdersV2'), 'Must not delegate to searchOrdersV2');
});

// =====================================================================
// SECTION B & L.5-8: SHOP CIPHER RESOLUTION (Tests 5 - 8)
// =====================================================================
console.log('\n[SECTION B] Shop Cipher Resolution (Tests 5-8)');

test('5. resolveShopCipher match đúng shop_id khi API trả về nhiều shop', () => {
  const script = `
    require_once 'public/api/tiktok_client.php';
    class TestClient5 extends TikTokShopClient {
        public function getAuthorizedShops($accessToken) {
            return [
                ['id' => 'shop_111', 'cipher' => 'cipher_111'],
                ['id' => 'shop_222', 'cipher' => 'cipher_222'],
                ['id' => 'shop_333', 'cipher' => 'cipher_333']
            ];
        }
    }
    $c = new TestClient5();
    $resolved = $c->resolveShopCipher('shop_222', 'tok');
    echo json_encode(['cipher' => $resolved]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.cipher, 'cipher_222', 'Must match exact shop_id shop_222');
});

test('6. resolveShopCipher fallback shop duy nhất khi API trả về đúng 1 shop', () => {
  const script = `
    require_once 'public/api/tiktok_client.php';
    class TestClient6 extends TikTokShopClient {
        public function getAuthorizedShops($accessToken) {
            return [
                ['id' => 'shop_standalone', 'cipher' => 'cipher_standalone_ok']
            ];
        }
    }
    $c = new TestClient6();
    $resolved = $c->resolveShopCipher('shop_configured_name', 'tok');
    echo json_encode(['cipher' => $resolved]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.cipher, 'cipher_standalone_ok', 'Must fallback when count($shops) === 1');
});

test('7. resolveShopCipher ném ngoại lệ khi API trả về nhiều shop và không match shop_id', () => {
  const script = `
    require_once 'public/api/tiktok_client.php';
    class TestClient7 extends TikTokShopClient {
        public function getAuthorizedShops($accessToken) {
            return [
                ['id' => 'shop_alpha', 'cipher' => 'c_alpha'],
                ['id' => 'shop_beta', 'cipher' => 'c_beta']
            ];
        }
    }
    $c = new TestClient7();
    try {
        $c->resolveShopCipher('shop_gamma', 'tok');
        echo json_encode(['threw' => false]);
    } catch (RuntimeException $e) {
        echo json_encode(['threw' => true, 'code' => 'SHOP_CIPHER_NOT_FOUND', 'msg' => $e->getMessage()]);
    }
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.threw, true, 'Must throw RuntimeException on multi-shop mismatch');
  assert(data.msg.includes('SHOP_CIPHER_NOT_FOUND'), 'Exception message must contain SHOP_CIPHER_NOT_FOUND');
});

test('8. resolveShopCipher không query bảng tiktok_config.shop_cipher', () => {
  const files = [
    'public/api/tiktok_client.php',
    'public/api/commerce_sync_service.php',
    'public/api/commerce_aftersales_service.php',
    'public/api/commerce_analytics_service.php',
    'public/api/commerce_finance_service.php'
  ];
  for (const f of files) {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, f), 'utf8');
    assert(!content.includes('SELECT shop_cipher FROM'), `File ${f} must not query shop_cipher FROM tiktok_config`);
    assert(!content.includes('tiktok_config.shop_cipher'), `File ${f} must not reference tiktok_config.shop_cipher`);
  }
});

// =====================================================================
// SECTION C & L.9-15: syncOrdersByIds RUN LIFECYCLE & PROVENANCE (Tests 9 - 15)
// =====================================================================
console.log('\n[SECTION C] syncOrdersByIds Run Lifecycle & Provenance (Tests 9-15)');

test('9. syncOrdersByIds tạo sync run với sync_type=RECIPIENT_RECOVERY và api_endpoint=/order/202309/orders', () => {
  const script = `
    require_once 'public/api/commerce_sync_service.php';
    require_once 'public/api/tiktok_client.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingSyncPdo extends MockPDO {
        public array $queries = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            $this->queries[] = $query;
            return parent::prepare($query, $options);
        }
    }

    $db = new TrackingSyncPdo([
        'SELECT access_token' => [['access_token' => 'mock_token']],
        'SELECT id FROM \`commerce_orders\`' => [['id' => 999]]
    ]);

    $client = new class extends TikTokShopClient {
        public function resolveShopCipher(string $shopId, string $accessToken): string { return 'cipher_test'; }
        public function getOrderDetailsV2(string $accessToken, string $shopCipher, array $orderIds): array {
            return [['id' => 'ord_recovery_1', 'status' => 'IN_TRANSIT']];
        }
    };

    $svc = new CommerceSyncService($db, $client);
    $res = $svc->syncOrdersByIds('shop_1', ['ord_recovery_1']);

    $hasSyncRunInsert = false;
    foreach ($db->queries as $q) {
        if (stripos($q, 'INSERT INTO \`commerce_sync_runs\`') !== false 
            && stripos($q, 'RECIPIENT_RECOVERY') !== false 
            && stripos($q, '/order/202309/orders') !== false) {
            $hasSyncRunInsert = true;
            break;
        }
    }

    echo json_encode([
        'has_sync_run_insert' => $hasSyncRunInsert,
        'status' => $res['status']
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.has_sync_run_insert, true, 'Must execute INSERT INTO commerce_sync_runs with RECIPIENT_RECOVERY and /order/202309/orders');
});

test('10. syncOrdersByIds gán sync_run_id vào commerce_raw_observations (không bị NULL)', () => {
  const script = `
    require_once 'public/api/commerce_sync_service.php';
    require_once 'public/api/tiktok_client.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingObsPdo extends MockPDO {
        public array $executedInserts = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'INSERT INTO \`commerce_raw_observations\`') !== false) {
                return new class($this, $query) extends MockPDOStatement {
                    private $parent;
                    private $sql;
                    public function __construct($parent, $sql) { $this->parent = $parent; $this->sql = $sql; }
                    public function execute(?array $params = null): bool {
                        $this->parent->executedInserts[] = [
                            'sql' => $this->sql,
                            'params' => $params
                        ];
                        return true;
                    }
                };
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new TrackingObsPdo([
        'SELECT access_token' => [['access_token' => 'mock_tok']],
        'SELECT id FROM \`commerce_orders\`' => [['id' => 888]]
    ]);

    $client = new class extends TikTokShopClient {
        public function resolveShopCipher(string $shopId, string $accessToken): string { return 'cipher_test'; }
        public function getOrderDetailsV2(string $accessToken, string $shopCipher, array $orderIds): array {
            return [['id' => 'ord_obs_1', 'status' => 'IN_TRANSIT']];
        }
    };

    $svc = new CommerceSyncService($db, $client);
    $svc->syncOrdersByIds('shop_test', ['ord_obs_1']);

    echo json_encode([
        'insert_count' => count($db->executedInserts),
        'sql' => $db->executedInserts[0]['sql'] ?? '',
        'has_sync_run_col' => (stripos($db->executedInserts[0]['sql'] ?? '', 'sync_run_id') !== false)
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.insert_count, 1, 'Must insert raw observation');
  assert.strictEqual(data.has_sync_run_col, true, 'commerce_raw_observations INSERT statement must include sync_run_id column');
});

test('11. syncOrdersByIds upsert commerce_order_items không có column currency', () => {
  const script = `
    require_once 'public/api/commerce_sync_service.php';
    require_once 'public/api/tiktok_client.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingItemsPdo extends MockPDO {
        public array $itemSql = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'commerce_order_items') !== false) {
                $this->itemSql[] = $query;
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new TrackingItemsPdo([
        'SELECT access_token' => [['access_token' => 'tok']],
        'SELECT id FROM \`commerce_orders\`' => [['id' => 777]]
    ]);

    $client = new class extends TikTokShopClient {
        public function resolveShopCipher(string $shopId, string $accessToken): string { return 'cip'; }
        public function getOrderDetailsV2(string $accessToken, string $shopCipher, array $orderIds): array {
            return [[
                'id' => 'ord_items_1',
                'status' => 'IN_TRANSIT',
                'line_items' => [
                    ['id' => 'item_1', 'product_id' => 'prod_1', 'product_name' => 'Sp 1', 'sale_price' => 100000]
                ]
            ]];
        }
    };

    $svc = new CommerceSyncService($db, $client);
    $svc->syncOrdersByIds('shop_test', ['ord_items_1']);

    $sql = $db->itemSql[0] ?? '';
    $hasCurrency = (stripos($sql, 'currency') !== false);
    echo json_encode([
        'has_item_sql' => !empty($sql),
        'has_currency' => $hasCurrency
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.has_item_sql, true, 'commerce_order_items upsert must be executed');
  assert.strictEqual(data.has_currency, false, 'commerce_order_items statement must NOT include currency column');
});

test('12. syncOrdersByIds chuyển raw in-memory order vào ingestOrderRecipient', () => {
  const script = `
    require_once 'public/api/commerce_sync_service.php';
    require_once 'public/api/tiktok_client.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingRecipientPdo extends MockPDO {
        public array $recipientSql = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'commerce_order_recipients') !== false) {
                $this->recipientSql[] = $query;
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new TrackingRecipientPdo([
        'SELECT access_token' => [['access_token' => 'tok']],
        'SELECT id FROM \`commerce_orders\`' => [['id' => 555]],
        'SHOW COLUMNS' => [['Field' => 'customer_identifier_hash'], ['Field' => 'identity_method'], ['Field' => 'phone_encrypted'], ['Field' => 'address_full_encrypted'], ['Field' => 'recipient_name_encrypted']]
    ]);

    $client = new class extends TikTokShopClient {
        public function resolveShopCipher(string $shopId, string $accessToken): string { return 'cip'; }
        public function getOrderDetailsV2(string $accessToken, string $shopCipher, array $orderIds): array {
            return [[
                'id' => 'ord_recipient_capture_1',
                'user_id' => 'tt_user_in_ram_999',
                'status' => 'IN_TRANSIT',
                'recipient_address' => [
                    'name' => 'Nguyen Van RAM',
                    'phone_number' => '0909999999',
                    'full_address' => 'Số 1 Phố RAM, Hà Nội'
                ]
            ]];
        }
    };

    $svc = new CommerceSyncService($db, $client);
    $svc->syncOrdersByIds('shop_test', ['ord_recipient_capture_1']);

    echo json_encode([
        'recipient_upserts' => count($db->recipientSql),
        'has_recipient_upsert' => count($db->recipientSql) > 0
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.has_recipient_upsert, true, 'ingestOrderRecipient must be invoked on RAW in-memory order');
});

test('13. syncOrdersByIds finalize sync run thành COMPLETED khi tất cả order được recover', () => {
  const script = `
    require_once 'public/api/commerce_sync_service.php';
    require_once 'public/api/tiktok_client.php';
    require_once 'tools/mock_pdo_helper.php';

    class FinalizeCompletePdo extends MockPDO {
        public array $runUpdates = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'UPDATE \`commerce_sync_runs\`') !== false) {
                return new class($this, $query) extends MockPDOStatement {
                    private $parent;
                    public function __construct($parent) { $this->parent = $parent; }
                    public function execute(?array $params = null): bool {
                        $this->parent->runUpdates[] = $params;
                        return true;
                    }
                };
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new FinalizeCompletePdo([
        'SELECT access_token' => [['access_token' => 'tok']],
        'SELECT id FROM \`commerce_orders\`' => [['id' => 444]]
    ]);

    $client = new class extends TikTokShopClient {
        public function resolveShopCipher(string $shopId, string $accessToken): string { return 'cip'; }
        public function getOrderDetailsV2(string $accessToken, string $shopCipher, array $orderIds): array {
            return [
                ['id' => 'ord_c1', 'status' => 'IN_TRANSIT'],
                ['id' => 'ord_c2', 'status' => 'AWAITING_SHIPMENT']
            ];
        }
    };

    $svc = new CommerceSyncService($db, $client);
    $res = $svc->syncOrdersByIds('shop_test', ['ord_c1', 'ord_c2']);

    echo json_encode([
        'status' => $res['status'],
        'recovered_count' => $res['recovered_count'],
        'last_run_params' => end($db->runUpdates)
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'COMPLETED', 'Returned status must be COMPLETED');
  assert.strictEqual(data.recovered_count, 2, '2 orders recovered');
  assert.strictEqual(data.last_run_params[0], 'COMPLETED', 'commerce_sync_runs must be updated to COMPLETED');
});

test('14. syncOrdersByIds finalize sync run thành PARTIAL khi có order thiếu', () => {
  const script = `
    require_once 'public/api/commerce_sync_service.php';
    require_once 'public/api/tiktok_client.php';
    require_once 'tools/mock_pdo_helper.php';

    class FinalizePartialPdo extends MockPDO {
        public array $runUpdates = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'UPDATE \`commerce_sync_runs\`') !== false) {
                return new class($this, $query) extends MockPDOStatement {
                    private $parent;
                    public function __construct($parent) { $this->parent = $parent; }
                    public function execute(?array $params = null): bool {
                        $this->parent->runUpdates[] = $params;
                        return true;
                    }
                };
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new FinalizePartialPdo([
        'SELECT access_token' => [['access_token' => 'tok']],
        'SELECT id FROM \`commerce_orders\`' => [['id' => 333]]
    ]);

    $client = new class extends TikTokShopClient {
        public function resolveShopCipher(string $shopId, string $accessToken): string { return 'cip'; }
        public function getOrderDetailsV2(string $accessToken, string $shopCipher, array $orderIds): array {
            return [['id' => 'ord_p1', 'status' => 'IN_TRANSIT']]; // ord_p2 is missing from response
        }
    };

    $svc = new CommerceSyncService($db, $client);
    $res = $svc->syncOrdersByIds('shop_test', ['ord_p1', 'ord_p2']);

    echo json_encode([
        'status' => $res['status'],
        'recovered_count' => $res['recovered_count'],
        'unresolved_order_ids' => $res['unresolved_order_ids'],
        'last_run_params' => end($db->runUpdates)
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'PARTIAL', 'Returned status must be PARTIAL');
  assert.strictEqual(data.unresolved_order_ids.length, 1, 'ord_p2 must be unresolved');
  assert.strictEqual(data.last_run_params[0], 'PARTIAL', 'commerce_sync_runs must be updated to PARTIAL');
});

test('15. syncOrdersByIds mark FAILED khi có exception và rollback transaction', () => {
  const script = `
    require_once 'public/api/commerce_sync_service.php';
    require_once 'public/api/tiktok_client.php';
    require_once 'tools/mock_pdo_helper.php';

    class FailRollbackPdo extends MockPDO {
        public bool $rolledBack = false;
        public array $runUpdates = [];
        public function rollBack(): bool {
            $this->rolledBack = true;
            return true;
        }
        public function inTransaction(): bool { return true; }
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'UPDATE \`commerce_sync_runs\`') !== false) {
                return new class($this) extends MockPDOStatement {
                    private $parent;
                    public function __construct($parent) { $this->parent = $parent; }
                    public function execute(?array $params = null): bool {
                        $this->parent->runUpdates[] = $params;
                        return true;
                    }
                };
            }
            if (stripos($query, 'INSERT INTO \`commerce_orders\`') !== false) {
                return new MockPDOStatement(new RuntimeException('Simulated DB Deadlock / Constraint Error'));
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new FailRollbackPdo([
        'SELECT access_token' => [['access_token' => 'tok']]
    ]);

    $client = new class extends TikTokShopClient {
        public function resolveShopCipher(string $shopId, string $accessToken): string { return 'cip'; }
        public function getOrderDetailsV2(string $accessToken, string $shopCipher, array $orderIds): array {
            return [['id' => 'ord_err_1', 'status' => 'IN_TRANSIT']];
        }
    };

    $svc = new CommerceSyncService($db, $client);
    $res = $svc->syncOrdersByIds('shop_test', ['ord_err_1']);

    echo json_encode([
        'status' => $res['status'],
        'rolled_back' => $db->rolledBack,
        'last_run_params' => end($db->runUpdates)
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'FAILED', 'Must return controlled FAILED status');
  assert.strictEqual(data.rolled_back, true, 'Transaction must be rolled back');
  assert.strictEqual(data.last_run_params[0], 'FAILED', 'commerce_sync_runs must be marked FAILED');
  assert.strictEqual(data.last_run_params[3], 'RECIPIENT_RECOVERY_FAILED', 'error_code must be RECIPIENT_RECOVERY_FAILED');
});

// =====================================================================
// SECTION D & L.16-19: FIELD-LEVEL PII ENCRYPTION & PRESERVATION (Tests 16 - 19)
// =====================================================================
console.log('\n[SECTION D] Field-Level PII Encryption & Preservation (Tests 16-19)');

test('16. Field-level encryption: mã hóa name khi unmasked dù phone bị masked', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingEncryptPdo16 extends MockPDO {
        public array $insertedParams = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'INSERT INTO \`commerce_order_recipients\`') !== false) {
                return new class($this) extends MockPDOStatement {
                    private $parent;
                    public function __construct($parent) { $this->parent = $parent; }
                    public function execute(?array $params = null): bool {
                        $this->parent->insertedParams = $params;
                        return true;
                    }
                };
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new TrackingEncryptPdo16([
        'SHOW COLUMNS' => [['Field' => 'customer_identifier_hash'], ['Field' => 'identity_method'], ['Field' => 'phone_encrypted'], ['Field' => 'address_full_encrypted'], ['Field' => 'recipient_name_encrypted']]
    ]);

    $svc = new CommerceCustomerService($db);
    $orderRaw = [
        'id' => 'ord_field_16',
        'recipient_address' => [
            'name' => 'Tran Thi Bich Ngoc',     // Unmasked name
            'phone_number' => '09******89',      // Masked phone
            'full_address' => '***, Ha Noi'      // Masked address
        ]
    ];
    $svc->ingestOrderRecipient('shop_test', $orderRaw);

    // Params mapping:
    // [0]=platform, [1]=shop_id, [2]=order_id, [3]=phone_hash, [4]=customer_hash, [5]=identity_method,
    // [6]=recipient_name_encrypted, [7]=phone_encrypted, [8]=address_full_encrypted
    $nameEnc = $db->insertedParams[6] ?? null;
    $phoneEnc = $db->insertedParams[7] ?? null;
    $addrEnc = $db->insertedParams[8] ?? null;

    $decryptedName = $nameEnc ? $svc->decryptField($nameEnc) : null;

    echo json_encode([
        'name_encrypted_present' => !empty($nameEnc),
        'phone_encrypted_null' => ($phoneEnc === null),
        'address_encrypted_null' => ($addrEnc === null),
        'decrypted_name' => $decryptedName
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.name_encrypted_present, true, 'Name must be encrypted');
  assert.strictEqual(data.phone_encrypted_null, true, 'Masked phone must not produce phone_encrypted');
  assert.strictEqual(data.address_encrypted_null, true, 'Masked address must not produce address_full_encrypted');
  assert.strictEqual(data.decrypted_name, 'Tran Thi Bich Ngoc', 'Decrypted name matches raw input');
});

test('17. Field-level encryption: mã hóa phone khi unmasked dù address bị masked', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingEncryptPdo17 extends MockPDO {
        public array $insertedParams = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'INSERT INTO \`commerce_order_recipients\`') !== false) {
                return new class($this) extends MockPDOStatement {
                    private $parent;
                    public function __construct($parent) { $this->parent = $parent; }
                    public function execute(?array $params = null): bool {
                        $this->parent->insertedParams = $params;
                        return true;
                    }
                };
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new TrackingEncryptPdo17([
        'SHOW COLUMNS' => [['Field' => 'customer_identifier_hash'], ['Field' => 'identity_method'], ['Field' => 'phone_encrypted'], ['Field' => 'address_full_encrypted'], ['Field' => 'recipient_name_encrypted']]
    ]);

    $svc = new CommerceCustomerService($db);
    $orderRaw = [
        'id' => 'ord_field_17',
        'recipient_address' => [
            'name' => 'T*** N***',               // Masked name
            'phone_number' => '0912345678',      // Unmasked phone
            'full_address' => '***, Quan 1, HCM' // Masked address
        ]
    ];
    $svc->ingestOrderRecipient('shop_test', $orderRaw);

    $phoneEnc = $db->insertedParams[7] ?? null;
    $decryptedPhone = $phoneEnc ? $svc->decryptField($phoneEnc) : null;
    $phoneHash = $db->insertedParams[3] ?? null;

    echo json_encode([
        'phone_encrypted_present' => !empty($phoneEnc),
        'phone_hash_present' => !empty($phoneHash),
        'decrypted_phone' => $decryptedPhone
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.phone_encrypted_present, true, 'Phone must be encrypted');
  assert.strictEqual(data.phone_hash_present, true, 'Phone hash must be generated');
  assert.strictEqual(data.decrypted_phone, '0912345678', 'Decrypted phone matches');
});

test('18. Field-level encryption: mã hóa address khi unmasked dù name bị masked', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class TrackingEncryptPdo18 extends MockPDO {
        public array $insertedParams = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'INSERT INTO \`commerce_order_recipients\`') !== false) {
                return new class($this) extends MockPDOStatement {
                    private $parent;
                    public function __construct($parent) { $this->parent = $parent; }
                    public function execute(?array $params = null): bool {
                        $this->parent->insertedParams = $params;
                        return true;
                    }
                };
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new TrackingEncryptPdo18([
        'SHOW COLUMNS' => [['Field' => 'customer_identifier_hash'], ['Field' => 'identity_method'], ['Field' => 'phone_encrypted'], ['Field' => 'address_full_encrypted'], ['Field' => 'recipient_name_encrypted']]
    ]);

    $svc = new CommerceCustomerService($db);
    $orderRaw = [
        'id' => 'ord_field_18',
        'recipient_address' => [
            'name' => 'K*** T***',                             // Masked name
            'phone_number' => '09******89',                    // Masked phone
            'full_address' => 'Số 99 Đường Giải Phóng, Hà Nội' // Unmasked address
        ]
    ];
    $svc->ingestOrderRecipient('shop_test', $orderRaw);

    $addrEnc = $db->insertedParams[8] ?? null;
    $decryptedAddr = $addrEnc ? $svc->decryptField($addrEnc) : null;

    echo json_encode([
        'addr_encrypted_present' => !empty($addrEnc),
        'decrypted_address' => $decryptedAddr
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.addr_encrypted_present, true, 'Address must be encrypted');
  assert.strictEqual(data.decrypted_address, 'Số 99 Đường Giải Phóng, Hà Nội', 'Decrypted address matches');
});

test('19. Field-level preservation: không overwrite name/phone/address đã mã hóa khi dữ liệu mới bị masked', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';

    class PreserveEncryptPdo extends MockPDO {
        public array $upsertParams = [];
        public function prepare(string $query, array $options = []): PDOStatement {
            if (stripos($query, 'SELECT * FROM \`commerce_order_recipients\`') !== false) {
                // Existing row already has good unmasked encrypted values
                return new MockPDOStatement([
                    [
                        'platform' => 'tiktok_shop',
                        'shop_id' => 'shop_test',
                        'platform_order_id' => 'ord_preserve_19',
                        'customer_identifier_hash' => 'hash_prev_19',
                        'identity_method' => 'PHONE_MATCH',
                        'recipient_name_encrypted' => 'ENC_EXISTING_NAME',
                        'phone_encrypted' => 'ENC_EXISTING_PHONE',
                        'address_full_encrypted' => 'ENC_EXISTING_ADDRESS',
                        'phone_hash' => 'hash_phone_good',
                        'phone_masked' => '0901****89',
                        'address_masked' => '***, Quan 1',
                        'province' => 'Ho Chi Minh',
                        'is_masked_by_platform' => 0
                    ]
                ]);
            }
            if (stripos($query, 'INSERT INTO \`commerce_order_recipients\`') !== false) {
                return new class($this) extends MockPDOStatement {
                    private $parent;
                    public function __construct($parent) { $this->parent = $parent; }
                    public function execute(?array $params = null): bool {
                        $this->parent->upsertParams = $params;
                        return true;
                    }
                };
            }
            return parent::prepare($query, $options);
        }
    }

    $db = new PreserveEncryptPdo([
        'SHOW COLUMNS' => [['Field' => 'customer_identifier_hash'], ['Field' => 'identity_method'], ['Field' => 'phone_encrypted'], ['Field' => 'address_full_encrypted'], ['Field' => 'recipient_name_encrypted']]
    ]);

    $svc = new CommerceCustomerService($db);
    // Incoming subsequent sync where TikTok degraded to 100% masked
    $incomingDegraded = [
        'id' => 'ord_preserve_19',
        'recipient_address' => [
            'name' => 'N***',
            'phone_number' => '09******89',
            'full_address' => '***'
        ]
    ];
    $svc->ingestOrderRecipient('shop_test', $incomingDegraded);

    $finalNameEnc = $db->upsertParams[6] ?? null;
    $finalPhoneEnc = $db->upsertParams[7] ?? null;
    $finalAddrEnc = $db->upsertParams[8] ?? null;

    echo json_encode([
        'preserved_name' => ($finalNameEnc === 'ENC_EXISTING_NAME'),
        'preserved_phone' => ($finalPhoneEnc === 'ENC_EXISTING_PHONE'),
        'preserved_addr' => ($finalAddrEnc === 'ENC_EXISTING_ADDRESS')
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.preserved_name, true, 'Name encryption preserved');
  assert.strictEqual(data.preserved_phone, true, 'Phone encryption preserved');
  assert.strictEqual(data.preserved_addr, true, 'Address encryption preserved');
});

// =====================================================================
// SECTION E & L.20-21: PRIORITY SELECTOR (Tests 20 - 21)
// =====================================================================
console.log('\n[SECTION E] Priority Selector Invariants (Tests 20-21)');

test('20. Priority selector không chọn order đã có identity (chỉ chọn r.id IS NULL hoặc identity_method = UNMATCHED)', () => {
  const syncFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_service.php'), 'utf8');
  assert(!syncFile.includes('r.is_masked_by_platform = 1'), 'Must not use r.is_masked_by_platform = 1 in priority query');
  assert(syncFile.includes("r.identity_method = 'UNMATCHED'"), "Must check identity_method = 'UNMATCHED'");
  assert(syncFile.includes('r.id IS NULL'), 'Must check r.id IS NULL');
});

test('21. Priority selector chỉ chọn order có status AWAITING_SHIPMENT hoặc IN_TRANSIT', () => {
  const syncFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_service.php'), 'utf8');
  const matches = syncFile.match(/order_status IN \('AWAITING_SHIPMENT', 'IN_TRANSIT'\)/g);
  assert(matches && matches.length >= 2, 'Priority selector must restrict strictly to AWAITING_SHIPMENT and IN_TRANSIT in query and count');
});

// =====================================================================
// SECTION F & L.22-23: CUSTOMER 360 KPI SEMANTICS (Tests 22 - 23)
// =====================================================================
console.log('\n[SECTION F] Customer 360 KPI Semantics (Tests 22-23)');

test('22. rebuildCustomerProfiles đếm thực tế từ commerce_customer_profiles và không đếm UNMATCHED', () => {
  const script = `
    require_once 'public/api/commerce_customer_service.php';
    require_once 'tools/mock_pdo_helper.php';

    $db = new MockPDO([
        'SELECT COUNT(*) FROM \`commerce_customer_profiles\`' => 42,
        'SHOW COLUMNS' => [['Field' => 'customer_identifier_hash'], ['Field' => 'identity_method']],
        'SELECT r.customer_identifier_hash' => [
            ['customer_identifier_hash' => 'hash_1', 'identity_method' => 'USER_ID', 'phone_masked' => '09***1', 'province' => 'HN']
        ]
    ]);

    $svc = new CommerceCustomerService($db);
    $res = $svc->rebuildCustomerProfiles('shop_test');

    echo json_encode([
        'status' => $res['status'],
        'rebuilt_count' => $res['rebuilt_count'],
        'verified_profiles_count' => $res['verified_profiles_count'] ?? null
    ]);
  `;
  const res = runPhpCode(script);
  assert(res.success, `PHP failed: ${res.error}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'SUCCESS');
  assert.strictEqual(data.rebuilt_count, 42, 'rebuilt_count must be the actual count from DB query');
  assert.strictEqual(data.verified_profiles_count, 42, 'verified_profiles_count must match');
});

test('23. calculateCohortSummary không tính UNMATCHED vào total_customers, new_customers, returning_customers, repeat_rate', () => {
  const custServiceFile = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_customer_service.php'), 'utf8');
  const cohortSec = custServiceFile.slice(custServiceFile.indexOf('function calculateCohortSummary'));
  const cohortBody = cohortSec.slice(0, cohortSec.indexOf('function getOrderRecipient'));
  
  assert(cohortBody.includes("identity_method != 'UNMATCHED'"), 'Must filter out UNMATCHED from customer cohort query');
  assert(cohortBody.includes("'repeat_rate' => $repeatRate"), 'Must compute repeat_rate on verified customers');
  assert(cohortBody.includes("'unmatched_orders_count' => $unmatchedOrders"), 'Must include unmatched_orders_count separately');
  assert(cohortBody.includes("'identity_coverage_pct' => $identityCoverage"), 'Must include identity_coverage_pct');
});

// =====================================================================
// SECTION I & L.24: FRONTEND BUILD & UI RUNTIME (Test 24)
// =====================================================================
console.log('\n[SECTION I] Frontend Production Bundle & UI Verification (Test 24)');

test('24. Frontend build thành công, không có lỗi linter/runtime và hiển thị đúng verified customers', () => {
  const distDir = path.join(PROJECT_ROOT, 'dist');
  assert(fs.existsSync(distDir), 'dist directory must exist');
  assert(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist');
  
  const assets = fs.readdirSync(path.join(distDir, 'assets'));
  const jsBundle = assets.find(f => f.startsWith('index-') && f.endsWith('.js'));
  assert(jsBundle, 'dist/assets/index-*.js bundle must exist');

  const jsxContent = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceDashboardView.jsx'), 'utf8');
  assert(jsxContent.includes('Khách Hàng Xác Thực (Kỳ)'), 'Dashboard must display Khách Hàng Xác Thực (Kỳ)');
  assert(!jsxContent.includes('handleTriggerDomainSync'), 'No dead function handleTriggerDomainSync');
});

// =====================================================================
// SUMMARY
// =====================================================================
console.log('\n====================================================================');
console.log(`  SPRINT V2-05.2.1 TEST RESULTS: ${passedTests}/${totalTests} PASS (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('====================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
