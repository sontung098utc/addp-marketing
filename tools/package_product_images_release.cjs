/**
 * ====================================================================
 * RELEASE PACKAGER: TIKTOK SHOP PRODUCT IMAGES & METADATA V2
 * File: tools/package_product_images_release.cjs
 * Target: Packages all verified files for Product Tab Image Synchronization
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING PRODUCT IMAGES & METADATA RELEASE PACKAGING');
console.log('====================================================================\n');

const projectRoot = path.join(__dirname, '..');

// Step 1: Run Product Images test suite
console.log('Step 1: Running Product Images Test Suite (10 tests)...');
execSync('node tools/test_commerce_product_images.cjs', { cwd: projectRoot, stdio: 'inherit' });

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
fs.copyFileSync(
  path.join(projectRoot, 'public/api/commerce_product_service.php'),
  path.join(projectRoot, 'dist/api/commerce_product_service.php')
);
fs.copyFileSync(
  path.join(projectRoot, 'public/api/commerce_dashboard.php'),
  path.join(projectRoot, 'dist/api/commerce_dashboard.php')
);

// Step 6: Setup paths and staging
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const releaseFileName = `task_fix_tiktok_product_images_sync_release_${timestamp}.zip`;
const releaseDir = path.join(projectRoot, 'release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_product_images_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// Step 7: Define manifest
const manifestFiles = [
  'database/migrations/20261009_020_create_commerce_product_catalog.sql',
  'database/migrations/20261009_020_rollback_commerce_product_catalog.sql',
  'public/api/commerce_product_service.php',
  'dist/api/commerce_product_service.php',
  'public/api/commerce_dashboard.php',
  'dist/api/commerce_dashboard.php',
  'src/CommerceDashboardView.jsx',
  'src/App.jsx',
  'tools/test_commerce_product_images.cjs',
  'tools/sanitize_image_fallbacks.cjs',
  'dist/index.html'
];

// Add dist/assets dynamically
const distAssetsDir = path.join(projectRoot, 'dist', 'assets');
if (fs.existsSync(distAssetsDir)) {
  const assets = fs.readdirSync(distAssetsDir);
  for (const asset of assets) {
    manifestFiles.push(`dist/assets/${asset}`);
  }
}

console.log(`\nStep 6: Staging ${manifestFiles.length} files...`);
for (const relPath of manifestFiles) {
  const src = path.join(projectRoot, relPath);
  const dest = path.join(stagingDir, relPath);
  if (!fs.existsSync(src)) {
    throw new Error(`CRITICAL: Staging source missing: ${src}`);
  }
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

// Generate Release Notes
const releaseNotes = `===============================================================================
ADDP COMMERCE INTELLIGENCE - RELEASE FIX: TIKTOK SHOP PRODUCT IMAGES & METADATA
Đồng Bộ Ảnh Sản Phẩm & SKU TikTok Shop Mới Nhất
===============================================================================
Mã phát hành: ${releaseFileName}
Thời điểm đóng gói: ${now.toISOString()}
Trạng thái kiểm thử: 10/10 Product Image Tests PASS | 12/12 SSR Views PASS | 0 Undefined Vars
Tuân thủ bảo mật: Không tự động chạy migration trên production, Zero SSH deployment.

1. TỔNG QUAN THAY ĐỔI
-------------------------------------------------------------------------------
1. TRUY VẾT & NGUYÊN NHÂN GỐC:
   - Trước đây get_products Action 7 lấy MAX(i.sku_image) từ commerce_order_items.
     Ảnh này là snapshot cũ tại thời điểm đặt hàng nhiều tháng trước và lấy ngẫu
     nhiên theo thứ tự chữ cái, dẫn đến lệch ảnh hoặc hiển thị ảnh cũ.
   - Khi không có ảnh, hệ thống fallback vào một URL ảnh sản phẩm cố định trong App.jsx,
     khiến nhiều sản phẩm khác bị gán nhầm ảnh này.
   - Giải pháp: Loại bỏ hoàn toàn fallback ảnh cứng; thay bằng placeholder trung tính;
     xây dựng bảng commerce_product_catalog lưu metadata và ảnh chính chủ từ TikTok Shop Open API.

2. CƠ CHẾ ĐỒNG BỘ & PHÂN BIỆT ẢNH:
   - Ingestion từ TikTok Open API: /product/202309/products/search & /product/202309/products/{id}.
   - Phân biệt cấp Product và cấp SKU:
     * Cấp Product: lưu product_image (ảnh cover chính của sản phẩm).
     * Cấp SKU: kiểm tra sales_attributes[].sku_img và sku_img trực tiếp. Chỉ khi TikTok
       trả về ảnh riêng biệt khác ảnh bìa thì mới gán has_sku_image = 1 và sku_image riêng.
     * Khi SKU không có ảnh riêng: tự động kế thừa product_image với has_sku_image = 0.
   - Frontend hiển thị huy hiệu [SKU] khi biến thể có ảnh riêng biệt.

3. QUẢN LÝ CACHE & INVALIDATION:
   - Tạo hàm computeImageHash(url): băm md5 12 ký tự duy nhất của URL ảnh.
   - Tăng image_version khi và chỉ khi nội dung/URL ảnh thay đổi.
   - Frontend tạo tham số phiên bản ổn định: ?v=\${image_version} (chỉ khi image_version > 1).
   - Nghiêm cấm hoàn toàn query params ngẫu nhiên (?t=Date.now() hoặc Math.random()).
   - Lưu trữ cache transient 300s (CommerceTransientCache) để khi người dùng chuyển qua lại
     giữa các tab, danh mục ảnh được nạp ngay lập tức từ bộ nhớ đệm mà không query lại DB.

4. HIỂN THỊ DESKTOP & MOBILE:
   - Thumbnail 56×56 px bo góc 8px với object-fit: cover và loading="lazy".
   - Khung cuộn ngang overflowX: auto và minWidth: 860px chống méo cột trên thiết bị di động.
   - Modal 2 (Chi tiết phân loại SKU): Thumbnail 40×40 px, bảng minWidth: 540px, cuộn ngang mượt mà.
   - Placeholder trung tính <Package /> hiển thị tức thì nếu ảnh lỗi/thiếu hoặc CDN hỏng.

5. BẢO TOÀN SỐ LIỆU TÀI CHÍNH:
   - Giữ nguyên 100% công thức kế toán: Doanh Thu Gộp - Tổn Thất Hoàn Hủy = Doanh Thu Thực Nhận.
   - Không thay đổi bảng dữ liệu đơn hàng (commerce_orders, commerce_order_items).

2. DANH SÁCH FILE PHÁT HÀNH
-------------------------------------------------------------------------------
${manifestFiles.map(f => ' - ' + f).join('\n')}

3. HƯỚNG DẪN TRIỂN KHAI THỦ CÔNG
-------------------------------------------------------------------------------
Bước 1: Chạy migration tạo bảng danh mục catalog trên database production:
  mysql -u <user> -p <db_name> < database/migrations/20261009_020_create_commerce_product_catalog.sql

Bước 2: Giải nén và ghi đè các file backend PHP:
  - public/api/commerce_product_service.php
  - public/api/commerce_dashboard.php

Bước 3: Cập nhật frontend bundle trong dist/ (hoặc build lại từ source):
  - dist/index.html
  - dist/assets/

Bước 4: Kiểm tra runtime tại tab Sản phẩm trên https://marketing.addp.vn:
  - Bấm nút "Đồng bộ ảnh & metadata" trên giao diện để nạp dữ liệu ảnh mới nhất từ TikTok Shop.
`;

fs.writeFileSync(path.join(stagingDir, 'RELEASE_NOTES_PRODUCT_IMAGES_V2.txt'), releaseNotes, 'utf8');

// CRC32 table
const makeCrcTable = () => {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }
  return table;
};
const crcTable = makeCrcTable();
const crc32 = (buf) => {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
};

// Pure POSIX ZIP generator
function createPosixZip(sourceDir, zipFilePath) {
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
    const dosTime = (12 << 11) | (0 << 5) | 0;

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
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0x81A40000, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    centralDirHeaders.push(centralHeader);
    offset += localHeader.length + dataBuf.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralDirHeaders) {
    centralDirSize += ch.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const finalZipBuffer = Buffer.concat([
    ...localFileHeaders,
    ...centralDirHeaders,
    eocd
  ]);

  fs.writeFileSync(zipFilePath, finalZipBuffer);
}

console.log('\nStep 7: Creating pure POSIX ZIP archive...');
createPosixZip(stagingDir, releaseZipPath);

// Step 8: Validate POSIX entries in ZIP
console.log('\nStep 8: Validating ZIP entries...');
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
console.log(`Validated ${fileCount} entries in ZIP archive. All paths strictly pure POSIX.`);

// Step 9: SHA-256 Checksum
console.log('\nStep 9: Computing SHA-256 checksum...');
const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
fs.writeFileSync(`${releaseZipPath}.sha256`, `${sha256}  ${releaseFileName}\n`, 'utf8');

// Cleanup staging
fs.rmSync(stagingDir, { recursive: true, force: true });

console.log('\n====================================================================');
console.log('TIKTOK PRODUCT IMAGES RELEASE PACKAGE CREATED SUCCESSFULLY!');
console.log(`Release Archive:  ${releaseZipPath}`);
console.log(`Archive Size:     ${(zipBuffer.length / 1024).toFixed(2)} KB`);
console.log(`Total Files:      ${fileCount}`);
console.log(`SHA-256 Checksum: ${sha256}`);
console.log('====================================================================\n');
