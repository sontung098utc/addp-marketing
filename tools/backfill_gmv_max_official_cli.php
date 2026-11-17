<?php
/**
 * ADDP COMMERCE INTELLIGENCE - OFFICIAL GMV MAX BACKFILL CLI
 * 
 * Component: Standalone CLI Tool for Official TikTok GMV Max Ingestion
 * Task: V2-02.1 — Production Hardening & Period Coverage
 * 
 * Features:
 * - 100% Official TikTok Marketing API (GET /open_api/v1.3/gmv_max/report/get/)
 * - Enforces batching (campaign_ids <= 100, item_group_ids <= 100)
 * - Date chunking (max 30 days per chunk)
 * - Dry-run support (--dry-run)
 * - Domain selection (--domain=all|campaigns|products|creatives|live)
 * - Resumable checkpoints (--resume, --checkpoint-file=<path>)
 * - Comprehensive progress and coverage reporting
 */

if (php_sapi_name() !== 'cli' && empty($_SERVER['HTTP_HOST'])) {
    die("Access restricted to CLI.\n");
}

if (getenv('APP_ENV') === false && empty($_ENV['APP_ENV']) && empty($_SERVER['APP_ENV'])) {
    putenv('APP_ENV=development');
}

$candidateDirs = [
    __DIR__ . '/../api',
    __DIR__ . '/../public/api',
    __DIR__ . '/api',
    __DIR__ . '/public/api',
    __DIR__
];

$baseDir = null;
foreach ($candidateDirs as $dir) {
    if (file_exists($dir . '/config.php') && file_exists($dir . '/db.php') && file_exists($dir . '/tiktok_gmv_max_api_client.php')) {
        $baseDir = $dir;
        break;
    }
}

if (!$baseDir) {
    fwrite(STDERR, "[CRITICAL ERROR] Cannot locate backend API directory.\n");
    exit(1);
}

require_once $baseDir . '/config.php';
require_once $baseDir . '/db.php';
require_once $baseDir . '/tiktok_gmv_max_api_client.php';
require_once $baseDir . '/commerce_ads_ingestion_service.php';
require_once $baseDir . '/commerce_ads_service.php';

function printMsg(string $msg = ''): void {
    echo $msg . "\n";
}

function parseCliArgs(): array {
    $options = getopt('', [
        'start::',
        'end::',
        'advertiser-id::',
        'domain::',
        'dry-run',
        'resume',
        'checkpoint-file::',
        'help'
    ]);

    if (isset($options['help'])) {
        printMsg("ADDP Commerce Intelligence — GMV Max Official Backfill Tool");
        printMsg("Usage: php backfill_gmv_max_official_cli.php [options]");
        printMsg("");
        printMsg("Options:");
        printMsg("  --start=YYYY-MM-DD          Start date (default: 2026-09-01)");
        printMsg("  --end=YYYY-MM-DD            End date (default: 2026-09-20)");
        printMsg("  --advertiser-id=ID          TikTok Advertiser ID (default: config)");
        printMsg("  --domain=DOMAIN             Domain to sync: all|campaigns|products|creatives|live (default: all)");
        printMsg("  --dry-run                   Simulate backfill without persisting records");
        printMsg("  --resume                    Resume from previous checkpoint if available");
        printMsg("  --checkpoint-file=PATH      Path to checkpoint file (default: .gmv_max_backfill_checkpoint.json)");
        printMsg("  --help                      Display this help message");
        exit(0);
    }

    $startDate = $options['start'] ?? '2026-09-01';
    $endDate = $options['end'] ?? '2026-09-20';
    $advertiserId = $options['advertiser-id'] ?? (defined('TIKTOK_ADVERTISER_ID') ? TIKTOK_ADVERTISER_ID : (defined('TIKTOK_ADS_ADVERTISER_ID') ? TIKTOK_ADS_ADVERTISER_ID : ''));
    $domain = strtolower($options['domain'] ?? 'all');
    $dryRun = isset($options['dry-run']);
    $resume = isset($options['resume']);
    $checkpointFile = $options['checkpoint-file'] ?? (__DIR__ . '/.gmv_max_backfill_checkpoint.json');

    // Date validation
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
        fwrite(STDERR, "Error: Invalid date format. Use YYYY-MM-DD.\n");
        exit(1);
    }

    if ($startDate > $endDate) {
        fwrite(STDERR, "Error: Start date ($startDate) cannot be after end date ($endDate).\n");
        exit(1);
    }

    $validDomains = ['all', 'campaigns', 'products', 'creatives', 'live'];
    if (!in_array($domain, $validDomains, true)) {
        fwrite(STDERR, "Error: Invalid domain '$domain'. Choose from: " . implode(', ', $validDomains) . "\n");
        exit(1);
    }

    return [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'advertiser_id' => $advertiserId,
        'domain' => $domain,
        'dry_run' => $dryRun,
        'resume' => $resume,
        'checkpoint_file' => $checkpointFile
    ];
}

