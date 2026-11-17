<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
handleCORS();

// Khởi chạy tạo bảng nếu chưa có
initializeDatabase();

// Nhận request từ TikTok OAuth redirect
$code = isset($_GET['code']) ? $_GET['code'] : null;
$shop_id = isset($_GET['shop_id']) ? $_GET['shop_id'] : (isset($_GET['seller_id']) ? $_GET['seller_id'] : null);

// Ngắt kết nối và xóa cấu hình khỏi Database
if (isset($_GET['action']) && $_GET['action'] === 'disconnect') {
    $authUser = requireAuth('admin:all');
    try {
        $db = getDBConnection();
        $db->exec("DELETE FROM `tiktok_config`");
        
        // Reset luôn các chiến dịch thật về chiến dịch mặc định ban đầu để tránh trống dashboard
        $db->exec("DELETE FROM `tiktok_campaigns` WHERE id LIKE 'prod-%'");
        $check = $db->query("SELECT COUNT(*) FROM `tiktok_campaigns`")->fetchColumn();
        if ($check == 0) {
            $db->exec("INSERT INTO `tiktok_campaigns` (`id`, `name`, `type`, `budget`, `spend`, `clicks`, `impressions`, `conversions`, `ad_gmv`, `status`, `created_date`) VALUES
            ('camp-1', 'GMV Max - Vợt cầu lông Yonex Pro 2026', 'Product GMV Max', 5000000.00, 3200000.00, 1850, 48000, 112, 14400000.00, 1, '2026-07-10'),
            ('camp-2', 'LIVE GMV Max - Phiên live đặc biệt 18/08', 'LIVE GMV Max', 12000000.00, 7800000.00, 4500, 98000, 382, 28860000.00, 1, '2026-08-18'),
            ('camp-3', 'GMV Max - Giày chạy bộ nam UltraLight', 'Product GMV Max', 3000000.00, 1850000.00, 980, 29000, 48, 5180000.00, 1, '2026-07-12'),
            ('camp-4', 'LIVE GMV Max - Flash Sale Đồ Gia Dụng', 'LIVE GMV Max', 8000000.00, 6400000.00, 3100, 74000, 210, 15360000.00, 0, '2026-08-14');");
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Ngắt kết nối thành công!'
        ]);
    } catch (Exception $e) {
        sanitizeErrorResponse($e, 'Lỗi ngắt kết nối shop');
    }
    exit;
}

// Trường hợp người dùng click nút liên kết từ UI của chúng ta
// (Ví dụ chuyển hướng sang trang đăng nhập của TikTok)
if (isset($_GET['action']) && $_GET['action'] === 'auth') {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $oauthState = bin2hex(random_bytes(16));
    $_SESSION['oauth_state_shop'] = $oauthState;

    // Nếu có App Key thì chuyển hướng sang TikTok Auth Link
    if (TIKTOK_APP_KEY !== '') {
        $authUrl = "https://services.tiktokshop.com/open/authorize?app_key=" . urlencode(TIKTOK_APP_KEY) . "&redirect_uri=" . urlencode(TIKTOK_REDIRECT_URI) . "&state=" . urlencode($oauthState);
        header("Location: " . $authUrl);
        exit;
    } else {
        // Nếu chưa cài App Key, chuyển sang chế độ Mock Link
        $mockAuthUrl = "https://marketing.addp.vn/api/oauth.php?code=mock_auth_code_" . rand(1000, 9999) . "&shop_id=VN_" . rand(10000, 99999) . "&state=" . urlencode($oauthState);
        header("Location: " . $mockAuthUrl);
        exit;
    }
}

