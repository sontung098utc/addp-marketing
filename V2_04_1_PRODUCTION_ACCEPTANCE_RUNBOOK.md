# V2-04.1 RUNBOOK: PRODUCTION ACCEPTANCE FIX

**Module:** ADDP Commerce Intelligence V2  
**Production Host:** `marketing.addp.vn`  
**Webroot:** `/home/addp/domains/marketing.addp.vn/public_html`  
**Date:** 2026-10-05  
**Version:** V2-04.1  
**Release ZIP:** `release/task_v2_04_1_production_acceptance_release_20261005_105012.zip`  
**SHA-256:** `4a26f22c299bf4dcb80c60afd50efab52a1b8d48855332b5a3b4562cf54323ab`  

---

## 1. MỤC TIÊU & TỔNG QUAN SỬA LỖI (ACCEPTANCE FIX OVERVIEW)

Sprint **V2-04.1** là bản vá có mục tiêu chính xác (surgical patch) nhằm giải quyết dứt điểm 5 blocker phát hiện trong quá trình nghiệm thu thực tế trên môi trường Production của V2-04 mà **không refactor hoặc viết lại bất kỳ thành phần nào của V2-04**:

### 1.1. RMA → Missing Order Dependency Recovery
- **Thực tế Production:** Khi đồng bộ RMA giai đoạn `2026-09-21 → 2026-09-30`, TikTok trả về 8 RMAs. Trong đó có 2 RMA trạng thái `SUCCESS` tham chiếu đến các đơn hàng chưa có trong bảng `commerce_orders`:
  - Đơn `585554724568598075`, hoàn tiền `29,000 VND`
  - Đơn `585721631389812511`, hoàn tiền `49,000 VND`
  - Động cơ hao hụt `CommerceLossEngine::computeAndPersistLossLedger()` trả về `ORDER_NOT_FOUND`.
- **Giải pháp V2-04.1:**
  - Phát hiện triệt để các orphan RMA (RMA mồ côi đơn hàng).
  - Tuyệt đối không âm thầm coi việc đối soát hao hụt là hoàn tất khi đơn hàng gốc bị thiếu.
  - Hạ trạng thái độ phủ của RMA và Loss xuống `PARTIAL` hoặc `UNKNOWN`, không bao giờ đánh dấu `COMPLETE`.
  - Triển khai cơ chế khôi phục đơn hàng có giới hạn an toàn (`bounded recovery` tối đa 50 đơn hàng/lần gọi) qua hàm `syncOrdersByIds()` sử dụng API `searchOrdersV2` / `getOrdersByIds` của TikTok Shop Client. Không bao giờ quét toàn bộ lịch sử không giới hạn (`no unbounded backfill`).
  - Sau khi đơn hàng được khôi phục thành công, tự động tái tính toán ledger hao hụt (`MATURED_LIFECYCLE`).
  - Nếu đơn hàng không thể lấy được từ TikTok API, bảo lưu rõ ràng trạng thái chưa giải quyết (`unresolved_order_ids`) trong metadata đồng bộ.

### 1.2. Realized Sales Trust Rule (Quy tắc Tin cậy Doanh số Thực)
- Công thức: `Realized Sales = Gross Sales - Matured Lifecycle Loss`.
- **Quy tắc tin cậy:** Doanh số thực chỉ được hiển thị là đã xác minh/đầy đủ (`COMPLETE` / `trust_verified = true`) khi **CẢ HAI** điều kiện sau cùng thỏa mãn:
  1. Độ phủ Đơn hàng đầy đủ (`ordersStatus === 'COMPLETE'`).
  2. Độ phủ RMA/Loss và các phụ thuộc đầy đủ (`rmaStatus === 'COMPLETE'`, `lossStatus === 'COMPLETE'`, và `orphan_rma_count === 0`).
- Doanh số gộp (`Gross Sales`) có thể giữ nguyên trạng thái `AVAILABLE` trong khi Doanh số thực là `PARTIAL` hoặc `UNKNOWN`.
- Tuyệt đối không coi dữ liệu RMA/Loss thiếu là số 0.

### 1.3. Hợp đồng Schema RMA (Migration 015 Phụ gia)
- **Thực tế Production:** Sync RMA bị lỗi với ngoại lệ: `SQLSTATE[22001]: Data too long for column 'reason_code'`.
- **Giải pháp V2-04.1:** Tạo Migration 015 phụ gia (`database/migrations/20261005_015_widen_aftersales_reason_and_role.sql`) mở rộng:
  - `commerce_aftersales.reason_code` -> `VARCHAR(128) NULL`
  - `commerce_aftersales.reason_category` -> `VARCHAR(255) NULL`
  - `commerce_aftersales.return_role` -> `VARCHAR(64) NULL`
