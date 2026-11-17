<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $db = getDBConnection();
    $config = $db->query("SELECT gemini_api_key FROM tiktok_config ORDER BY id DESC LIMIT 1")->fetch();
    $apiKey = ($config && !empty($config['gemini_api_key'])) ? trim($config['gemini_api_key']) : '';
    
    if (empty($apiKey)) {
        echo json_encode(["error" => "No Gemini API Key found in database."]);
        exit;
    }
    
    // Gá»i API ListModels Ä‘á»ƒ láº¥y danh sĂ¡ch cĂ¡c model kháº£ dá»¥ng cho API Key nĂ y
    $url = "https://generativelanguage.googleapis.com/v1beta/models?key=" . $apiKey;
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $resDecoded = json_decode($response, true);
    
    echo json_encode([
        "http_code" => $httpCode,
        "api_response" => $resDecoded
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}

