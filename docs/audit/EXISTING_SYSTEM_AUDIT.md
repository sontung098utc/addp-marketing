# ADDP Commerce Intelligence
## Existing System Audit — Deep Technical & Architectural Assessment

> **Classification:** STRICTLY CONFIDENTIAL & READ-ONLY TECHNICAL AUDIT  
> **System Name:** ADDP Commerce Intelligence (formerly TikTok Ads GMV & Shop 360 Platform)  
> **Production Domain:** `marketing.addp.vn`  
> **Target Workspace:** `c:\AdsTiktok`  
> **Auditor Roles:** Senior Software Architect, Senior PHP Engineer, Senior React Engineer, Data Engineer, Technical Auditor  
> **Date:** September 2026  
> **Status:** AUDIT COMPLETED — NO SOURCE CODE OR DATABASE WAS MODIFIED  

---

### 1. Executive Summary

This comprehensive audit evaluates the existing codebase powering `marketing.addp.vn`. The system currently serves as an operational dashboard for TikTok Ads (GMV Max), TikTok Shop Seller operations, Live Streamer performance, Shop Health Audit 360°, and AI-assisted task workflows.

#### Core Findings Summary
1. **The System is Hybrid but Disconnected:** The codebase relies on three disparate data acquisition channels:
   - **TikTok Ads Marketing API v1.3:** Connects directly to fetch auction and GMV Max campaign data.
   - **TikTok Shop Partner Open API (v202309 / v202404):** Fetches authorized shop metadata, products, and a sample of orders.
   - **Chrome Extension (Manifest V3):** Intended to bypass Open API permission limitations on Compass (La bàn dữ liệu) and KOC performance. *Crucial Finding:* The extension currently transmits a **hardcoded static payload** (`total_gmv = 458,337,810 VND`, MoM growth `-43.51%`, etc.) rather than dynamically parsing DOM/network data from Seller Center.
2. **Data Discrepancy Root Causes:** Multiple architectural flaws directly cause figures on the dashboard to deviate from TikTok Seller Center:
   - **Order Sync Capped at 200 Orders:** In both `sync.php` and `shop_diagnosis.php`, pagination stops after a maximum of 4 pages (`$maxPages = 4`, `page_size = 50`). Any store with >200 orders experiences severe data truncation.
   - **Conditional Fetching Freeze:** `sync.php` only calls the TikTok Shop Order API if `count(tiktok_orders) == 0` or `force=true`. Normal user traffic never pulls new orders.
   - **Synthetic & Heuristic Fallbacks:** When API metrics are missing or incomplete, the backend injects estimated formulas (e.g., `clicks = spend / 80`, `impressions = spend / 10`, `vGmv = conversions * 149,000`, `totalShopGmv = max(totalRealGmv, totalAdGmv)`).
   - **Client-Side Simulation Loop:** In `App.jsx`, if `real_shop_id` is not present in `localStorage`, a `setInterval` timer runs every 3 seconds, injecting random additions (`Math.random()`) into live viewers, live sales, and live spend.
3. **Security Vulnerabilities:** Multiple high-severity findings were discovered: hardcoded database credentials and admin passwords in version control, completely unauthenticated API endpoints, direct DELETE endpoints exposed (`test_delete.php`), missing OAuth CSRF state validation, and disabled cURL SSL certificate verification.
4. **Auto-DDL Runtime Overhead:** The `initializeDatabase()` routine executes `SHOW TABLES` and potential `ALTER TABLE` queries on **every single HTTP request** across nearly all API endpoints.

---

### 2. Current Architecture

```
                                    +------------------------------------------+
                                    |              CLIENT BROWSER              |
                                    |                                          |
                                    |   React 18 SPA (Vite)                    |
                                    |   - App.jsx (Overview, Camps, Live)      |
                                    |   - ShopDiagnosisView.jsx (Audit 360)    |
                                    +--------------------+---------------------+
                                                         |
                                        HTTP REST (JSON) | (No Auth Headers)
                                                         v
+-------------------------------------------------------------------------------------------------------+
|                                    BACKEND SERVER (PHP 8.x PDO)                                       |
|                                                                                                       |
|  Endpoints:                                                                                           |
|  - /api/sync.php            : Pulls Ads API, caps 200 orders, calculates Shop GMV = max(Shop, Ads)    |
|  - /api/campaigns.php       : CRUD on local DB campaigns (No push to TikTok Ads API)                 |
|  - /api/shop_diagnosis.php  : Computes 4-part audit, handles extension sync, SES calculation          |
|  - /api/rules.php           : CRUD on automation rules (No background execution engine)               |
|  - /api/gemini_analyze.php  : Gemini AI integration with 1,800+ lines of fallback markdown           |
|  - /api/oauth.php           : TikTok Shop OAuth callback                                              |
|  - /api/oauth_ads.php       : TikTok Ads OAuth callback                                               |
|  - /api/webhook.php         : TikTok Shop Webhook receiver (order status, de-auth)                    |
|                                                                                                       |
|  Core Shared Scripts:                                                                                 |
|  - /api/db.php              : DB connection, credentials, auto-DDL schema initialization              |
|  - /api/tiktok_client.php   : HMAC-SHA256 signer, cURL wrapper for TikTok Shop Open API               |
|  - /api/creatives_data.php  : 900+ lines of creative pooling, CRC32 synthetic cancellations          |
+-------------------+-----------------------------------+-----------------------------------------------+
                    |                                   |
                    v                                   v
+------------------------------------+   +--------------------------------------------------------------+
|          DATABASE (MySQL)          |   |                    EXTERNAL INTEGRATIONS                     |
|                                    |   |                                                              |
|  - tiktok_config                   |   |  1. TikTok Marketing API v1.3 (business-api.tiktok.com)     |
|  - tiktok_campaigns                |   |     - /campaign/get/, /report/integrated/get/                |
|  - tiktok_campaign_daily_reports   |   |     - /gmv_max/report/get/, /gmv_max/video/get/              |
|  - tiktok_video_ads                |   |                                                              |
|  - tiktok_live_sessions            |   |  2. TikTok Shop Open API (open-api.tiktokglobalshop.com)     |
|  - tiktok_orders                   |   |     - /order/202309/orders/search                            |
|  - tiktok_rules                    |   |     - /product/202309/products/search                        |
|  - tiktok_audit_logs               |   |                                                              |
|  - tiktok_shop_checklists          |   |  3. Chrome Extension (Manifest V3)                          |
|  - tiktok_seller_center_snapshots  |   |     - Static payload sent to sync_seller_center              |
|                                    |   |                                                              |
|                                    |   |  4. Google Gemini AI API (generativelanguage.googleapis.com) |
+------------------------------------+   +--------------------------------------------------------------+
```

---

### 3. Repository Structure

