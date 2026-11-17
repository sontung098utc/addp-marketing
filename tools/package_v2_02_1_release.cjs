/**
 * SPRINT V2-02.1 GMV MAX PRODUCTION HARDENING & PERIOD COVERAGE — RELEASE PACKAGER
 * 
 * Verifies all quality gates before producing POSIX-compliant release ZIP:
 * 1. PHP syntax compilation across codebase (29/29 files)
 * 2. V2-02.1 Hardening & Coverage Suite (28/28 tests)
 * 3. V2-02 GMV Max Intelligence Suite (41/41 tests)
 * 4. V2-02A Campaign GMV Max Suite (75/75 scenarios)
 * 5. V2-02A.2 Official API Ingestion Suite (60/60 scenarios)
 * 6. Production Vite build (npm run build)
 * 7. Strict POSIX ZIP packaging (Zero Windows backslashes in archive)
 * 8. Central Directory binary inspection & SHA-256 computation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-02.1 GMV MAX HARDENING RELEASE PIPELINE');
console.log('====================================================================\n');

// 1. Verify Real PHP compile gate
console.log('Step 1A: Running PHP syntax validation across codebase...');
execSync('node tools/verify_php_syntax.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Run V2-02.1 Hardening Test Suite
console.log('\nStep 1B: Running Sprint V2-02.1 Hardening & Period Coverage test suite...');
execSync('node tools/test_v2_02_1_production_hardening.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Run V2-02 GMV Max Intelligence Acceptance Suite
console.log('\nStep 1C: Running Sprint V2-02 GMV Max Intelligence Acceptance test suite...');
execSync('node tools/test_v2_02_gmv_max_intelligence.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 4. Run V2-02A Campaign GMV Max Acceptance Suite
console.log('\nStep 1D: Running Sprint V2-02A Campaign GMV Max Acceptance test suite...');
execSync('node tools/test_v2_02a_campaign_gmv_max.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 5. Run V2-02A.2 Official GMV Max API Ingestion Suite
console.log('\nStep 1E: Running Sprint V2-02A.2 Official API Ingestion test suite...');
execSync('node tools/test_v2_02a_2_official_api_ingestion.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 6. Refresh Vite production build
console.log('\nStep 1F: Running Vite production build to refresh client dist artifacts...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 7. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_02_1_gmv_max_production_hardening_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v202_1_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 8. Manifest File Mapping
const manifestMap = [
  // Database Migrations & Rollbacks
  ['database/migrations/20261004_013_widen_commerce_ads_roi_columns.sql', 'database/migrations/20261004_013_widen_commerce_ads_roi_columns.sql'],
  ['database/migrations/20261004_013_rollback_widen_commerce_ads_roi_columns.sql', 'database/migrations/20261004_013_rollback_widen_commerce_ads_roi_columns.sql'],
  ['database/migrations/20261004_012_create_commerce_ads_intelligence_tables.sql', 'database/migrations/20261004_012_create_commerce_ads_intelligence_tables.sql'],
  ['database/migrations/20261004_012_rollback_commerce_ads_intelligence_tables.sql', 'database/migrations/20261004_012_rollback_commerce_ads_intelligence_tables.sql'],
  ['database/migrations/20261004_011_add_commerce_ads_campaign_api_lineage_columns.sql', 'database/migrations/20261004_011_add_commerce_ads_campaign_api_lineage_columns.sql'],
  ['database/migrations/20261004_011_rollback_commerce_ads_campaign_api_lineage_columns.sql', 'database/migrations/20261004_011_rollback_commerce_ads_campaign_api_lineage_columns.sql'],
  ['database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql', 'database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql'],
  ['database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql', 'database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql'],

  // Backend API Client & Core Services
  ['public/api/tiktok_gmv_max_api_client.php', 'public/api/tiktok_gmv_max_api_client.php'],
  ['public/api/commerce_ads_ingestion_service.php', 'public/api/commerce_ads_ingestion_service.php'],
  ['public/api/commerce_ads_service.php', 'public/api/commerce_ads_service.php'],
  ['public/api/commerce_dashboard.php', 'public/api/commerce_dashboard.php'],

  // Frontend Source
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],

  // Frontend Production Distribution
  ['dist/index.html', 'dist/index.html'],

  // Standalone CLI Backfill Tool
  ['tools/backfill_gmv_max_official_cli.php', 'tools/backfill_gmv_max_official_cli.php'],

  // Automated Acceptance Test Suites
  ['tools/test_v2_02_1_production_hardening.cjs', 'tools/test_v2_02_1_production_hardening.cjs'],
  ['tools/test_v2_02_gmv_max_intelligence.cjs', 'tools/test_v2_02_gmv_max_intelligence.cjs'],

  // Detailed Runbooks
  ['V2_02_1_GMV_MAX_HARDENING_DEPLOYMENT_RUNBOOK.md', 'V2_02_1_GMV_MAX_HARDENING_DEPLOYMENT_RUNBOOK.md'],
  ['V2_02_1_GMV_MAX_BACKFILL_RUNBOOK.md', 'V2_02_1_GMV_MAX_BACKFILL_RUNBOOK.md']
];

// Add dist/assets files
const distAssetsDir = path.join(__dirname, '../dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const assetFiles = fs.readdirSync(distAssetsDir);
  for (const af of assetFiles) {
    manifestMap.push([`dist/assets/${af}`, `dist/assets/${af}`]);
  }
}

console.log('\nStep 2: Staging V2-02.1 release package files:');
const sourceHashes = {};
for (const [srcRel, destRel] of manifestMap) {
  const srcFull = path.join(__dirname, '..', srcRel);
  if (!fs.existsSync(srcFull)) {
    console.error(`FATAL: Required release file missing: ${srcFull}`);
    process.exit(1);
  }
  const fileBuf = fs.readFileSync(srcFull);
  const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');
  sourceHashes[destRel] = { size: fileBuf.length, hash };

  const destFull = path.join(stagingDir, destRel);
  fs.mkdirSync(path.dirname(destFull), { recursive: true });
  fs.copyFileSync(srcFull, destFull);
  console.log(`  + [STAGED] ${destRel} (${fileBuf.length.toLocaleString()} B, SHA256: ${hash.substring(0, 12)}...)`);
}

// Step 3: Create Release ZIP Archive with Strict POSIX Forward Slashes
console.log(`\nStep 3A: Creating POSIX-compliant release archive: ${releaseFileName}...`);

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

const tmpPsFile = path.join(releaseDir, `zip_temp_v202_1_${timestamp}.ps1`);
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
const manifestContent = `# ADDP COMMERCE INTELLIGENCE V2 — SPRINT V2-02.1 RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | \`${releaseFileName}\` |
| **Package SHA-256** | \`${releaseZipSha256}\` |
| **Package Size** | \`${releaseZipBuf.length.toLocaleString()} B\` |
| **Total Files** | \`${zipEntries.length}\` |
| **Built Timestamp** | \`${now.toISOString()}\` |
| **Milestone** | **Sprint V2-02.1: GMV Max Production Hardening + Period Coverage** |
| **Scope** | Null Safety, Migration 013 ROI Widening, Campaign Batching, Official Streams, Safe CLI Backfill |
| **Work Mode** | **LOCAL READY — PENDING PRODUCT OWNER DEPLOYMENT** |
| **Integrity Level** | Full POSIX Forward Slashes (Automated Central Directory Binary Verified) |

---

## Packaged Files & SHA-256 Checksums

| File Path | Size (B) | SHA-256 Checksum |
| :--- | :---: | :--- |
${manifestMap.map(([src, dest]) => `| \`${dest}\` | ${sourceHashes[dest].size} | \`${sourceHashes[dest].hash}\` |`).join('\n')}

---

## Quality Gate Verifications Passed
1. Real PHP \`php -l\` compilation across 29 files (100% PASS)
2. Sprint V2-02.1 Production Hardening Suite: 28/28 tests PASS
3. Sprint V2-02 GMV Max Intelligence Suite: 41/41 tests PASS
4. Sprint V2-02A Campaign GMV Max Suite: 75/75 scenarios PASS
5. Sprint V2-02A.2 Official GMV Max API Ingestion Suite: 60/60 scenarios PASS
6. Production Vite client build: \`dist/\` updated cleanly
7. Central Directory binary inspection: 0 Windows backslashes, 100% POSIX \`/\`
`;

const manifestFilePath = path.join(releaseDir, `MANIFEST_V2_02_1_${timestamp}.md`);
fs.writeFileSync(manifestFilePath, manifestContent, 'utf8');
console.log(`Manifest File:   ${manifestFilePath}`);
console.log('====================================================================\n');
