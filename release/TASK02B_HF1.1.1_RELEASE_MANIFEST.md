# ADDP COMMERCE INTELLIGENCE
## PRODUCTION RELEASE MANIFEST — TASK 02B-HF1.1.1 (TIKTOK COMPASS METRIC CARD EXTRACTOR)

====================================================================
RELEASE IDENTIFIER:    task02b_hf1.1.1_release_20260924_172927
TARGET SYSTEM:         Production (https://marketing.addp.vn)
GENERATION TIMESTAMP:  2026-09-24 17:29:27 UTC+7
MODE:                  STRICTLY PACKAGED — READY FOR PRODUCTION DEPLOYMENT
====================================================================

---

### 1. SUMMARY OF HOTFIX 1.1.1
* **Objective:** Fix client-side Chrome Extension failure on TikTok Seller Center Compass Overview (`seller-vn.tiktok.com/compass/data-overview?shop_region=VN`): `"Không tìm thấy thẻ chỉ số GMV trên trang La bàn dữ liệu."`
* **Root Cause in v1.1.1:**
  - `content_script.js` evaluated `titleEl.closest('.pcm-smc, [class*="pcm-smc"]')`.
  - In standard browser DOM (Chrome), the title node has class `"pcm-smc-title-text-underline-inner"` which satisfies `[class*="pcm-smc"]`. Because `Element.closest()` tests the calling element itself first, Chrome returned `titleEl` itself instead of walking up 4 levels to the parent card container `DIV.pcm-smc`.
  - Consequently, `card.querySelector('.pcm-smc-value-content')` was executed inside the title `<span>` itself and returned `null`, leaving GMV unextracted.
* **Core Fixes:**
  - Replaced ambiguous traversal with `findMetricCard(root, labelAliases)` strictly matching `.pcm-smc` card containers.
  - Eliminated `[class*="pcm-smc"]` in ancestor matching to avoid self-matching of title underline spans.
  - Added controlled fallbacks for title nodes within `.pcm-smc` (`.pcm-smc-title-text`, `.pcm-smc-title`).
  - Scoped value query `.pcm-smc-value-content` strictly within the matched card container.
  - Added multi-whitespace and newline normalization in `parseVietnameseNumber` to handle `"254,2\nTr\n₫"` and `"254,2Tr₫"`.
  - Added safe, granular diagnostic status codes (`GMV_LABEL_NOT_FOUND`, `GMV_CARD_NOT_FOUND`, `GMV_VALUE_NOT_FOUND`, `GMV_VALUE_PARSE_FAILED`, `DATE_RANGE_NOT_FOUND`, `DATE_RANGE_PARSE_FAILED`).
  - Bumped Chrome Extension to `1.1.2` across `manifest.json`, `popup.html`, `popup.js`, and `content_script.js`.
  - Minimal release package containing strictly the 5 extension assets required for HF1.1.1 (zero unchanged backend/frontend code touched).

---

### 2. PRIMARY APPLICATION RELEASE PACKAGE
* **File Location:** `release/task02b_hf1.1.1_release_20260924_172927.zip`
* **File Size:** `26,288` bytes
* **SHA-256 Checksum:** `6594b6af99bf28d648e1ca704aae3fea9dce57816abe261db551662e4ea027e4`
* **Internal File Count:** `5` files

#### Internal Manifest & Checksums:
| # | File Path in Package | File Size | SHA-256 Checksum |
| :- | :--- | :---: | :--- |
| 1 | `extension/content_script.js` | 22,399 B | `06233d5b51032dfb529e04b88ba56545362b5514b590761368a8dfe1ba0d1529` |
| 2 | `extension/manifest.json` | 900 B | `b50e8bfedd4635b55050befb8bbac3b1f75ea1531fc26b4cec3f879990bd8432` |
| 3 | `extension/popup.html` | 6,571 B | `fa7ad8eef4367bebb3ddce9e7cc236eda16cab568d597ab1eb69fdefad531ba8` |
| 4 | `extension/popup.js` | 14,441 B | `bdb78a5eac5ffce723442afd24dcca85627d4216071ebfbfe27fbd0b5cc02fad` |
| 5 | `tiktok_audit_extension.zip` | 13,116 B | `d647f2ef83b647b93f02f0f139466fac8709ee0613a0655aaec8099d647ffa28` |

---

### 3. DATABASE MIGRATION STATUS
* **Status:** Migration `003` was already applied in HF1.1.
* **HF1.1.1 Migration Required:** NONE.
* **Schema Modifications:** ZERO.

---

### 4. EXTENSION CONNECTOR ARTIFACT
* **File Location:** `public/tiktok_audit_extension.zip`
* **Extension Version:** `1.1.2` (Manifest V3)
* **File Size:** `13,116` bytes
* **SHA-256 Checksum:** `d647f2ef83b647b93f02f0f139466fac8709ee0613a0655aaec8099d647ffa28`

---

### 5. ROLLBACK ARTIFACTS
* **Rollback Option 1 (HF1.1):** `release/task02b_hf1.1_release_20260924_140656.zip` (SHA256: `8a11687b890b607d2760d759c546355895488fd36d119e93d1a740eebcde497f`)
* **Rollback Option 2 (HF1):** `release/task02b_hf1_release_20260924_082800.zip` (SHA256: `62708d5c6accadd67c9fa0837eb224c3f8aba328f2da1b186701bc739e0863ed`)
* **Rollback Option 3 (Phase A):** `release/task02b_phaseA_release_20260923_230000.zip` (SHA256: `DDF7360CFBF59E9FE3CDD1151A1288C0E3830029804B6FF4943C5E50B235DBBE`)
