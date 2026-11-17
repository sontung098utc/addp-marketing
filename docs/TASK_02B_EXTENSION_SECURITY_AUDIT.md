# TASK 02B — CHROME EXTENSION CONNECTOR AUTHENTICATION
## Comprehensive Security Audit & Final Architecture Specification (Revision 2 — Post PO Approval)

> **Classification:** STRICTLY CONFIDENTIAL — PRODUCTION SECURITY SPECIFICATION  
> **Project:** ADDP Commerce Intelligence  
> **Production Domain:** `https://marketing.addp.vn`  
> **Audit Status:** APPROVED ARCHITECTURE REVISION (PHASE 1B — READ-ONLY)  
> **Date:** September 2026  
> **Compliance Statement:** NO SOURCE CODE OR DATABASE WAS MODIFIED DURING THIS AUDIT REVISION.

---

## 1. Executive Summary & PO Decisions Applied

Following the initial Task 02B audit, the Product Owner (PO) formally approved the security enhancement direction with the following binding architectural decisions:

1. **Connector Token TTL:** Fixed at **24 Hours** (configurable via `CONNECTOR_TOKEN_TTL` in `config.php`, default 86,400s). 7-day tokens are strictly prohibited.
2. **Pairing Credential Separation:** To eliminate exposure of reusable 24-hour credentials to webpage DOM or arbitrary third-party JavaScript running on `marketing.addp.vn`, the system strictly separates:
   - **Ephemeral Pairing Authorization Code (`connector:pair`):** 5-minute lifespan, single-use, delivered via Content Script bridge or manual copy.
   - **Longer-Lived Connector Token (`seller_center:sync`):** 24-hour lifespan, issued directly to the extension sandbox upon redeeming the pairing code.
3. **Release-Gate Migration Sequence:** No hardcoded 48-hour timeout. Migration proceeds strictly through controlled validation gates (Phase A -> Phase B -> Verification Pass -> PO Approval -> Phase C Lock-down).
4. **Accurate Replay Threat Model:** Acknowledge that Bearer credentials can be replayed if stolen from local storage or TLS-intercepted. Mitigation is achieved via mandatory HTTPS, short 24h TTL, sandbox isolation (`chrome.storage.local`), shop/scope binding, and a 30-second cooldown window.
5. **Decoupled Cooldown State:** Cooldown throttling must not prematurely update `last_synced_seller_center_at` before a business transaction commits successfully.
6. **Strict Shop Binding:** Remove all instances of `WHERE shop_id = ? OR id = ?`. The authenticated connector identity strictly bounds all reads and writes.
7. **Idempotent Snapshot Deduplication:** Handled safely in PHP application logic (`SELECT` then `UPDATE` or `INSERT`) without requiring risky schema constraints on existing production data.

---

## 2. Replay Threat Model & Clarifications

Before defining the architecture, the threat model parameters are formally clarified:

| Question | Architectural Fact & Threat Mitigation |
| :--- | :--- |
| **1. Can the exact same connector token be reused for multiple legitimate syncs during its 24h lifetime?** | **YES.** The connector token represents a 24-hour authenticated staff session. Staff may perform multiple sync operations throughout the day (e.g. morning, afternoon, evening). |
| **2. What does `jti` protect if the token is reusable?** | `jti` (JWT ID / Nonce) provides a unique cryptographic identifier for **audit log correlation**, token lineage tracking, and enables **server-side revocation blacklisting**. It does *not* make the connector token single-use. |
| **3. Can an intercepted valid request be replayed after the 30-second cooldown?** | **YES.** If an attacker intercepts the complete HTTP request and bearer header, they could replay it after 30 seconds. However, because requests are idempotent updates of the current day's snapshot, replaying an identical payload merely refreshes the existing record without data corruption. |
| **4. Is request-level nonce/signing required?** | **NO.** Request-level asymmetric signing (e.g. AWS SigV4 or WebCrypto key pairs) adds prohibitive operational complexity for an internal Chrome Extension. Mandatory TLS 1.3 + 24h TTL + storage sandboxing provides the standard industry security posture. |
| **5. Is server-side connector session state required?** | **NO** for the 24-hour connector token (stateless HMAC verification). **YES (minimal)** for the Pairing Authorization Code: tracked in a dedicated table `tiktok_connector_pairings` with a `redeemed_at` timestamp to strictly enforce single-use redemption and prevent race conditions. |
| **6. Is token revocation required for Task 02B?** | **YES.** Client-side disconnect purges the token from `chrome.storage.local`. Server-side emergency revocation is supported via `connector_revoked_before` epoch timestamp in `tiktok_config`. |

