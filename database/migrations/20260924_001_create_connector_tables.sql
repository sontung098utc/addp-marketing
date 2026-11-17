-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20260924_001_create_connector_tables.sql
-- Description: Creates tables for Extension Connector Authentication
--              1. tiktok_connector_pairings (single-use pairing codes)
--              2. tiktok_connector_sessions (server-side connector session state)
-- Applied: Task 02B Phase 2
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table: tiktok_connector_pairings
-- Stores cryptographically hashed, single-use, 5-minute pairing credentials.
-- Plaintext pairing secrets are NEVER stored in the database.
CREATE TABLE IF NOT EXISTS `tiktok_connector_pairings` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `pairing_hash` varchar(64) NOT NULL,
    `shop_id` varchar(100) NOT NULL,
    `expires_at` bigint(20) NOT NULL,
    `redeemed_at` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_pairing_hash` (`pairing_hash`),
    KEY `idx_shop_exp` (`shop_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: tiktok_connector_sessions
-- Stores active server-side connector sessions for real-time revocation,
-- lineage tracking, and token JTI verification.
CREATE TABLE IF NOT EXISTS `tiktok_connector_sessions` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `connector_id` varchar(64) NOT NULL,
    `shop_id` varchar(100) NOT NULL,
    `token_jti_hash` varchar(64) NOT NULL,
    `status` varchar(20) NOT NULL DEFAULT 'active',
    `expires_at` bigint(20) NOT NULL,
    `last_used_at` timestamp NULL DEFAULT NULL,
    `revoked_at` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_connector_id` (`connector_id`),
    KEY `idx_shop_status` (`shop_id`, `status`),
    KEY `idx_token_jti` (`token_jti_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
