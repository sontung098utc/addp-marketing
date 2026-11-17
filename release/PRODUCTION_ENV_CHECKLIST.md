# PRODUCTION ENVIRONMENT CONFIGURATION CHECKLIST
**System:** ADDP Commerce Intelligence (`marketing.addp.vn`)  
**Target Webroot:** `/home/addp/domains/marketing.addp.vn/public_html/`  
**Target Environment File:** `/home/addp/domains/marketing.addp.vn/.env` (or webroot `.env`)  
**Classification:** Confidential Production Checklist (Names only, zero values)

---

## 1. Environment Variables Specification Table

| Variable Name | Classification | Required in Prod? | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `APP_ENV` | **REQUIRED** | Yes | Must be set to `production`. Triggers fail-closed security mode. |
| `APP_DEBUG` | **REQUIRED** | Yes | Must be set to `false`. Suppresses all verbose error output. |
| `APP_URL` | **REQUIRED** | Yes | Set to `https://marketing.addp.vn`. Validates token `iss` claim. |
| `DB_HOST` | **REQUIRED** | Yes | MySQL host (typically `localhost` on cPanel/DirectAdmin). |
| `DB_PORT` | **OPTIONAL** | No | MySQL port (defaults to `3306` if omitted). |
| `DB_NAME` | **REQUIRED** | Yes | Target database name (`addp_marketing`). |
| `DB_USER` | **REQUIRED** | Yes | Target database user name. |
| `DB_PASSWORD` | **REQUIRED** | Yes | Target database user password. |
| `ADMIN_USERNAME` | **REQUIRED** | Yes | Administrative username for login authentication. |
| `ADMIN_PASSWORD_HASH` | **REQUIRED (PREFERRED)** | Yes* | Bcrypt or Argon2 password hash. Preferred over plaintext. |
| `ADMIN_PASSWORD` | **TRANSITIONAL** | No* | Plaintext password fallback for transitional migration only. Not required if `ADMIN_PASSWORD_HASH` is set. |
| `AUTH_SIGNING_KEY` | **REQUIRED** | Yes | Independent 64-character hex key (256-bit entropy) for HMAC-SHA256 Bearer tokens. |
| `TIKTOK_APP_KEY` | **REQUIRED** | Yes | TikTok Shop Partner App Key for Open API calls. |
| `TIKTOK_APP_SECRET` | **REQUIRED** | Yes | TikTok Shop Partner App Secret for token exchange & webhook verification. |
| `TIKTOK_REDIRECT_URI` | **REQUIRED** | Yes | OAuth callback URI (`https://marketing.addp.vn/api/oauth.php`). |
| `TIKTOK_ADS_APP_ID` | **REQUIRED** | Yes | TikTok Ads Marketing API App ID. |
| `TIKTOK_ADS_SECRET` | **REQUIRED** | Yes | TikTok Ads Marketing API Secret. |
| `TIKTOK_ADS_REDIRECT_URI` | **REQUIRED** | Yes | TikTok Ads OAuth callback URI (`https://marketing.addp.vn/api/oauth_ads.php`). |
| `GEMINI_API_KEY` | **OPTIONAL** | No | Google Generative Language API Key for AI report generation. |

*\*Note: Either `ADMIN_PASSWORD_HASH` (preferred) or `ADMIN_PASSWORD` (transitional) must be provided. If `ADMIN_PASSWORD_HASH` is present, `ADMIN_PASSWORD` is completely ignored.*

---

## 2. Generating Safe Secrets on Production

### A. Dedicated Auth Signing Key (`AUTH_SIGNING_KEY`):
Run via SSH or local PHP CLI:
```bash
php -r "echo bin2hex(random_bytes(32)) . PHP_EOL;"
```
*(Produces a 64-character hexadecimal string with 256 bits of cryptographic entropy)*

### B. Admin Password Hash (`ADMIN_PASSWORD_HASH`):
Generate using PHP standard Bcrypt:
```bash
php -r "echo password_hash('YOUR_CHOSEN_ADMIN_PASSWORD', PASSWORD_BCRYPT) . PHP_EOL;"
```
Copy the resulting `$2y$...` hash into `ADMIN_PASSWORD_HASH` in `.env`.
