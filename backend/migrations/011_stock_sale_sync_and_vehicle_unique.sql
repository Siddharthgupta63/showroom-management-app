-- 011_stock_sale_sync_and_vehicle_unique.sql
-- Purpose:
-- 1) normalize old NEW status to in_stock
-- 2) sync stock rows with active sales
-- 3) restore stock rows where linked sale is cancelled / missing
-- 4) deduplicate sale_vehicle_links by vehicle_id
-- 5) enforce one vehicle -> one sale link (idempotent)

START TRANSACTION;

-- -----------------------------------------------------
-- 1) Normalize old NEW status to in_stock
-- -----------------------------------------------------
UPDATE vehicle_purchase_items
SET status_code = 'in_stock'
WHERE UPPER(COALESCE(status_code, '')) = 'NEW';

-- -----------------------------------------------------
-- 2) Sync stock rows with ACTIVE sales
--    Keep latest active sale per vehicle
-- -----------------------------------------------------
UPDATE vehicle_purchase_items vpi
JOIN (
  SELECT s.contact_vehicle_id, MAX(s.id) AS sale_id
  FROM sales s
  WHERE s.is_cancelled = 0
    AND s.contact_vehicle_id IS NOT NULL
  GROUP BY s.contact_vehicle_id
) live_sale
  ON live_sale.contact_vehicle_id = vpi.contact_vehicle_id
LEFT JOIN sales s2
  ON s2.id = live_sale.sale_id
SET
  vpi.status_code = 'sold',
  vpi.sale_id = live_sale.sale_id,
  vpi.sold_at = COALESCE(vpi.sold_at, s2.created_at, NOW())
WHERE vpi.contact_vehicle_id IS NOT NULL;

-- -----------------------------------------------------
-- 3) Restore stock rows if no ACTIVE sale exists now
-- -----------------------------------------------------
UPDATE vehicle_purchase_items vpi
LEFT JOIN (
  SELECT s.contact_vehicle_id, MAX(s.id) AS sale_id
  FROM sales s
  WHERE s.is_cancelled = 0
    AND s.contact_vehicle_id IS NOT NULL
  GROUP BY s.contact_vehicle_id
) live_sale
  ON live_sale.contact_vehicle_id = vpi.contact_vehicle_id
SET
  vpi.status_code = 'in_stock',
  vpi.sale_id = NULL,
  vpi.sold_at = NULL
WHERE vpi.contact_vehicle_id IS NOT NULL
  AND live_sale.sale_id IS NULL
  AND (
    LOWER(COALESCE(vpi.status_code, '')) = 'sold'
    OR vpi.sale_id IS NOT NULL
  );

-- -----------------------------------------------------
-- 4) Clean duplicate sale_vehicle_links
--    Keep latest row per vehicle_id
-- -----------------------------------------------------
DELETE svl1
FROM sale_vehicle_links svl1
JOIN sale_vehicle_links svl2
  ON svl1.vehicle_id = svl2.vehicle_id
 AND svl1.id < svl2.id;

COMMIT;

-- -----------------------------------------------------
-- 5) Enforce one vehicle can belong to only one sale link
--    Add unique key only if missing
-- -----------------------------------------------------
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sale_vehicle_links'
    AND index_name = 'uniq_vehicle_single_sale'
);

SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE sale_vehicle_links ADD UNIQUE KEY uniq_vehicle_single_sale (vehicle_id)',
  'SELECT "uniq_vehicle_single_sale already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;