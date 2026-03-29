-- 026_autolink_safe_legacy_sales_stock.sql
-- Purpose:
-- Safely auto-link legacy sales to stock only when:
-- 1) sales.stock_item_id IS NULL
-- 2) exact chassis + engine match exists
-- 3) match is unique (no ambiguity)
-- 4) stock row is not already sold / linked to another sale
--
-- This migration updates only safe exact matches.

START TRANSACTION;

-- --------------------------------------------------
-- 1) Link sales.stock_item_id for safe exact matches
-- --------------------------------------------------
UPDATE sales s
INNER JOIN vw_legacy_sales_exact_stock_candidates x
  ON x.sale_id = s.id
LEFT JOIN vw_legacy_sales_ambiguous_stock_candidates a
  ON a.sale_id = s.id
SET s.stock_item_id = x.stock_item_id
WHERE s.stock_item_id IS NULL
  AND a.sale_id IS NULL
  AND (x.stock_sale_id IS NULL OR x.stock_sale_id = s.id)
  AND LOWER(COALESCE(x.status_code, 'in_stock')) = 'in_stock';

-- --------------------------------------------------
-- 2) Mark matched stock rows as sold + attach sale_id
-- --------------------------------------------------
UPDATE vehicle_purchase_items vpi
INNER JOIN sales s
  ON s.stock_item_id = vpi.id
LEFT JOIN vw_legacy_sales_ambiguous_stock_candidates a
  ON a.sale_id = s.id
SET
  vpi.status_code = 'sold',
  vpi.sale_id = s.id,
  vpi.sold_at = COALESCE(vpi.sold_at, CONCAT(COALESCE(s.sale_date, CURDATE()), ' 00:00:00'))
WHERE s.stock_item_id IS NOT NULL
  AND a.sale_id IS NULL
  AND (vpi.sale_id IS NULL OR vpi.sale_id = s.id);

-- --------------------------------------------------
-- 3) If sale has contact_vehicle_id and stock.contact_vehicle_id is empty,
--    backfill stock contact_vehicle_id
-- --------------------------------------------------
UPDATE vehicle_purchase_items vpi
INNER JOIN sales s
  ON s.stock_item_id = vpi.id
LEFT JOIN vw_legacy_sales_ambiguous_stock_candidates a
  ON a.sale_id = s.id
SET vpi.contact_vehicle_id = s.contact_vehicle_id
WHERE s.stock_item_id IS NOT NULL
  AND s.contact_vehicle_id IS NOT NULL
  AND vpi.contact_vehicle_id IS NULL
  AND a.sale_id IS NULL;

COMMIT;