(function () {
  'use strict';

  // TOP-FRAME ISOLATION GUARD:
  // TikTok Seller Center embeds many tracking, ads, and payment iframes.
  // The extension MUST NEVER run inside iframes to prevent duplicate observers,
  // script conflicts, and DOM reflow thrashing.
  if (typeof window !== 'undefined' && window.self && window.top && window.self !== window.top) {
    return;
  }

  // Content Script for TikTok Shop Audit & Sync Extension
  // Supports:
  // 1. TikTok Seller Center tab: Real DOM extraction for Compass Overview
  // 2. Marketing ADDP tab: 1-Click Pairing Bridge (exchanging 5-minute pairing code for 24h connector token)

  const isAddpApp = typeof window !== 'undefined' && window.location && (
    window.location.hostname.includes('marketing.addp.vn') || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1'
  );

  if (isAddpApp) {
  // Listen for pairing request dispatched by authenticated ADDP web app
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'ADDP_PAIRING_REQUEST') return;

    const pairingToken = event.data.pairing_token;
    if (!pairingToken) return;

    try {
      const redeemUrl = '/api/connector_token.php?action=redeem_pairing';
      const res = await fetch(redeemUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairing_token: pairingToken })
      });

      const data = await res.json();
      if (data && data.success && data.connector_token) {
        // Store 24-hour connector credential strictly in extension storage
        await chrome.storage.local.set({
          connector_token: data.connector_token,
          token_expires_at: data.expires_at,
          shop_id: data.shop_id,
          shop_name: data.shop_name || '',
          connector_id: data.connector_id
        });

        // Notify page that pairing was completed (without exposing the 24h token to the DOM)
        window.postMessage({
          type: 'ADDP_PAIRING_SUCCESS',
          shop_id: data.shop_id,
          expires_at: data.expires_at
        }, window.location.origin);
      } else {
        window.postMessage({
          type: 'ADDP_PAIRING_ERROR',
          message: data?.message || 'Không thể xác thực mã ghép nối.'
        }, window.location.origin);
      }
    } catch (err) {
      window.postMessage({
        type: 'ADDP_PAIRING_ERROR',
        message: err.message
      }, window.location.origin);
    }
  });

  // Announce extension presence to web application (v1.2.1)
  window.postMessage({ type: 'ADDP_EXTENSION_INSTALLED', version: '1.2.1' }, window.location.origin);
}

// ====================================================
// DOM EXTRACTION & NORMALIZATION LOGIC
// ====================================================

/**
 * Normalizes Vietnamese display numbers with currency, units, thousands dots, and decimal commas.
 * Examples:
 *   "123,4 Tr₫" => 123400000
 *   "123,4\nTr\n₫" => 123400000
 *   "567,8 Tr₫" => 567800000
 *   "3.897"     => 3897
 *   "3.836"     => 3836
 *   "2.540"     => 2540
 *   "0"         => 0
 *   "0đ"        => 0
 *   "--"        => null
 */
function parseVietnameseNumber(rawStr) {
  if (rawStr === null || rawStr === undefined) return null;
  let s = String(rawStr).trim();
  if (s === '' || s === '-' || s === '--' || s === 'N/A' || s === 'null') return null;

  // Normalize non-breaking spaces and collapse all whitespace/newlines into standard space
  s = s.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
       .replace(/[\r\n\t]+/g, ' ')
       .replace(/\s+/g, ' ');

  // Strip currency symbols
  s = s.replace(/[₫đĐVNDvnd]/g, '').trim();

  // Explicit zero check (0, 0.0, 0,0, etc.)
  if (/^0+(\.0+|,0+)?$/.test(s) || s === '0') {
    return 0;
  }

  // Detect multipliers: Tr / triệu (x 1,000,000), Tỷ / tỷ (x 1,000,000,000), N / nghìn / k (x 1,000)
  let multiplier = 1;
  const lower = s.toLowerCase();
  if (/\b(tỷ|ty)\b/i.test(lower) || /tỷ/i.test(lower)) {
    multiplier = 1000000000;
    s = s.replace(/tỷ|ty/gi, '').trim();
  } else if (/\b(tr|triệu|trieu)\b/i.test(lower) || /tr\b/i.test(lower) || /tr/i.test(lower)) {
    multiplier = 1000000;
    s = s.replace(/triệu|trieu|tr/gi, '').trim();
  } else if (/\b(nghìn|nghin|k)\b/i.test(lower) || /\bn\b/i.test(lower)) {
    multiplier = 1000;
    s = s.replace(/nghìn|nghin|\bn\b|\bk\b/gi, '').trim();
  }

  // Remove spaces
  s = s.replace(/\s+/g, '');
  if (s === '') return null;

  let numVal = NaN;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastDot > lastComma) {
      // Format: 1,234.56
      s = s.replace(/,/g, '');
    } else {
      // Format: 1.234,56
      s = s.replace(/\./g, '').replace(/,/g, '.');
    }
    numVal = parseFloat(s);
  } else if (hasComma) {
    // Only comma present
    if (multiplier > 1) {
      // With multiplier like "123,4 Tr", comma is decimal
      s = s.replace(/,/g, '.');
    } else {
      const parts = s.split(',');
      if (parts.length > 2) {
        s = s.replace(/,/g, ''); // 1,000,000
      } else if (parts[1].length === 3 && parts[0].length >= 1) {
        s = s.replace(/,/g, ''); // 3,897
      } else {
        s = s.replace(/,/g, '.'); // 4,5
      }
    }
    numVal = parseFloat(s);
  } else if (hasDot) {
    // Only dot present
    if (multiplier > 1) {
      numVal = parseFloat(s);
    } else {
      const parts = s.split('.');
      if (parts.length > 2) {
        s = s.replace(/\./g, ''); // 2.261.600
      } else if (parts[1].length === 3) {
        s = s.replace(/\./g, ''); // 3.897, 2.540
      }
      numVal = parseFloat(s);
    }
  } else {
    // Pure integer
    numVal = parseFloat(s);
  }

  if (isNaN(numVal)) return null;

  return Math.round(numVal * multiplier * 100) / 100;
}

/**
 * Parses Vietnamese date strings into ISO "YYYY-MM-DD"
 */
function parseVietnameseDate(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const s = rawStr.trim();

  // Pattern 1: "Th09 01, 2026" or "Tháng 09 01, 2026"
  const mMatch = s.match(/Th(?:áng)?\.?\s*(\d{1,2})\s+(\d{1,2}),?\s*(\d{4})/i);
  if (mMatch) {
    const month = parseInt(mMatch[1], 10);
    const day = parseInt(mMatch[2], 10);
    const year = parseInt(mMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern 2: "24/09/2026" or "01/09/2026" (DD/MM/YYYY)
  const dMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dMatch) {
    const day = parseInt(dMatch[1], 10);
    const month = parseInt(dMatch[2], 10);
    const year = parseInt(dMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern 3: "2026-09-01" (ISO YYYY-MM-DD)
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000) {
      return s;
    }
  }

  return null;
}

/**
 * Extracts and calculates date range from TikTok Seller Center Date Picker
 * Container: [data-tid="m4b_date_picker_range_picker"]
 * Calculates inclusive period_days = (end - start) + 1
 */
function parseDateRange(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root || !root.querySelector) {
    return {
      period_start: null,
      period_end: null,
      period_days: null,
      error_code: 'ROOT_INVALID',
      error: 'Document root unavailable'
    };
  }

  const picker = root.querySelector('[data-tid="m4b_date_picker_range_picker"]');
  let startStr = null;
  let endStr = null;

  if (picker) {
    const startInput = picker.querySelector('input[placeholder="Ngày bắt đầu"], input[placeholder*="bắt đầu"]');
    const endInput = picker.querySelector('input[placeholder="Ngày kết thúc"], input[placeholder*="kết thúc"]');
    if (startInput && startInput.value) startStr = startInput.value;
    if (endInput && endInput.value) endStr = endInput.value;

    if (!startStr || !endStr) {
      const inputs = picker.querySelectorAll('input');
      if (inputs.length >= 2) {
        if (!startStr && inputs[0].value) startStr = inputs[0].value;
        if (!endStr && inputs[1].value) endStr = inputs[1].value;
      }
    }
  }

  // Fallback: search root for inputs with placeholder
  if (!startStr || !endStr) {
    const startInput = root.querySelector('input[placeholder="Ngày bắt đầu"], input[placeholder*="bắt đầu"]');
    const endInput = root.querySelector('input[placeholder="Ngày kết thúc"], input[placeholder*="kết thúc"]');
    if (startInput && startInput.value) startStr = startInput.value;
    if (endInput && endInput.value) endStr = endInput.value;
  }

  if (!startStr && !endStr) {
    return {
      period_start: null,
      period_end: null,
      period_days: null,
      error_code: 'DATE_RANGE_NOT_FOUND',
      error: 'Không tìm thấy bộ chọn khoảng thời gian (Date Picker) trên trang.'
    };
  }

  const startDateIso = parseVietnameseDate(startStr);
  const endDateIso = parseVietnameseDate(endStr);

  if (!startDateIso || !endDateIso) {
    return {
      period_start: null,
      period_end: null,
      period_days: null,
      error_code: 'DATE_RANGE_PARSE_FAILED',
      error: 'Không thể đọc khoảng thời gian hợp lệ từ bộ chọn ngày (Date Picker).'
    };
  }

  const dStart = new Date(startDateIso + 'T00:00:00Z');
  const dEnd = new Date(endDateIso + 'T00:00:00Z');

  if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime()) || dStart > dEnd) {
    return {
      period_start: null,
      period_end: null,
      period_days: null,
      error_code: 'DATE_RANGE_PARSE_FAILED',
      error: 'Ngày bắt đầu lớn hơn ngày kết thúc hoặc khoảng thời gian không hợp lệ.'
    };
  }

  // Inclusive days calculation: (end - start) + 1
  const diffMs = dEnd.getTime() - dStart.getTime();
  const periodDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return {
    period_start: startDateIso,
    period_end: endDateIso,
    period_days: periodDays,
    error_code: 'SUCCESS',
    error: null
  };
}

