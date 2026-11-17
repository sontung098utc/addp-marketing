-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE ROLLBACK
-- Rollback for: 20261005_015_widen_aftersales_reason_and_role.sql
-- Description: Reverts widened columns on commerce_aftersales back to Migration 005 dimensions:
--              1. reason_code back to VARCHAR(64)
--              2. reason_category back to VARCHAR(64)
--              3. return_role back to VARCHAR(32)
-- Target: Sprint V2-04.1 Production Acceptance Rollback
-- Safety: Reverts schema safely; note that strings longer than reverted lengths may truncate
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `commerce_aftersales`
    MODIFY COLUMN `reason_code` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Standardized machine-readable return/refund reason code',
    MODIFY COLUMN `reason_category` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Normalized category: LOGISTICS, QUALITY, BUYER_DECISION, OUT_OF_STOCK',
    MODIFY COLUMN `return_role` VARCHAR(32) NULL DEFAULT NULL COMMENT 'Party initiating return: BUYER, PLATFORM, SELLER';
