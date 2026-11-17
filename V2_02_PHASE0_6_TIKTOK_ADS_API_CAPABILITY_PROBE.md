# ADDP COMMERCE INTELLIGENCE V2
# SPRINT V2-02 — PHASE 0.6: TIKTOK ADS API CAPABILITY PROBE
## Deep Contract Verification of TikTok Marketing API, Reporting Endpoints, Dimensions & Field Lineage

---

> **AUDIT CLASSIFICATION & ABSOLUTE SAFETY NOTICE**
> - **Environment:** Local Workstation Audit (`c:\AdsTiktok`)
> - **Execution Mode:** STRICTLY READ-ONLY PROBE.
> - **Safety Constraints:** ZERO production deploy, ZERO database writes (no INSERT/UPDATE/DELETE), ZERO migrations, ZERO campaign/ad edits, ZERO budget or target ROI adjustments, ZERO creative uploads, ZERO mock data generation, ZERO UI modifications, ZERO legacy refactoring.
> - **Credential & Secret Protection:** All access tokens, app secrets, and credentials remain unprinted and protected. Credential status is reported as `CONFIGURED`, `PRESENT`, or `NEEDS_RUNTIME_CREDENTIAL`.
> - **Endpoint Integrity Rule:** ZERO invented endpoints. Only endpoints verified in codebase or confirmed by official documentation are analyzed. All unproven endpoints are explicitly classified as `NEEDS_OFFICIAL_API_DOCUMENTATION`.

---

## 1. EXECUTIVE VERDICT

Phase 0 and Phase 0.5 established that while the TikTok Ads Manager UI provides deep analytical drilldowns (e.g. Campaign → Product → Creative Video, and LIVE Campaign → LIVE Session → Video), the current ADDP data pipeline has only proven a subset of these dimensions at the API level.

The technical verdict of this Phase 0.6 Capability Probe is structured as follows:

```
====================================================================================================
DOMAIN / CAPABILITY             | PROBE VERDICT              | API CAPABILITY REALITY
====================================================================================================
1. Campaign-Level GMV Max       | PROVEN_IN_CODE             | Endpoints /gmv_max/report/get/ and
                                | (GREEN)                    | /campaign/gmv_max/info/ provide daily
                                |                            | cost, gross_revenue, orders, roi, cpa.
--------------------------------+----------------------------+--------------------------------------
2. Campaign → Product GMV Max   | UI_ONLY_UNVERIFIED_API     | Dimension product_id is ABSENT from
                                | (YELLOW / BLOCKED)         | codebase API calls. No product-level
                                |                            | GMV Max endpoint is currently proven.
--------------------------------+----------------------------+--------------------------------------
3. Video / Creative Performance | LIFETIME_ONLY_SNAPSHOT     | Endpoint /gmv_max/video/get/ returns
                                | (YELLOW / PARTIAL)         | cumulative metrics; lacks date filters
                                |                            | and retention/hook rate telemetry.
--------------------------------+----------------------------+--------------------------------------
4. Integrated Basic Reporting   | PROVEN_AUCTION_ONLY        | /report/integrated/get/ provides daily
                                | (GREEN for Auction only)   | delivery metrics for auction ads;
                                |                            | commerce metrics != GMV Max revenue.
--------------------------------+----------------------------+--------------------------------------
5. Video Performance API        | NOT_FOUND_IN_CODE          | /report/video_performance/get/ is not
                                | (RED / UNVERIFIED)         | in repository. Needs official docs.
--------------------------------+----------------------------+--------------------------------------
6. LIVE GMV Max Session Attrib. | UI_AVAILABLE_API_UNVERIF.  | Ads API does not expose room_id or
                                | (RED / BLOCKED)            | session_id. Joining by date is invalid.
====================================================================================================
```

---

## 2. EXISTING TIKTOK ADS API INVENTORY