function normalizeLabel(text) {
  if (!text) return '';
  return text
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Robust semantic metric card extractor.
 * 
 * Target DOM architecture:
 *   [LABEL.core-checkbox...pcm-smc-card-group-item] (optional TikTok wrapper)
 *     └── DIV.pcm-smc (the metric card)
 *         ├── DIV.pcm-smc-title
 *         │   └── SPAN.pcm-smc-title-text-underline-inner ("GMV")
 *         └── DIV.pcm-smc-value-content ("254,2\nTr\n₫" / "254,2Tr₫")
 *
 * CRITICAL FIX FOR HF1.1.2:
 * In v1.1.2, noise filtering excluded any candidate whose ancestor was <label> or [class*="checkbox"].
 * However, TikTok Seller Center wraps every real KPI card in <label class="core-checkbox ... pcm-smc-card-group-item">.
 * This caused false positives in v1.1.2, rejecting all 8 legitimate KPI cards.
 * We now strictly validate that the candidate belongs to a legitimate .pcm-smc card containing .pcm-smc-value-content,
 * without rejecting candidates merely because an outer wrapper is a checkbox label.
 */
function findMetricCard(root = (typeof document !== 'undefined' ? document : null), labelAliases = []) {
  if (!root || !root.querySelectorAll) {
    return {
      found: false,
      code: 'ROOT_INVALID',
      label: null,
      card: null,
      valueNode: null,
      rawValue: null,
      parsedValue: null
    };
  }

  const targetAliases = (labelAliases || []).map(a => normalizeLabel(a).toLowerCase()).filter(Boolean);
  if (targetAliases.length === 0) {
    return {
      found: false,
      code: 'LABEL_NOT_FOUND',
      label: null,
      card: null,
      valueNode: null,
      rawValue: null,
      parsedValue: null
    };
  }

  // Primary proven DOM selector followed by controlled fallbacks within .pcm-smc
  const candidateSelectors = [
    '.pcm-smc-title-text-underline-inner',
    '.pcm-smc .pcm-smc-title-text-underline-inner',
    '.pcm-smc .pcm-smc-title-text',
    '.pcm-smc .pcm-smc-title',
    '.pcm-smc [class*="title-text"]'
  ];

  let bestTitleNode = null;
  let bestLabelText = null;
  let fallbackCardNotFound = false;
  let fallbackValueNotFound = false;
  let fallbackParseFailed = null;

  for (const selector of candidateSelectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const node of nodes) {
      // Narrow noise filtering: exclude only elements inside actual chart tooltip popovers
      // NOTE: DO NOT exclude <label> or [class*="checkbox"] because TikTok wraps real KPI cards in LABEL.core-checkbox!
      if (node.closest && node.closest('.vchart-tooltip, .echarts-tooltip, .biz-tooltip, [role="tooltip"], [class*="vchart-tooltip"]')) {
        continue;
      }

      const text = normalizeLabel(node.textContent || node.innerText);
      if (!text) continue;

      if (!targetAliases.includes(text.toLowerCase())) {
        continue;
      }

      bestTitleNode = node;
      bestLabelText = text;

      // Locate enclosing card: const card = title.closest('.pcm-smc')
      let card = null;
      if (node.closest) {
        card = node.closest('.pcm-smc');
        if (card === node && node.parentElement) {
          card = node.parentElement.closest ? node.parentElement.closest('.pcm-smc') : null;
        }
      }

      // Controlled fallback for card traversal
      if (!card) {
        let parent = node.parentElement;
        while (parent && parent !== root) {
          if (parent.classList && parent.classList.contains('pcm-smc')) {
            card = parent;
            break;
          }
          if (parent.querySelector && parent.querySelector('.pcm-smc-value-content')) {
            const cls = parent.className || '';
            if (!cls.includes('card-group') && !cls.includes('container') && !cls.includes('wrapper')) {
              card = parent;
              break;
            }
          }
          parent = parent.parentElement;
        }
      }

      if (!card) {
        fallbackCardNotFound = true;
        continue;
      }

      // Query value node inside ONLY that card
      let valueNode = card.querySelector('.pcm-smc-value-content');
      if (!valueNode) {
        valueNode = card.querySelector('[class*="pcm-smc-value"]');
      }

      if (!valueNode) {
        fallbackValueNotFound = true;
        continue;
      }

      // Read value from: valueNode.innerText || valueNode.textContent
      const rawValue = (valueNode.innerText || valueNode.textContent || '').trim();
      const parsedValue = parseVietnameseNumber(rawValue);

      if (parsedValue === null && rawValue !== '' && rawValue !== '-' && rawValue !== '--' && rawValue !== 'N/A') {
        fallbackParseFailed = { card, valueNode, rawValue };
        continue;
      }

      // Valid card found!
      return {
        found: true,
        code: 'SUCCESS',
        label: bestLabelText,
        card,
        valueNode,
        rawValue,
        parsedValue
      };
    }
  }

  // If no candidate matched label
  if (!bestTitleNode) {
    return {
      found: false,
      code: 'LABEL_NOT_FOUND',
      label: null,
      card: null,
      valueNode: null,
      rawValue: null,
      parsedValue: null
    };
  }

  if (fallbackParseFailed) {
    return {
      found: false,
      code: 'VALUE_PARSE_FAILED',
      label: bestLabelText,
      card: fallbackParseFailed.card,
      valueNode: fallbackParseFailed.valueNode,
      rawValue: fallbackParseFailed.rawValue,
      parsedValue: null
    };
  }

  if (fallbackValueNotFound) {
    return {
      found: false,
      code: 'VALUE_NOT_FOUND',
      label: bestLabelText,
      card: null,
      valueNode: null,
      rawValue: null,
      parsedValue: null
    };
  }

  if (fallbackCardNotFound) {
    return {
      found: false,
      code: 'CARD_NOT_FOUND',
      label: bestLabelText,
      card: null,
      valueNode: null,
      rawValue: null,
      parsedValue: null
    };
  }

  return {
    found: false,
    code: 'LABEL_NOT_FOUND',
    label: null,
    card: null,
    valueNode: null,
    rawValue: null,
    parsedValue: null
  };
}

/**
 * Extracts Compass Overview metrics using semantic card lookup.
 * Supported metrics:
 *   - GMV (required)
 *   - Tổng doanh thu (optional)
 *   - Số món bán ra (optional)
 *   - Đơn hàng SKU (optional)
 *   - Đơn hàng (optional)
 */
function extractCompassOverviewMetrics(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root || !root.querySelectorAll) {
    return {
      candidate_title_count: 0,
      valid_card_count: 0,
      gmv_result: { found: false, code: 'ROOT_INVALID' },
      total_gmv: null,
      total_revenue: null,
      items_sold: null,
      sku_orders: null,
      total_orders_count: null,
      raw_labels: []
    };
  }

  // Count candidate titles and valid cards for diagnostics
  const primaryTitleNodes = Array.from(root.querySelectorAll('.pcm-smc-title-text-underline-inner'));
  const candidateTitleCount = primaryTitleNodes.length > 0
    ? primaryTitleNodes.length
    : Array.from(root.querySelectorAll('.pcm-smc .pcm-smc-title-text, .pcm-smc .pcm-smc-title')).length;

  const allCards = Array.from(root.querySelectorAll('.pcm-smc'));
  const validCards = allCards.filter(c => c.querySelector && c.querySelector('.pcm-smc-value-content'));
  const validCardCount = validCards.length;

  const gmvRes = findMetricCard(root, ['GMV']);
  const revRes = findMetricCard(root, ['Tổng doanh thu', 'Tong doanh thu', 'Total Revenue']);
  const itemsRes = findMetricCard(root, ['Số món bán ra', 'So mon ban ra', 'Items Sold']);
  const skuRes = findMetricCard(root, ['Đơn hàng SKU', 'Don hang SKU', 'SKU Orders']);
  const ordersRes = findMetricCard(root, ['Đơn hàng', 'Don hang', 'Orders']);

  const detectedLabels = [];
  if (gmvRes.found && gmvRes.label) detectedLabels.push(gmvRes.label);
  if (revRes.found && revRes.label) detectedLabels.push(revRes.label);
  if (itemsRes.found && itemsRes.label) detectedLabels.push(itemsRes.label);
  if (skuRes.found && skuRes.label) detectedLabels.push(skuRes.label);
  if (ordersRes.found && ordersRes.label) detectedLabels.push(ordersRes.label);

  return {
    candidate_title_count: candidateTitleCount,
    valid_card_count: validCardCount,
    gmv_result: gmvRes,
    total_gmv: gmvRes.parsedValue !== undefined ? gmvRes.parsedValue : null,
    total_revenue: revRes.parsedValue !== undefined ? revRes.parsedValue : null,
    items_sold: itemsRes.parsedValue !== null && itemsRes.parsedValue !== undefined ? Math.round(itemsRes.parsedValue) : null,
    sku_orders: skuRes.parsedValue !== null && skuRes.parsedValue !== undefined ? Math.round(skuRes.parsedValue) : null,
    total_orders_count: ordersRes.parsedValue !== null && ordersRes.parsedValue !== undefined ? Math.round(ordersRes.parsedValue) : null,
    raw_labels: detectedLabels
  };
}

// ====================================================
// CHROME RUNTIME MESSAGE HANDLER (SELLER CENTER TABS)
// ====================================================

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract_seller_data') {
      try {
        const dateRes = parseDateRange(document);
        const metrics = extractCompassOverviewMetrics(document);

        const shopNameEl = document.querySelector('.shop-name, [class*="shopName"], [class*="ShopHeader"]');
        const shopName = shopNameEl ? (shopNameEl.innerText || shopNameEl.textContent || '').trim() : null;

        const gmvFound = metrics.total_gmv !== null && metrics.total_gmv !== undefined;
        const dateRangeFound = dateRes.period_start !== null && dateRes.period_end !== null && dateRes.period_days !== null;

        if (!gmvFound || !dateRangeFound) {
          let gmvDiagnostic = 'SUCCESS';
          if (!gmvFound) {
            if (metrics.gmv_result && metrics.gmv_result.code === 'LABEL_NOT_FOUND') gmvDiagnostic = 'GMV_LABEL_NOT_FOUND';
            else if (metrics.gmv_result && metrics.gmv_result.code === 'CARD_NOT_FOUND') gmvDiagnostic = 'GMV_CARD_NOT_FOUND';
            else if (metrics.gmv_result && metrics.gmv_result.code === 'VALUE_NOT_FOUND') gmvDiagnostic = 'GMV_VALUE_NOT_FOUND';
            else if (metrics.gmv_result && metrics.gmv_result.code === 'VALUE_PARSE_FAILED') gmvDiagnostic = 'GMV_VALUE_PARSE_FAILED';
            else gmvDiagnostic = 'GMV_VALUE_NOT_FOUND';
          }

          let dateDiagnostic = 'SUCCESS';
          if (!dateRangeFound) {
            dateDiagnostic = dateRes.error_code || 'DATE_RANGE_NOT_FOUND';
          }

          let errorMsg = '';
          if (!gmvFound && !dateRangeFound) {
            errorMsg = 'Không tìm thấy số liệu GMV và khoảng thời gian trên trang hiện tại. Vui lòng kiểm tra trang La bàn dữ liệu.';
          } else if (!gmvFound) {
            switch (gmvDiagnostic) {
              case 'GMV_LABEL_NOT_FOUND':
                errorMsg = 'Không tìm thấy thẻ chỉ số GMV trên trang La bàn dữ liệu.';
                break;
              case 'GMV_CARD_NOT_FOUND':
                errorMsg = 'Tìm thấy nhãn GMV nhưng không xác định được thẻ chỉ số (metric card).';
                break;
              case 'GMV_VALUE_NOT_FOUND':
                errorMsg = 'Thẻ chỉ số GMV không có nội dung giá trị (value content).';
                break;
              case 'GMV_VALUE_PARSE_FAILED':
                errorMsg = 'Không thể đọc được giá trị số của chỉ số GMV: ' + (metrics.gmv_result?.rawValue || '');
                break;
              default:
                errorMsg = 'Không tìm thấy số liệu GMV trên trang La bàn dữ liệu.';
            }
          } else {
            errorMsg = dateRes.error || 'Không đọc được khoảng thời gian từ bộ chọn ngày (Date Picker).';
          }

          sendResponse({
            success: false,
            error_code: !gmvFound ? gmvDiagnostic : dateDiagnostic,
            error: errorMsg,
            diagnostics: {
              candidate_title_count: metrics.candidate_title_count,
              valid_card_count: metrics.valid_card_count,
              detected_labels: metrics.raw_labels,
              gmv_status: gmvDiagnostic,
              date_status: dateDiagnostic,
              gmv_found: gmvFound,
              date_range_found: dateRangeFound,
              gmv_raw_value: metrics.gmv_result?.rawValue || null,
              date_error: dateRes.error || null,
              period_start: dateRes.period_start,
              period_end: dateRes.period_end,
              period_days: dateRes.period_days,
              page_url: window.location.href
            }
          });
          return true;
        }

        sendResponse({
          success: true,
          data: {
            extraction_profile: 'seller_center_compass_overview',
            period_start: dateRes.period_start,
            period_end: dateRes.period_end,
            period_days: dateRes.period_days,

            total_gmv: metrics.total_gmv,
            total_revenue: metrics.total_revenue,

            items_sold: metrics.items_sold,
            sku_orders: metrics.sku_orders,
            total_orders_count: metrics.total_orders_count,

            url: window.location.href,
            shopName: shopName,
            captured_at: new Date().toISOString(),
            extension_version: '1.2.1'
          }
        });
      } catch (e) {
        sendResponse({
          success: false,
          error_code: 'EXTRACTION_EXCEPTION',
          error: 'Lỗi khi trích xuất dữ liệu: ' + e.message,
          diagnostics: {
            page_url: window.location.href
          }
        });
      }
    } else if (request.action === 'capture_customer_from_page' || request.action === 'start_batch_capture') {
      (async () => {
        try {
          if (window.location.href.includes('/order/detail')) {
            // Single order on detail page
            await unmaskEyeIcons(document);
            await new Promise(r => setTimeout(r, 600));
            let detail = parseUnmaskedCustomerDetail(document);
            if (detail && detail.phone && detail.phone.includes('*')) {
              await unmaskEyeIcons(document);
              await new Promise(r => setTimeout(r, 600));
              detail = parseUnmaskedCustomerDetail(document);
            }
            if (detail.success) {
              const res = await sendCapturedCustomerToServer(detail);
              sendResponse({
                success: true,
                message: `Đã lưu: ${detail.recipient_name || 'Khách hàng'} (${detail.phone || 'SĐT'})`,
                data: detail,
                server_response: res
              });
            } else {
              sendResponse({ success: false, error: 'Không tìm thấy thông tin khách hàng trên trang này.' });
            }
          } else {
            // Order List page: Launch In-Page & Batch Scan
            const orderIds = findAllOrderIdsOnPage();
            if (orderIds.length === 0) {
              sendResponse({ success: false, error: 'Không tìm thấy mã đơn hàng nào trên trang này. Hãy đảm bảo danh sách đơn hàng đã tải xong.' });
              return;
            }
            sendResponse({
              success: true,
              batch_started: true,
              total_orders: orderIds.length,
              message: `Đang quét và mở mắt ${orderIds.length} đơn hàng trên trang này!`
            });
            runOrderListScan();
          }
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }
    return true;
  });
}

