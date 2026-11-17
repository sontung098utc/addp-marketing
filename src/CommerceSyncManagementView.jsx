import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Database,
  ArrowRight,
  Layers,
  Activity,
  Zap,
  HelpCircle,
  Play
} from 'lucide-react';

export default function CommerceSyncManagementView({
  shopId = '7495657895504611503',
  apiRequest
}) {
  const [syncHealth, setSyncHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncingDomain, setSyncingDomain] = useState(null);
  const [syncActionMessage, setSyncActionMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('domains'); // 'domains' | 'audit'

  const fetchSyncHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      let res = null;
      if (typeof apiRequest === 'function') {
        try {
          res = await apiRequest(`commerce_sync.php?action=status&shop_id=${encodeURIComponent(shopId)}`);
        } catch (e1) {
          res = await apiRequest(`commerce_dashboard.php?action=get_sync_status&shop_id=${encodeURIComponent(shopId)}`);
        }
      } else {
        const resp = await fetch(`/api/commerce_sync.php?action=status&shop_id=${encodeURIComponent(shopId)}`);
        res = await resp.json();
      }

      if (res && res.success) {
        setSyncHealth(res.data?.health || res.data || {});
      } else if (res && res.data?.domains) {
        setSyncHealth({ domains: res.data.domains });
      }
    } catch (err) {
      console.error('Fetch sync health error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, apiRequest]);

  useEffect(() => {
    fetchSyncHealth();
  }, [fetchSyncHealth]);

  const handleTriggerSync = async (domain = 'all') => {
    setSyncingDomain(domain);
    setSyncActionMessage({
      type: 'info',
      text: domain === 'all'
        ? 'Đang kích hoạt quy trình đồng bộ lũy tiến trên toàn bộ 5 miền dữ liệu...'
        : `Đang đồng bộ dữ liệu miền ${domain}...`
    });

    try {
      let res = null;
      const isCustomerDomain = (domain === 'customer' || domain === 'customers' || domain === 'customer_ingestion');
      const syncModeParam = isCustomerDomain ? '&sync_mode=sync' : '';
      const bodyPayload = isCustomerDomain ? { domain, sync_mode: 'sync' } : { domain };

      if (typeof apiRequest === 'function') {
        try {
          res = await apiRequest(`commerce_sync.php?action=sync&shop_id=${encodeURIComponent(shopId)}&domain=${encodeURIComponent(domain)}${syncModeParam}`, 'POST', bodyPayload);
        } catch (e1) {
          res = await apiRequest(`commerce_dashboard.php?action=trigger_sync&shop_id=${encodeURIComponent(shopId)}&domain=${encodeURIComponent(domain)}${syncModeParam}`, 'POST', bodyPayload);
        }
      } else {
        const resp = await fetch(`/api/commerce_sync.php?action=sync${syncModeParam}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop_id: shopId, ...bodyPayload })
        });
        res = await resp.json();
      }

      const status = res?.data?.status || res?.status || (res?.success ? 'AVAILABLE' : 'ERROR');
      const msg = res?.message || res?.data?.message;

      if (['AVAILABLE', 'COMPLETE', 'COMPLETED', 'SUCCESS'].includes(status)) {
        setSyncActionMessage({
          type: 'success',
          text: domain === 'all'
            ? 'Đã hoàn thành đồng bộ toàn diện tất cả các miền dữ liệu thành công!'
            : (msg || `Đã hoàn thành đồng bộ miền ${domain} thành công!`)
        });
        await fetchSyncHealth();
      } else if (status === 'PARTIAL') {
        setSyncActionMessage({
          type: 'warning',
          text: msg || `Đồng bộ miền ${domain} chỉ hoàn thành một phần (PARTIAL). Một số trang hoặc phụ thuộc chưa hoàn tất.`
        });
        await fetchSyncHealth();
      } else if (status === 'CONFIGURATION_ERROR') {
        setSyncActionMessage({
          type: 'error',
          text: msg || 'Lỗi cấu hình bảo mật: CUSTOMER_IDENTITY_HMAC_KEY chưa được cấu hình hoặc không hợp lệ. Hệ thống áp dụng nguyên tắc fail-closed.'
        });
        await fetchSyncHealth();
      } else if (status === 'DISABLED') {
        setSyncActionMessage({
          type: 'warning',
          text: msg || `Tính năng miền ${domain} đang bị tắt bởi cấu hình môi trường (DISABLED).`
        });
      } else if (status === 'NOT_YET_AVAILABLE') {
        setSyncActionMessage({
          type: 'info',
          text: msg || `Dữ liệu miền ${domain} chưa được TikTok công bố (NOT_YET_AVAILABLE).`
        });
      } else {
        setSyncActionMessage({
          type: 'error',
          text: msg || `Lỗi đồng bộ miền ${domain} (${status})`
        });
      }
    } catch (err) {
      setSyncActionMessage({
        type: 'error',
        text: err?.message || 'Lỗi kết nối khi gửi yêu cầu đồng bộ'
      });
    } finally {
      setSyncingDomain(null);
    }
  };

  const domains = syncHealth?.domains || {};
  const domainKeys = ['order', 'rma', 'loss', 'ads_campaign', 'finance', 'analytics'];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
      case 'COMPLETE':
      case 'COMPLETED':
        return { label: 'ĐẦY ĐỦ (COMPLETE)', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
      case 'PARTIAL':
        return { label: 'MỘT PHẦN (PARTIAL)', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'DISABLED':
        return { label: 'ĐANG TẮT (DISABLED)', bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' };
      case 'NOT_YET_AVAILABLE':
        return { label: 'CHƯA CÔNG BỐ (NOT_YET_AVAILABLE)', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
      case 'SYNCING':
        return { label: 'ĐANG ĐỒNG BỘ...', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
      case 'ERROR':
      case 'FAILED':
        return { label: 'LỖI (ERROR)', bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' };
      default:
        return { label: status || 'CHƯA RÕ (UNKNOWN)', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
    }
  };

  const formatDateTime = (dtStr) => {
    if (!dtStr) return '—';
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return dtStr;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (e) {
      return dtStr;
    }
  };

  const formatDateOnly = (dStr) => {
    if (!dStr) return '—';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      return dStr;
    } catch (e) {
      return dStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header & Quick Actions */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: '#2563eb',
              color: '#ffffff',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Database size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                Hệ Thống Đồng Bộ Dữ Liệu Tự Động (Central Sync Orchestrator)
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Đồng bộ lũy tiến (Incremental Sync) từ TikTok Shop Open API & TikTok Marketing API v1.3
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchSyncHealth}
            disabled={isLoading}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '8px'
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            {isLoading ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái'}
          </button>

          <button
            type="button"
            onClick={() => handleTriggerSync('all')}
            disabled={syncingDomain !== null}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '8px',
              background: syncingDomain === 'all' ? '#93c5fd' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              cursor: syncingDomain !== null ? 'not-allowed' : 'pointer'
            }}
          >
            <Zap size={14} className={syncingDomain === 'all' ? 'spin' : ''} />
            {syncingDomain === 'all' ? 'Đang đồng bộ...' : 'Đồng bộ ngay tất cả miền'}
          </button>
        </div>
      </div>

      {/* 2. System Status Bar (Technical info moved from hero card) */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '12px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>Shop ID: <strong style={{ color: '#0f172a' }}>{shopId}</strong></span>
          <span>Giao thức: <strong style={{ color: '#16a34a' }}>● RESTful API V2 (Chính thức)</strong></span>
          <span>Chiến lược: <strong style={{ color: '#2563eb' }}>Lũy tiến (Incremental + HOT 3d rolling)</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#64748b' }}>Đường ống active:</span>
          {domainKeys.map((dk) => {
            const d = domains[dk] || {};
            const isAvail = d.status === 'AVAILABLE' || d.status === 'COMPLETE';
            return (
              <span
                key={dk}
                style={{
                  background: isAvail ? '#dcfce7' : '#f1f5f9',
                  color: isAvail ? '#15803d' : '#64748b',
                  border: `1px solid ${isAvail ? '#bbf7d0' : '#cbd5e1'}`,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '700',
                  textTransform: 'uppercase'
                }}
              >
                {dk}
              </span>
            );
          })}
        </div>
      </div>

      {/* 3. Action Alert Message */}
      {syncActionMessage && (
        <div style={{
          background: syncActionMessage.type === 'success' ? '#f0fdf4' : syncActionMessage.type === 'error' ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${syncActionMessage.type === 'success' ? '#bbf7d0' : syncActionMessage.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
          borderRadius: '10px',
          padding: '12px 16px',
          color: syncActionMessage.type === 'success' ? '#15803d' : syncActionMessage.type === 'error' ? '#b91c1c' : '#1d4ed8',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>{syncActionMessage.text}</div>
          <button
            type="button"
            onClick={() => setSyncActionMessage(null)}
            style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. Domain Sync Matrix Table (Section A9) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
            Bảng Quản Trị Trạng Thái Đồng Bộ Từng Miền Dữ Liệu
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            6 miền tác vụ độc lập • Lưu trữ có kiểm chứng trong commerce_sync_runs
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '12px' }}>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Miền Dữ Liệu</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Lần Đồng Bộ Cuối</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Ngày Dữ Liệu Mới Nhất</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Khả Dụng Sàn</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Trạng Thái</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Số Bản Ghi</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Lỗi Gần Nhất</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {domainKeys.map((dk) => {
                const dom = domains[dk] || {};
                const label = dom.label || dom.name || dk;
                const statusBadge = getStatusBadge(dom.status);
                const isSyncing = syncingDomain === dk;
                const hasError = dom.status === 'ERROR' || dom.status === 'FAILED' || !!dom.last_error;

                return (
                  <tr key={dk} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                    {/* Domain */}
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0f172a' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{label}</span>
                        <code style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>{dk}</code>
                      </div>
                    </td>

                    {/* Last Sync */}
                    <td style={{ padding: '14px 16px', color: '#475569', fontSize: '12px' }}>
                      {formatDateTime(dom.last_successful_sync || dom.latest_sync_attempt)}
                    </td>

                    {/* Latest Data Date */}
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0f172a', fontSize: '12px' }}>
                      {dom.latest_data_date ? formatDateOnly(dom.latest_data_date) : '—'}
                    </td>

                    {/* Latest Available Date */}
                    <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                      {dom.latest_available_date ? formatDateOnly(dom.latest_available_date) : '—'}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: statusBadge.bg,
                        color: statusBadge.color,
                        border: `1px solid ${statusBadge.border}`,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        display: 'inline-block'
                      }}>
                        {statusBadge.label}
                      </span>
                    </td>

                    {/* Records */}
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                      {Number(dom.records_count || 0).toLocaleString('vi-VN')}
                    </td>

                    {/* Last Error */}
                    <td style={{ padding: '14px 16px', color: dom.last_error ? '#b91c1c' : '#94a3b8', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dom.last_error || ''}>
                      {dom.last_error ? dom.last_error : '—'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleTriggerSync(dk)}
                          disabled={isSyncing || syncingDomain !== null}
                          className="btn-secondary"
                          style={{
                            padding: '5px 10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: syncingDomain !== null ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <RefreshCw size={12} className={isSyncing ? 'spin' : ''} />
                          {isSyncing ? 'Đang chạy...' : (hasError ? 'Thử lại' : 'Đồng bộ ngay')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Policy & Latency Documentation Note */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '10px',
        padding: '14px 18px',
        fontSize: '12px',
        color: '#1e40af',
        lineHeight: '1.6'
      }}>
        <div style={{ fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={15} />
          Quy tắc toàn vẹn dữ liệu & Độ trễ sàn (Data Integrity & Latency SLA):
        </div>
        <div>
          • <strong>Đơn hàng & RMA:</strong> Đồng bộ theo cửa sổ cuốn (Rolling Refresh) HOT 3 ngày để tự động cập nhật thay đổi trạng thái (Hủy, Hoàn, Giao).
        </div>
        <div>
          • <strong>Quảng cáo GMV Max:</strong> TikTok Marketing API công bố báo cáo chiến dịch với độ trễ an toàn T-1. Hệ thống không tạo bản ghi 0 nhân tạo khi dữ liệu chưa được công bố.
        </div>
        <div>
          • <strong>Bảo vệ báo cáo:</strong> Màn hình báo cáo kinh doanh luôn đọc từ cơ sở dữ liệu và hiển thị rõ trạng thái bao phủ, không tự động kéo đè lịch sử.
        </div>
      </div>
    </div>
  );
}
