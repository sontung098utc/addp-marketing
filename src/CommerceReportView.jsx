import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Package,
  ShoppingBag,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  BarChart2,
  Radio,
  Layers,
  FileText,
  XCircle,
  X
} from 'lucide-react';

export default function CommerceReportView({
  shopId = '7495657895504611503',
  realShopId = null,
  apiRequest,
  startDate: propStartDate,
  endDate: propEndDate,
  datePreset: propDatePreset,
  targetRoi: propTargetRoi,
  targetRoas: propTargetRoas,
  onDateChange,
  onTriggerSync
}) {
  // Date State (Defaults to Today)
  const todayDefaultStr = new Date().toISOString().slice(0, 10);
  const [datePreset, setDatePreset] = useState(propDatePreset || 'today');
  const [startDate, setStartDate] = useState(propStartDate || todayDefaultStr);
  const [endDate, setEndDate] = useState(propEndDate || todayDefaultStr);
  const [inputStartDate, setInputStartDate] = useState(propStartDate || todayDefaultStr);
  const [inputEndDate, setInputEndDate] = useState(propEndDate || todayDefaultStr);

  // Synchronize with external global date props if provided
  useEffect(() => {
    if (propStartDate && propStartDate !== startDate) {
      setStartDate(propStartDate);
      setInputStartDate(propStartDate);
    }
    if (propEndDate && propEndDate !== endDate) {
      setEndDate(propEndDate);
      setInputEndDate(propEndDate);
    }
    if (propDatePreset && propDatePreset !== datePreset) {
      setDatePreset(propDatePreset);
    }
  }, [propStartDate, propEndDate, propDatePreset]);

  // Report Data & Loading State
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showProvenance, setShowProvenance] = useState(false);

  // Format Helpers
  const formatCurrency = (val) => {
    if (val == null || isNaN(val)) return '—';
    return Math.round(Number(val)).toLocaleString('vi-VN');
  };

  const formatNumber = (val) => {
    if (val == null || isNaN(val)) return '—';
    return Number(val).toLocaleString('vi-VN');
  };

  const formatPercent = (val) => {
    if (val == null || isNaN(val)) return '—';
    return Number(val).toFixed(2).replace('.', ',') + '%';
  };

  const formatMultiplier = (val) => {
    if (val == null || isNaN(val)) return '—';
    return Number(val).toFixed(2).replace('.', ',') + 'x';
  };

  // Preset Date Handlers
  const handlePresetSelect = (presetKey) => {
    setDatePreset(presetKey);
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let sDate = formatDate(today);
    let eDate = formatDate(today);

    if (presetKey === 'today') {
      sDate = formatDate(today);
      eDate = formatDate(today);
    } else if (presetKey === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      sDate = formatDate(y);
      eDate = formatDate(y);
    } else if (presetKey === '7d') {
      const d7 = new Date(today);
      d7.setDate(d7.getDate() - 6);
      sDate = formatDate(d7);
      eDate = formatDate(today);
    } else if (presetKey === '30d') {
      const d30 = new Date(today);
      d30.setDate(d30.getDate() - 29);
      sDate = formatDate(d30);
      eDate = formatDate(today);
    } else if (presetKey === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      sDate = formatDate(firstDay);
      eDate = formatDate(today);
    } else if (presetKey === 'last_month') {
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      sDate = formatDate(firstDayLastMonth);
      eDate = formatDate(lastDayLastMonth);
    } else if (presetKey === 'hadaplus_benchmark') {
      sDate = '2026-09-01';
      eDate = '2026-09-20';
    }

    setStartDate(sDate);
    setEndDate(eDate);
    setInputStartDate(sDate);
    setInputEndDate(eDate);

    if (typeof onDateChange === 'function') {
      onDateChange(sDate, eDate, presetKey);
    }
  };

  const handleApplyCustom = () => {
    if (!inputStartDate || !inputEndDate) return;
    if (inputStartDate > inputEndDate) {
      alert('Ngày bắt đầu không được lớn hơn ngày kết thúc');
      return;
    }
    setDatePreset('custom');
    setStartDate(inputStartDate);
    setEndDate(inputEndDate);

    if (typeof onDateChange === 'function') {
      onDateChange(inputStartDate, inputEndDate, 'custom');
    }
  };

  // Fetch Report Data
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let res = null;
      if (typeof apiRequest === 'function') {
        try {
          res = await apiRequest(`commerce_report.php?shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`);
        } catch (e1) {
          // Fallback to router action
          res = await apiRequest(`commerce_dashboard.php?action=get_commerce_report&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`);
        }
      } else {
        const resp = await fetch(`/api/commerce_report.php?shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`);
        res = await resp.json();
      }

      if (res && (res.success || res.status === 'COMPLETE' || res.status === 'PARTIAL' || res.status === 'NOT_AVAILABLE')) {
        setReportData(res.data || res);
      } else {
        setError(res?.message || 'Không thể tải báo cáo kỳ');
      }
    } catch (err) {
      setError(err?.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Auto Sync State & Feedback (Sprint V2-04.2 Hotfix)
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncFeedback, setSyncFeedback] = useState(null);

  // Authoritative Auto Sync Execution (Sprint V2-04.3 Async Job Orchestration)
  const handleTriggerAutoSync = useCallback(async () => {
    // 1. Guard against concurrent executions (double-click prevention)
    if (isSyncing || isLoading) return;

    setIsSyncing(true);
    setSyncProgress({ percent: 0, domain: 'order' });
    setSyncFeedback(null);

    try {
      let syncRes = null;
      // 2. Call authenticated commerce_sync.php with selected date range
      if (typeof apiRequest === 'function') {
        try {
          syncRes = await apiRequest(
            `commerce_sync.php?action=trigger_sync&shop_id=${encodeURIComponent(shopId)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&domain=all`,
            'POST',
            {
              action: 'trigger_sync',
              shop_id: shopId,
              start_date: startDate,
              end_date: endDate,
              domain: 'all'
            }
          );
        } catch (e1) {
          syncRes = await apiRequest(
            `commerce_dashboard.php?action=trigger_sync&shop_id=${encodeURIComponent(shopId)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&domain=all`,
            'POST',
            {
              action: 'trigger_sync',
              shop_id: shopId,
              start_date: startDate,
              end_date: endDate,
              domain: 'all'
            }
          );
        }
      } else {
        const resp = await fetch(
          `/api/commerce_sync.php?action=trigger_sync&shop_id=${encodeURIComponent(shopId)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&domain=all`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'trigger_sync',
              shop_id: shopId,
              start_date: startDate,
              end_date: endDate,
              domain: 'all'
            })
          }
        );
        syncRes = await resp.json();
      }

      // If background sync job was returned, poll job status until terminal state
      let finalJobRes = syncRes;
      if (syncRes?.job_id && !['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(syncRes?.status)) {
        const jobId = syncRes.job_id;
        let pollCount = 0;
        const maxPolls = 60; // Up to ~90-120 seconds

        while (pollCount < maxPolls) {
          pollCount++;
          await new Promise(r => setTimeout(r, 1500));

          let pollRes = null;
          try {
            if (typeof apiRequest === 'function') {
              pollRes = await apiRequest(`commerce_sync.php?action=job_status&job_id=${encodeURIComponent(jobId)}&tick=1`, 'GET');
            } else {
              const pResp = await fetch(`/api/commerce_sync.php?action=job_status&job_id=${encodeURIComponent(jobId)}&tick=1`);
              pollRes = await pResp.json();
            }
          } catch (pe) {
            continue;
          }

          const jobData = pollRes?.data || pollRes || {};
          const jStatus = jobData.status || pollRes?.status;
          const jProg = jobData.progress_percent ?? pollRes?.progress_percent ?? 0;
          const jDomain = jobData.current_domain ?? pollRes?.current_domain ?? '';

          setSyncProgress({
            percent: Math.min(100, Math.max(0, Number(jProg))),
            domain: jDomain
          });

          if (jobData.is_terminal || ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(jStatus)) {
            finalJobRes = {
              ...jobData,
              success: ['COMPLETED', 'PARTIAL'].includes(jStatus),
              status: jStatus,
              orders_status: jobData.orders_status || (jStatus === 'COMPLETED' ? 'COMPLETED' : 'PARTIAL'),
              domains: jobData.domains || {},
              message: jobData.error_message || pollRes?.message
            };
            break;
          }
        }
      }

      // If prop onTriggerSync callback was provided, notify it
      if (typeof onTriggerSync === 'function') {
        try { await onTriggerSync(finalJobRes); } catch (e) {}
      }

      // 3. Evaluate synchronization result based on Orders primacy
      const syncStatus = finalJobRes?.status || (finalJobRes?.success ? 'COMPLETED' : 'ERROR');
      const ordersStatus = finalJobRes?.orders_status || finalJobRes?.data?.domains?.orders?.status || finalJobRes?.domains?.order?.status || syncStatus;
      const domains = finalJobRes?.domains || finalJobRes?.data?.domains || {};

      const isOrdersSuccess = ['COMPLETED', 'COMPLETE', 'AVAILABLE', 'SUCCESS'].includes(ordersStatus);
      const isOrdersPartial = ordersStatus === 'PARTIAL';
      const isOrdersDisabled = ordersStatus === 'DISABLED';
      const isOrdersError = ['ERROR', 'FAILED'].includes(ordersStatus);

      // Inspect optional domains for truthful summary
      const disabledOptional = [];
      Object.entries(domains).forEach(([dKey, dVal]) => {
        if (dKey === 'orders' || dKey === 'order') return;
        if (dVal?.status === 'DISABLED') disabledOptional.push(dKey.toUpperCase());
      });

      if (isOrdersDisabled) {
        setSyncFeedback({
          type: 'error',
          message: finalJobRes?.message || 'Tính năng đồng bộ đơn hàng đang bị tắt (FEATURE_ENABLE_COMMERCE_V2=false).'
        });
      } else if (isOrdersError) {
        setSyncFeedback({
          type: 'error',
          message: finalJobRes?.message || 'Đồng bộ thất bại: Đã xảy ra lỗi trong quá trình đồng bộ đơn hàng.'
        });
      } else if (isOrdersPartial) {
        setSyncFeedback({
          type: 'warning',
          message: finalJobRes?.message || 'Đồng bộ hoàn thành một phần. Vui lòng kiểm tra Độ phủ dữ liệu.'
        });
        // Refresh report so user sees partial facts & data quality updates
        await fetchReport();
      } else if (isOrdersSuccess) {
        let msg = finalJobRes?.message || 'Đồng bộ đơn hàng hoàn tất. Báo cáo đã được cập nhật.';
        if (disabledOptional.length > 0) {
          msg += ` (Miền tùy chọn đang tắt: ${disabledOptional.join(', ')})`;
        }
        setSyncFeedback({
          type: 'success',
          message: msg
        });
        // Sequence: await sync -> evaluate result -> refresh report
        await fetchReport();
      } else {
        setSyncFeedback({
          type: 'warning',
          message: finalJobRes?.message || `Đồng bộ hoàn tất với trạng thái: ${ordersStatus}`
        });
        await fetchReport();
      }
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        message: `Đồng bộ thất bại: ${err?.message?.replace(/(https?:\/\/[^\s]+|bearer\s+[a-z0-9_-]+)/gi, '[REDACTED]') || 'Lỗi không xác định'}`
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }, [shopId, startDate, endDate, apiRequest, isSyncing, isLoading, onTriggerSync, fetchReport]);

  // Derived Values
  const commerce = reportData?.commerce || {};
  const advertising = reportData?.advertising || {};
  const totalAds = advertising?.total || {};
  const productAds = advertising?.product_gmv_max || {};
  const liveAds = advertising?.live_gmv_max || {};
  const coverage = reportData?.coverage || {};
  const ordersCoverage = coverage.orders || {};
  const rmaCoverage = coverage.rma || {};
  const lossCoverage = coverage.loss || {};
  const realizedSalesCoverage = coverage.realized_sales || {};
  const analyticsCoverage = coverage.analytics || {};
  const adsCoverage = coverage.advertising || coverage.ads || {};
  const financeCoverage = coverage.finance || {};
  const overallStatus = coverage.overall_status || reportData?.status || 'UNKNOWN';
  const period = reportData?.period || {};
  const provenance = reportData?.provenance || {};
  const reportMeta = reportData?.report_meta || {};
  const domainMeta = reportMeta.domains || reportData?.domain_metadata || reportMeta.domain_metadata || coverage || {};
  const comparisonPeriods = reportMeta?.comparison_periods || {};
  const adsVsShopComp = comparisonPeriods?.ads_vs_shop || coverage?.comparison_period || advertising.ratios?.comparison_period || null;
  const reportSource = reportMeta.report_source || provenance.report_source || (reportMeta.is_daily_aggregated ? 'DAILY_AGGREGATES' : 'DATABASE_NORMALIZED');
  const isDailyAggregatesSource = reportSource === 'DAILY_AGGREGATES';
  const isT0Provisional = reportSource === 'T0_PROVISIONAL' || Boolean(reportMeta.is_provisional || provenance.is_provisional);
  const isDatabaseNormalized = reportSource === 'DATABASE_NORMALIZED';
  const isMissingPeriod = reportSource === 'MISSING_PERIOD';
  const freshnessTimestamps = reportMeta.freshness_timestamps || provenance.freshness_timestamps || {};
  const isPeriodAligned = Boolean(adsVsShopComp?.is_aligned ?? advertising?.ratios?.is_aligned ?? false);

  // V2-06.2: Loss-Adjusted Realized ROI & Erosion Metrics
  const lossAdjustedRoi = totalAds?.loss_adjusted_roi || advertising?.loss_adjusted_roi || {};
  const blendedShopRoas = totalAds?.blended_shop_roas ?? lossAdjustedRoi.blended_shop_roas ?? null;
  const realizedAdsRoi = totalAds?.realized_ads_roi ?? lossAdjustedRoi.realized_ads_roi ?? null;
  const roiErosionPoints = totalAds?.roi_erosion_points ?? lossAdjustedRoi.roi_erosion_points ?? null;
  const spendToRealizedRate = totalAds?.spend_to_realized_rate_pct ?? lossAdjustedRoi.spend_to_realized_rate_pct ?? null;

  const isAdsComplete = adsCoverage.status === 'COMPLETE';
  const isAdsPartial = adsCoverage.status === 'PARTIAL';
  const isOrdersComplete = ordersCoverage.status === 'COMPLETE';
  const isOrdersUnknown = ordersCoverage.status === 'UNKNOWN';
  const isOrdersPartial = ordersCoverage.status === 'PARTIAL';
  const isComplete = overallStatus === 'COMPLETE';
  const isNotAvailable = overallStatus === 'NOT_AVAILABLE';

  // Realized Sales Trust Rule (V2-04.2 Final Correction)
  // Realized Sales = green ONLY when trust_verified = true.
  // If trust_verified = false: Realized Sales must NOT visually imply verified/healthy status.
  // Use neutral/amber trust styling and show its UNKNOWN/PARTIAL status.
  const isRealizedSalesVerified = commerce.realized_sales_trust_verified === true || realizedSalesCoverage.trust_verified === true;
  const realizedSalesStatus = commerce.realized_sales_status ?? realizedSalesCoverage.status ?? 'UNKNOWN';

  const realizedVisual = useMemo(() => {
    if (isRealizedSalesVerified) {
      return {
        color: '#047857',      // Emerald/Green
        borderTop: '#16a34a',  // Green
        rateColor: '#16a34a',
        badgeBg: '#dcfce7',
        badgeColor: '#15803d',
        badgeBorder: '#bbf7d0',
        badgeText: '● ĐÃ ĐỐI SOÁT (VERIFIED)',
        barColor: '#16a34a'
      };
    }
    if (realizedSalesStatus === 'PARTIAL') {
      return {
        color: '#b45309',      // Amber
        borderTop: '#f59e0b',  // Amber
        rateColor: '#b45309',
        badgeBg: '#fef3c7',
        badgeColor: '#b45309',
        badgeBorder: '#fde68a',
        badgeText: '● DỮ LIỆU MỘT PHẦN (PARTIAL - CHƯA CHỐT)',
        barColor: '#f59e0b'
      };
    }
    // UNKNOWN or NOT_AVAILABLE or unverified default: slate neutral
    return {
      color: '#475569',      // Slate neutral
      borderTop: '#64748b',  // Slate neutral
      rateColor: '#64748b',
      badgeBg: '#f1f5f9',
      badgeColor: '#475569',
      badgeBorder: '#cbd5e1',
      badgeText: '● CHƯA ĐỐI SOÁT XONG (UNKNOWN)',
      barColor: '#94a3b8'
    };
  }, [isRealizedSalesVerified, realizedSalesStatus]);

  // ROI Semantic Visual Calculation (V2-04.2 Final Correction)
  // 1. If verified break-even ROI / target ROI exists: evaluate relative to that configured threshold
  // 2. If no verified threshold exists: display prominently with neutral/primary styling,
  //    do NOT classify it as good / warning / bad.
  const verifiedTargetRoi = useMemo(() => {
    const raw = propTargetRoi ?? propTargetRoas ?? totalAds.target_roi ?? advertising.target_roi ?? advertising.target_roas ?? advertising.break_even_roi ?? null;
    if (raw == null || raw === '' || isNaN(raw)) return null;
    const num = Number(raw);
    return num > 0 ? num : null;
  }, [propTargetRoi, propTargetRoas, totalAds.target_roi, advertising.target_roi, advertising.target_roas, advertising.break_even_roi]);

  const getRoiVisual = useCallback((roiVal) => {
    if (roiVal == null || isNaN(roiVal)) {
      return {
        color: '#64748b',
        borderTop: '#94a3b8',
        badgeBg: '#f1f5f9',
        badgeColor: '#64748b',
        badgeBorder: '#cbd5e1',
        label: null
      };
    }
    const numRoi = Number(roiVal);

    if (verifiedTargetRoi !== null) {
      if (numRoi >= verifiedTargetRoi) {
        return {
          color: '#15803d',     // Green
          borderTop: '#16a34a', // Green
          badgeBg: '#dcfce7',
          badgeColor: '#15803d',
          badgeBorder: '#bbf7d0',
          label: `ĐẠT MỤC TIÊU (≥ ${verifiedTargetRoi}x)`
        };
      } else if (numRoi >= verifiedTargetRoi * 0.8) {
        return {
          color: '#b45309',     // Amber
          borderTop: '#f59e0b', // Amber
          badgeBg: '#fef3c7',
          badgeColor: '#b45309',
          badgeBorder: '#fde68a',
          label: `TIỆM CẬN MỤC TIÊU (< ${verifiedTargetRoi}x)`
        };
      } else {
        return {
          color: '#b91c1c',     // Red
          borderTop: '#dc2626', // Red
          badgeBg: '#fee2e2',
          badgeColor: '#b91c1c',
          badgeBorder: '#fecaca',
          label: `DƯỚI MỤC TIÊU (< ${verifiedTargetRoi}x)`
        };
      }
    }

    // No verified business threshold configured: prominent neutral dark text, slate neutral border, no classification
    return {
      color: '#0f172a',      // Slate-900 / dark neutral (prominent)
      borderTop: '#64748b',  // Slate-500 neutral border
      badgeBg: '#f8fafc',
      badgeColor: '#64748b',
      badgeBorder: '#e2e8f0',
      label: null
    };
  }, [verifiedTargetRoi]);

  const totalRoiVisual = useMemo(() => getRoiVisual(totalAds.roi), [getRoiVisual, totalAds.roi]);

  return (
    <div className="commerce-report-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ========================================================
          COMPACT PAGE HEADER & DATE CONTROLS (SPRINT V2-04)
          ======================================================== */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '12px 18px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {/* Row 1: Title, Subtitle, Compact Sync Badge, and Action */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              background: '#2563eb',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <ShoppingBag size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '21px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
                  Báo cáo TikTok Shop
                </h1>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Theo dõi kinh doanh & quảng cáo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b', marginTop: '2px', flexWrap: 'wrap' }}>
                <span>Dữ liệu Shop: đến <strong>{domainMeta?.orders?.latest_available_date || ordersCoverage.latest_available_date || period.end_date || '...'}</strong></span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>Dữ liệu Ads: đến <strong>{domainMeta?.ads?.latest_available_date || adsCoverage.latest_available_date || '...'}</strong></span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                {isDailyAggregatesSource && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '1px 7px',
                    borderRadius: '4px',
                    background: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    ✅ NGUỒN: TỔNG HỢP NGÀY (DATABASE)
                  </span>
                )}
                {isT0Provisional && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '1px 7px',
                    borderRadius: '4px',
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }} title={reportMeta.provisional_notice || 'Dữ liệu tạm tính hôm nay từ các đơn hàng đã ghi nhận'}>
                    ⚡ NGUỒN: TẠM TÍNH HÔM NAY (T-0)
                  </span>
                )}
                {isDatabaseNormalized && !isT0Provisional && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '1px 7px',
                    borderRadius: '4px',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    ✅ NGUỒN: DATABASE NỘI BỘ
                  </span>
                )}
                {isMissingPeriod && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '1px 7px',
                    borderRadius: '4px',
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    ⚠️ CHƯA ĐỦ DỮ LIỆU KỲ
                  </span>
                )}
                {freshnessTimestamps.orders_latest_at && (
                  <>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      Cập nhật: {freshnessTimestamps.orders_latest_at}
                    </span>
                  </>
                )}
                {!isPeriodAligned && adsVsShopComp?.has_overlap && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe'
                  }} title={adsVsShopComp.reason}>
                    Kỳ so sánh khả dụng: {adsVsShopComp.start_date} → {adsVsShopComp.end_date}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            {/* Compact Sync Status Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              background: isComplete ? '#dcfce7' : (isAdsComplete ? '#eff6ff' : (isAdsPartial || isOrdersPartial ? '#fef3c7' : '#fee2e2')),
              color: isComplete ? '#15803d' : (isAdsComplete ? '#1d4ed8' : (isAdsPartial || isOrdersPartial ? '#b45309' : '#b91c1c')),
              border: `1px solid ${isComplete ? '#bbf7d0' : (isAdsComplete ? '#bfdbfe' : (isAdsPartial || isOrdersPartial ? '#fde68a' : '#fecaca'))}`
            }}>
              <span style={{ fontSize: '9px' }}>●</span>
              <span>
                {isSyncing
                  ? `Đang tiến hành đồng bộ (${syncProgress?.percent != null ? Math.round(syncProgress.percent) : 0}%)...`
                  : (isComplete
                      ? `Dữ liệu đầy đủ (COMPLETE ${period.days ?? 0}/${period.days ?? 0} ngày)`
                      : (isAdsComplete
                          ? `Dữ liệu quảng cáo đầy đủ: ${adsCoverage.available_days}/${adsCoverage.requested_days} ngày (100%)${isOrdersUnknown ? ' • Đơn hàng: UNKNOWN' : ''}`
                          : (isAdsPartial
                              ? `Quảng cáo một phần: ${adsCoverage.available_days}/${adsCoverage.requested_days} ngày (${adsCoverage.coverage_pct}%)`
                              : (isNotAvailable ? 'Chưa có dữ liệu' : `Trạng thái: ${overallStatus}`))))}
              </span>
            </div>

            {/* Sync & Refresh Action Button */}
            <button
              type="button"
              onClick={handleTriggerAutoSync}
              disabled={isSyncing || isLoading}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '6px',
                background: isSyncing ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${isSyncing ? '#bfdbfe' : '#cbd5e1'}`,
                color: isSyncing ? '#2563eb' : '#334155',
                cursor: (isSyncing || isLoading) ? 'not-allowed' : 'pointer'
              }}
              title="Đồng bộ tự động theo kỳ chọn & Cập nhật số liệu"
            >
              <RefreshCw size={12} className={(isSyncing || isLoading) ? 'spin' : ''} />
              <span>{isSyncing ? 'Đang đồng bộ...' : (isLoading ? 'Đang nạp...' : '↻ Đồng bộ')}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Date Preset Bar & Custom Range Picker */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          borderTop: '1px solid #f1f5f9',
          paddingTop: '8px'
        }}>
          {/* Presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => handlePresetSelect('today')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: datePreset === 'today' ? '700' : '500',
                background: datePreset === 'today' ? '#eff6ff' : '#f8fafc',
                color: datePreset === 'today' ? '#2563eb' : '#475569',
                border: `1px solid ${datePreset === 'today' ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer'
              }}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('yesterday')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: datePreset === 'yesterday' ? '700' : '500',
                background: datePreset === 'yesterday' ? '#eff6ff' : '#f8fafc',
                color: datePreset === 'yesterday' ? '#2563eb' : '#475569',
                border: `1px solid ${datePreset === 'yesterday' ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer'
              }}
            >
              Hôm qua
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('7d')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: datePreset === '7d' ? '700' : '500',
                background: datePreset === '7d' ? '#eff6ff' : '#f8fafc',
                color: datePreset === '7d' ? '#2563eb' : '#475569',
                border: `1px solid ${datePreset === '7d' ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer'
              }}
            >
              7 ngày
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('30d')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: datePreset === '30d' ? '700' : '500',
                background: datePreset === '30d' ? '#eff6ff' : '#f8fafc',
                color: datePreset === '30d' ? '#2563eb' : '#475569',
                border: `1px solid ${datePreset === '30d' ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer'
              }}
            >
              30 ngày
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('this_month')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: datePreset === 'this_month' ? '700' : '500',
                background: datePreset === 'this_month' ? '#eff6ff' : '#f8fafc',
                color: datePreset === 'this_month' ? '#2563eb' : '#475569',
                border: `1px solid ${datePreset === 'this_month' ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer'
              }}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('last_month')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: datePreset === 'last_month' ? '700' : '500',
                background: datePreset === 'last_month' ? '#eff6ff' : '#f8fafc',
                color: datePreset === 'last_month' ? '#2563eb' : '#475569',
                border: `1px solid ${datePreset === 'last_month' ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer'
              }}
            >
              Tháng trước
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('hadaplus_benchmark')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: datePreset === 'hadaplus_benchmark' ? '700' : '500',
                background: datePreset === 'hadaplus_benchmark' ? '#eff6ff' : '#f8fafc',
                color: datePreset === 'hadaplus_benchmark' ? '#2563eb' : '#475569',
                border: `1px solid ${datePreset === 'hadaplus_benchmark' ? '#bfdbfe' : '#e2e8f0'}`,
                cursor: 'pointer'
              }}
            >
              Hadaplus Benchmark
            </button>
            {/* End of preset buttons */}
          </div>

          {/* Custom Date Range Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '3px 8px'
            }}>
              <Calendar size={13} color="#64748b" />
              <input
                type="date"
                value={inputStartDate}
                onChange={(e) => setInputStartDate(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '11px',
                  color: '#0f172a',
                  fontWeight: '500',
                  outline: 'none'
                }}
              />
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>→</span>
              <input
                type="date"
                value={inputEndDate}
                onChange={(e) => setInputEndDate(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '11px',
                  color: '#0f172a',
                  fontWeight: '500',
                  outline: 'none'
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="btn-primary"
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '6px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Áp dụng
            </button>
          </div>
        </div>

        {/* Sync Result Feedback Banner (Sprint V2-04.2 Hotfix) */}
        {syncFeedback && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500',
            borderTop: '1px solid #f1f5f9',
            marginTop: '2px',
            background: syncFeedback.type === 'success' ? '#f0fdf4' : (syncFeedback.type === 'warning' ? '#fffbeb' : '#fef2f2'),
            border: `1px solid ${syncFeedback.type === 'success' ? '#bbf7d0' : (syncFeedback.type === 'warning' ? '#fde68a' : '#fecaca')}`,
            color: syncFeedback.type === 'success' ? '#15803d' : (syncFeedback.type === 'warning' ? '#b45309' : '#b91c1c')
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {syncFeedback.type === 'success' && <CheckCircle size={15} color="#16a34a" />}
              {syncFeedback.type === 'warning' && <AlertTriangle size={15} color="#d97706" />}
              {syncFeedback.type === 'error' && <XCircle size={15} color="#dc2626" />}
              <span>{syncFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncFeedback(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Đóng thông báo"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Actionable Warning / Coverage Latency Banners Only */}
      {isAdsPartial && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: '#92400e' }}>
            <strong>Quảng cáo một phần:</strong> Dữ liệu quảng cáo mới có {adsCoverage.available_days ?? 0}/{adsCoverage.requested_days ?? 0} ngày ({adsCoverage.coverage_pct ?? 0}%). Các chỉ số phản ánh dữ liệu đã đồng bộ.
            {adsCoverage.coverage_note && <span style={{ display: 'block', color: '#b45309', marginTop: '2px' }}>{adsCoverage.coverage_note}</span>}
          </div>
        </div>
      )}

      {isOrdersPartial && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: '#92400e' }}>
            <strong>Đơn hàng một phần:</strong> Dữ liệu đơn hàng chỉ đồng bộ một phần ({ordersCoverage.available_days ?? 0}/{ordersCoverage.requested_days ?? 0} ngày).
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '14px 18px',
          color: '#b91c1c',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================
          SECTION 1: TỔNG QUAN KINH DOANH SHOP
          ======================================================== */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            I. Tổng quan Kinh Doanh Shop
          </h2>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            (Phát sinh từ đơn hàng thực tế trong kỳ)
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '14px'
        }}>
          {/* Card 1: Doanh số */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '3px solid #2563eb',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                DOANH SỐ
              </span>
              <div className="tooltip-container">
                <Info size={14} color="#94a3b8" />
                <div className="tooltip">
                  Tổng giá trị đơn hàng phát sinh trong kỳ (Order Gross Value)
                </div>
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#1e40af', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {formatCurrency(commerce.gross_sales)}đ
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Tổng số đơn: <strong style={{ color: '#0f172a' }}>{formatNumber(commerce.total_orders)}</strong> đơn
            </div>
            {ordersCoverage?.status && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '4px',
                marginTop: '6px',
                background: ordersCoverage.status === 'COMPLETE' ? '#dcfce7' : (ordersCoverage.status === 'PARTIAL' ? '#fef3c7' : '#f1f5f9'),
                color: ordersCoverage.status === 'COMPLETE' ? '#15803d' : (ordersCoverage.status === 'PARTIAL' ? '#b45309' : '#475569'),
                border: `1px solid ${ordersCoverage.status === 'COMPLETE' ? '#bbf7d0' : (ordersCoverage.status === 'PARTIAL' ? '#fde68a' : '#e2e8f0')}`
              }}>
                ● {ordersCoverage.status === 'COMPLETE' ? 'ĐẦY ĐỦ (COMPLETE)' : (ordersCoverage.status === 'PARTIAL' ? `MỘT PHẦN (${ordersCoverage.available_days ?? 0}/${ordersCoverage.requested_days ?? 0}d)` : 'CHƯA RÕ (UNKNOWN)')}
              </div>
            )}
          </div>

          {/* Card 2: Doanh số thực */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: `3px solid ${realizedVisual.borderTop}`,
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                DOANH SỐ THỰC
              </span>
              <div className="tooltip-container">
                <Info size={14} color="#94a3b8" />
                <div className="tooltip">
                  Doanh số còn lại sau hủy và hoàn (Gross Sales - Loss). Chỉ được chứng nhận xanh khi dữ liệu đơn hàng và đối soát hao hụt đầy đủ 100%.
                </div>
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: realizedVisual.color, letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {formatCurrency(commerce.realized_sales)}đ
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Tỷ lệ thực nhận: <strong style={{ color: realizedVisual.rateColor }}>{formatPercent(commerce.realized_rate)}</strong>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '4px',
              marginTop: '6px',
              background: realizedVisual.badgeBg,
              color: realizedVisual.badgeColor,
              border: `1px solid ${realizedVisual.badgeBorder}`
            }}>
              {realizedVisual.badgeText}
            </div>
          </div>

          {/* Card 3: Hủy + Hoàn */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '3px solid #dc2626',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                HỦY + HOÀN
              </span>
              <div className="tooltip-container">
                <Info size={14} color="#94a3b8" />
                <div className="tooltip">
                  Tổng thất thoát do hủy đơn và hoàn tiền theo sổ cái hao hụt
                </div>
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#b91c1c', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {formatCurrency(commerce.loss_value)}đ
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Hủy: {formatCurrency(commerce.breakdown?.cancellation_value)}đ • Hoàn: {formatCurrency(commerce.breakdown?.refund_value)}đ
            </div>
            {commerce.breakdown?.orphan_rma_count > 0 && (
              <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '600', marginTop: '4px' }}>
                ⚠ Có {commerce.breakdown.orphan_rma_count} đơn hoàn chưa khớp đơn gốc
              </div>
            )}
          </div>

          {/* Card 4: Tỷ lệ Hủy + Hoàn */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '3px solid #d97706',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                TỶ LỆ HỦY + HOÀN
              </span>
              <div className="tooltip-container">
                <Info size={14} color="#94a3b8" />
                <div className="tooltip">
                  Tỷ lệ thất thoát = (Hủy + Hoàn) / Doanh số × 100
                </div>
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#c2410c', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {formatPercent(commerce.loss_rate)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Tác động đơn: {formatNumber((commerce.breakdown?.cancellation_orders ?? 0) + (commerce.breakdown?.refund_orders ?? 0))} đơn
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          SECTION 2: HIỆU QUẢ QUẢNG CÁO TỔNG THỂ
          ======================================================== */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            II. Hiệu Quả Quảng Cáo (GMV Max)
          </h2>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            (Nguồn: TikTok Ads)
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '14px'
        }}>
          {/* Card 1: Chi phí Ads */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '3px solid #f97316',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                CHI PHÍ ADS
              </span>
              <div className="tooltip-container">
                <Info size={14} color="#94a3b8" />
                <div className="tooltip">
                  Tổng chi phí GMV Max = Product Cost + LIVE Cost (không double count)
                </div>
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#c2410c', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {formatCurrency(totalAds.cost)}đ
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Số chiến dịch ghi nhận: <strong style={{ color: '#0f172a' }}>{formatNumber(totalAds.campaigns)}</strong> chiến dịch
            </div>
          </div>

          {/* Card 2: Ads attributed gross */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '3px solid #2563eb',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                ADS ATTRIBUTED GROSS
              </span>
              <div className="tooltip-container">
                <Info size={14} color="#94a3b8" />
                <div className="tooltip">
                  Doanh số được TikTok Ads ghi nhận/phân bổ cho quảng cáo trong khoảng thời gian đã chọn (Attributed Gross Revenue). Không đồng nhất với Doanh số Shop.
                </div>
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#1d4ed8', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {formatCurrency(totalAds.attributed_gross_revenue)}đ
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <span>Ads attributed gross / Doanh số Shop:</span>
              <strong style={{ color: '#0f172a' }}>{formatPercent(advertising.ratios?.ads_revenue_contribution_pct)}</strong>
              {!isPeriodAligned && adsVsShopComp?.has_overlap && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe'
                }}>
                  Cùng kỳ {adsVsShopComp.start_date ? `${adsVsShopComp.start_date.substring(8, 10)}/${adsVsShopComp.start_date.substring(5, 7)}` : ''}–{adsVsShopComp.end_date ? `${adsVsShopComp.end_date.substring(8, 10)}/${adsVsShopComp.end_date.substring(5, 7)}` : ''}
                </span>
              )}
              <div className="tooltip-container" style={{ display: 'inline-flex' }}>
                <Info size={13} color="#94a3b8" />
                <div className="tooltip">
                  {!isPeriodAligned && adsVsShopComp?.has_overlap
                    ? `Được so sánh trên cùng kỳ ${adsVsShopComp.start_date}–${adsVsShopComp.end_date} do ${adsVsShopComp.reason || 'dữ liệu TikTok Ads mới sẵn sàng đến ngày kết thúc này.'}`
                    : "Đây là tỷ lệ so sánh giữa doanh số quy Attribution của TikTok Ads và Doanh số đơn hàng Shop. Hai chỉ số có phương pháp ghi nhận khác nhau nên tỷ lệ có thể vượt 100% và không được hiểu là cơ cấu doanh thu."}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: ROI Ads */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: `3px solid ${totalRoiVisual.borderTop}`,
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                ROI ADS
              </span>
              <div className="tooltip-container">
                <Info size={14} color="#94a3b8" />
                <div className="tooltip">
                  ROI = Tổng Ads Gross Revenue / Tổng Ads Cost
                </div>
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: totalRoiVisual.color, letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {formatMultiplier(totalAds.roi)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <span>Chi phí / Doanh số:</span>
              <strong style={{ color: '#0f172a' }}>{formatPercent(advertising.ratios?.ads_spend_rate_pct)}</strong>
              {!isPeriodAligned && adsVsShopComp?.has_overlap && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe'
                }}>
                  Cùng kỳ {adsVsShopComp.start_date ? `${adsVsShopComp.start_date.substring(8, 10)}/${adsVsShopComp.start_date.substring(5, 7)}` : ''}–{adsVsShopComp.end_date ? `${adsVsShopComp.end_date.substring(8, 10)}/${adsVsShopComp.end_date.substring(5, 7)}` : ''}
                </span>
              )}
              <div className="tooltip-container" style={{ display: 'inline-flex' }}>
                <Info size={13} color="#94a3b8" />
                <div className="tooltip">
                  {!isPeriodAligned && adsVsShopComp?.has_overlap
                    ? `Chi phí quảng cáo so với Doanh số Shop được đối soát trên cùng kỳ ${adsVsShopComp.start_date}–${adsVsShopComp.end_date}.`
                    : "Tỷ lệ Chi phí Ads trên Doanh số đơn hàng Shop (Gross Sales)."}
                </div>
              </div>
            </div>
            {totalRoiVisual.label && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '4px',
                marginTop: '6px',
                background: totalRoiVisual.badgeBg,
                color: totalRoiVisual.badgeColor,
                border: `1px solid ${totalRoiVisual.badgeBorder}`
              }}>
                ● {totalRoiVisual.label}
              </div>
            )}
          </div>

          {/* Card 4: Đơn Ads */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '3px solid #0284c7',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                ĐƠN ADS
              </span>
              <div className="tooltip-container">
                <Info size={14} color="#94a3b8" />
                <div className="tooltip">
                  Tổng đơn hàng được TikTok Ads ghi nhận chuyển đổi
                </div>
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {formatNumber(totalAds.orders)} đơn
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              CPA TB: <strong style={{ color: '#0f172a' }}>{totalAds.cpa ? `${formatCurrency(totalAds.cpa)}đ/đơn` : '—'}</strong>
            </div>
          </div>
        </div>

        {/* V2-06.2: Loss-Adjusted ROI & Realized Efficiency */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 18px',
          marginTop: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color="#2563eb" />
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                Hiệu Quả Quảng Cáo Sau Hao Hụt (Loss-Adjusted ROI & Erosion)
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Công thức: Gross − Loss = Realized | Tính trên tổng kỳ (không lấy trung bình ngày)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {/* 1. ROAS Doanh Thu Gộp Toàn Shop */}
            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #0284c7' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                ROAS Doanh Thu Gộp Toàn Shop
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0284c7', marginTop: '4px' }}>
                {blendedShopRoas !== null ? formatMultiplier(blendedShopRoas) : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Tổng DT Gộp / Ads Cost
              </div>
            </div>

            {/* 2. ROI Doanh Thu Thực Nhận Toàn Shop */}
            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #16a34a' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                ROI Doanh Thu Thực Nhận Toàn Shop
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>
                {realizedAdsRoi !== null ? formatMultiplier(realizedAdsRoi) : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Tổng DT Thực Nhận / Ads Cost
              </div>
            </div>

            {/* 3. ROI Suy Giảm Do Hoàn Hủy */}
            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #dc2626' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                ROI Suy Giảm Do Hoàn Hủy
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', marginTop: '4px' }}>
                {roiErosionPoints !== null ? `-${formatMultiplier(roiErosionPoints)}` : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Tổng Hao Hụt / Ads Cost
              </div>
            </div>

            {/* 4. Tỷ Lệ Chi Phí Ads / DT Thực Nhận */}
            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #d97706' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                Tỷ Lệ Chi Phí Ads / DT Thực Nhận
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>
                {spendToRealizedRate !== null ? formatPercent(spendToRealizedRate) : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Ads Cost / DT Thực Nhận
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.5', background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px' }}>
            💡 <strong>Lưu ý nghiệp vụ:</strong> Chỉ số ROI doanh thu thực nhận toàn shop phản ánh tỷ suất thu hồi doanh số ròng sau trừ hao hụt trên mỗi đồng chi phí ads. Đây không phải là lợi nhuận ròng của shop hoặc ROI quy kết riêng cho từng chiến dịch sau hoàn hủy.
          </div>

          {roiErosionPoints !== null && roiErosionPoints >= 1.0 && isAdsComplete && (
            <div style={{
              marginTop: '10px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={15} color="#dc2626" />
              <span>
                <strong>Cảnh báo ROI Erosion:</strong> Tỷ lệ hủy/hoàn làm hao hụt <strong>-{formatMultiplier(roiErosionPoints)}</strong> điểm ROI so với ROAS gộp ban đầu ({formatMultiplier(blendedShopRoas)} → {formatMultiplier(realizedAdsRoi)}).
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          SECTION 3: PHÂN TÁCH QUẢNG CÁO (COMPARISON TABLE)
          ======================================================== */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              III. Phân Tách Quảng Cáo: Product GMV Max vs LIVE GMV Max
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Phân loại chuẩn hóa từ TikTok Marketing API (promotion_type: PRODUCT / LIVE)
            </p>
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 18px', fontWeight: '600', color: '#475569' }}>CHỈ SỐ QUẢNG CÁO</th>
                <th style={{ padding: '12px 18px', fontWeight: '600', color: '#0284c7' }}>GMV MAX (SẢN PHẨM)</th>
                <th style={{ padding: '12px 18px', fontWeight: '600', color: '#e11d48' }}>LIVE GMV MAX</th>
                <th style={{ padding: '12px 18px', fontWeight: '700', color: '#0f172a', background: '#f1f5f9' }}>TỔNG TOÀN KỲ</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '14px 18px', fontWeight: '600', color: '#1e293b' }}>Chi phí quảng cáo</td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  <strong>{formatCurrency(productAds.cost)}đ</strong>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                    ({formatPercent(productAds.cost_share_pct)})
                  </span>
                </td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  <strong>{formatCurrency(liveAds.cost)}đ</strong>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                    ({formatPercent(liveAds.cost_share_pct)})
                  </span>
                </td>
                <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0f172a', background: '#f8fafc' }}>
                  {formatCurrency(totalAds.cost)}đ
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '14px 18px', fontWeight: '600', color: '#1e293b' }}>Doanh số từ Ads (Attributed)</td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  <strong>{formatCurrency(productAds.attributed_gross_revenue)}đ</strong>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                    ({formatPercent(productAds.revenue_share_pct)})
                  </span>
                </td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  <strong>{formatCurrency(liveAds.attributed_gross_revenue)}đ</strong>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                    ({formatPercent(liveAds.revenue_share_pct)})
                  </span>
                </td>
                <td style={{ padding: '14px 18px', fontWeight: '700', color: '#7c3aed', background: '#f8fafc' }}>
                  {formatCurrency(totalAds.attributed_gross_revenue)}đ
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '14px 18px', fontWeight: '600', color: '#1e293b' }}>Đơn hàng từ Ads</td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  <strong>{formatNumber(productAds.orders)}</strong> đơn
                </td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  <strong>{formatNumber(liveAds.orders)}</strong> đơn
                </td>
                <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0f172a', background: '#f8fafc' }}>
                  {formatNumber(totalAds.orders)} đơn
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '14px 18px', fontWeight: '600', color: '#1e293b' }}>ROI quảng cáo</td>
                <td style={{ padding: '14px 18px', color: getRoiVisual(productAds.roi).color, fontWeight: '700' }}>
                  {formatMultiplier(productAds.roi)}
                </td>
                <td style={{ padding: '14px 18px', color: getRoiVisual(liveAds.roi).color, fontWeight: '700' }}>
                  {formatMultiplier(liveAds.roi)}
                </td>
                <td style={{ padding: '14px 18px', fontWeight: '800', color: totalRoiVisual.color, background: '#f8fafc' }}>
                  {formatMultiplier(totalAds.roi)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '14px 18px', fontWeight: '600', color: '#1e293b' }}>Chi phí / Đơn (CPA)</td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  {productAds.cpa ? `${formatCurrency(productAds.cpa)}đ` : '—'}
                </td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  {liveAds.cpa ? `${formatCurrency(liveAds.cpa)}đ` : '—'}
                </td>
                <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0f172a', background: '#f8fafc' }}>
                  {totalAds.cpa ? `${formatCurrency(totalAds.cpa)}đ` : '—'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '14px 18px', fontWeight: '600', color: '#1e293b' }}>Số chiến dịch ghi nhận</td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  <strong>{formatNumber(productAds.campaigns)}</strong> chiến dịch
                </td>
                <td style={{ padding: '14px 18px', color: '#0f172a' }}>
                  <strong>{formatNumber(liveAds.campaigns)}</strong> chiến dịch
                </td>
                <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0f172a', background: '#f8fafc' }}>
                  {formatNumber(totalAds.campaigns)} chiến dịch
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          SECTION 4 & 5: CƠ CẤU DOANH SỐ & CHI TIẾT HỦY HOÀN
          ======================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Section 4: Cơ cấu Doanh số */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 14px 0' }}>
            IV. Cơ Cấu Doanh Số & Phân Bổ Quảng Cáo
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Bar 1: Doanh số thực vs Hủy Hoàn */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: realizedVisual.color, fontWeight: '600' }}>
                  Doanh số thực ({formatPercent(commerce.realized_rate)})
                </span>
                <span style={{ color: '#dc2626', fontWeight: '600' }}>
                  Hủy + Hoàn ({formatPercent(commerce.loss_rate)})
                </span>
              </div>
              <div style={{ height: '10px', background: '#fee2e2', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                <div style={{
                  width: `${Math.min(100, Math.max(0, commerce.realized_rate ?? 0))}%`,
                  background: realizedVisual.barColor
                }}></div>
              </div>
            </div>

            {/* Bar 2: Phân bổ Chi phí Ads */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#0284c7', fontWeight: '600' }}>
                  Product GMV Max ({formatPercent(productAds.cost_share_pct)})
                </span>
                <span style={{ color: '#e11d48', fontWeight: '600' }}>
                  LIVE GMV Max ({formatPercent(liveAds.cost_share_pct)})
                </span>
              </div>
              <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                <div style={{
                  width: `${Math.min(100, Math.max(0, productAds.cost_share_pct ?? 0))}%`,
                  background: '#0284c7'
                }}></div>
                <div style={{
                  width: `${Math.min(100, Math.max(0, liveAds.cost_share_pct ?? 0))}%`,
                  background: '#e11d48'
                }}></div>
              </div>
            </div>

            {/* Bar 3: Phân bổ Doanh số Ads */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#0284c7', fontWeight: '600' }}>
                  Doanh số Product Ads ({formatPercent(productAds.revenue_share_pct)})
                </span>
                <span style={{ color: '#e11d48', fontWeight: '600' }}>
                  Doanh số LIVE Ads ({formatPercent(liveAds.revenue_share_pct)})
                </span>
              </div>
              <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                <div style={{
                  width: `${Math.min(100, Math.max(0, productAds.revenue_share_pct ?? 0))}%`,
                  background: '#0284c7'
                }}></div>
                <div style={{
                  width: `${Math.min(100, Math.max(0, liveAds.revenue_share_pct ?? 0))}%`,
                  background: '#e11d48'
                }}></div>
              </div>
            </div>

            {/* Note */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#64748b',
              marginTop: '4px'
            }}>
              <strong>Quy tắc đối soát:</strong> Doanh số quảng cáo (Attributed Gross Revenue) là số liệu phân bổ thuật toán của TikTok Ads. Doanh số Shop (Order Gross) là số tiền đơn hàng thực tế. Hai số liệu này không cộng gộp trực tiếp để tránh tính trùng lặp.
            </div>
          </div>
        </div>

        {/* Section 5: Chi tiết Hủy / Hoàn */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 14px 0' }}>
            V. Chi Tiết Thất Thoát (Hủy / Hoàn)
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Cancellation Box */}
            <div style={{
              border: '1px solid #fee2e2',
              background: '#fef2f2',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#991b1b' }}>
                  Hủy đơn hàng (Cancellations)
                </div>
                <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px' }}>
                  Số đơn bị hủy: <strong>{formatNumber(commerce.breakdown?.cancellation_orders)}</strong> đơn
                </div>
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#991b1b' }}>
                {formatCurrency(commerce.breakdown?.cancellation_value)}đ
              </div>
            </div>

            {/* Refund Box */}
            <div style={{
              border: '1px solid #ffedd5',
              background: '#fff7ed',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#9a3412' }}>
                  Hoàn hàng & Hoàn tiền (Returns / Refunds)
                </div>
                <div style={{ fontSize: '12px', color: '#c2410c', marginTop: '2px' }}>
                  Số đơn hoàn tiền: <strong>{formatNumber(commerce.breakdown?.refund_orders)}</strong> đơn
                </div>
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#9a3412' }}>
                {formatCurrency(commerce.breakdown?.refund_value)}đ
              </div>
            </div>

            {/* Factual Disclaimer */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#64748b'
            }}>
              <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px', color: '#16a34a' }} />
              Dữ liệu được hạch toán trực tiếp từ <strong>commerce_loss_ledger</strong> theo chuẩn <em>MATURED_LIFECYCLE</em>. Không suy diễn giao hàng không thành công (failed delivery) nếu chưa có dữ liệu chính thức.
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          SECTION 6: DATA QUALITY & TRUST (COVERAGE)
          ======================================================== */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              VI. Độ Phủ Dữ Liệu & Nguồn Gốc Báo Cáo (Data Quality & Trust)
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Kiểm toán tính trọn vẹn của từng nguồn dữ liệu trong khoảng thời gian {period.start_date} → {period.end_date}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowProvenance(!showProvenance)}
            style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{showProvenance ? 'Ẩn chi tiết nguồn' : 'Xem chi tiết nguồn'}</span>
            {showProvenance ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* V2-04.4 Period Alignment Summary */}
        <div style={{
          background: isPeriodAligned ? '#f0fdf4' : '#eff6ff',
          border: `1px solid ${isPeriodAligned ? '#bbf7d0' : '#bfdbfe'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: isPeriodAligned ? '#15803d' : '#1d4ed8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{isPeriodAligned ? '✓ Kỳ đối soát đồng nhất hoàn toàn (100% Aligned)' : 'ℹ Đối soát kỳ khả dụng chung giữa Shop & Ads'}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
              {isPeriodAligned ? (
                <span>Cả dữ liệu Đơn hàng Shop và TikTok Ads đều có đầy đủ dữ liệu trong kỳ {period.start_date} → {period.end_date}. Các chỉ số so sánh đạt độ tin cậy tuyệt đối.</span>
              ) : (
                <span>
                  Kỳ yêu cầu: <strong>{period.start_date} → {period.end_date}</strong>. 
                  {adsVsShopComp?.has_overlap ? (
                    <> Kỳ đối soát khả dụng chung: <strong>{adsVsShopComp.start_date} → {adsVsShopComp.end_date}</strong>. {adsVsShopComp.reason}</>
                  ) : (
                    <> {adsVsShopComp?.reason || 'Không có khoảng thời gian giao nhau khả dụng.'}</>
                  )}
                </span>
              )}
            </div>
          </div>
          {!isPeriodAligned && adsVsShopComp?.has_overlap && advertising.ratios?.aligned_metrics && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #bfdbfe',
              fontSize: '11px'
            }}>
              <div>
                <span style={{ color: '#64748b' }}>Doanh số Shop cùng kỳ:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{formatCurrency(advertising.ratios.aligned_metrics.shop_gross)}đ</strong>
              </div>
              <div style={{ color: '#cbd5e1' }}>|</div>
              <div>
                <span style={{ color: '#64748b' }}>Doanh số Ads cùng kỳ:</span>{' '}
                <strong style={{ color: '#1d4ed8' }}>{formatCurrency(advertising.ratios.aligned_metrics.ads_gross_revenue)}đ</strong>
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          {/* Domain Orders */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                DỮ LIỆU ĐƠN HÀNG
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                padding: '1px 5px',
                borderRadius: '4px',
                background: (domainMeta?.orders?.freshness_status === 'FRESH' || ordersCoverage.freshness_status === 'FRESH') ? '#dcfce7' : '#f1f5f9',
                color: (domainMeta?.orders?.freshness_status === 'FRESH' || ordersCoverage.freshness_status === 'FRESH') ? '#15803d' : '#64748b'
              }}>
                {domainMeta?.orders?.freshness_status || ordersCoverage.freshness_status || 'FRESH'}
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
              {ordersCoverage.status === 'COMPLETE' 
                ? `${ordersCoverage.available_days}/${ordersCoverage.requested_days} ngày` 
                : (ordersCoverage.status === 'UNKNOWN' 
                    ? `${ordersCoverage.days_with_orders ?? 0} ngày phát sinh đơn` 
                    : `${ordersCoverage.available_days ?? 0}/${ordersCoverage.requested_days ?? 0} ngày`)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Khả dụng đến: {domainMeta?.orders?.latest_available_date || ordersCoverage.latest_available_date || period.end_date || '...'}
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '1px 6px',
              borderRadius: '4px',
              background: ordersCoverage.status === 'COMPLETE' ? '#dcfce7' : (ordersCoverage.status === 'UNKNOWN' ? '#eff6ff' : '#fef3c7'),
              color: ordersCoverage.status === 'COMPLETE' ? '#15803d' : (ordersCoverage.status === 'UNKNOWN' ? '#1d4ed8' : '#b45309')
            }}>
              ● {ordersCoverage.status ?? 'UNKNOWN'} {ordersCoverage.coverage_pct != null ? `(${ordersCoverage.coverage_pct}%)` : ''}
            </div>
          </div>

          {/* Domain RMA / Returns */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                ĐỔI TRẢ & HOÀN TIỀN (RMA)
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                padding: '1px 5px',
                borderRadius: '4px',
                background: (domainMeta?.rma?.freshness_status === 'FRESH' || rmaCoverage.freshness_status === 'FRESH') ? '#dcfce7' : '#f1f5f9',
                color: (domainMeta?.rma?.freshness_status === 'FRESH' || rmaCoverage.freshness_status === 'FRESH') ? '#15803d' : '#64748b'
              }}>
                {domainMeta?.rma?.freshness_status || rmaCoverage.freshness_status || 'FRESH'}
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
              {rmaCoverage.orphan_rma_count > 0 
                ? `${rmaCoverage.orphan_rma_count} đơn thiếu gốc` 
                : (rmaCoverage.status === 'COMPLETE' ? 'Khớp đầy đủ' : (rmaCoverage.status || 'Chưa rõ'))}
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '1px 6px',
              borderRadius: '4px',
              background: rmaCoverage.status === 'COMPLETE' ? '#dcfce7' : (rmaCoverage.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2'),
              color: rmaCoverage.status === 'COMPLETE' ? '#15803d' : (rmaCoverage.status === 'PARTIAL' ? '#b45309' : '#b91c1c')
            }}>
              ● {rmaCoverage.status ?? 'UNKNOWN'}
            </div>
          </div>

          {/* Domain Loss / Reconciliation */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                SỔ CÁI HAO HỤT (LOSS)
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                padding: '1px 5px',
                borderRadius: '4px',
                background: (domainMeta?.loss?.freshness_status === 'FRESH' || lossCoverage.freshness_status === 'FRESH') ? '#dcfce7' : '#f1f5f9',
                color: (domainMeta?.loss?.freshness_status === 'FRESH' || lossCoverage.freshness_status === 'FRESH') ? '#15803d' : '#64748b'
              }}>
                {domainMeta?.loss?.freshness_status || lossCoverage.freshness_status || 'FRESH'}
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
              {lossCoverage.has_ledger_data ? 'Đã ghi nhận sổ cái' : 'Chưa có dữ liệu sổ cái'}
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '1px 6px',
              borderRadius: '4px',
              background: lossCoverage.status === 'COMPLETE' ? '#dcfce7' : (lossCoverage.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2'),
              color: lossCoverage.status === 'COMPLETE' ? '#15803d' : (lossCoverage.status === 'PARTIAL' ? '#b45309' : '#b91c1c')
            }}>
              ● {lossCoverage.status ?? 'UNKNOWN'}
            </div>
          </div>

          {/* Domain Ads */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                DỮ LIỆU QUẢNG CÁO
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                padding: '1px 5px',
                borderRadius: '4px',
                background: (domainMeta?.ads?.freshness_status === 'FRESH' || adsCoverage.freshness_status === 'FRESH') ? '#dcfce7' : ((domainMeta?.ads?.freshness_status === 'NOT_YET_AVAILABLE' || adsCoverage.freshness_status === 'NOT_YET_AVAILABLE') ? '#eff6ff' : '#fef3c7'),
                color: (domainMeta?.ads?.freshness_status === 'FRESH' || adsCoverage.freshness_status === 'FRESH') ? '#15803d' : ((domainMeta?.ads?.freshness_status === 'NOT_YET_AVAILABLE' || adsCoverage.freshness_status === 'NOT_YET_AVAILABLE') ? '#1d4ed8' : '#b45309')
              }}>
                {domainMeta?.ads?.freshness_status || adsCoverage.freshness_status || (isAdsPartial ? 'NOT_YET_AVAILABLE' : 'FRESH')}
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
              {adsCoverage.available_days ?? 0}/{adsCoverage.requested_days ?? 0} ngày
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Khả dụng đến: {domainMeta?.ads?.latest_available_date || adsCoverage.latest_available_date || '...'}
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '1px 6px',
              borderRadius: '4px',
              background: adsCoverage.status === 'COMPLETE' ? '#dcfce7' : (adsCoverage.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2'),
              color: adsCoverage.status === 'COMPLETE' ? '#15803d' : (adsCoverage.status === 'PARTIAL' ? '#b45309' : '#b91c1c')
            }}>
              ● {adsCoverage.status ?? 'UNKNOWN'} ({adsCoverage.coverage_pct ?? 0}%)
            </div>
          </div>

          {/* Domain Finance */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
              DỮ LIỆU TÀI CHÍNH
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
              Bảng kê quyết toán
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '1px 6px',
              borderRadius: '4px',
              background: coverage.finance?.status === 'AVAILABLE' ? '#dcfce7' : '#f1f5f9',
              color: coverage.finance?.status === 'AVAILABLE' ? '#15803d' : '#64748b'
            }}>
              ● {coverage.finance?.status ?? 'NOT_AVAILABLE'}
            </div>
          </div>

          {/* Domain Analytics */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
              CHỈ SỐ SHOP DAILY (ANALYTICS)
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
              Chỉ số la bàn (Compass)
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '1px 6px',
              borderRadius: '4px',
              background: analyticsCoverage.status === 'AVAILABLE' || analyticsCoverage.status === 'COMPLETE' ? '#dcfce7' : '#f1f5f9',
              color: analyticsCoverage.status === 'AVAILABLE' || analyticsCoverage.status === 'COMPLETE' ? '#15803d' : '#64748b'
            }}>
              ● {analyticsCoverage.status ?? 'AVAILABLE'}
            </div>
          </div>

          {/* Realized Sales Trust */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
              DOANH SỐ THỰC (TRUST)
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
              {realizedSalesCoverage.trust_verified ? 'Đã xác minh toàn vẹn' : 'Chưa hoàn tất xác minh'}
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '1px 6px',
              borderRadius: '4px',
              background: realizedSalesCoverage.status === 'COMPLETE' ? '#dcfce7' : (realizedSalesCoverage.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2'),
              color: realizedSalesCoverage.status === 'COMPLETE' ? '#15803d' : (realizedSalesCoverage.status === 'PARTIAL' ? '#b45309' : '#b91c1c')
            }}>
              ● {realizedSalesCoverage.status ?? commerce.realized_sales_status ?? 'UNKNOWN'}
            </div>
          </div>

          {/* Overall Period Status */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
              TRẠNG THÁI TOÀN KỲ
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
              {period.days ?? 0} ngày yêu cầu
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '11px',
              fontWeight: '600',
              padding: '1px 6px',
              borderRadius: '4px',
              background: isComplete ? '#dcfce7' : (overallStatus === 'UNKNOWN' ? '#eff6ff' : (overallStatus === 'PARTIAL' ? '#fef3c7' : '#fee2e2')),
              color: isComplete ? '#15803d' : (overallStatus === 'UNKNOWN' ? '#1d4ed8' : (overallStatus === 'PARTIAL' ? '#b45309' : '#b91c1c'))
            }}>
              ● {overallStatus}
            </div>
          </div>
        </div>

        {/* Collapsible Provenance Details */}
        {showProvenance && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '12px',
            color: '#475569',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div>• Bảng nguồn đơn hàng: <code>{provenance.source_orders ?? 'commerce_orders'}</code></div>
            <div>• Bảng nguồn thất thoát: <code>{provenance.source_loss ?? 'commerce_loss_ledger'}</code></div>
            <div>• Bảng nguồn quảng cáo: <code>{provenance.source_advertising ?? 'commerce_ads_campaign_daily'}</code> (Cấp grain: Campaign, không nhân bản Creative)</div>
            <div>• Thời điểm truy vấn cơ sở dữ liệu: <code>{provenance.query_timestamp ?? 'N/A'}</code></div>
          </div>
        )}
      </div>
    </div>
  );
}