// ====================================================
// REAL-TIME CUSTOMER 360 & UNMASKED PII CAPTURE
// Component: Module 1 Customer Ingestion (Awaiting Shipment / In Transit)
// ====================================================

/**
 * Safely extracts class string from HTML and SVG elements.
 */
function getElementClassString(el) {
  if (!el) return '';
  if (typeof el.className === 'string') return el.className;
  if (el.className && typeof el.className.baseVal === 'string') return el.className.baseVal;
  return (typeof el.getAttribute === 'function') ? (el.getAttribute('class') || '') : '';
}

/**
 * Determines whether an element must NEVER be clicked (links, tabs, chat, action buttons, modals, navigation).
 */
function isForbiddenElement(el) {
  if (!el || !el.getAttribute) return true;
  const tag = (el.tagName || '').toUpperCase();

  // Never click <a> tags or anything inside an <a> tag
  if (tag === 'A' || (typeof el.closest === 'function' && el.closest('a'))) return true;
  // Never click elements targeting a new window/tab
  if (el.getAttribute('target') === '_blank' || (typeof el.closest === 'function' && el.closest('[target="_blank"]'))) return true;

  // Never click form controls
  if (['INPUT', 'SELECT', 'TEXTAREA', 'OPTION'].includes(tag)) return true;

  // CRITICAL: Never click anything located in the card header / section title!
  // Eye icons are NEVER in card headers; the green chat bubble IS in the card header.
  if (typeof el.closest === 'function') {
    const inHeader = el.closest('[class*="header"], [class*="title"], [class*="head"], h1, h2, h3, h4, h5, h6, .arco-card-header, .semi-card-header');
    if (inHeader) return true;
  }

  // Check element attributes, class, and href for forbidden keywords (STRICTLY FORBID CHAT / CONTACT!)
  const title = (el.getAttribute('title') || el.getAttribute('aria-label') || '').toLowerCase();
  const cls = getElementClassString(el).toLowerCase();
  const dataIcon = (el.getAttribute('data-icon') || '').toLowerCase();
  const href = (el.getAttribute('href') || el.getAttribute('data-href') || '').toLowerCase();
  const combined = `${cls} ${title} ${dataIcon} ${href}`;

  const forbidden = [
    'chat', 'message', 'trò chuyện', 'tin nhắn', 'im', 'comment',
    'customer_enter', 'seller_id', 'inbox', 'talk', 'conversation',
    'liên hệ', 'người mua', 'buyer', 'contact', 'customer_service',
    'arco-icon-message', 'icon-message',
    'bưu kiện', 'khiếu nại', 'kháng nghị', 'hoàn tiền', 'trả hàng',
    'chi tiết', 'detail', 'xem đơn', 'xem shop', 'chấp nhận', 'từ chối',
    'in phiếu', 'giao hàng', 'hủy', 'thỏa thuận', 'xác nhận', 'xem lý do',
    'xem thêm', 'tab', 'nav', 'menu', 'dropdown', 'filter', 'sort',
    'phân tích', 'la bàn', 'compass', 'fulfillment', 'báo cáo', 'tổng quan', 'chính sách'
  ];

  for (const f of forbidden) {
    if (combined.includes(f)) {
      return true;
    }
  }

  // Also check ancestor up to 6 levels for chat / message / contact keywords
  let p = el.parentElement;
  for (let i = 0; i < 6 && p; i++) {
    const pCls = getElementClassString(p).toLowerCase();
    const pTitle = ((p.getAttribute('aria-label') || '') + ' ' + (p.getAttribute('title') || '') + ' ' + (p.getAttribute('href') || '')).toLowerCase();
    const pCombined = `${pCls} ${pTitle}`;
    for (const f of ['chat', 'message', 'trò chuyện', 'tin nhắn', 'inbox', 'customer_enter', 'conversation', 'liên hệ', 'người mua', 'arco-icon-message']) {
      if (pCombined.includes(f)) return true;
    }
    p = p.parentElement;
  }

  // If element has significant text (> 2 characters), it is a labeled button/link/tab, NOT an eye icon
  const innerText = (el.textContent || '').trim();
  if (innerText.length > 2) return true;

  return false;
}

/**
 * Helper to locate the Shipping Address or Customer Details card on /order/detail.
 * Scoping search to this card ensures sidebars, headers, and navigation are never touched.
 * Priority is strictly given to "Địa chỉ giao hàng" (where the recipient phone and eye icon reside).
 */
function findCustomerCardContainer(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root || !root.querySelectorAll) return null;
  const headings = Array.from(root.querySelectorAll('div, span, h2, h3, h4, h5, p'));

  // Priority 1: Specifically locate Shipping Address card
  for (const h of headings) {
    const t = (h.textContent || '').trim();
    if (t === 'Địa chỉ giao hàng' || t === 'Shipping Address') {
      const card = (typeof h.closest === 'function' ? h.closest('.arco-card, .semi-card, [class*="card"], [class*="section"], [class*="container"], [class*="wrapper"]') : null) || h.parentElement;
      if (card) return card;
    }
  }

  // Fallback Priority 2: Customer Details card
  for (const h of headings) {
    const t = (h.textContent || '').trim();
    if (t === 'Chi tiết khách hàng' || t === 'Customer Details') {
      const card = (typeof h.closest === 'function' ? h.closest('.arco-card, .semi-card, [class*="card"], [class*="section"], [class*="container"], [class*="wrapper"]') : null) || h.parentElement;
      if (card) return card;
    }
  }

  return (root.querySelector ? root.querySelector('.arco-card, .semi-card, [class*="customer"], [class*="order-detail"]') : null) || root;
}

/**
 * Validates if an element is genuinely an eye icon designed to reveal masked PII.
 */
function isRealEyeIcon(el) {
  if (isForbiddenElement(el)) return false;

  const tag = (el.tagName || '').toLowerCase();
  const cls = getElementClassString(el).toLowerCase();
  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
  const title = (el.getAttribute('title') || '').toLowerCase();
  const dataIcon = (el.getAttribute('data-icon') || '').toLowerCase();

  // Rule 1: Strictly require masked text containing asterisks (*) in immediate parent / ancestor (max 4 levels)
  let curr = el.parentElement;
  let hasMaskNearby = false;
  for (let i = 0; i < 4 && curr; i++) {
    const text = (curr.textContent || '');
    if (text.includes('*') || text.match(/(?:\(\+84\)|0|\+84)[0-9*]{6,15}/)) {
      hasMaskNearby = true;
      break;
    }
    curr = curr.parentElement;
  }

  if (!hasMaskNearby) {
    return false;
  }

  // Rule 2: Must match explicit eye icon visual markers
  const isEyeIdentifier = (
    cls.includes('icon-eye') ||
    cls.includes('icon-eye-invisible') ||
    cls.includes('eye-closed') ||
    cls.includes('eye-open') ||
    cls.includes('iconeye') ||
    cls.includes('eye') ||
    ariaLabel.includes('eye') ||
    title.includes('eye') ||
    dataIcon.includes('eye') ||
    ariaLabel.includes('hiển thị') ||
    title.includes('hiển thị') ||
    ariaLabel.includes('mở mắt') ||
    title.includes('mở mắt') ||
    ariaLabel.includes('unmask') ||
    title.includes('unmask')
  );

  const isIconTag = ['svg', 'path', 'use', 'i', 'span'].includes(tag) || cls.includes('icon') || cls.includes('arco') || cls.includes('semi');
  const isIconButton = (tag === 'button' || el.getAttribute('role') === 'button') && (el.textContent || '').trim().length <= 2;

  if (isEyeIdentifier && (isIconTag || isIconButton)) {
    return true;
  }

  // Check SVG content for eye path or svg child
  if (tag === 'button' || el.getAttribute('role') === 'button') {
    const svgChild = el.querySelector('svg, span[class*="icon"]');
    if (svgChild && isRealEyeIcon(svgChild)) {
      return true;
    }
  }

  return false;
}

/**
 * Safely dispatches standard native pointer and mouse events across window realms.
 * Invokes React internal event handlers if present to ensure state mutations trigger unmasking.
 */
function triggerRealReactClick(el) {
  if (!el) return;
  try {
    const doc = el.ownerDocument || document;
    const win = doc.defaultView || window;
    const rect = (typeof el.getBoundingClientRect === 'function') ? el.getBoundingClientRect() : { left: 10, top: 10, width: 20, height: 20 };
    const clientX = Math.max(1, (rect.left || 0) + (rect.width || 20) / 2);
    const clientY = Math.max(1, (rect.top || 0) + (rect.height || 20) / 2);

    const eventInit = {
      bubbles: true,
      cancelable: true,
      view: win,
      clientX: clientX,
      clientY: clientY,
      button: 0,
      buttons: 1
    };

    if (typeof win.PointerEvent !== 'undefined') {
      try { el.dispatchEvent(new win.PointerEvent('pointerdown', eventInit)); } catch (e) {}
    }
    if (typeof win.MouseEvent !== 'undefined') {
      try { el.dispatchEvent(new win.MouseEvent('mousedown', eventInit)); } catch (e) {}
    }
    if (typeof win.PointerEvent !== 'undefined') {
      try { el.dispatchEvent(new win.PointerEvent('pointerup', eventInit)); } catch (e) {}
    }
    if (typeof win.MouseEvent !== 'undefined') {
      try { el.dispatchEvent(new win.MouseEvent('mouseup', eventInit)); } catch (e) {}
      try { el.dispatchEvent(new win.MouseEvent('click', eventInit)); } catch (e) {}
    }
    if (typeof el.click === 'function') {
      el.click();
    }
    // Also trigger on parent if el is svg/path/icon span
    if (el.parentElement && (el.tagName.toLowerCase() === 'svg' || el.tagName.toLowerCase() === 'path' || el.tagName.toLowerCase() === 'use')) {
      if (typeof el.parentElement.click === 'function') {
        el.parentElement.click();
      }
    }

    // Trigger React internal click handler directly if attached
    const targets = [el, el.parentElement].filter(Boolean);
    for (const t of targets) {
      for (const key in t) {
        if (key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$')) {
          const props = t[key];
          if (props && typeof props.onClick === 'function') {
            try { props.onClick({ stopPropagation: () => {}, preventDefault: () => {}, target: t, currentTarget: t }); } catch (re) {}
          }
        }
      }
    }
  } catch (e) {
    try {
      if (typeof el.click === 'function') el.click();
    } catch (e2) {}
  }
}

