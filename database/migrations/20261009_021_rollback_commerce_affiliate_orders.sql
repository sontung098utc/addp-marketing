-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE ROLLBACK
-- Rollback: 20261009_021_rollback_commerce_affiliate_orders.sql
-- Description: Safely rolls back migration 021 without data loss.
-- Safety: Non-destructive archival only. STRICTLY ZERO DROP TABLE on production data.
-- ====================================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `sp_safe_rollback_commerce_affiliate_orders`;

DELIMITER $$
CREATE PROCEDURE `sp_safe_rollback_commerce_affiliate_orders`()
BEGIN
    DECLARE tbl_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO tbl_exists 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_affiliate_orders';

    IF tbl_exists > 0 THEN
        -- Safely archive table rather than dropping, preserving all transactional audit records
        SET @arch_name = CONCAT('commerce_affiliate_orders_arch_', DATE_FORMAT(NOW(), '%Y%m%d_%H%i%s'));
        SET @rename_sql = CONCAT('RENAME TABLE `commerce_affiliate_orders` TO `', @arch_name, '`');
        PREPARE stmt_ren FROM @rename_sql;
        EXECUTE stmt_ren;
        DEALLOCATE PREPARE stmt_ren;
    END IF;
END$$
DELIMITER ;

CALL `sp_safe_rollback_commerce_affiliate_orders`();
DROP PROCEDURE IF EXISTS `sp_safe_rollback_commerce_affiliate_orders`;
