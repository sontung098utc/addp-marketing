import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Clock,
  Award,
  AlertTriangle,
  RefreshCw,
  Flame,
  CheckCircle2,
  Calendar,
  Sliders,
  Activity,
  Zap,
  ShieldAlert,
  ChevronRight,
  Users,
  Sparkles
} from 'lucide-react';

const PLAIN_METRIC_LABELS = {
  impressions: '1. Lượt người thấy Live',
  spend_pacing: '2. Tiền đã chi / Giới hạn ca',
  cpm: '3. Giá mua 1.000 lượt hiển thị',
  ctr_into_live: '4. Tỷ lệ bấm vào xem Live',
  cart_ctor: '5. Tỷ lệ bấm giỏ hàng',
  cvr: '6. Tỷ lệ chốt đơn',
  session_gmv: '7. Doanh số phiên Live',
  session_roi: '8. Hiệu quả thu/chi phiên Live'
};

export default function CommerceLiveAnalyticsView({
  shopId,
  startDate,
  endDate,
  apiRequest,
  formatVND = (v) => `${Number(v || 0).toLocaleString('vi-VN')} ₫`,
  formatNumber = (v) => Number(v || 0).toLocaleString('vi-VN')
}) {
  const [liveKpis, setLiveKpis] = useState(null);
  const [goldenHours, setGoldenHours] = useState(null);
  const [sopData, setSopData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Configurable SOP overrides (UI state)
  const [targetRoiInput, setTargetRoiInput] = useState('');
  const [liveDailyBudgetInput, setLiveDailyBudgetInput] = useState('');
  const [isSaleDay, setIsSaleDay] = useState(false);
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Funnel diagnosis scope: 'overall' | 'session_1' | 'session_2' | 'session_3' | session_id
  const [funnelScope, setFunnelScope] = useState('overall');
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  // AI Marketing Director state
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Direct TikTok LIVE Sync state
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showInactiveSessions, setShowInactiveSessions] = useState(false);
  const [showInactiveLiveCampaigns, setShowInactiveLiveCampaigns] = useState(false);

  // Live Workbench Verified Input Modal
  const [showWorkbenchModal, setShowWorkbenchModal] = useState(false);
  const [wbSaving, setWbSaving] = useState(false);
  const [wbForm, setWbForm] = useState({
    session_id: '',
    title: '',
    start_time: `${endDate || new Date().toISOString().slice(0, 10)} 10:30`,
    duration_minutes: '180',
    gmv: '',
    ad_spend: '',
    units_sold: '',
    impressions: '',
    total_views: '',
    unique_viewers: '',
    avg_watch_time_sec: '',
    views_over_1min: '',
    preview_ctr_pct: '',
    enter_room_rate_pct: '',
    ctr_live_pct: '',
    sku_order_rate_pct: '',
    comment_rate_pct: '',
    follow_rate_pct: '',
    share_rate_pct: '',
    like_rate_pct: ''
  });

  const handleSaveWorkbench = async (e) => {
    e.preventDefault();
    setWbSaving(true);
    setSyncStatus(null);
    try {
      const res = await apiRequest(
        'commerce_dashboard.php?action=save_live_workbench_session',
        'POST',
        { ...wbForm, shop_id: shopId }
      );
      if (res && res.success) {
        setSyncStatus({ type: 'success', message: res.message || 'Đã lưu số liệu thực tế từ Live Workbench!' });
        setShowWorkbenchModal(false);
        await fetchLiveAnalytics();
      } else {
        setSyncStatus({ type: 'error', message: res?.message || 'Không thể lưu phiên Live.' });
      }
    } catch (err) {
      setSyncStatus({ type: 'error', message: err.message || 'Lỗi khi lưu phiên Live.' });
    } finally {
      setWbSaving(false);
    }
  };

  const fetchLiveAnalytics = useCallback(async (overrideParams = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const roiVal = overrideParams?.targetRoi ?? targetRoiInput;
      const budgetVal = overrideParams?.liveDailyBudget ?? liveDailyBudgetInput;
      const saleVal = overrideParams?.isSaleDay ?? isSaleDay;
      const interactiveVal = overrideParams?.isInteractiveMode ?? isInteractiveMode;

      const sopParts = [
        `action=get_live_sop_dashboard`,
        `shop_id=${encodeURIComponent(shopId || '')}`,
        `start_date=${encodeURIComponent(startDate || '')}`,
        `end_date=${encodeURIComponent(endDate || '')}`,
        `is_sale_day=${saleVal ? '1' : '0'}`,
        `is_interactive_mode=${interactiveVal ? '1' : '0'}`
      ];
      if (roiVal && Number(roiVal) > 0) sopParts.push(`target_roi=${encodeURIComponent(String(roiVal))}`);
      if (budgetVal && Number(budgetVal) > 0) sopParts.push(`live_daily_budget=${encodeURIComponent(String(budgetVal))}`);
      const sopQueryStr = sopParts.join('&');

      const [kpiRes, ghRes, sopRes] = await Promise.all([
        apiRequest(`commerce_dashboard.php?action=get_live_analytics&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`),
        apiRequest(`commerce_dashboard.php?action=get_golden_hours&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`),
        apiRequest(`commerce_live_sop_service.php?${sopQueryStr}`).catch(() => null)
      ]);

      if (kpiRes && kpiRes.success) {
        setLiveKpis(kpiRes.data);
      }
      if (ghRes && ghRes.success) {
        setGoldenHours(ghRes.data);
      }
      if (sopRes && sopRes.success) {
        setSopData(sopRes.data);
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối khi tải phân tích phiên Live');
    } finally {
      setIsLoading(false);
    }
  }, [shopId, startDate, endDate, apiRequest, targetRoiInput, liveDailyBudgetInput, isSaleDay, isInteractiveMode]);

  useEffect(() => {
    fetchLiveAnalytics();
  }, [shopId, startDate, endDate]);

  const handleSyncLiveFromTikTok = async () => {
    setSyncLoading(true);
    setSyncStatus(null);
    try {
      const res = await apiRequest(
        `commerce_dashboard.php?action=trigger_sync&domain=ads_all&shop_id=${encodeURIComponent(shopId || '')}&start_date=${encodeURIComponent(startDate || '')}&end_date=${encodeURIComponent(endDate || '')}`,
        'POST',
        { shop_id: shopId, domain: 'ads_all', start_date: startDate, end_date: endDate }
      );
      if (res && res.success) {
        const syncedCount = res.data?.records_ingested ?? res.records_ingested ?? res.data?.synced_count ?? null;
        const msg = res.message || res.data?.message || (syncedCount !== null
          ? `Đã đồng bộ thành công ${syncedCount} bản ghi Chiến dịch & Ca Live từ TikTok (${startDate} → ${endDate}).`
          : `Đã đồng bộ dữ liệu Chiến dịch, Ca Live & Sản phẩm thực tế từ TikTok (${startDate} → ${endDate}).`);
        setSyncStatus({ type: 'success', message: msg });
        await fetchLiveAnalytics();
      } else {
        setSyncStatus({
          type: 'error',
          message: res?.message || 'Không thể đồng bộ dữ liệu Ca Live từ TikTok. Vui lòng kiểm tra kết nối tài khoản quảng cáo.'
        });
      }
    } catch (err) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Lỗi kết nối khi đồng bộ Ca Live từ TikTok.'
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleAnalyzeWithAiDirector = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiRequest(
        'commerce_dashboard.php?action=analyze_sop_director',
        'POST',
        {
          mode: 'live',
          shop_id: shopId,
          start_date: startDate,
          end_date: endDate
        }
      );
      if (res && res.success) {
        setAiAnalysis(res.data || res);
      } else {
        setAiError(res?.message || 'Không thể lấy phân tích từ Giám đốc Marketing AI.');
      }
    } catch (err) {
      setAiError(err.message || 'Lỗi kết nối khi gọi Giám đốc Marketing AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const sopConfig = sopData?.config || {
    target_roi: 13.0,
    live_daily_budget: 384615,
    session_budget_cap: 192308,
    session_gmv_target: 2500000,
    session_impressions_target: 38462,
    min_duration_hours: isSaleDay ? 5 : 3,
    is_sale_day: isSaleDay,
    is_interactive_mode: isInteractiveMode,
    source: 'Mặc định quy trình'
  };

  const formatConfigSource = (src) => {
    if (!src) return 'Mặc định quy trình';
    if (String(src).includes('COMMERCE_SOP_CONFIG')) return 'Cấu hình của Shop';
    if (String(src).includes('UI_OVERRIDE')) return 'Tùy chỉnh trực tiếp';
    return 'Mặc định quy trình';
  };

  const targets = {
    ...(liveKpis?.targets || {
      enter_room_rate: 3.0,
      ctr_live: 65.0,
      sku_order_rate: 4.0,
      follow_rate: 1.0,
      gpm: 70000.0,
      gmv_per_hour: 600000.0,
      ads_roi: sopConfig.target_roi || 13.0,
      min_ad_budget_per_session: 100000.0
    }),
    ads_roi: sopConfig.target_roi || 13.0
  };

  const topSlots = goldenHours?.top_golden_slots || [];
  const slots = sopData?.slots || {};
  const sessionsList = sopData?.sessions || [];
  const latestAlert = sopData?.alerts?.latest_pacing_alert;

  // Resolve active funnel based on selected scope
  const getActiveFunnelContext = () => {
    if (funnelScope === 'session_1' && slots.session_1?.funnel) {
      return { title: 'Ca 1 — Sáng (< 14:00)', funnel: slots.session_1.funnel };
    }
    if (funnelScope === 'session_2' && slots.session_2?.funnel) {
      return { title: 'Ca 2 — Chiều (14:00 – 18:59)', funnel: slots.session_2.funnel };
    }
    if (funnelScope === 'session_3' && slots.session_3?.funnel) {
      return { title: 'Ca 3 — Tối (≥ 19:00)', funnel: slots.session_3.funnel };
    }
    const matchedSess = sessionsList.find((s) => s.session_id === funnelScope);
    if (matchedSess && matchedSess.funnel) {
      return { title: `${matchedSess.slot_label}: ${matchedSess.title} (ID: ${matchedSess.session_id})`, funnel: matchedSess.funnel };
    }
    return { title: 'Tổng hợp toàn kỳ Live', funnel: sopData?.overall_funnel || null };
  };

  const formatDurationPretty = (seconds, hoursFallback) => {
    if (seconds && Number(seconds) > 0) {
      const sec = Number(seconds);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return `${h}h${m > 0 ? `${m}p` : '00p'}`;
    }
    if (hoursFallback !== null && hoursFallback !== undefined) {
      return `${hoursFallback} giờ`;
    }
    return 'Chưa có';
  };

  const activeFunnelCtx = getActiveFunnelContext();

  const getMetricPlainLabel = (metric) => {
    if (!metric) return '';
    return PLAIN_METRIC_LABELS[metric.key] || metric.label;
  };

  const formatMetricVal = (metric) => {
    if (metric.actual === null || metric.actual === undefined) {
      return 'Chưa có dữ liệu';
    }
    if (metric.unit === 'vnd') return formatVND(metric.actual);
    if (metric.unit === 'pct') return `${metric.actual}%`;
    if (metric.unit === 'x') return `${metric.actual} lần`;
    return formatNumber(metric.actual);
  };

  const evalTarget = (val, targetVal, isHigherBetter = true) => {
    if (val === null || val === undefined) return { status: 'neutral', label: 'Chưa có dữ liệu' };
    const num = Number(val);
    const passed = isHigherBetter ? num >= targetVal : num <= targetVal;
    return {
      passed,
      status: passed ? 'good' : 'warning',
      badgeBg: passed ? '#dcfce7' : '#fef3c7',
      badgeColor: passed ? '#15803d' : '#b45309',
      badgeText: passed ? `✓ Đạt mục tiêu (≥ ${targetVal})` : `⚠ Chưa đạt (< ${targetVal})`
    };
  };

  const renderPacingBadge = (alert) => {
    if (!alert || alert.level === 'NO_DATA') {
      return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Chưa có dữ liệu chi tiêu' };
    }
    if (alert.level === 'CRITICAL_90') {
      return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: `Khẩn cấp sắp hết tiền ${alert.pacing_pct}% (≥90%)` };
    }
    if (alert.level === 'WARNING_60') {
      return { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: `Cảnh báo mốc 60% (${alert.pacing_pct}%)` };
    }
    return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', label: `An toàn (${alert.pacing_pct}%)` };
  };

  const renderAiAnalysisContent = () => {
    if (!aiAnalysis) return null;
    const textContent =
      aiAnalysis.analysis_text ||
      aiAnalysis.report ||
      aiAnalysis.summary ||
      aiAnalysis.message ||
      (typeof aiAnalysis === 'string' ? aiAnalysis : null);

    const sections = aiAnalysis.sections || aiAnalysis.recommendations || aiAnalysis.action_plan || null;
    const verdict = aiAnalysis.headline || aiAnalysis.verdict || null;

    return (
      <div style={{
        background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
        border: '1px solid #bfdbfe',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 2px 6px rgba(37,99,235,0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e3a8a', fontWeight: '800', fontSize: '14px' }}>
            <Sparkles size={18} color="#2563eb" />
            Nhận Xét &amp; Cố Vấn Từ Giám Đốc Marketing AI (Kênh Live)
          </div>
          {aiAnalysis.source && (
            <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '999px', fontWeight: '600' }}>
              {aiAnalysis.source === 'gemini' ? 'Phân tích bởi Trí tuệ nhân tạo' : 'Phân tích theo quy chuẩn thực chiến'}
            </span>
          )}
        </div>

        {verdict && (
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
            {verdict}
          </div>
        )}

        {textContent && (
          <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.65', whiteSpace: 'pre-line', marginBottom: sections ? '12px' : 0 }}>
            {textContent}
          </div>
        )}

        {Array.isArray(sections) && sections.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {sections.map((sec, idx) => (
              <div key={idx} style={{ background: '#ffffff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#1e293b' }}>
                {typeof sec === 'string' ? (
                  sec
                ) : (
                  <>
                    {sec.title && <div style={{ fontWeight: '700', color: '#1d4ed8', marginBottom: '3px' }}>{sec.title}</div>}
                    {sec.detail && <div style={{ lineHeight: '1.5' }}>{sec.detail}</div>}
                    {sec.action && <div style={{ marginTop: '3px', color: '#0f172a' }}><strong>Việc cần làm ngay:</strong> {sec.action}</div>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="commerce-live-analytics-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Toolbar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626'
          }}>
            <Radio size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              Theo Dõi 2–3 Ca Live/Ngày (Sáng • Chiều • Tối), Cảnh Báo Ngân Sách &amp; Chẩn Đoán Phiên Live
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Ngân sách Live chiếm 25% tổng ngân sách • Dữ liệu trực tiếp từ Trình quản lý LIVE TikTok Shop • Nguồn cấu hình: <strong>{formatConfigSource(sopConfig.source)}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSyncLiveFromTikTok}
            disabled={syncLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #059669',
              background: syncLoading ? '#ecfdf5' : '#059669',
              fontSize: '12px',
              fontWeight: '700',
              color: syncLoading ? '#047857' : '#ffffff',
              cursor: syncLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
            }}
          >
            <RefreshCw size={13} className={syncLoading ? 'spin' : ''} />
            {syncLoading ? 'Đang đồng bộ Ca LIVE...' : '🔄 Đồng bộ Ca LIVE thực tế từ TikTok'}
          </button>

          <button
            type="button"
            onClick={handleAnalyzeWithAiDirector}
            disabled={aiLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              fontSize: '12px',
              fontWeight: '700',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.25)'
            }}
          >
            <Sparkles size={14} />
            {aiLoading ? 'Đang phân tích Ca Live...' : 'Phân tích chuyên sâu Ca Live bằng Giám đốc Marketing AI'}
          </button>

          <button
            type="button"
            onClick={() => setShowWorkbenchModal((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid #7c3aed',
              background: showWorkbenchModal ? '#7c3aed' : '#f5f3ff',
              fontSize: '12px',
              fontWeight: '700',
              color: showWorkbenchModal ? '#ffffff' : '#6d28d9',
              cursor: 'pointer'
            }}
          >
            + Nhập / Đối soát Live Workbench
          </button>

          <button
            type="button"
            onClick={() => setShowConfigPanel((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: showConfigPanel ? '#eff6ff' : '#ffffff',
              fontSize: '12px',
              fontWeight: '600',
              color: showConfigPanel ? '#1d4ed8' : '#334155',
              cursor: 'pointer'
            }}
          >
            <Sliders size={13} />
            Cấu hình Mục tiêu &amp; Chế độ Live
          </button>

          <button
            type="button"
            onClick={() => fetchLiveAnalytics()}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '12px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            Làm mới số liệu
          </button>
        </div>
      </div>

      {/* Live Workbench Verified Data Entry Form */}
      {showWorkbenchModal && (
        <form onSubmit={handleSaveWorkbench} style={{
          background: '#faf5ff',
          border: '1px solid #ddd6fe',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#4c1d95' }}>
                Nhập / Đối Soát Số Liệu Thực Tế Từ TikTok Shop Live Workbench
              </div>
              <div style={{ fontSize: '11px', color: '#6b21a8' }}>
                Dùng khi TikTok Shop API không trả về các chỉ số sâu của Workbench (Thời lượng xem TB, Lượt xem &gt; 1 phút, Preview CTR, Chi phí QC từng phiên). 100% số liệu thật, không tự ước tính.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowWorkbenchModal(false)}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #c4b5fd', background: '#fff', color: '#6d28d9', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
            >
              Đóng ✕
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '10px' }}>
            {[
              { k: 'session_id', label: 'Mã Room ID (TikTok)', placeholder: '7709349154191035188', type: 'text' },
              { k: 'title', label: 'Tên phiên LIVE', placeholder: 'Ca Sáng 18/11', type: 'text' },
              { k: 'start_time', label: 'Giờ bắt đầu (YYYY-MM-DD HH:MM)', placeholder: '2026-11-18 10:32', type: 'text' },
              { k: 'duration_minutes', label: 'Thời lượng (phút)', placeholder: '180', type: 'number' },
              { k: 'gmv', label: 'GMV ghi nhận (đ)', placeholder: '1147089', type: 'number' },
              { k: 'ad_spend', label: 'Chi phí quảng cáo (đ)', placeholder: '249840', type: 'number' },
              { k: 'units_sold', label: 'Số món bán ra', placeholder: '16', type: 'number' },
              { k: 'impressions', label: 'Lượt hiển thị', placeholder: '12570', type: 'number' },
              { k: 'total_views', label: 'Lượt xem', placeholder: '425', type: 'number' },
              { k: 'unique_viewers', label: 'Người xem (Unique)', placeholder: '351', type: 'number' },
              { k: 'avg_watch_time_sec', label: 'Thời lượng xem TB (giây)', placeholder: '62', type: 'number' },
              { k: 'views_over_1min', label: 'Lượt xem > 1 phút', placeholder: '58', type: 'number' },
              { k: 'preview_ctr_pct', label: 'Preview CTR (%)', placeholder: '1.82', type: 'number', step: '0.01' },
              { k: 'enter_room_rate_pct', label: 'Tỷ lệ nhấn vào phòng (%)', placeholder: '3.24', type: 'number', step: '0.01' },
              { k: 'ctr_live_pct', label: 'CTR của LIVE (%)', placeholder: '29.09', type: 'number', step: '0.01' },
              { k: 'sku_order_rate_pct', label: 'Tỷ lệ đặt hàng SKU (%)', placeholder: '5.00', type: 'number', step: '0.01' },
              { k: 'comment_rate_pct', label: 'Tỷ lệ bình luận (%)', placeholder: '63.47', type: 'number', step: '0.01' },
              { k: 'follow_rate_pct', label: 'Tỷ lệ theo dõi (%)', placeholder: '0.67', type: 'number', step: '0.01' },
              { k: 'share_rate_pct', label: 'Tỷ lệ chia sẻ (%)', placeholder: '1.78', type: 'number', step: '0.01' },
              { k: 'like_rate_pct', label: 'Tỷ lệ thích (%)', placeholder: '1975.28', type: 'number', step: '0.01' }
            ].map((f) => (
              <div key={f.k}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4c1d95', marginBottom: '3px' }}>{f.label}</label>
                <input
                  type={f.type}
                  step={f.step || 'any'}
                  placeholder={f.placeholder}
                  value={wbForm[f.k]}
                  onChange={(e) => setWbForm((prev) => ({ ...prev, [f.k]: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #c4b5fd', fontSize: '12px', boxSizing: 'border-box', background: '#fff' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="submit"
              disabled={wbSaving}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#6d28d9',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: wbSaving ? 'not-allowed' : 'pointer'
              }}
            >
              {wbSaving ? 'Đang lưu...' : 'Lưu số liệu thực tế & Chẩn đoán 8 chỉ số ngay'}
            </button>
          </div>
        </form>
      )}

      {/* Transparent API Diagnostic Banner (if TikTok Shop LIVE API returned an error) */}
      {sopData?.api_sync_diagnostic?.status === 'FAILED' && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '10px',
          padding: '10px 16px',
          fontSize: '12px',
          color: '#92400e',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px'
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Thông báo từ TikTok Shop LIVE Analytics API:</strong> {sopData.api_sync_diagnostic.message}
            <div style={{ marginTop: '2px', color: '#78350f' }}>
              Hệ thống cam kết <strong>không tự bịa số liệu ước tính</strong>. Bạn có thể cấp lại quyền <code>data.shop_analytics.public.read</code> trên TikTok Shop Partner Center hoặc bấm <strong>&ldquo;+ Nhập / Đối soát Live Workbench&rdquo;</strong> ở trên để nạp chính xác 16 chỉ số của từng ca Live.
            </div>
          </div>
        </div>
      )}

      {/* Executive Live Comparison & Root-Cause Diagnosis Report */}
      {sopData?.executive_report && (
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 2px 6px rgba(37,99,235,0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="#2563eb" />
              {sopData.executive_report.headline}
            </div>
            {sopData.executive_report.has_real_sessions && (
              <span style={{ fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#15803d', padding: '3px 9px', borderRadius: '999px' }}>
                100% Số liệu thực tế từ Sàn / Live Workbench
              </span>
            )}
          </div>

          {Array.isArray(sopData.executive_report.summary_points) && sopData.executive_report.summary_points.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
              {sopData.executive_report.summary_points.map((pt, i) => (
                <div key={i} style={{ fontSize: '12px', color: '#1e293b', lineHeight: '1.5' }}>• {pt}</div>
              ))}
            </div>
          )}

          {Array.isArray(sopData.executive_report.session_diagnoses) && sopData.executive_report.session_diagnoses.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              {sopData.executive_report.session_diagnoses.slice(0, 6).map((sd) => (
                <div key={sd.session_id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <div style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a' }}>
                      {sd.slot_label} — {sd.title}
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: sd.data_source === 'LIVE_WORKBENCH_VERIFIED' ? '#f3e8ff' : '#e0f2fe', color: sd.data_source === 'LIVE_WORKBENCH_VERIFIED' ? '#6d28d9' : '#0369a1' }}>
                      {sd.data_source === 'LIVE_WORKBENCH_VERIFIED' ? 'Workbench' : 'TikTok API'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>
                    GMV: <strong>{formatVND(sd.gmv || 0)}</strong>
                    {sd.spend ? ` • QC: ${formatVND(sd.spend)}` : ''}
                    {sd.roi ? ` • ROI: ${sd.roi} lần` : ''}
                    {sd.cpm ? ` • CPM: ${formatVND(sd.cpm)}` : ''}
                  </div>
                  {sd.strengths?.length > 0 && (
                    <div style={{ marginBottom: '6px' }}>
                      {sd.strengths.map((st, idx) => (
                        <div key={idx} style={{ fontSize: '11px', color: '#15803d', lineHeight: '1.45' }}>✓ {st}</div>
                      ))}
                    </div>
                  )}
                  {sd.bottlenecks?.length > 0 && (
                    <div>
                      {sd.bottlenecks.map((bt, idx) => (
                        <div key={idx} style={{ fontSize: '11px', color: '#b91c1c', lineHeight: '1.45' }}>⚠ {bt}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {Array.isArray(sopData.executive_report.action_plan) && sopData.executive_report.action_plan.length > 0 && (
            <div style={{ background: '#ffffff', border: '1px solid #dbeafe', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#1d4ed8', marginBottom: '6px' }}>
                Đề Xuất Hành Động Ngay Theo Bộ Phận:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sopData.executive_report.action_plan.map((act, idx) => (
                  <div key={idx} style={{ fontSize: '12px', color: '#1e293b', lineHeight: '1.45' }}>
                    <strong style={{ color: '#2563eb' }}>[{act.dept}] {act.title}:</strong> {act.detail}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Direct TikTok LIVE Sync Banner */}
      {syncStatus && (
        <div style={{
          background: syncStatus.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${syncStatus.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          borderRadius: '8px',
          padding: '10px 16px',
          color: syncStatus.type === 'success' ? '#065f46' : '#b91c1c',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {syncStatus.message}
        </div>
      )}

      {/* AI Director Error or Result */}
      {aiError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', color: '#b91c1c', fontSize: '13px' }}>
          {aiError}
        </div>
      )}
      {renderAiAnalysisContent()}

      {/* Configurable ROI & LIVE Mode Panel */}
      {showConfigPanel && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '12px',
          alignItems: 'end'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
              Mục tiêu thu/chi cho Live (Mặc định {sopConfig.target_roi} lần)
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              placeholder={String(sopConfig.target_roi)}
              value={targetRoiInput}
              onChange={(e) => setTargetRoiInput(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
              Ngân sách Live/ngày (25% tổng)
            </label>
            <input
              type="number"
              step="10000"
              min="0"
              placeholder={String(sopConfig.live_daily_budget)}
              value={liveDailyBudgetInput}
              onChange={(e) => setLiveDailyBudgetInput(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isSaleDay}
                onChange={(e) => setIsSaleDay(e.target.checked)}
              />
              Ngày Siêu Sale (chuẩn ≥ 5–8 giờ/ca)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isInteractiveMode}
                onChange={(e) => setIsInteractiveMode(e.target.checked)}
              />
              Live Tương tác (tỷ lệ bấm giỏ 60–90%)
            </label>
          </div>

          <div>
            <button
              type="button"
              onClick={() => fetchLiveAnalytics({ targetRoi: targetRoiInput, liveDailyBudget: liveDailyBudgetInput, isSaleDay, isInteractiveMode })}
              style={{
                width: '100%',
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Áp dụng &amp; Chẩn đoán lại
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', color: '#b91c1c', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* 60% Budget Pacing Alert & Duration Alert Banner */}
      {sopData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {latestAlert && (latestAlert.level === 'WARNING_60' || latestAlert.level === 'CRITICAL_90') && (
            <div style={{
              background: latestAlert.level === 'CRITICAL_90' ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${latestAlert.level === 'CRITICAL_90' ? '#fca5a5' : '#fcd34d'}`,
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              color: latestAlert.level === 'CRITICAL_90' ? '#991b1b' : '#92400e'
            }}>
              <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <div style={{ fontWeight: '700' }}>{latestAlert.message}</div>
                {latestAlert.action && (
                  <div style={{ fontSize: '12px', marginTop: '2px' }}>
                    <strong>Việc cần làm ngay:</strong> {latestAlert.action} (Giới hạn chi/ca: {formatVND(sopConfig.session_budget_cap)})
                  </div>
                )}
              </div>
            </div>
          )}

          {sopData.alerts?.sessions_short_duration > 0 && (
            <div style={{
              background: '#fff7ed',
              border: '1px solid #fdba74',
              borderRadius: '10px',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12px',
              color: '#9a3412'
            }}>
              <Clock size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>Cảnh báo thời lượng Live:</strong> Có <strong>{sopData.alerts.sessions_short_duration}</strong> phiên phát sóng ngắn hơn chuẩn ({sopConfig.min_duration_hours} giờ {sopConfig.is_sale_day ? 'ngày Sale' : 'ngày thường'}). Cần kéo dài thời lượng để không bị giảm lượng tiếp cận.
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3-Session Tracking Cards (Ca 1 Sáng / Ca 2 Chiều / Ca 3 Tối) */}
      {sopData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          {['session_1', 'session_2', 'session_3'].map((slotKey) => {
            const slot = slots[slotKey];
            if (!slot) return null;
            const badge = renderPacingBadge(slot.pacing_alert);
            const isSelected = funnelScope === slotKey;
            const slotMetrics = slot.funnel?.metrics || [];
            const slotRoiMetric = slotMetrics.find((m) => m.key === 'session_roi');
            const slotGmvMetric = slotMetrics.find((m) => m.key === 'session_gmv');
            const passedMetricsCount = slotMetrics.filter((m) => m.status === 'PASS').length;
            const totalEvaluatedCount = slotMetrics.filter((m) => m.status !== 'NO_DATA').length;
            const revPassed = slotGmvMetric?.status === 'PASS';
            const revNoData = !slotGmvMetric || slotGmvMetric.status === 'NO_DATA';

            return (
              <div
                key={slotKey}
                onClick={() => setFunnelScope(slotKey)}
                style={{
                  background: '#ffffff',
                  border: `2px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{slot.label}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {slot.sessions_count} phiên • Trung bình {slot.avg_duration_hours !== null ? `${slot.avg_duration_hours} giờ/ca` : 'Chưa có thời lượng'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`
                  }}>
                    {badge.label}
                  </span>
                </div>

                {/* 60% Pacing Bar */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
                    <span>Tiền quảng cáo đã chi: <strong>{slot.has_spend_data ? formatVND(slot.total_spend) : 'Chưa có dữ liệu'}</strong></span>
                    <span>Giới hạn ca: {formatVND(slot.pacing_alert?.cap || sopConfig.session_budget_cap)}</span>
                  </div>
                  <div style={{ position: 'relative', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, slot.pacing_alert?.pacing_pct || 0)}%`,
                      height: '100%',
                      background: (slot.pacing_alert?.pacing_pct || 0) >= 90 ? '#dc2626' : (slot.pacing_alert?.pacing_pct || 0) >= 60 ? '#f59e0b' : '#10b981',
                      transition: 'width 0.3s ease'
                    }} />
                    <div title="Mốc cảnh báo 60%" style={{ position: 'absolute', left: '60%', top: 0, bottom: 0, width: '2px', background: '#0f172a', opacity: 0.5 }} />
                  </div>
                </div>

                {/* Revenue Target & 8-Metric Pass Summary */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  marginBottom: '10px',
                  fontSize: '11px'
                }}>
                  <span>
                    Mục tiêu doanh số ({formatVND(slotGmvMetric?.target || sopConfig.session_gmv_target)}):{' '}
                    <strong style={{ color: revNoData ? '#64748b' : (revPassed ? '#15803d' : '#b91c1c') }}>
                      {revNoData ? 'Chưa có dữ liệu' : (revPassed ? 'Đạt mục tiêu' : 'Chưa đạt')}
                    </strong>
                  </span>
                  <span style={{ fontWeight: '700', color: '#334155' }}>
                    {passedMetricsCount}/{totalEvaluatedCount || 8} chỉ số đạt
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>Doanh số Live</div>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{slot.sessions_count > 0 ? formatVND(slot.total_gmv) : '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>Lượt hiển thị / Xem</div>
                    <div style={{ fontWeight: '700', color: '#2563eb' }}>
                      {slot.sessions_count > 0 ? `${formatNumber(slot.total_impressions)} / ${formatNumber(slot.total_views)}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>Thu/chi toàn ca</div>
                    <div style={{ fontWeight: '700', color: '#059669' }}>
                      {slotRoiMetric?.blended_roi !== null && slotRoiMetric?.blended_roi !== undefined ? `${slotRoiMetric.blended_roi} lần` : 'Chưa có'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 8-Metric Funnel Diagnosis Engine */}
      {sopData && activeFunnelCtx.funnel && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={16} color="#2563eb" />
                Bảng Chẩn Đoán 8 Chỉ Số Phiên Live ({activeFunnelCtx.title})
              </h4>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Kiểm tra từng bước từ lúc khách thấy Live đến khi chốt đơn • Tự động chỉ ra điểm yếu nhất cần sửa
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'overall', label: 'Tổng hợp kỳ' },
                { id: 'session_1', label: 'Ca 1 — Sáng (< 14h)' },
                { id: 'session_2', label: 'Ca 2 — Chiều (14h–19h)' },
                { id: 'session_3', label: 'Ca 3 — Tối (≥ 19h)' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFunnelScope(tab.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: funnelScope === tab.id ? '#2563eb' : '#cbd5e1',
                    background: funnelScope === tab.id ? '#eff6ff' : '#ffffff',
                    color: funnelScope === tab.id ? '#1d4ed8' : '#475569',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weakest Link Callout */}
          {activeFunnelCtx.funnel.weakest_link ? (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c', fontWeight: '800', fontSize: '13px' }}>
                  <Zap size={16} />
                  ĐIỂM YẾU NHẤT CẦN SỬA NGAY: {getMetricPlainLabel(activeFunnelCtx.funnel.weakest_link)} (Đạt {activeFunnelCtx.funnel.weakest_link.achievement_pct}% mục tiêu)
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '4px' }}>
                  Bộ phận phụ trách: {activeFunnelCtx.funnel.weakest_link.owner_departments}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#7f1d1d', marginBottom: '8px' }}>
                <strong>Nguyên nhân chính:</strong> {activeFunnelCtx.funnel.weakest_link.root_cause}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {activeFunnelCtx.funnel.weakest_link.prescriptions.map((p, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#1e293b', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ fontWeight: '700', color: '#b91c1c', minWidth: '88px' }}>[{p.dept}]</span>
                    <span>{p.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} />
              <span>Không phát hiện chỉ số nào dưới chuẩn trong các dữ liệu đã thu thập.</span>
            </div>
          )}

          {/* 8-Metric Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>8 Chỉ số phiên Live</th>
                  <th style={{ padding: '10px 12px' }}>Thực tế</th>
                  <th style={{ padding: '10px 12px' }}>Mục tiêu cần đạt</th>
                  <th style={{ padding: '10px 12px' }}>Đánh giá</th>
                  <th style={{ padding: '10px 12px' }}>Bộ phận xử lý</th>
                  <th style={{ padding: '10px 12px' }}>Hướng khắc phục cụ thể</th>
                </tr>
              </thead>
              <tbody>
                {activeFunnelCtx.funnel.metrics.map((m) => {
                  const isWeakest = activeFunnelCtx.funnel.weakest_link?.key === m.key;
                  return (
                    <tr key={m.key} style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isWeakest ? '#fff1f2' : 'transparent'
                    }}>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                        {getMetricPlainLabel(m)}
                        {isWeakest && (
                          <span style={{ marginLeft: '6px', fontSize: '10px', background: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>
                            YẾU NHẤT
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: m.actual === null ? '#94a3b8' : '#0f172a' }}>
                        {formatMetricVal(m)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{m.target_display}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {m.status === 'NO_DATA' && (
                          <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '4px', fontWeight: '600' }}>
                            Chưa có dữ liệu
                          </span>
                        )}
                        {m.status === 'PASS' && (
                          <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>
                            ✓ Đạt mục tiêu
                          </span>
                        )}
                        {m.status === 'NEEDS_ACTION' && (
                          <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>
                            ⚠ Chưa đạt
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155' }}>{m.owner_departments}</td>
                      <td style={{ padding: '10px 12px', color: '#475569', maxWidth: '320px' }}>
                        {m.status === 'PASS' ? 'Duy trì nhịp hiện tại.' : m.prescriptions?.[0]?.action}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Individual Sessions List (Real Room IDs & 2-3 shifts/day) */}
          {sessionsList.length > 0 && (() => {
            const activeOnly = sessionsList.filter((s) => s.is_active !== false);
            const inactiveCount = sessionsList.length - activeOnly.length;
            const visibleSessions = showInactiveSessions ? sessionsList : activeOnly;
            return (
            <div style={{ marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="#2563eb" />
                  Chi tiết từng phiên Live trên Sàn ({visibleSessions.length} phiên • Bấm &ldquo;Xem 8 chỉ số&rdquo; để chẩn đoán riêng từng ca)
                </div>
                {inactiveCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowInactiveSessions((v) => !v)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#475569',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {showInactiveSessions ? `Ẩn ${inactiveCount} phiên không hoạt động / 0đ` : `Hiện thêm ${inactiveCount} phiên không hoạt động / 0đ`}
                  </button>
                )}
              </div>
              {visibleSessions.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                  Chưa có phiên Live nào phát sinh chi tiêu hoặc đơn hàng trong kỳ. Bấm &ldquo;Đồng bộ Ca LIVE thực tế từ TikTok&rdquo; để cập nhật.
                </div>
              ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '8px 10px' }}>Ca &amp; Thời gian</th>
                      <th style={{ padding: '8px 10px' }}>Phiên LIVE &amp; Mã Room ID</th>
                      <th style={{ padding: '8px 10px' }}>Thời lượng &amp; Xem TB</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Hiển thị &amp; Lượt xem</th>
                      <th style={{ padding: '8px 10px' }}>Tỷ lệ Vào phòng / CTR / Đặt hàng</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Chi phí QC</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>GMV &amp; Số món bán</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Thu/chi (ROI)</th>
                      <th style={{ padding: '8px 10px' }}>Điểm yếu nhất cần sửa</th>
                      <th style={{ padding: '8px 10px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSessions.slice(0, 25).map((s) => {
                      const pBadge = renderPacingBadge(s.pacing_alert);
                      const isExpanded = expandedSessionId === s.session_id;
                      const isRowSelected = isExpanded || funnelScope === s.session_id;
                      const slotColors = s.slot_key === 'session_1'
                        ? { bg: '#eff6ff', color: '#1d4ed8' }
                        : s.slot_key === 'session_2'
                          ? { bg: '#fef3c7', color: '#b45309' }
                          : { bg: '#f3e8ff', color: '#7e22ce' };
                      const sessMetrics = s.funnel?.metrics || [];
                      const sessWeakest = s.funnel?.weakest_link || s.weakest_link;
                      const passedCount = sessMetrics.filter((m) => m.status === 'PASS').length;
                      const evalCount = sessMetrics.filter((m) => m.status !== 'NO_DATA').length;
                      return (
                        <React.Fragment key={s.session_id}>
                        <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9', background: isRowSelected ? '#f8fafc' : 'transparent' }}>
                          <td style={{ padding: '9px 10px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 7px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: slotColors.bg,
                              color: slotColors.color,
                              marginBottom: '3px'
                            }}>
                              {s.slot_label}
                            </span>
                            <div style={{ fontSize: '11px', color: '#334155', fontWeight: '600' }}>{s.start_time}</div>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.title}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>ID: {s.session_id}</div>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <div style={{ color: s.duration_alert?.is_short ? '#b91c1c' : '#0f172a', fontWeight: '700' }}>
                              {formatDurationPretty(s.duration_seconds, s.duration_hours)}
                              {s.duration_alert?.is_short && (
                                <span style={{ marginLeft: '4px', fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '1px 5px', borderRadius: '4px' }}>
                                  Ngắn &lt;3h
                                </span>
                              )}
                            </div>
                            {(s.avg_watch_time_sec || s.views_over_1min) && (
                              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                {s.avg_watch_time_sec ? `Xem TB: ${s.avg_watch_time_sec}s` : ''}
                                {s.views_over_1min ? ` • >1p: ${s.views_over_1min}` : ''}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>
                              {s.impressions !== null ? `${formatNumber(s.impressions)} hiển thị` : '—'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '600' }}>
                              {s.total_views !== null ? `${formatNumber(s.total_views)} lượt xem` : ''}
                              {s.unique_viewers ? ` (${formatNumber(s.unique_viewers)} người)` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '9px 10px', fontSize: '11px' }}>
                            <div>
                              Vào phòng:{' '}
                              <strong style={{ color: (s.enter_room_rate_pct || 0) >= 5 ? '#15803d' : '#b45309' }}>
                                {s.enter_room_rate_pct !== null && s.enter_room_rate_pct !== undefined ? `${s.enter_room_rate_pct}%` : '—'}
                              </strong>
                            </div>
                            {s.ctr_live_pct !== null && s.ctr_live_pct !== undefined && (
                              <div>
                                CTR Live: <strong>{s.ctr_live_pct}%</strong>
                                {s.sku_order_rate_pct ? ` • Đặt hàng: ${s.sku_order_rate_pct}%` : ''}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.spend !== null ? formatVND(s.spend) : 'Chưa có'}</div>
                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: pBadge.bg, color: pBadge.color }}>
                              {pBadge.label}
                            </span>
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                            <div style={{ fontWeight: '800', color: '#059669', fontSize: '13px' }}>{s.gmv !== null ? formatVND(s.gmv) : 'Chưa có'}</div>
                            <div style={{ fontSize: '10px', color: '#475569' }}>
                              {s.units_sold ? `${s.units_sold} món` : ''}
                              {s.gpm ? ` • GPM: ${formatVND(s.gpm)}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                            <div style={{ fontWeight: '800', color: (s.roi || 0) >= sopConfig.target_roi ? '#15803d' : '#d97706' }}>
                              {s.roi !== null && s.roi !== undefined ? `${s.roi} lần` : '—'}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>Mục tiêu {sopConfig.target_roi}x</div>
                          </td>
                          <td style={{ padding: '9px 10px', color: s.weakest_link ? '#b91c1c' : '#15803d', fontSize: '11px', fontWeight: '700' }}>
                            {s.weakest_link ? getMetricPlainLabel(s.weakest_link) : 'Đạt mục tiêu'}
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const nextId = isExpanded ? null : s.session_id;
                                setExpandedSessionId(nextId);
                                setFunnelScope(s.session_id);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '5px 9px',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: isExpanded ? '#1d4ed8' : '#cbd5e1',
                                background: isExpanded ? '#1d4ed8' : '#ffffff',
                                color: isExpanded ? '#ffffff' : '#2563eb',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {isExpanded ? 'Đóng phân tích ▲' : 'Xem 8 chỉ số ▼'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                            <td colSpan={10} style={{ padding: '14px 16px' }}>
                              <div style={{
                                background: '#ffffff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '10px',
                                padding: '16px',
                                boxShadow: '0 4px 12px rgba(37,99,235,0.08)'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                                      Phân Tích &amp; Đánh Giá Theo 8 Chỉ Số — {s.slot_label}: {s.title}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                      Mã phiên: <code>{s.session_id}</code> • Bắt đầu: <strong>{s.start_time}</strong> • Thời lượng: <strong>{formatDurationPretty(s.duration_seconds, s.duration_hours)}</strong> • Đạt <strong>{passedCount}/{evalCount || 8}</strong> chỉ số chuẩn SOP
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSessionId(null)}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: '#f8fafc',
                                      color: '#475569',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Đóng lại ✕
                                  </button>
                                </div>

                                {sessWeakest && (
                                  <div style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '8px',
                                    padding: '12px 14px',
                                    marginBottom: '12px'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Zap size={15} />
                                        ĐIỂM YẾU NHẤT CỦA PHIÊN NÀY: {getMetricPlainLabel(sessWeakest)} (Đạt {sessWeakest.achievement_pct}% mục tiêu)
                                      </div>
                                      <span style={{ fontSize: '11px', fontWeight: '700', background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px' }}>
                                        Bộ phận xử lý: {sessWeakest.owner_departments}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#7f1d1d', marginBottom: '6px' }}>
                                      <strong>Nguyên nhân:</strong> {sessWeakest.root_cause}
                                    </div>
                                    {(sessWeakest.prescriptions || []).map((p, idx) => (
                                      <div key={idx} style={{ fontSize: '12px', color: '#1e293b', display: 'flex', gap: '6px', marginTop: '2px' }}>
                                        <span style={{ fontWeight: '700', color: '#b91c1c', minWidth: '86px' }}>[{p.dept}]</span>
                                        <span>{p.action}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                                        <th style={{ padding: '7px 10px' }}>8 Chỉ số phiên Live</th>
                                        <th style={{ padding: '7px 10px' }}>Thực tế phiên này</th>
                                        <th style={{ padding: '7px 10px' }}>Mục tiêu chuẩn</th>
                                        <th style={{ padding: '7px 10px' }}>Đánh giá</th>
                                        <th style={{ padding: '7px 10px' }}>Bộ phận</th>
                                        <th style={{ padding: '7px 10px' }}>Đề xuất tối ưu</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sessMetrics.map((m) => {
                                        const isW = sessWeakest?.key === m.key;
                                        return (
                                          <tr key={m.key} style={{ borderBottom: '1px solid #f1f5f9', background: isW ? '#fff1f2' : 'transparent' }}>
                                            <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0f172a' }}>
                                              {getMetricPlainLabel(m)}
                                              {isW && (
                                                <span style={{ marginLeft: '5px', fontSize: '10px', background: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>
                                                  YẾU NHẤT
                                                </span>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', fontWeight: '700', color: m.actual === null ? '#94a3b8' : '#0f172a' }}>
                                              {formatMetricVal(m)}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: '#475569' }}>{m.target_display}</td>
                                            <td style={{ padding: '7px 10px' }}>
                                              {m.status === 'NO_DATA' && (
                                                <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 7px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>Chưa có</span>
                                              )}
                                              {m.status === 'PASS' && (
                                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: '4px', fontWeight: '700', fontSize: '11px' }}>✓ Đạt</span>
                                              )}
                                              {m.status === 'NEEDS_ACTION' && (
                                                <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: '4px', fontWeight: '700', fontSize: '11px' }}>⚠ Chưa đạt</span>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', fontWeight: '600', color: '#334155' }}>{m.owner_departments}</td>
                                            <td style={{ padding: '7px 10px', color: '#475569', maxWidth: '300px' }}>
                                              {m.status === 'PASS' ? 'Duy trì hiệu suất tốt.' : m.prescriptions?.[0]?.action}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
            );
          })()}
        </div>
      )}

      {/* 1B. Detailed LIVE GMV Max Campaigns & Products Breakdown */}
      {sopData && (() => {
        const allLiveCamps = sopData.live_campaigns || [];
        const activeLiveCamps = allLiveCamps.filter((c) => c.is_active);
        const inactiveLiveCampsCount = allLiveCamps.length - activeLiveCamps.length;
        const visibleLiveCamps = showInactiveLiveCampaigns ? allLiveCamps : activeLiveCamps;
        const liveProds = sopData.live_products || [];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Table 1: Detailed LIVE GMV Max Campaigns */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Radio size={17} color="#dc2626" />
                    Báo Cáo Chi Tiết Theo Từng Chiến Dịch LIVE GMV Max ({activeLiveCamps.length} chiến dịch có phát sinh số liệu)
                  </h4>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Đã trừ tỷ lệ đơn hủy &amp; hoàn hàng thực tế của cửa hàng ({sopData.period?.shop_loss_rate_pct || 0}%) để tính đúng Doanh số thực và Hiệu quả thu/chi thực
                  </span>
                </div>

                {inactiveLiveCampsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowInactiveLiveCampaigns((v) => !v)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {showInactiveLiveCampaigns
                      ? `Ẩn ${inactiveLiveCampsCount} chiến dịch LIVE đã tắt / 0đ`
                      : `Hiện thêm ${inactiveLiveCampsCount} chiến dịch LIVE đã tắt / 0đ`}
                  </button>
                )}
              </div>

              {visibleLiveCamps.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
                  Chưa có chiến dịch LIVE GMV Max nào phát sinh chi tiêu trong kỳ ({startDate} → {endDate}). Hãy bấm nút &ldquo;🔄 Đồng bộ Ca LIVE thực tế từ TikTok&rdquo; ở trên.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '10px 12px' }}>Chiến dịch LIVE GMV Max</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center' }}>Trạng thái</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right' }}>Chi phí QC</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right' }}>Doanh số gộp</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', color: '#b91c1c' }}>Trừ Hủy / Hoàn</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', color: '#047857' }}>Doanh số thực</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right' }}>Đơn hàng (Hủy/Hoàn)</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center' }}>Thu/chi thực vs Mục tiêu</th>
                        <th style={{ padding: '10px 12px' }}>Đánh giá &amp; Đề xuất tối ưu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLiveCamps.map((c) => {
                        const isGood = c.status_code === 'EFFECTIVE';
                        const isWaste = c.status_code === 'WASTE';
                        return (
                          <tr key={c.campaign_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', maxWidth: '250px' }}>
                              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>{c.campaign_name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                Mã CD: <code>{c.campaign_id}</code> • {c.active_days_count || 0} ngày chạy
                              </div>
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: '700',
                                background: c.is_active ? '#dcfce7' : '#f1f5f9',
                                color: c.is_active ? '#15803d' : '#64748b'
                              }}>
                                {c.delivery_badge}
                              </span>
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                              {formatVND(c.spend)}
                              {c.cpa !== null && (
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>
                                  {formatVND(c.cpa)}/đơn
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '600', color: '#334155' }}>
                              {formatVND(c.gross_revenue)}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: '#dc2626', fontWeight: '600' }}>
                              {c.cancel_refund_amount > 0 ? `-${formatVND(c.cancel_refund_amount)}` : '0 ₫'}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '800', color: '#059669', fontSize: '13px' }}>
                              {formatVND(c.realized_revenue)}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                              <div style={{ fontWeight: '700', color: '#0f172a' }}>{formatNumber(c.orders)} đơn</div>
                              <div style={{ fontSize: '10px', color: '#dc2626' }}>
                                Hủy: {c.cancelled_orders || 0} • Hoàn: {c.refunded_orders || 0}
                              </div>
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                              <div style={{
                                fontWeight: '800',
                                fontSize: '13px',
                                color: isGood ? '#059669' : isWaste ? '#dc2626' : '#d97706'
                              }}>
                                {c.realized_roi !== null && c.realized_roi !== undefined ? `${c.realized_roi} lần` : '—'}
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}> / {c.target_roi} lần</span>
                              </div>
                              {c.gross_roi !== null && c.gross_roi !== undefined && (
                                <div style={{ fontSize: '10px', color: '#64748b' }}>
                                  (Trước hủy/hoàn: {c.gross_roi} lần)
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', maxWidth: '280px', fontSize: '11px', color: '#334155', lineHeight: '1.45' }}>
                              <div style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: '700',
                                fontSize: '10px',
                                marginBottom: '3px',
                                background: isGood ? '#dcfce7' : isWaste ? '#fef2f2' : '#fef3c7',
                                color: isGood ? '#15803d' : isWaste ? '#b91c1c' : '#b45309'
                              }}>
                                {c.status_label}
                              </div>
                              <div>{c.recommendation}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Table 2: Detailed Products Sold in Period */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  📦 Báo Cáo Chi Tiết Theo Từng Mã Sản Phẩm Bán Ra Trong Kỳ ({liveProds.length} sản phẩm)
                </h4>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Thống kê số đơn, đơn hủy, đơn hoàn và doanh số thực nhận của từng mã sản phẩm phục vụ phiên Live
                </span>
              </div>

              {liveProds.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                  Chưa có đơn hàng sản phẩm phát sinh trong kỳ đang chọn.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '10px 12px' }}>Sản phẩm &amp; Mã SP</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center' }}>Nhóm sản phẩm</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tổng đơn</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', color: '#b91c1c' }}>Đơn hủy / Đơn hoàn</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right' }}>Doanh số gộp</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', color: '#b91c1c' }}>Tiền hủy / hoàn</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', color: '#047857' }}>Doanh số thực nhận</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tỷ trọng doanh số</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveProds.map((p) => (
                        <tr key={p.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {p.product_image ? (
                                <img
                                  src={p.product_image}
                                  alt={p.product_name}
                                  style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }}
                                />
                              ) : (
                                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', flexShrink: 0 }}>
                                  SP
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12px' }}>{p.product_name}</div>
                                <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Mã SP: {p.product_id}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: p.is_main_sku ? '#dcfce7' : '#eff6ff',
                              color: p.is_main_sku ? '#15803d' : '#1d4ed8'
                            }}>
                              {p.sku_role_label}
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                            {formatNumber(p.orders_count)} đơn
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '400' }}>{formatNumber(p.units_sold)} sản phẩm</div>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#dc2626', fontWeight: '600' }}>
                            Hủy: {p.cancelled_orders} • Hoàn: {p.refunded_orders}
                            <div style={{ fontSize: '10px', color: '#64748b' }}>({p.cancel_refund_rate_pct}%)</div>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#334155', fontWeight: '600' }}>
                            {formatVND(p.gross_revenue)}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#dc2626', fontWeight: '600' }}>
                            {p.cancel_refund_loss > 0 ? `-${formatVND(p.cancel_refund_loss)}` : '0 ₫'}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#059669', fontWeight: '800', fontSize: '13px' }}>
                            {formatVND(p.realized_revenue)}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: '#2563eb' }}>
                            {p.share_of_shop_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 2. 16 LIVE Workbench KPIs Grid with Plain Vietnamese Labels */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={16} color="#2563eb" />
            Bộ 16 Chỉ Số Tổng Quan Dữ Liệu LIVE (Chuẩn TikTok Shop Live Workbench)
          </h4>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Ngân sách quảng cáo tối thiểu khuyến nghị: <strong>{formatVND(sopConfig.session_budget_cap)}/ca</strong>
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px'
        }}>
          {/* KPI 1 */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>1. Lượt hiển thị LIVE</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {formatNumber(liveKpis?.impressions || 0)}
            </div>
          </div>

          {/* KPI 2 */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>2. Lượt xem LIVE</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {formatNumber(liveKpis?.total_views || 0)}
            </div>
          </div>

          {/* KPI 3 */}
          {(() => {
            const ev = evalTarget(liveKpis?.gmv_per_hour, targets.gmv_per_hour);
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>3. GMV / Giờ</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: ev.passed ? '#15803d' : '#b45309', marginTop: '4px' }}>
                  {formatVND(liveKpis?.gmv_per_hour || 0)}
                </div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: ev.badgeColor, marginTop: '4px' }}>
                  {ev.badgeText}
                </div>
              </div>
            );
          })()}

          {/* KPI 4 */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>4. Lượt hiển thị mỗi giờ</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {formatNumber(liveKpis?.impressions_per_hour || 0)}
            </div>
          </div>

          {/* KPI 5 */}
          {(() => {
            const ev = evalTarget(liveKpis?.gpm, targets.gpm);
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>5. GPM hiển thị (Doanh số/1.000 hiển thị)</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: ev.passed ? '#15803d' : '#b45309', marginTop: '4px' }}>
                  {formatVND(liveKpis?.gpm || 0)}
                </div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: ev.badgeColor, marginTop: '4px' }}>
                  {ev.badgeText}
                </div>
              </div>
            );
          })()}

          {/* KPI 6 */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>6. Tỷ lệ bình luận (%)</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {liveKpis?.comment_rate ?? 0}%
            </div>
          </div>

          {/* KPI 7 */}
          {(() => {
            const ev = evalTarget(liveKpis?.follow_rate, targets.follow_rate);
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>7. Tỷ lệ theo dõi (%)</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: ev.passed ? '#15803d' : '#b45309', marginTop: '4px' }}>
                  {liveKpis?.follow_rate ?? 0}%
                </div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: ev.badgeColor, marginTop: '4px' }}>
                  {ev.badgeText}
                </div>
              </div>
            );
          })()}

          {/* KPI 8 */}
          {(() => {
            const ev = evalTarget(liveKpis?.enter_room_rate, targets.enter_room_rate);
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>8. Tỷ lệ nhấn (Vào phòng LIVE %)</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: ev.passed ? '#15803d' : '#b45309', marginTop: '4px' }}>
                  {liveKpis?.enter_room_rate ?? 0}%
                </div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: ev.badgeColor, marginTop: '4px' }}>
                  {ev.badgeText}
                </div>
              </div>
            );
          })()}

          {/* KPI 9 */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>9. Tỷ lệ chia sẻ (%)</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {liveKpis?.share_rate ?? 0}%
            </div>
          </div>

          {/* KPI 10 */}
          {(() => {
            const ev = evalTarget(liveKpis?.ctr_live, targets.ctr_live);
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>10. CTR của LIVE (Bấm sản phẩm %)</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: ev.passed ? '#15803d' : '#b45309', marginTop: '4px' }}>
                  {liveKpis?.ctr_live ?? 0}%
                </div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: ev.badgeColor, marginTop: '4px' }}>
                  {ev.badgeText}
                </div>
              </div>
            );
          })()}

          {/* KPI 11 */}
          {(() => {
            const ev = evalTarget(liveKpis?.sku_order_rate, targets.sku_order_rate);
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>11. Tỷ lệ đặt hàng (Đơn hàng SKU %)</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: ev.passed ? '#15803d' : '#b45309', marginTop: '4px' }}>
                  {liveKpis?.sku_order_rate ?? 0}%
                </div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: ev.badgeColor, marginTop: '4px' }}>
                  {ev.badgeText}
                </div>
              </div>
            );
          })()}

          {/* KPI 12: Hiệu quả thu/chi từ Quảng cáo vs Toàn phiên Live */}
          {(() => {
            const adsRoasVal = liveKpis?.ads_roas ?? liveKpis?.ads_roi ?? null;
            const hasAdsRoas = adsRoasVal !== null && adsRoasVal !== undefined;
            const blendedVal = liveKpis?.blended_live_roas;
            const ev = evalTarget(hasAdsRoas ? adsRoasVal : null, targets.ads_roi);
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>12. Hiệu quả thu/chi từ Quảng cáo</div>
                  {blendedVal !== null && blendedVal !== undefined && (
                    <span style={{ fontSize: '10px', color: '#6366f1', fontWeight: '700', background: '#eef2ff', padding: '2px 6px', borderRadius: '4px' }}>
                      Toàn phiên: {blendedVal} lần
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: hasAdsRoas ? (ev.passed ? '#15803d' : '#b45309') : '#64748b', marginTop: '4px' }}>
                  {hasAdsRoas ? `${adsRoasVal} lần` : 'Chưa có dữ liệu'}
                </div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: ev.badgeColor || '#64748b', marginTop: '4px' }}>
                  {hasAdsRoas ? ev.badgeText : `Chi phí quảng cáo: ${formatVND(liveKpis?.ad_spend || 0)}`}
                </div>
                {liveKpis?.attributed_live_gmv > 0 && (
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Doanh số thực từ QC: {formatVND(liveKpis.realized_attributed_live_gmv ?? liveKpis.attributed_live_gmv)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* KPI 13: Người xem duy nhất */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>13. Người xem duy nhất (Unique Viewers)</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {liveKpis?.unique_viewers ? `${formatNumber(liveKpis.unique_viewers)} người` : 'Chưa có'}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              Tổng lượt xem: {formatNumber(liveKpis?.total_views || 0)}
            </div>
          </div>

          {/* KPI 14: Thời lượng xem trung bình */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>14. Thời lượng xem trung bình / lượt</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: (liveKpis?.avg_watch_time_sec || 0) >= 45 ? '#15803d' : '#b45309', marginTop: '4px' }}>
              {liveKpis?.avg_watch_time_sec ? `${liveKpis.avg_watch_time_sec} giây` : 'Chưa có'}
            </div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: (liveKpis?.avg_watch_time_sec || 0) >= 45 ? '#15803d' : '#b45309', marginTop: '4px' }}>
              {(liveKpis?.avg_watch_time_sec || 0) >= 45 ? '✓ Giữ chân tốt (≥ 45s)' : '⚠ Thoát nhanh (Cần kéo lên ≥ 45s)'}
            </div>
          </div>

          {/* KPI 15: Lượt xem > 1 phút */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>15. Lượt xem &gt; 1 phút</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
              {liveKpis?.views_over_1min ? `${formatNumber(liveKpis.views_over_1min)} lượt` : 'Chưa có'}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              Khách ở lại xem sâu &gt; 60 giây
            </div>
          </div>

          {/* KPI 16: Số món bán ra & Tỷ lệ thích */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>16. Số món bán ra &amp; Tỷ lệ thích</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
              {formatNumber(liveKpis?.units_sold || 0)} món
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              Tỷ lệ thích: <strong>{liveKpis?.like_rate ? `${liveKpis.like_rate}%` : '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Top 5 Recommended Golden Slots */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={16} color="#dc2626" />
              5 Khung Giờ Vàng Live Ra Đơn Tốt Nhất
            </h4>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Phân tích từ lịch sử đặt hàng 90 ngày để chọn khung giờ có nhiều người mua sẵn sàng chốt đơn nhất
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {topSlots.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              Đang phân tích dữ liệu khung giờ đặt hàng từ hệ thống...
            </div>
          ) : (
            topSlots.map((slot, idx) => (
              <div key={idx} style={{
                background: idx === 0 ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${idx === 0 ? '#bfdbfe' : '#e2e8f0'}`,
                borderRadius: '8px',
                padding: '12px 14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: idx === 0 ? '#1d4ed8' : '#475569' }}>
                    HẠNG #{idx + 1}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{slot.orders_count} đơn</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
                  {slot.day_name}
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#2563eb', marginTop: '2px' }}>
                  {slot.hour_label}
                </div>
                <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', marginTop: '6px' }}>
                  Doanh số: {formatVND(slot.gross_sales)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Special Campaign Days Analysis */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={16} color="#d97706" />
          Phân Tích Nhịp Bán Hàng Các Ngày Siêu Sale Trong Tháng
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>1. Ngày Đôi (09/09, 10/10...)</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', lineHeight: '1.5' }}>
              Lượng người vào sàn tăng 3,5–4,2 lần. Nên tăng ngân sách quảng cáo vào khung 0h–2h và 20h–23h; chuẩn bị ưu đãi sốc để kéo người bấm vào xem Live.
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>2. Ngày Giữa Tháng (13–15)</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', lineHeight: '1.5' }}>
              Khách hàng có xu hướng chốt đơn đồ gia dụng và chăm sóc sức khỏe. Khung trưa 11h30–13h30 có tỷ lệ chốt đơn cao.
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>3. Ngày Lương Về (24–25)</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', lineHeight: '1.5' }}>
              Giá trị trung bình mỗi đơn cao nhất tháng. Nên tập trung bán các gói kết hợp giá trị cao từ 300.000đ–600.000đ vào ca tối 19h30–22h30.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Business Disclaimer */}
      <div style={{
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '12px',
        color: '#92400e',
        lineHeight: '1.6',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px'
      }}>
        <AlertTriangle size={16} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
        <span>
          <strong>Lưu ý vận hành:</strong> {goldenHours?.disclaimer || 'Số liệu lịch sử dùng để tham khảo chiến lược phát sóng và đẩy khuyến mại, không bảo đảm chắc chắn hiệu quả trong tương lai nếu thiếu kịch bản tương tác và ngân sách quảng cáo.'}
        </span>
      </div>
    </div>
  );
}
