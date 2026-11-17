document.addEventListener('DOMContentLoaded', async () => {
  const tabStatus = document.getElementById('tabStatus');
  const authStatus = document.getElementById('authStatus');
  const shopNameDisplay = document.getElementById('shopNameDisplay');
  const btnSync = document.getElementById('btnSync');
  const progressBox = document.getElementById('progressBox');
  const logMsg = document.getElementById('logMsg');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  const step4 = document.getElementById('step4');

  const togglePairing = document.getElementById('togglePairing');
  const pairingBox = document.getElementById('pairingBox');
  const pairingCodeInput = document.getElementById('pairingCodeInput');
  const btnPairConfirm = document.getElementById('btnPairConfirm');
  const btnDisconnect = document.getElementById('btnDisconnect');

  const BASE_API_URL = 'https://marketing.addp.vn/api';
  const SYNC_ENDPOINT = `${BASE_API_URL}/shop_diagnosis.php?action=sync_seller_center`;
  const REDEEM_ENDPOINT = `${BASE_API_URL}/connector_token.php?action=redeem_pairing`;
  const REVOKE_ENDPOINT = `${BASE_API_URL}/connector_token.php?action=revoke`;

  // 1. Kiểm tra trạng thái xác thực từ chrome.storage.local
  async function refreshAuthStatus() {
    try {
      const stored = await chrome.storage.local.get(['connector_token', 'token_expires_at', 'shop_id', 'shop_name']);
      const now = Math.floor(Date.now() / 1000);

      if (stored.connector_token && stored.token_expires_at) {
        if (now >= stored.token_expires_at) {
          authStatus.textContent = 'Hết hạn (24h)';
          authStatus.className = 'status-badge status-warn';
          btnDisconnect.style.display = 'none';
          await chrome.storage.local.remove(['connector_token', 'token_expires_at']);
        } else {
          const remHours = Math.max(1, Math.round((stored.token_expires_at - now) / 3600));
          authStatus.textContent = `Đã kết nối (~${remHours}h)`;
          authStatus.className = 'status-badge status-ready';
          btnDisconnect.style.display = 'inline-block';
          if (stored.shop_name) {
            shopNameDisplay.textContent = stored.shop_name;
          }
        }
      } else {
        authStatus.textContent = 'Chưa kết nối';
        authStatus.className = 'status-badge status-danger';
        btnDisconnect.style.display = 'none';
      }
    } catch (e) {
      authStatus.textContent = 'Chưa kết nối';
      authStatus.className = 'status-badge status-danger';
      btnDisconnect.style.display = 'none';
    }
  }

  await refreshAuthStatus();

  // 2. Kiểm tra tab Seller Center hiện tại
  let currentTab = null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
  } catch (e) {}

  const isSellerCenter = currentTab && currentTab.url && (
    currentTab.url.includes('seller-vn.tiktok.com') || 
    currentTab.url.includes('seller.tiktok.com')
  );

  if (isSellerCenter) {
    tabStatus.textContent = 'Đã kết nối Seller Center';
    tabStatus.className = 'status-badge status-ready';
  } else {
    tabStatus.textContent = 'Chưa ở Seller Center';
    tabStatus.className = 'status-badge status-warn';
  }

  // 3. Toggle giao diện nhập mã ghép nối thủ công
  if (togglePairing) {
    togglePairing.addEventListener('click', () => {
      pairingBox.style.display = (pairingBox.style.display === 'block') ? 'none' : 'block';
    });
  }

  // 4. Xử lý ghép nối thủ công bằng mã/token
  if (btnPairConfirm) {
    btnPairConfirm.addEventListener('click', async () => {
      const codeOrToken = pairingCodeInput.value.trim();
      if (!codeOrToken) {
        alert('Vui lòng dán mã ghép nối hoặc token được cấp từ trang web Marketing ADDP.');
        return;
      }

      btnPairConfirm.disabled = true;
      btnPairConfirm.textContent = 'Đang xác thực...';

      try {
        const payload = codeOrToken.startsWith('PAIR-') 
          ? { pairing_code: codeOrToken }
          : { pairing_token: codeOrToken };

        const res = await fetch(REDEEM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data && data.success && data.connector_token) {
          await chrome.storage.local.set({
            connector_token: data.connector_token,
            token_expires_at: data.expires_at,
            shop_id: data.shop_id,
            shop_name: data.shop_name || 'Dược Phẩm ADDP',
            connector_id: data.connector_id
          });

          pairingCodeInput.value = '';
          pairingBox.style.display = 'none';
          await refreshAuthStatus();

          logMsg.textContent = '🎉 Ghép nối thành công! Khóa kết nối có hiệu lực trong 24 giờ.';
          logMsg.className = 'log-msg log-success';
          logMsg.style.display = 'block';
        } else {
          throw new Error(data?.message || 'Không thể xác thực mã ghép nối.');
        }
      } catch (err) {
        alert('Lỗi ghép nối: ' + err.message);
      } finally {
        btnPairConfirm.disabled = false;
        btnPairConfirm.textContent = 'Xác Nhận Ghép Nối';
      }
    });
  }

  // 5. Xử lý ngắt kết nối (Revocation)
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc chắn muốn ngắt kết nối tiện ích khỏi Marketing ADDP?')) return;

      try {
        const stored = await chrome.storage.local.get(['connector_token', 'connector_id']);
        if (stored.connector_token) {
          await fetch(REVOKE_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${stored.connector_token}`
            },
            body: JSON.stringify({ connector_id: stored.connector_id })
          }).catch(() => {});
        }
      } catch (e) {}

      await chrome.storage.local.clear();
      await refreshAuthStatus();
      logMsg.textContent = 'Đã ngắt kết nối an toàn trên máy chủ và thiết bị.';
      logMsg.className = 'log-msg log-error';
      logMsg.style.display = 'block';
    });
  }

  // 6. Xử lý Quét & Đồng Bộ dữ liệu về Marketing ADDP
  btnSync.addEventListener('click', async () => {
    btnSync.disabled = true;
    progressBox.style.display = 'block';
    logMsg.style.display = 'none';

    try {
      const stored = await chrome.storage.local.get(['connector_token', 'token_expires_at', 'shop_id', 'shop_name']);
      
      // Enforce pairing: strictly require shop_id and connector_token
      if (!stored.connector_token || !stored.shop_id) {
        throw new Error('Tiện ích chưa được ghép nối với hệ thống Marketing ADDP. Vui lòng nhấn "Nhập mã ghép nối" hoặc kết nối từ ứng dụng web trước khi đồng bộ.');
      }
      const targetShopId = stored.shop_id;
      const targetShopName = stored.shop_name || 'TikTok Shop';

      // Verify current tab is TikTok Seller Center
      if (!isSellerCenter || !currentTab || !currentTab.id) {
        throw new Error('Vui lòng mở tab TikTok Shop Seller Center (seller-vn.tiktok.com) trước khi thực hiện đồng bộ.');
      }

      // BƯỚC 1: Quét dữ liệu La bàn (Compass Overview) từ tab Seller Center
      step1.textContent = '🔄 1. Đang trích xuất số liệu La bàn (Compass Overview)...';
      step1.style.color = '#00f2fe';

      let extractRes = null;
      try {
        extractRes = await chrome.tabs.sendMessage(currentTab.id, { action: 'extract_seller_data' });
      } catch (err) {
        throw new Error('Không thể kết nối với nội dung trang Seller Center. Vui lòng tải lại (F5) tab Seller Center và thử lại.');
      }

      if (!extractRes || !extractRes.success || !extractRes.data) {
        const errorMsg = extractRes?.error || 'Trích xuất dữ liệu thất bại từ trang Seller Center.';
        step1.textContent = '⚠️ 1. ' + errorMsg;
        step1.style.color = '#f1c40f';
        throw new Error(errorMsg);
      }

      const extracted = extractRes.data;

      // PRODUCTION RULE: Compass Overview profile requires total_gmv and valid date range.
      // It does NOT require channel GMVs (live/video/product) or ses_score.
      const hasRequiredMetrics = extracted.total_gmv !== undefined && 
                                 extracted.total_gmv !== null &&
                                 extracted.period_start && 
                                 extracted.period_end && 
                                 extracted.period_days >= 1;

      if (!hasRequiredMetrics) {
        step1.textContent = '⚠️ 1. Thiếu số liệu GMV hoặc khoảng thời gian trên trang hiện tại.';
        step1.style.color = '#f1c40f';
        throw new Error('Không tìm thấy số liệu GMV hoặc khoảng thời gian từ trang La bàn dữ liệu (Compass). Vui lòng mở đúng trang seller-vn.tiktok.com/compass/data-overview.');
      }

      const formatDateVN = (isoStr) => {
        if (!isoStr) return '';
        const p = isoStr.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : isoStr;
      };

      const dateRangeStr = `${formatDateVN(extracted.period_start)} → ${formatDateVN(extracted.period_end)} (${extracted.period_days} ngày)`;
      step1.textContent = `✅ 1. Compass ${dateRangeStr} | GMV: ${Number(extracted.total_gmv).toLocaleString('vi-VN')}đ`;
      step1.style.color = '#2ecc71';

      // BƯỚC 2: Kiểm tra các chỉ số mở rộng (Tổng doanh thu, Đơn hàng, Món bán)
      step2.textContent = '🔄 2. Kiểm tra các chỉ số mở rộng...';
      step2.style.color = '#00f2fe';

      const optParts = [];
      if (extracted.total_revenue !== null && extracted.total_revenue !== undefined) {
        optParts.push(`Tổng doanh thu: ${Number(extracted.total_revenue).toLocaleString('vi-VN')}đ`);
      } else {
        optParts.push('Tổng doanh thu: Không hiển thị trên Seller Center');
      }

      if (extracted.total_orders_count !== null && extracted.total_orders_count !== undefined) {
        optParts.push(`Đơn hàng: ${Number(extracted.total_orders_count).toLocaleString('vi-VN')}`);
      }
      if (extracted.items_sold !== null && extracted.items_sold !== undefined) {
        optParts.push(`Món bán: ${Number(extracted.items_sold).toLocaleString('vi-VN')}`);
      }

      step2.textContent = `✅ 2. ${optParts.join(' | ')}`;
      step2.style.color = '#2ecc71';

      // BƯỚC 3: Chuẩn bị gói dữ liệu đồng bộ
      step3.textContent = '🔄 3. Chuẩn bị gói dữ liệu đồng bộ...';
      step3.style.color = '#00f2fe';

      const payload = {
        shop_id: targetShopId,
        shop_name: extracted.shopName || targetShopName,
        source: 'seller_center_extension',
        extraction_profile: extracted.extraction_profile || 'seller_center_compass_overview',
        extension_version: '1.2.1',
        captured_at: extracted.captured_at || new Date().toISOString(),
        period_start: extracted.period_start,
        period_end: extracted.period_end,
        period_days: extracted.period_days,
        total_gmv: extracted.total_gmv,
        total_revenue: extracted.total_revenue !== undefined ? extracted.total_revenue : null,
        items_sold: extracted.items_sold !== undefined ? extracted.items_sold : null,
        sku_orders: extracted.sku_orders !== undefined ? extracted.sku_orders : null,
        total_orders_count: extracted.total_orders_count !== undefined ? extracted.total_orders_count : null,
        live_gmv: null,
        video_gmv: null,
        product_gmv: null,
        ses_score: null,
        raw_extraction_url: extracted.url || currentTab.url
      };
      step3.textContent = '✅ 3. Gói dữ liệu trích xuất hợp lệ.';
      step3.style.color = '#2ecc71';

      // BƯỚC 4: Gửi dữ liệu về máy chủ Marketing ADDP
      step4.textContent = '🔄 4. Đang gửi dữ liệu về máy chủ marketing.addp.vn...';
      step4.style.color = '#00f2fe';

      const headers = { 'Content-Type': 'application/json' };
      if (stored.connector_token) {
        headers['Authorization'] = `Bearer ${stored.connector_token}`;
      }

      const res = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        await chrome.storage.local.remove(['connector_token', 'token_expires_at']);
        await refreshAuthStatus();
        throw new Error('Khóa kết nối hết hạn hoặc đã bị thu hồi. Vui lòng kết nối lại tiện ích.');
      }

      if (res.status === 429) {
        throw new Error('Lần đồng bộ thành công gần nhất vừa diễn ra. Vui lòng chờ 30 giây giữa các lần quét.');
      }

      if (res.status === 413) {
        throw new Error('Kích thước dữ liệu vượt quá giới hạn cho phép (256 KB).');
      }

      const json = await res.json();
      if (json && json.success) {
        step4.textContent = '✅ 4. Đồng bộ dữ liệu thành công lên hệ thống!';
        step4.style.color = '#2ecc71';

        const authNotice = json.is_authenticated ? ' (Đã xác thực bảo mật)' : ' (Chế độ chuyển tiếp)';
        logMsg.textContent = `🎉 Đã đồng bộ 100% số liệu thực tế${authNotice}! Hãy tải lại trang web Marketing ADDP để xem Báo cáo kiểm toán.`;
        logMsg.className = 'log-msg log-success';
        logMsg.style.display = 'block';
      } else {
        throw new Error(json?.message || 'Máy chủ trả về phản hồi lỗi.');
      }
    } catch (err) {
      step4.textContent = '❌ 4. Lỗi: ' + err.message;
      step4.style.color = '#fe2c55';

      logMsg.textContent = 'Lỗi đồng bộ: ' + err.message;
      logMsg.className = 'log-msg log-error';
      logMsg.style.display = 'block';
    } finally {
      btnSync.disabled = false;
    }
  });

  // 6. Xử lý nút Mở Mắt & Thu Thập Khách Hàng (Customer 360)
  const btnCaptureCustomer = document.getElementById('btnCaptureCustomer');
  if (btnCaptureCustomer) {
    btnCaptureCustomer.addEventListener('click', async () => {
      btnCaptureCustomer.disabled = true;
      btnCaptureCustomer.innerHTML = '<span>⏳ Đang mở mắt & lưu...</span>';
      logMsg.style.display = 'none';

      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id) {
          throw new Error('Không tìm thấy tab Seller Center đang hoạt động.');
        }

        chrome.tabs.sendMessage(activeTab.id, { action: 'capture_customer_from_page' }, (res) => {
          btnCaptureCustomer.disabled = false;
          btnCaptureCustomer.innerHTML = '<span>👁️ Mở Mắt & Thu Thập Khách Hàng</span>';

          if (chrome.runtime.lastError) {
            logMsg.textContent = 'Không thể kết nối với trang. Vui lòng F5 làm mới lại trang Seller Center và thử lại!';
            logMsg.className = 'log-msg log-error';
            logMsg.style.display = 'block';
            return;
          }

          if (res && res.success) {
            logMsg.textContent = `🎉 ${res.message || 'Thu thập thành công!'} Dữ liệu đã lưu vào Khách Hàng 360 trên Marketing ADDP.`;
            logMsg.className = 'log-msg log-success';
            logMsg.style.display = 'block';
          } else {
            if (res && res.detected_order_id) {
              logMsg.innerHTML = `
                <div style="margin-bottom:6px;">ℹ️ ${res.error}</div>
                <button id="btnGoToDetail" style="
                  background: #00f2fe;
                  color: #0f172a;
                  border: none;
                  padding: 6px 10px;
                  border-radius: 6px;
                  font-weight: 700;
                  cursor: pointer;
                  font-size: 11px;
                  display: block;
                  width: 100%;
                ">👉 Chuyển đến Chi tiết đơn ${res.detected_order_id}</button>
              `;
              logMsg.className = 'log-msg log-warn';
              logMsg.style.display = 'block';

              const btnGo = document.getElementById('btnGoToDetail');
              if (btnGo) {
                btnGo.addEventListener('click', () => {
                  chrome.tabs.update(activeTab.id, {
                    url: `https://seller-vn.tiktok.com/order/detail?order_no=${res.detected_order_id}&shop_region=VN`
                  });
                  window.close();
                });
              }
            } else {
              logMsg.textContent = res?.error || res?.message || 'Không tìm thấy thông tin khách hàng trên trang này. Hãy mở trang Chi tiết đơn hàng.';
              logMsg.className = 'log-msg log-error';
              logMsg.style.display = 'block';
            }
          }
        });
      } catch (err) {
        btnCaptureCustomer.disabled = false;
        btnCaptureCustomer.innerHTML = '<span>👁️ Mở Mắt & Thu Thập Khách Hàng</span>';
        logMsg.textContent = 'Lỗi: ' + err.message;
        logMsg.className = 'log-msg log-error';
        logMsg.style.display = 'block';
      }
    });
  }
});
