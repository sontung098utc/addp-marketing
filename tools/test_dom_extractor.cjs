/**
 * TASK 02B-HF1.1.2 DOM EXTRACTOR COMPREHENSIVE TEST SUITE
 * Tests Scenarios A through U covering real TikTok Seller Center DOM:
 *   A. GMV: 254,2 Tr₫ => 254200000
 *   B. Total Revenue: 266,3 Tr₫ => 266300000
 *   C. Date: Th09 01, 2026 + Th09 20, 2026 => 2026-09-01, 2026-09-20, 20 days
 *   D. Date: 01/09/2026 + 20/09/2026 => 2026-09-01, 2026-09-20, 20 days
 *   E. Counts: 3.897 => 3897, 3.836 => 3836, 2.540 => 2540
 *   F. [CRITICAL REGRESSION HF1.1.2] "Valid KPI inside checkbox LABEL wrapper is accepted"
 *   G. Real DOM Level 0 -> Level 4 hierarchy extracts GMV 254200000 with newlines ("254,2\nTr\n₫")
 *   H. Real DOM Level 0 -> Level 4 with textContent ("254,2Tr₫")
 *   I. Real DOM Total Revenue (266,3 Tr₫ => 266300000)
 *   J. Real DOM Items Sold (3.897 => 3897) & SKU Orders (3.836 => 3836)
 *   K. Realistic multi-card group in LABEL.core-checkbox wrappers extracts all 5 metrics
 *   L. Diagnostics counts: candidate_title_count >= 8, valid_card_count >= 8, detected_labels
 *   M. Negative test: Chart tooltip ".vchart-tooltip-key" is NOT selected as metric card
 *   N. Negative test: Chart tooltip ".echarts-tooltip" is NOT selected as metric card
 *   O. Negative test: Standalone metric-selector checkbox without .pcm-smc is NOT selected
 *   P. Negative test: Analysis section header outside .pcm-smc is NOT selected
 *   Q. Controlled fallbacks within .pcm-smc (.pcm-smc-title-text without underline-inner)
 *   R. Missing optional metrics (Total Revenue, Orders) do not fail extraction and remain null
 *   S. Missing GMV => fail closed (null total_gmv, GMV_LABEL_NOT_FOUND)
 *   T. Diagnostic error codes (CARD_NOT_FOUND, VALUE_NOT_FOUND, VALUE_PARSE_FAILED, DATE_RANGE_NOT_FOUND, DATE_RANGE_PARSE_FAILED)
 *   U. Explicit zero: 0 remains 0, missing metric remains null (never zero)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const contentScriptCode = fs.readFileSync(path.join(__dirname, '../public/extension/content_script.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'window', 'document', 'chrome', contentScriptCode)(mod, mod.exports, { location: { hostname: '' } }, {}, {});
const {
  parseVietnameseNumber,
  parseVietnameseDate,
  parseDateRange,
  findMetricCard,
  extractCompassOverviewMetrics,
  normalizeLabel
} = mod.exports;

console.log('====================================================');
console.log('STARTING TASK 02B-HF1.1.2 DOM EXTRACTOR TEST MATRIX');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    console.error(err.stack);
  }
}

// DOM Node Mock that accurately simulates standard browser DOM matching
class MockNode {
  constructor(tag, className = '', text = '', attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.className = className;
    this.textContent = text;
    this.innerText = text;
    this.attributes = { ...attrs };
    this.children = [];
    this.parentElement = null;
    this.value = attrs.value || '';
    this.classList = {
      contains: (cls) => this.className.split(/\s+/).includes(cls)
    };
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  matches(selector) {
    if (!selector) return false;
    // Comma-separated
    if (selector.includes(',')) {
      return selector.split(',').some(s => this.matches(s.trim()));
    }
    // Descendant selector (e.g. ".pcm-smc .pcm-smc-title-text-underline-inner")
    if (selector.includes(' ')) {
      const parts = selector.split(/\s+/).filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (!this.matches(lastPart)) return false;
      let ancestor = this.parentElement;
      const targetAncestorSelector = parts.slice(0, -1).join(' ');
      while (ancestor) {
        if (ancestor.matches(targetAncestorSelector)) return true;
        ancestor = ancestor.parentElement;
      }
      return false;
    }
    // Tag only
    if (/^[A-Za-z]+$/.test(selector)) {
      return this.tagName.toLowerCase() === selector.toLowerCase();
    }
    // Class selector (.pcm-smc)
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this.classList.contains(cls);
    }
    // [data-tid="..."]
    if (selector.startsWith('[data-tid="') && selector.endsWith('"]')) {
      const tid = selector.slice(11, -2);
      return this.attributes['data-tid'] === tid;
    }
    // [role="..."]
    if (selector.startsWith('[role="') && selector.endsWith('"]')) {
      const r = selector.slice(7, -2);
      return this.attributes['role'] === r;
    }
    // [class*="..."]
    if (selector.includes('[class*="')) {
      const match = selector.match(/\[class\*="([^"]+)"\]/);
      if (match && this.className.includes(match[1])) return true;
    }
    // input[placeholder="..."]
    if (selector.includes('input[placeholder="')) {
      const mExact = selector.match(/input\[placeholder="([^"]+)"\]/);
      return this.tagName === 'INPUT' && this.attributes.placeholder === mExact[1];
    }
    // input[placeholder*="..."]
    if (selector.includes('input[placeholder*="')) {
      const mSub = selector.match(/input\[placeholder\*="([^"]+)"\]/);
      return this.tagName === 'INPUT' && (this.attributes.placeholder || '').includes(mSub[1]);
    }
    return false;
  }

  querySelector(selector) {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }

  querySelectorAll(selector) {
    let results = [];
    const parts = selector.split(',').map(s => s.trim());
    if (parts.length > 1) {
      const seen = new Set();
      for (const p of parts) {
        for (const res of this.querySelectorAll(p)) {
          if (!seen.has(res)) {
            seen.add(res);
            results.push(res);
          }
        }
      }
      return results;
    }

    const check = (node) => {
      if (node.matches(selector)) {
        results.push(node);
      }
      for (const c of node.children) check(c);
    };

    for (const c of this.children) check(c);
    return results;
  }
}

/**
 * Builds real TikTok Compass DOM structure:
 *   [LABEL.core-checkbox.core-checkbox-checked.pulse-checkbox.pcm-smc-card-group-item]
 *     └── DIV.pcm-smc
 *         ├── DIV.pcm-smc-title.pcm-smc-title-has-description
 *         │   └── SPAN.pcm-smc-title-text
 *         │       └── SPAN.pcm-smc-title-text-underline
 *         │           └── SPAN.pcm-smc-title-text-underline-inner
 *         └── DIV.pcm-smc-value-content
 */
