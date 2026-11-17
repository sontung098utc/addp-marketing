# TASK 02B — CHROME EXTENSION CONNECTOR AUTHENTICATION
## Phase 2: Local Implementation & Security Verification Report

> **Classification:** STRICTLY CONFIDENTIAL — PRODUCTION SECURITY REPORT  
> **Project:** ADDP Commerce Intelligence  
> **Production Target:** `https://marketing.addp.vn`  
> **Implementation Scope:** LOCAL IMPLEMENTATION ONLY (`c:\AdsTiktok`)  
> **Date:** September 2026  
> **Deployment Status:** NO PRODUCTION DEPLOYMENT WAS PERFORMED.

---

## 1. Changed Files

1. **`public/api/config.php` [MODIFIED]:**
   - Added `CONNECTOR_TOKEN_TTL` (24 hours default, server-configurable).
   - Added `PAIRING_TOKEN_TTL` (5 minutes default).
   - Added `CONNECTOR_ALLOW_UNAUTHENTICATED = true` (Phase A dual-mode transition fallback flag).
2. **`public/api/auth_guard.php` [MODIFIED]:**
   - Added `generatePairingToken(string $shopId, int $ttl)` (issues 5-min pairing token with `scope: connector:pair`).
   - Added `generateConnectorToken(string $shopId, string $connectorId, int $ttl)` (issues 24h connector token with `scope: seller_center:sync` and JTI hash).
   - Added `requireConnectorAuth(?string $expectedShopId = null, ?PDO $pdo = null)` (strictly enforces Header Bearer auth, timing-safe HMAC signature verification, scope `seller_center:sync`, server-side session active status, unrevoked status, server-side expiration, and JTI hash matching).
   - Enhanced `sanitizeErrorResponse()` regex to redact secrets formatted with colons (`password: secret`) in addition to equals signs (`password=secret`).
3. **`public/api/shop_diagnosis.php` [MODIFIED]:**
   - Hardened `action === 'sync_seller_center'` with:
     - 256 KB fail-fast payload size check (`HTTP 413 Payload Too Large`).
     - JSON structure validation (`HTTP 400 Bad Request`).
     - Bearer connector authentication (`requireConnectorAuth`) with strict shop binding.
     - Phase A transitional anonymous compatibility fallback (`SECURITY_TRANSITION_ONLY`).
     - 30-second cooldown rate limiting based on `last_synced_seller_center_at` (`HTTP 429 Too Many Requests`).
     - Strict numerical range and SES score boundaries (`0.0 <= ses_score <= 5.0`).
     - Preserved legitimate historical snapshot write (`INSERT INTO tiktok_seller_center_snapshots`).
     - Strictly bound shop configuration update to `WHERE shop_id = ?` (permanently eliminated vulnerable `OR id = ?`).
4. **`public/extension/manifest.json` [MODIFIED]:**
   - Bumped extension version to `1.1.0`.
   - Registered `content_scripts` matching `https://marketing.addp.vn/*`, `http://localhost/*`, `http://127.0.0.1/*`.
5. **`public/extension/content_script.js` [MODIFIED]:**
   - Added window message bridge on ADDP application domains to receive `ADDP_PAIRING_REQUEST`, redeem pairing code via `/api/connector_token.php?action=redeem_pairing`, save connector token to `chrome.storage.local`, and post `ADDP_PAIRING_SUCCESS` back to the page without exposing the 24-hour token to the DOM.
   - Preserved Seller Center DOM extraction listener.
6. **`public/extension/popup.html` [MODIFIED]:**
   - Added connection status badge (`🟢 Đã kết nối (~Xh)`, `🔴 Chưa kết nối`, `🟡 Hết hạn`).
   - Added manual pairing input section with "Xác Nhận Ghép Nối" button.
   - Added "Ngắt kết nối" revocation button.
7. **`public/extension/popup.js` [MODIFIED]:**
   - Reads connector token exclusively from `chrome.storage.local`.
   - Attaches `Authorization: Bearer <connector_token>` header on sync requests.
   - Implemented manual pairing redemption and server-side revocation on disconnect.
   - Handles HTTP 401, 413, and 429 responses with user-friendly actionable feedback.
