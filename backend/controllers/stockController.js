const db = require("../db");

// Full stock list for stock page
exports.getAllStock = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        vpi.id,
        vpi.purchase_id,
        vpi.chassis_number,
        vpi.engine_number,
        vpi.model_id,
        vpi.variant_id,
        vpi.color,
        vpi.purchase_price,
        vpi.status_code,
        vpi.booked_at,
        vpi.sold_at,
        vpi.delivered_at,
        vpi.sale_id,
        vpi.contact_vehicle_id,

        vp.purchase_from,
        vp.entry_type,
        vp.document_number,
        vp.document_date,
        vp.invoice_pending,
        vp.supplier_name,
        vp.received_date,
        vp.invoice_number,
        vp.invoice_date,
        vp.purchase_date,

        vm.model_name,
        vv.variant_name,
        sb.branch_name

      FROM vehicle_purchase_items vpi
      LEFT JOIN vehicle_purchases vp
        ON vp.id = vpi.purchase_id
      LEFT JOIN vehicle_models vm
        ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv
        ON vv.id = vpi.variant_id
      LEFT JOIN showroom_branches sb
        ON sb.id = vp.branch_id

      ORDER BY vpi.id DESC
    `);

    return res.json({
      success: true,
      total: Array.isArray(rows) ? rows.length : 0,
      data: rows || [],
    });
  } catch (e) {
    console.error("getAllStock error:", e);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Only available stock for sale/vehicle picker
exports.getAvailableStock = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        vpi.id AS stock_item_id,
        cv.id,
        cv.contact_id,
        COALESCE(vpi.engine_number, cv.engine_number) AS engine_number,
        COALESCE(vpi.chassis_number, cv.chassis_number) AS chassis_number,
        COALESCE(cv.vehicle_model, vm.model_name) AS vehicle_model,
        vm.model_name,
        vv.variant_name,
        vpi.color,
        vpi.model_id,
        vpi.variant_id,
        vp.purchase_date,
        vp.purchase_from,
        vpi.status_code AS stock_status
      FROM vehicle_purchase_items vpi
      LEFT JOIN contact_vehicles cv ON cv.id = vpi.contact_vehicle_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN vehicle_purchases vp ON vp.id = vpi.purchase_id
      WHERE vpi.status_code = 'in_stock'
      ORDER BY vpi.id DESC
      LIMIT 500
    `);

    return res.json({
      success: true,
      total: Array.isArray(rows) ? rows.length : 0,
      data: rows || [],
    });
  } catch (e) {
    console.error("getAvailableStock error:", e);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};