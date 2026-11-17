<?php
/**
 * ADDP Commerce Intelligence - Environment Configuration Layer
 *
 * Implements fail-closed environment variable loading without hardcoded secret fallbacks.
 * Production environments strictly require .env or system environment variables.
 */

if (!function_exists('loadEnvFile')) {
    function loadEnvFile(string $filePath): void {
        if (!file_exists($filePath) || !is_readable($filePath)) {
            return;
        }

        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            // Skip comments and empty lines
            if ($line === '' || strpos($line, '#') === 0) {
                continue;
            }

            // Split into key and value
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }

            $key = trim($parts[0]);
            $val = trim($parts[1]);

            // Strip surrounding quotes
            if (
                (strpos($val, '"') === 0 && substr($val, -1) === '"') ||
                (strpos($val, "'") === 0 && substr($val, -1) === "'")
            ) {
                $val = substr($val, 1, -1);
            }

            // Populate $_ENV, $_SERVER and putenv if not already defined by system
            if (!isset($_SERVER[$key])) {
                $_SERVER[$key] = $val;
            }
            if (!isset($_ENV[$key])) {
                $_ENV[$key] = $val;
            }
            if (getenv($key) === false) {
                putenv("{$key}={$val}");
            }
        }
    }
}

// Locate and load .env file from possible locations
$envCandidatePaths = [
    dirname(__DIR__, 2) . '/.env', // Domain root / Outside webroot (/home/addp/domains/marketing.addp.vn/.env or C:\AdsTiktok\.env)
    dirname(__DIR__) . '/.env',    // Webroot (/home/addp/domains/marketing.addp.vn/public_html/.env or C:\AdsTiktok\public\.env)
    dirname(__DIR__, 3) . '/.env', // User home root (/home/addp/.env)
    __DIR__ . '/.env'              // API directory (/home/addp/domains/marketing.addp.vn/public_html/api/.env)
];

foreach ($envCandidatePaths as $candidatePath) {
    if (file_exists($candidatePath)) {
        loadEnvFile($candidatePath);
        break;
    }
}

if (!function_exists('env')) {
    function env(string $key, $default = null) {
        $val = $_SERVER[$key] ?? $_ENV[$key] ?? getenv($key);
        if ($val === false || $val === null || $val === '') {
            return $default;
        }
        if (strtolower($val) === 'true') return true;
        if (strtolower($val) === 'false') return false;
        return $val;
    }
}

// Base application configuration
define('APP_ENV', env('APP_ENV', 'production'));
define('APP_DEBUG', (bool)env('APP_DEBUG', false));
define('APP_URL', rtrim((string)env('APP_URL', 'https://marketing.addp.vn'), '/'));

