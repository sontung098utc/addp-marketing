<?php
/**
 * ADDP Commerce Intelligence - Extension Connector Authorization & Token Gateway
 *
 * Implements:
 * 1. Action 'create_pairing': Generates short-lived (5 min), single-use pairing code for admin.
 * 2. Action 'redeem_pairing': Exchanges pairing credential for a 24-hour scoped connector token
 *    and establishes a server-side connector session.
 * 3. Action 'revoke': Invalidates a connector session server-side immediately.
 * 4. Action 'status': Checks active connector session status.
 *
 * SECURITY GUARANTEES:
 * - Plaintext pairing secrets are NEVER persisted in the database; only SHA-256 hashes are stored.
 * - Pairing credentials are strictly single-use and rate-limited.
 * - Never logs authorization headers, pairing secrets, or connector tokens.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_guard.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
handleCORS();

$db = getDBConnection();
$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // =========================================================================
    // ACTION: create_pairing (Admin Session Required)
    // =========================================================================
    if ($action === 'create_pairing') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'code' => 'METHOD_NOT_ALLOWED', 'message' => 'Yêu cầu phương thức POST'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 1. Enforce strict Administrative authentication
        $authUser = requireAuth('admin:all');

        $raw = file_get_contents('php://input');
        $body = json_decode($raw, true) ?? $_POST;

        // 2. Identify target shop_id
        $targetShopId = trim((string)($body['shop_id'] ?? ''));
        if (empty($targetShopId)) {
            $stmtShop = $db->query("SELECT shop_id FROM `tiktok_config` WHERE shop_id IS NOT NULL AND shop_id != '' ORDER BY updated_at DESC LIMIT 1");
            $targetShopId = (string)($stmtShop->fetchColumn() ?: '');
        }

        if (empty($targetShopId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'code' => 'SHOP_NOT_FOUND', 'message' => 'Không tìm thấy gian hàng nào được cấu hình.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Verify shop existence in tiktok_config
        $checkShop = $db->prepare("SELECT COUNT(*) FROM `tiktok_config` WHERE `shop_id` = ?");
        $checkShop->execute([$targetShopId]);
        if ((int)$checkShop->fetchColumn() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'code' => 'SHOP_NOT_EXIST', 'message' => 'Gian hàng yêu cầu không tồn tại trên hệ thống.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 3. Rate limiting: Max 10 pairing tokens created per 60 seconds
        try {
            $checkRate = $db->prepare("SELECT COUNT(*) FROM `tiktok_connector_pairings` WHERE `shop_id` = ? AND `created_at` > (NOW() - INTERVAL 60 SECOND)");
            $checkRate->execute([$targetShopId]);
            if ((int)$checkRate->fetchColumn() >= 10) {
                http_response_code(429);
                echo json_encode(['success' => false, 'code' => 'RATE_LIMITED', 'message' => 'Quá nhiều yêu cầu tạo mã ghép nối. Vui lòng chờ 1 phút.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
        } catch (PDOException $e) {
            // Table might not exist yet if migration hasn't been executed
        }

        // 4. Generate high-entropy pairing credential (5-minute TTL)
        $pairing = generatePairingToken($targetShopId, PAIRING_TOKEN_TTL);

        // 5. Store ONLY SHA-256 hash in database (NEVER store plaintext secret)
        $stmtInsert = $db->prepare("INSERT INTO `tiktok_connector_pairings` 
            (`pairing_hash`, `shop_id`, `expires_at`, `created_at`) 
            VALUES (?, ?, ?, NOW())");
        $stmtInsert->execute([
            $pairing['pairing_hash'],
            $targetShopId,
            $pairing['expires_at']
        ]);

        error_log("[SECURITY] Pairing authorization code issued for shop: " . $targetShopId . " by admin: " . ($authUser['sub'] ?? 'admin'));

        echo json_encode([
            'success' => true,
            'message' => 'Tạo mã ghép nối tiện ích thành công!',
            'pairing_token' => $pairing['token'],
            'pairing_code' => $pairing['code'],
            'expires_in' => PAIRING_TOKEN_TTL,
            'shop_id' => $targetShopId
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================================
    // ACTION: redeem_pairing (Public Extension Redemption)
    // =========================================================================
    if ($action === 'redeem_pairing') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'code' => 'METHOD_NOT_ALLOWED', 'message' => 'Yêu cầu phương thức POST'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $raw = file_get_contents('php://input');
        $body = json_decode($raw, true) ?? $_POST;

        $pairingToken = trim((string)($body['pairing_token'] ?? ''));
        $pairingCode = trim((string)($body['pairing_code'] ?? ''));

        if (empty($pairingToken) && empty($pairingCode)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'code' => 'MISSING_CREDENTIAL', 'message' => 'Vui lòng cung cấp mã ghép nối hoặc token ghép nối.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $pairingHash = '';
        $shopIdFromToken = '';

        if (!empty($pairingToken)) {
            // Verify signed pairing token
            $claims = verifySignedToken($pairingToken);
            if ($claims === null) {
                http_response_code(401);
                echo json_encode(['success' => false, 'code' => 'INVALID_PAIRING_TOKEN', 'message' => 'Token ghép nối không hợp lệ hoặc đã hết hạn.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if (($claims['scope'] ?? '') !== 'connector:pair') {
                http_response_code(403);
                echo json_encode(['success' => false, 'code' => 'FORBIDDEN_SCOPE', 'message' => 'Phạm vi xác thực của token không hợp lệ.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if ((int)($claims['exp'] ?? 0) <= time()) {
                http_response_code(401);
                echo json_encode(['success' => false, 'code' => 'PAIRING_EXPIRED', 'message' => 'Mã ghép nối đã hết hạn (5 phút). Vui lòng tạo mã mới.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $pairingHash = (string)($claims['pairing_hash'] ?? '');
            $shopIdFromToken = (string)($claims['shop_id'] ?? '');
        } else {
            // Manual pairing code entered (e.g. PAIR-XXXX-YYYY-ZZZZ)
            $cleanCode = strtoupper(trim($pairingCode));
            $pairingHash = hash('sha256', $cleanCode);
        }

        if (empty($pairingHash)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'code' => 'INVALID_PAIRING_HASH', 'message' => 'Không thể xác định mã băm ghép nối.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Atomically burn the pairing code (Single-Use Enforcement)
        $now = time();
        $stmtRedeem = $db->prepare("UPDATE `tiktok_connector_pairings` 
            SET `redeemed_at` = NOW() 
            WHERE `pairing_hash` = ? AND `redeemed_at` IS NULL AND `expires_at` > ?");
        $stmtRedeem->execute([$pairingHash, $now]);

        if ($stmtRedeem->rowCount() === 0) {
            // Check why redemption failed
            $stmtCheck = $db->prepare("SELECT * FROM `tiktok_connector_pairings` WHERE `pairing_hash` = ? LIMIT 1");
            $stmtCheck->execute([$pairingHash]);
            $pairingRow = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            if ($pairingRow) {
                if (!empty($pairingRow['redeemed_at'])) {
                    http_response_code(409);
                    echo json_encode(['success' => false, 'code' => 'PAIRING_ALREADY_REDEEMED', 'message' => 'Mã ghép nối này đã được sử dụng trước đó. Vui lòng tạo mã mới.'], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                if ((int)$pairingRow['expires_at'] <= $now) {
                    http_response_code(401);
                    echo json_encode(['success' => false, 'code' => 'PAIRING_EXPIRED', 'message' => 'Mã ghép nối đã hết thời hạn hiệu lực (5 phút). Vui lòng tạo mã mới.'], JSON_UNESCAPED_UNICODE);
                    exit;
                }
            }

            http_response_code(401);
            echo json_encode(['success' => false, 'code' => 'INVALID_PAIRING_CREDENTIAL', 'message' => 'Mã ghép nối không hợp lệ hoặc không tồn tại.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Retrieve shop_id bound to this pairing
        $stmtGetShop = $db->prepare("SELECT `shop_id` FROM `tiktok_connector_pairings` WHERE `pairing_hash` = ? LIMIT 1");
        $stmtGetShop->execute([$pairingHash]);
        $targetShopId = (string)($stmtGetShop->fetchColumn() ?: $shopIdFromToken);

        // Fetch shop name if available
        $shopName = 'Dược Phẩm ADDP';
        try {
            $stmtName = $db->prepare("SELECT shop_name FROM `tiktok_config` WHERE `shop_id` = ? LIMIT 1");
            $stmtName->execute([$targetShopId]);
            $dbName = $stmtName->fetchColumn();
            if (!empty($dbName)) $shopName = $dbName;
        } catch (Exception $e) {}

        // Create 24-hour server-side connector session & cryptographic Bearer token
        $connectorId = 'ext_' . bin2hex(random_bytes(16));
        $tokenData = generateConnectorToken($targetShopId, $connectorId, CONNECTOR_TOKEN_TTL);

        $stmtSess = $db->prepare("INSERT INTO `tiktok_connector_sessions` 
            (`connector_id`, `shop_id`, `token_jti_hash`, `status`, `expires_at`, `created_at`) 
            VALUES (?, ?, ?, 'active', ?, NOW())");
        $stmtSess->execute([
            $connectorId,
            $targetShopId,
            $tokenData['token_jti_hash'],
            $tokenData['expires_at']
        ]);

        error_log("[SECURITY] Connector session created: {$connectorId} for shop: {$targetShopId}");

        echo json_encode([
            'success' => true,
            'message' => 'Ghép nối tiện ích thành công!',
            'connector_token' => $tokenData['token'],
            'connector_id' => $connectorId,
            'expires_at' => $tokenData['expires_at'],
            'shop_id' => $targetShopId,
            'shop_name' => $shopName
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================================
    // ACTION: revoke (Admin or Self Connector Revocation)
    // =========================================================================
    if ($action === 'revoke') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'code' => 'METHOD_NOT_ALLOWED', 'message' => 'Yêu cầu phương thức POST'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $raw = file_get_contents('php://input');
        $body = json_decode($raw, true) ?? $_POST;
        $targetConnectorId = trim((string)($body['connector_id'] ?? ''));

        // Check caller identity
        $callerToken = getAuthBearerToken();
        if ($callerToken === null) {
            http_response_code(401);
            echo json_encode(['success' => false, 'code' => 'UNAUTHORIZED', 'message' => 'Yêu cầu Bearer token để thu hồi kết nối.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $claims = verifySignedToken($callerToken);
        if ($claims === null) {
            http_response_code(401);
            echo json_encode(['success' => false, 'code' => 'INVALID_TOKEN', 'message' => 'Khóa xác thực không hợp lệ.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $callerScope = $claims['scope'] ?? '';
        $callerConnectorId = $claims['connector_id'] ?? '';

        if ($callerScope === 'admin:all') {
            // Admin can revoke any specific connector or all connectors for a shop
            if (!empty($targetConnectorId)) {
                $stmtRevoke = $db->prepare("UPDATE `tiktok_connector_sessions` SET `status` = 'revoked', `revoked_at` = NOW() WHERE `connector_id` = ?");
                $stmtRevoke->execute([$targetConnectorId]);
            } else {
                $targetShopId = trim((string)($body['shop_id'] ?? ''));
                if (!empty($targetShopId)) {
                    $stmtRevoke = $db->prepare("UPDATE `tiktok_connector_sessions` SET `status` = 'revoked', `revoked_at` = NOW() WHERE `shop_id` = ?");
                    $stmtRevoke->execute([$targetShopId]);
                }
            }
        } elseif ($callerScope === 'seller_center:sync') {
            // Connector can revoke only its own session
            $stmtRevoke = $db->prepare("UPDATE `tiktok_connector_sessions` SET `status` = 'revoked', `revoked_at` = NOW() WHERE `connector_id` = ?");
            $stmtRevoke->execute([$callerConnectorId]);
        } else {
            http_response_code(403);
            echo json_encode(['success' => false, 'code' => 'FORBIDDEN', 'message' => 'Bạn không có quyền thu hồi kết nối này.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        error_log("[SECURITY] Connector session revoked. Target: " . ($targetConnectorId ?: 'all for shop'));

        echo json_encode([
            'success' => true,
            'message' => 'Đã thu hồi phiên kết nối tiện ích thành công!',
            'revoked_at' => date('Y-m-d H:i:s')
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================================
    // ACTION: status (Probe Connector Session Health)
    // =========================================================================
    if ($action === 'status') {
        $claims = requireConnectorAuth();
        echo json_encode([
            'success' => true,
            'status' => 'active',
            'shop_id' => $claims['shop_id'] ?? '',
            'connector_id' => $claims['connector_id'] ?? '',
            'expires_at' => $claims['exp'] ?? 0,
            'server_time' => time()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Default: Invalid Action
    http_response_code(400);
    echo json_encode(['success' => false, 'code' => 'INVALID_ACTION', 'message' => 'Action không hợp lệ.'], JSON_UNESCAPED_UNICODE);
    exit;

} catch (\Throwable $e) {
    sanitizeErrorResponse($e, 'Có lỗi xảy ra trong quá trình xử lý khóa kết nối.');
}
