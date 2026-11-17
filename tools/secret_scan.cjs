const fs = require('fs');
const path = require('path');

const targetFiles = [
  'database/migrations/20260925_004_create_commerce_core_tables.sql',
  'database/migrations/20260925_004_rollback_commerce_core_tables.sql',
  'public/api/config.php',
  'public/api/tiktok_client.php',
  'public/api/commerce_sync_service.php',
  'HF1_2_PHASE1A_IMPLEMENTATION_PLAN.md'
];

let leakCount = 0;
const secretPatterns = [
  /TIKTOK_APP_SECRET\s*=\s*['"][a-zA-Z0-9_\-]{16,}['"]/i,
  /access_token['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{30,}['"]/i,
  /refresh_token['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{30,}['"]/i,
  /AUTH_SIGNING_KEY\s*=\s*['"][a-zA-Z0-9]{32,}['"]/i,
  /password['"]?\s*[:=]\s*['"][^'"]{8,}['"]/i
];

for (const file of targetFiles) {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      console.error(`[LEAK DETECTED] File: ${file}, Pattern: ${pattern}`);
      leakCount++;
    }
  }
}

if (leakCount === 0) {
  console.log('>>> SECRET SCAN PASS: 0 hardcoded secrets found <<<');
  process.exit(0);
} else {
  console.error(`>>> SECRET SCAN FAILED: ${leakCount} potential leaks <<<`);
  process.exit(1);
}
