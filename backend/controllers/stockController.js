const db = require("../db");

exports.getAvailableStock = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        vpi.id AS stock_item_id,
        cv.id,
        cv.contact_id,
        COALESCE(vpi.engine_number, cv.engine_number) AS engine_number,
        COALESCE(vpi.chassis_number, cv.chassis_number) AS chassis_number,
        COALESCE(cv.vehicle_model, vm.model_name) AS vehicle_model,
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

    res.json({ success: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
