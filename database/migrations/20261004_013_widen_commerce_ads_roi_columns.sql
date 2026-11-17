-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261004_013_widen_commerce_ads_roi_columns.sql
-- Description: Widens ROI columns from DECIMAL(7,4) to DECIMAL(15,4) across
--              all V2 GMV Max advertising tables to prevent numeric overflow
--              when official API reports ROI > 999.
-- Target: Sprint V2-02.1 GMV Max Production Hardening
-- Safety: Additive / widening only, zero data loss, supports ROI up to 99,999,999,999.9999
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table: commerce_ads_campaign_daily
-- Widen roi, api_roi, derived_roi
ALTER TABLE `commerce_ads_campaign_daily` 
    MODIFY COLUMN `roi` DECIMAL(15,4) NULL DEFAULT NULL COMMENT 'Blended/API ROI (widened from DECIMAL(7,4) to support ROI > 999)',
    MODIFY COLUMN `api_roi` DECIMAL(15,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API (widened)',
    MODIFY COLUMN `derived_roi` DECIMAL(15,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / spend for discrepancy audit (widened)';

-- 2. Table: commerce_ads_product_daily
-- Widen api_roi, derived_roi
ALTER TABLE `commerce_ads_product_daily`
    MODIFY COLUMN `api_roi` DECIMAL(15,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API (widened)',
    MODIFY COLUMN `derived_roi` DECIMAL(15,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / cost for audit verification (widened)';

-- 3. Table: commerce_ads_creative_daily
-- Widen api_roi, derived_roi
ALTER TABLE `commerce_ads_creative_daily`
    MODIFY COLUMN `api_roi` DECIMAL(15,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API (widened)',
    MODIFY COLUMN `derived_roi` DECIMAL(15,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / cost for audit verification (widened)';

-- 4. Table: commerce_ads_live_daily
-- Widen api_roi, derived_roi
ALTER TABLE `commerce_ads_live_daily`
    MODIFY COLUMN `api_roi` DECIMAL(15,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API (widened)',
    MODIFY COLUMN `derived_roi` DECIMAL(15,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / cost for audit verification (widened)';
