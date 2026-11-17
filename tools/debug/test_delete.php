<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
require_once 'db.php';
header('Content-Type: application/json');

try {
    $db = getDBConnection();
    
    // Kiá»ƒm tra token
    $accessToken = getAccessToken();
    
    // Äáº¿m sá»‘ lÆ°á»£ng camp trÆ°á»›c khi delete
    $countBefore = $db->query("SELECT COUNT(*) FROM `tiktok_campaigns` WHERE id IN ('camp-1', 'camp-2', 'camp-3', 'camp-4')")->fetchColumn();
    
    // Cháº¡y lá»‡nh xĂ³a
    $affected = $db->exec("DELETE FROM `tiktok_campaigns` WHERE id IN ('camp-1', 'camp-2', 'camp-3', 'camp-4')");
    
    // Äáº¿m láº¡i
    $countAfter = $db->query("SELECT COUNT(*) FROM `tiktok_campaigns` WHERE id IN ('camp-1', 'camp-2', 'camp-3', 'camp-4')")->fetchColumn();
    
    echo json_encode([
        'success' => true,
        'accessToken' => $accessToken ? substr($accessToken, 0, 15) . '...' : null,
        'countBefore' => (int)$countBefore,
        'affectedRows' => (int)$affected,
        'countAfter' => (int)$countAfter,
        'db_error_code' => $db->errorCode(),
        'db_error_info' => $db->errorInfo()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

