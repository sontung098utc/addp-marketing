# ADDP COMMERCE INTELLIGENCE V2
# SPRINT V2-02 — PHASE 0: ADVERTISING DATA CAPABILITY AUDIT
## Comprehensive Technical Audit of TikTok Advertising, GMV Max, Video & LIVE Data Capabilities

---

> **AUDIT CLASSIFICATION & WORK MODE NOTICE**
> - **Environment:** Local Workstation Audit (`c:\AdsTiktok`)
> - **Execution Mode:** STRICTLY READ-ONLY AUDIT.
> - **Production Mod:** ZERO SSH / SCP / Remote connection, ZERO Production DB modifications, ZERO Migrations executed, ZERO Schema modifications, ZERO UI edits, ZERO Feature implementation, ZERO Mock data generation.
> - **Security / Credential Protection:** All credentials/tokens evaluated as `PRESENT` / `MISSING` / `CONFIGURED` only. No secrets or tokens are disclosed in this report.

---

## 1. EXECUTIVE SUMMARY

### 1.1 Purpose of the Audit
This capability audit evaluates the current data architecture, database schemas, API clients, and ingestion pipelines of the ADDP Commerce Intelligence system to determine readiness for the upcoming **Sprint V2-02** implementation targets:
1. **GMV Max Intelligence** (Campaign, Product, Budget pacing, Target ROI vs Actual ROI)
2. **Video Intelligence** (Creative performance, Delivery status, Attribution, Hook rates)
3. **LIVE GMV Max** (Livestream session-level ads attribution, Hourly performance, Traffic distribution)

### 1.2 Benchmark Context & Baseline Data
During the production acceptance period (**2026-09-01 → 2026-09-20**), the shop registered:
- **Shop Orders (Core V2 Authoritative):** 2,777 placed orders; **272,135,230 VND** Gross Order Value.
- **Advertising Overview (Core V2 Adapter):**
  - Total Ads Spend: **20,472,745 VND**
  - Attributed GMV: **245,025,689 VND**
  - Overall Ads ROI: **11.97x**
  - Product GMV Max Spend / GMV: **14,415,406 VND** spend / **174,098,150 VND** GMV (ROI 12.08x)
  - LIVE GMV Max Spend / GMV: **6,057,339 VND** spend / **70,927,539 VND** GMV (ROI 11.71x)
  - Date Coverage: **20/20 days (100.0%)** recorded in `tiktok_campaign_daily_reports`.

### 1.3 High-Level Buildability Verdict

| Module Target | Audit Verdict | Executive Summary Findings |
|---|---|---|
| **GMV Max Campaign Intelligence** | **READY_WITH_GAPS** | Daily fact data exists in `tiktok_campaign_daily_reports` for campaign-level spend, GMV, orders, ROI, and CPA. Campaign metadata exists in `tiktok_campaigns`. Gap: lacks automated cron sync pipeline and needs separation from legacy single-shop configuration. |
| **Product GMV Max Breakdown** | **BLOCKED / NOT_AVAILABLE** | Neither the database schemas (`tiktok_campaigns`, `tiktok_campaign_daily_reports`) nor the Marketing API clients currently map `campaign_id` ↔ `product_id`. Building Campaign → Product spend/ROI tables is currently impossible. |
| **Video / Creative Intelligence** | **BLOCKED** *(for date-bounded analysis)* | The existing table `tiktok_video_ads` is an **undated snapshot table** without a `stat_date` column. Legacy sync overwrites snapshot metrics, and legacy code injects synthetic templates and CRC32 cancellations. Requires a new daily fact schema and verified API. |
| **LIVE GMV Max Session Attribution** | **BLOCKED / PARTIAL** | `commerce_live_sessions` (Migration 008) has high-precision organic session metrics but zero ads metrics. Legacy `tiktok_live_sessions` has a scalar `ad_spend` column and a single string `campaign_id`, making multi-campaign joins and date-interval attribution mathematically unsafe. |

---

## 2. CURRENT ADVERTISING ARCHITECTURE

The repository contains a hybrid architecture composed of **Core V2 Architecture Services** (production-grade, date-bounded, non-fabricating) and **Legacy Services / Scripts** (unnormalized, snapshot-overwriting, containing synthetic fallbacks).

### 2.1 Codebase Inventory

| File Path | Class / Function | Purpose | Data Source | Status / Architecture | Safe to Reuse? |
|---|---|---|---|---|---|
| `public/api/commerce_ads_service.php` | `CommerceAdsService` | Reads and aggregates date-bounded advertising metrics, coverage percentage, provenance metadata, and GMV Max breakdown. | `tiktok_campaign_daily_reports`, `tiktok_campaigns` | **V2 Production Core** | **YES (Recommended Core)** |
| `public/api/commerce_dashboard.php` | `action=get_advertising_overview`, `action=get_dashboard_report` | Serves dashboard endpoints with strict availability semantics and provenance contracts. | `CommerceAdsService` | **V2 Production Core** | **YES** |
| `public/api/db.php` | `requestTikTokAdsAPI()` | Central cURL HTTP client for TikTok Marketing API v1.3 with auth token injection. | TikTok Marketing API v1.3 (`https://business-api.tiktok.com/open_api/v1.3`) | **V2 & Legacy Shared** | **YES (with rate-limiting hardening)** |
| `public/api/db.php` | `initializeDatabase()` | Auto-migration / DDL script initializing database tables if missing. | MySQL DDL | **Legacy / Setup** | **NO (Replace with formal SQL migrations)** |
| `public/api/oauth_ads.php` | Handlers for `auth`, `disconnect`, and OAuth2 callback | Handles TikTok Ads OAuth flow, exchanges authorization code for `ads_access_token`, saves `advertiser_id`. | TikTok Ads OAuth2 | **V2 & Legacy Shared** | **YES (Functional)** |
| `public/api/campaigns.php` | `GET / POST` campaigns handler | Legacy campaign list and detail endpoint. Reads campaigns and creative video list. | `tiktok_campaigns`, `tiktok_video_ads`, `tiktok_campaign_daily_reports` | **Legacy** | **NO (Contains destructive DELETEs & simulated clicks/imps)** |
| `public/api/sync.php` | `sync.php` execution block | Ad-hoc manual sync pulling campaigns, GMV Max reports, and videos from TikTok Ads API. | Marketing API `/campaign/get/`, `/report/integrated/get/`, `/gmv_max/report/get/`, `/gmv_max/video/get/` | **Legacy Pipeline** | **NO (Contains hardcoded BC ID, AOV multiplication, spend/80 estimation)** |
| `public/api/creatives_data.php` | `getComprehensiveCreativesList()`, `syncDailyReportsToDatabase()`, `syncCreativesToDatabase()` | Seeds video table, runs daily reports sync, assigns delivery quadrants. | Hardcoded base templates, API `/gmv_max/report/get/` | **Legacy Pipeline** | **PARTIAL (`syncDailyReportsToDatabase` logic is valid; templates must be removed)** |
| `public/api/tiktok_client.php` | `TikTokShopClient` | TikTok Shop Open API client (Shop Analytics, Orders, Finance, Fulfillment). | TikTok Shop Open API v2/202309 | **V2 Production Core** | **YES (for Shop/Organic)** |
| `src/CommerceDashboardView.jsx` | Advertising Cards & Tabs | Renders Advertising Cost Overview, KPI cards, and drilldown containers. | `/api/commerce_dashboard.php` | **V2 Production UI** | **YES** |
| `src/App.jsx` | Legacy tabs (`overview`, `campaigns`, `live`, `automation`) | 7,800+ lines React dashboard containing legacy views and fallback mock session arrays. | Local state, `/api/campaigns.php`, `/api/sync.php` | **Legacy UI** | **NO (Do not build V2-02 inside legacy tabs)** |
| `public/extension/content_script.js` | Extension DOM Scraper | Scrapes Compass Overview metrics from TikTok Seller Center web interface. | Seller Center DOM (`tiktok_seller_center_snapshots`) | **Connector Tool** | **N/A (Not Ads API)** |

