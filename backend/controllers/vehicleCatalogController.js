const db = require("../db");

// Models
exports.listModels = async (req, res) => {
  const [rows] = await db.query(`SELECT * FROM vehicle_models ORDER BY model_name`);
  res.json({ success: true, data: rows });
};

exports.createModel = async (req, res) => {
  const name = String(req.body?.model_name || "").trim();
  if (!name) return res.status(400).json({ success: false, message: "Model name required" });
  try {
    await db.query(`INSERT INTO vehicle_models (model_name,is_active) VALUES (?,1)`, [name]);
    res.json({ success: true });
  } catch (e) {
    if (String(e?.code) === "ER_DUP_ENTRY") return res.status(400).json({ success: false, message: "Model already exists" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.toggleModel = async (req, res) => {
  const id = Number(req.params.id);
  const is_active = Number(req.body?.is_active) === 1 ? 1 : 0;
  await db.query(`UPDATE vehicle_models SET is_active=? WHERE id=?`, [is_active, id]);
  res.json({ success: true });
};

// Variants
exports.listVariantsByModel = async (req, res) => {
  const modelId = Number(req.query.model_id);
  if (!modelId) return res.json({ success: true, data: [] });

  const [rows] = await db.query(
    `SELECT * FROM vehicle_variants WHERE model_id=? ORDER BY variant_name`,
    [modelId]
  );
  res.json({ success: true, data: rows });
};


exports.createVariant = async (req, res) => {
  const model_id = Number(req.body?.model_id);
  const variant_name = String(req.body?.variant_name || "").trim();
  if (!model_id) return res.status(400).json({ success: false, message: "model_id required" });
  if (!variant_name) return res.status(400).json({ success: false, message: "variant_name required" });

  try {
    await db.query(`INSERT INTO vehicle_variants (model_id, variant_name, is_active) VALUES (?,?,1)`, [model_id, variant_name]);
    res.json({ success: true });
  } catch (e) {
    if (String(e?.code) === "ER_DUP_ENTRY") return res.status(400).json({ success: false, message: "Variant already exists for this model" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.toggleVariant = async (req, res) => {
  const id = Number(req.params.id);
  const is_active = Number(req.body?.is_active) === 1 ? 1 : 0;
  await db.query(`UPDATE vehicle_variants SET is_active=? WHERE id=?`, [is_active, id]);
  res.json({ success: true });
};
