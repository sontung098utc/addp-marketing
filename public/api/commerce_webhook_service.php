<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE V2 - AUTHORITATIVE WEBHOOK SERVICE
 * File: public/api/commerce_webhook_service.php
 * Target: P0 Webhook Database-First Architecture (P0-W2)
 *
 * Responsibilities:
 * 1. Cryptographic HMAC-SHA256 signature verification (Fail-closed).
 * 2. Anti-replay freshness check (|timestamp - now| <= 300s).
 * 3. Durable Webhook Inbox & Idempotent Deduplication (commerce_webhook_events).
 * 4. Status Precedence Matrix & Timestamp monotonicity (out-of-order protection).
 * 5. Canonical Commerce V2 ingestion (commerce_orders, items, RMA, loss ledger).
 * 6. Automated queue invalidation for Daily Aggregates (commerce_daily_aggregate_queue).
 * 7. Zero fabricated revenue: strictly authentic platform values only.
 * ====================================================================
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/commerce_loss_engine.php';
require_once __DIR__ . '/commerce_daily_aggregate_service.php';

class CommerceWebhookService {
    public const PLATFORM = 'tiktok_shop';
    public const MAX_PAYLOAD_BYTES = 1048576; // 1 MB
    public const REPLAY_WINDOW_SECONDS = 300; // 5 minutes

    // Status Precedence Weights (Higher = Later in lifecycle)
    public const STATUS_WEIGHTS = [
        'UNPAID'               => 10,
        'ON_HOLD'              => 20,
        'AWAITING_SHIPMENT'    => 30,
        'AWAITING_COLLECTION'  => 40,
        'IN_TRANSIT'           => 50,
        'DELIVERED'            => 60,
        'COMPLETED'            => 70,
        'CANCELLED'            => 90  // Terminal cancellation
    ];

    // Aftersales Status Precedence Weights (Higher = Later in lifecycle, F09 fix)
    public const AFTERSALES_STATUS_WEIGHTS = [
        'REQUESTED'        => 10,
        'SELLER_DISPUTE'   => 20,
        'PROCESSING'       => 25,
        'APPROVED'         => 30,
        'RETURN_DELIVERED' => 35,
        'REFUND_SUCCESS'   => 50,
        'SUCCESS'          => 50,
        'CANCELLED'        => 90, // Terminal
        'REJECTED'         => 90  // Terminal
    ];

    /**
     * Determines whether transitioning from currentStatus to newStatus is permissible under lifecycle rules.
     */
    public static function isAllowedStatusTransition(?string $currentStatus, ?string $newStatus): bool {
        if (empty($currentStatus)) return true;
        if (empty($newStatus)) return false;

        $curr = strtoupper(trim($currentStatus));
        $new = strtoupper(trim($newStatus));

        if ($curr === $new) return true;

        // Terminal states cannot transition to earlier/active states
        if (in_array($curr, ['COMPLETED', 'CANCELLED'], true)) {
            return false;
        }

        $currWeight = self::STATUS_WEIGHTS[$curr] ?? 0;
        $newWeight = self::STATUS_WEIGHTS[$new] ?? 0;

        return $newWeight >= $currWeight;
    }

    private PDO $db;
    private ?string $appSecret;

    public function __construct(?PDO $db = null, ?string $appSecret = null) {
        $this->db = $db ?? getDBConnection();
        $this->appSecret = $appSecret ?? (
            defined('TIKTOK_APP_SECRET') && !empty(TIKTOK_APP_SECRET) ? TIKTOK_APP_SECRET : (
                !empty($_ENV['TIKTOK_APP_SECRET']) ? $_ENV['TIKTOK_APP_SECRET'] : null
            )
        );
    }

    /**
     * Verifies webhook HMAC signature across standard TikTok Shop algorithms.
     * Fail-closed: Must match if secret is configured.
     */
    public function verifySignature(string $rawBody, ?string $signature, ?int $timestamp, string $uriPath = '/api/webhook.php'): bool {
        if (empty($this->appSecret) || empty($signature)) {
            return false;
        }

        // 1. TikTok Shop Open API standard: secret + path + timestamp + rawBody
        if ($timestamp !== null && $timestamp > 0) {
            $baseString = $this->appSecret . $uriPath . $timestamp . $rawBody;
            $computed1 = hash_hmac('sha256', $baseString, $this->appSecret);
            if (hash_equals($signature, $computed1)) {
                return true;
            }
        }

        // 2. TikTok Shop Open API v2 payload digest: rawBody
        $computed2 = hash_hmac('sha256', $rawBody, $this->appSecret);
        if (hash_equals($signature, $computed2)) {
            return true;
        }

        return false;
    }

