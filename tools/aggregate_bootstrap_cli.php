<?php
/**
 * ADDP COMMERCE INTELLIGENCE - DAILY AGGREGATE BOOTSTRAP & BACKFILL CLI
 * 
 * Component: Sprint V2-06 Safe Bounded Aggregate Bootstrap
 * File: tools/aggregate_bootstrap_cli.php
 * 
 * Features:
 * - Date-bounded, resumable, and 100% idempotent
 * - Reads strictly from authoritative normalized MariaDB tables (commerce_orders, commerce_loss_ledger, etc.)
 * - Zero TikTok API calls required
 * - Progress audit output with line-by-line metrics
 * 
 * Usage:
 *   php tools/aggregate_bootstrap_cli.php --shop-id=7495657895504611503 --start-date=2026-09-01 --end-date=2026-09-30
 *   php tools/aggregate_bootstrap_cli.php --shop-id=7495657895504611503 --date=2026-10-07
 *   php tools/aggregate_bootstrap_cli.php --shop-id=7495657895504611503 --drain-queue
 */

if (php_sapi_name() !== 'cli' && empty($_SERVER['SHELL']) && empty($_SERVER['TERM'])) {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only']);
    exit(1);
}

set_time_limit(0);
ini_set('memory_limit', '512M');

require_once __DIR__ . '/../public/api/config.php';
require_once __DIR__ . '/../public/api/db.php';
require_once __DIR__ . '/../public/api/commerce_daily_aggregate_service.php';

$options = getopt('', [
    'shop-id:',
    'start-date:',
    'end-date:',
    'date:',
    'drain-queue',
    'limit:',
    'help'
]);

if (isset($options['help']) || (empty($options['shop-id']) && !isset($options['drain-queue']))) {
    echo "====================================================================\n";
    echo "  ADDP COMMERCE INTELLIGENCE - AGGREGATE BOOTSTRAP CLI (V2-06)\n";
    echo "====================================================================\n";
    echo "Usage:\n";
    echo "  php tools/aggregate_bootstrap_cli.php --shop-id=<shopId> --start-date=YYYY-MM-DD --end-date=YYYY-MM-DD\n";
    echo "  php tools/aggregate_bootstrap_cli.php --shop-id=<shopId> --date=YYYY-MM-DD\n";
    echo "  php tools/aggregate_bootstrap_cli.php --shop-id=<shopId> --drain-queue [--limit=50]\n";
    exit(0);
}

$db = getDBConnection();
$service = new CommerceDailyAggregateService($db);

$shopId = trim((string)($options['shop-id'] ?? ''));

// Mode 1: Drain Queue
if (isset($options['drain-queue'])) {
    $limit = isset($options['limit']) ? max(1, (int)$options['limit']) : 50;
    echo "Draining aggregate rebuild queue (limit: {$limit})...\n";
    $processed = $service->drainQueue($limit);
    echo "Queue drained: {$processed} dates successfully rebuilt.\n";
    exit(0);
}

// Mode 2: Single Date
if (!empty($options['date'])) {
    $date = trim($options['date']);
    echo "Rebuilding aggregate for {$shopId} on date {$date}...\n";
    $res = $service->rebuildDailyAggregate($shopId, $date);
    if (!empty($res['success'])) {
        echo sprintf(
            "[%s] Orders: %d | Gross: %s | Loss: %s | Realized: %s | Ads Spend: %s - OK\n",
            $date,
            $res['order_count'] ?? 0,
            number_format($res['order_gross_value'] ?? 0),
            number_format($res['total_loss_value'] ?? 0),
            number_format($res['realized_order_value'] ?? 0),
            number_format($res['ads_spend'] ?? 0)
        );
    } else {
        echo "Error rebuilding {$date}: " . ($res['message'] ?? 'Unknown error') . "\n";
    }
    exit(0);
}

// Mode 3: Date Range
$startDate = trim($options['start-date'] ?? '');
$endDate = trim($options['end-date'] ?? '');

if (empty($startDate) || empty($endDate)) {
    fwrite(STDERR, "Error: Both --start-date and --end-date are required for range backfill.\n");
    exit(1);
}

$startTs = strtotime($startDate);
$endTs = strtotime($endDate);

if (!$startTs || !$endTs || $startTs > $endTs) {
    fwrite(STDERR, "Error: Invalid date range {$startDate} -> {$endDate}.\n");
    exit(1);
}

echo "====================================================================\n";
echo "  STARTING BOUNDED AGGREGATE BOOTSTRAP\n";
echo "  Shop ID:    {$shopId}\n";
echo "  Date Range: {$startDate} -> {$endDate}\n";
echo "====================================================================\n\n";

$currTs = $startTs;
$totalDays = 0;
$totalOrders = 0;
$totalGross = 0.0;
$totalLoss = 0.0;
$totalRealized = 0.0;

while ($currTs <= $endTs) {
    $date = date('Y-m-d', $currTs);
    $res = $service->rebuildDailyAggregate($shopId, $date);
    if (!empty($res['success'])) {
        $cnt = (int)($res['order_count'] ?? 0);
        $gross = (float)($res['order_gross_value'] ?? 0.0);
        $loss = (float)($res['total_loss_value'] ?? 0.0);
        $realized = (float)($res['realized_order_value'] ?? 0.0);

        $totalOrders += $cnt;
        $totalGross += $gross;
        $totalLoss += $loss;
        $totalRealized += $realized;
        $totalDays++;

        echo sprintf(
            "  [%s] Orders: %4d | Gross: %12s ₫ | Loss: %10s ₫ | Realized: %12s ₫ - OK\n",
            $date,
            $cnt,
            number_format($gross),
            number_format($loss),
            number_format($realized)
        );
    } else {
        echo "  [{$date}] FAILED: " . ($res['message'] ?? 'Error') . "\n";
    }
    $currTs += 86400;
}

echo "\n====================================================================\n";
echo "  BOOTSTRAP COMPLETED\n";
echo "  Total Days Rebuilt:  {$totalDays}\n";
echo "  Total Orders Cohort: " . number_format($totalOrders) . "\n";
echo "  Total Gross Value:   " . number_format($totalGross) . " ₫\n";
echo "  Total Economic Loss: " . number_format($totalLoss) . " ₫\n";
echo "  Matured Realized:    " . number_format($totalRealized) . " ₫\n";
echo "====================================================================\n";
