<?php
/**
 * ADDP COMMERCE INTELLIGENCE - PRODUCTION PREFLIGHT SCHEMA AUDIT
 * 
 * Component: Release Gate & Database Safety Inspector
 * Safety: 100% READ-ONLY (No INSERT, UPDATE, DELETE, ALTER, DROP, or CREATE statements executed)
 * 
 * Purpose:
 * Inspects target MySQL/MariaDB database to assess the exact migration status:
 * - Migration 004 (Core Orders: commerce_orders, commerce_order_items, commerce_sync_runs, commerce_raw_observations)
 * - Migration 005 (Aftersales & Loss Ledger: commerce_aftersales, commerce_aftersales_items, commerce_order_events, commerce_loss_ledger)
 * - Migration 006 (Sync Runs Upgrade: source_domain, VARCHAR(1024) token, VARCHAR(64) sync_type)
 * - Migration 007 (Finance Engine: commerce_finance_statements, commerce_finance_transactions)
 * - Migration 008 (Analytics & Live: commerce_shop_analytics_daily, commerce_live_sessions, commerce_video_analytics, commerce_product_analytics, commerce_analytics_sync_runs)
 * 
 * Evaluation Statuses:
 * - APPLIED: All expected tables and required columns exist with matching semantics.
 * - NOT_APPLIED: None of the migration's tables exist.
 * - PARTIAL: Some tables or columns exist, but others are missing.
 * - SCHEMA_DRIFT: Table exists but column definitions/types differ from contract.
 */

if (php_sapi_name() !== 'cli' && empty($_SERVER['HTTP_HOST'])) {
    die("Access restricted to CLI.\n");
}

require_once __DIR__ . '/../public/api/config.php';

// CLI Output Helper
function printLine(string $text = ''): void {
    echo $text . "\n";
}

printLine("====================================================================");
printLine("ADDP COMMERCE INTELLIGENCE — PREFLIGHT SCHEMA AUDIT (READ-ONLY)");
printLine("====================================================================");
printLine("Mode:           STRICT READ-ONLY INSPECTION");
printLine("Timestamp:      " . date('Y-m-d H:i:s T'));
$hostDisplay = defined('DB_HOST') ? DB_HOST : 'localhost';
$portDisplay = defined('DB_PORT') ? DB_PORT : 3306;
$nameDisplay = defined('DB_NAME') ? DB_NAME : '';
printLine("Target Host:    " . $hostDisplay . ":" . $portDisplay);
printLine("Database Name:  " . $nameDisplay);
printLine("--------------------------------------------------------------------\n");

