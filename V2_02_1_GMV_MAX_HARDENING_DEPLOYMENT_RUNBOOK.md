# ADDP COMMERCE INTELLIGENCE — SPRINT V2-02.1 DEPLOYMENT RUNBOOK
## GMV MAX PRODUCTION HARDENING & PERIOD COVERAGE

**Environment:** Production (`marketing.addp.vn`)  
**Target Webroot:** `/home/addp/domains/marketing.addp.vn/public_html`  
**Execution Authority:** Product Owner / Lead DevOps  
**Safety Classification:** NON-DESTRUCTIVE ADDITIVE / FORWARD-FIRST  
**Release Package:** `task_v2_02_1_gmv_max_production_hardening_release_<timestamp>.zip`

---

### 1. Executive Summary & Problem Resolution

Hotfix release **V2-02.1** resolves critical production runtime anomalies discovered during live operational verification of Sprint V2-02:
1. **Frontend Crash Resolution (`TypeError: Cannot read properties of undefined (reading 'legacy_cost')`):**
   - Implemented null-safety across `CommerceDashboardView.jsx` preventing crashes when `official_vs_legacy` or subsidiary intelligence objects are undefined.
   - Replaced all fragile `obj?.field !== null ? format(obj.field) : '—'` ternary patterns with safe `obj?.field == null ? '—' : format(obj?.field)`.
2. **Numeric Precision Widening (Migration 013):**
   - Altered ROI columns across Campaign, Product, Creative, and LIVE daily tables from `DECIMAL(7,4)` to `DECIMAL(15,4)` to safely accept ROI figures exceeding 999.9999 without MySQL overflow exceptions.
3. **Official TikTok API as Default Source:**
   - Guaranteed official GMV Max API (`GET /open_api/v1.3/gmv_max/report/get/`) is strictly prioritized for all V2 advertising domains (`ads_campaigns`, `ads_products`, `ads_creatives`, `ads_lives`, `ads_all`).
   - Legacy daily reports are never silently substituted for official data; failures report `ERROR`/`UNAVAILABLE` explicitly.
4. **Authoritative PRODUCT vs LIVE Campaign Classification:**
   - Replaced fragile campaign name heuristic (`LIKE '%LIVE%'`) with official semantic streams (`gmv_max_promotion_types = ['PRODUCT']` vs `['LIVE']`).
   - Restores runtime reference balance: 62 Product campaigns + 280 LIVE campaigns = 342 Total campaigns.
5. **Service-Level API Batching:**
   - Implemented automatic chunking (`campaign_ids <= 100`, `item_group_ids <= 100`) inside API client/service layer with isolated batch failure handling.
6. **Period Coverage Metadata & UX Consistency:**
   - Computed coverage metadata (`requested_days`, `available_days`, `missing_days`, `coverage_pct`, `availability_status`).
   - For partial period (1/20 days = 5%), UI displays recorded spend (`936.171 đ`) badged with `PARTIAL (1/20 ngày - 5%)` and `[Dữ liệu chưa đủ kỳ]`, eliminating confusion with complete period totals.
7. **Strict Target ROAS Semantics:**
   - Removed invented 6.00 Target ROAS fallback. If not explicitly configured, shows factual `CHƯA CẤU HÌNH TARGET ROAS`.

---

### 2. Pre-Deployment Preflight Checklist

Run preflight checks on production server before unpacking:

```bash
# 1. Verify PHP CLI version (>= 8.1 required)
php -v

# 2. Check current working directory
pwd
# Expected: /home/addp/domains/marketing.addp.vn/public_html

# 3. Verify database connectivity & configuration
php -r "require_once 'api/config.php'; echo 'Config OK. DB=' . DB_NAME . PHP_EOL;"
```

---

### 3. Step-by-Step Deployment Instructions

#### Step 1: Upload Release Archive
Upload `task_v2_02_1_gmv_max_production_hardening_release_<timestamp>.zip` to `/home/addp/domains/marketing.addp.vn/`.

