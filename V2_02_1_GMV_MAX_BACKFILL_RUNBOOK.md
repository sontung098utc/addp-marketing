# ADDP COMMERCE INTELLIGENCE — SPRINT V2-02.1 BACKFILL RUNBOOK
## OFFICIAL TIKTOK GMV MAX BACKFILL TOOL (`2026-09-01 → 2026-09-20`)

**Tool Path:** `tools/backfill_gmv_max_official_cli.php`  
**Execution Authority:** Product Owner / Data Operator  
**Target Date Range:** `2026-09-01 → 2026-09-20` (20 consecutive days)  
**Data Source:** 100% Official TikTok Marketing API (`/open_api/v1.3/gmv_max/report/get/`)  
**Strict Policy:** Zero silent fallback to legacy reports. Missing data is reported explicitly as `PARTIAL` or `UNAVAILABLE`.

---

### 1. Operational Overview & Safety Features

The standalone CLI tool [`tools/backfill_gmv_max_official_cli.php`](file:///c:/AdsTiktok/tools/backfill_gmv_max_official_cli.php) safely ingests date-bounded GMV Max advertising data directly from the official TikTok Marketing API:
- **Automatic Date Chunking:** Automatically divides ranges into <= 30-day windows to conform to TikTok API constraints.
- **Service-Level Batching:** Automatically splits campaign IDs and SPU item group IDs into chunks of <= 100 per API request.
- **Resumable State Checkpoints:** Records completed domains and date chunks in `.gmv_max_backfill_checkpoint.json`. Interrupted jobs can be safely resumed with `--resume`.
- **Dry-Run Mode:** Supports `--dry-run` to validate parameters, credentials, and API dimensions without writing to the database.
- **Idempotency Guarantee:** All database operations utilize `ON DUPLICATE KEY UPDATE` to guarantee reruns produce zero duplicate records.

---

### 2. Command Line Arguments Reference

```
Usage: php tools/backfill_gmv_max_official_cli.php [options]

Options:
  --start=YYYY-MM-DD          Start date (default: 2026-09-01)
  --end=YYYY-MM-DD            End date (default: 2026-09-20)
  --advertiser-id=ID          TikTok Advertiser ID (default: read from config / DB)
  --domain=DOMAIN             Domain to sync: all | campaigns | products | creatives | live (default: all)
  --dry-run                   Simulate backfill without persisting records
  --resume                    Resume from previous checkpoint if available
  --checkpoint-file=PATH      Path to checkpoint file (default: .gmv_max_backfill_checkpoint.json)
  --help                      Display help message
```

---

### 3. Step-by-Step Backfill Procedure

#### Step 1: Pre-Execution Dry-Run Simulation
Always execute `--dry-run` first to verify date boundaries and environment configuration:

```bash
cd /home/addp/domains/marketing.addp.vn/public_html
php ../tools/backfill_gmv_max_official_cli.php --dry-run --start=2026-09-01 --end=2026-09-20
```

*Expected Output:*
```text
====================================================================
ADDP COMMERCE INTELLIGENCE — GMV MAX OFFICIAL BACKFILL CLI
====================================================================
Source:          OFFICIAL TIKTOK GMV MAX API ONLY (No Legacy Substitution)
Period:          2026-09-01 → 2026-09-20
Advertiser ID:   ...
Domain Target:   ALL
Dry Run Mode:    ENABLED (Simulation only)
...
[DRY-RUN] Completed simulation successfully. No database records modified.
```

#### Step 2: Execute Live Multi-Domain Backfill
Execute the full backfill across all 4 domains (`campaigns`, `products`, `creatives`, `live`):

```bash
php ../tools/backfill_gmv_max_official_cli.php --start=2026-09-01 --end=2026-09-20
```

The script will process each domain sequentially:
1. **Campaigns Domain:**
   - Ingests PRODUCT campaigns (`gmv_max_promotion_types = ['PRODUCT']`)
   - Ingests LIVE campaigns (`gmv_max_promotion_types = ['LIVE']`)
   - Records official `api_roi`, `api_cpa`, `net_cost`, `observed_at`
2. **Products Domain (SPU):**
   - Retrieves authoritative Product campaign IDs
   - Batches campaign IDs <= 100
   - Queries `item_group_id` facts and upserts `commerce_ads_product_daily`
3. **Creatives Domain (Video):**
   - Queries `commerce_ads_product_daily` to extract campaign $\to$ SPU mapping
   - Queries `item_id` facts per campaign SPU (no cartesian explosion)
   - Normalizes `NOT_DELIVERYING` $\to$ `NOT_DELIVERING`, retains `item_id = -1` unattributed bucket
4. **LIVE Domain (Rooms):**
   - Retrieves authoritative LIVE campaign IDs
   - Batches campaign IDs <= 100
   - Queries `room_id` facts and upserts `commerce_ads_live_daily` (retaining `SESSION_MAPPING_PENDING`)

#### Step 3: Resuming an Interrupted Run
If the backfill is interrupted (e.g., SSH disconnection, TikTok API rate limiting):

```bash
php ../tools/backfill_gmv_max_official_cli.php --start=2026-09-01 --end=2026-09-20 --resume
```
The script reads `.gmv_max_backfill_checkpoint.json` and skips domains/chunks that were already successfully processed.

#### Step 4: Selective Domain Backfill
If you only need to refresh a specific domain (for instance, creatives):

```bash
php ../tools/backfill_gmv_max_official_cli.php --start=2026-09-01 --end=2026-09-20 --domain=creatives
```

---

### 4. Post-Backfill Verification & Coverage Inspection

Upon completion, the tool prints the final summary:

```text
====================================================================
FINAL BACKFILL SUMMARY & COVERAGE AUDIT
====================================================================
Campaigns Ingested: 342
Products Ingested:  ...
Creatives Ingested: ...
LIVE Rooms Ingested:...
Total Recorded Cost:... đ

Coverage Analysis for requested period (2026-09-01 → 2026-09-20):
  Requested Days:    20
  Available Days:    20
  Missing Days:      0
  Coverage Pct:      100%
  Coverage Status:   COMPLETE
  Official Spend:    ... đ
====================================================================
Backfill completed successfully.
```

In the UI (`https://marketing.addp.vn`):
- Card 3 badge will update from `PARTIAL (1/20 ngày - 5%)` to `COMPLETE (20/20 ngày - 100%)`.
- Badge `[Dữ liệu chưa đủ kỳ]` will clear when all 20 days are available.
- Macro ROI and CPA will reflect complete period factual totals.

---

### 5. Troubleshooting & Error Recovery

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `TikTok API rate limit (code 40100)` | Too many requests in short interval | Script automatically pauses and retries. Run with `--resume` if terminated. |
| `Missing required environment configuration` | `.env` file not located | Verify `.env` exists in domain root `/home/addp/domains/marketing.addp.vn/.env`. |
| `Token expired (code 40105)` | Access token expired | Re-authenticate TikTok OAuth in Ads settings, then rerun. |
| `PARTIAL coverage remaining` | TikTok API has not released stats for today | TikTok stats can take 4-12 hours to settle. Today's date may naturally be missing until next sync. |
