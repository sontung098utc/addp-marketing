/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SPRINT V2-06.1 REGRESSION TEST SUITE
 * Test: Migration Safety & Aggregate Queue Integrity Hotfix
 * File: tools/test_v2_06_1_queue_and_migration_integrity.cjs
 * Requirements: 18 Comprehensive Regression Tests
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

  const extDir = path.join(path.dirname(chosenBin), 'ext');
  let extFlags = '';
  try {
    const modules = execSync(`"${chosenBin}" -m`, { encoding: 'utf8' });
    if (!modules.includes('openssl') && fs.existsSync(path.join(extDir, 'php_openssl.dll'))) {
      extFlags += ` -d extension_dir="${extDir}" -d extension=openssl`;
    }
    if (!modules.includes('pdo_sqlite') && fs.existsSync(path.join(extDir, 'php_pdo_sqlite.dll'))) {
      if (!extFlags.includes('extension_dir')) extFlags += ` -d extension_dir="${extDir}"`;
      extFlags += ` -d extension=pdo_sqlite`;
    }
  } catch (e) {}
  return `"${chosenBin}"${extFlags}`;
}

const phpCmd = resolvePhpCommand();
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('====================================================================');
console.log('  SPRINT V2-06.1: MIGRATION SAFETY & QUEUE INTEGRITY (18 TESTS)');
console.log(`  Resolved PHP Command: ${phpCmd}`);
console.log('====================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runPhpCode(code, envOverrides = {}) {
  const tempScript = path.join(__dirname, `_temp_v2_06_1_test_${Date.now()}_${Math.floor(Math.random() * 1000)}.php`);
  
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
    return { success: true, output: output.replace(/^Warning:[^\n]*\n?/gm, '').trim() };
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

// Complete SQLite schema bootstrap matching all normalized and aggregate tables
const SQLITE_SCHEMA_BOOTSTRAP = `
function createTestDb(): PDO {
    $pdo = new PDO('sqlite::memory:');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("
        CREATE TABLE commerce_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            platform_order_id TEXT NOT NULL,
            order_status TEXT NOT NULL,
            platform_status TEXT NOT NULL,
            platform_created_at TEXT,
            platform_updated_at TEXT,
            order_gross_amount REAL DEFAULT 0.00,
            total_amount REAL DEFAULT 0.00
        );
        CREATE UNIQUE INDEX uq_orders ON commerce_orders (platform, shop_id, platform_order_id);
        CREATE INDEX idx_orders_plat_shop_created ON commerce_orders (platform, shop_id, platform_created_at);

        CREATE TABLE commerce_loss_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            platform_order_id TEXT NOT NULL,
            platform_line_item_id TEXT,
            loss_type TEXT NOT NULL,
            loss_amount REAL DEFAULT 0.00,
            gross_reference_amount REAL DEFAULT 0.00,
            perspective TEXT NOT NULL,
            source_entity_id TEXT NOT NULL,
            effective_at TEXT
        );
        CREATE UNIQUE INDEX uq_loss ON commerce_loss_ledger (platform, shop_id, perspective, platform_order_id, loss_type, source_entity_id);

        CREATE TABLE commerce_aftersales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            aftersales_id TEXT NOT NULL,
            platform_order_id TEXT NOT NULL,
            aftersales_status TEXT NOT NULL,
            refund_amount REAL DEFAULT 0.00,
            sync_run_id INTEGER,
            request_created_at TEXT,
            refund_completed_at TEXT
        );

        CREATE TABLE commerce_ads_campaign_daily (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            stat_date TEXT NOT NULL,
            spend REAL DEFAULT 0.00,
            gross_revenue REAL DEFAULT 0.00,
            orders INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            impressions INTEGER DEFAULT 0
        );

        CREATE TABLE commerce_finance_statements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            statement_id TEXT NOT NULL,
            statement_time TEXT NOT NULL,
            total_settlement_amount REAL DEFAULT 0.00
        );

        CREATE TABLE commerce_finance_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            platform_order_id TEXT NOT NULL,
            platform_line_item_id TEXT,
            transaction_type TEXT NOT NULL,
            revenue_amount REAL DEFAULT 0.00,
            platform_commission REAL DEFAULT 0.00,
            affiliate_commission REAL DEFAULT 0.00,
            payment_fee REAL DEFAULT 0.00,
            shipping_fee_subsidy REAL DEFAULT 0.00,
            actual_shipping_fee REAL DEFAULT 0.00,
            adjustment_amount REAL DEFAULT 0.00,
            net_settlement_amount REAL DEFAULT 0.00,
            transaction_time TEXT NOT NULL
        );

        CREATE TABLE commerce_daily_aggregates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            metric_date TEXT NOT NULL,
            order_count INTEGER NOT NULL DEFAULT 0,
            order_gross_value REAL NOT NULL DEFAULT 0.00,
            cancelled_orders_count INTEGER NOT NULL DEFAULT 0,
            cancellation_loss_amount REAL NOT NULL DEFAULT 0.00,
            refund_orders_count INTEGER NOT NULL DEFAULT 0,
            refund_loss_amount REAL NOT NULL DEFAULT 0.00,
            failed_delivery_orders_count INTEGER NOT NULL DEFAULT 0,
            failed_delivery_loss_amount REAL NOT NULL DEFAULT 0.00,
            total_loss_value REAL NOT NULL DEFAULT 0.00,
            realized_order_value REAL NOT NULL DEFAULT 0.00,
            ads_spend REAL NOT NULL DEFAULT 0.00,
            ads_attributed_gross REAL NOT NULL DEFAULT 0.00,
            ads_orders INTEGER NOT NULL DEFAULT 0,
            ads_clicks INTEGER NOT NULL DEFAULT 0,
            ads_impressions INTEGER NOT NULL DEFAULT 0,
            statement_count INTEGER NOT NULL DEFAULT 0,
            total_settled_amount REAL NOT NULL DEFAULT 0.00,
            settled_orders_count INTEGER NOT NULL DEFAULT 0,
            platform_commission REAL NOT NULL DEFAULT 0.00,
            affiliate_commission REAL NOT NULL DEFAULT 0.00,
            payment_fee REAL NOT NULL DEFAULT 0.00,
            shipping_fee_subsidy REAL NOT NULL DEFAULT 0.00,
            actual_shipping_fee REAL NOT NULL DEFAULT 0.00,
            adjustment_amount REAL NOT NULL DEFAULT 0.00,
            orders_freshness_status TEXT NOT NULL DEFAULT 'NOT_SYNCED',
            rma_freshness_status TEXT NOT NULL DEFAULT 'NOT_SYNCED',
            ads_freshness_status TEXT NOT NULL DEFAULT 'NOT_SYNCED',
            finance_freshness_status TEXT NOT NULL DEFAULT 'NOT_SYNCED',
            calculation_version TEXT NOT NULL DEFAULT '2.0',
            status TEXT NOT NULL DEFAULT 'READY',
            calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX uq_plat_shop_metric_date ON commerce_daily_aggregates (platform, shop_id, metric_date);

        CREATE TABLE commerce_daily_aggregate_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            metric_date TEXT NOT NULL,
            reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            dirty_while_processing INTEGER DEFAULT 0,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 3,
            error_message TEXT,
            worker_id TEXT,
            rebuild_requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
            processing_started_at TEXT,
            last_processed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX uq_queue_plat_shop_metric_date ON commerce_daily_aggregate_queue (platform, shop_id, metric_date);

        CREATE TABLE commerce_sync_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            source_domain TEXT NOT NULL,
            sync_type TEXT NOT NULL,
            start_date TEXT,
            end_date TEXT,
            window_start_time TEXT,
            window_end_time TEXT,
            api_endpoint TEXT,
            records_synced INTEGER DEFAULT 0,
            error_code TEXT,
            error_message TEXT,
            status TEXT NOT NULL DEFAULT 'COMPLETED',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE commerce_sync_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'COMPLETED',
            sync_type TEXT NOT NULL DEFAULT 'MANUAL',
            domain TEXT NOT NULL DEFAULT 'all',
            records_ingested INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE commerce_shop_analytics_daily (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            stat_date TEXT NOT NULL,
            page_views INTEGER DEFAULT 0,
            unique_visitors INTEGER DEFAULT 0,
            total_orders INTEGER DEFAULT 0,
            gross_revenue REAL DEFAULT 0.00,
            conversion_rate REAL DEFAULT 0.0000
        );

        CREATE TABLE commerce_live_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            title TEXT,
            account_type TEXT DEFAULT 'OFFICIAL_ACCOUNTS',
            creator_id TEXT,
            creator_username TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT,
            duration_seconds INTEGER DEFAULT 0,
            gmv REAL DEFAULT 0.00,
            orders_count INTEGER DEFAULT 0,
            units_sold INTEGER DEFAULT 0,
            customer_count INTEGER DEFAULT 0,
            total_views INTEGER DEFAULT 0,
            impressions INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            peak_concurrent_users INTEGER DEFAULT 0,
            comments_count INTEGER DEFAULT 0,
            shares_count INTEGER DEFAULT 0,
            follows_count INTEGER DEFAULT 0
        );

        CREATE TABLE commerce_video_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            video_id TEXT NOT NULL,
            stat_date TEXT NOT NULL,
            title TEXT,
            duration_seconds INTEGER DEFAULT 0,
            video_post_time TEXT,
            creator_type TEXT DEFAULT 'OFFICIAL',
            creator_name TEXT,
            video_views INTEGER DEFAULT 0,
            units_sold INTEGER DEFAULT 0,
            gross_revenue REAL DEFAULT 0.00,
            attributed_gmv REAL DEFAULT 0.00,
            ctr REAL DEFAULT 0.0000,
            comments_count INTEGER DEFAULT 0,
            shares_count INTEGER DEFAULT 0,
            likes_count INTEGER DEFAULT 0,
            gpm REAL DEFAULT 0.00
        );

        CREATE TABLE commerce_product_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            sku_id TEXT,
            product_name TEXT,
            stat_date TEXT NOT NULL,
            units_sold INTEGER DEFAULT 0,
            gross_revenue REAL DEFAULT 0.00,
            page_views INTEGER DEFAULT 0,
            unique_visitors INTEGER DEFAULT 0,
            cvr REAL DEFAULT 0.0000
        );

        CREATE TABLE commerce_order_recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            platform_order_id TEXT NOT NULL,
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
            is_masked_by_platform INTEGER DEFAULT 0,
            synced_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE commerce_customer_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL DEFAULT 'tiktok_shop',
            shop_id TEXT NOT NULL,
            customer_identifier_hash TEXT NOT NULL,
            identity_method TEXT NOT NULL,
            customer_display_name TEXT,
            phone_masked TEXT,
            province TEXT,
            total_orders_count INTEGER DEFAULT 0,
            order_gross_amount REAL DEFAULT 0.00,
            first_order_date TEXT,
            last_order_date TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    ");
    return $pdo;
}
`;

// ====================================================================
// SECTION 1: Data Trust Defaults & Truthful Reporting (Tests 1-3)
// ====================================================================
console.log('[SECTION 1] Data Trust Defaults & Truthful Reporting (Tests 1-3)');

test('1. unverified Orders and RMA freshness default to NOT_SYNCED', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    $db = createTestDb();
    
    // Insert an order for 2026-09-10 without any commerce_sync_runs recorded
    $db->exec("INSERT INTO commerce_orders (shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount)
               VALUES ('shop1', 'ORD_001', 'COMPLETED', 'DELIVERED', '2026-09-10 12:00:00', 500000)");

    $aggService = new CommerceDailyAggregateService($db);
    $res = $aggService->rebuildDailyAggregate('shop1', '2026-09-10');
    
    // Check persisted row
    $row = $db->query("SELECT orders_freshness_status, rma_freshness_status FROM commerce_daily_aggregates WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'")->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'orders_freshness' => $row['orders_freshness_status'],
        'rma_freshness' => $row['rma_freshness_status']
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.orders_freshness, 'NOT_SYNCED', 'Unverified orders must default to NOT_SYNCED');
  assert.strictEqual(data.rma_freshness, 'NOT_SYNCED', 'Unverified RMA must default to NOT_SYNCED');
});

