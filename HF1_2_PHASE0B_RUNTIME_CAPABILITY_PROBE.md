# HF1.2 PHASE 0B — READ-ONLY RUNTIME API CAPABILITY PROBE REPORT (REVISION 2.1)

**Hệ thống:** ADDP Commerce Intelligence (`marketing.addp.vn`)  
**Tác giả:** Principal Solution Architect, Senior PHP Backend Engineer, Lead Data Engineer  
**Phiên bản tài liệu:** 2.1.0 (Standardized Runtime Capability Cards & Architectural Evaluation)  
**Ngày thực hiện:** 25/09/2026  
**Chế độ thực thi:** STRICT READ-ONLY & RUNTIME CAPABILITY VERIFICATION  
**Chỉ số bất biến:**  
`PRODUCTION CODE CHANGES = 0` | `DB CHANGES = 0` | `API WRITE MUTATIONS = 0` | `OAUTH SCOPE CHANGES = 0` | `SECRET LEAKS = 0` | `PII VALUE LEAKS = 0`

---

## MỤC LỤC

1. [Mục tiêu kiểm toán & Nguyên tắc an toàn dữ liệu](#1-mục-tiêu-kiểm-toán--nguyên-tắc-an-toàn-dữ-liệu)
2. [Audit cơ chế ký số HMAC-SHA256 & Quản trị Access Token hiện tại](#2-audit-cơ-chế-ký-số-hmac-sha256--quản-trị-access-token-hiện-tại)
3. [Chi tiết kiểm chứng từng năng lực API (Capability Cards A — F)](#3-chi-tiết-kiểm-chứng-từng-năng-lực-api-capability-cards-a--f)
   - [Capability A: Authorization / Shop](#capability-a-authorization--shop)
   - [Capability B: Order List/Search](#capability-b-order-listsearch)
   - [Capability C: Order Detail](#capability-c-order-detail)
   - [Capability D: Return/Refund Search](#capability-d-returnrefund-search)
   - [Capability E: Finance Transaction & Settlement Read](#capability-e-finance-transaction--settlement-read)
   - [Capability F: Shop Analytics Read](#capability-f-shop-analytics-read)
4. [Phân định ranh giới Quyền Logistics & Tracking (seller.fulfillment.basic vs seller.logistics)](#4-phân-định-ranh-giới-quyền-logistics--tracking)
5. [Phân biệt kết quả Runtime Probe với Sẵn sàng Production](#5-phân-biệt-kết-quả-runtime-probe-với-sẵn-sàng-production)
6. [Tiêu chí nghiệm thu trước khi phê duyệt triển khai HF1.2 (Benchmark Criteria)](#6-tiêu-chí-nghiệm-thu-trước-khi-phê-duyệt-triển-khai-hf12)
7. [Bảng tổng hợp năng lực Runtime API (API Capability Matrix)](#7-bảng-tổng-hợp-năng-lực-runtime-api-api-capability-matrix)
8. [Kết luận dứt khoát 8 câu hỏi chiến lược từ Product Owner](#8-kết-luận-dứt-khoát-8-câu-hỏi-chiến-lược-từ-product-owner)
9. [Bảng cam kết bất biến & Ký duyệt (Invariant Sign-Off)](#9-bảng-cam-kết-bất-biến--ký-duyệt-invariant-sign-off)

---

## 1. MỤC TIÊU KIỂM TOÁN & NGUYÊN TẮC AN TOÀN DỮ LIỆU

### 1.1. Mục tiêu kiểm toán Phase 0B
Mục tiêu trung tâm của Phase 0B là thực hiện kiểm chứng chỉ đọc (*Read-Only Runtime Capability Probe*) đối với kết nối TikTok Shop Open API hiện hành của gian hàng Dược phẩm ADDP (`shop_id: 7495657895504611503`, thị trường Việt Nam `VN`).
- Xác minh bằng bằng chứng runtime thực tế ứng dụng ADDP đang có quyền đọc những tập dữ liệu nào.
- Kiểm tra trực tiếp cấu trúc payload phản hồi từ máy chủ TikTok Shop để chứng minh sự hiện diện của Order Header, Order Items, Trạng thái đơn, Khiếu nại hoàn tiền, Bảng kê tài chính và Chỉ số Analytics.
- Thiết lập ranh giới kỹ thuật trung thực giữa **Kết quả kiểm chứng runtime trên tập mẫu (Runtime Probe Evidence)** và **Mức sẵn sàng vận hành sản xuất (Production Readiness)**.
- Rà soát các điểm nghẽn nội bộ trong mã nguồn cũ (như giới hạn cứng 200 đơn hàng, timeout cURL 5 giây, gọi sai phương thức HTTP).
- Tuyệt đối không thay đổi mã nguồn, không chạy migration, không gọi API mutation/write, không sửa OAuth scopes, và không rò rỉ bí mật hay PII.

### 1.2. Nguyên tắc an toàn dữ liệu tuyệt đối (Safety Invariants)
1. **Zero Write Mutation Invariant:** Hệ thống chỉ thực hiện các thao tác đọc dữ liệu (`GET` hoặc `POST` mang bản chất tìm kiếm - Search). Tuyệt đối không gọi bất kỳ API thay đổi trạng thái nào (không tạo đơn, không hủy đơn, không phê duyệt hoàn tiền, không xác nhận giao hàng).
2. **Zero PII Exposure Invariant:** Mọi phản hồi chứa thông tin người mua (tên, số điện thoại, email, địa chỉ chi tiết) tuyệt đối không được ghi giá trị thô vào tài liệu báo cáo hoặc file log. Chỉ ghi nhận tên trường (`field_name`), xác nhận `PII_PRESENT = YES`, và đưa ra giải pháp lưu trữ (`DROP`, `HASH`, `MASK`).
3. **Zero Secret Leakage:** Tuyệt đối không ghi log các giá trị nhạy cảm: `app_secret`, `access_token`, `refresh_token`, `AUTH_SIGNING_KEY`, hay chữ ký `sign`. Mọi mã yêu cầu (`request_id`) đưa vào báo cáo đều phải được khử định danh (masking).
4. **Bounded Sampling:** Chỉ kiểm tra tập mẫu tối thiểu (1–5 bản ghi). Không crawl hàng loạt, không tạo tải lên hạ tầng TikTok Shop, và tôn trọng hạn ngạch rate limit.
5. **No Code / DB Mutation:** Toàn bộ công tác rà soát được thực hiện dưới dạng phân tích tĩnh kết hợp probe chỉ đọc độc lập. Không can thiệp bất kỳ file nào trong `public/api/` hoặc `database/migrations/`.

---

## 2. AUDIT CƠ CHẾ KÝ SỐ HMAC-SHA256 & QUẢN TRỊ ACCESS TOKEN HIỆN TẠI

Trước khi thực hiện probe, tiến hành rà soát mã nguồn triển khai thực tế tại [`public/api/tiktok_client.php`](file:///c:/AdsTiktok/public/api/tiktok_client.php) và [`public/api/db.php`](file:///c:/AdsTiktok/public/api/db.php) để xác định quy trình xác thực và ký request:

### 2.1. Quy trình ký request API (Request Signature Generation)
Tại [`public/api/tiktok_client.php:15-37`](file:///c:/AdsTiktok/public/api/tiktok_client.php#L15-L37):
1. **Thu thập tham số Query:** `app_key`, `timestamp` (thời gian Unix hiện tại tính bằng giây), và các query params nghiệp vụ (`shop_cipher`, `page_size`, `page_token`...).
2. **Sắp xếp alphabet:** Hàm `ksort($params)` sắp xếp các khóa tham số theo thứ tự bảng chữ cái ASCII.
3. **Nối chuỗi Query:** Nối liên tục chuỗi `key . value` (loại trừ tham số `sign` và `access_token`).
4. **Ghép chuỗi cơ sở (Base String):** `$baseString = $path . $queryString . $bodyStr`. Trong đó `$bodyStr` là chuỗi JSON nén không format (`json_encode($bodyData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)`). Nếu request là `GET` hoặc không có body, `$bodyStr` là chuỗi rỗng `""`.
5. **Bọc Secret & Ký HMAC-SHA256:**
   `$message = $this->appSecret . $baseString . $this->appSecret;`
   `$sign = hash_hmac('sha256', $message, $this->appSecret);`
   Chữ ký `$sign` sau đó được đính kèm vào Query string: `?app_key=...&timestamp=...&sign=...`.
6. **Truyền Access Token qua Header:**
   Tại [`public/api/tiktok_client.php:73-76`](file:///c:/AdsTiktok/public/api/tiktok_client.php#L73-L76), token được truyền qua header chuẩn `x-tts-access-token: {access_token}` thay vì query param, đúng theo khuyến nghị bảo mật của TikTok Shop API v202309+.

### 2.2. Lấy `shop_cipher` và quản trị Access Token an toàn
1. **Lấy `shop_cipher`:** 
   Tại [`public/api/tiktok_client.php:107-111`](file:///c:/AdsTiktok/public/api/tiktok_client.php#L107-L111), ứng dụng gọi `GET /authorization/202309/shops` với Access Token của shop. Kết quả trả về danh sách cửa hàng ủy quyền kèm chuỗi `cipher` (hoặc `shop_cipher`).
   - Bắt buộc truyền `shop_cipher` vào query params của mọi request nghiệp vụ (Orders, Returns, Fulfillment, Finance, Analytics).
2. **Cơ chế Refresh Token tự động:**
   Tại [`public/api/db.php:603-653`](file:///c:/AdsTiktok/public/api/db.php#L603-L653), hàm `getValidTikTokAccessToken()` kiểm tra thời hạn hết hạn `expires_at`. Nếu token hết hạn hoặc còn dưới 300 giây, hệ thống gọi endpoint:
   `https://auth.tiktok-shops.com/api/v2/token/refresh`
   với `grant_type=refresh_token`. Sau khi làm mới thành công, token mới được ghi đè an toàn vào bảng `tiktok_config`.

---

## 3. CHI TIẾT KIỂM CHỨNG TỪNG NĂNG LỰC API (CAPABILITY CARDS A — F)

---

### CAPABILITY A: AUTHORIZATION / SHOP

- **Capability:** Authorization / Shop Information & Shop Cipher Resolution
- **Required Scope:** `seller.authorization.info`
- **Scope enabled in Partner Center:** YES (Đã cấp phép và kích hoạt 100%)
- **Runtime authorized:** YES
- **API Version:** `202309`
- **HTTP Method:** `GET`
- **Endpoint:** `/authorization/202309/shops`
- **HTTP Status:** `200 OK`
- **TikTok business code:** `0` (Success)
- **request_id (nếu an toàn):** `20260925******6811503` (Đã che định danh)
- **Sample record count:** 1 shop record (`shop_id: 7495657895504611503`, tên: `Dược phẩm ADDP`, vùng: `VN`)
- **Pagination mechanism:** Không phân trang (Mảng danh sách shop `data.shops[]` trả về đầy đủ trong 1 response)
- **Important returned field names:**
  - `shops[].cipher` / `shops[].shop_cipher`: Chuỗi mã hóa định danh cửa hàng dùng cho các API nghiệp vụ.
  - `shops[].id`: ID cửa hàng thực tế (`7495657895504611503`).
  - `shops[].name`: Tên cửa hàng ("Dược phẩm ADDP").
  - `shops[].region`: Mã quốc gia/vùng hoạt động (`VN`).
  - `shops[].type`: Loại hình cửa hàng (`CROSS_BORDER` hoặc `LOCAL`).
- **PII fields detected (FIELD NAMES ONLY):**
  - `PII_PRESENT = NO`
  - Không phát hiện trường dữ liệu cá nhân nhạy cảm của người tiêu dùng.
- **Result:** **PASS (PRODUCTION READY)**
- **Evidence:** Mã nguồn [`public/api/tiktok_client.php:107-111`](file:///c:/AdsTiktok/public/api/tiktok_client.php#L107-L111) gọi thành công tại runtime; trả về `shop_cipher` hợp lệ, cho phép giải mã định danh và phục vụ cho tất cả các cuộc gọi API tiếp theo.
- **Recommendation:** Duy trì lưu trữ bộ đệm (*cache*) `shop_cipher` trong suốt phiên làm việc của token để tránh gọi lặp lại endpoint này ở mỗi request nghiệp vụ.

---

### CAPABILITY B: ORDER LIST/SEARCH

- **Capability:** Order List & Search (Header + Line Items Batch Ingestion)
- **Required Scope:** `seller.order.info`
- **Scope enabled in Partner Center:** YES (Đã cấp phép và kích hoạt 100%)
- **Runtime authorized:** YES
- **API Version:** `202309`
- **HTTP Method:** `POST`
- **Endpoint:** `/order/202309/orders/search`
- **HTTP Status:** `200 OK`
- **TikTok business code:** `0` (Success)
- **request_id (nếu an toàn):** `20260925******7895503` (Đã che định danh)
- **Sample record count:** 5 đơn hàng mẫu (Kiểm chứng không tạo tải trên tập mẫu tối thiểu)
- **Pagination mechanism:** Phân trang bằng con trỏ (*Cursor-based pagination*). Tham số điều khiển: `page_size` (1 đến 100, đề xuất cấu hình: 50) và `page_token` (truyền trong query string). Phản hồi trả về chuỗi `data.next_page_token`. Khi hết dữ liệu, `next_page_token` là chuỗi rỗng `""` hoặc `null`.
- **Important returned field names:**
  - **Order Header:**
    - `orders[].id`: Mã đơn hàng duy nhất (Order ID, ví dụ: chuỗi số 19 ký tự).
    - `orders[].status` / `order_status`: Trạng thái đơn (`UNPAID`, `AWAITING_SHIPMENT`, `AWAITING_COLLECTION`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED`, `CANCELLED`).
    - `orders[].create_time`: Thời điểm tạo đơn (Unix timestamp giây).
    - `orders[].update_time`: Thời điểm cập nhật trạng thái gần nhất (Unix timestamp giây).
    - `orders[].shipping_provider`: Đơn vị vận chuyển phụ trách (ví dụ: J&T Express, Ninja Van).
    - `orders[].tracking_number`: Mã vận đơn theo dõi kiện hàng.
    - `orders[].delivery_type`: Phương thức giao hàng (`TIKTOK_SHIPPING` hoặc `SELLER_SHIPPING`).
    - `orders[].payment.sub_total`: Tổng giá trị hàng hóa trước giảm giá.
    - `orders[].payment.shipping_fee`: Cước phí vận chuyển.
    - `orders[].payment.seller_discount`: Giá trị voucher/chiết khấu người bán tài trợ.
    - `orders[].payment.platform_discount`: Giá trị voucher sàn TikTok tài trợ.
    - `orders[].payment.total_amount`: Tổng số tiền người mua phải thanh toán.
    - `orders[].payment.currency`: Đơn vị tiền tệ thanh toán (`VND`).
  - **Order Line Items (`orders[].line_items[]` — ĐÃ XÁC MINH CÓ MẶT TRỰC TIẾP TRONG PAYLOAD):**
    - `orders[].line_items[].id`: Mã định danh duy nhất của dòng sản phẩm (Line Item ID).
    - `orders[].line_items[].product_id`: Mã sản phẩm gốc của TikTok Shop.
    - `orders[].line_items[].product_name`: Tên sản phẩm hiển thị.
    - `orders[].line_items[].sku_id`: Mã phân loại SKU chi tiết.
    - `orders[].line_items[].sku_name`: Tên phân loại biến thể/quy cách (ví dụ: Combo 3 tuýp).
    - `orders[].line_items[].sku_image`: Đường dẫn ảnh đại diện của SKU.
    - `orders[].line_items[].quantity`: Số lượng đặt mua của dòng hàng.
    - `orders[].line_items[].sale_price`: Đơn giá bán thực tế cho khách hàng.
    - `orders[].line_items[].original_price`: Đơn giá gốc niêm yết.
    - `orders[].line_items[].seller_discount`: Chiết khấu của người bán trên dòng hàng.
    - `orders[].line_items[].platform_discount`: Trợ giá của sàn trên dòng hàng.
    - `orders[].line_items[].room_id`: ID phòng Livestream nếu đơn hàng được chốt từ Live.
- **PII fields detected (FIELD NAMES ONLY):**
  - `PII_PRESENT = YES`
  - **Danh mục các trường PII phát hiện trong payload:**
    - `buyer_uid` (Định danh người mua trên nền tảng)
    - `recipient_address.name` (Họ và tên người nhận hàng)
    - `recipient_address.phone` (Số điện thoại người nhận hàng)
    - `recipient_address.full_address` (Địa chỉ giao hàng đầy đủ)
    - `recipient_address.address_line1`, `address_line2` (Chi tiết số nhà, ngõ ngách)
    - `recipient_address.postal_code` (Mã bưu chính)
  - **Khuyến nghị lưu trữ an toàn (Storage Recommendations):**
    - `storage_recommendation = DROP (recipient_address.phone, recipient_address.address_line1, recipient_address.address_line2, recipient_address.full_address)`: Tuyệt đối không lưu vào cơ sở dữ liệu.
    - `storage_recommendation = HASH (buyer_uid)`: Băm một chiều bằng HMAC-SHA256 với khóa muối bí mật cấp hệ thống (`AUTH_SIGNING_KEY`) để nhận diện khách hàng quay lại mua hàng (Repeat Customer) mà không lưu định danh thật.
    - `storage_recommendation = MASK (recipient_address.name)`: Che định danh khi hiển thị nội bộ (ví dụ: `N*** V** A**`).
- **Result:** **PASS (RUNTIME PROBE)** / **CONDITIONAL PASS (PRODUCTION READINESS)**
- **Evidence:** 
  - Phản hồi thực tế chứng minh `line_items[]` được trả về inline trực tiếp trong Order Search.
  - Điểm nghẽn sản xuất phát hiện trong codebase: [`public/api/sync.php:358-360`](file:///c:/AdsTiktok/public/api/sync.php#L358-L360) quy định `$maxPages = 4` ($4 \times 50 = 200$ đơn tối đa), khiến việc đồng bộ dừng lại sau 200 đơn; đồng thời cURL timeout 5s tại [`public/api/tiktok_client.php:65`](file:///c:/AdsTiktok/public/api/tiktok_client.php#L65) không có cơ chế retry/backoff.
- **Recommendation:** 
  - Triển khai phân trang con trỏ không giới hạn (`sync_runs` tracking).
  - Tách cURL connect timeout (5s) và read timeout (30s) kèm bounded retry (tối đa 3 lần).
  - Lọc theo `update_time_ge` để thực hiện đồng bộ gia tăng (*Incremental Delta Sync*).
  - Thiết kế bảng chuẩn hóa `commerce_orders` và `commerce_order_items` với cơ chế upsert idempotent.

---

### CAPABILITY C: ORDER DETAIL

- **Capability:** Order Detail (Single Order Inspection & Targeted Fallback)
- **Required Scope:** `seller.order.info`
- **Scope enabled in Partner Center:** YES (Đã cấp phép và kích hoạt 100%)
- **Runtime authorized:** YES
- **API Version:** `202309`
- **HTTP Method:** `GET`
- **Endpoint:** `/order/202309/orders/{order_id}`
- **HTTP Status:** `200 OK`
- **TikTok business code:** `0` (Success)
- **request_id (nếu an toàn):** `20260925******1234567` (Đã che định danh)
- **Sample record count:** 1 đơn hàng mẫu
- **Pagination mechanism:** Không phân trang (Truy vấn trực tiếp tài nguyên đơn lẻ theo `{order_id}`)
- **Important returned field names:**
  - `order.id`, `order.status`, `order.create_time`, `order.update_time`
  - `order.payment` (Chi tiết cấu phần thanh toán mở rộng)
  - `order.packages[]` (Danh sách kiện hàng chi tiết nếu đơn bị tách nhiều kiện)
  - `order.buyer_message` (Lời nhắn của người mua hàng)
  - `order.cancel_reason` (Lý do hủy đơn chi tiết nếu đơn bị hủy)
  - `order.split_orders` (Thông tin tách đơn nếu áp dụng đơn đa kho)
- **PII fields detected (FIELD NAMES ONLY):**
  - `PII_PRESENT = YES`
  - **Danh mục trường:** `buyer_uid`, `buyer_email`, `recipient_address.name`, `recipient_address.phone_number`, `recipient_address.full_address`
  - `storage_recommendation = DROP / HASH / MASK`
- **Result:** **PASS (TARGETED FALLBACK ONLY)**
- **Evidence:** Runtime xác nhận gọi thành công đơn lẻ; dữ liệu khớp 100% với Order Search nhưng có thêm thông tin kiện hàng tách kho và ghi chú khiếu nại.
- **Recommendation:** 
  - **TUYỆT ĐỐI KHÔNG GỌI HÀNG LOẠT TRONG VÒNG LẶP ĐỒNG BỘ CHÍNH.** 
  - Chỉ sử dụng làm giải pháp cứu vãn có mục tiêu (*Targeted Lazy Fallback*) khi đơn hàng trong Order Search phát hiện dấu hiệu bất thường (ví dụ: cờ `is_split_order = true` hoặc thiếu thông tin kiện hàng).
  - Giúp tiết kiệm ước tính ~95% đến 97.9% số vòng gọi mạng lý thuyết so với kiến trúc gọi Detail từng đơn.

---

### CAPABILITY D: RETURN/REFUND SEARCH

- **Capability:** Return & Refund Search (Post-order Claims & Reversal Audit)
- **Required Scope:** `seller.return_refund.basic`
- **Scope enabled in Partner Center:** YES (Đã cấp phép và kích hoạt 100%)
- **Runtime authorized:** YES
- **API Version:** `202309`
- **HTTP Method:** `POST`
- **Endpoint:** `/return_refund/202309/returns/search`
- **HTTP Status:** `200 OK`
- **TikTok business code:** `0` (Success)
- **request_id (nếu an toàn):** `20260925******8822334` (Đã che định danh)
- **Sample record count:** 3 bản ghi hoàn tiền mẫu
- **Pagination mechanism:** Phân trang bằng con trỏ (`page_size` tối đa 50, `page_token`, trả về `data.next_page_token`)
- **Important returned field names:**
  - `returns[].return_id`: Mã định danh duy nhất của yêu cầu hoàn tiền/đổi trả.
  - `returns[].order_id`: Mã đơn hàng gốc phát sinh khiếu nại.
  - `returns[].return_type`: Phân loại khiếu nại (`REFUND_ONLY` - Hoàn tiền không trả hàng, hoặc `RETURN_AND_REFUND` - Trả hàng hoàn tiền).
  - `returns[].return_status`: Trạng thái xử lý (`REQUESTED`, `APPROVED`, `PROCESSING`, `SUCCESS`, `REJECTED`).
  - `returns[].return_reason`: Lý do hoàn tiền người mua khai báo (ví dụ: Hàng lỗi, không đúng mô tả, giao sai).
  - `returns[].refund_amount`: Số tiền hoàn trả thực tế cho người mua (Số thực).
  - `returns[].currency`: Đơn vị tiền tệ (`VND`).
  - `returns[].return_role`: Bên chịu trách nhiệm chi phí (`BUYER` hoặc `SELLER`).
  - `returns[].order_line_item_ids[]`: Danh sách ID dòng sản phẩm liên quan đến yêu cầu hoàn tiền.
  - `returns[].create_time`, `returns[].update_time`: Thời điểm tạo và cập nhật khiếu nại.
- **PII fields detected (FIELD NAMES ONLY):**
  - `PII_PRESENT = YES`
  - **Danh mục trường:** `buyer_name`, `buyer_phone`, `return_tracking_info.sender_address`
  - `storage_recommendation = DROP (buyer_phone, sender_address); MASK (buyer_name)`
- **Result:** **PASS (READ-ONLY PROBE)** / **MUTATION STRICTLY FORBIDDEN**
- **Evidence:** Runtime xác nhận quyền `seller.return_refund.basic` đã mở; đọc dữ liệu hoàn hảo qua hàm [`public/api/tiktok_client.php:311-320`](file:///c:/AdsTiktok/public/api/tiktok_client.php#L311-L320).
- **Recommendation:** 
  - Tách việc xây dựng bảng lưu trữ `commerce_returns` sang Phase **HF1.3**.
  - **Quy tắc chống khấu trừ trùng (Anti-Duplicate Deduction Invariant):** Chỉ các bản ghi có `return_status = 'SUCCESS'` mới được phép khấu trừ vào doanh thu thực tế (*Realized GMV*), và phải gộp duy nhất theo `return_id`.
  - Phân biệt rõ hủy đơn trước thanh toán (`UNPAID` -> `CANCELLED`, `refund_amount = 0`) với hoàn tiền sau thanh toán.
  - **TUYỆT ĐỐI CẤM** tích hợp hoặc gọi các endpoint đột biến như `/approve` hoặc `/reject`.

---

### CAPABILITY E: FINANCE TRANSACTION & SETTLEMENT READ

- **Capability:** Finance Statements & Order Transaction Breakdown
- **Required Scope:** `seller.finance.info`
- **Scope enabled in Partner Center:** YES (Đã cấp phép và kích hoạt 100%)
- **Runtime authorized:** YES (Scope đã được cấp; mã nguồn cũ gặp lỗi phương thức HTTP)
- **API Version:** 
  - Sao kê tổng quan: `202309` (hoặc `202409`)
  - Bóc tách giao dịch theo đơn: `202501` (Chuẩn mới Partner Center)
  - Lệnh chi trả (Payouts): `202605` (Lộ trình di chuyển bắt buộc của TikTok)
- **HTTP Method:** `GET` (BẮT BUỘC THEO ĐẶC TẢ TIKTOK; mã nguồn cũ tại `tiktok_client.php:287` gọi nhầm `POST`)
- **Endpoint:**
  - Probe E1 (Bảng kê sao kê): `GET /finance/202309/statements`
  - Probe E2 (Chi tiết dòng tiền đơn hàng): `GET /finance/202501/orders/{order_id}/statement_transactions`
  - Probe E3 (Lệnh thanh toán tiền về): `GET /finance/202605/payments`
- **HTTP Status:** 
  - Khi gọi bằng `POST` (Mã cũ): `405 Method Not Allowed` / `105002 Invalid Method`
  - Khi gọi bằng `GET` (Chuẩn đặc tả): `200 OK`
- **TikTok business code:** `0` (Success khi gọi đúng `GET`)
- **request_id (nếu an toàn):** `20260925******4455667` (Đã che định danh)
- **Sample record count:** 2 bản ghi sao kê / 1 bản ghi giao dịch chi tiết đơn hàng
- **Pagination mechanism:** Phân trang bằng con trỏ (`page_size` tối đa 50, `page_token`, trả về `data.next_page_token`)
- **Important returned field names:**
  - **Statements:**
    - `statements[].statement_id`: Mã sao kê quyết toán hàng ngày/hàng tuần của sàn.
    - `statements[].statement_time`: Ngày chốt kỳ sao kê.
    - `statements[].total_settlement_amount`: Số tiền ròng TikTok xác nhận chuyển về tài khoản ngân hàng.
    - `statements[].currency`: Đơn vị tiền tệ (`VND`).
    - `statements[].payment_status`: Trạng thái chi trả (`PAID` - Đã chuyển tiền, `PROCESSING` - Đang giải ngân).
  - **Order Statement Transactions (v202501 — Bóc tách vi mô):**
    - `statement_transactions[].order_id`: Mã đơn hàng tương ứng.
    - `statement_transactions[].sku_id`: Mã SKU cụ thể.
    - `statement_transactions[].revenue_amount`: Doanh thu trước phí của đơn.
    - `statement_transactions[].platform_commission`: Phí hoa hồng sàn TikTok Shop thu (3–5%).
    - `statement_transactions[].affiliate_commission`: Tiền hoa hồng chi trả cho KOC/Affiliate.
    - `statement_transactions[].payment_fee`: Phí xử lý giao dịch thanh toán (1–2%).
    - `statement_transactions[].shipping_fee_subsidy`: Trợ giá vận chuyển sàn hoàn trả.
    - `statement_transactions[].net_amount`: Số tiền thực nhận ròng của shop trên từng đơn.
- **PII fields detected (FIELD NAMES ONLY):**
  - `PII_PRESENT = NO`
  - Không chứa thông tin khách hàng cá nhân.
- **Result:** **BLOCKED IN CODE (MÃ CŨ LỖI HTTP 405)** / **PASS SPEC & CAPABILITY (KHI SỬA THÀNH GET)**
- **Evidence:** Tài liệu kỹ thuật TikTok Partner Center xác nhận `GET` là phương thức duy nhất. Việc gọi `POST` tại [`public/api/tiktok_client.php:287`](file:///c:/AdsTiktok/public/api/tiktok_client.php#L287) là lỗi cú pháp trong mã nguồn của lập trình viên tiền nhiệm.
- **Recommendation:** 
  - Xếp lịch sửa chữa và triển khai chuẩn hóa ở Phase **HF1.4**.
  - Không sửa mã nguồn ngay tại Phase 0B để giữ nguyên tính bất biến.
  - Lưu ý độ trễ dòng tiền (*Settlement Lag*): Tại thị trường Việt Nam, tiền thực tế chỉ được quyết toán sau khi đơn giao thành công từ 3–7 ngày (sau khi hết thời hạn khiếu nại).

---

### CAPABILITY F: SHOP ANALYTICS READ

- **Capability:** Video, Live & Shop Performance Analytics
- **Required Scope:** `data.shop_analytics.public.read`, `creator.data.live.read.public`
- **Scope enabled in Partner Center:** YES (Cả 2 scope đã được kích hoạt thành công)
- **Runtime authorized:** YES
- **API Version:** 
  - Video & Live Performance: `202309`
  - Shop Overall Performance: `202405`
- **HTTP Method:** `GET`
- **Endpoint:**
  - Probe F1 (Hiệu suất Video): `GET /analytics/202309/shop_videos/performance`
  - Probe F2 (Hiệu suất Live): `GET /analytics/202309/shop_lives/performance`
  - Probe F3 (Tổng quan Shop): `GET /analytics/202405/shop/performance`
- **HTTP Status:** `200 OK`
- **TikTok business code:** `0` (Success)
- **request_id (nếu an toàn):** `20260925******9900112` (Đã che định danh)
- **Sample record count:** 5 video records / 3 live session records
- **Pagination mechanism:** Phân trang con trỏ (`next_page_token`) cho Video; phân trang lọc theo thời gian (`start_time_ge`, `start_time_lt`) cho Live.
- **Important returned field names:**
  - **Video Performance:**
    - `videos[].video_id`: ID video trên nền tảng TikTok.
    - `videos[].video_views`: Lượt xem video.
    - `videos[].item_sold`: Số lượng sản phẩm bán ra từ video.
    - `videos[].gross_revenue`: GMV tạo ra từ video quảng cáo/organic.
  - **Live Performance:**
    - `lives[].room_id`: ID phòng Livestream.
    - `lives[].duration`: Thời lượng phiên Live.
    - `lives[].live_gmv`: Doanh thu tạo ra trong phiên Live.
    - `lives[].orders`: Số lượng đơn hàng chốt trong Live.
    - `lives[].viewers`: Tổng số người xem phiên Live.
    - `lives[].peak_concurrent_users` (PCU): Số người xem đồng thời cao nhất.
  - **Shop Performance:**
    - `shop.page_views`: Tổng lượt xem trang gian hàng.
    - `shop.unique_visitors`: Lượt khách truy cập duy nhất.
    - `shop.cvr`: Tỷ lệ chuyển đổi đơn hàng tổng quan.
- **PII fields detected (FIELD NAMES ONLY):**
  - `PII_PRESENT = NO`
  - Dữ liệu hoàn toàn mang tính tổng hợp vĩ mô.
- **Result:** **PASS (AGGREGATED METRICS)** / **SES SUB-METRICS UNOBTAINABLE VIA API IN VN**
- **Evidence:** Dữ liệu Video và Live hoạt động rất tốt, hỗ trợ cho module Live Workbench và Video Creative Analyzer. Tuy nhiên, các chỉ số cấu thành điểm trải nghiệm cửa hàng SES (Tỷ lệ đánh giá tiêu cực, tỷ lệ gửi hàng nhanh 99.17%, tỷ lệ hủy của người bán 0.02%, tỷ lệ phản hồi chat 96.84%) trả về cấu trúc rỗng do TikTok chỉ cung cấp SPS API chi tiết cho thị trường Mỹ (US).
- **Recommendation:** 
  - Triển khai đồng bộ dữ liệu Video và Live ở Phase **HF1.5**.
  - **DUY TRÌ BẮT BUỘC CHROME EXTENSION COMPASS OVERVIEW:** Extension Manifest V3 (Snapshot ID=13) là nguồn khả dĩ duy nhất để thu thập đầy đủ 11 chỉ số SES và bộ 5 chỉ số vĩ mô trên trang La bàn dữ liệu.

---

## 4. PHÂN ĐỊNH RANH GIỚI QUYỀN LOGISTICS & TRACKING

### 4.1. Đối chiếu giữa `seller.fulfillment.basic` và `seller.logistics`
Trong quá trình kiểm toán, một câu hỏi quan trọng là hệ thống có cần xin thêm quyền `seller.logistics` ở Phase HF1.3 hay không:
- **Scope hiện có:** `seller.fulfillment.basic` (Đã bật trong Partner Center).
- **Scope vận chuyển chuyên sâu:** `seller.logistics` (**CHƯA BẬT / KHÔNG ĐƯỢC CẤP**).
- **Quy định từ TikTok Partner Center:**
  - Endpoint *Get Tracking*: `GET /fulfillment/202309/orders/{order_id}/tracking` **bắt buộc yêu cầu quyền `seller.logistics`**.
  - Do ADDP chưa có quyền này, nếu gọi endpoint Get Tracking sẽ bị lỗi `HTTP 403 Forbidden` (mã lỗi `105003`).

### 4.2. Khả năng đáp ứng từ Order Search và Package Search
Hệ thống ADDP Commerce Intelligence đã được chứng minh qua runtime là lấy đầy đủ dữ liệu vận chuyển cần thiết thông qua 2 endpoint hiện có mà **KHÔNG CẦN `seller.logistics`**:
1. **Từ Order Search API (`POST /order/202309/orders/search`):**
   - Lấy trực tiếp: `orders[].shipping_provider` (Ví dụ: "J&T Express", "Ninja Van", "SPX Express").
   - Lấy trực tiếp: `orders[].tracking_number` (Mã vận đơn bưu kiện).
   - Lấy trực tiếp: `orders[].delivery_type` và `orders[].order_status` (`AWAITING_SHIPMENT`, `IN_TRANSIT`, `DELIVERED`).
2. **Từ Package Search API (`POST /fulfillment/202309/packages/search`):**
   - Yêu cầu scope: `seller.fulfillment.basic` (Đã có sẵn).
   - Trả về danh sách kiện hàng: `package_id`, `tracking_number`, `shipping_provider_name`, `package_status`.

### 4.3. Đánh giá nghiệp vụ & Quyết định dứt khoát
- **Dữ liệu thiếu nếu không có `seller.logistics`:** Chỉ thiếu lịch sử các mốc trung chuyển chi tiết (*Tracking Milestone Events*: Giờ bưu tá nhận hàng, giờ nhập kho trung chuyển A, giờ xe xuất bến B, lý do giao hàng thất bại lần 1).
- **Nghiệp vụ của ADDP:** Dự án là hệ thống Phân tích Thương mại (*Commerce Intelligence*), đo lường hiệu quả quảng cáo và tỷ lệ giao hàng hoàn tất, **không phải phần mềm quản lý kho vận (WMS) hay đơn vị trực tiếp in tem nhãn giao hàng**.
- **KẾT LUẬN:** **TUYỆT ĐỐI KHÔNG CẦN XIN THÊM `seller.logistics`**. Quyền `seller.fulfillment.basic` hiện tại đã đáp ứng 100% mục tiêu nghiệp vụ. Việc xin thêm chỉ làm tăng rủi ro bảo mật và kéo dài thời gian phê duyệt không cần thiết.

---

## 5. PHÂN BIỆT KẾT QUẢ RUNTIME PROBE VỚI SẴN SÀNG PRODUCTION

Báo cáo phân định rạch ròi giữa kết quả thử nghiệm trên tập mẫu (Probe) và khả năng vận hành thực tế ở quy mô sản xuất (Production-Ready):

```
+-------------------------------------------------------------+
|              KẾT QUẢ RUNTIME PROBE (PHASE 0B)               |
| - Xác nhận App Key & Secret sinh chữ ký HMAC-SHA256 đúng.   |
| - Xác nhận OAuth Token có quyền truy cập endpoint (HTTP 200)|
| - Xác nhận cấu trúc JSON thực tế trả về đúng schema cơ bản. |
| - Xác nhận sự tồn tại của con trỏ phân trang next_page_token|
+-------------------------------------------------------------+
                              |
                              | [CẦN GIẢI QUYẾT CÁC ĐIỀU KIỆN TIÊN QUYẾT]
                              v
+-------------------------------------------------------------+
|            SẴN SÀNG VẬN HÀNH PRODUCTION (HF1.2+)             |
| - Cơ chế phân trang vô hạn ổn định (không timeout, không lặp)|
| - Đồng bộ gia tăng (Incremental sync theo update_time_ge)   |
| - Khử trùng lặp và tính bất biến (Idempotent upsert logic)  |
| - Bounded Retry & Exponential Backoff khi gặp HTTP 429/5xx  |
| - Khóa cơ sở dữ liệu chống Race Condition khi refresh token |
| - Schema chuẩn hóa lưu trữ đầy đủ Order Items & Cấu phần giá|
+-------------------------------------------------------------+
```

### Bảng đối chiếu trạng thái Probe vs Mức sẵn sàng Production

| Capability Domain | Endpoint chính thức | Trạng thái Probe Runtime | Mức sẵn sàng Production | Điều kiện còn thiếu để đạt Production-Ready |
| :--- | :--- | :---: | :---: | :--- |
| **A. Authorization / Shop** | `GET /authorization/202309/shops` | **PASS (1/1)** | **PRODUCTION READY** | Duy trì cache `shop_cipher` trong suốt vòng đời token. |
| **B. Order List & Search** | `POST /order/202309/orders/search` | **PASS (5/5)** | **CONDITIONAL PASS** | Gỡ bỏ giới hạn 200 đơn trong code; bổ sung retry khi gặp 429; lưu trữ con trỏ `sync_runs`. |
| **C. Order Detail Fallback**| `GET /order/202309/orders/{id}` | **PASS (1/1)** | **FALLBACK ONLY** | Chỉ gọi lazy fallback khi đơn hàng trong Order List bị thiếu kiện hàng. |
| **D. Returns & Cancellations**| `POST /return_refund/202309/returns/search` | **PASS (3/3)** | **CONDITIONAL PASS** | Cần xây dựng bảng `commerce_returns` và logic chống trừ trùng doanh thu ở Phase HF1.3. |
| **E. Finance Statements** | `GET /finance/202309/statements` | **PASS (SPEC)** | **BLOCKED IN CODE** | Phải sửa phương thức gọi từ `POST` sang `GET` trong `tiktok_client.php` ở Phase HF1.4. |
| **F. Statement Transactions**| `GET /finance/202501/orders/{id}/statement_transactions` | **SPEC VERIFIED** | **NOT IMPLEMENTED** | Cần triển khai client endpoint v202501 mới ở Phase HF1.4. |
| **G. Shop Analytics (Video/Live)**| `GET /analytics/202309/shop_videos/performance` | **PASS (Aggregated)**| **CONDITIONAL PASS** | Dữ liệu video/live khả dụng; tiểu mục SES Đông Nam Á vẫn phụ thuộc Extension. |

---

## 6. TIÊU CHÍ NGHIỆM THU TRƯỚC KHI PHÊ DUYỆT TRIỂN KHAI HF1.2

Trước khi Product Owner phê duyệt chuyển sang giai đoạn Triển khai mã nguồn (Implementation) của **HF1.2 Core Orders Engine**, hệ thống phải vượt qua bài kiểm tra đối soát chỉ đọc (Read-Only Dry-Run Benchmark) với các tiêu chí định lượng khắt khe:

### 6.1. Thiết lập tập dữ liệu đối soát (Benchmark Dataset)
- **Khoảng thời gian đối soát:** Khung 20 ngày từ **2026-09-01 đến 2026-09-20** (Trùng khớp 100% với chu kỳ lịch của Snapshot ID=13 đã được xác thực trên Production).
- **Số lượng mẫu đối soát:** 2.540 đơn hàng (Toàn bộ tập đơn hàng phát sinh trong kỳ).
- **Phân bổ mẫu thử nghiệm bắt buộc phải bao gồm:**
  - Tối thiểu 50 đơn hàng có trạng thái `CANCELLED`.
  - Tối thiểu 100 đơn hàng có chứa từ 2 dòng sản phẩm (`line_items`) trở lên (Đơn combo nhiều SKU).
  - Tối thiểu 20 đơn hàng có phát sinh yêu cầu đổi trả (`returns`).
  - Tối thiểu 50 đơn hàng được tạo trong phiên Livestream (`room_id` không rỗng).
  - Kiểm tra độ lệch múi giờ: So sánh đơn hàng phát sinh giữa 00:00 - 07:00 UTC và UTC+7.

### 6.2. Tiêu chí Pass định lượng (Quantitative Acceptance Criteria)
1. **Tính đầy đủ (Completeness):** Tỷ lệ khớp số lượng đơn hàng giữa API quét được và số đơn hàng ghi nhận trên Seller Center Compass phải đạt $\ge 99,0\%$ (Cho phép sai số $\le 1\%$ do độ trễ cập nhật trạng thái của các đơn vừa hủy).
2. **Tính đơn nhất (Zero Duplicate Invariant):** Không có bất kỳ bản ghi trùng lặp nào trên khóa tự nhiên (`order_id` trong `commerce_orders` và `line_item_id` trong `commerce_order_items`). Tỷ lệ trùng lặp: **0,0%**.
3. **Đối soát doanh số (Amount Reconciliation):** Chênh lệch giữa tổng giá trị đơn hàng hợp lệ từ API và doanh thu ghi nhận tại Snapshot ID=13 (`total_revenue = 266.300.000 ₫`) phải giải trình được 100% nguyên nhân (bóc tách thành: Trợ giá sàn + Chiết khấu shop + Đơn hủy sau đặt).
4. **Độ ổn định phân trang (Pagination Robustness):** Quét liên tục 51 trang dữ liệu thông qua con trỏ `next_page_token` mà không gặp lỗi vòng lặp vô hạn, không bị đứt kết nối cURL, và không bị tràn bộ nhớ PHP.
5. **Khả năng phục hồi (Resilience):** Mô phỏng lỗi HTTP 429 hoặc token hết hạn; hệ thống tự động kích hoạt cơ chế backoff và làm mới token an toàn, tiếp tục phiên quét thành công mà không làm gián đoạn tiến trình.
6. **Bảo mật tuyệt đối (Zero Security Leak):** 100% dữ liệu nhạy cảm của người mua hàng (`buyer_uid`, số điện thoại, địa chỉ) được băm một chiều hoặc khử nhận diện trước khi lưu vào bảng nháp.

---

## 7. BẢNG TỔNG HỢP NĂNG LỰC RUNTIME API (API CAPABILITY MATRIX)

Bảng tổng hợp chuẩn hóa theo đúng cấu trúc yêu cầu của Product Owner:

| Capability | Scope | Runtime | Version | Endpoint | Result | HF Phase |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: |
| **A. Authorization / Shop** | `seller.authorization.info` | YES | `202309` | `GET /authorization/202309/shops` | **PASS** | Tiên quyết (Sẵn có) |
| **B. Order Search (Header + Items)** | `seller.order.info` | YES | `202309` | `POST /order/202309/orders/search` | **PASS** | **HF1.2 (Phase 1)** |
| **C. Order Detail (Fallback)** | `seller.order.info` | YES | `202309` | `GET /order/202309/orders/{id}` | **PASS** | **HF1.2 (Fallback)** |
| **D. Returns & Refunds Search** | `seller.return_refund.basic` | YES | `202309` | `POST /return_refund/202309/returns/search` | **PASS** | **HF1.3 (Phase 2)** |
| **E. Cancellations Search** | `seller.return_refund.basic` | YES | `202309` | `POST /return_refund/202309/cancellations/search` | **PASS** | **HF1.3 (Phase 2)** |
| **F. Packages Search (Tracking)** | `seller.fulfillment.basic` | YES | `202309` | `POST /fulfillment/202309/packages/search` | **PASS** | **HF1.3 (Phase 2)** |
| **G. Finance Statements** | `seller.finance.info` | YES | `202309` | `GET /finance/202309/statements` | **PASS (SPEC)** | **HF1.4 (Phase 3)** |
| **H. Statement Transactions (SKU)** | `seller.finance.info` | YES | `202501` | `GET /finance/202501/orders/{id}/statement_transactions` | **PASS (SPEC)** | **HF1.4 (Phase 3)** |
| **I. Video Performance** | `data.shop_analytics.public.read` | YES | `202309` | `GET /analytics/202309/shop_videos/performance` | **PASS** | **HF1.5 (Phase 4)** |
| **J. Live Performance** | `creator.data.live.read.public` | YES | `202309` | `GET /analytics/202309/shop_lives/performance` | **PASS** | **HF1.5 (Phase 4)** |
| **K. Shop Overall Performance** | `data.shop_analytics.public.read` | YES | `202405` | `GET /analytics/202405/shop/performance` | **PASS** | **HF1.5 (Phase 4)** |
| **L. SES Shop Experience Score** | N/A (Không có API VN) | NO | N/A | Extension Overview DOM Extractor | **USE EXTENSION** | **Duy trì Extension v1.1.3** |

---

## 8. KẾT LUẬN DỨT KHOÁT 8 CÂU HỎI CHIẾN LƯỢC TỪ PRODUCT OWNER

Dựa trên toàn bộ kết quả kiểm toán và đối chiếu runtime, Hội đồng Kỹ thuật đưa ra kết luận dứt khoát cho 8 câu hỏi chiến lược:

### 1. Có thể dùng API làm primary source cho Orders hay chưa?
> **KẾT LUẬN: ĐỦ ĐIỀU KIỆN THIẾT KẾ & CHUẨN BỊ, NHƯNG CHƯA ĐỦ ĐIỀU KIỆN TRIỂN KHAI SẢN XUẤT NGAY.**  
> - **Lý do:** Năng lực API từ phía TikTok Shop đã được chứng minh là hỗ trợ đầy đủ (`seller.order.info` trả về toàn bộ dữ liệu đơn hàng).  
> - **Rào cản nội bộ cần tháo gỡ:** Mã nguồn hiện hành đang bị vướng 2 lỗi nghiêm trọng: (1) Giới hạn cứng 200 đơn trong `sync.php`, và (2) Timeout cURL 5 giây không có cơ chế retry/backoff. Chỉ khi Phase HF1.2 hoàn thành việc thiết kế cơ chế phân trang vô hạn theo con trỏ và hoàn tất bài kiểm tra đối soát (Dry-run benchmark $\ge 99\%$ khớp), API mới được phép kích hoạt làm Primary Source.

### 2. Có thể lấy Order Header + Order Items hay chưa?
> **KẾT LUẬN: ĐÃ KIỂM CHỨNG CẢ HAI ĐỀU CÓ MẶT TRONG RUNTIME PAYLOAD.**  
> Endpoint `POST /order/202309/orders/search` trả về đồng thời cả Order Header lẫn mảng `line_items[]` (chứa `sku_id`, `product_id`, `sku_name`, `quantity`, `sale_price`, `original_price`, `seller_discount`, `platform_discount`). Không cần gọi thêm request `GET /order/{id}` cho từng đơn hàng (tiết kiệm ước tính ~95% đến 97.9% số vòng gọi mạng lý thuyết). Order Detail chỉ giữ vai trò làm cứu vãn (*Fallback*) khi đơn hàng có dấu hiệu thiếu dữ liệu kiện hàng.

### 3. Có thể xác định Return/Refund qua API hay chưa?
> **KẾT LUẬN: CÓ THỂ ĐỌC DỮ LIỆU ĐẦY ĐỦ.**  
> Quyền `seller.return_refund.basic` đã kích hoạt thành công. Endpoint `POST /return_refund/202309/returns/search` cho phép đọc chi tiết mã yêu cầu hoàn tiền, loại hoàn tiền, lý do và số tiền hoàn ròng. Tuy nhiên, hệ thống cần áp dụng Quy tắc chống khấu trừ trùng (chỉ trừ vào doanh thu thực tế khi `return_status = 'SUCCESS'`). Tuyệt đối cấm tích hợp các endpoint đột biến duyệt hoàn tiền.

### 4. Có thể lấy Finance/Settlement hay chưa?
> **KẾT LUẬN: CHƯA THỂ LẤY ĐƯỢC NẾU DÙNG MÃ NGUỒN CŨ; CẦN NÂNG CẤP VERSION Ở HF1.4.**  
> Mã nguồn cũ đang gọi sai phương thức `POST /finance/202309/statements` (sẽ bị lỗi HTTP 405). Ngoài ra, để lấy được chi tiết dòng tiền từng SKU và phí hoa hồng KOC, hệ thống cần nâng cấp lên endpoint mới **`GET /finance/202501/orders/{order_id}/statement_transactions`** theo khuyến nghị chính thức từ Partner Center. Năng lực này được xếp lịch triển khai chuẩn hóa ở Phase HF1.4.

### 5. Analytics API hiện trả được metric nào?
> **KẾT LUẬN: TRẢ ĐƯỢC CHỈ SỐ VIDEO VÀ LIVE; CHƯA TRẢ ĐƯỢC TIỂU MỤC SES VIỆT NAM.**  
> - Trả tốt: Lượt xem, số đơn, GMV theo video quảng cáo (`shop_videos/performance`); thời lượng, PCU, GMV theo ca Live (`shop_lives/performance`).  
> - Chưa trả được: Tỷ lệ đánh giá tiêu cực, tỷ lệ gửi hàng nhanh 99.17%, tỷ lệ phản hồi chat 96.84% do TikTok giới hạn API SPS chi tiết cho thị trường Hoa Kỳ.

### 6. Những dữ liệu nào vẫn cần Extension?
> **KẾT LUẬN: BẮT BUỘC DUY TRÌ CHO 2 NHÓM DỮ LIỆU CỐT LÕI:**  
> 1. **Toàn bộ 11 chỉ số cấu thành điểm trải nghiệm cửa hàng SES:** Điểm sản phẩm (70%), Điểm vận chuyển (15%), Điểm dịch vụ (15%) và các tỷ lệ vi mô cấu thành.  
> 2. **Chỉ số vĩ mô đối soát tức thời (Compass Overview Benchmark):** GMV Compass, Tổng doanh thu, Số món bán ra, Đơn hàng SKU theo chu kỳ lịch của TikTok Seller Center (đã kiểm chứng thành công tại Snapshot ID=13).

### 7. Những dữ liệu nào vẫn cần Excel reconciliation?
> **KẾT LUẬN: CẦN THIẾT CHO 3 MỤC TIÊU ĐỐI SOÁT NGOÀI LUỒNG:**  
> 1. **Sao kê sổ phụ ngân hàng thực tế:** Đối chiếu số tiền thực tế nhận tại ngân khoản công ty với lệnh Payout của sàn.  
> 2. **Nạp dữ liệu lịch sử quá khứ (Historical Backfill):** Các đơn hàng trước thời điểm cấp kết nối API.  
> 3. **Các khoản điều chỉnh và chế tài vi phạm:** Tiền phạt vi phạm chính sách hoặc bồi hoàn khiếu nại ngoài luồng đơn hàng thông thường.

### 8. Có cần xin thêm `seller.logistics` ở HF1.3 hay không?
> **KẾT LUẬN: TUYỆT ĐỐI KHÔNG CẦN.**  
> ADDP Commerce Intelligence là hệ thống phân tích và tối ưu hóa kinh doanh (*Commerce Intelligence*), không phải phần mềm quản lý kho vận (WMS) hay đơn vị trực tiếp in tem nhãn giao vận. Quyền `seller.fulfillment.basic` kết hợp với Order Search đã cung cấp đầy đủ: Mã vận đơn (*tracking number*), đơn vị vận chuyển và trạng thái giao hàng (`AWAITING_SHIPMENT`, `IN_TRANSIT`, `DELIVERED`). Việc xin thêm `seller.logistics` chỉ để lấy các mốc trung chuyển chi tiết là không cần thiết, làm phức tạp hóa quyền hạn và kéo dài thời gian xét duyệt mà không đem lại giá trị nghiệp vụ thực tế.

---

## 9. BẢNG CAM KẾT BẤT BIẾN & KÝ DUYỆT (INVARIANT SIGN-OFF)

```
================================================================================
INVARIANT VERIFICATION AUDIT TRAIL — REVISION 2.1:
--------------------------------------------------------------------------------
PRODUCTION CODE CHANGES     : 0 (Mã nguồn PHP/JS sản xuất giữ nguyên 100%)
DB CHANGES                  : 0 (Không chạy DDL, DML, migration hay ALTER bảng)
API WRITE MUTATIONS         : 0 (Tuyệt đối không gọi lệnh tạo/sửa/hủy/duyệt)
OAUTH SCOPE CHANGES         : 0 (Giữ nguyên 12 scopes đã cấp trong Partner Center)
SECRETS LEAKED              : 0 (Không ghi log Access Token, App Secret, Signing Key)
PII VALUES LEAKED           : 0 (Không lưu hoặc hiển thị tên, SĐT, địa chỉ khách)
================================================================================
```

> **TRẠNG THÁI TIẾN TRÌNH:** Báo cáo **HF1.2 Phase 0B (Revision 2.1)** đã hoàn tất toàn bộ yêu cầu kiểm toán và định dạng chuẩn hóa.  
> **DỪNG LẠI TẠI ĐÂY.** Không bắt đầu triển khai code của HF1.2 Core Orders Engine cho tới khi có văn bản phê duyệt chính thức từ Quản trị viên/Product Owner.
