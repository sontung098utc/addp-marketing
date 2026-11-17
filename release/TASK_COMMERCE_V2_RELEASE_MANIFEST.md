# ADDP COMMERCE INTELLIGENCE V2 — CONSOLIDATED RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | `task_commerce_v2_consolidated_release_20261003_085809.zip` |
| **Package SHA-256** | `896bbbd9bb5ef2f5f0140bfd1150c2a2ae02b65ca64bdd33f494c07b70e939eb` |
| **Package Size** | `388525 B` |
| **Built Timestamp** | `2026-10-03T01:58:09.710Z` |
| **Target Milestones** | **HF1.2, HF1.3, HF1.4, HF1.5 (Consolidated Commerce V2)** |
| **Release Status** | **LOCAL READY — PENDING PRODUCT OWNER MANUAL DEPLOYMENT** |
| **Zero Production Touch** | Local workstation only (Zero SSH, Zero production DB alteration) |

---

## Packaged Files & Checksums

| File Path | Size (B) | SHA-256 Checksum |
| :--- | :---: | :--- |
| `database/migrations/20261001_005_create_commerce_aftersales_and_events.sql` | 11293 | `489375bb40381e9c5e3569f062006836e983680fb57136ae92a26f10f4bef6b4` |
| `database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql` | 1292 | `eba473703ff1a3c79598746a6e6183a1560bd352e8dbdd57cd06bad3d1b69f93` |
| `database/migrations/20261001_006_upgrade_commerce_sync_runs.sql` | 2149 | `a4a00b2c8c27cfd0a90fd810e0a3ad8d0526a9e5de0f57a304ad3b6048e4ea37` |
| `database/migrations/20261001_006_rollback_commerce_sync_runs.sql` | 1536 | `34e8a3ec60f0d1fef35736dae5717d836cb4283060dff77fe8f67d82ad5dbc39` |
| `database/migrations/20261001_007_create_commerce_finance_tables.sql` | 5005 | `ebd6dfd8eb132a18be4f171d175740e93ab918c4234cddd57ffe8858a879c5c1` |
| `database/migrations/20261001_007_rollback_commerce_finance_tables.sql` | 731 | `17e6821d3fa42f2fcf8a0f36262db256f95c4c15582aad7695e6b04a70ffb13f` |
| `database/migrations/20261001_008_create_commerce_analytics_tables.sql` | 9776 | `673acfe002e9b75b666a27be2d01d423d922a3b74b21a6bbfb6b46476ae6281f` |
| `database/migrations/20261001_008_rollback_commerce_analytics_tables.sql` | 1040 | `e5a0e7a19e0999cef84798b8491c2d4c6bf9605bfe3f612e82ed4497f01a5f0a` |
| `database/migrations/20261002_009_create_commerce_customer_foundation.sql` | 4495 | `9f6782850748c7bed557be41c46eb3375d459364c0908de1e3b5ab4d71803f59` |
| `database/migrations/20261002_009_rollback_commerce_customer_foundation.sql` | 520 | `0053a8d57c91a0aa7583c82074df823f76c5f4f7205eae2b5fe318c5e29206c5` |
| `public/api/config.php` | 9073 | `b891d285723a4c89e2891e8b75764456a8987fb9bc1dd64069e42c562c3dce48` |
| `public/api/tiktok_client.php` | 33523 | `e58bef0dde774909cec95f02bede5fe54a8b778170df04bcc4164e0933f10875` |
| `public/api/commerce_sync_service.php` | 29110 | `99affdfb4e30e7e0c13a76d7575a8eb66d2d3483cb65311f9b9ceb6a2b3234b0` |
| `public/api/commerce_aftersales_service.php` | 42485 | `b946fdf1fb1c320e18ef471b6f40c2579106f7a82edc0624cde222f3037abb0c` |
| `public/api/commerce_loss_engine.php` | 24239 | `cbcdf2fc27b32f49f7418bdaa3305490da5ea8fab186dbdae6a45d21c4ab6932` |
| `public/api/commerce_finance_service.php` | 43278 | `1f3d52bd3dc07389c936f282fe9467c235713839488293f1a98b6c5ee7f205be` |
| `public/api/commerce_analytics_service.php` | 54820 | `3a7e3706387b1172e690a02dee505ba0182ecd7638e8864e610a36c6c77b5aeb` |
| `public/api/commerce_customer_service.php` | 9758 | `f601b63ad0e533f0f73bcd5c015dcdc247a3bf51e3d7a8cd069d1eeb3e4749a0` |
| `public/api/commerce_ads_service.php` | 12256 | `bb8515b62118cc05615dd2139a959eab1804f9ba02b1eb52ff1716095c8ca395` |
| `public/api/commerce_dashboard.php` | 51336 | `7aff741202b46c5e2d7ef7e988ca81eecdf7ea0c0812c9ef612bff10040529c9` |
| `tools/preflight_schema_audit.php` | 14141 | `260202902777f2eef6d51f923fb773917b1b9a45bdcac37c99c0897eed24302e` |
| `tools/runtime_validation_toolkit.php` | 16465 | `5ce3a49e4ae1c19760724f3d68bc1aba397f01e07daa3015e2f184a788fce9a2` |
| `tools/verify_php_syntax.cjs` | 5410 | `213e1a1425b614c5098ad794397d57117a462c1a320cfe7e86d7113c76910d3b` |
| `tools/test_v2_01_management_experience.cjs` | 17317 | `b50928259372b559de35c3a51f9707cbf46debe1b6ebab0fc49891eb8e705e23` |
| `tools/test_v2_01_1_hotfix.cjs` | 25150 | `96dbc1784909b22ffdf8ff91bb8f5c10bcaf6015c25fdc49db985d7cece76e6b` |
| `tools/test_v2_01_2_acceptance.cjs` | 20714 | `20f1a60daab1736e33dc970b6df86db0a03c2c56dd0d78d2e0eafca1bf0f61c6` |
| `src/CommerceDashboardView.jsx` | 173131 | `47faa4a989b20a158a39130e615e5ec17a69559986077e8ff99bac766530f032` |
| `src/App.jsx` | 511461 | `4cefd8b176ccc26d2951d7759316bc434e177fd953819ac9bba410ca0fffcc7d` |
| `dist/index.html` | 1723 | `ff1cdcb0b43929386bd2c9a5d61b865d80805096f61006225a4e3d22e460e0f8` |
| `PRODUCTION_DEPLOYMENT_RUNBOOK.md` | 12624 | `2c421e7b5e76b4baa57eba573bfc502d7416f62c08ae6840bbde828bcdb451ea` |
| `dist/assets/index-DOMXRJfe.js` | 709761 | `4c970dd244ab636eea23529762626e8e787efa7e157ab0d3c7e054bc0c26e9fd` |
| `dist/assets/index-DuDEHqtr.css` | 15483 | `bf640359c9d328ab7f4786abd496861fcbab5209e126133828f848dce5fa1eec` |

