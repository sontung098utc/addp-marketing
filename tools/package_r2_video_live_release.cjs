/**
 * ====================================================================
 * RELEASE PACKAGER: R2 - P0-02 VIDEO INTELLIGENCE & P0-03 LIVE GMV MAX METRIC CORRECTION
 * File: tools/package_r2_video_live_release.cjs
 * Target: Packages all verified files for Release R2
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING R2 VIDEO INTELLIGENCE & LIVE ROAS RELEASE PACKAGING');
console.log('====================================================================\n');

const projectRoot = path.join(__dirname, '..');

// Step 1: Run R2 test suite
console.log('Step 1: Running P0-02/P0-03 Test Suite (9 tests)...');
execSync('node tools/test_p0_02_video_and_live_roi.cjs', { cwd: projectRoot, stdio: 'inherit' });

// Step 2: Run Runtime Render test suite
console.log('\nStep 2: Running Runtime SSR Render Verification (12 views)...');
execSync('node tools/test_runtime_render.mjs', { cwd: projectRoot, stdio: 'inherit' });

// Step 3: Run Frontend Undefined Audit
console.log('\nStep 3: Running Frontend Undefined Variables Audit...');
execSync('node tools/audit_frontend_undef.cjs', { cwd: projectRoot, stdio: 'inherit' });

// Step 4: Lint PHP syntax
console.log('\nStep 4: Linting PHP syntax across all public/api files...');
execSync('node tools/verify_php_syntax.cjs', { cwd: projectRoot, stdio: 'inherit' });

// Step 5: Build Frontend
console.log('\nStep 5: Compiling frontend production bundle with Vite...');
execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });

// Sync public/api to dist/api
const phpFilesToSync = [
  'creatives_data.php',
  'campaigns.php',
  'commerce_dashboard.php'
];

for (const phpFile of phpFilesToSync) {
  const src = path.join(projectRoot, 'public/api', phpFile);
  const dst = path.join(projectRoot, 'dist/api', phpFile);
  fs.copyFileSync(src, dst);
}

// Step 6: Setup paths and staging
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_r2_video_live_release_${timestamp}.zip`;
const releaseDir = path.join(projectRoot, 'release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_r2_video_live_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// Step 7: Define manifest
const manifestFiles = [
  'public/api/creatives_data.php',
  'dist/api/creatives_data.php',
  'public/api/campaigns.php',
  'dist/api/campaigns.php',
  'public/api/commerce_dashboard.php',
  'dist/api/commerce_dashboard.php',
  'src/App.jsx',
  'src/CommerceLiveAnalyticsView.jsx',
  'tools/test_p0_02_video_and_live_roi.cjs'
];

// Add dist build files
function collectDistFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const rel = path.relative(projectRoot, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      collectDistFiles(fullPath);
    } else {
      if (!manifestFiles.includes(rel)) {
        manifestFiles.push(rel);
      }
    }
  }
}
collectDistFiles(path.join(projectRoot, 'dist'));

// Copy manifest files to staging
console.log(`\nStep 6: Staging ${manifestFiles.length} release files...`);
for (const relFile of manifestFiles) {
  const src = path.join(projectRoot, relFile);
  const dst = path.join(stagingDir, relFile);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// Generate Release Notes
const releaseNotes = `===============================================================================
ADDP COMMERCE INTELLIGENCE - RELEASE R2: VIDEO INTELLIGENCE & LIVE ROAS CORRECTION
Bỏ Dữ Liệu Giả Lập Video & Tách Bạch Ads ROAS vs Blended LIVE ROAS
===============================================================================
Mã phát hành: ${releaseFileName}
Thời điểm đóng gói: ${now.toISOString()}
Trạng thái kiểm thử: 9/9 Video & Live Tests PASS | 12/12 SSR Views PASS | 0 Undefined Vars
Tuân thủ bảo mật: Zero production mock data, Zero SSH deployment.

1. TỔNG QUAN THAY ĐỔI P0-02 (VIDEO AFFILIATE INTELLIGENCE):
-------------------------------------------------------------------------------
1. XÓA BỎ HOÀN TOÀN DỮ LIỆU MOCK VÀ CÔNG THỨC SUY DIỄN:
   - Xóa bỏ 370 dòng khai báo video mẫu (baseTemplates) trong creatives_data.php.
   - Xóa bỏ công thức pseudo-random modulo crc32 tính tỷ lệ hủy đơn giả.
   - Xóa bỏ các lý do hủy bịa đặt (khách đặt bốc đồng theo trend mukbang, lệch giá voucher, v.v.).
   - Xóa bỏ phép tính giả lập lượt clicks = spend / 80 và impressions = spend / 10 trong campaigns.php.
   - Xóa bỏ mảng fallback mock mukbang trong App.jsx (lines 6020-6057).

2. ĐỐI SOÁT HOÀN HỦY THEO VIDEO XÁC THỰC:
   - Tỷ lệ hủy và số đơn hủy của video được truy vấn trực tiếp từ bảng commerce_affiliate_orders
     theo trường content_id liên kết với video_id.
   - Khi không có dữ liệu hủy xác thực từ API, hiển thị trạng thái 'Chưa ghi nhận đơn hủy liên kết với video này'
     thay vì tự sinh số liệu giả định.

2. TỔNG QUAN THAY ĐỔI P0-03 (LIVE GMV MAX METRIC CORRECTION):
-------------------------------------------------------------------------------
1. PHÂN BIỆT RÕ RÀNG ADS ROAS VÀ BLENDED LIVE ROAS:
   - Ads ROAS (Attributed ROAS): Chỉ tính từ GMV do TikTok Ads ghi nhận (attributed_live_gmv)
     chia cho chi phí quảng cáo LIVE (live_ad_spend).
   - Blended LIVE ROAS: Tính từ toàn bộ GMV phiên LIVE (cả tự nhiên và quảng cáo)
     chia cho chi phí quảng cáo LIVE (live_ad_spend).
   - Không còn tình trạng lấy toàn bộ GMV phiên LIVE chia chi phí QC rồi gắn nhãn "Ads ROI".

2. MINH BẠCH NGUỒN GỐC & ĐỘ TƯƠI DỮ LIỆU:
   - Thêm metadata source_attribution phân định rõ nguồn dữ liệu LIVE Session (TikTok Shop Live API)
     và nguồn dữ liệu LIVE Ads (TikTok Marketing API GMV Max).
   - Thêm trường data_freshness ghi nhận thời điểm truy vấn.
   - Giao diện CommerceLiveAnalyticsView hiển thị rõ ràng chỉ số Ads ROAS và Blended ROAS kèm GMV Ads.

3. DANH SÁCH FILE PHÁT HÀNH:
-------------------------------------------------------------------------------
${manifestFiles.map(f => ' - ' + f).join('\n')}
===============================================================================
`;

fs.writeFileSync(path.join(stagingDir, 'RELEASE_NOTES.txt'), releaseNotes, 'utf8');

// Step 8: Build ZIP Archive
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}
const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

function createZip(sourceDir, zipFilePath) {
  function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  const allFiles = getAllFiles(sourceDir);
  const entries = [];

  for (const absFile of allFiles) {
    const relFile = path.relative(sourceDir, absFile).replace(/\\/g, '/');
    const content = fs.readFileSync(absFile);
    entries.push({ relFile, content });
  }

  entries.sort((a, b) => a.relFile.localeCompare(b.relFile));

  const localFileHeaders = [];
  const centralDirHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.relFile, 'utf8');
    const crc = crc32(entry.content);
    const uncompressedSize = entry.content.length;
    const deflated = zlib.deflateRawSync(entry.content, { level: 9 });
    let isCompressed = false;
    let dataBuf = entry.content;
    let compressedSize = uncompressedSize;

    if (deflated.length < uncompressedSize) {
      isCompressed = true;
      dataBuf = deflated;
      compressedSize = deflated.length;
    }

    const dosDate = ((2026 - 1980) << 9) | (10 << 5) | 9;
    const dosTime = (19 << 11) | (40 << 5) | 0;

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(isCompressed ? 8 : 0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    localFileHeaders.push(localHeader, dataBuf);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(isCompressed ? 8 : 0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt32LE(0, 36);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    centralDirHeaders.push(centralHeader);
    offset += localHeader.length + dataBuf.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const h of centralDirHeaders) centralDirSize += h.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const finalZipBuffer = Buffer.concat([...localFileHeaders, ...centralDirHeaders, eocd]);
  fs.writeFileSync(zipFilePath, finalZipBuffer);
}

console.log('Step 7: Generating release archive...');
createZip(stagingDir, releaseZipPath);

const zipStats = fs.statSync(releaseZipPath);
const fileBuffer = fs.readFileSync(releaseZipPath);
const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

console.log('\n====================================================================');
console.log('  R2 VIDEO INTELLIGENCE & LIVE ROAS RELEASE PACKAGED SUCCESSFULLY');
console.log('====================================================================');
console.log(`  File:        ${releaseFileName}`);
console.log(`  Path:        ${releaseZipPath}`);
console.log(`  Size:        ${(zipStats.size / 1024).toFixed(2)} KB (${zipStats.size} bytes)`);
console.log(`  SHA-256:     ${hashSum}`);
console.log('====================================================================\n');
