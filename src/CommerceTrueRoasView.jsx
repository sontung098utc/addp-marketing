import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldAlert,
  DollarSign,
  BarChart3,
  Search,
  Save,
  Info,
  Layers
} from 'lucide-react';

export default function CommerceTrueRoasView({
  shopId = '7495657895504611503',
  apiRequest,
  startDate,
  endDate
}) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('sku'); // 'sku' | 'daily' | 'inventory'
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMissingCogs, setOnlyMissingCogs] = useState(false);
  const [stockDrafts, setStockDrafts] = useState({});
  const [savingStockKey, setSavingStockKey] = useState(null);
  const [stockFeedback, setStockFeedback] = useState(null);

  const fetchReport = useCallback(async () => {
    if (!apiRequest) return;
    setLoading(true);
    setError(null);
    try {
      const url = `commerce_true_roas_service.php?action=get_true_roas_report&shop_id=${encodeURIComponent(shopId)}&start_date=${encodeURIComponent(startDate || '')}&end_date=${encodeURIComponent(endDate || '')}`;
      const res = await apiRequest(url);
      if (res && res.success && res.data) {
        setReport(res.data);
        const initialDrafts = {};
        (res.data.inventory_alerts?.items || []).forEach((item) => {
          const key = `${item.product_id}:${item.sku_id}`;
          initialDrafts[key] = item.current_stock !== null && item.current_stock !== undefined ? String(item.current_stock) : '';
        });
        setStockDrafts(initialDrafts);
      } else {
        setError(res?.message || 'Không thể tải báo cáo Lãi Thực Tế sau trừ hết chi phí.');
      }
    } catch (err) {
      setError(err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSaveStock = async (item) => {
    if (!apiRequest) return;
    const key = `${item.product_id}:${item.sku_id}`;
    const rawVal = stockDrafts[key];
    const parsed = parseInt(rawVal, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setStockFeedback({ type: 'error', message: 'Vui lòng nhập số lượng tồn kho hợp lệ (>= 0).' });
      return;
    }

    setSavingStockKey(key);
    setStockFeedback(null);
    try {
      const res = await apiRequest('commerce_true_roas_service.php?action=update_sku_stock', 'POST', {
        shop_id: shopId,
        product_id: item.product_id,
        sku_id: item.sku_id,
        stock_quantity: parsed
      });
      if (res && res.success) {
        setStockFeedback({ type: 'success', message: `Đã cập nhật tồn kho ${item.sku_id || item.product_id}: ${parsed} sản phẩm.` });
        await fetchReport();
      } else {
        setStockFeedback({ type: 'error', message: res?.message || 'Không thể cập nhật tồn kho.' });
      }
    } catch (err) {
      setStockFeedback({ type: 'error', message: err?.message || 'Lỗi lưu tồn kho.' });
    } finally {
      setSavingStockKey(null);
    }
  };

  const formatVND = (num) => {
    if (num === null || num === undefined) return '—';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(num);
  };

  const formatNumber = (num, decimals = 0) => {
    if (num === null || num === undefined) return '—';
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: decimals }).format(num);
  };

  const formatRatio = (val) => {
    if (val === null || val === undefined) return '—';
    return `${Number(val).toFixed(2)} lần`;
  };

  const summary = report?.summary || {};
  const reconciliation = report?.reconciliation || {};
  const dataQuality = report?.data_quality || {};
  const skuBreakdown = report?.sku_breakdown || [];
  const dailySeries = report?.daily_series || [];
  const inventoryAlerts = report?.inventory_alerts || { counts: {}, items: [] };

  const filteredSkus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return skuBreakdown.filter((sku) => {
      if (onlyMissingCogs && sku.cogs_status !== 'INSUFFICIENT_DATA') return false;
      if (!q) return true;
      return (
        (sku.product_name || '').toLowerCase().includes(q) ||
        (sku.sku_name || '').toLowerCase().includes(q) ||
        (sku.sku_id || '').toLowerCase().includes(q) ||
        (sku.product_id || '').toLowerCase().includes(q)
      );
    });
  }, [skuBreakdown, searchQuery, onlyMissingCogs]);

  const criticalInventoryItems = useMemo(() => {
    return (inventoryAlerts.items || []).filter((i) => i.alert_level === 'CRITICAL');
  }, [inventoryAlerts]);

  if (loading && !report) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
        <RefreshCw size={28} className="spin" style={{ color: '#2563eb', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Đang tính Lãi Thực Tế sau trừ hết chi phí &amp; kiểm tra tồn kho...</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
          Tổng hợp Doanh số thực thu, Tiền quảng cáo, Hoa hồng tiếp thị, Phí sàn, Giá vốn nhập hàng &amp; Số ngày còn hàng
        </div>
      </div>
    );
  }

  const renderReconciliationBadge = () => {
    const status = reconciliation.status;
    if (status === 'RECONCILED') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', background: '#dcfce7', color: '#15803d', fontSize: '12px', fontWeight: '700' }}>
          <CheckCircle2 size={14} />
          Khớp số liệu ({reconciliation.variance_pct ?? 0}% ≤ 0.5%)
        </span>
      );
    }
    if (status === 'VARIANCE_ALERT') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', background: '#fee2e2', color: '#b91c1c', fontSize: '12px', fontWeight: '700' }}>
          <XCircle size={14} />
          Cảnh báo lệch số liệu ({reconciliation.variance_pct ?? '—'}% &gt; 0.5%)
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', background: '#f1f5f9', color: '#475569', fontSize: '12px', fontWeight: '600' }}>
        <Info size={14} />
        Chưa có dữ liệu đối soát ví tiền
      </span>
    );
  };

  const getInventoryLabel = (alertLevel) => {
    if (alertLevel === 'CRITICAL') return 'Nguy cơ hết hàng';
    if (alertLevel === 'WARNING') return 'Sắp hết';
    if (alertLevel === 'HEALTHY') return 'An toàn';
    return 'Chưa nhập tồn kho';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BarChart3 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Lãi Thực Tế Sau Trừ Hết Chi Phí &amp; Cảnh Báo Tồn Kho &lt; 3 Ngày
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Đối soát số liệu thực tế 100% • Kỳ dữ liệu: <strong>{startDate}</strong> → <strong>{endDate}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {renderReconciliationBadge()}
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#334155',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', fontWeight: '600' }}>
          {error}
        </div>
      )}

      {/* 2. Critical <3-Day Inventory & Missing COGS Banners */}
      {criticalInventoryItems.length > 0 && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', fontSize: '13px', fontWeight: '700' }}>
            <ShieldAlert size={18} />
            <span>
              Nguy cơ hết hàng (&lt; 3 ngày còn hàng): Có <strong>{criticalInventoryItems.length}</strong> mã hàng sắp hết trước khi chạy quảng cáo!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Xem danh sách &lt; 3 ngày
          </button>
        </div>
      )}

      {dataQuality.status === 'INSUFFICIENT_DATA' && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '12px',
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          color: '#92400e',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>
              <strong>Chưa nhập giá vốn:</strong> Có <strong>{dataQuality.missing_cogs_skus}</strong> mã hàng chưa nhập Giá vốn nhập hàng. Lãi Thực Tế hiện tại chưa trừ giá vốn các mã này.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('sku');
              setOnlyMissingCogs((prev) => !prev);
            }}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              background: onlyMissingCogs ? '#b45309' : '#fef3c7',
              color: onlyMissingCogs ? '#ffffff' : '#92400e',
              border: '1px solid #f59e0b',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {onlyMissingCogs ? 'Hiện tất cả sản phẩm' : 'Lọc sản phẩm chưa nhập giá vốn'}
          </button>
        </div>
      )}

      {/* 3. Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1 */}
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Lãi Thực Tế vs Hiệu quả thu/chi Quảng cáo</span>
            <TrendingUp size={15} color="#2563eb" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>{formatRatio(summary.true_roas)}</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
              (Quảng cáo: {formatRatio(summary.ads_roas)})
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
            Doanh số thực thu / (Quảng cáo + Tiếp thị + Phí sàn + Hoàn hủy)
          </div>
        </div>

        {/* Card 2 */}
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Doanh số thực thu</span>
            <Layers size={15} color="#0284c7" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '8px' }}>
            {formatVND(summary.net_gmv)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
            Doanh số gộp: {formatVND(summary.gross_gmv)} • Hủy/Hoàn: <span style={{ color: '#dc2626', fontWeight: '600' }}>-{formatVND(summary.cancelled_returned_gmv)}</span>
          </div>
        </div>

        {/* Card 3 */}
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Lãi Thực Tế sau trừ hết chi phí</span>
            <DollarSign size={15} color={summary.net_contribution_profit >= 0 ? '#16a34a' : '#dc2626'} />
          </div>
          <div style={{
            fontSize: '22px',
            fontWeight: '800',
            color: (summary.net_contribution_profit || 0) >= 0 ? '#15803d' : '#dc2626',
            marginTop: '8px'
          }}>
            {formatVND(summary.net_contribution_profit)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
            Tỷ suất lãi: <strong>{summary.net_profit_margin_pct !== null && summary.net_profit_margin_pct !== undefined ? `${summary.net_profit_margin_pct}%` : '—'}</strong> • Giá vốn nhập hàng: {formatVND(summary.product_cogs)}
          </div>
        </div>

        {/* Card 4 */}
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Đối soát tiền về ví (Ngưỡng &lt; 0.5%)</span>
            {reconciliation.is_within_threshold ? <CheckCircle2 size={15} color="#16a34a" /> : <AlertTriangle size={15} color="#d97706" />}
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '8px' }}>
            {reconciliation.variance_pct !== null && reconciliation.variance_pct !== undefined ? `${reconciliation.variance_pct}%` : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
            Tiền về ví: {formatVND(reconciliation.wallet_settlement_amount)} vs Dự kiến: {formatVND(reconciliation.expected_order_settlement_amount)}
          </div>
        </div>
      </div>

      {/* 4. Cost Breakdown Bar */}
      <div style={{
        background: '#ffffff',
        padding: '14px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Tiền quảng cáo</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{formatVND(summary.ads_spend)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Hoa hồng tiếp thị</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{formatVND(summary.affiliate_cost)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Phí sàn &amp; Thanh toán</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{formatVND(summary.platform_fees)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Phí vận chuyển ròng</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{formatVND(summary.shipping_fees)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Giá vốn nhập hàng</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{formatVND(summary.product_cogs)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Hao hụt hoàn trả / giao thất bại</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#dc2626' }}>{formatVND(summary.loss_rma_cost)}</div>
        </div>
      </div>

      {/* 5. Tabs */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'sku', label: `Lãi Thực Tế theo sản phẩm (${skuBreakdown.length})` },
              {
                id: 'inventory',
                label: `Cảnh báo Tồn kho < 3 ngày (${inventoryAlerts.counts?.critical || 0} Nguy cơ hết hàng)`
              },
              { id: 'daily', label: `Theo dõi từng ngày (${dailySeries.length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: activeTab === tab.id ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  background: activeTab === tab.id ? '#2563eb' : '#ffffff',
                  color: activeTab === tab.id ? '#ffffff' : '#334155',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'sku' && (
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên sản phẩm, mã hàng..."
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </div>
          )}
        </div>

        {/* Tab 1: Per-SKU P&L */}
        {activeTab === 'sku' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px' }}>Sản phẩm / Phân loại</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>SL bán ròng</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Doanh số gộp</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Hủy / Hoàn trả</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Doanh số thực thu</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Tiền quảng cáo</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Hoa hồng tiếp thị</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Phí sàn + Ship</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Giá vốn nhập hàng</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Lãi Thực Tế</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Thu/Chi Thực vs QC</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkus.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      Không có dữ liệu sản phẩm trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  filteredSkus.map((sku) => (
                    <tr key={`${sku.product_id}:${sku.sku_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', maxWidth: '240px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sku.product_name || sku.product_id}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {sku.sku_name ? `${sku.sku_name} • ` : ''}Mã: {sku.sku_id || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>
                        {formatNumber(sku.net_units)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND(sku.gross_gmv)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>
                        {sku.cancelled_returned_gmv > 0 ? `-${formatVND(sku.cancelled_returned_gmv)}` : '0 ₫'}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>{formatVND(sku.net_gmv)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND(sku.ads_spend)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND(sku.affiliate_cost)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND((sku.platform_fees || 0) + (sku.shipping_fees || 0))}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {sku.cogs_status === 'INSUFFICIENT_DATA' ? (
                          <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontSize: '10px', fontWeight: '700' }}>
                            Chưa nhập giá vốn
                          </span>
                        ) : (
                          formatVND(sku.product_cogs)
                        )}
                      </td>
                      <td style={{
                        padding: '10px',
                        textAlign: 'right',
                        fontWeight: '800',
                        color: (sku.net_contribution_profit || 0) >= 0 ? '#15803d' : '#dc2626'
                      }}>
                        <div>{formatVND(sku.net_contribution_profit)}</div>
                        <div style={{ fontSize: '10px', fontWeight: '600', color: '#64748b' }}>
                          {sku.net_profit_margin_pct !== null ? `${sku.net_profit_margin_pct}%` : '—'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', color: '#0f172a' }}>{formatRatio(sku.true_roas)}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Quảng cáo: {formatRatio(sku.ads_roas)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: < 3-Day Inventory Safety Alert Panel */}
        {activeTab === 'inventory' && (
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: '700' }}>
                  Nguy cơ hết hàng (&lt; 3 ngày): {inventoryAlerts.counts?.critical || 0}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: '700' }}>
                  Sắp hết (3-7 ngày): {inventoryAlerts.counts?.warning || 0}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '700' }}>
                  An toàn (≥ 7 ngày): {inventoryAlerts.counts?.healthy || 0}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '600' }}>
                  Chưa nhập tồn kho: {inventoryAlerts.counts?.stock_unconfigured || 0}
                </span>
              </div>
              {stockFeedback && (
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: stockFeedback.type === 'success' ? '#15803d' : '#dc2626'
                }}>
                  {stockFeedback.message}
                </div>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Sản phẩm / Phân loại</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Bán 7 ngày</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>TB/ngày (7 ngày / 14 ngày)</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Tồn kho hiện tại</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Số ngày còn hàng</th>
                    <th style={{ padding: '10px 12px' }}>Trạng thái &amp; Khuyến nghị trước khi chạy Ads</th>
                  </tr>
                </thead>
                <tbody>
                  {(inventoryAlerts.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>
                        Chưa có dữ liệu bán hàng 14 ngày qua để tính tốc độ tiêu thụ.
                      </td>
                    </tr>
                  ) : (
                    (inventoryAlerts.items || []).map((item) => {
                      const key = `${item.product_id}:${item.sku_id}`;
                      const isCritical = item.alert_level === 'CRITICAL';
                      const isWarning = item.alert_level === 'WARNING';
                      const badgeStyle = isCritical
                        ? { background: '#fee2e2', color: '#b91c1c' }
                        : isWarning
                          ? { background: '#fef3c7', color: '#92400e' }
                          : item.alert_level === 'HEALTHY'
                            ? { background: '#dcfce7', color: '#15803d' }
                            : { background: '#f1f5f9', color: '#475569' };

                      return (
                        <tr key={key} style={{ borderBottom: '1px solid #f1f5f9', background: isCritical ? '#fff5f5' : 'transparent' }}>
                          <td style={{ padding: '10px 12px', maxWidth: '240px' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{item.product_name || item.product_id}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{item.sku_name ? `${item.sku_name} • ` : ''}Mã: {item.sku_id || '—'}</div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>
                            {formatNumber(item.units_sold_7d)} sản phẩm
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            <strong>{item.avg_daily_units_7d}</strong> / {item.avg_daily_units_14d}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="0"
                                value={stockDrafts[key] ?? ''}
                                onChange={(e) => setStockDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                                placeholder="Nhập SL"
                                style={{
                                  width: '74px',
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12px',
                                  textAlign: 'right'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveStock(item)}
                                disabled={savingStockKey === key}
                                title="Lưu tồn kho"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #2563eb',
                                  background: '#eff6ff',
                                  color: '#2563eb',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Save size={12} />
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: isCritical ? '#dc2626' : '#0f172a' }}>
                            {item.days_of_cover !== null ? `${item.days_of_cover} ngày` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ ...badgeStyle, padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '800', display: 'inline-block', marginBottom: '4px' }}>
                              {getInventoryLabel(item.alert_level)}
                            </span>
                            <div style={{ fontSize: '11px', color: '#475569' }}>{item.recommendation}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Daily Trend */}
        {activeTab === 'daily' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px' }}>Ngày</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Đơn hàng</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Doanh số gộp</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Hủy / Hoàn trả</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Doanh số thực thu</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Tiền quảng cáo</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Hoa hồng tiếp thị</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Phí sàn + Ship</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Giá vốn nhập hàng</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Lãi Thực Tế</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Thu/Chi Thực vs QC</th>
                </tr>
              </thead>
              <tbody>
                {dailySeries.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      Chưa có dữ liệu theo ngày trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  dailySeries.map((day) => (
                    <tr key={day.date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a' }}>{day.date}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatNumber(day.orders_count)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND(day.gross_gmv)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>
                        {day.cancelled_returned_gmv > 0 ? `-${formatVND(day.cancelled_returned_gmv)}` : '0 ₫'}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>{formatVND(day.net_gmv)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND(day.ads_spend)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND(day.affiliate_cost)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND((day.platform_fees || 0) + (day.shipping_fees || 0))}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{formatVND(day.product_cogs)}</td>
                      <td style={{
                        padding: '10px',
                        textAlign: 'right',
                        fontWeight: '800',
                        color: (day.net_contribution_profit || 0) >= 0 ? '#15803d' : '#dc2626'
                      }}>
                        {formatVND(day.net_contribution_profit)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatRatio(day.true_roas)}</span>
                        <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px' }}>({formatRatio(day.ads_roas)})</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