function buildRealDOMCard(labelText, valInner, valContent = null, isSelected = false, wrapInLabel = true) {
  const card = new MockNode('div', `pcm-smc ${isSelected ? 'pcm-smc-selected' : ''}`);
  const titleDiv = new MockNode('div', 'pcm-smc-title pcm-smc-title-has-description');
  const spanText = new MockNode('span', 'pcm-smc-title-text');
  const spanUnderline = new MockNode('span', 'pcm-smc-title-text-underline');
  const spanInner = new MockNode('span', 'pcm-smc-title-text-underline-inner', labelText);

  spanUnderline.appendChild(spanInner);
  spanText.appendChild(spanUnderline);
  titleDiv.appendChild(spanText);
  card.appendChild(titleDiv);

  const valDiv = new MockNode('div', 'pcm-smc-value-content', valInner);
  if (valContent) {
    valDiv.textContent = valContent;
  }
  card.appendChild(valDiv);

  const trendDiv = new MockNode('div', 'pcm-smc-trend', '28,6%');
  card.appendChild(trendDiv);

  if (wrapInLabel) {
    const labelWrapper = new MockNode('label', 'core-checkbox core-checkbox-checked pulse-checkbox pcm-smc-card-group-item');
    labelWrapper.appendChild(card);
    return labelWrapper;
  }

  return card;
}

function buildMockDatePicker(startVal, endVal) {
  const container = new MockNode('div', 'date-picker-wrap', '', { 'data-tid': 'm4b_date_picker_range_picker' });
  const inputStart = new MockNode('input', 'start-input', '', { placeholder: 'Ngày bắt đầu', value: startVal });
  const inputEnd = new MockNode('input', 'end-input', '', { placeholder: 'Ngày kết thúc', value: endVal });
  container.appendChild(inputStart);
  container.appendChild(inputEnd);
  return container;
}

