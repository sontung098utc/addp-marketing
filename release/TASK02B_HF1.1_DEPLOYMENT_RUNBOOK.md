# ADDP COMMERCE INTELLIGENCE
## PRODUCTION DEPLOYMENT RUNBOOK — TASK 02B-HF1.1 (HOTFIX 1.1)

====================================================================
SCOPE:                 TikTok Seller Center Compass Overview Real DOM Extractor
TARGET ENVIRONMENT:    Production (https://marketing.addp.vn)
ESTIMATED DOWNTIME:    Zero-downtime (< 1 minute rolling file deployment)
====================================================================

---

### PRE-DEPLOYMENT VERIFICATION

1. Verify release package checksums:
   - Application Package: `8a11687b890b607d2760d759c546355895488fd36d119e93d1a740eebcde497f`
   - Migration 003: `4f8d22696555983305ab87f37869a3782d4a87130282a40b3be2fbedfeceb415`
2. Confirm production database backup has been taken.

---

### STEP 1: EXECUTE DATABASE MIGRATION 003

Apply `database/migrations/20260924_003_add_compass_overview_columns.sql` to database `u229648939_dbads` via MySQL CLI or phpMyAdmin:
```bash
mysql -u u229648939_dbads -p u229648939_dbads < 20260924_003_add_compass_overview_columns.sql
```

**Verification:**
```sql
SHOW COLUMNS FROM tiktok_seller_center_snapshots LIKE 'period_%';
SHOW COLUMNS FROM tiktok_seller_center_snapshots LIKE 'total_revenue';
```
Expected result: `period_start`, `period_end`, `total_revenue`, `items_sold`, `sku_orders`, `extraction_profile`, `captured_at` are present with `NULL DEFAULT NULL`.

---

### STEP 2: BACK UP RUNTIME FILES ON SERVER

Before extracting:
```bash
cd /home/u229648939/domains/marketing.addp.vn/public_html
zip -r backup_pre_hf1.1_$(date +%Y%m%d_%H%M%S).zip api/db.php api/shop_diagnosis.php extension/
```

---

### STEP 3: DEPLOY APPLICATION PACKAGE

Upload and unzip `task02b_hf1.1_release_20260924_140656.zip`:
```bash
unzip -o task02b_hf1.1_release_20260924_140656.zip
rm task02b_hf1.1_release_20260924_140656.zip
```

Verify permissions:
- PHP files: `644`
- Directories: `755`

---

### STEP 4: CLIENT-SIDE EXTENSION UPDATE & VERIFICATION

1. In Chrome, navigate to `chrome://extensions`.
2. Reload or load unpacked the updated extension from `tiktok_audit_extension.zip` (version must display `1.1.1`).
3. Open `seller-vn.tiktok.com/compass/data-overview?shop_region=VN`.
4. Click the Extension icon:
   - Status displays connected shop.
   - Click "🚀 Quét & Đồng Bộ Về Marketing ADDP".
   - Step 1 displays extracted real date range and GMV (e.g. `Compass 01/09/2026 → 20/09/2026 | GMV: 254.200.000đ`).
   - Step 2 displays observed optional metrics (Doanh thu, Đơn hàng, Món bán).
   - Sync finishes with success message.
5. In web app `https://marketing.addp.vn`:
   - Verify dashboard loads with the newly synced real Seller Center data.

---

### STEP 5: ROLLBACK PROCEDURE (IF NEEDED)

If any unexpected regression occurs:
1. Re-deploy the HF1 package:
   `release/task02b_hf1_release_20260924_082800.zip` (SHA256: `62708d5c6accadd67c9fa0837eb224c3f8aba328f2da1b186701bc739e0863ed`).
   Or Phase A package:
   `release/task02b_phaseA_release_20260923_230000.zip` (SHA256: `DDF7360CFBF59E9FE3CDD1151A1288C0E3830029804B6FF4943C5E50B235DBBE`).
2. Migration 003 columns are completely backward-compatible (nullable) and do not need to be dropped.