/**
 * Searches and clicks eye icons inside a container to reveal plaintext contact info.
 * Enforces strict Zero-Tab guarantee: intercepts window.open on both current and top window and ignores all links.
 * Scopes strictly to shipping address / customer card body (NOT header) to ensure chat links are never touched.
 */
async function unmaskEyeIcons(container = null) {
  if (!container) {
    container = (typeof document !== 'undefined' ? document : null);
  }
  if (!container || !container.querySelectorAll) return 0;
  
  // Narrow down to the shipping address card if possible
  const customerCard = findCustomerCardContainer(container);
  const targetArea = customerCard || container;

  // Intercept window.open on BOTH current window and top window
  const curWin = targetArea.ownerDocument?.defaultView || targetArea.defaultView || (typeof window !== 'undefined' ? window : null);
  const topWin = (typeof window !== 'undefined' && window.top) ? window.top : curWin;

  let origCurOpen = curWin ? curWin.open : null;
  let origTopOpen = topWin ? topWin.open : null;

  if (curWin) {
    curWin.open = () => {
      console.log('[ADDP Zero-Tab Shield] Blocked popup/tab open in current window during unmask');
      return null;
    };
  }
  if (topWin && topWin !== curWin) {
    try {
      topWin.open = () => {
        console.log('[ADDP Zero-Tab Shield] Blocked popup/tab open in top window during unmask');
        return null;
      };
    } catch (e) {}
  }

  let clickedCount = 0;
  try {
    const clickedSet = new Set();

    // Strategy 1: Targeted unmasking of elements displaying asterisks '*'
    const allEls = Array.from(targetArea.querySelectorAll('*'));
    for (const el of allEls) {
      const txt = (el.textContent || '');
      // Only target text containing masked phone or asterisks
      if (txt.includes('*') && el.children.length <= 4) {
        const candidates = Array.from(el.querySelectorAll('svg, button, [role="button"], span.arco-icon, span.semi-icon, [class*="icon"], [class*="eye"]'));
        if (el.parentElement) {
          const sibs = Array.from(el.parentElement.children).filter(c => c !== el);
          for (const s of sibs) {
            // Strictly require candidate to be an eye icon or contain an eye icon
            if (isRealEyeIcon(s) || (s.querySelector && s.querySelector('[class*="eye"], svg'))) {
              candidates.push(s);
            }
          }
        }

        for (const c of candidates) {
          if (isForbiddenElement(c)) continue;
          if (!isRealEyeIcon(c)) {
            // Check if inner element is an eye icon
            const innerEye = c.querySelector ? c.querySelector('[class*="eye"], svg') : null;
            if (!innerEye || !isRealEyeIcon(innerEye)) continue;
          }
          const target = (typeof c.closest === 'function' ? c.closest('button, [role="button"], span.arco-icon, span.semi-icon') : null) || c;
          if (clickedSet.has(target) || isForbiddenElement(target)) continue;
          clickedSet.add(target);
          triggerRealReactClick(target);
          clickedCount++;
        }
      }
    }

    // Strategy 2: Query standard eye icon selectors inside customer card
    const generalCandidates = Array.from(targetArea.querySelectorAll(
      'svg, .arco-icon, .semi-icon, [class*="icon-eye"], [class*="iconEye"], [data-icon*="eye" i], [aria-label*="hiển thị" i], [title*="hiển thị" i], [aria-label*="mở mắt" i], [title*="mở mắt" i], button'
    ));
    for (const el of generalCandidates) {
      if (isForbiddenElement(el)) continue;
      const targetEl = (typeof el.closest === 'function' ? el.closest('button, [role="button"], span.arco-icon, span.semi-icon') : null) || el;
      if (clickedSet.has(targetEl) || isForbiddenElement(targetEl)) continue;
      if (isRealEyeIcon(el) || (targetEl !== el && isRealEyeIcon(targetEl))) {
        clickedSet.add(targetEl);
        triggerRealReactClick(targetEl);
        clickedCount++;
      }
    }

    if (clickedCount > 0) {
      await new Promise(r => setTimeout(r, 600));
    }
  } finally {
    if (curWin && origCurOpen) curWin.open = origCurOpen;
    if (topWin && origTopOpen) {
      try { topWin.open = origTopOpen; } catch (e) {}
    }
  }

  return clickedCount;
}

/**
 * Validates that an extracted string is genuinely a recipient human name.
 * Strictly filters out TikTok encrypted proxy emails (e.g. v4bGVU6O...scs2.tiktok.com), UI labels, and hashes.
 */
function isCleanRecipientName(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (s.length < 2 || s.length > 50) return false;

  // Never an email or URL (strictly blocks v4bGVU6O6XRGXQNENVPMAXNLH3R2Y@scs2.tiktok.com)
  if (s.includes('@') || s.includes('.com') || s.includes('.vn') || s.includes('.net') || s.includes('http') || s.includes('www.')) return false;

  // Never a long continuous token or proxy hash without spaces (e.g. v4bGVU6O6XRGXQNENVPMAXNLH3R2Y)
  if (!s.includes(' ') && s.length >= 16) return false;

  // Never a UI label, section title, or system keyword
  const forbiddenLabels = [
    'chi tiết', 'địa chỉ', 'giao hàng', 'khách hàng', 'tên người dùng', 'người nhận',
    'thông tin', 'liên hệ', 'người mua', 'đơn hàng', 'mã đơn', 'order', 'shipping',
    'customer', 'address', 'recipient', 'buyer', 'username', 'trò chuyện', 'tin nhắn',
    'đang giao', 'chờ vận chuyển', 'đã giao', 'đã hủy', 'hoàn tiền', 'trả hàng',
    'chờ lấy hàng', 'sắp xếp', 'thu nhập', 'tổng cộng', 'tổng tiền', 'sản phẩm', 'kiện hàng',
    'xem thêm', 'chi tiết khách hàng', 'địa chỉ giao hàng', 'tên người dùng', 'sao chép', 'copy'
  ];
  const sLower = s.toLowerCase();
  for (const label of forbiddenLabels) {
    if (sLower === label || sLower.startsWith(label + ':') || sLower.startsWith(label + ' :')) {
      return false;
    }
  }

  // Never currency or price or phone pattern
  if (s.includes('₫') || s.includes('đ') || s.toLowerCase().includes('vnd')) return false;
  if (s.match(/(?:\(\+84\)|0|\+84)[0-9*]{6,15}/)) return false;

  // Must contain at least one letter (Vietnamese or Latin alphabet)
  if (!/[a-zA-ZÀ-ỹ]/.test(s)) return false;

  return true;
}

/**
 * Parses customer details from Order Detail page DOM.
 */
function parseUnmaskedCustomerDetail(root = (typeof document !== 'undefined' ? document : null), fallbackOrderId = '') {
  if (!root || !root.querySelectorAll) {
    return { success: false, error: 'ROOT_INVALID' };
  }

  // 1. Order ID
  let orderId = fallbackOrderId || '';
  if (!orderId && root.defaultView && root.defaultView.location) {
    const urlMatch = root.defaultView.location.href.match(/order_no=([0-9]+)/i);
    if (urlMatch) orderId = urlMatch[1];
  }
  if (!orderId && typeof window !== 'undefined' && window.location) {
    const urlMatch = window.location.href.match(/order_no=([0-9]+)/i);
    if (urlMatch) orderId = urlMatch[1];
  }
  if (!orderId) {
    const textContent = root.body ? root.body.innerText : (root.innerText || '');
    const idMatch = textContent.match(/(?:Mã đơn|ID đơn hàng|Order ID)[\s:]*([0-9]{15,22})/i);
    if (idMatch) orderId = idMatch[1];
  }

  // 2. Locate Customer / Shipping Section
  let targetContainer = null;
  const headings = Array.from(root.querySelectorAll('div, span, h2, h3, h4, h5, p'));
  for (const h of headings) {
    const t = (h.textContent || '').trim();
    if (t === 'Địa chỉ giao hàng' || t === 'Shipping Address' || t === 'Chi tiết khách hàng' || t === 'Customer Details') {
      targetContainer = (typeof h.closest === 'function' ? h.closest('.arco-card, .semi-card, [class*="card"], [class*="section"], [class*="container"], [class*="wrapper"]') : null) || h.parentElement;
      if (t === 'Địa chỉ giao hàng' || t === 'Shipping Address') {
        break; // Priority match on Shipping Address card
      }
    }
  }
  if (!targetContainer) targetContainer = root.body || root;

  const containerText = targetContainer.innerText || targetContainer.textContent || '';
  const lines = containerText.split('\n').map(l => l.trim()).filter(l => l !== '');

  // 3. Extract Phone
  let phone = '';
  let phoneLineIdx = -1;
  const phoneRegex = /(?:\(\+84\)\s*|\+84\s*|0)[0-9*\s.-]{8,18}/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(phoneRegex);
    if (m) {
      const candidate = m[0].trim();
      const numDigits = (candidate.match(/[0-9*]/g) || []).length;
      if (numDigits >= 8 && numDigits <= 15) {
        phone = candidate.replace(/\s+/g, ' ');
        phoneLineIdx = i;
        break;
      }
    }
  }

  // 4. Extract Recipient Name
  let recipientName = '';

  // Priority 4a: Look specifically under "Địa chỉ giao hàng" header
  const addrHeaderIdx = lines.findIndex(l => l === 'Địa chỉ giao hàng' || l === 'Shipping Address' || l.includes('Địa chỉ giao hàng'));
  if (addrHeaderIdx !== -1) {
    for (let i = addrHeaderIdx + 1; i <= Math.min(lines.length - 1, addrHeaderIdx + 3); i++) {
      if (isCleanRecipientName(lines[i])) {
        recipientName = lines[i];
        break;
      }
    }
  }

  // Priority 4b: Check line immediately preceding phone
  if (!recipientName && phoneLineIdx > 0) {
    for (let i = phoneLineIdx - 1; i >= Math.max(0, phoneLineIdx - 3); i--) {
      if (isCleanRecipientName(lines[i])) {
        recipientName = lines[i];
        break;
      }
    }
  }

  // Priority 4c: Scan all lines in target container for first valid clean name
  if (!recipientName) {
    for (const line of lines) {
      if (isCleanRecipientName(line)) {
        recipientName = line;
        break;
      }
    }
  }

  // 5. Extract Address
  let address = '';
  if (phoneLineIdx !== -1 && phoneLineIdx + 1 < lines.length) {
    const addrParts = [];
    for (let i = phoneLineIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.includes('Số tiền') || l.includes('Chi tiết đơn') || l.includes('Lịch sử') || 
          l.includes('Sản phẩm') || l.includes('Kiện hàng') || l.includes('Thu nhập') ||
          l.includes('Phương thức thanh toán') || l.includes('Ghi chú') || l.includes('Thời gian tạo')) {
        break;
      }
      if (l.toLowerCase() === 'sao chép' || l.toLowerCase() === 'copy' || l.length <= 2) {
        continue;
      }
      addrParts.push(l);
    }
    address = addrParts.join(', ');
  }
  if (!address && addrHeaderIdx !== -1) {
    const addrParts = [];
    for (let i = addrHeaderIdx + 1; i < Math.min(lines.length, addrHeaderIdx + 8); i++) {
      const l = lines[i];
      if (l === recipientName || l.match(phoneRegex)) continue;
      if (l.includes('Số tiền') || l.includes('Chi tiết đơn') || l.includes('Sản phẩm') || l.length <= 2) break;
      addrParts.push(l);
    }
    if (addrParts.length > 0) {
      address = addrParts.join(', ');
    }
  }

  // 6. Extract Order Status
  const bodyText = root.body ? root.body.innerText : (root.innerText || '');
  let orderStatus = 'AWAITING_SHIPMENT';
  if (bodyText.includes('Đang chờ vận chuyển') || bodyText.includes('Sắp xếp vận chuyển') || bodyText.includes('Chờ lấy hàng')) {
    orderStatus = 'AWAITING_SHIPMENT';
  } else if (bodyText.includes('Đang giao') || bodyText.includes('Đang vận chuyển')) {
    orderStatus = 'IN_TRANSIT';
  } else if (bodyText.includes('Đã giao') || bodyText.includes('Hoàn thành')) {
    orderStatus = 'DELIVERED';
  } else if (bodyText.includes('Đã hủy')) {
    orderStatus = 'CANCELLED';
  }

  // 7. Order Amount
  let amount = 0;
  const amtMatch = bodyText.match(/(?:Tổng cộng|Tổng tiền|Total|Thu nhập ước tính)[\s:]*([0-9.,]+)\s*(?:[₫đ]|VND)?/i) ||
                   bodyText.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)\s*(?:[₫đ]|VND)/);
  if (amtMatch) {
    amount = parseVietnameseNumber(amtMatch[1]) || 0;
  }

  // 8. Order Creation Time
  let orderTime = '';
  const timeMatch = bodyText.match(/(?:Đơn hàng do khách hàng tạo|Thời gian đặt hàng|Thời gian tạo|Order time|Created at)[\s:]*([0-9]{1,4}[-/][0-9]{1,2}[-/][0-9]{2,4}\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/i) ||
                    bodyText.match(/([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}\s+[0-9]{1,2}:[0-9]{2}:[0-9]{2})/);
  if (timeMatch) {
    orderTime = timeMatch[1].trim();
  }

  return {
    success: !!(orderId && (phone || recipientName)),
    order_id: orderId,
    recipient_name: recipientName,
    phone: phone,
    address: address,
    order_status: orderStatus,
    amount: amount,
    order_time: orderTime
  };
}