---

## 3. DATABASE INVENTORY

### 3.1 Advertising & Analytics Tables Detailed Audit

#### 1. `tiktok_campaign_daily_reports`
- **Classification:** `DAILY_FACT`
- **Primary Key:** `id` (`INT(11) AUTO_INCREMENT`)
- **Unique Constraint:** `UNIQUE KEY idx_camp_date (campaign_id, stat_date)`
- **Key Columns:**
  - `campaign_id` (`VARCHAR(100)`): Campaign identifier.
  - `stat_date` (`DATE`): Reporting date (YYYY-MM-DD).
  - `spend` (`DECIMAL(15,2)`): Advertising spend incurred on `stat_date`.
  - `gmv` (`DECIMAL(15,2)`): Gross revenue attributed to campaign on `stat_date`.
  - `orders` (`INT(11)`): Attributed order count.
  - `roi` (`DECIMAL(5,2)`): Daily ROI (`gmv / spend`).
  - `cpa` (`DECIMAL(15,2)`): Cost per order (`spend / orders`).
  - `total_videos` (`INT(11)`), `active_videos` (`INT(11)`).
- **Date/Time Grain:** Daily calendar date (`stat_date`). Date-bounded queries are fully supported.
- **Shop / Advertiser Identifiers:** **MISSING** (No `shop_id` or `advertiser_id` column; implicitly assumes single shop configured in `tiktok_config`).
- **Product / Video / LIVE Identifiers:** **MISSING** (No `product_id`, `video_id`, or `room_id`).
- **Raw Payload Availability:** None.

#### 2. `tiktok_campaigns`
- **Classification:** `LEGACY_SNAPSHOT` / `ENTITY_MASTER`
- **Primary Key:** `id` (`VARCHAR(100)`)
- **Key Columns:** `name`, `type` (`Product GMV Max`, `LIVE GMV Max`, `Quảng cáo thường`), `budget`, `spend`, `clicks`, `impressions`, `conversions`, `ad_gmv`, `target_roas`, `status`, `created_date`, `updated_at`.
- **Date/Time Grain:** **LIFETIME CUMULATIVE SNAPSHOT** (Metrics `spend`, `clicks`, `impressions`, `ad_gmv` represent total lifetime unpartitioned metrics, NOT date-filtered).
- **Shop / Advertiser Identifiers:** None on row.
- **Product / Video / LIVE Identifiers:** None.
- **Limitation:** Cannot be used for date-filtered reporting.

#### 3. `tiktok_video_ads`
- **Classification:** `LEGACY_SNAPSHOT`
- **Primary Key:** `id` (`VARCHAR(100)`)
- **Foreign Keys / Indices:** `campaign_id` (`VARCHAR(100)`), index `(campaign_id, status_quadrant)`.
- **Key Columns:** `title`, `spend`, `views`, `clicks`, `ctr`, `cvr`, `conversions`, `gmv`, `thumbnail`, `video_url`, `author_name`, `status_quadrant`, `action_recommendation`, `cpm`, `cpc`, `frequency`, `target_roas`, `delivery_group`, `delivery_status`, `why_spending`, `why_not_spending`, `retention_6s`, `trend_status`, `yesterday_orders`, `today_orders`, `seven_days_orders`, `thirty_days_orders`, `total_orders`, `cancelled_orders`, `cancel_rate`, `cancelled_gmv`, `cancel_risk_level`.
- **Date/Time Grain:** **NONE (NO DATE COLUMN)**. There is no `stat_date`.
- **Limitation:** It is a mutable snapshot table. Any date-range sync (`sync.php`) overwrites lifetime metrics with the requested date range slice. Contains synthetic baseline values from `creatives_data.php`.

#### 4. `tiktok_live_sessions`
- **Classification:** `ENTITY_MASTER` / `SNAPSHOT`
- **Primary Key:** `id` (`INT(11) AUTO_INCREMENT`), `UNIQUE KEY idx_room_id (room_id)`
- **Key Columns:** `room_id`, `campaign_id` (`VARCHAR(100)` nullable), `channel_name`, `duration`, `start_time` (`VARCHAR(100)` formatted as string), `end_time`, `gmv`, `ad_spend`, `orders`, `viewers`, `impressions`, `views`, `gmv_per_hour`, `gpm`, `avg_watch_time`, `comment_rate`, `follow_rate`, `enter_room_rate`, `click_rate`, `ctr_live`, `sku_order_rate`, `share_rate`, `like_rate`, `view_gt_1min`, `traffic_sources` (JSON text), `top_products` (JSON text), `audience_profile` (JSON text).
- **Date/Time Grain:** Single livestream session event. Note: `start_time` is stored as an unstandardized string (e.g. `'10:33 05/09/2026'`), requiring parsing.
- **Linkage to Ads:** Contains a single nullable `campaign_id` column and scalar `ad_spend`. Does NOT record ads impressions, ads clicks, ads orders, or hourly ad pacing.

#### 5. `commerce_live_sessions` (Core V2 Migration 008)
- **Classification:** `ENTITY_MASTER`
- **Primary Key:** `id` (`BIGINT UNSIGNED AUTO_INCREMENT`), `UNIQUE KEY uniq_shop_live_session (platform, shop_id, session_id)`
- **Key Columns:** `session_id`, `shop_id`, `title`, `account_type`, `creator_id`, `creator_username`, `start_time` (`DATETIME`), `end_time` (`DATETIME`), `duration_seconds`, `gmv`, `orders_count`, `units_sold`, `customer_count`, `total_views`, `impressions`, `clicks`, `peak_concurrent_users`, `comments_count`, `shares_count`, `follows_count`.
- **Limitation:** Authoritative source for **organic TikTok Shop Analytics**, but contains **ZERO advertising metrics** (no `ad_spend`, no `ads_gmv`, no `campaign_id`).

#### 6. `commerce_video_analytics` (Core V2 Migration 008)
- **Classification:** `DAILY_FACT`
- **Primary Key:** `id` (`BIGINT UNSIGNED AUTO_INCREMENT`), `UNIQUE KEY uniq_shop_video_date (platform, shop_id, video_id, stat_date)`
- **Key Columns:** `video_id`, `shop_id`, `stat_date`, `title`, `duration_seconds`, `video_post_time`, `creator_type`, `creator_name`, `video_views`, `units_sold`, `gross_revenue`, `attributed_gmv`, `ctr`, `comments_count`, `shares_count`, `likes_count`, `gpm`.
- **Limitation:** Authoritative source for **organic TikTok Shop Video Analytics**, but contains **ZERO advertising spend or paid ad metrics**.

#### 7. `commerce_product_analytics` (Core V2 Migration 008)
- **Classification:** `DAILY_FACT`
- **Primary Key:** `id` (`BIGINT UNSIGNED AUTO_INCREMENT`), `UNIQUE KEY uniq_shop_product_sku_date (platform, shop_id, product_id, sku_id, stat_date)`
- **Key Columns:** `product_id`, `sku_id`, `shop_id`, `stat_date`, `product_name`, `units_sold`, `gross_revenue`, `page_views`, `unique_visitors`, `cvr`.
- **Limitation:** Authoritative source for **product page views and conversions**, but contains **ZERO advertising campaign link or ad spend metrics**.

