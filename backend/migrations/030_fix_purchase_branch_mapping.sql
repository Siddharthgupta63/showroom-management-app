-- ============================================
-- 030_fix_purchase_branch_mapping.sql
-- Fix missing branch_id in purchase + stock
-- ============================================

-- 1. Ensure branch_id exists in vehicle_purchases
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vehicle_purchases'
    AND COLUMN_NAME = 'branch_id'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE vehicle_purchases ADD COLUMN branch_id INT NULL AFTER supplier_id;',
  'SELECT "branch_id already exists in vehicle_purchases";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Ensure current_branch_id exists in vehicle_purchase_items
SET @col_exists2 := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vehicle_purchase_items'
    AND COLUMN_NAME = 'current_branch_id'
);

SET @sql2 := IF(
  @col_exists2 = 0,
  'ALTER TABLE vehicle_purchase_items ADD COLUMN current_branch_id INT NULL AFTER purchase_id;',
  'SELECT "current_branch_id already exists";'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 3. Backfill purchase.branch_id (default = 1)
UPDATE vehicle_purchases
SET branch_id = 1
WHERE branch_id IS NULL;

-- 4. Backfill stock current_branch_id from purchase
UPDATE vehicle_purchase_items vpi
INNER JOIN vehicle_purchases vp ON vp.id = vpi.purchase_id
SET vpi.current_branch_id = vp.branch_id
WHERE vpi.current_branch_id IS NULL;

-- 5. Safety fallback (if still NULL)
UPDATE vehicle_purchase_items
SET current_branch_id = 1
WHERE current_branch_id IS NULL;

-- ============================================
-- END
-- ============================================