/**
 * Finds all visible order IDs on the order management list page.
 * Checks links, custom data attributes, Semi/Arco design classes, copy buttons, and text regex.
 */
function findAllOrderIdsOnPage() {
  const ids = [];
  const seen = new Set();

  function addId(val) {
    if (!val) return;
    const str = String(val).trim();
    // TikTok Shop order IDs are 15-22 digits, usually 18-20 digits starting with 5, 6, or 7
    const m = str.match(/\b([5-7][0-9]{16,21})\b/) || str.match(/\b([0-9]{15,22})\b/);
    if (m) {
      const id = m[1];
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }

  // 1. Order Links (a[href])
  try {
    const links = document.querySelectorAll('a[href*="order_no="], a[href*="order_id="], a[href*="/order/detail"], a[href*="/order/"]');
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/[?&](?:order_no|order_id)=([0-9]{15,22})/i) || href.match(/\/order\/(?:detail\/)?([0-9]{15,22})/i);
      if (m) addId(m[1]);
    }
  } catch (e) {}

  // 2. Data attributes
  try {
    const dataEls = document.querySelectorAll('[data-order-id], [data-order-no], [data-id], [data-row-key], [data-clipboard-text]');
    for (const el of dataEls) {
      addId(el.getAttribute('data-order-id'));
      addId(el.getAttribute('data-order-no'));
      addId(el.getAttribute('data-id'));
      addId(el.getAttribute('data-row-key'));
      addId(el.getAttribute('data-clipboard-text'));
    }
  } catch (e) {}

  // 3. Class names for order numbers
  try {
    const numEls = document.querySelectorAll('[class*="order-id"], [class*="order-no"], [class*="orderId"], [class*="orderNo"], [class*="order-number"]');
    for (const el of numEls) {
      addId(el.innerText || el.textContent);
    }
  } catch (e) {}

  // 4. Regex matches on document text
  try {
    const text = document.body ? document.body.innerText : '';
    const matches = Array.from(text.matchAll(/(?:ID đơn hàng|Mã đơn hàng|Mã đơn|Order ID)[\s:#]*([0-9]{15,22})/gi));
    for (const m of matches) {
      addId(m[1]);
    }
    // Direct match for all 18-20 digit order IDs (starts with 5, 6, 7)
    const directMatches = Array.from(text.matchAll(/\b([5-7][0-9]{17,19})\b/g));
    for (const m of directMatches) {
      addId(m[1]);
    }
  } catch (e) {}

  // 5. Cells, cards, and rows
  try {
    const cells = document.querySelectorAll('td, [class*="cell"], [class*="order-item"], [class*="order-card"], [class*="orderCard"], [class*="table-tr"], [class*="table-row"], tr');
    for (const c of cells) {
      const match = (c.innerText || '').match(/\b([5-7][0-9]{17,20})\b/);
      if (match) addId(match[1]);
    }
  } catch (e) {}

  return ids;
}

/**
 * Extracts visible order rows or card containers directly from the order list table.
 */
function extractOrdersFromOrderListTable() {
  const extracted = [];
  const seen = new Set();

  let containers = Array.from(document.querySelectorAll(
    'tr.arco-table-tr, tr.semi-table-row, tbody tr, ' +
    'div[class*="orderCard"], div[class*="order-card"], ' +
    'div[class*="orderItem"], div[class*="order-item"], ' +
    'div[class*="orderRow"], div[class*="order-row"], ' +
    'div[class*="order-wrapper"], div[class*="orderWrapper"]'
  ));

  if (containers.length === 0) {
    const links = Array.from(document.querySelectorAll('a[href*="order_no="], a[href*="order_id="]'));
    const containerSet = new Set();
    for (const a of links) {
      const c = a.closest('tr, [class*="card"], [class*="item"], [class*="row"], [class*="panel"]') || a.parentElement?.parentElement;
      if (c) containerSet.add(c);
    }
    containers = Array.from(containerSet);
  }

  for (const row of containers) {
    const rowText = row.innerText || row.textContent || '';
    if (!rowText || rowText.length < 10) continue;

    // 1. Order ID
    let orderId = '';
    const link = row.querySelector('a[href*="order_no="], a[href*="order_id="]');
    if (link) {
      const href = link.getAttribute('href') || '';
      const m = href.match(/[?&](?:order_no|order_id)=([0-9]{15,22})/i);
      if (m) orderId = m[1];
    }
    if (!orderId) {
      const dataEl = row.querySelector('[data-order-id], [data-order-no], [data-clipboard-text]');
      if (dataEl) {
        const val = dataEl.getAttribute('data-order-id') || dataEl.getAttribute('data-order-no') || dataEl.getAttribute('data-clipboard-text');
        const m = (val || '').match(/\b([0-9]{15,22})\b/);
        if (m) orderId = m[1];
      }
    }
    if (!orderId) {
      const idMatch = rowText.match(/(?:ID đơn hàng|Mã đơn hàng|Mã đơn|Order ID)[\s:#]*([0-9]{15,22})/i) || rowText.match(/\b([5-7][0-9]{16,20})\b/);
      if (idMatch) orderId = idMatch[1];
    }

    if (!orderId || seen.has(orderId)) continue;

    // 2. Phone
    let phone = '';
    const phoneMatch = rowText.match(/(?:\(\+84\)|0|\+84)[0-9*]{8,15}/);
    if (phoneMatch) {
      phone = phoneMatch[0];
    }

    // 3. Recipient Name
    let recipientName = '';
    const buyerCell = row.querySelector('[class*="buyer"], [class*="customer"], [class*="recipient"], td:nth-child(2), td:nth-child(3), td:nth-child(4)');
    if (buyerCell) {
      const lines = (buyerCell.innerText || '').split('\n').map(l => l.trim()).filter(l => l !== '');
      for (const line of lines) {
        if (isCleanRecipientName(line)) {
          recipientName = line;
          break;
        }
      }
    }
    if (!recipientName && phoneMatch) {
      const lines = rowText.split('\n').map(l => l.trim()).filter(l => l !== '');
      const pIdx = lines.findIndex(l => l.includes(phoneMatch[0]));
      if (pIdx > 0 && isCleanRecipientName(lines[pIdx - 1])) {
        recipientName = lines[pIdx - 1];
      }
    }

    // 4. Status
    let orderStatus = 'AWAITING_SHIPMENT';
    if (rowText.includes('Đang chờ vận chuyển') || rowText.includes('Sắp xếp vận chuyển') || rowText.includes('Chờ lấy hàng')) {
      orderStatus = 'AWAITING_SHIPMENT';
    } else if (rowText.includes('Đang giao') || rowText.includes('Đang vận chuyển')) {
      orderStatus = 'IN_TRANSIT';
    } else if (rowText.includes('Đã giao') || rowText.includes('Hoàn thành')) {
      orderStatus = 'DELIVERED';
    } else if (rowText.includes('Đã hủy')) {
      orderStatus = 'CANCELLED';
    }

    // 5. Amount
    let amount = 0;
    const amtMatch = rowText.match(/(?:Tổng cộng|Tổng tiền|Total|₫|đ)[\s:]*([0-9.,]+)/i) || rowText.match(/([0-9]{1,3}(?:[.,][0-9]{3})+)\s*(?:[₫đ]|VND)?/);
    if (amtMatch) {
      amount = parseVietnameseNumber(amtMatch[1]) || 0;
    }

    // 6. Address
    let address = '';
    const addrMatch = rowText.match(/(?:Địa chỉ giao hàng|Địa chỉ|Address)[\s:]*([^\n]+)/i);
    if (addrMatch) {
      address = addrMatch[1].trim();
    } else {
      const provMatch = rowText.match(/(?:Hà Nội|TP\.? Hồ Chí Minh|Hồ Chí Minh|Đà Nẵng|Hải Phòng|Cần Thơ|Bình Dương|Đồng Nai|Bắc Ninh|Hải Dương|Hưng Yên|Thái Nguyên|Nam Định|Thái Bình|Quảng Ninh|Thanh Hóa|Nghệ An|Huế|Quảng Nam|Khánh Hòa|Bình Định|Lâm Đồng|Đắk Lắk|Tây Ninh|Long An|Tiền Giang|Bến Tre|Vĩnh Long|An Giang|Kiên Giang|Cà Mau)/i);
      if (provMatch) {
        address = provMatch[0];
      }
    }

    const isUnmasked = !!(phone && !phone.includes('*'));

    seen.add(orderId);
    extracted.push({
      order_id: orderId,
      recipient_name: recipientName,
      phone: phone,
      address: address,
      order_status: orderStatus,
      amount: amount,
      is_unmasked: isUnmasked
    });
  }

  return extracted;
}

/**
 * Sends captured order details to Marketing ADDP server.
 */
async function sendCapturedCustomerToServer(orderData) {
  const apiUrl = 'https://marketing.addp.vn/api/capture_customer_order.php';
  try {
    let connectorToken = null;
    let shopId = null;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['connector_token', 'shop_id']);
      connectorToken = stored.connector_token;
      shopId = stored.shop_id;
    }

    const payload = {
      shop_id: shopId || '7495657895504611503',
      orders: Array.isArray(orderData) ? orderData : [orderData]
    };

    const headers = { 'Content-Type': 'application/json' };
    if (connectorToken) {
      headers['Authorization'] = `Bearer ${connectorToken}`;
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    const resData = await res.json();
    return resData;
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Displays a non-intrusive floating toast notification for background actions.
 */
function showAddpToast(msg, isSuccess = true) {
  if (typeof document === 'undefined' || !document.body || typeof document.getElementById !== 'function') return;
  let toast = document.getElementById('addp-toast-notice');
  if (!toast) {
    if (typeof document.createElement !== 'function') return;
    toast = document.createElement('div');
    toast.id = 'addp-toast-notice';
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 10000000;
      background: rgba(15, 23, 42, 0.95);
      border-radius: 10px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    document.body.appendChild(toast);
  }
  toast.style.color = isSuccess ? '#34d399' : '#f87171';
  toast.style.border = isSuccess ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid rgba(248, 113, 113, 0.5)';
  toast.innerHTML = `<span>${msg}</span>`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => { if (typeof toast.remove === 'function') toast.remove(); }, 400);
    }
  }, 4000);
}

// ====================================================
// STATE & SCANNING ENGINE
// ====================================================
const sessionCapturedOrders = new Set();
let isScanRunning = false;
let autoScanEnabled = false;

// Load auto-scan setting from storage (default: false, requiring explicit opt-in)
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['addp_auto_scan'], (res) => {
    if (res && res.addp_auto_scan !== undefined) {
      autoScanEnabled = !!res.addp_auto_scan;
    }
  });
}

