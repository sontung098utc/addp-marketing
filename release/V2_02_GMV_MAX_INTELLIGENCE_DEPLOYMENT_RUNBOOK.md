# ADDP COMMERCE INTELLIGENCE — SPRINT V2-02 DEPLOYMENT RUNBOOK

## Target Environment
- Application: ADDP Commerce Intelligence
- Production Domain: `marketing.addp.vn`
- Release Package: `task_v2_02_gmv_max_intelligence_release_20261004_175000.zip`
- SHA-256 Checksum: `7f02a43a3f4b045b8f6dd4929a435d8e746454db77b8c19ad0c1806353cc0180`

---

## 1. COMPREHENSIVE PRE-DEPLOYMENT BACKUP STRATEGY (MANDATORY)

Before deploying the archive or running any migrations, execute full backups:

### A. Database Schema & Tables Backup
Backup current database schema and existing relevant Ads & Core V2 tables (do NOT hardcode credentials, use environment variables):
```bash
# 1. Backup full schema definition
mysqldump -u "$DB_USER" -p "$DB_NAME" --no-data > backup_schema_before_v2_02_$(date +%Y%m%d_%H%M%S).sql

# 2. Backup existing Ads and Core V2 tables data
mysqldump -u "$DB_USER" -p "$DB_NAME" \
  commerce_ads_campaign_daily \
  tiktok_campaign_daily_reports \
  commerce_order_items \
  tiktok_config > backup_relevant_tables_$(date +%Y%m%d_%H%M%S).sql
```

### B. Application Files Backup
Backup existing application files before overwriting:
```bash
tar -czf backup_app_files_before_v2_02_$(date +%Y%m%d_%H%M%S).tar.gz \
  public/api/tiktok_gmv_max_api_client.php \
  public/api/commerce_ads_ingestion_service.php \
  public/api/commerce_ads_service.php \
  public/api/commerce_dashboard.php \
  src/CommerceDashboardView.jsx \
  dist/
```

---

## 2. STEP-BY-STEP DEPLOYMENT PROCEDURE

### Step 1: Deploy Archive
```bash
cd /path/to/marketing.addp.vn
unzip -o task_v2_02_gmv_max_intelligence_release_20261004_175000.zip
```

### Step 2: Apply Database Migration 012 (Forward-First)
```bash
mysql -u "$DB_USER" -p "$DB_NAME" < database/migrations/20261004_012_create_commerce_ads_intelligence_tables.sql
```

### Step 3: Run Automated Verification Matrix
```bash
node tools/test_v2_02_gmv_max_intelligence.cjs
node tools/test_v2_02a_2_official_api_ingestion.cjs
node tools/test_v2_02a_campaign_gmv_max.cjs
node tools/test_v2_01_2_acceptance.cjs
```
Expected result: **All test suites pass 100% (0 errors)**.

### Step 4: Browser Verification
1. Access `https://marketing.addp.vn`
2. Navigate to **Quảng Cáo (GMV Max)**:
   - Check **Overview**: Multi-Grain Hierarchy Table (Levels A, B, C, D) reconciles accurately with 1,000 VND / 0.1% rounding tolerance.
   - Check **Product SPU**: Verified mappings (`RUNTIME_VERIFIED_MAPPING`) joined with `commerce_order_items.product_id`.
   - Check **Video Creatives**: Target ROAS comparisons, factual opportunity patterns (Cost > 0 & Orders = 0, Cost > 0 & Revenue = 0, Zero-Cost Attribution without causal claims, `item_id = -1` unattributed bucket).
   - Check **LIVE Ads**: Rooms listed with clear `SESSION_MAPPING_PENDING` disclosure.

---

## 3. ROLLBACK SAFETY POLICY & PROCEDURES

> [!CAUTION]
> **CRITICAL WARNING ON DATA LOSS:**
> Migration 012 rollback executes:
> - `DROP TABLE IF EXISTS commerce_ads_product_daily;`
> - `DROP TABLE IF EXISTS commerce_ads_creative_daily;`
> - `DROP TABLE IF EXISTS commerce_ads_live_daily;`
> **DO NOT treat DROP TABLE rollback as safe once production data has been synced.**
> Dropping these tables will **PERMANENTLY DELETE** all ingested daily product, creative, and live advertising intelligence records (dữ liệu đã sync trong các bảng này sẽ bị xóa)!

### Golden Rule: Migration Forward-First
1. **Application Rollback does NOT default to Schema Rollback:**
   If an application or UI bug occurs, rollback application files only:
   ```bash
   tar -xzf backup_app_files_before_v2_02_*.tar.gz
   ```
   Do NOT drop the database tables. Existing tables and legacy endpoints continue functioning normally.

2. **Schema Rollback Requires Explicit Approval:**
   Only execute `20261004_012_rollback_commerce_ads_intelligence_tables.sql` if explicitly approved by the Product Owner / Tech Lead.
   Before dropping, capture an emergency dump:
   ```bash
   # Emergency Dump before any DROP
   mysqldump -u "$DB_USER" -p "$DB_NAME" \
     commerce_ads_product_daily \
     commerce_ads_creative_daily \
     commerce_ads_live_daily > emergency_dump_intelligence_tables_$(date +%Y%m%d_%H%M%S).sql

   # Execute Rollback (ONLY if explicitly approved)
   mysql -u "$DB_USER" -p "$DB_NAME" < database/migrations/20261004_012_rollback_commerce_ads_intelligence_tables.sql
   ```
