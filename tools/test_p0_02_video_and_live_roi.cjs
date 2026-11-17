/**
 * ====================================================================
 * TEST SUITE: P0-02 VIDEO AFFILIATE INTELLIGENCE & P0-03 LIVE GMV MAX METRIC CORRECTION
 * File: tools/test_p0_02_video_and_live_roi.cjs
 * Target: Validates P0-02 and P0-03 requirements
 * ====================================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PHP_BIN = 'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${testName}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✖ [FAIL] ${testName}`);
    console.error(`    -> ${err.message}`);
  }
}

function runPhp(code) {
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_r2_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
  const fullCode = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('AUTH_SIGNING_KEY=test_signing_key_32_bytes_len_1234567!!');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_password');
putenv('FEATURE_ENABLE_COMMERCE_V2=true');

require_once '${path.join(PROJECT_ROOT, 'tools', 'mock_pdo_helper.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'creatives_data.php').replace(/\\/g, '/')}';

${code}
`;
  try {
    fs.writeFileSync(tmpFile, fullCode, 'utf8');
    const out = execSync(`"${PHP_BIN}" "${tmpFile}"`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 15000
    });
    return out.trim();
  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
}

console.log('====================================================================');
console.log('  P0-02 VIDEO INTELLIGENCE & P0-03 LIVE GMV MAX METRIC VERIFICATION');
console.log(`  PHP Binary: ${PHP_BIN}`);
console.log('====================================================================\n');

// --------------------------------------------------------------------
// TEST 1: Zero Mock/Sample Video Templates in creatives_data.php
// --------------------------------------------------------------------
runTest('P0-02.1: Zero hardcoded mock templates and fabricated stats in creatives_data.php', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/creatives_data.php'), 'utf8');
  
  if (code.includes('$baseTemplates =') || code.includes('base_spend_30d') || code.includes('Anh em văn phòng hay nhậu nhẹt')) {
    throw new Error('Found hardcoded mock video templates array in creatives_data.php!');
  }
  if (code.includes('Milo On Diet') || code.includes('7663004624441330965')) {
    throw new Error('Found hardcoded mock video creators/IDs in creatives_data.php!');
  }
});

// --------------------------------------------------------------------
// TEST 2: Zero crc32 Modulo Fake Cancellations & Fake Stories
// --------------------------------------------------------------------
runTest('P0-02.2: Zero crc32 modulo fake cancellation formulas in creatives_data.php', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/creatives_data.php'), 'utf8');
  
  if (code.includes('crc32(') || code.includes('% 5 === 0') || code.includes('% 3 === 0')) {
    throw new Error('Found crc32 modulo pseudo-random cancellation math in creatives_data.php!');
  }
  if (code.includes('trào lưu Mukbang rồi hủy') || code.includes('đặt bốc đồng theo trend mukbang')) {
    throw new Error('Found hardcoded fabricated mukbang cancellation myths in creatives_data.php!');
  }
});

// --------------------------------------------------------------------
// TEST 3: Zero Fabricated Clicks/Impressions in campaigns.php
// --------------------------------------------------------------------
runTest('P0-02.3: Zero calcSpend / 80 or calcSpend / 10 formulas in campaigns.php', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/campaigns.php'), 'utf8');
  
  if (code.includes('$calcSpend / 80') || code.includes('$calcSpend / 10')) {
    throw new Error('Found fabricated clicks or impressions formulas in campaigns.php!');
  }
});

// --------------------------------------------------------------------
// TEST 4: Zero Mock Fallback in App.jsx
// --------------------------------------------------------------------
runTest('P0-02.4: Zero fallback mock mukbang array in App.jsx', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'src/App.jsx'), 'utf8');
  
  if (code.includes('Thử thách ăn lẩu ớt hiểm cấp 7') || code.includes('Xả kho combo 3 tuýp sủi')) {
    throw new Error('Found hardcoded mock high-risk cancellation videos in App.jsx!');
  }
});

// --------------------------------------------------------------------
// TEST 5: Real Verified Cancellation Linking
// --------------------------------------------------------------------
runTest('P0-02.5: determineVideoScriptAndCancellation links to commerce_affiliate_orders accurately', () => {
  const phpScript = `
    $mockPdo = new MockPDO([
        "SELECT \\n                COUNT(DISTINCT affiliate_order_id) as total_aff_orders,\\n                COUNT(DISTINCT CASE WHEN order_status = 'CANCELLED' THEN affiliate_order_id END) as canc_orders,\\n                COALESCE(SUM(CASE WHEN order_status = 'CANCELLED' THEN order_amount ELSE 0.0 END), 0.0) as canc_gmv\\n                FROM \`commerce_affiliate_orders\`\\n                WHERE content_id = :cid" => [
            [
                'total_aff_orders' => 20,
                'canc_orders' => 4,
                'canc_gmv' => 596000.0
            ]
        ]
    ]);

    $res = determineVideoScriptAndCancellation([
        'id' => 'VID_TEST_101',
        'title' => 'Video Review Dược Sĩ',
        'conversions' => 20,
        'author_name' => 'Dược Sĩ Minh'
    ], $mockPdo);

    echo json_encode($res);
  `;

  const output = runPhp(phpScript);
  const parsed = JSON.parse(output);
  if (parsed.cancelled_orders !== 4) {
    throw new Error('Expected 4 cancelled orders, got: ' + parsed.cancelled_orders);
  }
  // 4 / 20 = 20.0% => critical
  if (parsed.cancel_rate !== 20.0 || parsed.cancel_risk_level !== 'critical') {
    throw new Error('Expected 20.0% critical risk level, got: ' + parsed.cancel_rate + ', ' + parsed.cancel_risk_level);
  }
});

// --------------------------------------------------------------------
// TEST 6: P0-03 Ads ROAS vs Blended LIVE ROAS in commerce_dashboard.php
// --------------------------------------------------------------------
runTest('P0-03.1: commerce_dashboard.php separates Ads ROAS from Blended LIVE ROAS', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/commerce_dashboard.php'), 'utf8');
  
  if (!code.includes('attributed_live_gmv') || !code.includes('blended_live_roas') || !code.includes('ads_roas')) {
    throw new Error('Separation of attributed_live_gmv and blended_live_roas missing in commerce_dashboard.php');
  }
  if (!code.includes("'ads_roi' => $adsRoas")) {
    throw new Error('ads_roi should point to authentic Ads ROAS, not blended revenue');
  }
});

// --------------------------------------------------------------------
// TEST 7: P0-03 Source Attribution & Freshness
// --------------------------------------------------------------------
runTest('P0-03.2: get_live_analytics provides source_attribution and data_freshness', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'public/api/commerce_dashboard.php'), 'utf8');
  
  if (!code.includes('source_attribution') || !code.includes('data_freshness')) {
    throw new Error('source_attribution or data_freshness missing from get_live_analytics');
  }
});

// --------------------------------------------------------------------
// TEST 8: P0-03 UI Compliance in CommerceLiveAnalyticsView.jsx
// --------------------------------------------------------------------
runTest('P0-03.3: CommerceLiveAnalyticsView renders Ads ROAS and Blended LIVE ROAS clearly', () => {
  const code = fs.readFileSync(path.join(PROJECT_ROOT, 'src/CommerceLiveAnalyticsView.jsx'), 'utf8');
  
  if (!code.includes('Ads ROAS (Attributed)') || !code.includes('Blended:')) {
    throw new Error('Ads ROAS and Blended label missing in CommerceLiveAnalyticsView.jsx');
  }
});

// --------------------------------------------------------------------
// TEST 9: PHP Syntax Verification
// --------------------------------------------------------------------
runTest('P0-02/P0-03.4: Zero PHP syntax errors in modified files', () => {
  const files = [
    'public/api/creatives_data.php',
    'public/api/campaigns.php',
    'public/api/commerce_dashboard.php'
  ];

  for (const f of files) {
    const fullPath = path.join(PROJECT_ROOT, f);
    execSync(`"${PHP_BIN}" -l "${fullPath}"`, { encoding: 'utf8' });
  }
});

console.log('\n====================================================================');
console.log(`P0-02/P0-03 RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL P0-02 & P0-03 REQUIREMENTS SATISFIED!\n');
}