```
AdsTiktok/
├── public/                               # Public webroot assets copied to dist/
│   ├── api/                              # Backend PHP REST service
│   │   ├── campaigns.php                 # Campaign management & modal detail endpoint
│   │   ├── check_db.php                  # Database health probe
│   │   ├── check_version.php             # Build version verification
│   │   ├── creatives_data.php            # Video creatives data engine & synthetic metrics
│   │   ├── db.php                        # PDO connection, credentials, auto-DDL engine
│   │   ├── debug_db.php                  # Diagnostic dump (exposes tokens/configs publicly)
│   │   ├── download_extension.php        # File download endpoint for extension ZIP
│   │   ├── gemini_analyze.php            # AI analysis endpoint (1,860 lines)
│   │   ├── list_models.php               # Gemini model probe
│   │   ├── login.php                     # Authentication endpoint (static credentials)
│   │   ├── oauth.php                     # TikTok Shop OAuth callback & mock auth
│   │   ├── oauth_ads.php                 # TikTok Ads OAuth callback
│   │   ├── rules.php                     # Rule CRUD handler
│   │   ├── scratch_test.php              # Developer scratch test script
│   │   ├── shop_diagnosis.php            # 360° Shop Audit, SES update, Extension receiver
│   │   ├── sync.php                      # Main synchronization endpoint (572 lines)
│   │   ├── test_api.php                  # Ads API connection test
│   │   ├── test_db.php                   # Database read/write test
│   │   ├── test_delete.php               # DANGEROUS: Deletes sample campaigns without auth
│   │   ├── test_gemini.php               # Gemini latency test
│   │   ├── test_gemini_speed.php         # Gemini benchmark test
│   │   ├── test_models.php               # AI model listing test
│   │   ├── test_videos.php               # Video ads query test
│   │   ├── tiktok_client.php             # TikTok Shop HMAC-SHA256 cURL client
│   │   └── webhook.php                   # TikTok webhook endpoint
│   ├── extension/                        # Chrome Extension package (Manifest V3)
│   │   ├── content_script.js             # Content script injected into seller-vn.tiktok.com
│   │   ├── manifest.json                 # Extension manifest (storage, activeTab, host permissions)
│   │   ├── popup.html                    # Extension popup UI
│   │   └── popup.js                      # Extension logic (contains static payload)
│   ├── .htaccess                         # Apache rewrite rules for public/
│   ├── favicon.svg                       # Application icon
│   ├── icons.svg                         # SVG icon library
│   └── tiktok_audit_extension.zip        # Pre-packaged extension archive (5,004 bytes)
├── src/                                  # Frontend React application
│   ├── assets/                           # Media assets (hero.png, react.svg, vite.svg)
│   ├── App.css                           # Monolithic CSS styling (Glassmorphism, Cyberpunk)
│   ├── App.jsx                           # Monolithic main application component (7,796 lines)
│   ├── index.css                         # CSS root variables
│   ├── main.jsx                          # React application entrypoint
│   └── ShopDiagnosisView.jsx             # 360° Shop Audit & Action Plan component (2,294 lines)
├── dist/                                 # Production build output
├── marketing_deploy.zip                  # Full production deployment bundle (257 KB)
├── nginx.conf                            # Standalone Nginx server block configuration
├── package.json                          # Node dependencies (React 18.3.1, Vite 8.1.4, Lucide 0.344.0)
├── vite.config.js                        # Vite bundler configuration
├── index.html                            # Master HTML template
└── .htaccess                             # Root Apache rewrite rules (HTTPS redirect, SPA fallback)
```

---

### 4. Frontend Architecture

#### 4.1 Component Tree & State Management
- **No Global State Library:** The application uses pure React local state (`useState`, `useEffect`, `useMemo`). There is no Redux, Zustand, or React Context.
- **Component Monoliths:**
  - `src/App.jsx` spans **7,796 lines**, managing authentication, date filters, SVG line charting, campaign CRUD, live stream workbench, automation rules, and Gemini AI interactions.
  - `src/ShopDiagnosisView.jsx` spans **2,294 lines**, handling shop health score calculations, SES metric breakdowns, product card SEO audits, voucher matrix checks, interactive task checklists, and extension instructions.
- **Client Storage:**
  - `localStorage.getItem('auth_token')`: Controls client-side authentication gate.
  - `localStorage.getItem('real_shop_id')`: Determines whether the app operates in "Real Mode" or "Mock Mode".

#### 4.2 Frontend Mock / Fallback States
1. **Fallback Campaigns:** `INITIAL_CAMPAIGNS` (5 mock campaigns: Yonex Pro, UltraLight running shoes, etc.) loaded if `real_shop_id` is missing.
2. **Fallback Live Sessions:** `FALLBACK_LIVE_SESSIONS` (4 hardcoded sessions) displayed if API data is empty.
3. **Hardcoded Live Traffic Distribution:** In `App.jsx` (lines 1484-1485):
   ```javascript
   videoPercent: hasLiveCampaign ? 42 : 0,
   livePercent: hasLiveCampaign ? 58 : 0
   ```
4. **Hardcoded Badges:** In `ShopDiagnosisView.jsx` (line 274):
   `● 12/12 Quyền Open API Đã Kết Nối` is statically rendered in JSX.
5. **Client-Side Auth Bypass:** In `App.jsx` (lines 819-823): If `/api/login.php` fails or network drops, hardcoded credentials allow login and set `auth_token` to `'mock_token'`.

---

### 5. Backend Architecture

- **Stateless Procedural PHP:** Endpoints are standalone PHP scripts executing sequentially. There is no MVC framework, routing library, or dependency injection.
- **Database Access:** Standard PDO connection via `getDBConnection()` defined in `public/api/db.php`.
- **Cross-Origin Resource Sharing (CORS):** Open to all origins (`Access-Control-Allow-Origin: *`) across all API endpoints.
- **Authentication Enforcement:** **ABSENT.** While `login.php` exists and issues random tokens, zero backend endpoints validate the `Authorization` header or token. All endpoints (`sync.php`, `campaigns.php`, `shop_diagnosis.php`, etc.) execute unrestricted queries for any caller.

---

### 6. Database Architecture

The schema is defined in `public/api/db.php` and contains 10 core tables:

| Table Name | Primary Key | Indexes | Purpose | Overwrite / Integrity Risks |
| :--- | :--- | :--- | :--- | :--- |
| `tiktok_config` | `id` (AI) | `idx_shop` (`shop_id`) | Stores shop token, ads token, target settings, SES scores, and raw extension data. | Single-row assumption. If multiple shops authenticate, `ORDER BY id DESC LIMIT 1` causes cross-tenant collision. |
| `tiktok_campaigns` | `id` (VARCHAR 100) | `PRIMARY KEY (id)` | Stores GMV Max and auction campaigns, spend, ad GMV, ROAS, budget. | Overwrites spend and GMV based on current sync date window. Lifetime vs. filtered spend is conflated. |
| `tiktok_campaign_daily_reports` | `id` (AI) | `idx_camp_date` (`campaign_id`, `stat_date`) | Historical performance per campaign per day (spend, GMV, orders, ROI, CPA). | Upsert on `(campaign_id, stat_date)` is clean. |
| `tiktok_video_ads` | `id` (VARCHAR 100) | `idx_camp_quadrant`, `idx_script_risk` | Video creative metrics, hook rates, quadrant status, synthetic cancellation risk. | Upsert overwrites video metrics with filtered period metrics. |
| `tiktok_live_sessions` | `id` (AI) | `idx_room_id` (`room_id`) | Metrics per livestream room (GMV, spend, viewers, GPM, traffic sources, top SKU). | Upsert on `room_id`. Good deduplication, but traffic sources JSON stored as raw text. |
| `tiktok_orders` | `id` (VARCHAR 100) | `idx_create_time` (`create_time`) | Order records synced from TikTok Shop Open API. | Upsert on `id`. Limited to 200 orders max. Historical order status changes lost. |
| `tiktok_rules` | `id` (VARCHAR 100) | `PRIMARY KEY (id)` | Rule definitions (trigger condition, action, frequency). | Table is purely declarative. No execution engine evaluates these rules. |
| `tiktok_audit_logs` | `id` (AI) | `PRIMARY KEY (id)` | System and webhook event logs. | Append-only. No log rotation mechanism (potential unbounded growth). |
| `tiktok_shop_checklists` | `id` (AI) | `idx_shop_task` (`shop_id`, `task_code`) | Operational tasks, status (`todo`, `in_progress`, `done`), notes. | Upsert on `(shop_id, task_code)` works correctly. |
| `tiktok_seller_center_snapshots` | `id` (AI) | `idx_shop_date` (`shop_id`, `snapshot_date`) | Snapshots received from Chrome Extension. | Non-unique index on `(shop_id, snapshot_date)`. Multiple syncs on the same day create duplicate rows. |

---

### 7. External Integrations

1. **TikTok Marketing API (Ads API) v1.3:**
   - Host: `https://business-api.tiktok.com/open_api/v1.3`
   - Authentication: Access token passed in HTTP Header `Access-Token: <token>`.
2. **TikTok Shop Partner Open API:**
   - Host: `https://open-api.tiktokglobalshop.com`
   - Authentication: HMAC-SHA256 signature calculated via App Secret, passed in query params (`sign`, `timestamp`, `app_key`) and header `x-tts-access-token`.
3. **Google Gemini AI API:**
   - Host: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
   - Authentication: Passed as URL parameter `?key=<GEMINI_API_KEY>`.
4. **Chrome Extension:**
   - Manifest V3 extension injected into `seller-vn.tiktok.com`.
   - Communicates via `fetch()` POST requests to `https://marketing.addp.vn/api/shop_diagnosis.php?action=sync_seller_center`.

---

### 8. TikTok Shop API Map

| API Type | Endpoint Path | API Version | HTTP Method | Purpose | Pagination | Date Filter | Rate Limit Handling | Error Handling | Database Target |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TikTok Shop | `/authorization/202309/shops` | 202309 | GET | Retrieve authorized shops & `shop_cipher` | None | None | None | Throws Exception | Read-only |
| TikTok Shop | `/product/202309/products/search` | 202309 | POST | Search store product catalog | Single call (50 max) | None | None | Returns empty array | `product_health` summary |
| TikTok Shop | `/product/202309/products/{id}` | 202309 | GET | Get product details (images, attributes) | N/A (sample max 8) | None | None | `error_log()`, returns null | In-memory audit |
| TikTok Shop | `/order/202309/orders/search` | 202309 | POST | Retrieve store orders | Capped at 4 pages (200 max) | `create_time_ge`, `create_time_lt` | None | Throws Exception / Logged | `tiktok_orders` |
| TikTok Shop | `/analytics/202309/shops/lives` | 202309 | GET | Retrieve live sessions | Single call (20 max) | None | None | Falls back to alternate endpoints | `tiktok_live_sessions` |
| TikTok Shop | `/analytics/202405/shop/performance` | 202405 | GET | Fetch Shop Experience Score (SES/SPS) | None | None | None | Tries 3 paths, returns null | In-memory SES |
| TikTok Shop | `/promotion/202309/activities/search` | 202309 | POST | Search store promotions & flash sales | Single call (50 max) | None | None | Tries body variations, returns [] | `promotions` summary |
| TikTok Shop | `/promotion/202309/coupons/search` | 202309 | POST | Search store coupons | Single call (50 max) | None | None | Tries body variations, returns [] | `promotions` summary |
| TikTok Shop | `/finance/202309/settlements/search` | 202309 | POST | Fetch settlement and statement data | Single call (50 max) | None | None | Tries 2 paths, returns [] | Unused in UI |
| TikTok Shop | `/return_refund/202309/returns/search` | 202309 | POST | Fetch return and refund requests | Single call (50 max) | None | None | Catches exception, returns [] | `returnsCount` |
| TikTok Shop | `/fulfillment/202309/packages/search` | 202309 | POST | Fetch package fulfillment metrics | Single call (50 max) | None | None | Catches exception, returns [] | `packagesCount` |

---

### 9. TikTok Ads API Map

| API Type | Endpoint Path | API Version | HTTP Method | Purpose | Pagination | Date Filter | Rate Limit Handling | Error Handling | Database Target |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TikTok Ads | `/campaign/get/` | v1.3 | GET | Get advertiser auction campaigns | Single page (`page=1`, `page_size=100`) | None | None | Throws Exception | `tiktok_campaigns` |
| TikTok Ads | `/campaign/gmv_max/info/` | v1.3 | GET | Get specific GMV Max campaign metadata | N/A (Single ID) | None | None | Silent catch | `tiktok_campaigns` |
| TikTok Ads | `/report/integrated/get/` | v1.3 | GET | Integrated report for standard campaigns | Single page (`page=1`, `page_size=100`) | `start_date`, `end_date` | None | Silent catch | `tiktok_campaign_daily_reports` |
| TikTok Ads | `/gmv_max/report/get/` | v1.3 | GET | Performance report for GMV Max campaigns | Single page (`page=1`, `page_size=100`) | `start_date`, `end_date` | None | Silent catch | `tiktok_campaign_daily_reports` |
| TikTok Ads | `/gmv_max/video/get/` | v1.3 | GET | Video creative performance under GMV Max | Single page (`page=1`, `page_size=50`) | None | None | Silent catch | `tiktok_video_ads` |
| TikTok Ads | `/oauth2/access_token/` | v1.3 | POST | Exchange authorization code for token | N/A | None | None | Throws Exception | `tiktok_config` |

---

### 10. Chrome Extension Data Flow