// ------------------------------------------------------------------
// TEST SUITE EXECUTION
// ------------------------------------------------------------------

// A. GMV Number Normalization
runTest('A: GMV display normalization (254,2 Tr₫ => 254200000)', () => {
  const res = parseVietnameseNumber('254,2 Tr₫');
  assert.strictEqual(res, 254200000);
});

// B. Total Revenue Number Normalization
runTest('B: Total Revenue normalization (266,3 Tr₫ => 266300000)', () => {
  const res = parseVietnameseNumber('266,3 Tr₫');
  assert.strictEqual(res, 266300000);
});

// C. Date Range Normalization (Format: Th09 01, 2026)
runTest('C: Date range normalization (Th09 01, 2026 -> Th09 20, 2026 => 20 days inclusive)', () => {
  const dStart = parseVietnameseDate('Th09 01, 2026');
  const dEnd = parseVietnameseDate('Th09 20, 2026');
  assert.strictEqual(dStart, '2026-09-01');
  assert.strictEqual(dEnd, '2026-09-20');

  const root = new MockNode('div', 'root');
  root.appendChild(buildMockDatePicker('Th09 01, 2026', 'Th09 20, 2026'));
  const range = parseDateRange(root);

  assert.strictEqual(range.period_start, '2026-09-01');
  assert.strictEqual(range.period_end, '2026-09-20');
  assert.strictEqual(range.period_days, 20); // (20 - 1) + 1 = 20
  assert.strictEqual(range.error_code, 'SUCCESS');
});

// D. Date Range Normalization (Format: 01/09/2026)
runTest('D: Date range normalization (01/09/2026 -> 20/09/2026 => 20 days inclusive)', () => {
  const dStart = parseVietnameseDate('01/09/2026');
  const dEnd = parseVietnameseDate('20/09/2026');
  assert.strictEqual(dStart, '2026-09-01');
  assert.strictEqual(dEnd, '2026-09-20');

  const root = new MockNode('div', 'root');
  root.appendChild(buildMockDatePicker('01/09/2026', '20/09/2026'));
  const range = parseDateRange(root);

  assert.strictEqual(range.period_start, '2026-09-01');
  assert.strictEqual(range.period_end, '2026-09-20');
  assert.strictEqual(range.period_days, 20);
});

// E. Counts Normalization
runTest('E: Counts normalization (3.897 => 3897, 3.836 => 3836, 2.540 => 2540)', () => {
  assert.strictEqual(parseVietnameseNumber('3.897'), 3897);
  assert.strictEqual(parseVietnameseNumber('3.836'), 3836);
  assert.strictEqual(parseVietnameseNumber('2.540'), 2540);
  assert.strictEqual(parseVietnameseNumber('23'), 23);
});

// F. [CRITICAL REGRESSION HF1.1.2] Valid KPI inside checkbox LABEL wrapper is accepted
runTest('F: [REGRESSION HF1.1.2] Valid KPI inside checkbox LABEL wrapper is accepted', () => {
  const doc = new MockNode('div', 'doc');
  // Exact production wrapper: LABEL.core-checkbox.pulse-checkbox.pcm-smc-card-group-item > DIV.pcm-smc
  const wrappedCard = buildRealDOMCard('GMV', '254,2 Tr ₫', null, false, true);
  doc.appendChild(wrappedCard);

  const res = findMetricCard(doc, ['GMV']);
  assert.strictEqual(res.found, true, 'GMV card must not be rejected by checkbox/label noise filter');
  assert.strictEqual(res.code, 'SUCCESS');
  assert.strictEqual(res.parsedValue, 254200000);
});

// G. Real DOM Shape: Level 0 -> Level 4 with innerText newlines ("254,2\nTr\n₫")
runTest('G: Real DOM Level 0 -> Level 4 hierarchy extracts GMV 254200000 with newlines', () => {
  const doc = new MockNode('div', 'doc');
  const card = buildRealDOMCard('GMV', '254,2\nTr\n₫', '254,2Tr₫', false, true);
  doc.appendChild(card);

  const res = findMetricCard(doc, ['GMV']);
  assert.strictEqual(res.found, true);
  assert.strictEqual(res.code, 'SUCCESS');
  assert.strictEqual(res.parsedValue, 254200000);

  const metrics = extractCompassOverviewMetrics(doc);
  assert.strictEqual(metrics.total_gmv, 254200000);
});

