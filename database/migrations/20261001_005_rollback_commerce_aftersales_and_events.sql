-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Migration: 20261001_005_rollback_commerce_aftersales_and_events.sql
-- Description: Drops 4 tables created in Migration 005.
-- 
-- IMPORTANT (CORRECTION 5 - PRODUCTION SAFE ROLLBACK POLICY):
-- - LOCAL/STAGING ONLY: Destructive schema rollback may be tested on local/staging before real data.
-- - PRODUCTION AFTER SHADOW INGESTION: DEFAULT rollback MUST BE NON-DESTRUCTIVE:
--   1. Set FEATURE_ENABLE_AFTERSALES_V2 = false
--   2. Set FEATURE_ENABLE_FULFILLMENT_EVENTS_V2 = false
--   3. Set FEATURE_ENABLE_LOSS_ENGINE_V2 = false
--   4. Stop aftersales/fulfillment sync cron jobs
--   5. Rollback application code if necessary
--   6. PRESERVE commerce_aftersales, commerce_aftersales_items,
--      commerce_order_events, and commerce_loss_ledger tables.
--   NEVER execute DROP TABLE on production without explicit written PO approval!
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `commerce_loss_ledger`;
DROP TABLE IF EXISTS `commerce_aftersales_items`;
DROP TABLE IF EXISTS `commerce_aftersales`;
DROP TABLE IF EXISTS `commerce_order_events`;

SET FOREIGN_KEY_CHECKS = 1;