---

## 4. GMV MAX CAMPAIGN CAPABILITY

### 4.1 Campaign-Level Metric Provenance Matrix

| Metric Name | Status | Field Name | Source Table / API | Grain | Date Bounded? | Historical? | Freshness / Confidence |
|---|---|---|---|---|---|---|---|
| `campaign_id` | **AVAILABLE** | `campaign_id` | `tiktok_campaign_daily_reports` / API `/gmv_max/report/get/` | Campaign x Day | YES | YES | High |
| `campaign_name` | **AVAILABLE** | `name` | `tiktok_campaigns` / API `/campaign/gmv_max/info/` | Campaign Master | NO (Metadata) | YES | High |
| `campaign_status` | **AVAILABLE** | `status` | `tiktok_campaigns` / API `/campaign/gmv_max/info/` (`operation_status`) | Campaign Master | NO (Current) | Current only | High |
| `campaign_type` | **AVAILABLE** | `type` | `tiktok_campaigns` (`Product GMV Max` vs `LIVE GMV Max`) | Campaign Master | NO (Metadata) | YES | Medium (Heuristic in legacy; direct in API `/campaign/gmv_max/info/`) |
| `date` | **AVAILABLE** | `stat_date` | `tiktok_campaign_daily_reports` | Daily | YES | YES | High (20/20 days benchmark) |
| `spend` / `cost` | **AVAILABLE** | `spend` / `cost` | `tiktok_campaign_daily_reports.spend` | Campaign x Day | YES | YES | High |
| `gross_revenue` / `attributed_gmv` | **AVAILABLE** | `gmv` / `gross_revenue` | `tiktok_campaign_daily_reports.gmv` | Campaign x Day | YES | YES | High |
| `orders` | **AVAILABLE** | `orders` | `tiktok_campaign_daily_reports.orders` | Campaign x Day | YES | YES | High |
| `cost_per_order` / `cpa` | **AVAILABLE** | `cpa` / `cost_per_order` | `tiktok_campaign_daily_reports.cpa` | Campaign x Day | YES | YES | High |
| `roi` / `roas` | **AVAILABLE** | `roi` | `tiktok_campaign_daily_reports.roi` | Campaign x Day | YES | YES | High |
| `budget` | **AVAILABLE** | `budget` | `tiktok_campaigns.budget` | Campaign Master | NO (Current) | Current only | High |
| `target_roi` / `target_roas` | **AVAILABLE** | `target_roas` | `tiktok_campaigns.target_roas` | Campaign Master | NO (Current) | Current only | High |
| `impressions` | **NOT AVAILABLE** | N/A | None (Not in `daily_reports`) | Campaign x Day | N/A | N/A | **Simulated in legacy (`spend / 10`)** |
| `views` | **NOT AVAILABLE** | N/A | None | Campaign x Day | N/A | N/A | UNAVAILABLE |
| `clicks` | **NOT AVAILABLE** | N/A | None (Not in `daily_reports`) | Campaign x Day | N/A | N/A | **Simulated in legacy (`spend / 80`)** |
| `ctr` | **NOT AVAILABLE** | N/A | None | Campaign x Day | N/A | N/A | UNAVAILABLE |
| `product_id` | **NOT AVAILABLE** | N/A | None | N/A | N/A | N/A | UNAVAILABLE |

### 4.2 Key Findings
1. At the **Campaign Level**, the system **can reliably provide date-bounded performance** (`spend`, `gmv`, `orders`, `roi`, `cpa`) from `tiktok_campaign_daily_reports`.
2. Engagement metrics (`impressions`, `clicks`, `ctr`) are **completely absent** from `tiktok_campaign_daily_reports`. In the legacy file `public/api/sync.php` (lines 457–458 and 480–481) and `public/api/campaigns.php` (lines 97–98), `clicks` was fabricated via `round(spend / 80)` and `impressions` via `round(spend / 10)`. **In V2-02, these metrics must be reported as `null` or queried from an authorized API endpoint.**

---

## 5. PRODUCT GMV MAX CAPABILITY

### 5.1 Audit of Campaign ↔ Product Mapping
- Desired Master Spec hierarchy: `Campaign → Product → Spend → Attributed GMV → Orders → ROI`.
- **Database Schema Audit:**
  - `tiktok_campaigns` contains NO `product_id` column.
  - `tiktok_campaign_daily_reports` contains NO `product_id` column.
  - `commerce_product_analytics` contains `product_id`, `page_views`, `units_sold`, `gross_revenue`, but contains **ZERO advertising fields** (`campaign_id`, `ad_spend`, `roas`).
- **Marketing API Client Audit:**
  - `public/api/sync.php` and `creatives_data.php` call `/gmv_max/report/get/` with `dimensions: ['campaign_id', 'stat_time_day']`.
  - There is NO API call to `/gmv_max/product/get/` or product-level reporting dimensions anywhere in the repository.

### 5.2 Verdict: `NOT_AVAILABLE`
- **It is currently IMPOSSIBLE to construct a product-level GMV Max breakdown table** (`Campaign → Product → Spend → GMV → Orders → ROI`) using existing database records or current API calls.
- **Specific Gap:** Lack of product-dimension reporting from TikTok Marketing API and lack of an intermediate mapping table (`commerce_ads_product_daily`).

---

## 6. VIDEO / CREATIVE CAPABILITY

### 6.1 Audit of `tiktok_video_ads`
- **Schema & Grain:** Table `tiktok_video_ads` is classified as `LEGACY_SNAPSHOT`.
- **Critical Architectural Flaw:**
  - `tiktok_video_ads` has **NO date column** (no `stat_date` or timestamp grain).
  - Its columns are lifetime accumulators or rolling-window snapshot columns (`yesterday_orders`, `today_orders`, `seven_days_orders`, `thirty_days_orders`, `seven_days_roas`, `thirty_days_roas`).
  - When `sync.php` executes a date-filtered query (e.g. 2026-09-01 → 2026-09-20), it executes `UPDATE tiktok_video_ads SET spend = :spend, gmv = :gmv...`, overwriting the static record with the queried date slice.
- **Synthetic Fabrication in Legacy Code:**
  - `public/api/creatives_data.php` defines hardcoded video arrays (`$baseTemplates`) with static IDs and titles.
  - In `public/api/sync.php` (lines 278–281):
    ```php
    // Nếu API chưa trả về gross_revenue nhưng đã có đơn hàng -> tính theo AOV chuẩn 149.000đ của Sủi mát gan
    if ($vGmv <= 0 && $vConvs > 0) {
        $vGmv = $vConvs * 149000;
    }
    ```
  - In `public/api/creatives_data.php` (lines 580–620): cancellations are fabricated using CRC32 hash formulas:
    ```php
    $pseudoHash = abs(crc32($vId . '_cancel_risk'));
    $cancelRate = 8.5 + ($pseudoHash % 170) / 10.0;
    ```

### 6.2 Verdict: `BLOCKED` for Date-Range Historical Reporting
- Current video data **cannot be used for date-range bounded historical reporting** because there is no daily fact grain.
- It can only represent an unverified, point-in-time snapshot.
- Historical date-range filtering for videos requires a new daily table (`commerce_ads_video_daily`).

