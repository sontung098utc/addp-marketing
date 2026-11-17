<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
require_once 'db.php';
header('Content-Type: application/json');

$db = getDBConnection();

$config = $db->query("SELECT * FROM `tiktok_config` LIMIT 1")->fetch();

$accessToken = getAccessToken();

$auditLogs = $db->query("SELECT * FROM `tiktok_audit_logs` ORDER BY log_time DESC LIMIT 15")->fetchAll();

$camps = $db->query("SELECT id, name, type, spend, conversions, ad_gmv, status FROM `tiktok_campaigns`")->fetchAll();

echo json_encode([
    'config_exists' => $config ? true : false,
    'shop_id' => $config ? $config['shop_id'] : null,
    'has_access_token' => !empty($config['access_token']),
    'has_refresh_token' => !empty($config['refresh_token']),
    'expires_at' => $config ? $config['expires_at'] : null,
    'current_time' => time(),
    'token_expired' => $config ? ($config['expires_at'] < time()) : true,
    'get_access_token_result' => $accessToken ? (substr($accessToken, 0, 8) . '...' . substr($accessToken, -8)) : null,
    'db_app_key' => $config ? $config['app_key'] : null,
    'db_app_secret' => $config ? (substr($config['app_secret'], 0, 5) . '...' . substr($config['app_secret'], -5)) : null,
    'constant_app_key' => TIKTOK_APP_KEY,
    'constant_app_secret' => (substr(TIKTOK_APP_SECRET, 0, 5) . '...' . substr(TIKTOK_APP_SECRET, -5)),
    'has_ads_access_token' => !empty($config['ads_access_token']),
    'ads_access_token' => $config && $config['ads_access_token'] ? (substr($config['ads_access_token'], 0, 8) . '...' . substr($config['ads_access_token'], -8)) : null,
    'advertiser_id' => $config ? $config['advertiser_id'] : null,
    'campaigns_count' => count($camps),
    'campaigns' => $camps,
    'audit_logs' => $auditLogs
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

