/**
 * ====================================================================
 * SPRINT V2-05.2: TIKTOK RECIPIENT CAPTURE HOTFIX RELEASE PACKAGER
 * 
 * Enforces:
 * 1. Execution of V2-05.2 test suite (18/18 PASS)
 * 2. Execution of V2-05.1.2 frontend sync contract suite (13/13 PASS)
 * 3. Execution of V2-05.1 HMAC fail-closed suite (12/12 PASS)
 * 4. Execution of V2-05 Customer 360 privacy suite (9/9 PASS)
 * 5. Production frontend Vite build
 * 6. Pure POSIX ZIP packaging (zero Windows backslashes)
 * 7. SHA-256 cryptographic checksum calculation
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-05.2 RELEASE PACKAGING');
console.log('====================================================================\n');

// 1. Run all test suites
console.log('Step 1A: Running Sprint V2-05.2 Recipient Capture test suite...');
execSync('node tools/test_v2_05_2_recipient_capture.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1B: Running Sprint V2-05.1.2 Customer Sync Contract test suite...');
execSync('node tools/test_v2_05_1_2_customer_sync_contract.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1C: Running Sprint V2-05.1 HMAC Fail-Closed Security test suite...');
execSync('node tools/test_v2_05_1_hmac_secret_fail_closed.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('\nStep 1D: Running Sprint V2-05 Customer Ingestion & Privacy test suite...');
execSync('node tools/test_v2_05_customer_ingestion_and_privacy.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Build production frontend bundle
console.log('\nStep 1E: Refreshing production frontend build (npm run build)...');
execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 3. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_05_2_recipient_capture_hotfix_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v205_2_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 4. Staging Release Manifest
const manifestMap = [
  // Database Migrations (Sprint V2-05.2 Migration 018 + Migration 017)
  ['database/migrations/20261007_018_add_recipient_encryption_columns.sql', 'database/migrations/20261007_018_add_recipient_encryption_columns.sql'],
  ['database/migrations/20261007_018_rollback_add_recipient_encryption_columns.sql', 'database/migrations/20261007_018_rollback_add_recipient_encryption_columns.sql'],
  ['database/migrations/20261006_017_add_customer_identity_columns.sql', 'database/migrations/20261006_017_add_customer_identity_columns.sql'],
  ['database/migrations/20261006_017_rollback_add_customer_identity_columns.sql', 'database/migrations/20261006_017_rollback_add_customer_identity_columns.sql'],

  // Backend API & Core Engine Services
  ['public/api/config.php', 'public/api/config.php'],
  ['public/api/commerce_customer_service.php', 'public/api/commerce_customer_service.php'],
  ['public/api/commerce_sync_service.php', 'public/api/commerce_sync_service.php'],
  ['public/api/commerce_sync_orchestrator.php', 'public/api/commerce_sync_orchestrator.php'],
  ['public/api/commerce_sync.php', 'public/api/commerce_sync.php'],
  ['public/api/commerce_dashboard.php', 'public/api/commerce_dashboard.php'],
  ['public/api/commerce_reporting_service.php', 'public/api/commerce_reporting_service.php'],
  ['public/api/commerce_loss_engine.php', 'public/api/commerce_loss_engine.php'],
  ['public/api/commerce_finance_service.php', 'public/api/commerce_finance_service.php'],
  ['public/api/commerce_aftersales_service.php', 'public/api/commerce_aftersales_service.php'],
  ['public/api/commerce_analytics_service.php', 'public/api/commerce_analytics_service.php'],

  // Frontend Source & Production Artifacts
  ['dist/index.html', 'dist/index.html'],
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx'],
  ['src/CommerceSyncManagementView.jsx', 'src/CommerceSyncManagementView.jsx'],

  // Test Verification Tools
  ['tools/test_v2_05_2_recipient_capture.cjs', 'tools/test_v2_05_2_recipient_capture.cjs'],
  ['tools/test_v2_05_1_2_customer_sync_contract.cjs', 'tools/test_v2_05_1_2_customer_sync_contract.cjs'],
  ['tools/test_v2_05_1_hmac_secret_fail_closed.cjs', 'tools/test_v2_05_1_hmac_secret_fail_closed.cjs']
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
  fs.mkdirSync(path.dirname(destFull), { recursive: true });
  fs.copyFileSync(srcFull, destFull);
  console.log(`  + Staged: ${destRel}`);
}

// Write Deployment Notes in Staging
const deploymentNotes = `# Sprint V2-05.2: TikTok Recipient Capture Hotfix Release Notes
Release File: ${releaseFileName}
Packaging Timestamp: ${timestamp}

Summary of Changes:
1. Migration 018:
   - database/migrations/20261007_018_add_recipient_encryption_columns.sql
   - Additive columns: phone_encrypted TEXT NULL, address_full_encrypted TEXT NULL on commerce_order_recipients.
   - Zero modifications to commerce_orders, commerce_settlements, or accounting semantics.

2. RAM Recipient Extraction & Preserve-Best-Known Semantics:
   - Captures unmasked recipient data from TikTok Order API in RAM before privacy sanitization.
   - Extracts user_id, buyer_id, buyer_uid, raw name, raw phone, full address, province/district/ward.
   - Preserve-best semantics: Subsequent sync with masked/redacted data NEVER overwrites earlier unmasked good facts.
   - Prevents identity downgrade (BUYER_UID > BUYER_ID > USER_ID > RECIPIENT_ID > PHONE_HMAC > UNMATCHED).

3. AES-256-GCM Encryption-At-Rest:
   - Dedicated secret: CUSTOMER_RECIPIENT_ENCRYPTION_KEY (>= 32 bytes).
   - Sensitive fields encrypted at rest: phone_encrypted, address_full_encrypted, recipient_name_encrypted.
   - Zero plaintext PII stored in database or logged.
   - Strictly prohibits key reuse across HMAC key, Auth signing key, or App secret.
   - Fail-closed: Missing/weak encryption key sets sensitive fields to NULL without breaking Orders sync.

4. Customer 360 KPI Invariant:
   - UNMATCHED orders are strictly excluded from unique customer counts.
   - 0 matched out of 2777 orders => Coverage is 0.0%, Total Customers is 0 (NOT 100%).

5. Bounded Priority Sync Mode:
   - syncPriorityRecipients: Targets active lifecycle orders (AWAITING_SHIPMENT, IN_TRANSIT: 164 priority orders).
   - Bounded to max 50 orders per batch to prevent gateway timeout.
   - Synchronous mode (action=sync_priority_recipients, sync_mode=sync).
   - "Thu thập ưu tiên (164 đơn)" buttons in UI.

Deployment Runbook:
1. Run Migration 018 on database:
   mysql -u <user> -p <dbname> < database/migrations/20261007_018_add_recipient_encryption_columns.sql
2. Add CUSTOMER_RECIPIENT_ENCRYPTION_KEY to .env:
   CUSTOMER_RECIPIENT_ENCRYPTION_KEY=<random_32_chars_or_more>
   (Note: Must be distinct from CUSTOMER_IDENTITY_HMAC_KEY, AUTH_SIGNING_KEY, TIKTOK_APP_SECRET)
3. Deploy PHP backend files and dist/ frontend bundle.
4. Verify tests:
   node tools/test_v2_05_2_recipient_capture.cjs
5. Trigger priority recipient capture via UI or API:
   curl "https://marketing.addp.vn/api/commerce_sync.php?action=sync_priority_recipients&shop_id=<shop_id>"
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

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

createPosixZip(stagingDir, releaseZipPath);

// Step 4: Verification of ZIP Entries (Zero backslashes)
console.log('\nStep 4: Verifying ZIP contents for POSIX path compliance...');
const zipBuffer = fs.readFileSync(releaseZipPath);
let zipOffset = 0;
let zipEntriesCount = 0;
const verifiedEntries = [];

while (zipOffset < zipBuffer.length - 4) {
  const sig = zipBuffer.readUInt32LE(zipOffset);
  if (sig === 0x04034b50) {
    const fnLen = zipBuffer.readUInt16LE(zipOffset + 26);
    const extraLen = zipBuffer.readUInt16LE(zipOffset + 28);
    const cSize = zipBuffer.readUInt32LE(zipOffset + 18);
    const fn = zipBuffer.toString('utf8', zipOffset + 30, zipOffset + 30 + fnLen);
    
    if (fn.includes('\\')) {
      throw new Error(`CRITICAL ZIP INTEGRITY ERROR: Entry contains backslash: "${fn}"`);
    }
    verifiedEntries.push(fn);
    zipEntriesCount++;
    zipOffset += 30 + fnLen + extraLen + cSize;
  } else if (sig === 0x02014b50) {
    const fnLen = zipBuffer.readUInt16LE(zipOffset + 28);
    const extraLen = zipBuffer.readUInt16LE(zipOffset + 30);
    const commentLen = zipBuffer.readUInt16LE(zipOffset + 32);
    zipOffset += 46 + fnLen + extraLen + commentLen;
  } else if (sig === 0x06054b50) {
    break;
  } else {
    zipOffset++;
  }
}

// Step 5: Compute SHA-256 Checksum
console.log('\nStep 5: Computing SHA-256 checksum...');
const sha256Hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
const checksumFileName = `${releaseFileName}.sha256`;
const checksumFilePath = path.join(releaseDir, checksumFileName);
fs.writeFileSync(checksumFilePath, `${sha256Hash}  ${releaseFileName}\n`, 'utf8');

// Cleanup staging directory
fs.rmSync(stagingDir, { recursive: true, force: true });

// Step 6: Summary Report
const stats = fs.statSync(releaseZipPath);
console.log('\n====================================================================');
console.log('  SPRINT V2-05.2 RELEASE PACKAGING COMPLETED SUCCESSFULLY');
console.log('====================================================================');
console.log(`Release Archive:  ${releaseZipPath}`);
console.log(`File Size:        ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);
console.log(`ZIP Total Files:  ${zipEntriesCount} files`);
console.log(`POSIX Path Check: 100% PASS (Zero backslashes detected)`);
console.log(`SHA-256 Checksum: ${sha256Hash}`);
console.log(`Checksum File:   ${checksumFilePath}`);
console.log('====================================================================\n');
console.log('Files included in release:');
verifiedEntries.forEach(e => console.log(`  - ${e}`));
console.log('\nReady for manual operator deployment.');