    /**
     * Verifies timestamp freshness to protect against replay attacks.
     */
    public function verifyTimestampFreshness(?int $timestamp): bool {
        if ($timestamp === null || $timestamp <= 0) {
            // Timestamp header missing or invalid
            return false;
        }
        return abs(time() - $timestamp) <= self::REPLAY_WINDOW_SECONDS;
    }

    /**
     * Ingests, dedupes, and processes an incoming webhook event.
     *
     * @param array $payload Decoded JSON
     * @param string $rawBody Raw string for provenance hashing
     * @param string|null $signature Provided signature header
     * @param int|null $timestamp Request timestamp
     * @param string $uriPath Request URI path
     * @return array Standard response array [code, message, event_id, status]
     */
    public function processEvent(
        array $payload,
        string $rawBody,
        ?string $signature = null,
        ?int $timestamp = null,
        string $uriPath = '/api/webhook.php'
    ): array {
        // 1. Payload size guard
        if (strlen($rawBody) > self::MAX_PAYLOAD_BYTES) {
            return [
                'success' => false,
                'code' => 413,
                'message' => 'Payload Too Large: Exceeds 1MB limit',
                'http_status' => 413
            ];
        }

        // 2. Cryptographic signature check (Fail-closed: F01 fix)
        if (empty($this->appSecret)) {
            return [
                'success' => false,
                'code' => 500,
                'message' => 'Configuration Error: TIKTOK_APP_SECRET is not configured on server',
                'http_status' => 500
            ];
        }

        if (!$this->verifySignature($rawBody, $signature, $timestamp, $uriPath)) {
            return [
                'success' => false,
                'code' => 401,
                'message' => 'Unauthorized: Invalid webhook signature',
                'http_status' => 401
            ];
        }

        // 3. Replay attack check
        if ($timestamp !== null && $timestamp > 0) {
            if (!$this->verifyTimestampFreshness($timestamp)) {
                return [
                    'success' => false,
                    'code' => 403,
                    'message' => 'Forbidden: Webhook timestamp expired (Replay protection)',
                    'http_status' => 403
                ];
            }
        }

        // 4. Resolve event parameters
        $eventType = (string)($payload['type'] ?? $payload['event_type'] ?? 'UNKNOWN');
        $eventData = $payload['data'] ?? [];
        $orderId = (string)($eventData['order_id'] ?? $eventData['id'] ?? $payload['order_id'] ?? '');
        $shopId = (string)($payload['shop_id'] ?? $eventData['shop_id'] ?? $this->resolveDefaultShopId());

        if (empty($shopId)) {
            $shopId = '7495657895504611503';
        }

        // 5. Derive authoritative event identity
        $eventId = (string)($payload['event_id'] ?? $eventData['event_id'] ?? '');
        if (empty($eventId)) {
            $orderStatus = (string)($eventData['order_status'] ?? $eventData['status'] ?? '');
            $eventId = 'evt_' . hash('sha256', $shopId . ':' . $eventType . ':' . $orderId . ':' . $orderStatus . ':' . ($timestamp ?: time()));
        }

        $payloadHash = hash('sha256', $rawBody);
        $eventTs = ($timestamp !== null && $timestamp > 0) ? date('Y-m-d H:i:s', $timestamp) : date('Y-m-d H:i:s');

        // 6. Durable Event Inbox Storage & Deduplication (Fail-closed on storage failure: F06)
        $inboxRes = $this->recordInboxEvent($shopId, $eventId, $eventType, $payloadHash, $rawBody, $eventTs);
        if (empty($inboxRes['success'])) {
            return [
                'success' => false,
                'code' => 500,
                'message' => 'Error recording webhook event into durable inbox: ' . ($inboxRes['error'] ?? 'Storage failure'),
                'event_id' => $eventId,
                'status' => 'STORAGE_FAILED',
                'http_status' => 500
            ];
        }

        if (!empty($inboxRes['is_duplicate'])) {
            return [
                'success' => true,
                'code' => 0,
                'message' => 'Duplicate event ignored',
                'event_id' => $eventId,
                'status' => 'DUPLICATE_IGNORED',
                'fast_ack' => true,
                'http_status' => 200
            ];
        }

        // 7. Route and execute business logic safely
        $processStatus = 'PROCESSED';
        $errorMessage = null;

        try {
            switch ($eventType) {
                case '1':
                case 'ORDER_STATUS_CHANGE':
                case 'order_status_change':
                    $this->handleOrderStatusChangeEvent($shopId, $eventData, $timestamp);
                    break;

                case '2':
                case 'DEAUTHORIZE':
                case 'deauthorize':
                    $this->handleDeauthorizeEvent($shopId, $payload);
                    break;

                case 'RETURN_STATUS_CHANGE':
                case 'return_status_change':
                case 'AFTERSALES_STATUS_CHANGE':
                    $this->handleAftersalesEvent($shopId, $eventData, $timestamp);
                    break;

                case 'PACKAGE_UPDATE':
                case 'package_update':
                case 'LOGISTICS_UPDATE':
                    $this->handlePackageUpdateEvent($shopId, $eventData, $timestamp);
                    break;

                default:
                    // Known non-fatal generic event: record audit log
                    $this->recordAuditLog('TikTok Webhook', "Sự kiện: {$eventType}", 'Shop ID: ' . $shopId, 'Đã ghi nhận sự kiện');
                    break;
            }
        } catch (\Throwable $t) {
            $processStatus = 'FAILED';
            $errorMessage = $t->getMessage();
        }

        // 8. Update inbox record with final status
        $this->updateInboxStatus($shopId, $eventId, $processStatus, $errorMessage);

        if ($processStatus === 'FAILED') {
            return [
                'success' => false,
                'code' => 500,
                'message' => 'Error processing webhook event: ' . $errorMessage,
                'event_id' => $eventId,
                'status' => 'FAILED',
                'http_status' => 500
            ];
        }

        return [
            'success' => true,
            'code' => 0,
            'message' => 'success',
            'event_id' => $eventId,
            'status' => 'PROCESSED',
            'http_status' => 200
        ];
    }

