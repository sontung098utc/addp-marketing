-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE ROLLBACK
-- Rollback Migration: 20261002_009_rollback_commerce_customer_foundation.sql
-- Target: Drops tables created by 20261002_009_create_commerce_customer_foundation.sql
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `commerce_customer_profiles`;
DROP TABLE IF EXISTS `commerce_order_recipients`;

SET FOREIGN_KEY_CHECKS = 1;
