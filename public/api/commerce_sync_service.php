<?php
/**
 * ADDP Commerce Intelligence - Core Orders Engine V2 Sync Service
 * 
 * Implements:
 * - TikTok Orders v202309 cursor pagination (page_size up to 100)
 * - Three-token checkpoint tracking (current_page_token, next_page_token, resume_page_token)
 * - Page-level transaction boundaries with safe rollback on failure
 * - Idempotent upsert for commerce_orders and commerce_order_items
 * - Recursive denylist PII sanitizer with post-verification
 * - Sanitized raw observation persistence with SHA-256 deduplication
 * - 90-day rolling observation retention cleanup
 * - Incremental delta sync via update_time with 2-hour safety overlap
 * 
 * Safety: Zero disruption to legacy tables (tiktok_orders, tiktok_seller_center_snapshots).
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/tiktok_client.php';

class SecurityException extends Exception {}

class CommerceSyncService {
    public const PLATFORM_TIKTOK_SHOP = 'tiktok_shop';
    public const SOURCE_DOMAIN_ORDER = 'order';
    public const API_VERSION_202309 = '202309';
    public const DEFAULT_RETENTION_DAYS = 90;

    private PDO $db;
    private TikTokShopClient $client;

    public function __construct(?PDO $db = null, ?TikTokShopClient $client = null) {
        $this->db = $db ?? getDBConnection();
        $this->client = $client ?? new TikTokShopClient();
    }

    /**
     * Recursive denylist sanitizer: Strips all prohibited PII fields from arbitrary payload depth
     */
    public static function sanitizeOrderPayloadRecursive(mixed $data): mixed {
        $denylist = [
            'phone', 'phone_number', 'full_address', 'address_line1', 'address_line2',
            'recipient_address', 'shipping_address', 'billing_address',
            'buyer_uid', 'buyer_email', 'buyer_name', 'buyer_message',
            'name', 'sender_address'
        ];

        if (is_array($data)) {
            $cleaned = [];
            foreach ($data as $key => $val) {
                $lowerKey = strtolower((string)$key);
                if (in_array($lowerKey, $denylist, true)) {
                    continue; // Skip forbidden key entirely
                }
                $cleaned[$key] = self::sanitizeOrderPayloadRecursive($val);
            }
            return $cleaned;
        }

        return $data;
    }

    /**
     * Post-sanitization security verifier: Asserts no forbidden PII remains in any nested key
     */
    public static function verifyNoForbiddenPii(mixed $data): bool {
        $forbiddenSubstrings = ['phone', 'email', 'full_address', 'address_line', 'buyer_uid', 'buyer_name'];
        if (is_array($data)) {
            foreach ($data as $k => $v) {
                $lowerKey = strtolower((string)$k);
                foreach ($forbiddenSubstrings as $fk) {
                    if (str_contains($lowerKey, $fk)) {
                        return false;
                    }
                }
                if (!self::verifyNoForbiddenPii($v)) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Normalizes raw platform order status string to unified commerce status vocabulary
     */
    public static function normalizeOrderStatus(string $platformStatus): string {
        $upper = strtoupper(trim($platformStatus));
        return match ($upper) {
            'UNPAID' => 'UNPAID',
            'AWAITING_SHIPMENT', 'AWAITING_COLLECTION' => 'AWAITING_SHIPMENT',
            'IN_TRANSIT', 'PARTIALLY_SHIPPED' => 'IN_TRANSIT',
            'DELIVERED' => 'DELIVERED',
            'COMPLETED' => 'COMPLETED',
            'CANCELLED' => 'CANCELLED',
            default => $upper !== '' ? $upper : 'UNKNOWN',
        };
    }

    /**
     * Executes initial historical backfill for date range with cursor pagination
     */
    public function initialBackfill(
        string $shopId,
        int $startTimestamp,
        int $endTimestamp,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 200,
        ?string $resumeToken = null
    ): array {
        return $this->executeSyncSession(
            $shopId,
            'INITIAL_BACKFILL',
            ['create_time_ge' => $startTimestamp, 'create_time_lt' => $endTimestamp],
            $startTimestamp,
            $endTimestamp,
            $pageSize,
            $maxPagesSafetyGuard,
            $resumeToken
        );
    }

    /**
     * Executes order synchronization for an explicit date window (coverage sync or mutation refresh).
     *
     * @param string $shopId
     * @param int $startTimestamp Unix timestamp (inclusive)
     * @param int $endTimestamp Unix timestamp (exclusive)
     * @param int $pageSize Page size (max 100)
     * @param int $maxPagesSafetyGuard Max pages safety guard
     * @param string|null $resumeToken
     * @param string $syncType 'COVERAGE_WINDOW' | 'INITIAL_BACKFILL' | 'MUTATION_REFRESH' | 'INCREMENTAL_DELTA'
     * @param string $timeFilterType 'create_time' | 'update_time'
     * @return array
     */
    public function syncOrdersWindow(
        string $shopId,
        int $startTimestamp,
        int $endTimestamp,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 100,
        ?string $resumeToken = null,
        string $syncType = 'COVERAGE_WINDOW',
        string $timeFilterType = 'create_time'
    ): array {
        $filterKeyGe = ($timeFilterType === 'update_time') ? 'update_time_ge' : 'create_time_ge';
        $filterKeyLt = ($timeFilterType === 'update_time') ? 'update_time_lt' : 'create_time_lt';

        return $this->executeSyncSession(
            $shopId,
            $syncType,
            [$filterKeyGe => $startTimestamp, $filterKeyLt => $endTimestamp],
            $startTimestamp,
            $endTimestamp,
            $pageSize,
            $maxPagesSafetyGuard,
            $resumeToken
        );
    }

    /**
     * Executes incremental delta sync based on latest update_time watermark with safety overlap
     */
    public function incrementalSync(
        string $shopId,
        int $overlapSeconds = 7200,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 100
    ): array {
        $stmtWatermark = $this->db->prepare("SELECT MAX(platform_updated_at) FROM `commerce_orders` WHERE platform = ? AND shop_id = ?");
        $stmtWatermark->execute([self::PLATFORM_TIKTOK_SHOP, $shopId]);
        $latestUpdated = $stmtWatermark->fetchColumn();

        if (empty($latestUpdated)) {
            // No previous sync found: fallback to 30 days initial backfill
            $thirtyDaysAgo = time() - 30 * 86400;
            return $this->initialBackfill($shopId, $thirtyDaysAgo, time(), $pageSize, $maxPagesSafetyGuard);
        }

        $latestTimestamp = strtotime($latestUpdated);
        $syncStart = max(0, $latestTimestamp - $overlapSeconds);
        $syncEnd = time();

        return $this->executeSyncSession(
            $shopId,
            'INCREMENTAL_DELTA',
            ['update_time_ge' => $syncStart, 'update_time_lt' => $syncEnd],
            $syncStart,
            $syncEnd,
            $pageSize,
            $maxPagesSafetyGuard,
            null
        );
    }

    /**
     * Resolves TikTok API access token safely for shop
     */
    protected function resolveAccessToken(string $shopId): ?string {
        if (($_SERVER['APP_ENV'] ?? '') === 'testing' || getenv('APP_ENV') === 'testing') {
            try {
                $stmt = $this->db->prepare("SELECT access_token FROM `tiktok_config` WHERE shop_id = ? LIMIT 1");
                $stmt->execute([$shopId]);
                $token = $stmt->fetchColumn();
                if (!empty($token)) {
                    return (string)$token;
                }
            } catch (\Throwable $t) {}
        }

        if (function_exists('getAccessToken')) {
            try {
                $accessToken = getAccessToken($shopId);
                if (!empty($accessToken)) {
                    return $accessToken;
                }
            } catch (\Throwable $t) {}
        }

        try {
            $stmt = $this->db->prepare("SELECT access_token FROM `tiktok_config` WHERE shop_id = ? LIMIT 1");
            $stmt->execute([$shopId]);
            $token = $stmt->fetchColumn();
            if (!empty($token)) {
                return (string)$token;
            }
        } catch (\Throwable $t) {}

        return null;
    }

    /**
     * Core sync execution engine with 3-token checkpoint model & page-level transaction boundaries
     */
    private function executeSyncSession(
        string $shopId,
        string $syncType,
        array $queryFilters,
        int $windowStart,
        int $windowEnd,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 200,
        ?string $resumeToken = null
    ): array {
        if ($pageSize < 1 || $pageSize > 100) {
            $pageSize = 100;
        }

        // 1. Obtain shop cipher and valid token safely
        $stmtConfig = $this->db->prepare("SELECT * FROM `tiktok_config` WHERE shop_id = ? LIMIT 1");
        $stmtConfig->execute([$shopId]);
        $accessToken = $this->resolveAccessToken($shopId);
        if (!$accessToken) {
            throw new RuntimeException("No valid TikTok access token found for shop: {$shopId}");
        }
        $shops = $this->client->getAuthorizedShops($accessToken);
        $shopCipher = null;
        foreach ($shops as $s) {
            if (($s['id'] ?? '') === $shopId || ($s['cipher'] ?? $s['shop_cipher'] ?? null)) {
                $shopCipher = $s['cipher'] ?? $s['shop_cipher'] ?? null;
                break;
            }
        }
        if (!$shopCipher && !empty($shops)) {
            $shopCipher = $shops[0]['cipher'] ?? $shops[0]['shop_cipher'] ?? null;
        }

        // 2. Initialize commerce_sync_runs session
        $windowStartTs = ($windowStart !== null && $windowStart > 0) ? $windowStart : null;
        $windowEndTs = ($windowEnd !== null && $windowEnd > 0) ? $windowEnd : null;
        $resumeTokenStr = !empty($resumeToken) ? trim((string)$resumeToken) : null;
        $startDateStr = ($windowStartTs !== null && $windowStartTs > 0) ? date('Y-m-d', $windowStartTs) : null;
        $endDateStr = ($windowEndTs !== null && $windowEndTs > 0) ? date('Y-m-d', $windowEndTs) : null;
        $apiEndpoint = defined('TIKTOK_API_ORDER_SEARCH_ENDPOINT') ? TIKTOK_API_ORDER_SEARCH_ENDPOINT : '/order/202309/orders/search';

        static $syncRunsCols = null;
        if ($syncRunsCols === null) {
            $defaultCols = [
                'id', 'platform', 'shop_id', 'source_domain', 'sync_type', 'status',
                'window_start_time', 'window_end_time', 'start_date', 'end_date',
                'current_page_token', 'last_page_token', 'pages_processed',
                'orders_ingested', 'orders_updated', 'items_ingested',
                'records_read', 'records_written', 'latest_available_date',
                'api_endpoint', 'error_code', 'error_message', 'started_at', 'completed_at'
            ];
            try {
                $cols = $this->db->query("SHOW COLUMNS FROM `commerce_sync_runs`")->fetchAll(PDO::FETCH_COLUMN);
                $syncRunsCols = !empty($cols) ? array_flip($cols) : array_flip($defaultCols);
            } catch (Throwable $e) {
                $syncRunsCols = array_flip($defaultCols);
            }
        }

        $insertData = [
            'platform' => self::PLATFORM_TIKTOK_SHOP,
            'shop_id' => $shopId,
            'sync_type' => $syncType,
            'status' => 'RUNNING',
            'started_at' => date('Y-m-d H:i:s')
        ];
        if (isset($syncRunsCols['source_domain'])) {
            $insertData['source_domain'] = self::SOURCE_DOMAIN_ORDER;
        }
        if ($windowStartTs !== null && isset($syncRunsCols['window_start_time'])) {
            $insertData['window_start_time'] = date('Y-m-d H:i:s', $windowStartTs);
        }
        if ($windowEndTs !== null && isset($syncRunsCols['window_end_time'])) {
            $insertData['window_end_time'] = date('Y-m-d H:i:s', $windowEndTs);
        }
        if ($startDateStr !== null && isset($syncRunsCols['start_date'])) {
            $insertData['start_date'] = $startDateStr;
        }
        if ($endDateStr !== null && isset($syncRunsCols['end_date'])) {
            $insertData['end_date'] = $endDateStr;
        }
        if (isset($syncRunsCols['api_endpoint'])) {
            $insertData['api_endpoint'] = $apiEndpoint;
        }
        if ($resumeTokenStr !== null && isset($syncRunsCols['current_page_token'])) {
            $insertData['current_page_token'] = $resumeTokenStr;
            $insertData['last_page_token'] = $resumeTokenStr;
        }

        $fields = array_keys($insertData);
        $escapedFields = array_map(fn($f) => "`{$f}`", $fields);
        $placeholders = array_fill(0, count($fields), '?');
        $sql = "INSERT INTO `commerce_sync_runs` (" . implode(', ', $escapedFields) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $stmtRun = $this->db->prepare($sql);
        $stmtRun->execute(array_values($insertData));
        $runId = (int)$this->db->lastInsertId();

        $currentPageToken = $resumeTokenStr;
        $pageCount = 0;
        $totalOrders = 0;
        $totalItems = 0;
        $seenCursors = [];
        if ($currentPageToken !== null && $currentPageToken !== '') {
            $seenCursors[$currentPageToken] = true;
        }

        $sessionStatus = 'RUNNING';
        $errorMessage = null;

        while (true) {
            // A. Checkpoint & Safety Guard check
            if ($pageCount >= $maxPagesSafetyGuard) {
                $sessionStatus = 'PARTIAL';
                $errorMessage = "Reached max_pages_safety_guard ({$maxPagesSafetyGuard} pages). Checkpoint preserved for next run.";
                break;
            }

            // B. Prepare search request options
            $searchOptions = array_merge($queryFilters, [
                'page_size' => $pageSize,
                'page_token' => $currentPageToken
            ]);

            try {
                $searchResult = $this->client->searchOrdersV2($accessToken, $shopCipher, $searchOptions);
            } catch (Throwable $e) {
                $sessionStatus = 'FAILED';
                $errorMessage = "TikTok API Search failed: " . $e->getMessage();
                break;
            }

            $orders = $searchResult['orders'] ?? [];
            $nextPageToken = isset($searchResult['next_page_token']) ? trim((string)$searchResult['next_page_token']) : '';

            // If empty page received on first or subsequent iteration
            if (empty($orders)) {
                $sessionStatus = 'COMPLETED';
                break;
            }

            // C. PAGE-LEVEL TRANSACTION BOUNDARY:
            // Process all orders, items, sanitized raw observations, and ONLY THEN commit & advance checkpoint
            $this->db->beginTransaction();
            try {
                $pageOrderCount = 0;
                $pageItemCount = 0;
                $pageOrderIds = [];

                foreach ($orders as $order) {
                    $platformOrderId = (string)($order['id'] ?? '');
                    if ($platformOrderId === '') continue;
                    $pageOrderIds[] = $platformOrderId;

                    // 1. Sanitize raw payload recursively and verify
                    $sanitizedOrder = self::sanitizeOrderPayloadRecursive($order);
                    if (!self::verifyNoForbiddenPii($sanitizedOrder)) {
                        throw new SecurityException("Forbidden PII detected in sanitized order payload for order {$platformOrderId}. Aborting persistence.");
                    }

                    $sanitizedJson = json_encode($sanitizedOrder, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                    $payloadHash = hash('sha256', $sanitizedJson);

                    // 2. Upsert sanitized observation into commerce_raw_observations
                    $stmtRaw = $this->db->prepare("INSERT INTO `commerce_raw_observations` 
                        (platform, shop_id, source_domain, api_version, endpoint, entity_type, platform_entity_id, sanitized_payload, payload_hash, observed_at, platform_updated_at, sync_run_id) 
                        VALUES (?, ?, ?, ?, ?, 'order', ?, ?, ?, NOW(), FROM_UNIXTIME(?), ?)
                        ON DUPLICATE KEY UPDATE 
                        sanitized_payload = VALUES(sanitized_payload),
                        observed_at = NOW(),
                        sync_run_id = VALUES(sync_run_id)");
                    $platformUpdatedAtTs = (int)($order['update_time'] ?? 0);
                    $stmtRaw->execute([
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        self::SOURCE_DOMAIN_ORDER,
                        self::API_VERSION_202309,
                        defined('TIKTOK_API_ORDER_SEARCH_ENDPOINT') ? TIKTOK_API_ORDER_SEARCH_ENDPOINT : '/order/202309/orders/search',
                        $platformOrderId,
                        $sanitizedJson,
                        $payloadHash,
                        $platformUpdatedAtTs > 0 ? $platformUpdatedAtTs : null,
                        $runId
                    ]);
                    $rawObservationId = (int)$this->db->lastInsertId();

                    // 3. Upsert Order Header into commerce_orders
                    $rawStatus = (string)($order['status'] ?? $order['order_status'] ?? '');
                    $normalizedStatus = self::normalizeOrderStatus($rawStatus);
                    $createTimeTs = (int)($order['create_time'] ?? 0);
                    $paidTimeTs = (int)($order['paid_time'] ?? 0);

                    $payment = $order['payment'] ?? [];
                    $orderGrossAmount = (float)($payment['total_amount'] ?? 0.0);
                    $subTotal = (float)($payment['sub_total'] ?? 0.0);
                    $shippingFee = (float)($payment['shipping_fee'] ?? 0.0);
                    $sellerDiscount = (float)($payment['seller_discount'] ?? 0.0);
                    $platformDiscount = (float)($payment['platform_discount'] ?? 0.0);
                    $taxAmount = (float)($payment['tax'] ?? 0.0);
                    $currency = (string)($payment['currency'] ?? 'VND');

                    $shippingProvider = !empty($order['shipping_provider']) ? (string)$order['shipping_provider'] : null;
                    $trackingNumber = !empty($order['tracking_number']) ? (string)$order['tracking_number'] : null;
                    $deliveryType = !empty($order['delivery_type']) ? (string)$order['delivery_type'] : null;
                    $isSplitOrder = !empty($order['is_split_order']) ? 1 : 0;

                    $stmtOrder = $this->db->prepare("INSERT INTO `commerce_orders` (
                        platform, shop_id, platform_order_id, order_status, platform_status,
                        platform_created_at, platform_updated_at, paid_at, currency,
                        order_gross_amount, sub_total, shipping_fee, seller_discount, platform_discount, tax_amount,
                        shipping_provider, tracking_number, delivery_type, is_split_order, sync_run_id, raw_observation_id
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        FROM_UNIXTIME(?), FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?
                    ) ON DUPLICATE KEY UPDATE 
                        order_status = VALUES(order_status),
                        platform_status = VALUES(platform_status),
                        platform_updated_at = VALUES(platform_updated_at),
                        paid_at = VALUES(paid_at),
                        currency = VALUES(currency),
                        order_gross_amount = VALUES(order_gross_amount),
                        sub_total = VALUES(sub_total),
                        shipping_fee = VALUES(shipping_fee),
                        seller_discount = VALUES(seller_discount),
                        platform_discount = VALUES(platform_discount),
                        tax_amount = VALUES(tax_amount),
                        shipping_provider = VALUES(shipping_provider),
                        tracking_number = VALUES(tracking_number),
                        delivery_type = VALUES(delivery_type),
                        is_split_order = VALUES(is_split_order),
                        sync_run_id = VALUES(sync_run_id),
                        raw_observation_id = VALUES(raw_observation_id),
                        updated_at = CURRENT_TIMESTAMP");

                    $stmtOrder->execute([
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        $platformOrderId,
                        $normalizedStatus,
                        $rawStatus,
                        $createTimeTs > 0 ? $createTimeTs : null,
                        $platformUpdatedAtTs > 0 ? $platformUpdatedAtTs : null,
                        $paidTimeTs > 0 ? $paidTimeTs : null,
                        $currency,
                        $orderGrossAmount,
                        $subTotal,
                        $shippingFee,
                        $sellerDiscount,
                        $platformDiscount,
                        $taxAmount,
                        $shippingProvider,
                        $trackingNumber,
                        $deliveryType,
                        $isSplitOrder,
                        $runId,
                        $rawObservationId > 0 ? $rawObservationId : null
                    ]);

                    // Get internal order ID
                    $stmtGetId = $this->db->prepare("SELECT id FROM `commerce_orders` WHERE platform = ? AND shop_id = ? AND platform_order_id = ?");
                    $stmtGetId->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $platformOrderId]);
                    $internalOrderId = (int)$stmtGetId->fetchColumn();

                    $pageOrderCount++;

                    // 4. Upsert Line Items into commerce_order_items
                    $lineItems = $order['line_items'] ?? [];
                    foreach ($lineItems as $item) {
                        $platformLineItemId = (string)($item['id'] ?? '');
                        if ($platformLineItemId === '') continue;

                        $productId = (string)($item['product_id'] ?? '');
                        $productName = function_exists('mb_substr') ? mb_substr((string)($item['product_name'] ?? ''), 0, 255) : substr((string)($item['product_name'] ?? ''), 0, 255);
                        $skuId = (string)($item['sku_id'] ?? '');
                        $skuName = isset($item['sku_name']) ? (function_exists('mb_substr') ? mb_substr((string)$item['sku_name'], 0, 255) : substr((string)$item['sku_name'], 0, 255)) : null;
                        $skuImage = isset($item['sku_image']) ? (string)$item['sku_image'] : null;
                        $quantity = max(1, (int)($item['quantity'] ?? 1));
                        $salePrice = (float)($item['sale_price'] ?? 0.0);
                        $originalPrice = (float)($item['original_price'] ?? 0.0);
                        $itemSellerDiscount = (float)($item['seller_discount'] ?? 0.0);
                        $itemPlatformDiscount = (float)($item['platform_discount'] ?? 0.0);
                        $roomId = !empty($item['room_id']) ? (string)$item['room_id'] : null;

                        $stmtItem = $this->db->prepare("INSERT INTO `commerce_order_items` (
                            order_id, platform, shop_id, platform_order_id, platform_line_item_id,
                            product_id, product_name, sku_id, sku_name, sku_image,
                            quantity, sale_price, original_price, seller_discount, platform_discount, room_id
                        ) VALUES (
                            ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?, ?
                        ) ON DUPLICATE KEY UPDATE 
                            order_id = VALUES(order_id),
                            product_name = VALUES(product_name),
                            sku_name = VALUES(sku_name),
                            sku_image = VALUES(sku_image),
                            quantity = VALUES(quantity),
                            sale_price = VALUES(sale_price),
                            original_price = VALUES(original_price),
                            seller_discount = VALUES(seller_discount),
                            platform_discount = VALUES(platform_discount),
                            room_id = VALUES(room_id),
                            updated_at = CURRENT_TIMESTAMP");

                        $stmtItem->execute([
                            $internalOrderId,
                            self::PLATFORM_TIKTOK_SHOP,
                            $shopId,
                            $platformOrderId,
                            $platformLineItemId,
                            $productId,
                            $productName,
                            $skuId,
                            $skuName,
                            $skuImage,
                            $quantity,
                            $salePrice,
                            $originalPrice,
                            $itemSellerDiscount,
                            $itemPlatformDiscount,
                            $roomId
                        ]);

                        $pageItemCount++;
                    }
                }

                // THREE-TOKEN CHECKPOINT CONTRACT:
                // Commit page data and advance resume_page_token to next_page_token
                $pageCount++;
                $totalOrders += $pageOrderCount;
                $totalItems += $pageItemCount;

                $stmtCheckpoint = $this->db->prepare("UPDATE `commerce_sync_runs` SET 
                    current_page_token = ?,
                    last_page_token = ?,
                    pages_processed = ?,
                    orders_ingested = ?,
                    items_ingested = ?
                    WHERE id = ?");
                $stmtCheckpoint->execute([
                    $currentPageToken,
                    $nextPageToken, // resume_page_token now points safely to next page
                    $pageCount,
                    $totalOrders,
                    $totalItems,
                    $runId
                ]);

                $this->db->commit();

                // Customer 360 Ingestion Hook (Sprint V2-05: Non-fatal, post-commit)
                try {
                    require_once __DIR__ . '/commerce_customer_service.php';
                    $customerService = new CommerceCustomerService($this->db);
                    foreach ($orders as $rawOrd) {
                        $customerService->ingestOrderRecipient($shopId, $rawOrd, $runId);
                    }
                } catch (\Throwable $custEx) {
                    // Non-fatal safety guard: Customer ingestion errors must NEVER fail Orders sync
                }

                // Automatically recompute loss for any orders that now have aftersales records
                try {
                    if (!empty($pageOrderIds)) {
                        require_once __DIR__ . '/commerce_loss_engine.php';
                        $lossEngine = new CommerceLossEngine($this->db);
                        foreach ($pageOrderIds as $pOrdId) {
                            $stmtCheckRma = $this->db->prepare("SELECT COUNT(*) FROM `commerce_aftersales` WHERE platform = ? AND shop_id = ? AND platform_order_id = ?");
                            $stmtCheckRma->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $pOrdId]);
                            if ((int)$stmtCheckRma->fetchColumn() > 0) {
                                $lossEngine->computeAndPersistLossLedger($shopId, $pOrdId, 'MATURED_LIFECYCLE');
                            }
                        }
                    }
                } catch (\Throwable $t) {}
            } catch (Throwable $t) {
                $this->db->rollBack();
                $sessionStatus = 'FAILED';
                $errorMessage = "Page processing error (Checkpoint preserved at previous token): " . $t->getMessage();
                break;
            }

            // D. Check Termination & Repeated Cursor Loop Detection
            if ($nextPageToken === '' || $nextPageToken === null) {
                $sessionStatus = 'COMPLETED';
                break;
            }

            if (isset($seenCursors[$nextPageToken])) {
                $sessionStatus = 'FAILED';
                $errorMessage = "Cursor loop detected: Token '{$nextPageToken}' repeated. Aborting sync loop.";
                break;
            }

            $seenCursors[$nextPageToken] = true;
            $currentPageToken = $nextPageToken;
        }

        // Finalize sync run record
        $latestAvail = ($sessionStatus === 'COMPLETED' && $endDateStr) ? $endDateStr : null;
        $updateFields = [
            'status' => $sessionStatus,
            'error_message' => $errorMessage,
            'completed_at' => date('Y-m-d H:i:s')
        ];
        if (isset($syncRunsCols['records_read'])) {
            $updateFields['records_read'] = $totalOrders;
        }
        if (isset($syncRunsCols['records_written'])) {
            $updateFields['records_written'] = $totalOrders;
        }
        if (isset($syncRunsCols['latest_available_date'])) {
            $updateFields['latest_available_date'] = $latestAvail;
        }
        if (isset($syncRunsCols['orders_ingested'])) {
            $updateFields['orders_ingested'] = $totalOrders;
        }
        if (isset($syncRunsCols['items_ingested'])) {
            $updateFields['items_ingested'] = $totalItems;
        }

        $setParts = [];
        $setVals = [];
        foreach ($updateFields as $col => $val) {
            $setParts[] = "`{$col}` = ?";
            $setVals[] = $val;
        }
        $setVals[] = $runId;
        $stmtFinalize = $this->db->prepare("UPDATE `commerce_sync_runs` SET " . implode(', ', $setParts) . " WHERE id = ?");
        $stmtFinalize->execute($setVals);

        return [
            'success' => in_array($sessionStatus, ['COMPLETED', 'PARTIAL', 'INTERRUPTED'], true),
            'sync_run_id' => $runId,
            'status' => $sessionStatus,
            'pages_processed' => $pageCount,
            'orders_ingested' => $totalOrders,
            'items_ingested' => $totalItems,
            'records_read' => $totalOrders,
            'records_written' => $totalOrders,
            'start_date' => $startDateStr,
            'end_date' => $endDateStr,
            'latest_available_date' => $latestAvail,
            'last_resume_token' => $currentPageToken,
            'error_message' => $errorMessage
        ];
    }

    /**
     * Bounded recovery of specific missing orders by platform order IDs.
     * Prevents unbounded synchronous backfill while recovering RMA dependencies.
     *
     * @param string $shopId
     * @param array $orderIds List of platform order IDs (bounded to max 50)
     * @return array ['status' => 'COMPLETED'|'PARTIAL'|'FAILED', 'recovered_order_ids' => [...], 'unresolved_order_ids' => [...]]
     */
    /**
     * Bounded retrieval and synchronization of orders by explicit order IDs (max 50)
     * Initializes commerce_sync_runs session, queries official GET /order/202309/orders,
     * preserves raw in-memory orders for Customer 360 recipient capture,
     * and strictly finalizes sync runs (never left RUNNING).
     *
     * @param string $shopId
     * @param array $orderIds List of platform order IDs (bounded to max 50)
     * @return array ['status' => 'COMPLETED'|'PARTIAL'|'FAILED', 'sync_run_id' => int, ...]
     */
    public function syncOrdersByIds(string $shopId, array $orderIds): array {
        $boundedIds = array_values(array_slice(array_unique(array_filter(array_map('strval', $orderIds))), 0, 50));
        if (empty($boundedIds)) {
            return [
                'status' => 'COMPLETED',
                'sync_run_id' => null,
                'requested_count' => 0,
                'recovered_count' => 0,
                'recovered_order_ids' => [],
                'unresolved_order_ids' => []
            ];
        }

        $accessToken = $this->resolveAccessToken($shopId);
        if (!$accessToken) {
            return [
                'status' => 'FAILED',
                'sync_run_id' => null,
                'error' => 'ACCESS_TOKEN_NOT_FOUND',
                'requested_count' => count($boundedIds),
                'recovered_count' => 0,
                'recovered_order_ids' => [],
                'unresolved_order_ids' => $boundedIds
            ];
        }

        // Resolve shop cipher safely via client (fail closed on multi-shop mismatch)
        $shopCipher = '';
        try {
            $shopCipher = $this->client->resolveShopCipher($shopId, $accessToken);
        } catch (\Throwable $t) {
            return [
                'status' => 'FAILED',
                'sync_run_id' => null,
                'error' => $t->getMessage(),
                'requested_count' => count($boundedIds),
                'recovered_count' => 0,
                'recovered_order_ids' => [],
                'unresolved_order_ids' => $boundedIds
            ];
        }

        // Initialize commerce_sync_runs session (RECIPIENT_RECOVERY, /order/202309/orders)
        $runId = 0;
        try {
            $stmtRun = $this->db->prepare("INSERT INTO `commerce_sync_runs` 
                (platform, shop_id, source_domain, sync_type, api_endpoint, status, started_at) 
                VALUES (?, ?, 'order', 'RECIPIENT_RECOVERY', '/order/202309/orders', 'RUNNING', NOW())");
            $stmtRun->execute([self::PLATFORM_TIKTOK_SHOP, $shopId]);
            $runId = (int)$this->db->lastInsertId();
        } catch (\Throwable $t) {}

        // Query TikTok API for these explicit order IDs using official GET /order/202309/orders
        $orders = [];
        try {
            $orders = $this->client->getOrderDetailsV2($accessToken, $shopCipher, $boundedIds);
        } catch (\Throwable $t) {
            try {
                $searchResult = $this->client->searchOrdersV2($accessToken, $shopCipher, ['order_ids' => $boundedIds]);
                $orders = $searchResult['orders'] ?? [];
            } catch (\Throwable $t2) {
                if ($runId > 0) {
                    $this->finalizeRecoveryRun($runId, 'FAILED', count($boundedIds), 0, 'RECIPIENT_RECOVERY_FAILED', $t->getMessage());
                }
                return [
                    'status' => 'FAILED',
                    'sync_run_id' => $runId > 0 ? $runId : null,
                    'error' => $t->getMessage(),
                    'requested_count' => count($boundedIds),
                    'recovered_count' => 0,
                    'recovered_order_ids' => [],
                    'unresolved_order_ids' => $boundedIds
                ];
            }
        }

        $recoveredOrderIds = [];

        // Customer 360 Ingestion Service instance
        require_once __DIR__ . '/commerce_customer_service.php';
        $customerService = null;
        try {
            $customerService = new CommerceCustomerService($this->db);
        } catch (\Throwable $tCust) {}

        if (!empty($orders)) {
            $this->db->beginTransaction();
            try {
                foreach ($orders as $order) {
                    $platformOrderId = (string)($order['id'] ?? '');
                    if ($platformOrderId === '' || !in_array($platformOrderId, $boundedIds, true)) {
                        continue;
                    }

                    // 1. Capture recipient facts from in-memory RAW order immediately (Sprint V2-05.2)
                    if ($customerService !== null) {
                        try {
                            $ord = $order;
                            $customerService->ingestOrderRecipient($shopId, $ord);
                        } catch (\Throwable $tIngest) {
                            // Non-fatal safety guard: Customer ingestion errors must NEVER fail Orders sync
                        }
                    }

                    // 2. Sanitize & verify observation
                    $sanitizedOrder = self::sanitizeOrderPayloadRecursive($order);
                    if (!self::verifyNoForbiddenPii($sanitizedOrder)) {
                        continue;
                    }

                    $sanitizedJson = json_encode($sanitizedOrder, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                    $payloadHash = hash('sha256', $sanitizedJson);
                    $platformUpdatedAtTs = (int)($order['update_time'] ?? 0);

                    // Insert observation with sync_run_id (NOT NULL constraint satisfied)
                    $stmtRaw = $this->db->prepare("INSERT INTO `commerce_raw_observations` 
                        (platform, shop_id, source_domain, api_version, endpoint, entity_type, platform_entity_id, sanitized_payload, payload_hash, sync_run_id, observed_at, platform_updated_at) 
                        VALUES (?, ?, 'order', '202309', '/order/202309/orders', 'order', ?, ?, ?, ?, NOW(), FROM_UNIXTIME(?))
                        ON DUPLICATE KEY UPDATE sanitized_payload = VALUES(sanitized_payload), sync_run_id = VALUES(sync_run_id), observed_at = NOW()");
                    $stmtRaw->execute([
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        $platformOrderId,
                        $sanitizedJson,
                        $payloadHash,
                        $runId,
                        $platformUpdatedAtTs > 0 ? $platformUpdatedAtTs : null
                    ]);
                    $rawObservationId = (int)$this->db->lastInsertId();

                    // Upsert Order Header into commerce_orders
                    $rawStatus = (string)($order['status'] ?? $order['order_status'] ?? '');
                    $normalizedStatus = self::normalizeOrderStatus($rawStatus);
                    $createTimeTs = (int)($order['create_time'] ?? 0);
                    $paidTimeTs = (int)($order['paid_time'] ?? 0);

                    $payment = $order['payment'] ?? [];
                    $orderGrossAmount = (float)($payment['total_amount'] ?? 0.0);
                    $subTotal = (float)($payment['sub_total'] ?? 0.0);
                    $shippingFee = (float)($payment['shipping_fee'] ?? 0.0);
                    $sellerDiscount = (float)($payment['seller_discount'] ?? 0.0);
                    $platformDiscount = (float)($payment['platform_discount'] ?? 0.0);
                    $taxAmount = (float)($payment['tax'] ?? 0.0);
                    $currency = (string)($payment['currency'] ?? 'VND');

                    $shippingProvider = !empty($order['shipping_provider']) ? (string)$order['shipping_provider'] : null;
                    $trackingNumber = !empty($order['tracking_number']) ? (string)$order['tracking_number'] : null;
                    $deliveryType = !empty($order['delivery_type']) ? (string)$order['delivery_type'] : null;
                    $isSplitOrder = !empty($order['is_split_order']) ? 1 : 0;

                    $stmtOrder = $this->db->prepare("INSERT INTO `commerce_orders` (
                        platform, shop_id, platform_order_id, order_status, platform_status,
                        platform_created_at, platform_updated_at, paid_at, currency,
                        order_gross_amount, sub_total, shipping_fee, seller_discount, platform_discount, tax_amount,
                        shipping_provider, tracking_number, delivery_type, is_split_order, sync_run_id, raw_observation_id
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        FROM_UNIXTIME(?), FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?
                    ) ON DUPLICATE KEY UPDATE 
                        order_status = VALUES(order_status),
                        platform_status = VALUES(platform_status),
                        platform_updated_at = VALUES(platform_updated_at),
                        paid_at = VALUES(paid_at),
                        currency = VALUES(currency),
                        order_gross_amount = VALUES(order_gross_amount),
                        sub_total = VALUES(sub_total),
                        shipping_fee = VALUES(shipping_fee),
                        seller_discount = VALUES(seller_discount),
                        platform_discount = VALUES(platform_discount),
                        tax_amount = VALUES(tax_amount),
                        shipping_provider = VALUES(shipping_provider),
                        tracking_number = VALUES(tracking_number),
                        delivery_type = VALUES(delivery_type),
                        is_split_order = VALUES(is_split_order),
                        sync_run_id = VALUES(sync_run_id),
                        raw_observation_id = VALUES(raw_observation_id),
                        updated_at = CURRENT_TIMESTAMP");

                    $stmtOrder->execute([
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        $platformOrderId,
                        $normalizedStatus,
                        $rawStatus,
                        $createTimeTs > 0 ? $createTimeTs : null,
                        $platformUpdatedAtTs > 0 ? $platformUpdatedAtTs : null,
                        $paidTimeTs > 0 ? $paidTimeTs : null,
                        $currency,
                        $orderGrossAmount,
                        $subTotal,
                        $shippingFee,
                        $sellerDiscount,
                        $platformDiscount,
                        $taxAmount,
                        $shippingProvider,
                        $trackingNumber,
                        $deliveryType,
                        $isSplitOrder,
                        $runId > 0 ? $runId : null,
                        $rawObservationId > 0 ? $rawObservationId : null
                    ]);

                    // Retrieve internal order PK
                    $stmtGetId = $this->db->prepare("SELECT id FROM `commerce_orders` WHERE platform = ? AND shop_id = ? AND platform_order_id = ?");
                    $stmtGetId->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $platformOrderId]);
                    $internalOrderId = (int)$stmtGetId->fetchColumn();

                    // Upsert Line items (currency column strictly omitted from commerce_order_items)
                    $lineItems = $order['line_items'] ?? [];
                    foreach ($lineItems as $item) {
                        $platformLineItemId = (string)($item['id'] ?? '');
                        if ($platformLineItemId === '') continue;

                        $productId = (string)($item['product_id'] ?? '');
                        $productName = function_exists('mb_substr') ? mb_substr((string)($item['product_name'] ?? ''), 0, 255) : substr((string)($item['product_name'] ?? ''), 0, 255);
                        $skuId = (string)($item['sku_id'] ?? '');
                        $skuName = isset($item['sku_name']) ? (function_exists('mb_substr') ? mb_substr((string)$item['sku_name'], 0, 255) : substr((string)$item['sku_name'], 0, 255)) : null;
                        $skuImage = isset($item['sku_image']) ? (string)$item['sku_image'] : null;
                        $quantity = max(1, (int)($item['quantity'] ?? 1));
                        $salePrice = (float)($item['sale_price'] ?? 0.0);
                        $originalPrice = (float)($item['original_price'] ?? 0.0);

                        $stmtItem = $this->db->prepare("INSERT INTO `commerce_order_items` (
                            order_id, platform, shop_id, platform_order_id, platform_line_item_id,
                            product_id, product_name, sku_id, sku_name, sku_image,
                            quantity, sale_price, original_price
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            product_name = VALUES(product_name),
                            sku_name = VALUES(sku_name),
                            quantity = VALUES(quantity),
                            sale_price = VALUES(sale_price),
                            updated_at = CURRENT_TIMESTAMP");

                        $stmtItem->execute([
                            $internalOrderId,
                            self::PLATFORM_TIKTOK_SHOP,
                            $shopId,
                            $platformOrderId,
                            $platformLineItemId,
                            $productId,
                            $productName,
                            $skuId,
                            $skuName,
                            $skuImage,
                            $quantity,
                            $salePrice,
                            $originalPrice
                        ]);
                    }

                    $recoveredOrderIds[] = $platformOrderId;
                }
                $this->db->commit();
            } catch (\Throwable $t) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                if ($runId > 0) {
                    $this->finalizeRecoveryRun($runId, 'FAILED', count($boundedIds), 0, 'RECIPIENT_RECOVERY_FAILED', $t->getMessage());
                }
                return [
                    'status' => 'FAILED',
                    'sync_run_id' => $runId > 0 ? $runId : null,
                    'error' => $t->getMessage(),
                    'requested_count' => count($boundedIds),
                    'recovered_count' => 0,
                    'recovered_order_ids' => [],
                    'unresolved_order_ids' => $boundedIds
                ];
            }
        }

        // Recompute loss ledger for recovered orders if they have aftersales records
        if (!empty($recoveredOrderIds)) {
            try {
                require_once __DIR__ . '/commerce_loss_engine.php';
                $lossEngine = new CommerceLossEngine($this->db);
                foreach ($recoveredOrderIds as $recId) {
                    $lossEngine->computeAndPersistLossLedger($shopId, $recId, 'MATURED_LIFECYCLE');
                }
            } catch (\Throwable $t) {}
        }

        $unresolvedOrderIds = array_values(array_diff($boundedIds, $recoveredOrderIds));
        $runStatus = empty($unresolvedOrderIds) ? 'COMPLETED' : 'PARTIAL';

        // Finalize sync run in commerce_sync_runs (never left RUNNING)
        if ($runId > 0) {
            $this->finalizeRecoveryRun($runId, $runStatus, count($boundedIds), count($recoveredOrderIds));
        }

        return [
            'status' => $runStatus,
            'sync_run_id' => $runId > 0 ? $runId : null,
            'requested_count' => count($boundedIds),
            'recovered_count' => count($recoveredOrderIds),
            'recovered_order_ids' => $recoveredOrderIds,
            'unresolved_order_ids' => $unresolvedOrderIds
        ];
    }

    /**
     * Finalizes recovery sync run lifecycle in commerce_sync_runs
     */
    public function finalizeRecoveryRun(int $runId, string $status, int $recordsRead, int $recordsWritten, ?string $errorCode = null, ?string $errorMessage = null): void {
        if ($runId <= 0) return;
        try {
            $stmt = $this->db->prepare("UPDATE `commerce_sync_runs` SET 
                status = ?,
                records_read = ?,
                records_written = ?,
                error_code = ?,
                error_message = ?,
                completed_at = NOW()
                WHERE id = ?");
            $stmt->execute([$status, $recordsRead, $recordsWritten, $errorCode, $errorMessage, $runId]);
        } catch (\Throwable $t) {}
    }

    /**
     * Authoritative query for remaining priority orders needing unmasked recipient capture.
     * Criteria: active lifecycle orders (AWAITING_SHIPMENT, IN_TRANSIT) where recipient is missing or UNMATCHED.
     */
    public function getRemainingPriorityOrdersCount(string $shopId): int {
        try {
            $stmt = $this->db->prepare("SELECT COUNT(DISTINCT o.platform_order_id)
                FROM `commerce_orders` o
                LEFT JOIN `commerce_order_recipients` r 
                  ON o.platform = r.platform AND o.shop_id = r.shop_id AND o.platform_order_id = r.platform_order_id
                WHERE o.platform = ? AND o.shop_id = ?
                  AND o.order_status IN ('AWAITING_SHIPMENT', 'IN_TRANSIT')
                  AND (r.id IS NULL OR r.identity_method IS NULL OR r.identity_method = 'UNMATCHED')");
            $stmt->execute([self::PLATFORM_TIKTOK_SHOP, $shopId]);
            return (int)$stmt->fetchColumn();
        } catch (\Throwable $t) {
            return 0;
        }
    }

    /**
     * Sprint V2-05.2: Bounded priority recipient capture.
     * Prioritizes active lifecycle orders (AWAITING_SHIPMENT, IN_TRANSIT) where TikTok API
     * still provides unmasked recipient facts before post-fulfillment privacy degradation.
     *
     * @param string $shopId
     * @param array $orderIds Explicit order IDs to capture (optional, max 50)
     * @param int $limit Maximum order batch size (capped strictly at 50)
     * @return array
     */
    public function syncPriorityRecipients(string $shopId, array $orderIds = [], int $limit = 50): array {
        $boundedLimit = max(1, min(50, $limit));

        $targetIds = [];
        if (!empty($orderIds)) {
            $targetIds = array_slice(array_unique(array_filter(array_map('trim', $orderIds))), 0, $boundedLimit);
        } else {
            // Find priority orders in AWAITING_SHIPMENT or IN_TRANSIT that need unmasked recipient capture
            $stmt = $this->db->prepare("SELECT o.platform_order_id
                FROM `commerce_orders` o
                LEFT JOIN `commerce_order_recipients` r 
                  ON o.platform = r.platform AND o.shop_id = r.shop_id AND o.platform_order_id = r.platform_order_id
                WHERE o.platform = ? AND o.shop_id = ?
                  AND o.order_status IN ('AWAITING_SHIPMENT', 'IN_TRANSIT')
                  AND (r.id IS NULL OR r.identity_method IS NULL OR r.identity_method = 'UNMATCHED')
                ORDER BY FIELD(o.order_status, 'AWAITING_SHIPMENT', 'IN_TRANSIT'), o.platform_created_at DESC
                LIMIT " . (int)$boundedLimit);
            $stmt->execute([self::PLATFORM_TIKTOK_SHOP, $shopId]);
            $targetIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }

        if (empty($targetIds)) {
            // Calculate total remaining priority orders
            $remainingCount = $this->getRemainingPriorityOrdersCount($shopId);

            return [
                'status' => 'COMPLETED',
                'shop_id' => $shopId,
                'requested_count' => 0,
                'recovered_count' => 0,
                'captured_count' => 0,
                'remaining_priority_orders' => $remainingCount,
                'message' => 'Không còn đơn hàng ưu tiên (AWAITING_SHIPMENT/IN_TRANSIT) nào cần capture.'
            ];
        }

        // Fetch orders by IDs and capture recipients synchronously
        $syncRes = $this->syncOrdersByIds($shopId, $targetIds);

        // Count how many orders in targetIds are now captured with unmasked details or matched identities
        $inClause = implode(',', array_fill(0, count($targetIds), '?'));
        $stmtCheck = $this->db->prepare("SELECT 
            COUNT(DISTINCT CASE WHEN is_masked_by_platform = 0 THEN platform_order_id END) as unmasked_count,
            COUNT(DISTINCT CASE WHEN identity_method != 'UNMATCHED' THEN platform_order_id END) as matched_count
            FROM `commerce_order_recipients`
            WHERE platform = ? AND shop_id = ? AND platform_order_id IN ({$inClause})");
        $stmtCheck->execute(array_merge([self::PLATFORM_TIKTOK_SHOP, $shopId], $targetIds));
        $counts = $stmtCheck->fetch(PDO::FETCH_ASSOC) ?: [];
        $unmaskedCaptured = (int)($counts['unmasked_count'] ?? 0);
        $matchedCaptured = (int)($counts['matched_count'] ?? 0);

        // Count remaining priority orders
        $remainingCount = $this->getRemainingPriorityOrdersCount($shopId);

        return [
            'status' => 'SUCCESS',
            'shop_id' => $shopId,
            'requested_count' => count($targetIds),
            'recovered_count' => $syncRes['recovered_count'] ?? 0,
            'unmasked_captured_count' => $unmaskedCaptured,
            'matched_captured_count' => $matchedCaptured,
            'remaining_priority_orders' => $remainingCount,
            'target_order_ids' => $targetIds,
            'message' => "Đã xử lý " . count($targetIds) . " đơn ưu tiên. Thu thập thành công {$unmaskedCaptured} đơn chi tiết (còn {$remainingCount} đơn ưu tiên)."
        ];
    }

    /**
     * Data retention pruning: Deletes sanitized observations older than retention period
     */
    public function pruneOldObservations(int $retentionDays = self::DEFAULT_RETENTION_DAYS): int {
        $stmtPrune = $this->db->prepare("DELETE FROM `commerce_raw_observations` 
            WHERE observed_at < DATE_SUB(NOW(), INTERVAL ? DAY)");
        $stmtPrune->execute([$retentionDays]);
        return $stmtPrune->rowCount();
    }

    /**
     * Retrieves sync run record by ID
     */
    public function getSyncRun(int $runId): ?array {
        $stmt = $this->db->prepare("SELECT * FROM `commerce_sync_runs` WHERE id = ?");
        $stmt->execute([$runId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Reconciliation report: Compares commerce_orders with Compass Overview Snapshot ID=13
     */
    public function getReconciliationReport(string $shopId, string $startDate, string $endDate): array {
        $stmtOrders = $this->db->prepare("SELECT 
            COUNT(DISTINCT platform_order_id) as total_orders,
            COUNT(DISTINCT CASE WHEN order_status != 'CANCELLED' THEN platform_order_id END) as valid_orders,
            SUM(order_gross_amount) as gross_amount,
            SUM(CASE WHEN order_status != 'CANCELLED' THEN order_gross_amount ELSE 0 END) as net_gross_amount
            FROM `commerce_orders` 
            WHERE platform = ? AND shop_id = ? 
              AND platform_created_at >= ? AND platform_created_at <= ?");
        $stmtOrders->execute([
            self::PLATFORM_TIKTOK_SHOP,
            $shopId,
            $startDate . ' 00:00:00',
            $endDate . ' 23:59:59'
        ]);
        $orderMetrics = $stmtOrders->fetch(PDO::FETCH_ASSOC);

        $stmtItems = $this->db->prepare("SELECT 
            SUM(i.quantity) as total_quantity,
            COUNT(DISTINCT i.sku_id) as distinct_skus
            FROM `commerce_order_items` i
            INNER JOIN `commerce_orders` o ON i.order_id = o.id
            WHERE i.platform = ? AND i.shop_id = ?
              AND o.platform_created_at >= ? AND o.platform_created_at <= ?");
        $stmtItems->execute([
            self::PLATFORM_TIKTOK_SHOP,
            $shopId,
            $startDate . ' 00:00:00',
            $endDate . ' 23:59:59'
        ]);
        $itemMetrics = $stmtItems->fetch(PDO::FETCH_ASSOC);

        // Fetch reference snapshot if available
        $stmtSnap = $this->db->prepare("SELECT * FROM `tiktok_seller_center_snapshots` 
            WHERE shop_id = ? AND period_start = ? AND period_end = ? 
            ORDER BY id DESC LIMIT 1");
        $stmtSnap->execute([$shopId, $startDate, $endDate]);
        $snapshot = $stmtSnap->fetch(PDO::FETCH_ASSOC);

        return [
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'api_metrics' => [
                'total_unique_orders' => (int)($orderMetrics['total_orders'] ?? 0),
                'valid_orders_excl_cancel' => (int)($orderMetrics['valid_orders'] ?? 0),
                'total_items_quantity' => (int)($itemMetrics['total_quantity'] ?? 0),
                'order_gross_value' => (float)($orderMetrics['gross_amount'] ?? 0.0), // Canonical terminology: Order Gross Value (transaction-level gross value from Orders API)
                'order_gross_amount' => (float)($orderMetrics['gross_amount'] ?? 0.0), // Backward-compatible field name
                'order_gross_excl_cancel' => (float)($orderMetrics['net_gross_amount'] ?? 0.0)
            ],
            'compass_reference' => $snapshot ? [
                'snapshot_id' => (int)$snapshot['id'],
                'compass_gmv' => (float)$snapshot['total_gmv'],
                'total_revenue' => (float)($snapshot['total_revenue'] ?? 0.0),
                'items_sold' => (int)($snapshot['items_sold'] ?? 0),
                'total_orders' => (int)$snapshot['total_orders']
            ] : null,
            'canonical_terminology' => [
                'compass_gmv' => 'TikTok Compass metric',
                'total_revenue' => 'TikTok Compass Total Revenue',
                'order_gross_value' => 'Transaction-level gross value from Orders API (SUM(order_gross_amount))',
                'realized_order_value' => 'Derived after applicable order-loss rules (HF1.3 / HF1.4)',
                'settlement_amount' => 'Finance/Settlement source (HF1.4)'
            ],
            'discrepancy_taxonomy' => [
                'semantic' => 'Compass GMV is platform-aggregated; Order Gross Value is transaction-level payment amount.',
                'status' => 'Current API query for historical orders stores latest known order status. Therefore historical status counts must NOT automatically be interpreted as status-as-of-period-end unless historical observations prove that state.',
                'time_boundary' => 'Compass dates are in ICT (UTC+7); API orders are filtered by exact timestamp.',
                'refresh_timing' => 'Compass overview has an observed delay of 2-4 hours.'
            ]
        ];
    }
}
