<?php
/**
 * ====================================================================
 * ADDP COMMERCE INTELLIGENCE - GIÁM ĐỐC MARKETING AI THỰC CHIẾN
 * File: public/api/commerce_ai_director_service.php
 *
 * Hỗ trợ 3 chế độ phân tích dữ liệu thật 100% (ZERO mock data):
 * 1. 'overview'       : Tổng quan tiến độ ngày/tháng, tỷ trọng Video 75% / Live 25%,
 *                       Chủ lực 80% / Phụ 20%, giải thích nguyên nhân & kế hoạch hành động.
 * 2. 'campaign_video' : Bể video quảng cáo (Tổng, Nổi bật, Hiệu quả, Đang khám phá,
 *                       Kém hiệu quả, Không phân phối, Vi phạm) đối soát định mức
 *                       (>=50 đang chạy, >=15 khám phá, 10-15 mới/ngày, <10% chi 0 đơn).
 * 3. 'live'           : Phân tích Ca 1 / Ca 2 theo 8 chỉ số & doanh số mục tiêu/ca,
 *                       kèm kịch bản cải thiện chi tiết cho ca Live tiếp theo.
 *
 * Ngôn ngữ: 100% Tiếng Việt phổ thông, dễ hiểu, tuyệt đối không dùng từ chuyên môn
 * tiếng Anh khó hiểu (không dùng CTR, CTOR, CVR, ROAS, Pacing, Cap, MTD).
 * ====================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/commerce_sop_pacing_service.php';
require_once __DIR__ . '/commerce_product_gmv_sop_service.php';
require_once __DIR__ . '/commerce_live_sop_service.php';

class CommerceAiDirectorService {
    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? getDBConnection();
    }

    private function tableExists(string $tableName): bool {
        try {
            $driver = (string)$this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $stmt = $this->db->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
                $stmt->execute([$tableName]);
                return (bool)$stmt->fetchColumn();
            }
            $stmt = $this->db->query("SHOW TABLES LIKE " . $this->db->quote($tableName));
            return (bool)$stmt->fetchColumn();
        } catch (\Throwable $t) {
            return false;
        }
    }

    private function getGeminiApiKey(): string {
        if ($this->tableExists('tiktok_config')) {
            try {
                $stmt = $this->db->query("SELECT gemini_api_key FROM `tiktok_config` ORDER BY id DESC LIMIT 1");
                $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
                if ($row && !empty($row['gemini_api_key'])) {
                    return trim((string)$row['gemini_api_key']);
                }
            } catch (\Throwable $t) {}
        }
        if (defined('GEMINI_API_KEY') && !empty(GEMINI_API_KEY)) {
            return trim((string)GEMINI_API_KEY);
        }
        return '';
    }

    private function fmtVnd(float $amount): string {
        return number_format(round($amount), 0, ',', '.') . 'đ';
    }

    private function fmtPct(?float $pct): string {
        if ($pct === null) return 'Chưa có số liệu';
        return number_format($pct, 1, ',', '.') . '%';
    }

    private function fmtRatio(?float $ratio): string {
        if ($ratio === null) return 'Chưa có số liệu';
        return number_format($ratio, 2, ',', '.') . ' lần';
    }

    private function callGemini(string $prompt): array {
        $apiKey = $this->getGeminiApiKey();
        if ($apiKey === '' || !function_exists('curl_init')) {
            return ['text' => null, 'model' => null];
        }

        $models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
        $payload = json_encode([
            'contents' => [
                ['parts' => [['text' => $prompt]]]
            ],
            'generationConfig' => [
                'temperature' => 0.4,
                'maxOutputTokens' => 2048,
            ],
        ], JSON_UNESCAPED_UNICODE);

        foreach ($models as $model) {
            $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . urlencode($apiKey);
            $ch = curl_init($url);
            if (!$ch) continue;
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
            curl_setopt($ch, CURLOPT_TIMEOUT, 20);

            $resp = curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($resp && $httpCode >= 200 && $httpCode < 300) {
                $decoded = json_decode($resp, true);
                $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? null;
                if (is_string($text) && trim($text) !== '') {
                    return ['text' => trim($text), 'model' => $model];
                }
            }
        }

        return ['text' => null, 'model' => null];
    }

    /**
     * Entry point for 3 Marketing Director analysis modes:
     * - 'overview'
     * - 'campaign_video'
     * - 'live'
     */
    public function analyze(string $shopId, string $mode, array $params = []): array {
        $normalizedMode = strtolower(trim($mode));
        if (!in_array($normalizedMode, ['overview', 'campaign_video', 'live'], true)) {
            $normalizedMode = 'overview';
        }

        $endDate = trim((string)($params['end_date'] ?? $params['date'] ?? date('Y-m-d')));
        $startDate = trim((string)($params['start_date'] ?? ''));

        if ($normalizedMode === 'overview') {
            $ovStart = $startDate !== '' ? $startDate : $endDate;
            return $this->analyzeOverview($shopId, $ovStart, $endDate, $params);
        }
        if ($startDate === '') {
            $startDate = date('Y-m-d', strtotime($endDate . ' -6 days'));
        }
        if ($normalizedMode === 'campaign_video') {
            return $this->analyzeCampaignVideo($shopId, $startDate, $endDate, $params);
        }
        return $this->analyzeLive($shopId, $startDate, $endDate, $params);
    }

    private function analyzeOverview(string $shopId, string $startDate, string $endDate, array $params): array {
        $pacingSvc = new CommerceSopPacingService($this->db);
        $overview = $pacingSvc->getPacingOverview($shopId, $endDate, null, $startDate, $endDate);

        $daysCount = max(1, (int)($overview['days_count'] ?? 1));
        $isRange = $daysCount > 1;
        $periodLabel = $isRange ? "Kỳ {$startDate} → {$endDate} ({$daysCount} ngày)" : "Ngày {$endDate}";

        $cfg = $overview['config'] ?? [];
        $pacing = $overview['pacing'] ?? [];
        $total = $pacing['total_shop'] ?? [];
        $video = $pacing['video_channel'] ?? [];
        $live = $pacing['live_channel'] ?? [];
        $mainSku = $video['main_sku'] ?? [];
        $subSku = $video['sub_sku'] ?? [];

        $dailyTarget = (float)($total['target_gmv'] ?? ($cfg['daily_gmv_target'] ?? 20000000));
        $dailyCap = (float)($total['daily_spend_cap'] ?? ($cfg['daily_spend_cap'] ?? 1538461));
        $targetRoi = (float)($cfg['target_roi'] ?? 13.0);

        $actualGmv = (float)($total['actual_gmv'] ?? 0);
        $actualSpend = (float)($total['actual_spend'] ?? 0);
        $actualRoi = $actualSpend > 0 ? round($actualGmv / $actualSpend, 2) : null;
        $gmvGapPct = $dailyTarget > 0 ? round((($actualGmv - $dailyTarget) / $dailyTarget) * 100, 1) : 0.0;

        $videoGmv = (float)($video['actual_gmv'] ?? 0);
        $liveGmv = (float)($live['actual_gmv'] ?? 0);
        $totalChannelGmv = $videoGmv + $liveGmv;
        $videoShare = $totalChannelGmv > 0 ? round(($videoGmv / $totalChannelGmv) * 100, 1) : 0.0;
        $liveShare = $totalChannelGmv > 0 ? round(($liveGmv / $totalChannelGmv) * 100, 1) : 0.0;

        $mainGmv = (float)($mainSku['actual_gmv'] ?? 0);
        $subGmv = (float)($subSku['actual_gmv'] ?? 0);
        $skuTotal = $mainGmv + $subGmv;
        $mainShare = $skuTotal > 0 ? round(($mainGmv / $skuTotal) * 100, 1) : 0.0;
        $subShare = $skuTotal > 0 ? round(($subGmv / $skuTotal) * 100, 1) : 0.0;

        $snapshot = [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'days_count' => $daysCount,
            'actual_gmv' => $actualGmv,
            'daily_gmv_target' => $dailyTarget,
            'actual_spend' => $actualSpend,
            'daily_spend_cap' => $dailyCap,
            'actual_roi' => $actualRoi,
            'target_roi' => $targetRoi,
            'video_gmv' => $videoGmv,
            'live_gmv' => $liveGmv,
            'video_share_pct' => $videoShare,
            'live_share_pct' => $liveShare,
            'main_sku_share_pct' => $mainShare,
            'sub_sku_share_pct' => $subShare,
        ];

        $prompt = "Bạn là Giám đốc Marketing Thực chiến cho gian hàng TikTok Shop. Hãy phân tích số liệu {$periodLabel} bằng Tiếng Việt phổ thông, dễ hiểu cho chủ shop & nhân sự vận hành.\n"
            . "QUY TẮC BẮT BUỘC: Tuyệt đối KHÔNG dùng từ chuyên môn tiếng Anh (cấm dùng ROAS, ROI, Pacing, Cap, MTD, CTR, CTOR, CVR, GMV). Hãy gọi là 'Doanh số', 'Tiền quảng cáo', 'Hiệu quả thu/chi', 'Giới hạn chi', 'Tiến độ doanh số'. Chỉ dùng đúng số liệu dưới đây:\n"
            . "- Doanh số toàn gian hàng ({$periodLabel}): " . $this->fmtVnd($actualGmv) . " / Mục tiêu kỳ: " . $this->fmtVnd($dailyTarget) . " (Chênh lệch: {$gmvGapPct}%)\n"
            . "- Tiền quảng cáo đã tiêu: " . $this->fmtVnd($actualSpend) . " / Giới hạn chi kỳ: " . $this->fmtVnd($dailyCap) . "\n"
            . "- Hiệu quả thu/chi thực tế: " . $this->fmtRatio($actualRoi) . " / Mục tiêu: " . $this->fmtRatio($targetRoi) . "\n"
            . "- Tỷ trọng kênh Video vs Live: Video " . $this->fmtVnd($videoGmv) . " ({$videoShare}% - mục tiêu 75%) | Live " . $this->fmtVnd($liveGmv) . " ({$liveShare}% - mục tiêu 25%)\n"
            . "- Tỷ trọng sản phẩm Chủ lực vs Sản phẩm phụ: Chủ lực {$mainShare}% (mục tiêu 80%) | Phụ {$subShare}% (mục tiêu 20%)\n\n"
            . "Trình bày ngắn gọn theo 3 phần:\n"
            . "1. Đánh giá tổng quan (Đạt hay Chưa đạt mục tiêu ngày & hiệu quả thu/chi)\n"
            . "2. Giải thích rõ TẠI SAO các chỉ số bị hụt hoặc lệch tỷ trọng (75/25 và 80/20)\n"
            . "3. Kế hoạch hành động từng bước (Ai làm gì, làm như thế nào ngay hôm nay).";

        $ai = $this->callGemini($prompt);
        $analysisText = $ai['text'];
        $source = $analysisText !== null ? 'gemini' : 'deterministic_director';

        if ($analysisText === null) {
            $reasons = [];
            $actions = [];

            if ($actualGmv < $dailyTarget) {
                $shortfall = $dailyTarget - $actualGmv;
                $reasons[] = "Doanh số {$periodLabel} mới đạt **" . $this->fmtVnd($actualGmv) . "**, còn thiếu **" . $this->fmtVnd($shortfall) . "** so với mục tiêu **" . $this->fmtVnd($dailyTarget) . "**.";
                if ($actualSpend < $dailyCap * 0.7) {
                    $reasons[] = "Tiền quảng cáo mới tiêu **" . $this->fmtVnd($actualSpend) . "** (chưa tới 70% giới hạn chi " . $this->fmtVnd($dailyCap) . "), cho thấy hệ thống chưa đủ video mới để cắn hết ngân sách.";
                    $actions[] = "**Đội Nội dung & KOC:** Bổ sung ngay 10–15 video mới trong ngày, tập trung 3 giây đầu đánh trực diện nỗi đau nóng trong/gan yếu và giới thiệu Combo 2–3 hộp.";
                }
            } else {
                $reasons[] = "Doanh số {$periodLabel} đạt **" . $this->fmtVnd($actualGmv) . "**, hoàn thành mục tiêu **" . $this->fmtVnd($dailyTarget) . "**.";
            }

            if ($actualRoi !== null && $actualRoi < $targetRoi) {
                $reasons[] = "Hiệu quả thu/chi hiện tại là **" . $this->fmtRatio($actualRoi) . "**, thấp hơn ngưỡng an toàn **" . $this->fmtRatio($targetRoi) . "** — chi phí quảng cáo đang ăn vào lợi nhuận.";
                $actions[] = "**Đội Chạy quảng cáo:** Kiểm tra và tắt ngay các video đã tiêu tiền nhưng 0 đơn hoặc hiệu quả thu/chi dưới ngưỡng hòa vốn; giữ lại nhóm video chủ lực.";
            }

            if ($totalChannelGmv > 0 && $liveShare < 20.0) {
                $reasons[] = "Kênh Live mới đóng góp **{$liveShare}%** (mục tiêu 25%), đang bị hụt lực kéo doanh số từ phiên phát trực tiếp.";
                $actions[] = "**Đội Livestream:** Tăng thời lượng lên tối thiểu 3 tiếng/ca (5 tiếng vào ngày sale), ghim sẵn Combo 2–3 hộp ở vị trí đầu giỏ và chạy mã giảm giá chớp nhoáng mỗi 30 phút.";
            }

            if ($skuTotal > 0 && $mainShare < 70.0) {
                $reasons[] = "Sản phẩm chủ lực mới chiếm **{$mainShare}%** (mục tiêu 80%), ngân sách đang bị dàn trải sang sản phẩm phụ.";
                $actions[] = "**Đội Vận hành (KT-VH):** Rà soát tồn kho sản phẩm chủ lực (đảm bảo đủ bán >= 3 ngày) và dồn 80% ngân sách quảng cáo về sản phẩm chủ lực.";
            }

            if (empty($actions)) {
                $actions[] = "**Toàn đội:** Duy trì nhịp sản xuất 10–15 video/ngày, giữ vững 2 ca Live đều đặn và kiểm tra tồn kho mỗi sáng trước khi mở ngân sách.";
            }

            $avgDailyLine = $isRange
                ? "- **Trung bình mỗi ngày:** Doanh số " . $this->fmtVnd($actualGmv / $daysCount) . "/ngày | Tiền quảng cáo " . $this->fmtVnd($actualSpend / $daysCount) . "/ngày\n"
                : '';

            $analysisText = "## Báo Cáo Giám Đốc Marketing — {$periodLabel}\n\n"
                . "### 1. Tình Hình Thực Tế So Với Mục Tiêu\n"
                . "- **Doanh số toàn gian hàng:** " . $this->fmtVnd($actualGmv) . " / Mục tiêu " . $this->fmtVnd($dailyTarget) . "\n"
                . $avgDailyLine
                . "- **Tiền quảng cáo đã tiêu:** " . $this->fmtVnd($actualSpend) . " / Giới hạn chi " . $this->fmtVnd($dailyCap) . "\n"
                . "- **Hiệu quả thu/chi:** " . $this->fmtRatio($actualRoi) . " (Mục tiêu: " . $this->fmtRatio($targetRoi) . ")\n"
                . "- **Tỷ trọng kênh:** Video {$videoShare}% (mục tiêu 75%) | Live {$liveShare}% (mục tiêu 25%)\n"
                . "- **Tỷ trọng sản phẩm:** Chủ lực {$mainShare}% (mục tiêu 80%) | Phụ {$subShare}% (mục tiêu 20%)\n\n"
                . "### 2. Vì Sao Chỉ Số Chưa Đạt / Cần Chú Ý\n"
                . "- " . implode("\n- ", $reasons) . "\n\n"
                . "### 3. Kế Hoạch Hành Động Từng Bước (Ai Làm Gì)\n"
                . "1. " . implode("\n2. ", $actions);
        }

        return [
            'mode' => 'overview',
            'shop_id' => $shopId,
            'source' => $source,
            'model' => $ai['model'],
            'headline' => $actualGmv >= $dailyTarget
                ? ($isRange ? "Đạt mục tiêu doanh số {$daysCount} ngày" : 'Đạt mục tiêu doanh số ngày')
                : 'Cần đẩy mạnh doanh số & tối ưu hiệu quả thu/chi',
            'analysis_markdown' => $analysisText,
            'metrics_snapshot' => $snapshot,
            'generated_at' => date('Y-m-d H:i:s'),
        ];
    }

    private function analyzeCampaignVideo(string $shopId, string $startDate, string $endDate, array $params): array {
        $svc = new CommerceProductGmvSopService($this->db);
        $dash = $svc->getDashboard($shopId, $startDate, $endDate);
        $pool = $dash['pool_health'] ?? [];
        $counts = $dash['status_counts'] ?? [];
        $combo = $dash['combo_aov'] ?? [];

        $totalVideos = (int)($counts['total'] ?? 0);
        $outstanding = (int)($counts['OUTSTANDING'] ?? 0);
        $effective = (int)($counts['EFFECTIVE'] ?? 0);
        $exploring = (int)($counts['EXPLORING'] ?? 0);
        $ineffective = (int)($counts['INEFFECTIVE'] ?? 0);
        $inactive = (int)($counts['INACTIVE'] ?? 0);
        $violating = (int)($counts['VIOLATING'] ?? 0);

        $activeCount = (int)($pool['active_delivering_count'] ?? ($outstanding + $effective + $exploring));
        $newPerDay = (float)($pool['avg_new_videos_per_day'] ?? 0.0);
        $zeroOrderSpendPct = (float)($pool['zero_order_spend_pct'] ?? 0.0);
        $avgAov = (float)($combo['avg_order_value'] ?? 0.0);

        $snapshot = [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total_videos' => $totalVideos,
            'outstanding' => $outstanding,
            'effective' => $effective,
            'exploring' => $exploring,
            'ineffective' => $ineffective,
            'inactive' => $inactive,
            'violating' => $violating,
            'active_delivering_count' => $activeCount,
            'avg_new_videos_per_day' => $newPerDay,
            'zero_order_spend_pct' => $zeroOrderSpendPct,
            'avg_order_value' => $avgAov,
        ];

        $prompt = "Bạn là Giám đốc Marketing Thực chiến TikTok Shop chuyên ngành Thực phẩm bảo vệ sức khỏe.\n"
            . "Hãy phân tích bể video quảng cáo từ {$startDate} đến {$endDate} bằng Tiếng Việt phổ thông (KHÔNG dùng từ tiếng Anh như CTR, CVR, ROAS, AOV, Pool, Creative Boost):\n"
            . "- Tổng số video: {$totalVideos} | Nổi bật: {$outstanding} | Có hiệu quả: {$effective} | Đang khám phá: {$exploring} | Kém hiệu quả: {$ineffective} | Không phân phối: {$inactive} | Vi phạm: {$violating}\n"
            . "- Video đang chạy quảng cáo: {$activeCount} (Định mức: >= 50 video)\n"
            . "- Video đang khám phá: {$exploring} (Định mức: >= 15 video)\n"
            . "- Video mới thêm mỗi ngày: {$newPerDay} (Định mức: 10–15 video/ngày)\n"
            . "- Tỷ lệ tiền tiêu vào video 0 đơn: {$zeroOrderSpendPct}% (Định mức: < 10%)\n"
            . "- Giá trị trung bình mỗi đơn: " . $this->fmtVnd($avgAov) . " (Mục tiêu Combo 2–3 hộp: 100.000đ–150.000đ)\n\n"
            . "Hãy chỉ rõ:\n"
            . "1. Bể video đang thiếu hay thừa ở nhóm nào so với định mức.\n"
            . "2. Cách cải thiện nội dung video để quảng cáo chịu cắn tiền và ra nhiều đơn hơn (3 giây đầu, lồng ghép Combo 2–3 hộp, né từ khóa cấm ngành thực phẩm bảo vệ sức khỏe như 'chữa dứt điểm', 'trị bệnh', 'cam kết khỏi').\n"
            . "3. Việc cần làm ngay trong 24 giờ tới cho từng bộ phận.";

        $ai = $this->callGemini($prompt);
        $analysisText = $ai['text'];
        $source = $analysisText !== null ? 'gemini' : 'deterministic_director';

        if ($analysisText === null) {
            $issues = [];
            $actions = [];

            if ($activeCount < 50) {
                $issues[] = "Số video đang chạy thực tế mới có **{$activeCount} video**, chưa đạt định mức tối thiểu **50 video** — đây là lý do chính khiến quảng cáo khó cắn hết ngân sách.";
                $actions[] = "**Đội Nội dung & Booking KOC:** Sản xuất và nạp thêm ít nhất **" . max(10, 50 - $activeCount) . " video mới** (mục tiêu 10–15 video/ngày) với 3 giây đầu đánh trực diện cảnh pha viên sủi mát lạnh + nỗi đau nóng trong, nổi mẩn.";
            }
            if ($exploring < 15) {
                $issues[] = "Nhóm video **Đang khám phá** chỉ có **{$exploring} video** (định mức >= 15 video), thiếu nguồn video kế cận thay thế khi video cũ bão hòa.";
            }
            if ($zeroOrderSpendPct >= 10.0) {
                $issues[] = "Tỷ lệ tiền quảng cáo đốt vào video **0 đơn hàng** đang ở mức **{$zeroOrderSpendPct}%** (vượt ngưỡng cho phép < 10%).";
                $actions[] = "**Đội Chạy quảng cáo:** Tắt ngay nhóm **Kém hiệu quả ({$ineffective} video)** đang tiêu tiền không ra đơn để dồn ngân sách sang **{$outstanding} video Nổi bật** và **{$effective} video Có hiệu quả**.";
            }
            if ($violating > 0) {
                $issues[] = "Có **{$violating} video Vi phạm** chính sách nội dung.";
                $actions[] = "**Đội Kiểm duyệt Nội dung:** Rà soát và gỡ bỏ ngay các từ khóa bị cấm trong ngành thực phẩm bảo vệ sức khỏe (tránh nói 'trị bệnh', 'chữa khỏi 100%', 'thuốc đặc trị'), đổi sang ngôn từ trải nghiệm hỗ trợ thanh nhiệt, giải độc gan.";
            }
            if ($avgAov > 0 && $avgAov < 100000) {
                $issues[] = "Giá trị trung bình mỗi đơn hàng mới đạt **" . $this->fmtVnd($avgAov) . "**, thấp hơn mục tiêu **100.000đ–150.000đ**.";
                $actions[] = "**Đội Nội dung & Vận hành:** Kịch bản video phải chốt lời kêu gọi mua **Combo 2–3 hộp** (tặng kèm quà/miễn phí vận chuyển) thay vì chỉ bán lẻ 1 hộp.";
            }

            if (empty($issues)) {
                $issues[] = "Quy mô bể video đang đạt chuẩn định mức vận hành ({$activeCount} video đang chạy, {$exploring} đang khám phá).";
            }
            if (empty($actions)) {
                $actions[] = "**Đội Nội dung:** Duy trì 10–15 video mới/ngày, nhân bản các mẫu 3 giây đầu đang có hiệu quả cao và gắn thẻ Combo 2–3 hộp.";
            }

            $analysisText = "## Đánh Giá Bể Video Quảng Cáo ({$startDate} → {$endDate})\n\n"
                . "### 1. Hiện Trạng Bể Video So Với Định Mức\n"
                . "- **Tổng video:** {$totalVideos} (Nổi bật: {$outstanding} | Có hiệu quả: {$effective} | Đang khám phá: {$exploring} | Kém hiệu quả: {$ineffective} | Không phân phối: {$inactive} | Vi phạm: {$violating})\n"
                . "- **Video đang chạy:** {$activeCount} / định mức >= 50\n"
                . "- **Tốc độ video mới/ngày:** {$newPerDay} / định mức 10–15 video/ngày\n"
                . "- **Tiền chi vào video 0 đơn:** {$zeroOrderSpendPct}% / định mức < 10%\n"
                . "- **Giá trị đơn trung bình:** " . $this->fmtVnd($avgAov) . " (Mục tiêu Combo 2–3 hộp: 100.000đ–150.000đ)\n\n"
                . "### 2. Chẩn Đoán Điểm Nghẽn\n"
                . "- " . implode("\n- ", $issues) . "\n\n"
                . "### 3. Hành Động Cải Thiện Nội Dung & Đơn Hàng Trong 24h\n"
                . "1. " . implode("\n2. ", $actions);
        }

        return [
            'mode' => 'campaign_video',
            'shop_id' => $shopId,
            'source' => $source,
            'model' => $ai['model'],
            'headline' => $activeCount >= 50 ? 'Quy mô bể video đạt chuẩn' : 'Cần bổ sung video mới để cắn ngân sách & tăng đơn',
            'analysis_markdown' => $analysisText,
            'metrics_snapshot' => $snapshot,
            'generated_at' => date('Y-m-d H:i:s'),
        ];
    }

    private function analyzeLive(string $shopId, string $startDate, string $endDate, array $params): array {
        $svc = new CommerceLiveSopService($this->db);
        $dash = $svc->getLiveSopDashboard($shopId, $startDate, $endDate);
        $cfg = $dash['config'] ?? [];
        $sessionTarget = (float)($cfg['session_gmv_target'] ?? 2500000);
        $ca1 = $dash['ca1'] ?? [];
        $ca2 = $dash['ca2'] ?? [];

        $ca1Gmv = (float)($ca1['gmv'] ?? 0);
        $ca2Gmv = (float)($ca2['gmv'] ?? 0);
        $ca1Met = $ca1Gmv >= $sessionTarget;
        $ca2Met = $ca2Gmv >= $sessionTarget;

        $funnel = $dash['funnel_diagnosis'] ?? ($ca1['funnel'] ?? ($ca2['funnel'] ?? []));
        $metrics = $funnel['metrics'] ?? [];
        $weakest = $funnel['weakest_link'] ?? null;

        $metricLines = [];
        $missedMetrics = [];
        foreach ($metrics as $m) {
            $label = $m['label_vi'] ?? $m['name'] ?? $m['key'] ?? '';
            $val = $m['actual_display'] ?? $m['actual'] ?? 'Chưa có';
            $target = $m['target_display'] ?? $m['target'] ?? '';
            $status = $m['status'] ?? '';
            $achieved = in_array(strtoupper((string)$status), ['PASS', 'OK', 'MET', 'ACHIEVED', 'GOOD'], true);
            $statusText = $achieved ? 'Đạt mục tiêu' : 'Chưa đạt';
            $metricLines[] = "- {$label}: {$val} (Mục tiêu: {$target}) → {$statusText}";
            if (!$achieved && $label !== '') {
                $missedMetrics[] = $label;
            }
        }

        $snapshot = [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'session_gmv_target' => $sessionTarget,
            'ca1_gmv' => $ca1Gmv,
            'ca1_achieved' => $ca1Met,
            'ca2_gmv' => $ca2Gmv,
            'ca2_achieved' => $ca2Met,
            'missed_metrics' => $missedMetrics,
        ];

        $prompt = "Bạn là Giám đốc Marketing Thực chiến chuyên tối ưu phòng phát trực tiếp TikTok Shop.\n"
            . "Hãy phân tích kết quả Live từ {$startDate} đến {$endDate} bằng Tiếng Việt phổ thông (KHÔNG dùng từ tiếng Anh như CTR, CTOR, CVR, ROAS, CPM, GMV, Live Funnel):\n"
            . "- Mục tiêu doanh số mỗi ca: " . $this->fmtVnd($sessionTarget) . "\n"
            . "- Ca 1 (trước 14h): " . $this->fmtVnd($ca1Gmv) . " → " . ($ca1Met ? 'Đạt mục tiêu' : 'Chưa đạt mục tiêu') . "\n"
            . "- Ca 2 (từ 14h trở đi): " . $this->fmtVnd($ca2Gmv) . " → " . ($ca2Met ? 'Đạt mục tiêu' : 'Chưa đạt mục tiêu') . "\n"
            . "Chi tiết 8 chỉ số phễu bán hàng:\n" . implode("\n", $metricLines) . "\n\n"
            . "Hãy trình bày:\n"
            . "1. Kết luận rõ Ca 1, Ca 2 và từng chỉ số đã Đạt hay Chưa đạt mục tiêu.\n"
            . "2. Giải thích nguyên nhân vì sao chỉ số bị hụt.\n"
            . "3. Kịch bản cải thiện cụ thể cho ca Live tiếp theo: ánh sáng/góc quay, câu nói giữ chân 5 giây đầu, sắp xếp 8 sản phẩm đầu giỏ hàng, cách ghim thẻ sản phẩm, tung deal chớp nhoáng và chốt Combo 2–3 hộp.";

        $ai = $this->callGemini($prompt);
        $analysisText = $ai['text'];
        $source = $analysisText !== null ? 'gemini' : 'deterministic_director';

        if ($analysisText === null) {
            $weakLabel = is_array($weakest) ? ($weakest['label_vi'] ?? $weakest['metric'] ?? 'Tỷ lệ giữ chân & chốt đơn') : 'Tỷ lệ giữ chân & chốt đơn';
            $analysisText = "## Đánh Giá Chuyên Sâu Ca Live ({$startDate} → {$endDate})\n\n"
                . "### 1. Kết Quả Doanh Số Theo Ca (Mục tiêu " . $this->fmtVnd($sessionTarget) . "/ca)\n"
                . "- **Ca 1 (trước 14h):** " . $this->fmtVnd($ca1Gmv) . " — **" . ($ca1Met ? 'Đạt mục tiêu' : 'Chưa đạt mục tiêu') . "**\n"
                . "- **Ca 2 (từ 14h trở đi):** " . $this->fmtVnd($ca2Gmv) . " — **" . ($ca2Met ? 'Đạt mục tiêu' : 'Chưa đạt mục tiêu') . "**\n\n"
                . "### 2. Đánh Giá 8 Chỉ Số Phễu Bán Hàng\n"
                . (!empty($metricLines) ? implode("\n", $metricLines) : "- Chưa đủ dữ liệu chi tiết 8 chỉ số cho kỳ này.") . "\n\n"
                . "### 3. Điểm Nghẽn Cần Sửa Ngay & Kịch Bản Ca Live Tiếp Theo\n"
                . "- **Điểm yếu lớn nhất:** {$weakLabel}.\n"
                . "1. **Ánh sáng & Hình ảnh:** Đảm bảo đèn chiếu sáng mặt người dẫn rõ nét, đặt cốc nước viên sủi đang sủi bọt ngay trước ống kính để tạo điểm nhấn thị giác.\n"
                . "2. **5 giây đầu giữ chân người xem:** Người dẫn nói thẳng vấn đề nóng trong, nổi mẩn, thức khuya và đọc ngay ưu đãi Combo đang ghim.\n"
                . "3. **Sắp xếp 8 món đầu giỏ hàng:** Đặt sản phẩm chủ lực và các gói **Combo 2–3 hộp** ở vị trí số 1 đến số 4 để khách mới vào nhìn thấy ngay.\n"
                . "4. **Ghim thẻ & Deal chớp nhoáng:** Cứ mỗi 20–30 phút tung 1 đợt giảm giá chớp nhoáng giới hạn 5–10 suất cho Combo 2–3 hộp, nhắc người xem bấm nút mua ngay khi thẻ ghim nhấp nháy.";
        }

        return [
            'mode' => 'live',
            'shop_id' => $shopId,
            'source' => $source,
            'model' => $ai['model'],
            'headline' => ($ca1Met && $ca2Met) ? 'Cả 2 ca Live đều đạt mục tiêu doanh số' : 'Cần tối ưu 8 chỉ số phễu & kịch bản chốt đơn ca Live tới',
            'analysis_markdown' => $analysisText,
            'metrics_snapshot' => $snapshot,
            'generated_at' => date('Y-m-d H:i:s'),
        ];
    }
}