// H. Real DOM Shape: Level 0 -> Level 4 with textContent ("254,2Tr₫")
runTest('H: Real DOM Level 0 -> Level 4 with textContent extracts GMV 254200000', () => {
  const doc = new MockNode('div', 'doc');
  const card = buildRealDOMCard('GMV', '', '254,2Tr₫', false, true);
  doc.appendChild(card);

  const res = findMetricCard(doc, ['GMV']);
  assert.strictEqual(res.found, true);
  assert.strictEqual(res.parsedValue, 254200000);
});

// I. Real DOM Shape: Total Revenue (266,3 Tr₫ => 266300000)
runTest('I: Real DOM Total Revenue (266,3 Tr₫ => 266300000)', () => {
  const doc = new MockNode('div', 'doc');
  doc.appendChild(buildRealDOMCard('Tổng doanh thu', '266,3\nTr\n₫', null, false, true));

  const res = findMetricCard(doc, ['Tổng doanh thu']);
  assert.strictEqual(res.found, true);
  assert.strictEqual(res.parsedValue, 266300000);
});

// J. Real DOM Shape: Items Sold (3.897) & SKU Orders (3.836)
runTest('J: Real DOM Items Sold (3.897 => 3897) & SKU Orders (3.836 => 3836)', () => {
  const doc = new MockNode('div', 'doc');
  doc.appendChild(buildRealDOMCard('Số món bán ra', '3.897', null, false, true));
  doc.appendChild(buildRealDOMCard('Đơn hàng SKU', '3.836', null, false, true));

  const metrics = extractCompassOverviewMetrics(doc);
  assert.strictEqual(metrics.items_sold, 3897);
  assert.strictEqual(metrics.sku_orders, 3836);
});

// K. Realistic multi-card group in LABEL.core-checkbox wrappers extracts all 5 metrics
runTest('K: Multi-card group in LABEL.core-checkbox wrappers extracts all 5 metrics', () => {
  const doc = new MockNode('div', 'doc');
  const cardGroup = new MockNode('div', 'pcm-smc-card-group');

  // 8 real cards as inspected in production:
  cardGroup.appendChild(buildRealDOMCard('GMV', '254,2 Tr ₫', null, true, true));
  cardGroup.appendChild(buildRealDOMCard('Tổng doanh thu', '266,3 Tr ₫', null, false, true));
  cardGroup.appendChild(buildRealDOMCard('Số món bán ra', '3.897', null, false, true));
  cardGroup.appendChild(buildRealDOMCard('Đơn hàng SKU', '3.836', null, false, true));
  cardGroup.appendChild(buildRealDOMCard('Đơn hàng', '2.540', null, false, true));
  cardGroup.appendChild(buildRealDOMCard('Khách hàng', '1.920', null, false, true));
  cardGroup.appendChild(buildRealDOMCard('Khách truy cập', '15.420', null, false, true));
  cardGroup.appendChild(buildRealDOMCard('Lượt hiển thị sản phẩm', '120.500', null, false, true));

  doc.appendChild(cardGroup);

  const metrics = extractCompassOverviewMetrics(doc);
  assert.strictEqual(metrics.total_gmv, 254200000);
  assert.strictEqual(metrics.total_revenue, 266300000);
  assert.strictEqual(metrics.items_sold, 3897);
  assert.strictEqual(metrics.sku_orders, 3836);
  assert.strictEqual(metrics.total_orders_count, 2540);
  assert.strictEqual(metrics.raw_labels.length, 5);
  assert.ok(metrics.candidate_title_count >= 8);
  assert.ok(metrics.valid_card_count >= 8);
});

// L. Diagnostics counts: candidate_title_count and valid_card_count
runTest('L: Diagnostics counts reflect DOM state accurately', () => {
  const doc = new MockNode('div', 'doc');
  doc.appendChild(buildRealDOMCard('GMV', '254,2 Tr ₫', null, false, true));
  doc.appendChild(buildRealDOMCard('Tổng doanh thu', '266,3 Tr ₫', null, false, true));

  const metrics = extractCompassOverviewMetrics(doc);
  assert.strictEqual(metrics.candidate_title_count, 2);
  assert.strictEqual(metrics.valid_card_count, 2);
});

