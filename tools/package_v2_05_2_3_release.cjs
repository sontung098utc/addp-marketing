/**
 * ====================================================================
 * SPRINT V2-05.2.3: HISTORICAL RMA PERIOD SYNC & COVERAGE INTEGRITY FIX
 * RELEASE PACKAGER
 * 
 * Enforces:
 * 1. Execution of V2-05.2.3 test suite (22/22 PASS)
 * 2. Execution of V2-05.2.2 trust status & priority UX suite (17/17 PASS)
 * 3. Execution of V2-05.2.1 hotfix reconciliation suite (24/24 PASS)
 * 4. Execution of V2-05.2 recipient capture suite (18/18 PASS)
 * 5. Execution of V2-05.1.2 frontend sync contract suite (13/13 PASS)
 * 6. Execution of V2-05.1 HMAC fail-closed suite (12/12 PASS)
 * 7. Execution of V2-05 Customer 360 privacy suite (9/9 PASS)
 * 8. Production frontend Vite build (npm run build)
 * 9. Pure POSIX ZIP packaging (zero Windows backslashes)
 * 10. SHA-256 cryptographic checksum calculation
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-05.2.3 RELEASE PACKAGING');
console.log('====================================================================\n');

// 1. Run all test suites
console.log('Step 1A: Running Sprint V2-05.2.3 Historical RMA Sync test suite...');
execSync('node tools/test_v2_05_2_3_historical_rma_sync.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1B: Running Sprint V2-05.2.2 Trust Status & Priority UX test suite...');
execSync('node tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1C: Running Sprint V2-05.2.1 Hotfix Reconciliation test suite...');
execSync('node tools/test_v2_05_2_1_hotfix_reconciliation.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1D: Running Sprint V2-05.2 Recipient Capture test suite...');
execSync('node tools/test_v2_05_2_recipient_capture.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1E: Running Sprint V2-05.1.2 Customer Sync Contract test suite...');
execSync('node tools/test_v2_05_1_2_customer_sync_contract.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1F: Running Sprint V2-05.1 HMAC Fail-Closed Security test suite...');
execSync('node tools/test_v2_05_1_hmac_secret_fail_closed.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1G: Running Sprint V2-05 Customer Ingestion & Privacy test suite...');
execSync('node tools/test_v2_05_customer_ingestion_and_privacy.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Build production frontend bundle
console.log('\nStep 1H: Refreshing production frontend build (npm run build)...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_05_2_3_historical_rma_period_sync_and_coverage_integrity_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v205_2_3_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 4. Staging Release Manifest
const manifestMap = [
  // Backend API Services
  ['public/api/commerce_aftersales_service.php', 'public/api/commerce_aftersales_service.php'],
  ['public/api/commerce_sync_orchestrator.php', 'public/api/commerce_sync_orchestrator.php'],
  ['public/api/commerce_analytics_service.php', 'public/api/commerce_analytics_service.php'],
  ['public/api/commerce_dashboard.php', 'public/api/commerce_dashboard.php'],
  ['public/api/commerce_customer_service.php', 'public/api/commerce_customer_service.php'],
  ['public/api/commerce_sync_service.php', 'public/api/commerce_sync_service.php'],
  ['public/api/tiktok_client.php', 'public/api/tiktok_client.php'],
  ['public/api/commerce_finance_service.php', 'public/api/commerce_finance_service.php'],
  ['public/api/commerce_loss_engine.php', 'public/api/commerce_loss_engine.php'],

  // Frontend Source & Production Artifacts
  ['dist/index.html', 'dist/index.html'],
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],

  // Test Verification Tools & Mock Helper
  ['tools/test_v2_05_2_3_historical_rma_sync.cjs', 'tools/test_v2_05_2_3_historical_rma_sync.cjs'],
  ['tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs', 'tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs'],
  ['tools/test_v2_05_2_1_hotfix_reconciliation.cjs', 'tools/test_v2_05_2_1_hotfix_reconciliation.cjs'],
  ['tools/test_v2_05_2_recipient_capture.cjs', 'tools/test_v2_05_2_recipient_capture.cjs'],
  ['tools/test_v2_05_1_2_customer_sync_contract.cjs', 'tools/test_v2_05_1_2_customer_sync_contract.cjs'],
  ['tools/test_v2_05_1_hmac_secret_fail_closed.cjs', 'tools/test_v2_05_1_hmac_secret_fail_closed.cjs'],
  ['tools/test_v2_05_customer_ingestion_and_privacy.cjs', 'tools/test_v2_05_customer_ingestion_and_privacy.cjs'],
  ['tools/mock_pdo_helper.php', 'tools/mock_pdo_helper.php']
];

// Add dist/assets files
const distAssetsDir = path.join(__dirname, '../dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const assetFiles = fs.readdirSync(distAssetsDir);
  for (const af of assetFiles) {
    manifestMap.push([`dist/assets/${af}`, `dist/assets/${af}`]);
  }
}

console.log('\nStep 2: Staging release files into staging directory...');
for (const [srcRel, destRel] of manifestMap) {
  const srcFull = path.join(__dirname, '..', srcRel);
  if (!fs.existsSync(srcFull)) {
    throw new Error(`CRITICAL: Staging source file missing: ${srcFull}`);
  }
  const destFull = path.join(stagingDir, destRel);
  const destDirPath = path.dirname(destFull);
  if (!fs.existsSync(destDirPath)) fs.mkdirSync(destDirPath, { recursive: true });
  fs.copyFileSync(srcFull, destFull);
}

// Generate Deployment Notes & Runbook
const deploymentNotes = `ADDP COMMERCE INTELLIGENCE - RELEASE V2-05.2.3
Task: Historical RMA Period Sync & Coverage Integrity Fix
Timestamp: ${now.toISOString()}
Release Package: ${releaseFileName}

Summary of Production Fixes:
1. Strict Sync Mode Separation in CommerceSyncOrchestrator::syncRmaDomain:
   - Mode A (Historical / Requested Period): When explicit start_date is provided and no rolling refresh is requested, dispatches CommerceAftersalesService::initialBackfillRma() with create_time_ge and create_time_lt. Records sync_type = 'HISTORICAL_BACKFILL'.
   - Mode B (Incremental / Rolling): Only when start_date is empty or rolling_refresh is requested, dispatches incrementalSyncRma() with update_time watermark. Records sync_type = 'INCREMENTAL_DELTA'.
   - Eliminated bug where January sync run executed incremental sync and ingested September/October records.

2. Deterministic Period Boundaries (resolvePeriodTimestamps):
   - Canonical start 00:00:00 to day-after-end 00:00:00 (exclusive).
   - E.g. 2026-01-01 -> 2026-01-31 resolves to create_time_ge = 2026-01-01 00:00:00 and create_time_lt = 2026-02-01 00:00:00.

3. Fail-Closed Period Range Validation (RMA_PERIOD_MISMATCH):
   - In historical backfill, inspects each returned reverse order create_time.
   - If create_time is outside requested [start, endExclusive) window:
     - Increments out_of_range_count
     - Discards out-of-range record
     - Flags error_code = 'RMA_PERIOD_MISMATCH'
     - Finalizes sync run with status PARTIAL or FAILED and safe diagnostic details.

4. Canonical Endpoints & Accurate Audit Metadata:
   - All RMA paths use canonical constant TIKTOK_API_RMA_SEARCH_ENDPOINT (/return_refund/202602/returns/search).
   - Stale /return_refund/202309/reverse_orders/search endpoint completely removed.
   - Accurate records_read (total objects inspected) and records_written (valid rows upserted).
   - Historical run completed sets latest_available_date = runEndDate (never fabricates today's date).

5. Truthful RMA Period Coverage & UI Status Filter:
   - CommerceAftersalesService::getRmaPeriodCoverage($shopId, $startDate, $endDate) inspects commerce_sync_runs.
   - Returns AVAILABLE, PARTIAL, NOT_SYNCED, or ERROR with Vietnamese diagnostic message.
   - commerce_dashboard.php orders action sets status_counts['RETURN_REFUND'] = null when coverage is unverified.
   - Orders status dropdown renders "Trả hàng / Hoàn tiền (Chưa đối soát)" instead of misleading "(0)".
   - When verified and count is 0, renders "(0)".

6. Order Cohort Semantics Preserved:
   - Orders filter strictly by commerce_orders.platform_created_at.
   - Orders created in January with February RMAs remain in January cohort.

7. Zero Regression Invariant:
   - All 93 prior tests + 22 new tests (115 total) verified PASS 100%.

Deployment Runbook:
1. Backup existing production files:
   tar -czf backup_pre_v205_2_3_$(date +%Y%m%d_%H%M%S).tar.gz \\
     public/api/commerce_aftersales_service.php \\
     public/api/commerce_sync_orchestrator.php \\
     public/api/commerce_analytics_service.php \\
     public/api/commerce_dashboard.php \\
     src/CommerceDashboardView.jsx \\
     dist/
2. Extract release package to production document root:
   unzip -o ${releaseFileName}
3. Run automated regression test suites to verify integrity:
   node tools/test_v2_05_2_3_historical_rma_sync.cjs
   node tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs
   node tools/test_v2_05_2_1_hotfix_reconciliation.cjs
   node tools/test_v2_05_2_recipient_capture.cjs
   node tools/test_v2_05_1_2_customer_sync_contract.cjs
   node tools/test_v2_05_1_hmac_secret_fail_closed.cjs
   node tools/test_v2_05_customer_ingestion_and_privacy.cjs
4. Operator Month-by-Month Recovery Runbook:
   To backfill historical RMAs month by month:
   - January 2026:
     php public/api/commerce_sync.php --shop=7495657895504611503 --domain=RMA --start=2026-01-01 --end=2026-01-31
   - February 2026:
     php public/api/commerce_sync.php --shop=7495657895504611503 --domain=RMA --start=2026-02-01 --end=2026-02-28
   - March 2026 to September 2026 sequentially.
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

    let crc = 0xFFFFFFFF;
    for (let i = 0; i < dataBuf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ dataBuf[i]) & 0xFF];
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;

    const mtime = entry.mtime;
    const dosTime = ((mtime.getHours() << 11) | (mtime.getMinutes() << 5) | (mtime.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((mtime.getFullYear() - 1980) << 9) | ((mtime.getMonth() + 1) << 5) | mtime.getDate()) & 0xFFFF;

    // Local file header (30 bytes + nameBuf.length)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // flags (UTF-8)
    localHeader.writeUInt16LE(0, 8);          // compression (0 = store)
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // extra length
    nameBuf.copy(localHeader, 30);

    localFileHeaders.push(localHeader);
    localFileHeaders.push(dataBuf);

    // Central directory header (46 bytes + nameBuf.length)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4);          // version made by
    centralHeader.writeUInt16LE(20, 6);          // version needed
    centralHeader.writeUInt16LE(0x0800, 8);      // flags (UTF-8)
    centralHeader.writeUInt16LE(0, 10);          // compression (0 = store)
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);          // extra length
    centralHeader.writeUInt16LE(0, 32);          // comment length
    centralHeader.writeUInt16LE(0, 34);          // disk start
    centralHeader.writeUInt16LE(0, 36);          // internal attributes
    centralHeader.writeUInt32LE(0x81A40000, 38); // external attributes (regular file, rw-r--r--)
    centralHeader.writeUInt32LE(offset, 42);     // relative offset
    nameBuf.copy(centralHeader, 46);

    centralDirHeaders.push(centralHeader);
    offset += localHeader.length + dataBuf.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralDirHeaders) {
    centralDirSize += ch.length;
  }

  // End of Central Directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);                 // signature
  eocd.writeUInt16LE(0, 4);                          // disk number
  eocd.writeUInt16LE(0, 6);                          // disk start
  eocd.writeUInt16LE(entries.length, 8);             // num entries disk
  eocd.writeUInt16LE(entries.length, 10);            // num entries total
  eocd.writeUInt32LE(centralDirSize, 12);            // central dir size
  eocd.writeUInt32LE(centralDirOffset, 16);          // central dir offset
  eocd.writeUInt16LE(0, 20);                         // comment length

  const finalZipBuffer = Buffer.concat([
    ...localFileHeaders,
    ...centralDirHeaders,
    eocd
  ]);

  fs.writeFileSync(zipFilePath, finalZipBuffer);
}

// CRC32 table generator
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[n] = c;
}

createPosixZip(stagingDir, releaseZipPath);

// Step 4: Validate POSIX paths inside generated ZIP
console.log('\nStep 4: Validating POSIX entry path format inside generated ZIP...');
const zipBuffer = fs.readFileSync(releaseZipPath);
let zipPos = 0;
let fileCount = 0;
while (zipPos < zipBuffer.length - 4) {
  const sig = zipBuffer.readUInt32LE(zipPos);
  if (sig === 0x04034b50) {
    const nameLen = zipBuffer.readUInt16LE(zipPos + 26);
    const extraLen = zipBuffer.readUInt16LE(zipPos + 28);
    const compSize = zipBuffer.readUInt32LE(zipPos + 18);
    const entryName = zipBuffer.toString('utf8', zipPos + 30, zipPos + 30 + nameLen);
    if (entryName.includes('\\')) {
      throw new Error(`CRITICAL: Windows backslash detected in ZIP entry: ${entryName}`);
    }
    fileCount++;
    zipPos += 30 + nameLen + extraLen + compSize;
  } else if (sig === 0x02014b50) {
    const nameLen = zipBuffer.readUInt16LE(zipPos + 28);
    const extraLen = zipBuffer.readUInt16LE(zipPos + 30);
    const commLen = zipBuffer.readUInt16LE(zipPos + 32);
    const entryName = zipBuffer.toString('utf8', zipPos + 46, zipPos + 46 + nameLen);
    if (entryName.includes('\\')) {
      throw new Error(`CRITICAL: Windows backslash detected in central dir entry: ${entryName}`);
    }
    zipPos += 46 + nameLen + extraLen + commLen;
  } else {
    break;
  }
}
console.log(`Validated ${fileCount} entries in ZIP archive. All paths conform strictly to pure POSIX standards.`);

// Step 5: Compute SHA-256 Checksum
console.log('\nStep 5: Computing SHA-256 checksum...');
const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
fs.writeFileSync(`${releaseZipPath}.sha256`, `${sha256}  ${releaseFileName}\n`, 'utf8');

// Cleanup staging directory
fs.rmSync(stagingDir, { recursive: true, force: true });

console.log('\n====================================================================');
console.log('RELEASE PACKAGE COMPLETED SUCCESSFULLY!');
console.log(`Release Archive:  ${releaseZipPath}`);
console.log(`Archive Size:     ${(zipBuffer.length / 1024).toFixed(2)} KB`);
console.log(`Total Files:      ${fileCount}`);
console.log(`SHA-256 Checksum: ${sha256}`);
console.log('====================================================================\n');
