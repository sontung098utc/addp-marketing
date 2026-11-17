-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Migration: 20261005_016_rollback_create_commerce_sync_jobs.sql
-- Description: Safely archives commerce_sync_jobs table without data loss (Sprint V2-04.3 rollback)
-- Safety: Non-destructive archival only. STRICTLY ZERO DROP TABLE on production data (F05 fix).
-- ====================================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `sp_safe_rollback_commerce_sync_jobs`;

DELIMITER $$
CREATE PROCEDURE `sp_safe_rollback_commerce_sync_jobs`()
BEGIN
    DECLARE tbl_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO tbl_exists 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_jobs';

    IF tbl_exists > 0 THEN
        -- Safely archive table rather than dropping, preserving all checkpoint and job history
        SET @arch_name = CONCAT('commerce_sync_jobs_arch_', DATE_FORMAT(NOW(), '%Y%m%d_%H%i%s'));
        SET @rename_sql = CONCAT('RENAME TABLE `commerce_sync_jobs` TO `', @arch_name, '`');
        PREPARE stmt_ren FROM @rename_sql;
        EXECUTE stmt_ren;
        DEALLOCATE PREPARE stmt_ren;
    END IF;
END$$
DELIMITER ;

CALL `sp_safe_rollback_commerce_sync_jobs`();
DROP PROCEDURE IF EXISTS `sp_safe_rollback_commerce_sync_jobs`;
