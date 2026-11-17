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

  // Funnel diagnosis scope: 'overall' | 'session_1' | 'session_2' | session_id
  const [funnelScope, setFunnelScope] = useState('overall');

  // AI Marketing Director state
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Direct TikTok LIVE Sync state
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showInactiveSessions, setShowInactiveSessions] = useState(false);

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
        `commerce_dashboard.php?action=trigger_sync&domain=ads_lives&shop_id=${encodeURIComponent(shopId || '')}&start_date=${encodeURIComponent(startDate || '')}&end_date=${encodeURIComponent(endDate || '')}`,
        'POST',
        { shop_id: shopId, domain: 'ads_lives', start_date: startDate, end_date: endDate }
      );
      if (res && res.success) {
        const syncedCount = res.data?.records_ingested ?? res.records_ingested ?? res.data?.synced_count ?? null;
        const msg = res.message || res.data?.message || (syncedCount !== null
          ? `Đã đồng bộ thành công ${syncedCount} bản ghi Ca Live từ TikTok (${startDate} → ${endDate}).`
          : `Đã đồng bộ dữ liệu Ca Live thực tế từ TikTok (${startDate} → ${endDate}).`);
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
      return { title: 'Ca 1 (Sáng / Trưa trước 14:00)', funnel: slots.session_1.funnel };
    }
    if (funnelScope === 'session_2' && slots.session_2?.funnel) {
      return { title: 'Ca 2 (Chiều / Tối từ 14:00)', funnel: slots.session_2.funnel };
    }
    const matchedSess = sessionsList.find((s) => s.session_id === funnelScope);
    if (matchedSess && matchedSess.funnel) {
      return { title: `${matchedSess.slot_label}: ${matchedSess.title}`, funnel: matchedSess.funnel };
    }
    return { title: 'Tổng hợp toàn kỳ Live', funnel: sopData?.overall_funnel || null };
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
              Theo Dõi 2 Ca Live, Cảnh Báo Ngân Sách 60% &amp; Chẩn Đoán 8 Chỉ Số
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Ngân sách Live chiếm 25% tổng ngân sách (chia đều 2 ca/ngày) • Nguồn cấu hình: <strong>{formatConfigSource(sopConfig.source)}</strong>
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

      {/* 2-Session Tracking Cards (Ca 1 vs Ca 2) with Revenue Target Check */}
      {sopData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '14px' }}>
          {['session_1', 'session_2'].map((slotKey) => {
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
                    <div style={{ color: '#64748b', fontSize: '11px' }}>Thu/chi Quảng cáo</div>
                    <div style={{ fontWeight: '700', color: '#2563eb' }}>
                      {slotRoiMetric?.ads_roas !== null && slotRoiMetric?.ads_roas !== undefined ? `${slotRoiMetric.ads_roas} lần` : 'Chưa có'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>Thu/chi toàn phiên</div>
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
                { id: 'session_1', label: 'Ca 1 (Trước 14h)' },
                { id: 'session_2', label: 'Ca 2 (Từ 14h)' }
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

          {/* Individual Sessions List (Active/Spending by default) */}
          {sessionsList.length > 0 && (() => {
            const activeOnly = sessionsList.filter((s) => s.is_active !== false);
            const inactiveCount = sessionsList.length - activeOnly.length;
            const visibleSessions = showInactiveSessions ? sessionsList : activeOnly;
            return (
            <div style={{ marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="#475569" />
                  Chi tiết từng phiên Live đang hoạt động ({visibleSessions.length} phiên)
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
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '8px 10px' }}>Ca</th>
                      <th style={{ padding: '8px 10px' }}>Tên phiên Live</th>
                      <th style={{ padding: '8px 10px' }}>Thời lượng</th>
                      <th style={{ padding: '8px 10px' }}>Tiền đã chi / Mức tiêu</th>
                      <th style={{ padding: '8px 10px' }}>Doanh số</th>
                      <th style={{ padding: '8px 10px' }}>Điểm yếu nhất</th>
                      <th style={{ padding: '8px 10px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSessions.slice(0, 15).map((s) => {
                      const pBadge = renderPacingBadge(s.pacing_alert);
                      return (
                        <tr key={s.session_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: '700' }}>{s.slot_label}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{s.title}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{s.start_time}</div>
                          </td>
                          <td style={{ padding: '8px 10px', color: s.duration_alert?.is_short ? '#b91c1c' : '#0f172a', fontWeight: s.duration_alert?.is_short ? '700' : '400' }}>
                            {s.duration_hours !== null ? `${s.duration_hours} giờ` : 'Chưa có'}
                            {s.duration_alert?.is_short && ' (Ngắn)'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div>{s.spend !== null ? formatVND(s.spend) : 'Chưa có'}</div>
                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: pBadge.bg, color: pBadge.color }}>
                              {pBadge.label}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: '700' }}>{s.gmv !== null ? formatVND(s.gmv) : 'Chưa có'}</td>
                          <td style={{ padding: '8px 10px', color: s.weakest_link ? '#b91c1c' : '#15803d', fontSize: '11px', fontWeight: '600' }}>
                            {s.weakest_link ? getMetricPlainLabel(s.weakest_link) : 'Đạt mục tiêu'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <button
                              type="button"
                              onClick={() => setFunnelScope(s.session_id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '4px 8px',
                                borderRadius: '5px',
                                border: '1px solid #cbd5e1',
                                background: funnelScope === s.session_id ? '#eff6ff' : '#ffffff',
                                color: '#2563eb',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Xem 8 chỉ số <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
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

      {/* 2. Preserved 12 LIVE KPIs Grid with Plain Vietnamese Labels */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={16} color="#2563eb" />
            Bộ 12 Chỉ Số Hiệu Suất Phiên Live (Chuẩn Mục Tiêu Shop)
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
            <div style={{ fontSize: '12px', color: '#64748b' }}>1. Lượt người thấy Live</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {formatNumber(liveKpis?.impressions || 0)}
            </div>
          </div>

          {/* KPI 2 */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>2. Lượt người vào xem</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {formatNumber(liveKpis?.total_views || 0)}
            </div>
          </div>

          {/* KPI 3 */}
          {(() => {
            const ev = evalTarget(liveKpis?.gmv_per_hour, targets.gmv_per_hour);
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>3. Doanh số / Giờ</div>
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
            <div style={{ fontSize: '12px', color: '#64748b' }}>4. Lượt hiển thị / Giờ</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {formatNumber(liveKpis?.impressions_per_hour || 0)}
            </div>
          </div>

          {/* KPI 5 */}
          {(() => {
            const ev = evalTarget(liveKpis?.gpm, targets.gpm);
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>5. Doanh số trên 1.000 lượt hiển thị</div>
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
                <div style={{ fontSize: '12px', color: '#64748b' }}>7. Tỷ lệ bấm Theo dõi (%)</div>
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
                <div style={{ fontSize: '12px', color: '#64748b' }}>8. Tỷ lệ bấm vào xem Live (%)</div>
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
                <div style={{ fontSize: '12px', color: '#64748b' }}>10. Tỷ lệ bấm giỏ hàng (%)</div>
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
                <div style={{ fontSize: '12px', color: '#64748b' }}>11. Tỷ lệ chốt đơn (%)</div>
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
            const adsRoasVal = liveKpis?.ads_roas ?? liveKpis?.ads_roi;
            const blendedVal = liveKpis?.blended_live_roas;
            const ev = evalTarget(adsRoasVal, targets.ads_roi);
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
                <div style={{ fontSize: '18px', fontWeight: '800', color: adsRoasVal !== null ? (ev.passed ? '#15803d' : '#b45309') : '#64748b', marginTop: '4px' }}>
                  {adsRoasVal !== null ? `${adsRoasVal} lần` : 'Chưa chạy quảng cáo'}
                </div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: ev.badgeColor, marginTop: '4px' }}>
                  {adsRoasVal !== null ? ev.badgeText : 'Chi phí quảng cáo: 0 ₫'}
                </div>
                {liveKpis?.attributed_live_gmv > 0 && (
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Doanh số từ Quảng cáo: {formatVND(liveKpis.attributed_live_gmv)}
                  </div>
                )}
              </div>
            );
          })()}
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
