<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - CREATIVES & VIDEO INTELLIGENCE SERVICE
 * Component: P0-02 Video Affiliate Intelligence & Creative Attribution
 * 
 * Target:
 * 1. Zero Production Mock Records: Removed all hardcoded sample videos,
 *    fabricated impressions, clicks, GMV and CVR.
 * 2. Real API & Database Backed: Queries authoritative records from
 *    tiktok_video_ads, commerce_video_analytics, and commerce_affiliate_orders.
 * 3. Verified Cancellation Linking: Returns real cancellation data from
 *    commerce_affiliate_orders where content_id matches video_id.
 *    Never invents speculative percentages or crc32-modulo fake rates.
 * ====================================================================
 */

if (php_sapi_name() !== 'cli' && basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'creatives_data.php') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Direct script access forbidden']);
    exit;
}

require_once __DIR__ . '/db.php';

/**
 * Lấy danh sách video sáng tạo thực tế từ cơ sở dữ liệu (Zero Hardcoded Mock)
 */
function getComprehensiveCreativesList(?PDO $db = null): array {
    try {
        $db = $db ?? getDBConnection();
        $stmt = $db->query("SELECT * FROM `tiktok_video_ads` ORDER BY spend DESC, conversions DESC");
        $dbVideos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($dbVideos)) {
            return $dbVideos;
        }
    } catch (\Throwable $e) {}

    return [];
}

/**
 * Trả về thống kê toàn bộ Bể Video Sáng Tạo thực tế từ database
 */
function getCreativePoolSummary(?PDO $db = null): array {
    $db = $db ?? getDBConnection();
    if ($db) {
        try {
            $total = (int)$db->query("SELECT COUNT(*) FROM `tiktok_video_ads`")->fetchColumn();
            $active = (int)$db->query("SELECT COUNT(*) FROM `tiktok_video_ads` WHERE spend > 0")->fetchColumn();
            $unallocated = max(0, $total - $active);
            $star = (int)$db->query("SELECT COUNT(*) FROM `tiktok_video_ads` WHERE status_quadrant = 'star'")->fetchColumn();
            $bleeding = (int)$db->query("SELECT COUNT(*) FROM `tiktok_video_ads` WHERE status_quadrant = 'bleeding'")->fetchColumn();
            $testing = (int)$db->query("SELECT COUNT(*) FROM `tiktok_video_ads` WHERE status_quadrant = 'testing'")->fetchColumn();
            $dormant = (int)$db->query("SELECT COUNT(*) FROM `tiktok_video_ads` WHERE status_quadrant = 'dormant'")->fetchColumn();
            return [
                'total_videos' => $total,
                'unallocated_videos' => $unallocated,
                'active_delivering_videos' => $active,
                'star_videos' => $star,
                'bleeding_videos' => $bleeding,
                'testing_videos' => $testing,
                'dormant_videos' => $dormant
            ];
        } catch (\Throwable $e) {}
    }

    return [
        'total_videos' => 0,
        'unallocated_videos' => 0,
        'active_delivering_videos' => 0,
        'star_videos' => 0,
        'bleeding_videos' => 0,
        'testing_videos' => 0,
        'dormant_videos' => 0
    ];
}

/**
 * Phân loại định dạng kịch bản và đối soát hoàn hủy xác thực từ TikTok Shop API
 * (Loại bỏ triệt để công thức giả lập crc32 và dữ liệu mock)
 */