All outbound requests to the TikTok Marketing API route through `requestTikTokAdsAPI()` in [`public/api/db.php`](file:///c:/AdsTiktok/public/api/db.php#L658-L699) targeting:
$$\text{Base URL} = \text{https://business-api.tiktok.com/open_api/v1.3}$$
Authentication is handled via the HTTP header `Access-Token: {ads_access_token}` and query parameter `advertiser_id`.

### 2.1 Complete Inventory of Actual Endpoints Found in Codebase

| # | HTTP Method | Endpoint Path | Calling File & Line | API Version | Request Parameters & Dimensions | Response Parser Target | Database Destination | Capability Classification |
|---|---|---|---|---|---|---|---|---|
| **1** | `GET` | `/campaign/get/` | `sync.php:74` | v1.3 | `advertiser_id`, `page=1`, `page_size=100` | `$res['data']['list']` (`campaign_id`, `campaign_name`, `budget`, `operation_status`, `objective_type`) | `tiktok_campaigns` | **PROVEN_IN_CODE** |
| **2** | `GET` | `/campaign/gmv_max/info/` | `sync.php:189` | v1.3 | `advertiser_id`, `campaign_id` | `$res['data']` (`campaign_name`, `budget`, `operation_status`, `create_time`, `shopping_ads_type`) | `tiktok_campaigns` | **PROVEN_IN_CODE** |
| **3** | `GET` | `/report/integrated/get/` | `sync.php:87`<br>`creatives_data.php:839` | v1.3 | `advertiser_id`, `report_type='BASIC'`, `data_level='AUCTION_CAMPAIGN'`, `dimensions=['campaign_id', 'stat_time_day']`, `metrics=['spend', 'impressions', 'clicks', 'ctr', 'onsite_shopping', 'onsite_shopping_roas']`, `start_date`, `end_date` | `$res['data']['list']` (`dimensions.campaign_id`, `dimensions.stat_time_day`, `metrics.*`) | `tiktok_campaign_daily_reports` | **PROVEN_IN_CODE** (Auction only) |
| **4** | `GET` | `/gmv_max/report/get/` | `sync.php:112`<br>`creatives_data.php:805` | v1.3 | `advertiser_id`, `store_ids=[$shopId]`, `dimensions=['campaign_id', 'stat_time_day']`, `metrics=['cost', 'gross_revenue', 'roi', 'orders', 'cost_per_order']`, `start_date`, `end_date` | `$res['data']['list']` (`dimensions.campaign_id`, `dimensions.stat_time_day`, `metrics.*`) | `tiktok_campaign_daily_reports` | **PROVEN_IN_CODE** (Authoritative GMV Max) |
| **5** | `GET` | `/gmv_max/video/get/` | `sync.php:253` | v1.3 | `advertiser_id`, `store_id`, `store_authorized_bc_id`, `page=1`, `page_size=50` *(NO date parameters)* | `$res['data']['item_list']` (`video_id`, `video_name`, `video_cover_url`, `campaign_id`, `metrics.*`) | `tiktok_video_ads` | **PROVEN_IN_CODE** (Snapshot only) |
| **6** | `POST` | `/oauth2/access_token/` | `oauth_ads.php:89` | v1.3 | JSON Body: `app_id`, `secret`, `auth_code` | `$res['data']` (`access_token`, `advertiser_ids`) | `tiktok_config` | **PROVEN_IN_CODE** |

### 2.2 Audit of Hypothesized / Speculative Endpoints

| Endpoint Path | Status in Repository | Technical Assessment & Action |
|---|---|---|
| `/report/video_performance/get/` | **NOT FOUND IN CODE** | Speculative endpoint. Never implemented in ADDP repository. Marked as `NEEDS_OFFICIAL_API_DOCUMENTATION`. |
| `/report/task/create/` | **NOT FOUND IN CODE** | Speculative endpoint. Asynchronous report task endpoint exists in TikTok API v1.3 for large exports, but is absent in ADDP code. Marked as `NEEDS_OFFICIAL_API_DOCUMENTATION`. |
| `/gmv_max/product/get/` | **NOT FOUND IN CODE** | Speculative endpoint. Not present in codebase. Marked as `NEEDS_OFFICIAL_API_DOCUMENTATION`. |

---

## 3. CURRENT GMV MAX CAMPAIGN CONTRACT

### 3.1 Request Contract (`/gmv_max/report/get/`)
As implemented in [`public/api/creatives_data.php`](file:///c:/AdsTiktok/public/api/creatives_data.php#L805-L835) and [`public/api/sync.php`](file:///c:/AdsTiktok/public/api/sync.php#L112-L130):

```json
{
  "endpoint": "https://business-api.tiktok.com/open_api/v1.3/gmv_max/report/get/",
  "method": "GET",
  "query_parameters": {
    "advertiser_id": "<CONFIGURED_ADVERTISER_ID>",
    "store_ids": ["<CONFIGURED_SHOP_ID>"],
    "dimensions": ["campaign_id", "stat_time_day"],
    "metrics": [
      "cost",
      "gross_revenue",
      "roi",
      "orders",
      "cost_per_order"
    ],
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "page": 1,
    "page_size": 100
  }
}
```

### 3.2 Response Payload Structure
TikTok Marketing API returns:
```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "list": [
      {
        "dimensions": {
          "campaign_id": "1862822423391234",
          "stat_time_day": "2026-09-05 00:00:00"
        },
        "metrics": {
          "cost": "1045230.00",
          "gross_revenue": "12890000.00",
          "roi": "12.33",
          "orders": "86",
          "cost_per_order": "12153.84"
        }
      }
    ],
    "page_info": {
      "page": 1,
      "page_size": 100,
      "total_page": 1,
      "total_number": 20
    }
  }
}
```

### 3.3 Ingestion & Normalization Trace
The parsing code in [`public/api/creatives_data.php:863-885`](file:///c:/AdsTiktok/public/api/creatives_data.php#L863-L885) executes the following extraction:
1. `cId = row['dimensions']['campaign_id']`
2. `sDate = substr(row['dimensions']['stat_time_day'], 0, 10)`
3. `spend = (float)row['metrics']['cost']`
4. `gmv = (float)row['metrics']['gross_revenue']`
5. `orders = (int)row['metrics']['orders']`
6. `roi = (float)row['metrics']['roi']` (with zero-division guard fallback `spend > 0 ? gmv / spend : 0`)
7. `cpa = (float)row['metrics']['cost_per_order']` (with fallback `orders > 0 ? spend / orders : 0`)
8. Writes to database table `tiktok_campaign_daily_reports` via `INSERT ... ON DUPLICATE KEY UPDATE`.

---

## 4. PRODUCT API CAPABILITY (`Campaign → Product`)

### 4.1 Investigation of Product Breakdown Capability
The Master Spec for Sprint V2-02 envisions a drilldown hierarchy of:
$$\text{Campaign} \longrightarrow \text{Product} \longrightarrow \text{Spend} \longrightarrow \text{Attributed GMV} \longrightarrow \text{Orders} \longrightarrow \text{ROI}$$

### 4.2 API Evidence & Finding
1. **Query Parameters in Code:**
   In `sync.php` (line 115) and `creatives_data.php` (line 808), the query dimension array passed to `/gmv_max/report/get/` is:
   ```php
   'dimensions' => ['campaign_id', 'stat_time_day']
   ```
   There is **no usage of `'product_id'` or `'item_id'`** as a dimension anywhere in the repository.
2. **Dedicated Product Endpoints:**
   No endpoint such as `/gmv_max/product/get/` or `/campaign/gmv_max/product/` exists in the codebase.
3. **TikTok Shop Open API Cross-Check:**
   While the TikTok Shop Open API client ([`public/api/tiktok_client.php`](file:///c:/AdsTiktok/public/api/tiktok_client.php)) has `/product/202309/products/search`, this endpoint only returns **catalog metadata** (title, price, stock, SKU list) and contains **zero advertising spend or ROAS attribution**.
4. **Classification:**
   **`UI_ONLY_UNVERIFIED_API`**. The TikTok Ads web console displays products attached to GMV Max campaigns, but the current ADDP codebase does not have proven API fields or documentation to ingest this data.

---

## 5. VIDEO / CREATIVE API CAPABILITY (`Campaign → Product → Video/Creative`)

### 5.1 Investigation of Creative Performance Ingestion
In [`public/api/sync.php:253-260`](file:///c:/AdsTiktok/public/api/sync.php#L253-L260), the system queries creative video performance using:
```php
$gmvVidRes = requestTikTokAdsAPI('/gmv_max/video/get/', [
    'advertiser_id' => $advertiserId,
    'store_id' => $shopId,
    'store_authorized_bc_id' => $bcId,
    'page' => 1,
    'page_size' => 50
], $adsAccessToken);
```

### 5.2 Returned vs Unreturned Metrics Audit

| Metric Category | Metric Name | Present in API Response (`/gmv_max/video/get/`)? | Proven Field Name | Status / Note |
|---|---|---|---|---|
| **Identity** | Video ID | **YES** | `video_id` | Proven 19-digit TikTok video ID |
| **Identity** | Video Title | **YES** | `video_name` | String title |
| **Identity** | Cover / Thumbnail | **YES** | `video_cover_url` | CDN URL |
| **Identity** | Campaign ID | **YES** | `campaign_id` | Fallback to active campaign if omitted |
| **Identity** | Product ID | **NO** | None | Not associated with product on row |
| **Performance** | Cost / Spend | **YES** | `metrics.cost` | Converted to float `spend` |
| **Performance** | Gross Revenue | **YES** | `metrics.gross_revenue` | Converted to float `gmv` |
| **Performance** | Orders | **YES** | `metrics.orders` | Converted to int `conversions` |
| **Delivery** | Impressions | **YES** | `metrics.impressions` | Converted to int `views` |
| **Delivery** | Clicks | **YES** | `metrics.clicks` | Converted to int `clicks` |
| **Efficiency** | CTR | **YES** | `metrics.ctr` | Converted to float percentage |
| **Efficiency** | CVR | **YES** | `metrics.cvr` | Converted to float percentage |
| **Engagement** | 2s Video Views | **NO** | None | **ABSENT FROM API RESPONSE** |
| **Engagement** | 6s Video Views | **NO** | None | **ABSENT FROM API RESPONSE** |
| **Engagement** | Video Completion Rate | **NO** | None | **ABSENT FROM API RESPONSE** |
| **Engagement** | 6s Retention Rate | **NO** | None | Fabricated in legacy (`52.0%`) |
| **Engagement** | Hook Rate (3s/2s) | **NO** | None | Fabricated in legacy (`65.0%`) |

### 5.3 Critical Date Grain Finding: `LIFETIME_ONLY`
- `/gmv_max/video/get/` in `sync.php` **does not pass `start_date` or `end_date`**.
- The API returns a cumulative point-in-time snapshot.
- **Impact:** It is **architecturally impossible** to filter video ad spend or ROAS for a historical period (such as 2026-09-01 to 2026-09-20) using this endpoint as currently integrated.

---

## 6. INTEGRATED REPORTING CAPABILITY (`/report/integrated/get/`)

### 6.1 Audit of Integrated Basic Reporting
The repository implements `/report/integrated/get/` in both `sync.php` (line 87) and `creatives_data.php` (line 839).

### 6.2 Implementation Details
- `report_type`: `'BASIC'`
- `data_level`: `'AUCTION_CAMPAIGN'`
- `dimensions`: `['campaign_id', 'stat_time_day']`
- `metrics`: `['spend', 'impressions', 'clicks', 'ctr', 'onsite_shopping', 'onsite_shopping_roas']`

### 6.3 Semantic Distinction: Delivery vs Commerce Metrics
1. **Delivery Metrics (`ADS_DELIVERY_METRICS_AVAILABLE`):**
   - For auction campaigns, `/report/integrated/get/` reliably returns verified daily delivery facts: `spend`, `impressions`, `clicks`, `ctr`.
2. **Commerce Metrics (`COMMERCE_ATTRIBUTION_NOT_PROVEN` for GMV Max):**
   - `/report/integrated/get/` returns `onsite_shopping` (order count) and `onsite_shopping_roas` for standard auction shopping ads.
   - However, for **GMV Max campaigns**, TikTok documentation routes gross revenue attribution through `/gmv_max/report/get/` (`cost`, `gross_revenue`, `roi`, `orders`).
   - Standard auction `onsite_shopping_roas * spend` must NOT be assumed identical to GMV Max Gross Revenue.

---

## 7. VIDEO PERFORMANCE CAPABILITY (`/report/video_performance/get/`)

### 7.1 Status in Codebase
- Search query for `video_performance` across all PHP files, SQL scripts, and documentation returned **ZERO results in actual code**.
- **Classification:** **`NOT_FOUND_IN_CODE / NEEDS_OFFICIAL_API_DOCUMENTATION`**.

### 7.2 Feasibility of Joining with GMV Max Creatives
- If TikTok Ads API supports a video performance endpoint in v1.3, can it join with GMV Max creatives?
  - **Verdict:** **`UNSAFE / NO` without official API contract confirmation**.
  - GMV Max creatives in TikTok Ads operate under specialized Business Center / Store authorization. Traditional auction video performance endpoints often fail to return GMV Max creative IDs or return them with disparate entity namespaces.
  - **Rule:** Never attempt to join videos by title or author handle. Only join by stable, validated `video_id`.

---

## 8. LIVE GMV MAX API CAPABILITY

### 8.1 Audit of LIVE Advertising Hierarchy
The desired Master Spec hierarchy for LIVE Advertising is:
$$\text{LIVE Campaign} \longrightarrow \text{LIVE Room / Session} \longrightarrow \text{Featured Products / Videos}$$

### 8.2 API Evidence in Codebase
1. **Campaign Level:**
   - In `/campaign/gmv_max/info/` ([`public/api/sync.php:198-199`](file:///c:/AdsTiktok/public/api/sync.php#L198-L199)), the API returns:
     ```php
     $shoppingAdsType = $gmvInfo['data']['shopping_ads_type'] ?? 'PRODUCT';
     $cType = ($shoppingAdsType === 'LIVE') ? 'LIVE GMV Max' : 'Product GMV Max';
     ```
   - In `/gmv_max/report/get/`, LIVE GMV Max campaigns are reported with daily `cost`, `gross_revenue`, `orders`, `roi`.
   - **Verdict:** Campaign-level LIVE GMV Max is **`PROVEN_IN_CODE`**.
2. **Session / Room Level (`room_id`, `live_id`):**
   - Neither `/campaign/gmv_max/info/` nor `/gmv_max/report/get/` accepts or returns `room_id`, `live_id`, or livestream session timestamps.
   - The TikTok Marketing API reporting endpoints in our codebase **do not expose room-level breakdown**.
   - **Classification:** **`UI_AVAILABLE_API_UNVERIFIED`**.

---

## 9. LIVE SESSION MAPPING CAPABILITY

### 9.1 Linkage between Ads Reporting and `commerce_live_sessions`
- `commerce_live_sessions` (Core V2 Migration 008) records session-level organic metrics: `session_id`, `start_time`, `end_time`, `duration_seconds`, `gmv`, `orders_count`, `impressions`, `total_views`.
- TikTok Ads daily reports (`tiktok_campaign_daily_reports`) record daily totals for campaign `1862632140958017` (LIVE GMV Max).

### 9.2 Critical Prohibition: Same-Date Join is Prohibited
```
[Scenario: 2026-09-03]
LIVE Campaign Daily Spend: 302,869 VND
Actual Livestreams Conducted:
  - Session 1: 10:48 → 13:30 (2h42min) - GMV: 2,200,000 VND
  - Session 2: 17:26 → 19:01 (1h35min) - GMV: 559,100 VND
  - Session 3: 20:03 → 22:01 (1h58min) - GMV: 513,000 VND
```
If the system joins Ads spend to live sessions purely on `stat_date = DATE(start_time)`:
- Assigning 302,869 VND to each session triples total spend to 908,607 VND (mathematically invalid).
- Splitting spend equally (100,956 VND each) is an arbitrary unverified heuristic.

### 9.3 Recommended Classification
- Direct Join Key: **`NONE`** (No shared session key exists between Ads and Shop).
- Algorithmic Classification: **`TIME_WINDOW_ATTRIBUTION_CANDIDATE`**.
  - Can only be considered if TikTok Ads API exposes hourly spend (`stat_time_hour`) that can be correlated with the session's `[start_time, end_time]` interval.

---

## 10. DELIVERY STATUS CAPABILITY

### 10.1 UI States vs API Expose
The TikTok Ads Manager web interface presents creative delivery statuses such as:
`In queue`, `Delivering`, `Not delivering`, `Not LIVE yet`, `Not active`, `Excluded`, `Unavailable`.

### 10.2 API Reality in Repository
- In `/campaign/get/` and `/campaign/gmv_max/info/`, the API returns `operation_status: 'ENABLE' | 'DISABLE'`.
- In `/gmv_max/video/get/`, **no delivery status string is returned or parsed**.
- **Discovery in Legacy Code:**
  In [`public/api/creatives_data.php:720-760`](file:///c:/AdsTiktok/public/api/creatives_data.php#L720-L760), statuses such as `'exploring'`, `'needs_auth'`, `'rejected'`, `'unavailable'`, and `'excluded'` were **completely fabricated via PHP if/else heuristics and CRC32 hashes**:
  ```php
  // Purely synthetic status assignment in legacy:
  $whySpending = "Chưa phát sinh chi phí, đang trong pha khám phá tệp khán giả mới.";
  $whyNotSpending = "Cần mã ủy quyền thương hiệu từ tài khoản đối tác KOC...";
  ```
- **Rule for V2-02:** All synthetic status generation must be **permanently removed**.
- **Authoritative Fallback Rule:**
  - `HAS_DELIVERY`: Measured `spend > 0 || impressions > 0`
  - `NO_DELIVERY`: Measured `spend == 0 && impressions == 0`
  - `UNKNOWN`: Unmeasured or unsynced period.

---

## 11. METRIC SEMANTICS CONTRACT

To prevent financial misreporting, the following semantic boundaries are strictly established:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   METRIC SEMANTIC DISAMBIGUATION                       │
└────────────────────────────────────────────────────────────────────────┘

1. SHOP GROSS (Doanh Thu Từ Đơn Hàng / Order-Derived Gross)
   - Source: `commerce_orders` / `commerce_order_items`
   - Nature: Authoritative checkout cash value of completed orders.
   - Rule: Ground truth for store revenue.

2. GMV MAX GROSS REVENUE (Doanh Thu Ghi Nhận Quảng Cáo)
   - Source: TikTok Ads API `/gmv_max/report/get/` (`gross_revenue`)
   - Nature: Platform-modeled attribution (7-day click, 1-day view).
   - Rule: Overlaps with organic checkouts. MUST NOT be added to Shop Gross.

3. PAID-ONLY ATTRIBUTED GMV (Doanh Thu Thuần Quảng Cáo)
   - Nature: Incremental sales that would not have occurred without ads.
   - Status: NOT EXPOSED by TikTok API. (TikTok GMV Max intentionally
     optimizes across organic showcase and ad traffic blended together).
   - Rule: NEVER invent or mathematically deduct a "paid-only" figure.

4. LIVE GMV MAX ROI (Tỷ Suất Hoàn Vốn Quảng Cáo LIVE)
   - Formula: `GMV Max Gross Revenue / GMV Max Ad Spend`
   - Rule: Must be labeled as "ROI Quảng Cáo LIVE (Theo TikTok Ads)",
     never as "Lợi Nhuận Phiên Live".
```

---

## 12. API FIELD LINEAGE TABLE

The following table traces the exact data flow from the TikTok Marketing API response down to the UI presentation:

| Upstream API Endpoint | API Response Field | Parser & Transformation | DB Destination | Normalized Column | V2 Service Aggregator | UI Label & Component |
|---|---|---|---|---|---|---|
| `/gmv_max/report/get/` | `dimensions.campaign_id` | String cast | `tiktok_campaign_daily_reports` | `campaign_id` | `CommerceAdsService::getAdvertisingCostOverview()` | Campaign ID / Filter |
| `/gmv_max/report/get/` | `dimensions.stat_time_day` | `substr($val, 0, 10)` | `tiktok_campaign_daily_reports` | `stat_date` | `provenance.date_field` | Ngày báo cáo (`stat_date`) |
| `/gmv_max/report/get/` | `metrics.cost` | `(float)$val` | `tiktok_campaign_daily_reports` | `spend` | `SUM(spend)` | "Tổng Chi Phí QC" (`total_spend`) |
| `/gmv_max/report/get/` | `metrics.gross_revenue` | `(float)$val` | `tiktok_campaign_daily_reports` | `gmv` | `SUM(gmv)` | "Doanh Thu Ghi Nhận (GMV)" (`attributed_gmv`) |
| `/gmv_max/report/get/` | `metrics.orders` | `(int)$val` | `tiktok_campaign_daily_reports` | `orders` | `SUM(orders)` | "Đơn Hàng Ghi Nhận" (`attributed_orders`) |
| `/gmv_max/report/get/` | `metrics.roi` | `(float)$val` (fallback `gmv/spend`) | `tiktok_campaign_daily_reports` | `roi` | `total_gmv / total_spend` | "Hiệu Quả (ROI)" (`roi`) |
| `/gmv_max/report/get/` | `metrics.cost_per_order` | `(float)$val` (fallback `spend/orders`) | `tiktok_campaign_daily_reports` | `cpa` | `total_spend / total_orders` | "Chi Phí / Đơn" (`cpa`) |
| `/campaign/gmv_max/info/` | `data.campaign_name` | String trim | `tiktok_campaigns` | `name` | `$brow['name']` | Tên Chiến Dịch |
| `/campaign/gmv_max/info/` | `data.shopping_ads_type` | `'LIVE' ? 'LIVE GMV Max' : 'Product GMV Max'` | `tiktok_campaigns` | `type` | Macro breakdown partition | "Product GMV Max" vs "LIVE GMV Max" |
| `/campaign/gmv_max/info/` | `data.budget` | `(float)$val` | `tiktok_campaigns` | `budget` | Budget pacing calculation | Ngân Sách Ngày (`daily_budget`) |
| `/campaign/gmv_max/info/` | `data.operation_status` | `ENABLE ? 1 : 0` | `tiktok_campaigns` | `status` | Boolean status | Trạng thái hoạt động |
| `/gmv_max/video/get/` | `data.item_list[].video_id` | String cast | `tiktok_video_ads` | `id` | Snapshot video list | Video ID |
| `/gmv_max/video/get/` | `data.item_list[].metrics.cost` | `(float)$val` | `tiktok_video_ads` | `spend` | Snapshot video card | Chi phí video (Lũy kế snapshot) |

---

## 13. DATA GRAIN MATRIX

| Entity Level | Primary Natural Identifier | Date Grain Capability | Spend | Gross Revenue | Orders | Impressions | Clicks | Views | Delivery Status | Authoritative Source | Confidence Level |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Ads Total** | `platform + shop_id` | **DAILY** | **AVAILABLE** | **AVAILABLE** | **AVAILABLE** | Unavailable | Unavailable | Unavailable | AVAILABLE | `tiktok_campaign_daily_reports` | **HIGH** |
| **Campaign** | `campaign_id` | **DAILY** | **AVAILABLE** | **AVAILABLE** | **AVAILABLE** | Unavailable | Unavailable | Unavailable | AVAILABLE | `tiktok_campaign_daily_reports` | **HIGH** |
| **Product** | `product_id + campaign_id` | **NONE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | None in repo | **NONE** |
| **Video Creative** | `video_id + campaign_id` | **LIFETIME SNAPSHOT** | **AVAILABLE** (Snapshot) | **AVAILABLE** (Snapshot) | **AVAILABLE** (Snapshot) | **AVAILABLE** (Snapshot) | **AVAILABLE** (Snapshot) | **AVAILABLE** (Snapshot) | Factual only (`HAS_DELIVERY`) | `/gmv_max/video/get/` | **MEDIUM** (No historical date grain) |
| **LIVE Campaign** | `campaign_id` (`shopping_ads_type='LIVE'`) | **DAILY** | **AVAILABLE** | **AVAILABLE** | **AVAILABLE** | Unavailable | Unavailable | Unavailable | AVAILABLE | `tiktok_campaign_daily_reports` | **HIGH** |
| **LIVE Session / Room** | `session_id` | **SESSION EVENT** | **NOT AVAILABLE** (Only legacy scalar) | **NOT AVAILABLE** | **NOT AVAILABLE** | Available (Organic) | Available (Organic) | Available (Organic) | Available | `commerce_live_sessions` (Organic only) | **LOW** (Ads link unproven) |
| **LIVE Video** | `video_id + session_id` | **NONE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | **NOT AVAILABLE** | None in repo | **NONE** |

---

## 14. PROPOSED API → V2 DATA MODEL MAPPING (BLUEPRINT ONLY)

> [!IMPORTANT]
> The following table structures represent an **architectural mapping blueprint**. In compliance with Phase 0.6 instructions, **ZERO migrations or DDL statements have been executed**.

### 14.1 `commerce_ads_campaign_daily` (Ready to Build)
- **API Source:** `/gmv_max/report/get/` and `/report/integrated/get/`
- **Grain:** 1 row per shop, per campaign, per calendar date.
- **Natural Key:** `(platform, shop_id, campaign_id, stat_date)`
- **Dimensions:**
  - `platform` (`VARCHAR(64)` NOT NULL DEFAULT `'tiktok_ads'`)
  - `shop_id` (`VARCHAR(64)` NOT NULL)
  - `advertiser_id` (`VARCHAR(64)` NOT NULL)
  - `campaign_id` (`VARCHAR(128)` NOT NULL)
  - `stat_date` (`DATE` NOT NULL)
  - `campaign_name` (`VARCHAR(255)` NULL)
  - `campaign_type` (`VARCHAR(64)` NOT NULL DEFAULT `'Product GMV Max'`)
- **Metrics (Proven Fields):**
  - `spend` (`DECIMAL(15,2)` NOT NULL DEFAULT '0.00')
  - `gross_revenue` (`DECIMAL(15,2)` NOT NULL DEFAULT '0.00')
  - `orders_count` (`INT UNSIGNED` NOT NULL DEFAULT 0)
  - `roi` (`DECIMAL(7,4)` NOT NULL DEFAULT '0.0000')
  - `cpa` (`DECIMAL(15,2)` NOT NULL DEFAULT '0.00')
- **Nullable / Optional Metrics (Unverified in GMV Max):**
  - `impressions` (`INT UNSIGNED` NULL DEFAULT NULL)
  - `clicks` (`INT UNSIGNED` NULL DEFAULT NULL)
  - `budget` (`DECIMAL(15,2)` NULL DEFAULT NULL)
  - `target_roas` (`DECIMAL(7,4)` NULL DEFAULT NULL)

### 14.2 `commerce_ads_video_daily` (Blocked on API Date Parameter Verification)
- **API Source:** `/gmv_max/video/get/` (or `/report/integrated/get/` at creative level)
- **Grain:** 1 row per shop, per campaign, per video, per date.
- **Natural Key:** `(platform, shop_id, campaign_id, video_id, stat_date)`
- **Dimensions:** `video_id`, `campaign_id`, `stat_date`, `video_name`, `thumbnail_url`
- **Metrics (Proven in Snapshot; Unverified in Daily):**
  - `spend` (`DECIMAL(15,2)` NOT NULL DEFAULT '0.00')
  - `gross_revenue` (`DECIMAL(15,2)` NOT NULL DEFAULT '0.00')
  - `orders_count` (`INT UNSIGNED` NOT NULL DEFAULT 0)
  - `impressions` (`INT UNSIGNED` NOT NULL DEFAULT 0)
  - `clicks` (`INT UNSIGNED` NOT NULL DEFAULT 0)
  - `ctr` (`DECIMAL(7,4)` NULL DEFAULT NULL)
  - `cvr` (`DECIMAL(7,4)` NULL DEFAULT NULL)
- **Status Field:** `delivery_status` (`VARCHAR(32)` DEFAULT `'UNKNOWN'`)
- **Strict Prohibition:** DO NOT include columns for `hook_rate` or `retention_6s` until official API fields are confirmed.

### 14.3 `commerce_ads_live_daily` (Blocked on Live Session Attribution Verification)
- **API Source:** TikTok Ads LIVE Reporting + `commerce_live_sessions`
- **Grain:** 1 row per shop, per session, per campaign.
- **Natural Key:** `(platform, shop_id, session_id, campaign_id)`
- **Dimensions:** `session_id`, `campaign_id`, `session_start_time`, `session_end_time`
- **Metrics:** `attributed_spend` (NULLABLE), `attributed_gmv` (NULLABLE), `attributed_orders` (NULLABLE)
- **Attribution Metadata:** `attribution_method` (`VARCHAR(64)` NOT NULL DEFAULT `'UNVERIFIED'`)

---

## 15. GREEN / YELLOW / RED BUILDABILITY MATRIX

```
====================================================================================================
FEATURE / SUB-FEATURE                 | STATUS | VERDICT EXPLANATION & ACTION
====================================================================================================
1. Campaign GMV Max Daily View        | GREEN  | FULLY PROVEN IN CODE. Ingest from /gmv_max/report/get/
                                      |        | into commerce_ads_campaign_daily.
--------------------------------------+--------+------------------------------------------------------------
2. Campaign Budget Pacing & Target ROI| GREEN  | FULLY PROVEN IN CODE. Uses budget and target_roas
                                      |        | from /campaign/gmv_max/info/.
--------------------------------------+--------+------------------------------------------------------------
3. Product GMV Max Breakdown          | YELLOW | BLOCKED ON DOCS. Need confirmation if dimension
                                      |        | product_id or endpoint /gmv_max/product/ exists.
--------------------------------------+--------+------------------------------------------------------------
4. Creative Video Performance (Daily) | YELLOW | BLOCKED ON DOCS. Need verification if /gmv_max/video/
                                      |        | supports start_date/end_date.
--------------------------------------+--------+------------------------------------------------------------
5. Creative Delivery Factual Status   | GREEN  | CAN BUILD. Implement strict factual rule:
                                      |        | HAS_DELIVERY (spend > 0 || imps > 0) vs NO_DELIVERY.
--------------------------------------+--------+------------------------------------------------------------
6. LIVE GMV Max Campaign Totals       | GREEN  | FULLY PROVEN IN CODE. Filtered via
                                      |        | shopping_ads_type = 'LIVE'.
--------------------------------------+--------+------------------------------------------------------------
7. LIVE Session-Level Ads Attribution | RED    | CANNOT BUILD RELIABLY. No room_id or session_id in Ads
                                      |        | API. Joining by date produces severe errors.
--------------------------------------+--------+------------------------------------------------------------
8. Video Retention / Hook Rate Curves | RED    | CANNOT BUILD. Zero telemetry in current Ads API client;
                                      |        | was 100% fabricated in legacy.
====================================================================================================
```

---

## 16. EXACT DOCUMENTATION REQUIRED FROM PRODUCT OWNER

To unblock the **YELLOW** and **RED** features without guessing or inventing APIs, the Product Owner or Technical Lead should provide official TikTok Business API documentation for the following 4 specific inquiries:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ INQUIRY 1: GMV MAX PRODUCT-LEVEL REPORTING                                               │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Document Needed: TikTok Marketing API v1.3 — GMV Max Reporting Specification            │
│ Section/Endpoint: GET /open_api/v1.3/gmv_max/report/get/ or dedicated Product endpoint    │
│ Specific Verification Required:                                                          │
│   - Does `dimensions` accept `"product_id"` or `"item_id"`?                             │
│   - If yes, what metrics are valid with this dimension (`cost`, `gross_revenue`, etc.)?   │
│   - Is there a separate endpoint (e.g. `/gmv_max/product/get/`) to list products?        │
│ Why Needed: Required to build the Campaign → Product breakdown table.                    │
│ Blocks Feature: Product GMV Max Intelligence.                                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ INQUIRY 2: GMV MAX CREATIVE HISTORICAL DATE-RANGE CAPABILITY                             │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Document Needed: TikTok Marketing API v1.3 — GMV Max Video Management & Reporting       │
│ Section/Endpoint: GET /open_api/v1.3/gmv_max/video/get/ or Integrated Creative Report   │
│ Specific Verification Required:                                                          │
│   - Does `/gmv_max/video/get/` accept `start_date` and `end_date` parameters?            │
│   - Can `/report/integrated/get/` be queried with `data_level: 'AUCTION_AD'` for        │
│     GMV Max campaigns, and does it support `stat_time_day`?                              │
│ Why Needed: Required to prevent overwriting video snapshots with date range slices.     │
│ Blocks Feature: Historical Video Ads Intelligence.                                       │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ INQUIRY 3: LIVE SHOPPING ADS HOURLY / SESSION TELEMETRY                                  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Document Needed: TikTok Marketing API v1.3 — LIVE Shopping Ads Attribution Spec          │
│ Section/Endpoint: LIVE Ads Reporting / Breakdown Dimensions                              │
│ Specific Verification Required:                                                          │
│   - Is there a dimension for `room_id`, `live_id`, or `session_id` in LIVE Ads reports?  │
│   - Can spend and GMV be queried by hour (`stat_time_hour`)?                             │
│ Why Needed: Required to attribute ads spend to a 2-hour live session without guessing.   │
│ Blocks Feature: LIVE Session Ads ROI & Attribution.                                      │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ INQUIRY 4: CREATIVE VIDEO ENGAGEMENT & HOOK RATE TELEMETRY                               │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Document Needed: TikTok Marketing API v1.3 — Video Engagement Metrics Reference          │
│ Section/Endpoint: Video Metrics (`video_play_actions`, `video_watched_2s`, `retention`)   │
│ Specific Verification Required:                                                          │
│   - Are 2-second views, 6-second views, or average play time available for GMV Max?      │
│   - What is the official formula for Creative Hook Rate defined by TikTok?               │
│ Why Needed: To replace legacy synthetic hook rate formulas with authentic API telemetry. │
│ Blocks Feature: Creative Hook Rate & Script Fatigue Intelligence.                         │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. RECOMMENDED V2-02 BUILD SCOPE

Based on verified code capabilities and absolute safety constraints, the recommended implementation scope for Sprint V2-02 is partitioned into two clear stages:

### Stage 1: Build Immediately (GREEN Scope — 100% Proven)
1. **Migration for `commerce_ads_campaign_daily`:**
   - Formalize table schema with `(platform, shop_id, campaign_id, stat_date)`.
2. **Automated Scheduled Sync Worker:**
   - Integrate daily campaign ingestion into `commerce_sync_service.php` (cron cadence every 3 hours for hot data, daily for matured).
3. **Campaign-Level GMV Max Intelligence UI:**
   - Render Campaign Performance Table (`Spend`, `Gross Revenue`, `Orders`, `ROI`, `CPA`, `Daily Budget`, `Pacing %`).
   - Macro Split: Product GMV Max vs LIVE GMV Max.
   - Pacing & Target ROI Analysis: `Actual ROI` vs `Target ROAS` variance.
4. **Factual Creative Delivery Classification:**
   - Classify creative delivery as `HAS_DELIVERY` vs `NO_DELIVERY` based strictly on measured spend/impressions.
5. **Zero-Fabrication Contract Enforcement:**
   - Return `null` for unmeasured engagement metrics (`impressions`, `clicks`) instead of dividing spend by 10 or 80.

### Stage 2: Defer Pending API Documentation (YELLOW & RED Scope)
1. **Product GMV Max Drilldown Table:** Defer until Product Owner confirms Inquiry 1.
2. **Historical Video Date-Range Filtering:** Defer until Product Owner confirms Inquiry 2.
3. **Livestream Session-Level Ads ROI:** Defer until Product Owner confirms Inquiry 3.

---

## FINAL ANSWERS REQUIRED (A THROUGH L)

### A. Which Campaign metrics are API-proven?
> **PROVEN:** `campaign_id`, `campaign_name`, `campaign_type`, `stat_date`, `spend` (from `cost`), `gross_revenue`, `orders`, `roi`, `cost_per_order` (`cpa`), `budget`, and `operation_status`.  
> *UNPROVEN in daily GMV Max reports:* `clicks` and `impressions` (must return `null` when absent).

### B. Is Campaign → Product API-proven?
> **NO.** Dimension `product_id` is absent from all Marketing API calls in the repository. No endpoint mapping campaigns to products has been proven.

### C. Is Product → Video API-proven?
> **NO.** `/gmv_max/video/get/` links videos to `campaign_id`, not to individual products.

### D. Can video metrics be queried by date?
> **NO.** `/gmv_max/video/get/` does not pass `start_date` or `end_date` and returns an unpartitioned lifetime snapshot.

### E. Can video Spend/GMV/Orders be trusted?
> **ONLY AS A POINT-IN-TIME SNAPSHOT.** They cannot be trusted for custom date ranges because the database has no daily video grain and legacy code overwrites records with filtered slices.

### F. Can official creative delivery status be obtained?
> **NO.** The API does not return a delivery status string for creatives. Only factual status (`HAS_DELIVERY` vs `NO_DELIVERY`) derived from `spend > 0 || impressions > 0` can be reported.

### G. Is LIVE Campaign → LIVE Room API-proven?
> **NO.** The Ads API reporting does not return `room_id` or `session_id`.

### H. Is LIVE Room → Video API-proven?
> **NO.** No API contract links individual videos to specific live rooms.

### I. Can Ads Cost be assigned to individual LIVE sessions?
> **NO.** Joining Ads spend to sessions by calendar date is statistically invalid and causes duplicate spend counting.

### J. Can LIVE GMV Max ROI be calculated per session?
> **NO.** Without verified session-level ad spend and session-level ad-attributed GMV, any per-session ROI calculation is an ungrounded guess.

### K. Which exact official documentation is still required?
> 1. GMV Max Product-level reporting dimension/endpoint spec.
> 2. GMV Max Creative historical date-range parameters spec.
> 3. LIVE Shopping Ads hourly / session-level attribution spec.
> 4. Creative video engagement / hook rate metrics reference.

### L. What is safe to implement immediately?
> **Campaign-level GMV Max Intelligence:** Daily fact migration (`commerce_ads_campaign_daily`), automated cron ingestion pipeline, macro Product vs LIVE GMV Max split, budget pacing, and Target ROI comparison.

---

```
READ-ONLY API CAPABILITY PROBE COMPLETED
NO PRODUCTION WRITE
NO DATABASE WRITE
NO CAMPAIGN MODIFICATION
NO FEATURE IMPLEMENTATION
```
