const db = require("../db");

async function getContactLinksFromSale(sale_id) {
  if (!sale_id) return { contact_id: null, contact_vehicle_id: null };

  const [rows] = await db.query(
    `
    SELECT contact_id, contact_vehicle_id
    FROM sales
    WHERE id = ?
    LIMIT 1
    `,
    [sale_id]
  );

  if (!rows.length) {
    return { contact_id: null, contact_vehicle_id: null };
  }

  return {
    contact_id: rows[0].contact_id || null,
    contact_vehicle_id: rows[0].contact_vehicle_id || null,
  };
}

module.exports = {
  getContactLinksFromSale,
};