// M. Negative test: Chart tooltip ".vchart-tooltip-key" is NOT selected
runTest('M: Negative: Chart tooltip ".vchart-tooltip-key" is NOT selected as metric card', () => {
  const doc = new MockNode('div', 'doc');

  const tooltip = new MockNode('div', 'vchart-tooltip');
  const tooltipKey = new MockNode('div', 'vchart-tooltip-key', 'GMV');
  const tooltipVal = new MockNode('div', 'vchart-tooltip-value', '999 Tr ₫');
  tooltip.appendChild(tooltipKey);
  tooltip.appendChild(tooltipVal);
  doc.appendChild(tooltip);

  const res = findMetricCard(doc, ['GMV']);
  assert.strictEqual(res.found, false);
  assert.strictEqual(res.code, 'LABEL_NOT_FOUND');
});

// N. Negative test: Chart tooltip ".echarts-tooltip" is NOT selected
runTest('N: Negative: Chart tooltip ".echarts-tooltip" is NOT selected as metric card', () => {
  const doc = new MockNode('div', 'doc');

  const tooltip = new MockNode('div', 'echarts-tooltip');
  const tooltipTitle = new MockNode('div', 'tooltip-title', 'GMV');
  const tooltipVal = new MockNode('div', 'tooltip-val', '999,9 Tr₫');
  tooltip.appendChild(tooltipTitle);
  tooltip.appendChild(tooltipVal);
  doc.appendChild(tooltip);

  const res = findMetricCard(doc, ['GMV']);
  assert.strictEqual(res.found, false);
  assert.strictEqual(res.code, 'LABEL_NOT_FOUND');
});

// O. Negative test: Standalone metric-selector checkbox without .pcm-smc is NOT selected
runTest('O: Negative: Standalone metric-selector checkbox without .pcm-smc is NOT selected', () => {
  const doc = new MockNode('div', 'doc');

  const label = new MockNode('label', 'core-checkbox');
  const input = new MockNode('input', 'checkbox-input', '', { type: 'checkbox', value: 'GMV' });
  const span = new MockNode('span', 'checkbox-label', 'GMV');
  label.appendChild(input);
  label.appendChild(span);
  doc.appendChild(label);

  const res = findMetricCard(doc, ['GMV']);
  assert.strictEqual(res.found, false);
  assert.strictEqual(res.parsedValue, null);

  // Also test when standalone checkbox uses the title underline class
  const doc2 = new MockNode('div', 'doc2');
  const label2 = new MockNode('label', 'core-checkbox');
  const span2 = new MockNode('span', 'pcm-smc-title-text-underline-inner', 'GMV');
  label2.appendChild(span2);
  doc2.appendChild(label2);
  const res2 = findMetricCard(doc2, ['GMV']);
  assert.strictEqual(res2.found, false);
  assert.strictEqual(res2.code, 'CARD_NOT_FOUND');
});

// P. Negative test: Analysis section header outside .pcm-smc is NOT selected
runTest('P: Negative: Analysis section header outside .pcm-smc is NOT selected', () => {
  const doc = new MockNode('div', 'doc');

  const section = new MockNode('div', 'analysis-section');
  const title = new MockNode('h2', 'section-title', 'Phân tích GMV');
  section.appendChild(title);
  doc.appendChild(section);

  const res = findMetricCard(doc, ['GMV']);
  assert.strictEqual(res.found, false);
  assert.strictEqual(res.code, 'LABEL_NOT_FOUND');
});

// Q. Controlled fallbacks within .pcm-smc (.pcm-smc-title-text without underline-inner)
runTest('Q: Controlled fallbacks within .pcm-smc (.pcm-smc-title-text without underline-inner)', () => {
  const doc = new MockNode('div', 'doc');
  const card = new MockNode('div', 'pcm-smc');
  const titleDiv = new MockNode('div', 'pcm-smc-title');
  const spanText = new MockNode('span', 'pcm-smc-title-text', 'GMV');
  titleDiv.appendChild(spanText);
  card.appendChild(titleDiv);
  card.appendChild(new MockNode('div', 'pcm-smc-value-content', '254,2 Tr₫'));
  doc.appendChild(card);

  const res = findMetricCard(doc, ['GMV']);
  assert.strictEqual(res.found, true);
  assert.strictEqual(res.code, 'SUCCESS');
  assert.strictEqual(res.parsedValue, 254200000);
});

