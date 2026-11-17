<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
require_once 'db.php';
require_once 'tiktok_client.php';

header('Content-Type: application/json');

try {
    $db = getDBConnection();
    
    // Láº¥y token
    $accessToken = getAccessToken();
    if (!$accessToken) {
        throw new Exception("KhĂ´ng tĂ¬m tháº¥y Access Token trong cÆ¡ sá»Ÿ dá»¯ liá»‡u. Vui lĂ²ng káº¿t ná»‘i Shop trÆ°á»›c.");
    }
    
    $client = new TikTokShopClient();
    
    // 1. Gá»i danh sĂ¡ch Shop
    $shopsResult = null;
    $shopsError = null;
    try {
        $shopsResult = $client->getAuthorizedShops($accessToken);
    } catch (Exception $ex) {
        $shopsError = $ex->getMessage();
    }
    
    // 2. Thá»­ gá»i danh sĂ¡ch sáº£n pháº©m náº¿u cĂ³ shop
    $productsResult = null;
    $productsError = null;
    $shopCipher = null;
    
    if ($shopsResult && !empty($shopsResult)) {
        $shopCipher = $shopsResult[0]['cipher'] ?? $shopsResult[0]['shop_cipher'] ?? null;
        try {
            $productsResult = $client->searchProducts($accessToken, $shopCipher);
        } catch (Exception $ex) {
            $productsError = $ex->getMessage();
        }
    }
    
    // 3. Thá»­ gá»i danh sĂ¡ch Ä‘Æ¡n hĂ ng
    $ordersResult = null;
    $ordersError = null;
    if ($shopCipher) {
        try {
            $ordersResult = $client->searchOrders($accessToken, $shopCipher);
        } catch (Exception $ex) {
            $ordersError = $ex->getMessage();
        }
    }
    
    echo json_encode([
        'success' => true,
        'accessTokenSnippet' => substr($accessToken, 0, 15) . '...',
        'shops' => [
            'data' => $shopsResult,
            'error' => $shopsError
        ],
        'products' => [
            'data' => $productsResult,
            'error' => $productsError
        ],
        'orders' => [
            'data' => $ordersResult,
            'error' => $ordersError
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

