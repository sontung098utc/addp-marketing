<?php
/**
 * ADDP COMMERCE INTELLIGENCE - CENTRAL DATA SYNC API ENDPOINT
 * 
 * Component: Standalone Authenticated REST Endpoint for Automated Multi-Domain Sync
 * Endpoint: GET/POST /api/commerce_sync.php?action=...&shop_id=...
 * Sprint V2-04.3: Asynchronous Job Orchestration & Stale Run Recovery
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_guard.php';
require_once __DIR__ . '/commerce_sync_orchestrator.php';

header('Content-Type: application/json; charset=utf-8');
handleCORS();

// Strictly authenticate admin access
$authUser = requireAuth('admin:all');

$db = getDBConnection();

$defaultShopId = '7495657895504611503';
try {
    $stmtShop = $db->query("SELECT shop_id FROM `tiktok_config` WHERE shop_id IS NOT NULL AND shop_id != '' ORDER BY updated_at DESC LIMIT 1");
    $shopRow = $stmtShop->fetch(PDO::FETCH_ASSOC);
    if (!empty($shopRow['shop_id'])) {
        $defaultShopId = $shopRow['shop_id'];
    }
} catch (\Throwable $t) {}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true) ?? [];

$action = trim($_GET['action'] ?? $body['action'] ?? $_POST['action'] ?? 'status');
$shopId = trim($_GET['shop_id'] ?? $body['shop_id'] ?? $_POST['shop_id'] ?? $defaultShopId);
$startDate = trim($_GET['start_date'] ?? $body['start_date'] ?? $_POST['start_date'] ?? '');
$endDate = trim($_GET['end_date'] ?? $body['end_date'] ?? $_POST['end_date'] ?? '');
$domain = trim($_GET['domain'] ?? $body['domain'] ?? $_POST['domain'] ?? 'all');
$syncMode = trim($_GET['sync_mode'] ?? $body['sync_mode'] ?? $_POST['sync_mode'] ?? 'async');

$orchestrator = new CommerceSyncOrchestrator($db);

switch ($action) {
    case 'status':
    case 'get_sync_status':
        $health = $orchestrator->getSyncHealth($shopId);
        echo json_encode([
            'success' => true,
            'data' => $health
        ], JSON_UNESCAPED_UNICODE);
        break;

    // Sprint V2-04.3: Asynchronous Job Creation (Returns immediately < 1s)
    case 'start_sync':
        $resolvedStart = $startDate ?: date('Y-m-d', strtotime('-30 days'));
        $resolvedEnd = $endDate ?: date('Y-m-d');
        $creator = $authUser['username'] ?? ($authUser['user_id'] ?? 'user');

        $jobRes = $orchestrator->createOrGetActiveSyncJob($shopId, $resolvedStart, $resolvedEnd, $creator);
        echo json_encode($jobRes, JSON_UNESCAPED_UNICODE);
        break;

    // Sprint V2-04.3: Job Progress Polling with Cooperative Tick Execution
    case 'job_status':
    case 'get_job_status':
        $jobId = (int)($_GET['job_id'] ?? $body['job_id'] ?? $_POST['job_id'] ?? 0);
        $tick = !empty($_GET['tick']) || !empty($body['tick']);

        if ($jobId <= 0) {
            echo json_encode([
                'success' => false,
                'error' => 'MISSING_JOB_ID',
                'message' => 'Vui lòng cung cấp job_id hợp lệ.'
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        $jobStatus = $orchestrator->getJobStatus($jobId, $tick);
        echo json_encode([
            'success' => $jobStatus['success'] ?? false,
            'data' => $jobStatus,
            'status' => $jobStatus['status'] ?? 'UNKNOWN',
            'orders_status' => $jobStatus['orders_status'] ?? 'UNKNOWN',
            'progress_percent' => $jobStatus['progress_percent'] ?? 0.0,
            'current_domain' => $jobStatus['current_domain'] ?? null,
            'is_terminal' => $jobStatus['is_terminal'] ?? false,
            'message' => $jobStatus['error_message'] ?? null
        ], JSON_UNESCAPED_UNICODE);
        break;

    // Sprint V2-04.3: Stale Run & Job Recovery Trigger
    case 'recover_stale':
        $recRes = $orchestrator->recoverStaleJobsAndRuns($shopId);
        echo json_encode([
            'success' => true,
            'data' => $recRes,
            'message' => "Đã khôi phục {$recRes['recovered_jobs']} tác vụ và {$recRes['recovered_runs']} lượt chạy bị gián đoạn."
        ], JSON_UNESCAPED_UNICODE);
        break;

    // Sprint V2-05.2: Priority Recipient Capture for Active Orders (AWAITING_SHIPMENT / IN_TRANSIT)
    case 'sync_priority_recipients':
    case 'priority_recipients':
        $limit = (int)($_GET['limit'] ?? $body['limit'] ?? $_POST['limit'] ?? 50);
        $orderIds = $body['order_ids'] ?? ($_GET['order_ids'] ?? []);
        if (is_string($orderIds)) {
            $orderIds = array_filter(array_map('trim', explode(',', $orderIds)));
        }
        $pRes = $orchestrator->syncPriorityRecipients($shopId, (array)$orderIds, $limit);
        echo json_encode([
            'success' => in_array($pRes['status'] ?? '', ['SUCCESS', 'COMPLETED'], true),
            'data' => $pRes,
            'message' => $pRes['message'] ?? 'Hoàn tất đồng bộ ưu tiên người nhận.'
        ], JSON_UNESCAPED_UNICODE);
        break;

    // Sprint V2-05.2: Rebuild Customer Profiles from Matched Identities
    case 'rebuild_customer_profiles':
    case 'rebuild_customers':
        $rbRes = $orchestrator->rebuildCustomerProfiles($shopId);
        echo json_encode([
            'success' => ($rbRes['status'] ?? '') === 'SUCCESS',
            'data' => $rbRes,
            'message' => $rbRes['message'] ?? 'Hoàn tất tái tạo hồ sơ khách hàng.'
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'sync':
    case 'trigger_sync':
    case 'sync_all':
        // If async mode requested (or default for trigger_sync):
        if ($syncMode === 'async') {
            $resolvedStart = $startDate ?: date('Y-m-d', strtotime('-30 days'));
            $resolvedEnd = $endDate ?: date('Y-m-d');
            $creator = $authUser['username'] ?? ($authUser['user_id'] ?? 'user');

            $jobRes = $orchestrator->createOrGetActiveSyncJob($shopId, $resolvedStart, $resolvedEnd, $creator);
            echo json_encode($jobRes, JSON_UNESCAPED_UNICODE);
            break;
        }

        // Synchronous execution branch (for backwards compatibility / explicit sync_mode=sync):
        if ($domain === 'all' || $action === 'sync_all') {
            $syncRes = $orchestrator->syncAll($shopId, $startDate ?: null, $endDate ?: null);
            $health = $orchestrator->getSyncHealth($shopId);

            $ordersDomain = $syncRes['domains'][CommerceSyncOrchestrator::DOMAIN_ORDERS] ?? ($syncRes['domains']['orders'] ?? []);
            $ordersRawStatus = $ordersDomain['status'] ?? 'UNKNOWN';
            $ordersStatus = CommerceSyncOrchestrator::normalizeDomainStatus($ordersRawStatus);

            $isOrdersDisabled = ($ordersStatus === 'DISABLED');
            $isOrdersError = in_array($ordersStatus, [CommerceSyncOrchestrator::STATE_ERROR, 'FAILED'], true);
            $isOrdersPartial = in_array($ordersStatus, [CommerceSyncOrchestrator::STATE_PARTIAL, 'INTERRUPTED'], true);
            $isOrdersSuccess = in_array($ordersStatus, ['COMPLETED', 'COMPLETE', CommerceSyncOrchestrator::STATE_AVAILABLE, 'SUCCESS'], true);

            // Separate mandatory domain (Orders) and optional domains (RMA, Loss, Ads, Finance, Analytics)
            $disabledOptional = [];
            $errorOptional = [];
            $partialOptional = [];
            foreach (($syncRes['domains'] ?? []) as $dName => $dInfo) {
                if ($dName === CommerceSyncOrchestrator::DOMAIN_ORDERS || $dName === 'orders') continue;
                $st = CommerceSyncOrchestrator::normalizeDomainStatus($dInfo['status'] ?? '');
                if ($st === 'DISABLED') {
                    $disabledOptional[] = $dName;
                } elseif (in_array($st, [CommerceSyncOrchestrator::STATE_ERROR, 'FAILED'], true)) {
                    $errorOptional[] = $dName;
                } elseif ($st === CommerceSyncOrchestrator::STATE_PARTIAL) {
                    $partialOptional[] = $dName;
                }
            }

            if ($isOrdersDisabled) {
                $isSuccess = false;
                $status = 'DISABLED';
                $msg = $ordersDomain['message'] ?? 'Tính năng đồng bộ đơn hàng đang bị tắt (FEATURE_ENABLE_COMMERCE_V2=false).';
            } elseif ($isOrdersError) {
                $isSuccess = false;
                $status = 'ERROR';
                $msg = 'Đồng bộ thất bại: ' . ($ordersDomain['message'] ?? 'Lỗi không xác định khi đồng bộ đơn hàng');
            } elseif ($isOrdersPartial) {
                $isSuccess = false;
                $status = 'PARTIAL';
                $msg = 'Đồng bộ hoàn thành một phần. Vui lòng kiểm tra Độ phủ dữ liệu.';
            } elseif ($isOrdersSuccess) {
                $isSuccess = true;
                $status = 'COMPLETED';
                $msg = 'Đồng bộ đơn hàng hoàn tất. Báo cáo đã được cập nhật.';
            } else {
                $isSuccess = false;
                $status = $ordersStatus;
                $msg = $ordersDomain['message'] ?? "Trạng thái đồng bộ đơn hàng: {$ordersStatus}";
            }

            // Orders success + optional disabled does NOT become false global success
            $isGlobalAllComplete = ($isOrdersSuccess && empty($disabledOptional) && empty($errorOptional) && empty($partialOptional));

            echo json_encode([
                'success' => $isSuccess,
                'status' => $status,
                'orders_status' => $ordersStatus,
                'is_global_all_complete' => $isGlobalAllComplete,
                'disabled_optional_domains' => $disabledOptional,
                'message' => $msg,
                'data' => $syncRes,
                'health' => $health
            ], JSON_UNESCAPED_UNICODE);
        } else {
            $syncRes = $orchestrator->syncDomain($shopId, $domain, $startDate ?: null, $endDate ?: null);
            $health = $orchestrator->getSyncHealth($shopId);
            $status = CommerceSyncOrchestrator::normalizeDomainStatus($syncRes['status'] ?? 'UNKNOWN');
            $isSuccess = in_array($status, ['AVAILABLE', 'COMPLETE', 'COMPLETED', 'SUCCESS'], true);
            echo json_encode([
                'success' => $isSuccess,
                'status' => $status,
                'orders_status' => ($domain === 'orders' || $domain === 'order') ? $status : null,
                'message' => $syncRes['message'] ?? null,
                'data' => $syncRes,
                'health' => $health
            ], JSON_UNESCAPED_UNICODE);
        }
        break;

    default:
        echo json_encode([
            'success' => false,
            'message' => "Hành động không hợp lệ: '{$action}'"
        ], JSON_UNESCAPED_UNICODE);
        break;
}
