import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Copy,
  Check,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Target,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Package,
  Trash2,
  Lock,
  Activity,
  Save,
  Eye,
  EyeOff,
  Bot
} from 'lucide-react';

const STATUS_META = {
  OUTSTANDING: { label: 'Nổi bật', bg: '#dcfce7', color: '#166534', border: '#86efac' },
  EFFECTIVE: { label: 'Có hiệu quả', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  EXPLORING: { label: 'Đang khám phá', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  INEFFECTIVE: { label: 'Kém hiệu quả', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  INACTIVE: { label: 'Không phân phối', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }
};

const SOURCE_MODE_LABELS = {
  CREATIVE_DAILY_API: 'Dữ liệu Video Quảng cáo',
  PRODUCT_GMV_MAX_FALLBACK: 'Dữ liệu Sản phẩm Quảng cáo',
  CAMPAIGN_PRODUCT_FALLBACK: 'Dữ liệu Chiến dịch Sản phẩm',
  VIDEO_ANALYTICS_FALLBACK: 'Dữ liệu Video Kênh',
  TIKTOK_VIDEO_ADS_FALLBACK: 'Dữ liệu Video Quảng cáo',
  NONE: 'Chưa có dữ liệu'
};

const CONFIG_SOURCE_LABELS = {
  commerce_sop_config: 'Theo cấu hình đã lưu',
  USER_OVERRIDE: 'Tùy chỉnh trực tiếp',
  SOP_DEFAULT: 'Mặc định hệ thống'
};

function getDefaultDateRange(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function isInactiveOrZeroVideo(v) {
  return (
    v.sop_status === 'INACTIVE' ||
    (Number(v.spend || 0) <= 0 && Number(v.gmv || 0) <= 0 && Number(v.orders || 0) <= 0)
  );
}

export default function CommerceGmvMaxPlaybookView({
  shopId = '7495657895504611503',
  apiRequest,
  startDate: propStartDate,
  endDate: propEndDate
}) {
  const initialRange = useMemo(() => getDefaultDateRange(30), []);
  const [rangeDays, setRangeDays] = useState(30);
  const [startDate, setStartDate] = useState(propStartDate || initialRange.startDate);
  const [endDate, setEndDate] = useState(propEndDate || initialRange.endDate);

  const [loading, setLoading] = useState(true);
  const [savingRoi, setSavingRoi] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);

  const [breakevenRoi, setBreakevenRoi] = useState(13.0);
  const [targetRoi, setTargetRoi] = useState(15.0);
  const [hasUserEditedRoi, setHasUserEditedRoi] = useState(false);

  const [activeStatusTab, setActiveStatusTab] = useState('ALL');
  const [showInactiveVideos, setShowInactiveVideos] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiReport, setAiReport] = useState(null);

  const [syncing, setSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState(null);

  useEffect(() => {
    if (propStartDate) setStartDate(propStartDate);
    if (propEndDate) setEndDate(propEndDate);
  }, [propStartDate, propEndDate]);

  const fetchDashboard = useCallback(async (sDate = startDate, eDate = endDate, overrideTarget = null, overrideBreakeven = null) => {
    if (!apiRequest) return;
    setLoading(true);
    setError(null);
    try {
      let url = `commerce_product_gmv_sop_service.php?action=get_product_gmv_sop_dashboard&shop_id=${encodeURIComponent(shopId)}&start_date=${encodeURIComponent(sDate)}&end_date=${encodeURIComponent(eDate)}`;
      if (overrideTarget !== null && overrideTarget > 0) {
        url += `&target_roi=${encodeURIComponent(overrideTarget)}`;
      }
      if (overrideBreakeven !== null && overrideBreakeven > 0) {
        url += `&breakeven_roi=${encodeURIComponent(overrideBreakeven)}`;
      }
      const res = await apiRequest(url);
      if (res && res.success && res.data) {
        setData(res.data);
        if (overrideTarget === null && overrideBreakeven === null && !hasUserEditedRoi && res.data.roi_config) {
          setBreakevenRoi(Number(res.data.roi_config.breakeven_roi || 13.0));
          setTargetRoi(Number(res.data.roi_config.target_roi || 15.0));
        }
      } else {
        setError(res?.message || 'Không thể tải dữ liệu kho video quảng cáo.');
      }
    } catch (err) {
      setError(err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [shopId, apiRequest, startDate, endDate, hasUserEditedRoi]);

  useEffect(() => {
    fetchDashboard(startDate, endDate, hasUserEditedRoi ? targetRoi : null, hasUserEditedRoi ? breakevenRoi : null);
  }, [fetchDashboard, startDate, endDate, hasUserEditedRoi, targetRoi, breakevenRoi]);

  const handleRangeChange = (days) => {
    setRangeDays(days);
    const r = getDefaultDateRange(days);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
  };

  const handleApplyAndSaveRoi = async () => {
    if (!apiRequest) return;
    setSavingRoi(true);
    setSaveMsg(null);
    try {
      const saveRes = await apiRequest('commerce_product_gmv_sop_service.php?action=save_roi_config', 'POST', {
        shop_id: shopId,
        target_roi: targetRoi,
        breakeven_roi: breakevenRoi
      });
      if (saveRes?.message) {
        setSaveMsg(saveRes.message);
        globalThis.setTimeout(() => setSaveMsg(null), 3500);
      }
    } catch {
      // Vẫn áp dụng mức hoàn vốn mới cho phiên xem hiện tại
    } finally {
      setSavingRoi(false);
    }
    fetchDashboard(startDate, endDate, targetRoi, breakevenRoi);
  };

  const handleSyncTikTokAds = async () => {
    if (!apiRequest) return;
    setSyncing(true);
    setSyncBanner(null);
    try {
      const res = await apiRequest(
        `commerce_dashboard.php?action=trigger_sync&domain=ads_all&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&shop_id=${encodeURIComponent(shopId)}`,
        'POST'
      );
      if (res && res.success) {
        const d = res.data || res;
        const msg = res.message || d.message || 'Đã đồng bộ dữ liệu Video & Chiến dịch thực tế từ TikTok.';
        setSyncBanner({ type: 'success', text: msg });
        await fetchDashboard(startDate, endDate, hasUserEditedRoi ? targetRoi : null, hasUserEditedRoi ? breakevenRoi : null);
      } else {
        setSyncBanner({ type: 'error', text: res?.message || 'Không thể đồng bộ dữ liệu từ TikTok.' });
      }
    } catch (err) {
      setSyncBanner({ type: 'error', text: err?.message || 'Lỗi kết nối khi đồng bộ dữ liệu TikTok.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleAskAiDirector = async () => {
    if (!apiRequest) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiRequest('commerce_dashboard.php?action=analyze_sop_director', 'POST', {
        mode: 'campaign_video',
        shop_id: shopId,
        start_date: startDate,
        end_date: endDate
      });
      if (res && res.success) {
        setAiReport(res.data || res);
      } else {
        setAiError(res?.message || 'Không thể lấy phân tích từ Giám đốc Tiếp thị AI.');
      }
    } catch (err) {
      setAiError(err?.message || 'Lỗi kết nối đến Giám đốc Tiếp thị AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyIds = (key, ids) => {
    if (!ids || ids.length === 0) return;
    if (globalThis.navigator?.clipboard) {
      globalThis.navigator.clipboard.writeText(ids.join(', '));
    }
    setCopiedKey(key);
    globalThis.setTimeout(() => setCopiedKey(null), 2500);
  };

  const formatVND = (num) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);

  const formatNumber = (num) =>
    new Intl.NumberFormat('vi-VN').format(num || 0);

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
        <RefreshCw size={28} className="spin" style={{ color: '#2563eb', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Đang phân tích Kho Video Quảng Cáo & Giá Trị Đơn Combo...</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Tổng hợp dữ liệu thực tế từ Video, Đơn hàng & Giá vốn sản phẩm</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: '24px', background: '#fef2f2', borderRadius: '14px', border: '1px solid #fecaca', color: '#991b1b' }}>
        <div style={{ fontWeight: '700', fontSize: '14px' }}>Lỗi tải dữ liệu Kho Video Quảng Cáo</div>
        <div style={{ fontSize: '13px', marginTop: '6px' }}>{error}</div>
        <button
          type="button"
          onClick={() => fetchDashboard(startDate, endDate, targetRoi, breakevenRoi)}
          style={{ marginTop: '12px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  const {
    roi_config = {},
    breakeven_cpa_info = {},
    overall_stats = {},
    pool_health = {},
    status_buckets = [],
    videos = [],
    roi_lock_and_boost = {},
    cleanup_7d_30d = {},
    combo_aov = {},
    data_source_mode = 'NONE',
    latest_stat_date = null
  } = data || {};

  const isProfitable = overall_stats.is_profitable;
  const inactiveCount = videos.filter(isInactiveOrZeroVideo).length;

  const statusFilteredVideos = activeStatusTab === 'ALL'
    ? videos
    : videos.filter((v) => v.sop_status === activeStatusTab);

  const visibleVideos = (showInactiveVideos || activeStatusTab === 'INACTIVE')
    ? statusFilteredVideos
    : statusFilteredVideos.filter((v) => !isInactiveOrZeroVideo(v));

  const activeTabIds = visibleVideos.filter((v) => !v.is_unattributed).map((v) => v.video_id);

  const healthCards = [
    {
      title: 'Kho video đang chạy',
      value: formatNumber(pool_health.active_pool_count || 0),
      target: `Mục tiêu >= ${pool_health.active_pool_target || 50} video`,
      status: pool_health.active_pool_status || 'WARNING'
    },
    {
      title: 'Video đang khám phá',
      value: formatNumber(pool_health.exploring_count || 0),
      target: `Cảnh báo nếu < ${pool_health.exploring_min_warn || 15} video`,
      status: pool_health.exploring_status || 'WARNING'
    },
    {
      title: 'Video mới nạp / ngày',
      value: `${pool_health.new_videos_per_day ?? 0} / ngày`,
      target: `Mục tiêu ${pool_health.new_videos_target_min || 10}–${pool_health.new_videos_target_max || 15} video/ngày`,
      status: pool_health.new_videos_status || 'WARNING'
    },
    {
      title: '% Chi vào video 0 đơn',
      value: `${pool_health.zero_order_spend_pct ?? 0}%`,
      target: `Mục tiêu < ${pool_health.zero_order_spend_target_max_pct || 10}% (${formatVND(pool_health.zero_order_spend || 0)})`,
      status: pool_health.zero_order_spend_status || 'OK'
    }
  ];

  const bucketCountByCode = {};
  for (const b of status_buckets) {
    bucketCountByCode[b.code] = b.count || 0;
  }
  const violationCount = (roi_lock_and_boost.boost_stop_violations || []).length;

  const quotaRows = [
    {
      code: 'OUTSTANDING',
      label: 'Nổi bật',
      current: bucketCountByCode.OUTSTANDING || 0,
      target: '>= 5 video chủ lực',
      met: (bucketCountByCode.OUTSTANDING || 0) >= 5,
      advice: 'Giữ nguyên để chạy chính. Nhân bản 3 giây đầu (câu mở, góc quay, bối cảnh) để tạo thêm nhiều video cùng phong cách.'
    },
    {
      code: 'EFFECTIVE',
      label: 'Có hiệu quả',
      current: bucketCountByCode.EFFECTIVE || 0,
      target: '>= 30 video bán ổn định',
      met: (bucketCountByCode.EFFECTIVE || 0) >= 30,
      advice: 'Gắn thêm gói Combo 2–3 hộp vào giỏ hàng trong video để kéo giá trị trung bình mỗi đơn lên 100.000đ–150.000đ.'
    },
    {
      code: 'EXPLORING',
      label: 'Đang khám phá',
      current: bucketCountByCode.EXPLORING || 0,
      target: '>= 15 video (nạp 10–15 mới/ngày)',
      met: (bucketCountByCode.EXPLORING || 0) >= 15,
      advice: 'Quay đa dạng 3 giây đầu (nỗi đau gan nóng, thức khuya, uống bia rượu) để hệ thống tự chọn ra video ra đơn rẻ.'
    },
    {
      code: 'INEFFECTIVE',
      label: 'Kém hiệu quả',
      current: bucketCountByCode.INEFFECTIVE || 0,
      target: 'Chi phí 0 đơn < 10% tổng chi',
      met: (pool_health.zero_order_spend_pct ?? 0) < 10,
      advice: 'Cắt bỏ phần mở đầu dài dòng, đưa lợi ích sản phẩm vào ngay 3 giây đầu và chuyển sang chào gói Combo 2–3 hộp.'
    },
    {
      code: 'INACTIVE',
      label: 'Không phân phối',
      current: bucketCountByCode.INACTIVE || 0,
      target: '0 video bị kẹt phân phối',
      met: (bucketCountByCode.INACTIVE || 0) === 0,
      advice: 'Kiểm tra lại liên kết giỏ hàng sản phẩm có bị lỗi/hết hàng không, hoặc thay thế bằng video mới để không làm loãng kho.'
    },
    {
      code: 'VIOLATION',
      label: 'Vi phạm / Vượt ngưỡng dừng',
      current: violationCount,
      target: '0 video vi phạm',
      met: violationCount === 0,
      advice: 'Tránh từ khóa bị cấm với Thực phẩm bảo vệ sức khỏe (như "chữa khỏi", "đặc trị", "cam kết 100%") và tắt ngay video mồi 0 đơn quá 48 giờ.'
    }
  ];

  const getStatusStyle = (st) => {
    if (st === 'OK' || st === 'ABOVE_TARGET') return { bg: '#f0fdf4', border: '#bbf7d0', badgeBg: '#dcfce7', badgeColor: '#166534', text: 'Đạt chuẩn' };
    if (st === 'CRITICAL') return { bg: '#fef2f2', border: '#fecaca', badgeBg: '#fee2e2', badgeColor: '#991b1b', text: 'Báo động' };
    return { bg: '#fffbeb', border: '#fde68a', badgeBg: '#fef3c7', badgeColor: '#92400e', text: 'Cần bổ sung' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Cấu hình mức hoàn vốn & Tổng quan */}
      <div style={{
        background: isProfitable ? 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)',
        padding: '22px 24px',
        borderRadius: '16px',
        border: isProfitable ? '1px solid #bbf7d0' : '1px solid #fecaca',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1 1 380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '800',
                background: isProfitable ? '#dcfce7' : '#fee2e2',
                color: isProfitable ? '#166534' : '#991b1b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                {isProfitable ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {isProfitable ? 'QUẢNG CÁO VIDEO ĐANG ĐẠT HÒA VỐN+' : 'CẢNH BÁO: HIỆU QUẢ THU/CHI DƯỚI MỨC HÒA VỐN'}
              </span>
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontWeight: '700' }}>
                Nguồn dữ liệu: {SOURCE_MODE_LABELS[data_source_mode] || 'Dữ liệu hệ thống'} • Cập nhật đến ngày {latest_stat_date || endDate}
              </span>
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', fontWeight: '700' }}>
                {CONFIG_SOURCE_LABELS[roi_config.source] || 'Mặc định hệ thống'}
              </span>
              <button
                type="button"
                disabled={syncing || loading}
                onClick={handleSyncTikTokAds}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid #0284c7',
                  background: syncing ? '#e0f2fe' : '#0284c7',
                  color: syncing ? '#0369a1' : '#ffffff',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: syncing ? 'wait' : 'pointer'
                }}
              >
                <RefreshCw size={13} className={syncing ? 'spin' : ''} />
                {syncing ? 'Đang đồng bộ từ TikTok...' : 'Đồng bộ Video & Chiến dịch thực tế từ TikTok'}
              </button>
            </div>
            {syncBanner && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                background: syncBanner.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: syncBanner.type === 'success' ? '#166534' : '#991b1b',
                border: syncBanner.type === 'success' ? '1px solid #86efac' : '1px solid #fecaca'
              }}>
                {syncBanner.type === 'success' ? '✓ ' : '⚠ '}
                {syncBanner.text}
              </div>
            )}

            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '10px' }}>
              Hiệu quả thu/chi thực tế: {overall_stats.overall_roas || 0} lần
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginLeft: '10px' }}>
                (Hòa vốn: {breakevenRoi} lần · Mục tiêu: {targetRoi} lần · Chi phí/1 đơn hòa vốn: {formatVND(breakeven_cpa_info.breakeven_cpa || 0)})
              </span>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap', fontSize: '13px' }}>
              <div>Tiền đã chi cho Video: <strong style={{ color: '#0f172a' }}>{formatVND(overall_stats.total_spend)}</strong></div>
              <div>Doanh số từ Quảng cáo: <strong style={{ color: '#059669' }}>{formatVND(overall_stats.total_gmv)}</strong></div>
              <div>Đơn từ Quảng cáo: <strong style={{ color: '#2563eb' }}>{formatNumber(overall_stats.total_orders)} đơn</strong></div>
              <div>Tổng số Video: <strong style={{ color: '#0f172a' }}>{formatNumber(overall_stats.total_videos)}</strong></div>
            </div>
          </div>

          {/* Tùy chỉnh mức hoàn vốn & kỳ dữ liệu */}
          <div style={{
            background: '#ffffff',
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                Kỳ dữ liệu:
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleRangeChange(d)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: rangeDays === d ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      background: rangeDays === d ? '#eff6ff' : '#ffffff',
                      color: rangeDays === d ? '#1d4ed8' : '#475569',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {d} ngày
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                Mức hoàn vốn hòa vốn:
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="100"
                value={breakevenRoi}
                onChange={(e) => {
                  setHasUserEditedRoi(true);
                  setBreakevenRoi(parseFloat(e.target.value) || 1);
                }}
                style={{ width: '96px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>
                Mức hoàn vốn mục tiêu:
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="100"
                value={targetRoi}
                onChange={(e) => {
                  setHasUserEditedRoi(true);
                  setTargetRoi(parseFloat(e.target.value) || 1);
                }}
                style={{ width: '96px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}
              />
            </div>

            <button
              type="button"
              disabled={savingRoi || loading}
              onClick={handleApplyAndSaveRoi}
              style={{
                padding: '7px 14px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Save size={13} />
              {savingRoi ? 'Đang lưu...' : 'Áp dụng & Lưu'}
            </button>
          </div>
        </div>
        {saveMsg && (
          <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: '600', color: '#166534' }}>
            ✓ {saveMsg}
          </div>
        )}
      </div>

      {/* 2. Sức khỏe Kho Video + Nút Giám đốc Marketing AI */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
          Sức khỏe Kho Video
        </div>
        <button
          type="button"
          disabled={aiLoading}
          onClick={handleAskAiDirector}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: '700',
            cursor: aiLoading ? 'wait' : 'pointer',
            boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
          }}
        >
          <Bot size={16} />
          {aiLoading ? 'Đang phân tích Kho Video...' : 'Nhờ Giám đốc Marketing AI phân tích Kho Video'}
        </button>
      </div>

      {aiError && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '13px' }}>
          {aiError}
        </div>
      )}

      {aiReport && (
        <div style={{ padding: '18px 20px', borderRadius: '16px', background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)', border: '1px solid #c7d2fe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '800', color: '#312e81', marginBottom: '10px' }}>
            <Bot size={18} color="#4f46e5" />
            {aiReport.headline || 'Nhận xét & Đề xuất từ Giám đốc Marketing AI'}
          </div>
          {(aiReport.summary || aiReport.analysis) && (
            <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.6', whiteSpace: 'pre-line', marginBottom: '10px' }}>
              {aiReport.summary || aiReport.analysis}
            </div>
          )}
          {Array.isArray(aiReport.diagnosis) && aiReport.diagnosis.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#4338ca', marginBottom: '4px' }}>Nguyên nhân chính:</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                {aiReport.diagnosis.map((d, idx) => <li key={idx}>{d}</li>)}
              </ul>
            </div>
          )}
          {Array.isArray(aiReport.actions) && aiReport.actions.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', marginBottom: '4px' }}>Việc cần làm ngay để video cắn tiền & ra đơn:</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#1e293b', lineHeight: '1.6' }}>
                {aiReport.actions.map((a, idx) => <li key={idx}>{typeof a === 'string' ? a : (a.action || a.title || JSON.stringify(a))}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {healthCards.map((c) => {
          const st = getStatusStyle(c.status);
          return (
            <div key={c.title} style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>{c.title}</span>
                <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', background: st.badgeBg, color: st.badgeColor }}>
                  {st.text}
                </span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '8px' }}>{c.value}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{c.target}</div>
            </div>
          );
        })}
      </div>

      {/* 3. Bảng đối chiếu chỉ tiêu kho video & hướng dẫn sửa nội dung */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
          Đối Chiếu Chỉ Tiêu Từng Nhóm Video & Cách Chỉnh Nội Dung Để Ra Đơn
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
          So sánh số lượng hiện có với mức cần đạt theo quy chuẩn, kèm hướng dẫn chỉnh sửa nội dung cụ thể cho từng nhóm.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Trạng thái Video</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Số lượng hiện có</th>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Cần đạt để đảm bảo mục tiêu</th>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Đánh giá</th>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Cách chỉnh nội dung giúp cắn tiền & ra đơn</th>
              </tr>
            </thead>
            <tbody>
              {quotaRows.map((row) => (
                <tr key={row.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{row.label}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#2563eb' }}>{formatNumber(row.current)}</td>
                  <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>{row.target}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: row.met ? '#dcfce7' : '#fef3c7',
                      color: row.met ? '#166534' : '#92400e',
                      whiteSpace: 'nowrap'
                    }}>
                      {row.met ? 'Đạt chuẩn' : 'Cần cải thiện'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569', lineHeight: '1.5' }}>{row.advice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Phân loại Kho Video 5 trạng thái */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#2563eb" />
              Danh Sách Video Theo 5 Trạng Thái
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Nổi bật (&gt;= {targetRoi} lần) · Có hiệu quả (&gt;= {breakevenRoi} lần) · Đang khám phá (&lt;= 7 ngày) · Kém hiệu quả · Không phân phối
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {inactiveCount > 0 && (
              <button
                type="button"
                onClick={() => setShowInactiveVideos((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: showInactiveVideos ? '#f1f5f9' : '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {showInactiveVideos ? <EyeOff size={14} /> : <Eye size={14} />}
                {showInactiveVideos
                  ? `Ẩn bớt ${inactiveCount} video không hoạt động / 0đ`
                  : `Hiện thêm ${inactiveCount} video không hoạt động / 0đ`}
              </button>
            )}

            <button
              type="button"
              disabled={activeTabIds.length === 0}
              onClick={() => handleCopyIds(`tab_${activeStatusTab}`, activeTabIds)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: activeTabIds.length > 0 ? '1px solid #cbd5e1' : '1px solid #f1f5f9',
                background: copiedKey === `tab_${activeStatusTab}` ? '#dcfce7' : '#ffffff',
                color: copiedKey === `tab_${activeStatusTab}` ? '#166534' : (activeTabIds.length > 0 ? '#2563eb' : '#94a3b8'),
                fontSize: '12px',
                fontWeight: '700',
                cursor: activeTabIds.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              {copiedKey === `tab_${activeStatusTab}` ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === `tab_${activeStatusTab}` ? `Đã sao chép ${activeTabIds.length} mã!` : `Sao chép mã Video (${activeTabIds.length})`}
            </button>
          </div>
        </div>

        {/* Bộ lọc trạng thái */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveStatusTab('ALL')}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: activeStatusTab === 'ALL' ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: activeStatusTab === 'ALL' ? '#eff6ff' : '#f8fafc',
              color: activeStatusTab === 'ALL' ? '#1d4ed8' : '#334155',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Tất cả ({videos.length})
          </button>
          {status_buckets.map((b) => {
            const meta = STATUS_META[b.code] || STATUS_META.EXPLORING;
            const isSel = activeStatusTab === b.code;
            return (
              <button
                key={b.code}
                type="button"
                onClick={() => setActiveStatusTab(b.code)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: isSel ? `1px solid ${meta.border}` : '1px solid #e2e8f0',
                  background: isSel ? meta.bg : '#ffffff',
                  color: isSel ? meta.color : '#334155',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {meta.label} ({b.count}) · {formatVND(b.spend)}
              </button>
            );
          })}
        </div>

        {/* Bảng Video */}
        <div style={{ overflowX: 'auto' }}>
          {visibleVideos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px', color: '#94a3b8', fontSize: '13px', background: '#f8fafc', borderRadius: '10px' }}>
              Chưa có video đang chạy hoặc có chi phí trong nhóm này cho kỳ {startDate} → {endDate}.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>Mã Video</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>Tiêu đề / Chiến dịch</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>Trạng thái</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Tiền đã chi</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Doanh số</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Đơn hàng</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Hiệu quả thu/chi</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Tuổi</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>Việc cần làm</th>
                </tr>
              </thead>
              <tbody>
                {visibleVideos.slice(0, 60).map((vid, i) => {
                  const meta = STATUS_META[vid.sop_status] || STATUS_META.EXPLORING;
                  return (
                    <tr key={`${vid.video_id}-${vid.campaign_id}-${i}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>
                        <div>{vid.video_id}</div>
                        {vid.in_3day_roi_lock && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '3px', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontFamily: 'sans-serif' }}>
                            <Lock size={10} /> Khóa 3 ngày đầu
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '250px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{vid.title}</div>
                        {vid.creator_name && <div style={{ fontSize: '11px', color: '#64748b' }}>@{vid.creator_name}</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>{formatVND(vid.spend)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>{formatVND(vid.gmv)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#2563eb' }}>{formatNumber(vid.orders)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: vid.roi >= breakevenRoi ? '#059669' : '#dc2626' }}>
                        {vid.roi} lần
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>{vid.age_days} ngày</td>
                      <td style={{ padding: '10px 12px', color: '#475569', maxWidth: '240px' }}>{vid.sop_action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 5. Khóa 3 ngày đầu & Đẩy ngân sách mồi (24–48h) */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="#ea580c" />
            Khóa 3 Ngày Đầu & Theo Dõi Đẩy Ngân Sách Mồi (24–48h)
          </div>
          <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '8px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
            Đang giữ ổn định 3 ngày đầu: {roi_lock_and_boost.roi_lock_3d_count || 0} video
          </span>
        </div>

        <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <ShieldAlert size={16} />
          <span>Lưu ý quan trọng: Đẩy ngân sách mồi (24–48h, tối đa 3 ngày, ngân sách &lt;= 10–20% giới hạn ngày) KHÔNG được áp dụng Bảo vệ hoàn vốn. Dừng ngay nếu tự tiêu tiền ở ngân sách chính HOẶC quá 48 giờ / chi quá 1–1,5 lần chi phí/1 đơn hòa vốn mà 0 đơn.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: '#fff5f5', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#991b1b', marginBottom: '8px' }}>
              Video vi phạm quy tắc cần dừng ngay ({violationCount})
            </div>
            {violationCount === 0 ? (
              <div style={{ fontSize: '12px', color: '#64748b' }}>Không có video nào vi phạm quy tắc dừng đẩy ngân sách mồi.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {roi_lock_and_boost.boost_stop_violations.slice(0, 8).map((v) => (
                  <div key={v.video_id} style={{ padding: '8px 10px', background: '#ffffff', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '12px' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{v.video_id} · {formatVND(v.spend)}</div>
                    <div style={{ color: '#dc2626', marginTop: '2px' }}>{(v.stop_reasons || []).join(' | ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', background: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} />
              Video tiềm năng nên đẩy ngân sách mồi 24–48h ({roi_lock_and_boost.boost_candidates?.length || 0})
            </div>
            {(roi_lock_and_boost.boost_candidates || []).length === 0 ? (
              <div style={{ fontSize: '12px', color: '#64748b' }}>Chưa có video mới đạt tiêu chí đề xuất đẩy ngân sách mồi.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {roi_lock_and_boost.boost_candidates.slice(0, 8).map((v) => (
                  <div key={v.video_id} style={{ padding: '8px 10px', background: '#ffffff', borderRadius: '8px', border: '1px solid #bae6fd', fontSize: '12px' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{v.video_id} · {v.title}</div>
                    <div style={{ color: '#0369a1', marginTop: '2px' }}>Lượt xem: {formatNumber(v.views)} · Tỷ lệ bấm xem: {v.ctr}% · Đơn: {v.orders}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Dọn dẹp 7 ngày & 30 ngày */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {[
          {
            key: 'cleanup7d',
            title: 'Dọn dẹp 7 Ngày (Chi > 1–1,5 lần chi phí/đơn, 0 đơn)',
            count: cleanup_7d_30d.cleanup_7d_count || 0,
            ids: cleanup_7d_30d.cleanup_7d_ids || [],
            items: cleanup_7d_30d.cleanup_7d || [],
            color: '#c2410c',
            bg: '#fff7ed',
            border: '#fed7aa'
          },
          {
            key: 'cleanup30d',
            title: 'Dọn dẹp 30 Ngày (0 đơn hàng toàn kỳ)',
            count: cleanup_7d_30d.cleanup_30d_count || 0,
            ids: cleanup_7d_30d.cleanup_30d_ids || [],
            items: cleanup_7d_30d.cleanup_30d || [],
            color: '#991b1b',
            bg: '#fef2f2',
            border: '#fecaca'
          }
        ].map((box) => (
          <div key={box.key} style={{ background: '#ffffff', borderRadius: '16px', border: `1px solid ${box.border}`, padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: box.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trash2 size={16} />
                {box.title} ({box.count})
              </div>
              <button
                type="button"
                disabled={box.ids.length === 0}
                onClick={() => handleCopyIds(box.key, box.ids)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: copiedKey === box.key ? '#dcfce7' : '#ffffff',
                  color: copiedKey === box.key ? '#166534' : '#334155',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: box.ids.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                {copiedKey === box.key ? 'Đã sao chép!' : `Sao chép mã (${box.ids.length})`}
              </button>
            </div>
            {box.items.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#64748b', padding: '10px', background: box.bg, borderRadius: '8px' }}>
                Không có video nào cần dọn dẹp trong nhóm này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                {box.items.slice(0, 15).map((item) => (
                  <div key={item.video_id} style={{ padding: '8px 10px', borderRadius: '8px', background: box.bg, fontSize: '12px' }}>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{item.video_id} · {item.title}</div>
                    <div style={{ color: box.color, marginTop: '2px' }}>{item.cleanup_reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 7. Giá trị trung bình/đơn Combo */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} color="#7c3aed" />
              Giá Trị Trung Bình / Đơn Combo (Mục tiêu: 100.000đ – 150.000đ)
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Tính trực tiếp từ đơn hàng thực tế ({formatNumber(combo_aov.total_valid_orders || 0)} đơn hợp lệ · {formatNumber(combo_aov.total_cancelled_orders || 0)} đơn hủy)
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Giá trị trung bình / đơn thực tế</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: combo_aov.goal_status === 'BELOW_GOAL' ? '#dc2626' : '#059669' }}>
              {formatVND(combo_aov.real_aov || 0)}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Mua lẻ 1 hộp</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>{combo_aov.single_unit?.share_pct ?? 0}%</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              {formatNumber(combo_aov.single_unit?.orders || 0)} đơn · Trung bình {formatVND(combo_aov.single_unit?.aov || 0)}/đơn
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#5b21b6' }}>Combo 2–3 hộp</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#5b21b6', marginTop: '6px' }}>{combo_aov.combo_2_3?.share_pct ?? 0}%</div>
            <div style={{ fontSize: '11px', color: '#6d28d9', marginTop: '4px' }}>
              {formatNumber(combo_aov.combo_2_3?.orders || 0)} đơn · Trung bình {formatVND(combo_aov.combo_2_3?.aov || 0)}/đơn
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#065f46' }}>Đơn sỉ / 4 hộp trở lên</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#065f46', marginTop: '6px' }}>{combo_aov.bulk_4_plus?.share_pct ?? 0}%</div>
            <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px' }}>
              {formatNumber(combo_aov.bulk_4_plus?.orders || 0)} đơn · Trung bình {formatVND(combo_aov.bulk_4_plus?.aov || 0)}/đơn
            </div>
          </div>
        </div>

        <div style={{
          padding: '12px 14px',
          borderRadius: '10px',
          background: combo_aov.goal_status === 'BELOW_GOAL' ? '#fffbeb' : '#f0fdf4',
          border: combo_aov.goal_status === 'BELOW_GOAL' ? '1px solid #fde68a' : '1px solid #bbf7d0',
          fontSize: '12px',
          fontWeight: '600',
          color: combo_aov.goal_status === 'BELOW_GOAL' ? '#92400e' : '#166534'
        }}>
          <Target size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
          {combo_aov.recommendation}
        </div>
      </div>
    </div>
  );
}
