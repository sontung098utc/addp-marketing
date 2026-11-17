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
    
    // Gá»i API vá»›i model gemini-flash-latest
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" . $apiKey;
    
    $postData = [
        "contents" => [
            [
                "parts" => [
                    ["text" => "Xin chĂ o, hĂ£y tráº£ lá»i ngáº¯n gá»n lĂ  OK"]
                ]
            ]
        ]
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $resDecoded = json_decode($response, true);
    
    echo json_encode([
        "http_code" => $httpCode,
        "success" => isset($resDecoded['candidates'][0]['content']['parts'][0]['text']),
        "response" => $resDecoded
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}

