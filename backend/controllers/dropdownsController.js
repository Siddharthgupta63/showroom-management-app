// backend/controllers/dropdownsController.js
const db = require("../db");

const ALLOWED_TYPES = new Set([
  "insurance_company",
  "insurance_broker",
  "finance_company",
  "tyre",
  "helmet",
  "branch",
  "vehicle_models",
  "vehicle_variants",
  "vehicle_make",
  "vehicle_color",
  "vehicle_purchase_from",
  "nominee_relation",
]);

function normType(t) {
  return String(t || "").trim().toLowerCase();
}
function normValue(v) {
  return String(v || "").trim();
}
function normLabel(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

exports.getDropdowns = async (req, res) => {
  // App usage: active only
  try {
    const typesParam = String(req.query.types || "").trim();
    const types = typesParam
      ? typesParam.split(",").map((x) => normType(x)).filter(Boolean)
      : Array.from(ALLOWED_TYPES);

    const safeTypes = types.filter((t) => ALLOWED_TYPES.has(t));
    if (safeTypes.length === 0) return res.json({ success: true, data: {} });

    const [rows] = await db.query(
      `
      SELECT id, type, value, label
      FROM dropdown_master
      WHERE is_active = 1 AND type IN (?)
      ORDER BY type ASC, value ASC
      `,
      [safeTypes]
    );

    const data = {};
    for (const t of safeTypes) data[t] = [];
    for (const r of rows) {
      if (!data[r.type]) data[r.type] = [];
      data[r.type].push({ id: r.id, value: r.value, label: r.label ?? null });
    }

    return res.json({ success: true, data });
  } catch (e) {
    console.error("getDropdowns:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getDropdownsAdmin = async (req, res) => {
  // Admin view: active + inactive
  try {
    const type = normType(req.query.type || "");
    const includeInactive = String(req.query.includeInactive || "1") === "1";

    let where = "WHERE 1=1";
    const params = [];

    if (type) {
      if (!ALLOWED_TYPES.has(type)) {
        return res.status(400).json({ success: false, message: "Invalid dropdown type" });
      }
      where += " AND type = ?";
      params.push(type);
    } else {
      where += " AND type IN (?)";
      params.push(Array.from(ALLOWED_TYPES));
    }

    if (!includeInactive) {
      where += " AND is_active = 1";
    }

    const [rows] = await db.query(
      `
      SELECT id, type, value, label, is_active, created_at
      FROM dropdown_master
      ${where}
      ORDER BY type ASC, value ASC
      `,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error("getDropdownsAdmin:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.addDropdownValue = async (req, res) => {
  // ✅ When type=branch: also create/activate showroom_branches
  let conn;
  try {
    const type = normType(req.params.type);
    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ success: false, message: "Invalid dropdown type" });
    }

    const value = normValue(req.body?.value);
    if (!value) {
      return res.status(400).json({ success: false, message: "Value is required" });
    }

    // label is OPTIONAL (used mainly for vehicle_color full form)
    const label = normLabel(req.body?.label);

    const userId = req.user?.id || null;

    conn = await db.getConnection();
    await conn.beginTransaction();

    if (type === "branch") {
      // Upsert into showroom_branches first (source of truth for branch_id)
      const [bRows] = await conn.query(
        `SELECT id FROM showroom_branches WHERE branch_name = ? LIMIT 1`,
        [value]
      );

      if (bRows.length > 0) {
        await conn.query(`UPDATE showroom_branches SET is_active = 1 WHERE id = ?`, [bRows[0].id]);
      } else {
        // insert -> your MySQL trigger will create dropdown_master row too
        await conn.query(
          `INSERT INTO showroom_branches (branch_name, address, is_active) VALUES (?,?,1)`,
          [value, null]
        );
      }
    }

    // ✅ Safe upsert for dropdown_master WITHOUT requiring a UNIQUE index
    const [existing] = await conn.query(
      `SELECT id FROM dropdown_master WHERE type = ? AND value = ? LIMIT 1`,
      [type, value]
    );

    if (existing.length > 0) {
      // reactivate + update label if provided (keeps value same)
      await conn.query(
        `UPDATE dropdown_master SET is_active = 1, label = COALESCE(?, label) WHERE id = ?`,
        [label, existing[0].id]
      );
    } else {
      await conn.query(
        `INSERT INTO dropdown_master (type, value, label, is_active, created_by) VALUES (?,?,?,?,?)`,
        [type, value, label, 1, userId]
      );
    }

    await conn.commit();
    return res.json({ success: true });
  } catch (e) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error("addDropdownValue:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (conn) conn.release();
  }
};

exports.setActive = async (req, res) => {
  // ✅ If disabling/enabling a branch dropdown, sync showroom_branches.is_active
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const isActive = Number(req.body?.is_active) === 1 ? 1 : 0;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, type, value FROM dropdown_master WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const row = rows[0];

    await conn.query(`UPDATE dropdown_master SET is_active = ? WHERE id = ?`, [isActive, id]);

    if (String(row.type).toLowerCase() === "branch") {
      await conn.query(
        `UPDATE showroom_branches SET is_active = ? WHERE branch_name = ?`,
        [isActive, row.value]
      );
    }

    await conn.commit();
    return res.json({ success: true });
  } catch (e) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error("setActive:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (conn) conn.release();
  }
};