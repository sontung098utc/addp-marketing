# ADDP COMMERCE INTELLIGENCE V2 — SPRINT V2-02A RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | `task_v2_02a_campaign_gmv_max_release_20261003_154837.zip` |
| **Package SHA-256** | `7b89a450b51a95c1915d699bb5c7e620d6ea0500de1b4fa572985d56bff0c7d2` |
| **Package Size** | `247.542 B` |
| **Total Files** | `12` |
| **Built Timestamp** | `2026-10-03T08:48:37.886Z` |
| **Milestone** | **Sprint V2-02A: Campaign GMV Max Intelligence** |
| **Work Mode** | **LOCAL READY — PENDING PRODUCT OWNER DEPLOYMENT** |
| **Integrity Level** | Full POSIX Forward Slashes (Automated Central Directory Verified) |

---

## Packaged Files & SHA-256 Checksums

| File Path | Size (B) | SHA-256 Checksum |
| :--- | :---: | :--- |
| `database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql` | 3547 | `c454419bc93ec65807a53e45984a0fd934edd95a93cdad675b159b26135bcd93` |
| `database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql` | 474 | `aaa56794b732432c231abb692b4f82f29548545db7cafbb79d980d9c8d067c91` |
| `public/api/commerce_ads_ingestion_service.php` | 15986 | `4b060662fa801401b2ff044cb9ca3bc89ce05c63b3e0fb40e704485f2439feb1` |
| `public/api/commerce_ads_service.php` | 44953 | `98fa2fb3b17e13e9b374579ef427fee55c29ac60f1465e3071f567c3543a6445` |
| `public/api/commerce_analytics_service.php` | 54808 | `cdf80007bc62e4bcc70525091da8e0484701be3fd7c12b944fc78f4d545bc0b3` |
| `public/api/commerce_dashboard.php` | 52626 | `9b2dd642dfa335b77d830b73ede766eadbaf5f54946b3982213a2b2a81b90364` |
| `src/CommerceDashboardView.jsx` | 218877 | `f487874916dbd8eae4b51014019d249fee7269773d22ddcf010141c7c408d619` |
| `dist/index.html` | 1723 | `a1102a0a5a31bc9b8509f3d47824dd4c1abca10c21a87180896701db826b0268` |
| `tools/test_v2_02a_campaign_gmv_max.cjs` | 25316 | `934d50c0472c335375db9afc0490e60e84d4d59c52ff63d546e236e74c76020d` |
| `tools/test_v2_01_2_acceptance.cjs` | 20714 | `20f1a60daab1736e33dc970b6df86db0a03c2c56dd0d78d2e0eafca1bf0f61c6` |
| `dist/assets/index-DuDEHqtr.css` | 15483 | `bf640359c9d328ab7f4786abd496861fcbab5209e126133828f848dce5fa1eec` |
| `dist/assets/index-Dzlf6Eoc.js` | 738798 | `f522f5458efbd795ce28d91a68ae6236f2e9b346063a52ed13d16086bcb0227a` |

---

## Deployment Instructions for Product Owner

1. Copy `task_v2_02a_campaign_gmv_max_release_20261003_154837.zip` to production server webroot or staging directory.
2. Unzip into target directory: `unzip -q task_v2_02a_campaign_gmv_max_release_20261003_154837.zip`.
3. Apply versioned migration:
   ```bash
   mysql -u $DB_USER -p $DB_NAME < database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql
   ```
4. Run validation test suites:
   ```bash
   node tools/test_v2_02a_campaign_gmv_max.cjs
   node tools/test_v2_01_2_acceptance.cjs
   ```
5. Verify in browser under tab **Quảng Cáo (GMV Max)**.
