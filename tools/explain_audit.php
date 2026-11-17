<?php
$pdo = new PDO('sqlite::memory:');

// Setup tables replicating current production schema
$pdo->exec("
CREATE TABLE commerce_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    platform_order_id TEXT NOT NULL,
    order_status TEXT NOT NULL,
    platform_created_at TEXT,
    platform_updated_at TEXT,
    order_gross_amount REAL DEFAULT 0.00
);
CREATE UNIQUE INDEX uq_platform_shop_order ON commerce_orders (platform, shop_id, platform_order_id);
CREATE INDEX idx_shop_status ON commerce_orders (shop_id, order_status);
CREATE INDEX idx_platform_created ON commerce_orders (platform_created_at);
CREATE INDEX idx_platform_updated ON commerce_orders (platform_updated_at);

CREATE TABLE commerce_loss_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    platform_order_id TEXT NOT NULL,
    loss_type TEXT NOT NULL,
    loss_amount REAL DEFAULT 0.00,
    perspective TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    effective_at TEXT
);
CREATE UNIQUE INDEX uq_loss_ledger_idempotency ON commerce_loss_ledger (platform, shop_id, perspective, platform_order_id, loss_type, source_entity_id);
CREATE INDEX idx_order_perspective ON commerce_loss_ledger (platform, shop_id, platform_order_id, perspective);
CREATE INDEX idx_loss_type ON commerce_loss_ledger (shop_id, loss_type);
CREATE INDEX idx_effective_at ON commerce_loss_ledger (effective_at);

CREATE TABLE commerce_aftersales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    aftersales_id TEXT NOT NULL,
    platform_order_id TEXT NOT NULL,
    aftersales_status TEXT NOT NULL,
    refund_amount REAL DEFAULT 0.00,
    request_created_at TEXT,
    refund_completed_at TEXT
);
CREATE UNIQUE INDEX uq_platform_shop_aftersales ON commerce_aftersales (platform, shop_id, aftersales_id);
CREATE INDEX idx_platform_order_id ON commerce_aftersales (platform, shop_id, platform_order_id);
CREATE INDEX idx_shop_status_aftersales ON commerce_aftersales (shop_id, aftersales_status);
CREATE INDEX idx_request_created ON commerce_aftersales (request_created_at);
CREATE INDEX idx_refund_completed ON commerce_aftersales (refund_completed_at);

CREATE TABLE commerce_finance_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    platform_order_id TEXT NOT NULL,
    platform_line_item_id TEXT,
    transaction_type TEXT NOT NULL,
    total_platform_commission REAL DEFAULT 0.00,
    transaction_time TEXT,
    settlement_time TEXT
);
CREATE UNIQUE INDEX uniq_tx ON commerce_finance_transactions (platform, shop_id, platform_order_id, platform_line_item_id, transaction_type);
CREATE INDEX idx_shop_order ON commerce_finance_transactions (shop_id, platform_order_id);
CREATE INDEX idx_tx_time ON commerce_finance_transactions (transaction_time);
CREATE INDEX idx_settlement_time ON commerce_finance_transactions (settlement_time);

CREATE TABLE commerce_finance_statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    statement_id TEXT NOT NULL,
    statement_time TEXT NOT NULL,
    total_settlement_amount REAL DEFAULT 0.00
);
CREATE UNIQUE INDEX uniq_shop_statement ON commerce_finance_statements (platform, shop_id, statement_id);
CREATE INDEX idx_shop_stmt_time ON commerce_finance_statements (shop_id, statement_time);
");

echo "=== AUDIT 1: commerce_orders ===\n";
$q1 = "SELECT COUNT(DISTINCT platform_order_id), SUM(order_gross_amount) FROM commerce_orders WHERE platform = 'tiktok_shop' AND shop_id = '7495657895504611503' AND platform_created_at >= '2026-09-01 00:00:00' AND platform_created_at <= '2026-09-30 23:59:59'";
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q1);
echo "BEFORE:\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n";

$pdo->exec("CREATE INDEX idx_orders_plat_shop_created ON commerce_orders (platform, shop_id, platform_created_at);");
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q1);
echo "AFTER (with idx_orders_plat_shop_created):\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n\n";

echo "=== AUDIT 2: commerce_loss_ledger JOIN commerce_orders ===\n";
$q2 = "SELECT l.loss_type, COUNT(DISTINCT l.platform_order_id) as impacted_orders, SUM(l.loss_amount) as total_loss
       FROM commerce_loss_ledger l
       INNER JOIN commerce_orders o ON l.platform_order_id = o.platform_order_id AND l.shop_id = o.shop_id
       WHERE l.platform = 'tiktok_shop' AND l.shop_id = '7495657895504611503' AND l.perspective = 'MATURED_LIFECYCLE'
         AND o.platform_created_at >= '2026-09-01 00:00:00' AND o.platform_created_at <= '2026-09-30 23:59:59'
       GROUP BY l.loss_type";
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q2);
echo "BEFORE:\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n";

$pdo->exec("CREATE INDEX idx_loss_plat_shop_persp ON commerce_loss_ledger (platform, shop_id, perspective, platform_order_id);");
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q2);
echo "AFTER (with idx_loss_plat_shop_persp):\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n\n";

echo "=== AUDIT 3: commerce_aftersales JOIN commerce_orders ===\n";
$q3 = "SELECT COUNT(DISTINCT a.platform_order_id) as refund_orders, SUM(a.refund_amount) as total_refund
       FROM commerce_aftersales a
       INNER JOIN commerce_orders o ON a.platform_order_id = o.platform_order_id AND a.shop_id = o.shop_id
       WHERE a.platform = 'tiktok_shop' AND a.shop_id = '7495657895504611503' AND a.aftersales_status = 'SUCCESS'
         AND o.platform_created_at >= '2026-09-01 00:00:00' AND o.platform_created_at <= '2026-09-30 23:59:59'";
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q3);
echo "BEFORE:\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n";

$pdo->exec("CREATE INDEX idx_aftersales_plat_shop_status ON commerce_aftersales (platform, shop_id, aftersales_status, platform_order_id);");
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q3);
echo "AFTER (with idx_aftersales_plat_shop_status):\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n\n";

echo "=== AUDIT 4: commerce_finance_transactions ===\n";
$q4 = "SELECT COUNT(DISTINCT platform_order_id), SUM(total_platform_commission)
       FROM commerce_finance_transactions
       WHERE platform = 'tiktok_shop' AND shop_id = '7495657895504611503'
         AND transaction_time >= '2026-09-01 00:00:00' AND transaction_time <= '2026-09-30 23:59:59'";
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q4);
echo "BEFORE:\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n";

$pdo->exec("CREATE INDEX idx_tx_plat_shop_time ON commerce_finance_transactions (platform, shop_id, transaction_time);");
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q4);
echo "AFTER (with idx_tx_plat_shop_time):\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n\n";

echo "=== AUDIT 5: commerce_finance_statements ===\n";
$q5 = "SELECT COUNT(DISTINCT statement_id), SUM(total_settlement_amount)
       FROM commerce_finance_statements
       WHERE platform = 'tiktok_shop' AND shop_id = '7495657895504611503'
         AND statement_time >= '2026-09-01 00:00:00' AND statement_time <= '2026-09-30 23:59:59'";
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q5);
echo "BEFORE:\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n";

$pdo->exec("CREATE INDEX idx_stmt_plat_shop_time ON commerce_finance_statements (platform, shop_id, statement_time);");
$stmt = $pdo->query("EXPLAIN QUERY PLAN " . $q5);
echo "AFTER (with idx_stmt_plat_shop_time):\n" . json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT) . "\n\n";
