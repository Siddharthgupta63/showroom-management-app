START TRANSACTION;

-- =====================================================
-- 008_hsrp_rc_hsrp_old_fitment_permissions.sql
-- Purpose:
-- 1) Ensure HSRP workflow columns exist
-- 2) Ensure RC workflow columns exist
-- 3) Create old-customer HSRP fitment table
-- 4) Ensure new fitter fields for HSRP incentive logic
-- 5) Add permissions for HSRP export + old customer fitment
-- =====================================================

-- -----------------------------------------------------
-- HSRP columns
-- -----------------------------------------------------

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hsrp'
      AND COLUMN_NAME = 'plate_received'
  ),
  'SELECT 1',
  'ALTER TABLE hsrp ADD COLUMN plate_received TINYINT(1) NOT NULL DEFAULT 0 AFTER hsrp_issued_date'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hsrp'
      AND COLUMN_NAME = 'plate_received_date'
  ),
  'SELECT 1',
  'ALTER TABLE hsrp ADD COLUMN plate_received_date DATE NULL AFTER plate_received'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hsrp'
      AND COLUMN_NAME = 'plate_received_by'
  ),
  'SELECT 1',
  'ALTER TABLE hsrp ADD COLUMN plate_received_by INT NULL AFTER plate_received_date'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------
-- HSRP fitment columns for incentive / fitter tracking
-- -----------------------------------------------------

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hsrp_fitment'
      AND COLUMN_NAME = 'fitment_by'
  ),
  'SELECT 1',
  'ALTER TABLE hsrp_fitment ADD COLUMN fitment_by INT NULL AFTER amount_paid'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hsrp_fitment'
      AND COLUMN_NAME = 'fitment_by_name'
  ),
  'SELECT 1',
  'ALTER TABLE hsrp_fitment ADD COLUMN fitment_by_name VARCHAR(150) NULL AFTER fitment_by'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------
-- RC workflow columns
-- -----------------------------------------------------

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rc_status'
      AND COLUMN_NAME = 'file_prepared'
  ),
  'SELECT 1',
  'ALTER TABLE rc_status ADD COLUMN file_prepared TINYINT(1) NOT NULL DEFAULT 0 AFTER sale_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rc_status'
      AND COLUMN_NAME = 'file_prepared_date'
  ),
  'SELECT 1',
  'ALTER TABLE rc_status ADD COLUMN file_prepared_date DATE NULL AFTER file_prepared'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rc_status'
      AND COLUMN_NAME = 'file_prepared_by'
  ),
  'SELECT 1',
  'ALTER TABLE rc_status ADD COLUMN file_prepared_by INT NULL AFTER file_prepared_date'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rc_status'
      AND COLUMN_NAME = 'file_sent_to_agent'
  ),
  'SELECT 1',
  'ALTER TABLE rc_status ADD COLUMN file_sent_to_agent TINYINT(1) NOT NULL DEFAULT 0 AFTER rc_file_path'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rc_status'
      AND COLUMN_NAME = 'file_sent_to_agent_date'
  ),
  'SELECT 1',
  'ALTER TABLE rc_status ADD COLUMN file_sent_to_agent_date DATE NULL AFTER file_sent_to_agent'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rc_status'
      AND COLUMN_NAME = 'agent_name'
  ),
  'SELECT 1',
  'ALTER TABLE rc_status ADD COLUMN agent_name VARCHAR(150) NULL AFTER file_sent_to_agent_date'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rc_status'
      AND COLUMN_NAME = 'rc_received_from_agent'
  ),
  'SELECT 1',
  'ALTER TABLE rc_status ADD COLUMN rc_received_from_agent TINYINT(1) NOT NULL DEFAULT 0 AFTER agent_name'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rc_status'
      AND COLUMN_NAME = 'rc_received_from_agent_date'
  ),
  'SELECT 1',
  'ALTER TABLE rc_status ADD COLUMN rc_received_from_agent_date DATE NULL AFTER rc_received_from_agent'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'rc_status'
      AND COLUMN_NAME = 'rc_received_by'
  ),
  'SELECT 1',
  'ALTER TABLE rc_status ADD COLUMN rc_received_by INT NULL AFTER rc_received_from_agent_date'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------
