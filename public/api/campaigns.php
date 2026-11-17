<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
handleCORS();
$authUser = requireAuth('admin:all');

// Khởi chạy tạo bảng nếu chưa có
initializeDatabase();

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET campaigns
// Handle GET campaigns
if ($method === 'GET') {
    try {
        // Tự động quét sạch chiến dịch và video giả lập nếu đã liên kết shop thực tế
        $checkConnected = $db->query("SELECT COUNT(*) FROM `tiktok_config` WHERE shop_id IS NOT NULL AND shop_id != ''")->fetchColumn();
        if ($checkConnected > 0) {
            $db->exec("DELETE FROM `tiktok_video_ads` WHERE campaign_id IN ('camp-1', 'camp-2', 'camp-3', 'camp-4') OR campaign_id LIKE 'real-ads-%'");
            $db->exec("DELETE FROM `tiktok_campaigns` WHERE id IN ('camp-1', 'camp-2', 'camp-3', 'camp-4') OR id LIKE 'real-ads-%'");
        }

        // Action: GET CAMPAIGN DETAIL (Dữ liệu chuẩn xác từng kỳ & bể video riêng biệt)
        if (isset($_GET['action']) && $_GET['action'] === 'get_campaign_detail') {
            $campId = $_GET['id'] ?? $_GET['campaign_id'] ?? '';
            $timeRange = $_GET['time_range'] ?? '30d';
            $customStart = $_GET['start_date'] ?? null;
            $customEnd = $_GET['end_date'] ?? null;

            if (empty($campId)) {
                echo json_encode(['success' => false, 'message' => 'Thiếu campaign ID']);
                exit;
            }

            $stmtCamp = $db->prepare("SELECT * FROM `tiktok_campaigns` WHERE id = :id LIMIT 1");
            $stmtCamp->execute([':id' => $campId]);
            $campaign = $stmtCamp->fetch(PDO::FETCH_ASSOC);

            if (!$campaign) {
                echo json_encode(['success' => false, 'message' => 'Chiến dịch không tồn tại']);
                exit;
            }

            $campaign['budget'] = (float)$campaign['budget'];
            $campaign['spend'] = (float)$campaign['spend'];
            $campaign['clicks'] = (int)$campaign['clicks'];
            $campaign['impressions'] = (int)$campaign['impressions'];
            $campaign['conversions'] = (int)$campaign['conversions'];
            $campaign['adGmv'] = (float)$campaign['ad_gmv'];
            $campaign['target_roas'] = isset($campaign['target_roas']) && (float)$campaign['target_roas'] > 0 ? (float)$campaign['target_roas'] : 6.00;
            $campaign['status'] = (bool)$campaign['status'];

            $isLive = (stripos($campaign['type'], 'LIVE') !== false || stripos($campaign['name'], 'LIVE') !== false || $campId === '1862632140958017');

            $todayStr = date('Y-m-d');
            $yesterdayStr = date('Y-m-d', strtotime('-1 day'));
            $sDate = date('Y-m-d', strtotime('-29 days'));
            $eDate = $todayStr;

            if ($timeRange === 'today') {
                $sDate = $todayStr;
                $eDate = $todayStr;
            } elseif ($timeRange === 'yesterday') {
                $sDate = $yesterdayStr;
                $eDate = $yesterdayStr;
            } elseif ($timeRange === '7d') {
                $sDate = date('Y-m-d', strtotime('-6 days'));
                $eDate = $todayStr;
            } elseif ($timeRange === '30d') {
                $sDate = date('Y-m-d', strtotime('-29 days'));
                $eDate = $todayStr;
            } elseif ($timeRange === 'custom' && $customStart && $customEnd) {
                $sDate = $customStart;
                $eDate = $customEnd;
            }

            $calcSpend = $campaign['spend'];
            $calcGmv = $campaign['adGmv'];
            $calcConvs = $campaign['conversions'];
            $calcClicks = $campaign['clicks'];
            $calcImps = $campaign['impressions'];

            if ($timeRange !== '30d') {
                $stmtDaily = $db->prepare("SELECT SUM(spend) as p_spend, SUM(gmv) as p_gmv, SUM(orders) as p_orders 
                    FROM `tiktok_campaign_daily_reports` 
                    WHERE campaign_id = :cid AND stat_date >= :sdate AND stat_date <= :edate");
                $stmtDaily->execute([':cid' => $campId, ':sdate' => $sDate, ':edate' => $eDate]);
                $dRow = $stmtDaily->fetch(PDO::FETCH_ASSOC);

                if ($dRow && $dRow['p_spend'] !== null) {
                    $calcSpend = (float)$dRow['p_spend'];
                    $calcGmv = (float)$dRow['p_gmv'];
                    $calcClicks = null;
                    $calcImps = null;
                    try {
                        $stmtAdsDaily = $db->prepare("SELECT SUM(clicks) as p_clicks, SUM(impressions) as p_imps 
                            FROM `commerce_ads_campaign_daily` 
                            WHERE campaign_id = :cid AND stat_date >= :sdate AND stat_date <= :edate");
                        $stmtAdsDaily->execute([':cid' => $campId, ':sdate' => $sDate, ':edate' => $eDate]);
                        $adRow = $stmtAdsDaily->fetch(PDO::FETCH_ASSOC);
                        if ($adRow) {
                            if ($adRow['p_clicks'] !== null) $calcClicks = (int)$adRow['p_clicks'];
                            if ($adRow['p_imps'] !== null) $calcImps = (int)$adRow['p_imps'];
                        }
                    } catch (\Throwable $t) {}
                } else {
                    $calcSpend = 0.0;
                    $calcGmv = 0.0;
                    $calcConvs = 0;
                    $calcClicks = null;
                    $calcImps = null;
                }
            }

            // Đảm bảo video trong DB đã được phân loại quadrant nếu đã có video thực tế
            $stmtCountVids = $db->prepare("SELECT COUNT(*) FROM `tiktok_video_ads` WHERE campaign_id = :cid AND title NOT LIKE 'Ad name%' AND title NOT LIKE 'Tên quảng cáo%'");
            $stmtCountVids->execute([':cid' => $campId]);
            $countVids = (int)$stmtCountVids->fetchColumn();
            if ($countVids > 0 && !$isLive) {
                require_once __DIR__ . '/creatives_data.php';
                syncCreativesToDatabase($db, $sDate, $eDate, $calcSpend, $calcGmv, $calcConvs);
            }

            $videos = [];
            if (!$isLive) {
                $stmtV = $db->prepare("SELECT * FROM `tiktok_video_ads` 
                    WHERE campaign_id = :cid AND id NOT LIKE '7689901%' 
                    ORDER BY spend DESC, conversions DESC");
                $stmtV->execute([':cid' => $campId]);
                $rawVideos = $stmtV->fetchAll(PDO::FETCH_ASSOC);

                foreach ($rawVideos as $v) {
                    $vSpend = (float)($v['spend'] ?? 0);
                    $vGmv = (float)($v['gmv'] ?? 0);
                    $vConvs = (int)($v['conversions'] ?? 0);
                    $vViews = (int)($v['views'] ?? 0);
                    $vClicks = (int)($v['clicks'] ?? 0);

                    $vRoas = $vSpend > 0 ? round($vGmv / $vSpend, 2) : 0.0;

                    $videos[] = [
                        'id' => $v['id'],
                        'campaign_id' => $v['campaign_id'],
                        'title' => $v['title'],
                        'author_name' => $v['author_name'] ?? 'KOC TikTok',
                        'video_url' => $v['video_url'] ?? ('https://www.tiktok.com/@addp/video/' . $v['id']),
                        'thumbnail' => $v['thumbnail'] ?? '',
                        'spend' => $vSpend,
                        'gmv' => $vGmv,
                        'conversions' => $vConvs,
                        'roas' => $vRoas,
                        'views' => $vViews,
                        'clicks' => $vClicks,
                        'ctr' => (float)$v['ctr'],
                        'cvr' => (float)$v['cvr'],
                        'cpm' => (float)$v['cpm'],
                        'cpc' => (float)$v['cpc'],
                        'frequency' => (float)($v['frequency'] ?? 1.15),
                        'target_roas' => (float)($v['target_roas'] ?? $campaign['target_roas']),
                        'status_quadrant' => $v['status_quadrant'],
                        'action_recommendation' => $v['action_recommendation'],
                        'delivery_group' => $v['delivery_group'] ?? 'explored',
                        'delivery_status' => $v['delivery_status'] ?? 'effective',
                        'why_spending' => $v['why_spending'] ?? '',
                        'why_not_spending' => $v['why_not_spending'] ?? '',
                        'retention_6s' => (float)($v['retention_6s'] ?? 52.0),
                        'hook_rate' => (float)($v['hook_rate'] ?? 65.0),
                        'trend_status' => $v['trend_status'] ?? 'stable',
                        'today_orders' => (int)($v['today_orders'] ?? 0),
                        'yesterday_orders' => (int)($v['yesterday_orders'] ?? 0),
                        'seven_days_orders' => (int)($v['seven_days_orders'] ?? 0),
                        'thirty_days_orders' => (int)($v['thirty_days_orders'] ?? 0)
                    ];
                }
            }

            $dailyBudget = (float)$campaign['budget'];
            $pacing = $dailyBudget > 0 ? round(($calcSpend / $dailyBudget) * 100, 1) : 0;
            $roas = $calcSpend > 0 ? round($calcGmv / $calcSpend, 2) : 0;
            $cpa = $calcConvs > 0 ? round($calcSpend / $calcConvs, 0) : 0;
            $cpc = $calcClicks > 0 ? round($calcSpend / $calcClicks, 0) : 0;
            $cpm = $calcImps > 0 ? round(($calcSpend / $calcImps) * 1000, 0) : 0;
            $ctr = $calcImps > 0 ? round(($calcClicks / $calcImps) * 100, 2) : 0;

            echo json_encode([
                'success' => true,
                'is_live' => $isLive,
                'campaign' => array_merge($campaign, [
                    'spend' => $calcSpend,
                    'adGmv' => $calcGmv,
                    'ad_gmv' => $calcGmv,
                    'conversions' => $calcConvs,
                    'clicks' => $calcClicks,
                    'impressions' => $calcImps
                ]),
                'stats' => [
                    'spend' => $calcSpend,
                    'gmv' => $calcGmv,
                    'adGmv' => $calcGmv,
                    'conversions' => $calcConvs,
                    'clicks' => $calcClicks,
                    'impressions' => $calcImps,
                    'daily_budget' => $dailyBudget,
                    'pacing' => $pacing,
                    'roas' => $roas,
                    'cpa' => $cpa,
                    'cpc' => $cpc,
                    'cpm' => $cpm,
                    'ctr' => $ctr,
                    'target_roas' => $campaign['target_roas']
                ],
                'videos' => $videos,
                'total_videos' => count($videos),
                'time_range' => $timeRange
            ]);
            exit;
        }

        $stmt = $db->query("SELECT * FROM `tiktok_campaigns` ORDER BY status DESC, spend DESC, created_date DESC, id DESC");
        $campaigns = $stmt->fetchAll();
        
        $totalAdGmv = 0;
        $totalAdConvs = 0;
        // Convert types appropriately for JSON
        foreach ($campaigns as &$c) {
            $c['budget'] = (float)$c['budget'];
            $c['spend'] = (float)$c['spend'];
            $c['clicks'] = (int)$c['clicks'];
            $c['impressions'] = (int)$c['impressions'];
            $c['conversions'] = (int)$c['conversions'];
            $c['adGmv'] = (float)$c['ad_gmv']; // Map key name to match frontend JS
            $c['target_roas'] = isset($c['target_roas']) && (float)$c['target_roas'] > 0 ? (float)$c['target_roas'] : 6.00;
            $c['status'] = (bool)$c['status'];
            $c['created'] = $c['created_date'];
            
            $totalAdGmv += $c['adGmv'];
            $totalAdConvs += $c['conversions'];
        }
        
        $configRow = $db->query("SELECT last_total_shop_gmv, last_total_shop_orders FROM `tiktok_config` LIMIT 1")->fetch();
        $totalShopGmv = $configRow && $configRow['last_total_shop_gmv'] > 0 ? (float)$configRow['last_total_shop_gmv'] : $totalAdGmv;
        $totalShopOrders = $configRow && $configRow['last_total_shop_orders'] > 0 ? (int)$configRow['last_total_shop_orders'] : $totalAdConvs;
        
        $totalShopGmv = max($totalShopGmv, $totalAdGmv);
        $totalShopOrders = max($totalShopOrders, $totalAdConvs);
        
        echo json_encode([
            'success' => true,
            'data' => $campaigns,
            'total_shop_gmv' => $totalShopGmv,
            'total_shop_orders' => $totalShopOrders
        ]);
    } catch (\Throwable $e) {
        sanitizeErrorResponse($e, 'Lỗi tải danh sách chiến dịch.');
    }
    exit;
}

// Handle POST (Create or Update)
if ($method === 'POST') {
    // Read JSON payload
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'Dữ liệu đầu vào không hợp lệ']);
        exit;
    }
    
    $action = isset($input['action']) ? $input['action'] : '';

    // Action: UPDATE TARGET ROAS
    if ($action === 'update_target_roas') {
        $id = $input['id'];
        $targetRoas = (float)($input['target_roas'] ?? 6.0);
        
        try {
            $stmt = $db->prepare("UPDATE `tiktok_campaigns` SET target_roas = :target_roas WHERE id = :id");
            $stmt->execute([':target_roas' => $targetRoas, ':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Cập nhật Target ROI thành công', 'target_roas' => $targetRoas]);
        } catch (\Throwable $e) {
            sanitizeErrorResponse($e, 'Lỗi cập nhật Target ROI.');
        }
        exit;
    }

    // Action: TOGGLE STATUS
    if ($action === 'toggle') {
        $id = $input['id'];
        $status = $input['status'] ? 1 : 0;
        
        try {
            $stmt = $db->prepare("UPDATE `tiktok_campaigns` SET status = :status WHERE id = :id");
            $stmt->execute([':status' => $status, ':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Cập nhật trạng thái thành công']);
        } catch (\Throwable $e) {
            sanitizeErrorResponse($e, 'Lỗi cập nhật trạng thái chiến dịch.');
        }
        exit;
    }

    // Action: UPDATE BUDGET
    if ($action === 'update_budget') {
        $id = $input['id'];
        $budget = (float)$input['budget'];
        
        try {
            $stmt = $db->prepare("UPDATE `tiktok_campaigns` SET budget = :budget WHERE id = :id");
            $stmt->execute([':budget' => $budget, ':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Cập nhật ngân sách thành công']);
        } catch (\Throwable $e) {
            sanitizeErrorResponse($e, 'Lỗi cập nhật ngân sách chiến dịch.');
        }
        exit;
    }

    // Action: CREATE NEW CAMPAIGN
    if ($action === 'create') {
        $id = 'camp-' . time();
        $name = $input['name'];
        $type = $input['type'];
        $budget = (float)$input['budget'];
        $created_date = date('Y-m-d');

        try {
            $stmt = $db->prepare("INSERT INTO `tiktok_campaigns` (id, name, type, budget, spend, clicks, impressions, conversions, ad_gmv, status, created_date) 
                VALUES (:id, :name, :type, :budget, 0, 0, 0, 0, 0, 1, :created_date)");
            
            $stmt->execute([
                ':id' => $id,
                ':name' => $name,
                ':type' => $type,
                ':budget' => $budget,
                ':created_date' => $created_date
            ]);
            
            echo json_encode([
                'success' => true, 
                'message' => 'Tạo chiến dịch thành công',
                'data' => [
                    'id' => $id,
                    'name' => $name,
                    'type' => $type,
                    'budget' => $budget,
                    'spend' => 0,
                    'clicks' => 0,
                    'impressions' => 0,
                    'conversions' => 0,
                    'adGmv' => 0,
                    'status' => true,
                    'created' => $created_date
                ]
            ]);
        } catch (\Throwable $e) {
            sanitizeErrorResponse($e, 'Lỗi tạo mới chiến dịch.');
        }
        exit;
    }
}