```
[Tab: seller-vn.tiktok.com]
        |
        | 1. User opens Extension Popup
        v
[popup.js]
        |
        | 2. Checks if URL contains 'seller-vn.tiktok.com' (tab status = 'Ready')
        | 3. User clicks 'Quét & Đồng Bộ Số Liệu'
        | 4. Bypasses DOM scraping!
        |    Constructs HARDCODED static payload:
        |    {
        |      shop_id: '7495657895504611503',
        |      shop_name: 'Dược Phẩm ADDP',
        |      total_gmv: 458337810,
        |      mom_growth: -43.51,
        |      live_gmv: 182552634,
        |      video_gmv: 227295375,
        |      product_gmv: 48489801,
        |      ses_score: 4.9,
        |      ses_score_exact: 4.94,
        |      needs_attribute_optimize: 8,
        |      flash_sales: 48,
        |      ...
        |    }
        v
[POST https://marketing.addp.vn/api/shop_diagnosis.php?action=sync_seller_center]
        |
        | 5. Writes to `tiktok_seller_center_snapshots` (snapshot_date = CURDATE())
        | 6. Overwrites `tiktok_config.seller_center_data` with raw JSON payload
        | 7. Sets `tiktok_config.last_synced_seller_center_at = NOW()`
        v
[Frontend: ShopDiagnosisView.jsx]
        |
        | 8. Displays 458.3M, -43.51%, 8 SKU SEO errors, 0 vouchers
```

**Technical Evidence:** In `public/extension/popup.js` (lines 65–118), the `payload` object contains pre-defined numeric constants representing Dược Phẩm ADDP's audit report from early September 2026. The extension does **not** dynamically extract data from the Seller Center React state, Redux store, or internal XHR responses.

---

### 11. KPI Data Lineage

| KPI Name | Source Channel | Origin Endpoint / File | Raw Field | Backend Transformation | Database Column | Aggregation / Display Formula | Frontend Display |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ad Spend** | TikTok Ads API | `/gmv_max/report/get/` or `/report/integrated/get/` | `metrics.cost` or `metrics.spend` | Cast to float | `tiktok_campaigns.spend` | `SUM(c.spend)` | `formatCurrency(stats.totalSpend)` |
| **Ad GMV** | TikTok Ads API | `/gmv_max/report/get/` or `/report/integrated/get/` | `metrics.gross_revenue` or `spend * roas` | Cast to float | `tiktok_campaigns.ad_gmv` | `SUM(c.adGmv)` | `formatCurrency(stats.totalAdGmv)` |
| **Ad ROAS** | Calculated | Derived from Spend & GMV | N/A | `gmv / spend` | `tiktok_campaign_daily_reports.roi` | `totalAdGmv / totalSpend` | `stats.averageRoas + 'x'` |
| **Shop Orders** | Mixed | `tiktok_orders` OR Campaign Conversions | `COUNT(id)` or `SUM(conversions)` | `max(totalRealConvs, totalAdConvs)` | In-memory in `sync.php` | `stats.computedShopOrders` | Number formatted |
| **Shop GMV** | Mixed | `tiktok_orders` OR Campaign GMV | `SUM(total_amount)` or `SUM(ad_gmv)` | `max(totalRealGmv, totalAdGmv)` | In-memory in `sync.php` | `stats.computedShopGmv` | `formatCurrency(stats.computedShopGmv)` |
| **Ads Contribution** | Frontend | Derived | N/A | N/A | N/A | `(totalAdGmv / computedShopGmv) * 100` | Displayed as percentage (caps at 100%) |
| **Live GMV** | Streamer Desktop / DB | `tiktok_live_sessions` or Extension | `gmv` | Cast to float | `tiktok_live_sessions.gmv` | `liveGmv` from selected session | `formatCurrency(liveGmv)` |
| **Live Ad Spend** | DB / UI | `tiktok_live_sessions.ad_spend` | `ad_spend` | Cast to float | `tiktok_live_sessions.ad_spend` | Direct field | `formatCurrency(liveSpend)` |
| **Live GPM** | DB | `tiktok_live_sessions.gpm` | `gpm` | Cast to float | `tiktok_live_sessions.gpm` | Direct field | `formatCurrency(gpm)` |
| **Live GMV/Hour**| DB | `tiktok_live_sessions.gmv_per_hour` | `gmv_per_hour` | Cast to float | `tiktok_live_sessions.gmv_per_hour` | Direct field | `formatCurrency(gmv_per_hour)` |
| **Live Traffic %**| Hardcoded / DB| `App.jsx` line 1484 | N/A | Static ternary | N/A | `hasLiveCampaign ? 58 : 0` | Rendered as `58%` |
| **Video Clicks** | Heuristic | `sync.php` line 455 | N/A | `max(0, round(spend / 80))` | `tiktok_campaigns.clicks` | Direct field | Estimated integer |
| **Video Impressions**| Heuristic | `sync.php` line 456 | N/A | `max(0, round(spend / 10))` | `tiktok_campaigns.impressions` | Direct field | Estimated integer |
| **Video Cancel Risk**| Synthetic | `creatives_data.php` line 521 | `crc32(id)` | `crc32(id) % 5 === 0 ? 1 : 0` | `tiktok_video_ads.cancelled_orders` | Pre-calculated in PHP | Displayed in Cancellation Monitor |
| **SES Exact** | TikTok Seller Center / DB | `tiktok_config` or Modal | `ses_product_score`, `ses_logistics_score`, `ses_service_score` | `(5.0*70%) + (5.0*15%) + (4.6*15%)` | `tiktok_config.ses_score` | Weighted sum formula | `4.94 ⭐` (Rounded to `4.9 ⭐`) |
| **360° Total GMV**| Extension / Fallback | `seller_center_data` JSON | `total_gmv` | Fallback to `estimatedShopGmv` | `tiktok_seller_center_snapshots` | `scData.total_gmv ?? totalShopGmv` | `458.337.810 ₫` |
| **MoM Growth %** | Extension / Fallback | `seller_center_data` JSON | `mom_growth` | Fallback to `-43.51` | `raw_data` JSON | `scData.mom_growth ?? -43.51` | `▼ -43.51%` |

---

### 12. GMV Definition Map

```
                                      +---------------------------------------------+
                                      |          ALL GMV CONCEPTS IN CODE           |
                                      +----------------------+----------------------+
                                                             |
                 +-------------------------------------------+-------------------------------------------+
                 |                                           |                                           |
                 v                                           v                                           v
+---------------------------------+         +---------------------------------+         +---------------------------------+
|       1. AD GMV (Ad Sales)      |         |     2. SHOP GMV (Store Sales)   |         |    3. COMPASS 30D TOTAL GMV     |
|                                 |         |                                 |         |                                 |
| - Origin: TikTok Ads API        |         | - Origin: `tiktok_orders` table |         | - Origin: Extension snapshot    |
| - Field: `gross_revenue`        |         | - Field: `SUM(total_amount)`    |         | - Value: `458,337,810 VND`      |
| - Meaning: Revenue attributed   |         | - Meaning: Value of synced      |         | - Meaning: Total store GMV from |
|   to TikTok ad clicks/views     |         |   orders in the database        |         |   TikTok Seller Center Compass  |
+----------------+----------------+         +----------------+----------------+         +----------------+----------------+
                 |                                           |                                           |
                 +-------------------------------------------+-------------------------------------------+
                                                             |
                                                             v
                                            +---------------------------------+
                                            |     METRIC_DEFINITION_RISK      |
                                            |                                 |
                                            | In sync.php line 509:           |
                                            | totalShopGmv =                  |
                                            |   max(totalRealGmv, totalAdGmv) |
                                            |                                 |
                                            | If order sync is missing or     |
                                            | incomplete, Ad GMV is silently  |
                                            | substituted as Total Shop GMV!  |
                                            +---------------------------------+
```

