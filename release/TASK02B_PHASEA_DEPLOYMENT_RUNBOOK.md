# ADDP COMMERCE INTELLIGENCE
## PRODUCTION DEPLOYMENT RUNBOOK — TASK 02B PHASE A

**Production Environment:** `https://marketing.addp.vn`  
**Host / Account:** `addp:addp` on OpenLiteSpeed + DirectAdmin + Cloudflare  
**Webroot:** `/home/addp/domains/marketing.addp.vn/public_html/`  
**Environment File:** `/home/addp/domains/marketing.addp.vn/.env`  
**Release Package:** `task02b_phaseA_release_20260923_230000.zip`  
**Migration Artifact:** `20260924_001_create_connector_tables.sql`  

---

## 1. MIGRATION PREFLIGHT (DO NOT EXECUTE AUTOMATICALLY)

Before running the migration on production, execute these preflight inspection commands interactively to verify database connectivity, storage engine capabilities, and ensure zero schema conflicts:

### Step 1.1: Connectivity & Version Check
```bash
# Verify database connection and MySQL version (MySQL 5.7+ / 8.0+ / MariaDB 10.3+ required)
mysql -u addp_user -p -e "SELECT VERSION(), @@default_storage_engine;" addp_marketing
```

### Step 1.2: Check for Existing Table Conflicts
```bash
# Confirm that connector tables do not already exist
mysql -u addp_user -p -e "
SHOW TABLES LIKE 'tiktok_connector_pairings';
SHOW TABLES LIKE 'tiktok_connector_sessions';
" addp_marketing
```
*Expected Result:* Empty set (0 rows returned).

### Step 1.3: Verify Existing Business Tables Untouched
```bash
# Confirm that existing business tables are healthy and unaltered
mysql -u addp_user -p -e "
DESCRIBE tiktok_config;
DESCRIBE tiktok_orders;
DESCRIBE tiktok_seller_center_snapshots;
" addp_marketing
```

### Step 1.4: Post-Migration Schema Verification (To run AFTER execution)
```bash
mysql -u addp_user -p -e "
DESCRIBE tiktok_connector_pairings;
DESCRIBE tiktok_connector_sessions;
SHOW INDEX FROM tiktok_connector_pairings;
SHOW INDEX FROM tiktok_connector_sessions;
" addp_marketing
```
*Verification Checklist:*
- `pairing_hash` is `varchar(64)` with `idx_pairing_hash` as `UNIQUE`.
- `connector_id` is `varchar(64)` with `idx_connector_id` as `UNIQUE`.
- `token_jti_hash` is `varchar(64)`.
- No plaintext secret column exists.

---

## 2. MIGRATION EXECUTION METHOD

> [!CAUTION]
> Never embed the production database password directly into shell commands, flags (`-pMySecret`), or script files, as this permanently leaks credentials into `~/.bash_history`, `/proc` tables, and audit logs.

### Recommended Execution: Interactive Password Prompt
```bash
# Safe interactive migration execution:
mysql -u addp_user -p addp_marketing < /home/addp/staging_task02b/20260924_001_create_connector_tables.sql
```
*(Enter the database password interactively when prompted by MySQL client)*

---

## 3. DATABASE BACKUP GATE

```text
==================================================
BACKUP REQUIRED = YES
==================================================
```
A fresh, verified database backup of `addp_marketing` is an absolute prerequisite before running the SQL migration.

### Database Backup Procedure:
```bash
# 1. Create a timestamped pre-migration dump
mysqldump -u addp_user -p \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  addp_marketing > /home/addp/backups/db_backup_pre_task02b_$(date +%Y%m%d_%H%M%S).sql

# 2. Verify backup integrity and non-zero file size
ls -lh /home/addp/backups/db_backup_pre_task02b_*.sql
tail -n 20 /home/addp/backups/db_backup_pre_task02b_*.sql | grep "Dump completed"
```
*Backup Verification Gate:* Must see `-- Dump completed on YYYY-MM-DD ...` at the end of the file. If dump failed, **HALT DEPLOYMENT IMMEDIATELY**.

---

## 4. APPLICATION BACKUP GATE

Prior to extracting any Task 02B files into production, preserve the currently working Task 02 webroot.

```bash
# 1. Archive working Task 02 webroot (Do NOT overwrite previous backups)
tar -czvf /home/addp/backups/app_backup_task02_pre_task02b_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /home/addp/domains/marketing.addp.vn/ public_html

# 2. Verify archive existence and size
ls -lh /home/addp/backups/app_backup_task02_pre_task02b_*.tar.gz
```

---

## 5. ENVIRONMENT PREFLIGHT (.env CONFIGURATION)

### Required Variables for Phase A:
Ensure the following 3 variables are present in `/home/addp/domains/marketing.addp.vn/.env`:
```env
CONNECTOR_TOKEN_TTL=86400
PAIRING_TOKEN_TTL=300
CONNECTOR_ALLOW_UNAUTHENTICATED=true
```

