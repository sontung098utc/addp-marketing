import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Sliders,
  RefreshCw,
  TrendingUp,
  Video,
  Radio,
  ShoppingBag,
  Calendar,
  X,
  Save,
  Info,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function getTodayLocalDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatVND(num) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
}

function formatNumber(num) {
  return new Intl.NumberFormat('vi-VN').format(num || 0);
}

function ProgressBar({ pct, color = '#2563eb', height = 10 }) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div style={{ width: '100%', height: `${height}px`, background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          background: color,
          borderRadius: '999px',
          transition: 'width 0.35s ease'
        }}
      />
    </div>
  );
}

function renderInlineBold(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx} style={{ color: '#0f172a', fontWeight: '700' }}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderMarkdownBlocks(markdownText) {
  const lines = String(markdownText || '').split(/\r?\n/);
  const blocks = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const key = `list-${blocks.length}`;
    if (listType === 'ul') {
      blocks.push(
        <ul key={key} style={{ margin: '6px 0 10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px', color: '#334155' }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ lineHeight: 1.55 }}>{renderInlineBold(item)}</li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <ol key={key} style={{ margin: '6px 0 10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px', color: '#334155' }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ lineHeight: 1.55 }}>{renderInlineBold(item)}</li>
          ))}
        </ol>
      );
    }
    listType = null;
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }
    if (line.startsWith('### ')) {
      flushList();
      blocks.push(
        <h4 key={`h4-${idx}`} style={{ margin: '12px 0 6px', fontSize: '13.5px', fontWeight: '700', color: '#1e1b4b' }}>
          {renderInlineBold(line.slice(4))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      flushList();
      blocks.push(
        <h3 key={`h3-${idx}`} style={{ margin: '14px 0 6px', fontSize: '14.5px', fontWeight: '700', color: '#312e81', borderBottom: '1px solid #e0e7ff', paddingBottom: '4px' }}>
          {renderInlineBold(line.slice(3))}
        </h3>
      );
      return;
    }
    if (/^[-*•]\s+/.test(line)) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(line.replace(/^[-*•]\s+/, ''));
      return;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(line.replace(/^\d+[.)]\s+/, ''));
      return;
    }
    flushList();
    blocks.push(
      <p key={`p-${idx}`} style={{ margin: '6px 0', lineHeight: 1.6, color: '#334155' }}>
        {renderInlineBold(line)}
      </p>
    );
  });

  flushList();
  return blocks;
}

function renderAiReportBlock(payload) {
  if (!payload) return null;
  if (typeof payload === 'string') {
    return (
      <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#1e293b' }}>
        {renderMarkdownBlocks(payload)}
      </div>
    );
  }

  const snap = payload.metrics_snapshot && typeof payload.metrics_snapshot === 'object' ? payload.metrics_snapshot : null;
  const isGemini = String(payload.source || '').toLowerCase() === 'gemini';
  const sourceBadge = isGemini
    ? `Giám đốc Marketing AI (${payload.model || 'Gemini'})`
    : 'Phân tích tự động theo quy trình';

  const pills = [];
  if (snap) {
    const snapDays = Number(snap.days_count || 1);
    const snapPeriodLabel = snapDays > 1 ? `Doanh số (${snapDays} ngày)` : 'Doanh số ngày';
    if (snap.actual_gmv !== undefined) {
      pills.push({
        label: snapPeriodLabel,
        val: `${formatVND(snap.actual_gmv)} / ${formatVND(snap.daily_gmv_target || 0)}`
      });
    }
    if (snap.actual_spend !== undefined) {
      pills.push({
        label: 'Tiền quảng cáo',
        val: `${formatVND(snap.actual_spend)} / ${formatVND(snap.daily_spend_cap || 0)}`
      });
    }
    if (snap.actual_roi !== undefined || snap.target_roi !== undefined) {
      pills.push({
        label: 'Hiệu quả thu/chi',
        val: `${snap.actual_roi !== null && snap.actual_roi !== undefined ? `${snap.actual_roi} lần` : 'Chưa có'} (Mục tiêu ${snap.target_roi || 13} lần)`
      });
    }
    if (snap.video_share_pct !== undefined && snap.live_share_pct !== undefined) {
      pills.push({
        label: 'Tỷ trọng Video / Live',
        val: `${snap.video_share_pct}% / ${snap.live_share_pct}%`
      });
    }
    if (snap.main_sku_share_pct !== undefined && snap.sub_sku_share_pct !== undefined) {
      pills.push({
        label: 'Sản phẩm chính / phụ',
        val: `${snap.main_sku_share_pct}% / ${snap.sub_sku_share_pct}%`
      });
    }
    if (snap.active_videos !== undefined) {
      pills.push({
        label: 'Video đang chạy',
        val: `${formatNumber(snap.active_videos)} video`
      });
    }
    if (snap.ca1_gmv !== undefined || snap.ca2_gmv !== undefined) {
      pills.push({
        label: 'Doanh số Ca 1 / Ca 2',
        val: `${formatVND(snap.ca1_gmv || 0)} / ${formatVND(snap.ca2_gmv || 0)}`
      });
    }
  }

  const markdownSource = payload.analysis_markdown || payload.summary || payload.overview || payload.analysis || payload.report || payload.message || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#1e293b' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: '700',
            background: isGemini ? '#4f46e5' : '#0f766e',
            color: '#ffffff'
          }}
        >
          <Sparkles size={12} />
          <span>{sourceBadge}</span>
        </span>
        {payload.generated_at && (
          <span style={{ fontSize: '11px', color: '#64748b' }}>Cập nhật lúc: {payload.generated_at}</span>
        )}
      </div>

      {payload.headline && (
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
          {payload.headline}
        </div>
      )}

      {pills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {pills.map((p) => (
            <div
              key={p.label}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px'
              }}
            >
              <span style={{ color: '#64748b' }}>{p.label}: </span>
              <strong style={{ color: '#0f172a' }}>{p.val}</strong>
            </div>
          ))}
        </div>
      )}

      {markdownSource ? (
        <div style={{ paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
          {renderMarkdownBlocks(markdownSource)}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Đã hoàn tất phân tích dữ liệu ngày {snap?.date || ''}.
        </div>
      )}
    </div>
  );
}

