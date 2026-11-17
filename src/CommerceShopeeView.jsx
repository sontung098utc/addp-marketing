import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Download,
  Upload,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Package,
  Sparkles,
  X,
  FileSpreadsheet,
  Layers,
  ArrowUpRight
} from 'lucide-react';

export default function CommerceShopeeView({
  shopId,
  startDate,
  endDate,
  apiRequest,
  formatVND = (v) => `${Number(v || 0).toLocaleString('vi-VN')} ₫`,
  formatNumber = (v) => Number(v || 0).toLocaleString('vi-VN')
}) {
  const [summary, setSummary] = useState(null);
  const [goldenHours, setGoldenHours] = useState(null);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total_records: 0, total_pages: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [error, setError] = useState(null);

  // Import Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileType, setFileType] = useState('orders');
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch Shopee Summary & Golden Hours
  const fetchShopeeOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, ghRes] = await Promise.all([
        apiRequest(`commerce_dashboard.php?action=get_shopee_summary&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`),
        apiRequest(`commerce_dashboard.php?action=get_shopee_golden_hours&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`)
      ]);

      if (sumRes && sumRes.success) {
        setSummary(sumRes.data.summary);
      }
      if (ghRes && ghRes.success) {
        setGoldenHours(ghRes.data);
      }
    } catch (err) {
      console.error('Fetch Shopee overview error:', err);
      setError(err.message || 'Không thể tải số liệu Shopee');
    } finally {
      setIsLoading(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  // Fetch Shopee Orders
  const fetchShopeeOrders = useCallback(async (page = 1) => {
    setIsLoadingOrders(true);
    try {
      let url = `commerce_dashboard.php?action=get_shopee_orders&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=20`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await apiRequest(url);
      if (res && res.success) {
        setOrders(res.data.orders || []);
        setPagination(res.data.pagination || { page, limit: 20, total_records: 0, total_pages: 1 });
      }
    } catch (err) {
      console.error('Fetch Shopee orders error:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [shopId, startDate, endDate, statusFilter, searchQuery, apiRequest]);

  useEffect(() => {
    fetchShopeeOverview();
  }, [fetchShopeeOverview]);

  useEffect(() => {
    fetchShopeeOrders(1);
  }, [fetchShopeeOrders]);

  // Handle Export Shopee Orders CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=export_shopee_orders&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`);
      if (res && res.success && res.data?.csv) {
        const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.data.filename || `shopee_orders_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      alert('Lỗi xuất file CSV Shopee: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Upload Read
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileText(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  // Submit Import
  const handleImportSubmit = async () => {
    if (!fileText.trim()) {
      alert('Vui lòng chọn hoặc dán nội dung file CSV/TXT');
      return;
    }
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await apiRequest('commerce_dashboard.php?action=import_shopee_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          file_type: fileType,
          file_content: fileText,
          filename: fileName || 'shopee_upload.csv'
        })
      });

      if (res && res.success) {
        setImportResult(res.data);
        fetchShopeeOverview();
        fetchShopeeOrders(1);
      } else {
        alert(res?.error?.message || 'Lỗi khi nhập dữ liệu');
      }
    } catch (err) {
      alert('Lỗi nhập dữ liệu Shopee: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const grossSales = summary?.gross_sales || 0;
  const lossAmount = summary?.loss_amount || 0;
  const realizedSales = summary?.realized_sales || 0;
  const orderCount = summary?.order_count || 0;
  const lossRatePct = summary?.loss_rate_pct || 0;
  const topGoldenSlots = goldenHours?.top_golden_slots || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Toolbar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #fed7aa',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(238, 77, 45, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ee4d2d 0%, #f97316 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(238, 77, 45, 0.25)'
          }}>
            <ShoppingBag size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                Kênh Bán Hàng Shopee
              </h2>
              <span style={{
                background: '#ffedd5',
                color: '#c2410c',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                MULTI-CHANNEL
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
              Chuẩn hóa đối soát Shopee & TikTok Shop theo nguyên tắc: <strong style={{ color: '#0f172a' }}>Gross - Loss = Realized</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => { fetchShopeeOverview(); fetchShopeeOrders(pagination.page); }}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            Làm mới
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #fdba74',
              background: '#fff7ed',
              color: '#c2410c',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <Upload size={14} />
            Nhập file Shopee (CSV/Excel)
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#ee4d2d',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(238, 77, 45, 0.25)'
            }}
          >
            <Download size={14} />
            {isExporting ? 'Đang xuất...' : 'Xuất CSV'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#b91c1c',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* 2. 4 Metric KPI Cards (Gross - Loss = Realized) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '16px'
      }}>
        {/* Card 1: Gross Sales */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Doanh Số Gộp Shopee
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#2563eb" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginBottom: '6px' }}>
            {formatVND(grossSales)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Tổng số đơn: <strong style={{ color: '#0f172a' }}>{formatNumber(orderCount)}</strong>
          </div>
        </div>

        {/* Card 2: Loss (Cancelled + Failed + Returns) */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #fed7aa',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(238, 77, 45, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#c2410c', textTransform: 'uppercase' }}>
              Hao Hụt & Hoàn Hủy
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} color="#ea580c" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#c2410c', marginBottom: '6px' }}>
            {formatVND(lossAmount)}
          </div>
          <div style={{ fontSize: '12px', color: '#c2410c' }}>
            Tỷ lệ hao hụt: <strong>{lossRatePct.toFixed(1)}%</strong>
          </div>
        </div>

        {/* Card 3: Realized Sales */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(16, 185, 129, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase' }}>
              Doanh Thu Thực Nhận
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#16a34a" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#15803d', marginBottom: '6px' }}>
            {formatVND(realizedSales)}
          </div>
          <div style={{ fontSize: '12px', color: '#16a34a' }}>
            Chuẩn Gross - Loss = Realized
          </div>
        </div>

        {/* Card 4: Breakdown by reason */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Chi Tiết Hao Hụt Shopee
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={16} color="#64748b" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Hủy trước giao:</span>
              <strong style={{ color: '#475569' }}>{formatVND(summary?.cancelled_amount || 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Giao không thành:</span>
              <strong style={{ color: '#475569' }}>{formatVND(summary?.failed_amount || 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Trả hàng / Hoàn tiền:</span>
              <strong style={{ color: '#c2410c' }}>{formatVND(summary?.return_amount || 0)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Golden Hours Insights (Khung Giờ Vàng Shopee) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={18} color="#ee4d2d" />
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
            Khung Giờ Vàng Shopee (Peak Sales Slots)
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: 'auto' }}>
            Phân tích thời điểm khách chốt đơn cao nhất trên Shopee
          </span>
        </div>

        {topGoldenSlots.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            {topGoldenSlots.map((slot, idx) => (
              <div
                key={idx}
                style={{
                  background: idx === 0 ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)' : '#f8fafc',
                  border: idx === 0 ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: idx === 0 ? '#ea580c' : '#64748b',
                    background: idx === 0 ? '#ffedd5' : '#e2e8f0',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    #{idx + 1}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                    {slot.day_name || `Thứ ${slot.day_of_week + 1}`} - {String(slot.hour_of_day).padStart(2, '0')}:00
                  </span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#ee4d2d' }}>
                  {formatVND(slot.total_gmv)}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {formatNumber(slot.order_count)} đơn hàng
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '13px' }}>
            Chưa đủ dữ liệu giờ đặt hàng để xác định khung giờ vàng Shopee trong kỳ này.
          </div>
        )}
      </div>

      {/* 4. Shopee Orders Table */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Table Filters */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '260px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px 12px',
              width: '100%',
              maxWidth: '340px'
            }}>
              <Search size={16} color="#94a3b8" style={{ marginRight: '8px' }} />
              <input
                type="text"
                placeholder="Tìm mã đơn, người mua..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchShopeeOrders(1); }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '13px',
                  width: '100%',
                  color: '#1e293b'
                }}
              />
            </div>
            <button
              onClick={() => fetchShopeeOrders(1)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f1f5f9',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Tìm
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: '', label: 'Tất cả trạng thái' },
              { id: 'DELIVERED', label: 'Đã giao' },
              { id: 'SHIPPED', label: 'Đang giao' },
              { id: 'UNPAID', label: 'Chờ thanh toán' },
              { id: 'CANCELLED', label: 'Đã hủy' },
              { id: 'RETURN_REFUND', label: 'Trả hàng/Hoàn tiền' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  border: statusFilter === st.id ? '1px solid #ee4d2d' : '1px solid #e2e8f0',
                  background: statusFilter === st.id ? '#fff7ed' : '#ffffff',
                  color: statusFilter === st.id ? '#ea580c' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', background: '#f8fafc' }}>
                <th style={{ padding: '10px 14px', fontWeight: '600' }}>Mã Đơn Shopee</th>
                <th style={{ padding: '10px 14px', fontWeight: '600' }}>Ngày Tạo</th>
                <th style={{ padding: '10px 14px', fontWeight: '600' }}>Trạng Thái</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', textAlign: 'right' }}>Giá Gộp (Gross)</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', textAlign: 'right' }}>Hao Hụt</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', textAlign: 'right' }}>Thực Nhận</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingOrders ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8' }}>
                    <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                    <div>Đang tải danh sách đơn hàng Shopee...</div>
                  </td>
                </tr>
              ) : orders.length > 0 ? (
                orders.map((ord) => {
                  const isCancelled = ord.order_status === 'CANCELLED';
                  const isReturn = ord.order_status === 'RETURN_REFUND' || (ord.loss_amount > 0 && !isCancelled);
                  const isCompleted = ord.order_status === 'DELIVERED' || ord.order_status === 'COMPLETED';

                  let statusBadge = (
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#e2e8f0', color: '#475569' }}>
                      {ord.order_status}
                    </span>
                  );

                  if (isCompleted) {
                    statusBadge = (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#15803d' }}>
                        Hoàn thành
                      </span>
                    );
                  } else if (isCancelled) {
                    statusBadge = (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#fee2e2', color: '#b91c1c' }}>
                        Đã hủy
                      </span>
                    );
                  } else if (isReturn) {
                    statusBadge = (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#ffedd5', color: '#c2410c' }}>
                        Trả hàng/Hoàn tiền
                      </span>
                    );
                  }

                  return (
                    <tr key={ord.order_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{ord.order_id}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Shopee Platform</div>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>
                        {ord.order_create_time ? new Date(ord.order_create_time).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {statusBadge}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#1e293b' }}>
                        {formatVND(ord.order_amount)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: Number(ord.loss_amount || 0) > 0 ? '#c2410c' : '#94a3b8', fontWeight: Number(ord.loss_amount || 0) > 0 ? '700' : 'normal' }}>
                        {Number(ord.loss_amount || 0) > 0 ? `-${formatVND(ord.loss_amount)}` : '0 ₫'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#15803d' }}>
                        {formatVND(ord.realized_amount ?? (ord.order_amount - (ord.loss_amount || 0)))}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8' }}>
                    Chưa có đơn hàng Shopee nào trong kỳ lọc. Nhấn "Nhập file Shopee" để tải lên báo cáo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Trang {pagination.page} / {pagination.total_pages} (Tổng {formatNumber(pagination.total_records)} đơn)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchShopeeOrders(pagination.page - 1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: pagination.page <= 1 ? '#f8fafc' : '#ffffff',
                  color: pagination.page <= 1 ? '#94a3b8' : '#334155',
                  cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ChevronLeft size={14} /> Trước
              </button>
              <button
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => fetchShopeeOrders(pagination.page + 1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: pagination.page >= pagination.total_pages ? '#f8fafc' : '#ffffff',
                  color: pagination.page >= pagination.total_pages ? '#94a3b8' : '#334155',
                  cursor: pagination.page >= pagination.total_pages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Import Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag size={18} color="#ee4d2d" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Nhập Báo Cáo Kênh Shopee
                </h3>
              </div>
              <button
                onClick={() => { setIsModalOpen(false); setImportResult(null); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Loại file Shopee:
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    color: '#1e293b'
                  }}
                >
                  <option value="orders">Báo cáo đơn hàng (Orders Export)</option>
                  <option value="returns">Báo cáo trả hàng / Hoàn tiền (Returns & Refunds)</option>
                  <option value="settlement">Bảng kê quyết toán ví Shopee (Settlement)</option>
                  <option value="cancelled">Báo cáo đơn hàng hủy (Cancelled Orders)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Chọn file từ máy tính (CSV / TXT):
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  style={{ fontSize: '13px', color: '#475569' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Hoặc dán trực tiếp nội dung CSV:
                </label>
                <textarea
                  value={fileText}
                  onChange={(e) => setFileText(e.target.value)}
                  placeholder="Dán nội dung bảng xuất từ Kênh Người Bán Shopee..."
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {importResult && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: '13px'
                }}>
                  <div style={{ fontWeight: '700', marginBottom: '4px' }}>Nhập dữ liệu thành công!</div>
                  <div>• Đã ghi nhận: {importResult.imported ?? importResult.processed ?? 0} dòng</div>
                  {importResult.skipped !== undefined && <div>• Đã bỏ qua: {importResult.skipped} dòng</div>}
                </div>
              )}
            </div>

            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#f8fafc'
            }}>
              <button
                onClick={() => { setIsModalOpen(false); setImportResult(null); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
              <button
                onClick={handleImportSubmit}
                disabled={isImporting || !fileText.trim()}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ee4d2d',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isImporting || !fileText.trim() ? 'not-allowed' : 'pointer',
                  opacity: isImporting || !fileText.trim() ? 0.7 : 1
                }}
              >
                {isImporting ? 'Đang xử lý...' : 'Bắt đầu nạp dữ liệu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