> **Explicit Threat Modeling Statement:**  
> *"Bearer credential replay remains possible if the connector token is stolen in transit or from client disk. To mitigate this risk: TLS encryption is strictly mandatory; token TTL is limited to 24 hours; the token is stored only in chrome.storage.local (never exposed in web DOM); the token is scoped strictly to seller_center:sync and bound to shop_id; and a 30-second cooldown prevents abusive burst replay."*

---

## 3. End-to-End Architectural Workflows

```
===================================================================================================
A. ADMIN -> PAIRING CODE GENERATION
===================================================================================================
Admin logged into https://marketing.addp.vn (Session Auth: Bearer Admin Token)
    │
    ▼
User clicks "Kết Nối Tiện Ích" in ShopDiagnosisView.jsx
    │
    ▼
POST /api/connector_token.php?action=create_pairing
    - Headers: Authorization: Bearer <ADMIN_TOKEN>
    - Body: {"shop_id": "7495657895504611503"}
    │
    ▼
Backend (requireAuth('admin:all')):
    - Confirms admin session and verifies shop_id exists in tiktok_config
    - Generates 5-minute single-use Pairing Token (scope: 'connector:pair')
    - Records pairing_token hash in `tiktok_connector_pairings`
    - Returns: {"pairing_token": "...", "pairing_code": "PAIR-9A4B-2C1F", "expires_in": 300}

===================================================================================================
B. PAIRING CREDENTIAL TRANSMISSION (DUAL CHANNEL)
===================================================================================================
Channel 1 (Primary - 1-Click Seamless Bridge):
    Web App dispatches: window.postMessage({ type: 'ADDP_PAIRING_REQUEST', pairing_token, shop_id }, origin)
    │
    ▼
    content_script.js (on marketing.addp.vn/*) receives message, verifies event.origin
    │
    ▼
    content_script.js sends chrome.runtime.sendMessage() to extension background/popup

Channel 2 (Fallback - Manual Code Copy):
    Web App modal displays masked Pairing Code (e.g. PAIR-9A4B-2C1F) + "Sao Chép"
    │
    ▼
    Staff opens Extension Popup -> pastes into "Nhập mã ghép nối" -> clicks "Xác Nhận"

===================================================================================================
C. EXTENSION -> CONNECTOR CREDENTIAL REDEMPTION
===================================================================================================
Extension Popup / Runtime calls:
POST /api/connector_token.php?action=redeem_pairing
    - Body: {"pairing_token": "..."}
    │
    ▼
Backend:
    - Verifies pairing token signature via AUTH_SIGNING_KEY
    - Verifies scope === 'connector:pair'
    - Verifies expiration (iat + 300 > now)
    - Checks `tiktok_connector_pairings`: ensures NOT previously redeemed
    - Atomically marks `redeemed_at = NOW()`
    - Issues 24-Hour Connector Token:
        {
          "iss": "https://marketing.addp.vn",
          "sub": "connector:seller_center",
          "scope": "seller_center:sync",
          "shop_id": "7495657895504611503",
          "connector_id": "ext_8f1b2c3d4e5f6071",
          "iat": 1790256000,
          "exp": 1790342400,
          "nonce": "7c8e9f0123456789abcdef0123456789"
        }
    - Returns: {"success": true, "connector_token": "...", "expires_at": 1790342400, "shop_id": "..."}
    │
    ▼
Extension stores in `chrome.storage.local`:
    {"connector_token": "...", "token_expires_at": 1790342400, "shop_id": "7495657895504611503"}
    (NOTE: 24h credential NEVER touched webpage DOM or arbitrary JavaScript!)

===================================================================================================
D. CONNECTOR CREDENTIAL -> SELLER CENTER SYNC
===================================================================================================
Staff on https://seller-vn.tiktok.com clicks "🚀 Quét & Đồng Bộ"
    │
    ▼
Extension reads `connector_token` from `chrome.storage.local`
    - Checks local expiration: if (Date.now()/1000 > token_expires_at) -> prompt reconnect
    │
    ▼
POST /api/shop_diagnosis.php?action=sync_seller_center
    - Headers: Authorization: Bearer <CONNECTOR_TOKEN>
               Content-Type: application/json
    - Body: JSON metrics payload (max 256 KB)
    │
    ▼
Backend (requireConnectorAuth()):
    1. Header extraction: Only accepts Authorization: Bearer. Reject query string.
    2. HMAC Verification: Timing-safe hash_equals() against AUTH_SIGNING_KEY.
    3. Expiration Check: Reject if exp < time().
    4. Scope Check: MUST equal 'seller_center:sync'. Reject 'admin:all'.
    5. Server-Side Revocation Check: Reject if token iat < connector_revoked_before.
    6. Shop Binding: Extracts $tokenShopId = claims['shop_id']. If payload has shop_id,
       must strictly match $tokenShopId, otherwise 403 SHOP_MISMATCH.
    7. Payload Length Check: Reject > 256 KB immediately with 413.
    8. Cooldown Throttling: If last_synced_seller_center_at is within 30s, reject with 429.
    9. Schema Validation: Positive numbers, valid ranges (0.0 <= ses_score <= 5.0).
    10. Idempotent Snapshot Write: SELECT today's snapshot; UPDATE if exists, else INSERT.
    11. Store Update: UPDATE tiktok_config ... WHERE shop_id = :token_shop_id AND sets
        last_synced_seller_center_at = NOW().
    │
    ▼
Backend returns: {"success": true, "message": "Đồng bộ thành công!", "synced_at": "..."}
Extension Popup displays: "✅ Đồng bộ dữ liệu thành công!"
```

