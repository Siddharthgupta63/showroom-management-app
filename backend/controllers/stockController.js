const db = require("../db");

exports.getAvailableStock = async (req, res) => {
  try {

    const [rows] = await db.query(`
      SELECT
        cv.id,
        cv.engine_number,
        cv.chassis_number,
        cv.vehicle_model,
        cv.color,
        cv.model_id,
        cv.variant_id,
        p.purchase_date,
        p.purchase_from
      FROM contact_vehicles cv
      LEFT JOIN vehicle_purchases p
        ON p.id = cv.purchase_id
      LEFT JOIN sales s
        ON s.contact_vehicle_id = cv.id
        AND s.is_cancelled = 0
      WHERE s.id IS NULL
      ORDER BY cv.id DESC
      LIMIT 500
    `);

    res.json({
      success: true,
      data: rows
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({
      success:false,
      message:"Server error"
    });
  }
};