### Analysis of Runtime Behavior Under Edge Cases:
* **Missing Variable:** `public/api/config.php` utilizes `env('CONNECTOR_ALLOW_UNAUTHENTICATED', true)`. If missing, it safely falls back to `true` (Phase A transition).
* **Malformed or Empty String:** If `CONNECTOR_ALLOW_UNAUTHENTICATED=""`, `env()` returns default `true`. **The application will NEVER silently enter Phase C lock-down due to missing or malformed configuration.**
* **Zero or Negative TTL:** If TTL is $\le 0$, token expiration calculation (`now + ttl`) will generate expired tokens upon creation (`exp <= now`), rejecting all pairing/connector attempts. Maintain exact values `86400` and `300`.

---

## 6. FILE OWNERSHIP & PERMISSIONS SPECIFICATION

* **User / Group:** `addp:addp`
* **Security Principles:**
  - Production `.env`: Restricted to `0600` (readable/writable exclusively by user `addp`).
  - Webroot Directories: `0755` (traversable and readable by LiteSpeed).
  - Webroot Files: `0644` (readable by PHP-FPM / LiteSpeed lsphp).
  - Never run recursive `chmod 777`.

### Permission & Ownership Commands:
```bash
# Set secure ownership on webroot
chown -R addp:addp /home/addp/domains/marketing.addp.vn/public_html

# Set secure directory & file permissions
find /home/addp/domains/marketing.addp.vn/public_html -type d -exec chmod 755 {} \;
find /home/addp/domains/marketing.addp.vn/public_html -type f -exec chmod 644 {} \;

# Set strict permissions on .env
chmod 600 /home/addp/domains/marketing.addp.vn/.env
chown addp:addp /home/addp/domains/marketing.addp.vn/.env

# Pre/Post Deployment Ownership Verification
ls -ld /home/addp/domains/marketing.addp.vn/.env
ls -ld /home/addp/domains/marketing.addp.vn/public_html
```

---

## 7. COMPLETE PHASE A DEPLOYMENT ORDER (STEPS A — V)

Follow this exact sequence step-by-step:

* [ ] **A. Verify fresh application + DB backups:** Confirm both files exist in `/home/addp/backups/`.
* [ ] **B. Verify release SHA-256:**
  ```bash
  sha256sum task02b_phaseA_release_20260923_230000.zip
  # Must match: DDF7360CFBF59E9FE3CDD1151A1288C0E3830029804B6FF4943C5E50B235DBBE
  sha256sum 20260924_001_create_connector_tables.sql
  # Must match: AA2577C2468C998D777CBE842637883FC062948111792396C6E7FFBE1EC478F6
  ```
* [ ] **C. Extract release into staging directory OUTSIDE webroot:**
  ```bash
  mkdir -p /home/addp/staging_task02b/app
  unzip -q task02b_phaseA_release_20260923_230000.zip -d /home/addp/staging_task02b/app
  cp 20260924_001_create_connector_tables.sql /home/addp/staging_task02b/
  ```
* [ ] **D. Inspect staged files:**
  ```bash
  ls -la /home/addp/staging_task02b/app
  ls -la /home/addp/staging_task02b/app/api
  ```
* [ ] **E. PHP syntax check on server:**
  ```bash
  for f in /home/addp/staging_task02b/app/api/*.php; do php -l "$f" || exit 1; done
  ```
* [ ] **F. Secret/debug/test scan in staging:**
  ```bash
  grep -rnE "(password|secret|AIza)" /home/addp/staging_task02b/app/api/
  ```
* [ ] **G. Verify production .env readability:** Confirm `addp` user can read `/home/addp/domains/marketing.addp.vn/.env`.
* [ ] **H. Add/verify the 3 connector environment variables:** Ensure `CONNECTOR_TOKEN_TTL=86400`, `PAIRING_TOKEN_TTL=300`, `CONNECTOR_ALLOW_UNAUTHENTICATED=true`.
* [ ] **I. Run migration:**
  ```bash
  mysql -u addp_user -p addp_marketing < /home/addp/staging_task02b/20260924_001_create_connector_tables.sql
  ```
* [ ] **J. Verify new connector tables:** Run post-migration verification query (Step 1.4).
* [ ] **K. Dry-run application rsync:**
  ```bash
  rsync -avvn /home/addp/staging_task02b/app/ /home/addp/domains/marketing.addp.vn/public_html/
  ```
* [ ] **L. Deploy application WITHOUT `--delete`:**
  ```bash
  rsync -av /home/addp/staging_task02b/app/ /home/addp/domains/marketing.addp.vn/public_html/
  ```
* [ ] **M. Verify ownership & permissions:** Ensure `addp:addp` and `0755`/`0644`.
* [ ] **N. Smoke test existing Task 02 authentication:** Verify admin login and dashboard loading.
* [ ] **O. Smoke test Phase A connector endpoints:** Verify pairing generation and token gateway.
* [ ] **P. Install/reload Extension v1.1 on ONE controlled staff browser.**
* [ ] **Q. Perform pairing:** Test 1-Click pairing from web app to extension.
* [ ] **R. Perform authenticated Seller Center sync:** Verify data arrives in Marketing ADDP.
* [ ] **S. Verify sanitized logs:** Check server `error_log` for clean sanitized audit logs.
* [ ] **T. Keep anonymous compatibility enabled:** Confirm `CONNECTOR_ALLOW_UNAUTHENTICATED=true` remains in effect.
* [ ] **U. Observe stability:** Monitor system for 24 hours.
* [ ] **V. Only later request PO approval for Phase C.**

