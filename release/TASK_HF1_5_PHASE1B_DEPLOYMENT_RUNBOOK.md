# ADDP COMMERCE INTELLIGENCE
## PRODUCTION DEPLOYMENT RUNBOOK — TASK HF1.5 PHASE 1B (ANALYTICS & DASHBOARD ENGINE)

====================================================================
SCOPE:                 Shop Daily Analytics, Livestream, Video Performance, Dashboard Engine & UI
TARGET ENVIRONMENT:    Production (https://marketing.addp.vn)
ESTIMATED DOWNTIME:    Zero-downtime (Additive database migration + non-breaking code deployment)
FEATURE FLAG STATUS:   All HF1.3, HF1.4, HF1.5 Feature Flags = false (Default Dark-Launch)
====================================================================

---

### PRE-DEPLOYMENT VERIFICATION

1. Verify release package integrity:
   - Application Package: `release/task_hf1_5_phase1b_release_20261001_113544.zip`
   - SHA-256 Checksum: `a73721a23607072aec4086b382f7eefc5e205a4d884c983a6c850f767603a794`
   - File Size: `311,130` bytes
2. Automated Test Suite Verification:
   - `node tools/test_hf1_5_commerce_dashboard_api.cjs` -> 18/18 PASS (100%)
   - `node tools/test_hf1_5_analytics_dashboard_engine.cjs` -> 20/20 PASS (100%)
   - `node tools/test_hf1_4_finance_settlement_engine.cjs` -> 20/20 PASS (100%)
   - `node tools/test_hf1_3_return_refund_loss_engine.cjs` -> 40/40 PASS (100%)
   - `node tools/test_hf1_2_core_orders.cjs` -> 30/30 PASS (100%)
   - `node tools/test_task02b_security.cjs` -> 38/38 PASS (100%)
   - `node tools/secret_scan.cjs` -> 0 secrets detected (PASS)
   - `node tools/verify_php_syntax.cjs` -> 22/22 files syntax PASS (100%)
   - `npm run build` -> Vite build clean in 925ms (PASS)
   - **Total Tests:** 166 / 166 PASS (100%)
3. Database Migration Scripts:
   - Forward Migration 005: `database/migrations/20261001_005_create_commerce_aftersales_and_events.sql`
   - Rollback Script 005: `database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql`
   - Forward Migration 006: `database/migrations/20261001_006_upgrade_commerce_sync_runs.sql`
   - Rollback Script 006: `database/migrations/20261001_006_rollback_commerce_sync_runs.sql`
   - Forward Migration 007: `database/migrations/20261001_007_create_commerce_finance_tables.sql`
   - Rollback Script 007: `database/migrations/20261001_007_rollback_commerce_finance_tables.sql`
   - Forward Migration 008: `database/migrations/20261001_008_create_commerce_analytics_tables.sql`
   - Rollback Script 008: `database/migrations/20261001_008_rollback_commerce_analytics_tables.sql`

---

### STEP 1: PRE-DEPLOYMENT BACKUP ON SERVER

Before applying schema or file changes on production:
```bash
cd /home/u229648939/domains/marketing.addp.vn

# 1. Back up database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > /home/u229648939/backups/db_backup_pre_hf1_5_$(date +%Y%m%d_%H%M%S).sql

# 2. Back up existing backend API files & web root
zip -r /home/u229648939/backups/api_backup_pre_hf1_5_$(date +%Y%m%d_%H%M%S).zip public_html/api/
zip -r /home/u229648939/backups/ui_backup_pre_hf1_5_$(date +%Y%m%d_%H%M%S).zip public_html/assets/ public_html/index.html
```

---

### STEP 2: APPLY DATABASE MIGRATIONS (005, 006, 007, 008)

1. Apply Migration 005 (Aftersales & Loss Ledger):
```bash
cd /home/u229648939/domains/marketing.addp.vn
mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_005_create_commerce_aftersales_and_events.sql
```

2. Apply Migration 006 (Upgrade commerce_sync_runs):
```bash
mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_006_upgrade_commerce_sync_runs.sql
```

3. Apply Migration 007 (Finance Statements & Transactions):
```bash
mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_007_create_commerce_finance_tables.sql
```

4. Apply Migration 008 (Analytics & Livestream Performance Tables):
```bash
mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_008_create_commerce_analytics_tables.sql
```

Verify tables created:
```sql
SHOW TABLES LIKE 'commerce_%';
-- Expected result:
-- commerce_aftersales
-- commerce_aftersales_items
-- commerce_analytics_sync_runs
-- commerce_finance_statements
-- commerce_finance_transactions
-- commerce_live_sessions
-- commerce_loss_ledger
-- commerce_order_events
-- commerce_order_items
-- commerce_orders
-- commerce_product_analytics
-- commerce_raw_observations
-- commerce_shop_analytics_daily
-- commerce_sync_runs
-- commerce_video_analytics
```

---

### STEP 3: DEPLOY BACKEND & FRONTEND ARTIFACTS

1. Extract the release package into the web root:
```bash
cd /home/u229648939/domains/marketing.addp.vn/public_html

# Upload task_hf1_5_phase1b_release_20261001_113544.zip to server
unzip -o task_hf1_5_phase1b_release_20261001_113544.zip
rm task_hf1_5_phase1b_release_20261001_113544.zip
```

2. Deploy built UI assets (dist -> public_html):
```bash
# If dist directory was unzipped into web root:
cp -rf dist/* .
rm -rf dist
```

3. Verify file permissions:
- PHP / SQL / JS / CSS / HTML files: `chmod 644`
- Directories: `chmod 755`

4. Verify PHP syntax on server:
```bash
php -l api/config.php
php -l api/tiktok_client.php
php -l api/commerce_sync_service.php
php -l api/commerce_aftersales_service.php
php -l api/commerce_loss_engine.php
php -l api/commerce_finance_service.php
php -l api/commerce_analytics_service.php
php -l api/commerce_dashboard.php
```

---

### STEP 4: HEALTH CHECK & SYSTEM SMOKE TEST

1. Health & Auth Guard Verification:
   ```bash
   curl -I https://marketing.addp.vn/api/auth_guard.php
   ```
2. Existing TikTok Extension & Orders Sync Smoke Test:
   - Ensure Extension v1.1.3 Compass sync operates normally.
   - Confirm HF1.2 Orders API sync continues to function without errors.
3. Feature Flag Verification:
   - Confirm all HF1.3, HF1.4, HF1.5 feature flags are strictly `false` in `public/api/config.php`:
     - `FEATURE_ENABLE_AFTERSALES_V2 = false`
     - `FEATURE_ENABLE_FULFILLMENT_EVENTS_V2 = false`
     - `FEATURE_ENABLE_LOSS_ENGINE_V2 = false`
     - `FEATURE_ENABLE_FINANCE_V2 = false`
     - `FEATURE_ENABLE_ANALYTICS_V2 = false`
4. Commerce Dashboard API Smoke Test (with Admin Bearer token):
   ```bash
   curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
        "https://marketing.addp.vn/api/commerce_dashboard.php?action=get_dashboard_report&shop_id=7495657895504611503&start_date=2026-09-01&end_date=2026-09-20"
   ```

---

### STEP 5: ROLLBACK PROCEDURE (IF REQUIRED)

1. Immediate Soft Rollback (Zero Downtime, < 30 seconds):
   - In `public_html/api/config.php`, ensure:
     ```php
     define('FEATURE_ENABLE_ANALYTICS_V2', false);
     define('FEATURE_ENABLE_FINANCE_V2', false);
     define('FEATURE_ENABLE_LOSS_ENGINE_V2', false);
     define('FEATURE_ENABLE_AFTERSALES_V2', false);
     ```
   - All legacy endpoints and HF1.2 Orders continue running without interruption.

2. Full Code Reversion:
   ```bash
   cd /home/u229648939/domains/marketing.addp.vn/public_html
   unzip -o /home/u229648939/backups/api_backup_pre_hf1_5_*.zip
   unzip -o /home/u229648939/backups/ui_backup_pre_hf1_5_*.zip
   ```

3. Database Migration Rollback (Non-destructive to existing tables):
   ```bash
   cd /home/u229648939/domains/marketing.addp.vn
   mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_008_rollback_commerce_analytics_tables.sql
   mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_007_rollback_commerce_finance_tables.sql
   mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_006_rollback_commerce_sync_runs.sql
   mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql
   ```
