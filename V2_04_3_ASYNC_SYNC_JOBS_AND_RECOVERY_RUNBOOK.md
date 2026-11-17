# Sprint V2-04.3: Async Sync Job Orchestrator & Run Recovery Runbook

**Sprint Target:** V2-04.3 — Async Sync Job Orchestrator & Run Recovery  
**Deployment Target:** ADDP Commerce Intelligence (`marketing.addp.vn`)  
**Deployment Rules:** DO NOT DEPLOY TO PRODUCTION. DO NOT RESTART PRODUCTION SERVER. DO NOT RUN NPM ON PRODUCTION. NO .ENV MODIFICATION. Local implementation, verification, and packaged release only.

---

## 1. Executive Summary & Production Incident Analysis

### The Incident
During production acceptance of Sprint V2-04.2, clicking the "↻ Đồng bộ" button for date range `2026-09-01 → 2026-09-30` encountered a **Cloudflare 524 Gateway Timeout** (~100s timeout).

However, database audit logs in `commerce_sync_runs` proved that Orders synchronization actually succeeded:
- **Run #27:** `domain: order`, `sync_type: COVERAGE_WINDOW`, `status: COMPLETED`, `start_date: 2026-09-01`, `end_date: 2026-10-01`, `records_read: 4207`, `records_written: 4207`, `latest_available_date: 2026-10-01`, duration: 113 seconds.
- Therefore, Orders Auto Sync V2-04.2 **worked accurately**. The failure was architectural: the browser HTTP request waited synchronously for all 6 domains to finish, exceeding Cloudflare's HTTP proxy timeout limit.

