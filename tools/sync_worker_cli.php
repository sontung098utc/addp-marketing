<?php
/**
 * ADDP COMMERCE INTELLIGENCE - ASYNCHRONOUS SYNC WORKER CLI
 * 
 * Component: Resumable Background Worker CLI for Asynchronous Sync Job Execution & Autonomous Cron
 * File: tools/sync_worker_cli.php
 * Target: Sprint V2-04.3 & P0-W3 Background Reconciliation Engine
 * 
 * Usage:
 *   php tools/sync_worker_cli.php --job-id=123
 *   php tools/sync_worker_cli.php --cron [--shop-id=7495657895504611503]
 *   php tools/sync_worker_cli.php --recover-stale [--shop-id=7495657895504611503]
 *   php tools/sync_worker_cli.php --shop-id=7495657895504611503 --start-date=2026-09-01 --end-date=2026-09-30
 */

// Allow script to run in CLI mode
if (php_sapi_name() !== 'cli' && empty($_SERVER['SHELL']) && empty($_SERVER['TERM'])) {
    http_response_code(403);
    echo json_encode(['error' => 'CLI only']);
    exit(1);
}

// Disable max execution time for background job runner
set_time_limit(0);
ini_set('memory_limit', '512M');

$options = getopt('', [
    'job-id:',
    'shop-id:',
    'start-date:',
    'end-date:',
    'recover-stale',
    'cron',
    'process-inbox',
    'drain-queue',
    'limit:',
    'max-steps:',
    'help'
]);

if (isset($options['help'])) {
    echo "====================================================================\n";
    echo "ADDP COMMERCE INTELLIGENCE - BACKGROUND SYNC WORKER CLI\n";
    echo "====================================================================\n";
    echo "Usage: php tools/sync_worker_cli.php [options]\n\n";
    echo "  --job-id=<id>               Execute specific sync job to completion\n";
    echo "  --cron                      Autonomous cron mode: reconciles recent 7 days, drains queue & inbox\n";
    echo "  --recover-stale             Recover stale/abandoned RUNNING jobs and runs\n";
    echo "  --process-inbox             Process pending/failed webhook events from durable inbox\n";
    echo "  --drain-queue               Drain dirty dates from commerce_daily_aggregate_queue\n";
    echo "  --shop-id=<shopId>          Shop ID scope (optional with --cron/--recover-stale)\n";
    echo "  --start-date=<YYYY-MM-DD>   Sync start date (default: 7 days ago for cron, 30 days for manual)\n";
    echo "  --end-date=<YYYY-MM-DD>     Sync end date (default: today)\n";
    echo "  --max-steps=<N>             Maximum orchestrator steps to execute (default: 25)\n";
    echo "  --help                      Display this help message\n";
    exit(0);
}

// Dynamic path resolution supporting both development repository and webroot staging (F03 fix)
$candidateDirs = [
    __DIR__ . '/../api',              // Standard production release: public_html/tools/ -> public_html/api/
    __DIR__ . '/../public/api',       // Local development repo: tools/ -> public/api/
    __DIR__ . '/api',                 // Alternative staging: tools/api/
    __DIR__ . '/public/api',          // Alternative staging: tools/public/api/
    __DIR__                           // cwd fallback
];

$baseDir = null;
foreach ($candidateDirs as $dir) {
    if (file_exists($dir . '/config.php') && file_exists($dir . '/db.php') && file_exists($dir . '/commerce_sync_orchestrator.php')) {
        $baseDir = $dir;
        break;
    }
}

if (!$baseDir) {
    fwrite(STDERR, "[CRITICAL ERROR] Cannot locate valid backend API directory (config.php, db.php, commerce_sync_orchestrator.php).\n");
    fwrite(STDERR, "Checked directories:\n  - " . implode("\n  - ", $candidateDirs) . "\n");
    exit(1);
}

require_once $baseDir . '/config.php';
require_once $baseDir . '/db.php';
require_once $baseDir . '/commerce_sync_orchestrator.php';

