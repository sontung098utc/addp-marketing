<?php
/**
 * ADDP Commerce Intelligence - Security & Authentication Guard Middleware
 *
 * Implements:
 * 1. Strict Origin / CORS validation (decoupled from authentication)
 * 2. Dedicated HMAC-SHA256 Bearer Token verification with claims (iss, sub, iat, exp, nonce, scope)
 * 3. Timing-safe verification via hash_equals()
 * 4. Header-only Bearer token extraction (NO query parameter token accepted)
 * 5. Production error redaction
 */

require_once __DIR__ . '/config.php';

if (!function_exists('handleCORS')) {
    function handleCORS(): void {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = false;

        if (empty($origin)) {
            // Direct request from same origin or server-to-server
            $allowed = true;
        } elseif ($origin === APP_URL) {
            $allowed = true;
        } elseif (APP_ENV !== 'production') {
            // Localhost origins are permitted ONLY outside production
            if (
                preg_match('/^https?:\/\/localhost(:\d+)?$/i', $origin) ||
                preg_match('/^https?:\/\/127\.0\.0\.1(:\d+)?$/i', $origin)
            ) {
                $allowed = true;
            }
        }

        // Note: Chrome extension requests to sync_seller_center will be validated by endpoint
        if (strpos($origin, 'chrome-extension://') === 0) {
            $allowed = true;
        }

        if ($allowed && !empty($origin)) {
            header("Access-Control-Allow-Origin: {$origin}");
            header("Access-Control-Allow-Credentials: true");
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

        // Handle preflight OPTIONS request
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
}

if (!function_exists('base64UrlEncode')) {
    function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

if (!function_exists('base64UrlDecode')) {
    function base64UrlDecode(string $data): ?string {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $padLen = 4 - $remainder;
            $data .= str_repeat('=', $padLen);
        }
        $decoded = base64_decode(strtr($data, '-_', '+/'), true);
        return $decoded === false ? null : $decoded;
    }
}

if (!function_exists('generateSignedToken')) {
    function generateSignedToken(array $customClaims, int $ttl = 604800): string {
        $signingKey = AUTH_SIGNING_KEY;
        if (empty($signingKey)) {
            throw new RuntimeException("AUTH_SIGNING_KEY is not configured.");
        }

        $now = time();
        $payload = array_merge([
            'iss' => APP_URL,
            'sub' => $customClaims['sub'] ?? ADMIN_USER,
            'iat' => $now,
            'exp' => $now + $ttl,
            'nonce' => bin2hex(random_bytes(16)),
            'scope' => $customClaims['scope'] ?? 'admin:all'
        ], $customClaims);

        $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $encodedPayload = base64UrlEncode($payloadJson);
        $signature = hash_hmac('sha256', $encodedPayload, $signingKey);

        return "{$encodedPayload}.{$signature}";
    }
}

if (!function_exists('verifySignedToken')) {
    function verifySignedToken(string $token): ?array {
        $signingKey = AUTH_SIGNING_KEY;
        if (empty($signingKey) || empty($token)) {
            return null;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }

        list($encodedPayload, $providedSignature) = $parts;

        // Timing-safe HMAC verification
        $expectedSignature = hash_hmac('sha256', $encodedPayload, $signingKey);
        if (!hash_equals($expectedSignature, $providedSignature)) {
            return null;
        }

        $rawJson = base64UrlDecode($encodedPayload);
        if ($rawJson === null) {
            return null;
        }

        $payload = json_decode($rawJson, true);
        if (!is_array($payload)) {
            return null;
        }

        // Validate all standard claims
        $now = time();

        // 1. Expiration
        if (!isset($payload['exp']) || !is_numeric($payload['exp']) || $payload['exp'] < $now) {
            return null; // Expired token
        }

        // 2. Issued At (allow 60 seconds clock skew)
        if (!isset($payload['iat']) || !is_numeric($payload['iat']) || $payload['iat'] > ($now + 60)) {
            return null; // Future token
        }

        // 3. Issuer verification
        if (!isset($payload['iss']) || $payload['iss'] !== APP_URL) {
            return null; // Invalid issuer
        }

        // 4. Subject verification
        if (empty($payload['sub'])) {
            return null; // Missing subject
        }

        return $payload;
    }
}

if (!function_exists('getAuthBearerToken')) {
    /**
     * Extracts Bearer token strictly from HTTP Request Headers.
     * Tokens in query parameters (?auth_token=...) are strictly prohibited.
     */
    function getAuthBearerToken(): ?string {
        $headerValue = null;

        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headerValue = trim($_SERVER['HTTP_AUTHORIZATION']);
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $headerValue = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
        } elseif (isset($_SERVER['Authorization'])) {
            $headerValue = trim($_SERVER['Authorization']);
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            foreach ($headers as $name => $value) {
                if (strcasecmp($name, 'Authorization') === 0) {
                    $headerValue = trim($value);
                    break;
                }
            }
        }

        if (!empty($headerValue) && preg_match('/^Bearer\s+(\S+)$/i', $headerValue, $matches)) {
            return $matches[1];
        }

        return null;
    }
}

if (!function_exists('requireAuth')) {
    function requireAuth(?string $requiredScope = null): array {
        handleCORS();

        $token = getAuthBearerToken();
        if ($token === null) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'code' => 'UNAUTHORIZED',
                'message' => 'Yêu cầu đăng nhập. Không tìm thấy Authorization Bearer token.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $claims = verifySignedToken($token);
        if ($claims === null) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'code' => 'INVALID_TOKEN',
                'message' => 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Validate scope authorization if required
        if ($requiredScope !== null) {
            $userScope = $claims['scope'] ?? '';
            $hasScope = ($userScope === 'admin:all') || ($userScope === $requiredScope);
            if (!$hasScope) {
                http_response_code(403);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success' => false,
                    'code' => 'FORBIDDEN',
                    'message' => 'Bạn không có quyền hạn truy cập tài nguyên này.'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        return $claims;
    }
}

if (!function_exists('generatePairingToken')) {
    /**
     * Generates a short-lived single-use Pairing Authorization Token and human-readable pairing code.
     * The plaintext secret is returned only to the caller; only its SHA-256 hash is persisted.
     */
    function generatePairingToken(string $shopId, int $ttl = PAIRING_TOKEN_TTL): array {
        $rawHex = bin2hex(random_bytes(4)) . bin2hex(random_bytes(4)); // 16 hex chars
        $pairingCode = 'PAIR-' . strtoupper(substr($rawHex, 0, 4)) . '-' . strtoupper(substr($rawHex, 4, 4)) . '-' . strtoupper(substr($rawHex, 8, 4));
        $pairingHash = hash('sha256', $pairingCode);

        $now = time();
        $payload = [
            'iss' => APP_URL,
            'sub' => 'pairing:seller_center',
            'scope' => 'connector:pair',
            'shop_id' => $shopId,
            'pairing_hash' => $pairingHash,
            'iat' => $now,
            'exp' => $now + $ttl,
            'nonce' => bin2hex(random_bytes(16))
        ];

        $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $encodedPayload = base64UrlEncode($payloadJson);
        $signature = hash_hmac('sha256', $encodedPayload, AUTH_SIGNING_KEY);
        $token = "{$encodedPayload}.{$signature}";

        return [
            'token' => $token,
            'code' => $pairingCode,
            'pairing_hash' => $pairingHash,
            'expires_at' => $now + $ttl
        ];
    }
}

if (!function_exists('generateConnectorToken')) {
    /**
     * Generates a 24-hour scoped Connector Bearer Token and records its JTI hash.
     */
    function generateConnectorToken(string $shopId, string $connectorId, int $ttl = CONNECTOR_TOKEN_TTL): array {
        $now = time();
        $jti = bin2hex(random_bytes(16));
        $jtiHash = hash('sha256', $jti);

        $payload = [
            'iss' => APP_URL,
            'sub' => 'connector:seller_center',
            'scope' => 'seller_center:sync',
            'shop_id' => $shopId,
            'connector_id' => $connectorId,
            'jti' => $jti,
            'iat' => $now,
            'exp' => $now + $ttl,
            'nonce' => bin2hex(random_bytes(16))
        ];

        $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $encodedPayload = base64UrlEncode($payloadJson);
        $signature = hash_hmac('sha256', $encodedPayload, AUTH_SIGNING_KEY);
        $token = "{$encodedPayload}.{$signature}";

        return [
            'token' => $token,
            'jti' => $jti,
            'token_jti_hash' => $jtiHash,
            'expires_at' => $now + $ttl,
            'connector_id' => $connectorId
        ];
    }
}

if (!function_exists('requireConnectorAuth')) {
    /**
     * Strictly verifies Connector Bearer Token and active server-side session.
     * Enforces:
     * 1. Header-only Bearer token
     * 2. Timing-safe cryptographic HMAC-SHA256 signature verification
     * 3. Scope strictly equal to 'seller_center:sync' (rejects admin tokens)
     * 4. Expiration check (< 24h)
     * 5. Active server-side connector session check in database
     * 6. Token JTI hash timing-safe match
     * 7. Shop binding check
     */
    function requireConnectorAuth(?string $expectedShopId = null, ?PDO $pdo = null): array {
        handleCORS();

        $token = getAuthBearerToken();
        if ($token === null) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'code' => 'MISSING_TOKEN',
                'message' => 'Yêu cầu khóa xác thực tiện ích. Không tìm thấy Authorization Bearer token.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $claims = verifySignedToken($token);
        if ($claims === null) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'code' => 'INVALID_TOKEN',
                'message' => 'Khóa kết nối tiện ích không hợp lệ hoặc đã hết hạn.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 1. Strict Scope Check: MUST be 'seller_center:sync' (admin tokens are rejected)
        $userScope = $claims['scope'] ?? '';
        if ($userScope !== 'seller_center:sync') {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'code' => 'FORBIDDEN_SCOPE',
                'message' => 'Khóa xác thực không có quyền hạn đồng bộ Seller Center.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 2. Strict Shop ID Match Check (if expectedShopId is provided)
        $tokenShopId = (string)($claims['shop_id'] ?? '');
        if ($expectedShopId !== null && $tokenShopId !== $expectedShopId) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'code' => 'SHOP_MISMATCH',
                'message' => 'Khóa kết nối không thuộc gian hàng được yêu cầu.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 3. Server-Side Connector Session Verification (PO Correction 3)
        $connectorId = (string)($claims['connector_id'] ?? '');
        if (empty($connectorId)) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'code' => 'INVALID_CONNECTOR_ID',
                'message' => 'Khóa kết nối thiếu thông tin định danh tiện ích.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $db = $pdo ?? getDBConnection();
            $stmt = $db->prepare("SELECT * FROM `tiktok_connector_sessions` WHERE `connector_id` = ? LIMIT 1");
            $stmt->execute([$connectorId]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$session) {
                http_response_code(401);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success' => false,
                    'code' => 'CONNECTOR_SESSION_NOT_FOUND',
                    'message' => 'Phiên kết nối của tiện ích không tồn tại trên hệ thống.'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if ($session['status'] !== 'active' || !empty($session['revoked_at'])) {
                http_response_code(401);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success' => false,
                    'code' => 'CONNECTOR_REVOKED',
                    'message' => 'Khóa kết nối đã bị thu hồi. Vui lòng kết nối lại tiện ích.'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if ((int)$session['expires_at'] < time()) {
                http_response_code(401);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success' => false,
                    'code' => 'CONNECTOR_SESSION_EXPIRED',
                    'message' => 'Phiên kết nối trên máy chủ đã hết hạn. Vui lòng kết nối lại tiện ích.'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if ($session['shop_id'] !== $tokenShopId) {
                http_response_code(403);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success' => false,
                    'code' => 'SHOP_MISMATCH',
                    'message' => 'Gian hàng trên phiên kết nối máy chủ không khớp.'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Timing-safe verification of Token JTI Hash
            $providedJti = (string)($claims['jti'] ?? '');
            $computedJtiHash = hash('sha256', $providedJti);
            if (!hash_equals((string)$session['token_jti_hash'], $computedJtiHash)) {
                http_response_code(401);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success' => false,
                    'code' => 'INVALID_TOKEN_JTI',
                    'message' => 'Định danh khóa kết nối không hợp lệ.'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Update last_used_at on active session
            $upd = $db->prepare("UPDATE `tiktok_connector_sessions` SET `last_used_at` = NOW() WHERE `id` = ?");
            $upd->execute([$session['id']]);

        } catch (PDOException $e) {
            sanitizeErrorResponse($e, 'Lỗi xác thực phiên kết nối tiện ích trên máy chủ.');
        }

        return $claims;
    }
}


if (!function_exists('sanitizeErrorResponse')) {
    function sanitizeErrorResponse(\Throwable $e, string $publicFallback = 'Có lỗi xảy ra trong quá trình xử lý'): void {
        // Redact potential secrets before logging
        $rawMsg = $e->getMessage();
        $redactedMsg = preg_replace('/(password|pass|secret|token|key)[:=]\s*([^\s&)]+)/i', '$1=REDACTED', $rawMsg);
        error_log("[ERROR] " . get_class($e) . ": " . $redactedMsg . " at " . $e->getFile() . ":" . $e->getLine());


        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');

        if (APP_ENV === 'production' && !APP_DEBUG) {
            echo json_encode([
                'success' => false,
                'code' => 'INTERNAL_SERVER_ERROR',
                'message' => $publicFallback
            ], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode([
                'success' => false,
                'code' => 'INTERNAL_SERVER_ERROR',
                'message' => $redactedMsg
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
}
