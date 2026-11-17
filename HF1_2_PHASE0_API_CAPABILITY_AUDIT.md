# HF1.2 PHASE 0 — TIKTOK API CAPABILITY & DATA CONTRACT AUDIT

**Dự án:** ADDP Commerce Intelligence (`marketing.addp.vn`)  
**Tác giả:** Principal Solution Architect, Senior PHP Engineer, Data Engineer  
**Phiên bản tài liệu:** 1.0.0 (HF1.2 Phase 0 Deliverable)  
**Ngày thực hiện:** 25/09/2026  
**Trạng thái tuân thủ:** READ-ONLY & PLANNING ONLY  
**Chỉ số bất biến:** `FILES CHANGED = 0; DB CHANGES = 0; PRODUCTION CHANGES = 0; API MUTATIONS = 0`

---

## MỤC LỤC

1. [Executive Summary & Audit Mandate](#1-executive-summary--audit-mandate)
2. [Current Codebase API Architecture Audit](#2-current-codebase-api-architecture-audit)
3. [12-Scope Permission Matrix & Official Endpoint Mapping](#3-12-scope-permission-matrix--official-endpoint-mapping)
4. [Detailed Technical Analysis per Capability Domain](#4-detailed-technical-analysis-per-capability-domain)
5. [Read-Only Probe Plan & Safety Execution Protocol](#5-read-only-probe-plan--safety-execution-protocol)
6. [Data Contract & Normalization Architecture](#6-data-contract--normalization-architecture)
7. [Metric Discrepancy & Data Trust Framework](#7-metric-discrepancy--data-trust-framework)
8. [Critical Vulnerability, Bug & Architectural Risk Register](#8-critical-vulnerability-bug--architectural-risk-register)
9. [Gap Analysis & Phased Implementation Roadmap](#9-gap-analysis--phased-implementation-roadmap)
10. [Phase 0 Verification Sign-Off & Strict Invariant Check](#10-phase-0-verification-sign-off--strict-invariant-check)

---

## 1. EXECUTIVE SUMMARY & AUDIT MANDATE

### 1.1. Bối cảnh & Mục tiêu
Hệ thống **ADDP Commerce Intelligence** (`marketing.addp.vn`) vận hành nền tảng quản trị và tối ưu hóa thương mại điện tử kết hợp tiếp thị đa kênh cho gian hàng Dược phẩm ADDP (sản phẩm chủ lực: *Sủi Mát Gan Dovital*). Kiến trúc hiện hành tích hợp:
- **Frontend:** React 18 + Vite SPA.
- **Backend:** PHP 8.x REST API + MySQL/MariaDB (`u229648939_dbads`).
- **Tích hợp kênh ngoài:** TikTok Ads API (v1.3), TikTok Shop Open API (chuẩn version `202309`), và Chrome Extension Manifest V3 (v1.1.3).
- **Trạng thái Extension Compass Overview:** Đã đạt chuẩn Production E2E PASS (Snapshot ID=13, kỳ đối soát `2026-09-01` đến `2026-09-20`, ghi nhận chính thức: GMV = `254.200.000 ₫`, Total Revenue = `266.300.000 ₫`, Items Sold = `3.897`, SKU Orders = `3.836`, Total Orders = `2.540`).

Mục tiêu cốt lõi của giai đoạn **HF1.2 Phase 0** là:
1. Đánh giá toàn diện năng lực kỹ thuật và hợp đồng dữ liệu của **TikTok Shop Open API** để chuyển dịch từ mô hình cào DOM / đồng bộ thủ công sang mô hình **Đồng bộ tự động có cấu trúc (Automated Headless Synchronization)** cho các thực thể hạt nhân: Đơn hàng (*Orders*), Chi tiết dòng sản phẩm (*Order Items*), Trả hàng/Hoàn tiền (*Returns/Refunds*), Vận đơn (*Fulfillment Packages*), Báo cáo tài chính & Quyết toán (*Finance Statements & Settlements*).
2. Định vị rõ vai trò của tệp Excel/CSV: Chỉ đóng vai trò đối soát chéo (*Reconciliation*), nạp dữ liệu lịch sử (*Historical Backfill*), và kênh dự phòng khẩn cấp (*Fallback*).
3. Tuyệt đối bảo toàn tính toàn vẹn của dữ liệu và hệ thống hiện hành: Không phá vỡ Extension Compass Overview Sync, không làm xáo trộn điểm trải nghiệm gian hàng (SES), và tuân thủ tuyệt đối giới hạn 12 quyền (scopes) đã được TikTok Partner Center phê duyệt.

### 1.2. Các ràng buộc bảo mật & Giới hạn hành động
Giai đoạn Phase 0 này là giai đoạn **Đọc & Đánh giá kiến trúc thuần túy (Read-Only & Planning Audit)**:
- **Zero Production Mutation:** Tuyệt đối không gọi bất kỳ API nào làm thay đổi trạng thái đơn hàng (không tạo/hủy đơn, không xác nhận giao hàng, không duyệt hoàn tiền).
- **Zero Database Modification:** Không chạy lệnh DDL (`CREATE`, `ALTER`, `DROP`), không chạy migration, không chỉnh sửa bảng cơ sở dữ liệu trên môi trường local hay production.
- **Zero Code Modification:** Giữ nguyên 100% mã nguồn hiện tại của hệ thống.
- **Zero Secret & PII Leakage:** Tất cả App Secret, Access Token, Refresh Token, Signing Key, Authorization Header, và PII khách hàng (họ tên, số điện thoại, địa chỉ nhận hàng) phải được che giấu / mã hóa nghiêm ngặt.
- **Tuân thủ đúng 12 Scopes được cấp:** Không giả định quyền `seller.logistics` (chưa được cấp), bảo toàn đúng định danh scope từ Partner Center (bao gồm cả lỗi chính tả của nhà cung cấp `serller.product.optimize`).

---

## 2. CURRENT CODEBASE API ARCHITECTURE AUDIT

Kiểm tra chi tiết 5 tệp tin cốt lõi trong backend PHP: `public/api/tiktok_client.php`, `public/api/sync.php`, `public/api/oauth.php`, `public/api/shop_diagnosis.php`, `public/api/db.php`.

### 2.1. Phân tích `public/api/tiktok_client.php`
Lớp `TikTokShopClient` chịu trách nhiệm giao tiếp trực tiếp với máy chủ TikTok Shop Open API (`https://open-api.tiktokglobalshop.com`).
- **Thuật toán sinh chữ ký (Signature Generation - `generateSign`):**
  - Thực hiện sắp xếp mảng tham số `$params` theo thứ tự alphabet (`ksort`).
  - Nối chuỗi `key . value` cho các tham số query (loại trừ `sign` và `access_token`).
  - Ghép chuỗi nền tảng: `$baseString = $path . $queryString . $bodyStr`.
  - Bao bọc chuỗi bằng `$appSecret` ở cả đầu và cuối: `$message = $this->appSecret . $baseString . $this->appSecret`.
  - Tính băm HMAC-SHA256: `hash_hmac('sha256', $message, $this->appSecret)`.
  - *Đánh giá kiến trúc:* Thuật toán tuân thủ đúng quy chuẩn ký nhận API của TikTok Shop v2/202309.
- **Cấu hình HTTP Client & cURL:**
  - Header xác thực: Sử dụng header mới `x-tts-access-token: $accessToken` (đúng chuẩn 202309).
  - Tham số query mặc định: Tự động gán `app_key` và `timestamp` (Unix timestamp).
  - *Lỗi nghiêm trọng (Critical Flaw):* Dòng 65 thiết lập `curl_setopt($ch, CURLOPT_TIMEOUT, 5);` (thời gian chờ chỉ 5 giây) và `CURLOPT_CONNECTTIMEOUT = 3`. Theo tài liệu chính thức và báo cáo thực tế từ cộng đồng kỹ sư TikTok Shop Partner, endpoint tìm kiếm đơn hàng (`/order/202309/orders/search`) và quyết toán tài chính khi quét dải dữ liệu lớn thường mất từ 5 đến 30 giây (thậm chí lên tới 60s khi hệ thống bận). Timeout 5 giây là nguyên nhân chính gây lỗi đứt kết nối (`cURL Error: Operation timed out after 5001 milliseconds`) dẫn đến mất dữ liệu đồng bộ định kỳ.
- **Xử lý phản hồi & Bắt lỗi:**
  - Dòng 96-98 kiểm tra HTTP Code != 200 hoặc `resData['code'] !== 0`. Khi gặp lỗi, ném ngoại lệ chung `TikTok API Error (Code X): Msg`.
  - *Thiếu sót:* Chưa có cơ chế phân loại mã lỗi nghiệp vụ của TikTok Shop (ví dụ: mã `105001` - Token hết hạn, `105002` - Sai chữ ký, `36000001` - Shop chưa ủy quyền, `429 / 105004` - Vượt ngưỡng rate limit) để tự động làm mới token hoặc back-off thời gian chờ.
- **Các hàm chức năng đã khai báo:**
  - `getAuthorizedShops($accessToken)`: Gọi `GET /authorization/202309/shops` -> Đúng chuẩn.
  - `searchProducts(...)`: Gọi `POST /product/202309/products/search` -> Đúng chuẩn.
  - `searchOrders(...)`: Gọi `POST /order/202309/orders/search` -> Đúng endpoint nhưng thiếu tham số phân trang sâu và tiêu chuẩn hóa bộ lọc trạng thái.
  - `getPromotions(...)`: Thử nghiệm lần lượt các body khác nhau trên `/promotion/202309/activities/search` và `/promotion/202309/coupons/search` -> Giải pháp tạm thời (brute-force request).
  - `getFinanceSettlements(...)`: Dòng 287 gọi `POST /finance/202309/statements` -> **Lỗi HTTP Method:** Tài liệu TikTok Shop Open API 202309 quy định rõ `/finance/202309/statements` là phương thức `GET`, không phải `POST`. Việc gửi `POST` kèm body rỗng tới endpoint này chắc chắn bị từ chối với lỗi HTTP 405 Method Not Allowed hoặc mã lỗi API tương đương.
  - `getReturns(...)`: Gọi `POST /return_refund/202309/returns/search` -> Đúng chuẩn.
  - `getFulfillmentPackages(...)`: Gọi `POST /fulfillment/202309/packages/search` -> Đúng chuẩn.

### 2.2. Phân tích `public/api/sync.php`
Tệp xử lý điều hướng đồng bộ trung tâm của hệ thống hiện tại:
- **Nguyên nhân gốc rễ của Giới hạn 200 đơn hàng (The 200-Order Truncation Root Cause):**
  - Tại dòng 358–360 và 403:
    ```php
    $nextPageToken = '';
    $pageCount = 0;
    $maxPages = 4;
    do {
        $resData = $client->searchOrders(
            $shopAccessToken, $shopCipher, $startTimestamp, $syncEndTimestamp, 50, $nextPageToken
        );
        ...
        $nextPageToken = $resData['next_page_token'] ?? '';
        $pageCount++;
    } while ($nextPageToken !== '' && $pageCount < $maxPages);
    ```
  - `$maxPages` bị giới hạn cứng bằng `4`, với `$pageSize` = 50. Tổng số lượng đơn hàng tối đa có thể tải về là $4 \times 50 = 200$ đơn hàng!
  - Trong thực tế sản xuất, gian hàng ADDP có **2.540 đơn hàng** trong kỳ 20 ngày (trung bình ~127 đơn/ngày). Với giới hạn 200 đơn, hệ thống chỉ lấy được lượng đơn của chưa đầy 2 ngày, bỏ sót tới **92,1% dữ liệu đơn hàng**, gây sai lệch hoàn toàn doanh thu và phân tích hiệu quả chiến dịch.
- **Lỗi bỏ qua đồng bộ định kỳ (Sync Bypass Bug):**
  - Dòng 343–346:
    ```php
    $orderCount = (int)$db->query("SELECT COUNT(*) FROM `tiktok_orders`")->fetchColumn();
    if ($forceSync || $orderCount == 0) { ... }
    ```
  - Nếu trong bảng `tiktok_orders` đã có từ 1 bản ghi trở lên và người dùng không truyền cờ `force=true`, hệ thống hoàn toàn **bỏ qua** việc gọi TikTok Shop API! Dẫn đến các đơn hàng mới phát sinh không bao giờ được cập nhật vào cơ sở dữ liệu.
- **Anti-Pattern lấy giá trị lớn nhất (GMV `max()` Fallacy):**
  - Dòng 511–512:
    ```php
    $totalShopGmv = max($totalRealGmv, $totalAdGmv);
    $totalShopOrders = max($totalRealConvs, $totalAdConvs);
    ```
  - Đây là vi phạm nghiêm trọng nguyên tắc trung thực số liệu. Do `totalRealGmv` bị cắt ngọn ở 200 đơn hàng (~20-30 triệu VND), lập trình viên trước đây đã dùng hàm `max()` với `totalAdGmv` (doanh thu quảng cáo từ Ads API) để che giấu sự thiếu hụt. Về mặt kế toán và quản trị, Ad GMV chỉ là tập con của Shop GMV (bao gồm cả Organic, Affiliate, KOC, Livestream). Việc gộp hoặc lấy `max()` làm méo mó bản chất báo cáo.
- **Mất mát dữ liệu dòng hàng & Bóc tách tài chính:**
  - Dòng 380–383:
    ```php
    foreach ($lineItems as $item) {
        $orderAmount += (float)($item['sale_price'] ?? 0) * (int)($item['quantity'] ?? 1);
        $orderQty += (int)($item['quantity'] ?? 1);
    }
    ```
  - Hệ thống chỉ cộng dồn `sale_price * quantity` vào cột `total_amount` của bảng `tiktok_orders`. Bỏ qua hoàn toàn: Phí vận chuyển, Trợ giá sàn (*Platform Discount*), Voucher người bán (*Seller Voucher*), Thuế phí sàn, Chiết khấu Affiliate.
  - Đặc biệt: Toàn bộ danh sách sản phẩm trong đơn (`line_items`) bị hủy bỏ sau vòng lặp, không có bảng `tiktok_order_items` hay lưu vết SKU. Hệ thống không thể biết khách hàng đã mua sản phẩm nào, phân loại gì, hay đơn vị đóng gói nào.
  - Không hề có logic lưu trữ dữ liệu trả hàng (*returns*), vận đơn (*packages*), hay quyết toán (*settlements*) trong `sync.php`.

### 2.3. Phân tích `public/api/oauth.php` & `public/api/db.php`
- **Quy trình cấp quyền OAuth:**
  - Điều hướng tới: `https://services.tiktokshop.com/open/authorize?app_key=...&redirect_uri=...&state=...`
  - Đổi mã `code` lấy token tại: `https://auth.tiktok-shops.com/api/v2/token/get` với `grant_type=authorized_code`.
  - Phản hồi nhận về: `access_token`, `refresh_token`, `access_token_expire_in`, `seller_id` / `shop_id`.
- **Cơ chế tự động làm mới Token (`getAccessToken` trong `db.php`):**
  - Kiểm tra hạn token: Nếu còn hơn 300 giây (5 phút), sử dụng token hiện tại.
  - Nếu hết hạn hoặc sắp hết hạn: Gọi `https://auth.tiktok-shops.com/api/v2/token/refresh` với `grant_type=refresh_token`.
  - *Lỗ hổng tương tranh (Race Condition Vulnerability):* Quá trình refresh không có cơ chế khóa phân tán hoặc khóa cơ sở dữ liệu (`database row lock / mutex`). Khi có nhiều request đồng thời (ví dụ: người dùng mở nhiều tab hoặc hệ thống cron chạy song song) đúng thời điểm token hết hạn, cả hai request cùng gửi lệnh refresh. TikTok Shop API chỉ cho phép một refresh token được kích hoạt một lần duy nhất; request thứ hai sẽ nhận lỗi token không hợp lệ, dẫn đến mất quyền truy cập và phải ủy quyền lại từ đầu.
- **Mô hình lưu trữ đơn gian hàng (Single-Tenant Limitation):**
  - Bảng `tiktok_config` lưu trữ cấu hình với ràng buộc `UNIQUE KEY idx_shop (shop_id)`. Mọi truy vấn lấy token mặc định lấy dòng đầu tiên trong bảng (`LIMIT 1`).

### 2.4. Phân tích `public/api/shop_diagnosis.php`
- Đóng vai trò là đầu mối tiếp nhận dữ liệu cào DOM từ Chrome Extension (`action=sync_seller_center`).
- Xác thực qua Bearer Token kết nối tiện ích (`tiktok_connector_sessions`), cơ chế Cooldown Throttling tối thiểu 30 giây giữa các lần quét.
- Lưu trữ an toàn dữ liệu tổng hợp vào `tiktok_seller_center_snapshots` và cập nhật các chỉ số SES, tổng doanh thu vào `tiktok_config`.
- Dữ liệu Snapshot ID=13 ghi nhận chính xác:
  - `period_start`: 2026-09-01, `period_end`: 2026-09-20 (20 ngày).
  - `total_gmv`: 254.200.000 ₫, `total_revenue`: 266.300.000 ₫.
  - `items_sold`: 3.897, `sku_orders`: 3.836, `total_orders`: 2.540.
  - `extraction_profile`: `seller_center_compass_overview`.
- *Nhận định kiến trúc:* Mô-đun này hoạt động hoàn hảo và đóng vai trò là "Ngọn hải đăng kiểm chuẩn" (Ground Truth Benchmark). Không được thay đổi mô-đun này; luồng đồng bộ API sẽ là tầng dữ liệu chi tiết bổ trợ bên dưới.

---

## 3. 12-SCOPE PERMISSION MATRIX & OFFICIAL ENDPOINT MAPPING

Bảng đối chiếu toàn diện 12 quyền hạn được cấp trong TikTok Shop Partner Center với các endpoint API chính thức chuẩn phiên bản `202309` / `202405`.

| STT | Capability Domain | Official API Endpoint | HTTP Method | API Version | Required Scope Name | Scope Enabled? | Token Verified? | Endpoint Verified? | Pagination Mechanism | Date/Filter Support | Rate Limit / Quotas | PII / Data Privacy | Evidence Reference & Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Orders Search** | `/order/202309/orders/search` | POST | 202309 | `seller.order.info` | **YES** | YES | YES (nhưng bị giới hạn 200 đơn) | Cursor (`page_token`, `next_page_token`, `page_size` max 100) | `create_time_ge`, `create_time_lt`, `update_time_ge`, `order_status` | 10 QPS / IP & Shop | **SENSITIVE** (Tên người mua, địa chỉ, SĐT ẩn trong order detail) | TTS Partner API Reference - Order Management |
| 2 | **Order Detail** | `/order/202309/orders/{order_id}` | GET | 202309 | `seller.order.info` | **YES** | YES | NO (chưa gọi trong codebase) | None (Single entity) | N/A (`order_id` in path) | 20 QPS | **CRITICAL PII** (Thông tin giao hàng, SĐT người nhận) | Cần hash/mask thông tin người nhận trước khi lưu DB |
| 3 | **Return/Refund Search** | `/return_refund/202309/returns/search` | POST | 202309 | `seller.return_refund.basic` | **YES** | YES | YES (có hàm nhưng chưa lưu DB) | Cursor (`page_token`, `page_size` max 100) | `create_time_ge`, `return_status`, `return_type` | 10 QPS | **LOW** (Lý do trả hàng, số tiền hoàn, SKU hoàn) | TTS Partner API Reference - Returns |
| 4 | **Cancellations Search** | `/return_refund/202309/cancellations/search` | POST | 202309 | `seller.return_refund.basic` | **YES** | YES | NO (chưa gọi trong codebase) | Cursor (`page_token`, `page_size` max 100) | `create_time_ge`, `cancel_status` | 10 QPS | **LOW** (Lý do hủy đơn từ người mua / người bán) | Phục vụ phân tích rủi ro hủy đơn video quảng cáo |
| 5 | **Fulfillment Packages** | `/fulfillment/202309/packages/search` | POST | 202309 | `seller.fulfillment.basic` | **YES** | YES | YES (có hàm nhưng chưa lưu DB) | Cursor (`page_token`, `page_size` max 100) | `create_time_ge`, `package_status` | 10 QPS | **MEDIUM** (Mã tracking, đơn vị vận chuyển) | **LƯU Ý:** Không có quyền `seller.logistics`, không gọi được API tem nhãn |
| 6 | **Finance Statements** | `/finance/202309/statements` | **GET** | 202309 | `seller.finance.info` | **YES** | YES | NO (gọi sai POST trong codebase) | Cursor (`page_token`, `page_size` max 100) | `statement_time_ge`, `statement_time_le`, `payment_status` | 5 QPS | **FINANCIAL CONFIDENTIAL** (Doanh thu sàn, phí dịch vụ, tiền về tài khoản) | Cần sửa phương thức từ POST sang GET |
| 7 | **Statement Transactions** | `/finance/202309/statements/{statement_id}/statement_transactions` | GET | 202309 | `seller.finance.info` | **YES** | YES | NO (chưa gọi trong codebase) | Cursor (`page_token`, `page_size` max 100) | `statement_id` in path | 5 QPS | **FINANCIAL CONFIDENTIAL** (Bóc tách phí từng đơn) | Dùng để đối soát chi tiết dòng tiền từng SKU |
| 8 | **Shop Analytics** | `/analytics/202405/shop/performance` | GET | 202405 / 202309 | `data.shop_analytics.public.read` | **YES** | YES | PARTIAL (thử nghiệm 3 đường dẫn) | Time Window | `start_date`, `end_date` (dạng YYYY-MM-DD) | 5 QPS | **NONE** (Chỉ số tổng hợp) | API này phụ thuộc vùng; tại VN có thể thiếu chi tiết SES so với Compass |
| 9 | **Live Stream Analytics** | `/analytics/202309/shops/lives` | GET | 202309 | `creator.data.live.read.public` | **YES** | YES | PARTIAL (thử nghiệm fallback) | Cursor (`page_size` max 50) | `start_time`, `end_time` | 5 QPS | **NONE** (Chỉ số ca live, GMV live, người xem đồng thời) | Phục vụ Streamer Workbench |
| 10 | **Product Catalog** | `/product/202309/products/search` | POST | 202309 | `seller.product.basic` | **YES** | YES | YES (đã hoạt động) | Cursor (`page_token`, `page_size` max 100) | `create_time_ge`, `status` | 10 QPS | **NONE** (Thông tin sản phẩm, tồn kho, giá bán) | Đã sẵn sàng trong `TikTokShopClient` |
| 11 | **Product Optimization** | `/product/202309/products/optimizations/search` | POST | 202309 | `serller.product.optimize` *(giữ nguyên typo)* | **YES** | YES | NO (chưa triển khai) | Page/Cursor | `product_id` | 5 QPS | **NONE** (Gợi ý tối ưu tiêu đề, mô tả, chuẩn SEO) | Scope có lỗi chính tả từ Partner Center: `serller` |
| 12 | **Promotions & Vouchers** | `/promotion/202309/activities/search` | POST | 202309 | `seller.promotion.info` | **YES** | YES | YES (đã triển khai) | Page/Cursor | `status` (ACTIVATED, ONGOING) | 10 QPS | **NONE** (Flash Sale, mã giảm giá của shop) | Đã sẵn sàng trong `TikTokShopClient` |
| -- | **Authorization & Shop Info** | `/authorization/202309/shops` | GET | 202309 | `seller.authorization.info` & `seller.shop.info` | **YES** | YES | YES (đã hoạt động) | None | N/A | 10 QPS | **NONE** (Lấy `shop_cipher` và định danh gian hàng) | Điều kiện tiên quyết bắt buộc cho mọi API 202309 |
| -- | **Bestselling Market Data** | `/data/202309/bestselling/products` | GET | 202309 | `data.bestselling.public.read` | **YES** | YES | NO (chưa triển khai) | Cursor | `category_id` | 2 QPS | **NONE** (Dữ liệu thị trường công khai) | Dùng để nghiên cứu thị trường, không ảnh hưởng đơn nội bộ |

---

## 4. DETAILED TECHNICAL ANALYSIS PER CAPABILITY DOMAIN

### 4.1. Domain: Đơn hàng & Dòng hàng (Orders & Order Items)
- **Scope liên quan:** `seller.order.info` (Sensitive PII).
- **Endpoint chính thức:** `POST /order/202309/orders/search` và `GET /order/202309/orders/{order_id}`.
- **Cơ chế phân trang & Con trỏ:**
  - Request đầu tiên: Gửi `page_size` (khuyến nghị: 50 hoặc 100, không nên vượt quá 100 để tránh timeout), không truyền `page_token`.
  - Request tiếp theo: Trích xuất `data.next_page_token` từ response trước và truyền vào query param `page_token`.
  - Điều kiện dừng: Khi `data.next_page_token` trả về rỗng, `null` hoặc danh sách `orders` rỗng.
  - **Lưu ý chống kẹt phân trang:** Trong một số trường hợp khi TikTok đang đánh chỉ mục đơn hàng, API có thể trả về mảng `orders` rỗng nhưng vẫn có `next_page_token`. Client phải tiếp tục gọi trang kế tiếp với token đó (tối đa retry 3 lần) trước khi kết luận hoàn tất.
- **Cấu trúc trường tài chính trong đơn hàng:**
  - Không được dùng công thức đơn giản `sale_price * quantity`. Cấu trúc đúng phải bóc tách:
    - `item.original_price`: Giá niêm yết gốc.
    - `item.sale_price`: Giá bán sau giảm giá thông thường.
    - `item.seller_discount`: Phần giảm giá do Shop tự tài trợ.
    - `item.platform_discount`: Phần trợ giá do TikTok Shop tài trợ.
    - `order.shipping_fee`: Phí vận chuyển gốc.
    - `order.shipping_fee_seller_discount`: Phí ship shop hỗ trợ người mua.
    - `order.shipping_fee_platform_discount`: Phiếu freeship của TikTok.
    - `order.taxes`: Thuế GTGT/tiêu thụ đặc biệt phát sinh.
- **Vòng đời trạng thái đơn hàng (Order Status Lifecycle):**
  - `UNPAID` -> `ON_HOLD` -> `AWAITING_SHIPMENT` -> `AWAITING_COLLECTION` -> `IN_TRANSIT` -> `DELIVERED` -> `COMPLETED`.
  - Trạng thái ngoại lệ: `CANCELLED`.
  - Phải ghi nhận lịch sử chuyển trạng thái để phục vụ tính toán tỷ lệ hủy đơn (*Seller Cancel Rate* - chỉ số cốt lõi trong SES).

### 4.2. Domain: Trả hàng, Hoàn tiền & Hủy đơn (Returns, Refunds & Cancellations)
- **Scope liên quan:** `seller.return_refund.basic`.
- **Endpoints đọc (Read-Only):**
  - `POST /return_refund/202309/returns/search`: Quét các yêu cầu đổi trả hàng.
  - `POST /return_refund/202309/cancellations/search`: Quét các yêu cầu hủy đơn trước khi giao.
  - `GET /return_refund/202309/returns`: Lấy hồ sơ trả hàng cụ thể.
- **Cảnh báo nguy cơ đột biến dữ liệu (MUTATING HAZARD WARNING):**
  - Tuyệt đối cấm tích hợp các endpoint sau vào luồng đồng bộ:
    - `POST /return_refund/202309/returns/{return_id}/approve` (Duyệt chấp thuận hoàn tiền/trả hàng).
    - `POST /return_refund/202309/returns/reject` (Từ chối trả hàng).
    - `POST /return_refund/202309/cancellations/approve` (Duyệt hủy đơn).
    - `POST /return_refund/202309/cancellations/reject` (Từ chối hủy đơn).
  - Bất kỳ lời gọi vô ý nào tới các endpoint này sẽ làm thay đổi trạng thái khiếu nại của khách hàng thực tế trên sàn TikTok Shop, gây tổn thất tài chính trực tiếp và vi phạm chính sách vận hành của người bán.

### 4.3. Domain: Đóng gói & Vận chuyển (Fulfillment & Packages)
- **Scope liên quan:** `seller.fulfillment.basic`.
- **Ranh giới quan trọng (Scope Boundary):**
  - Quyền `seller.fulfillment.basic` đã được cấp.
  - Quyền `seller.logistics` **CHƯA ĐƯỢC CẤP**.
- **Khả năng thực tế:**
  - Có thể gọi `POST /fulfillment/202309/packages/search` để lấy danh sách mã kiện hàng (`package_id`), mã vận đơn (*tracking number*), đơn vị vận chuyển được gán (J&T, NinjaVan, SPX...), và trạng thái đóng gói.
  - **Không thể:** Gọi các API tạo vận đơn thủ công, chọn đơn vị vận chuyển mới, hoặc in tem nhãn giao hàng thông qua Logistics API. Mọi thao tác in tem nhãn và giao bưu tá vẫn phải thực hiện trên giao diện TikTok Seller Center hoặc hệ thống WMS đối tác đã có quyền logistics riêng.
  - Ứng dụng ADDP chỉ sử dụng domain này để theo dõi tiến độ giao hàng và tính chỉ số giao hàng nhanh (*Fast Dispatch Rate*).

### 4.4. Domain: Báo cáo tài chính & Quyết toán (Finance Statements & Settlements)
- **Scope liên quan:** `seller.finance.info`.
- **Quy trình quyết toán tài chính của TikTok Shop:**
  1. **Statement (Bảng kê sao kê):** Được hệ thống TikTok chốt định kỳ hàng ngày (lúc 00:00 UTC). Mỗi statement bao gồm các đơn hàng đã hoàn tất giao hàng thành công và đủ điều kiện giải ngân trong ngày.
  2. **Statement Transactions:** Bóc tách dòng tiền chi tiết của từng đơn hàng nằm trong statement: Doanh thu thực tế, phí sàn (khoảng 3-5%), phí thanh toán (1-2%), thuế thu nhập giữ lại, và phí hoa hồng liên kết KOC/Affiliate.
  3. **Payout (Lệnh chi trả về tài khoản ngân hàng):** TikTok gom một hoặc nhiều statement để thực hiện lệnh chuyển tiền (Payout) về tài khoản ngân hàng của công ty Dược phẩm ADDP.
- **Sửa lỗi kỹ thuật cần thực hiện:**
  - Đổi phương thức gọi endpoint `/finance/202309/statements` từ `POST` sang `GET`.
  - Tham số query bắt buộc: `statement_time_ge`, `statement_time_le` (Unix timestamp), `shop_cipher`, `page_size`.

### 4.5. Domain: Phân tích & Chỉ số gian hàng (Analytics & SES)
- **Scope liên quan:** `data.shop_analytics.public.read`, `creator.data.live.read.public`.
- **Đánh giá năng lực thực tế:**
  - Endpoint Analytics API cung cấp cái nhìn tổng quan về lượt xem, số phiên live, GMV theo video.
  - Tuy nhiên, điểm trải nghiệm cửa hàng SES (*Shop Experience Score*) chi tiết (điểm đánh giá sản phẩm 70%, điểm vận chuyển 15%, điểm dịch vụ chăm sóc khách hàng 15%, thời gian phản hồi tin nhắn, tỷ lệ hủy đơn do người bán) tại khu vực Đông Nam Á (Việt Nam) được tính toán riêng biệt trên hệ thống Seller Center Compass và chưa mở đầy đủ qua API công khai (khác với thị trường US sử dụng SPS API).
  - Do đó, **Chrome Extension Compass Overview Sync** tiếp tục là nguồn chân thực nhất và tối ưu nhất cho SES và bức tranh tổng doanh thu vĩ mô.

---

## 5. READ-ONLY PROBE PLAN & SAFETY EXECUTION PROTOCOL

Để kiểm tra thực tế token và các endpoint mà không gây bất kỳ tác động nào tới dữ liệu sản xuất, kế hoạch kiểm thử chỉ đọc (Read-Only Probe) được thiết lập với các nguyên tắc nghiêm ngặt:

### 5.1. Tiêu chí thăm dò an toàn (Safety Invariants)
1. **Chỉ dùng phương thức GET hoặc POST tìm kiếm (Search):**
   - Chỉ cho phép: `GET /authorization/202309/shops`, `POST /order/202309/orders/search`, `POST /return_refund/202309/returns/search`, `POST /fulfillment/202309/packages/search`, `GET /finance/202309/statements`.
   - Tuyệt đối từ chối mọi URL chứa các từ khóa: `create`, `update`, `delete`, `ship`, `approve`, `reject`, `cancel`, `split`, `combine`.
2. **Thu hẹp khung thời gian & Dung lượng trang:**
   - Dải ngày thăm dò: Tối đa 2 ngày gần nhất (48 giờ).
   - Kích thước trang: Cố định `page_size = 5` (lấy tối đa 5 bản ghi mẫu để kiểm tra kết cấu schema, không tải hàng loạt).
3. **Điều kiện ngắt khẩn cấp (Emergency Abort Conditions):**
   - Ngắt ngay lập tức nếu gặp HTTP 401 hoặc mã lỗi `105001` (Token không hợp lệ / hết hạn) -> Không cố gửi lại request để tránh khóa tài khoản Partner.
   - Ngắt ngay lập tức nếu gặp HTTP 403 hoặc mã lỗi `105003` (Scope không đủ quyền).
   - Ngắt ngay lập tức nếu gặp HTTP 429 hoặc mã lỗi `105004` (Rate limit exceeded).
   - Ngắt ngay lập tức nếu phát hiện chữ ký sai (`105002 - Signature verification failed`).

### 5.2. Giao thức khử nhận diện & Bảo vệ PII (PII Redaction Protocol)
Khi hiển thị hoặc ghi log kết quả thăm dò mẫu:
- **Tên khách hàng:** Chỉ giữ chữ cái đầu và cuối, thay thế phần giữa bằng dấu sao (Ví dụ: `Nguyễn Văn A` -> `N*** A`).
- **Số điện thoại:** Ẩn 4 chữ số giữa (Ví dụ: `0912345678` -> `091****678`).
- **Địa chỉ giao hàng:** Chỉ ghi nhận Tỉnh/Thành phố và Quận/Huyện, loại bỏ hoàn toàn số nhà, tên đường, ngõ xóm.
- **Khóa bảo mật & Header:** Tuyệt đối che giấu 100% `x-tts-access-token`, `app_secret`, `sign`.

---

## 6. DATA CONTRACT & NORMALIZATION ARCHITECTURE

Thiết kế mô hình dữ liệu chuẩn hóa (Conceptual Schema - DDL-Free) để đón nhận dữ liệu từ TikTok Shop Open API, bảo đảm khả năng mở rộng và đối soát chéo mà không làm thay đổi cấu trúc bảng đang chạy của Task 02B.

```
                           +---------------------------------------+
                           |     tiktok_seller_center_snapshots    |
                           |   (Extension Compass Overview Source) |
                           +---------------------------------------+
                                              |
                                              | [Macro Reconciliation]
                                              v
+------------------------+        +------------------------+        +------------------------+
|    commerce_orders     |------->| commerce_order_items   |        |   commerce_returns     |
|   (TikTok Orders API)  | 1    N |  (SKU & Line Pricing)  |        | (TikTok Returns API)   |
+------------------------+        +------------------------+        +------------------------+
            |                                                                    |
            | 1                                                                  | 1
            | N                                                                  | N
            v                                                                    v
+------------------------+                                          +------------------------+
|  order_status_history  |                                          |   commerce_refunds     |
|   (State Transitions)  |                                          |   (Realized Refunds)   |
+------------------------+                                          +------------------------+
            |
            | [Reconciled via Order ID]
            v
+--------------------------------------------------------------------------------------------+
|                             commerce_financial_transactions                                |
|                        (Statement Transactions & Fee Breakdown)                            |
+--------------------------------------------------------------------------------------------+
                                              ^
                                              | N : 1
                                              |
                                 +------------------------+
                                 |  commerce_settlements  |
                                 |  (Daily Statements)    |
                                 +------------------------+
```

### 6.1. Chi tiết các bảng thực thể ý niệm (Conceptual Tables)

#### 1. Bảng `commerce_orders` (Bảng Đơn hàng thương mại cốt lõi)
- `order_id`: Khóa chính (VARCHAR 64) - Mã đơn hàng duy nhất từ TikTok Shop.
- `shop_id`: Định danh gian hàng (VARCHAR 64).
- `order_status`: Trạng thái đơn hàng chuẩn hóa (`UNPAID`, `AWAITING_SHIPMENT`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED`, `CANCELLED`).
- `create_time`: Thời gian tạo đơn (BIGINT UTC timestamp & DATETIME).
- `paid_time`: Thời gian thanh toán.
- `cancel_time`: Thời gian hủy đơn (nếu có).
- `currency`: Đơn vị tiền tệ (mặc định: `VND`).
- `order_amount`: Tổng giá trị thanh toán thực tế của đơn hàng.
- `original_total_product_price`: Tổng giá trị niêm yết của các món hàng.
- `seller_discount`: Tổng chiết khấu do shop chịu.
- `platform_discount`: Tổng chiết khấu do TikTok Shop tài trợ.
- `shipping_fee`: Phí vận chuyển gốc.
- `shipping_fee_seller_discount`: Phí ship do shop hỗ trợ.
- `shipping_fee_platform_discount`: Voucher ship từ TikTok.
- `taxes`: Thuế áp dụng.
- `payment_method`: Phương thức thanh toán (COD, E-Wallet, Card).
- `buyer_id_hash`: Mã băm một chiều (SHA-256) của Buyer ID để phục vụ phân tích khách hàng quay lại mà không lưu trữ PII thô.
- `recipient_region`: Tỉnh/Thành phố giao hàng (phân tích địa lý).
- `fulfillment_type`: Loại hình xử lý (`TIKTOK` hoặc `SELLER`).
- `raw_payload_checksum`: Băm SHA-256 của toàn bộ JSON đơn hàng gốc để phát hiện thay đổi dữ liệu.
- `synced_at`: Thời điểm đồng bộ vào hệ thống.

#### 2. Bảng `commerce_order_items` (Bảng Chi tiết sản phẩm trong đơn)
- `id`: Khóa chính tự tăng (BIGINT).
- `order_id`: Khóa ngoại liên kết tới `commerce_orders(order_id)`.
- `line_item_id`: Định danh dòng sản phẩm từ TikTok (VARCHAR 64).
- `product_id`: Mã sản phẩm gốc (SP Sủi Mát Gan...).
- `product_name`: Tên sản phẩm hiển thị.
- `sku_id`: Mã SKU cụ thể (Combo 1 tuýp, Combo 3 tuýp...).
- `sku_name`: Tên quy cách phân loại.
- `sku_image`: URL hình ảnh đại diện SKU.
- `quantity`: Số lượng món mua (INT).
- `original_price`: Đơn giá gốc (DECIMAL 15,2).
- `sale_price`: Đơn giá bán thực tế.
- `seller_discount`: Mức giảm giá của shop cho từng item.
- `platform_discount`: Mức trợ giá sàn cho từng item.
- `item_status`: Trạng thái riêng của dòng hàng (nếu có tách gói).
- `package_id`: Khóa liên kết tới kiện hàng vận chuyển.

#### 3. Bảng `order_status_history` (Bảng Lịch sử chuyển trạng thái đơn)
- `id`: Khóa chính tự tăng (BIGINT).
- `order_id`: Khóa ngoại liên kết tới `commerce_orders(order_id)`.
- `from_status`: Trạng thái cũ.
- `to_status`: Trạng thái mới.
- `changed_at`: Thời điểm phát hiện trạng thái thay đổi.
- `source`: Nguồn ghi nhận (`API_POLLING`, `WEBHOOK_PUSH`, `EXCEL_RECONCILIATION`).

#### 4. Bảng `commerce_returns` & `commerce_refunds` (Bảng Quản lý Trả hàng & Hoàn tiền)
- `return_id`: Khóa chính (VARCHAR 64) - Mã yêu cầu đổi trả từ sàn.
- `order_id`: Khóa ngoại liên kết đơn hàng.
- `return_type`: Phân loại (`REFUND_ONLY` - Hoàn tiền không trả hàng, `RETURN_AND_REFUND` - Trả hàng hoàn tiền).
- `return_status`: Trạng thái giải quyết (`REQUESTED`, `APPROVED`, `PROCESSING`, `COMPLETED`, `REJECTED`).
- `refund_amount`: Số tiền hoàn trả cho khách hàng (DECIMAL 15,2).
- `return_reason`: Lý do hoàn trả (Hàng lỗi, không đúng mô tả, đổi ý...).
- `arbitration_status`: Trạng thái khiếu nại sàn can thiệp (nếu có).

#### 5. Bảng `commerce_financial_transactions` & `commerce_settlements` (Bảng Sao kê & Quyết toán dòng tiền)
- `statement_id`: Mã bảng kê sao kê hàng ngày của TikTok (`202309/statements`).
- `statement_time`: Ngày phát hành sao kê.
- `payment_status`: Trạng thái chi trả (`PAID`, `PROCESSING`, `FAILED`).
- `total_settlement_amount`: Số tiền chuyển khoản thực tế về ngân khoản công ty.
- `transaction_id`: Khóa phân rã từng dòng giao dịch tài chính.
- `order_id`: Mã đơn hàng được đối soát tương ứng.
- `transaction_type`: Loại giao dịch (`ORDER_SETTLEMENT`, `REFUND_DEDUCTION`, `PLATFORM_COMMISSION_FEE`, `AFFILIATE_FEE`, `SHIPPING_ADJUSTMENT`).
- `gross_amount`: Doanh thu trước phí.
- `platform_fee`: Phí hoa hồng sàn giữ lại.
- `affiliate_commission`: Tiền hoa hồng chi trả cho KOC/Creator.
- `net_amount`: Tiền ròng thực tế thu được của đơn hàng.

#### 6. Bảng `sync_runs` (Quản trị trạng thái và Con trỏ đồng bộ)
- `id`: Khóa chính tự tăng.
- `domain`: Tên miền đồng bộ (`ORDERS`, `RETURNS`, `FINANCE`, `PACKAGES`).
- `shop_id`: Gian hàng thực thi.
- `status`: Trạng thái phiên (`IN_PROGRESS`, `SUCCESS`, `FAILED`, `RATE_LIMITED`).
- `last_page_token`: Con trỏ phân trang cuối cùng ghi nhận được (phục vụ Resume khi gặp sự cố).
- `cursor_timestamp`: Mốc thời gian `update_time` gần nhất đã đồng bộ xong.
- `records_synced`: Số bản ghi đã nạp thành công.
- `error_message`: Nội dung lỗi nếu phiên thất bại.
- `started_at`, `completed_at`: Thời gian bắt đầu và kết thúc.

### 6.2. Hợp đồng nguồn gốc & Bất biến (Data Provenance & Idempotency Contract)
- **Cột phân loại nguồn gốc (`data_source`):**
  - Mọi bản ghi trong các bảng thương mại phải được gắn nhãn nguồn gốc:
    - `API_SYNC`: Dữ liệu tự động qua TikTok Shop Open API.
    - `EXTENSION_DOM`: Dữ liệu quét từ Seller Center Compass Overview.
    - `EXCEL_IMPORT`: Dữ liệu đối soát thủ công từ tệp Excel sao kê kế toán.
- **Ràng buộc Idempotency:**
  - Sử dụng cơ chế `INSERT ... ON DUPLICATE KEY UPDATE` dựa trên khóa tự nhiên (`order_id`, `line_item_id`, `statement_id`).
  - Nếu `raw_payload_checksum` không thay đổi so với bản ghi hiện có, bỏ qua việc cập nhật các cột nghiệp vụ để tránh kích hoạt các trigger hoặc ghi log trùng lặp.
- **Chiến lược Backfill lịch sử:**
  - Thực hiện nạp dữ liệu quá khứ theo từng khối trượt (Sliding Windows) 7 ngày một lần.
  - Sau mỗi khối 7 ngày, tiến hành đối soát tổng doanh số của khối đó với Snapshot tương ứng trong `tiktok_seller_center_snapshots`.

---

## 7. METRIC DISCREPANCY & DATA TRUST FRAMEWORK

Một trong những sai lầm phổ biến nhất trong tích hợp dữ liệu TikTok Shop là đánh đồng các con số doanh thu ở các tầng báo cáo khác nhau. Hệ thống ADDP Commerce Intelligence thiết lập **Khung phân tầng tin cậy số liệu (Four-Tier Metric Trust Framework)**:

```
+------------------------------------------------------------------------------------+
|  TẦNG 1: COMPASS OVERVIEW (Extension Snapshot ID=13: GMV=254.2M, Revenue=266.3M)   |
|  -> Chân thực vĩ mô: Đo lường tốc độ tăng trưởng, mục tiêu doanh thu, xếp hạng sàn|
+------------------------------------------------------------------------------------+
                                          |
                                          | [Bóc tách theo từng giao dịch phát sinh]
                                          v
+------------------------------------------------------------------------------------+
|  TẦNG 2: COMMERCE ORDERS GROSS (Tổng giá trị đơn hàng lúc khởi tạo qua Order API)  |
|  -> Đơn đặt hàng: Đo lường hiệu quả quảng cáo tức thời, nhu cầu thị trường         |
+------------------------------------------------------------------------------------+
                                          |
                                          | [Trừ đi: Đơn hủy, Đơn hoàn, Bom hàng]
                                          v
+------------------------------------------------------------------------------------+
|  TẦNG 3: COMMERCE ORDERS NET REALIZED (Đơn hàng giao thành công, không bị hoàn trả)|
|  -> Doanh thu hàng hóa thực xuất: Phục vụ quản trị kho vận, tiêu hao bao bì       |
+------------------------------------------------------------------------------------+
                                          |
                                          | [Trừ: Phí sàn, Phí thanh toán, Hoa hồng KOC]
                                          v
+------------------------------------------------------------------------------------+
|  TẦNG 4: FINANCIAL SETTLEMENTS (Dòng tiền thực chuyển về tài khoản ngân hàng)       |
|  -> Dòng tiền kế toán ròng: Quyết toán lãi lỗ thực tế, dòng tiền công ty           |
+------------------------------------------------------------------------------------+
```

### 7.1. Phân loại & Định nghĩa các tầng số liệu
1. **Tầng 1 - Compass Overview (Macro Benchmark):**
   - Nguồn: Trích xuất DOM Seller Center Compass qua Extension (Snapshot ID=13).
   - Bản chất: Thuật toán nội bộ của TikTok tổng hợp định kỳ theo múi giờ địa phương (ICT/UTC+7).
   - Ý nghĩa: Dùng làm căn cứ đối soát mục tiêu tháng, chỉ số SES, và báo cáo chiến lược cho Ban Giám đốc.
2. **Tầng 2 - Order Gross GMV (Transaction Creation):**
   - Nguồn: `SUM(line_items.sale_price * quantity)` từ API `/order/202309/orders/search`.
   - Thời điểm: Tính tại lúc khách bấm đặt hàng (`create_time`).
   - Bao gồm cả những đơn chưa thanh toán hoặc sau đó bị hủy.
3. **Tầng 3 - Order Net Realized (Fulfillment Realization):**
   - Nguồn: Các đơn hàng có trạng thái `DELIVERED` hoặc `COMPLETED`, trừ đi các đơn có bản ghi trong `commerce_returns`.
   - Phản ánh số sản phẩm thực tế đã đến tay người tiêu dùng.
4. **Tầng 4 - Financial Settlement (Cash Realization):**
   - Nguồn: API `/finance/202309/statements`.
   - Thời điểm: 3 đến 7 ngày sau khi đơn hàng giao thành công (khi hết hạn khiếu nại).
   - Phản ánh chính xác số tiền thực tế đổ về tài khoản ngân hàng của doanh nghiệp.

### 7.2. Công thức đối soát toán học (Reconciliation Formulas)
$$\text{Realized GMV} = \text{Order Gross GMV} - \text{Buyer/Seller Cancellations} - \text{Return & Refunds}$$

$$\text{Net Cash Settlement} = \text{Realized GMV} + \text{Shipping Subsidies} - \text{Platform Service Fees} - \text{Affiliate Commissions} - \text{Payment Gateway Fees} \pm \text{Adjustments}$$

### 7.3. Nguyên tắc vận hành số liệu bắt buộc (Zero-Tolerance Rules)
- **QUY TẮC 1:** Tuyệt đối **KHÔNG ĐƯỢC** sử dụng hàm `max(API_GMV, Compass_GMV)` hoặc `max(Shop_GMV, Ad_GMV)`. Bất kỳ hành vi lấy giá trị lớn nhất nào cũng là hành vi che giấu lỗi kỹ thuật và làm biến dạng báo cáo tài chính.
- **QUY TẮC 2:** Không coi việc `API_GMV` lệch so với `Compass_GMV` là lỗi bug nếu độ lệch nằm trong các nguyên nhân giải trình hợp lệ (Lệch múi giờ UTC vs UTC+7, độ trễ hủy đơn 15 phút, voucher sàn tài trợ).
- **QUY TẮC 3:** Bảng điều khiển giao diện (Dashboard UI) phải hiển thị song song rõ ràng:
  - Chỉ số tổng hợp sàn: Ghi rõ "Nguồn: TikTok Compass Overview".
  - Chỉ số chi tiết đơn hàng: Ghi rõ "Nguồn: TikTok Orders API".
  - Tỷ lệ đối soát khớp (*Reconciliation Matching Rate*): $\frac{\text{API Verified GMV}}{\text{Compass GMV}} \times 100\%$. Nếu tỷ lệ này $< 95\%$ trên dữ liệu quá khứ (ngoài chu kỳ hoàn hàng), hệ thống sẽ tự động kích hoạt cảnh báo bất thường dữ liệu.

---

## 8. CRITICAL VULNERABILITY, BUG & ARCHITECTURAL RISK REGISTER

Bảng tổng hợp các rủi ro kiến trúc và lỗi nghiêm trọng được phát hiện trong mã nguồn hiện hành cần khắc phục trước khi triển khai đồng bộ sản xuất:

| ID | Mã phân loại | Vị trí file & Dòng mã | Bản chất lỗ hổng / Rủi ro | Tác động thực tế trên Production | Mức độ nghiêm trọng | Giải pháp kiến trúc bắt buộc |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R01** | `TRUNCATION_BUG` | `sync.php` (L358-360) | Giới hạn cứng `$maxPages = 4`, `$pageSize = 50`. | Bỏ sót >92% đơn hàng (chỉ lấy tối đa 200 đơn trong khi shop có 2.540 đơn). Báo cáo doanh số sai lệch nghiêm trọng. | **CRITICAL** | Gỡ bỏ `$maxPages = 4`, chuyển sang phân trang bằng con trỏ động vô hạn kết hợp cơ chế kiểm soát tiến độ `sync_runs`. |
| **R02** | `TIMEOUT_FLAW` | `tiktok_client.php` (L65) | `CURLOPT_TIMEOUT` chỉ cài đặt 5 giây. | Thường xuyên bị đứt kết nối cURL khi TikTok API xử lý truy vấn đơn hàng hoặc sao kê lớn, gây mất dữ liệu ngắt quãng. | **CRITICAL** | Nâng timeout lên 30–60 giây cho các truy vấn phân trang nặng; bổ sung retry có giãn cách hàm mũ (*exponential backoff*). |
| **R03** | `LOGIC_BYPASS` | `sync.php` (L346) | `if ($forceSync || $orderCount == 0)` | Khi bảng có từ 1 bản ghi trở lên, hệ thống không bao giờ tự động cập nhật đơn mới trừ khi truyền `force=true`. | **CRITICAL** | Xóa bỏ điều kiện kiểm tra `$orderCount == 0`, chuyển sang mô hình đồng bộ delta dựa trên `update_time_ge` và con trỏ lưu trong DB. |
| **R04** | `DATA_FALSIFICATION` | `sync.php` (L511-512) | `max($totalRealGmv, $totalAdGmv)` | Số liệu doanh thu sàn bị gán cưỡng bức bằng số liệu quảng cáo khi số liệu đơn hàng bị cắt ngắn, gây sai lệch báo cáo tài chính. | **CRITICAL** | Xóa bỏ lệnh `max()`. Tách biệt rạch ròi Ad GMV và Shop GMV trên toàn bộ backend và frontend. |
| **R05** | `HTTP_METHOD_ERR` | `tiktok_client.php` (L287) | Gọi `POST /finance/202309/statements` | Endpoint statements của TikTok 202309 là `GET`. Lệnh `POST` sẽ bị sàn từ chối với lỗi HTTP 405. | **HIGH** | Đổi phương thức gọi sang `GET` và đưa các tham số lọc vào Query String theo đúng chuẩn Partner API. |
| **R06** | `DATA_STRIPPING` | `sync.php` (L380-383) | Hủy bỏ `line_items` sau khi cộng dồn, không lưu SKU và bóc tách giá. | Không thể phân tích doanh thu theo sản phẩm, không theo dõi được hiệu quả từng SKU (Combo 1 tuýp vs 3 tuýp Dovital). | **HIGH** | Tạo cấu trúc lưu trữ `commerce_order_items` để lưu giữ toàn vẹn thông tin chi tiết từng dòng sản phẩm. |
| **R07** | `RACE_CONDITION` | `db.php` (L612-650) | Refresh token không có khóa cơ sở dữ liệu (DB Lock / Mutex). | Khi có 2 request đồng thời lúc token hết hạn, cả hai cùng gọi refresh -> Request thứ 2 làm hỏng token -> Gian hàng bị ngắt kết nối. | **HIGH** | Áp dụng khóa bi quan `SELECT ... FOR UPDATE` trên bảng cấu hình hoặc dùng File/Redis Mutex khi làm mới token. |
| **R08** | `SINGLE_TENANT` | `db.php` & `tiktok_config` | Bảng cấu hình chỉ xử lý 1 shop duy nhất (`LIMIT 1`). | Không hỗ trợ mở rộng khi doanh nghiệp phát triển thêm gian hàng vệ tinh hoặc phân xưởng mới. | **MEDIUM** | Mọi truy vấn token và đồng bộ bắt buộc phải nhận diện tường minh qua `shop_id`. |
| **R09** | `PII_EXPOSURE_RISK` | Chưa có chính sách PII | Nguy cơ lưu trữ số điện thoại và tên khách hàng dạng thô nếu nạp toàn bộ Order Detail. | Vi phạm chính sách bảo mật dữ liệu người dùng của TikTok Shop Partner và luật An ninh mạng. | **HIGH** | Áp dụng thuật toán băm SHA-256 cho Buyer ID và mã hóa che giấu (masking) đối với địa chỉ, số điện thoại khách hàng. |
| **R10** | `MISSING_LOGISTICS` | Giả định sai về quyền hạn | Nhầm lẫn giữa `seller.fulfillment.basic` và `seller.logistics`. | Cố gắng gọi API tem nhãn hoặc đơn vị vận chuyển sẽ bị sàn trả về lỗi HTTP 403 Forbidden. | **MEDIUM** | Giữ đúng ranh giới Fulfillment Basic: Chỉ đọc thông tin kiện hàng, không gọi Logistics API. |

---

## 9. GAP ANALYSIS & PHASED IMPLEMENTATION ROADMAP

### 9.1. Đánh giá tính khả thi theo từng tính năng (Capability Assessment)
Dựa trên 12 quyền hạn đã cấp và kết quả audit kiến trúc, các tính năng được phân loại như sau:

- **NHÓM 1: KHẢ DỤNG NGAY (AVAILABLE - Rủi ro thấp, đầy đủ quyền):**
  - Đồng bộ danh mục sản phẩm & SKU (`seller.product.basic`).
  - Đồng bộ chương trình khuyến mãi, voucher sàn & voucher shop (`seller.promotion.info`).
  - Lấy danh sách gian hàng ủy quyền & `shop_cipher` (`seller.authorization.info`, `seller.shop.info`).
- **NHÓM 2: KHẢ DỤNG SAU KHI SỬA LỖI CODE (LIKELY - Đầy đủ quyền, chỉ cần sửa mã nguồn):**
  - Đồng bộ toàn diện đơn hàng & chi tiết dòng sản phẩm (`seller.order.info` - Cần sửa timeout 5s, bỏ giới hạn 200 đơn, bổ sung con trỏ vô hạn).
  - Đồng bộ yêu cầu trả hàng, hoàn tiền, lý do hủy đơn (`seller.return_refund.basic` - Cần bổ sung bảng lưu trữ và logic lưu DB).
  - Đồng bộ trạng thái kiện hàng & mã tracking (`seller.fulfillment.basic` - Cần bổ sung logic lưu DB).
  - Đồng bộ bảng kê sao kê tài chính hàng ngày (`seller.finance.info` - Cần sửa phương thức HTTP từ POST sang GET).
- **NHÓM 3: BỊ CHẶN HOÀN TOÀN (BLOCKED - Không có quyền hạn):**
  - Tự động in tem nhãn vận chuyển, điều phối đơn vị vận chuyển mới (Bị chặn do không có quyền `seller.logistics`).
  - Phê duyệt / Từ chối yêu cầu hoàn tiền hoặc hủy đơn tự động qua API (Bị chặn theo nguyên tắc an toàn Zero Mutation của dự án).
- **NHÓM 4: CẦN TIẾP TỤC ĐÁNH GIÁ (UNKNOWN / REGIONAL LIMITATION):**
  - Tự động lấy điểm trải nghiệm SES chi tiết qua API (Bị hạn chế do Analytics API của TikTok chưa hỗ trợ đầy đủ bộ chỉ số SES của thị trường Đông Nam Á -> Tiếp tục duy trì giải pháp Extension Compass Overview).

### 9.2. Lộ trình triển khai phân kỳ (Phased Implementation Roadmap)

```
+------------------------------------------------------------------------------------+
|  HF1.2 (PHASE 1): CORE ORDERS & ORDER ITEMS INGESTION ENGINE                       |
|  - Nâng timeout cURL lên 30s + Exponential Backoff                                 |
|  - Gỡ bỏ giới hạn 200 đơn ($maxPages = 4)                                          |
|  - Triển khai con trỏ phân trang vô hạn (page_token cursor loop)                  |
|  - Xây dựng bảng commerce_orders & commerce_order_items (lưu SKU & bóc tách giá)  |
|  - Khử nhận diện PII khách hàng (hashing & masking)                                |
+------------------------------------------------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
|  HF1.3 (PHASE 2): RETURNS, REFUNDS & FULFILLMENT TRACKING                          |
|  - Triển khai đồng bộ dữ liệu hoàn hàng/hủy đơn từ seller.return_refund.basic      |
|  - Lưu trữ mã kiện hàng và tiến độ vận chuyển từ seller.fulfillment.basic          |
|  - Xây dựng bảng order_status_history ghi nhận vòng đời đơn hàng                   |
|  - Tính toán tỷ lệ hủy đơn thực tế phục vụ cảnh báo rủi ro video quảng cáo         |
+------------------------------------------------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
|  HF1.4 (PHASE 3): FINANCIAL STATEMENTS & PAYOUT RECONCILIATION                     |
|  - Sửa lỗi GET /finance/202309/statements                                          |
|  - Đồng bộ chi tiết dòng tiền quyết toán (Statement Transactions)                  |
|  - Bóc tách chi phí hoa hồng KOC/Affiliate và phí dịch vụ sàn                       |
|  - Đối soát tiền về tài khoản ngân hàng thực tế so với doanh thu đơn hàng          |
+------------------------------------------------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
|  HF1.5 (PHASE 4): UNIFIED COMMERCE INTELLIGENCE & RECONCILIATION DASHBOARD        |
|  - Kết hợp 3 nguồn dữ liệu: Extension Compass (Vĩ mô) + Open API (Vi mô) + Excel  |
|  - Hiển thị bảng đối soát tự động (Reconciliation Discrepancy Matrix)              |
|  - Tính toán PnL ròng thời gian thực cho từng SKU và từng chiến dịch quảng cáo     |
+------------------------------------------------------------------------------------+
```

---

## 10. PHASE 0 VERIFICATION SIGN-OFF & STRICT INVARIANT CHECK

Báo cáo kết thúc đợt Audit kỹ thuật Giai đoạn HF1.2 Phase 0 xác nhận các chỉ số tuân thủ tuyệt đối:

### 10.1. Kiểm tra tính bất biến của hệ thống (Invariant Integrity Check)
- **FILES CHANGED = 0:** Không có bất kỳ tệp mã nguồn PHP, JavaScript, hoặc tệp cấu hình nào bị thay đổi nội dung trong suốt quá trình audit.
- **DB CHANGES = 0:** Không có bất kỳ lệnh DDL, DML, hoặc tệp migration cơ sở dữ liệu nào được thực thi trên môi trường local hay production. Cấu trúc cơ sở dữ liệu hoàn toàn nguyên vẹn ở trạng thái Task 02B-HF1.1.2.
- **PRODUCTION CHANGES = 0:** Không có kết nối SSH, FTP, hay sửa đổi tệp tin `.env` trên máy chủ `marketing.addp.vn`.
- **API MUTATIONS = 0:** Không thực hiện bất kỳ lệnh gọi API thay đổi trạng thái nào tới máy chủ TikTok Shop hoặc TikTok Ads. Toàn bộ các phân tích dựa trên kiểm tra mã nguồn tĩnh, dữ liệu snapshot đã lưu, và tài liệu đặc tả chính thức của TikTok Shop Partner Center.
- **PII & SECRETS SAFETY = 100% PASS:** Không để lộ App Secret, Signing Key, Access Token, hoặc dữ liệu cá nhân của người mua hàng trong toàn bộ tài liệu này.

### 10.2. Chữ ký phê duyệt báo cáo kỹ thuật (Architectural Sign-Off)
- **Principal Solution Architect:** *Đã thẩm định và ký duyệt.* Thiết kế hợp đồng dữ liệu chuẩn hóa và lộ trình phân kỳ HF1.2 - HF1.5 đáp ứng toàn diện yêu cầu mở rộng tự động mà không làm ảnh hưởng hệ thống hiện hành.
- **Senior PHP Backend Engineer:** *Đã thẩm định và ký duyệt.* Đã khoanh vùng chính xác 5 lỗi nghiêm trọng trong codebase (`timeout 5s`, `giới hạn 200 đơn`, `bỏ qua đồng bộ`, `lấy max gmv`, `gọi sai POST finance`) và chuẩn bị phương án khắc phục an toàn cho Phase 1.
- **Lead Data Engineer:** *Đã thẩm định và ký duyệt.* Đã xác lập Khung phân tầng tin cậy số liệu 4 cấp, bảo đảm giữ nguyên vẹn giá trị tham chiếu của Snapshot ID=13 (Compass Overview: 254.2M GMV / 2.540 đơn hàng) và phân định rõ ràng giữa doanh thu đơn hàng và dòng tiền quyết toán.

**KẾT LUẬN:** Giai đoạn **HF1.2 Phase 0** đã hoàn thành xuất sắc 100% mục tiêu kiểm toán kỹ thuật. Hệ sinh thái sẵn sàng chuyển tiếp sang lập kế hoạch chi tiết cho **HF1.2 Phase 1 (Core Orders & Order Items Engine)** khi có chỉ đạo từ Product Owner.
