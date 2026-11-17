/**
 * SPRINT V2-05.1 FRONTEND RUNTIME HOTFIX — MINIMAL RELEASE PACKAGER
 * 
 * Packages only the necessary frontend runtime hotfix files:
 * 1. Verified dist/index.html
 * 2. Verified dist/assets/index-B9Urh-R1.js (clean, zero handleTriggerDomainSync)
 * 3. Verified dist/assets/index-C0DTiUN4.css
 * 4. Verified src/CommerceDashboardView.jsx
 * 5. HOTFIX_RELEASE_NOTES.txt
 * 
 * Enforces pure POSIX ZIP format (zero Windows backslashes) & computes SHA-256.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING SPRINT V2-05.1 FRONTEND RUNTIME HOTFIX PACKAGING');
console.log('====================================================================\n');

// 1. Run hotfix test suite
console.log('Step 1: Running frontend runtime hotfix test suite...');
execSync('node tools/test_v2_05_1_frontend_customer_sync_button.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

// 2. Setup Timestamps & Paths
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_v2_05_1_frontend_runtime_hotfix_release_${timestamp}.zip`;
const releaseDir = path.join(__dirname, '../release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_v205_1_frontend_hotfix_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// 3. Staging Minimal Frontend Hotfix Files
const manifestMap = [
  ['dist/index.html', 'dist/index.html'],
  ['src/CommerceDashboardView.jsx', 'src/CommerceDashboardView.jsx']
];

// Add dist/assets files
const distAssetsDir = path.join(__dirname, '../dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const assetFiles = fs.readdirSync(distAssetsDir);
  for (const af of assetFiles) {
    manifestMap.push([`dist/assets/${af}`, `dist/assets/${af}`]);
  }
}

console.log('\nStep 2: Staging minimal frontend hotfix files...');
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

// Write Hotfix Release Notes
const releaseNotes = `# V2-05.1 Frontend Runtime Hotfix Release Notes
Archive: ${releaseFileName}
Timestamp: ${timestamp}
Type: MINIMAL FRONTEND RUNTIME HOTFIX (ZERO BACKEND / ZERO DATABASE CHANGES)

Target Fix:
- Replaced 2 calls to undefined function handleTriggerDomainSync('customer') with handleTriggerSync('customer') in src/CommerceDashboardView.jsx (lines 2176 and 2526).
- Connected button "Đồng bộ hồ sơ" and "Đồng bộ dữ liệu khách hàng ngay" to active orchestrator trigger:
  POST commerce_sync.php?action=sync&shop_id=...&domain=customer (body: { domain: 'customer' })
  Fallback: POST commerce_dashboard.php?action=trigger_sync&shop_id=...&domain=customer.
- Automatically re-fetches customer profiles upon sync completion without full page reload.

Verification:
- Zero handleTriggerDomainSync references in source and bundle build.
- No ReferenceError when clicking customer sync buttons.
- Request is dispatched with domain=customer.
- Production backend, database, Migration 017, and accounting invariants remain completely untouched.

Deployment Instructions:
1. Unzip archive over production webroot:
   unzip -o ${releaseFileName} -d /home/addp/domains/marketing.addp.vn/public_html/
2. Clear browser cache or hard reload (Ctrl+Shift+R) to load updated bundle index-B9Urh-R1.js.
3. Click "Đồng bộ hồ sơ" in Customer tab to verify smooth execution.
`;
fs.writeFileSync(path.join(stagingDir, 'HOTFIX_RELEASE_NOTES.txt'), releaseNotes, 'utf8');

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

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    localFileHeaders.push(localHeader);
    localFileHeaders.push(dataBuf);

    const cdHeader = Buffer.alloc(46 + nameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0x0800, 8);
    cdHeader.writeUInt16LE(0, 10);
    cdHeader.writeUInt16LE(dosTime, 12);
    cdHeader.writeUInt16LE(dosDate, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(compressedSize, 20);
    cdHeader.writeUInt32LE(uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(cdHeader, 46);

    centralDirHeaders.push(cdHeader);
    offset += localHeader.length + dataBuf.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cdh of centralDirHeaders) cdSize += cdh.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const allBuffers = [...localFileHeaders, ...centralDirHeaders, eocd];
  const finalZip = Buffer.concat(allBuffers);
  fs.writeFileSync(zipFilePath, finalZip);
}

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

// Step 4: Binary Inspection of Central Directory
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

// Step 5: Compute SHA-256 Checksum
console.log('\nStep 5: Computing SHA-256 checksum...');
const hash = crypto.createHash('sha256').update(zipBuf).digest('hex');
const checksumFile = `${releaseZipPath}.sha256`;
fs.writeFileSync(checksumFile, `${hash}  ${releaseFileName}\n`, 'utf8');

console.log(`  Archive Size: ${(zipBuf.length / (1024 * 1024)).toFixed(2)} MB (${zipBuf.length} bytes)`);
console.log(`  SHA-256 Checksum: ${hash}`);

// Cleanup staging
fs.rmSync(stagingDir, { recursive: true, force: true });

console.log('\n====================================================================');
console.log('MINIMAL FRONTEND RUNTIME HOTFIX PACKAGING COMPLETE AND VERIFIED!');
console.log(`Archive: ${releaseFileName}`);
console.log(`SHA-256: ${hash}`);
console.log('====================================================================\n');
