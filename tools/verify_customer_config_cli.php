<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - CUSTOMER HMAC SECRET VERIFICATION TOOL
 * File: tools/verify_customer_config_cli.php
 * Target: Sprint V2-05.1 HMAC Secret Security Hotfix
 * 
 * Safely verifies if CUSTOMER_IDENTITY_HMAC_KEY is properly configured
 * in the system environment / .env file according to security standards.
 * 
 * SECURITY INVARIANT:
 * Strictly NEVER prints, echoes, or reveals the secret key or fragments thereof.
 * Only outputs:
 *   CUSTOMER_IDENTITY_HMAC_KEY=CONFIGURED (exit 0)
 *   CUSTOMER_IDENTITY_HMAC_KEY=MISSING    (exit 1)
 *   CUSTOMER_IDENTITY_HMAC_KEY=INVALID    (exit 1)
 * ====================================================================
 */

declare(strict_types=1);

// Suppress notices/warnings from polluting stdout verification contract
error_reporting(E_ERROR | E_PARSE);

// Ensure CLI inspection can execute without requiring database connection
if (getenv('APP_ENV') === false && !isset($_SERVER['APP_ENV']) && !isset($_ENV['APP_ENV'])) {
    putenv('APP_ENV=cli');
    $_ENV['APP_ENV'] = 'cli';
    $_SERVER['APP_ENV'] = 'cli';
}
if (getenv('DB_NAME') === false) putenv('DB_NAME=check_only');
if (getenv('DB_USER') === false) putenv('DB_USER=check_only');
if (getenv('DB_PASSWORD') === false) putenv('DB_PASSWORD=check_only');
if (getenv('AUTH_SIGNING_KEY') === false) putenv('AUTH_SIGNING_KEY=check_only_key_32_chars_len!!');

$candidateDirs = [
    __DIR__ . '/../api',
    __DIR__ . '/../public/api',
    __DIR__ . '/api',
    __DIR__ . '/public/api',
    __DIR__
];

$baseDir = null;
foreach ($candidateDirs as $dir) {
    if (file_exists($dir . '/config.php') && file_exists($dir . '/commerce_customer_service.php')) {
        $baseDir = $dir;
        break;
    }
}

if (!$baseDir) {
    fwrite(STDERR, "[CRITICAL ERROR] Cannot locate backend API directory (config.php, commerce_customer_service.php).\n");
    exit(1);
}

require_once $baseDir . '/config.php';
require_once $baseDir . '/commerce_customer_service.php';

$key = null;
if (defined('CUSTOMER_IDENTITY_HMAC_KEY') && CUSTOMER_IDENTITY_HMAC_KEY !== '') {
    $key = CUSTOMER_IDENTITY_HMAC_KEY;
} elseif (getenv('CUSTOMER_IDENTITY_HMAC_KEY') !== false && getenv('CUSTOMER_IDENTITY_HMAC_KEY') !== '') {
    $key = getenv('CUSTOMER_IDENTITY_HMAC_KEY');
} elseif (!empty($_ENV['CUSTOMER_IDENTITY_HMAC_KEY'])) {
    $key = $_ENV['CUSTOMER_IDENTITY_HMAC_KEY'];
} elseif (!empty($_SERVER['CUSTOMER_IDENTITY_HMAC_KEY'])) {
    $key = $_SERVER['CUSTOMER_IDENTITY_HMAC_KEY'];
}

$validation = CommerceCustomerService::validateHmacKey($key);

if ($validation['valid']) {
    echo "CUSTOMER_IDENTITY_HMAC_KEY=CONFIGURED\n";
    exit(0);
} elseif ($validation['reason'] === CommerceCustomerService::REASON_HMAC_KEY_MISSING) {
    echo "CUSTOMER_IDENTITY_HMAC_KEY=MISSING\n";
    exit(1);
} else {
    echo "CUSTOMER_IDENTITY_HMAC_KEY=INVALID\n";
    exit(1);
}
