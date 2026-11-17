# ADDP COMMERCE INTELLIGENCE
## PRODUCTION DEPLOYMENT RUNBOOK — TASK 02B-HF1 (HOTFIX 1)

====================================================================
HOTFIX SCOPE:          Seller Center Authenticated Sync Schema / Data Integrity
TARGET ENVIRONMENT:    Production (https://marketing.addp.vn)
EXPECTED DOWNTIME:     Zero-downtime (< 1 minute rolling file extraction)
====================================================================

---

### PRE-DEPLOYMENT CHECKLIST (VERIFY BEFORE EXECUTION)

1. Verify production database backup has been taken.
2. Confirm current production environment status:
   - System responding at `https://marketing.addp.vn`
   - Phase A is active (`CONNECTOR_ALLOW_UNAUTHENTICATED=true`)
3. Verify release package checksums locally:
   - Package: `62708d5c6accadd67c9fa0837eb224c3f8aba328f2da1b186701bc739e0863ed`
   - Migration: `11c8ede107a47c574e95fac6fcf1c503854a1b923e828544a92cee6e47ee99dc`

---

### STEP 1: APPLY DATABASE MIGRATION 002 (MANDATORY FIRST STEP)

Apply `database/migrations/20260924_002_add_ses_columns_to_tiktok_config.sql` via MySQL CLI or phpMyAdmin on production database `u229648939_dbads`.

```bash
# Example via DirectAdmin SSH / MySQL CLI:
mysql -u u229648939_dbads -p u229648939_dbads < 20260924_002_add_ses_columns_to_tiktok_config.sql
```

**Verification Query:**
```sql
SHOW COLUMNS FROM tiktok_config LIKE 'ses_%';
```
Expected result: 11 `ses_` columns present with `NULL DEFAULT NULL` (except weights `70.00`, `15.00`, `15.00`).

---

### STEP 2: BACK UP EXISTING DEPLOYED FILES

Before extracting the new zip, back up current files in `public_html`:
```bash
cd /home/u229648939/domains/marketing.addp.vn/public_html
zip -r backup_pre_hf1_$(date +%Y%m%d_%H%M%S).zip api/db.php api/shop_diagnosis.php extension/
```

---

### STEP 3: DEPLOY APPLICATION RELEASE PACKAGE

Upload `task02b_hf1_release_20260924_082800.zip` to `public_html` and unzip:
```bash
unzip -o task02b_hf1_release_20260924_082800.zip
rm task02b_hf1_release_20260924_082800.zip
```

Verify permissions:
- PHP files: `644`
- Directories: `755`

---

### STEP 4: POST-DEPLOYMENT SMOKE TEST

1. **Web App Smoke Check:**
   - Open `https://marketing.addp.vn`
   - Verify login works and dashboard loads.
2. **Shop Diagnosis API Check:**
   - Execute GET `https://marketing.addp.vn/api/shop_diagnosis.php`
   - Verify HTTP 200 OK.
3. **Extension Connector Sync Check:**
   - Open Chrome Extension v1.1.0 on TikTok Seller Center Compass page.
   - Click "Đồng bộ ngay".
   - Verify HTTP 200 OK (`[SECURITY] Authenticated Seller Center sync accepted`).
   - Verify no PDOException 1054 error in server logs.
   - Verify metrics populate accurately in dashboard.

---

### STEP 5: ROLLBACK PROCEDURE (IF INCIDENT OCCURS)

If any critical failure occurs:
1. Re-deploy the verified Phase A package:
   `release/task02b_phaseA_release_20260923_230000.zip` (SHA256: `DDF7360CFBF59E9FE3CDD1151A1288C0E3830029804B6FF4943C5E50B235DBBE`).
2. Schema columns added by Migration 002 are nullable and backward-compatible; they do not need to be dropped.
