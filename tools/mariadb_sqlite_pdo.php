<?php
/**
 * ====================================================================
 * MariaDbSqlitePDO - High-Fidelity Test PDO for PHP 8.2 SQLite
 * File: tools/mariadb_sqlite_pdo.php
 * Target: Allows real PHP 8.2 execution testing of MariaDB queries,
 *         transactions, rollbacks, and prepared statements on local dev.
 * ====================================================================
 */

declare(strict_types=1);

class MariaDbSqlitePDO extends PDO {
    public function __construct(string $dsn = 'sqlite::memory:', ?string $username = null, ?string $password = null, ?array $options = null) {
        $defaultOptions = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        $mergedOptions = array_replace($defaultOptions, $options ?? []);
        parent::__construct($dsn, $username, $password, $mergedOptions);

        $this->registerMariaDbFunctions();
        $this->initializeSchema();
    }

    private function registerMariaDbFunctions(): void {
        $this->sqliteCreateFunction('NOW', function() {
            return date('Y-m-d H:i:s');
        });

        $this->sqliteCreateFunction('FROM_UNIXTIME', function($ts) {
            if ($ts === null || $ts === '') return null;
            return date('Y-m-d H:i:s', (int)$ts);
        });

        $this->sqliteCreateFunction('UNIX_TIMESTAMP', function($dt = null) {
            if ($dt === null) return time();
            return strtotime((string)$dt);
        });

        $this->sqliteCreateFunction('IF', function($condition, $trueVal, $falseVal) {
            return $condition ? $trueVal : $falseVal;
        });

        $this->sqliteCreateFunction('IFNULL', function($a, $b) {
            return $a !== null ? $a : $b;
        });

        $this->sqliteCreateFunction('GET_LOCK', function($name, $timeout) {
            return 1;
        });

        $this->sqliteCreateFunction('RELEASE_LOCK', function($name) {
            return 1;
        });

        $this->sqliteCreateFunction('IS_FREE_LOCK', function($name) {
            return 1;
        });
    }

