-- 025_legacy_sales_link_review_views.sql
-- Purpose:
-- Review-only views for old sales that still do not have stock_item_id.
-- This migration does NOT update data.
-- It helps identify:
-- 1) old sales missing stock link
-- 2) exact stock candidates by chassis+engine
-- 3) ambiguous matches that should be reviewed manually

DROP VIEW IF EXISTS vw_legacy_sales_unlinked;
DROP VIEW IF EXISTS vw_legacy_sales_exact_stock_candidates;
DROP VIEW IF EXISTS vw_legacy_sales_ambiguous_stock_candidates;

-- 1) Old / legacy sales still missing strict stock link
CREATE VIEW vw_legacy_sales_unlinked AS
SELECT
  s.id AS sale_id,
  s.customer_name,
  s.mobile_number,
  s.vehicle_model,
  s.contact_vehicle_id,
  s.stock_item_id,
  s.chassis_number,
  s.engine_number,
  s.sale_date,
  s.is_cancelled,
  s.created_at,
  s.updated_at
FROM sales s
WHERE s.stock_item_id IS NULL;

-- 2) Exact 1:1 stock candidate by chassis+engine
CREATE VIEW vw_legacy_sales_exact_stock_candidates AS
SELECT
  s.id AS sale_id,
  s.customer_name,
  s.mobile_number,
  s.vehicle_model,
  s.chassis_number,
  s.engine_number,
  s.sale_date,
  vpi.id AS stock_item_id,
  vpi.purchase_id,
  vpi.contact_vehicle_id,
  vpi.status_code,
  vpi.sale_id AS stock_sale_id,
  vpi.created_at AS stock_created_at
FROM sales s
INNER JOIN vehicle_purchase_items vpi
  ON s.stock_item_id IS NULL
 AND COALESCE(TRIM(s.chassis_number), '') <> ''
 AND COALESCE(TRIM(s.engine_number), '') <> ''
 AND TRIM(s.chassis_number) = TRIM(vpi.chassis_number)
 AND TRIM(s.engine_number) = TRIM(vpi.engine_number);

-- 3) Ambiguous legacy sales: more than one stock row matches exact chassis+engine
CREATE VIEW vw_legacy_sales_ambiguous_stock_candidates AS
SELECT
  x.sale_id,
  x.customer_name,
  x.mobile_number,
  x.vehicle_model,
  x.chassis_number,
  x.engine_number,
  COUNT(*) AS matched_stock_rows,
  GROUP_CONCAT(x.stock_item_id ORDER BY x.stock_item_id) AS stock_item_ids
FROM vw_legacy_sales_exact_stock_candidates x
GROUP BY
  x.sale_id,
  x.customer_name,
  x.mobile_number,
  x.vehicle_model,
  x.chassis_number,
  x.engine_number
HAVING COUNT(*) > 1;