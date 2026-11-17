<?php
/**
 * ADDP Commerce Intelligence - Administrative Login Endpoint
 *
 * Implements server-side authentication using password_hash/password_verify
 * and generates a secure HMAC-SHA256 signed Bearer token.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_guard.php';

header('Content-Type: application/json; charset=utf-8');
handleCORS();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dữ liệu không hợp lệ'], JSON_UNESCAPED_UNICODE);
    exit;
}

$username = isset($input['username']) ? trim((string)$input['username']) : '';
$password = isset($input['password']) ? (string)$input['password'] : '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Vui lòng nhập tài khoản và mật khẩu'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 1. Verify username with timing-safe comparison
$userMatches = hash_equals(ADMIN_USER, $username);

// 2. Verify password securely
$passwordMatches = false;
if ($userMatches) {
    if (!empty(ADMIN_PASSWORD_HASH)) {
        $passwordMatches = password_verify($password, ADMIN_PASSWORD_HASH);
    } elseif (!empty(ADMIN_PASS)) {
        // Transitional fallback to plain comparison from ENV
        $passwordMatches = hash_equals(ADMIN_PASS, $password);
    }
}

if ($userMatches && $passwordMatches) {
    try {
        $token = generateSignedToken([
            'sub' => $username,
            'scope' => 'admin:all'
        ], 604800); // 7 days

        echo json_encode([
            'success' => true,
            'message' => 'Đăng nhập thành công!',
            'token' => $token,
            'username' => $username
        ], JSON_UNESCAPED_UNICODE);
    } catch (\Throwable $e) {
        sanitizeErrorResponse($e, 'Lỗi tạo phiên đăng nhập. Vui lòng kiểm tra cấu hình máy chủ.');
    }
} else {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Sai tài khoản hoặc mật khẩu đăng nhập!'
    ], JSON_UNESCAPED_UNICODE);
}
