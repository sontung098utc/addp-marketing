# ADDP COMMERCE INTELLIGENCE
## PRODUCTION RELEASE MANIFEST — TASK 02B-HF1.1.2 (TIKTOK COMPASS KPI NOISE FILTER FIX)

====================================================================
RELEASE IDENTIFIER:    task02b_hf1.1.2_release_20260924_181418
TARGET SYSTEM:         Production (https://marketing.addp.vn)
GENERATION TIMESTAMP:  2026-09-24 18:14:18 UTC+7
MODE:                  STRICTLY PACKAGED — READY FOR PRODUCTION DEPLOYMENT
====================================================================

---

### 1. SUMMARY OF HOTFIX 1.1.2
* **Objective:** Fix false-positive noise filtering in Chrome Extension v1.1.2 that rejected legitimate TikTok Seller Center Compass KPI cards wrapped in checkbox labels (`LABEL.core-checkbox...pulse-checkbox...pcm-smc-card-group-item`).
* **Root Cause in v1.1.2:**
  - `content_script.js` v1.1.2 attempted to exclude noise using:
    `node.closest('.echarts-tooltip, .biz-tooltip, [role="tooltip"], input, label, [class*="checkbox"], [class*="tooltip"]')`.
  - In real production TikTok Seller Center DOM, every genuine KPI card is intentionally rendered inside `<label class="core-checkbox core-checkbox-checked pulse-checkbox pcm-smc-card-group-item">`.
  - Consequently, `node.closest('label')` and `node.closest('[class*="checkbox"]')` evaluated to `true` for all 8 legitimate KPI titles (`GMV`, `Tổng doanh thu`, `Số món bán ra`, etc.), causing all genuine cards to be rejected before semantic matching, resulting in `detected_labels = []` and `GMV_LABEL_NOT_FOUND`.
* **Core Fixes:**
  - Removed broad `label` and `[class*="checkbox"]` ancestor exclusions.
  - Redesigned validation strategy based on structural legitimacy: a candidate is valid if it matches an approved alias, resolves to a `.pcm-smc` container via `closest('.pcm-smc')`, and that container contains `.pcm-smc-value-content`.
  - Narrowed noise exclusion strictly to chart tooltip popovers (`.vchart-tooltip, .echarts-tooltip, .biz-tooltip, [role="tooltip"]`).
  - Added enhanced diagnostic counters: `candidate_title_count` and `valid_card_count` to assist production observability without exposing secrets.
  - Bumped Chrome Extension to `1.1.3` across manifest, popup HTML, popup JS, content script, and ZIP.
  - Minimal surgical release package containing strictly the 5 extension assets required for HF1.1.2 (zero unchanged backend/frontend code touched).

---

### 2. PRIMARY APPLICATION RELEASE PACKAGE
* **File Location:** `release/task02b_hf1.1.2_release_20260924_181418.zip`
* **File Size:** `27,170` bytes
* **SHA-256 Checksum:** `2100bb3c4dd679ec45d4d0d65167fc3cfd56f4719bbc9c0e4fbcfb27ac01eb85`
* **Internal File Count:** `5` files

#### Internal Manifest & Checksums:
| # | File Path in Package | File Size | SHA-256 Checksum |
| :- | :--- | :---: | :--- |
| 1 | `extension/content_script.js` | 24,495 B | `33b3ce65cf3c72c28781ba9c743d16b81907824931c77c2096579ff81ce7fbcc` |
| 2 | `extension/manifest.json` | 900 B | `a774b3b108622c0ff2133c655436fb7a736ea946e3bd93a4dc5f20e3087e250a` |
| 3 | `extension/popup.html` | 6,571 B | `1645e11d7b3b20c241318e0f03249fc9903e1d45f57caeb6c92953d535f0c0b3` |
| 4 | `extension/popup.js` | 14,441 B | `29660fd8f3be216a95e861548c6d24b8ac6ef1e145e6038114a91053f55f85c8` |
| 5 | `tiktok_audit_extension.zip` | 13,558 B | `e2fde145fa2a91bf5750c981c1168910cd62c7b57345050d4f86c9cfc8f71e3c` |

---

### 3. DATABASE MIGRATION STATUS
* **Status:** Migration `003` was already applied in HF1.1.
* **HF1.1.2 Migration Required:** NONE.
* **Schema Modifications:** ZERO.

---

### 4. EXTENSION CONNECTOR ARTIFACT
* **File Location:** `public/tiktok_audit_extension.zip`
* **Extension Version:** `1.1.3` (Manifest V3)
* **File Size:** `13,558` bytes
* **SHA-256 Checksum:** `e2fde145fa2a91bf5750c981c1168910cd62c7b57345050d4f86c9cfc8f71e3c`

---

### 5. ROLLBACK ARTIFACTS
* **Rollback Option 1 (HF1.1.1):** `release/task02b_hf1.1.1_release_20260924_172927.zip` (SHA256: `6594b6af99bf28d648e1ca704aae3fea9dce57816abe261db551662e4ea027e4`)
* **Rollback Option 2 (HF1.1):** `release/task02b_hf1.1_release_20260924_140656.zip` (SHA256: `8a11687b890b607d2760d759c546355895488fd36d119e93d1a740eebcde497f`)
* **Rollback Option 3 (HF1):** `release/task02b_hf1_release_20260924_082800.zip` (SHA256: `62708d5c6accadd67c9fa0837eb224c3f8aba328f2da1b186701bc739e0863ed`)
* **Rollback Option 4 (Phase A):** `release/task02b_phaseA_release_20260923_230000.zip` (SHA256: `DDF7360CFBF59E9FE3CDD1151A1288C0E3830029804B6FF4943C5E50B235DBBE`)
