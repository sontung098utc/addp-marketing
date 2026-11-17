# ADDP COMMERCE INTELLIGENCE
## PRODUCTION DEPLOYMENT RUNBOOK — TASK HF1.3 PHASE 1B (RETURN / REFUND / LOSS ENGINE)

====================================================================
SCOPE:                 Return, Refund, Failed Delivery & Persistent Loss Ledger Engine
TARGET ENVIRONMENT:    Production (https://marketing.addp.vn)
ESTIMATED DOWNTIME:    Zero-downtime (Additive database migration + non-breaking code deployment)
FEATURE FLAG STATUS:   All HF1.3 Feature Flags = false (Default Dark-Launch)
====================================================================

---

### PRE-DEPLOYMENT VERIFICATION

1. Verify release package integrity:
   - Application Package: `release/task_hf1_3_phase1b_release_20261001_095119.zip`
   - SHA-256 Checksum: `c31c98c7b3f77833baa64dff106c724cf5cbdfdc2eca6123868fb0868b6d953c`
   - File Size: `32,939` bytes
2. Automated Test Suite Verification:
   - `node tools/test_hf1_3_return_refund_loss_engine.cjs` -> 40/40 PASS (100%)
   - `node tools/test_hf1_2_core_orders.cjs` -> 30/30 PASS (100%)
   - `node tools/test_task02b_security.cjs` -> 38/38 PASS (100%)
   - `node tools/secret_scan.cjs` -> 0 secrets detected (PASS)
3. Database Migration Scripts:
   - Forward Migration 005: `database/migrations/20261001_005_create_commerce_aftersales_and_events.sql` (SHA-256: `489375bb40381e9c5e3569f062006836e983680fb57136ae92a26f10f4bef6b4`)
   - Rollback Script 005: `database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql` (SHA-256: `eba473703ff1a3c79598746a6e6183a1560bd352e8dbdd57cd06bad3d1b69f93`)
   - Forward Migration 006: `database/migrations/20261001_006_upgrade_commerce_sync_runs.sql` (SHA-256: `a4a00b2c8c27cfd0a90fd810e0a3ad8d0526a9e5de0f57a304ad3b6048e4ea37`)
   - Rollback Script 006: `database/migrations/20261001_006_rollback_commerce_sync_runs.sql` (SHA-256: `34e8a3ec60f0d1fef35736dae5717d836cb4283060dff77fe8f67d82ad5dbc39`)

---

### STEP 1: PRE-DEPLOYMENT BACKUP ON SERVER

Before applying schema or file changes on production:
```bash
cd /home/u229648939/domains/marketing.addp.vn

# 1. Back up database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > /home/u229648939/backups/db_backup_pre_hf1_3_$(date +%Y%m%d_%H%M%S).sql

# 2. Back up existing backend API files
zip -r /home/u229648939/backups/api_backup_pre_hf1_3_$(date +%Y%m%d_%H%M%S).zip public_html/api/config.php public_html/api/tiktok_client.php public_html/api/commerce_sync_service.php
```

---

### STEP 2: APPLY DATABASE MIGRATIONS 005 & 006

1. Apply Migration 005 to create the 4 new HF1.3 tables (`commerce_aftersales`, `commerce_aftersales_items`, `commerce_order_events`, `commerce_loss_ledger`):
```bash
cd /home/u229648939/domains/marketing.addp.vn

mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_005_create_commerce_aftersales_and_events.sql
```

2. Apply Migration 006 to upgrade `commerce_sync_runs` for multi-domain support:
```bash
mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20261001_006_upgrade_commerce_sync_runs.sql
```

Verify tables and schema created:
```sql
SHOW TABLES LIKE 'commerce_%';
-- Expected result:
-- commerce_aftersales
-- commerce_aftersales_items
-- commerce_loss_ledger
-- commerce_order_events
-- commerce_order_items
-- commerce_orders
-- commerce_raw_observations
-- commerce_sync_runs

DESCRIBE commerce_sync_runs;
-- Expected columns include:
-- source_domain (VARCHAR(64), DEFAULT 'order')
-- sync_type (VARCHAR(64))
-- current_page_token (VARCHAR(1024))
-- last_page_token (VARCHAR(1024))
```

---

### STEP 3: DEPLOY BACKEND CODE PACKAGE

Extract the release package into the web root:
```bash
cd /home/u229648939/domains/marketing.addp.vn/public_html

unzip -o task_hf1_3_phase1b_release_20261001_095119.zip
rm task_hf1_3_phase1b_release_20261001_095119.zip
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
```

---

### STEP 4: HEALTH CHECK & SYSTEM SMOKE TEST

1. Health & Auth Verification:
   ```bash
   curl -I https://marketing.addp.vn/api/auth_guard.php
   ```
2. Existing TikTok Extension & Orders Sync Smoke Test:
   - Ensure Extension v1.1.3 Compass sync operates normally.
   - Confirm HF1.2 Orders API sync continues to function without errors.
3. Feature Flag Verification:
   - Confirm all HF1.3 feature flags are strictly `false` in `public/api/config.php`:
     - `FEATURE_ENABLE_AFTERSALES_V2 = false`
     - `FEATURE_ENABLE_FULFILLMENT_EVENTS_V2 = false`
     - `FEATURE_ENABLE_LOSS_ENGINE_V2 = false`

---

### STEP 5: SHADOW INGESTION & REGRESSION BASELINE VERIFICATION

1. Execute shadow RMA backfill for target shop `7495657895504611503` (Cohort 2026-09-01 → 2026-09-20).
2. Validate against verified regression baseline (Correction 4):
   ```sql
   SELECT COUNT(DISTINCT a.platform_order_id) as refund_orders, SUM(a.refund_amount) as total_refund
   FROM commerce_aftersales a
   INNER JOIN commerce_orders o ON a.platform_order_id = o.platform_order_id AND a.shop_id = o.shop_id
   WHERE a.shop_id = '7495657895504611503' AND a.aftersales_status = 'SUCCESS'
     AND o.platform_created_at >= '2026-09-01 00:00:00' AND o.platform_created_at <= '2026-09-20 23:59:59';
   -- REQUIRED: exactly 4 refund orders and 364,800.00 VND.
   ```
3. Validate Loss Ledger Invariant:
   ```sql
   SELECT COUNT(*) as violation_count FROM (
       SELECT platform_order_id, SUM(loss_amount) as total_loss, MAX(gross_reference_amount) as gross
       FROM commerce_loss_ledger
       GROUP BY platform_order_id, perspective
       HAVING total_loss > gross
   ) v;
   -- REQUIRED: violation_count = 0.
   ```

---

### STEP 6: SAFE ROLLBACK PROCEDURE (CORRECTION 5 MANDATE)

```
+----------------------------------------------------------------------------------------------------+
| PRODUCTION NON-DESTRUCTIVE ROLLBACK POLICY (CORRECTION 5):                                         |
+----------------------------------------------------------------------------------------------------+
| In the event of an operational anomaly on production:                                              |
| 1. TOGGLE FLAGS OFF:                                                                               |
|    Set FEATURE_ENABLE_AFTERSALES_V2 = false                                                        |
|    Set FEATURE_ENABLE_FULFILLMENT_EVENTS_V2 = false                                                |
|    Set FEATURE_ENABLE_LOSS_ENGINE_V2 = false                                                       |
| 2. HALT BACKGROUND WORKERS:                                                                        |
|    Stop any background cron workers syncing RMA / packages.                                        |
| 3. REVERT CODE IF NECESSARY:                                                                       |
|    Deploy task_hf1_2_phase1b_release_20260929_114025.zip                                           |
| 4. PRESERVE DATABASE EVIDENCE (MANDATORY):                                                         |
|    PRESERVE commerce_aftersales, commerce_aftersales_items, commerce_order_events,                 |
|    and commerce_loss_ledger tables.                                                                |
|    DO NOT DROP TABLES! Ingested raw observations and events represent legal/financial audit data.  |
|    Schema rollback (DROP TABLE) is restricted to local/staging sandbox environments only.           |
+----------------------------------------------------------------------------------------------------+
```
