<?php
/**
 * ADDP COMMERCE INTELLIGENCE - PERIOD REPORTING API ENDPOINT
 * 
 * Component: Standalone Authenticated REST Endpoint for Date-Range Commerce Report
 * Endpoint: GET /api/commerce_report.php?shop_id=...&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_guard.php';
require_once __DIR__ . '/commerce_reporting_service.php';

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

$shopId = trim($_GET['shop_id'] ?? $_POST['shop_id'] ?? $defaultShopId);
$startDate = trim($_GET['start_date'] ?? $_POST['start_date'] ?? date('Y-m-d', strtotime('-29 days')));
$endDate = trim($_GET['end_date'] ?? $_POST['end_date'] ?? date('Y-m-d'));

$reportingService = new CommerceReportingService($db);
$report = $reportingService->getCommerceReport($shopId, $startDate, $endDate);

echo json_encode([
    'success' => true,
    'data' => $report
], JSON_UNESCAPED_UNICODE);