---

## 8. PHASE A SMOKE TEST PLAN (WITHOUT CREDENTIAL LEAKAGE)

To prevent tokens from leaking into shell history, populate temporary variables interactively or test via Browser DevTools:

### Test 1: Homepage & Public Assets (Expect HTTP 200)
```bash
curl -I https://marketing.addp.vn/
curl -I https://marketing.addp.vn/api/download_extension.php
```

### Test 2: Protected Admin API Without Token (Expect HTTP 401)
```bash
curl -i https://marketing.addp.vn/api/rules.php
```
*Expected Response:* `HTTP/2 401 Unauthorized` (`MISSING_TOKEN`).

### Test 3: Normal Admin Login (Expect HTTP 200 + Bearer Token)
Perform via browser login UI at `https://marketing.addp.vn` or interactive shell.

### Test 4: Connector Pairing Creation Without Admin Auth (Expect HTTP 401)
```bash
curl -i -X POST https://marketing.addp.vn/api/connector_token.php?action=create_pairing \
  -H "Content-Type: application/json"
```
*Expected Response:* `HTTP/2 401 Unauthorized` (`MISSING_TOKEN`).

### Test 5: Anonymous Seller Center Sync (Phase A Compatibility: Accepted)
```bash
curl -i -X POST https://marketing.addp.vn/api/shop_diagnosis.php?action=sync_seller_center \
  -H "Content-Type: application/json" \
  -d '{"total_gmv":1000000,"total_orders_count":10,"ses_score":4.9}'
```
*Expected Response:* `HTTP/2 200 OK` (Accepted under Phase A transition).

### Test 6: Oversized Payload Rejection (Expect HTTP 413)
```bash
# Send payload exceeding 256 KB
head -c 270000 /dev/urandom | base64 | curl -i -X POST https://marketing.addp.vn/api/shop_diagnosis.php?action=sync_seller_center \
  -H "Content-Type: application/json" --data-binary @-
```
*Expected Response:* `HTTP/2 413 Payload Too Large` (`PAYLOAD_TOO_LARGE`).

### Test 7: Extension v1.1.0 Full Lifecycle Verification
1. Open Marketing ADDP web app -> Chẩn đoán Shop -> "⚡ Kết Nối 1-Click".
2. Content script receives message -> calls `action=redeem_pairing` -> saves 24h token to extension.
3. Extension popup displays "🟢 Đã kết nối".
4. Perform Sync -> Server records `[SECURITY] Authenticated Seller Center sync accepted`.
5. Click Disconnect -> Server session revoked -> Local storage cleared.

---

## 9. ROLLBACK PROCEDURE

In the event of an operational regression during Phase A deployment:

### Application Rollback (Leaves Additive DB Tables Intact):
```bash
# 1. Restore previous Task 02 release package without modifying database
unzip -o /home/addp/backups/task02_security_release_20260923_173500.zip \
  -d /home/addp/domains/marketing.addp.vn/public_html/

# 2. Reset permissions
find /home/addp/domains/marketing.addp.vn/public_html -type d -exec chmod 755 {} \;
find /home/addp/domains/marketing.addp.vn/public_html -type f -exec chmod 644 {} \;
chown -R addp:addp /home/addp/domains/marketing.addp.vn/public_html

# 3. Touch restart for LiteSpeed
touch /home/addp/domains/marketing.addp.vn/public_html/.htaccess
```
> [!NOTE]
> Do **NOT** execute `DROP TABLE` on `tiktok_connector_pairings` or `tiktok_connector_sessions`. These tables are purely additive and do not interfere with Task 02 code execution.

---

## 10. PHASE C BOUNDARY CLARIFICATION

* **Current Status:** This release enters **PHASE A ONLY**.
* **Flag Status:** `CONNECTOR_ALLOW_UNAUTHENTICATED=true` **MUST REMAIN ENABLED**.
* **Closure Requirement:** Task 02B security closure will be completed in **Phase C** only after:
  1. Extension v1.1.0 is rolled out to all operational staff.
  2. Authenticated production sync is verified across all users.
  3. No legacy client requires anonymous access.
  4. Product Owner gives explicit approval to lock down.
  5. `CONNECTOR_ALLOW_UNAUTHENTICATED` is toggled to `false` in production `.env`.

---

## 11. NO TASK 03 CHANGES ACKNOWLEDGEMENT

This release package contains **ZERO** business logic modifications from Task 03. All existing Task 03 areas remain frozen:
- 200-order pagination cap
- GMV fallback substitution
- Order status classification
- Timezone calculations
- Hardcoded Seller Center data & simulation formulas
- Synthetic cancellations
