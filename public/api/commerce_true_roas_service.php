<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - MODULE 4 (KT-VH)
 * TRUE ROAS NET PROFIT RECONCILIATION & < 3-DAY INVENTORY SAFETY ALERT
 *
 * File: public/api/commerce_true_roas_service.php
 *
 * Responsibilities:
 * 1. True ROAS & Net Profit Engine (Zero Mock Data):
 *    - Aggregates per-day and per-SKU from normalized tables:
 *      commerce_orders, commerce_order_items, commerce_product_costs,
 *      commerce_affiliate_orders, commerce_loss_ledger,
 *      commerce_ads_campaign_daily, commerce_ads_product_daily,
 *      commerce_finance_statements, commerce_finance_transactions.
 *    - Computes Ads ROAS = Gross GMV / Ads Spend
 *    - Computes True ROAS = Net GMV / (Ads Spend + Affiliate Cost + Platform Fees + Loss/RMA)
 *    - Computes Net Contribution Profit & Net Profit Margin %
 *    - Flags reconciliation status (variance > 0.5% vs wallet settlement,
 *      or INSUFFICIENT_DATA when COGS is missing).
 * 2. < 3-Day Inventory Safety Alert (SOP KT-VH Task 3):
 *    - Calculates 7-day and 14-day average daily units sold per SKU.
 *    - Compares against current stock (commerce_sku_inventory / catalog)
 *      to compute days_of_cover and flag < 3 days as CRITICAL before Ads run.
 * ====================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/commerce_product_cost_service.php';

class CommerceTrueRoasService {
    public const PLATFORM_TIKTOK_SHOP = 'tiktok_shop';
    public const RECONCILIATION_VARIANCE_THRESHOLD_PCT = 0.5;
    public const CRITICAL_DAYS_OF_COVER = 3.0;
    public const WARNING_DAYS_OF_COVER = 7.0;