---

## 4. Endpoint Specifications

### 4.1. `POST /api/connector_token.php?action=create_pairing`
* **Method:** `POST`
* **Auth Type:** Admin Bearer Token (`Authorization: Bearer <admin_token>`)
* **Request Body:**
  ```json
  {
    "shop_id": "7495657895504611503"
  }
  ```
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "pairing_token": "eyJhbGciOiJIUzI1NiJ9....hmac",
    "pairing_code": "PAIR-9A4B-2C1F",
    "expires_in": 300,
    "shop_id": "7495657895504611503"
  }
  ```
* **Token Type Issued:** Ephemeral Pairing Token (HMAC-SHA256)
* **Scope Issued:** `connector:pair`
* **Status Codes:**
  - `200 OK`: Pairing token created successfully.
  - `400 Bad Request`: Missing or invalid `shop_id`.
  - `401 Unauthorized`: Missing or invalid admin Bearer token.
  - `403 Forbidden`: Admin account does not own the requested `shop_id`.
  - `500 Internal Server Error`: Server configuration failure.

---

### 4.2. `POST /api/connector_token.php?action=redeem_pairing`
* **Method:** `POST`
* **Auth Type:** Public endpoint with Signed Body Credential
* **Request Body:**
  ```json
  {
    "pairing_token": "eyJhbGciOiJIUzI1NiJ9....hmac"
  }
  ```
  *(Or `{"pairing_code": "PAIR-9A4B-2C1F"}`)*
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "connector_token": "eyJhbGciOiJIUzI1NiJ9....hmac",
    "expires_at": 1790342400,
    "shop_id": "7495657895504611503",
    "shop_name": "Dược Phẩm ADDP"
  }
  ```
* **Token Type Issued:** Long-Lived Connector Token (HMAC-SHA256, 24 Hours)
* **Scope Issued:** `seller_center:sync`
* **Status Codes:**
  - `200 OK`: Pairing redeemed; connector token issued.
  - `400 Bad Request`: Missing pairing credential.
  - `401 Unauthorized`: Invalid signature, expired token (> 5 min), or malformed payload.
  - `403 Forbidden`: Scope mismatch (token was not issued for `connector:pair`).
  - `409 Conflict`: Pairing token was already redeemed (single-use burned).
  - `500 Internal Server Error`: Server token generation failure.