// Standalone HTTP Router when invoked directly
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    require_once __DIR__ . '/auth_guard.php';
    header('Content-Type: application/json; charset=utf-8');
    handleCORS();

    requireAuth('admin:all');

    $db = getDBConnection();
    $service = new CommerceAiDirectorService($db);

    $rawInput = file_get_contents('php://input');
    $jsonBody = $rawInput ? json_decode($rawInput, true) : [];
    if (!is_array($jsonBody)) {
        $jsonBody = [];
    }

    $action = trim((string)($_GET['action'] ?? $_POST['action'] ?? $jsonBody['action'] ?? 'analyze_sop_director'));
    $shopId = trim((string)($_GET['shop_id'] ?? $_POST['shop_id'] ?? $jsonBody['shop_id'] ?? ''));
    if ($shopId === '') {
        try {
            $stmtShop = $db->query("SELECT shop_id FROM `tiktok_config` WHERE shop_id IS NOT NULL AND shop_id != '' ORDER BY updated_at DESC LIMIT 1");
            $shopId = (string)($stmtShop ? $stmtShop->fetchColumn() : '');
        } catch (\Throwable $t) {}
    }

    try {
        if ($action === 'analyze_sop_director') {
            $mode = trim((string)($jsonBody['mode'] ?? $_POST['mode'] ?? $_GET['mode'] ?? 'overview'));
            $params = array_merge($_GET, $jsonBody);
            $data = $service->analyze($shopId, $mode, $params);
            echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Action không hợp lệ: ' . $action], JSON_UNESCAPED_UNICODE);
        }
    } catch (\Throwable $t) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $t->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}
