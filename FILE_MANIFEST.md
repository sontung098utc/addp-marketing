# FILE MANIFEST — MARKETING_ADDP_P0_FINAL_RELEASE
**Gói phát hành:** `marketing_addp_p0_final_release.zip`  
**Thời điểm đóng gói:** 2026-10-09T20:45:00+07:00  
**SHA-256:** `59874b3fcb958716d8261a79b603d6d75c26d39ec7cd433b64be5ab3b0291385`  
**Dung lượng:** 520.12 KB  
**Tổng số file:** 50  

---

## 1. DANH SÁCH FILE TRONG GÓI PHÁT HÀNH

Tất cả các file bên dưới có đường dẫn tương đối chính xác với thư mục gốc webroot `public_html/`:

| Đường Dẫn Tương Đối (`public_html/`) | Phân Loại | Kích Thước (Bytes) | Mục Đích / Mô Tả Thay Đổi |
| :--- | :--- | :--- | :--- |
| `.htaccess` | `STATIC_ASSET` | 545 | Web frontend asset |
| `api/auth_guard.php` | `BACKEND_API` | 18.341 | Production verified backend service |
| `api/campaigns.php` | `BACKEND_API` | 16.575 | MODIFIED: Real video delivery (zero fake click/impression formula) |
| `api/commerce_ads_ingestion_service.php` | `BACKEND_API` | 68.214 | Production verified backend service |
| `api/commerce_ads_service.php` | `BACKEND_API` | 97.329 | MODIFIED: Product GMV Max cost enrichment & evaluation |
| `api/commerce_affiliate_service.php` | `BACKEND_API` | 36.327 | MODIFIED: Official Affiliate API ingestion (zero fake rates) |
| `api/commerce_aftersales_service.php` | `BACKEND_API` | 60.535 | Production verified backend service |
| `api/commerce_analytics_service.php` | `BACKEND_API` | 67.408 | Production verified backend service |
| `api/commerce_customer_service.php` | `BACKEND_API` | 93.581 | Production verified backend service |
| `api/commerce_daily_aggregate_service.php` | `BACKEND_API` | 58.197 | Production verified backend service |
| `api/commerce_dashboard.php` | `BACKEND_API` | 110.323 | MODIFIED: Live dual ROAS + affiliate sync + product cost endpoints |
| `api/commerce_finance_service.php` | `BACKEND_API` | 42.553 | Production verified backend service |
| `api/commerce_loss_engine.php` | `BACKEND_API` | 27.111 | Production verified backend service |
| `api/commerce_product_cost_service.php` | `BACKEND_API` | 10.773 | NEW: SPU unit economics & break-even ROAS service |
| `api/commerce_product_service.php` | `BACKEND_API` | 29.698 | Production verified backend service |
| `api/commerce_report.php` | `BACKEND_API` | 1.449 | Production verified backend service |
| `api/commerce_reporting_service.php` | `BACKEND_API` | 66.948 | Production verified backend service |
| `api/commerce_shopee_service.php` | `BACKEND_API` | 33.710 | Production verified backend service |
| `api/commerce_sync_orchestrator.php` | `BACKEND_API` | 97.871 | MODIFIED: Affiliate domain sync orchestration |
| `api/commerce_sync_service.php` | `BACKEND_API` | 58.338 | Production verified backend service |
| `api/commerce_sync.php` | `BACKEND_API` | 10.720 | Production verified backend service |
| `api/commerce_transient_cache.php` | `BACKEND_API` | 4.919 | Production verified backend service |
| `api/connector_token.php` | `BACKEND_API` | 15.401 | Production verified backend service |
| `api/creatives_data.php` | `BACKEND_API` | 14.788 | MODIFIED: Real video cancel attribution (zero mock templates) |
| `api/download_extension.php` | `BACKEND_API` | 803 | Production verified backend service |
| `api/gemini_analyze.php` | `BACKEND_API` | 132.084 | Production verified backend service |
| `api/login.php` | `BACKEND_API` | 2.405 | Production verified backend service |
| `api/oauth_ads.php` | `BACKEND_API` | 6.461 | Production verified backend service |
| `api/oauth.php` | `BACKEND_API` | 11.113 | Production verified backend service |
| `api/rules.php` | `BACKEND_API` | 3.589 | Production verified backend service |
| `api/shop_diagnosis.php` | `BACKEND_API` | 69.117 | Production verified backend service |
| `api/sync.php` | `BACKEND_API` | 28.714 | Production verified backend service |
| `api/tiktok_client.php` | `BACKEND_API` | 38.280 | MODIFIED: Official searchAffiliateOrders API client |
| `api/tiktok_gmv_max_api_client.php` | `BACKEND_API` | 24.630 | Production verified backend service |
| `api/webhook.php` | `BACKEND_API` | 5.477 | Production verified backend service |
| `assets/index-C0DTiUN4.css` | `STATIC_ASSET` | 16.902 | Web frontend asset |
| `assets/index-spkbm3FJ.js` | `STATIC_ASSET` | 984.489 | Web frontend asset |
| `extension/content_script.js` | `STATIC_ASSET` | 24.495 | Web frontend asset |
| `extension/manifest.json` | `STATIC_ASSET` | 900 | Web frontend asset |
| `extension/popup.html` | `STATIC_ASSET` | 6.571 | Web frontend asset |
| `extension/popup.js` | `STATIC_ASSET` | 14.441 | Web frontend asset |
| `favicon.svg` | `STATIC_ASSET` | 9.522 | Web frontend asset |
| `icons.svg` | `STATIC_ASSET` | 5.031 | Web frontend asset |
| `index.html` | `ENTRYPOINT` | 1.723 | Vite production HTML application entrypoint |
| `migrations/20261009_021_create_commerce_affiliate_orders.sql` | `MIGRATION` | 6.439 | Database table creation / safe archival rollback script |
| `migrations/20261009_021_rollback_commerce_affiliate_orders.sql` | `MIGRATION` | 1.374 | Database table creation / safe archival rollback script |
| `migrations/20261009_022_create_commerce_product_costs.sql` | `MIGRATION` | 4.840 | Database table creation / safe archival rollback script |
| `migrations/20261009_022_rollback_commerce_product_costs.sql` | `MIGRATION` | 1.342 | Database table creation / safe archival rollback script |
| `tiktok_audit_extension.zip` | `STATIC_ASSET` | 13.558 | Web frontend asset |
| `VERSION.json` | `STATIC_ASSET` | 676 | Web frontend asset |

---

## 2. DANH SÁCH FILE BẢO VỆ — NGHIÊM CẤM GHI ĐÈ (EXCLUDED FILES)

Các file sau đây **KHÔNG ĐƯỢC PHÉP ĐÓNG GÓI HOẶC GHI ĐÈ** trên máy chủ sản xuất để bảo vệ an toàn thông tin nhạy cảm và cơ sở dữ liệu:

| Tệp Loại Trừ | Lý Do / Rủi Ro An Toàn |
| :--- | :--- |
| `api/db.php` | Chứa thông tin đăng nhập database production, PDO connection string. |
| `api/config.php` | Chứa biến môi trường, khóa ký JWT/HMAC bí mật, App Secret của TikTok. |
| `.env` | Chứa secret keys và token production. |
| `*.log`, `cache/*` | Dữ liệu runtime / log của máy chủ. |
| `node_modules/`, `.git/` | Mã nguồn phát triển không thuộc webroot. |