/**
 * Updates floating widget UI elements.
 */
function updateWidgetStatus(state) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const widget = document.getElementById('addp-seller-customer-widget');
  if (!widget) return;
  const statusEl = widget.querySelector('#addp-widget-status');
  const progressBar = widget.querySelector('#addp-widget-progress-bar');
  const progressContainer = widget.querySelector('#addp-widget-progress-container');
  const btnAction = widget.querySelector('#addp-widget-action');

  if (state.progressPct !== undefined && progressContainer && progressBar) {
    progressContainer.style.display = 'block';
    progressBar.style.width = `${state.progressPct}%`;
  }

  if (state.btnText && btnAction) {
    btnAction.textContent = state.btnText;
  }
  if (state.btnDisabled !== undefined && btnAction) {
    btnAction.disabled = state.btnDisabled;
  }

  if (state.statusHtml && statusEl) {
    statusEl.innerHTML = state.statusHtml;
  }
}

let currentBatchCanceled = false;

/**
 * Helper: Find the DOM row or card container of an order on the order list page
 */
function findOrderRow(orderId) {
  if (!orderId) return null;
  try {
    const row = document.querySelector(`[data-row-key*="${orderId}"], [data-order-id*="${orderId}"], [data-id*="${orderId}"]`);
    if (row) return row;

    const candidates = document.querySelectorAll('tr, .arco-table-tr, .semi-table-row, [class*="table-tr"], [class*="table-row"], [class*="order-card"], [class*="order-item"]');
    for (const c of candidates) {
      if ((c.innerText || c.textContent || '').includes(orderId)) {
        return c;
      }
    }
  } catch (e) {}
  return null;
}

// Persistent set of already-scanned order IDs to skip on future runs
const persistentScannedOrders = new Set();
let isPersistentCacheLoaded = false;

/**
 * Initializes persistent scanned orders from local storage and backend API.
 */
async function initPersistentScannedOrders() {
  if (isPersistentCacheLoaded && persistentScannedOrders.size > 0) return;
  // 1. Load from chrome.storage.local
  let connectorToken = null;
  let shopId = '7495657895504611503';
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['addp_scanned_order_ids', 'connector_token', 'shop_id']);
      if (Array.isArray(stored.addp_scanned_order_ids)) {
        stored.addp_scanned_order_ids.forEach(id => persistentScannedOrders.add(String(id)));
      }
      if (stored.connector_token) connectorToken = stored.connector_token;
      if (stored.shop_id) shopId = stored.shop_id;
    }
  } catch (e) {}

  // 2. Fetch already captured order IDs from server database
  try {
    const fetchHeaders = {};
    if (connectorToken) {
      fetchHeaders['Authorization'] = `Bearer ${connectorToken}`;
    }
    const res = await fetch(`https://marketing.addp.vn/api/capture_customer_order.php?action=get_unmasked_order_ids&shop_id=${encodeURIComponent(shopId)}`, {
      headers: fetchHeaders
    });
    const data = await res.json();
    if (data && data.success && Array.isArray(data.order_ids)) {
      data.order_ids.forEach(id => persistentScannedOrders.add(String(id)));
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ addp_scanned_order_ids: Array.from(persistentScannedOrders) });
      }
    }
  } catch (e) {
    console.warn('[ADDP Zero-Tab] Could not fetch unmasked order IDs from server:', e);
  }

  isPersistentCacheLoaded = true;
  console.log(`[ADDP Zero-Tab] Initialized cache with ${persistentScannedOrders.size} already scanned order IDs.`);
}

/**
 * Saves a newly captured order ID to persistent cache.
 */
function saveScannedOrderId(orderId) {
  if (!orderId) return;
  persistentScannedOrders.add(String(orderId));
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ addp_scanned_order_ids: Array.from(persistentScannedOrders) });
    }
  } catch (e) {}
}

/**
 * Extracts raw date/time string from text on order row or detail card.
 */
function extractOrderDateFromText(text) {
  if (!text) return null;
  // 1. Relative text: "27 phút trước", "2 giờ trước", "3 ngày trước", "vừa xong", "hôm nay", "hôm qua"
  const rel = text.match(/(\d+\s*(?:phút|giờ|ngày)\s*trước|vừa xong|hôm nay|hôm qua)/i);
  if (rel) return rel[1].trim();

  // 2. Full date format "YYYY-MM-DD" or "DD/MM/YYYY" or "DD-MM-YYYY"
  const dmy = text.match(/\b([0-3]?\d[\/\-][0-1]?\d[\/\-]202\d|\b202\d[\/\-][0-1]?\d[\/\-][0-3]?\d)\b/);
  if (dmy) return dmy[1].trim();

  // 3. Short date with time e.g. "15/10 14:20" or "01/10 09:30"
  const shortDmy = text.match(/\b([0-3]?\d[\/\-][0-1]?\d)(?:\s+\d{1,2}:\d{2})?\b/);
  if (shortDmy) return shortDmy[0].trim();

  return null;
}

/**
 * Extracts order creation date from inside the iframe detail page.
 */
function extractOrderDateFromIframe(doc) {
  if (!doc) return null;
  const text = doc.body ? doc.body.textContent || '' : '';
  const m = text.match(/(?:Thời gian đặt hàng|Thời gian tạo đơn|Thời gian tạo|Order Time|Created Time)[\s:]*([^\n\r,]+)/i);
  if (m) {
    const raw = m[1].trim();
    return extractOrderDateFromText(raw) || raw;
  }
  return extractOrderDateFromText(text);
}

/**
 * Checks whether an order's date is strictly BEFORE the cutoff date (default: '2026-10-01').
 * Returns true if the order was created in September 2026 or earlier -> STOP scanning!
 */