    private PDO $db;
    private ?string $driver = null;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? getDBConnection();
    }

    private function getDriver(): string {
        if ($this->driver === null) {
            try {
                $this->driver = (string)$this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
            } catch (\Throwable $t) {
                $this->driver = 'mysql';
            }
        }
        return $this->driver;
    }

    private function tableExists(string $tableName): bool {
        try {
            if ($this->getDriver() === 'sqlite') {
                $stmt = $this->db->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
                $stmt->execute([$tableName]);
                return (bool)$stmt->fetchColumn();
            }
            $stmt = $this->db->query("SHOW TABLES LIKE " . $this->db->quote($tableName));
            return (bool)$stmt->fetchColumn();
        } catch (\Throwable $t) {
            return false;
        }
    }

    private function columnExists(string $tableName, string $columnName): bool {
        if (!$this->tableExists($tableName)) {
            return false;
        }
        try {
            if ($this->getDriver() === 'sqlite') {
                $stmt = $this->db->query("PRAGMA table_info(`{$tableName}`)");
                $cols = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
                foreach ($cols as $col) {
                    if (($col['name'] ?? '') === $columnName) {
                        return true;
                    }
                }
                return false;
            }
            $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $tableName);
            $stmt = $this->db->query("SHOW COLUMNS FROM `{$safeTable}` LIKE " . $this->db->quote($columnName));
            return (bool)$stmt->fetchColumn();
        } catch (\Throwable $t) {
            return false;
        }
    }

    public function ensureInventoryTableExists(): bool {
        try {
            if ($this->getDriver() === 'sqlite') {
                $this->db->exec("CREATE TABLE IF NOT EXISTS `commerce_sku_inventory` (
                    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
                    `platform` TEXT NOT NULL DEFAULT 'tiktok_shop',
                    `shop_id` TEXT NOT NULL,
                    `product_id` TEXT NOT NULL,
                    `sku_id` TEXT NOT NULL DEFAULT '',
                    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
                    `source` TEXT NOT NULL DEFAULT 'MANUAL',
                    `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (`platform`, `shop_id`, `product_id`, `sku_id`)
                )");
            } else {
                $this->db->exec("CREATE TABLE IF NOT EXISTS `commerce_sku_inventory` (
                    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
                    `shop_id` VARCHAR(64) NOT NULL,
                    `product_id` VARCHAR(64) NOT NULL,
                    `sku_id` VARCHAR(64) NOT NULL DEFAULT '',
                    `stock_quantity` INT NOT NULL DEFAULT 0,
                    `source` VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
                    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `uq_shop_prod_sku_inv` (`platform`, `shop_id`, `product_id`, `sku_id`),
                    KEY `idx_shop_inv` (`shop_id`, `product_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            return true;
        } catch (\Throwable $t) {
            error_log('[TRUE_ROAS] ensureInventoryTableExists error: ' . $t->getMessage());
            return false;
        }
    }

    /**
     * Updates current stock quantity for a SKU (used for < 3-day inventory safety alert).
     */
    public function updateSkuStock(
        string $shopId,
        string $productId,
        string $skuId,
        int $stockQuantity,
        string $platform = self::PLATFORM_TIKTOK_SHOP
    ): array {
        $productId = trim($productId);
        $skuId = trim($skuId);
        if ($shopId === '' || $productId === '') {
            return ['success' => false, 'message' => 'Thiếu shop_id hoặc product_id.'];
        }

        if ($stockQuantity < 0) {
            return ['success' => false, 'message' => 'Tồn kho không thể nhỏ hơn 0.'];
        }

        if (!$this->ensureInventoryTableExists()) {
            return ['success' => false, 'message' => 'Không thể khởi tạo bảng commerce_sku_inventory.'];
        }

        try {
            if ($this->getDriver() === 'sqlite') {
                $sql = "INSERT INTO `commerce_sku_inventory` (`platform`, `shop_id`, `product_id`, `sku_id`, `stock_quantity`, `source`, `updated_at`)
                    VALUES (:platform, :shop_id, :product_id, :sku_id, :qty, 'MANUAL', CURRENT_TIMESTAMP)
                    ON CONFLICT(`platform`, `shop_id`, `product_id`, `sku_id`) DO UPDATE SET
                        `stock_quantity` = excluded.`stock_quantity`,
                        `source` = 'MANUAL',
                        `updated_at` = CURRENT_TIMESTAMP";
            } else {
                $sql = "INSERT INTO `commerce_sku_inventory` (`platform`, `shop_id`, `product_id`, `sku_id`, `stock_quantity`, `source`)
                    VALUES (:platform, :shop_id, :product_id, :sku_id, :qty, 'MANUAL')
                    ON DUPLICATE KEY UPDATE
                        `stock_quantity` = VALUES(`stock_quantity`),
                        `source` = 'MANUAL',
                        `updated_at` = CURRENT_TIMESTAMP";
            }
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':platform' => $platform,
                ':shop_id' => $shopId,
                ':product_id' => $productId,
                ':sku_id' => $skuId,
                ':qty' => $stockQuantity,
            ]);

            return [
                'success' => true,
                'product_id' => $productId,
                'sku_id' => $skuId,
                'stock_quantity' => $stockQuantity,
                'message' => 'Đã cập nhật tồn kho SKU thành công.',
            ];
        } catch (\Throwable $t) {
            return ['success' => false, 'message' => 'Lỗi lưu tồn kho: ' . $t->getMessage()];
        }
    }

    /**
     * Loads current stock map keyed by "product_id:sku_id".
     * Checks commerce_sku_inventory first, then optional stock columns on commerce_product_catalog.
     */
    private function getStockMap(string $shopId, string $platform = self::PLATFORM_TIKTOK_SHOP): array {
        $stockMap = [];

        if ($this->tableExists('commerce_sku_inventory')) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT product_id, sku_id, stock_quantity, source, updated_at
                     FROM `commerce_sku_inventory`
                     WHERE platform = ? AND shop_id = ?"
                );
                $stmt->execute([$platform, $shopId]);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $key = (string)$row['product_id'] . ':' . (string)($row['sku_id'] ?? '');
                    $stockMap[$key] = [
                        'stock_quantity' => (int)$row['stock_quantity'],
                        'source' => (string)($row['source'] ?? 'MANUAL'),
                        'updated_at' => $row['updated_at'] ?? null,
                    ];
                }
            } catch (\Throwable $t) {}
        }

        // Also check if commerce_product_catalog has a stock column
        $catalogStockCol = null;
        foreach (['stock_quantity', 'available_stock', 'stock'] as $candidate) {
            if ($this->columnExists('commerce_product_catalog', $candidate)) {
                $catalogStockCol = $candidate;
                break;
            }
        }
        if ($catalogStockCol !== null) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT product_id, sku_id, `{$catalogStockCol}` AS stock_qty, updated_at
                     FROM `commerce_product_catalog`
                     WHERE platform = ? AND shop_id = ? AND `{$catalogStockCol}` IS NOT NULL"
                );
                $stmt->execute([$platform, $shopId]);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $key = (string)$row['product_id'] . ':' . (string)($row['sku_id'] ?? '');
                    if (!isset($stockMap[$key])) {
                        $stockMap[$key] = [
                            'stock_quantity' => (int)$row['stock_qty'],
                            'source' => 'CATALOG_SYNC',
                            'updated_at' => $row['updated_at'] ?? null,
                        ];
                    }
                }
            } catch (\Throwable $t) {}
        }

        return $stockMap;
    }

    /**
     * SOP KT-VH Task 3: < 3-Day Inventory Safety Alert.
     * Computes 7-day and 14-day average daily units sold per SKU from commerce_order_items/commerce_orders
     * and compares against current stock to compute days_of_cover.
     */
    public function getInventorySafetyAlerts(
        string $shopId,
        string $asOfDate = '',
        string $platform = self::PLATFORM_TIKTOK_SHOP
    ): array {
        $endDate = $asOfDate !== '' ? $asOfDate : date('Y-m-d');
        $start14 = date('Y-m-d', strtotime($endDate . ' -13 days')) . ' 00:00:00';
        $start7 = date('Y-m-d', strtotime($endDate . ' -6 days')) . ' 00:00:00';
        $endExclusive = date('Y-m-d', strtotime($endDate . ' +1 day')) . ' 00:00:00';

        $stockMap = $this->getStockMap($shopId, $platform);
        $items = [];

        if ($this->tableExists('commerce_order_items') && $this->tableExists('commerce_orders')) {
            try {
                $sql = "SELECT
                    i.product_id,
                    i.sku_id,
                    MAX(i.product_name) AS product_name,
                    MAX(i.sku_name) AS sku_name,
                    MAX(i.sku_image) AS sku_image,
                    SUM(CASE WHEN o.platform_created_at >= :start7_u AND o.order_status != 'CANCELLED' THEN i.quantity ELSE 0 END) AS units_7d,
                    SUM(CASE WHEN o.order_status != 'CANCELLED' THEN i.quantity ELSE 0 END) AS units_14d,
                    SUM(CASE WHEN o.platform_created_at >= :start7_g AND o.order_status != 'CANCELLED' THEN (i.quantity * i.sale_price) ELSE 0 END) AS gmv_7d
                FROM `commerce_order_items` i
                INNER JOIN `commerce_orders` o ON i.order_id = o.id
                WHERE o.platform = :platform
                  AND o.shop_id = :shop_id
                  AND o.platform_created_at >= :start14
                  AND o.platform_created_at < :end_dt
                GROUP BY i.product_id, i.sku_id";

                $stmt = $this->db->prepare($sql);
                $stmt->execute([
                    ':start7_u' => $start7,
                    ':start7_g' => $start7,
                    ':start14' => $start14,
                    ':end_dt' => $endExclusive,
                    ':platform' => $platform,
                    ':shop_id' => $shopId,
                ]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                foreach ($rows as $row) {
                    $productId = (string)$row['product_id'];
                    $skuId = (string)($row['sku_id'] ?? '');
                    $key = $productId . ':' . $skuId;

                    $units7d = (int)($row['units_7d'] ?? 0);
                    $units14d = (int)($row['units_14d'] ?? 0);
                    $avgDaily7d = round($units7d / 7.0, 2);
                    $avgDaily14d = round($units14d / 14.0, 2);
                    $velocity = $avgDaily7d > 0.0 ? $avgDaily7d : $avgDaily14d;

                    $stockEntry = $stockMap[$key] ?? ($stockMap[$productId . ':'] ?? null);
                    $currentStock = $stockEntry !== null ? (int)$stockEntry['stock_quantity'] : null;

                    $daysOfCover = null;
                    $alertLevel = 'STOCK_UNCONFIGURED';
                    $recommendation = 'Chưa có dữ liệu tồn kho. Nhập tồn kho thực tế để kích hoạt cảnh báo < 3 ngày trước khi chạy Ads.';

                    if ($currentStock !== null) {
                        if ($velocity > 0.0) {
                            $daysOfCover = round($currentStock / $velocity, 1);
                            if ($daysOfCover < self::CRITICAL_DAYS_OF_COVER) {
                                $alertLevel = 'CRITICAL';
                                $recommendation = 'NGUY HIỂM (< 3 ngày): Tạm dừng/giảm ngân sách Ads ngay để tránh cháy hàng & tụt điểm vận hành.';
                            } elseif ($daysOfCover < self::WARNING_DAYS_OF_COVER) {
                                $alertLevel = 'WARNING';
                                $recommendation = 'CẢNH BÁO (3-7 ngày): Lên kế hoạch nhập hàng bổ sung trước khi scale Ads.';
                            } else {
                                $alertLevel = 'HEALTHY';
                                $recommendation = 'An toàn (>= 7 ngày): Đủ tồn kho để duy trì hoặc scale Ads.';
                            }
                        } else {
                            $alertLevel = $currentStock <= 0 ? 'CRITICAL' : 'HEALTHY';
                            $daysOfCover = $currentStock <= 0 ? 0.0 : null;
                            $recommendation = $currentStock <= 0
                                ? 'Hết hàng (0 sản phẩm): Không bật Ads cho SKU này.'
                                : 'Không có đơn trong 14 ngày qua.';
                        }
                    }

                    $items[] = [
                        'product_id' => $productId,
                        'sku_id' => $skuId,
                        'product_name' => (string)($row['product_name'] ?? ''),
                        'sku_name' => (string)($row['sku_name'] ?? ''),
                        'sku_image' => $row['sku_image'] ?? null,
                        'units_sold_7d' => $units7d,
                        'units_sold_14d' => $units14d,
                        'avg_daily_units_7d' => $avgDaily7d,
                        'avg_daily_units_14d' => $avgDaily14d,
                        'effective_daily_velocity' => $velocity,
                        'gmv_7d' => round((float)($row['gmv_7d'] ?? 0.0), 2),
                        'current_stock' => $currentStock,
                        'stock_source' => $stockEntry['source'] ?? null,
                        'stock_updated_at' => $stockEntry['updated_at'] ?? null,
                        'days_of_cover' => $daysOfCover,
                        'alert_level' => $alertLevel,
                        'is_critical' => $alertLevel === 'CRITICAL',
                        'recommendation' => $recommendation,
                    ];
                }
            } catch (\Throwable $t) {
                error_log('[TRUE_ROAS] getInventorySafetyAlerts error: ' . $t->getMessage());
            }
        }

        // Sort: CRITICAL first, then WARNING, then STOCK_UNCONFIGURED, then HEALTHY; tie-break by velocity desc
        $rank = ['CRITICAL' => 0, 'WARNING' => 1, 'STOCK_UNCONFIGURED' => 2, 'HEALTHY' => 3];
        usort($items, function (array $a, array $b) use ($rank): int {
            $ra = $rank[$a['alert_level']] ?? 9;
            $rb = $rank[$b['alert_level']] ?? 9;
            if ($ra !== $rb) {
                return $ra <=> $rb;
            }
            return $b['effective_daily_velocity'] <=> $a['effective_daily_velocity'];
        });

        $criticalCount = 0;
        $warningCount = 0;
        $healthyCount = 0;
        $unconfiguredCount = 0;
        foreach ($items as $item) {
            if ($item['alert_level'] === 'CRITICAL') {
                $criticalCount++;
            } elseif ($item['alert_level'] === 'WARNING') {
                $warningCount++;
            } elseif ($item['alert_level'] === 'HEALTHY') {
                $healthyCount++;
            } else {
                $unconfiguredCount++;
            }
        }

        return [
            'as_of_date' => $endDate,
            'thresholds' => [
                'critical_days' => self::CRITICAL_DAYS_OF_COVER,
                'warning_days' => self::WARNING_DAYS_OF_COVER,
            ],
            'counts' => [
                'total_skus' => count($items),
                'critical' => $criticalCount,
                'warning' => $warningCount,
                'healthy' => $healthyCount,
                'stock_unconfigured' => $unconfiguredCount,
            ],
            'items' => $items,
        ];
    }

    /**
     * Builds the full True ROAS Net Profit Reconciliation report (daily + per-SKU + summary + inventory alerts).
     */
    public function getTrueRoasReport(
        string $shopId,
        string $startDate,
        string $endDate,
        string $platform = self::PLATFORM_TIKTOK_SHOP
    ): array {
        $startDt = $startDate . ' 00:00:00';
        $endDt = date('Y-m-d', strtotime($endDate . ' +1 day')) . ' 00:00:00';
        $endInclusive = $endDate . ' 23:59:59';

        // 1. Load Product COGS map (keyed by product_id)
        $costService = new CommerceProductCostService($this->db);
        $productCosts = $costService->getProductCosts($shopId);

        // 2. Load Order Line Items (per-day & per-SKU)
        $dailyMap = [];
        $skuMap = [];
        $orderTotals = []; // order_id => ['gross' => float, 'date' => string, 'status' => string]
        $orderItemsByOrder = []; // order_id => [ ['sku_key' => string, 'gross' => float, 'date' => string] ]

        $initDaily = static function (string $date): array {
            return [
                'date' => $date,
                'orders_count' => 0,
                'units_sold' => 0,
                'cancelled_units' => 0,
                'gross_gmv' => 0.0,
                'cancelled_gmv' => 0.0,
                'returned_rma_gmv' => 0.0,
                'cancelled_returned_gmv' => 0.0,
                'net_gmv' => 0.0,
                'ads_spend' => 0.0,
                'affiliate_cost' => 0.0,
                'platform_fees' => 0.0,
                'shipping_fees' => 0.0,
                'product_cogs' => 0.0,
                'loss_rma_cost' => 0.0,
                'net_contribution_profit' => 0.0,
                'ads_roas' => null,
                'true_roas' => null,
                'net_profit_margin_pct' => null,
            ];
        };

        $dailyOrderSets = [];

        if ($this->tableExists('commerce_orders') && $this->tableExists('commerce_order_items')) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT
                        o.platform_order_id,
                        o.order_status,
                        o.order_gross_amount,
                        DATE(o.platform_created_at) AS order_date,
                        i.product_id,
                        i.sku_id,
                        i.product_name,
                        i.sku_name,
                        i.sku_image,
                        i.quantity,
                        i.sale_price
                     FROM `commerce_orders` o
                     INNER JOIN `commerce_order_items` i ON i.order_id = o.id
                     WHERE o.platform = ? AND o.shop_id = ?
                       AND o.platform_created_at >= ? AND o.platform_created_at < ?"
                );
                $stmt->execute([$platform, $shopId, $startDt, $endDt]);

                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $orderId = (string)$row['platform_order_id'];
                    $date = (string)$row['order_date'];
                    $status = strtoupper(trim((string)$row['order_status']));
                    $productId = (string)$row['product_id'];
                    $skuId = (string)($row['sku_id'] ?? '');
                    $skuKey = $productId . ':' . $skuId;
                    $qty = (int)$row['quantity'];
                    $itemGross = round($qty * (float)$row['sale_price'], 2);
                    $isCancelled = ($status === 'CANCELLED');

                    if (!isset($dailyMap[$date])) {
                        $dailyMap[$date] = $initDaily($date);
                        $dailyOrderSets[$date] = [];
                    }
                    if (!isset($dailyOrderSets[$date][$orderId])) {
                        $dailyOrderSets[$date][$orderId] = true;
                        $dailyMap[$date]['orders_count']++;
                    }

                    if (!isset($skuMap[$skuKey])) {
                        $costCfg = $productCosts[$productId] ?? null;
                        $hasCogs = $costCfg !== null && (float)($costCfg['cogs_amount'] ?? 0.0) > 0.0;
                        $skuMap[$skuKey] = [
                            'product_id' => $productId,
                            'sku_id' => $skuId,
                            'product_name' => (string)($row['product_name'] ?? ''),
                            'sku_name' => (string)($row['sku_name'] ?? ''),
                            'sku_image' => $row['sku_image'] ?? null,
                            'orders_count' => 0,
                            'units_sold' => 0,
                            'cancelled_units' => 0,
                            'net_units' => 0,
                            'gross_gmv' => 0.0,
                            'cancelled_gmv' => 0.0,
                            'returned_rma_gmv' => 0.0,
                            'cancelled_returned_gmv' => 0.0,
                            'net_gmv' => 0.0,
                            'ads_spend' => 0.0,
                            'affiliate_cost' => 0.0,
                            'platform_fees' => 0.0,
                            'shipping_fees' => 0.0,
                            'unit_cogs' => $hasCogs ? (float)$costCfg['cogs_amount'] : null,
                            'unit_variable_cost' => $hasCogs ? (float)($costCfg['variable_cost_amount'] ?? 0.0) : 0.0,
                            'product_cogs' => 0.0,
                            'loss_rma_cost' => 0.0,
                            'net_contribution_profit' => 0.0,
                            'ads_roas' => null,
                            'true_roas' => null,
                            'net_profit_margin_pct' => null,
                            'cogs_status' => $hasCogs ? 'CONFIGURED' : 'INSUFFICIENT_DATA',
                            '_order_ids' => [],
                        ];
                    }

                    if (!isset($skuMap[$skuKey]['_order_ids'][$orderId])) {
                        $skuMap[$skuKey]['_order_ids'][$orderId] = true;
                        $skuMap[$skuKey]['orders_count']++;
                    }

                    $dailyMap[$date]['units_sold'] += $qty;
                    $dailyMap[$date]['gross_gmv'] += $itemGross;
                    $skuMap[$skuKey]['units_sold'] += $qty;
                    $skuMap[$skuKey]['gross_gmv'] += $itemGross;

                    if ($isCancelled) {
                        $dailyMap[$date]['cancelled_units'] += $qty;
                        $dailyMap[$date]['cancelled_gmv'] += $itemGross;
                        $skuMap[$skuKey]['cancelled_units'] += $qty;
                        $skuMap[$skuKey]['cancelled_gmv'] += $itemGross;
                    }

                    if (!isset($orderTotals[$orderId])) {
                        $orderTotals[$orderId] = ['gross' => 0.0, 'date' => $date, 'status' => $status];
                        $orderItemsByOrder[$orderId] = [];
                    }
                    $orderTotals[$orderId]['gross'] += $itemGross;
                    $orderItemsByOrder[$orderId][] = [
                        'sku_key' => $skuKey,
                        'product_id' => $productId,
                        'gross' => $itemGross,
                        'date' => $date,
                    ];
                }
            } catch (\Throwable $t) {
                error_log('[TRUE_ROAS] orders/items query error: ' . $t->getMessage());
            }
        }

        // 3. Allocate Non-Cancellation Losses (FAILED_DELIVERY, REFUND, PARTIAL_REFUND, RETURN_REFUND) from commerce_loss_ledger
        $ordersWithLossLedger = [];
        if ($this->tableExists('commerce_loss_ledger') && $this->tableExists('commerce_orders')) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT
                        l.platform_order_id,
                        l.loss_type,
                        SUM(l.loss_amount) AS loss_amount,
                        DATE(o.platform_created_at) AS order_date
                     FROM `commerce_loss_ledger` l
                     INNER JOIN `commerce_orders` o ON l.platform_order_id = o.platform_order_id AND l.shop_id = o.shop_id
                     WHERE l.platform = ? AND l.shop_id = ? AND l.perspective = 'MATURED_LIFECYCLE'
                       AND o.platform_created_at >= ? AND o.platform_created_at < ?
                     GROUP BY l.platform_order_id, l.loss_type, DATE(o.platform_created_at)"
                );
                $stmt->execute([$platform, $shopId, $startDt, $endDt]);

                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $orderId = (string)$row['platform_order_id'];
                    $lossType = strtoupper((string)$row['loss_type']);
                    $lossAmt = (float)$row['loss_amount'];
                    $date = (string)$row['order_date'];
                    $ordersWithLossLedger[$orderId] = true;

                    // Skip CANCELLATION if order_status is already CANCELLED (counted in cancelled_gmv)
                    if ($lossType === 'CANCELLATION' && ($orderTotals[$orderId]['status'] ?? '') === 'CANCELLED') {
                        continue;
                    }

                    if (!isset($dailyMap[$date])) {
                        $dailyMap[$date] = $initDaily($date);
                    }
                    $dailyMap[$date]['returned_rma_gmv'] += $lossAmt;
                    $dailyMap[$date]['loss_rma_cost'] += $lossAmt;

                    $orderGross = $orderTotals[$orderId]['gross'] ?? 0.0;
                    $itemsInOrder = $orderItemsByOrder[$orderId] ?? [];
                    if ($orderGross > 0.0 && !empty($itemsInOrder)) {
                        foreach ($itemsInOrder as $it) {
                            $share = $it['gross'] / $orderGross;
                            $alloc = $lossAmt * $share;
                            $skuMap[$it['sku_key']]['returned_rma_gmv'] += $alloc;
                            $skuMap[$it['sku_key']]['loss_rma_cost'] += $alloc;
                        }
                    }
                }
            } catch (\Throwable $t) {
                error_log('[TRUE_ROAS] loss_ledger query error: ' . $t->getMessage());
            }
        }

        // Fallback to commerce_aftersales (SUCCESS) for orders not yet in commerce_loss_ledger
        if ($this->tableExists('commerce_aftersales') && $this->tableExists('commerce_orders')) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT
                        a.platform_order_id,
                        SUM(a.refund_amount) AS refund_amount,
                        DATE(o.platform_created_at) AS order_date
                     FROM `commerce_aftersales` a
                     INNER JOIN `commerce_orders` o ON a.platform_order_id = o.platform_order_id AND a.shop_id = o.shop_id
                     WHERE a.platform = ? AND a.shop_id = ? AND a.aftersales_status = 'SUCCESS'
                       AND o.order_status != 'CANCELLED'
                       AND o.platform_created_at >= ? AND o.platform_created_at < ?
                     GROUP BY a.platform_order_id, DATE(o.platform_created_at)"
                );
                $stmt->execute([$platform, $shopId, $startDt, $endDt]);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $orderId = (string)$row['platform_order_id'];
                    if (isset($ordersWithLossLedger[$orderId])) {
                        continue;
                    }
                    $refundAmt = (float)$row['refund_amount'];
                    $date = (string)$row['order_date'];
                    if (!isset($dailyMap[$date])) {
                        $dailyMap[$date] = $initDaily($date);
                    }
                    $dailyMap[$date]['returned_rma_gmv'] += $refundAmt;
                    $dailyMap[$date]['loss_rma_cost'] += $refundAmt;

                    $orderGross = $orderTotals[$orderId]['gross'] ?? 0.0;
                    $itemsInOrder = $orderItemsByOrder[$orderId] ?? [];
                    if ($orderGross > 0.0 && !empty($itemsInOrder)) {
                        foreach ($itemsInOrder as $it) {
                            $share = $it['gross'] / $orderGross;
                            $alloc = $refundAmt * $share;
                            $skuMap[$it['sku_key']]['returned_rma_gmv'] += $alloc;
                            $skuMap[$it['sku_key']]['loss_rma_cost'] += $alloc;
                        }
                    }
                }
            } catch (\Throwable $t) {}
        }

        // 4. Ads Spend: Daily from commerce_ads_campaign_daily & Product SPU from commerce_ads_product_daily
        $totalCampaignAdsSpend = 0.0;
        if ($this->tableExists('commerce_ads_campaign_daily')) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT stat_date, SUM(spend) AS total_spend
                     FROM `commerce_ads_campaign_daily`
                     WHERE shop_id = ? AND stat_date >= ? AND stat_date <= ?
                     GROUP BY stat_date"
                );
                $stmt->execute([$shopId, $startDate, $endDate]);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $date = (string)$row['stat_date'];
                    $spend = (float)$row['total_spend'];
                    $totalCampaignAdsSpend += $spend;
                    if (!isset($dailyMap[$date])) {
                        $dailyMap[$date] = $initDaily($date);
                    }
                    $dailyMap[$date]['ads_spend'] += $spend;
                }
            } catch (\Throwable $t) {
                error_log('[TRUE_ROAS] ads_campaign_daily query error: ' . $t->getMessage());
            }
        }

        // Allocate SPU-level ads spend to SKUs proportionally by SKU gross_gmv within each product_id
        $productGrossTotals = [];
        $productSkuKeys = [];
        foreach ($skuMap as $skuKey => $skuRow) {
            $pid = $skuRow['product_id'];
            $productGrossTotals[$pid] = ($productGrossTotals[$pid] ?? 0.0) + $skuRow['gross_gmv'];
            $productSkuKeys[$pid][] = $skuKey;
        }

        $totalProductAdsSpend = 0.0;
        if ($this->tableExists('commerce_ads_product_daily')) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT item_group_id AS product_id, stat_date, SUM(cost) AS total_cost
                     FROM `commerce_ads_product_daily`
                     WHERE shop_id = ? AND stat_date >= ? AND stat_date <= ?
                     GROUP BY item_group_id, stat_date"
                );
                $stmt->execute([$shopId, $startDate, $endDate]);
                $prodSpendById = [];
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $pid = (string)$row['product_id'];
                    $cost = (float)$row['total_cost'];
                    $totalProductAdsSpend += $cost;
                    $prodSpendById[$pid] = ($prodSpendById[$pid] ?? 0.0) + $cost;
                    // If campaign_daily had no rows at all, populate daily ads_spend from product_daily
                    if ($totalCampaignAdsSpend <= 0.0) {
                        $date = (string)$row['stat_date'];
                        if (!isset($dailyMap[$date])) {
                            $dailyMap[$date] = $initDaily($date);
                        }
                        $dailyMap[$date]['ads_spend'] += $cost;
                    }
                }

                foreach ($prodSpendById as $pid => $spend) {
                    $keys = $productSkuKeys[$pid] ?? [];
                    if (empty($keys)) {
                        continue;
                    }
                    $prodGross = $productGrossTotals[$pid] ?? 0.0;
                    $countKeys = count($keys);
                    foreach ($keys as $skuKey) {
                        $share = $prodGross > 0.0 ? ($skuMap[$skuKey]['gross_gmv'] / $prodGross) : (1.0 / $countKeys);
                        $skuMap[$skuKey]['ads_spend'] += $spend * $share;
                    }
                }
            } catch (\Throwable $t) {
                error_log('[TRUE_ROAS] ads_product_daily query error: ' . $t->getMessage());
            }
        }

        // 5. Affiliate Commission from commerce_affiliate_orders
        $hasAffiliateTableData = false;
        if ($this->tableExists('commerce_affiliate_orders')) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT
                        DATE(order_created_at) AS aff_date,
                        product_id,
                        sku_id,
                        SUM(COALESCE(settled_commission, estimated_commission, 0)) AS aff_cost
                     FROM `commerce_affiliate_orders`
                     WHERE platform = ? AND shop_id = ?
                       AND order_created_at >= ? AND order_created_at < ?
                       AND UPPER(order_status) != 'CANCELLED'
                       AND UPPER(commission_status) NOT IN ('CANCELLED', 'INELIGIBLE')
                     GROUP BY DATE(order_created_at), product_id, sku_id"
                );
                $stmt->execute([$platform, $shopId, $startDt, $endDt]);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $cost = (float)$row['aff_cost'];
                    if ($cost <= 0.0) {
                        continue;
                    }
                    $hasAffiliateTableData = true;
                    $date = (string)$row['aff_date'];
                    if ($date !== '') {
                        if (!isset($dailyMap[$date])) {
                            $dailyMap[$date] = $initDaily($date);
                        }
                        $dailyMap[$date]['affiliate_cost'] += $cost;
                    }
                    $pid = (string)($row['product_id'] ?? '');
                    $sid = (string)($row['sku_id'] ?? '');
                    $skuKey = $pid . ':' . $sid;
                    if (isset($skuMap[$skuKey])) {
                        $skuMap[$skuKey]['affiliate_cost'] += $cost;
                    } elseif ($pid !== '' && !empty($productSkuKeys[$pid])) {
                        $prodGross = $productGrossTotals[$pid] ?? 0.0;
                        $cnt = count($productSkuKeys[$pid]);
                        foreach ($productSkuKeys[$pid] as $k) {
                            $share = $prodGross > 0.0 ? ($skuMap[$k]['gross_gmv'] / $prodGross) : (1.0 / $cnt);
                            $skuMap[$k]['affiliate_cost'] += $cost * $share;
                        }
                    }
                }
            } catch (\Throwable $t) {
                error_log('[TRUE_ROAS] affiliate_orders query error: ' . $t->getMessage());
            }
        }

        // 6. Platform Fees, Shipping Fees & Settlement from commerce_finance_transactions & commerce_finance_statements
        $hasTxData = false;
        $totalTxNetSettlement = 0.0;
        $totalTxAffiliate = 0.0;
        if ($this->tableExists('commerce_finance_transactions')) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT
                        DATE(transaction_time) AS tx_date,
                        platform_order_id,
                        sku_id,
                        SUM(platform_commission) AS platform_commission,
                        SUM(payment_fee) AS payment_fee,
                        SUM(affiliate_commission) AS affiliate_commission,
                        SUM(actual_shipping_fee) AS actual_shipping_fee,
                        SUM(shipping_fee_subsidy) AS shipping_fee_subsidy,
                        SUM(adjustment_amount) AS adjustment_amount,
                        SUM(net_settlement_amount) AS net_settlement_amount
                     FROM `commerce_finance_transactions`
                     WHERE platform = ? AND shop_id = ?
                       AND transaction_time >= ? AND transaction_time <= ?
                     GROUP BY DATE(transaction_time), platform_order_id, sku_id"
                );
                $stmt->execute([$platform, $shopId, $startDt, $endInclusive]);

                // Build quick lookup from sku_id -> skuKeys
                $skuKeysBySkuId = [];
                foreach ($skuMap as $k => $v) {
                    if ($v['sku_id'] !== '') {
                        $skuKeysBySkuId[$v['sku_id']][] = $k;
                    }
                }

                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $hasTxData = true;
                    $date = (string)$row['tx_date'];
                    $orderId = (string)$row['platform_order_id'];
                    $sid = (string)($row['sku_id'] ?? '');

                    $pFee = max(0.0, abs((float)$row['platform_commission']) + abs((float)$row['payment_fee']) - (float)$row['adjustment_amount']);
                    $sFee = max(0.0, abs((float)$row['actual_shipping_fee']) - abs((float)$row['shipping_fee_subsidy']));
                    $affFee = abs((float)$row['affiliate_commission']);
                    $totalTxNetSettlement += (float)$row['net_settlement_amount'];
                    $totalTxAffiliate += $affFee;

                    if ($date !== '') {
                        if (!isset($dailyMap[$date])) {
                            $dailyMap[$date] = $initDaily($date);
                        }
                        $dailyMap[$date]['platform_fees'] += $pFee;
                        $dailyMap[$date]['shipping_fees'] += $sFee;
                        if (!$hasAffiliateTableData && $affFee > 0.0) {
                            $dailyMap[$date]['affiliate_cost'] += $affFee;
                        }
                    }

                    // Allocate fees to SKU
                    if ($sid !== '' && !empty($skuKeysBySkuId[$sid])) {
                        $targetKey = $skuKeysBySkuId[$sid][0];
                        $skuMap[$targetKey]['platform_fees'] += $pFee;
                        $skuMap[$targetKey]['shipping_fees'] += $sFee;
                        if (!$hasAffiliateTableData && $affFee > 0.0) {
                            $skuMap[$targetKey]['affiliate_cost'] += $affFee;
                        }
                    } elseif (!empty($orderItemsByOrder[$orderId])) {
                        $orderGross = $orderTotals[$orderId]['gross'] ?? 0.0;
                        $itemsInOrder = $orderItemsByOrder[$orderId];
                        $cnt = count($itemsInOrder);
                        foreach ($itemsInOrder as $it) {
                            $share = $orderGross > 0.0 ? ($it['gross'] / $orderGross) : (1.0 / $cnt);
                            $skuMap[$it['sku_key']]['platform_fees'] += $pFee * $share;
                            $skuMap[$it['sku_key']]['shipping_fees'] += $sFee * $share;
                            if (!$hasAffiliateTableData && $affFee > 0.0) {
                                $skuMap[$it['sku_key']]['affiliate_cost'] += $affFee * $share;
                            }
                        }
                    }
                }
            } catch (\Throwable $t) {
                error_log('[TRUE_ROAS] finance_transactions query error: ' . $t->getMessage());
            }
        }

        // Query Statement Settlement for Reconciliation
        $statementCount = 0;
        $statementTotal = 0.0;
        if ($this->tableExists('commerce_finance_statements')) {
            try {
                $stmt = $this->db->prepare(
                    "SELECT COUNT(DISTINCT statement_id) AS cnt, SUM(total_settlement_amount) AS total_amt
                     FROM `commerce_finance_statements`
                     WHERE platform = ? AND shop_id = ?
                       AND statement_time >= ? AND statement_time <= ?"
                );
                $stmt->execute([$platform, $shopId, $startDt, $endInclusive]);
                $stRow = $stmt->fetch(PDO::FETCH_ASSOC);
                $statementCount = (int)($stRow['cnt'] ?? 0);
                $statementTotal = (float)($stRow['total_amt'] ?? 0.0);
            } catch (\Throwable $t) {}
        }

        // 7. Compute COGS per SKU and aggregate daily COGS
        $missingCogsSkus = 0;
        $configuredCogsSkus = 0;
        foreach ($skuMap as $skuKey => &$sku) {
            unset($sku['_order_ids']);
            $sku['net_units'] = max(0, $sku['units_sold'] - $sku['cancelled_units']);
            $sku['cancelled_returned_gmv'] = round($sku['cancelled_gmv'] + $sku['returned_rma_gmv'], 2);
            $sku['net_gmv'] = round(max(0.0, $sku['gross_gmv'] - $sku['cancelled_returned_gmv']), 2);

            if ($sku['cogs_status'] === 'CONFIGURED' && $sku['unit_cogs'] !== null) {
                $configuredCogsSkus++;
                $unitTotalCost = $sku['unit_cogs'] + $sku['unit_variable_cost'];
                $sku['product_cogs'] = round($sku['net_units'] * $unitTotalCost, 2);
            } else {
                $missingCogsSkus++;
                $sku['product_cogs'] = 0.0;
            }

            $sku['gross_gmv'] = round($sku['gross_gmv'], 2);
            $sku['cancelled_gmv'] = round($sku['cancelled_gmv'], 2);
            $sku['returned_rma_gmv'] = round($sku['returned_rma_gmv'], 2);
            $sku['ads_spend'] = round($sku['ads_spend'], 2);
            $sku['affiliate_cost'] = round($sku['affiliate_cost'], 2);
            $sku['platform_fees'] = round($sku['platform_fees'], 2);
            $sku['shipping_fees'] = round($sku['shipping_fees'], 2);
            $sku['loss_rma_cost'] = round($sku['loss_rma_cost'], 2);

            $sku['net_contribution_profit'] = round(
                $sku['net_gmv'] - $sku['product_cogs'] - $sku['ads_spend'] - $sku['affiliate_cost'] - $sku['platform_fees'] - $sku['shipping_fees'],
                2
            );

            $sku['ads_roas'] = $sku['ads_spend'] > 0.0 ? round($sku['gross_gmv'] / $sku['ads_spend'], 2) : null;
            $trueDenom = $sku['ads_spend'] + $sku['affiliate_cost'] + $sku['platform_fees'] + $sku['loss_rma_cost'];
            $sku['true_roas'] = $trueDenom > 0.0 ? round($sku['net_gmv'] / $trueDenom, 2) : null;
            $sku['net_profit_margin_pct'] = $sku['net_gmv'] > 0.0 ? round(($sku['net_contribution_profit'] / $sku['net_gmv']) * 100.0, 2) : null;
        }
        unset($sku);

        // Compute daily COGS from order_items by date
        foreach ($orderItemsByOrder as $itemsInOrder) {
            foreach ($itemsInOrder as $it) {
                $sku = $skuMap[$it['sku_key']] ?? null;
                if (!$sku || $sku['cogs_status'] !== 'CONFIGURED') {
                    continue;
                }
                $date = $it['date'];
                if (!isset($dailyMap[$date])) {
                    continue;
                }
                if ($sku['gross_gmv'] > 0.0) {
                    $dailyMap[$date]['product_cogs'] += $sku['product_cogs'] * ($it['gross'] / $sku['gross_gmv']);
                }
            }
        }

        // Finalize daily series & summary totals
        ksort($dailyMap);
        $summary = $initDaily('TOTAL');
        unset($summary['date']);
        $summary['orders_count'] = count($orderTotals);

        $dailySeries = [];
        foreach ($dailyMap as $day) {
            $day['cancelled_returned_gmv'] = round($day['cancelled_gmv'] + $day['returned_rma_gmv'], 2);
            $day['net_gmv'] = round(max(0.0, $day['gross_gmv'] - $day['cancelled_returned_gmv']), 2);
            $day['gross_gmv'] = round($day['gross_gmv'], 2);
            $day['cancelled_gmv'] = round($day['cancelled_gmv'], 2);
            $day['returned_rma_gmv'] = round($day['returned_rma_gmv'], 2);
            $day['ads_spend'] = round($day['ads_spend'], 2);
            $day['affiliate_cost'] = round($day['affiliate_cost'], 2);
            $day['platform_fees'] = round($day['platform_fees'], 2);
            $day['shipping_fees'] = round($day['shipping_fees'], 2);
            $day['product_cogs'] = round($day['product_cogs'], 2);
            $day['loss_rma_cost'] = round($day['loss_rma_cost'], 2);

            $day['net_contribution_profit'] = round(
                $day['net_gmv'] - $day['product_cogs'] - $day['ads_spend'] - $day['affiliate_cost'] - $day['platform_fees'] - $day['shipping_fees'],
                2
            );
            $day['ads_roas'] = $day['ads_spend'] > 0.0 ? round($day['gross_gmv'] / $day['ads_spend'], 2) : null;
            $dayDenom = $day['ads_spend'] + $day['affiliate_cost'] + $day['platform_fees'] + $day['loss_rma_cost'];
            $day['true_roas'] = $dayDenom > 0.0 ? round($day['net_gmv'] / $dayDenom, 2) : null;
            $day['net_profit_margin_pct'] = $day['net_gmv'] > 0.0 ? round(($day['net_contribution_profit'] / $day['net_gmv']) * 100.0, 2) : null;

            $dailySeries[] = $day;

            $summary['units_sold'] += $day['units_sold'];
            $summary['cancelled_units'] += $day['cancelled_units'];
            $summary['gross_gmv'] += $day['gross_gmv'];
            $summary['cancelled_gmv'] += $day['cancelled_gmv'];
            $summary['returned_rma_gmv'] += $day['returned_rma_gmv'];
            $summary['cancelled_returned_gmv'] += $day['cancelled_returned_gmv'];
            $summary['net_gmv'] += $day['net_gmv'];
            $summary['ads_spend'] += $day['ads_spend'];
            $summary['affiliate_cost'] += $day['affiliate_cost'];
            $summary['platform_fees'] += $day['platform_fees'];
            $summary['shipping_fees'] += $day['shipping_fees'];
            $summary['product_cogs'] += $day['product_cogs'];
            $summary['loss_rma_cost'] += $day['loss_rma_cost'];
        }

        $summary['gross_gmv'] = round($summary['gross_gmv'], 2);
        $summary['cancelled_gmv'] = round($summary['cancelled_gmv'], 2);
        $summary['returned_rma_gmv'] = round($summary['returned_rma_gmv'], 2);
        $summary['cancelled_returned_gmv'] = round($summary['cancelled_returned_gmv'], 2);
        $summary['net_gmv'] = round($summary['net_gmv'], 2);
        $summary['ads_spend'] = round($summary['ads_spend'], 2);
        $summary['affiliate_cost'] = round($summary['affiliate_cost'], 2);
        $summary['platform_fees'] = round($summary['platform_fees'], 2);
        $summary['shipping_fees'] = round($summary['shipping_fees'], 2);
        $summary['product_cogs'] = round($summary['product_cogs'], 2);
        $summary['loss_rma_cost'] = round($summary['loss_rma_cost'], 2);

        $summary['net_contribution_profit'] = round(
            $summary['net_gmv'] - $summary['product_cogs'] - $summary['ads_spend'] - $summary['affiliate_cost'] - $summary['platform_fees'] - $summary['shipping_fees'],
            2
        );
        $summary['ads_roas'] = $summary['ads_spend'] > 0.0 ? round($summary['gross_gmv'] / $summary['ads_spend'], 2) : null;
        $summaryTrueDenom = $summary['ads_spend'] + $summary['affiliate_cost'] + $summary['platform_fees'] + $summary['loss_rma_cost'];
        $summary['true_roas'] = $summaryTrueDenom > 0.0 ? round($summary['net_gmv'] / $summaryTrueDenom, 2) : null;
        $summary['net_profit_margin_pct'] = $summary['net_gmv'] > 0.0 ? round(($summary['net_contribution_profit'] / $summary['net_gmv']) * 100.0, 2) : null;

        // 8. Wallet Settlement Reconciliation (< 0.5% threshold)
        $hasStatements = ($statementCount > 0 && $statementTotal > 0.0);
        $effectiveWalletSettlement = $hasStatements ? round($statementTotal, 2) : ($hasTxData ? round($totalTxNetSettlement, 2) : 0.0);
        $expectedOrderSettlement = round(
            max(0.0, $summary['net_gmv'] - $summary['platform_fees'] - $summary['shipping_fees'] - ($hasTxData ? $totalTxAffiliate : $summary['affiliate_cost'])),
            2
        );

        $varianceAmount = round($effectiveWalletSettlement - $expectedOrderSettlement, 2);
        $variancePct = null;
        if (!$hasStatements && !$hasTxData) {
            $reconciliationStatus = 'NO_SETTLEMENT_DATA';
        } elseif ($expectedOrderSettlement > 0.0) {
            $variancePct = round((abs($varianceAmount) / $expectedOrderSettlement) * 100.0, 4);
            $reconciliationStatus = ($variancePct <= self::RECONCILIATION_VARIANCE_THRESHOLD_PCT)
                ? 'RECONCILED'
                : 'VARIANCE_ALERT';
        } else {
            $reconciliationStatus = $effectiveWalletSettlement == 0.0 ? 'RECONCILED' : 'VARIANCE_ALERT';
            $variancePct = $effectiveWalletSettlement == 0.0 ? 0.0 : 100.0;
        }

        // Data completeness / COGS status
        if (empty($skuMap)) {
            $dataStatus = 'NO_ORDER_DATA';
        } elseif ($missingCogsSkus > 0) {
            $dataStatus = 'INSUFFICIENT_DATA';
        } else {
            $dataStatus = 'COMPLETE';
        }

        $skuList = array_values($skuMap);
        usort($skuList, static fn(array $a, array $b): int => $b['gross_gmv'] <=> $a['gross_gmv']);

        // 9. < 3-Day Inventory Safety Alerts
        $inventoryAlerts = $this->getInventorySafetyAlerts($shopId, $endDate, $platform);

        return [
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'shop_id' => $shopId,
                'platform' => $platform,
            ],
            'summary' => $summary,
            'reconciliation' => [
                'status' => $reconciliationStatus,
                'threshold_pct' => self::RECONCILIATION_VARIANCE_THRESHOLD_PCT,
                'has_statements' => $hasStatements,
                'statement_count' => $statementCount,
                'has_transactions' => $hasTxData,
                'wallet_settlement_amount' => $effectiveWalletSettlement,
                'expected_order_settlement_amount' => $expectedOrderSettlement,
                'variance_amount' => $varianceAmount,
                'variance_pct' => $variancePct,
                'is_within_threshold' => $variancePct !== null && $variancePct <= self::RECONCILIATION_VARIANCE_THRESHOLD_PCT,
            ],
            'data_quality' => [
                'status' => $dataStatus,
                'configured_cogs_skus' => $configuredCogsSkus,
                'missing_cogs_skus' => $missingCogsSkus,
                'has_ads_product_breakdown' => $totalProductAdsSpend > 0.0,
                'has_affiliate_data' => $hasAffiliateTableData || $totalTxAffiliate > 0.0,
                'has_finance_fees' => $hasTxData,
            ],
            'daily_series' => $dailySeries,
            'sku_breakdown' => $skuList,
            'inventory_alerts' => $inventoryAlerts,
        ];
    }
}

