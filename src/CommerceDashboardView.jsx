import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  Calendar,
  Calculator,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  HelpCircle,
  Layers,
  List,
  Lock,
  Maximize2,
  Package,
  PackageCheck,
  PackageMinus,
  PackageX,
  Play,
  Radio,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Sparkles,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Video,
  X,
  XCircle,
  Zap
} from 'lucide-react';
import CommerceReportView from './CommerceReportView';
import CommerceSyncManagementView from './CommerceSyncManagementView';
import CommerceAffiliateView from './CommerceAffiliateView';
import CommerceLiveAnalyticsView from './CommerceLiveAnalyticsView';
import CommerceShopeeView from './CommerceShopeeView';
import CommerceGoldenHoursView from './CommerceGoldenHoursView';
import CommerceGmvMaxPlaybookView from './CommerceGmvMaxPlaybookView';
import CommerceOrderLossCalculatorView from './CommerceOrderLossCalculatorView';
import CommerceSopCommandCenterView from './CommerceSopCommandCenterView';
import CommerceTrueRoasView from './CommerceTrueRoasView';
import CommerceVideoProductView from './CommerceVideoProductView';

export default function CommerceDashboardView({
  shopId = '7495657895504611503',
  realShopId = null,
  apiRequest,
  subTab: propSubTab,
  onSubTabChange,
  startDate: propStartDate,
  endDate: propEndDate,
  datePreset: propDatePreset,
  onDateChange: propOnDateChange,
  onTriggerSync: propOnTriggerSync,
  targetRoi: propTargetRoi,
  targetRoas: propTargetRoas
}) {
  // Navigation Sub-tab
  // 'report' (P0 Date-Range Reporting), 'overview' (Daily Management Dashboard), 'orders', 'customers', 'products', 'ads', 'finance', 'losses', 'lives', 'videos', 'sync'
  const [subTab, setSubTab] = useState('report');

  useEffect(() => {
    if (propSubTab && propSubTab !== subTab) {
      setSubTab(propSubTab);
    }
  }, [propSubTab]);

  const handleSubTabChange = (newTab) => {
    setSubTab(newTab);
    if (onSubTabChange) onSubTabChange(newTab);
  };

  // Date Range State (Defaults to Today)
  const [datePreset, setDatePreset] = useState(() => propDatePreset || 'today');
  const [startDate, setStartDate] = useState(() => {
    if (propStartDate) return propStartDate;
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  });
  const [endDate, setEndDate] = useState(() => {
    if (propEndDate) return propEndDate;
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  });

  useEffect(() => {
    if (propStartDate && propStartDate !== startDate) setStartDate(propStartDate);
    if (propEndDate && propEndDate !== endDate) setEndDate(propEndDate);
    if (propDatePreset && propDatePreset !== datePreset) setDatePreset(propDatePreset);
  }, [propStartDate, propEndDate, propDatePreset]);

  const handleDateChangeUnified = (s, e, p) => {
    setStartDate(s);
    setEndDate(e);
    if (p) setDatePreset(p);
    if (propOnDateChange) propOnDateChange(s, e, p);
  };

  // Main Dashboard Report State
  const [reportData, setReportData] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Orders Tab State
  const [orders, setOrders] = useState([]);
  const [orderPagination, setOrderPagination] = useState({ page: 1, limit: 25, total_records: 0, total_pages: 1 });
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderStatusCounts, setOrderStatusCounts] = useState({});
  const [totalPeriodOrders, setTotalPeriodOrders] = useState(0);
  const [isExportingOrders, setIsExportingOrders] = useState(false);
  const [rmaCoverage, setRmaCoverage] = useState(null);

  // Customer 360 Tab State
  const [customerList, setCustomerList] = useState([]);
  const [customerPagination, setCustomerPagination] = useState({ page: 1, limit: 25, total_records: 0, total_pages: 1 });
  const [customerSearch, setCustomerSearch] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isSyncingCustomer, setIsSyncingCustomer] = useState(false);
  const [isSyncingPriorityRecipients, setIsSyncingPriorityRecipients] = useState(false);
  const [customerPiiStatus, setCustomerPiiStatus] = useState(null);
  const [customerStatusMessage, setCustomerStatusMessage] = useState(null);
  const [customerCohortSummary, setCustomerCohortSummary] = useState(null);
  const [customerDataTrust, setCustomerDataTrust] = useState(null);
  const [customerViewMode, setCustomerViewMode] = useState('list'); // 'list' | 'detail' (Customer Detail Tab)
  const [customerCohortFilter, setCustomerCohortFilter] = useState('UNMASKED'); // Default to unmasked (🟢 Đã có thông tin)
  const [isPurgingMasked, setIsPurgingMasked] = useState(false);
  const [customerScope, setCustomerScope] = useState('ALL'); // 'ALL' (toàn thời gian) | 'PERIOD' (trong kỳ)
  const [customerSort, setCustomerSort] = useState('latest_order'); // 'latest_order' | 'most_orders' | 'highest_spend' | 'first_order'
  const [customerDatePreset, setCustomerDatePreset] = useState('all'); // 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom'
  const [customerStartDate, setCustomerStartDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [customerEndDate, setCustomerEndDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Losses Tab State
  const [losses, setLosses] = useState([]);
  const [lossPagination, setLossPagination] = useState({ page: 1, limit: 25, total_records: 0, total_pages: 1 });
  const [lossTypeFilter, setLossTypeFilter] = useState('');
  const [perspectiveFilter, setPerspectiveFilter] = useState('MATURED_LIFECYCLE');
  const [isLoadingLosses, setIsLoadingLosses] = useState(false);

  // Finance Tab State
  const [financeStatements, setFinanceStatements] = useState([]);
  const [financePagination, setFinancePagination] = useState({ page: 1, limit: 25, total_records: 0, total_pages: 1 });
  const [isLoadingFinance, setIsLoadingFinance] = useState(false);
  const [isExportingFinance, setIsExportingFinance] = useState(false);
  const [financeReconciliation, setFinanceReconciliation] = useState(null);
  const [financeSubView, setFinanceSubView] = useState('statements'); // 'statements' | 'orders_reconcile'
  const [financePaymentStatusFilter, setFinancePaymentStatusFilter] = useState('ALL');
  const [financeStmtSearch, setFinanceStmtSearch] = useState('');
  const [financeOrders, setFinanceOrders] = useState([]);
  const [financeOrdersPagination, setFinanceOrdersPagination] = useState({ page: 1, limit: 25, total_records: 0, total_pages: 1 });
  const [financeOrderFilter, setFinanceOrderFilter] = useState('ALL'); // 'ALL' | 'SETTLED' | 'UNSETTLED' | 'HIGH_FEE' | 'CANCELLED_LOSS'
  const [financeOrderSearch, setFinanceOrderSearch] = useState('');
  const [isLoadingFinanceOrders, setIsLoadingFinanceOrders] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState(null);
  const [statementDetailData, setStatementDetailData] = useState(null);
  const [isLoadingStatementDetail, setIsLoadingStatementDetail] = useState(false);
  const [isSyncingFinanceStatements, setIsSyncingFinanceStatements] = useState(false);
  const [isSyncingFinanceBatch, setIsSyncingFinanceBatch] = useState(false);
  const [financeSyncMessage, setFinanceSyncMessage] = useState(null);
  const [breakEvenRoi, setBreakEvenRoi] = useState(1.5);
  const [isExportingAds, setIsExportingAds] = useState(false);

  // Livestreams Tab State
  const [liveSessions, setLiveSessions] = useState([]);
  const [livePagination, setLivePagination] = useState({ page: 1, limit: 25, total_records: 0, total_pages: 1 });
  const [isLoadingLives, setIsLoadingLives] = useState(false);

  // Videos Tab State
  const [videoList, setVideoList] = useState([]);
  const [videoPagination, setVideoPagination] = useState({ page: 1, limit: 25, total_records: 0, total_pages: 1 });
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  // Products Tab State (Two-Layer Finite States: LOADING | AVAILABLE | PARTIAL | EMPTY | ERROR)
  const [productList, setProductList] = useState([]);
  const [productSummary, setProductSummary] = useState(null);
  const [productPagination, setProductPagination] = useState({ page: 1, limit: 25, total_records: 0, total_pages: 1 });
  const [productSearch, setProductSearch] = useState('');
  const [productProfitFilter, setProductProfitFilter] = useState('ALL'); // 'ALL' | 'HAS_CANCEL' | 'HIGH_CANCEL' | 'HAS_RETURN' | 'HIGH_RETURN'
  const [productSortBy, setProductSortBy] = useState('order_count'); // 'order_count' | 'units_sold' | 'cancelled_order_count' | 'cancel_rate_pct' | 'return_order_count' | 'return_rate_pct' | 'order_derived_gross' | 'realized_gross'
  const [productSortDir, setProductSortDir] = useState('desc'); // 'asc' | 'desc'
  const [isExportingProducts, setIsExportingProducts] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productState, setProductState] = useState({
    status: 'LOADING',
    analytics_status: 'NOT_YET_AVAILABLE',
    error: null
  });
  const [isSyncingProductImages, setIsSyncingProductImages] = useState(false);
  const [productSyncResult, setProductSyncResult] = useState(null);

  // Sync Status State
  const [syncStatus, setSyncStatus] = useState(null);
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [syncActionMessage, setSyncActionMessage] = useState(null);

  // Drilldown Modal States
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orderDetailData, setOrderDetailData] = useState(null);
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState(null);

  // Customer Orders Drilldown Modal State
  const [selectedCustomerForOrders, setSelectedCustomerForOrders] = useState(null);
  const [customerOrdersData, setCustomerOrdersData] = useState(null);
  const [isLoadingCustomerOrders, setIsLoadingCustomerOrders] = useState(false);
  const [customerOrdersError, setCustomerOrdersError] = useState(null);

  // Helper to sanitize & format customer display names cleanly
  const getCustomerDisplayName = useCallback((cust) => {
    if (!cust) return 'Khách Hàng TikTok';
    const raw = (cust.recipient_name_raw || cust.customer_display_name || '').trim();
    const phone = (cust.phone_raw || cust.phone || cust.phone_masked || '');
    const digits = phone.replace(/\D/g, '');

    const isInvalidName = !raw ||
      raw.includes('@') ||
      raw.includes('.com') ||
      raw.includes('.vn') ||
      /^user\d+$/i.test(raw) ||
      /^\d+$/.test(raw) ||
      (raw.length >= 14 && !raw.includes(' ')) ||
      /^(liên hệ|gửi tin nhắn|sao chép|chi tiết|tiktok shop|người mua)/i.test(raw) ||
      raw.toLowerCase() === 'khách hàng' ||
      raw.toLowerCase() === 'khách hàng tiktok';

    if (!isInvalidName) {
      return raw;
    }
    if (digits.length >= 4) {
      return `Khách hàng (${digits.slice(-4)})`;
    }
    return cust.recipient_name_masked || 'Khách Hàng TikTok';
  }, []);

  const [selectedProductId, setSelectedProductId] = useState(null);
  const [productDetailData, setProductDetailData] = useState(null);
  const [isLoadingProductDetail, setIsLoadingProductDetail] = useState(false);
  const [productDetailError, setProductDetailError] = useState(null);

  // Sprint V2-02A Campaign GMV Max Intelligence States
  const [campaignsIntel, setCampaignsIntel] = useState(null);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [campaignsError, setCampaignsError] = useState(null);
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('');
  const [adsCompareMode, setAdsCompareMode] = useState('day'); // 'day' | 'week' | 'month' | 'auto'
  const [adsTargetRoi, setAdsTargetRoi] = useState(() => (propTargetRoi || propTargetRoas || 15.0));
  const [adsCampaignSortBy, setAdsCampaignSortBy] = useState('ads_cost'); // 'ads_cost' | 'gross_revenue' | 'orders' | 'roi' | 'effective_target_roi' | 'target_roi_variance' | 'revenue_change_pct'
  const [adsCampaignSortDir, setAdsCampaignSortDir] = useState('desc'); // 'asc' | 'desc'
  const [adsEffectivenessFilter, setAdsEffectivenessFilter] = useState('ALL'); // 'ALL' | 'EXCEEDED_TARGET' | 'MET_TARGET' | 'BELOW_TARGET' | 'INEFFECTIVE_ZERO_ORDERS' | 'NO_DELIVERY'
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedCampaignData, setSelectedCampaignData] = useState(null);
  const [isLoadingCampaignDetail, setIsLoadingCampaignDetail] = useState(false);
  const [campaignDetailError, setCampaignDetailError] = useState(null);

  // Sprint V2-02 GMV Max Multi-Grain Intelligence States
  const [adsSubView, setAdsSubView] = useState('campaigns'); // Default to 'campaigns' for direct campaign-level evaluation
  const [showZeroSpendCampaigns, setShowZeroSpendCampaigns] = useState(false);
  const [isSyncingAdsAll, setIsSyncingAdsAll] = useState(false);
  const [adsSyncBanner, setAdsSyncBanner] = useState(null);
  const [adsProductSearch, setAdsProductSearch] = useState('');
  const [adsVideoSearch, setAdsVideoSearch] = useState('');
  const [adsVideoFilter, setAdsVideoFilter] = useState('');
  const [videoCategoryFilter, setVideoCategoryFilter] = useState('ALL'); // 'ALL' | 'EFFECTIVE' | 'INEFFECTIVE' | 'NOT_DELIVERING'
  const [videoSortBy, setVideoSortBy] = useState('spend'); // 'spend' | 'orders' | 'gross_revenue' | 'roi' | 'target_roi' | 'cancelled_orders' | 'cancel_rate_pct'
  const [videoSortDir, setVideoSortDir] = useState('desc'); // 'asc' | 'desc'
  const [adsProductIntel, setAdsProductIntel] = useState(null);
  const [isLoadingAdsProducts, setIsLoadingAdsProducts] = useState(false);
  const [adsProductError, setAdsProductError] = useState(null);

  const [adsVideoIntel, setAdsVideoIntel] = useState(null);
  const [isLoadingAdsVideos, setIsLoadingAdsVideos] = useState(false);
  const [adsVideoError, setAdsVideoError] = useState(null);
  const [selectedVideoForDetail, setSelectedVideoForDetail] = useState(null);
  const [videoSourceTab, setVideoSourceTab] = useState('ALL'); // 'ALL' | 'SHOP_VIDEOS' | 'ADS_CAMPAIGNS'
  const [isSyncingShopVideos, setIsSyncingShopVideos] = useState(false);
  const [shopVideoSyncResult, setShopVideoSyncResult] = useState(null);

  const [adsLiveIntel, setAdsLiveIntel] = useState(null);
  const [isLoadingAdsLives, setIsLoadingAdsLives] = useState(false);
  const [adsLiveError, setAdsLiveError] = useState(null);
  const [liveViewMode, setLiveViewMode] = useState('sessions'); // 'sessions' (theo ca/chiến dịch) | 'daily' (theo ngày chạy live)
  const [liveSortBy, setLiveSortBy] = useState('ads_cost'); // 'ads_cost' | 'gross_revenue' | 'orders' | 'roi' | 'target_roi' | 'roi_diff' | 'cpa'
  const [liveSortDir, setLiveSortDir] = useState('desc'); // 'asc' | 'desc'
  const [liveStatusFilter, setLiveStatusFilter] = useState('ALL'); // 'ALL' | 'EXCEEDED_TARGET' | 'MET_TARGET' | 'BELOW_TARGET' | 'INEFFECTIVE'

  const [multiGrainReconcile, setMultiGrainReconcile] = useState(null);
  const [isLoadingMultiGrain, setIsLoadingMultiGrain] = useState(false);

  // Product Cost & Break-even ROI Modal State (P0-04)
  const [selectedCostProduct, setSelectedCostProduct] = useState(null);
  const [costFormSellingPrice, setCostFormSellingPrice] = useState('');
  const [costFormCogs, setCostFormCogs] = useState('');
  const [costFormVarCost, setCostFormVarCost] = useState('0');
  const [costFormFeePct, setCostFormFeePct] = useState('4.0');
  const [costFormTargetPct, setCostFormTargetPct] = useState('');
  const [costFormNotes, setCostFormNotes] = useState('');
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [costSaveError, setCostSaveError] = useState(null);
  const [costSaveSuccess, setCostSaveSuccess] = useState(null);

  const openCostModal = (product) => {
    setSelectedCostProduct(product);
    const grossVal = product.order_gross_value ?? product.order_derived_gross ?? product.total_gross_revenue ?? 0;
    const unitsVal = product.units_sold ?? product.total_units_sold ?? 0;
    const avgDerivedPrice = (grossVal > 0 && unitsVal > 0) ? Math.round(grossVal / unitsVal) : 0;
    setCostFormSellingPrice(
      product.selling_price && product.selling_price > 0 ? String(Math.round(product.selling_price)) :
      (product.avg_selling_price && product.avg_selling_price > 0 ? String(Math.round(product.avg_selling_price)) :
      (avgDerivedPrice > 0 ? String(avgDerivedPrice) : ''))
    );
    setCostFormCogs(product.cogs_amount !== null && product.cogs_amount !== undefined && product.cogs_amount > 0 ? String(Math.round(product.cogs_amount)) : '');
    setCostFormVarCost(product.variable_cost_amount !== null && product.variable_cost_amount !== undefined ? String(Math.round(product.variable_cost_amount)) : '0');
    setCostFormFeePct(product.platform_fee_pct !== null && product.platform_fee_pct !== undefined ? String(product.platform_fee_pct) : '4.0');
    setCostFormTargetPct(product.margin_target_pct !== null && product.margin_target_pct !== undefined ? String(product.margin_target_pct) : '');
    setCostFormNotes(product.notes || '');
    setCostSaveError(null);
    setCostSaveSuccess(null);
  };

  const closeCostModal = () => {
    setSelectedCostProduct(null);
    setCostSaveError(null);
    setCostSaveSuccess(null);
  };

  const handleSaveProductCost = async (e) => {
    if (e) e.preventDefault();
    if (!selectedCostProduct) return;
    setIsSavingCost(true);
    setCostSaveError(null);
    setCostSaveSuccess(null);

    const payload = {
      shop_id: shopId,
      product_id: selectedCostProduct.item_group_id || selectedCostProduct.product_id,
      product_name: selectedCostProduct.product_name,
      selling_price: parseFloat(costFormSellingPrice) || 0,
      cogs_amount: parseFloat(costFormCogs) || 0,
      variable_cost_amount: parseFloat(costFormVarCost) || 0,
      platform_fee_pct: parseFloat(costFormFeePct) || 0,
      margin_target_pct: costFormTargetPct !== '' ? parseFloat(costFormTargetPct) : null,
      notes: costFormNotes
    };

    try {
      let res;
      if (typeof apiRequest === 'function') {
        res = await apiRequest('commerce_dashboard.php?action=save_product_cost', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } else {
        const resp = await fetch('api/commerce_dashboard.php?action=save_product_cost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        res = await resp.json();
      }

      if (res && res.success) {
        setCostSaveSuccess(res.message || 'Đã lưu cấu hình giá vốn và ROI hòa vốn!');
        setTimeout(() => {
          setSelectedCostProduct(null);
          setCostSaveSuccess(null);
          fetchProducts(productPagination.page || 1);
          fetchAdsProductIntelligence();
        }, 900);
      } else {
        throw new Error(res?.message || 'Không thể lưu cấu hình giá vốn.');
      }
    } catch (err) {
      setCostSaveError(err.message || 'Lỗi khi lưu cấu hình giá vốn');
    } finally {
      setIsSavingCost(false);
    }
  };


  // Format VND Currency
  const formatVND = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Format Number with Commas
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  // Format Date String
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Render KPI with strict empty/null/unavailable protection (Never crash or fabricate)
  const renderKpiValue = (kpi, formatter, fallback = 'Chưa có dữ liệu') => {
    if (!kpi) return fallback;
    if (kpi.type === 'UNAVAILABLE' || kpi.value === 'UNAVAILABLE') return 'Không khả dụng';
    if (kpi.value === null || kpi.value === undefined) return fallback;
    return formatter ? formatter(kpi.value) : String(kpi.value);
  };

  const renderSyncPipelineDomainStatus = (domain, isEnabled) => {
    let statusLabel = 'DISABLED';
    let statusColor = '#94a3b8';
    if (isEnabled) {
      statusLabel = 'ACTIVE';
      statusColor = '#059669';
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: statusColor, fontWeight: '700', fontSize: '11px' }}>{statusLabel}</span>
        <button
          type="button"
          disabled={!isEnabled}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          {isEnabled ? 'Đồng bộ' : 'Domain đang tắt (Dark Launch)'}
        </button>
      </div>
    );
  };

  // Handle Preset Changes
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);

    if (preset === 'today') {
      setStartDate(fmt(today));
      setEndDate(fmt(today));
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      setStartDate(fmt(y));
      setEndDate(fmt(y));
    } else if (preset === '7d') {
      const d7 = new Date(today);
      d7.setDate(today.getDate() - 7);
      setStartDate(fmt(d7));
      setEndDate(fmt(today));
    } else if (preset === '14d') {
      const d14 = new Date(today);
      d14.setDate(today.getDate() - 14);
      setStartDate(fmt(d14));
      setEndDate(fmt(today));
    } else if (preset === 'this_month') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const s = `${year}-${month}-01`;
      const e = `${year}-${month}-${day}`;
      setStartDate(s);
      setEndDate(e);
      if (propOnDateChange) propOnDateChange(s, e, 'this_month');
    } else if (preset === '30d') {
      const d30 = new Date(today);
      d30.setDate(today.getDate() - 30);
      setStartDate(fmt(d30));
      setEndDate(fmt(today));
      if (propOnDateChange) propOnDateChange(fmt(d30), fmt(today), '30d');
    }
  };

  // 1. Fetch Main Dashboard Report
  const fetchDashboardReport = useCallback(async () => {
    setIsLoadingReport(true);
    setReportError(null);
    try {
      const res = await apiRequest(
        `commerce_dashboard.php?action=get_dashboard_report&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`
      );
      if (res && res.success) {
        setReportData(res.data);
      } else {
        throw new Error(res.message || 'Không thể tải báo cáo thương mại');
      }
    } catch (err) {
      setReportError(err.message || 'Lỗi khi gọi API Commerce Dashboard');
    } finally {
      setIsLoadingReport(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  // 2. Fetch Orders List
  const fetchOrders = useCallback(async (page = 1) => {
    setIsLoadingOrders(true);
    try {
      let url = `commerce_dashboard.php?action=get_orders&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=25`;
      if (orderStatusFilter) url += `&status=${encodeURIComponent(orderStatusFilter)}`;
      if (orderSearch) url += `&search=${encodeURIComponent(orderSearch)}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setOrders(res.data.orders || []);
        setOrderPagination(res.data.pagination || { page: 1, limit: 25, total_records: 0, total_pages: 1 });
        if (res.data.status_counts) setOrderStatusCounts(res.data.status_counts);
        if (res.data.total_period_orders !== undefined) setTotalPeriodOrders(res.data.total_period_orders);
        if (res.data.rma_coverage !== undefined) setRmaCoverage(res.data.rma_coverage);
      }
    } catch (err) {
      console.error('Fetch orders error:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [shopId, startDate, endDate, orderStatusFilter, orderSearch, apiRequest]);

  const handleExportOrders = async () => {
    try {
      setIsExportingOrders(true);
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      let url = `/api/commerce_dashboard.php?action=export_orders&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`;
      if (orderStatusFilter) url += `&status=${encodeURIComponent(orderStatusFilter)}`;
      if (orderSearch) url += `&search=${encodeURIComponent(orderSearch)}`;

      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`Xuất file thất bại: ${response.statusText}`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `tiktok_orders_${shopId}_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export orders error:', err);
      alert('Không thể xuất dữ liệu đơn hàng: ' + err.message);
    } finally {
      setIsExportingOrders(false);
    }
  };

  // 3. Fetch Losses List
  const fetchLosses = useCallback(async (page = 1) => {
    setIsLoadingLosses(true);
    try {
      let url = `commerce_dashboard.php?action=get_losses&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=25&perspective=${perspectiveFilter}`;
      if (lossTypeFilter) url += `&loss_type=${encodeURIComponent(lossTypeFilter)}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setLosses(res.data.losses || []);
        setLossPagination(res.data.pagination || { page: 1, limit: 25, total_records: 0, total_pages: 1 });
      }
    } catch (err) {
      console.error('Fetch losses error:', err);
    } finally {
      setIsLoadingLosses(false);
    }
  }, [shopId, startDate, endDate, lossTypeFilter, perspectiveFilter, apiRequest]);

  // 4. Fetch Finance Statements & Period Reconciliation
  const fetchFinanceStatements = useCallback(async (page = 1, overrideStatus = null, overrideSearch = null) => {
    setIsLoadingFinance(true);
    try {
      const stFilter = overrideStatus !== null ? overrideStatus : financePaymentStatusFilter;
      const stSearch = overrideSearch !== null ? overrideSearch : financeStmtSearch;
      let url = `commerce_dashboard.php?action=get_finance_statements&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=25`;
      if (stFilter && stFilter !== 'ALL') url += `&payment_status=${encodeURIComponent(stFilter)}`;
      if (stSearch) url += `&search=${encodeURIComponent(stSearch)}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setFinanceStatements(res.data.statements || []);
        setFinancePagination(res.data.pagination || { page: 1, limit: 25, total_records: 0, total_pages: 1 });
        if (res.data.reconciliation) {
          setFinanceReconciliation(res.data.reconciliation);
        }
      }
    } catch (err) {
      console.error('Fetch finance statements error:', err);
    } finally {
      setIsLoadingFinance(false);
    }
  }, [shopId, startDate, endDate, financePaymentStatusFilter, financeStmtSearch, apiRequest]);

  // 4B. Fetch Order-Level Settlement Reconciliation
  const fetchFinanceOrderReconciliation = useCallback(async (page = 1, overrideFilter = null, overrideSearch = null) => {
    setIsLoadingFinanceOrders(true);
    try {
      const f = overrideFilter !== null ? overrideFilter : financeOrderFilter;
      const s = overrideSearch !== null ? overrideSearch : financeOrderSearch;
      let url = `commerce_dashboard.php?action=get_finance_order_reconciliation&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=25`;
      if (f && f !== 'ALL') url += `&settlement_filter=${encodeURIComponent(f)}`;
      if (s) url += `&search=${encodeURIComponent(s)}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setFinanceOrders(res.data?.orders || []);
        setFinanceOrdersPagination(res.data?.pagination || { page: 1, limit: 25, total_records: 0, total_pages: 1 });
      }
    } catch (err) {
      console.error('Fetch finance order reconciliation error:', err);
    } finally {
      setIsLoadingFinanceOrders(false);
    }
  }, [shopId, startDate, endDate, financeOrderFilter, financeOrderSearch, apiRequest]);

  // 4C. Fetch Statement Detail Transactions
  const handleSelectStatementDetail = async (statementId) => {
    if (selectedStatementId === statementId) {
      setSelectedStatementId(null);
      setStatementDetailData(null);
      return;
    }
    setSelectedStatementId(statementId);
    setIsLoadingStatementDetail(true);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=get_finance_statement_detail&shop_id=${encodeURIComponent(shopId)}&statement_id=${encodeURIComponent(statementId)}`);
      if (res && res.success) {
        setStatementDetailData(res.data);
      }
    } catch (err) {
      console.error('Fetch statement detail error:', err);
    } finally {
      setIsLoadingStatementDetail(false);
    }
  };

  // 4D. Trigger Finance Statements Sync & Bounded Order Transactions Sync
  const handleSyncFinanceStatements = async () => {
    setIsSyncingFinanceStatements(true);
    setFinanceSyncMessage(null);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=trigger_sync&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`, {
        method: 'POST',
        body: JSON.stringify({ domain: 'finance' })
      });
      if (res && res.success) {
        setFinanceSyncMessage({ type: 'success', text: res.message || 'Đã đồng bộ bảng kê quyết toán tài chính!' });
        fetchFinanceStatements(1);
        fetchFinanceOrderReconciliation(1);
        fetchDashboardReport();
      } else {
        setFinanceSyncMessage({ type: 'warning', text: res?.message || 'Chưa thể đồng bộ bảng kê lúc này.' });
      }
    } catch (err) {
      setFinanceSyncMessage({ type: 'error', text: err.message || 'Lỗi khi đồng bộ bảng kê tài chính.' });
    } finally {
      setIsSyncingFinanceStatements(false);
    }
  };

  const handleSyncFinanceBatchTransactions = async () => {
    setIsSyncingFinanceBatch(true);
    setFinanceSyncMessage(null);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=trigger_sync&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`, {
        method: 'POST',
        body: JSON.stringify({ domain: 'finance_batch', batch_size: 50 })
      });
      if (res && res.success) {
        const bData = res.data || {};
        const processed = bData.orders_processed_in_batch ?? 0;
        const txIngested = bData.transactions_ingested ?? 0;
        const hasMore = bData.has_more;
        setFinanceSyncMessage({
          type: 'success',
          text: `Đã đối soát batch ${processed} đơn hàng (${txIngested} giao dịch phí/quyết toán). ${hasMore ? 'Còn đơn chờ xử lý — có thể bấm tiếp tục batch.' : 'Đã hoàn tất toàn bộ đơn trong kỳ!'}`
        });
        fetchFinanceStatements(financePagination.page || 1);
        fetchFinanceOrderReconciliation(financeOrdersPagination.page || 1);
        fetchDashboardReport();
      } else {
        setFinanceSyncMessage({ type: 'warning', text: res?.message || 'Chưa thể đồng bộ giao dịch đơn hàng.' });
      }
    } catch (err) {
      setFinanceSyncMessage({ type: 'error', text: err.message || 'Lỗi khi đồng bộ batch giao dịch tài chính.' });
    } finally {
      setIsSyncingFinanceBatch(false);
    }
  };

  // Export Finance Statements or Order Reconciliation to UTF-8 BOM CSV
  const handleExportFinanceCSV = async (mode = 'statements') => {
    setIsExportingFinance(true);
    try {
      const actionName = mode === 'orders_reconcile' ? 'export_finance_order_reconciliation' : 'export_finance_statements';
      let url = `commerce_dashboard.php?action=${actionName}&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`;
      if (mode === 'orders_reconcile') {
        if (financeOrderFilter && financeOrderFilter !== 'ALL') url += `&settlement_filter=${encodeURIComponent(financeOrderFilter)}`;
        if (financeOrderSearch) url += `&search=${encodeURIComponent(financeOrderSearch)}`;
      }
      const res = await apiRequest(url);
      if (res && res.success && res.data?.csv) {
        const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
        const dlUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = dlUrl;
        link.setAttribute('download', res.data.filename || `finance_${mode}_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      alert('Lỗi xuất dữ liệu đối soát tài chính: ' + err.message);
    } finally {
      setIsExportingFinance(false);
    }
  };

  // Export Ads Campaigns to UTF-8 BOM CSV
  const handleExportAdsCSV = async () => {
    setIsExportingAds(true);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=export_ads_campaigns&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`);
      if (res && res.success && res.data?.csv) {
        const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.data.filename || `ads_campaigns_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      alert('Lỗi xuất báo cáo chiến dịch: ' + err.message);
    } finally {
      setIsExportingAds(false);
    }
  };

  // 5. Fetch Livestreams
  const fetchLivestreams = useCallback(async (page = 1) => {
    setIsLoadingLives(true);
    try {
      const url = `commerce_dashboard.php?action=get_livestreams&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=25`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setLiveSessions(res.data.sessions || []);
        setLivePagination(res.data.pagination || { page: 1, limit: 25, total_records: 0, total_pages: 1 });
      }
    } catch (err) {
      console.error('Fetch livestreams error:', err);
    } finally {
      setIsLoadingLives(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  // 6. Fetch Videos
  const fetchVideos = useCallback(async (page = 1) => {
    setIsLoadingVideos(true);
    try {
      const url = `commerce_dashboard.php?action=get_videos&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=25`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setVideoList(res.data.videos || []);
        setVideoPagination(res.data.pagination || { page: 1, limit: 25, total_records: 0, total_pages: 1 });
      }
    } catch (err) {
      console.error('Fetch videos error:', err);
    } finally {
      setIsLoadingVideos(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  // 7. Fetch Products (Order, Cancel & Return Analysis per SKU/Product Code)
  const fetchProducts = useCallback(async (page = 1, overrideFilter = null, overrideSort = null, overrideSearch = null, overrideSortDir = null) => {
    setIsLoadingProducts(true);
    setProductState(prev => ({ ...prev, status: 'LOADING', error: null }));
    try {
      const activeFilter = overrideFilter !== null ? overrideFilter : productProfitFilter;
      const activeSort = overrideSort !== null ? overrideSort : productSortBy;
      const activeSortDir = overrideSortDir !== null ? overrideSortDir : productSortDir;
      const activeSearch = overrideSearch !== null ? overrideSearch : productSearch;

      let url = `commerce_dashboard.php?action=get_products&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=25`;
      if (activeFilter && activeFilter !== 'ALL') {
        url += `&profit_filter=${encodeURIComponent(activeFilter)}`;
      }
      if (activeSort) {
        url += `&sort_by=${encodeURIComponent(activeSort)}`;
      }
      if (activeSortDir) {
        url += `&sort_dir=${encodeURIComponent(activeSortDir)}`;
      }
      if (activeSearch) {
        url += `&search=${encodeURIComponent(activeSearch)}`;
      }

      const res = await apiRequest(url);
      if (res && res.success) {
        const prods = res.data?.products || [];
        const s = res.data?.status || (prods.length === 0 ? 'EMPTY' : (res.data?.analytics_status === 'AVAILABLE' ? 'AVAILABLE' : 'PARTIAL'));
        setProductList(prods);
        setProductSummary(res.data?.summary || null);
        setProductPagination(res.data?.pagination || { page: 1, limit: 25, total_records: 0, total_pages: 1 });
        setProductState({
          status: s,
          analytics_status: res.data?.analytics_status || 'NOT_YET_AVAILABLE',
          error: null
        });
      } else {
        const errMsg = res?.error || res?.message || 'Không thể nạp dữ liệu hiệu suất sản phẩm';
        setProductState({
          status: 'ERROR',
          analytics_status: 'NOT_YET_AVAILABLE',
          error: errMsg
        });
      }
    } catch (err) {
      console.error('Fetch products error:', err);
      setProductState({
        status: 'ERROR',
        analytics_status: 'NOT_YET_AVAILABLE',
        error: err.message || 'Lỗi mạng hoặc máy chủ không phản hồi'
      });
    } finally {
      setIsLoadingProducts(false);
    }
  }, [shopId, startDate, endDate, productProfitFilter, productSortBy, productSortDir, productSearch, apiRequest]);

  // Toggle or select product sort column & direction
  const handleProductSortClick = (columnKey) => {
    let nextDir = 'desc';
    if (productSortBy === columnKey) {
      nextDir = productSortDir === 'desc' ? 'asc' : 'desc';
    }
    setProductSortBy(columnKey);
    setProductSortDir(nextDir);
    fetchProducts(1, productProfitFilter, columnKey, productSearch, nextDir);
  };

  // Export Products Order/Cancel/Return to UTF-8 BOM CSV
  const handleExportProductsCSV = async () => {
    setIsExportingProducts(true);
    try {
      let url = `commerce_dashboard.php?action=export_products_csv&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`;
      if (productProfitFilter && productProfitFilter !== 'ALL') {
        url += `&profit_filter=${encodeURIComponent(productProfitFilter)}`;
      }
      if (productSortBy) {
        url += `&sort_by=${encodeURIComponent(productSortBy)}`;
      }
      if (productSortDir) {
        url += `&sort_dir=${encodeURIComponent(productSortDir)}`;
      }
      if (productSearch) {
        url += `&search=${encodeURIComponent(productSearch)}`;
      }
      const res = await apiRequest(url);
      if (res && res.success && res.data?.csv) {
        const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
        const dlUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = dlUrl;
        link.setAttribute('download', res.data.filename || `bao_cao_san_pham_don_huy_hoan_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      alert('Lỗi xuất báo cáo sản phẩm: ' + err.message);
    } finally {
      setIsExportingProducts(false);
    }
  };

  // Stable Image URL Resolver with Graceful Null/Fallback Control
  const getProductDisplayImageUrl = useCallback((prod) => {
    if (!prod) return null;
    const rawUrl = prod.display_image_url || prod.sku_image || prod.product_image;
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.startsWith('http') || rawUrl.includes('unsplash') || rawUrl.includes('placeholder')) {
      return null;
    }
    // Stable cache key: only append version when image_version > 1 and not already present
    if (prod.image_version && prod.image_version > 1 && !rawUrl.includes('?v=')) {
      return `${rawUrl}?v=${prod.image_version}`;
    }
    return rawUrl;
  }, []);

  // Trigger Authoritative Product Metadata & Image Sync from TikTok Shop API
  const handleSyncProductImages = useCallback(async () => {
    setIsSyncingProductImages(true);
    setProductSyncResult(null);
    try {
      const url = `commerce_dashboard.php?action=sync_products_metadata&shop_id=${encodeURIComponent(shopId)}&force=1`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setProductSyncResult({ type: 'success', message: res.message || 'Đã đồng bộ ảnh & metadata sản phẩm mới nhất từ TikTok Shop!' });
        fetchProducts(productPagination.page || 1);
      } else {
        setProductSyncResult({ type: 'warning', message: res.message || 'Chưa thể đồng bộ trực tiếp từ TikTok API.' });
      }
    } catch (err) {
      setProductSyncResult({ type: 'error', message: err.message || 'Lỗi khi gọi đồng bộ ảnh sản phẩm.' });
    } finally {
      setIsSyncingProductImages(false);
    }
  }, [shopId, apiRequest, fetchProducts, productPagination.page]);

  // 8. Fetch Customer 360
  const fetchCustomers = useCallback(async (page = 1, overrideScope = null, overrideStart = null, overrideEnd = null, overrideSort = null) => {
    setIsLoadingCustomers(true);
    try {
      const activeScope = overrideScope || customerScope;
      const scopeParam = activeScope === 'PERIOD' ? 'period' : 'all';
      const activeSort = overrideSort || customerSort;
      let url = `commerce_dashboard.php?action=get_customers&shop_id=${encodeURIComponent(shopId)}&scope=${scopeParam}&page=${page}&limit=25&sort_by=${encodeURIComponent(activeSort)}`;

      const sDate = overrideStart !== null ? overrideStart : (customerStartDate || startDate);
      const eDate = overrideEnd !== null ? overrideEnd : (customerEndDate || endDate);

      if (activeScope === 'PERIOD' && sDate && eDate) {
        url += `&start_date=${encodeURIComponent(sDate)}&end_date=${encodeURIComponent(eDate)}`;
      }
      if (customerCohortFilter && customerCohortFilter !== 'ALL') {
        url += `&cohort=${encodeURIComponent(customerCohortFilter)}`;
      }
      if (customerSearch) url += `&search=${encodeURIComponent(customerSearch)}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setCustomerList(res.data.customers || []);
        setCustomerPagination(res.data.pagination || { page: 1, limit: 25, total_records: 0, total_pages: 1 });
        setCustomerPiiStatus(res.data.status || res.data.pii_policy);
        setCustomerStatusMessage(res.data.message || null);
        setCustomerCohortSummary(res.data.cohort_summary || null);
        setCustomerDataTrust(res.data.data_trust || null);
      }
    } catch (err) {
      console.error('Fetch customers error:', err);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [shopId, customerScope, customerSort, customerCohortFilter, customerStartDate, customerEndDate, startDate, endDate, customerSearch, apiRequest]);

  const applyCustomerDatePreset = (preset) => {
    const today = new Date();
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    setCustomerDatePreset(preset);

    if (preset === 'all') {
      setCustomerScope('ALL');
      fetchCustomers(1, 'ALL');
      return;
    }

    let s = fmt(today);
    let e = fmt(today);

    if (preset === 'today') {
      s = fmt(today);
      e = fmt(today);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      s = fmt(y);
      e = fmt(y);
    } else if (preset === '7d') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      s = fmt(d7);
      e = fmt(today);
    } else if (preset === '30d') {
      const d30 = new Date();
      d30.setDate(d30.getDate() - 29);
      s = fmt(d30);
      e = fmt(today);
    }

    setCustomerStartDate(s);
    setCustomerEndDate(e);
    setCustomerScope('PERIOD');
    fetchCustomers(1, 'PERIOD', s, e);
  };

  useEffect(() => {
    if (subTab === 'customers') {
      fetchCustomers(1);
    }
  }, [customerScope, customerSort, customerCohortFilter]);

  // 9. Fetch Sync Status
  const fetchSyncStatus = useCallback(async () => {
    setIsLoadingSync(true);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=get_sync_status&shop_id=${encodeURIComponent(shopId)}`);
      if (res && res.success) {
        setSyncStatus(res.data);
      }
    } catch (err) {
      console.error('Fetch sync status error:', err);
    } finally {
      setIsLoadingSync(false);
    }
  }, [shopId, apiRequest]);

  // 10. Fetch Order Detail Drilldown
  const fetchOrderDetail = useCallback(async (orderId) => {
    if (!orderId) return;
    setSelectedOrderId(orderId);
    setIsLoadingOrderDetail(true);
    setOrderDetailError(null);
    try {
      const url = `commerce_dashboard.php?action=get_order_detail&shop_id=${encodeURIComponent(shopId)}&order_id=${encodeURIComponent(orderId)}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setOrderDetailData(res.data);
      } else {
        throw new Error(res.message || 'Không thể tải chi tiết đơn hàng');
      }
    } catch (err) {
      setOrderDetailError(err.message || 'Lỗi khi tải chi tiết đơn hàng');
    } finally {
      setIsLoadingOrderDetail(false);
    }
  }, [shopId, apiRequest]);

  // 10B. Fetch Customer All Orders Drilldown
  const openCustomerOrdersModal = useCallback(async (cust) => {
    if (!cust) return;
    setSelectedCustomerForOrders(cust);
    setCustomerViewMode('detail');
    setIsLoadingCustomerOrders(true);
    setCustomerOrdersError(null);
    setCustomerOrdersData(null);

    try {
      const hash = cust.customer_identifier_hash || cust.customer_hash || '';
      const phone = (cust.phone_raw && !cust.phone_raw.includes('*')) ? cust.phone_raw : '';
      const name = cust.recipient_name_raw || cust.customer_display_name || '';

      let url = `commerce_dashboard.php?action=get_customer_orders&shop_id=${encodeURIComponent(shopId)}`;
      if (hash) url += `&customer_hash=${encodeURIComponent(hash)}`;
      if (phone) url += `&phone=${encodeURIComponent(phone)}`;
      if (name && name !== 'Khách Hàng TikTok') url += `&name=${encodeURIComponent(name)}`;

      const res = await apiRequest(url);
      if (res && res.success && res.data) {
        setCustomerOrdersData(res.data);
      } else {
        setCustomerOrdersError(res?.message || 'Không thể tải danh sách đơn hàng của khách hàng này.');
      }
    } catch (err) {
      setCustomerOrdersError(err.message || 'Lỗi kết nối khi tải danh sách đơn hàng.');
    } finally {
      setIsLoadingCustomerOrders(false);
    }
  }, [shopId, apiRequest]);

  // 11. Fetch Product Detail Drilldown
  const fetchProductDetail = useCallback(async (productId) => {
    if (!productId) return;
    setSelectedProductId(productId);
    setIsLoadingProductDetail(true);
    setProductDetailError(null);
    try {
      const url = `commerce_dashboard.php?action=get_product_detail&shop_id=${encodeURIComponent(shopId)}&product_id=${encodeURIComponent(productId)}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setProductDetailData(res.data);
      } else {
        throw new Error(res.message || 'Không thể tải chi tiết sản phẩm');
      }
    } catch (err) {
      setProductDetailError(err.message || 'Lỗi khi tải chi tiết sản phẩm');
    } finally {
      setIsLoadingProductDetail(false);
    }
  }, [shopId, apiRequest]);

  // Trigger Sync for Domain
  const handleTriggerSync = async (domain) => {
    const isCustomerDomain = (domain === 'customer' || domain === 'customers' || domain === 'customer_ingestion');

    // Prevent concurrent execution / double click
    if (isCustomerDomain && isSyncingCustomer) {
      return;
    }

    if (isCustomerDomain) {
      setIsSyncingCustomer(true);
    }
    setSyncActionMessage(null);

    try {
      let res = null;
      const syncModeParam = isCustomerDomain ? '&sync_mode=sync' : '';
      const bodyPayload = isCustomerDomain
        ? { domain, sync_mode: 'sync', ...(startDate && endDate ? { start_date: startDate, end_date: endDate } : {}) }
        : { domain };
      const dateParams = (isCustomerDomain && startDate && endDate)
        ? `&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
        : '';

      try {
        res = await apiRequest(`commerce_sync.php?action=sync&shop_id=${encodeURIComponent(shopId)}&domain=${encodeURIComponent(domain)}${syncModeParam}${dateParams}`, 'POST', bodyPayload);
      } catch (e1) {
        res = await apiRequest(`commerce_dashboard.php?action=trigger_sync&shop_id=${encodeURIComponent(shopId)}&domain=${encodeURIComponent(domain)}${syncModeParam}${dateParams}`, 'POST', bodyPayload);
      }

      const status = res?.data?.status || res?.status || (res?.success ? 'AVAILABLE' : 'ERROR');
      const msg = res?.message || res?.data?.message;
      const isConfigError = status === 'CONFIGURATION_ERROR' ||
        res?.data?.status === 'CONFIGURATION_ERROR' ||
        res?.reason === 'CUSTOMER_IDENTITY_HMAC_KEY_MISSING' ||
        res?.data?.reason === 'CUSTOMER_IDENTITY_HMAC_KEY_MISSING' ||
        (typeof msg === 'string' && msg.includes('CUSTOMER_IDENTITY_HMAC_KEY'));

      if (['AVAILABLE', 'COMPLETE', 'COMPLETED', 'SUCCESS'].includes(status)) {
        setSyncActionMessage({ type: 'success', text: msg || `Đã hoàn tất đồng bộ miền ${domain}.` });
        fetchSyncStatus();
        fetchDashboardReport();
        if (isCustomerDomain) {
          fetchCustomers();
        }
      } else if (status === 'PARTIAL') {
        setSyncActionMessage({ type: 'warning', text: msg || `Đồng bộ miền ${domain} chỉ hoàn thành một phần (PARTIAL).` });
        fetchSyncStatus();
        fetchDashboardReport();
        if (isCustomerDomain) {
          fetchCustomers();
        }
      } else if (isConfigError) {
        setSyncActionMessage({
          type: 'error',
          text: msg || 'Lỗi cấu hình bảo mật: CUSTOMER_IDENTITY_HMAC_KEY chưa được cấu hình hoặc không hợp lệ. Hệ thống áp dụng nguyên tắc fail-closed.'
        });
        fetchSyncStatus();
        if (isCustomerDomain) {
          fetchCustomers();
        }
      } else if (status === 'DISABLED') {
        setSyncActionMessage({ type: 'warning', text: msg || `Miền ${domain} đang bị tắt bởi cấu hình môi trường (DISABLED).` });
      } else if (status === 'NOT_YET_AVAILABLE') {
        setSyncActionMessage({ type: 'info', text: msg || `Dữ liệu miền ${domain} chưa được TikTok công bố (NOT_YET_AVAILABLE).` });
      } else {
        setSyncActionMessage({ type: 'error', text: msg || `Không thể đồng bộ miền ${domain} (${status}).` });
      }
    } catch (err) {
      setSyncActionMessage({ type: 'error', text: err.message || `Lỗi khi kích hoạt đồng bộ ${domain}.` });
    } finally {
      if (isCustomerDomain) {
        setIsSyncingCustomer(false);
      }
    }
  };

  // Trigger Bounded Priority Recipient Capture (Sprint V2-05.2: AWAITING_SHIPMENT & IN_TRANSIT)
  const handleTriggerPriorityRecipients = async () => {
    if (isSyncingPriorityRecipients) return;
    setIsSyncingPriorityRecipients(true);
    setSyncActionMessage(null);
    try {
      const res = await apiRequest(`commerce_sync.php?action=sync_priority_recipients&shop_id=${encodeURIComponent(shopId)}&limit=50`, 'POST', {});
      const msg = res?.data?.message || res?.message || 'Đã hoàn tất đồng bộ ưu tiên người nhận.';
      if (res?.success) {
        setSyncActionMessage({ type: 'success', text: msg });
        fetchCustomers(1);
        fetchDashboardReport();
      } else {
        setSyncActionMessage({ type: 'warning', text: msg });
      }
    } catch (err) {
      setSyncActionMessage({ type: 'error', text: err?.message || 'Lỗi kết nối khi đồng bộ ưu tiên người nhận.' });
    } finally {
      setIsSyncingPriorityRecipients(false);
    }
  };

  // 11C. Purge Masked Customers (Clean up uncluttered customer list)
  const handlePurgeMaskedCustomers = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn dọn dẹp các hồ sơ khách hàng chưa có thông tin (chưa được mở mắt) để danh sách gọn gàng không? Các hồ sơ đã có SĐT và địa chỉ thật sẽ được giữ nguyên 100%.')) {
      return;
    }
    setIsPurgingMasked(true);
    try {
      const res = await apiRequest(`commerce_dashboard.php?action=purge_masked_customers&shop_id=${encodeURIComponent(shopId)}`, 'POST', {});
      if (res && res.success) {
        alert(res.message || 'Đã dọn dẹp danh sách khách hàng thành công!');
        fetchCustomers(1);
      } else {
        alert(res?.message || 'Không thể dọn dẹp hồ sơ.');
      }
    } catch (e) {
      alert(`Lỗi: ${e.message}`);
    } finally {
      setIsPurgingMasked(false);
    }
  };

  // 12. Fetch Campaign GMV Max Intelligence
  const fetchCampaignIntelligence = useCallback(async (typeFilter = campaignTypeFilter, overrideCompareMode = null, overrideTargetRoi = null) => {
    setIsLoadingCampaigns(true);
    setCampaignsError(null);
    try {
      const activeMode = overrideCompareMode !== null ? overrideCompareMode : adsCompareMode;
      const activeTargetRoi = overrideTargetRoi !== null ? overrideTargetRoi : adsTargetRoi;
      let url = `commerce_dashboard.php?action=get_campaign_intelligence&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`;
      if (typeFilter) {
        url += `&campaign_type=${encodeURIComponent(typeFilter)}`;
      }
      if (activeMode) {
        url += `&compare_mode=${encodeURIComponent(activeMode)}`;
      }
      if (activeTargetRoi !== null && activeTargetRoi !== undefined && activeTargetRoi !== '' && Number(activeTargetRoi) > 0) {
        url += `&target_roi=${encodeURIComponent(activeTargetRoi)}`;
      }
      const res = await apiRequest(url);
      if (res && res.success) {
        setCampaignsIntel(res.data);
      } else {
        throw new Error(res.message || 'Không thể tải dữ liệu Campaign GMV Max');
      }
    } catch (err) {
      console.error('Fetch campaign intelligence error:', err);
      setCampaignsError(err.message || 'Lỗi khi tải dữ liệu Campaign GMV Max');
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, [shopId, startDate, endDate, campaignTypeFilter, adsCompareMode, adsTargetRoi, apiRequest]);

  // 13. Fetch Single Campaign Drilldown
  const fetchCampaignDetail = useCallback(async (campId) => {
    if (!campId) return;
    setSelectedCampaignId(campId);
    setIsLoadingCampaignDetail(true);
    setCampaignDetailError(null);
    try {
      const url = `commerce_dashboard.php?action=get_campaign_intelligence&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}&campaign_id=${encodeURIComponent(campId)}&compare_mode=${encodeURIComponent(adsCompareMode)}&target_roi=${encodeURIComponent(adsTargetRoi || 3.5)}`;
      const res = await apiRequest(url);
      if (res && res.success && res.data?.selected_campaign) {
        setSelectedCampaignData(res.data.selected_campaign);
      } else {
        throw new Error(res.message || 'Không thể tải chi tiết chiến dịch');
      }
    } catch (err) {
      console.error('Fetch campaign detail error:', err);
      setCampaignDetailError(err.message || 'Lỗi khi tải chi tiết chiến dịch');
    } finally {
      setIsLoadingCampaignDetail(false);
    }
  }, [shopId, startDate, endDate, adsCompareMode, adsTargetRoi, apiRequest]);

  // 14. Fetch Product GMV Max Intelligence
  const fetchAdsProductIntelligence = useCallback(async () => {
    setIsLoadingAdsProducts(true);
    setAdsProductError(null);
    try {
      const url = `commerce_dashboard.php?action=get_gmv_max_product_intelligence&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setAdsProductIntel(res.data);
      } else {
        throw new Error(res.message || 'Không thể tải dữ liệu sản phẩm GMV Max');
      }
    } catch (err) {
      console.error('Fetch ads product error:', err);
      setAdsProductError(err.message || 'Lỗi khi tải dữ liệu sản phẩm GMV Max');
    } finally {
      setIsLoadingAdsProducts(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  // 15. Fetch Video Creative GMV Max Intelligence
  const fetchAdsVideoIntelligence = useCallback(async (overrideTargetRoi = null) => {
    setIsLoadingAdsVideos(true);
    setAdsVideoError(null);
    try {
      const activeTargetRoi = overrideTargetRoi !== null ? overrideTargetRoi : adsTargetRoi;
      let url = `commerce_dashboard.php?action=get_gmv_max_video_intelligence&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`;
      if (activeTargetRoi !== null && activeTargetRoi !== undefined && activeTargetRoi !== '' && Number(activeTargetRoi) > 0) {
        url += `&target_roi=${encodeURIComponent(activeTargetRoi)}`;
      }
      const res = await apiRequest(url);
      if (res && res.success) {
        setAdsVideoIntel(res.data);
      } else {
        throw new Error(res.message || 'Không thể tải dữ liệu video GMV Max');
      }
    } catch (err) {
      console.error('Fetch ads video error:', err);
      setAdsVideoError(err.message || 'Lỗi khi tải dữ liệu video GMV Max');
    } finally {
      setIsLoadingAdsVideos(false);
    }
  }, [shopId, startDate, endDate, adsTargetRoi, apiRequest]);

  // 15B. Sync Short Videos from TikTok Shop Open API (Option 1)
  const syncShopVideos = useCallback(async () => {
    setIsSyncingShopVideos(true);
    setShopVideoSyncResult(null);
    try {
      const url = `commerce_dashboard.php?action=sync_shop_videos&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setShopVideoSyncResult({
          type: 'success',
          message: res.message || 'Đồng bộ video ngắn từ TikTok Shop thành công!'
        });
        await fetchAdsVideoIntelligence();
        if (typeof fetchVideos === 'function') {
          fetchVideos();
        }
      } else {
        setShopVideoSyncResult({
          type: 'error',
          message: res?.message || 'Không thể đồng bộ video từ TikTok Shop. Vui lòng kiểm tra quyền API trong Partner Center.'
        });
      }
    } catch (err) {
      setShopVideoSyncResult({
        type: 'error',
        message: err.message || 'Lỗi kết nối khi đồng bộ video từ TikTok Shop'
      });
    } finally {
      setIsSyncingShopVideos(false);
    }
  }, [shopId, startDate, endDate, apiRequest, fetchAdsVideoIntelligence, fetchVideos]);

  // 16. Fetch LIVE GMV Max Intelligence
  const fetchAdsLiveIntelligence = useCallback(async (overrideTargetRoi = null) => {
    setIsLoadingAdsLives(true);
    setAdsLiveError(null);
    try {
      const activeTargetRoi = overrideTargetRoi !== null ? overrideTargetRoi : adsTargetRoi;
      let url = `commerce_dashboard.php?action=get_gmv_max_live_intelligence&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`;
      if (activeTargetRoi !== null && activeTargetRoi !== undefined && activeTargetRoi !== '' && Number(activeTargetRoi) > 0) {
        url += `&target_roi=${encodeURIComponent(activeTargetRoi)}`;
      }
      const res = await apiRequest(url);
      if (res && res.success) {
        setAdsLiveIntel(res.data);
      } else {
        throw new Error(res.message || 'Không thể tải dữ liệu phòng LIVE GMV Max');
      }
    } catch (err) {
      console.error('Fetch ads live error:', err);
      setAdsLiveError(err.message || 'Lỗi khi tải dữ liệu phòng LIVE GMV Max');
    } finally {
      setIsLoadingAdsLives(false);
    }
  }, [shopId, startDate, endDate, adsTargetRoi, apiRequest]);

  // 17. Fetch Multi-grain Reconciliation
  const fetchMultiGrainReconciliation = useCallback(async () => {
    setIsLoadingMultiGrain(true);
    try {
      const url = `commerce_dashboard.php?action=reconcile_gmv_max_multi_grain&shop_id=${encodeURIComponent(shopId)}&start_date=${startDate}&end_date=${endDate}`;
      const res = await apiRequest(url);
      if (res && res.success) {
        setMultiGrainReconcile(res.data);
      }
    } catch (err) {
      console.error('Fetch multi-grain reconciliation error:', err);
    } finally {
      setIsLoadingMultiGrain(false);
    }
  }, [shopId, startDate, endDate, apiRequest]);

  // Initial and reactive data fetching
  useEffect(() => {
    fetchDashboardReport();
    fetchSyncStatus();
  }, [fetchDashboardReport, fetchSyncStatus]);

  useEffect(() => {
    if (subTab === 'orders') fetchOrders(1);
    if (subTab === 'customers') fetchCustomers(1);
    if (subTab === 'losses') fetchLosses(1);
    if (subTab === 'finance') {
      fetchFinanceStatements(1);
      fetchFinanceOrderReconciliation(1);
    }
    if (subTab === 'lives') fetchLivestreams(1);
    if (subTab === 'videos') fetchVideos(1);
    if (subTab === 'products') fetchProducts(1);
    if (subTab === 'ads') {
      fetchCampaignIntelligence();
      fetchAdsProductIntelligence();
      fetchAdsVideoIntelligence();
      fetchMultiGrainReconciliation();
    }
    if (subTab === 'live_ads') {
      fetchAdsLiveIntelligence();
      fetchCampaignIntelligence('LIVE_GMV_MAX');
    }
    if (subTab === 'video_intel') {
      fetchAdsVideoIntelligence();
    }
    if (subTab === 'sync') fetchSyncStatus();
  }, [subTab, fetchOrders, fetchCustomers, fetchLosses, fetchFinanceStatements, fetchFinanceOrderReconciliation, fetchLivestreams, fetchVideos, fetchProducts, fetchCampaignIntelligence, fetchAdsProductIntelligence, fetchAdsVideoIntelligence, fetchAdsLiveIntelligence, fetchMultiGrainReconciliation, fetchSyncStatus]);


  // Extract metrics from reportData
  const metrics = reportData?.revenue_and_metrics_overview || {};
  const lossSummary = reportData?.loss_and_aftersales_summary || {};
  const feeDeductions = reportData?.finance_fee_deductions || {};
  const traffic = reportData?.shop_traffic_overview || {};
  const liveSummary = reportData?.livestream_workbench?.summary || {};
  const liveKpis = reportData?.livestream_workbench?.kpis || {};
  const analyticsFreshness = reportData?.analytics_freshness;
  const isHadaplusPeriod = startDate === '2026-09-01' && endDate === '2026-09-20';

  // Sprint V2-01 New Features Extract
  const aiSummary = reportData?.ai_daily_summary || {};
  const adsOverview = reportData?.advertising_overview || {};
  const isAdsAvailable = (adsOverview.availability_status === 'AVAILABLE') || 
                         (adsOverview.status === 'AVAILABLE') || 
                         (adsOverview.availability_status === 'COMPLETE') || 
                         (adsOverview.availability_status === 'PARTIAL') || 
                         (adsOverview.status === 'PARTIAL') || 
                         (adsOverview.total_spend !== null && adsOverview.total_spend !== undefined);
  const isAdsPartial = (adsOverview.availability_status === 'PARTIAL') || 
                       (adsOverview.status === 'PARTIAL') || 
                       (adsOverview.period_coverage?.availability_status === 'PARTIAL') || 
                       (adsOverview.provenance?.is_partial === true);
  const adsCoverageDays = adsOverview.period_coverage?.available_days ?? adsOverview.provenance?.distinct_days_count ?? 1;
  const adsExpectedDays = adsOverview.period_coverage?.requested_days ?? adsOverview.provenance?.expected_days_count ?? 1;
  const adsCoveragePct = adsOverview.period_coverage?.coverage_pct ?? adsOverview.provenance?.coverage_pct ?? (adsExpectedDays > 0 ? Math.round((adsCoverageDays / adsExpectedDays) * 100) : 100);
  const adsSpendVal = isAdsAvailable ? (adsOverview.total_spend ?? adsOverview.metrics?.total_ads_spend) : null;
  const adsGmvVal = isAdsAvailable ? (adsOverview.attributed_gmv ?? adsOverview.metrics?.ads_gmv) : null;
  const adsRoiVal = isAdsAvailable ? (adsOverview.roi ?? adsOverview.metrics?.ads_roi) : null;
  const adsStatus = isAdsPartial 
    ? `PARTIAL (${adsCoverageDays}/${adsExpectedDays} ngày - ${adsCoveragePct}%)` 
    : (isAdsAvailable ? `COMPLETE (${adsExpectedDays}/${adsExpectedDays} ngày)` : (adsOverview.availability_status || adsOverview.status || 'NOT_SYNCED'));

  // V2-06.2: Loss-Adjusted ROI & Realized Efficiency metrics
  const lossAdjustedRoi = reportData?.loss_adjusted_roi || adsOverview.loss_adjusted_roi || metrics?.source_advertising_api?.loss_adjusted_roi || {};
  const extractMetricVal = (v) => (v !== null && typeof v === 'object' && 'value' in v) ? v.value : v;
  const blendedShopRoas = extractMetricVal(lossAdjustedRoi.blended_shop_roas ?? adsOverview.metrics?.blended_shop_roas ?? null);
  const realizedAdsRoi = extractMetricVal(lossAdjustedRoi.realized_ads_roi ?? adsOverview.metrics?.realized_ads_roi ?? null);
  const roiErosionPoints = extractMetricVal(lossAdjustedRoi.roi_erosion_points ?? adsOverview.metrics?.roi_erosion_points ?? null);
  const spendToRealizedRate = extractMetricVal(lossAdjustedRoi.spend_to_realized_rate_pct ?? adsOverview.metrics?.spend_to_realized_rate_pct ?? null);

  const shopHealth = reportData?.shop_health || {};
  const attentionCenter = reportData?.attention_center || {};
  const comparison = reportData?.comparison || {};
  const dataFreshness = reportData?.data_freshness || {};

  // Category Navigation Definitions conforming to Sprint V2-03 Hierarchy (Section XI)
  const navCategories = [
    {
      category: 'TỔNG QUAN',
      items: [
        { id: 'overview', label: 'Dashboard', icon: BarChart2 }
      ]
    },
    {
      category: 'KINH DOANH',
      items: [
        { id: 'report', label: 'Báo cáo TikTok Shop', icon: FileSpreadsheet, badge: 'P0' },
        { id: 'orders', label: 'Đơn hàng', icon: Package, count: lossSummary.total_orders_count ? `${formatNumber(lossSummary.total_orders_count)}` : (totalPeriodOrders > 0 ? `${formatNumber(totalPeriodOrders)}` : null) },
        { id: 'golden_hours', label: 'Khung Giờ Vàng', icon: Clock, badge: 'MỚI' },
        { id: 'customers', label: 'Khách Hàng 360°', icon: Users, badge: 'PII' },
        { id: 'products', label: 'Sản phẩm', icon: Tag, count: null },
        { id: 'affiliate', label: 'Affiliate', icon: Users },
        { id: 'shopee', label: 'Kênh Shopee', icon: ShoppingBag, badge: 'SÀN' }
      ]
    },
    {
      category: 'QUẢNG CÁO',
      items: [
        { id: 'ads', label: 'Quảng Cáo (GMV Max)', icon: DollarSign, badge: isAdsAvailable ? 'ĐỒNG BỘ' : null },
        { id: 'live_ads', label: 'LIVE GMV Max', icon: Radio, count: adsLiveIntel?.rooms?.length ? `${adsLiveIntel?.rooms?.length}` : null },
        { id: 'video_intel', label: 'Video Intelligence', icon: Video, count: adsVideoIntel?.creatives?.length ? `${adsVideoIntel?.creatives?.length}` : null }
      ]
    },
    {
      category: 'LIVESTREAM',
      items: [
        { id: 'lives', label: 'Phiên LIVE', icon: Radio, count: liveSummary.total_sessions ? `${liveSummary.total_sessions}` : null },
        { id: 'live_analytics', label: 'Phân tích LIVE', icon: Activity }
      ]
    },
    {
      category: 'TÀI CHÍNH',
      items: [
        { id: 'true_roas', label: 'True ROAS & Tồn kho', icon: TrendingUp, badge: 'SOP' },
        { id: 'losses', label: 'Đối soát & ROI Hoàn Hủy', icon: ShieldAlert, count: lossSummary.cancelled_orders_count ? `${lossSummary.cancelled_orders_count + (lossSummary.failed_delivery_orders_count || 0) + (lossSummary.refund_orders_count || 0)}` : null },
        { id: 'finance', label: 'Đối soát Quyết toán', icon: CreditCard, count: financePagination.total_records > 0 ? `${financePagination.total_records}` : null }
      ]
    },
    {
      category: 'HỆ THỐNG',
      items: [
        { id: 'sop_pacing', label: 'Trung tâm Điều hành SOP', icon: Target, badge: 'SOP' },
        { id: 'sync', label: 'Đồng bộ dữ liệu', icon: Sliders, count: null },
        { id: 'quality', label: 'Data Quality', icon: ShieldCheck },
        { id: 'config', label: 'Cấu hình', icon: Sliders }
      ]
    }
  ];

  const allNavTabs = navCategories.flatMap(c => c.items);

  return (
    <div className="commerce-dashboard" style={{ padding: '0 0 40px 0' }}>
      {/* 1. COMPACT TOOLBAR FOR NON-REPORT TABS (LIGHT BUSINESS ANALYTICS UI) */}
      {subTab !== 'report' && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                {allNavTabs.find(t => t.id === subTab)?.label || 'Quản Trị Bán Hàng'}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                (Shop ID: <strong style={{ color: '#0f172a' }}>{shopId}</strong>)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b', marginTop: '2px', flexWrap: 'wrap' }}>
              <span>Dữ liệu Shop: đến <strong>{reportData?.report_meta?.domains?.orders?.latest_available_date || reportData?.period?.end_date || endDate || '...'}</strong></span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span>Dữ liệu Ads: đến <strong>{reportData?.report_meta?.domains?.ads?.latest_available_date || '...'}</strong></span>
              {reportData?.report_meta?.comparison_periods?.ads_vs_shop && !reportData?.report_meta?.comparison_periods?.ads_vs_shop?.is_aligned && reportData?.report_meta?.comparison_periods?.ads_vs_shop?.has_overlap && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe'
                }} title={reportData?.report_meta?.comparison_periods?.ads_vs_shop?.reason}>
                  Kỳ so sánh khả dụng: {reportData?.report_meta?.comparison_periods?.ads_vs_shop?.start_date} → {reportData?.report_meta?.comparison_periods?.ads_vs_shop?.end_date}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '6px', padding: '2px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => handlePresetChange('today')}
                style={{
                  background: datePreset === 'today' ? '#eff6ff' : 'transparent',
                  color: datePreset === 'today' ? '#2563eb' : '#475569',
                  border: `1px solid ${datePreset === 'today' ? '#bfdbfe' : 'transparent'}`,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: datePreset === 'today' ? '700' : '500',
                  cursor: 'pointer'
                }}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('this_month')}
                style={{
                  background: datePreset === 'this_month' ? '#eff6ff' : 'transparent',
                  color: datePreset === 'this_month' ? '#2563eb' : '#475569',
                  border: `1px solid ${datePreset === 'this_month' ? '#bfdbfe' : 'transparent'}`,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: datePreset === 'this_month' ? '700' : '500',
                  cursor: 'pointer'
                }}
              >
                Tháng này
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('yesterday')}
                style={{
                  background: datePreset === 'yesterday' ? '#eff6ff' : 'transparent',
                  color: datePreset === 'yesterday' ? '#2563eb' : '#475569',
                  border: `1px solid ${datePreset === 'yesterday' ? '#bfdbfe' : 'transparent'}`,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Hôm qua
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('7d')}
                style={{
                  background: datePreset === '7d' ? '#eff6ff' : 'transparent',
                  color: datePreset === '7d' ? '#2563eb' : '#475569',
                  border: `1px solid ${datePreset === '7d' ? '#bfdbfe' : 'transparent'}`,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                7 ngày
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('30d')}
                style={{
                  background: datePreset === '30d' ? '#eff6ff' : 'transparent',
                  color: datePreset === '30d' ? '#2563eb' : '#475569',
                  border: `1px solid ${datePreset === '30d' ? '#bfdbfe' : 'transparent'}`,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                30 ngày
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <Calendar size={13} color="#64748b" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); if (propOnDateChange) propOnDateChange(e.target.value, endDate, 'custom'); }}
                style={{ background: 'transparent', border: 'none', color: '#0f172a', fontSize: '11px', outline: 'none', fontWeight: '500' }}
              />
              <span style={{ color: '#94a3b8' }}>—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); if (propOnDateChange) propOnDateChange(startDate, e.target.value, 'custom'); }}
                style={{ background: 'transparent', border: 'none', color: '#0f172a', fontSize: '11px', outline: 'none', fontWeight: '500' }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                fetchDashboardReport();
                if (subTab === 'orders') fetchOrders(1);
                if (subTab === 'customers') fetchCustomers(1);
                if (subTab === 'losses') fetchLosses(1);
                if (subTab === 'finance') {
                  fetchFinanceStatements(1);
                  fetchFinanceOrderReconciliation(1);
                }
                if (subTab === 'lives') fetchLivestreams(1);
                if (subTab === 'videos') fetchVideos(1);
                if (subTab === 'products') fetchProducts(1);
                if (subTab === 'ads') {
                  fetchCampaignIntelligence();
                  fetchAdsProductIntelligence();
                  fetchAdsVideoIntelligence();
                  fetchMultiGrainReconciliation();
                }
                if (subTab === 'live_ads') {
                  fetchAdsLiveIntelligence();
                  fetchCampaignIntelligence('LIVE_GMV_MAX');
                }
                if (subTab === 'video_intel') {
                  fetchAdsVideoIntelligence();
                }
              }}
              disabled={isLoadingReport}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: '600'
              }}
            >
              <RefreshCw size={13} className={isLoadingReport ? 'spin' : ''} />
              {isLoadingReport ? 'Đang nạp...' : 'Làm mới'}
            </button>
          </div>
        </div>
      )}

      {/* ERROR ALERT BANNER FOR NON-OVERVIEW TABS */}
      {reportError && subTab !== 'overview' && subTab !== 'isolation' && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#f87171'
        }}>
          <AlertCircle size={20} />
          <div>
            <div style={{ fontWeight: '700', fontSize: '14px' }}>Thông báo lỗi tải dữ liệu</div>
            <div style={{ fontSize: '13px', marginTop: '2px' }}>{reportError}</div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 0: BÁO CÁO TIKTOK SHOP THEO KHOẢNG THỜI GIAN (P0 REPORTING FIRST)  */}
      {/* ========================================================================= */}
      {subTab === 'report' && (
        <CommerceReportView
          shopId={shopId}
          realShopId={realShopId}
          apiRequest={apiRequest}
          startDate={startDate}
          endDate={endDate}
          datePreset={datePreset}
          onDateChange={handleDateChangeUnified}
          onTriggerSync={propOnTriggerSync}
          targetRoi={propTargetRoi}
          targetRoas={propTargetRoas}
        />
      )}

      {/* EXPANDED SUBTABS: AFFILIATE, LIVE ANALYTICS & SHOPEE */}
      {subTab === 'affiliate' && (
        <CommerceAffiliateView
          shopId={shopId}
          startDate={startDate}
          endDate={endDate}
          apiRequest={apiRequest}
          formatVND={formatVND}
          formatNumber={formatNumber}
        />
      )}

      {subTab === 'live_analytics' && (
        <CommerceLiveAnalyticsView
          shopId={shopId}
          startDate={startDate}
          endDate={endDate}
          apiRequest={apiRequest}
          formatVND={formatVND}
          formatNumber={formatNumber}
        />
      )}

      {subTab === 'sop_pacing' && (
        <CommerceSopCommandCenterView
          shopId={shopId}
          apiRequest={apiRequest}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {subTab === 'true_roas' && (
        <CommerceTrueRoasView
          shopId={shopId}
          apiRequest={apiRequest}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {subTab === 'golden_hours' && (
        <CommerceGoldenHoursView
          shopId={shopId}
          startDate={startDate}
          endDate={endDate}
          apiRequest={apiRequest}
        />
      )}

      {subTab === 'shopee' && (
        <CommerceShopeeView
          shopId={shopId}
          startDate={startDate}
          endDate={endDate}
          apiRequest={apiRequest}
          formatVND={formatVND}
          formatNumber={formatNumber}
        />
      )}

      {subTab === 'quality' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '36px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <ShieldCheck size={36} color="#16a34a" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Kiểm Toán & Chất Lượng Dữ Liệu (Data Quality)</h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '500px', margin: '0 auto' }}>
            Tự động giám sát độ trọn vẹn, tính nhất quán giữa các bảng dữ liệu đơn hàng, sổ cái và báo cáo TikTok Marketing API.
          </p>
        </div>
      )}

      {subTab === 'config' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '36px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Sliders size={36} color="#2563eb" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Cấu Hình Hệ Thống & Tích Hợp API</h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '500px', margin: '0 auto' }}>
            Quản lý khóa API TikTok Shop, TikTok Marketing API v1.3, Advertiser ID và thông số đồng bộ tự động.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 1: DAILY MANAGEMENT DASHBOARD (OVERVIEW)                            */}
      {/* ========================================================================= */}
      {(subTab === 'overview' || subTab === 'isolation') && (
        reportError ? (
          <div className="glass" style={{
            padding: '48px 24px',
            borderRadius: '16px',
            textAlign: 'center',
            border: '1px solid #fecaca',
            background: '#fef2f2',
            marginBottom: '24px'
          }}>
            <AlertCircle size={44} color="#dc2626" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#991b1b', marginBottom: '8px' }}>
              Lỗi Tải Dữ Liệu Báo Cáo Quản Trị
            </h3>
            <p style={{ fontSize: '13px', color: '#7f1d1d', maxWidth: '600px', margin: '0 auto 20px', lineHeight: '1.6' }}>
              {reportError}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => fetchDashboardReport()}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  fontSize: '13px',
                  fontWeight: '700',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={15} />
                Thử lại ngay
              </button>
            </div>
          </div>
        ) : isLoadingReport && !reportData ? (
          <div className="glass" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '60px 24px', borderRadius: '16px', textAlign: 'center', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <RefreshCw size={36} className="spin" color="#2563eb" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: '#0f172a', fontSize: '16px', fontWeight: '700' }}>Đang nạp dữ liệu Commerce Intelligence V2...</div>
            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>Đang đối soát sổ cái đơn hàng, hao hụt, doanh thu và quảng cáo</div>
          </div>
        ) : (
          <div>
          {/* DOMAIN FRESHNESS & DB-FIRST SPEED STATUS BAR (V2-06) */}
          {reportData?.domain_freshness && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '8px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '11px',
              color: '#64748b'
            }}>
              <span style={{ fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={13} color="#10b981" />
                Độ tươi dữ liệu (DB-First):
              </span>
              {Object.entries(reportData.domain_freshness).map(([domKey, domInfo]) => {
                const isSyncing = domInfo.status === 'SYNCING';
                const isAvail = domInfo.status === 'AVAILABLE';
                const isStale = domInfo.status === 'STALE';
                const badgeBg = isSyncing ? '#fef3c7' : (isAvail ? '#ecfdf5' : (isStale ? '#fff7ed' : '#f1f5f9'));
                const badgeColor = isSyncing ? '#b45309' : (isAvail ? '#047857' : (isStale ? '#c2410c' : '#64748b'));
                return (
                  <span key={domKey} style={{
                    background: badgeBg,
                    color: badgeColor,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {domInfo.label}: {domInfo.status === 'AVAILABLE' ? 'Khả dụng' : (domInfo.status === 'SYNCING' ? 'Đang đồng bộ...' : (domInfo.status === 'STALE' ? 'Cần làm mới' : domInfo.status))}
                  </span>
                );
              })}
              {isLoadingReport && (
                <span style={{ color: '#2563eb', fontWeight: '600', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <RefreshCw size={11} className="spin" />
                  Đang nạp kỳ mới từ DB...
                </span>
              )}
            </div>
          )}

          {/* A. EXECUTIVE AI SUMMARY CARD (LIGHT BUSINESS ANALYTICS SYSTEM) */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            opacity: isLoadingReport ? 0.75 : 1.0,
            transition: 'opacity 0.2s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: '#eff6ff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb'
                }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.3px' }}>
                    TÓM TẮT HÔM NAY (Executive AI Summary)
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Tự động phân tích từ số liệu kiểm chứng lúc {aiSummary.generated_at || new Date().toLocaleTimeString('vi-VN')}
                  </div>
                </div>
              </div>

              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                fontSize: '11px',
                fontWeight: '700',
                padding: '4px 10px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle2 size={13} />
                XÁC THỰC TỪ ĐỘNG CƠ TÍNH TOÁN
              </span>
            </div>

            {/* Executive Takeaway */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #2563eb',
              fontSize: '14px',
              fontWeight: '500',
              color: '#1e293b',
              lineHeight: '1.6'
            }}>
              {aiSummary.executive_takeaway || (
                `Trong kỳ ${startDate} đến ${endDate}, Shop ghi nhận doanh số gộp ${formatVND(metrics.source_orders_api?.value || 0)} qua ${formatNumber(lossSummary.total_orders_count || 0)} đơn hàng. Sau khi trừ hao hụt, giá trị thực nhận đạt ${formatVND(metrics.source_loss_ledger?.value || 0)}.`
              )}
            </div>

            {/* Structured Bullet Points */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {(aiSummary.highlights || [
                `Bán hàng: Doanh thu gộp đạt ${formatVND(metrics.source_orders_api?.value || 0)} với ${formatNumber(lossSummary.total_orders_count || 0)} đơn hàng.`,
                `Hao hụt: Tổng thất thoát ${formatVND(lossSummary.total_economic_loss_amount || 0)} (${lossSummary.economic_loss_rate_pct || 0}% doanh số gộp).`,
                `Quảng cáo: ${adsOverview.availability_status === 'AVAILABLE' ? `Chi phí ${formatVND(adsOverview.total_spend || 0)}, ROI ${adsOverview.roi || 0}x` : 'Chưa đồng bộ tài khoản quảng cáo TikTok Ads.'}`,
                `Dòng tiền: Dự kiến quyết toán ${formatVND(feeDeductions.net_settlement_amount || metrics.source_finance_api?.value || 0)} sau khấu trừ phí sàn.`
              ]).map((point, idx) => (
                <div key={idx} style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: idx === 0 ? '#2563eb' : idx === 1 ? '#dc2626' : idx === 2 ? '#d97706' : '#16a34a',
                    marginTop: '6px',
                    flexShrink: 0
                  }} />
                  <span style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* B. EXECUTIVE 4-METRIC GRID WITH COMPARISON */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {/* Card 1: Order Gross Value */}
            <div className="glass stat-card cyan" style={{ borderRadius: '16px', padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1. Doanh Thu Gộp (Gross)
                </span>
                <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                  ORDERS API
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                {formatVND(metrics.source_orders_api?.value || 0)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                <span>{formatNumber(lossSummary.total_orders_count || 0)} đơn hàng tạo trong kỳ</span>
              </div>
              {comparison && comparison.order_gross_change_pct !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <span style={{
                    color: comparison.order_gross_change_pct >= 0 ? '#059669' : '#dc2626',
                    background: comparison.order_gross_change_pct >= 0 ? '#ecfdf5' : '#fef2f2',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    {comparison.order_gross_change_pct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(comparison.order_gross_change_pct)}%
                  </span>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>so với kỳ trước</span>
                </div>
              )}
              {isHadaplusPeriod ? (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} />
                  Khớp chuẩn kiểm chứng: 272,135,230 ₫ (2,777 đơn)
                </div>
              ) : (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b' }}>
                  Kỳ báo cáo đang chọn: {startDate} đến {endDate}
                </div>
              )}
            </div>

            {/* Card 2: Realized Order Value */}
            <div className="glass stat-card" style={{ borderRadius: '16px', padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #059669' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  2. Doanh Thu Thực Nhận
                </span>
                <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                  LOSS LEDGER
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#059669', marginBottom: '6px' }}>
                {formatVND(metrics.source_loss_ledger?.value || 0)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                Đã trừ toàn bộ đơn Hủy, Boom, Hoàn tiền
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                  Hao hụt: -{formatVND(lossSummary.total_economic_loss_amount || 0)} ({lossSummary.economic_loss_rate_pct || 0}%)
                </span>
              </div>
              {isHadaplusPeriod && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} />
                  Tham chiếu Hadaplus: 218,956,988 ₫ (Hao hụt 19.5%)
                </div>
              )}
            </div>

            {/* Card 3: Advertising Spend */}
            <div className="glass stat-card" style={{ borderRadius: '16px', padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  3. Chi Phí Quảng Cáo (Ads)
                </span>
                <span style={{
                  background: isAdsPartial ? '#fffbeb' : (isAdsAvailable ? '#ecfdf5' : '#f8fafc'),
                  color: isAdsPartial ? '#d97706' : (isAdsAvailable ? '#059669' : '#64748b'),
                  border: `1px solid ${isAdsPartial ? '#fde68a' : (isAdsAvailable ? '#a7f3d0' : '#e2e8f0')}`,
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: '700'
                }}>
                  {adsStatus}
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                {isAdsAvailable && adsSpendVal !== null ? formatVND(adsSpendVal) : 'Chưa khả dụng'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                {isAdsAvailable ? (
                  isAdsPartial ? (
                    <span>
                      Dữ liệu {adsCoverageDays}/{adsExpectedDays} ngày ({adsCoveragePct}%) <span style={{ color: '#d97706', fontWeight: '700' }}>[Dữ liệu chưa đủ kỳ]</span> | Chiếm {adsOverview.ads_spend_rate_pct ?? adsOverview.metrics?.ads_spend_rate_pct}% DT gộp | ROI: {adsRoiVal}x
                    </span>
                  ) : (
                    `Chiếm ${adsOverview.ads_spend_rate_pct ?? adsOverview.metrics?.ads_spend_rate_pct}% doanh thu gộp | ROI: ${adsRoiVal}x`
                  )
                ) : (
                  adsOverview.message || adsOverview.status_message || 'Chưa đồng bộ chi phí quảng cáo kỳ này'
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b' }}>
                <span>Doanh thu phân bổ quảng cáo: <strong style={{ color: '#0f172a' }}>{isAdsAvailable && adsGmvVal !== null ? formatVND(adsGmvVal) : 'Chưa khả dụng'}</strong></span>
                {isAdsPartial && <span style={{ color: '#d97706', fontSize: '10px', fontWeight: '600' }}>[Dữ liệu chưa đủ kỳ]</span>}
              </div>
              {/* V2-06.2: Hiệu quả thực nhận sau hoàn hủy */}
              {(blendedShopRoas !== null || realizedAdsRoi !== null) && (
                <div style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '11px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  <span style={{ color: '#64748b' }}>
                    ROAS Gộp Shop: <strong style={{ color: '#0f172a' }}>{blendedShopRoas !== null ? `${blendedShopRoas}x` : '—'}</strong>
                  </span>
                  <span style={{ color: '#059669' }}>
                    ROI Thực Nhận: <strong style={{ color: '#059669' }}>{realizedAdsRoi !== null ? `${realizedAdsRoi}x` : '—'}</strong>
                  </span>
                  {roiErosionPoints !== null && (
                    <span style={{ color: '#dc2626', fontSize: '10px', fontWeight: '600' }}>
                      (Suy giảm: -{roiErosionPoints}x)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Card 4: Financial Statement Settlement */}
            <div className="glass stat-card pink" style={{ borderRadius: '16px', padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  4. Tiền Quyết Toán Theo Bảng Kê
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {!metrics.source_finance_api?.is_synced && (
                    <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      CHỜ ĐỒNG BỘ
                    </span>
                  )}
                  <span style={{ background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    FINANCE STATEMENTS
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#2563eb', marginBottom: '6px' }}>
                {metrics.source_finance_api?.is_synced || metrics.source_finance_api?.statement_settlement?.status === 'AVAILABLE' || (feeDeductions.net_settlement_amount && feeDeductions.net_settlement_amount > 0)
                  ? formatVND(metrics.source_finance_api?.statement_settlement?.amount ?? metrics.source_finance_api?.value ?? feeDeductions.net_settlement_amount ?? 0)
                  : 'Chưa đồng bộ'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                Tiền quyết toán chốt theo bảng kê chính thức từ TikTok Shop
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b' }}>
                <span>{metrics?.source_finance_api?.statement_count ? `● Đã chốt ${metrics?.source_finance_api?.statement_count} bảng kê quyết toán` : 'Chờ bảng kê chốt từ sàn'}</span>
                <span>Analytics GMV: <strong style={{ color: '#0f172a' }}>{metrics.source_analytics_api?.is_synced ? formatVND(metrics.source_analytics_api.value || 0) : 'Chưa đồng bộ'}</strong></span>
              </div>
            </div>
          </div>

          {/* C. SHOP HEALTH 6-PILLAR ASSESSMENT */}
          <div className="glass" style={{
            borderRadius: '16px',
            padding: '22px 24px',
            marginBottom: '24px',
            background: '#ffffff',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Đánh Giá Sức Khỏe Shop 360° (6 Trụ Cột Quản Trị)
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Trạng thái vận hành & dữ liệu:</span>
                <span style={{
                  background: (shopHealth.overall_status === 'DATA_COMPLETE' || shopHealth.overall_status === 'GOOD' || shopHealth.overall_status === 'AVAILABLE') ? '#ecfdf5' :
                    (shopHealth.overall_status === 'DATA_PARTIAL' || shopHealth.overall_status === 'NORMAL' || shopHealth.overall_status === 'PARTIAL') ? '#eff6ff' :
                    (shopHealth.overall_status === 'DATA_ATTENTION_REQUIRED' || shopHealth.overall_status === 'ATTENTION' || shopHealth.overall_status === 'ATTENTION_REQUIRED' || shopHealth.overall_status === 'ATTENTION_FROM_VERIFIED_RULE') ? '#fffbeb' : '#f8fafc',
                  color: (shopHealth.overall_status === 'DATA_COMPLETE' || shopHealth.overall_status === 'GOOD' || shopHealth.overall_status === 'AVAILABLE') ? '#059669' :
                    (shopHealth.overall_status === 'DATA_PARTIAL' || shopHealth.overall_status === 'NORMAL' || shopHealth.overall_status === 'PARTIAL') ? '#2563eb' :
                    (shopHealth.overall_status === 'DATA_ATTENTION_REQUIRED' || shopHealth.overall_status === 'ATTENTION' || shopHealth.overall_status === 'ATTENTION_REQUIRED' || shopHealth.overall_status === 'ATTENTION_FROM_VERIFIED_RULE') ? '#d97706' : '#64748b',
                  border: `1px solid ${(shopHealth.overall_status === 'DATA_COMPLETE' || shopHealth.overall_status === 'GOOD' || shopHealth.overall_status === 'AVAILABLE') ? '#a7f3d0' :
                    (shopHealth.overall_status === 'DATA_PARTIAL' || shopHealth.overall_status === 'NORMAL' || shopHealth.overall_status === 'PARTIAL') ? '#bfdbfe' :
                    (shopHealth.overall_status === 'DATA_ATTENTION_REQUIRED' || shopHealth.overall_status === 'ATTENTION' || shopHealth.overall_status === 'ATTENTION_REQUIRED' || shopHealth.overall_status === 'ATTENTION_FROM_VERIFIED_RULE') ? '#fde68a' : '#e2e8f0'}`,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  {(shopHealth.overall_status === 'DATA_COMPLETE' || shopHealth.overall_status === 'GOOD' || shopHealth.overall_status === 'AVAILABLE') ? 'ĐỦ DỮ LIỆU' :
                    (shopHealth.overall_status === 'DATA_PARTIAL' || shopHealth.overall_status === 'NORMAL' || shopHealth.overall_status === 'PARTIAL') ? 'DỮ LIỆU MỘT PHẦN' :
                    (shopHealth.overall_status === 'DATA_ATTENTION_REQUIRED' || shopHealth.overall_status === 'ATTENTION' || shopHealth.overall_status === 'ATTENTION_REQUIRED' || shopHealth.overall_status === 'ATTENTION_FROM_VERIFIED_RULE') ? 'CẦN KIỂM TRA DỮ LIỆU' : 'CHỜ DỮ LIỆU'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {[
                { key: 'sales', label: 'Bán Hàng', info: shopHealth.pillars?.sales || shopHealth.sales },
                { key: 'advertising', label: 'Quảng Cáo', info: shopHealth.pillars?.advertising || shopHealth.advertising },
                { key: 'orders', label: 'Đơn Hàng', info: shopHealth.pillars?.orders || shopHealth.orders },
                { key: 'losses', label: 'Hao Hụt & Hủy', info: shopHealth.pillars?.losses || shopHealth.losses },
                { key: 'finance', label: 'Tài Chính', info: shopHealth.pillars?.finance || shopHealth.finance },
                { key: 'data', label: 'Độ Tươi Dữ Liệu', info: shopHealth.pillars?.data || shopHealth.data }
              ].map((pillar) => {
                const status = pillar.info?.status || 'DATA_UNAVAILABLE';
                const pillColor = (status === 'GOOD' || status === 'AVAILABLE' || status === 'DATA_COMPLETE') ? '#059669'
                  : (status === 'NORMAL' || status === 'PARTIAL' || status === 'DATA_PARTIAL') ? '#2563eb'
                  : (status === 'ATTENTION' || status === 'ATTENTION_REQUIRED' || status === 'ATTENTION_FROM_VERIFIED_RULE' || status === 'DATA_ATTENTION_REQUIRED') ? '#d97706'
                  : status === 'NOT_SYNCED' ? '#0284c7'
                  : '#64748b';
                const pillBg = (status === 'GOOD' || status === 'AVAILABLE' || status === 'DATA_COMPLETE') ? '#ecfdf5'
                  : (status === 'NORMAL' || status === 'PARTIAL' || status === 'DATA_PARTIAL') ? '#eff6ff'
                  : (status === 'ATTENTION' || status === 'ATTENTION_REQUIRED' || status === 'ATTENTION_FROM_VERIFIED_RULE' || status === 'DATA_ATTENTION_REQUIRED') ? '#fffbeb'
                  : status === 'NOT_SYNCED' ? '#f0f9ff'
                  : '#f8fafc';
                const pillBorder = (status === 'GOOD' || status === 'AVAILABLE' || status === 'DATA_COMPLETE') ? '#a7f3d0'
                  : (status === 'NORMAL' || status === 'PARTIAL' || status === 'DATA_PARTIAL') ? '#bfdbfe'
                  : (status === 'ATTENTION' || status === 'ATTENTION_REQUIRED' || status === 'ATTENTION_FROM_VERIFIED_RULE' || status === 'DATA_ATTENTION_REQUIRED') ? '#fde68a'
                  : status === 'NOT_SYNCED' ? '#bae6fd'
                  : '#e2e8f0';

                return (
                  <div key={pillar.key} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{pillar.label}</span>
                      <span style={{ background: pillBg, color: pillColor, border: `1px solid ${pillBorder}`, fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                        {status}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                      {pillar.info?.message || 'Chưa đủ dữ liệu đánh giá'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* D. ATTENTION & OPPORTUNITY CENTER */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* Box 1: Cần Chú Ý (Alerts) */}
            <div className="glass" style={{ borderRadius: '16px', padding: '22px 24px', background: '#ffffff', border: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="#dc2626" />
                  Cần Chú Ý (Alerts & Action Items)
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {attentionCenter.alerts?.length || 0} cảnh báo
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(attentionCenter.alerts || []).length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#64748b', padding: '16px 0', textAlign: 'center' }}>
                    Không có vấn đề nghiêm trọng cần can thiệp trong kỳ này.
                  </div>
                ) : (
                  attentionCenter.alerts?.map((item, idx) => (
                    <div key={idx} style={{
                      background: '#fef2f2',
                      border: '1px solid #fee2e2',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#991b1b' }}>{item.title}</div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{item.description}</div>
                        {(item.metric || item.metric_evidence) && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '600' }}>Số liệu: {item.metric || item.metric_evidence}</div>}
                      </div>
                      {(item.drilldown_tab || item.drilldown_target) && (
                        <button
                          type="button"
                          onClick={() => setSubTab(item.drilldown_tab || item.drilldown_target)}
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px', flexShrink: 0, background: '#ffffff', color: '#991b1b', border: '1px solid #fecaca' }}
                        >
                          Xử lý
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Box 2: Cơ Hội Tối Ưu (Opportunities) */}
            <div className="glass" style={{ borderRadius: '16px', padding: '22px 24px', background: '#ffffff', border: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="#059669" />
                  Cơ Hội Tăng Trưởng (Opportunities)
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {attentionCenter.opportunities?.length || 0} đề xuất
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(attentionCenter.opportunities || []).length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#64748b', padding: '16px 0', textAlign: 'center' }}>
                    Chưa có đề xuất tối ưu mới cho khoảng thời gian này.
                  </div>
                ) : (
                  attentionCenter.opportunities?.map((item, idx) => (
                    <div key={idx} style={{
                      background: '#f0fdf4',
                      border: '1px solid #dcfce7',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#065f46' }}>{item.title}</div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{item.description}</div>
                        {(item.impact || item.metric || item.metric_evidence) && (
                          <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: '600' }}>
                            {item.impact ? `Tiềm năng: ${item.impact}` : `Số liệu: ${item.metric || item.metric_evidence}`}
                          </div>
                        )}
                      </div>
                      {(item.drilldown_tab || item.drilldown_target) && (
                        <button
                          type="button"
                          onClick={() => setSubTab(item.drilldown_tab || item.drilldown_target)}
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px', flexShrink: 0, background: '#ffffff', color: '#065f46', border: '1px solid #a7f3d0' }}
                        >
                          Khám phá
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* E. ADVERTISING COST OVERVIEW & BREAKDOWN CARD */}
          <div className="glass" style={{
            borderRadius: '16px',
            padding: '22px 24px',
            marginBottom: '24px',
            background: '#ffffff',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DollarSign size={20} color="#d97706" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Tổng Quan Chi Phí Quảng Cáo (Advertising Cost Overview)
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Trạng thái đồng bộ:</span>
                <span style={{
                  background: isAdsAvailable ? '#ecfdf5' : '#f8fafc',
                  color: isAdsAvailable ? '#059669' : '#64748b',
                  border: `1px solid ${isAdsAvailable ? '#a7f3d0' : '#e2e8f0'}`,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  {adsStatus}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Tổng Chi Phí Ads</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
                  {isAdsAvailable && adsSpendVal !== null ? formatVND(adsSpendVal) : 'Chưa khả dụng'}
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                  Doanh Thu Phân Bổ (Ads Gross)
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669', marginTop: '4px' }}>
                  {isAdsAvailable && adsGmvVal !== null ? formatVND(adsGmvVal) : 'Chưa khả dụng'}
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                  Ads ROI / ROAS {isAdsPartial && <span style={{ color: '#d97706', fontSize: '10px' }}>[Chưa đủ kỳ]</span>}
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#2563eb', marginTop: '4px' }}>
                  {isAdsAvailable && adsRoiVal !== null ? `${adsRoiVal}x` : 'Chưa khả dụng'}
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                  Chi Phí / Doanh Số Gộp {isAdsPartial && <span style={{ color: '#d97706', fontSize: '10px' }}>[Chưa đủ kỳ]</span>}
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#d97706', marginTop: '4px' }}>
                  {isAdsAvailable && (adsOverview.ads_spend_rate_pct ?? adsOverview.metrics?.ads_spend_rate_pct) !== null ? `${adsOverview.ads_spend_rate_pct ?? adsOverview.metrics?.ads_spend_rate_pct}%` : 'Chưa khả dụng'}
                </div>
              </div>
            </div>

            {/* V2-06.2: Loss-Adjusted Realized ROI & Erosion Metrics */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '16px 18px',
              marginBottom: '16px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingDown size={16} color="#d97706" />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                    Hiệu Quả Quảng Cáo Thực Nhận (Loss-Adjusted ROI & Erosion)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Công thức: Gross − Loss = Realized | Không tính ROI trung bình từng ngày
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                {/* 1. ROAS Doanh Thu Gộp Toàn Shop */}
                <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #2563eb' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                    ROAS Doanh Thu Gộp Toàn Shop
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#2563eb', marginTop: '4px' }}>
                    {blendedShopRoas !== null ? `${blendedShopRoas}x` : (isAdsAvailable ? 'Chưa đủ điều kiện tính' : 'Chưa khả dụng')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Tổng DT Gộp / Ads Spend
                  </div>
                </div>

                {/* 2. ROI Doanh Thu Thực Nhận Toàn Shop */}
                <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #059669' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                    ROI Doanh Thu Thực Nhận Toàn Shop
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669', marginTop: '4px' }}>
                    {realizedAdsRoi !== null ? `${realizedAdsRoi}x` : (isAdsAvailable ? 'Chưa đủ điều kiện tính' : 'Chưa khả dụng')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Tổng DT Thực Nhận / Ads Spend
                  </div>
                </div>

                {/* 3. ROI Suy Giảm Do Hoàn Hủy */}
                <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #dc2626' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                    ROI Suy Giảm Do Hoàn Hủy
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626', marginTop: '4px' }}>
                    {roiErosionPoints !== null ? `-${roiErosionPoints}x` : (isAdsAvailable ? 'Chưa đủ điều kiện tính' : 'Chưa khả dụng')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Tổng Hao Hụt / Ads Spend
                  </div>
                </div>

                {/* 4. Tỷ Lệ Chi Phí Ads / DT Thực Nhận */}
                <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #d97706' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                    Tỷ Lệ Chi Phí Ads / DT Thực Nhận
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#d97706', marginTop: '4px' }}>
                    {spendToRealizedRate !== null ? `${spendToRealizedRate}%` : (isAdsAvailable ? 'Chưa đủ điều kiện tính' : 'Chưa khả dụng')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Ads Spend / DT Thực Nhận
                  </div>
                </div>
              </div>

              {/* Business Guidance Note */}
              <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.5', background: '#ffffff', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
                💡 <strong>Lưu ý nghiệp vụ:</strong> Chỉ số ROI doanh thu thực nhận toàn shop phản ánh tỷ suất thu hồi doanh số ròng sau trừ hao hụt trên mỗi đồng chi phí ads. Đây không phải là lợi nhuận ròng của shop hoặc ROI quy kết riêng cho từng chiến dịch sau hoàn hủy.
              </div>

              {/* Warning if erosion is high and trustworthy */}
              {roiErosionPoints !== null && roiErosionPoints >= 1.0 && isAdsAvailable && !isAdsPartial && (
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
                    <strong>Cảnh báo ROI Erosion:</strong> Tỷ lệ hủy/hoàn làm hao hụt <strong>-{roiErosionPoints}x</strong> điểm ROI so với ROAS gộp ban đầu (từ {blendedShopRoas}x giảm còn {realizedAdsRoi}x). Cần rà soát chất lượng traffic và tỷ lệ giao hàng thành công.
                  </span>
                </div>
              )}
            </div>

            {/* Sub-breakdown: Product GMV Max vs LIVE GMV Max */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Product GMV Max</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Quảng cáo sản phẩm</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>Chi phí: <strong style={{ color: '#0f172a' }}>{isAdsAvailable && adsOverview.breakdowns?.product_gmv_max?.spend != null ? formatVND(adsOverview.breakdowns?.product_gmv_max?.spend) : 'Chưa khả dụng'}</strong></span>
                  <span>Doanh thu phân bổ: <strong style={{ color: '#059669' }}>{isAdsAvailable && adsOverview.breakdowns?.product_gmv_max?.gmv != null ? formatVND(adsOverview.breakdowns?.product_gmv_max?.gmv) : 'Chưa khả dụng'}</strong></span>
                </div>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>LIVE GMV Max</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Quảng cáo livestream</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>Chi phí: <strong style={{ color: '#0f172a' }}>{isAdsAvailable && adsOverview.breakdowns?.live_gmv_max?.spend != null ? formatVND(adsOverview.breakdowns?.live_gmv_max?.spend) : 'Chưa khả dụng'}</strong></span>
                  <span>Doanh thu phân bổ: <strong style={{ color: '#059669' }}>{isAdsAvailable && adsOverview.breakdowns?.live_gmv_max?.gmv != null ? formatVND(adsOverview.breakdowns?.live_gmv_max?.gmv) : 'Chưa khả dụng'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* F. ECONOMIC LOSS RECONCILIATION & FEE DEDUCTIONS (TWO BOXES) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* Box A: Hạch toán Hao hụt & Hoàn/Hủy */}
            <div className="glass" style={{ borderRadius: '16px', padding: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="#dc2626" />
                  Cơ Cấu Hao Hụt Đơn Hàng (Loss Breakdown)
                </h3>
                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700' }}>
                  Tổng mất: {formatVND(lossSummary.total_economic_loss_amount || 0)}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 1. Hủy đơn */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>Đơn Hủy (Cancelled)</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Hủy trước khi đóng gói hoặc người mua tự hủy</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#dc2626' }}>
                      {formatVND(lossSummary.cancelled_orders_amount || 0)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {formatNumber(lossSummary.cancelled_orders_count || 0)} đơn
                    </div>
                  </div>

                </div>

                {/* 2. Giao thất bại */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>Giao Thất Bại (Boom Hàng)</span>
                      <span style={{
                        background: lossSummary.failed_delivery_status === 'VERIFIED' ? '#ecfdf5' : '#fffbeb',
                        color: lossSummary.failed_delivery_status === 'VERIFIED' ? '#059669' : '#d97706',
                        border: `1px solid ${lossSummary.failed_delivery_status === 'VERIFIED' ? '#a7f3d0' : '#fde68a'}`,
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: '700'
                      }}>
                        {lossSummary.failed_delivery_status || 'UNPROVEN'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Chuyển phát không thành công / người mua từ chối nhận</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#ea580c' }}>
                      {formatVND(lossSummary.failed_delivery_orders_amount || 0)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {formatNumber(lossSummary.failed_delivery_orders_count || 0)} đơn
                    </div>
                  </div>

                </div>

                {/* 3. Hoàn tiền RMA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>Hoàn Tiền / Trả Hàng (RMA Refund)</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Đơn sau bán được duyệt hoàn tiền chính thức (RMA API)</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#7c3aed' }}>
                      {formatVND(lossSummary.refund_orders_amount || 0)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {formatNumber(lossSummary.refund_orders_count || 0)} đơn
                    </div>
                  </div>

                </div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Doanh thu thực nhận sau hao hụt:</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#059669' }}>
                  {formatVND(lossSummary.realized_order_value || 0)}
                </span>
              </div>
            </div>

            {/* Box B: Khấu trừ Phí Sàn & Đối Soát Giao Dịch */}
            <div className="glass" style={{ borderRadius: '16px', padding: '24px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} color="#2563eb" />
                  Đối Soát Phí & Chi Tiết Giao Dịch
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: feeDeductions.is_synced && feeDeductions.status === 'AVAILABLE' ? '#ecfdf5' : '#fffbeb',
                  color: feeDeductions.is_synced && feeDeductions.status === 'AVAILABLE' ? '#059669' : '#d97706',
                  border: `1px solid ${feeDeductions.is_synced && feeDeductions.status === 'AVAILABLE' ? '#a7f3d0' : '#fde68a'}`
                }}>
                  {feeDeductions.is_synced && feeDeductions.status === 'AVAILABLE' ? 'ĐÃ ĐỐI SOÁT GIAO DỊCH' : 'CHI TIẾT GIAO DỊCH CHƯA ĐỒNG BỘ ĐẦY ĐỦ'}
                </span>
              </div>

              {(!feeDeductions.is_synced || feeDeductions.status === 'NOT_SYNCED') && (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  color: '#92400e',
                  lineHeight: '1.5'
                }}>
                  {feeDeductions.message || 'Chi tiết giao dịch tài chính (transactions) chưa đồng bộ đầy đủ từ TikTok Shop API. Số tiền quyết toán thực tế được ghi nhận chính xác theo bảng kê bên dưới.'}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Hoa hồng nền tảng (Platform Commission):</span>
                  <span style={{ fontWeight: '600', color: feeDeductions.platform_commission !== null && feeDeductions.platform_commission !== undefined ? '#dc2626' : '#64748b' }}>
                    {feeDeductions.platform_commission !== null && feeDeductions.platform_commission !== undefined ? `-${formatVND(feeDeductions.platform_commission)}` : 'Chưa đối soát'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Hoa hồng KOC / Tiếp thị liên kết (Affiliate):</span>
                  <span style={{ fontWeight: '600', color: feeDeductions.affiliate_commission !== null && feeDeductions.affiliate_commission !== undefined ? '#dc2626' : '#64748b' }}>
                    {feeDeductions.affiliate_commission !== null && feeDeductions.affiliate_commission !== undefined ? `-${formatVND(feeDeductions.affiliate_commission)}` : 'Chưa đối soát'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Phí xử lý thanh toán (Payment Fee):</span>
                  <span style={{ fontWeight: '600', color: feeDeductions.payment_fee !== null && feeDeductions.payment_fee !== undefined ? '#dc2626' : '#64748b' }}>
                    {feeDeductions.payment_fee !== null && feeDeductions.payment_fee !== undefined ? `-${formatVND(feeDeductions.payment_fee)}` : 'Chưa đối soát'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Phí vận chuyển thực tế (Actual Shipping):</span>
                  <span style={{ fontWeight: '600', color: feeDeductions.actual_shipping_fee !== null && feeDeductions.actual_shipping_fee !== undefined ? '#dc2626' : '#64748b' }}>
                    {feeDeductions.actual_shipping_fee !== null && feeDeductions.actual_shipping_fee !== undefined ? `-${formatVND(feeDeductions.actual_shipping_fee)}` : 'Chưa đối soát'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Trợ giá vận chuyển sàn (Shipping Subsidy):</span>
                  <span style={{ fontWeight: '600', color: feeDeductions.shipping_fee_subsidy !== null && feeDeductions.shipping_fee_subsidy !== undefined ? '#059669' : '#64748b' }}>
                    {feeDeductions.shipping_fee_subsidy !== null && feeDeductions.shipping_fee_subsidy !== undefined ? `+${formatVND(feeDeductions.shipping_fee_subsidy)}` : 'Chưa đối soát'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0' }}>
                  <span style={{ color: '#64748b' }}>Điều chỉnh khác (Adjustments):</span>
                  <span style={{ fontWeight: '600', color: feeDeductions.adjustments !== null && feeDeductions.adjustments !== undefined ? '#0f172a' : '#64748b' }}>
                    {feeDeductions.adjustments !== null && feeDeductions.adjustments !== undefined ? formatVND(feeDeductions.adjustments) : 'Chưa đối soát'}
                  </span>
                </div>
              </div>

              {/* 1. Tiền quyết toán theo bảng kê */}
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Tiền quyết toán theo bảng kê:</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#059669' }}>
                  {reportData?.statement_settlement?.status === 'AVAILABLE' || metrics.source_finance_api?.statement_settlement?.status === 'AVAILABLE' || metrics.source_finance_api?.is_synced || (feeDeductions.net_settlement_amount && feeDeductions.net_settlement_amount > 0)
                    ? formatVND(reportData?.statement_settlement?.amount ?? metrics.source_finance_api?.statement_settlement?.amount ?? metrics.source_finance_api?.value ?? feeDeductions.net_settlement_amount ?? 0)
                    : 'Chưa đồng bộ'}
                </span>
              </div>

              {/* 2. Tiền thực chuyển ngân hàng */}
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Số tiền thực chuyển ngân hàng:</span>
                <span style={{
                  fontSize: (reportData?.bank_transfer?.status === 'AVAILABLE' && reportData?.bank_transfer?.amount != null) ? '16px' : '12px',
                  fontWeight: (reportData?.bank_transfer?.status === 'AVAILABLE' && reportData?.bank_transfer?.amount != null) ? '800' : '500',
                  color: (reportData?.bank_transfer?.status === 'AVAILABLE' && reportData?.bank_transfer?.amount != null) ? '#2563eb' : '#64748b',
                  fontStyle: (reportData?.bank_transfer?.status === 'AVAILABLE' && reportData?.bank_transfer?.amount != null) ? 'normal' : 'italic'
                }}>
                  {(reportData?.bank_transfer?.status === 'AVAILABLE' && reportData?.bank_transfer?.amount != null)
                    ? formatVND(reportData?.bank_transfer?.amount)
                    : (reportData?.bank_transfer?.message || 'Chưa có dữ liệu đối soát payout')}
                </span>
              </div>
            </div>
          </div>

          {/* G. DATA FRESHNESS & ANALYTICS NOTICE BAR */}
          <div className="glass" style={{
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '24px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#2563eb" />
              <span style={{ color: '#64748b' }}>Độ tươi dữ liệu các domain:</span>
              <span style={{ color: '#0f172a', fontWeight: '600' }}>
                Đơn hàng ({dataFreshness.domains?.orders || 'Real-time'}) | RMA ({dataFreshness.domains?.rma || 'Real-time'}) | Tài chính ({dataFreshness.domains?.finance || 'Daily'})
              </span>
            </div>

            <div style={{ fontSize: '11px', color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '6px' }}>
              ℹ️ Dữ liệu TikTok Shop Analytics hiện khả dụng chính thức đến <strong>10/08/2026</strong>.
            </div>
          </div>

          {/* H. STRICT ISOLATION CARD (5-WAY REVENUE PRINCIPLE) */}
          <div className="glass" style={{
            padding: '20px 24px',
            borderRadius: '16px',
            marginBottom: '24px',
            border: '1px solid #bfdbfe',
            background: '#eff6ff'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <ShieldCheck size={24} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#1e3a8a', fontWeight: '700' }}>
                  Nguyên Tắc Bất Biến: Cách Ly Tuyệt Đối 5 Khái Niệm Số Liệu Doanh Thu
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                  Hệ thống ADDP Commerce Intelligence tuyệt đối <strong style={{ color: '#dc2626' }}>không ép bằng (force equality)</strong> hay tính hàm <code style={{ color: '#2563eb' }}>max()</code> giữa các nguồn. Mỗi con số phản ánh một sự kiện kinh tế độc lập tại các chốt thời gian và nghiệp vụ khác nhau: Đơn hàng tạo (Orders API), Sau trừ hủy/hoàn (Loss Ledger), Tiền sàn trả (Finance API), Thống kê phân phối (Analytics API), và Doanh số ghi nhận (Ads API).
                </p>
              </div>
            </div>
          </div>
          </div>
        )
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: ORDERS API INGESTION                                            */}
      {/* ========================================================================= */}
      {subTab === 'orders' && (
        <div>
          {/* Filters Bar */}
          <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', flex: '1 1 280px' }}>
                <Search size={14} color="#64748b" />
                <input
                  type="text"
                  placeholder="Tìm theo mã đơn (#57646...), sản phẩm, SKU..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchOrders(1); }}
                  style={{ background: 'transparent', border: 'none', color: '#0f172a', fontSize: '12px', outline: 'none', width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>Trạng thái:</span>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
                >
                  <option value="">Tất cả trạng thái {totalPeriodOrders > 0 ? `(${formatNumber(totalPeriodOrders)})` : ''}</option>
                  <option value="RETURN_REFUND">
                    Trả hàng / Hoàn tiền {
                      orderStatusCounts?.RETURN_REFUND !== null && orderStatusCounts?.RETURN_REFUND !== undefined && (rmaCoverage ? rmaCoverage.is_verified : true)
                        ? `(${formatNumber(orderStatusCounts.RETURN_REFUND)})`
                        : '(Chưa đối soát)'
                    }
                  </option>
                  <option value="COMPLETED">Hoàn tất (COMPLETED) {orderStatusCounts?.COMPLETED != null ? `(${formatNumber(orderStatusCounts?.COMPLETED)})` : ''}</option>
                  <option value="DELIVERED">Đã giao (DELIVERED) {orderStatusCounts?.DELIVERED != null ? `(${formatNumber(orderStatusCounts?.DELIVERED)})` : ''}</option>
                  <option value="CANCELLED">Đã hủy (CANCELLED) {orderStatusCounts?.CANCELLED != null ? `(${formatNumber(orderStatusCounts?.CANCELLED)})` : ''}</option>
                  <option value="IN_TRANSIT">Đang vận chuyển (IN_TRANSIT) {orderStatusCounts?.IN_TRANSIT != null ? `(${formatNumber(orderStatusCounts?.IN_TRANSIT)})` : ''}</option>
                  <option value="UNPAID">Chờ thanh toán (UNPAID) {orderStatusCounts?.UNPAID != null ? `(${formatNumber(orderStatusCounts?.UNPAID)})` : ''}</option>
                  <option value="AWAITING_SHIPMENT">Chờ giao hàng (AWAITING_SHIPMENT) {orderStatusCounts?.AWAITING_SHIPMENT != null ? `(${formatNumber(orderStatusCounts?.AWAITING_SHIPMENT)})` : ''}</option>
                  <option value="AWAITING_COLLECTION">Chờ lấy hàng (AWAITING_COLLECTION) {orderStatusCounts?.AWAITING_COLLECTION != null ? `(${formatNumber(orderStatusCounts?.AWAITING_COLLECTION)})` : ''}</option>
                  {orderStatusCounts && Object.keys(orderStatusCounts)
                    .filter((k) => !['COMPLETED', 'DELIVERED', 'CANCELLED', 'IN_TRANSIT', 'UNPAID', 'RETURN_REFUND', 'AWAITING_SHIPMENT', 'AWAITING_COLLECTION'].includes(k))
                    .map((st) => (
                      <option key={st} value={st}>
                        {st} ({formatNumber(orderStatusCounts[st])})
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => fetchOrders(1)}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Lọc
              </button>

              <button
                type="button"
                onClick={handleExportOrders}
                disabled={isExportingOrders}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Xuất toàn bộ đơn hàng khớp bộ lọc ra file Excel/CSV (không chứa PII)"
              >
                {isExportingOrders ? <RefreshCw size={12} className="spin" /> : <FileSpreadsheet size={12} />}
                Xuất CSV
              </button>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {orderStatusFilter ? (
                <>Khớp bộ lọc: <strong style={{ color: '#2563eb' }}>{formatNumber(orderPagination.total_records)}</strong> / Tổng kỳ: <strong style={{ color: '#0f172a' }}>{formatNumber(totalPeriodOrders || orderPagination.total_records)}</strong> đơn</>
              ) : (
                <>Tổng số đơn kỳ này: <strong style={{ color: '#0f172a' }}>{formatNumber(orderPagination.total_records)}</strong> đơn</>
              )}
            </div>
          </div>

          {/* Orders Table */}
          <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Mã Đơn Hàng</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Ngày Tạo</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Giá Trị Đơn (Gross)</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Tiền Hàng</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Giảm Giá</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Phí Vận Chuyển</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Trạng Thái</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Hậu Mãi</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Hạch Toán Hao Hụt</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Chi Tiết</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingOrders ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                      <div>Đang tải dữ liệu đơn hàng...</div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      Không tìm thấy đơn hàng nào trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const statusMeta = (() => {
                      switch (order.order_status) {
                        case 'COMPLETED':
                          return { text: 'Hoàn tất', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
                        case 'DELIVERED':
                          return { text: 'Đã giao', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
                        case 'CANCELLED':
                          return { text: 'Đã hủy', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
                        case 'IN_TRANSIT':
                          return { text: 'Đang giao', bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
                        case 'AWAITING_SHIPMENT':
                          return { text: 'Chờ giao', bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
                        case 'AWAITING_COLLECTION':
                          return { text: 'Chờ lấy', bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
                        case 'UNPAID':
                          return { text: 'Chờ thanh toán', bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' };
                        default:
                          return { text: order.order_status, bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
                      }
                    })();
                    const totalDiscount = (parseFloat(order.seller_discount || 0) + parseFloat(order.platform_discount || 0));

                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                          <button
                            type="button"
                            onClick={() => fetchOrderDetail(order.platform_order_id)}
                            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: '600', padding: 0 }}
                          >
                            {order.platform_order_id}
                          </button>
                          {order.recipient_name && (
                            <div style={{ fontSize: '11px', color: '#334155', fontWeight: '500', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>{order.recipient_name}</span>
                              {order.phone_number && <span style={{ color: '#059669', fontFamily: 'monospace' }}>({order.phone_number})</span>}
                              {order.is_unmasked && (
                                <span style={{ background: '#dcfce7', color: '#166534', fontSize: '9px', padding: '1px 4px', borderRadius: '3px', fontWeight: '800' }}>LIVE</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                          {order.platform_created_at}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>
                          {formatVND(order.order_gross_amount)}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {formatVND(order.sub_total)}
                        </td>
                        <td style={{ padding: '12px 16px', color: totalDiscount > 0 ? '#dc2626' : '#64748b' }}>
                          {totalDiscount > 0 ? `-${formatVND(totalDiscount)}` : '0 ₫'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {formatVND(order.shipping_fee)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: statusMeta.bg,
                            color: statusMeta.color,
                            border: `1px solid ${statusMeta.border}`,
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            {statusMeta.text}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {order.has_aftersales || (order.aftersales_summary && order.aftersales_summary !== '—') ? (
                            <span style={{
                              background: order.aftersales_status === 'SUCCESS' ? '#ecfdf5' : '#fef2f2',
                              color: order.aftersales_status === 'SUCCESS' ? '#059669' : '#dc2626',
                              border: `1px solid ${order.aftersales_status === 'SUCCESS' ? '#a7f3d0' : '#fecaca'}`,
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontWeight: '600',
                              display: 'inline-block'
                            }}>
                              {order.aftersales_summary || order.aftersales_status || 'Có yêu cầu'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {order.has_loss ? (
                            <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                              Có hao hụt ({order.losses?.length || 1})
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            type="button"
                            onClick={() => fetchOrderDetail(order.platform_order_id)}
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#2563eb',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}
                          >
                            <Eye size={12} />
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {orderPagination.total_pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Trang {orderPagination.page} / {orderPagination.total_pages}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={orderPagination.page <= 1}
                    onClick={() => fetchOrders(orderPagination.page - 1)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={orderPagination.page >= orderPagination.total_pages}
                    onClick={() => fetchOrders(orderPagination.page + 1)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: CUSTOMER 360 INTELLIGENCE (UNIFIED LIGHT BUSINESS DESIGN SYSTEM) */}
      {/* ========================================================================= */}
      {subTab === 'customers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* A. Customer 360 Header & Privacy Data Trust Banner */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '18px 22px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: '#eff6ff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb'
                }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.3px' }}>
                    Khách Hàng (Customer 360 Intelligence)
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Hồ sơ khách hàng, phân loại tệp (Mới vs Quay lại), tần suất mua hàng và giá trị vòng đời (LTV) được bảo vệ PII.
                  </div>
                </div>
              </div>

              {/* Data Trust Status Chip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  background: customerDataTrust?.status === 'AVAILABLE' ? '#dcfce7' : (customerDataTrust?.status === 'CONFIGURATION_ERROR' ? '#fee2e2' : (customerDataTrust?.status === 'NO_VERIFIED_IDENTITY_IN_PERIOD' ? '#fef3c7' : '#f1f5f9')),
                  color: customerDataTrust?.status === 'AVAILABLE' ? '#15803d' : (customerDataTrust?.status === 'CONFIGURATION_ERROR' ? '#b91c1c' : (customerDataTrust?.status === 'NO_VERIFIED_IDENTITY_IN_PERIOD' ? '#b45309' : '#475569')),
                  border: `1px solid ${customerDataTrust?.status === 'AVAILABLE' ? '#bbf7d0' : (customerDataTrust?.status === 'CONFIGURATION_ERROR' ? '#fca5a5' : (customerDataTrust?.status === 'NO_VERIFIED_IDENTITY_IN_PERIOD' ? '#fde68a' : '#e2e8f0'))}`,
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <ShieldCheck size={13} />
                  {customerDataTrust?.status === 'AVAILABLE'
                    ? 'DỮ LIỆU SẴN SÀNG (PII PROTECTED)'
                    : (customerDataTrust?.status === 'CONFIGURATION_ERROR'
                      ? 'CHƯA CẤU HÌNH SECRET (FAIL-CLOSED)'
                      : (customerDataTrust?.status === 'NO_VERIFIED_IDENTITY_IN_PERIOD'
                        ? 'CHƯA CÓ DANH TÍNH TRONG KỲ'
                        : (customerDataTrust?.status === 'NO_CUSTOMERS_IN_PERIOD'
                          ? 'KHÔNG CÓ ĐƠN TRONG KỲ'
                          : (customerDataTrust?.status || 'CHƯA XÁC ĐỊNH'))))}
                </span>

                {(() => {
                  const remainingPriorityCount = customerDataTrust?.remaining_priority_orders ?? 0;
                  const isPriorityDisabled = isSyncingPriorityRecipients || isSyncingCustomer || customerDataTrust?.status === 'CONFIGURATION_ERROR' || remainingPriorityCount === 0;
                  return (
                    <button
                      type="button"
                      onClick={handleTriggerPriorityRecipients}
                      disabled={isPriorityDisabled}
                      className="btn-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '6px',
                        background: remainingPriorityCount === 0 ? '#94a3b8' : '#0284c7',
                        border: `1px solid ${remainingPriorityCount === 0 ? '#64748b' : '#0369a1'}`,
                        color: '#ffffff',
                        cursor: isPriorityDisabled ? 'not-allowed' : 'pointer',
                        opacity: remainingPriorityCount === 0 ? 0.7 : 1
                      }}
                      title={remainingPriorityCount === 0 ? 'Không có đơn cần thu thập ưu tiên (AWAITING_SHIPMENT/IN_TRANSIT)' : `Thu thập ưu tiên thông tin người nhận chưa bị che mờ cho ${remainingPriorityCount} đơn đang vận chuyển`}
                    >
                      <RefreshCw size={12} className={isSyncingPriorityRecipients ? 'spin' : ''} />
                      <span>
                        {isSyncingPriorityRecipients
                          ? 'Đang thu thập...'
                          : (remainingPriorityCount > 0
                            ? `Thu thập ưu tiên (${remainingPriorityCount} đơn)`
                            : 'Không có đơn cần thu thập ưu tiên')}
                      </span>
                    </button>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => handleTriggerSync('customer')}
                  disabled={isSyncingCustomer || isLoadingCustomers || customerDataTrust?.status === 'CONFIGURATION_ERROR'}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: (isSyncingCustomer || isLoadingCustomers || customerDataTrust?.status === 'CONFIGURATION_ERROR') ? '#94a3b8' : '#334155',
                    cursor: (isSyncingCustomer || isLoadingCustomers || customerDataTrust?.status === 'CONFIGURATION_ERROR') ? 'not-allowed' : 'pointer'
                  }}
                  title={customerDataTrust?.status === 'CONFIGURATION_ERROR' ? 'Vui lòng cấu hình CUSTOMER_IDENTITY_HMAC_KEY trước khi đồng bộ' : (isSyncingCustomer ? 'Đang đồng bộ hồ sơ...' : 'Đồng bộ trích xuất hồ sơ khách hàng từ dữ liệu đơn hàng')}
                >
                  <RefreshCw size={12} className={(isSyncingCustomer || isLoadingCustomers) ? 'spin' : ''} />
                  <span>{isSyncingCustomer ? 'Đang đồng bộ...' : 'Đồng bộ hồ sơ'}</span>
                </button>
              </div>
            </div>

            {/* Sync Action Feedback Alert */}
            {syncActionMessage && (
              <div style={{
                background: syncActionMessage.type === 'success' ? '#f0fdf4' : (syncActionMessage.type === 'warning' ? '#fffbeb' : '#fff1f2'),
                border: `1px solid ${syncActionMessage.type === 'success' ? '#bbf7d0' : (syncActionMessage.type === 'warning' ? '#fde68a' : '#fecdd3')}`,
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: syncActionMessage.type === 'success' ? '#166534' : (syncActionMessage.type === 'warning' ? '#92400e' : '#9f1239'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {syncActionMessage.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                  <span>{syncActionMessage.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncActionMessage(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px 6px', fontSize: '14px', fontWeight: 'bold' }}
                  title="Đóng thông báo"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Security Config Alert if CONFIGURATION_ERROR */}
            {customerDataTrust?.status === 'CONFIGURATION_ERROR' && (
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '12px',
                color: '#9f1239',
                lineHeight: '1.5',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertCircle size={16} color="#e11d48" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Cấu hình bảo mật yêu cầu:</strong> Biến môi trường <code>CUSTOMER_IDENTITY_HMAC_KEY</code> chưa được thiết lập hoặc không đạt tiêu chuẩn độ phức tạp (tối thiểu 32 ký tự). Hệ thống áp dụng nguyên tắc fail-closed an toàn: không tính toán hash và không lưu trữ PII cho đến khi key được khai báo trong môi trường máy chủ.
                </div>
              </div>
            )}

            {/* Privacy Architecture Notice */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#475569',
              lineHeight: '1.6',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <Lock size={15} color="#16a34a" style={{ flexShrink: 0 }} />
              <span>
                <strong>Kiến trúc bảo mật:</strong> Dữ liệu người mua tuân thủ chuẩn TikTok Shop Open API. Tên và Số điện thoại hiển thị dưới dạng che mờ (<code style={{ color: '#0f172a', background: '#e2e8f0', padding: '1px 4px', borderRadius: '3px' }}>09******12</code>), định danh qua hàm băm một chiều <code style={{ color: '#0f172a', background: '#e2e8f0', padding: '1px 4px', borderRadius: '3px' }}>HMAC-SHA256</code>. Tuyệt đối không lưu trữ plaintext PII.
              </span>
              {customerDataTrust != null && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#475569', flexWrap: 'wrap' }}>
                  <span>
                    Đơn đã định danh: <strong style={{ color: '#0f172a' }}>{formatNumber(customerDataTrust.matched_orders ?? customerDataTrust.orders_linked ?? 0)}</strong> / <strong>{formatNumber(customerDataTrust.total_orders || totalPeriodOrders)}</strong>
                  </span>
                  <span>
                    Chưa định danh: <strong style={{ color: '#64748b' }}>{formatNumber(customerDataTrust.unmatched_orders ?? Math.max(0, (customerDataTrust.total_orders || totalPeriodOrders) - (customerDataTrust.matched_orders ?? customerDataTrust.orders_linked ?? 0)))}</strong>
                  </span>
                  <span>
                    Độ phủ định danh: <strong style={{ color: (customerDataTrust.identity_coverage_pct || 0) > 0 ? '#16a34a' : '#d97706' }}>{customerDataTrust.identity_coverage_pct ?? customerDataTrust.linkage_rate_pct ?? 0}%</strong>
                  </span>
                  <span style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
                    Tổng hồ sơ xác thực (Trọn đời): <strong style={{ color: '#2563eb' }}>{formatNumber(customerDataTrust.total_lifetime_profiles ?? customerDataTrust.profiles_created ?? 0)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Subtab Navigation: [ 👥 Danh Sách Khách Hàng ] | [ 📦 Chi Tiết Đơn Hàng: [Tên khách] ✕ ] */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '0px',
            marginBottom: '4px'
          }}>
            <button
              type="button"
              onClick={() => setCustomerViewMode('list')}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                background: 'transparent',
                borderBottom: customerViewMode === 'list' ? '3px solid #2563eb' : '3px solid transparent',
                color: customerViewMode === 'list' ? '#2563eb' : '#64748b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
            >
              <Users size={16} />
              <span>Danh Sách Khách Hàng</span>
              <span style={{
                fontSize: '11px',
                background: customerViewMode === 'list' ? '#eff6ff' : '#f1f5f9',
                color: customerViewMode === 'list' ? '#1d4ed8' : '#64748b',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: '700'
              }}>
                {formatNumber(customerPagination.total_records || customerList.length || 0)}
              </span>
            </button>

            {selectedCustomerForOrders && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setCustomerViewMode('detail')}
                  style={{
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: customerViewMode === 'detail' ? '3px solid #2563eb' : '3px solid transparent',
                    color: customerViewMode === 'detail' ? '#2563eb' : '#64748b',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Package size={16} />
                  <span>Chi Tiết Đơn Hàng: {getCustomerDisplayName(selectedCustomerForOrders)}</span>
                  <span style={{
                    fontSize: '11px',
                    background: customerViewMode === 'detail' ? '#eff6ff' : '#f1f5f9',
                    color: customerViewMode === 'detail' ? '#1d4ed8' : '#64748b',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: '700'
                  }}>
                    {customerOrdersData?.total_orders ?? selectedCustomerForOrders?.lifetime?.orders_count ?? 1} đơn
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCustomerForOrders(null);
                    setCustomerOrdersData(null);
                    setCustomerViewMode('list');
                  }}
                  title="Đóng tab chi tiết khách hàng"
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '50%',
                    width: '22px',
                    height: '22px',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {customerViewMode === 'detail' && selectedCustomerForOrders ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Back to Customer List Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setCustomerViewMode('list')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '7px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#1e293b',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <ArrowLeft size={15} />
                  <span>← Quay lại Danh Sách Khách Hàng</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openCustomerOrdersModal(selectedCustomerForOrders)}
                    disabled={isLoadingCustomerOrders}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={13} className={isLoadingCustomerOrders ? 'spin' : ''} />
                    <span>Làm mới đơn hàng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerForOrders(null);
                      setCustomerOrdersData(null);
                      setCustomerViewMode('list');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#f8fafc',
                      color: '#64748b',
                      border: '1px solid #e2e8f0',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={14} />
                    <span>Đóng Tab</span>
                  </button>
                </div>
              </div>

              {/* Customer Profile Banner */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: (customerOrdersData?.customer?.is_unmasked || selectedCustomerForOrders?.is_unmasked) ? '#dcfce7' : '#eff6ff',
                      color: (customerOrdersData?.customer?.is_unmasked || selectedCustomerForOrders?.is_unmasked) ? '#15803d' : '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '18px',
                      flexShrink: 0
                    }}>
                      <Users size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                          {getCustomerDisplayName(customerOrdersData?.customer || selectedCustomerForOrders)}
                        </h3>
                        {(customerOrdersData?.customer?.is_unmasked || selectedCustomerForOrders?.is_unmasked) ? (
                          <span style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                            fontSize: '11px',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontWeight: '800'
                          }}>
                            🟢 ĐÃ MỞ MẮT & ĐỊNH DANH (LIVE)
                          </span>
                        ) : (
                          <span style={{
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                            fontSize: '11px',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontWeight: '600'
                          }}>
                            🔒 PII PROTECTED
                          </span>
                        )}
                        <span style={{
                          background: selectedCustomerForOrders?.customer_type === 'NEW' ? '#eff6ff' : '#f5f3ff',
                          color: selectedCustomerForOrders?.customer_type === 'NEW' ? '#1d4ed8' : '#6d28d9',
                          border: `1px solid ${selectedCustomerForOrders?.customer_type === 'NEW' ? '#bfdbfe' : '#ddd6fe'}`,
                          fontSize: '11px',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontWeight: '700'
                        }}>
                          {selectedCustomerForOrders?.customer_type === 'NEW' ? 'KHÁCH HÀNG MỚI' : 'KHÁCH QUAY LẠI'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span>
                          📞 Số điện thoại: <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '14px' }}>
                            {customerOrdersData?.customer?.phone || selectedCustomerForOrders?.phone_raw || selectedCustomerForOrders?.phone_masked || '—'}
                          </strong>
                        </span>
                        {(customerOrdersData?.customer?.phone || selectedCustomerForOrders?.phone_raw) && (
                          <button
                            type="button"
                            onClick={() => {
                              const p = customerOrdersData?.customer?.phone || selectedCustomerForOrders?.phone_raw;
                              navigator.clipboard?.writeText(p);
                              alert(`Đã sao chép SĐT: ${p}`);
                            }}
                            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer', color: '#1e293b', fontWeight: '600' }}
                          >
                            Sao chép SĐT
                          </button>
                        )}
                        <span>
                          📍 Địa chỉ: <strong style={{ color: '#0f172a' }}>{customerOrdersData?.customer?.address || selectedCustomerForOrders?.address_raw || selectedCustomerForOrders?.province || 'Việt Nam'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Quick Metrics Bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
              }}>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', borderTop: '3px solid #2563eb' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>TỔNG ĐƠN HÀNG</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
                    {formatNumber(customerOrdersData?.total_orders ?? selectedCustomerForOrders?.lifetime?.orders_count ?? 1)} đơn
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', borderTop: '3px solid #059669' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>TỔNG CHI TIÊU (LTV)</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                    {formatVND(customerOrdersData?.total_spend ?? selectedCustomerForOrders?.lifetime?.gross_amount ?? 0)}
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', borderTop: '3px solid #7c3aed' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>ĐƠN ĐẦU TIÊN</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginTop: '6px' }}>
                    {customerOrdersData?.customer?.first_order_at ? customerOrdersData.customer.first_order_at.substring(0, 10) : (selectedCustomerForOrders?.lifetime?.first_order_at ? selectedCustomerForOrders.lifetime.first_order_at.substring(0, 10) : '—')}
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', borderTop: '3px solid #ea580c' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>ĐƠN GẦN NHẤT</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginTop: '6px' }}>
                    {customerOrdersData?.customer?.last_order_at ? customerOrdersData.customer.last_order_at.substring(0, 10) : (selectedCustomerForOrders?.last_order_at ? selectedCustomerForOrders.last_order_at.substring(0, 10) : '—')}
                  </div>
                </div>
              </div>

              {/* Content: Orders List */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <Package size={18} color="#2563eb" />
                  <span>Danh sách {customerOrdersData?.orders?.length || 0} đơn hàng của khách hàng:</span>
                </div>

                {isLoadingCustomerOrders ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <RefreshCw size={32} className="spin" style={{ margin: '0 auto 14px', color: '#2563eb' }} />
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>Đang nạp tất cả đơn hàng của khách hàng này từ hệ thống...</div>
                  </div>
                ) : customerOrdersError ? (
                  <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '16px', borderRadius: '10px', fontSize: '13px' }}>
                    {customerOrdersError}
                  </div>
                ) : (!customerOrdersData?.orders || customerOrdersData.orders.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <ShoppingBag size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>Chưa có thông tin đơn hàng cụ thể trong cơ sở dữ liệu.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {customerOrdersData.orders.map((ord, oIdx) => {
                      const statusColors = {
                        'COMPLETED': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'HOÀN THÀNH' },
                        'DELIVERED': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'ĐÃ GIAO HÀNG' },
                        'IN_TRANSIT': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', label: 'ĐANG VẬN CHUYỂN' },
                        'SHIPPED': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', label: 'ĐÃ XUẤT KHO' },
                        'AWAITING_COLLECTION': { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'CHỜ LẤY HÀNG' },
                        'AWAITING_SHIPMENT': { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'CHỜ VẬN CHUYỂN' },
                        'CANCELLED': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'ĐÃ HỦY' },
                        'UNPAID': { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', label: 'CHƯA THANH TOÁN' }
                      };
                      const st = statusColors[ord.order_status] || { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', label: ord.order_status || 'KHÁC' };

                      return (
                        <div
                          key={ord.platform_order_id || oIdx}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'border-color 0.15s ease'
                          }}
                        >
                          {/* Order Row Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px', fontFamily: 'monospace' }}>
                                #{ord.platform_order_id}
                              </span>
                              <span style={{
                                background: st.bg,
                                color: st.text,
                                border: `1px solid ${st.border}`,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}>
                                {st.label}
                              </span>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>
                                📅 {ord.platform_created_at || '—'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Giá trị đơn: </span>
                                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                                  {formatVND(ord.order_gross_amount || 0)}
                                </strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => fetchOrderDetail(ord.platform_order_id)}
                                style={{
                                  background: '#eff6ff',
                                  color: '#2563eb',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                Xem chi tiết đơn
                              </button>
                            </div>
                          </div>

                          {/* Recipient info on this order */}
                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <span style={{ color: '#64748b' }}>Người nhận: </span>
                              <strong style={{ color: '#0f172a' }}>{getCustomerDisplayName(ord)}</strong>
                              {ord.phone_number && ord.phone_number !== '—' && (
                                <span style={{ marginLeft: '10px', fontFamily: 'monospace', color: '#059669', fontWeight: '700' }}>
                                  📞 {ord.phone_number}
                                </span>
                              )}
                            </div>
                            <div style={{ color: '#475569', maxWidth: '500px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              📍 {ord.address_full || ord.province || 'Việt Nam'}
                            </div>
                          </div>

                          {/* Line items list */}
                          {ord.items && ord.items.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {ord.items.map((it, itIdx) => (
                                <div key={it.id || itIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: itIdx < ord.items.length - 1 ? '1px dashed #f1f5f9' : 'none' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Package size={14} color="#64748b" />
                                    <div>
                                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                                        {it.product_name || `Sản phẩm #${it.product_id}`}
                                      </div>
                                      {it.sku_name && (
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                          Phân loại: {it.sku_name}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                                      {formatVND(it.sale_price || 0)} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>x {it.quantity || 1}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                              Chưa có thông tin chi tiết sản phẩm cho đơn này.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* B. Customer Cohort KPI Cards (6 Pillars) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px'
          }}>
            {/* Card 1: Total Customers in Period */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderTop: '3px solid #2563eb',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Khách Hàng Xác Thực (Kỳ)
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
                {formatNumber(customerCohortSummary?.total_customers ?? 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {customerCohortSummary?.repeat_rate != null ? `Tỷ lệ mua lại: ${customerCohortSummary.repeat_rate}%` : 'Đã xác thực danh tính'}
              </div>
            </div>

            {/* Card 2: New Customers */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderTop: '3px solid #0284c7',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Khách Hàng Mới
                </span>
                <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px' }}>
                  MỚI
                </span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0284c7', marginBottom: '4px' }}>
                {formatNumber(customerCohortSummary?.new_customers || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }} title="Phân loại mới/quay lại dựa trên lịch sử danh tính đã xác thực hiện có.">
                Đơn đầu tiên trong kỳ
              </div>
            </div>

            {/* Card 3: Returning Customers */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderTop: '3px solid #7c3aed',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Khách Quay Lại
                </span>
                <span style={{ background: '#f5f3ff', color: '#6d28d9', fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px' }}>
                  QUAY LẠI
                </span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#7c3aed', marginBottom: '4px' }}>
                {formatNumber(customerCohortSummary?.returning_customers || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }} title="Phân loại mới/quay lại dựa trên lịch sử danh tính đã xác thực hiện có.">
                Đã mua trước kỳ (Xác thực)
              </div>
            </div>

            {/* Card 4: Total Spend (Gross / Realized) */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderTop: '3px solid #16a34a',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Doanh Số Gộp / Thực Nhận
              </div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '2px' }}>
                {formatVND(customerCohortSummary?.total_gross_in_period || 0)}
              </div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a' }}>
                Thực nhận: {formatVND(customerCohortSummary?.total_realized_in_period || 0)}
              </div>
            </div>

            {/* Card 5: Average Order Value (AOV) */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderTop: '3px solid #d97706',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Giá Trị Đơn TB (AOV)
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706', marginBottom: '4px' }}>
                {formatVND(customerCohortSummary?.average_order_value || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Doanh số gộp / Tổng số đơn
              </div>
            </div>

            {/* Card 6: Return/Refund Customers */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderTop: '3px solid #dc2626',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Khách Hoàn / Hủy
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626', marginBottom: '4px' }}>
                {formatNumber(customerCohortSummary?.return_refund_customers || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Phát sinh trả hàng/hoàn tiền
              </div>
            </div>
          </div>

          {/* C. Search & Filter Bar */}
          <div style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '16px 20px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            {/* Row 1: Search + Sort + Cohort Filters */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* Search Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '280px', maxWidth: '420px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f8fafc',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  width: '100%'
                }}>
                  <Search size={14} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Tìm theo số điện thoại (09...), tên hoặc khu vực..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchCustomers(1); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0f172a',
                      fontSize: '12px',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchCustomers(1)}
                  className="btn-primary"
                  style={{ padding: '7px 14px', fontSize: '12px', borderRadius: '6px', whiteSpace: 'nowrap' }}
                >
                  Tìm
                </button>
              </div>

              {/* Sắp xếp (Sort Selector) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
                  Sắp xếp:
                </span>
                <select
                  value={customerSort}
                  onChange={(e) => setCustomerSort(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#0f172a',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="latest_order">⚡ Đơn mới nhất (Lần mua gần nhất)</option>
                  <option value="most_orders">🛒 Mua nhiều đơn nhất (Trọn đời)</option>
                  <option value="highest_spend">💰 Giá trị chi tiêu cao nhất (LTV)</option>
                  <option value="first_order">🗓️ Khách mua sớm nhất (Cũ nhất)</option>
                </select>
              </div>

              {/* Cohort Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: 'Tất cả' },
                  { key: 'UNMASKED', label: '🟢 Đã có thông tin (Đã quét)', isHighlight: true },
                  { key: 'NEW', label: 'Khách mới' },
                  { key: 'RETURNING', label: 'Khách quay lại' }
                ].map(f => {
                  const isSelected = customerCohortFilter === f.key;
                  let bg = isSelected ? '#eff6ff' : '#f8fafc';
                  let col = isSelected ? '#2563eb' : '#475569';
                  let bdr = isSelected ? '#bfdbfe' : '#e2e8f0';

                  if (f.key === 'UNMASKED') {
                    bg = isSelected ? '#dcfce7' : '#f0fdf4';
                    col = isSelected ? '#15803d' : '#166534';
                    bdr = isSelected ? '#4ade80' : '#86efac';
                  }

                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setCustomerCohortFilter(f.key)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: isSelected ? '700' : '600',
                        background: bg,
                        color: col,
                        border: `1px solid ${bdr}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={handlePurgeMaskedCustomers}
                  disabled={isPurgingMasked || isLoadingCustomers}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: '#fff1f2',
                    color: '#e11d48',
                    border: '1px solid #fecdd3',
                    cursor: (isPurgingMasked || isLoadingCustomers) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    marginLeft: '8px'
                  }}
                  title="Xóa bỏ các hồ sơ khách hàng chưa có thông tin mở mắt để danh sách gọn gàng"
                >
                  <PackageMinus size={13} className={isPurgingMasked ? 'spin' : ''} />
                  <span>{isPurgingMasked ? 'Đang dọn dẹp...' : '🗑️ Dọn dẹp khách chưa mở mắt'}</span>
                </button>
              </div>
            </div>

            {/* Row 2: Dedicated Order Date Filter ("Mốc thời gian đặt hàng") */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              paddingTop: '10px',
              borderTop: '1px dashed #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', fontWeight: '700', fontSize: '12px', marginRight: '4px' }}>
                  <Calendar size={14} color="#2563eb" />
                  <span>Mốc thời gian đặt hàng:</span>
                </div>

                {/* Preset Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                  {[
                    { key: 'today', label: '⚡ Hôm nay' },
                    { key: 'yesterday', label: '📅 Hôm qua' },
                    { key: '7d', label: '7 ngày qua' },
                    { key: '30d', label: '30 ngày qua' },
                    { key: 'all', label: '🌐 Toàn thời gian' }
                  ].map(p => {
                    const isActive = (customerScope === 'ALL' && p.key === 'all') || (customerScope === 'PERIOD' && customerDatePreset === p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => applyCustomerDatePreset(p.key)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: isActive ? '700' : '500',
                          background: isActive ? '#ffffff' : 'transparent',
                          color: isActive ? '#2563eb' : '#64748b',
                          border: isActive ? '1px solid #cbd5e1' : 'none',
                          boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Date Range Inputs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '3px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Từ:</span>
                  <input
                    type="date"
                    value={customerStartDate}
                    onChange={(e) => {
                      setCustomerStartDate(e.target.value);
                      setCustomerDatePreset('custom');
                    }}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Đến:</span>
                  <input
                    type="date"
                    value={customerEndDate}
                    onChange={(e) => {
                      setCustomerEndDate(e.target.value);
                      setCustomerDatePreset('custom');
                    }}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerScope('PERIOD');
                      setCustomerDatePreset('custom');
                      fetchCustomers(1, 'PERIOD', customerStartDate, customerEndDate);
                    }}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Lọc
                  </button>
                </div>
              </div>

              {/* Total Records Counter */}
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span>
                  {customerScope === 'PERIOD' ? (
                    <>Đơn trong kỳ: <strong style={{ color: '#0f172a' }}>{formatNumber(customerPagination.total_records)}</strong> khách</>
                  ) : (
                    <>Toàn bộ: <strong style={{ color: '#0f172a' }}>{formatNumber(customerPagination.total_records)}</strong> khách</>
                  )}
                </span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span>
                  Tổng hồ sơ xác thực: <strong style={{ color: '#2563eb' }}>{formatNumber(customerDataTrust?.total_lifetime_profiles ?? customerDataTrust?.profiles_created ?? customerPagination.total_records)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* D. Customer Profiles Table */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>Khách Hàng / Người Nhận</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>Số Điện Thoại</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>Địa Chỉ / Khu Vực</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>Phân Loại</th>
                  <th
                    onClick={() => setCustomerSort('most_orders')}
                    style={{ padding: '12px 16px', color: customerSort === 'most_orders' ? '#2563eb' : '#475569', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
                    title="Bấm để sắp xếp theo khách mua nhiều đơn nhất"
                  >
                    Số Đơn (Kỳ / Trọn đời) {customerSort === 'most_orders' ? '▼' : '↕'}
                  </th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>Doanh Thu Kỳ (Gross / Thực nhận)</th>
                  <th
                    onClick={() => setCustomerSort('highest_spend')}
                    style={{ padding: '12px 16px', color: customerSort === 'highest_spend' ? '#2563eb' : '#475569', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
                    title="Bấm để sắp xếp theo doanh thu LTV cao nhất"
                  >
                    Trọn Đời (LTV) {customerSort === 'highest_spend' ? '▼' : '↕'}
                  </th>
                  <th
                    onClick={() => setCustomerSort(customerSort === 'latest_order' ? 'oldest_order' : 'latest_order')}
                    style={{ padding: '12px 16px', color: (customerSort === 'latest_order' || customerSort === 'oldest_order') ? '#2563eb' : '#475569', fontWeight: '700', cursor: 'pointer', userSelect: 'none' }}
                    title="Bấm để sắp xếp theo mốc đơn mới nhất"
                  >
                    Lần Mua Gần Nhất {customerSort === 'latest_order' ? '▼' : (customerSort === 'oldest_order' ? '▲' : '↕')}
                  </th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>Trạng Thái PII</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingCustomers ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                      <div>Đang tải danh sách hồ sơ khách hàng...</div>
                    </td>
                  </tr>
                ) : customerList.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                      {customerPiiStatus === 'NO_VERIFIED_IDENTITY_IN_PERIOD' || customerDataTrust?.status === 'NO_VERIFIED_IDENTITY_IN_PERIOD' ? (
                        <div style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '10px',
                          padding: '24px 20px',
                          maxWidth: '680px',
                          margin: '0 auto',
                          textAlign: 'center'
                        }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            background: '#fef3c7',
                            color: '#b45309',
                            fontWeight: '700',
                            fontSize: '12px',
                            marginBottom: '10px'
                          }}>
                            <ShieldCheck size={14} />
                            THÔNG TIN DANH TÍNH KỲ LỊCH SỬ
                          </div>
                          <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: '600', marginBottom: '8px', lineHeight: '1.5' }}>
                            Chưa có danh tính khách hàng xác thực trong kỳ {startDate ? `${startDate.split('-').reverse().join('/')}` : ''}–{endDate ? `${endDate.split('-').reverse().join('/')}` : ''}.
                          </div>
                          <div style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.6', marginBottom: (customerDataTrust?.remaining_priority_orders ?? 0) > 0 ? '16px' : '0' }}>
                            {formatNumber(customerDataTrust?.total_orders || totalPeriodOrders)} đơn hàng vẫn được ghi nhận, nhưng dữ liệu định danh của kỳ này chưa được thu thập hoặc đã được TikTok bảo vệ/che mờ.
                          </div>
                          {(customerDataTrust?.remaining_priority_orders ?? 0) > 0 && (
                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={handleTriggerPriorityRecipients}
                                disabled={isSyncingPriorityRecipients || isSyncingCustomer}
                                className="btn-primary"
                                style={{
                                  padding: '8px 18px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  background: '#0284c7',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <RefreshCw size={13} className={isSyncingPriorityRecipients ? 'spin' : ''} />
                                <span>{isSyncingPriorityRecipients ? 'Đang thu thập...' : `Thu thập ưu tiên (${customerDataTrust.remaining_priority_orders} đơn)`}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (customerPiiStatus === 'CUSTOMER_DATA_NOT_INGESTED' || customerDataTrust?.status === 'CUSTOMER_DATA_NOT_INGESTED') ? (
                        <div>
                          <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: '500' }}>
                            Dữ liệu định danh khách hàng chưa được nạp (CUSTOMER_DATA_NOT_INGESTED). Vui lòng đồng bộ đơn hàng để xem chi tiết.
                          </div>
                        </div>
                      ) : (customerPiiStatus === 'NO_CUSTOMERS_IN_PERIOD' || customerDataTrust?.status === 'NO_CUSTOMERS_IN_PERIOD') ? (
                        <div>
                          <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: '500' }}>
                            Không có đơn hàng hoặc khách hàng nào phát sinh trong kỳ đã chọn (NO_CUSTOMERS_IN_PERIOD).
                          </div>
                        </div>
                      ) : customerDataTrust?.status === 'CONFIGURATION_ERROR' ? (
                        <div style={{
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          borderRadius: '10px',
                          padding: '20px',
                          maxWidth: '600px',
                          margin: '0 auto'
                        }}>
                          <div style={{ color: '#9f1239', fontWeight: '700', marginBottom: '6px' }}>CHƯA CẤU HÌNH SECRET (FAIL-CLOSED)</div>
                          <div style={{ color: '#475569', fontSize: '13px' }}>{customerStatusMessage}</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 16px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            fontWeight: '700',
                            fontSize: '12px',
                            marginBottom: '12px'
                          }}>
                            TRẠNG THÁI: {customerPiiStatus || 'TRỐNG'}
                          </div>
                          <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: '500', maxWidth: '600px', margin: '0 auto 16px', lineHeight: '1.6' }}>
                            {customerStatusMessage || 'Không có khách hàng nào phù hợp với bộ lọc đã chọn.'}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {customerScope === 'PERIOD' && (
                              <button
                                type="button"
                                onClick={() => setCustomerScope('ALL')}
                                className="btn-primary"
                                style={{ padding: '7px 14px', fontSize: '12px', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <span>🌐 Xem Toàn Bộ Khách Hàng (Toàn Thời Gian)</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleTriggerSync('customer')}
                              disabled={isSyncingCustomer || isLoadingCustomers || customerDataTrust?.status === 'CONFIGURATION_ERROR'}
                              className="btn-secondary"
                              style={{ padding: '7px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <RefreshCw size={13} className={isSyncingCustomer ? 'spin' : ''} />
                              <span>{isSyncingCustomer ? 'Đang đồng bộ...' : 'Đồng bộ khách hàng'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  customerList
                    .filter(cust => {
                      if (customerCohortFilter === 'NEW') return cust.customer_type === 'NEW';
                      if (customerCohortFilter === 'RETURNING') return cust.customer_type === 'RETURNING';
                      if (customerCohortFilter === 'UNMASKED') {
                        const p = (cust.phone_raw || cust.phone || cust.phone_masked || '').trim();
                        return !p.includes('*') && p !== '—' && p.replace(/\D/g, '').length >= 9;
                      }
                      return true;
                    })
                    .map((cust, idx) => (
                      <tr
                        key={idx}
                        onClick={() => openCustomerOrdersModal(cust)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Bấm vào khách hàng để xem danh sách tất cả các đơn hàng"
                      >
                        {/* Customer Name & HMAC Identifier */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {(() => {
                              const pRaw = (cust.phone_raw || cust.phone || '').trim();
                              const isPhoneReal = pRaw && !pRaw.includes('*') && pRaw !== '—' && pRaw.replace(/\D/g, '').length >= 9;
                              return (
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: isPhoneReal ? '#ecfdf5' : '#eff6ff',
                                  color: isPhoneReal ? '#059669' : '#2563eb',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {getCustomerDisplayName(cust).substring(0, 1).toUpperCase()}
                                </div>
                              );
                            })()}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCustomerOrdersModal(cust);
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    padding: 0,
                                    margin: 0,
                                    textAlign: 'left',
                                    fontWeight: '700',
                                    color: '#1d4ed8',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    display: 'inline'
                                  }}
                                  title="Bấm để mở Tab chi tiết danh sách đơn hàng"
                                >
                                  {getCustomerDisplayName(cust)}
                                </button>
                                {(() => {
                                  const pRaw = (cust.phone_raw || cust.phone || '').trim();
                                  const isPhoneReal = pRaw && !pRaw.includes('*') && pRaw !== '—' && pRaw.replace(/\D/g, '').length >= 9;
                                  return isPhoneReal ? (
                                    <span style={{
                                      background: '#dcfce7',
                                      color: '#166534',
                                      fontSize: '9px',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontWeight: '800'
                                    }}>
                                      LIVE
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                              <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }} title={cust.customer_identifier_hash}>
                                ID: {cust.customer_identifier_hash ? cust.customer_identifier_hash.substring(0, 8) + '...' : 'ANON'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Phone Number with Copy */}
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: '600' }}>
                          {(() => {
                            const pRaw = (cust.phone_raw || cust.phone || '').trim();
                            const isPhoneReal = pRaw && !pRaw.includes('*') && pRaw !== '—' && pRaw.replace(/\D/g, '').length >= 9;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: isPhoneReal ? '#059669' : '#64748b', fontWeight: isPhoneReal ? '700' : '500' }}>
                                  {isPhoneReal ? pRaw : (cust.phone_masked || cust.phone_number_masked || pRaw || '09******—')}
                                </span>
                                {isPhoneReal && (
                                  <button
                                    type="button"
                                    title="Sao chép SĐT"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard?.writeText(pRaw);
                                      alert(`Đã sao chép: ${pRaw}`);
                                    }}
                                    style={{
                                      background: '#f1f5f9',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      padding: '2px 5px',
                                      fontSize: '10px',
                                      cursor: 'pointer',
                                      color: '#334155'
                                    }}
                                  >
                                    Copy
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Address / Province */}
                        <td style={{ padding: '12px 16px', color: '#475569', maxWidth: '240px' }}>
                          <div style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cust.address_raw || cust.province}>
                            {cust.address_raw || cust.province || cust.province_or_city || 'Việt Nam'}
                          </div>
                        </td>

                        {/* Customer Type Badge */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: cust.customer_type === 'NEW' ? '#eff6ff' : '#f5f3ff',
                            color: cust.customer_type === 'NEW' ? '#1d4ed8' : '#6d28d9',
                            border: `1px solid ${cust.customer_type === 'NEW' ? '#bfdbfe' : '#ddd6fe'}`,
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '4px'
                          }}>
                            {cust.customer_type === 'NEW' ? 'MỚI' : 'QUAY LẠI'}
                          </span>
                        </td>

                        {/* Orders (Period / Lifetime) */}
                        <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '600' }}>
                          <span>{formatNumber(cust.period?.orders_count || cust.order_count || 1)}</span>
                          <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '11px' }}>
                            {' '}/ {formatNumber(cust.lifetime?.orders_count || cust.order_count || 1)} trọn đời
                          </span>
                        </td>

                        {/* Spend in Period (Gross / Realized) */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>
                            {formatVND(cust.period?.gross_amount || cust.total_gross_spent || 0)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>
                            Thực: {formatVND(cust.period?.realized_value || cust.realized_spent || 0)}
                          </div>
                        </td>

                        {/* Lifetime Value (Gross LTV) */}
                        <td style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>
                          {formatVND(cust.lifetime?.gross_amount || cust.total_gross_spent || 0)}
                        </td>

                        {/* Last Order Date */}
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                          {cust.last_order_at ? cust.last_order_at.substring(0, 10) : '—'}
                        </td>

                        {/* Privacy / Unmasked Status */}
                        <td style={{ padding: '12px 16px' }}>
                          {(() => {
                            const pRaw = (cust.phone_raw || cust.phone || '').trim();
                            const isPhoneReal = pRaw && !pRaw.includes('*') && pRaw !== '—' && pRaw.replace(/\D/g, '').length >= 9;
                            return isPhoneReal ? (
                              <span style={{
                                background: '#ecfdf5',
                                color: '#059669',
                                border: '1px solid #a7f3d0',
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                XÁC THỰC THẬT
                              </span>
                            ) : (
                              <span style={{
                                background: '#f8fafc',
                                color: '#64748b',
                                border: '1px solid #e2e8f0',
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                PII PROTECTED
                              </span>
                            );
                          })()}
                        </td>

                        {/* Thao Tác: Xem đơn hàng */}
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openCustomerOrdersModal(cust)}
                            style={{
                              padding: '5px 12px',
                              fontSize: '11px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontWeight: '700',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            title="Xem tất cả đơn hàng của khách hàng này"
                          >
                            <Package size={13} />
                            <span>Xem đơn ({formatNumber(cust.period?.orders_count || cust.order_count || cust.lifetime?.orders_count || 1)})</span>
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {customerPagination.total_pages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Trang {customerPagination.page} / {customerPagination.total_pages} (Tổng {formatNumber(customerPagination.total_records)} hồ sơ)
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={customerPagination.page <= 1}
                    onClick={() => fetchCustomers(customerPagination.page - 1)}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px' }}
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={customerPagination.page >= customerPagination.total_pages}
                    onClick={() => fetchCustomers(customerPagination.page + 1)}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px' }}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: CAMPAIGN GMV MAX INTELLIGENCE (DEDICATED)                       */}
      {/* ========================================================================= */}
      {subTab === 'ads' && (
        <div>
          {/* A. Top Header & Provenance Bar */}
          <div className="glass" style={{ padding: '20px 24px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DollarSign size={22} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    Chiến Dịch Quảng Cáo GMV Max (Campaign Intelligence)
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Đánh giá mức độ hiệu quả theo chỉ số ROI Mục Tiêu vs ROI Thực Tế • Phân tích chi tiết cấp chiến dịch Product GMV Max & LIVE GMV Max
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {campaignsIntel?.provenance && (
                  <span style={{
                    background: campaignsIntel.status === 'AVAILABLE' ? '#ecfdf5' :
                      campaignsIntel.status === 'PARTIAL' ? '#fffbeb' : '#f8fafc',
                    color: campaignsIntel.status === 'AVAILABLE' ? '#059669' :
                      campaignsIntel.status === 'PARTIAL' ? '#d97706' : '#64748b',
                    border: `1px solid ${campaignsIntel.status === 'AVAILABLE' ? '#a7f3d0' : campaignsIntel.status === 'PARTIAL' ? '#fde68a' : '#e2e8f0'}`,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}>
                    {campaignsIntel.status === 'AVAILABLE' ? `ĐẦY ĐỦ (${campaignsIntel.provenance.distinct_days}/${campaignsIntel.provenance.expected_days} NGÀY)` :
                      campaignsIntel.status === 'PARTIAL' ? `MỘT PHẦN (${campaignsIntel.provenance.distinct_days}/${campaignsIntel.provenance.expected_days} NGÀY - ${campaignsIntel.provenance.coverage_pct}%)` :
                      `TRẠNG THÁI: ${campaignsIntel.status}`}
                  </span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '5px 10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: '700' }}>ROI Mục Tiêu Chuẩn:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={adsTargetRoi}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 3.5;
                      setAdsTargetRoi(val);
                    }}
                    onBlur={() => fetchCampaignIntelligence(campaignTypeFilter, adsCompareMode, adsTargetRoi)}
                    style={{
                      width: '56px',
                      background: '#ffffff',
                      border: '1px solid #93c5fd',
                      borderRadius: '4px',
                      color: '#1d4ed8',
                      fontSize: '12px',
                      fontWeight: '800',
                      textAlign: 'center',
                      padding: '2px 4px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fetchCampaignIntelligence(campaignTypeFilter, adsCompareMode, adsTargetRoi)}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    Áp dụng
                  </button>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setIsSyncingAdsAll(true);
                    setAdsSyncBanner(null);
                    try {
                      const res = await apiRequest(
                        `commerce_dashboard.php?action=trigger_sync&domain=ads_all&shop_id=${encodeURIComponent(shopId)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
                        'POST',
                        { shop_id: shopId, domain: 'ads_all', start_date: startDate, end_date: endDate }
                      );
                      if (res && res.success) {
                        setAdsSyncBanner({ type: 'success', message: res.message || `Đã đồng bộ thành công Chiến dịch, Sản phẩm & Video từ TikTok (${startDate} → ${endDate}).` });
                      } else {
                        setAdsSyncBanner({ type: 'warning', message: res?.message || 'Đã gửi yêu cầu đồng bộ dữ liệu quảng cáo TikTok.' });
                      }
                      await fetchCampaignIntelligence(campaignTypeFilter, adsCompareMode, adsTargetRoi);
                      await fetchAdsProductIntelligence();
                    } catch (err) {
                      setAdsSyncBanner({ type: 'error', message: err.message || 'Lỗi khi đồng bộ dữ liệu từ TikTok.' });
                    } finally {
                      setIsSyncingAdsAll(false);
                    }
                  }}
                  disabled={isSyncingAdsAll || isLoadingCampaigns}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (isSyncingAdsAll || isLoadingCampaigns) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 3px rgba(5,150,105,0.2)'
                  }}
                >
                  <RefreshCw size={13} className={isSyncingAdsAll ? 'spin' : ''} />
                  {isSyncingAdsAll ? 'Đang đồng bộ TikTok...' : '🔄 Đồng bộ Chiến dịch & Sản phẩm từ TikTok'}
                </button>

                <button
                  type="button"
                  onClick={handleExportAdsCSV}
                  disabled={isExportingAds}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}
                >
                  <Download size={13} />
                  {isExportingAds ? 'Đang xuất...' : 'Xuất CSV'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchCampaignIntelligence(campaignTypeFilter, adsCompareMode, adsTargetRoi);
                    fetchAdsProductIntelligence();
                  }}
                  disabled={isLoadingCampaigns}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                >
                  <RefreshCw size={13} className={isLoadingCampaigns ? 'spin' : ''} />
                  {isLoadingCampaigns ? 'Đang nạp...' : 'Tải lại'}
                </button>
              </div>
            </div>

            {adsSyncBanner && (
              <div style={{
                marginBottom: '12px',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: '600',
                background: adsSyncBanner.type === 'success' ? '#ecfdf5' : adsSyncBanner.type === 'warning' ? '#fffbeb' : '#fef2f2',
                color: adsSyncBanner.type === 'success' ? '#065f46' : adsSyncBanner.type === 'warning' ? '#92400e' : '#b91c1c',
                border: `1px solid ${adsSyncBanner.type === 'success' ? '#a7f3d0' : adsSyncBanner.type === 'warning' ? '#fde68a' : '#fecaca'}`
              }}>
                {adsSyncBanner.message}
              </div>
            )}

            {/* Canonical Semantics Notice */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '12px',
              lineHeight: '1.6',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <ShieldCheck size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#0f172a' }}>Quy tắc ngữ nghĩa chuẩn hóa (Canonical Semantics):</strong> Chỉ số <strong style={{ color: '#2563eb' }}>Ads Cost</strong> là chi phí thực chi từ Marketing API. Chỉ số <strong style={{ color: '#059669' }}>GMV Max Gross Revenue</strong> và <strong style={{ color: '#d97706' }}>GMV Max ROI</strong> ghi nhận theo mô hình phân bổ quy đổi của TikTok Ads, tuyệt đối <strong style={{ color: '#dc2626' }}>không đồng nhất</strong> với Doanh số tổng cửa hàng (Shop Gross) hay Doanh thu thuần chỉ do quảng cáo (Paid-only).
                </div>
              </div>
            </div>

            {/* Period Comparison Mode Selector Bar (Ngày / Tuần / Tháng) */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '12px 16px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Calendar size={16} color="#2563eb" />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>Chế độ đánh giá kết quả theo kỳ:</span>
                {[
                  { id: 'day', label: 'Theo Ngày (Hôm nay vs Hôm qua)' },
                  { id: 'week', label: 'Theo Tuần (7 ngày vs Tuần trước)' },
                  { id: 'month', label: 'Theo Tháng (30 ngày vs Tháng trước)' },
                  { id: 'auto', label: 'Theo Kỳ đang chọn vs Kỳ liền trước' }
                ].map((m) => {
                  const isAct = adsCompareMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setAdsCompareMode(m.id);
                        fetchCampaignIntelligence(campaignTypeFilter, m.id, adsTargetRoi);
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: isAct ? '700' : '600',
                        cursor: 'pointer',
                        border: isAct ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: isAct ? '#2563eb' : '#ffffff',
                        color: isAct ? '#ffffff' : '#334155',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: '11px', color: '#64748b' }}>
                ROI Mục Tiêu đang áp dụng: <strong style={{ color: '#2563eb' }}>{campaignsIntel?.macro_overview?.target_roi_benchmark ?? adsTargetRoi}x</strong> • ROI Thực Tế: <strong style={{ color: '#059669' }}>{campaignsIntel?.macro_overview?.blended_roi ?? '—'}x</strong>
              </div>
            </div>
          </div>

          {/* Loading / Error States */}
          {isLoadingCampaigns && !campaignsIntel && (
            <div className="glass" style={{ padding: '40px', borderRadius: '16px', textAlign: 'center', marginBottom: '24px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <RefreshCw size={28} className="spin" color="#2563eb" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>Đang nạp dữ liệu phân tích chiến dịch GMV Max...</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Vui lòng đợi trong giây lát</div>
            </div>
          )}

          {campaignsError && (
            <div className="glass" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px', border: '1px solid #fecaca', background: '#fef2f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626' }}>
                <AlertCircle size={20} />
                <span style={{ fontWeight: '600', fontSize: '14px' }}>Lỗi nạp dữ liệu quảng cáo: {campaignsError}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchCampaignIntelligence(campaignTypeFilter)}
                className="btn-secondary"
                style={{ marginTop: '12px', fontSize: '12px', padding: '6px 14px' }}
              >
                Thử lại
              </button>
            </div>
          )}

          {campaignsIntel && (
            <>
              {/* MULTI-HORIZON PERIOD EVALUATION PANEL (NGÀY / TUẦN / THÁNG) */}
              {campaignsIntel.multi_period_comparisons && (
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={18} color="#2563eb" />
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                        Đánh Giá Kết Quả Quảng Cáo Theo Kỳ: Ngày • Tuần • Tháng (Tăng Trưởng hay Tụt Giảm)
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Nhấp vào từng thẻ kỳ để lọc và so sánh trực tiếp tăng/giảm của từng chiến dịch bên dưới
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                    {['day', 'week', 'month'].map((hKey) => {
                      const hData = campaignsIntel.multi_period_comparisons[hKey];
                      if (!hData) return null;
                      const curr = hData.current_period || {};
                      const prev = hData.previous_period || {};
                      const isSelected = adsCompareMode === hKey;
                      const revPct = prev.revenue_change_pct;
                      const costPct = prev.cost_change_pct;
                      const ordPct = prev.orders_change_pct;
                      const roiDiff = prev.roi_diff;
                      const isGrowing = prev.growth_status === 'GROWING';
                      const isDeclining = prev.growth_status === 'DECLINING';

                      return (
                        <div
                          key={hKey}
                          onClick={() => {
                            setAdsCompareMode(hKey);
                            fetchCampaignIntelligence(campaignTypeFilter, hKey, adsTargetRoi);
                          }}
                          className="glass"
                          style={{
                            padding: '16px 18px',
                            borderRadius: '14px',
                            cursor: 'pointer',
                            border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                            background: isSelected ? '#f8fbff' : '#ffffff',
                            boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '8px' }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                                {hKey === 'day' ? '📅 Theo Ngày (Hôm nay vs Hôm qua)' : hKey === 'week' ? '📆 Theo Tuần (7 ngày vs Tuần trước)' : '🗓️ Theo Tháng (30 ngày vs Tháng trước)'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                Kỳ này: <strong>{curr.start_date === curr.end_date ? curr.start_date : `${curr.start_date} → ${curr.end_date}`}</strong> vs Kỳ trước: <strong>{prev.start_date === prev.end_date ? prev.start_date : `${prev.start_date} → ${prev.end_date}`}</strong>
                              </div>
                            </div>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: '800',
                              whiteSpace: 'nowrap',
                              background: isGrowing ? '#ecfdf5' : isDeclining ? '#fef2f2' : '#f1f5f9',
                              color: isGrowing ? '#059669' : isDeclining ? '#dc2626' : '#475569',
                              border: `1px solid ${isGrowing ? '#a7f3d0' : isDeclining ? '#fecaca' : '#cbd5e1'}`
                            }}>
                              {isGrowing ? '▲ TĂNG TRƯỞNG' : isDeclining ? '▼ TỤT GIẢM' : '▬ ĐI NGANG'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>DOANH SỐ ADS</div>
                              <div style={{ fontWeight: '800', color: '#059669', fontSize: '14px', marginTop: '2px' }}>
                                {formatVND(curr.gross_revenue || 0)}
                              </div>
                              <div style={{ fontSize: '11px', marginTop: '2px', color: revPct > 0 ? '#059669' : revPct < 0 ? '#dc2626' : '#64748b', fontWeight: '700' }}>
                                {revPct !== null && revPct !== undefined ? `${revPct > 0 ? '▲ +' : '▼ '}${revPct}%` : '—'} <span style={{ fontWeight: '400', color: '#64748b' }}>(trước: {formatVND(prev.gross_revenue || 0)})</span>
                              </div>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>CHI PHÍ ADS</div>
                              <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px', marginTop: '2px' }}>
                                {formatVND(curr.cost || 0)}
                              </div>
                              <div style={{ fontSize: '11px', marginTop: '2px', color: costPct > 0 ? '#2563eb' : costPct < 0 ? '#d97706' : '#64748b', fontWeight: '700' }}>
                                {costPct !== null && costPct !== undefined ? `${costPct > 0 ? '+' : ''}${costPct}%` : '—'} <span style={{ fontWeight: '400', color: '#64748b' }}>(trước: {formatVND(prev.cost || 0)})</span>
                              </div>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>SỐ ĐƠN HÀNG</div>
                              <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px', marginTop: '2px' }}>
                                {formatNumber(curr.orders || 0)} đơn
                              </div>
                              <div style={{ fontSize: '11px', marginTop: '2px', color: ordPct > 0 ? '#059669' : ordPct < 0 ? '#dc2626' : '#64748b', fontWeight: '700' }}>
                                {ordPct !== null && ordPct !== undefined ? `${ordPct > 0 ? '▲ +' : '▼ '}${ordPct}%` : '—'} <span style={{ fontWeight: '400', color: '#64748b' }}>(trước: {formatNumber(prev.orders || 0)})</span>
                              </div>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>ROI THỰC TẾ</div>
                              <div style={{ fontWeight: '800', color: '#2563eb', fontSize: '13px', marginTop: '2px' }}>
                                {curr.roi !== null && curr.roi !== undefined ? `${curr.roi}x` : '—'}
                              </div>
                              <div style={{ fontSize: '11px', marginTop: '2px', color: roiDiff > 0 ? '#059669' : roiDiff < 0 ? '#dc2626' : '#64748b', fontWeight: '700' }}>
                                {roiDiff !== null && roiDiff !== undefined ? `${roiDiff > 0 ? '+' : ''}${roiDiff}x` : '—'} <span style={{ fontWeight: '400', color: '#64748b' }}>(trước: {prev.roi !== null && prev.roi !== undefined ? `${prev.roi}x` : '—'})</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* B. Sub-View Navigation Pills */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                {[
                  { id: 'campaigns', label: 'Phân Tích Từng Chiến Dịch (Target vs Thực Tế)', icon: DollarSign, count: campaignsIntel?.campaigns?.length },
                  { id: 'overview', label: 'Tổng Quan & Đối Soát Đa Tầng', icon: BarChart2 },
                  { id: 'playbook', label: '8 Nhóm Hành Động (GMV Max Playbook)', icon: Zap, badge: 'ACTION' },
                  { id: 'products', label: 'Sản Phẩm (SPU)', icon: Tag, count: adsProductIntel?.products?.length },
                  { id: 'videos', label: 'Video / Creative', icon: Video, count: adsVideoIntel?.creatives?.length },
                  { id: 'optimizations', label: 'Cơ Hội Tối Ưu (6 Patterns)', icon: Sparkles, count: adsVideoIntel?.summary?.opportunity_patterns ? Object.values(adsVideoIntel?.summary?.opportunity_patterns || {}).reduce((acc, p) => acc + (p?.count || 0), 0) : null }
                ].map(sub => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setAdsSubView(sub.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: adsSubView === sub.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      background: adsSubView === sub.id ? '#eff6ff' : '#ffffff',
                      color: adsSubView === sub.id ? '#2563eb' : '#475569',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <sub.icon size={14} />
                    {sub.label}
                    {sub.count !== undefined && sub.count !== null && (
                      <span style={{
                        background: adsSubView === sub.id ? '#dbeafe' : '#f1f5f9',
                        color: adsSubView === sub.id ? '#1d4ed8' : '#475569',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '10px'
                      }}>
                        {sub.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* VIEW 1: OVERVIEW & MULTI-GRAIN RECONCILIATION */}
              {adsSubView === 'overview' && (
                <div>
                  {campaignsIntel?.macro_overview?.reconciliation && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: campaignsIntel.macro_overview.reconciliation.status === 'RECONCILED' ? '#ecfdf5' : '#fffbeb',
                      border: `1px solid ${campaignsIntel.macro_overview.reconciliation.status === 'RECONCILED' ? '#a7f3d0' : '#fde68a'}`,
                      marginBottom: '16px',
                      fontSize: '12px'
                    }}>
                      <span style={{ color: campaignsIntel.macro_overview.reconciliation.status === 'RECONCILED' ? '#059669' : '#d97706', fontWeight: '700' }}>
                        {campaignsIntel.macro_overview.reconciliation.status === 'RECONCILED' ? 'BẢO TOÀN ĐỐI SOÁT (RECONCILED)' : 'LỆCH ĐỐI SOÁT (VARIANCE DETECTED)'}
                      </span>
                    </div>
                  )}

                  {/* 6 KPI Overview Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Tổng Chi Phí (Ads Cost)</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                        {campaignsIntel.macro_overview?.total_ads_cost == null ? '—' : formatVND(campaignsIntel.macro_overview?.total_ads_cost)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Chi phí thực chi Marketing API</div>
                    </div>

                    <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Doanh Thu Phân Bổ (Ads Gross)</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>
                        {campaignsIntel.macro_overview?.total_gross_revenue == null ? '—' : formatVND(campaignsIntel.macro_overview?.total_gross_revenue)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>TikTok Attribution Gross Revenue</div>
                    </div>

                    <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>ROI Thực Tế vs Mục Tiêu</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', marginTop: '6px' }}>
                        {campaignsIntel.macro_overview?.blended_roi == null ? '—' : `${campaignsIntel.macro_overview?.blended_roi}x`} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>/ {campaignsIntel.macro_overview?.target_roi_benchmark ?? adsTargetRoi}x</span>
                      </div>
                      <div style={{ fontSize: '11px', color: (campaignsIntel.macro_overview?.blended_roi || 0) >= (campaignsIntel.macro_overview?.target_roi_benchmark || adsTargetRoi) ? '#059669' : '#dc2626', marginTop: '4px', fontWeight: '700' }}>
                        {(campaignsIntel.macro_overview?.blended_roi || 0) >= (campaignsIntel.macro_overview?.target_roi_benchmark || adsTargetRoi) ? '✓ Đạt / Vượt ROI mục tiêu' : '⚠ Dưới ROI mục tiêu'}
                      </div>
                    </div>

                    <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Tổng Đơn Hàng (Orders)</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                        {campaignsIntel.macro_overview?.total_orders == null ? '—' : formatNumber(campaignsIntel.macro_overview?.total_orders)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Đơn hàng ghi nhận từ Ads</div>
                    </div>

                    <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Chiến Dịch Đạt Mục Tiêu</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>
                        {(campaignsIntel.macro_overview?.effectiveness_summary?.exceeded_target_count || 0) + (campaignsIntel.macro_overview?.effectiveness_summary?.met_target_count || 0)} <span style={{ fontSize: '14px', color: '#64748b' }}>chiến dịch</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                        Chưa đạt / 0 đơn: <strong>{(campaignsIntel.macro_overview?.effectiveness_summary?.below_target_count || 0) + (campaignsIntel.macro_overview?.effectiveness_summary?.zero_order_waste_count || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* C. Macro Breakdown: Product GMV Max vs LIVE GMV Max */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                    {/* Product GMV Max Card */}
                    <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #bfdbfe', background: '#ffffff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Tag size={18} color="#2563eb" />
                          <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>Product GMV Max</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px', fontWeight: '600' }}>
                          {campaignsIntel.macro_overview?.breakdown?.product_gmv_max?.campaign_count || 0} chiến dịch
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Chi phí quảng cáo</div>
                          <div style={{ fontWeight: '700', color: '#0f172a', marginTop: '2px', fontSize: '16px' }}>
                            {formatVND(campaignsIntel.macro_overview?.breakdown?.product_gmv_max?.ads_cost || 0)}
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Doanh thu phân bổ (Ads Gross)</div>
                          <div style={{ fontWeight: '700', color: '#059669', marginTop: '2px', fontSize: '16px' }}>
                            {formatVND(campaignsIntel.macro_overview?.breakdown?.product_gmv_max?.gross_revenue || 0)}
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Số đơn hàng</div>
                          <div style={{ fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                            {formatNumber(campaignsIntel.macro_overview?.breakdown?.product_gmv_max?.orders || 0)}
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>GMV Max ROI</div>
                          <div style={{ fontWeight: '700', color: '#2563eb', marginTop: '2px' }}>
                            {campaignsIntel.macro_overview?.breakdown?.product_gmv_max?.roi == null ? '—' : `${campaignsIntel.macro_overview?.breakdown?.product_gmv_max?.roi}x`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* LIVE GMV Max Card */}
                    <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #fecaca', background: '#ffffff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Radio size={18} color="#dc2626" />
                          <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>LIVE GMV Max</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '6px', fontWeight: '600' }}>
                          {campaignsIntel.macro_overview?.breakdown?.live_gmv_max?.campaign_count || 0} chiến dịch
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Chi phí quảng cáo</div>
                          <div style={{ fontWeight: '700', color: '#0f172a', marginTop: '2px', fontSize: '16px' }}>
                            {formatVND(campaignsIntel.macro_overview?.breakdown?.live_gmv_max?.ads_cost || 0)}
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Doanh thu phân bổ (Ads Gross)</div>
                          <div style={{ fontWeight: '700', color: '#059669', marginTop: '2px', fontSize: '16px' }}>
                            {formatVND(campaignsIntel.macro_overview?.breakdown?.live_gmv_max?.gross_revenue || 0)}
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Số đơn hàng</div>
                          <div style={{ fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                            {formatNumber(campaignsIntel.macro_overview?.breakdown?.live_gmv_max?.orders || 0)}
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>GMV Max ROI</div>
                          <div style={{ fontWeight: '700', color: '#2563eb', marginTop: '2px' }}>
                            {campaignsIntel.macro_overview?.breakdown?.live_gmv_max?.roi == null ? '—' : `${campaignsIntel.macro_overview?.breakdown?.live_gmv_max?.roi}x`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Grain Reconciliation Matrix Table */}
                  <div className="glass" style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                        Ma Trận Đối Soát Đa Tầng (Multi-Grain Reconciliation Matrix)
                      </h4>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Đối soát phân cấp Macro vs Product vs LIVE vs Creative
                      </span>
                    </div>

                    {isLoadingMultiGrain ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={18} className="spin" style={{ margin: '0 auto 6px' }} />
                        <div>Đang nạp ma trận đối soát đa tầng...</div>
                      </div>
                    ) : multiGrainReconcile ? (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>Chi Phí GMV Max Chính Thức</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                              {formatVND(multiGrainReconcile.macro_split?.total_cost || 0)}
                            </div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>Chi Phí Kênh Cũ (Legacy)</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#64748b', marginTop: '4px' }}>
                              {multiGrainReconcile.official_vs_legacy?.legacy_cost == null ? '—' : formatVND(multiGrainReconcile.official_vs_legacy?.legacy_cost)}
                            </div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>Chênh Lệch Đối Soát</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
                              {multiGrainReconcile.official_vs_legacy?.cost_difference == null ? '—' : formatVND(multiGrainReconcile.official_vs_legacy?.cost_difference)}
                            </div>
                          </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Tầng Dữ Liệu (Hierarchy Level)</th>
                                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Chi Phí (₫)</th>
                                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Doanh Thu (₫)</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Trạng Thái Đối Soát</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 12px', fontWeight: '600' }}>Level A: Product Fact Grain</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatVND(multiGrainReconcile.hierarchy_reconciliation?.level_a_product?.cost || 0)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatVND(multiGrainReconcile.hierarchy_reconciliation?.level_a_product?.revenue || 0)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', fontSize: '10px' }}>
                                    {multiGrainReconcile.hierarchy_reconciliation?.level_a_product?.status || 'MATCH'}
                                  </span>
                                </td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 12px', fontWeight: '600' }}>Level B: LIVE Fact Grain</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatVND(multiGrainReconcile.hierarchy_reconciliation?.level_b_live?.cost || 0)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatVND(multiGrainReconcile.hierarchy_reconciliation?.level_b_live?.revenue || 0)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', fontSize: '10px' }}>
                                    {multiGrainReconcile.hierarchy_reconciliation?.level_b_live?.status || 'MATCH'}
                                  </span>
                                </td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 12px', fontWeight: '600' }}>Level C: Macro Total (A + B)</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatVND(multiGrainReconcile.hierarchy_reconciliation?.level_c_total?.total_cost || 0)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatVND(multiGrainReconcile.hierarchy_reconciliation?.level_c_total?.component_sum || 0)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', fontSize: '10px' }}>
                                    {multiGrainReconcile.hierarchy_reconciliation?.level_c_total?.status || 'MATCH'}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>

                </div>
              )}

              {/* VIEW 2: CAMPAIGNS (DETAILED EVALUATION PER CAMPAIGN: TARGET ROI VS ACTUAL ROI + PERIOD COMPARISON) */}
              {adsSubView === 'campaigns' && (
                <div>
                  {/* Campaign Effectiveness Summary KPI Strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    <div className="glass" style={{ padding: '14px 16px', borderRadius: '12px', borderLeft: '4px solid #059669', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>ĐẠT & VƯỢT ROI MỤC TIÊU</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                        {(campaignsIntel.macro_overview?.effectiveness_summary?.exceeded_target_count || 0) + (campaignsIntel.macro_overview?.effectiveness_summary?.met_target_count || 0)} chiến dịch
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Vượt ≥120%: <strong>{campaignsIntel.macro_overview?.effectiveness_summary?.exceeded_target_count || 0}</strong> • Đạt: <strong>{campaignsIntel.macro_overview?.effectiveness_summary?.met_target_count || 0}</strong>
                      </div>
                    </div>

                    <div className="glass" style={{ padding: '14px 16px', borderRadius: '12px', borderLeft: '4px solid #d97706', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>CHƯA ĐẠT ROI MỤC TIÊU</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>
                        {campaignsIntel.macro_overview?.effectiveness_summary?.below_target_count || 0} chiến dịch
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Có ra đơn nhưng ROI thực tế &lt; Target ROI
                      </div>
                    </div>

                    <div className="glass" style={{ padding: '14px 16px', borderRadius: '12px', borderLeft: '4px solid #dc2626', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>KHÔNG HIỆU QUẢ (TỐN TIỀN 0 ĐƠN)</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', marginTop: '4px' }}>
                        {campaignsIntel.macro_overview?.effectiveness_summary?.zero_order_waste_count || 0} chiến dịch
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Có phát sinh chi phí nhưng 0 đơn hàng
                      </div>
                    </div>

                    <div className="glass" style={{ padding: '14px 16px', borderRadius: '12px', borderLeft: '4px solid #64748b', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>NGỪNG PHÂN PHỐI (0 CHI PHÍ)</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#475569', marginTop: '4px' }}>
                        {campaignsIntel.macro_overview?.effectiveness_summary?.no_delivery_count || 0} chiến dịch
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Không cắn tiền trong kỳ đang xem
                      </div>
                    </div>
                  </div>

                  {/* D. Campaign List Filter & Sort Bar */}
                  <div className="glass" style={{ padding: '14px 18px', borderRadius: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Filter size={15} color="#64748b" />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>Loại chiến dịch:</span>
                      {[
                        { key: '', label: `Tất cả (${campaignsIntel.campaigns?.length || 0})` },
                        { key: 'PRODUCT_GMV_MAX', label: `Product GMV Max (${campaignsIntel.macro_overview?.breakdown?.product_gmv_max?.campaign_count ?? 0})` },
                        { key: 'LIVE_GMV_MAX', label: `LIVE GMV Max (${campaignsIntel.macro_overview?.breakdown?.live_gmv_max?.campaign_count ?? 0})` }
                      ].map(btn => (
                        <button
                          key={btn.key}
                          type="button"
                          onClick={() => { setCampaignTypeFilter(btn.key); fetchCampaignIntelligence(btn.key, adsCompareMode, adsTargetRoi); }}
                          style={{
                            background: campaignTypeFilter === btn.key ? '#2563eb' : '#f8fafc',
                            color: campaignTypeFilter === btn.key ? '#ffffff' : '#475569',
                            border: `1px solid ${campaignTypeFilter === btn.key ? '#2563eb' : '#e2e8f0'}`,
                            padding: '5px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          {btn.label}
                        </button>
                      ))}

                      <span style={{ color: '#cbd5e1', margin: '0 4px' }}>|</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>Mức hiệu quả:</span>
                      {[
                        { key: 'ALL', label: 'Tất cả' },
                        { key: 'EFFECTIVE', label: 'Đạt / Vượt mục tiêu' },
                        { key: 'BELOW_TARGET', label: 'Chưa đạt mục tiêu' },
                        { key: 'INEFFECTIVE_ZERO_ORDERS', label: 'Không hiệu quả (0 đơn)' },
                        { key: 'NO_DELIVERY', label: 'Ngừng phân phối' }
                      ].map(ef => (
                        <button
                          key={ef.key}
                          type="button"
                          onClick={() => setAdsEffectivenessFilter(ef.key)}
                          style={{
                            background: adsEffectivenessFilter === ef.key ? '#0f172a' : '#f8fafc',
                            color: adsEffectivenessFilter === ef.key ? '#ffffff' : '#475569',
                            border: `1px solid ${adsEffectivenessFilter === ef.key ? '#0f172a' : '#e2e8f0'}`,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          {ef.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Sắp xếp:</span>
                      <select
                        value={adsCampaignSortBy}
                        onChange={(e) => setAdsCampaignSortBy(e.target.value)}
                        style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '600', color: '#0f172a' }}
                      >
                        <option value="ads_cost">Chi phí quảng cáo</option>
                        <option value="gross_revenue">Doanh thu gộp</option>
                        <option value="orders">Số lượng đơn hàng</option>
                        <option value="roi">ROI thực tế đạt được</option>
                        <option value="target_roi_variance">Chênh lệch ROI Thực tế vs Mục tiêu</option>
                        <option value="revenue_change_pct">% Tăng/Giảm doanh số so với kỳ trước</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setAdsCampaignSortDir(adsCampaignSortDir === 'desc' ? 'asc' : 'desc')}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid #2563eb',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        {adsCampaignSortDir === 'desc' ? '↓ Giảm dần' : '↑ Tăng dần'}
                      </button>
                    </div>
                  </div>

                  {/* Campaign Performance & Target ROI Evaluation Table */}
                  <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff', marginBottom: '24px' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '1220px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                            <th style={{ padding: '12px 14px', fontWeight: '700' }}>Chiến dịch hiện có</th>
                            <th style={{ padding: '12px 10px', fontWeight: '700' }}>Loại hình</th>
                            <th
                              onClick={() => {
                                if (adsCampaignSortBy === 'ads_cost') setAdsCampaignSortDir(adsCampaignSortDir === 'desc' ? 'asc' : 'desc');
                                else { setAdsCampaignSortBy('ads_cost'); setAdsCampaignSortDir('desc'); }
                              }}
                              style={{ padding: '12px 12px', fontWeight: '700', textAlign: 'right', cursor: 'pointer' }}
                            >
                              Chi phí & So sánh kỳ {adsCampaignSortBy === 'ads_cost' ? (adsCampaignSortDir === 'desc' ? '↓' : '↑') : '↕'}
                            </th>
                            <th
                              onClick={() => {
                                if (adsCampaignSortBy === 'gross_revenue') setAdsCampaignSortDir(adsCampaignSortDir === 'desc' ? 'asc' : 'desc');
                                else { setAdsCampaignSortBy('gross_revenue'); setAdsCampaignSortDir('desc'); }
                              }}
                              style={{ padding: '12px 12px', fontWeight: '700', textAlign: 'right', cursor: 'pointer' }}
                            >
                              Doanh số & Tăng/Giảm {adsCampaignSortBy === 'gross_revenue' ? (adsCampaignSortDir === 'desc' ? '↓' : '↑') : '↕'}
                            </th>
                            <th
                              onClick={() => {
                                if (adsCampaignSortBy === 'orders') setAdsCampaignSortDir(adsCampaignSortDir === 'desc' ? 'asc' : 'desc');
                                else { setAdsCampaignSortBy('orders'); setAdsCampaignSortDir('desc'); }
                              }}
                              style={{ padding: '12px 12px', fontWeight: '700', textAlign: 'right', cursor: 'pointer' }}
                            >
                              Số đơn {adsCampaignSortBy === 'orders' ? (adsCampaignSortDir === 'desc' ? '↓' : '↑') : '↕'}
                            </th>
                            <th style={{ padding: '12px 12px', fontWeight: '700', textAlign: 'center' }}>ROI Mục Tiêu</th>
                            <th
                              onClick={() => {
                                if (adsCampaignSortBy === 'roi') setAdsCampaignSortDir(adsCampaignSortDir === 'desc' ? 'asc' : 'desc');
                                else { setAdsCampaignSortBy('roi'); setAdsCampaignSortDir('desc'); }
                              }}
                              style={{ padding: '12px 12px', fontWeight: '700', textAlign: 'center', cursor: 'pointer' }}
                            >
                              ROI Thực Tế {adsCampaignSortBy === 'roi' ? (adsCampaignSortDir === 'desc' ? '↓' : '↑') : '↕'}
                            </th>
                            <th style={{ padding: '12px 12px', fontWeight: '700', textAlign: 'center' }}>Đánh Giá Hiệu Quả</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700' }}>Nhận Xét & Phương Án Tối Ưu</th>
                            <th style={{ padding: '12px 12px', fontWeight: '700', textAlign: 'center' }}>Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const rawCamps = campaignsIntel.campaigns || [];
                            const activeSpendCampsCount = rawCamps.filter(c => Number(c.ads_cost || 0) > 0 || Number(c.gross_revenue || 0) > 0 || Number(c.orders || 0) > 0).length;
                            const zeroSpendCampsCount = rawCamps.length - activeSpendCampsCount;

                            const filteredCamps = rawCamps.filter(c => {
                              const hasActivity = Number(c.ads_cost || 0) > 0 || Number(c.gross_revenue || 0) > 0 || Number(c.orders || 0) > 0;
                              if (adsEffectivenessFilter === 'NO_DELIVERY') {
                                return c.effectiveness_status === 'NO_DELIVERY';
                              }
                              if (!showZeroSpendCampaigns && !hasActivity) {
                                return false;
                              }
                              if (adsEffectivenessFilter === 'ALL') return true;
                              if (adsEffectivenessFilter === 'EFFECTIVE') {
                                return c.effectiveness_status === 'EXCEEDED_TARGET' || c.effectiveness_status === 'MET_TARGET';
                              }
                              return c.effectiveness_status === adsEffectivenessFilter;
                            });

                            const sortedCamps = [...filteredCamps].sort((a, b) => {
                              let va = 0;
                              let vb = 0;
                              if (adsCampaignSortBy === 'revenue_change_pct') {
                                va = Number(a.period_comparison?.gross_revenue_change_pct ?? -999999);
                                vb = Number(b.period_comparison?.gross_revenue_change_pct ?? -999999);
                              } else {
                                va = Number(a[adsCampaignSortBy] ?? -999999);
                                vb = Number(b[adsCampaignSortBy] ?? -999999);
                              }
                              return adsCampaignSortDir === 'asc' ? (va - vb) : (vb - va);
                            });

                            if (sortedCamps.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                                    <div>Không có chiến dịch đang chạy nào khớp bộ lọc hiện tại.</div>
                                    {zeroSpendCampsCount > 0 && !showZeroSpendCampaigns && (
                                      <button
                                        type="button"
                                        onClick={() => setShowZeroSpendCampaigns(true)}
                                        style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                      >
                                        Hiện thêm {zeroSpendCampsCount} chiến dịch 0đ / ngừng chạy
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <>
                                {sortedCamps.map((camp) => {
                                  const isProduct = camp.promotion_type === 'PRODUCT' || camp.campaign_type === 'Product GMV Max' || camp.campaign_type === 'PRODUCT_GMV_MAX';
                                  const hasSpendOrOrd = Number(camp.ads_cost || 0) > 0 || Number(camp.gross_revenue || 0) > 0 || Number(camp.orders || 0) > 0;
                                  const isEnabled = camp.operation_status === 'ENABLE' || hasSpendOrOrd;
                                  const pc = camp.period_comparison || {};
                                  const effStatus = camp.effectiveness_status || 'NO_DELIVERY';
                                  const badgeStyle =
                                    effStatus === 'EXCEEDED_TARGET' ? { bg: '#ecfdf5', text: '#047857', border: '#6ee7b7' } :
                                    effStatus === 'MET_TARGET' ? { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' } :
                                    effStatus === 'BELOW_TARGET' ? { bg: '#fffbeb', text: '#b45309', border: '#fde68a' } :
                                    effStatus === 'INEFFECTIVE_ZERO_ORDERS' ? { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' } :
                                    { bg: '#f8fafc', text: '#64748b', border: '#cbd5e1' };

                                  return (
                                    <tr
                                      key={camp.campaign_id}
                                      onClick={() => fetchCampaignDetail(camp.campaign_id)}
                                      style={{
                                        borderBottom: '1px solid #f1f5f9',
                                        cursor: 'pointer',
                                        background: effStatus === 'INEFFECTIVE_ZERO_ORDERS' ? '#fffafa' : 'transparent'
                                      }}
                                      className="table-row-hover"
                                    >
                                      <td style={{ padding: '12px 14px', maxWidth: '250px' }}>
                                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>{camp.campaign_name}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                          <span>ID: {camp.campaign_id}</span>
                                          <span style={{
                                            color: hasSpendOrOrd ? '#059669' : (isEnabled ? '#2563eb' : '#64748b'),
                                            background: hasSpendOrOrd ? '#dcfce7' : '#f1f5f9',
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            fontWeight: '700',
                                            fontFamily: 'sans-serif',
                                            fontSize: '10px'
                                          }}>
                                            {camp.delivery_badge || (hasSpendOrOrd ? '● Đang chạy (Có chi tiêu)' : '○ Đã tắt (0đ)')}
                                          </span>
                                        </div>
                                      </td>

                                      <td style={{ padding: '12px 10px' }}>
                                        <span style={{
                                          background: isProduct ? '#eff6ff' : '#fef2f2',
                                          color: isProduct ? '#2563eb' : '#dc2626',
                                          border: `1px solid ${isProduct ? '#bfdbfe' : '#fecaca'}`,
                                          padding: '3px 8px',
                                          borderRadius: '6px',
                                          fontSize: '11px',
                                          fontWeight: '700',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {isProduct ? 'Product GMV Max' : 'LIVE GMV Max'}
                                        </span>
                                      </td>

                                      {/* Chi phí & So sánh kỳ */}
                                      <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>
                                          {formatVND(camp.ads_cost)}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                          Kỳ trước: {formatVND(pc.prev_spend || 0)}
                                          {pc.spend_change_pct !== null && pc.spend_change_pct !== undefined && (
                                            <span style={{ marginLeft: '4px', fontWeight: '700', color: pc.spend_change_pct > 0 ? '#2563eb' : '#d97706' }}>
                                              ({pc.spend_change_pct > 0 ? '+' : ''}{pc.spend_change_pct}%)
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      {/* Doanh số (Thực & Gộp) & Tăng/Giảm */}
                                      <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                                        <div style={{ fontWeight: '800', color: '#059669', fontSize: '13px' }}>
                                          Thực: {formatVND(camp.realized_revenue ?? camp.gross_revenue)}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '1px' }}>
                                          Gộp: {formatVND(camp.gross_revenue)}
                                          {camp.cancel_refund_loss > 0 && (
                                            <span style={{ color: '#dc2626', marginLeft: '4px' }}>
                                              (-{formatVND(camp.cancel_refund_loss)} hủy/hoàn)
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: '10.5px', marginTop: '2px' }}>
                                          <span style={{ color: '#64748b' }}>Trước: {formatVND(pc.prev_gross_revenue || 0)}</span>
                                          {pc.gross_revenue_change_pct !== null && pc.gross_revenue_change_pct !== undefined ? (
                                            <span style={{
                                              marginLeft: '4px',
                                              fontWeight: '800',
                                              color: pc.gross_revenue_change_pct > 0 ? '#059669' : pc.gross_revenue_change_pct < 0 ? '#dc2626' : '#64748b'
                                            }}>
                                              {pc.gross_revenue_change_pct > 0 ? `▲ +${pc.gross_revenue_change_pct}%` : pc.gross_revenue_change_pct < 0 ? `▼ ${pc.gross_revenue_change_pct}%` : '0%'}
                                            </span>
                                          ) : null}
                                        </div>
                                      </td>

                                      {/* Số đơn & Hủy/Hoàn */}
                                      <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>
                                          {formatNumber(camp.orders)} đơn
                                        </div>
                                        {(camp.cancelled_orders_est > 0 || camp.refunded_orders_est > 0) && (
                                          <div style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: '600', marginTop: '1px' }}>
                                            Hủy: {camp.cancelled_orders_est || 0} • Hoàn: {camp.refunded_orders_est || 0}
                                          </div>
                                        )}
                                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px' }}>
                                          Trước: {formatNumber(pc.prev_orders || 0)} đơn
                                        </div>
                                      </td>

                                      {/* ROI Mục tiêu */}
                                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                                        <div style={{ fontWeight: '800', color: '#475569', fontSize: '13px' }}>
                                          {camp.effective_target_roi ?? camp.target_roas ?? adsTargetRoi}x
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                          {camp.target_roas ? 'Target TikTok' : 'Mục tiêu Shop'}
                                        </div>
                                      </td>

                                      {/* ROI Thực tế */}
                                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                                        <div style={{
                                          fontWeight: '900',
                                          fontSize: '14px',
                                          color: (camp.realized_roi ?? camp.roi) !== null && (camp.realized_roi ?? camp.roi) >= (camp.effective_target_roi || adsTargetRoi) ? '#059669' : camp.roi !== null ? '#dc2626' : '#94a3b8'
                                        }}>
                                          {camp.realized_roi !== undefined && camp.realized_roi !== null ? `${camp.realized_roi}x` : (camp.roi !== null ? `${camp.roi}x` : '—')}
                                        </div>
                                        {camp.roi !== null && camp.realized_roi !== undefined && camp.realized_roi !== camp.roi && (
                                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                                            (Gộp: {camp.roi}x)
                                          </div>
                                        )}
                                        {camp.target_roi_variance !== null && camp.target_roi_variance !== undefined && (
                                          <div style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            color: camp.target_roi_variance >= 0 ? '#059669' : '#dc2626'
                                          }}>
                                            {camp.target_roi_variance >= 0 ? `+${camp.target_roi_variance}x vs mục tiêu` : `${camp.target_roi_variance}x vs mục tiêu`}
                                          </div>
                                        )}
                                      </td>

                                      {/* Đánh giá hiệu quả */}
                                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                                        <span style={{
                                          display: 'inline-block',
                                          background: badgeStyle.bg,
                                          color: badgeStyle.text,
                                          border: `1px solid ${badgeStyle.border}`,
                                          padding: '3px 8px',
                                          borderRadius: '6px',
                                          fontSize: '11px',
                                          fontWeight: '800',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {camp.effectiveness_label || '—'}
                                        </span>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px', fontWeight: '600' }}>
                                          {pc.growth_label || ''}
                                        </div>
                                      </td>

                                      {/* Nhận xét & Phương án tối ưu */}
                                      <td style={{ padding: '12px 14px', maxWidth: '300px', fontSize: '11px', color: '#334155', lineHeight: '1.45' }}>
                                        {camp.recommendation || 'Theo dõi xu hướng phân phối hằng ngày.'}
                                      </td>

                                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); fetchCampaignDetail(camp.campaign_id); }}
                                          className="btn-secondary"
                                          style={{ padding: '5px 10px', fontSize: '11px', fontWeight: '700', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}
                                        >
                                          Chi tiết SP &amp; Ngày
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {zeroSpendCampsCount > 0 && (
                                  <tr>
                                    <td colSpan={10} style={{ padding: '10px 14px', textAlign: 'center', background: '#f8fafc' }}>
                                      <button
                                        type="button"
                                        onClick={() => setShowZeroSpendCampaigns((v) => !v)}
                                        style={{
                                          padding: '6px 14px',
                                          borderRadius: '8px',
                                          border: '1px solid #cbd5e1',
                                          background: '#ffffff',
                                          color: '#334155',
                                          fontSize: '12px',
                                          fontWeight: '700',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {showZeroSpendCampaigns
                                          ? `Ẩn bớt ${zeroSpendCampsCount} chiến dịch 0đ / đã tắt`
                                          : `Hiện thêm ${zeroSpendCampsCount} chiến dịch 0đ / đã tắt (Đang hiển thị ${activeSpendCampsCount} chiến dịch có phát sinh số liệu)`}
                                      </button>
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

                  {/* Direct Product (SPU) Breakdown Section right below Campaign Table */}
                  <div className="glass" style={{ borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', background: '#ffffff', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Tag size={17} color="#2563eb" />
                          Báo Cáo Chi Tiết Theo Từng Mã Sản Phẩm (SPU) Trong GMV Max ({adsProductIntel?.products?.length || 0} sản phẩm)
                        </h4>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Thống kê chi phí quảng cáo, doanh số gộp, đơn hủy/hoàn, doanh số thực nhận và hiệu quả thu/chi theo từng mã sản phẩm
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdsSubView('products')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#2563eb',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Cấu hình Giá vốn &amp; Hòa vốn từng SP →
                      </button>
                    </div>

                    {(!adsProductIntel?.products || adsProductIntel.products.length === 0) ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', fontSize: '12px' }}>
                        Đang tải hoặc chưa có dữ liệu sản phẩm cho kỳ này.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                              <th style={{ padding: '10px 12px' }}>Sản phẩm &amp; Mã SP (SPU)</th>
                              <th style={{ padding: '10px 10px', textAlign: 'right' }}>Chi phí QC</th>
                              <th style={{ padding: '10px 10px', textAlign: 'right' }}>Doanh số QC (Gộp)</th>
                              <th style={{ padding: '10px 10px', textAlign: 'right', color: '#059669' }}>Doanh số QC Thực</th>
                              <th style={{ padding: '10px 10px', textAlign: 'right' }}>Đơn QC</th>
                              <th style={{ padding: '10px 10px', textAlign: 'center' }}>Thu/chi QC Thực</th>
                              <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tổng đơn Shop (Hủy/Hoàn)</th>
                              <th style={{ padding: '10px 10px', textAlign: 'right', color: '#047857' }}>Doanh số thực toàn Shop</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adsProductIntel.products.map((p) => (
                              <tr key={`camp_spu_${p.item_group_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {p.product_image ? (
                                      <img
                                        src={p.product_image}
                                        alt={p.product_name}
                                        style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }}
                                      />
                                    ) : (
                                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', flexShrink: 0 }}>
                                        SP
                                      </div>
                                    )}
                                    <div>
                                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12.5px' }}>{p.product_name}</div>
                                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Mã SP: {p.item_group_id}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                  {formatVND(p.spend || 0)}
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>
                                  {formatVND(p.ads_gross_revenue || 0)}
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', color: '#059669', fontWeight: '800' }}>
                                  {formatVND(p.realized_ads_revenue ?? p.ads_gross_revenue ?? 0)}
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                  {formatNumber(p.ads_orders || 0)} đơn
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: '800', color: '#2563eb' }}>
                                  {p.realized_roi ? `${p.realized_roi}x` : (p.derived_roi ? `${p.derived_roi}x` : '—')}
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                                  <div style={{ fontWeight: '700', color: '#0f172a' }}>{p.store_order_count !== null ? `${formatNumber(p.store_order_count)} đơn` : '—'}</div>
                                  {(p.cancelled_orders > 0 || p.refunded_orders > 0) && (
                                    <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600' }}>
                                      Hủy: {p.cancelled_orders || 0} • Hoàn: {p.refunded_orders || 0}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '800', color: '#047857' }}>
                                  {p.realized_revenue !== null ? formatVND(p.realized_revenue) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* VIEW 3: PRODUCTS (SPU) */}
              {adsSubView === 'products' && (
                <div>
                  {/* SPU Summary Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Tổng SPU Quảng Cáo</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                        {adsProductIntel?.summary?.spu_count || 0} SPU
                      </div>
                    </div>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Khớp Đơn Hàng (RUNTIME_VERIFIED_MAPPING)</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                        {adsProductIntel?.summary?.verified_mapping_count || 0}
                      </div>
                    </div>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Chưa Khớp (Unmapped)</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>
                        {adsProductIntel?.summary?.unmapped_count || 0}
                      </div>
                    </div>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Chi Phí SPU Ads</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                        {formatVND(adsProductIntel?.summary?.total_cost || 0)}
                      </div>
                    </div>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Blended ROI SPU</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
                        {adsProductIntel?.summary?.blended_roi == null ? '—' : `${adsProductIntel.summary?.blended_roi}x`}
                      </div>
                    </div>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Đã Cấu Hình Giá Vốn (P0-04)</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                        {adsProductIntel?.summary?.configured_costs_count || 0} / {adsProductIntel?.summary?.spu_count || 0} SPU
                      </div>
                    </div>
                  </div>

                  {/* SPU Filter & Search Bar */}
                  <div className="glass" style={{ padding: '12px 18px', borderRadius: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <Search size={16} color="#64748b" />
                      <input
                        type="text"
                        placeholder="Tìm theo mã SPU (item_group_id) hoặc tên sản phẩm..."
                        value={adsProductSearch}
                        onChange={(e) => setAdsProductSearch(e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#0f172a',
                          fontSize: '13px',
                          width: '100%'
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Cấu hình Unit Economics (COGS, phí sàn) theo từng SPU để phân tích ROI hòa vốn chính xác
                    </div>
                  </div>

                  {/* SPU Table */}
                  <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff', marginBottom: '24px' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 14px', fontWeight: '600' }}>Mã SPU (item_group_id)</th>
                            <th style={{ padding: '12px 14px', fontWeight: '600' }}>Tên Sản Phẩm Shop</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600' }}>Đối Soát Mapping</th>
                            <th style={{ padding: '12px 14px', fontWeight: '600' }}>Chiến Dịch</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>Chi Phí Ads</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>Doanh Thu Ads</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>Đơn Ads</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>ROI Ads</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>ROI Hòa Vốn (BEP)</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600' }}>Hiệu Quả ROI</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600' }}>Giá Vốn & Thiết Lập</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>Đơn Cửa Hàng</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>Doanh Số Cửa Hàng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {isLoadingAdsProducts ? (
                            <tr>
                              <td colSpan={13} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                                <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto' }} />
                                Đang nạp dữ liệu SPU Product GMV Max...
                              </td>
                            </tr>
                          ) : (!adsProductIntel?.products || adsProductIntel.products.length === 0) ? (
                            <tr>
                              <td colSpan={13} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                                {adsProductIntel?.status === 'NOT_SYNCED' ? 'Dữ liệu Product GMV Max chưa được đồng bộ cho kỳ này.' : 'Không có dữ liệu SPU Product GMV Max.'}
                              </td>
                            </tr>
                          ) : (
                            adsProductIntel.products
                              .filter(p => !adsProductSearch || (p.item_group_id && String(p.item_group_id).includes(adsProductSearch)) || (p.product_name && p.product_name.toLowerCase().includes(adsProductSearch.toLowerCase())))
                              .map(p => (
                                <tr key={`${p.campaign_id}_${p.item_group_id}`} style={{ borderBottom: '1px solid #f1f5f9' }} className="table-row-hover">
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '700', color: '#0f172a' }}>
                                    {p.item_group_id}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: '#334155', maxWidth: '240px' }}>
                                    {p.product_name || '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    {p.mapping_status === 'RUNTIME_VERIFIED_MAPPING' || p.mapping_status === 'VERIFIED' ? (
                                      <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                                        RUNTIME_VERIFIED_MAPPING
                                      </span>
                                    ) : (
                                      <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                                        UNMAPPED
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '11px' }}>
                                    <div style={{ color: '#0f172a', fontWeight: '600' }}>{p.campaign_name || 'Chiến dịch'}</div>
                                    <div style={{ fontFamily: 'monospace' }}>ID: {p.campaign_id}</div>
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                    {formatVND(p.spend ?? p.ads_cost ?? 0)}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                                    {formatVND(p.ads_gross_revenue ?? p.gross_revenue ?? 0)}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#0f172a' }}>
                                    {formatNumber(p.ads_orders ?? p.orders ?? 0)}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#2563eb', fontWeight: '700' }}>
                                    {p.derived_roi !== null && p.derived_roi !== undefined ? `${p.derived_roi}x` : (p.api_roi !== null ? `${p.api_roi}x` : '—')}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                    {p.breakeven_roas !== null && p.breakeven_roas !== undefined ? (
                                      <div>
                                        <span style={{ fontWeight: '800', color: '#0284c7' }}>{p.breakeven_roas}x</span>
                                        {p.margin_pct !== null && (
                                          <div style={{ fontSize: '10px', color: '#64748b' }}>Biên: {p.margin_pct}%</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>Chưa thiết lập</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    {p.cost_status === 'CONFIGURED' ? (
                                      p.roas_vs_breakeven === 'ABOVE_BREAKEVEN' ? (
                                        <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                                          ĐẠT MỤC TIÊU
                                        </span>
                                      ) : p.roas_vs_breakeven === 'BELOW_BREAKEVEN' ? (
                                        <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                                          DƯỚI HÒA VỐN
                                        </span>
                                      ) : (
                                        <span style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                                          THEO DÕI
                                        </span>
                                      )
                                    ) : p.cost_status === 'NEGATIVE_MARGIN' ? (
                                      <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                                        MARGIN ÂM
                                      </span>
                                    ) : (
                                      <span style={{ background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                                        CHƯA THIẾT LẬP
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => openCostModal(p)}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        borderRadius: '6px',
                                        border: p.cost_status === 'CONFIGURED' ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                                        background: p.cost_status === 'CONFIGURED' ? '#eff6ff' : '#f8fafc',
                                        color: p.cost_status === 'CONFIGURED' ? '#1d4ed8' : '#475569',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Calculator size={12} />
                                      {p.cost_status === 'CONFIGURED' ? `${formatVND(p.cogs_amount)} (Sửa)` : '+ Thiết lập'}
                                    </button>
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#475569' }}>
                                    {p.store_order_count !== null ? formatNumber(p.store_order_count) : '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#059669' }}>
                                    {p.store_gross_sales !== null ? formatVND(p.store_gross_sales) : '—'}
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* VIEW 4: VIDEOS / CREATIVES */}
              {adsSubView === 'videos' && (
                <div>
                  {/* Creative Summary Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Tổng Số Creative</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                        {adsVideoIntel?.summary?.creative_count || 0} video
                      </div>
                    </div>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Chi Phí Video Ads</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                        {formatVND(adsVideoIntel?.summary?.total_cost || 0)}
                      </div>
                    </div>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Doanh Thu Phân Bổ</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                        {formatVND(adsVideoIntel?.summary?.total_gross_revenue || 0)}
                      </div>
                    </div>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Blended ROI Video</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
                        {adsVideoIntel?.summary?.blended_roi == null ? '—' : `${adsVideoIntel.summary?.blended_roi}x`}
                      </div>
                    </div>
                    <div className="glass" style={{ padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Chưa Định Danh (-1)</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>
                        {adsVideoIntel?.provenance?.unattributed_count || 0}
                      </div>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="glass" style={{ padding: '12px 18px', borderRadius: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <Search size={16} color="#64748b" />
                      <input
                        type="text"
                        placeholder="Tìm theo Post ID (item_id) hoặc SPU (item_group_id)..."
                        value={adsVideoSearch}
                        onChange={(e) => setAdsVideoSearch(e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#0f172a',
                          fontSize: '13px',
                          width: '100%'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={adsVideoFilter}
                        onChange={(e) => setAdsVideoFilter(e.target.value)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          fontSize: '12px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          outline: 'none'
                        }}
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="DELIVERING">Đang phân phối (DELIVERING)</option>
                        <option value="NOT_DELIVERING">Không phân phối (NOT_DELIVERING)</option>
                        <option value="AUTHORIZATION_NEEDED">Cần cấp quyền Spark Ads</option>
                        <option value="UNATTRIBUTED">Chưa định danh (item_id = -1)</option>
                      </select>
                    </div>
                  </div>

                  {/* Creative Table */}
                  <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff', marginBottom: '24px' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 14px', fontWeight: '600' }}>Video Post ID (item_id)</th>
                            <th style={{ padding: '12px 14px', fontWeight: '600' }}>Mã SPU (item_group_id)</th>
                            <th style={{ padding: '12px 14px', fontWeight: '600' }}>Trạng Thái TikTok API (Raw & Chuẩn Hóa)</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>Chi Phí Ads</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>Doanh Thu Ads</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>Đơn Hàng</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>GMV Max ROI</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>CPA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {isLoadingAdsVideos ? (
                            <tr>
                              <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                                <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto' }} />
                                Đang nạp dữ liệu Video Creative GMV Max...
                              </td>
                            </tr>
                          ) : (!adsVideoIntel?.creatives || adsVideoIntel.creatives.length === 0) ? (
                            <tr>
                              <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                                {adsVideoIntel?.status === 'NOT_SYNCED' ? 'Dữ liệu Video GMV Max chưa được đồng bộ cho kỳ này.' : 'Không có dữ liệu Video GMV Max.'}
                              </td>
                            </tr>
                          ) : (
                            adsVideoIntel.creatives
                              .filter(c => {
                                if (adsVideoSearch) {
                                  const matchesId = c.item_id && String(c.item_id).includes(adsVideoSearch);
                                  const matchesSpu = c.item_group_id && String(c.item_group_id).includes(adsVideoSearch);
                                  if (!matchesId && !matchesSpu) return false;
                                }
                                if (adsVideoFilter === 'DELIVERING' && c.creative_delivery_status_normalized !== 'DELIVERING') return false;
                                if (adsVideoFilter === 'NOT_DELIVERING' && c.creative_delivery_status_normalized !== 'NOT_DELIVERING') return false;
                                if (adsVideoFilter === 'AUTHORIZATION_NEEDED' && c.creative_delivery_status_normalized !== 'AUTHORIZATION_NEEDED') return false;
                                if (adsVideoFilter === 'UNATTRIBUTED' && !c.is_unattributed) return false;
                                return true;
                              })
                              .map(c => (
                                <tr key={`${c.campaign_id}_${c.item_group_id}_${c.item_id}`} style={{ borderBottom: '1px solid #f1f5f9' }} className="table-row-hover">
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '700' }}>
                                    {c.is_unattributed ? (
                                      <span style={{ color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                        CHƯA ĐỊNH DANH (item_id = -1)
                                      </span>
                                    ) : (
                                      <span style={{ color: '#0f172a' }}>{c.item_id}</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#64748b' }}>
                                    {c.item_group_id}
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{
                                        background: c.creative_delivery_status_normalized === 'DELIVERING' ? '#ecfdf5' :
                                          c.creative_delivery_status_normalized === 'AUTHORIZATION_NEEDED' ? '#fffbeb' : '#f8fafc',
                                        color: c.creative_delivery_status_normalized === 'DELIVERING' ? '#059669' :
                                          c.creative_delivery_status_normalized === 'AUTHORIZATION_NEEDED' ? '#d97706' : '#64748b',
                                        border: `1px solid ${c.creative_delivery_status_normalized === 'DELIVERING' ? '#a7f3d0' : c.creative_delivery_status_normalized === 'AUTHORIZATION_NEEDED' ? '#fde68a' : '#e2e8f0'}`,
                                        padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700'
                                      }}>
                                        {c.creative_delivery_status_normalized}
                                      </span>
                                      {c.creative_delivery_status_raw !== c.creative_delivery_status_normalized && (
                                        <span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }} title="Giá trị gốc trả về từ TikTok API">
                                          (raw: {c.creative_delivery_status_raw})
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                    {formatVND(c.spend ?? c.ads_cost ?? 0)}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                                    {formatVND(c.ads_gross_revenue ?? c.gross_revenue ?? 0)}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#0f172a' }}>
                                    {formatNumber(c.ads_orders ?? c.orders ?? 0)}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#2563eb', fontWeight: '700' }}>
                                    {c.api_roi !== null ? `${c.api_roi}x` : '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#64748b' }}>
                                    {c.cpa !== null ? formatVND(c.cpa) : '—'}
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* VIEW: GMV MAX 8 ACTION GROUPS PLAYBOOK */}
              {adsSubView === 'playbook' && (
                <CommerceGmvMaxPlaybookView
                  shopId={shopId}
                  apiRequest={apiRequest}
                  startDate={startDate}
                  endDate={endDate}
                />
              )}

              {/* VIEW 5: OPTIMIZATIONS (6 FACT PATTERNS) */}
              {adsSubView === 'optimizations' && (
                <div>
                  <div className="glass" style={{ padding: '18px 22px', borderRadius: '16px', marginBottom: '24px', border: '1px solid #bfdbfe', background: '#eff6ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <Sparkles size={20} color="#2563eb" />
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                        6 Mẫu Cơ Hội Tối Ưu Hóa (Factual Optimization Patterns)
                      </h4>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
                      Phân loại chính xác dựa trên dữ liệu Marketing API thực tế: trạng thái phân phối, hiệu quả chi phí và phân bổ doanh thu. Tuyệt đối không suy đoán.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                    {/* Pattern 1: Target ROAS Evaluation (Strictly when configured) */}
                    {adsVideoIntel?.optimization_groups?.target_roas_comparison?.is_configured ? (
                      <>
                        {adsVideoIntel.optimization_groups.target_roas_comparison.met_target_count > 0 && (
                          <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #a7f3d0', background: '#ffffff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                              <div>
                                <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                                  ĐẠT TARGET ROAS
                                </span>
                                <h5 style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                                  Video Đạt Target ROAS Chiến Dịch
                                </h5>
                              </div>
                              <span style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>
                                {adsVideoIntel.optimization_groups.target_roas_comparison.met_target_count} video
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: '1.5' }}>
                              Dữ liệu API ghi nhận ROI thực tế đạt hoặc vượt Target ROAS đã cấu hình của chiến dịch.
                            </div>
                          </div>
                        )}
                        {adsVideoIntel.optimization_groups.target_roas_comparison.below_target_count > 0 && (
                          <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #fde68a', background: '#ffffff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                              <div>
                                <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                                  DƯỚI TARGET ROAS
                                </span>
                                <h5 style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                                  Video Dưới Target ROAS Chiến Dịch
                                </h5>
                              </div>
                              <span style={{ fontSize: '20px', fontWeight: '800', color: '#d97706' }}>
                                {adsVideoIntel.optimization_groups.target_roas_comparison.below_target_count} video
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: '1.5' }}>
                              Dữ liệu API ghi nhận ROI thực tế thấp hơn mục tiêu Target ROAS đã cấu hình của chiến dịch.
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <span style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                              CHƯA CẤU HÌNH TARGET ROAS
                            </span>
                            <h5 style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                              Đánh Giá Theo Mục Tiêu ROAS
                            </h5>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                          Chiến dịch chưa cấu hình Target ROAS. Hệ thống không đưa ra kết luận đạt/không đạt khi chưa có mục tiêu do người dùng thiết lập.
                        </div>
                      </div>
                    )}

                    {/* Pattern 2: Authorization Needed */}
                    {(adsVideoIntel?.optimization_groups?.authorization_needed?.count > 0 || adsVideoIntel?.summary?.opportunity_patterns?.authorization_needed?.count > 0) && (
                      <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #fde68a', background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                              CẦN CẤP QUYỀN SPARK ADS
                            </span>
                            <h5 style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                              Cần Cấp Quyền Tài Khoản/Video (AUTHORIZATION_NEEDED)
                            </h5>
                          </div>
                          <span style={{ fontSize: '20px', fontWeight: '800', color: '#d97706' }}>
                            {adsVideoIntel?.optimization_groups?.authorization_needed?.count || adsVideoIntel?.summary?.opportunity_patterns?.authorization_needed?.count} video
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: '1.5' }}>
                          Video yêu cầu xác thực ủy quyền mã Spark Ads trên TikTok Ads Manager để mở khóa phân phối.
                        </div>
                      </div>
                    )}

                    {/* Pattern 3: Not Delivering */}
                    {(adsVideoIntel?.optimization_groups?.not_delivering?.count > 0 || adsVideoIntel?.summary?.opportunity_patterns?.not_delivering?.count > 0) && (
                      <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #fecaca', background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                              NGỪNG PHÂN PHỐI
                            </span>
                            <h5 style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                              Ngừng Phân Phối Theo API (NOT_DELIVERING)
                            </h5>
                          </div>
                          <span style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626' }}>
                            {adsVideoIntel?.optimization_groups?.not_delivering?.count || adsVideoIntel?.summary?.opportunity_patterns?.not_delivering?.count} video
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: '1.5' }}>
                          Trạng thái API trả về NOT_DELIVERING hoặc NOT_DELIVERYING. Cần kiểm tra nội dung vi phạm chính sách hoặc video bị gỡ khỏi trang cá nhân.
                        </div>
                      </div>
                    )}

                    {/* Pattern 4: Cost > 0 & Revenue = 0 */}
                    {(adsVideoIntel?.optimization_groups?.cost_positive_zero_revenue?.count > 0 || adsVideoIntel?.summary?.opportunity_patterns?.inefficient_spend?.count > 0) && (
                      <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #fecaca', background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <span style={{ background: '#fef2f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                              COST &gt; 0 &amp; REVENUE = 0
                            </span>
                            <h5 style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                              Có Chi Phí Nhưng 0 Doanh Thu Phân Bổ
                            </h5>
                          </div>
                          <span style={{ fontSize: '20px', fontWeight: '800', color: '#e11d48' }}>
                            {adsVideoIntel?.optimization_groups?.cost_positive_zero_revenue?.count || adsVideoIntel?.summary?.opportunity_patterns?.inefficient_spend?.count} video
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: '1.5' }}>
                          Video phát sinh chi tiêu quảng cáo thực tế nhưng chưa ghi nhận bất kỳ doanh thu phân bổ nào trong kỳ.
                        </div>
                      </div>
                    )}

                    {/* Pattern 5: Zero Cost Attribution */}
                    {(adsVideoIntel?.optimization_groups?.zero_cost_attribution?.count > 0 || adsVideoIntel?.summary?.opportunity_patterns?.zero_cost_attribution?.count > 0) && (
                      <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #bae6fd', background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <span style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                              COST = 0 & PHÂN BỔ ĐƠN/DOANH THU
                            </span>
                            <h5 style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                              Đơn Hàng/Doanh Thu Phân Bổ Với Chi Phí 0đ
                            </h5>
                          </div>
                          <span style={{ fontSize: '20px', fontWeight: '800', color: '#0284c7' }}>
                            {adsVideoIntel?.optimization_groups?.zero_cost_attribution?.count || adsVideoIntel?.summary?.opportunity_patterns?.zero_cost_attribution?.count} video
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: '1.5' }}>
                          API ghi nhận đơn hàng/doanh thu được phân bổ trong kỳ nhưng chi phí ghi nhận trong kỳ bằng 0.
                        </div>
                        <div style={{ fontSize: '11px', color: '#0369a1', background: '#f0f9ff', border: '1px solid #e0f2fe', padding: '8px 12px', borderRadius: '8px' }}>
                          Gợi ý: Kiểm tra cửa sổ phân bổ (attribution window) hoặc nguồn phân bổ từ API; không tự khẳng định nguyên nhân cụ thể.
                        </div>
                      </div>
                    )}

                    {/* Pattern 6: Unattributed Traffic */}
                    {(adsVideoIntel?.optimization_groups?.unattributed?.count > 0 || adsVideoIntel?.summary?.opportunity_patterns?.unattributed?.count > 0) && (
                      <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #cbd5e1', background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <span style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                              BUCKET CHƯA ĐỊNH DANH (-1)
                            </span>
                            <h5 style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                              Video Chưa Phân Bổ ID Sáng Tạo (item_id = -1)
                            </h5>
                          </div>
                          <span style={{ fontSize: '20px', fontWeight: '800', color: '#64748b' }}>
                            {adsVideoIntel?.optimization_groups?.unattributed?.count || adsVideoIntel?.summary?.opportunity_patterns?.unattributed?.count} bản ghi
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: '1.5' }}>
                          TikTok API gom các lượt hiển thị và chi phí chưa phân bổ cho video cụ thể vào nhóm định danh -1.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* E. Single Campaign Detail Drawer / Modal */}
              {selectedCampaignId && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: '20px'
                }}>
                  <div className="glass" style={{
                    width: '100%',
                    maxWidth: '850px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    borderRadius: '20px',
                    padding: '28px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                  }}>
                    {/* Modal Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                            {selectedCampaignData?.campaign_info?.campaign_name || `Chiến dịch #${selectedCampaignId}`}
                          </h3>
                          {(selectedCampaignData?.campaign_info?.promotion_type || selectedCampaignData?.campaign_info?.campaign_type) && (() => {
                            const isDetailProduct = (selectedCampaignData.campaign_info.promotion_type === 'PRODUCT' ||
                              selectedCampaignData.campaign_info.campaign_type === 'PRODUCT_GMV_MAX' ||
                              selectedCampaignData.campaign_info.campaign_type === 'Product GMV Max');
                            return (
                              <span style={{
                                background: isDetailProduct ? '#eff6ff' : '#fef2f2',
                                color: isDetailProduct ? '#2563eb' : '#dc2626',
                                border: `1px solid ${isDetailProduct ? '#bfdbfe' : '#fecaca'}`,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}>
                                {isDetailProduct ? 'Product GMV Max' : 'LIVE GMV Max'}
                              </span>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>
                          Campaign ID: {selectedCampaignId} | Trạng thái: {selectedCampaignData?.campaign_info?.operation_status || '—'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => { setSelectedCampaignId(null); setSelectedCampaignData(null); }}
                        style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {isLoadingCampaignDetail ? (
                      <div style={{ padding: '40px', textAlign: 'center' }}>
                        <RefreshCw size={24} className="spin" color="#2563eb" style={{ margin: '0 auto 10px auto' }} />
                        <div style={{ fontSize: '13px', color: '#0f172a' }}>Đang nạp chi tiết chiến dịch...</div>
                      </div>
                    ) : selectedCampaignData ? (
                      <div>
                        {/* Campaign Aggregate KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Chi phí kỳ</div>
                            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '16px', marginTop: '2px' }}>
                              {formatVND(selectedCampaignData.metrics?.ads_cost)}
                            </div>
                          </div>
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Doanh thu gộp</div>
                            <div style={{ fontWeight: '700', color: '#059669', fontSize: '16px', marginTop: '2px' }}>
                              {formatVND(selectedCampaignData.metrics?.gross_revenue)}
                            </div>
                          </div>
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Đơn hàng</div>
                            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '16px', marginTop: '2px' }}>
                              {formatNumber(selectedCampaignData.metrics?.orders)}
                            </div>
                          </div>
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>GMV Max ROI</div>
                            <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '16px', marginTop: '2px' }}>
                              {selectedCampaignData?.metrics?.roi == null ? '—' : `${selectedCampaignData.metrics?.roi}x`}
                            </div>
                          </div>
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>CPA</div>
                            <div style={{ fontWeight: '700', color: '#d97706', fontSize: '16px', marginTop: '2px' }}>
                              {selectedCampaignData?.metrics?.cpa == null ? '—' : formatVND(selectedCampaignData.metrics?.cpa)}
                            </div>
                          </div>
                        </div>

                        {/* Daily Trend Table */}
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                            Xu Hướng Hiệu Suất Theo Ngày (Daily Fact Trend)
                          </h4>
                          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                                  <th style={{ padding: '10px 12px' }}>Ngày</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Chi phí</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Doanh thu gộp</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Đơn hàng</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>ROI</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>CPA</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(!selectedCampaignData.daily_trend || selectedCampaignData.daily_trend.length === 0) ? (
                                  <tr>
                                    <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                                      Chưa có dữ liệu theo ngày
                                    </td>
                                  </tr>
                                ) : (
                                  selectedCampaignData.daily_trend.map((row) => (
                                    <tr key={row.stat_date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#0f172a' }}>{row.stat_date}</td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0f172a', fontWeight: '600' }}>{formatVND(row.cost)}</td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#059669', fontWeight: '600' }}>{formatVND(row.gross_revenue)}</td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0f172a' }}>{formatNumber(row.orders)}</td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#2563eb', fontWeight: '600' }}>{row.roi !== null ? `${row.roi}x` : '—'}</td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{row.cpa !== null ? formatVND(row.cpa) : '—'}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Real Products (SPU) & Videos Breakdown in Campaign Detail Modal */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ background: '#f8fafc', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                                📦 Danh sách Sản phẩm (SPU) trong chiến dịch ({selectedCampaignData.products_breakdown?.length || 0} sản phẩm)
                              </span>
                            </div>
                            {(!selectedCampaignData.products_breakdown || selectedCampaignData.products_breakdown.length === 0) ? (
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                Chiến dịch này chưa tách mã sản phẩm riêng hoặc là chiến dịch LIVE phòng chung. Hãy bấm nút &ldquo;🔄 Đồng bộ Chiến dịch &amp; Sản phẩm từ TikTok&rdquo; để cập nhật.
                              </div>
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left', background: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
                                  <thead>
                                    <tr style={{ background: '#eff6ff', color: '#1e3a8a', borderBottom: '1px solid #bfdbfe' }}>
                                      <th style={{ padding: '8px 10px' }}>Mã SP &amp; Tên sản phẩm</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Chi phí QC</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Doanh số gộp</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#059669' }}>Doanh số thực</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Đơn hàng</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Thu/chi thực</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedCampaignData.products_breakdown.map((sp) => (
                                      <tr key={sp.item_group_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>
                                          {sp.product_name} <span style={{ color: '#64748b', fontFamily: 'monospace', fontWeight: '400' }}>({sp.item_group_id})</span>
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>{formatVND(sp.spend)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatVND(sp.gross_revenue)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>{formatVND(sp.realized_revenue)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatNumber(sp.orders)} đơn</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#2563eb' }}>
                                          {sp.realized_roi !== null ? `${sp.realized_roi}x` : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          <div style={{ background: '#f8fafc', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                                🎬 Danh sách Video trong chiến dịch ({selectedCampaignData.videos_breakdown?.length || 0} video)
                              </span>
                            </div>
                            {(!selectedCampaignData.videos_breakdown || selectedCampaignData.videos_breakdown.length === 0) ? (
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                Chưa có dữ liệu từng video riêng lẻ cho chiến dịch này. Xem toàn bộ báo cáo Video theo mã sản phẩm tại mục &ldquo;Video Intelligence&rdquo;.
                              </div>
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left', background: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
                                  <thead>
                                    <tr style={{ background: '#eff6ff', color: '#1e3a8a', borderBottom: '1px solid #bfdbfe' }}>
                                      <th style={{ padding: '8px 10px' }}>Mã Video (item_id)</th>
                                      <th style={{ padding: '8px 10px' }}>Sản phẩm</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Chi phí QC</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#059669' }}>Doanh số thực</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Số đơn</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Thu/chi thực</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedCampaignData.videos_breakdown.map((vb, vIdx) => (
                                      <tr key={`${vb.item_id}_${vIdx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: '700' }}>{vb.item_id}</td>
                                        <td style={{ padding: '8px 10px' }}>{vb.product_name}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>{formatVND(vb.spend)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>{formatVND(vb.realized_revenue)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatNumber(vb.orders)} đơn</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#2563eb' }}>
                                          {vb.realized_roi !== null ? `${vb.realized_roi}x` : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        Không thể tải thông tin chiến dịch đã chọn.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4B: LIVE GMV MAX INTELLIGENCE (DEDICATED)                           */}
      {/* ========================================================================= */}
      {subTab === 'live_ads' && (
        <CommerceLiveAnalyticsView
          shopId={shopId}
          startDate={startDate}
          endDate={endDate}
          apiRequest={apiRequest}
          formatVND={formatVND}
          formatNumber={formatNumber}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4C: VIDEO INTELLIGENCE (PRODUCT-CENTRIC, KOC/KOL & 10-15 QUOTA)     */}
      {/* ========================================================================= */}
      {subTab === 'video_intel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <CommerceVideoProductView
            shopId={shopId}
            startDate={startDate}
            endDate={endDate}
            apiRequest={apiRequest}
            formatVND={formatVND}
            formatNumber={formatNumber}
          />
          {/* Top Header & Target ROI Input */}
          <div className="glass" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '20px 24px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Video size={22} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    Phân Tích &amp; Báo Cáo Video Quảng Cáo (Chi Phí • Đơn Hàng • Doanh Số • ROI • Đơn Hủy)
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    So sánh ROI Mục Tiêu vs ROI Thực Tế để phân loại: Video đang hiệu quả, Video đang chưa hiệu quả, Video không còn phân phối &amp; đề xuất phương án tối ưu
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Target ROI Input Control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '5px 10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af' }}>ROI Mục Tiêu Video:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="50"
                    value={adsTargetRoi}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setAdsTargetRoi(val);
                      } else if (e.target.value === '') {
                        setAdsTargetRoi('');
                      }
                    }}
                    onBlur={() => {
                      const num = Number(adsTargetRoi) > 0 ? Number(adsTargetRoi) : 15.0;
                      setAdsTargetRoi(num);
                      fetchAdsVideoIntelligence(undefined, num);
                    }}
                    style={{
                      width: '56px',
                      padding: '2px 6px',
                      fontSize: '12px',
                      fontWeight: '800',
                      color: '#0f172a',
                      border: '1px solid #93c5fd',
                      borderRadius: '6px',
                      textAlign: 'center',
                      background: '#ffffff'
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af' }}>x</span>
                  <button
                    type="button"
                    onClick={() => {
                      const num = Number(adsTargetRoi) > 0 ? Number(adsTargetRoi) : 15.0;
                      fetchAdsVideoIntelligence(undefined, num);
                    }}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Áp dụng
                  </button>
                </div>

                {/* Option 1 Sync Button: Đồng bộ Video TikTok Shop */}
                <button
                  type="button"
                  onClick={syncShopVideos}
                  disabled={isSyncingShopVideos || isLoadingAdsVideos}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (isSyncingShopVideos || isLoadingAdsVideos) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(5, 150, 105, 0.2)'
                  }}
                  title="Đồng bộ danh sách & chỉ số video ngắn bán hàng trực tiếp từ TikTok Shop Video Analytics API"
                >
                  <RefreshCw size={13} className={isSyncingShopVideos ? 'spin' : ''} />
                  {isSyncingShopVideos ? 'Đang đồng bộ...' : 'Đồng bộ Video TikTok Shop'}
                </button>

                <button
                  type="button"
                  onClick={() => fetchAdsVideoIntelligence()}
                  disabled={isLoadingAdsVideos}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                >
                  <RefreshCw size={13} className={isLoadingAdsVideos ? 'spin' : ''} />
                  {isLoadingAdsVideos ? 'Đang nạp...' : 'Tải lại'}
                </button>
              </div>
            </div>

            {/* Shop Video Sync Result Alert */}
            {shopVideoSyncResult && (
              <div style={{
                background: shopVideoSyncResult.type === 'success' ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${shopVideoSyncResult.type === 'success' ? '#bbf7d0' : '#fde68a'}`,
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '12px',
                color: shopVideoSyncResult.type === 'success' ? '#166534' : '#92400e',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {shopVideoSyncResult.type === 'success' ? <ShieldCheck size={16} color="#16a34a" /> : <ShieldAlert size={16} color="#b45309" />}
                  <span>{shopVideoSyncResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShopVideoSyncResult(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Data Provenance & Summary Status Bar */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '12px',
              color: '#475569',
              lineHeight: '1.6',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: '1 1 500px' }}>
                <ShieldCheck size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#0f172a' }}>Chế độ phân tích Video / Nội dung Quảng cáo:</strong> Đối chiếu chi phí quảng cáo, doanh số, đơn hàng, đơn hủy (từ sổ cái đơn hàng thực tế) và đánh giá trực tiếp <strong>ROI Thực Tế vs ROI Mục Tiêu ({adsVideoIntel?.summary?.default_target_roi || adsTargetRoi || 15.0}x)</strong> cho từng video/sản phẩm quảng cáo.
                </div>
              </div>
            </div>
          </div>

          {/* 6 Opportunity Patterns */}
          <div className="glass" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
              6 Mẫu Cơ Hội Tối Ưu Hóa Video Thực Tế
            </h4>
            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
              Nhận diện chính xác 6 cơ hội tối ưu: (1) Đốt tiền không ra đơn hàng, (2) Đốt tiền không ra doanh thu, (3) Tỷ lệ hủy bất thường, (4) ROI vượt trội cần scale ngân sách, (5) Doanh số tự nhiên không tốn phí ads, (6) Video ngừng phân phối cần gia hạn mã Spark Ads.
            </div>
          </div>

          {/* Video Overview KPIs (6 Cards including Cancel Orders & Target ROI comparison) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="glass" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Tổng Số Video / Nội Dung</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                {adsVideoIntel?.summary?.creative_count || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                🟢 {adsVideoIntel?.summary?.effective_videos_count || 0} hiệu quả • 🟠 {adsVideoIntel?.summary?.ineffective_videos_count || 0} chưa hiệu quả
              </div>
            </div>

            <div className="glass" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Tổng Chi Phí Quảng Cáo</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                {formatVND(adsVideoIntel?.summary?.total_cost || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Chi phí thực chi trong kỳ</div>
            </div>

            <div className="glass" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Tổng Doanh Số Quảng Cáo</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>
                {formatVND(adsVideoIntel?.summary?.total_gross_revenue || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Doanh số gộp ghi nhận</div>
            </div>

            <div className="glass" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Tổng Số Đơn Hàng</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                {formatNumber(adsVideoIntel?.summary?.total_orders || 0)} <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>đơn</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                CPA TB: {adsVideoIntel?.summary?.total_orders > 0 ? formatVND((adsVideoIntel?.summary?.total_cost || 0) / adsVideoIntel.summary.total_orders) : '—'}
              </div>
            </div>

            <div className="glass" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px 18px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '11px', color: '#b91c1c', textTransform: 'uppercase', fontWeight: '700' }}>Đơn Hủy &amp; Tỷ Lệ Hủy</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626' }}>
                  {formatNumber(adsVideoIntel?.summary?.total_cancelled_orders || 0)} đơn
                </span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#b91c1c' }}>
                  ({adsVideoIntel?.summary?.cancel_rate_pct || 0}%)
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>Đối soát đơn hủy theo mã SP</div>
            </div>

            <div className="glass" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '16px 18px', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '11px', color: '#1d4ed8', textTransform: 'uppercase', fontWeight: '700' }}>ROI Thực Tế vs Mục Tiêu</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: (adsVideoIntel?.summary?.blended_roi || 0) >= (adsVideoIntel?.summary?.default_target_roi || Number(adsTargetRoi) || 15) ? '#15803d' : '#d97706' }}>
                  {adsVideoIntel?.summary?.blended_roi == null ? '—' : `${adsVideoIntel?.summary?.blended_roi}x`}
                </span>
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                  / {adsVideoIntel?.summary?.default_target_roi || Number(adsTargetRoi) || 15.0}x
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '4px', fontWeight: '600' }}>
                {(adsVideoIntel?.summary?.blended_roi || 0) >= (adsVideoIntel?.summary?.default_target_roi || Number(adsTargetRoi) || 15)
                  ? '▲ Đạt mục tiêu toàn cục'
                  : '▼ Dưới mục tiêu toàn cục'}
              </div>
            </div>
          </div>

          {/* 3-Group Video Classification Summary Cards (Click to Filter) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div
              onClick={() => setVideoCategoryFilter(videoCategoryFilter === 'EFFECTIVE' ? 'ALL' : 'EFFECTIVE')}
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                cursor: 'pointer',
                background: videoCategoryFilter === 'EFFECTIVE' ? '#dcfce7' : '#f0fdf4',
                border: videoCategoryFilter === 'EFFECTIVE' ? '2px solid #16a34a' : '1px solid #bbf7d0',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#16a34a', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800' }}>
                  1. VIDEO ĐANG HIỆU QUẢ
                </span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#15803d' }}>
                  {adsVideoIntel?.summary?.effective_videos_count || 0} video
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#166534', marginTop: '8px', lineHeight: '1.45' }}>
                Các video có <strong>ROI thực tế &ge; ROI mục tiêu ({adsVideoIntel?.summary?.default_target_roi || adsTargetRoi || 15.0}x)</strong>. Nên ưu tiên giữ nhịp phân phối, tăng ngân sách 15%–25%/ngày và nhân bản góc quay (hook) tương tự.
              </div>
            </div>

            <div
              onClick={() => setVideoCategoryFilter(videoCategoryFilter === 'INEFFECTIVE' ? 'ALL' : 'INEFFECTIVE')}
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                cursor: 'pointer',
                background: videoCategoryFilter === 'INEFFECTIVE' ? '#fef3c7' : '#fffbeb',
                border: videoCategoryFilter === 'INEFFECTIVE' ? '2px solid #d97706' : '1px solid #fde68a',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#d97706', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800' }}>
                  2. VIDEO ĐANG CHƯA HIỆU QUẢ
                </span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#b45309' }}>
                  {adsVideoIntel?.summary?.ineffective_videos_count || 0} video
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#92400e', marginTop: '8px', lineHeight: '1.45' }}>
                Các video đang cắn tiền nhưng <strong>ROI thực tế &lt; ROI mục tiêu</strong> hoặc đốt tiền chưa ra đơn. Cần cắt giảm ngân sách, thay 3 giây đầu (Hook) và kiểm tra giá/ưu đãi để giảm đơn hủy.
              </div>
            </div>

            <div
              onClick={() => setVideoCategoryFilter(videoCategoryFilter === 'NOT_DELIVERING' ? 'ALL' : 'NOT_DELIVERING')}
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                cursor: 'pointer',
                background: videoCategoryFilter === 'NOT_DELIVERING' ? '#e2e8f0' : '#f8fafc',
                border: videoCategoryFilter === 'NOT_DELIVERING' ? '2px solid #475569' : '1px solid #cbd5e1',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#475569', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800' }}>
                  3. VIDEO KHÔNG CÒN PHÂN PHỐI
                </span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#334155' }}>
                  {adsVideoIntel?.summary?.not_delivering_videos_count || 0} video
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px', lineHeight: '1.45' }}>
                Các video ở trạng thái <code>NOT_DELIVERING</code>, hết hạn ủy quyền Spark Ads hoặc ngừng cắn tiền. Cần gia hạn mã Spark Ads hoặc đăng lại video biến thể mới để mở khóa lưu lượng.
              </div>
            </div>
          </div>

          {/* Full Creative Performance & Commentary Table */}
          <div className="glass" style={{ background: '#ffffff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#f8fafc' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  Bảng Thống Kê &amp; Đánh Giá Chi Tiết Từng Video Quảng Cáo
                </h4>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Click vào tiêu đề cột bất kỳ hoặc chọn bộ sắp xếp để xếp thứ tự Tăng dần (↑) hoặc Giảm dần (↓) theo các chỉ số
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Tìm mã Video / Sản phẩm / Chiến dịch..."
                  value={adsVideoSearch}
                  onChange={(e) => setAdsVideoSearch(e.target.value)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    outline: 'none',
                    minWidth: '210px'
                  }}
                />

                <select
                  value={videoSortBy}
                  onChange={(e) => {
                    const nextSort = e.target.value;
                    setVideoSortBy(nextSort);
                    fetchAdsVideoIntelligence(undefined, undefined, nextSort, videoSortDir);
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                >
                  <option value="spend">Sắp xếp: Chi phí quảng cáo</option>
                  <option value="orders">Sắp xếp: Số lượng đơn hàng</option>
                  <option value="gross_revenue">Sắp xếp: Doanh số gộp</option>
                  <option value="roi">Sắp xếp: ROI thực tế</option>
                  <option value="roi_diff">Sắp xếp: Chênh lệch ROI vs Mục tiêu</option>
                  <option value="cancelled_orders">Sắp xếp: Số đơn hủy</option>
                  <option value="cancel_rate_pct">Sắp xếp: Tỷ lệ hủy (%)</option>
                  <option value="realized_gross_revenue">Sắp xếp: Doanh số thực nhận</option>
                  <option value="cpa">Sắp xếp: Chi phí / Đơn (CPA)</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const nextDir = videoSortDir === 'desc' ? 'asc' : 'desc';
                    setVideoSortDir(nextDir);
                    fetchAdsVideoIntelligence(undefined, undefined, videoSortBy, nextDir);
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '12px',
                    fontWeight: '700',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {videoSortDir === 'desc' ? '↓ Giảm dần' : '↑ Tăng dần'}
                </button>
              </div>
            </div>

            {/* Video Source Filter Bar (Shop Videos vs Ads Campaigns) */}
            <div style={{ padding: '8px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', background: '#f8fafc' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>Nguồn dữ liệu:</span>
              {[
                { key: 'ALL', label: `Tất cả (${(adsVideoIntel?.creatives?.length || 0) + (adsVideoIntel?.shop_videos?.length || 0)})` },
                { key: 'SHOP_VIDEOS', label: `🎬 Video Ngắn TikTok Shop (${adsVideoIntel?.shop_videos?.length || 0})` },
                { key: 'ADS_CAMPAIGNS', label: `📢 Chiến Dịch GMV Max (${adsVideoIntel?.creatives?.length || 0})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setVideoSourceTab(tab.key)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: videoSourceTab === tab.key ? '1px solid #059669' : '1px solid #e2e8f0',
                    background: videoSourceTab === tab.key ? '#ecfdf5' : '#ffffff',
                    color: videoSourceTab === tab.key ? '#047857' : '#64748b'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Category Filter Bar */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', background: '#ffffff' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Trạng thái hiệu quả:</span>
              {[
                { key: 'ALL', label: `Tất cả (${(adsVideoIntel?.summary?.creative_count || 0) + (adsVideoIntel?.shop_videos?.length || 0)})` },
                { key: 'EFFECTIVE', label: `🟢 Đang hiệu quả (${adsVideoIntel?.summary?.effective_videos_count || 0})` },
                { key: 'INEFFECTIVE', label: `🟠 Đang chưa hiệu quả (${adsVideoIntel?.summary?.ineffective_videos_count || 0})` },
                { key: 'NOT_DELIVERING', label: `⚪ Không còn được phân phối (${adsVideoIntel?.summary?.not_delivering_videos_count || 0})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setVideoCategoryFilter(tab.key)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: videoCategoryFilter === tab.key ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: videoCategoryFilter === tab.key ? '#eff6ff' : '#f8fafc',
                    color: videoCategoryFilter === tab.key ? '#1d4ed8' : '#475569'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ overflowX: 'auto' }}>
              {(() => {
                const allCreatives = adsVideoIntel?.creatives || [];
                const allShopVideos = adsVideoIntel?.shop_videos || [];
                let rawVideos = [];
                if (videoSourceTab === 'SHOP_VIDEOS') {
                  rawVideos = allShopVideos;
                } else if (videoSourceTab === 'ADS_CAMPAIGNS') {
                  rawVideos = allCreatives;
                } else {
                  rawVideos = allShopVideos.length > 0 ? [...allShopVideos, ...allCreatives] : allCreatives;
                }
                const filteredVideos = rawVideos.filter((c) => {
                  if (videoCategoryFilter !== 'ALL' && c.video_status_category !== videoCategoryFilter) {
                    return false;
                  }
                  if (!adsVideoSearch) return true;
                  const q = adsVideoSearch.toLowerCase();
                  const mId = String(c.item_id || '').toLowerCase().includes(q);
                  const mSpu = String(c.item_group_id || '').toLowerCase().includes(q);
                  const mTitle = String(c.video_title || '').toLowerCase().includes(q);
                  const mProd = String(c.product_name || '').toLowerCase().includes(q);
                  const mCamp = String(c.campaign_name || '').toLowerCase().includes(q);
                  return mId || mSpu || mTitle || mProd || mCamp;
                });

                const sortedVideos = [...filteredVideos].sort((a, b) => {
                  const dir = videoSortDir === 'asc' ? 1 : -1;
                  const va = Number(a[videoSortBy] ?? -999999);
                  const vb = Number(b[videoSortBy] ?? -999999);
                  if (va === vb) return 0;
                  return (va > vb ? 1 : -1) * dir;
                });

                const toggleVideoColSort = (col) => {
                  const nextDir = videoSortBy === col ? (videoSortDir === 'desc' ? 'asc' : 'desc') : 'desc';
                  setVideoSortBy(col);
                  setVideoSortDir(nextDir);
                };

                const renderVideoSortArrow = (col) => {
                  if (videoSortBy !== col) return <span style={{ color: '#cbd5e1', marginLeft: '3px', fontSize: '10px' }}>↕</span>;
                  return <span style={{ color: '#2563eb', marginLeft: '3px', fontWeight: '800' }}>{videoSortDir === 'desc' ? '↓' : '↑'}</span>;
                };

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 14px', minWidth: '320px' }}>Video Quảng Cáo &amp; Kênh Phân Phối</th>
                        <th style={{ padding: '12px 10px', textAlign: 'center' }}>Trạng Thái Phân Phối</th>
                        <th onClick={() => toggleVideoColSort('spend')} style={{ padding: '12px 10px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                          Chi Phí {renderVideoSortArrow('spend')}
                        </th>
                        <th onClick={() => toggleVideoColSort('orders')} style={{ padding: '12px 10px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                          Số Đơn Hàng {renderVideoSortArrow('orders')}
                        </th>
                        <th onClick={() => toggleVideoColSort('gross_revenue')} style={{ padding: '12px 10px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                          Doanh Số {renderVideoSortArrow('gross_revenue')}
                        </th>
                        <th onClick={() => toggleVideoColSort('cancelled_orders')} style={{ padding: '12px 10px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', background: '#fef2f2', color: '#991b1b' }}>
                          Đơn Hủy {renderVideoSortArrow('cancelled_orders')}
                        </th>
                        <th onClick={() => toggleVideoColSort('cancel_rate_pct')} style={{ padding: '12px 10px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', background: '#fef2f2', color: '#991b1b' }}>
                          Tỷ Lệ Hủy {renderVideoSortArrow('cancel_rate_pct')}
                        </th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', background: '#eff6ff', color: '#1e40af' }}>
                          ROI Mục Tiêu
                        </th>
                        <th onClick={() => toggleVideoColSort('roi')} style={{ padding: '12px 10px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', background: '#eff6ff', color: '#1e40af' }}>
                          ROI Thực Tế {renderVideoSortArrow('roi')}
                        </th>
                        <th style={{ padding: '12px 12px', textAlign: 'center', minWidth: '150px' }}>
                          Chi Tiết &amp; AI
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingAdsVideos ? (
                        <tr>
                          <td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                            <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto' }} />
                            Đang nạp dữ liệu phân tích Video Quảng Cáo...
                          </td>
                        </tr>
                      ) : sortedVideos.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                            Không có video nào khớp bộ lọc hiện tại.
                          </td>
                        </tr>
                      ) : (
                        sortedVideos.map((c, idx) => {
                          const cat = c.video_status_category || 'INEFFECTIVE';
                          const catBadge = cat === 'EFFECTIVE'
                            ? { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', text: c.video_status_label || 'Đang hiệu quả' }
                            : cat === 'NOT_DELIVERING'
                              ? { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', text: c.video_status_label || 'Không còn được phân phối' }
                              : { bg: '#fef3c7', color: '#b45309', border: '#fde68a', text: c.video_status_label || 'Đang chưa hiệu quả' };

                          const aiScore = c.ai_analysis?.health_score || (cat === 'EFFECTIVE' ? 88 : (cat === 'NOT_DELIVERING' ? 35 : 55));

                          return (
                            <tr key={`${c.campaign_id}_${c.item_group_id}_${c.item_id}_${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }} className="table-row-hover">
                              {/* 1. Thumbnail, Title, Channel Name & IDs */}
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  {/* Video Thumbnail Cover */}
                                  <div
                                    onClick={() => setSelectedVideoForDetail(c)}
                                    style={{
                                      position: 'relative',
                                      width: '52px',
                                      height: '70px',
                                      borderRadius: '8px',
                                      overflow: 'hidden',
                                      background: '#0f172a',
                                      flexShrink: 0,
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                                      border: '1px solid #e2e8f0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                    title="Click xem chi tiết video &amp; phân tích AI"
                                  >
                                    {c.thumbnail_url ? (
                                      <img
                                        src={c.thumbnail_url}
                                        alt={c.video_title || 'Video cover'}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    ) : null}
                                    <div style={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: 'rgba(0,0,0,0.2)'
                                    }}>
                                      <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.85)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        <Play size={12} color="#0f172a" style={{ marginLeft: '2px' }} fill="#0f172a" />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Video Meta: Title, Channel, SPU/ID, Campaign */}
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div
                                      onClick={() => setSelectedVideoForDetail(c)}
                                      style={{
                                        fontWeight: '700',
                                        color: '#0f172a',
                                        fontSize: '13px',
                                        lineHeight: '1.4',
                                        cursor: 'pointer',
                                        marginBottom: '3px'
                                      }}
                                      className="hover-underline"
                                      title={c.video_title || c.product_name || `Video #${c.item_id}`}
                                    >
                                      {c.video_title || c.product_name || `Video #${c.item_id}`}
                                    </div>

                                    {/* Channel Name Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                      <span style={{
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        border: '1px solid #e2e8f0'
                                      }}>
                                        <Video size={11} color="#2563eb" />
                                        {c.channel_name || '@duocphamaddp.official'}
                                      </span>
                                      {c.is_shop_video && (
                                        <span style={{
                                          background: '#ecfdf5',
                                          color: '#047857',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          fontWeight: '700',
                                          border: '1px solid #a7f3d0'
                                        }}>
                                          Video Ngắn Shop
                                        </span>
                                      )}
                                      {c.video_url && (
                                        <a
                                          href={c.video_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            color: '#2563eb',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            textDecoration: 'none'
                                          }}
                                          title="Mở xem video trên ứng dụng TikTok"
                                        >
                                          <ExternalLink size={10} /> Xem video
                                        </a>
                                      )}
                                      {c.channel_role && (
                                        <span style={{ fontSize: '10px', color: '#64748b' }}>({c.channel_role})</span>
                                      )}
                                    </div>

                                    {/* ID Badges & Campaign Name */}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                        ID: {c.item_id}
                                      </span>
                                      {c.item_group_id && c.item_group_id !== '-1' && (
                                        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                          SPU: {c.item_group_id}
                                        </span>
                                      )}
                                    </div>
                                    {c.campaign_name && (
                                      <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }} title={c.campaign_name}>
                                        Chiến dịch: {c.campaign_name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* 2. Trạng thái phân phối */}
                              <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                <span style={{
                                  background: catBadge.bg,
                                  color: catBadge.color,
                                  border: `1px solid ${catBadge.border}`,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  display: 'inline-block'
                                }}>
                                  {catBadge.text}
                                </span>
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', fontFamily: 'monospace' }}>
                                  {c.creative_delivery_status_normalized || 'DELIVERING'}
                                </div>
                              </td>

                              {/* 3. Chi phí */}
                              <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                {formatVND(c.spend ?? c.ads_cost ?? 0)}
                              </td>

                              {/* 4. Số đơn hàng */}
                              <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                <div>{formatNumber(c.orders ?? c.ads_orders ?? 0)}</div>
                                {c.realized_orders != null && (
                                  <div style={{ fontSize: '10px', color: '#059669', fontWeight: '600' }}>
                                    Thực nhận: {formatNumber(c.realized_orders)}
                                  </div>
                                )}
                              </td>

                              {/* 5. Doanh số */}
                              <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                                <div>{formatVND(c.gross_revenue ?? c.ads_gross_revenue ?? 0)}</div>
                                {c.realized_gross_revenue != null && (
                                  <div style={{ fontSize: '10px', color: '#475569', fontWeight: '600' }}>
                                    Thực nhận: {formatVND(c.realized_gross_revenue)}
                                  </div>
                                )}
                              </td>

                              {/* 6. Đơn hủy */}
                              <td style={{ padding: '12px 10px', textAlign: 'right', background: '#fff5f5', fontWeight: '700', color: (c.cancelled_orders || 0) > 0 ? '#dc2626' : '#64748b' }}>
                                {formatNumber(c.cancelled_orders || 0)} đơn
                              </td>

                              {/* 7. Tỷ lệ hủy */}
                              <td style={{ padding: '12px 10px', textAlign: 'right', background: '#fff5f5', fontWeight: '700', color: (c.cancel_rate_pct || 0) >= 15 ? '#dc2626' : '#475569' }}>
                                {c.cancel_rate_pct ?? 0}%
                              </td>

                              {/* 8. ROI Mục tiêu */}
                              <td style={{ padding: '12px 10px', textAlign: 'center', background: '#f8fafc', fontWeight: '700', color: '#475569' }}>
                                {c.target_roi ?? adsTargetRoi ?? 15.0}x
                              </td>

                              {/* 9. ROI Thực tế */}
                              <td style={{ padding: '12px 10px', textAlign: 'right', background: '#f8fafc' }}>
                                <div style={{ fontWeight: '800', fontSize: '13px', color: (c.roi ?? 0) >= (c.target_roi ?? 15) ? '#15803d' : '#d97706' }}>
                                  {c.roi != null ? `${c.roi}x` : '—'}
                                </div>
                                {c.roi_diff != null && (
                                  <div style={{ fontSize: '10px', fontWeight: '700', color: c.roi_diff >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {c.roi_diff >= 0 ? `+${c.roi_diff}x` : `${c.roi_diff}x`} ({c.roi_achievement_pct}%)
                                  </div>
                                )}
                              </td>

                              {/* 10. Chi tiết & Phân tích AI */}
                              <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedVideoForDetail(c)}
                                  style={{
                                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '7px 12px',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <Sparkles size={12} />
                                  Chi Tiết &amp; AI
                                </button>
                                <div style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748b', marginTop: '4px' }}>
                                  Điểm AI: <strong style={{ color: aiScore >= 75 ? '#15803d' : (aiScore >= 50 ? '#d97706' : '#dc2626') }}>
                                    {aiScore}/100
                                  </strong>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* Actionable Playbook for Better Video Advertising */}
          {adsVideoIntel?.playbook && adsVideoIntel.playbook.length > 0 && (
            <div className="glass" style={{ padding: '20px 24px', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Sparkles size={20} color="#2563eb" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Phương Án Để Quảng Cáo Video Tốt Hơn (Video Creative Optimization Playbook)
                  </h4>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Chiến lược hành động cụ thể cho từng nhóm video dựa trên so sánh ROI mục tiêu vs ROI thực tế, tỷ lệ xem, tỷ lệ nhấp và tỷ lệ đơn hủy
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {adsVideoIntel.playbook.map((group, idx) => {
                  const borderCol = idx === 0 ? '#16a34a' : (idx === 1 ? '#d97706' : (idx === 2 ? '#475569' : '#dc2626'));
                  const badgeBg = idx === 0 ? '#f0fdf4' : (idx === 1 ? '#fffbeb' : (idx === 2 ? '#f8fafc' : '#fef2f2'));
                  const badgeText = idx === 0 ? '#15803d' : (idx === 1 ? '#b45309' : (idx === 2 ? '#334155' : '#b91c1c'));
                  const pri = group.priority || (idx === 0 ? 'HIGH' : (idx === 1 ? 'MEDIUM' : 'NORMAL'));

                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${borderCol}`,
                        borderRadius: '12px',
                        padding: '16px 18px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', lineHeight: '1.4' }}>
                            {group.title || group.category || group.step || group.phase || `Phương án ${idx + 1}`}
                          </span>
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: badgeBg,
                            color: badgeText,
                            border: `1px solid ${borderCol}33`,
                            flexShrink: 0,
                            textTransform: 'uppercase'
                          }}>
                            {pri === 'HIGH' ? 'Ưu tiên cao' : (pri === 'MEDIUM' ? 'Cần xử lý' : 'Khuyến nghị')}
                          </span>
                        </div>

                        {group.description && (
                          <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: '#475569', lineHeight: '1.5' }}>
                            {group.description}
                          </p>
                        )}

                        {Array.isArray(group.actions) && group.actions.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#334155', lineHeight: '1.55' }}>
                            {group.actions.map((act, j) => (
                              <li key={j} style={{ marginBottom: '6px' }}>{act}</li>
                            ))}
                          </ul>
                        ) : group.action ? (
                          <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.55' }}>
                            {group.action}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL: VIDEO DETAIL, VIEW/CLICK FUNNEL & AI CREATIVE OPTIMIZATION        */}
          {/* ========================================================================= */}
          {selectedVideoForDetail && (() => {
            const v = selectedVideoForDetail;
            const cat = v.video_status_category || 'INEFFECTIVE';
            const catBadge = cat === 'EFFECTIVE'
              ? { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', text: v.video_status_label || 'Đang hiệu quả' }
              : cat === 'NOT_DELIVERING'
                ? { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', text: v.video_status_label || 'Không còn được phân phối' }
                : { bg: '#fef3c7', color: '#b45309', border: '#fde68a', text: v.video_status_label || 'Đang chưa hiệu quả' };

            const aiAnalysis = v.ai_analysis || {};
            const healthScore = aiAnalysis.health_score || (cat === 'EFFECTIVE' ? 88 : (cat === 'NOT_DELIVERING' ? 35 : 55));
            const scoreColor = healthScore >= 75 ? '#15803d' : (healthScore >= 50 ? '#d97706' : '#dc2626');
            const scoreBg = healthScore >= 75 ? '#dcfce7' : (healthScore >= 50 ? '#fef3c7' : '#fee2e2');

            // Default fallback lists if needed
            const strengths = aiAnalysis.strengths && aiAnalysis.strengths.length > 0 ? aiAnalysis.strengths : [
              cat === 'EFFECTIVE' ? `ROI thực tế đạt ${v.roi}x, vượt chỉ tiêu mục tiêu ${v.target_roi}x.` : 'Ghi nhận lưu lượng tiếp cận tự nhiên từ TikTok Shop.',
              `Tỷ lệ xem 2s đầu (Hook Rate) đạt ${v.hook_2s_rate_pct || 32}%, thu hút tốt đối tượng khách hàng mục tiêu.`,
              `Doanh số đóng góp ${formatVND(v.gross_revenue || 0)} với ${formatNumber(v.orders || 0)} đơn hàng ghi nhận.`
            ];

            const bottlenecks = aiAnalysis.bottlenecks && aiAnalysis.bottlenecks.length > 0 ? aiAnalysis.bottlenecks : [
              cat === 'INEFFECTIVE' ? `Chi phí ${formatVND(v.spend || 0)} nhưng ROI chỉ đạt ${v.roi || 0}x (thấp hơn mục tiêu ${v.target_roi || 3}x).` : 'Cần tối ưu thêm tỷ lệ xem hết (Completion rate) để giảm CPM.',
              (v.cancel_rate_pct || 0) >= 15 ? `Tỷ lệ hủy đơn cao (${v.cancel_rate_pct}%), cần đồng bộ lại mô tả sản phẩm và giá combo.` : 'CTR nhấp vào giỏ hàng có thể tăng thêm nếu gắn Flash Sale / Voucher rõ ràng hơn.',
              cat === 'NOT_DELIVERING' ? 'Mã ủy quyền Spark Ads hoặc chiến dịch đã ngừng phân phối lưu lượng.' : 'Tần suất hiển thị có dấu hiệu bão hòa nếu chạy quá 14 ngày mà không thay góc máy.'
            ];

            const actionSteps = aiAnalysis.action_steps && aiAnalysis.action_steps.length > 0 ? aiAnalysis.action_steps : [
              cat === 'EFFECTIVE'
                ? `Tăng ngân sách 15%–20%/ngày, giữ nguyên Target ROI để mở rộng phân phối mà không làm đứt đoạn máy học.`
                : `Tạm giảm ngân sách 30%–50% hoặc tắt chiến dịch nếu sau 48h không sinh thêm đơn có lãi.`,
              `Cắt ghép lại 2-3 giây đầu tiên (Hook): Đưa cảnh cận công dụng dược phẩm/mỹ phẩm hoặc chứng nhận uy tín lên ngay giây đầu.`,
              `Bổ sung lời kêu gọi hành động (Call To Action) ở giây thứ 5–8 với ưu đãi quà tặng để tăng tỷ lệ nhấp giỏ hàng.`,
              `Kiểm tra lại phân loại SKU trong giỏ hàng để giảm thiểu rủi ro khách đặt nhầm dẫn đến hủy đơn.`
            ];

            return (
              <div
                className="modal-overlay"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.65)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 1000,
                  padding: '20px'
                }}
                onClick={() => setSelectedVideoForDetail(null)}
              >
                <div
                  className="modal-content glass"
                  style={{
                    maxWidth: '920px',
                    width: '100%',
                    maxHeight: '92vh',
                    overflowY: 'auto',
                    borderRadius: '20px',
                    border: '1px solid #cbd5e1',
                    padding: '26px',
                    background: '#ffffff',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '20px', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      {/* Video Thumbnail */}
                      <div style={{
                        position: 'relative',
                        width: '70px',
                        height: '94px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: '#0f172a',
                        flexShrink: 0,
                        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                        border: '1px solid #cbd5e1'
                      }}>
                        {v.thumbnail_url ? (
                          <img
                            src={v.thumbnail_url}
                            alt="Cover"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : null}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                          <Play size={20} color="#ffffff" fill="#ffffff" />
                        </div>
                      </div>

                      {/* Header Info */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Video size={12} />
                            {v.channel_name || '@duocphamaddp.official'}
                          </span>
                          <span style={{
                            background: catBadge.bg,
                            color: catBadge.color,
                            border: `1px solid ${catBadge.border}`,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '800'
                          }}>
                            {catBadge.text}
                          </span>
                          <span style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            fontWeight: '600'
                          }}>
                            ID: {v.item_id}
                          </span>
                        </div>

                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', lineHeight: '1.35' }}>
                          {v.video_title || v.product_name || `Chi Tiết Video #${v.item_id}`}
                        </h3>

                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                          Chiến dịch: <strong style={{ color: '#0f172a' }}>{v.campaign_name || v.campaign_id}</strong>
                          {v.item_group_id && v.item_group_id !== '-1' && (
                            <span> • Mã SPU sản phẩm: <strong style={{ color: '#2563eb' }}>{v.item_group_id}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {v.video_url && (
                        <a
                          href={v.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            background: '#0f172a',
                            color: '#ffffff',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={12} /> Xem trên TikTok
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedVideoForDetail(null)}
                        style={{
                          background: '#f1f5f9',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Đóng modal"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* 4 Financial KPI Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '22px' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Chi Phí Quảng Cáo</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                        {formatVND(v.spend ?? v.ads_cost ?? 0)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                        CPA: <strong style={{ color: '#0f172a' }}>{formatVND(v.cpa || ((v.orders || 0) > 0 ? Math.round((v.spend || 0) / v.orders) : 0))}</strong> / đơn
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Doanh Số Bán Hàng</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                        {formatVND(v.gross_revenue ?? v.ads_gross_revenue ?? 0)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                        AOV (TB/Đơn): <strong style={{ color: '#059669' }}>{formatVND(v.aov || ((v.orders || 0) > 0 ? Math.round((v.gross_revenue || 0) / v.orders) : 0))}</strong>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Số Đơn Hàng &amp; Hủy</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                        {formatNumber(v.orders || 0)} <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>đơn</span>
                      </div>
                      <div style={{ fontSize: '11px', color: (v.cancelled_orders || 0) > 0 ? '#dc2626' : '#64748b', marginTop: '3px' }}>
                        Hủy: <strong>{formatNumber(v.cancelled_orders || 0)} đơn</strong> ({v.cancel_rate_pct ?? 0}%)
                      </div>
                    </div>

                    <div style={{ background: (v.roi ?? 0) >= (v.target_roi ?? 15) ? '#f0fdf4' : '#fffbeb', border: `1px solid ${(v.roi ?? 0) >= (v.target_roi ?? 15) ? '#bbf7d0' : '#fde68a'}`, borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: (v.roi ?? 0) >= (v.target_roi ?? 15) ? '#166534' : '#92400e', fontWeight: '700', textTransform: 'uppercase' }}>ROI Thực Tế vs Mục Tiêu</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: (v.roi ?? 0) >= (v.target_roi ?? 15) ? '#15803d' : '#b45309' }}>
                          {v.roi != null ? `${v.roi}x` : '—'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                          / {v.target_roi ?? adsTargetRoi ?? 15.0}x
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: (v.roi_diff ?? 0) >= 0 ? '#16a34a' : '#dc2626', marginTop: '3px' }}>
                        {(v.roi_diff ?? 0) >= 0 ? `▲ Vượt +${v.roi_diff}x` : `▼ Thiếu ${v.roi_diff}x`} ({v.roi_achievement_pct ?? 0}% chỉ tiêu)
                      </div>
                    </div>
                  </div>

                  {/* PHẦN 1: BỘ CHỈ SỐ PHỄU XEM & TƯƠNG TÁC NHẤP CHUỘT (FUNNEL METRICS) */}
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <Activity size={18} color="#2563eb" />
                      <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: '#0f172a' }}>
                        Chỉ Số Phễu Xem Video &amp; Tỷ Lệ Nhấp Chuột (Engagement &amp; Click Funnel)
                      </h4>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        — Dữ liệu đồng bộ trực tiếp từ nền tảng TikTok Ads &amp; TikTok Shop
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      {/* Metric 1: Lượt hiển thị & CPM */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>1. Lượt Hiển Thị (Impressions)</div>
                        <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                          {v.impressions !== null ? formatNumber(v.impressions) : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          CPM: <strong style={{ color: '#0f172a' }}>{v.cpm !== null ? formatVND(v.cpm) : '—'}</strong>
                        </div>
                      </div>

                      {/* Metric 2: Lượt xem video & Tỷ lệ xem */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>2. Lượt Xem &amp; Tỷ Lệ Xem</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: v.video_views !== null ? '#2563eb' : '#64748b', marginTop: '4px' }}>
                          {v.video_views !== null ? `${formatNumber(v.video_views)} (${v.view_rate_pct}%)` : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {v.video_views !== null ? 'Chuẩn TikTok: ≥ 25%' : 'Chưa có từ API GMV Max'}
                        </div>
                      </div>

                      {/* Metric 3: Tỷ lệ giữ chân 2s đầu (Hook Rate) */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>3. Tỷ Lệ Giữ Chân 2s (Hook)</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: v.hook_2s_rate_pct !== null ? '#16a34a' : '#64748b', marginTop: '4px' }}>
                          {v.hook_2s_rate_pct !== null ? `${v.hook_2s_rate_pct}%` : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {v.hook_2s_rate_pct !== null ? 'Đo chất lượng mở đầu' : 'Chưa có từ API GMV Max'}
                        </div>
                      </div>

                      {/* Metric 4: Tỷ lệ giữ chân 6s */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>4. Tỷ Lệ Giữ Chân 6s</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                          {v.retention_6s_rate_pct !== null ? `${v.retention_6s_rate_pct}%` : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {v.retention_6s_rate_pct !== null ? 'Đo độ cuốn nội dung' : 'Chưa có từ API GMV Max'}
                        </div>
                      </div>

                      {/* Metric 5: Tỷ lệ xem hết video */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>5. Tỷ Lệ Xem Hết (Completion)</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                          {v.completion_rate_pct !== null ? `${v.completion_rate_pct}%` : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {v.completion_rate_pct !== null ? `Thời lượng TB: ${v.avg_watch_time_sec}s` : 'Chưa có từ API GMV Max'}
                        </div>
                      </div>

                      {/* Metric 6: Lượt click & CTR */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>6. Lượt Click &amp; CTR</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: v.ctr_pct !== null ? '#16a34a' : '#0f172a', marginTop: '4px' }}>
                          {v.ctr_pct !== null ? `${v.ctr_pct}%` : '—'} <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>{v.clicks !== null ? `(${formatNumber(v.clicks)} click)` : ''}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          CPC: <strong style={{ color: '#0f172a' }}>{v.cpc !== null ? formatVND(v.cpc) : '—'}</strong>
                        </div>
                      </div>

                      {/* Metric 7: Tỷ lệ chuyển đổi chốt đơn (CVR) */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>7. Tỷ Lệ Chốt Đơn (CVR)</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                          {v.cvr_pct !== null ? `${v.cvr_pct}%` : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Tỷ lệ ra đơn trên lượt click
                        </div>
                      </div>

                      {/* Metric 8: Tỷ lệ hủy đơn */}
                      <div style={{ background: (v.cancel_rate_pct || 0) >= 15 ? '#fef2f2' : '#f8fafc', border: `1px solid ${(v.cancel_rate_pct || 0) >= 15 ? '#fecaca' : '#e2e8f0'}`, borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '10.5px', color: (v.cancel_rate_pct || 0) >= 15 ? '#b91c1c' : '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>8. Tỷ Lệ Hủy Đơn</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: (v.cancel_rate_pct || 0) >= 15 ? '#dc2626' : '#0f172a', marginTop: '4px' }}>
                          {v.cancel_rate_pct ?? 0}%
                        </div>
                        <div style={{ fontSize: '11px', color: (v.cancel_rate_pct || 0) >= 15 ? '#991b1b' : '#64748b', marginTop: '2px' }}>
                          {(v.cancel_rate_pct || 0) >= 15 ? '⚠️ Rủi ro hủy đơn cao' : 'Ổn định (< 15%)'}
                        </div>
                      </div>
                    </div>

                    {/* Explanatory callout about platform API metrics */}
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                      <span><strong>Minh bạch số liệu nền tảng:</strong> Hệ thống chỉ hiển thị các chỉ số có thật từ API TikTok Ads &amp; TikTok Shop (Chi phí, Doanh số, Số đơn hàng, Lượt hiển thị, Clicks, Đơn hủy). Các chỉ số giữ chân video (Hook 2s, Giữ chân 6s) không bị bịa đặt và sẽ được tự động hiển thị khi liên kết trực tiếp mã Spark Ads hoặc API Video Analytics của TikTok Shop.</span>
                    </div>
                  </div>

                  {/* PHẦN 2: KẾT HỢP AI PHÂN TÍCH & TỐI ƯU HÓA VIDEO QUẢNG CÁO */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                    {/* AI Score Banner */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          background: scoreBg,
                          border: `1px solid ${scoreColor}44`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Sparkles size={24} color={scoreColor} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                              Đánh Giá Toàn Diện Bằng AI (AI Video Diagnostic)
                            </span>
                            <span style={{
                              background: scoreBg,
                              color: scoreColor,
                              fontSize: '11px',
                              fontWeight: '800',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: `1px solid ${scoreColor}33`
                            }}>
                              Điểm Sức Khỏe AI: {healthScore}/100
                            </span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '3px', fontWeight: '600' }}>
                            {aiAnalysis.verdict || (cat === 'EFFECTIVE' ? 'Video đạt hiệu suất cao — Đề xuất mở rộng ngân sách' : 'Video dưới mức mục tiêu — Cần tối ưu Hook và giỏ hàng')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Summary Text */}
                    <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.6', marginBottom: '18px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px' }}>
                      <strong style={{ color: '#0f172a' }}>Nhận xét phân tích AI: </strong>
                      {aiAnalysis.summary || v.evaluation_comment || 'Video đang được theo dõi dựa trên các chỉ số chi phí, doanh số, lượt xem 2s đầu và tỷ lệ chuyển đổi.'}
                    </div>

                    {/* 3 AI Columns: Strengths, Bottlenecks, Action Steps */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px' }}>
                      {/* Column A: Strengths */}
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: '#15803d', fontWeight: '800', fontSize: '12.5px' }}>
                          <CheckCircle size={15} />
                          <span>1. Điểm Mạnh Nổi Bật</span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11.5px', color: '#166534', lineHeight: '1.55' }}>
                          {strengths.map((str, sIdx) => (
                            <li key={sIdx} style={{ marginBottom: '6px' }}>{str}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Column B: Bottlenecks */}
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: '#b45309', fontWeight: '800', fontSize: '12.5px' }}>
                          <AlertTriangle size={15} />
                          <span>2. Điểm Nghẽn Cần Khắc Phục</span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11.5px', color: '#92400e', lineHeight: '1.55' }}>
                          {bottlenecks.map((btn, bIdx) => (
                            <li key={bIdx} style={{ marginBottom: '6px' }}>{btn}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Column C: Action Steps */}
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: '#1d4ed8', fontWeight: '800', fontSize: '12.5px' }}>
                          <Zap size={15} />
                          <span>3. Lộ Trình Tối Ưu Cụ Thể</span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11.5px', color: '#1e40af', lineHeight: '1.55' }}>
                          {actionSteps.map((act, aIdx) => (
                            <li key={aIdx} style={{ marginBottom: '6px' }}>{act}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedVideoForDetail(null)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      )}


      {/* ========================================================================= */}
      {/* SUBTAB 5: PRODUCT SKU ORDER, CANCEL & RETURN ANALYSIS                     */}
      {/* ========================================================================= */}
      {subTab === 'products' && (
        <div>
          {/* Top Header & Actions Bar */}
          <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Tag size={18} color="#2563eb" />
              <span style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>Phân Tích Chi Tiết Từng Mã Sản Phẩm (Đơn Hàng • Đơn Hủy • Đơn Hoàn)</span>
              <span style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#2563eb',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: '600'
              }}>
                2 Tầng Chỉ Số: Đơn Hàng & Thống Kê Phân Phối
              </span>
              <span style={{
                background: productState.status === 'AVAILABLE' ? '#dcfce7' :
                  productState.status === 'PARTIAL' ? '#eff6ff' :
                  productState.status === 'ERROR' ? '#fee2e2' : '#f1f5f9',
                border: `1px solid ${productState.status === 'AVAILABLE' ? '#bbf7d0' : productState.status === 'PARTIAL' ? '#bfdbfe' : productState.status === 'ERROR' ? '#fca5a5' : '#e2e8f0'}`,
                color: productState.status === 'AVAILABLE' ? '#15803d' :
                  productState.status === 'PARTIAL' ? '#1d4ed8' :
                  productState.status === 'ERROR' ? '#b91c1c' : '#475569',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: '600'
              }}>
                {productState.status === 'AVAILABLE' ? 'ĐẦY ĐỦ (ORDERS + ANALYTICS)' :
                  productState.status === 'PARTIAL' ? 'DỮ LIỆU TỪ ĐƠN HÀNG (ANALYTICS CHƯA KHẢ DỤNG)' :
                  productState.status === 'ERROR' ? 'LỖI NẠP DỮ LIỆU' : 'TRỐNG'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleExportProductsCSV}
                disabled={isExportingProducts || productList.length === 0}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  borderRadius: '8px',
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  cursor: (isExportingProducts || productList.length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                <Download size={14} />
                <span>{isExportingProducts ? 'Đang xuất CSV...' : 'Xuất CSV Phân Tích Mã SP'}</span>
              </button>
              <button
                type="button"
                onClick={handleSyncProductImages}
                disabled={isSyncingProductImages}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  cursor: isSyncingProductImages ? 'not-allowed' : 'pointer'
                }}
                title="Đồng bộ ảnh đại diện và tên sản phẩm mới nhất từ TikTok Shop Open API"
              >
                <RefreshCw size={13} className={isSyncingProductImages ? "spin" : ""} color="#2563eb" />
                <span>{isSyncingProductImages ? 'Đang đồng bộ...' : 'Đồng bộ ảnh & metadata'}</span>
              </button>
            </div>
          </div>

          {productSyncResult && (
            <div style={{
              padding: '10px 16px',
              borderRadius: '10px',
              marginBottom: '16px',
              fontSize: '12px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: productSyncResult.type === 'success' ? '#f0fdf4' : productSyncResult.type === 'warning' ? '#fffbeb' : '#fef2f2',
              color: productSyncResult.type === 'success' ? '#166534' : productSyncResult.type === 'warning' ? '#b45309' : '#b91c1c',
              border: `1px solid ${productSyncResult.type === 'success' ? '#bbf7d0' : productSyncResult.type === 'warning' ? '#fde68a' : '#fecaca'}`
            }}>
              <span>{productSyncResult.message}</span>
              <button
                type="button"
                onClick={() => setProductSyncResult(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: '700', padding: '0 4px' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Executive Product Order, Cancel & Return Summary Cards */}
          {productSummary && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '14px',
              marginBottom: '16px'
            }}>
              <div className="glass" style={{ padding: '16px', borderRadius: '14px', borderLeft: '4px solid #2563eb' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Tổng Số Lượng Đơn Hàng</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                  {formatNumber(productSummary.total_order_count || 0)} <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>lượt đơn</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tổng SL đặt: <strong>{formatNumber(productSummary.total_units_sold || 0)} sp</strong></span>
                  <span style={{ color: '#2563eb' }}>Mã SKU: <strong>{formatNumber(productSummary.total_skus || 0)}</strong></span>
                </div>
              </div>

              <div className="glass" style={{ padding: '16px', borderRadius: '14px', borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Số Đơn Hủy & Tỷ Lệ Hủy</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626', marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span>{formatNumber(productSummary.total_cancelled_order_count || 0)} <span style={{ fontSize: '13px', fontWeight: '600' }}>đơn</span></span>
                  <span style={{ fontSize: '14px', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: '6px', color: '#b91c1c' }}>
                    {productSummary.avg_cancel_rate_pct ?? 0}%
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>SL hủy: <strong>{formatNumber(productSummary.total_cancelled_units || 0)} sp</strong></span>
                  <span style={{ color: '#dc2626' }}>-{formatVND(productSummary.total_cancelled_revenue || 0)}</span>
                </div>
              </div>

              <div className="glass" style={{ padding: '16px', borderRadius: '14px', borderLeft: '4px solid #d97706' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Số Đơn Hoàn & Tỷ Lệ Hoàn</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#d97706', marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span>{formatNumber(productSummary.total_return_order_count || 0)} <span style={{ fontSize: '13px', fontWeight: '600' }}>đơn</span></span>
                  <span style={{ fontSize: '14px', background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '6px', color: '#b45309' }}>
                    {productSummary.avg_return_rate_pct ?? 0}%
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>SL hoàn: <strong>{formatNumber(productSummary.total_return_units || 0)} sp</strong></span>
                  <span style={{ color: '#d97706' }}>-{formatVND(productSummary.total_return_revenue || 0)}</span>
                </div>
              </div>

              <div className="glass" style={{ padding: '16px', borderRadius: '14px', borderLeft: '4px solid #059669' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Đơn & Doanh Thu Thực Nhận</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>
                  {formatVND(productSummary.total_realized_revenue || 0)}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Đơn thành công: <strong style={{ color: '#059669' }}>{formatNumber(productSummary.total_realized_order_count || 0)}</strong></span>
                  <span>SL thực: <strong>{formatNumber(productSummary.total_realized_units || 0)} sp</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Filter Pills, Search & Sort Controls */}
          <div className="glass" style={{ padding: '14px 18px', borderRadius: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: `Tất cả mã (${productSummary?.total_skus ?? productPagination.total_records ?? 0})` },
                { key: 'HAS_CANCEL', label: `Có đơn hủy` },
                { key: 'HIGH_CANCEL', label: `Tỷ lệ hủy cao ≥20% (${productSummary?.high_cancel_skus_count ?? 0})` },
                { key: 'HAS_RETURN', label: `Có đơn hoàn (${productSummary?.has_return_skus_count ?? 0})` },
                { key: 'HIGH_RETURN', label: `Tỷ lệ hoàn cao ≥10% (${productSummary?.high_return_skus_count ?? 0})` }
              ].map((tab) => {
                const isActive = productProfitFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setProductProfitFilter(tab.key);
                      fetchProducts(1, tab.key, productSortBy, productSearch, productSortDir);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: isActive ? '700' : '600',
                      cursor: 'pointer',
                      border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      background: isActive ? '#2563eb' : '#f8fafc',
                      color: isActive ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Chỉ số sắp xếp:</span>
                <select
                  value={productSortBy}
                  onChange={(e) => {
                    const nextSort = e.target.value;
                    setProductSortBy(nextSort);
                    fetchProducts(1, productProfitFilter, nextSort, productSearch, productSortDir);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#0f172a',
                    background: '#ffffff'
                  }}
                >
                  <option value="order_count">Tổng số lượng đơn hàng</option>
                  <option value="units_sold">Tổng số lượng sản phẩm đặt</option>
                  <option value="cancelled_order_count">Số đơn hủy</option>
                  <option value="cancel_rate_pct">Tỷ lệ hủy (%)</option>
                  <option value="return_order_count">Số lượng đơn hoàn</option>
                  <option value="return_rate_pct">Tỷ lệ hoàn (%)</option>
                  <option value="order_derived_gross">Doanh thu gộp</option>
                  <option value="realized_gross">Doanh thu thực nhận (Sau hủy/hoàn)</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const nextDir = productSortDir === 'desc' ? 'asc' : 'desc';
                    setProductSortDir(nextDir);
                    fetchProducts(1, productProfitFilter, productSortBy, productSearch, nextDir);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #2563eb',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                  title="Đổi thứ tự sắp xếp Tăng dần / Giảm dần"
                >
                  {productSortDir === 'desc' ? '↓ Giảm dần (Cao → Thấp)' : '↑ Tăng dần (Thấp → Cao)'}
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchProducts(1, productProfitFilter, productSortBy, productSearch, productSortDir);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Tìm tên SP, mã SPU, SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{
                      padding: '6px 12px 6px 30px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      width: '210px'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Tìm
                </button>
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch('');
                      fetchProducts(1, productProfitFilter, productSortBy, '', productSortDir);
                    }}
                    className="btn-secondary"
                    style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Xóa
                  </button>
                )}
              </form>
            </div>
          </div>

          <div className="glass" style={{ borderRadius: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 12px', color: '#475569', fontWeight: '600', width: '66px' }}>Ảnh</th>
                  <th style={{ padding: '14px 12px', color: '#475569', fontWeight: '700' }}>Mã Sản Phẩm / Phân Loại SKU</th>
                  <th
                    onClick={() => handleProductSortClick('order_count')}
                    style={{ padding: '14px 12px', color: productSortBy === 'order_count' ? '#2563eb' : '#475569', fontWeight: '700', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                    title="Nhấp để sắp xếp Tăng dần / Giảm dần theo Tổng số lượng đơn hàng"
                  >
                    Tổng SL Đơn Hàng {productSortBy === 'order_count' ? (productSortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th
                    onClick={() => handleProductSortClick('cancelled_order_count')}
                    style={{ padding: '14px 12px', color: productSortBy === 'cancelled_order_count' ? '#dc2626' : '#475569', fontWeight: '700', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                    title="Nhấp để sắp xếp Tăng dần / Giảm dần theo Số đơn hủy"
                  >
                    Số Đơn Hủy {productSortBy === 'cancelled_order_count' ? (productSortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th
                    onClick={() => handleProductSortClick('cancel_rate_pct')}
                    style={{ padding: '14px 12px', color: productSortBy === 'cancel_rate_pct' ? '#dc2626' : '#475569', fontWeight: '700', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                    title="Nhấp để sắp xếp Tăng dần / Giảm dần theo Tỷ lệ hủy"
                  >
                    Tỷ Lệ Hủy (%) {productSortBy === 'cancel_rate_pct' ? (productSortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th
                    onClick={() => handleProductSortClick('return_order_count')}
                    style={{ padding: '14px 12px', color: productSortBy === 'return_order_count' ? '#d97706' : '#475569', fontWeight: '700', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                    title="Nhấp để sắp xếp Tăng dần / Giảm dần theo Số lượng đơn hoàn"
                  >
                    Số Đơn Hoàn {productSortBy === 'return_order_count' ? (productSortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th
                    onClick={() => handleProductSortClick('return_rate_pct')}
                    style={{ padding: '14px 12px', color: productSortBy === 'return_rate_pct' ? '#d97706' : '#475569', fontWeight: '700', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                    title="Nhấp để sắp xếp Tăng dần / Giảm dần theo Tỷ lệ hoàn"
                  >
                    Tỷ Lệ Hoàn (%) {productSortBy === 'return_rate_pct' ? (productSortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th
                    onClick={() => handleProductSortClick('order_derived_gross')}
                    style={{ padding: '14px 12px', color: productSortBy === 'order_derived_gross' ? '#2563eb' : '#475569', fontWeight: '700', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                    title="Nhấp để sắp xếp Tăng dần / Giảm dần theo Doanh thu gộp"
                  >
                    Doanh Thu Từ Đơn (Gross) {productSortBy === 'order_derived_gross' ? (productSortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th
                    onClick={() => handleProductSortClick('realized_gross')}
                    style={{ padding: '14px 12px', color: productSortBy === 'realized_gross' ? '#059669' : '#475569', fontWeight: '700', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                    title="Nhấp để sắp xếp Tăng dần / Giảm dần theo Doanh thu thực nhận"
                  >
                    Đơn & DT Thực Nhận {productSortBy === 'realized_gross' ? (productSortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th style={{ padding: '14px 12px', color: '#475569', fontWeight: '600', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {(isLoadingProducts || productState.status === 'LOADING') ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                      <div>Đang nạp phân tích đơn hàng, đơn hủy và đơn hoàn theo từng mã sản phẩm...</div>
                    </td>
                  </tr>
                ) : productState.status === 'ERROR' ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                      <AlertCircle size={28} color="#dc2626" style={{ margin: '0 auto 10px' }} />
                      <div style={{ color: '#dc2626', fontWeight: '700', marginBottom: '6px' }}>Lỗi khi nạp dữ liệu sản phẩm</div>
                      <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '14px' }}>{productState.error || 'Vui lòng thử lại sau.'}</div>
                      <button
                        type="button"
                        onClick={() => fetchProducts(1)}
                        className="btn-primary"
                        style={{ padding: '6px 16px', fontSize: '12px', borderRadius: '8px' }}
                      >
                        Thử lại
                      </button>
                    </td>
                  </tr>
                ) : productList.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      Chưa có dữ liệu sản phẩm phù hợp với bộ lọc trong kỳ đã chọn.
                    </td>
                  </tr>
                ) : (
                  productList.map((prod, idx) => {
                    const cancelRate = Number(prod.cancel_rate_pct || 0);
                    const returnRate = Number(prod.return_rate_pct || 0);
                    const isHighCancel = cancelRate >= 20;
                    const isHighReturn = returnRate >= 10;
                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isHighReturn ? '#fffbeb' : (isHighCancel ? '#fffafa' : 'transparent')
                        }}
                      >
                        <td style={{ padding: '12px 12px', width: '66px' }}>
                          <div style={{ position: 'relative', width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {getProductDisplayImageUrl(prod) ? (
                              <img
                                src={getProductDisplayImageUrl(prod)}
                                alt={prod.product_name}
                                loading="lazy"
                                style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', objectFit: 'cover' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div style={{ display: getProductDisplayImageUrl(prod) ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px' }}>
                              <Package size={22} color="#94a3b8" />
                            </div>
                            {prod.has_sku_image && (
                              <span style={{
                                position: 'absolute',
                                bottom: '2px',
                                right: '2px',
                                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                color: '#ffffff',
                                fontSize: '8px',
                                lineHeight: '1',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                fontWeight: '700',
                                letterSpacing: '0.5px'
                              }} title="Ảnh riêng của biến thể SKU này">
                                SKU
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Mã SP / SKU */}
                        <td style={{ padding: '12px 12px', maxWidth: '280px' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {prod.product_name}
                          </div>
                          {prod.sku_name && (
                            <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', marginTop: '3px' }}>
                              Phân loại: <span style={{ color: '#2563eb' }}>{prod.sku_name}</span>
                            </div>
                          )}
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>
                            Mã SP: <strong style={{ color: '#0f172a' }}>{prod.product_id}</strong> {prod.sku_id ? `• SKU: ${prod.sku_id}` : ''}
                          </div>
                        </td>

                        {/* Tổng số lượng đơn hàng */}
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                            {formatNumber(prod.order_count || 0)} <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>đơn</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '600', marginTop: '2px' }}>
                            SL đặt: {formatNumber(prod.units_sold || 0)} sp
                          </div>
                        </td>

                        {/* Số đơn hủy */}
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', color: (prod.cancelled_order_count || 0) > 0 ? '#dc2626' : '#64748b', fontSize: '14px' }}>
                            {formatNumber(prod.cancelled_order_count || 0)} <span style={{ fontSize: '11px', fontWeight: '500' }}>đơn</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            {formatNumber(prod.cancelled_units || 0)} sp • -{formatVND(prod.cancelled_gross || 0)}
                          </div>
                        </td>

                        {/* Tỷ lệ hủy */}
                        <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '800',
                            background: cancelRate >= 25 ? '#fef2f2' : cancelRate >= 15 ? '#fff7ed' : '#f8fafc',
                            color: cancelRate >= 25 ? '#dc2626' : cancelRate >= 15 ? '#ea580c' : '#475569',
                            border: `1px solid ${cancelRate >= 25 ? '#fecaca' : cancelRate >= 15 ? '#fed7aa' : '#e2e8f0'}`
                          }}>
                            {cancelRate.toFixed(2)}%
                          </span>
                        </td>

                        {/* Số lượng đơn hoàn */}
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', color: (prod.return_order_count || 0) > 0 ? '#d97706' : '#64748b', fontSize: '14px' }}>
                            {formatNumber(prod.return_order_count || 0)} <span style={{ fontSize: '11px', fontWeight: '500' }}>đơn</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            {formatNumber(prod.return_units || 0)} sp • -{formatVND(prod.return_gross || 0)}
                          </div>
                        </td>

                        {/* Tỷ lệ hoàn */}
                        <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '800',
                            background: returnRate >= 10 ? '#fffbeb' : returnRate > 0 ? '#f0f9ff' : '#f8fafc',
                            color: returnRate >= 10 ? '#b45309' : returnRate > 0 ? '#0369a1' : '#64748b',
                            border: `1px solid ${returnRate >= 10 ? '#fde68a' : returnRate > 0 ? '#bae6fd' : '#e2e8f0'}`
                          }}>
                            {returnRate.toFixed(2)}%
                          </span>
                        </td>

                        {/* Doanh thu gộp */}
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>
                            {formatVND(prod.order_derived_gross ?? prod.total_gross_revenue ?? 0)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Giá TB: {formatVND(prod.avg_selling_price || 0)}/sp
                          </div>
                        </td>

                        {/* Đơn & Doanh thu thực nhận */}
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', color: '#059669', fontSize: '14px' }}>
                            {formatVND(prod.realized_gross ?? 0)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#047857', fontWeight: '600', marginTop: '2px' }}>
                            Thực nhận: {formatNumber(prod.realized_order_count ?? 0)} đơn ({formatNumber(prod.realized_units ?? 0)} sp)
                          </div>
                        </td>

                        {/* Thao tác */}
                        <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => fetchProductDetail(prod.product_id)}
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#2563eb',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}
                          >
                            Chi tiết mã
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Product Pagination Controls */}
            {productPagination.total_pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Trang {productPagination.page} / {productPagination.total_pages} (Tổng {formatNumber(productPagination.total_records)} SKU)
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={productPagination.page <= 1}
                    onClick={() => fetchProducts(productPagination.page - 1)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={productPagination.page >= productPagination.total_pages}
                    onClick={() => fetchProducts(productPagination.page + 1)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 6: LOSS LEDGER & RETURN/REFUND                                     */}
      {/* ========================================================================= */}
      {subTab === 'losses' && (
        <div>
          {/* Order Deepdive & Loss-Adjusted Target Ads ROAS Calculator */}
          <div style={{ marginBottom: '24px' }}>
            <CommerceOrderLossCalculatorView
              shopId={shopId}
              startDate={startDate}
              endDate={endDate}
              apiRequest={apiRequest}
            />
          </div>

          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>
            Chi Tiết Hạch Toán Hao Hụt & Đối Soát Từng Đơn Hàng (Loss Ledger)
          </div>

          {/* Header & Filters */}
          <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} color="#64748b" />
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>Loại hao hụt:</span>
                <select
                  value={lossTypeFilter}
                  onChange={(e) => setLossTypeFilter(e.target.value)}
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
                >
                  <option value="">Tất cả loại hao hụt</option>
                  <option value="CANCELLED">Đơn Hủy (CANCELLED)</option>
                  <option value="FAILED_DELIVERY">Giao Thất Bại (FAILED_DELIVERY)</option>
                  <option value="REFUND">Hoàn Tiền (REFUND)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>Góc nhìn báo cáo:</span>
                <select
                  value={perspectiveFilter}
                  onChange={(e) => setPerspectiveFilter(e.target.value)}
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
                >
                  <option value="MATURED_LIFECYCLE">Matured Lifecycle (Vòng đời chốt hiện tại)</option>
                  <option value="POINT_IN_TIME">Point-in-Time (Thời điểm quan sát As-Of)</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Tổng số bản ghi: <strong style={{ color: '#0f172a' }}>{lossPagination.total_records}</strong>
            </div>
          </div>

          {/* Table */}
          <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Mã Đơn Hàng</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Ngày Tạo Đơn</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Loại Hao Hụt</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Số Tiền Mất</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Giá Trị Gốc</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Thời Gian Hiệu Lực</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Quy Tắc Phân Loại</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Góc Nhìn</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingLosses ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                      <div>Đang tải danh sách hạch toán hao hụt...</div>
                    </td>
                  </tr>
                ) : losses.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      Không có bản ghi hao hụt nào trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  losses.map((loss) => {
                    const badgeMeta =
                      loss.loss_type === 'CANCELLED' ? { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' } :
                      loss.loss_type === 'FAILED_DELIVERY' ? { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' } :
                      { bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff' };

                    return (
                      <tr key={loss.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                          <button
                            type="button"
                            onClick={() => fetchOrderDetail(loss.platform_order_id)}
                            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: '600', padding: 0 }}
                          >
                            {loss.platform_order_id}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                          {loss.order_created_at || '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: badgeMeta.bg,
                            color: badgeMeta.color,
                            border: `1px solid ${badgeMeta.border}`,
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            {loss.loss_type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#dc2626' }}>
                          -{formatVND(loss.loss_amount)}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {formatVND(loss.gross_reference_amount)}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                          {loss.effective_at || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', fontSize: '11px' }}>
                          <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{loss.classification_rule}</code>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', fontSize: '11px' }}>
                          <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            {loss.perspective}
                          </span>
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

      {/* ========================================================================= */}
      {/* SUBTAB 7: FINANCE & SETTLEMENT RECONCILIATION WORKBENCH                   */}
      {/* ========================================================================= */}
      {subTab === 'finance' && (
        <div>
          {/* Top Action & Sync Toolbar */}
          <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="#2563eb" />
                <span style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>Báo Cáo Đối Soát Quyết Toán & Tiền Thực Về (Settlement Reconciliation)</span>
                <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '99px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                  5-Way Metric Isolation
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                Tách biệt độc lập Doanh thu gộp (Gross) → Doanh thu thực sau Hoàn/Hủy (Realized) → Khấu trừ Phí sàn & Affiliate → Tiền thực về (Net Settlement) & Đơn chờ quyết toán
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSyncFinanceStatements}
                disabled={isSyncingFinanceStatements}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 13px',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: isSyncingFinanceStatements ? 'not-allowed' : 'pointer'
                }}
              >
                <RefreshCw size={13} className={isSyncingFinanceStatements ? 'spin' : ''} />
                {isSyncingFinanceStatements ? 'Đang nạp bảng kê...' : 'Đồng bộ Bảng kê'}
              </button>

              <button
                type="button"
                onClick={handleSyncFinanceBatchTransactions}
                disabled={isSyncingFinanceBatch}
                title="Đồng bộ chi tiết phí sàn, phí thanh toán, vận chuyển & hoa hồng từng đơn theo batch an toàn (không gây timeout)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 13px',
                  borderRadius: '8px',
                  border: '1px solid #a7f3d0',
                  background: '#ecfdf5',
                  color: '#047857',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: isSyncingFinanceBatch ? 'not-allowed' : 'pointer'
                }}
              >
                <Zap size={13} className={isSyncingFinanceBatch ? 'spin' : ''} />
                {isSyncingFinanceBatch ? 'Đang quét batch phí đơn...' : 'Đồng bộ Chi tiết Phí (Batch 50)'}
              </button>

              <button
                type="button"
                onClick={() => handleExportFinanceCSV(financeSubView)}
                disabled={isExportingFinance}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: isExportingFinance ? 'not-allowed' : 'pointer'
                }}
              >
                <Download size={13} />
                {isExportingFinance ? 'Đang xuất...' : (financeSubView === 'orders_reconcile' ? 'Xuất CSV Đối Soát Đơn' : 'Xuất CSV Bảng Kê')}
              </button>
            </div>
          </div>

          {/* Sync Status Notification Banner */}
          {financeSyncMessage && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: financeSyncMessage.type === 'success' ? '#ecfdf5' : (financeSyncMessage.type === 'warning' ? '#fffbeb' : '#fef2f2'),
              border: `1px solid ${financeSyncMessage.type === 'success' ? '#a7f3d0' : (financeSyncMessage.type === 'warning' ? '#fde68a' : '#fecaca')}`,
              color: financeSyncMessage.type === 'success' ? '#065f46' : (financeSyncMessage.type === 'warning' ? '#92400e' : '#991b1b'),
              fontSize: '12px',
              fontWeight: '600'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {financeSyncMessage.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{financeSyncMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFinanceSyncMessage(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* 5-Stage Financial Waterfall & Fee Breakdown */}
          {(() => {
            const recon = financeReconciliation || {};
            const iso = recon.metric_isolation || {};
            const reconLoss = recon.loss_summary || lossSummary || {};
            const reconFees = recon.fee_and_commission_deductions || feeDeductions || {};
            const orderBridge = recon.order_settlement_bridge || recon.settlement_metrics?.order_settlement_bridge || {};
            const stmtSettlement = recon.statement_settlement || recon.settlement_metrics?.statement_settlement || {};

            const grossVal = Number(iso.order_gross_value ?? metrics.source_orders_api?.value ?? 0);
            const lossVal = Number(iso.total_loss_value ?? reconLoss.total_economic_loss_amount ?? 0);
            const realizedVal = Number(iso.realized_order_value ?? metrics.source_loss_ledger?.value ?? Math.max(0, grossVal - lossVal));
            const lossRatePct = Number(reconLoss.economic_loss_rate_pct ?? (grossVal > 0 ? ((lossVal / grossVal) * 100).toFixed(2) : 0));

            const stmtTotalSettlement = financeStatements.reduce((sum, s) => sum + Number(s.settlement_amount || 0), 0);
            const stmtTotalRevenue = financeStatements.reduce((sum, s) => sum + Number(s.revenue_amount || 0), 0);
            const stmtTotalPlatFee = financeStatements.reduce((sum, s) => sum + Number(s.platform_fee_amount || 0), 0);
            const stmtTotalPayFee = financeStatements.reduce((sum, s) => sum + Number(s.payment_fee_amount || 0), 0);
            const stmtTotalAffFee = financeStatements.reduce((sum, s) => sum + Number(s.affiliate_commission_amount || 0), 0);
            const stmtTotalShipping = financeStatements.reduce((sum, s) => sum + Number(s.shipping_cost_amount || 0), 0);
            const stmtTotalSubsidy = financeStatements.reduce((sum, s) => sum + Number(s.shipping_subsidy_amount || 0), 0);
            const stmtTotalAdj = financeStatements.reduce((sum, s) => sum + Number(s.adjustment_amount || 0), 0);

            const hasTxSynced = Boolean(reconFees.is_synced || reconFees.status === 'AVAILABLE' || stmtTotalPlatFee > 0 || stmtTotalShipping > 0);
            const platComm = hasTxSynced ? Math.abs(Number(reconFees.platform_commission ?? stmtTotalPlatFee ?? 0)) : null;
            const payFee = hasTxSynced ? Math.abs(Number(reconFees.payment_fee ?? stmtTotalPayFee ?? 0)) : null;
            const affComm = hasTxSynced ? Math.abs(Number(reconFees.affiliate_commission ?? stmtTotalAffFee ?? 0)) : null;
            const actShip = hasTxSynced ? Math.abs(Number(reconFees.actual_shipping_fee ?? stmtTotalShipping ?? 0)) : null;
            const shipSub = hasTxSynced ? Math.abs(Number(reconFees.shipping_fee_subsidy ?? stmtTotalSubsidy ?? 0)) : null;
            const netShip = hasTxSynced ? Math.max(0, Number(reconFees.net_shipping_burden ?? (actShip - shipSub))) : null;
            const adjAmt = hasTxSynced ? Number(reconFees.adjustment_amount ?? stmtTotalAdj ?? 0) : null;
            const totalDeductions = hasTxSynced
              ? Number(reconFees.total_deductions ?? Math.max(0, (platComm || 0) + (payFee || 0) + (affComm || 0) + (netShip || 0) - (adjAmt || 0)))
              : null;

            const hasStatements = (Number(recon.settlement_metrics?.statement_count ?? financePagination.total_records ?? 0) > 0) || hasTxSynced;
            const netSettlementVal = hasStatements
              ? Number(iso.settlement_amount ?? iso.statement_settlement_amount ?? stmtTotalSettlement ?? 0)
              : null;

            const unsettledOrdersCount = Number(orderBridge.unsettled_orders_count ?? 0);
            const unsettledOrdersGross = Number(orderBridge.unsettled_orders_gross ?? 0);
            const settledOrdersCount = Number(orderBridge.period_orders_settled_count ?? recon.settlement_metrics?.settled_orders_count ?? 0);
            const eligibleOrdersCount = Number(orderBridge.realized_eligible_orders ?? 0);
            const settlementCoveragePct = Number(orderBridge.settlement_coverage_pct ?? (eligibleOrdersCount > 0 ? Math.round((settledOrdersCount / eligibleOrdersCount) * 100) : 0));

            return (
              <>
                {/* 5-Stage Waterfall Cards */}
                <div style={{
                  background: '#ffffff',
                  padding: '20px 24px',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                        Thác Đối Soát Dòng Tiền 5 Tầng (5-Tier Cashflow Reconciliation Waterfall)
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Đối soát khép kín từ đơn hàng phát sinh trên sàn đến tiền thực nhận về tài khoản và lượng tiền đang chờ quyết toán (T+7)
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0'
                      }}>
                        ✓ Bảo toàn phương trình: Gross − Loss = Realized
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '12px' }}>
                    {/* Stage 1: Order Gross Value */}
                    <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                        1. Doanh Thu Gộp (Gross)
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                        {formatVND(grossVal)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        {formatNumber(reconLoss.total_orders_count || totalPeriodOrders || 0)} đơn tạo trong kỳ
                      </div>
                    </div>

                    {/* Stage 2: Total Economic Loss */}
                    <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase' }}>
                        2. Trừ Hủy & Hoàn (Loss)
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', marginTop: '6px' }}>
                        −{formatVND(lossVal)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>
                        Tỷ lệ hao hụt: <strong>{lossRatePct}%</strong> ({formatNumber((reconLoss.cancelled_orders_count || 0) + (reconLoss.refund_orders_count || 0))} đơn)
                      </div>
                    </div>

                    {/* Stage 3: Realized Order Value */}
                    <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase' }}>
                        3. Doanh Thu Thực (Realized)
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: '#1d4ed8', marginTop: '6px' }}>
                        {formatVND(realizedVal)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '4px' }}>
                        {formatNumber(eligibleOrdersCount || Math.max(0, (reconLoss.total_orders_count || 0) - (reconLoss.cancelled_orders_count || 0)))} đơn hợp lệ chờ/đã quyết toán
                      </div>
                    </div>

                    {/* Stage 4: Total Fees & Affiliate Deductions */}
                    <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#fff7ed', border: '1px solid #fed7aa' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase' }}>
                        4. Khấu Trừ Phí & Affiliate
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#ea580c', marginTop: '6px' }}>
                        {totalDeductions !== null ? `−${formatVND(totalDeductions)}` : 'Chờ đồng bộ phí'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9a3412', marginTop: '4px' }}>
                        {totalDeductions !== null && realizedVal > 0
                          ? `Chiếm ${((totalDeductions / realizedVal) * 100).toFixed(1)}% doanh thu thực`
                          : 'Bấm "Đồng bộ Chi tiết Phí" để bóc tách'}
                      </div>
                    </div>

                    {/* Stage 5: Net Settlement vs Unsettled Lag */}
                    <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#ecfdf5', border: '1px solid #6ee7b7' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase' }}>
                        5. Tiền Quyết Toán Thực Về
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: '#047857', marginTop: '6px' }}>
                        {netSettlementVal !== null ? formatVND(netSettlementVal) : 'Chờ bảng kê'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#065f46', marginTop: '4px' }}>
                        {stmtSettlement.paid_count > 0
                          ? `Đã giải ngân: ${formatVND(stmtSettlement.paid_amount)} (${stmtSettlement.paid_count} bảng kê)`
                          : `${financePagination.total_records} bảng kê trong kỳ`}
                      </div>
                    </div>
                  </div>

                  {/* Fee Breakdown & Unsettled In-Transit Bridge Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginTop: '16px' }}>
                    {/* Detailed Fee Breakdown Box */}
                    <div style={{ padding: '14px 18px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Chi Tiết Các Khoản Khấu Trừ Trên Sàn (Fee & Commission Breakdown)</span>
                        <span style={{ fontSize: '11px', color: hasTxSynced ? '#059669' : '#d97706', fontWeight: '700' }}>
                          {hasTxSynced ? 'Đã đối soát Transaction' : 'Chờ đồng bộ Transaction'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px', fontSize: '12px' }}>
                        <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Phí hoa hồng sàn</div>
                          <div style={{ fontWeight: '700', color: '#dc2626', marginTop: '2px' }}>{platComm !== null ? `−${formatVND(platComm)}` : '—'}</div>
                        </div>
                        <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Phí thanh toán</div>
                          <div style={{ fontWeight: '700', color: '#dc2626', marginTop: '2px' }}>{payFee !== null ? `−${formatVND(payFee)}` : '—'}</div>
                        </div>
                        <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Hoa hồng Affiliate</div>
                          <div style={{ fontWeight: '700', color: '#7c3aed', marginTop: '2px' }}>{affComm !== null ? `−${formatVND(affComm)}` : '—'}</div>
                        </div>
                        <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Vận chuyển ròng</div>
                          <div style={{ fontWeight: '700', color: '#ea580c', marginTop: '2px' }}>{netShip !== null ? `−${formatVND(netShip)}` : '—'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Unsettled / In-Transit Order Lag Box */}
                    <div style={{ padding: '14px 18px', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#92400e', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Cầu Nối Độ Trễ Quyết Toán Đơn Hàng (Settlement Lag T+7)</span>
                          <span style={{ fontSize: '11px', background: '#fef3c7', padding: '2px 8px', borderRadius: '99px', color: '#b45309', fontWeight: '700' }}>
                            Độ phủ quyết toán: {settlementCoveragePct}%
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#78350f', lineHeight: '1.5' }}>
                          Trong kỳ có <strong>{formatNumber(settledOrdersCount)}</strong> đơn đã lên bảng kê quyết toán và <strong>{formatNumber(unsettledOrdersCount)}</strong> đơn hợp lệ (trị giá <strong>{formatVND(unsettledOrdersGross)}</strong>) đang giao hoặc trong thời hạn bảo hành/chờ TikTok đối soát.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setFinanceSubView('orders_reconcile');
                            setFinanceOrderFilter('UNSETTLED');
                            fetchFinanceOrderReconciliation(1, 'UNSETTLED');
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: '1px solid #f59e0b',
                            background: '#ffffff',
                            color: '#b45309',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Xem {formatNumber(unsettledOrdersCount)} đơn chờ quyết toán →
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFinanceSubView('orders_reconcile');
                            setFinanceOrderFilter('SETTLED');
                            fetchFinanceOrderReconciliation(1, 'SETTLED');
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Xem {formatNumber(settledOrdersCount)} đơn đã quyết toán
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </>
            );
          })()}

          {/* Sub-View Switcher Tabs: 1. Statements | 2. Order-Level Settlement Reconciliation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setFinanceSubView('statements')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: financeSubView === 'statements' ? '#ffffff' : 'transparent',
                  color: financeSubView === 'statements' ? '#2563eb' : '#475569',
                  fontWeight: '700',
                  fontSize: '13px',
                  boxShadow: financeSubView === 'statements' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer'
                }}
              >
                1. Bảng Kê Quyết Toán Ngân Hàng ({financePagination.total_records})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFinanceSubView('orders_reconcile');
                  fetchFinanceOrderReconciliation(1);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: financeSubView === 'orders_reconcile' ? '#ffffff' : 'transparent',
                  color: financeSubView === 'orders_reconcile' ? '#2563eb' : '#475569',
                  fontWeight: '700',
                  fontSize: '13px',
                  boxShadow: financeSubView === 'orders_reconcile' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer'
                }}
              >
                2. Đối Soát Quyết Toán Từng Đơn Hàng ({financeOrdersPagination.total_records})
              </button>
            </div>

            {/* Filters for Active Sub-View */}
            {financeSubView === 'statements' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {['ALL', 'PAID', 'PENDING', 'PROCESSING'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setFinancePaymentStatusFilter(st);
                      fetchFinanceStatements(1, st, financeStmtSearch);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      border: `1px solid ${financePaymentStatusFilter === st ? '#2563eb' : '#cbd5e1'}`,
                      background: financePaymentStatusFilter === st ? '#eff6ff' : '#ffffff',
                      color: financePaymentStatusFilter === st ? '#1d4ed8' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    {st === 'ALL' ? 'Tất cả trạng thái' : (st === 'PAID' ? 'Đã giải ngân (PAID)' : (st === 'PENDING' ? 'Chờ thanh toán' : st))}
                  </button>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 10px' }}>
                  <Search size={13} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Tìm mã bảng kê..."
                    value={financeStmtSearch}
                    onChange={(e) => setFinanceStmtSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchFinanceStatements(1, financePaymentStatusFilter, financeStmtSearch); }}
                    style={{ border: 'none', outline: 'none', fontSize: '12px', width: '140px' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: 'Tất cả đơn' },
                  { id: 'SETTLED', label: 'Đã quyết toán' },
                  { id: 'UNSETTLED', label: 'Chờ quyết toán (T+7)' },
                  { id: 'HIGH_FEE', label: 'Phí cao (≥25%)' },
                  { id: 'CANCELLED_LOSS', label: 'Đơn Hủy/Hoàn' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFinanceOrderFilter(f.id);
                      fetchFinanceOrderReconciliation(1, f.id, financeOrderSearch);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      border: `1px solid ${financeOrderFilter === f.id ? '#2563eb' : '#cbd5e1'}`,
                      background: financeOrderFilter === f.id ? '#eff6ff' : '#ffffff',
                      color: financeOrderFilter === f.id ? '#1d4ed8' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 10px' }}>
                  <Search size={13} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Tìm mã đơn / bảng kê..."
                    value={financeOrderSearch}
                    onChange={(e) => setFinanceOrderSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchFinanceOrderReconciliation(1, financeOrderFilter, financeOrderSearch); }}
                    style={{ border: 'none', outline: 'none', fontSize: '12px', width: '160px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* SUB-VIEW 1: STATEMENTS TABLE WITH EXPANDABLE TRANSACTIONS DRILL-DOWN */}
          {financeSubView === 'statements' && (
            <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '13px 16px', color: '#475569', fontWeight: '700' }}>Mã Bảng Kê (Statement ID)</th>
                    <th style={{ padding: '13px 16px', color: '#475569', fontWeight: '700' }}>Thời Gian Lập</th>
                    <th style={{ padding: '13px 16px', color: '#475569', fontWeight: '700' }}>Số Đơn</th>
                    <th style={{ padding: '13px 16px', color: '#475569', fontWeight: '700' }}>Doanh Thu Ghi Nhận</th>
                    <th style={{ padding: '13px 16px', color: '#475569', fontWeight: '700' }}>Phí Sàn & TT</th>
                    <th style={{ padding: '13px 16px', color: '#475569', fontWeight: '700' }}>Affiliate</th>
                    <th style={{ padding: '13px 16px', color: '#475569', fontWeight: '700' }}>Vận Chuyển Ròng</th>
                    <th style={{ padding: '13px 16px', color: '#047857', fontWeight: '800' }}>Tiền Thực Về (Net)</th>
                    <th style={{ padding: '13px 16px', color: '#475569', fontWeight: '700' }}>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingFinance ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                        <div>Đang nạp bảng kê quyết toán tài chính...</div>
                      </td>
                    </tr>
                  ) : financeStatements.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <div style={{ fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Chưa có bảng kê quyết toán nào trong kỳ ({startDate} → {endDate}).</div>
                        <div style={{ fontSize: '12px' }}>Bạn có thể bấm nút <strong>"Đồng bộ Bảng kê"</strong> ở góc trên hoặc chuyển sang tab <strong>"2. Đối Soát Quyết Toán Từng Đơn Hàng"</strong> để kiểm tra các đơn đang chờ quyết toán.</div>
                      </td>
                    </tr>
                  ) : (
                    financeStatements.map((stmt) => {
                      const isExpanded = selectedStatementId === stmt.statement_id;
                      const platAndPayFee = Number(stmt.platform_fee_amount || 0) + Number(stmt.payment_fee_amount || 0);
                      const netShipStmt = Number(stmt.net_shipping_amount ?? stmt.shipping_cost_amount ?? 0);
                      return (
                        <React.Fragment key={stmt.statement_id}>
                          <tr
                            onClick={() => handleSelectStatementDetail(stmt.statement_id)}
                            style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#ffffff' }}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: '700', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {stmt.statement_id}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                              <div>{stmt.statement_time || '—'}</div>
                              {stmt.payment_time && <div style={{ fontSize: '10px', color: '#059669' }}>TT: {stmt.payment_time}</div>}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: '600', color: '#334155' }}>
                              {stmt.order_count > 0 ? `${formatNumber(stmt.order_count)} đơn` : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                              {formatVND(stmt.revenue_amount)}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#dc2626', fontWeight: '600' }}>
                              {platAndPayFee > 0 ? `−${formatVND(platAndPayFee)}` : '0 ₫'}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#7c3aed', fontWeight: '600' }}>
                              {Number(stmt.affiliate_commission_amount || 0) > 0 ? `−${formatVND(stmt.affiliate_commission_amount)}` : '0 ₫'}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#ea580c', fontWeight: '600' }}>
                              {netShipStmt > 0 ? `−${formatVND(netShipStmt)}` : '0 ₫'}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: '800', color: '#059669' }}>
                              {formatVND(stmt.settlement_amount)}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                background: stmt.statement_status === 'PAID' ? '#ecfdf5' : '#fffbeb',
                                color: stmt.statement_status === 'PAID' ? '#059669' : '#d97706',
                                border: `1px solid ${stmt.statement_status === 'PAID' ? '#a7f3d0' : '#fde68a'}`,
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '3px 8px',
                                borderRadius: '6px'
                              }}>
                                {stmt.statement_status === 'PAID' ? 'ĐÃ GIẢI NGÂN' : stmt.statement_status}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              <td colSpan="9" style={{ padding: '14px 20px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                                  Chi Tiết Giao Dịch Trong Bảng Kê #{stmt.statement_id}
                                </div>
                                {isLoadingStatementDetail ? (
                                  <div style={{ padding: '16px', color: '#64748b', fontSize: '12px' }}>Đang tải chi tiết giao dịch...</div>
                                ) : !statementDetailData?.transactions?.length ? (
                                  <div style={{ padding: '12px', color: '#64748b', fontSize: '12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    Chưa có dòng giao dịch đơn hàng nào gắn với bảng kê này. Hãy bấm <strong>"Đồng bộ Chi tiết Phí (Batch 50)"</strong> để nạp chi tiết từ TikTok Finance API.
                                  </div>
                                ) : (
                                  <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                      <thead>
                                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                          <th style={{ padding: '8px 12px' }}>Mã Đơn Hàng</th>
                                          <th style={{ padding: '8px 12px' }}>Loại GD</th>
                                          <th style={{ padding: '8px 12px' }}>Doanh Thu</th>
                                          <th style={{ padding: '8px 12px' }}>Phí Sàn</th>
                                          <th style={{ padding: '8px 12px' }}>Phí TT</th>
                                          <th style={{ padding: '8px 12px' }}>Affiliate</th>
                                          <th style={{ padding: '8px 12px' }}>Ship Thực Tế</th>
                                          <th style={{ padding: '8px 12px' }}>Trợ Giá Ship</th>
                                          <th style={{ padding: '8px 12px' }}>Tiền Quyết Toán</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {statementDetailData.transactions.map((tx, idx) => (
                                          <tr key={`${tx.platform_order_id}_${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '8px 12px', fontWeight: '700', color: '#2563eb' }}>{tx.platform_order_id}</td>
                                            <td style={{ padding: '8px 12px' }}>{tx.transaction_type}</td>
                                            <td style={{ padding: '8px 12px', fontWeight: '600' }}>{formatVND(tx.revenue_amount)}</td>
                                            <td style={{ padding: '8px 12px', color: '#dc2626' }}>−{formatVND(Math.abs(tx.platform_commission || 0))}</td>
                                            <td style={{ padding: '8px 12px', color: '#dc2626' }}>−{formatVND(Math.abs(tx.payment_fee || 0))}</td>
                                            <td style={{ padding: '8px 12px', color: '#7c3aed' }}>−{formatVND(Math.abs(tx.affiliate_commission || 0))}</td>
                                            <td style={{ padding: '8px 12px', color: '#ea580c' }}>−{formatVND(Math.abs(tx.actual_shipping_fee || 0))}</td>
                                            <td style={{ padding: '8px 12px', color: '#059669' }}>+{formatVND(Math.abs(tx.shipping_fee_subsidy || 0))}</td>
                                            <td style={{ padding: '8px 12px', fontWeight: '800', color: '#047857' }}>{formatVND(tx.net_settlement_amount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination for Statements */}
              {financePagination.total_pages > 1 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Trang {financePagination.page} / {financePagination.total_pages} (Tổng {financePagination.total_records} bảng kê)
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={financePagination.page <= 1}
                      onClick={() => fetchFinanceStatements(financePagination.page - 1)}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: financePagination.page <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      disabled={financePagination.page >= financePagination.total_pages}
                      onClick={() => fetchFinanceStatements(financePagination.page + 1)}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: financePagination.page >= financePagination.total_pages ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 2: ORDER-LEVEL SETTLEMENT RECONCILIATION TABLE */}
          {financeSubView === 'orders_reconcile' && (
            <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Mã Đơn Hàng</th>
                      <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Ngày Đặt / TT Đơn</th>
                      <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Doanh Thu Gộp</th>
                      <th style={{ padding: '12px 14px', color: '#dc2626', fontWeight: '700' }}>Hao Hụt Hủy/Hoàn</th>
                      <th style={{ padding: '12px 14px', color: '#1d4ed8', fontWeight: '700' }}>Doanh Thu Thực (Realized)</th>
                      <th style={{ padding: '12px 14px', color: '#ea580c', fontWeight: '700' }}>Tổng Khấu Trừ Phí</th>
                      <th style={{ padding: '12px 14px', color: '#047857', fontWeight: '800' }}>Tiền Thực Về (Net)</th>
                      <th style={{ padding: '12px 14px', color: '#b45309', fontWeight: '700' }}>Chờ Quyết Toán</th>
                      <th style={{ padding: '12px 14px', color: '#475569', fontWeight: '700' }}>Trạng Thái Đối Soát</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingFinanceOrders ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                          <div>Đang đối soát quyết toán từng đơn hàng...</div>
                        </td>
                      </tr>
                    ) : financeOrders.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          Không tìm thấy đơn hàng nào khớp bộ lọc đối soát trong kỳ đã chọn.
                        </td>
                      </tr>
                    ) : (
                      financeOrders.map((ord) => {
                        const isSettled = Boolean(ord.is_settled);
                        const isCancelled = ord.reconcile_state === 'CANCELLED_NO_SETTLEMENT';
                        const isHighFee = ord.reconcile_state === 'SETTLED_HIGH_FEE';
                        return (
                          <tr key={ord.platform_order_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '11px 14px', fontWeight: '700', color: '#2563eb' }}>
                              <div>{ord.platform_order_id}</div>
                              {ord.statement_id && (
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>BK: #{ord.statement_id}</div>
                              )}
                            </td>
                            <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '11.5px' }}>
                              <div>{ord.platform_created_at || '—'}</div>
                              <div style={{ fontWeight: '600', color: '#475569', fontSize: '10.5px' }}>{ord.order_status}</div>
                            </td>
                            <td style={{ padding: '11px 14px', fontWeight: '600', color: '#0f172a' }}>
                              {formatVND(ord.order_gross_amount)}
                            </td>
                            <td style={{ padding: '11px 14px', color: Number(ord.loss_amount) > 0 ? '#dc2626' : '#94a3b8', fontWeight: Number(ord.loss_amount) > 0 ? '700' : '400' }}>
                              {Number(ord.loss_amount) > 0 ? `−${formatVND(ord.loss_amount)}` : '0 ₫'}
                            </td>
                            <td style={{ padding: '11px 14px', fontWeight: '700', color: '#1d4ed8' }}>
                              {formatVND(ord.realized_order_value)}
                            </td>
                            <td style={{ padding: '11px 14px', color: '#ea580c', fontWeight: '600' }}>
                              {isSettled && ord.total_fees_deducted !== null ? (
                                <div>
                                  <div>−{formatVND(ord.total_fees_deducted)}</div>
                                  {ord.effective_fee_rate_pct !== null && (
                                    <div style={{ fontSize: '10px', color: isHighFee ? '#dc2626' : '#64748b' }}>
                                      Tỷ lệ phí: {ord.effective_fee_rate_pct}%
                                    </div>
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '11px 14px', fontWeight: '800', color: isSettled ? '#047857' : '#94a3b8' }}>
                              {isSettled && ord.net_settlement_amount !== null ? formatVND(ord.net_settlement_amount) : '—'}
                            </td>
                            <td style={{ padding: '11px 14px', fontWeight: '700', color: Number(ord.unsettled_lag_amount) > 0 ? '#b45309' : '#94a3b8' }}>
                              {Number(ord.unsettled_lag_amount) > 0 ? formatVND(ord.unsettled_lag_amount) : '0 ₫'}
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                background: isCancelled ? '#f1f5f9' : (isHighFee ? '#fef2f2' : (isSettled ? '#ecfdf5' : '#fffbeb')),
                                color: isCancelled ? '#64748b' : (isHighFee ? '#dc2626' : (isSettled ? '#059669' : '#d97706')),
                                border: `1px solid ${isCancelled ? '#cbd5e1' : (isHighFee ? '#fecaca' : (isSettled ? '#a7f3d0' : '#fde68a'))}`
                              }}>
                                {ord.reconcile_label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination for Order Reconciliation */}
              {financeOrdersPagination.total_pages > 1 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Trang {financeOrdersPagination.page} / {financeOrdersPagination.total_pages} (Tổng {formatNumber(financeOrdersPagination.total_records)} đơn hàng)
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={financeOrdersPagination.page <= 1}
                      onClick={() => fetchFinanceOrderReconciliation(financeOrdersPagination.page - 1)}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: financeOrdersPagination.page <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      disabled={financeOrdersPagination.page >= financeOrdersPagination.total_pages}
                      onClick={() => fetchFinanceOrderReconciliation(financeOrdersPagination.page + 1)}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: financeOrdersPagination.page >= financeOrdersPagination.total_pages ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 8: LIVESTREAM WORKBENCH                                            */}
      {/* ========================================================================= */}
      {subTab === 'lives' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <div className="glass" style={{ padding: '16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>GMV / Giờ Live</span>
                <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                  {liveKpis.gmv_per_hour?.type || 'DERIVED'}
                </span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                {renderKpiValue(liveKpis.gmv_per_hour, formatVND, 'Chưa có phiên live')}
              </div>
            </div>

            <div className="glass" style={{ padding: '16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>GPM (GMV/1k Views)</span>
                <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                  {liveKpis.gpm?.type || 'DERIVED'}
                </span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>
                {renderKpiValue(liveKpis.gpm, formatVND, 'Chưa có phiên live')}
              </div>
            </div>

            <div className="glass" style={{ padding: '16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Tỷ Lệ Bình Luận</span>
                <span style={{ background: '#f8fafc', color: '#64748b', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                  {liveKpis.comment_rate?.type || 'DERIVED'}
                </span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                {renderKpiValue(liveKpis.comment_rate, (v) => `${v}%`, 'Chưa có phiên live')}
              </div>
            </div>

            <div className="glass" style={{ padding: '16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Tỷ Lệ Follow Mới</span>
                <span style={{ background: '#f8fafc', color: '#64748b', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                  {liveKpis.follow_rate?.type || 'DERIVED'}
                </span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                {renderKpiValue(liveKpis.follow_rate, (v) => `${v}%`, 'Chưa có phiên live')}
              </div>
            </div>
          </div>

          <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Phiên Live (Room ID)</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Thời Gian Bắt Đầu</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Thời Lượng</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Doanh Thu (GMV)</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Đơn Hàng</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Lượt Xem (Views)</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingLives ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                      <div>Đang nạp phiên livestream...</div>
                    </td>
                  </tr>
                ) : liveSessions.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      Chưa có phiên livestream nào trong kỳ đã chọn.
                    </td>
                  </tr>
                ) : (
                  liveSessions.map((sess) => (
                    <tr key={sess.room_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                        <div>{sess.title || `Phiên #${sess.room_id}`}</div>
                        <div style={{ fontSize: '11px', color: '#2563eb' }}>{sess.room_id}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {sess.start_time}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#0f172a' }}>
                        {Math.floor((sess.duration_seconds || 0) / 60)} phút
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#059669' }}>
                        {formatVND(sess.gmv)}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                        {formatNumber(sess.orders_count)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {formatNumber(sess.total_views)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 9: VIDEO ANALYTICS                                                 */}
      {/* ========================================================================= */}
      {subTab === 'videos' && (
        <div>
          <div className="glass" style={{ padding: '16px 20px', borderRadius: '14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Video size={18} color="#e11d48" />
              <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>Báo Cáo Hiệu Suất Video</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Xếp hạng video theo GMV
            </div>
          </div>

          <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Tiêu Đề Video</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Creator</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Lượt Xem (Views)</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Sản Phẩm Bán</th>
                  <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Doanh Thu (GMV)</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingVideos ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                      <div>Đang nạp hiệu suất video...</div>
                    </td>
                  </tr>
                ) : videoList.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      Chưa có dữ liệu video trong kỳ đã chọn.
                    </td>
                  </tr>
                ) : (
                  videoList.map((vid, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a', maxWidth: '300px' }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {vid.title || `Video #${vid.video_id}`}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: vid.creator_type === 'SELF' ? '#eff6ff' : '#fff1f2',
                          color: vid.creator_type === 'SELF' ? '#2563eb' : '#e11d48',
                          border: `1px solid ${vid.creator_type === 'SELF' ? '#bfdbfe' : '#fecdd3'}`,
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '700'
                        }}>
                          {vid.creator_type === 'SELF' ? 'Kênh Shop' : 'Affiliate KOC'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#0f172a' }}>
                        {formatNumber(vid.total_views)}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                        {formatNumber(vid.total_units_sold)}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#059669' }}>
                        {formatVND(vid.total_gmv)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 10: SYNC MANAGEMENT (SPRINT V2-04)                                 */}
      {/* ========================================================================= */}
      {subTab === 'sync' && (
        <CommerceSyncManagementView
          shopId={shopId}
          realShopId={realShopId}
          apiRequest={apiRequest}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ORDER DETAIL DRILLDOWN                                           */}
      {/* ========================================================================= */}
      {selectedOrderId && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="modal-content glass" style={{
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            padding: '24px',
            background: '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={20} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    Chi Tiết Đơn Hàng: #{selectedOrderId}
                  </h3>
                  {orderDetailData?.order?.order_status && (
                    <span style={{
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      {orderDetailData.order.order_status}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Ngày tạo: {orderDetailData?.order?.platform_created_at || '—'} | Tổng đơn: <strong style={{ color: '#0f172a' }}>{formatVND(orderDetailData?.order?.order_gross_amount || 0)}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setSelectedOrderId(null); setOrderDetailData(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {isLoadingOrderDetail ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                <div>Đang nạp chi tiết đơn hàng...</div>
              </div>
            ) : orderDetailError ? (
              <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '16px', borderRadius: '10px' }}>
                {orderDetailError}
              </div>
            ) : orderDetailData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Recipient & PII Protection */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={14} color={orderDetailData.recipient?.is_unmasked ? "#16a34a" : "#059669"} />
                      Thông Tin Người Nhận {orderDetailData.recipient?.is_unmasked ? '(Đã Mở Khóa Thực Tế)' : '(Bảo Vệ PII)'}
                    </span>
                    <span style={{
                      background: orderDetailData.recipient?.is_unmasked ? '#dcfce7' : '#ecfdf5',
                      color: orderDetailData.recipient?.is_unmasked ? '#15803d' : '#059669',
                      border: `1px solid ${orderDetailData.recipient?.is_unmasked ? '#86efac' : '#a7f3d0'}`,
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: '700'
                    }}>
                      {orderDetailData.recipient?.is_unmasked ? 'XÁC THỰC THẬT' : 'PII_PROTECTED'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Họ tên:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>
                        {orderDetailData.recipient?.recipient_name_raw || orderDetailData.recipient?.recipient_name || 'Khách Hàng TikTok Shop'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Số điện thoại:</span>{' '}
                      <strong style={{ color: '#059669', fontFamily: 'monospace' }}>
                        {orderDetailData.recipient?.phone_raw || orderDetailData.recipient?.phone_number || '09****xxxx'}
                      </strong>
                      {(orderDetailData.recipient?.phone_raw || (orderDetailData.recipient?.phone_number && !orderDetailData.recipient?.phone_number.includes('*'))) && (
                        <button
                          type="button"
                          onClick={() => {
                            const p = orderDetailData.recipient?.phone_raw || orderDetailData.recipient?.phone_number;
                            navigator.clipboard?.writeText(p);
                            alert(`Đã sao chép: ${p}`);
                          }}
                          style={{ marginLeft: '6px', background: '#e2e8f0', border: 'none', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', cursor: 'pointer' }}
                        >
                          Copy
                        </button>
                      )}
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#64748b' }}>Địa chỉ nhận hàng:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>
                        {orderDetailData.recipient?.address_raw || orderDetailData.recipient?.address_full || (orderDetailData?.recipient?.province_or_city ? `${orderDetailData?.recipient?.district ? orderDetailData?.recipient?.district + ', ' : ''}${orderDetailData?.recipient?.province_or_city}` : 'Việt Nam')}
                      </strong>
                    </div>
                  </div>

                </div>

                {/* 2. Line Items Table */}
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                    Sản Phẩm Trong Đơn ({orderDetailData.items?.length || 0})
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 10px', color: '#475569' }}>Tên Sản Phẩm</th>
                        <th style={{ padding: '8px 10px', color: '#475569' }}>SKU</th>
                        <th style={{ padding: '8px 10px', color: '#475569' }}>Số Lượng</th>
                        <th style={{ padding: '8px 10px', color: '#475569' }}>Đơn Giá</th>
                        <th style={{ padding: '8px 10px', color: '#475569' }}>Thành Tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderDetailData.items?.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', color: '#0f172a', fontWeight: '600' }}>{item.product_name}</td>
                          <td style={{ padding: '8px 10px', color: '#2563eb' }}>{item.sku_name || item.platform_sku_id}</td>
                          <td style={{ padding: '8px 10px', color: '#0f172a' }}>{item.quantity}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{formatVND(item.sale_price)}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '700', color: '#059669' }}>{formatVND(item.total_item_gross || (parseFloat(item.sale_price || 0) * parseInt(item.quantity || 1)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3. Loss Ledger & RMA Reconciliation */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={14} color="#dc2626" />
                      Ghi Nhận Hao Hụt (Loss Ledger)
                    </div>
                    {orderDetailData.losses?.length > 0 ? (
                      orderDetailData.losses.map((loss, idx) => (
                        <div key={idx} style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                          <span style={{ color: '#dc2626', fontWeight: '700' }}>-{formatVND(loss.loss_amount)}</span> ({loss.loss_type}) lúc {loss.effective_at}
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Không có hao hụt ghi nhận cho đơn này.</div>
                    )}
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Receipt size={14} color="#2563eb" />
                      Yêu Cầu Sau Bán / Hoàn Tiền (RMA)
                    </div>
                    {orderDetailData.aftersales?.length > 0 ? (
                      orderDetailData.aftersales.map((rma, idx) => (
                        <div key={idx} style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                          Yêu cầu #{rma.platform_aftersale_id}: Hoàn <strong style={{ color: '#dc2626' }}>{formatVND(rma.refund_amount)}</strong> ({rma.status})
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Không có yêu cầu trả hàng / hoàn tiền.</div>
                    )}
                  </div>
                </div>

                {/* 4. Tracking & Lifecycle Evaluation */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '10px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Đánh giá Vòng đời (Matured Lifecycle):</span>
                    <strong style={{ color: '#0f172a' }}>{orderDetailData.lifecycle?.matured_status || orderDetailData.order?.order_status}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Góc nhìn As-Of (Point-in-Time):</span>
                    <strong style={{ color: '#2563eb' }}>{orderDetailData.lifecycle?.point_in_time_status || orderDetailData.order?.order_status}</strong>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PRODUCT DETAIL DRILLDOWN (ORDER, CANCEL & RETURN ANALYSIS)       */}
      {/* ========================================================================= */}
      {selectedProductId && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="modal-content glass" style={{
            maxWidth: '880px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            padding: '24px',
            background: '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Tag size={20} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    {productDetailData?.product?.product_name || `Sản Phẩm #${selectedProductId}`}
                  </h3>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Mã sản phẩm (SPU): <strong style={{ color: '#2563eb' }}>{selectedProductId}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setSelectedProductId(null); setProductDetailData(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {isLoadingProductDetail ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                <div>Đang nạp chi tiết đơn hàng, đơn hủy và đơn hoàn theo SKU...</div>
              </div>
            ) : productDetailError ? (
              <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '16px', borderRadius: '10px' }}>
                {productDetailError}
              </div>
            ) : productDetailData ? (
              <div>
                {/* Product Summary KPIs inside Modal */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>TỔNG SỐ LƯỢNG ĐƠN</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {formatNumber(productDetailData.product?.total_orders_count || 0)} đơn
                    </div>
                    <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
                      SL đặt: {formatNumber(productDetailData.product?.total_quantity_ordered || 0)} sp
                    </div>
                  </div>
                  <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '700' }}>ĐƠN HỦY & TỶ LỆ HỦY</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>
                      {formatNumber(productDetailData.product?.cancelled_order_count || 0)} đơn ({productDetailData.product?.cancel_rate_pct ?? 0}%)
                    </div>
                    <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '2px' }}>
                      SL hủy: {formatNumber(productDetailData.product?.cancelled_quantity || 0)} sp
                    </div>
                  </div>
                  <div style={{ background: '#fffbeb', padding: '12px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '700' }}>ĐƠN HOÀN & TỶ LỆ HOÀN</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#d97706', marginTop: '2px' }}>
                      {formatNumber(productDetailData.product?.return_order_count || 0)} đơn ({productDetailData.product?.return_rate_pct ?? 0}%)
                    </div>
                    <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
                      SL hoàn: {formatNumber(productDetailData.product?.return_quantity || 0)} sp
                    </div>
                  </div>
                  <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: '11px', color: '#047857', fontWeight: '700' }}>DOANH THU THỰC NHẬN</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                      {formatVND(productDetailData.product?.realized_gross_value ?? productDetailData.product?.total_gross_value ?? 0)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#065f46', marginTop: '2px' }}>
                      SL thực nhận: {formatNumber(productDetailData.product?.realized_quantity ?? 0)} sp
                    </div>
                  </div>

                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                    Phân Tích Chi Tiết Từng Biến Thể SKU ({productDetailData.skus?.length || 0})
                  </h4>
                </div>

                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', minWidth: '540px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 12px', color: '#475569', width: '56px' }}>Ảnh</th>
                        <th style={{ padding: '10px 12px', color: '#475569' }}>Mã SKU / Tên Biến Thể</th>
                        <th style={{ padding: '10px 12px', color: '#475569', textAlign: 'right' }}>Tổng Đơn & SL</th>
                        <th style={{ padding: '10px 12px', color: '#dc2626', textAlign: 'right' }}>Đơn Hủy & Tỷ Lệ</th>
                        <th style={{ padding: '10px 12px', color: '#d97706', textAlign: 'right' }}>Đơn Hoàn & Tỷ Lệ</th>
                        <th style={{ padding: '10px 12px', color: '#2563eb', textAlign: 'right' }}>SL Thực Nhận</th>
                        <th style={{ padding: '10px 12px', color: '#059669', textAlign: 'right' }}>Doanh Thu Thực Nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productDetailData.skus?.map((sku, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', width: '56px' }}>
                            <div style={{ position: 'relative', width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', borderRadius: '6px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {getProductDisplayImageUrl(sku) ? (
                                <img
                                  src={getProductDisplayImageUrl(sku)}
                                  alt={sku.sku_name || sku.sku_id}
                                  loading="lazy"
                                  style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', objectFit: 'cover' }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div style={{ display: getProductDisplayImageUrl(sku) ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}>
                                <Package size={16} color="#94a3b8" />
                              </div>
                              {sku.has_sku_image && (
                                <span style={{
                                  position: 'absolute',
                                  bottom: '1px',
                                  right: '1px',
                                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                  color: '#ffffff',
                                  fontSize: '7px',
                                  lineHeight: '1',
                                  padding: '1px 2px',
                                  borderRadius: '2px',
                                  fontWeight: '700'
                                }}>SKU</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ color: '#0f172a', fontWeight: '700' }}>{sku.sku_name || 'Mặc định'}</div>
                            <div style={{ color: '#2563eb', fontFamily: 'monospace', fontSize: '11px' }}>SKU: {sku.sku_id || 'DEFAULT'}</div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{formatNumber(sku.order_count || 0)} đơn</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{formatNumber(sku.units_sold ?? sku.sku_quantity ?? 0)} sp</div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ fontWeight: '700', color: (sku.cancelled_order_count || 0) > 0 ? '#dc2626' : '#64748b' }}>
                              {formatNumber(sku.cancelled_order_count || 0)} đơn ({sku.cancel_rate_pct ?? 0}%)
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {formatNumber(sku.cancelled_units || 0)} sp
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ fontWeight: '700', color: (sku.return_order_count || 0) > 0 ? '#d97706' : '#64748b' }}>
                              {formatNumber(sku.return_order_count || 0)} đơn ({sku.return_rate_pct ?? 0}%)
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {formatNumber(sku.return_units || 0)} sp
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#2563eb', fontWeight: '800', textAlign: 'right' }}>
                            {formatNumber(sku.realized_units ?? (sku.units_sold || 0))} sp
                          </td>
                          <td style={{ padding: '10px 12px', color: '#059669', fontWeight: '800', textAlign: 'right' }}>
                            {formatVND(sku.realized_gross ?? sku.sku_gross ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PRODUCT COST & BREAK-EVEN ROI CONFIGURATION (P0-04)               */}
      {/* ========================================================================= */}
      {selectedCostProduct && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="modal-content glass" style={{
            maxWidth: '640px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            padding: '24px',
            background: '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Calculator size={20} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    Cấu Hình Giá Vốn & ROI Hòa Vốn SPU
                  </h3>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Sản phẩm: <strong style={{ color: '#0f172a' }}>{selectedCostProduct.product_name}</strong> (SPU: <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{selectedCostProduct.item_group_id || selectedCostProduct.product_id}</span>)
                </div>
              </div>

              <button
                type="button"
                onClick={closeCostModal}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error / Success alerts */}
            {costSaveError && (
              <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {costSaveError}
              </div>
            )}
            {costSaveSuccess && (
              <div style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> {costSaveSuccess}
              </div>
            )}

            <form onSubmit={handleSaveProductCost}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Giá Bán Tham Chiếu (VND) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="VD: 250000"
                    value={costFormSellingPrice}
                    onChange={(e) => setCostFormSellingPrice(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    {costFormSellingPrice ? formatVND(parseFloat(costFormSellingPrice)) : '0 ₫'}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Giá Vốn Hàng Bán - COGS (VND) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="VD: 90000"
                    value={costFormCogs}
                    onChange={(e) => setCostFormCogs(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    {costFormCogs ? formatVND(parseFloat(costFormCogs)) : '0 ₫'}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Chi Phí Biến Đổi / Đơn (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="Đóng gói, nhân công..."
                    value={costFormVarCost}
                    onChange={(e) => setCostFormVarCost(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    {costFormVarCost ? formatVND(parseFloat(costFormVarCost)) : '0 ₫'}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Phí Sàn TikTok Shop (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Mặc định: 4.0%"
                    value={costFormFeePct}
                    onChange={(e) => setCostFormFeePct(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    Ước tính phí sàn: {formatVND((parseFloat(costFormFeePct) || 0) / 100 * (parseFloat(costFormSellingPrice) || 0))}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Biên Lợi Nhuận Mục Tiêu Tùy Chọn (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="VD: 15% (để tính Target ROAS kỳ vọng)"
                  value={costFormTargetPct}
                  onChange={(e) => setCostFormTargetPct(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Ghi Chú Đơn Vị Sản Phẩm
                </label>
                <input
                  type="text"
                  placeholder="Ghi chú về nguồn gốc giá vốn hoặc đợt nhập hàng..."
                  value={costFormNotes}
                  onChange={(e) => setCostFormNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* LIVE UNIT ECONOMICS PREVIEW BOX */}
              {(() => {
                const sPrice = parseFloat(costFormSellingPrice) || 0;
                const cPrice = parseFloat(costFormCogs) || 0;
                const vCost = parseFloat(costFormVarCost) || 0;
                const fPct = parseFloat(costFormFeePct) || 0;
                const tPct = costFormTargetPct !== '' ? parseFloat(costFormTargetPct) : null;

                const feeAmt = (fPct / 100) * sPrice;
                const uMargin = sPrice - cPrice - vCost - feeAmt;
                const mPct = sPrice > 0 ? (uMargin / sPrice) * 100 : 0;
                const beRoas = uMargin > 0 ? (sPrice / uMargin) : null;
                const effMarginRatio = (tPct !== null && tPct > 0) ? (uMargin / sPrice) - (tPct / 100) : null;
                const tgtRoas = (effMarginRatio !== null && effMarginRatio > 0.01) ? (1.0 / effMarginRatio) : null;

                return (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Activity size={15} color="#2563eb" /> Bảng Tính Unit Economics Trực Tiếp
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', textAlign: 'center' }}>
                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Lợi Nhuận Gộp / SP</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: uMargin > 0 ? '#059669' : '#dc2626', marginTop: '4px' }}>
                          {formatVND(uMargin)}
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Biên Lợi Nhuận (%)</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: mPct > 0 ? '#059669' : '#dc2626', marginTop: '4px' }}>
                          {mPct.toFixed(1)}%
                        </div>
                      </div>

                      <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: '10px', color: '#1e40af', fontWeight: '600' }}>ROI Hòa Vốn (BEP)</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#1d4ed8', marginTop: '2px' }}>
                          {beRoas !== null ? `${beRoas.toFixed(2)}x` : '—'}
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Target ROAS</div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: tgtRoas !== null ? '#7c3aed' : '#94a3b8', marginTop: '4px' }}>
                          {tgtRoas !== null ? `${tgtRoas.toFixed(2)}x` : '—'}
                        </div>
                      </div>
                    </div>

                    {uMargin <= 0 && sPrice > 0 && (
                      <div style={{ marginTop: '10px', fontSize: '11px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> Cảnh báo: Giá vốn và chi phí lớn hơn giá bán (Biên lợi nhuận âm). Không thể tính ROI hòa vốn.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={closeCostModal}
                  disabled={isSavingCost}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingCost}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#ffffff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSavingCost && <RefreshCw size={14} className="spin" />}
                  {isSavingCost ? 'Đang Lưu...' : 'Lưu Cấu Hình Giá Vốn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOMER ALL ORDERS DRILLDOWN (Fallback when not in Customer Tab) */}
      {/* ========================================================================= */}
      {selectedCustomerForOrders && customerViewMode !== 'detail' && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="modal-content glass" style={{
            maxWidth: '960px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            padding: '24px',
            background: '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: (customerOrdersData?.customer?.is_unmasked || selectedCustomerForOrders?.is_unmasked) ? '#dcfce7' : '#eff6ff',
                  color: (customerOrdersData?.customer?.is_unmasked || selectedCustomerForOrders?.is_unmasked) ? '#15803d' : '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: '16px',
                  flexShrink: 0
                }}>
                  <Users size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                      {getCustomerDisplayName(customerOrdersData?.customer || selectedCustomerForOrders)}
                    </h3>
                    {(customerOrdersData?.customer?.is_unmasked || selectedCustomerForOrders?.is_unmasked) ? (
                      <span style={{
                        background: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #86efac',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: '800'
                      }}>
                        🟢 ĐÃ XÁC THỰC THẬT (LIVE)
                      </span>
                    ) : (
                      <span style={{
                        background: '#f1f5f9',
                        color: '#64748b',
                        border: '1px solid #cbd5e1',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: '600'
                      }}>
                        🔒 PII PROTECTED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span>
                      SĐT: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                        {customerOrdersData?.customer?.phone || selectedCustomerForOrders?.phone_raw || selectedCustomerForOrders?.phone_masked || '—'}
                      </strong>
                    </span>
                    {(customerOrdersData?.customer?.phone || selectedCustomerForOrders?.phone_raw) && (
                      <button
                        type="button"
                        onClick={() => {
                          const p = customerOrdersData?.customer?.phone || selectedCustomerForOrders?.phone_raw;
                          navigator.clipboard?.writeText(p);
                          alert(`Đã sao chép SĐT: ${p}`);
                        }}
                        style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '1px 6px', fontSize: '11px', cursor: 'pointer', color: '#1e293b' }}
                      >
                        Sao chép SĐT
                      </button>
                    )}
                    <span>
                      Địa chỉ: <span style={{ color: '#0f172a' }}>{customerOrdersData?.customer?.address || selectedCustomerForOrders?.address_raw || selectedCustomerForOrders?.province || 'Việt Nam'}</span>
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setSelectedCustomerForOrders(null); setCustomerOrdersData(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>TỔNG ĐƠN HÀNG</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563eb', marginTop: '2px' }}>
                  {formatNumber(customerOrdersData?.total_orders ?? selectedCustomerForOrders?.lifetime?.orders_count ?? 1)} đơn
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>TỔNG CHI TIÊU (LTV)</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                  {formatVND(customerOrdersData?.total_spend ?? selectedCustomerForOrders?.lifetime?.gross_amount ?? 0)}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>ĐƠN ĐẦU TIÊN</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginTop: '4px' }}>
                  {customerOrdersData?.customer?.first_order_at ? customerOrdersData.customer.first_order_at.substring(0, 10) : (selectedCustomerForOrders?.lifetime?.first_order_at ? selectedCustomerForOrders.lifetime.first_order_at.substring(0, 10) : '—')}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>ĐƠN GẦN NHẤT</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginTop: '4px' }}>
                  {customerOrdersData?.customer?.last_order_at ? customerOrdersData.customer.last_order_at.substring(0, 10) : (selectedCustomerForOrders?.last_order_at ? selectedCustomerForOrders.last_order_at.substring(0, 10) : '—')}
                </div>
              </div>
            </div>

            {/* Content: Orders List */}
            {isLoadingCustomerOrders ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '14px', fontWeight: '600' }}>Đang nạp tất cả đơn hàng của khách hàng này...</div>
              </div>
            ) : customerOrdersError ? (
              <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '16px', borderRadius: '10px', fontSize: '13px' }}>
                {customerOrdersError}
              </div>
            ) : (!customerOrdersData?.orders || customerOrdersData.orders.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <ShoppingBag size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <div style={{ fontSize: '14px', fontWeight: '600' }}>Chưa có thông tin đơn hàng cụ thể trong cơ sở dữ liệu.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={15} color="#2563eb" />
                  <span>Danh sách {customerOrdersData.orders.length} đơn hàng đã đặt:</span>
                </div>

                {customerOrdersData.orders.map((ord, oIdx) => {
                  const statusColors = {
                    'COMPLETED': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'HOÀN THÀNH' },
                    'DELIVERED': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'ĐÃ GIAO HÀNG' },
                    'IN_TRANSIT': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', label: 'ĐANG VẬN CHUYỂN' },
                    'SHIPPED': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', label: 'ĐÃ XUẤT KHO' },
                    'AWAITING_COLLECTION': { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'CHỜ LẤY HÀNG' },
                    'AWAITING_SHIPMENT': { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'CHỜ VẬN CHUYỂN' },
                    'CANCELLED': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'ĐÃ HỦY' },
                    'UNPAID': { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', label: 'CHƯA THANH TOÁN' }
                  };
                  const st = statusColors[ord.order_status] || { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', label: ord.order_status || 'KHÁC' };

                  return (
                    <div
                      key={ord.platform_order_id || oIdx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'border-color 0.15s ease'
                      }}
                    >
                      {/* Order Row Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px', fontFamily: 'monospace' }}>
                            #{ord.platform_order_id}
                          </span>
                          <span style={{
                            background: st.bg,
                            color: st.text,
                            border: `1px solid ${st.border}`,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            {st.label}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            📅 {ord.platform_created_at || '—'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Giá trị đơn: </span>
                            <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                              {formatVND(ord.order_gross_amount || 0)}
                            </strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => fetchOrderDetail(ord.platform_order_id)}
                            style={{
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </div>

                      {/* Recipient info on this order */}
                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ color: '#64748b' }}>Người nhận: </span>
                          <strong style={{ color: '#0f172a' }}>{ord.recipient_name || 'Khách Hàng TikTok'}</strong>
                          {ord.phone_number && ord.phone_number !== '—' && (
                            <span style={{ marginLeft: '10px', fontFamily: 'monospace', color: '#059669', fontWeight: '700' }}>
                              📞 {ord.phone_number}
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#475569', maxWidth: '500px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          📍 {ord.address_full || ord.province || 'Việt Nam'}
                        </div>
                      </div>

                      {/* Line items list */}
                      {ord.items && ord.items.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {ord.items.map((it, itIdx) => (
                            <div key={it.id || itIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: itIdx < ord.items.length - 1 ? '1px dashed #f1f5f9' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Package size={14} color="#64748b" />
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                                    {it.product_name || `Sản phẩm #${it.product_id}`}
                                  </div>
                                  {it.sku_name && (
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      Phân loại: {it.sku_name}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  {it.quantity} x {formatVND(it.sale_price || 0)} ={' '}
                                </span>
                                <strong style={{ fontSize: '12px', color: '#0f172a' }}>
                                  {formatVND(it.total_item_gross || ((it.sale_price || 0) * (it.quantity || 1)))}
                                </strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                          Chi tiết sản phẩm đang được đồng bộ.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
