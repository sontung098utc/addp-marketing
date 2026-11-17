/**
 * ====================================================================
 * RELEASE PACKAGER: R1 - P0-01 AFFILIATE DATA INTEGRITY
 * File: tools/package_r1_affiliate_release.cjs
 * Target: Packages all verified files for Release R1
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { execSync } = require('child_process');

console.log('====================================================================');
console.log('STARTING R1 AFFILIATE DATA INTEGRITY RELEASE PACKAGING');
console.log('====================================================================\n');

const projectRoot = path.join(__dirname, '..');

// Step 1: Run Affiliate test suite
console.log('Step 1: Running P0-01 Affiliate Test Suite (10 tests)...');
execSync('node tools/test_p0_01_affiliate_integrity.cjs', { cwd: projectRoot, stdio: 'inherit' });

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
  'tiktok_client.php',
  'commerce_affiliate_service.php',
  'commerce_dashboard.php',
  'commerce_sync_orchestrator.php'
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
const releaseFileName = `task_r1_affiliate_integrity_release_${timestamp}.zip`;
const releaseDir = path.join(projectRoot, 'release');
const releaseZipPath = path.join(releaseDir, releaseFileName);
const stagingDir = path.join(releaseDir, `staging_r1_affiliate_${timestamp}`);

if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

// Step 7: Define manifest
const manifestFiles = [
  'database/migrations/20261009_021_create_commerce_affiliate_orders.sql',
  'database/migrations/20261009_021_rollback_commerce_affiliate_orders.sql',
  'public/api/tiktok_client.php',
  'dist/api/tiktok_client.php',
  'public/api/commerce_affiliate_service.php',
  'dist/api/commerce_affiliate_service.php',
  'public/api/commerce_dashboard.php',
  'dist/api/commerce_dashboard.php',
  'public/api/commerce_sync_orchestrator.php',
  'dist/api/commerce_sync_orchestrator.php',
  'src/CommerceAffiliateView.jsx',
  'tools/test_p0_01_affiliate_integrity.cjs'
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
ADDP COMMERCE INTELLIGENCE - RELEASE R1: P0-01 AFFILIATE DATA INTEGRITY
Tính Toàn Vẹn Dữ Liệu Affiliate & Chuẩn Hóa API Ingestion
===============================================================================
Mã phát hành: ${releaseFileName}
Thời điểm đóng gói: ${now.toISOString()}
Trạng thái kiểm thử: 10/10 Affiliate Tests PASS | 12/12 SSR Views PASS | 0 Undefined Vars
Tuân thủ bảo mật: API ONLY, Zero SSH deployment, Zero direct production DB alterations.

1. TỔNG QUAN THAY ĐỔI THEO QUYẾT ĐỊNH PRODUCT OWNER:
-------------------------------------------------------------------------------
1. NGUỒN DỮ LIỆU AFFILIATE: API ONLY
   - Đã loại bỏ hoàn toàn cơ chế tải tệp CSV / Excel mock khỏi giao diện và dịch vụ.
   - Khi gọi import_affiliate_orders, hệ thống phản hồi API_ONLY_POLICY.
   - Thêm nút "Đồng bộ API Affiliate" gọi trực tiếp TikTok Shop Affiliate Seller Order Search API:
     POST /affiliate_seller/202410/orders/search (Scope: seller.affiliate_collaboration.read).

2. XÓA BỎ HOÀN TOÀN CÁC TỶ LỆ CỐ ĐỊNH & SỐ LIỆU SUY DIỄN:
   - Xóa bỏ triệt để các tỷ lệ hoa hồng cố định 10%, 9%, 1%.
   - Xóa bỏ phép phân bổ giả lập 70%/30% Organic vs Ads và Video vs LIVE.
   - Hoa hồng ước tính (Estimated) và hoa hồng thực tế (Settled) được tách biệt tuyệt đối.
   - Hoa hồng thực nhận được lấy trực tiếp từ giao dịch tài chính đã đối soát (commerce_finance_transactions).
   - Tỷ lệ hoa hồng trung bình (%) được tính thực tế từ tổng hoa hồng chia tổng GMV hoặc từ dữ liệu đơn hàng;
     nếu chưa có dữ liệu đối soát, hiển thị "Chờ API đối soát" thay vì tự gán 10%.

3. CẤU TRÚC BẢNG & ĐỒNG BỘ DỮ LIỆU IDEMPOTENT:
   - Migration 20261009_021_create_commerce_affiliate_orders.sql:
     Lưu trữ đầy đủ platform_order_id, affiliate_order_id, creator_id, creator_nickname,
     traffic_source (ORGANIC vs PAID_ADS), content_type (VIDEO, LIVE, SHOWCASE),
     commission_rate_pct, estimated_commission, settled_commission, ineligible_commission,
     và raw_payload JSON đã được khử danh tính (sanitized).
   - Upsert idempotent ON DUPLICATE KEY UPDATE theo khóa (platform, shop_id, affiliate_order_id, sku_id).

4. QUẢN LÝ QUYỀN TRUY CẬP (PERMISSION HANDLING):
   - Khi API TikTok phản hồi thiếu quyền (code 105001 / unauthorized / missing scope),
     hệ thống phản hồi trạng thái PERMISSION_REQUIRED với scope 'seller.affiliate_collaboration.read'
     và hướng dẫn người quản trị kích hoạt quyền trên TikTok Shop Partner Center, không bao giờ
     thay thế bằng dữ liệu giả định.

2. DANH SÁCH FILE PHÁT HÀNH:
-------------------------------------------------------------------------------
${manifestFiles.map(f => ' - ' + f).join('\n')}

3. HƯỚNG DẪN TRIỂN KHAI THỦ CÔNG:
-------------------------------------------------------------------------------
Bước 1: Chạy migration tạo bảng trên cơ sở dữ liệu:
  mysql -u <user> -p <db_name> < database/migrations/20261009_021_create_commerce_affiliate_orders.sql

Bước 2: Giải nén và tải các file lên thư mục webroot:
  - public/api/tiktok_client.php -> public_html/api/tiktok_client.php
  - public/api/commerce_affiliate_service.php -> public_html/api/commerce_affiliate_service.php
  - public/api/commerce_dashboard.php -> public_html/api/commerce_dashboard.php
  - public/api/commerce_sync_orchestrator.php -> public_html/api/commerce_sync_orchestrator.php
  - dist/* -> public_html/* (tệp HTML, JS, CSS biên dịch)
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
    const dosTime = (19 << 11) | (30 << 5) | 0;

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
console.log('  R1 AFFILIATE DATA INTEGRITY RELEASE PACKAGED SUCCESSFULLY');
console.log('====================================================================');
console.log(`  File:        ${releaseFileName}`);
console.log(`  Path:        ${releaseZipPath}`);
console.log(`  Size:        ${(zipStats.size / 1024).toFixed(2)} KB (${zipStats.size} bytes)`);
console.log(`  SHA-256:     ${hashSum}`);
console.log('====================================================================\n');