$db = getDBConnection();
$orchestrator = new CommerceSyncOrchestrator($db);

/**
 * Executes a callback with exponential backoff and jitter on transient rate limits (HTTP 429).
 */
function executeWithBackoff(callable $fn, int $maxRetries = 3) {
    $retry = 0;
    while (true) {
        try {
            return $fn();
        } catch (\Throwable $t) {
            $retry++;
            $msg = $t->getMessage();
            $isRateLimit = (
                stripos($msg, '429') !== false ||
                stripos($msg, 'rate') !== false ||
                stripos($msg, 'quota') !== false ||
                stripos($msg, 'too many') !== false
            );
            if ($retry >= $maxRetries || !$isRateLimit) {
                throw $t;
            }
            $sleepMs = (int)(pow(2, $retry) * 1000 + rand(100, 500));
            usleep($sleepMs * 1000);
        }
    }
}

// Action 1: Recover Stale
if (isset($options['recover-stale'])) {
    $shopId = !empty($options['shop-id']) ? trim($options['shop-id']) : null;
    $res = $orchestrator->recoverStaleJobsAndRuns($shopId);
    echo json_encode([
        'success' => true,
        'action' => 'recover_stale',
        'data' => $res
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    exit(0);
}

// Action 2: Process Webhook Inbox (F06)
if (isset($options['process-inbox'])) {
    require_once $baseDir . '/commerce_webhook_service.php';
    $webhookService = new CommerceWebhookService($db);
    $limit = isset($options['limit']) ? max(1, (int)$options['limit']) : 50;
    $shopId = !empty($options['shop-id']) ? trim($options['shop-id']) : null;
    $processed = $webhookService->processPendingInboxEvents($shopId, $limit);
    echo json_encode([
        'success' => true,
        'action' => 'process_inbox',
        'events_processed' => $processed
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    exit(0);
}

// Action 3: Drain Aggregate Queue (F15)
if (isset($options['drain-queue'])) {
    require_once $baseDir . '/commerce_daily_aggregate_service.php';
    $dailyAggService = new CommerceDailyAggregateService($db);
    $limit = isset($options['limit']) ? max(1, (int)$options['limit']) : 50;
    $processed = $dailyAggService->drainQueue($limit, 'cli_manual_drain');
    echo json_encode([
        'success' => true,
        'action' => 'drain_queue',
        'dates_aggregated' => $processed
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    exit(0);
}

// Action 4: Autonomous Cron Reconciliation Mode (F13, F15)
if (isset($options['cron'])) {
    $startTime = microtime(true);
    // 1. Recover any abandoned runs first
    $staleRes = $orchestrator->recoverStaleJobsAndRuns();

    // 2. Process pending webhook inbox events (F06)
    $inboxProcessed = 0;
    try {
        require_once $baseDir . '/commerce_webhook_service.php';
        $webhookService = new CommerceWebhookService($db);
        $inboxProcessed = $webhookService->processPendingInboxEvents(null, 50);
    } catch (\Throwable $tInbox) {}

    // 3. Resolve target shops
    $targetShops = [];
    if (!empty($options['shop-id'])) {
        $targetShops[] = trim($options['shop-id']);
    } else {
        try {
            $stmtShops = $db->query("SELECT DISTINCT shop_id FROM `tiktok_config` WHERE shop_id IS NOT NULL AND shop_id != ''");
            $targetShops = $stmtShops->fetchAll(PDO::FETCH_COLUMN) ?: [];
        } catch (\Throwable $t) {}
        if (empty($targetShops)) {
            $targetShops = ['7495657895504611503'];
        }
    }

    $results = [];
    // F13 fix: default cron window is 7 days (rolling reconciliation), not 30 days
    $defaultStart = !empty($options['start-date']) ? trim($options['start-date']) : date('Y-m-d', strtotime('-7 days'));
    $defaultEnd = !empty($options['end-date']) ? trim($options['end-date']) : date('Y-m-d');

    foreach ($targetShops as $sId) {
        try {
            $createRes = executeWithBackoff(function() use ($orchestrator, $sId, $defaultStart, $defaultEnd) {
                return $orchestrator->createOrGetActiveSyncJob($sId, $defaultStart, $defaultEnd, 'cron');
            });

            $cJobId = (int)($createRes['job_id'] ?? 0);
            if ($cJobId <= 0) {
                $results[$sId] = [
                    'status' => 'FAILED',
                    'error' => 'COULD_NOT_CREATE_JOB',
                    'details' => $createRes
                ];
                continue;
            }

            $execState = executeWithBackoff(function() use ($orchestrator, $cJobId) {
                return $orchestrator->executeJobAllSteps($cJobId, 25);
            });

            $results[$sId] = [
                'job_id' => $cJobId,
                'status' => $execState['status'] ?? 'UNKNOWN',
                'orders_status' => $execState['orders_status'] ?? 'UNKNOWN',
                'progress_percent' => $execState['progress_percent'] ?? 100.0,
                'error_message' => $execState['error_message'] ?? null
            ];
        } catch (\Throwable $t) {
            $results[$sId] = [
                'status' => 'EXCEPTION',
                'error' => $t->getMessage()
            ];
        }
    }

    // 4. Drain dirty dates from aggregate queue (F15)
    $queueDrained = 0;
    try {
        require_once $baseDir . '/commerce_daily_aggregate_service.php';
        $dailyAggService = new CommerceDailyAggregateService($db);
        $queueDrained = $dailyAggService->drainQueue(50, 'cli_cron_drain');
    } catch (\Throwable $tAgg) {}

    // F13 fix: Check if any shop encountered FAILED or EXCEPTION
    $hasFailure = false;
    foreach ($results as $shopRes) {
        $st = $shopRes['status'] ?? '';
        if (in_array($st, ['FAILED', 'EXCEPTION'], true)) {
            $hasFailure = true;
            break;
        }
    }

    $duration = round(microtime(true) - $startTime, 2);
    echo json_encode([
        'success' => !$hasFailure,
        'action' => 'cron_reconciliation',
        'duration_seconds' => $duration,
        'stale_recovery' => $staleRes,
        'inbox_processed' => $inboxProcessed,
        'queue_drained' => $queueDrained,
        'shops' => $results
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    exit($hasFailure ? 1 : 0);
}

// Action 3: Execute by Job ID or explicit Shop ID
$jobId = isset($options['job-id']) ? (int)$options['job-id'] : 0;
$maxSteps = isset($options['max-steps']) ? max(1, (int)$options['max-steps']) : 25;

if ($jobId <= 0 && !empty($options['shop-id'])) {
    $shopId = trim($options['shop-id']);
    $startDate = !empty($options['start-date']) ? trim($options['start-date']) : date('Y-m-d', strtotime('-30 days'));
    $endDate = !empty($options['end-date']) ? trim($options['end-date']) : date('Y-m-d');

    $createRes = executeWithBackoff(function() use ($orchestrator, $shopId, $startDate, $endDate) {
        return $orchestrator->createOrGetActiveSyncJob($shopId, $startDate, $endDate, 'cli_worker');
    });
    $jobId = (int)($createRes['job_id'] ?? 0);
}

if ($jobId <= 0) {
    fwrite(STDERR, "Error: Missing required --job-id, --cron, or --shop-id argument.\n");
    exit(1);
}

try {
    $finalState = executeWithBackoff(function() use ($orchestrator, $jobId, $maxSteps) {
        return $orchestrator->executeJobAllSteps($jobId, $maxSteps);
    });

    echo json_encode([
        'success' => true,
        'job_id' => $jobId,
        'final_status' => $finalState['status'] ?? 'UNKNOWN',
        'orders_status' => $finalState['orders_status'] ?? 'UNKNOWN',
        'progress_percent' => $finalState['progress_percent'] ?? 100.0,
        'data' => $finalState
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    exit(0);
} catch (\Throwable $t) {
    fwrite(STDERR, "Worker Exception on Job #{$jobId}: " . $t->getMessage() . "\n");
    exit(1);
}
