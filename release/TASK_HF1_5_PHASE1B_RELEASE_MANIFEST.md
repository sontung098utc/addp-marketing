# HF1.5 PHASE 1B PRODUCTION RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | `task_hf1_5_phase1b_release_20261001_113544.zip` |
| **Package SHA-256** | `a73721a23607072aec4086b382f7eefc5e205a4d884c983a6c850f767603a794` |
| **Package Size** | `311130 B` |
| **Built Timestamp** | `2026-10-01T04:35:44.952Z` |
| **Target Milestone** | HF1.5 Phase 1B Analytics & Dashboard Engine |
| **Release Status** | **LOCAL/STAGING READY** (Production Deployment = 0, Production DB Changes = 0) |

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
| `public/api/config.php` | 9069 | `80bfe2d9ba2ba12106a93e3bf7de240ec608d655f8206db9bacdcade6ecadd8b` |
| `public/api/tiktok_client.php` | 31318 | `bf921b721ecc0e3d17e91051f54ee0397a39d64db6268df3c2100f019ebb53cc` |
| `public/api/commerce_sync_service.php` | 29110 | `99affdfb4e30e7e0c13a76d7575a8eb66d2d3483cb65311f9b9ceb6a2b3234b0` |
| `public/api/commerce_aftersales_service.php` | 40074 | `b4c311af548a23abf618deade5f6219f6e57ab06c6c99eeddeede3f40525e7d4` |
| `public/api/commerce_loss_engine.php` | 21975 | `1b80a37c81dd1c9b8156d42be3da14c6eae5dc460957e7ccff5e60be7c0f57e1` |
| `public/api/commerce_finance_service.php` | 28381 | `fabd5f5057ca5fe44a1c38978835a0a501e8d2f1be55bdf35383b7a8974d8087` |
| `public/api/commerce_analytics_service.php` | 27391 | `3a581cbd9cf90a17d2672ddfcda8df9dfef42f53f232b255c05bda1a65525df8` |
| `public/api/commerce_dashboard.php` | 27774 | `476828c827d855d9a16303cebfa65f94c98fae03fdffc16283fc87715987a577` |
| `src/CommerceDashboardView.jsx` | 96883 | `97e0bf69b4733377d7969e09782bf484846948c3127087eeaf290e1565374112` |
| `src/App.jsx` | 510872 | `6cefdfd26fad27a8d9a5e9695e516fc1caee4799a186c54d8fe8e150bedb7eab` |
| `dist/index.html` | 1723 | `90955e3a453192f025089143e547b88725143cd42fc00c2d5acbc13e6303c6f5` |
| `dist/assets/index-CtBh9uFZ.js` | 661024 | `345ac5d9944e9693b451f1a2cec268e1a80783c31aaf21ddc9f562a6689b4332` |
| `dist/assets/index-DuDEHqtr.css` | 15483 | `bf640359c9d328ab7f4786abd496861fcbab5209e126133828f848dce5fa1eec` |

## Historical Rollback References

| Version | Package File | SHA-256 Checksum |
| :--- | :--- | :--- |
| Phase A | `task02b_phaseA_release_20260923_230000.zip` | `7B98895FE9E0F2B04E07B40A391942A8F965BC8B180A56C44EB7F96328A131F3` |
| HF1.1.2 | `task02b_hf1.1.2_release_20260924_181418.zip` | `50e181045b6db760923c8a958cf1fe3f8a002bc56b02005470d057140e90be90` |
| HF1.2 Phase 1B | `task_hf1_2_phase1b_release_20260929_114025.zip` | `6534328fbc7f6e7c2dea16ff5c93ae90ac4a5068c7d78eac307215256779a6c3` |
| HF1.3 Phase 1B | `task_hf1_3_phase1b_release_20261001_095119.zip` | `c31c98c7b3f77833baa64dff106c724cf5cbdfdc2eca6123868fb0868b6d953c` |
| HF1.4 Phase 1B | `task_hf1_4_phase1b_release_20261001_102927.zip` | `d10d145e4d471f8b66b3ab2bd130325ee9b3a2f4504babe62477fbf04715195a` |
