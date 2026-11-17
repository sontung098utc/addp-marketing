-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261001_006_upgrade_commerce_sync_runs.sql
-- Description: Upgrades commerce_sync_runs to support multi-domain ingestion (HF1.3):
--              1. Adds source_domain column (DEFAULT 'order') to segregate Order, RMA, and Fulfillment runs
--              2. Modifies sync_type to VARCHAR(64) to support multi-domain sync modes without ENUM restriction
--              3. Expands current_page_token and last_page_token to VARCHAR(1024) to prevent cursor overflow
-- Target: HF1.3 Phase 1B / Phase 1C Ingestion Resilience
-- Safety: 100% backward-compatible with HF1.2 Core Orders Engine (zero breakage)
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add source_domain column if it does not already exist
-- Defaults to 'order' so all existing HF1.2 code and historical runs remain seamlessly categorized
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'source_domain';

SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_sync_runs` ADD COLUMN `source_domain` VARCHAR(64) NOT NULL DEFAULT \'order\' AFTER `shop_id`, ADD KEY `idx_shop_domain` (`shop_id`, `source_domain`)', 
    'SELECT "source_domain already exists"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 2. Modify sync_type to VARCHAR(64) to allow multi-domain sync types
ALTER TABLE `commerce_sync_runs` 
    MODIFY COLUMN `sync_type` VARCHAR(64) NOT NULL DEFAULT 'INITIAL_BACKFILL';

-- 3. Expand cursor page tokens to VARCHAR(1024) to safely accommodate deep pagination tokens
ALTER TABLE `commerce_sync_runs` 
    MODIFY COLUMN `current_page_token` VARCHAR(1024) NULL DEFAULT NULL COMMENT 'Cursor token currently being processed in loop',
    MODIFY COLUMN `last_page_token` VARCHAR(1024) NULL DEFAULT NULL COMMENT 'Committed checkpoint token (resume_page_token)';

SET FOREIGN_KEY_CHECKS = 1;
