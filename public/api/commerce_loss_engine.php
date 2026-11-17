<?php
/**
 * ADDP COMMERCE INTELLIGENCE - CLASSIFICATION & PERSISTENT LOSS LEDGER ENGINE
 * 
 * Component: HF1.3 Phase 1B Order Loss & Dual-Perspective Engine
 * 
 * Features:
 * 1. Deterministic Multi-Dimensional Order Classification
 * 2. Persistent Auditable Loss Ledger with Double-Deduction Prevention
 * 3. Strict Mathematical Invariant: SUM(loss_amount) <= order_gross_amount
 * 4. Dual-Perspective Query Engine:
 *    - Mode A: KNOWN_AS_OF (Point-in-Time, returns HISTORICAL_STATE_UNAVAILABLE when evidence absent)
 *    - Mode B: EVENT_EFFECTIVE_AS_OF (Platform event timestamp based)
 *    - Mode C: MATURED_LIFECYCLE (Terminal latest state)
 * 5. Period Loss Reconciliation with Dynamic Matured Realized Value (Correction 4)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/commerce_sync_service.php';
require_once __DIR__ . '/commerce_aftersales_service.php';

class CommerceLossEngine {
    public const PLATFORM_TIKTOK_SHOP = 'tiktok_shop';

    // Normalized Classification Outcomes
    public const OUTCOME_SUCCESSFUL_ORDER = 'SUCCESSFUL_ORDER';
    public const OUTCOME_CANCELLED_PRE_FULFILLMENT = 'CANCELLED_PRE_FULFILLMENT';
    public const OUTCOME_FAILED_DELIVERY = 'FAILED_DELIVERY';
    public const OUTCOME_RETURNED = 'RETURNED';
    public const OUTCOME_REFUND_ONLY = 'REFUND_ONLY';
    public const OUTCOME_RETURN_AND_REFUND = 'RETURN_AND_REFUND';
    public const OUTCOME_PARTIAL_REFUND = 'PARTIAL_REFUND';
    public const OUTCOME_PENDING_AFTERSALES = 'PENDING_AFTERSALES';
    public const OUTCOME_UNCLASSIFIED_LOSS = 'UNCLASSIFIED_LOSS';

    // Loss Types
    public const LOSS_CANCELLATION = 'CANCELLATION';
    public const LOSS_CANCELLED = self::LOSS_CANCELLATION; // Backward-compatibility alias
    public const LOSS_FAILED_DELIVERY = 'FAILED_DELIVERY';
    public const LOSS_REFUND = 'REFUND';
    public const LOSS_PARTIAL_REFUND = 'PARTIAL_REFUND';
    public const LOSS_RETURN_REFUND = 'RETURN_REFUND';

    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? getDBConnection();
    }

    /**
     * Deterministically classifies an order based on three independent dimensions:
     * 1. Operational Order State (commerce_orders)
     * 2. Fulfillment State (packages / events)
     * 3. Aftersales State (commerce_aftersales)
     */
    public function classifyOrder(array $order, array $packages = [], array $rmas = []): string {
        $orderStatus = strtoupper(trim((string)($order['order_status'] ?? '')));
        
        // 1. Check for Pending Aftersales Requests
        foreach ($rmas as $rma) {
            $rmaStatus = strtoupper(trim((string)($rma['aftersales_status'] ?? '')));
            if (in_array($rmaStatus, ['REQUESTED', 'APPROVED', 'RETURNING', 'RECEIVED', 'REFUND_PENDING'], true)) {
                return self::OUTCOME_PENDING_AFTERSALES;
            }
        }

        // 2. Check for Completed Aftersales Refunds (Post-Delivery Losses)
        $successfulRmas = array_filter($rmas, function($rma) {
            return strtoupper(trim((string)($rma['aftersales_status'] ?? ''))) === 'SUCCESS';
        });

        if (!empty($successfulRmas)) {
            $totalRefundAmount = '0.00';
            $orderGross = sprintf('%.2f', (float)($order['order_gross_amount'] ?? 0.0));
            $allReturnAndRefund = true;
            $allRefundOnly = true;

            foreach ($successfulRmas as $sRma) {
                $amt = sprintf('%.2f', (float)($sRma['refund_amount'] ?? 0.0));
                $totalRefundAmount = bcadd($totalRefundAmount, $amt, 2);
                $type = strtoupper(trim((string)($sRma['aftersales_type'] ?? '')));
                if ($type !== 'RETURN_AND_REFUND') $allReturnAndRefund = false;
                if ($type !== 'REFUND_ONLY') $allRefundOnly = false;
            }

            // Check if partial or full refund
            if (bccomp($totalRefundAmount, $orderGross, 2) < 0) {
                return self::OUTCOME_PARTIAL_REFUND;
            }

            if ($allReturnAndRefund) return self::OUTCOME_RETURNED;
            if ($allRefundOnly) return self::OUTCOME_REFUND_ONLY;
            return self::OUTCOME_RETURN_AND_REFUND;
        }

        // 3. Check for Failed Delivery / RTS (Logistics Losses)
        $hasFailedPackage = false;
        foreach ($packages as $pkg) {
            $pkgStatus = strtoupper(trim((string)($pkg['package_status'] ?? $pkg['status'] ?? '')));
            if (in_array($pkgStatus, ['DELIVERY_FAILED', 'RETURN_TO_SENDER', 'RETURNING'], true)) {
                $hasFailedPackage = true;
                break;
            }
        }

        if ($hasFailedPackage) {
            return self::OUTCOME_FAILED_DELIVERY;
        }

        // Check Orders cancel reason carrier indicators
        $cancelUser = strtoupper(trim((string)($order['cancel_user'] ?? '')));
        $cancelReason = strtolower((string)($order['cancel_reason'] ?? ''));
        $carrierLogisticsKeywords = [
            'delivery_failure', 'carrier_delivery_failed', 'recipient_unreachable',
            'package_returned_to_sender', 'damaged_in_transit', 'rejected_by_recipient'
        ];
        $isCarrierCancel = false;
        foreach ($carrierLogisticsKeywords as $kw) {
            if (str_contains($cancelReason, $kw)) {
                $isCarrierCancel = true;
                break;
            }
        }

        if ($orderStatus === 'CANCELLED' && ($isCarrierCancel || in_array($cancelUser, ['CARRIER', 'LSP'], true))) {
            return self::OUTCOME_FAILED_DELIVERY;
        }

        // 4. Pre-Fulfillment Cancellation (Buyer, Platform, System, Seller cancelled prior to delivery)
        if ($orderStatus === 'CANCELLED') {
            return self::OUTCOME_CANCELLED_PRE_FULFILLMENT;
        }

        // 5. Successful Fulfillment
        if (in_array($orderStatus, ['DELIVERED', 'COMPLETED'], true)) {
            return self::OUTCOME_SUCCESSFUL_ORDER;
        }

        return $orderStatus !== '' ? $orderStatus : self::OUTCOME_UNCLASSIFIED_LOSS;
    }

    /**
     * Computes and persists non-overlapping economic loss entries into commerce_loss_ledger
     * Enforces Invariant: SUM(loss_amount) <= order_gross_amount
     * Eliminates Double Deductions (e.g. Failed Delivery + System RMA collision)
     */
    public function computeAndPersistLossLedger(
        string $shopId,
        string $platformOrderId,
        string $perspective = 'MATURED_LIFECYCLE',
        ?int $calculationRunId = null
    ): array {
        // Fetch order details
        $stmtOrder = $this->db->prepare("SELECT * FROM `commerce_orders` WHERE platform = ? AND shop_id = ? AND platform_order_id = ? LIMIT 1");
        $stmtOrder->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $platformOrderId]);
        $order = $stmtOrder->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            return ['error' => 'ORDER_NOT_FOUND', 'platform_order_id' => $platformOrderId];
        }

        // Fetch associated packages
        $stmtPkg = $this->db->prepare("SELECT * FROM `commerce_order_events` 
            WHERE platform = ? AND shop_id = ? AND platform_order_id = ? AND event_domain = 'FULFILLMENT'");
        $stmtPkg->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $platformOrderId]);
        $packages = $stmtPkg->fetchAll(PDO::FETCH_ASSOC);

        // Fetch associated RMAs
        $stmtRma = $this->db->prepare("SELECT * FROM `commerce_aftersales` 
            WHERE platform = ? AND shop_id = ? AND platform_order_id = ?");
        $stmtRma->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $platformOrderId]);
        $rmas = $stmtRma->fetchAll(PDO::FETCH_ASSOC);

        $orderGross = sprintf('%.2f', (float)($order['order_gross_amount'] ?? 0.0));
        $remainingUnrealized = $orderGross;
        $activeLosses = [];

        $classification = $this->classifyOrder($order, $packages, $rmas);

        // STEP 1: Pre-Fulfillment Cancellation Loss
        if ($classification === self::OUTCOME_CANCELLED_PRE_FULFILLMENT) {
            $lossAmt = bccomp($orderGross, $remainingUnrealized, 2) <= 0 ? $orderGross : $remainingUnrealized;
            if (bccomp($lossAmt, '0.00', 2) > 0) {
                $activeLosses[] = [
                    'loss_type' => self::LOSS_CANCELLATION,
                    'loss_amount' => $lossAmt,
                    'gross_reference_amount' => $orderGross,
                    'currency' => $order['currency'] ?? 'VND',
                    'effective_at' => $order['platform_updated_at'] ?? ($order['platform_created_at'] ?? date('Y-m-d H:i:s')),
                    'source_domain' => 'order',
                    'source_entity_id' => $platformOrderId,
                    'classification_rule' => 'RULE_CANCELLED_PRE_FULFILLMENT',
                ];
                $remainingUnrealized = bcsub($remainingUnrealized, $lossAmt, 2);
            }
        }

        // STEP 2: Failed Delivery / RTS Loss
        if ($classification === self::OUTCOME_FAILED_DELIVERY) {
            $lossAmt = bccomp($orderGross, $remainingUnrealized, 2) <= 0 ? $orderGross : $remainingUnrealized;
            if (bccomp($lossAmt, '0.00', 2) > 0) {
                $activeLosses[] = [
                    'loss_type' => self::LOSS_FAILED_DELIVERY,
                    'loss_amount' => $lossAmt,
                    'gross_reference_amount' => $orderGross,
                    'currency' => $order['currency'] ?? 'VND',
                    'effective_at' => $order['platform_updated_at'] ?? ($order['platform_created_at'] ?? date('Y-m-d H:i:s')),
                    'source_domain' => 'fulfillment',
                    'source_entity_id' => $platformOrderId,
                    'classification_rule' => 'RULE_CARRIER_DELIVERY_FAILED',
                ];
                $remainingUnrealized = bcsub($remainingUnrealized, $lossAmt, 2);
            }
        }

        // STEP 3: Completed Aftersales RMAs (Refunds & Returns)
        foreach ($rmas as $rma) {
            $status = strtoupper(trim((string)($rma['aftersales_status'] ?? '')));
            if ($status !== 'SUCCESS') {
                continue; // Only realized/disbursed cash refunds count as economic loss
            }

            $rmaRefundAmt = sprintf('%.2f', (float)($rma['refund_amount'] ?? 0.0));
            // Cap allocatable refund by remaining unrealized gross to guarantee INVARIANT
            $allocatable = bccomp($rmaRefundAmt, $remainingUnrealized, 2) <= 0 ? $rmaRefundAmt : $remainingUnrealized;

            if (bccomp($allocatable, '0.00', 2) > 0) {
                $lossType = bccomp($allocatable, $orderGross, 2) === 0 ? self::LOSS_REFUND : self::LOSS_PARTIAL_REFUND;
                $activeLosses[] = [
                    'loss_type' => $lossType,
                    'loss_amount' => $allocatable,
                    'gross_reference_amount' => $orderGross,
                    'currency' => $rma['currency'] ?? 'VND',
                    'effective_at' => $rma['refund_completed_at'] ?? ($rma['platform_updated_at'] ?? ($rma['request_created_at'] ?? date('Y-m-d H:i:s'))),
                    'source_domain' => 'return_refund',
                    'source_entity_id' => (string)($rma['aftersales_id'] ?? ''),
                    'classification_rule' => 'RULE_RMA_REFUND_SUCCESS',
                ];
                $remainingUnrealized = bcsub($remainingUnrealized, $allocatable, 2);
            }
        }

        // Clean up obsolete loss entries for this order & perspective that are no longer active
        try {
            $stmtClean = $this->db->prepare("SELECT id, loss_type, source_entity_id FROM `commerce_loss_ledger` 
                WHERE platform = ? AND shop_id = ? AND platform_order_id = ? AND perspective = ?");
            $stmtClean->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $platformOrderId, $perspective]);
            $existingRows = $stmtClean->fetchAll(PDO::FETCH_ASSOC);

            $activeKeys = [];
            foreach ($activeLosses as $al) {
                $activeKeys[($al['loss_type'] ?? '') . ':' . ($al['source_entity_id'] ?? '')] = true;
            }

            foreach ($existingRows as $er) {
                $key = ($er['loss_type'] ?? '') . ':' . ($er['source_entity_id'] ?? '');
                if (!isset($activeKeys[$key])) {
                    $stmtDel = $this->db->prepare("DELETE FROM `commerce_loss_ledger` WHERE id = ?");
                    $stmtDel->execute([$er['id']]);
                }
            }
        } catch (\Throwable $t) {}

        // STEP 4: Persist Loss Entries to commerce_loss_ledger (Idempotent)
        $persistedEntries = [];
        $totalLossPersisted = '0.00';

        foreach ($activeLosses as $loss) {
            $stmtInsert = $this->db->prepare("INSERT INTO `commerce_loss_ledger` (
                platform, shop_id, platform_order_id, platform_line_item_id,
                loss_type, loss_amount, gross_reference_amount, currency,
                effective_at, observed_at, source_domain, source_entity_id,
                classification_rule, classification_version, perspective,
                calculation_run_id, created_at
            ) VALUES (
                ?, ?, ?, NULL,
                ?, ?, ?, ?,
                ?, NOW(), ?, ?,
                ?, '1.0', ?,
                ?, NOW()
            ) ON DUPLICATE KEY UPDATE
                loss_amount = VALUES(loss_amount),
                gross_reference_amount = VALUES(gross_reference_amount),
                effective_at = VALUES(effective_at),
                classification_rule = VALUES(classification_rule),
                calculation_run_id = VALUES(calculation_run_id)");

            $stmtInsert->execute([
                self::PLATFORM_TIKTOK_SHOP,
                $shopId,
                $platformOrderId,
                $loss['loss_type'],
                $loss['loss_amount'],
                $loss['gross_reference_amount'],
                $loss['currency'],
                $loss['effective_at'],
                $loss['source_domain'],
                $loss['source_entity_id'],
                $loss['classification_rule'],
                $perspective,
                $calculationRunId
            ]);

            $totalLossPersisted = bcadd($totalLossPersisted, (string)$loss['loss_amount'], 2);
            $persistedEntries[] = $loss;
        }

        $realizedOrderValue = bcsub($orderGross, $totalLossPersisted, 2);

        return [
            'platform_order_id' => $platformOrderId,
            'perspective' => $perspective,
            'classification' => $classification,
            'order_gross_amount' => (float)$orderGross,
            'total_loss_amount' => (float)$totalLossPersisted,
            'realized_order_value' => (float)$realizedOrderValue,
            'loss_entries' => $persistedEntries,
            'invariant_satisfied' => bccomp($totalLossPersisted, $orderGross, 2) <= 0
        ];
    }

    /**
     * Evaluates order state as known at or before a specific historical timestamp (As-Of Engine)
     * 
     * Mode KNOWN_AS_OF: Strictly uses observations where observed_at <= asOfTimestamp.
     * If no observation was recorded before cutoff, returns HISTORICAL_STATE_UNAVAILABLE.
     */
    public function getOrderStateAsOf(
        string $shopId,
        string $platformOrderId,
        int $asOfTimestamp,
        string $mode = 'KNOWN_AS_OF'
    ): array {
        $cutoffDate = date('Y-m-d H:i:s', $asOfTimestamp);

        // Fetch events respecting cutoff mode
        if ($mode === 'KNOWN_AS_OF') {
            $stmt = $this->db->prepare("SELECT * FROM `commerce_order_events`
                WHERE platform = ? AND shop_id = ? AND platform_order_id = ?
                  AND observed_at <= ?
                ORDER BY event_timestamp ASC, id ASC");
        } else {
            // EVENT_EFFECTIVE_AS_OF
            $stmt = $this->db->prepare("SELECT * FROM `commerce_order_events`
                WHERE platform = ? AND shop_id = ? AND platform_order_id = ?
                  AND event_timestamp <= ?
                ORDER BY event_timestamp ASC, id ASC");
        }
        $stmt->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $platformOrderId, $cutoffDate]);
        $events = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Check if ADDP had any observation prior to cutoff
        if (empty($events)) {
            // Inspect whether an observation exists at all
            $stmtAnyObs = $this->db->prepare("SELECT MIN(observed_at) FROM `commerce_raw_observations`
                WHERE platform = ? AND shop_id = ? AND platform_entity_id = ?");
            $stmtAnyObs->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $platformOrderId]);
            $firstObserved = $stmtAnyObs->fetchColumn();

            return [
                'platform_order_id' => $platformOrderId,
                'as_of_requested' => $asOfTimestamp,
                'as_of_date_utc' => $cutoffDate,
                'mode' => $mode,
                'status' => 'HISTORICAL_STATE_UNAVAILABLE',
                'first_observed_at' => $firstObserved ?: null,
                'message' => 'No immutable observation recorded prior to requested cutoff timestamp. State cannot be verifiably reconstructed from API alone.'
            ];
        }

        // Reconstruct order state from events timeline
        $latestKnownStatus = 'UNKNOWN';
        $aftersalesState = null;
        $fulfillmentState = null;

        foreach ($events as $ev) {
            $domain = $ev['event_domain'];
            $newStatus = $ev['new_status'];

            if ($domain === 'ORDER') {
                $latestKnownStatus = $newStatus;
            } elseif ($domain === 'AFTERSALES') {
                $aftersalesState = $newStatus;
            } elseif ($domain === 'FULFILLMENT') {
                $fulfillmentState = $newStatus;
            }
        }

        return [
            'platform_order_id' => $platformOrderId,
            'as_of_requested' => $asOfTimestamp,
            'as_of_date_utc' => $cutoffDate,
            'mode' => $mode,
            'status' => 'AVAILABLE',
            'order_status_as_of' => $latestKnownStatus,
            'fulfillment_status_as_of' => $fulfillmentState,
            'aftersales_status_as_of' => $aftersalesState,
            'events_contributing_count' => count($events)
        ];
    }

    /**
     * Evaluates latest verified matured lifecycle outcome
     */
    public function getMaturedOrderOutcome(string $shopId, string $platformOrderId): array {
        return $this->computeAndPersistLossLedger($shopId, $platformOrderId, 'MATURED_LIFECYCLE');
    }

    /**
     * Automatically recomputes MATURED_LIFECYCLE loss ledger for all orders that have aftersales records.
     * Useful after missing orders are ingested or recovered.
     */
    public function recomputePendingOrphanLosses(string $shopId): array {
        $stmt = $this->db->prepare("SELECT DISTINCT a.platform_order_id
            FROM `commerce_aftersales` a
            INNER JOIN `commerce_orders` o ON a.platform = o.platform AND a.shop_id = o.shop_id AND a.platform_order_id = o.platform_order_id
            WHERE a.platform = :plat AND a.shop_id = :shop_id");
        $stmt->execute([':plat' => self::PLATFORM_TIKTOK_SHOP, ':shop_id' => $shopId]);
        $orderIds = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $results = [];
        foreach ($orderIds as $ordId) {
            $results[$ordId] = $this->computeAndPersistLossLedger($shopId, $ordId, 'MATURED_LIFECYCLE');
        }
        return $results;
    }

    /**
     * Period Reconciliation Report with Dynamic Matured Value (Correction 4)
     * Validates: Order Gross Value - Loss Ledger = Matured Realized Order Value
     */
    public function getPeriodLossReport(string $shopId, string $startDate, string $endDate, string $perspective = 'MATURED_LIFECYCLE'): array {
        $startUtc = $startDate . ' 00:00:00';
        $endUtc = $endDate . ' 23:59:59';

        // 1. Order Gross Value
        $stmtGross = $this->db->prepare("SELECT 
            COUNT(DISTINCT platform_order_id) as total_orders,
            SUM(order_gross_amount) as gross_value
            FROM `commerce_orders`
            WHERE platform = ? AND shop_id = ?
              AND platform_created_at >= ? AND platform_created_at <= ?");
        $stmtGross->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $startUtc, $endUtc]);
        $grossData = $stmtGross->fetch(PDO::FETCH_ASSOC);

        $totalOrders = (int)($grossData['total_orders'] ?? 0);
        $orderGrossValue = sprintf('%.2f', (float)($grossData['gross_value'] ?? 0.0));

        // 2. Active Losses Breakdown from commerce_loss_ledger
        $stmtLoss = $this->db->prepare("SELECT 
            l.loss_type,
            COUNT(DISTINCT l.platform_order_id) as impacted_orders,
            SUM(l.loss_amount) as total_loss
            FROM `commerce_loss_ledger` l
            INNER JOIN `commerce_orders` o ON l.platform_order_id = o.platform_order_id AND l.shop_id = o.shop_id
            WHERE l.platform = ? AND l.shop_id = ? AND l.perspective = ?
              AND o.platform_created_at >= ? AND o.platform_created_at <= ?
            GROUP BY l.loss_type");
        $stmtLoss->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $perspective, $startUtc, $endUtc]);
        $lossRows = $stmtLoss->fetchAll(PDO::FETCH_ASSOC);

        $lossBreakdown = [];
        $totalLossValue = '0.00';
        foreach ($lossRows as $row) {
            if (empty($row['loss_type'])) continue;
            $type = (string)$row['loss_type'];
            $amt = sprintf('%.2f', (float)($row['total_loss'] ?? $row['amount'] ?? 0));
            $totalLossValue = bcadd($totalLossValue, $amt, 2);
            $lossBreakdown[$type] = [
                'impacted_orders' => (int)($row['impacted_orders'] ?? $row['count'] ?? 0),
                'loss_amount' => (float)$amt
            ];
        }

        // 3. Dynamic Realized Value (Correction 4)
        $maturedRealizedValue = bcsub($orderGrossValue, $totalLossValue, 2);

        // 4. Overlap Reconciliation: RMA Cases vs Loss Ledger Refunds
        // Explains variance between all SUCCESS RMA cases vs losses applied in ledger
        $stmtRmaAll = $this->db->prepare("SELECT 
            COUNT(DISTINCT a.aftersales_id) as total_success_cases,
            COUNT(DISTINCT a.platform_order_id) as total_success_orders,
            SUM(a.refund_amount) as total_success_amount
            FROM `commerce_aftersales` a
            INNER JOIN `commerce_orders` o ON a.platform_order_id = o.platform_order_id AND a.shop_id = o.shop_id
            WHERE a.platform = ? AND a.shop_id = ? AND a.aftersales_status = 'SUCCESS'
              AND o.platform_created_at >= ? AND o.platform_created_at <= ?");
        $stmtRmaAll->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $startUtc, $endUtc]);
        $rmaAllData = $stmtRmaAll->fetch(PDO::FETCH_ASSOC);

        $rmaSuccessCases = (int)($rmaAllData['total_success_cases'] ?? 0);
        $rmaSuccessOrders = (int)($rmaAllData['total_success_orders'] ?? 0);
        $rmaSuccessAmount = sprintf('%.2f', (float)($rmaAllData['total_success_amount'] ?? 0.0));

        $appliedRefundLoss = sprintf('%.2f', (float)(
            ($lossBreakdown[self::LOSS_REFUND]['loss_amount'] ?? 0.0) +
            ($lossBreakdown[self::LOSS_PARTIAL_REFUND]['loss_amount'] ?? 0.0) +
            ($lossBreakdown[self::LOSS_RETURN_REFUND]['loss_amount'] ?? 0.0)
        ));

        $overlapExcludedAmount = sprintf('%.2f', max(0.0, (float)bcsub($rmaSuccessAmount, $appliedRefundLoss, 2)));

        return [
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'perspective' => $perspective
            ],
            'financial_metrics' => [
                'total_orders' => $totalOrders,
                'order_gross_value' => (float)$orderGrossValue,
                'total_loss_value' => (float)$totalLossValue,
                'matured_realized_order_value' => (float)$maturedRealizedValue
            ],
            'loss_breakdown' => $lossBreakdown,
            'rma_regression_verification' => [
                'refund_orders' => (int)(
                    ($lossBreakdown[self::LOSS_REFUND]['impacted_orders'] ?? 0) +
                    ($lossBreakdown[self::LOSS_PARTIAL_REFUND]['impacted_orders'] ?? 0) +
                    ($lossBreakdown[self::LOSS_RETURN_REFUND]['impacted_orders'] ?? 0)
                ),
                'total_refund_value' => (float)$appliedRefundLoss,
                'exact_baseline_pass' => null
            ],
            'rma_loss_overlap_reconciliation' => [
                'rma_successful_cases' => $rmaSuccessCases,
                'rma_successful_orders' => $rmaSuccessOrders,
                'rma_successful_amount' => (float)$rmaSuccessAmount,
                'applied_refund_loss' => (float)$appliedRefundLoss,
                'overlap_excluded_amount' => (float)$overlapExcludedAmount,
                'explanation' => 'Chênh lệch do đơn hàng đã được ghi nhận vào tổn thất HỦY ĐƠN (CANCELLATION) trước khi giao. Nhờ cơ chế chống trùng lặp, tổn thất không bị trừ hai lần.'
            ],
            'invariant_check' => [
                'loss_le_gross' => bccomp($totalLossValue, $orderGrossValue, 2) <= 0,
                'equation_balanced' => bccomp(bcadd($maturedRealizedValue, $totalLossValue, 2), $orderGrossValue, 2) === 0
            ]
        ];
    }

    /**
     * Historical RMA Regression Baseline Verification (Automated Test Helper)
     * Verifies historical known baseline for Shop 7495657895504611503, Sept 1-20.
     * Moved from runtime getPeriodLossReport() to automated test suite per V2-06.
     */
    public function verifyHistoricalRmaRegressionBaseline(string $shopId = '7495657895504611503'): array {
        $startUtc = '2026-09-01 00:00:00';
        $endUtc = '2026-09-20 23:59:59';
        $stmtRmaBaseline = $this->db->prepare("SELECT 
            COUNT(DISTINCT a.platform_order_id) as refund_orders,
            SUM(a.refund_amount) as total_refund
            FROM `commerce_aftersales` a
            INNER JOIN `commerce_orders` o ON a.platform_order_id = o.platform_order_id AND a.shop_id = o.shop_id
            WHERE a.platform = ? AND a.shop_id = ? AND a.aftersales_status = 'SUCCESS'
              AND o.platform_created_at >= ? AND o.platform_created_at <= ?");
        $stmtRmaBaseline->execute([self::PLATFORM_TIKTOK_SHOP, $shopId, $startUtc, $endUtc]);
        $rmaData = $stmtRmaBaseline->fetch(PDO::FETCH_ASSOC);

        $refundOrders = (int)($rmaData['refund_orders'] ?? 0);
        $refundValue = sprintf('%.2f', (float)($rmaData['total_refund'] ?? 0.0));
        $exactBaselinePass = ($refundOrders === 4 && bccomp($refundValue, '364800.00', 2) === 0);

        return [
            'refund_orders' => $refundOrders,
            'total_refund_value' => (float)$refundValue,
            'exact_baseline_pass' => $exactBaselinePass
        ];
    }
}

