<?php
/**
 * ADDP COMMERCE INTELLIGENCE - SHOPEE ANALYTICS & RECONCILIATION SERVICE
 * 
 * Component: Phase I Shopee Analytics Engine
 * 
 * Features:
 * - Normalizes Shopee order, cancellation, return/refund, and settlement files
 * - Cohort-based order tracking by creation timestamp (platform_created_at)
 * - Invariant: Gross - Loss = Realized
 * - Deduplicates multi-line-item orders without inflating gross sales
 * - Prevents double deduction between cancelled orders and failed deliveries
 * - Computes 7x24 Golden Hour matrix and top conversion slots
 * - Exports non-PII UTF-8 BOM CSV reports
 * 
 * Target: Multi-platform e-commerce operations (TikTok Shop & Shopee)
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

class CommerceShopeeService {
    public const PLATFORM = 'shopee';

    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? getDBConnection();
    }

    /**
     * Retrieves high-level Shopee business summary for a date range
     */
    public function getShopeeSummary(string $shopId, string $startDate, string $endDate): array {
        $startDt = $startDate . ' 00:00:00';
        $endDt = date('Y-m-d 00:00:00', strtotime($endDate . ' +1 day'));

        $summary = [
            'platform' => self::PLATFORM,
            'shop_id' => $shopId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total_orders' => 0,
            'gross_sales' => 0.0,
            'cancellation_loss' => 0.0,
            'refund_loss' => 0.0,
            'failed_delivery_loss' => 0.0,
            'total_loss' => 0.0,
            'realized_sales' => 0.0,
            'loss_rate_pct' => 0.0,
            'aov' => 0.0,
            'status_breakdown' => [
                'COMPLETED' => 0,
                'AWAITING_SHIPMENT' => 0,
                'IN_TRANSIT' => 0,
                'DELIVERED' => 0,
                'CANCELLED' => 0,
                'RETURN_REFUND' => 0,
                'FAILED_DELIVERY' => 0
            ],
            'settlement' => [
                'settled_amount' => 0.0,
                'unsettled_amount' => 0.0,
                'platform_fee' => 0.0,
                'shipping_fee' => 0.0,
                'net_payout' => 0.0
            ]
        ];

        try {
            // 1. Order counts and gross amount
            $stmtOrders = $this->db->prepare("SELECT 
                order_status,
                COUNT(*) as order_count,
                COALESCE(SUM(order_gross_amount), 0) as gross_sum
                FROM `commerce_orders`
                WHERE platform = :platform AND shop_id = :shop_id
                  AND platform_created_at >= :start_dt AND platform_created_at < :end_dt
                GROUP BY order_status");
            $stmtOrders->execute([
                ':platform' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':start_dt' => $startDt,
                ':end_dt' => $endDt
            ]);
            $orderRows = $stmtOrders->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $totalGross = 0.0;
            $totalCount = 0;
            foreach ($orderRows as $row) {
                $st = (string)$row['order_status'];
                $cnt = (int)$row['order_count'];
                $gross = (float)$row['gross_sum'];

                $totalCount += $cnt;
                $totalGross += $gross;

                if (isset($summary['status_breakdown'][$st])) {
                    $summary['status_breakdown'][$st] = $cnt;
                } else {
                    $summary['status_breakdown'][$st] = $cnt;
                }
            }

            $summary['total_orders'] = $totalCount;
            $summary['gross_sales'] = round($totalGross, 2);

            // 2. Losses from ledger
            $stmtLoss = $this->db->prepare("SELECT 
                loss_type,
                COALESCE(SUM(loss_amount), 0) as total_loss
                FROM `commerce_loss_ledger`
                WHERE platform = :platform AND shop_id = :shop_id
                  AND order_created_at >= :start_dt AND order_created_at < :end_dt
                GROUP BY loss_type");
            $stmtLoss->execute([
                ':platform' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':start_dt' => $startDt,
                ':end_dt' => $endDt
            ]);
            $lossRows = $stmtLoss->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $cancellationLoss = 0.0;
            $refundLoss = 0.0;
            $failedDeliveryLoss = 0.0;

            foreach ($lossRows as $lr) {
                $type = (string)$lr['loss_type'];
                $amt = (float)$lr['total_loss'];

                if ($type === 'CANCELLATION') {
                    $cancellationLoss += $amt;
                } elseif ($type === 'REFUND' || $type === 'PARTIAL_REFUND' || $type === 'RETURN_REFUND') {
                    $refundLoss += $amt;
                } elseif ($type === 'FAILED_DELIVERY') {
                    $failedDeliveryLoss += $amt;
                }
            }

            $totalLoss = min($totalGross, $cancellationLoss + $refundLoss + $failedDeliveryLoss);
            $realizedSales = max(0.0, $totalGross - $totalLoss);

            $summary['cancellation_loss'] = round($cancellationLoss, 2);
            $summary['refund_loss'] = round($refundLoss, 2);
            $summary['failed_delivery_loss'] = round($failedDeliveryLoss, 2);
            $summary['total_loss'] = round($totalLoss, 2);
            $summary['realized_sales'] = round($realizedSales, 2);

            if ($totalGross > 0) {
                $summary['loss_rate_pct'] = round(($totalLoss / $totalGross) * 100, 2);
            }
            if ($totalCount > 0) {
                $summary['aov'] = round($totalGross / $totalCount, 2);
            }

            // 3. Finance & Settlements
            $stmtFinance = $this->db->prepare("SELECT 
                COALESCE(SUM(total_settlement_amount), 0) as total_settled,
                COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_settlement_amount ELSE 0 END), 0) as paid_settled,
                COALESCE(SUM(CASE WHEN payment_status != 'PAID' THEN total_settlement_amount ELSE 0 END), 0) as pending_settled
                FROM `commerce_finance_statements`
                WHERE platform = :platform AND shop_id = :shop_id
                  AND statement_time >= :start_dt AND statement_time <= :end_dt");
            $stmtFinance->execute([
                ':platform' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':start_dt' => $startDt,
                ':end_dt' => date('Y-m-d 23:59:59', strtotime($endDate))
            ]);
            $finRow = $stmtFinance->fetch(PDO::FETCH_ASSOC) ?: [];

            $summary['settlement']['settled_amount'] = (float)($finRow['paid_settled'] ?? 0.0);
            $summary['settlement']['unsettled_amount'] = (float)($finRow['pending_settled'] ?? 0.0);
            $summary['settlement']['net_payout'] = (float)($finRow['paid_settled'] ?? 0.0);

        } catch (\Throwable $t) {
            error_log("Error in getShopeeSummary: " . $t->getMessage());
        }

        return $summary;
    }

    /**
     * Paginated list of Shopee orders with line item enrichment
     */
    public function getShopeeOrders(
        string $shopId,
        string $startDate,
        string $endDate,
        string $status = '',
        string $search = '',
        int $page = 1,
        int $limit = 25
    ): array {
        $offset = ($page - 1) * $limit;
        $startDt = $startDate . ' 00:00:00';
        $endDt = date('Y-m-d 00:00:00', strtotime($endDate . ' +1 day'));

        $where = ["o.platform = :platform", "o.shop_id = :shop_id"];
        $params = [
            ':platform' => self::PLATFORM,
            ':shop_id' => $shopId
        ];

        if (!empty($startDate) && !empty($endDate)) {
            $where[] = "o.platform_created_at >= :start_dt AND o.platform_created_at < :end_dt";
            $params[':start_dt'] = $startDt;
            $params[':end_dt'] = $endDt;
        }

        if ($status === 'RETURN_REFUND') {
            $where[] = "(
                EXISTS (SELECT 1 FROM `commerce_aftersales` a WHERE a.platform = o.platform AND a.shop_id = o.shop_id AND a.platform_order_id = o.platform_order_id)
                OR EXISTS (SELECT 1 FROM `commerce_loss_ledger` l WHERE l.platform = o.platform AND l.shop_id = o.shop_id AND l.platform_order_id = o.platform_order_id AND l.loss_type IN ('REFUND', 'PARTIAL_REFUND', 'RETURN_REFUND'))
            )";
        } elseif (!empty($status)) {
            $where[] = "o.order_status = :status";
            $params[':status'] = $status;
        }

        if (!empty($search)) {
            $where[] = "(o.platform_order_id LIKE :search OR EXISTS (SELECT 1 FROM `commerce_order_items` i WHERE i.order_id = o.id AND i.product_name LIKE :search_item))";
            $params[':search'] = '%' . $search . '%';
            $params[':search_item'] = '%' . $search . '%';
        }

        $whereSql = implode(' AND ', $where);

        $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM `commerce_orders` o WHERE {$whereSql}");
        $stmtCount->execute($params);
        $totalCount = (int)$stmtCount->fetchColumn();

        $stmtList = $this->db->prepare("SELECT 
            o.id, o.platform, o.shop_id, o.platform_order_id, o.order_status, o.platform_status,
            o.platform_created_at, o.paid_at, o.currency, o.order_gross_amount, o.sub_total,
            o.shipping_fee, o.seller_discount, o.platform_discount, o.shipping_provider, o.tracking_number
            FROM `commerce_orders` o
            WHERE {$whereSql}
            ORDER BY o.platform_created_at DESC
            LIMIT {$limit} OFFSET {$offset}");
        $stmtList->execute($params);
        $orders = $stmtList->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Enrich orders with line items & aftersales
        if (!empty($orders)) {
            $orderIds = array_column($orders, 'id');
            $inPlaceholders = implode(',', array_fill(0, count($orderIds), '?'));

            $stmtItems = $this->db->prepare("SELECT order_id, product_name, sku_id, quantity, sale_price 
                FROM `commerce_order_items` 
                WHERE order_id IN ({$inPlaceholders})");
            $stmtItems->execute($orderIds);
            $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $itemMap = [];
            foreach ($items as $it) {
                $itemMap[$it['order_id']][] = [
                    'product_name' => $it['product_name'],
                    'sku_id' => $it['sku_id'],
                    'quantity' => (int)$it['quantity'],
                    'sale_price' => (float)$it['sale_price']
                ];
            }

            foreach ($orders as &$ord) {
                $ord['items'] = $itemMap[$ord['id']] ?? [];
                $ord['order_gross_amount'] = (float)$ord['order_gross_amount'];
                $ord['shipping_fee'] = (float)$ord['shipping_fee'];
                $ord['seller_discount'] = (float)$ord['seller_discount'];
                $ord['platform_discount'] = (float)$ord['platform_discount'];
            }
            unset($ord);
        }

        return [
            'orders' => $orders,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total_records' => $totalCount,
                'total_pages' => ceil($totalCount / $limit)
            ]
        ];
    }

    /**
     * Computes 7x24 Golden Hour Matrix and Top 5 Conversion Slots for Shopee
     */
    public function getShopeeGoldenHours(string $shopId, string $startDate = '', string $endDate = ''): array {
        $where = ["platform = :platform", "shop_id = :shop_id"];
        $params = [':platform' => self::PLATFORM, ':shop_id' => $shopId];

        if (!empty($startDate) && !empty($endDate)) {
            $where[] = "platform_created_at >= :start_dt AND platform_created_at <= :end_dt";
            $params[':start_dt'] = $startDate . ' 00:00:00';
            $params[':end_dt'] = $endDate . ' 23:59:59';
        } else {
            // Default: last 90 days
            $where[] = "platform_created_at >= :start_dt";
            $params[':start_dt'] = date('Y-m-d 00:00:00', strtotime('-90 days'));
        }

        $whereSql = implode(' AND ', $where);

        // 7 days x 24 hours matrix: 0=Sunday, 1=Monday... 6=Saturday
        $matrix = [];
        for ($day = 0; $day < 7; $day++) {
            $matrix[$day] = [];
            for ($hour = 0; $hour < 24; $hour++) {
                $matrix[$day][$hour] = [
                    'orders_count' => 0,
                    'gross_sales' => 0.0
                ];
            }
        }

        // SQLite vs MariaDB compatibility for DAYOFWEEK / strftime
        $isSqlite = ($this->db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite');

        if ($isSqlite) {
            $sql = "SELECT 
                CAST(strftime('%w', platform_created_at) AS INTEGER) as dow,
                CAST(strftime('%H', platform_created_at) AS INTEGER) as hour_of_day,
                COUNT(*) as orders_count,
                COALESCE(SUM(order_gross_amount), 0) as gross_sales
                FROM `commerce_orders`
                WHERE {$whereSql}
                GROUP BY dow, hour_of_day";
        } else {
            $sql = "SELECT 
                (DAYOFWEEK(platform_created_at) - 1) as dow,
                HOUR(platform_created_at) as hour_of_day,
                COUNT(*) as orders_count,
                COALESCE(SUM(order_gross_amount), 0) as gross_sales
                FROM `commerce_orders`
                WHERE {$whereSql}
                GROUP BY dow, hour_of_day";
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $allSlots = [];
        $dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

        foreach ($rows as $r) {
            $d = (int)$r['dow'];
            $h = (int)$r['hour_of_day'];
            $cnt = (int)$r['orders_count'];
            $amt = (float)$r['gross_sales'];

            if (isset($matrix[$d][$h])) {
                $matrix[$d][$h] = [
                    'orders_count' => $cnt,
                    'gross_sales' => round($amt, 2)
                ];
            }

            $allSlots[] = [
                'day_of_week' => $d,
                'day_name' => $dayNames[$d] ?? 'N/A',
                'hour' => $h,
                'hour_label' => sprintf('%02d:00 - %02d:59', $h, $h),
                'orders_count' => $cnt,
                'gross_sales' => round($amt, 2)
            ];
        }

        // Sort to find Top 5 golden hours
        usort($allSlots, function($a, $b) {
            return $b['gross_sales'] <=> $a['gross_sales'];
        });

        $topGoldenSlots = array_slice($allSlots, 0, 5);

        return [
            'platform' => self::PLATFORM,
            'matrix' => $matrix,
            'top_golden_slots' => $topGoldenSlots,
            'day_names' => $dayNames,
            'disclaimer' => 'Tương quan lịch sử dùng để tham khảo chiến lược phát sóng và đẩy khuyến mại, không bảo đảm chắc chắn hiệu quả trong tương lai.'
        ];
    }

    /**
     * Parses and ingests Shopee CSV/Excel data
     *
     * @param string $shopId
     * @param string $fileType 'orders' | 'returns' | 'settlement'
     * @param string $csvContent Raw CSV text
     * @return array
     */
    public function importShopeeCsv(string $shopId, string $fileType, string $csvContent): array {
        // Strip UTF-8 BOM if present
        if (substr($csvContent, 0, 3) === "\xEF\xBB\xBF") {
            $csvContent = substr($csvContent, 3);
        }

        $lines = preg_split('/\r\n|\r|\n/', trim($csvContent));
        if (empty($lines)) {
            return ['success' => false, 'message' => 'Tệp rỗng hoặc không có dữ liệu hợp lệ'];
        }

        // Detect delimiter: comma, semicolon, tab
        $firstLine = $lines[0];
        $delimiter = ',';
        if (substr_count($firstLine, ';') > substr_count($firstLine, ',')) {
            $delimiter = ';';
        } elseif (substr_count($firstLine, "\t") > substr_count($firstLine, ',')) {
            $delimiter = "\t";
        }

        $header = str_getcsv($firstLine, $delimiter);
        $headerMap = [];
        foreach ($header as $idx => $col) {
            $cleanCol = mb_strtolower(trim((string)$col), 'UTF-8');
            $headerMap[$cleanCol] = $idx;
        }

        $parsedRows = [];
        for ($i = 1; $i < count($lines); $i++) {
            $line = trim($lines[$i]);
            if (empty($line)) continue;
            $row = str_getcsv($line, $delimiter);
            $parsedRows[] = $row;
        }

        $importedOrders = 0;
        $importedItems = 0;
        $importedLosses = 0;

        $this->db->beginTransaction();
        try {
            if ($fileType === 'orders' || $fileType === 'all_orders') {
                // Group by order ID to avoid duplicate gross value across multiple line items
                $ordersGrouped = [];
                foreach ($parsedRows as $r) {
                    $orderId = $this->extractCol($r, $headerMap, ['mã đơn hàng', 'order id', 'order_id', 'mã đơn']);
                    if (empty($orderId)) continue;

                    $statusRaw = $this->extractCol($r, $headerMap, ['trạng thái đơn hàng', 'trạng thái đơn', 'order status', 'status']);
                    $createdAtRaw = $this->extractCol($r, $headerMap, ['ngày đặt hàng', 'thời gian tạo', 'order creation date', 'created_at']);
                    $grossRaw = $this->extractCol($r, $headerMap, ['tổng giá trị đơn hàng (vnd)', 'tổng giá trị đơn hàng', 'total amount', 'order total']);
                    $shippingRaw = $this->extractCol($r, $headerMap, ['phí vận chuyển', 'shipping fee', 'phí vận chuyển (vnd)']);
                    $sellerDiscountRaw = $this->extractCol($r, $headerMap, ['giảm giá của shop', 'seller discount', 'mã giảm giá của shop']);
                    $carrierRaw = $this->extractCol($r, $headerMap, ['đơn vị vận chuyển', 'shipping carrier', 'shipping provider']);
                    $productName = $this->extractCol($r, $headerMap, ['tên sản phẩm', 'product name', 'item name']);
                    $skuId = $this->extractCol($r, $headerMap, ['mã sku', 'sku reference no.', 'sku']);
                    $qtyRaw = $this->extractCol($r, $headerMap, ['số lượng', 'quantity', 'qty']);
                    $salePriceRaw = $this->extractCol($r, $headerMap, ['giá bán', 'unit price', 'deal price']);

                    if (!isset($ordersGrouped[$orderId])) {
                        $ordersGrouped[$orderId] = [
                            'platform_order_id' => $orderId,
                            'status_raw' => $statusRaw,
                            'created_at' => $this->parseTimestamp($createdAtRaw),
                            'gross_amount' => $this->parseNumber($grossRaw),
                            'shipping_fee' => $this->parseNumber($shippingRaw),
                            'seller_discount' => $this->parseNumber($sellerDiscountRaw),
                            'carrier' => $carrierRaw,
                            'items' => []
                        ];
                    }

                    if (!empty($productName)) {
                        $ordersGrouped[$orderId]['items'][] = [
                            'product_name' => $productName,
                            'sku_id' => $skuId ?: 'SHOPEE-SKU',
                            'quantity' => max(1, (int)$this->parseNumber($qtyRaw)),
                            'sale_price' => $this->parseNumber($salePriceRaw)
                        ];
                    }
                }

                // Ingest normalized orders
                $stmtOrderUpsert = $this->db->prepare("INSERT INTO `commerce_orders` (
                    platform, shop_id, platform_order_id, order_status, platform_status,
                    platform_created_at, currency, order_gross_amount, shipping_fee,
                    seller_discount, shipping_provider
                ) VALUES (
                    :platform, :shop_id, :order_id, :status, :p_status,
                    :created_at, 'VND', :gross, :shipping,
                    :discount, :carrier
                ) ON DUPLICATE KEY UPDATE
                    order_status = VALUES(order_status),
                    platform_status = VALUES(platform_status),
                    order_gross_amount = VALUES(order_gross_amount),
                    updated_at = CURRENT_TIMESTAMP");

                // SQLite fallback query for tests
                $isSqlite = ($this->db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite');
                if ($isSqlite) {
                    $stmtOrderUpsert = $this->db->prepare("INSERT OR REPLACE INTO `commerce_orders` (
                        platform, shop_id, platform_order_id, order_status, platform_status,
                        platform_created_at, currency, order_gross_amount, shipping_fee,
                        seller_discount, shipping_provider
                    ) VALUES (
                        :platform, :shop_id, :order_id, :status, :p_status,
                        :created_at, 'VND', :gross, :shipping,
                        :discount, :carrier
                    )");
                }

                $stmtItemInsert = $this->db->prepare("INSERT INTO `commerce_order_items` (
                    order_id, platform, shop_id, platform_order_id, product_name, sku_id, quantity, sale_price
                ) VALUES (
                    :order_id, :platform, :shop_id, :p_order_id, :name, :sku, :qty, :price
                )");

                foreach ($ordersGrouped as $ord) {
                    $normalizedStatus = $this->normalizeShopeeStatus($ord['status_raw']);
                    $stmtOrderUpsert->execute([
                        ':platform' => self::PLATFORM,
                        ':shop_id' => $shopId,
                        ':order_id' => $ord['platform_order_id'],
                        ':status' => $normalizedStatus,
                        ':p_status' => $ord['status_raw'],
                        ':created_at' => $ord['created_at'],
                        ':gross' => $ord['gross_amount'],
                        ':shipping' => $ord['shipping_fee'],
                        ':discount' => $ord['seller_discount'],
                        ':carrier' => $ord['carrier']
                    ]);
                    $importedOrders++;

                    // Fetch internal order ID
                    $stmtFindId = $this->db->prepare("SELECT id FROM `commerce_orders` WHERE platform = :platform AND shop_id = :shop_id AND platform_order_id = :order_id");
                    $stmtFindId->execute([':platform' => self::PLATFORM, ':shop_id' => $shopId, ':order_id' => $ord['platform_order_id']]);
                    $internalId = (int)$stmtFindId->fetchColumn();

                    // Insert items
                    foreach ($ord['items'] as $item) {
                        $stmtItemInsert->execute([
                            ':order_id' => $internalId,
                            ':platform' => self::PLATFORM,
                            ':shop_id' => $shopId,
                            ':p_order_id' => $ord['platform_order_id'],
                            ':name' => $item['product_name'],
                            ':sku' => $item['sku_id'],
                            ':qty' => $item['quantity'],
                            ':price' => $item['sale_price']
                        ]);
                        $importedItems++;
                    }

                    // Record cancellation loss if status is CANCELLED
                    if ($normalizedStatus === 'CANCELLED' && $ord['gross_amount'] > 0) {
                        $stmtLoss = $this->db->prepare("INSERT INTO `commerce_loss_ledger` (
                            platform, shop_id, platform_order_id, loss_type, loss_amount,
                            perspective, order_created_at
                        ) VALUES (
                            :platform, :shop_id, :order_id, 'CANCELLATION', :loss_amt,
                            'BUYER_SELLER', :created_at
                        )");
                        $stmtLoss->execute([
                            ':platform' => self::PLATFORM,
                            ':shop_id' => $shopId,
                            ':order_id' => $ord['platform_order_id'],
                            ':loss_amt' => $ord['gross_amount'],
                            ':created_at' => $ord['created_at']
                        ]);
                        $importedLosses++;
                    }
                }
            } elseif ($fileType === 'returns' || $fileType === 'refunds') {
                // Ingest Return/Refund aftersales & losses
                foreach ($parsedRows as $r) {
                    $orderId = $this->extractCol($r, $headerMap, ['mã đơn hàng', 'order id', 'order_id']);
                    $refundAmtRaw = $this->extractCol($r, $headerMap, ['số tiền hoàn thực tế (vnd)', 'số tiền hoàn trả', 'refund amount', 'actual refund']);
                    $refundStatusRaw = $this->extractCol($r, $headerMap, ['trạng thái hoàn tiền', 'trạng thái yêu cầu', 'return status', 'status']);
                    $refundReason = $this->extractCol($r, $headerMap, ['lý do hoàn tiền', 'lý do trả hàng', 'return reason', 'reason']);

                    if (empty($orderId)) continue;
                    $refundAmt = $this->parseNumber($refundAmtRaw);
                    if ($refundAmt <= 0) continue;

                    // Query original order date
                    $stmtOrderDate = $this->db->prepare("SELECT platform_created_at FROM `commerce_orders` WHERE platform = :p AND shop_id = :s AND platform_order_id = :o");
                    $stmtOrderDate->execute([':p' => self::PLATFORM, ':s' => $shopId, ':o' => $orderId]);
                    $orderCreatedAt = $stmtOrderDate->fetchColumn() ?: date('Y-m-d H:i:s');

                    $stmtLoss = $this->db->prepare("INSERT INTO `commerce_loss_ledger` (
                        platform, shop_id, platform_order_id, loss_type, loss_amount,
                        perspective, order_created_at
                    ) VALUES (
                        :platform, :shop_id, :order_id, 'REFUND', :loss_amt,
                        'BUYER_SELLER', :created_at
                    )");
                    $stmtLoss->execute([
                        ':platform' => self::PLATFORM,
                        ':shop_id' => $shopId,
                        ':order_id' => $orderId,
                        ':loss_amt' => $refundAmt,
                        ':created_at' => $orderCreatedAt
                    ]);
                    $importedLosses++;
                }
            } elseif ($fileType === 'settlement' || $fileType === 'income') {
                // Ingest settlement statements
                foreach ($parsedRows as $r) {
                    $stmtId = $this->extractCol($r, $headerMap, ['mã bảng kê', 'statement id', 'mã phiên quyết toán', 'mã giao dịch']);
                    $timeRaw = $this->extractCol($r, $headerMap, ['thời gian thanh toán', 'ngày quyết toán', 'payment time', 'date']);
                    $amountRaw = $this->extractCol($r, $headerMap, ['số tiền thanh toán (vnd)', 'tiền quyết toán', 'settlement amount', 'payout amount']);

                    if (empty($stmtId)) continue;
                    $settlementAmt = $this->parseNumber($amountRaw);

                    $stmtInsert = $this->db->prepare("INSERT INTO `commerce_finance_statements` (
                        platform, shop_id, statement_id, statement_time, payment_time,
                        total_settlement_amount, currency, payment_status
                    ) VALUES (
                        :platform, :shop_id, :stmt_id, :stmt_time, :stmt_time,
                        :amount, 'VND', 'PAID'
                    )");
                    $stmtInsert->execute([
                        ':platform' => self::PLATFORM,
                        ':shop_id' => $shopId,
                        ':stmt_id' => $stmtId,
                        ':stmt_time' => $this->parseTimestamp($timeRaw),
                        ':amount' => $settlementAmt
                    ]);
                }
            }

            $this->db->commit();
            return [
                'success' => true,
                'imported_orders' => $importedOrders,
                'imported_items' => $importedItems,
                'imported_losses' => $importedLosses,
                'message' => "Nhập tệp Shopee ({$fileType}) thành công: {$importedOrders} đơn hàng, {$importedItems} dòng sản phẩm."
            ];
        } catch (\Throwable $t) {
            $this->db->rollBack();
            error_log("Failed to import Shopee CSV: " . $t->getMessage());
            return [
                'success' => false,
                'message' => 'Lỗi xử lý tệp Shopee: ' . $t->getMessage()
            ];
        }
    }

    /**
     * Exports Shopee orders to UTF-8 BOM CSV format
     */
    public function exportShopeeOrdersCsv(string $shopId, string $startDate, string $endDate, string $status = '', string $search = ''): string {
        $result = $this->getShopeeOrders($shopId, $startDate, $endDate, $status, $search, 1, 50000);
        $orders = $result['orders'] ?? [];

        $bom = chr(0xEF) . chr(0xBB) . chr(0xBF);
        $header = [
            'Mã đơn hàng',
            'Nền tảng',
            'Trạng thái đơn',
            'Tổng tiền gộp (₫)',
            'Tiền hàng (₫)',
            'Phí vận chuyển (₫)',
            'Giảm giá shop (₫)',
            'Giảm giá sàn (₫)',
            'Tiền tệ',
            'Đơn vị vận chuyển',
            'Thời gian tạo'
        ];

        $output = fopen('php://temp', 'r+');
        fputcsv($output, $header);

        foreach ($orders as $ord) {
            $row = [
                $ord['platform_order_id'],
                'Shopee',
                $ord['order_status'],
                number_format((float)$ord['order_gross_amount'], 0, '', ''),
                number_format((float)$ord['sub_total'], 0, '', ''),
                number_format((float)$ord['shipping_fee'], 0, '', ''),
                number_format((float)$ord['seller_discount'], 0, '', ''),
                number_format((float)$ord['platform_discount'], 0, '', ''),
                $ord['currency'] ?? 'VND',
                $ord['shipping_provider'] ?? '—',
                $ord['platform_created_at'] ?? '—'
            ];
            fputcsv($output, $row);
        }

        rewind($output);
        $csvBody = stream_get_contents($output);
        fclose($output);

        return $bom . $csvBody;
    }

    // Helper: Normalize raw Shopee status
    private function normalizeShopeeStatus(string $raw): string {
        $clean = mb_strtolower(trim($raw), 'UTF-8');
        if (str_contains($clean, 'hủy') || str_contains($clean, 'cancel')) {
            return 'CANCELLED';
        }
        if (str_contains($clean, 'trả hàng') || str_contains($clean, 'hoàn tiền') || str_contains($clean, 'return') || str_contains($clean, 'refund')) {
            return 'RETURN_REFUND';
        }
        if (str_contains($clean, 'giao không thành công') || str_contains($clean, 'thất bại') || str_contains($clean, 'failed')) {
            return 'FAILED_DELIVERY';
        }
        if (str_contains($clean, 'hoàn thành') || str_contains($clean, 'completed') || str_contains($clean, 'đã giao')) {
            return 'COMPLETED';
        }
        if (str_contains($clean, 'đang giao') || str_contains($clean, 'vận chuyển') || str_contains($clean, 'in transit') || str_contains($clean, 'shipped')) {
            return 'IN_TRANSIT';
        }
        if (str_contains($clean, 'chờ lấy hàng') || str_contains($clean, 'chờ xác nhận') || str_contains($clean, 'chờ giao') || str_contains($clean, 'to ship')) {
            return 'AWAITING_SHIPMENT';
        }
        if (str_contains($clean, 'chưa thanh toán') || str_contains($clean, 'unpaid')) {
            return 'UNPAID';
        }
        return 'COMPLETED';
    }

    // Helper: extract column value with fallbacks
    private function extractCol(array $row, array $map, array $candidates): string {
        foreach ($candidates as $cand) {
            $candClean = mb_strtolower(trim($cand), 'UTF-8');
            if (isset($map[$candClean]) && isset($row[$map[$candClean]])) {
                return trim((string)$row[$map[$candClean]]);
            }
        }
        return '';
    }

    // Helper: parse string to float
    private function parseNumber(string $str): float {
        $clean = preg_replace('/[^\d.-]/', '', str_replace(',', '', $str));
        return (float)$clean;
    }

    // Helper: parse date string
    private function parseTimestamp(string $str): string {
        if (empty($str)) return date('Y-m-d H:i:s');
        $ts = strtotime(str_replace('/', '-', $str));
        return $ts ? date('Y-m-d H:i:s', $ts) : date('Y-m-d H:i:s');
    }
}