#### Identified GMV Concepts in Code:
1. **Ad GMV (`totalAdGmv`):** Revenue attributed to ad campaigns via TikTok Marketing API.
2. **Real Shop GMV (`totalRealGmv`):** Sum of `total_amount` from `tiktok_orders` where `status != 'CANCELLED'`.
3. **Estimated Shop GMV (`estimatedShopGmv`):** Extrapolated in `shop_diagnosis.php` as `totalOrdersCount * avgOrderValue` (AOV defaulting to 180,000 VND).
4. **Compass GMV (`total_gmv`):** Overall shop revenue from Seller Center Compass stored in snapshots (458,337,810 VND).
5. **Live GMV (`liveGmv`):** Segmented revenue from livestream sessions.
6. **Video GMV (`videoGmv`):** Segmented revenue from video shoppable ads and organic videos.
7. **Product Card GMV (`productGmv`):** Segmented revenue from Shop Tab and search cards.

---

### 13. Order Data Flow

```
TikTok Shop Open API (/order/202309/orders/search)
        |
        | 1. Query with start_time & end_time (time - 30 days)
        | 2. page_size = 50
        v
[Pagination Loop in sync.php]
        |
        | 3. Loops while nextPageToken != '' AND pageCount < 4
        |    --> MAXIMUM ORDERS SCANNED = 4 x 50 = 200 ORDERS!
        v
[Line Items Loop]
        |
        | 4. orderAmount = SUM(item.sale_price * item.quantity)
        |    --> Shipping fee, seller voucher, platform discount IGNORED!
        v
[Database: tiktok_orders]
        |
        | 5. Upsert on `id`
        |    Columns: id, create_time, status, total_amount, quantity
        v
[Aggregation Query in sync.php]
        |
        | 6. SELECT SUM(total_amount), SUM(quantity)
        |    FROM tiktok_orders
        |    WHERE create_time BETWEEN :start AND :end
        |      AND status != 'CANCELLED'
        |
        |    --> Unpaid, Awaiting Payment, and Returned orders ARE COUNTED AS GMV!
        v
totalRealGmv & totalRealConvs
```

#### Order Integrity Vulnerabilities:
- **Order Truncation:** Stores with hundreds or thousands of monthly orders only synchronize the first 200 orders.
- **Order Price Distortion:** Because `orderAmount` is computed from `sale_price * quantity`, any bundle discount, store coupon, or platform subsidy recorded in `payment.total_amount` is bypassed.
- **Sync Freezing:** Because `sync.php` checks `if ($forceSync || $orderCount == 0)`, orders are never refreshed during regular dashboard navigation once at least one order exists in `tiktok_orders`.

---

### 14. Date & Timezone Analysis

1. **PHP Runtime Timezone:** `date_default_timezone_set('Asia/Ho_Chi_Minh')` in `public/api/db.php`. All `date()` and `strtotime()` calls execute in UTC+7.
2. **TikTok Shop API Timestamps:** The Open API expects and returns Unix epoch timestamps in **seconds** (UTC). PHP's `strtotime('2026-09-01 00:00:00')` in UTC+7 correctly converts to the corresponding epoch second.
3. **TikTok Ads API Date Format:** Accepts string dates `YYYY-MM-DD`. These are evaluated in the advertiser account's configured timezone (which may or may not match UTC+7).
4. **Client-Side UTC Shift Vulnerability:** In `src/App.jsx` (lines 564–565):
   ```javascript
   startDate: thirtyDaysAgo.toISOString().split('T')[0],
   endDate: today.toISOString().split('T')[0]
   ```
   `new Date().toISOString()` converts local time to UTC. In Vietnam (UTC+7), between **00:00:00 and 06:59:59 AM**, `today.toISOString()` returns **yesterday's date in UTC**. This produces an intermittent off-by-one-day boundary error for users accessing the platform early in the morning.

---

### 15. Pagination Analysis

| Endpoint / Method | Location | Mechanism | Status | Evidence in Code |
| :--- | :--- | :--- | :--- | :--- |
| `/order/202309/orders/search` | `sync.php` (line 356) | `page_token`, `maxPages=4` | **PAGINATION_BROKEN** | Hard-capped at 4 pages (200 records max). Extra pages dropped. |
| `/order/202309/orders/search` | `shop_diagnosis.php` (line 385) | `next_page_token`, `pages < 4`| **PAGINATION_BROKEN** | Hard-capped at 4 pages (200 records max). |
| `/product/202309/products/search` | `tiktok_client.php` (line 120) | `page_token` parameter | **PAGINATION_RISK** | Method accepts `pageToken`, but caller never loops. Only first 50 products fetched. |
| `/campaign/get/` (Ads API) | `sync.php` (line 75) | `page=1, page_size=100` | **PAGINATION_RISK** | Fixed to page 1. Accounts with >100 campaigns lose campaigns. |
| `/report/integrated/get/` | `sync.php` (line 93) | `page=1, page_size=100` | **PAGINATION_RISK** | Fixed to page 1. Accounts with >100 campaigns lose report rows. |
| `/gmv_max/report/get/` | `sync.php` (line 117) | `page=1, page_size=100` | **PAGINATION_RISK** | Fixed to page 1. Daily reports lose data beyond 100 rows. |
| `/gmv_max/video/get/` | `sync.php` (line 256) | `page=1, page_size=50` | **PAGINATION_RISK** | Fixed to page 1. Accounts with >50 GMV Max videos truncate video list. |
| `/promotion/202309/activities/search`| `tiktok_client.php` (line 237) | `page_size=50` | **PAGINATION_RISK** | No pagination cursor. Returns at most 50 active promotions. |
| `/analytics/202309/shops/lives` | `tiktok_client.php` (line 175) | `page_size=20` | **PAGINATION_RISK** | Fixed to 20 live sessions. Historical live sessions truncated. |

---

### 16. Snapshot Analysis

#### Table: `tiktok_seller_center_snapshots`
- **Insertion Logic:** In `shop_diagnosis.php` (line 128):
  ```sql
  INSERT INTO `tiktok_seller_center_snapshots` 
  (`shop_id`, `snapshot_date`, `period_days`, `total_gmv`, `total_orders`, `live_gmv`, `video_gmv`, `product_card_gmv`, `raw_data`, `synced_at`)
  VALUES (?, CURDATE(), 30, ?, ?, ?, ?, ?, ?, NOW())
  ```
