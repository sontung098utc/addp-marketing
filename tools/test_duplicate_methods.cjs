const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const engine = require('php-parser');

const parser = new engine({
  parser: { extractDoc: true, php7: true },
  ast: { withPositions: true }
});

function findPhpBinary() {
  if (process.env.PHP_BIN && fs.existsSync(process.env.PHP_BIN)) return process.env.PHP_BIN;
  try {
    if (spawnSync('php', ['-v'], { encoding: 'utf8' }).status === 0) return 'php';
  } catch (e) {}
  const candidates = [
    'C:\\ADDP\\SEOSuite\\.tools\\php-8.2.4\\php.exe',
    'C:\\php\\php.exe',
    'C:\\tools\\php\\php.exe',
    'C:\\xampp\\php\\php.exe',
    '/usr/bin/php',
    '/usr/local/bin/php'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('PHP CLI not found');
}

const phpBinary = findPhpBinary();
console.log('====================================================================');
console.log('STARTING DUPLICATE METHOD AUDIT & REGRESSION TEST SUITE');
console.log('PHP CLI:', phpBinary);
console.log('====================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] TC-${totalTests.toString().padStart(2, '0')}: ${message}`);
  } else {
    console.error(`[FAIL] TC-${totalTests.toString().padStart(2, '0')}: ${message}`);
    process.exit(1);
  }
}

// Helper to audit duplicate methods in code
function auditDuplicateMethods(code, filename = 'inline.php') {
  const ast = parser.parseCode(code, filename);
  const duplicates = [];

  function checkNode(node) {
    if (!node) return;
    if (node.kind === 'class') {
      const className = node.name.name || node.name || 'AnonymousClass';
      const methods = new Map();
      for (const item of node.body) {
        if (item.kind === 'method') {
          const methodName = (item.name.name || item.name || '').toLowerCase();
          if (methods.has(methodName)) {
            duplicates.push({
              className,
              methodName: item.name.name || item.name,
              firstLine: methods.get(methodName).loc.start.line,
              secondLine: item.loc.start.line
            });
          } else {
            methods.set(methodName, item);
          }
        }
      }
    }
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (Array.isArray(val)) {
        val.forEach(checkNode);
      } else if (val && typeof val === 'object' && val.kind) {
        checkNode(val);
      }
    }
  }

  checkNode(ast);
  return duplicates;
}

// TC-01: Audit all repo classes for duplicate methods
const apiDir = path.join(__dirname, '..', 'public', 'api');
const toolsDir = path.join(__dirname, '..', 'tools');
const files = [
  ...fs.readdirSync(apiDir).filter(f => f.endsWith('.php')).map(f => path.join(apiDir, f)),
  ...fs.readdirSync(toolsDir).filter(f => f.endsWith('.php')).map(f => path.join(toolsDir, f))
];

let repoDuplicates = [];
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  const dups = auditDuplicateMethods(code, path.basename(f));
  if (dups.length > 0) {
    repoDuplicates.push({ file: f, dups });
  }
}

assert(repoDuplicates.length === 0, 'Zero duplicate methods across all production and tool PHP classes');

// TC-02: TikTokShopClient has exactly ONE getShopPerformance declaration
const tiktokClientCode = fs.readFileSync(path.join(apiDir, 'tiktok_client.php'), 'utf8');
const ast = parser.parseCode(tiktokClientCode, 'tiktok_client.php');
let shopPerformanceCount = 0;
let legacyProbeCount = 0;

for (const stmt of ast.children) {
  if (stmt.kind === 'class' && (stmt.name.name || stmt.name) === 'TikTokShopClient') {
    for (const item of stmt.body) {
      if (item.kind === 'method') {
        const name = (item.name.name || item.name || '').toLowerCase();
        if (name === 'getshopperformance') shopPerformanceCount++;
        if (name === 'getlegacyshopperformanceprobe') legacyProbeCount++;
      }
    }
  }
}

assert(shopPerformanceCount === 1, 'TikTokShopClient contains exactly ONE getShopPerformance method declaration');
assert(legacyProbeCount === 1, 'TikTokShopClient contains exactly ONE getLegacyShopPerformanceProbe method declaration');

// TC-03: Real php -l rejects duplicate method with identical casing
const dupCodeExact = `<?php
class TestExactDuplicate {
    public function calculateRevenue($x) { return $x * 10; }
    public function calculateRevenue($x) { return $x * 20; }
}
`;
const tmpExact = path.join(__dirname, 'debug_test_exact_dup.php');
fs.writeFileSync(tmpExact, dupCodeExact);
try {
  const res = spawnSync(phpBinary, ['-l', tmpExact], { encoding: 'utf8' });
  const astDups = auditDuplicateMethods(dupCodeExact);
  assert(res.status !== 0 && res.stdout.includes('Cannot redeclare') && astDups.length === 1,
    'Real php -l and AST auditor reject duplicate method declaration (exact casing)');
} finally {
  if (fs.existsSync(tmpExact)) fs.unlinkSync(tmpExact);
}

