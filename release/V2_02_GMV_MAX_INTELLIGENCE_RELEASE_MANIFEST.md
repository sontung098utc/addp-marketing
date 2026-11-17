# ADDP COMMERCE INTELLIGENCE V2 — SPRINT V2-02 RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | `task_v2_02_gmv_max_intelligence_release_20261004_175000.zip` |
| **Package SHA-256** | `7f02a43a3f4b045b8f6dd4929a435d8e746454db77b8c19ad0c1806353cc0180` |
| **Package Size** | `293.635 B` |
| **Total Files** | `18` |
| **Built Timestamp** | `2026-10-04T10:50:00.483Z` |
| **Milestone** | **Sprint V2-02: GMV Max Advertising Intelligence** |
| **Scope** | Campaign, Product/SPU, Video/Creative, LIVE GMV Max & Multi-Grain Reconciliation |
| **Work Mode** | **LOCAL READY — PENDING PRODUCT OWNER DEPLOYMENT** |
| **Integrity Level** | Full POSIX Forward Slashes (Automated Central Directory Binary Verified) |

---

## Packaged Files & SHA-256 Checksums

| File Path | Size (B) | SHA-256 Checksum |
| :--- | :---: | :--- |
| `database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql` | 3547 | `c454419bc93ec65807a53e45984a0fd934edd95a93cdad675b159b26135bcd93` |
| `database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql` | 474 | `aaa56794b732432c231abb692b4f82f29548545db7cafbb79d980d9c8d067c91` |
| `database/migrations/20261004_011_add_commerce_ads_campaign_api_lineage_columns.sql` | 5304 | `56c4fac9254cd65608f5e4a190a9112a522cfd5c9d9d4c0b238938e2026a6331` |
| `database/migrations/20261004_011_rollback_commerce_ads_campaign_api_lineage_columns.sql` | 2574 | `fc83655442ae17e387c8fb3a811fc4dfa7a0c007e125433b76940b9ae5d41551` |
| `database/migrations/20261004_012_create_commerce_ads_intelligence_tables.sql` | 10191 | `fad9c5cf93df23d3bf49c0abe0b3c7094af6301b583d9871113f33e04cf04da7` |
| `database/migrations/20261004_012_rollback_commerce_ads_intelligence_tables.sql` | 564 | `cd39a83bef7f7a0afb3f9af28e5f9250b3d681432a13dceb5940edc719627c7a` |
| `public/api/tiktok_gmv_max_api_client.php` | 21916 | `cf502441a550f1b7c3fc562123f39f022ec629ca84e35b88811254285c01aeaa` |
| `public/api/commerce_ads_ingestion_service.php` | 54897 | `63e8d3ee2794d9599ffae97236da87a384919a1c4feb71276d6200d1c5632421` |
| `public/api/commerce_ads_service.php` | 91812 | `a9070adab89cf8abcbc5a0417b146505d092a7f00166b3b9fb5ec732511f43b0` |
| `public/api/commerce_dashboard.php` | 59211 | `3cbfc3210d8782dd1256f900a01abad4a8a376d52ddda65008e59299185a569d` |
| `src/CommerceDashboardView.jsx` | 323385 | `bc9f19cb7e4e61fc21a6d758007e9c83c6fa63a46a903fd583642c8a78d496ee` |
| `dist/index.html` | 1723 | `b9039492aac38562786b46b269fa26d3339dacdbebdfca9fbfb13c4722dc1671` |
| `tools/test_v2_02_gmv_max_intelligence.cjs` | 44605 | `e1208ae4f8c14f53410cb1bea040fd649cbeb1986e1972275c5f525adb668238` |
| `tools/test_v2_02a_2_official_api_ingestion.cjs` | 26480 | `fb14c6703f095da19c51527feb99d395634451a62b77fcdc6fe6cd18bfbdf35b` |
| `tools/test_v2_02a_campaign_gmv_max.cjs` | 25608 | `58ece08ef689cc3395464f4a84cb8f4ab4a5b65f84cfa78eb6033fb56207b6c1` |
| `tools/test_v2_01_2_acceptance.cjs` | 20714 | `20f1a60daab1736e33dc970b6df86db0a03c2c56dd0d78d2e0eafca1bf0f61c6` |
| `dist/assets/index-Bi1O7zOH.js` | 807381 | `b4eddf9e667380e7228546cb3cfd7631bf9c267d1fd232e87c02af5a553fb73a` |
| `dist/assets/index-DuDEHqtr.css` | 15483 | `bf640359c9d328ab7f4786abd496861fcbab5209e126133828f848dce5fa1eec` |

---

## Deployment Instructions for Product Owner

1. Transfer `task_v2_02_gmv_max_intelligence_release_20261004_175000.zip` to production server webroot or deployment directory.
2. Unzip with overwrite confirmation:
   ```bash
   unzip -o task_v2_02_gmv_max_intelligence_release_20261004_175000.zip
   ```
3. Apply database migration(s):
   ```bash
   # Apply Migration 012 (Creates product, creative, live intelligence tables)
   mysql -u $DB_USER -p $DB_NAME < database/migrations/20261004_012_create_commerce_ads_intelligence_tables.sql
   ```
4. Run automated acceptance suites directly on server:
   ```bash
   node tools/test_v2_02_gmv_max_intelligence.cjs
   node tools/test_v2_02a_2_official_api_ingestion.cjs
   node tools/test_v2_02a_campaign_gmv_max.cjs
   node tools/test_v2_01_2_acceptance.cjs
   ```
5. Open browser at `https://marketing.addp.vn` and navigate to **Quảng Cáo (GMV Max)** tab to inspect:
   - **Multi-Grain Reconciliation Matrix** (Macro vs Product vs LIVE)
   - **Product SPU Breakdown** (with Verified SPU mappings)
   - **Video Creative Breakdown & Optimization Matrix** (6 opportunity patterns)
   - **LIVE Ads Breakdown** (with `SESSION_MAPPING_PENDING` badge)
