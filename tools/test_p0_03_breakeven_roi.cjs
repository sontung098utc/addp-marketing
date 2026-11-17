/**
 * ====================================================================
 * TEST SUITE: P0-04 PRODUCT-SPECIFIC BREAK-EVEN ROI VERIFICATION
 * File: tools/test_p0_03_breakeven_roi.cjs
 * Target: Validates P0-04 Product unit economics, COGS, margin, and break-even ROAS
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
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_r3_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
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
$_ENV['FEATURE_ENABLE_COMMERCE_V2'] = 'true';
$_SERVER['FEATURE_ENABLE_COMMERCE_V2'] = 'true';

require_once '${path.join(PROJECT_ROOT, 'tools', 'mock_pdo_helper.php').replace(/\\/g, '/')}';
require_once '${path.join(PROJECT_ROOT, 'public', 'api', 'commerce_product_cost_service.php').replace(/\\/g, '/')}';

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
console.log('  P0-04 PRODUCT-SPECIFIC BREAK-EVEN ROI VERIFICATION');
console.log(`  PHP Binary: ${PHP_BIN}`);
console.log('====================================================================\n');

// --------------------------------------------------------------------
// TEST 1: Migration 022 and Rollback SQL Integrity
// --------------------------------------------------------------------
runTest('P0-04.1: Migration 20261009_022 and rollback SQL exist and valid', () => {
  const migrationPath = path.join(PROJECT_ROOT, 'database', 'migrations', '20261009_022_create_commerce_product_costs.sql');
  const rollbackPath = path.join(PROJECT_ROOT, 'database', 'migrations', '20261009_022_rollback_commerce_product_costs.sql');

  if (!fs.existsSync(migrationPath)) {
    throw new Error('Missing migration file: 20261009_022_create_commerce_product_costs.sql');
  }
  if (!fs.existsSync(rollbackPath)) {
    throw new Error('Missing rollback migration file: 20261009_022_rollback_commerce_product_costs.sql');
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  if (!sql.includes('commerce_product_costs') || !sql.includes('selling_price') || !sql.includes('cogs_amount') || !sql.includes('breakeven_roas')) {
    throw new Error('Migration SQL lacks required unit economics columns.');
  }

  const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');
  if (rollbackSql.includes('DROP TABLE `commerce_product_costs`') || rollbackSql.includes('DROP TABLE IF EXISTS `commerce_product_costs`')) {
    throw new Error('Rollback SQL violates non-destructive policy by executing DROP TABLE on commerce_product_costs.');
  }
  if (!rollbackSql.includes('RENAME TABLE `commerce_product_costs`') && !rollbackSql.includes('commerce_product_costs_arch_')) {
    throw new Error('Rollback SQL missing safe archival/renaming logic.');
  }
});

// --------------------------------------------------------------------
// TEST 2: Unit Economics & Break-even ROAS Formula Calculation
// --------------------------------------------------------------------
runTest('P0-04.2: calculateBreakEven computes accurate unit margin and break-even ROAS', () => {
  const phpCode = `
    $service = new CommerceProductCostService(createMockPDO());
    // Selling: 250,000, COGS: 90,000, VarCost: 10,000, PlatformFee: 4% (10,000)
    $res = $service->calculateBreakEven(250000.0, 90000.0, 10000.0, 4.0);
    echo json_encode($res);
  `;
  const out = runPhp(phpCode);
  const data = JSON.parse(out);

  if (!data.is_configured) {
    throw new Error('Expected is_configured=true');
  }
  // Fee = 4% * 250,000 = 10,000
  // Unit Margin = 250,000 - 90,000 - 10,000 - 10,000 = 140,000
  if (Math.abs(data.unit_margin - 140000.0) > 0.01) {
    throw new Error(`Expected unit_margin 140,000, got ${data.unit_margin}`);
  }
  // Margin % = 140,000 / 250,000 = 56.00%
  if (Math.abs(data.margin_pct - 56.00) > 0.01) {
    throw new Error(`Expected margin_pct 56.00%, got ${data.margin_pct}`);
  }
  // Break-even ROAS = 1 / 0.56 = 1.79x
  if (Math.abs(data.breakeven_roas - 1.79) > 0.02) {
    throw new Error(`Expected breakeven_roas 1.79x, got ${data.breakeven_roas}`);
  }
});

// --------------------------------------------------------------------
// TEST 3: Optional Target Margin & Target ROAS
// --------------------------------------------------------------------
runTest('P0-04.3: calculateBreakEven computes target ROAS when target margin is given', () => {
  const phpCode = `
    $service = new CommerceProductCostService(createMockPDO());
    // Selling: 250,000, COGS: 90,000, VarCost: 10,000, Fee: 4%, TargetMargin: 15%
    $res = $service->calculateBreakEven(250000.0, 90000.0, 10000.0, 4.0, 15.0);
    echo json_encode($res);
  `;
  const out = runPhp(phpCode);
  const data = JSON.parse(out);

  // Effective margin ratio = 56% - 15% = 41%
  // Target ROAS = 1 / 0.41 = 2.44x
  if (!data.target_roas || Math.abs(data.target_roas - 2.44) > 0.02) {
    throw new Error(`Expected target_roas around 2.44x, got ${data.target_roas}`);
  }
});

// --------------------------------------------------------------------
// TEST 4: Negative Contribution Margin Safety
// --------------------------------------------------------------------
runTest('P0-04.4: Negative contribution margin yields NEGATIVE_MARGIN and null ROAS', () => {
  const phpCode = `
    $service = new CommerceProductCostService(createMockPDO());
    // Selling: 100,000, COGS: 120,000 (Loss per unit)
    $res = $service->calculateBreakEven(100000.0, 120000.0, 5000.0, 4.0);
    echo json_encode($res);
  `;
  const out = runPhp(phpCode);
  const data = JSON.parse(out);

  if (data.status !== 'NEGATIVE_MARGIN') {
    throw new Error(`Expected NEGATIVE_MARGIN, got ${data.status}`);
  }
  if (data.breakeven_roas !== null) {
    throw new Error(`Expected breakeven_roas=null for negative margin, got ${data.breakeven_roas}`);
  }
  if (data.unit_margin >= 0) {
    throw new Error(`Expected negative unit margin, got ${data.unit_margin}`);
  }
});

// --------------------------------------------------------------------
// TEST 5: Insufficient Data / Zero Selling Price Handling
// --------------------------------------------------------------------
runTest('P0-04.5: Zero selling price or COGS yields INSUFFICIENT_DATA with null ROAS', () => {
  const phpCode = `
    $service = new CommerceProductCostService(createMockPDO());
    $res = $service->calculateBreakEven(0.0, 0.0);
    echo json_encode($res);
  `;
  const out = runPhp(phpCode);
  const data = JSON.parse(out);

  if (data.is_configured !== false || data.status !== 'INSUFFICIENT_DATA') {
    throw new Error(`Expected INSUFFICIENT_DATA and is_configured=false, got ${JSON.stringify(data)}`);
  }
  if (data.breakeven_roas !== null) {
    throw new Error('Expected breakeven_roas=null for zero values');
  }
});

// --------------------------------------------------------------------
// TEST 6: Zero Arbitrary Fallback Invariant
// --------------------------------------------------------------------
runTest('P0-04.6: Zero hardcoded fallback ROAS in executable code', () => {
  const costServiceCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_product_cost_service.php'), 'utf8');
  const adsServiceCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_ads_service.php'), 'utf8');

  // Strip comments to verify executable code
  const stripComments = (str) => str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const cleanCostCode = stripComments(costServiceCode);
  const cleanAdsCode = stripComments(adsServiceCode);

  if (cleanCostCode.includes('6.00') || cleanCostCode.includes('15.00')) {
    throw new Error('CommerceProductCostService contains executable hardcoded values');
  }

  if (cleanAdsCode.includes("'breakeven_roas' => 6.0") || cleanAdsCode.includes("'breakeven_roas' => 15.0")) {
    throw new Error('CommerceAdsService contains hardcoded fallback break-even ROAS');
  }
});

// --------------------------------------------------------------------
// TEST 7: Integration in CommerceAdsService::getProductIntelligence
// --------------------------------------------------------------------
runTest('P0-04.7: CommerceAdsService injects product cost fields, cost_status, and roas_vs_breakeven', () => {
  const adsServiceCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_ads_service.php'), 'utf8');

  if (!adsServiceCode.includes('CommerceProductCostService')) {
    throw new Error('CommerceAdsService does not instantiate CommerceProductCostService');
  }
  if (!adsServiceCode.includes("'breakeven_roas'") || !adsServiceCode.includes("'cost_status'") || !adsServiceCode.includes("'roas_vs_breakeven'")) {
    throw new Error('getProductIntelligence does not return required cost fields in products array');
  }
  if (!adsServiceCode.includes('ABOVE_BREAKEVEN') || !adsServiceCode.includes('BELOW_BREAKEVEN')) {
    throw new Error('getProductIntelligence does not calculate ABOVE_BREAKEVEN vs BELOW_BREAKEVEN');
  }
  if (!adsServiceCode.includes('configured_costs_count')) {
    throw new Error('getProductIntelligence does not report configured_costs_count in summary / provenance');
  }
});

// --------------------------------------------------------------------
// TEST 8: API Endpoints in commerce_dashboard.php
// --------------------------------------------------------------------
runTest('P0-04.8: commerce_dashboard.php exposes get_product_costs and save_product_cost endpoints', () => {
  const dashboardCode = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_dashboard.php'), 'utf8');

  if (!dashboardCode.includes("case 'get_product_costs':")) {
    throw new Error('Missing case get_product_costs in commerce_dashboard.php');
  }
  if (!dashboardCode.includes("case 'save_product_cost':")) {
    throw new Error('Missing case save_product_cost in commerce_dashboard.php');
  }
  if (!dashboardCode.includes('$productCostService')) {
    throw new Error('Missing $productCostService initialization in commerce_dashboard.php');
  }
});

// --------------------------------------------------------------------
// TEST 9: Frontend Compliance in CommerceDashboardView.jsx
// --------------------------------------------------------------------
runTest('P0-04.9: CommerceDashboardView.jsx renders break-even ROI columns, evaluation badge, and modal form', () => {
  const uiCode = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'CommerceDashboardView.jsx'), 'utf8');

  if (!uiCode.includes('ROI Hòa Vốn (BEP)')) {
    throw new Error('SPU table missing ROI Hòa Vốn (BEP) column header');
  }
  if (!uiCode.includes('ĐẠT MỤC TIÊU') || !uiCode.includes('DƯỚI HÒA VỐN') || !uiCode.includes('CHƯA THIẾT LẬP')) {
    throw new Error('Missing ROI evaluation badges in SPU table');
  }
  if (!uiCode.includes('Cấu Hình Giá Vốn & ROI Hòa Vốn SPU')) {
    throw new Error('Missing SPU Unit Economics modal header');
  }
  if (!uiCode.includes('handleSaveProductCost') || !uiCode.includes('openCostModal')) {
    throw new Error('Missing cost modal handlers in CommerceDashboardView.jsx');
  }
  if (!uiCode.includes('Bảng Tính Unit Economics Trực Tiếp')) {
    throw new Error('Missing live unit economics calculation preview in modal');
  }
});

// --------------------------------------------------------------------
// TEST 10: PHP Syntax & Duplicate Method Audit
// --------------------------------------------------------------------
runTest('P0-04.10: Zero PHP syntax errors across all touched backend files', () => {
  const out = execSync(`node tools/verify_php_syntax.cjs`, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8'
  });
  if (!out.includes('PHP_SYNTAX_FAIL = 0') || !out.includes('FAILING_FILES = NONE')) {
    throw new Error(`PHP syntax check failed:\n${out}`);
  }
});

console.log('\n====================================================================');
console.log(`P0-04 RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL P0-04 BREAK-EVEN ROI REQUIREMENTS SATISFIED!\n');
}
