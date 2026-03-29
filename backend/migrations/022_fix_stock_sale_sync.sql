START TRANSACTION;

-- 1) Backfill stock.contact_vehicle_id from active sales using exact chassis+engine
UPDATE vehicle_purchase_items v
INNER JOIN sales s
  ON s.is_cancelled = 0
 AND s.contact_vehicle_id IS NOT NULL
 AND s.chassis_number = v.chassis_number
 AND s.engine_number = v.engine_number
SET v.contact_vehicle_id = COALESCE(v.contact_vehicle_id, s.contact_vehicle_id)
WHERE v.contact_vehicle_id IS NULL;

-- 2) Mark stock items as sold for active sales using exact chassis+engine
UPDATE vehicle_purchase_items v
INNER JOIN sales s
  ON s.is_cancelled = 0
 AND s.chassis_number = v.chassis_number
 AND s.engine_number = v.engine_number
SET
  v.status_code = 'sold',
  v.sale_id = s.id,
  v.sold_at = COALESCE(v.sold_at, NOW()),
  v.contact_vehicle_id = COALESCE(v.contact_vehicle_id, s.contact_vehicle_id)
WHERE
  v.status_code <> 'sold'
  OR v.sale_id IS NULL;

-- 3) If a stock row points to a cancelled sale and there is no active sale for same chassis+engine,
-- restore it to in_stock
UPDATE vehicle_purchase_items v
INNER JOIN sales s_cancel
  ON s_cancel.id = v.sale_id
 AND s_cancel.is_cancelled = 1
LEFT JOIN sales s_active
  ON s_active.is_cancelled = 0
 AND s_active.chassis_number = v.chassis_number
 AND s_active.engine_number = v.engine_number
SET
  v.status_code = 'in_stock',
  v.sale_id = NULL,
  v.sold_at = NULL
WHERE s_active.id IS NULL
  AND v.status_code = 'sold';

COMMIT;