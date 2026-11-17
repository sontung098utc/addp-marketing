# HF1.3 PHASE 1B PRODUCTION RELEASE MANIFEST

| Attribute | Details |
| :--- | :--- |
| **Package File** | `task_hf1_3_phase1b_release_20261001_095119.zip` |
| **Package SHA-256** | `c31c98c7b3f77833baa64dff106c724cf5cbdfdc2eca6123868fb0868b6d953c` |
| **Package Size** | `32939 B` |
| **Built Timestamp** | `2026-10-01T02:51:19.089Z` |
| **Target Milestone** | HF1.3 Phase 1B Return, Refund & Loss Engine |
| **Release Status** | **LOCAL/STAGING READY** (Production Deployment = 0, Production DB Changes = 0) |

## Packaged Files & Checksums

| File Path | Size (B) | SHA-256 Checksum |
| :--- | :---: | :--- |
| `database/migrations/20261001_005_create_commerce_aftersales_and_events.sql` | 11293 | `489375bb40381e9c5e3569f062006836e983680fb57136ae92a26f10f4bef6b4` |
| `database/migrations/20261001_005_rollback_commerce_aftersales_and_events.sql` | 1292 | `eba473703ff1a3c79598746a6e6183a1560bd352e8dbdd57cd06bad3d1b69f93` |
| `database/migrations/20261001_006_upgrade_commerce_sync_runs.sql` | 2149 | `a4a00b2c8c27cfd0a90fd810e0a3ad8d0526a9e5de0f57a304ad3b6048e4ea37` |
| `database/migrations/20261001_006_rollback_commerce_sync_runs.sql` | 1536 | `34e8a3ec60f0d1fef35736dae5717d836cb4283060dff77fe8f67d82ad5dbc39` |
| `public/api/config.php` | 7643 | `e0a6e0bc4c22380a2c6859f8d318960054f5f999b9e005a1cbc2632d5bde75ba` |
| `public/api/tiktok_client.php` | 24044 | `2288f41b2bdbd26c5153268dc89776797a0b4db086e777123d92091687a21b57` |
| `public/api/commerce_sync_service.php` | 29110 | `99affdfb4e30e7e0c13a76d7575a8eb66d2d3483cb65311f9b9ceb6a2b3234b0` |
| `public/api/commerce_aftersales_service.php` | 40074 | `b4c311af548a23abf618deade5f6219f6e57ab06c6c99eeddeede3f40525e7d4` |
| `public/api/commerce_loss_engine.php` | 21975 | `1b80a37c81dd1c9b8156d42be3da14c6eae5dc460957e7ccff5e60be7c0f57e1` |

## Historical Rollback References

| Version | Package File | SHA-256 Checksum |
| :--- | :--- | :--- |
| Phase A | `task02b_phaseA_release_20260923_230000.zip` | `7B98895FE9E0F2B04E07B40A391942A8F965BC8B180A56C44EB7F96328A131F3` |
| HF1.1.2 | `task02b_hf1.1.2_release_20260924_181418.zip` | `50e181045b6db760923c8a958cf1fe3f8a002bc56b02005470d057140e90be90` |
| HF1.2 Phase 1B | `task_hf1_2_phase1b_release_20260929_114025.zip` | `6534328fbc7f6e7c2dea16ff5c93ae90ac4a5068c7d78eac307215256779a6c3` |