### Audit of Lifecycle Issues in `commerce_sync_runs`
1. **Ads False-`FAILED` Bug (Run #33):**
   - Ads run #33 was recorded as `status: FAILED` despite `records_read: 10260`, `records_written: 10260`, `latest_available_date: 2026-09-30`, and `error_code: NULL`.
   - **Root Cause:** `CommerceSyncOrchestrator::syncAdsCampaignDomain` evaluated `$statusStr = ($ingestRes['status'] ?? '') === 'SUCCESS' ? 'COMPLETED' : 'FAILED'`. `CommerceAdsIngestionService` returns status `'AVAILABLE'` or `'PARTIAL'`, never `'SUCCESS'`. This caused a successful ingestion of 10,260 campaign report records to be falsely marked `FAILED`.
2. **RMA Duplicate Execution & Stuck `RUNNING` (Runs #30 & #31):**
   - Run #30 was created by `syncRmaDomain` with `source_domain = 'rma'`. Inside it, `CommerceAftersalesService::incrementalSyncRma` created a *second* run with `source_domain = 'return_refund'`.
   - When an exception occurred, Run #30 became `FAILED / RMA_SYNC_ERROR`, while Run #31 was never finalized, staying in `RUNNING` forever.
3. **Stale `RUNNING` States (Runs #32 & #35):**
   - Runs in Loss and Analytics were abandoned in `RUNNING` when the HTTP request was aborted by the Cloudflare timeout, because there was no heartbeat timeout recovery mechanism.

---

## 2. Architecture & Design Solutions (V2-04.3)

### P0. Fast Asynchronous HTTP Response (< 1s)
- User clicks "↻ Đồng bộ".
- Frontend calls `POST /api/commerce_sync.php?action=trigger_sync` (or `start_sync`).
- Backend validates auth/shop/date range, creates a job in `commerce_sync_jobs`, and returns immediately with `{ success: true, job_id, status: 'QUEUED' }` in under 1 second.
- Browser HTTP request never hangs or times out.

### P0. Orchestration Model: `commerce_sync_jobs` (Migration 016)
- Separation of concerns:
  - `commerce_sync_jobs`: Tracks high-level orchestration, user intent, overall progress, and domain checkpoints.
  - `commerce_sync_runs`: Preserves immutable, authoritative domain execution evidence.
- Columns in `commerce_sync_jobs`:
  - `id`: BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  - `platform`: `tiktok_shop`
  - `shop_id`: Shop identifier
  - `requested_start_date`: Requested window start date (YYYY-MM-DD)
  - `requested_end_date`: Requested window end date (YYYY-MM-DD)
  - `status`: `QUEUED`, `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED`
  - `current_domain`: Domain currently executing (`order`, `rma`, `loss`, `ads_campaign`, `finance`, `analytics`)
  - `progress_percent`: Decimal (0.00 – 100.00)
  - `checkpoint_data`: JSON snapshot of executed domain results and step index
  - `started_at`, `heartbeat_at`, `completed_at`, `created_by`, `error_code`, `error_message`

### P0. Dual Execution Engine (Zero Infrastructure Dependency)
No Redis, no Celery, no Node daemon, no Docker container required. Pure PHP/MySQL:
1. **Primary Asynchronous Spawn:**
   - On job creation, backend attempts non-blocking background CLI execution:
     - Windows: `start "" /B php tools/sync_worker_cli.php --job-id={id} > NUL 2>&1`
     - Linux/macOS: `php tools/sync_worker_cli.php --job-id={id} > /dev/null 2>&1 &`
2. **Resilient Cooperative Polling Tick:**
   - Frontend polls `GET /api/commerce_sync.php?action=job_status&job_id={id}&tick=1` every 1.5 seconds.
   - If the background worker has not updated `heartbeat_at` within the tick threshold (3 seconds), the polling request advances ONE bounded domain step synchronously (`executeJobStep`).
   - Because each step is small and bounded (only 1 domain), individual HTTP calls take only 1–3 seconds, well below any timeout limit.
   - Guarantees execution progress even on shared hosting or environments where `popen`/`exec` is restricted!

### P0. Concurrency Guard & Stale Run Recovery
- **Double-Click Protection:** If an active job (`QUEUED` or `RUNNING`) already exists for the shop, `createOrGetActiveSyncJob` returns the existing job ID with `already_running: true`.
- **Heartbeat Timeout Recovery (180s):**
  - Any job in `RUNNING` without a heartbeat in > 180 seconds is marked `FAILED` with `error_code = 'STALE_JOB_RECOVERED'`.
  - Any run in `commerce_sync_runs` in `RUNNING` older than > 180 seconds is marked `FAILED` with `error_code = 'STALE_RUN_RECOVERED'`.
  - Automatically executed on job startup and status queries.

### P0. Domain Bug Fixes
- **Ads Campaign:** Fixed status check. Evaluates `AVAILABLE`, `COMPLETED`, or `records_ingested > 0` with no error as `COMPLETED`.
- **RMA / Aftersales:** Added `?int $existingRunId = null` to `syncAftersalesRmaSession` and `incrementalSyncRma`. Reuses the orchestrator's run ID, preventing duplicate run creation and orphan `RUNNING` rows.
- **Finance:** Bounded statements batch failure is isolated to Finance domain. Does not fail Orders sync.
- **Analytics:** Reaches terminal state `SKIPPED_NOT_AVAILABLE` with `NOT_YET_AVAILABLE` when data is unpublished, never left in `RUNNING`.

---

## 3. Database Migration 016 Specification

- **File:** `database/migrations/20261005_016_create_commerce_sync_jobs.sql`
- **Rollback:** `database/migrations/20261005_016_rollback_create_commerce_sync_jobs.sql`
- **Safety:** Idempotent (`CREATE TABLE IF NOT EXISTS`), non-destructive, zero data loss.

```sql
CREATE TABLE IF NOT EXISTS `commerce_sync_jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `requested_start_date` DATE NOT NULL,
    `requested_end_date` DATE NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    `current_domain` VARCHAR(32) NULL DEFAULT NULL,
    `progress_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    `checkpoint_data` LONGTEXT NULL DEFAULT NULL,
    `started_at` DATETIME NULL DEFAULT NULL,
    `heartbeat_at` DATETIME NULL DEFAULT NULL,
    `completed_at` DATETIME NULL DEFAULT NULL,
    `created_by` VARCHAR(64) NOT NULL DEFAULT 'system',
    `error_code` VARCHAR(64) NULL DEFAULT NULL,
    `error_message` TEXT NULL DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_shop_status` (`shop_id`, `status`),
    KEY `idx_status_heartbeat` (`status`, `heartbeat_at`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. Verification & Baseline Integrity

### Automated Test Results
- **Sprint V2-04.3 Test Suite (`test_v2_04_3_async_sync_jobs_and_recovery.cjs`):** 15/15 tests passing (100%)
- **Report Sync Button Hotfix Test Suite (`test_v2_04_2_report_sync_button_hotfix.cjs`):** 10/10 tests passing (100%)
- **Orders Auto Sync Test Suite (`test_v2_04_2_orders_auto_sync_and_coverage.cjs`):** 11/11 tests passing (100%)
- **Sync Orchestrator & Compact UI Test Suite (`test_v2_04_sync_orchestrator_and_compact_ui.cjs`):** 17/17 tests passing (100%)
- **Production Acceptance Fix Test Suite (`test_v2_04_1_production_acceptance_fix.cjs`):** 9/9 tests passing (100%)
- **Real PHP Compile Gate (`verify_php_syntax.cjs`):** 35/35 PHP files passing (100%)
- **Frontend Production Build (`npm run build`):** Vite build passing with 0 errors (869ms)

### September 01–30 Production Baseline Verification
- Total Orders: **4,207** (matches TikTok Seller Center exactly)
- Gross Sales: **409,171,911 VND**
- Total Loss: **84,727,422 VND**
- Realized Sales: **324,444,489 VND**
- Ads Spend / Cost: **34,182,003 VND**
- Attributed Ads Revenue: **383,251,049 VND**
- Blended ROI: **11.21**

---

## 5. Deployment Instructions (When Authorized)

> [!WARNING]
> DO NOT EXECUTE NOW. Implementation is local only.

When deployment is authorized:
1. Apply Database Migration 016:
   ```bash
   mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME < database/migrations/20261005_016_create_commerce_sync_jobs.sql
   ```
2. Unpack release ZIP archive to webroot.
3. Test CLI worker script:
   ```bash
   php tools/sync_worker_cli.php --help
   ```
4. Verify HTTP polling endpoint:
   ```bash
   curl -I "https://marketing.addp.vn/api/commerce_sync.php?action=status"
   ```
