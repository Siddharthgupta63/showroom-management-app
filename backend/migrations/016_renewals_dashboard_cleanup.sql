-- 016_renewals_dashboard_cleanup.sql
-- Purpose:
-- 1) Delete ONLY test data from renewals
-- 2) Create clean reporting view for renewal dashboard
-- NOTE: does NOT delete sales data
-- NOTE: does NOT delete insurance data

DELETE FROM renewals;

DROP VIEW IF EXISTS renewals_dashboard_view;

CREATE VIEW renewals_dashboard_view AS
SELECT
  r.id AS renewal_id,
  r.sale_id,
  s.customer_name,
  s.mobile_number AS phone,
  s.vehicle_model AS model_name,
  s.vehicle_make,
  s.chassis_number,
  s.engine_number,
  s.invoice_number AS sale_invoice_number,
  r.renewal_type,
  r.company,
  r.policy_number,
  r.invoice_number,
  r.premium_amount,
  r.renewal_date,
  r.renewal_uploaded_by,
  u.name AS renewed_by_name,
  r.notes,
  i.id AS insurance_id,
  i.start_date AS insurance_start_date,
  i.expiry_date AS insurance_expiry_date,
  CASE
    WHEN i.expiry_date IS NULL THEN NULL
    ELSE DATEDIFF(CURDATE(), i.expiry_date)
  END AS days_from_expiry,
  CASE
    WHEN i.expiry_date IS NULL THEN 'no_expiry'
    WHEN i.expiry_date < CURDATE() THEN 'expired'
    WHEN i.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY) THEN 'expiring'
    ELSE 'active'
  END AS insurance_status
FROM renewals r
LEFT JOIN sales s
  ON s.id = r.sale_id
LEFT JOIN users u
  ON u.id = r.renewal_uploaded_by
LEFT JOIN insurance i
  ON i.sale_id = r.sale_id;