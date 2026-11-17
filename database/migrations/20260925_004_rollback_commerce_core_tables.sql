-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE ROLLBACK MIGRATION
-- Migration: 20260925_004_rollback_commerce_core_tables.sql
-- Description: Drops 4 commerce_* tables created in migration 004.
-- Target: HF1.2 Phase 1B Rollback Runbook
-- Safety: Drops ONLY commerce_* tables. Does NOT touch legacy tables.
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `commerce_raw_observations`;
DROP TABLE IF EXISTS `commerce_order_items`;
DROP TABLE IF EXISTS `commerce_orders`;
DROP TABLE IF EXISTS `commerce_sync_runs`;

SET FOREIGN_KEY_CHECKS = 1;
