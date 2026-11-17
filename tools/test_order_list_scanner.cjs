/**
 * Test Suite for Order List Scanner in content_script.js
 * Uses zero-dependency mock DOM.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const contentScriptCode = fs.readFileSync(path.join(__dirname, '../public/extension/content_script.js'), 'utf8');

// Lightweight Element Mock
class MockElement {
  constructor(tag, attrs = {}, text = '') {
    this.tagName = (tag || 'DIV').toUpperCase();
    this.attributes = attrs;
    this.className = attrs.class || '';
    this.textContent = text;
    this.innerText = text;
    this.children = [];
    this.parentElement = null;
  }

  getAttribute(name) {
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
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

  matches(sel) {
    const s = sel.toLowerCase();
    const tag = this.tagName.toLowerCase();
    if (s.split(',').some(part => part.trim() === tag)) return true;
    if (s.includes('tr') && tag === 'tr') return true;
    if (s.includes('card') && this.className.includes('card')) return true;
    return false;
  }

  querySelectorAll(sel) {
    const results = [];
    function search(node) {
      for (const child of node.children) {
        let match = false;
        const tag = child.tagName.toLowerCase();
        const cls = (child.className || '').toLowerCase();
        const outer = child.outerHTML ? child.outerHTML.toLowerCase() : '';

        if (sel.includes('a[href*="order_no="]') && tag === 'a' && (child.getAttribute('href') || '').includes('order_no=')) match = true;
        else if (sel.includes('[data-order-id]') && child.getAttribute('data-order-id')) match = true;
        else if (sel.includes('[data-clipboard-text]') && child.getAttribute('data-clipboard-text')) match = true;
        else if (sel.includes('.arco-icon-eye') && cls.includes('arco-icon-eye')) match = true;
        else if (sel.includes('tr') && tag === 'tr') match = true;
        else if (sel.includes('td') && tag === 'td') match = true;
        else if (sel.includes('button') && tag === 'button') match = true;
        else if (sel.includes('svg') && tag === 'svg') match = true;

        if (match) results.push(child);
        search(child);
      }
    }
    search(this);
    return results;
  }

  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  }
}

// Build mock document
const mockDoc = new MockElement('HTML');
mockDoc.body = new MockElement('BODY');
mockDoc.appendChild(mockDoc.body);

// Populate elements
const row1 = new MockElement('TR', { class: 'arco-table-tr', 'data-order-id': '578812345678901234' }, '');
const link1 = new MockElement('A', { href: '/order/detail?order_no=578812345678901234&shop_region=VN' }, '578812345678901234');
const buyer1 = new MockElement('TD', { class: 'buyer-cell' }, 'Nguyễn Văn A\n0987654321');
const status1 = new MockElement('TD', {}, 'Đang chờ vận chuyển');
const amount1 = new MockElement('TD', {}, '250.000₫');
row1.appendChild(link1);
row1.appendChild(buyer1);
row1.appendChild(status1);
row1.appendChild(amount1);
row1.innerText = '578812345678901234\nNguyễn Văn A\n0987654321\nĐang chờ vận chuyển\n250.000₫\nHà Nội';
mockDoc.body.appendChild(row1);

const row2 = new MockElement('TR', { class: 'arco-table-tr', 'data-order-id': '578898765432109876' }, '');
const link2 = new MockElement('A', { href: '/order/detail?order_no=578898765432109876&shop_region=VN' }, '578898765432109876');
const buyer2 = new MockElement('TD', { class: 'buyer-cell' }, 'Trần Thị Mai\n0912****88');
const eye2 = new MockElement('SPAN', { class: 'arco-icon arco-icon-eye', 'aria-label': 'Xem' });
buyer2.appendChild(eye2);
row2.appendChild(link2);
row2.appendChild(buyer2);
row2.innerText = '578898765432109876\nTrần Thị Mai\n0912****88\nĐang giao\n180.000₫\nĐà Nẵng';
mockDoc.body.appendChild(row2);

mockDoc.body.innerText = row1.innerText + '\n' + row2.innerText;

const mod = { exports: {} };
new Function('module', 'exports', 'window', 'document', 'chrome', contentScriptCode)(
  mod,
  mod.exports,
  { location: { href: 'https://seller-vn.tiktok.com/order', hostname: 'seller-vn.tiktok.com' } },
  mockDoc,
  {}
);

const {
  findAllOrderIdsOnPage,
  extractOrdersFromOrderListTable,
  isRealEyeIcon
} = mod.exports;

console.log('====================================================');
console.log('TESTING ORDER LIST SCANNER (ZERO-DEPENDENCY)');
console.log('====================================================');

// Test 1: Order ID Discovery
const ids = findAllOrderIdsOnPage();
console.log('Detected Order IDs:', ids);
assert(ids.includes('578812345678901234'), 'Should find order 1');
assert(ids.includes('578898765432109876'), 'Should find order 2');
console.log('[PASS] Test 1: Order IDs discovered properly from table elements.');

// Test 2: Row Extraction
const extracted = extractOrdersFromOrderListTable();
console.log('Extracted Rows count:', extracted.length);
assert.strictEqual(extracted.length, 2, 'Should extract 2 rows');

const o1 = extracted.find(o => o.order_id === '578812345678901234');
assert(o1, 'Order 1 extracted');
assert.strictEqual(o1.recipient_name, 'Nguyễn Văn A');
assert.strictEqual(o1.phone, '0987654321');
assert.strictEqual(o1.is_unmasked, true);
assert.strictEqual(o1.amount, 250000);
assert.strictEqual(o1.order_status, 'AWAITING_SHIPMENT');
console.log('[PASS] Test 2A: Unmasked order 1 parsed perfectly (Name, Phone, Status, Amount).');

const o2 = extracted.find(o => o.order_id === '578898765432109876');
assert(o2, 'Order 2 extracted');
assert.strictEqual(o2.recipient_name, 'Trần Thị Mai');
assert.strictEqual(o2.phone, '0912****88');
assert.strictEqual(o2.is_unmasked, false);
console.log('[PASS] Test 2B: Masked order 2 correctly identified as needing unmasking.');

// Test 3: Eye Icon Check
assert(isRealEyeIcon(eye2), 'Eye icon should be recognized');
assert(!isRealEyeIcon(link1), 'Link should not be eye icon');
console.log('[PASS] Test 3: Eye icon recognition verified.');

console.log('====================================================');
console.log('ALL TESTS PASSED SUCCESSFULLY! (3/3)');
console.log('====================================================');
process.exit(0);
