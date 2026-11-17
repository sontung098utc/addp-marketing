<?php
require_once __DIR__ . '/../../public/api/config.php';
require_once __DIR__ . '/../../public/api/commerce_analytics_service.php';

// Test Case A: Empty/Zero livestream data
$zeroAgg = [
    'total_sessions' => 0,
    'duration_seconds' => 0,
    'gmv' => 0,
    'orders_count' => 0,
    'units_sold' => 0,
    'total_views' => 0,
    'impressions' => 0,
    'clicks' => 0,
    'comments_count' => 0,
    'shares_count' => 0,
    'follows_count' => 0,
    'max_pcu' => 0
];
$kpisZero = CommerceAnalyticsService::computeLiveSessionKpis($zeroAgg);

if (!isset($kpisZero['comment_rate']) || !isset($kpisZero['comment_rate_pct'])) {
    fwrite(STDERR, "FAIL: comment_rate dual keys missing\n");
    exit(1);
}
if (!isset($kpisZero['follow_rate']) || !isset($kpisZero['follow_rate_pct'])) {
    fwrite(STDERR, "FAIL: follow_rate dual keys missing\n");
    exit(1);
}
if ($kpisZero['comment_rate']['value'] !== null || $kpisZero['follow_rate']['value'] !== null) {
    fwrite(STDERR, "FAIL: zero values should be null\n");
    exit(1);
}
if ($kpisZero['comment_rate']['type'] !== 'UNAVAILABLE' || $kpisZero['follow_rate']['type'] !== 'UNAVAILABLE') {
    fwrite(STDERR, "FAIL: zero type should be UNAVAILABLE\n");
    exit(1);
}

// Test Case B: Active livestream data
$activeAgg = [
    'total_sessions' => 2,
    'duration_seconds' => 7200,
    'gmv' => 25000000.0,
    'orders_count' => 150,
    'units_sold' => 180,
    'total_views' => 5000,
    'impressions' => 12000,
    'clicks' => 800,
    'comments_count' => 250,
    'shares_count' => 80,
    'follows_count' => 120,
    'max_pcu' => 650
];
$kpisActive = CommerceAnalyticsService::computeLiveSessionKpis($activeAgg);

if ($kpisActive['comment_rate']['value'] !== 5.0 || $kpisActive['comment_rate_pct']['value'] !== 5.0) {
    fwrite(STDERR, "FAIL: comment_rate calc mismatch\n");
    exit(1);
}
if ($kpisActive['follow_rate']['value'] !== 2.4 || $kpisActive['follow_rate_pct']['value'] !== 2.4) {
    fwrite(STDERR, "FAIL: follow_rate calc mismatch\n");
    exit(1);
}

echo "SUCCESS";
exit(0);
