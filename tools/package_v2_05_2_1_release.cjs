/**
 * ====================================================================
 * SPRINT V2-05.2.1: RECIPIENT CAPTURE & CUSTOMER 360 HOTFIX RECONCILIATION
 * RELEASE PACKAGER
 * 
 * Enforces:
 * 1. Execution of V2-05.2.1 test suite (24/24 PASS)
 * 2. Execution of V2-05.2 test suite (18/18 PASS)
 * 3. Execution of V2-05.1.2 frontend sync contract suite (13/13 PASS)
 * 4. Execution of V2-05.1 HMAC fail-closed suite (12/12 PASS)
 * 5. Execution of V2-05 Customer 360 privacy suite (9/9 PASS)
 * 6. Production frontend Vite build (npm run build)
 * 7. Pure POSIX ZIP packaging (zero Windows backslashes)
 * 8. SHA-256 cryptographic checksum calculation
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-05.2.1 RELEASE PACKAGING');
console.log('====================================================================\n');

// 1. Run all test suites
console.log('Step 1A: Running Sprint V2-05.2.1 Hotfix Reconciliation test suite...');
execSync('node tools/test_v2_05_2_1_hotfix_reconciliation.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1B: Running Sprint V2-05.2 Recipient Capture test suite...');
execSync('node tools/test_v2_05_2_recipient_capture.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1C: Running Sprint V2-05.1.2 Customer Sync Contract test suite...');
execSync('node tools/test_v2_05_1_2_customer_sync_contract.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1D: Running Sprint V2-05.1 HMAC Fail-Closed Security test suite...');
execSync('node tools/test_v2_05_1_hmac_secret_fail_closed.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1E: Running Sprint V2-05 Customer Ingestion & Privacy test suite...');
execSync('node tools/test_v2_05_customer_ingestion_and_privacy.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Build production frontend bundle
console.log('\nStep 1F: Refreshing production frontend build (npm run build)...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_05_2_1_recipient_capture_reconciliation_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v205_2_1_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 4. Staging Release Manifest
const manifestMap = [
  // Backend API Services
  ['public/api/tiktok_client.php', 'public/api/tiktok_client.php'],
  ['public/api/commerce_sync_service.php', 'public/api/commerce_sync_service.php'],
  ['public/api/commerce_customer_service.php', 'public/api/commerce_customer_service.php'],
  ['public/api/commerce_aftersales_service.php', 'public/api/commerce_aftersales_service.php'],
  ['public/api/commerce_analytics_service.php', 'public/api/commerce_analytics_service.php'],
  ['public/api/commerce_finance_service.php', 'public/api/commerce_finance_service.php'],

  // Frontend Source & Production Artifacts
  ['dist/index.html', 'dist/index.html'],
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],

  // Test Verification Tools & Mock Helper
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
const deploymentNotes = `ADDP COMMERCE INTELLIGENCE - RELEASE V2-05.2.1
Task: Recipient Capture & Customer 360 Production Hotfix Reconciliation
Timestamp: ${now.toISOString()}
Release Package: ${releaseFileName}

Summary of Reconciled Production Hotfixes:
1. TikTok Get Order Detail:
   - Official endpoint: GET /order/202309/orders?shop_cipher=...&ids=id1,id2,...
   - Method: TikTokShopClient::getOrderDetailsV2($accessToken, $shopCipher, $orderIds)
   - Bounded to max 50 IDs per request.
   - searchOrdersV2 and /orders/{id} template bypass eliminated.

2. Dynamic Shop Cipher Resolution:
   - TikTokShopClient::resolveShopCipher($shopId, $accessToken) matches exact shop_id.
   - Single-shop fallback only when API returns exactly 1 shop.
   - Multi-shop mismatch fails closed (SHOP_CIPHER_NOT_FOUND).
   - Removed all deprecated queries to tiktok_config.shop_cipher across all services.

3. syncOrdersByIds Run Lifecycle & Lineage:
   - Creates commerce_sync_runs session (sync_type='RECIPIENT_RECOVERY', api_endpoint='/order/202309/orders').
   - Assigns sync_run_id into commerce_raw_observations (satisfies NOT NULL constraint) and commerce_orders.
   - Omitted currency column from commerce_order_items (schema fix).
   - Ingests raw in-memory order into CommerceCustomerService::ingestOrderRecipient.
   - Finalizes sync run to COMPLETED or PARTIAL (or FAILED with rollback upon error; never left RUNNING).

4. Field-Level PII Encryption & Best-Known-Value Preservation:
   - Evaluates recipient name, phone, and address independently.
   - Masked phone no longer prevents unmasked recipient name or address encryption.
   - Never overwrites unmasked encrypted data with masked, empty, or null values.

5. Priority Selector Optimization:
   - Query: (r.id IS NULL OR r.identity_method IS NULL OR r.identity_method = 'UNMATCHED') AND o.order_status IN ('AWAITING_SHIPMENT', 'IN_TRANSIT').
   - Removed r.is_masked_by_platform = 1 to prevent infinite re-selection of USER_ID matched orders.

6. Customer 360 KPI Semantics:
   - Excludes UNMATCHED identities from total_customers, new_customers, returning_customers, and repeat_rate.
   - Returns actual database count of commerce_customer_profiles in rebuildCustomerProfiles().
   - Presents total_orders, verified_orders_count, unmatched_orders_count, and identity_coverage_pct.

Deployment Runbook:
1. Backup existing production files:
   tar -czf backup_pre_v205_2_1_\$(date +%Y%m%d_%H%M%S).tar.gz \\
     public/api/tiktok_client.php \\
     public/api/commerce_sync_service.php \\
     public/api/commerce_customer_service.php \\
     public/api/commerce_aftersales_service.php \\
     public/api/commerce_analytics_service.php \\
     public/api/commerce_finance_service.php \\
     dist/
2. Extract release package to production document root:
   unzip -o ${releaseFileName}
3. Run automated regression test suites to verify integrity:
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

    const crc = crc32(dataBuf);

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
    cdHeader.writeUInt16LE(0, 10);             // compression (0 = store)
    cdHeader.writeUInt16LE(dosTime, 12);
    cdHeader.writeUInt16LE(dosDate, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(compressedSize, 20);
    cdHeader.writeUInt32LE(uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);             // extra length
    cdHeader.writeUInt16LE(0, 32);             // comment length
    cdHeader.writeUInt16LE(0, 34);             // disk number start
    cdHeader.writeUInt16LE(0, 36);             // internal attributes
    cdHeader.writeUInt32LE(0, 38);             // external attributes
    cdHeader.writeUInt32LE(offset, 42);        // relative offset of local header
    nameBuf.copy(cdHeader, 46);

    centralDirHeaders.push(cdHeader);
    offset += localHeader.length + dataBuf.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const h of centralDirHeaders) {
    cdSize += h.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);          // signature
  eocd.writeUInt16LE(0, 4);                   // disk number
  eocd.writeUInt16LE(0, 6);                   // disk with start of central directory
  eocd.writeUInt16LE(entries.length, 8);      // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);     // total entries
  eocd.writeUInt32LE(cdSize, 12);             // central directory size
  eocd.writeUInt32LE(cdOffset, 16);           // offset of start of central directory
  eocd.writeUInt16LE(0, 20);                  // zip comment length

  const allBuffers = [...localFileHeaders, ...centralDirHeaders, eocd];
  const finalZipBuffer = Buffer.concat(allBuffers);
  fs.writeFileSync(zipFilePath, finalZipBuffer);
}

// CRC-32 Lookup Table
const crcTable = (function() {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

createPosixZip(stagingDir, releaseZipPath);

// Step 4: Verification of Pure POSIX Paths
console.log('\nStep 4: Verifying ZIP internal path separators (must be 100% POSIX forward slashes)...');
const zipBuffer = fs.readFileSync(releaseZipPath);
let zipOffset = 0;
let fileCount = 0;
let hasBackslash = false;

while (zipOffset < zipBuffer.length - 4) {
  const sig = zipBuffer.readUInt32LE(zipOffset);
  if (sig === 0x02014b50) { // Central directory header
    const nameLen = zipBuffer.readUInt16LE(zipOffset + 28);
    const extraLen = zipBuffer.readUInt16LE(zipOffset + 30);
    const commentLen = zipBuffer.readUInt16LE(zipOffset + 32);
    const fileName = zipBuffer.toString('utf8', zipOffset + 46, zipOffset + 46 + nameLen);
    
    if (fileName.includes('\\')) {
      hasBackslash = true;
      console.error(`  [ERROR] Windows backslash detected in: ${fileName}`);
    } else {
      console.log(`  [OK] ${fileName}`);
    }
    fileCount++;
    zipOffset += 46 + nameLen + extraLen + commentLen;
  } else if (sig === 0x04034b50) { // Local file header
    const nameLen = zipBuffer.readUInt16LE(zipOffset + 26);
    const extraLen = zipBuffer.readUInt16LE(zipOffset + 28);
    const compSize = zipBuffer.readUInt32LE(zipOffset + 18);
    zipOffset += 30 + nameLen + extraLen + compSize;
  } else {
    zipOffset++;
  }
}

if (hasBackslash) {
  throw new Error('FATAL: Archive contains non-POSIX path separators!');
}

// Step 5: Cryptographic SHA-256 Checksum Calculation
console.log('\nStep 5: Calculating SHA-256 Checksum...');
const sha256Hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
const stat = fs.statSync(releaseZipPath);

// Clean up staging directory
fs.rmSync(stagingDir, { recursive: true, force: true });

console.log('\n====================================================================');
console.log('  SPRINT V2-05.2.1 RELEASE PACKAGE SUCCESSFULLY GENERATED');
console.log('====================================================================');
console.log(`  Package File:   ${releaseFileName}`);
console.log(`  Full Path:      ${releaseZipPath}`);
console.log(`  File Size:      ${(stat.size / 1024).toFixed(2)} KB (${stat.size} bytes)`);
console.log(`  Internal Files: ${fileCount} files`);
console.log(`  Path Standards: Pure POSIX Forward Slashes (100% Verified)`);
console.log(`  SHA-256:        ${sha256Hash}`);
console.log('====================================================================\n');
