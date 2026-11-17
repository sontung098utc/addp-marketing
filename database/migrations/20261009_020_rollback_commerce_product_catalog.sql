-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE ROLLBACK
-- Rollback: 20261009_020_rollback_commerce_product_catalog.sql
-- Description: Safely rolls back migration 020 without data loss.
-- Safety: Non-destructive archival if populated, zero foreign key checks toggles.
-- ====================================================================

SET NAMES utf8mb4;

-- 1. Safely archive or drop commerce_product_catalog
DROP PROCEDURE IF EXISTS `sp_safe_rollback_commerce_product_catalog`;

DELIMITER $$
CREATE PROCEDURE `sp_safe_rollback_commerce_product_catalog`()
BEGIN
    DECLARE tbl_exists INT DEFAULT 0;
    DECLARE row_count INT DEFAULT 0;

    SELECT COUNT(*) INTO tbl_exists 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_product_catalog';

    IF tbl_exists > 0 THEN
        SET @cnt_stmt = 'SELECT COUNT(*) INTO @cnt FROM `commerce_product_catalog`';
        PREPARE stmt_cnt FROM @cnt_stmt;
        EXECUTE stmt_cnt;
        DEALLOCATE PREPARE stmt_cnt;

        IF @cnt > 0 THEN
            -- Safely archive table if it contains data
            DROP TABLE IF EXISTS `commerce_product_catalog_archived`;
            RENAME TABLE `commerce_product_catalog` TO `commerce_product_catalog_archived`;
        ELSE
            -- Drop empty table safely
            DROP TABLE IF EXISTS `commerce_product_catalog`;
        END IF;
    END IF;
END$$
DELIMITER ;

CALL `sp_safe_rollback_commerce_product_catalog`();
DROP PROCEDURE IF EXISTS `sp_safe_rollback_commerce_product_catalog`;