---

## 7. VIDEO IDENTITY & DISTRIBUTION

### 7.1 Canonical Identity Audit
A video can originate from three channels:
1. **GMV Max Ad Video:** Identified by TikTok video ID or creative ID via `/gmv_max/video/get/`.
2. **Organic Shop Video:** Identified by `video_id` in `commerce_video_analytics`.
3. **Affiliate Content:** Identified by creator handle and video URL.

| Identity Layer | Current Identifier | Relationship to Others | Mapping Feasibility |
|---|---|---|---|
| **GMV Max Ad Video** | `tiktok_video_ads.id` | Belongs to `campaign_id` | PROVEN (Within Ads domain) |
| **Organic Video** | `commerce_video_analytics.video_id` | Belongs to `shop_id` | PROVEN (Within Shop domain) |
| **Cross-Domain Link (Ads ↔ Organic)** | None | Same 19-digit TikTok item ID string format | **UNSAFE / NOT_AVAILABLE** |

> [!WARNING]
> While both GMV Max and Organic video IDs use TikTok's 19-digit numerical format (e.g. `7677553920239045896`), there is no foreign key or verified join table in the database. Joining purely on string equality without verification will produce false positives or miss transformed creative IDs.

### 7.2 Creative Distribution Factual States
To determine whether TikTok is actively distributing a creative video, the system must avoid arbitrary subjective tiers (e.g. `LOW_DELIVERY`). 

**Recommended Strict Factual Rules:**
- `HAS_DELIVERY`: Measured `spend > 0` OR measured `impressions > 0`.
- `NO_DELIVERY`: Measured `spend == 0` AND measured `impressions == 0` AND campaign status is enabled.
- `UNKNOWN`: When metric data for the requested period is not synced or unmeasured.

---

## 8. LIVE GMV MAX CAPABILITY

### 8.1 Audit of LIVE Advertising Data
- **Entity Identification:** `tiktok_live_sessions.room_id` and `commerce_live_sessions.session_id`.
- **Campaign Identification:** `tiktok_campaigns` where `type = 'LIVE GMV Max'` or `name LIKE '%LIVE%'`.
- **Linkage Analysis:**
  - `tiktok_live_sessions` contains a column `campaign_id VARCHAR(100)`.
  - In `public/api/db.php` (line 511), all seeded live sessions were assigned hardcoded `:campaign_id = '1862632140958017'`.
  - There is no hourly spend breakdown. If a live session lasted 2 hours on 2026-09-05, the database only stores the full-day spend of campaign `1862632140958017` in `tiktok_campaign_daily_reports`.

### 8.2 Verdict on LIVE Ads Campaign → LIVE Session Mapping: `PARTIAL / NOT_AVAILABLE`
- A 1-to-1 relationship between a LIVE campaign and a LIVE session **does not exist in the database**.
- If multiple live sessions occur in a single day, or if multiple ad campaigns target a single session, the system cannot distribute campaign daily spend to individual sessions without arbitrary guessing.

---

## 9. LIVE SESSION IDENTITY

### 9.1 Session Identity Audit across Tables
- `commerce_live_sessions`: Identified uniquely by `(platform, shop_id, session_id)`. `start_time` is a standard `DATETIME`.
- `tiktok_live_sessions`: Identified by `room_id`. `start_time` is stored as an unparsed string (`10:33 05/09/2026`).
- **Joining on Calendar Date Alone is STRICTLY FORBIDDEN:** A seller frequently conducts 2 to 3 live sessions within the same calendar day (e.g. morning shift and evening shift). Joining ads to live sessions solely by `DATE(stat_date) = DATE(start_time)` produces duplicate rows or invalid Cartesian products.

### 9.2 Proposed Canonical LIVE Session Key (Architectural Recommendation Only)
$$\text{Canonical Session Key} = \{\text{platform}, \text{shop\_id}, \text{session\_id}\}$$
With temporal validation window:
$$[\text{start\_time}, \text{COALESCE}(\text{end\_time}, \text{start\_time} + \text{duration\_seconds})]$$

---

## 10. LIVE BUSINESS KPI CAPABILITY

| Management KPI | Status | Source / Formula | Classification |
|---|---|---|---|
| **GMV** | **AVAILABLE** | `commerce_live_sessions.gmv` | DIRECT_API |
| **Orders** | **AVAILABLE** | `commerce_live_sessions.orders_count` | DIRECT_API |
| **Items Sold** | **AVAILABLE** | `commerce_live_sessions.units_sold` | DIRECT_API |
| **Duration** | **AVAILABLE** | `commerce_live_sessions.duration_seconds` | DIRECT_API |
| **GMV / Hour** | **DERIVABLE** | `round(gmv / (duration_seconds / 3600), 2)` | DERIVED_SAFE |
| **Impressions** | **AVAILABLE** | `commerce_live_sessions.impressions` | DIRECT_API |
| **Views** | **AVAILABLE** | `commerce_live_sessions.total_views` | DIRECT_API |
| **LIVE Click Rate** | **DERIVABLE** | `round((clicks / impressions) * 100, 2)` | DERIVED_SAFE |
| **Comments Count** | **AVAILABLE** | `commerce_live_sessions.comments_count` | DIRECT_API |
| **Shares Count** | **AVAILABLE** | `commerce_live_sessions.shares_count` | DIRECT_API |
| **Followers Gained** | **AVAILABLE** | `commerce_live_sessions.follows_count` | DIRECT_API |
| **Product Clicks** | **AVAILABLE** | `commerce_live_sessions.clicks` | DIRECT_API |
| **Order Conversion Rate** | **DERIVABLE** | `round((orders_count / total_views) * 100, 2)` | DERIVED_SAFE |
| **GPM (GMV / 1k Imps)** | **DERIVABLE** | `round((gmv / impressions) * 1000, 2)` | DERIVED_SAFE |
| **Ads Spend (Session)** | **PARTIAL** | Only in legacy `tiktok_live_sessions.ad_spend`; absent in V2 | DERIVED_UNSAFE |
| **Ads GMV (Session)** | **NOT_AVAILABLE** | Only available at Campaign Daily level | UNAVAILABLE |
| **Ads Orders (Session)** | **NOT_AVAILABLE** | Absent at session level | UNAVAILABLE |
| **Ads ROI (Session)** | **NOT_AVAILABLE** | Cannot calculate without session ads spend & GMV | UNAVAILABLE |
| **Cost / Order (Session)** | **NOT_AVAILABLE** | Absent at session level | UNAVAILABLE |

---

## 11. TIKTOK ANALYTICS RELATIONSHIP

### 11.1 Analytical Domain Cross-Reference