- Cung cấp script Rollback 015 an toàn.

### 1.4. Tách biệt Miền Hao hụt / Đối soát (Loss Domain)
- Hiển thị 6 miền độc lập trong Quản lý Đồng bộ (`HỆ THỐNG → Đồng bộ dữ liệu`) và Chất lượng dữ liệu:
  1. `Orders` (Đơn hàng)
  2. `RMA / Returns` (Đổi trả & Hoàn tiền)
  3. `Loss / Reconciliation` (Hao hụt & Đối soát)
  4. `Ads` (Chiến dịch QC)
  5. `Finance` (Báo cáo Tài chính)
  6. `Analytics` (Chỉ số Cửa hàng)
- Tuyệt đối không suy diễn tính đầy đủ của Loss chỉ dựa vào việc có bản ghi trong `commerce_loss_ledger`.

### 1.5. Khả năng tương thích Môi trường CLI / PHP Resilience
- Xử lý tương thích chuỗi an toàn (`safe substring fallback`) khi tiện ích mở rộng `mbstring` chưa được nạp trong PHP CLI.
- Dependency injection token nội bộ qua `$this->resolveAccessToken()` tránh lỗi kết nối driver DB toàn cục khi chạy kiểm thử hoặc CLI worker.

---

## 2. DANH MỤC THÀNH PHẦN BÀN GIAO (DELIVERABLES)

| STT | Thành phần | Đường dẫn | Chức năng |
|:---:|---|---|---|
| 1 | **SQL Migration 015** | `database/migrations/20261005_015_widen_aftersales_reason_and_role.sql` | Mở rộng an toàn các cột `reason_code` (128), `reason_category` (255), `return_role` (64) |
| 2 | **SQL Rollback 015** | `database/migrations/20261005_015_rollback_widen_aftersales_reason_and_role.sql` | Kịch bản hoàn tác Migration 015 |
| 3 | **TikTok Shop Client** | `public/api/tiktok_client.php` | Bổ sung tham số `order_ids` vào `searchOrdersV2` và helper bounded `getOrdersByIds` |
| 4 | **Sync Service** | `public/api/commerce_sync_service.php` | Thêm `syncOrdersByIds` (bounded <= 50), tự động tính lại loss khi đơn hàng nạp mới, `resolveAccessToken` |
| 5 | **Aftersales Service** | `public/api/commerce_aftersales_service.php` | Phát hiện orphan RMA, kích hoạt khôi phục đơn hàng có giới hạn, hạ cấp trạng thái sang `PARTIAL` |
| 6 | **Loss Engine** | `public/api/commerce_loss_engine.php` | Dọn dẹp bản ghi loss cũ, tự động recompute loss khi có đơn hàng mới, null coalescence an toàn |
| 7 | **Sync Orchestrator** | `public/api/commerce_sync_orchestrator.php` | Bổ sung miền `loss`, quản lý độc lập 6 miền trong ma trận đồng bộ `getSyncHealth()` |
| 8 | **Reporting Service** | `public/api/commerce_reporting_service.php` | Áp dụng Realized Sales Trust Rule, theo dõi orphan RMA count/refund, báo cáo độc lập 6 miền |
| 9 | **Sync Management UI** | `src/CommerceSyncManagementView.jsx` | Hiển thị ma trận 6 miền độc lập (bổ sung Loss/Reconciliation) |
| 10 | **Report View UI** | `src/CommerceReportView.jsx` | Huy hiệu Trust Badge cho Doanh số thực, cảnh báo orphan RMA, Section VI 6 miền |
| 11 | **Prebuilt Dist Bundle** | `dist/index.html`, `dist/assets/*` | Bản build Vite sẵn sàng cho Production (KHÔNG cần npm build trên server) |
| 12 | **Automated Tests** | `tools/test_v2_04_1_production_acceptance_fix.cjs` | Bộ 9 bài kiểm tra tự động nghiệm thu sản xuất |

---

## 3. HƯỚNG DẪN THỰC THI MIGRATION 015 TRÊN PRODUCTION

### 3.1. Kiểm tra trước khi chạy (Preflight Check)
Kết nối MariaDB trên máy chủ production:
```sql
SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'commerce_aftersales'
  AND COLUMN_NAME IN ('reason_code', 'reason_category', 'return_role');
```

### 3.2. Chạy Migration 015
Thực thi file `database/migrations/20261005_015_widen_aftersales_reason_and_role.sql`:
```sql
-- Migration 015: Widen commerce_aftersales reason and role fields
ALTER TABLE `commerce_aftersales`
    MODIFY COLUMN `reason_code` VARCHAR(128) NULL DEFAULT NULL,
    MODIFY COLUMN `reason_category` VARCHAR(255) NULL DEFAULT NULL,
    MODIFY COLUMN `return_role` VARCHAR(64) NULL DEFAULT NULL;
```