-- Old customer HSRP fitment table
-- For customers without linked sale data
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS hsrp_old_fitments (
  id INT NOT NULL AUTO_INCREMENT,
  customer_name VARCHAR(200) NOT NULL,
  mobile_number VARCHAR(20) NULL,
  hsrp_number VARCHAR(100) NOT NULL,
  fitment_date DATE NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  fitment_by INT NULL,
  fitment_by_name VARCHAR(150) NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hsrp_old_fitments_customer_name (customer_name),
  KEY idx_hsrp_old_fitments_mobile_number (mobile_number),
  KEY idx_hsrp_old_fitments_fitment_date (fitment_date),
  KEY idx_hsrp_old_fitments_hsrp_number (hsrp_number),
  KEY idx_hsrp_old_fitments_fitment_by (fitment_by)
);

-- remove old vehicle_model column if present in older local versions
SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hsrp_old_fitments'
      AND COLUMN_NAME = 'vehicle_model'
  ),
  'ALTER TABLE hsrp_old_fitments DROP COLUMN vehicle_model',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ensure fitment_by exists even if table was created earlier without it
SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hsrp_old_fitments'
      AND COLUMN_NAME = 'fitment_by'
  ),
  'SELECT 1',
  'ALTER TABLE hsrp_old_fitments ADD COLUMN fitment_by INT NULL AFTER amount_paid'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'hsrp_old_fitments'
      AND COLUMN_NAME = 'fitment_by_name'
  ),
  'SELECT 1',
  'ALTER TABLE hsrp_old_fitments ADD COLUMN fitment_by_name VARCHAR(150) NULL AFTER fitment_by'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------
-- Permissions
-- -----------------------------------------------------

INSERT INTO permissions (permission_key, description)
SELECT 'hsrp_export', 'Export HSRP data'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE permission_key = 'hsrp_export'
);

INSERT INTO permissions (permission_key, description)
SELECT 'hsrp_old_customer_fitment', 'Create HSRP fitment entry for old customers without sale data'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE permission_key = 'hsrp_old_customer_fitment'
);

-- -----------------------------------------------------
-- Optional default role permissions
-- -----------------------------------------------------

INSERT INTO role_permissions (role, permission_key)
SELECT 'owner', 'hsrp_export'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'owner' AND permission_key = 'hsrp_export'
);

INSERT INTO role_permissions (role, permission_key)
SELECT 'admin', 'hsrp_export'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'admin' AND permission_key = 'hsrp_export'
);

INSERT INTO role_permissions (role, permission_key)
SELECT 'manager', 'hsrp_export'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'manager' AND permission_key = 'hsrp_export'
);

INSERT INTO role_permissions (role, permission_key)
SELECT 'owner', 'hsrp_old_customer_fitment'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'owner' AND permission_key = 'hsrp_old_customer_fitment'
);

INSERT INTO role_permissions (role, permission_key)
SELECT 'admin', 'hsrp_old_customer_fitment'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'admin' AND permission_key = 'hsrp_old_customer_fitment'
);

INSERT INTO role_permissions (role, permission_key)
SELECT 'manager', 'hsrp_old_customer_fitment'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'manager' AND permission_key = 'hsrp_old_customer_fitment'
);

INSERT INTO role_permissions (role, permission_key)
SELECT 'hsrp', 'hsrp_old_customer_fitment'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'hsrp' AND permission_key = 'hsrp_old_customer_fitment'
);

-- -----------------------------------------------------
-- Migration log
-- -----------------------------------------------------

INSERT INTO schema_migrations (filename)
SELECT '008_hsrp_rc_hsrp_old_fitment_permissions.sql'
WHERE NOT EXISTS (
  SELECT 1
  FROM schema_migrations
  WHERE filename = '008_hsrp_rc_hsrp_old_fitment_permissions.sql'
);

COMMIT;