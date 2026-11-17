-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261001_007_create_commerce_finance_tables.sql
-- Description: Creates financial statement and transaction tables for HF1.4:
--              1. commerce_finance_statements (Settlement statement headers from /finance/202309/statements)
--              2. commerce_finance_transactions (SKU & fee breakdown from /finance/202501/orders/{order_id}/statement_transactions)
-- Target: HF1.4 Phase 1B Finance & Settlement Engine
-- Safety: Additive only, IF NOT EXISTS guards, zero impact on existing tables
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table: commerce_finance_statements
-- Stores financial settlement statements issued by TikTok Shop
CREATE TABLE IF NOT EXISTS `commerce_finance_statements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'Origin platform',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop identifier',
    `statement_id` VARCHAR(128) NOT NULL COMMENT 'TikTok statement unique identifier',
    `statement_time` DATETIME NOT NULL COMMENT 'Date/time statement was generated/closed',
    `total_settlement_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total net payout disbursed to seller bank account',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND' COMMENT 'Currency ISO code',
    `payment_status` VARCHAR(64) NOT NULL DEFAULT 'PAID' COMMENT 'Payment status: PAID, PROCESSING, FAILED, PENDING',
    `payment_time` DATETIME NULL DEFAULT NULL COMMENT 'Date/time funds were disbursed',
    `raw_data_hash` VARCHAR(64) NULL DEFAULT NULL COMMENT 'SHA-256 hash of original sanitized payload',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_statement` (`platform`, `shop_id`, `statement_id`),
    KEY `idx_shop_stmt_time` (`shop_id`, `statement_time`),
    KEY `idx_payment_status` (`payment_status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Financial settlement statements from TikTok Shop Finance API';

-- 2. Table: commerce_finance_transactions
-- Stores order-level and SKU-level financial transactions, platform fees, affiliate commissions, and adjustments
CREATE TABLE IF NOT EXISTS `commerce_finance_transactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `statement_id` VARCHAR(128) NULL DEFAULT NULL COMMENT 'Associated statement ID if settled',
    `platform_order_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Order ID',
    `platform_line_item_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Order line item / SKU allocation ID',
    `sku_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Seller / Platform SKU ID',
    `transaction_type` VARCHAR(64) NOT NULL DEFAULT 'ORDER' COMMENT 'ORDER, REFUND, ADJUSTMENT, FEE, LOGISTICS',
    `revenue_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Order gross value before deductions',
    `platform_commission` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'TikTok Shop commission fee deducted',
    `affiliate_commission` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Creator / KOC commission deducted',
    `payment_fee` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Payment gateway/processing fee deducted',
    `shipping_fee_subsidy` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Shipping fee subsidy credited by platform',
    `actual_shipping_fee` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Actual carrier shipping cost charged',
    `adjustment_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Post-settlement fee adjustments or compensation',
    `net_settlement_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Net cash settled for this transaction',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `transaction_time` DATETIME NOT NULL COMMENT 'Time when transaction occurred',
    `settlement_time` DATETIME NULL DEFAULT NULL COMMENT 'Time when transaction was finalized in statement',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_tx` (`platform`, `shop_id`, `platform_order_id`, `platform_line_item_id`, `transaction_type`),
    KEY `idx_shop_order` (`shop_id`, `platform_order_id`),
    KEY `idx_shop_stmt` (`shop_id`, `statement_id`),
    KEY `idx_tx_time` (`transaction_time`),
    KEY `idx_settlement_time` (`settlement_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Order and SKU financial statement transactions and fee breakdown';

SET FOREIGN_KEY_CHECKS = 1;