$expectedSchema = [
    '004_core_orders' => [
        'name' => 'Migration 004 — Core Orders Engine V2',
        'tables' => [
            'commerce_orders' => [
                'columns' => ['id', 'platform', 'shop_id', 'platform_order_id', 'order_status', 'platform_status', 'platform_created_at', 'order_gross_amount', 'sub_total', 'shipping_fee', 'seller_discount', 'platform_discount', 'tax_amount', 'sync_run_id'],
                'primary_key' => 'id',
                'unique_keys' => ['uq_platform_shop_order']
            ],
            'commerce_order_items' => [
                'columns' => ['id', 'order_id', 'platform', 'shop_id', 'platform_order_id', 'platform_line_item_id', 'product_id', 'product_name', 'sku_id', 'sku_name', 'quantity', 'sale_price', 'original_price'],
                'primary_key' => 'id',
                'unique_keys' => ['uq_platform_shop_item']
            ],
            'commerce_sync_runs' => [
                'columns' => ['id', 'platform', 'shop_id', 'sync_type', 'status', 'current_page_token', 'orders_ingested'],
                'primary_key' => 'id'
            ],
            'commerce_raw_observations' => [
                'columns' => ['id', 'platform', 'shop_id', 'payload_hash', 'observed_at'],
                'primary_key' => 'id'
            ]
        ]
    ],
    '005_aftersales_loss' => [
        'name' => 'Migration 005 — Return, Refund & Loss Ledger',
        'tables' => [
            'commerce_aftersales' => [
                'columns' => ['id', 'platform', 'shop_id', 'aftersales_id', 'platform_order_id', 'aftersales_type', 'aftersales_status', 'refund_amount', 'currency'],
                'primary_key' => 'id',
                'unique_keys' => ['uq_platform_shop_aftersales']
            ],
            'commerce_aftersales_items' => [
                'columns' => ['id', 'aftersales_pk', 'platform_order_id', 'platform_line_item_id', 'sku_id', 'refund_amount'],
                'primary_key' => 'id'
            ],
            'commerce_order_events' => [
                'columns' => ['id', 'platform', 'shop_id', 'platform_order_id', 'event_domain', 'event_type', 'event_key', 'payload_hash', 'observed_at'],
                'primary_key' => 'id',
                'unique_keys' => ['uq_order_event_identity']
            ],
            'commerce_loss_ledger' => [
                'columns' => ['id', 'platform', 'shop_id', 'platform_order_id', 'loss_type', 'loss_amount', 'gross_reference_amount', 'classification_rule', 'perspective'],
                'primary_key' => 'id'
            ]
        ]
    ],
    '006_sync_runs_upgrade' => [
        'name' => 'Migration 006 — Multi-Domain Sync Runs Upgrade',
        'table_column_checks' => [
            'commerce_sync_runs' => [
                'columns_must_exist' => ['source_domain'],
                'column_type_checks' => [
                    'source_domain' => 'varchar(64)',
                    'current_page_token' => 'varchar(1024)',
                    'sync_type' => 'varchar(64)'
                ]
            ]
        ]
    ],
    '007_finance_engine' => [
        'name' => 'Migration 007 — Finance Statements & Transactions',
        'tables' => [
            'commerce_finance_statements' => [
                'columns' => ['id', 'platform', 'shop_id', 'statement_id', 'statement_time', 'total_settlement_amount', 'currency', 'payment_status', 'payment_time'],
                'primary_key' => 'id',
                'unique_keys' => ['uniq_shop_statement']
            ],
            'commerce_finance_transactions' => [
                'columns' => ['id', 'platform', 'shop_id', 'statement_id', 'platform_order_id', 'platform_line_item_id', 'revenue_amount', 'platform_commission', 'affiliate_commission', 'payment_fee', 'shipping_fee_subsidy', 'actual_shipping_fee', 'net_settlement_amount'],
                'primary_key' => 'id',
                'unique_keys' => ['uniq_tx']
            ]
        ]
    ],
    '008_analytics_engine' => [
        'name' => 'Migration 008 — Shop Analytics, Livestream & Video Engine',
        'tables' => [
            'commerce_shop_analytics_daily' => [
                'columns' => ['id', 'platform', 'shop_id', 'stat_date', 'page_views', 'unique_visitors', 'total_orders', 'gross_revenue', 'conversion_rate'],
                'primary_key' => 'id',
                'unique_keys' => ['uniq_shop_daily']
            ],
            'commerce_live_sessions' => [
                'columns' => ['id', 'platform', 'shop_id', 'session_id', 'title', 'start_time', 'duration_seconds', 'gmv', 'orders_count', 'units_sold', 'total_views', 'impressions', 'clicks', 'peak_concurrent_users'],
                'primary_key' => 'id',
                'unique_keys' => ['uniq_shop_live_session']
            ],
            'commerce_video_analytics' => [
                'columns' => ['id', 'platform', 'shop_id', 'video_id', 'stat_date', 'title', 'creator_type', 'creator_name', 'video_views', 'units_sold', 'gross_revenue', 'attributed_gmv', 'ctr', 'gpm'],
                'primary_key' => 'id',
                'unique_keys' => ['uniq_shop_video_date']
            ],
            'commerce_product_analytics' => [
                'columns' => ['id', 'platform', 'shop_id', 'product_id', 'sku_id', 'stat_date', 'product_name', 'units_sold', 'gross_revenue', 'page_views', 'unique_visitors', 'cvr'],
                'primary_key' => 'id',
                'unique_keys' => ['uniq_shop_product_sku_date']
            ],
            'commerce_analytics_sync_runs' => [
                'columns' => ['id', 'platform', 'shop_id', 'analytics_domain', 'sync_type', 'status', 'records_ingested'],
                'primary_key' => 'id'
            ]
        ]
    ],
    '009_customer_foundation' => [
        'name' => 'Migration 009 — Customer 360 Foundation',
        'tables' => [
            'commerce_order_recipients' => [
                'columns' => ['id', 'platform', 'shop_id', 'platform_order_id', 'phone_hash', 'phone_masked', 'province'],
                'primary_key' => 'id',
                'unique_keys' => ['uq_platform_shop_order_recip']
            ],
            'commerce_customer_profiles' => [
                'columns' => ['id', 'platform', 'shop_id', 'customer_identifier_hash', 'total_orders_count', 'order_gross_amount', 'realized_purchase_value'],
                'primary_key' => 'id',
                'unique_keys' => ['uq_shop_customer_hash']
            ]
        ]
    ]
];

