<?php
/**
 * ADDP COMMERCE INTELLIGENCE - RETURN, REFUND & AFTERSALES SERVICE
 * 
 * Component: HF1.3 Phase 1B Return, Refund & Fulfillment Ingestion Service
 * 
 * Handles:
 * 1. Normalized RMA & Aftersales Header ingestion into commerce_aftersales
 * 2. SKU-level line item ingestion into commerce_aftersales_items
 * 3. Append-only lifecycle event logging with business event_key into commerce_order_events
 * 4. Recursive PII sanitization for RMA & fulfillment payloads
 * 5. Three-token checkpoint sync contract with page-level transactions
 * 6. Configurable throttling and 429 Retry-After handling
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/tiktok_client.php';
require_once __DIR__ . '/commerce_sync_service.php';

class CommerceAftersalesService {
    public const PLATFORM_TIKTOK_SHOP = 'tiktok_shop';
    public const SOURCE_DOMAIN_AFTERSALES = 'return_refund';
    public const SOURCE_DOMAIN_FULFILLMENT = 'fulfillment';
    public const API_VERSION_RMA = '202602';
    public const API_VERSION_FULFILLMENT = '202309';

    private PDO $db;
    private TikTokShopClient $client;

    public function __construct(?PDO $db = null, ?TikTokShopClient $client = null) {
        $this->db = $db ?? getDBConnection();
        $this->client = $client ?? new TikTokShopClient();
    }

    /**
     * Enhanced PII Denylist for Return/Refund & Logistics Payloads
     */
    public static function getSanitizationDenylist(): array {
        return [
            // Personal & Contact Identifiers
            'phone', 'phone_number', 'buyer_phone', 'mobile', 'telephone',
            'buyer_uid', 'buyer_email', 'buyer_name', 'name', 'first_name', 'last_name',
            // Addresses & Locations
            'full_address', 'address_line1', 'address_line2', 'street_address',
            'recipient_address', 'shipping_address', 'billing_address',
            'sender_address', 'return_address', 'warehouse_address',
            // Free-text messages that may contain embedded PII
            'buyer_message', 'buyer_note', 'buyer_description', 'customer_remarks',
            // Tracking minimization in raw observations
            'return_tracking_number', 'reverse_tracking_number'
        ];
    }

    /**
     * Recursively sanitizes raw aftersales payload stripping all prohibited PII
     */
    public static function sanitizeAftersalesPayloadRecursive(mixed $data): mixed {
        $denylist = self::getSanitizationDenylist();

        if (is_array($data)) {
            $cleaned = [];
            foreach ($data as $key => $val) {
                $lowerKey = strtolower((string)$key);
                if (in_array($lowerKey, $denylist, true)) {
                    continue; // Strip forbidden key entirely
                }
                $cleaned[$key] = self::sanitizeAftersalesPayloadRecursive($val);
            }
            return $cleaned;
        }

        return $data;
    }

    /**
     * Asserts no forbidden PII substrings remain in any nested key
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
     * Normalizes platform RMA status string to standard vocabulary
     */
    public static function normalizeAftersalesStatus(string $platformStatus): string {
        $upper = strtoupper(trim($platformStatus));
        return match ($upper) {
            'RETURN_OR_REFUND_REQUEST_COMPLETE', 'RETURN_OR_REFUND_REQUEST_SUCCESS', 'REFUND_SUCCESS', 'SUCCESS', 'COMPLETE' => 'SUCCESS',
            'RETURN_OR_REFUND_REQUEST_CANCEL', 'CANCELLED' => 'CANCELLED',
            'RETURN_OR_REFUND_REQUEST_REJECT', 'REJECTED' => 'REJECTED',
            'RETURN_REQUESTED' => 'REQUESTED',
            'RETURN_APPROVED' => 'APPROVED',
            'RETURN_SHIPPED' => 'RETURNING',
            'RETURN_RECEIVED' => 'RECEIVED',
            'REFUND_PENDING' => 'REFUND_PENDING',
            default => $upper !== '' ? $upper : 'UNKNOWN'
        };
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
                $token = getAccessToken($shopId);
                if (!empty($token)) {
                    return $token;
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
     * Resolves shop cipher dynamically without hard dependency on tiktok_shops table
     */
    public function resolveShopCipher(string $shopId, string $accessToken): string {
        // 1. Try tiktok_shops table if exists
        try {
            $stmt = $this->db->prepare("SELECT cipher FROM `tiktok_shops` WHERE shop_id = ? AND cipher IS NOT NULL AND cipher != '' LIMIT 1");
            $stmt->execute([$shopId]);
            $cipher = $stmt->fetchColumn();
            if (!empty($cipher)) return (string)$cipher;
        } catch (Throwable $e) {}

        // 2. Dynamic resolution via TikTokShopClient::resolveShopCipher
        try {
            return $this->client->resolveShopCipher($shopId, $accessToken);
        } catch (Throwable $e) {}

        return '';
    }

    /**
     * Normalizes platform RMA type string
     */
    public static function normalizeAftersalesType(string $platformType): string {
        $upper = strtoupper(trim($platformType));
        return match ($upper) {
            'REFUND_ONLY' => 'REFUND_ONLY',
            'RETURN_AND_REFUND' => 'RETURN_AND_REFUND',
            default => $upper !== '' ? $upper : 'UNKNOWN'
        };
    }

    /**
     * Normalizes platform package status string
     */
    public static function normalizePackageStatus(string $platformStatus): string {
        $upper = strtoupper(trim($platformStatus));
        return match ($upper) {
            'AWAITING_COLLECTION' => 'AWAITING_COLLECTION',
            'IN_TRANSIT' => 'IN_TRANSIT',
            'DELIVERED' => 'DELIVERED',
            'DELIVERY_FAILED' => 'DELIVERY_FAILED',
            'RETURN_TO_SENDER', 'RETURNING' => 'RETURN_TO_SENDER',
            'EXCEPTION' => 'EXCEPTION',
            'CANCELLED' => 'CANCELLED',
            default => $upper !== '' ? $upper : 'UNKNOWN'
        };
    }

    /**
     * Computes deterministic business event key (Correction 2)
     * Distinguishes business event identity from raw payload hash.
     */
    public static function computeEventKey(
        string $platform,
        string $shopId,
        string $eventDomain,
        string $platformEntityId,
        string $eventType,
        string $newStatus,
        ?int $eventTimestamp = null
    ): string {
        $tsStr = $eventTimestamp !== null && $eventTimestamp > 0 ? (string)$eventTimestamp : '0';
        $identityRaw = "{$platform}:{$shopId}:{$eventDomain}:{$platformEntityId}:{$eventType}:{$newStatus}:{$tsStr}";
        return hash('sha256', $identityRaw);
    }

    /**
     * Ingests RMA search page with page-level transaction boundary
     */
    /**
     * Resolves canonical [start 00:00:00, day-after-end 00:00:00) interval timestamps.
     */
    public static function resolvePeriodTimestamps(string $startDate, string $endDate): array {
        $tz = new DateTimeZone(date_default_timezone_get() ?: 'Asia/Ho_Chi_Minh');
        $dtStart = new DateTimeImmutable($startDate . ' 00:00:00', $tz);
        $dtEnd = new DateTimeImmutable($endDate . ' 00:00:00', $tz);
        $dtEndExclusive = $dtEnd->modify('+1 day');
        return [
            'start_timestamp' => $dtStart->getTimestamp(),
            'end_exclusive_timestamp' => $dtEndExclusive->getTimestamp(),
            'start_datetime' => $dtStart->format('Y-m-d H:i:s'),
            'end_exclusive_datetime' => $dtEndExclusive->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * Internal unified runner for both historical backfill and incremental delta sync.
     */
    public function syncAftersalesRmaSession(
        string $shopId,
        string $syncType,
        array $queryFilters,
        ?int $windowStart = null,
        ?int $windowEnd = null,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 100,
        ?string $resumeToken = null,
        ?int $existingRunId = null
    ): array {
        // Resolve access token and shop cipher
        $accessToken = $this->resolveAccessToken($shopId);
        if (empty($accessToken)) {
            if ($existingRunId !== null && $existingRunId > 0) {
                try {
                    $this->db->prepare("UPDATE `commerce_sync_runs` SET status = 'FAILED', error_code = 'ACCESS_TOKEN_NOT_FOUND', error_message = 'Valid TikTok access token not found', completed_at = NOW() WHERE id = ?")->execute([$existingRunId]);
                } catch (\Throwable $t) {}
            }
            return [
                'status' => 'FAILED',
                'error_code' => 'ACCESS_TOKEN_NOT_FOUND',
                'message' => "Valid TikTok access token not found for shop ID: {$shopId}"
            ];
        }

        $shopCipher = $this->resolveShopCipher($shopId, $accessToken);
        $pageSize = min(50, max(1, $pageSize));

        // Create or reuse sync run session in commerce_sync_runs
        $windowStartTs = ($windowStart !== null && $windowStart > 0) ? $windowStart : null;
        $windowEndTs = ($windowEnd !== null && $windowEnd > 0) ? $windowEnd : null;
        $resumeTokenStr = !empty($resumeToken) ? trim((string)$resumeToken) : null;

        if ($existingRunId !== null && $existingRunId > 0) {
            $runId = $existingRunId;
        } else {
            static $hasSourceDomain = null;
            if ($hasSourceDomain === null) {
                try {
                    $check = $this->db->query("SHOW COLUMNS FROM `commerce_sync_runs` LIKE 'source_domain'")->fetch();
                    $hasSourceDomain = !empty($check);
                } catch (Throwable $e) {
                    $hasSourceDomain = false;
                }
            }

            if ($hasSourceDomain) {
                $stmtRun = $this->db->prepare("INSERT INTO `commerce_sync_runs` 
                    (platform, shop_id, source_domain, sync_type, status, window_start_time, window_end_time, current_page_token, last_page_token, started_at)
                    VALUES (?, ?, ?, ?, 'RUNNING', FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, ?, NOW())");
                $stmtRun->execute([
                    self::PLATFORM_TIKTOK_SHOP,
                    $shopId,
                    self::SOURCE_DOMAIN_AFTERSALES,
                    $syncType,
                    $windowStartTs,
                    $windowEndTs,
                    $resumeTokenStr,
                    $resumeTokenStr
                ]);
            } else {
                $stmtRun = $this->db->prepare("INSERT INTO `commerce_sync_runs` 
                    (platform, shop_id, sync_type, status, window_start_time, window_end_time, current_page_token, last_page_token, started_at)
                    VALUES (?, ?, ?, 'RUNNING', FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, ?, NOW())");
                $stmtRun->execute([
                    self::PLATFORM_TIKTOK_SHOP,
                    $shopId,
                    $syncType,
                    $windowStartTs,
                    $windowEndTs,
                    $resumeTokenStr,
                    $resumeTokenStr
                ]);
            }
            $runId = (int)$this->db->lastInsertId();
        }

        $currentPageToken = $resumeTokenStr;
        $pageCount = 0;
        $totalRmas = 0;
        $totalItems = 0;
        $totalEvents = 0;
        $totalRecordsRead = 0;
        $seenCursors = [];
        if ($currentPageToken !== null && $currentPageToken !== '') {
            $seenCursors[$currentPageToken] = true;
        }

        $sessionStatus = 'RUNNING';
        $errorMessage = null;
        $errorCode = null;
        $sessionOrderIds = [];

        // V2-05.2.3: Historical create_time boundary range validation
        $isHistoricalCreateTimeSync = isset($queryFilters['create_time_ge']) || isset($queryFilters['create_time_lt']);
        $reqStart = (int)($queryFilters['create_time_ge'] ?? ($windowStartTs ?? 0));
        $reqEndExclusive = (int)($queryFilters['create_time_lt'] ?? ($windowEndTs ?? PHP_INT_MAX));
        $outOfRangeCount = 0;
        $minReturnedCreateTime = null;
        $maxReturnedCreateTime = null;

        while (true) {
            if ($pageCount >= $maxPagesSafetyGuard) {
                $sessionStatus = 'INTERRUPTED';
                $errorMessage = "Reached max_pages_safety_guard ({$maxPagesSafetyGuard} pages). Checkpoint preserved.";
                break;
            }

            $searchOptions = array_merge($queryFilters, [
                'page_size' => $pageSize,
                'page_token' => $currentPageToken,
                'whitelisted_data_fields' => ['LINE_ITEMS', 'SKU_RETURN_REQUESTS']
            ]);

            try {
                $searchResult = $this->client->searchReturnRefundRmaV2($accessToken, $shopCipher, $searchOptions);
            } catch (Throwable $e) {
                $sessionStatus = 'FAILED';
                $errorMessage = "TikTok RMA API Search failed: " . $e->getMessage();
                break;
            }

            $rmaList = $searchResult['returns'] ?? $searchResult['return_orders'] ?? $searchResult['rma_list'] ?? $searchResult['reverse_orders'] ?? [];
            $nextPageToken = isset($searchResult['next_page_token']) ? trim((string)$searchResult['next_page_token']) : '';
            $totalRecordsRead += count($rmaList);

            if (empty($rmaList)) {
                $sessionStatus = 'COMPLETED';
                break;
            }

            // PAGE TRANSACTION BOUNDARY
            $this->db->beginTransaction();
            try {
                $pageRmaCount = 0;
                $pageItemCount = 0;
                $pageEventCount = 0;

                foreach ($rmaList as $rma) {
                    $rmaId = (string)($rma['return_id'] ?? $rma['rma_id'] ?? $rma['id'] ?? $rma['reverse_order_id'] ?? '');
                    if ($rmaId === '') continue;

                    // V2-05.2.3: Historical create_time range boundary check
                    $itemCreateTime = (int)($rma['create_time'] ?? $rma['request_time'] ?? 0);
                    if ($isHistoricalCreateTimeSync && $itemCreateTime > 0) {
                        $minReturnedCreateTime = ($minReturnedCreateTime === null) ? $itemCreateTime : min($minReturnedCreateTime, $itemCreateTime);
                        $maxReturnedCreateTime = ($maxReturnedCreateTime === null) ? $itemCreateTime : max($maxReturnedCreateTime, $itemCreateTime);
                        if ($itemCreateTime < $reqStart || $itemCreateTime >= $reqEndExclusive) {
                            $outOfRangeCount++;
                            continue; // Skip persisting out-of-range record in this historical window
                        }
                    }

                    $platformOrderId = (string)($rma['order_id'] ?? $rma['platform_order_id'] ?? '');
                    if ($platformOrderId !== '') {
                        $sessionOrderIds[$platformOrderId] = true;
                    }

                    // 1. Recursive Sanitization & PII Verification
                    $sanitizedRma = self::sanitizeAftersalesPayloadRecursive($rma);
                    if (!self::verifyNoForbiddenPii($sanitizedRma)) {
                        throw new SecurityException("Forbidden PII detected in sanitized RMA payload {$rmaId}. Aborting.");
                    }

                    $sanitizedJson = json_encode($sanitizedRma, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                    $payloadHash = hash('sha256', $sanitizedJson);

                    // 2. Upsert Raw Observation
                    $stmtRaw = $this->db->prepare("INSERT INTO `commerce_raw_observations`
                        (platform, shop_id, source_domain, api_version, endpoint, entity_type, platform_entity_id, sanitized_payload, payload_hash, observed_at, platform_updated_at, sync_run_id)
                        VALUES (?, ?, ?, ?, ?, 'rma', ?, ?, ?, NOW(), FROM_UNIXTIME(?), ?)
                        ON DUPLICATE KEY UPDATE
                        sanitized_payload = VALUES(sanitized_payload),
                        observed_at = NOW(),
                        sync_run_id = VALUES(sync_run_id)");
                    $updateTimeTs = (int)($rma['update_time'] ?? $rma['platform_updated_at'] ?? 0);
                    $stmtRaw->execute([
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        self::SOURCE_DOMAIN_AFTERSALES,
                        self::API_VERSION_RMA,
                        defined('TIKTOK_API_RMA_SEARCH_ENDPOINT') ? TIKTOK_API_RMA_SEARCH_ENDPOINT : '/return_refund/202602/returns/search',
                        $rmaId,
                        $sanitizedJson,
                        $payloadHash,
                        $updateTimeTs > 0 ? $updateTimeTs : null,
                        $runId
                    ]);
                    $rawObservationId = (int)$this->db->lastInsertId();

                    // 3. Upsert commerce_aftersales Header
                    $rawStatus = (string)($rma['return_status'] ?? $rma['rma_status'] ?? $rma['status'] ?? '');
                    $normalizedStatus = self::normalizeAftersalesStatus($rawStatus);
                    $rawType = (string)($rma['return_type'] ?? $rma['rma_type'] ?? 'REFUND_ONLY');
                    $normalizedType = self::normalizeAftersalesType($rawType);

                    $refundAmtData = $rma['refund_amount'] ?? [];
                    $refundAmount = is_array($refundAmtData)
                        ? (float)($refundAmtData['refund_total'] ?? $refundAmtData['amount'] ?? 0.0)
                        : (float)($rma['refund_amount'] ?? 0.0);
                    $currency = is_array($refundAmtData)
                        ? (string)($refundAmtData['currency'] ?? 'VND')
                        : (string)($rma['currency'] ?? 'VND');

                    $createTimeTs = (int)($rma['create_time'] ?? $rma['request_time'] ?? 0);
                    $refundCompletedTimeTs = $normalizedStatus === 'SUCCESS' ? ($updateTimeTs > 0 ? $updateTimeTs : time()) : null;

                    $rawReason = !empty($rma['return_reason']) ? (string)$rma['return_reason'] : (!empty($rma['reason_code']) ? (string)$rma['reason_code'] : null);
                    $rawCategory = !empty($rma['return_reason_text']) ? (string)$rma['return_reason_text'] : (!empty($rma['reason_category']) ? (string)$rma['reason_category'] : null);
                    $rawRole = !empty($rma['role']) ? (string)$rma['role'] : (!empty($rma['return_role']) ? (string)$rma['return_role'] : 'BUYER');

                    $reasonCode = $rawReason !== null ? (function_exists('mb_substr') ? mb_substr($rawReason, 0, 128) : substr($rawReason, 0, 128)) : null;
                    $reasonCategory = $rawCategory !== null ? (function_exists('mb_substr') ? mb_substr($rawCategory, 0, 255) : substr($rawCategory, 0, 255)) : null;
                    $returnRole = function_exists('mb_substr') ? mb_substr($rawRole, 0, 64) : substr($rawRole, 0, 64);

                    $stmtAftersales = $this->db->prepare("INSERT INTO `commerce_aftersales` (
                        platform, shop_id, aftersales_id, platform_order_id,
                        aftersales_type, platform_aftersales_type, aftersales_status, platform_status,
                        refund_amount, currency, request_created_at, platform_updated_at, refund_completed_at,
                        reason_code, reason_category, return_role, sync_run_id, raw_observation_id
                    ) VALUES (
                        ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), FROM_UNIXTIME(?),
                        ?, ?, ?, ?, ?
                    ) ON DUPLICATE KEY UPDATE
                        platform_order_id = VALUES(platform_order_id),
                        aftersales_status = VALUES(aftersales_status),
                        platform_status = VALUES(platform_status),
                        refund_amount = VALUES(refund_amount),
                        platform_updated_at = VALUES(platform_updated_at),
                        refund_completed_at = VALUES(refund_completed_at),
                        reason_code = VALUES(reason_code),
                        reason_category = VALUES(reason_category),
                        return_role = VALUES(return_role),
                        sync_run_id = VALUES(sync_run_id),
                        raw_observation_id = VALUES(raw_observation_id),
                        updated_at = CURRENT_TIMESTAMP");

                    $stmtAftersales->execute([
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        $rmaId,
                        $platformOrderId,
                        $normalizedType,
                        $rawType,
                        $normalizedStatus,
                        $rawStatus,
                        $refundAmount,
                        $currency,
                        $createTimeTs > 0 ? $createTimeTs : null,
                        $updateTimeTs > 0 ? $updateTimeTs : null,
                        $refundCompletedTimeTs,
                        $reasonCode,
                        $reasonCategory,
                        $returnRole,
                        $runId,
                        $rawObservationId > 0 ? $rawObservationId : null
                    ]);

                    // Retrieve internal aftersales PK
                    $stmtGetPk = $this->db->prepare("SELECT id FROM `commerce_aftersales` WHERE platform = ? AND shop_id = ? AND aftersales_id = ?");
                    $stmtGetPk->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $rmaId]);
                    $aftersalesPk = (int)$stmtGetPk->fetchColumn();

                    $pageRmaCount++;

                    // 4. Upsert Line Items into commerce_aftersales_items
                    $lineItems = $rma['return_line_items'] ?? $rma['line_items'] ?? $rma['return_items'] ?? [];
                    foreach ($lineItems as $item) {
                        $platformLineItemId = (string)($item['return_line_item_id'] ?? $item['line_item_id'] ?? $item['order_line_item_id'] ?? $item['id'] ?? '');
                        if ($platformLineItemId === '') continue;

                        $productId = (string)($item['product_id'] ?? '');
                        $skuId = (string)($item['sku_id'] ?? '');
                        $requestedQty = max(1, (int)($item['return_quantity'] ?? $item['quantity'] ?? 1));
                        $returnedQty = (int)($item['returned_quantity'] ?? ($normalizedStatus === 'SUCCESS' ? $requestedQty : 0));
                        $refundedQty = (int)($item['refunded_quantity'] ?? ($normalizedStatus === 'SUCCESS' ? $requestedQty : 0));
                        $itemRefundAmount = (float)($item['refund_amount'] ?? ($refundAmount > 0 && count($lineItems) === 1 ? $refundAmount : 0.0));
                        $itemStatus = !empty($item['status']) ? (string)$item['status'] : $normalizedStatus;

                        $stmtItem = $this->db->prepare("INSERT INTO `commerce_aftersales_items` (
                            aftersales_pk, platform, shop_id, platform_order_id, platform_line_item_id,
                            product_id, sku_id, requested_quantity, returned_quantity, refunded_quantity,
                            refund_amount, currency, item_status
                        ) VALUES (
                            ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?,
                            ?, ?, ?
                        ) ON DUPLICATE KEY UPDATE
                            returned_quantity = VALUES(returned_quantity),
                            refunded_quantity = VALUES(refunded_quantity),
                            refund_amount = VALUES(refund_amount),
                            item_status = VALUES(item_status),
                            updated_at = CURRENT_TIMESTAMP");

                        $stmtItem->execute([
                            $aftersalesPk,
                            self::PLATFORM_TIKTOK_SHOP,
                            $shopId,
                            $platformOrderId,
                            $platformLineItemId,
                            $productId,
                            $skuId,
                            $requestedQty,
                            $returnedQty,
                            $refundedQty,
                            $itemRefundAmount,
                            $currency,
                            $itemStatus
                        ]);

                        $pageItemCount++;
                    }

                    // 5. Append-Only Order Lifecycle Event Logging (Correction 2: Deterministic Business Event Key)
                    $eventType = 'AFTERSALES_' . $normalizedStatus;
                    $eventKey = self::computeEventKey(
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        'AFTERSALES',
                        $rmaId,
                        $eventType,
                        $normalizedStatus,
                        $updateTimeTs > 0 ? $updateTimeTs : $createTimeTs
                    );

                    $stmtEvent = $this->db->prepare("INSERT IGNORE INTO `commerce_order_events` (
                        platform, shop_id, platform_order_id, event_domain, event_type, event_key,
                        previous_status, new_status, event_timestamp, observed_at,
                        source_domain, api_version, endpoint, platform_entity_id,
                        payload_hash, sync_run_id, raw_observation_id
                    ) VALUES (
                        ?, ?, ?, 'AFTERSALES', ?, ?,
                        NULL, ?, FROM_UNIXTIME(?), NOW(),
                        ?, ?, ?, ?,
                        ?, ?, ?
                    )");

                    $stmtEvent->execute([
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        $platformOrderId,
                        $eventType,
                        $eventKey,
                        $normalizedStatus,
                        $updateTimeTs > 0 ? $updateTimeTs : ($createTimeTs > 0 ? $createTimeTs : null),
                        self::SOURCE_DOMAIN_AFTERSALES,
                        self::API_VERSION_RMA,
                        defined('TIKTOK_API_RMA_SEARCH_ENDPOINT') ? TIKTOK_API_RMA_SEARCH_ENDPOINT : '/return_refund/202602/returns/search',
                        $rmaId,
                        $payloadHash,
                        $runId,
                        $rawObservationId > 0 ? $rawObservationId : null
                    ]);

                    if ($stmtEvent->rowCount() > 0) {
                        $pageEventCount++;
                    }
                }

                // ADVANCE CHECKPOINT & COMMIT PAGE TRANSACTION
                $pageCount++;
                $totalRmas += $pageRmaCount;
                $totalItems += $pageItemCount;
                $totalEvents += $pageEventCount;

                $stmtCheckpoint = $this->db->prepare("UPDATE `commerce_sync_runs` SET
                    current_page_token = ?,
                    last_page_token = ?,
                    pages_processed = ?,
                    orders_ingested = ?,
                    items_ingested = ?
                    WHERE id = ?");
                $stmtCheckpoint->execute([
                    $currentPageToken,
                    $nextPageToken,
                    $pageCount,
                    $totalRmas,
                    $totalItems,
                    $runId
                ]);

                $this->db->commit();
            } catch (Throwable $pageEx) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                $sessionStatus = 'FAILED';
                $errorMessage = "Transaction aborted on page {$pageCount}: " . $pageEx->getMessage();
                break;
            }

            // Pagination progression
            if ($nextPageToken === '' || $nextPageToken === null) {
                $sessionStatus = 'COMPLETED';
                break;
            }

            if (isset($seenCursors[$nextPageToken])) {
                $sessionStatus = 'COMPLETED';
                $errorMessage = "Detected repeating cursor token {$nextPageToken}. Halting pagination loop.";
                break;
            }

            $seenCursors[$nextPageToken] = true;
            $currentPageToken = $nextPageToken;
        }

        // -------------------------------------------------------------
        // V2-04.1: Missing Order Dependency Detection & Bounded Recovery
        // -------------------------------------------------------------
        $missingOrderIds = [];
        $recoveredOrderIds = [];
        $unresolvedOrderIds = [];

        if (!empty($sessionOrderIds)) {
            // Check which orders are missing from commerce_orders
            foreach (array_keys($sessionOrderIds) as $pOrdId) {
                try {
                    $stmtCheck = $this->db->prepare("SELECT id FROM `commerce_orders` WHERE platform = ? AND shop_id = ? AND platform_order_id = ? LIMIT 1");
                    $stmtCheck->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $pOrdId]);
                    if (!$stmtCheck->fetchColumn()) {
                        $missingOrderIds[] = $pOrdId;
                    }
                } catch (Throwable $e) {}
            }

            // Attempt safe bounded recovery for missing orders (max 50)
            if (!empty($missingOrderIds)) {
                try {
                    $syncService = new CommerceSyncService($this->db, $this->client);
                    $recRes = $syncService->syncOrdersByIds($shopId, array_slice($missingOrderIds, 0, 50));
                    $recoveredOrderIds = $recRes['recovered_order_ids'] ?? [];
                    $unresolvedOrderIds = $recRes['unresolved_order_ids'] ?? [];
                } catch (Throwable $recEx) {
                    $unresolvedOrderIds = $missingOrderIds;
                }
            }

            // Auto-recompute MATURED_LIFECYCLE loss ledger for all available orders in batch
            try {
                require_once __DIR__ . '/commerce_loss_engine.php';
                $lossEngine = new CommerceLossEngine($this->db);
                foreach (array_keys($sessionOrderIds) as $pOrdId) {
                    if (!in_array($pOrdId, $unresolvedOrderIds, true)) {
                        $lossEngine->computeAndPersistLossLedger($shopId, $pOrdId, 'MATURED_LIFECYCLE');
                    }
                }
            } catch (Throwable $leEx) {}

            // If there are unresolved missing order dependencies:
            // RMA ingestion must never silently consider loss reconciliation complete!
            // Mark RMA domain coverage PARTIAL or UNKNOWN, never COMPLETE.
            if (!empty($unresolvedOrderIds) && in_array($sessionStatus, ['COMPLETED', 'RUNNING'], true)) {
                $sessionStatus = 'PARTIAL';
                $depMsg = "Unresolved RMA dependencies: " . count($unresolvedOrderIds) . " missing orders (" . implode(', ', array_slice($unresolvedOrderIds, 0, 5)) . ")";
                $errorMessage = $errorMessage ? ($errorMessage . "; " . $depMsg) : $depMsg;
            }
        }

        // V2-05.2.3: Fail-closed range validation for historical create_time backfill
        if ($isHistoricalCreateTimeSync && $outOfRangeCount > 0) {
            $sessionStatus = ($totalRmas > 0) ? 'PARTIAL' : 'FAILED';
            $errorCode = 'RMA_PERIOD_MISMATCH';
            $startFmt = date('Y-m-d H:i:s', $reqStart);
            $endFmt = date('Y-m-d H:i:s', $reqEndExclusive);
            $minFmt = $minReturnedCreateTime ? date('Y-m-d H:i:s', $minReturnedCreateTime) : 'N/A';
            $maxFmt = $maxReturnedCreateTime ? date('Y-m-d H:i:s', $maxReturnedCreateTime) : 'N/A';
            $mismatchMsg = "RMA create_time period mismatch: {$outOfRangeCount} record(s) outside requested window [{$startFmt} - {$endFmt}). Returned range: [{$minFmt} - {$maxFmt}].";
            $errorMessage = $errorMessage ? ($errorMessage . "; " . $mismatchMsg) : $mismatchMsg;
        }

        // Finalize session in commerce_sync_runs with accurate counters
        static $syncRunColsCache = null;
        if ($syncRunColsCache === null) {
            $syncRunColsCache = [];
            foreach (['records_read', 'records_written', 'error_code'] as $col) {
                try {
                    $driver = null;
                    try { $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME); } catch (Throwable $e) {}
                    if ($driver === 'sqlite') {
                        $stmtInf = $this->db->query("PRAGMA table_info(`commerce_sync_runs`)");
                        $cols = $stmtInf->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($cols as $c) {
                            if (strcasecmp($c['name'] ?? '', $col) === 0) $syncRunColsCache[$col] = true;
                        }
                    } else {
                        $check = $this->db->query("SHOW COLUMNS FROM `commerce_sync_runs` LIKE '{$col}'")->fetch();
                        if (!empty($check)) $syncRunColsCache[$col] = true;
                    }
                } catch (\Throwable $t) {}
            }
        }

        $updateCols = ['status = ?', 'error_message = ?', 'completed_at = NOW()', 'pages_processed = ?', 'orders_ingested = ?', 'items_ingested = ?'];
        $updateParams = [$sessionStatus, $errorMessage, $pageCount, $totalRmas, $totalItems];

        if (!empty($syncRunColsCache['records_read'])) {
            $updateCols[] = 'records_read = ?';
            $updateParams[] = $totalRecordsRead;
        }
        if (!empty($syncRunColsCache['records_written'])) {
            $updateCols[] = 'records_written = ?';
            $updateParams[] = $totalRmas;
        }
        if (!empty($syncRunColsCache['error_code'])) {
            $updateCols[] = 'error_code = ?';
            $updateParams[] = $errorCode;
        }
        $updateParams[] = $runId;

        $stmtFinal = $this->db->prepare("UPDATE `commerce_sync_runs` SET " . implode(', ', $updateCols) . " WHERE id = ?");
        $stmtFinal->execute($updateParams);

        return [
            'sync_run_id' => $runId,
            'status' => $sessionStatus,
            'pages_processed' => $pageCount,
            'rmas_read' => $totalRecordsRead,
            'records_read' => $totalRecordsRead,
            'rmas_ingested' => $totalRmas,
            'records_written' => $totalRmas,
            'items_ingested' => $totalItems,
            'events_logged' => $totalEvents,
            'last_page_token' => $currentPageToken,
            'error_code' => $errorCode,
            'error_message' => $errorMessage,
            'out_of_range_count' => $outOfRangeCount,
            'missing_orders_detected' => count($missingOrderIds),
            'recovered_orders_count' => count($recoveredOrderIds),
            'unresolved_order_dependencies' => $unresolvedOrderIds,
            'unresolved_dependency_count' => count($unresolvedOrderIds)
        ];
    }

    /**
     * Executes initial historical backfill for RMAs with cursor pagination
     */
    public function initialBackfillRma(
        string $shopId,
        int $startTimestamp,
        int $endTimestamp,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 100,
        ?string $resumeToken = null,
        ?int $existingRunId = null,
        string $syncType = 'HISTORICAL_BACKFILL'
    ): array {
        return $this->syncAftersalesRmaSession(
            $shopId,
            $syncType,
            ['create_time_ge' => $startTimestamp, 'create_time_lt' => $endTimestamp],
            $startTimestamp,
            $endTimestamp,
            $pageSize,
            $maxPagesSafetyGuard,
            $resumeToken,
            $existingRunId
        );
    }

    /**
     * V2-05.2.3: Evaluates truthful RMA coverage for a requested period.
     * Returns:
     * - status: AVAILABLE, PARTIAL, NOT_SYNCED, ERROR
     * - is_verified: bool (strictly true only when status is AVAILABLE)
     * - message: Vietnamese business UI copy
     */
    public function getRmaPeriodCoverage(string $shopId, ?string $startDate = null, ?string $endDate = null): array {
        try {
            if (!$startDate || !$endDate) {
                // Check latest general RMA sync run
                $stmt = $this->db->prepare("SELECT * FROM `commerce_sync_runs` 
                    WHERE platform = :plat AND shop_id = :shop_id 
                      AND (LOWER(source_domain) IN ('rma', 'return_refund', 'aftersales') OR api_endpoint LIKE '%return%')
                    ORDER BY id DESC LIMIT 1");
                $stmt->execute([':plat' => self::PLATFORM_TIKTOK_SHOP, ':shop_id' => $shopId]);
                $latest = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$latest) {
                    return [
                        'status' => 'NOT_SYNCED',
                        'is_verified' => false,
                        'message' => 'Chưa đồng bộ dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                        'display' => 'Chưa đồng bộ dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                        'sync_run_id' => null
                    ];
                }
                $st = $latest['status'] ?? 'UNKNOWN';
                if ($st === 'COMPLETED') {
                    return [
                        'status' => 'AVAILABLE',
                        'is_verified' => true,
                        'message' => 'Đã đối soát dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                        'display' => 'Đã đối soát dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                        'sync_run_id' => (int)$latest['id']
                    ];
                } elseif ($st === 'PARTIAL') {
                    return [
                        'status' => 'PARTIAL',
                        'is_verified' => false,
                        'message' => 'Dữ liệu Trả hàng / Hoàn tiền của kỳ này chưa đầy đủ',
                        'display' => 'Dữ liệu Trả hàng / Hoàn tiền của kỳ này chưa đầy đủ',
                        'sync_run_id' => (int)$latest['id']
                    ];
                } elseif ($st === 'FAILED') {
                    return [
                        'status' => 'ERROR',
                        'is_verified' => false,
                        'message' => 'Lỗi khi đối soát dữ liệu Trả hàng / Hoàn tiền',
                        'display' => 'Lỗi khi đối soát dữ liệu Trả hàng / Hoàn tiền',
                        'sync_run_id' => (int)$latest['id']
                    ];
                }
                return [
                    'status' => 'NOT_SYNCED',
                    'is_verified' => false,
                    'message' => 'Chưa đồng bộ dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                    'display' => 'Chưa đồng bộ dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                    'sync_run_id' => (int)$latest['id']
                ];
            }

            // Explicit period requested: Check runs covering this period
            $stmt = $this->db->prepare("SELECT * FROM `commerce_sync_runs` 
                WHERE platform = :plat AND shop_id = :shop_id 
                  AND (LOWER(source_domain) IN ('rma', 'return_refund', 'aftersales') OR api_endpoint LIKE '%return%')
                ORDER BY id DESC");
            $stmt->execute([':plat' => self::PLATFORM_TIKTOK_SHOP, ':shop_id' => $shopId]);
            $runs = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($runs)) {
                return [
                    'status' => 'NOT_SYNCED',
                    'is_verified' => false,
                    'message' => 'Chưa đồng bộ dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                    'display' => 'Chưa đồng bộ dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                    'sync_run_id' => null
                ];
            }

            $covered = false;
            $hasPartial = false;
            $hasError = false;
            $matchedRunId = null;

            foreach ($runs as $r) {
                $rStatus = $r['status'] ?? '';
                $wStart = !empty($r['start_date']) ? $r['start_date'] : substr($r['window_start_time'] ?? '', 0, 10);
                $wEnd = !empty($r['end_date']) ? $r['end_date'] : substr($r['window_end_time'] ?? '', 0, 10);

                $isPeriodMatch = false;
                if ($wStart && $wEnd) {
                    if ($wStart <= $startDate && $wEnd >= $endDate) {
                        $isPeriodMatch = true;
                    } elseif ($wStart === $startDate && $wEnd === $endDate) {
                        $isPeriodMatch = true;
                    }
                }

                if ($isPeriodMatch) {
                    if ($rStatus === 'COMPLETED') {
                        if (($r['error_code'] ?? '') !== 'RMA_PERIOD_MISMATCH') {
                            $covered = true;
                            $matchedRunId = (int)$r['id'];
                            break;
                        }
                    } elseif ($rStatus === 'PARTIAL') {
                        $hasPartial = true;
                        if ($matchedRunId === null) $matchedRunId = (int)$r['id'];
                    } elseif ($rStatus === 'FAILED') {
                        $hasError = true;
                        if ($matchedRunId === null) $matchedRunId = (int)$r['id'];
                    }
                }
            }

            if ($covered) {
                return [
                    'status' => 'AVAILABLE',
                    'is_verified' => true,
                    'message' => 'Đã đối soát dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                    'display' => 'Đã đối soát dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                    'sync_run_id' => $matchedRunId
                ];
            } elseif ($hasPartial) {
                return [
                    'status' => 'PARTIAL',
                    'is_verified' => false,
                    'message' => 'Dữ liệu Trả hàng / Hoàn tiền của kỳ này chưa đầy đủ',
                    'display' => 'Dữ liệu Trả hàng / Hoàn tiền của kỳ này chưa đầy đủ',
                    'sync_run_id' => $matchedRunId
                ];
            } elseif ($hasError) {
                return [
                    'status' => 'ERROR',
                    'is_verified' => false,
                    'message' => 'Lỗi khi đối soát dữ liệu Trả hàng / Hoàn tiền',
                    'display' => 'Lỗi khi đối soát dữ liệu Trả hàng / Hoàn tiền',
                    'sync_run_id' => $matchedRunId
                ];
            } else {
                return [
                    'status' => 'NOT_SYNCED',
                    'is_verified' => false,
                    'message' => 'Chưa đồng bộ dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                    'display' => 'Chưa đồng bộ dữ liệu Trả hàng / Hoàn tiền cho kỳ đã chọn',
                    'sync_run_id' => null
                ];
            }
        } catch (\Throwable $t) {
            return [
                'status' => 'ERROR',
                'is_verified' => false,
                'message' => 'Lỗi khi kiểm tra độ phủ Trả hàng / Hoàn tiền',
                'display' => 'Lỗi khi kiểm tra độ phủ Trả hàng / Hoàn tiền',
                'sync_run_id' => null
            ];
        }
    }

    /**
     * Executes incremental delta sync for RMAs based on update_time watermark
     */
    public function incrementalSyncRma(
        string $shopId,
        int $overlapSeconds = 7200,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 100,
        ?int $existingRunId = null
    ): array {
        $stmtWatermark = $this->db->prepare("SELECT MAX(platform_updated_at) FROM `commerce_aftersales` WHERE platform = ? AND shop_id = ?");
        $stmtWatermark->execute([self::PLATFORM_TIKTOK_SHOP, $shopId]);
        $latestUpdated = $stmtWatermark->fetchColumn();

        if (empty($latestUpdated)) {
            $thirtyDaysAgo = time() - 30 * 86400;
            return $this->initialBackfillRma($shopId, $thirtyDaysAgo, time(), $pageSize, $maxPagesSafetyGuard, null, $existingRunId);
        }

        $latestTimestamp = strtotime($latestUpdated);
        $syncStart = max(0, $latestTimestamp - $overlapSeconds);
        $syncEnd = time();

        return $this->syncAftersalesRmaSession(
            $shopId,
            'INCREMENTAL_DELTA',
            ['update_time_ge' => $syncStart, 'update_time_lt' => $syncEnd],
            $syncStart,
            $syncEnd,
            $pageSize,
            $maxPagesSafetyGuard,
            null,
            $existingRunId
        );
    }

    /**
     * Ingests fulfillment packages and logs lifecycle events to commerce_order_events
     */
    public function syncFulfillmentPackagesSession(
        string $shopId,
        string $syncType,
        array $queryFilters,
        ?int $windowStart = null,
        ?int $windowEnd = null,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 100,
        ?string $resumeToken = null
    ): array {
        $accessToken = $this->resolveAccessToken($shopId);
        if (empty($accessToken)) {
            return [
                'status' => 'FAILED',
                'error_code' => 'ACCESS_TOKEN_NOT_FOUND',
                'message' => "Valid TikTok access token not found for shop ID: {$shopId}"
            ];
        }

        $shopCipher = $this->resolveShopCipher($shopId, $accessToken);
        $pageSize = min(50, max(1, $pageSize));

        $windowStartTs = ($windowStart !== null && $windowStart > 0) ? $windowStart : null;
        $windowEndTs = ($windowEnd !== null && $windowEnd > 0) ? $windowEnd : null;
        $resumeTokenStr = !empty($resumeToken) ? trim((string)$resumeToken) : null;

        static $hasSourceDomain = null;
        if ($hasSourceDomain === null) {
            try {
                $check = $this->db->query("SHOW COLUMNS FROM `commerce_sync_runs` LIKE 'source_domain'")->fetch();
                $hasSourceDomain = !empty($check);
            } catch (Throwable $e) {
                $hasSourceDomain = false;
            }
        }

        if ($hasSourceDomain) {
            $stmtRun = $this->db->prepare("INSERT INTO `commerce_sync_runs` 
                (platform, shop_id, source_domain, sync_type, status, window_start_time, window_end_time, current_page_token, last_page_token, started_at)
                VALUES (?, ?, ?, ?, 'RUNNING', FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, ?, NOW())");
            $stmtRun->execute([
                self::PLATFORM_TIKTOK_SHOP,
                $shopId,
                self::SOURCE_DOMAIN_FULFILLMENT,
                $syncType,
                $windowStartTs,
                $windowEndTs,
                $resumeTokenStr,
                $resumeTokenStr
            ]);
        } else {
            $stmtRun = $this->db->prepare("INSERT INTO `commerce_sync_runs` 
                (platform, shop_id, sync_type, status, window_start_time, window_end_time, current_page_token, last_page_token, started_at)
                VALUES (?, ?, ?, 'RUNNING', FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, ?, NOW())");
            $stmtRun->execute([
                self::PLATFORM_TIKTOK_SHOP,
                $shopId,
                $syncType,
                $windowStartTs,
                $windowEndTs,
                $resumeTokenStr,
                $resumeTokenStr
            ]);
        }
        $runId = (int)$this->db->lastInsertId();

        $currentPageToken = $resumeTokenStr;
        $pageCount = 0;
        $totalPackages = 0;
        $totalEvents = 0;
        $seenCursors = [];
        if ($currentPageToken !== null && $currentPageToken !== '') {
            $seenCursors[$currentPageToken] = true;
        }

        $sessionStatus = 'RUNNING';
        $errorMessage = null;

        while (true) {
            if ($pageCount >= $maxPagesSafetyGuard) {
                $sessionStatus = 'INTERRUPTED';
                $errorMessage = "Reached max_pages_safety_guard ({$maxPagesSafetyGuard} pages). Checkpoint preserved.";
                break;
            }

            $searchOptions = array_merge($queryFilters, [
                'page_size' => $pageSize,
                'page_token' => $currentPageToken
            ]);

            try {
                $searchResult = $this->client->searchFulfillmentPackagesV2($accessToken, $shopCipher, $searchOptions);
            } catch (Throwable $e) {
                $sessionStatus = 'FAILED';
                $errorMessage = "TikTok Fulfillment API Search failed: " . $e->getMessage();
                break;
            }

            $packages = $searchResult['packages'] ?? [];
            $nextPageToken = isset($searchResult['next_page_token']) ? trim((string)$searchResult['next_page_token']) : '';

            if (empty($packages)) {
                $sessionStatus = 'COMPLETED';
                break;
            }

            $this->db->beginTransaction();
            try {
                $pagePackageCount = 0;
                $pageEventCount = 0;

                foreach ($packages as $pkg) {
                    $packageId = (string)($pkg['package_id'] ?? $pkg['id'] ?? '');
                    if ($packageId === '') continue;

                    $platformOrderId = (string)($pkg['order_id'] ?? '');
                    $rawStatus = (string)($pkg['package_status'] ?? $pkg['status'] ?? '');
                    $normalizedStatus = self::normalizePackageStatus($rawStatus);
                    $updateTimeTs = (int)($pkg['update_time'] ?? $pkg['platform_updated_at'] ?? 0);
                    $createTimeTs = (int)($pkg['create_time'] ?? 0);

                    // 1. Sanitize & Persist Raw Observation
                    $sanitizedPkg = self::sanitizeAftersalesPayloadRecursive($pkg);
                    if (!self::verifyNoForbiddenPii($sanitizedPkg)) {
                        throw new SecurityException("Forbidden PII in package payload {$packageId}. Aborting.");
                    }
                    $sanitizedJson = json_encode($sanitizedPkg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                    $payloadHash = hash('sha256', $sanitizedJson);

                    $stmtRaw = $this->db->prepare("INSERT INTO `commerce_raw_observations`
                        (platform, shop_id, source_domain, api_version, endpoint, entity_type, platform_entity_id, sanitized_payload, payload_hash, observed_at, platform_updated_at, sync_run_id)
                        VALUES (?, ?, ?, ?, ?, 'package', ?, ?, ?, NOW(), FROM_UNIXTIME(?), ?)
                        ON DUPLICATE KEY UPDATE
                        sanitized_payload = VALUES(sanitized_payload),
                        observed_at = NOW(),
                        sync_run_id = VALUES(sync_run_id)");
                    $stmtRaw->execute([
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        self::SOURCE_DOMAIN_FULFILLMENT,
                        self::API_VERSION_FULFILLMENT,
                        defined('TIKTOK_API_PACKAGES_SEARCH_ENDPOINT') ? TIKTOK_API_PACKAGES_SEARCH_ENDPOINT : '/fulfillment/202309/packages/search',
                        $packageId,
                        $sanitizedJson,
                        $payloadHash,
                        $updateTimeTs > 0 ? $updateTimeTs : null,
                        $runId
                    ]);
                    $rawObservationId = (int)$this->db->lastInsertId();

                    // 2. Append-Only Order Lifecycle Event Logging (Correction 2: Deterministic Business Event Key)
                    $eventType = 'PACKAGE_' . $normalizedStatus;
                    $eventKey = self::computeEventKey(
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        'FULFILLMENT',
                        $packageId,
                        $eventType,
                        $normalizedStatus,
                        $updateTimeTs > 0 ? $updateTimeTs : $createTimeTs
                    );

                    $stmtEvent = $this->db->prepare("INSERT IGNORE INTO `commerce_order_events` (
                        platform, shop_id, platform_order_id, event_domain, event_type, event_key,
                        previous_status, new_status, event_timestamp, observed_at,
                        source_domain, api_version, endpoint, platform_entity_id,
                        payload_hash, sync_run_id, raw_observation_id
                    ) VALUES (
                        ?, ?, ?, 'FULFILLMENT', ?, ?,
                        NULL, ?, FROM_UNIXTIME(?), NOW(),
                        ?, ?, ?, ?,
                        ?, ?, ?
                    )");
                    $stmtEvent->execute([
                        self::PLATFORM_TIKTOK_SHOP,
                        $shopId,
                        $platformOrderId,
                        $eventType,
                        $eventKey,
                        $normalizedStatus,
                        $updateTimeTs > 0 ? $updateTimeTs : ($createTimeTs > 0 ? $createTimeTs : null),
                        self::SOURCE_DOMAIN_FULFILLMENT,
                        self::API_VERSION_FULFILLMENT,
                        '/fulfillment/202309/packages/search',
                        $packageId,
                        $payloadHash,
                        $runId,
                        $rawObservationId > 0 ? $rawObservationId : null
                    ]);

                    if ($stmtEvent->rowCount() > 0) {
                        $pageEventCount++;
                    }
                    $pagePackageCount++;
                }

                $pageCount++;
                $totalPackages += $pagePackageCount;
                $totalEvents += $pageEventCount;

                $stmtCheckpoint = $this->db->prepare("UPDATE `commerce_sync_runs` SET
                    current_page_token = ?,
                    last_page_token = ?,
                    pages_processed = ?,
                    orders_ingested = ?,
                    items_ingested = ?
                    WHERE id = ?");
                $stmtCheckpoint->execute([
                    $currentPageToken,
                    $nextPageToken,
                    $pageCount,
                    $totalPackages,
                    $totalEvents,
                    $runId
                ]);

                $this->db->commit();
            } catch (Throwable $pageEx) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                $sessionStatus = 'FAILED';
                $errorMessage = "Transaction aborted on package page {$pageCount}: " . $pageEx->getMessage();
                break;
            }

            if ($nextPageToken === '' || $nextPageToken === null) {
                $sessionStatus = 'COMPLETED';
                break;
            }

            if (isset($seenCursors[$nextPageToken])) {
                $sessionStatus = 'COMPLETED';
                $errorMessage = "Detected repeating cursor token {$nextPageToken}. Halting pagination loop.";
                break;
            }

            $seenCursors[$nextPageToken] = true;
            $currentPageToken = $nextPageToken;
        }

        $stmtFinal = $this->db->prepare("UPDATE `commerce_sync_runs` SET
            status = ?,
            error_message = ?,
            completed_at = NOW(),
            pages_processed = ?,
            orders_ingested = ?,
            items_ingested = ?
            WHERE id = ?");
        $stmtFinal->execute([
            $sessionStatus,
            $errorMessage,
            $pageCount,
            $totalPackages,
            $totalEvents,
            $runId
        ]);

        return [
            'sync_run_id' => $runId,
            'status' => $sessionStatus,
            'pages_processed' => $pageCount,
            'packages_ingested' => $totalPackages,
            'events_logged' => $totalEvents,
            'last_page_token' => $currentPageToken,
            'error_message' => $errorMessage
        ];
    }

    /**
     * Executes initial historical backfill for fulfillment packages
     */
    public function initialBackfillFulfillment(
        string $shopId,
        int $startTimestamp,
        int $endTimestamp,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 100,
        ?string $resumeToken = null
    ): array {
        return $this->syncFulfillmentPackagesSession(
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
     * Executes incremental delta sync for fulfillment packages
     */
    public function incrementalSyncFulfillment(
        string $shopId,
        int $overlapSeconds = 7200,
        int $pageSize = 100,
        int $maxPagesSafetyGuard = 100
    ): array {
        $stmtWatermark = $this->db->prepare("SELECT MAX(observed_at) FROM `commerce_order_events` WHERE platform = ? AND shop_id = ? AND event_domain = 'FULFILLMENT'");
        $stmtWatermark->execute([self::PLATFORM_TIKTOK_SHOP, $shopId]);
        $latestObserved = $stmtWatermark->fetchColumn();

        if (empty($latestObserved)) {
            $thirtyDaysAgo = time() - 30 * 86400;
            return $this->initialBackfillFulfillment($shopId, $thirtyDaysAgo, time(), $pageSize, $maxPagesSafetyGuard);
        }

        $latestTimestamp = strtotime($latestObserved);
        $syncStart = max(0, $latestTimestamp - $overlapSeconds);
        $syncEnd = time();

        return $this->syncFulfillmentPackagesSession(
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
}

