<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
require_once 'db.php';
header('Content-Type: application/json');

try {
    $db = getDBConnection();
    
    $config = $db->query("SELECT id, shop_id, expires_at, updated_at FROM `tiktok_config`")->fetchAll();
    $campaigns = $db->query("SELECT id, name, type, spend, conversions, ad_gmv FROM `tiktok_campaigns`")->fetchAll();
    $logs = $db->query("SELECT * FROM `tiktok_audit_logs` ORDER BY log_time DESC LIMIT 20")->fetchAll();
    
    echo json_encode([
        'success' => true,
        'config' => $config,
        'campaigns' => $campaigns,
        'logs' => $logs
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

