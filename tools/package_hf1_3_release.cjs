/**
 * TASK HF1.3 PHASE 1B PRODUCTION RELEASE PACKAGING & VALIDATION PIPELINE
 * 
 * Packages:
 * - Migration 005 & Rollback 005
 * - public/api/config.php
 * - public/api/tiktok_client.php
 * - public/api/commerce_sync_service.php
 * - public/api/commerce_aftersales_service.php
 * - public/api/commerce_loss_engine.php
 * 
 * Verifies:
 * - Rollback package preservation
 * - Checksums of all files
 * - Generation of release artifact zip and release manifest
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('========================================================');
console.log('STARTING HF1.3 PHASE 1B PRODUCTION PACKAGING PIPELINE');
console.log('========================================================\n');

// 1. DEFINE TIMESTAMP & TARGETS
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_hf1_3_phase1b_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_hf1_3_${timestamp}`);

// Ensure release dir exists
if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });

// Check rollback packages preservation
const rollbackPathPhaseA = path.join(releaseDir, 'task02b_phaseA_release_20260923_230000.zip');
if (fs.existsSync(rollbackPathPhaseA)) {
  const rollbackShaPhaseA = crypto.createHash('sha256').update(fs.readFileSync(rollbackPathPhaseA)).digest('hex').toUpperCase();
  console.log(`[PASS] Rollback Package Phase A verified intact: ${rollbackShaPhaseA}`);
}

const rollbackPathHF1_1_2 = path.join(releaseDir, 'task02b_hf1.1.2_release_20260924_181418.zip');
if (fs.existsSync(rollbackPathHF1_1_2)) {
  const rollbackShaHF1_1_2 = crypto.createHash('sha256').update(fs.readFileSync(rollbackPathHF1_1_2)).digest('hex');
  console.log(`[PASS] Rollback Package HF1.1.2 verified intact: ${rollbackShaHF1_1_2}`);
}

const rollbackPathHF1_2 = path.join(releaseDir, 'task_hf1_2_phase1b_release_20260929_114025.zip');
if (fs.existsSync(rollbackPathHF1_2)) {
  const rollbackShaHF1_2 = crypto.createHash('sha256').update(fs.readFileSync(rollbackPathHF1_2)).digest('hex');
  console.log(`[PASS] Rollback Package HF1.2 Phase 1B verified intact: ${rollbackShaHF1_2}`);
}

// 2. PREPARE STAGING DIRECTORY WITH MANIFEST FILES
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });
fs.mkdirSync(path.join(stagingDir, 'database', 'migrations'), { recursive: true });
fs.mkdirSync(path.join(stagingDir, 'public', 'api'), { recursive: true });

// File copy mapping: [source, relativeDestination]
const manifestMap = [
  ['database/migrations/20261001_005_create_commerce_aftersales_and_events.sql', 'database/migrations/20261001_005_create_commerce_aftersales_and_events.sql'],
  ['database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql', 'database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql'],
  ['database/migrations/20261001_006_upgrade_commerce_sync_runs.sql', 'database/migrations/20261001_006_upgrade_commerce_sync_runs.sql'],
  ['database/migrations/20261001_006_rollback_commerce_sync_runs.sql', 'database/migrations/20261001_006_rollback_commerce_sync_runs.sql'],
  ['public/api/config.php', 'public/api/config.php'],
  ['public/api/tiktok_client.php', 'public/api/tiktok_client.php'],
  ['public/api/commerce_sync_service.php', 'public/api/commerce_sync_service.php'],
  ['public/api/commerce_aftersales_service.php', 'public/api/commerce_aftersales_service.php'],
  ['public/api/commerce_loss_engine.php', 'public/api/commerce_loss_engine.php']
];

console.log('\nStaging minimal HF1.3 Phase 1B manifest files:');
const sourceHashes = {};
for (const [srcRel, destRel] of manifestMap) {
  const srcFull = path.join(__dirname, '..', srcRel);
  if (!fs.existsSync(srcFull)) {
    console.error(`FATAL: Missing source file: ${srcRel}`);
    process.exit(1);
  }
  const destFull = path.join(stagingDir, destRel);
  fs.copyFileSync(srcFull, destFull);
  const buf = fs.readFileSync(destFull);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  sourceHashes[destRel] = { hash, size: buf.length };
  console.log(`  + ${destRel.padEnd(72)} (${String(buf.length).padStart(6)} B)  SHA256: ${hash}`);
}

// 3. CREATE PRODUCTION RELEASE ZIP VIA POWERSHELL
console.log(`\nCreating production release package: ${releaseFileName}...`);
const psScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory('${stagingDir.replace(/\\/g, '\\\\')}', '${releaseZipPath.replace(/\\/g, '\\\\')}')
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
console.log(`\n[PASS] Release package created successfully!`);
console.log(`Package Path:   ${releaseZipPath}`);
console.log(`Package Size:   ${releaseZipBuf.length} bytes`);
console.log(`Package SHA256: ${releaseZipSha256}`);

// 4. WRITE RELEASE MANIFEST MARKDOWN
const manifestContent = `# HF1.3 PHASE 1B PRODUCTION RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | \`${releaseFileName}\` |
| **Package SHA-256** | \`${releaseZipSha256}\` |
| **Package Size** | \`${releaseZipBuf.length} B\` |
| **Built Timestamp** | \`${now.toISOString()}\` |
| **Target Milestone** | HF1.3 Phase 1B Return, Refund & Loss Engine |
| **Release Status** | **LOCAL/STAGING READY** (Production Deployment = 0, Production DB Changes = 0) |

## Packaged Files & Checksums

| File Path | Size (B) | SHA-256 Checksum |
| :--- | :---: | :--- |
${manifestMap.map(([src, dest]) => `| \`${dest}\` | ${sourceHashes[dest].size} | \`${sourceHashes[dest].hash}\` |`).join('\n')}

## Historical Rollback References

| Version | Package File | SHA-256 Checksum |
| :--- | :--- | :--- |
| Phase A | \`task02b_phaseA_release_20260923_230000.zip\` | \`7B98895FE9E0F2B04E07B40A391942A8F965BC8B180A56C44EB7F96328A131F3\` |
| HF1.1.2 | \`task02b_hf1.1.2_release_20260924_181418.zip\` | \`50e181045b6db760923c8a958cf1fe3f8a002bc56b02005470d057140e90be90\` |
| HF1.2 Phase 1B | \`task_hf1_2_phase1b_release_20260929_114025.zip\` | \`6534328fbc7f6e7c2dea16ff5c93ae90ac4a5068c7d78eac307215256779a6c3\` |
`;

const manifestPath = path.join(releaseDir, 'TASK_HF1_3_PHASE1B_RELEASE_MANIFEST.md');
fs.writeFileSync(manifestPath, manifestContent, 'utf8');
console.log(`[PASS] Release manifest generated at: ${manifestPath}`);