// Xử lý callback sau khi người dùng cấp quyền
if ($code) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $receivedState = $_GET['state'] ?? '';
    $savedState = $_SESSION['oauth_state_shop'] ?? '';
    if (defined('APP_ENV') && APP_ENV === 'production' && !empty($savedState)) {
        if (empty($receivedState) || !hash_equals($savedState, $receivedState)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Lỗi xác thực CSRF State.']);
            exit;
        }
    }
    unset($_SESSION['oauth_state_shop']);

    try {
        $db = getDBConnection();
        
        $accessToken = 'mock_access_token_' . bin2hex(random_bytes(16));
        $refreshToken = 'mock_refresh_token_' . bin2hex(random_bytes(16));
        $expiresIn = 86400 * 30; // 30 ngày
        $expiresAt = time() + $expiresIn;
        $finalShopId = $shop_id;

        // Nếu có thông tin App Secret thực tế, chúng ta sẽ gọi API TikTok đổi Token thật
        if (TIKTOK_APP_KEY !== '' && TIKTOK_APP_SECRET !== '') {
            $url = "https://auth.tiktok-shops.com/api/v2/token/get" .
                   "?app_key=" . urlencode(TIKTOK_APP_KEY) .
                   "&app_secret=" . urlencode(TIKTOK_APP_SECRET) .
                   "&auth_code=" . urlencode($code) .
                   "&grant_type=authorized_code";
            
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
            $response = curl_exec($ch);
            $curlError = curl_error($ch);
            curl_close($ch);
            
            if ($response === false) {
                throw new Exception("Lỗi cURL gọi TikTok API: " . $curlError);
            }
            
            $resData = json_decode($response, true);
            if (isset($resData['data']['access_token'])) {
                $accessToken = $resData['data']['access_token'];
                $refreshToken = $resData['data']['refresh_token'];
                $expireIn = (int)$resData['data']['access_token_expire_in'];
                $expiresAt = ($expireIn > 1000000000) ? $expireIn : time() + $expireIn;
                
                // Thử lấy shop_id/seller_id từ payload trả về
                $apiShopId = $resData['data']['seller_id'] ?? $resData['data']['shop_id'] ?? null;
                if ($apiShopId) {
                    $finalShopId = $apiShopId;
                } else {
                    // Gọi API lấy danh sách shop nếu payload không có sẵn shop_id
                    try {
                        require_once __DIR__ . '/tiktok_client.php';
                        $client = new TikTokShopClient();
                        $shops = $client->getAuthorizedShops($accessToken);
                        if (!empty($shops)) {
                            $finalShopId = isset($shops[0]['id']) ? $shops[0]['id'] : (isset($shops[0]['shop_id']) ? $shops[0]['shop_id'] : null);
                        }
                    } catch (Exception $ex) {}
                }
            } else {
                // Ném lỗi chi tiết từ TikTok API để phản hồi về giao diện thay vì fallback mock âm thầm
                $errMsg = isset($resData['message']) ? $resData['message'] : "Không thể lấy access token từ TikTok Shop.";
                $errCode = isset($resData['code']) ? $resData['code'] : -1;
                throw new Exception("TikTok Auth Error (Code {$errCode}): {$errMsg}. Phản hồi: " . $response);
            }
        } else {
            // Chế độ Mock test (chỉ dùng khi TIKTOK_APP_KEY và SECRET để trống)
            if (!$finalShopId) {
                $finalShopId = 'VN_18471';
            }
        }

        // Lưu hoặc Cập nhật token vào cơ sở dữ liệu
        $stmt = $db->prepare("INSERT INTO `tiktok_config` (shop_id, access_token, refresh_token, expires_at, app_key, app_secret) 
            VALUES (:shop_id, :access_token, :refresh_token, :expires_at, :app_key, :app_secret)
            ON DUPLICATE KEY UPDATE 
            access_token = VALUES(access_token), 
            refresh_token = VALUES(refresh_token), 
            expires_at = VALUES(expires_at),
            app_key = VALUES(app_key),
            app_secret = VALUES(app_secret)");
        
        $stmt->execute([
            ':shop_id' => $finalShopId,
            ':access_token' => $accessToken,
            ':refresh_token' => $refreshToken,
            ':expires_at' => $expiresAt,
            ':app_key' => TIKTOK_APP_KEY,
            ':app_secret' => TIKTOK_APP_SECRET
        ]);

        // Trả về JSON nếu yêu cầu từ API (fetch), ngược lại chuyển hướng trình duyệt
        $format = isset($_GET['format']) ? $_GET['format'] : 'redirect';
        if ($format === 'json') {
            echo json_encode([
                'success' => true,
                'shop_id' => $finalShopId,
                'message' => 'Kết nối cửa hàng thành công!'
            ]);
            exit;
        } else {
            $redirectHomeUrl = "../?code=" . urlencode($code) . "&shop_id=" . urlencode($finalShopId);
            header("Location: " . $redirectHomeUrl);
            exit;
        }

    } catch (Exception $e) {
        sanitizeErrorResponse($e, 'Lỗi lưu thông tin cấu hình');
        exit;
    }
}

// Cập nhật API key của Gemini
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $authUser = requireAuth('admin:all');
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['action']) && $input['action'] === 'save_gemini_key') {
        $geminiKey = trim($input['gemini_api_key'] ?? '');
        try {
            $db = getDBConnection();
            
            // Tìm xem có cấu hình nào chưa
            $configExists = $db->query("SELECT COUNT(*) FROM `tiktok_config`")->fetchColumn();
            if ($configExists == 0) {
                // Nếu chưa kết nối shop nào, chèn 1 cấu hình rỗng nhưng có gemini key
                $stmt = $db->prepare("INSERT INTO `tiktok_config` (shop_id, gemini_api_key) VALUES ('', :gkey)");
                $stmt->execute([':gkey' => $geminiKey]);
            } else {
                $stmt = $db->prepare("UPDATE `tiktok_config` SET gemini_api_key = :gkey");
                $stmt->execute([':gkey' => $geminiKey]);
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Lưu khóa API Gemini thành công!'
            ]);
        } catch (Exception $e) {
            sanitizeErrorResponse($e, 'Lỗi lưu khóa API');
        }
        exit;
    }
}

// Endpoint GET đơn giản lấy cấu hình hiện tại
$authUser = requireAuth('admin:all');
try {
    $db = getDBConnection();
    $config = $db->query("SELECT shop_id, advertiser_id, gemini_api_key, updated_at FROM `tiktok_config` ORDER BY id DESC LIMIT 1")->fetch();
    
    echo json_encode([
        'success' => true,
        'connected' => ($config && $config['shop_id'] !== '') ? true : false,
        'shop_id' => ($config && $config['shop_id'] !== '') ? $config['shop_id'] : null,
        'advertiser_id' => $config ? $config['advertiser_id'] : null,
        'gemini_api_key' => $config ? $config['gemini_api_key'] : null,
        'updated_at' => $config ? $config['updated_at'] : null
    ]);
} catch (Exception $e) {
    sanitizeErrorResponse($e, 'Lỗi lấy thông tin cấu hình');
}
