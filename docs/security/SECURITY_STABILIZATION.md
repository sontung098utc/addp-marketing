# ADDP Commerce Intelligence
## Security Stabilization Specification & Migration Plan

> **Classification:** CONFIDENTIAL & TECHNICAL SECURITY DOCUMENTATION  
> **System Name:** ADDP Commerce Intelligence (`marketing.addp.vn`)  
> **Workspace:** `c:\AdsTiktok`  
> **Reference Document:** [`docs/audit/EXISTING_SYSTEM_AUDIT.md`](file:///c:/AdsTiktok/docs/audit/EXISTING_SYSTEM_AUDIT.md)  
> **Status:** LOCAL IMPLEMENTATION COMPLETED — READY FOR PRODUCT OWNER REVIEW (ZERO PROD DEPLOYMENT)  
> **Date:** September 2026  

---

### 1. Security Architecture Principles

This document formalizes the production security stabilization specification for `marketing.addp.vn` according to 8 mandatory architectural requirements:

1. **Fail-Closed Secret Management:**
   - Real passwords, database credentials, API secrets, and signing keys are completely removed from source code.
   - No hardcoded legacy secrets are retained as fallbacks.
   - When running in `APP_ENV=production`, the application immediately halts with a generic 500 error if required environment variables are absent.
   - `.env.example` contains placeholders only.

2. **Dedicated Auth Signing Key (`AUTH_SIGNING_KEY`):**
   - Independent environment variable dedicated exclusively to signing session bearer tokens.
   - Bearer token payload schema:
     ```json
     {
       "iss": "https://marketing.addp.vn",
       "sub": "<username>",
       "iat": "<timestamp>",
       "exp": "<timestamp>",
       "nonce": "<16-byte-hex>",
       "scope": "admin:all"
     }
     ```
   - HMAC-SHA256 signature verification enforced via constant-time comparison `hash_equals()`.
   - All claims (`iss`, `sub`, `iat`, `exp`, `scope`) validated on every protected request.

3. **Chrome Extension Intake & Status (`SECURITY_FOLLOWUP_REQUIRED`):**
   - A `chrome-extension://` origin is explicitly acknowledged as **NOT** an authentication mechanism.
   - Current compatibility for `shop_diagnosis.php?action=sync_seller_center` is preserved with payload structural validation to prevent operational disruption.
   - Endpoint is formally categorized as `SECURITY_FOLLOWUP_REQUIRED`. API authentication is documented as not fully resolved until the follow-up Connector Token architecture is deployed.
   - Target Connector Token Architecture:
     $$\text{Authenticated User (Web)} \longrightarrow \text{Backend} \longrightarrow \text{Short-lived Connector Token} \longrightarrow \text{Chrome Extension} \longrightarrow \text{sync\_seller\_center (Token + Scope + Shop)}$$
   - Extension JavaScript will never contain master API tokens, app secrets, or `AUTH_SIGNING_KEY`.

4. **Strict CORS vs. Authentication Separation:**
   - Origin allowlisting and authentication are decoupled controls.
   - Production whitelist: `https://marketing.addp.vn`.
   - Local development origins (`localhost`, `127.0.0.1`) permitted strictly when `APP_ENV !== 'production'`.

5. **Server-Side Authentication & Client Hardening:**
   - 100% removal of client-side credential bypass logic in `src/App.jsx`.
   - Admin credential validation takes place exclusively on backend (`login.php`) using `password_hash`/`password_verify` (with `hash_equals` against environment password during migration).
   - Password hashes are never transmitted to the frontend.

6. **Production Error Information Redaction:**
   - HTTP responses in production never expose SQL connection strings, filesystem paths, tokens, raw third-party responses, or stack traces.
   - Diagnostic logging to server `error_log` sanitizes/redacts all sensitive strings before output.

7. **Scope Preservation:**
   - Financial calculations, GMV calculations, 200-order pagination, timezone handling, and data extraction logic remain behaviorally intact for **TASK 03 — DATA INTEGRITY**.

---

### 2. Environment Variables Specification

The server must configure the following environment variables (defined in `.env` or system environment):

| Variable Name | Type / Format | Purpose | Mandatory in Prod? |
| :--- | :--- | :--- | :--- |
| `APP_ENV` | `production` / `development` | Runtime environment mode | YES |
| `APP_DEBUG` | `true` / `false` | Verbose error logging toggle | YES |
| `APP_URL` | URL string | Canonical application origin | YES |
| `DB_HOST` | Hostname / IP | MySQL database server host | YES |
| `DB_PORT` | Integer (default 3306) | MySQL database server port | NO |
| `DB_NAME` | String | MySQL database name | YES |
| `DB_USER` | String | MySQL database user | YES |
| `DB_PASSWORD` | String | MySQL database password | YES |
| `ADMIN_USERNAME` | String | Super admin login username | YES |
| `ADMIN_PASSWORD_HASH` | Bcrypt / Argon2 hash | Hashed administrative password | RECOMMENDED |
| `ADMIN_PASSWORD` | Plaintext string | Transitional admin password | OPTIONAL |
| `AUTH_SIGNING_KEY` | 64-char Hex String | Independent HMAC token signing key | YES |
| `TIKTOK_APP_KEY` | String | TikTok Shop Partner App Key | YES |
| `TIKTOK_APP_SECRET` | String | TikTok Shop Partner App Secret | YES |
| `TIKTOK_REDIRECT_URI` | URL string | TikTok Shop OAuth Redirect URI | YES |
| `TIKTOK_ADS_APP_ID` | String | TikTok for Business Ads App ID | YES |
| `TIKTOK_ADS_SECRET` | String | TikTok for Business Ads Secret | YES |
| `TIKTOK_ADS_REDIRECT_URI` | URL string | TikTok Ads OAuth Redirect URI | YES |
| `GEMINI_API_KEY` | String | Google Gemini Generative AI Key | OPTIONAL |

---

### 3. File Modification Matrix

| File Path | Action | Scope of Changes |
| :--- | :--- | :--- |
| `.gitignore` | MODIFY | Ignore `.env` and `.env.*` while preserving `.env.example` |
| `.htaccess` | MODIFY | Forward `Authorization` header through FastCGI/PHP-FPM |
| `.env.example` | NEW | Template file with placeholders only |
| `public/api/config.php` | NEW | Fail-closed environment loader |
| `public/api/auth_guard.php` | NEW | Centralized CORS, HMAC engine, route guard, error redaction |
| `public/api/db.php` | MODIFY | Integrate `config.php`, enable SSL verification, sanitize errors |
| `public/api/tiktok_client.php` | MODIFY | Enable `CURLOPT_SSL_VERIFYPEER = true`, `CURLOPT_SSL_VERIFYHOST = 2` |
| `public/api/login.php` | MODIFY | Server-side auth, `password_verify`, HMAC signed token issuance |
| `public/api/campaigns.php` | MODIFY | Enforce `requireAuth()`, CORS, error redaction |
| `public/api/sync.php` | MODIFY | Enforce `requireAuth()`, CORS, error redaction |
| `public/api/rules.php` | MODIFY | Enforce `requireAuth()`, CORS, error redaction |
| `public/api/shop_diagnosis.php` | MODIFY | Enforce `requireAuth()` on dashboard actions, retain `sync_seller_center` compatibility with `SECURITY_FOLLOWUP_REQUIRED` note |
| `public/api/gemini_analyze.php` | MODIFY | Enforce `requireAuth()`, enable SSL verification, sanitize errors |
| `public/api/creatives_data.php` | MODIFY | Enforce `requireAuth()`, CORS |
| `public/api/download_extension.php` | MODIFY | Enforce `requireAuth()` |
| `public/api/oauth.php` | MODIFY | Enforce `requireAuth()` on disconnect, enable SSL verification, CSRF state validation |
| `public/api/oauth_ads.php` | MODIFY | Enforce `requireAuth()` on disconnect, enable SSL verification, CSRF state validation |
| `src/App.jsx` | MODIFY | Attach `Authorization: Bearer` to `apiRequest`, auto-logout on 401, remove client-side hardcoded credential bypass |
| `tools/debug/*` | MOVE | Move 12 diagnostic/test scripts out of webroot `public/api/` |

---

### 4. Safe Production Deployment Sequence

```
1. PREPARATION & BACKUP
   └── Verify local backups in backups/ (source code zip + SQL schema + data dump)

2. SERVER CONFIGURATION
   └── Create .env on hosting server with production secrets
   └── Generate unique AUTH_SIGNING_KEY: bin2hex(random_bytes(32))

3. SERVER VERIFICATION
   └── Verify PHP parses .env and required keys exist

4. CODE DEPLOYMENT
   └── Build frontend with `npm run build`
   └── Package release archive without tools/debug/ scripts
   └── Upload and extract to server webroot

5. SMOKE TESTING
   ├── Test unauthenticated request to /api/campaigns.php -> Must return 401 Unauthorized
   ├── Test admin login -> Must return valid signed Bearer token
   ├── Test dashboard with valid token -> Must load campaigns, rules, diagnosis with 200 OK
   ├── Test Chrome Extension sync -> Must succeed
   └── Test TikTok OAuth redirect reachability -> Must be accessible

6. CREDENTIAL ROTATION
   ├── Rotate database user password on cPanel -> Update DB_PASSWORD in .env
   ├── Rotate admin password -> Update ADMIN_PASSWORD_HASH in .env
   ├── Rotate TikTok App Secret in Partner Center -> Update TIKTOK_APP_SECRET in .env
   └── Rotate TikTok Ads Secret in Business Center -> Update TIKTOK_ADS_SECRET in .env

7. LOG MONITORING
   └── Review server error_log for any runtime exceptions
```

---

### 5. Remaining Security Risks & Follow-Up Checklist

Critical production attack surfaces addressed in TASK 02, with Extension ingestion authentication remaining `SECURITY_FOLLOWUP_REQUIRED`.

- **`SECURITY_FOLLOWUP_REQUIRED: Extension Ingestion`**: Endpoint `shop_diagnosis.php?action=sync_seller_center` currently accepts seller center payload data without short-lived connector token verification. Implementing the web-to-extension connector token mechanism is scheduled for the subsequent security milestone.
- **Auto-DDL Runtime Overhead**: `initializeDatabase()` in `db.php` still executes DDL checks on request lifecycle. Migration to dedicated CLI deployment runner is recommended in architectural stabilization.
