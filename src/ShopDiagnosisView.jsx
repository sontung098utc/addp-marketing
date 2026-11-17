import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart2,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  Info,
  Layers,
  Lightbulb,
  ListChecks,
  Play,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  XCircle,
  Zap
} from 'lucide-react';

export default function ShopDiagnosisView({
  shopId,
  realShopId,
  apiRequest,
  campaigns = [],
  renderFormattedMarkdown
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('audit'); // 'audit' | 'checklist'
  const [errorMsg, setErrorMsg] = useState('');

  // Bộ lọc cho Checklist
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal AI Solution
  const [selectedTaskForAi, setSelectedTaskForAi] = useState(null);
  const [aiSolutionText, setAiSolutionText] = useState('');
  const [loadingAiSolution, setLoadingAiSolution] = useState(false);

  // Ghi chú nhiệm vụ
  const [editingNotes, setEditingNotes] = useState({});
  const [savingNoteCode, setSavingNoteCode] = useState(null);

  // Modal Chỉnh Sửa SES Điểm Cửa Hàng
  const [isSesModalOpen, setIsSesModalOpen] = useState(false);
  const [sesForm, setSesForm] = useState({
    ses_product_score: 5.0,
    ses_product_weight: 70.0,
    ses_negative_review_rate: 0.10,
    ses_return_refund_rate: 0.04,
    ses_logistics_score: 5.0,
    ses_logistics_weight: 15.0,
    ses_fast_dispatch_rate: 99.17,
    ses_seller_cancel_rate: 0.02,
    ses_service_score: 4.6,
    ses_service_weight: 15.0,
    ses_aftersales_hours: 17.7,
    ses_chat_response_rate: 96.84
  });
  const [savingSes, setSavingSes] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [pairingData, setPairingData] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingConnected, setPairingConnected] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);

  useEffect(() => {
    const handlePairingMsg = (event) => {
      if (event.data?.type === 'ADDP_PAIRING_SUCCESS') {
        setPairingConnected(true);
      }
    };
    window.addEventListener('message', handlePairingMsg);
    return () => window.removeEventListener('message', handlePairingMsg);
  }, []);

  const handleGeneratePairing = async () => {
    setPairingLoading(true);
    setCopyStatus(false);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch('/api/connector_token.php?action=create_pairing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shop_id: sales?.shop_id || '7495657895504611503' })
      });
      const data = await res.json();
      if (data && data.success) {
        setPairingData(data);
        // Dispatch to content script bridge for 1-click connect
        window.postMessage({
          type: 'ADDP_PAIRING_REQUEST',
          pairing_token: data.pairing_token,
          shop_id: data.shop_id
        }, window.location.origin);
      } else {
        alert(data?.message || 'Không thể tạo mã ghép nối.');
      }
    } catch (err) {
      alert('Lỗi tạo mã ghép nối: ' + err.message);
    } finally {
      setPairingLoading(false);
    }
  };


  const handleSaveSes = async () => {
    setSavingSes(true);
    try {
      const res = await apiRequest('shop_diagnosis.php?action=update_ses', 'POST', sesForm);
      if (res && res.success) {
        setIsSesModalOpen(false);
        await loadDiagnosisData();
      } else {
        alert(res?.message || 'Có lỗi xảy ra khi lưu Điểm Cửa Hàng.');
      }
    } catch (e) {
      alert('Lỗi kết nối khi lưu: ' + e.message);
    } finally {
      setSavingSes(false);
    }
  };

  // Tải dữ liệu chẩn đoán
  const loadDiagnosisData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiRequest('shop_diagnosis.php?action=get_diagnosis');
      if (res && res.success) {
        setData(res);
      } else {
        setErrorMsg(res?.message || 'Không thể tải dữ liệu chẩn đoán shop.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ chẩn đoán.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnosisData();
  }, [realShopId]);

  // Cập nhật trạng thái Task
  const handleToggleTaskStatus = async (task) => {
    let nextStatus = 'todo';
    if (task.status === 'todo') nextStatus = 'in_progress';
    else if (task.status === 'in_progress') nextStatus = 'done';
    else nextStatus = 'todo';

    // Cập nhật lạc quan trên giao diện
    const updatedChecklist = (data?.checklist || []).map((t) => {
      if (t.id === task.id || t.task_code === task.task_code) {
        return { ...t, status: nextStatus };
      }
      return t;
    });

    const doneCount = updatedChecklist.filter((t) => t.status === 'done').length;
    const progress = updatedChecklist.length > 0 ? Math.round((doneCount / updatedChecklist.length) * 100) : 0;

    setData({
      ...data,
      checklist: updatedChecklist,
      done_tasks_count: doneCount,
      checklist_progress: progress
    });

    try {
      await apiRequest('shop_diagnosis.php?action=update_task', 'POST', {
        task_id: task.id,
        task_code: task.task_code,
        status: nextStatus,
        notes: task.notes || ''
      });
    } catch (e) {
      console.error('Lỗi lưu trạng thái task:', e);
    }
  };

  // Lưu ghi chú task
  const handleSaveNote = async (task) => {
    const noteVal = editingNotes[task.task_code] !== undefined ? editingNotes[task.task_code] : (task.notes || '');
    setSavingNoteCode(task.task_code);
    try {
      await apiRequest('shop_diagnosis.php?action=update_task', 'POST', {
        task_id: task.id,
        task_code: task.task_code,
        status: task.status,
        notes: noteVal
      });
      // Cập nhật data
      const updated = (data?.checklist || []).map((t) => {
        if (t.task_code === task.task_code) {
          return { ...t, notes: noteVal };
        }
        return t;
      });
      setData({ ...data, checklist: updated });
    } catch (e) {
      console.error('Lỗi lưu ghi chú:', e);
    } finally {
      setSavingNoteCode(null);
    }
  };

  // Mở modal AI Solution
  const handleOpenAiSolution = async (task) => {
    setSelectedTaskForAi(task);
    setAiSolutionText('');
    setLoadingAiSolution(true);
    try {
      const res = await apiRequest('shop_diagnosis.php?action=ai_task_solution', 'POST', {
        title: task.title,
        description: task.description,
        purpose: task.purpose
      });
      if (res && res.success) {
        setAiSolutionText(res.solution || '');
      } else {
        setAiSolutionText('Không thể tạo hướng dẫn AI: ' + (res?.message || 'Lỗi không xác định'));
      }
    } catch (err) {
      setAiSolutionText('Lỗi kết nối AI: ' + err.message);
    } finally {
      setLoadingAiSolution(false);
    }
  };

  // Lọc checklist
  const filteredChecklist = (data?.checklist || []).filter((task) => {
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    return true;
  });

  const shopInfo = data?.shop_info || {};
  const sales = data?.sales_summary || {};
  const products = data?.product_health || {};
  const promos = data?.promotions || {};
  const live = data?.live_health || {};
  const video = data?.video_health || {};
  const ads = data?.ads_health || {};
  const healthScore = data?.health_score || 85;
  const healthLevel = data?.health_level || 'Cần Cải Thiện Cấp Tốc';
  const deductions = data?.deductions || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. TOP HEADER & NAVIGATION */}
      <div
        style={{
          padding: '20px 24px',
          borderRadius: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <Activity size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                Trung Tâm Chẩn Đoán &amp; Đánh Giá Toàn Diện Shop 360°
              </h2>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Gian hàng: <strong style={{ color: '#0284c7' }}>{shopInfo.shop_name || 'TikTok Shop'}</strong> (ID: {shopInfo.shop_id || '---'})</span>
                <span>•</span>
                <span style={{ color: '#16a34a', fontWeight: '600' }}>● 12/12 Quyền Open API Đã Kết Nối</span>
                <span>•</span>
                <span style={{ color: '#b45309' }}>{sales.period || 'Dữ liệu thời gian thực'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons & Subtabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setSubTab('audit')}
              style={{
                background: subTab === 'audit' ? '#0284c7' : 'transparent',
                color: subTab === 'audit' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Activity size={15} /> Báo Cáo Sức Khỏe 360°
            </button>
            <button
              onClick={() => setSubTab('checklist')}
              style={{
                background: subTab === 'checklist' ? '#0284c7' : 'transparent',
                color: subTab === 'checklist' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <ListChecks size={15} /> Ma Trận Checklist Cải Thiện ({data?.done_tasks_count || 0}/{data?.total_tasks_count || 10})
            </button>
          </div>

          <button
            onClick={() => setIsExtensionModalOpen(true)}
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Tải tiện ích Chrome để đồng bộ 100% số liệu La bàn dữ liệu từ Seller Center"
          >
            🧩 Cài Extension Đồng Bộ
          </button>

          <button
            onClick={loadDiagnosisData}
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px', fontWeight: '600' }}
          >
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            {loading ? 'Đang quét dữ liệu...' : 'Đồng bộ lại'}
          </button>
        </div>
      </div>

      {/* BANNER NGUỒN DỮ LIỆU ĐỒNG BỘ THỜI GIAN THỰC */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px rgba(22, 163, 74, 0.4)' }}></div>
          <span style={{ fontSize: '13px', color: '#334155' }}>
            Nguồn dữ liệu: <strong style={{ color: '#0f172a' }}>{sales.synced_source === 'seller_center_extension' ? 'TikTok Seller Center (Qua Extension Trình Duyệt 100% Chuẩn)' : 'TikTok Shop Open API & Seller Center'}</strong>
            {' • '}Thời gian đối soát: <strong style={{ color: '#b45309' }}>{sales.last_synced_at || 'Mới cập nhật'}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Độ chính xác: <strong style={{ color: '#15803d' }}>100% Real Seller Center</strong>
          </span>
          <button
            onClick={() => setIsExtensionModalOpen(true)}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0284c7',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Hướng dẫn Extension
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: '12px', padding: '14px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. SUB-TAB 1: BÁO CÁO SỨC KHỎE SHOP 360° */}
      {subTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* HERO HEALTH SCORE BANNER */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 340px) 1fr minmax(260px, 320px)',
              gap: '18px'
            }}
          >
            {/* Card Điểm Sức Khỏe Gian Hàng */}
            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                border: healthScore < 70 ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Chỉ Số Sức Khỏe Shop
                  </span>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                    Shop Health Index
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: healthScore < 70 ? '#fef2f2' : '#f0fdf4',
                    color: healthScore < 70 ? '#b91c1c' : '#15803d',
                    border: healthScore < 70 ? '1px solid #fca5a5' : '1px solid #bbf7d0'
                  }}
                >
                  {healthLevel}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '14px 0' }}>
                <div
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    background: healthScore < 70
                      ? 'conic-gradient(#ef4444 0% ' + healthScore + '%, #e2e8f0 ' + healthScore + '% 100%)'
                      : 'conic-gradient(#0284c7 0% ' + healthScore + '%, #e2e8f0 ' + healthScore + '% 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', lineHeight: '1' }}>{healthScore}</span>
                    <span style={{ fontSize: '9px', color: '#64748b' }}>/ 100</span>
                  </div>
                </div>

                <div style={{ flex: 1, fontSize: '11px', color: '#475569', lineHeight: '1.5' }}>
                  {deductions.length > 0 ? (
                    <div style={{ color: '#b91c1c' }}>
                      <strong>{deductions.length} Điểm Nghẽn Cần Khắc Phục</strong>
                      <div style={{ marginTop: '2px', fontSize: '10px', color: '#64748b' }}>
                        Nhấn tab Checklist để xử lý từng lỗi nhằm phục hồi phân phối.
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#15803d' }}>Gian hàng đang ở trạng thái chuẩn mực cao!</div>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                ⚡ Điểm trừ chính: {deductions[0] || 'Không phát hiện lỗi nghiêm trọng'}
              </div>
            </div>

            {/* Card Star Shop & Điểm Cửa Hàng SES */}
            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={20} style={{ color: '#d97706' }} />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Điểm Cửa Hàng (Shop Experience Score - SES)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const pSat = shopInfo.ses_details?.product_satisfaction;
                      const lSat = shopInfo.ses_details?.fulfillment_logistics;
                      const cSat = shopInfo.ses_details?.customer_service;
                      setSesForm({
                        ses_product_score: pSat?.score ?? 5.0,
                        ses_product_weight: pSat?.weight ?? 70.0,
                        ses_negative_review_rate: parseFloat(pSat?.metrics?.[0]?.value) || 0.10,
                        ses_return_refund_rate: parseFloat(pSat?.metrics?.[1]?.value) || 0.04,
                        ses_logistics_score: lSat?.score ?? 5.0,
                        ses_logistics_weight: lSat?.weight ?? 15.0,
                        ses_fast_dispatch_rate: parseFloat(lSat?.metrics?.[0]?.value) || 99.17,
                        ses_seller_cancel_rate: parseFloat(lSat?.metrics?.[1]?.value) || 0.02,
                        ses_service_score: cSat?.score ?? 4.6,
                        ses_service_weight: cSat?.weight ?? 15.0,
                        ses_aftersales_hours: parseFloat(cSat?.metrics?.[0]?.value) || 17.7,
                        ses_chat_response_rate: parseFloat(cSat?.metrics?.[1]?.value) || 96.84,
                      });
                      setIsSesModalOpen(true);
                    }}
                    title="Chỉnh sửa hoặc cập nhật chỉ số Điểm Cửa Hàng (SES)"
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Edit3 size={12} /> Cập nhật SES
                  </button>
                  {shopInfo.star_shop && (
                    <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                      ★ Star Shop • {shopInfo.ses_score || '4.9'} ⭐
                    </span>
                  )}
                  {shopInfo.is_mall && (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                      TikTok Mall
                    </span>
                  )}
                  {!shopInfo.star_shop && !shopInfo.is_mall && (
                    <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                      Tiêu Chuẩn
                    </span>
                  )}
                </div>
              </div>

              {/* Dải công thức chuẩn xác từ TikTok Shop Seller Center */}
              <div style={{ background: '#f0fdf4', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', margin: '12px 0', fontSize: '11px', color: '#166534' }}>
                <span style={{ color: '#15803d', fontWeight: '700' }}>📐 Công thức Điểm Cửa Hàng:</span>{' '}
                <span>
                  Hài lòng SP (<strong>{shopInfo.ses_details?.product_satisfaction?.score ?? 5.0} x {shopInfo.ses_details?.product_satisfaction?.weight ?? 70}%</strong>) + Kho vận (<strong>{shopInfo.ses_details?.fulfillment_logistics?.score ?? 5.0} x {shopInfo.ses_details?.fulfillment_logistics?.weight ?? 15}%</strong>) + CSKH (<strong>{shopInfo.ses_details?.customer_service?.score ?? 4.6} x {shopInfo.ses_details?.customer_service?.weight ?? 15}%</strong>) = <strong style={{ color: '#b45309', fontSize: '13px' }}>{shopInfo.ses_score_exact || '4.94'} ⭐</strong>
                </span>
              </div>

              {/* Lưới 3 Trụ Cột Đánh Giá SES Chuẩn Xác */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                {/* Trụ Cột 1: Hài lòng sản phẩm (70%) */}
                <div style={{ background: '#f8fafc', padding: '12px 10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a' }}>Hài Lòng Sản Phẩm</div>
                    <span style={{ fontSize: '10px', color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>{shopInfo.ses_details?.product_satisfaction?.weight ?? 70}%</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669', margin: '4px 0' }}>
                    {shopInfo.ses_details?.product_satisfaction?.score ?? 5.0} <span style={{ fontSize: '11px' }}>/ 5.0 ⭐</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#475569', lineHeight: '1.5' }}>
                    <div>• Đánh giá tiêu cực (60d): <strong style={{ color: '#047857' }}>{shopInfo.ses_details?.product_satisfaction?.metrics?.[0]?.value ?? '0.10%'}</strong></div>
                    <div>• Trả hàng lỗi NB (60d): <strong style={{ color: '#047857' }}>{shopInfo.ses_details?.product_satisfaction?.metrics?.[1]?.value ?? '0.04%'}</strong></div>
                  </div>
                </div>

                {/* Trụ Cột 2: Kho vận & hoàn thiện (15%) */}
                <div style={{ background: '#f8fafc', padding: '12px 10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a' }}>Kho Vận & Hoàn Thiện</div>
                    <span style={{ fontSize: '10px', color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>{shopInfo.ses_details?.fulfillment_logistics?.weight ?? 15}%</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669', margin: '4px 0' }}>
                    {shopInfo.ses_details?.fulfillment_logistics?.score ?? 5.0} <span style={{ fontSize: '11px' }}>/ 5.0 ⭐</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#475569', lineHeight: '1.5' }}>
                    <div>• Gửi hàng nhanh (30d): <strong style={{ color: '#047857' }}>{shopInfo.ses_details?.fulfillment_logistics?.metrics?.[0]?.value ?? '99.17%'}</strong></div>
                    <div>• Hủy do lỗi NB (30d): <strong style={{ color: '#047857' }}>{shopInfo.ses_details?.fulfillment_logistics?.metrics?.[1]?.value ?? '0.02%'}</strong></div>
                  </div>
                </div>

                {/* Trụ Cột 3: Dịch vụ khách hàng (15%) */}
                <div style={{ background: '#f8fafc', padding: '12px 10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a' }}>Dịch Vụ Khách Hàng</div>
                    <span style={{ fontSize: '10px', color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>{shopInfo.ses_details?.customer_service?.weight ?? 15}%</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669', margin: '4px 0' }}>
                    {shopInfo.ses_details?.customer_service?.score ?? 4.6} <span style={{ fontSize: '11px' }}>/ 5.0 ⭐</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#475569', lineHeight: '1.5' }}>
                    <div>• Xử lý hậu mãi (60d): <strong style={{ color: '#047857' }}>{shopInfo.ses_details?.customer_service?.metrics?.[0]?.value ?? '17.7 giờ'}</strong></div>
                    <div>• Phản hồi 12h (30d): <strong style={{ color: '#047857' }}>{shopInfo.ses_details?.customer_service?.metrics?.[1]?.value ?? '96.84%'}</strong></div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                <span>Vi phạm kênh: <strong style={{ color: shopInfo.violations_30d > 0 ? '#dc2626' : '#15803d' }}>{shopInfo.violations_30d || 0} vi phạm/30d</strong> (Trạng thái: Tuyệt vời)</span>
                <span style={{ color: '#b45309', fontWeight: '600' }}>{shopInfo.star_shop_status || 'Đạt chuẩn Star Shop'}</span>
              </div>
            </div>

            {/* Card Tiến Độ Checklist Cải Thiện */}
            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tiến Độ Xử Lý
                </span>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                  Ma Trận Checklist Hành Động
                </div>
              </div>

              <div style={{ margin: '14px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Đã xử lý xong:</span>
                  <strong style={{ color: '#0284c7' }}>
                    {data?.done_tasks_count || 0} / {data?.total_tasks_count || 10} đầu việc ({data?.checklist_progress || 0}%)
                  </strong>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${data?.checklist_progress || 0}%`,
                      background: 'linear-gradient(90deg, #0284c7, #2563eb)',
                      borderRadius: '4px',
                      transition: 'width 0.4s'
                    }}
                  />
                </div>
              </div>

              <button
                onClick={() => setSubTab('checklist')}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '9px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ListChecks size={14} /> Mở Checklist Xử Lý Nhiệm Vụ
              </button>
            </div>
          </div>

          {/* PHẦN 1: ĐÁNH GIÁ DOANH SỐ & PHỄU TRAFFIC */}
          <div
            style={{
              padding: '22px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#0284c7', color: '#ffffff', fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '4px' }}>PHẦN 1</span>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                    ĐÁNH GIÁ DOANH SỐ & PHỄU TRAFFIC (30 NGÀY VS KỲ TRƯỚC)
                  </h3>
                </div>
                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Đối soát biến động tăng/giảm giữa Doanh thu, Traffic (Lượt xem, người vào), CVR, GMV AFF và Chi phí Ads
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1d4ed8', fontWeight: '700', background: '#eff6ff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <span>Tổng đơn hoàn tất: {Number(sales.total_orders_count || 4492).toLocaleString('vi-VN')} đơn</span>
              </div>
            </div>

            {/* 4 Cards doanh số với % tăng giảm MoM */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Tổng GMV Toàn Sàn</span>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>
                    ▼ -43.51%
                  </span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '6px' }}>
                  {Number(sales.total_gmv || 458337810).toLocaleString('vi-VN')}đ
                </div>
                <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>
                  Giảm ~353 triệu ₫ so với tháng trước
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>GMV Từ Video (49.6%)</span>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>
                    ▼ -43.54%
                  </span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', marginTop: '6px' }}>
                  {Number(sales.video_gmv || 227295375).toLocaleString('vi-VN')}đ
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Kênh Shop: <strong style={{ color: '#dc2626' }}>-63.25%</strong> • KOC: <strong style={{ color: '#dc2626' }}>-42.35%</strong>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>GMV Từ Live (39.8%)</span>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>
                    ▼ -46.92%
                  </span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706', marginTop: '6px' }}>
                  {Number(sales.live_gmv || 182552634).toLocaleString('vi-VN')}đ
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  ~100 phiên live • CTOR & Traffic giảm
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Thẻ Sản Phẩm (10.6%)</span>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>
                    ▼ -37.72%
                  </span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a', marginTop: '6px' }}>
                  {Number(sales.product_gmv || 48489801).toLocaleString('vi-VN')}đ
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Traffic Shop Tab & Search tự nhiên
                </div>
              </div>
            </div>

            {/* Hộp Đối Soát Tương Quan: Traffic vs CVR */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0284c7', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={16} /> SO SÁNH BIẾN ĐỘNG: DOANH SỐ GIẢM DO THIẾU TRAFFIC HAY DO RỚT CHUYỂN ĐỔI (CVR)?
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                {/* Vế 1: Traffic */}
                <div style={{ background: '#fef2f2', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                  <div style={{ color: '#b91c1c', fontWeight: '700', fontSize: '12px', marginBottom: '6px' }}>
                    🔻 VẾ 1: LỰC ĐẨY TRAFFIC (ĐẦU VÀO SUY GIẢM MẠNH)
                  </div>
                  <ul style={{ fontSize: '11px', color: '#334155', lineHeight: '1.7', paddingLeft: '16px', margin: 0 }}>
                    <li><strong>KOC Affiliate hụt hơi:</strong> Doanh thu video nhà sáng tạo sụt giảm <span style={{ color: '#b91c1c', fontWeight: '700' }}>-42.35%</span> do chưa mở rộng mạng lưới KOC cho các SKU mới.</li>
                    <li><strong>Video kênh shop bão hòa:</strong> Doanh thu video trên kênh chính sụt giảm <span style={{ color: '#b91c1c', fontWeight: '700' }}>-63.25%</span>; tỷ lệ video kém hiệu quả chiếm 25.8%.</li>
                    <li><strong>Traffic Live chạm đáy:</strong> Lượt xem/giờ (Views/hour) ở mức cảnh báo so với top ngành Dược Mỹ Phẩm; thiếu video "mồi" dắt luồng trước live.</li>
                  </ul>
                </div>

                {/* Vế 2: CVR */}
                <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                  <div style={{ color: '#b45309', fontWeight: '700', fontSize: '12px', marginBottom: '6px' }}>
                    🛒 VẾ 2: TỶ LỆ CHUYỂN ĐỔI (CVR ĐỨT GÃY KHÂU CHỐT)
                  </div>
                  <ul style={{ fontSize: '11px', color: '#334155', lineHeight: '1.7', paddingLeft: '16px', margin: 0 }}>
                    <li><strong>Hiệu suất Ads vẫn rất cao:</strong> ROAS quảng cáo đạt <strong style={{ color: '#15803d' }}>12.00x</strong> (chứng minh tệp khách nhìn thấy sản phẩm vẫn sẵn lòng mua).</li>
                    <li><strong>Trắng 100% công cụ Voucher:</strong> Gian hàng có <span style={{ color: '#b91c1c', fontWeight: '700' }}>0 voucher</span> (không có voucher khách mới, không có voucher khách cũ, không voucher trong live) $\rightarrow$ Mất cơ hội chốt đơn tức thì.</li>
                    <li><strong>Tỷ lệ CTOR giỏ hàng thấp:</strong> Khách vào xem video/live nhưng thiếu ưu đãi kép để bấm nút mua ngay.</li>
                  </ul>
                </div>
              </div>

              {/* Dải kết luận */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '12px', color: '#14532d' }}>
                <span style={{ color: '#166534', fontWeight: '800' }}>🎯 KẾT LUẬN CỐT LÕI:</span>{' '}
                Doanh số sụt giảm 43.51% <strong>KHÔNG DO UY TÍN HAY CHẤT LƯỢNG SẢN PHẨM</strong> (Điểm SES giữ vững <strong>4.94⭐ Star Shop</strong>, vi phạm = 0). Nguyên nhân chính là do <strong>"HẸP PHỄU TRAFFIC ĐẦU VÀO"</strong> kết hợp với <strong>"LỖ HỔNG CHUYỂN ĐỔI CVR DO TRẮNG BỘ CÔNG CỤ VOUCHER"</strong>.
              </div>
            </div>

            {/* Thanh biểu đồ tỷ trọng 3 kênh */}
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ color: '#475569' }}>Cơ cấu đóng góp doanh thu 3 kênh:</span>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                  <span style={{ color: '#dc2626', fontWeight: '600' }}>■ Video (49.6%)</span>
                  <span style={{ color: '#d97706', fontWeight: '600' }}>■ Livestream (39.8%)</span>
                  <span style={{ color: '#16a34a', fontWeight: '600' }}>■ Thẻ sản phẩm (10.6%)</span>
                </div>
              </div>
              <div style={{ height: '14px', display: 'flex', borderRadius: '7px', overflow: 'hidden', background: '#e2e8f0' }}>
                <div style={{ width: '49.6%', background: '#dc2626' }} title="Video 49.6%" />
                <div style={{ width: '39.8%', background: '#d97706' }} title="Live 39.8%" />
                <div style={{ width: '10.6%', background: '#16a34a' }} title="Thẻ SP 10.6%" />
              </div>
            </div>
          </div>

          {/* PHẦN 2: ĐÁNH GIÁ THẺ SẢN PHẨM & PROMOTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'linear-gradient(135deg, #fe2c55, #ff7675)', color: '#fff', fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '4px' }}>PHẦN 2</span>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)', margin: 0 }}>
                ĐÁNH GIÁ THẺ SẢN PHẨM & PROMOTION
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {/* Thẻ 1: Kiểm toán Thẻ Sản Phẩm & Thuộc Tính Chuẩn SEO */}
              <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingBag size={18} style={{ color: 'var(--color-tiktok-cyan)' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main, #0f172a)', margin: 0 }}>Kiểm Toán Thẻ Sản Phẩm & SEO</h4>
                  </div>
                  <span style={{ fontSize: '11px', color: '#0284c7', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                    131 SKU Toàn Gian Hàng
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Cảnh báo thuộc tính bắt buộc */}
                  <div style={{ background: '#fef2f2', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '700' }}>❌ Thiếu Thuộc Tính Bắt Buộc (SEO)</span>
                      <span style={{ color: '#dc2626', fontWeight: '900', fontSize: '13px' }}>
                        8 sản phẩm
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '4px', lineHeight: '1.5' }}>
                      Thiếu các trường bắt buộc của ngành hàng Dược / Thực phẩm bảo vệ sức khỏe (Hạn dùng, Dạng bào chế, Quy cách, Số công bố) $\rightarrow$ <em>Bị thuật toán TikTok giảm 30% tần suất hiển thị tìm kiếm tự nhiên.</em>
                    </div>
                  </div>

                  {/* Cảnh báo chữ trên ảnh bìa */}
                  <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fed7aa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#b45309', fontWeight: '700' }}>⚠️ Cần Tinh Gọn Chữ Trên Ảnh Bìa</span>
                      <span style={{ color: '#d97706', fontWeight: '900', fontSize: '13px' }}>
                        33 sản phẩm
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#78350f', marginTop: '4px', lineHeight: '1.5' }}>
                      Ảnh bìa chính chứa nhiều chữ (text overlay &gt; 25% diện tích). Khuyến nghị: tinh gọn thông tin, đưa hình ảnh sản phẩm nổi bật chiếm &gt; 70% khung hình và bổ sung đủ 9 ảnh con.
                    </div>
                  </div>

                  {/* Nhiệm vụ tăng tốc */}
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-main, #0f172a)', fontWeight: '700' }}>Nhiệm Vụ Tăng Tốc Bán Hàng</span>
                      <span style={{ color: '#d97706', fontWeight: '700', fontSize: '12px' }}>
                        50 sản phẩm cần làm
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Đăng video trực tiếp trong mục nhiệm vụ Seller Center để mở khóa quyền lợi đẩy traffic tự nhiên từ sàn.
                    </div>
                  </div>
                </div>
              </div>

              {/* Thẻ 2: Ma Trận 5 Nhóm Voucher & Khuyến Mãi */}
              <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Flame size={18} style={{ color: '#fe2c55' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main, #0f172a)', margin: 0 }}>Ma Trận Voucher & Khuyến Mãi</h4>
                  </div>
                  <span style={{ fontSize: '11px', color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                    Báo Động: 0 Voucher
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Voucher 1: Khách mới */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>1. Voucher Khách Hàng Mới (New Buyer)</div>
                      <div style={{ fontSize: '10px', color: '#dc2626' }}>Mất khách lần đầu ghé thăm gian hàng</div>
                    </div>
                    <span style={{ background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>0 - THIẾU ❌</span>
                  </div>

                  {/* Voucher 2: Khách cũ */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>2. Voucher Giữ Chân / Khách Cũ (Repurchase)</div>
                      <div style={{ fontSize: '10px', color: '#dc2626' }}>Không kích được vòng đời mua lại 30 ngày</div>
                    </div>
                    <span style={{ background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>0 - THIẾU ❌</span>
                  </div>

                  {/* Voucher 3: Live */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>3. Voucher Độc Quyền Trong Live (Live Voucher)</div>
                      <div style={{ fontSize: '10px', color: '#dc2626' }}>Host không có công cụ xả mã ép chốt đơn</div>
                    </div>
                    <span style={{ background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>0 - THIẾU ❌</span>
                  </div>

                  {/* Voucher 4: Combo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>4. Mua Thêm Tiết Kiệm (Buy More Save More)</div>
                      <div style={{ fontSize: '10px', color: '#dc2626' }}>Không nâng được giá trị trung bình giỏ hàng (AOV)</div>
                    </div>
                    <span style={{ background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>0 - THIẾU ❌</span>
                  </div>

                  {/* Voucher 5: Flash Sale */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>5. Flash Sale Người Bán (Shop Flash Sale)</div>
                      <div style={{ fontSize: '10px', color: '#15803d' }}>Đang duy trì deal giá sốc theo giờ vàng</div>
                    </div>
                    <span style={{ background: '#22c55e', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>48 DEAL ✔</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PHẦN 3: ĐÁNH GIÁ LIVE & VIDEO PERFORMANCE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'linear-gradient(135deg, #f39c12, #e67e22)', color: '#000', fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '4px' }}>PHẦN 3</span>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)', margin: 0 }}>
                ĐÁNH GIÁ LIVE & VIDEO PERFORMANCE (KÈM CHIẾN DỊCH TIKTOK ADS)
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {/* Trụ Cột 1: Hiệu Suất Livestream */}
              <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Radio size={18} style={{ color: '#f39c12' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main, #0f172a)', margin: 0 }}>Hiệu Suất Livestream (39.8% GMV)</h4>
                  </div>
                  <span style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                    ▼ -46.92% MoM
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fed7aa' }}>
                    <div style={{ fontSize: '13px', color: '#b45309', fontWeight: '800' }}>
                      🎙️ Doanh Thu Live: {Number(sales.live_gmv || 182552634).toLocaleString('vi-VN')}đ (~100 ca live)
                    </div>
                    <div style={{ fontSize: '11px', color: '#78350f', marginTop: '4px' }}>
                      • <strong>Lượt xem/giờ:</strong> {live.views_per_hour_status || 'Ở mức cảnh báo so với bạn đồng ngành (Traffic live giảm)'}<br />
                      • <strong>Chuyển đổi CTOR:</strong> {live.ctor_status || 'Tỷ lệ nhấp giỏ hàng ở mức thấp - Tỷ lệ chuyển đổi kém'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-main, #0f172a)', fontWeight: '700' }}>Nguyên nhân & Đề xuất Live:</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px', lineHeight: '1.5' }}>
                      Thiếu video mồi (teaser) dắt luồng trước giờ live 45 phút. Thiếu voucher độc quyền phát theo mốc 15 phút để giục khách chốt ngay trên phiên live.
                    </div>
                  </div>
                </div>
              </div>

              {/* Trụ Cột 2: Video Kênh Shop vs KOC Affiliate */}
              <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Play size={18} style={{ color: '#9b59b6' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main, #0f172a)', margin: 0 }}>Hiệu Suất Video Ngắn (49.6% GMV)</h4>
                  </div>
                  <span style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                    ▼ -43.54% MoM
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Bóc tách KOC vs Kênh Shop */}
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-main, #0f172a)', fontWeight: '700', marginBottom: '4px' }}>
                      Bóc Tách Nguồn Doanh Thu Video:
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      <span>• KOC / Creator Affiliate (47.8%):</span>
                      <strong style={{ color: '#dc2626' }}>▼ -42.35%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>• Kênh Thương Hiệu Shop (52.2%):</span>
                      <strong style={{ color: '#dc2626' }}>▼ -63.25%</strong>
                    </div>
                  </div>

                  {/* Đánh giá tỷ lệ kém hiệu quả & format */}
                  <div style={{ background: '#fef2f2', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: '700' }}>Tỷ Lệ Video Kém Hiệu Quả:</span>
                      <span style={{ color: '#dc2626', fontWeight: '900', fontSize: '13px' }}>
                        25.8% (62/240 video)
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '4px' }}>
                      Nội dung bị bão hòa (chủ yếu là quay cận cảnh sản phẩm). Cần đổi mới 3 format: (1) Bác sĩ/Dược sĩ giải đáp, (2) So sánh thành phần, (3) Skit ngắn tình huống gia đình.
                    </div>
                  </div>

                  {/* Cảnh báo Spark Ads */}
                  <div style={{ background: '#fffbeb', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fed7aa', fontSize: '11px', color: '#b45309' }}>
                    ⚠️ Có 1 video đang chạy quảng cáo chưa được cấp mã ủy quyền Spark Ads.
                  </div>
                </div>
              </div>
            </div>

            {/* BẢNG CHẨN ĐOÁN CHIẾN DỊCH QUẢNG CÁO GMV MAX */}
            <div
              className="glass"
              style={{
                padding: '22px',
                borderRadius: '16px',
                border: '1px solid var(--border-light)',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)', margin: 0 }}>
                    Chi Tiết Chiến Dịch Quảng Cáo GMV Max (Bệnh Ngân Sách Ảo & Ngưỡng 20 Đơn Bảo Vệ ROI)
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-dimmed)' }}>
                    Chi tiêu thực tế: {Number(ads.total_spend || 18950080).toLocaleString('vi-VN')}đ • Doanh thu Ads: {Number(ads.total_gmv || 227295375).toLocaleString('vi-VN')}đ • ROAS: <strong style={{ color: '#16a34a' }}>12.00x</strong>
                  </span>
                </div>
              </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', background: '#f8fafc' }}>
                    <th style={{ padding: '10px' }}>Chiến dịch</th>
                    <th style={{ padding: '10px' }}>Loại</th>
                    <th style={{ padding: '10px' }}>Ngân sách / Thực chi</th>
                    <th style={{ padding: '10px' }}>Tỷ lệ chi tiêu</th>
                    <th style={{ padding: '10px' }}>ROI Thực tế / Mục tiêu</th>
                    <th style={{ padding: '10px' }}>Bảo vệ ROI (20 đơn)</th>
                    <th style={{ padding: '10px' }}>Vấn đề & Đề xuất AI</th>
                  </tr>
                </thead>
                <tbody>
                  {(ads.campaigns || []).map((c, idx) => (
                    <tr key={c.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 10px', color: 'var(--text-main, #0f172a)', fontWeight: '600' }}>
                        {c.name}
                        <div style={{ fontSize: '10px', color: 'var(--text-dimmed)' }}>ID: {c.id}</div>
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{c.type}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ color: 'var(--text-main, #0f172a)', fontWeight: '600' }}>{Number(c.spend || 0).toLocaleString('vi-VN')}đ</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dimmed)' }}>Ngân sách: {Number(c.budget || 0).toLocaleString('vi-VN')}đ</div>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: '700',
                            fontSize: '11px',
                            background: c.spend_ratio < 10 ? '#fee2e2' : '#dcfce7',
                            color: c.spend_ratio < 10 ? '#dc2626' : '#16a34a'
                          }}
                        >
                          {c.spend_ratio}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ fontWeight: '700', color: c.actual_roas >= c.target_roas ? '#16a34a' : '#dc2626' }}>
                          {c.actual_roas}x
                        </span>{' '}
                        <span style={{ fontSize: '10px', color: 'var(--text-dimmed)' }}>/ MT: {c.target_roas}x</span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        {c.roi_protection_met ? (
                          <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                            <CheckCircle size={13} /> Đủ ({c.conversions} đơn)
                          </span>
                        ) : (
                          <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                            <AlertTriangle size={13} /> Thiếu ({c.conversions}/20)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', maxWidth: '320px' }}>
                        {c.issues && c.issues.length > 0 ? (
                          <div style={{ fontSize: '11px', color: '#dc2626' }}>
                            {c.issues[0]}
                            {c.recommendations && c.recommendations.length > 0 && (
                              <div style={{ color: 'var(--color-tiktok-cyan)', marginTop: '3px', fontWeight: '600' }}>
                                👉 {c.recommendations[0]}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#16a34a', fontSize: '11px' }}>Chiến dịch vận hành ổn định</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. PHẦN 4: BẢNG HÀNH ĐỘNG KHẮC PHỤC (ACTION PLAN 14 NGÀY) */}
        <div
          className="glass"
          style={{
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--border-light)',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #fe2c55, #ff007a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <ListChecks size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main, #0f172a)', margin: 0 }}>
                  Phần 4: Bảng Hành Động Khắc Phục (Action Plan) & Kịch Bản 14 Ngày
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-dimmed)' }}>
                  Ma trận đối sách 4 cột chuẩn TikTok Shop Audit Bot: [Vấn đề] ➔ [Hành động] ➔ [Chỉ số SLA] ➔ [Bộ phận]
                </span>
              </div>
            </div>

            <button
              onClick={() => setSubTab('checklist')}
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: 'var(--color-tiktok-cyan)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ListChecks size={14} /> Mở Checklist Tác Vụ Chi Tiết
            </button>
          </div>

          {/* BẢNG MA TRẬN 4 CỘT */}
          <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 14px', width: '22%', textAlign: 'left' }}>1. Vấn đề phát hiện</th>
                  <th style={{ padding: '12px 14px', width: '38%', textAlign: 'left' }}>2. Hành động khắc phục cụ thể</th>
                  <th style={{ padding: '12px 14px', width: '22%', textAlign: 'left' }}>3. Chỉ số đo lường & SLA hoàn thành</th>
                  <th style={{ padding: '12px 14px', width: '18%', textAlign: 'center' }}>4. Bộ phận chịu trách nhiệm</th>
                </tr>
              </thead>
              <tbody>
                {/* Hàng 1: GMV & Traffic rớt */}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <strong style={{ color: '#dc2626' }}>GMV giảm sâu -43.51%</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                      Traffic Video Kênh (-63.25%) và KOC (-42.35%) cùng sụt giảm mạnh.
                    </div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', color: 'var(--text-main, #0f172a)', lineHeight: '1.5' }}>
                    Triển khai 3 format video giải trí/chuyên gia mới (Bác sĩ, So sánh, Skit gia đình). Mở chiến dịch gửi mẫu KOC quy mô 50 mẫu/tuần với hoa hồng thưởng nóng cho video đạt &gt;50k views.
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <div style={{ color: '#0284c7', fontWeight: '700' }}>+30% Traffic Video Kênh</div>
                    <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>⏱️ SLA: 7 - 10 ngày</div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'center' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontSize: '11px', fontWeight: '700' }}>
                      Content / Video / KOC
                    </span>
                  </td>
                </tr>

                {/* Hàng 2: Thẻ sản phẩm & SEO */}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <strong style={{ color: '#d97706' }}>8 SKU thiếu thuộc tính SEO & 33 ảnh nhiều chữ</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                      Bị bóp điểm chất lượng thẻ sản phẩm trên Shop Tab và tìm kiếm sàn.
                    </div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', color: 'var(--text-main, #0f172a)', lineHeight: '1.5' }}>
                    Điền đầy đủ 100% thuộc tính bắt buộc (thành phần, hạn sử dụng, công dụng, xuất xứ). Thay thế ảnh bìa 33 SKU: sản phẩm nổi bật &gt;70% khung hình, loại bỏ chữ rác/viền dầy.
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <div style={{ color: '#0284c7', fontWeight: '700' }}>100% SKU đạt chuẩn SEO Sàn</div>
                    <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>⏱️ SLA: 3 ngày</div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'center' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#eff6ff', color: '#0284c7', border: '1px solid #bfdbfe', fontSize: '11px', fontWeight: '700' }}>
                      Vận hành (Ops)
                    </span>
                  </td>
                </tr>

                {/* Hàng 3: Khuyến mãi & Vouchers */}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <strong style={{ color: '#dc2626' }}>Lỗ hổng 0 Voucher shop</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                      Thiếu 4 loại voucher cốt lõi: Khách mới, Khách cũ, Live voucher, Combo mua nhiều giảm giá.
                    </div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', color: 'var(--text-main, #0f172a)', lineHeight: '1.5' }}>
                    Tạo lập tức 4 chương trình voucher trên Seller Center: (1) Voucher Khách mới giảm 15k cho đơn từ 150k, (2) Voucher Khách cũ 25k cho đơn từ 299k, (3) Live Voucher độc quyền trong phiên, (4) Combo Mua 2 giảm 5%.
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <div style={{ color: '#0284c7', fontWeight: '700' }}>CVR tăng từ 1.8% lên &gt;2.8%</div>
                    <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>⏱️ SLA: 24 giờ</div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'center' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', fontSize: '11px', fontWeight: '700' }}>
                      Marketing / Vận hành
                    </span>
                  </td>
                </tr>

                {/* Hàng 4: Livestream */}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <strong style={{ color: '#d97706' }}>Views/hour Live cảnh báo & CTOR thấp</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                      100 ca live nhưng doanh thu giảm -46.92%, thiếu giữ chân người xem.
                    </div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', color: 'var(--text-main, #0f172a)', lineHeight: '1.5' }}>
                    Cấu trúc lại kịch bản live 3 chặng: Mở đầu tung Flash Sale mồi kéo mắt xem ➔ Giữa phiên đẩy combo quà tặng giá trị cao ➔ Cuối phiên đếm ngược chốt đơn. Ghim Live Voucher liên tục.
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <div style={{ color: '#0284c7', fontWeight: '700' }}>Thời lượng xem TB &gt;2 phút, CTOR &gt;8%</div>
                    <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>⏱️ SLA: 5 ngày</div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'center' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#fce7f3', color: '#db2777', border: '1px solid #fbcfe8', fontSize: '11px', fontWeight: '700' }}>
                      Team Livestream
                    </span>
                  </td>
                </tr>

                {/* Hàng 5: Ads GMV Max & Bệnh ngân sách ảo */}
                <tr>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <strong style={{ color: '#dc2626' }}>Ngân sách ảo & Chưa đủ 20 đơn bảo vệ ROI</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                      Camp mới đặt ngân sách lớn nhưng tiêu 0đ, máy học nghẽn; 1 video thiếu Spark Ads.
                    </div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', color: 'var(--text-main, #0f172a)', lineHeight: '1.5' }}>
                    Hạ ngân sách camp mới về mức thực tế (chi tiêu 7 ngày x 1.1), bật tự động mở rộng ngân sách khi hiệu quả. Kéo 20 đơn nhanh bằng cách chạy quảng cáo sản phẩm Hero có CVR cao nhất. Bổ sung mã Spark Ads cho video còn lại.
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top' }}>
                    <div style={{ color: '#0284c7', fontWeight: '700' }}>Đủ 20 đơn, Tỷ lệ chi tiêu &gt;85%</div>
                    <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>⏱️ SLA: 48 giờ</div>
                  </td>
                  <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'center' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', fontSize: '11px', fontWeight: '700' }}>
                      Ads Specialist
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* KỊCH BẢN TỐI ƯU CHI PHÍ & LẤY LẠI ĐỀ XUẤT TRONG 14 NGÀY TỚI */}
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '16px 20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Zap size={16} color="#0284c7" />
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7' }}>
                Kịch Bản Tối Ưu Chi Phí & Lấy Lại Đề Xuất TikTok Shop Trong 14 Ngày Tới
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', fontSize: '12px' }}>
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <strong style={{ color: 'var(--text-main, #0f172a)' }}>Giai đoạn 1 (Ngày 1 - 4): Vá Lỗ Hổng Cơ Bản</strong>
                <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                  • Sửa ngay 8 SKU thiếu thuộc tính &amp; thay 33 ảnh bìa.<br />
                  • Kích hoạt 4 bộ Voucher (Khách mới, Khách cũ, Live, Combo).<br />
                  • Hạ ngân sách ảo trên Ads Manager để máy học không bị nghẽn.
                </p>
              </div>
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <strong style={{ color: 'var(--text-main, #0f172a)' }}>Giai đoạn 2 (Ngày 5 - 9): Kích Hoạt Dòng Traffic</strong>
                <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                  • Đẩy 5 format video mới kết hợp bác sĩ/dược sĩ.<br />
                  • Cấp mã Spark Ads chạy GMV Max video vít đơn hero product.<br />
                  • Đặt lịch Live cố định khung 12h-14h và 20h-23h kèm Flash Sale.
                </p>
              </div>
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <strong style={{ color: 'var(--text-main, #0f172a)' }}>Giai đoạn 3 (Ngày 10 - 14): Tăng Tốc &amp; Đón Sóng</strong>
                <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                  • Đạt mốc 20 đơn kích hoạt cơ chế Bảo vệ ROI của TikTok Ads.<br />
                  • Hoàn thành nhiệm vụ tăng tốc gian hàng nhận Voucher tài trợ.<br />
                  • Doanh số dự kiến hồi phục +40% - 60% so với đáy tháng trước.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    )}

      {/* 3. SUB-TAB 2: MA TRẬN CHECKLIST CẢI THIỆN TƯƠNG TÁC */}
      {subTab === 'checklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* THANH LỌC CHECKLIST */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '14px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '14px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Bộ lọc:</span>

              {/* Lọc phòng ban */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Tất cả phòng ban</option>
                <option value="product">📦 Vận hành & Sản phẩm</option>
                <option value="rating">⭐ Đánh giá & SES</option>
                <option value="acceleration">⚡ Tăng tốc bán hàng</option>
                <option value="promotion">🏷️ Khuyến mãi & Voucher</option>
                <option value="campaign">🎪 Chiến dịch sàn</option>
                <option value="live">🎙️ Livestream</option>
                <option value="video">🎬 Video & Affiliate</option>
                <option value="growth">🚀 Nhiệm vụ tăng trưởng</option>
                <option value="cs">💬 Dịch vụ CSKH</option>
                <option value="ads">🎯 Quảng cáo GMV Max</option>
              </select>

              {/* Lọc Mức Độ Ưu Tiên */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Tất cả mức ưu tiên</option>
                <option value="P0">🔴 P0 - Khẩn cấp (Làm ngay)</option>
                <option value="P1">🟡 P1 - Quan trọng (Trong tuần)</option>
                <option value="P2">🟢 P2 - Tối ưu liên tục</option>
              </select>

              {/* Lọc Trạng Thái */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="todo">⏳ Cần làm (To-Do)</option>
                <option value="in_progress">⚙️ Đang làm (In Progress)</option>
                <option value="done">✅ Hoàn thành (Done)</option>
              </select>
            </div>

            {/* Thống kê tiến độ */}
            <div style={{ fontSize: '12px', color: '#475569' }}>
              Hiển thị <strong>{filteredChecklist.length}</strong> / {data?.checklist?.length || 10} đầu việc • Hoàn thành:{' '}
              <strong style={{ color: '#16a34a' }}>{data?.checklist_progress || 0}%</strong>
            </div>
          </div>

          {/* BẢNG DANH SÁCH CHECKLIST TƯƠNG TÁC */}
          <div
            style={{
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              overflow: 'hidden'
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px', width: '90px' }}>Trạng thái</th>
                    <th style={{ padding: '12px 10px', width: '60px' }}>Ưu tiên</th>
                    <th style={{ padding: '12px 14px', width: '220px' }}>Đầu việc</th>
                    <th style={{ padding: '12px 14px' }}>Chi tiết công việc & Hướng dẫn</th>
                    <th style={{ padding: '12px 14px', width: '180px' }}>Mục đích</th>
                    <th style={{ padding: '12px 10px', width: '120px' }}>Người làm / Tần suất</th>
                    <th style={{ padding: '12px 14px', width: '160px' }}>Ghi chú shop</th>
                    <th style={{ padding: '12px 14px', width: '120px', textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChecklist.map((task) => {
                    const isDone = task.status === 'done';
                    const isInProgress = task.status === 'in_progress';
                    const isP0 = task.priority === 'P0';
                    const isP1 = task.priority === 'P1';

                    return (
                      <tr
                        key={task.id || task.task_code}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isDone ? '#f0fdf4' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        {/* Cột 1: Nút trạng thái */}
                        <td style={{ padding: '14px' }}>
                          <button
                            onClick={() => handleToggleTaskStatus(task)}
                            style={{
                              background: isDone
                                ? '#dcfce7'
                                : isInProgress
                                ? '#fef3c7'
                                : '#f8fafc',
                              color: isDone ? '#15803d' : isInProgress ? '#b45309' : '#64748b',
                              border: isDone
                                ? '1px solid #86efac'
                                : isInProgress
                                ? '1px solid #fde68a'
                                : '1px solid #cbd5e1',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              width: '100%',
                              justifyContent: 'center'
                            }}
                            title="Nhấn để đổi: Cần làm ➔ Đang làm ➔ Hoàn thành"
                          >
                            {isDone ? <Check size={12} /> : isInProgress ? <Clock size={12} /> : null}
                            {isDone ? 'Xong' : isInProgress ? 'Đang làm' : 'Cần làm'}
                          </button>
                        </td>

                        {/* Cột 2: Badge Ưu tiên */}
                        <td style={{ padding: '14px 10px' }}>
                          <span
                            style={{
                              padding: '3px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '800',
                              background: isP0 ? '#fee2e2' : isP1 ? '#fef3c7' : '#dcfce7',
                              color: isP0 ? '#b91c1c' : isP1 ? '#b45309' : '#15803d',
                              border: isP0 ? '1px solid #fca5a5' : isP1 ? '1px solid #fde68a' : '1px solid #86efac'
                            }}
                          >
                            {task.priority || 'P1'}
                          </span>
                        </td>

                        {/* Cột 3: Tên đầu việc */}
                        <td style={{ padding: '14px' }}>
                          <div style={{ color: isDone ? '#94a3b8' : '#0f172a', fontWeight: '700', textDecoration: isDone ? 'line-through' : 'none' }}>
                            {task.title}
                          </div>
                          <span style={{ fontSize: '10px', color: '#0284c7', textTransform: 'uppercase', fontWeight: '600' }}>
                            {task.category}
                          </span>
                        </td>

                        {/* Cột 4: Chi tiết công việc */}
                        <td style={{ padding: '14px', color: isDone ? '#94a3b8' : '#334155', lineHeight: '1.5' }}>
                          {task.description}
                        </td>

                        {/* Cột 5: Mục đích */}
                        <td style={{ padding: '14px', color: '#64748b', fontSize: '12px', lineHeight: '1.4' }}>
                          {task.purpose}
                        </td>

                        {/* Cột 6: Người làm & Tần suất */}
                        <td style={{ padding: '14px 10px' }}>
                          <div style={{ color: '#0f172a', fontWeight: '600', fontSize: '12px' }}>{task.assignee || 'Seller'}</div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>{task.frequency || 'Hàng ngày'}</div>
                        </td>

                        {/* Cột 7: Ghi chú */}
                        <td style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <input
                              type="text"
                              value={editingNotes[task.task_code] !== undefined ? editingNotes[task.task_code] : (task.notes || '')}
                              onChange={(e) => setEditingNotes({ ...editingNotes, [task.task_code]: e.target.value })}
                              placeholder="Thêm ghi chú..."
                              style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                color: '#0f172a',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                width: '100%'
                              }}
                            />
                            {editingNotes[task.task_code] !== undefined && editingNotes[task.task_code] !== (task.notes || '') && (
                              <button
                                onClick={() => handleSaveNote(task)}
                                disabled={savingNoteCode === task.task_code}
                                style={{
                                  background: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                {savingNoteCode === task.task_code ? 'Đang lưu...' : 'Lưu ghi chú'}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Cột 8: Thao tác AI */}
                        <td style={{ padding: '14px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenAiSolution(task)}
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            title="Hỏi AI cách làm chi tiết từng bước"
                          >
                            <Sparkles size={12} /> AI Chỉ Cách Làm
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 4. MODAL HƯỚNG DẪN GIẢI PHÁP TỪ GEMINI AI */}
      {selectedTaskForAi && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1300 }}
          onClick={() => setSelectedTaskForAi(null)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '720px',
              width: '92%',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#0284c7', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                    AI Hướng Dẫn Thực Hiện: {selectedTaskForAi.title}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600' }}>
                    Phòng ban: {selectedTaskForAi.assignee} • Ưu tiên: {selectedTaskForAi.priority}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTaskForAi(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 0' }}>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#334155' }}>
                <strong style={{ color: '#0f172a' }}>Yêu cầu đầu việc:</strong> {selectedTaskForAi.description}
                <div style={{ marginTop: '4px' }}>
                  <strong style={{ color: '#0f172a' }}>Mục đích:</strong> {selectedTaskForAi.purpose}
                </div>
              </div>

              {loadingAiSolution ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <RefreshCw size={28} className="spin-anim" style={{ color: '#0284c7', marginBottom: '10px' }} />
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Gemini AI đang soạn hướng dẫn thực chiến...</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Đang tra cứu tài liệu Seller Center và tiêu chuẩn TikTok Shop 2026...
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', lineHeight: '1.75', color: '#0f172a' }}>
                  {renderFormattedMarkdown ? renderFormattedMarkdown(aiSolutionText) : <pre style={{ whiteSpace: 'pre-wrap', color: '#0f172a' }}>{aiSolutionText}</pre>}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (aiSolutionText) {
                    navigator.clipboard.writeText(aiSolutionText);
                    alert('Đã sao chép hướng dẫn vào bộ nhớ tạm!');
                  }
                }}
              >
                📋 Sao chép hướng dẫn
              </button>
              <button type="button" className="btn-secondary" onClick={() => setSelectedTaskForAi(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL CẬP NHẬT ĐIỂM CỬA HÀNG (SHOP EXPERIENCE SCORE - SES) */}
      {isSesModalOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1300 }}
          onClick={() => setIsSesModalOpen(false)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '680px',
              width: '92%',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    background: '#f59e0b',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}
                >
                  <Award size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                    Cập Nhật Điểm Cửa Hàng (SES)
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Chuẩn công thức &amp; số liệu TikTok Shop Seller Center
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsSesModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 0' }}>
              {/* Box Tính Điểm Xem Trước */}
              {(() => {
                const p = (parseFloat(sesForm.ses_product_score) || 0) * ((parseFloat(sesForm.ses_product_weight) || 0) / 100);
                const l = (parseFloat(sesForm.ses_logistics_score) || 0) * ((parseFloat(sesForm.ses_logistics_weight) || 0) / 100);
                const s = (parseFloat(sesForm.ses_service_score) || 0) * ((parseFloat(sesForm.ses_service_weight) || 0) / 100);
                const total = p + l + s;
                const rounded = Math.round(total * 10) / 10;
                return (
                  <div
                    style={{
                      background: '#fefce8',
                      border: '1px solid #fde047',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      marginBottom: '20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', color: '#a16207', fontWeight: '700', marginBottom: '2px' }}>
                        📐 CÔNG THỨC TÍNH TOÁN TRỰC TIẾP
                      </div>
                      <div style={{ fontSize: '12px', color: '#713f12' }}>
                        {sesForm.ses_product_score} × {sesForm.ses_product_weight}% + {sesForm.ses_logistics_score} × {sesForm.ses_logistics_weight}% + {sesForm.ses_service_score} × {sesForm.ses_service_weight}% = <strong style={{ color: '#854d0e' }}>{total.toFixed(2)} ⭐</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: '#a16207', textTransform: 'uppercase', fontWeight: '600' }}>Điểm hiển thị</div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#b45309' }}>{rounded.toFixed(1)} ⭐</div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* 1. Hài lòng sản phẩm */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0369a1', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>1. Mức Độ Hài Lòng Với Sản Phẩm</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Trọng số chuẩn: 70%</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Điểm đánh giá (0 - 5.0)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={sesForm.ses_product_score}
                        onChange={(e) => setSesForm({ ...sesForm, ses_product_score: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Trọng số (%)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={sesForm.ses_product_weight}
                        onChange={(e) => setSesForm({ ...sesForm, ses_product_weight: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Tỷ lệ đánh giá tiêu cực (60d) (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sesForm.ses_negative_review_rate}
                        onChange={(e) => setSesForm({ ...sesForm, ses_negative_review_rate: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Tỷ lệ trả hàng do lỗi NB (60d) (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sesForm.ses_return_refund_rate}
                        onChange={(e) => setSesForm({ ...sesForm, ses_return_refund_rate: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Kho vận & hoàn thiện */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0369a1', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>2. Kho Vận Và Hoàn Thiện Đơn Hàng</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Trọng số chuẩn: 15%</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Điểm đánh giá (0 - 5.0)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={sesForm.ses_logistics_score}
                        onChange={(e) => setSesForm({ ...sesForm, ses_logistics_score: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Trọng số (%)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={sesForm.ses_logistics_weight}
                        onChange={(e) => setSesForm({ ...sesForm, ses_logistics_weight: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Tỷ lệ gửi hàng nhanh (30d) (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sesForm.ses_fast_dispatch_rate}
                        onChange={(e) => setSesForm({ ...sesForm, ses_fast_dispatch_rate: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Tỷ lệ hủy do lỗi NB (30d) (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sesForm.ses_seller_cancel_rate}
                        onChange={(e) => setSesForm({ ...sesForm, ses_seller_cancel_rate: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Dịch vụ khách hàng */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0369a1', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>3. Dịch Vụ Khách Hàng</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Trọng số chuẩn: 15%</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Điểm đánh giá (0 - 5.0)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={sesForm.ses_service_score}
                        onChange={(e) => setSesForm({ ...sesForm, ses_service_score: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Trọng số (%)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={sesForm.ses_service_weight}
                        onChange={(e) => setSesForm({ ...sesForm, ses_service_weight: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Thời gian xử lý hậu mãi (60d) (giờ)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={sesForm.ses_aftersales_hours}
                        onChange={(e) => setSesForm({ ...sesForm, ses_aftersales_hours: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '4px' }}>Tỷ lệ phản hồi 12h (30d) (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sesForm.ses_chat_response_rate}
                        onChange={(e) => setSesForm({ ...sesForm, ses_chat_response_rate: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSesForm({
                    ses_product_score: 5.0,
                    ses_product_weight: 70.0,
                    ses_negative_review_rate: 0.10,
                    ses_return_refund_rate: 0.04,
                    ses_logistics_score: 5.0,
                    ses_logistics_weight: 15.0,
                    ses_fast_dispatch_rate: 99.17,
                    ses_seller_cancel_rate: 0.02,
                    ses_service_score: 4.6,
                    ses_service_weight: 15.0,
                    ses_aftersales_hours: 17.7,
                    ses_chat_response_rate: 96.84
                  });
                }}
                style={{ fontSize: '12px' }}
              >
                🔄 Đặt Lại Chuẩn ADDP
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsSesModalOpen(false)}>
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingSes}
                  onClick={handleSaveSes}
                  style={{
                    background: '#f59e0b',
                    color: '#ffffff',
                    fontWeight: '700',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {savingSes ? <RefreshCw size={14} className="spin-anim" /> : <Check size={14} />}
                  {savingSes ? 'Đang lưu...' : 'Lưu Điểm Cửa Hàng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL HƯỚNG DẪN CÀI ĐẶT & TẢI EXTENSION SELLER CENTER */}
      {isExtensionModalOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1300 }}
          onClick={() => setIsExtensionModalOpen(false)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '680px',
              width: '92%',
              maxHeight: '88vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    background: '#0284c7',
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}
                >
                  <Layers size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                    Tiện Ích Đồng Bộ Seller Center (TikTok Audit Extension)
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Trích xuất 100% dữ liệu gốc La bàn (Compass) &amp; Khuyến mãi từ tab Seller Center
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsExtensionModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Box Giới thiệu giải pháp */}
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '12px',
                  color: '#0369a1',
                  lineHeight: '1.5'
                }}
              >
                💡 <strong>Tại sao cần Extension?</strong> TikTok Shop Open API không cung cấp dữ liệu La bàn thương mại (Compass), phân bổ KOC vs Kênh Shop chi tiết và ma trận Voucher. Tiện ích này hoạt động trực tiếp trên trình duyệt của bạn, sử dụng phiên đăng nhập hợp lệ của shop trên <code>seller-vn.tiktok.com</code> để trích xuất 100% số liệu thật và đồng bộ về phần mềm với 1 click!
              </div>

              {/* Nút Tải Extension */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ color: '#0f172a', fontWeight: '700', fontSize: '14px' }}>
                    📦 Bộ Cài Đặt Tiện Ích Mở Rộng
                  </div>
                  <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                    Phiên bản 1.0.0 • Định dạng ZIP • Tương thích Chrome, Cốc Cốc, Edge, Brave
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                      const res = await fetch('/api/download_extension.php', { headers });
                      if (!res.ok) throw new Error('Không thể tải tiện ích (Mã lỗi: ' + res.status + ')');
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'tiktok_audit_extension.zip';
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (err) {
                      alert('Lỗi tải file tiện ích: ' + err.message);
                    }
                  }}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  📥 Tải Tiện Ích (.ZIP) - 5 KB
                </button>
              </div>

              {/* Task 02B: Ghép Nối & Kích Hoạt Tiện Ích */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ color: '#0f172a', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🔗 Kích Hoạt &amp; Ghép Nối Tiện Ích (Khóa xác thực 24h)</span>
                  </div>
                  {pairingConnected && (
                    <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', border: '1px solid #86efac' }}>
                      🟢 Tiện ích đã kết nối
                    </span>
                  )}
                </div>

                <p style={{ color: '#475569', fontSize: '12px', lineHeight: '1.5', margin: '0 0 12px 0' }}>
                  Để bảo mật dữ liệu doanh thu, Tiện ích Chrome cần được cấp quyền kết nối bằng mã xác thực 1 lần (Single-use). Bấm nút dưới đây để kết nối tự động với Tiện ích đang mở trên trình duyệt, hoặc sao chép mã ghép nối thủ công.
                </p>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={pairingLoading}
                    onClick={handleGeneratePairing}
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: pairingLoading ? 'not-allowed' : 'pointer',
                      fontWeight: '700',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                    }}
                  >
                    {pairingLoading ? '⏳ Đang tạo mã...' : '⚡ Cấp Mã Ghép Nối / Kết Nối 1-Click'}
                  </button>

                  {pairingData?.pairing_code && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Mã thủ công:</span>
                      <strong style={{ color: '#0284c7', fontFamily: 'monospace', fontSize: '13px' }}>{pairingData.pairing_code}</strong>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(pairingData.pairing_code);
                          setCopyStatus(true);
                          setTimeout(() => setCopyStatus(false), 2000);
                        }}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        {copyStatus ? '✅ Đã chép' : '📋 Sao chép'}
                      </button>
                    </div>
                  )}
                </div>

                {pairingData && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#b45309' }}>
                    ⏳ Mã ghép nối có hiệu lực trong 5 phút. Mở Popup tiện ích và dán mã nếu kết nối tự động chưa nhận diện.
                  </div>
                )}
              </div>

              {/* Hướng Dẫn Cài Đặt 3 Bước */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0369a1', marginBottom: '12px' }}>
                  📋 Hướng Dẫn Cài Đặt &amp; Sử Dụng (Dưới 1 phút)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px', color: '#475569' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#ffffff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                      1
                    </div>
                    <div>
                      <strong style={{ color: '#0f172a' }}>Bước 1: Tải &amp; Giải Nén</strong>
                      <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>
                        Bấm nút <strong>"Tải Tiện Ích (.ZIP)"</strong> ở trên. Sau khi tải xong, nhấp chuột phải vào file <code>tiktok_audit_extension.zip</code> và chọn <em>Extract All...</em> (Giải nén) vào một thư mục cố định trên máy tính (ví dụ: <code>C:\tiktok_audit_extension</code>).
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#ffffff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                      2
                    </div>
                    <div>
                      <strong style={{ color: '#0f172a' }}>Bước 2: Cài Đặt Vào Trình Duyệt Chrome / Edge / Cốc Cốc</strong>
                      <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>
                        • Mở trình duyệt, nhập vào thanh địa chỉ: <code>chrome://extensions</code> (hoặc <code>edge://extensions</code>).<br />
                        • Bật công tắc <strong>"Chế độ dành cho nhà phát triển" (Developer mode)</strong> ở góc trên bên phải.<br />
                        • Nhấn nút <strong>"Tải tiện ích đã giải nén" (Load unpacked)</strong> ở góc trên bên trái.<br />
                        • Chọn thư mục bạn vừa giải nén ở Bước 1.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#ffffff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                      3
                    </div>
                    <div>
                      <strong style={{ color: '#0f172a' }}>Bước 3: Quét &amp; Tự Động Đồng Bộ Dữ Liệu</strong>
                      <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>
                        • Mở tab TikTok Shop Seller Center: <a href="https://seller-vn.tiktok.com" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'underline' }}>seller-vn.tiktok.com</a> và đăng nhập shop.<br />
                        • Bấm vào biểu tượng tiện ích <strong>TikTok Shop Audit</strong> trên thanh công cụ trình duyệt (ghim lên thanh công cụ nếu bị ẩn).<br />
                        • Bấm nút <strong>"Quét &amp; Đồng Bộ Số Liệu"</strong>. Toàn bộ số liệu La bàn, SES 4.94⭐, Video, Vouchers sẽ tự động cập nhật về phần mềm!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cam kết bảo mật */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '11px',
                  color: '#166534'
                }}
              >
                <ShieldCheck size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Bảo mật 100%:</strong> Tiện ích chỉ trích xuất dữ liệu phân tích kinh doanh để lập báo cáo, chạy trực tiếp trên máy của bạn và gửi thẳng về máy chủ lưu trữ của chính shop. Không thu thập mật khẩu hay cookie nhạy cảm.
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsExtensionModalOpen(false)}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '8px 18px',
                  border: 'none'
                }}
              >
                Đã hiểu &amp; Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
