-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE ROLLBACK
-- Rollback: 20261009_022_rollback_commerce_product_costs.sql
-- Description: Safely rolls back migration 022 without data loss.
-- Safety: Non-destructive archival only. STRICTLY ZERO DROP TABLE on production data.
-- ====================================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `sp_safe_rollback_commerce_product_costs`;

DELIMITER $$
CREATE PROCEDURE `sp_safe_rollback_commerce_product_costs`()
BEGIN
    DECLARE tbl_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO tbl_exists 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_product_costs';

    IF tbl_exists > 0 THEN
        -- Safely archive table rather than dropping, preserving all cost configurations
        SET @arch_name = CONCAT('commerce_product_costs_arch_', DATE_FORMAT(NOW(), '%Y%m%d_%H%i%s'));
        SET @rename_sql = CONCAT('RENAME TABLE `commerce_product_costs` TO `', @arch_name, '`');
        PREPARE stmt_ren FROM @rename_sql;
        EXECUTE stmt_ren;
        DEALLOCATE PREPARE stmt_ren;
    END IF;
END$$
DELIMITER ;

CALL `sp_safe_rollback_commerce_product_costs`();
DROP PROCEDURE IF EXISTS `sp_safe_rollback_commerce_product_costs`;
