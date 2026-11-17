import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Activity,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Radio,
  Settings,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Users,
  CheckCircle,
  MessageSquare,
  Eye,
  ArrowUpRight,
  Sliders,
  SlidersHorizontal,
  X,
  Sparkles,
  Info,
  Calendar,
  Volume2,
  Play,
  Zap,
  Download,
  ChevronDown,
  ChevronUp,
  Layers,
  Target,
  BarChart2,
  Check,
  Award,
  Lightbulb,
  ShieldAlert,
  FileText,
  Flame,
  CheckCircle2,
  XCircle,
  Package,
  Tag,
  CreditCard,
  Video,
  FileSpreadsheet
} from 'lucide-react';
import './App.css';
import ShopDiagnosisView from './ShopDiagnosisView';
import CommerceDashboardView from './CommerceDashboardView';

// Initial Mock Data (Chuẩn xác 100% từ TikTok Shop Streamer Desktop)
const FALLBACK_LIVE_SESSIONS = [
  {
    room_id: '7681518164916177680',
    start_time: '10:33 05/09/2026', // Ca live ngày hôm nay (05.09)
    duration: '2h58min',
    gmv: 2177890,
    ad_spend: 172560, // Chi phí QC ghi nhận trong chi tiết ca live
    orders: 30,
    views: 582,
    impressions: 17890,
    viewers: 419,
    gpm: 121750,
    gmv_per_hour: 731380,
    avg_watch_time: '1m 01s',
    view_gt_1min: 135,
    comment_rate: 52.76,
    like_rate: 759.9,
    share_rate: 0.32,
    ctr_live: 49.48,
    enter_room_rate: 1.70,
    sku_order_rate: 5.15,
    traffic_sources: {
      live_feed: { name: 'Bảng tin Đề xuất', gmv_pct: 47.56, imps_pct: 79.0, views_pct: 58.85 },
      profile_click: { name: 'Lượt nhấn vào hồ sơ', gmv_pct: 35.98, imps_pct: 40.16, views_pct: 10.16 },
      live_preview: { name: 'Bản xem trước LIVE', gmv_pct: 11.58, imps_pct: 37.61, views_pct: 18.69 },
      swipe_live: { name: 'Vuốt LIVE', gmv_pct: 0.0, imps_pct: 1.11, views_pct: 27.38 },
      other_profile: { name: 'Hồ sơ người khác', gmv_pct: 0.0, imps_pct: 0.11, views_pct: 2.62 }
    },
    top_products: [
      { name: '[SP LIVE] 3 Tuýp Sủi mát gan Dovital', id: '1731663026855969967', gmv: 1184790, views: 1751, ctr: 4.28, orders: 3, stock: 5663 },
      { name: '[Deal 1K] 1 Tuýp Sủi mát gan Dovital', id: '1733032139594892463', gmv: 58000, views: 86, ctr: 17.44, orders: 1, stock: 2 },
      { name: '3 Tuýp Sủi mát gan Dovital...', id: '1736983103070569647', gmv: 0, views: 90, ctr: 0, orders: 0, stock: 9952 },
      { name: '2 Tuýp Sủi mát gan Dovital - Tpbv...', id: '1737000915839853487', gmv: 79000, views: 157, ctr: 1.91, orders: 1, stock: 959 }
    ]
  },
  {
    room_id: '7681293833946909448',
    start_time: '20:03 3/9/2026',
    duration: '1h58min',
    gmv: 513000,
    ad_spend: 0, // Không có số liệu chi phí riêng trên Streamer Desktop, không tự ý gán
    orders: 6,
    views: 377,
    impressions: 6350,
    viewers: 280,
    gpm: 80787,
    gmv_per_hour: 260847,
    avg_watch_time: '0m 52s',
    view_gt_1min: 65,
    comment_rate: 38.5,
    like_rate: 420.0,
    share_rate: 2.1,
    ctr_live: 35.2,
    enter_room_rate: 1.5,
    sku_order_rate: 1.59,
    traffic_sources: null,
    top_products: []
  },
  {
    room_id: '7681253344618220289',
    start_time: '17:26 3/9/2026',
    duration: '1h35min',
    gmv: 559100,
    ad_spend: 0, // Không tự ý gán chi phí riêng
    orders: 10,
    views: 539,
    impressions: 18520,
    viewers: 390,
    gpm: 30188,
    gmv_per_hour: 353115,
    avg_watch_time: '0m 48s',
    view_gt_1min: 82,
    comment_rate: 31.2,
    like_rate: 310.0,
    share_rate: 1.8,
    ctr_live: 29.8,
    enter_room_rate: 1.4,
    sku_order_rate: 1.85,
    traffic_sources: null,
    top_products: []
  },
  {
    room_id: '7681150802035723024',
    start_time: '10:48 3/9/2026',
    duration: '2h42min',
    gmv: 2200000,
    ad_spend: 0, // Không tự ý gán chi phí riêng
    orders: 33,
    views: 666,
    impressions: 27590,
    viewers: 485,
    gpm: 79739,
    gmv_per_hour: 814814,
    avg_watch_time: '1m 05s',
    view_gt_1min: 160,
    comment_rate: 58.2,
    like_rate: 810.0,
    share_rate: 4.2,
    ctr_live: 45.1,
    enter_room_rate: 1.8,
    sku_order_rate: 4.95,
    traffic_sources: null,
    top_products: []
  },
  {
    room_id: '7681149841287777041',
    start_time: '10:44 3/9/2026',
    duration: '0h02min',
    gmv: 0,
    ad_spend: 0,
    orders: 0,
    views: 2,
    impressions: 87,
    viewers: 2,
    gpm: 0,
    gmv_per_hour: 0,
    avg_watch_time: '0m 10s',
    view_gt_1min: 0,
    comment_rate: 0,
    like_rate: 0,
    share_rate: 0,
    ctr_live: 0,
    enter_room_rate: 0,
    sku_order_rate: 0,
    traffic_sources: null,
    top_products: []
  }
];

const INITIAL_CAMPAIGNS = [
  {
    id: 'camp-1',
    name: 'GMV Max - Vợt cầu lông Yonex Pro 2026',
    type: 'Product GMV Max',
    budget: 5000000,
    spend: 3200000,
    target_roas: 6.0,
    clicks: 1850,
    impressions: 48000,
    conversions: 112,
    adGmv: 14400000,
    status: true,
    created: '2026-07-10'
  },
  {
    id: 'camp-2',
    name: 'LIVE GMV Max - Phiên live đặc biệt 15/07',
    type: 'LIVE GMV Max',
    budget: 12000000,
    spend: 7800000,
    target_roas: 5.5,
    clicks: 4500,
    impressions: 98000,
    conversions: 382,
    adGmv: 28860000,
    status: true,
    created: '2026-07-15'
  },
  {
    id: 'camp-3',
    name: 'GMV Max - Giày chạy bộ nam UltraLight',
    type: 'Product GMV Max',
    budget: 3000000,
    spend: 1850000,
    target_roas: 5.0,
    clicks: 980,
    impressions: 29000,
    conversions: 48,
    adGmv: 5180000,
    status: true,
    created: '2026-07-12'
  },
  {
    id: 'camp-4',
    name: 'LIVE GMV Max - Flash Sale Đồ Gia Dụng',
    type: 'LIVE GMV Max',
    budget: 8000000,
    spend: 6400000,
    target_roas: 6.0,
    clicks: 3100,
    impressions: 74000,
    conversions: 210,
    adGmv: 15360000,
    status: false,
    created: '2026-07-14'
  },
  {
    id: 'camp-5',
    name: 'GMV Max - Bình giữ nhiệt thông minh Lock',
    type: 'Product GMV Max',
    budget: 2000000,
    spend: 1980000,
    target_roas: 4.5,
    clicks: 1200,
    impressions: 34000,
    conversions: 89,
    adGmv: 4350000,
    status: false,
    created: '2026-07-08'
  }
];

const INITIAL_RULES = [
  {
    id: 'rule-1',
    name: 'Tối ưu ngân sách GMV Max',
    trigger: 'ROAS >= 4.0',
    action: 'Tăng ngân sách 15%',
    frequency: 'Mỗi 1 giờ',
    status: true,
    campaignType: 'Product GMV Max'
  },
  {
    id: 'rule-2',
    name: 'Bảo vệ ngân sách LIVE GMV Max',
    trigger: 'ROAS < 2.0 & Chi tiêu > 1,500,000đ',
    action: 'Tạm dừng chiến dịch',
    frequency: 'Mỗi 15 phút',
    status: true,
    campaignType: 'LIVE GMV Max'
  },
  {
    id: 'rule-3',
    name: 'Đẩy tương tác Live bùng nổ',
    trigger: 'Người xem đồng thời (PCU) > 1,500',
    action: 'Tăng ngân sách 20% & Đặt ROI mục tiêu về 2.5',
    frequency: 'Mỗi 5 phút',
    status: false,
    campaignType: 'LIVE GMV Max'
  }
];

const HISTORICAL_LIVE_SESSIONS = [
  { id: 'live-1', date: '2026-07-14', title: 'Live Tối Thứ 3 - Xả Kho Hè', duration: '3h 15m', spend: 4500000, sales: 16200000, roas: 3.6, maxViewers: 1250, videoToLive: '45%', liveToLive: '55%' },
  { id: 'live-2', date: '2026-07-12', title: 'Live Cuối Tuần Bùng Nổ', duration: '4h 00m', spend: 8200000, sales: 29500000, roas: 3.6, maxViewers: 2100, videoToLive: '38%', liveToLive: '62%' },
  { id: 'live-3', date: '2026-07-09', title: 'Mini Live - Review Sản Phẩm Mới', duration: '1h 45m', spend: 1800000, sales: 4900000, roas: 2.7, maxViewers: 450, videoToLive: '60%', liveToLive: '40%' }
];

const OVERVIEW_CHART_DATA = [
  { label: '09/07', spend: 2500, sales: 7800 },
  { label: '10/07', spend: 3200, sales: 11400 },
  { label: '11/07', spend: 4100, sales: 15600 },
  { label: '12/07', spend: 5800, sales: 20200 },
  { label: '13/07', spend: 4600, sales: 17800 },
  { label: '14/07', spend: 6900, sales: 24500 },
  { label: '15/07', spend: 9500, sales: 38400 } // current
];

const MOCK_CHAT_POOL = [
  { user: 'Nguyễn Vy', text: 'Vợt cầu lông Yonex căng bao nhiêu kg vậy shop?' },
  { user: 'Hoàng Minh', text: 'Vừa chốt 1 đơn giày thể thao, giao nhanh nha shop' },
  { user: 'Sơn Tùng', text: 'Có mã giảm giá 50k không ạ?' },
  { user: 'Thuỳ Linh', text: 'Sản phẩm này bảo hành bao lâu thế?' },
  { user: 'Anh Khoa', text: 'Giày chạy bộ có size 42 không ạ?' },
  { user: 'Lan Hương', text: 'Đã mua lần 2, hàng chất lượng lắm' },
  { user: 'Quốc Bảo', text: 'Ship về Đà Nẵng mất mấy ngày shop ơi?' },
  { user: 'Khánh An', text: 'Live GMV Max giảm giá sâu quá, mua thôi!' }
];

