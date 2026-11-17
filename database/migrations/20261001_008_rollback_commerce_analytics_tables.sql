-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Migration: 20261001_008_rollback_commerce_analytics_tables.sql
-- Description: Reverts tables created by Migration 008 (HF1.5 Analytics Tables):
--              1. Drops commerce_analytics_sync_runs
--              2. Drops commerce_product_analytics
--              3. Drops commerce_video_analytics
--              4. Drops commerce_live_sessions
--              5. Drops commerce_shop_analytics_daily
-- Target: HF1.5 Phase 1B Rollback
-- Safety: Non-destructive to HF1.2, HF1.3, HF1.4 core tables
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `commerce_analytics_sync_runs`;
DROP TABLE IF EXISTS `commerce_product_analytics`;
DROP TABLE IF EXISTS `commerce_video_analytics`;
DROP TABLE IF EXISTS `commerce_live_sessions`;
DROP TABLE IF EXISTS `commerce_shop_analytics_daily`;

SET FOREIGN_KEY_CHECKS = 1;