8. **`src/ShopDiagnosisView.jsx` [MODIFIED]:**
   - Added extension pairing state hooks and event listeners.
   - Added "🔗 Kích Hoạt & Ghép Nối Tiện Ích" card in extension modal.
   - Added "⚡ Kết Nối 1-Click / Cấp Mã Ghép Nối" button and manual pairing code copy display.
9. **`public/tiktok_audit_extension.zip` & `dist/tiktok_audit_extension.zip` [REBUILT]:**
   - Re-packaged with extension v1.1.0 assets.

---

## 2. New Files

1. **`public/api/connector_token.php` [NEW]:**
   - Gateway endpoint implementing:
     - `action=create_pairing`: Protected by `requireAuth('admin:all')`. Generates 5-minute single-use pairing credential and stores SHA-256 hash in `tiktok_connector_pairings`.
     - `action=redeem_pairing`: Public endpoint. Atomically consumes single-use pairing code, generates 24-hour connector token (`scope: seller_center:sync`), and establishes active server session in `tiktok_connector_sessions`.
     - `action=revoke`: Invalidates connector session server-side (`status = 'revoked'`, `revoked_at = NOW()`).
     - `action=status`: Health check probe for active connector token.
2. **`tools/test_task02b_security.cjs` [NEW]:**
   - Comprehensive automated test runner covering all 22 required security scenarios.
3. **`tools/scan_secrets_task02b.cjs` [NEW]:**
   - Repository-wide secret scanner checking for credentials, passwords, and tokens.

---

## 3. Migration Files

- **`database/migrations/20260924_001_create_connector_tables.sql` [NEW]:**
  - Contains versioned DDL statements for `tiktok_connector_pairings` and `tiktok_connector_sessions`.
  - In accordance with PO correction 1, **no tables were added to `initializeDatabase()`**. Legacy auto-DDL remains completely untouched.

---

## 4. Final DB Schema Additions