function isOrderBeforeCutoffDate(dateText, cutoffDateStr = '2026-10-01') {
  if (!dateText) return false;
  const cutoff = new Date(cutoffDateStr + 'T00:00:00');
  const now = new Date();
  const lower = dateText.trim().toLowerCase();

  // 1. Relative: minutes, hours, vừa xong, hôm nay -> October 2026 -> NOT before cutoff
  if (lower.includes('phút trước') || lower.includes('giờ trước') || lower.includes('vừa xong') || lower.includes('hôm nay')) {
    return false;
  }

  // 2. Relative: hôm qua
  if (lower.includes('hôm qua')) {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return y < cutoff;
  }

  // 3. Relative: X ngày trước
  const daysMatch = lower.match(/(\d+)\s*ngày\s*trước/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const d = new Date(now);
    d.setDate(now.getDate() - days);
    return d < cutoff;
  }

  // 4. Absolute "DD/MM/YYYY" or "DD-MM-YYYY"
  const dmyMatch = lower.match(/\b([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](202\d)\b/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    return d < cutoff;
  }

  // 5. Absolute "YYYY-MM-DD" or "YYYY/MM/DD"
  const ymdMatch = lower.match(/\b(202\d)[\/\-]([0-1]?\d)[\/\-]([0-3]?\d)\b/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    return d < cutoff;
  }

  // 6. Absolute "DD/MM" (assume current year 2026)
  const dmMatch = lower.match(/\b([0-3]?\d)[\/\-]([0-1]?\d)\b/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = parseInt(dmMatch[2], 10) - 1;
    const year = now.getFullYear();
    const d = new Date(year, month, day);
    return d < cutoff;
  }

  return false;
}

/**
 * Transitions to the next page in TikTok Seller Center order list pagination.
 * Supports Arco Design, Semi Design, page numbers, and chevron next.
 */
async function transitionToNextPage(prevFirstOrderId, currentPage) {
  const nextPageNum = currentPage + 1;
  console.log(`[ADDP Zero-Tab] Attempting navigation from Page ${currentPage} to Page ${nextPageNum}...`);

  // Strategy 1: Find pagination button/li with text matching next page number (e.g. "2")
  const allPageItems = Array.from(document.querySelectorAll('.arco-pagination-item, .semi-page-item, [class*="pagination"] li, [class*="pager"] li, [class*="pagination"] button, [class*="pager"] button'));
  let targetPageBtn = null;
  for (const item of allPageItems) {
    const text = (item.innerText || item.textContent || '').trim();
    if (text === String(nextPageNum)) {
      targetPageBtn = item;
      break;
    }
  }

  // Strategy 2: Find next chevron / button
  if (!targetPageBtn) {
    const nextSelectors = [
      '.arco-pagination-item-next:not(.arco-pagination-item-disabled)',
      '.semi-page-item-next:not(.semi-page-item-disabled)',
      '[class*="pagination-item-next"]:not([class*="disabled"])',
      '[class*="pagination-next"]:not([class*="disabled"])',
      '[class*="pager-next"]:not([class*="disabled"])',
      'li[title="Next Page"]:not([class*="disabled"])',
      'li[title="Trang sau"]:not([class*="disabled"])',
      'li[title*="tiếp" i]:not([class*="disabled"])',
      '[aria-label*="Next" i]:not([aria-disabled="true"])',
      '[aria-label*="Trang tiếp" i]:not([aria-disabled="true"])',
      '[aria-label*="trang sau" i]:not([aria-disabled="true"])',
      '[data-tid="m4b_pagination_next"]:not([disabled])'
    ];
    for (const sel of nextSelectors) {
      const el = document.querySelector(sel);
      if (el && !el.disabled && !el.classList.contains('arco-pagination-item-disabled') && el.getAttribute('aria-disabled') !== 'true') {
        targetPageBtn = el;
        break;
      }
    }
  }

  // Strategy 3: Find next arrow within pagination container
  if (!targetPageBtn) {
    const pag = document.querySelector('.arco-pagination, .semi-pagination, [class*="pagination"], [class*="pager"]');
    if (pag) {
      const active = pag.querySelector('.arco-pagination-item-active, .semi-page-item-active, [class*="active"]');
      if (active && active.nextElementSibling && !active.nextElementSibling.classList.contains('arco-pagination-item-disabled')) {
        targetPageBtn = active.nextElementSibling;
      }
    }
  }

  if (!targetPageBtn) {
    console.warn(`[ADDP Zero-Tab] Next page button not found for Page ${nextPageNum}. Reached end of pagination.`);
    return false;
  }

  // Scroll into view & click
  try {
    targetPageBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {}

  targetPageBtn.click();
  const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
  targetPageBtn.dispatchEvent(evt);

  // Poll for table refresh (order IDs change or active page number changes)
  const startTime = Date.now();
  let changed = false;
  while (Date.now() - startTime < 10000) {
    await new Promise(r => setTimeout(r, 400));
    const currentIds = findAllOrderIdsOnPage();
    if (currentIds.length > 0 && currentIds[0] !== prevFirstOrderId) {
      changed = true;
      break;
    }
    const activeItem = document.querySelector('.arco-pagination-item-active, .semi-page-item-active, [class*="pagination"] [class*="active"]');
    if (activeItem && (activeItem.innerText || activeItem.textContent || '').trim() === String(nextPageNum)) {
      changed = true;
      break;
    }
  }

  return changed;
}

/**
 * Executes background sequential scan for orders on a single page using a hidden iframe.
 * Stop criterion: Halts when an order created before 01/10/2026 is encountered.
 * Fast deduplication: Orders already in persistent cache are skipped immediately without loading iframe.
 */
async function runSilentIframeBatchScan(orderIds, pageNum = 1, cumulativeCaptured = 0) {
  const total = orderIds.length;
  let capturedCount = 0;
  let skippedCount = 0;

  // 1. Get or create hidden sandbox iframe
  let iframe = document.getElementById('addp-silent-crawler-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'addp-silent-crawler-frame';
    iframe.style.cssText = 'position:fixed; bottom:0; right:0; width:1280px; height:800px; opacity:0.01; pointer-events:auto; border:none; z-index:-1;';
    document.body.appendChild(iframe);
  }

  // Defend top window against any popup or tab opening during entire batch scan
  const origWindowOpen = window.open;
  window.open = () => {
    console.log('[ADDP Zero-Tab Shield] Blocked top window.open during batch scan');
    return null;
  };

  try {
    for (let i = 0; i < total; i++) {
      if (currentBatchCanceled) {
        console.log('[ADDP Zero-Tab Crawler] Scan canceled by user.');
        break;
      }

      const orderId = orderIds[i];
      const pct = Math.round(((i + 1) / total) * 100);

      // FAST DEDUPLICATION: If order is already in persistent scanned cache, skip immediately
      if (persistentScannedOrders.has(String(orderId))) {
        skippedCount++;
        sessionCapturedOrders.add(orderId);
        updateWidgetStatus({
          progressPct: pct,
          btnText: `⏳ Trang ${pageNum}: [${i + 1}/${total}]...`,
          statusHtml: `⏭️ [Trang ${pageNum} | ${i + 1}/${total}] Đơn <strong style="color:#94a3b8;">${orderId}</strong>: Đã quét trước đó (Bỏ qua nhanh)...`
        });
        continue;
      }

      // CHECK CUTOFF DATE ON ROW: Stop if created before 01/10/2026
      const rowEl = findOrderRow(orderId);
      if (rowEl) {
        const rowDate = extractOrderDateFromText(rowEl.innerText || rowEl.textContent);
        if (rowDate && isOrderBeforeCutoffDate(rowDate, '2026-10-01')) {
          console.log(`[ADDP Zero-Tab Crawler] Order ${orderId} on Page ${pageNum} date (${rowDate}) is before 01/10/2026 cutoff. Stopping scan.`);
          showAddpToast(`🛑 Phát hiện đơn hàng #${orderId} tạo ngày ${rowDate} (trước mốc 01/10/2026). Đã hoàn tất quét toàn bộ đơn từ mốc 01/10!`, true);
          return {
            captured: capturedCount,
            dateCutoffEncountered: true,
            cutoffDate: rowDate,
            lastOrderId: orderId
          };
        }
      }

      updateWidgetStatus({
        progressPct: pct,
        btnText: `⏳ Trang ${pageNum}: [${i + 1}/${total}]...`,
        statusHtml: `Đang mở mắt ngầm đơn <strong style="color:#00f2fe;">${orderId}</strong> (Trang ${pageNum} - ${i + 1}/${total})...`
      });

      try {
        const targetUrl = `https://seller-vn.tiktok.com/order/detail?order_no=${orderId}&shop_region=VN`;

        // Wait for iframe navigation & load
        await new Promise((resolve) => {
          let loaded = false;
          const timer = setTimeout(() => {
            if (!loaded) {
              loaded = true;
              resolve();
            }
          }, 7000);

          iframe.onload = () => {
            if (!loaded) {
              loaded = true;
              clearTimeout(timer);
              resolve();
            }
          };
          iframe.src = targetUrl;
        });

        // Defend against any popup or tab opening from inside iframe or top window
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.open = () => null;
            if (iframe.contentWindow.top) iframe.contentWindow.top.open = () => null;
            if (iframe.contentWindow.parent) iframe.contentWindow.parent.open = () => null;
          }
        } catch (e) {}

        const iframeDoc = iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
        if (!iframeDoc) {
          skippedCount++;
          continue;
        }

        // Proactively prevent any link clicks from navigating or opening tabs inside iframe
        try {
          iframeDoc.addEventListener('click', (ev) => {
            const lk = ev.target && ev.target.closest ? ev.target.closest('a, [data-href], [target], [class*="message"], [class*="chat"], [class*="buyer"]') : null;
            if (lk) {
              ev.preventDefault();
              ev.stopPropagation();
              ev.stopImmediatePropagation();
              return false;
            }
          }, true);
        } catch (e) {}

        // Check date inside iframe detail page
        const iframeDate = extractOrderDateFromIframe(iframeDoc);
        if (iframeDate && isOrderBeforeCutoffDate(iframeDate, '2026-10-01')) {
          console.log(`[ADDP Zero-Tab Crawler] Order detail ${orderId} date (${iframeDate}) is before 01/10/2026 cutoff. Stopping scan.`);
          showAddpToast(`🛑 Đơn hàng #${orderId} tạo ngày ${iframeDate} (trước mốc 01/10/2026). Đã dừng quét vì đạt mốc thời gian!`, true);
          return {
            captured: capturedCount,
            dateCutoffEncountered: true,
            cutoffDate: iframeDate,
            lastOrderId: orderId
          };
        }

        // Poll until customer card or order detail is rendered
        let domReady = false;
        for (let attempt = 0; attempt < 18; attempt++) {
          if (currentBatchCanceled) break;
          const card = findCustomerCardContainer(iframeDoc);
          const text = card ? (card.textContent || '') : (iframeDoc.body ? iframeDoc.body.textContent || '' : '');
          if (text.includes('Chi tiết khách hàng') || text.includes('Địa chỉ giao hàng') || text.includes('Customer Details') || text.includes('Shipping Address')) {
            domReady = true;
            break;
          }
          await new Promise(r => setTimeout(r, 250));
        }

        if (!domReady) {
          skippedCount++;
          sessionCapturedOrders.add(orderId);
          saveScannedOrderId(orderId);
          continue;
        }

        // Unmask eye icons in iframe document
        await unmaskEyeIcons(iframeDoc);
        await new Promise(r => setTimeout(r, 600));

        // Parse unmasked customer detail
        let detail = parseUnmaskedCustomerDetail(iframeDoc, orderId);

        // Retry unmasking once if phone still masked
        if (detail && detail.phone && detail.phone.includes('*')) {
          await unmaskEyeIcons(iframeDoc);
          await new Promise(r => setTimeout(r, 700));
          detail = parseUnmaskedCustomerDetail(iframeDoc, orderId);
        }

        const isUnmasked = !!(detail && detail.phone && !detail.phone.includes('*'));

        if (detail && (detail.phone || detail.recipient_name)) {
          await sendCapturedCustomerToServer(detail);
          sessionCapturedOrders.add(orderId);
          saveScannedOrderId(orderId);
          capturedCount++;

          const name = detail.recipient_name || 'Khách Hàng';
          const phone = detail.phone || '';
          const unmaskLabel = isUnmasked ? '🟢 SĐT Thật' : '⚠️ SĐT Che';
          const grandTotal = cumulativeCaptured + capturedCount;

          updateWidgetStatus({
            progressPct: pct,
            statusHtml: `✅ [Trang ${pageNum} | ${i + 1}/${total}] (Tổng: ${grandTotal}) ${unmaskLabel}: <strong style="color:#34d399;">${name}</strong> (${phone})`
          });
          showAddpToast(`🟢 [Trang ${pageNum} | Đơn #${grandTotal}] ${unmaskLabel}: ${name} (${phone})`, isUnmasked);
        } else {
          skippedCount++;
          sessionCapturedOrders.add(orderId);
          saveScannedOrderId(orderId);
          updateWidgetStatus({
            progressPct: pct,
            statusHtml: `⏭️ [Trang ${pageNum} | ${i + 1}/${total}] Đơn ${orderId}: Không tìm thấy thông tin.`
          });
        }

        // Polite rate limit jitter between requests (350ms)
        await new Promise(r => setTimeout(r, 350));

      } catch (orderErr) {
        console.warn(`[ADDP Zero-Tab Crawler] Error processing order ${orderId}:`, orderErr);
        skippedCount++;
      }
    }

    return {
      captured: capturedCount,
      dateCutoffEncountered: false,
      cutoffDate: null,
      lastOrderId: null
    };
  } finally {
    window.open = origWindowOpen;
  }
}

/**
 * Master multi-page order scanner orchestrator.
 * Scans all orders created from 01/10/2026 onwards across all pages.
 * Halts automatically when an order created before 01/10/2026 is reached.
 * Automatically skips previously scanned orders in 0s using persistent cache.
 */
async function runOrderListScan() {
  if (isScanRunning) return;
  isScanRunning = true;
  currentBatchCanceled = false;

  let currentPage = 1;
  let totalCaptured = 0;
  let stopReason = '';

  // Ensure persistent scanned orders cache is fully loaded from local storage and backend DB
  await initPersistentScannedOrders();

  showAddpToast(`🔍 Khởi động quét toàn bộ đơn từ ngày 01/10/2026 trở đi (tự động bỏ qua đơn cũ)...`);

  updateWidgetStatus({
    btnDisabled: false,
    btnText: '🛑 Dừng Quét',
    progressPct: 0,
    statusHtml: `🚀 Đang quét ngầm đa trang đơn từ 01/10/2026 (Bộ nhớ: ${persistentScannedOrders.size} đơn đã quét)...`
  });

  try {
    while (!currentBatchCanceled) {
      const allOrderIds = findAllOrderIdsOnPage();
      if (allOrderIds.length === 0) {
        stopReason = 'Không tìm thấy danh sách mã đơn hàng trên trang.';
        break;
      }

      const remainingIds = allOrderIds.filter(id => !sessionCapturedOrders.has(id));

      if (remainingIds.length > 0) {
        updateWidgetStatus({
          btnDisabled: false,
          btnText: '🛑 Dừng Quét',
          statusHtml: `🚀 Đang quét ngầm <strong>Trang ${currentPage}</strong> (${remainingIds.length} đơn trên trang, Đã lưu: ${totalCaptured})...`
        });

        const batchRes = await runSilentIframeBatchScan(remainingIds, currentPage, totalCaptured);
        totalCaptured += batchRes.captured;

        if (batchRes.dateCutoffEncountered) {
          stopReason = `🛑 Đã quét đến đơn #${batchRes.lastOrderId} tạo ngày ${batchRes.cutoffDate || ''} (trước mốc 01/10/2026). Toàn bộ đơn hàng từ ngày 01/10/2026 đã được quét và cập nhật thành công!`;
          break;
        }
      }

      if (currentBatchCanceled) {
        stopReason = 'Người dùng đã bấm dừng quét.';
        break;
      }

      // Check if the last order on this page is already before cutoff date
      const lastIdOnPage = allOrderIds[allOrderIds.length - 1];
      const lastRow = findOrderRow(lastIdOnPage);
      if (lastRow) {
        const lastRowDate = extractOrderDateFromText(lastRow.innerText || lastRow.textContent);
        if (lastRowDate && isOrderBeforeCutoffDate(lastRowDate, '2026-10-01')) {
          stopReason = `🛑 Các đơn cuối Trang ${currentPage} đã sang tháng 9 hoặc trước mốc 01/10/2026 (${lastRowDate}). Kết thúc quét đa trang.`;
          break;
        }
      }

      // Transition to next page
      updateWidgetStatus({
        statusHtml: `🔄 Đã quét xong Trang ${currentPage} (Lưu: ${totalCaptured} đơn mới). Đang tự động sang Trang ${currentPage + 1}...`
      });
      showAddpToast(`🔄 Đã xong Trang ${currentPage} (Lưu: ${totalCaptured} đơn mới). Đang chuyển sang Trang ${currentPage + 1}...`);

      const firstIdOnCurrentPage = allOrderIds[0];
      const hasNext = await transitionToNextPage(firstIdOnCurrentPage, currentPage);
      if (!hasNext) {
        stopReason = `Đã quét hết tất cả các trang có sẵn (đến Trang ${currentPage}).`;
        break;
      }

      currentPage++;
      // Wait for React DOM to render new page rows
      await new Promise(r => setTimeout(r, 2200));
    }
  } catch (err) {
    stopReason = `Lỗi: ${err.message}`;
  } finally {
    isScanRunning = false;
    const iframe = document.getElementById('addp-silent-crawler-frame');
    if (iframe && iframe.parentNode) {
      try { iframe.parentNode.removeChild(iframe); } catch (e) {}
    }

    updateWidgetStatus({
      btnDisabled: false,
      btnText: `🎉 Hoàn Tất: Đã Lưu ${totalCaptured} Đơn`,
      progressPct: 100,
      statusHtml: `
        <span style="color:#34d399; font-weight:700;">🎉 Đã hoàn thành quét ngầm: lưu ${totalCaptured} đơn hàng!</span><br/>
        <span style="color:#fcd34d; font-size:12px;">${stopReason}</span><br/>
        <a href="https://marketing.addp.vn" target="_blank" style="color:#38bdf8; text-decoration:underline; font-weight:600;">👉 Xem danh sách khách hàng tại Marketing ADDP</a>
      `
    });
    showAddpToast(`🎉 Hoàn tất: Đã lưu ${totalCaptured} đơn hàng!`, true);
  }
}

