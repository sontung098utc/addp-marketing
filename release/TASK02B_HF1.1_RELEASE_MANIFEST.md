# ADDP COMMERCE INTELLIGENCE
## PRODUCTION RELEASE MANIFEST — TASK 02B-HF1.1 (COMPASS OVERVIEW DOM EXTRACTOR)

====================================================================
RELEASE IDENTIFIER:    task02b_hf1.1_release_20260924_140656
TARGET SYSTEM:         Production (https://marketing.addp.vn)
GENERATION TIMESTAMP:  2026-09-24 14:06:56 UTC+7
MODE:                  STRICTLY PACKAGED — READY FOR PRODUCTION DEPLOYMENT
====================================================================

---

### 1. SUMMARY OF HOTFIX 1.1
* **Objective:** Fix Chrome Extension Compass Overview DOM extraction failure and eliminate 30-day hardcoded period assumptions.
* **Core Fixes:**
  - Implemented semantic label-driven DOM extractor in `extension/content_script.js` based strictly on verified TikTok Seller Center DOM (`.pcm-smc-title-text-underline-inner`, `.pcm-smc-value-content`, `[data-tid="m4b_date_picker_range_picker"]`).
  - Added robust Vietnamese display number parser (`254,2 Tr₫` => `254200000`, `3.897` => `3897`, `0` => `0`, `--` => `null`).
  - Added Vietnamese date range parser (`Th09 01, 2026` to `Th09 20, 2026` => `2026-09-01` to `2026-09-20`, inclusive `period_days: 20`).
  - Eliminated `period || '30_days'` semantic fallback from `extension/popup.js`.
  - Refactored `api/shop_diagnosis.php`:
    - Compass Overview profile does not require `live_gmv`, `video_gmv`, `product_gmv`. Preserves `null` when unavailable (never fabricates 0).
    - Eliminates hardcoded `period_days = 30` in snapshot inserts; recalculates and verifies inclusive `period_days` server-side.
  - Added additive idempotent database migration (`20260924_003_add_compass_overview_columns.sql`) for period and overview metrics.
  - Bumped Chrome Extension version to `1.1.1`.

---

### 2. PRIMARY APPLICATION RELEASE PACKAGE
* **File Location:** `release/task02b_hf1.1_release_20260924_140656.zip`
* **File Size:** `192,316` bytes
* **SHA-256 Checksum:** `8a11687b890b607d2760d759c546355895488fd36d119e93d1a740eebcde497f`
* **Internal File Count:** `10` files

#### Internal Manifest & Checksums:
| # | File Path in Package | File Size | SHA-256 Checksum |
| :- | :--- | :---: | :--- |
| 1 | `api/db.php` | 35,299 B | `8899a5a6b32fa2eb45f498c6be9531d09c8fb41c1ff61cef834ea992160a29e9` |
| 2 | `api/shop_diagnosis.php` | 69,117 B | `3bcb028001ab29307160b83c3e35016585056039a91af59449b3f7a6058a528e` |
| 3 | `extension/content_script.js` | 15,347 B | `9fcc5f202b76eadf20999039a3a09a48eb6106045cdbf7892314378653c98030` |
| 4 | `extension/manifest.json` | 900 B | `5892c4d03d9b9a5a2f087c7341870c8f3a7e9002fb318d5edd8d0e7c66c25f47` |
| 5 | `extension/popup.html` | 6,571 B | `e1240969c40fa3c7f4326edb6bebdb60e5cca212070607e2c8c709c82453b8aa` |
| 6 | `extension/popup.js` | 14,441 B | `f26c16d81ce5eaf4ad11597f979860498f890aa26e6fe707d81d88c4e3d99145` |
| 7 | `tiktok_audit_extension.zip` | 11,694 B | `ac2b96039dfff5fa053a95aad2fe29396c64333240fe77da92bcfad4d1e91fa2` |
| 8 | `index.html` | 1,723 B | `ba5d4005699a3111e9fcf96e8f7c5b5c701ef54e96ce5bc27f1718a8d0467cb3` |
| 9 | `assets/index-DuDEHqtr.css` | 15,483 B | `bf640359c9d328ab7f4786abd496861fcbab5209e126133828f848dce5fa1eec` |
| 10 | `assets/index-QtBG0u44.js` | 594,933 B | `7ad81bb26d432e31037c55887a86fbad47adb5f2ac69aa028a6a2378b273985b` |

---

### 3. DATABASE MIGRATION ARTIFACT (STANDALONE)
* **Migration Identifier:** `20260924_003_add_compass_overview_columns.sql`
* **File Location:** `database/migrations/20260924_003_add_compass_overview_columns.sql`
* **File Size:** `2,306` bytes
* **SHA-256 Checksum:** `4f8d22696555983305ab87f37869a3782d4a87130282a40b3be2fbedfeceb415`
* **Execution Rule:** Execute in production MySQL before unzipping application files.
* **Columns Added:** `period_start`, `period_end`, `total_revenue`, `items_sold`, `sku_orders`, `extraction_profile`, `captured_at`.

---

### 4. EXTENSION CONNECTOR ARTIFACT
* **File Location:** `public/tiktok_audit_extension.zip`
* **Extension Version:** `1.1.1` (Manifest V3)
* **File Size:** `11,694` bytes
* **SHA-256 Checksum:** `ac2b96039dfff5fa053a95aad2fe29396c64333240fe77da92bcfad4d1e91fa2`

---

### 5. ROLLBACK ARTIFACTS
* **Rollback Option 1 (HF1):** `release/task02b_hf1_release_20260924_082800.zip` (SHA256: `62708d5c6accadd67c9fa0837eb224c3f8aba328f2da1b186701bc739e0863ed`)
* **Rollback Option 2 (Phase A):** `release/task02b_phaseA_release_20260923_230000.zip` (SHA256: `DDF7360CFBF59E9FE3CDD1151A1288C0E3830029804B6FF4943C5E50B235DBBE`)
