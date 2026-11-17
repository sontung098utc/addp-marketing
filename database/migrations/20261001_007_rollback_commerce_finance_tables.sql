-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Migration: 20261001_007_rollback_commerce_finance_tables.sql
-- Description: Reverts tables created by Migration 007 (HF1.4 Finance Tables):
--              1. Drops commerce_finance_transactions
--              2. Drops commerce_finance_statements
-- Target: HF1.4 Phase 1B Rollback
-- Safety: Non-destructive to HF1.2 / HF1.3 core tables
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `commerce_finance_transactions`;
DROP TABLE IF EXISTS `commerce_finance_statements`;

SET FOREIGN_KEY_CHECKS = 1;
