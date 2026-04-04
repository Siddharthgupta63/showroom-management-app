-- 028_stock_transfer_challan_module.sql
-- Purpose:
--   Add challan-based branch stock transfer module
--   without breaking existing single-transfer flow.

START TRANSACTION;

-- --------------------------------------------------
-- 1) stock_transfer_challans
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_transfer_challans (
  id INT NOT NULL AUTO_INCREMENT,
  challan_number VARCHAR(100) NOT NULL,
  challan_date DATE NOT NULL,

  from_branch_id INT NOT NULL,
  to_branch_id INT NOT NULL,

  transporter_name VARCHAR(255) NULL,
  vehicle_number VARCHAR(100) NULL,
  driver_name VARCHAR(255) NULL,
  driver_mobile VARCHAR(50) NULL,
  lr_number VARCHAR(100) NULL,

  notes TEXT NULL,
  remarks TEXT NULL,

  subtotal_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  freight_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  loading_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unloading_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  other_cost_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  grand_total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_vehicles INT NOT NULL DEFAULT 0,

  status ENUM('draft', 'posted', 'cancelled') NOT NULL DEFAULT 'draft',

  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  posted_at DATETIME NULL,
  posted_by INT NULL,

  cancelled_at DATETIME NULL,
  cancelled_by INT NULL,
  cancel_reason TEXT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_transfer_challans_number (challan_number),
  KEY idx_stock_transfer_challans_date (challan_date),
  KEY idx_stock_transfer_challans_from_branch (from_branch_id),
  KEY idx_stock_transfer_challans_to_branch (to_branch_id),
  KEY idx_stock_transfer_challans_status (status),
  KEY idx_stock_transfer_challans_created_by (created_by),
  KEY idx_stock_transfer_challans_posted_by (posted_by),
  KEY idx_stock_transfer_challans_cancelled_by (cancelled_by),

  CONSTRAINT fk_stc_from_branch
    FOREIGN KEY (from_branch_id) REFERENCES showroom_branches(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_stc_to_branch
    FOREIGN KEY (to_branch_id) REFERENCES showroom_branches(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_stc_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_stc_posted_by
    FOREIGN KEY (posted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_stc_cancelled_by
    FOREIGN KEY (cancelled_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------
-- 2) stock_transfer_challan_items
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_transfer_challan_items (
  id INT NOT NULL AUTO_INCREMENT,
  challan_id INT NOT NULL,
  stock_item_id INT NOT NULL,

  model_id INT NULL,
  variant_id INT NULL,
  color VARCHAR(100) NULL,
  chassis_number VARCHAR(100) NULL,
  engine_number VARCHAR(100) NULL,

  unit_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  line_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_stci_challan_stock (challan_id, stock_item_id),
  KEY idx_stci_challan (challan_id),
  KEY idx_stci_stock_item (stock_item_id),
  KEY idx_stci_model_id (model_id),
  KEY idx_stci_variant_id (variant_id),

  CONSTRAINT fk_stci_challan
    FOREIGN KEY (challan_id) REFERENCES stock_transfer_challans(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_stci_stock_item
    FOREIGN KEY (stock_item_id) REFERENCES vehicle_purchase_items(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_stci_model
    FOREIGN KEY (model_id) REFERENCES vehicle_models(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_stci_variant
    FOREIGN KEY (variant_id) REFERENCES vehicle_variants(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------
-- 3) Add challan_id to existing stock_transfers
-- --------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock_transfers'
    AND COLUMN_NAME = 'challan_id'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE stock_transfers ADD COLUMN challan_id INT NULL AFTER id',
  'SELECT "stock_transfers.challan_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------------------
-- 4) Add index on stock_transfers.challan_id
-- --------------------------------------------------
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock_transfers'
    AND INDEX_NAME = 'idx_stock_transfers_challan_id'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_stock_transfers_challan_id ON stock_transfers (challan_id)',
  'SELECT "idx_stock_transfers_challan_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------------------
-- 5) Add FK from stock_transfers.challan_id
-- --------------------------------------------------
SET @fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_stock_transfers_challan'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE stock_transfers
     ADD CONSTRAINT fk_stock_transfers_challan
     FOREIGN KEY (challan_id) REFERENCES stock_transfer_challans(id)
     ON DELETE SET NULL
     ON UPDATE CASCADE',
  'SELECT "fk_stock_transfers_challan already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;