    private function initializeSchema(): void {
        // Table 1: commerce_webhook_events
        $this->exec("CREATE TABLE IF NOT EXISTS `commerce_webhook_events` (
            `id` INTEGER PRIMARY KEY AUTOINCREMENT,
            `platform` TEXT NOT NULL DEFAULT 'tiktok_shop',
            `shop_id` TEXT NOT NULL,
            `event_id` TEXT NOT NULL,
            `event_type` TEXT NOT NULL,
            `payload_hash` TEXT NOT NULL,
            `raw_payload` TEXT NOT NULL,
            `status` TEXT NOT NULL DEFAULT 'PENDING',
            `error_message` TEXT NULL DEFAULT NULL,
            `attempt_count` INTEGER NOT NULL DEFAULT 0,
            `event_timestamp` DATETIME NULL DEFAULT NULL,
            `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `processed_at` DATETIME NULL DEFAULT NULL,
            UNIQUE (`platform`, `shop_id`, `event_id`)
        )");

        // Table 2: commerce_orders
        $this->exec("CREATE TABLE IF NOT EXISTS `commerce_orders` (
            `id` INTEGER PRIMARY KEY AUTOINCREMENT,
            `platform` TEXT NOT NULL DEFAULT 'tiktok_shop',
            `shop_id` TEXT NOT NULL,
            `platform_order_id` TEXT NOT NULL,
            `order_status` TEXT NOT NULL,
            `platform_status` TEXT NULL,
            `platform_created_at` DATETIME NULL,
            `platform_updated_at` DATETIME NULL,
            `paid_at` DATETIME NULL,
            `currency` TEXT NOT NULL DEFAULT 'VND',
            `order_gross_amount` REAL NOT NULL DEFAULT 0.00,
            `sub_total` REAL NOT NULL DEFAULT 0.00,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (`platform`, `shop_id`, `platform_order_id`)
        )");

        // Table 3: commerce_order_items
        $this->exec("CREATE TABLE IF NOT EXISTS `commerce_order_items` (
            `id` INTEGER PRIMARY KEY AUTOINCREMENT,
            `platform` TEXT NOT NULL DEFAULT 'tiktok_shop',
            `shop_id` TEXT NOT NULL,
            `platform_order_id` TEXT NOT NULL,
            `platform_item_id` TEXT NOT NULL,
            `product_id` TEXT NOT NULL,
            `product_name` TEXT NULL,
            `sku_id` TEXT NULL,
            `sku_name` TEXT NULL,
            `quantity` INTEGER NOT NULL DEFAULT 1,
            `unit_price` REAL NOT NULL DEFAULT 0.00,
            `item_subtotal` REAL NOT NULL DEFAULT 0.00,
            `seller_discount` REAL NOT NULL DEFAULT 0.00,
            `platform_discount` REAL NOT NULL DEFAULT 0.00,
            `sku_image_url` TEXT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (`platform`, `shop_id`, `platform_order_id`, `platform_item_id`)
        )");

        // Table 4: commerce_aftersales
        $this->exec("CREATE TABLE IF NOT EXISTS `commerce_aftersales` (
            `id` INTEGER PRIMARY KEY AUTOINCREMENT,
            `platform` TEXT NOT NULL DEFAULT 'tiktok_shop',
            `shop_id` TEXT NOT NULL,
            `aftersales_id` TEXT NOT NULL,
            `platform_order_id` TEXT NOT NULL,
            `aftersales_type` TEXT NOT NULL DEFAULT 'RETURN_AND_REFUND',
            `platform_aftersales_type` TEXT NULL,
            `aftersales_status` TEXT NOT NULL DEFAULT 'REQUESTED',
            `platform_status` TEXT NULL,
            `refund_amount` REAL NOT NULL DEFAULT 0.00,
            `currency` TEXT NOT NULL DEFAULT 'VND',
            `reason_category` TEXT NULL,
            `request_created_at` DATETIME NULL,
            `platform_updated_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (`platform`, `shop_id`, `aftersales_id`)
        )");

        // Table 5: commerce_loss_ledger
        $this->exec("CREATE TABLE IF NOT EXISTS `commerce_loss_ledger` (
            `id` INTEGER PRIMARY KEY AUTOINCREMENT,
            `platform` TEXT NOT NULL DEFAULT 'tiktok_shop',
            `shop_id` TEXT NOT NULL,
            `platform_order_id` TEXT NOT NULL,
            `order_item_id` TEXT NULL,
            `source_type` TEXT NOT NULL,
            `source_id` TEXT NOT NULL,
            `perspective` TEXT NOT NULL DEFAULT 'FINANCIAL',
            `loss_category` TEXT NOT NULL,
            `loss_amount` REAL NOT NULL DEFAULT 0.00,
            `currency` TEXT NOT NULL DEFAULT 'VND',
            `effective_at` DATETIME NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (`platform`, `shop_id`, `source_type`, `source_id`, `perspective`)
        )");

        // Table 6: commerce_sync_jobs
        $this->exec("CREATE TABLE IF NOT EXISTS `commerce_sync_jobs` (
            `id` INTEGER PRIMARY KEY AUTOINCREMENT,
            `platform` TEXT NOT NULL DEFAULT 'tiktok_shop',
            `shop_id` TEXT NOT NULL,
            `requested_start_date` DATE NOT NULL,
            `requested_end_date` DATE NOT NULL,
            `status` TEXT NOT NULL DEFAULT 'QUEUED',
            `current_domain` TEXT NULL,
            `progress_percent` REAL NOT NULL DEFAULT 0.00,
            `checkpoint_data` TEXT NULL,
            `started_at` DATETIME NULL,
            `heartbeat_at` DATETIME NULL,
            `completed_at` DATETIME NULL,
            `created_by` TEXT NOT NULL DEFAULT 'system',
            `error_code` TEXT NULL,
            `error_message` TEXT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )");

        // Table 7: commerce_daily_aggregate_queue
        $this->exec("CREATE TABLE IF NOT EXISTS `commerce_daily_aggregate_queue` (
            `id` INTEGER PRIMARY KEY AUTOINCREMENT,
            `shop_id` TEXT NOT NULL,
            `target_date` DATE NOT NULL,
            `reason` TEXT NOT NULL,
            `status` TEXT NOT NULL DEFAULT 'PENDING',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (`shop_id`, `target_date`)
        )");

        // Table 8: tiktok_video_ads
        $this->exec("CREATE TABLE IF NOT EXISTS `tiktok_video_ads` (
            `id` INTEGER PRIMARY KEY AUTOINCREMENT,
            `campaign_id` TEXT NOT NULL,
            `ad_id` TEXT NOT NULL,
            `item_id` TEXT NOT NULL,
            `video_name` TEXT NULL,
            `spend` REAL NOT NULL DEFAULT 0,
            `cost_per_order` REAL NOT NULL DEFAULT 0
        )");
    }

