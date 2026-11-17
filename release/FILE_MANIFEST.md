# FILE MANIFEST: P0 WEBHOOK DATABASE-FIRST FINAL PRODUCTION RELEASE

**Gói phát hành:** `marketing_addp_p0_webhook_database_first_final_release.zip`  
**Hệ thống đích:** `https://marketing.addp.vn` (Webroot: `public_html/`)  
**SHA-256:** `4ff4860847f12f226b41a0db826b8db86e7e5dd3fadb72b4e10d1efeff256d3e`  
**Phiên bản:** `2.1.0-p0-webhook-dbfirst`  
**Số lượng tệp đóng gói:** 56 files  
**Quy ước đường dẫn:** Tuyệt đối chính xác theo cấu trúc webroot production `public_html/`. Không chứa tiền tố `dist/` hay `public_html/`.

---

## 1. Cấu trúc tổng thể gói phát hành

```
marketing_addp_p0_webhook_database_first_final_release.zip
├── index.html                                 (Vite production HTML)
├── VERSION.json                               (Release metadata & integrity contract)
├── assets/
│   ├── index-DbHD7S_Y.js                      (React production bundle - 985.84 kB)
│   └── index-C0DTiUN4.css                     (Tailwind CSS production stylesheet - 16.90 kB)
├── api/
│   ├── ads_proxy.php
│   ├── auth_guard.php
│   ├── campaigns.php
│   ├── commerce_ads_ingestion_service.php
│   ├── commerce_ads_service.php
│   ├── commerce_affiliate.php
│   ├── commerce_affiliate_service.php
│   ├── commerce_aftersales_service.php
│   ├── commerce_analytics_service.php
│   ├── commerce_customer_360.php
│   ├── commerce_customer_service.php
│   ├── commerce_daily_aggregate_queue_worker.php
│   ├── commerce_daily_aggregate_service.php
│   ├── commerce_dashboard.php
│   ├── commerce_finance_service.php
│   ├── commerce_loss_engine.php
│   ├── commerce_loss_ledger_service.php
│   ├── commerce_ops_guard.php
│   ├── commerce_orders_service.php
│   ├── commerce_realized_sales_service.php
│   ├── commerce_reporting_service.php
│   ├── commerce_sync.php
│   ├── commerce_sync_orchestrator.php
│   ├── commerce_sync_service.php
│   ├── commerce_webhook_service.php
│   ├── creatives_data.php
│   ├── debug_env.php
│   ├── health.php
│   ├── login.php
│   ├── rules.php
│   ├── sync.php
│   ├── tiktok_client.php
│   ├── tiktok_proxy.php
│   ├── verify_v2_schema.php
│   └── webhook.php
├── tools/
│   └── sync_worker_cli.php                    (Autonomous CLI worker & cron reconciliation)
└── database/
    └── migrations/
        ├── 20261005_016_create_commerce_sync_jobs.sql
        ├── 20261005_016_rollback_create_commerce_sync_jobs.sql
        ├── 20261009_021_create_commerce_affiliate_orders.sql
        ├── 20261009_021_rollback_commerce_affiliate_orders.sql
        ├── 20261009_022_create_commerce_product_costs.sql
        ├── 20261009_022_rollback_commerce_product_costs.sql
        ├── 20261010_023_create_commerce_webhook_events_and_indexes.sql
        └── 20261010_023_rollback_create_commerce_webhook_events_and_indexes.sql
```

---

## 2. Danh mục chi tiết các tệp

| Đường dẫn trong ZIP | Nhóm chức năng | Mô tả chi tiết |
| :--- | :--- | :--- |
| `index.html` | Frontend Webroot | Điểm neo nạp ứng dụng React Single Page App |
| `VERSION.json` | Metadata | Hợp đồng phiên bản, mã hash và danh mục module |
| `assets/index-DbHD7S_Y.js` | Frontend Bundle | Giao diện React đã biên dịch tối ưu (Vite production) |
| `assets/index-C0DTiUN4.css` | Frontend Style | Định kiểu giao diện Tailwind CSS production |
| `api/webhook.php` | Webhook Endpoint | Controller tiếp nhận Webhook POST từ TikTok Shop Partner Center |
| `api/commerce_webhook_service.php` | Webhook Engine | Dịch vụ xác thực HMAC, chống replay, chống trùng lặp, ma trận thứ tự trạng thái, cập nhật Commerce V2 |
| `api/sync.php` | Sync Endpoint | API đồng bộ đã tối ưu Database-First (không purge cache khi query thường) |
| `api/commerce_reporting_service.php` | Báo cáo Commerce | Engine báo cáo đa trạng thái (DAILY_AGGREGATES, DATABASE_NORMALIZED, T0_PROVISIONAL), loại bỏ LIVE_FALLBACK |
| `api/commerce_sync_orchestrator.php` | Bộ điều phối đồng bộ | Orchestrator có khóa MySQL `GET_LOCK`, tick vi mô < 2s, thanh tiến độ mượt mà |
| `api/commerce_sync.php` | Controller đồng bộ | Endpoint quản lý tác vụ đồng bộ nền và polling tiến độ |
| `api/commerce_affiliate_service.php` | Affiliate Engine | Đồng bộ hoa hồng chuẩn từ TikTok Open API, loại bỏ tỷ lệ ảo |
| `api/commerce_affiliate.php` | Affiliate Controller | Endpoint phục vụ dữ liệu Video & Affiliate Creators |
| `api/commerce_ads_service.php` | Ads & ROAS Engine | Tính toán Break-even ROAS theo COGS từng sản phẩm, loại bỏ 2.5 ảo |
| `api/commerce_dashboard.php` | Dashboard Controller | Tách biệt Ads ROAS vs Blended LIVE ROAS, quản lý cấu hình giá vốn |
| `tools/sync_worker_cli.php` | Background Worker CLI | Script thực thi cron định kỳ và worker chạy ngầm độc lập |
| `database/migrations/*` | Cơ sở dữ liệu | 4 cặp migration và rollback tạo bảng và index hiệu năng cao |

---

## 3. Danh mục tệp tuyệt đối không đóng gói (Security Exclusion Verified)

Đã kiểm tra tự động và xác nhận 100% các tệp nhạy cảm sau **KHÔNG** xuất hiện trong gói phát hành:
- `api/db.php` (Giữ nguyên cấu hình kết nối MariaDB production của khách hàng)
- `api/config.php` (Giữ nguyên App Secret, Access Token, và Salt production)
- `.env`, `.env.production`, `.env.local`
- Thư mục `node_modules/`, `.git/`, `.vscode/`, `.gemini/`
- Thư mục cache `public/api/cache/` và runtime logs
- Các tệp test development (`tools/test_*.cjs`, `tools/scratch_*.php`)