```
                    ┌────────────────────────┐
                    │      COMMERCE SHOP     │
                    │   (shop_id, stat_date) │
                    └───────────┬────────────┘
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  ORDERS DOMAIN  │    │ MARKETING ADS   │    │ SHOP ANALYTICS  │
│ commerce_orders │    │ daily_reports   │    │ video, product, │
│      (V2)       │    │   (Marketing)   │    │  live sessions  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 11.2 Join Keys & Mapping Confidence

| Source A | Source B | Join Key | Relationship Confidence | Practical Risk |
|---|---|---|---|---|
| `commerce_shop_analytics_daily` | `tiktok_campaign_daily_reports` | `shop_id` + `stat_date` | **PROVEN / SAFE** | Low risk; provides shop-level high-altitude daily comparison. |
| `commerce_orders` | `tiktok_campaign_daily_reports` | `stat_date` (via `created_time`) | **PROVEN / SAFE** | Valid for high-level Ads Cost Ratio (`Ads Spend / Shop Gross`). |
| `commerce_product_analytics` | Marketing Ads (Campaign) | `product_id` | **NONE** | No product identifier exists in Ads campaign reports. |
| `commerce_video_analytics` | `tiktok_video_ads` | `video_id` ↔ `id` | **UNSAFE** | No date alignment; Ads video table is an undated snapshot. |
| `commerce_live_sessions` | `tiktok_campaign_daily_reports` | `start_time` ↔ `stat_date` | **UNSAFE** | High risk of multi-session collision on the same date. |

---

## 12. ATTRIBUTION CONTRACT

### 12.1 Authoritative Definitions
1. **Shop Gross Revenue (`commerce_orders` / `order_derived_gross`):**
   - **Nature:** Authoritative direct sales from completed customer checkouts.
   - **Grain:** Exact order items, payment amounts, and shipping fees.
   - **Rule:** This is the ground truth of financial transactions.
2. **Ads Attributed GMV (`metrics.gross_revenue` or `ad_gmv`):**
   - **Nature:** Model-derived platform attribution. TikTok Marketing API attributes purchases made by users who clicked (7-day window) or viewed (1-day window) an ad.
   - **Rule:** Ads Attributed GMV **overlaps** with organic and affiliate sales.
   - **STRICT PROHIBITION:** **Shop Gross != Ads GMV**. Ads GMV must NEVER be added to Shop Gross, nor can Shop Gross be arbitrarily distributed across ad campaigns.

### 12.2 Attribution Hierarchy Classification

| Hierarchy Level | Spend Attribution | GMV Attribution | Order Attribution | Contract Classification |
|---|---|---|---|---|
| **Shop Ads Total** | Sum of daily campaign spend | Sum of daily campaign GMV | Sum of daily campaign orders | **AUTHORITATIVE_SOURCE** |
| **Campaign Level** | Direct from Marketing API report | Direct from Marketing API report | Direct from Marketing API report | **AUTHORITATIVE_SOURCE** |
| **Product Level** | None available | None available | None available | **UNAVAILABLE** |
| **Video Creative Level** | Undated snapshot in legacy | Undated snapshot in legacy | Undated snapshot in legacy | **DERIVED_UNSAFE / UNAVAILABLE** |
| **LIVE Session Level** | Scalar in legacy; none in V2 | None at session level | None at session level | **UNAVAILABLE** |

---

## 13. RECONCILIATION CAPABILITY

### 13.1 Reconciliation Mathematical Feasibility

| Expected Relation | Actual System Capability | Possible Variance | Root Cause Explanation |
|---|---|---|---|
| **Total Ads = Product GMV Max + LIVE GMV Max** | **PROVEN & RECONCILED** | 0.0% variance | In `CommerceAdsService`, campaigns are partitioned by type (`Product GMV Max` vs `LIVE GMV Max`), summing perfectly to total ads spend and GMV. |
| **Product GMV Max ≈ $\sum$ Campaigns** | **PROVEN & RECONCILED** | 0.0% variance | Product GMV Max is the direct mathematical sum of all active product campaigns in `tiktok_campaign_daily_reports`. |
| **Campaign ≈ $\sum$ Products** | **IMPOSSIBLE** | 100% unreconciled | System lacks product-level ads attribution. |
| **Campaign ≈ $\sum$ Videos** | **IMPOSSIBLE** | Significant variance | `tiktok_video_ads` is an undated snapshot table containing synthetic seeds; its sum does not equal period campaign spend. |
| **LIVE GMV Max ≈ $\sum$ LIVE Sessions** | **IMPOSSIBLE** | Significant variance | Campaign daily reports record daily ad totals; session rows record unverified scalar values without hourly alignment. |

### 13.2 Recommended Attribution Coverage Metrics
When sub-level attribution tables are introduced in V2-02, the following non-fabricating coverage formulas should be applied:
$$\text{Spend Coverage \%} = \frac{\sum \text{Child Spend}}{\text{Parent Spend}} \times 100\%$$
$$\text{GMV Coverage \%} = \frac{\sum \text{Child Attributed GMV}}{\text{Parent Attributed GMV}} \times 100\%$$
If $\text{Coverage \%} < 100\%$, the difference must be explicitly labeled as **"Chưa phân bổ (Unallocated)"**, never forced to 0.

---

## 14. CURRENT API CAPABILITY

All Marketing API interactions pass through `requestTikTokAdsAPI()` in `public/api/db.php`.

### 14.1 Inventory of Exact API Endpoints Found in Codebase

#### Endpoint 1: Auction Campaigns Fetch
- **HTTP Method:** `GET`
- **Path:** `/campaign/get/`
- **Location:** `public/api/sync.php:74`
- **Parameters:** `advertiser_id`, `page: 1`, `page_size: 100`
- **Fields Returned:** `campaign_id`, `campaign_name`, `budget`, `operation_status`, `objective_type`
- **Pagination:** Manual `page: 1` (does not loop `next_page`)
- **Status:** **FUNCTIONAL** (for standard auction campaigns)

#### Endpoint 2: Integrated Basic Reporting (Auction Campaigns)
- **HTTP Method:** `GET`
- **Path:** `/report/integrated/get/`
- **Location:** `public/api/sync.php:87`, `public/api/creatives_data.php:839`
- **Parameters:**
  - `advertiser_id`: Advertiser ID
  - `report_type`: `'BASIC'`
  - `data_level`: `'AUCTION_CAMPAIGN'`
  - `dimensions`: `['campaign_id']` (or `['campaign_id', 'stat_time_day']`)
  - `metrics`: `['spend', 'impressions', 'clicks', 'ctr', 'onsite_shopping', 'onsite_shopping_roas']`
  - `start_date`, `end_date`
  - `page: 1`, `page_size: 100`
- **Status:** **FUNCTIONAL** for standard auction campaigns.

#### Endpoint 3: GMV Max Campaign Reporting
- **HTTP Method:** `GET`
- **Path:** `/gmv_max/report/get/`
- **Location:** `public/api/sync.php:112`, `public/api/creatives_data.php:805`
- **Parameters:**
  - `advertiser_id`: Advertiser ID
  - `store_ids`: `[$shopId]`
  - `dimensions`: `['campaign_id']` (or `['campaign_id', 'stat_time_day']`)
  - `metrics`: `['cost', 'gross_revenue', 'roi', 'orders', 'cost_per_order']`
  - `start_date`, `end_date`
  - `page: 1`, `page_size: 100`
- **Status:** **FUNCTIONAL** (Authoritative source of `tiktok_campaign_daily_reports`).

#### Endpoint 4: GMV Max Campaign Metadata
- **HTTP Method:** `GET`
- **Path:** `/campaign/gmv_max/info/`
- **Location:** `public/api/sync.php:189`
- **Parameters:** `advertiser_id`, `campaign_id`
- **Fields Returned:** `campaign_name`, `budget`, `operation_status`, `create_time`, `shopping_ads_type` (`'PRODUCT'` | `'LIVE'`)
- **Status:** **FUNCTIONAL**

#### Endpoint 5: GMV Max Creative Videos
- **HTTP Method:** `GET`
- **Path:** `/gmv_max/video/get/`
- **Location:** `public/api/sync.php:253`
- **Parameters:**
  - `advertiser_id`: Advertiser ID
  - `store_id`: `shop_id`
  - `store_authorized_bc_id`: Hardcoded Business Center ID (`7387314008006639632`)
  - `page: 1`, `page_size: 50`
- **Metrics in Response:** `cost`, `gross_revenue`, `orders`, `impressions`, `clicks`, `ctr`, `cvr`
- **Limitation:** Does not pass date filters or pagination tokens. Returns a point-in-time list.
- **Status:** **NEEDS_OFFICIAL_DOC_VERIFICATION** (Requires verification of date-range parameter support).

---

## 15. SYNC ARCHITECTURE

### 15.1 Current Sync Architecture Assessment
- **Trigger Mechanism:** Purely ad-hoc / on-demand during web page request (`sync.php`) or UI refresh button.
- **Background Workers:** None currently configured for TikTok Ads. (Core V2 has `commerce_sync_service.php` for Orders and Finance, but not for Ads).
- **Execution Bottleneck:** Calling multiple external APIs synchronously in `sync.php` causes timeout risks on large date ranges.

### 15.2 Proposed V2-02 Multi-Tier Sync Architecture (Recommendation Only)

```
[TikTok Marketing API]
         │
         ▼
