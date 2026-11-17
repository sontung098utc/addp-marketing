# ADDP COMMERCE INTELLIGENCE
## PRODUCTION DEPLOYMENT RUNBOOK — TASK HF1.4 PHASE 1B (FINANCE & SETTLEMENT ENGINE)

====================================================================
SCOPE:                 Financial Statements, Order Statement Transactions & Settlement Engine
TARGET ENVIRONMENT:    Production (https://marketing.addp.vn)
ESTIMATED DOWNTIME:    Zero-downtime (Additive database migration + non-breaking code deployment)
FEATURE FLAG STATUS:   All HF1.3 & HF1.4 Feature Flags = false (Default Dark-Launch)
====================================================================

---

### PRE-DEPLOYMENT VERIFICATION

1. Verify release package integrity:
   - Application Package: `release/task_hf1_4_phase1b_release_20261001_102927.zip`
   - SHA-256 Checksum: `d10d145e4d471f8b66b3ab2bd130325ee9b3a2f4504babe62477fbf04715195a`
   - File Size: `42,186` bytes
2. Automated Test Suite Verification:
   - `node tools/test_hf1_4_finance_settlement_engine.cjs` -> 20/20 PASS (100%)
   - `node tools/test_hf1_3_return_refund_loss_engine.cjs` -> 40/40 PASS (100%)
   - `node tools/test_hf1_2_core_orders.cjs` -> 30/30 PASS (100%)
   - `node tools/test_task02b_security.cjs` -> 38/38 PASS (100%)
   - `node tools/secret_scan.cjs` -> 0 secrets detected (PASS)
   - `node tools/verify_php_syntax.cjs` -> 20/20 files syntax PASS (100%)
3. Database Migration Scripts:
   - Forward Migration 005: `database/migrations/20261001_005_create_commerce_aftersales_and_events.sql`
   - Rollback Script 005: `database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql`
   - Forward Migration 006: `database/migrations/20261001_006_upgrade_commerce_sync_runs.sql`
   - Rollback Script 006: `database/migrations/20261001_006_rollback_commerce_sync_runs.sql`
   - Forward Migration 007: `database/migrations/20261001_007_create_commerce_finance_tables.sql`
   - Rollback Script 007: `database/migrations/20261001_007_rollback_commerce_finance_tables.sql`

---

### STEP 1: PRE-DEPLOYMENT BACKUP ON SERVER

Before applying schema or file changes on production:
```bash
cd /home/u229648939/domains/marketing.addp.vn

# 1. Back up database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > /home/u229648939/backups/db_backup_pre_hf1_4_$(date +%Y%m%d_%H%M%S).sql

# 2. Back up existing backend API files
zip -r /home/u229648939/backups/api_backup_pre_hf1_4_$(date +%Y%m%d_%H%M%S).zip public_html/api/config.php public_html/api/tiktok_client.php public_html/api/commerce_sync_service.php
```

---

### STEP 2: APPLY DATABASE MIGRATIONS (005, 006, 007)

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

Verify tables created:
```sql
SHOW TABLES LIKE 'commerce_%';
-- Expected result:
-- commerce_aftersales
-- commerce_aftersales_items
-- commerce_finance_statements
-- commerce_finance_transactions
-- commerce_loss_ledger
-- commerce_order_events
-- commerce_order_items
-- commerce_orders
-- commerce_raw_observations
-- commerce_sync_runs
```

---

### STEP 3: DEPLOY BACKEND CODE PACKAGE

Extract the release package into the web root:
```bash
cd /home/u229648939/domains/marketing.addp.vn/public_html

unzip -o task_hf1_4_phase1b_release_20261001_102927.zip
rm task_hf1_4_phase1b_release_20261001_102927.zip
```

Verify file permissions:
- PHP / SQL files: `chmod 644`
- Directories: `chmod 755`

Verify PHP syntax on server:
```bash
php -l api/config.php
php -l api/tiktok_client.php
php -l api/commerce_sync_service.php
php -l api/commerce_aftersales_service.php
php -l api/commerce_loss_engine.php
php -l api/commerce_finance_service.php
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
   - Confirm all HF1.3 & HF1.4 feature flags are strictly `false` in `public/api/config.php`:
     - `FEATURE_ENABLE_AFTERSALES_V2 = false`
     - `FEATURE_ENABLE_FULFILLMENT_EVENTS_V2 = false`
     - `FEATURE_ENABLE_LOSS_ENGINE_V2 = false`
     - `FEATURE_ENABLE_FINANCE_V2 = false`

---

### STEP 5: ROLLBACK PROCEDURE (IF REQUIRED)

If any abnormal issue occurs:

1. Immediate Soft Rollback (Zero Downtime, < 30 seconds):
   - In `public_html/api/config.php`, ensure:
     ```php
     define('FEATURE_ENABLE_FINANCE_V2', false);
     define('FEATURE_ENABLE_LOSS_ENGINE_V2', false);
     define('FEATURE_ENABLE_AFTERSALES_V2', false);
     ```
   - All legacy endpoints and HF1.2 Orders continue running without interruption.

2. Full Code Reversion:
   ```bash
   cd /home/u229648939/domains/marketing.addp.vn/public_html
   unzip -o /home/u229648939/backups/api_backup_pre_hf1_4_*.zip
   ```

3. Database Migration Rollback (Non-destructive to existing tables):
   ```bash
   cd /home/u229648939/domains/marketing.addp.vn
   mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_007_rollback_commerce_finance_tables.sql
   mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_006_rollback_commerce_sync_runs.sql
   mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql
   ```
