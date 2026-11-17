# V2-03.1 REPORTING DATA TRUST, REFUND LOSS & COVERAGE RUNBOOK

**Module**: ADDP Commerce Intelligence V2 (`marketing.addp.vn`)  
**Sprint**: V2-03.1 Reporting Hardening  
**Target Release**: `task_v2_03_1_data_trust_release`  
**Migration Required**: NONE (0 database schema changes)

---

## 1. Mục đích & Nguyên nhân gốc (Root Causes)

Hệ thống ghi nhận 3 vấn đề logic trên môi trường production trong module Báo cáo V2-03:
1. **Lỗi ánh xạ hoàn tiền (Loss Ledger Refund Mapping)**:
   - *Nguyên nhân*: Bảng `commerce_loss_ledger` trên production lưu trữ `loss_type` chuẩn là `CANCELLATION` và `REFUND`. Mã nguồn trước đó chỉ kiểm tra `RETURN_REFUND`, khiến tất cả các bản ghi `REFUND` bị bỏ qua khi tính toán sổ cái hoàn thiện (`$hasLedgerData = true`).
   - *Khắc phục*: Chuẩn hóa ánh xạ: `REFUND` và `RETURN_REFUND` (tương thích ngược) được gộp vào bucket hoàn tiền. Giữ nguyên các `loss_type` chưa phân loại, không double count.
2. **Lỗi ngữ nghĩa độ phủ đơn hàng (Order Coverage Semantics)**:
   - *Nguyên nhân*: Sử dụng `COUNT(DISTINCT DATE(platform_created_at)) AS available_days`. Ngày không có đơn hàng phát sinh là trạng thái kinh doanh bình thường, không đồng nghĩa với ngày bị thiếu đồng bộ (Missing != Zero transactions).
   - *Khắc phục*: Không suy diễn độ phủ từ số lượng giao dịch. Kiểm tra metadata authoritative từ `commerce_sync_runs`: nếu chứng minh được trọn kỳ thì `COMPLETE`, nếu chưa đủ metadata thì trả về `UNKNOWN` minh bạch.
3. **Lỗi thông điệp cảnh báo giao diện (Frontend Trust & Warning Message)**:
   - *Nguyên nhân*: Khi `overall_status` là `PARTIAL`/`UNKNOWN`, UI thu gọn trạng thái thành cảnh báo quảng cáo: *"Dữ liệu quảng cáo mới có 30/30 ngày (100%)"*, gây mâu thuẫn trực quan.
   - *Khắc phục*: Phân tách độ phủ theo từng domain độc lập (`advertising`, `orders`, `finance`). Nếu Ads đủ 30/30 thì hiển thị badge xanh *"Dữ liệu quảng cáo đầy đủ: 30/30 ngày (100%)"*. Banner cảnh báo chỉ rõ domain thực tế chưa hoàn tất.

---

## 2. Danh sách tệp thay đổi (Changed Files)

| Đường dẫn tệp | Vai trò | Tác vụ |
| :--- | :--- | :--- |
| `public/api/commerce_reporting_service.php` | Backend Service | Ánh xạ canonical `REFUND`, kiểm toán độ phủ `commerce_sync_runs`, trả về `UNKNOWN` khi unproven, phân tách domain coverage. |
| `src/CommerceReportView.jsx` | Frontend View | Hiển thị domain-specific coverage, đổi nhãn *"Số chiến dịch ghi nhận"*, đổi tỷ lệ *"Ads attributed gross / Doanh số Shop"* kèm tooltip giải thích. |
| `dist/index.html` & `dist/assets/*` | Client Distribution | Biên dịch sẵn bằng Vite v8.1.4 (không cần build trên server). |
| `tools/test_v2_03_1_data_trust_and_coverage.cjs` | Test Suite | 12 ca kiểm thử hồi quy cho các yêu cầu A - L. |
| `tools/test_v2_03_reporting_and_light_ui.cjs` | Test Suite | Cập nhật 19 ca kiểm thử V2-03. |
| `tools/package_v2_03_1_release.cjs` | Release Pipeline | Đóng gói bản phát hành POSIX ZIP. |

---

## 3. Kết quả Kiểm thử (Test Results)

1. `tools/test_v2_03_1_data_trust_and_coverage.cjs`: **12 / 12 PASS (100%)**
   - A. REFUND canonical loss_type included in refund bucket (PASS)
   - B. RETURN_REFUND backward-compatible mapping (PASS)
   - C. No double count & unknown loss_type preservation (PASS)
   - D. Ads 30/30 => advertising.status COMPLETE (100%) (PASS)
   - E. Ads 20/30 => advertising.status PARTIAL (66.7%) (PASS)
   - F. Orders zero-transaction day != missing data (PASS)
   - G. Orders coverage UNKNOWN if unproven (PASS)
   - H. Domain warning isolation (PASS)
   - I. Ads ratio > 100% valid (PASS)
   - J. Campaign count factual label (PASS)
   - K. Historical baseline Sep 01-20 (Gross 272,135,230; Loss 54,287,192; Realized 217,848,038) (PASS)
   - L. Authoritative Ads Sep 01-30 (Cost 34,182,003; Rev 383,251,049; Orders 5,165; ROI 11.21) (PASS)
2. `tools/test_v2_03_reporting_and_light_ui.cjs`: **19 / 19 PASS (100%)**
3. `tools/test_v2_02_1_production_hardening.cjs`: **28 / 28 PASS (100%)**
4. **Tổng số test vượt qua**: **59 / 59 TESTS (100%)**

---

## 4. Lệnh Triển khai (Deployment Instructions)

```bash
# 1. Di chuyển vào thư mục dự án
cd /var/www/marketing.addp.vn

# 2. Tạo bản sao lưu dự phòng trước khi cập nhật
BACKUP_TAG=$(date +%Y%m%d_%H%M%S)
mkdir -p /var/backups/addp_pre_v2031_${BACKUP_TAG}
cp -r public/api/commerce_reporting_service.php dist /var/backups/addp_pre_v2031_${BACKUP_TAG}/

# 3. Xác thực mã băm SHA-256 gói phát hành
echo "<SHA256_CHECKSUM>  task_v2_03_1_data_trust_release_<timestamp>.zip" | sha256sum -c -

# 4. Giải nén ghi đè
unzip -o task_v2_03_1_data_trust_release_<timestamp>.zip

# 5. Phân quyền và xóa cache PHP
chmod -R 755 dist public/api
systemctl reload php8.2-fpm || systemctl reload php-fpm || true
```

---

## 5. Lệnh Rollback (Rollback Instructions)

```bash
cd /var/www/marketing.addp.vn
LATEST_BACKUP=$(ls -td /var/backups/addp_pre_v2031_* | head -1)
if [ -d "$LATEST_BACKUP" ]; then
    cp -r $LATEST_BACKUP/commerce_reporting_service.php public/api/
    rm -rf dist
    cp -r $LATEST_BACKUP/dist ./
    systemctl reload php8.2-fpm || systemctl reload php-fpm || true
    echo "Rollback V2-03.1 hoàn tất thành công từ $LATEST_BACKUP"
fi
```