export default function CommerceSopCommandCenterView({
  shopId = '7495657895504611503',
  startDate,
  endDate,
  apiRequest
}) {
  const [filterMode, setFilterMode] = useState(() => (startDate && endDate && startDate !== endDate ? 'custom' : 'single'));
  const [selectedDate, setSelectedDate] = useState(() => endDate || getTodayLocalDate());
  const [rangeStart, setRangeStart] = useState(() => startDate || getTodayLocalDate());
  const [rangeEnd, setRangeEnd] = useState(() => endDate || getTodayLocalDate());
  const [hasManualDate, setHasManualDate] = useState(false);

  const effectiveStart = filterMode === 'single' ? selectedDate : rangeStart;
  const effectiveEnd = filterMode === 'single' ? selectedDate : rangeEnd;

  const applyQuickRange = (mode) => {
    setHasManualDate(true);
    const anchor = getTodayLocalDate();
    if (mode === 'single') {
      setFilterMode('single');
      return;
    }
    setFilterMode(mode);
    if (mode === '7d') {
      const d = new Date(`${anchor}T00:00:00`);
      d.setDate(d.getDate() - 6);
      setRangeStart(d.toISOString().slice(0, 10));
      setRangeEnd(anchor);
    } else if (mode === 'mtd') {
      setRangeStart(`${anchor.slice(0, 7)}-01`);
      setRangeEnd(anchor);
    } else if (mode === '30d') {
      const d = new Date(`${anchor}T00:00:00`);
      d.setDate(d.getDate() - 29);
      setRangeStart(d.toISOString().slice(0, 10));
      setRangeEnd(anchor);
    }
  };
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const [syncingTikTok, setSyncingTikTok] = useState(false);
  const [syncBanner, setSyncBanner] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formState, setFormState] = useState({});

  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [showBriefingPreview, setShowBriefingPreview] = useState(false);
  const [showInactiveCampaigns, setShowInactiveCampaigns] = useState(false);

  // AI Marketing Director Overview state
  const [aiOverviewLoading, setAiOverviewLoading] = useState(false);
  const [aiOverviewResult, setAiOverviewResult] = useState(null);
  const [aiOverviewError, setAiOverviewError] = useState(null);

  // Campaign Detail Modal state
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetailLoading, setCampaignDetailLoading] = useState(false);
  const [campaignDetailData, setCampaignDetailData] = useState(null);
  const [campaignDetailError, setCampaignDetailError] = useState(null);
  const [aiCampLoading, setAiCampLoading] = useState(false);
  const [aiCampResult, setAiCampResult] = useState(null);
  const [aiCampError, setAiCampError] = useState(null);

  const fetchPacing = useCallback(async () => {
    if (!apiRequest) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(
        `commerce_dashboard.php?action=get_sop_pacing&shop_id=${encodeURIComponent(shopId)}&date=${encodeURIComponent(effectiveEnd)}&start_date=${encodeURIComponent(effectiveStart)}&end_date=${encodeURIComponent(effectiveEnd)}`
      );
      if (res && res.success && res.data) {
        setData(res.data);
        if (res.data.config) {
          setFormState(res.data.config);
        }
      } else {
        setError(res?.message || 'Không thể tải dữ liệu theo dõi mục tiêu.');
      }
    } catch (err) {
      setError(err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [shopId, effectiveStart, effectiveEnd, apiRequest]);

  useEffect(() => {
    if (!hasManualDate && startDate && endDate) {
      if (startDate === endDate) {
        setFilterMode('single');
        setSelectedDate(endDate);
        setRangeStart(startDate);
        setRangeEnd(endDate);
      } else {
        setFilterMode('custom');
        setRangeStart(startDate);
        setRangeEnd(endDate);
        setSelectedDate(endDate);
      }
    }
  }, [startDate, endDate, hasManualDate]);

  useEffect(() => {
    fetchPacing();
  }, [fetchPacing]);

  const handleSyncTikTok = async () => {
    if (!apiRequest || syncingTikTok) return;
    setSyncingTikTok(true);
    setSyncBanner(null);
    const syncStart = effectiveStart || `${effectiveEnd.slice(0, 7)}-01`;
    try {
      const res = await apiRequest(
        `commerce_dashboard.php?action=trigger_sync&shop_id=${encodeURIComponent(shopId)}&domain=ads_all&start_date=${encodeURIComponent(syncStart)}&end_date=${encodeURIComponent(effectiveEnd)}`,
        'POST',
        { shop_id: shopId, domain: 'ads_all', start_date: syncStart, end_date: effectiveEnd }
      );
      if (res && res.success) {
        setSyncBanner({
          type: 'success',
          text: res.message || `Đã đồng bộ số liệu quảng cáo thực tế từ TikTok (${syncStart} đến ${effectiveEnd}).`
        });
        await fetchPacing();
      } else {
        setSyncBanner({
          type: 'error',
          text: res?.message || 'Đồng bộ số liệu TikTok chưa thành công. Vui lòng thử lại.'
        });
      }
    } catch (err) {
      setSyncBanner({
        type: 'error',
        text: err?.message || 'Lỗi kết nối khi đồng bộ số liệu từ TikTok.'
      });
    } finally {
      setSyncingTikTok(false);
    }
  };

  const handleOpenSettings = () => {
    if (data?.config) {
      setFormState({ ...data.config });
    }
    setSaveError(null);
    setShowSettings(true);
  };

  const handleFormChange = (field, value) => {
    setFormState((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'video_split_pct') {
        const v = Math.max(0, Math.min(100, Number(value) || 0));
        next.video_split_pct = v;
        next.live_split_pct = Number((100 - v).toFixed(2));
      } else if (field === 'live_split_pct') {
        const l = Math.max(0, Math.min(100, Number(value) || 0));
        next.live_split_pct = l;
        next.video_split_pct = Number((100 - l).toFixed(2));
      } else if (field === 'main_sku_split_pct') {
        const m = Math.max(0, Math.min(100, Number(value) || 0));
        next.main_sku_split_pct = m;
        next.sub_sku_split_pct = Number((100 - m).toFixed(2));
      } else if (field === 'sub_sku_split_pct') {
        const s = Math.max(0, Math.min(100, Number(value) || 0));
        next.sub_sku_split_pct = s;
        next.main_sku_split_pct = Number((100 - s).toFixed(2));
      }
      return next;
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!apiRequest) return;
    setSavingConfig(true);
    setSaveError(null);
    try {
      const payload = {
        shop_id: shopId,
        target_roi: Number(formState.target_roi) || 13.0,
        video_target_roi: Number(formState.video_target_roi) || 15.0,
        live_target_roi: Number(formState.live_target_roi) || 13.0,
        monthly_gmv_target: Number(formState.monthly_gmv_target) || 0,
        daily_gmv_target: Number(formState.daily_gmv_target) || 0,
        video_split_pct: Number(formState.video_split_pct ?? 75),
        live_split_pct: Number(formState.live_split_pct ?? 25),
        main_sku_split_pct: Number(formState.main_sku_split_pct ?? 80),
        sub_sku_split_pct: Number(formState.sub_sku_split_pct ?? 20),
        main_sku_keyword: formState.main_sku_keyword || 'Viên sủi mát gan',
        main_sku_product_id: formState.main_sku_product_id || '',
        live_sessions_per_day: Number(formState.live_sessions_per_day) || 2,
        red_flag_roi_threshold: Number(formState.red_flag_roi_threshold) || 10.0,
        red_flag_spend_pct: Number(formState.red_flag_spend_pct) || 50,
        red_flag_min_clicks: Number(formState.red_flag_min_clicks) || 50,
        yellow_flag_hour: Number(formState.yellow_flag_hour ?? 14),
        yellow_flag_spend_pct: Number(formState.yellow_flag_spend_pct) || 50,
        green_flag_roi_buffer: Number(formState.green_flag_roi_buffer ?? 2.0),
        green_flag_spend_pct: Number(formState.green_flag_spend_pct) || 80
      };

      const res = await apiRequest(
        `commerce_dashboard.php?action=save_sop_config&shop_id=${encodeURIComponent(shopId)}`,
        'POST',
        payload
      );
      if (res && res.success) {
        setShowSettings(false);
        await fetchPacing();
      } else {
        setSaveError(res?.message || 'Không thể lưu cài đặt mục tiêu.');
      }
    } catch (err) {
      setSaveError(err?.message || 'Lỗi khi lưu cài đặt.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCopyBriefing = async () => {
    const text = data?.morning_briefing_text || '';
    if (!text) return;
    try {
      await globalThis.navigator.clipboard.writeText(text);
      setCopiedBriefing(true);
      globalThis.setTimeout(() => setCopiedBriefing(false), 2500);
    } catch {
      setShowBriefingPreview(true);
    }
  };

  const handleRunAiDirectorOverview = async () => {
    if (!apiRequest) return;
    setAiOverviewLoading(true);
    setAiOverviewError(null);
    try {
      const res = await apiRequest(
        `commerce_dashboard.php?action=analyze_sop_director`,
        'POST',
        {
          mode: 'overview',
          shop_id: shopId,
          date: effectiveEnd,
          start_date: effectiveStart,
          end_date: effectiveEnd
        }
      );
      if (res && res.success) {
        setAiOverviewResult(res.data || res);
      } else {
        setAiOverviewError(res?.message || 'Không thể lấy đánh giá từ Giám đốc Marketing AI.');
      }
    } catch (err) {
      setAiOverviewError(err?.message || 'Lỗi kết nối Giám đốc Marketing AI.');
    } finally {
      setAiOverviewLoading(false);
    }
  };

  const handleOpenCampaignDetail = async (camp) => {
    setSelectedCampaign(camp);
    setCampaignDetailData(null);
    setCampaignDetailError(null);
    setAiCampResult(null);
    setAiCampError(null);
    if (!apiRequest) return;

    setCampaignDetailLoading(true);
    try {
      const actionName = camp.channel === 'LIVE' ? 'get_campaign_live_detail' : 'get_campaign_video_breakdown';
      const res = await apiRequest(
        `commerce_dashboard.php?action=${actionName}&shop_id=${encodeURIComponent(shopId)}&campaign_id=${encodeURIComponent(camp.campaign_id)}&date=${encodeURIComponent(selectedDate)}`
      );
      if (res && res.success && res.data) {
        setCampaignDetailData(res.data);
      } else {
        setCampaignDetailError(res?.message || 'Chưa tải được dữ liệu chi tiết chiến dịch.');
      }
    } catch (err) {
      setCampaignDetailError(err?.message || 'Không thể tải chi tiết chiến dịch.');
    } finally {
      setCampaignDetailLoading(false);
    }
  };

  const handleRunAiCampaignAnalysis = async () => {
    if (!apiRequest || !selectedCampaign) return;
    setAiCampLoading(true);
    setAiCampError(null);
    try {
      const mode = selectedCampaign.channel === 'LIVE' ? 'live' : 'campaign_video';
      const res = await apiRequest(
        `commerce_dashboard.php?action=analyze_sop_director`,
        'POST',
        {
          mode,
          shop_id: shopId,
          campaign_id: selectedCampaign.campaign_id,
          date: selectedDate
        }
      );
      if (res && res.success) {
        setAiCampResult(res.data || res);
      } else {
        setAiCampError(res?.message || 'Không thể phân tích chiến dịch bằng AI.');
      }
    } catch (err) {
      setAiCampError(err?.message || 'Lỗi kết nối Giám đốc Marketing AI.');
    } finally {
      setAiCampLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
        <RefreshCw size={28} className="spin" style={{ color: '#2563eb', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>Đang tổng hợp dữ liệu mục tiêu & cảnh báo hằng ngày...</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Đối soát đơn hàng, chi tiêu quảng cáo, kênh Video và Livestream theo thời gian thực</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', color: '#991b1b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
          <AlertCircle size={18} />
          <span>Lỗi tải dữ liệu Bảng Theo Dõi Mục Tiêu</span>
        </div>
        <div style={{ fontSize: '13px', marginTop: '6px' }}>{error || 'Không có dữ liệu.'}</div>
        <button
          type="button"
          onClick={fetchPacing}
          style={{ marginTop: '12px', padding: '6px 14px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  const { config = {}, pacing = {}, alerts = [], campaigns = [], morning_briefing_text = '' } = data;
  const shop = pacing.total_shop || {};
  const video = pacing.video_channel || {};
  const live = pacing.live_channel || {};
  const mainSku = video.main_sku || {};
  const subSku = video.sub_sku || {};

  const activeCampaigns = campaigns.filter(
    (c) => c.is_active || Number(c.spend) > 0 || Number(c.ads_gmv) > 0 || String(c.operation_status || '').toUpperCase() === 'ENABLE'
  );
  const inactiveCampaignsCount = Math.max(0, campaigns.length - activeCampaigns.length);
  const displayedCampaigns = showInactiveCampaigns ? campaigns : activeCampaigns;

  const previewSpendCap =
    (Number(formState.target_roi) || 0) > 0
      ? (Number(formState.daily_gmv_target) || 0) / Number(formState.target_roi)
      : 0;

  const severityStyles = {
    RED: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', badgeBg: '#dc2626', Icon: AlertCircle },
    YELLOW: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badgeBg: '#d97706', Icon: AlertTriangle },
    GREEN: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badgeBg: '#16a34a', Icon: CheckCircle2 },
    INFO: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', badgeBg: '#2563eb', Icon: Info }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header Bar (2-Tier Clean Layout) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          background: '#ffffff',
          padding: '18px 22px',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} style={{ color: '#2563eb' }} />
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em' }}>
                Bảng Theo Dõi Mục Tiêu & Cảnh Báo Hằng Ngày
              </h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
              <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', color: '#334155' }}>
                Hoàn vốn cửa hàng: <strong>{config.target_roi}x</strong>
              </span>
              <span style={{ background: '#f5f3ff', padding: '2px 8px', borderRadius: '6px', color: '#6d28d9' }}>
                Video: <strong>{config.video_target_roi}x</strong>
              </span>
              <span style={{ background: '#fff1f2', padding: '2px 8px', borderRadius: '6px', color: '#be123c' }}>
                Livestream: <strong>{config.live_target_roi}x</strong>
              </span>
              <span style={{ background: '#eff6ff', padding: '2px 8px', borderRadius: '6px', color: '#1d4ed8' }}>
                Giới hạn chi/ngày: <strong>{formatVND(config.daily_spend_cap)}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSyncTikTok}
              disabled={syncingTikTok}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                background: '#0f766e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                opacity: syncingTikTok ? 0.7 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              <RefreshCw size={14} className={syncingTikTok ? 'spin' : ''} />
              <span>{syncingTikTok ? 'Đang đồng bộ...' : 'Đồng bộ số liệu TikTok'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyBriefing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                background: copiedBriefing ? '#16a34a' : '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {copiedBriefing ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedBriefing ? 'Đã sao chép!' : 'Báo cáo Sáng (09:30)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBriefingPreview((v) => !v)}
              style={{
                padding: '8px 11px',
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {showBriefingPreview ? 'Ẩn mẫu' : 'Xem mẫu'}
            </button>

            <button
              type="button"
              onClick={handleOpenSettings}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Sliders size={14} />
              <span>Cài đặt Mục tiêu</span>
            </button>
          </div>
        </div>

        {/* Row 2: Dedicated Time Range Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
              {[
                { id: 'single', label: '1 ngày' },
                { id: '7d', label: '7 ngày' },
                { id: 'mtd', label: 'Đầu tháng → nay' },
                { id: '30d', label: '30 ngày' },
                { id: 'custom', label: 'Khoảng ngày' }
              ].map((opt) => {
                const active = filterMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => applyQuickRange(opt.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: active ? '700' : '500',
                      background: active ? '#ffffff' : 'transparent',
                      color: active ? '#2563eb' : '#475569',
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {filterMode === 'single' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '5px 10px' }}>
                <Calendar size={14} style={{ color: '#475569' }} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setHasManualDate(true);
                    setSelectedDate(e.target.value);
                  }}
                  style={{ border: 'none', background: 'transparent', fontSize: '13px', color: '#0f172a', outline: 'none' }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '5px 10px' }}>
                <Calendar size={14} style={{ color: '#475569' }} />
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => {
                    setHasManualDate(true);
                    setFilterMode('custom');
                    setRangeStart(e.target.value);
                  }}
                  style={{ border: 'none', background: 'transparent', fontSize: '12px', color: '#0f172a', outline: 'none' }}
                />
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>→</span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => {
                    setHasManualDate(true);
                    setFilterMode('custom');
                    setRangeEnd(e.target.value);
                  }}
                  style={{ border: 'none', background: 'transparent', fontSize: '12px', color: '#0f172a', outline: 'none' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 10px' }}>
              Kỳ đang xem: <strong>{(data?.days_count || 1) > 1 ? `${data.days_count} ngày` : '1 ngày'}</strong>
            </span>

          <button
            type="button"
            onClick={fetchPacing}
            title="Làm mới dữ liệu"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              background: '#f8fafc',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
          </button>
          </div>
        </div>
      </div>

      {syncBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '12.5px',
            fontWeight: '600',
            background: syncBanner.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${syncBanner.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: syncBanner.type === 'success' ? '#166534' : '#991b1b'
          }}
        >
          <span>{syncBanner.text}</span>
          <button
            type="button"
            onClick={() => setSyncBanner(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {showBriefingPreview && (
        <div style={{ background: '#0f172a', color: '#e2e8f0', padding: '14px 18px', borderRadius: '12px', fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.55 }}>
          {morning_briefing_text}
        </div>
      )}

      {/* AI Marketing Director Report Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
          border: '1px solid #c7d2fe',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: '#4f46e5' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e1b4b' }}>
                Đánh giá & Cố vấn từ Giám đốc Marketing AI
              </div>
              <div style={{ fontSize: '12px', color: '#4338ca' }}>
                Chỉ rõ nguyên nhân chưa đạt mục tiêu và hướng dẫn từng bước cải thiện doanh số
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunAiDirectorOverview}
            disabled={aiOverviewLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              opacity: aiOverviewLoading ? 0.7 : 1
            }}
          >
            <Sparkles size={14} />
            <span>{aiOverviewLoading ? 'Đang phân tích dữ liệu...' : 'Nhờ Giám đốc Marketing AI đánh giá hôm nay'}</span>
          </button>
        </div>

        {aiOverviewError && (
          <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '12px' }}>
            {aiOverviewError}
          </div>
        )}

        {aiOverviewResult && (
          <div style={{ background: '#ffffff', border: '1px solid #e0e7ff', borderRadius: '10px', padding: '14px 16px' }}>
            {renderAiReportBlock(aiOverviewResult)}
          </div>
        )}
      </div>

      {/* Red / Yellow / Green Alert Engine */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alerts.map((al) => {
          const st = severityStyles[al.severity] || severityStyles.INFO;
          const IconComp = st.Icon;
          return (
            <div
              key={al.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 16px',
                background: st.bg,
                border: `1px solid ${st.border}`,
                borderRadius: '12px',
                color: st.text
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: '1 1 320px' }}>
                <IconComp size={18} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>{al.title}</div>
                  <div style={{ fontSize: '12px', marginTop: '3px', lineHeight: 1.45 }}>{al.message}</div>
                </div>
              </div>
              <span
                style={{
                  background: st.badgeBg,
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap'
                }}
              >
                {al.action_tag}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pacing Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        {/* Card 1: Total Shop Pacing */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>
              <ShoppingBag size={18} style={{ color: '#2563eb' }} />
              <span>{(data?.days_count || 1) > 1 ? `Toàn Cửa Hàng (${data.days_count} ngày)` : 'Toàn Cửa Hàng (Hôm nay)'}</span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', padding: '3px 9px', borderRadius: '999px', background: (shop.ads_roi || 0) >= (config.target_roi || 13) ? '#dcfce7' : '#fee2e2', color: (shop.ads_roi || 0) >= (config.target_roi || 13) ? '#15803d' : '#b91c1c' }}>
              Thu/chi: {shop.ads_roi !== null && shop.ads_roi !== undefined ? `${shop.ads_roi}x` : '—'} / {config.target_roi}x
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#475569', fontWeight: '600' }}>
                Doanh số thực ({shop.actual_orders || 0} đơn)
              </span>
              <span style={{ fontWeight: '700', color: '#2563eb', background: '#eff6ff', padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                {shop.gmv_pacing_pct || 0}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatVND(shop.actual_gmv)}</span>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>/ {formatVND(shop.target_gmv)}</span>
            </div>
            <ProgressBar pct={shop.gmv_pacing_pct} color="#2563eb" height={8} />
            {(shop.gross_gmv > 0 && shop.gross_gmv > shop.actual_gmv) && (
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Doanh số gộp: <strong>{formatVND(shop.gross_gmv)}</strong> • Hủy/hoàn: <strong style={{ color: '#dc2626' }}>-{formatVND(shop.loss_amount || 0)}</strong>
              </div>
            )}
            {(data?.days_count || 1) > 1 && (
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Trung bình/ngày: <strong>{formatVND(shop.avg_daily_gmv || 0)}</strong> (Mục tiêu/ngày: {formatVND(config.daily_gmv_target)})
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#475569', fontWeight: '600' }}>Tiền quảng cáo đã tiêu</span>
              <span style={{ fontWeight: '700', color: (shop.spend_pacing_pct || 0) > 100 ? '#dc2626' : '#0284c7', background: '#f0f9ff', padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                {shop.spend_pacing_pct || 0}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatVND(shop.actual_spend)}</span>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>/ Giới hạn {formatVND(shop.daily_spend_cap)}</span>
            </div>
            <ProgressBar pct={shop.spend_pacing_pct} color={(shop.spend_pacing_pct || 0) > 100 ? '#dc2626' : '#0ea5e9'} height={8} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#475569', fontWeight: '600' }}>Lũy kế đầu tháng ({shop.mtd_orders || 0} đơn)</span>
              <span style={{ fontWeight: '700', color: '#4f46e5', whiteSpace: 'nowrap' }}>{shop.monthly_gmv_pacing_pct || 0}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatVND(shop.mtd_gmv)}</span>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>/ {formatVND(shop.monthly_gmv_target)}</span>
            </div>
            <ProgressBar pct={shop.monthly_gmv_pacing_pct} color="#6366f1" height={7} />
          </div>
        </div>

        {/* Card 2: Video / Product & Affiliate (75%) */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>
              <Video size={18} style={{ color: '#7c3aed' }} />
              <span>Kênh Video & Tiếp thị ({video.split_pct ?? 75}%)</span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', padding: '3px 9px', borderRadius: '999px', background: (video.actual_roi || 0) >= (config.video_target_roi || 15) ? '#dcfce7' : '#fef3c7', color: (video.actual_roi || 0) >= (config.video_target_roi || 15) ? '#15803d' : '#b45309' }}>
              Thu/chi: {video.actual_roi !== null && video.actual_roi !== undefined ? `${video.actual_roi}x` : '—'} / {config.video_target_roi}x
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#475569', fontWeight: '600' }}>Doanh số thực từ Video (sau hủy/hoàn)</span>
              <span style={{ fontWeight: '700', color: '#7c3aed', background: '#f5f3ff', padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                {video.gmv_pacing_pct || 0}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatVND(video.actual_gmv)}</span>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>/ {formatVND(video.target_gmv)}</span>
            </div>
            <ProgressBar pct={video.gmv_pacing_pct} color="#7c3aed" height={8} />
            {(video.gross_gmv > 0 && video.gross_gmv > video.actual_gmv) && (
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Doanh số gộp: <strong>{formatVND(video.gross_gmv)}</strong> • Hủy/hoàn ({video.loss_rate_pct || 0}%): <strong style={{ color: '#dc2626' }}>-{formatVND(video.loss_amount || 0)}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#475569', fontWeight: '600' }}>Chi tiêu Video / Giới hạn chi</span>
              <span style={{ fontWeight: '700', color: '#9333ea', background: '#faf5ff', padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                {video.spend_pacing_pct || 0}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatVND(video.actual_spend)}</span>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>/ {formatVND(video.daily_spend_cap)}</span>
            </div>
            <ProgressBar pct={video.spend_pacing_pct} color="#a855f7" height={8} />
          </div>

          {/* 80% Main Product / 20% Secondary Product */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
              Tỷ trọng sản phẩm (Mục tiêu {mainSku.split_pct ?? 80}% Chính / {subSku.split_pct ?? 20}% Phụ)
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px', gap: '6px' }}>
                <span style={{ color: '#0f172a' }}>Chính: <strong>{mainSku.keyword || config.main_sku_keyword}</strong></span>
                <span style={{ fontWeight: '700', color: '#059669', whiteSpace: 'nowrap' }}>{mainSku.actual_share_pct || 0}% ({formatVND(mainSku.actual_gmv)})</span>
              </div>
              <ProgressBar pct={mainSku.gmv_pacing_pct} color="#10b981" height={6} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px', gap: '6px' }}>
                <span style={{ color: '#475569' }}>Sản phẩm phụ</span>
                <span style={{ fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>{subSku.actual_share_pct || 0}% ({formatVND(subSku.actual_gmv)})</span>
              </div>
              <ProgressBar pct={subSku.gmv_pacing_pct} color="#64748b" height={6} />
            </div>
          </div>
        </div>

        {/* Card 3: LIVE Channel (25%) */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>
              <Radio size={18} style={{ color: '#e11d48' }} />
              <span>Kênh Livestream ({live.split_pct ?? 25}%)</span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', padding: '3px 9px', borderRadius: '999px', background: (live.actual_roi || 0) >= (config.live_target_roi || 13) ? '#dcfce7' : '#fef3c7', color: (live.actual_roi || 0) >= (config.live_target_roi || 13) ? '#15803d' : '#b45309' }}>
              Thu/chi: {live.actual_roi !== null && live.actual_roi !== undefined ? `${live.actual_roi}x` : '—'} / {config.live_target_roi}x
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#475569', fontWeight: '600' }}>Doanh số thực Livestream (sau hủy/hoàn)</span>
              <span style={{ fontWeight: '700', color: '#e11d48', background: '#fff1f2', padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                {live.gmv_pacing_pct || 0}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatVND(live.actual_gmv)}</span>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>/ {formatVND(live.target_gmv)}</span>
            </div>
            <ProgressBar pct={live.gmv_pacing_pct} color="#e11d48" height={8} />
            {(live.gross_gmv > 0 && live.gross_gmv > live.actual_gmv) && (
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Doanh số gộp: <strong>{formatVND(live.gross_gmv)}</strong> • Hủy/hoàn ({live.loss_rate_pct || 0}%): <strong style={{ color: '#dc2626' }}>-{formatVND(live.loss_amount || 0)}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#475569', fontWeight: '600' }}>Chi tiêu Livestream / Giới hạn chi</span>
              <span style={{ fontWeight: '700', color: '#be123c', background: '#fff1f2', padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                {live.spend_pacing_pct || 0}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatVND(live.actual_spend)}</span>
              <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>/ {formatVND(live.daily_spend_cap)}</span>
            </div>
            <ProgressBar pct={live.spend_pacing_pct} color="#f43f5e" height={8} />
          </div>

          <div style={{ background: '#fff1f2', borderRadius: '10px', padding: '12px', border: '1px solid #ffe4e6', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#881337' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{(data?.days_count || 1) > 1 ? `Phiên Livestream (${data.days_count} ngày):` : 'Phiên Livestream hôm nay:'}</span>
              <strong style={{ whiteSpace: 'nowrap' }}>{live.sessions_today || 0} / {live.sessions_target || 2} phiên</strong>
            </div>
            <div style={{ fontSize: '11px', color: '#9f1239' }}>
              Mục tiêu doanh số mỗi phiên: <strong>{formatVND(live.per_session_gmv_target)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Breakdown Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 22px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
            <TrendingUp size={16} style={{ color: '#2563eb' }} />
            <span>
              {(data?.days_count || 1) > 1
                ? `Chiến dịch quảng cáo đang chạy (${data.days_count} ngày: ${effectiveStart} → ${effectiveEnd} • ${displayedCampaigns.length} chiến dịch)`
                : `Chiến dịch quảng cáo đang chạy ngày ${effectiveEnd} (${displayedCampaigns.length} chiến dịch)`}
            </span>
          </div>

          {inactiveCampaignsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowInactiveCampaigns((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {showInactiveCampaigns ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>
                {showInactiveCampaigns
                  ? `Ẩn bớt ${inactiveCampaignsCount} chiến dịch đang tắt / 0đ`
                  : `Hiện thêm ${inactiveCampaignsCount} chiến dịch đang tắt / 0đ`}
              </span>
            </button>
          )}
        </div>

        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
          Bấm vào từng dòng chiến dịch để xem chi tiết Kho Video hoặc 8 chỉ số ca Live và nhờ Giám đốc Marketing AI phân tích.
        </div>

        {displayedCampaigns.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#64748b', padding: '14px 0' }}>
            Không có chiến dịch nào đang chạy hoặc có chi tiêu trong ngày {selectedDate}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px 10px' }}>Chiến dịch</th>
                  <th style={{ padding: '8px 10px' }}>Kênh</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Đã chi</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Doanh số</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Đơn hàng</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Lượt bấm</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Hiệu quả thu/chi</th>
                </tr>
              </thead>
              <tbody>
                {displayedCampaigns.map((c) => (
                  <tr
                    key={c.campaign_id}
                    onClick={() => handleOpenCampaignDetail(c)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      opacity: c.is_active ? 1 : 0.65
                    }}
                    title="Bấm để xem chi tiết chiến dịch"
                  >
                    <td style={{ padding: '10px', fontWeight: '600', color: '#2563eb' }}>
                      {c.campaign_name}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: c.channel === 'LIVE' ? '#ffe4e6' : '#ede9fe',
                          color: c.channel === 'LIVE' ? '#be123c' : '#6d28d9'
                        }}
                      >
                        {c.channel === 'LIVE' ? 'Livestream' : 'Video & Sản phẩm'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND(c.spend)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND(c.ads_gmv)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{formatNumber(c.orders)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{formatNumber(c.clicks)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: (c.roi || 0) >= (config.target_roi || 13) ? '#16a34a' : '#dc2626' }}>
                      {c.roi !== null && c.roi !== undefined ? `${c.roi}x` : 'Chưa có'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Campaign Detail Modal */}
      {selectedCampaign && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '780px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '22px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: selectedCampaign.channel === 'LIVE' ? '#ffe4e6' : '#ede9fe',
                    color: selectedCampaign.channel === 'LIVE' ? '#be123c' : '#6d28d9'
                  }}
                >
                  {selectedCampaign.channel === 'LIVE' ? 'Chiến dịch Livestream' : 'Chiến dịch Video & Sản phẩm'}
                </span>
                <h3 style={{ margin: '6px 0 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  {selectedCampaign.campaign_name}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Đã chi: <strong>{formatVND(selectedCampaign.spend)}</strong> | Doanh số: <strong>{formatVND(selectedCampaign.ads_gmv)}</strong> | Đơn: <strong>{formatNumber(selectedCampaign.orders)}</strong> | Hiệu quả thu/chi: <strong>{selectedCampaign.roi !== null ? `${selectedCampaign.roi}x` : 'Chưa có'}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCampaign(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {campaignDetailLoading && (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#475569' }}>
                <RefreshCw size={20} className="spin" style={{ color: '#2563eb', margin: '0 auto 8px' }} />
                Đang tải chi tiết chiến dịch...
              </div>
            )}

            {campaignDetailError && (
              <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '12px' }}>
                {campaignDetailError}
              </div>
            )}

            {/* Video / Product Breakdown */}
            {!campaignDetailLoading && selectedCampaign.channel !== 'LIVE' && campaignDetailData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                  Phân loại Kho Video trong chiến dịch (Hiện có vs Cần đạt)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  {[
                    { label: 'Tổng số video', val: campaignDetailData.counts?.total_videos ?? 0, target: `Cần >= ${campaignDetailData.targets?.total_active_min ?? 50}` },
                    { label: 'Video nổi bật', val: campaignDetailData.counts?.outstanding ?? 0, target: `Cần >= ${campaignDetailData.targets?.outstanding_min ?? 5}` },
                    { label: 'Video có hiệu quả', val: campaignDetailData.counts?.effective ?? 0, target: `Cần >= ${campaignDetailData.targets?.effective_min ?? 15}` },
                    { label: 'Video đang khám phá', val: campaignDetailData.counts?.exploring ?? 0, target: `Cần >= ${campaignDetailData.targets?.exploring_min ?? 15}` },
                    { label: 'Video kém hiệu quả', val: campaignDetailData.counts?.ineffective ?? 0, target: 'Chi < 10% ngân sách' },
                    { label: 'Video không phân phối', val: campaignDetailData.counts?.not_delivering ?? 0, target: 'Cần thay mới' },
                    { label: 'Video vi phạm', val: campaignDetailData.counts?.violating ?? 0, target: 'Mục tiêu: 0 video' }
                  ].map((item) => (
                    <div key={item.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                      <div style={{ fontSize: '11px', color: '#475569' }}>{item.label}</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '2px 0' }}>{item.val}</div>
                      <div style={{ fontSize: '11px', color: '#2563eb' }}>{item.target}</div>
                    </div>
                  ))}
                </div>

                {Array.isArray(campaignDetailData.content_guidance) && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#166534', marginBottom: '6px' }}>
                      Gợi ý tối ưu nội dung để tăng chi tiêu & ra nhiều đơn:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#166534', lineHeight: 1.55 }}>
                      {campaignDetailData.content_guidance.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* LIVE 8 KPIs Breakdown */}
            {!campaignDetailLoading && selectedCampaign.channel === 'LIVE' && campaignDetailData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                  8 chỉ số theo dõi Ca Live (Ca 1, Ca 2 & Tổng ngày)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Chỉ số</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Ca 1 (Sáng/Trưa)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Ca 2 (Chiều/Tối)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Tổng ngày</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: '1. Lượt hiển thị', fmt: (s) => formatNumber(s?.impressions || 0) },
                        { label: '2. Tiền đã chi (% mốc 60%)', fmt: (s) => `${formatVND(s?.spend)} (${s?.spend_pct_of_cap || 0}%)` },
                        { label: '3. Giá 1.000 lượt hiển thị', fmt: (s) => s?.cpm !== null && s?.cpm !== undefined ? formatVND(s.cpm) : 'Chưa có' },
                        { label: '4. Tỷ lệ bấm vào Live', fmt: (s) => s?.live_ctr_pct !== null && s?.live_ctr_pct !== undefined ? `${s.live_ctr_pct}%` : 'Chưa có' },
                        { label: '5. Tỷ lệ bấm giỏ hàng', fmt: (s) => s?.cart_click_rate_pct !== null && s?.cart_click_rate_pct !== undefined ? `${s.cart_click_rate_pct}%` : 'Chưa có' },
                        { label: '6. Tỷ lệ chốt đơn', fmt: (s) => s?.order_cvr_pct !== null && s?.order_cvr_pct !== undefined ? `${s.order_cvr_pct}%` : 'Chưa có' },
                        { label: '7. Doanh số ca', fmt: (s) => formatVND(s?.gmv) },
                        { label: '8. Hiệu quả thu/chi', fmt: (s) => s?.roi !== null && s?.roi !== undefined ? `${s.roi}x` : 'Chưa có' }
                      ].map((row) => (
                        <tr key={row.label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', fontWeight: '600', color: '#334155' }}>{row.label}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{row.fmt(campaignDetailData.slots?.ca_1)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{row.fmt(campaignDetailData.slots?.ca_2)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>{row.fmt(campaignDetailData.slots?.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AI Campaign Analysis Button & Output */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e1b4b' }}>
                  Cố vấn chiến dịch từ Giám đốc Marketing AI
                </span>
                <button
                  type="button"
                  onClick={handleRunAiCampaignAnalysis}
                  disabled={aiCampLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    opacity: aiCampLoading ? 0.7 : 1
                  }}
                >
                  <Sparkles size={14} />
                  <span>{aiCampLoading ? 'Đang phân tích...' : 'Phân tích chiến dịch này bằng Giám đốc Marketing AI'}</span>
                </button>
              </div>

              {aiCampError && (
                <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '12px' }}>
                  {aiCampError}
                </div>
              )}

              {aiCampResult && (
                <div style={{ background: '#f8fafc', border: '1px solid #e0e7ff', borderRadius: '10px', padding: '12px 14px' }}>
                  {renderAiReportBlock(aiCampResult)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <form
            onSubmit={handleSaveSettings}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '22px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Cài đặt Mục tiêu Hoàn vốn & Ngân sách Hằng ngày
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {saveError && (
              <div style={{ padding: '10px 12px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Mục tiêu hoàn vốn toàn cửa hàng (mặc định 13.0)
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={formState.target_roi ?? 13.0}
                  onChange={(e) => handleFormChange('target_roi', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Mục tiêu hoàn vốn Video (mặc định 15.0)
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={formState.video_target_roi ?? 15.0}
                  onChange={(e) => handleFormChange('video_target_roi', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Mục tiêu hoàn vốn Livestream (mặc định 13.0)
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={formState.live_target_roi ?? 13.0}
                  onChange={(e) => handleFormChange('live_target_roi', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Mục tiêu Doanh số Tháng (VND)
                <input
                  type="number"
                  step="1000000"
                  min="0"
                  value={formState.monthly_gmv_target ?? 600000000}
                  onChange={(e) => handleFormChange('monthly_gmv_target', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Mục tiêu Doanh số Ngày (VND)
                <input
                  type="number"
                  step="500000"
                  min="0"
                  value={formState.daily_gmv_target ?? 20000000}
                  onChange={(e) => handleFormChange('daily_gmv_target', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '12px', color: '#1e40af' }}>
                <span>Giới hạn chi/ngày (Tự động tính):</span>
                <strong style={{ fontSize: '14px', marginTop: '2px' }}>{formatVND(previewSpendCap)}</strong>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Tỷ trọng Video & Tiếp thị liên kết (%)
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={formState.video_split_pct ?? 75}
                  onChange={(e) => handleFormChange('video_split_pct', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Tỷ trọng Livestream (%)
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={formState.live_split_pct ?? 25}
                  onChange={(e) => handleFormChange('live_split_pct', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Số phiên Livestream / ngày
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formState.live_sessions_per_day ?? 2}
                  onChange={(e) => handleFormChange('live_sessions_per_day', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Tỷ trọng Sản phẩm chính (%)
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={formState.main_sku_split_pct ?? 80}
                  onChange={(e) => handleFormChange('main_sku_split_pct', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Tỷ trọng Sản phẩm phụ (%)
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={formState.sub_sku_split_pct ?? 20}
                  onChange={(e) => handleFormChange('sub_sku_split_pct', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Từ khóa Sản phẩm chính
                <input
                  type="text"
                  value={formState.main_sku_keyword ?? 'Viên sủi mát gan'}
                  onChange={(e) => handleFormChange('main_sku_keyword', e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
              </label>
            </div>

            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                Ngưỡng Cảnh Báo (Đỏ / Vàng / Xanh)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#475569' }}>
                  Cảnh báo Đỏ: Hiệu quả &lt;
                  <input
                    type="number"
                    step="0.5"
                    value={formState.red_flag_roi_threshold ?? 10}
                    onChange={(e) => handleFormChange('red_flag_roi_threshold', e.target.value)}
                    style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#475569' }}>
                  Cảnh báo Đỏ: Lượt bấm &ge; (0 đơn)
                  <input
                    type="number"
                    min="1"
                    value={formState.red_flag_min_clicks ?? 50}
                    onChange={(e) => handleFormChange('red_flag_min_clicks', e.target.value)}
                    style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#475569' }}>
                  Cảnh báo Vàng: Sau giờ
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formState.yellow_flag_hour ?? 14}
                    onChange={(e) => handleFormChange('yellow_flag_hour', e.target.value)}
                    style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#475569' }}>
                  Tín hiệu Xanh: Vượt mục tiêu (+)
                  <input
                    type="number"
                    step="0.5"
                    value={formState.green_flag_roi_buffer ?? 2}
                    onChange={(e) => handleFormChange('green_flag_roi_buffer', e.target.value)}
                    style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                style={{ padding: '8px 16px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: savingConfig ? 0.7 : 1 }}
              >
                <Save size={14} />
                <span>{savingConfig ? 'Đang lưu...' : 'Lưu cài đặt'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
