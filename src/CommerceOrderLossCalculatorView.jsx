import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Calculator,
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Sliders,
  DollarSign,
  Tag
} from 'lucide-react';

export default function CommerceOrderLossCalculatorView({
  shopId = '7495657895504611503',
  startDate,
  endDate,
  apiRequest
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [targetRealRoiInput, setTargetRealRoiInput] = useState(8.0);

  const fetchDeepdiveAnalytics = useCallback(async () => {
    if (!apiRequest) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(
        `commerce_dashboard.php?action=get_order_deepdive_analytics&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`
      );
      if (res && res.success && res.data) {
        setData(res.data);
      } else {
        setError(res?.message || 'Không thể tải phân tích đơn hàng và hoàn hủy.');
      }
    } catch (err) {
      setError(err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  useEffect(() => {
    fetchDeepdiveAnalytics();
  }, [fetchDeepdiveAnalytics]);

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  };

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
        <RefreshCw size={28} className="spin" style={{ color: '#2563eb', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>Đang phân tích hao hụt hoàn hủy & tính toán Target ROAS...</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Đối soát đơn hàng, phí ship 2 chiều RTS & tỷ lệ thực nhận</div>
      </div>
    );
  }

  const {
    kpis = {},
    status_distribution = {},
    who_cancelled = {},
    top_cancelled_products = [],
    roi_calculator = {}
  } = data || {};

  const currentLossRate = kpis.loss_rate_pct || 0;
  const currentRealizedRatio = kpis.realized_ratio_pct > 0 ? (kpis.realized_ratio_pct / 100) : 0.8;
  const computedTargetAdsRoas = currentRealizedRatio > 0 ? (targetRealRoiInput / currentRealizedRatio).toFixed(2) : '0.00';
  const bufferPoints = (Number(computedTargetAdsRoas) - targetRealRoiInput).toFixed(2);

  const statusTotalOrders = (status_distribution.successful?.count || 0) +
    (status_distribution.in_transit?.count || 0) +
    (status_distribution.cancelled?.count || 0) +
    (status_distribution.return_refund?.count || 0);

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
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626'
          }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Thống Kê Đơn Hàng & Tính ROI Hoàn Hủy
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Đối soát hao hụt, ước tính phí ship 2 chiều RTS & công thức tính Target ROAS bù trừ hoàn hủy
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchDeepdiveAnalytics}
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

      {/* 2. 5 Core KPIs Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Tổng Đơn Hàng</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {formatNumber(kpis.total_orders)} đơn
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Ghi nhận trong kỳ</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Doanh Thu Gộp (Gross)</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {formatVND(kpis.gross_gmv)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Tổng giá trị đơn tạo</div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: '11px', color: '#059669', textTransform: 'uppercase', fontWeight: '700' }}>Doanh Thu Thực Nhận</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
            {formatVND(kpis.realized_gmv)}
          </div>
          <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: '600' }}>
            Tỷ lệ thực nhận: {kpis.realized_ratio_pct}%
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #fecaca' }}>
          <div style={{ fontSize: '11px', color: '#dc2626', textTransform: 'uppercase', fontWeight: '700' }}>Tỷ Lệ Thất Thoát Hoàn Hủy</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626', marginTop: '4px' }}>
            {kpis.loss_rate_pct}%
          </div>
          <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '600' }}>
            Mất: -{formatVND(kpis.total_loss_amount)}
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: '11px', color: '#ea580c', textTransform: 'uppercase', fontWeight: '700' }}>Thiệt Hại Ship 2 Chiều RTS</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#ea580c', marginTop: '4px' }}>
            -{formatVND(kpis.rts_shipping_loss_estimate)}
          </div>
          <div style={{ fontSize: '11px', color: '#ea580c', marginTop: '4px' }}>
            Ước tính phí cước gửi + trả hàng
          </div>
        </div>
      </div>

      {/* 3. Order Status Distribution Bar */}
      <div style={{
        background: '#ffffff',
        padding: '20px 24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
          Tỷ Lệ Trạng Thái Đơn Hàng (Status Distribution)
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
          Phân bố đơn hàng theo vòng đời giao nhận
        </div>

        {/* Multi-segmented bar */}
        <div style={{
          height: '24px',
          width: '100%',
          display: 'flex',
          borderRadius: '6px',
          overflow: 'hidden',
          marginBottom: '16px',
          background: '#f1f5f9'
        }}>
          {status_distribution.successful?.pct > 0 && (
            <div style={{ width: `${status_distribution.successful.pct}%`, background: '#10b981', title: 'Thành công' }}></div>
          )}
          {status_distribution.in_transit?.pct > 0 && (
            <div style={{ width: `${status_distribution.in_transit.pct}%`, background: '#3b82f6', title: 'Đang giao' }}></div>
          )}
          {status_distribution.cancelled?.pct > 0 && (
            <div style={{ width: `${status_distribution.cancelled.pct}%`, background: '#ef4444', title: 'Đã hủy' }}></div>
          )}
          {status_distribution.return_refund?.pct > 0 && (
            <div style={{ width: `${status_distribution.return_refund.pct}%`, background: '#f59e0b', title: 'Hoàn trả' }}></div>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></span>
            <span>Đã giao thành công: <strong>{formatNumber(status_distribution.successful?.count || 0)} ({status_distribution.successful?.pct || 0}%)</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '3px' }}></span>
            <span>Đang vận chuyển: <strong>{formatNumber(status_distribution.in_transit?.count || 0)} ({status_distribution.in_transit?.pct || 0}%)</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></span>
            <span>Đã hủy: <strong>{formatNumber(status_distribution.cancelled?.count || 0)} ({status_distribution.cancelled?.pct || 0}%)</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></span>
            <span>Trả hàng / Hoàn tiền: <strong>{formatNumber(status_distribution.return_refund?.count || 0)} ({status_distribution.return_refund?.pct || 0}%)</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Interactive Loss-Adjusted ROI Calculator Widget */}
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid #cbd5e1',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: '800', fontSize: '16px', marginBottom: '4px' }}>
          <Calculator size={20} color="#2563eb" />
          <span>Công Thức Tính Target Ads ROAS Bù Trừ Hoàn Hủy</span>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
          Khi chạy TikTok Ads, doanh thu báo cáo trên Ads Manager là doanh thu gộp (Gross GMV). Sau hoàn hủy, doanh thu thực nhận bị hao hụt. Công thức sau tính chính xác ROAS cần đạt trên Ads Manager để bảo vệ lợi nhuận ròng.
        </div>

        {/* The Formula & Live Input */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          alignItems: 'center',
          background: '#ffffff',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
              Mục Tiêu ROI Thực Tế Bạn Muốn Nhận (Target Real ROI):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="number"
                step="0.5"
                min="1"
                max="50"
                value={targetRealRoiInput}
                onChange={(e) => setTargetRealRoiInput(parseFloat(e.target.value) || 1)}
                style={{
                  width: '120px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '2px solid #2563eb',
                  fontSize: '16px',
                  fontWeight: '800',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#64748b' }}>x (Lần chi phí)</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              Tỷ lệ thực nhận hiện tại của shop: <strong>{kpis.realized_ratio_pct}%</strong> (Thất thoát {kpis.loss_rate_pct}%)
            </div>
          </div>

          <div style={{
            background: '#eff6ff',
            padding: '16px 20px',
            borderRadius: '10px',
            border: '1px solid #bfdbfe'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase' }}>
              Target Ads ROAS Cần Đạt Trên TikTok Ads
            </div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#1d4ed8', marginTop: '4px' }}>
              {computedTargetAdsRoas}x
            </div>
            <div style={{ fontSize: '12px', color: '#1e40af', marginTop: '4px' }}>
              Phải đạt ROAS ≥ {computedTargetAdsRoas}x trên Ads Manager (cần đệm thêm +{bufferPoints} điểm ROAS để bù {kpis.loss_rate_pct}% đơn hủy)
            </div>
          </div>
        </div>

        {/* Multi-Scenario Simulation Table */}
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '10px' }}>
          Bảng Tra Cứu Target Ads ROAS Theo Từng Mốc Lợi Nhuận:
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Mục Tiêu ROI Thực Nhận</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Tỷ Lệ Thực Nhận Shop</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: '#2563eb' }}>Target Ads ROAS Cần Đạt</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Đệm Bù Đơn Hủy</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Ý Nghĩa Thực Tế</th>
              </tr>
            </thead>
            <tbody>
              {(roi_calculator.simulation || []).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: '800', color: '#0f172a' }}>
                    {row.target_real_roi}.0x
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>
                    {kpis.realized_ratio_pct}%
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: '800', color: '#2563eb', fontSize: '13px' }}>
                    {row.required_ads_roas}x
                  </td>
                  <td style={{ padding: '10px 14px', color: '#dc2626', fontWeight: '600' }}>
                    +{row.buffer_points}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#334155' }}>
                    {row.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Who Cancelled & Top Cancelled Products Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Who Cancelled */}
        <div style={{
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
            Ai Hủy Đơn Hàng? (Cancellation Actor)
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
            Tỷ trọng đơn hủy phân loại theo chủ thể thực hiện
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {['buyer', 'platform', 'seller'].map((key) => {
              const actor = who_cancelled[key] || {};
              return (
                <div
                  key={key}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      {actor.label || key}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#dc2626' }}>
                      {actor.share_pct || 0}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    <span>{formatNumber(actor.count || 0)} đơn hủy</span>
                    <span>Thiệt hại: {formatVND(actor.amount || 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Cancelled Products */}
        <div style={{
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
            Top Sản Phẩm Hoàn Hủy Nhiều Nhất
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
            Các sản phẩm có tỷ lệ hủy cao cần kiểm tra chất lượng đóng gói và tư vấn
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
            {top_cancelled_products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '12px' }}>
                Không có dữ liệu hoàn hủy sản phẩm trong kỳ.
              </div>
            ) : (
              top_cancelled_products.map((prod, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', flex: 1 }}>
                      {prod.product_name}
                    </div>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '800',
                      background: prod.warning_badge === 'BÁO ĐỘNG ĐỎ' ? '#fee2e2' : '#fef3c7',
                      color: prod.warning_badge === 'BÁO ĐỘNG ĐỎ' ? '#991b1b' : '#92400e'
                    }}>
                      {prod.warning_badge}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                    <span>Hủy: <strong style={{ color: '#dc2626' }}>{formatNumber(prod.cancelled_orders_count)}/{formatNumber(prod.total_sold_orders)} đơn</strong> ({prod.cancel_rate_pct}%)</span>
                    <span>Mất: <strong style={{ color: '#dc2626' }}>{formatVND(prod.cancelled_loss_value)}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
