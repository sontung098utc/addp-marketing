/**
 * SPRINT V2-02A CAMPAIGN GMV MAX INTELLIGENCE — PRODUCTION RELEASE PACKAGER
 * 
 * Verifies all gates before producing POSIX-compliant release ZIP:
 * 1. PHP syntax compilation across codebase
 * 2. V2-01.2 Final Acceptance Suite (61/61 scenarios)
 * 3. V2-02A Campaign GMV Max Acceptance Suite (73/73 scenarios)
 * 4. Production Vite build (npm run build)
 * 5. Strict POSIX ZIP packaging (Zero Windows backslashes in archive)
 * 6. Central Directory binary inspection & SHA-256 computation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-02A CAMPAIGN GMV MAX RELEASE PACKAGING PIPELINE');
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

// 4. Refresh Vite production build
console.log('\nStep 1D: Running Vite production build to refresh client dist artifacts...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 5. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_02a_campaign_gmv_max_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v202a_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 6. Manifest File Mapping
const manifestMap = [
  // Database Migration 010 & Rollback
  ['database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql', 'database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql'],
  ['database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql', 'database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql'],

  // Backend Services & API
  ['public/api/commerce_ads_ingestion_service.php', 'public/api/commerce_ads_ingestion_service.php'],
  ['public/api/commerce_ads_service.php', 'public/api/commerce_ads_service.php'],
  ['public/api/commerce_analytics_service.php', 'public/api/commerce_analytics_service.php'],
  ['public/api/commerce_dashboard.php', 'public/api/commerce_dashboard.php'],

  // Frontend Source
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],

  // Frontend Production Distribution
  ['dist/index.html', 'dist/index.html'],

  // Automated Acceptance Test Suites
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

console.log('\nStep 2: Staging V2-02A release package files:');
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
  console.log(`  + ${destRel.padEnd(74)} (${String(buf.length).padStart(7)} B)  SHA256: ${hash}`);
}

// 7. Create ZIP Package with PowerShell using strict forward slashes
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

const tmpPsFile = path.join(releaseDir, `zip_temp_v202a_${timestamp}.ps1`);
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

// 8. Generate Release Manifest Markdown
const manifestContent = `# ADDP COMMERCE INTELLIGENCE V2 — SPRINT V2-02A RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | \`${releaseFileName}\` |
| **Package SHA-256** | \`${releaseZipSha256}\` |
| **Package Size** | \`${releaseZipBuf.length.toLocaleString()} B\` |
| **Total Files** | \`${zipEntries.length}\` |
| **Built Timestamp** | \`${now.toISOString()}\` |
| **Milestone** | **Sprint V2-02A: Campaign GMV Max Intelligence** |
| **Work Mode** | **LOCAL READY — PENDING PRODUCT OWNER DEPLOYMENT** |
| **Integrity Level** | Full POSIX Forward Slashes (Automated Central Directory Verified) |

---

## Packaged Files & SHA-256 Checksums

| File Path | Size (B) | SHA-256 Checksum |
| :--- | :---: | :--- |
${manifestMap.map(([src, dest]) => `| \`${dest}\` | ${sourceHashes[dest].size} | \`${sourceHashes[dest].hash}\` |`).join('\n')}

---

## Deployment Instructions for Product Owner

1. Copy \`${releaseFileName}\` to production server webroot or staging directory.
2. Unzip into target directory: \`unzip -q ${releaseFileName}\`.
3. Apply versioned migration:
   \`\`\`bash
   mysql -u \$DB_USER -p \$DB_NAME < database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql
   \`\`\`
4. Run validation test suites:
   \`\`\`bash
   node tools/test_v2_02a_campaign_gmv_max.cjs
   node tools/test_v2_01_2_acceptance.cjs
   \`\`\`
5. Verify in browser under tab **Quảng Cáo (GMV Max)**.
`;

const manifestPath = path.join(releaseDir, 'V2_02A_CAMPAIGN_GMV_MAX_RELEASE_MANIFEST.md');
fs.writeFileSync(manifestPath, manifestContent, 'utf8');
console.log(`Manifest Path:   ${manifestPath}\n`);