test('2. verified completed sync run marks AVAILABLE / NO_ORDERS_IN_PERIOD', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    $db = createTestDb();
    
    // Add completed sync runs covering 2026-09-10
    $db->exec("INSERT INTO commerce_sync_runs (shop_id, source_domain, sync_type, start_date, end_date, status)
               VALUES ('shop1', 'order', 'INCREMENTAL_DELTA', '2026-09-01', '2026-09-15', 'COMPLETED')");
    $db->exec("INSERT INTO commerce_sync_runs (shop_id, source_domain, sync_type, start_date, end_date, status)
               VALUES ('shop1', 'rma', 'INCREMENTAL_DELTA', '2026-09-01', '2026-09-15', 'COMPLETED')");

    // Add 1 order on 2026-09-10
    $db->exec("INSERT INTO commerce_orders (shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount)
               VALUES ('shop1', 'ORD_001', 'COMPLETED', 'DELIVERED', '2026-09-10 12:00:00', 300000)");

    $aggService = new CommerceDailyAggregateService($db);
    $aggService->rebuildDailyAggregate('shop1', '2026-09-10');
    
    // Also test date with 0 orders but verified sync run: 2026-09-11
    $aggService->rebuildDailyAggregate('shop1', '2026-09-11');

    $row10 = $db->query("SELECT orders_freshness_status, rma_freshness_status FROM commerce_daily_aggregates WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'")->fetch(PDO::FETCH_ASSOC);
    $row11 = $db->query("SELECT orders_freshness_status, rma_freshness_status FROM commerce_daily_aggregates WHERE shop_id = 'shop1' AND metric_date = '2026-09-11'")->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'row10' => $row10,
        'row11' => $row11
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.row10.orders_freshness_status, 'AVAILABLE', 'Verified date with orders should be AVAILABLE');
  assert.strictEqual(data.row10.rma_freshness_status, 'AVAILABLE', 'Verified RMA sync should be AVAILABLE');
  assert.strictEqual(data.row11.orders_freshness_status, 'NO_ORDERS_IN_PERIOD', 'Verified date with 0 orders should be NO_ORDERS_IN_PERIOD');
  assert.strictEqual(data.row11.rma_freshness_status, 'AVAILABLE', 'Verified RMA sync on 0 orders date should be AVAILABLE');
});

test('3. unverified zero orders reported as NOT_SYNCED (never converted to verified zero)', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_analytics_service.php';
    $db = createTestDb();
    
    // Zero orders in DB, NO sync runs covering 2026-01-01 to 2026-01-31
    $analytics = new CommerceAnalyticsService($db);
    $report = $analytics->getDashboardReport('shop1', '2026-01-01', '2026-01-31');

    echo json_encode([
        'sales_status' => $report['sales_status'] ?? null,
        'orders_status' => $report['orders_status'] ?? null,
        'total_orders' => $report['summary']['total_orders'] ?? null
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.sales_status.status, 'NOT_SYNCED', 'Unverified sales status must be NOT_SYNCED');
  assert.strictEqual(data.orders_status.status, 'NOT_SYNCED', 'Unverified orders status must be NOT_SYNCED');
  assert.strictEqual(data.sales_status.message, 'Chưa đồng bộ dữ liệu bán hàng cho kỳ đã chọn');
  assert.strictEqual(data.orders_status.message, 'Chưa đồng bộ dữ liệu đơn hàng');
});

// ====================================================================
// SECTION 2: Rebuild Queue Integrity & Concurrency Safety (Tests 4-9)
// ====================================================================
console.log('\n[SECTION 2] Rebuild Queue Integrity & Concurrency Safety (Tests 4-9)');

test('4. repeated lifecycle enqueue after COMPLETED transitions to PENDING without duplicate key collision', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    $db = createTestDb();
    $agg = new CommerceDailyAggregateService($db);

    // Initial enqueue
    $agg->enqueueDate('shop1', '2026-09-10', 'ORDER_CREATED');
    $q1 = $agg->getQueueItem('shop1', '2026-09-10');
    assert($q1['status'] === 'PENDING');

    // Simulate completion
    $db->exec("UPDATE commerce_daily_aggregate_queue SET status = 'COMPLETED', dirty_while_processing = 0 WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'");
    $qCompleted = $agg->getQueueItem('shop1', '2026-09-10');
    assert($qCompleted['status'] === 'COMPLETED');

    // Late event arrives for same date: enqueue again
    $agg->enqueueDate('shop1', '2026-09-10', 'LATE_RMA_ARRIVED');
    $qReenqueued = $agg->getQueueItem('shop1', '2026-09-10');

    // Count total rows for this platform, shop, metric_date
    $cnt = $db->query("SELECT COUNT(*) FROM commerce_daily_aggregate_queue WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'")->fetchColumn();

    echo json_encode([
        'count' => (int)$cnt,
        'status' => $qReenqueued['status'],
        'reason' => $qReenqueued['reason']
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.count, 1, 'Natural grain: strictly 1 row per platform/shop/metric_date');
  assert.strictEqual(data.status, 'PENDING', 'Re-enqueue must reset COMPLETED item to PENDING');
  assert.strictEqual(data.reason, 'LATE_RMA_ARRIVED');
});

test('5. concurrency safety: atomic claim prevents duplicate processing between parallel workers', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    $db = createTestDb();
    $agg = new CommerceDailyAggregateService($db);

    $agg->enqueueDate('shop1', '2026-09-10', 'ORDER_CREATED');
    $qItem = $agg->getQueueItem('shop1', '2026-09-10');
    $id = $qItem['id'];

    // Worker 1 claims item
    $worker1Claim = $db->prepare("UPDATE commerce_daily_aggregate_queue 
                                  SET status = 'PROCESSING', worker_id = :worker_id, processing_started_at = datetime('now')
                                  WHERE id = :id AND status = 'PENDING'");
    $worker1Claim->execute([':worker_id' => 'worker_alpha_1', ':id' => $id]);
    $worker1Won = ($worker1Claim->rowCount() === 1);

    // Worker 2 attempts to claim the same item concurrently
    $worker2Claim = $db->prepare("UPDATE commerce_daily_aggregate_queue 
                                  SET status = 'PROCESSING', worker_id = :worker_id, processing_started_at = datetime('now')
                                  WHERE id = :id AND status = 'PENDING'");
    $worker2Claim->execute([':worker_id' => 'worker_beta_2', ':id' => $id]);
    $worker2Won = ($worker2Claim->rowCount() === 1);

    $finalItem = $agg->getQueueItem('shop1', '2026-09-10');

    echo json_encode([
        'worker1_won' => $worker1Won,
        'worker2_won' => $worker2Won,
        'assigned_worker' => $finalItem['worker_id'],
        'status' => $finalItem['status']
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.worker1_won, true, 'First worker must claim successfully');
  assert.strictEqual(data.worker2_won, false, 'Second worker must fail atomic claim');
  assert.strictEqual(data.assigned_worker, 'worker_alpha_1');
  assert.strictEqual(data.status, 'PROCESSING');
});

test('6. late RMA during active PROCESSING sets dirty_while_processing=1 and leaves item PENDING', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    $db = createTestDb();
    $agg = new CommerceDailyAggregateService($db);

    // 1. Initial enqueue & claim
    $agg->enqueueDate('shop1', '2026-09-10', 'ORDER_CREATED');
    $db->exec("UPDATE commerce_daily_aggregate_queue SET status = 'PROCESSING', worker_id = 'worker_live' WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'");

    // 2. While worker is PROCESSING, late RMA arrives and calls enqueueDate
    $agg->enqueueDate('shop1', '2026-09-10', 'LATE_RMA_ARRIVED');
    $qMid = $agg->getQueueItem('shop1', '2026-09-10');
    assert((int)$qMid['dirty_while_processing'] === 1, 'Must mark dirty while processing');

    // 3. Worker finishes current batch rebuild
    $agg->rebuildDailyAggregate('shop1', '2026-09-10');

    // 4. Worker executes completion logic (as in drainQueue)
    // Check dirty flag
    $chk = $agg->getQueueItem('shop1', '2026-09-10');
    if ((int)$chk['dirty_while_processing'] === 1) {
        $db->prepare("UPDATE commerce_daily_aggregate_queue 
                      SET status = 'PENDING', dirty_while_processing = 0, retry_count = 0, worker_id = NULL
                      WHERE id = :id")->execute([':id' => $chk['id']]);
    } else {
        $db->prepare("UPDATE commerce_daily_aggregate_queue 
                      SET status = 'COMPLETED', worker_id = NULL
                      WHERE id = :id")->execute([':id' => $chk['id']]);
    }

    $qFinal = $agg->getQueueItem('shop1', '2026-09-10');

    echo json_encode([
        'dirty_was_flagged' => (int)$qMid['dirty_while_processing'],
        'final_status' => $qFinal['status'],
        'dirty_cleared' => (int)$qFinal['dirty_while_processing']
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.dirty_was_flagged, 1, 'Dirty flag must be set during active processing');
  assert.strictEqual(data.final_status, 'PENDING', 'Item must remain PENDING so late RMA is not lost');
  assert.strictEqual(data.dirty_cleared, 0, 'Dirty flag is cleared for next processing turn');
});

test('7. transient failure retries up to max_retries (3) before transitioning to FAILED', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    $db = createTestDb();
    $agg = new CommerceDailyAggregateService($db);

    $agg->enqueueDate('shop1', '2026-09-10', 'ORDER_CREATED');

    // Simulate failure 1
    $db->exec("UPDATE commerce_daily_aggregate_queue SET status = 'PROCESSING', retry_count = 0 WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'");
    $db->exec("UPDATE commerce_daily_aggregate_queue SET status = 'PENDING', retry_count = retry_count + 1, error_message = 'DB timeout 1' WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'");
    $q1 = $agg->getQueueItem('shop1', '2026-09-10');

    // Simulate failure 2
    $db->exec("UPDATE commerce_daily_aggregate_queue SET status = 'PROCESSING' WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'");
    $db->exec("UPDATE commerce_daily_aggregate_queue SET status = 'PENDING', retry_count = retry_count + 1, error_message = 'DB timeout 2' WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'");
    $q2 = $agg->getQueueItem('shop1', '2026-09-10');

    // Simulate failure 3 (hits max_retries = 3)
    $db->exec("UPDATE commerce_daily_aggregate_queue SET status = 'PROCESSING' WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'");
    $db->exec("UPDATE commerce_daily_aggregate_queue SET status = 'FAILED', retry_count = retry_count + 1, error_message = 'Fatal error after 3 attempts' WHERE shop_id = 'shop1' AND metric_date = '2026-09-10'");
    $q3 = $agg->getQueueItem('shop1', '2026-09-10');

    echo json_encode([
        'retry_1' => ['status' => $q1['status'], 'retries' => (int)$q1['retry_count']],
        'retry_2' => ['status' => $q2['status'], 'retries' => (int)$q2['retry_count']],
        'retry_3' => ['status' => $q3['status'], 'retries' => (int)$q3['retry_count'], 'err' => $q3['error_message']]
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.retry_1.status, 'PENDING');
  assert.strictEqual(data.retry_1.retries, 1);
  assert.strictEqual(data.retry_2.status, 'PENDING');
  assert.strictEqual(data.retry_2.retries, 2);
  assert.strictEqual(data.retry_3.status, 'FAILED');
  assert.strictEqual(data.retry_3.retries, 3);
});

test('8. re-enqueueing a FAILED item resets to PENDING and clears error message', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    $db = createTestDb();
    $agg = new CommerceDailyAggregateService($db);

    // Seed FAILED row
    $db->exec("INSERT INTO commerce_daily_aggregate_queue (shop_id, metric_date, reason, status, retry_count, error_message)
               VALUES ('shop1', '2026-09-10', 'MANUAL_RETRY', 'FAILED', 3, 'Fatal dead lock exception')");

    // Re-enqueue
    $agg->enqueueDate('shop1', '2026-09-10', 'USER_TRIGGERED_RETRY');
    $qItem = $agg->getQueueItem('shop1', '2026-09-10');

    echo json_encode([
        'status' => $qItem['status'],
        'retry_count' => (int)$qItem['retry_count'],
        'error_message' => $qItem['error_message'],
        'reason' => $qItem['reason']
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'PENDING', 'Re-enqueueing FAILED row must reset to PENDING');
  assert.strictEqual(data.retry_count, 0, 'Retry count must reset to 0');
  assert.strictEqual(data.error_message, null, 'Error message must be cleared');
  assert.strictEqual(data.reason, 'USER_TRIGGERED_RETRY');
});

test('9. stuck PROCESSING recovery (> 300s) resets to PENDING', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    $db = createTestDb();
    $agg = new CommerceDailyAggregateService($db);

    // Insert job stuck in PROCESSING from 10 minutes ago
    $db->exec("INSERT INTO commerce_daily_aggregate_queue (shop_id, metric_date, reason, status, worker_id, processing_started_at)
               VALUES ('shop1', '2026-09-10', 'ORDER_CREATED', 'PROCESSING', 'dead_worker_999', datetime('now', '-600 seconds'))");

    // Call drainQueue with limit 10
    $drained = $agg->drainQueue(10);
    $qItem = $agg->getQueueItem('shop1', '2026-09-10');

    echo json_encode([
        'drained_count' => $drained,
        'recovered_status' => $qItem['status']
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.recovered_status, 'COMPLETED', 'Stuck job should be recovered and successfully processed');
});

// ====================================================================
// SECTION 3: Migration & Rollback Safety (Tests 10-13)
// ====================================================================
console.log('\n[SECTION 3] Migration & Rollback Safety (Tests 10-13)');

test('10. migration 019 contains zero FOREIGN_KEY_CHECKS toggles and includes online DDL guidelines', () => {
  const migPath = path.join(PROJECT_ROOT, 'database', 'migrations', '20261007_019_create_commerce_daily_aggregates_and_indexes.sql');
  const content = fs.readFileSync(migPath, 'utf8');

  // Must not execute SET FOREIGN_KEY_CHECKS
  const hasFkCheck = /SET\s+FOREIGN_KEY_CHECKS/i.test(content);
  assert.strictEqual(hasFkCheck, false, 'Migration 019 must NOT execute SET FOREIGN_KEY_CHECKS');

  // Must have online DDL documentation
  const hasOnlineDdl = /ALGORITHM=INPLACE/i.test(content) && /LOCK=NONE/i.test(content);
  assert.strictEqual(hasOnlineDdl, true, 'Migration 019 must document ALGORITHM=INPLACE, LOCK=NONE');

  // Must have default NOT_SYNCED for freshness statuses
  assert.ok(content.includes("'NOT_SYNCED'"), 'Freshness defaults must be NOT_SYNCED');
});

test('11. rollback 019 contains zero FOREIGN_KEY_CHECKS toggles', () => {
  const rollPath = path.join(PROJECT_ROOT, 'database', 'migrations', '20261007_019_rollback_create_commerce_daily_aggregates_and_indexes.sql');
  const content = fs.readFileSync(rollPath, 'utf8');

  const hasFkCheck = /SET\s+FOREIGN_KEY_CHECKS/i.test(content);
  assert.strictEqual(hasFkCheck, false, 'Rollback 019 must NOT execute SET FOREIGN_KEY_CHECKS');
});

test('12. rollback 019 safely archives populated tables (*_archived) instead of destructively dropping', () => {
  const rollPath = path.join(PROJECT_ROOT, 'database', 'migrations', '20261007_019_rollback_create_commerce_daily_aggregates_and_indexes.sql');
  const content = fs.readFileSync(rollPath, 'utf8');

  // Checks for row count verification and table rename / archive logic
  assert.ok(content.includes('commerce_daily_aggregates_archived'), 'Rollback must support archiving commerce_daily_aggregates');
  assert.ok(content.includes('commerce_daily_aggregate_queue_archived'), 'Rollback must support archiving commerce_daily_aggregate_queue');
  assert.ok(content.includes('information_schema.TABLES'), 'Rollback must verify table state via information_schema');
});

test('13. rollback 019 validates index column signatures before dropping', () => {
  const rollPath = path.join(PROJECT_ROOT, 'database', 'migrations', '20261007_019_rollback_create_commerce_daily_aggregates_and_indexes.sql');
  const content = fs.readFileSync(rollPath, 'utf8');

  assert.ok(content.includes('information_schema.STATISTICS'), 'Rollback must check statistics before dropping indexes');
  assert.ok(content.includes('COLUMN_NAME'), 'Rollback must verify column name signatures');
});

// ====================================================================
// SECTION 4: Aggregate Period Completeness & Safe Fallback (Tests 14-16)
// ====================================================================
console.log('\n[SECTION 4] Aggregate Period Completeness & Safe Fallback (Tests 14-16)');

test('14. incomplete daily aggregates trigger normalized fallback (report_source=NORMALIZED_FALLBACK)', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_analytics_service.php';
    $db = createTestDb();
    
    // Requested range: 2026-09-01 to 2026-09-05 (5 days)
    // Only 2 days aggregated in commerce_daily_aggregates
    $db->exec("INSERT INTO commerce_daily_aggregates (shop_id, metric_date, order_count, order_gross_value)
               VALUES ('shop1', '2026-09-01', 2, 200000), ('shop1', '2026-09-02', 1, 100000)");

    // Raw normalized orders exist across the range
    $db->exec("INSERT INTO commerce_orders (shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount)
               VALUES ('shop1', 'ORD_01', 'COMPLETED', 'DELIVERED', '2026-09-01 10:00:00', 200000),
                      ('shop1', 'ORD_02', 'COMPLETED', 'DELIVERED', '2026-09-03 10:00:00', 300000)");

    $analytics = new CommerceAnalyticsService($db);
    $report = $analytics->getDashboardReport('shop1', '2026-09-01', '2026-09-05');

    echo json_encode([
        'report_source' => $report['report_source'] ?? null,
        'aggregate_readiness' => $report['aggregate_readiness'] ?? null,
        'gross_revenue' => $report['revenue_and_metrics_overview']['source_orders_api']['value'] ?? null
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.report_source, 'NORMALIZED_FALLBACK', 'Incomplete range must safely fall back to normalized calculation');
  assert.strictEqual(data.aggregate_readiness, 'PARTIAL', 'Aggregate readiness must be PARTIAL');
  assert.strictEqual(parseFloat(data.gross_revenue), 500000, 'Normalized calculation includes all orders');
});

test('15. fully aggregated date range served directly from daily aggregates (report_source=DAILY_AGGREGATES)', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_analytics_service.php';
    $db = createTestDb();
    
    // Requested range: 2026-09-01 to 2026-09-03 (3 days)
    // All 3 days are aggregated
    $db->exec("INSERT INTO commerce_daily_aggregates (shop_id, metric_date, order_count, order_gross_value, realized_order_value)
               VALUES ('shop1', '2026-09-01', 2, 200000, 200000),
                      ('shop1', '2026-09-02', 3, 300000, 300000),
                      ('shop1', '2026-09-03', 1, 100000, 100000)");

    $analytics = new CommerceAnalyticsService($db);
    $report = $analytics->getDashboardReport('shop1', '2026-09-01', '2026-09-03');

    echo json_encode([
        'report_source' => $report['report_source'] ?? null,
        'aggregate_readiness' => $report['aggregate_readiness'] ?? null,
        'gross_revenue' => $report['revenue_and_metrics_overview']['source_orders_api']['value'] ?? null,
        'total_orders' => $report['loss_and_aftersales_summary']['total_orders_count'] ?? null
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.report_source, 'DAILY_AGGREGATES', 'Complete range must be served from daily aggregates');
  assert.strictEqual(data.aggregate_readiness, 'COMPLETE', 'Aggregate readiness must be COMPLETE');
  assert.strictEqual(parseFloat(data.gross_revenue), 600000);
  assert.strictEqual(data.total_orders, 6);
});

test('16. background sync failure preserves valid daily aggregates and reporting', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    $db = createTestDb();
    
    // Persist a valid aggregate for 2026-09-10
    $db->exec("INSERT INTO commerce_daily_aggregates (shop_id, metric_date, order_count, order_gross_value, realized_order_value)
               VALUES ('shop1', '2026-09-10', 5, 1000000, 1000000)");

    // Simulate an async sync job that fails
    $db->exec("INSERT INTO commerce_sync_jobs (shop_id, status, error_message)
               VALUES ('shop1', 'FAILED', 'TikTok API 500 Internal Error')");

    $aggService = new CommerceDailyAggregateService($db);
    $report = $aggService->getAggregateReport('shop1', '2026-09-10', '2026-09-10');

    echo json_encode([
        'gross' => $report['financial_metrics']['order_gross_value'] ?? null,
        'orders' => $report['financial_metrics']['total_orders'] ?? null
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(parseFloat(data.gross), 1000000, 'Sync job failure must not corrupt existing valid aggregates');
  assert.strictEqual(data.orders, 5);
});

// ====================================================================
// SECTION 5: Regression Baseline Preservation (Tests 17-18)
// ====================================================================
console.log('\n[SECTION 5] Regression Baseline Preservation (Tests 17-18)');

test('17. V2-05.2.3 Historical RMA create_time intervals and exclusive upper bounds preserved', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_aftersales_service.php';
    $db = createTestDb();
    $aftersales = new CommerceAftersalesService($db);

    $cov = $aftersales->getRmaPeriodCoverage('shop1', '2026-01-01', '2026-01-31');
    echo json_encode($cov);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.status, 'NOT_SYNCED', 'Unverified historical period must return NOT_SYNCED');
  assert.strictEqual(data.is_verified, false);
});

test('18. Customer 360 privacy and zero secret leakage preserved', () => {
  const code = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once __DIR__ . '/../public/api/commerce_customer_service.php';
    $db = createTestDb();
    $db->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, order_gross_amount, platform_created_at)
               VALUES ('tiktok_shop', 'shop1', 'ord_sep', 'COMPLETED', 'DELIVERED', 100000, '2026-09-10 10:00:00')");
    $customerService = new CommerceCustomerService($db, 'c7a8b9e0f1d2c3b4a5968778695a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a', 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2');

    $metrics = $customerService->getCustomerTrustMetrics('shop1', '2026-09-01', '2026-09-30');
    $serialized = json_encode($metrics);

    // Verify no secret key leakage
    $hasSecret = (strpos($serialized, 'c7a8b9e0f1d2') !== false) || (strpos($serialized, 'e1f2a3b4c5d6') !== false);
    echo json_encode(['leaked' => $hasSecret, 'status' => $metrics['status']]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const lines = res.output.trim().split('\n');
  const jsonLine = lines.find(l => l.trim().startsWith('{'));
  const data = JSON.parse(jsonLine);
  assert.strictEqual(data.leaked, false, 'No HMAC or encryption secrets leaked in response');
  assert.strictEqual(data.status, 'NO_VERIFIED_IDENTITY_IN_PERIOD');
});

// ====================================================================
// SECTION 6: MariaDB PDO Inspection & Exception Safety (Tests 19-24)
// ====================================================================
console.log('\n[SECTION 6] MariaDB PDO Inspection & Exception Safety (Tests 19-24)');

test('19. MariaDB native prepare for hasTable() uses information_schema.TABLES and filters TABLE_SCHEMA = DATABASE()', () => {
  const code = `
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';

    class MariaDbMockPDO extends PDO {
        public array $preparedQueries = [];
        public array $executedParams = [];
        public mixed $mockResult = 1;
        public function __construct() {}
        public function getAttribute(int $attribute): mixed {
            if ($attribute === PDO::ATTR_DRIVER_NAME) return 'mysql';
            return null;
        }
        public function prepare(string $query, array $options = []): PDOStatement {
            $this->preparedQueries[] = $query;
            return new class($this) extends PDOStatement {
                private $parent;
                public function __construct($parent) { $this->parent = $parent; }
                public function execute(?array $params = null): bool {
                    $this->parent->executedParams[] = $params;
                    return true;
                }
                public function fetchColumn(int $col = 0): mixed {
                    return $this->parent->mockResult;
                }
            };
        }
    }

    $mock = new MariaDbMockPDO();
    $service = new CommerceDailyAggregateService($mock);
    $exists = $service->hasTable('commerce_daily_aggregates');

    echo json_encode([
        'exists' => $exists,
        'query' => $mock->preparedQueries[0] ?? '',
        'params' => $mock->executedParams[0] ?? []
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.exists, true);
  assert.ok(data.query.includes('information_schema.TABLES'), 'Must query information_schema.TABLES');
  assert.ok(data.query.includes('TABLE_SCHEMA = DATABASE()'), 'Must filter by TABLE_SCHEMA = DATABASE()');
  assert.ok(data.query.includes('TABLE_NAME = ?'), 'Must use parameter placeholder for TABLE_NAME');
  assert.deepStrictEqual(data.params, ['commerce_daily_aggregates']);
});

test('20. MariaDB hasTable() returns false when table truly does not exist without throwing', () => {
  const code = `
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';

    class MariaDbMockNotFoundPDO extends PDO {
        public function __construct() {}
        public function getAttribute(int $attribute): mixed {
            if ($attribute === PDO::ATTR_DRIVER_NAME) return 'mysql';
            return null;
        }
        public function prepare(string $query, array $options = []): PDOStatement {
            return new class extends PDOStatement {
                public function execute(?array $params = null): bool { return true; }
                public function fetchColumn(int $col = 0): mixed { return false; } // no row found
            };
        }
    }

    $mock = new MariaDbMockNotFoundPDO();
    $service = new CommerceDailyAggregateService($mock);
    $exists = $service->hasTable('non_existent_table_xyz');

    echo json_encode(['exists' => $exists]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.exists, false, 'Non-existent table must return false');
});

test('21. Truly non-existent table in SQLite causes rebuildDailyAggregate to return TABLE_NOT_FOUND', () => {
  const code = `
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';
    // Empty SQLite database without any tables created
    $emptyDb = new PDO('sqlite::memory:');
    $emptyDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $service = new CommerceDailyAggregateService($emptyDb);
    $hasTable = $service->hasTable('commerce_daily_aggregates');
    $result = $service->rebuildDailyAggregate('shop1', '2026-09-10');

    echo json_encode([
        'hasTable' => $hasTable,
        'result' => $result
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.hasTable, false, 'Table should not exist in empty db');
  assert.strictEqual(data.result.success, false);
  assert.strictEqual(data.result.error, 'TABLE_NOT_FOUND', 'Must return TABLE_NOT_FOUND when table is genuinely absent');
});

test('22. MariaDB native prepare for hasColumn() uses information_schema.COLUMNS with bound parameters', () => {
  const code = `
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';

    class MariaDbColMockPDO extends PDO {
        public array $preparedQueries = [];
        public array $executedParams = [];
        public mixed $mockResult = 1;
        public function __construct() {}
        public function getAttribute(int $attribute): mixed {
            if ($attribute === PDO::ATTR_DRIVER_NAME) return 'mysql';
            return null;
        }
        public function prepare(string $query, array $options = []): PDOStatement {
            $this->preparedQueries[] = $query;
            return new class($this) extends PDOStatement {
                private $parent;
                public function __construct($parent) { $this->parent = $parent; }
                public function execute(?array $params = null): bool {
                    $this->parent->executedParams[] = $params;
                    return true;
                }
                public function fetchColumn(int $col = 0): mixed {
                    return $this->parent->mockResult;
                }
            };
        }
    }

    $mock = new MariaDbColMockPDO();
    $service = new CommerceDailyAggregateService($mock);

    $exists = $service->hasColumn('commerce_orders', 'platform_order_id');
    $mock->mockResult = false;
    $missing = $service->hasColumn('commerce_orders', 'non_existent_column');

    echo json_encode([
        'exists' => $exists,
        'missing' => $missing,
        'query' => $mock->preparedQueries[0] ?? '',
        'params1' => $mock->executedParams[0] ?? [],
        'params2' => $mock->executedParams[1] ?? []
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.exists, true);
  assert.strictEqual(data.missing, false);
  assert.ok(data.query.includes('information_schema.COLUMNS'), 'Must query information_schema.COLUMNS');
  assert.ok(data.query.includes('TABLE_SCHEMA = DATABASE()'), 'Must filter by TABLE_SCHEMA = DATABASE()');
  assert.ok(data.query.includes('TABLE_NAME = ?'), 'Must filter by TABLE_NAME = ?');
  assert.ok(data.query.includes('COLUMN_NAME = ?'), 'Must filter by COLUMN_NAME = ?');
  assert.deepStrictEqual(data.params1, ['commerce_orders', 'platform_order_id']);
  assert.deepStrictEqual(data.params2, ['commerce_orders', 'non_existent_column']);
});

test('23. Unexpected SQL error in hasTable() does NOT return false, logs safely and throws RuntimeException', () => {
  const code = `
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';

    class MariaDbErrMockPDO extends PDO {
        public function __construct() {}
        public function getAttribute(int $attribute): mixed {
            if ($attribute === PDO::ATTR_DRIVER_NAME) return 'mysql';
            return null;
        }
        public function prepare(string $query, array $options = []): PDOStatement {
            throw new PDOException("SQLSTATE[HY000]: 2002 Connection refused with password=SECRET_PASS_XYZ&token=BEARER_TOKEN_ABC");
        }
    }

    $mock = new MariaDbErrMockPDO();
    $service = new CommerceDailyAggregateService($mock);

    $caught = false;
    $exceptionClass = '';
    $exceptionMsg = '';
    try {
        $service->hasTable('commerce_daily_aggregates');
    } catch (Throwable $e) {
        $caught = true;
        $exceptionClass = get_class($e);
        $exceptionMsg = $e->getMessage();
    }

    echo json_encode([
        'caught' => $caught,
        'class' => $exceptionClass,
        'hasSecretPass' => strpos($exceptionMsg, 'SECRET_PASS_XYZ') !== false,
        'hasSecretToken' => strpos($exceptionMsg, 'BEARER_TOKEN_ABC') !== false,
        'hasRedacted' => strpos($exceptionMsg, 'REDACTED') !== false
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const lines = res.output.trim().split('\n');
  const jsonLine = lines.find(l => l.trim().startsWith('{'));
  const data = JSON.parse(jsonLine);
  assert.strictEqual(data.caught, true, 'Must throw exception on unexpected SQL error, never return false');
  assert.strictEqual(data.class, 'RuntimeException');
  assert.strictEqual(data.hasSecretPass, false, 'Must not leak secret password');
  assert.strictEqual(data.hasSecretToken, false, 'Must not leak secret token');
  assert.strictEqual(data.hasRedacted, true, 'Must redact sensitive values');
});

test('24. Unexpected SQL error in hasColumn() does NOT return false, logs safely and throws RuntimeException', () => {
  const code = `
    require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';

    class MariaDbColErrMockPDO extends PDO {
        public function __construct() {}
        public function getAttribute(int $attribute): mixed {
            if ($attribute === PDO::ATTR_DRIVER_NAME) return 'mysql';
            return null;
        }
        public function prepare(string $query, array $options = []): PDOStatement {
            throw new PDOException("SQLSTATE[42000]: 1044 Access denied for user 'app' with key=API_KEY_12345");
        }
    }

    $mock = new MariaDbColErrMockPDO();
    $service = new CommerceDailyAggregateService($mock);

    $caught = false;
    $exceptionClass = '';
    $exceptionMsg = '';
    try {
        $service->hasColumn('commerce_orders', 'status');
    } catch (Throwable $e) {
        $caught = true;
        $exceptionClass = get_class($e);
        $exceptionMsg = $e->getMessage();
    }

    echo json_encode([
        'caught' => $caught,
        'class' => $exceptionClass,
        'hasSecretKey' => strpos($exceptionMsg, 'API_KEY_12345') !== false,
        'hasRedacted' => strpos($exceptionMsg, 'REDACTED') !== false
    ]);
  `;
  const res = runPhpCode(code);
  assert.strictEqual(res.success, true, `PHP execution failed: ${res.output}`);
  const lines = res.output.trim().split('\n');
  const jsonLine = lines.find(l => l.trim().startsWith('{'));
  const data = JSON.parse(jsonLine);
  assert.strictEqual(data.caught, true, 'Must throw exception on unexpected SQL error, never return false');
  assert.strictEqual(data.class, 'RuntimeException');
  assert.strictEqual(data.hasSecretKey, false, 'Must not leak secret key');
  assert.strictEqual(data.hasRedacted, true, 'Must redact sensitive values');
});

// ====================================================================
// SECTION 7: SQL SCHEMA COMPATIBILITY & PRODUCTION ALIGNMENT (Tests 25-30)
// ====================================================================
console.log('\n[SECTION 7] SQL Schema Compatibility & Production Alignment (Tests 25-30)');

test('25. commerce_ads_campaign_daily real schema query works and preserves KPI semantics', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Insert into commerce_ads_campaign_daily with REAL production column names (spend, gross_revenue, orders)
    // and platform = 'tiktok_ads'
    $pdo->exec("INSERT INTO commerce_ads_campaign_daily (platform, shop_id, stat_date, spend, gross_revenue, orders, clicks, impressions) VALUES
        ('tiktok_ads', 'shop1', '2026-09-15', 250000.00, 1250000.00, 10, 150, 4500)");

    $aggService = new CommerceDailyAggregateService($pdo);
    $res = $aggService->rebuildDailyAggregate('shop1', '2026-09-15');
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    $ads = $report['advertising'];
    echo json_encode([
        'rebuild_success' => $res['success'],
        'ads_spend' => $ads['total_spend'],
        'ads_gross' => $ads['total_attributed_revenue'],
        'ads_orders' => $ads['total_attributed_orders'],
        'ads_clicks' => $ads['clicks'],
        'ads_impressions' => $ads['impressions'],
        'ads_roi' => $ads['ads_roi']
    ]);
  `;
  const res = runPhpCode(php);
  assert.strictEqual(res.success, true, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.rebuild_success, true, 'rebuildDailyAggregate must succeed');
  assert.strictEqual(data.ads_spend, 250000.0, 'ads_spend must match 250,000');
  assert.strictEqual(data.ads_gross, 1250000.0, 'ads_attributed_gross must match 1,250,000');
  assert.strictEqual(data.ads_orders, 10, 'ads_orders must match 10');
  assert.strictEqual(data.ads_clicks, 150, 'clicks must match 150');
  assert.strictEqual(data.ads_impressions, 4500, 'impressions must match 4500');
  assert.strictEqual(data.ads_roi, 5.0, 'ROI must be 1,250,000 / 250,000 = 5.00');
});

test('26. commerce_orders schema compatibility and cohort grouping', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Insert orders created on 2026-09-15
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'ORD_01', 'DELIVERED', 'DELIVERED', '2026-09-15 08:30:00', 350000.00),
        ('tiktok_shop', 'shop1', 'ORD_02', 'COMPLETED', 'COMPLETED', '2026-09-15 15:45:00', 650000.00)");

    $aggService = new CommerceDailyAggregateService($pdo);
    $res = $aggService->rebuildDatesForOrders('shop1', ['ORD_01', 'ORD_02']);
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    echo json_encode([
        'rebuilt_dates' => $res['rebuilt_dates'],
        'order_count' => $report['financial_metrics']['total_orders'],
        'gross_value' => $report['financial_metrics']['order_gross_value']
    ]);
  `;
  const res = runPhpCode(php);
  assert.strictEqual(res.success, true, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.deepStrictEqual(data.rebuilt_dates, ['2026-09-15']);
  assert.strictEqual(data.order_count, 2);
  assert.strictEqual(data.gross_value, 1000000.0);
});

test('27. commerce_loss_ledger schema compatibility and breakdown mapping', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Order created 2026-09-15
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'ORD_L1', 'DELIVERED', 'DELIVERED', '2026-09-15 10:00:00', 500000.00),
        ('tiktok_shop', 'shop1', 'ORD_L2', 'CANCELLED', 'CANCELLED', '2026-09-15 11:00:00', 300000.00),
        ('tiktok_shop', 'shop1', 'ORD_L3', 'DELIVERY_FAILED', 'DELIVERY_FAILED', '2026-09-15 12:00:00', 200000.00)");

    // Losses mapped to original cohort orders
    $pdo->exec("INSERT INTO commerce_loss_ledger (platform, shop_id, platform_order_id, loss_type, loss_amount, perspective, source_entity_id) VALUES
        ('tiktok_shop', 'shop1', 'ORD_L1', 'REFUND', 150000.00, 'MATURED_LIFECYCLE', 'RMA_1'),
        ('tiktok_shop', 'shop1', 'ORD_L2', 'CANCELLATION', 300000.00, 'MATURED_LIFECYCLE', 'CAN_1'),
        ('tiktok_shop', 'shop1', 'ORD_L3', 'FAILED_DELIVERY', 200000.00, 'MATURED_LIFECYCLE', 'FD_1')");

    $aggService = new CommerceDailyAggregateService($pdo);
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    $bd = $report['loss_breakdown'];
    echo json_encode([
        'total_gross' => $report['financial_metrics']['order_gross_value'],
        'total_loss' => $report['financial_metrics']['total_loss_value'],
        'realized' => $report['financial_metrics']['matured_realized_order_value'],
        'refund_loss' => $bd['REFUND']['loss_amount'],
        'cancel_loss' => $bd['CANCELLATION']['loss_amount'],
        'failed_delivery_loss' => $bd['FAILED_DELIVERY']['loss_amount']
    ]);
  `;
  const res = runPhpCode(php);
  assert.strictEqual(res.success, true, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.total_gross, 1000000.0);
  assert.strictEqual(data.total_loss, 650000.0);
  assert.strictEqual(data.realized, 350000.0);
  assert.strictEqual(data.refund_loss, 150000.0);
  assert.strictEqual(data.cancel_loss, 300000.0);
  assert.strictEqual(data.failed_delivery_loss, 200000.0);
});

test('28. commerce_finance_statements & transactions schema compatibility', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Statement
    $pdo->exec("INSERT INTO commerce_finance_statements (platform, shop_id, statement_id, statement_time, total_settlement_amount) VALUES
        ('tiktok_shop', 'shop1', 'STMT_001', '2026-09-15 18:00:00', 850000.00)");

    // Transactions with fees
    $pdo->exec("INSERT INTO commerce_finance_transactions (platform, shop_id, platform_order_id, transaction_type, platform_commission, affiliate_commission, payment_fee, shipping_fee_subsidy, actual_shipping_fee, adjustment_amount, transaction_time) VALUES
        ('tiktok_shop', 'shop1', 'ORD_T1', 'ORDER', 50000.00, 30000.00, 15000.00, 20000.00, 25000.00, 5000.00, '2026-09-15 12:00:00')");

    $aggService = new CommerceDailyAggregateService($pdo);
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    $fin = $report['finance'];
    echo json_encode([
        'statements' => $fin['statement_count'],
        'settled_amount' => $fin['total_settled_amount'],
        'commission' => $fin['platform_commission'],
        'affiliate' => $fin['affiliate_commission'],
        'payment_fee' => $fin['payment_fee'],
        'shipping_subsidy' => $fin['shipping_fee_subsidy'],
        'actual_shipping' => $fin['actual_shipping_fee'],
        'adjustment' => $fin['adjustment_amount']
    ]);
  `;
  const res = runPhpCode(php);
  assert.strictEqual(res.success, true, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.statements, 1);
  assert.strictEqual(data.settled_amount, 850000.0);
  assert.strictEqual(data.commission, 50000.0);
  assert.strictEqual(data.affiliate, 30000.0);
  assert.strictEqual(data.payment_fee, 15000.0);
  assert.strictEqual(data.shipping_subsidy, 20000.0);
  assert.strictEqual(data.actual_shipping, 25000.0);
  assert.strictEqual(data.adjustment, 5000.0);
});

test('29. Invariants preserved: Gross - Loss = Realized and Data Trust NOT_SYNCED default', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Order with 1,000,000 gross
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'O_INV', 'DELIVERED', 'DELIVERED', '2026-09-15 10:00:00', 1000000.00)");
    // Refund of 300,000
    $pdo->exec("INSERT INTO commerce_loss_ledger (platform, shop_id, platform_order_id, loss_type, loss_amount, perspective, source_entity_id) VALUES
        ('tiktok_shop', 'shop1', 'O_INV', 'REFUND', 300000.00, 'MATURED_LIFECYCLE', 'R_INV')");

    $aggService = new CommerceDailyAggregateService($pdo);
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    $eqBalanced = $report['invariant_check']['equation_balanced'];
    $ordersFresh = $report['financial_metrics']['orders_verified'];
    $rmaFresh = $report['financial_metrics']['rma_verified'];
    $period = $report['period'];

    echo json_encode([
        'equation_balanced' => $eqBalanced,
        'gross' => $report['financial_metrics']['order_gross_value'],
        'loss' => $report['financial_metrics']['total_loss_value'],
        'realized' => $report['financial_metrics']['matured_realized_order_value'],
        'orders_status' => $period['orders_coverage_status'],
        'rma_status' => $period['rma_coverage_status'],
        'missing_days_not_zero' => ($period['orders_coverage_status'] === 'NOT_SYNCED' && $period['rma_coverage_status'] === 'NOT_SYNCED')
    ]);
  `;
  const res = runPhpCode(php);
  assert.strictEqual(res.success, true, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.equation_balanced, true, 'Gross - Loss must equal Realized');
  assert.strictEqual(data.gross, 1000000.0);
  assert.strictEqual(data.loss, 300000.0);
  assert.strictEqual(data.realized, 700000.0);
  assert.strictEqual(data.missing_days_not_zero, true, 'Unverified sync must remain NOT_SYNCED, never converted to verified zero');
});

test('30. Bounded multi-day rebuild (rebuildDateRange) runs safely on complete real schema', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Seed 5 days of data across all domains
    for ($i = 1; $i <= 5; $i++) {
        $dt = sprintf('2026-09-%02d', $i);
        $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
            ('tiktok_shop', 'shop1', 'ORD_{$i}', 'DELIVERED', 'DELIVERED', '{$dt} 10:00:00', 200000.00)");
        $pdo->exec("INSERT INTO commerce_ads_campaign_daily (platform, shop_id, stat_date, spend, gross_revenue, orders, clicks, impressions) VALUES
            ('tiktok_ads', 'shop1', '{$dt}', 50000.00, 200000.00, 2, 30, 800)");
    }

    $aggService = new CommerceDailyAggregateService($pdo);
    $rangeRes = $aggService->rebuildDateRange('shop1', '2026-09-01', '2026-09-05');
    $report = $aggService->getAggregateReport('shop1', '2026-09-01', '2026-09-05');

    echo json_encode([
        'days_processed' => $rangeRes['days_processed'],
        'total_orders' => $report['financial_metrics']['total_orders'],
        'total_gross' => $report['financial_metrics']['order_gross_value'],
        'total_ads_spend' => $report['advertising']['total_spend'],
        'total_ads_revenue' => $report['advertising']['total_attributed_revenue'],
        'ads_roi' => $report['advertising']['ads_roi']
    ]);
  `;
  const res = runPhpCode(php);
  assert.strictEqual(res.success, true, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.days_processed, 5, 'Must process exactly 5 days');
  assert.strictEqual(data.total_orders, 5, 'Total orders must be 5');
  assert.strictEqual(data.total_gross, 1000000.0, 'Total gross must be 1,000,000');
  assert.strictEqual(data.total_ads_spend, 250000.0, 'Total ads spend must be 250,000 (5 * 50k)');
  assert.strictEqual(data.total_ads_revenue, 1000000.0, 'Total ads revenue must be 1,000,000 (5 * 200k)');
  assert.strictEqual(data.ads_roi, 4.0, 'Blended Ads ROI must be 1,000,000 / 250,000 = 4.00');
});

// ====================================================================
// SUMMARY & REPORT
// ====================================================================
console.log('\n====================================================================');
console.log(`  SPRINT V2-06.1 TEST RESULTS: ${passedTests}/${totalTests} PASS (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('====================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

