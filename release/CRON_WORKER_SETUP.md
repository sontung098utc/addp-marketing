# HƯỚNG DẪN THIẾT LẬP CRON WORKER ĐỒNG BỘ NỀN & PHỤC HỒI TIẾN TRÌNH
(BACKGROUND RECONCILIATION CRON WORKER SETUP GUIDE)

**Hệ thống mục tiêu:** `https://marketing.addp.vn`  
**Tệp thực thi CLI:** `/home/[user]/public_html/tools/sync_worker_cli.php`  
**Kiến trúc:** Background Worker CLI / Cron → MySQL Named Lock (`GET_LOCK`) → Micro-batch API → MariaDB  
**Phiên bản:** `2.1.0-p0-webhook-dbfirst`  

---

## 1. Vai trò của Background Worker trong Kiến trúc Mới

Trong kiến trúc Database-First, người dùng khi mở Dashboard hoặc lọc ngày **tuyệt đối không kích hoạt kéo dữ liệu từ TikTok API**. Toàn bộ việc đồng bộ bù và đối soát được chuyển cho Background Worker thực hiện độc lập trong nền:

1. **Khắc phục lỗi treo 15 phút (Zero UI Blocking):** Việc đồng bộ diễn ra ở background process trên server, không gắn liền với phiên làm việc HTTP của người dùng trên trình duyệt.
2. **Khóa chống chạy trùng lặp (Cooperative Lock):** Sử dụng `GET_LOCK('addp_sync_lock_shop_[id]', 0)` của MariaDB để đảm bảo tại một thời điểm chỉ có duy nhất 1 tiến trình đồng bộ một shop. Nếu một worker khác đang chạy, cron mới sẽ tự động bỏ qua ngay lập tức mà không gây nghẽn tài nguyên.
3. **Phân đoạn xử lý (Micro-batching) & Checkpoint kiên cố:** Mỗi nhịp chỉ xử lý từng trang (page) với thời gian < 2 giây, lưu trữ `order_resume_token` vào bảng `commerce_sync_jobs`. Nếu có sự cố gián đoạn mạng, worker lần sau sẽ tiếp tục ngay tại checkpoint đã lưu thay vì đồng bộ lại từ đầu.
4. **Tự động phục hồi tiến trình treo (Stale Recovery):** Tự động phát hiện và giải phóng các job/run bị "treo" (stale) quá 30 phút do sự cố máy chủ hoặc quá tải trước đó.

---

## 2. Các chế độ hoạt động của Worker CLI

Worker CLI hỗ trợ các cờ lệnh thực thi linh hoạt:

| Cờ lệnh (Flag) | Mục đích | Tần suất khuyến nghị |
| :--- | :--- | :--- |
| `--cron` | Thực hiện đồng bộ bù định kỳ (Reconciliation). Chỉ quét khoảng thời gian gần nhất (3-7 ngày) để đối soát các đơn hàng có thể bị bỏ lỡ bởi webhook. | Chạy mỗi 15 phút một lần (`*/15 * * * *`) |
| `--recover-stale` | Quét bảng `commerce_sync_jobs` và `commerce_sync_runs` để phát hiện và đánh dấu thất bại/giải phóng các tiến trình bị treo quá thời hạn. | Chạy mỗi 60 phút một lần (`0 * * * *`) |
| `--status` | Kiểm tra tình trạng hàng đợi, trạng thái khóa `GET_LOCK` và tiến trình gần nhất mà không thực hiện đồng bộ. | Dùng cho quản trị viên kiểm tra thủ công qua SSH/Terminal. |
| `--all` | Thực hiện một chu kỳ đồng bộ đầy đủ cho các shop đang kích hoạt. | Dùng khi cần cưỡng bức đồng bộ toàn diện. |

---

## 3. Thiết lập Crontab trên Máy chủ Linux / cPanel

### A. Chuẩn bị thư mục chứa File Log
Trước khi cấu hình cron, tạo thư mục chứa log trên máy chủ:
```bash
mkdir -p /home/[user]/logs
chmod 755 /home/[user]/logs
```
*(Thay thế `[user]` bằng tên người dùng cPanel thực tế, ví dụ: `/home/marketingaddp/logs`).*

### B. Cấu hình Crontab qua lệnh `crontab -e`
Mở crontab bằng lệnh:
```bash
crontab -e
```
Thêm hai dòng sau vào cuối tệp:

