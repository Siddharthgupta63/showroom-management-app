const db = require("../db");

async function ensureInsuranceCombinedViewV2() {
  const viewSql = `
    CREATE OR REPLACE VIEW insurance_combined_view_v2 AS
    SELECT
      'SALE' AS source,
      i.id AS id,
      i.sale_id AS sale_id,
      i.customer_name AS customer_name,
      i.phone AS phone,
      i.vehicle_no AS vehicle_no,
      s.vehicle_model AS model_name,
      i.chassis_number AS chassis_number,
      i.engine_number AS engine_number,
      i.company AS company,
      i.policy_number AS policy_no,
      i.start_date AS start_date,
      i.expiry_date AS expiry_date,
      (TO_DAYS(i.expiry_date) - TO_DAYS(CURDATE())) AS days_left,
      i.followup1_date AS followup1_date,
      i.followup1_remark AS followup1_remark,
      i.followup2_date AS followup2_date,
      i.followup2_remark AS followup2_remark,
      i.followup3_date AS followup3_date,
      i.followup3_remark AS followup3_remark,
      COALESCE(i.cpa_number, s.cpa_insurance_number) AS cpa_number,
      i.cpa_included AS cpa_included,
      s.insurance_broker AS insurance_broker,
      NULL AS agent,
      NULL AS agent_name,
      NULL AS broker,
      i.premium_amount AS premium_amount,
      NULL AS premium,
      i.invoice_number AS invoice_number,
      i.remarks AS remarks,
      i.insurance_type AS insurance_type,
      i.renewal_date AS renewal_date
    FROM insurance i
    LEFT JOIN sales s ON s.id = i.sale_id

    UNION ALL

    SELECT
      'RENEWAL' AS source,
      p.id AS id,
      NULL AS sale_id,
      p.customer_name AS customer_name,
      p.phone AS phone,
      p.vehicle_no AS vehicle_no,
      p.model_name AS model_name,
      NULL AS chassis_number,
      NULL AS engine_number,
      p.company AS company,
      p.policy_no AS policy_no,
      p.start_date AS start_date,
      p.expiry_date AS expiry_date,
      (TO_DAYS(p.expiry_date) - TO_DAYS(CURDATE())) AS days_left,
      p.followup1_date AS followup1_date,
      p.followup1_remark AS followup1_remark,
      p.followup2_date AS followup2_date,
      p.followup2_remark AS followup2_remark,
      p.followup3_date AS followup3_date,
      p.followup3_remark AS followup3_remark,
      NULL AS cpa_number,
      NULL AS cpa_included,
      NULL AS insurance_broker,
      NULL AS agent,
      NULL AS agent_name,
      NULL AS broker,
      NULL AS premium_amount,
      p.premium AS premium,
      NULL AS invoice_number,
      NULL AS remarks,
      NULL AS insurance_type,
      NULL AS renewal_date
    FROM insurance_policies p
  `;

  await db.query(viewSql);
  console.log("✅ ensured view: insurance_combined_view_v2");
}

async function ensureViews() {
  await ensureInsuranceCombinedViewV2();
}

module.exports = {
  ensureViews,
};