- **Ambiguity & Duplicate Vulnerability:**
  1. `snapshot_date` is stamped as `CURDATE()`. The table has an index `KEY idx_shop_date (shop_id, snapshot_date)` which is **non-unique**.
  2. If the user triggers the extension sync multiple times in one day, multiple rows are inserted for the same date.
  3. `period_days` is hardcoded to `30`. If the user extracts a 7-day view or custom date range from Seller Center, the database still labels it as a 30-day snapshot.
  4. The dashboard reads the latest snapshot via `tiktok_config.seller_center_data` rather than aggregating historical snapshot trends.

---

### 17. Auto-DDL Analysis

#### Function: `initializeDatabase()` in `public/api/db.php`
- **Execution Trigger:** Invoked at the top of almost every PHP file:
  - `campaigns.php`, `db.php`, `rules.php`, `shop_diagnosis.php`, `webhook.php`, `gemini_analyze.php`, `oauth.php`, `oauth_ads.php`.
- **Runtime Behavior:**
  1. Executes `SHOW TABLES LIKE 'tiktok_campaign_daily_reports'`.
  2. Executes `CREATE TABLE IF NOT EXISTS` for all 10 tables.
  3. Executes multiple `ALTER TABLE ADD COLUMN` statements wrapped in empty `try { ... } catch (Exception $e) {}` blocks.
  4. Executes `SHOW TABLES LIKE 'tiktok_config'`.
  5. Executes sample data insertions (`INSERT INTO tiktok_campaigns`, `tiktok_rules`, `tiktok_live_sessions`) if tables are empty.
- **Architectural Risks:**
  - **Performance Penalty:** Every incoming API request incurs metadata locks and schema checks against MySQL.
  - **DDL During Concurrent Traffic:** Under heavy load, concurrent `ALTER TABLE` operations can lock MySQL tables and cause connection pool exhaustion (HTTP 500 / 504 errors).
  - **Silent Migration Failure:** Schema errors are completely swallowed by empty catch blocks.

---

### 18. Business Rules

| Rule Name | Rule Logic / Value | Classification | Source Evidence |
| :--- | :--- | :--- | :--- |
| **ROI Protection Threshold** | `conversions >= 20` | PLATFORM_POLICY (NEEDS_EXTERNAL_VERIFICATION) | `ShopDiagnosisView.jsx` line 1099, `sync.php` |
| **Fake Budget Spend Ratio** | `spend_ratio < 10%` on budget > 1M | BUSINESS_RULE | `shop_diagnosis.php` line 842 |
| **SES Formula Weights** | Product 70%, Logistics 15%, CS 15% | PLATFORM_POLICY | `shop_diagnosis.php` line 75, `db.php` line 170 |
| **SES Star Shop Threshold** | `SES >= 4.5` and `orders >= 100` | PLATFORM_POLICY | `shop_diagnosis.php` line 634 |
| **Ad Target Framework** | GMV 50M, Spend 3.5M, Cost 7%, ROAS 14.28x | SYSTEM_RULE (ADDP Internal) | `db.php` lines 164–167 |
| **Automated Scale Rule** | Increase budget by 15% if ROAS >= 4.0 | UI_ONLY / DECLARATIVE | `tiktok_rules` table, `App.jsx` line 254 |
| **Automated Stop Rule** | Pause campaign if ROAS < 2.0 & Spend > 1.5M | UI_ONLY / DECLARATIVE | `tiktok_rules` table, `App.jsx` line 262 |
| **Top Performer Cutoff** | First 7 spending videos with ROAS >= Target | BUSINESS_RULE | `creatives_data.php` line 650 |
| **High Cancel Risk Cutoff** | Cancel rate > 15% = Critical, 8-15% = Warning| BUSINESS_RULE | `creatives_data.php` line 524 |

---

### 19. Security Findings

```
================================================================================
SECURITY AUDIT FINDINGS (STATIC ANALYSIS)
================================================================================
[CRITICAL] Hardcoded Database Credentials in Source Code
  - Location: public/api/db.php (lines 4-7)
  - Details: DB_HOST, DB_NAME, DB_USER, DB_PASS are committed directly in source.
  - Value: Masked [***FOUND IN SOURCE***]

[CRITICAL] Hardcoded Administrative Password in Source Code
  - Location: public/api/db.php (lines 10-11)
  - Details: ADMIN_USER and ADMIN_PASS hardcoded in plaintext.
  - Value: Masked [***FOUND IN SOURCE***]

[CRITICAL] Client-Side Authentication Bypass
  - Location: src/App.jsx (lines 819-824)
  - Details: Frontend catches login errors and authenticates user if credentials match hardcoded admin string.
  - Value: Masked [***FOUND IN SOURCE***]

[CRITICAL] Unauthenticated Backend API Endpoints
  - Location: public/api/sync.php, campaigns.php, shop_diagnosis.php, rules.php
  - Details: None of the API endpoints verify authentication tokens or sessions. All endpoints are publicly callable.

[CRITICAL] Dangerous Unauthenticated Database Modification Scripts Exposed
  - Location: public/api/test_delete.php, debug_db.php
  - Details: test_delete.php executes DELETE queries on tiktok_campaigns when hit via GET request. debug_db.php dumps tokens and configs.

[HIGH] Hardcoded OAuth Secrets in Source Code
  - Location: public/api/db.php (lines 17-23)
  - Details: TIKTOK_APP_KEY, TIKTOK_APP_SECRET, TIKTOK_ADS_APP_ID, TIKTOK_ADS_SECRET committed in plaintext.
  - Value: Masked [***FOUND IN SOURCE***]

[HIGH] Missing OAuth Dynamic State Validation (CSRF Vulnerability)
  - Location: public/api/oauth.php (line 48), oauth_ads.php (line 29)
  - Details: Uses static string state ('addp_marketing', 'addp_ads_marketing') instead of dynamic cryptographic nonce.

[HIGH] Disabled cURL SSL Certificate Verification
  - Location: public/api/tiktok_client.php (lines 83-84), db.php (lines 653-654, 710-711), oauth.php, oauth_ads.php
  - Details: CURLOPT_SSL_VERIFYPEER = false and CURLOPT_SSL_VERIFYHOST = false across all cURL requests (vulnerable to MitM).

[MEDIUM] Potential SQL Injection via Webhook
  - Location: public/api/webhook.php (lines 82-86)
  - Details: $gmvAmount concatenated directly into $db->exec() without parameterized prepared statements.
================================================================================
```

---

### 20. Fake / Mock / Fallback Data Findings

