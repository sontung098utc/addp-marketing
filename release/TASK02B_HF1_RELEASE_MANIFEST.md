# ADDP COMMERCE INTELLIGENCE
## PRODUCTION RELEASE MANIFEST — TASK 02B-HF1 (HOTFIX 1)

====================================================================
RELEASE IDENTIFIER:    task02b_hf1_release_20260924_082800
TARGET SYSTEM:         Production (https://marketing.addp.vn)
GENERATION TIMESTAMP:  2026-09-24 08:28:00 UTC+7
MODE:                  STRICTLY PACKAGED — READY FOR PRODUCTION DEPLOYMENT
====================================================================

---

### 1. SUMMARY OF HOTFIX
* **Root Cause Addressed:**
  - Resolved `Column not found: 1054 Unknown column 'ses_score' in 'field list'` on `POST /api/shop_diagnosis.php?action=sync_seller_center`.
  - Added schema migration for 11 missing SES columns on `tiktok_config` with zero synthetic defaults (`NULL DEFAULT NULL`).
  - Implemented transactional integrity wrapping `tiktok_seller_center_snapshots` and `tiktok_config` (`beginTransaction()`, `commit()`, `rollBack()`).
  - Removed synthetic/mock metric fallbacks across backend API and Extension client.
  - Implemented controlled extraction error handling in Extension v1.1.0 (fails gracefully when Compass metrics are unavailable).
  - Maintained complete backward compatibility for Phase A dual-mode (`CONNECTOR_ALLOW_UNAUTHENTICATED=true`).

---

### 2. PRIMARY APPLICATION RELEASE PACKAGE
* **File Location:** `release/task02b_hf1_release_20260924_082800.zip`
* **File Size:** `183,710` bytes
* **SHA-256 Checksum:** `62708d5c6accadd67c9fa0837eb224c3f8aba328f2da1b186701bc739e0863ed`
* **Internal File Count:** `10` files

#### Internal Manifest & Checksums:
| # | File Path in Package | File Size | SHA-256 Checksum |
| :- | :--- | :---: | :--- |
| 1 | `api/db.php` | 34,923 B | `512a20216f88ad6643a7b5b14e2dd06179aba5b26d189f26230f22de44e0b83e` |
| 2 | `api/shop_diagnosis.php` | 63,698 B | `beea9a4bd5f394b367a0fc55f02f1496221f0be8fae47e9848532e4ec8fbe172` |
| 3 | `extension/content_script.js` | 2,900 B | `3a2eac219fdd1ec45186600cbfe7489c8406e5cbf1a48e6b2bf6131247f4d5b8` |
| 4 | `extension/manifest.json` | 900 B | `5267eb6eb7c5e81dc12061d0b6e72e879e0d28df637d118472c37108678a3319` |
| 5 | `extension/popup.html` | 6,568 B | `6bee9b52df6276d5ca82b14e2633c5bcb0e900c980c2cee5888770e5aad1422e` |
| 6 | `extension/popup.js` | 13,196 B | `2f8452c37e402c7e2634776e9a7a8af54d28fbe05b4607706ebeba30a3706d8c` |
| 7 | `tiktok_audit_extension.zip` | 7,852 B | `58a8360f2cc8851414150258c2fb9f682786e606798804e6a23b3ed8cfd816b7` |
| 8 | `index.html` | 1,723 B | `ba5d4005699a3111e9fcf96e8f7c5b5c701ef54e96ce5bc27f1718a8d0467cb3` |
| 9 | `assets/index-DuDEHqtr.css` | 15,483 B | `bf640359c9d328ab7f4786abd496861fcbab5209e126133828f848dce5fa1eec` |
| 10 | `assets/index-QtBG0u44.js` | 594,933 B | `7ad81bb26d432e31037c55887a86fbad47adb5f2ac69aa028a6a2378b273985b` |

---

### 3. DATABASE MIGRATION ARTIFACT (STANDALONE)
* **Migration Identifier:** `20260924_002_add_ses_columns_to_tiktok_config.sql`
* **File Location:** `database/migrations/20260924_002_add_ses_columns_to_tiktok_config.sql`
* **File Size:** `3,542` bytes
* **SHA-256 Checksum:** `11c8ede107a47c574e95fac6fcf1c503854a1b923e828544a92cee6e47ee99dc`
* **Execution Rule:** Must be executed manually in production MySQL BEFORE unzipping the application package.
* **Schema Integrity:** Contains zero synthetic observed metrics (`NULL DEFAULT NULL`).

---

### 4. EXTENSION CONNECTOR ARTIFACT
* **File Location:** `public/tiktok_audit_extension.zip` (also inside application package)
* **Extension Version:** `1.1.0` (Manifest V3)
* **File Size:** `7,852` bytes
* **SHA-256 Checksum:** `58a8360f2cc8851414150258c2fb9f682786e606798804e6a23b3ed8cfd816b7`
* **Integrity Guarantee:** Zero hardcoded mock metrics; fails gracefully with an actionable error if Compass metrics are absent.

---

### 5. ROLLBACK ARTIFACT
* **File Location:** `release/task02b_phaseA_release_20260923_230000.zip`
* **File Size:** `266,619` bytes
* **SHA-256 Checksum:** `DDF7360CFBF59E9FE3CDD1151A1288C0E3830029804B6FF4943C5E50B235DBBE`
* **Status:** Verified intact and untouched.