---

### 4.3. `POST /api/connector_token.php?action=revoke`
* **Method:** `POST`
* **Auth Type:** Admin Bearer Token (`Authorization: Bearer <admin_token>`)
* **Request Body:**
  ```json
  {
    "shop_id": "7495657895504611503"
  }
  ```
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "message": "Đã thu hồi tất cả khóa kết nối của gian hàng.",
    "revoked_at": "2026-09-24 10:00:00"
  }
  ```
* **Status Codes:** `200 OK`, `401 Unauthorized`, `500 Internal Server Error`.

---

### 4.4. `POST /api/shop_diagnosis.php?action=sync_seller_center`
* **Method:** `POST`
* **Auth Type:** Connector Bearer Token (`Authorization: Bearer <connector_token>`)
* **Headers Required:**
  - `Authorization: Bearer <connector_token>`
  - `Content-Type: application/json`
* **Request Body:** Standard Seller Center JSON payload (max 256 KB).
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "message": "Đồng bộ dữ liệu từ TikTok Shop Seller Center thành công 100%!",
    "synced_at": "2026-09-24 10:05:00"
  }
  ```
* **Scope Required:** `seller_center:sync`
* **Status Codes:**
  - `200 OK`: Validated, snapshot deduplicated, store metrics updated.
  - `400 Bad Request`: Payload validation error (negative numbers, invalid types).
  - `401 Unauthorized`: Missing token, expired token (> 24h), invalid signature, or revoked token.
  - `403 Forbidden`: Wrong scope (e.g. admin token used) or `shop_id` mismatch.
  - `413 Payload Too Large`: Request body exceeds 262,144 bytes (256 KB).
  - `429 Too Many Requests`: 30-second cooldown active since last successful sync.
  - `500 Internal Server Error`: Database failure (sanitized message, no secret leaks).

---

## 5. Rate Limiting & Cooldown Architecture

1. **Pre-Validation Flood Guard (Fail-Fast):**
   - Check `$_SERVER['CONTENT_LENGTH']` or `strlen($raw)`. If `> 262144` bytes (256 KB), immediately return `HTTP 413 Payload Too Large` without parsing JSON or querying the database.
2. **Cooldown Isolation Principle:**
   - In `tiktok_config`, column `last_synced_seller_center_at` strictly records the timestamp of a **completed, valid business sync**.
   - Throttling check:
     ```php
     if (!empty($shopConfig['last_synced_seller_center_at'])) {
         $elapsed = time() - strtotime($shopConfig['last_synced_seller_center_at']);
         if ($elapsed < 30) {
             http_response_code(429);
             echo json_encode([
                 'success' => false,
                 'code' => 'COOLDOWN_ACTIVE',
                 'message' => 'Vui lòng chờ ' . (30 - $elapsed) . ' giây trước khi thực hiện lần đồng bộ tiếp theo.'
             ], JSON_UNESCAPED_UNICODE);
             exit;
         }
     }
     ```
   - Malformed payloads, unauthorized requests, or database errors **NEVER** update `last_synced_seller_center_at`.

---

## 6. Shop Binding & Tenant Isolation

* **Strict Trust Boundary:** The server derives the authorized shop exclusively from the cryptographic token claims:
  `$tokenShopId = (string)($tokenClaims['shop_id'] ?? '');`
* **Cross-Tenant Prevention:**
  - If the client payload includes `shop_id`:
    `if (!empty($body['shop_id']) && $body['shop_id'] !== $tokenShopId) { http_response_code(403); exit; }`
* **Elimination of Fallback Overwrite:**
  - Replace vulnerable query:
    `WHERE shop_id = ? OR id = ?`  *(DEPRECATED & REMOVED)*
  - With strictly bound query:
    `WHERE shop_id = :token_shop_id`

---

## 7. Snapshot Protection & Idempotent Deduplication

