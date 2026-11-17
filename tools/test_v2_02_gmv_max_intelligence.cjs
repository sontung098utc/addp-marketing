/**
 * ADDP Commerce Intelligence V2
 * Sprint V2-02: GMV Max Advertising Intelligence Acceptance Test Suite
 *
 * Comprehensive Automated Tests for:
 * 1. Migration 012 Schema & Rollback contracts
 * 2. TikTok Marketing API Client parameter builders & fail-fast guards
 * 3. Creative delivery status normalization & typo resilience (NOT_DELIVERYING)
 * 4. Creative item_id normalization & unattributed traffic handling (-1)
 * 5. Semantic Opportunity Patterns (No unconfigured ROI judgment, configured Target ROAS comparison)
 * 6. Zero-cost attribution has no causal claims
 * 7. Multi-Grain Hierarchy Reconciliation (Levels A, B, C, D)
 * 8. Creative exclusion from total spend summation
 * 9. NOT_COMPARABLE for incompatible grains
 * 10. LIVE GMV Max room_id retention and SESSION_MAPPING_PENDING contract
 * 11. Product SPU RUNTIME_VERIFIED_MAPPING & pre-aggregated join integrity
 * 12. Dashboard Router Actions (16, 17, 18, 19, trigger_sync)
 * 13. Frontend code integrity & Vite production build
 * 14. Rollback documentation data loss warning & missing != zero
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
    console.log(`  ✓ [PASS] ${testName}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName}`);
    console.error(`    -> ${err.message}`);
  }
}

function runPhp(code) {
  const tmpFile = path.join(PROJECT_ROOT, 'tools', `tmp_test_${Date.now()}_${Math.random().toString(36).substring(7)}.php`);
  const fullCode = `<?php
error_reporting(E_ALL & ~E_DEPRECATED);
$_SERVER['APP_ENV'] = 'testing';
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');
putenv('AUTH_SIGNING_KEY=test_v202_key_32_bytes_length!!');
putenv('DB_NAME=test_db');
putenv('DB_USER=test_user');
putenv('DB_PASSWORD=test_pass');

class MockPDOStatement extends PDOStatement {
    private array $data;
    private int $idx = 0;
    public function __construct(array $data = []) { $this->data = $data; }
    public function execute(?array $params = null): bool { $this->idx = 0; return true; }
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed {
        if ($this->idx >= count($this->data)) return false;
        return $this->data[$this->idx++];
    }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array {
        return $this->data;
    }
    public function fetchColumn(int $column = 0): mixed {
        if ($this->idx >= count($this->data)) return false;
        $row = $this->data[$this->idx++];
        if (is_array($row)) {
            $vals = array_values($row);
            return $vals[$column] ?? false;
        }
        return $row;
    }
}

class MockPDO extends PDO {
    private array $customResponses = [];
    public function __construct(array $customResponses = []) {
        $this->customResponses = $customResponses;
    }
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false {
        return $this->findStatement($query);
    }
    public function prepare(string $query, array $options = []): PDOStatement|false {
        return $this->findStatement($query);
    }
    private function findStatement(string $query): MockPDOStatement {
        if (stripos($query, 'SHOW TABLES') !== false) {
            foreach ($this->customResponses as $pattern => $data) {
                if (stripos($pattern, 'SHOW TABLES') !== false) return new MockPDOStatement($data);
            }
            return new MockPDOStatement([['table' => 'exists']]);
        }
        if (stripos(ltrim($query), 'SELECT COUNT') === 0) {
            foreach ($this->customResponses as $pattern => $data) {
                if (stripos($pattern, 'COUNT') !== false && stripos($query, (string)$pattern) !== false) {
                    return new MockPDOStatement($data);
                }
            }
            return new MockPDOStatement([[1]]);
        }
        if (stripos(ltrim($query), 'SELECT SUM(cost)') === 0) {
            foreach ($this->customResponses as $pattern => $data) {
                if (stripos($pattern, 'SUM(cost)') !== false) {
                    return new MockPDOStatement($data);
                }
            }
            return new MockPDOStatement([[600000]]);
        }
        $keys = array_keys($this->customResponses);
        usort($keys, function($a, $b) { return strlen((string)$b) <=> strlen((string)$a); });
        foreach ($keys as $pattern) {
            if (stripos($pattern, 'SHOW TABLES') === false && stripos($query, (string)$pattern) !== false) {
                return new MockPDOStatement($this->customResponses[$pattern]);
            }
        }
        return new MockPDOStatement([]);
    }
}

${code}
`;
  fs.writeFileSync(tmpFile, fullCode);
  try {
    const output = execSync(`"${PHP_BIN}" "${tmpFile}"`, { encoding: 'utf8', cwd: PROJECT_ROOT });
    return output.trim();
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

console.log('======================================================================');
console.log('SPRINT V2-02: GMV MAX ADVERTISING INTELLIGENCE ACCEPTANCE TESTS');
console.log('======================================================================\n');

// --------------------------------------------------------------------
// SUITE 1: DATABASE MIGRATION 012 & ROLLBACK CONTRACTS
// --------------------------------------------------------------------
console.log('[SUITE 1] Database Migration 012 & Rollback Schema Contracts');

const migration012Path = path.join(PROJECT_ROOT, 'database', 'migrations', '20261004_012_create_commerce_ads_intelligence_tables.sql');
const rollback012Path = path.join(PROJECT_ROOT, 'database', 'migrations', '20261004_012_rollback_commerce_ads_intelligence_tables.sql');

runTest('Migration 012 file exists', () => {
  if (!fs.existsSync(migration012Path)) throw new Error('Migration 012 file missing');
});

runTest('Rollback 012 file exists', () => {
  if (!fs.existsSync(rollback012Path)) throw new Error('Rollback 012 file missing');
});

const migrationSql = fs.readFileSync(migration012Path, 'utf8');
const rollbackSql = fs.readFileSync(rollback012Path, 'utf8');

runTest('Migration 012 creates commerce_ads_product_daily with correct unique key', () => {
  if (!migrationSql.includes('CREATE TABLE IF NOT EXISTS `commerce_ads_product_daily`')) {
    throw new Error('commerce_ads_product_daily table creation not found');
  }
  if (!migrationSql.includes('UNIQUE KEY `uniq_shop_camp_prod_date` (`platform`, `shop_id`, `campaign_id`, `item_group_id`, `stat_date`)')) {
    throw new Error('commerce_ads_product_daily unique key mismatch');
  }
});

runTest('Migration 012 creates commerce_ads_creative_daily with raw and normalized status', () => {
  if (!migrationSql.includes('CREATE TABLE IF NOT EXISTS `commerce_ads_creative_daily`')) {
    throw new Error('commerce_ads_creative_daily table creation not found');
  }
  if (!migrationSql.includes('UNIQUE KEY `uniq_shop_camp_item_creative_date` (`platform`, `shop_id`, `campaign_id`, `item_group_id`, `item_id`, `stat_date`)')) {
    throw new Error('commerce_ads_creative_daily unique key mismatch');
  }
  if (!migrationSql.includes('`creative_delivery_status_raw`') || !migrationSql.includes('`creative_delivery_status_normalized`')) {
    throw new Error('commerce_ads_creative_daily missing raw or normalized delivery status columns');
  }
  if (!migrationSql.includes('`is_unattributed` TINYINT(1)')) {
    throw new Error('commerce_ads_creative_daily missing is_unattributed flag');
  }
});

runTest('Migration 012 creates commerce_ads_live_daily with SESSION_MAPPING_PENDING default', () => {
  if (!migrationSql.includes('CREATE TABLE IF NOT EXISTS `commerce_ads_live_daily`')) {
    throw new Error('commerce_ads_live_daily table creation not found');
  }
  if (!migrationSql.includes('UNIQUE KEY `uniq_shop_camp_room_date` (`platform`, `shop_id`, `campaign_id`, `room_id`, `stat_date`)')) {
    throw new Error('commerce_ads_live_daily unique key mismatch');
  }
  if (!migrationSql.includes("`session_mapping_status` VARCHAR(64) NOT NULL DEFAULT 'SESSION_MAPPING_PENDING'")) {
    throw new Error('commerce_ads_live_daily missing session_mapping_status default');
  }
});

runTest('Rollback 012 drops all 3 new intelligence tables safely', () => {
  if (!rollbackSql.includes('DROP TABLE IF EXISTS `commerce_ads_live_daily`')) throw new Error('Missing drop live table');
  if (!rollbackSql.includes('DROP TABLE IF EXISTS `commerce_ads_creative_daily`')) throw new Error('Missing drop creative table');
  if (!rollbackSql.includes('DROP TABLE IF EXISTS `commerce_ads_product_daily`')) throw new Error('Missing drop product table');
});

// --------------------------------------------------------------------
// SUITE 2: TIKTOK MARKETING API CLIENT CONTRACTS & GUARDS
// --------------------------------------------------------------------
console.log('\n[SUITE 2] TikTok Marketing API Client Contract & Validation Guards');

runTest('API Client PHP syntax is valid', () => {
  const res = execSync(`"${PHP_BIN}" -l "${path.join(PROJECT_ROOT, 'public', 'api', 'tiktok_gmv_max_api_client.php')}"`, { encoding: 'utf8' });
  if (!res.includes('No syntax errors detected')) throw new Error(res);
});

runTest('buildProductReportParams fails fast when campaign_ids is empty', () => {
  const code = `
    require_once 'public/api/tiktok_gmv_max_api_client.php';
    $client = new TikTokGmvMaxApiClient();
    try {
      $client->buildProductReportParams('123456789', '2026-09-01', '2026-09-01', []);
      echo "FAIL: Should have thrown";
    } catch (InvalidArgumentException $e) {
      echo "OK: " . $e->getMessage();
    }
  `;
  const out = runPhp(code);
  if (!out.startsWith('OK:')) throw new Error(out);
});

runTest('buildProductReportParams strictly prohibits gmv_max_promotion_types', () => {
  const code = `
    require_once 'public/api/tiktok_gmv_max_api_client.php';
    $client = new TikTokGmvMaxApiClient();
    $params = $client->buildProductReportParams('123456789', '2026-09-01', '2026-09-01', ['1837532349091922']);
    $filtering = $params['filtering'];
    if (isset($filtering['gmv_max_promotion_types'])) {
      echo "FAIL: Contains gmv_max_promotion_types";
    } else {
      echo "OK";
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('buildProductReportParams generates dimensions (campaign_id, item_group_id, stat_time_day)', () => {
  const code = `
    require_once 'public/api/tiktok_gmv_max_api_client.php';
    $client = new TikTokGmvMaxApiClient();
    $params = $client->buildProductReportParams('123456789', '2026-09-01', '2026-09-01', ['1837532349091922']);
    $dims = $params['dimensions'];
    if ($dims === ['campaign_id', 'item_group_id', 'stat_time_day']) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($dims);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('buildCreativeReportParams fails fast when campaign_ids or item_group_ids is missing', () => {
  const code = `
    require_once 'public/api/tiktok_gmv_max_api_client.php';
    $client = new TikTokGmvMaxApiClient();
    $caught1 = false;
    try {
      $client->buildCreativeReportParams('123456789', '2026-09-01', '2026-09-01', [], ['1730030612053166929']);
    } catch (InvalidArgumentException $e) {
      $caught1 = true;
    }

    $caught2 = false;
    try {
      $client->buildCreativeReportParams('123456789', '2026-09-01', '2026-09-01', ['1837532349091922'], []);
    } catch (InvalidArgumentException $e) {
      $caught2 = true;
    }

    if ($caught1 && $caught2) {
      echo "OK";
    } else {
      echo "FAIL: caught1=$caught1, caught2=$caught2";
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('buildCreativeReportParams generates dimensions (campaign_id, item_group_id, item_id, stat_time_day)', () => {
  const code = `
    require_once 'public/api/tiktok_gmv_max_api_client.php';
    $client = new TikTokGmvMaxApiClient();
    $params = $client->buildCreativeReportParams('123456789', '2026-09-01', '2026-09-01', ['1837532349091922'], ['1730030612053166929']);
    $dims = $params['dimensions'];
    if ($dims === ['campaign_id', 'item_group_id', 'item_id', 'stat_time_day']) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($dims);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('buildLiveReportParams generates dimensions (campaign_id, room_id, stat_time_day)', () => {
  const code = `
    require_once 'public/api/tiktok_gmv_max_api_client.php';
    $client = new TikTokGmvMaxApiClient();
    $params = $client->buildLiveReportParams('123456789', '2026-09-01', '2026-09-01', ['1837532349091922']);
    $dims = $params['dimensions'];
    if ($dims === ['campaign_id', 'room_id', 'stat_time_day']) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($dims);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

// --------------------------------------------------------------------
// SUITE 3: STATUS NORMALIZATION & ATTRIBUTED/UNATTRIBUTED HANDLING
// --------------------------------------------------------------------
console.log('\n[SUITE 3] Creative Status Normalization & Unattributed Bucket (-1)');

runTest('raw NOT_DELIVERYING preserved: retains exact TikTok API typo', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [['table' => 'commerce_ads_creative_daily']],
      'commerce_ads_creative_daily' => [
        ['item_id' => '7333', 'item_group_id' => 'SPU1', 'campaign_id' => 'C1', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'raw_status' => 'NOT_DELIVERYING', 'norm_status' => 'NOT_DELIVERING', 'is_unattributed' => 0, 'total_spend' => 0, 'total_ads_gross_revenue' => 0, 'total_ads_orders' => 0, 'avg_api_roi' => 0]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->getVideoIntelligence('7495657895504611503', '2026-09-01', '2026-09-01');
    $c = $res['creatives'][0];
    if ($c['creative_delivery_status_raw'] === 'NOT_DELIVERYING') {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($c);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('normalized NOT_DELIVERING: maps NOT_DELIVERYING typo to NOT_DELIVERING', () => {
  const code = `
    require_once 'public/api/tiktok_gmv_max_api_client.php';
    $norm = TikTokGmvMaxApiClient::normalizeCreativeDeliveryStatus('NOT_DELIVERYING');
    if ($norm === 'NOT_DELIVERING') {
      echo "OK";
    } else {
      echo "FAIL: " . $norm;
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('unknown creative status preserved + normalized UNKNOWN', () => {
  const code = `
    require_once 'public/api/tiktok_gmv_max_api_client.php';
    $tests = [
      'DELIVERING' => 'DELIVERING',
      'AUTHORIZATION_NEEDED' => 'AUTHORIZATION_NEEDED',
      'IN_QUEUE' => 'IN_QUEUE',
      'FUTURE_UNKNOWN_STATUS' => 'UNKNOWN',
      '' => 'UNKNOWN',
      null => 'UNKNOWN'
    ];
    foreach ($tests as $input => $expected) {
      $actual = TikTokGmvMaxApiClient::normalizeCreativeDeliveryStatus($input);
      if ($actual !== $expected) {
        echo "FAIL on $input: expected $expected, got $actual";
        exit;
      }
    }
    echo "OK";
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('normalizeCreativeItemId flags item_id = -1 as is_unattributed = true', () => {
  const code = `
    require_once 'public/api/tiktok_gmv_max_api_client.php';
    $res1 = TikTokGmvMaxApiClient::normalizeCreativeItemId(-1);
    $res2 = TikTokGmvMaxApiClient::normalizeCreativeItemId('-1');
    $res3 = TikTokGmvMaxApiClient::normalizeCreativeItemId('7412345678901234567');

    if ($res1['item_id'] === '-1' && $res1['is_unattributed'] === true &&
        $res2['item_id'] === '-1' && $res2['is_unattributed'] === true &&
        $res3['item_id'] === '7412345678901234567' && $res3['is_unattributed'] === false) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode([$res1, $res2, $res3]);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

// --------------------------------------------------------------------
// SUITE 4: SEMANTIC OPPORTUNITY PATTERNS & FACTUAL ROAS COMPARISON
// --------------------------------------------------------------------
console.log('\n[SUITE 4] Semantic Opportunity Patterns & Factual Evaluation');

runTest('no unconfigured ROI judgment: no subjective performing/inefficient labels when unconfigured', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [['table' => 'commerce_ads_creative_daily']],
      'commerce_ads_creative_daily' => [
        ['item_id' => '7111', 'item_group_id' => 'SPU1', 'campaign_id' => 'C1', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'raw_status' => 'DELIVERING', 'norm_status' => 'DELIVERING', 'is_unattributed' => 0, 'total_spend' => 100000, 'total_ads_gross_revenue' => 500000, 'total_ads_orders' => 5, 'avg_api_roi' => 5.0]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->getVideoIntelligence('7495657895504611503', '2026-09-01', '2026-09-01');
    $creative = $res['creatives'][0];
    if ($creative['target_roas_status'] === 'NO_TARGET_CONFIGURED' &&
        $creative['target_roas_label'] === 'Chưa cấu hình Target ROAS' &&
        $res['optimization_groups']['target_roas_comparison']['is_configured'] === false) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($creative);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('configured Target ROAS comparison: classifies MET_TARGET_ROAS and BELOW_TARGET_ROAS', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [['table' => 'commerce_ads_creative_daily']],
      'commerce_ads_creative_daily' => [
        ['item_id' => '7111', 'item_group_id' => 'SPU1', 'campaign_id' => 'C1', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'raw_status' => 'DELIVERING', 'norm_status' => 'DELIVERING', 'is_unattributed' => 0, 'total_spend' => 100000, 'total_ads_gross_revenue' => 600000, 'total_ads_orders' => 6, 'avg_api_roi' => 6.0],
        ['item_id' => '7222', 'item_group_id' => 'SPU1', 'campaign_id' => 'C1', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'raw_status' => 'DELIVERING', 'norm_status' => 'DELIVERING', 'is_unattributed' => 0, 'total_spend' => 100000, 'total_ads_gross_revenue' => 300000, 'total_ads_orders' => 3, 'avg_api_roi' => 3.0]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->getVideoIntelligence('7495657895504611503', '2026-09-01', '2026-09-01', ['target_roas' => 5.0]);
    $c1 = $res['creatives'][0];
    $c2 = $res['creatives'][1];
    $comparison = $res['optimization_groups']['target_roas_comparison'];
    if ($c1['target_roas_status'] === 'MET_TARGET_ROAS' && $c1['target_roas_label'] === 'Đạt Target ROAS' &&
        $c2['target_roas_status'] === 'BELOW_TARGET_ROAS' && $c2['target_roas_label'] === 'Dưới Target ROAS' &&
        $comparison['met_target_count'] === 1 && $comparison['below_target_count'] === 1) {
      echo "OK";
    } else {
      echo "FAIL: c1=" . json_encode($c1) . " c2=" . json_encode($c2);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('zero-cost attribution has no causal claim: strictly factual wording without speculation', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [['table' => 'commerce_ads_creative_daily']],
      'commerce_ads_creative_daily' => [
        ['item_id' => '7555', 'item_group_id' => 'SPU1', 'campaign_id' => 'C1', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'raw_status' => 'DELIVERING', 'norm_status' => 'DELIVERING', 'is_unattributed' => 0, 'total_spend' => 0, 'total_ads_gross_revenue' => 300000, 'total_ads_orders' => 2, 'avg_api_roi' => 0]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->getVideoIntelligence('7495657895504611503', '2026-09-01', '2026-09-01');
    $zeroCost = $res['optimization_groups']['zero_cost_attribution'];
    $expectedDesc = 'API ghi nhận đơn hàng/doanh thu được phân bổ trong kỳ nhưng chi phí ghi nhận trong kỳ bằng 0.';
    if ($zeroCost['description'] === $expectedDesc &&
        strpos($zeroCost['description'], 'chuyển đổi trễ') === false &&
        strpos($zeroCost['description'], 'lan tỏa tự nhiên') === false &&
        strpos($zeroCost['investigation_guidance'], 'chuyển đổi trễ') === false &&
        strpos($zeroCost['investigation_guidance'], 'lan tỏa tự nhiên') === false &&
        $zeroCost['count'] === 1) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($zeroCost);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

// --------------------------------------------------------------------
// SUITE 5: MULTI-GRAIN HIERARCHY RECONCILIATION
// --------------------------------------------------------------------
console.log('\n[SUITE 5] Multi-Grain Hierarchy Reconciliation Matrix');

runTest('Product campaign vs Product facts reconciliation (Level A): matches within tolerance', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [
        ['table' => 'commerce_ads_campaign_daily'],
        ['table' => 'commerce_ads_product_daily'],
        ['table' => 'commerce_ads_live_daily'],
        ['table' => 'commerce_ads_creative_daily']
      ],
      'commerce_ads_campaign_daily' => [
        ['campaign_id' => 'C_PROD', 'campaign_type' => 'PRODUCT_GMV_MAX', 'campaign_name' => 'Prod Camp', 'stat_date' => '2026-09-01', 'spend' => 500000, 'total_spend' => 500000, 'net_cost' => 500000, 'gross_revenue' => 2500000, 'total_gross_revenue' => 2500000, 'orders' => 25, 'total_orders' => 25, 'roi' => 5.0, 'cost_per_order' => 20000, 'operation_status' => 'ENABLE', 'budget' => 1000000, 'target_roas' => 5.0, 'is_active' => 1],
        ['campaign_id' => 'C_LIVE', 'campaign_type' => 'LIVE_GMV_MAX', 'campaign_name' => 'Live Camp', 'stat_date' => '2026-09-01', 'spend' => 500000, 'total_spend' => 500000, 'net_cost' => 500000, 'gross_revenue' => 2500000, 'total_gross_revenue' => 2500000, 'orders' => 25, 'total_orders' => 25, 'roi' => 5.0, 'cost_per_order' => 20000, 'operation_status' => 'ENABLE', 'budget' => 1000000, 'target_roas' => 5.0, 'is_active' => 1]
      ],
      'commerce_ads_product_daily' => [
        ['item_group_id' => 'SPU1', 'campaign_id' => 'C_PROD', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'total_spend' => 500000, 'spend' => 500000, 'cost' => 500000, 'total_net_cost' => 500000, 'total_ads_gross_revenue' => 2500000, 'total_ads_orders' => 25, 'avg_api_roi' => 5.0, 'source_type' => 'TIKTOK_GMV_MAX_API']
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->reconcileMultiGrain('7495657895504611503', '2026-09-01', '2026-09-01');
    $levelA = $res['hierarchy_reconciliation']['level_a_product'];
    if ($levelA['status'] === 'MATCH' && $levelA['variance'] <= 1000) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($levelA);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('LIVE campaign vs Room facts reconciliation (Level B): matches within tolerance', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [
        ['table' => 'commerce_ads_campaign_daily'],
        ['table' => 'commerce_ads_product_daily'],
        ['table' => 'commerce_ads_live_daily'],
        ['table' => 'commerce_ads_creative_daily']
      ],
      'commerce_ads_campaign_daily' => [
        ['campaign_id' => 'C_PROD', 'campaign_type' => 'PRODUCT_GMV_MAX', 'campaign_name' => 'Prod Camp', 'stat_date' => '2026-09-01', 'spend' => 500000, 'total_spend' => 500000, 'net_cost' => 500000, 'gross_revenue' => 2500000, 'total_gross_revenue' => 2500000, 'orders' => 25, 'total_orders' => 25, 'roi' => 5.0, 'cost_per_order' => 20000, 'operation_status' => 'ENABLE', 'budget' => 1000000, 'target_roas' => 5.0, 'is_active' => 1],
        ['campaign_id' => 'C_LIVE', 'campaign_type' => 'LIVE_GMV_MAX', 'campaign_name' => 'Live Camp', 'stat_date' => '2026-09-01', 'spend' => 500000, 'total_spend' => 500000, 'net_cost' => 500000, 'gross_revenue' => 2500000, 'total_gross_revenue' => 2500000, 'orders' => 25, 'total_orders' => 25, 'roi' => 5.0, 'cost_per_order' => 20000, 'operation_status' => 'ENABLE', 'budget' => 1000000, 'target_roas' => 5.0, 'is_active' => 1]
      ],
      'commerce_ads_live_daily' => [
        ['room_id' => 'R100', 'campaign_id' => 'C_LIVE', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'total_spend' => 500000, 'spend' => 500000, 'cost' => 500000, 'total_net_cost' => 500000, 'total_ads_gross_revenue' => 2500000, 'total_ads_orders' => 25, 'avg_api_roi' => 5.0]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->reconcileMultiGrain('7495657895504611503', '2026-09-01', '2026-09-01');
    $levelB = $res['hierarchy_reconciliation']['level_b_live'];
    if ($levelB['status'] === 'MATCH' && $levelB['variance'] <= 1000) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($levelB);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('Total campaign vs Product + LIVE campaign reconciliation (Level C): matches invariant', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [
        ['table' => 'commerce_ads_campaign_daily'],
        ['table' => 'commerce_ads_product_daily'],
        ['table' => 'commerce_ads_live_daily'],
        ['table' => 'commerce_ads_creative_daily']
      ],
      'commerce_ads_campaign_daily' => [
        ['campaign_id' => 'C_PROD', 'campaign_type' => 'PRODUCT_GMV_MAX', 'campaign_name' => 'Prod Camp', 'stat_date' => '2026-09-01', 'spend' => 600000, 'total_spend' => 600000, 'net_cost' => 600000, 'gross_revenue' => 3000000, 'total_gross_revenue' => 3000000, 'orders' => 30, 'total_orders' => 30, 'roi' => 5.0, 'cost_per_order' => 20000, 'operation_status' => 'ENABLE', 'budget' => 1000000, 'target_roas' => 5.0, 'is_active' => 1],
        ['campaign_id' => 'C_LIVE', 'campaign_type' => 'LIVE_GMV_MAX', 'campaign_name' => 'Live Camp', 'stat_date' => '2026-09-01', 'spend' => 400000, 'total_spend' => 400000, 'net_cost' => 400000, 'gross_revenue' => 2000000, 'total_gross_revenue' => 2000000, 'orders' => 20, 'total_orders' => 20, 'roi' => 5.0, 'cost_per_order' => 20000, 'operation_status' => 'ENABLE', 'budget' => 1000000, 'target_roas' => 5.0, 'is_active' => 1]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->reconcileMultiGrain('7495657895504611503', '2026-09-01', '2026-09-01');
    $levelC = $res['hierarchy_reconciliation']['level_c_total'];
    if ($levelC['status'] === 'MATCH' && $levelC['total_cost'] === 1000000.0 && $levelC['component_sum'] === 1000000.0) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($levelC);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('Product vs Creative reconciliation at compatible grain (Level D): matches compatible pairs', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [
        ['table' => 'commerce_ads_campaign_daily'],
        ['table' => 'commerce_ads_product_daily'],
        ['table' => 'commerce_ads_live_daily'],
        ['table' => 'commerce_ads_creative_daily']
      ],
      'commerce_ads_campaign_daily' => [
        ['campaign_id' => 'C_PROD', 'campaign_type' => 'PRODUCT_GMV_MAX', 'campaign_name' => 'Prod Camp', 'stat_date' => '2026-09-01', 'spend' => 600000, 'total_spend' => 600000, 'net_cost' => 600000, 'gross_revenue' => 3000000, 'total_gross_revenue' => 3000000, 'orders' => 30, 'total_orders' => 30, 'roi' => 5.0, 'cost_per_order' => 20000, 'operation_status' => 'ENABLE', 'budget' => 1000000, 'target_roas' => 5.0, 'is_active' => 1]
      ],
      'commerce_ads_product_daily' => [
        ['item_group_id' => 'SPU1', 'campaign_id' => 'C_PROD', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'total_spend' => 600000, 'cost' => 600000, 'total_net_cost' => 600000, 'total_ads_gross_revenue' => 3000000, 'total_ads_orders' => 30, 'avg_api_roi' => 5.0, 'source_type' => 'TIKTOK_GMV_MAX_API']
      ],
      'commerce_ads_creative_daily' => [
        ['item_id' => 'CR1', 'item_group_id' => 'SPU1', 'campaign_id' => 'C_PROD', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'raw_status' => 'DELIVERING', 'norm_status' => 'DELIVERING', 'is_unattributed' => 0, 'total_spend' => 600000, 'cost' => 600000, 'creative_spend' => 600000, 'total_net_cost' => 600000, 'total_ads_gross_revenue' => 3000000, 'total_ads_orders' => 30, 'avg_api_roi' => 5.0]
      ],
      'creative_spend' => [
        ['campaign_id' => 'C_PROD', 'item_group_id' => 'SPU1', 'creative_spend' => 600000]
      ],
      'SELECT SUM(cost) FROM' => [
        ['cost' => 600000]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->reconcileMultiGrain('7495657895504611503', '2026-09-01', '2026-09-01');
    $levelD = $res['hierarchy_reconciliation']['level_d_creative'];
    if ($levelD['status'] === 'MATCH' && $levelD['variance'] <= 1000) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($levelD);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('Creative excluded from total spend summation: strictly drilldown, never summed into Total', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [
        ['table' => 'commerce_ads_campaign_daily'],
        ['table' => 'commerce_ads_product_daily'],
        ['table' => 'commerce_ads_live_daily'],
        ['table' => 'commerce_ads_creative_daily']
      ],
      'commerce_ads_campaign_daily' => [
        ['campaign_id' => 'C_PROD', 'campaign_type' => 'PRODUCT_GMV_MAX', 'campaign_name' => 'Prod Camp', 'stat_date' => '2026-09-01', 'spend' => 600000, 'total_spend' => 600000, 'net_cost' => 600000, 'gross_revenue' => 3000000, 'total_gross_revenue' => 3000000, 'orders' => 30, 'total_orders' => 30, 'roi' => 5.0, 'cost_per_order' => 20000, 'operation_status' => 'ENABLE', 'budget' => 1000000, 'target_roas' => 5.0, 'is_active' => 1],
        ['campaign_id' => 'C_LIVE', 'campaign_type' => 'LIVE_GMV_MAX', 'campaign_name' => 'Live Camp', 'stat_date' => '2026-09-01', 'spend' => 400000, 'total_spend' => 400000, 'net_cost' => 400000, 'gross_revenue' => 2000000, 'total_gross_revenue' => 2000000, 'orders' => 20, 'total_orders' => 20, 'roi' => 5.0, 'cost_per_order' => 20000, 'operation_status' => 'ENABLE', 'budget' => 1000000, 'target_roas' => 5.0, 'is_active' => 1]
      ],
      'commerce_ads_creative_daily' => [
        ['item_id' => 'CR1', 'item_group_id' => 'SPU1', 'campaign_id' => 'C_PROD', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'raw_status' => 'DELIVERING', 'norm_status' => 'DELIVERING', 'is_unattributed' => 0, 'total_spend' => 600000, 'cost' => 600000, 'creative_spend' => 600000, 'total_net_cost' => 600000, 'total_ads_gross_revenue' => 3000000, 'total_ads_orders' => 30, 'avg_api_roi' => 5.0]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->reconcileMultiGrain('7495657895504611503', '2026-09-01', '2026-09-01');
    $creatGrain = $res['creative_fact_grain'];
    $incomp = $res['incompatible_grains']['creative_sum_in_total_spend'];
    if ($creatGrain['creative_spend_excluded_from_total'] === true &&
        $incomp['status'] === 'EXCLUDED' &&
        $res['macro_split']['total_cost'] === 1000000.0) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode([$creatGrain, $incomp, $res['macro_split']]);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

runTest('NOT_COMPARABLE for incompatible grains: creative facts vs live facts explicitly marked NOT_COMPARABLE', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $pdo = new MockPDO();
    $service = new CommerceAdsService($pdo);
    $res = $service->reconcileMultiGrain('7495657895504611503', '2026-09-01', '2026-09-01');
    $cVsLive = $res['incompatible_grains']['creative_vs_live'] ?? [];
    if (($cVsLive['status'] ?? '') === 'NOT_COMPARABLE') {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($cVsLive);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

// --------------------------------------------------------------------
// SUITE 6: LIVE INTELLIGENCE CONTRACTS & SESSION_MAPPING_PENDING
// --------------------------------------------------------------------
console.log('\n[SUITE 6] LIVE GMV Max Intelligence & Session Mapping Contract');

runTest('getLiveIntelligence strictly preserves SESSION_MAPPING_PENDING status', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [['table' => 'commerce_ads_live_daily']],
      'commerce_ads_live_daily' => [
        ['room_id' => '74123456789', 'campaign_id' => 'C100', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'total_spend' => 500000, 'total_net_cost' => null, 'total_ads_gross_revenue' => 2500000, 'total_ads_orders' => 25, 'avg_api_roi' => 5.0]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->getLiveIntelligence('7495657895504611503', '2026-09-01', '2026-09-01');
    if (!empty($res['rooms']) && $res['rooms'][0]['mapping_status'] === 'SESSION_MAPPING_PENDING') {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($res);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

// --------------------------------------------------------------------
// SUITE 7: PRODUCT SPU RUNTIME_VERIFIED_MAPPING CONTRACT
// --------------------------------------------------------------------
console.log('\n[SUITE 7] Product SPU RUNTIME_VERIFIED_MAPPING & Pre-Aggregated Join');

runTest('getProductIntelligence returns RUNTIME_VERIFIED_MAPPING contract badge', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [['table' => 'commerce_ads_product_daily']],
      'commerce_ads_product_daily' => [
        ['item_group_id' => '1730514245385685167', 'campaigns_count' => 1, 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'total_spend' => 300000, 'total_net_cost' => 300000, 'total_ads_gross_revenue' => 1500000, 'total_ads_orders' => 15, 'avg_api_roi' => 5.0, 'source_type' => 'TIKTOK_GMV_MAX_API']
      ],
      'commerce_order_items' => [
        ['product_id' => '1730514245385685167', 'product_name' => 'Serum Phục Hồi Da', 'order_gross_value' => 1500000, 'realized_revenue' => 1200000, 'cancellation_refund_value' => 0, 'total_shop_orders' => 15, 'units_sold' => 15]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->getProductIntelligence('7495657895504611503', '2026-09-01', '2026-09-01');
    $p = $res['products'][0] ?? [];
    if (($p['mapping_status'] ?? '') === 'RUNTIME_VERIFIED_MAPPING' &&
        strpos(($res['provenance']['mapping_contract'] ?? ''), 'RUNTIME_VERIFIED_MAPPING') !== false) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode([$p, $res['provenance']]);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
});

// --------------------------------------------------------------------
// SUITE 8: DASHBOARD CONTROLLER ACTIONS (ROUTING & CONTRACTS)
// --------------------------------------------------------------------
console.log('\n[SUITE 8] Dashboard Router Actions & Integration');

const dashboardPhp = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'api', 'commerce_dashboard.php'), 'utf8');

runTest('commerce_dashboard.php registers Action 16: get_gmv_max_product_intelligence', () => {
  if (!dashboardPhp.includes("case 'get_gmv_max_product_intelligence':")) {
    throw new Error('Action 16 missing in commerce_dashboard.php');
  }
});

runTest('commerce_dashboard.php registers Action 17: get_gmv_max_video_intelligence', () => {
  if (!dashboardPhp.includes("case 'get_gmv_max_video_intelligence':")) {
    throw new Error('Action 17 missing in commerce_dashboard.php');
  }
});

runTest('commerce_dashboard.php registers Action 18: get_gmv_max_live_intelligence', () => {
  if (!dashboardPhp.includes("case 'get_gmv_max_live_intelligence':")) {
    throw new Error('Action 18 missing in commerce_dashboard.php');
  }
});

runTest('commerce_dashboard.php registers Action 19: reconcile_gmv_max_multi_grain', () => {
  if (!dashboardPhp.includes("case 'reconcile_gmv_max_multi_grain':")) {
    throw new Error('Action 19 missing in commerce_dashboard.php');
  }
});

runTest('commerce_dashboard.php trigger_sync supports ads_products, ads_creatives, ads_lives, ads_all', () => {
  if (!dashboardPhp.includes("$domain === 'ads_products'") ||
      !dashboardPhp.includes("$domain === 'ads_creatives'") ||
      !dashboardPhp.includes("$domain === 'ads_lives'") ||
      !dashboardPhp.includes("$domain === 'ads_all'")) {
    throw new Error('trigger_sync does not support all ads domains');
  }
});

// --------------------------------------------------------------------
// SUITE 9: FRONTEND CODE INTEGRITY & VITE BUILD
// --------------------------------------------------------------------
console.log('\n[SUITE 9] Frontend Code Integrity & Vite Production Build');

const dashboardJsxPath = path.join(PROJECT_ROOT, 'src', 'CommerceDashboardView.jsx');
const dashboardJsx = fs.readFileSync(dashboardJsxPath, 'utf8');

runTest('CommerceDashboardView includes adsSubView navigation pills', () => {
  if (!dashboardJsx.includes("adsSubView === 'overview'") ||
      !dashboardJsx.includes("adsSubView === 'campaigns'") ||
      !dashboardJsx.includes("adsSubView === 'products'") ||
      !dashboardJsx.includes("adsSubView === 'videos'") ||
      !dashboardJsx.includes("adsSubView === 'optimizations'")) {
    throw new Error('Missing adsSubView state checks');
  }
});

runTest('CommerceDashboardView contains dedicated subTab live_ads with SESSION_MAPPING_PENDING badge', () => {
  if (!dashboardJsx.includes("subTab === 'live_ads'")) {
    throw new Error("Missing subTab === 'live_ads' view");
  }
  if (!dashboardJsx.includes('SESSION_MAPPING_PENDING')) {
    throw new Error('Missing SESSION_MAPPING_PENDING badge in live_ads');
  }
});

runTest('CommerceDashboardView contains dedicated subTab video_intel with 6 Opportunity Patterns', () => {
  if (!dashboardJsx.includes("subTab === 'video_intel'")) {
    throw new Error("Missing subTab === 'video_intel' view");
  }
  if (!dashboardJsx.includes('6 Mẫu Cơ Hội Tối Ưu Hóa Video Thực Tế')) {
    throw new Error('Missing 6 opportunity patterns in video_intel');
  }
});

runTest('CommerceDashboardView displays Multi-Grain Reconciliation Matrix Table', () => {
  if (!dashboardJsx.includes('Ma Trận Đối Soát Đa Tầng (Multi-Grain Reconciliation Matrix)')) {
    throw new Error('Missing Multi-Grain Reconciliation Matrix table in JSX');
  }
});

runTest('Vite production build succeeds cleanly', () => {
  const res = execSync('npm run build', { encoding: 'utf8', cwd: PROJECT_ROOT });
  if (!res.includes('built in') || res.includes('error')) {
    throw new Error('Vite build did not succeed cleanly: ' + res);
  }
});

// --------------------------------------------------------------------
// SUITE 10: TRUTH PRESERVATION, ROLLBACK SAFETY & MISSING != ZERO
// --------------------------------------------------------------------
console.log('\n[SUITE 10] Semantic Truth Preservation, Rollback Safety & missing != zero');

runTest('No ads gross revenue field is misrepresented as "Shop GMV"', () => {
  const adsSectionMatch = dashboardJsx.match(/subTab === 'ads'[\s\S]*?subTab === 'products'/);
  if (adsSectionMatch) {
    const text = adsSectionMatch[0];
    if (text.includes('Tổng GMV Cửa Hàng') || text.includes('Shop GMV')) {
      throw new Error('Found forbidden "Shop GMV" label in ads section');
    }
  }
});

runTest('missing != zero: null values strictly preserved as null/dash, never forced to 0/0%', () => {
  const code = `
    require_once 'public/api/commerce_ads_service.php';
    $custom = [
      'SHOW TABLES LIKE' => [['table' => 'commerce_ads_creative_daily']],
      'commerce_ads_creative_daily' => [
        ['item_id' => '7001', 'item_group_id' => 'SPU1', 'campaign_id' => 'C1', 'distinct_days' => 1, 'latest_stat_date' => '2026-09-01', 'raw_status' => 'DELIVERING', 'norm_status' => 'DELIVERING', 'is_unattributed' => 0, 'total_spend' => 0, 'total_net_cost' => null, 'total_ads_gross_revenue' => 0, 'total_ads_orders' => 0, 'avg_api_roi' => null]
      ]
    ];
    $pdo = new MockPDO($custom);
    $service = new CommerceAdsService($pdo);
    $res = $service->getVideoIntelligence('7495657895504611503', '2026-09-01', '2026-09-01');
    $c = $res['creatives'][0];
    if ($c['cpa'] === null && $c['net_cost'] === null && $c['api_roi'] === null) {
      echo "OK";
    } else {
      echo "FAIL: " . json_encode($c);
    }
  `;
  const out = runPhp(code);
  if (out !== 'OK') throw new Error(out);
  if (!dashboardJsx.includes("p.api_roi !== null ? `${p.api_roi}x` : '—'")) {
    throw new Error('Missing null != 0 protection for ROI in UI');
  }
});

runTest('rollback documentation warns about data loss: explicit data loss warning and forward-first rule', () => {
  const runbookPath = path.join(PROJECT_ROOT, 'release', 'V2_02_GMV_MAX_INTELLIGENCE_DEPLOYMENT_RUNBOOK.md');
  if (!fs.existsSync(runbookPath)) throw new Error('Runbook file missing');
  const content = fs.readFileSync(runbookPath, 'utf8');
  if (!content.includes('DROP TABLE IF EXISTS commerce_ads_product_daily') ||
      !content.includes('DROP TABLE IF EXISTS commerce_ads_creative_daily') ||
      !content.includes('DROP TABLE IF EXISTS commerce_ads_live_daily')) {
    throw new Error('Runbook does not list tables dropped by rollback');
  }
  if (!content.includes('PERMANENTLY DELETE') && !content.includes('bị xóa')) {
    throw new Error('Runbook missing permanent deletion / data loss warning');
  }
  if (!content.includes('Forward-First') && !content.includes('forward-first')) {
    throw new Error('Runbook missing forward-first policy');
  }
  if (!content.includes('Application Rollback does NOT default to Schema Rollback')) {
    throw new Error('Runbook does not state application rollback separation from schema rollback');
  }
});

// --------------------------------------------------------------------
// SUMMARY
// --------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
console.log('======================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL SPRINT V2-02 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ✓✓✓\n');
  process.exit(0);
}
