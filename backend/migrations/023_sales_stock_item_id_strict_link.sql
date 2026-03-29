-- 023_sales_stock_item_id_strict_link.sql
-- Purpose:
-- 1) add strict stock link on sales.stock_item_id
-- 2) backfill obvious matches from existing stock rows
-- 3) add FK so future sale/stock relation stays valid

-- --------------------------------------------------
-- Add stock_item_id column if missing
-- --------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sales'
    AND COLUMN_NAME = 'stock_item_id'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE sales ADD COLUMN stock_item_id INT NULL AFTER contact_vehicle_id',
  'SELECT "stock_item_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------------------
-- Add index if missing
-- --------------------------------------------------
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sales'
    AND INDEX_NAME = 'idx_sales_stock_item_id'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_sales_stock_item_id ON sales (stock_item_id)',
  'SELECT "idx_sales_stock_item_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------------------
-- Backfill stock_item_id from vehicle_purchase_items.sale_id
-- This is the safest existing relation if present
-- --------------------------------------------------
UPDATE sales s
INNER JOIN vehicle_purchase_items vpi
  ON vpi.sale_id = s.id
SET s.stock_item_id = vpi.id
WHERE s.stock_item_id IS NULL;

-- --------------------------------------------------
-- Add foreign key if missing
-- --------------------------------------------------
SET @fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_sales_stock_item'
    AND TABLE_NAME = 'sales'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE sales
     ADD CONSTRAINT fk_sales_stock_item
     FOREIGN KEY (stock_item_id)
     REFERENCES vehicle_purchase_items(id)
     ON DELETE SET NULL
     ON UPDATE CASCADE',
  'SELECT "fk_sales_stock_item already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;