// Standalone HTTP API Router when invoked directly
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    require_once __DIR__ . '/auth_guard.php';
    header('Content-Type: application/json; charset=utf-8');
    handleCORS();

    requireAuth('admin:all');

    $db = getDBConnection();
    $service = new CommerceTrueRoasService($db);

    $rawInput = file_get_contents('php://input');
    $jsonBody = $rawInput ? json_decode($rawInput, true) : [];
    if (!is_array($jsonBody)) {
        $jsonBody = [];
    }

    $action = trim((string)($_GET['action'] ?? $_POST['action'] ?? $jsonBody['action'] ?? 'get_true_roas_report'));
    $shopId = trim((string)($_GET['shop_id'] ?? $_POST['shop_id'] ?? $jsonBody['shop_id'] ?? ''));
    if ($shopId === '') {
        try {
            $stmtShop = $db->query("SELECT shop_id FROM `tiktok_config` WHERE shop_id IS NOT NULL AND shop_id != '' ORDER BY updated_at DESC LIMIT 1");
            $shopId = (string)($stmtShop ? $stmtShop->fetchColumn() : '');
        } catch (\Throwable $t) {}
    }

    $startDate = trim((string)($_GET['start_date'] ?? $_POST['start_date'] ?? date('Y-m-d', strtotime('-30 days'))));
    $endDate = trim((string)($_GET['end_date'] ?? $_POST['end_date'] ?? date('Y-m-d')));
    if ($startDate > $endDate) {
        [$startDate, $endDate] = [$endDate, $startDate];
    }
    $platform = trim((string)($_GET['platform'] ?? $_POST['platform'] ?? $jsonBody['platform'] ?? CommerceTrueRoasService::PLATFORM_TIKTOK_SHOP));

    try {
        switch ($action) {
            case 'get_true_roas_report':
                $data = $service->getTrueRoasReport($shopId, $startDate, $endDate, $platform);
                echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
                break;

            case 'get_inventory_alerts':
                $asOf = trim((string)($_GET['as_of_date'] ?? $endDate));
                $data = $service->getInventorySafetyAlerts($shopId, $asOf, $platform);
                echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
                break;

            case 'update_sku_stock':
                $productId = trim((string)($jsonBody['product_id'] ?? $_POST['product_id'] ?? ''));
                $skuId = trim((string)($jsonBody['sku_id'] ?? $_POST['sku_id'] ?? ''));
                $stockQty = (int)($jsonBody['stock_quantity'] ?? $_POST['stock_quantity'] ?? -1);
                $res = $service->updateSkuStock($shopId, $productId, $skuId, $stockQty, $platform);
                if (empty($res['success'])) {
                    http_response_code(400);
                }
                echo json_encode($res, JSON_UNESCAPED_UNICODE);
                break;

            default:
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Action không hợp lệ: ' . $action], JSON_UNESCAPED_UNICODE);
                break;
        }
    } catch (\Throwable $t) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $t->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}
