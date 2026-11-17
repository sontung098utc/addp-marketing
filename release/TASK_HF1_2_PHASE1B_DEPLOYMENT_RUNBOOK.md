# ADDP COMMERCE INTELLIGENCE
## PRODUCTION DEPLOYMENT RUNBOOK — TASK HF1.2 PHASE 1B (CORE ORDERS ENGINE)

====================================================================
SCOPE:                 TikTok Shop Orders Ingestion Engine (V2 Core)
TARGET ENVIRONMENT:    Production (https://marketing.addp.vn)
ESTIMATED DOWNTIME:    Zero-downtime (Additive database migration + non-breaking code deployment)
FEATURE FLAG STATUS:   FEATURE_ENABLE_COMMERCE_V2 = false (Default Dark-Launch)
====================================================================

---

### PRE-DEPLOYMENT VERIFICATION

1. Verify release package integrity:
   - Application Package: `release/task_hf1_2_phase1b_release_20260929_114025.zip`
   - SHA-256 Checksum: `6534328fbc7f6e7c2dea16ff5c93ae90ac4a5068c7d78eac307215256779a6c3`
   - File Size: `16,909` bytes
2. Automated Test Verification:
   - `node tools/test_hf1_2_core_orders.cjs` -> 30/30 PASS (100%)
   - `node tools/test_task02b_security.cjs` -> 38/38 PASS (100%)
   - `node tools/secret_scan.cjs` -> 0 secrets detected (PASS)
3. Database Migration Scripts:
   - Forward Migration: `database/migrations/20260925_004_create_commerce_core_tables.sql` (SHA256: `0ea0eb34cc2d5426d7eb2e22132e35cb6f8ef7e9657f8e84e7f65cf3c00f682b`)
   - Rollback Script: `database/migrations/20260925_004_rollback_commerce_core_tables.sql` (SHA256: `9b41a44b4e3fc8ebf7160dc3c713bb518734c2af2401f6f4dd8171d82f7b0763`)

---

### STEP 1: PRE-DEPLOYMENT BACKUP ON SERVER

Before applying any schema or file changes, create backups on the production server:
```bash
cd /home/u229648939/domains/marketing.addp.vn

# 1. Back up database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > /home/u229648939/backups/db_backup_pre_hf1_2_$(date +%Y%m%d_%H%M%S).sql

# 2. Back up existing backend API files
zip -r /home/u229648939/backups/api_backup_pre_hf1_2_$(date +%Y%m%d_%H%M%S).zip public_html/api/config.php public_html/api/tiktok_client.php
```

---

### STEP 2: APPLY DATABASE MIGRATION 004

Apply migration 004 to create the 4 new `commerce_*` core tables:
```bash
cd /home/u229648939/domains/marketing.addp.vn

mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20260925_004_create_commerce_core_tables.sql
```

Verify tables created:
```sql
SHOW TABLES LIKE 'commerce_%';
-- Expected result:
-- commerce_orders
-- commerce_order_items
-- commerce_raw_observations
-- commerce_sync_runs
```

---

### STEP 3: DEPLOY BACKEND CODE PACKAGE

Extract the release package into the web root:
```bash
cd /home/u229648939/domains/marketing.addp.vn/public_html

unzip -o task_hf1_2_phase1b_release_20260929_114025.zip
rm task_hf1_2_phase1b_release_20260929_114025.zip
```

Verify file permissions:
- PHP / SQL files: `chmod 644`
- Directories: `chmod 755`

Verify PHP syntax on server:
```bash
php -l api/config.php
php -l api/tiktok_client.php
php -l api/commerce_sync_service.php
```

---

### STEP 4: HEALTH CHECK & SYSTEM SMOKE TEST

1. Health & Auth Verification:
   ```bash
   curl -I https://marketing.addp.vn/api/auth_guard.php
   ```
2. Existing TikTok Extension Sync Smoke Test:
   - Ensure Extension v1.1.3 Compass sync operates normally.
   - Confirm legacy snapshots (`tiktok_seller_center_snapshots`) continue to function without errors.
3. Feature Flag Verification:
   - Confirm `FEATURE_ENABLE_COMMERCE_V2` is `false` in `public/api/config.php`.
   - Engine is deployed in safe dark-launch mode.

---

### STEP 5: CONTROLLED FEATURE ACTIVATION (CANARY / PILOT)

When ready for pilot ingestion:
1. In `public/api/config.php`, set:
   ```php
   define('FEATURE_ENABLE_COMMERCE_V2', true);
   ```
2. Trigger initial incremental sync or backfill sync via CLI / background worker.
3. Monitor `commerce_sync_runs` table:
   ```sql
   SELECT id, run_type, status, current_page, records_synced, error_code, error_message, created_at, finished_at 
   FROM commerce_sync_runs 
   ORDER BY id DESC LIMIT 5;
   ```
4. Verify zero PII in `commerce_raw_observations`:
   ```sql
   SELECT payload_json FROM commerce_raw_observations ORDER BY id DESC LIMIT 5;
   -- Confirm NO recipient names, phone numbers, detailed addresses, or buyer notes exist.
   ```

---

### STEP 6: ROLLBACK PROCEDURE (EMERGENCY REVERSAL)

If any critical failure occurs during deployment or pilot:

1. **Immediate Feature Flag Disable:**
   Set `define('FEATURE_ENABLE_COMMERCE_V2', false);` in `public/api/config.php`.

2. **Revert Backend Files:**
   Restore previous release package:
   - Package: `release/task02b_hf1.1.2_release_20260924_181418.zip` (SHA256: `2100bb3c4dd679ec45d4d0d65167fc3cfd56f4719bbc9c0e4fbcfb27ac01eb85`)
   - Or restore backup zip from Step 1.

3. **Revert Database Schema (If Necessary):**
   ```bash
   mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20260925_004_rollback_commerce_core_tables.sql
   ```
   Confirm all `commerce_*` tables are dropped cleanly while legacy `tiktok_*` tables remain 100% intact.
