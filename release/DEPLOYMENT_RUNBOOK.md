# PRODUCTION DEPLOYMENT & OPERATION RUNBOOK (TASK 02)
**System:** ADDP Commerce Intelligence (`marketing.addp.vn`)  
**Target Server:** `/home/addp/domains/marketing.addp.vn/public_html/`  
**Release Package:** `release/task02_security_release_20260923_173500.zip`  
**Rollback Package:** `release/task02_rollback_package_pre_task02.zip`  
**Date:** September 2026  

---

> [!IMPORTANT]
> **SAFETY PRINCIPLES:**
> 1. Do NOT rush. Follow the sequence ONE STEP AT A TIME.
> 2. Configure production `.env` BEFORE uploading the new code. (Fail-closed design halts with HTTP 500 if `.env` is missing).
> 3. Do NOT rotate credentials until the new release is deployed, smoke-tested, and verified operational.
> 4. Do NOT modify or restore the production database during this deployment.

---

## 1. PRE-DEPLOYMENT PHASE

### STEP 1: Backup Current Production `public_html/`
Before altering any file on the production server:
1. Log in to cPanel / DirectAdmin / SSH for `marketing.addp.vn`.
2. Open **File Manager** (or terminal).
3. Compress the current `public_html/` directory into a server-side backup:
   ```bash
   tar -czf /home/addp/backup_public_html_pre_task02_$(date +%Y%m%d_%H%M%S).tar.gz /home/addp/domains/marketing.addp.vn/public_html/
   ```
4. Verify the tar.gz file was created and is non-empty.

### STEP 2: Backup Current Production Database
1. Open cPanel / DirectAdmin -> **phpMyAdmin** (or terminal `mysqldump`).
2. Export database `addp_marketing`:
   ```bash
   mysqldump -u addp_marketing -p addp_marketing > /home/addp/backup_db_addp_marketing_$(date +%Y%m%d_%H%M%S).sql
   ```
3. Store the database backup securely outside the webroot.

---

## 2. CONFIGURATION PHASE (BEFORE CODE DEPLOYMENT)

### STEP 3: Configure Production Environment Variables (`.env`)
1. Create or open the production environment file at:
   `/home/addp/domains/marketing.addp.vn/.env` *(Recommended: outside webroot)*  
   OR `/home/addp/domains/marketing.addp.vn/public_html/.env` *(Inside webroot, protected by `.htaccess`)*.
