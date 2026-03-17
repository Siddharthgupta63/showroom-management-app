-- 009_vehicle_stock_challan_import.sql
-- Vehicle stock enhancement:
-- 1) challan / invoice / import entry support
-- 2) invoice-later workflow
-- 3) stronger stock status flow
-- 4) import batch support
-- 5) sale-link readiness

START TRANSACTION;

-- =====================================================
-- VEHICLE PURCHASES: header-level document support
-- =====================================================

ALTER TABLE vehicle_purchases
  ADD COLUMN entry_type ENUM('invoice','challan','import') NOT NULL DEFAULT 'invoice' AFTER purchase_from,
  ADD COLUMN document_number VARCHAR(120) NULL AFTER entry_type,
  ADD COLUMN document_date DATE NULL AFTER document_number,
  ADD COLUMN invoice_pending TINYINT(1) NOT NULL DEFAULT 0 AFTER document_date,
  ADD COLUMN supplier_name VARCHAR(200) NULL AFTER invoice_pending,
  ADD COLUMN received_date DATE NULL AFTER supplier_name,
  ADD COLUMN invoice_received_at DATETIME NULL AFTER received_date,
  ADD COLUMN updated_invoice_by INT NULL AFTER invoice_received_at,
  ADD COLUMN branch_id INT NULL AFTER updated_invoice_by;

-- Helpful indexes
ALTER TABLE vehicle_purchases
  ADD INDEX idx_vehicle_purchases_entry_type (entry_type),
  ADD INDEX idx_vehicle_purchases_invoice_pending (invoice_pending),
  ADD INDEX idx_vehicle_purchases_branch_id (branch_id),
  ADD INDEX idx_vehicle_purchases_document_number (document_number);

-- =====================================================
-- VEHICLE PURCHASE ITEMS: stock lifecycle support
-- =====================================================

ALTER TABLE vehicle_purchase_items
  ADD COLUMN booked_at DATETIME NULL AFTER status_code,
  ADD COLUMN booked_by INT NULL AFTER booked_at,
  ADD COLUMN sold_at DATETIME NULL AFTER booked_by,
  ADD COLUMN delivered_at DATETIME NULL AFTER sold_at,
  ADD COLUMN import_batch_no VARCHAR(100) NULL AFTER delivered_at,
  ADD COLUMN remarks TEXT NULL AFTER import_batch_no,
  ADD COLUMN sale_id INT NULL AFTER remarks;

-- Helpful indexes
ALTER TABLE vehicle_purchase_items
  ADD INDEX idx_vehicle_purchase_items_sale_id (sale_id),
  ADD INDEX idx_vehicle_purchase_items_import_batch_no (import_batch_no),
  ADD INDEX idx_vehicle_purchase_items_booked_by (booked_by);

-- =====================================================
-- NORMALIZE EXISTING STATUS VALUES
-- Current default is NEW, move to business-friendly status
-- =====================================================

UPDATE vehicle_purchase_items
SET status_code = 'in_stock'
WHERE status_code IS NULL
   OR status_code = ''
   OR UPPER(status_code) = 'NEW';

ALTER TABLE vehicle_purchase_items
  MODIFY COLUMN status_code VARCHAR(20) NOT NULL DEFAULT 'in_stock';

-- =====================================================
-- NOTE:
-- We are NOT adding UNIQUE constraints yet.
-- First we will check duplicate chassis/engine after migration.
-- =====================================================

-- =====================================================
-- NOTE:
-- Foreign keys intentionally skipped in local safe version.
-- We will add them later in a separate migration after data validation.
-- =====================================================

COMMIT;