// Fail-closed validation for production environment
if (APP_ENV === 'production') {
    $requiredSecrets = [
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD',
        'AUTH_SIGNING_KEY'
    ];

    $missing = [];
    foreach ($requiredSecrets as $reqKey) {
        $val = env($reqKey);
        if ($val === null || $val === '' || strpos((string)$val, 'YOUR_') === 0) {
            $missing[] = $reqKey;
        }
    }

    if (!empty($missing)) {
        // Redact and log error on server
        error_log("[SECURITY] Fail-Closed: Missing required production environment configuration: " . implode(', ', $missing));
        
        // Return generic error to client without exposing secret names or server paths
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'code' => 'SERVER_CONFIGURATION_ERROR',
            'message' => 'Lỗi cấu hình máy chủ. Vui lòng liên hệ quản trị viên hệ thống để kiểm tra biến môi trường.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Database configuration
define('DB_HOST', (string)env('DB_HOST', 'localhost'));
define('DB_PORT', (int)env('DB_PORT', 3306));
define('DB_NAME', (string)env('DB_NAME', ''));
define('DB_USER', (string)env('DB_USER', ''));
define('DB_PASS', (string)env('DB_PASSWORD', ''));

// Administrative authentication configuration
define('ADMIN_USER', (string)env('ADMIN_USERNAME', 'addp_admin'));
define('ADMIN_PASSWORD_HASH', (string)env('ADMIN_PASSWORD_HASH', ''));
define('ADMIN_PASS', (string)env('ADMIN_PASSWORD', ''));

// Dedicated HMAC Bearer Token signing key
define('AUTH_SIGNING_KEY', (string)env('AUTH_SIGNING_KEY', ''));

// Sprint V2-05.1: Dedicated Customer Identity HMAC Secret (Fail-Closed, zero fallback salt)
define('CUSTOMER_IDENTITY_HMAC_KEY', (string)env('CUSTOMER_IDENTITY_HMAC_KEY', ''));

// Sprint V2-05.2: Dedicated Customer Recipient Encryption Key for Encryption-At-Rest (AES-256-GCM)
define('CUSTOMER_RECIPIENT_ENCRYPTION_KEY', (string)env('CUSTOMER_RECIPIENT_ENCRYPTION_KEY', ''));

// TikTok Shop Partner credentials
define('TIKTOK_APP_KEY', (string)env('TIKTOK_APP_KEY', ''));
define('TIKTOK_APP_SECRET', (string)env('TIKTOK_APP_SECRET', ''));
define('TIKTOK_REDIRECT_URI', (string)env('TIKTOK_REDIRECT_URI', 'https://marketing.addp.vn/api/oauth.php'));

// TikTok Ads Manager credentials
define('TIKTOK_ADS_APP_ID', (string)env('TIKTOK_ADS_APP_ID', ''));
define('TIKTOK_ADS_SECRET', (string)env('TIKTOK_ADS_SECRET', ''));
define('TIKTOK_ADS_REDIRECT_URI', (string)env('TIKTOK_ADS_REDIRECT_URI', 'https://marketing.addp.vn/api/oauth_ads.php'));

// Google Gemini Generative AI Key
define('GEMINI_API_KEY', (string)env('GEMINI_API_KEY', ''));

// Task 02B: Chrome Extension Connector Configuration
define('CONNECTOR_TOKEN_TTL', (int)env('CONNECTOR_TOKEN_TTL', 86400)); // 24 Hours default
define('PAIRING_TOKEN_TTL', (int)env('PAIRING_TOKEN_TTL', 300));       // 5 Minutes default
// SECURITY_TRANSITION_ONLY: Phase A dual-mode transitional fallback flag. Removed in Phase C lock-down.
define('CONNECTOR_ALLOW_UNAUTHENTICATED', (bool)env('CONNECTOR_ALLOW_UNAUTHENTICATED', true));

// HF1.2: Core Orders Engine V2 Configuration & Feature Flag
define('FEATURE_ENABLE_COMMERCE_V2', (bool)env('FEATURE_ENABLE_COMMERCE_V2', false));
define('TIKTOK_API_ORDER_DOMAIN', 'order');
define('TIKTOK_API_ORDER_VERSION', '202309');
define('TIKTOK_API_ORDER_SEARCH_ENDPOINT', '/order/202309/orders/search');
define('TIKTOK_API_ORDER_SCOPE', 'seller.order.info');
define('TIKTOK_API_DEFAULT_PAGE_SIZE', 100);
define('TIKTOK_API_CONNECT_TIMEOUT_SEC', 5);
define('TIKTOK_API_READ_TIMEOUT_SEC', 30);
define('TIKTOK_API_RETRY_MAX_ATTEMPTS', 3);

// HF1.3: Throttling & Rate-Limit Configuration (Correction 3 - Configurable)
define('TIKTOK_API_THROTTLE_MS', (int)env('TIKTOK_API_THROTTLE_MS', 100));
define('TIKTOK_API_RETRY_AFTER_DEFAULT_SEC', (int)env('TIKTOK_API_RETRY_AFTER_DEFAULT_SEC', 2));

// HF1.3: Return & Refund (RMA) Connector Configuration & Feature Flag
define('FEATURE_ENABLE_AFTERSALES_V2', (bool)env('FEATURE_ENABLE_AFTERSALES_V2', false));
define('TIKTOK_API_RMA_DOMAIN', 'return_refund');
define('TIKTOK_API_RMA_VERSION', '202602');
define('TIKTOK_API_RMA_SEARCH_ENDPOINT', '/return_refund/202602/returns/search');
define('TIKTOK_API_RMA_SCOPE', 'seller.return_refund.basic');

// HF1.3: Fulfillment Packages Connector Configuration & Feature Flag
define('FEATURE_ENABLE_FULFILLMENT_EVENTS_V2', (bool)env('FEATURE_ENABLE_FULFILLMENT_EVENTS_V2', false));
define('TIKTOK_API_FULFILLMENT_DOMAIN', 'fulfillment');
define('TIKTOK_API_FULFILLMENT_VERSION', '202309');
define('TIKTOK_API_PACKAGES_SEARCH_ENDPOINT', '/fulfillment/202309/packages/search');
define('TIKTOK_API_FULFILLMENT_SCOPE', 'seller.fulfillment.basic');

// HF1.3: Persistent Loss Ledger & Classification Engine Feature Flag
define('FEATURE_ENABLE_LOSS_ENGINE_V2', (bool)env('FEATURE_ENABLE_LOSS_ENGINE_V2', false));

// HF1.4: Finance & Settlement Engine Configuration & Feature Flag
define('FEATURE_ENABLE_FINANCE_V2', (bool)env('FEATURE_ENABLE_FINANCE_V2', false));
define('TIKTOK_API_FINANCE_DOMAIN', 'finance');
define('TIKTOK_API_FINANCE_STATEMENT_VERSION', '202309');
define('TIKTOK_API_FINANCE_STATEMENT_ENDPOINT', '/finance/202309/statements');
define('TIKTOK_API_FINANCE_TRANSACTION_VERSION', '202501');
define('TIKTOK_API_FINANCE_TRANSACTIONS_ENDPOINT', '/finance/202501/orders/{order_id}/statement_transactions');
define('TIKTOK_API_FINANCE_SCOPE', 'seller.finance.info');

// HF1.5: Shop Analytics, Livestream & Video Performance Feature Flag
define('FEATURE_ENABLE_ANALYTICS_V2', (bool)env('FEATURE_ENABLE_ANALYTICS_V2', false));
define('TIKTOK_API_ANALYTICS_DOMAIN', 'analytics');
define('TIKTOK_API_ANALYTICS_VERSION', '202405');
define('TIKTOK_API_ANALYTICS_SHOP_ENDPOINT', '/analytics/202405/shop/performance');
define('TIKTOK_API_ANALYTICS_LIVES_ENDPOINT', '/analytics/202405/shop_lives/performance');
define('TIKTOK_API_ANALYTICS_VIDEOS_ENDPOINT', env('TIKTOK_API_ANALYTICS_VIDEOS_ENDPOINT', '/analytics/202605/shop_videos/performance'));
define('TIKTOK_API_ANALYTICS_PRODUCTS_ENDPOINT', '/analytics/202405/shop_products/{product_id}/performance');
define('TIKTOK_API_ANALYTICS_SCOPE', 'data.shop_analytics.public.read');
define('TIKTOK_API_CREATOR_LIVE_SCOPE', 'creator.data.live.read.public');
define('TIKTOK_API_BESTSELLING_SCOPE', 'data.bestselling.public.read');



