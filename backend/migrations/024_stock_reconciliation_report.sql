-- 024_stock_reconciliation_report.sql
-- Purpose:
-- create helper views to identify current stock/sale mismatches
-- does NOT change data, only gives report views

DROP VIEW IF EXISTS vw_stock_items_sold_without_sale_link;
DROP VIEW IF EXISTS vw_sales_missing_stock_item_link;
DROP VIEW IF EXISTS vw_sales_stock_link_mismatch;
DROP VIEW IF EXISTS vw_duplicate_sales_same_stock_item;

CREATE VIEW vw_stock_items_sold_without_sale_link AS
SELECT
  vpi.id,
  vpi.purchase_id,
  vpi.contact_vehicle_id,
  vpi.engine_number,
  vpi.chassis_number,
  vpi.status_code,
  vpi.sale_id,
  vpi.sold_at,
  vpi.created_at
FROM vehicle_purchase_items vpi
WHERE vpi.status_code = 'sold'
  AND vpi.sale_id IS NULL;

CREATE VIEW vw_sales_missing_stock_item_link AS
SELECT
  s.id,
  s.customer_name,
  s.mobile_number,
  s.vehicle_model,
  s.contact_vehicle_id,
  s.stock_item_id,
  s.sale_date,
  s.created_at,
  s.updated_at
FROM sales s
WHERE s.stock_item_id IS NULL;

CREATE VIEW vw_sales_stock_link_mismatch AS
SELECT
  s.id AS sale_id,
  s.customer_name,
  s.mobile_number,
  s.vehicle_model,
  s.stock_item_id,
  vpi.id AS stock_row_id,
  vpi.sale_id AS stock_sale_id,
  vpi.status_code,
  vpi.sold_at,
  s.sale_date,
  s.created_at,
  s.updated_at
FROM sales s
LEFT JOIN vehicle_purchase_items vpi
  ON vpi.id = s.stock_item_id
WHERE s.stock_item_id IS NOT NULL
  AND (
    vpi.id IS NULL
    OR vpi.sale_id <> s.id
    OR vpi.status_code <> 'sold'
  );

CREATE VIEW vw_duplicate_sales_same_stock_item AS
SELECT
  s.stock_item_id,
  COUNT(*) AS sale_count,
  GROUP_CONCAT(s.id ORDER BY s.id) AS sale_ids
FROM sales s
WHERE s.stock_item_id IS NOT NULL
GROUP BY s.stock_item_id
HAVING COUNT(*) > 1;