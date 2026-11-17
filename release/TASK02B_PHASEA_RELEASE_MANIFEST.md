# ADDP COMMERCE INTELLIGENCE
## PRODUCTION RELEASE MANIFEST — TASK 02B PHASE A

====================================================================
RELEASE IDENTIFIER:  task02b_phaseA_release_20260923_230000
TARGET SYSTEM:       Production (https://marketing.addp.vn)
GENERATION TIMESTAMP: 2026-09-23 23:05:00 UTC+7
MODE:                STRICTLY PACKAGED — READY FOR CONTROLLED DEPLOYMENT
====================================================================

---

### 1. RELEASE VALIDATION & PRE-PACKAGING CHECKS

All local pre-packaging gates have been verified and executed cleanly:

| Validation Step | Test Command / Tool | Result | Details |
| :--- | :--- | :---: | :--- |
| **Clean Frontend Build** | `npm run build` | **PASS** | Built in 749ms with Rolldown/Vite; 0 syntax/chunk errors |
| **PHP Syntax Verification** | `tools/verify_php_syntax.cjs` | **PASS** | 16/16 PHP production files checked; 0 syntax errors |
| **Task 02 Auth Regression** | `tools/test_auth_matrix.cjs` | **PASS** | 10/10 scenarios passed (HMAC, timing-safety, scopes) |
| **Task 02B Security Matrix** | `tools/test_task02b_security.cjs` | **PASS** | 22/22 scenarios passed (pairing, atomic lock, 256KB, cooldown) |
| **Exhaustive Secret Scan** | `tools/scan_all_secrets.cjs` | **PASS** | 58 files scanned (public, src, dist, migrations, docs); 0 leaks |
| **Extension v1.1.0 Verification** | `scratch/verify_artifacts.js` | **PASS** | Manifest v1.1.0, 1-Click bridge, SHA-256 byte-for-byte match |

---

### 2. PRIMARY APPLICATION RELEASE PACKAGE

* **File Location:** `release/task02b_phaseA_release_20260923_230000.zip`
* **File Size:** `266,619` bytes
* **SHA-256 Checksum:** `DDF7360CFBF59E9FE3CDD1151A1288C0E3830029804B6FF4943C5E50B235DBBE`
* **Package Structure:**
  Contains exclusively compiled, sanitized runtime files for webroot:
  ```text
  .htaccess
  api/auth_guard.php
  api/campaigns.php
  api/config.php
  api/connector_token.php
  api/creatives_data.php
  api/db.php
  api/download_extension.php
  api/gemini_analyze.php
  api/login.php
  api/oauth.php
  api/oauth_ads.php
  api/rules.php
  api/shop_diagnosis.php
  api/sync.php
  api/tiktok_client.php
  api/webhook.php
  assets/index-DuDEHqtr.css
  assets/index-QtBG0u44.js
  extension/content_script.js
  extension/manifest.json
  extension/popup.html
  extension/popup.js
  favicon.svg
  icons.svg
  index.html
  tiktok_audit_extension.zip
  ```
* **Excluded from Package:**
  - Zero development sources (`src/`, `node_modules/`, `tools/`, `docs/`, `.git/`)
  - Zero local credentials or environment configuration files (`.env`, `.env.*`)
  - Zero database passwords, TikTok app secrets, or Gemini API keys
  - Zero database migration files (packaged independently)

---

### 3. DATABASE MIGRATION ARTIFACT (INDEPENDENT)

* **Migration Identifier:** `20260924_001_create_connector_tables.sql`
* **File Location:** `database/migrations/20260924_001_create_connector_tables.sql`
* **File Size:** `2,237` bytes
* **SHA-256 Checksum:** `AA2577C2468C998D777CBE842637883FC062948111792396C6E7FFBE1EC478F6`
* **Tables Created (Additive DDL):**
  - `tiktok_connector_pairings` (single-use SHA-256 hashed 5m pairing credentials)
  - `tiktok_connector_sessions` (server-side 24h session tracking & instant revocation)
* **Architectural Guarantees:**
  - Zero modifications to existing tables (`tiktok_config`, `tiktok_orders`, `tiktok_seller_center_snapshots`).
  - Zero modifications to `initializeDatabase()`.
  - Zero plaintext secrets stored.

---

### 4. CHROME EXTENSION CONNECTOR ARTIFACT

* **File Location:** `dist/tiktok_audit_extension.zip` (also inside application package)
* **Extension Version:** `1.1.0`
* **File Size:** `7,699` bytes
* **SHA-256 Checksum:** `408F54E730C3E88C19462A6B297BA79B60E561C3E7C6CDA72B56296F91884D0B`
* **Key Features:**
  - Seamless 1-Click pairing bridge with `marketing.addp.vn` via `window.postMessage`.
  - Manual pairing code / token redemption fallback.
  - Connector Bearer authentication for Seller Center data synchronization.
  - Server-side session disconnect and revocation.

---

### 5. TASK 02 ROLLBACK ARTIFACT (PRE-TASK 02B)

* **File Location:** `release/task02_security_release_20260923_173500.zip`
* **File Size:** `253,421` bytes
* **SHA-256 Checksum:** `9D375F85129AC34CFD47D89B6CA0025B18AA14BE9F57E671565A927885E7A87E`
* **Rollback Strategy:**
  - Application files restored to Task 02 baseline.
  - Additive database tables `tiktok_connector_pairings` and `tiktok_connector_sessions` remain in place safely without schema disruption.

---

### 6. REQUIRED PRODUCTION CONFIGURATION VARIABLES (PHASE A)

The following non-secret environment variables are required on production for Phase A:

| Variable Name | Required Phase A Value | Data Type | Production Rationale |
| :--- | :--- | :--- | :--- |
| `CONNECTOR_TOKEN_TTL` | `86400` | Integer (seconds) | 24-hour expiration for active connector sessions |
| `PAIRING_TOKEN_TTL` | `300` | Integer (seconds) | 5-minute single-use pairing credential lifetime |
| `CONNECTOR_ALLOW_UNAUTHENTICATED` | `true` | Boolean | **TEMPORARY TRANSITION ONLY:** Allows unauthenticated Seller Center sync while staff install v1.1.0 |

> [!IMPORTANT]
> - Do **NOT** expose secret values (e.g. `AUTH_SIGNING_KEY`, `DB_PASSWORD`, `TIKTOK_APP_SECRET`) in release manifests or git history.
> - `CONNECTOR_ALLOW_UNAUTHENTICATED=true` must remain enabled throughout Phase A. It will be toggled to `false` exclusively in Phase C under PO approval.
