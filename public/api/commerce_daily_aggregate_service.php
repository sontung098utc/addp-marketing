<?php
/**
 * ADDP COMMERCE INTELLIGENCE - DAILY AGGREGATE REPORTING SERVICE
 * 
 * Component: Sprint V2-06 DB-First Reporting & Daily Aggregate Cache Engine
 * 
 * Features:
 * 1. Versioned daily aggregate storage for Dashboard headline KPIs
 * 2. Matured lifecycle cohort tracking (events modify original platform_created_at date)
 * 3. Non-additive metric reconstruction (ROI = SUM(gross)/SUM(spend), AOV = SUM(gross)/SUM(orders))
 * 4. Idempotent date-bounded bootstrap, backfill & queue-based invalidation
 * 5. Domain-specific truthful freshness tracking (Orders, RMA, Loss, Ads, Finance, Analytics)
 * 6. Dual-driver compatibility (MySQL/MariaDB & SQLite)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/commerce_loss_engine.php';
require_once __DIR__ . '/commerce_aftersales_service.php';

class CommerceDailyAggregateService {
    public const PLATFORM_TIKTOK_SHOP = 'tiktok_shop';
    public const CALCULATION_VERSION = '2.0';

    public const STATUS_READY = 'READY';
    public const STATUS_DIRTY = 'DIRTY';
    public const STATUS_REBUILDING = 'REBUILDING';

    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? getDBConnection();
    }

    /**
     * Checks if a table exists in current database.
     * Uses information_schema.TABLES on MariaDB/MySQL (TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?)
     * to avoid PDO prepared statement syntax errors (error 1064 / SQLSTATE 42000).
     * Preserves sqlite_master inspection for SQLite.
     * Does NOT return false on unexpected SQL errors; logs safely without credential leakage and throws RuntimeException.
     */
    public function hasTable(string $tableName): bool {
        try {
            $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $stmt = $this->db->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
                $stmt->execute([$tableName]);
                return (bool)$stmt->fetchColumn();
            } else {
                $stmt = $this->db->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1");
                $stmt->execute([$tableName]);
                return (bool)$stmt->fetchColumn();
            }
        } catch (\Throwable $t) {
            $safeMsg = preg_replace('/(password|token|secret|key)=[^&;\s]+/i', '$1=REDACTED', $t->getMessage());
            error_log("[COMMERCE_DAILY_AGGREGATE_DIAGNOSTIC] hasTable('{$tableName}') SQL error: " . get_class($t) . " - " . $safeMsg);
            throw new \RuntimeException("Database table inspection failed for '{$tableName}': " . $safeMsg, (int)$t->getCode(), $t);
        }
    }

    /**
     * Checks if a column exists in a specific table.
     * Uses information_schema.COLUMNS on MariaDB/MySQL (TABLE_SCHEMA = DATABASE(), TABLE_NAME = ?, COLUMN_NAME = ?)
     * with prepared statement parameter binding.
     * Preserves PRAGMA table_info inspection for SQLite.
     * Does NOT return false on unexpected SQL errors; logs safely without credential leakage and throws RuntimeException.
     */
    public function hasColumn(string $tableName, string $columnName): bool {
        try {
            $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $stmt = $this->db->query("PRAGMA table_info(`{$tableName}`)");
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    if (strcasecmp($row['name'] ?? '', $columnName) === 0) {
                        return true;
                    }
                }
                return false;
            } else {
                $stmt = $this->db->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1");
                $stmt->execute([$tableName, $columnName]);
                return (bool)$stmt->fetchColumn();
            }
        } catch (\Throwable $t) {
            $safeMsg = preg_replace('/(password|token|secret|key)=[^&;\s]+/i', '$1=REDACTED', $t->getMessage());
            error_log("[COMMERCE_DAILY_AGGREGATE_DIAGNOSTIC] hasColumn('{$tableName}', '{$columnName}') SQL error: " . get_class($t) . " - " . $safeMsg);
            throw new \RuntimeException("Database column inspection failed for '{$tableName}.{$columnName}': " . $safeMsg, (int)$t->getCode(), $t);
        }
    }

    /**
     * Rebuilds and atomically upserts the daily aggregate for a specific calendar date.
     * Invariant: Realized Order Value = order_gross_value - total_loss_value
     * Historical events (RMA/Cancellations) attribute back to the original platform_created_at cohort date.
     */
    public function rebuildDailyAggregate(string $shopId, string $date, string $platform = self::PLATFORM_TIKTOK_SHOP): array {
        if (!$this->hasTable('commerce_daily_aggregates')) {
            return ['success' => false, 'error' => 'TABLE_NOT_FOUND'];
        }

        $startUtc = $date . ' 00:00:00';
        $endUtc = $date . ' 23:59:59';

        // 1. Authoritative Orders & Gross Cohort (orders created on this date)
        $stmtOrders = $this->db->prepare("SELECT 
            COUNT(DISTINCT platform_order_id) as order_count,
            SUM(order_gross_amount) as gross_value
            FROM `commerce_orders`
            WHERE platform = ? AND shop_id = ?
              AND platform_created_at >= ? AND platform_created_at <= ?");
        $stmtOrders->execute([$platform, $shopId, $startUtc, $endUtc]);
        $orderData = $stmtOrders->fetch(PDO::FETCH_ASSOC) ?: [];

        $orderCount = (int)($orderData['order_count'] ?? 0);
        $orderGrossValue = sprintf('%.2f', (float)($orderData['gross_value'] ?? 0.0));

        // 2. Matured Lifecycle Losses for orders created on this date
        $cancelledCount = 0;
        $cancellationLoss = '0.00';
        $refundCount = 0;
        $refundLoss = '0.00';
        $failedDeliveryCount = 0;
        $failedDeliveryLoss = '0.00';
        $totalLossValue = '0.00';

        if ($this->hasTable('commerce_loss_ledger')) {
            $stmtLoss = $this->db->prepare("SELECT 
                l.loss_type,
                COUNT(DISTINCT l.platform_order_id) as impacted_orders,
                SUM(l.loss_amount) as total_loss
                FROM `commerce_loss_ledger` l
                INNER JOIN `commerce_orders` o ON l.platform_order_id = o.platform_order_id AND l.shop_id = o.shop_id
                WHERE l.platform = ? AND l.shop_id = ? AND l.perspective = 'MATURED_LIFECYCLE'
                  AND o.platform_created_at >= ? AND o.platform_created_at <= ?
                GROUP BY l.loss_type");
            $stmtLoss->execute([$platform, $shopId, $startUtc, $endUtc]);
            $lossRows = $stmtLoss->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($lossRows as $row) {
                $type = strtoupper((string)$row['loss_type']);
                $amt = sprintf('%.2f', (float)($row['total_loss'] ?? 0.0));
                $cnt = (int)($row['impacted_orders'] ?? 0);

                if ($type === 'CANCELLATION' || $type === 'CANCELLED') {
                    $cancelledCount += $cnt;
                    $cancellationLoss = bcadd($cancellationLoss, $amt, 2);
                } elseif (in_array($type, ['REFUND', 'PARTIAL_REFUND', 'RETURN_REFUND'], true)) {
                    $refundCount += $cnt;
                    $refundLoss = bcadd($refundLoss, $amt, 2);
                } elseif ($type === 'FAILED_DELIVERY') {
                    $failedDeliveryCount += $cnt;
                    $failedDeliveryLoss = bcadd($failedDeliveryLoss, $amt, 2);
                }
                $totalLossValue = bcadd($totalLossValue, $amt, 2);
            }
        }

        // Invariant: Total loss cannot exceed order gross value
        if (bccomp($totalLossValue, $orderGrossValue, 2) > 0) {
            $totalLossValue = $orderGrossValue;
        }
        $realizedOrderValue = bcsub($orderGrossValue, $totalLossValue, 2);

        // 3. Advertising Spend & Attributed Revenue
        $adsSpend = '0.00';
        $adsAttributedGross = '0.00';
        $adsOrders = 0;
        $adsClicks = 0;
        $adsImpressions = 0;

        if ($this->hasTable('commerce_ads_campaign_daily')) {
            $hasSpendCol = $this->hasColumn('commerce_ads_campaign_daily', 'spend');
            $spendCol = $hasSpendCol ? 'spend' : 'cost';
            $revenueCol = $this->hasColumn('commerce_ads_campaign_daily', 'gross_revenue') ? 'gross_revenue' : 'attribution_gross_revenue';
            $ordersCol = $this->hasColumn('commerce_ads_campaign_daily', 'orders') ? 'orders' : 'attribution_orders';

            $stmtAds = $this->db->prepare("SELECT 
                SUM({$spendCol}) as total_spend,
                SUM({$revenueCol}) as total_attributed_revenue,
                SUM({$ordersCol}) as total_attributed_orders,
                SUM(clicks) as total_clicks,
                SUM(impressions) as total_impressions
                FROM `commerce_ads_campaign_daily`
                WHERE (platform = ? OR platform = 'tiktok_ads') AND shop_id = ? AND stat_date = ?");
            $stmtAds->execute([$platform, $shopId, $date]);
            $adsData = $stmtAds->fetch(PDO::FETCH_ASSOC) ?: [];

            $adsSpend = sprintf('%.2f', (float)($adsData['total_spend'] ?? 0.0));
            $adsAttributedGross = sprintf('%.2f', (float)($adsData['total_attributed_revenue'] ?? 0.0));
            $adsOrders = (int)($adsData['total_attributed_orders'] ?? 0);
            $adsClicks = (int)($adsData['total_clicks'] ?? 0);
            $adsImpressions = (int)($adsData['total_impressions'] ?? 0);
        }

        // 4. Finance Statements & Transactions
        $statementCount = 0;
        $totalSettledAmount = '0.00';
        $settledOrdersCount = 0;
        $platformCommission = '0.00';
        $affiliateCommission = '0.00';
        $paymentFee = '0.00';
        $shippingSubsidy = '0.00';
        $actualShipping = '0.00';
        $adjustments = '0.00';

        if ($this->hasTable('commerce_finance_statements')) {
            $stmtFinStmt = $this->db->prepare("SELECT 
                COUNT(DISTINCT statement_id) as statement_count,
                SUM(total_settlement_amount) as total_settled
                FROM `commerce_finance_statements`
                WHERE platform = ? AND shop_id = ?
                  AND statement_time >= ? AND statement_time <= ?");
            $stmtFinStmt->execute([$platform, $shopId, $startUtc, $endUtc]);
            $stmtFinData = $stmtFinStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $statementCount = (int)($stmtFinData['statement_count'] ?? 0);
            $totalSettledAmount = sprintf('%.2f', (float)($stmtFinData['total_settled'] ?? 0.0));
        }

        if ($this->hasTable('commerce_finance_transactions')) {
            $stmtFinTx = $this->db->prepare("SELECT 
                COUNT(DISTINCT platform_order_id) as settled_orders,
                SUM(platform_commission) as commission,
                SUM(affiliate_commission) as affiliate,
                SUM(payment_fee) as fee,
                SUM(shipping_fee_subsidy) as subsidy,
                SUM(actual_shipping_fee) as actual_ship,
                SUM(adjustment_amount) as adj
                FROM `commerce_finance_transactions`
                WHERE platform = ? AND shop_id = ?
                  AND transaction_time >= ? AND transaction_time <= ?");
            $stmtFinTx->execute([$platform, $shopId, $startUtc, $endUtc]);
            $finTxData = $stmtFinTx->fetch(PDO::FETCH_ASSOC) ?: [];

            $settledOrdersCount = (int)($finTxData['settled_orders'] ?? 0);
            $platformCommission = sprintf('%.2f', (float)($finTxData['commission'] ?? 0.0));
            $affiliateCommission = sprintf('%.2f', (float)($finTxData['affiliate'] ?? 0.0));
            $paymentFee = sprintf('%.2f', (float)($finTxData['fee'] ?? 0.0));
            $shippingSubsidy = sprintf('%.2f', (float)($finTxData['subsidy'] ?? 0.0));
            $actualShipping = sprintf('%.2f', (float)($finTxData['actual_ship'] ?? 0.0));
            $adjustments = sprintf('%.2f', (float)($finTxData['adj'] ?? 0.0));
        }

        // 5. Data Trust Freshness Statuses (Strict verification vs. NOT_SYNCED default)
        $ordersFreshness = 'NOT_SYNCED';
        $rmaFreshness = 'NOT_SYNCED';
        if ($this->hasTable('commerce_sync_runs')) {
            $hasStartEndDates = $this->hasColumn('commerce_sync_runs', 'start_date') && $this->hasColumn('commerce_sync_runs', 'end_date');
            $hasWindowTimes = $this->hasColumn('commerce_sync_runs', 'window_start_time') && $this->hasColumn('commerce_sync_runs', 'window_end_time');

            $dateClause = '';
            $dateParams = [];
            if ($hasStartEndDates && $hasWindowTimes) {
                $dateClause = "AND (
                      (start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= ? AND end_date >= ?)
                      OR (window_start_time IS NOT NULL AND window_end_time IS NOT NULL AND DATE(window_start_time) <= ? AND DATE(window_end_time) >= ?)
                  )";
                $dateParams = [$date, $date, $date, $date];
            } elseif ($hasStartEndDates) {
                $dateClause = "AND (start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= ? AND end_date >= ?)";
                $dateParams = [$date, $date];
            } elseif ($hasWindowTimes) {
                $dateClause = "AND (window_start_time IS NOT NULL AND window_end_time IS NOT NULL AND DATE(window_start_time) <= ? AND DATE(window_end_time) >= ?)";
                $dateParams = [$date, $date];
            }

            $stmtOrdRun = $this->db->prepare("SELECT * 
                FROM `commerce_sync_runs`
                WHERE platform = ? AND shop_id = ?
                  AND LOWER(source_domain) IN ('order', 'orders')
                  {$dateClause}
                ORDER BY id DESC LIMIT 1");
            $ordParams = array_merge([$platform, $shopId], $dateParams);
            $stmtOrdRun->execute($ordParams);
            $ordRun = $stmtOrdRun->fetch(PDO::FETCH_ASSOC);
            if ($ordRun) {
                $oStatus = strtoupper((string)$ordRun['status']);
                if ($oStatus === 'COMPLETED' || $oStatus === 'SUCCESS') {
                    $ordersFreshness = ($orderCount > 0) ? 'AVAILABLE' : 'NO_ORDERS_IN_PERIOD';
                } elseif ($oStatus === 'PARTIAL') {
                    $ordersFreshness = 'PARTIAL';
                } elseif ($oStatus === 'FAILED') {
                    $ordersFreshness = 'FAILED';
                }
            }

            $stmtRmaRun = $this->db->prepare("SELECT * 
                FROM `commerce_sync_runs`
                WHERE platform = ? AND shop_id = ?
                  AND (LOWER(source_domain) IN ('rma', 'return_refund', 'aftersales') OR api_endpoint LIKE '%return%')
                  {$dateClause}
                ORDER BY id DESC LIMIT 1");
            $rmaParams = array_merge([$platform, $shopId], $dateParams);
            $stmtRmaRun->execute($rmaParams);
            $rmaRun = $stmtRmaRun->fetch(PDO::FETCH_ASSOC);
            if ($rmaRun) {
                $rStatus = strtoupper((string)$rmaRun['status']);
                $errCode = (string)($rmaRun['error_code'] ?? '');
                if (($rStatus === 'COMPLETED' || $rStatus === 'SUCCESS') && $errCode !== 'RMA_PERIOD_MISMATCH') {
                    $rmaFreshness = 'AVAILABLE';
                } elseif ($rStatus === 'PARTIAL') {
                    $rmaFreshness = 'PARTIAL';
                } elseif ($rStatus === 'FAILED') {
                    $rmaFreshness = 'FAILED';
                }
            }
        }

        $adsFreshness = (bccomp($adsSpend, '0.00', 2) > 0 || $adsOrders > 0) ? 'AVAILABLE' : 'NOT_SYNCED';
        $financeFreshness = ($statementCount > 0 || $settledOrdersCount > 0) ? 'AVAILABLE' : 'NOT_SYNCED';

        // 6. Atomic Upsert
        $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
        $now = date('Y-m-d H:i:s');

        $params = [
            ':platform' => $platform,
            ':shop_id' => $shopId,
            ':metric_date' => $date,
            ':order_count' => $orderCount,
            ':order_gross_value' => $orderGrossValue,
            ':cancelled_orders_count' => $cancelledCount,
            ':cancellation_loss_amount' => $cancellationLoss,
            ':refund_orders_count' => $refundCount,
            ':refund_loss_amount' => $refundLoss,
            ':failed_delivery_orders_count' => $failedDeliveryCount,
            ':failed_delivery_loss_amount' => $failedDeliveryLoss,
            ':total_loss_value' => $totalLossValue,
            ':realized_order_value' => $realizedOrderValue,
            ':ads_spend' => $adsSpend,
            ':ads_attributed_gross' => $adsAttributedGross,
            ':ads_orders' => $adsOrders,
            ':ads_clicks' => $adsClicks,
            ':ads_impressions' => $adsImpressions,
            ':statement_count' => $statementCount,
            ':total_settled_amount' => $totalSettledAmount,
            ':settled_orders_count' => $settledOrdersCount,
            ':platform_commission' => $platformCommission,
            ':affiliate_commission' => $affiliateCommission,
            ':payment_fee' => $paymentFee,
            ':shipping_fee_subsidy' => $shippingSubsidy,
            ':actual_shipping_fee' => $actualShipping,
            ':adjustment_amount' => $adjustments,
            ':orders_freshness' => $ordersFreshness,
            ':rma_freshness' => $rmaFreshness,
            ':ads_freshness' => $adsFreshness,
            ':finance_freshness' => $financeFreshness,
            ':calc_version' => self::CALCULATION_VERSION,
            ':status' => self::STATUS_READY,
            ':calculated_at' => $now
        ];

        if ($driver === 'sqlite') {
            $sql = "INSERT INTO `commerce_daily_aggregates` (
                platform, shop_id, metric_date,
                order_count, order_gross_value,
                cancelled_orders_count, cancellation_loss_amount,
                refund_orders_count, refund_loss_amount,
                failed_delivery_orders_count, failed_delivery_loss_amount,
                total_loss_value, realized_order_value,
                ads_spend, ads_attributed_gross, ads_orders, ads_clicks, ads_impressions,
                statement_count, total_settled_amount, settled_orders_count,
                platform_commission, affiliate_commission, payment_fee,
                shipping_fee_subsidy, actual_shipping_fee, adjustment_amount,
                orders_freshness_status, rma_freshness_status, ads_freshness_status, finance_freshness_status,
                calculation_version, status, calculated_at, created_at, updated_at
            ) VALUES (
                :platform, :shop_id, :metric_date,
                :order_count, :order_gross_value,
                :cancelled_orders_count, :cancellation_loss_amount,
                :refund_orders_count, :refund_loss_amount,
                :failed_delivery_orders_count, :failed_delivery_loss_amount,
                :total_loss_value, :realized_order_value,
                :ads_spend, :ads_attributed_gross, :ads_orders, :ads_clicks, :ads_impressions,
                :statement_count, :total_settled_amount, :settled_orders_count,
                :platform_commission, :affiliate_commission, :payment_fee,
                :shipping_fee_subsidy, :actual_shipping_fee, :adjustment_amount,
                :orders_freshness, :rma_freshness, :ads_freshness, :finance_freshness,
                :calc_version, :status, :calculated_at, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) ON CONFLICT(platform, shop_id, metric_date) DO UPDATE SET
                order_count = excluded.order_count,
                order_gross_value = excluded.order_gross_value,
                cancelled_orders_count = excluded.cancelled_orders_count,
                cancellation_loss_amount = excluded.cancellation_loss_amount,
                refund_orders_count = excluded.refund_orders_count,
                refund_loss_amount = excluded.refund_loss_amount,
                failed_delivery_orders_count = excluded.failed_delivery_orders_count,
                failed_delivery_loss_amount = excluded.failed_delivery_loss_amount,
                total_loss_value = excluded.total_loss_value,
                realized_order_value = excluded.realized_order_value,
                ads_spend = excluded.ads_spend,
                ads_attributed_gross = excluded.ads_attributed_gross,
                ads_orders = excluded.ads_orders,
                ads_clicks = excluded.ads_clicks,
                ads_impressions = excluded.ads_impressions,
                statement_count = excluded.statement_count,
                total_settled_amount = excluded.total_settled_amount,
                settled_orders_count = excluded.settled_orders_count,
                platform_commission = excluded.platform_commission,
                affiliate_commission = excluded.affiliate_commission,
                payment_fee = excluded.payment_fee,
                shipping_fee_subsidy = excluded.shipping_fee_subsidy,
                actual_shipping_fee = excluded.actual_shipping_fee,
                adjustment_amount = excluded.adjustment_amount,
                orders_freshness_status = excluded.orders_freshness_status,
                rma_freshness_status = excluded.rma_freshness_status,
                ads_freshness_status = excluded.ads_freshness_status,
                finance_freshness_status = excluded.finance_freshness_status,
                calculation_version = excluded.calculation_version,
                status = excluded.status,
                calculated_at = excluded.calculated_at,
                updated_at = CURRENT_TIMESTAMP";
        } else {
            $sql = "INSERT INTO `commerce_daily_aggregates` (
                platform, shop_id, metric_date,
                order_count, order_gross_value,
                cancelled_orders_count, cancellation_loss_amount,
                refund_orders_count, refund_loss_amount,
                failed_delivery_orders_count, failed_delivery_loss_amount,
                total_loss_value, realized_order_value,
                ads_spend, ads_attributed_gross, ads_orders, ads_clicks, ads_impressions,
                statement_count, total_settled_amount, settled_orders_count,
                platform_commission, affiliate_commission, payment_fee,
                shipping_fee_subsidy, actual_shipping_fee, adjustment_amount,
                orders_freshness_status, rma_freshness_status, ads_freshness_status, finance_freshness_status,
                calculation_version, status, calculated_at, created_at, updated_at
            ) VALUES (
                :platform, :shop_id, :metric_date,
                :order_count, :order_gross_value,
                :cancelled_orders_count, :cancellation_loss_amount,
                :refund_orders_count, :refund_loss_amount,
                :failed_delivery_orders_count, :failed_delivery_loss_amount,
                :total_loss_value, :realized_order_value,
                :ads_spend, :ads_attributed_gross, :ads_orders, :ads_clicks, :ads_impressions,
                :statement_count, :total_settled_amount, :settled_orders_count,
                :platform_commission, :affiliate_commission, :payment_fee,
                :shipping_fee_subsidy, :actual_shipping_fee, :adjustment_amount,
                :orders_freshness, :rma_freshness, :ads_freshness, :finance_freshness,
                :calc_version, :status, :calculated_at, NOW(), NOW()
            ) ON DUPLICATE KEY UPDATE
                order_count = VALUES(order_count),
                order_gross_value = VALUES(order_gross_value),
                cancelled_orders_count = VALUES(cancelled_orders_count),
                cancellation_loss_amount = VALUES(cancellation_loss_amount),
                refund_orders_count = VALUES(refund_orders_count),
                refund_loss_amount = VALUES(refund_loss_amount),
                failed_delivery_orders_count = VALUES(failed_delivery_orders_count),
                failed_delivery_loss_amount = VALUES(failed_delivery_loss_amount),
                total_loss_value = VALUES(total_loss_value),
                realized_order_value = VALUES(realized_order_value),
                ads_spend = VALUES(ads_spend),
                ads_attributed_gross = VALUES(ads_attributed_gross),
                ads_orders = VALUES(ads_orders),
                ads_clicks = VALUES(ads_clicks),
                ads_impressions = VALUES(ads_impressions),
                statement_count = VALUES(statement_count),
                total_settled_amount = VALUES(total_settled_amount),
                settled_orders_count = VALUES(settled_orders_count),
                platform_commission = VALUES(platform_commission),
                affiliate_commission = VALUES(affiliate_commission),
                payment_fee = VALUES(payment_fee),
                shipping_fee_subsidy = VALUES(shipping_fee_subsidy),
                actual_shipping_fee = VALUES(actual_shipping_fee),
                adjustment_amount = VALUES(adjustment_amount),
                orders_freshness_status = VALUES(orders_freshness_status),
                rma_freshness_status = VALUES(rma_freshness_status),
                ads_freshness_status = VALUES(ads_freshness_status),
                finance_freshness_status = VALUES(finance_freshness_status),
                calculation_version = VALUES(calculation_version),
                status = VALUES(status),
                calculated_at = VALUES(calculated_at),
                updated_at = NOW()";
        }

        $stmtUpsert = $this->db->prepare($sql);
        $stmtUpsert->execute($params);

        return [
            'success' => true,
            'metric_date' => $date,
            'order_count' => $orderCount,
            'order_gross_value' => (float)$orderGrossValue,
            'total_loss_value' => (float)$totalLossValue,
            'realized_order_value' => (float)$realizedOrderValue,
            'ads_spend' => (float)$adsSpend,
            'ads_attributed_gross' => (float)$adsAttributedGross,
            'ads_orders' => $adsOrders
        ];
    }

    /**
     * Bounded batch rebuild for an entire date range.
     * Safe, resumable, and idempotent.
     */
    public function rebuildDateRange(string $shopId, string $startDate, string $endDate, string $platform = self::PLATFORM_TIKTOK_SHOP): array {
        $startTs = strtotime($startDate);
        $endTs = strtotime($endDate);

        if ($startTs > $endTs) {
            return ['success' => false, 'error' => 'INVALID_DATE_RANGE', 'message' => 'Start date must be <= end date'];
        }

        $processed = 0;
        $currTs = $startTs;
        $results = [];

        while ($currTs <= $endTs) {
            $currDate = date('Y-m-d', $currTs);
            $res = $this->rebuildDailyAggregate($shopId, $currDate, $platform);
            $results[$currDate] = $res;
            $processed++;
            $currTs += 86400;
        }

        return [
            'success' => true,
            'shop_id' => $shopId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'days_processed' => $processed,
            'results' => $results
        ];
    }

    /**
     * Identifies affected original platform_created_at dates from an array of order IDs,
     * and rebuilds daily aggregates for those exact cohort dates.
     */
    public function rebuildDatesForOrders(string $shopId, array $orderIds, string $platform = self::PLATFORM_TIKTOK_SHOP): array {
        if (empty($orderIds)) {
            return ['rebuilt_dates' => []];
        }

        $orderIds = array_values(array_unique(array_filter($orderIds)));
        if (empty($orderIds)) {
            return ['rebuilt_dates' => []];
        }

        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
        $sql = "SELECT DISTINCT DATE(platform_created_at) as cohort_date 
                FROM `commerce_orders` 
                WHERE platform = ? AND shop_id = ? 
                  AND platform_order_id IN ($placeholders)
                  AND platform_created_at IS NOT NULL";
        $params = array_merge([$platform, $shopId], $orderIds);
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $dates = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $rebuilt = [];
        foreach ($dates as $d) {
            if (!empty($d)) {
                $this->rebuildDailyAggregate($shopId, $d, $platform);
                $rebuilt[] = $d;
            }
        }

        return [
            'success' => true,
            'order_ids_count' => count($orderIds),
            'rebuilt_dates' => $rebuilt
        ];
    }

    /**
     * Enqueues dirty dates for asynchronous rebuild.
     */
    public function markOrderDatesDirty(string $shopId, array $orderIds, string $reason = 'LIFECYCLE_MUTATION', string $platform = self::PLATFORM_TIKTOK_SHOP): int {
        if (empty($orderIds) || !$this->hasTable('commerce_daily_aggregate_queue')) {
            return 0;
        }

        $orderIds = array_values(array_unique(array_filter($orderIds)));
        if (empty($orderIds)) return 0;

        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
        $sql = "SELECT DISTINCT DATE(platform_created_at) as cohort_date 
                FROM `commerce_orders` 
                WHERE platform = ? AND shop_id = ? 
                  AND platform_order_id IN ($placeholders)
                  AND platform_created_at IS NOT NULL";
        $params = array_merge([$platform, $shopId], $orderIds);
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $dates = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $enqueued = 0;
        foreach ($dates as $d) {
            if ($this->enqueueDate($shopId, $d, $reason, $platform)) {
                $enqueued++;
            }
        }
        return $enqueued;
    }

    /**
     * Enqueues a specific date into rebuild queue (concurrency-safe & idempotent).
     * Supports repeated events, resets completed/failed items, and sets dirty_while_processing
     * if an event arrives while a worker is actively processing.
     */
    public function enqueueDate(string $shopId, string $date, string $reason, string $platform = self::PLATFORM_TIKTOK_SHOP): bool {
        if (!$this->hasTable('commerce_daily_aggregate_queue')) {
            return false;
        }

        $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
        $cleanReason = substr($reason, 0, 64);
        $now = date('Y-m-d H:i:s');

        try {
            if ($driver === 'sqlite') {
                $sql = "INSERT INTO `commerce_daily_aggregate_queue` (
                    platform, shop_id, metric_date, reason, status, dirty_while_processing,
                    retry_count, max_retries, rebuild_requested_at, created_at, updated_at
                ) VALUES (
                    :platform, :shop_id, :metric_date, :reason, 'PENDING', 0,
                    0, 3, :now, :now, :now
                ) ON CONFLICT(platform, shop_id, metric_date) DO UPDATE SET
                    reason = excluded.reason,
                    dirty_while_processing = CASE WHEN status = 'PROCESSING' THEN 1 ELSE dirty_while_processing END,
                    status = CASE WHEN status = 'PROCESSING' THEN 'PROCESSING' ELSE 'PENDING' END,
                    retry_count = CASE WHEN status = 'PROCESSING' THEN retry_count ELSE 0 END,
                    error_message = CASE WHEN status = 'PROCESSING' THEN error_message ELSE NULL END,
                    rebuild_requested_at = excluded.rebuild_requested_at,
                    updated_at = excluded.updated_at";
            } else {
                $sql = "INSERT INTO `commerce_daily_aggregate_queue` (
                    platform, shop_id, metric_date, reason, status, dirty_while_processing,
                    retry_count, max_retries, rebuild_requested_at, created_at, updated_at
                ) VALUES (
                    :platform, :shop_id, :metric_date, :reason, 'PENDING', 0,
                    0, 3, :now, :now, :now
                ) ON DUPLICATE KEY UPDATE
                    reason = VALUES(reason),
                    dirty_while_processing = IF(status = 'PROCESSING', 1, dirty_while_processing),
                    status = IF(status = 'PROCESSING', 'PROCESSING', 'PENDING'),
                    retry_count = IF(status = 'PROCESSING', retry_count, 0),
                    error_message = IF(status = 'PROCESSING', error_message, NULL),
                    rebuild_requested_at = VALUES(rebuild_requested_at),
                    updated_at = VALUES(updated_at)";
            }

            $stmt = $this->db->prepare($sql);
            return $stmt->execute([
                ':platform' => $platform,
                ':shop_id' => $shopId,
                ':metric_date' => $date,
                ':reason' => $cleanReason,
                ':now' => $now
            ]);
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Drains pending entries from the aggregate queue.
     * Concurrency-safe: utilizes atomic claim (test-and-set) so concurrent workers cannot double-process.
     * Resets stuck processing items (> 300s).
     * Prevents lost updates: if dirty_while_processing = 1 when finished, re-queues as PENDING.
     * Implements safe retry policy before transitioning to FAILED.
     */
    public function drainQueue(int $limit = 50, ?string $workerId = null): int {
        if (!$this->hasTable('commerce_daily_aggregate_queue')) {
            return 0;
        }

        $now = date('Y-m-d H:i:s');
        $workerId = $workerId ?: 'w_' . bin2hex(random_bytes(6));
        $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);

        // 1. Recover stale stuck processing tasks (crashed workers / timeout > 300 seconds)
        try {
            if ($driver === 'sqlite') {
                $stuckSql = "UPDATE `commerce_daily_aggregate_queue`
                    SET status = 'PENDING', worker_id = NULL, updated_at = datetime('now')
                    WHERE status = 'PROCESSING' AND processing_started_at < datetime('now', '-300 seconds')";
            } else {
                $stuckSql = "UPDATE `commerce_daily_aggregate_queue`
                    SET status = 'PENDING', worker_id = NULL, updated_at = NOW()
                    WHERE status = 'PROCESSING' AND processing_started_at < (NOW() - INTERVAL 300 SECOND)";
            }
            $this->db->exec($stuckSql);
        } catch (\Throwable $t) {}

        // 2. Select candidates with status = PENDING
        $stmtCandidates = $this->db->prepare("SELECT id FROM `commerce_daily_aggregate_queue`
            WHERE status = 'PENDING'
            ORDER BY rebuild_requested_at ASC, id ASC
            LIMIT ?");
        $stmtCandidates->bindValue(1, $limit, PDO::PARAM_INT);
        $stmtCandidates->execute();
        $candidateIds = $stmtCandidates->fetchAll(PDO::FETCH_COLUMN) ?: [];

        if (empty($candidateIds)) {
            return 0;
        }

        // 3. Atomically claim each candidate
        $claimedItems = [];
        $claimStmt = $this->db->prepare("UPDATE `commerce_daily_aggregate_queue`
            SET status = 'PROCESSING',
                worker_id = :worker_id,
                processing_started_at = :now,
                dirty_while_processing = 0,
                updated_at = :now
            WHERE id = :id AND status = 'PENDING'");

        foreach ($candidateIds as $cid) {
            $claimStmt->execute([
                ':worker_id' => $workerId,
                ':now' => $now,
                ':id' => (int)$cid
            ]);
            if ($claimStmt->rowCount() > 0) {
                $itemStmt = $this->db->prepare("SELECT * FROM `commerce_daily_aggregate_queue` WHERE id = ?");
                $itemStmt->execute([(int)$cid]);
                $row = $itemStmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $claimedItems[] = $row;
                }
            }
        }

        $processed = 0;
        foreach ($claimedItems as $item) {
            $id = (int)$item['id'];
            $shopId = (string)$item['shop_id'];
            $date = (string)$item['metric_date'];
            $platform = (string)$item['platform'];

            try {
                $this->rebuildDailyAggregate($shopId, $date, $platform);

                // Check if late events arrived while we were processing (dirty_while_processing flag)
                $dirtyStmt = $this->db->prepare("SELECT dirty_while_processing FROM `commerce_daily_aggregate_queue` WHERE id = ?");
                $dirtyStmt->execute([$id]);
                $isDirty = (int)$dirtyStmt->fetchColumn() === 1;

                if ($isDirty) {
                    // Late RMA/order event arrived during processing: re-queue immediately as PENDING
                    $this->db->prepare("UPDATE `commerce_daily_aggregate_queue`
                        SET status = 'PENDING',
                            dirty_while_processing = 0,
                            worker_id = NULL,
                            last_processed_at = :now,
                            updated_at = :now
                        WHERE id = :id AND worker_id = :worker_id")->execute([
                            ':now' => date('Y-m-d H:i:s'),
                            ':id' => $id,
                            ':worker_id' => $workerId
                        ]);
                } else {
                    // Clean rebuild completed
                    $this->db->prepare("UPDATE `commerce_daily_aggregate_queue`
                        SET status = 'COMPLETED',
                            worker_id = NULL,
                            last_processed_at = :now,
                            error_message = NULL,
                            updated_at = :now
                        WHERE id = :id AND worker_id = :worker_id")->execute([
                            ':now' => date('Y-m-d H:i:s'),
                            ':id' => $id,
                            ':worker_id' => $workerId
                        ]);
                    $processed++;
                }
            } catch (\Throwable $t) {
                $currRetries = (int)($item['retry_count'] ?? 0) + 1;
                $maxRetries = (int)($item['max_retries'] ?? 3);
                $errMsg = substr($t->getMessage(), 0, 255);

                if ($currRetries >= $maxRetries) {
                    // Exceeded max retries: mark FAILED
                    $this->db->prepare("UPDATE `commerce_daily_aggregate_queue`
                        SET status = 'FAILED',
                            retry_count = :retries,
                            error_message = :err,
                            worker_id = NULL,
                            updated_at = :now
                        WHERE id = :id AND worker_id = :worker_id")->execute([
                            ':retries' => $currRetries,
                            ':err' => $errMsg,
                            ':now' => date('Y-m-d H:i:s'),
                            ':id' => $id,
                            ':worker_id' => $workerId
                        ]);
                } else {
                    // Retryable: return to PENDING
                    $this->db->prepare("UPDATE `commerce_daily_aggregate_queue`
                        SET status = 'PENDING',
                            retry_count = :retries,
                            error_message = :err,
                            worker_id = NULL,
                            updated_at = :now
                        WHERE id = :id AND worker_id = :worker_id")->execute([
                            ':retries' => $currRetries,
                            ':err' => $errMsg,
                            ':now' => date('Y-m-d H:i:s'),
                            ':id' => $id,
                            ':worker_id' => $workerId
                        ]);
                }
            }
        }

        return $processed;
    }

    /**
     * Inspects a specific queue item by date (helper for observability & test assertions).
     */
    public function getQueueItem(string $shopId, string $date, string $platform = self::PLATFORM_TIKTOK_SHOP): ?array {
        if (!$this->hasTable('commerce_daily_aggregate_queue')) {
            return null;
        }
        $stmt = $this->db->prepare("SELECT * FROM `commerce_daily_aggregate_queue`
            WHERE platform = ? AND shop_id = ? AND metric_date = ?");
        $stmt->execute([$platform, $shopId, $date]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /**
     * Checks if a requested date range is fully populated and READY in commerce_daily_aggregates.
     */
    public function isRangeFullyAggregated(string $shopId, string $startDate, string $endDate, string $platform = self::PLATFORM_TIKTOK_SHOP): bool {
        if (!$this->hasTable('commerce_daily_aggregates')) {
            return false;
        }

        $startTs = strtotime($startDate);
        $endTs = strtotime($endDate);
        $expectedDays = (int)round(($endTs - $startTs) / 86400) + 1;

        $stmt = $this->db->prepare("SELECT COUNT(*) as ready_days 
            FROM `commerce_daily_aggregates` 
            WHERE platform = ? AND shop_id = ? 
              AND metric_date >= ? AND metric_date <= ?
              AND status = 'READY'");
        $stmt->execute([$platform, $shopId, $startDate, $endDate]);
        $readyDays = (int)$stmt->fetchColumn();

        return ($readyDays >= $expectedDays);
    }

    /**
     * Reads aggregated report for period from commerce_daily_aggregates.
     * Reconstructs non-additive ratios (ROI, AOV, CVR) strictly from numerators and denominators.
     * Returns null if range is not yet aggregated.
     */
    public function getAggregateReport(string $shopId, string $startDate, string $endDate, string $platform = self::PLATFORM_TIKTOK_SHOP, bool $requireComplete = false): ?array {
        if (!$this->hasTable('commerce_daily_aggregates')) {
            return null;
        }

        $stmt = $this->db->prepare("SELECT * 
            FROM `commerce_daily_aggregates`
            WHERE platform = ? AND shop_id = ?
              AND metric_date >= ? AND metric_date <= ?
            ORDER BY metric_date ASC");
        $stmt->execute([$platform, $shopId, $startDate, $endDate]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) {
            return null;
        }

        $actualDays = count($rows);
        $startTs = strtotime($startDate);
        $endTs = strtotime($endDate);
        $expectedDays = ($startTs && $endTs && $endTs >= $startTs) ? (int)round(($endTs - $startTs) / 86400) + 1 : 0;
        $isComplete = ($expectedDays > 0 && $actualDays >= $expectedDays);

        if ($requireComplete && !$isComplete) {
            return null;
        }

        $ordersVerifiedDays = 0;
        $rmaVerifiedDays = 0;
        $allReady = true;
        foreach ($rows as $r) {
            if (($r['status'] ?? '') !== 'READY') {
                $allReady = false;
            }
            if (in_array($r['orders_freshness_status'] ?? '', ['AVAILABLE', 'NO_ORDERS_IN_PERIOD'], true)) {
                $ordersVerifiedDays++;
            }
            if (($r['rma_freshness_status'] ?? '') === 'AVAILABLE') {
                $rmaVerifiedDays++;
            }
        }

        if ($requireComplete && !$allReady) {
            return null;
        }

        $ordersCoverageStatus = ($expectedDays > 0 && $ordersVerifiedDays >= $expectedDays)
            ? 'AVAILABLE'
            : ($ordersVerifiedDays > 0 ? 'PARTIAL' : 'NOT_SYNCED');

        $rmaCoverageStatus = ($expectedDays > 0 && $rmaVerifiedDays >= $expectedDays)
            ? 'AVAILABLE'
            : ($rmaVerifiedDays > 0 ? 'PARTIAL' : 'NOT_SYNCED');

        $orderCount = 0;
        $orderGrossValue = '0.00';
        $cancelledCount = 0;
        $cancellationLoss = '0.00';
        $refundCount = 0;
        $refundLoss = '0.00';
        $failedDeliveryCount = 0;
        $failedDeliveryLoss = '0.00';
        $totalLossValue = '0.00';
        $realizedOrderValue = '0.00';

        $adsSpend = '0.00';
        $adsAttributedGross = '0.00';
        $adsOrders = 0;
        $adsClicks = 0;
        $adsImpressions = 0;

        $statementCount = 0;
        $totalSettledAmount = '0.00';
        $settledOrdersCount = 0;
        $platformCommission = '0.00';
        $affiliateCommission = '0.00';
        $paymentFee = '0.00';
        $shippingSubsidy = '0.00';
        $actualShipping = '0.00';
        $adjustments = '0.00';

        foreach ($rows as $r) {
            $orderCount += (int)$r['order_count'];
            $orderGrossValue = bcadd($orderGrossValue, sprintf('%.2f', (float)$r['order_gross_value']), 2);
            $cancelledCount += (int)$r['cancelled_orders_count'];
            $cancellationLoss = bcadd($cancellationLoss, sprintf('%.2f', (float)$r['cancellation_loss_amount']), 2);
            $refundCount += (int)$r['refund_orders_count'];
            $refundLoss = bcadd($refundLoss, sprintf('%.2f', (float)$r['refund_loss_amount']), 2);
            $failedDeliveryCount += (int)$r['failed_delivery_orders_count'];
            $failedDeliveryLoss = bcadd($failedDeliveryLoss, sprintf('%.2f', (float)$r['failed_delivery_loss_amount']), 2);
            $totalLossValue = bcadd($totalLossValue, sprintf('%.2f', (float)$r['total_loss_value']), 2);
            $realizedOrderValue = bcadd($realizedOrderValue, sprintf('%.2f', (float)$r['realized_order_value']), 2);

            $adsSpend = bcadd($adsSpend, sprintf('%.2f', (float)$r['ads_spend']), 2);
            $adsAttributedGross = bcadd($adsAttributedGross, sprintf('%.2f', (float)$r['ads_attributed_gross']), 2);
            $adsOrders += (int)$r['ads_orders'];
            $adsClicks += (int)$r['ads_clicks'];
            $adsImpressions += (int)$r['ads_impressions'];

            $statementCount += (int)$r['statement_count'];
            $totalSettledAmount = bcadd($totalSettledAmount, sprintf('%.2f', (float)$r['total_settled_amount']), 2);
            $settledOrdersCount += (int)$r['settled_orders_count'];
            $platformCommission = bcadd($platformCommission, sprintf('%.2f', (float)$r['platform_commission']), 2);
            $affiliateCommission = bcadd($affiliateCommission, sprintf('%.2f', (float)$r['affiliate_commission']), 2);
            $paymentFee = bcadd($paymentFee, sprintf('%.2f', (float)$r['payment_fee']), 2);
            $shippingSubsidy = bcadd($shippingSubsidy, sprintf('%.2f', (float)$r['shipping_fee_subsidy']), 2);
            $actualShipping = bcadd($actualShipping, sprintf('%.2f', (float)$r['actual_shipping_fee']), 2);
            $adjustments = bcadd($adjustments, sprintf('%.2f', (float)$r['adjustment_amount']), 2);
        }

        // Reconstruct Non-Additive Ratios
        $aov = ($orderCount > 0) ? round((float)$orderGrossValue / $orderCount, 2) : 0.0;
        $cancelRate = ($orderCount > 0) ? round(($cancelledCount / $orderCount) * 100, 1) : 0.0;
        $lossRate = ((float)$orderGrossValue > 0) ? round(((float)$totalLossValue / (float)$orderGrossValue) * 100, 2) : 0.0;
        $adsRoi = ((float)$adsSpend > 0) ? round((float)$adsAttributedGross / (float)$adsSpend, 2) : null;

        $orderGrossF = (float)$orderGrossValue;
        $totalLossF = (float)$totalLossValue;
        $realizedOrderF = (float)$realizedOrderValue;
        $adsSpendF = (float)$adsSpend;
        $adsAttributedGrossF = (float)$adsAttributedGross;

        // Sprint V2-06.2: Loss-Adjusted ROI & ROAS Framework
        // Rule 1: If denominator <= 0, return null (never fabricate zero ROI)
        // Rule 2: Calculated over total sums of entire period, not average of daily ROIs
        // Rule 3: Do not round intermediate terms before computing difference
        $blendedShopRoas = ($adsSpendF > 0) ? round($orderGrossF / $adsSpendF, 2) : null;
        $realizedAdsRoi = ($adsSpendF > 0) ? round($realizedOrderF / $adsSpendF, 2) : null;
        $roiErosionPoints = ($adsSpendF > 0) ? round($totalLossF / $adsSpendF, 2) : null;
        $spendToRealizedRate = ($adsSpendF > 0 && $realizedOrderF > 0) ? round(($adsSpendF / $realizedOrderF) * 100, 2) : null;

        $lossBreakdown = [
            CommerceLossEngine::LOSS_CANCELLATION => [
                'impacted_orders' => $cancelledCount,
                'loss_amount' => (float)$cancellationLoss
            ],
            CommerceLossEngine::LOSS_REFUND => [
                'impacted_orders' => $refundCount,
                'loss_amount' => (float)$refundLoss
            ],
            CommerceLossEngine::LOSS_FAILED_DELIVERY => [
                'impacted_orders' => $failedDeliveryCount,
                'loss_amount' => (float)$failedDeliveryLoss
            ]
        ];

        return [
            'source' => 'DAILY_AGGREGATES',
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'days_aggregated' => $actualDays,
                'expected_days' => $expectedDays,
                'is_complete' => $isComplete,
                'missing_days' => max(0, $expectedDays - $actualDays),
                'orders_coverage_status' => $ordersCoverageStatus,
                'rma_coverage_status' => $rmaCoverageStatus
            ],
            'financial_metrics' => [
                'total_orders' => $orderCount,
                'order_gross_value' => (float)$orderGrossValue,
                'total_loss_value' => (float)$totalLossValue,
                'matured_realized_order_value' => (float)$realizedOrderValue,
                'aov' => $aov,
                'cancel_rate_pct' => $cancelRate,
                'loss_rate_pct' => $lossRate,
                'orders_verified' => ($ordersCoverageStatus === 'AVAILABLE'),
                'rma_verified' => ($rmaCoverageStatus === 'AVAILABLE')
            ],
            'loss_breakdown' => $lossBreakdown,
            'advertising' => [
                'total_spend' => (float)$adsSpend,
                'total_attributed_revenue' => (float)$adsAttributedGross,
                'total_attributed_orders' => $adsOrders,
                'ads_roi' => $adsRoi,
                'clicks' => $adsClicks,
                'impressions' => $adsImpressions,
                'attributed_ads_roi' => $adsRoi,
                'blended_shop_roas' => $blendedShopRoas,
                'realized_ads_roi' => $realizedAdsRoi,
                'roi_erosion_points' => $roiErosionPoints,
                'spend_to_realized_rate_pct' => $spendToRealizedRate
            ],
            'loss_adjusted_roi' => [
                'attributed_ads_roi' => $adsRoi,
                'blended_shop_roas' => $blendedShopRoas,
                'realized_ads_roi' => $realizedAdsRoi,
                'roi_erosion_points' => $roiErosionPoints,
                'spend_to_realized_rate_pct' => $spendToRealizedRate,
                'is_trustworthy' => ($adsSpendF > 0 && $ordersCoverageStatus === 'AVAILABLE' && $rmaCoverageStatus === 'AVAILABLE')
            ],
            'finance' => [
                'statement_count' => $statementCount,
                'total_settled_amount' => (float)$totalSettledAmount,
                'settled_orders_count' => $settledOrdersCount,
                'platform_commission' => (float)$platformCommission,
                'affiliate_commission' => (float)$affiliateCommission,
                'payment_fee' => (float)$paymentFee,
                'shipping_fee_subsidy' => (float)$shippingSubsidy,
                'actual_shipping_fee' => (float)$actualShipping,
                'adjustment_amount' => (float)$adjustments
            ],
            'invariant_check' => [
                'loss_le_gross' => bccomp($totalLossValue, $orderGrossValue, 2) <= 0,
                'equation_balanced' => bccomp(bcadd($realizedOrderValue, $totalLossValue, 2), $orderGrossValue, 2) === 0
            ]
        ];
    }

    /**
     * Evaluates domain-specific truthful freshness.
     */
    public function getDomainFreshness(string $shopId, ?string $startDate = null, ?string $endDate = null): array {
        $now = time();
        $domains = ['orders', 'rma', 'loss', 'ads', 'finance', 'analytics'];
        $domainAliases = [
            'orders' => ['order', 'orders'],
            'rma' => ['rma', 'return_refund', 'aftersales'],
            'loss' => ['loss', 'loss_ledger'],
            'ads' => ['ads', 'ads_campaign', 'tiktok_ads'],
            'finance' => ['finance', 'finance_statement', 'finance_transaction'],
            'analytics' => ['analytics', 'compass', 'shop_analytics']
        ];

        $freshness = [];
        $activeJobDomains = [];

        // Check active jobs in commerce_sync_jobs
        if ($this->hasTable('commerce_sync_jobs')) {
            try {
                $stmtJob = $this->db->prepare("SELECT current_domain FROM `commerce_sync_jobs` 
                    WHERE shop_id = ? AND status IN ('QUEUED', 'RUNNING')");
                $stmtJob->execute([$shopId]);
                $activeJobDomains = $stmtJob->fetchAll(PDO::FETCH_COLUMN) ?: [];
            } catch (\Throwable $t) {}
        }

        // Query latest run per domain from commerce_sync_runs
        $runsByDomain = [];
        if ($this->hasTable('commerce_sync_runs')) {
            try {
                $stmtRuns = $this->db->prepare("SELECT 
                    LOWER(source_domain) as src_domain,
                    status,
                    MAX(created_at) as last_sync
                    FROM `commerce_sync_runs`
                    WHERE shop_id = ?
                    GROUP BY LOWER(source_domain), status");
                $stmtRuns->execute([$shopId]);
                $runs = $stmtRuns->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($runs as $r) {
                    $src = $r['src_domain'];
                    $runsByDomain[$src][] = $r;
                }
            } catch (\Throwable $t) {}
        }

        $labels = [
            'orders' => 'Đơn Hàng',
            'rma' => 'Trả Hàng / Hoàn Tiền',
            'loss' => 'Sổ Cái Hao Hụt',
            'ads' => 'Quảng Cáo',
            'finance' => 'Tài Chính',
            'analytics' => 'Phân Tích Sàn'
        ];

        foreach ($domains as $d) {
            $aliases = $domainAliases[$d];
            $isSyncing = false;
            foreach ($aliases as $a) {
                if (in_array($a, $activeJobDomains, true)) {
                    $isSyncing = true;
                    break;
                }
            }

            if ($isSyncing) {
                $freshness[$d] = [
                    'label' => $labels[$d],
                    'status' => 'SYNCING',
                    'last_synced_at' => null,
                    'message' => 'Đang đồng bộ dữ liệu...'
                ];
                continue;
            }

            // Find latest run for this domain
            $matchingRuns = [];
            foreach ($aliases as $a) {
                if (isset($runsByDomain[$a])) {
                    $matchingRuns = array_merge($matchingRuns, $runsByDomain[$a]);
                }
            }

            if (empty($matchingRuns)) {
                $freshness[$d] = [
                    'label' => $labels[$d],
                    'status' => 'NOT_SYNCED',
                    'last_synced_at' => null,
                    'message' => 'Chưa đồng bộ dữ liệu'
                ];
                continue;
            }

            // Sort by last_sync descending
            usort($matchingRuns, fn($a, $b) => strcmp($b['last_sync'] ?? '', $a['last_sync'] ?? ''));
            $latestRun = $matchingRuns[0];
            $lastSyncTime = $latestRun['last_sync'] ? strtotime($latestRun['last_sync']) : 0;
            $statusRaw = strtoupper((string)($latestRun['status'] ?? ''));

            $status = match ($statusRaw) {
                'COMPLETED', 'SUCCESS' => ($now - $lastSyncTime > 86400) ? 'STALE' : 'AVAILABLE',
                'PARTIAL' => 'PARTIAL',
                'FAILED' => 'FAILED',
                'RUNNING' => 'SYNCING',
                default => 'AVAILABLE'
            };

            $formattedTime = $lastSyncTime > 0 ? date('H:i d/m', $lastSyncTime) : 'N/A';
            $freshness[$d] = [
                'label' => $labels[$d],
                'status' => $status,
                'last_synced_at' => $latestRun['last_sync'],
                'message' => ($status === 'AVAILABLE') ? "Cập nhật lúc {$formattedTime}" : "Trạng thái: {$status}"
            ];
        }

        return $freshness;
    }
}
