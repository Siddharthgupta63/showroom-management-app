-- 018_refresh_insurance_and_renewal_views.sql

DROP VIEW IF EXISTS insurance_combined_view_v2;

CREATE VIEW insurance_combined_view_v2 AS

SELECT
  'SALE' AS source,
  i.id,
  i.sale_id,
  i.customer_name,
  i.phone,
  i.vehicle_no,
  s.vehicle_model AS model_name,
  i.chassis_number,
  i.engine_number,
  i.company,
  i.policy_number AS policy_no,
  i.start_date,
  i.expiry_date,
  DATEDIFF(i.expiry_date, CURDATE()) AS days_left,

  i.followup1_date,
  i.followup1_remark,
  i.followup2_date,
  i.followup2_remark,
  i.followup3_date,
  i.followup3_remark,

  i.cpa_number,
  i.cpa_included,
  NULL AS insurance_broker,
  NULL AS agent,
  NULL AS agent_name,
  NULL AS broker,
  i.premium_amount,
  NULL AS premium,
  i.invoice_number,
  i.remarks,
  i.insurance_type,
  i.renewal_date,

  'running' AS policy_status,
  0 AS inspection_required,
  NULL AS inspection_photo,
  NULL AS survey_charge,
  NULL AS variant_name

FROM insurance i
LEFT JOIN sales s ON s.id = i.sale_id

UNION ALL

SELECT
  'RENEWAL' AS source,
  p.id,
  NULL AS sale_id,
  p.customer_name,
  p.phone,
  p.vehicle_no,
  p.model_name,
  NULL AS chassis_number,
  NULL AS engine_number,
  p.company,
  p.policy_no,
  p.start_date,
  p.expiry_date,
  DATEDIFF(p.expiry_date, CURDATE()) AS days_left,

  p.followup1_date,
  p.followup1_remark,
  p.followup2_date,
  p.followup2_remark,
  p.followup3_date,
  p.followup3_remark,

  NULL AS cpa_number,
  p.cpa_included,
  NULL AS insurance_broker,
  NULL AS agent,
  NULL AS agent_name,
  NULL AS broker,
  p.premium,
  p.premium,
  NULL AS invoice_number,
  NULL AS remarks,
  'renewal' AS insurance_type,
  NULL AS renewal_date,

  p.policy_status,
  p.inspection_required,
  p.inspection_photo,
  p.survey_charge,
  p.variant_name

FROM insurance_policies p;


DROP VIEW IF EXISTS renewals_dashboard_view;

CREATE VIEW renewals_dashboard_view AS
SELECT
  r.id AS renewal_id,
  r.sale_id,
  s.customer_name,
  s.mobile_number AS phone,
  COALESCE(r.model_name, s.vehicle_model) AS model_name,
  r.variant_name,
  r.renewal_type,
  r.company,
  r.policy_number,
  r.invoice_number,
  r.premium_amount,
  r.survey_charge,
  r.cpa_included,
  r.policy_status,
  r.inspection_required,
  r.inspection_photo,
  r.renewal_date,
  u.name AS renewed_by_name,

  i.start_date AS insurance_start_date,
  i.expiry_date AS insurance_expiry_date,

  CASE
    WHEN i.expiry_date IS NULL THEN NULL
    ELSE DATEDIFF(CURDATE(), i.expiry_date)
  END AS days_from_expiry,

  CASE
    WHEN i.expiry_date IS NULL THEN 'no_data'
    WHEN i.expiry_date < CURDATE() THEN 'expired'
    WHEN i.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY) THEN 'expiring'
    ELSE 'active'
  END AS insurance_status,

  r.notes

FROM renewals r
LEFT JOIN sales s ON s.id = r.sale_id
LEFT JOIN users u ON u.id = r.renewal_uploaded_by
LEFT JOIN insurance i ON i.sale_id = r.sale_id;