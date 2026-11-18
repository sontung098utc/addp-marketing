import React, { useState, useEffect, useCallback } from 'react';
import {
  Video,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  Users,
  Tag,
  ExternalLink
} from 'lucide-react';

export default function CommerceVideoProductView({
  shopId,
  startDate,
  endDate,
  apiRequest,
  formatVND = (v) => `${Number(v || 0).toLocaleString('vi-VN')} ₫`,
  formatNumber = (v) => Number(v || 0).toLocaleString('vi-VN')
}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Configurable Target ROI
  const [targetRoiInput, setTargetRoiInput] = useState(15.0);

  // Filters
  const [selectedProductId, setSelectedProductId] = useState('ALL');
  const [decisionFilter, setDecisionFilter] = useState('ALL'); // ALL | KEEP | TEST | DROP
  const [creatorFilter, setCreatorFilter] = useState('ALL'); // ALL | AFFILIATE | SHOP_ADS
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProducts, setExpandedProducts] = useState({});
  const [showAllDailyRows, setShowAllDailyRows] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState(null);

  // AI Director state
  const [aiReport, setAiReport] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const fetchIntelligence = useCallback(async (overrideRoi = null) => {
    if (!shopId) return;
    setIsLoading(true);
    setError(null);
    try {
      const roiParam = overrideRoi !== null ? overrideRoi : targetRoiInput;
      const qs = [
        `action=get_video_product_intelligence`,
        `shop_id=${encodeURIComponent(shopId)}`,
        `start_date=${encodeURIComponent(startDate || '')}`,
        `end_date=${encodeURIComponent(endDate || '')}`,
        roiParam && Number(roiParam) > 0 ? `target_roi=${encodeURIComponent(String(roiParam))}` : ''
      ].filter(Boolean).join('&');

      const res = await apiRequest(`commerce_video_product_service.php?${qs}`);
      if (res && res.success && res.data) {
        setData(res.data);
        if (res.data.config?.video_roi_target && overrideRoi === null) {
          setTargetRoiInput(res.data.config.video_roi_target);
        }
        // Default expand all products that have videos
        const initExpanded = {};
        (res.data.products || []).forEach((p, idx) => {
          if (idx < 5 || (p.videos && p.videos.length > 0)) {
            initExpanded[p.product_id] = true;
          }
        });
        setExpandedProducts(initExpanded);
      } else {
        setError(res?.message || 'Không thể tải báo cáo Video theo mã sản phẩm.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối khi tải báo cáo Video theo mã sản phẩm.');
    } finally {
      setIsLoading(false);
    }
  }, [shopId, startDate, endDate, apiRequest, targetRoiInput]);

  useEffect(() => {
    fetchIntelligence();
  }, [shopId, startDate, endDate]);

  const handleSyncAllVideoData = async () => {
    setIsSyncing(true);
    setSyncBanner(null);
    try {
      const [adsRes, vidRes] = await Promise.all([
        apiRequest(
          `commerce_dashboard.php?action=trigger_sync&domain=ads_all&shop_id=${encodeURIComponent(shopId)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
          'POST',
          { shop_id: shopId, domain: 'ads_all', start_date: startDate, end_date: endDate }
        ).catch((e) => ({ success: false, message: e.message })),
        apiRequest(
          `commerce_dashboard.php?action=sync_shop_videos&shop_id=${encodeURIComponent(shopId)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
          'POST',
          { shop_id: shopId, start_date: startDate, end_date: endDate }
        ).catch((e) => ({ success: false, message: e.message }))
      ]);

      const okAds = adsRes && adsRes.success;
      const okVid = vidRes && vidRes.success;
      if (okAds || okVid) {
        setSyncBanner({
          type: 'success',
          message: `Đã đồng bộ thành công dữ liệu Video, Sản phẩm & Chiến dịch từ TikTok (${startDate} → ${endDate}).`
        });
        await fetchIntelligence();
      } else {
        setSyncBanner({
          type: 'warning',
          message: adsRes?.message || vidRes?.message || 'Đồng bộ hoàn tất một phần. Vui lòng kiểm tra kết nối TikTok.'
        });
        await fetchIntelligence();
      }
    } catch (err) {
      setSyncBanner({
        type: 'error',
        message: err.message || 'Lỗi khi đồng bộ dữ liệu Video từ TikTok.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAskAiDirector = async () => {
    setIsAiLoading(true);
    try {
      const res = await apiRequest(
        'commerce_dashboard.php?action=analyze_sop_director',
        'POST',
        {
          mode: 'product_video',
          shop_id: shopId,
          start_date: startDate,
          end_date: endDate
        }
      );
      if (res && res.success) {
        setAiReport(res.data || res);
      }
    } catch {
      // ignore
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleProductExpand = (productId) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const summary = data?.summary || {};
  const dailyProd = data?.daily_production || {};
  const products = data?.products || [];
  const dailyRows = dailyProd.daily_rows || [];
  const visibleDailyRows = showAllDailyRows ? dailyRows : dailyRows.slice(0, 7);

  const renderDecisionBadge = (code, label) => {
    if (code === 'KEEP') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: '#dcfce7',
          color: '#15803d',
          border: '1px solid #86efac',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: '800',
          whiteSpace: 'nowrap'
        }}>
          <CheckCircle2 size={13} />
          {label || 'NÊN GIỮ & ĐẨY MẠNH'}
        </span>
      );
    }
    if (code === 'DROP') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fca5a5',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: '800',
          whiteSpace: 'nowrap'
        }}>
          <XCircle size={13} />
          {label || 'NÊN LOẠI TRỪ'}
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: '#fef3c7',
        color: '#b45309',
        border: '1px solid #fde68a',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: '800',
        whiteSpace: 'nowrap'
      }}>
        <AlertTriangle size={13} />
        {label || 'THEO DÕI THÊM'}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Top Header & Controls */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '18px 22px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb'
            }}>
              <Video size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                Báo Cáo Video Theo Mã Sản Phẩm • Đánh Giá KOC/KOL &amp; Định Mức 10–15 Video Mới/Ngày
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Bóc tách từng mã sản phẩm → Danh sách video (Doanh số thực, Chi phí QC, Hoa hồng KOC, Đơn hàng, Đơn hoàn, Đơn hủy) → Khuyến nghị Giữ hay Loại trừ
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '6px 10px',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af' }}>Mục tiêu thu/chi Video:</span>
              <input
                type="number"
                step="0.5"
                min="1"
                max="50"
                value={targetRoiInput}
                onChange={(e) => setTargetRoiInput(e.target.value)}
                style={{
                  width: '58px',
                  padding: '3px 6px',
                  borderRadius: '6px',
                  border: '1px solid #93c5fd',
                  fontSize: '12px',
                  fontWeight: '800',
                  textAlign: 'center',
                  color: '#1d4ed8',
                  background: '#ffffff'
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af' }}>lần</span>
              <button
                type="button"
                onClick={() => fetchIntelligence(Number(targetRoiInput) || 15.0)}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Áp dụng
              </button>
            </div>

            <button
              type="button"
              onClick={handleSyncAllVideoData}
              disabled={isSyncing || isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: (isSyncing || isLoading) ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
              }}
            >
              <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
              {isSyncing ? 'Đang đồng bộ TikTok...' : '🔄 Đồng bộ Video & Sản phẩm từ TikTok'}
            </button>

            <button
              type="button"
              onClick={handleAskAiDirector}
              disabled={isAiLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={14} />
              {isAiLoading ? 'Đang phân tích...' : 'Giám đốc Marketing AI đánh giá Video'}
            </button>

            <button
              type="button"
              onClick={() => fetchIntelligence()}
              disabled={isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
              Tải lại
            </button>
          </div>
        </div>

        {syncBanner && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: '600',
            background: syncBanner.type === 'success' ? '#ecfdf5' : syncBanner.type === 'warning' ? '#fffbeb' : '#fef2f2',
            color: syncBanner.type === 'success' ? '#065f46' : syncBanner.type === 'warning' ? '#92400e' : '#b91c1c',
            border: `1px solid ${syncBanner.type === 'success' ? '#a7f3d0' : syncBanner.type === 'warning' ? '#fde68a' : '#fecaca'}`
          }}>
            {syncBanner.message}
          </div>
        )}

        {aiReport && (
          <div style={{
            marginTop: '14px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '14px 18px'
          }}>
            <div style={{ fontWeight: '800', color: '#1e3a8a', fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#2563eb" />
              Nhận Xét Từ Giám Đốc Marketing AI (Kho Video &amp; KOC/KOL)
            </div>
            <div style={{ fontSize: '12.5px', color: '#1e293b', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
              {aiReport.analysis_markdown || aiReport.summary || aiReport.report || ''}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px 18px', color: '#b91c1c', fontSize: '13px', fontWeight: '600' }}>
          {error}
        </div>
      )}

      {/* 2. SECTION A: DAILY NEW VIDEO PRODUCTION QUOTA TRACKER (10-15 VIDEOS/DAY BY PRODUCT CODE) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px 22px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#2563eb" />
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                1. Báo Cáo Sản Xuất Video Mới Hằng Ngày Theo Mã Sản Phẩm (Mục Tiêu: 10–15 Video/Ngày)
              </h4>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              Theo dõi xem mỗi ngày đội Nội dung &amp; KOC sản xuất được bao nhiêu video mới cho từng mã sản phẩm, đã đạt định mức 10–15 video/ngày chưa
            </div>
          </div>

          <span style={{
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: '800',
            background: dailyProd.is_period_achieved ? '#dcfce7' : '#fef2f2',
            color: dailyProd.is_period_achieved ? '#15803d' : '#b91c1c',
            border: `1px solid ${dailyProd.is_period_achieved ? '#86efac' : '#fca5a5'}`
          }}>
            {dailyProd.is_period_achieved
              ? `✓ ĐẠT CHUẨN: TB ${dailyProd.avg_new_videos_per_day || 0} video mới/ngày`
              : `⚠ CHƯA ĐẠT: TB ${dailyProd.avg_new_videos_per_day || 0} / 10–15 video mới/ngày`}
          </span>
        </div>

        {/* Quota Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>TRUNG BÌNH VIDEO MỚI / NGÀY</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: dailyProd.is_period_achieved ? '#059669' : '#dc2626', marginTop: '4px' }}>
              {dailyProd.avg_new_videos_per_day ?? 0} video/ngày
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Chuẩn quy trình: <strong>10 – 15 video/ngày</strong>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>TỔNG VIDEO MỚI TRONG KỲ ({dailyProd.total_days || 0} NGÀY)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
              {formatNumber(dailyProd.total_new_videos_in_period || 0)} video mới
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Mục tiêu kỳ: <strong>{formatNumber(dailyProd.period_target_min || 0)} – {formatNumber(dailyProd.period_target_max || 0)} video</strong>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>SỐ NGÀY ĐẠT ĐỊNH MỨC (≥ 10 VIDEO)</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: (dailyProd.days_achieved_count || 0) > 0 ? '#059669' : '#d97706', marginTop: '4px' }}>
              {dailyProd.days_achieved_count || 0} / {dailyProd.total_days || 0} ngày
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {dailyProd.overall_assessment}
            </div>
          </div>
        </div>

        {/* New Videos Produced by Product Code in Period */}
        {Array.isArray(dailyProd.by_product_totals) && dailyProd.by_product_totals.length > 0 && (
          <div style={{ marginBottom: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#1e3a8a', marginBottom: '8px' }}>
              📌 Tổng số lượng Video mới sản xuất trong kỳ theo từng Mã Sản Phẩm:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {dailyProd.by_product_totals.map((pt) => (
                <div
                  key={pt.product_id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #93c5fd',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px'
                  }}
                >
                  <strong style={{ color: '#0f172a' }}>{pt.product_name}</strong>{' '}
                  <span style={{ color: '#64748b', fontSize: '11px' }}>(Mã: {pt.product_id})</span>:{' '}
                  <strong style={{ color: '#2563eb' }}>{pt.total_new_videos} video mới</strong>{' '}
                  <span style={{ fontSize: '11px', color: '#475569' }}>
                    (KOC: {pt.koc_new_videos} • Shop/Ads: {pt.shop_new_videos})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Breakdown Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>Ngày</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Số lượng Video mới</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Nguồn sản xuất (KOC vs Shop)</th>
                <th style={{ padding: '10px 12px' }}>Số lượng theo từng Mã Sản Phẩm</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Đánh giá Mục tiêu (10–15 video/ngày)</th>
              </tr>
            </thead>
            <tbody>
              {visibleDailyRows.map((row) => {
                const isPass = row.total_new_videos >= (row.target_min || 10);
                return (
                  <tr key={row.date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {row.date}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '800',
                        color: isPass ? '#059669' : row.total_new_videos > 0 ? '#d97706' : '#94a3b8'
                      }}>
                        {row.total_new_videos} video
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#334155' }}>
                      KOC/KOL: <strong>{row.koc_new_videos}</strong> • Kênh Shop/Ads: <strong>{row.shop_new_videos}</strong>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {(!row.products_breakdown || row.products_breakdown.length === 0) ? (
                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>Chưa có video mới trong ngày này</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {row.products_breakdown.map((pb) => (
                            <span
                              key={pb.product_id}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                color: '#0f172a'
                              }}
                            >
                              <strong>{pb.product_name}</strong> ({pb.product_id}): <strong>{pb.new_videos_count} video</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: isPass ? '#dcfce7' : row.total_new_videos > 0 ? '#fef3c7' : '#fef2f2',
                        color: isPass ? '#15803d' : row.total_new_videos > 0 ? '#b45309' : '#b91c1c'
                      }}>
                        {row.status_label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {dailyRows.length > 7 && (
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowAllDailyRows((v) => !v)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {showAllDailyRows ? 'Thu gọn bớt ngày' : `Xem toàn bộ ${dailyRows.length} ngày trong kỳ`}
            </button>
          </div>
        )}
      </div>

      {/* 3. OVERALL VIDEO & KOC KPI STRIP + KEEP / TEST / DROP FILTER CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div
          onClick={() => setDecisionFilter(decisionFilter === 'KEEP' ? 'ALL' : 'KEEP')}
          style={{
            background: decisionFilter === 'KEEP' ? '#dcfce7' : '#f0fdf4',
            border: decisionFilter === 'KEEP' ? '2px solid #16a34a' : '1px solid #bbf7d0',
            borderRadius: '14px',
            padding: '16px',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ background: '#16a34a', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
              🟢 NÊN GIỮ &amp; ĐẨY MẠNH
            </span>
            <span style={{ fontSize: '22px', fontWeight: '800', color: '#15803d' }}>
              {summary.keep_videos_count || 0} video
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#166534', marginTop: '8px', lineHeight: '1.45' }}>
            Video có thu/chi thực đạt chuẩn (&ge; {summary.target_roi || targetRoiInput} lần) hoặc ra đơn tự nhiên tốt, tỷ lệ hoàn/hủy thấp. Bấm để lọc riêng nhóm nên giữ.
          </div>
        </div>

        <div
          onClick={() => setDecisionFilter(decisionFilter === 'TEST' ? 'ALL' : 'TEST')}
          style={{
            background: decisionFilter === 'TEST' ? '#fef3c7' : '#fffbeb',
            border: decisionFilter === 'TEST' ? '2px solid #d97706' : '1px solid #fde68a',
            borderRadius: '14px',
            padding: '16px',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ background: '#d97706', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
              🟡 THEO DÕI THÊM &amp; TỐI ƯU
            </span>
            <span style={{ fontSize: '22px', fontWeight: '800', color: '#b45309' }}>
              {summary.test_videos_count || 0} video
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#92400e', marginTop: '8px', lineHeight: '1.45' }}>
            Video mới đăng hoặc đã có đơn nhưng thu/chi thực chưa chạm mốc {summary.target_roi || targetRoiInput} lần, hoặc cần xin gia hạn mã KOC.
          </div>
        </div>

        <div
          onClick={() => setDecisionFilter(decisionFilter === 'DROP' ? 'ALL' : 'DROP')}
          style={{
            background: decisionFilter === 'DROP' ? '#fee2e2' : '#fef2f2',
            border: decisionFilter === 'DROP' ? '2px solid #dc2626' : '1px solid #fecaca',
            borderRadius: '14px',
            padding: '16px',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ background: '#dc2626', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
              🔴 NÊN LOẠI TRỪ / TẮT QC
            </span>
            <span style={{ fontSize: '22px', fontWeight: '800', color: '#b91c1c' }}>
              {summary.drop_videos_count || 0} video
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '8px', lineHeight: '1.45' }}>
            Video đốt tiền quảng cáo 0 đơn, hoặc thu/chi thực quá thấp gây lỗ, hoặc tỷ lệ khách hủy/hoàn đơn cao (&ge; 30%). Cần loại trừ ngay.
          </div>
        </div>
      </div>

      {/* 4. SECTION B: PRODUCT-CENTRIC VIDEO REPORT (MÃ SẢN PHẨM -> DANH SÁCH VIDEO) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '18px 22px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={18} color="#2563eb" />
              2. Báo Cáo Video Theo Từng Mã Sản Phẩm &amp; Đánh Giá Chi Tiết Video KOC/KOL ({products.length} sản phẩm • {summary.total_videos_count || 0} video)
            </h4>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Bấm vào từng Mã sản phẩm để đóng/mở danh sách video của sản phẩm đó • Đầy đủ Doanh số thực, Chi phí QC, Hoa hồng KOC, Đơn hàng, Đơn hủy, Đơn hoàn
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0f172a',
                background: '#ffffff'
              }}
            >
              <option value="ALL">Tất cả mã sản phẩm ({products.length})</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.product_id}) — {p.videos_count} video
                </option>
              ))}
            </select>

            <select
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: '600',
                color: '#0f172a',
                background: '#ffffff'
              }}
            >
              <option value="ALL">Mọi nguồn kênh (KOC + Shop)</option>
              <option value="AFFILIATE">Chỉ Video của KOC / KOL Liên kết</option>
              <option value="SHOP_ADS">Chỉ Video Kênh Shop / Quảng cáo</option>
            </select>

            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0f172a',
                background: '#ffffff'
              }}
            >
              <option value="ALL">Mọi kết luận đánh giá</option>
              <option value="KEEP">🟢 Nên giữ &amp; đẩy mạnh ({summary.keep_videos_count || 0})</option>
              <option value="TEST">🟡 Theo dõi thêm ({summary.test_videos_count || 0})</option>
              <option value="DROP">🔴 Nên loại trừ ({summary.drop_videos_count || 0})</option>
            </select>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px 10px'
            }}>
              <Search size={14} color="#64748b" />
              <input
                type="text"
                placeholder="Tìm mã SP, mã Video, tên KOC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '12px',
                  color: '#0f172a',
                  width: '180px'
                }}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" color="#2563eb" style={{ margin: '0 auto 10px auto' }} />
            <div style={{ fontWeight: '600', color: '#0f172a' }}>Đang tổng hợp dữ liệu Video &amp; KOC theo từng mã sản phẩm...</div>
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
            Chưa có dữ liệu sản phẩm hoặc video trong kỳ ({startDate} → {endDate}). Hãy bấm nút &ldquo;🔄 Đồng bộ Video &amp; Sản phẩm từ TikTok&rdquo;.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {products
              .filter((p) => selectedProductId === 'ALL' || p.product_id === selectedProductId)
              .map((product) => {
                const filteredVids = (product.videos || []).filter((v) => {
                  if (decisionFilter !== 'ALL' && v.decision_code !== decisionFilter) return false;
                  if (creatorFilter === 'AFFILIATE' && v.creator_type !== 'AFFILIATE') return false;
                  if (creatorFilter === 'SHOP_ADS' && v.creator_type === 'AFFILIATE') return false;
                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    const mVid = String(v.video_id || '').toLowerCase().includes(q);
                    const mTitle = String(v.video_title || '').toLowerCase().includes(q);
                    const mKoc = String(v.creator_username || '').toLowerCase().includes(q);
                    const mPid = String(product.product_id || '').toLowerCase().includes(q);
                    const mPname = String(product.product_name || '').toLowerCase().includes(q);
                    if (!mVid && !mTitle && !mKoc && !mPid && !mPname) return false;
                  }
                  return true;
                });

                if (filteredVids.length === 0 && (decisionFilter !== 'ALL' || creatorFilter !== 'ALL' || searchQuery !== '')) {
                  return null;
                }

                const isExpanded = !!expandedProducts[product.product_id];

                return (
                  <div
                    key={product.product_id}
                    style={{
                      border: product.is_main_sku ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      background: '#ffffff'
                    }}
                  >
                    {/* Product Header Row */}
                    <div
                      onClick={() => toggleProductExpand(product.product_id)}
                      style={{
                        padding: '14px 18px',
                        background: product.is_main_sku ? 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)' : '#f8fafc',
                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isExpanded ? <ChevronDown size={18} color="#2563eb" /> : <ChevronRight size={18} color="#64748b" />}
                        {product.product_image ? (
                          <img
                            src={product.product_image}
                            alt={product.product_name}
                            style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #cbd5e1', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#475569', fontSize: '12px' }}>
                            SP
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                              {product.product_name}
                            </span>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: product.is_main_sku ? '#dbeafe' : '#f1f5f9',
                              color: product.is_main_sku ? '#1d4ed8' : '#475569'
                            }}>
                              {product.sku_role_label}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <span>Mã SP: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{product.product_id}</strong></span>
                            <span>• Tổng: <strong>{product.videos_count} video</strong> ({product.new_videos_in_period} video mới kỳ này)</span>
                            <span>• <strong style={{ color: '#15803d' }}>🟢 Giữ: {product.keep_videos_count}</strong></span>
                            <span>• <strong style={{ color: '#b45309' }}>🟡 Theo dõi: {product.test_videos_count}</strong></span>
                            <span>• <strong style={{ color: '#b91c1c' }}>🔴 Loại trừ: {product.drop_videos_count}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Product-level Financial Summary Pills */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>DOANH SỐ THỰC (VIDEO)</div>
                          <div style={{ fontWeight: '800', color: '#059669', fontSize: '14px' }}>
                            {formatVND(product.total_realized_revenue)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            Gộp: {formatVND(product.total_gross_revenue)}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>CHI PHÍ QC + HOA HỒNG</div>
                          <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                            {formatVND(product.total_marketing_cost)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            QC: {formatVND(product.total_ad_spend)} • HH: {formatVND(product.total_commission)}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>ĐƠN HÀNG (HỦY / HOÀN)</div>
                          <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                            {formatNumber(product.total_orders)} đơn
                          </div>
                          <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600' }}>
                            Hủy: {product.cancelled_orders} • Hoàn: {product.refunded_orders} ({product.cancel_refund_rate_pct}%)
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', minWidth: '90px' }}>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>THU / CHI THỰC</div>
                          <div style={{
                            fontWeight: '800',
                            fontSize: '14px',
                            color: product.net_roi !== null && product.net_roi >= targetRoiInput ? '#059669' : '#d97706'
                          }}>
                            {product.net_roi !== null && product.net_roi !== undefined ? `${product.net_roi} lần` : '—'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            Mục tiêu: {targetRoiInput} lần
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Videos List for this Product */}
                    {isExpanded && (
                      <div style={{ overflowX: 'auto' }}>
                        {filteredVids.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                            Sản phẩm này chưa có video nào khớp với bộ lọc hiện tại (Doanh số cửa hàng kỳ này: {formatVND(product.shop_realized_revenue)} từ {formatNumber(product.shop_orders)} đơn).
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                <th style={{ padding: '10px 14px', minWidth: '250px' }}>Danh sách Video thuộc sản phẩm</th>
                                <th style={{ padding: '10px 10px' }}>KOC / KOL / Kênh</th>
                                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Doanh số gộp &amp; Thực nhận</th>
                                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Chi phí QC &amp; Hoa hồng</th>
                                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tổng đơn</th>
                                <th style={{ padding: '10px 10px', textAlign: 'right', background: '#fef2f2', color: '#991b1b' }}>Đơn hủy &amp; Đơn hoàn</th>
                                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Chỉ số liên quan</th>
                                <th style={{ padding: '10px 10px', textAlign: 'center', background: '#eff6ff', color: '#1e40af' }}>Thu/chi thực</th>
                                <th style={{ padding: '10px 14px', minWidth: '270px' }}>Đánh giá Video KOC/KOL (Giữ hay Loại trừ)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredVids.map((v) => (
                                <tr key={`${product.product_id}_${v.video_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  {/* 1. Video Info */}
                                  <td style={{ padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      {v.thumbnail_url ? (
                                        <img
                                          src={v.thumbnail_url}
                                          alt={v.video_title}
                                          style={{ width: '44px', height: '58px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #cbd5e1', flexShrink: 0 }}
                                        />
                                      ) : (
                                        <div style={{ width: '44px', height: '58px', borderRadius: '6px', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>
                                          VIDEO
                                        </div>
                                      )}
                                      <div>
                                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12.5px', lineHeight: '1.35' }}>
                                          {v.video_title}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                          <span style={{ fontFamily: 'monospace' }}>ID: {v.video_id}</span>
                                          {v.produced_date && (
                                            <span>• Ngày đăng: <strong>{v.produced_date}</strong></span>
                                          )}
                                          {v.video_url && (
                                            <a
                                              href={v.video_url}
                                              target="_blank"
                                              rel="noreferrer"
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#2563eb', fontWeight: '700', textDecoration: 'none' }}
                                            >
                                              Xem video <ExternalLink size={11} />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* 2. KOC / KOL / Creator */}
                                  <td style={{ padding: '12px 10px' }}>
                                    <div style={{ fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Users size={13} color={v.creator_type === 'AFFILIATE' ? '#7c3aed' : '#2563eb'} />
                                      {v.creator_username}
                                    </div>
                                    <span style={{
                                      display: 'inline-block',
                                      marginTop: '3px',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      background: v.creator_type === 'AFFILIATE' ? '#f3e8ff' : '#eff6ff',
                                      color: v.creator_type === 'AFFILIATE' ? '#6d28d9' : '#1d4ed8'
                                    }}>
                                      {v.creator_badge}
                                    </span>
                                  </td>

                                  {/* 3. Revenue (Gross & Realized) */}
                                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                                    <div style={{ fontWeight: '800', color: '#059669', fontSize: '13px' }}>
                                      Thực: {formatVND(v.realized_revenue)}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                      Gộp: {formatVND(v.gross_revenue)}
                                    </div>
                                    {v.cancel_refund_amount > 0 && (
                                      <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600' }}>
                                        Trừ hủy/hoàn: -{formatVND(v.cancel_refund_amount)}
                                      </div>
                                    )}
                                  </td>

                                  {/* 4. Ad Spend & Affiliate Commission */}
                                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                                    <div style={{ fontWeight: '700', color: '#0f172a' }}>
                                      QC: {formatVND(v.ad_spend)}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '700', marginTop: '2px' }}>
                                      Hoa hồng KOC: {formatVND(v.commission_amount)}
                                    </div>
                                    {v.cpa !== null && (
                                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                                        Chi phí/đơn: {formatVND(v.cpa)}
                                      </div>
                                    )}
                                  </td>

                                  {/* 5. Orders */}
                                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>
                                      {formatNumber(v.orders_count)} đơn
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600', marginTop: '2px' }}>
                                      Thành công: {formatNumber(v.realized_orders)}
                                    </div>
                                  </td>

                                  {/* 6. Cancelled & Refunded Orders */}
                                  <td style={{ padding: '12px 10px', textAlign: 'right', background: '#fffafa' }}>
                                    <div style={{ fontWeight: '700', color: '#dc2626' }}>
                                      Đơn hủy: {formatNumber(v.cancelled_orders)}
                                    </div>
                                    <div style={{ fontWeight: '700', color: '#b91c1c', marginTop: '2px' }}>
                                      Đơn hoàn: {formatNumber(v.refunded_orders)}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#7f1d1d', marginTop: '2px', fontWeight: '700' }}>
                                      Tỷ lệ hủy+hoàn: {v.cancel_refund_rate_pct}%
                                    </div>
                                  </td>

                                  {/* 7. Related Video Metrics */}
                                  <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', color: '#334155' }}>
                                    <div>Lượt xem: <strong>{v.video_views !== null ? formatNumber(v.video_views) : '—'}</strong></div>
                                    <div style={{ marginTop: '2px' }}>Bấm giỏ: <strong>{v.ctr_pct !== null ? `${v.ctr_pct}%` : '—'}</strong></div>
                                    <div style={{ marginTop: '2px' }}>DT/1.000 xem: <strong>{v.gpm !== null ? formatVND(v.gpm) : '—'}</strong></div>
                                  </td>

                                  {/* 8. Net ROI vs Target */}
                                  <td style={{ padding: '12px 10px', textAlign: 'center', background: '#f8fbff' }}>
                                    <div style={{
                                      fontWeight: '900',
                                      fontSize: '14px',
                                      color: v.net_roi !== null
                                        ? (v.net_roi >= v.target_roi ? '#059669' : v.net_roi < v.target_roi * 0.5 ? '#dc2626' : '#d97706')
                                        : '#64748b'
                                    }}>
                                      {v.net_roi !== null ? `${v.net_roi} lần` : 'Tự nhiên'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                      Mục tiêu: {v.target_roi} lần
                                    </div>
                                    {v.gross_roi !== null && v.gross_roi !== v.net_roi && (
                                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                        (Gộp: {v.gross_roi}x)
                                      </div>
                                    )}
                                  </td>

                                  {/* 9. Automated KOC/KOL Evaluation (KEEP / TEST / DROP) */}
                                  <td style={{ padding: '12px 14px', maxWidth: '310px' }}>
                                    <div style={{ marginBottom: '5px' }}>
                                      {renderDecisionBadge(v.decision_code, v.decision_label)}
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: '#0f172a', fontWeight: '600', lineHeight: '1.4' }}>
                                      {v.decision_reason}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px', lineHeight: '1.4' }}>
                                      👉 {v.action_recommendation}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
