-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Rollback for: 20261004_012_create_commerce_ads_intelligence_tables.sql
-- Target: Sprint V2-02 GMV Max Advertising Intelligence
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `commerce_ads_live_daily`;
DROP TABLE IF EXISTS `commerce_ads_creative_daily`;
DROP TABLE IF EXISTS `commerce_ads_product_daily`;

SET FOREIGN_KEY_CHECKS = 1;
