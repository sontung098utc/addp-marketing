# ADDP COMMERCE INTELLIGENCE
## PRODUCTION RELEASE MANIFEST — TASK HF1.2 PHASE 1B (CORE ORDERS ENGINE)

====================================================================
RELEASE IDENTIFIER:    task_hf1_2_phase1b_release_20260929_114025
TARGET SYSTEM:         Production (https://marketing.addp.vn)
GENERATION TIMESTAMP:  2026-09-29 04:40:25 UTC
MODE:                  STRICTLY PACKAGED — READY FOR PRODUCTION DEPLOYMENT
FEATURE_FLAG:          FEATURE_ENABLE_COMMERCE_V2 = false (SAFE DARK-LAUNCH)
PRODUCTION DEPLOYMENT: 0 (HALTED BEFORE DEPLOYMENT)
PRODUCTION DB CHANGES: 0 (HALTED BEFORE MIGRATION)
====================================================================

---

### 1. SUMMARY OF HF1.2 PHASE 1B
* **Objective:** Implement and validate the high-throughput, fault-tolerant Core Orders Ingestion Engine for TikTok Shop API using cursor-based pagination, three-token transactional checkpointing, idempotent upserts, and strict zero-PII sanitization.
* **Architecture Highlights:**
  - **API Contract:** TikTok Shop Open API `POST /order/202309/orders/search`, scope `seller.order.info`, default `page_size = 100`.
  - **Three-Token Checkpoint Flow:**
    - `current_page_token`: token submitted with current API request.
    - `next_page_token`: token returned by TikTok Shop API response.
    - `resume_page_token`: saved to DB checkpoint (`last_page_token`) strictly within the atomic transaction just before `COMMIT`.
    - On error/crash: transaction triggers `ROLLBACK`, leaving `resume_page_token` at the last successfully committed page, guaranteeing zero page skipping and zero duplicate ingestion.
  - **Zero-PII Recursive Sanitizer & Invariant Verifier:**
    - Recursive denylist scrubbing removes recipient names, phone numbers, detailed street addresses, buyer notes, and `buyer_uid`.
    - Pre-persistence verifier scans entire payload for 21 forbidden PII keys; throws `SecurityException` if any detected.
  - **Dual-Write / Dark-Launch Isolation:**
    - New schema isolated in dedicated tables (`commerce_orders`, `commerce_order_items`, `commerce_sync_runs`, `commerce_raw_observations`).
    - Gated by `FEATURE_ENABLE_COMMERCE_V2 = false` in `public/api/config.php`.
    - Existing `tiktok_orders` and Compass Overview workflows remain 100% untouched.

---

### 2. PRIMARY APPLICATION RELEASE PACKAGE
* **Archive File:** `release/task_hf1_2_phase1b_release_20260929_114025.zip`
* **File Size:** `16.909 bytes`
* **SHA-256 Checksum:** `6534328fbc7f6e7c2dea16ff5c93ae90ac4a5068c7d78eac307215256779a6c3`
* **Internal File Count:** `5` files

#### Internal Manifest & Checksums:
| # | File Path in Package | File Size | SHA-256 Checksum |
| :- | :--- | :---: | :--- |
| 1 | `database/migrations/20260925_004_create_commerce_core_tables.sql` | 9.105 B | `0ea0eb34cc2d5426d7eb2e22132e35cb6f8ef7e9657f8e84e7f65cf3c00f682b` |
| 2 | `database/migrations/20260925_004_rollback_commerce_core_tables.sql` | 684 B | `9b41a44b4e3fc8ebf7160dc3c713bb518734c2af2401f6f4dd8171d82f7b0763` |
| 3 | `public/api/config.php` | 6.393 B | `929f94bd26d100763f83a3f3fba2bd864c1bee3977920e6990d2a8bd36eac596` |
| 4 | `public/api/tiktok_client.php` | 18.874 B | `c1f24778b2a7c5eb4b56df7e4aadda92fb9fa30dfe55a6209d13d8def0c88c33` |
| 5 | `public/api/commerce_sync_service.php` | 27.714 B | `0f66281618b9ee863f0bbd0995701c98b5a82bf56b57b0f98a1fab493c24f315` |

---

### 3. DATABASE MIGRATION SPECIFICATIONS
* **Forward Migration:** `database/migrations/20260925_004_create_commerce_core_tables.sql`
  - Creates `commerce_orders` (Primary Key: `id`, Unique Key: `platform, shop_id, order_id`)
  - Creates `commerce_order_items` (Primary Key: `id`, Unique Key: `order_pk, item_id`)
  - Creates `commerce_sync_runs` (Tracks sync runs, checkpoints, cursor state, status)
  - Creates `commerce_raw_observations` (Sanitized audit provenance, 90-day retention)
* **Rollback Script:** `database/migrations/20260925_004_rollback_commerce_core_tables.sql`
  - Safely drops `commerce_order_items`, `commerce_raw_observations`, `commerce_orders`, `commerce_sync_runs` without affecting legacy tables.

---

### 4. TEST SUITE & SECURITY VERIFICATION
* **Core Orders Automated Test Matrix:** 25/25 SCENARIOS PASS (100%)
* **Task 02B Security & Extension Regression:** 38/38 SCENARIOS PASS (100%)
* **Auth Guard Matrix:** 10/10 SCENARIOS PASS (100%)
* **DOM Extractor Regression:** 21/21 SCENARIOS PASS (100%)
* **Payload Boundary Tests:** 8/8 SCENARIOS PASS (100%)
* **Secret Leak Scan:** 0 hardcoded secrets detected (PASS)

---

### 5. RELEASE-GATE & ROLLBACK INVARIANTS
* **Deployment State:** Strictly held at gate. No code deployed to production.
* **Database State:** 0 migrations executed on production.
* **Feature Flag:** `FEATURE_ENABLE_COMMERCE_V2 = false`.
* **Rollback Command:** In case of emergency on deployment, run rollback script:
  ```bash
  mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/20260925_004_rollback_commerce_core_tables.sql
  ```