/**
 * Split a date range into sub-ranges of at most $maxDays per chunk.
 */
function splitDateRange(string $startDate, string $endDate, int $maxDays = 30): array {
    $chunks = [];
    $start = new DateTime($startDate);
    $end = new DateTime($endDate);

    while ($start <= $end) {
        $chunkEnd = clone $start;
        $chunkEnd->modify('+' . ($maxDays - 1) . ' days');
        if ($chunkEnd > $end) {
            $chunkEnd = clone $end;
        }

        $chunks[] = [
            'start' => $start->format('Y-m-d'),
            'end' => $chunkEnd->format('Y-m-d')
        ];

        $start = clone $chunkEnd;
        $start->modify('+1 day');
    }

    return $chunks;
}

function loadCheckpoint(string $file): array {
    if (file_exists($file)) {
        $content = @file_get_contents($file);
        if ($content) {
            $data = json_decode($content, true);
            if (is_array($data)) {
                return $data;
            }
        }
    }
    return [
        'completed_steps' => [],
        'stats' => [
            'campaigns' => 0,
            'products' => 0,
            'creatives' => 0,
            'lives' => 0,
            'total_spend' => 0.0
        ]
    ];
}

function saveCheckpoint(string $file, array $checkpoint): void {
    @file_put_contents($file, json_encode($checkpoint, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Main Execution
$params = parseCliArgs();

printMsg("====================================================================");
printMsg("ADDP COMMERCE INTELLIGENCE — GMV MAX OFFICIAL BACKFILL CLI");
printMsg("====================================================================");
printMsg("Source:          OFFICIAL TIKTOK GMV MAX API ONLY (No Legacy Substitution)");
printMsg("Period:          " . $params['start_date'] . " → " . $params['end_date']);
printMsg("Advertiser ID:   " . ($params['advertiser_id'] ?: '(Not specified in arguments/config)'));
printMsg("Domain Target:   " . strtoupper($params['domain']));
printMsg("Dry Run Mode:    " . ($params['dry_run'] ? "ENABLED (Simulation only)" : "DISABLED (Database writes enabled)"));
printMsg("Resume Mode:     " . ($params['resume'] ? "ENABLED" : "DISABLED"));
printMsg("Checkpoint File: " . $params['checkpoint_file']);
printMsg("--------------------------------------------------------------------\n");

$chunks = splitDateRange($params['start_date'], $params['end_date'], 30);
printMsg("Date chunking:   " . count($chunks) . " chunk(s) (<= 30 days per chunk):");
foreach ($chunks as $idx => $chunk) {
    printMsg("  [" . ($idx + 1) . "] " . $chunk['start'] . " → " . $chunk['end']);
}
printMsg("");

if ($params['dry_run']) {
    printMsg("[DRY-RUN] Simulating backfill workflow...");
    $targetDomains = ($params['domain'] === 'all') ? ['campaigns', 'products', 'creatives', 'live'] : [$params['domain']];
    foreach ($targetDomains as $d) {
        printMsg("  - Domain '$d' would be synced across " . count($chunks) . " date chunk(s).");
        printMsg("    Official endpoint: GET /open_api/v1.3/gmv_max/report/get/");
        printMsg("    Hierarchy & batching: campaign_ids <= 100, item_group_ids <= 100.");
    }
    printMsg("\n[DRY-RUN] Completed simulation successfully. No database records modified.");
    exit(0);
}

// Database connection
try {
    $pdo = getDbConnection();
} catch (Exception $e) {
    fwrite(STDERR, "Database connection error: " . $e->getMessage() . "\n");
    exit(1);
}

$checkpoint = $params['resume'] ? loadCheckpoint($params['checkpoint_file']) : [
    'completed_steps' => [],
    'stats' => ['campaigns' => 0, 'products' => 0, 'creatives' => 0, 'lives' => 0, 'total_spend' => 0.0]
];

$domainsToRun = ($params['domain'] === 'all') ? ['campaigns', 'products', 'creatives', 'live'] : [$params['domain']];

$overallStats = $checkpoint['stats'];
$hasErrors = false;

foreach ($chunks as $chunkIndex => $chunk) {
    $cStart = $chunk['start'];
    $cEnd = $chunk['end'];
    printMsg("====================================================================");
    printMsg("PROCESSING CHUNK [" . ($chunkIndex + 1) . "/" . count($chunks) . "]: $cStart → $cEnd");
    printMsg("====================================================================");

    foreach ($domainsToRun as $currentDomain) {
        $stepKey = "{$currentDomain}_{$cStart}_{$cEnd}";
        if (in_array($stepKey, $checkpoint['completed_steps'], true)) {
            printMsg("● Skipping '$currentDomain' ($cStart → $cEnd) — already completed in checkpoint.");
            continue;
        }

        printMsg("▶ Syncing domain: " . strtoupper($currentDomain) . " ($cStart → $cEnd)...");

        try {
            switch ($currentDomain) {
                case 'campaigns':
                    $res = CommerceAdsIngestionService::syncCampaignDailyRange($pdo, $params['advertiser_id'], $cStart, $cEnd, false);
                    $ingested = $res['records_ingested'] ?? 0;
                    $spend = $res['total_cost'] ?? 0.0;
                    $overallStats['campaigns'] += $ingested;
                    $overallStats['total_spend'] += $spend;
                    printMsg("  ✔ Campaigns ingested: $ingested records | Cost: " . number_format($spend, 0, ',', '.') . " đ");
                    break;

                case 'products':
                    $res = CommerceAdsIngestionService::syncProductDailyRange($pdo, $params['advertiser_id'], $cStart, $cEnd);
                    $ingested = $res['records_ingested'] ?? 0;
                    $overallStats['products'] += $ingested;
                    printMsg("  ✔ Products (SPUs) ingested: $ingested records | Batches: " . ($res['successful_batches'] ?? 0) . "/" . ($res['requested_batches'] ?? 0));
                    break;

                case 'creatives':
                    $res = CommerceAdsIngestionService::syncCreativeDailyRange($pdo, $params['advertiser_id'], $cStart, $cEnd);
                    $ingested = $res['records_ingested'] ?? 0;
                    $overallStats['creatives'] += $ingested;
                    printMsg("  ✔ Creatives (Videos) ingested: $ingested records | Unattributed (-1): " . ($res['unattributed_count'] ?? 0));
                    break;

                case 'live':
                    $res = CommerceAdsIngestionService::syncLiveDailyRange($pdo, $params['advertiser_id'], $cStart, $cEnd);
                    $ingested = $res['records_ingested'] ?? 0;
                    $overallStats['lives'] += $ingested;
                    printMsg("  ✔ LIVE rooms ingested: $ingested records | Batches: " . ($res['successful_batches'] ?? 0) . "/" . ($res['requested_batches'] ?? 0));
                    break;
            }

            $checkpoint['completed_steps'][] = $stepKey;
            $checkpoint['stats'] = $overallStats;
            saveCheckpoint($params['checkpoint_file'], $checkpoint);

        } catch (Exception $ex) {
            $hasErrors = true;
            fwrite(STDERR, "  ✖ FAILED syncing domain '$currentDomain' ($cStart → $cEnd): " . $ex->getMessage() . "\n");
        }
    }
}

// Calculate coverage achieved
printMsg("\n====================================================================");
printMsg("FINAL BACKFILL SUMMARY & COVERAGE AUDIT");
printMsg("====================================================================");
printMsg("Campaigns Ingested: " . number_format($overallStats['campaigns']));
printMsg("Products Ingested:  " . number_format($overallStats['products']));
printMsg("Creatives Ingested: " . number_format($overallStats['creatives']));
printMsg("LIVE Rooms Ingested:" . number_format($overallStats['lives']));
printMsg("Total Recorded Cost:" . number_format($overallStats['total_spend'], 0, ',', '.') . " đ");

try {
    $overview = CommerceAdsService::getAdvertisingCostOverview($pdo, $params['advertiser_id'], $params['start_date'], $params['end_date']);
    $cov = $overview['period_coverage'] ?? [];
    printMsg("\nCoverage Analysis for requested period ({$params['start_date']} → {$params['end_date']}):");
    printMsg("  Requested Days:    " . ($cov['requested_days'] ?? 0));
    printMsg("  Available Days:    " . ($cov['available_days'] ?? 0));
    printMsg("  Missing Days:      " . ($cov['missing_days'] ?? 0));
    printMsg("  Coverage Pct:      " . ($cov['coverage_pct'] ?? 0) . "%");
    printMsg("  Coverage Status:   " . ($cov['availability_status'] ?? 'UNKNOWN'));
    printMsg("  Official Spend:    " . number_format($overview['total_spend'] ?? 0, 0, ',', '.') . " đ");
} catch (Exception $e) {
    printMsg("  Coverage check failed: " . $e->getMessage());
}

printMsg("====================================================================");

if ($hasErrors) {
    printMsg("Backfill completed with errors. Check logs and rerun with --resume.");
    exit(1);
} else {
    printMsg("Backfill completed successfully.");
    exit(0);
}