[Raw Ingestion Staging / Audit Log] (commerce_ads_sync_runs)
         │
         ▼
[Normalized Daily Fact Ingestion] (Upsert on unique keys)
         │
         ▼
[Core V2 Daily Fact Tables] (commerce_ads_campaign_daily, etc.)
         │
         ▼
[CommerceAdsService Aggregates] (< 10ms Fast Read)
         │
         ▼
[Frontend UI] (Infinite loading eliminated)
```

### 15.3 Recommended Cadence & Data Temperature Strategy
1. **HOT Data (Today & Yesterday):**
   - Synced every **2 to 3 hours** to capture intraday spend pacing and live campaigns.
2. **WARM Data (Last 7 Days):**
   - Synced **once daily at 02:00 AM** to reconcile attribution conversions that mature over the 7-day click attribution window.
3. **MATURED Data (> 7 Days):**
   - Synced only on manual request or quarterly reconciliation audit. Immutable once past the 30-day RMA window.
4. **LIVE Active Sessions:**
   - Synced every **15 minutes** while the session is active.
5. **LIVE Completed Sessions:**
   - Final reconciliation batch run **2 hours after live stream end time**.

---

## 16. DATA GAP MATRIX

| Capability Domain | Current Source | Status | Identified Architectural Gap | V2-02 Action Required |
|---|---|---|---|---|
| **Ads Total Overview** | `tiktok_campaign_daily_reports` | **READY** | Single shop assumption in config | Maintain `CommerceAdsService` |
| **Campaign Daily Fact** | `tiktok_campaign_daily_reports` | **READY** | Engagement metrics (`clicks`, `imps`) missing | Add engagement metrics to daily sync |
| **Campaign ↔ Product** | None | **BLOCKED** | Zero product mapping in schema or API | Verify product dimension API / create `commerce_ads_product_daily` |
| **Campaign ↔ Video** | `tiktok_video_ads` | **BLOCKED** | Undated snapshot table; overwrites metrics | Create `commerce_ads_video_daily` with `stat_date` |
| **Video Delivery Status** | `tiktok_video_ads.delivery_status` | **PARTIAL** | Hardcoded heuristics in `creatives_data.php` | Adopt strict factual rules (`spend > 0 \|\| imps > 0`) |
| **Video Attributed GMV** | `tiktok_video_ads.gmv` | **BLOCKED** | Hardcoded AOV multiplication (`orders * 149k`) | Ingest verified API metric; eliminate fallback multiplier |
| **Video Orders** | `tiktok_video_ads.conversions` | **PARTIAL** | Point-in-time snapshot only | Move to daily fact table |
| **LIVE Campaign Totals** | `tiktok_campaign_daily_reports` | **READY** | Filtered by campaign name/type | Maintain V2 adapter aggregation |
| **LIVE Session Identity** | `commerce_live_sessions` | **READY** | High quality organic telemetry | Standardize canonical session key |
| **LIVE Session Ads Spend** | `tiktok_live_sessions.ad_spend` | **BLOCKED** | Unverified scalar; no multi-campaign join | Build time-window overlapping attribution |
| **LIVE Session Ads GMV** | None | **BLOCKED** | Only exists at campaign daily level | Requires session-level ads attribution |
| **LIVE Session Ads Orders** | None | **BLOCKED** | Only exists at campaign daily level | Requires session-level ads attribution |
| **LIVE Traffic & Organic** | `commerce_live_sessions` | **READY** | Available in Migration 008 | Maintain `CommerceAnalyticsService` |
| **LIVE Engagement KPIs** | `commerce_live_sessions` | **READY** | Direct API & Derived safe | Maintain `computeLiveSessionKpis` |
| **Canonical Video ID** | Unconnected IDs | **PARTIAL** | No cross-reference table between Ads and Shop | Create canonical creative master table |
| **Canonical LIVE Key** | `session_id` | **READY** | Ready in Migration 008 | Use `(platform, shop_id, session_id)` |

---

## 17. MODULE BUILDABILITY

### 17.1 GMV Max Intelligence
- **Verdict:** **READY_WITH_GAPS**
- **What Can Be Built Now:**
  - Date-bounded Campaign performance table (`spend`, `gmv`, `orders`, `roi`, `cpa`, `daily_budget`).
  - Budget pacing indicators (`spend / budget * 100`).
  - Actual ROI vs Target ROI variance analysis.
  - Product GMV Max vs LIVE GMV Max macro split.
- **What Requires New Work:**
  - Automated cron sync pipeline for daily reports.
  - Adding engagement metrics (`impressions`, `clicks`, `ctr`) to daily reports without simulation.
- **What Cannot Be Supported Now:**
  - Product-level breakdown within a GMV Max campaign.

### 17.2 Video Intelligence
- **Verdict:** **BLOCKED**
- **What Can Be Built Now:**
  - Organic video ranking and engagement analysis (using `commerce_video_analytics` from Migration 008).
- **What Requires New Work:**
  - DDL Migration creating `commerce_ads_video_daily` table with `(video_id, campaign_id, stat_date)`.
  - Ingestion script pulling daily creative performance from TikTok Ads API.
  - Deprecation and removal of synthetic video templates and CRC32 cancellations.
- **What Cannot Be Supported Now:**
  - Historical date-range filtering of video ad spend and ROAS.

### 17.3 LIVE GMV Max
- **Verdict:** **BLOCKED / READY_WITH_GAPS**
- **What Can Be Built Now:**
  - Macro-level LIVE GMV Max daily spend and ROI (via campaign daily reports).
  - High-precision organic live session performance (views, duration, GPM, engagement rates from `commerce_live_sessions`).
- **What Requires New Work:**
  - Live session to ad campaign time-window attribution model.
  - Storage of session-level ad metrics in a dedicated table (`commerce_ads_live_daily`).
- **What Cannot Be Supported Now:**
  - Exact session-level Ads ROI without time-interval attribution modeling.

---

## 18. PROPOSED V2-02 DATA MODEL (RECOMMENDATION ONLY)

> [!NOTE]
> The following table structures are **architectural design proposals only**. In accordance with Phase 0 audit rules, **NO migrations or schema alterations have been executed**.

### Table 1: `commerce_ads_campaign_daily`
- **Purpose:** Upgrades and formalizes `tiktok_campaign_daily_reports` into Core V2 multi-tenant standard.
- **Grain:** 1 row per shop, per campaign, per calendar date.
- **Primary Key:** `id` (`BIGINT UNSIGNED AUTO_INCREMENT`)
- **Unique Constraint:** `uniq_shop_camp_date (platform, shop_id, campaign_id, stat_date)`
- **Key Columns:**
  - `platform` (`VARCHAR(64)` DEFAULT `'tiktok_ads'`)
  - `shop_id` (`VARCHAR(64)`), `advertiser_id` (`VARCHAR(64)`)
  - `campaign_id` (`VARCHAR(128)`), `campaign_name` (`VARCHAR(255)`), `campaign_type` (`VARCHAR(64)`)
  - `stat_date` (`DATE`)
  - `spend` (`DECIMAL(15,2)`), `gross_revenue` (`DECIMAL(15,2)`), `orders_count` (`INT UNSIGNED`)
  - `impressions` (`INT UNSIGNED`), `clicks` (`INT UNSIGNED`)
  - `roi` (`DECIMAL(7,4)`), `cpa` (`DECIMAL(15,2)`), `budget` (`DECIMAL(15,2)`), `target_roas` (`DECIMAL(7,4)`)

### Table 2: `commerce_ads_video_daily`
- **Purpose:** Replaces the undated snapshot table `tiktok_video_ads` with historical daily fact records.
- **Grain:** 1 row per shop, per campaign, per video creative, per date.
- **Primary Key:** `id` (`BIGINT UNSIGNED AUTO_INCREMENT`)
- **Unique Constraint:** `uniq_shop_vid_camp_date (platform, shop_id, campaign_id, video_id, stat_date)`
- **Key Columns:**
  - `video_id` (`VARCHAR(128)`), `campaign_id` (`VARCHAR(128)`), `stat_date` (`DATE`)
  - `title` (`VARCHAR(512)`), `thumbnail_url` (`TEXT`)
  - `spend` (`DECIMAL(15,2)`), `gross_revenue` (`DECIMAL(15,2)`), `orders_count` (`INT UNSIGNED`)
  - `impressions` (`INT UNSIGNED`), `clicks` (`INT UNSIGNED`), `views` (`INT UNSIGNED`)
  - `ctr` (`DECIMAL(7,4)`), `cvr` (`DECIMAL(7,4)`), `cpm` (`DECIMAL(15,2)`), `cpc` (`DECIMAL(15,2)`)
  - `delivery_status` (`VARCHAR(32)`) (`HAS_DELIVERY`, `NO_DELIVERY`, `UNKNOWN`)

### Table 3: `commerce_ads_live_daily`
- **Purpose:** Bridges livestream sessions with advertising spend.
- **Grain:** 1 row per shop, per session, per campaign.
- **Primary Key:** `id` (`BIGINT UNSIGNED AUTO_INCREMENT`)
- **Unique Constraint:** `uniq_shop_sess_camp (platform, shop_id, session_id, campaign_id)`
- **Key Columns:**
  - `session_id` (`VARCHAR(128)`), `campaign_id` (`VARCHAR(128)`)
  - `session_start_time` (`DATETIME`), `session_end_time` (`DATETIME`)
  - `attributed_spend` (`DECIMAL(15,2)`), `attributed_gmv` (`DECIMAL(15,2)`), `attributed_orders` (`INT UNSIGNED`)
  - `attribution_method` (`VARCHAR(64)`) (`DIRECT_CAMPAIGN_TAG`, `TIME_WINDOW_OVERLAP`)

---

## 19. REQUIRED OFFICIAL API VERIFICATION LIST

Before implementing Phase 1–3 of Sprint V2-02, the Product Owner or Technical Lead should consult official TikTok Business API documentation to verify the following specific points:

| # | Question / Research Topic | Why Required | Blocks Which Module | Expected Field / Response Structure |
|---|---|---|---|---|
| **1** | Does `/gmv_max/report/get/` support a `product_id` dimension? | To determine if Product GMV Max breakdown can be retrieved directly from the reporting API. | Product GMV Max Intelligence | `dimensions: ['campaign_id', 'product_id', 'stat_time_day']` |
| **2** | Is there a dedicated endpoint `/gmv_max/product/get/`? | If dimensions do not support `product_id`, a dedicated endpoint is needed to map products to campaigns. | Product GMV Max Intelligence | Product list with `product_id`, `cost`, `gross_revenue`, `orders`. |
| **3** | Does `/gmv_max/video/get/` support `start_date` and `end_date` parameters? | To determine if creative video performance can be queried for custom historical date ranges. | Video Creative Intelligence | Date range parameters returning daily video metrics. |
| **4** | Can `/report/integrated/get/` at `data_level: 'AUCTION_AD'` be used for GMV Max? | To obtain daily creative metrics if `/gmv_max/video/get/` only provides lifetime totals. | Video Creative Intelligence | `data_level: 'AUCTION_AD'`, dimensions: `['ad_id', 'stat_time_day']`. |
| **5** | Does TikTok provide hourly advertising spend for LIVE Shopping Ads? | To attribute ads spend accurately to a live stream session lasting 2–3 hours. | LIVE GMV Max Session Attribution | Hourly metric breakdown (`stat_time_hour`) or session tag. |

---

## 20. LEGACY FINDINGS

The audit uncovered several critical anomalies and legacy workarounds in the codebase. In accordance with audit instructions, **none of these issues were modified or refactored during this read-only phase**.

| Severity | File & Lines | Issue Description | Impact | Recommended Action for V2-02 |
|---|---|---|---|---|
| **CRITICAL** | `public/api/sync.php:248` | Hardcoded Business Center ID: `$bcId = "7387314008006639632";` | Multi-shop breakage; fails if shop operates under a different Business Center. | Store `business_center_id` dynamically in `tiktok_config`. |
| **CRITICAL** | `public/api/sync.php:278-281` | Hardcoded AOV multiplication: `if ($vGmv <= 0 && $vConvs > 0) { $vGmv = $vConvs * 149000; }` | Fabricates video GMV using an arbitrary 149,000 VND product price. | Strictly report API gross revenue or `null`. |
| **CRITICAL** | `public/api/creatives_data.php:580-620` | CRC32-based cancellation fabrication: `$cancelRate = 8.5 + (abs(crc32($vId)) % 170) / 10.0;` | Generates completely fake cancellation rates and fake cancellation notes. | Remove entirely. Source cancellations only from `commerce_loss_ledger`. |
| **CRITICAL** | `public/api/sync.php:457,480`, `public/api/campaigns.php:97` | Simulated engagement metrics: `$clicks = round($spend / 80); $imps = round($spend / 10);` | Generates fake clicks and impressions based on arbitrary division. | Return `null` when clicks/impressions are not provided by API. |
| **HIGH** | `public/api/campaigns.php:24` | Hardcoded DELETE query on every GET request: `DELETE FROM tiktok_video_ads WHERE campaign_id NOT IN ('1862822423391234', '1858464494885233', '1860322474876977')` | Destroys database records of any legitimate new campaign. | Remove destructive DELETE logic immediately in V2-02. |
| **HIGH** | `public/api/sync.php:511-512`, `public/api/campaigns.php:235-236` | Floor logic overriding shop totals: `$totalShopGmv = max($totalRealGmv, $totalAdGmv);` | Distorts shop gross if ad GMV exceeds actual settled orders. | Separate Shop Gross from Ads Attributed GMV permanently. |
| **MEDIUM** | `public/api/creatives_data.php:27-120` | Hardcoded mock video templates (`$baseTemplates`) | Injects synthetic videos into database when table is empty. | Deprecate and remove mock array. |

---

## 21. RECOMMENDED V2-02 IMPLEMENTATION PLAN

```
┌────────────────────────────────────────────────────────────────────────┐
│ SPRINT V2-02 IMPLEMENTATION ROADMAP                                    │
└────────────────────────────────────────────────────────────────────────┘

  PHASE 1: GMV MAX CAMPAIGN ENGINE (READY TO BUILD)
  ├── 1.1 Create migration for `commerce_ads_campaign_daily`
  ├── 1.2 Formalize scheduled sync pipeline in `commerce_sync_service.php`
  ├── 1.3 Build Campaign drilldown API & UI in `CommerceDashboardView`
  └── 1.4 Eliminate simulated clicks/impressions (report null when absent)

  PHASE 2: API VERIFICATION & PROOF-OF-CONCEPT
  ├── 2.1 Verify product-level GMV Max API capability
  └── 2.2 Verify creative video historical date-range endpoint

  PHASE 3: VIDEO INTELLIGENCE ENGINE (AFTER API VERIFICATION)
  ├── 3.1 Create migration for `commerce_ads_video_daily`
  ├── 3.2 Implement clean daily creative ingestion pipeline
  ├── 3.3 Remove synthetic templates and CRC32 cancellations
  └── 3.4 Implement strict delivery status rules (HAS_DELIVERY / NO_DELIVERY)

  PHASE 4: LIVE GMV MAX ATTRIBUTION ENGINE
  ├── 4.1 Create migration for `commerce_ads_live_daily`
  ├── 4.2 Implement session-to-campaign time-window attribution
  └── 4.3 Build LIVE ads ROI analysis view
