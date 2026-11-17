<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $db = getDBConnection();
    $configRow = $db->query("SELECT gemini_api_key FROM `tiktok_config` ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    $apiKey = $configRow['gemini_api_key'] ?? '';
    
    if (empty($apiKey)) {
        echo json_encode(["error" => "No API key found in DB"]);
        exit;
    }

    $startTime = microtime(true);

    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" . $apiKey;
    
    $postData = [
        "contents" => [
            [
                "parts" => [
                    ["text" => "HĂ£y tĂ³m táº¯t ngáº¯n gá»n 3 lÆ°u Ă½ quan trá»ng nháº¥t khi cháº¡y quáº£ng cĂ¡o GMV Max TikTok Shop."]
                ]
            ]
        ],
        "generationConfig" => [
            "temperature" => 0.7,
            "maxOutputTokens" => 1024,
            "thinkingConfig" => [
                "thinkingBudget" => 0
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
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    $duration = round(microtime(true) - $startTime, 2);

    echo json_encode([
        "http_code" => $httpCode,
        "duration_seconds" => $duration,
        "curl_error" => $err,
        "response" => json_decode($response, true)
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}

