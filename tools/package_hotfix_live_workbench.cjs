/**
 * ADDP COMMERCE INTELLIGENCE — PRODUCTION HOTFIX PACKAGING
 * 
 * Target: Hotfix Live Workbench Crash (TypeError: Cannot read properties of undefined (reading 'value'))
 * & Empty State Resilience & Benchmark UI Separation
 * 
 * Contents:
 * - Backend: public/api/commerce_analytics_service.php
 * - Frontend Build: dist/index.html, dist/assets/index-D4REqcG3.js, dist/assets/index-DuDEHqtr.css
 * - Frontend Source: src/CommerceDashboardView.jsx
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('PACKAGING PRODUCTION HOTFIX: LIVE WORKBENCH & EMPTY-STATE RESILIENCE');
console.log('====================================================================\n');

// 1. Verify tests pass first
console.log('Step 1: Running validation suites...');
execSync('node tools/verify_php_syntax.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
execSync('node tools/test_empty_state_resilience.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Identify assets
const distAssetsDir = path.join(__dirname, '../dist/assets');
const assetFiles = fs.readdirSync(distAssetsDir);
const jsBundle = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));
const cssBundle = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.css'));

if (!jsBundle) {
  console.error('FATAL: Could not locate built JS bundle in dist/assets!');
  process.exit(1);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const hotfixZipName = `hotfix_live_workbench_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const hotfixZipPath = path.join(releaseDir, hotfixZipName);
const stagingDir = path.join(releaseDir, `staging_hotfix_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 3. Hotfix Manifest
const hotfixFiles = [
  ['public/api/commerce_analytics_service.php', 'api/commerce_analytics_service.php'],
  ['dist/index.html', 'index.html'],
  [`dist/assets/${jsBundle}`, `assets/${jsBundle}`],
  [`dist/assets/${cssBundle}`, `assets/${cssBundle}`]
];

console.log('\nStep 2: Staging Hotfix files & computing SHA-256:');
const fileHashes = {};

for (const [srcRel, destRel] of hotfixFiles) {
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
  fileHashes[srcRel] = {
    target: destRel,
    bytes: buf.length,
    sha256: hash
  };
  console.log(`  + ${destRel.padEnd(42)} (${String(buf.length).padStart(7)} B)  SHA256: ${hash}`);
}

// 4. Create ZIP via PowerShell
console.log(`\nStep 3: Creating hotfix package: ${hotfixZipName}...`);
const psScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory('${stagingDir.replace(/\\/g, '\\\\')}', '${hotfixZipPath.replace(/\\/g, '\\\\')}')
`;
const tmpPsFile = path.join(releaseDir, `zip_temp_hotfix_${timestamp}.ps1`);
fs.writeFileSync(tmpPsFile, psScript, 'utf8');

try {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPsFile}"`, { stdio: 'inherit' });
} finally {
  if (fs.existsSync(tmpPsFile)) fs.unlinkSync(tmpPsFile);
  fs.rmSync(stagingDir, { recursive: true, force: true });
}

const zipBuf = fs.readFileSync(hotfixZipPath);
const zipSha256 = crypto.createHash('sha256').update(zipBuf).digest('hex');

console.log(`\n[PASS] HOTFIX PACKAGE CREATED SUCCESSFULLY!`);
console.log(`Package Path:   ${hotfixZipPath}`);
console.log(`Package Size:   ${zipBuf.length} bytes`);
console.log(`Package SHA256: ${zipSha256}`);

// Write summary JSON
const summaryJson = {
  package: hotfixZipName,
  package_sha256: zipSha256,
  package_size: zipBuf.length,
  files: fileHashes
};
fs.writeFileSync(path.join(releaseDir, 'LATEST_HOTFIX_MANIFEST.json'), JSON.stringify(summaryJson, null, 2), 'utf8');

console.log(`Manifest written to release/LATEST_HOTFIX_MANIFEST.json`);