```cron
# 1. Đồng bộ bù định kỳ TikTok Shop & Ads (Mỗi 15 phút)
*/15 * * * * /usr/local/bin/php -d memory_limit=256M /home/[user]/public_html/tools/sync_worker_cli.php --cron >> /home/[user]/logs/sync_cron.log 2>&1

# 2. Cơ chế giải phóng tiến trình treo & kiểm tra khóa (Mỗi giờ vào phút 00)
0 * * * * /usr/local/bin/php /home/[user]/public_html/tools/sync_worker_cli.php --recover-stale >> /home/[user]/logs/sync_stale.log 2>&1
```

*Lưu ý về đường dẫn PHP:*
- Trên cPanel, đường dẫn PHP 8.2 thường là: `/usr/local/bin/php` hoặc `/usr/local/bin/ea-php82`.
- Quản trị viên có thể kiểm tra đường dẫn chính xác bằng lệnh: `which ea-php82` hoặc `which php`.

---

## 4. Thiết lập qua Giao diện cPanel Cron Jobs (Không cần SSH)

Nếu quản trị viên không có quyền truy cập SSH, có thể thiết lập trực tiếp trên giao diện cPanel:

1. Đăng nhập vào **cPanel** của tên miền `marketing.addp.vn`.
2. Tìm đến mục **Advanced** → chọn **Cron Jobs** (Tác vụ Cron).
3. Tại mục **Add New Cron Job**:
   - **Tác vụ 1: Đồng bộ định kỳ (--cron)**
     - *Common Settings:* Chọn **Every 15 minutes (\*/15 \* \* \* \*)**.
     - *Command:*
       ```text
       /usr/local/bin/php -d memory_limit=256M /home/[user]/public_html/tools/sync_worker_cli.php --cron >> /home/[user]/logs/sync_cron.log 2>&1
       ```
     - Bấm **Add New Cron Job**.
   - **Tác vụ 2: Phục hồi tiến trình treo (--recover-stale)**
     - *Common Settings:* Chọn **Once Per Hour (0 \* \* \* \*)**.
     - *Command:*
       ```text
       /usr/local/bin/php /home/[user]/public_html/tools/sync_worker_cli.php --recover-stale >> /home/[user]/logs/sync_stale.log 2>&1
       ```
     - Bấm **Add New Cron Job**.

---

## 5. Cơ chế Xử lý Giới hạn Tần suất (Rate Limiting & Backoff)

Khi TikTok API phản hồi mã lỗi `HTTP 429 Too Many Requests`:
- Worker CLI tự động ghi nhận cảnh báo vào log.
- Áp dụng thuật toán **Exponential Backoff with Jitter**:
  $$T_{\text{wait}} = 2^{\text{attempt}} \times 1.5 + \text{random}(0, 1) \text{ giây}$$
- Tự động dừng chu kỳ hiện tại, bảo lưu checkpoint token trong MariaDB và giải phóng khóa `GET_LOCK` an toàn để không chiếm dụng thread server.
- Chu kỳ cron kế tiếp (sau 15 phút) sẽ tiếp tục chạy bình thường từ điểm dừng đó.

---

## 6. Kiểm tra Thực thi & Nghiệm thu Thủ công

Quản trị viên có thể kiểm tra trực tiếp tính năng của Worker bằng lệnh Terminal:

### 1. Kiểm tra trạng thái hiện tại:
```bash
php /home/[user]/public_html/tools/sync_worker_cli.php --status
```
*Kết quả kỳ vọng:* Hiển thị số lượng shop sẵn sàng, các job đang xử lý, và xác nhận không có xung đột khóa.

### 2. Chạy thử một chu kỳ đồng bộ nền:
```bash
php /home/[user]/public_html/tools/sync_worker_cli.php --cron
```
*Kết quả kỳ vọng:*
```text
[INFO] Starting TikTok Background Reconciliation Worker (CLI Mode)...
[INFO] Acquiring cooperative MySQL lock for active shops...
[INFO] Shop [shop_id]: Lock acquired. Checking checkpoint...
[INFO] Processing micro-batch orders page (Token: resume_xxx)...
[INFO] Upserted X orders into commerce_orders.
[INFO] Releasing MySQL cooperative lock. Done.
```

### 3. Kiểm tra tệp Log vận hành:
```bash
tail -n 50 /home/[user]/logs/sync_cron.log
```

---

## 7. Quản lý Dung lượng & Xoay vòng Log (Log Rotation)

Để tránh tệp log phình to theo thời gian:
1. Có thể thêm tác vụ cron hàng tháng để dọn dẹp log cũ hơn 30 ngày:
   ```cron
   0 0 1 * * find /home/[user]/logs/ -name "*.log" -mtime +30 -delete
   ```
2. Hoặc cấu hình logrotate tiêu chuẩn của Linux để giới hạn mỗi file tối đa 20MB.
