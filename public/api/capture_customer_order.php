<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - REAL-TIME CUSTOMER & ORDER CAPTURE
 * File: public/api/capture_customer_order.php
 * Target: Real-time Ingestion of Unmasked Recipient PII (Name, Phone, Address)
 *         Directly from TikTok Shop Seller Center via Chrome Extension.
 *
 * Captures active orders (Awaiting Shipment / In Transit) before TikTok locks
 * and permanently masks customer contact information upon completion.
 * ====================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_guard.php';
require_once __DIR__ . '/commerce_customer_service.php';

handleCORS();

// Authentication Guard: Supports Connector Bearer token or Admin Bearer token
$bearerToken = getAuthBearerToken();
$callerClaims = null;
if ($bearerToken !== null) {
    $callerClaims = verifySignedToken($bearerToken);
    if ($callerClaims === null) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'code' => 'INVALID_TOKEN',
            'message' => 'Khóa xác thực không hợp lệ hoặc đã hết hạn.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $scope = $callerClaims['scope'] ?? '';
    if ($scope !== 'seller_center:sync' && $scope !== 'admin:all') {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'code' => 'FORBIDDEN_SCOPE',
            'message' => 'Khóa xác thực không có quyền truy cập API này.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
} else {
    // If no bearer token provided, check transitional unauthenticated flag
    if (!defined('CONNECTOR_ALLOW_UNAUTHENTICATED') || !CONNECTOR_ALLOW_UNAUTHENTICATED) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'code' => 'MISSING_TOKEN',
            'message' => 'Yêu cầu khóa xác thực tiện ích. Vui lòng kết nối lại tiện ích.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

$db = getDBConnection();

// Action: Query list of already captured/unmasked order IDs
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? '';
    if ($action === 'get_unmasked_order_ids') {
        $shopId = trim((string)($_GET['shop_id'] ?? '7495657895504611503'));
        try {
            $stmt = $db->prepare("SELECT platform_order_id FROM `commerce_order_recipients` 
                WHERE platform = 'tiktok_shop' AND shop_id = ? 
                AND phone_raw IS NOT NULL AND phone_raw != '' AND phone_raw NOT LIKE '%*%'");
            $stmt->execute([$shopId]);
            $orderIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
            echo json_encode([
                'success' => true,
                'count' => count($orderIds),
                'order_ids' => $orderIds
            ], JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $t) {
            echo json_encode(['success' => false, 'order_ids' => [], 'error' => $t->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Yêu cầu phương thức POST'], JSON_UNESCAPED_UNICODE);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dữ liệu JSON không hợp lệ'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 1. Resolve Target Shop ID
$shopId = trim((string)($data['shop_id'] ?? ''));
if ($shopId === '') {
    try {
        $stmtShop = $db->query("SELECT shop_id FROM `tiktok_config` WHERE shop_id IS NOT NULL AND shop_id != '' ORDER BY updated_at DESC LIMIT 1");
        $shopId = (string)($stmtShop->fetchColumn() ?: '');
    } catch (\Throwable $t) {}
}

if ($shopId === '') {
    $shopId = '7495657895504611503'; // Default primary seller shop
}

// 2. Prepare orders list (supports both single order and array of orders)
$ordersInput = [];
if (isset($data['orders']) && is_array($data['orders'])) {
    $ordersInput = $data['orders'];
} elseif (!empty($data['platform_order_id']) || !empty($data['order_id']) || !empty($data['order_no'])) {
    $ordersInput = [$data];
}

if (empty($ordersInput)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Không tìm thấy thông tin đơn hàng trong yêu cầu'], JSON_UNESCAPED_UNICODE);
    exit;
}

$customerService = new CommerceCustomerService($db);

// Helper to normalize phone
function normalizeRawPhone(string $raw): string {
    $p = preg_replace('/[^\d+]/', '', $raw);
    if (str_starts_with($p, '+84')) {
        $p = '0' . substr($p, 3);
    } elseif (str_starts_with($p, '84') && strlen($p) >= 11) {
        $p = '0' . substr($p, 2);
    }
    return $p;
}

// Helper to mask phone for fallback
function maskRawPhone(string $phone): string {
    $digits = preg_replace('/\D/', '', $phone);
    if (strlen($digits) >= 10) {
        return substr($digits, 0, 4) . '****' . substr($digits, -2);
    }
    return '09******—';
}

// Helper to extract province/city from full address
function extractProvinceFromAddress(string $addr): string {
    $parts = array_map('trim', explode(',', $addr));
    if (count($parts) >= 2) {
        // Last part usually is Country (Việt Nam), second to last is Province/City
        $secondLast = $parts[count($parts) - 2];
        if (stripos($secondLast, 'Hà Nội') !== false) return 'Hà Nội';
        if (stripos($secondLast, 'Hồ Chí Minh') !== false || stripos($secondLast, 'TP HCM') !== false) return 'TP. Hồ Chí Minh';
        return $secondLast;
    }
    return 'Việt Nam';
}

$capturedCount = 0;
$capturedOrders = [];
$errors = [];

foreach ($ordersInput as $o) {
    $orderId = trim((string)($o['platform_order_id'] ?? $o['order_id'] ?? $o['order_no'] ?? ''));
    if ($orderId === '') {
        continue;
    }

    $recipientName = trim((string)($o['recipient_name'] ?? $o['name'] ?? ''));
    // Reject proxy emails, long hashes, and system labels
    if (
        strpos($recipientName, '@') !== false ||
        strpos($recipientName, '.com') !== false ||
        strpos($recipientName, '.vn') !== false ||
        preg_match('/^user\d+$/i', $recipientName) ||
        preg_match('/^\d+$/', $recipientName) ||
        preg_match('/^(liên hệ|gửi tin nhắn|sao chép|chi tiết|tiktok shop|người mua)/i', $recipientName) ||
        (strlen($recipientName) >= 14 && strpos($recipientName, ' ') === false) ||
        in_array(mb_strtolower($recipientName), ['chi tiết khách hàng', 'địa chỉ giao hàng', 'tên người dùng', 'khách hàng', 'khách hàng tiktok'])
    ) {
        $recipientName = '';
    }
    $phoneRaw = trim((string)($o['phone'] ?? $o['phone_number'] ?? $o['phone_raw'] ?? ''));
    $addressRaw = trim((string)($o['address'] ?? $o['address_raw'] ?? $o['shipping_address'] ?? ''));
    $orderStatus = trim((string)($o['order_status'] ?? $o['status'] ?? 'AWAITING_SHIPMENT'));
    $orderGross = isset($o['order_gross_amount']) ? (float)$o['order_gross_amount'] : (isset($o['amount']) ? (float)$o['amount'] : 0.0);
    $province = trim((string)($o['province'] ?? ''));
    $district = trim((string)($o['district'] ?? ''));
    $ward = trim((string)($o['ward'] ?? ''));

    if ($province === '' && $addressRaw !== '') {
        $province = extractProvinceFromAddress($addressRaw);
    }

    $orderTimeRaw = trim((string)($o['order_time'] ?? $o['created_at'] ?? $o['create_time'] ?? ''));
    $orderTimestamp = date('Y-m-d H:i:s');
    if ($orderTimeRaw !== '') {
        $parsedTime = strtotime($orderTimeRaw);
        if ($parsedTime !== false && $parsedTime > 0) {
            $orderTimestamp = date('Y-m-d H:i:s', $parsedTime);
        }
    }

    $normalizedPhone = normalizeRawPhone($phoneRaw);
    $phoneHash = null;
    if (!empty($normalizedPhone)) {
        try {
            $phoneHash = $customerService->hashPhoneNumber($normalizedPhone);
        } catch (\Throwable $ht) {
            $salt = defined('AUTH_SIGNING_KEY') && AUTH_SIGNING_KEY !== '' ? AUTH_SIGNING_KEY : 'addp_commerce_v2';
            $phoneHash = hash_hmac('sha256', 'phone:' . $normalizedPhone, $salt);
        }
    }
    if (empty($phoneHash)) {
        $salt = defined('AUTH_SIGNING_KEY') && AUTH_SIGNING_KEY !== '' ? AUTH_SIGNING_KEY : 'addp_commerce_v2';
        $phoneHash = hash_hmac('sha256', 'buyer:' . ($recipientName ?: $orderId), $salt);
    }
    $phoneMasked = !empty($phoneRaw) ? maskRawPhone($phoneRaw) : '09******—';
    if ($recipientName === '') {
        if (!empty($phoneRaw) && preg_match('/\d{4,}$/', preg_replace('/\D/', '', $phoneRaw), $mDigits)) {
            $recipientName = 'Khách hàng (' . substr($mDigits[0], -4) . ')';
        } else {
            $recipientName = 'Khách Hàng TikTok';
        }
        $nameMasked = $recipientName;
    } else {
        $nameMasked = CommerceCustomerService::maskName($recipientName);
    }

    // Dynamic table column detector for zero schema-mismatch errors
    static $colCache = [];
    $getTableCols = function(string $tbl) use ($db, &$colCache): array {
        if (isset($colCache[$tbl])) return $colCache[$tbl];
        try {
            $isSqlite = ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite');
            if ($isSqlite) {
                $stmt = $db->query("PRAGMA table_info(`{$tbl}`)");
                $cols = [];
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $cols[] = $row['name'];
                }
                $colCache[$tbl] = array_flip($cols);
            } else {
                $stmt = $db->query("SHOW COLUMNS FROM `{$tbl}`");
                $colCache[$tbl] = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));
            }
            return $colCache[$tbl];
        } catch (\Throwable $e) {
            return [];
        }
    };

    $recipCols = $getTableCols('commerce_order_recipients');
    $profCols  = $getTableCols('commerce_customer_profiles');
    $orderCols = $getTableCols('commerce_orders');

    try {
        // Check if this specific order was already ingested previously to ensure strict idempotency
        $isOrderAlreadyCaptured = false;
        try {
            $stmtCheckRecip = $db->prepare("SELECT 1 FROM `commerce_order_recipients` WHERE `platform` = 'tiktok_shop' AND `shop_id` = ? AND `platform_order_id` = ? LIMIT 1");
            $stmtCheckRecip->execute([$shopId, $orderId]);
            $isOrderAlreadyCaptured = (bool)$stmtCheckRecip->fetchColumn();
        } catch (\Throwable $e) {}

        // A. Upsert into commerce_order_recipients (strictly matching present columns)
        $recipData = [
            'platform' => 'tiktok_shop',
            'shop_id' => $shopId,
            'platform_order_id' => $orderId,
            'identity_method' => 'UNMASKED_SELLER_CENTER'
        ];
        if (isset($recipCols['recipient_name_raw'])) $recipData['recipient_name_raw'] = $recipientName !== '' ? $recipientName : null;
        if (isset($recipCols['phone_raw'])) $recipData['phone_raw'] = $phoneRaw !== '' ? $phoneRaw : null;
        if (isset($recipCols['address_raw'])) $recipData['address_raw'] = $addressRaw !== '' ? $addressRaw : null;
        if (isset($recipCols['phone_hash']) && $phoneHash) $recipData['phone_hash'] = $phoneHash;
        if (isset($recipCols['customer_identifier_hash']) && $phoneHash) $recipData['customer_identifier_hash'] = $phoneHash;
        if (isset($recipCols['phone_masked'])) $recipData['phone_masked'] = $phoneMasked;
        if (isset($recipCols['recipient_name_masked'])) $recipData['recipient_name_masked'] = $nameMasked;
        if (isset($recipCols['address_masked'])) $recipData['address_masked'] = $addressRaw !== '' ? mb_substr($addressRaw, 0, 50) . '...' : null;
        if (isset($recipCols['province'])) $recipData['province'] = $province !== '' ? $province : null;
        if (isset($recipCols['district'])) $recipData['district'] = $district !== '' ? $district : null;
        if (isset($recipCols['ward'])) $recipData['ward'] = $ward !== '' ? $ward : null;
        if (isset($recipCols['is_masked_by_platform'])) $recipData['is_masked_by_platform'] = 0;
        if (isset($recipCols['synced_at'])) $recipData['synced_at'] = date('Y-m-d H:i:s');

        $recipColNames = array_keys($recipData);
        $recipPlaceholders = array_map(fn($c) => ':' . $c, $recipColNames);
        $recipUpdates = [];
        foreach ($recipColNames as $col) {
            if (in_array($col, ['platform', 'shop_id', 'platform_order_id', 'created_at'])) continue;
            if ($col === 'phone_raw') {
                $recipUpdates[] = "`phone_raw` = IF(VALUES(`phone_raw`) IS NOT NULL AND VALUES(`phone_raw`) != '' AND VALUES(`phone_raw`) NOT LIKE '%*%', VALUES(`phone_raw`), COALESCE(`phone_raw`, VALUES(`phone_raw`)))";
            } elseif ($col === 'address_raw') {
                $recipUpdates[] = "`address_raw` = IF(VALUES(`address_raw`) IS NOT NULL AND VALUES(`address_raw`) != '' AND VALUES(`address_raw`) NOT LIKE '%*%', VALUES(`address_raw`), COALESCE(`address_raw`, VALUES(`address_raw`)))";
            } elseif ($col === 'recipient_name_raw') {
                $recipUpdates[] = "`recipient_name_raw` = IF(VALUES(`recipient_name_raw`) IS NOT NULL AND VALUES(`recipient_name_raw`) != '' AND VALUES(`recipient_name_raw`) NOT LIKE '%@%', VALUES(`recipient_name_raw`), COALESCE(`recipient_name_raw`, VALUES(`recipient_name_raw`)))";
            } elseif (in_array($col, ['province', 'district', 'ward'])) {
                $recipUpdates[] = "`{$col}` = COALESCE(VALUES(`{$col}`), `{$col}`)";
            } else {
                $recipUpdates[] = "`{$col}` = VALUES(`{$col}`)";
            }
        }
        $recipUpdateSql = !empty($recipUpdates) ? implode(', ', $recipUpdates) : "`updated_at` = NOW()";

        $sqlRecip = "INSERT INTO `commerce_order_recipients` (`" . implode('`, `', $recipColNames) . "`) 
                     VALUES (" . implode(', ', $recipPlaceholders) . ") 
                     ON DUPLICATE KEY UPDATE {$recipUpdateSql}";

        $stmtRecip = $db->prepare($sqlRecip);
        $execParams = [];
        foreach ($recipData as $k => $v) {
            $execParams[':' . $k] = $v;
        }
        $stmtRecip->execute($execParams);

        // B. Ensure commerce_orders entry exists and update raw contact info if columns exist
        $sqlOrder = "INSERT INTO `commerce_orders` (
            `platform`, `shop_id`, `platform_order_id`,
            `order_status`, `order_gross_amount`, `currency`,
            `platform_created_at`, `created_at`, `updated_at`
        ) VALUES (
            'tiktok_shop', :shop_id, :order_id,
            :order_status, :gross_amount, 'VND',
            :order_time, NOW(), NOW()
        ) ON DUPLICATE KEY UPDATE
            `order_status` = IF(VALUES(`order_status`) != '', VALUES(`order_status`), `order_status`),
            `order_gross_amount` = IF(VALUES(`order_gross_amount`) > 0, VALUES(`order_gross_amount`), `order_gross_amount`),
            `updated_at` = NOW()";

        $stmtOrder = $db->prepare($sqlOrder);
        $stmtOrder->execute([
            ':shop_id' => $shopId,
            ':order_id' => $orderId,
            ':order_status' => $orderStatus,
            ':gross_amount' => $orderGross,
            ':order_time' => $orderTimestamp
        ]);

        // If commerce_orders has unmasked recipient columns, mirror them directly
        $orderContactUpdates = [];
        $orderContactParams = [':shop_id' => $shopId, ':order_id' => $orderId];
        if (isset($orderCols['recipient_name_raw']) && $recipientName !== '') {
            $orderContactUpdates[] = "`recipient_name_raw` = :ord_name_raw";
            $orderContactParams[':ord_name_raw'] = $recipientName;
        }
        if (isset($orderCols['phone_raw']) && $phoneRaw !== '') {
            $orderContactUpdates[] = "`phone_raw` = :ord_phone_raw";
            $orderContactParams[':ord_phone_raw'] = $phoneRaw;
        }
        if (isset($orderCols['address_raw']) && $addressRaw !== '') {
            $orderContactUpdates[] = "`address_raw` = :ord_addr_raw";
            $orderContactParams[':ord_addr_raw'] = $addressRaw;
        }
        if (!empty($orderContactUpdates)) {
            $sqlOrderContact = "UPDATE `commerce_orders` SET " . implode(', ', $orderContactUpdates) . " WHERE `platform` = 'tiktok_shop' AND `shop_id` = :shop_id AND `platform_order_id` = :order_id";
            $stmtOrderContact = $db->prepare($sqlOrderContact);
            $stmtOrderContact->execute($orderContactParams);
        }

        // C. Upsert into commerce_customer_profiles (strictly matching present columns)
        if (!empty($phoneHash)) {
            $profData = [
                'platform' => 'tiktok_shop',
                'shop_id' => $shopId,
                'customer_identifier_hash' => $phoneHash,
                'identity_method' => 'UNMASKED_SELLER_CENTER',
                'customer_display_name' => $recipientName !== '' ? $recipientName : $nameMasked,
                'first_order_at' => $orderTimestamp,
                'last_order_at' => $orderTimestamp
            ];
            if (isset($profCols['recipient_name_raw'])) $profData['recipient_name_raw'] = $recipientName !== '' ? $recipientName : null;
            if (isset($profCols['phone_raw'])) $profData['phone_raw'] = $phoneRaw !== '' ? $phoneRaw : null;
            if (isset($profCols['phone_masked'])) $profData['phone_masked'] = $phoneMasked;
            if (isset($profCols['address_raw'])) $profData['address_raw'] = $addressRaw !== '' ? $addressRaw : null;
            if (isset($profCols['province'])) $profData['province'] = $province !== '' ? $province : null;
            if (isset($profCols['district'])) $profData['district'] = $district !== '' ? $district : null;
            if (isset($profCols['city'])) $profData['city'] = $province !== '' ? $province : null;
            if (isset($profCols['total_orders_count'])) $profData['total_orders_count'] = 1;
            if (isset($profCols['valid_orders_count'])) $profData['valid_orders_count'] = 1;
            if (isset($profCols['lifetime_gross_spend'])) $profData['lifetime_gross_spend'] = $orderGross;
            if (isset($profCols['order_gross_amount'])) $profData['order_gross_amount'] = $orderGross;
            if (isset($profCols['is_repeat_buyer'])) $profData['is_repeat_buyer'] = 0;

            $profColNames = array_keys($profData);
            $profPlaceholders = array_map(fn($c) => ':' . $c, $profColNames);
            $profUpdates = [
                "`last_order_at` = GREATEST(COALESCE(`last_order_at`, '2000-01-01'), VALUES(`last_order_at`))",
                "`first_order_at` = LEAST(COALESCE(`first_order_at`, '2099-12-31'), VALUES(`first_order_at`))",
                "`updated_at` = NOW()"
            ];
            if (isset($profCols['customer_display_name'])) $profUpdates[] = "`customer_display_name` = IF(VALUES(`customer_display_name`) != '' AND VALUES(`customer_display_name`) NOT LIKE '%@%' AND VALUES(`customer_display_name`) != 'Khách Hàng', VALUES(`customer_display_name`), `customer_display_name`)";
            if (isset($profCols['recipient_name_raw'])) $profUpdates[] = "`recipient_name_raw` = IF(VALUES(`recipient_name_raw`) IS NOT NULL AND VALUES(`recipient_name_raw`) != '' AND VALUES(`recipient_name_raw`) NOT LIKE '%@%', VALUES(`recipient_name_raw`), `recipient_name_raw`)";
            if (isset($profCols['phone_raw'])) $profUpdates[] = "`phone_raw` = IF(VALUES(`phone_raw`) IS NOT NULL AND VALUES(`phone_raw`) != '' AND VALUES(`phone_raw`) NOT LIKE '%*%', VALUES(`phone_raw`), `phone_raw`)";
            if (isset($profCols['phone_masked'])) $profUpdates[] = "`phone_masked` = VALUES(`phone_masked`)";
            if (isset($profCols['address_raw'])) $profUpdates[] = "`address_raw` = IF(VALUES(`address_raw`) IS NOT NULL AND VALUES(`address_raw`) != '' AND VALUES(`address_raw`) NOT LIKE '%*%', VALUES(`address_raw`), `address_raw`)";
            if (isset($profCols['province'])) $profUpdates[] = "`province` = COALESCE(VALUES(`province`), `province`)";
            if (!$isOrderAlreadyCaptured) {
                if (isset($profCols['total_orders_count'])) $profUpdates[] = "`total_orders_count` = `total_orders_count` + 1";
                if (isset($profCols['valid_orders_count'])) $profUpdates[] = "`valid_orders_count` = `valid_orders_count` + 1";
                if (isset($profCols['is_repeat_buyer'])) $profUpdates[] = "`is_repeat_buyer` = IF(`total_orders_count` >= 2, 1, 0)";
                if (isset($profCols['lifetime_gross_spend'])) $profUpdates[] = "`lifetime_gross_spend` = `lifetime_gross_spend` + VALUES(`lifetime_gross_spend`)";
            }

            $profUpdateSql = implode(', ', $profUpdates);
            $sqlProf = "INSERT INTO `commerce_customer_profiles` (`" . implode('`, `', $profColNames) . "`)
                        VALUES (" . implode(', ', $profPlaceholders) . ")
                        ON DUPLICATE KEY UPDATE {$profUpdateSql}";

            $stmtProf = $db->prepare($sqlProf);
            $profExecParams = [];
            foreach ($profData as $k => $v) {
                $profExecParams[':' . $k] = $v;
            }
            $stmtProf->execute($profExecParams);
        }

        $capturedCount++;
        $capturedOrders[] = [
            'order_id' => $orderId,
            'recipient_name' => $recipientName,
            'phone' => $phoneRaw,
            'address' => $addressRaw,
            'status' => $orderStatus
        ];
    } catch (\Throwable $t) {
        $errors[] = "Lỗi xử lý đơn {$orderId}: " . $t->getMessage();
    }
}

echo json_encode([
    'success' => $capturedCount > 0,
    'captured_count' => $capturedCount,
    'total_submitted' => count($ordersInput),
    'orders' => $capturedOrders,
    'errors' => $errors,
    'message' => $capturedCount > 0
        ? "Đã thu thập thành công thông tin khách hàng cho {$capturedCount} đơn hàng!"
        : "Không có đơn hàng nào được lưu. Vui lòng kiểm tra lại dữ liệu gửi lên."
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
