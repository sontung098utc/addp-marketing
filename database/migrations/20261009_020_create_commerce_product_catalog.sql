-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261009_020_create_commerce_product_catalog.sql
-- Description: Creates authoritative product & SKU catalog cache table:
--              1. commerce_product_catalog (Product & SKU Metadata, Latest Images & Cache Versioning)
-- Target: Product Tab Image & Metadata Synchronization V2
-- Safety: Additive only, IF NOT EXISTS guards, zero foreign key checks toggles,
--         zero alteration to legacy tables (commerce_orders, commerce_order_items).
-- ====================================================================

SET NAMES utf8mb4;

-- --------------------------------------------------------------------
-- 1. Table: commerce_product_catalog
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_product_catalog` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop ID on platform',
    `product_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Shop product catalog ID',
    `sku_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'SKU identifier (or empty string for product root)',
    `product_name` VARCHAR(512) NOT NULL COMMENT 'Authoritative product title from TikTok Product API',
    `sku_name` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Authoritative variant name from TikTok SKU specification',
    `product_image` VARCHAR(1024) NULL DEFAULT NULL COMMENT 'Product main cover image URL',
    `sku_image` VARCHAR(1024) NULL DEFAULT NULL COMMENT 'Specific SKU image URL (only if distinct and provided by TikTok)',
    `display_image_url` VARCHAR(1024) NULL DEFAULT NULL COMMENT 'Authoritative image to render: sku_image if available, else product_image',
    `has_sku_image` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if SKU has its own photo, 0 if inherited from product cover',
    `image_source` VARCHAR(32) NOT NULL DEFAULT 'TIKTOK_PRODUCT_API' COMMENT 'TIKTOK_PRODUCT_API, TIKTOK_ORDER_ITEM, MANUAL, PLACEHOLDER',
    `image_hash` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Deterministic hash of image URL / content for stable cache control',
    `image_version` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Incrementing version counter when image changes',
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVATE' COMMENT 'Product status: ACTIVATE, INACTIVATE, DELETED',
    `price` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Catalog price',
    `synced_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when fetched from TikTok Product API',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_prod_sku` (`platform`, `shop_id`, `product_id`, `sku_id`),
    KEY `idx_shop_prod` (`shop_id`, `product_id`),
    KEY `idx_shop_status` (`shop_id`, `status`),
    KEY `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Authoritative Product & SKU metadata and image catalog cache';
