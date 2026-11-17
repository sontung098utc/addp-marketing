<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/tiktok_client.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $db = getDBConnection();
    $stmt = $db->query("SELECT ads_access_token, advertiser_id, shop_id FROM tiktok_config LIMIT 1");
    $config = $stmt->fetch();
    
    if (!$config || !$config['ads_access_token']) {
        echo json_encode(["error" => "No active Ads connection."]);
        exit;
    }
    
    $advId = $config['advertiser_id'];
    $shopId = "7495657895504611503";
    $accessToken = $config['ads_access_token'];
    
    $bcId = "7387314008006639632";
    
    $results = [];
    
    // Test 1: gmv_max/video/get máº·c Ä‘á»‹nh
    try {
        $results['gmv_max_video_default'] = requestTikTokAdsAPI('/gmv_max/video/get/', [
            'advertiser_id' => $advId,
            'store_id' => $shopId,
            'store_authorized_bc_id' => $bcId,
            'page' => 1,
            'page_size' => 50
        ], $accessToken);
    } catch (Exception $e) {
        $results['gmv_max_video_default_error'] = $e->getMessage();
    }
    
    // Test 2: gmv_max/video/get vá»›i custom_posts_eligible => true
    try {
        $results['gmv_max_video_custom_posts_true'] = requestTikTokAdsAPI('/gmv_max/video/get/', [
            'advertiser_id' => $advId,
            'store_id' => $shopId,
            'store_authorized_bc_id' => $bcId,
            'custom_posts_eligible' => 'true',
            'page' => 1,
            'page_size' => 50
        ], $accessToken);
    } catch (Exception $e) {
        $results['gmv_max_video_custom_posts_true_error'] = $e->getMessage();
    }

    // Test 3: gmv_max/video/get vá»›i custom_posts_eligible => false
    try {
        $results['gmv_max_video_custom_posts_false'] = requestTikTokAdsAPI('/gmv_max/video/get/', [
            'advertiser_id' => $advId,
            'store_id' => $shopId,
            'store_authorized_bc_id' => $bcId,
            'custom_posts_eligible' => 'false',
            'page' => 1,
            'page_size' => 50
        ], $accessToken);
    } catch (Exception $e) {
        $results['gmv_max_video_custom_posts_false_error'] = $e->getMessage();
    }
    
    // Test 4: gmv_max/custom_anchor_video_list/get
    try {
        $results['custom_anchor_video_list'] = requestTikTokAdsAPI('/gmv_max/custom_anchor_video_list/get/', [
            'advertiser_id' => $advId,
            'page' => 1,
            'page_size' => 50
        ], $accessToken);
    } catch (Exception $e) {
        $results['custom_anchor_video_list_error'] = $e->getMessage();
    }
    
    // Test 5: gmv_max/identity/get
    try {
        $results['gmv_max_identity'] = requestTikTokAdsAPI('/gmv_max/identity/get/', [
            'advertiser_id' => $advId,
            'store_id' => $shopId,
            'store_authorized_bc_id' => $bcId
        ], $accessToken);
    } catch (Exception $e) {
        $results['gmv_max_identity_error'] = $e->getMessage();
    }

    echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}

