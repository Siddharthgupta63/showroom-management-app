const db = require("../db");

// Build one stable snapshot JSON for a sale (uses current DB state)
async function buildSaleSnapshot(saleId) {
  const [saleRows] = await db.query(
    `SELECT s.*, b.branch_name
     FROM sales s
     LEFT JOIN showroom_branches b ON b.id = s.branch_id
     WHERE s.id = ? LIMIT 1`,
    [saleId]
  );
  const sale = saleRows?.[0];
  if (!sale) return null;

  // Contact + phones
  let contact = null;
  let phones = [];
  if (sale.contact_id) {
    const [cRows] = await db.query(`SELECT * FROM contacts WHERE id = ? LIMIT 1`, [sale.contact_id]);
    contact = cRows?.[0] || null;

    const [pRows] = await db.query(
      `SELECT id, phone, is_primary, is_active
       FROM contact_phones
       WHERE contact_id = ? AND is_active = 1
       ORDER BY is_primary DESC, id ASC`,
      [sale.contact_id]
    );
    phones = pRows || [];
  }

  // Vehicle + model/variant names
  let vehicle = null;
  if (sale.contact_vehicle_id) {
    const [vRows] = await db.query(
      `SELECT cv.*,
              vm.model_name,
              vv.variant_name
       FROM contact_vehicles cv
       LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
       LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
       WHERE cv.id = ? LIMIT 1`,
      [sale.contact_vehicle_id]
    );
    vehicle = vRows?.[0] || null;
  }

  // normalize docs json
  let docs = null;
  try {
    docs = sale.documents_json ? sale.documents_json : null;
  } catch {
    docs = null;
  }

  return {
    sale: {
      id: sale.id,
      sale_date: sale.sale_date,
      invoice_number: sale.invoice_number,
      sale_price: sale.sale_price,
      is_cancelled: sale.is_cancelled,
      cancelled_at: sale.cancelled_at,
      cancelled_by: sale.cancelled_by,

      customer_name: sale.customer_name,
      father_name: sale.father_name,
      age: sale.age,
      mobile_number: sale.mobile_number,
      email: sale.email,
      address: sale.address,

      nominee_name: sale.nominee_name,
      nominee_relation: sale.nominee_relation,

      vehicle_make: sale.vehicle_make,
      vehicle_model: sale.vehicle_model,
      chassis_number: sale.chassis_number,
      engine_number: sale.engine_number,
      tyre: sale.tyre,
      battery_no: sale.battery_no,
      key_no: sale.key_no,
      helmet: sale.helmet,

      finance_company: sale.finance_company,

      insurance_number: sale.insurance_number,
      insurance_company: sale.insurance_company,
      insurance_broker: sale.insurance_broker,
      cpa_applicable: sale.cpa_applicable,
      cpa_insurance_number: sale.cpa_insurance_number,
      cpa_number: sale.cpa_number,

      rc_required: sale.rc_required,
      aadhaar_required: sale.aadhaar_required,
      aadhaar_number: sale.aadhaar_number,

      sb_tools: sale.sb_tools,
      good_life_no: sale.good_life_no,

      notes: sale.notes,
      documents_json: docs,

      created_at: sale.created_at,
      updated_at: sale.updated_at,

      // links
      contact_id: sale.contact_id,
      contact_vehicle_id: sale.contact_vehicle_id,
      branch_id: sale.branch_id,
    },
    branch: sale.branch_id ? { id: sale.branch_id, branch_name: sale.branch_name || null } : null,
    contact: contact
      ? {
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          full_name: contact.full_name,
          state: contact.state,
          district: contact.district,
          tehsil: contact.tehsil,
          address: contact.address,
          phones,
        }
      : null,
    vehicle: vehicle
      ? {
          id: vehicle.id,
          contact_id: vehicle.contact_id,
          chassis_number: vehicle.chassis_number,
          engine_number: vehicle.engine_number,
          color: vehicle.color,
          model_id: vehicle.model_id,
          variant_id: vehicle.variant_id,
          model_name: vehicle.model_name,
          variant_name: vehicle.variant_name,
        }
      : null,
  };
}

async function createSaleSnapshot({ saleId, reason, createdBy }) {
  const snapshot = await buildSaleSnapshot(saleId);
  if (!snapshot) return null;

  const [verRows] = await db.query(
    `SELECT COALESCE(MAX(version),0) AS v
     FROM sale_snapshots
     WHERE sale_id = ?`,
    [saleId]
  );
  const nextVersion = Number(verRows?.[0]?.v || 0) + 1;

  await db.query(
    `INSERT INTO sale_snapshots (sale_id, version, snapshot_json, reason, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [saleId, nextVersion, JSON.stringify(snapshot), reason || null, createdBy || null]
  );

  await db.query(`UPDATE sales SET latest_snapshot_version = ? WHERE id = ?`, [nextVersion, saleId]);

  return { version: nextVersion, snapshot };
}

async function getLatestSaleSnapshot(saleId) {
  const [rows] = await db.query(
    `SELECT version, snapshot_json
     FROM sale_snapshots
     WHERE sale_id = ?
     ORDER BY version DESC
     LIMIT 1`,
    [saleId]
  );
  if (!rows.length) return null;
  return { version: rows[0].version, snapshot: rows[0].snapshot_json };
}

module.exports = {
  buildSaleSnapshot,
  createSaleSnapshot,
  getLatestSaleSnapshot,
};