### 3.3. Xác nhận sau khi chạy (Post-migration Verification)
```sql
SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'commerce_aftersales'
  AND COLUMN_NAME IN ('reason_code', 'reason_category', 'return_role');
```
*Kết quả kỳ vọng:*
- `reason_code`: `128`
- `reason_category`: `255`
- `return_role`: `64`

### 3.4. Kịch bản Rollback (khi cần hoàn tác)
Thực thi `database/migrations/20261005_015_rollback_widen_aftersales_reason_and_role.sql`:
```sql
ALTER TABLE `commerce_aftersales`
    MODIFY COLUMN `reason_code` VARCHAR(64) NULL DEFAULT NULL,
    MODIFY COLUMN `reason_category` VARCHAR(64) NULL DEFAULT NULL,
    MODIFY COLUMN `return_role` VARCHAR(32) NULL DEFAULT NULL;
```

---

## 4. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST REPORT)

Tất cả các bộ test kiểm thử chất lượng và hồi quy đều vượt qua 100%:

| Bộ kiểm thử | File kịch bản | Số test | Kết quả | Ghi chú |
|---|---|:---:|:---:|---|
| **V2-04.1 Production Acceptance Fix** | `tools/test_v2_04_1_production_acceptance_fix.cjs` | 9 | **9/9 PASS** (100%) | Orphan RMA, Bounded recovery, Trust rules, Migration 015 |
| **V2-04 Automated Sync Engine** | `tools/test_v2_04_sync_orchestrator_and_compact_ui.cjs` | 17 | **17/17 PASS** (100%) | Orchestrator, Hot/Warm/Matured windows, Compact UI |
| **V2-03.1 Reporting Data Trust** | `tools/test_v2_03_1_data_trust_and_coverage.cjs` | 12 | **12/12 PASS** (100%) | Baseline Sep 01-20, Ads 34M/383M, zero extrapolation |
| **V2-03 Reporting & Light UI** | `tools/test_v2_03_reporting_and_light_ui.cjs` | 19 | **19/19 PASS** (100%) | Invariants, Promotion split, Light UI |
| **V2-02.1 GMV Max Hardening** | `tools/test_v2_02_1_production_hardening.cjs` | 28 | **28/28 PASS** (100%) | API batching, Multi-grain reconciliation |
| **PHP Syntax Compilation** | `tools/verify_php_syntax.cjs` | 34 | **34/34 PASS** (100%) | Cú pháp PHP hợp lệ tuyệt đối trên toàn bộ mã nguồn |
| **TỔNG CỘNG** | | **119** | **119/119 PASS** | **ZERO REGRESSION** |

---

## 5. HƯỚNG DẪN DEPLOY TRÊN PRODUCTION (CHO QUẢN TRỊ VIÊN)

> [!IMPORTANT]
> **Tuân thủ cam kết an toàn:**
> - KHÔNG thực hiện auto-deploy tự động hoặc restart dịch vụ.
> - KHÔNG chạy `npm run build` trên máy chủ production (sử dụng bản prebuilt đã đóng gói sẵn trong thư mục `dist/`).
> - KHÔNG tạo dữ liệu giả lập (mock data).

### Các bước triển khai cho Ops:
1. **Sao lưu trước khi cập nhật:**
   ```bash
   cp -r /home/addp/domains/marketing.addp.vn/public_html /home/addp/backup_addp_$(date +%Y%m%d_%H%M%S)
   ```

2. **Chạy Migration 015 trên MariaDB:**
   ```bash
   mysql -u <user> -p <database> < database/migrations/20261005_015_widen_aftersales_reason_and_role.sql
   ```

3. **Giải nén gói release ZIP:**
   ```bash
   unzip -o release/task_v2_04_1_production_acceptance_release_<timestamp>.zip -d /home/addp/domains/marketing.addp.vn/public_html
   ```

4. **Xác nhận giao diện và trạng thái đồng bộ:**
   - Truy cập `https://marketing.addp.vn/`
   - Vào menu `HỆ THỐNG → Đồng bộ dữ liệu`: Xác nhận 6 miền dữ liệu hiển thị rõ ràng (`Orders`, `RMA`, `Loss`, `Ads`, `Finance`, `Analytics`).
   - Bấm nút `[Đồng bộ ngay]` cho miền `RMA / Returns` và `Đơn hàng`: Kiểm tra các đơn mồ côi đã được khôi phục và tính lại hao hụt thành công.
