/**
 * ADDP COMMERCE INTELLIGENCE — CONSOLIDATED PRODUCTION DEPLOYMENT KIT PACKAGING
 * 
 * Target: Complete Commerce Intelligence V2 Production Package (HF1.2 → HF1.5)
 * Contents:
 * - All Forward Migrations (005, 006, 007, 008) & Rollbacks (005, 006, 007, 008)
 * - All Backend API Services & Unified Controller (config, tiktok_client, sync, aftersales, loss, finance, analytics, dashboard)
 * - Frontend UI Source (CommerceDashboardView.jsx, App.jsx)
 * - Frontend Production Build Artifacts (dist/index.html, dist/assets/*)
 * - Operational Safety Tools (preflight_schema_audit.php, runtime_validation_toolkit.php)
 * - Production Runbook (PRODUCTION_DEPLOYMENT_RUNBOOK.md)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING CONSOLIDATED COMMERCE V2 PRODUCTION DEPLOYMENT PACKAGING');
console.log('====================================================================\n');

// 1. Ensure Real PHP compile gate & duplicate method audit PASS
console.log('Step 1A: Running Real php -l compile gate across all PHP files...');
execSync('node tools/verify_php_syntax.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('Step 1B: Running duplicate method audit & regression test suite...');
execSync('node tools/test_duplicate_methods.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('Step 1C: Running Sprint V2-01 New Management Experience test suite...');
execSync('node tools/test_v2_01_management_experience.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('Step 1D: Running Sprint V2-01.1 Hotfix Acceptance test suite...');
execSync('node tools/test_v2_01_1_hotfix.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('Step 1E: Running Sprint V2-01.2 Final Acceptance test suite...');
execSync('node tools/test_v2_01_2_acceptance.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Ensure Vite production build is freshly generated
console.log('Step 1F: Running Vite build to refresh client distribution artifacts...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_commerce_v2_consolidated_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_consolidated_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 3. Manifest File List
const manifestMap = [
  // Database Migrations (005 - 009)
  ['database/migrations/20261001_005_create_commerce_aftersales_and_events.sql', 'database/migrations/20261001_005_create_commerce_aftersales_and_events.sql'],
  ['database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql', 'database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql'],
  ['database/migrations/20261001_006_upgrade_commerce_sync_runs.sql', 'database/migrations/20261001_006_upgrade_commerce_sync_runs.sql'],
  ['database/migrations/20261001_006_rollback_commerce_sync_runs.sql', 'database/migrations/20261001_006_rollback_commerce_sync_runs.sql'],
  ['database/migrations/20261001_007_create_commerce_finance_tables.sql', 'database/migrations/20261001_007_create_commerce_finance_tables.sql'],
  ['database/migrations/20261001_007_rollback_commerce_finance_tables.sql', 'database/migrations/20261001_007_rollback_commerce_finance_tables.sql'],
  ['database/migrations/20261001_008_create_commerce_analytics_tables.sql', 'database/migrations/20261001_008_create_commerce_analytics_tables.sql'],
  ['database/migrations/20261001_008_rollback_commerce_analytics_tables.sql', 'database/migrations/20261001_008_rollback_commerce_analytics_tables.sql'],
  ['database/migrations/20261002_009_create_commerce_customer_foundation.sql', 'database/migrations/20261002_009_create_commerce_customer_foundation.sql'],
  ['database/migrations/20261002_009_rollback_commerce_customer_foundation.sql', 'database/migrations/20261002_009_rollback_commerce_customer_foundation.sql'],

  // Backend Core & APIs
  ['public/api/config.php', 'public/api/config.php'],
  ['public/api/tiktok_client.php', 'public/api/tiktok_client.php'],
  ['public/api/commerce_sync_service.php', 'public/api/commerce_sync_service.php'],
  ['public/api/commerce_aftersales_service.php', 'public/api/commerce_aftersales_service.php'],
  ['public/api/commerce_loss_engine.php', 'public/api/commerce_loss_engine.php'],
  ['public/api/commerce_finance_service.php', 'public/api/commerce_finance_service.php'],
  ['public/api/commerce_analytics_service.php', 'public/api/commerce_analytics_service.php'],
  ['public/api/commerce_customer_service.php', 'public/api/commerce_customer_service.php'],
  ['public/api/commerce_ads_service.php', 'public/api/commerce_ads_service.php'],
  ['public/api/commerce_dashboard.php', 'public/api/commerce_dashboard.php'],

  // Operational Tools & Acceptance Suites
  ['tools/preflight_schema_audit.php', 'tools/preflight_schema_audit.php'],
  ['tools/runtime_validation_toolkit.php', 'tools/runtime_validation_toolkit.php'],
  ['tools/verify_php_syntax.cjs', 'tools/verify_php_syntax.cjs'],
  ['tools/test_v2_01_management_experience.cjs', 'tools/test_v2_01_management_experience.cjs'],
  ['tools/test_v2_01_1_hotfix.cjs', 'tools/test_v2_01_1_hotfix.cjs'],
  ['tools/test_v2_01_2_acceptance.cjs', 'tools/test_v2_01_2_acceptance.cjs'],

  // Frontend Source
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],
  ['src/App.jsx', 'src/App.jsx'],

  // Frontend Build Artifacts
  ['dist/index.html', 'dist/index.html'],

  // Runbook
  ['release/PRODUCTION_DEPLOYMENT_RUNBOOK.md', 'PRODUCTION_DEPLOYMENT_RUNBOOK.md']
];

// Add all dist/assets
const distAssetsDir = path.join(__dirname, '../dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const assetFiles = fs.readdirSync(distAssetsDir);
  for (const af of assetFiles) {
    manifestMap.push([`dist/assets/${af}`, `dist/assets/${af}`]);
  }
}

console.log('\nStep 2: Staging consolidated release files:');
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
  console.log(`  + ${destRel.padEnd(72)} (${String(buf.length).padStart(7)} B)  SHA256: ${hash}`);
}

// 4. Create Production Release Zip via PowerShell with strict POSIX paths
console.log(`\nStep 3: Creating production release package with strict POSIX paths: ${releaseFileName}...`);

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
const tmpPsFile = path.join(releaseDir, `zip_temp_${timestamp}.ps1`);
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

// Step 3B: Automated ZIP Inspection — Verify 100% of entries use POSIX '/' separators
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

console.log(`\n[PASS] Consolidated release package created successfully!`);
console.log(`[PASS] Automated package verification passed: All ${zipEntries.length} entries use strict POSIX '/' separators! Zero backslashes found.`);
console.log(`Package Path:   ${releaseZipPath}`);
console.log(`Package Size:   ${releaseZipBuf.length} bytes`);
console.log(`Package SHA256: ${releaseZipSha256}`);

// 5. Generate Release Manifest Markdown
const manifestContent = `# ADDP COMMERCE INTELLIGENCE V2 — CONSOLIDATED RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | \`${releaseFileName}\` |
| **Package SHA-256** | \`${releaseZipSha256}\` |
| **Package Size** | \`${releaseZipBuf.length} B\` |
| **Built Timestamp** | \`${now.toISOString()}\` |
| **Target Milestones** | **HF1.2, HF1.3, HF1.4, HF1.5 (Consolidated Commerce V2)** |
| **Release Status** | **LOCAL READY — PENDING PRODUCT OWNER MANUAL DEPLOYMENT** |
| **Zero Production Touch** | Local workstation only (Zero SSH, Zero production DB alteration) |

---

## Packaged Files & Checksums

| File Path | Size (B) | SHA-256 Checksum |
| :--- | :---: | :--- |
${manifestMap.map(([src, dest]) => `| \`${dest}\` | ${sourceHashes[dest].size} | \`${sourceHashes[dest].hash}\` |`).join('\n')}

---

## Historical Rollback References

| Version | Package File | SHA-256 Checksum |
| :--- | :--- | :--- |
| Phase A | \`task02b_phaseA_release_20260923_230000.zip\` | \`7B98895FE9E0F2B04E07B40A391942A8F965BC8B180A56C44EB7F96328A131F3\` |
| HF1.1.2 | \`task02b_hf1.1.2_release_20260924_181418.zip\` | \`50e181045b6db760923c8a958cf1fe3f8a002bc56b02005470d057140e90be90\` |
| HF1.2 Phase 1B | \`task_hf1_2_phase1b_release_20260929_114025.zip\` | \`6534328fbc7f6e7c2dea16ff5c93ae90ac4a5068c7d78eac307215256779a6c3\` |
| HF1.3 Phase 1B | \`task_hf1_3_phase1b_release_20261001_095119.zip\` | \`c31c98c7b3f77833baa64dff106c724cf5cbdfdc2eca6123868fb0868b6d953c\` |
| HF1.4 Phase 1B | \`task_hf1_4_phase1b_release_20261001_102927.zip\` | \`d10d145e4d471f8b66b3ab2bd130325ee9b3a2f4504babe62477fbf04715195a\` |
| HF1.5 Phase 1B | \`task_hf1_5_phase1b_release_20261001_113544.zip\` | \`a73721a23607072aec4086b382f7eefc5e205a4d884c983a6c850f767603a794\` |

---

## Instructions for Product Owner
1. Review \`PRODUCTION_DEPLOYMENT_RUNBOOK.md\` included in package.
2. Run \`php tools/preflight_schema_audit.php\` on production prior to running any SQL migration.
3. Select and apply only migrations flagged as \`NOT_APPLIED\`.
4. Deploy web files and run \`php tools/runtime_validation_toolkit.php --check=all\`.
`;

const manifestPath = path.join(releaseDir, 'TASK_COMMERCE_V2_RELEASE_MANIFEST.md');
fs.writeFileSync(manifestPath, manifestContent, 'utf8');
console.log(`[PASS] Consolidated release manifest generated at: ${manifestPath}`);