### Table 1: `tiktok_connector_pairings`
```sql
CREATE TABLE IF NOT EXISTS `tiktok_connector_pairings` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `pairing_hash` varchar(64) NOT NULL,
    `shop_id` varchar(100) NOT NULL,
    `expires_at` bigint(20) NOT NULL,
    `redeemed_at` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_pairing_hash` (`pairing_hash`),
    KEY `idx_shop_exp` (`shop_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Table 2: `tiktok_connector_sessions`
```sql
CREATE TABLE IF NOT EXISTS `tiktok_connector_sessions` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `connector_id` varchar(64) NOT NULL,
    `shop_id` varchar(100) NOT NULL,
    `token_jti_hash` varchar(64) NOT NULL,
    `status` varchar(20) NOT NULL DEFAULT 'active',
    `expires_at` bigint(20) NOT NULL,
    `last_used_at` timestamp NULL DEFAULT NULL,
    `revoked_at` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_connector_id` (`connector_id`),
    KEY `idx_shop_status` (`shop_id`, `status`),
    KEY `idx_token_jti` (`token_jti_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 5. Pairing Flow Implemented

```
Admin Authenticated on marketing.addp.vn (Session: Bearer Admin Token)
                   │
                   ▼
Clicks "⚡ Kết Nối 1-Click / Cấp Mã Ghép Nối" in ShopDiagnosisView.jsx
                   │
                   ▼
POST /api/connector_token.php?action=create_pairing
- Validates requireAuth('admin:all')
- Rate limits pairing generation (max 10 / 60s)
- Generates 5-minute single-use pairing credential
- Inserts SHA-256 hash into tiktok_connector_pairings
                   │
                   ├──────────────────────────────────┐
                   ▼ [Primary Channel]                ▼ [Fallback Channel]
Webpage posts window.message              Web modal displays manual code
-> content_script.js captures message     -> Staff pastes PAIR-XXXX-YYYY into popup
                   │                                  │
                   └──────────────────────────────────┘
                                   │
                                   ▼
          Extension calls: POST /api/connector_token.php?action=redeem_pairing
          - Validates pairing hash & expiration (< 5 min)
          - Atomically burns pairing: UPDATE ... SET redeemed_at = NOW()
          - Creates server session in `tiktok_connector_sessions`
          - Issues 24-hour scoped Connector Bearer Token
                                   │
                                   ▼
          Extension stores token in chrome.storage.local
          (24-Hour token NEVER touched webpage DOM / window object)
```

---

## 6. Connector Token Implementation

- **Cryptographic Format:** `base64url(payload).hmac_sha256_hex` signed via `AUTH_SIGNING_KEY`.
- **Payload Claims:**
  - `iss`: `APP_URL` (`https://marketing.addp.vn`)
  - `sub`: `'connector:seller_center'`
  - `scope`: `'seller_center:sync'`
  - `shop_id`: Bound shop ID (e.g. `'7495657895504611503'`)
  - `connector_id`: Ephemeral connector ID (`'ext_<hex>'`)
  - `jti`: 32-hex random string
  - `iat`: Timestamp
  - `exp`: Timestamp (`iat + 86400`)
- **Isolation Guarantee:**
  - Standard admin APIs enforce `requireAuth('admin:all')` and reject connector tokens with `403 Forbidden`.
  - Connector endpoints enforce `requireConnectorAuth()` and reject admin tokens with `403 Forbidden`.

---

## 7. Server-Side Revocation Implementation

In accordance with PO correction 3, stateless HMAC validation is backed by real server-side session checks in `requireConnectorAuth()`:
1. Queries `tiktok_connector_sessions` by `connector_id`.
2. Validates `status === 'active'`.
3. Validates `revoked_at IS NULL`.
4. Validates `expires_at > time()`.
5. Validates `shop_id === claims['shop_id']`.
6. Compares `token_jti_hash` timing-safely via `hash_equals()`.
7. Updates `last_used_at = NOW()`.
8. User clicking "Ngắt kết nối" calls `action=revoke` $\rightarrow$ marks `status = 'revoked'`, `revoked_at = NOW()`, immediately invalidating the credential server-side across all network clients.

---

## 8. Shop-Binding Implementation

1. The server exclusively derives authorized tenant ownership from the verified token claim:
   `$tokenShopId = (string)($connectorClaims['shop_id'] ?? '');`
2. If the payload contains `shop_id`, it must strictly equal `$tokenShopId`; otherwise terminates immediately with `HTTP 403 Forbidden (SHOP_MISMATCH)`.
3. The database update query was permanently refactored from:
   `WHERE shop_id = ? OR id = ?`  *(VULNERABLE LEGACY PATTERN — PERMANENTLY REMOVED)*
   To:
   `WHERE shop_id = ?`  *(STRICTLY BOUND TO AUTHORIZED TENANT)*

---

## 9. Rate-Limit Implementation

1. **Pre-Validation Request Cap:** Immediate fail-fast check: if `CONTENT_LENGTH > 262,144` bytes (256 KB), immediately returns `HTTP 413 Payload Too Large` without parsing JSON or hitting the database.
2. **Business Cooldown Throttling:**
   - Evaluates `last_synced_seller_center_at` from `tiktok_config`.
   - If `(time() - strtotime(last_synced_seller_center_at)) < 30`:
     Returns `HTTP 429 Too Many Requests` (`COOLDOWN_ACTIVE`).
   - In accordance with PO mandate, `last_synced_seller_center_at` represents a **successful business sync** and is **ONLY updated at the very end of a valid transaction commit**. Malformed payloads or unauthorized requests never modify this timestamp.

---

## 10. Phase A Compatibility Behavior

To allow safe deployment without breaking production staff before extension v1.1 is installed on their browsers:
- If a sync request presents an `Authorization: Bearer <token>` header:
  The backend strictly validates the connector token and server session. The transaction commits as authenticated (`is_authenticated: true`).
- If a sync request lacks an `Authorization` header:
  The backend checks `CONNECTOR_ALLOW_UNAUTHENTICATED`:
  - When `true` (Phase A): Permitted with a dedicated transitional log:
    `[SECURITY_TRANSITION_ONLY] Unauthenticated Seller Center sync accepted under Phase A for shop: {shop_id}`
    The response explicitly notes `is_authenticated: false`.
  - When `false` (Phase C): Immediately rejected with `HTTP 401 Unauthorized` (`MISSING_TOKEN`).

---

## 11. Exact Phase C Removal Point

The Phase A compatibility code is located in [`public/api/shop_diagnosis.php`](file:///c:/AdsTiktok/public/api/shop_diagnosis.php) lines 152 to 164:

```php
        } else {
            // SECURITY_TRANSITION_ONLY: Phase A unauthenticated compatibility fallback. Removed in Phase C lock-down.
            if (!defined('CONNECTOR_ALLOW_UNAUTHENTICATED') || !CONNECTOR_ALLOW_UNAUTHENTICATED) {
                http_response_code(401);
                echo json_encode(['success' => false, 'code' => 'MISSING_TOKEN', 'message' => 'Yêu cầu khóa xác thực tiện ích. Vui lòng kết nối lại tiện ích.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Phase A transition fallback
            $targetShopId = trim((string)($body['shop_id'] ?? $shopId));
            $isAuthenticated = false;
            error_log("[SECURITY_TRANSITION_ONLY] Unauthenticated Seller Center sync accepted under Phase A for shop: " . $targetShopId);
        }
```
**Phase C Cutover:** Set `CONNECTOR_ALLOW_UNAUTHENTICATED=false` in `.env`, or delete the `else` fallback branch completely to enforce strict fail-closed authentication.

---

## 12. Security Test Matrix Results (22 / 22 PASS)

Executed via automated test suite `node tools/test_task02b_security.cjs`:

| ID | Test Scenario | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ST-01** | Pairing creation requires admin auth | Anonymous denied, admin allowed | PASS | **PASS** |
| **ST-02** | Pairing credential expiration (5 min TTL) | Expired token rejected | PASS | **PASS** |
| **ST-03** | Pairing single-use atomic redemption | 2nd redemption rejected | PASS | **PASS** |
| **ST-04** | Pairing stored as hash only | Zero plaintext secrets in storage | PASS | **PASS** |
| **ST-05** | Valid 24h connector token verification | Signature and claims verified | PASS | **PASS** |
| **ST-06** | Tampered HMAC signature rejected | Verification returns null | PASS | **PASS** |
| **ST-07** | Expired connector token rejected (> 24h) | Verification returns null | PASS | **PASS** |
| **ST-08** | Wrong scope rejected on connector auth | `connector:pair` rejected for sync | PASS | **PASS** |
| **ST-09** | Cross-shop payload mismatch rejected | `403 SHOP_MISMATCH` | PASS | **PASS** |
| **ST-10** | Server-side revoked connector rejected | `401 CONNECTOR_REVOKED` | PASS | **PASS** |
| **ST-11** | Missing server-side session rejected | `401 CONNECTOR_SESSION_NOT_FOUND` | PASS | **PASS** |
| **ST-12** | Expired server-side session rejected | `401 CONNECTOR_SESSION_EXPIRED` | PASS | **PASS** |
| **ST-13** | Admin token rejected as connector token | `403 FORBIDDEN_SCOPE` | PASS | **PASS** |
| **ST-14** | Connector token rejected on admin API | `403 FORBIDDEN` | PASS | **PASS** |
| **ST-15** | Query string auth rejected | Null header token | PASS | **PASS** |
| **ST-16** | Oversized payload rejected (> 256 KB) | `413 Payload Too Large` | PASS | **PASS** |
| **ST-17** | Malformed JSON payload rejected | `400 Bad Request` | PASS | **PASS** |
| **ST-18** | Boundary & Range Validation | Invalid SES/GMV rejected | PASS | **PASS** |
| **ST-19** | Business cooldown throttling (< 30s) | `429 Too Many Requests` | PASS | **PASS** |
| **ST-20** | Database exception sanitized | Password redacted from error | PASS | **PASS** |
| **ST-21** | Disconnect immediately revokes server session | Session marked revoked, re-pair OK | PASS | **PASS** |
| **ST-22** | Phase A dual-mode allows anonymous sync | Transitional log emitted | PASS | **PASS** |

**Summary:** `TEST_SCENARIOS_TOTAL = 22, TEST_SCENARIOS_PASSED = 22, TEST_SCENARIOS_FAILED = 0.`

---

## 13. PHP Syntax Results

Executed via `node tools/verify_php_syntax.cjs`:
- `PHP_FILES_CHECKED = 16`
- `PHP_SYNTAX_PASS = 16`
- `PHP_SYNTAX_FAIL = 0`
- `FAILING_FILES = NONE`

---

## 14. Frontend Build Result

Executed via `npm run build`:
- Tool: `vite v8.1.4`
- Transformed: `1,775 modules`
- Bundles:
  - `dist/index.html` (1.72 kB)
  - `dist/assets/index-DuDEHqtr.css` (15.48 kB)
  - `dist/assets/index-QtBG0u44.js` (594.93 kB)
- Exit Code: `0 (Clean Build, 0 Errors)`

---

## 15. Extension Package Hashes

Verified via `Get-FileHash`:

| Artifact | SHA-256 Hash |
| :--- | :--- |
| `public/tiktok_audit_extension.zip` | `408F54E730C3E88C19462A6B297BA79B60E561C3E7C6CDA72B56296F91884D0B` |
| `dist/tiktok_audit_extension.zip` | `408F54E730C3E88C19462A6B297BA79B60E561C3E7C6CDA72B56296F91884D0B` |
| `public/extension/manifest.json` | `5267EB6EB7C5E81DC12061D0B6E72E879E0D28DF637D118472C37108678A3319` |
| `dist/extension/manifest.json` | `5267EB6EB7C5E81DC12061D0B6E72E879E0D28DF637D118472C37108678A3319` |
| `public/extension/content_script.js` | `BCD004216BBCB0EC672125387CE975A771155A0FF6339F2DD09523F14AAB1B4A` |
| `dist/extension/content_script.js` | `BCD004216BBCB0EC672125387CE975A771155A0FF6339F2DD09523F14AAB1B4A` |
| `public/extension/popup.html` | `6BEE9B52DF6276D5CA82B14E2633C5BCB0E900C980C2CEE5888770E5AAD1422E` |
| `dist/extension/popup.html` | `6BEE9B52DF6276D5CA82B14E2633C5BCB0E900C980C2CEE5888770E5AAD1422E` |
| `public/extension/popup.js` | `882375BEC16E4DD312C2FA90686A82908A00F16313119F69DCFC7E7DE960F5B6` |
| `dist/extension/popup.js` | `882375BEC16E4DD312C2FA90686A82908A00F16313119F69DCFC7E7DE960F5B6` |

---

## 16. Secret Scan

Executed via `node tools/scan_secrets_task02b.cjs`:
- `FILES_SCANNED = 50`
- `SECRETS_FOUND = 0`
- `STATUS = PASS`

---

## 17. Known Limitations

1. **Extension Distribution:** In unpacked mode, staff must either extract the new `tiktok_audit_extension.zip` or click "Reload" on the unpacked extension in `chrome://extensions`.
2. **Historical Financial Data Semantics:** In accordance with PO correction 4, Task 02B does not alter existing GMV formulas, order sync caps (200 orders), or snapshot overwrite behavior. These belong strictly to Task 03.

---

## 18. Production Deployment Requirements

1. **Run Database Migration on Production Server:**
   ```bash
   mysql -u addp_marketing -p addp_marketing < database/migrations/20260924_001_create_connector_tables.sql
   ```
2. **Deploy Phase A Artifacts:**
   Extract release package containing updated `public/api/` and `dist/`.
3. **Smoke Test:**
   Verify admin login $\rightarrow$ generate pairing $\rightarrow$ pair extension $\rightarrow$ sync from Seller Center $\rightarrow$ confirm authenticated sync in logs.
4. **Transition Monitoring:**
   Monitor server error log for deprecation messages. Ensure all staff extensions update to v1.1.0.
5. **Phase C Lock-down Gate:**
   Once verified, set `CONNECTOR_ALLOW_UNAUTHENTICATED=false` in `.env` to permanently close anonymous sync.

---

## 19. Rollback Procedure

1. If any issue arises during Phase A, restore `public/api/shop_diagnosis.php`, `auth_guard.php`, and `config.php` from `backups/task02_completion_backup_20260923.zip`.
2. The newly created tables (`tiktok_connector_pairings`, `tiktok_connector_sessions`) are completely additive and do not require rollback or schema drops.

---

## 20. Explicit Confirmation

**NO PRODUCTION DEPLOYMENT WAS PERFORMED.**  
All implementation, migrations, builds, and test executions took place strictly within the local workspace (`c:\AdsTiktok`). Production server `marketing.addp.vn` remains completely untouched.
