/**
 * SPRINT V2-04.3 ASYNC SYNC JOB ORCHESTRATOR & RUN RECOVERY — RELEASE PACKAGER
 * 
 * Verifies all quality gates before producing POSIX-compliant release ZIP:
 * 1. PHP syntax compilation across codebase (35 files)
 * 2. V2-04.3 Async Sync Jobs & Recovery Test Suite (15/15 tests)
 * 3. V2-04.2 Report Sync Button Hotfix Test Suite (10/10 tests)
 * 4. V2-04.2 Orders Auto Sync & Coverage Test Suite (11/11 tests)
 * 5. V2-04.1 Production Acceptance Fix Test Suite (9/9 tests)
 * 6. V2-04 Automated Sync Engine & Compact UI Test Suite (17/17 tests)
 * 7. Production Vite build (npm run build)
 * 8. Strict POSIX ZIP packaging (Zero Windows backslashes in archive)
 * 9. Central Directory binary inspection & SHA-256 computation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-04.3 ASYNC SYNC JOBS & RECOVERY RELEASE PIPELINE');
console.log('====================================================================\n');

// 1. Verify Real PHP compile gate
console.log('Step 1A: Running PHP syntax validation across codebase...');
execSync('node tools/verify_php_syntax.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Run V2-04.3 Test Suite
console.log('\nStep 1B: Running Sprint V2-04.3 Async Sync Jobs & Recovery test suite...');
execSync('node tools/test_v2_04_3_async_sync_jobs_and_recovery.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Run V2-04.2 Hotfix Test Suite
console.log('\nStep 1C: Running Sprint V2-04.2 Hotfix Report Sync Button test suite...');
execSync('node tools/test_v2_04_2_report_sync_button_hotfix.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 4. Run V2-04.2 Test Suite
console.log('\nStep 1D: Running Sprint V2-04.2 Orders Auto Sync & Coverage test suite...');
execSync('node tools/test_v2_04_2_orders_auto_sync_and_coverage.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 5. Run V2-04.1 Test Suite
console.log('\nStep 1E: Running Sprint V2-04.1 Production Acceptance Fix test suite...');
execSync('node tools/test_v2_04_1_production_acceptance_fix.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 6. Run V2-04 Test Suite
console.log('\nStep 1F: Running Sprint V2-04 Automated Sync Engine & Compact UI test suite...');
execSync('node tools/test_v2_04_sync_orchestrator_and_compact_ui.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 7. Refresh Vite production build
console.log('\nStep 1G: Running Vite production build to refresh client dist artifacts...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 8. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_04_3_async_sync_jobs_and_recovery_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v2043_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 9. Define Release Manifest Files
const manifestMap = [
  // Database Migrations (Sprint V2-04.3 Migration 016 + 015 + 014)
  ['database/migrations/20261005_016_create_commerce_sync_jobs.sql', 'database/migrations/20261005_016_create_commerce_sync_jobs.sql'],
  ['database/migrations/20261005_016_rollback_create_commerce_sync_jobs.sql', 'database/migrations/20261005_016_rollback_create_commerce_sync_jobs.sql'],
  ['database/migrations/20261005_015_widen_aftersales_reason_and_role.sql', 'database/migrations/20261005_015_widen_aftersales_reason_and_role.sql'],
  ['database/migrations/20261005_015_rollback_widen_aftersales_reason_and_role.sql', 'database/migrations/20261005_015_rollback_widen_aftersales_reason_and_role.sql'],
  ['database/migrations/20261005_014_enhance_commerce_sync_runs_metadata.sql', 'database/migrations/20261005_014_enhance_commerce_sync_runs_metadata.sql'],
  ['database/migrations/20261005_014_rollback_enhance_commerce_sync_runs_metadata.sql', 'database/migrations/20261005_014_rollback_enhance_commerce_sync_runs_metadata.sql'],

  // Backend API & Core Engine Services
  ['public/api/tiktok_client.php', 'public/api/tiktok_client.php'],
  ['public/api/commerce_sync_service.php', 'public/api/commerce_sync_service.php'],
  ['public/api/commerce_aftersales_service.php', 'public/api/commerce_aftersales_service.php'],
  ['public/api/commerce_loss_engine.php', 'public/api/commerce_loss_engine.php'],
  ['public/api/commerce_sync_orchestrator.php', 'public/api/commerce_sync_orchestrator.php'],
  ['public/api/commerce_reporting_service.php', 'public/api/commerce_reporting_service.php'],
  ['public/api/commerce_sync.php', 'public/api/commerce_sync.php'],
  ['public/api/commerce_report.php', 'public/api/commerce_report.php'],
  ['public/api/commerce_dashboard.php', 'public/api/commerce_dashboard.php'],
  ['public/api/commerce_finance_service.php', 'public/api/commerce_finance_service.php'],
  ['public/api/commerce_analytics_service.php', 'public/api/commerce_analytics_service.php'],
  ['public/api/commerce_ads_ingestion_service.php', 'public/api/commerce_ads_ingestion_service.php'],

  // Background CLI Worker
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
  ['tools/test_v2_04_3_async_sync_jobs_and_recovery.cjs', 'tools/test_v2_04_3_async_sync_jobs_and_recovery.cjs'],
  ['tools/test_v2_04_2_orders_auto_sync_and_coverage.cjs', 'tools/test_v2_04_2_orders_auto_sync_and_coverage.cjs'],
  ['tools/test_v2_04_2_report_sync_button_hotfix.cjs', 'tools/test_v2_04_2_report_sync_button_hotfix.cjs'],
  ['tools/test_v2_04_1_production_acceptance_fix.cjs', 'tools/test_v2_04_1_production_acceptance_fix.cjs'],
  ['tools/test_v2_04_sync_orchestrator_and_compact_ui.cjs', 'tools/test_v2_04_sync_orchestrator_and_compact_ui.cjs'],
  ['tools/mock_pdo_helper.php', 'tools/mock_pdo_helper.php'],
  ['tools/verify_php_syntax.cjs', 'tools/verify_php_syntax.cjs'],

  // Documentation & Runbooks
  ['V2_04_3_ASYNC_SYNC_JOBS_AND_RECOVERY_RUNBOOK.md', 'V2_04_3_ASYNC_SYNC_JOBS_AND_RECOVERY_RUNBOOK.md'],
  ['V2_04_2_ORDERS_AUTO_SYNC_RUNBOOK.md', 'V2_04_2_ORDERS_AUTO_SYNC_RUNBOOK.md'],
  ['V2_04_1_PRODUCTION_ACCEPTANCE_RUNBOOK.md', 'V2_04_1_PRODUCTION_ACCEPTANCE_RUNBOOK.md'],
  ['V2_04_SYNC_AND_COMPACT_UI_RUNBOOK.md', 'V2_04_SYNC_AND_COMPACT_UI_RUNBOOK.md']
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
const deploymentNotes = `# V2-04.3 Async Sync Job Orchestrator & Run Recovery Deployment Notes
Release: ${releaseFileName}
Timestamp: ${timestamp}
Scope:
1. Asynchronous Sync Job Model (commerce_sync_jobs):
   - Fast initiation response (< 1s) with job_id and status QUEUED.
   - Dual execution engine: background CLI spawn + resilient cooperative polling tick.
   - Zero external worker dependency (no Redis, no Celery, no Node daemon, no Docker).
2. Concurrency & Run Recovery:
   - Single active job per shop (returns existing job on duplicate click).
   - Heartbeat timeout recovery (180s) converts abandoned RUNNING states to FAILED (STALE_JOB_RECOVERED, STALE_RUN_RECOVERED).
3. Domain Bug Fixes from Production Acceptance:
   - Ads campaign false-FAILED bug fixed (status AVAILABLE with records ingested marks COMPLETED).
   - RMA duplicate execution fixed (reusing runId prevents duplicate return_refund run).
   - Finance bounded statements failure isolated without failing Orders.
   - Analytics reaches terminal state SKIPPED_NOT_AVAILABLE (NOT_YET_AVAILABLE).
4. Frontend Experience:
   - Polling loop with real-time percentage progress update in header badge.
   - Button disabled during sync with duplicate click prevention.
   - Automatic report refresh on terminal completion.
5. Invariants & Preserved September Baseline:
   - Exactly 4,207 orders, 409,171,911 Gross Sales, 84,727,422 Total Loss, 324,444,489 Realized Sales, 34,182,003 Spend, 383,251,049 Ads Rev, 11.21 ROI.
   - All regression suites passing (100%).
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
        c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    crc32.table = table;
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ (-1)) >>> 0;
}

createPosixZip(stagingDir, releaseZipPath);

// Step 4: Verify ZIP and Check for Windows Backslashes
console.log('\nStep 4: Inspecting Central Directory in ZIP...');
const zipBuf = fs.readFileSync(releaseZipPath);
let cdSearch = 0;
let hasBackslash = false;
let foundEntries = 0;

for (let i = 0; i < zipBuf.length - 4; i++) {
  if (zipBuf.readUInt32LE(i) === 0x02014b50) {
    foundEntries++;
    const nameLen = zipBuf.readUInt16LE(i + 28);
    const name = zipBuf.toString('utf8', i + 46, i + 46 + nameLen);
    if (name.includes('\\')) {
      hasBackslash = true;
      console.error(`  [FAIL] Backslash found in entry: ${name}`);
    }
  }
}

if (hasBackslash) {
  throw new Error('CRITICAL: Release ZIP contains Windows backslashes! Packaging aborted.');
}
console.log(`  ✔ Verified ${foundEntries} entries in ZIP. Zero Windows backslashes found (100% POSIX compliant).`);

// Step 5: Compute SHA-256 Checksum
console.log('\nStep 5: Computing SHA-256 Checksum...');
const hash = crypto.createHash('sha256').update(zipBuf).digest('hex');
const checksumFileName = `${releaseFileName}.sha256`;
const checksumPath = path.join(releaseDir, checksumFileName);
fs.writeFileSync(checksumPath, `${hash}  ${releaseFileName}\n`, 'utf8');

const zipSizeKb = (zipBuf.length / 1024).toFixed(2);

console.log('====================================================================');
console.log('RELEASE PACKAGING COMPLETED SUCCESSFULLY!');
console.log(`  Package File:   ${releaseZipPath}`);
console.log(`  File Size:      ${zipSizeKb} KB`);
console.log(`  SHA-256:        ${hash}`);
console.log(`  Checksum File:  ${checksumPath}`);
console.log('====================================================================\n');

// Clean staging directory
try {
  fs.rmSync(stagingDir, { recursive: true, force: true });
} catch (e) {}
