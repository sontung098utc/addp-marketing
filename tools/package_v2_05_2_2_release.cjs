/**
 * ====================================================================
 * SPRINT V2-05.2.2: CUSTOMER 360 TRUST STATUS & PRIORITY RECOVERY UX FIX
 * RELEASE PACKAGER
 * 
 * Enforces:
 * 1. Execution of V2-05.2.2 test suite (17/17 PASS)
 * 2. Execution of V2-05.2.1 test suite (24/24 PASS)
 * 3. Execution of V2-05.2 test suite (18/18 PASS)
 * 4. Execution of V2-05.1.2 frontend sync contract suite (13/13 PASS)
 * 5. Execution of V2-05.1 HMAC fail-closed suite (12/12 PASS)
 * 6. Execution of V2-05 Customer 360 privacy suite (9/9 PASS)
 * 7. Production frontend Vite build (npm run build)
 * 8. Pure POSIX ZIP packaging (zero Windows backslashes)
 * 9. SHA-256 cryptographic checksum calculation
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-05.2.2 RELEASE PACKAGING');
console.log('====================================================================\n');

// 1. Run all test suites
console.log('Step 1A: Running Sprint V2-05.2.2 Trust Status & Priority UX test suite...');
execSync('node tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1B: Running Sprint V2-05.2.1 Hotfix Reconciliation test suite...');
execSync('node tools/test_v2_05_2_1_hotfix_reconciliation.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1C: Running Sprint V2-05.2 Recipient Capture test suite...');
execSync('node tools/test_v2_05_2_recipient_capture.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1D: Running Sprint V2-05.1.2 Customer Sync Contract test suite...');
execSync('node tools/test_v2_05_1_2_customer_sync_contract.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1E: Running Sprint V2-05.1 HMAC Fail-Closed Security test suite...');
execSync('node tools/test_v2_05_1_hmac_secret_fail_closed.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1F: Running Sprint V2-05 Customer Ingestion & Privacy test suite...');
execSync('node tools/test_v2_05_customer_ingestion_and_privacy.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Build production frontend bundle
console.log('\nStep 1G: Refreshing production frontend build (npm run build)...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_05_2_2_trust_status_and_priority_ux_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v205_2_2_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 4. Staging Release Manifest
const manifestMap = [
  // Backend API Services
  ['public/api/commerce_customer_service.php', 'public/api/commerce_customer_service.php'],
  ['public/api/commerce_sync_service.php', 'public/api/commerce_sync_service.php'],
  ['public/api/commerce_sync_orchestrator.php', 'public/api/commerce_sync_orchestrator.php'],
  ['public/api/tiktok_client.php', 'public/api/tiktok_client.php'],
  ['public/api/commerce_aftersales_service.php', 'public/api/commerce_aftersales_service.php'],
  ['public/api/commerce_analytics_service.php', 'public/api/commerce_analytics_service.php'],
  ['public/api/commerce_finance_service.php', 'public/api/commerce_finance_service.php'],

  // Frontend Source & Production Artifacts
  ['dist/index.html', 'dist/index.html'],
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],

  // Test Verification Tools & Mock Helper
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
const deploymentNotes = `ADDP COMMERCE INTELLIGENCE - RELEASE V2-05.2.2
Task: Customer 360 Trust Status & Priority Recovery UX Fix
Timestamp: ${now.toISOString()}
Release Package: ${releaseFileName}

Summary of Production Fixes:
1. Fix SQL Table Alias in getCustomerTrustMetrics:
   - Explicitly prefixes $whereOrders with table alias o (o.platform = ?, o.shop_id = ?, o.platform_created_at >= ?, o.platform_created_at <= ?).
   - Aliases commerce_orders as o in total count query.
   - Eliminates ambiguous column errors on MySQL when joined with commerce_order_recipients.

2. Truthful Trust Status Semantics:
   - total_orders == 0 => NO_CUSTOMERS_IN_PERIOD
   - total_orders > 0 && matched_orders == 0 => NO_VERIFIED_IDENTITY_IN_PERIOD
     Exact Vietnamese message: "Chưa có danh tính khách hàng xác thực trong kỳ đã chọn. Các đơn hàng vẫn được ghi nhận, nhưng dữ liệu định danh của kỳ này chưa được thu thập hoặc đã được TikTok bảo vệ/che mờ."
     Eliminated misleading CUSTOMER_DATA_NOT_INGESTED and sync prompts for historical periods where identities are protected.
   - matched_orders > 0 => AVAILABLE with transparent partial coverage messaging (e.g. 164/709 = 23.1%).

3. Dynamic Priority Recovery Count:
   - Eliminated hardcoded "(164 đơn)" from recovery buttons.
   - Authoritative query selector:
     (r.id IS NULL OR r.identity_method IS NULL OR r.identity_method = 'UNMATCHED') AND o.order_status IN ('AWAITING_SHIPMENT', 'IN_TRANSIT')
   - When remaining_priority_count == 0, button is disabled and displays "Không có đơn cần thu thập ưu tiên".

4. Separation of Period KPIs from Lifetime Profiles:
   - Period metrics: Khách hàng xác thực (Kỳ), Khách hàng mới (Kỳ), Khách hàng quay lại (Kỳ), Đơn đã định danh, Đơn chưa định danh, Độ phủ.
   - Lifetime metrics: Tổng hồ sơ khách hàng xác thực trọn đời (168 profiles).
   - Customer profile list filters strictly by verified orders active in selected period.

5. New vs Returning Classification Semantics:
   - New: First verified order (first_order_at) falls within selected period.
   - Returning: Has verified order in selected period AND first verified order prior to period start.
   - Tooltip added: "Phân loại mới/quay lại dựa trên lịch sử danh tính đã xác thực hiện có."
   - Historical UNMATCHED orders never classify a customer as returning.

6. Enhanced Observability:
   - Removed empty catch blocks in getCustomerTrustMetrics.
   - Added logDiagnostic with strict PII/secret redaction.
   - Fails safely with status ERROR on query failure without emitting synthetic zeros.

Deployment Runbook:
1. Backup existing production files:
   tar -czf backup_pre_v205_2_2_\$(date +%Y%m%d_%H%M%S).tar.gz \\
     public/api/commerce_customer_service.php \\
     public/api/commerce_sync_service.php \\
     public/api/commerce_sync_orchestrator.php \\
     src/CommerceDashboardView.jsx \\
     dist/
2. Extract release package to production document root:
   unzip -o ${releaseFileName}
3. Run automated regression test suites to verify integrity:
   node tools/test_v2_05_2_2_trust_status_and_priority_ux.cjs
   node tools/test_v2_05_2_1_hotfix_reconciliation.cjs
   node tools/test_v2_05_2_recipient_capture.cjs
   node tools/test_v2_05_1_2_customer_sync_contract.cjs
   node tools/test_v2_05_1_hmac_secret_fail_closed.cjs
4. Verify Customer 360 UI and priority recipient recovery in browser.
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