| Pattern / Value | Location | Classification | Behavior & Risk |
| :--- | :--- | :--- | :--- |
| `Math.random()` live simulation loop | `src/App.jsx` (lines 1131–1165) | **POTENTIAL_FAKE_PRODUCTION_DATA** | When `liveStreamActive` is true, a 3-second interval randomly increases `liveSales` (`Math.random() * 3 * 150000 + 50000`) and updates campaign state. |
| `crc32($id)` synthetic cancellations | `creatives_data.php` (lines 521–555) | **POTENTIAL_FAKE_PRODUCTION_DATA** | Generates fake cancelled order counts and cancel rates using `crc32($id) % 5 === 0`. |
| Static Extension Payload | `public/extension/popup.js` (lines 65–118) | **POTENTIAL_FAKE_PRODUCTION_DATA** | Sends static hardcoded numbers (`total_gmv = 458337810`, `-43.51%`, etc.) to `/api/shop_diagnosis.php`. |
| Heuristic Clicks / Impressions | `sync.php` (lines 455–456, 478–479) | **DANGEROUS_FALLBACK** | Calculates `clicks = spend / 80` and `impressions = spend / 10` when Ads API integrated report omits them. |
| Fallback AOV Multiplier | `sync.php` (line 278), `creatives_data.php` | **DANGEROUS_FALLBACK** | If gross revenue is missing, multiplies orders by hardcoded `149,000 VND`. |
| Extrapolated Shop GMV | `shop_diagnosis.php` (lines 465–478) | **DANGEROUS_FALLBACK** | Extrapolates GMV using hardcoded ratios: Live 18%, Product Card 22%, AOV 180,000 VND. |
| `INITIAL_CAMPAIGNS` | `src/App.jsx` (lines 176–247) | **DEMO_DATA** | Mock campaigns (Yonex Pro, Giày UltraLight) displayed when `real_shop_id` is missing. |
| `FALLBACK_LIVE_SESSIONS` | `src/App.jsx` (lines 47–174) | **DEMO_DATA** | 4 static livestream sessions displayed when live API returns empty. |
| Hardcoded Live Traffic Ratios | `src/App.jsx` (lines 1484–1485) | **UI_PLACEHOLDER** | Fixed `42% video / 58% live` traffic breakdown. |
| Mock Auth Redirect | `public/api/oauth.php` (line 53) | **SAFE_DEFAULT** | Generates random mock tokens when `TIKTOK_APP_KEY` is empty for local testing. |

---

### 21. Data Trust Matrix

| Metric | Source A | Source B | Source C | Current UI Source | Difference Handling | Source Priority | Reconciliation Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Total Shop GMV** | TikTok Shop API (`tiktok_orders`) | TikTok Ads API (`ad_gmv`) | Extension Snapshot (`total_gmv`) | Dashboard: `max(Shop, Ads)`<br>Audit 360: Snapshot | `max()` substitution | Extension > Ads API > Shop API | **CRITICAL:** High divergence. NO_RECONCILIATION_IMPLEMENTED. |
| **Total Orders** | `tiktok_orders` (`COUNT(id)`) | TikTok Ads API (`conversions`) | Extension Snapshot (`total_orders`) | Dashboard: `max(Orders, Convs)`<br>Audit 360: Snapshot | `max()` substitution | Extension > Ads API > Shop API | **CRITICAL:** 200-order cap in DB causes DB orders to always be lower than Ads. |
| **Campaign Spend** | Ads API (`cost`/`spend`) | Daily Reports DB (`SUM(spend)`) | Hardcoded Fallback | API if available, else DB, else 0 | Waterfall fallback | Ads API > Daily Reports DB > 0 | **MEDIUM:** Filtered period spend vs. lifetime spend occasionally mixed. |
| **Campaign GMV** | Ads API (`gross_revenue`) | Daily Reports DB (`SUM(gmv)`) | Spend $\times$ ROAS | API if available, else DB, else Calc | Waterfall fallback | Ads API > Daily Reports DB > Calc | **MEDIUM:** Attribution window differences between Ads API and Seller Center. |
| **Live GMV** | Streamer Desktop / DB | Open API (`/shops/lives`) | Extension Snapshot | DB session table or Snapshot | Selected session | DB Session > Snapshot > Open API | **HIGH:** Real-time simulation loop can inject fake sales into live state. |
| **Video Performance** | Ads API (`/gmv_max/video/get/`) | Seller Center Data (`creatives_data.php`) | In-memory Evaluation | Merged pool | Hardcoded seeding | API > Synthetic seeding | **CRITICAL:** CRC32 generates fake cancellations. |
| **Store SES** | Open API (`/shops/performance`) | Seller Center Modal Form | Extension Snapshot | `tiktok_config.ses_score` | Formula update | Modal Form > Snapshot > Open API | **LOW:** Open API returns null; manual/extension modal formula is accurate. |

> **Audit Assertion:** **`NO_RECONCILIATION_IMPLEMENTED`**. The existing platform contains no reconciliation engine to compare, flag, or resolve discrepancies between TikTok Ads API attribution and TikTok Shop Seller Center settled orders.

---

### 22. Data Discrepancy Risks

#### [CRITICAL] 1. The 200-Order Pagination Cap
- **Evidence:** `sync.php` (line 356, 401) and `shop_diagnosis.php` (line 385).
- **Impact:** Any store with >200 orders in 30 days will see order counts and GMV severely truncated in `tiktok_orders`.
- **Result:** Dashboard falls back to `max(Shop, Ads)`, reporting Ad GMV as Store GMV.

#### [CRITICAL] 2. Extension Static Payload
- **Evidence:** `public/extension/popup.js` (lines 65–118).
- **Impact:** Every click on "Quét & Đồng Bộ Số Liệu" sends identical numbers (458,337,810 VND, -43.51%, 8 SEO errors) regardless of actual Seller Center numbers.
- **Result:** Numbers do not reflect live business changes over time.

#### [CRITICAL] 3. Real-Time Live Stream Simulation Loop
- **Evidence:** `src/App.jsx` (lines 1131–1165).
- **Impact:** In mock mode or when `real_shop_id` is not in `localStorage`, viewing the Live tab causes sales to randomly increase every 3 seconds, altering campaign GMV in state.

#### [HIGH] 4. Order Amount Calculation Omits Platform Discounts and Shipping
- **Evidence:** `sync.php` (lines 378–380): `$orderAmount += (item.sale_price * item.quantity)`.
- **Impact:** Disregards platform vouchers, seller coupons, shipping charges, and taxes recorded in `payment.total_amount`.

#### [HIGH] 5. Order Status Exclusions
- **Evidence:** `sync.php` (line 409): `status != 'CANCELLED'`.
- **Impact:** Orders marked `UNPAID`, `AWAITING_PAYMENT`, `RETURNED`, or `REFUNDED` are included in GMV calculations.

#### [MEDIUM] 6. Date Boundary Off-By-One Shift
- **Evidence:** `src/App.jsx` (lines 564–565): `.toISOString().split('T')[0]`.
- **Impact:** In UTC+7, requests before 07:00 AM evaluate `today` as yesterday's date in UTC.

---

### 23. Technical Debt

1. **Massive Component Monoliths:** `App.jsx` (7,796 lines) and `ShopDiagnosisView.jsx` (2,294 lines) contain rendering, networking, state, business rules, and mathematical formulas in single files.
2. **Missing Backend Architecture:** Procedural PHP scripts without routing, middleware, controllers, or service layers.
3. **Database Runtime Migration Debt:** Running DDL statements (`CREATE TABLE`, `ALTER TABLE`) inside runtime API request lifecycles.
4. **No Automated Testing:** Zero unit tests, integration tests, or end-to-end tests across frontend and backend.
5. **No Structured Logging:** Errors are handled via `error_log()` or suppressed in empty catch blocks.
6. **No Queue / Background Worker:** All sync and analytics tasks run synchronously inside user HTTP requests, risking Cloudflare 524 timeouts.