#### Step 2: Backup Existing Target Files
```bash
cd /home/addp/domains/marketing.addp.vn/public_html
mkdir -p /home/addp/backups/v2_02_pre_hardening
cp -p api/tiktok_gmv_max_api_client.php /home/addp/backups/v2_02_pre_hardening/
cp -p api/commerce_ads_ingestion_service.php /home/addp/backups/v2_02_pre_hardening/
cp -p api/commerce_ads_service.php /home/addp/backups/v2_02_pre_hardening/
cp -p api/commerce_dashboard.php /home/addp/backups/v2_02_pre_hardening/
cp -r index.html assets/ /home/addp/backups/v2_02_pre_hardening/
```

#### Step 3: Unpack Release Package
```bash
cd /home/addp/domains/marketing.addp.vn/public_html
unzip -o /home/addp/domains/marketing.addp.vn/task_v2_02_1_gmv_max_production_hardening_release_<timestamp>.zip
```

#### Step 4: Execute Database Migration 013
Apply `database/migrations/20261004_013_widen_commerce_ads_roi_columns.sql`:

```bash
# Using MySQL CLI
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < ../database/migrations/20261004_013_widen_commerce_ads_roi_columns.sql
```

Verify altered column specifications:
```sql
SHOW COLUMNS FROM commerce_ads_campaign_daily LIKE '%roi%';
SHOW COLUMNS FROM commerce_ads_product_daily LIKE '%roi%';
SHOW COLUMNS FROM commerce_ads_creative_daily LIKE '%roi%';
SHOW COLUMNS FROM commerce_ads_live_daily LIKE '%roi%';
-- All columns must report Type: decimal(15,4), Null: YES
```

#### Step 5: Verify PHP Syntax
```bash
php -l api/tiktok_gmv_max_api_client.php
php -l api/commerce_ads_ingestion_service.php
php -l api/commerce_ads_service.php
php -l api/commerce_dashboard.php
php -l ../tools/backfill_gmv_max_official_cli.php
```

#### Step 6: Verify Frontend Asset Permissions & Cache Busting
Ensure file permissions for webserver:
```bash
chmod 644 index.html
chmod -R 755 assets/
```
In browser, perform a hard refresh (`Ctrl + Shift + R`) to load the updated bundled JavaScript chunk.

---

### 4. Post-Deployment Verification Gate

1. **Verify No Null-Pointer Crashes in Dashboard:**
   - Navigate to `https://marketing.addp.vn`.
   - Open browser Developer Tools (`F12` -> Console).
   - Click tab **"Quảng Cáo (GMV Max)"**.
   - Navigate through sub-pills: **Tổng Quan & Đối Soát**, **Chiến Dịch**, **Sản Phẩm (SPU)**, **Video / Creative**, **Cơ Hội Tối Ưu**.
   - Confirm ZERO `TypeError: Cannot read properties of undefined` exceptions in console.

2. **Verify Period Coverage Indicator:**
   - Select period `2026-09-01 → 2026-09-20`.
   - Card 3 should display `936.171 đ` with explicit badge `PARTIAL (1/20 ngày - 5%)`.
   - Badge `[Dữ liệu chưa đủ kỳ]` should be rendered.
   - Total cost is NOT extrapolated.

3. **Verify Reconciliation Invariants:**
   - Ensure Level A, Level B, Level C rows are displayed cleanly.
   - If `official_vs_legacy` is uncalculated or empty, table cells display `—` without crashing.

---

### 5. Rollback Procedures & Safety Disclosures

> [!WARNING]
> **DATABASE ROLLBACK DATA LOSS WARNING:**  
> The rollback script `20261004_013_rollback_widen_commerce_ads_roi_columns.sql` converts ROI columns back to `DECIMAL(7,4)`.  
> If any rows in production have recorded ROI values exceeding `999.9999` (e.g., 1250.5000), running this rollback will cause MySQL numeric overflow (`Out of range value for column`) or permanent data truncation.  
> **DO NOT run rollback script automatically.** Always prefer forward-first hotfixes.

If emergency code rollback is required:
```bash
# Restore previous PHP and frontend files from backup:
cp -rp /home/addp/backups/v2_02_pre_hardening/* /home/addp/domains/marketing.addp.vn/public_html/
```
Keep Migration 013 in place, as `DECIMAL(15,4)` is strictly backward-compatible with all valid `DECIMAL(7,4)` numbers.
