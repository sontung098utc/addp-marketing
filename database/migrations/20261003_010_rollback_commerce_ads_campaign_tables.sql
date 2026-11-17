-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE ROLLBACK SCRIPT
-- Migration: 20261003_010_rollback_commerce_ads_campaign_tables.sql
-- Description: Drops normalized daily campaign fact table
-- Target: Sprint V2-02A Rollback
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `commerce_ads_campaign_daily`;

SET FOREIGN_KEY_CHECKS = 1;