2. Review [`release/PRODUCTION_ENV_CHECKLIST.md`](file:///c:/AdsTiktok/release/PRODUCTION_ENV_CHECKLIST.md).
3. Populate all REQUIRED variable names:
   ```ini
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://marketing.addp.vn

   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=addp_marketing
   DB_USER=addp_marketing
   DB_PASSWORD=<CURRENT_PRODUCTION_DB_PASSWORD>

   ADMIN_USERNAME=addp_admin
   ADMIN_PASSWORD_HASH=<GENERATE_BCRYPT_HASH_FOR_ADMIN_PASSWORD>

   AUTH_SIGNING_KEY=<GENERATE_RANDOM_64_CHAR_HEX_KEY>

   TIKTOK_APP_KEY=<CURRENT_TIKTOK_APP_KEY>
   TIKTOK_APP_SECRET=<CURRENT_TIKTOK_APP_SECRET>
   TIKTOK_REDIRECT_URI=https://marketing.addp.vn/api/oauth.php

   TIKTOK_ADS_APP_ID=<CURRENT_TIKTOK_ADS_APP_ID>
   TIKTOK_ADS_SECRET=<CURRENT_TIKTOK_ADS_SECRET>
   TIKTOK_ADS_REDIRECT_URI=https://marketing.addp.vn/api/oauth_ads.php

   GEMINI_API_KEY=<CURRENT_GEMINI_KEY_IF_ANY>
   ```
4. Generate `AUTH_SIGNING_KEY` via terminal:
   ```bash
   php -r "echo bin2hex(random_bytes(32)) . PHP_EOL;"
   ```
5. Generate `ADMIN_PASSWORD_HASH`:
   ```bash
   php -r "echo password_hash('YOUR_DESIRED_ADMIN_PASSWORD', PASSWORD_BCRYPT) . PHP_EOL;"
   ```
6. Save the `.env` file with restrictive permissions:
   ```bash
   chmod 600 /home/addp/domains/marketing.addp.vn/.env
   ```

### STEP 4: Verify PHP Can Read Required Configuration
Verify on the server before deploying new code:
```bash
php -r "require '/home/addp/domains/marketing.addp.vn/public_html/api/config.php'; echo 'CONFIG OK' . PHP_EOL;"
```
*(If previous code is still present, test that `.env` is readable by the web server user)*.

---

## 3. RELEASE DEPLOYMENT PHASE

### STEP 5: Upload Approved Task 02 Release Package
1. Upload `release/task02_security_release_20260923_173500.zip` to the server:
   `/home/addp/domains/marketing.addp.vn/`
2. Verify checksum on the server:
   ```bash
   sha256sum task02_security_release_20260923_173500.zip
   # Expected: 9D375F85129AC34CFD47D89B6CA0025B18AA14BE9F57E671565A927885E7A87E
   ```
3. Extract the release package into `public_html/`:
   ```bash
   unzip -o task02_security_release_20260923_173500.zip -d /home/addp/domains/marketing.addp.vn/public_html/
   ```
4. Verify file permissions:
   - Directories: `755`
   - PHP and static files: `644`
   - `.htaccess`: `644`
5. Verify that `dist/api/` does not contain any of the 12 debug scripts:
   ```bash
   ls -la /home/addp/domains/marketing.addp.vn/public_html/api/test_*.php
   # Expected: No such file or directory
   ```

---

## 4. SMOKE TESTING & VALIDATION PHASE

### STEP 6: Execute Smoke Tests
Run the following test commands via terminal:

```bash
# TEST 1: Unauthenticated request to protected endpoint -> Must return 401
curl -s -o /dev/null -w "%{http_code}\n" https://marketing.addp.vn/api/campaigns.php
# EXPECTED: 401

# TEST 2: Query-string token attempt -> Must return 401
curl -s -o /dev/null -w "%{http_code}\n" "https://marketing.addp.vn/api/campaigns.php?auth_token=invalid"
# EXPECTED: 401

# TEST 3: Direct .env access attempt -> Must return 403 or 404
curl -s -o /dev/null -w "%{http_code}\n" https://marketing.addp.vn/.env
# EXPECTED: 403 (Forbidden)

# TEST 4: Deleted debug script attempt -> Must return 404
curl -s -o /dev/null -w "%{http_code}\n" https://marketing.addp.vn/api/test_delete.php
# EXPECTED: 404 (Not Found)
```

### STEP 7: Verify Login
1. Open `https://marketing.addp.vn` in a browser.
2. Confirm the login screen does NOT display default passwords in the footer.
3. Test failed login with incorrect password -> Confirm message `"Sai tài khoản hoặc mật khẩu đăng nhập!"`.
4. Log in with the configured `ADMIN_USERNAME` and password.
5. Confirm login succeeds and redirects to the Dashboard.

### STEP 8: Verify Authenticated Dashboard APIs
1. On the Dashboard, verify Campaigns list loads with 200 OK.
2. Verify Rules tab loads.
3. Verify Shop Diagnosis tab loads.
4. Verify clicking "📥 Tải Tiện Ích (.ZIP)" downloads `tiktok_audit_extension.zip` without errors.

### STEP 9: Verify TikTok Shop OAuth Reachability
1. Click the Shop OAuth link.
2. Confirm redirection to `services.tiktokshop.com` includes a dynamic `&state=<hex>` parameter.
3. (Do not re-authorize if already authorized; verify the redirect initiates safely).

### STEP 10: Verify TikTok Ads OAuth Reachability
1. Click the Ads OAuth link.
2. Confirm redirection to `ads.tiktok.com` includes a dynamic `&state=<hex>` parameter.

### STEP 11: Verify Chrome Extension Sync
1. Open TikTok Seller Center on Chrome with the extension installed.
2. Click "Đồng bộ về Marketing ADDP".
3. Verify `sync_seller_center` accepts the payload and updates checklist/diagnosis.

### STEP 12: Verify Gemini Integration
1. On GMV Max tab, trigger AI campaign analysis.
2. Confirm report generation completes.

### STEP 13: Monitor Logs
Inspect server error logs for any runtime warnings:
```bash
tail -n 50 /home/addp/domains/marketing.addp.vn/logs/error.log
# (or cPanel Error Log viewer)
```
Confirm zero unhandled exceptions.

---

## 5. POST-STABILIZATION CREDENTIAL ROTATION PHASE

> [!CAUTION]
> **ROTATE ONLY AFTER STEPS 6–13 ARE 100% SUCCESSFUL.**  
> Rotate credentials **ONE AT A TIME**, re-testing immediately after each step.

### STEP 14: Controlled Credential Rotation Sequence

#### Rotation 1: Administrative Login Password
- **What becomes invalid:** Old admin password. Active sessions remain valid until token expires (or until `AUTH_SIGNING_KEY` is rotated).
- **Action:**
  1. Generate new password hash: `php -r "echo password_hash('NEW_SECURE_ADMIN_PASS', PASSWORD_BCRYPT);"`
  2. Update `ADMIN_PASSWORD_HASH` in `.env`.
  3. Remove `ADMIN_PASSWORD` from `.env`.
- **Test:** Log out and log back in with the new password.

#### Rotation 2: Database User Password
- **What becomes invalid:** Previous database password.
- **Action:**
  1. In cPanel -> **MySQL Databases**, change password for user `addp_marketing`.
  2. Immediately update `DB_PASSWORD` in `.env`.
- **Test:** Refresh Dashboard, test `/api/campaigns.php` -> Must return 200 OK.

#### Rotation 3: TikTok Shop Partner App Secret
- **What becomes invalid:** Old webhook signatures and token exchange capabilities. Active access tokens remain valid until their expiration.
- **Action:**
  1. In **TikTok Shop Partner Center** (services.tiktokshop.com) -> Apps -> Reset App Secret.
  2. Update `TIKTOK_APP_SECRET` in `.env`.
- **Test:** Trigger a test OAuth connection and verify webhook verification.

#### Rotation 4: TikTok Ads Developer App Secret
- **What becomes invalid:** Ads token exchange endpoint. Active ads tokens remain valid.
- **Action:**
  1. In **TikTok For Business** (ads.tiktok.com/marketing_api) -> Reset Secret.
  2. Update `TIKTOK_ADS_SECRET` in `.env`.
- **Test:** Test Ads token refresh.

#### Rotation 5: Gemini API Key (If Applicable)
- **What becomes invalid:** Old AI key.
- **Action:** Create new key in Google AI Studio, update `GEMINI_API_KEY` in `.env`.
- **Test:** Run AI analysis on Dashboard.

#### Rotation 6: `AUTH_SIGNING_KEY` (Session Invalidation)
- **What becomes invalid:** **ALL ACTIVE USER SESSIONS.** Every logged-in user will be logged out and prompted to log in again.
- **Action:** Generate new 64-char hex key, update `AUTH_SIGNING_KEY` in `.env`.
- **Test:** Refresh page -> User should be prompted to log in -> Log in succeeds.

---

## 6. ROLLBACK PROCEDURES

### How to Distinguish Failure Types:
- **CONFIGURATION FAILURE (HTTP 500 with `SERVER_CONFIGURATION_ERROR`):**
  - Cause: Missing or malformed `.env` variable.
  - Fix: Check `.env` file path and variable names against `PRODUCTION_ENV_CHECKLIST.md`. Do NOT rollback code.
- **AUTH FAILURE (HTTP 401 on valid login):**
  - Cause: Mismatch between password and `ADMIN_PASSWORD_HASH` / `ADMIN_PASSWORD`.
  - Fix: Re-generate password hash and verify `ADMIN_USERNAME`.
- **APPLICATION FAILURE (HTTP 500 with PHP fatal error):**
  - Cause: Corrupted file upload or missing file in `dist/`.
  - Fix: Follow Code Rollback below.
- **OAUTH FAILURE (CSRF State error during TikTok OAuth callback):**
  - Cause: Session cookie not preserved across redirects.
  - Fix: Check PHP `session.save_path` on hosting server.
- **EXTERNAL API FAILURE (TikTok API timeout / 502):**
  - Cause: TikTok API downtime or rate limiting.
  - Fix: Check network connection from server to TikTok Open API endpoints.

### Emergency Code Rollback (Pre-Task-02):
If a critical application failure cannot be resolved within 15 minutes:
1. Extract the rollback package into `public_html/`:
   ```bash
   unzip -o /home/addp/domains/marketing.addp.vn/task02_rollback_package_pre_task02.zip -d /home/addp/domains/marketing.addp.vn/public_html/
   ```
2. Verify previous application functionality resumes.
3. **DO NOT RESTORE OR ROLLBACK DATABASE.** Task 02 did not alter database structure or data.