To prevent unbounded row injection without modifying existing database constraints:

```php
// Check for existing snapshot for this shop, current date, and period
$stmtCheck = $db->prepare("SELECT `id` FROM `tiktok_seller_center_snapshots` 
    WHERE `shop_id` = ? AND `snapshot_date` = CURDATE() AND `period_days` = 30 
    ORDER BY `id` DESC LIMIT 1");
$stmtCheck->execute([$tokenShopId]);
$existingSnapId = $stmtCheck->fetchColumn();

if ($existingSnapId) {
    // Idempotent update: refresh metrics on today's snapshot
    $stmtSnap = $db->prepare("UPDATE `tiktok_seller_center_snapshots` SET 
        `total_gmv` = ?, `total_orders` = ?, `live_gmv` = ?, `video_gmv` = ?, 
        `product_card_gmv` = ?, `raw_data` = ?, `synced_at` = NOW() 
        WHERE `id` = ?");
    $stmtSnap->execute([$totalGmv, $totalOrders, $liveGmv, $videoGmv, $productGmv, $sanitizedRaw, $existingSnapId]);
} else {
    // Insert new snapshot record for today
    $stmtSnap = $db->prepare("INSERT INTO `tiktok_seller_center_snapshots` 
        (`shop_id`, `snapshot_date`, `period_days`, `total_gmv`, `total_orders`, `live_gmv`, `video_gmv`, `product_card_gmv`, `raw_data`, `synced_at`)
        VALUES (?, CURDATE(), 30, ?, ?, ?, ?, ?, ?, NOW())");
    $stmtSnap->execute([$tokenShopId, $totalGmv, $totalOrders, $liveGmv, $videoGmv, $productGmv, $sanitizedRaw]);
}
```

* **Outcome:**
  - Network retries do not create duplicate rows.
  - Multiple legitimate syncs on the same day refresh today's numbers to the latest status.
  - Zero DDL migrations required on `tiktok_seller_center_snapshots`.

---

## 8. Database Schema Change Assessment

> **DATABASE CHANGE REQUIRED: YES**  
> *(1 lightweight, non-breaking operational table added in auto-DDL)*