```

---

## 22. FINAL GO / NO-GO MATRIX

| Feature / Sub-Feature Target | Buildability Verdict | Prerequisite Actions Before Building |
|---|---|---|
| **Campaign-Level GMV Max View** | **GO** | Migrate daily facts to V2 schema, add cron worker. |
| **Budget Pacing & Target ROI Analysis** | **GO** | Ready; uses existing `budget` and `target_roas`. |
| **Product GMV Max Breakdown Table** | **NO-GO** | Blocked on official API verification of product dimension. |
| **Video Creative Performance (Historical)** | **NO-GO** | Blocked on creating `commerce_ads_video_daily` and API verification. |
| **Organic Video Engagement Analysis** | **GO** | Ready; uses existing `commerce_video_analytics`. |
| **Creative Delivery Status (Factual)** | **GO** | Can implement rule `spend > 0 \|\| imps > 0` on available snapshot. |
| **LIVE Stream Organic Performance** | **GO** | Ready; uses existing `commerce_live_sessions`. |
| **LIVE Session Ads Spend & ROI** | **NO-GO** | Blocked on time-window attribution model and schema. |

---

## EXPLICIT ANSWERS TO AUDIT QUESTIONS A THROUGH J

### A. Can we build Campaign-level GMV Max now?
> **YES (READY_WITH_GAPS).** The system already has date-bounded historical daily reports (`spend`, `gmv`, `orders`, `roi`, `cpa`) in `tiktok_campaign_daily_reports` for 20/20 days of the benchmark period. We can immediately build Campaign-level performance tables, budget pacing, and Target ROI tracking. The only gaps are adding an automated cron background worker and querying real engagement metrics (`clicks`, `impressions`) instead of legacy simulated formulas.

### B. Can we build Product-level GMV Max now?
> **NO (BLOCKED / NOT_AVAILABLE).** Neither the database schemas nor the current API integration map campaigns to individual products. No table contains `campaign_id ↔ product_id`, and `/gmv_max/report/get/` is only queried by `campaign_id`. Building a `Campaign → Product → Spend → GMV → ROI` table is impossible until TikTok API product-level capabilities are verified.

### C. Can we build Video-level Ads Intelligence now?
> **NO for date-bounded historical analysis (BLOCKED).** The existing table `tiktok_video_ads` is an undated snapshot table lacking `stat_date`. Querying custom date ranges overwrites static records, and legacy code injects synthetic templates and CRC32 cancellations. Video Ads Intelligence can only be built after creating a new daily fact table (`commerce_ads_video_daily`).

### D. Can we reliably know whether a video is being distributed?
> **PARTIALLY (SNAPSHOT ONLY).** For the current active snapshot, we can determine distribution using the strict factual rule: `HAS_DELIVERY` if `spend > 0 || impressions > 0`, `NO_DELIVERY` if `spend == 0 && impressions == 0`, and `UNKNOWN` otherwise. However, historical distribution over past date ranges cannot be determined due to the lack of daily grain.

### E. Can we attribute GMV/orders to individual videos?
> **NO for historical date ranges (BLOCKED).** Video-level GMV in the current database is either an unpartitioned snapshot or calculated via a legacy hardcoded formula (`orders * 149,000 VND`). True historical attribution requires a verified API daily ingestion pipeline.

### F. Can we map LIVE Ads to individual LIVE sessions?
> **NO (BLOCKED / PARTIAL).** The database only stores a single nullable `campaign_id` string on `tiktok_live_sessions` (which was hardcoded in legacy seeds). `commerce_live_sessions` (Migration 008) has no ads columns. There is no relational or time-interval mapping linking ad spend to specific live sessions.

### G. Can we calculate Ads ROI per LIVE session?
> **NO (BLOCKED / DERIVED_UNSAFE).** Because session-level ad spend and session-level ad-attributed GMV are not captured, any attempt to divide session revenue by campaign spend produces invalid or misleading ROI figures.

### H. Which V2-02 metrics are impossible with current data?
> 1. Product-level Ad Spend, Attributed GMV, and Product Ads ROI.
> 2. Historical Video Ad Spend and Video Attributed GMV by custom date range.
> 3. Livestream Session-level Ad Spend, Ads Attributed GMV, and Session Ads ROI.
> 4. Verified Creative Hook Rates and Retention Rates (currently seeded or unverified).
> 5. Campaign-level Clicks and Impressions for GMV Max without API re-querying.

### I. Which additional API endpoints/fields must be verified?
> 1. `/gmv_max/report/get/`: Verify if dimension `product_id` is supported.
> 2. `/gmv_max/product/get/`: Verify if a dedicated product-level GMV Max endpoint exists.
> 3. `/gmv_max/video/get/`: Verify if `start_date` and `end_date` parameters are accepted.
> 4. `/report/integrated/get/`: Verify if `AUCTION_AD` or `AUCTION_CREATIVE` reports can be fetched for GMV Max campaigns with `stat_time_day`.
> 5. TikTok Marketing API hourly reporting capability for LIVE Shopping Ads.

### J. What minimum new data model is actually required?
> 1. `commerce_ads_campaign_daily`: Formalized multi-tenant daily campaign fact table.
> 2. `commerce_ads_video_daily`: Daily fact table with `(video_id, campaign_id, stat_date, spend, gmv, orders, imps, clicks)`.
> 3. `commerce_ads_product_daily`: Daily fact table with `(product_id, campaign_id, stat_date, spend, gmv, orders)` (pending API verification).
> 4. `commerce_ads_live_daily`: Session-to-campaign bridge table with `(session_id, campaign_id, attributed_spend, attributed_gmv)`.

---

```
READ-ONLY AUDIT COMPLETED
NO PRODUCTION MODIFICATION
NO DATABASE MODIFICATION
NO FEATURE IMPLEMENTATION
```
