-- 027_branchwise_vehicle_stock.sql
-- Purpose:
-- 1) add live branch location on vehicle_purchase_items
-- 2) backfill existing stock from vehicle_purchases.branch_id
-- 3) create stock_transfers history table
-- 4) add indexes for branch-wise stock filtering

START TRANSACTION;

-- --------------------------------------------------
-- Resolve fallback default branch
-- Preference:
--   1) branch named 'Main Showroom'
--   2) otherwise first active branch
--   3) otherwise first branch
-- --------------------------------------------------
SET @default_branch_id := (
  SELECT id
  FROM showroom_branches
  WHERE LOWER(TRIM(branch_name)) = LOWER('Main Showroom')
  ORDER BY id ASC
  LIMIT 1
);

SET @default_branch_id := COALESCE(
  @default_branch_id,
  (
    SELECT id
    FROM showroom_branches
    WHERE is_active = 1
    ORDER BY id ASC
    LIMIT 1
  ),
  (
    SELECT id
    FROM showroom_branches
    ORDER BY id ASC
    LIMIT 1
  )
);

-- --------------------------------------------------
-- Add current_branch_id to vehicle_purchase_items
-- --------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vehicle_purchase_items'
    AND COLUMN_NAME = 'current_branch_id'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE vehicle_purchase_items ADD COLUMN current_branch_id INT NULL AFTER purchase_id',
  'SELECT "vehicle_purchase_items.current_branch_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------------------
-- Backfill current_branch_id from vehicle_purchases.branch_id
-- If purchase branch is null, use fallback default branch
-- --------------------------------------------------
UPDATE vehicle_purchase_items vpi
INNER JOIN vehicle_purchases vp
  ON vp.id = vpi.purchase_id
SET vpi.current_branch_id = COALESCE(vp.branch_id, @default_branch_id)
WHERE vpi.current_branch_id IS NULL;

-- Final fallback in case some rows still null
UPDATE vehicle_purchase_items
SET current_branch_id = @default_branch_id
WHERE current_branch_id IS NULL
  AND @default_branch_id IS NOT NULL;

-- --------------------------------------------------
-- Add indexes on vehicle_purchase_items
-- --------------------------------------------------
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vehicle_purchase_items'
    AND INDEX_NAME = 'idx_vpi_current_branch_id'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_vpi_current_branch_id ON vehicle_purchase_items (current_branch_id)',
  'SELECT "idx_vpi_current_branch_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vehicle_purchase_items'
    AND INDEX_NAME = 'idx_vpi_branch_status'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_vpi_branch_status ON vehicle_purchase_items (current_branch_id, status_code)',
  'SELECT "idx_vpi_branch_status already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------------------
-- Create stock_transfers history table
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_transfers (
  id INT NOT NULL AUTO_INCREMENT,
  stock_item_id INT NOT NULL,
  from_branch_id INT NOT NULL,
  to_branch_id INT NOT NULL,
  transfer_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_stock_transfers_stock_item (stock_item_id),
  KEY idx_stock_transfers_from_branch (from_branch_id),
  KEY idx_stock_transfers_to_branch (to_branch_id),
  KEY idx_stock_transfers_transfer_date (transfer_date),
  KEY idx_stock_transfers_created_by (created_by),

  CONSTRAINT fk_stock_transfers_stock_item
    FOREIGN KEY (stock_item_id) REFERENCES vehicle_purchase_items(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_stock_transfers_from_branch
    FOREIGN KEY (from_branch_id) REFERENCES showroom_branches(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_stock_transfers_to_branch
    FOREIGN KEY (to_branch_id) REFERENCES showroom_branches(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_stock_transfers_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

COMMIT;