### New Table: `tiktok_connector_pairings`
To guarantee single-use redemption of pairing codes without race conditions:
```sql
CREATE TABLE IF NOT EXISTS `tiktok_connector_pairings` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `pairing_hash` varchar(64) NOT NULL,
    `pairing_code` varchar(32) NOT NULL,
    `shop_id` varchar(100) NOT NULL,
    `expires_at` bigint(20) NOT NULL,
    `redeemed_at` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_pairing_hash` (`pairing_hash`),
    KEY `idx_code` (`pairing_code`),
    KEY `idx_shop_exp` (`shop_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
* **Impact Analysis:**
  - Additive only (`CREATE TABLE IF NOT EXISTS`).
  - Zero modifications to existing tables (`tiktok_config`, `tiktok_campaigns`, `tiktok_seller_center_snapshots`).
  - Zero risk to production uptime or historical data.

---

## 9. Extension Storage & Lifecycle Specification

* **Storage Target:** `chrome.storage.local`
* **Data Schema:**
  ```json
  {
    "connector_token": "<JWT_STRING>",
    "token_expires_at": 1790342400,
    "shop_id": "7495657895504611503",
    "shop_name": "Dược Phẩm ADDP",
    "connected_at": 1790256000
  }
  ```
* **Lifecycle Governance:**
  1. **Expiry Handling:** When popup opens, if `Date.now()/1000 > token_expires_at`, extension automatically invokes `chrome.storage.local.remove(['connector_token', 'token_expires_at'])` and displays: `"Phiên kết nối đã hết hạn (24h). Vui lòng kết nối lại."`
  2. **Disconnect Workflow:** A "Ngắt Kết Nối" button immediately executes `chrome.storage.local.clear()`, returning the extension to disconnected state.
  3. **Zero Secrets in Page DOM:** The extension communicates with Seller Center strictly via isolated content script DOM extraction, never injecting the token into Seller Center web pages.

---

## 10. Backward-Compatible Release-Gate Migration Plan

```
+---------------------------------------------------------------------------------------------------+
| PHASE A: BACKEND DUAL-MODE COMPATIBILITY DEPLOYMENT                                              |
|                                                                                                   |
| - Deploy connector_token.php, updated auth_guard.php, and updated shop_diagnosis.php.             |
| - Configuration: CONNECTOR_ALLOW_UNAUTHENTICATED=true (transitional).                             |
| - If request has Authorization: Bearer -> Strictly validate connector token (is_authenticated=1). |
| - If request is missing Authorization -> Allow conditionally with safe deprecation log:           |
|   "[DEPRECATION] Unauthenticated seller_center sync from IP {sanitized_ip} for shop {shop_id}."   |
| - ZERO SECRETS logged. Cooldown (30s) and payload size limits (256 KB) are active for all callers.|
+-------------------------------------------------+-------------------------------------------------+
                                                  │
                                                  ▼
+---------------------------------------------------------------------------------------------------+
| PHASE B: EXTENSION V1.1.0 PACKAGING & VERIFICATION                                                |
|                                                                                                   |
| - Update manifest.json (v1.1.0), popup.js, popup.html, and content_script.js.                     |
| - Rebuild public/tiktok_audit_extension.zip and dist/tiktok_audit_extension.zip.                  |
| - Update ShopDiagnosisView.jsx with "Kết Nối Tiện Ích" pairing modal.                            |
| - Admin pairs extension via 1-click bridge or manual pairing code.                                |
| - Verify authenticated sync: backend log confirms successful token validation.                    |
| - Execute Full Security Test Matrix (18 tests).                                                   |
+-------------------------------------------------+-------------------------------------------------+
                                                  │
                                                  ▼
+---------------------------------------------------------------------------------------------------+
| RELEASE GATE: PRODUCT OWNER APPROVAL                                                              |
|                                                                                                   |
| - Confirm all production extension users have updated to v1.1.0.                                  |
| - Verify 100% of incoming production syncs carry valid connector tokens.                          |
| - PO reviews verification logs and gives formal sign-off for lock-down.                           |
+-------------------------------------------------+-------------------------------------------------+
                                                  │
                                                  ▼
+---------------------------------------------------------------------------------------------------+
| PHASE C: PERMANENT FAIL-CLOSED LOCK-DOWN                                                          |
|                                                                                                   |
| - Switch CONNECTOR_ALLOW_UNAUTHENTICATED=false (or remove fallback branch completely).             |
| - Any sync request lacking a valid connector token immediately returns HTTP 401 Unauthorized.     |
| - Mark SECURITY_FOLLOWUP_REQUIRED as RESOLVED.                                                    |
+---------------------------------------------------------------------------------------------------+
```

---

## 11. Security Test Matrix (18 Test Scenarios)

| ID | Test Scenario | Request Configuration / Payload | Expected HTTP Status & Behavior | Target Component |
| :--- | :--- | :--- | :--- | :--- |
| **ST-01** | Anonymous Sync (Phase C Lock-down) | `POST /api/shop_diagnosis.php?action=sync_seller_center` without auth header | **401 Unauthorized** (`MISSING_TOKEN`) | `shop_diagnosis.php` |
| **ST-02** | Valid Connector Token | Valid 24h token with `scope: seller_center:sync` | **200 OK** (`synced_at` returned, snapshot written) | `shop_diagnosis.php` |
| **ST-03** | Expired Connector Token | Token with `exp < now()` | **401 Unauthorized** (`INVALID_TOKEN`) | `auth_guard.php` |
| **ST-04** | Invalid HMAC Signature | Tampered payload or signature part | **401 Unauthorized** (`INVALID_TOKEN`) | `auth_guard.php` |
| **ST-05** | Wrong Token Scope | Admin token (`admin:all`) or pairing token (`connector:pair`) used for sync | **403 Forbidden** (`FORBIDDEN_SCOPE`) | `auth_guard.php` |
| **ST-06** | Shop ID Mismatch | Token bound to `Shop_A`, payload specifies `shop_id: "Shop_B"` | **403 Forbidden** (`SHOP_MISMATCH`) | `shop_diagnosis.php` |
| **ST-07** | Admin Token as Connector | Admin token presented to `requireConnectorAuth()` | **403 Forbidden** (`SCOPE_MISMATCH`) | `auth_guard.php` |
| **ST-08** | Connector Token on Admin API | Connector token (`seller_center:sync`) presented to `campaigns.php` | **403 Forbidden** (`FORBIDDEN`) | `auth_guard.php` |
| **ST-09** | Query String Token Attempt | `POST ...?action=sync_seller_center&auth_token=...` | **401 Unauthorized** (Headers-only policy) | `auth_guard.php` |
| **ST-10** | Oversized Payload (> 256 KB) | Request body = 500 KB dummy JSON | **413 Payload Too Large** (Fail-fast) | `shop_diagnosis.php` |
| **ST-11** | Cooldown Enforcement | Two valid sync requests within 10 seconds | **429 Too Many Requests** (`COOLDOWN_ACTIVE`) | `shop_diagnosis.php` |
| **ST-12** | Duplicate Sync Request | Identical payload sent after 35s cooldown | **200 OK** (Idempotent update of existing snapshot) | `shop_diagnosis.php` |
| **ST-13** | Expired Pairing Credential | Pairing token older than 300 seconds redeemed | **401 Unauthorized** (`PAIRING_EXPIRED`) | `connector_token.php` |
| **ST-14** | Replayed / Reused Pairing Code | Redeeming a pairing code twice | **409 Conflict** (`PAIRING_ALREADY_REDEEMED`) | `connector_token.php` |
| **ST-15** | Malformed JSON Payload | Body = `{ invalid json ... ` | **400 Bad Request** (`INVALID_JSON`) | `shop_diagnosis.php` |
| **ST-16** | Boundary / Range Violation | `total_gmv: -100` or `ses_score: 9.5` | **400 Bad Request** (`VALIDATION_ERROR`) | `shop_diagnosis.php` |
| **ST-17** | Database Failure Simulation | PDO connection drops during write | **500 Internal Error** (Sanitized, no secrets) | `db.php` |
| **ST-18** | Extension Disconnect & Reconnect | User clicks "Ngắt kết nối", then re-pairs | Storage cleared -> 401 on sync -> New token pairs -> 200 OK | `popup.js` / storage |

---

## 12. File Modification Matrix

| File Path | Action | Description & Scope |
| :--- | :--- | :--- |
| `public/api/connector_token.php` | **[NEW]** | Dedicated endpoint for pairing code creation, redemption, and revocation |
| `public/api/auth_guard.php` | **[MODIFY]** | Add `requireConnectorAuth()`, timing-safe scope checks, and revocation validation |
| `public/api/shop_diagnosis.php` | **[MODIFY]** | Integrate connector auth, shop binding, idempotent snapshots, 30s cooldown, 256KB cap |
| `public/api/db.php` | **[MODIFY]** | Add `CREATE TABLE IF NOT EXISTS tiktok_connector_pairings` in auto-DDL |
| `public/extension/manifest.json` | **[MODIFY]** | Bump version to `1.1.0`, add content script match for `https://marketing.addp.vn/*` |
| `public/extension/content_script.js` | **[MODIFY]** | Add bridge listener for window message token pairing on app domain |
| `public/extension/popup.html` | **[MODIFY]** | Add connection status indicators, manual pairing modal, disconnect button |
| `public/extension/popup.js` | **[MODIFY]** | Add `chrome.storage.local` token management, Authorization header, cooldown UI |
| `src/ShopDiagnosisView.jsx` | **[MODIFY]** | Add 1-click connect button, manual pairing code modal, connector status badge |
| `public/tiktok_audit_extension.zip` | **[MODIFY]** | Rebuilt distribution archive for extension v1.1.0 |

---

## 13. Audit Certification

**"NO SOURCE CODE WAS MODIFIED DURING THIS AUDIT."**

This document represents the finalized technical design and audit specification approved under Phase 1B. All source code and database assets remain untouched in their verified baseline state.