// TC-04: Real php -l rejects duplicate method with different casing (PHP is case-insensitive for methods)
const dupCodeCase = `<?php
class TestCaseDuplicate {
    public function getShopPerformance($x) { return $x; }
    public function GetShopPerformance($x, $y) { return $x + $y; }
}
`;
const tmpCase = path.join(__dirname, 'debug_test_case_dup.php');
fs.writeFileSync(tmpCase, dupCodeCase);
try {
  const res = spawnSync(phpBinary, ['-l', tmpCase], { encoding: 'utf8' });
  const astDups = auditDuplicateMethods(dupCodeCase);
  assert(res.status !== 0 && res.stdout.includes('Cannot redeclare') && astDups.length === 1,
    'Real php -l and AST auditor reject duplicate method declaration (different casing)');
} finally {
  if (fs.existsSync(tmpCase)) fs.unlinkSync(tmpCase);
}

// TC-05: Real php -l passes valid class with distinct methods
const validCode = `<?php
class TestValidClass {
    public function getShopPerformance($token, $cipher, $start, $end) { return []; }
    public function getLegacyShopPerformanceProbe($token, $cipher) { return null; }
}
`;
const tmpValid = path.join(__dirname, 'debug_test_valid.php');
fs.writeFileSync(tmpValid, validCode);
try {
  const res = spawnSync(phpBinary, ['-l', tmpValid], { encoding: 'utf8' });
  const astDups = auditDuplicateMethods(validCode);
  assert(res.status === 0 && astDups.length === 0,
    'Real php -l and AST auditor pass valid class with cleanly separated method names');
} finally {
  if (fs.existsSync(tmpValid)) fs.unlinkSync(tmpValid);
}

// TC-06: Runtime test of getShopPerformance contracts in TikTokShopClient
const runtimeTestScript = `<?php
putenv('APP_ENV=testing');
require_once __DIR__ . '/../public/api/config.php';
require_once __DIR__ . '/../public/api/tiktok_client.php';

class MockTestTikTokClient extends TikTokShopClient {
    public array $recordedRequests = [];

    public function request($method, $path, $queryParams = [], $body = null, $accessToken = null) {
        $this->recordedRequests[] = [
            'method' => $method,
            'path' => $path,
            'queryParams' => $queryParams
        ];

        if (str_contains($path, '/analytics/202405/shop/performance')) {
            return [
                'code' => 0,
                'data' => [
                    'shop_performance' => [
                        'gmv' => '5000000.00',
                        'order_count' => 150
                    ]
                ]
            ];
        }

        return ['code' => 0, 'data' => ['probe' => 'ok']];
    }
}

$client = new MockTestTikTokClient();

// Contract A: Canonical HF1.5 call with dates
$resCanonical = $client->getShopPerformance('tok_123', 'ciph_456', '2026-09-01', '2026-09-20');
if (($resCanonical['code'] ?? null) !== 0 || !isset($resCanonical['data']['shop_performance'])) {
    echo "FAIL: Canonical call did not return expected response\\n";
    exit(1);
}

// Verify canonical endpoint was called with required query parameters
$lastReq = end($client->recordedRequests);
if ($lastReq['path'] !== '/analytics/202405/shop/performance' || 
    $lastReq['queryParams']['start_date_ge'] !== '2026-09-01' ||
    $lastReq['queryParams']['end_date_lt'] !== '2026-09-20') {
    echo "FAIL: Canonical request parameters mismatch\\n";
    exit(1);
}

// Contract B: Legacy 2-argument backward-compatible call
$resLegacy = $client->getShopPerformance('tok_legacy', 'ciph_legacy');
if (($resLegacy['code'] ?? null) !== 0 || !isset($resLegacy['data'])) {
    echo "FAIL: Legacy 2-arg call failed to dispatch to legacy probe\\n";
    exit(1);
}

// Contract C: Partial date call throws InvalidArgumentException
$threw = false;
try {
    $client->getShopPerformance('tok_err', 'ciph_err', '2026-09-01', '');
} catch (InvalidArgumentException $e) {
    $threw = true;
}
if (!$threw) {
    echo "FAIL: Partial date did not throw InvalidArgumentException\\n";
    exit(1);
}

echo "SUCCESS";
`;

const tmpRuntime = path.join(__dirname, 'debug_test_runtime_contract.php');
fs.writeFileSync(tmpRuntime, runtimeTestScript);
try {
  const res = spawnSync(phpBinary, [tmpRuntime], { encoding: 'utf8' });
  if (res.status !== 0 || !res.stdout.includes('SUCCESS')) {
    console.error('PHP Runtime test failed:');
    console.error('Status:', res.status);
    console.error('STDOUT:', res.stdout);
    console.error('STDERR:', res.stderr);
  }
  assert(res.status === 0 && res.stdout.includes('SUCCESS'),
    'TikTokShopClient::getShopPerformance satisfies both canonical HF1.5 contract and legacy 2-arg dispatch');
} finally {
  if (fs.existsSync(tmpRuntime)) fs.unlinkSync(tmpRuntime);
}

console.log('\n====================================================');
console.log('DUPLICATE METHOD & COMPILE REGRESSION TEST SUMMARY');
console.log(`TOTAL SCENARIOS : ${totalTests}`);
console.log(`PASSED          : ${passedTests}`);
console.log(`FAILED          : 0`);
console.log('>>> ALL REGRESSION TEST SCENARIOS PASSED (100%) <<<');
console.log('====================================================');
