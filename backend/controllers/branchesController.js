// backend/controllers/branchesController.js
const db = require("../db");

// GET /api/branches  (all logged-in users) - for dropdown
exports.listBranches = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || "0") === "1";

    const [rows] = await db.query(
      `SELECT id, branch_name, address, is_active, created_at
       FROM showroom_branches
       ${includeInactive ? "" : "WHERE is_active = 1"}
       ORDER BY branch_name ASC, id ASC`
    );

    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error("listBranches error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/branches  (owner/admin)
exports.createBranch = async (req, res) => {
  try {
    const name = String(req.body?.branch_name || "").trim();
    const address = req.body?.address != null ? String(req.body.address).trim() : null;

    if (!name) return res.status(400).json({ success: false, message: "branch_name is required" });

    const [ins] = await db.query(
      `INSERT INTO showroom_branches (branch_name, address, is_active)
       VALUES (?,?,1)`,
      [name, address || null]
    );

    const [rows] = await db.query(
      `SELECT id, branch_name, address, is_active, created_at
       FROM showroom_branches WHERE id = ? LIMIT 1`,
      [ins.insertId]
    );

    return res.status(201).json({ success: true, data: rows?.[0] || { id: ins.insertId } });
  } catch (err) {
    console.error("createBranch error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/branches/:id  (owner/admin)
exports.updateBranch = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid branch id" });

    const branch_name = req.body?.branch_name != null ? String(req.body.branch_name).trim() : null;
    const address = req.body?.address != null ? String(req.body.address).trim() : null;
    const is_active =
      req.body?.is_active != null ? (Number(req.body.is_active) === 1 ? 1 : 0) : null;

    const sets = [];
    const params = [];

    if (branch_name !== null) {
      if (!branch_name) return res.status(400).json({ success: false, message: "branch_name cannot be empty" });
      sets.push("branch_name = ?");
      params.push(branch_name);
    }
    if (address !== null) {
      sets.push("address = ?");
      params.push(address || null);
    }
    if (is_active !== null) {
      sets.push("is_active = ?");
      params.push(is_active);
    }

    if (!sets.length) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    params.push(id);

    await db.query(`UPDATE showroom_branches SET ${sets.join(", ")} WHERE id = ?`, params);

    const [rows] = await db.query(
      `SELECT id, branch_name, address, is_active, created_at
       FROM showroom_branches WHERE id = ? LIMIT 1`,
      [id]
    );

    return res.json({ success: true, data: rows?.[0] || null });
  } catch (err) {
    console.error("updateBranch error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