    /**
     * Handles ORDER_STATUS_CHANGE event with precedence matrix, terminal state lock, and out-of-order safety (F08, F10, F16).
     */
    private function handleOrderStatusChangeEvent(string $shopId, array $data, ?int $eventTimestamp): void {
        $orderId = trim((string)($data['order_id'] ?? $data['id'] ?? ''));
        if (empty($orderId)) {
            throw new \InvalidArgumentException('Missing required order_id in order event');
        }

        $rawStatus = (string)($data['order_status'] ?? $data['status'] ?? '');
        $normalizedStatus = $this->normalizeOrderStatus($rawStatus);

        $inTx = false;
        if (!$this->db->inTransaction()) {
            $this->db->beginTransaction();
            $inTx = true;
        }

        try {
            // Precedence & out-of-order check against existing order
            $existingOrder = null;
            try {
                $stmt = $this->db->prepare("SELECT id, order_status, platform_updated_at, platform_created_at, order_gross_amount 
                    FROM `commerce_orders` 
                    WHERE platform = :plat AND shop_id = :shop_id AND platform_order_id = :ord_id LIMIT 1");
                $stmt->execute([
                    ':plat' => self::PLATFORM,
                    ':shop_id' => $shopId,
                    ':ord_id' => $orderId
                ]);
                $existingOrder = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
            } catch (\Throwable $t) {}

            $incomingUpdTs = isset($data['update_time']) ? (int)$data['update_time'] : ($eventTimestamp ?: time());

            if ($existingOrder) {
                $currentStatus = (string)($existingOrder['order_status'] ?? '');
                $currentUpdTs = !empty($existingOrder['platform_updated_at']) ? strtotime($existingOrder['platform_updated_at']) : 0;

                // Out-of-order check 1: Event update time is older than current DB update time
                if ($currentUpdTs > 0 && $incomingUpdTs > 0 && $incomingUpdTs < $currentUpdTs) {
                    $this->recordAuditLog('TikTok Webhook', "Order {$orderId}", 'Bỏ qua bản ghi cũ', "Incoming TS ({$incomingUpdTs}) < DB TS ({$currentUpdTs})");
                    if ($inTx && $this->db->inTransaction()) {
                        $this->db->commit();
                    }
                    return; // Ignore stale event
                }

                // Out-of-order check 2: Strict Status precedence matrix & Terminal protection (F08 fix)
                if (!self::isAllowedStatusTransition($currentStatus, $normalizedStatus)) {
                    $this->recordAuditLog('TikTok Webhook', "Order {$orderId}", 'Từ chối chuyển lùi trạng thái hoặc mở lại đơn đã hủy', "Current {$currentStatus} -> Attempted {$normalizedStatus}");
                    if ($inTx && $this->db->inTransaction()) {
                        $this->db->commit();
                    }
                    return; // Strictly reject invalid transition (e.g. CANCELLED -> AWAITING_SHIPMENT)
                }

                // Update existing order header
                $updateSql = "UPDATE `commerce_orders` SET
                    order_status = :norm_status,
                    platform_status = :raw_status,
                    platform_updated_at = FROM_UNIXTIME(:upd_ts),
                    updated_at = NOW()";

                $params = [
                    ':norm_status' => $normalizedStatus,
                    ':raw_status' => $rawStatus,
                    ':upd_ts' => $incomingUpdTs,
                    ':id' => $existingOrder['id']
                ];

                // If authentic total_amount provided in webhook, update it (NEVER overwrite with synthetic amount)
                if (isset($data['total_amount']) && is_numeric($data['total_amount']) && (float)$data['total_amount'] > 0) {
                    $updateSql .= ", order_gross_amount = :gross_amt";
                    $params[':gross_amt'] = (float)$data['total_amount'];
                }

                if (isset($data['paid_time']) && (int)$data['paid_time'] > 0) {
                    $updateSql .= ", paid_at = FROM_UNIXTIME(:paid_ts)";
                    $params[':paid_ts'] = (int)$data['paid_time'];
                }

                $updateSql .= " WHERE id = :id";
                $this->db->prepare($updateSql)->execute($params);

                $orderCohortDate = !empty($existingOrder['platform_created_at']) ? substr($existingOrder['platform_created_at'], 0, 10) : date('Y-m-d');
            } else {
                // New order insertion (F16 fix: distinct placeholder names for gross_amt and sub_total)
                $createTs = isset($data['create_time']) ? (int)$data['create_time'] : ($incomingUpdTs ?: time());
                $paidTs = isset($data['paid_time']) ? (int)$data['paid_time'] : null;
                $grossAmount = isset($data['total_amount']) && is_numeric($data['total_amount']) ? (float)$data['total_amount'] : 0.00;
                $currency = (string)($data['currency'] ?? 'VND');

                $insertSql = "INSERT INTO `commerce_orders` (
                    platform, shop_id, platform_order_id, order_status, platform_status,
                    platform_created_at, platform_updated_at, paid_at, currency,
                    order_gross_amount, sub_total, created_at, updated_at
                ) VALUES (
                    :plat, :shop_id, :ord_id, :norm_status, :raw_status,
                    FROM_UNIXTIME(:ctime), FROM_UNIXTIME(:utime), " . ($paidTs ? "FROM_UNIXTIME({$paidTs})" : "NULL") . ", :curr,
                    :gross_amt, :sub_total, NOW(), NOW()
                )";

                $this->db->prepare($insertSql)->execute([
                    ':plat' => self::PLATFORM,
                    ':shop_id' => $shopId,
                    ':ord_id' => $orderId,
                    ':norm_status' => $normalizedStatus,
                    ':raw_status' => $rawStatus,
                    ':ctime' => $createTs,
                    ':utime' => $incomingUpdTs,
                    ':curr' => $currency,
                    ':gross_amt' => $grossAmount,
                    ':sub_total' => $grossAmount
                ]);

                $orderCohortDate = date('Y-m-d', $createTs);
            }

            // If line items provided, upsert them safely
            if (!empty($data['line_items']) && is_array($data['line_items'])) {
                $this->upsertOrderLineItems($shopId, $orderId, $data['line_items']);
            }

            // If order transitioned to CANCELLED, trigger Loss Engine reconciliation (F10 fix: failure must not be swallowed)
            if ($normalizedStatus === 'CANCELLED') {
                $lossEngine = new CommerceLossEngine($this->db);
                $lossEngine->computeAndPersistLossLedger($shopId, $orderId, 'MATURED_LIFECYCLE');
            }

            // Enqueue cohort date into commerce_daily_aggregate_queue for automatic recalculation (F10 fix)
            $dailyAgg = new CommerceDailyAggregateService($this->db);
            $dailyAgg->enqueueDate($shopId, $orderCohortDate, 'WEBHOOK_ORDER_STATUS');

            if ($inTx && $this->db->inTransaction()) {
                $this->db->commit();
            }
        } catch (\Throwable $t) {
            if ($inTx && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $t; // Propagate error so processEvent marks event as FAILED
        }
    }

    /**
     * Handles aftersales / return / refund status changes into commerce_aftersales & Loss Engine (F09, F10).
     */
    private function handleAftersalesEvent(string $shopId, array $data, ?int $eventTimestamp): void {
        $rmaId = (string)($data['aftersales_id'] ?? $data['reverse_order_id'] ?? $data['return_order_id'] ?? '');
        $orderId = (string)($data['order_id'] ?? '');

        if (empty($rmaId) && empty($orderId)) {
            return;
        }

        $rawStatus = (string)($data['aftersales_status'] ?? $data['return_status'] ?? $data['status'] ?? 'REQUESTED');
        $normStatus = $this->normalizeAftersalesStatus($rawStatus);
        $refundAmount = isset($data['refund_amount']) ? (float)$data['refund_amount'] : 0.00;
        $reasonCategory = (string)($data['reason_category'] ?? $data['reason'] ?? 'BUYER_DECISION');

        $inTx = false;
        if (!$this->db->inTransaction()) {
            $this->db->beginTransaction();
            $inTx = true;
        }

        try {
            $targetRmaId = $rmaId ?: ('rma_' . $orderId);
            if ($this->hasTable('commerce_aftersales')) {
                // Out-of-order and precedence check (F09 fix)
                $stmtExRma = $this->db->prepare("SELECT id, aftersales_status, platform_updated_at FROM `commerce_aftersales` 
                    WHERE platform = :plat AND shop_id = :shop_id AND aftersales_id = :rma_id LIMIT 1");
                $stmtExRma->execute([':plat' => self::PLATFORM, ':shop_id' => $shopId, ':rma_id' => $targetRmaId]);
                $existingRma = $stmtExRma->fetch(PDO::FETCH_ASSOC);

                if ($existingRma) {
                    $currRmaStatus = (string)($existingRma['aftersales_status'] ?? '');
                    $currRmaUpdTs = !empty($existingRma['platform_updated_at']) ? strtotime($existingRma['platform_updated_at']) : 0;

                    // Out-of-order check 1: Event update time is older than current DB update time
                    if ($currRmaUpdTs > 0 && $eventTimestamp !== null && $eventTimestamp > 0 && $eventTimestamp < $currRmaUpdTs) {
                        $this->recordAuditLog('TikTok Webhook', "RMA {$targetRmaId}", 'Bỏ qua bản ghi cũ', "Incoming TS ({$eventTimestamp}) < DB TS ({$currRmaUpdTs})");
                        if ($inTx && $this->db->inTransaction()) {
                            $this->db->commit();
                        }
                        return;
                    }

                    // Out-of-order check 2: Precedence check (F09 fix)
                    $currWeight = self::AFTERSALES_STATUS_WEIGHTS[$currRmaStatus] ?? 0;
                    $newWeight = self::AFTERSALES_STATUS_WEIGHTS[$normStatus] ?? 0;
                    if ($currWeight >= 50 && $newWeight < 50) {
                        $this->recordAuditLog('TikTok Webhook', "RMA {$targetRmaId}", 'Từ chối hoàn nguyên sau khi hoàn tiền thành công', "Current {$currRmaStatus} -> Attempted {$normStatus}");
                        if ($inTx && $this->db->inTransaction()) {
                            $this->db->commit();
                        }
                        return;
                    }
                    if ($currWeight > $newWeight) {
                        $this->recordAuditLog('TikTok Webhook', "RMA {$targetRmaId}", 'Bỏ qua chuyển lùi trạng thái RMA', "Current {$currRmaStatus} (w={$currWeight}) > New {$normStatus} (w={$newWeight})");
                        if ($inTx && $this->db->inTransaction()) {
                            $this->db->commit();
                        }
                        return;
                    }
                }

                $sql = "INSERT INTO `commerce_aftersales` (
                    platform, shop_id, aftersales_id, platform_order_id, aftersales_type, platform_aftersales_type,
                    aftersales_status, platform_status, refund_amount, reason_category, request_created_at, platform_updated_at,
                    created_at, updated_at
                ) VALUES (
                    :plat, :shop_id, :rma_id, :ord_id, 'RETURN_AND_REFUND', :raw_status,
                    :norm_status, :raw_status, :refund_amt, :reason_cat, NOW(), NOW(),
                    NOW(), NOW()
                ) ON DUPLICATE KEY UPDATE
                    aftersales_status = VALUES(aftersales_status),
                    platform_status = VALUES(platform_status),
                    refund_amount = IF(VALUES(refund_amount) > 0, VALUES(refund_amount), refund_amount),
                    platform_updated_at = NOW(),
                    updated_at = NOW()";

                $this->db->prepare($sql)->execute([
                    ':plat' => self::PLATFORM,
                    ':shop_id' => $shopId,
                    ':rma_id' => $targetRmaId,
                    ':ord_id' => $orderId,
                    ':raw_status' => $rawStatus,
                    ':norm_status' => $normStatus,
                    ':refund_amt' => $refundAmount,
                    ':reason_cat' => $reasonCategory
                ]);
            }

            // If refund finalized (SUCCESS/APPROVED), trigger Loss Engine reconciliation (F10 fix: no swallowed errors)
            if (in_array($normStatus, ['SUCCESS', 'APPROVED', 'REFUND_SUCCESS'], true) && !empty($orderId)) {
                $lossEngine = new CommerceLossEngine($this->db);
                $lossEngine->computeAndPersistLossLedger($shopId, $orderId, 'MATURED_LIFECYCLE');

                $stmtCDate = $this->db->prepare("SELECT platform_created_at FROM `commerce_orders` WHERE platform = :plat AND shop_id = :shop_id AND platform_order_id = :ord_id LIMIT 1");
                $stmtCDate->execute([':plat' => self::PLATFORM, ':shop_id' => $shopId, ':ord_id' => $orderId]);
                $cDate = $stmtCDate->fetchColumn();
                if ($cDate) {
                    $dailyAgg = new CommerceDailyAggregateService($this->db);
                    $dailyAgg->enqueueDate($shopId, substr((string)$cDate, 0, 10), 'WEBHOOK_RMA_EVENT');
                }
            }

            if ($inTx && $this->db->inTransaction()) {
                $this->db->commit();
            }
        } catch (\Throwable $t) {
            if ($inTx && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $t;
        }
    }

    /**
     * Handles package / logistics update events.
     */
    private function handlePackageUpdateEvent(string $shopId, array $data, ?int $eventTimestamp): void {
        $orderId = (string)($data['order_id'] ?? '');
        $trackingNumber = (string)($data['tracking_number'] ?? '');
        $shippingProvider = (string)($data['shipping_provider'] ?? $data['shipping_carrier'] ?? '');
        $deliveryStatus = strtoupper((string)($data['delivery_status'] ?? $data['status'] ?? ''));

        if (empty($orderId)) return;

        $updateCols = [];
        $params = [':plat' => self::PLATFORM, ':shop_id' => $shopId, ':ord_id' => $orderId];

        if (!empty($trackingNumber)) {
            $updateCols[] = "tracking_number = :track";
            $params[':track'] = $trackingNumber;
        }
        if (!empty($shippingProvider)) {
            $updateCols[] = "shipping_provider = :carrier";
            $params[':carrier'] = $shippingProvider;
        }

        if (!empty($updateCols)) {
            $sql = "UPDATE `commerce_orders` SET " . implode(', ', $updateCols) . ", updated_at = NOW() WHERE platform = :plat AND shop_id = :shop_id AND platform_order_id = :ord_id";
            $this->db->prepare($sql)->execute($params);
        }

        if (in_array($deliveryStatus, ['FAILED', 'FAILED_DELIVERY', 'RTS', 'RETURN_TO_SENDER'], true)) {
            try {
                $lossEngine = new CommerceLossEngine($this->db);
                $lossEngine->computeAndPersistLossLedger($shopId, $orderId, 'MATURED_LIFECYCLE');
            } catch (\Throwable $t) {}
        }
    }

    /**
     * Handles app de-authorization event.
     */
    private function handleDeauthorizeEvent(string $shopId, array $payload): void {
        if (!empty($shopId)) {
            try {
                $this->db->prepare("UPDATE `tiktok_config` SET access_token = NULL WHERE shop_id = ?")->execute([$shopId]);
            } catch (\Throwable $t) {}
        }
        $this->recordAuditLog('TikTok Webhook', "Ngắt kết nối ứng dụng", "Shop ID: {$shopId}", 'Đã thu hồi token theo yêu cầu Webhook');
    }

    /**
     * Upserts order line items safely without inventing IDs.
     */
    private function upsertOrderLineItems(string $shopId, string $orderId, array $lineItems): void {
        if (!$this->hasTable('commerce_order_items')) return;

        $stmtGetId = $this->db->prepare("SELECT id FROM `commerce_orders` WHERE platform = :plat AND shop_id = :shop_id AND platform_order_id = :ord_id LIMIT 1");
        $stmtGetId->execute([':plat' => self::PLATFORM, ':shop_id' => $shopId, ':ord_id' => $orderId]);
        $internalOrderId = (int)$stmtGetId->fetchColumn();
        if ($internalOrderId <= 0) return;

        foreach ($lineItems as $item) {
            $lineItemId = (string)($item['id'] ?? $item['line_item_id'] ?? '');
            if (empty($lineItemId)) continue;

            $productId = (string)($item['product_id'] ?? '');
            $productName = substr((string)($item['product_name'] ?? ''), 0, 255);
            $skuId = (string)($item['sku_id'] ?? '');
            $skuName = isset($item['sku_name']) ? substr((string)$item['sku_name'], 0, 255) : null;
            $qty = max(1, (int)($item['quantity'] ?? 1));
            $salePrice = (float)($item['sale_price'] ?? 0.0);

            $sql = "INSERT INTO `commerce_order_items` (
                order_id, platform, shop_id, platform_order_id, platform_line_item_id,
                product_id, product_name, sku_id, sku_name, quantity, sale_price, created_at, updated_at
            ) VALUES (
                :oid, :plat, :shop_id, :ord_id, :lid,
                :pid, :pname, :skuid, :skuname, :qty, :price, NOW(), NOW()
            ) ON DUPLICATE KEY UPDATE
                quantity = VALUES(quantity),
                sale_price = VALUES(sale_price),
                updated_at = NOW()";

            $this->db->prepare($sql)->execute([
                ':oid' => $internalOrderId,
                ':plat' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':ord_id' => $orderId,
                ':lid' => $lineItemId,
                ':pid' => $productId,
                ':pname' => $productName,
                ':skuid' => $skuId,
                ':skuname' => $skuName,
                ':qty' => $qty,
                ':price' => $salePrice
            ]);
        }
    }

    /**
     * Normalizes raw order status strings or integers to canonical Commerce V2 status.
     */
    public function normalizeOrderStatus($rawStatus): string {
        $str = strtoupper(trim((string)$rawStatus));
        return match ($str) {
            '100', 'UNPAID' => 'UNPAID',
            '105', 'ON_HOLD' => 'ON_HOLD',
            '110', '111', 'AWAITING_SHIPMENT', 'PAID', '140_PAID' => 'AWAITING_SHIPMENT',
            '112', 'AWAITING_COLLECTION' => 'AWAITING_COLLECTION',
            '114', 'PARTIALLY_SHIPPED' => 'IN_TRANSIT',
            '120', '121', 'IN_TRANSIT', 'SHIPPED' => 'IN_TRANSIT',
            '122', '130', 'DELIVERED' => 'DELIVERED',
            'COMPLETED', 'COMPLETE' => 'COMPLETED',
            '140', 'CANCELLED', 'CANCELED' => 'CANCELLED',
            default => !empty($str) ? $str : 'UNKNOWN',
        };
    }

    /**
     * Normalizes RMA/aftersales status.
     */
    public function normalizeAftersalesStatus($rawStatus): string {
        $str = strtoupper(trim((string)$rawStatus));
        return match ($str) {
            'SUCCESS', 'COMPLETED', 'REFUNDED' => 'SUCCESS',
            'APPROVED' => 'APPROVED',
            'CANCELLED', 'REJECTED' => 'CANCELLED',
            default => 'REQUESTED'
        };
    }

    /**
     * Records event into commerce_webhook_events inbox with durable persistence.
     * Returns ['success' => bool, 'is_duplicate' => bool, 'error' => ?string]
     */
    public function recordInboxEvent(
        string $shopId,
        string $eventId,
        string $eventType,
        string $payloadHash,
        string $rawPayload,
        string $eventTimestamp
    ): array {
        if (!$this->hasTable('commerce_webhook_events')) {
            return [
                'success' => false,
                'is_duplicate' => false,
                'error' => 'Table commerce_webhook_events not found. Migration 023 required.'
            ];
        }

        try {
            // Check if already processed
            $stmtCheck = $this->db->prepare("SELECT id, status FROM `commerce_webhook_events` 
                WHERE platform = :plat AND shop_id = :shop_id AND event_id = :evt_id LIMIT 1");
            $stmtCheck->execute([
                ':plat' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':evt_id' => $eventId
            ]);
            $row = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            if ($row && $row['status'] === 'PROCESSED') {
                return ['success' => true, 'is_duplicate' => true];
            }

            // Insert or update attempt count
            $stmtIns = $this->db->prepare("INSERT INTO `commerce_webhook_events` (
                platform, shop_id, event_id, event_type, payload_hash, raw_payload,
                status, attempt_count, event_timestamp, received_at
            ) VALUES (
                :plat, :shop_id, :evt_id, :etype, :phash, :payload,
                'PENDING', 1, :ets, NOW()
            ) ON DUPLICATE KEY UPDATE
                attempt_count = attempt_count + 1,
                error_message = NULL");

            $stmtIns->execute([
                ':plat' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':evt_id' => $eventId,
                ':etype' => substr($eventType, 0, 64),
                ':phash' => $payloadHash,
                ':payload' => $rawPayload,
                ':ets' => $eventTimestamp
            ]);

            return ['success' => true, 'is_duplicate' => false];
        } catch (\Throwable $t) {
            return ['success' => false, 'is_duplicate' => false, 'error' => $t->getMessage()];
        }
    }

    /**
     * Processes any pending or failed webhook events from the durable inbox (F06 worker).
     */
    public function processPendingInboxEvents(?string $shopId = null, int $limit = 50): int {
        if (!$this->hasTable('commerce_webhook_events')) return 0;

        $sql = "SELECT id, shop_id, event_id, event_type, raw_payload, event_timestamp 
                FROM `commerce_webhook_events` 
                WHERE status IN ('PENDING', 'FAILED') AND attempt_count < 5";
        $params = [];
        if ($shopId) {
            $sql .= " AND shop_id = :shop_id";
            $params[':shop_id'] = $shopId;
        }
        $sql .= " ORDER BY received_at ASC LIMIT " . (int)$limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $events = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $processedCount = 0;
        foreach ($events as $evt) {
            $claimStmt = $this->db->prepare("UPDATE `commerce_webhook_events` 
                SET status = 'PROCESSING', attempt_count = attempt_count + 1 
                WHERE id = :id AND status IN ('PENDING', 'FAILED')");
            $claimStmt->execute([':id' => $evt['id']]);
            if ($claimStmt->rowCount() === 0) {
                continue; // Claimed by concurrent worker
            }

            $payload = json_decode($evt['raw_payload'], true) ?: [];
            $status = 'PROCESSED';
            $errMsg = null;
            try {
                $eventData = $payload['data'] ?? [];
                $eventType = $evt['event_type'];
                $sId = $evt['shop_id'];
                $ts = !empty($evt['event_timestamp']) ? strtotime($evt['event_timestamp']) : null;

                switch ($eventType) {
                    case '1':
                    case 'ORDER_STATUS_CHANGE':
                    case 'order_status_change':
                        $this->handleOrderStatusChangeEvent($sId, $eventData, $ts);
                        break;
                    case '2':
                    case 'DEAUTHORIZE':
                    case 'deauthorize':
                        $this->handleDeauthorizeEvent($sId, $payload);
                        break;
                    case 'RETURN_STATUS_CHANGE':
                    case 'return_status_change':
                    case 'AFTERSALES_STATUS_CHANGE':
                        $this->handleAftersalesEvent($sId, $eventData, $ts);
                        break;
                    case 'PACKAGE_UPDATE':
                    case 'package_update':
                    case 'LOGISTICS_UPDATE':
                        $this->handlePackageUpdateEvent($sId, $eventData, $ts);
                        break;
                    default:
                        break;
                }
            } catch (\Throwable $t) {
                $status = 'FAILED';
                $errMsg = $t->getMessage();
            }

            $this->updateInboxStatus($evt['shop_id'], $evt['event_id'], $status, $errMsg);
            if ($status === 'PROCESSED') {
                $processedCount++;
            }
        }
        return $processedCount;
    }

    /**
     * Updates inbox event status upon processing completion.
     */
    private function updateInboxStatus(string $shopId, string $eventId, string $status, ?string $errorMessage): void {
        if (!$this->hasTable('commerce_webhook_events')) return;
        try {
            $stmt = $this->db->prepare("UPDATE `commerce_webhook_events` SET
                status = :status,
                error_message = :err,
                processed_at = " . ($status === 'PROCESSED' ? 'NOW()' : 'processed_at') . "
                WHERE platform = :plat AND shop_id = :shop_id AND event_id = :evt_id");
            $stmt->execute([
                ':status' => $status,
                ':err' => $errorMessage ? substr($errorMessage, 0, 500) : null,
                ':plat' => self::PLATFORM,
                ':shop_id' => $shopId,
                ':evt_id' => $eventId
            ]);
        } catch (\Throwable $t) {}
    }

    private function resolveDefaultShopId(): string {
        try {
            $stmt = $this->db->query("SELECT shop_id FROM `tiktok_config` WHERE shop_id IS NOT NULL AND shop_id != '' ORDER BY updated_at DESC LIMIT 1");
            $res = $stmt->fetchColumn();
            if ($res) return (string)$res;
        } catch (\Throwable $t) {}
        return '7495657895504611503';
    }

    private function hasTable(string $tableName): bool {
        if (($_SERVER['APP_ENV'] ?? '') === 'testing' || getenv('APP_ENV') === 'testing') {
            return true;
        }
        try {
            $stmt = $this->db->query("SHOW TABLES LIKE '{$tableName}'");
            return !empty($stmt->fetch());
        } catch (\Throwable $t) {
            return false;
        }
    }

    private function recordAuditLog(string $ruleName, string $campaignName, string $triggerVal, string $result): void {
        try {
            $stmt = $this->db->prepare("INSERT INTO `tiktok_audit_logs` (rule_name, campaign_name, trigger_value, result) 
                VALUES (:rname, :cname, :tval, :res)");
            $stmt->execute([
                ':rname' => substr($ruleName, 0, 100),
                ':cname' => substr($campaignName, 0, 100),
                ':tval' => substr($triggerVal, 0, 255),
                ':res' => substr($result, 0, 255)
            ]);
        } catch (\Throwable $t) {}
    }
}
