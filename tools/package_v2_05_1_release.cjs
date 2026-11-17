/**
 * SPRINT V2-05.1 HMAC SECRET SECURITY HOTFIX — RELEASE PACKAGER
 * 
 * Verifies all quality gates before producing POSIX-compliant release ZIP:
 * 1. PHP syntax compilation across codebase (36 files)
 * 2. V2-05.1 HMAC Secret Fail-Closed Security Test Suite (12/12 tests, Cases A through L)
 * 3. V2-05 Customer 360 Ingestion & Privacy Test Suite (9/9 tests)
 * 4. V2-05 Requested Period Semantics & UI Tokens Test Suite (4/4 tests)
 * 5. V2-04.4 Reporting Freshness & Period Alignment Test Suite (17/17 tests)
 * 6. V2-04.4 Order List & Export Test Suite (6/6 tests)
 * 7. V2-04.3 Async Sync Jobs & Recovery Test Suite (15/15 tests)
 * 8. Production Vite build (npm run build)
 * 9. Strict POSIX ZIP packaging (Zero Windows backslashes in archive)
 * 10. Central Directory binary inspection & SHA-256 computation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-05.1 HMAC SECRET SECURITY HOTFIX RELEASE PIPELINE');
console.log('====================================================================\n');

// 1. Verify Real PHP compile gate
console.log('Step 1A: Running PHP syntax validation across codebase...');
execSync('node tools/verify_php_syntax.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Run V2-05.1 HMAC Fail-Closed Security Test Suite
console.log('\nStep 1B.1: Running Sprint V2-05.1 HMAC Fail-Closed Security test suite (Cases A-L)...');
execSync('node tools/test_v2_05_1_hmac_secret_fail_closed.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Run V2-05 Test Suites
console.log('\nStep 1B.2: Running Sprint V2-05 Customer 360 Ingestion & Privacy test suite...');
execSync('node tools/test_v2_05_customer_ingestion_and_privacy.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1B.3: Running Sprint V2-05 Requested Period & UI Tokens test suite...');
execSync('node tools/test_v2_05_requested_period_and_ui_tokens.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 4. Run V2-04.4 Test Suites
console.log('\nStep 1C.1: Running Sprint V2-04.4 Reporting Freshness & Period Alignment test suite...');
execSync('node tools/test_v2_04_4_reporting_freshness_and_period_alignment.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1C.2: Running Sprint V2-04.4 Order List & Export test suite...');
execSync('node tools/test_v2_04_4_order_list_and_export.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 5. Run V2-04.3 Async Jobs Test Suite
console.log('\nStep 1D: Running Sprint V2-04.3 Async Sync Jobs & Recovery test suite...');
execSync('node tools/test_v2_04_3_async_sync_jobs_and_recovery.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 6. Refresh Vite production build
console.log('\nStep 1E: Running Vite production build to refresh client dist artifacts...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 7. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_05_1_hmac_secret_security_hotfix_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v205_1_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 8. Define Release Manifest Files
const manifestMap = [
  // Database Migrations (Sprint V2-05 Migration 017 + V2-04 Migrations 016, 015, 014)
  ['database/migrations/20261006_017_add_customer_identity_columns.sql', 'database/migrations/20261006_017_add_customer_identity_columns.sql'],
  ['database/migrations/20261006_017_rollback_add_customer_identity_columns.sql', 'database/migrations/20261006_017_rollback_add_customer_identity_columns.sql'],
  ['database/migrations/20261005_016_create_commerce_sync_jobs.sql', 'database/migrations/20261005_016_create_commerce_sync_jobs.sql'],
  ['database/migrations/20261005_016_rollback_create_commerce_sync_jobs.sql', 'database/migrations/20261005_016_rollback_create_commerce_sync_jobs.sql'],
  ['database/migrations/20261005_015_widen_aftersales_reason_and_role.sql', 'database/migrations/20261005_015_widen_aftersales_reason_and_role.sql'],
  ['database/migrations/20261005_015_rollback_widen_aftersales_reason_and_role.sql', 'database/migrations/20261005_015_rollback_widen_aftersales_reason_and_role.sql'],
  ['database/migrations/20261005_014_enhance_commerce_sync_runs_metadata.sql', 'database/migrations/20261005_014_enhance_commerce_sync_runs_metadata.sql'],
  ['database/migrations/20261005_014_rollback_enhance_commerce_sync_runs_metadata.sql', 'database/migrations/20261005_014_rollback_enhance_commerce_sync_runs_metadata.sql'],

  // Backend API & Core Engine Services
  ['public/api/config.php', 'public/api/config.php'],
  ['public/api/commerce_customer_service.php', 'public/api/commerce_customer_service.php'],
  ['public/api/commerce_reporting_service.php', 'public/api/commerce_reporting_service.php'],
  ['public/api/commerce_sync_orchestrator.php', 'public/api/commerce_sync_orchestrator.php'],
  ['public/api/commerce_sync_service.php', 'public/api/commerce_sync_service.php'],
  ['public/api/commerce_dashboard.php', 'public/api/commerce_dashboard.php'],
  ['public/api/commerce_loss_engine.php', 'public/api/commerce_loss_engine.php'],
  ['public/api/commerce_aftersales_service.php', 'public/api/commerce_aftersales_service.php'],
  ['public/api/commerce_finance_service.php', 'public/api/commerce_finance_service.php'],
  ['public/api/commerce_analytics_service.php', 'public/api/commerce_analytics_service.php'],
  ['public/api/commerce_ads_ingestion_service.php', 'public/api/commerce_ads_ingestion_service.php'],
  ['public/api/commerce_sync.php', 'public/api/commerce_sync.php'],
  ['public/api/commerce_report.php', 'public/api/commerce_report.php'],
  ['public/api/tiktok_client.php', 'public/api/tiktok_client.php'],

  // Tools & Operator CLI Tools
  ['tools/verify_customer_config_cli.php', 'tools/verify_customer_config_cli.php'],
  ['tools/sync_worker_cli.php', 'tools/sync_worker_cli.php'],

  // Frontend React Source
  ['src/App.jsx', 'src/App.jsx'],
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],
  ['src/CommerceReportView.jsx', 'src/CommerceReportView.jsx'],
  ['src/CommerceSyncManagementView.jsx', 'src/CommerceSyncManagementView.jsx'],
  ['src/index.css', 'src/index.css'],
  ['src/App.css', 'src/App.css'],

  // Frontend Production Distribution
  ['dist/index.html', 'dist/index.html'],

  // Automated Tests & Mocking Harness
  ['tools/test_v2_05_1_hmac_secret_fail_closed.cjs', 'tools/test_v2_05_1_hmac_secret_fail_closed.cjs'],
  ['tools/test_v2_05_customer_ingestion_and_privacy.cjs', 'tools/test_v2_05_customer_ingestion_and_privacy.cjs'],
  ['tools/test_v2_05_requested_period_and_ui_tokens.cjs', 'tools/test_v2_05_requested_period_and_ui_tokens.cjs'],
  ['tools/test_v2_04_4_reporting_freshness_and_period_alignment.cjs', 'tools/test_v2_04_4_reporting_freshness_and_period_alignment.cjs'],
  ['tools/test_v2_04_4_order_list_and_export.cjs', 'tools/test_v2_04_4_order_list_and_export.cjs'],
  ['tools/test_v2_04_3_async_sync_jobs_and_recovery.cjs', 'tools/test_v2_04_3_async_sync_jobs_and_recovery.cjs'],
  ['tools/mock_pdo_helper.php', 'tools/mock_pdo_helper.php'],
  ['tools/verify_php_syntax.cjs', 'tools/verify_php_syntax.cjs'],

  // Documentation & Runbooks
  ['V2_05_1_HMAC_SECRET_SECURITY_HOTFIX_RUNBOOK.md', 'V2_05_1_HMAC_SECRET_SECURITY_HOTFIX_RUNBOOK.md'],
  ['V2_05_UNIFIED_BUSINESS_UI_AND_CUSTOMER_360_RUNBOOK.md', 'V2_05_UNIFIED_BUSINESS_UI_AND_CUSTOMER_360_RUNBOOK.md'],
  ['V2_04_4_REPORTING_FRESHNESS_AND_PERIOD_ALIGNMENT_RUNBOOK.md', 'V2_04_4_REPORTING_FRESHNESS_AND_PERIOD_ALIGNMENT_RUNBOOK.md'],
  ['V2_04_3_ASYNC_SYNC_JOBS_AND_RECOVERY_RUNBOOK.md', 'V2_04_3_ASYNC_SYNC_JOBS_AND_RECOVERY_RUNBOOK.md']
];

// Add dist/assets files
const distAssetsDir = path.join(__dirname, '../dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const assetFiles = fs.readdirSync(distAssetsDir);
  for (const af of assetFiles) {
    manifestMap.push([`dist/assets/${af}`, `dist/assets/${af}`]);
  }
}

console.log('\nStep 2: Staging release files...');
for (const [srcRel, destRel] of manifestMap) {
  const srcFull = path.join(__dirname, '..', srcRel);
  if (!fs.existsSync(srcFull)) {
    throw new Error(`CRITICAL: Staging source file missing: ${srcFull}`);
  }
  const destFull = path.join(stagingDir, destRel);
  fs.mkdirSync(path.dirname(destFull), { recursive: true });
  fs.copyFileSync(srcFull, destFull);
  console.log(`  + Staged: ${destRel}`);
}

// Write Deployment Notes in Staging
const deploymentNotes = `# V2-05.1 HMAC Secret Security Hotfix Deployment Notes
Release: ${releaseFileName}
Timestamp: ${timestamp}
Scope:
1. Dedicated Customer Identity Secret:
   - Eliminated hardcoded fallback 'addp_customer_salt_2026', TIKTOK_APP_SECRET, AUTH_SIGNING_KEY.
   - Requires dedicated CUSTOMER_IDENTITY_HMAC_KEY in .env.
2. Fail-Closed Security Invariant:
   - If CUSTOMER_IDENTITY_HMAC_KEY is missing, empty, or < 32 chars:
     Status: CONFIGURATION_ERROR
     Reason: CUSTOMER_IDENTITY_HMAC_KEY_MISSING or CUSTOMER_IDENTITY_HMAC_KEY_INVALID.
   - Never generates customer hashes with fake keys.
   - Never writes plaintext PII.
3. Non-Fatal Orders Sync Decoupling:
   - Orders sync remains 100% SUCCESSFUL even if customer HMAC key is missing.
4. Operator Verification Tool:
   - php tools/verify_customer_config_cli.php
   - Prints only CUSTOMER_IDENTITY_HMAC_KEY=CONFIGURED | MISSING | INVALID.
   - Zero secret value leakage.
5. Preserved September Authoritative Baseline:
   - Orders: 4,207 | Gross: 409,171,911 | Loss: 86,200,839 | Realized: 322,971,072
   - Ads Spend: 34,182,003 | Attributed Gross: 383,251,049 | Orders: 5,165 | ROI: 11.21
`;
fs.writeFileSync(path.join(stagingDir, 'RELEASE_NOTES.txt'), deploymentNotes, 'utf8');

// Step 3: Pure POSIX ZIP Creation (No Windows backslashes)
console.log('\nStep 3: Creating pure POSIX ZIP archive...');

function createPosixZip(sourceDir, zipFilePath) {
  const entries = [];
  function walk(dir, relPath = '') {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const posixRel = relPath ? `${relPath}/${item}` : item;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, posixRel);
      } else {
        entries.push({
          fullPath,
          entryName: posixRel.replace(/\\/g, '/'),
          data: fs.readFileSync(fullPath),
          mtime: stat.mtime
        });
      }
    }
  }
  walk(sourceDir);

  const localFileHeaders = [];
  const centralDirHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.entryName, 'utf8');
    const dataBuf = entry.data;
    const uncompressedSize = dataBuf.length;
    const compressedSize = dataBuf.length;

    // CRC32 calculation
    const crc = crc32(dataBuf);

    // DOS Time & Date
    const d = entry.mtime;
    const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))) & 0xFFFF;
    const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

    // Local file header (30 bytes + nameBuf.length)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);          // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);      // flags (UTF-8)
    localHeader.writeUInt16LE(0, 8);           // compression (0 = store)
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);          // extra field length
    nameBuf.copy(localHeader, 30);

    localFileHeaders.push(localHeader);
    localFileHeaders.push(dataBuf);

    // Central directory header (46 bytes + nameBuf.length)
    const cdHeader = Buffer.alloc(46 + nameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);    // signature
    cdHeader.writeUInt16LE(20, 4);             // version made by
    cdHeader.writeUInt16LE(20, 6);             // version needed
    cdHeader.writeUInt16LE(0x0800, 8);         // flags (UTF-8)
    cdHeader.writeUInt16LE(0, 10);             // compression (store)
    cdHeader.writeUInt16LE(dosTime, 12);
    cdHeader.writeUInt16LE(dosDate, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(compressedSize, 20);
    cdHeader.writeUInt32LE(uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);             // extra field length
    cdHeader.writeUInt16LE(0, 32);             // comment length
    cdHeader.writeUInt16LE(0, 34);             // disk number start
    cdHeader.writeUInt16LE(0, 36);             // internal attributes
    cdHeader.writeUInt32LE(0, 38);             // external attributes
    cdHeader.writeUInt32LE(offset, 42);        // local header offset
    nameBuf.copy(cdHeader, 46);

    centralDirHeaders.push(cdHeader);
    offset += localHeader.length + dataBuf.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cdh of centralDirHeaders) cdSize += cdh.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);          // signature
  eocd.writeUInt16LE(0, 4);                   // disk number
  eocd.writeUInt16LE(0, 6);                   // start disk
  eocd.writeUInt16LE(entries.length, 8);      // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);     // total entries
  eocd.writeUInt32LE(cdSize, 12);             // size of central directory
  eocd.writeUInt32LE(cdOffset, 16);           // offset of central directory
  eocd.writeUInt16LE(0, 20);                  // comment length

  const allBuffers = [...localFileHeaders, ...centralDirHeaders, eocd];
  const finalZip = Buffer.concat(allBuffers);
  fs.writeFileSync(zipFilePath, finalZip);
}

// CRC32 implementation
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    crc32.table = table;
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

createPosixZip(stagingDir, releaseZipPath);
console.log(`\nRelease archive created: ${releaseZipPath}`);

// Step 9: Binary Inspection of Central Directory
console.log('\nStep 4: Performing binary Central Directory POSIX audit...');
const zipBuf = fs.readFileSync(releaseZipPath);
let cdPtr = 0;
let invalidPaths = 0;
let totalEntries = 0;

while (cdPtr < zipBuf.length - 4) {
  if (zipBuf.readUInt32LE(cdPtr) === 0x02014b50) {
    totalEntries++;
    const nameLen = zipBuf.readUInt16LE(cdPtr + 28);
    const extraLen = zipBuf.readUInt16LE(cdPtr + 30);
    const commLen = zipBuf.readUInt16LE(cdPtr + 32);
    const name = zipBuf.subarray(cdPtr + 46, cdPtr + 46 + nameLen).toString('utf8');
    if (name.includes('\\')) {
      console.error(`  [VIOLATION] Found backslash in entry: ${name}`);
      invalidPaths++;
    }
    cdPtr += 46 + nameLen + extraLen + commLen;
  } else {
    cdPtr++;
  }
}

if (invalidPaths > 0) {
  throw new Error(`Archive contains ${invalidPaths} non-POSIX path entries!`);
}
console.log(`  ✔ Verified ${totalEntries} archive entries: 100% POSIX compliant (Zero Windows backslashes).`);

// Step 10: Compute SHA-256 Checksum
console.log('\nStep 5: Computing SHA-256 checksum...');
const hash = crypto.createHash('sha256').update(zipBuf).digest('hex');
const checksumFile = `${releaseZipPath}.sha256`;
fs.writeFileSync(checksumFile, `${hash}  ${releaseFileName}\n`, 'utf8');

console.log(`  Archive Size: ${(zipBuf.length / (1024 * 1024)).toFixed(2)} MB (${zipBuf.length} bytes)`);
console.log(`  SHA-256 Checksum: ${hash}`);

// Cleanup staging
fs.rmSync(stagingDir, { recursive: true, force: true });

console.log('\n====================================================================');
console.log('SPRINT V2-05.1 RELEASE PACKAGING COMPLETE AND VERIFIED!');
console.log(`Archive: ${releaseFileName}`);
console.log(`SHA-256: ${hash}`);
console.log('====================================================================\n');