---

## Historical Rollback References

| Version | Package File | SHA-256 Checksum |
| :--- | :--- | :--- |
| Phase A | `task02b_phaseA_release_20260923_230000.zip` | `7B98895FE9E0F2B04E07B40A391942A8F965BC8B180A56C44EB7F96328A131F3` |
| HF1.1.2 | `task02b_hf1.1.2_release_20260924_181418.zip` | `50e181045b6db760923c8a958cf1fe3f8a002bc56b02005470d057140e90be90` |
| HF1.2 Phase 1B | `task_hf1_2_phase1b_release_20260929_114025.zip` | `6534328fbc7f6e7c2dea16ff5c93ae90ac4a5068c7d78eac307215256779a6c3` |
| HF1.3 Phase 1B | `task_hf1_3_phase1b_release_20261001_095119.zip` | `c31c98c7b3f77833baa64dff106c724cf5cbdfdc2eca6123868fb0868b6d953c` |
| HF1.4 Phase 1B | `task_hf1_4_phase1b_release_20261001_102927.zip` | `d10d145e4d471f8b66b3ab2bd130325ee9b3a2f4504babe62477fbf04715195a` |
| HF1.5 Phase 1B | `task_hf1_5_phase1b_release_20261001_113544.zip` | `a73721a23607072aec4086b382f7eefc5e205a4d884c983a6c850f767603a794` |

---

## Instructions for Product Owner
1. Review `PRODUCTION_DEPLOYMENT_RUNBOOK.md` included in package.
2. Run `php tools/preflight_schema_audit.php` on production prior to running any SQL migration.
3. Select and apply only migrations flagged as `NOT_APPLIED`.
4. Deploy web files and run `php tools/runtime_validation_toolkit.php --check=all`.