/**
 * Top-level silent auto-capture on order detail page.
 */
let isAutoCapturing = false;
let lastCapturedKey = '';

async function autoCaptureSilent() {
  if (typeof window === 'undefined' || !window.location || (window.self && window.top && window.self !== window.top)) return;
  const href = window.location.href;
  if (!href.includes('/order/detail')) return;
  if (isAutoCapturing) return;

  isAutoCapturing = true;
  try {
    // Wait for detail page React DOM to settle before unmasking
    await new Promise(r => setTimeout(r, 800));
    const unmasked = await unmaskEyeIcons(document);
    if (unmasked > 0) {
      await new Promise(r => setTimeout(r, 600));
    }

    let detail = parseUnmaskedCustomerDetail(document);
    if (detail && detail.phone && detail.phone.includes('*')) {
      await unmaskEyeIcons(document);
      await new Promise(r => setTimeout(r, 600));
      detail = parseUnmaskedCustomerDetail(document);
    }

    if (detail && detail.success && detail.phone && !detail.phone.includes('*')) {
      const currentKey = `${detail.order_id}_${detail.phone}`;
      if (lastCapturedKey !== currentKey) {
        lastCapturedKey = currentKey;
        const res = await sendCapturedCustomerToServer(detail);
        if (res && res.success) {
          showAddpToast(`✅ ADDP: Đã tự động lưu ngầm: ${detail.recipient_name || 'Khách'} - ${detail.phone}`);
        }
      }
    }
  } catch (e) {
    console.log('[ADDP Customer 360] Silent auto-capture note:', e.message);
  } finally {
    isAutoCapturing = false;
  }
}

/**
 * Injects floating ADDP widget onto TikTok Seller Center order pages.
 */
function injectAddpSellerWidget() {
  if (typeof document === 'undefined' || !document.body || typeof document.getElementById !== 'function' || window.self !== window.top) return;

  const isOrderPage = typeof window !== 'undefined' && window.location && window.location.href.includes('/order');
  if (!isOrderPage) return;

  let widget = document.getElementById('addp-seller-customer-widget');
  const isDetail = window.location.href.includes('/order/detail');
  const visibleOrderIds = !isDetail ? findAllOrderIdsOnPage() : [];

  if (widget) {
    // If widget already exists, dynamically refresh its detected count and status
    if (!isDetail && !isScanRunning) {
      const statusEl = widget.querySelector('#addp-widget-status');
      const btnAction = widget.querySelector('#addp-widget-action');
      if (statusEl && !statusEl.innerHTML.includes('Đang')) {
        statusEl.innerHTML = `Phát hiện: <strong style="color:#00f2fe;">${visibleOrderIds.length} đơn hàng</strong> trên trang.<br/><span style="color:#34d399;">🚀 Chế độ: Mở mắt tự động & Quét nhanh</span>`;
      }
      if (btnAction && !btnAction.textContent.includes('Đang')) {
        btnAction.textContent = `🚀 Quét Tự Động ${visibleOrderIds.length} Đơn Hàng`;
      }
    }
    return;
  }

  widget = document.createElement('div');
  widget.id = 'addp-seller-customer-widget';
  widget.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    background: #0f172a;
    color: #ffffff;
    border: 1px solid rgba(0, 242, 254, 0.4);
    border-radius: 12px;
    padding: 14px 18px;
    box-shadow: 0 10px 36px rgba(0, 0, 0, 0.6);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 320px;
  `;

  const headerTitle = isDetail ? 'ADDP Customer 360' : 'ADDP Auto-Batch Crawler';
  const statusHtml = isDetail
    ? `Trang: <strong style="color:#38bdf8;">Chi tiết đơn hàng</strong>.<br/><span style="color:#34d399;">🟢 Chế độ: Mở mắt tự động (Zero-Tab)</span>`
    : `Phát hiện: <strong style="color:#00f2fe;">${visibleOrderIds.length} đơn hàng</strong> trên trang.<br/><span style="color:#34d399;">🚀 Chế độ: Mở mắt tự động & Quét nhanh</span>`;

  const actionText = isDetail 
    ? '👁️ Mở Mắt & Lưu Đơn Này' 
    : `🚀 Quét Tự Động ${visibleOrderIds.length} Đơn Hàng`;

  const autoScanChecked = autoScanEnabled ? 'checked' : '';

  widget.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981;"></span>
        <strong style="color:#00f2fe; font-size:12px;">${headerTitle}</strong>
      </div>
      <button id="addp-widget-close" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer;" title="Đóng">&times;</button>
    </div>
    <div id="addp-widget-status" style="font-size:11px; color:#cbd5e1; line-height:1.4;">
      ${statusHtml}
    </div>
    ${!isDetail ? `
      <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#94a3b8;">
        <input type="checkbox" id="addp-widget-autoscan" ${autoScanChecked} style="cursor:pointer;" />
        <label for="addp-widget-autoscan" style="cursor:pointer; color:#e2e8f0;">Tự động quét khi mở / chuyển trang</label>
      </div>
    ` : ''}
    <div id="addp-widget-progress-container" style="display:none; width:100%; background:rgba(255,255,255,0.1); border-radius:6px; height:6px; overflow:hidden;">
      <div id="addp-widget-progress-bar" style="width:0%; height:100%; background:#10b981; transition:width 0.3s ease;"></div>
    </div>
    <button id="addp-widget-action" style="
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff;
      border: none;
      padding: 9px 14px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    ">
      <span>${actionText}</span>
    </button>
  `;

  document.body.appendChild(widget);

  const btnClose = widget.querySelector('#addp-widget-close');
  if (btnClose) {
    btnClose.addEventListener('click', () => widget.remove());
  }

  const autoScanCheckbox = widget.querySelector('#addp-widget-autoscan');
  if (autoScanCheckbox) {
    autoScanCheckbox.addEventListener('change', (e) => {
      autoScanEnabled = e.target.checked;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ addp_auto_scan: autoScanEnabled });
      }
      showAddpToast(`Đã ${autoScanEnabled ? 'bật' : 'tắt'} chế độ tự động quét khi chuyển trang.`);
    });
  }

  const btnAction = widget.querySelector('#addp-widget-action');
  const statusEl = widget.querySelector('#addp-widget-status');

  if (btnAction) {
    btnAction.addEventListener('click', async () => {
      if (isScanRunning) {
        // Cancel requested
        currentBatchCanceled = true;
        isScanRunning = false;
        btnAction.textContent = 'Đã Dừng';
        statusEl.innerHTML = '<span style="color:#f87171;">Đã dừng tiến trình quét ngầm.</span>';
        try {
          const iframe = document.getElementById('addp-silent-crawler-frame');
          if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch (e) {}
        return;
      }

      if (isDetail) {
        // Single order unmasking
        btnAction.disabled = true;
        btnAction.textContent = '⏳ Đang mở mắt & trích xuất...';
        try {
          await unmaskEyeIcons(document);
          await new Promise(r => setTimeout(r, 600));
          let detail = parseUnmaskedCustomerDetail(document);
          if (detail && detail.phone && detail.phone.includes('*')) {
            await unmaskEyeIcons(document);
            await new Promise(r => setTimeout(r, 600));
            detail = parseUnmaskedCustomerDetail(document);
          }

          if (detail.success) {
            const isUnmasked = !detail.phone.includes('*');
            statusEl.innerHTML = `<span style="color:#38bdf8;">Đang lưu: ${detail.recipient_name || 'Khách'} - ${detail.phone}...</span>`;
            const sRes = await sendCapturedCustomerToServer(detail);
            if (sRes && sRes.success) {
              const notice = isUnmasked ? '✅ Đã lưu SĐT thật thành công!' : '⚠️ Đã lưu nhưng SĐT vẫn bị che mờ';
              statusEl.innerHTML = `<span style="color:${isUnmasked ? '#34d399' : '#fcd34d'}; font-weight:700;">${notice}</span>`;
              btnAction.textContent = isUnmasked ? '✅ Đã Lưu Thành Công' : 'Đã Lưu (Bị Che)';
              showAddpToast(`✅ ADDP: Đã lưu ${detail.recipient_name || 'Khách'} (${detail.phone})`, isUnmasked);
            } else {
              statusEl.textContent = 'Lỗi lưu: ' + (sRes?.message || 'Không thể kết nối');
              btnAction.disabled = false;
              btnAction.textContent = 'Thử lại';
            }
          } else {
            statusEl.textContent = 'Không tìm thấy thông tin khách hàng trên trang này.';
            btnAction.disabled = false;
            btnAction.textContent = 'Thử lại';
          }
        } catch (e) {
          statusEl.textContent = 'Lỗi: ' + e.message;
          btnAction.disabled = false;
          btnAction.textContent = 'Thử lại';
        }
      } else {
        // Multi-order scanning on order list page
        runOrderListScan();
      }
    });
  }
}

// ----------------------------------------------------
// AUTO-INITIALIZATION & GENTLE POLLER (ZERO REFLOW THRASHING)
// ----------------------------------------------------
let lastObservedOrderIds = '';
let lastObservedOrderCount = -1;
let lastObservedUrl = '';
let scanDebounceTimer = null;

function handleOrderListDomChange() {
  if (typeof window === 'undefined' || !window.location) return;
  const href = window.location.href;

  if (href.includes('/order/detail')) {
    injectAddpSellerWidget();
    autoCaptureSilent();
    return;
  }

  if (href.includes('/order')) {
    injectAddpSellerWidget();

    // Check if new orders rendered
    clearTimeout(scanDebounceTimer);
    scanDebounceTimer = setTimeout(() => {
      const currentIds = findAllOrderIdsOnPage();
      const idsKey = currentIds.sort().join(',');

      // If orders loaded and different from previous observation
      if (currentIds.length > 0 && idsKey !== lastObservedOrderIds) {
        lastObservedOrderIds = idsKey;
        injectAddpSellerWidget(); // Refresh widget numbers

        // Check if there are any uncaptured orders (ONLY if user explicitly enabled auto-scan)
        const uncaptured = currentIds.filter(id => !sessionCapturedOrders.has(id));
        if (autoScanEnabled && !isScanRunning && uncaptured.length > 0) {
          console.log(`[ADDP Customer 360] Auto-scan triggered for ${uncaptured.length} new orders.`);
          runOrderListScan();
        }
      }
    }, 1200);
  }
}

if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('seller')) {
  // Gentle initial run after page load & React hydration completes (2.0s)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(handleOrderListDomChange, 2000);
    });
  } else {
    setTimeout(handleOrderListDomChange, 2000);
  }

  // Gentle, non-blocking 2.0s poller (replaces aggressive MutationObserver on document.body)
  // Checks lightweight element count only; avoids expensive innerText reflow thrashing
  setInterval(() => {
    if (typeof window === 'undefined' || !window.location) return;
    const currentUrl = window.location.href;
    
    if (currentUrl !== lastObservedUrl) {
      lastObservedUrl = currentUrl;
      handleOrderListDomChange();
      return;
    }

    if (currentUrl.includes('/order') && !currentUrl.includes('/order/detail')) {
      const orderCount = findAllOrderIdsOnPage().length;
      if (orderCount > 0 && orderCount !== lastObservedOrderCount) {
        lastObservedOrderCount = orderCount;
        handleOrderListDomChange();
      }
    }
  }, 2000);
}

// Module export for node test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseVietnameseNumber,
    parseVietnameseDate,
    parseDateRange,
    findMetricCard,
    extractCompassOverviewMetrics,
    normalizeLabel,
    isForbiddenElement,
    isRealEyeIcon,
    parseUnmaskedCustomerDetail,
    findAllOrderIdsOnPage,
    extractOrdersFromOrderListTable
  };
}

})();


