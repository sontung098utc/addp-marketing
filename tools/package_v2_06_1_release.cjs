/**
 * ====================================================================
 * SPRINT V2-06.1: MIGRATION SAFETY & AGGREGATE QUEUE INTEGRITY HOTFIX
 * RELEASE PACKAGER
 * 
 * Enforces:
 * 1. Execution of V2-06.1 test suite (18/18 PASS)
 * 2. Execution of V2-06 DB-first reporting suite (22/22 PASS)
 * 3. Execution of V2-05.2.3 historical RMA sync suite (22/22 PASS)
 * 4. Execution of V2-05.2.2 trust status & priority UX suite (17/17 PASS)
 * 5. Execution of V2-05.2.1 hotfix reconciliation suite (24/24 PASS)
 * 6. Execution of V2-05.2 recipient capture suite (18/18 PASS)
 * 7. Execution of V2-05.1.2 customer sync contract suite (13/13 PASS)
 * 8. Execution of V2-05.1 HMAC fail-closed suite (12/12 PASS)
 * 9. Execution of V2-05 Customer 360 privacy suite (9/9 PASS)
 * 10. Backend PHP Syntax Lint (php -l across all public/api files)
 * 11. Production frontend Vite build (npm run build)
 * 12. Pure POSIX ZIP packaging (zero Windows backslashes)
 * 13. SHA-256 cryptographic checksum calculation
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-06.1 RELEASE PACKAGING');
console.log('====================================================================\n');

// 1. Run all test suites
console.log('Step 1A: Running Sprint V2-06.1 Migration Safety & Queue Integrity test suite...');
execSync('node tools/test_v2_06_1_queue_and_migration_integrity.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1B: Running Sprint V2-06 DB-First Reporting test suite...');
execSync('node tools/test_v2_06_db_first_reporting.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1C: Running Sprint V2-05.2.3 Historical RMA Sync test suite...');
execSync('node tools/test_v2_05_2_3_historical_rma_sync.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1D: Running Sprint V2-05.2.2 Trust Status & Priority UX test suite...');
execSync('node tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1E: Running Sprint V2-05.2.1 Hotfix Reconciliation test suite...');
execSync('node tools/test_v2_05_2_1_hotfix_reconciliation.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1F: Running Sprint V2-05.2 Recipient Capture test suite...');
execSync('node tools/test_v2_05_2_recipient_capture.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1G: Running Sprint V2-05.1.2 Customer Sync Contract test suite...');
execSync('node tools/test_v2_05_1_2_customer_sync_contract.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1H: Running Sprint V2-05.1 HMAC Fail-Closed Security test suite...');
execSync('node tools/test_v2_05_1_hmac_secret_fail_closed.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1I: Running Sprint V2-05 Customer Ingestion & Privacy test suite...');
execSync('node tools/test_v2_05_customer_ingestion_and_privacy.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Lint backend PHP files
console.log('\nStep 1J: Linting backend PHP syntax (tools/lint_php.cjs)...');
execSync('node tools/lint_php.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Build production frontend bundle
console.log('\nStep 1K: Refreshing production frontend build (npm run build)...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 4. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_06_1_migration_safety_and_queue_integrity_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v206_1_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 5. Staging Release Manifest
const manifestMap = [
  // Database Migrations & Rollbacks
  ['database/migrations/20261007_019_create_commerce_daily_aggregates_and_indexes.sql', 'database/migrations/20261007_019_create_commerce_daily_aggregates_and_indexes.sql'],
  ['database/migrations/20261007_019_rollback_create_commerce_daily_aggregates_and_indexes.sql', 'database/migrations/20261007_019_rollback_create_commerce_daily_aggregates_and_indexes.sql'],

  // Backend API Services
  ['public/api/commerce_daily_aggregate_service.php', 'public/api/commerce_daily_aggregate_service.php'],
  ['public/api/commerce_analytics_service.php', 'public/api/commerce_analytics_service.php'],
  ['public/api/commerce_aftersales_service.php', 'public/api/commerce_aftersales_service.php'],
  ['public/api/commerce_sync_orchestrator.php', 'public/api/commerce_sync_orchestrator.php'],
  ['public/api/commerce_dashboard.php', 'public/api/commerce_dashboard.php'],
  ['public/api/commerce_customer_service.php', 'public/api/commerce_customer_service.php'],
  ['public/api/commerce_sync_service.php', 'public/api/commerce_sync_service.php'],
  ['public/api/tiktok_client.php', 'public/api/tiktok_client.php'],
  ['public/api/commerce_finance_service.php', 'public/api/commerce_finance_service.php'],
  ['public/api/commerce_loss_engine.php', 'public/api/commerce_loss_engine.php'],

  // Frontend Source & Production Artifacts
  ['dist/index.html', 'dist/index.html'],
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],

  // Test Verification Tools & Helpers
  ['tools/test_v2_06_1_queue_and_migration_integrity.cjs', 'tools/test_v2_06_1_queue_and_migration_integrity.cjs'],
  ['tools/test_v2_06_db_first_reporting.cjs', 'tools/test_v2_06_db_first_reporting.cjs'],
  ['tools/test_v2_05_2_3_historical_rma_sync.cjs', 'tools/test_v2_05_2_3_historical_rma_sync.cjs'],
  ['tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs', 'tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs'],
  ['tools/test_v2_05_2_1_hotfix_reconciliation.cjs', 'tools/test_v2_05_2_1_hotfix_reconciliation.cjs'],
  ['tools/test_v2_05_2_recipient_capture.cjs', 'tools/test_v2_05_2_recipient_capture.cjs'],
  ['tools/test_v2_05_1_2_customer_sync_contract.cjs', 'tools/test_v2_05_1_2_customer_sync_contract.cjs'],
  ['tools/test_v2_05_1_hmac_secret_fail_closed.cjs', 'tools/test_v2_05_1_hmac_secret_fail_closed.cjs'],
  ['tools/test_v2_05_customer_ingestion_and_privacy.cjs', 'tools/test_v2_05_customer_ingestion_and_privacy.cjs'],
  ['tools/lint_php.cjs', 'tools/lint_php.cjs'],
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

// Generate Deployment Notes & Production Runbook
const deploymentNotes = `ADDP COMMERCE INTELLIGENCE - RELEASE V2-06.1
Task: Migration Safety & Aggregate Queue Integrity Hotfix
Timestamp: ${now.toISOString()}
Release Package: ${releaseFileName}

Summary of Production Hotfixes:
1. Data Trust Defaults & Truthful Reporting:
   - Changed unverified Orders, RMA, Ads, and Finance freshness column defaults from AVAILABLE to NOT_SYNCED.
   - Aggregate engine only marks AVAILABLE after verifiable completed sync run covering the metric date.
   - Zero orders without confirmed sync coverage are presented strictly as NOT_SYNCED ("Chưa đồng bộ dữ liệu đơn hàng"), never falsely converted to verified 0.

2. Rebuild Queue Natural Grain & Concurrency Safety:
   - Redesigned unique constraint on commerce_daily_aggregate_queue to (platform, shop_id, metric_date).
   - Natural grain strictly enforces 1 row per platform/shop/metric_date.
   - Concurrency-safe atomic claim via test-and-set UPDATE ... SET status = 'PROCESSING', worker_id = :worker_id WHERE id = :id AND status = 'PENDING'.
   - Lost update prevention: When late RMA or order arrives while worker is PROCESSING, dirty_while_processing is set to 1. Worker detects dirty flag upon completion and resets job to PENDING for immediate re-execution.
   - Exponential retry policy: Transient errors increment retry_count up to max_retries (3), transitioning to FAILED only upon limit exhaustion. Re-enqueueing a FAILED item resets status to PENDING and clears errors.
   - Automatic stuck job recovery: Jobs stuck in PROCESSING (> 300s) are automatically reset to PENDING.

3. Migration 019 & Rollback 019 Hardening:
   - Zero global FOREIGN_KEY_CHECKS alteration in both migration and rollback.
   - Documented online DDL requirements (ALGORITHM=INPLACE, LOCK=NONE) and lock-wait timeout safety.
   - Safe table rollback: Checks COUNT(*). If aggregate or queue tables contain rows, safely renames them to *_archived instead of destructively dropping.
   - Index signature verification: Validates COLUMN_NAME in information_schema.STATISTICS before dropping secondary indexes.

4. Aggregate Range Completeness & Safe Fallback:
   - CommerceAnalyticsService::getDashboardReport validates isRangeFullyAggregated($shopId, $startDate, $endDate).
   - If range has missing dates, aggregate_readiness is marked PARTIAL and report safely falls back to normalized computation (report_source = 'NORMALIZED_FALLBACK').
   - Fully aggregated ranges are served directly (report_source = 'DAILY_AGGREGATES', aggregate_readiness = 'COMPLETE').
   - Valid daily aggregates remain untouched and preserved during background sync failures.

5. Regression Baseline Preservation:
   - 155/155 tests passing across all 9 regression suites (100% PASS).
   - V2-05.2.3 Historical RMA create_time intervals and exclusive upper bounds preserved.
   - Customer 360 privacy and zero secret leakage preserved.

Production Migration & Deployment Runbook:
1. Pre-Deployment Backup:
   tar -czf backup_pre_v206_1_$(date +%Y%m%d_%H%M%S).tar.gz \\
     public/api/commerce_daily_aggregate_service.php \\
     public/api/commerce_analytics_service.php \\
     public/api/commerce_aftersales_service.php \\
     public/api/commerce_sync_orchestrator.php \\
     public/api/commerce_customer_service.php \\
     public/api/commerce_dashboard.php \\
     database/migrations/ \\
     dist/

2. Execute Migration 019 (Low-traffic window recommended):
   mysql -u root -p addp_commerce < database/migrations/20261007_019_create_commerce_daily_aggregates_and_indexes.sql

3. Deploy Application Files:
   unzip -o ${releaseFileName}

4. Run Verification Suite on Server:
   node tools/test_v2_06_1_queue_and_migration_integrity.cjs
   node tools/test_v2_06_db_first_reporting.cjs
   node tools/test_v2_05_2_3_historical_rma_sync.cjs

5. Initial Aggregate Bootstrap (Optional, for historical range):
   php public/api/commerce_sync.php --shop=7495657895504611503 --action=bootstrap_daily_aggregates --start=2026-09-01 --end=2026-10-07
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
