-- 032_add_vehicle_purchase_items_inward_date.sql
-- Purpose:
-- Add inward_date to vehicle_purchase_items for proper ODRC / stock MIS
-- Never edit old migrations. Add-only safe migration.

START TRANSACTION;

-- -----------------------------------------------------
-- 1) Add inward_date column safely
-- -----------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vehicle_purchase_items'
    AND COLUMN_NAME = 'inward_date'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE vehicle_purchase_items ADD COLUMN inward_date DATE NULL AFTER purchase_price',
  'SELECT "inward_date already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------
-- 2) Backfill inward_date from created_at where missing
-- -----------------------------------------------------
UPDATE vehicle_purchase_items
SET inward_date = DATE(created_at)
WHERE inward_date IS NULL
  AND created_at IS NOT NULL;

-- -----------------------------------------------------
-- 3) Add index safely for inward_date
-- -----------------------------------------------------
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vehicle_purchase_items'
    AND INDEX_NAME = 'idx_vpi_inward_date'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_vpi_inward_date ON vehicle_purchase_items(inward_date)',
  'SELECT "idx_vpi_inward_date already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------
-- 4) Optional composite index for ODRC/report filters
-- -----------------------------------------------------
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vehicle_purchase_items'
    AND INDEX_NAME = 'idx_vpi_branch_inward_status'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_vpi_branch_inward_status ON vehicle_purchase_items(current_branch_id, inward_date, status_code)',
  'SELECT "idx_vpi_branch_inward_status already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;