<?php
if (php_sapi_name() !== 'cli') { http_response_code(403); die('Forbidden: CLI execution only.'); }
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/tiktok_client.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $db = getDBConnection();
    $config = $db->query("SELECT * FROM tiktok_config LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    $campaigns = $db->query("SELECT id, name, type, status, spend, ad_gmv FROM tiktok_campaigns ORDER BY spend DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
    $videos = $db->query("SELECT id, title, campaign_id, spend, gmv FROM tiktok_video_ads LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
    
    $out = [
        "campaigns_count" => count($campaigns),
        "campaigns" => $campaigns,
        "videos_count" => count($videos),
        "videos" => $videos
    ];
    
    // Náº¿u cĂ³ chiáº¿n dá»‹ch, thá»­ cĂ¡c API video vá»›i campaign_id thá»±c táº¿
    if (!empty($campaigns) && !empty($config['ads_access_token'])) {
        $advId = $config['advertiser_id'];
        $token = $config['ads_access_token'];
        $shopId = $config['shop_id'] ?? "7495657895504611503";
        $bcId = "7387314008006639632";
        
        $testCamp = $campaigns[0];
        $testCampId = $testCamp['id'];
        $out['tested_campaign'] = $testCamp;
        
        // 1. campaign/gmv_max/info
        try {
            $out['api_gmv_max_info'] = requestTikTokAdsAPI('/campaign/gmv_max/info/', [
                'advertiser_id' => $advId,
                'campaign_id' => $testCampId
            ], $token);
        } catch (Exception $e) {
            $out['api_gmv_max_info_err'] = $e->getMessage();
        }
        
        // 2. gmv_max/custom_anchor_video_list/get
        try {
            $out['api_custom_anchor_video_list'] = requestTikTokAdsAPI('/gmv_max/custom_anchor_video_list/get/', [
                'advertiser_id' => $advId,
                'campaign_id' => $testCampId,
                'page' => 1,
                'page_size' => 50
            ], $token);
        } catch (Exception $e) {
            $out['api_custom_anchor_video_list_err'] = $e->getMessage();
        }
        
        // 3. ad/get vá»›i campaign_id
        try {
            $out['api_ad_get'] = requestTikTokAdsAPI('/ad/get/', [
                'advertiser_id' => $advId,
                'filtering' => [
                    'campaign_ids' => [$testCampId]
                ],
                'page' => 1,
                'page_size' => 50
            ], $token);
        } catch (Exception $e) {
            $out['api_ad_get_err'] = $e->getMessage();
        }
        
        // 4. gmv_max/video/get vá»›i identity_list
        try {
            $out['api_gmv_max_video_with_identities'] = requestTikTokAdsAPI('/gmv_max/video/get/', [
                'advertiser_id' => $advId,
                'store_id' => $shopId,
                'store_authorized_bc_id' => $bcId,
                'identity_list' => [
                    ['identity_id' => '7423716002440463378', 'identity_type' => 'TTS_TT'],
                    ['identity_id' => 'e8127e4d-88e5-5a5e-be76-904d6c78e9a2', 'identity_type' => 'BC_AUTH_TT']
                ],
                'page' => 1,
                'page_size' => 50
            ], $token);
        } catch (Exception $e) {
            $out['api_gmv_max_video_with_identities_err'] = $e->getMessage();
        }
    }
    
    echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}