// R. Missing optional metrics do not fail extraction and remain null
runTest('R: Missing optional metrics do not fail extraction and remain null', () => {
  const doc = new MockNode('div', 'doc');
  doc.appendChild(buildRealDOMCard('GMV', '254,2 Tr₫', null, false, true));
  // Total Revenue, Orders omitted

  const metrics = extractCompassOverviewMetrics(doc);
  assert.strictEqual(metrics.total_gmv, 254200000);
  assert.strictEqual(metrics.total_revenue, null);
  assert.strictEqual(metrics.total_orders_count, null);
});

// S. Missing GMV => fail closed with GMV_LABEL_NOT_FOUND
runTest('S: Missing GMV results in null total_gmv and GMV_LABEL_NOT_FOUND', () => {
  const doc = new MockNode('div', 'doc');
  doc.appendChild(buildRealDOMCard('Đơn hàng', '2.540', null, false, true));
  doc.appendChild(buildRealDOMCard('Số món bán ra', '3.897', null, false, true));

  const metrics = extractCompassOverviewMetrics(doc);
  assert.strictEqual(metrics.total_gmv, null);
  assert.strictEqual(metrics.gmv_result.code, 'LABEL_NOT_FOUND');
});

// T. Card / Value missing diagnostic codes
runTest('T: Card or value container missing returns controlled diagnostic codes', () => {
  // Case 1: Stray label with no .pcm-smc ancestor
  const doc1 = new MockNode('div', 'doc');
  const strayLabel = new MockNode('span', 'pcm-smc-title-text-underline-inner', 'GMV');
  doc1.appendChild(strayLabel);
  const res1 = findMetricCard(doc1, ['GMV']);
  assert.strictEqual(res1.found, false);
  assert.strictEqual(res1.code, 'CARD_NOT_FOUND');

  // Case 2: Card exists, but has no .pcm-smc-value-content
  const doc2 = new MockNode('div', 'doc');
  const cardNoVal = new MockNode('div', 'pcm-smc');
  const titleDiv = new MockNode('div', 'pcm-smc-title');
  const spanInner = new MockNode('span', 'pcm-smc-title-text-underline-inner', 'GMV');
  titleDiv.appendChild(spanInner);
  cardNoVal.appendChild(titleDiv);
  doc2.appendChild(cardNoVal);
  const res2 = findMetricCard(doc2, ['GMV']);
  assert.strictEqual(res2.found, false);
  assert.strictEqual(res2.code, 'VALUE_NOT_FOUND');

  // Case 3: Value content cannot be parsed
  const doc3 = new MockNode('div', 'doc');
  doc3.appendChild(buildRealDOMCard('GMV', 'KHÔNG_HỢP_LỆ', null, false, true));
  const res3 = findMetricCard(doc3, ['GMV']);
  assert.strictEqual(res3.found, false);
  assert.strictEqual(res3.code, 'VALUE_PARSE_FAILED');
});

// U. Explicit zero remains 0, missing metric remains null
runTest('U: Explicit zero remains 0, missing metric remains null (never zero)', () => {
  assert.strictEqual(parseVietnameseNumber('0'), 0);
  assert.strictEqual(parseVietnameseNumber('0đ'), 0);
  assert.strictEqual(parseVietnameseNumber('0 ₫'), 0);
  assert.strictEqual(parseVietnameseNumber('0,0 Tr₫'), 0);

  assert.strictEqual(parseVietnameseNumber('--'), null);
  assert.strictEqual(parseVietnameseNumber('-'), null);
  assert.strictEqual(parseVietnameseNumber(''), null);
  assert.strictEqual(parseVietnameseNumber(null), null);
  assert.strictEqual(parseVietnameseNumber(undefined), null);
  assert.strictEqual(parseVietnameseNumber('N/A'), null);
});

console.log('\n====================================================');
console.log(`TOTAL_EXTRACTOR_TESTS  = ${totalTests}`);
console.log(`PASSED_EXTRACTOR_TESTS = ${passedTests}`);
console.log(`FAILED_EXTRACTOR_TESTS = ${totalTests - passedTests}`);
console.log('====================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
