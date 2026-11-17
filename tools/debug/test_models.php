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

    $models = [
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-flash-latest",
        "gemini-2.5-pro",
        "gemma-4-31b-it"
    ];

    $results = [];

    foreach ($models as $m) {
        $startTime = microtime(true);
        $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $m . ":generateContent?key=" . $apiKey;
        
        $postData = [
            "contents" => [
                [
                    "parts" => [
                        ["text" => "ChĂ o báº¡n, hĂ£y pháº£n há»“i: OK"]
                    ]
                ]
            ],
            "generationConfig" => [
                "maxOutputTokens" => 20
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        $duration = round(microtime(true) - $startTime, 2);
        $resJson = json_decode($response, true);
        
        $text = $resJson['candidates'][0]['content']['parts'][0]['text'] ?? null;
        $errMsg = $resJson['error']['message'] ?? null;

        $results[$m] = [
            "http_code" => $httpCode,
            "duration" => $duration,
            "success" => !empty($text),
            "text" => $text,
            "error" => $errMsg ?: $curlErr
        ];

        if (!empty($text)) {
            // Found working model!
        }
    }

    echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}