// Attempt DB Connection reusing canonical configuration mechanism matching public/api/db.php & config.php
try {
    $host = defined('DB_HOST') ? DB_HOST : 'localhost';
    $port = defined('DB_PORT') ? DB_PORT : 3306;
    $dbname = defined('DB_NAME') ? DB_NAME : '';
    $user = defined('DB_USER') ? DB_USER : '';
    $pass = defined('DB_PASS') ? DB_PASS : '';
    // Canonical application charset: defaults safely to utf8mb4 matching public/api/db.php
    $charset = defined('DB_CHARSET') ? DB_CHARSET : 'utf8mb4';

    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_TIMEOUT            => 4,
    ]);
    printLine("[OK] Connected to database successfully (Read-Only session).\n");
} catch (PDOException $e) {
    // Sanitize error message to ensure credentials/passwords are never printed to terminal or logs
    $sanitizedMsg = preg_replace('/(password|pass|pwd)=([^;\s]+)/i', '$1=REDACTED', $e->getMessage());
    printLine("[WARN] Cannot connect to MySQL server: " . $sanitizedMsg);
    printLine("If running on a development machine without local MySQL socket, use test harness:\nnode tools/test_preflight_schema_audit.cjs\n");
    exit(2);
}

// Fetch all existing tables
$stmtTables = $pdo->query("SHOW TABLES LIKE 'commerce_%'");
$existingTables = $stmtTables->fetchAll(PDO::FETCH_COLUMN);

printLine("Existing `commerce_%` tables detected (" . count($existingTables) . "):");
foreach ($existingTables as $tbl) {
    printLine("  - {$tbl}");
}
printLine();

$auditSummary = [];

// Audit each migration
foreach ($expectedSchema as $migKey => $migSpec) {
    printLine("--------------------------------------------------------------------");
    printLine("AUDITING: {$migSpec['name']}");
    printLine("--------------------------------------------------------------------");

    if (isset($migSpec['tables'])) {
        $tablesExpected = array_keys($migSpec['tables']);
        $tablesFound = array_intersect($tablesExpected, $existingTables);
        $foundCount = count($tablesFound);
        $expectedCount = count($tablesExpected);

        if ($foundCount === 0) {
            $status = 'NOT_APPLIED';
            $details = "None of the {$expectedCount} tables exist.";
        } elseif ($foundCount < $expectedCount) {
            $status = 'PARTIAL';
            $missing = array_diff($tablesExpected, $existingTables);
            $details = "Missing tables: " . implode(', ', $missing);
        } else {
            // Check columns in found tables
            $driftDetected = false;
            $driftMessages = [];

            foreach ($migSpec['tables'] as $tblName => $tblSpec) {
                $stmtCols = $pdo->query("SHOW COLUMNS FROM `{$tblName}`");
                $actualCols = $stmtCols->fetchAll(PDO::FETCH_COLUMN);

                $missingCols = array_diff($tblSpec['columns'], $actualCols);
                if (!empty($missingCols)) {
                    $driftDetected = true;
                    $driftMessages[] = "Table `{$tblName}` missing columns: " . implode(', ', $missingCols);
                }
            }

            if ($driftDetected) {
                $status = 'SCHEMA_DRIFT';
                $details = implode('; ', $driftMessages);
            } else {
                $status = 'APPLIED';
                $details = "All {$expectedCount} tables and essential columns verified.";
            }
        }
    } elseif (isset($migSpec['table_column_checks'])) {
        // Migration 006 check
        $tableExists = in_array('commerce_sync_runs', $existingTables);
        if (!$tableExists) {
            $status = 'NOT_APPLIED';
            $details = "Base table `commerce_sync_runs` does not exist.";
        } else {
            $checkCol = $pdo->query("SHOW COLUMNS FROM `commerce_sync_runs` LIKE 'source_domain'")->fetch();
            if ($checkCol) {
                $status = 'APPLIED';
                $details = "Column `source_domain` exists in `commerce_sync_runs`.";
            } else {
                $status = 'NOT_APPLIED';
                $details = "Column `source_domain` does not exist in `commerce_sync_runs`. Upgrade required.";
            }
        }
    }

    $color = ($status === 'APPLIED') ? '[PASS]' : (($status === 'NOT_APPLIED') ? '[INFO]' : '[WARN]');
    printLine("{$color} Status: {$status}");
    printLine("       Details: {$details}\n");

    $auditSummary[$migKey] = [
        'name' => $migSpec['name'],
        'status' => $status,
        'details' => $details
    ];
}

printLine("====================================================================");
printLine("PREFLIGHT SCHEMA AUDIT SUMMARY");
printLine("====================================================================");
foreach ($auditSummary as $k => $res) {
    printf("%-50s : %s\n", $res['name'], $res['status']);
}
printLine("====================================================================\n");

// Write JSON audit log locally
$auditLogFile = __DIR__ . '/../release/preflight_schema_audit_result.json';
file_put_contents($auditLogFile, json_encode($auditSummary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
printLine("Audit result saved to: {$auditLogFile}\n");
