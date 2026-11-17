/**
 * ====================================================================
 * RELEASE PACKAGER: R3 - P0-04 PRODUCT-SPECIFIC BREAK-EVEN ROI
 * File: tools/package_r3_breakeven_roi_release.cjs
 * Target: Packages all verified files for Release R3
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING R3 PRODUCT-SPECIFIC BREAK-EVEN ROI RELEASE PACKAGING');
console.log('====================================================================\n');

const projectRoot = path.join(__dirname, '..');

// Step 1: Run R3 test suite
console.log('Step 1: Running P0-04 Test Suite (10 tests)...');
execSync('node tools/test_p0_03_breakeven_roi.cjs', { cwd: projectRoot, stdio: 'inherit' });

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
  'commerce_product_cost_service.php',
  'commerce_ads_service.php',
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
const releaseFileName = `task_r3_breakeven_roi_release_${timestamp}.zip`;
const releaseDir = path.join(projectRoot, 'release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_r3_breakeven_roi_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// Step 7: Define manifest
const manifestFiles = [
  'database/migrations/20261009_022_create_commerce_product_costs.sql',
  'database/migrations/20261009_022_create_commerce_product_costs_rollback.sql',
  'public/api/commerce_product_cost_service.php',
  'dist/api/commerce_product_cost_service.php',
  'public/api/commerce_ads_service.php',
  'dist/api/commerce_ads_service.php',
  'public/api/commerce_dashboard.php',
  'dist/api/commerce_dashboard.php',
  'src/CommerceDashboardView.jsx',
  'tools/test_p0_03_breakeven_roi.cjs'
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
ADDP COMMERCE INTELLIGENCE - RELEASE R3: PRODUCT-SPECIFIC BREAK-EVEN ROI
Cấu Hình Giá Vốn (COGS), Phí Sàn & ROI Hòa Vốn Theo Từng Sản Phẩm (SPU)
===============================================================================
Mã phát hành: ${releaseFileName}
Thời điểm đóng gói: ${now.toISOString()}
Trạng thái kiểm thử: 10/10 Break-even ROI Tests PASS | 12/12 SSR Views PASS | 0 Undefined Vars
Tuân thủ bảo mật: Zero production mock data, Zero SSH deployment.

1. TỔNG QUAN THAY ĐỔI P0-04 (PRODUCT BREAK-EVEN ROI):
-------------------------------------------------------------------------------
1. BẢNG CƠ SỞ DỮ LIỆU CẤU HÌNH GIÁ VỐN SẢN PHẨM:
   - Migration: 20261009_022_create_commerce_product_costs.sql
   - Bảng: commerce_product_costs
   - Khóa duy nhất: (platform, shop_id, product_id) với product_id là mã SPU (item_group_id).
   - Các trường tài chính đơn vị:
     + selling_price: Giá bán lẻ tham chiếu
     + cogs_amount: Giá vốn hàng bán (COGS)
     + variable_cost_amount: Chi phí biến đổi trên đơn (bao bì, nhân công, vận hành)
     + platform_fee_pct: Tỷ lệ phí sàn TikTok Shop (mặc định 4.0%)
     + margin_target_pct: Biên lợi nhuận mục tiêu tùy chọn
     + unit_margin: Lợi nhuận đóng góp đơn vị = Giá bán - COGS - Phí biến đổi - Phí sàn
     + margin_pct: Tỷ lệ biên lợi nhuận (%) = unit_margin / selling_price
     + breakeven_roas: ROI hòa vốn = 1 / (margin_ratio) = selling_price / unit_margin
     + status: CONFIGURED | INSUFFICIENT_DATA | NEGATIVE_MARGIN

2. BỎ HOÀN TOÀN GIẢ ĐỊNH HÒA VỐN TOÀN CỤC:
   - Trước đây: Giả định cố định ROI hòa vốn là 6.00x hoặc 15.00x cho mọi sản phẩm.
   - Hiện tại: Nếu sản phẩm chưa được cấu hình, hệ thống trả về status = 'NOT_CONFIGURED',
     breakeven_roas = null và giao diện hiển thị trạng thái 'Chưa thiết lập' kèm nút thiết lập.
   - Xử lý biên lợi nhuận âm: Khi COGS + phí > giá bán, trả về status = 'NEGATIVE_MARGIN'
     và breakeven_roas = null thay vì chia cho số âm hoặc sinh ra số vô lý.

3. LIÊN KẾT BÁO CÁO PRODUCT GMV MAX VỚI SỔ CÁI GIÁ VỐN:
   - commerce_ads_service.php::getProductIntelligence() truy vấn bảng commerce_product_costs
     và tự động nhúng các trường giá vốn, ROI hòa vốn, và roas_vs_breakeven (ABOVE_BREAKEVEN / BELOW_BREAKEVEN)
     vào từng dòng sản phẩm SPU.
   - Báo cáo macro tổng quan hiển thị tổng số SPU đã được cấu hình giá vốn.

4. GIAO DIỆN NGƯỜI DÙNG & MODAL BẢNG TÍNH UNIT ECONOMICS TRỰC TIẾP:
   - Cột 'ROI Hòa Vốn (BEP)' hiển thị chính xác ngưỡng hòa vốn theo sản phẩm.
   - Cột 'Hiệu Quả ROI' hiển thị huy hiệu:
     + 'ĐẠT MỤC TIÊU' (xanh lục): Khi ROI Ads thực tế >= ROI hòa vốn.
     + 'DƯỚI HÒA VỐN' (đỏ): Khi ROI Ads thực tế < ROI hòa vốn (lỗ chi phí quảng cáo).
     + 'MARGIN ÂM' (vàng): Khi chi phí vượt giá bán.
     + 'CHƯA THIẾT LẬP' (xám): Khi chưa nhập giá vốn.
   - Modal cấu hình Unit Economics cho phép nhập Giá bán, COGS, Chi phí đóng gói, Phí sàn %,
     và hiển thị bảng tính trực tiếp (Live Calculation Preview) trước khi lưu.

2. DANH SÁCH FILE PHÁT HÀNH:
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
    const dosTime = (19 << 11) | (50 << 5) | 0;

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

  const centralDirBuffer = Buffer.concat(centralDirHeaders);
  const endOfCentralDir = Buffer.alloc(22);
  endOfCentralDir.writeUInt32LE(0x06054b50, 0);
  endOfCentralDir.writeUInt16LE(0, 4);
  endOfCentralDir.writeUInt16LE(0, 6);
  endOfCentralDir.writeUInt16LE(entries.length, 8);
  endOfCentralDir.writeUInt16LE(entries.length, 10);
  endOfCentralDir.writeUInt32LE(centralDirBuffer.length, 12);
  endOfCentralDir.writeUInt32LE(offset, 16);
  endOfCentralDir.writeUInt16LE(0, 20);

  const finalZipBuffer = Buffer.concat([...localFileHeaders, centralDirBuffer, endOfCentralDir]);
  fs.writeFileSync(zipFilePath, finalZipBuffer);
}

console.log(`\nStep 7: Compressing into ${releaseFileName}...`);
createZip(stagingDir, releaseZipPath);

// Step 9: Compute SHA-256 Checksum
const zipBytes = fs.readFileSync(releaseZipPath);
const sha256 = crypto.createHash('sha256').update(zipBytes).digest('hex');
const sizeKb = (zipBytes.length / 1024).toFixed(2);

console.log('\n====================================================================');
console.log('RELEASE R3 PACKAGING COMPLETE!');
console.log('====================================================================');
console.log(`File:     ${releaseZipPath}`);
console.log(`Size:     ${sizeKb} KB`);
console.log(`SHA-256:  ${sha256}`);
console.log('====================================================================\n');
