import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Zap,
  TrendingUp,
  Radio,
  Calendar,
  Sparkles,
  RefreshCw,
  Award,
  AlertCircle,
  BarChart2,
  Sliders,
  CheckCircle,
  Info
} from 'lucide-react';

export default function CommerceGoldenHoursView({
  shopId = '7495657895504611503',
  startDate,
  endDate,
  apiRequest
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [metricMode, setMetricMode] = useState('orders'); // 'orders' or 'sales'
  const [hoveredHour, setHoveredHour] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);

  const fetchGoldenHours = useCallback(async () => {
    if (!apiRequest) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(
        `commerce_dashboard.php?action=get_golden_hours&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`
      );
      if (res && res.success && res.data) {
        setData(res.data);
      } else {
        setError(res?.message || 'Không thể tải dữ liệu khung giờ vàng.');
      }
    } catch (err) {
      setError(err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  useEffect(() => {
    fetchGoldenHours();
  }, [fetchGoldenHours]);

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
        <RefreshCw size={28} className="spin" style={{ color: '#2563eb', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>Đang phân tích dữ liệu khung giờ vàng thời gian thực...</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Đối soát phân phối 24 giờ & ma trận 7x24 ngày trong tuần</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', color: '#991b1b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
          <AlertCircle size={18} />
          <span>Lỗi tải dữ liệu Khung Giờ Vàng</span>
        </div>
        <div style={{ fontSize: '13px', marginTop: '6px' }}>{error || 'Không có dữ liệu.'}</div>
        <button
          type="button"
          onClick={fetchGoldenHours}
          style={{ marginTop: '12px', padding: '6px 14px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  const {
    hourly_distribution = [],
    matrix = [],
    day_rankings = [],
    top_golden_slots = [],
    day_names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'],
    playbook = {},
    is_historical_fallback = false
  } = data;

  // Max value for scaling
  const maxHourlyVal = Math.max(
    ...hourly_distribution.map(h => metricMode === 'orders' ? (h.orders_count || 0) : (h.gross_sales || 0)),
    1
  );

  // Matrix max value
  let maxMatrixVal = 1;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const val = matrix[d]?.[h] ? (metricMode === 'orders' ? matrix[d][h].orders_count : matrix[d][h].gross_sales) : 0;
      if (val > maxMatrixVal) maxMatrixVal = val;
    }
  }

  const totalPeriodOrders = hourly_distribution.reduce((acc, h) => acc + (h.orders_count || 0), 0);
  const totalPeriodSales = hourly_distribution.reduce((acc, h) => acc + (h.gross_sales || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header & Controls */}
      <div style={{
        background: '#ffffff',
        padding: '20px 24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb'
            }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Khung Giờ Vàng & Chiến Lược Đẩy Ads / Live Thời Gian Thực
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Phân tích 24 giờ và ma trận 7x24 ngày trong tuần từ đơn hàng TikTok Shop ({startDate} → {endDate})
              </div>
            </div>
          </div>
          {is_historical_fallback && (
            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', fontSize: '11px', color: '#b45309' }}>
              <Info size={12} />
              <span>Khoảng thời gian đã chọn chưa đủ mẫu đơn hàng. Hệ thống mở rộng chu kỳ 90 ngày gần nhất để mô phỏng phân phối chính xác.</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
            <button
              type="button"
              onClick={() => setMetricMode('orders')}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                background: metricMode === 'orders' ? '#ffffff' : 'transparent',
                color: metricMode === 'orders' ? '#2563eb' : '#64748b',
                boxShadow: metricMode === 'orders' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              Số Lượng Đơn Hàng
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('sales')}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                background: metricMode === 'sales' ? '#ffffff' : 'transparent',
                color: metricMode === 'sales' ? '#2563eb' : '#64748b',
                boxShadow: metricMode === 'sales' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              Doanh Số Gộp (₫)
            </button>
          </div>

          <button
            type="button"
            onClick={fetchGoldenHours}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} />
            Làm mới
          </button>
        </div>
      </div>

      {/* 2. Three Action Playbook Recommendations Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Playbook 1: Ads Pacing */}
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
          padding: '20px',
          borderRadius: '16px',
          border: '1px solid #bfdbfe',
          boxShadow: '0 2px 4px rgba(37,99,235,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d4ed8', fontWeight: '800', fontSize: '14px', marginBottom: '8px' }}>
            <Zap size={18} />
            <span>Tối Ưu Ngân Sách GMV Max (Pacing Strategy)</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.5', fontWeight: '500' }}>
            {playbook.ads_pacing_recommendation || 'Tăng ngân sách trước 45 phút lúc 10:15 và 19:15 để đón trọn đỉnh chuyển đổi mua sắm.'}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
              Trưa: {playbook.peak_lunch_window || '11:00 - 13:00'}
            </span>
            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
              Tối: {playbook.peak_evening_window || '19:00 - 23:00'}
            </span>
          </div>
        </div>

        {/* Playbook 2: Livestream Scheduling */}
        <div style={{
          background: 'linear-gradient(135deg, #fdf2f8 0%, #ffffff 100%)',
          padding: '20px',
          borderRadius: '16px',
          border: '1px solid #fbcfe8',
          boxShadow: '0 2px 4px rgba(219,39,119,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be185d', fontWeight: '800', fontSize: '14px', marginBottom: '8px' }}>
            <Radio size={18} />
            <span>Khung Giờ Phát LIVE Hiệu Quả Nhất</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.5', fontWeight: '500' }}>
            {playbook.livestream_recommendation || 'Tập trung phát LIVE vào khung 19:30 - 23:00, khung giờ mang lại hơn 40% doanh thu toàn shop.'}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ background: '#fce7f3', color: '#9d174d', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
              Ngày hiệu quả nhất: {playbook.best_day || 'Chủ Nhật'}
            </span>
          </div>
        </div>

        {/* Playbook 3: Creative / Video Publishing */}
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
          padding: '20px',
          borderRadius: '16px',
          border: '1px solid #bbf7d0',
          boxShadow: '0 2px 4px rgba(22,163,74,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: '800', fontSize: '14px', marginBottom: '8px' }}>
            <Sparkles size={18} />
            <span>Thời Điểm Đăng Video Sáng Tạo / KOC</span>
          </div>
          <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.5', fontWeight: '500' }}>
            {playbook.creative_post_recommendation || 'Đăng video lúc 10:15 sáng hoặc 17:45 chiều để video kịp tích lũy tương tác trước khi vào giờ vàng.'}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
              Đón đầu làn sóng mua sắm
            </span>
          </div>
        </div>
      </div>

      {/* 3. 24-Hour Distribution Bar Chart */}
      <div style={{
        background: '#ffffff',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
              Phân Phối 24 Giờ Trong Ngày (00:00 - 23:59)
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Độ đậm nhạt và chiều cao thể hiện lượng {metricMode === 'orders' ? 'đơn hàng' : 'doanh số'} chốt thành công trong từng giờ
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }}></span>
              Đỉnh Buổi Tối (Peak)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }}></span>
              Đỉnh Buổi Trưa
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#3b82f6', borderRadius: '2px' }}></span>
              Bình thường
            </span>
          </div>
        </div>

        {/* 24-Bar Visualization */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(24, 1fr)',
          gap: '6px',
          alignItems: 'flex-end',
          height: '220px',
          padding: '16px 0 10px 0',
          borderBottom: '1px solid #e2e8f0'
        }}>
          {hourly_distribution.map((h) => {
            const val = metricMode === 'orders' ? (h.orders_count || 0) : (h.gross_sales || 0);
            const heightPct = maxHourlyVal > 0 ? Math.max(8, Math.round((val / maxHourlyVal) * 100)) : 8;
            const isHovered = hoveredHour === h.hour;

            let barColor = '#94a3b8';
            if (h.is_peak) {
              barColor = '#f59e0b'; // Gold / Amber
            } else if (h.is_secondary_peak) {
              barColor = '#10b981'; // Emerald
            } else if (h.activity_tier === 'high' || h.activity_tier === 'peak') {
              barColor = '#3b82f6'; // Blue
            } else if (h.activity_tier === 'moderate') {
              barColor = '#60a5fa'; // Light Blue
            } else {
              barColor = '#cbd5e1'; // Slate
            }

            return (
              <div
                key={h.hour}
                onMouseEnter={() => setHoveredHour(h.hour)}
                onMouseLeave={() => setHoveredHour(null)}
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                {/* Tooltip on hover */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    marginBottom: '8px',
                    background: '#0f172a',
                    color: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    zIndex: 20,
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                    pointerEvents: 'none'
                  }}>
                    <div style={{ fontWeight: '700', marginBottom: '2px', color: '#93c5fd' }}>{h.hour_label}</div>
                    <div>Số đơn: <strong>{formatNumber(h.orders_count)}</strong> ({h.order_share_pct}%)</div>
                    <div>Doanh số: <strong>{formatVND(h.gross_sales)}</strong></div>
                    {h.is_peak && <div style={{ color: '#fbbf24', fontWeight: '700', marginTop: '2px' }}>⭐ Đỉnh cao nhất (Tối)</div>}
                    {h.is_secondary_peak && <div style={{ color: '#34d399', fontWeight: '700', marginTop: '2px' }}>☀️ Đỉnh buổi trưa</div>}
                  </div>
                )}

                {/* Percentage label on top of bar */}
                <div style={{
                  fontSize: '9px',
                  fontWeight: '700',
                  color: isHovered ? '#0f172a' : '#64748b',
                  marginBottom: '4px'
                }}>
                  {h.order_share_pct > 0 ? `${h.order_share_pct}%` : ''}
                </div>

                {/* The Bar */}
                <div style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  background: isHovered ? '#1d4ed8' : barColor,
                  borderRadius: '4px 4px 1px 1px',
                  transition: 'all 0.15s ease',
                  boxShadow: isHovered ? '0 0 8px rgba(37,99,235,0.4)' : 'none'
                }}></div>
              </div>
            );
          })}
        </div>

        {/* Hour labels (00h -> 23h) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(24, 1fr)',
          gap: '6px',
          paddingTop: '8px',
          textAlign: 'center'
        }}>
          {hourly_distribution.map((h) => (
            <div
              key={h.hour}
              style={{
                fontSize: '10px',
                fontWeight: (h.is_peak || h.is_secondary_peak) ? '800' : '500',
                color: (h.is_peak ? '#d97706' : (h.is_secondary_peak ? '#059669' : '#64748b'))
              }}
            >
              {h.short_label}
            </div>
          ))}
        </div>
      </div>

      {/* 4. 7x24 Day x Hour Heatmap & Top Slots Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '20px' }}>
        {/* Heatmap 7x24 */}
        <div style={{
          background: '#ffffff',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          overflowX: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                Ma Trận Nhiệt 7 Ngày x 24 Giờ (Heatmap)
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Mật độ đơn hàng theo từng khung giờ trong tuần
              </div>
            </div>
          </div>

          <div style={{ minWidth: '550px' }}>
            {/* Header row: 24 hour columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(24, 1fr)', gap: '3px', marginBottom: '4px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>NGÀY</div>
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} style={{ fontSize: '9px', color: '#94a3b8', textAlign: 'center', fontWeight: '600' }}>
                  {i}
                </div>
              ))}
            </div>

            {/* 7 Days rows */}
            {day_names.map((dayName, d) => (
              <div
                key={d}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px repeat(24, 1fr)',
                  gap: '3px',
                  marginBottom: '3px',
                  alignItems: 'center'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#334155' }}>
                  {dayName}
                </div>
                {Array.from({ length: 24 }, (_, h) => {
                  const cell = matrix[d]?.[h] || { orders_count: 0, gross_sales: 0 };
                  const val = metricMode === 'orders' ? cell.orders_count : cell.gross_sales;
                  const intensity = maxMatrixVal > 0 ? (val / maxMatrixVal) : 0;

                  // Color gradient from white/light blue to dark blue/purple
                  let cellBg = '#f8fafc';
                  if (intensity > 0.75) cellBg = '#1d4ed8'; // Deep blue
                  else if (intensity > 0.50) cellBg = '#3b82f6';
                  else if (intensity > 0.25) cellBg = '#93c5fd';
                  else if (intensity > 0.05) cellBg = '#dbeafe';

                  const isCellHovered = hoveredCell && hoveredCell.d === d && hoveredCell.h === h;

                  return (
                    <div
                      key={h}
                      onMouseEnter={() => setHoveredCell({ d, h, cell, dayName })}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        height: '24px',
                        background: isCellHovered ? '#f59e0b' : cellBg,
                        borderRadius: '3px',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                        border: isCellHovered ? '1px solid #b45309' : '1px solid rgba(0,0,0,0.02)'
                      }}
                    ></div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Cell hover details */}
          <div style={{ marginTop: '16px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px', color: '#334155', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {hoveredCell ? (
              <>
                <div>
                  <strong>{hoveredCell.dayName}</strong>, khung <strong>{sprintfHour(hoveredCell.h)}</strong>:
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span>Số đơn: <strong style={{ color: '#2563eb' }}>{formatNumber(hoveredCell.cell.orders_count)}</strong></span>
                  <span>Doanh thu: <strong style={{ color: '#059669' }}>{formatVND(hoveredCell.cell.gross_sales)}</strong></span>
                </div>
              </>
            ) : (
              <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Rê chuột lên các ô trên ma trận để xem số liệu chi tiết</span>
            )}
          </div>
        </div>

        {/* Top 5 Golden Slots & Day Rankings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top 5 Slots */}
          <div style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Award size={18} color="#d97706" />
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Top 5 Khung Giờ Đỉnh Nhất</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {top_golden_slots.map((slot, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: idx === 0 ? '#fffbeb' : '#f8fafc',
                    border: idx === 0 ? '1px solid #fde68a' : '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: idx === 0 ? '#f59e0b' : '#cbd5e1',
                      color: idx === 0 ? '#ffffff' : '#334155',
                      fontWeight: '800',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                        {slot.day_name} • {slot.hour_label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {formatNumber(slot.orders_count)} đơn hàng
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#059669' }}>
                    {formatVND(slot.gross_sales)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Day of Week Rankings */}
          <div style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BarChart2 size={18} color="#2563eb" />
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Xếp Hạng Ngày Trong Tuần</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {day_rankings.map((day, idx) => (
                <div
                  key={day.dow}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    padding: '6px 8px',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '700', color: idx === 0 ? '#2563eb' : '#64748b', width: '16px' }}>#{idx + 1}</span>
                    <span style={{ fontWeight: '600', color: '#1e293b' }}>{day.day_name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: '#64748b' }}>{formatNumber(day.orders_count)} đơn</span>
                    <strong style={{ color: '#0f172a' }}>{formatVND(day.gross_sales)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function sprintfHour(h) {
  const hPad = String(h).padStart(2, '0');
  return `${hPad}:00 - ${hPad}:59`;
}
