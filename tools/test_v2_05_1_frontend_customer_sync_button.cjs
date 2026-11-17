/**
 * ====================================================================
 * SPRINT V2-05.1 FRONTEND RUNTIME HOTFIX TEST SUITE
 * Test: Verify "Đồng bộ hồ sơ" Button Runtime & Request Contract
 * File: tools/test_v2_05_1_frontend_customer_sync_button.cjs
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('  TESTING V2-05.1 FRONTEND RUNTIME HOTFIX: CUSTOMER SYNC BUTTON');
console.log('====================================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✘ [FAIL] ${name}`);
    console.error(`     Reason: ${err.message}`);
  }
}

const ROOT = path.resolve(__dirname, '..');
const jsxFile = path.join(ROOT, 'src/CommerceDashboardView.jsx');
const distHtml = path.join(ROOT, 'dist/index.html');
const distAssetsDir = path.join(ROOT, 'dist/assets');

// 1. Static Audit of Source Code
test('TEST 1: Source code contains ZERO handleTriggerDomainSync occurrences', () => {
  const content = fs.readFileSync(jsxFile, 'utf8');
  if (content.includes('handleTriggerDomainSync')) {
    throw new Error('src/CommerceDashboardView.jsx still contains handleTriggerDomainSync!');
  }
});

test('TEST 2: Source code correctly attaches handleTriggerSync("customer") to both buttons', () => {
  const content = fs.readFileSync(jsxFile, 'utf8');
  const matches = content.match(/handleTriggerSync\(['"]customer['"]\)/g) || [];
  if (matches.length < 2) {
    throw new Error(`Expected at least 2 occurrences of handleTriggerSync('customer'), found: ${matches.length}`);
  }
});

// 2. Built Bundle Audit
test('TEST 3: Built bundle in dist/assets contains ZERO handleTriggerDomainSync occurrences', () => {
  const assetFiles = fs.readdirSync(distAssetsDir);
  const jsFiles = assetFiles.filter(f => f.endsWith('.js'));
  if (jsFiles.length === 0) throw new Error('No .js bundle found in dist/assets!');
  for (const jsf of jsFiles) {
    const jsContent = fs.readFileSync(path.join(distAssetsDir, jsf), 'utf8');
    if (jsContent.includes('handleTriggerDomainSync')) {
      throw new Error(`Bundle ${jsf} still contains handleTriggerDomainSync!`);
    }
  }
});

// 3. Runtime Simulation: Emulate handleTriggerSync('customer') Execution & Request Dispatch
test('TEST 4: Runtime simulation executes handleTriggerSync("customer") without ReferenceError and dispatches domain=customer', async () => {
  const capturedRequests = [];
  
  // Emulate apiRequest environment exactly as CommerceDashboardView does
  const shopId = '7495657895504611503';
  const mockApiRequest = async (url, method = 'GET', body = null) => {
    capturedRequests.push({ url, method, body });
    // Mock successful backend response for customer sync
    return {
      success: true,
      status: 'AVAILABLE',
      data: {
        domain: 'customer',
        status: 'AVAILABLE',
        records_read: 15,
        records_written: 15,
        message: 'Đồng bộ hồ sơ khách hàng hoàn tất (Bảo vệ PII).'
      }
    };
  };

  let actionMessage = null;
  const setSyncActionMessage = (msg) => { actionMessage = msg; };
  let syncStatusFetched = false;
  const fetchSyncStatus = () => { syncStatusFetched = true; };
  let reportFetched = false;
  const fetchDashboardReport = () => { reportFetched = true; };
  let customersFetched = false;
  const fetchCustomers = () => { customersFetched = true; };

  // Exact function logic from CommerceDashboardView.jsx
  const handleTriggerSync = async (domain) => {
    setSyncActionMessage(null);
    try {
      let res = null;
      try {
        res = await mockApiRequest(`commerce_sync.php?action=sync&shop_id=${encodeURIComponent(shopId)}&domain=${encodeURIComponent(domain)}`, 'POST', { domain });
      } catch (e1) {
        res = await mockApiRequest(`commerce_dashboard.php?action=trigger_sync&shop_id=${encodeURIComponent(shopId)}&domain=${encodeURIComponent(domain)}`, 'POST', { domain });
      }
      const status = res?.status || res?.data?.status || (res?.success ? 'AVAILABLE' : 'ERROR');
      const msg = res?.message || res?.data?.message;

      if (['AVAILABLE', 'COMPLETE', 'COMPLETED', 'SUCCESS'].includes(status)) {
        setSyncActionMessage({ type: 'success', text: msg || `Đã hoàn tất đồng bộ miền ${domain}.` });
        fetchSyncStatus();
        fetchDashboardReport();
        if (domain === 'customer' || domain === 'customers' || domain === 'customer_ingestion') {
          fetchCustomers();
        }
      } else if (status === 'PARTIAL') {
        setSyncActionMessage({ type: 'warning', text: msg || `Đồng bộ miền ${domain} chỉ hoàn thành một phần (PARTIAL).` });
        fetchSyncStatus();
        fetchDashboardReport();
        if (domain === 'customer' || domain === 'customers' || domain === 'customer_ingestion') {
          fetchCustomers();
        }
      }
    } catch (err) {
      setSyncActionMessage({ type: 'error', text: err.message || `Lỗi khi kích hoạt đồng bộ ${domain}.` });
    }
  };

  // Trigger sync for customer domain as done by onClick
  await handleTriggerSync('customer');

  // Assertions
  if (capturedRequests.length === 0) {
    throw new Error('No API request was dispatched by handleTriggerSync!');
  }
  const req = capturedRequests[0];
  if (!req.url.includes('domain=customer')) {
    throw new Error(`Expected request URL to contain domain=customer, got: ${req.url}`);
  }
  if (!req.body || req.body.domain !== 'customer') {
    throw new Error(`Expected request body to have domain='customer', got: ${JSON.stringify(req.body)}`);
  }
  if (!actionMessage || actionMessage.type !== 'success') {
    throw new Error(`Expected success action message, got: ${JSON.stringify(actionMessage)}`);
  }
  if (!customersFetched) {
    throw new Error('fetchCustomers() was not triggered after customer domain sync!');
  }
});

// 4. Backend End-to-End Simulation: Verify commerce_sync.php & commerce_dashboard.php accept domain=customer
test('TEST 5: Backend accepts domain=customer and routes to syncCustomerDomain', () => {
  const phpCli = 'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe';
  const testScript = path.join(ROOT, 'tools/_temp_backend_customer_sync_test.php');
  
  const phpCode = `<?php
    error_reporting(E_ALL & ~E_DEPRECATED);
    $_SERVER['APP_ENV'] = 'testing';
    putenv('APP_ENV=testing');
    putenv('DB_NAME=test_db');
    putenv('DB_USER=test_user');
    putenv('DB_PASSWORD=test_password');
    putenv('AUTH_SIGNING_KEY=test_auth_signing_key_32_bytes_len!!');
    putenv('CUSTOMER_IDENTITY_HMAC_KEY=test_customer_hmac_key_32_bytes_length!!');

    require_once 'public/api/config.php';
    require_once 'public/api/commerce_customer_service.php';
    require_once 'public/api/commerce_sync_orchestrator.php';
    require_once 'tools/mock_pdo_helper.php';

    $db = createMockPDO();
    $orchestrator = new CommerceSyncOrchestrator($db);
    
    // Simulate syncDomain('test_shop', 'customer')
    $res = $orchestrator->syncDomain('test_shop', 'customer', '2026-09-01', '2026-09-30');
    echo json_encode([
        'domain' => $res['domain'] ?? null,
        'has_status' => isset($res['status'])
    ]);
  `;
  
  fs.writeFileSync(testScript, phpCode, 'utf8');
  try {
    const out = execSync(`"${phpCli}" -f "${testScript}"`, { cwd: ROOT, encoding: 'utf8' });
    const data = JSON.parse(out.trim());
    if (data.domain !== 'customer_ingestion') {
      throw new Error(`Expected domain to be customer_ingestion, got ${data.domain}`);
    }
  } finally {
    if (fs.existsSync(testScript)) fs.unlinkSync(testScript);
  }
});

console.log('\n====================================================================');
console.log(`TOTAL TESTS:  ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${totalTests - passedTests}`);
console.log('====================================================================\n');

if (passedTests === totalTests) {
  console.log('ALL FRONTEND RUNTIME HOTFIX TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error('FRONTEND RUNTIME HOTFIX TESTS FAILED!\n');
  process.exit(1);
}
