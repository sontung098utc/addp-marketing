/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - SPRINT V2-06 REGRESSION TEST SUITE
 * Test: DB-First Reporting, Daily Aggregation & Automatic Background Sync
 * File: tools/test_v2_06_db_first_reporting.cjs
 * Requirements: 22 Regression Test Cases (Section 17)
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
console.log('  SPRINT V2-06: DB-FIRST REPORTING & DAILY AGGREGATION (22 TESTS)');
console.log(`  Resolved PHP Command: ${phpCmd}`);
console.log('====================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runPhpCode(code, envOverrides = {}) {
  const tempScript = path.join(__dirname, `_temp_v2_06_test_${Date.now()}_${Math.floor(Math.random() * 1000)}.php`);
  
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

// Common SQLite DB Setup Helper
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
            order_gross_amount REAL DEFAULT 0.00
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
            current_domain TEXT,
            progress_percent REAL DEFAULT 100.0,
            checkpoint_data TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    ");
    return $pdo;
}
`;

// =====================================================================
// SECTION 1: DB-FIRST REPORTING & API DECOUPLING (Tests 1, 13, 14)
// =====================================================================
console.log('\n[SECTION 1] DB-First Reporting & API Decoupling (Tests 1, 13, 14)');

test('1. dashboard date change does not call TikTok API', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_analytics_service.php';
    require_once 'public/api/tiktok_client.php';

    class SpyingClient extends TikTokShopClient {
        public int $apiCallsCount = 0;
        public function searchOrders($accessToken, $shopCipher, $startTime = null, $endTime = null, $pageSize = 50, $pageToken = null) {
            $this->apiCallsCount++;
            return ['orders' => []];
        }
        public function searchOrdersV2($accessToken, $shopCipher, array $options = []) {
            $this->apiCallsCount++;
            return ['orders' => []];
        }
        public function searchReturnRefundRmaV2($accessToken, $shopCipher, array $options = []) {
            $this->apiCallsCount++;
            return ['returns' => []];
        }
    }

    $pdo = createTestDb();
    $spy = new SpyingClient();
    $analytics = new CommerceAnalyticsService($pdo, $spy);

    // Seed aggregate
    $pdo->exec("INSERT INTO commerce_daily_aggregates (platform, shop_id, metric_date, order_count, order_gross_value, realized_order_value) VALUES ('tiktok_shop', 'shop1', '2026-09-15', 5, 500000, 500000)");

    $report = $analytics->getDashboardReport('shop1', '2026-09-15', '2026-09-15');
    echo json_encode(['api_calls' => $spy->apiCallsCount, 'source' => $report['report_source'] ?? 'UNKNOWN']);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.api_calls, 0, 'Must make ZERO TikTok API calls during report fetch');
  assert.strictEqual(data.source, 'DAILY_AGGREGATES', 'Must read from DAILY_AGGREGATES');
});

test('13. report does not trigger syncAll', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_dashboard.php'), 'utf8');
  const actionMatch = code.match(/case\s+'get_dashboard_report':[\s\S]*?break;/);
  assert(actionMatch, 'get_dashboard_report action must exist');
  assert(!actionMatch[0].includes('syncAll'), 'get_dashboard_report must NOT invoke syncAll');
});

test('14. report does not trigger trigger_sync', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_dashboard.php'), 'utf8');
  const actionMatch = code.match(/case\s+'get_dashboard_report':[\s\S]*?break;/);
  assert(!actionMatch[0].includes('trigger_sync'), 'get_dashboard_report must NOT invoke trigger_sync');
});

// =====================================================================
// SECTION 2: METRIC ACCURACY & MATHEMATICAL INVARIANTS (Tests 2, 3, 4, 11, 12)
// =====================================================================
console.log('\n[SECTION 2] Metric Accuracy & Mathematical Invariants (Tests 2, 3, 4, 11, 12)');

test('2. aggregate gross matches normalized gross', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Insert normalized orders
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'O1', 'DELIVERED', 'DELIVERED', '2026-09-15 10:00:00', 300000.00),
        ('tiktok_shop', 'shop1', 'O2', 'DELIVERED', 'DELIVERED', '2026-09-15 14:00:00', 450000.00)");

    $aggService = new CommerceDailyAggregateService($pdo);
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    $normGross = 750000.00;
    $aggGross = (float)$report['financial_metrics']['order_gross_value'];
    echo json_encode(['matches' => abs($normGross - $aggGross) < 0.01, 'gross' => $aggGross]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.matches, true, 'Aggregate gross must match normalized gross');
  assert.strictEqual(data.gross, 750000.0);
});

test('3. aggregate loss matches normalized loss', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'O1', 'CANCELLED', 'CANCELLED', '2026-09-15 10:00:00', 300000.00),
        ('tiktok_shop', 'shop1', 'O2', 'DELIVERED', 'DELIVERED', '2026-09-15 14:00:00', 450000.00)");

    $pdo->exec("INSERT INTO commerce_loss_ledger (platform, shop_id, platform_order_id, loss_type, loss_amount, perspective, source_entity_id) VALUES
        ('tiktok_shop', 'shop1', 'O1', 'CANCELLATION', 300000.00, 'MATURED_LIFECYCLE', 'C1'),
        ('tiktok_shop', 'shop1', 'O2', 'REFUND', 150000.00, 'MATURED_LIFECYCLE', 'R1')");

    $aggService = new CommerceDailyAggregateService($pdo);
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    $normLoss = 450000.00;
    $aggLoss = (float)$report['financial_metrics']['total_loss_value'];
    echo json_encode(['matches' => abs($normLoss - $aggLoss) < 0.01, 'loss' => $aggLoss]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.matches, true, 'Aggregate loss must match normalized loss');
  assert.strictEqual(data.loss, 450000.0);
});

test('4. Gross - Loss = Realized', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'O1', 'DELIVERED', 'DELIVERED', '2026-09-15 10:00:00', 1000000.00)");
    $pdo->exec("INSERT INTO commerce_loss_ledger (platform, shop_id, platform_order_id, loss_type, loss_amount, perspective, source_entity_id) VALUES
        ('tiktok_shop', 'shop1', 'O1', 'REFUND', 350000.00, 'MATURED_LIFECYCLE', 'R1')");

    $aggService = new CommerceDailyAggregateService($pdo);
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    $gross = (float)$report['financial_metrics']['order_gross_value'];
    $loss = (float)$report['financial_metrics']['total_loss_value'];
    $realized = (float)$report['financial_metrics']['matured_realized_order_value'];
    $eq = abs(($gross - $loss) - $realized) < 0.01;

    echo json_encode(['equation_balanced' => $eq, 'gross' => $gross, 'loss' => $loss, 'realized' => $realized]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.equation_balanced, true, 'Gross - Total Loss must equal Realized');
  assert.strictEqual(data.realized, 650000.0);
});

test('11. Ads monthly ROI reconstructed correctly', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Day 1: spend 100, gross 500 (daily roi 5.0)
    // Day 2: spend 1000, gross 1000 (daily roi 1.0)
    $pdo->exec("INSERT INTO commerce_daily_aggregates (platform, shop_id, metric_date, ads_spend, ads_attributed_gross) VALUES
        ('tiktok_shop', 'shop1', '2026-09-01', 100.00, 500.00),
        ('tiktok_shop', 'shop1', '2026-09-02', 1000.00, 1000.00)");

    $aggService = new CommerceDailyAggregateService($pdo);
    $report = $aggService->getAggregateReport('shop1', '2026-09-01', '2026-09-02');
    $roi = $report['advertising']['ads_roi'];
    // Correct: 1500 / 1100 = 1.36
    // Wrong: (5.0 + 1.0) / 2 = 3.0
    echo json_encode(['roi' => $roi, 'is_correct' => ($roi === 1.36)]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.is_correct, true, 'Monthly Ads ROI must be SUM(gross)/SUM(spend) = 1.36');
});

test('12. AOV reconstructed correctly', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Day 1: 1 order, gross 1,000,000 (daily aov 1,000,000)
    // Day 2: 9 orders, gross 900,000 (daily aov 100,000)
    $pdo->exec("INSERT INTO commerce_daily_aggregates (platform, shop_id, metric_date, order_count, order_gross_value) VALUES
        ('tiktok_shop', 'shop1', '2026-09-01', 1, 1000000.00),
        ('tiktok_shop', 'shop1', '2026-09-02', 9, 900000.00)");

    $aggService = new CommerceDailyAggregateService($pdo);
    $report = $aggService->getAggregateReport('shop1', '2026-09-01', '2026-09-02');
    $aov = $report['financial_metrics']['aov'];
    // Correct: 1,900,000 / 10 = 190,000
    // Wrong: (1,000,000 + 100,000) / 2 = 550,000
    echo json_encode(['aov' => $aov, 'is_correct' => ($aov === 190000.0)]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.is_correct, true, 'Period AOV must be SUM(gross)/SUM(orders) = 190,000');
});

// =====================================================================
// SECTION 3: MATURED LIFECYCLE REBUILD (Tests 5, 6, 7)
// =====================================================================
console.log('\n[SECTION 3] Matured Lifecycle Rebuild (Tests 5, 6, 7)');

test('5. late RMA rebuilds original order date', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Order created 2026-09-15
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'ORD_SEP15', 'DELIVERED', 'DELIVERED', '2026-09-15 14:00:00', 1000000.00)");

    $aggService = new CommerceDailyAggregateService($pdo);
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');

    // On 2026-10-07, refund happens
    $pdo->exec("INSERT INTO commerce_loss_ledger (platform, shop_id, platform_order_id, loss_type, loss_amount, perspective, source_entity_id, effective_at) VALUES
        ('tiktok_shop', 'shop1', 'ORD_SEP15', 'REFUND', 300000.00, 'MATURED_LIFECYCLE', 'RMA_OCT07', '2026-10-07 10:00:00')");

    // Rebuild order dates triggered by RMA event
    $rebuildRes = $aggService->rebuildDatesForOrders('shop1', ['ORD_SEP15']);

    $repSep15 = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');
    $aggService->rebuildDailyAggregate('shop1', '2026-10-07');
    $repOct07 = $aggService->getAggregateReport('shop1', '2026-10-07', '2026-10-07');

    echo json_encode([
        'rebuilt_dates' => $rebuildRes['rebuilt_dates'],
        'sep15_gross' => $repSep15['financial_metrics']['order_gross_value'],
        'sep15_loss' => $repSep15['financial_metrics']['total_loss_value'],
        'sep15_realized' => $repSep15['financial_metrics']['matured_realized_order_value'],
        'oct07_loss' => $repOct07['financial_metrics']['total_loss_value'] ?? 0
    ]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.deepStrictEqual(data.rebuilt_dates, ['2026-09-15'], 'Must identify and rebuild 2026-09-15');
  assert.strictEqual(data.sep15_gross, 1000000.0);
  assert.strictEqual(data.sep15_loss, 300000.0, 'Sep 15 aggregate must reflect 300k refund loss');
  assert.strictEqual(data.sep15_realized, 700000.0, 'Sep 15 realized must be 700k');
  assert.strictEqual(data.oct07_loss, 0, 'Oct 07 aggregate must NOT absorb Sep 15 refund loss');
});

test('6. cancellation rebuilds original order date', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'ORD_CANCEL', 'CANCELLED', 'CANCELLED', '2026-09-10 08:00:00', 500000.00)");
    $pdo->exec("INSERT INTO commerce_loss_ledger (platform, shop_id, platform_order_id, loss_type, loss_amount, perspective, source_entity_id) VALUES
        ('tiktok_shop', 'shop1', 'ORD_CANCEL', 'CANCELLATION', 500000.00, 'MATURED_LIFECYCLE', 'CANCEL_O1')");

    $aggService = new CommerceDailyAggregateService($pdo);
    $res = $aggService->rebuildDatesForOrders('shop1', ['ORD_CANCEL']);
    $rep = $aggService->getAggregateReport('shop1', '2026-09-10', '2026-09-10');

    echo json_encode([
        'rebuilt_dates' => $res['rebuilt_dates'],
        'loss' => $rep['financial_metrics']['total_loss_value'],
        'realized' => $rep['financial_metrics']['matured_realized_order_value']
    ]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.deepStrictEqual(data.rebuilt_dates, ['2026-09-10']);
  assert.strictEqual(data.loss, 500000.0);
  assert.strictEqual(data.realized, 0.0);
});

test('7. duplicate rebuild is idempotent', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'ORD1', 'DELIVERED', 'DELIVERED', '2026-09-15 10:00:00', 250000.00)");

    $aggService = new CommerceDailyAggregateService($pdo);
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');
    $aggService->rebuildDailyAggregate('shop1', '2026-09-15');

    $stmt = $pdo->query("SELECT COUNT(*) FROM commerce_daily_aggregates WHERE shop_id = 'shop1' AND metric_date = '2026-09-15'");
    $cnt = (int)$stmt->fetchColumn();

    $rep = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');
    echo json_encode(['row_count' => $cnt, 'gross' => $rep['financial_metrics']['order_gross_value']]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.row_count, 1, 'Duplicate rebuild must not create duplicate aggregate rows');
  assert.strictEqual(data.gross, 250000.0);
});

// =====================================================================
// SECTION 4: DATA TRUST & FAULT TOLERANCE (Tests 8, 9, 10, 21)
// =====================================================================
console.log('\n[SECTION 4] Data Trust & Fault Tolerance (Tests 8, 9, 10, 21)');

test('8. missing RMA coverage != zero', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_aftersales_service.php';
    $pdo = createTestDb();
    $aftersales = new CommerceAftersalesService($pdo);

    $cov = $aftersales->getRmaPeriodCoverage('shop1', '2026-01-01', '2026-01-31');
    echo json_encode(['status' => $cov['status'], 'is_verified' => $cov['is_verified']]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.is_verified, false, 'Unsynced period RMA coverage must NOT be verified');
  assert.strictEqual(data.status, 'NOT_SYNCED');
});

test('9. stale data remains displayable', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Seed aggregate
    $pdo->exec("INSERT INTO commerce_daily_aggregates (platform, shop_id, metric_date, order_count, order_gross_value, realized_order_value) VALUES
        ('tiktok_shop', 'shop1', '2026-09-15', 10, 1000000, 1000000)");

    // Seed sync run from 3 days ago (stale)
    $threeDaysAgo = date('Y-m-d H:i:s', time() - (3 * 86400));
    $pdo->exec("INSERT INTO commerce_sync_runs (platform, shop_id, source_domain, sync_type, status, created_at) VALUES
        ('tiktok_shop', 'shop1', 'order', 'INCREMENTAL_DELTA', 'COMPLETED', '{$threeDaysAgo}')");

    $aggService = new CommerceDailyAggregateService($pdo);
    $freshness = $aggService->getDomainFreshness('shop1');
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    echo json_encode([
        'orders_status' => $freshness['orders']['status'],
        'gross' => $report['financial_metrics']['order_gross_value']
    ]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.orders_status, 'STALE', 'Sync older than 24h must report STALE');
  assert.strictEqual(data.gross, 1000000.0, 'Stale data must still be returned and displayable');
});

test('10. sync failure preserves last valid aggregate', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Established aggregate
    $pdo->exec("INSERT INTO commerce_daily_aggregates (platform, shop_id, metric_date, order_count, order_gross_value, realized_order_value) VALUES
        ('tiktok_shop', 'shop1', '2026-09-15', 8, 800000, 800000)");

    // Simulated failed sync job
    $pdo->exec("INSERT INTO commerce_sync_jobs (platform, shop_id, status, current_domain, progress_percent) VALUES
        ('tiktok_shop', 'shop1', 'FAILED', 'order', 50.0)");

    $aggService = new CommerceDailyAggregateService($pdo);
    $report = $aggService->getAggregateReport('shop1', '2026-09-15', '2026-09-15');

    echo json_encode(['gross' => $report['financial_metrics']['order_gross_value']]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.gross, 800000.0, 'Sync failure must NOT wipe or zero existing aggregate');
});

test('21. freshness is domain-specific', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    $now = date('Y-m-d H:i:s');
    $pdo->exec("INSERT INTO commerce_sync_runs (platform, shop_id, source_domain, sync_type, status, created_at) VALUES
        ('tiktok_shop', 'shop1', 'order', 'INCREMENTAL_DELTA', 'COMPLETED', '{$now}')");

    $aggService = new CommerceDailyAggregateService($pdo);
    $freshness = $aggService->getDomainFreshness('shop1');

    echo json_encode([
        'orders_status' => $freshness['orders']['status'],
        'ads_status' => $freshness['ads']['status'],
        'finance_status' => $freshness['finance']['status']
    ]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.orders_status, 'AVAILABLE', 'Orders must be AVAILABLE');
  assert.strictEqual(data.ads_status, 'NOT_SYNCED', 'Ads must be NOT_SYNCED');
  assert.strictEqual(data.finance_status, 'NOT_SYNCED', 'Finance must be NOT_SYNCED');
});

// =====================================================================
// SECTION 5: REGRESSION BASELINE & RMA PRESERVATION (Tests 15, 16, 17, 18)
// =====================================================================
console.log('\n[SECTION 5] Regression Baseline & RMA Preservation (Tests 15, 16, 17, 18)');

test('15. runtime historical RMA regression baseline removed', () => {
  const engineCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_loss_engine.php'), 'utf8');
  const getPeriodLossFn = engineCode.split('function getPeriodLossReport')[1].split('function verifyHistoricalRmaRegressionBaseline')[0];
  assert(!getPeriodLossFn.includes('$stmtRmaBaseline'), 'Runtime getPeriodLossReport must NOT execute $stmtRmaBaseline query');
  assert(!getPeriodLossFn.includes('$rmaBaselineMatch'), 'Runtime query must not evaluate hardcoded baseline in getPeriodLossReport');
  assert(engineCode.includes('verifyHistoricalRmaRegressionBaseline'), 'Must provide verifyHistoricalRmaRegressionBaseline method for test execution');

  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_loss_engine.php';
    $pdo = createTestDb();

    // Seed 4 refund orders totaling 364800.00
    for ($i = 1; $i <= 4; $i++) {
        $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at) VALUES
            ('tiktok_shop', '7495657895504611503', 'O_{$i}', 'DELIVERED', 'DELIVERED', '2026-09-10 10:00:00')");
        $pdo->exec("INSERT INTO commerce_aftersales (platform, shop_id, aftersales_id, platform_order_id, aftersales_status, refund_amount) VALUES
            ('tiktok_shop', '7495657895504611503', 'A_{$i}', 'O_{$i}', 'SUCCESS', 91200.00)");
    }

    $lossEngine = new CommerceLossEngine($pdo);
    $baselineRes = $lossEngine->verifyHistoricalRmaRegressionBaseline('7495657895504611503');
    echo json_encode($baselineRes);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.refund_orders, 4);
  assert.strictEqual(data.total_refund_value, 364800.0);
  assert.strictEqual(data.exact_baseline_pass, true, 'Historical baseline must pass in test verification');
});

test('16. V2-05.2.3 historical RMA behavior preserved', () => {
  const orchestratorCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_sync_orchestrator.php'), 'utf8');
  assert(orchestratorCode.includes('$isHistoricalPeriod = (!empty($startDate) && empty($options[\'rolling_refresh\']) && empty($options[\'incremental\']));'), 'Must preserve Mode A historical branch');
  assert(orchestratorCode.includes('\'HISTORICAL_BACKFILL\''), 'Must preserve HISTORICAL_BACKFILL sync type');
});

test('17. explicit historical RMA still uses create_time', () => {
  const aftersalesCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_aftersales_service.php'), 'utf8');
  assert(aftersalesCode.includes('\'create_time_ge\' => $startTimestamp'), 'Historical backfill must pass create_time_ge');
  assert(aftersalesCode.includes('\'create_time_lt\' => $endTimestamp'), 'Historical backfill must pass create_time_lt');
});

test('18. rolling RMA still uses update_time', () => {
  const aftersalesCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_aftersales_service.php'), 'utf8');
  assert(aftersalesCode.includes('\'update_time_ge\' => $syncStart'), 'Incremental RMA must pass update_time_ge');
  assert(aftersalesCode.includes('\'update_time_lt\' => $syncEnd'), 'Incremental RMA must pass update_time_lt');
});

// =====================================================================
// SECTION 6: BOOTSTRAP, BOUNDS & NORMALIZED DATA (Tests 19, 20, 22)
// =====================================================================
console.log('\n[SECTION 6] Bootstrap, Bounds & Normalized Data (Tests 19, 20, 22)');

test('19. aggregate bootstrap is idempotent', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    for ($d = 1; $d <= 3; $d++) {
        $dt = sprintf('2026-09-%02d', $d);
        $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
            ('tiktok_shop', 'shop1', 'O_{$d}', 'DELIVERED', 'DELIVERED', '{$dt} 10:00:00', 100000.00)");
    }

    $aggService = new CommerceDailyAggregateService($pdo);
    // Run twice
    $aggService->rebuildDateRange('shop1', '2026-09-01', '2026-09-03');
    $aggService->rebuildDateRange('shop1', '2026-09-01', '2026-09-03');

    $stmt = $pdo->query("SELECT COUNT(*) FROM commerce_daily_aggregates WHERE shop_id = 'shop1'");
    $cnt = (int)$stmt->fetchColumn();
    $report = $aggService->getAggregateReport('shop1', '2026-09-01', '2026-09-03');

    echo json_encode([
        'rows_in_table' => $cnt,
        'total_gross' => $report['financial_metrics']['order_gross_value']
    ]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.strictEqual(data.rows_in_table, 3, 'Must have exactly 3 rows in table for 3 dates');
  assert.strictEqual(data.total_gross, 300000.0, 'Total gross must remain 300,000 without duplication');
});

test('20. aggregate rebuild is bounded', () => {
  const php = `
    ${SQLITE_SCHEMA_BOOTSTRAP}
    require_once 'public/api/commerce_daily_aggregate_service.php';
    $pdo = createTestDb();

    // Day 1, 2, 3 orders
    $pdo->exec("INSERT INTO commerce_orders (platform, shop_id, platform_order_id, order_status, platform_status, platform_created_at, order_gross_amount) VALUES
        ('tiktok_shop', 'shop1', 'O1', 'DELIVERED', 'DELIVERED', '2026-09-01 10:00:00', 100000.00),
        ('tiktok_shop', 'shop1', 'O2', 'DELIVERED', 'DELIVERED', '2026-09-02 10:00:00', 100000.00),
        ('tiktok_shop', 'shop1', 'O3', 'DELIVERED', 'DELIVERED', '2026-09-03 10:00:00', 100000.00)");

    $aggService = new CommerceDailyAggregateService($pdo);
    // Only rebuild Day 1 to Day 2
    $aggService->rebuildDateRange('shop1', '2026-09-01', '2026-09-02');

    $stmt = $pdo->query("SELECT metric_date FROM commerce_daily_aggregates WHERE shop_id = 'shop1' ORDER BY metric_date ASC");
    $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode(['rebuilt_dates' => $dates]);
  `;
  const res = runPhpCode(php);
  assert(res.success, `PHP failed: ${res.output}`);
  const data = JSON.parse(res.output);
  assert.deepStrictEqual(data.rebuilt_dates, ['2026-09-01', '2026-09-02'], 'Must strictly limit rebuild to bounded range');
});

test('22. detailed Orders endpoint still reads normalized data', () => {
  const dashboardCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_dashboard.php'), 'utf8');
  assert(dashboardCode.includes('FROM `commerce_orders` o'), 'Detailed orders action must read directly from normalized commerce_orders');
  assert(dashboardCode.includes('buildCommerceOrdersWhere'), 'Must use normalized where builder');
});

console.log('\n====================================================================');
console.log(`  SPRINT V2-06 TEST RESULTS: ${passedTests}/${totalTests} PASS (${Math.round(passedTests / totalTests * 100)}%)`);
console.log('====================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
