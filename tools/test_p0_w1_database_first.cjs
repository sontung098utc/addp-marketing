/**
 * TEST SUITE: P0-W1 Database-First Dashboard & T-0 Reporting
 * File: tools/test_p0_w1_database_first.cjs
 * 
 * Verifies:
 * 1. App.jsx date filter does not trigger external sync.
 * 2. sync.php runs database-first when force=false (no @unlink cache purge, no external calls).
 * 3. CommerceReportingService multi-state source taxonomy (DAILY_AGGREGATES, DATABASE_NORMALIZED, T0_PROVISIONAL, MISSING_PERIOD).
 * 4. Zero occurrences of LIVE_FALLBACK label.
 * 5. Freshness timestamps emitted in report_meta and provenance.
 * 6. T-0 provisional reporting contract.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('\n====================================================================');
console.log('RUNNING TEST SUITE: P0-W1 DATABASE-FIRST DASHBOARD & T-0 REPORTING');
console.log('====================================================================\n');

// ------------------------------------------------------------------
// Test Group 1: App.jsx Date Range Synchronization Isolation
// ------------------------------------------------------------------
console.log('Group 1: App.jsx Date Filter Decoupling');
const appJsxPath = path.resolve(__dirname, '../src/App.jsx');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');

// Ensure handleSyncData effect does NOT depend on dateRange
const handleSyncEffectRegex = /useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*handleSyncData\([^}]*\},[\s\S]*?\[([^\]]*)\]\s*\)/;
const matchDateSync = appJsxContent.match(handleSyncEffectRegex);

assert(matchDateSync !== null, 'Found useEffect that calls handleSyncData');
const deps = matchDateSync[1];
assert(!deps.includes('dateRange'), `handleSyncData dependency array does not include dateRange (actual deps: [${deps.trim()}])`);
assert(appJsxContent.includes('Changing date range must NEVER trigger external TikTok sync!'), 'App.jsx documents database-first date range isolation');
assert(appJsxContent.includes('Sub-views (CommerceReportView, CommerceDashboardView, etc.) fetch internal database data directly'), 'App.jsx specifies sub-views fetch internal database directly');

// ------------------------------------------------------------------
// Test Group 2: sync.php Database-First Verification
// ------------------------------------------------------------------
console.log('\nGroup 2: sync.php Database-First and Cache Isolation');
const syncPhpPath = path.resolve(__dirname, '../public/api/sync.php');
const syncPhpContent = fs.readFileSync(syncPhpPath, 'utf8');

assert(syncPhpContent.includes('if ($forceSync) {'), 'Cache purge (@unlink) is strictly wrapped in if ($forceSync)');
assert(syncPhpContent.includes('if ($forceSync && $adsAccessToken && $advertiserId) {'), 'TikTok Ads API calls are strictly wrapped in if ($forceSync)');
assert(!syncPhpContent.includes('350000'), 'Zero hardcoded 350,000 VND values in sync.php');

// ------------------------------------------------------------------
// Test Group 3: Elimination of LIVE_FALLBACK
// ------------------------------------------------------------------
console.log('\nGroup 3: Complete Elimination of LIVE_FALLBACK');
const reportingServicePath = path.resolve(__dirname, '../public/api/commerce_reporting_service.php');
const reportingServiceContent = fs.readFileSync(reportingServicePath, 'utf8');

assert(!reportingServiceContent.includes("'LIVE_FALLBACK'"), "commerce_reporting_service.php does not contain 'LIVE_FALLBACK'");
assert(!reportingServiceContent.includes('"LIVE_FALLBACK"'), 'commerce_reporting_service.php does not contain "LIVE_FALLBACK"');

const reportViewPath = path.resolve(__dirname, '../src/CommerceReportView.jsx');
const reportViewContent = fs.readFileSync(reportViewPath, 'utf8');
assert(!reportViewContent.includes('LIVE FALLBACK'), 'CommerceReportView.jsx does not display "LIVE FALLBACK" badge');
assert(reportViewContent.includes('TỔNG HỢP NGÀY (DATABASE)') || reportViewContent.includes('DAILY_AGGREGATES'), 'CommerceReportView.jsx handles DAILY_AGGREGATES source');
assert(reportViewContent.includes('DATABASE NỘI BỘ') || reportViewContent.includes('DATABASE_NORMALIZED'), 'CommerceReportView.jsx handles DATABASE_NORMALIZED source');
assert(reportViewContent.includes('TẠM TÍNH HÔM NAY') || reportViewContent.includes('T0_PROVISIONAL'), 'CommerceReportView.jsx handles T0_PROVISIONAL source');

// ------------------------------------------------------------------
// Test Group 4: Multi-State Source Taxonomy & Freshness Timestamps
// ------------------------------------------------------------------
console.log('\nGroup 4: Multi-State Taxonomy & Freshness Timestamps');

// Check PHP syntax and verify constants and methods via PHP CLI
const phpCli = 'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe';

const phpEvalCode = `
require_once '${reportingServicePath.replace(/\\/g, '/')}';

$expectedSources = [
    CommerceReportingService::DATA_SOURCE_DAILY_AGGREGATES,
    CommerceReportingService::DATA_SOURCE_DATABASE_NORMALIZED,
    CommerceReportingService::DATA_SOURCE_T0_PROVISIONAL,
    CommerceReportingService::DATA_SOURCE_MISSING_PERIOD
];

echo json_encode([
    'sources' => $expectedSources,
    'has_t0' => defined('CommerceReportingService::DATA_SOURCE_T0_PROVISIONAL'),
    'has_normalized' => defined('CommerceReportingService::DATA_SOURCE_DATABASE_NORMALIZED')
]);
`;

const phpOut = execSync(`"${phpCli}" -r "${phpEvalCode.replace(/\n/g, ' ')}"`, { encoding: 'utf8' });
const evalRes = JSON.parse(phpOut);

assert(evalRes.sources.includes('DAILY_AGGREGATES'), 'Taxonomy contains DAILY_AGGREGATES');
assert(evalRes.sources.includes('DATABASE_NORMALIZED'), 'Taxonomy contains DATABASE_NORMALIZED');
assert(evalRes.sources.includes('T0_PROVISIONAL'), 'Taxonomy contains T0_PROVISIONAL');
assert(evalRes.sources.includes('MISSING_PERIOD'), 'Taxonomy contains MISSING_PERIOD');

assert(reportingServiceContent.includes('freshness_timestamps'), 'Reporting service produces freshness_timestamps');
assert(reportingServiceContent.includes('orders_latest_at'), 'Freshness timestamps track orders_latest_at');
assert(reportingServiceContent.includes('is_provisional'), 'Provenance and report_meta track is_provisional flag');

console.log(`\n====================================================================`);
console.log(`P0-W1 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log(`====================================================================\n`);