    #[\ReturnTypeWillChange]
    public function prepare(string $query, array $options = []): PDOStatement {
        $transformedQuery = $this->transformMariaDbSqlToSqlite($query);
        return parent::prepare($transformedQuery, $options);
    }

    #[\ReturnTypeWillChange]
    public function exec(string $statement): int|false {
        $transformedQuery = $this->transformMariaDbSqlToSqlite($statement);
        return parent::exec($transformedQuery);
    }

    #[\ReturnTypeWillChange]
    public function query(string $query, ?int $mode = null, mixed ...$args): PDOStatement|false {
        $transformedQuery = $this->transformMariaDbSqlToSqlite($query);
        return parent::query($transformedQuery, ...$args);
    }

    private function transformMariaDbSqlToSqlite(string $sql): string {
        $q = $sql;

        // Transform 1: commerce_webhook_events ON DUPLICATE KEY UPDATE
        if (stripos($q, 'commerce_webhook_events') !== false && stripos($q, 'ON DUPLICATE KEY UPDATE') !== false) {
            $q = preg_replace(
                '/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+attempt_count\s*=\s*attempt_count\s*\+\s*1,\s*error_message\s*=\s*NULL/i',
                'ON CONFLICT(platform, shop_id, event_id) DO UPDATE SET attempt_count = commerce_webhook_events.attempt_count + 1, error_message = NULL',
                $q
            );
        }

        // Transform 2: commerce_aftersales ON DUPLICATE KEY UPDATE
        if (stripos($q, 'commerce_aftersales') !== false && stripos($q, 'ON DUPLICATE KEY UPDATE') !== false) {
            $q = preg_replace(
                '/ON\s+DUPLICATE\s+KEY\s+UPDATE[\s\S]+$/i',
                'ON CONFLICT(platform, shop_id, aftersales_id) DO UPDATE SET aftersales_status = excluded.aftersales_status, platform_status = excluded.platform_status, refund_amount = CASE WHEN excluded.refund_amount > 0 THEN excluded.refund_amount ELSE commerce_aftersales.refund_amount END, platform_updated_at = datetime(\'now\'), updated_at = datetime(\'now\')',
                $q
            );
        }

        // Transform 3: commerce_daily_aggregate_queue ON DUPLICATE KEY UPDATE
        if (stripos($q, 'commerce_daily_aggregate_queue') !== false && stripos($q, 'ON DUPLICATE KEY UPDATE') !== false) {
            $q = preg_replace(
                '/ON\s+DUPLICATE\s+KEY\s+UPDATE[\s\S]+$/i',
                'ON CONFLICT(shop_id, target_date) DO UPDATE SET reason = excluded.reason',
                $q
            );
        }

        // Transform 4: SHOW TABLES LIKE '...'
        if (preg_match("/SHOW\s+TABLES\s+LIKE\s+'([^']+)'/i", $q, $m)) {
            $tableName = $m[1];
            return "SELECT name FROM sqlite_master WHERE type='table' AND name='{$tableName}'";
        }

        return $q;
    }
}
