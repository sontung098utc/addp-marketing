<?php
require_once __DIR__ . '/auth_guard.php';
handleCORS();
$authUser = requireAuth('admin:all');

// Endpoint hỗ trợ tải xuống file tiện ích mở rộng Chrome Extension (.zip)
$zipFile = __DIR__ . '/../tiktok_audit_extension.zip';
if (!file_exists($zipFile)) {
    // Thử tìm trong cùng thư mục public
    $zipFile = dirname(__DIR__) . '/tiktok_audit_extension.zip';
}

if (file_exists($zipFile)) {
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="tiktok_audit_extension.zip"');
    header('Content-Length: ' . filesize($zipFile));
    header('Pragma: no-cache');
    header('Expires: 0');
    readfile($zipFile);
    exit;
} else {
    header('HTTP/1.1 404 Not Found');
    echo "File extension không tồn tại.";
    exit;
}
