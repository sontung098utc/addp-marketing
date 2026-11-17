/**
 * SPRINT V2-02 GMV MAX ADVERTISING INTELLIGENCE — PRODUCTION RELEASE PACKAGER
 * 
 * Verifies all quality gates before producing POSIX-compliant release ZIP:
 * 1. PHP syntax compilation across codebase (php -l & php-parser)
 * 2. V2-01.2 Final Acceptance Suite (61/61 scenarios)
 * 3. V2-02A Campaign GMV Max Acceptance Suite (75/75 scenarios)
 * 4. V2-02A.2 Official GMV Max API Ingestion Suite (60/60 scenarios)
 * 5. V2-02 GMV Max Intelligence Acceptance Suite (41/41 scenarios)
 * 6. Production Vite build (npm run build)
 * 7. Strict POSIX ZIP packaging (Zero Windows backslashes in archive)
 * 8. Central Directory binary inspection & SHA-256 computation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-02 GMV MAX ADVERTISING INTELLIGENCE RELEASE PIPELINE');
console.log('====================================================================\n');

// 1. Verify Real PHP compile gate
console.log('Step 1A: Running PHP syntax validation across codebase...');
execSync('node tools/verify_php_syntax.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Run V2-01.2 Regression Suite
console.log('\nStep 1B: Running Sprint V2-01.2 Final Acceptance regression suite...');
execSync('node tools/test_v2_01_2_acceptance.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Run V2-02A Campaign GMV Max Acceptance Suite
console.log('\nStep 1C: Running Sprint V2-02A Campaign GMV Max Acceptance test suite...');
execSync('node tools/test_v2_02a_campaign_gmv_max.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 4. Run V2-02A.2 Official GMV Max API Ingestion Suite
console.log('\nStep 1D: Running Sprint V2-02A.2 Official API Ingestion test suite...');
execSync('node tools/test_v2_02a_2_official_api_ingestion.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 5. Run V2-02 GMV Max Intelligence Acceptance Suite
console.log('\nStep 1E: Running Sprint V2-02 GMV Max Intelligence Acceptance test suite...');
execSync('node tools/test_v2_02_gmv_max_intelligence.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 6. Refresh Vite production build
console.log('\nStep 1F: Running Vite production build to refresh client dist artifacts...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 7. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_02_gmv_max_intelligence_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v202_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 8. Manifest File Mapping
const manifestMap = [
  // Database Migrations & Rollbacks
  ['database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql', 'database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql'],
  ['database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql', 'database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql'],
  ['database/migrations/20261004_011_add_commerce_ads_campaign_api_lineage_columns.sql', 'database/migrations/20261004_011_add_commerce_ads_campaign_api_lineage_columns.sql'],
  ['database/migrations/20261004_011_rollback_commerce_ads_campaign_api_lineage_columns.sql', 'database/migrations/20261004_011_rollback_commerce_ads_campaign_api_lineage_columns.sql'],
  ['database/migrations/20261004_012_create_commerce_ads_intelligence_tables.sql', 'database/migrations/20261004_012_create_commerce_ads_intelligence_tables.sql'],
  ['database/migrations/20261004_012_rollback_commerce_ads_intelligence_tables.sql', 'database/migrations/20261004_012_rollback_commerce_ads_intelligence_tables.sql'],

  // Backend API Client & Core Services
  ['public/api/tiktok_gmv_max_api_client.php', 'public/api/tiktok_gmv_max_api_client.php'],
  ['public/api/commerce_ads_ingestion_service.php', 'public/api/commerce_ads_ingestion_service.php'],
  ['public/api/commerce_ads_service.php', 'public/api/commerce_ads_service.php'],
  ['public/api/commerce_dashboard.php', 'public/api/commerce_dashboard.php'],

  // Frontend Source
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],

  // Frontend Production Distribution
  ['dist/index.html', 'dist/index.html'],

  // Automated Acceptance Test Suites
  ['tools/test_v2_02_gmv_max_intelligence.cjs', 'tools/test_v2_02_gmv_max_intelligence.cjs'],
  ['tools/test_v2_02a_2_official_api_ingestion.cjs', 'tools/test_v2_02a_2_official_api_ingestion.cjs'],
  ['tools/test_v2_02a_campaign_gmv_max.cjs', 'tools/test_v2_02a_campaign_gmv_max.cjs'],
  ['tools/test_v2_01_2_acceptance.cjs', 'tools/test_v2_01_2_acceptance.cjs']
];

// Add dist/assets files
const distAssetsDir = path.join(__dirname, '../dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const assetFiles = fs.readdirSync(distAssetsDir);
  for (const af of assetFiles) {
    manifestMap.push([`dist/assets/${af}`, `dist/assets/${af}`]);
  }
}

console.log('\nStep 2: Staging V2-02 release package files:');
const sourceHashes = {};
for (const [srcRel, destRel] of manifestMap) {
  const srcFull = path.join(__dirname, '..', srcRel);
  if (!fs.existsSync(srcFull)) {
    console.error(`FATAL: Missing source file: ${srcRel}`);
    process.exit(1);
  }
  const destFull = path.join(stagingDir, destRel);
  fs.mkdirSync(path.dirname(destFull), { recursive: true });
  fs.copyFileSync(srcFull, destFull);
  const buf = fs.readFileSync(destFull);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  sourceHashes[destRel] = { hash, size: buf.length };
  console.log(`  + ${destRel.padEnd(76)} (${String(buf.length).padStart(7)} B)  SHA256: ${hash}`);
}

// 9. Create ZIP Package with PowerShell using strict forward slashes
console.log(`\nStep 3: Creating release archive with strict POSIX paths: ${releaseFileName}...`);

const entriesCommands = manifestMap.map(([srcRel, destRel]) => {
  const fullStaging = path.join(stagingDir, destRel).replace(/\\/g, '\\\\');
  const posixEntry = destRel.replace(/\\/g, '/');
  return `[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, '${fullStaging}', '${posixEntry}', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null`;
}).join('\n');

const psScript = `
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$releaseZipPath = '${releaseZipPath.replace(/\\/g, '\\\\')}';
if (Test-Path $releaseZipPath) { Remove-Item -Force $releaseZipPath }

$zip = [System.IO.Compression.ZipFile]::Open($releaseZipPath, [System.IO.Compression.ZipArchiveMode]::Create)
${entriesCommands}
$zip.Dispose()
`;

const tmpPsFile = path.join(releaseDir, `zip_temp_v202_${timestamp}.ps1`);
fs.writeFileSync(tmpPsFile, psScript, 'utf8');

try {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPsFile}"`, { stdio: 'inherit' });
} finally {
  if (fs.existsSync(tmpPsFile)) fs.unlinkSync(tmpPsFile);
  fs.rmSync(stagingDir, { recursive: true, force: true });
}

if (!fs.existsSync(releaseZipPath)) {
  console.error('FATAL: Failed to create release zip package!');
  process.exit(1);
}

const releaseZipBuf = fs.readFileSync(releaseZipPath);
const releaseZipSha256 = crypto.createHash('sha256').update(releaseZipBuf).digest('hex');

// Step 3B: Binary Inspection — Central Directory Audit for strict POSIX compliance
let offset = 0;
const zipEntries = [];
while (offset < releaseZipBuf.length - 4) {
  if (releaseZipBuf.readUInt32LE(offset) === 0x02014b50) {
    const fnLen = releaseZipBuf.readUInt16LE(offset + 28);
    const extraLen = releaseZipBuf.readUInt16LE(offset + 30);
    const commentLen = releaseZipBuf.readUInt16LE(offset + 32);
    const fn = releaseZipBuf.toString('utf8', offset + 46, offset + 46 + fnLen);
    zipEntries.push(fn);
    offset += 46 + fnLen + extraLen + commentLen;
  } else {
    offset++;
  }
}

const backslashEntries = zipEntries.filter(e => e.includes('\\'));
if (backslashEntries.length > 0) {
  console.error(`FATAL: ZIP contains ${backslashEntries.length} entries with Windows backslash separators!`);
  console.error('Offending entries:', backslashEntries);
  process.exit(1);
}

console.log(`\n====================================================================`);
console.log(`RELEASE PACKAGE CREATED SUCCESSFULLY!`);
console.log(`====================================================================`);
console.log(`Package Name:    ${releaseFileName}`);
console.log(`Package Path:    ${releaseZipPath}`);
console.log(`Package Size:    ${releaseZipBuf.length.toLocaleString()} bytes`);
console.log(`Total Entries:   ${zipEntries.length} files`);
console.log(`Package SHA256:  ${releaseZipSha256}`);
console.log(`POSIX Audit:     100% of entries use forward slash '/' (Zero backslashes)`);

// 10. Generate Release Manifest Markdown
const manifestContent = `# ADDP COMMERCE INTELLIGENCE V2 — SPRINT V2-02 RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | \`${releaseFileName}\` |
| **Package SHA-256** | \`${releaseZipSha256}\` |
| **Package Size** | \`${releaseZipBuf.length.toLocaleString()} B\` |
| **Total Files** | \`${zipEntries.length}\` |
| **Built Timestamp** | \`${now.toISOString()}\` |
| **Milestone** | **Sprint V2-02: GMV Max Advertising Intelligence** |
| **Scope** | Campaign, Product/SPU, Video/Creative, LIVE GMV Max & Multi-Grain Reconciliation |
| **Work Mode** | **LOCAL READY — PENDING PRODUCT OWNER DEPLOYMENT** |
| **Integrity Level** | Full POSIX Forward Slashes (Automated Central Directory Binary Verified) |

---

## Packaged Files & SHA-256 Checksums

| File Path | Size (B) | SHA-256 Checksum |
| :--- | :---: | :--- |
${manifestMap.map(([src, dest]) => `| \`${dest}\` | ${sourceHashes[dest].size} | \`${sourceHashes[dest].hash}\` |`).join('\n')}

---

## Deployment Instructions for Product Owner

1. Transfer \`${releaseFileName}\` to production server webroot or deployment directory.
2. Unzip with overwrite confirmation:
   \`\`\`bash
   unzip -o ${releaseFileName}
   \`\`\`
3. Apply database migration(s):
   \`\`\`bash
   # Apply Migration 012 (Creates product, creative, live intelligence tables)
   mysql -u \$DB_USER -p \$DB_NAME < database/migrations/20261004_012_create_commerce_ads_intelligence_tables.sql
   \`\`\`
4. Run automated acceptance suites directly on server:
   \`\`\`bash
   node tools/test_v2_02_gmv_max_intelligence.cjs
   node tools/test_v2_02a_2_official_api_ingestion.cjs
   node tools/test_v2_02a_campaign_gmv_max.cjs
   node tools/test_v2_01_2_acceptance.cjs
   \`\`\`
5. Open browser at \`https://marketing.addp.vn\` and navigate to **Quảng Cáo (GMV Max)** tab to inspect:
   - **Multi-Grain Reconciliation Matrix** (Macro vs Product vs LIVE)
   - **Product SPU Breakdown** (with Verified SPU mappings)
   - **Video Creative Breakdown & Optimization Matrix** (6 opportunity patterns)
   - **LIVE Ads Breakdown** (with \`SESSION_MAPPING_PENDING\` badge)
`;

const manifestPath = path.join(releaseDir, 'V2_02_GMV_MAX_INTELLIGENCE_RELEASE_MANIFEST.md');
fs.writeFileSync(manifestPath, manifestContent, 'utf8');
console.log(`Manifest Path:   ${manifestPath}`);

// 11. Generate Deployment Runbook
const runbookContent = `# ADDP COMMERCE INTELLIGENCE — SPRINT V2-02 DEPLOYMENT RUNBOOK

## Target Environment
- Application: ADDP Commerce Intelligence
- Production Domain: \`marketing.addp.vn\`
- Release Package: \`${releaseFileName}\`
- SHA-256 Checksum: \`${releaseZipSha256}\`

---

## 1. COMPREHENSIVE PRE-DEPLOYMENT BACKUP STRATEGY (MANDATORY)

Before deploying the archive or running any migrations, execute full backups:

### A. Database Schema & Tables Backup
Backup current database schema and existing relevant Ads & Core V2 tables (do NOT hardcode credentials, use environment variables):
\`\`\`bash
# 1. Backup full schema definition
mysqldump -u "\$DB_USER" -p "\$DB_NAME" --no-data > backup_schema_before_v2_02_\$(date +%Y%m%d_%H%M%S).sql

# 2. Backup existing Ads and Core V2 tables data
mysqldump -u "\$DB_USER" -p "\$DB_NAME" \\
  commerce_ads_campaign_daily \\
  tiktok_campaign_daily_reports \\
  commerce_order_items \\
  tiktok_config > backup_relevant_tables_\$(date +%Y%m%d_%H%M%S).sql
\`\`\`

### B. Application Files Backup
Backup existing application files before overwriting:
\`\`\`bash
tar -czf backup_app_files_before_v2_02_\$(date +%Y%m%d_%H%M%S).tar.gz \\
  public/api/tiktok_gmv_max_api_client.php \\
  public/api/commerce_ads_ingestion_service.php \\
  public/api/commerce_ads_service.php \\
  public/api/commerce_dashboard.php \\
  src/CommerceDashboardView.jsx \\
  dist/
\`\`\`

---

## 2. STEP-BY-STEP DEPLOYMENT PROCEDURE

### Step 1: Deploy Archive
\`\`\`bash
cd /path/to/marketing.addp.vn
unzip -o ${releaseFileName}
\`\`\`

### Step 2: Apply Database Migration 012 (Forward-First)
\`\`\`bash
mysql -u "\$DB_USER" -p "\$DB_NAME" < database/migrations/20261004_012_create_commerce_ads_intelligence_tables.sql
\`\`\`

### Step 3: Run Automated Verification Matrix
\`\`\`bash
node tools/test_v2_02_gmv_max_intelligence.cjs
node tools/test_v2_02a_2_official_api_ingestion.cjs
node tools/test_v2_02a_campaign_gmv_max.cjs
node tools/test_v2_01_2_acceptance.cjs
\`\`\`
Expected result: **All test suites pass 100% (0 errors)**.

### Step 4: Browser Verification
1. Access \`https://marketing.addp.vn\`
2. Navigate to **Quảng Cáo (GMV Max)**:
   - Check **Overview**: Multi-Grain Hierarchy Table (Levels A, B, C, D) reconciles accurately with 1,000 VND / 0.1% rounding tolerance.
   - Check **Product SPU**: Verified mappings (\`RUNTIME_VERIFIED_MAPPING\`) joined with \`commerce_order_items.product_id\`.
   - Check **Video Creatives**: Target ROAS comparisons, factual opportunity patterns (Cost > 0 & Orders = 0, Cost > 0 & Revenue = 0, Zero-Cost Attribution without causal claims, \`item_id = -1\` unattributed bucket).
   - Check **LIVE Ads**: Rooms listed with clear \`SESSION_MAPPING_PENDING\` disclosure.

---

## 3. ROLLBACK SAFETY POLICY & PROCEDURES

> [!CAUTION]
> **CRITICAL WARNING ON DATA LOSS:**
> Migration 012 rollback executes:
> - \`DROP TABLE IF EXISTS commerce_ads_product_daily;\`
> - \`DROP TABLE IF EXISTS commerce_ads_creative_daily;\`
> - \`DROP TABLE IF EXISTS commerce_ads_live_daily;\`
> **DO NOT treat DROP TABLE rollback as safe once production data has been synced.**
> Dropping these tables will **PERMANENTLY DELETE** all ingested daily product, creative, and live advertising intelligence records (dữ liệu đã sync trong các bảng này sẽ bị xóa)!

### Golden Rule: Migration Forward-First
1. **Application Rollback does NOT default to Schema Rollback:**
   If an application or UI bug occurs, rollback application files only:
   \`\`\`bash
   tar -xzf backup_app_files_before_v2_02_*.tar.gz
   \`\`\`
   Do NOT drop the database tables. Existing tables and legacy endpoints continue functioning normally.

2. **Schema Rollback Requires Explicit Approval:**
   Only execute \`20261004_012_rollback_commerce_ads_intelligence_tables.sql\` if explicitly approved by the Product Owner / Tech Lead.
   Before dropping, capture an emergency dump:
   \`\`\`bash
   # Emergency Dump before any DROP
   mysqldump -u "\$DB_USER" -p "\$DB_NAME" \\
     commerce_ads_product_daily \\
     commerce_ads_creative_daily \\
     commerce_ads_live_daily > emergency_dump_intelligence_tables_\$(date +%Y%m%d_%H%M%S).sql

   # Execute Rollback (ONLY if explicitly approved)
   mysql -u "\$DB_USER" -p "\$DB_NAME" < database/migrations/20261004_012_rollback_commerce_ads_intelligence_tables.sql
   \`\`\`
`;

const runbookPath = path.join(releaseDir, 'V2_02_GMV_MAX_INTELLIGENCE_DEPLOYMENT_RUNBOOK.md');
fs.writeFileSync(runbookPath, runbookContent, 'utf8');
console.log(`Runbook Path:    ${runbookPath}\n`);