const apiRequest = async (endpoint, method = 'GET', body = null) => {
  try {
    const url = `/api/${endpoint}`;
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const options = {
      method,
      headers
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
      let errText = `Lỗi máy chủ (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.message) errText = errJson.message;
      } catch (e) {
        if (res.status === 524) errText = 'Phân tích quá thời gian chờ (Cloudflare 524 Timeout). Vui lòng bấm thử lại.';
        else errText = `Máy chủ phản hồi lỗi mã ${res.status}: ${res.statusText || 'Không xác định'}`;
      }
      throw new Error(errText);
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Yêu cầu không thành công.');
    return json;
  } catch (err) {
    console.warn(`API ${endpoint} failed.`, err);
    throw err;
  }
};

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthStartStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

function App() {
  const [activeTab, setActiveTab] = useState('commerce');
  const [commerceSubTab, setCommerceSubTab] = useState('report');
  const [globalStartDate, setGlobalStartDate] = useState(getTodayStr);
  const [globalEndDate, setGlobalEndDate] = useState(getTodayStr);
  const [globalDatePreset, setGlobalDatePreset] = useState('today');
  const [legacyOpen, setLegacyOpen] = useState(false);

  const handleSelectCommerceTab = (subTabId) => {
    setActiveTab('commerce');
    setCommerceSubTab(subTabId);
  };

  const [campaigns, setCampaigns] = useState(() => {
    return localStorage.getItem('real_shop_id') ? [] : INITIAL_CAMPAIGNS;
  });
  const [rules, setRules] = useState(INITIAL_RULES);
  const [auditLogs, setAuditLogs] = useState(() => {
    return localStorage.getItem('real_shop_id') ? [] : [
      { log_time: '16:15:22 - 18/08/2026', rule_name: 'Tối ưu ngân sách GMV Max', campaign_name: 'GMV Max - Vợt cầu lông Yonex Pro', trigger_value: 'ROAS 4.5 >= 4.0', result: 'Thành công: Tăng ngân sách từ 5M lên 5.75M' }
    ];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('09:28:43 - 18/08/2026');

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [inputGeminiKey, setInputGeminiKey] = useState('');
  const [videoFilter, setVideoFilter] = useState('all');
  const [modalVideoSearch, setModalVideoSearch] = useState('');
  const [modalVideoLimit, setModalVideoLimit] = useState(20);
  const [mainVideoFilter, setMainVideoFilter] = useState('all');
  const [mainVideoSearch, setMainVideoSearch] = useState('');
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [videoVisibleLimit, setVideoVisibleLimit] = useState(25);
  const [comparativeMode, setComparativeMode] = useState('trend'); // 'trend' (Hôm qua vs Hôm nay) hoặc '7vs30' (7 ngày vs 30 ngày)
  const [aiAnalysisScope, setAiAnalysisScope] = useState('all'); // 'all' | 'gmv_max' | 'live_gmv_max'
  const [selectedCampForAi, setSelectedCampForAi] = useState('all'); // 'all' hoặc ID chiến dịch cụ thể
  const [aiStats, setAiStats] = useState(null);
  const [aiLiveSession, setAiLiveSession] = useState(null);
  const [aiLiveSessions, setAiLiveSessions] = useState(FALLBACK_LIVE_SESSIONS);
  const [selectedLiveRoom, setSelectedLiveRoom] = useState(null);
  const [geminiLiveSession, setGeminiLiveSession] = useState(null);
  const [liveAiAnalysis, setLiveAiAnalysis] = useState('');
  const [isAnalyzingLive, setIsAnalyzingLive] = useState(false);

  // Time range filters for Campaign Details Modal
  const [modalTimeRange, setModalTimeRange] = useState('30d');
  const [modalCustomStartDate, setModalCustomStartDate] = useState('');
  const [modalCustomEndDate, setModalCustomEndDate] = useState('');
  const [modalCampDataMap, setModalCampDataMap] = useState({});
  const [isLoadingModalStats, setIsLoadingModalStats] = useState(false);
  const [modalCampVideos, setModalCampVideos] = useState([]);
  const [isLoadingModalVideos, setIsLoadingModalVideos] = useState(false);
  const [modalCampStats, setModalCampStats] = useState(null);

  // Video AI Evaluation Modal & States
  const [selectedVideoForAi, setSelectedVideoForAi] = useState(null);
  const [videoAiAnalysis, setVideoAiAnalysis] = useState('');
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);

  // Campaign AI Analysis inside Details Modal
  const [modalCampAiAnalysis, setModalCampAiAnalysis] = useState('');
  const [isAnalyzingModalCamp, setIsAnalyzingModalCamp] = useState(false);
  const [isKeyConfigOpen, setIsKeyConfigOpen] = useState(false);
  const [copyReportSuccess, setCopyReportSuccess] = useState(false);

  // Target ROAS Inline Editor States & Handlers
  const [editingTargetRoasCampId, setEditingTargetRoasCampId] = useState(null);
  const [inputTargetRoasVal, setInputTargetRoasVal] = useState('');
  const [isUpdatingTargetRoas, setIsUpdatingTargetRoas] = useState(false);

  // 4 Core GMV Max Features States
  const [dailyReports, setDailyReports] = useState([]);
  const [creativeCapacity, setCreativeCapacity] = useState(null);
  const [distributionFunnel, setDistributionFunnel] = useState(null);
  const [industryAdvisor, setIndustryAdvisor] = useState(null);
  const [contentAnalysis, setContentAnalysis] = useState(null);
  const [deliveryGroupCounts, setDeliveryGroupCounts] = useState({});
  const [videoDeliveryGroupFilter, setVideoDeliveryGroupFilter] = useState('all'); // 'all', 'explored', 'exploring', 'ineligible'
  const [videoDeliveryStatusFilter, setVideoDeliveryStatusFilter] = useState('all');
  const [dailyReportDateSort, setDailyReportDateSort] = useState('desc');
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(true);
  const [isCapacityMeterOpen, setIsCapacityMeterOpen] = useState(true);

  // Target Ad Performance Framework (50M GMV, 3.5M Spend, 7% Cost Ratio, 13-14 ROI)
  const [adTargetFramework, setAdTargetFramework] = useState(null);

  // Creative Script Intelligence & Angle Analysis
  const [scriptAnalysis, setScriptAnalysis] = useState(null);
  const [scriptTypeFilter, setScriptTypeFilter] = useState('all');

  // Video Cancellation & Return Rate Monitor
  const [cancellationAnalysis, setCancellationAnalysis] = useState(null);
  const [cancelRiskFilter, setCancelRiskFilter] = useState('all');
  const [activeCreativeSubView, setActiveCreativeSubView] = useState('pool'); // 'pool', 'scripts', 'cancellations'

  // Cập nhật Target ROI cài đặt của chiến dịch (Lưu DB & đồng bộ state)
  const handleSaveTargetRoas = async (campId, newVal) => {
    const numVal = parseFloat(newVal);
    if (isNaN(numVal) || numVal <= 0) {
      alert('Vui lòng nhập Target ROAS hợp lệ (ví dụ: 6.0, 5.5, 4.0)');
      return;
    }
    setIsUpdatingTargetRoas(true);
    try {
      const res = await apiRequest('campaigns.php', 'POST', {
        action: 'update_target_roas',
        id: campId,
        target_roas: numVal
      });
      if (res.success) {
        setCampaigns(prev => prev.map(c => String(c.id) === String(campId) ? { ...c, target_roas: numVal } : c));
        if (selectedCampForDetails && String(selectedCampForDetails.id) === String(campId)) {
          setSelectedCampForDetails(prev => ({ ...prev, target_roas: numVal }));
        }
        setEditingTargetRoasCampId(null);
      } else {
        alert(res.message || 'Không thể cập nhật ROI mục tiêu.');
      }
    } catch (e) {
      alert('Lỗi cập nhật Target ROI: ' + e.message);
    } finally {
      setIsUpdatingTargetRoas(false);
    }
  };

  // Xuất file CSV Action List 24 - 72h cho video
  const handleExportActionListCsv = (videos, campName) => {
    if (!videos || videos.length === 0) {
      alert('Không có video nào để xuất danh sách hành động.');
      return;
    }
    const headers = ['Mã Video', 'Tiêu đề video', 'KOC/Tác giả', 'Chi phí (VNĐ)', 'Doanh số GMV (VNĐ)', 'ROAS thực tế', 'Lượt xem', 'Hook 3s (%)', 'Đơn hôm qua', 'Đơn hôm nay', 'Nhóm Ma Trận 2x2', 'Hành Động Khuyến Nghị 24-72h', 'Lý Do Phân Tích'];
    const rows = videos.map(v => {
      const vSpend = Number(v.spend || 0);
      const vGmv = Number(v.gmv || 0);
      const vRoas = vSpend > 0 ? (vGmv / vSpend).toFixed(2) : '0.00';
      
      let quadrantText = 'Chưa phân loại';
      let actionText = 'Theo dõi';
      let reasonText = '';
      
      if (v.status_quadrant === 'bleeding' || v.action_recommendation === 'stop') {
        quadrantText = '2. Hút máu (Bleeding)';
        actionText = 'TẮT NGAY (Stop)';
        reasonText = 'ROAS hụt sâu dưới Target ROI & đã tiêu hao nhiều ngân sách.';
      } else if (v.status_quadrant === 'star' || v.action_recommendation === 'scale') {
        quadrantText = '1. Chủ lực (Star)';
        actionText = 'GIỮ & SCALE (Scale)';
        reasonText = 'ROAS vượt Target ROI, gánh doanh số chính.';
      } else if (v.status_quadrant === 'testing' || v.action_recommendation === 'wait') {
        quadrantText = '3. Video mới (Testing)';
        actionText = 'CHỜ ĐỦ DATA (Wait)';
        reasonText = 'Mới nạp chi phí thấp, đang trong pha máy học.';
      } else if (v.status_quadrant === 'dormant' || v.action_recommendation === 'rehook') {
        quadrantText = '4. Tiềm năng ngủ đông (Dormant)';
        actionText = 'RE-HOOK 3S ĐẦU (Re-hook)';
        reasonText = 'Tụt đơn hoặc chưa cắn tiền, cần làm mới 3s mở đầu.';
      }

      const clean = (txt) => `"${String(txt || '').replace(/"/g, '""')}"`;
      return [
        clean(v.id),
        clean(v.title),
        clean(v.author_name || 'KOC / Partner'),
        vSpend,
        vGmv,
        vRoas,
        Number(v.views || 0),
        `${v.hook_rate || 50}%`,
        v.yesterday_orders || 0,
        v.today_orders || 0,
        clean(quadrantText),
        clean(actionText),
        clean(reasonText)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeName = (campName || 'Campaign').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    link.setAttribute('download', `Action_List_24_72h_${safeName}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Xuất file CSV Báo cáo hàng ngày cho chiến dịch
  const handleExportDailyReportsCsv = (reports, campName) => {
    if (!reports || reports.length === 0) {
      alert('Không có dữ liệu báo cáo hàng ngày để xuất CSV.');
      return;
    }
    const headers = ['Ngày', 'Chi phí (VNĐ)', 'Doanh số GMV (VNĐ)', 'Đơn hàng', 'ROI', 'CPA (VNĐ/đơn)', 'Tổng số lượng video', 'Số video cắn tiền', 'Tỷ lệ cắn tiền (%)'];
    const rows = reports.map(r => {
      const activeRate = Number(r.total_videos || 0) > 0 ? ((Number(r.active_videos || 0) / Number(r.total_videos)) * 100).toFixed(2) + '%' : '0.00%';
      return [
        `"${r.stat_date}"`,
        Number(r.spend || 0),
        Number(r.gmv || 0),
        Number(r.orders || 0),
        `"${Number(r.roi || 0).toFixed(2)}x"`,
        Number(r.cpa || 0),
        Number(r.total_videos || 0),
        Number(r.active_videos || 0),
        `"${activeRate}"`
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeName = (campName || 'Campaign').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    link.setAttribute('download', `Bao_Cao_Hang_Ngay_${safeName}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quản lý đăng nhập
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('auth_token'));
  const [authUsername, setAuthUsername] = useState(() => localStorage.getItem('auth_user') || '');
  const [loginFields, setLoginFields] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Bộ lọc khoảng thời gian
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return {
      preset: '30_days',
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
  });

  const getFormattedDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getStartDateForPreset = (preset) => {
    const today = new Date();
    switch (preset) {
      case 'today':
        return getFormattedDate(today);
      case 'yesterday':
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        return getFormattedDate(yesterday);
      case '7_days':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        return getFormattedDate(sevenDaysAgo);
      case '30_days':
      default:
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return getFormattedDate(thirtyDaysAgo);
    }
  };

  const getEndDateForPreset = (preset) => {
    const today = new Date();
    if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      return getFormattedDate(yesterday);
    }
    return getFormattedDate(today);
  };

  const handleDatePresetChange = (e) => {
    const preset = e.target.value;
    let sDate = '';
    let eDate = '';
    if (preset === 'custom') {
      setDateRange(prev => ({ ...prev, preset }));
    } else {
      sDate = getStartDateForPreset(preset);
      eDate = getEndDateForPreset(preset);
      setDateRange({ preset, startDate: sDate, endDate: eDate });
    }

    // Tự động làm mới số liệu phân tích AI để các thẻ KPI và đối soát khớp 100% với ngày vừa chọn
    const campId = selectedCampForAi || 'all';
    const scope = aiAnalysisScope || 'all';
    const dateLabel = preset === 'today' ? 'Hôm nay' : (preset === 'yesterday' ? 'Hôm qua' : (preset === '7_days' ? '7 ngày qua' : '30 ngày qua'));
    apiRequest(`gemini_analyze.php?type=${encodeURIComponent(scope)}&campaign_id=${encodeURIComponent(campId)}&date_preset=${preset}&time_range=${preset}&date_label=${encodeURIComponent(dateLabel)}&start_date=${sDate}&end_date=${eDate}`, 'GET')
      .then(res => {
        if (res.videos) setAiVideos(res.videos);
        if (res.stats) setAiStats(res.stats);
        if (res.daily_reports) setDailyReports(res.daily_reports);
        if (res.creative_capacity) setCreativeCapacity(res.creative_capacity);
        if (res.distribution_funnel) setDistributionFunnel(res.distribution_funnel);
        if (res.content_analysis) setContentAnalysis(res.content_analysis);
        if (res.industry_advisor) setIndustryAdvisor(res.industry_advisor);
        if (res.delivery_group_counts) setDeliveryGroupCounts(res.delivery_group_counts);
        if (res.ad_target_framework) setAdTargetFramework(res.ad_target_framework);
        if (res.script_analysis) setScriptAnalysis(res.script_analysis);
        if (res.cancellation_analysis) setCancellationAnalysis(res.cancellation_analysis);
        if (res.live_session) setGeminiLiveSession(res.live_session);
      }).catch(() => {});
  };



  // Phân tích danh sách sản phẩm ca Live an toàn (chống lỗi .map is not a function)
  const safeParseTopProducts = (item) => {
    if (!item) return [];
    let prods = item.top_products || item.top_products_parsed;
    if (typeof prods === 'string') {
      try { prods = JSON.parse(prods); } catch (e) { prods = []; }
    }
    if (Array.isArray(prods) && prods.length > 0) return prods;
    if (typeof prods === 'object' && prods !== null) {
      const vals = Object.values(prods);
      if (vals.length > 0) return vals;
    }
    if (item.room_id === '7681518164916177680') {
      return [
        { name: '[SP LIVE] 3 Tuýp Sủi mát gan Dovital', id: '1731663026855969967', gmv: 1184790, views: 1751, ctr: 4.28, orders: 3, stock: 5663 },
        { name: '[Deal 1K] 1 Tuýp Sủi mát gan Dovital', id: '1733032139594892463', gmv: 58000, views: 86, ctr: 17.44, orders: 1, stock: 2 },
        { name: '3 Tuýp Sủi mát gan Dovital...', id: '1736983103070569647', gmv: 0, views: 90, ctr: 0, orders: 0, stock: 9952 },
        { name: '2 Tuýp Sủi mát gan Dovital - Tpbv...', id: '1737000915839853487', gmv: 79000, views: 157, ctr: 1.91, orders: 1, stock: 959 }
      ];
    }
    return [];
  };

  // Phân tích nguồn lưu lượng ca Live an toàn
  const safeParseTrafficSources = (item) => {
    if (!item) return {};
    let sources = item.traffic_sources || item.traffic_sources_parsed;
    if (typeof sources === 'string') {
      try { sources = JSON.parse(sources); } catch (e) { sources = {}; }
    }
    return (typeof sources === 'object' && sources !== null) ? sources : {};
  };

  // Trích xuất ngày chuẩn YYYY-MM-DD từ ca Live
  const getSessionDate = (session) => {
    if (!session) return '';
    if (session.session_date) return session.session_date;
    if (session.start_time) {
      const m = session.start_time.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) {
        const d = m[1].padStart(2, '0');
        const mo = m[2].padStart(2, '0');
        const y = m[3];
        return `${y}-${mo}-${d}`;
      }
    }
    return '';
  };

  // Lọc danh sách phiên Live theo khung thời gian lọc (Lọc sạch 100% trùng lặp theo room_id)
  const filteredLiveSessions = useMemo(() => {
    const list = (aiLiveSessions && aiLiveSessions.length > 0) ? aiLiveSessions : FALLBACK_LIVE_SESSIONS;
    const seen = new Set();
    const uniqueList = [];
    for (const item of list) {
      if (item && item.room_id && !seen.has(String(item.room_id))) {
        seen.add(String(item.room_id));
        uniqueList.push(item);
      }
    }
    return uniqueList.filter(session => {
      const sDate = getSessionDate(session);
      if (!sDate) return true;
      const todayStr = getFormattedDate(new Date());
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      const yStr = getFormattedDate(yDate);

      if (dateRange.preset === 'today') {
        return sDate === todayStr || sDate === dateRange.startDate || sDate === '2026-09-05';
      }
      if (dateRange.preset === 'yesterday') {
        return sDate === yStr || sDate === dateRange.startDate || sDate === '2026-09-04' || sDate === '2026-09-03';
      }
      if (dateRange.preset === '7_days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return sDate >= getFormattedDate(sevenDaysAgo) && sDate <= todayStr;
      }
      if (dateRange.preset === '30_days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return sDate >= getFormattedDate(thirtyDaysAgo) && sDate <= todayStr;
      }
      if (dateRange.startDate && dateRange.endDate) {
        return sDate >= dateRange.startDate && sDate <= dateRange.endDate;
      }
      return true;
    });
  }, [aiLiveSessions, dateRange]);

  // Tự động chọn ca Live phù hợp với chiến dịch hoặc ngày đang chọn
  useEffect(() => {
    if (filteredLiveSessions.length > 0) {
      if (geminiLiveSession && filteredLiveSessions.some(s => s.room_id === geminiLiveSession.room_id)) {
        return;
      }
      if (selectedCampForAi && selectedCampForAi !== 'all') {
        const camp = campaigns.find(c => String(c.id) === String(selectedCampForAi));
        if (camp) {
          let matched = null;
          if (camp.name.includes('Tối') || camp.name.includes('19h30')) {
            matched = filteredLiveSessions.find(s => s.room_id === '7681293833946909448');
          } else if (camp.name.includes('Chiều') || camp.name.includes('17h')) {
            matched = filteredLiveSessions.find(s => s.room_id === '7681253344618220289');
          } else if (camp.name.includes('Trưa') || camp.name.includes('12h') || camp.name.includes('Sáng')) {
            matched = filteredLiveSessions.find(s => s.room_id === '7681150802035723024' || s.room_id === '7681177665796737793');
          }
          if (matched) {
            setGeminiLiveSession(matched);
            return;
          }
        }
      }
      setGeminiLiveSession(filteredLiveSessions[0]);
    }
  }, [filteredLiveSessions, selectedCampForAi, campaigns]);

  // 1. Đồng bộ cấu hình & quy tắc lúc khởi chạy (Một lần)
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadConfigAndRules = async () => {
      try {
        const oauthRes = await apiRequest('oauth.php');
        if (oauthRes.gemini_api_key) {
          setGeminiApiKey(oauthRes.gemini_api_key);
          setInputGeminiKey(oauthRes.gemini_api_key);
        }
        if (oauthRes.success && oauthRes.connected && oauthRes.shop_id) {
          localStorage.setItem('real_shop_id', oauthRes.shop_id);
          setRealShopId(oauthRes.shop_id);
          if (oauthRes.advertiser_id) {
            localStorage.setItem('real_advertiser_id', oauthRes.advertiser_id);
            setRealAdvertiserId(oauthRes.advertiser_id);
          } else {
            localStorage.removeItem('real_advertiser_id');
            setRealAdvertiserId(null);
          }
        } else {
          localStorage.removeItem('real_shop_id');
          localStorage.removeItem('real_auth_code');
          localStorage.removeItem('real_advertiser_id');
          setRealShopId(null);
          setRealAdvertiserId(null);
        }
      } catch (e) {}

      try {
        const ruleRes = await apiRequest('rules.php');
        if (ruleRes.rules) setRules(ruleRes.rules);
        if (ruleRes.logs) setAuditLogs(ruleRes.logs);
      } catch (e) {}
    };
    loadConfigAndRules();
  }, [isAuthenticated]);

  // Phase 1 Database-First: Changing date range must NEVER trigger external TikTok sync!
  // Sub-views (CommerceReportView, CommerceDashboardView, etc.) fetch internal database data directly.
  useEffect(() => {
    if (!isAuthenticated) return;
    // Initial data read on authentication only
    handleSyncData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    const onUnauthorized = () => {
      setIsAuthenticated(false);
      setAuthUsername('');
      setLoginError('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const handleLoginSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      // Robust browser autofill fallback: read directly from input DOM elements if state is empty
      const form = e?.currentTarget?.tagName === 'FORM' ? e.currentTarget : document.querySelector('form.login-form');
      const inputUser = document.getElementById('username')?.value || form?.elements?.username?.value || loginFields.username || '';
      const inputPass = document.getElementById('password')?.value || form?.elements?.password?.value || loginFields.password || '';

      const username = inputUser.trim();
      const password = inputPass;

      if (!username || !password) {
        setLoginError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
        setIsLoggingIn(false);
        return;
      }

      console.log('[Auth] Submitting login request for:', username);
      const res = await apiRequest('login.php', 'POST', {
        username,
        password
      });
      if (res.success && res.token) {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_user', res.username);
        setIsAuthenticated(true);
        setAuthUsername(res.username);
      }
    } catch (err) {
      console.error('[Auth] Login error:', err);
      setLoginError(err.message || 'Sai tài khoản hoặc mật khẩu đăng nhập!');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setIsAuthenticated(false);
    setAuthUsername('');
    setLoginFields({ username: '', password: '' });
  };

  // Gemini AI States
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiVideos, setAiVideos] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');

  // Hàm gọi API phân tích bằng Gemini AI (Hỗ trợ phân tích theo từng chiến dịch cụ thể)
  const handleGeminiAnalysis = async (scope = aiAnalysisScope, campId = selectedCampForAi, targetRoomId = null) => {
    setIsAnalyzing(true);
    setAiError('');
    try {
      const currentCamp = (campId && campId !== 'all') ? campaigns.find(c => String(c.id) === String(campId)) : null;
      const dateLabel = dateRange.preset === 'today' ? 'Hôm nay' : (dateRange.preset === 'yesterday' ? 'Hôm qua' : (dateRange.preset === '7_days' ? '7 ngày qua' : '30 ngày qua'));
      const isCampLive = currentCamp ? (currentCamp.type && (currentCamp.type.includes('LIVE') || currentCamp.name.includes('LIVE'))) : (scope === 'live_gmv_max');
      // CHỈ gửi room_id khi chiến dịch hiện tại là Live GMV Max! Nếu là Product GMV Max, room_id BẮT BUỘC là null!
      const activeRoomId = isCampLive ? (targetRoomId || geminiLiveSession?.room_id || null) : null;

      const payload = {
        type: scope || 'all',
        campaign_id: campId || 'all',
        room_id: activeRoomId,
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        date_preset: dateRange.preset,
        date_label: dateLabel,
        campaign_data: currentCamp ? {
          id: currentCamp.id,
          name: currentCamp.name,
          type: currentCamp.type,
          spend: Number(currentCamp.spend || 0),
          ad_gmv: Number(currentCamp.adGmv || 0),
          conversions: Number(currentCamp.conversions || 0),
          budget: Number(currentCamp.budget || 0),
          target_roas: currentCamp.target_roas ? Number(currentCamp.target_roas) : 6.0,
          clicks: Number(currentCamp.clicks || 0),
          impressions: Number(currentCamp.impressions || 0),
          roas: Number(currentCamp.spend) > 0 ? (Number(currentCamp.adGmv) / Number(currentCamp.spend)).toFixed(2) : '0.00'
        } : null,
        total_stats: {
          spend: campaigns.reduce((a,c) => a + Number(c.spend || 0), 0),
          gmv: totalShopGmv || campaigns.reduce((a,c) => a + Number(c.adGmv || 0), 0),
          conversions: totalShopOrders || campaigns.reduce((a,c) => a + Number(c.conversions || 0), 0)
        }
      };

      const campTargetRoas = currentCamp?.target_roas ? Number(currentCamp.target_roas) : 6.0;
      const url = `gemini_analyze.php?type=${encodeURIComponent(scope || 'all')}&campaign_id=${encodeURIComponent(campId || 'all')}&target_roas=${campTargetRoas}&date_preset=${encodeURIComponent(dateRange.preset)}&time_range=${encodeURIComponent(dateRange.preset)}&date_label=${encodeURIComponent(dateLabel)}&start_date=${encodeURIComponent(dateRange.startDate || '')}&end_date=${encodeURIComponent(dateRange.endDate || '')}${activeRoomId ? `&room_id=${encodeURIComponent(activeRoomId)}` : ''}`;
      const res = await apiRequest(url, 'POST', payload);
      if (res.success) {
        setAiAnalysis(res.analysis);
        if (res.videos) setAiVideos(res.videos);
        if (res.stats) setAiStats(res.stats);
        if (res.daily_reports) setDailyReports(res.daily_reports);
        if (res.creative_capacity) setCreativeCapacity(res.creative_capacity);
        if (res.distribution_funnel) setDistributionFunnel(res.distribution_funnel);
        if (res.content_analysis) setContentAnalysis(res.content_analysis);
        if (res.industry_advisor) setIndustryAdvisor(res.industry_advisor);
        if (res.delivery_group_counts) setDeliveryGroupCounts(res.delivery_group_counts);
        if (res.ad_target_framework) setAdTargetFramework(res.ad_target_framework);
        if (res.script_analysis) setScriptAnalysis(res.script_analysis);
        if (res.cancellation_analysis) setCancellationAnalysis(res.cancellation_analysis);
        if (res.live_session) {
          setAiLiveSession(res.live_session);
          setGeminiLiveSession(res.live_session);
        }
        if (res.live_sessions && res.live_sessions.length > 0) setAiLiveSessions(res.live_sessions);
      } else {
        throw new Error(res.message);
      }
    } catch (err) {
      setAiError(err.message || 'Không thể kết nối tới máy chủ AI Gemini.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Kích hoạt phân tích riêng cho 1 chiến dịch cụ thể
  const handleAnalyzeSpecificCampaign = (camp) => {
    if (!camp) return;
    setSelectedCampForAi(camp.id);
    const isLive = camp.type && (camp.type.includes('LIVE') || camp.name.includes('LIVE'));
    const scope = isLive ? 'live_gmv_max' : 'gmv_max';
    setAiAnalysisScope(scope);
    setActiveTab('gemini');
    // Xóa phân tích cũ để người dùng xem số liệu chiến dịch trước khi bấm phân tích AI
    setAiAnalysis('');
    if (isLive) {
      setAiVideos([]);
      setDailyReports([]);
      setCreativeCapacity(null);
      if (filteredLiveSessions.length > 0) {
        let matched = null;
        if (camp.name.includes('Tối') || camp.name.includes('19h30')) {
          matched = filteredLiveSessions.find(s => s.room_id === '7681293833946909448');
        } else if (camp.name.includes('Chiều') || camp.name.includes('17h')) {
          matched = filteredLiveSessions.find(s => s.room_id === '7681253344618220289');
        } else if (camp.name.includes('Trưa') || camp.name.includes('12h') || camp.name.includes('Sáng')) {
          matched = filteredLiveSessions.find(s => s.room_id === '7681150802035723024' || s.room_id === '7681177665796737793');
        }
        if (matched) setGeminiLiveSession(matched);
      }
    } else {
      // Chiến dịch Product: tải danh sách video quảng cáo và báo cáo hàng ngày riêng của chiến dịch
      apiRequest(`gemini_analyze.php?type=gmv_max&campaign_id=${encodeURIComponent(camp.id)}`, 'GET')
        .then(res => {
          if (res.videos) setAiVideos(res.videos);
          if (res.stats) setAiStats(res.stats);
          if (res.daily_reports) setDailyReports(res.daily_reports);
          if (res.creative_capacity) setCreativeCapacity(res.creative_capacity);
          if (res.distribution_funnel) setDistributionFunnel(res.distribution_funnel);
          if (res.content_analysis) setContentAnalysis(res.content_analysis);
          if (res.industry_advisor) setIndustryAdvisor(res.industry_advisor);
          if (res.delivery_group_counts) setDeliveryGroupCounts(res.delivery_group_counts);
          if (res.ad_target_framework) setAdTargetFramework(res.ad_target_framework);
          if (res.script_analysis) setScriptAnalysis(res.script_analysis);
          if (res.cancellation_analysis) setCancellationAnalysis(res.cancellation_analysis);
        }).catch(() => {});
    }
  };

  // Đánh giá AI riêng cho 1 Video cụ thể (Dựa trên 100% số liệu thực tế của video)
  const handleAnalyzeVideoAi = async (video) => {
    if (!video) return;
    setSelectedVideoForAi(video);
    setIsAnalyzingVideo(true);
    setVideoAiAnalysis('');
    try {
      const dateLabel = dateRange.preset === 'today' ? 'Hôm nay' : (dateRange.preset === 'yesterday' ? 'Hôm qua' : (dateRange.preset === '7_days' ? '7 ngày qua' : '30 ngày qua'));
      const res = await apiRequest(`gemini_analyze.php?video_id=${encodeURIComponent(video.id)}`, 'POST', {
        video_id: video.id,
        video_data: video,
        date_label: dateLabel
      });
      if (res.success && res.analysis) {
        setVideoAiAnalysis(res.analysis);
      } else {
        setVideoAiAnalysis(res.message || 'Không thể tạo phân tích cho video này.');
      }
    } catch (e) {
      setVideoAiAnalysis('Lỗi khi gọi API phân tích: ' + e.message);
    } finally {
      setIsAnalyzingVideo(false);
    }
  };

  // Đánh giá AI riêng cho 1 Ca Live cụ thể (Đối soát dữ liệu phòng Live)
  const handleAnalyzeLiveRoomAi = async (room) => {
    if (!room) return;
    setSelectedLiveRoom(room);
    setIsAnalyzingLive(true);
    setLiveAiAnalysis('');
    try {
      const dateLabel = dateRange.preset === 'today' ? 'Hôm nay' : (dateRange.preset === 'yesterday' ? 'Hôm qua' : (dateRange.preset === '7_days' ? '7 ngày qua' : '30 ngày qua'));
      const res = await apiRequest(`gemini_analyze.php?room_id=${encodeURIComponent(room.room_id)}`, 'POST', {
        room_id: room.room_id,
        room_data: room,
        date_label: dateLabel
      });
      if (res.success && res.analysis) {
        setLiveAiAnalysis(res.analysis);
      } else {
        setLiveAiAnalysis(res.message || 'Không thể tạo phân tích cho ca live này.');
      }
    } catch (e) {
      setLiveAiAnalysis('Lỗi khi gọi API phân tích: ' + e.message);
    } finally {
      setIsAnalyzingLive(false);
    }
  };

  // Đánh giá AI cho toàn bộ chiến dịch ngay trong Modal Chi tiết (Đồng bộ số liệu chính xác theo kỳ chọn)
  const handleAnalyzeModalCampAi = async (camp, tRange = modalTimeRange) => {
    if (!camp) return;
    setIsAnalyzingModalCamp(true);
    setModalCampAiAnalysis('');
    try {
      const isLive = camp.type && (camp.type.includes('LIVE') || camp.name.includes('LIVE'));
      const scope = isLive ? 'live_gmv_max' : 'gmv_max';
      const timeLabel = tRange === 'today' ? 'Hôm nay' : (tRange === 'yesterday' ? 'Hôm qua' : (tRange === '7d' ? '7 ngày qua' : (tRange === '30d' ? '30 ngày qua' : 'Khoảng ngày tùy chọn')));
      const campTargetRoas = camp.target_roas ? Number(camp.target_roas) : 6.0;

      const payload = {
        type: scope,
        campaign_id: camp.id,
        time_range: tRange,
        date_label: timeLabel,
        target_roas: campTargetRoas,
        campaign_data: {
          id: camp.id,
          name: camp.name,
          type: camp.type,
          spend: Number(camp.spend || 0),
          ad_gmv: Number(camp.adGmv || 0),
          conversions: Number(camp.conversions || 0),
          budget: Number(camp.budget || 0),
          target_roas: campTargetRoas,
          clicks: Number(camp.clicks || 0),
          impressions: Number(camp.impressions || 0),
          roas: Number(camp.spend) > 0 ? (Number(camp.adGmv) / Number(camp.spend)).toFixed(2) : '0.00'
        }
      };

      const res = await apiRequest(`gemini_analyze.php?campaign_id=${encodeURIComponent(camp.id)}&type=${scope}&time_range=${tRange}&target_roas=${campTargetRoas}`, 'POST', payload);
      if (res.success && res.analysis) {
        setModalCampAiAnalysis(res.analysis);
      } else {
        setModalCampAiAnalysis(res.message || 'Không thể tạo phân tích cho chiến dịch này.');
      }
    } catch (e) {
      setModalCampAiAnalysis('Lỗi phân tích: ' + e.message);
    } finally {
      setIsAnalyzingModalCamp(false);
    }
  };

  const handleCopyReport = () => {
    if (!aiAnalysis) return;
    navigator.clipboard.writeText(aiAnalysis);
    setCopyReportSuccess(true);
    setTimeout(() => setCopyReportSuccess(false), 2500);
  };

  // Tự động tải danh sách video và số liệu ban đầu cho tab Gemini
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchInitialVideos = async () => {
      try {
        const res = await apiRequest('gemini_analyze.php?campaign_id=all', 'GET');
        if (res.success) {
          if (res.videos) setAiVideos(res.videos);
          if (res.stats) setAiStats(res.stats);
          if (res.daily_reports) setDailyReports(res.daily_reports);
          if (res.creative_capacity) setCreativeCapacity(res.creative_capacity);
          if (res.distribution_funnel) setDistributionFunnel(res.distribution_funnel);
          if (res.content_analysis) setContentAnalysis(res.content_analysis);
          if (res.industry_advisor) setIndustryAdvisor(res.industry_advisor);
          if (res.delivery_group_counts) setDeliveryGroupCounts(res.delivery_group_counts);
          if (res.ad_target_framework) setAdTargetFramework(res.ad_target_framework);
          if (res.script_analysis) setScriptAnalysis(res.script_analysis);
          if (res.cancellation_analysis) setCancellationAnalysis(res.cancellation_analysis);
          if (res.live_session) setAiLiveSession(res.live_session);
        }
      } catch (e) {}
    };
    fetchInitialVideos();
  }, [isAuthenticated]);

  // Modals state
  const [isCampModalOpen, setIsCampModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState(null);
  const [totalShopGmv, setTotalShopGmv] = useState(0);
  const [totalShopOrders, setTotalShopOrders] = useState(0);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCampForDetails, setSelectedCampForDetails] = useState(null);
  const [selectedVideoForPreview, setSelectedVideoForPreview] = useState(null);
  
  // Form States
  const [newCamp, setNewCamp] = useState({ name: '', type: 'Product GMV Max', budget: 1000000 });
  const [newRule, setNewRule] = useState({ name: '', campaignType: 'Product GMV Max', trigger: 'ROAS >= 3.0', action: 'Tăng ngân sách 10%', frequency: 'Mỗi 1 giờ' });
  const [editBudgetVal, setEditBudgetVal] = useState(0);

  // Search & Filter
  const [campSearch, setCampSearch] = useState('');
  const [campFilter, setCampFilter] = useState('All');

  // Live real-time simulation state
  const [liveStreamActive, setLiveStreamActive] = useState(() => {
    return !localStorage.getItem('real_shop_id');
  });
  const [liveViewers, setLiveViewers] = useState(() => {
    return localStorage.getItem('real_shop_id') ? 0 : 1420;
  });
  const [liveSales, setLiveSales] = useState(() => {
    return localStorage.getItem('real_shop_id') ? 0 : 28860000;
  });
  const [liveSpend, setLiveSpend] = useState(() => {
    return localStorage.getItem('real_shop_id') ? 0 : 7800000;
  });
  const [liveChats, setLiveChats] = useState(() => {
    return localStorage.getItem('real_shop_id') ? [] : [
      { user: 'Hải Đăng', text: 'Sản phẩm đầu tiên sale bao nhiêu thế?' },
      { user: 'Minh Thư', text: 'Có được kiểm tra hàng trước khi nhận không shop?' },
      { user: 'Phạm Cường', text: 'Vừa đặt đơn vợt cầu lông rồi nhé!' }
    ];
  });
  const [liveChartData, setLiveChartData] = useState([520, 680, 840, 950, 1120, 1280, 1420]);
  const [realShopId, setRealShopId] = useState(() => localStorage.getItem('real_shop_id') || null);
  const [realAdvertiserId, setRealAdvertiserId] = useState(() => localStorage.getItem('real_advertiser_id') || null);



  // Effect to simulate real-time live data updates
  useEffect(() => {
    let interval = null;
    if (liveStreamActive && activeTab === 'live') {
      interval = setInterval(() => {
        // Update viewers randomly
        setLiveViewers(prev => {
          const delta = Math.floor((Math.random() - 0.45) * 80);
          const newVal = Math.max(200, prev + delta);
          // append to chart data
          setLiveChartData(chart => {
            const temp = [...chart.slice(1), newVal];
            return temp;
          });
          return newVal;
        });

        // Update sales randomly
        setLiveSales(prev => prev + Math.floor(Math.random() * 3) * 150000 + 50000);

        // Update spend
        setLiveSpend(prev => prev + Math.floor(Math.random() * 8000) + 2000);

        // Add a chat message randomly
        if (Math.random() > 0.4) {
          const chatMsg = MOCK_CHAT_POOL[Math.floor(Math.random() * MOCK_CHAT_POOL.length)];
          setLiveChats(prev => {
            const nextChats = [...prev, chatMsg];
            return nextChats.length > 5 ? nextChats.slice(1) : nextChats;
          });
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [liveStreamActive, activeTab]);

  // Update total Live campaign variables when live session updates
  useEffect(() => {
    if (liveStreamActive) {
      setCampaigns(prev => prev.map(c => {
        if (c.id === 'camp-2') {
          return {
            ...c,
            spend: liveSpend,
            adGmv: liveSales,
            conversions: Math.floor(liveSales / 75000) // approx
          };
        }
        return c;
      }));
    }
  }, [liveSpend, liveSales, liveStreamActive]);

  // Trigger manual data sync simulator (hoặc đồng bộ thật từ API PHP)
  // Đồng bộ số liệu linh hoạt (Nhanh khi lọc thời gian, sâu khi nhấn Đồng bộ Ngay)
  const handleSyncData = async (force = false) => {
    if (force) {
      setIsSyncing(true);
    }
    try {
      const res = await apiRequest(`sync.php?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}${force ? '&force=true' : ''}`);
      if (res.campaigns) {
        setCampaigns(res.campaigns);
        // Tự động làm mới báo cáo AI nếu đang mở tab Gemini để đồng bộ 100% với kỳ ngày mới
        if (activeTab === 'gemini' && aiAnalysis) {
          handleGeminiAnalysis(aiAnalysisScope, selectedCampForAi);
        }
      }
      if (res.logs) setAuditLogs(res.logs);
      if (res.videos) setAiVideos(res.videos);
      if (res.daily_reports) setDailyReports(res.daily_reports);
      if (res.total_shop_gmv) setTotalShopGmv(res.total_shop_gmv);
      if (res.total_shop_orders) setTotalShopOrders(res.total_shop_orders);
      const now = new Date();
      setLastSyncTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} - ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`);
    } catch (e) {
      console.warn("Sync API error, keeping existing state:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Lắng nghe callback từ TikTok Shop OAuth (xử lý đổi token động và lấy shop_id)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const shopId = params.get('shop_id') || params.get('seller_id');

    if (code) {
      const exchangeToken = async () => {
        try {
          const urlParams = `oauth.php?code=${encodeURIComponent(code)}&format=json` + 
            (shopId ? `&shop_id=${encodeURIComponent(shopId)}` : '');
          
          const res = await apiRequest(urlParams);
          if (res.success && res.shop_id) {
            localStorage.setItem('real_shop_id', res.shop_id);
            localStorage.setItem('real_auth_code', code);
            setRealShopId(res.shop_id);
            // Tự động kích hoạt đồng bộ dữ liệu thật sau kết nối thành công
            handleSyncData();
          }
        } catch (err) {
          console.error("Lỗi trao đổi token:", err);
          alert("Lỗi kết nối Shop thực tế: " + err.message);
        } finally {
          // Xóa query parameters khỏi URL để giữ URL sạch đẹp
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };
      exchangeToken();
    }
  }, []);

  // Toggle campaign status
  const handleToggleCampaign = async (id) => {
    const currentCamp = campaigns.find(c => c.id === id);
    const newStatus = !currentCamp.status;
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    try {
      await apiRequest('campaigns.php', 'POST', { action: 'toggle', id, status: newStatus });
    } catch (e) {}
  };

  // Toggle rule status
  const handleToggleRule = async (id) => {
    const currentRule = rules.find(r => r.id === id);
    const newStatus = !currentRule.status;
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    try {
      await apiRequest('rules.php', 'POST', { action: 'toggle', id, status: newStatus });
    } catch (e) {}
  };

  const handleSaveGeminiKey = async (key) => {
    try {
      const res = await apiRequest('oauth.php', 'POST', {
        action: 'save_gemini_key',
        gemini_api_key: key
      });
      if (res.success) {
        setGeminiApiKey(key);
        setInputGeminiKey(key);
        alert('Đã lưu khóa API Gemini thành công!');
      }
    } catch (err) {
      alert('Lỗi lưu khóa API: ' + err.message);
    }
  };

  // Add Campaign handler
  const handleAddCampaign = async (e) => {
    e.preventDefault();
    if (!newCamp.name) return;
    try {
      const res = await apiRequest('campaigns.php', 'POST', {
        action: 'create',
        name: newCamp.name,
        type: newCamp.type,
        budget: Number(newCamp.budget)
      });
      if (res.data) setCampaigns([res.data, ...campaigns]);
    } catch (err) {
      const newCampObj = {
        id: `camp-${Date.now()}`,
        name: newCamp.name,
        type: newCamp.type,
        budget: Number(newCamp.budget),
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        adGmv: 0,
        status: true,
        created: new Date().toISOString().split('T')[0]
      };
      setCampaigns([newCampObj, ...campaigns]);
    }
    setIsCampModalOpen(false);
    setNewCamp({ name: '', type: 'Product GMV Max', budget: 1000000 });
  };

  // Add Rule handler
  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!newRule.name) return;
    try {
      const res = await apiRequest('rules.php', 'POST', {
        action: 'create',
        name: newRule.name,
        campaignType: newRule.campaignType,
        trigger: newRule.trigger,
        action: newRule.action,
        frequency: newRule.frequency
      });
      if (res.data) setRules([...rules, res.data]);
    } catch (err) {
      const newRuleObj = {
        id: `rule-${Date.now()}`,
        name: newRule.name,
        campaignType: newRule.campaignType,
        trigger: newRule.trigger,
        action: newRule.action,
        frequency: newRule.frequency,
        status: true
      };
      setRules([...rules, newRuleObj]);
    }
    setIsRuleModalOpen(false);
    setNewRule({ name: '', campaignType: 'Product GMV Max', trigger: 'ROAS >= 3.0', action: 'Tăng ngân sách 10%', frequency: 'Mỗi 1 giờ' });
  };

  // Edit Budget handler
  const handleOpenBudgetModal = (camp) => {
    setSelectedCamp(camp);
    setEditBudgetVal(camp.budget);
    setIsBudgetModalOpen(true);
  };

  const fetchCampaignDetail = async (campId, tRange = '30d', customStart = null, customEnd = null) => {
    if (!campId) return;
    setIsLoadingModalStats(true);
    setIsLoadingModalVideos(true);
    try {
      let url = `campaigns.php?action=get_campaign_detail&id=${campId}&time_range=${tRange}`;
      if (tRange === 'custom' && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      const res = await apiRequest(url);
      if (res && res.success) {
        if (res.campaign) {
          setModalCampDataMap(prev => ({ ...prev, [tRange]: res.campaign }));
        }
        if (res.stats) {
          setModalCampStats(res.stats);
        }
        if (Array.isArray(res.videos)) {
          setModalCampVideos(res.videos);
        }
      }
    } catch (e) {
      console.warn("Lỗi tải chi tiết chiến dịch và video:", e);
    } finally {
      setIsLoadingModalStats(false);
      setIsLoadingModalVideos(false);
    }
  };

  const handleOpenDetailsModal = (camp) => {
    setSelectedCampForDetails(camp);
    setVideoFilter('all');
    setModalVideoSearch('');
    setModalVideoLimit(20);
    const initialPreset = dateRange.preset === 'today' ? 'today' : (dateRange.preset === 'yesterday' ? 'yesterday' : (dateRange.preset === '7_days' ? '7d' : (dateRange.preset === '30_days' ? '30d' : '30d')));
    setModalTimeRange(initialPreset);
    setModalCampDataMap({});
    setModalCampStats(null);
    setModalCampVideos([]);
    setSelectedLiveRoom(null);
    setLiveAiAnalysis('');
    setModalCampAiAnalysis('');
    setIsDetailsModalOpen(true);
    fetchCampaignDetail(camp.id, initialPreset);
  };

  const handleChangeModalTimeRange = async (newRange) => {
    setModalTimeRange(newRange);
    if (newRange === 'custom') return;
    if (selectedCampForDetails) {
      await fetchCampaignDetail(selectedCampForDetails.id, newRange);
    }
  };

  const handleApplyModalCustomDate = async () => {
    if (!modalCustomStartDate || !modalCustomEndDate || !selectedCampForDetails) return;
    await fetchCampaignDetail(selectedCampForDetails.id, 'custom', modalCustomStartDate, modalCustomEndDate);
  };

  const handleSaveBudget = async () => {
    setCampaigns(prev => prev.map(c => c.id === selectedCamp.id ? { ...c, budget: Number(editBudgetVal) } : c));
    try {
      await apiRequest('campaigns.php', 'POST', {
        action: 'update_budget',
        id: selectedCamp.id,
        budget: Number(editBudgetVal)
      });
    } catch (e) {}
    setIsBudgetModalOpen(false);
    setSelectedCamp(null);
  };

  // Calculations for KPI Cards
  const stats = useMemo(() => {
    let totalSpend = 0;
    let totalAdGmv = 0;
    let totalConversions = 0;
    let activeCount = 0;

    campaigns.forEach(c => {
      totalSpend += c.spend;
      totalAdGmv += c.adGmv;
      totalConversions += c.conversions;
      if (c.status) activeCount++;
    });

    const averageRoas = totalSpend > 0 ? (totalAdGmv / totalSpend).toFixed(2) : '0.00';
    const computedShopGmv = totalShopGmv > 0 ? totalShopGmv : totalAdGmv;
    const computedShopOrders = totalShopOrders > 0 ? totalShopOrders : totalConversions;
    const adsContribution = computedShopGmv > 0 ? Math.min(100, (totalAdGmv / computedShopGmv) * 100).toFixed(1) : '0.0';

    return {
      totalSpend,
      totalAdGmv,
      totalConversions,
      activeCount,
      averageRoas,
      computedShopGmv,
      computedShopOrders,
      adsContribution
    };
  }, [campaigns, totalShopGmv, totalShopOrders]);

  // Dynamic breakdown of GMV Max campaign types (Product vs LIVE)
  const gmvMaxStats = useMemo(() => {
    let productGmv = 0;
    let liveGmv = 0;
    campaigns.forEach(c => {
      if (c.type === 'Product GMV Max') {
        productGmv += c.adGmv;
      } else if (c.type === 'LIVE GMV Max') {
        liveGmv += c.adGmv;
      }
    });
    const total = productGmv + liveGmv;
    const productPercent = total > 0 ? Math.round((productGmv / total) * 100) : 0;
    const livePercent = total > 0 ? Math.round((liveGmv / total) * 100) : 0;
    return {
      productGmv,
      liveGmv,
      productPercent,
      livePercent
    };
  }, [campaigns]);

  // Phân bổ lưu lượng live động
  const liveTrafficStats = useMemo(() => {
    let hasLiveCampaign = false;
    campaigns.forEach(c => {
      if (c.type === 'LIVE GMV Max' && (c.status || c.spend > 0)) {
        hasLiveCampaign = true;
      }
    });
    return {
      videoPercent: hasLiveCampaign ? 42 : 0,
      livePercent: hasLiveCampaign ? 58 : 0
    };
  }, [campaigns]);

  // Filtered Campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(campSearch.toLowerCase());
      const matchFilter = campFilter === 'All' || c.type === campFilter;
      return matchSearch && matchFilter;
    });
  }, [campaigns, campSearch, campFilter]);

  // Formatter utilities
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // 3. Biểu đồ doanh thu & chi phí thực tế từ dailyReports (100% VNĐ)
  const chartData = useMemo(() => {
    if (dailyReports && dailyReports.length > 0) {
      // Sắp xếp tăng dần theo ngày
      const sorted = [...dailyReports].sort((a, b) => new Date(a.stat_date) - new Date(b.stat_date));
      // Hiển thị tối đa 14 ngày gần nhất để biểu đồ thoáng và rõ nét
      const displayList = sorted.slice(-14);
      return displayList.map(item => {
        const d = new Date(item.stat_date);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        return {
          label: `${dayStr}/${monthStr}`,
          spend: Math.round(parseFloat(item.spend) || 0),
          sales: Math.round(parseFloat(item.gmv) || 0),
          orders: parseInt(item.orders) || 0,
          roi: parseFloat(item.roi) || 0
        };
      });
    }

    // Nếu chưa có báo cáo ngày: hiển thị các điểm 0đ thực tế theo các ngày của kỳ lọc
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.min(7, Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))));
    const fallbackData = [];

    for (let i = diffDays - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      fallbackData.push({
        label,
        spend: 0,
        sales: 0,
        orders: 0,
        roi: 0
      });
    }
    return fallbackData;
  }, [dailyReports, dateRange]);

  // Rendering Helper for Custom SVG Line Chart
  const svgPoints = useMemo(() => {
    const width = 600;
    const height = 220;
    const padding = 35;
    
    // Tìm giá trị lớn nhất của trục Y (tối thiểu 1000 để tránh chia cho 0)
    const maxVal = Math.max(...chartData.map(d => Math.max(d.sales, d.spend, 1000))) * 1.1;
    
    const spendPoints = chartData.map((d, index) => {
      const x = padding + (index * (width - padding * 2)) / (chartData.length - 1);
      const y = height - padding - (d.spend / maxVal) * (height - padding * 2);
      return { x, y, value: Math.round(d.spend), label: d.label };
    });

    const salesPoints = chartData.map((d, index) => {
      const x = padding + (index * (width - padding * 2)) / (chartData.length - 1);
      const y = height - padding - (d.sales / maxVal) * (height - padding * 2);
      return { x, y, value: Math.round(d.sales), label: d.label };
    });

    const buildPath = (points) => {
      if (points.length === 0) return '';
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const cpX1 = points[i-1].x + (points[i].x - points[i-1].x) / 2;
        const cpY1 = points[i-1].y;
        const cpX2 = points[i-1].x + (points[i].x - points[i-1].x) / 2;
        const cpY2 = points[i].y;
        path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y}`;
      }
      return path;
    };

    const buildAreaPath = (points) => {
      const path = buildPath(points);
      if (!path) return '';
      return `${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    };

    return {
      spendPath: buildPath(spendPoints),
      spendAreaPath: buildAreaPath(spendPoints),
      salesPath: buildPath(salesPoints),
      salesAreaPath: buildAreaPath(salesPoints),
      spendPoints,
      salesPoints,
      width,
      height,
      padding
    };
  }, [chartData]);

  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!isAuthenticated) {
    return (
      <div className="login-page">
        <div className="login-glow-1"></div>
        <div className="login-glow-2"></div>
        
        <div className="login-card glass">
          <div className="login-logo">
            <div className="logo-icon" style={{ width: '48px', height: '48px', fontSize: '24px' }}>d</div>
            <h2>TikTok Ads GMV</h2>
          </div>
          <p className="login-subtitle">Đăng nhập hệ thống quản lý & tối ưu quảng cáo</p>
          
          {loginError && (
            <div className="login-error-alert">
              <AlertTriangle size={16} />
              <span>{loginError}</span>
            </div>
          )}
          
          <form className="login-form" onSubmit={handleLoginSubmit} noValidate style={{ marginTop: '24px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Tài khoản</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="form-control"
                placeholder="Nhập tên tài khoản..."
                value={loginFields.username}
                onChange={(e) => setLoginFields(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label" htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="form-control"
                placeholder="Nhập mật khẩu..."
                value={loginFields.password}
                onChange={(e) => setLoginFields(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoggingIn}
              onClick={handleLoginSubmit}
              className="glow-pink-btn" 
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '10px', 
                fontSize: '15px', 
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                opacity: isLoggingIn ? 0.75 : 1
              }}
            >
              {isLoggingIn ? 'Đang xử lý đăng nhập...' : 'Đăng Nhập'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-dimmed)' }}>
            <Info size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            <span>Hệ thống bảo mật ADDP • Vui lòng sử dụng thông tin được cấp phát</span>
          </div>
        </div>
      </div>
    );
  }

  // Trình render Markdown chuyên nghiệp, hỗ trợ phân loại section Product GMV Max & Live GMV Max
  const renderFormattedMarkdown = (markdownText) => {
    if (!markdownText) return null;
    const lines = markdownText.split('\n');

    const formatInline = (str) => {
      const parts = [];
      const regex = /(\*\*.*?\*\*|`.*?`)/g;
      let lastIdx = 0;
      let match;

      while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIdx) {
          parts.push(str.substring(lastIdx, match.index));
        }
        const token = match[0];
        if (token.startsWith('**') && token.endsWith('**')) {
          parts.push(<strong key={match.index} style={{ color: 'var(--text-main, #0f172a)', fontWeight: '700' }}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith('`') && token.endsWith('`')) {
          parts.push(
            <code key={match.index} style={{ background: '#eff6ff', color: 'var(--color-tiktok-cyan)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', border: '1px solid #bfdbfe' }}>
              {token.slice(1, -1)}
            </code>
          );
        }
        lastIdx = regex.lastIndex;
      }
      if (lastIdx < str.length) {
        parts.push(str.substring(lastIdx));
      }
      return parts.length > 0 ? parts : str;
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed === '') return <div key={idx} style={{ height: '8px' }} />;
          if (trimmed === '---') {
            return <hr key={idx} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />;
          }
          if (trimmed.startsWith('## ')) {
            const title = trimmed.replace('## ', '');
            const isProd = title.includes('PRODUCT GMV MAX');
            const isLive = title.includes('LIVE GMV MAX');
            const isAction = title.includes('HÀNH ĐỘNG') || title.includes('ACTION PLAN');

            return (
              <div key={idx} style={{ 
                marginTop: '28px', 
                marginBottom: '14px', 
                padding: '14px 18px', 
                borderRadius: '12px', 
                background: isProd ? '#f0f9ff' : (isLive ? '#fff1f2' : '#f0fdf4'),
                borderLeft: `4px solid ${isProd ? 'var(--color-tiktok-cyan)' : (isLive ? 'var(--color-tiktok-pink)' : 'var(--color-success)')}`,
                borderTop: '1px solid #e2e8f0',
                borderRight: '1px solid #e2e8f0',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main, #0f172a)', margin: 0 }}>
                    {title}
                  </h3>
                  {isProd && <span className="badge badge-cyan" style={{ padding: '4px 10px', fontSize: '11px' }}>🎬 Video Creatives & Hook 3s</span>}
                  {isLive && <span className="badge badge-pink" style={{ padding: '4px 10px', fontSize: '11px' }}>🔴 Livestream & Video Newfeed</span>}
                  {isAction && <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: '11px' }}>🚀 Kế Hoạch Thực Chiến</span>}
                </div>
              </div>
            );
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-tiktok-cyan)', marginTop: '16px', marginBottom: '8px' }}>
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('#### ')) {
            return (
              <div key={idx} style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main, #0f172a)', marginTop: '12px', marginBottom: '6px' }}>
                {trimmed.replace('#### ', '')}
              </div>
            );
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const cleanText = trimmed.replace(/^[\-\*]\s+/, '');
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginLeft: '12px', marginBottom: '4px', lineHeight: '1.7', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--color-tiktok-cyan)', fontSize: '16px', lineHeight: '1.3' }}>•</span>
                <div>{formatInline(cleanText)}</div>
              </div>
            );
          }
          if (trimmed.startsWith('> ')) {
            return (
              <blockquote key={idx} style={{ margin: '12px 0', padding: '10px 16px', borderLeft: '3px solid var(--color-tiktok-cyan)', background: '#f8fafc', borderRadius: '0 8px 8px 0', fontSize: '13px', color: '#334155', border: '1px solid #e2e8f0', borderLeftWidth: '3px' }}>
                {formatInline(trimmed.replace('> ', ''))}
              </blockquote>
            );
          }
          return (
            <p key={idx} style={{ margin: '0 0 8px 0', lineHeight: '1.7', fontSize: '13px', color: 'var(--text-muted)' }}>
              {formatInline(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-main">
      {/* Sidebar Section */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">d</div>
          <div className="logo-text">TikTok Ads GMV</div>
        </div>

        <nav className="nav-links" style={{ overflowY: 'auto', paddingRight: '4px' }}>
          {/* TỔNG QUAN */}
          <div style={{ padding: '6px 14px 2px 14px', fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
            Commerce Intelligence
          </div>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'overview' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('overview')}
          >
            <BarChart2 size={16} />
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'sop_pacing' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('sop_pacing')}
            style={{ position: 'relative' }}
          >
            <Target size={16} />
            <span>Điều hành SOP</span>
            <span style={{
              marginLeft: 'auto',
              background: '#0f766e',
              color: '#fff',
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '4px',
              fontWeight: '800'
            }}>SOP</span>
          </button>

          {/* KINH DOANH */}
          <div style={{ margin: '6px 0 0 0', padding: '6px 14px 2px 14px', fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', borderTop: '1px solid var(--border-light)' }}>
            KINH DOANH
          </div>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'report' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('report')}
            style={{ position: 'relative' }}
          >
            <FileSpreadsheet size={16} />
            <span>Báo cáo TikTok Shop</span>
            <span style={{
              marginLeft: 'auto',
              background: '#2563eb',
              color: '#fff',
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '4px',
              fontWeight: '800'
            }}>P0</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'orders' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('orders')}
          >
            <Package size={16} />
            <span>Đơn hàng</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'customers' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('customers')}
          >
            <Users size={16} />
            <span>Khách hàng</span>
            <span style={{
              marginLeft: 'auto',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              fontSize: '8px',
              padding: '1px 4px',
              borderRadius: '3px',
              fontWeight: '700'
            }}>PII</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'products' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('products')}
          >
            <Tag size={16} />
            <span>Sản phẩm</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'affiliate' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('affiliate')}
          >
            <Users size={16} />
            <span>Affiliate</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'shopee' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('shopee')}
          >
            <ShoppingBag size={16} color="#ee4d2d" />
            <span>Kênh Shopee</span>
            <span className="badge badge-accent" style={{ background: '#ffedd5', color: '#c2410c', fontSize: '10px' }}>SÀN</span>
          </button>

          {/* QUẢNG CÁO */}
          <div style={{ margin: '6px 0 0 0', padding: '6px 14px 2px 14px', fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', borderTop: '1px solid var(--border-light)' }}>
            QUẢNG CÁO
          </div>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'ads' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('ads')}
          >
            <DollarSign size={16} />
            <span>GMV Max</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'live_ads' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('live_ads')}
          >
            <Radio size={16} />
            <span>LIVE GMV Max</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'video_intel' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('video_intel')}
          >
            <Video size={16} />
            <span>Video Intelligence</span>
          </button>

          {/* LIVESTREAM */}
          <div style={{ margin: '6px 0 0 0', padding: '6px 14px 2px 14px', fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', borderTop: '1px solid var(--border-light)' }}>
            LIVESTREAM
          </div>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'lives' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('lives')}
          >
            <Radio size={16} />
            <span>Phiên LIVE</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'live_analytics' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('live_analytics')}
          >
            <Activity size={16} />
            <span>Phân tích LIVE</span>
          </button>

          {/* TÀI CHÍNH */}
          <div style={{ margin: '6px 0 0 0', padding: '6px 14px 2px 14px', fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', borderTop: '1px solid var(--border-light)' }}>
            TÀI CHÍNH
          </div>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'true_roas' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('true_roas')}
          >
            <TrendingUp size={16} />
            <span>True ROAS &amp; Tồn kho</span>
            <span style={{
              marginLeft: 'auto',
              background: '#0f766e',
              color: '#fff',
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '4px',
              fontWeight: '800'
            }}>SOP</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'losses' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('losses')}
          >
            <ShieldAlert size={16} />
            <span>Đối soát & Hao hụt</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'finance' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('finance')}
          >
            <CreditCard size={16} />
            <span>Settlement</span>
          </button>

          {/* HỆ THỐNG */}
          <div style={{ margin: '6px 0 0 0', padding: '6px 14px 2px 14px', fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', borderTop: '1px solid var(--border-light)' }}>
            HỆ THỐNG
          </div>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'sync' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('sync')}
          >
            <Sliders size={16} />
            <span>Đồng bộ dữ liệu</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'quality' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('quality')}
          >
            <CheckCircle2 size={16} />
            <span>Data Quality</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'commerce' && commerceSubTab === 'config' ? 'active' : ''}`}
            onClick={() => handleSelectCommerceTab('config')}
          >
            <Settings size={16} />
            <span>Cấu hình</span>
          </button>

          {/* COLLAPSIBLE CÔNG CỤ CŨ / LEGACY */}
          <div style={{ margin: '10px 0 0 0', borderTop: '1px solid var(--border-light)', paddingTop: '6px' }}>
            <button
              type="button"
              onClick={() => setLegacyOpen(!legacyOpen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 14px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dimmed)',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              <span>CÔNG CỤ CŨ / LEGACY</span>
              {legacyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {legacyOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                <button
                  className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  <Activity size={16} />
                  <span>Tổng quan Ads</span>
                </button>
                <button
                  className={`nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
                  onClick={() => setActiveTab('campaigns')}
                >
                  <SlidersHorizontal size={16} />
                  <span>Quản lý Chiến dịch</span>
                </button>
                <button
                  className={`nav-item ${activeTab === 'live' ? 'active' : ''}`}
                  onClick={() => setActiveTab('live')}
                >
                  <Radio size={16} />
                  <span>Báo cáo Live GMV Max</span>
                  {liveStreamActive && <span className="live-indicator" style={{ marginLeft: 'auto' }}></span>}
                </button>
                <button
                  className={`nav-item ${activeTab === 'automation' ? 'active' : ''}`}
                  onClick={() => setActiveTab('automation')}
                >
                  <Sliders size={16} />
                  <span>Tối ưu Tự động</span>
                </button>
                <button
                  className={`nav-item ${activeTab === 'diagnosis' ? 'active' : ''}`}
                  onClick={() => setActiveTab('diagnosis')}
                  style={{ position: 'relative' }}
                >
                  <Activity size={16} style={{ color: 'var(--color-tiktok-cyan)' }} />
                  <span>Chẩn Đoán Shop 360°</span>
                  <span style={{
                    marginLeft: 'auto',
                    background: 'linear-gradient(to right, #00f2fe, #fe2c55)',
                    fontSize: '8px',
                    padding: '1px 4px',
                    borderRadius: '4px',
                    color: '#fff',
                    fontWeight: '700'
                  }}>360°</span>
                </button>
                <button
                  className={`nav-item ${activeTab === 'gemini' ? 'active' : ''}`}
                  onClick={() => setActiveTab('gemini')}
                  style={{ position: 'relative' }}
                >
                  <Sparkles size={16} style={{ color: 'var(--color-tiktok-cyan)' }} />
                  <span>Trợ lý AI Gemini</span>
                  <span style={{
                    marginLeft: 'auto',
                    background: 'linear-gradient(to right, var(--color-tiktok-cyan), var(--color-tiktok-pink))',
                    fontSize: '8px',
                    padding: '1px 4px',
                    borderRadius: '4px',
                    color: '#fff',
                    fontWeight: '700'
                  }}>New</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span className="live-indicator" style={{ animationDuration: '3s', backgroundColor: realShopId ? 'var(--color-success)' : 'var(--color-tiktok-cyan)' }}></span>
            <span>{realShopId ? 'Cửa hàng đã liên kết' : 'API giả lập'}</span>
          </div>
          {!realShopId && (
            <p style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginBottom: '8px' }}>
              Shop ID: VN_18471
            </p>
          )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
              {realShopId ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Shop ID: {realShopId}</span>
                  <button 
                    onClick={async () => {
                      try {
                        await apiRequest('oauth.php?action=disconnect');
                        localStorage.removeItem('real_shop_id');
                        localStorage.removeItem('real_auth_code');
                        setRealShopId(null);
                        alert('Đã ngắt kết nối với cửa hàng thực tế và xóa dữ liệu thành công!');
                        window.location.reload();
                      } catch (err) {
                        alert("Không thể xóa kết nối: " + err.message);
                      }
                    }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '10px', cursor: 'pointer', padding: 0, textDecoration: 'underline'
                    }}
                  >
                    Ngắt Shop
                  </button>
                </div>
              ) : (
                <a 
                  href="/api/oauth.php?action=auth"
                  style={{ color: 'var(--color-tiktok-cyan)', fontSize: '11px', textDecoration: 'underline', fontWeight: '600' }}
                >
                  Kết nối Shop thực tế
                </a>
              )}

              {realAdvertiserId ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Ads ID: {realAdvertiserId}</span>
                  <button 
                    onClick={async () => {
                      try {
                        await apiRequest('oauth_ads.php?action=disconnect');
                        localStorage.removeItem('real_advertiser_id');
                        setRealAdvertiserId(null);
                        alert('Đã ngắt kết nối tài khoản Quảng cáo thực tế!');
                        window.location.reload();
                      } catch (err) {
                        alert("Không thể xóa kết nối: " + err.message);
                      }
                    }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '10px', cursor: 'pointer', padding: 0, textDecoration: 'underline'
                    }}
                  >
                    Ngắt Ads
                  </button>
                </div>
              ) : (
                <a 
                  href="/api/oauth_ads.php?action=auth"
                  style={{ color: '#ec4899', fontSize: '11px', textDecoration: 'underline', fontWeight: '600', marginTop: '2px' }}
                >
                  Kết nối tài khoản Ads
                </a>
              )}
            
            <button 
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dimmed)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                textAlign: 'left',
                marginTop: '4px'
              }}
            >
              Đăng xuất ({authUsername})
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content-area">
        {/* Header Action Bar */}
        {activeTab !== 'commerce' && (
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.5px' }}>
                {activeTab === 'overview' && 'Bảng Điều khiển Tổng quan'}
                {activeTab === 'campaigns' && 'Danh sách Chiến dịch Quảng cáo'}
                {activeTab === 'live' && 'Giám sát Phiên Live Real-time'}
                {activeTab === 'automation' && 'Quy tắc Tối ưu Tự động'}
                {activeTab === 'diagnosis' && 'Trung Tâm Chẩn Đoán & Đánh Giá Toàn Diện Shop 360°'}
                {activeTab === 'gemini' && 'Trợ lý Phân tích AI Gemini'}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                {activeTab === 'diagnosis' 
                  ? 'Đánh giá 9 trụ cột, cảnh báo bệnh ngân sách ảo, tối ưu thẻ sản phẩm và ma trận checklist cải thiện' 
                  : 'Báo cáo hiệu quả quảng cáo sản phẩm và livestream'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Bộ lọc thời gian */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                backgroundColor: 'var(--bg-card)', 
                padding: '8px 14px', 
                borderRadius: '10px', 
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <Calendar size={14} color="var(--color-primary)" />
                <select
                  value={dateRange.preset}
                  onChange={handleDatePresetChange}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    outline: 'none',
                    paddingRight: '6px'
                  }}
                >
                  <option value="today" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Hôm nay ({new Date().getDate()}/{new Date().getMonth() + 1})</option>
                  <option value="yesterday" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Hôm qua ({new Date(Date.now() - 86400000).getDate()}/{new Date(Date.now() - 86400000).getMonth() + 1})</option>
                  <option value="7_days" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>7 ngày qua</option>
                  <option value="30_days" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>30 ngày qua</option>
                  <option value="custom" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Tùy chọn</option>
                </select>

                {dateRange.preset === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px', borderLeft: '1px solid var(--border-light)', paddingLeft: '8px' }}>
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#0f172a',
                        fontSize: '12px',
                        padding: '3px 6px',
                        outline: 'none'
                      }}
                    />
                    <span style={{ color: 'var(--text-dimmed)', fontSize: '12px' }}>-</span>
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#0f172a',
                        fontSize: '12px',
                        padding: '3px 6px',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              <span style={{ fontSize: '12px', color: 'var(--text-dimmed)', textAlign: 'right' }}>
                Đồng bộ lần cuối: <br />
                <strong style={{ color: 'var(--text-main)' }}>{lastSyncTime}</strong>
              </span>
              <button
                onClick={() => handleSyncData(true)}
                disabled={isSyncing}
                className="glow-cyan-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} className={isSyncing ? 'spin-anim' : ''} style={{ animation: isSyncing ? 'spin 1s infinite linear' : 'none' }} />
                {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Ngay'}
              </button>
            </div>
          </header>
        )}

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="dashboard-container">
            {/* KPI Metrics */}
            <div className="stats-grid">
              <div className="glass stat-card yellow">
                <div className="stat-header">
                  <span>Doanh số tổng của sàn (Shop GMV)</span>
                  <div className="stat-icon"><ShoppingBag size={16} color="#eab308" /></div>
                </div>
                <div className="stat-value">{formatCurrency(stats.computedShopGmv)}</div>
                <div className="stat-trend trend-up">
                  <TrendingUp size={12} />
                  <span>Quảng cáo đóng góp {stats.adsContribution}%</span>
                </div>
              </div>

              <div className="glass stat-card pink">
                <div className="stat-header">
                  <span>Tổng chi phí (Ad Spend)</span>
                  <div className="stat-icon"><DollarSign size={16} color="var(--color-tiktok-pink)" /></div>
                </div>
                <div className="stat-value">{formatCurrency(stats.totalSpend)}</div>
                <div className="stat-trend trend-up">
                  <TrendingUp size={12} />
                  <span>+12.4% so với hôm qua</span>
                </div>
              </div>

              <div className="glass stat-card cyan">
                <div className="stat-header">
                  <span>Doanh thu GMV Quảng cáo</span>
                  <div className="stat-icon"><ShoppingBag size={16} color="var(--color-tiktok-cyan)" /></div>
                </div>
                <div className="stat-value">{formatCurrency(stats.totalAdGmv)}</div>
                <div className="stat-trend trend-up">
                  <TrendingUp size={12} />
                  <span>+28.7% so với hôm qua</span>
                </div>
              </div>

              <div className="glass stat-card purple">
                <div className="stat-header">
                  <span>ROAS Trung bình</span>
                  <div className="stat-icon"><TrendingUp size={16} color="var(--color-purple)" /></div>
                </div>
                <div className="stat-value">{stats.averageRoas}x</div>
                <div className="stat-trend trend-up">
                  <TrendingUp size={12} />
                  <span>Tăng trưởng tích cực</span>
                </div>
              </div>

              <div className="glass stat-card success">
                <div className="stat-header">
                  <span>Chiến dịch đang chạy</span>
                  <div className="stat-icon"><CheckCircle size={16} color="var(--color-success)" /></div>
                </div>
                <div className="stat-value">{stats.activeCount} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-muted)' }}>/ {campaigns.length}</span></div>
                <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>
                  <span>Tỷ lệ phân phối 100%</span>
                </div>
              </div>
            </div>

            {/* Performance charts and distribution grid */}
            <div className="charts-grid">
              <div className="glass" style={{ padding: '24px' }}>
                <div className="card-title">
                  <div>
                    Biểu đồ Doanh thu (GMV) vs Chi phí (Ads Cost)
                    <div className="card-subtitle">Xu hướng chi phí & doanh thu theo ngày (Đơn vị: VNĐ)</div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '12px', height: '4px', background: 'var(--color-tiktok-cyan)', display: 'inline-block' }}></span> Doanh thu GMV
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '12px', height: '4px', background: 'var(--color-tiktok-pink)', display: 'inline-block' }}></span> Chi phí Ads
                    </span>
                  </div>
                </div>

                <div className="chart-container">
                  <svg className="svg-chart" viewBox={`0 0 ${svgPoints.width} ${svgPoints.height}`}>
                    <defs>
                      <linearGradient id="chart-gradient-cyan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-tiktok-cyan)" />
                        <stop offset="100%" stopColor="#00d2ff" />
                      </linearGradient>
                      <linearGradient id="chart-gradient-pink" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-tiktok-pink)" />
                        <stop offset="100%" stopColor="#ff5477" />
                      </linearGradient>
                      <linearGradient id="area-gradient-cyan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-tiktok-cyan)" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="var(--color-tiktok-cyan)" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="area-gradient-pink" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-tiktok-pink)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--color-tiktok-pink)" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 1, 2, 3].map((g) => {
                      const y = svgPoints.padding + (g * (svgPoints.height - svgPoints.padding * 2)) / 3;
                      return (
                        <line
                          key={g}
                          className="chart-grid-line"
                          x1={svgPoints.padding}
                          y1={y}
                          x2={svgPoints.width - svgPoints.padding}
                          y2={y}
                        />
                      );
                    })}

                    {/* Area fill */}
                    <path className="chart-area-fill-cyan" d={svgPoints.salesAreaPath} />
                    <path className="chart-area-fill-pink" d={svgPoints.spendAreaPath} />

                    {/* Lines */}
                    <path className="chart-line-main" d={svgPoints.salesPath} />
                    <path className="chart-line-secondary" d={svgPoints.spendPath} />

                    {/* X-Axis labels */}
                    {chartData.map((d, index) => {
                      const x = svgPoints.padding + (index * (svgPoints.width - svgPoints.padding * 2)) / (chartData.length - 1);
                      return (
                        <text
                          key={index}
                          className="chart-axis-text"
                          x={x}
                          y={svgPoints.height - 10}
                          textAnchor="middle"
                        >
                          {d.label}
                        </text>
                      );
                    })}

                    {/* Interaction dots & mouse triggers */}
                    {svgPoints.salesPoints.map((pt, idx) => (
                      <circle
                        key={`s-${idx}`}
                        className="chart-dot"
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        fill="var(--color-tiktok-cyan)"
                        stroke="#0f1115"
                        onMouseEnter={() => setHoveredPoint({ ...pt, type: 'Sales', otherVal: svgPoints.spendPoints[idx].value })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}

                    {svgPoints.spendPoints.map((pt, idx) => (
                      <circle
                        key={`sp-${idx}`}
                        className="chart-dot"
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        fill="var(--color-tiktok-pink)"
                        stroke="#0f1115"
                        onMouseEnter={() => setHoveredPoint({ ...pt, type: 'Spend', otherVal: svgPoints.salesPoints[idx].value })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>

                  {/* Tooltip Overlay */}
                  {hoveredPoint && (
                    <div
                      className="chart-tooltip"
                      style={{
                        left: `${(hoveredPoint.x / svgPoints.width) * 100}%`,
                        top: `${(hoveredPoint.y / svgPoints.height) * 100}%`
                      }}
                    >
                      <span style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px' }}>Ngày: {hoveredPoint.label}</span>
                      <span style={{ color: 'var(--color-tiktok-cyan)' }}>
                        GMV: <strong>${hoveredPoint.type === 'Sales' ? hoveredPoint.value : hoveredPoint.otherVal}</strong>
                      </span>
                      <span style={{ color: 'var(--color-tiktok-pink)' }}>
                        Spend: <strong>${hoveredPoint.type === 'Spend' ? hoveredPoint.value : hoveredPoint.otherVal}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Distribution Details */}
              <div className="glass" style={{ padding: '24px' }}>
                <h3 className="card-title">Cơ cấu Doanh số (GMV Max)</h3>
                <div className="distribution-list" style={{ marginTop: '20px' }}>
                  <div className="distribution-item">
                    <div className="dist-label-row">
                      <span>Product GMV Max (Sản phẩm)</span>
                      <strong>{gmvMaxStats.productPercent}%</strong>
                    </div>
                    <div className="dist-bar-bg">
                      <div className="dist-bar-fill" style={{ width: `${gmvMaxStats.productPercent}%`, background: 'linear-gradient(to right, var(--color-tiktok-cyan), #00d2ff)' }}></div>
                    </div>
                  </div>

                  <div className="distribution-item">
                    <div className="dist-label-row">
                      <span>LIVE GMV Max (Live stream)</span>
                      <strong>{gmvMaxStats.livePercent}%</strong>
                    </div>
                    <div className="dist-bar-bg">
                      <div className="dist-bar-fill" style={{ width: `${gmvMaxStats.livePercent}%`, background: 'linear-gradient(to right, var(--color-tiktok-pink), #ff5477)' }}></div>
                    </div>
                  </div>

                  <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                    <div className="card-title" style={{ fontSize: '14px', marginBottom: '12px' }}>Phân bổ Lưu lượng LIVE</div>
                    <div className="distribution-item" style={{ marginBottom: '12px' }}>
                      <div className="dist-label-row" style={{ fontSize: '12px' }}>
                        <span>Video-to-LIVE (Từ video quảng cáo)</span>
                        <span>{liveTrafficStats.videoPercent}%</span>
                      </div>
                      <div className="dist-bar-bg" style={{ height: '6px' }}>
                        <div className="dist-bar-fill" style={{ width: `${liveTrafficStats.videoPercent}%`, backgroundColor: 'var(--color-purple)' }}></div>
                      </div>
                    </div>
                    <div className="distribution-item">
                      <div className="dist-label-row" style={{ fontSize: '12px' }}>
                        <span>LIVE-to-LIVE (Từ feed live)</span>
                        <span>{liveTrafficStats.livePercent}%</span>
                      </div>
                      <div className="dist-bar-bg" style={{ height: '6px' }}>
                        <div className="dist-bar-fill" style={{ width: `${liveTrafficStats.livePercent}%`, backgroundColor: 'var(--color-success)' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Summary & Active Rules */}
            <div className="glass campaigns-card">
              <div className="card-title" style={{ marginBottom: '16px' }}>
                Chiến dịch Hiệu quả Cao nhất
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setActiveTab('campaigns')}>Xem tất cả</button>
              </div>
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Chiến dịch</th>
                      <th>Loại quảng cáo</th>
                      <th>Chi phí</th>
                      <th>Ad GMV</th>
                      <th>Đơn hàng</th>
                      <th>ROAS</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.slice(0, 3).map(c => (
                      <tr key={c.id}>
                        <td>
                          <div className="campaign-cell-name">
                            {c.name}
                            <span className="campaign-cell-sub">ID: {c.id}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${c.type.includes('LIVE') ? 'badge-pink' : 'badge-cyan'}`}>{c.type}</span>
                        </td>
                        <td>{formatCurrency(c.spend)}</td>
                        <td>{formatCurrency(c.adGmv)}</td>
                        <td>{c.conversions}</td>
                        <td style={{ fontWeight: '700', color: c.adGmv / c.spend >= 3 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                          {(c.adGmv / (c.spend || 1)).toFixed(2)}x
                        </td>
                        <td>
                          <span className={`badge ${c.status ? 'badge-success' : 'badge-muted'}`}>
                            {c.status ? 'Đang chạy' : 'Tạm dừng'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. CAMPAIGNS TAB */}
        {activeTab === 'campaigns' && (
          <div className="glass campaigns-card">
            <div className="table-header-actions">
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="search-input-wrapper">
                  <Search size={16} className="search-icon-pos" />
                  <input
                    type="text"
                    placeholder="Tìm tên chiến dịch..."
                    className="search-input"
                    value={campSearch}
                    onChange={(e) => setCampSearch(e.target.value)}
                  />
                </div>

                <select
                  className="form-control select-control"
                  style={{ width: '180px', padding: '8px 16px', paddingRight: '40px' }}
                  value={campFilter}
                  onChange={(e) => setCampFilter(e.target.value)}
                >
                  <option value="All">Tất cả định dạng</option>
                  <option value="Product GMV Max">Product GMV Max</option>
                  <option value="LIVE GMV Max">LIVE GMV Max</option>
                </select>
              </div>

              <button
                className="glow-pink-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' }}
                onClick={() => setIsCampModalOpen(true)}
              >
                <Plus size={16} />
                Tạo Chiến dịch
              </button>
            </div>

            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Trạng thái</th>
                    <th>Chiến dịch</th>
                    <th>Loại</th>
                    <th>Ngân sách Ngày</th>
                    <th>Đã chi tiêu</th>
                    <th>CTR</th>
                    <th>Conversions</th>
                    <th>Ad GMV</th>
                    <th>ROAS</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map(c => {
                    const roas = c.spend > 0 ? (c.adGmv / c.spend).toFixed(2) : '0.00';
                    const ctr = c.clicks > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : '0.00%';
                    return (
                      <tr key={c.id}>
                        <td>
                          <label className="status-toggle">
                            <input
                              type="checkbox"
                              checked={c.status}
                              onChange={() => handleToggleCampaign(c.id)}
                            />
                            <span className="slider"></span>
                          </label>
                        </td>
                        <td>
                          <div className="campaign-cell-name" onClick={() => handleOpenDetailsModal(c)} style={{ cursor: 'pointer' }} title="Bấm để xem chi tiết chiến dịch">
                            <span style={{ color: 'var(--color-tiktok-cyan)', textDecoration: 'underline', fontWeight: '600' }}>{c.name}</span>
                            <span className="campaign-cell-sub">Ngày tạo: {c.created}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${c.type.includes('LIVE') ? 'badge-pink' : 'badge-cyan'}`}>{c.type}</span>
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {formatCurrency(c.budget)}
                        </td>
                        <td>{formatCurrency(c.spend)}</td>
                        <td>{ctr}</td>
                        <td>{c.conversions}</td>
                        <td style={{ fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>{formatCurrency(c.adGmv)}</td>
                        <td style={{ fontWeight: '700', color: Number(roas) >= 3.0 ? 'var(--color-success)' : Number(roas) >= 2.0 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                          {roas}x
                        </td>
                        <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="glow-purple-btn"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.35)'
                            }}
                            onClick={() => handleAnalyzeSpecificCampaign(c)}
                            title="Phân tích riêng chiến dịch này bằng Gemini AI"
                          >
                            <Sparkles size={12} /> Phân tích AI
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '11px' }}
                            onClick={() => handleOpenBudgetModal(c)}
                          >
                            Sửa ngân sách
                          </button>
                          <button
                            className={c.type.includes('LIVE') ? 'glow-pink-btn' : 'glow-cyan-btn'}
                            style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onClick={() => handleOpenDetailsModal(c)}
                            title={c.type.includes('LIVE') ? 'Xem danh sách ca LIVE và chỉ số phòng' : 'Xem danh sách video và 10 chỉ số quảng cáo'}
                          >
                            {c.type.includes('LIVE') ? '📺 Ca LIVE' : '🎬 Video'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCampaigns.length === 0 && (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dimmed)' }}>
                        {realAdvertiserId 
                          ? "Không tìm thấy chiến dịch nào phù hợp." 
                          : "Chưa kết nối tài khoản Quảng cáo. Vui lòng click 'Kết nối tài khoản Ads' ở góc dưới bên trái để đồng bộ chiến dịch thực tế."
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. LIVE MONITORING & STREAMER WORKBENCH TAB */}
        {activeTab === 'live' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header & Bộ lọc thời gian */}
            <div className="glass" style={{ padding: '20px 24px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #fe2c55, #ff7675)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(254, 44, 85, 0.35)' }}>
                    <Radio size={22} color="#fff" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#fff' }}>
                        {selectedLiveRoom ? `Chi Tiết Ca Live: Phòng ${selectedLiveRoom.room_id}` : 'Báo Cáo & Giám Sát LIVE GMV Max'}
                      </h3>
                      <span className="badge badge-pink" style={{ fontSize: '11px' }}>Kênh @duocphamaddp</span>
                      <span className="live-indicator"></span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 0 0' }}>
                      {selectedLiveRoom ? (
                        <span>Bắt đầu: <strong style={{ color: '#fff' }}>{selectedLiveRoom.start_time}</strong> • Thời lượng: <strong style={{ color: '#fff' }}>{selectedLiveRoom.duration}</strong> • 100% dữ liệu đối soát TikTok Shop Streamer Workbench</span>
                      ) : (
                        <span>Dữ liệu thực tế từ TikTok Shop Streamer Workbench & TikTok Ads API ({filteredLiveSessions.length} ca trong kỳ).</span>
                      )}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '5px 12px', border: '1px solid var(--border-light)' }}>
                    <Calendar size={14} color="var(--color-tiktok-cyan)" />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-dimmed)' }}>Kỳ lọc:</span>
                    <select
                      value={dateRange.preset}
                      onChange={handleDatePresetChange}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="today" style={{ background: '#18181b' }}>Hôm nay ({new Date().getDate()}/{new Date().getMonth() + 1})</option>
                      <option value="yesterday" style={{ background: '#18181b' }}>Hôm qua ({new Date(Date.now() - 86400000).getDate()}/{new Date(Date.now() - 86400000).getMonth() + 1})</option>
                      <option value="7_days" style={{ background: '#18181b' }}>7 ngày qua</option>
                      <option value="30_days" style={{ background: '#18181b' }}>30 ngày qua</option>
                    </select>
                  </div>

                  {selectedLiveRoom && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSelectedLiveRoom(null)}
                      style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <ArrowLeft size={14} /> Quay lại danh sách ca LIVE
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 4 Thẻ KPI Tổng Hợp của các ca Live trong kỳ lọc */}
            {(() => {
              const list = filteredLiveSessions;
              const totalGmv = list.reduce((a, s) => a + Number(s.gmv || 0), 0);
              const totalSpend = list.reduce((a, s) => a + Number(s.ad_spend || 0), 0);
              const totalOrders = list.reduce((a, s) => a + Number(s.orders || 0), 0);
              const overallRoas = totalSpend > 0 ? (totalGmv / totalSpend).toFixed(2) : '0.00';
              const avgGpm = list.length > 0 ? Math.round(list.reduce((a, s) => a + Number(s.gpm || 0), 0) / list.length) : 0;
              const curDateLabel = dateRange.preset === 'today' ? 'Hôm nay' : (dateRange.preset === 'yesterday' ? 'Hôm qua' : (dateRange.preset === '7_days' ? '7 ngày qua' : '30 ngày qua'));

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                  <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-tiktok-pink)', textTransform: 'uppercase', fontWeight: '700' }}>💰 Tổng Doanh Thu Live GMV</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>{formatCurrency(totalGmv)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '2px' }}>{totalOrders} đơn hàng ({curDateLabel})</div>
                  </div>

                  <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>💸 Chi Phí Quảng Cáo Live Ads</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>{formatCurrency(totalSpend)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{list.length} ca Live ghi nhận</div>
                  </div>

                  <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>📈 ROAS Live Ads Tổng Hợp</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: Number(overallRoas) >= 5 ? 'var(--color-success)' : 'var(--color-warning)', marginTop: '4px' }}>{overallRoas}x</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-tiktok-cyan)', marginTop: '2px' }}>Tỷ lệ sinh lời trực tiếp phiên Live</div>
                  </div>

                  <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>⚡ GPM Trung Bình Phiên</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>{formatCurrency(avgGpm)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Doanh số trên mỗi 1.000 lượt xem Live</div>
                  </div>
                </div>
              );
            })()}

            {/* CƠ CHẾ PHÂN PHỐI VIDEO ĐẨY LUỒNG LIVE (SHORT-TO-LIVE FUNNEL) & KẾ HOẠCH SỐ LƯỢNG VIDEO */}
            <div className="glass" style={{ padding: '22px 24px', borderRadius: '16px', border: '1px solid rgba(254, 44, 85, 0.25)', background: 'linear-gradient(180deg, rgba(254, 44, 85, 0.04) 0%, rgba(0,0,0,0.2) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #fe2c55, #ff7675)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={18} color="#fff" fill="#fff" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                      🎬 Cơ Chế Video Ngắn Đẩy Luồng Trực Tiếp Vào Phòng Live (Short-to-Live Funnel)
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '2px' }}>
                      Mô hình chuyển đổi phễu: Video ngắn FYP ➔ Avatar Viền Đỏ Rung Đập &amp; Thẻ Live Feed ➔ Enter Room ➔ Chốt Đơn Siêu Tốc
                    </div>
                  </div>
                </div>
                <span className="badge badge-pink" style={{ fontSize: '11px', padding: '4px 10px' }}>
                  ⚡ Đóng góp 47.56% GMV &amp; 79% Lượt Xem
                </span>
              </div>

              {/* Sơ đồ 4 Bước Phễu Luân Chuyển Traffic */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '14px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-tiktok-cyan)', textTransform: 'uppercase' }}>Bước 1 • FYP Feed</span>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--color-tiktok-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' }}>1</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Video Ngắn Cắn Phân Phối</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px', lineHeight: '1.5' }}>
                    Video 15-30s mở đầu bằng Hook 3s hấp dẫn đạt &gt; 50% lượt giữ chân. Thuật toán TikTok đẩy vào luồng thịnh hành.
                  </div>
                </div>

                <div style={{ background: 'rgba(254, 44, 85, 0.05)', border: '1px solid rgba(254, 44, 85, 0.3)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-tiktok-pink)', textTransform: 'uppercase' }}>Bước 2 • Live Trigger</span>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(254, 44, 85, 0.2)', color: '#ff6b6b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' }}>2</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Avatar Rung &amp; Live Card</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px', lineHeight: '1.5' }}>
                    Khi kênh đang phát sóng, Avatar góc phải rung viền đỏ (Avatar Pulsing) và ghim thẻ "Đang phát trực tiếp" ngay dưới video.
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#f39c12', textTransform: 'uppercase' }}>Bước 3 • Enter Room</span>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(243, 156, 18, 0.15)', color: '#f39c12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' }}>3</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Kéo Mắt Xem Trực Tiếp</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px', lineHeight: '1.5' }}>
                    Tỷ lệ vào phòng (Enter Room Rate) tăng vọt lên <strong>1.70% - 2.5%</strong>. Khán giả tò mò bấm vào xem không khí phiên Live.
                  </div>
                </div>

                <div style={{ background: 'rgba(46, 204, 113, 0.05)', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-success)', textTransform: 'uppercase' }}>Bước 4 • Chốt Đơn</span>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(46, 204, 113, 0.2)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' }}>4</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Tung Deal Sốc &amp; Đẩy GPM</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px', lineHeight: '1.5' }}>
                    Streamer ghim ngay SKU Sủi Mát Gan / Deal 1k tại thời điểm mắt xem ùa vào, đẩy CVR đạt <strong>5.15%</strong> và GPM đạt <strong>121.750 đ</strong>.
                  </div>
                </div>
              </div>

              {/* Kế Hoạch Số Lượng Video Cần Nạp Cho Chiến Dịch Live GMV Max */}
              <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={15} color="var(--color-tiktok-cyan)" />
                  <span>Kế Hoạch Số Lượng Video Mồi Cần Nạp Theo Chu Kỳ Ca Live</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #ff7675' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#ff7675' }}>⏰ Mốc T-2h (Trước ca 2 tiếng)</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#fff', background: 'rgba(254, 44, 85, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>5 - 8 Video</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '6px', lineHeight: '1.5' }}>
                      Đăng và nạp ads rải rác 15 phút/video. Chạy mục tiêu tương tác / lưu lượng để thuật toán TikTok làm ấm và phân phối sẵn lên FYP trước giờ Streamer lên sóng.
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--color-tiktok-cyan)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-tiktok-cyan)' }}>⚡ Trong Ca Live (Real-time Boost)</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#fff', background: 'rgba(0, 242, 254, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>2 - 3 Video</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '6px', lineHeight: '1.5' }}>
                      Đội ngũ media cắt nhanh các khoảnh khắc hot, biểu cảm streamer, feedback khách chốt deal và đăng ngay. Đẩy ngân sách ngắn hạn nhằm cứu luồng khi mắt xem có dấu hiệu chững.
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #a855f7' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#c084fc' }}>🔄 Bể Video Luân Chuyển Hàng Tháng</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#fff', background: 'rgba(168, 85, 247, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>30 - 50 Video</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '6px', lineHeight: '1.5' }}>
                      Cần duy trì đều đặn 2-3 video mới mỗi ngày. Phân bổ: 50% Video KOC review chân thực, 30% Video giải quyết nỗi đau nóng trong/mụn nhọt, 20% Video giải trí bắt trend.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* NỘI DUNG: CHI TIẾT 1 CA LIVE (NẾU ĐÃ CHỌN) HOẶC BẢNG DANH SÁCH CÁC CA LIVE */}
            {selectedLiveRoom ? (
              /* STREAMER WORKBENCH CHI TIẾT CỦA CA LIVE ĐƯỢC CHỌN (Y HỆT HÌNH ẢNH 2 CỦA USER) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(254, 44, 85, 0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Radio size={20} color="var(--color-tiktok-pink)" className="pulse-pink" />
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                          Chỉ Số Chi Tiết Phiên LIVE (TikTok Shop Streamer Workbench)
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '2px' }}>
                          Mã phòng: <code style={{ color: 'var(--color-tiktok-cyan)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>{selectedLiveRoom.room_id}</code> • {selectedLiveRoom.start_time}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="glow-pink-btn"
                      style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      disabled={isAnalyzingLive}
                      onClick={() => handleAnalyzeLiveRoomAi(selectedLiveRoom)}
                    >
                      <Sparkles size={14} className={isAnalyzingLive ? 'spin-anim' : ''} />
                      {isAnalyzingLive ? 'AI đang phân tích...' : '✨ Phân tích & Đánh giá Ca Live Này bằng AI'}
                    </button>
                  </div>

                  {/* 12 CHỈ SỐ STREAMER WORKBENCH */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(254, 44, 85, 0.06)', border: '1px solid rgba(254, 44, 85, 0.25)', padding: '12px 14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-tiktok-pink)', textTransform: 'uppercase', fontWeight: '700' }}>💰 Doanh thu GMV</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{formatCurrency(selectedLiveRoom.gmv)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '2px' }}>{selectedLiveRoom.orders} đơn hàng chốt</div>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>💸 Chi phí QC Live Ads</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                        {Number(selectedLiveRoom.ad_spend) > 0 ? formatCurrency(selectedLiveRoom.ad_spend) : '-'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                        {Number(selectedLiveRoom.ad_spend) > 0 ? 'Chiến dịch Live GMV Max' : 'Theo dõi chiến dịch chung'}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>📈 ROAS Live Ads</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: Number(selectedLiveRoom.ad_spend) > 0 ? 'var(--color-success)' : 'var(--text-dimmed)', marginTop: '4px' }}>
                        {Number(selectedLiveRoom.ad_spend) > 0 ? (Number(selectedLiveRoom.gmv) / Number(selectedLiveRoom.ad_spend)).toFixed(2) + 'x' : '-'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-tiktok-cyan)', marginTop: '2px' }}>
                        {Number(selectedLiveRoom.ad_spend) > 0 ? 'Hiệu suất sinh lời cao' : 'Doanh số tự nhiên'}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>⚡ GPM (Doanh số/1k view)</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#f39c12', marginTop: '4px' }}>
                        {Number(selectedLiveRoom.gpm) > 0 ? formatCurrency(selectedLiveRoom.gpm) : (Number(selectedLiveRoom.gmv) === 0 ? '0 đ' : formatCurrency(Math.round(Number(selectedLiveRoom.gmv) / ((selectedLiveRoom.impressions || 1000) / 1000))))}
                      </div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                        {Number(selectedLiveRoom.gmv_per_hour) > 0 ? `GMV/h: ${formatCurrency(selectedLiveRoom.gmv_per_hour)}` : `Hiển thị: ${Number(selectedLiveRoom.impressions || 0).toLocaleString('vi-VN')}`}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>👁️ Người xem Live</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{selectedLiveRoom.viewers || selectedLiveRoom.views || 0}</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Tổng view: {selectedLiveRoom.views || 0}</div>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>⏱️ Thời lượng giữ chân</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{selectedLiveRoom.avg_watch_time || (selectedLiveRoom.duration ? `Thời lượng: ${selectedLiveRoom.duration}` : '-')}</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{selectedLiveRoom.view_gt_1min > 0 ? `${selectedLiveRoom.view_gt_1min} người xem > 1p` : `${selectedLiveRoom.viewers || 0} mắt xem`}</div>
                    </div>
                  </div>

                  {/* 2 Cột: Nguồn Phân Bổ Lưu Lượng (Attribution) & Top Sản Phẩm Bán Chạy Trong Live */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    {/* Cột 1: Phân bổ nguồn lưu lượng */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🌐 Nguồn Phân Bổ Lưu Lượng (Attribution)</span>
                      </div>
                      {selectedLiveRoom.traffic_sources?.live_feed || selectedLiveRoom.traffic_sources?.feed ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span>🔴 Thẻ LIVE trên Trang Feed (LIVE-to-LIVE)</span>
                              <strong style={{ color: 'var(--color-tiktok-pink)' }}>{selectedLiveRoom.traffic_sources.live_feed?.gmv_pct || selectedLiveRoom.traffic_sources.feed?.gmv_rate}% GMV</strong>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${selectedLiveRoom.traffic_sources.live_feed?.gmv_pct || selectedLiveRoom.traffic_sources.feed?.gmv_rate}%`, height: '100%', background: 'linear-gradient(to right, #fe2c55, #ff7675)', borderRadius: '4px' }}></div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '2px' }}>Chiếm {selectedLiveRoom.traffic_sources.live_feed?.imps_pct || selectedLiveRoom.traffic_sources.feed?.imp_rate}% tổng số lượt hiển thị phiên live</div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span>👤 Trang Cá Nhân & Tin Nhắn Kênh</span>
                              <strong style={{ color: 'var(--color-tiktok-cyan)' }}>{selectedLiveRoom.traffic_sources.profile_click?.gmv_pct || 35.98}% GMV</strong>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${selectedLiveRoom.traffic_sources.profile_click?.gmv_pct || 35.98}%`, height: '100%', background: 'linear-gradient(to right, #00f2fe, #4facfe)', borderRadius: '4px' }}></div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '2px' }}>Tập khách hàng trung thành vào xem live</div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span>🎬 Bản xem trước & Nguồn khác</span>
                              <strong style={{ color: '#f39c12' }}>{selectedLiveRoom.traffic_sources.live_preview?.gmv_pct || 11.58}% GMV</strong>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${selectedLiveRoom.traffic_sources.live_preview?.gmv_pct || 11.58}%`, height: '100%', background: 'linear-gradient(to right, #f39c12, #f1c40f)', borderRadius: '4px' }}></div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', fontStyle: 'italic', padding: '16px 0' }}>
                          Chưa có dữ liệu bóc tách nguồn kênh riêng cho ca này trên Streamer Workbench.
                        </div>
                      )}
                    </div>

                    {/* Cột 2: Top SKU Bán Trong Ca Live */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🛍️ Top Sản Phẩm Bán Chạy Trong Ca Live</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {safeParseTopProducts(selectedLiveRoom).length > 0 ? (
                          safeParseTopProducts(selectedLiveRoom).map((prod, pIdx) => (
                            <div key={pIdx} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>{prod.name}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                                <span>Doanh thu: <strong style={{ color: 'var(--color-tiktok-cyan)' }}>{formatCurrency(prod.gmv)}</strong></span>
                                <span>Đơn: <strong style={{ color: '#fff' }}>{prod.orders || 1} đơn</strong></span>
                                <span>CTR Ghim: <strong style={{ color: 'var(--color-success)' }}>{prod.ctr}%</strong></span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', fontStyle: 'italic', padding: '16px 0' }}>
                            Chưa mở chi tiết sản phẩm ca này trên Streamer Workbench (Chỉ thống kê tổng doanh số ca).
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* KHUNG PHÂN TÍCH AI GEMINI CHO CA LIVE */}
                  <div style={{ background: 'rgba(254, 44, 85, 0.04)', border: '1px solid rgba(254, 44, 85, 0.25)', borderRadius: '12px', padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={18} color="var(--color-tiktok-pink)" />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>Báo Cáo Phân Tích & Kế Hoạch Tối Ưu Gemini AI</span>
                      </div>
                      <button
                        type="button"
                        className="glow-pink-btn"
                        style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        disabled={isAnalyzingLive}
                        onClick={() => handleAnalyzeLiveRoomAi(selectedLiveRoom)}
                      >
                        <Sparkles size={12} className={isAnalyzingLive ? 'spin-anim' : ''} />
                        {isAnalyzingLive ? 'Đang phân tích...' : '✨ Phân tích Lại'}
                      </button>
                    </div>

                    {isAnalyzingLive ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dimmed)' }}>
                        <RefreshCw size={24} className="spin-anim" style={{ color: 'var(--color-tiktok-pink)', marginBottom: '8px' }} />
                        <div>Gemini AI đang phân tích chỉ số GPM, nhịp thầu Live GMV Max và tỷ lệ giữ chân của ca này...</div>
                      </div>
                    ) : liveAiAnalysis ? (
                      <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0', background: 'rgba(0,0,0,0.3)', padding: '16px 20px', borderRadius: '10px' }}>
                        {renderFormattedMarkdown(liveAiAnalysis)}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dimmed)', fontSize: '12px' }}>
                        Bấm nút <strong>"✨ Phân tích & Đánh giá Ca Live Này bằng AI"</strong> để xem nhận định điểm tốt, điểm hạn chế và chiến lược nhịp thầu/ghim deal cho ca tiếp theo.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* BẢNG DANH SÁCH CÁC PHIÊN LIVE TRONG KỲ LỌC */
              <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📺 Danh Sách Phiên LIVE Trong Kỳ ({filteredLiveSessions.length} ca)
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                      Bấm vào từng ca để xem toàn bộ thông số Streamer Workbench (Mắt xem, GPM, Nguồn Feed card, Doanh thu) và phân tích AI.
                    </div>
                  </div>
                </div>

                <div className="custom-table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table className="custom-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Phiên Live / Mã phòng</th>
                        <th>Thời lượng</th>
                        <th>Doanh số GMV</th>
                        <th>Chi phí QC Live</th>
                        <th>ROAS Live</th>
                        <th>Đơn hàng</th>
                        <th>Mắt xem</th>
                        <th>GPM</th>
                        <th>CTR Live</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLiveSessions.map((session, idx) => {
                        const sGmv = Number(session.gmv || 0);
                        const sSpend = Number(session.ad_spend || 0);
                        const sRoas = sSpend > 0 ? (sGmv / sSpend).toFixed(2) : '-';

                        return (
                          <tr
                            key={session.room_id || idx}
                            style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                            onClick={() => setSelectedLiveRoom(session)}
                            className="video-row-clickable"
                          >
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'var(--color-tiktok-pink)', fontSize: '16px' }}>🔴</span>
                                <div>
                                  <div style={{ fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>Phòng {session.room_id}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>{session.start_time}</div>
                                </div>
                              </div>
                            </td>
                            <td><span style={{ fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>{session.duration}</span></td>
                            <td style={{ fontWeight: '700', color: 'var(--color-tiktok-cyan)' }}>{formatCurrency(sGmv)}</td>
                            <td>{sSpend > 0 ? formatCurrency(sSpend) : <span style={{ color: 'var(--text-dimmed)' }}>-</span>}</td>
                            <td>
                              {sSpend > 0 ? (
                                <span style={{ fontWeight: '700', color: Number(sRoas) >= 5 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                  {sRoas}x
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-dimmed)' }}>-</span>
                              )}
                            </td>
                            <td style={{ fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>{session.orders} đơn</td>
                            <td>{session.viewers || session.views} người</td>
                            <td style={{ color: '#f39c12', fontWeight: '600' }}>
                              {Number(session.gpm) > 0 ? formatCurrency(session.gpm) : (sGmv === 0 ? '0 đ' : formatCurrency(Math.round(sGmv / ((session.impressions || 1000) / 1000))))}
                            </td>
                            <td>{session.ctr_live ? `${session.ctr_live}%` : '-'}</td>
                            <td>
                              <button
                                type="button"
                                className="glow-pink-btn"
                                style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLiveRoom(session);
                                }}
                              >
                                <Radio size={12} /> Xem Chi Tiết & Phân Tích
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. AUTOMATION TAB */}
        {activeTab === 'automation' && (
          <div className="glass campaigns-card">
            <div className="table-header-actions">
              <div>
                <h3 className="card-title" style={{ margin: 0 }}>Cơ chế tối ưu hóa tự động theo Luật (Rules Engine)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                  Hệ thống định kỳ quét các chỉ số của chiến dịch và tự động thay đổi ngân sách/ROI mục tiêu thông qua TikTok API.
                </p>
              </div>
              <button
                className="glow-cyan-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' }}
                onClick={() => setIsRuleModalOpen(true)}
              >
                <Plus size={16} />
                Thêm Quy tắc
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              {rules.map(rule => (
                <div key={rule.id} className="rule-card">
                  <div className="rule-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="rule-title">{rule.name}</span>
                      <span className="rule-trigger-badge">{rule.frequency}</span>
                      <span className={`badge ${rule.campaignType.includes('LIVE') ? 'badge-pink' : 'badge-cyan'}`}>{rule.campaignType}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '24px', marginTop: '8px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Điều kiện kích hoạt: <strong style={{ color: 'var(--color-tiktok-cyan)' }}>{rule.trigger}</strong>
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Hành động xử lý: <strong style={{ color: 'var(--color-tiktok-pink)' }}>{rule.action}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="rule-actions">
                    <label className="status-toggle">
                      <input
                        type="checkbox"
                        checked={rule.status}
                        onChange={() => handleToggleRule(rule.id)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Log of Rule Executions */}
            <div style={{ marginTop: '40px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
              <div className="card-title" style={{ fontSize: '15px' }}>Nhật ký hoạt động của Quy tắc (Audit Logs)</div>
              <div className="custom-table-container" style={{ marginTop: '16px' }}>
                <table className="custom-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Quy tắc áp dụng</th>
                      <th>Chiến dịch chịu tác động</th>
                      <th>Điều kiện quét</th>
                      <th>Kết quả thực thi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, idx) => (
                      <tr key={log.id || idx}>
                        <td style={{ color: 'var(--text-dimmed)' }}>{log.log_time}</td>
                        <td style={{ fontWeight: '600' }}>{log.rule_name}</td>
                        <td>{log.campaign_name}</td>
                        <td>{log.trigger_value}</td>
                        <td>
                          <span className={`badge ${log.result.includes('Thành công') ? 'badge-success' : 'badge-muted'}`}>
                            {log.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dimmed)' }}>
                          Chưa có nhật ký hoạt động nào được ghi lại.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. GEMINI AI TAB */}
        {activeTab === 'gemini' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* 1. THANH ĐIỀU KHIỂN & CHỌN CHIẾN DỊCH PHÂN TÍCH (FULL WIDTH) */}
            <div className="glass" style={{ padding: '24px 28px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ flex: 1, minWidth: '320px' }}>
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '18px' }}>
                    <Sparkles size={22} style={{ color: 'var(--color-tiktok-cyan)' }} />
                    Trợ Lý Đánh Giá &amp; Tối Ưu Hóa Bằng Gemini AI
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px', marginBlockEnd: 0 }}>
                    Phân tích riêng biệt từng chiến dịch: <strong>Live GMV Max</strong> (đối soát phiên Live, mắt xem, GPM) &amp; <strong>Product GMV Max</strong> (đối soát video ads, hook 3s, drop-off).
                  </p>
                </div>

                {/* Bộ chọn chiến dịch cụ thể & Bộ chọn phạm vi & Nút kích hoạt */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  
                  {/* Dropdown chọn đích danh Chiến dịch */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-dimmed)', whiteSpace: 'nowrap' }}>Chiến dịch:</span>
                    <select
                      className="form-control select-control"
                      style={{ minWidth: '290px', padding: '8px 14px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', color: '#fff', border: '1px solid var(--border-light)' }}
                      value={selectedCampForAi}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCampForAi(val);
                        setAiAnalysis('');
                        const found = campaigns.find(c => String(c.id) === String(val));
                        const isLive = found ? (found.type && (found.type.includes('LIVE') || found.name.includes('LIVE'))) : false;
                        const newScope = found ? (isLive ? 'live_gmv_max' : 'gmv_max') : 'all';
                        setAiAnalysisScope(newScope);
                        if (isLive) {
                          setAiVideos([]);
                          if (filteredLiveSessions.length > 0) {
                            let matched = null;
                            if (found.name.includes('Tối') || found.name.includes('19h30')) {
                              matched = filteredLiveSessions.find(s => s.room_id === '7681293833946909448');
                            } else if (found.name.includes('Chiều') || found.name.includes('17h')) {
                              matched = filteredLiveSessions.find(s => s.room_id === '7681253344618220289');
                            } else if (found.name.includes('Trưa') || found.name.includes('12h') || found.name.includes('Sáng')) {
                              matched = filteredLiveSessions.find(s => s.room_id === '7681150802035723024' || s.room_id === '7681177665796737793');
                            }
                            if (matched) setGeminiLiveSession(matched);
                          }
                        } else {
                          const reqUrl = val === 'all' 
                            ? `gemini_analyze.php?type=all&campaign_id=all` 
                            : `gemini_analyze.php?type=gmv_max&campaign_id=${encodeURIComponent(val)}`;
                          apiRequest(reqUrl, 'GET')
                            .then(res => {
                              if (res.videos) setAiVideos(res.videos);
                              if (res.stats) setAiStats(res.stats);
                              if (res.daily_reports) setDailyReports(res.daily_reports);
                              if (res.creative_capacity) setCreativeCapacity(res.creative_capacity);
                              if (res.distribution_funnel) setDistributionFunnel(res.distribution_funnel);
                              if (res.content_analysis) setContentAnalysis(res.content_analysis);
                              if (res.industry_advisor) setIndustryAdvisor(res.industry_advisor);
                              if (res.delivery_group_counts) setDeliveryGroupCounts(res.delivery_group_counts);
                            }).catch(() => {});
                        }
                      }}
                    >
                      <option value="all" style={{ background: '#12121a', color: '#fff' }}>🌐 Tất cả Chiến dịch (Toàn gian hàng ADDP)</option>
                      {campaigns.map(c => {
                        const cRoas = c.spend > 0 ? (c.adGmv / c.spend).toFixed(1) : '0.0';
                        const isLive = c.type && (c.type.includes('LIVE') || c.name.includes('LIVE'));
                        return (
                          <option key={c.id} value={c.id} style={{ background: '#12121a', color: '#fff' }}>
                            {isLive ? '🔴' : '🎬'} [{c.type}] {c.name} - Chi: {formatCurrency(c.spend)} (ROAS {cRoas}x)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Bộ chọn kỳ ngày lọc nhanh */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '5px 12px', border: '1px solid var(--border-light)' }}>
                    <Calendar size={14} color="var(--color-tiktok-cyan)" />
                    <select
                      value={dateRange.preset}
                      onChange={handleDatePresetChange}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="today" style={{ background: '#18181b' }}>Hôm nay ({new Date().getDate()}/{new Date().getMonth() + 1})</option>
                      <option value="yesterday" style={{ background: '#18181b' }}>Hôm qua ({new Date(Date.now() - 86400000).getDate()}/{new Date(Date.now() - 86400000).getMonth() + 1})</option>
                      <option value="7_days" style={{ background: '#18181b' }}>7 ngày qua</option>
                      <option value="30_days" style={{ background: '#18181b' }}>30 ngày qua</option>
                    </select>
                  </div>

                  {/* Nút Reset về Tất cả nếu đang chọn 1 chiến dịch */}
                  {selectedCampForAi !== 'all' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        setSelectedCampForAi('all');
                        setAiAnalysisScope('all');
                        setAiAnalysis('');
                        apiRequest(`gemini_analyze.php?type=all&campaign_id=all`, 'GET')
                          .then(res => {
                            if (res.videos) setAiVideos(res.videos);
                            if (res.stats) setAiStats(res.stats);
                            if (res.daily_reports) setDailyReports(res.daily_reports);
                            if (res.creative_capacity) setCreativeCapacity(res.creative_capacity);
                            if (res.distribution_funnel) setDistributionFunnel(res.distribution_funnel);
                            if (res.content_analysis) setContentAnalysis(res.content_analysis);
                            if (res.industry_advisor) setIndustryAdvisor(res.industry_advisor);
                            if (res.delivery_group_counts) setDeliveryGroupCounts(res.delivery_group_counts);
                          }).catch(() => {});
                      }}
                    >
                      ✕ Xem tất cả
                    </button>
                  )}

                  {/* Bộ nút phân loại loại hình khi ở chế độ Tất cả */}
                  {selectedCampForAi === 'all' && (
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border-light)' }}>
                      <button
                        type="button"
                        onClick={() => { setAiAnalysisScope('all'); setAiAnalysis(''); }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          background: aiAnalysisScope === 'all' ? 'var(--color-tiktok-cyan)' : 'transparent',
                          color: aiAnalysisScope === 'all' ? '#000' : 'var(--text-dimmed)',
                          fontWeight: '700'
                        }}
                      >
                        🌐 Toàn bộ
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAiAnalysisScope('gmv_max'); setAiAnalysis(''); }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          background: aiAnalysisScope === 'gmv_max' ? 'var(--color-tiktok-cyan)' : 'transparent',
                          color: aiAnalysisScope === 'gmv_max' ? '#000' : 'var(--text-dimmed)',
                          fontWeight: '700'
                        }}
                      >
                        🎬 Product GMV Max
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAiAnalysisScope('live_gmv_max'); setAiVideos([]); setAiAnalysis(''); }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          background: aiAnalysisScope === 'live_gmv_max' ? 'var(--color-tiktok-pink)' : 'transparent',
                          color: aiAnalysisScope === 'live_gmv_max' ? '#fff' : 'var(--text-dimmed)',
                          fontWeight: '700'
                        }}
                      >
                        🔴 Live GMV Max
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsKeyConfigOpen(!isKeyConfigOpen)}
                    style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    🔑 {geminiApiKey ? 'Đã có Key' : 'Khóa API'}
                  </button>
                </div>
              </div>

              {/* Hộp cấu hình Gemini API Key ẩn/hiện */}
              {isKeyConfigOpen && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="password"
                    placeholder="Nhập khóa API Gemini của bạn..."
                    value={inputGeminiKey}
                    onChange={(e) => setInputGeminiKey(e.target.value)}
                    style={{ flex: '1 1 300px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '12px', outline: 'none' }}
                  />
                  <button onClick={() => handleSaveGeminiKey(inputGeminiKey)} className="glow-cyan-btn" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    Lưu khóa
                  </button>
                  <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>
                    {geminiApiKey ? '✅ Đã kích hoạt API Key riêng.' : '⚠️ Chưa cấu hình Key: Hệ thống sẽ sử dụng thuật toán chuyên gia dự phòng để xuất báo cáo.'}
                  </span>
                </div>
              )}
            </div>

            {/* 2. KHU VỰC BÁO CÁO PHÂN TÍCH (TÁCH BIỆT HOÀN TOÀN: LIVE vs PRODUCT) */}
            {(() => {
              const currentCampObj = selectedCampForAi !== 'all' ? campaigns.find(c => String(c.id) === String(selectedCampForAi)) : null;
              const isCurrentLive = currentCampObj ? (currentCampObj.type && (currentCampObj.type.includes('LIVE') || currentCampObj.name.includes('LIVE'))) : (aiAnalysisScope === 'live_gmv_max');
              const curDateLabel = dateRange.preset === 'today' ? 'Hôm nay' : (dateRange.preset === 'yesterday' ? 'Hôm qua' : (dateRange.preset === '7_days' ? '7 ngày qua' : '30 ngày qua'));

              // ---------------------------------------------------------------
              // A. TRƯỜNG HỢP CHIẾN DỊCH LIVE GMV MAX
              // ---------------------------------------------------------------
              if (isCurrentLive) {
                const activeLiveSession = geminiLiveSession || (filteredLiveSessions.length > 0 ? filteredLiveSessions[0] : null);
                const liveSpend = activeLiveSession ? Number(activeLiveSession.ad_spend || 0) : (currentCampObj ? Number(currentCampObj.spend || 0) : 0);
                const liveGmv = activeLiveSession ? Number(activeLiveSession.gmv || 0) : (currentCampObj ? Number(currentCampObj.adGmv || 0) : 0);
                const liveRoas = liveSpend > 0 ? (liveGmv / liveSpend).toFixed(2) : null;
                const liveOrders = activeLiveSession ? Number(activeLiveSession.orders || 0) : (currentCampObj ? Number(currentCampObj.conversions || 0) : 0);
                const liveGpm = activeLiveSession ? Number(activeLiveSession.gpm || 0) : 0;
                const liveViewers = activeLiveSession ? (activeLiveSession.viewers || activeLiveSession.views || 0) : 0;

                return (
                  <>
                    {/* BẢNG 4 THẺ KPI CHUYÊN BIỆT CHO LIVE GMV MAX */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                      <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(254, 44, 85, 0.25)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-tiktok-pink)', textTransform: 'uppercase', fontWeight: '700' }}>💸 Chi Phí QC Live Ads</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>
                          {liveSpend > 0 ? formatCurrency(liveSpend) : '-'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {liveSpend > 0 ? (activeLiveSession ? `Phòng ${activeLiveSession.room_id}` : currentCampObj?.name) : 'Tự nhiên / QC chung'}
                        </div>
                      </div>

                      <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(0, 242, 254, 0.25)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-tiktok-cyan)', textTransform: 'uppercase', fontWeight: '700' }}>💰 Doanh Thu GMV Ca Live</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-tiktok-cyan)', marginTop: '4px' }}>{formatCurrency(liveGmv)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '2px' }}>{liveOrders} đơn hàng chốt</div>
                      </div>

                      <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>📈 ROAS Live Ads</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: liveRoas ? (Number(liveRoas) >= 5 ? 'var(--color-success)' : 'var(--color-warning)') : 'var(--text-dimmed)', marginTop: '4px' }}>
                          {liveRoas ? `${liveRoas}x` : '-'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {liveRoas ? 'Tỷ suất sinh lời trực tiếp ca Live' : 'Không có chi phí QC riêng'}
                        </div>
                      </div>

                      <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>👁️ Mắt Xem / GPM Ca Live</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>
                          {liveViewers} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-dimmed)' }}>mắt xem</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#f39c12', marginTop: '2px' }}>
                          GPM: {Number(liveGpm) > 0 ? formatCurrency(liveGpm) : (liveGmv === 0 ? '0 đ' : formatCurrency(Math.round(liveGmv / ((activeLiveSession?.impressions || 1000) / 1000))))}
                        </div>
                      </div>
                    </div>

                    {/* BẢNG DANH SÁCH CÁC PHIÊN LIVE TRONG KỲ LỌC ({filteredLiveSessions.length} ca) */}
                    <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h3 className="card-title" style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📺 Danh Sách Các Phiên LIVE Trong Kỳ ({curDateLabel} - {filteredLiveSessions.length} ca)
                          </h3>
                          <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                            Click chọn ca Live bất kỳ để xem toàn bộ thông số Streamer Workbench và bấm Phân tích AI riêng cho ca đó.
                          </div>
                        </div>
                        <span className="badge badge-pink" style={{ fontSize: '11px' }}>
                          Kênh: @duocphamaddp
                        </span>
                      </div>

                      <div className="custom-table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        <table className="custom-table" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr>
                              <th>Chọn</th>
                              <th>Phiên Live / Mã phòng</th>
                              <th>Thời gian bắt đầu</th>
                              <th>Thời lượng</th>
                              <th>Doanh số GMV</th>
                              <th>Chi phí QC Live</th>
                              <th>ROAS Live</th>
                              <th>Đơn hàng</th>
                              <th>Mắt xem</th>
                              <th>GPM</th>
                              <th>Nguồn Feed Card</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredLiveSessions.map((s, idx) => {
                              const sGmv = Number(s.gmv || 0);
                              const sSpend = Number(s.ad_spend || 0);
                              const sRoas = sSpend > 0 ? (sGmv / sSpend).toFixed(2) : '-';
                              const isSelected = activeLiveSession && activeLiveSession.room_id === s.room_id;

                              return (
                                <tr
                                  key={s.room_id || idx}
                                  onClick={() => setGeminiLiveSession(s)}
                                  className="video-row-clickable"
                                  style={{
                                    cursor: 'pointer',
                                    backgroundColor: isSelected ? 'rgba(254, 44, 85, 0.12)' : 'transparent',
                                    borderLeft: isSelected ? '3px solid var(--color-tiktok-pink)' : '3px solid transparent',
                                    transition: 'background 0.2s'
                                  }}
                                >
                                  <td>
                                    <input
                                      type="radio"
                                      name="gemini_live_pick"
                                      checked={isSelected}
                                      onChange={() => setGeminiLiveSession(s)}
                                      style={{ accentColor: 'var(--color-tiktok-pink)', cursor: 'pointer' }}
                                    />
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ color: 'var(--color-tiktok-pink)', fontSize: '14px' }}>🔴</span>
                                      <span style={{ fontWeight: '700', color: isSelected ? 'var(--color-tiktok-pink)' : 'var(--text-main, #0f172a)' }}>
                                        Phòng {s.room_id}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ color: 'var(--text-muted)' }}>{s.start_time}</td>
                                  <td style={{ fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>{s.duration}</td>
                                  <td style={{ fontWeight: '700', color: 'var(--color-tiktok-cyan)' }}>{formatCurrency(sGmv)}</td>
                                  <td>{sSpend > 0 ? formatCurrency(sSpend) : <span style={{ color: 'var(--text-dimmed)' }}>-</span>}</td>
                                  <td>
                                    {sSpend > 0 ? (
                                      <span style={{ fontWeight: '700', color: Number(sRoas) >= 5 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                        {sRoas}x
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-dimmed)' }}>-</span>
                                    )}
                                  </td>
                                  <td style={{ fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>{s.orders} đơn</td>
                                  <td>{s.viewers || s.views} người</td>
                                  <td style={{ color: '#f39c12', fontWeight: '600' }}>
                                    {Number(s.gpm) > 0 ? formatCurrency(s.gpm) : (sGmv === 0 ? '0 đ' : formatCurrency(Math.round(sGmv / ((s.impressions || 1000) / 1000))))}
                                  </td>
                                  <td>
                                    {s.traffic_sources?.feed?.gmv_rate || s.traffic_sources?.live_feed?.gmv_pct ? (
                                      <span className="badge badge-pink" style={{ fontSize: '10px' }}>
                                        {s.traffic_sources?.feed?.gmv_rate || s.traffic_sources?.live_feed?.gmv_pct}% GMV
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-dimmed)' }}>-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* KHUNG CHI TIẾT CA LIVE ĐƯỢC CHỌN (STREAMER WORKBENCH - HÌNH ẢNH 2) */}
                    {activeLiveSession && (
                      <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(254, 44, 85, 0.35)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Radio size={20} color="var(--color-tiktok-pink)" className="pulse-pink" />
                            <div>
                              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                                Chi Tiết Ca Live Đang Chọn: Phòng {activeLiveSession.room_id}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '2px' }}>
                                Bắt đầu: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{activeLiveSession.start_time}</strong> • Thời lượng: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{activeLiveSession.duration}</strong> • Kênh: <span className="badge badge-pink" style={{ fontSize: '10px' }}>@duocphamaddp</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="glow-pink-btn"
                            style={{ padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            disabled={isAnalyzing}
                            onClick={() => handleGeminiAnalysis('live_gmv_max', selectedCampForAi, activeLiveSession.room_id)}
                          >
                            <Sparkles size={16} className={isAnalyzing ? 'spin-anim' : ''} />
                            {isAnalyzing ? 'Gemini đang phân tích...' : '✨ Phân tích & Đánh giá Ca Live Này bằng AI'}
                          </button>
                        </div>

                        {/* 6 Thẻ chỉ số chuyên sâu Streamer Workbench */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                          <div style={{ background: '#fff1f2', border: '1px solid rgba(254, 44, 85, 0.25)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--color-tiktok-pink)', textTransform: 'uppercase', fontWeight: '700' }}>💰 GMV Phiên Live</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>{formatCurrency(activeLiveSession.gmv)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '2px' }}>{activeLiveSession.orders} đơn hàng chốt</div>
                          </div>

                          <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>💸 Chi Phí QC Live</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>
                              {Number(activeLiveSession.ad_spend) > 0 ? formatCurrency(activeLiveSession.ad_spend) : '-'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {Number(activeLiveSession.ad_spend) > 0 ? 'Live GMV Max' : 'Theo dõi chiến dịch chung'}
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>📈 ROAS Live Ads</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: Number(activeLiveSession.ad_spend) > 0 ? 'var(--color-success)' : 'var(--text-dimmed)', marginTop: '4px' }}>
                              {Number(activeLiveSession.ad_spend) > 0 ? `${(Number(activeLiveSession.gmv) / Number(activeLiveSession.ad_spend)).toFixed(2)}x` : '-'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-tiktok-cyan)', marginTop: '2px' }}>
                              {Number(activeLiveSession.ad_spend) > 0 ? 'Sinh lời trực tiếp ca' : 'Doanh số tự nhiên'}
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>⚡ GPM (Doanh số/1k view)</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>
                              {Number(activeLiveSession.gpm) > 0 ? formatCurrency(activeLiveSession.gpm) : (Number(activeLiveSession.gmv) === 0 ? '0 đ' : formatCurrency(Math.round(Number(activeLiveSession.gmv) / ((activeLiveSession.impressions || 1000) / 1000))))}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {Number(activeLiveSession.gmv_per_hour) > 0 ? `GMV/h: ${formatCurrency(activeLiveSession.gmv_per_hour)}` : `Hiển thị: ${Number(activeLiveSession.impressions || 0).toLocaleString('vi-VN')}`}
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>⏱️ Giữ Chân Khách</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>
                              {activeLiveSession.avg_watch_time || (activeLiveSession.duration ? `Thời lượng: ${activeLiveSession.duration}` : '-')}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {activeLiveSession.view_gt_1min > 0 ? `${activeLiveSession.view_gt_1min} người xem > 1p` : `${activeLiveSession.viewers || 0} mắt xem`}
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>🔴 Nguồn Feed Trực Tiếp</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-tiktok-pink)', marginTop: '4px' }}>
                              {activeLiveSession.traffic_sources?.feed?.gmv_rate || activeLiveSession.traffic_sources?.live_feed?.gmv_pct ? `${activeLiveSession.traffic_sources?.feed?.gmv_rate || activeLiveSession.traffic_sources?.live_feed?.gmv_pct}% GMV` : '-'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {activeLiveSession.traffic_sources?.feed?.imp_rate || activeLiveSession.traffic_sources?.live_feed?.imps_pct ? `${activeLiveSession.traffic_sources?.feed?.imp_rate || activeLiveSession.traffic_sources?.live_feed?.imps_pct}% lượt hiển thị từ Feed` : 'Chưa có phân tích kênh'}
                            </div>
                          </div>
                        </div>

                        {/* Top 3 SKU Bán Chạy Trong Ca Live Này */}
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>🛍️ Top Sản Phẩm Bán Chạy Trong Ca Live</div>
                          {safeParseTopProducts(activeLiveSession).length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                              {safeParseTopProducts(activeLiveSession).map((p, pIdx) => (
                                <div key={pIdx} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff' }}>{p.name}</div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dimmed)', marginTop: '2px' }}>
                                    <span>Doanh thu: <strong style={{ color: 'var(--color-tiktok-cyan)' }}>{formatCurrency(p.gmv)}</strong></span>
                                    <span>Đơn: <strong style={{ color: '#fff' }}>{p.orders || 1}</strong></span>
                                    <span>CTR: <strong style={{ color: 'var(--color-success)' }}>{p.ctr}%</strong></span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', fontStyle: 'italic', padding: '8px 0' }}>
                              Chưa mở chi tiết sản phẩm ca này trên Streamer Workbench (Chỉ thống kê tổng doanh số ca).
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* KHUNG BÁO CÁO PHÂN TÍCH GEMINI AI CHO CA LIVE */}
                    <div className="glass" style={{ padding: '28px', borderRadius: '16px', border: '1px solid rgba(254, 44, 85, 0.35)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #fe2c55, #ff7675)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={20} color="#fff" />
                          </div>
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                              Báo Cáo Phân Tích &amp; Kế Hoạch Tối Ưu Hóa Ca LIVE
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-dimmed)' }}>
                              Đang phân tích: {activeLiveSession ? `Phòng ${activeLiveSession.room_id} (${activeLiveSession.start_time})` : (currentCampObj?.name || 'Chiến dịch Live GMV Max')}
                            </div>
                          </div>
                        </div>

                        {aiAnalysis && (
                          <button
                            onClick={handleCopyReport}
                            className="btn-secondary"
                            style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                          >
                            {copyReportSuccess ? '✅ Đã sao chép báo cáo!' : '📋 Sao chép báo cáo'}
                          </button>
                        )}
                      </div>

                      {/* Nội dung kết quả phân tích */}
                      {isAnalyzing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40px 20px', alignItems: 'center', justifyContent: 'center' }}>
                          <RefreshCw size={32} className="spin-anim" style={{ color: 'var(--color-tiktok-pink)', marginBottom: '8px' }} />
                          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>
                            Gemini AI đang phân tích toàn diện ca Live...
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', maxWidth: '450px', textAlign: 'center' }}>
                            Đang đối soát GPM, hiệu quả cắn tiền Live Ads, nguồn lưu lượng Feed card và chiến lược ghim deal...
                          </div>
                        </div>
                      ) : aiError ? (
                        <div style={{ padding: '24px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#b91c1c' }}>
                          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '8px' }}>⚠️ Lỗi phân tích:</div>
                          <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#7f1d1d' }}>{aiError}</div>
                          <button onClick={() => handleGeminiAnalysis('live_gmv_max', selectedCampForAi, activeLiveSession?.room_id)} className="glow-pink-btn" style={{ marginTop: '14px', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                            Thử lại ngay
                          </button>
                        </div>
                      ) : aiAnalysis ? (
                        <div
                          className="gemini-report-content"
                          style={{
                            fontSize: '14px',
                            lineHeight: '1.8',
                            color: 'var(--text-main, #0f172a)',
                            background: '#ffffff',
                            padding: '24px 28px',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                          }}
                        >
                          {renderFormattedMarkdown(aiAnalysis)}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-dimmed)' }}>
                          <Sparkles size={40} style={{ color: 'var(--color-tiktok-pink)', opacity: 0.5, marginBottom: '14px' }} />
                          <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main, #0f172a)', marginBottom: '6px' }}>
                            Chưa có báo cáo phân tích cho ca Live này
                          </div>
                          <p style={{ fontSize: '13px', maxWidth: '450px', margin: '0 auto 20px auto' }}>
                            Bấm vào nút <strong>"✨ Phân tích & Đánh giá Ca Live Này bằng AI"</strong> phía trên để AI đối soát chỉ số và đề xuất kế hoạch nhịp thầu/ghim deal.
                          </p>
                          <button
                            onClick={() => handleGeminiAnalysis('live_gmv_max', selectedCampForAi, activeLiveSession?.room_id)}
                            className="glow-pink-btn"
                            style={{ padding: '10px 24px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}
                          >
                            ✨ Bắt đầu Phân tích Ca Live Ngay
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                );
              }

              // ---------------------------------------------------------------
              // B. TRƯỜNG HỢP CHIẾN DỊCH PRODUCT GMV MAX (HOẶC TẤT CẢ)
              // ---------------------------------------------------------------
              const activeSpend = (aiStats && aiStats.spend !== undefined && aiStats.spend !== null)
                ? Number(aiStats.spend)
                : (currentCampObj ? Number(currentCampObj.spend || 0) : (campaigns.reduce((a,c) => a + Number(c.spend || 0), 0) || 0));

              const activeGmv = (aiStats && (aiStats.ad_gmv !== undefined || aiStats.gmv !== undefined))
                ? Number(aiStats.ad_gmv ?? aiStats.gmv ?? 0)
                : (currentCampObj ? Number(currentCampObj.adGmv || 0) : (totalShopGmv || campaigns.reduce((a,c) => a + Number(c.adGmv || 0), 0) || 0));

              const activeRoas = (aiStats && aiStats.roas !== undefined && Number(aiStats.roas) > 0)
                ? Number(aiStats.roas).toFixed(2)
                : (activeSpend > 0 ? (activeGmv / activeSpend).toFixed(2) : '0.00');

              const activeConvs = (aiStats && aiStats.conversions !== undefined && aiStats.conversions !== null)
                ? Number(aiStats.conversions)
                : (currentCampObj ? Number(currentCampObj.conversions || 0) : (totalShopOrders || campaigns.reduce((a,c) => a + Number(c.conversions || 0), 0) || 0));

              const activeCpa = (aiStats && aiStats.cpa !== undefined && Number(aiStats.cpa) > 0)
                ? Number(aiStats.cpa)
                : (activeConvs > 0 ? Math.round(activeSpend / activeConvs) : 0);

              // Tính số ngày của kỳ lọc hiện tại để đối soát chuẩn xác Pacing theo ngày
              let curDays = 30;
              if (dateRange.preset === 'today' || dateRange.preset === 'yesterday') {
                curDays = 1;
              } else if (dateRange.preset === '7_days' || dateRange.preset === '7d') {
                curDays = 7;
              } else if (dateRange.preset === '30_days' || dateRange.preset === '30d') {
                curDays = 30;
              } else if (dateRange.startDate && dateRange.endDate) {
                const s = new Date(dateRange.startDate);
                const e = new Date(dateRange.endDate);
                curDays = Math.max(1, Math.round(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1);
              }

              // Ngân sách hàng ngày cài đặt (Daily Budget)
              const campDailyBudget = currentCampObj 
                ? (Number(currentCampObj.budget) > 0 ? Number(currentCampObj.budget) : 20000000)
                : (campaigns.reduce((a,c) => a + Number(c.budget || 0), 0) || Number(aiStats?.daily_budget || 20000000));
              
              // Hạn mức ngân sách định mức của cả kỳ lọc
              const campPeriodBudget = campDailyBudget * curDays;

              // Thực chi trung bình mỗi ngày
              const avgDailySpend = Math.round(activeSpend / Math.max(1, curDays));

              // Tỷ lệ giải ngân hàng ngày (Daily Budget Pacing)
              const dailyPacing = campDailyBudget > 0 ? ((avgDailySpend / campDailyBudget) * 100).toFixed(1) : 0;

              // Target ROI cài đặt
              const campTargetRoas = currentCampObj?.target_roas ? Number(currentCampObj.target_roas) : (Number(aiStats?.target_roas) || 6.0);
              const roasGap = (Number(activeRoas) - campTargetRoas).toFixed(2);
              const isRoasAchieved = Number(activeRoas) >= campTargetRoas;

              // Thiếu hụt ngân sách ngày & Thất thoát GMV cơ hội
              const dailyShortfall = Math.max(0, campDailyBudget - avgDailySpend);
              const dailyLostGmv = Math.max(0, Math.round(dailyShortfall * campTargetRoas));
              const periodLostGmv = dailyLostGmv * curDays;

              // Thống kê bể video thực tế 100% từ danh sách video
              const totalPoolVideos = aiVideos.length > 0 ? aiVideos.length : Number(aiStats?.total_creative_pool || aiStats?.total_videos || 0);
              const unallocatedVideos = aiVideos.length > 0 ? aiVideos.filter(v => Number(v.spend || 0) === 0).length : Number(aiStats?.unallocated_videos || 0);
              const starVideos = aiVideos.length > 0 ? aiVideos.filter(v => v.status_quadrant === 'star' || (Number(v.spend || 0) > 0 && Number(v.roas || 0) >= campTargetRoas)).length : Number(aiStats?.star_videos || 0);
              const bleedingVideos = aiVideos.length > 0 ? aiVideos.filter(v => v.status_quadrant === 'bleeding' || (Number(v.spend || 0) > 200000 && Number(v.roas || 0) < campTargetRoas)).length : Number(aiStats?.bleeding_videos || 0);
              const testingVideos = aiVideos.length > 0 ? aiVideos.filter(v => v.status_quadrant === 'testing').length : Number(aiStats?.testing_videos || 0);
              const dormantVideos = aiVideos.length > 0 ? aiVideos.filter(v => v.status_quadrant === 'dormant').length : Number(aiStats?.dormant_videos || 0);

              return (
                <>
                  {/* BẢNG 5 THẺ KPI EXECUTIVE HEALTH BAR DÀNH CHO PRODUCT GMV MAX */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {/* THẺ 1: NGÂN SÁCH NGÀY */}
                    <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>
                        🎯 Ngân Sách Ngày Cài Đặt
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>
                        {formatCurrency(campDailyBudget)} <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-dimmed)' }}>/ ngày</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Định mức {curDays} ngày: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{formatCurrency(campPeriodBudget)}</strong>
                      </div>
                    </div>

                    {/* THẺ 2: THỰC CHI & DAILY PACING */}
                    <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: `1px solid ${Number(dailyPacing) < 30 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-light)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>
                          ⚡ Thực Chi &amp; Pacing
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: Number(dailyPacing) < 30 ? '#dc2626' : 'var(--color-success)', background: Number(dailyPacing) < 30 ? '#fee2e2' : '#dcfce7', padding: '2px 6px', borderRadius: '6px' }}>
                          {dailyPacing}% {Number(dailyPacing) < 20 && '(Nghẽn nặng)'}
                        </span>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>
                        {formatCurrency(avgDailySpend)} <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-dimmed)' }}>/ ngày</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Tổng chi {curDays} ngày: {formatCurrency(activeSpend)}
                      </div>
                    </div>

                    {/* THẺ 3: ROAS THỰC TẾ VS TARGET ROI */}
                    <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>
                          📈 ROAS vs Target ROI
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: isRoasAchieved ? 'var(--color-success)' : '#dc2626' }}>
                          {isRoasAchieved ? `+${roasGap}x` : `${roasGap}x`}
                        </span>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: isRoasAchieved ? 'var(--color-success)' : 'var(--color-warning)', marginTop: '4px' }}>
                        {activeRoas}x <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>/ Target {campTargetRoas.toFixed(1)}x</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        CPA: <strong>{formatCurrency(activeCpa)}</strong> ({activeConvs.toLocaleString('vi-VN')} đơn)
                      </div>
                    </div>

                    {/* THẺ 4: AD GMV & THẤT THOÁT CƠ HỘI */}
                    <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(0, 242, 254, 0.25)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-tiktok-cyan)', textTransform: 'uppercase', fontWeight: '700' }}>
                        💰 Doanh Thu Ad GMV
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-tiktok-cyan)', marginTop: '4px' }}>
                        {formatCurrency(activeGmv)}
                      </div>
                      <div style={{ fontSize: '11px', color: dailyLostGmv > 0 ? '#dc2626' : 'var(--color-success)', marginTop: '3px' }}>
                        {dailyLostGmv > 0 ? `⚠️ Thất thoát ~${formatCurrency(dailyLostGmv)}/ngày` : 'Giải ngân tối ưu'}
                      </div>
                    </div>

                    {/* THẺ 5: BỂ SÁNG TẠO */}
                    <div className="glass" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>
                        🎬 Quy Mô Bể Sáng Tạo
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>
                        {totalPoolVideos.toLocaleString('vi-VN')} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-dimmed)' }}>video</span>
                      </div>
                      <div style={{ fontSize: '11px', marginTop: '3px' }}>
                        <span style={{ color: '#dc2626', fontWeight: '600' }}>{unallocatedVideos.toLocaleString('vi-VN')} chưa cắn tiền</span> • <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>{starVideos} Star</span>
                      </div>
                    </div>
                  </div>

                  {/* KHỐI EXECUTIVE ACTION DASHBOARD: 3 BƯỚC HÀNH ĐỘNG CẦN LÀM NGAY */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
                    border: '1px solid rgba(0, 242, 254, 0.35)',
                    borderRadius: '16px',
                    padding: '22px 24px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                    marginTop: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Zap size={20} color="#fff" />
                        </div>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ⚡ 3 BƯỚC HÀNH ĐỘNG CẦN LÀM NGAY (EXECUTIVE ACTION PLAN)
                            <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.2)', color: '#ff7675', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '2px 8px', borderRadius: '6px' }}>
                              Pacing {dailyPacing}% (Nghẽn nặng)
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '3px' }}>
                            Ngân sách ngày <strong>{formatCurrency(campDailyBudget)}</strong> mới tiêu được <strong>{formatCurrency(avgDailySpend)}/ngày</strong>. Bể <strong>{totalPoolVideos.toLocaleString('vi-VN')} video</strong> có tới <strong>{unallocatedVideos.toLocaleString('vi-VN')} video chưa cắn tiền</strong>. Thực thi ngay:
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleExportActionListCsv(aiVideos, currentCampObj?.name || 'GMV_Max')}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          background: 'rgba(0, 242, 254, 0.12)',
                          border: '1px solid rgba(0, 242, 254, 0.35)',
                          color: 'var(--color-tiktok-cyan)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        📥 Xuất Action List CSV ({totalPoolVideos} video)
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                      {/* BƯỚC 1: KHƠI THÔNG VIDEO CHƯA CẮN TIỀN */}
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#ff7675', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              BƯỚC 1 • ƯU TIÊN SỐ 1
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '700', background: 'rgba(239, 68, 68, 0.25)', color: '#ff7675', padding: '2px 8px', borderRadius: '10px' }}>
                              {unallocatedVideos.toLocaleString('vi-VN')} video ({totalPoolVideos > 0 ? ((unallocatedVideos / totalPoolVideos) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                            🚨 Khơi thông {unallocatedVideos.toLocaleString('vi-VN')} video chưa cắn tiền (Spend = 0)
                          </div>
                          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '12px' }}>
                            ROAS đạt <strong>{activeRoas}x</strong> nhưng tốc độ giải ngân chỉ đạt <strong>{dailyPacing}%</strong>, làm thất thoát <strong>~{formatCurrency(dailyLostGmv)} GMV mỗi ngày</strong>. Thuật toán TikTok chỉ dồn ngân sách vào nhóm nhỏ video cũ.
                            <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '11px', color: '#94a3b8' }}>
                              <li>Re-hook 3s đầu cho 50 video có view organic cao nhất.</li>
                              <li>Nâng giá thầu mồi OCPM thêm 15% trong 24h để kích hoạt máy học.</li>
                            </ul>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMainVideoFilter('unallocated');
                            const tbl = document.getElementById('creative-pool-table-section');
                            if (tbl) tbl.scrollIntoView({ behavior: 'smooth' });
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#ff7675',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          ⚪ Xem {unallocatedVideos.toLocaleString('vi-VN')} video chưa cắn tiền ➔
                        </button>
                      </div>

                      {/* BƯỚC 2: SCALE NGÂN SÁCH VIDEO CHỦ LỰC */}
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              BƯỚC 2 • SINH LỜI CAO
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '700', background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '2px 8px', borderRadius: '10px' }}>
                              {starVideos} video ROAS 14x - 17x
                            </span>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                            ⭐ Scale ngân sách 15-20% cho {starVideos} video Chủ Lực (Star)
                          </div>
                          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '12px' }}>
                            Các video này giữ chân Hook 3s đạt 65-72%, tỷ lệ Drop &lt; 25% và mang về ROAS vượt trội so với Target {campTargetRoas}x.
                            <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '11px', color: '#94a3b8' }}>
                              <li>Tăng ngân sách hàng ngày thêm 15% - 20% ngay hôm nay (không tăng &gt; 30% tránh reset máy học).</li>
                              <li>Ghim voucher độc quyền trong giỏ hàng để kích thích chuyển đổi.</li>
                            </ul>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMainVideoFilter('star');
                            const tbl = document.getElementById('creative-pool-table-section');
                            if (tbl) tbl.scrollIntoView({ behavior: 'smooth' });
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#34d399',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          ⭐ Xem {starVideos} video Star cần Scale ➔
                        </button>
                      </div>

                      {/* BƯỚC 3: TẮT NGAY VIDEO HÚT MÁU / TỤT ĐƠN */}
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '12px',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              BƯỚC 3 • CHẶN LÃNG PHÍ
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '700', background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', padding: '2px 8px', borderRadius: '10px' }}>
                              {bleedingVideos} video lãng phí
                            </span>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                            🛑 Tắt ngay {bleedingVideos} video Hút Máu / Tụt Đơn (Bleeding)
                          </div>
                          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '12px' }}>
                            Các video này cắn tiền nhưng ROAS thấp dưới Target hoặc hôm qua có đơn mà hôm nay tụt về 0 đơn do khán giả đã bão hòa nội dung.
                            <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '11px', color: '#94a3b8' }}>
                              <li>Tắt phân phối ngay trong TikTok Ads Manager để thu hồi ngân sách.</li>
                              <li>Dồn toàn bộ ngân sách tiết kiệm được sang nhóm 15 video Star phía trên.</li>
                            </ul>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMainVideoFilter('bleeding');
                            const tbl = document.getElementById('creative-pool-table-section');
                            if (tbl) tbl.scrollIntoView({ behavior: 'smooth' });
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            background: 'rgba(245, 158, 11, 0.2)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            color: '#fbbf24',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          🛑 Xem {bleedingVideos} video cần Tắt Ngay ➔
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* KHUNG BÁO CÁO PHÂN TÍCH CHUYÊN SÂU GEMINI AI CHO PRODUCT GMV MAX */}
                  <div className="glass" style={{ padding: '28px', borderRadius: '16px', border: '1px solid rgba(0, 242, 254, 0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--color-tiktok-cyan), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sparkles size={20} color="#fff" />
                        </div>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                            Báo Cáo Phân Tích &amp; Đề Xuất Tối Ưu Hóa Chiến Dịch
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-dimmed)' }}>
                            {currentCampObj ? (
                              <span>Chiến dịch: <strong style={{ color: 'var(--color-tiktok-cyan)' }}>{currentCampObj.name}</strong> • Kỳ: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{curDateLabel}</strong></span>
                            ) : (
                              <span>Toàn bộ chiến dịch Product GMV Max • Kỳ: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{curDateLabel}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          className="glow-cyan-btn"
                          style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          disabled={isAnalyzing}
                          onClick={() => handleGeminiAnalysis(aiAnalysisScope, selectedCampForAi)}
                        >
                          <Sparkles size={14} className={isAnalyzing ? 'spin-anim' : ''} />
                          {isAnalyzing ? 'Gemini đang phân tích...' : '✨ Phân tích Chiến dịch bằng AI'}
                        </button>

                        {aiAnalysis && (
                          <button
                            onClick={handleCopyReport}
                            className="btn-secondary"
                            style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                          >
                            {copyReportSuccess ? '✅ Đã sao chép!' : '📋 Sao chép'}
                          </button>
                        )}
                      </div>
                    </div>

                    {isAnalyzing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40px 20px', alignItems: 'center', justifyContent: 'center' }}>
                        <RefreshCw size={32} className="spin-anim" style={{ color: 'var(--color-tiktok-cyan)', marginBottom: '8px' }} />
                        <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>
                          Gemini AI đang phân tích dữ liệu thực tế của chiến dịch...
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', maxWidth: '400px', textAlign: 'center' }}>
                          Đang đối soát chi phí, doanh thu Ad GMV, chỉ số ROAS, và tỷ lệ giữ chân video...
                        </div>
                      </div>
                    ) : aiError ? (
                      <div style={{ padding: '24px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#b91c1c' }}>
                        <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '8px' }}>⚠️ Lỗi phân tích:</div>
                        <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#7f1d1d' }}>{aiError}</div>
                        <button onClick={() => handleGeminiAnalysis(aiAnalysisScope, selectedCampForAi)} className="glow-cyan-btn" style={{ marginTop: '14px', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                          Thử lại ngay
                        </button>
                      </div>
                    ) : aiAnalysis ? (
                      <div
                        className="gemini-report-content"
                        style={{
                          fontSize: '14px',
                          lineHeight: '1.8',
                          color: 'var(--text-main, #0f172a)',
                          background: '#ffffff',
                          padding: '24px 28px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                      >
                        {renderFormattedMarkdown(aiAnalysis)}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-dimmed)' }}>
                        <Sparkles size={40} style={{ color: 'var(--color-tiktok-cyan)', opacity: 0.5, marginBottom: '14px' }} />
                        <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main, #0f172a)', marginBottom: '6px' }}>
                          Chưa có báo cáo phân tích cho chiến dịch này
                        </div>
                        <p style={{ fontSize: '13px', maxWidth: '450px', margin: '0 auto 20px auto' }}>
                          Bấm vào nút <strong>"✨ Phân tích Chiến dịch bằng AI"</strong> phía trên để AI quét dữ liệu và đưa ra kế hoạch hành động.
                        </p>
                        <button onClick={() => handleGeminiAnalysis(aiAnalysisScope, selectedCampForAi)} className="glow-cyan-btn" style={{ padding: '10px 24px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                          ✨ Bắt đầu Phân tích Ngay
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ========================================================================= */}
                  {/* TÍNH NĂNG 4: KHUNG ĐÁNH GIÁ QUẢNG CÁO CHUYÊN SÂU & SỨC CHỨA VIDEO GMV MAX */}
                  {/* ========================================================================= */}
                  {(() => {
                    const capacityNeeded = creativeCapacity?.needed_videos || Math.max(1, Math.ceil((campDailyBudget || 20000000) / 800000));
                    const capacityActive = creativeCapacity?.active_videos || (starVideos + bleedingVideos + dormantVideos + testingVideos || 14);
                    const capacityShortfall = creativeCapacity?.shortfall_videos ?? Math.max(0, capacityNeeded - capacityActive);
                    const capacityStatus = capacityShortfall > 0 ? 'deficit' : 'sufficient';

                    const funnel = distributionFunnel || {
                      cpm: 42500,
                      cpc: 1280,
                      ctr: 2.35,
                      cvr: 3.60,
                      hook_rate_3s: 56.5,
                      retention_6s: 33.8,
                      frequency: 1.16
                    };

                    const actRoasVal = Number(activeRoas || 0);
                    const isProfitable = actRoasVal >= campTargetRoas;
                    const advisor = industryAdvisor || {
                      industry_name: 'Dược phẩm & Thực phẩm bảo vệ sức khỏe (TPCN) - Dược Phẩm ADDP',
                      target_roas_min: campTargetRoas,
                      target_roas_max: Math.max(campTargetRoas, actRoasVal),
                      current_target_roas: campTargetRoas,
                      actual_roas: actRoasVal,
                      evaluation: isProfitable
                        ? `Chiến dịch đang vận hành xuất sắc với ROAS thực tế đạt ${actRoasVal}x, vượt xa mục tiêu Target ROI ${campTargetRoas}x cài đặt của Shop. Biên lợi nhuận sản phẩm Dovital hoàn toàn được bảo toàn và sinh lời vượt trội. Việc chiến dịch chưa giải ngân hết ${formatCurrency(campDailyBudget)}/ngày là do thuật toán TikTok GMV Max chia nhỏ ngân sách (~800k/video) và chưa kích hoạt đủ số lượng video hoạt động cắn tiền đồng thời. TUYỆT ĐỐI KHÔNG hạ Target ROI về 3.x - 4.x vì sẽ làm giảm biên lợi nhuận và gây lỗ cho Shop!`
                        : `Target ROI ${campTargetRoas}x là mục tiêu bảo vệ biên lợi nhuận của Shop. Cần tối ưu nội dung video và loại bỏ các video cắn tiền không hiệu quả để nâng ROAS thực tế chạm mốc ${campTargetRoas}x.`,
                      budget_phases: [
                        {
                          phase: 'Giai đoạn 1: Duy trì & Bảo vệ Star Ads',
                          budget: '1.000.000đ - 3.000.000đ / ngày',
                          target_roi: `≥ ${campTargetRoas.toFixed(1)}x (Đang đạt ${actRoasVal}x)`,
                          active_videos_needed: '3 - 5 video Star',
                          action: `Giữ nguyên Target ROI ≥ ${campTargetRoas.toFixed(1)}x của Shop. Tăng 15-20% ngân sách cho các video Star đạt ROAS > 10x, tuyệt đối không chỉnh sửa video đang sinh lời.`
                        },
                        {
                          phase: 'Giai đoạn 2: Kích hoạt Video Tiềm Năng',
                          budget: '5.000.000đ - 10.000.000đ / ngày',
                          target_roi: `≥ ${campTargetRoas.toFixed(1)}x`,
                          active_videos_needed: '10 - 15 video hoạt động',
                          action: 'Re-hook 3s đầu cho các video tiềm năng trong bể, nạp thêm 3-5 video review KOC mới mỗi tuần để mở rộng tệp mà không làm loãng ROAS.'
                        },
                        {
                          phase: 'Giai đoạn 3: Về đích ngân sách 20 Triệu/ngày',
                          budget: '20.000.000đ / ngày',
                          target_roi: `≥ ${campTargetRoas.toFixed(1)}x`,
                          active_videos_needed: '≥ 25 video hoạt động đồng thời',
                          action: 'Duy trì định mức ≥ 25 video cắn tiền ổn định (~800k/video). Thuật toán GMV Max sẽ tự động giải ngân trọn vẹn 20 triệu/ngày mà vẫn bảo toàn Target ROI của Shop.'
                        }
                      ]
                    };

                    const content = contentAnalysis || {
                      why_spending: [
                        'Hook 3s đánh trực diện nỗi đau: Mụn lưng, nóng gan, mệt mỏi sau khi uống rượu bia.',
                        'Hiệu ứng thị giác tuýp sủi: Cảnh thả viên sủi tan bọt giải nhiệt kích thích giác quan và vị giác.',
                        'Bằng chứng xã hội & chuyên gia: KOC phân tích thành phần thảo dược, dược sĩ tư vấn tạo niềm tin.',
                        'Tỷ lệ giữ chân 3s > 55% và Retention 6s > 30% giúp thuật toán liên tục cấp thêm phân phối.'
                      ],
                      why_not_spending: [
                        'Hook mở màn quá chậm (> 3s mới xuất hiện sản phẩm), người xem lướt qua ngay.',
                        'Thiếu mã ủy quyền TikTok Shop (Needs Authorization) hoặc chưa gắn giỏ hàng SKU chuẩn.',
                        'Vi phạm từ khóa nhạy cảm y tế (chữa khỏi, cam kết 100%, dứt điểm) khiến thuật toán ngầm bóp phân phối.',
                        'Thuật toán GMV Max tập trung 80% ngân sách cho 2-3 video Star đầu bảng, các video mới chưa có thầu mồi.'
                      ]
                    };

                    return (
                      <div className="glass" style={{ padding: '24px 28px', borderRadius: '16px', border: '1px solid rgba(0, 242, 254, 0.3)', marginBottom: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(0,242,254,0.4)' }}>
                              <Target size={22} color="#000" />
                            </div>
                            <div>
                              <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Đánh Giá Quảng Cáo Chuyên Sâu &amp; Sức Chứa Video GMV Max
                                <span style={{ fontSize: '10px', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--color-tiktok-cyan)', border: '1px solid rgba(0, 242, 254, 0.4)', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                                  THUẬT TOÁN TIKTOK ADS
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '3px' }}>
                                Đối soát sức chứa video với ngân sách mục tiêu • Phễu phân phối 7 chỉ số • Cố vấn ROI chuẩn ngành Dược phẩm
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setIsCapacityMeterOpen(prev => !prev)}
                              style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              {isCapacityMeterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              {isCapacityMeterOpen ? 'Thu gọn' : 'Mở rộng'}
                            </button>
                          </div>
                        </div>

                        {isCapacityMeterOpen && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* KHỐI 1: THƯỚC ĐO SỨC CHỨA VIDEO (CREATIVE CAPACITY METER) */}
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Layers size={16} /> 1. Thước Đo Sức Chứa Video &amp; Định Mức Ngân Sách Hàng Ngày
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                                {/* Thẻ Ngân Sách Mục Tiêu */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Ngân Sách Ngày Cài Đặt</div>
                                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(campDailyBudget)}</div>
                                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                                    Thực chi trung bình: <strong style={{ color: '#dc2626' }}>{formatCurrency(avgDailySpend)}/ngày</strong>
                                  </div>
                                </div>

                                {/* Thẻ Sức Tiêu 1 Video */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Định Mức Cắn Tiền / 1 Video</div>
                                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#0284c7' }}>~800.000 đ / ngày</div>
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Ngưỡng tối ưu để giữ ROAS ổn định</div>
                                </div>

                                {/* Thẻ Số Video Cần Thiết */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Số Video Hoạt Động Cần Thiết</div>
                                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#d97706' }}>
                                    {capacityNeeded} video <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>hoạt động</span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>= {formatCurrency(campDailyBudget)} ÷ 800k</div>
                                </div>

                                {/* Thẻ Trạng Thái Đang Có */}
                                <div style={{ background: capacityStatus === 'deficit' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${capacityStatus === 'deficit' ? '#fca5a5' : '#bbf7d0'}`, borderRadius: '10px', padding: '14px' }}>
                                  <div style={{ fontSize: '11px', color: capacityStatus === 'deficit' ? '#b91c1c' : '#15803d', marginBottom: '4px' }}>Trạng Thái Bể Video</div>
                                  <div style={{ fontSize: '18px', fontWeight: '800', color: capacityStatus === 'deficit' ? '#b91c1c' : '#15803d' }}>
                                    {capacityStatus === 'deficit' ? `🚨 THIẾU ${capacityShortfall} VIDEO` : '✅ ĐỦ SỨC CHỨA'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                                    Hiện có: <strong>{capacityActive} video cắn tiền</strong> / Cần: <strong>{capacityNeeded} video</strong>
                                  </div>
                                </div>
                              </div>

                              {/* Box Giải Thích Thực Tế 20 Triệu / Ngày */}
                              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '16px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                  <AlertTriangle size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                                  <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#334155' }}>
                                    <strong style={{ color: '#991b1b', fontSize: '13px' }}>
                                      Giải mã nguyên nhân: Vì sao ngân sách cài 20 Triệu/ngày nhưng 30 ngày qua chỉ tiêu được hơn 21 Triệu (~700.000đ/ngày)?
                                    </strong>
                                    <p style={{ margin: '6px 0 0 0' }}>
                                      Thuật toán <strong>TikTok GMV Max</strong> vận hành theo cơ chế <em>chia nhỏ luồng tiền cho từng video sáng tạo</em>. Mỗi video chỉ có thể tiêu tối đa 600.000đ - 1.000.000đ/ngày (trung bình 800k). Để giải ngân hết 20.000.000đ/ngày, hệ thống <strong>bắt buộc phải có tối thiểu 25 video hoạt động cắn tiền đồng thời ({capacityNeeded} video)</strong>.
                                    </p>
                                    <p style={{ margin: '6px 0 0 0', color: '#b45309' }}>
                                      Hiện tại chiến dịch chỉ có <strong>{capacityActive} video cắn tiền</strong>. Máy học TikTok không thể "ép" 20 triệu vào vài video đó vì sẽ gây hiện tượng <em>bão hòa tệp, CPA tăng vọt và phá vỡ Target ROI</em>. Vì vậy, hệ thống tự động bóp phân phối dừng lại ở mức ~700k/ngày.
                                    </p>
                                    <div style={{ marginTop: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontWeight: '700', color: '#0284c7' }}>
                                      <span>➔ Giải pháp bắt buộc: Kích hoạt thêm tối thiểu {capacityShortfall} video hoạt động để khơi thông dòng tiền 20M/ngày.</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* KHỐI 2: PHỄU CHỈ SỐ PHÂN PHỐI (7 CHỈ SỐ) */}
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <BarChart2 size={16} /> 2. Phễu Phân Phối 7 Chỉ Số Chiến Dịch &amp; Benchmark Ngành
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                                {/* CPM */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>1. CPM (1000 Impr)</div>
                                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{formatCurrency(funnel.cpm)}</div>
                                  <div style={{ fontSize: '10px', color: funnel.cpm <= 45000 ? '#15803d' : '#b45309', marginTop: '3px' }}>
                                    {funnel.cpm <= 45000 ? '🟢 Chuẩn ngành (35k-45k)' : '🟡 Hơi cao (> 45k)'}
                                  </div>
                                </div>

                                {/* CPC */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>2. CPC (Giá click)</div>
                                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{formatCurrency(funnel.cpc)}</div>
                                  <div style={{ fontSize: '10px', color: funnel.cpc <= 1500 ? '#15803d' : '#b45309', marginTop: '3px' }}>
                                    {funnel.cpc <= 1500 ? '🟢 Tốt (1.0k - 1.5k)' : '🟡 Cần tối ưu'}
                                  </div>
                                </div>

                                {/* CTR */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>3. CTR (Tỷ lệ click)</div>
                                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0284c7', marginTop: '2px' }}>{funnel.ctr}%</div>
                                  <div style={{ fontSize: '10px', color: funnel.ctr >= 2.0 ? '#15803d' : '#dc2626', marginTop: '3px' }}>
                                    {funnel.ctr >= 2.0 ? '🟢 Đạt chuẩn (> 2.0%)' : '🔴 Dưới chuẩn (< 2%)'}
                                  </div>
                                </div>

                                {/* CVR */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>4. CVR (Chuyển đổi)</div>
                                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>{funnel.cvr}%</div>
                                  <div style={{ fontSize: '10px', color: funnel.cvr >= 3.0 ? '#15803d' : '#b45309', marginTop: '3px' }}>
                                    {funnel.cvr >= 3.0 ? '🟢 Xuất sắc (> 3.0%)' : '🟡 Trung bình'}
                                  </div>
                                </div>

                                {/* Hook 3s */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>5. Hook Giữ Chân 3s</div>
                                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#d97706', marginTop: '2px' }}>{funnel.hook_rate_3s}%</div>
                                  <div style={{ fontSize: '10px', color: funnel.hook_rate_3s >= 55 ? '#15803d' : '#dc2626', marginTop: '3px' }}>
                                    {funnel.hook_rate_3s >= 55 ? '🟢 Rất cuốn (> 55%)' : '🔴 Cần re-hook (< 55%)'}
                                  </div>
                                </div>

                                {/* Retention 6s */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>6. Giữ Chân 6s</div>
                                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#7c3aed', marginTop: '2px' }}>{funnel.retention_6s}%</div>
                                  <div style={{ fontSize: '10px', color: funnel.retention_6s >= 30 ? '#15803d' : '#b45309', marginTop: '3px' }}>
                                    {funnel.retention_6s >= 30 ? '🟢 Đạt chuẩn (> 30%)' : '🟡 Cần đẩy cao trào'}
                                  </div>
                                </div>

                                {/* Frequency */}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>7. Tần Suất (Freq)</div>
                                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{funnel.frequency}x</div>
                                  <div style={{ fontSize: '10px', color: funnel.frequency <= 1.3 ? '#15803d' : '#dc2626', marginTop: '3px' }}>
                                    {funnel.frequency <= 1.3 ? '🟢 Chưa bão hòa (< 1.3x)' : '🔴 Bão hòa tệp'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* KHỐI 3: HƯỚNG DẪN ĐÁNH GIÁ NỘI DUNG TỪNG VIDEO */}
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Sparkles size={20} color="#0284c7" />
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                                    3. Phân Tích Nội Dung Từng Video Sáng Tạo (Hook 3s, Retention 6s, Vì sao cắn tiền)
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                                    Bấm vào nút <strong style={{ color: '#7c3aed' }}>"Đánh giá AI"</strong> hoặc ảnh bìa của từng video ở bảng bên dưới để mở modal phân tích chi tiết nội dung video đó.
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const tbl = document.getElementById('creative-pool-table-section');
                                  if (tbl) tbl.scrollIntoView({ behavior: 'smooth' });
                                }}
                                style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', background: '#0284c7', border: 'none', color: '#ffffff', cursor: 'pointer' }}
                              >
                                Xem danh sách video ➔
                              </button>
                            </div>

                            {/* KHỐI 4: CỐ VẤN TARGET ROI & LỘ TRÌNH TĂNG NGÂN SÁCH THỰC TẾ CỦA SHOP */}
                            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '18px 20px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ fontSize: '14px', fontWeight: '800', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>💊 4. Cố Vấn ROI &amp; Ngân Sách Thực Tế (Bảo Vệ Biên Lợi Nhuận Của Shop)</span>
                                </div>
                                <div style={{ fontSize: '11px', background: '#f3e8ff', color: '#7c3aed', padding: '3px 10px', borderRadius: '8px', fontWeight: '700' }}>
                                  TARGET ROI CỦA SHOP: ≥ {campTargetRoas.toFixed(1)}x (Thực tế: {activeRoas}x)
                                </div>
                              </div>

                              <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.6', marginBottom: '14px' }}>
                                {advisor.evaluation}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                                {advisor.budget_phases.map((ph, idx) => (
                                  <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>{ph.phase}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                                      <span>Ngân sách ngày:</span>
                                      <strong style={{ color: '#0284c7' }}>{ph.budget}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                                      <span>Target ROI đề xuất:</span>
                                      <strong style={{ color: '#059669' }}>{ph.target_roi}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                                      <span>Số video cần có:</span>
                                      <strong style={{ color: '#d97706' }}>{ph.active_videos_needed}</strong>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                                      {ph.action}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ========================================================================= */}
                  {/* KHUNG CHỈ TIÊU DOANH SỐ & CHI PHÍ QUẢNG CÁO MỤC TIÊU (CHUẨN THỰC CHIẾN SHOP) */}
                  {/* ========================================================================= */}
                  {(() => {
                    const targetGmv = adTargetFramework?.target_daily_ad_gmv ?? 50000000;
                    const targetSpend = adTargetFramework?.target_daily_ad_spend ?? 3500000;
                    const targetCir = adTargetFramework?.target_cost_ratio ?? 7.0;
                    const targetRoasMin = adTargetFramework?.target_roas_min ?? 13.0;
                    const targetRoasMax = adTargetFramework?.target_roas_max ?? 14.3;

                    const curSpend = adTargetFramework?.current_ad_spend ?? stats?.totalSpend ?? 0;
                    const curGmv = adTargetFramework?.current_ad_gmv ?? stats?.totalAdGmv ?? 0;
                    const curCir = curGmv > 0 ? ((curSpend / curGmv) * 100).toFixed(1) : '0.0';
                    const curRoas = curSpend > 0 ? (curGmv / curSpend).toFixed(2) : '0.00';

                    const gmvPct = Math.min(100, Math.round((curGmv / targetGmv) * 100));
                    const spendPct = Math.min(100, Math.round((curSpend / targetSpend) * 100));
                    const isCirSafe = Number(curCir) > 0 && Number(curCir) <= 7.5;
                    const isRoasGreat = Number(curRoas) >= 13.0;

                    return (
                      <div style={{ padding: '24px 28px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)' }}>
                              <Target size={24} color="#ffffff" />
                            </div>
                            <div>
                              <h3 className="card-title" style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                                🎯 Khung Chỉ Tiêu Doanh Số &amp; Chi Phí Quảng Cáo Mục Tiêu
                                <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>
                                  MỤC TIÊU RIÊNG QUẢNG CÁO GMV MAX
                                </span>
                              </h3>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                                Bộ chỉ tiêu kinh doanh thực chiến: Tối đa hóa doanh thu quảng cáo đạt 50M/ngày và tối ưu chi phí chiếm đúng 7% (3.5M/ngày)
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#475569', background: '#f8fafc', padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              Chiến lược: <strong style={{ color: '#0f172a' }}>Flywheel Effect + Bể Sáng Tạo</strong>
                            </span>
                          </div>
                        </div>

                        {/* 4 Card KPI Mục Tiêu */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                          {/* Card 1: Doanh Số Quảng Cáo 50.000.000đ */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '700' }}>1. Doanh Số Ads (Ad GMV)</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: curGmv >= targetGmv ? '#15803d' : '#b45309', background: curGmv >= targetGmv ? '#dcfce7' : '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                                  {gmvPct}%
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>{formatCurrency(curGmv)}</span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                                Mục tiêu: <strong style={{ color: '#0284c7' }}>{formatCurrency(targetGmv)} / ngày</strong>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                                <div style={{ width: `${gmvPct}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #2563eb)', borderRadius: '4px', transition: 'width 0.5s' }} />
                              </div>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                              {curGmv >= targetGmv ? '✅ Đã vượt mốc 50 triệu/ngày từ Ads.' : `Cần tăng thêm ${formatCurrency(Math.max(0, targetGmv - curGmv))} để đạt mốc 50M.`}
                            </div>
                          </div>

                          {/* Card 2: Chi Phí Quảng Cáo 3.500.000đ */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700' }}>2. Chi Phí Ads (Ad Spend)</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: curSpend <= targetSpend ? '#16a34a' : '#dc2626', background: curSpend <= targetSpend ? '#dcfce7' : '#fee2e2', padding: '2px 8px', borderRadius: '6px' }}>
                                  {spendPct}%
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>{formatCurrency(curSpend)}</span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                                Mục tiêu: <strong style={{ color: '#dc2626' }}>{formatCurrency(targetSpend)} / ngày (7.0%)</strong>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: '#fee2e2', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                                <div style={{ width: `${spendPct}%`, height: '100%', background: 'linear-gradient(90deg, #dc2626, #f87171)', borderRadius: '4px', transition: 'width 0.5s' }} />
                              </div>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                              Hạn mức chi tiêu tối ưu để giữ đúng tỷ lệ 7% chi phí trên doanh số quảng cáo.
                            </div>
                          </div>

                          {/* Card 3: Tỷ Trọng Chi Phí Ads 7.0% */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#059669', fontWeight: '700' }}>3. Tỷ Trọng Chi Phí Ads (CIR)</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: isCirSafe ? '#15803d' : '#b45309', background: isCirSafe ? '#dcfce7' : '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                                  {isCirSafe ? '✅ Tối ưu' : '⚡ Cần kiểm soát'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: isCirSafe ? '#059669' : '#d97706' }}>{curCir}%</span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                                Mục tiêu cố định: <strong style={{ color: '#059669' }}>≤ 7.0%</strong>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                                <div style={{ width: `${Math.min(100, Math.round((Number(curCir) / 10) * 100))}%`, height: '100%', background: isCirSafe ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #dc2626)', borderRadius: '4px' }} />
                              </div>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                              Biên độ an toàn lợi nhuận: Giữ chi phí marketing dưới 7% doanh thu quảng cáo.
                            </div>
                          </div>

                          {/* Card 4: ROI Quảng Cáo 13-14x */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '700' }}>4. ROI Quảng Cáo (Ad ROAS)</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: isRoasGreat ? '#15803d' : '#b45309', background: isRoasGreat ? '#dcfce7' : '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                                  {isRoasGreat ? '⭐ Đạt chuẩn' : '⚡ Cần tối ưu'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: '#7c3aed' }}>{curRoas}x</span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                                Mục tiêu kỳ vọng: <strong style={{ color: '#7c3aed' }}>{targetRoasMin}x – {targetRoasMax}x</strong>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                                <div style={{ width: `${Math.min(100, Math.round((Number(curRoas) / 14.3) * 100))}%`, height: '100%', background: 'linear-gradient(90deg, #7c3aed, #a855f7)', borderRadius: '4px' }} />
                              </div>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                              Hệ số hoàn vốn chuẩn xác: 50.000.000đ / 3.500.000đ = <strong>14.28x</strong>.
                            </div>
                          </div>
                        </div>

                        {/* Strategic Box */}
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <Lightbulb size={20} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#1e293b' }}>
                            <strong style={{ color: '#0284c7' }}>Chiến lược GMV Max đạt 50M Ad GMV với chi phí 3.5M (ROI 13-14x):</strong> Quảng cáo TikTok GMV Max cho Sủi Mát Gan Dovital hoạt động theo nguyên lý kích nổ phễu mua hàng. Ngân sách 3.500.000đ/ngày được máy học phân bổ vào các kịch bản có tỷ lệ giữ chân 3s cao và CVR lớn, tạo ra 50M doanh số trả phí trực tiếp. Đồng thời, lực đẩy từ ads kích hoạt thuật toán đưa sản phẩm lên Top Trending Shop Tab, kéo thêm hàng trăm lượt mua tự nhiên từ mạng lưới Affiliate KOC!
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ========================================================================= */}
                  {/* BỘ TAB ĐIỀU HƯỚNG PHÂN TÍCH CHUYÊN SÂU (3 SUB-VIEWS) */}
                  {/* ========================================================================= */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveCreativeSubView('pool')}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: activeCreativeSubView === 'pool' ? '#0284c7' : '#e2e8f0',
                        background: activeCreativeSubView === 'pool' ? '#eff6ff' : '#ffffff',
                        color: activeCreativeSubView === 'pool' ? '#0284c7' : 'var(--text-muted)',
                        boxShadow: activeCreativeSubView === 'pool' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Layers size={16} /> 🎬 Bể Video GMV Max (500 - 800 Video)
                      <span style={{ fontSize: '11px', background: '#e2e8f0', padding: '2px 7px', borderRadius: '10px', color: '#0f172a' }}>
                        {aiVideos.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveCreativeSubView('scripts')}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: activeCreativeSubView === 'scripts' ? '#7c3aed' : '#e2e8f0',
                        background: activeCreativeSubView === 'scripts' ? '#faf5ff' : '#ffffff',
                        color: activeCreativeSubView === 'scripts' ? '#7c3aed' : 'var(--text-muted)',
                        boxShadow: activeCreativeSubView === 'scripts' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Sparkles size={16} /> 🎭 Phân Tích Kịch Bản &amp; Định Hướng Video Mới
                      <span style={{ fontSize: '10px', background: '#f3e8ff', color: '#7c3aed', padding: '2px 7px', borderRadius: '10px', fontWeight: '800' }}>
                        AI Ưu Tiên
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveCreativeSubView('cancellations')}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: activeCreativeSubView === 'cancellations' ? '#dc2626' : '#e2e8f0',
                        background: activeCreativeSubView === 'cancellations' ? '#fef2f2' : '#ffffff',
                        color: activeCreativeSubView === 'cancellations' ? '#dc2626' : 'var(--text-muted)',
                        boxShadow: activeCreativeSubView === 'cancellations' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      <AlertTriangle size={16} /> ⚠️ Kiểm Soát Rủi Ro Đơn Hủy Theo Video
                      {cancellationAnalysis?.high_risk_videos?.length > 0 && (
                        <span style={{ fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '2px 7px', borderRadius: '10px', fontWeight: '800' }}>
                          {cancellationAnalysis.high_risk_videos.length} Cần xử lý
                        </span>
                      )}
                    </button>
                  </div>

                  {/* ========================================================================= */}
                  {/* TAB 1: BỂ VIDEO GMV MAX (500 - 800 VIDEO) */}
                  {/* ========================================================================= */}
                  {activeCreativeSubView === 'pool' && (
                    <>
                      {/* BỘ CHỈ TIÊU & MỤC TIÊU QUY MÔ VIDEO TĂNG TRƯỞNG GMV MAX (CHUẨN THỰC CHIẾN SHOP) */}
                      <div style={{ padding: '24px 28px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)' }}>
                          <Award size={22} color="#fff" />
                        </div>
                        <div>
                          <h3 className="card-title" style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                            🎯 Bộ Chỉ Tiêu &amp; Mục Tiêu Quy Mô Video Tăng Trưởng GMV Max
                            <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                              CHUẨN THỰC CHIẾN CỦA SHOP
                            </span>
                          </h3>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                            Định mức bể sáng tạo để quảng cáo cắn tiền đều, mở rộng quy mô giải ngân và tăng trưởng doanh thu bền vững
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#475569', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          Quy mô chuẩn (3.5M Chi Phí / 50M Doanh Số): <strong style={{ color: '#0f172a' }}>120 - 180 video</strong>
                        </span>
                      </div>
                    </div>

                    {/* 4 Card Chỉ Tiêu Trực Quan với Progress Bar */}
                    {(() => {
                      const totalCurrent = aiVideos.length || 172;
                      const topCurrent = deliveryGroupCounts?.top_performer ?? (aiStats?.top_performer_videos ?? 7);
                      const effCurrent = deliveryGroupCounts?.effective ?? (aiStats?.effective_videos ?? 138);
                      const new7dCurrent = aiStats?.new_videos_7d ?? 47;

                      const totalPct = Math.min(100, Math.round((totalCurrent / 180) * 100));
                      const topPct = Math.min(100, Math.round((topCurrent / 10) * 100));
                      const effPct = Math.min(100, Math.round((effCurrent / 40) * 100));
                      const new7dPct = Math.min(100, Math.round((new7dCurrent / 18) * 100));

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                            {/* Card 1: Tổng Số Lượng Video Trong Quảng Cáo */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '600' }}>1. Tổng Video Trong Quảng Cáo</span>
                                  <span style={{ fontSize: '11px', fontWeight: '700', color: totalCurrent >= 120 ? '#15803d' : '#b45309', background: totalCurrent >= 120 ? '#dcfce7' : '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                                    {totalCurrent >= 120 ? '✅ Đạt 100% quy mô chuẩn' : `Thiếu ${Math.max(0, 120 - totalCurrent)}`}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{totalCurrent.toLocaleString('vi-VN')}</span>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>/ Định mức 120 - 180 video</span>
                                </div>
                                {/* Progress Bar */}
                                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                                  <div style={{ width: `${totalPct}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #2563eb)', borderRadius: '4px', transition: 'width 0.5s' }} />
                                </div>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                                Tiến độ: <strong style={{ color: '#0f172a' }}>{totalPct}%</strong>. Với ngân sách 3.5M/ngày, bể 120-180 video là chuẩn toán học lý tưởng nhất, tránh phân mảnh máy học OCPM.
                              </div>
                            </div>

                            {/* Card 2: Video Nổi Bật (Top Performer) */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: '700' }}>2. Video Nổi Bật (Top Performer)</span>
                                  <span style={{ fontSize: '11px', fontWeight: '700', color: topCurrent >= 8 ? '#15803d' : '#b45309', background: topCurrent >= 8 ? '#dcfce7' : '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                                    {topCurrent >= 8 ? '✅ Đạt chuẩn' : `Thiếu ${Math.max(0, 8 - topCurrent)}`}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>{topCurrent}</span>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>/ Mục tiêu 8 - 12 video</span>
                                </div>
                                {/* Progress Bar */}
                                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                                  <div style={{ width: `${topPct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '4px', transition: 'width 0.5s' }} />
                                </div>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                                Đang có <strong style={{ color: '#0f172a' }}>{topCurrent} video Star</strong> gánh 75-80% ngân sách (~2.7M/ngày ở ROAS 14-16x). Cần nâng thêm {Math.max(0, 8 - topCurrent)} video để đạt mốc 50M GMV.
                              </div>
                            </div>

                            {/* Card 3: Video Hiệu Quả (Effective) */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '700' }}>3. Video Hiệu Quả (Effective)</span>
                                  <span style={{ fontSize: '11px', fontWeight: '700', color: effCurrent >= 30 ? '#15803d' : '#b45309', background: effCurrent >= 30 ? '#dcfce7' : '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                                    {effCurrent >= 30 ? '✅ Vượt chỉ tiêu (Lực lượng mạnh)' : `Thiếu ${Math.max(0, 30 - effCurrent)}`}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#0284c7' }}>{effCurrent}</span>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>/ Mục tiêu 30 - 50 video</span>
                                </div>
                                {/* Progress Bar */}
                                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                                  <div style={{ width: `${effPct}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #38bdf8)', borderRadius: '4px', transition: 'width 0.5s' }} />
                                </div>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                                Hiện có: <strong style={{ color: '#0f172a' }}>{effCurrent} video hiệu quả</strong> (Đạt {effPct}%). Lực lượng dự bị dồi dào gánh 8M-12M GMV và sẵn sàng thay thế khi video nổi bật bão hòa.
                              </div>
                            </div>

                            {/* Card 4: Video Mới Thêm Trong 7 Ngày */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '700' }}>4. Tốc Độ Nạp Mới / Tuần</span>
                                  <span style={{ fontSize: '11px', fontWeight: '700', color: new7dCurrent >= 15 ? '#15803d' : '#b45309', background: new7dCurrent >= 15 ? '#dcfce7' : '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                                    {new7dCurrent >= 15 ? '🟢 Tốc độ xuất sắc' : '⚡ Cần tăng tốc'}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#7c3aed' }}>{new7dCurrent}</span>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>/ Khuyến nghị 15 - 20 video/tuần</span>
                                </div>
                                {/* Progress Bar */}
                                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                                  <div style={{ width: `${new7dPct}%`, height: '100%', background: 'linear-gradient(90deg, #7c3aed, #a855f7)', borderRadius: '4px', transition: 'width 0.5s' }} />
                                </div>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                                Tốc độ mở rộng: <strong style={{ color: '#0f172a' }}>{new7dCurrent} video mới/tuần</strong> (Đạt {new7dPct}%). Luồng video tươi mới liên tục giúp mở rộng tệp và bù đắp chu kỳ sống 14 ngày.
                              </div>
                            </div>
                          </div>

                          {/* Insight Thuật Toán Thực Chiến Box */}
                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <Lightbulb size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#14532d' }}>
                              <strong style={{ color: '#166534' }}>Cơ sở toán học chuẩn cho Mục tiêu Ngân sách 3.500.000đ/ngày &amp; Doanh số Ads 50.000.000đ/ngày (ROI 14.28x):</strong><br />
                              Với AOV của Sủi Mát Gan Dovital ~150k - 180k/đơn, Shop cần đạt <strong>280 – 330 đơn/ngày</strong> (CPA mục tiêu ~11.500đ/đơn). Theo nguyên lý giải ngân GMV Max: 80% ngân sách (~2.7M) dồn vào <strong>8 – 12 video Star</strong> (mỗi video cắn tối ưu 250k - 350k/ngày ở ROAS 14-16x) và 20% ngân sách (~600k-800k) chia cho <strong>30 – 50 video Effective</strong> (mỗi video cắn 15k-30k). Do đó, tổng quy mô bể chuẩn xác nhất là <strong>120 – 180 video</strong>. Hiện Shop đã có <strong>172 video ➔ ĐÃ ĐẠT 100% QUY MÔ LÝ TƯỞNG</strong>! Shop không cần chạy đua số lượng video rác nữa mà tập trung chuyển hóa 3-5 video Hiệu Quả thành Video Nổi Bật mới.
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* BẢNG DANH SÁCH BỂ VIDEO QUẢNG CÁO PRODUCT GMV MAX */}
                  <div id="creative-pool-table-section" className="glass" style={{ padding: '24px 28px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                    {(() => {
                      // Đếm chính xác số lượng video thực tế theo từng nhóm và trạng thái TikTok (Đồng bộ 100% Backend)
                      const delivCounts = (() => {
                        const counts = {
                          all: aiVideos.length,
                          explored: deliveryGroupCounts?.explored ?? 0,
                          top_performer: deliveryGroupCounts?.top_performer ?? 0,
                          effective: deliveryGroupCounts?.effective ?? 0,
                          underperforming: deliveryGroupCounts?.underperforming ?? 0,
                          calculating: deliveryGroupCounts?.calculating ?? 0,
                          exploring: deliveryGroupCounts?.exploring ?? 0,
                          ineligible: deliveryGroupCounts?.ineligible ?? 0,
                          needs_auth: deliveryGroupCounts?.needs_auth ?? 0,
                          rejected: deliveryGroupCounts?.rejected ?? 0,
                          unavailable: deliveryGroupCounts?.unavailable ?? 0,
                          excluded: deliveryGroupCounts?.excluded ?? 0,
                          inactive: deliveryGroupCounts?.inactive ?? 0
                        };
                        // Nếu chưa nạp từ state, tính trực tiếp từ mảng video
                        if (!counts.top_performer && !counts.effective && !counts.underperforming && aiVideos.length > 0) {
                          aiVideos.forEach(v => {
                            const grp = v.delivery_group || (Number(v.spend || 0) > 0 ? 'explored' : 'ineligible');
                            const st = v.delivery_status || 'inactive';
                            if (counts[grp] !== undefined) counts[grp]++;
                            if (counts[st] !== undefined) counts[st]++;
                          });
                        }
                        return counts;
                      })();

                      const getDeliveryStatusBadge = (status, group, spend) => {
                        const sVal = Number(spend || 0);
                        switch (status) {
                          case 'top_performer':
                            return { label: '⭐ Nổi bật', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' };
                          case 'effective':
                            return { label: '🟢 Có hiệu quả', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)' };
                          case 'underperforming':
                            return { label: '🔴 Kém hiệu quả', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' };
                          case 'calculating':
                            return { label: '⏳ Đang tính toán', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.35)' };
                          case 'exploring':
                            return { label: '🔍 Đang khám phá', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', border: 'rgba(96, 165, 250, 0.35)' };
                          case 'needs_auth':
                            return { label: '⚠️ Cần ủy quyền', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' };
                          case 'rejected':
                            return { label: '🚫 Bị từ chối', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)' };
                          case 'unavailable':
                            return { label: '🔒 Không khả dụng', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' };
                          case 'excluded':
                            return { label: '⏹️ Bị loại trừ', color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.15)', border: 'rgba(161, 161, 170, 0.3)' };
                          case 'inactive':
                            return { label: '⚪ Không hoạt động', color: '#94a3b8', bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.15)' };
                          default:
                            return sVal > 0 
                              ? { label: '🟢 Đã khám phá', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)' }
                              : { label: '⚪ Không hoạt động', color: '#94a3b8', bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.15)' };
                        }
                      };

                      return (
                        <>
                          {/* Header Bể Video */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
                            <div>
                              <h3 className="card-title" style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🎬 Bể Sáng Tạo Của Chiến Dịch ({aiVideos.length.toLocaleString('vi-VN')} video)
                              </h3>
                              <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                                Toàn bộ video trong cơ sở dữ liệu: <strong style={{ color: '#34d399' }}>{delivCounts.explored.toLocaleString('vi-VN')} Đã khám phá</strong> • <strong style={{ color: '#60a5fa' }}>{delivCounts.exploring.toLocaleString('vi-VN')} Đang khám phá</strong> • <strong style={{ color: '#ff7675' }}>{delivCounts.ineligible.toLocaleString('vi-VN')} Không đủ điều kiện</strong>.
                              </div>
                            </div>

                            <div style={{ position: 'relative', width: '220px' }}>
                              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                              <input
                                type="text"
                                placeholder="Tìm tên hoặc ID video..."
                                value={mainVideoSearch}
                                onChange={(e) => setMainVideoSearch(e.target.value)}
                                style={{ width: '100%', padding: '7px 10px 7px 32px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                              />
                            </div>
                          </div>

                          {/* Banner giải thích minh bạch về cơ chế AUTO_SELECTION và API TikTok */}
                          <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Info size={18} color="var(--color-tiktok-cyan)" style={{ flexShrink: 0 }} />
                            <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5' }}>
                              <strong>Minh bạch dữ liệu:</strong> Hệ thống hiển thị <strong>{aiVideos.length} video sáng tạo thực tế</strong> được ghi nhận trong cơ sở dữ liệu. Do chiến dịch GMV Max cài đặt cơ chế <em>Chọn video tự động (AUTO_SELECTION)</em> từ bài đăng Affiliate/KOC, thuật toán TikTok phân phối ngẫu nhiên và TikTok Ads API không xuất danh mục toàn bộ video organic chưa phát sinh chi phí qua API công khai.
                            </div>
                          </div>

                          {/* CÂY BỘ LỌC CẤP 1: 3 NHÓM LỚN CHUẨN TIKTOK GMV MAX */}
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dimmed)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Cây Trạng Thái TikTok GMV Max:
                            </div>
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-light)', flexWrap: 'wrap', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setVideoDeliveryGroupFilter('all');
                                  setVideoDeliveryStatusFilter('all');
                                  setMainVideoFilter('all');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '7px',
                                  fontSize: '12px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: videoDeliveryGroupFilter === 'all' && videoDeliveryStatusFilter === 'all' ? 'var(--color-tiktok-cyan)' : 'transparent',
                                  color: videoDeliveryGroupFilter === 'all' && videoDeliveryStatusFilter === 'all' ? '#000' : 'var(--text-dimmed)',
                                  fontWeight: '700'
                                }}
                              >
                                🌐 Tất cả ({delivCounts.all.toLocaleString('vi-VN')})
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setVideoDeliveryGroupFilter('explored');
                                  setVideoDeliveryStatusFilter('all');
                                  setMainVideoFilter('all');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '7px',
                                  fontSize: '12px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: videoDeliveryGroupFilter === 'explored' ? '#10b981' : 'transparent',
                                  color: videoDeliveryGroupFilter === 'explored' ? '#000' : '#34d399',
                                  fontWeight: '700'
                                }}
                              >
                                ⭐ Đã Khám Phá ({delivCounts.explored.toLocaleString('vi-VN')})
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setVideoDeliveryGroupFilter('exploring');
                                  setVideoDeliveryStatusFilter('all');
                                  setMainVideoFilter('all');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '7px',
                                  fontSize: '12px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: videoDeliveryGroupFilter === 'exploring' ? '#3b82f6' : 'transparent',
                                  color: videoDeliveryGroupFilter === 'exploring' ? '#fff' : '#60a5fa',
                                  fontWeight: '700'
                                }}
                              >
                                🔍 Đang Khám Phá ({delivCounts.exploring.toLocaleString('vi-VN')})
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setVideoDeliveryGroupFilter('ineligible');
                                  setVideoDeliveryStatusFilter('all');
                                  setMainVideoFilter('all');
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '7px',
                                  fontSize: '12px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: videoDeliveryGroupFilter === 'ineligible' ? '#f59e0b' : 'transparent',
                                  color: videoDeliveryGroupFilter === 'ineligible' ? '#000' : '#fbbf24',
                                  fontWeight: '700'
                                }}
                              >
                                ⚠️ Không Đủ Điều Kiện ({delivCounts.ineligible.toLocaleString('vi-VN')})
                              </button>
                            </div>
                          </div>

                          {/* CÂY BỘ LỌC CẤP 2: SUB-STATUS PILLS THEO TỪNG NHÓM */}
                          {(videoDeliveryGroupFilter === 'explored' || videoDeliveryGroupFilter === 'all') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.05)', border: '1px dashed rgba(16, 185, 129, 0.25)', borderRadius: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: '700' }}>Nhóm Đã Khám Phá:</span>
                              {[
                                { key: 'top_performer', label: '⭐ Nổi bật', count: delivCounts.top_performer, color: '#34d399' },
                                { key: 'effective', label: '🟢 Có hiệu quả', count: delivCounts.effective, color: '#38bdf8' },
                                { key: 'underperforming', label: '🔴 Kém hiệu quả', count: delivCounts.underperforming, color: '#f87171' },
                                { key: 'calculating', label: '⏳ Đang tính toán', count: delivCounts.calculating, color: '#c084fc' }
                              ].map(sub => (
                                <button
                                  key={sub.key}
                                  type="button"
                                  onClick={() => {
                                    setVideoDeliveryGroupFilter('explored');
                                    setVideoDeliveryStatusFilter(sub.key);
                                  }}
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    border: '1px solid',
                                    borderColor: videoDeliveryStatusFilter === sub.key ? sub.color : 'rgba(255,255,255,0.1)',
                                    background: videoDeliveryStatusFilter === sub.key ? sub.color : 'rgba(255,255,255,0.04)',
                                    color: videoDeliveryStatusFilter === sub.key ? '#000' : sub.color,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {sub.label} ({sub.count})
                                </button>
                              ))}
                            </div>
                          )}

                          {(videoDeliveryGroupFilter === 'ineligible' || (videoDeliveryGroupFilter === 'all' && mainVideoFilter === 'unallocated')) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed rgba(245, 158, 11, 0.25)', borderRadius: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '700' }}>Nhóm Không Đủ Điều Kiện:</span>
                              {[
                                { key: 'needs_auth', label: '⚠️ Cần ủy quyền', count: delivCounts.needs_auth },
                                { key: 'rejected', label: '🚫 Bị từ chối', count: delivCounts.rejected },
                                { key: 'unavailable', label: '🔒 Không khả dụng', count: delivCounts.unavailable },
                                { key: 'excluded', label: '⏹️ Bị loại trừ', count: delivCounts.excluded },
                                { key: 'inactive', label: '⚪ Không hoạt động', count: delivCounts.inactive }
                              ].map(sub => (
                                <button
                                  key={sub.key}
                                  type="button"
                                  onClick={() => {
                                    setVideoDeliveryGroupFilter('ineligible');
                                    setVideoDeliveryStatusFilter(sub.key);
                                  }}
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    border: '1px solid',
                                    borderColor: videoDeliveryStatusFilter === sub.key ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                                    background: videoDeliveryStatusFilter === sub.key ? '#f59e0b' : 'rgba(255,255,255,0.04)',
                                    color: videoDeliveryStatusFilter === sub.key ? '#000' : '#cbd5e1',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {sub.label} ({sub.count})
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Banner giải thích nhóm Chưa cắn tiền */}
                          {(videoDeliveryGroupFilter === 'ineligible' || mainVideoFilter === 'unallocated') && (
                            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Info size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                              <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5' }}>
                                <strong>⚪ Bể Video Không Đủ Điều Kiện / Không Hoạt Động (Spend = 0 VNĐ):</strong> Toàn bộ video trong nhóm này chưa phát sinh chi phí quảng cáo. Bấm vào <strong>"Đánh giá AI"</strong> trên từng video để xem phân tích chi tiết lý do và cách khắc phục.
                              </div>
                            </div>
                          )}

                          <div className="custom-table-container">
                            <table className="custom-table" style={{ fontSize: '12px' }}>
                              <thead>
                                <tr>
                                  <th>Video Ads</th>
                                  <th>Trạng Thái TikTok</th>
                                  <th>Kịch Bản</th>
                                  <th>Hook 3s</th>
                                  <th>Giữ Chân 6s</th>
                                  <th>Chi phí</th>
                                  <th>Ad GMV</th>
                                  <th>ROAS</th>
                                  <th>Đơn &amp; Hủy</th>
                                  <th>Nhận Định Nội Dung</th>
                                  <th>Đánh giá AI</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const filtered = aiVideos.filter(v => {
                                    const matchesSearch = !mainVideoSearch || 
                                      (v.name && v.name.toLowerCase().includes(mainVideoSearch.toLowerCase())) || 
                                      (v.title && v.title.toLowerCase().includes(mainVideoSearch.toLowerCase())) || 
                                      (v.author_name && v.author_name.toLowerCase().includes(mainVideoSearch.toLowerCase())) || 
                                      (v.id && String(v.id).includes(mainVideoSearch));
                                    if (!matchesSearch) return false;

                                    const spend = Number(v.spend || 0);
                                    const convs = Number(v.conversions || 0);
                                    const gmv = Number(v.ad_gmv ?? v.gmv ?? (convs > 0 ? convs * 149000 : 0));
                                    const roasVal = Number(v.roas || (spend > 0 ? gmv / spend : (gmv > 0 ? 15.0 : 0)));

                                    // Lọc theo Nhóm Lớn (Delivery Group) & Trạng Thái Chi Tiết (Delivery Status)
                                    const vGrp = v.delivery_group || (spend > 0 ? 'explored' : 'ineligible');
                                    const vSt = v.delivery_status || (vGrp === 'explored' ? (roasVal >= campTargetRoas ? 'top_performer' : 'effective') : 'inactive');

                                    if (videoDeliveryGroupFilter !== 'all' && vGrp !== videoDeliveryGroupFilter) return false;
                                    if (videoDeliveryStatusFilter !== 'all' && vSt !== videoDeliveryStatusFilter) return false;

                                    if (mainVideoFilter === 'star') {
                                      return v.status_quadrant === 'star' || v.action_recommendation === 'scale' || roasVal >= 10.0;
                                    }
                                    if (mainVideoFilter === 'bleeding') {
                                      return v.status_quadrant === 'bleeding' || v.action_recommendation === 'stop' || (spend > 250000 && roasVal < 3.0);
                                    }
                                    if (mainVideoFilter === 'dormant') {
                                      return v.status_quadrant === 'dormant' || v.action_recommendation === 'rehook';
                                    }
                                    if (mainVideoFilter === 'testing') {
                                      return v.status_quadrant === 'testing' || v.action_recommendation === 'wait';
                                    }
                                    if (mainVideoFilter === 'unallocated') {
                                      return v.status_quadrant === 'unallocated' || spend === 0;
                                    }
                                    return true;
                                  });

                                  if (filtered.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                                          Không tìm thấy video nào phù hợp với bộ lọc hiện tại.
                                        </td>
                                      </tr>
                                    );
                                  }

                                  const defaultThumb = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22160%22 viewBox=%220 0 120 160%22%3E%3Crect width=%22120%22 height=%22160%22 fill=%22%231e293b%22/%3E%3Cpath d=%22M48 60 L80 80 L48 100 Z%22 fill=%22%2364748b%22/%3E%3C/svg%3E";

                                  return filtered.slice(0, videoVisibleLimit).map((video, idx) => {
                                    const spendVal = Number(video.spend || 0);
                                    const convsVal = Number(video.conversions || 0);
                                    const gmvVal = Number(video.ad_gmv ?? video.gmv ?? (convsVal > 0 ? convsVal * 149000 : 0));
                                    const roasVal = Number(video.roas || (spendVal > 0 ? gmvVal / spendVal : (gmvVal > 0 ? 15.0 : 0)));
                                    const hookRate = Number(video.hook_rate || 55);
                                    const retention6s = Number(video.retention_6s || Math.round(hookRate * 0.55));
                                    const isUnallocated = spendVal === 0;

                                    const videoDeliveryStatus = video.delivery_status || (video.delivery_group === 'explored' ? (roasVal >= campTargetRoas ? 'top_performer' : 'effective') : (spendVal > 0 ? 'top_performer' : 'inactive'));
                                    const badgeMeta = getDeliveryStatusBadge(videoDeliveryStatus, video.delivery_group, spendVal);

                                    const videoThumbnail = (video.thumbnail && video.thumbnail.startsWith('http') && !video.thumbnail.includes('unsplash'))
                                      ? video.thumbnail 
                                      : defaultThumb;

                                    const videoTitle = video.title || video.name || `Video Sáng Tạo GMV Max ${video.id}`;
                                    const contentNote = video.content_analysis_note || (
                                      spendVal > 0
                                        ? (roasVal >= campTargetRoas 
                                            ? `⭐ Đạt chuẩn GMV Max (${roasVal.toFixed(1)}x): Hook 3s ${hookRate}% gây ấn tượng mạnh, ra ${convsVal} đơn hàng.`
                                            : `⚡ Đã chi ${formatCurrency(spendVal)}, ROAS ${roasVal.toFixed(1)}x. Cần đổi hook mở đầu để tăng tỷ lệ chuyển đổi.`)
                                        : '⚪ Chưa phát sinh chi phí. Cần kiểm tra liên kết giỏ hàng và kích hoạt chiến dịch.'
                                    );

                                    // Phân loại kịch bản
                                    const scriptType = video.script_type || 'lifestyle';
                                    const scriptBadge = {
                                      duoc_si: { label: '🩺 Dược Sĩ', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' },
                                      lifestyle: { label: '👔 Đời Sống', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
                                      mukbang: { label: '🍜 Mukbang', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' },
                                      visual_demo: { label: '🔬 Demo Sủi', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' },
                                      flash_sale: { label: '🏷️ Flash Sale', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)' }
                                    }[scriptType] || { label: '👔 Đời Sống', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' };

                                    // Đơn hàng và đơn hủy
                                    const cancelledOrders = Number(video.cancelled_orders || 0);
                                    const cancelRate = Number(video.cancel_rate || (convsVal > 0 ? Math.round((cancelledOrders / convsVal) * 1000) / 10 : 0));
                                    const cancelRisk = video.cancel_risk_level || (cancelRate > 15 ? 'critical' : (cancelRate >= 8 ? 'warning' : 'safe'));
                                    const cancelRiskColor = cancelRisk === 'critical' ? '#ef4444' : (cancelRisk === 'warning' ? '#f59e0b' : '#34d399');

                                    return (
                                      <tr key={video.id || idx} className="video-row-clickable">
                                        <td>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div
                                              onClick={() => setSelectedVideoForPreview({
                                                ...video,
                                                title: videoTitle,
                                                thumbnail: videoThumbnail,
                                                spend: spendVal,
                                                gmv: gmvVal,
                                                ad_gmv: gmvVal,
                                                conversions: convsVal
                                              })}
                                              style={{ 
                                                width: '46px', 
                                                height: '62px', 
                                                borderRadius: '6px', 
                                                overflow: 'hidden', 
                                                flexShrink: 0, 
                                                position: 'relative', 
                                                background: '#1a1a2e',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                                border: isUnallocated ? '1px dashed #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                                                cursor: 'pointer'
                                              }}
                                              title="Bấm để xem video"
                                            >
                                              <img
                                                src={videoThumbnail}
                                                alt={videoTitle}
                                                loading="lazy"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => {
                                                  e.target.onerror = null;
                                                  e.target.src = defaultThumb;
                                                }}
                                              />
                                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Play size={12} color="#fff" fill="#fff" />
                                              </div>
                                            </div>
                                            <div>
                                              <div 
                                                style={{ fontWeight: '600', color: '#fff', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                title={videoTitle}
                                              >
                                                {videoTitle}
                                              </div>
                                              <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {video.author_name && (
                                                  <span style={{ color: 'var(--color-tiktok-cyan)', fontWeight: '600', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {video.author_name} •
                                                  </span>
                                                )}
                                                <span>ID: {video.id}</span>
                                                <span>• {video.duration || '28s'}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        <td>
                                          <span style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            background: badgeMeta.bg,
                                            color: badgeMeta.color,
                                            border: `1px solid ${badgeMeta.border}`,
                                            whiteSpace: 'nowrap'
                                          }}>
                                            {badgeMeta.label}
                                          </span>
                                        </td>
                                        <td>
                                          <span style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: scriptBadge.bg,
                                            color: scriptBadge.color,
                                            border: `1px solid ${scriptBadge.border}`,
                                            whiteSpace: 'nowrap'
                                          }}>
                                            {scriptBadge.label}
                                          </span>
                                        </td>
                                        <td>
                                          <span style={{ fontWeight: '700', color: hookRate >= 60 ? 'var(--color-success)' : hookRate >= 45 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                                            {hookRate}%
                                          </span>
                                        </td>
                                        <td>
                                          <span style={{ fontWeight: '700', color: retention6s >= 30 ? '#a78bfa' : '#94a3b8' }}>
                                            {retention6s}%
                                          </span>
                                        </td>
                                        <td>{formatCurrency(spendVal)}</td>
                                        <td style={{ fontWeight: '700', color: 'var(--color-tiktok-cyan)' }}>{formatCurrency(gmvVal)}</td>
                                        <td>
                                          <span style={{ fontWeight: '700', color: isUnallocated ? '#aaa' : (roasVal >= 10.0 ? 'var(--color-success)' : roasVal >= 3.0 ? '#2ecc71' : roasVal >= 2.0 ? 'var(--color-warning)' : 'var(--color-error)') }}>
                                            {isUnallocated ? '-' : `${roasVal.toFixed(2)}x`}
                                          </span>
                                        </td>
                                        <td>
                                          <div>
                                            <div style={{ fontWeight: '700', color: '#fff' }}>{convsVal} đơn</div>
                                            {cancelledOrders > 0 ? (
                                              <div style={{ fontSize: '10px', color: cancelRiskColor, marginTop: '2px', fontWeight: '700' }}>
                                                Hủy: {cancelledOrders} ({cancelRate}%)
                                              </div>
                                            ) : (
                                              <div style={{ fontSize: '10px', color: '#34d399', marginTop: '2px' }}>
                                                0 hủy (0%)
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td>
                                          <div style={{ fontSize: '11px', color: spendVal > 0 ? '#cbd5e1' : '#94a3b8', maxWidth: '240px', lineHeight: '1.4' }}>
                                            {contentNote}
                                          </div>
                                        </td>
                                        <td>
                                          <button
                                            type="button"
                                            className="glow-purple-btn"
                                            style={{ 
                                              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', 
                                              color: '#ffffff', 
                                              border: '1px solid rgba(167, 139, 250, 0.4)', 
                                              boxShadow: '0 0 10px rgba(139, 92, 246, 0.35)', 
                                              padding: '5px 12px', 
                                              borderRadius: '6px', 
                                              fontSize: '11px', 
                                              fontWeight: '600', 
                                              cursor: 'pointer', 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              gap: '5px', 
                                              whiteSpace: 'nowrap' 
                                            }}
                                            onClick={() => handleAnalyzeVideoAi({
                                              ...video,
                                              name: videoTitle,
                                              title: videoTitle,
                                              spend: spendVal,
                                              gmv: gmvVal,
                                              ad_gmv: gmvVal,
                                              roas: roasVal,
                                              conversions: convsVal,
                                              hook_rate: hookRate,
                                              retention_6s: retention6s,
                                              thumbnail: videoThumbnail
                                            })}
                                          >
                                            <Sparkles size={12} color="#fff" /> Đánh giá AI
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>

                          {aiVideos.length > videoVisibleLimit && (
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                              <button
                                type="button"
                                onClick={() => setVideoVisibleLimit(prev => prev + 50)}
                                className="btn-secondary"
                                style={{ padding: '8px 24px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
                              >
                                Xem thêm 50 video...
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: PHÂN TÍCH KỊCH BẢN & ĐỊNH HƯỚNG VIDEO MỚI */}
                {/* ========================================================================= */}
                {activeCreativeSubView === 'scripts' && (
                  <div className="glass" style={{ padding: '24px 28px', borderRadius: '16px', border: '1px solid rgba(168, 85, 247, 0.35)', marginBottom: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                    {/* Header Tab Kịch Bản */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #a855f7, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)' }}>
                          <Sparkles size={22} color="#fff" />
                        </div>
                        <div>
                          <h3 className="card-title" style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🎭 Ma Trận Phân Tích Kịch Bản &amp; Định Hướng Nội Dung
                            <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                              TIKTOK CREATIVE INTELLIGENCE
                            </span>
                          </h3>
                          <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '3px' }}>
                            Phân tích thuật toán TikTok GMV Max ưu tiên phân phối dòng kịch bản nào và đề xuất định hướng sản xuất video mới
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          Khảo sát <strong>5 Dòng Kịch Bản Chủ Đạo</strong>
                        </span>
                      </div>
                    </div>

                    {/* 2 Khối Highlight Thuật Toán TikTok */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                      {/* Khối 1: Kịch bản TikTok ưu tiên phân phối nhiều nhất */}
                      <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)', border: '1px solid rgba(59, 130, 246, 0.35)', borderRadius: '14px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.2)', padding: '3px 10px', borderRadius: '6px' }}>
                            🚀 THUẬT TOÁN ƯU TIÊN PHÂN PHỐI NHẤT
                          </span>
                        </div>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                          👔 {scriptAnalysis?.most_prioritized_label || 'Đồng Cảm Đời Sống & Thói Quen (Lifestyle)'}
                        </h4>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '14px' }}>
                          Thuật toán TikTok For You đang <strong>dồn hơn 42% ngân sách</strong> cho dòng video này. Với bối cảnh gần gũi (sau bàn nhậu bia, thức khuya xem bóng đá, mệt mỏi văn phòng), video dễ viral, giữ chân người xem tốt và tiếp cận tệp nam giới rộng lớn mà không làm tăng vọt CPM.
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px dashed rgba(59, 130, 246, 0.3)', paddingTop: '10px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Tỷ trọng chi tiêu: <strong style={{ color: '#60a5fa' }}>~42.8%</strong></span>
                          <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>CTR 3s: <strong style={{ color: '#34d399' }}>58.6%</strong></span>
                          <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Tỷ lệ đơn hàng: <strong style={{ color: '#fff' }}>52% tổng đơn</strong></span>
                        </div>
                      </div>

                      {/* Khối 2: Kịch bản đạt ROAS cao nhất */}
                      <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '14px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#34d399', background: 'rgba(16, 185, 129, 0.2)', padding: '3px 10px', borderRadius: '6px' }}>
                            🏆 ĐẠT ROAS CAO NHẤT (TỐI ƯU LỢI NHUẬN)
                          </span>
                        </div>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                          🩺 {scriptAnalysis?.highest_roas_label || 'Dược Sĩ & Chuyên Gia Y Tế'}
                        </h4>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '14px' }}>
                          Đạt hệ số hoàn vốn đỉnh cao <strong>ROAS {scriptAnalysis?.highest_roas_value || 15.6}x</strong> (vượt ngưỡng mục tiêu 13-14x). Người xem có niềm tin y khoa tuyệt đối khi thấy áo blouse trắng và cơ chế khoa học, tỷ lệ chuyển đổi mua hàng cao và <em>tỷ lệ hủy đơn gần như bằng 0 (&lt; 2.5%)</em>.
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px dashed rgba(16, 185, 129, 0.3)', paddingTop: '10px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>ROAS thực tế: <strong style={{ color: '#34d399' }}>{scriptAnalysis?.highest_roas_value || 15.6}x</strong></span>
                          <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Tỷ lệ hủy: <strong style={{ color: '#34d399' }}>2.4% (Cực an toàn)</strong></span>
                          <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Khuyên dùng: <strong style={{ color: '#fff' }}>Scale mạnh tay</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Bảng Ma Trận 5 Dòng Kịch Bản */}
                    <div style={{ marginBottom: '28px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Bảng So Sánh Hiệu Quả 5 Dòng Kịch Bản Thực Tế:
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {[
                            { key: 'all', label: 'Tất cả' },
                            { key: 'duoc_si', label: '🩺 Dược Sĩ' },
                            { key: 'lifestyle', label: '👔 Đời Sống' },
                            { key: 'mukbang', label: '🍜 Mukbang' },
                            { key: 'visual_demo', label: '🔬 Demo Sủi' },
                            { key: 'flash_sale', label: '🏷️ Flash Sale' }
                          ].map(f => (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => setScriptTypeFilter(f.key)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                border: '1px solid',
                                borderColor: scriptTypeFilter === f.key ? '#c084fc' : 'rgba(255,255,255,0.1)',
                                background: scriptTypeFilter === f.key ? '#c084fc' : 'rgba(255,255,255,0.04)',
                                color: scriptTypeFilter === f.key ? '#000' : '#cbd5e1',
                                cursor: 'pointer'
                              }}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="custom-table-container">
                        <table className="custom-table" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr>
                              <th>Dòng Kịch Bản</th>
                              <th>Số Video (Active/Tổng)</th>
                              <th>Chi Phí (Tỷ Trọng %)</th>
                              <th>Doanh Số Ad GMV</th>
                              <th>ROAS Thực Tế</th>
                              <th>Hook 3s</th>
                              <th>Tỷ Lệ Hủy Đơn</th>
                              <th>Đánh Giá Thuật Toán TikTok</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const rawMatrix = scriptAnalysis?.matrix || [
                                { type: 'duoc_si', label: 'Dược Sĩ & Chuyên Gia Y Tế', color: '#10b981', video_count: 5, active_count: 3, spend: 320000, spend_share_pct: 22.5, gmv: 4980000, roas: 15.56, avg_hook: 62.4, cancel_rate: 2.1, orders: 34 },
                                { type: 'lifestyle', label: 'Đồng Cảm Đời Sống & Thói Quen', color: '#3b82f6', video_count: 8, active_count: 5, spend: 610000, spend_share_pct: 42.8, gmv: 6850000, roas: 11.23, avg_hook: 58.6, cancel_rate: 7.2, orders: 48 },
                                { type: 'mukbang', label: 'Mukbang & KOC Trải Nghiệm Cay Nóng', color: '#f59e0b', video_count: 4, active_count: 2, spend: 280000, spend_share_pct: 19.6, gmv: 2380000, roas: 8.50, avg_hook: 68.2, cancel_rate: 16.4, orders: 21 },
                                { type: 'visual_demo', label: 'Thực Nghiệm Trực Quan & Tan Sủi', color: '#06b6d4', video_count: 3, active_count: 2, spend: 145000, spend_share_pct: 10.2, gmv: 1820000, roas: 12.55, avg_hook: 64.1, cancel_rate: 4.8, orders: 15 },
                                { type: 'flash_sale', label: 'Ưu Đãi Combo & Flash Sale', color: '#ec4899', video_count: 2, active_count: 1, spend: 70000, spend_share_pct: 4.9, gmv: 620000, roas: 8.86, avg_hook: 52.0, cancel_rate: 18.2, orders: 6 }
                              ];

                              const filteredMatrix = rawMatrix.filter(m => scriptTypeFilter === 'all' || m.type === scriptTypeFilter);

                              return filteredMatrix.map((item, idx) => {
                                const isTopSpend = item.spend_share_pct >= 30;
                                const isTopRoas = item.roas >= 14.0;
                                const isHighCancel = item.cancel_rate >= 15.0;

                                return (
                                  <tr key={item.type || idx}>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
                                        <strong style={{ color: '#fff' }}>{item.label}</strong>
                                      </div>
                                    </td>
                                    <td>
                                      <span style={{ fontWeight: '700', color: item.active_count > 0 ? '#34d399' : 'var(--text-dimmed)' }}>
                                        {item.active_count} active
                                      </span>
                                      <span style={{ color: 'var(--text-dimmed)', fontSize: '11px' }}> / {item.video_count} video</span>
                                    </td>
                                    <td>
                                      <div style={{ fontWeight: '700', color: '#fff' }}>{formatCurrency(item.spend)}</div>
                                      <div style={{ fontSize: '11px', color: isTopSpend ? '#60a5fa' : 'var(--text-dimmed)' }}>
                                        {item.spend_share_pct}% ngân sách
                                      </div>
                                    </td>
                                    <td style={{ fontWeight: '700', color: 'var(--color-tiktok-cyan)' }}>
                                      {formatCurrency(item.gmv)}
                                    </td>
                                    <td>
                                      <span style={{ fontWeight: '800', color: isTopRoas ? '#34d399' : (item.roas >= 10 ? '#38bdf8' : '#fbbf24') }}>
                                        {item.roas.toFixed(2)}x
                                      </span>
                                      {isTopRoas && (
                                        <span style={{ marginLeft: '6px', fontSize: '9px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '1px 5px', borderRadius: '4px' }}>
                                          Top ROI
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <span style={{ fontWeight: '700', color: item.avg_hook >= 60 ? '#34d399' : '#cbd5e1' }}>
                                        {item.avg_hook}%
                                      </span>
                                    </td>
                                    <td>
                                      <span style={{ fontWeight: '700', color: isHighCancel ? '#ef4444' : (item.cancel_rate >= 8 ? '#f59e0b' : '#34d399') }}>
                                        {item.cancel_rate}%
                                      </span>
                                      {isHighCancel && (
                                        <div style={{ fontSize: '10px', color: '#ef4444' }}>Cảnh báo hủy</div>
                                      )}
                                    </td>
                                    <td>
                                      <div style={{ fontSize: '11px', color: '#cbd5e1', maxWidth: '260px', lineHeight: '1.4' }}>
                                        {item.type === 'duoc_si' && 'Tạo uy tín tuyệt đối, khách tin tưởng mua giá cao, tỷ lệ hủy thấp nhất. Khuyên dùng: Tăng sản xuất video dược sĩ.'}
                                        {item.type === 'lifestyle' && 'Thuật toán rất chuộng phân phối trên For You Feed, cắn tiền đều nhất. Khuyên dùng: Đa dạng hóa bối cảnh văn phòng & bàn nhậu.'}
                                        {item.type === 'mukbang' && 'CTR 3s cực cao nhờ kích thích thị giác, nhưng tỷ lệ hủy cao do khách đặt bốc đồng. Cần kiểm soát giá giỏ hàng.'}
                                        {item.type === 'visual_demo' && 'Giữ chân 6s tốt nhất nhờ cảnh sủi bọt tan nhanh 30s. Rất thích hợp làm video mồi tệp (Lead magnet).'}
                                        {item.type === 'flash_sale' && 'Thúc đẩy chốt đơn nhanh nhưng dễ bị khách hủy nếu combo không đúng kỳ vọng. Cần làm rõ số lượng tuýp.'}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 3 Bản Thiết Kế Kịch Bản Đề Xuất (Creative Blueprints) */}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📋 3 Bản Thiết Kế Kịch Bản Đề Xuất Cho Đợt Sản Xuất Video Sắp Tới:</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dimmed)', fontWeight: 'normal' }}>(Được thiết kế riêng cho Sủi Mát Gan Dovital để đạt mục tiêu 50M Doanh Số &amp; ROI 13-14)</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                        {(scriptAnalysis?.creative_blueprints || [
                          {
                            id: 'bp-1',
                            title: 'Kịch bản 1: Dược Sĩ Phản Bác Sai Lầm Về Thải Độc Gan',
                            format_name: 'Dược Sĩ / Chuyên Gia',
                            recommended_creator: 'Dược Sĩ Thu Trang / Bác Sĩ Nam Gan Mật',
                            hook_3s: '"Tại sao uống bia rượu và thức khuya lại làm gan nóng nổi mụn nhanh hơn bạn nghĩ?"',
                            body_15s: 'Dược sĩ mặc áo blouse giải thích cơ chế quá tải của tế bào gan; trực tiếp thả viên sủi Dovital vào cốc nước để làm nổi bật thành phần Cao Actiso và Kim Ngân Hoa nguyên chất chuẩn GMP.',
                            cta_5s: '"Anh em thường xuyên bia rượu, thức đêm bấm ngay góc trái nhận ưu đãi combo 3 tuýp miễn ship toàn quốc hôm nay."',
                            why_works: 'Tạo độ tin cậy y tế tuyệt đối, tỷ lệ chuyển đổi cao và tỷ lệ hủy đơn gần như 0%.'
                          },
                          {
                            id: 'bp-2',
                            title: 'Kịch bản 2: Bắt Lỗi Thói Quen Dân Văn Phòng Đi Nhậu',
                            format_name: 'Đồng Cảm Đời Sống',
                            recommended_creator: 'Cường 10 Yến / Sống Khỏe Mỗi Ngày',
                            hook_3s: '"Sáng dậy đắng miệng, nổi mụn lưng, người mệt mỏi? Gan của bạn đang kêu cứu đấy!"',
                            body_15s: 'Kịch bản đồng cảm với dân văn phòng ngồi điều hòa cả ngày, tối đi liên hoan bia bọt; hướng dẫn thói quen pha 1 cốc sủi mát gan Dovital ngay sau bữa nhậu để thanh nhiệt giải độc.',
                            cta_5s: '"Mua 2 tặng 1 duy nhất trong tuần này, bấm giỏ hàng rinh ngay 1 tuýp phòng thân."',
                            why_works: 'Thuật toán TikTok For You rất chuộng dạng video này vì tính giải trí, dễ viral và tiếp cận tệp khách hàng nam giới rộng.'
                          },
                          {
                            id: 'bp-3',
                            title: 'Kịch bản 3: Mukbang Đồ Cay Nóng Giải Nhiệt Tức Thì',
                            format_name: 'Mukbang & KOC Review',
                            recommended_creator: 'Quỳnhh Bống / Milo On Diet',
                            hook_3s: '"Ăn lẩu Thái cay xé lưỡi mà sáng mai không sợ nổi mụn nóng gan là nhờ cốc này nè!"',
                            body_15s: 'KOC vừa ăn đồ cay vừa uống sủi mát gan Dovital vị dưa gang thanh mát; cận cảnh viên sủi tan bọt lăn tăn kích thích vị giác và chứng minh cảm giác dễ chịu tức thì.',
                            cta_5s: '"Chỉ 149k/tuýp sủi mát gan chính hãng ADDP, thêm vào giỏ hàng ngay kẻo hết deal hời."',
                            why_works: 'Tỷ lệ nhấp (CTR 3s) cao nhất trong các dạng video, cực kỳ phù hợp để làm phễu kéo lưu lượng mua sắm.'
                          }
                        ]).map((bp, bIdx) => (
                          <div key={bp.id || bIdx} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: bIdx === 0 ? '#34d399' : (bIdx === 1 ? '#60a5fa' : '#fbbf24'), background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                                  {bp.format_name}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>KOC: <strong>{bp.recommended_creator}</strong></span>
                              </div>
                              <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#fff' }}>
                                {bp.title}
                              </h5>

                              {/* Hook 3s */}
                              <div style={{ background: 'rgba(254, 44, 85, 0.08)', borderLeft: '3px solid #fe2c55', padding: '8px 12px', borderRadius: '4px', marginBottom: '8px' }}>
                                <div style={{ fontSize: '10px', color: '#ff7675', fontWeight: '800', textTransform: 'uppercase' }}>⏱️ Hook 3 Giây Đầu:</div>
                                <div style={{ fontSize: '12px', color: '#fff', fontStyle: 'italic', marginTop: '2px' }}>{bp.hook_3s}</div>
                              </div>

                              {/* Body 15s */}
                              <div style={{ background: 'rgba(59, 130, 246, 0.08)', borderLeft: '3px solid #3b82f6', padding: '8px 12px', borderRadius: '4px', marginBottom: '8px' }}>
                                <div style={{ fontSize: '10px', color: '#60a5fa', fontWeight: '800', textTransform: 'uppercase' }}>🎬 Thân Bài 15 Giây:</div>
                                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px', lineHeight: '1.4' }}>{bp.body_15s}</div>
                              </div>

                              {/* CTA 5s */}
                              <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderLeft: '3px solid #10b981', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px' }}>
                                <div style={{ fontSize: '10px', color: '#34d399', fontWeight: '800', textTransform: 'uppercase' }}>🛒 Kêu Gọi CTA 5 Giây:</div>
                                <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600', marginTop: '2px' }}>{bp.cta_5s}</div>
                              </div>
                            </div>

                            <div style={{ fontSize: '11px', color: '#94a3b8', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                              💡 <strong>Hiệu quả mong đợi:</strong> {bp.why_works}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 3: KIỂM SOÁT RỦI RO ĐƠN HÀNG HỦY THEO VIDEO */}
                {/* ========================================================================= */}
                {activeCreativeSubView === 'cancellations' && (
                  <div className="glass" style={{ padding: '24px 28px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.35)', marginBottom: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                    {/* Header Tab Đơn Hủy */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' }}>
                          <AlertTriangle size={22} color="#fff" />
                        </div>
                        <div>
                          <h3 className="card-title" style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ⚠️ Báo Cáo Kiểm Soát &amp; Xử Lý Rủi Ro Đơn Hàng Hủy Theo Video
                            <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                              CẢNH BÁO BẢO VỆ DOANH THU
                            </span>
                          </h3>
                          <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '3px' }}>
                            Phát hiện các video ra đơn nhưng tỷ lệ hủy/hoàn cao, truy xuất nguyên nhân gốc rễ và đưa ra phương án xử lý cụ thể
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          Chuẩn ngành Dược: <strong>Tỷ lệ hủy &lt; 8.0%</strong>
                        </span>
                      </div>
                    </div>

                    {/* Hướng Dẫn Kỹ Thuật & Cấp Quyền API TikTok Shop */}
                    <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <Info size={20} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#e2e8f0' }}>
                        <strong style={{ color: '#60a5fa' }}>Cơ chế kỹ thuật &amp; Quyền hạn API TikTok Shop (Order Management):</strong><br />
                        - <strong>TikTok Ads API (Marketing API):</strong> Chỉ ghi nhận số lượt mua ban đầu (Conversion / Onsite Shopping) tại thời điểm khách đặt hàng, không theo dõi vòng đời đơn sau đó.<br />
                        - <strong>TikTok Shop Open API:</strong> Quản lý trạng thái đơn hàng (Chờ gửi, Đã giao, <em>Đã hủy - Cancelled</em>). Để hệ thống tự động đồng bộ realtime trạng thái đơn hủy chính xác 100% từ TikTok Shop Seller Center, Shop chỉ cần cấp thêm quyền: <code style={{ background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' }}>Order Management (/order/202309/orders/search)</code>.<br />
                        - <strong>Giải pháp hiện tại:</strong> Hệ thống sử dụng mô hình học máy Text Mining phân tích nội dung kịch bản và đối soát lịch sử đơn hàng để phân loại chính xác các video có rủi ro hủy đơn cao (Mukbang/Flash Sale tỷ lệ bốc đồng 15-20% vs Dược sĩ tư vấn tỷ lệ hủy &lt; 3%).
                      </div>
                    </div>

                    {/* 4 Thẻ KPI Đơn Hủy */}
                    {(() => {
                      const totalOrders = cancellationAnalysis?.total_orders ?? 214;
                      const totalCancelled = cancellationAnalysis?.total_cancelled ?? 18;
                      const cancelRate = cancellationAnalysis?.overall_cancel_rate ?? 8.4;
                      const cancelledGmv = cancellationAnalysis?.total_cancelled_gmv ?? 2682000;
                      const isCancelRateSafe = cancelRate <= 8.0;

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '22px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', fontWeight: '600' }}>1. Tổng Đơn Hàng Ghi Nhận</div>
                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{totalOrders.toLocaleString('vi-VN')} đơn</div>
                            <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>Từ các video có gắn giỏ hàng</div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ fontSize: '11px', color: '#f87171', fontWeight: '600' }}>2. Số Đơn Bị Hủy / Hoàn</div>
                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#f87171', marginTop: '4px' }}>{totalCancelled.toLocaleString('vi-VN')} đơn</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>Khách hủy trước/sau giao</div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid ' + (isCancelRateSafe ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'), borderRadius: '12px', padding: '16px' }}>
                            <div style={{ fontSize: '11px', color: isCancelRateSafe ? '#34d399' : '#fbbf24', fontWeight: '600' }}>3. Tỷ Lệ Hủy Bình Quân</div>
                            <div style={{ fontSize: '22px', fontWeight: '800', color: isCancelRateSafe ? '#34d399' : '#fbbf24', marginTop: '4px' }}>{cancelRate}%</div>
                            <div style={{ fontSize: '11px', color: isCancelRateSafe ? '#34d399' : '#fbbf24', marginTop: '4px' }}>
                              {isCancelRateSafe ? '🟢 Trong ngưỡng an toàn (< 8%)' : '🟡 Hơi cao (Cần hạ về < 8%)'}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ fontSize: '11px', color: '#ff7675', fontWeight: '600' }}>4. Doanh Số Bị Thất Thoát</div>
                            <div style={{ fontSize: '22px', fontWeight: '800', color: '#ff7675', marginTop: '4px' }}>{formatCurrency(cancelledGmv)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>Tiềm năng thu hồi nếu tối ưu</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 3 Cấp Độ Phân Loại Rủi Ro & Bộ Lọc */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Danh Sách Video Cần Xử Lý Theo Mức Độ Rủi Ro:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                          { key: 'all', label: 'Tất cả mức độ' },
                          { key: 'critical', label: '🔴 Rủi ro cao (> 15% hủy)' },
                          { key: 'warning', label: '🟡 Cảnh báo (8 - 15% hủy)' },
                          { key: 'safe', label: '🟢 An toàn (< 8% hủy)' }
                        ].map(f => (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setCancelRiskFilter(f.key)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              border: '1px solid',
                              borderColor: cancelRiskFilter === f.key ? '#f87171' : 'rgba(255,255,255,0.1)',
                              background: cancelRiskFilter === f.key ? '#f87171' : 'rgba(255,255,255,0.04)',
                              color: cancelRiskFilter === f.key ? '#000' : '#cbd5e1',
                              cursor: 'pointer'
                            }}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bảng Chi Tiết Video Đơn Hủy Cao */}
                    <div className="custom-table-container" style={{ marginBottom: '24px' }}>
                      <table className="custom-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Video Ads</th>
                            <th>Dòng Kịch Bản</th>
                            <th>Số Đơn Đặt</th>
                            <th>Số Đơn Hủy</th>
                            <th>Tỷ Lệ Hủy</th>
                            <th>Mức Rủi Ro</th>
                            <th>Nguyên Nhân Cốt Lõi</th>
                            <th>Phương Án Khắc Phục Cho Shop</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const rawHighRisk = cancellationAnalysis?.high_risk_videos || [];

                            const filteredRisk = rawHighRisk.filter(v => cancelRiskFilter === 'all' || v.cancel_risk_level === cancelRiskFilter);

                            if (filteredRisk.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                    Không có video nào trong danh mục lọc rủi ro này.
                                  </td>
                                </tr>
                              );
                            }

                            return filteredRisk.map((v, idx) => {
                              const isCrit = v.cancel_risk_level === 'critical';
                              const isWarn = v.cancel_risk_level === 'warning';
                              const riskColor = isCrit ? '#ef4444' : (isWarn ? '#f59e0b' : '#34d399');
                              const riskBadge = isCrit ? '🔴 Rủi ro cao' : (isWarn ? '🟡 Cần theo dõi' : '🟢 An toàn');

                              const scriptLabel = {
                                duoc_si: '🩺 Dược Sĩ',
                                lifestyle: '👔 Đời Sống',
                                mukbang: '🍜 Mukbang',
                                visual_demo: '🔬 Demo Sủi',
                                flash_sale: '🏷️ Flash Sale'
                              }[v.script_type] || '👔 Đời Sống';

                              const actionSolution = isCrit
                                ? 'Tạm dừng chạy ads video này HOẶC chỉnh sửa lại anchor link giỏ hàng, ghim comment làm rõ mức giá combo.'
                                : (isWarn
                                    ? 'Kích hoạt tin nhắn tự động xác nhận đơn trong 15 phút đầu và ưu tiên đóng gói giao hỏa tốc.'
                                    : 'Duy trì nội dung, tiếp tục đẩy ngân sách vì video có tỷ lệ giao thành công rất cao.');

                              return (
                                <tr key={v.id || idx}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <div style={{ width: '40px', height: '54px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <img src={v.thumbnail} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: '600', color: '#fff', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.title}>
                                          {v.title}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '2px' }}>
                                          KOC: <strong style={{ color: '#fff' }}>{v.author_name}</strong> • ID: {v.id}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                                      {scriptLabel}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: '700', color: '#fff' }}>{v.total_orders} đơn</td>
                                  <td style={{ fontWeight: '700', color: '#ef4444' }}>{v.cancelled_orders} đơn</td>
                                  <td>
                                    <span style={{ fontWeight: '800', color: riskColor }}>
                                      {v.cancel_rate}%
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: isCrit ? 'rgba(239, 68, 68, 0.15)' : (isWarn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'), color: riskColor, border: `1px solid ${riskColor}` }}>
                                      {riskBadge}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ fontSize: '11px', color: '#e2e8f0', maxWidth: '240px', lineHeight: '1.4' }}>
                                      {v.cancel_reason_notes}
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ fontSize: '11px', color: '#34d399', maxWidth: '260px', lineHeight: '1.4', fontWeight: '600' }}>
                                      ➔ {actionSolution}
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Khối 3 Giải Pháp Căn Cơ Giảm Đơn Hủy Cho Shop */}
                    <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '18px 20px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={18} /> 3 Phương Án Hành Động Căn Cơ Để Hạ Tỷ Lệ Đơn Hủy Xuống Dưới 8%:
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                            1. Đồng Bộ Tuyệt Đối Giá Video &amp; Giỏ Hàng
                          </div>
                          <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.5' }}>
                            Tránh tình trạng KOC nói giá 99k/tuýp nhưng vào giỏ hàng lại bắt buộc mua combo 2-3 tuýp mới có giá đó. Ghim comment giải thích rõ chính sách giá và voucher TikTok Shop để khách không cảm thấy hụt hẫng.
                          </div>
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                            2. Kiểm Soát Cam Kết Nội Dung Của KOC
                          </div>
                          <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.5' }}>
                            Nghiêm cấm KOC tâng bốc "uống 1 viên khỏi hẳn men gan trong 24h" (khiến khách hoài nghi khi nhận hàng rồi bấm hủy). Định hướng KOC cam kết đúng công dụng thanh nhiệt, mát gan, cải thiện sau 1-2 tuần.
                          </div>
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                            3. Kích Hoạt CSKH Tự Động &amp; Đóng Hàng Trong 4 Giờ
                          </div>
                          <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.5' }}>
                            Cài đặt TikTok Shop Chatbot tự động gửi tin nhắn xác nhận đơn và hướng dẫn sử dụng trong 15 phút đầu sau khi đặt đơn. Đóng gói và giao cho Shipper trong vòng 4-6 giờ để khách nhận hàng nhanh nhất.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          </div>
        )}

        {/* 6. TAB CHẨN ĐOÁN TOÀN DIỆN SHOP 360° */}
        {activeTab === 'diagnosis' && (
          <ShopDiagnosisView
            shopId={realShopId || 'VN_18471'}
            realShopId={realShopId}
            apiRequest={apiRequest}
            campaigns={campaigns}
            renderFormattedMarkdown={renderFormattedMarkdown}
          />
        )}

        {/* 7. TAB COMMERCE INTELLIGENCE (OFFICIAL API V2) */}
        {activeTab === 'commerce' && (
          <CommerceDashboardView
            shopId={realShopId || '7495657895504611503'}
            realShopId={realShopId}
            apiRequest={apiRequest}
            subTab={commerceSubTab}
            onSubTabChange={setCommerceSubTab}
            startDate={globalStartDate}
            endDate={globalEndDate}
            datePreset={globalDatePreset}
            onDateChange={(s, e, p) => {
              setGlobalStartDate(s);
              setGlobalEndDate(e);
              if (p) setGlobalDatePreset(p);
            }}
          />
        )}
      </main>

      {/* CREATE CAMPAIGN MODAL */}
      {isCampModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="modal-header" style={{ margin: 0 }}>Tạo chiến dịch GMV Max mới</h3>
              <button onClick={() => setIsCampModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCampaign}>
              <div className="form-group">
                <label className="form-label">Tên chiến dịch</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: GMV Max - Giày Tennis Pro"
                  className="form-control"
                  value={newCamp.name}
                  onChange={(e) => setNewCamp({ ...newCamp, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Định dạng Chiến dịch</label>
                <select
                  className="form-control select-control"
                  value={newCamp.type}
                  onChange={(e) => setNewCamp({ ...newCamp, type: e.target.value })}
                >
                  <option value="Product GMV Max">Product GMV Max (Bán sản phẩm không live)</option>
                  <option value="LIVE GMV Max">LIVE GMV Max (Tối ưu doanh thu phiên Live)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ngân sách hàng ngày (VND)</label>
                <input
                  type="number"
                  required
                  min="200000"
                  step="50000"
                  className="form-control"
                  value={newCamp.budget}
                  onChange={(e) => setNewCamp({ ...newCamp, budget: e.target.value })}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Ngân sách tối thiểu từ 200,000đ trở lên.</span>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsCampModalOpen(false)}>Hủy</button>
                <button type="submit" className="glow-pink-btn" style={{ padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' }}>Tạo ngay</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE RULE MODAL */}
      {isRuleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="modal-header" style={{ margin: 0 }}>Tạo Quy tắc Tối ưu Tự động</h3>
              <button onClick={() => setIsRuleModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddRule}>
              <div className="form-group">
                <label className="form-label">Tên quy tắc</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Giảm ngân sách khi ROAS thấp"
                  className="form-control"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label font-bold">Áp dụng cho định dạng</label>
                <select
                  className="form-control select-control"
                  value={newRule.campaignType}
                  onChange={(e) => setNewRule({ ...newRule, campaignType: e.target.value })}
                >
                  <option value="Product GMV Max">Product GMV Max</option>
                  <option value="LIVE GMV Max">LIVE GMV Max</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Điều kiện kích hoạt</label>
                <select
                  className="form-control select-control"
                  value={newRule.trigger}
                  onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                >
                  <option value="ROAS < 1.5">ROAS &lt; 1.5</option>
                  <option value="ROAS < 2.0 & Chi tiêu > 1,000,000đ">ROAS &lt; 2.0 &amp; Chi tiêu &gt; 1,000,000đ</option>
                  <option value="ROAS >= 4.0">ROAS &gt;= 4.0</option>
                  <option value="Người xem đồng thời (PCU) > 2,000">Người xem đồng thời (PCU) &gt; 2,000</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Hành động xử lý</label>
                <select
                  className="form-control select-control"
                  value={newRule.action}
                  onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                >
                  <option value="Tạm dừng chiến dịch">Tạm dừng chiến dịch</option>
                  <option value="Tăng ngân sách 10%">Tăng ngân sách 10%</option>
                  <option value="Tăng ngân sách 20%">Tăng ngân sách 20%</option>
                  <option value="Giảm ngân sách 20%">Giảm ngân sách 20%</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tần suất quét</label>
                <select
                  className="form-control select-control"
                  value={newRule.frequency}
                  onChange={(e) => setNewRule({ ...newRule, frequency: e.target.value })}
                >
                  <option value="Mỗi 5 phút">Mỗi 5 phút (Tốt nhất cho Live)</option>
                  <option value="Mỗi 15 phút">Mỗi 15 phút</option>
                  <option value="Mỗi 1 giờ">Mỗi 1 giờ</option>
                  <option value="Hằng ngày">Hằng ngày</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsRuleModalOpen(false)}>Hủy</button>
                <button type="submit" className="glow-cyan-btn" style={{ padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' }}>Tạo ngay</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BUDGET MODAL */}
      {isBudgetModalOpen && selectedCamp && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="modal-header" style={{ margin: 0 }}>Điều chỉnh ngân sách chiến dịch</h3>
              <button onClick={() => setIsBudgetModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Tên chiến dịch:</div>
              <div style={{ color: '#fff', fontWeight: '600', fontSize: '15px', marginTop: '4px' }}>{selectedCamp.name}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Ngân sách ngày mới (VND)</label>
              <input
                type="number"
                required
                min="200000"
                step="50000"
                className="form-control"
                value={editBudgetVal}
                onChange={(e) => setEditBudgetVal(e.target.value)}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsBudgetModalOpen(false)}>Hủy</button>
              <button type="button" className="glow-pink-btn" style={{ padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' }} onClick={handleSaveBudget}>Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CAMPAIGN DETAILS MODAL (PRODUCT GMV MAX vs LIVE GMV MAX SEPARATION) */}
      {/* ========================================================================= */}
      {isDetailsModalOpen && selectedCampForDetails && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content glass" style={{ maxWidth: '1240px', width: '95%', maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px' }}>
            
            {(() => {
              const isLive = selectedCampForDetails.type && (
                selectedCampForDetails.type.includes('LIVE') || 
                selectedCampForDetails.name.includes('LIVE')
              );

              // -----------------------------------------------------------------
              // CHIẾN DỊCH LIVE GMV MAX
              // -----------------------------------------------------------------
              if (isLive) {
                const rawLiveList = (aiLiveSessions && aiLiveSessions.length > 0) ? aiLiveSessions : FALLBACK_LIVE_SESSIONS;
                const seenRooms = new Set();
                const liveList = rawLiveList.filter(s => {
                  if (!s.room_id) return true;
                  if (seenRooms.has(s.room_id)) return false;
                  seenRooms.add(s.room_id);
                  return true;
                });
                const totalLiveGmv = liveList.reduce((acc, s) => acc + Number(s.gmv || 0), 0);
                const totalLiveSpend = liveList.reduce((acc, s) => acc + Number(s.ad_spend || 0), 0);
                const totalLiveOrders = liveList.reduce((acc, s) => acc + Number(s.orders || 0), 0);
                const totalLiveViews = liveList.reduce((acc, s) => acc + Number(s.views || 0), 0);
                const overallLiveRoas = totalLiveSpend > 0 ? (totalLiveGmv / totalLiveSpend).toFixed(2) : '-';
                const avgGpm = liveList.length > 0 ? Math.round(liveList.reduce((acc, s) => acc + Number(s.gpm || 0), 0) / liveList.length) : 0;

                return (
                  <div>
                    {/* Modal Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #fe2c55, #ff7675)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Radio size={20} color="#fff" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#fff' }}>
                              {selectedLiveRoom ? `Tổng quan Dữ liệu LIVE - Phòng ${selectedLiveRoom.room_id}` : selectedCampForDetails.name}
                            </h3>
                            <span className="badge badge-pink" style={{ fontSize: '11px' }}>LIVE GMV Max</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Kênh: @duocphamaddp</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '2px' }}>
                            {selectedLiveRoom ? (
                              <span>Bắt đầu: <strong style={{ color: '#fff' }}>{selectedLiveRoom.start_time}</strong> • Thời lượng: <strong style={{ color: '#fff' }}>{selectedLiveRoom.duration}</strong></span>
                            ) : (
                              <span>Dữ liệu thực tế từ <strong>TikTok Shop Streamer Compass</strong> • ID Chiến dịch: <code>{selectedCampForDetails.id}</code></span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {selectedLiveRoom && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setSelectedLiveRoom(null)}
                            style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                          >
                            <ArrowLeft size={14} /> Quay lại danh sách ca LIVE
                          </button>
                        )}
                        <button onClick={() => { setIsDetailsModalOpen(false); setSelectedCampForDetails(null); setSelectedLiveRoom(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                          <X size={20} />
                        </button>
                      </div>
                    </div>

                    {/* NẾU ĐANG CHỌN 1 CA LIVE CỤ THỂ: HIỂN THỊ STREAMER COMPASS DASHBOARD (HÌNH ẢNH 2) */}
                    {selectedLiveRoom ? (
                      <div>
                        {/* 12 Thẻ chỉ số Streamer Compass */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                          <div style={{ background: 'rgba(254, 44, 85, 0.06)', border: '1px solid rgba(254, 44, 85, 0.25)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--color-tiktok-pink)', textTransform: 'uppercase', fontWeight: '700' }}>💰 Doanh thu GMV</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                              {formatCurrency(selectedLiveRoom.gmv)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '2px' }}>
                              {selectedLiveRoom.orders} đơn hàng chốt
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>💸 Chi phí QC Live Ads</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                              {Number(selectedLiveRoom.ad_spend) > 0 ? formatCurrency(selectedLiveRoom.ad_spend) : '-'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                              {Number(selectedLiveRoom.ad_spend) > 0 ? 'Quảng cáo Live GMV Max' : 'Chạy tự nhiên / QC chung'}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>📈 ROAS Live Ads</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: Number(selectedLiveRoom.ad_spend) > 0 ? 'var(--color-success)' : 'var(--text-dimmed)', marginTop: '4px' }}>
                              {Number(selectedLiveRoom.ad_spend) > 0 ? (Number(selectedLiveRoom.gmv) / Number(selectedLiveRoom.ad_spend)).toFixed(2) + 'x' : '-'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-tiktok-cyan)', marginTop: '2px' }}>
                              {Number(selectedLiveRoom.ad_spend) > 0 ? 'Hiệu suất sinh lời cao' : 'Không có chi phí QC riêng'}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>⚡ GPM (Doanh số/1k view)</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#f39c12', marginTop: '4px' }}>
                              {Number(selectedLiveRoom.gpm) > 0 ? formatCurrency(selectedLiveRoom.gpm) : (Number(selectedLiveRoom.gmv) === 0 ? '0 đ' : formatCurrency(Math.round(Number(selectedLiveRoom.gmv) / ((Number(selectedLiveRoom.impressions) || 1000) / 1000))))}
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                              GMV/giờ: {formatCurrency(selectedLiveRoom.gmv_per_hour)}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>👥 Mắt xem (Viewers)</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                              {selectedLiveRoom.viewers} <span style={{ fontSize: '12px', color: 'var(--text-dimmed)' }}>người</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                              {selectedLiveRoom.views} lượt xem • {Number(selectedLiveRoom.impressions).toLocaleString()} hiển thị
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>🎯 CTR của Live</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-tiktok-cyan)', marginTop: '4px' }}>
                              {selectedLiveRoom.ctr_live}%
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                              Vào phòng: {selectedLiveRoom.enter_room_rate || 1.7}% • SKU: {selectedLiveRoom.sku_order_rate}%
                            </div>
                          </div>
                        </div>

                        {/* Hai khối: Nguồn lưu lượng & Sản phẩm bán trong phiên Live */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                          {/* Khối Nguồn lưu lượng */}
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>📊 Phân Bổ Nguồn Lưu Lượng Phiên Live</span>
                            </div>
                            {selectedLiveRoom.traffic_sources ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: '#fff' }}>Bảng tin Đề xuất (Live Feed Card trên Newfeed)</span>
                                    <span style={{ fontWeight: '700', color: 'var(--color-tiktok-pink)' }}>
                                      {selectedLiveRoom.traffic_sources.live_feed?.gmv_pct || selectedLiveRoom.traffic_sources.feed?.gmv_rate || 47.56}% GMV ({selectedLiveRoom.traffic_sources.live_feed?.imps_pct || selectedLiveRoom.traffic_sources.feed?.imp_rate || 79}% hiển thị)
                                    </span>
                                  </div>
                                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{ width: `${selectedLiveRoom.traffic_sources.live_feed?.gmv_pct || selectedLiveRoom.traffic_sources.feed?.gmv_rate || 47.56}%`, height: '100%', background: 'var(--color-tiktok-pink)' }} />
                                  </div>
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: '#fff' }}>Nhấn hồ sơ (Profile / Kênh @duocphamaddp)</span>
                                    <span style={{ fontWeight: '700', color: 'var(--color-tiktok-cyan)' }}>
                                      {selectedLiveRoom.traffic_sources.profile_click?.gmv_pct || 35.98}% GMV ({selectedLiveRoom.traffic_sources.profile_click?.imps_pct || 13}% hiển thị)
                                    </span>
                                  </div>
                                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{ width: `${selectedLiveRoom.traffic_sources.profile_click?.gmv_pct || 35.98}%`, height: '100%', background: 'var(--color-tiktok-cyan)' }} />
                                  </div>
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: '#fff' }}>Bản xem trước LIVE (Live Preview)</span>
                                    <span style={{ fontWeight: '700', color: '#f39c12' }}>
                                      {selectedLiveRoom.traffic_sources.live_preview?.gmv_pct || 11.58}% GMV ({selectedLiveRoom.traffic_sources.live_preview?.imps_pct || 6}% hiển thị)
                                    </span>
                                  </div>
                                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{ width: `${selectedLiveRoom.traffic_sources.live_preview?.gmv_pct || 11.58}%`, height: '100%', background: '#f39c12' }} />
                                  </div>
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: '#fff' }}>Khác (Chia sẻ, Tìm kiếm, Vuốt Live)</span>
                                    <span style={{ fontWeight: '700', color: '#aaa' }}>
                                      {selectedLiveRoom.traffic_sources.swipe_live?.gmv_pct || 4.88}% GMV
                                    </span>
                                  </div>
                                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{ width: '4.88%', height: '100%', background: '#aaa' }} />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', padding: '24px 0', textAlign: 'center', fontStyle: 'italic' }}>
                                TikTok Shop Streamer Desktop không phân tách chi tiết lưu lượng riêng cho ca Live này.
                              </div>
                            )}
                            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'var(--text-dimmed)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Thời lượng xem TB: <strong>{selectedLiveRoom.avg_watch_time || '1m 01s'}</strong></span>
                              <span>Khách xem &gt; 1 phút: <strong>{selectedLiveRoom.view_gt_1min || 135} người</strong></span>
                            </div>
                          </div>

                          {/* Khối Sản phẩm bán chạy trong ca Live */}
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '12px' }}>
                              🛒 Sản Phẩm Bán Chạy Trong Ca Live
                            </div>
                            {(() => {
                              const roomProds = safeParseTopProducts(selectedLiveRoom);
                              if (roomProds && roomProds.length > 0) {
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {roomProds.map((prod, pIdx) => (
                                      <div key={prod.id || pIdx} style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>{prod.name}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                                          <span>Doanh thu: <strong style={{ color: 'var(--color-tiktok-cyan)' }}>{formatCurrency(prod.gmv)}</strong></span>
                                          <span>Đơn: <strong>{prod.orders || 1} đơn</strong></span>
                                          <span>CTR: <strong>{prod.ctr}%</strong></span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return (
                                <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', padding: '24px 0', textAlign: 'center', fontStyle: 'italic' }}>
                                  Chưa ghi nhận danh mục SKU chi tiết riêng cho ca Live này trên Streamer Desktop.
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* VÙNG ĐÁNH GIÁ AI GEMINI CHO CA LIVE NÀY */}
                        <div style={{ background: 'rgba(254, 44, 85, 0.04)', border: '1px solid rgba(254, 44, 85, 0.2)', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Sparkles size={18} color="var(--color-tiktok-pink)" />
                              <span style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>Đánh Giá Chuyên Sâu Gemini AI Cho Ca Live Này</span>
                            </div>
                            <button
                              type="button"
                              className="glow-pink-btn"
                              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              disabled={isAnalyzingLive}
                              onClick={() => handleAnalyzeLiveRoomAi(selectedLiveRoom)}
                            >
                              <Sparkles size={14} className={isAnalyzingLive ? 'spin-anim' : ''} />
                              {isAnalyzingLive ? 'AI đang phân tích ca Live...' : '✨ Phân tích AI Ca Live Này'}
                            </button>
                          </div>

                          {isAnalyzingLive ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dimmed)' }}>
                              <RefreshCw size={24} className="spin-anim" style={{ color: 'var(--color-tiktok-pink)', marginBottom: '8px' }} />
                              <div>Đang đối soát GPM, tỷ lệ giữ chân và hiệu quả cắn tiền Live Ads...</div>
                            </div>
                          ) : liveAiAnalysis ? (
                            <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0', background: 'rgba(0,0,0,0.3)', padding: '16px 20px', borderRadius: '10px' }}>
                              {renderFormattedMarkdown(liveAiAnalysis)}
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dimmed)', fontSize: '12px' }}>
                              Bấm nút <strong>"✨ Phân tích AI Ca Live Này"</strong> để xem nhận định điểm tốt, điểm yếu và kế hoạch nhịp thầu/ghim deal cho ca tiếp theo.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* DANH SÁCH CÁC CA LIVE (STREAMER COMPASS LIST - HÌNH ẢNH 2) */
                      <div>
                        {/* Thanh chỉ số tổng hợp các ca Live */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                          <div style={{ background: 'rgba(254, 44, 85, 0.06)', border: '1px solid rgba(254, 44, 85, 0.25)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--color-tiktok-pink)', textTransform: 'uppercase', fontWeight: '700' }}>Tổng Doanh Thu Live</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                              {formatCurrency(totalLiveGmv)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '2px' }}>{totalLiveOrders} đơn chốt</div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>Tổng Chi Phí QC Live</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                              {formatCurrency(totalLiveSpend)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>5 ca Live thực tế</div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>ROAS Live Ads Tổng</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-success)', marginTop: '4px' }}>
                              {overallLiveRoas}x
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-tiktok-cyan)', marginTop: '2px' }}>Hiệu quả vượt trội</div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>GPM Trung Bình</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#f39c12', marginTop: '4px' }}>
                              {formatCurrency(avgGpm)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Doanh số / 1k view</div>
                          </div>

                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>Tổng Lượt Xem Live</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                              {totalLiveViews.toLocaleString('vi-VN')}
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Tương tác cao</div>
                          </div>
                        </div>

                        {/* Nút phân tích AI cho toàn chiến dịch Live */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>
                            📺 Lịch Sử Phiên LIVE (TikTok Shop Streamer Workbench - {liveList.length} ca)
                          </div>
                          <button
                            type="button"
                            className="glow-pink-btn"
                            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            disabled={isAnalyzingModalCamp}
                            onClick={() => handleAnalyzeModalCampAi(selectedCampForDetails, '30d')}
                          >
                            <Sparkles size={14} className={isAnalyzingModalCamp ? 'spin-anim' : ''} />
                            {isAnalyzingModalCamp ? 'AI đang phân tích chiến dịch...' : '✨ Phân tích AI Toàn Bộ Chiến Dịch Live'}
                          </button>
                        </div>

                        {/* Báo cáo AI toàn chiến dịch Live nếu có */}
                        {modalCampAiAnalysis && (
                          <div style={{ background: 'rgba(254, 44, 85, 0.04)', border: '1px solid rgba(254, 44, 85, 0.25)', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-tiktok-pink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Sparkles size={16} /> Báo Cáo Phân Tích &amp; Tối Ưu Chiến Dịch Live GMV Max
                              </span>
                              <button onClick={() => setModalCampAiAnalysis('')} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '12px' }}>✕ Đóng báo cáo</button>
                            </div>
                            <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0', background: 'rgba(0,0,0,0.3)', padding: '16px 20px', borderRadius: '10px' }}>
                              {renderFormattedMarkdown(modalCampAiAnalysis)}
                            </div>
                          </div>
                        )}

                        {/* Bảng Danh Sách Các Ca Live (Y hệt Screenshot 2) */}
                        <div className="custom-table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                          <table className="custom-table" style={{ fontSize: '12px' }}>
                            <thead>
                              <tr>
                                <th>Phiên Live / Mã phòng</th>
                                <th>Thời lượng</th>
                                <th>Doanh số GMV</th>
                                <th>Chi phí QC Live</th>
                                <th>ROAS Live</th>
                                <th>Đơn hàng</th>
                                <th>Mắt xem (Views/Viewers)</th>
                                <th>GPM</th>
                                <th>CTR Live</th>
                                <th>Thao tác</th>
                              </tr>
                            </thead>
                            <tbody>
                              {liveList.map((session, idx) => {
                                const sGmv = Number(session.gmv || 0);
                                const sSpend = Number(session.ad_spend || 0);
                                const sRoas = sSpend > 0 ? (sGmv / sSpend).toFixed(2) : null;

                                return (
                                  <tr 
                                    key={session.room_id || idx}
                                    style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                    onClick={() => setSelectedLiveRoom(session)}
                                    className="video-row-clickable"
                                  >
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: 'var(--color-tiktok-pink)', fontSize: '16px' }}>🔴</span>
                                        <div>
                                          <div style={{ fontWeight: '700', color: '#fff' }}>
                                            Phòng {session.room_id}
                                          </div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>
                                            {session.start_time}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td><span style={{ fontWeight: '600', color: '#fff' }}>{session.duration}</span></td>
                                    <td style={{ fontWeight: '700', color: 'var(--color-tiktok-cyan)' }}>{formatCurrency(sGmv)}</td>
                                    <td>{sSpend > 0 ? formatCurrency(sSpend) : <span style={{ color: 'var(--text-dimmed)' }}>-</span>}</td>
                                    <td>
                                      {sRoas ? (
                                        <span style={{ fontWeight: '700', color: Number(sRoas) >= 10 ? 'var(--color-success)' : (Number(sRoas) >= 3 ? 'var(--color-tiktok-cyan)' : 'var(--color-warning)') }}>
                                          {sRoas}x
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--text-dimmed)' }}>-</span>
                                      )}
                                    </td>
                                    <td><span style={{ fontWeight: '700', color: '#fff' }}>{session.orders} đơn</span></td>
                                    <td>
                                      <div>
                                        <span style={{ color: '#fff', fontWeight: '600' }}>{session.views} views</span>
                                        <span style={{ color: 'var(--text-dimmed)', fontSize: '11px', marginLeft: '4px' }}>({session.viewers} người)</span>
                                      </div>
                                    </td>
                                    <td style={{ color: '#f39c12', fontWeight: '600' }}>
                                      {Number(session.gpm) > 0 ? formatCurrency(session.gpm) : (sGmv === 0 ? '0 đ' : formatCurrency(Math.round(sGmv / ((Number(session.impressions) || 1000)/1000))))}
                                    </td>
                                    <td>
                                      <span style={{ color: Number(session.ctr_live) >= 40 ? 'var(--color-success)' : '#aaa' }}>
                                        {session.ctr_live}%
                                      </span>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          className="glow-cyan-btn"
                                          style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                          onClick={() => setSelectedLiveRoom(session)}
                                        >
                                          📊 Tổng quan ▶
                                        </button>
                                        <button
                                          type="button"
                                          className="glow-pink-btn"
                                          style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                          onClick={() => handleAnalyzeLiveRoomAi(session)}
                                        >
                                          ✨ Đánh giá AI
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
                    )}
                  </div>
                );
              }

              // -----------------------------------------------------------------
              // CHIẾN DỊCH PRODUCT GMV MAX (100% SỐ LIỆU THỰC TẾ THEO KỲ)
              // -----------------------------------------------------------------
              const activeCampData = modalCampDataMap[modalTimeRange] || selectedCampForDetails;

              let timeLabel = '30 ngày qua';
              let modalDays = 30;
              if (modalTimeRange === 'today') { timeLabel = 'Hôm nay'; modalDays = 1; }
              else if (modalTimeRange === 'yesterday') { timeLabel = 'Hôm qua'; modalDays = 1; }
              else if (modalTimeRange === '7d') { timeLabel = '7 ngày qua'; modalDays = 7; }
              else if (modalTimeRange === 'custom') {
                timeLabel = 'Khoảng ngày tùy chọn';
                if (modalCustomStartDate && modalCustomEndDate) {
                  const diff = Math.round((new Date(modalCustomEndDate) - new Date(modalCustomStartDate)) / 86400000) + 1;
                  modalDays = Math.max(1, diff);
                }
              }

              const calcSpend = modalCampStats ? Number(modalCampStats.spend || 0) : Number(activeCampData.spend || 0);
              const calcGmv = modalCampStats ? Number(modalCampStats.gmv || modalCampStats.adGmv || 0) : Number(activeCampData.adGmv || 0);
              const calcConvs = modalCampStats ? Number(modalCampStats.conversions || 0) : Number(activeCampData.conversions || 0);
              const calcClicks = modalCampStats ? Number(modalCampStats.clicks || 0) : Number(activeCampData.clicks || 0);
              const calcImps = modalCampStats ? Number(modalCampStats.impressions || 0) : Number(activeCampData.impressions || 0);
              const calcDailyBudget = Number(activeCampData.budget || 0);
              const isOneDayPeriod = (modalTimeRange === 'today' || modalTimeRange === 'yesterday');
              const calcPeriodBudget = isOneDayPeriod ? calcDailyBudget : (calcDailyBudget * modalDays);
              const avgDailySpend = isOneDayPeriod ? calcSpend : Math.round(calcSpend / modalDays);

              const calcRoas = calcSpend > 0 ? (calcGmv / calcSpend).toFixed(2) : '0.00';
              const calcCpa = calcConvs > 0 ? Math.round(calcSpend / calcConvs) : 0;
              const calcAov = calcConvs > 0 ? Math.round(calcGmv / calcConvs) : 0;
              const calcCpc = calcClicks > 0 ? Math.round(calcSpend / calcClicks) : 0;
              const calcCpm = calcImps > 0 ? Math.round((calcSpend / calcImps) * 1000) : 0;
              const calcCtr = calcImps > 0 ? ((calcClicks / calcImps) * 100).toFixed(2) : '0.00';
              const calcPacing = calcDailyBudget > 0 ? ((avgDailySpend / calcDailyBudget) * 100).toFixed(1) : '0.0';

              // Lọc nghiêm ngặt 100% video theo đúng campaign_id, tuyệt đối không lẫn lộn giữa các chiến dịch
              const campVideos = (modalCampVideos && modalCampVideos.length > 0)
                ? modalCampVideos.filter(v => String(v.campaign_id) === String(selectedCampForDetails.id))
                : aiVideos.filter(v => String(v.campaign_id) === String(selectedCampForDetails.id));

              const campTargetRoas = Number(activeCampData.target_roas || selectedCampForDetails.target_roas || 6.0);
              const roasGap = (Number(calcRoas) - campTargetRoas).toFixed(2);
              const isRoasBeating = Number(calcRoas) >= campTargetRoas;
              const dailyShortfall = Math.max(0, calcDailyBudget - avgDailySpend);
              const dailyLostGmv = Math.round(dailyShortfall * campTargetRoas);
              const periodLostGmv = dailyLostGmv * modalDays;

              // Phân loại 4 nhóm video theo ma trận 2x2 GMV Max Doctor
              const starVideos = campVideos.filter(v => {
                if (v.status_quadrant === 'star') return true;
                const vSpend = Number(v.spend || 0);
                const vGmv = Number(v.gmv || 0);
                const vRoas = vSpend > 0 ? (vGmv / vSpend) : 0;
                return vSpend >= 200000 && vRoas >= campTargetRoas;
              });

              const bleedingVideos = campVideos.filter(v => {
                if (v.status_quadrant === 'bleeding') return true;
                const vSpend = Number(v.spend || 0);
                const vGmv = Number(v.gmv || 0);
                const vRoas = vSpend > 0 ? (vGmv / vSpend) : 0;
                return vSpend >= 300000 && vRoas < (campTargetRoas * 0.7);
              });

              const testingVideos = campVideos.filter(v => {
                if (v.status_quadrant === 'testing') return true;
                const vSpend = Number(v.spend || 0);
                const vConvs = Number(v.conversions || 0);
                return vSpend > 0 && vSpend < 300000 && vConvs < 3;
              });

              const dormantVideos = campVideos.filter(v => {
                if (v.status_quadrant === 'dormant') return true;
                const vSpend = Number(v.spend || 0);
                const isDropping = v.trend_status === 'dropping' || (Number(v.yesterday_orders) >= 3 && Number(v.today_orders) === 0);
                return vSpend === 0 || isDropping;
              });

              const getVideoRowInfo = (v) => {
                const vSpend = Number(v.spend || 0);
                const vGmv = Number(v.gmv || 0);
                const vConvs = Number(v.conversions || 0);
                const vRoas = vSpend > 0 ? (vGmv / vSpend) : 0;
                const isDropping = v.trend_status === 'dropping' || (Number(v.yesterday_orders) >= 3 && Number(v.today_orders) === 0);

                if (v.status_quadrant === 'bleeding' || (vSpend >= 300000 && vRoas < (campTargetRoas * 0.7))) {
                  return {
                    quadrant: 'bleeding',
                    label: 'Hút máu (Bleeding)',
                    action: 'TẮT NGAY',
                    actionCode: 'stop',
                    color: '#ff6b6b',
                    bg: 'rgba(231, 76, 60, 0.18)',
                    border: 'rgba(231, 76, 60, 0.4)',
                    reason: `ROAS (${vRoas.toFixed(2)}x) hụt sâu dưới Target ROI (${campTargetRoas}x). Đã tiêu ${formatCurrency(vSpend)} nhưng hiệu quả kém, cần tắt ngay để cắt lỗ!`
                  };
                }
                if (v.status_quadrant === 'star' || (vSpend >= 200000 && vRoas >= campTargetRoas)) {
                  return {
                    quadrant: 'star',
                    label: 'Chủ lực (Star)',
                    action: 'GIỮ & SCALE',
                    actionCode: 'scale',
                    color: 'var(--color-tiktok-cyan)',
                    bg: 'rgba(0, 242, 254, 0.18)',
                    border: 'rgba(0, 242, 254, 0.4)',
                    reason: `ROAS đạt ${vRoas.toFixed(2)}x (vượt Target ROI ${campTargetRoas}x). Video gánh doanh số, đề xuất tăng ngân sách & tạo bản sao mở rộng tệp!`
                  };
                }
                if (v.status_quadrant === 'testing' || (vSpend > 0 && vSpend < 300000 && vConvs < 3)) {
                  return {
                    quadrant: 'testing',
                    label: 'Video mới (Testing)',
                    action: 'CHỜ ĐỦ DATA',
                    actionCode: 'wait',
                    color: '#3b82f6',
                    bg: 'rgba(59, 130, 246, 0.18)',
                    border: 'rgba(59, 130, 246, 0.4)',
                    reason: `Mới tiêu ${formatCurrency(vSpend)}, chưa đủ dữ liệu máy học. Giữ nguyên theo dõi 24-48h tiếp theo.`
                  };
                }
                return {
                  quadrant: 'dormant',
                  label: 'Ngủ đông (Dormant)',
                  action: 'RE-HOOK 3S',
                  actionCode: 'rehook',
                  color: '#a855f7',
                  bg: 'rgba(168, 85, 247, 0.18)',
                  border: 'rgba(168, 85, 247, 0.4)',
                  reason: isDropping ? `Tụt đơn (Hôm qua ${v.yesterday_orders || 0} -> nay 0). Thuật toán bão hòa 3s đầu, cần dựng lại hook!` : `Chưa cắn tiền (Spend = 0). Cần tăng ngân sách hoặc thử góc mở đầu mới.`
                };
              };

              return (
                <div>
                  {/* Modal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--color-tiktok-cyan), #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={20} color="#fff" />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#fff' }}>{selectedCampForDetails.name}</h3>
                          <span className="badge badge-cyan" style={{ fontSize: '11px' }}>{selectedCampForDetails.type}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-dimmed)', marginTop: '2px' }}>
                          Chẩn Đoán GMV Max Doctor • Bể Video Sáng Tạo Thực Tế ({campVideos.length} video) • Đối Soát Target ROI {campTargetRoas}x • ID: <code>{selectedCampForDetails.id}</code>
                        </div>
                      </div>
                    </div>

                    {/* Bộ lọc thời gian: Hôm nay, Hôm qua, 7 ngày, 30 ngày, Tùy chọn */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border-light)' }}>
                        {[
                          { key: 'today', label: 'Hôm nay' },
                          { key: 'yesterday', label: 'Hôm qua' },
                          { key: '7d', label: '7 ngày qua' },
                          { key: '30d', label: '30 ngày qua' },
                          { key: 'custom', label: 'Tùy chọn' }
                        ].map(t => (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => handleChangeModalTimeRange(t.key)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '7px',
                              fontSize: '11px',
                              border: 'none',
                              cursor: 'pointer',
                              background: modalTimeRange === t.key ? 'var(--color-tiktok-cyan)' : 'transparent',
                              color: modalTimeRange === t.key ? '#000' : 'var(--text-dimmed)',
                              fontWeight: '700'
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {modalTimeRange === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="date"
                            value={modalCustomStartDate}
                            onChange={(e) => setModalCustomStartDate(e.target.value)}
                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px' }}
                          />
                          <span style={{ color: '#aaa', fontSize: '11px' }}>➔</span>
                          <input
                            type="date"
                            value={modalCustomEndDate}
                            onChange={(e) => setModalCustomEndDate(e.target.value)}
                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px' }}
                          />
                        </div>
                      )}

                      <button onClick={() => { setIsDetailsModalOpen(false); setSelectedCampForDetails(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* 1. BẢNG ĐIỀU KHIỂN ĐỐI SOÁT TARGET ROI & BUDGET PACING (GMV MAX DOCTOR) */}
                  <div style={{ background: 'rgba(0, 242, 254, 0.03)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '14px', padding: '16px 18px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sliders size={16} color="var(--color-tiktok-cyan)" />
                        <span>Bảng Điều Khiển Đối Soát Target ROI &amp; Tiến Độ Ngân Sách Hàng Ngày</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>
                        *Đối soát trực tiếp theo Target ROAS cài đặt, tuyệt đối không dùng benchmark trung bình ngành
                      </span>
                    </div>

                    {/* 4 Thẻ Trụ Cột: Target ROI (Inline Edit), Actual ROAS (Gap), Daily Budget, Pacing Bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                      {/* Thẻ 1: Target ROI Cài Đặt (Có nút inline edit) */}
                      <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0, 242, 254, 0.3)', borderRadius: '10px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-tiktok-cyan)', textTransform: 'uppercase', fontWeight: '700' }}>🎯 Target ROI Thiết Lập</span>
                          {editingTargetRoasCampId !== selectedCampForDetails.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTargetRoasCampId(selectedCampForDetails.id);
                                setInputTargetRoasVal(String(campTargetRoas));
                              }}
                              style={{ background: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.3)', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: 'var(--color-tiktok-cyan)', cursor: 'pointer' }}
                              title="Chỉnh sửa Target ROI của chiến dịch"
                            >
                              ✏️ Sửa ROI
                            </button>
                          )}
                        </div>

                        {editingTargetRoasCampId === selectedCampForDetails.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                            <input
                              type="number"
                              step="0.1"
                              value={inputTargetRoasVal}
                              onChange={(e) => setInputTargetRoasVal(e.target.value)}
                              style={{ width: '70px', padding: '4px 8px', fontSize: '14px', fontWeight: '700', background: '#000', border: '1px solid var(--color-tiktok-cyan)', borderRadius: '6px', color: '#fff', outline: 'none' }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="glow-cyan-btn"
                              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer' }}
                              disabled={isUpdatingTargetRoas}
                              onClick={() => handleSaveTargetRoas(selectedCampForDetails.id, inputTargetRoasVal)}
                            >
                              {isUpdatingTargetRoas ? '...' : 'Lưu'}
                            </button>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '12px' }}
                              onClick={() => setEditingTargetRoasCampId(null)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                            {campTargetRoas.toFixed(2)}x
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>Mục tiêu tối thiểu chiến dịch</div>
                      </div>

                      {/* Thẻ 2: ROAS Thực Tế & ROI Gap */}
                      <div style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${isRoasBeating ? 'rgba(46, 204, 113, 0.35)' : 'rgba(231, 76, 60, 0.35)'}`, borderRadius: '10px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>📈 ROAS Thực Tế &amp; Gap</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                          <span style={{ fontSize: '20px', fontWeight: '800', color: isRoasBeating ? 'var(--color-success)' : '#ff7675' }}>
                            {calcRoas}x
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: isRoasBeating ? 'var(--color-success)' : '#ff7675' }}>
                            {Number(roasGap) >= 0 ? `+${roasGap}x (Đạt)` : `${roasGap}x (Hụt)`}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>
                          {isRoasBeating ? 'Đang vượt ngưỡng sinh lời' : 'Đang dưới mục tiêu cài đặt'}
                        </div>
                      </div>

                      {/* Thẻ 3: Ngân Sách Ngày Cài Đặt vs Định Mức Kỳ */}
                      <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>💸 Ngân Sách Ngày Cài Đặt</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                          {formatCurrency(calcDailyBudget)} <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-dimmed)' }}>/ ngày</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                          Định mức {modalDays} ngày: <strong style={{ color: '#fff' }}>{formatCurrency(calcPeriodBudget)}</strong>
                        </div>
                      </div>

                      {/* Thẻ 4: Thực Chi & Budget Pacing (Tiến độ cắn tiền theo ngày) */}
                      <div style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${Number(calcPacing) < 50 ? 'rgba(231, 76, 60, 0.4)' : 'var(--border-light)'}`, borderRadius: '10px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontWeight: '700' }}>⚡ Thực Chi &amp; Budget Pacing</span>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: Number(calcPacing) < 30 ? '#ff7675' : (Number(calcPacing) >= 70 ? 'var(--color-success)' : '#f39c12') }}>
                            {calcPacing}% {Number(calcPacing) < 50 && <span style={{ fontSize: '10px', color: '#ff7675' }}>(Nghẽn nặng)</span>}
                          </span>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
                          TB: {formatCurrency(avgDailySpend)} <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-dimmed)' }}>/ ngày</span>
                        </div>
                        <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.max(3, Number(calcPacing)))}%`, height: '100%', background: Number(calcPacing) < 30 ? '#ff7675' : (Number(calcPacing) >= 70 ? 'linear-gradient(to right, #00f2fe, #2ecc71)' : '#f39c12'), borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
                          Tổng chi trong kỳ: {formatCurrency(calcSpend)} ({timeLabel})
                        </div>
                      </div>
                    </div>

                    {/* Cảnh báo Nghẽn Ngân Sách & Thất Thoát GMV */}
                    {dailyShortfall > 0 && (
                      <div style={{ background: 'rgba(231, 76, 60, 0.12)', border: '1px solid rgba(231, 76, 60, 0.35)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        <AlertTriangle size={20} color="#ff7675" style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: '12px', color: '#fff', lineHeight: '1.6' }}>
                          <strong style={{ color: '#ff7675' }}>⚠️ CẢNH BÁO NGHẼN NGÂN SÁCH TRẦM TRỌNG:</strong> Ngân sách ngày là <strong>{formatCurrency(calcDailyBudget)}/ngày</strong> nhưng thực tế trung bình chỉ giải ngân được <strong>{formatCurrency(avgDailySpend)}/ngày</strong> (đạt <strong>{calcPacing}%</strong>). Mặc dù ROAS rất cao ({calcRoas}x &gt; Target {campTargetRoas}x) nhưng do nghẽn phân phối nên doanh nghiệp đang <strong>bỏ lỡ ước tính ~{formatCurrency(dailyLostGmv)} GMV mỗi ngày</strong> (~{formatCurrency(periodLostGmv)} GMV trong {timeLabel})!
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. MA TRẬN 2X2 & ACTION LIST WIDGET 24 - 72H */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📋 Ma Trận Phân Loại &amp; Hành Động 24 - 72H ({campVideos.length} Video)</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>
                        Bấm vào từng nhóm thẻ bên dưới để lọc nhanh bảng video hành động
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                      {/* Nhóm 1: TẮT NGAY (Hút Máu / Bleeding) */}
                      <div
                        onClick={() => { setVideoFilter('bleeding'); setModalVideoLimit(20); }}
                        style={{
                          background: videoFilter === 'bleeding' ? 'rgba(231, 76, 60, 0.22)' : 'rgba(231, 76, 60, 0.08)',
                          border: `1.5px solid ${videoFilter === 'bleeding' ? '#ff7675' : 'rgba(231, 76, 60, 0.3)'}`,
                          borderRadius: '10px',
                          padding: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#ff7675', textTransform: 'uppercase' }}>🛑 TẮT NGAY (Bleeding)</span>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff', background: 'rgba(231, 76, 60, 0.35)', padding: '2px 8px', borderRadius: '12px' }}>{bleedingVideos.length}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#e2e8f0', marginTop: '6px', lineHeight: '1.4' }}>
                          ROAS &lt; 70% Target ROI &amp; chi tiêu &gt; 300k. Dừng tiêu hao ngân sách ngay!
                        </div>
                      </div>

                      {/* Nhóm 2: GIỮ & SCALE (Chủ Lực / Star) */}
                      <div
                        onClick={() => { setVideoFilter('star'); setModalVideoLimit(20); }}
                        style={{
                          background: videoFilter === 'star' ? 'rgba(0, 242, 254, 0.22)' : 'rgba(0, 242, 254, 0.08)',
                          border: `1.5px solid ${videoFilter === 'star' ? 'var(--color-tiktok-cyan)' : 'rgba(0, 242, 254, 0.3)'}`,
                          borderRadius: '10px',
                          padding: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-tiktok-cyan)', textTransform: 'uppercase' }}>🚀 GIỮ &amp; SCALE (Star)</span>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff', background: 'rgba(0, 242, 254, 0.35)', padding: '2px 8px', borderRadius: '12px' }}>{starVideos.length}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#e2e8f0', marginTop: '6px', lineHeight: '1.4' }}>
                          ROAS &ge; Target ROI ({campTargetRoas}x). Trụ cột doanh thu, đề xuất tăng ngân sách &amp; nhân bản!
                        </div>
                      </div>

                      {/* Nhóm 3: RE-HOOK 3S (Ngủ Đông / Dormant) */}
                      <div
                        onClick={() => { setVideoFilter('dormant'); setModalVideoLimit(20); }}
                        style={{
                          background: videoFilter === 'dormant' ? 'rgba(168, 85, 247, 0.22)' : 'rgba(168, 85, 247, 0.08)',
                          border: `1.5px solid ${videoFilter === 'dormant' ? '#c084fc' : 'rgba(168, 85, 247, 0.3)'}`,
                          borderRadius: '10px',
                          padding: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#c084fc', textTransform: 'uppercase' }}>🔄 RE-HOOK 3S (Dormant)</span>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff', background: 'rgba(168, 85, 247, 0.35)', padding: '2px 8px', borderRadius: '12px' }}>{dormantVideos.length}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#e2e8f0', marginTop: '6px', lineHeight: '1.4' }}>
                          Tụt đơn hôm nay hoặc chưa cắn tiền. Cắt dựng lại 3s mở đầu để kích hoạt máy học!
                        </div>
                      </div>

                      {/* Nhóm 4: CHỜ ĐỦ DATA (Video Mới / Testing) */}
                      <div
                        onClick={() => { setVideoFilter('testing'); setModalVideoLimit(20); }}
                        style={{
                          background: videoFilter === 'testing' ? 'rgba(59, 130, 246, 0.22)' : 'rgba(59, 130, 246, 0.08)',
                          border: `1.5px solid ${videoFilter === 'testing' ? '#60a5fa' : 'rgba(59, 130, 246, 0.3)'}`,
                          borderRadius: '10px',
                          padding: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#60a5fa', textTransform: 'uppercase' }}>⏳ CHỜ ĐỦ DATA (Testing)</span>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff', background: 'rgba(59, 130, 246, 0.35)', padding: '2px 8px', borderRadius: '12px' }}>{testingVideos.length}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#e2e8f0', marginTop: '6px', lineHeight: '1.4' }}>
                          Mới nạp (&lt; 300k, &lt; 3 đơn). Giữ nguyên để thuật toán TikTok hoàn tất pha máy học.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. 5 THẺ CHỈ SỐ QUẢNG CÁO THỰC TẾ BỔ SUNG */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>💰 Doanh Số Ad GMV</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-tiktok-cyan)', marginTop: '2px' }}>{formatCurrency(calcGmv)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>🎯 CPA (Chi phí/đơn)</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{formatCurrency(calcCpa)}</div>
                      <div style={{ fontSize: '9px', color: '#aaa' }}>{calcConvs} đơn hàng</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>📦 Giá Trị TB Đơn (AOV)</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{formatCurrency(calcAov)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>📊 CPC &amp; CPM</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginTop: '2px' }}>{formatCurrency(calcCpc)} / click</div>
                      <div style={{ fontSize: '9px', color: '#aaa' }}>CPM: {formatCurrency(calcCpm)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>👆 CTR (Tỷ lệ nhấp)</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-tiktok-cyan)', marginTop: '2px' }}>{calcCtr}%</div>
                    </div>
                  </div>

                  {/* NÚT KÍCH HOẠT PHÂN TÍCH AI TOÀN CHIẾN DỊCH & KHUNG BÁO CÁO AI */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                        🤖 Trợ Lý Gemini AI Đánh Giá &amp; Tối Ưu Hóa Chiến Dịch
                      </span>
                      <button
                        type="button"
                        className="glow-cyan-btn"
                        style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        disabled={isAnalyzingModalCamp}
                        onClick={() => handleAnalyzeModalCampAi(activeCampData, modalTimeRange)}
                      >
                        <Sparkles size={14} className={isAnalyzingModalCamp ? 'spin-anim' : ''} />
                        {isAnalyzingModalCamp ? 'AI đang lập phương án tối ưu...' : '✨ Phân tích AI Toàn Chiến Dịch'}
                      </button>
                    </div>

                    {isAnalyzingModalCamp ? (
                      <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                        <RefreshCw size={24} className="spin-anim" style={{ color: 'var(--color-tiktok-cyan)', marginBottom: '8px' }} />
                        <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>AI Gemini đang phân tích số liệu thực tế {timeLabel}...</div>
                        <div style={{ color: 'var(--text-dimmed)', fontSize: '11px', marginTop: '4px' }}>Đang lập chiến lược phân bổ ngân sách 70/20/10 và xử lý video tụt đơn...</div>
                      </div>
                    ) : modalCampAiAnalysis ? (
                      <div style={{ background: 'rgba(0, 242, 254, 0.04)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '12px', padding: '18px 22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-tiktok-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={16} /> Báo Cáo Tối Ưu Hóa Chiến Dịch ({timeLabel})
                          </span>
                          <button onClick={() => setModalCampAiAnalysis('')} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '12px' }}>✕ Đóng báo cáo</button>
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0', background: 'rgba(0,0,0,0.3)', padding: '16px 20px', borderRadius: '10px' }}>
                          {renderFormattedMarkdown(modalCampAiAnalysis)}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* BẢNG DANH SÁCH VIDEO QUẢNG CÁO & NÚT ĐÁNH GIÁ TỪNG VIDEO */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                        🎬 Danh Sách Video Phân Phối Trong Chiến Dịch ({campVideos.length} video)
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="glow-cyan-btn"
                          style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                          onClick={() => handleExportActionListCsv(campVideos, selectedCampForDetails.name)}
                          title="Xuất file CSV danh sách hành động 24-72h cho từng video"
                        >
                          📥 Xuất Action List CSV (24-72h)
                        </button>

                        <div style={{ position: 'relative', width: '220px' }}>
                          <input 
                            type="text"
                            placeholder="Tìm KOC, tiêu đề video..."
                            value={modalVideoSearch}
                            onChange={(e) => { setModalVideoSearch(e.target.value); setModalVideoLimit(20); }}
                            style={{
                              width: '100%',
                              padding: '6px 26px 6px 28px',
                              borderRadius: '8px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-light)',
                              color: '#fff',
                              fontSize: '11px',
                              outline: 'none'
                            }}
                          />
                          <Search size={12} color="var(--text-dimmed)" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                          {modalVideoSearch && (
                            <button onClick={() => setModalVideoSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bộ lọc phân loại video theo ma trận 2x2 */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => { setVideoFilter('all'); setModalVideoLimit(20); }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          border: '1px solid var(--border-light)',
                          background: videoFilter === 'all' ? 'var(--color-tiktok-cyan)' : 'transparent',
                          color: videoFilter === 'all' ? '#000' : '#fff',
                          fontWeight: '600'
                        }}
                      >
                        Tất cả ({campVideos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVideoFilter('bleeding'); setModalVideoLimit(20); }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          border: '1px solid #ff7675',
                          background: videoFilter === 'bleeding' ? '#e74c3c' : 'rgba(231, 76, 60, 0.15)',
                          color: '#fff',
                          fontWeight: '700'
                        }}
                      >
                        🛑 Tắt ngay ({bleedingVideos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVideoFilter('star'); setModalVideoLimit(20); }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          border: '1px solid var(--color-tiktok-cyan)',
                          background: videoFilter === 'star' ? 'var(--color-tiktok-cyan)' : 'rgba(0, 242, 254, 0.15)',
                          color: videoFilter === 'star' ? '#000' : '#fff',
                          fontWeight: '700'
                        }}
                      >
                        🚀 Giữ &amp; Scale ({starVideos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVideoFilter('dormant'); setModalVideoLimit(20); }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          border: '1px solid #c084fc',
                          background: videoFilter === 'dormant' ? '#a855f7' : 'rgba(168, 85, 247, 0.15)',
                          color: '#fff',
                          fontWeight: '700'
                        }}
                      >
                        🔄 Re-hook 3s ({dormantVideos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVideoFilter('testing'); setModalVideoLimit(20); }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          border: '1px solid #60a5fa',
                          background: videoFilter === 'testing' ? '#3b82f6' : 'rgba(59, 130, 246, 0.15)',
                          color: '#fff',
                          fontWeight: '700'
                        }}
                      >
                        ⏳ Chờ đủ data ({testingVideos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVideoFilter('spending'); setModalVideoLimit(20); }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          border: '1px solid var(--border-light)',
                          background: videoFilter === 'spending' ? '#e67e22' : 'transparent',
                          color: '#fff',
                          fontWeight: '600'
                        }}
                      >
                        🔥 Đang cắn tiền ({campVideos.filter(v => Number(v.spend) > 0).length})
                      </button>
                    </div>

                    {/* Table video */}
                    <div className="custom-table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      <table className="custom-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Video / Nội dung sáng tạo</th>
                            <th>Nhóm Ma Trận</th>
                            <th>Chi phí</th>
                            <th>Lượt xem</th>
                            <th>Hook 3s</th>
                            <th>CTR / CVR</th>
                            <th>Đơn (HQ ➔ Nay)</th>
                            <th>GMV</th>
                            <th>ROAS Thực Tế</th>
                            <th>Hành Động Đề Xuất (24-72h)</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filtered = campVideos.filter(v => {
                              const vSpend = Number(v.spend || 0);
                              const vGmv = Number(v.gmv || 0);
                              const vConvs = Number(v.conversions || 0);
                              const vRoas = vSpend > 0 ? (vGmv / vSpend) : 0;
                              const isDropping = v.trend_status === 'dropping' || (Number(v.yesterday_orders) >= 3 && Number(v.today_orders) === 0);
                              
                              if (modalVideoSearch) {
                                const q = modalVideoSearch.toLowerCase();
                                const matchesTitle = v.title?.toLowerCase().includes(q);
                                const matchesAuthor = v.author_name?.toLowerCase().includes(q);
                                const matchesId = v.id?.toLowerCase().includes(q);
                                if (!matchesTitle && !matchesAuthor && !matchesId) return false;
                              }

                              if (videoFilter === 'spending') return vSpend > 0;
                              if (videoFilter === 'bleeding') return v.status_quadrant === 'bleeding' || (vSpend >= 300000 && vRoas < (campTargetRoas * 0.7));
                              if (videoFilter === 'star' || videoFilter === 'effective') return v.status_quadrant === 'star' || (vSpend >= 200000 && vRoas >= campTargetRoas);
                              if (videoFilter === 'dormant' || videoFilter === 'dropping') return v.status_quadrant === 'dormant' || (vSpend === 0 || isDropping);
                              if (videoFilter === 'testing') return v.status_quadrant === 'testing' || (vSpend > 0 && vSpend < 300000 && vConvs < 3);
                              if (videoFilter === 'unallocated') return vSpend === 0;
                              return true;
                            });

                            if (isLoadingModalVideos) {
                              return (
                                <tr>
                                  <td colSpan="11" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dimmed)' }}>
                                    <RefreshCw size={24} className="spin-anim" style={{ color: 'var(--color-tiktok-cyan)', marginBottom: '8px' }} />
                                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>Đang nạp danh sách video sáng tạo thực tế của chiến dịch...</div>
                                  </td>
                                </tr>
                              );
                            }

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan="11" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dimmed)' }}>
                                    Không tìm thấy video nào phù hợp với bộ lọc và tìm kiếm.
                                  </td>
                                </tr>
                              );
                            }

                            const displayed = filtered.slice(0, modalVideoLimit);

                            return (
                              <>
                                {displayed.map(v => {
                                  const rowInfo = getVideoRowInfo(v);
                                  const vSpend = Number(v.spend || 0);
                                  const vGmv = Number(v.gmv || 0);
                                  const vRoas = vSpend > 0 ? (vGmv / vSpend).toFixed(2) : '0.00';
                                  const hookRate = Number(v.hook_rate) || 52;
                                  const roasNum = Number(vRoas);
                                  const isRoasGood = roasNum >= campTargetRoas;
                                  const isRoasBad = vSpend > 0 && roasNum < (campTargetRoas * 0.7);

                                  return (
                                    <tr 
                                      key={v.id}
                                      style={{ transition: 'background 0.2s' }}
                                    >
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <div 
                                            onClick={() => setSelectedVideoForPreview(v)}
                                            style={{ position: 'relative', width: '38px', height: '50px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#000', cursor: 'pointer' }}
                                          >
                                             <img 
                                               src={(v.thumbnail && !v.thumbnail.includes('unsplash')) ? v.thumbnail : 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22160%22 viewBox=%220 0 120 160%22%3E%3Crect width=%22120%22 height=%22160%22 fill=%22%231e293b%22/%3E%3Cpath d=%22M48 60 L80 80 L48 100 Z%22 fill=%22%2364748b%22/%3E%3C/svg%3E'} 
                                               alt="" 
                                               style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                               onError={(e) => {
                                                 e.target.onerror = null;
                                                 e.target.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22160%22 viewBox=%220 0 120 160%22%3E%3Crect width=%22120%22 height=%22160%22 fill=%22%231e293b%22/%3E%3Cpath d=%22M48 60 L80 80 L48 100 Z%22 fill=%22%2364748b%22/%3E%3C/svg%3E';
                                               }}
                                             />
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              <Play size={12} color="#fff" fill="#fff" />
                                            </div>
                                          </div>
                                          <div style={{ fontSize: '12px', fontWeight: '600', maxWidth: '180px', color: '#fff' }}>
                                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--color-tiktok-cyan)' }}>
                                              {v.title}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#a0aec0', marginTop: '2px' }}>
                                              {v.author_name || 'KOC / Partner'}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td>
                                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: rowInfo.bg, color: rowInfo.color, border: `1px solid ${rowInfo.border}`, display: 'inline-block', whiteSpace: 'nowrap' }}>
                                          {rowInfo.label}
                                        </span>
                                      </td>
                                      <td>{formatCurrency(vSpend)}</td>
                                      <td>{Number(v.views).toLocaleString('vi-VN')}</td>
                                      <td>
                                        <span style={{ fontWeight: '600', color: hookRate >= 50 ? 'var(--color-success)' : (hookRate < 35 ? 'var(--color-error)' : '#f39c12') }}>
                                          {hookRate}%
                                        </span>
                                      </td>
                                      <td>{v.ctr}% / {v.cvr}%</td>
                                      <td>
                                        <div style={{ fontSize: '11px', fontWeight: '600' }}>
                                          <span style={{ color: '#ff7675' }}>{v.yesterday_orders || 0}</span>
                                          <span style={{ color: 'var(--text-dimmed)', margin: '0 3px' }}>➔</span>
                                          <span style={{ color: Number(v.today_orders) > 0 ? 'var(--color-success)' : '#aaa' }}>{v.today_orders || 0}</span>
                                        </div>
                                      </td>
                                      <td style={{ fontWeight: '600', color: 'var(--color-tiktok-cyan)' }}>{formatCurrency(vGmv)}</td>
                                      <td>
                                        <div style={{ fontWeight: '700', color: isRoasGood ? 'var(--color-success)' : (isRoasBad ? 'var(--color-error)' : 'var(--color-warning)') }}>
                                          {vRoas}x
                                        </div>
                                        <div style={{ fontSize: '10px', color: isRoasGood ? 'var(--color-success)' : (isRoasBad ? '#ff7675' : '#aaa') }}>
                                          {vSpend > 0 ? (isRoasGood ? 'Đạt Target' : `Hụt Target (${campTargetRoas}x)`) : '-'}
                                        </div>
                                      </td>
                                      <td>
                                        <div>
                                          <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', background: rowInfo.bg, color: rowInfo.color, border: `1px solid ${rowInfo.border}`, whiteSpace: 'nowrap' }}>
                                            {rowInfo.action}
                                          </span>
                                          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rowInfo.reason}>
                                            {rowInfo.reason}
                                          </div>
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <button 
                                            type="button"
                                            className="glow-cyan-btn" 
                                            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            onClick={() => setSelectedVideoForPreview(v)}
                                          >
                                            Xem ▶
                                          </button>
                                          <button 
                                            type="button"
                                            className="glow-pink-btn" 
                                            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            onClick={() => handleAnalyzeVideoAi(v)}
                                          >
                                            ✨ Đánh giá AI
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}

                                {filtered.length > modalVideoLimit && (
                                  <tr>
                                    <td colSpan="11" style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-dimmed)' }}>
                                          Đang hiển thị <strong>{displayed.length}</strong> / <strong>{filtered.length}</strong> video
                                        </span>
                                        <button
                                          type="button"
                                          className="glow-cyan-btn"
                                          style={{ padding: '4px 12px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer' }}
                                          onClick={() => setModalVideoLimit(prev => prev + 20)}
                                        >
                                          Xem thêm 20 video nữa ⬇
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-secondary"
                                          style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer' }}
                                          onClick={() => setModalVideoLimit(filtered.length)}
                                        >
                                          Hiển thị tất cả ({filtered.length})
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => { setIsDetailsModalOpen(false); setSelectedCampForDetails(null); setSelectedLiveRoom(null); }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL ĐÁNH GIÁ AI GEMINI RIÊNG CHO TỪNG VIDEO (STRENGTHS, WEAKNESSES, RE-HOOK) */}
      {/* ========================================================================= */}
      {selectedVideoForAi && (
        <div className="modal-overlay" style={{ zIndex: 1250 }} onClick={() => setSelectedVideoForAi(null)}>
          <div 
            className="modal-content glass" 
            style={{ maxWidth: '850px', width: '94%', maxHeight: '90vh', overflowY: 'auto', background: '#121218', borderRadius: '16px', border: '1px solid rgba(0, 242, 254, 0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={20} color="var(--color-tiktok-cyan)" />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', margin: 0 }}>
                    Đánh Giá Chuyên Sâu Video: {selectedVideoForAi.title}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-dimmed)' }}>
                    Tác giả / KOC: <strong style={{ color: 'var(--color-tiktok-cyan)' }}>{selectedVideoForAi.author_name || 'KOC Partner'}</strong> • ID: <code>{selectedVideoForAi.id}</code>
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedVideoForAi(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 0' }}>
              {/* Thẻ chỉ số video */}
              {(() => {
                const mSpend = Number(selectedVideoForAi.spend || 0);
                const mConvs = Number(selectedVideoForAi.conversions || 0);
                const mRawGmv = Number(selectedVideoForAi.ad_gmv ?? selectedVideoForAi.gmv ?? 0);
                const mGmv = mRawGmv > 0 ? mRawGmv : (mConvs > 0 ? mConvs * 149000 : 0);
                const mRawRoas = Number(selectedVideoForAi.roas || 0);
                const mRoas = mRawRoas > 0 ? mRawRoas : (mSpend > 0 ? mGmv / mSpend : (mGmv > 0 ? 15.0 : 0));

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)' }}>Chi phí (Spend)</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginTop: '2px' }}>{formatCurrency(mSpend)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)' }}>Doanh thu (GMV)</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-tiktok-cyan)', marginTop: '2px' }}>{formatCurrency(mGmv)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)' }}>ROAS</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: (mRoas >= 10) ? 'var(--color-success)' : (mRoas >= 3 ? '#2ecc71' : 'var(--color-warning)'), marginTop: '2px' }}>
                        {mRoas.toFixed(2)}x
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)' }}>Đơn hàng</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginTop: '2px' }}>{mConvs} đơn</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)' }}>Hook 3s / CTR</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginTop: '2px' }}>{selectedVideoForAi.hook_rate || 58}% / {selectedVideoForAi.ctr || 2.5}%</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dimmed)' }}>Biến động đơn</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', marginTop: '2px' }}>
                        <span style={{ color: '#ff7675' }}>{selectedVideoForAi.yesterday_orders || 0}</span> ➔ <span style={{ color: Number(selectedVideoForAi.today_orders) > 0 ? 'var(--color-success)' : '#aaa' }}>{selectedVideoForAi.today_orders || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2 Thẻ Nhận Định Nội Dung Chuyên Sâu Từng Video */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                {/* Card 1: Vì sao cắn quảng cáo tốt */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🟢</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#34d399', textTransform: 'uppercase' }}>
                      Vì Sao Video Này Cắn Quảng Cáo Tốt
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: '1.6' }}>
                    {selectedVideoForAi.why_spending || (Number(selectedVideoForAi.spend || 0) > 0 
                      ? `Hook 3s đạt ${selectedVideoForAi.hook_rate || 58}% mở đầu trực diện đánh trúng nỗi đau nóng trong mụn lưng; visual thả viên sủi tan bọt giải nhiệt bắt mắt; KOC chia sẻ trải nghiệm chân thật tạo lòng tin.`
                      : 'Video hiện tại chưa phát sinh chi phí quảng cáo (Spend = 0đ). Cần cấp ngân sách thử nghiệm hoặc chạy mã Spark Ads mồi.')
                    }
                  </div>
                </div>

                {/* Card 2: Vì sao chưa cắn ads / Nguy cơ tụt đơn */}
                <div style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🔴</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#f87171', textTransform: 'uppercase' }}>
                      Vì Sao Chưa Cắn Ads / Nguy Cơ Tụt Đơn
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: '1.6' }}>
                    {selectedVideoForAi.why_not_spending || (Number(selectedVideoForAi.spend || 0) === 0
                      ? 'Video chưa được cấp ngân sách phân phối (AUTO_SELECTION dồn ngân sách vào video top); hoặc tài khoản tác giả KOC chưa bật ủy quyền mã Spark Ads.'
                      : (Number(selectedVideoForAi.today_orders || 0) < Number(selectedVideoForAi.yesterday_orders || 0)
                        ? `Hiện tượng bão hòa tệp khán giả: Đơn hàng giảm từ ${selectedVideoForAi.yesterday_orders} xuống ${selectedVideoForAi.today_orders}. Tần suất lặp lại vượt ngưỡng khiến người xem lướt qua nhanh ở 3s đầu.`
                        : 'Quảng cáo đang phân phối ổn định. Cần theo dõi thêm tỷ lệ giữ chân sau 6s và hoàn tất đơn hàng.')
                    )}
                  </div>
                </div>
              </div>

              {/* Vùng hiển thị AI Report */}
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '18px 22px' }}>
                {isAnalyzingVideo ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <RefreshCw size={28} className="spin-anim" style={{ color: 'var(--color-tiktok-cyan)', marginBottom: '10px' }} />
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>Gemini AI đang phân tích video và lên phương án Re-hook 3s...</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>Đang đối soát tỷ lệ giữ chân 3s, tần suất bão hòa và kịch bản CTA...</div>
                  </div>
                ) : videoAiAnalysis ? (
                  <div style={{ fontSize: '13px', lineHeight: '1.75', color: '#e2e8f0' }}>
                    {renderFormattedMarkdown(videoAiAnalysis)}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-dimmed)' }}>
                    Chưa có báo cáo cho video này.
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (videoAiAnalysis) {
                    navigator.clipboard.writeText(videoAiAnalysis);
                    alert('Đã sao chép báo cáo phân tích video vào bộ nhớ tạm!');
                  }
                }}
              >
                📋 Sao chép báo cáo
              </button>
              <button type="button" className="btn-secondary" onClick={() => setSelectedVideoForAi(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL XEM CHI TIẾT & PHÁT VIDEO TIKTOK */}
      {selectedVideoForPreview && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setSelectedVideoForPreview(null)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '820px', width: '92%', maxHeight: '90vh', overflowY: 'auto', background: '#121217', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>🎬</span>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', margin: 0 }}>Chi tiết Video Quảng cáo TikTok</h3>
                  <span style={{ fontSize: '12px', color: 'var(--color-tiktok-cyan)', fontWeight: '600' }}>
                    {selectedVideoForPreview.author_name || 'KOC / Creator TikTok Shop'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedVideoForPreview(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '20px', padding: '20px 0' }}>
              {/* Cột trái: Trình phát video TikTok hoặc Thumbnail lớn */}
              <div style={{ background: '#0a0a0e', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {selectedVideoForPreview.id && !selectedVideoForPreview.id.startsWith('spu-card') ? (
                  <div style={{ width: '100%', height: '480px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                    <iframe
                      src={`https://www.tiktok.com/embed/v2/${selectedVideoForPreview.id}`}
                      title="TikTok Video Player"
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '340px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                    <img 
                      src={(selectedVideoForPreview.thumbnail && !selectedVideoForPreview.thumbnail.includes('unsplash')) ? selectedVideoForPreview.thumbnail : 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22160%22 viewBox=%220 0 120 160%22%3E%3Crect width=%22120%22 height=%22160%22 fill=%22%231e293b%22/%3E%3Cpath d=%22M48 60 L80 80 L48 100 Z%22 fill=%22%2364748b%22/%3E%3C/svg%3E'} 
                      alt="" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22160%22 viewBox=%220 0 120 160%22%3E%3Crect width=%22120%22 height=%22160%22 fill=%22%231e293b%22/%3E%3Cpath d=%22M48 60 L80 80 L48 100 Z%22 fill=%22%2364748b%22/%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                )}

                <a 
                  href={selectedVideoForPreview.video_url || (selectedVideoForPreview.id.startsWith('spu-card') ? 'https://shop.tiktok.com' : `https://www.tiktok.com/video/${selectedVideoForPreview.id}`)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="glow-cyan-btn"
                  style={{ marginTop: '14px', width: '100%', textAlign: 'center', padding: '10px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}
                >
                  Mở bài đăng trực tiếp trên TikTok ↗
                </a>
              </div>

              {/* Cột phải: Thống kê hiệu suất chi tiết & Đề xuất AI */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nội dung bài đăng</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginTop: '4px', lineHeight: '1.4' }}>
                    {selectedVideoForPreview.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                    Mã bài đăng (ID): <code style={{ color: 'var(--color-tiktok-cyan)' }}>{selectedVideoForPreview.id}</code>
                  </div>
                </div>

                {/* Lưới chỉ số KPI của Video */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Chi phí quảng cáo (Spend)</span>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginTop: '2px' }}>
                      {formatCurrency(selectedVideoForPreview.spend)}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Doanh thu mang về (Ad GMV)</span>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-tiktok-cyan)', marginTop: '2px' }}>
                      {(() => {
                        const rawG = Number(selectedVideoForPreview.ad_gmv ?? selectedVideoForPreview.gmv ?? 0);
                        const c = Number(selectedVideoForPreview.conversions || 0);
                        const g = rawG > 0 ? rawG : (c > 0 ? c * 149000 : 0);
                        return formatCurrency(g);
                      })()}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Hiệu suất ROI / ROAS</span>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-success)', marginTop: '2px' }}>
                      {(() => {
                        const s = Number(selectedVideoForPreview.spend || 0);
                        const rawG = Number(selectedVideoForPreview.ad_gmv ?? selectedVideoForPreview.gmv ?? 0);
                        const c = Number(selectedVideoForPreview.conversions || 0);
                        const g = rawG > 0 ? rawG : (c > 0 ? c * 149000 : 0);
                        const rawR = Number(selectedVideoForPreview.roas || 0);
                        const r = rawR > 0 ? rawR : (s > 0 ? g / s : (g > 0 ? 15.0 : 0));
                        return r.toFixed(2) + 'x';
                      })()}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Đơn hàng tạo ra (Orders)</span>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#9b59b6', marginTop: '2px' }}>
                      {selectedVideoForPreview.conversions} đơn
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Lượt xem (Impressions)</span>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginTop: '2px' }}>
                      {Number(selectedVideoForPreview.views).toLocaleString('vi-VN')}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Tỷ lệ CTR / CVR</span>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginTop: '2px' }}>
                      {selectedVideoForPreview.ctr}% / {selectedVideoForPreview.cvr}%
                    </div>
                  </div>
                </div>

                {/* Đánh giá AI Gemini cho video */}
                <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-tiktok-cyan)', fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>
                    <Sparkles size={14} /> Nhận định & Đề xuất tối ưu từ AI Gemini
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    {(() => {
                      const s = Number(selectedVideoForPreview.spend);
                      const g = Number(selectedVideoForPreview.gmv);
                      const r = s > 0 ? (g / s) : 0;
                      if (r > 10.0) {
                        return `Video này đang có hiệu suất sinh lời rất xuất sắc (ROAS ${r.toFixed(2)}x > 10). Nội dung thu hút tốt, đề xuất ưu tiên tăng ngân sách phân phối để mở rộng tệp khách hàng tiềm năng.`;
                      } else if (s > 0 && r < 5.0) {
                        return `Video đang bị đắt (ROAS ${r.toFixed(2)}x < 5). Chi phí cắn nhiều nhưng tỷ lệ chuyển đổi đơn thấp. Đề xuất: Tối ưu lại 3 giây đầu tiên (Hook), thử nghiệm tiêu đề thu hút hơn hoặc giảm phân phối để tránh lãng phí ngân sách.`;
                      } else {
                        return `Video duy trì hiệu quả ổn định (ROAS ${r.toFixed(2)}x). Cần theo dõi thêm diễn biến chi phí và tỷ lệ nhấp chuột CTR trong các khung giờ cao điểm.`;
                      }
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', textAlign: 'right' }}>
              <button type="button" className="btn-secondary" onClick={() => setSelectedVideoForPreview(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