function determineVideoScriptAndCancellation(array $video, ?PDO $db = null): array {
    $id = (string)($video['id'] ?? '');
    $title = (string)($video['title'] ?? '');
    $convs = (int)($video['conversions'] ?? 0);
    $author = (string)($video['author_name'] ?? '');

    $lowTitle = function_exists('mb_strtolower') ? mb_strtolower($title, 'UTF-8') : strtolower($title);
    $lowAuthor = function_exists('mb_strtolower') ? mb_strtolower($author, 'UTF-8') : strtolower($author);

    // Xác định phân loại kịch bản dựa trên từ khóa tiêu đề thực tế
    $scriptType = 'general';
    $hookSummary = 'Nội dung video sáng tạo quảng bá sản phẩm';

    if (str_contains($lowTitle, 'dược') || str_contains($lowTitle, 'bác sĩ') || str_contains($lowTitle, 'chuyên gia') || str_contains($lowTitle, 'men gan') || str_contains($lowAuthor, 'dược') || str_contains($lowAuthor, 'bác sĩ')) {
        $scriptType = 'duoc_si';
        $hookSummary = 'Dược sĩ / Chuyên gia chia sẻ kiến thức chăm sóc gan';
    } elseif (str_contains($lowTitle, 'mukbang') || str_contains($lowTitle, 'cay nóng') || str_contains($lowTitle, 'lẩu') || str_contains($lowAuthor, 'mukbang')) {
        $scriptType = 'mukbang';
        $hookSummary = 'Trải nghiệm ăn uống đồ cay nóng và thanh nhiệt';
    } elseif (str_contains($lowTitle, 'thử thách') || str_contains($lowTitle, 'tan') || str_contains($lowTitle, 'bọt') || str_contains($lowTitle, 'cận cảnh')) {
        $scriptType = 'visual_demo';
        $hookSummary = 'Trực quan demo hòa tan viên sủi thanh mát';
    } elseif (str_contains($lowTitle, 'combo') || str_contains($lowTitle, 'flash sale') || str_contains($lowTitle, 'ưu đãi') || str_contains($lowTitle, 'giá hời')) {
        $scriptType = 'flash_sale';
        $hookSummary = 'Chương trình ưu đãi combo giá tốt trên Shop Tab';
    } elseif (str_contains($lowTitle, 'nhậu') || str_contains($lowTitle, 'thức khuya') || str_contains($lowTitle, 'văn phòng')) {
        $scriptType = 'lifestyle';
        $hookSummary = 'Giải pháp sức khỏe cho người thức khuya, bia rượu';
    }

    // Đối soát hoàn hủy và đơn hàng thực tế qua bảng commerce_affiliate_orders (nếu có liên kết)
    $totalOrders = $convs;
    $cancelledOrders = 0;
    $cancelRate = 0.0;
    $cancelledGmv = 0.0;
    $cancelRiskLevel = 'safe';
    $cancelNotes = 'Chưa phát hiện đơn hủy từ dữ liệu đối soát API.';

    if ($db && $id !== '') {
        try {
            $stmtAff = $db->prepare("SELECT 
                COUNT(DISTINCT affiliate_order_id) as total_aff_orders,
                COUNT(DISTINCT CASE WHEN order_status = 'CANCELLED' THEN affiliate_order_id END) as canc_orders,
                COALESCE(SUM(CASE WHEN order_status = 'CANCELLED' THEN order_amount ELSE 0.0 END), 0.0) as canc_gmv
                FROM `commerce_affiliate_orders`
                WHERE content_id = :cid");
            $stmtAff->execute([':cid' => $id]);
            $rowAff = $stmtAff->fetch(PDO::FETCH_ASSOC);

            if ($rowAff && (int)$rowAff['total_aff_orders'] > 0) {
                $totalAff = (int)$rowAff['total_aff_orders'];
                $cancAff = (int)$rowAff['canc_orders'];
                $cancGmvAff = (float)$rowAff['canc_gmv'];

                $totalOrders = max($convs, $totalAff);
                $cancelledOrders = $cancAff;
                $cancelledGmv = $cancGmvAff;
                $cancelRate = $totalOrders > 0 ? round(($cancelledOrders / $totalOrders) * 100, 2) : 0.0;

                if ($cancelRate >= 15.0) {
                    $cancelRiskLevel = 'critical';
                    $cancelNotes = "Tỷ lệ hủy cao ({$cancelRate}%), ghi nhận {$cancelledOrders} đơn hủy từ TikTok API.";
                } elseif ($cancelRate >= 8.0) {
                    $cancelRiskLevel = 'warning';
                    $cancelNotes = "Tỷ lệ hủy mức cảnh báo ({$cancelRate}%), ghi nhận {$cancelledOrders} đơn hủy từ TikTok API.";
                } else {
                    $cancelRiskLevel = 'safe';
                    $cancelNotes = "Tỷ lệ hủy an toàn ({$cancelRate}%).";
                }
            }
        } catch (\Throwable $t) {}
    }

    return [
        'script_type' => $scriptType,
        'script_hook_summary' => $hookSummary,
        'total_orders' => $totalOrders,
        'cancelled_orders' => $cancelledOrders,
        'cancel_rate' => $cancelRate,
        'cancelled_gmv' => $cancelledGmv,
        'cancel_risk_level' => $cancelRiskLevel,
        'cancel_reason_notes' => $cancelNotes
    ];
}

/**
 * Đánh giá và phân loại các video trong database dựa trên số liệu thực tế và đối soát Target ROI
 */
function syncCreativesToDatabase($db, $startDate, $endDate, $campaignsTotalSpend, $campaignsTotalGmv, $campaignsTotalOrders) {
    try {
        $cStmt = $db->query("SELECT id, target_roas FROM `tiktok_campaigns`");
        $campTargetRoasMap = [];
        while ($r = $cStmt->fetch(PDO::FETCH_ASSOC)) {
            $campTargetRoasMap[$r['id']] = (float)($r['target_roas'] ?? 6.00);
        }

        $vids = $db->query("SELECT * FROM `tiktok_video_ads`")->fetchAll(PDO::FETCH_ASSOC);
        if (empty($vids)) return;

        // Gom nhóm video theo campaign_id để xếp hạng chuẩn xác
        $vidsByCamp = [];
        foreach ($vids as $v) {
            $cId = (string)($v['campaign_id'] ?? 'default');
            $vidsByCamp[$cId][] = $v;
        }

        $stmtUp = $db->prepare("UPDATE `tiktok_video_ads` SET 
            status_quadrant = :quadrant, 
            action_recommendation = :action, 
            target_roas = :target_roas,
            delivery_group = :delivery_group,
            delivery_status = :delivery_status,
            why_spending = :why_spending,
            why_not_spending = :why_not_spending,
            script_type = :script_type,
            script_hook_summary = :script_hook_summary,
            total_orders = :total_orders,
            cancelled_orders = :cancelled_orders,
            cancel_rate = :cancel_rate,
            cancelled_gmv = :cancelled_gmv,
            cancel_risk_level = :cancel_risk_level,
            cancel_reason_notes = :cancel_reason_notes
            WHERE id = :id");

        foreach ($vidsByCamp as $cId => $campVideos) {
            $targetRoas = (float)($campTargetRoasMap[$cId] ?? 6.00);
            if ($targetRoas <= 0) $targetRoas = 6.00;

            $spendingVids = [];
            $zeroVids = [];
            foreach ($campVideos as $v) {
                if ((float)($v['spend'] ?? 0) > 0) {
                    $spendingVids[] = $v;
                } else {
                    $zeroVids[] = $v;
                }
            }

            usort($spendingVids, function($a, $b) {
                $gmvA = (float)($a['gmv'] ?? 0);
                $gmvB = (float)($b['gmv'] ?? 0);
                if ($gmvA != $gmvB) return $gmvB <=> $gmvA;
                $convA = (int)($a['conversions'] ?? 0);
                $convB = (int)($b['conversions'] ?? 0);
                if ($convA != $convB) return $convB <=> $convA;
                return (float)($b['spend'] ?? 0) <=> (float)($a['spend'] ?? 0);
            });

            foreach ($spendingVids as $idx => $v) {
                $vSpend = (float)($v['spend'] ?? 0);
                $vGmv = (float)($v['gmv'] ?? 0);
                $vConvs = (int)($v['conversions'] ?? 0);
                $vRoas = $vSpend > 0 ? round($vGmv / $vSpend, 2) : 0.0;

                $deliveryGroup = 'effective';
                $deliveryStatus = 'effective';

                if ($vRoas >= $targetRoas && $vConvs > 0) {
                    $quadrant = 'star';
                    $actionRec = 'scale';
                    $whySpending = "Hiệu suất vượt trội (ROAS {$vRoas}x ≥ Mục tiêu {$targetRoas}x).";
                    $whyNotSpending = "Đang được ưu tiên phân bổ ngân sách tối đa.";
                } elseif ($vRoas > 0) {
                    $quadrant = 'testing';
                    $actionRec = 'maintain';
                    $whySpending = "Có chuyển đổi tốt, ROAS đạt {$vRoas}x.";
                    $whyNotSpending = "Cần theo dõi thêm để tối ưu chi phí.";
                } else {
                    $quadrant = 'bleeding';
                    $actionRec = 'review';
                    $whySpending = "Phát sinh chi phí nhưng chưa tạo doanh thu.";
                    $whyNotSpending = "Cần kiểm tra lại nội dung và tệp đối tượng.";
                }

                $sc = determineVideoScriptAndCancellation($v, $db);

                $stmtUp->execute([
                    ':quadrant' => $quadrant,
                    ':action' => $actionRec,
                    ':target_roas' => $targetRoas,
                    ':delivery_group' => $deliveryGroup,
                    ':delivery_status' => $deliveryStatus,
                    ':why_spending' => $whySpending,
                    ':why_not_spending' => $whyNotSpending,
                    ':script_type' => $sc['script_type'],
                    ':script_hook_summary' => $sc['script_hook_summary'],
                    ':total_orders' => $sc['total_orders'],
                    ':cancelled_orders' => $sc['cancelled_orders'],
                    ':cancel_rate' => $sc['cancel_rate'],
                    ':cancelled_gmv' => $sc['cancelled_gmv'],
                    ':cancel_risk_level' => $sc['cancel_risk_level'],
                    ':cancel_reason_notes' => $sc['cancel_reason_notes'],
                    ':id' => $v['id']
                ]);
            }

            foreach ($zeroVids as $v) {
                $quadrant = 'unallocated';
                $actionRec = 'activate';
                $deliveryGroup = 'ineligible';
                $deliveryStatus = 'inactive';
                $whySpending = "Chưa phát sinh lượt phân phối quảng cáo.";
                $whyNotSpending = "Chưa được kích hoạt ngân sách trong chiến dịch.";

                $sc = determineVideoScriptAndCancellation($v, $db);

                $stmtUp->execute([
                    ':quadrant' => $quadrant,
                    ':action' => $actionRec,
                    ':target_roas' => $targetRoas,
                    ':delivery_group' => $deliveryGroup,
                    ':delivery_status' => $deliveryStatus,
                    ':why_spending' => $whySpending,
                    ':why_not_spending' => $whyNotSpending,
                    ':script_type' => $sc['script_type'],
                    ':script_hook_summary' => $sc['script_hook_summary'],
                    ':total_orders' => $sc['total_orders'],
                    ':cancelled_orders' => $sc['cancelled_orders'],
                    ':cancel_rate' => $sc['cancel_rate'],
                    ':cancelled_gmv' => $sc['cancelled_gmv'],
                    ':cancel_risk_level' => $sc['cancel_risk_level'],
                    ':cancel_reason_notes' => $sc['cancel_reason_notes'],
                    ':id' => $v['id']
                ]);
            }
        }
    } catch (\Throwable $e) {
        error_log("Failed to sync creatives to database: " . $e->getMessage());
    }
}

/**
 * Đồng bộ chuỗi báo cáo số liệu hàng ngày (Daily Reports) thực tế từ TikTok Ads API (F04 fix)
 */
function syncDailyReportsToDatabase($db) {
    if (!$db) return;
    try {
        $configRow = $db->query("SELECT ads_access_token, advertiser_id, shop_id FROM `tiktok_config` LIMIT 1")->fetch(PDO::FETCH_ASSOC);
        if (!$configRow || empty($configRow['ads_access_token'])) return;

        $token = $configRow['ads_access_token'];
        $advId = $configRow['advertiser_id'];
        $shopId = $configRow['shop_id'] ?? '7495657895504611503';
        
        $startDate = date('Y-m-d', strtotime('-29 days'));
        $endDate = date('Y-m-d');

        // 1. Lấy báo cáo theo ngày của GMV Max
        $gmvReports = [];
        if (function_exists('requestTikTokAdsAPI')) {
            try {
                $gmvRes = requestTikTokAdsAPI('/gmv_max/report/get/', [
                    'advertiser_id' => $advId,
                    'store_ids' => [$shopId],
                    'dimensions' => ['campaign_id', 'stat_time_day'],
                    'metrics' => ['cost', 'gross_revenue', 'roi', 'orders', 'cost_per_order'],
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'page' => 1,
                    'page_size' => 100
                ], $token);
                $gmvReports = $gmvRes['data']['list'] ?? [];
            } catch (\Throwable $e) {
                try {
                    $todayRes = requestTikTokAdsAPI('/gmv_max/report/get/', [
                        'advertiser_id' => $advId,
                        'store_ids' => [$shopId],
                        'dimensions' => ['campaign_id'],
                        'metrics' => ['cost', 'gross_revenue', 'roi', 'orders', 'cost_per_order'],
                        'start_date' => $endDate,
                        'end_date' => $endDate,
                        'page' => 1,
                        'page_size' => 100
                    ], $token);
                    $todayList = $todayRes['data']['list'] ?? [];
                    foreach ($todayList as $item) {
                        $item['dimensions']['stat_time_day'] = $endDate;
                        $gmvReports[] = $item;
                    }
                } catch (\Throwable $e2) {}
            }

            // 2. Lấy báo cáo theo ngày của chiến dịch thường
            $stdReports = [];
            try {
                $stdRes = requestTikTokAdsAPI('/report/integrated/get/', [
                    'advertiser_id' => $advId,
                    'report_type' => 'BASIC',
                    'data_level' => 'AUCTION_CAMPAIGN',
                    'dimensions' => ['campaign_id', 'stat_time_day'],
                    'metrics' => ['spend', 'impressions', 'clicks', 'ctr', 'onsite_shopping', 'onsite_shopping_roas'],
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'page' => 1,
                    'page_size' => 100
                ], $token);
                $stdReports = $stdRes['data']['list'] ?? [];
            } catch (\Throwable $e) {}

            $stmtIns = $db->prepare("INSERT INTO `tiktok_campaign_daily_reports` 
                (campaign_id, stat_date, spend, gmv, orders, roi, cpa) 
                VALUES (:cid, :sdate, :spend, :gmv, :orders, :roi, :cpa)
                ON DUPLICATE KEY UPDATE 
                spend = VALUES(spend),
                gmv = VALUES(gmv),
                orders = VALUES(orders),
                roi = VALUES(roi),
                cpa = VALUES(cpa)");

            // Lưu GMV Max reports thực tế
            foreach ($gmvReports as $row) {
                $cId = $row['dimensions']['campaign_id'] ?? null;
                $rawDate = $row['dimensions']['stat_time_day'] ?? null;
                if (!$cId || !$rawDate) continue;
                $sDate = substr($rawDate, 0, 10);
                $m = $row['metrics'] ?? [];
                $spend = (float)($m['cost'] ?? 0);
                $gmv = (float)($m['gross_revenue'] ?? 0);
                $orders = (int)($m['orders'] ?? 0);
                $roi = (float)($m['roi'] ?? ($spend > 0 ? round($gmv / $spend, 2) : 0));
                $cpa = (float)($m['cost_per_order'] ?? ($orders > 0 ? round($spend / $orders, 0) : 0));

                $stmtIns->execute([
                    ':cid' => $cId,
                    ':sdate' => $sDate,
                    ':spend' => $spend,
                    ':gmv' => $gmv,
                    ':orders' => $orders,
                    ':roi' => $roi,
                    ':cpa' => $cpa
                ]);
            }

            // Lưu Standard reports thực tế
            foreach ($stdReports as $row) {
                $cId = $row['dimensions']['campaign_id'] ?? null;
                $rawDate = $row['dimensions']['stat_time_day'] ?? null;
                if (!$cId || !$rawDate) continue;
                $sDate = substr($rawDate, 0, 10);
                $m = $row['metrics'] ?? [];
                $spend = (float)($m['spend'] ?? 0);
                $roas = (float)($m['onsite_shopping_roas'] ?? 0);
                $gmv = $spend * $roas;
                $orders = (int)($m['onsite_shopping'] ?? 0);
                $roi = $roas;
                $cpa = $orders > 0 ? round($spend / $orders, 0) : 0;

                $stmtIns->execute([
                    ':cid' => $cId,
                    ':sdate' => $sDate,
                    ':spend' => $spend,
                    ':gmv' => $gmv,
                    ':orders' => $orders,
                    ':roi' => $roi,
                    ':cpa' => $cpa
                ]);
            }
        }
    } catch (\Throwable $e) {
        error_log("Failed to sync daily reports: " . $e->getMessage());
    }
}