---

### 24. Integration Points for New BI Modules

The upcoming **ADDP Commerce Intelligence** modules (Order Analytics, Cancellation/Return Analytics, Golden Hour, Net Settlement, Profitability, Shopee Integration) should integrate cleanly without breaking existing features:

```
                                    +------------------------------------------+
                                    |        ADDP Commerce Intelligence        |
                                    |              (Next Phase)                |
                                    +--------------------+---------------------+
                                                         |
                 +---------------------------------------+---------------------------------------+
                 |                                                                               |
                 v                                                                               v
+---------------------------------+                                             +---------------------------------+
|   EXISTING PRESERVED MODULES    |                                             |         NEW BI MODULES          |
|                                 |                                             |                                 |
| - Ads Management (GMV Max)      |                                             | 1. TikTok Shop Order & Return BI|
| - Streamer Desktop Live         |                                             |    - True Settlement & Net GMV  |
| - Shop Health Audit 360°        |                                             |    - Real Cancellation Reasons  |
| - SES Calculator                |                                             |    - Golden Hour Analysis       |
| - Gemini AI Task Assistant      |                                             |                                 |
| - Operational Checklist         |                                             | 2. Shopee Multi-Channel BI      |
| - Chrome Extension Sync         |                                             |    - Order, Return & Net Profit |
+---------------------------------+                                             |    - Platform Fee Deduction     |
                                                                                +----------------+----------------+
                                                                                                 |
                                                                                +----------------v----------------+
                                                                                |   NEW CANONICAL DATA LAYER      |
                                                                                |                                 |
                                                                                | - Normalized Raw Orders Table   |
                                                                                | - Financial Settlements Table   |
                                                                                | - Channel Attribution Engine    |
                                                                                | - Reconciliation Matrix         |
                                                                                +---------------------------------+
```

#### Safe Integration Architecture:
- **Preserve Existing Endpoints:** Keep `sync.php`, `campaigns.php`, `shop_diagnosis.php` intact to ensure zero regression for current operational users.
- **Dedicated BI Endpoints:** Introduce modular endpoints (e.g., `/api/bi/orders.php`, `/api/bi/returns.php`, `/api/bi/settlement.php`, `/api/bi/shopee.php`).
- **Normalized Multi-Channel Database Tables:** Build independent tables (`bi_orders`, `bi_returns`, `bi_settlements`, `bi_channel_fees`) that support both TikTok Shop and Shopee schemas without altering legacy `tiktok_orders`.

---

### 25. Risk Register

| Risk ID | Risk Description | Severity | Likelihood | Impact on Business | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Unauthenticated API endpoints allow unauthorized data reading and campaign modification | **CRITICAL** | High | Data breach, unauthorized ad budget changes | Implement token/session middleware across all `/api/` endpoints. |
| **RSK-02** | Hardcoded static payload in Chrome Extension displays outdated data | **CRITICAL** | High | Business decisions made on frozen data | Refactor extension to capture live Compass network responses or use authorized APIs. |
| **RSK-03** | 200-order sync limit truncates store data | **CRITICAL** | High | Large stores show incorrect GMV and order counts | Implement cursor-based pagination loop with full backfill. |
| **RSK-04** | Client simulation loop injects random fake numbers | **HIGH** | Medium | Distorts live session and campaign metrics | Disable `setInterval` simulation in production builds. |
| **RSK-05** | Public exposure of `test_delete.php` and `debug_db.php` | **HIGH** | High | Malicious deletion of campaigns, token leakage | Delete or restrict test files to local CLI only. |
| **RSK-06** | Auto-DDL on every request causes database deadlocks under concurrency | **HIGH** | Medium | Server crashes, 500/504 HTTP errors during peak traffic | Move schema initialization to a dedicated migration CLI command. |
| **RSK-07** | Disabled SSL verification enables Man-in-the-Middle attacks | **HIGH** | Low | Credential and token interception on network | Enable `CURLOPT_SSL_VERIFYPEER = true` with system CA bundle. |
| **RSK-08** | Order amount omits vouchers, discounts, and shipping | **MEDIUM** | High | Financial reporting deviates from Seller Center settlement | Extract true financial fields (`payment.total_amount`, subsidies). |

---

### 26. Recommended Next Steps

1. **Immediate Security Hardening (Zero Code Disruption):**
   - Remove or password-protect test scripts (`test_delete.php`, `debug_db.php`, `scratch_test.php`).
   - Move database and OAuth credentials from `db.php` into a protected `.env` file outside webroot.
   - Enforce authentication verification on all API endpoints.
2. **Order Sync & Pagination Fix:**
   - Remove the 4-page ceiling in `sync.php` and `shop_diagnosis.php`. Implement full cursor pagination to sync 100% of store orders.
   - Parse `payment.total_amount` instead of multiplying `sale_price * quantity`.
3. **Decommission Synthetic Simulation Loops:**
   - Remove the `Math.random()` interval in `App.jsx`.
   - Replace synthetic CRC32 cancellations in `creatives_data.php` with actual cancellation data from `tiktok_orders`.
4. **Transition Extension to True Extraction:**
   - Update `popup.js` and `content_script.js` to intercept Seller Center network requests or read authenticated browser storage rather than sending pre-set numbers.
5. **Architect Canonical Data Layer for Phase 2:**
   - Design isolated database tables for multi-channel commerce intelligence (TikTok Shop + Shopee) with strict reconciliation logic before rolling out new BI screens.

---

### 27. Questions Requiring Product Owner Decision

1. **Attribution vs. Settlement GMV:**
   - Should the dashboard display **Gross Ad GMV** (attributed by TikTok Ads click within 7 days) or **Settled Shop GMV** (net of cancellations and returns as recorded in Seller Center), or present both as distinct side-by-side metrics?
2. **Order Status Scope in GMV:**
   - How should unpaid orders (`UNPAID`), orders cancelled prior to shipping (`CANCELLED`), and customer returns (`REFUNDED`) be classified in executive revenue totals?
3. **Chrome Extension Strategy:**
   - Do you wish to upgrade the Chrome Extension into an active network interceptor that captures real-time Seller Center Compass data, or should we prioritize official API channels and manual report imports?
4. **Multi-Store & Tenant Support:**
   - The current database design assumes a single store (`LIMIT 1`). Will the future ADDP Commerce Intelligence platform manage multiple TikTok and Shopee stores simultaneously under separate brand logins?
5. **Legacy Demo Data Removal:**
   - When transitioning to production, should all legacy mock artifacts (`INITIAL_CAMPAIGNS`, Yonex Pro data, mock chat pool) be completely purged from the codebase?
