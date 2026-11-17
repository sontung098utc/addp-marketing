import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Download,
  RefreshCw,
  Award,
  Video,
  Radio,
  ShoppingBag,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Key,
  ExternalLink
} from 'lucide-react';

export default function CommerceAffiliateView({
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

  // API Ingestion & Sync State (API ONLY per P0 Integrity)
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchAffiliateReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=get_affiliate_report&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`);
      if (res && res.success) {
        setData(res.data);
      } else {
        setError(res?.message || 'Không thể tải báo cáo Affiliate.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối khi tải dữ liệu Affiliate.');
    } finally {
      setIsLoading(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  useEffect(() => {
    fetchAffiliateReport();
  }, [fetchAffiliateReport]);

  const handleSyncAffiliate = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=sync_affiliate_orders&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`);
      if (res && res.success) {
        setSyncFeedback({
          type: 'success',
          message: res.message || 'Đồng bộ đơn hàng Affiliate từ TikTok API thành công.'
        });
        fetchAffiliateReport();
      } else if (res && res.status === 'PERMISSION_REQUIRED') {
        setSyncFeedback({
          type: 'warning',
          scope: res.scope || 'seller.affiliate_collaboration.read',
          message: res.message || 'Ứng dụng chưa được cấp quyền seller.affiliate_collaboration.read từ TikTok Shop App Console.'
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: res?.message || 'Lỗi đồng bộ dữ liệu Affiliate.'
        });
      }
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Lỗi kết nối khi đồng bộ Affiliate.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=export_affiliate_report&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`);
      if (res && res.success && res.data?.csv) {
        const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.data.filename || `affiliate_report_${shopId}_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Fallback for direct download link
        const directUrl = `/api/commerce_dashboard.php?action=export_affiliate_report&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&direct_download=1`;
        window.open(directUrl, '_blank');
      }
    } catch (err) {
      console.error('Export affiliate error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const summary = data?.summary || {};
  const breakdown = data?.content_breakdown || {};
  const creators = data?.creators || [];
  const isPermissionRequired = data?.data_status === 'PERMISSION_REQUIRED' || syncFeedback?.type === 'warning';

  return (
    <div className="commerce-affiliate-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563eb'
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Quản Trị Tiếp Thị Liên Kết &amp; KOC (Affiliate Intelligence)
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '999px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <ShieldCheck size={12} />
                API ONLY
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Phân tích doanh thu, hoa hồng thực tế và bảng xếp hạng Creator TikTok Shop (Chuẩn API chính thức)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={fetchAffiliateReport}
            disabled={isLoading || isSyncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
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
            Làm mới
          </button>

          <button
            type="button"
            onClick={handleSyncAffiliate}
            disabled={isSyncing || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #2563eb',
              background: '#2563eb',
              fontSize: '12px',
              fontWeight: '600',
              color: '#ffffff',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(37,99,235,0.2)'
            }}
          >
            <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
            {isSyncing ? 'Đang đồng bộ API...' : 'Đồng bộ API Affiliate'}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #0f172a',
              background: '#0f172a',
              fontSize: '12px',
              fontWeight: '600',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <Download size={13} />
            {isExporting ? 'Đang xuất...' : 'Xuất CSV'}
          </button>
        </div>
      </div>

      {/* Sync Feedback Alert */}
      {syncFeedback && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: syncFeedback.type === 'success' ? '#f0fdf4' : syncFeedback.type === 'warning' ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${syncFeedback.type === 'success' ? '#bbf7d0' : syncFeedback.type === 'warning' ? '#fde68a' : '#fecaca'}`,
          color: syncFeedback.type === 'success' ? '#15803d' : syncFeedback.type === 'warning' ? '#92400e' : '#b91c1c'
        }}>
          {syncFeedback.type === 'success' && <CheckCircle2 size={16} />}
          {syncFeedback.type === 'warning' && <Key size={16} />}
          {syncFeedback.type === 'error' && <AlertCircle size={16} />}
          <div style={{ flex: 1 }}>{syncFeedback.message}</div>
        </div>
      )}

      {/* Permission Scope Callout */}
      {isPermissionRequired && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          color: '#92400e'
        }}>
          <Key size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
            <strong style={{ display: 'block', fontSize: '14px', color: '#b45309', marginBottom: '4px' }}>
              Yêu cầu quyền truy cập TikTok Shop Affiliate API
            </strong>
            Để đồng bộ đầy đủ danh sách đơn hàng tiếp thị liên kết, hoa hồng từng SKU và nhà sáng tạo, ứng dụng TikTok App của Shop cần được kích hoạt quyền:
            <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', marginLeft: '6px', color: '#92400e' }}>
              seller.affiliate_collaboration.read
            </code>
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#78350f' }}>
              Vui lòng truy cập TikTok Shop Partner Center &gt; App Console &gt; Permissions để duyệt quyền này cho Shop. Trong thời gian chờ, hệ thống đối soát hoa hồng thực tế qua dòng tiền tài chính (Finance Settlements).
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#b91c1c',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {(!isLoading && (!data?.has_data || summary.total_affiliate_gmv === 0) && !error) && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Chưa có dữ liệu Affiliate trong kỳ đã chọn</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Hệ thống truy xuất trực tiếp từ TikTok Shop Affiliate API. Nhấn <strong>"Đồng bộ API Affiliate"</strong> để cập nhật các đơn hàng phát sinh mới nhất.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSyncAffiliate}
            disabled={isSyncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #2563eb',
              background: '#eff6ff',
              color: '#2563eb',
              fontSize: '12px',
              fontWeight: '700',
              cursor: isSyncing ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
            Đồng bộ dữ liệu ngay
          </button>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '14px'
      }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Doanh thu Affiliate (GMV)</span>
            <DollarSign size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '8px' }}>
            {formatVND(summary.total_affiliate_gmv || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Tổng số đơn: <strong>{formatNumber(summary.total_affiliate_orders || 0)}</strong> đơn
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Organic vs Chạy Ads</span>
            <TrendingUp size={16} color="#16a34a" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a', marginTop: '8px' }}>
            {formatVND(summary.organic_affiliate_gmv || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Shop Ads phụ trợ: <strong>{formatVND(summary.ads_affiliate_gmv || 0)}</strong>
            {summary.unclassified_affiliate_gmv > 0 && (
              <span style={{ display: 'block', color: '#94a3b8' }}>
                Chưa gán tag: {formatVND(summary.unclassified_affiliate_gmv)}
              </span>
            )}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Hoa hồng đã quyết toán</span>
            <Award size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706', marginTop: '8px' }}>
            {formatVND(summary.total_commission_settled || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Ước tính ban đầu: {summary.total_commission_estimated !== null ? formatVND(summary.total_commission_estimated) : 'Chờ API'}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Tỷ lệ hoa hồng thực tế</span>
            <Sparkles size={16} color="#6366f1" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#6366f1', marginTop: '8px' }}>
            {summary.avg_commission_rate_pct !== null ? `${summary.avg_commission_rate_pct}%` : 'Chờ API đối soát'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Hủy/không đủ điều kiện: <strong style={{ color: '#dc2626' }}>{formatVND(summary.ineligible_commission || 0)}</strong>
          </div>
        </div>
      </div>

      {/* 3. Content Format Breakdown */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
          Tỷ Trọng Doanh Thu Theo Định Dạng Nội Dung
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontWeight: '600', fontSize: '12px' }}>
              <Video size={16} /> Video ngắn (Shorts)
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginTop: '6px' }}>
              {formatVND(breakdown.video?.gmv || 0)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {breakdown.video?.share_pct || 0}% tổng GMV Affiliate
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: '600', fontSize: '12px' }}>
              <Radio size={16} /> Phiên Livestream
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginTop: '6px' }}>
              {formatVND(breakdown.live?.gmv || 0)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {breakdown.live?.share_pct || 0}% tổng GMV Affiliate
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: '600', fontSize: '12px' }}>
              <ShoppingBag size={16} /> Gian hàng &amp; Showcase
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginTop: '6px' }}>
              {formatVND(breakdown.showcase?.gmv || 0)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {breakdown.showcase?.share_pct || 0}% tổng GMV Affiliate
            </div>
          </div>
        </div>
      </div>

      {/* 4. Creator Leaderboard Table */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
              Bảng Xếp Hạng Nhà Sáng Tạo &amp; KOC (Top Creators Leaderboard)
            </h4>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Hiển thị tối đa 50 nhà sáng tạo có doanh số cao nhất trong kỳ từ dữ liệu TikTok Shop Open API
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Tổng số: <strong>{creators.length}</strong> nhà sáng tạo
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>Hạng</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>Nhà sáng tạo / KOC</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>Kênh</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>Số Video/Live</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>Đơn hàng</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>Doanh thu (₫)</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>Tỷ lệ HH (%)</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>Dự kiến (₫)</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>Thực nhận (₫)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                    <div>Đang nạp dữ liệu Affiliate...</div>
                  </td>
                </tr>
              ) : creators.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Chưa có dữ liệu nhà sáng tạo liên kết trong kỳ này. Bấm <strong>"Đồng bộ API Affiliate"</strong> để cập nhật từ TikTok Shop Open API.
                  </td>
                </tr>
              ) : (
                creators.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: idx < 3 ? '#2563eb' : '#64748b' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      {c.creator_name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: c.creator_type === 'OFFICIAL' ? '#dcfce7' : c.creator_type === 'MARKETING' ? '#fef3c7' : '#eff6ff',
                        color: c.creator_type === 'OFFICIAL' ? '#15803d' : c.creator_type === 'MARKETING' ? '#b45309' : '#1d4ed8'
                      }}>
                        {c.creator_type === 'OFFICIAL' ? 'Kênh Shop' : c.creator_type === 'MARKETING' ? 'Shop Ads' : 'Affiliate KOC'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569' }}>
                      {formatNumber(c.video_count || 0)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                      {formatNumber(c.orders || 0)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#2563eb' }}>
                      {formatVND(c.gmv || 0)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>
                      {c.commission_rate_pct !== null && c.commission_rate_pct !== undefined ? `${c.commission_rate_pct}%` : <span style={{ color: '#94a3b8' }}>Chờ API</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#475569' }}>
                      {c.commission_estimated !== null && c.commission_estimated !== undefined ? formatVND(c.commission_estimated) : <span style={{ color: '#94a3b8' }}>Chờ API</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#d97706' }}>
                      {c.commission_settled !== null && c.commission_settled !== undefined ? formatVND(c.commission_settled) : <span style={{ color: '#94a3b8' }}>Chờ đối soát</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
