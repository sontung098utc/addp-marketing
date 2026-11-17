# ADDP COMMERCE INTELLIGENCE
## PRODUCTION DEPLOYMENT RUNBOOK — TASK 02B-HF1.1.2 (HOTFIX 1.1.2)

====================================================================
SCOPE:                 TikTok Seller Center Compass KPI Noise Filter Fix
TARGET ENVIRONMENT:    Production (https://marketing.addp.vn)
ESTIMATED DOWNTIME:    Zero-downtime (< 30 seconds rolling file replacement)
====================================================================

---

### PRE-DEPLOYMENT VERIFICATION

1. Verify release package checksum:
   - Application Package: `task02b_hf1.1.2_release_20260924_181418.zip`
   - SHA-256: `2100bb3c4dd679ec45d4d0d65167fc3cfd56f4719bbc9c0e4fbcfb27ac01eb85`
   - Size: `27,170` bytes
2. Migration 003 was already applied in HF1.1. **NO NEW DATABASE MIGRATION REQUIRED FOR HF1.1.2.**

---

### STEP 1: BACK UP RUNTIME EXTENSION ASSETS ON SERVER

Before extracting:
```bash
cd /home/u229648939/domains/marketing.addp.vn/public_html
zip -r backup_pre_hf1.1.2_$(date +%Y%m%d_%H%M%S).zip extension/ tiktok_audit_extension.zip
```

---

### STEP 2: DEPLOY APPLICATION PACKAGE

Upload and unzip `task02b_hf1.1.2_release_20260924_181418.zip`:
```bash
unzip -o task02b_hf1.1.2_release_20260924_181418.zip
rm task02b_hf1.1.2_release_20260924_181418.zip
```

Verify permissions:
- Files: `644`
- Directories: `755`

---

### STEP 3: CLIENT-SIDE EXTENSION UPDATE & E2E VERIFICATION

1. In Chrome, navigate to `chrome://extensions`.
2. Ensure **Developer mode** toggle is enabled (top right).
3. If previously loaded as unpacked:
   - Click the reload icon on "TikTok Shop Audit & Sync - Marketing ADDP", OR
   - Download the new `tiktok_audit_extension.zip` from `https://marketing.addp.vn/tiktok_audit_extension.zip`, unzip, and load unpacked.
4. Verify extension version displays: **1.1.3**.
5. Open TikTok Seller Center:
   `https://seller-vn.tiktok.com/compass/data-overview?shop_region=VN`
6. Verify date picker is selected (e.g., 2026-09-01 to 2026-09-20).
7. Open the Extension popup:
   - Shop status: Connected.
   - Click **"🚀 Quét & Đồng Bộ Về Marketing ADDP"**.
   - Step 1 displays:
     `✅ 1. Compass 01/09/2026 → 20/09/2026 (20 ngày) | GMV: 254.200.000đ`
   - Step 2 displays:
     `✅ 2. Tổng doanh thu: 266.300.000đ | Đơn hàng: 2.540 (hoặc Đơn hàng SKU: 3.836) | Món bán: 3.897`
   - Step 3:
     `✅ 3. Gói dữ liệu trích xuất hợp lệ.`
   - Step 4:
     `✅ 4. Đồng bộ dữ liệu thành công lên hệ thống!`
8. In web application `https://marketing.addp.vn`:
   - Refresh page.
   - Confirm report and snapshots preserve extracted values without any synthetic/mock fallback.

---

### STEP 4: ROLLBACK PROCEDURE (IF NEEDED)

If any unexpected issue occurs:
1. Re-deploy HF1.1.1 package:
   `release/task02b_hf1.1.1_release_20260924_172927.zip` (SHA256: `6594b6af99bf28d648e1ca704aae3fea9dce57816abe261db551662e4ea027e4`)
   Or HF1.1 package:
   `release/task02b_hf1.1_release_20260924_140656.zip` (SHA256: `8a11687b890b607d2760d759c546355895488fd36d119e93d1a740eebcde497f`)
   Or HF1 package:
   `release/task02b_hf1_release_20260924_082800.zip` (SHA256: `62708d5c6accadd67c9fa0837eb224c3f8aba328f2da1b186701bc739e0863ed`)
   Or Phase A package:
   `release/task02b_phaseA_release_20260923_230000.zip` (SHA256: `DDF7360CFBF59E9FE3CDD1151A1288C0E3830029804B6FF4943C5E50B235DBBE`)
2. Extension can be rolled back to `v1.1.2` or `v1.1.1` by reloading previous builds.
