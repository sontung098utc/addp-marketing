<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
handleCORS();

initializeDatabase();

// 1. Lấy mã authorization code từ URL (TikTok gửi về 'auth_code' hoặc 'code')
$authCode = isset($_GET['auth_code']) ? $_GET['auth_code'] : (isset($_GET['code']) ? $_GET['code'] : null);
$format = isset($_GET['format']) ? $_GET['format'] : 'redirect';

// 2. Nếu người dùng bấm liên kết Ads từ giao diện
if (isset($_GET['action']) && $_GET['action'] === 'auth') {
    if (TIKTOK_ADS_APP_ID === '') {
        echo json_encode([
            'success' => false,
            'message' => 'Vui lòng cấu hình TIKTOK_ADS_APP_ID'
        ]);
        exit;
    }
    
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state_ads'] = $state;

    // Đường dẫn chuyển hướng người dùng sang trang cấp quyền tài khoản Quảng cáo TikTok
    $authUrl = "https://ads.tiktok.com/marketing_api/auth" .
               "?app_id=" . urlencode(TIKTOK_ADS_APP_ID) .
               "&redirect_uri=" . urlencode(TIKTOK_ADS_REDIRECT_URI) .
               "&state=" . urlencode($state);
               
    header("Location: " . $authUrl);
    exit;
}

// 3. Xử lý ngắt kết nối tài khoản Quảng cáo
if (isset($_GET['action']) && $_GET['action'] === 'disconnect') {
    $authUser = requireAuth('admin:all');
    try {
        $db = getDBConnection();
        $db->exec("UPDATE `tiktok_config` SET 
            ads_access_token = NULL, 
            ads_refresh_token = NULL, 
            ads_expires_at = NULL, 
            advertiser_id = NULL");
            
        echo json_encode([
            'success' => true,
            'message' => 'Đã ngắt kết nối tài khoản quảng cáo thành công!'
        ]);
    } catch (Exception $e) {
        sanitizeErrorResponse($e, 'Lỗi ngắt kết nối tài khoản quảng cáo');
    }
    exit;
}

// 4. Nhận callback sau khi cấp quyền Quảng cáo thành công
if ($authCode) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $receivedState = $_GET['state'] ?? '';
    $savedState = $_SESSION['oauth_state_ads'] ?? '';
    if (defined('APP_ENV') && APP_ENV === 'production' && !empty($savedState)) {
        if (empty($receivedState) || !hash_equals($savedState, $receivedState)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Lỗi xác thực CSRF State.']);
            exit;
        }
    }
    unset($_SESSION['oauth_state_ads']);

    try {
        $db = getDBConnection();
        
        // Kiểm tra cấu hình key
        $appId = TIKTOK_ADS_APP_ID;
        $secret = TIKTOK_ADS_SECRET;
        
        if ($appId === '' || $secret === '') {
            throw new Exception("Chưa cấu hình TIKTOK_ADS_APP_ID hoặc TIKTOK_ADS_SECRET");
        }
        
        // Gọi API TikTok Ads để đổi Access Token
        $url = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";
        
        $body = [
            'app_id' => $appId,
            'secret' => $secret,
            'auth_code' => $authCode
        ];
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        if ($response === false) {
            throw new Exception("Lỗi kết nối cURL tới TikTok Ads API: " . $curlError);
        }
        
        $resData = json_decode($response, true);
        if (!isset($resData['code']) || $resData['code'] !== 0) {
            $msg = isset($resData['message']) ? $resData['message'] : "Lỗi không xác định";
            throw new Exception("TikTok Ads API Error (Code " . ($resData['code'] ?? -1) . "): " . $msg . ". Phản hồi: " . $response);
        }
        
        $accessToken = $resData['data']['access_token'] ?? null;
        $advertiserIds = $resData['data']['advertiser_ids'] ?? [];
        $advertiserId = !empty($advertiserIds) ? $advertiserIds[0] : null;
        
        if (!$accessToken) {
            throw new Exception("Không nhận được access_token trong phản hồi từ TikTok Ads.");
        }
        
        // Lưu thông tin Token Quảng cáo vào bảng cấu hình của Shop hiện tại
        $stmt = $db->prepare("UPDATE `tiktok_config` SET 
            ads_access_token = :ads_access_token,
            ads_app_id = :ads_app_id,
            ads_app_secret = :ads_app_secret,
            advertiser_id = :advertiser_id
            WHERE shop_id IS NOT NULL AND shop_id != ''
            ORDER BY id DESC LIMIT 1");
            
        $stmt->execute([
            ':ads_access_token' => $accessToken,
            ':ads_app_id' => $appId,
            ':ads_app_secret' => $secret,
            ':advertiser_id' => $advertiserId
        ]);
        
        if ($format === 'json') {
            echo json_encode([
                'success' => true,
                'advertiser_id' => $advertiserId,
                'message' => 'Kết nối tài khoản quảng cáo thành công!'
            ]);
            exit;
        } else {
            // Chuyển hướng người dùng về trang chủ
            $redirectUrl = "../?ads_connected=1&advertiser_id=" . urlencode($advertiserId);
            header("Location: " . $redirectUrl);
            exit;
        }
        
    } catch (Exception $e) {
        if ($format === 'json') {
            sanitizeErrorResponse($e, 'Lỗi kết nối tài khoản quảng cáo');
        } else {
            http_response_code(500);
            echo "Lỗi kết nối tài khoản quảng cáo TikTok Ads. Vui lòng liên hệ quản trị viên.";
            exit;
        }
    }
} else {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Thiếu tham số auth_code'
    ]);
}
