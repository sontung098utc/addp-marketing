<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE V2 - TIKTOK SHOP SECURE WEBHOOK INGESTION
 * File: public/api/webhook.php
 * Target: P0 Webhook Database-First Architecture (P0-W2)
 *
 * Security & Data Quality:
 * - Fail-closed HMAC-SHA256 signature verification across TikTok standards
 * - Anti-replay timestamp check (|timestamp - now| <= 300s)
 * - Payload size limit (1MB)
 * - Durable inbox deduplication (commerce_webhook_events)
 * - Status Precedence Matrix (no stale overwriting)
 * - Zero fabricated revenue: authentic platform values only
 * - Direct Commerce V2 upsert (commerce_orders, RMA, loss ledger)
 * ====================================================================
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/commerce_webhook_service.php';

header('Content-Type: application/json; charset=utf-8');

// 1. Phản hồi thăm dò trạng thái (GET Health Probe) hoặc chỉ chấp nhận POST cho Webhook Events
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'TikTok Shop Webhook Endpoint Ready (POST only)',
        'timestamp' => time()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['code' => 405, 'message' => 'Method Not Allowed']);
    exit;
}

// 2. Nhận dữ liệu thô (Raw Body) từ Request với giới hạn kích thước
$rawBody = file_get_contents('php://input');
if ($rawBody === false || strlen($rawBody) === 0) {
    http_response_code(400);
    echo json_encode(['code' => 400, 'message' => 'Bad Request: Empty Body']);
    exit;
}

if (strlen($rawBody) > CommerceWebhookService::MAX_PAYLOAD_BYTES) {
    http_response_code(413);
    echo json_encode(['code' => 413, 'message' => 'Payload Too Large: Exceeds 1MB limit']);
    exit;
}

// 3. Lấy các Header phục vụ xác minh chữ ký từ TikTok
$headers = function_exists('apache_request_headers') ? apache_request_headers() : (function_exists('getallheaders') ? getallheaders() : []);

$signature = $headers['Authorization'] 
    ?? $headers['authorization'] 
    ?? $headers['event-signature'] 
    ?? $headers['Event-Signature'] 
    ?? $_SERVER['HTTP_AUTHORIZATION'] 
    ?? $_SERVER['HTTP_EVENT_SIGNATURE'] 
    ?? null;

$rawTimestamp = $headers['Timestamp'] 
    ?? $headers['timestamp'] 
    ?? $headers['x-tts-timestamp'] 
    ?? $_SERVER['HTTP_TIMESTAMP'] 
    ?? null;

$timestamp = ($rawTimestamp !== null && is_numeric($rawTimestamp)) ? (int)$rawTimestamp : null;
$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/api/webhook.php', PHP_URL_PATH);

// 4. Phân tích gói tin Webhook JSON
$data = json_decode($rawBody, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['code' => 400, 'message' => 'Bad Request: Invalid JSON']);
    exit;
}

// 5. Khởi tạo và thực thi qua CommerceWebhookService
try {
    $db = getDBConnection();
    $webhookService = new CommerceWebhookService($db);
    $result = $webhookService->processEvent($data, $rawBody, $signature, $timestamp, $uriPath);

    $httpCode = $result['http_status'] ?? 200;
    http_response_code($httpCode);

    echo json_encode([
        'code' => $result['code'],
        'message' => $result['message'],
        'event_id' => $result['event_id'] ?? null
    ], JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    sanitizeErrorResponse($e, 'Lỗi xử lý sự kiện webhook');
}
