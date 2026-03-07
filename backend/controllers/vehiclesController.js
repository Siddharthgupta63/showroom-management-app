// backend/controllers/vehiclesController.js
const db = require("../db");
const fs = require("fs");
const ExcelJS = require("exceljs");
const excelUpload = require("../middleware/excelUpload");
const pdfParse = require("pdf-parse");

// ✅ OCR deps (NEW)
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

// ✅ Use tesseract.js if installed (npm i tesseract.js)
let createWorker = null;
try {
  ({ createWorker } = require("tesseract.js"));
} catch (e) {
  createWorker = null;
}

// =====================================================
// ✅ PHASE-1 NEW: pagination helpers
// =====================================================
function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function getPageParams(req, defaults = { page: 1, pageSize: 50 }) {
  const page = clampInt(req.query.page, defaults.page, 1, 1000000);
  const pageSize = clampInt(req.query.pageSize, defaults.pageSize, 1, 300);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

// ✅ PHASE-1 NEW: build WHERE for smart search
function buildVehiclesWhere(req) {
  const q = String(req.query.q || "").trim();

  const chassis = String(req.query.chassis_number || req.query.chassis || "").trim();
  const engine = String(req.query.engine_number || req.query.engine || "").trim();
  const model = String(req.query.model || "").trim();
  const variant = String(req.query.variant || "").trim();
  const color = String(req.query.color || "").trim();

  const contactId = req.query.contact_id ? Number(req.query.contact_id) : null;

  const where = ["1=1"];
  const params = [];

  const includeDeleted = String(req.query.includeDeleted || "0") === "1";
  const role = String(req.user?.role || "").toLowerCase();
  const isOwnerAdmin = role === "owner" || role === "admin";

  if (!(includeDeleted && isOwnerAdmin)) {
    where.push("cv.is_deleted = 0");
  }

  if (contactId) {
    where.push("cv.contact_id = ?");
    params.push(contactId);
  }

  if (chassis) {
    where.push("cv.chassis_number LIKE ?");
    params.push(`%${chassis}%`);
  }
  if (engine) {
    where.push("cv.engine_number LIKE ?");
    params.push(`%${engine}%`);
  }
  if (model) {
    where.push("(COALESCE(vm.model_name,'') LIKE ? OR COALESCE(cv.vehicle_model,'') LIKE ?)");
    params.push(`%${model}%`, `%${model}%`);
  }
  if (variant) {
    where.push("COALESCE(vv.variant_name,'') LIKE ?");
    params.push(`%${variant}%`);
  }
  if (color) {
    where.push("COALESCE(cv.color,'') LIKE ?");
    params.push(`%${color}%`);
  }

  if (q) {
    const like = `%${q}%`;
    where.push(`
      (
        cv.chassis_number LIKE ?
        OR cv.engine_number LIKE ?
        OR COALESCE(vm.model_name,'') LIKE ?
        OR COALESCE(vv.variant_name,'') LIKE ?
        OR COALESCE(cv.vehicle_make,'') LIKE ?
        OR COALESCE(cv.vehicle_model,'') LIKE ?
        OR COALESCE(cv.color,'') LIKE ?
        OR CAST(cv.contact_id AS CHAR) LIKE ?
      )
    `);
    params.push(like, like, like, like, like, like, like, like);
  }

  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

// =====================================================
// GET /api/vehicles?q=&contact_id=
// =====================================================
exports.listSearch = async (req, res) => {
  try {
    const { page, pageSize, offset } = getPageParams(req);
    const { whereSql, params } = buildVehiclesWhere(req);

    const baseFrom = `
      FROM contact_vehicles cv
      LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id

      -- ✅ sold lookup (no duplicates)
      LEFT JOIN (
        SELECT contact_vehicle_id, MIN(id) AS sale_id
        FROM sales
        WHERE is_cancelled = 0 AND contact_vehicle_id IS NOT NULL
        GROUP BY contact_vehicle_id
      ) sold ON sold.contact_vehicle_id = cv.id

      ${whereSql}
    `;

    const [countRows] = await db.query(`SELECT COUNT(*) AS total ${baseFrom}`, params);
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await db.query(
      `
      SELECT
        cv.id,
        cv.contact_id,
        cv.chassis_number,
        cv.engine_number,
        cv.model_id,
        cv.variant_id,
        cv.vehicle_make,
        cv.vehicle_model,
        cv.color,
        cv.created_at,
        vm.model_name,
        vv.variant_name,
        (sold.sale_id IS NOT NULL) AS is_sold,
        sold.sale_id AS sold_sale_id
      ${baseFrom}
      ORDER BY cv.created_at DESC, cv.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    return res.json({ success: true, data: rows, page, pageSize, total });
  } catch (e) {
    console.error("vehicles listSearch:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ PHASE-1 NEW: fetch full vehicle row for conflict response
async function fetchVehicleByWhere(whereSql, params) {
  const [rows] = await db.query(
    `
    SELECT
      cv.id,
      cv.contact_id,
      cv.chassis_number,
      cv.engine_number,
      cv.model_id,
      cv.variant_id,
      cv.vehicle_make,
      cv.vehicle_model,
      cv.color,
      cv.created_at,
      vm.model_name,
      vv.variant_name
    FROM contact_vehicles cv
    LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
    LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
    ${whereSql}
    LIMIT 1
    `,
    params
  );
  return rows?.[0] || null;
}

// =====================================================
// POST /api/vehicles
// =====================================================
exports.createVehicle = async (req, res) => {
  try {
    const contact_id_raw = req.body?.contact_id;
    const contact_id = contact_id_raw ? Number(contact_id_raw) : null;

    const chassis_number = String(req.body?.chassis_number || "").trim();
    const engine_number = String(req.body?.engine_number || "").trim();

    const model_id = req.body?.model_id ? Number(req.body.model_id) : null;
    const variant_id = req.body?.variant_id ? Number(req.body.variant_id) : null;

    const vehicle_make = req.body?.vehicle_make ? String(req.body.vehicle_make).trim() : "Hero";
    const vehicle_model = req.body?.vehicle_model ? String(req.body.vehicle_model).trim() : null;
    const color = req.body?.color ? String(req.body.color).trim() : null;

    if (!chassis_number) return res.status(400).json({ success: false, message: "chassis_number is required" });
    if (!engine_number) return res.status(400).json({ success: false, message: "engine_number is required" });

    if (contact_id) {
      const [c] = await db.query(`SELECT id FROM contacts WHERE id=? LIMIT 1`, [contact_id]);
      if (!c.length) return res.status(400).json({ success: false, message: "Contact not found" });
    }

    try {
      const [ins] = await db.query(
        `INSERT INTO contact_vehicles
          (contact_id, chassis_number, engine_number, model_id, variant_id, vehicle_make, vehicle_model, color)
         VALUES (?,?,?,?,?,?,?,?)`,
        [contact_id, chassis_number, engine_number, model_id, variant_id, vehicle_make, vehicle_model, color]
      );

      const created = await fetchVehicleByWhere("WHERE cv.id = ?", [ins.insertId]);
      return res.status(201).json({ success: true, data: created });
    } catch (e) {
      if (String(e?.code) === "ER_DUP_ENTRY") {
        let existing = await fetchVehicleByWhere("WHERE cv.chassis_number = ?", [chassis_number]);
        let conflictKey = "chassis_number";

        if (!existing) {
          existing = await fetchVehicleByWhere("WHERE cv.engine_number = ?", [engine_number]);
          conflictKey = "engine_number";
        }

        return res.status(409).json({
          success: false,
          message: existing
            ? `Duplicate ${conflictKey} (Vehicle ID ${existing.id}). Use existing vehicle.`
            : "Duplicate vehicle found.",
          existing: existing || null,
        });
      }
      throw e;
    }
  } catch (e) {
    console.error("vehicles createVehicle:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// GET /api/vehicles/_import/template
// =====================================================
exports.downloadImportTemplate = async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Vehicles");

    ws.columns = [
      { header: "contact_id (optional)", key: "contact_id", width: 18 },
      { header: "model_name", key: "model_name", width: 22 },
      { header: "variant_name", key: "variant_name", width: 22 },
      { header: "vehicle_make", key: "vehicle_make", width: 14 },
      { header: "vehicle_model", key: "vehicle_model", width: 22 },
      { header: "color", key: "color", width: 12 },
      { header: "chassis_number*", key: "chassis_number", width: 20 },
      { header: "engine_number*", key: "engine_number", width: 20 },
    ];

    ws.addRow({
      contact_id: "",
      model_name: "Splendor Plus",
      variant_name: "i3S",
      vehicle_make: "Hero",
      vehicle_model: "Splendor Plus i3S",
      color: "Black",
      chassis_number: "CH123456789",
      engine_number: "EN987654321",
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="vehicles_import_template.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("vehicles template:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// GET /api/vehicles/_export?q=
// =====================================================
exports.exportVehiclesExcel = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;

    let sql = `
      SELECT
        cv.id,
        cv.contact_id,
        vm.model_name,
        vv.variant_name,
        cv.vehicle_make,
        cv.vehicle_model,
        cv.color,
        cv.chassis_number,
        cv.engine_number,
        cv.created_at
      FROM contact_vehicles cv
      LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
      LEFT JOIN (
        SELECT contact_vehicle_id, MIN(id) AS sale_id
        FROM sales
        WHERE is_cancelled = 0 AND contact_vehicle_id IS NOT NULL
        GROUP BY contact_vehicle_id
      ) sold ON sold.contact_vehicle_id = cv.id

      WHERE 1=1 AND cv.is_deleted = 0
    `;

    const params = [];
    if (q) {
      sql += `
        AND (
          cv.chassis_number LIKE ?
          OR cv.engine_number LIKE ?
          OR COALESCE(vm.model_name,'') LIKE ?
          OR COALESCE(vv.variant_name,'') LIKE ?
          OR COALESCE(cv.vehicle_make,'') LIKE ?
          OR COALESCE(cv.vehicle_model,'') LIKE ?
          OR COALESCE(cv.color,'') LIKE ?
          OR CAST(cv.contact_id AS CHAR) LIKE ?
        )
      `;
      params.push(like, like, like, like, like, like, like, like);
    }

    sql += ` ORDER BY cv.created_at DESC, cv.id DESC LIMIT 5000`;

    const [rows] = await db.query(sql, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Vehicles");

    ws.columns = [
      { header: "id", key: "id", width: 8 },
      { header: "contact_id", key: "contact_id", width: 12 },
      { header: "model_name", key: "model_name", width: 22 },
      { header: "variant_name", key: "variant_name", width: 22 },
      { header: "vehicle_make", key: "vehicle_make", width: 14 },
      { header: "vehicle_model", key: "vehicle_model", width: 22 },
      { header: "color", key: "color", width: 12 },
      { header: "chassis_number", key: "chassis_number", width: 20 },
      { header: "engine_number", key: "engine_number", width: 20 },
      { header: "created_at", key: "created_at", width: 22 },
    ];

    rows.forEach((r) => ws.addRow(r));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="vehicles_export.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("vehicles export:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// POST /api/vehicles/_import
// =====================================================
exports.importVehiclesExcel = [
  excelUpload.single("file"),
  async (req, res) => {
    let filepath = null;
    try {
      filepath = req.file?.path;
      if (!filepath) return res.status(400).json({ success: false, message: "Excel file required" });

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filepath);
      const ws = wb.worksheets[0];
      if (!ws) return res.status(400).json({ success: false, message: "Invalid Excel" });

      const [models] = await db.query(`SELECT id, model_name FROM vehicle_models WHERE is_active=1`);
      const modelMap = new Map(models.map((m) => [String(m.model_name).toLowerCase(), m.id]));

      const [variants] = await db.query(`SELECT id, model_id, variant_name FROM vehicle_variants WHERE is_active=1`);
      const variantMap = new Map(
        variants.map((v) => [`${v.model_id}::${String(v.variant_name).toLowerCase()}`, v.id])
      );

      const header = {};
      ws.getRow(1).eachCell((cell, col) => {
        header[String(cell.value || "").trim().toLowerCase()] = col;
      });

      const get = (row, key) => {
        const c = header[key];
        if (!c) return "";
        return String(row.getCell(c).value || "").trim();
      };

      let inserted = 0;
      const errors = [];

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);

        const contact_id_str = get(row, "contact_id (optional)") || get(row, "contact_id");
        const contact_id = contact_id_str ? Number(contact_id_str) : null;

        const model_name = get(row, "model_name");
        const variant_name = get(row, "variant_name");
        const vehicle_make = get(row, "vehicle_make") || "Hero";
        const vehicle_model = get(row, "vehicle_model") || null;
        const color = get(row, "color") || null;

        const chassis_number = String(get(row, "chassis_number*") || get(row, "chassis_number")).trim();
        const engine_number = String(get(row, "engine_number*") || get(row, "engine_number")).trim();

        if (!chassis_number || !engine_number) continue;

        if (contact_id) {
          const [c] = await db.query(`SELECT id FROM contacts WHERE id=? LIMIT 1`, [contact_id]);
          if (!c.length) {
            errors.push(`Row ${r}: contact_id not found`);
            continue;
          }
        }

        let model_id = null;
        let variant_id = null;

        if (model_name) model_id = modelMap.get(String(model_name).toLowerCase()) || null;
        if (model_id && variant_name) {
          variant_id = variantMap.get(`${model_id}::${String(variant_name).toLowerCase()}`) || null;
        }

        try {
          await db.query(
            `INSERT INTO contact_vehicles
              (contact_id, chassis_number, engine_number, model_id, variant_id, vehicle_make, vehicle_model, color)
             VALUES (?,?,?,?,?,?,?,?)`,
            [contact_id, chassis_number, engine_number, model_id, variant_id, vehicle_make, vehicle_model, color]
          );
          inserted++;
        } catch (e) {
          if (String(e?.code) === "ER_DUP_ENTRY") errors.push(`Row ${r}: duplicate chassis/engine`);
          else errors.push(`Row ${r}: ${e?.message || "error"}`);
        }
      }

      return res.json({ success: true, inserted, errors });
    } catch (e) {
      console.error("vehicles import:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      try {
        if (filepath && fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch {}
    }
  },
];

// =====================================================
// GET /api/vehicles/:id
// =====================================================
exports.getVehicleById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ success: false, message: "Invalid ID" });

    const role = String(req.user?.role || "").toLowerCase();
    const isOwnerAdmin = role === "owner" || role === "admin";
    const includeDeleted = String(req.query.includeDeleted || "0") === "1";

    const where = includeDeleted && isOwnerAdmin ? "cv.id = ?" : "cv.id = ? AND cv.is_deleted = 0";

    const [rows] = await db.query(
      `
      SELECT
        cv.id,
        cv.contact_id,
        cv.chassis_number,
        cv.engine_number,
        cv.model_id,
        cv.variant_id,
        cv.vehicle_make,
        cv.vehicle_model,
        cv.color,
        cv.created_at,
        cv.is_deleted,
        cv.deleted_at,
        cv.deleted_by,
        vm.model_name,
        vv.variant_name
      FROM contact_vehicles cv
      LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
      WHERE ${where}
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Vehicle not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error("vehicles getVehicleById:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// GET /api/vehicles/:id/sales
// =====================================================
exports.getVehicleSales = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid ID" });

    const [rows] = await db.query(
      `
      SELECT id AS sale_id
      FROM sales
      WHERE contact_vehicle_id = ?
        AND is_cancelled = 0
      ORDER BY id DESC
      `,
      [id]
    );

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error("vehicles getVehicleSales:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// DELETE /api/vehicles/:id
// =====================================================
exports.deleteVehicle = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ success: false, message: "Invalid ID" });

    const [linkedAny] = await db.query(`SELECT id FROM sales WHERE contact_vehicle_id = ? LIMIT 1`, [id]);
    if (linkedAny.length) {
      return res.status(400).json({ success: false, message: "Vehicle is linked to a sale. Cannot delete." });
    }

    const [linkedLinks] = await db.query(`SELECT id FROM sale_vehicle_links WHERE vehicle_id = ? LIMIT 1`, [id]);
    if (linkedLinks.length) {
      return res.status(400).json({ success: false, message: "Vehicle is linked in sale history. Cannot delete." });
    }

    const userId = req.user?.id || null;
    const [upd] = await db.query(
      `
      UPDATE contact_vehicles
      SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
      WHERE id = ? AND is_deleted = 0
      `,
      [userId, id]
    );

    if (!upd.affectedRows) {
      return res.status(404).json({ success: false, message: "Vehicle not found (or already deleted)" });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("vehicles deleteVehicle:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// PUT /api/vehicles/:id
// =====================================================
exports.updateVehicle = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ success: false, message: "Invalid ID" });

    const role = String(req.user?.role || "").toLowerCase();
    const canEditChassisEngine = role === "owner" || role === "admin" || role === "manager";

    const [vehicleRows] = await db.query(
      `SELECT id, is_deleted, chassis_number, engine_number
       FROM contact_vehicles
       WHERE id=? LIMIT 1`,
      [id]
    );

    if (!vehicleRows.length) return res.status(404).json({ success: false, message: "Vehicle not found" });
    if (Number(vehicleRows[0].is_deleted) === 1)
      return res.status(400).json({ success: false, message: "Vehicle is deleted." });

    const [saleRows] = await db.query(`SELECT id FROM sales WHERE contact_vehicle_id = ? LIMIT 1`, [id]);
    const hasSale = saleRows.length > 0;

    const contact_id = req.body?.contact_id ? Number(req.body.contact_id) : null;
    const model_id = req.body?.model_id ? Number(req.body.model_id) : null;
    const variant_id = req.body?.variant_id ? Number(req.body.variant_id) : null;
    const vehicle_make = req.body?.vehicle_make || null;
    const vehicle_model = req.body?.vehicle_model || null;
    const color = req.body?.color || null;

    let chassis_number = vehicleRows[0].chassis_number;
    let engine_number = vehicleRows[0].engine_number;

    if (!hasSale && canEditChassisEngine) {
      if (req.body?.chassis_number) chassis_number = String(req.body.chassis_number).trim();
      if (req.body?.engine_number) engine_number = String(req.body.engine_number).trim();
    }

    if (hasSale && (req.body?.chassis_number || req.body?.engine_number)) {
      return res.status(400).json({ success: false, message: "Cannot edit chassis/engine after sale is created." });
    }

    await db.query(
      `
      UPDATE contact_vehicles
      SET contact_id=?, model_id=?, variant_id=?, vehicle_make=?, vehicle_model=?, color=?,
          chassis_number=?, engine_number=?
      WHERE id=? AND is_deleted=0
      `,
      [contact_id, model_id, variant_id, vehicle_make, vehicle_model, color, chassis_number, engine_number, id]
    );

    return res.json({ success: true });
  } catch (e) {
    console.error("vehicles updateVehicle:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// GET /api/vehicles/:id/timeline
// =====================================================
exports.getVehicleTimeline = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ success: false, message: "Invalid ID" });

    const [v] = await db.query(`SELECT id, created_at FROM contact_vehicles WHERE id=? LIMIT 1`, [id]);
    if (!v.length) return res.status(404).json({ success: false, message: "Vehicle not found" });

    const createdAt = v[0].created_at;

    const [sales] = await db.query(
      `
      SELECT id AS sale_id, sale_date, created_at, is_cancelled, cancelled_at
      FROM sales
      WHERE contact_vehicle_id = ?
      ORDER BY id ASC
      `,
      [id]
    );

    const events = [{ type: "CREATED", at: createdAt, meta: {} }];

    for (const s of sales) {
      events.push({ type: "SOLD", at: s.sale_date || s.created_at, meta: { sale_id: s.sale_id } });
      if (Number(s.is_cancelled) === 1) {
        events.push({ type: "CANCELLED", at: s.cancelled_at || s.created_at, meta: { sale_id: s.sale_id } });
      }
    }

    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return res.json({ success: true, data: events });
  } catch (e) {
    console.error("vehicles getVehicleTimeline:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// INVOICE PDF -> Extract (pdf-parse + OCR fallback)
// =====================================================
function cleanLine(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function collapseSpacedCodes(s) {
  let x = String(s || "");
  x = x.replace(/(?:\b[A-Z0-9]\b[\s\n\r]+){8,}\b[A-Z0-9]\b/gi, (m) => m.replace(/[\s\n\r]+/g, ""));
  x = x.replace(/\bP\s*C\b/gi, "PC");
  return x;
}

function normalizeToken(tok) {
  return String(tok || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

// ✅ Robust Hero extractor (existing)
function extractHeroEngineChassisPairs(text) {
  const raw = collapseSpacedCodes(String(text || "").replace(/\r/g, "\n"));
  const lines = raw.split(/\n+/).map(cleanLine).filter(Boolean);

  const ENGINE_RE = /\b(?:HA|JA)[A-Z0-9]{8,18}\b/i;
  const CHASSIS_RE = /\bMBL[A-Z0-9]{10,25}\b/i;

  const pairs = [];
  const seen = new Set();

  // ✅ 1) Line-based (best)
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    const mE = line.match(ENGINE_RE);
    const mC = line.match(CHASSIS_RE);
    if (!mE || !mC) continue;

    const engine = normalizeToken(mE[0]);
    const chassis = normalizeToken(mC[0]);

    if (!/^(HA|JA)/.test(engine)) continue;
    if (!/^MBL/.test(chassis)) continue;

    const k = `${engine}__${chassis}`;
    if (seen.has(k)) continue;
    seen.add(k);

    // ✅ capture hint text around line (helps color/model detection)
    const hint = lines[idx] || "";

    pairs.push({ engine_number: engine, chassis_number: chassis, hint_text: hint });
  }

  if (pairs.length) return pairs;

  // ✅ 2) Token scan fallback (keep old, but hint_text will be empty)
  const allTokens = raw
    .replace(/[,;|]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

  const engines = [];
  const chassis = [];

  for (let i = 0; i < allTokens.length; i++) {
    const t = allTokens[i];

    if ((t.startsWith("HA") || t.startsWith("JA")) && t.length >= 10 && t.length <= 18) {
      engines.push({ v: t, i });
    }
    if (t.startsWith("MBL") && t.length >= 15 && t.length <= 25) {
      chassis.push({ v: t, i });
    }
  }

  if (!engines.length || !chassis.length) return [];

  const usedCh = new Set();
  const MAX_DIST_TOKENS = 8;

  for (const e of engines) {
    let best = null;
    let bestScore = Infinity;

    for (const c of chassis) {
      if (usedCh.has(c.v)) continue;

      const dist = Math.abs(e.i - c.i);
      const penalty = c.i < e.i ? 2 : 0;
      const score = dist + penalty;

      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (best && bestScore <= MAX_DIST_TOKENS) {
      usedCh.add(best.v);
      const k = `${e.v}__${best.v}`;
      if (!seen.has(k)) {
        seen.add(k);
        pairs.push({ engine_number: e.v, chassis_number: best.v, hint_text: "" });
      }
    }
  }

  return pairs;
}

// ----------------------------
// ✅ Phase-2: Color normalize + detect
// ----------------------------
const COLOR_MAP = new Map([
  ["BLK", "Black"],
  ["BLACK", "Black"],
  ["RED", "Red"],
  ["BLUE", "Blue"],
  ["WH", "White"],
  ["WHT", "White"],
  ["WHITE", "White"],
  ["SILVER", "Silver"],
  ["GREY", "Grey"],
  ["GRAY", "Grey"],
  ["YELLOW", "Yellow"],
  ["GREEN", "Green"],
  ["MAROON", "Maroon"],
  ["BROWN", "Brown"],
  ["ORANGE", "Orange"],
  ["PURPLE", "Purple"],
  ["GOLD", "Gold"],
]);

function toTitleCase(s) {
  const x = String(s || "").trim();
  if (!x) return "";
  return x
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeColor(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;
  const key = normalizeToken(raw);
  if (COLOR_MAP.has(key)) return COLOR_MAP.get(key);
  // sometimes like "BLACK/RED" or "BLK RED"
  const parts = raw.split(/[\/,|]+/).map((p) => normalizeToken(p)).filter(Boolean);
  for (const p of parts) {
    if (COLOR_MAP.has(p)) return COLOR_MAP.get(p);
  }
  return toTitleCase(raw);
}

// ✅ Hero invoices often use 3-letter color codes in table (BKB/BHG/MAG etc)
// Example: "HF DELUXE HDLHADRSCFI BKB 87112029 PC HA... MBL..."
const HERO_COLOR_CODE_MAP = {
  // common Hero codes seen in your invoices
  BKB: "Black",
  BKG: "Black", // your invoice code
  BHG: "Black", // your invoice code

  BLK: "Black",
  BK: "Black",

  // add more later if needed:
  // RED: "Red",
  // WH: "White",
};

function detectColorFromHintLine(hint) {
  const line = String(hint || "").toUpperCase();

  // Pattern: "... BHG 87112029 PC HA11..."
  const m = line.match(/\b([A-Z]{2,4})\b\s+\b\d{8}\b/);
  if (!m) return { color: null, code: null };

  const code = String(m[1] || "").toUpperCase();

  if (HERO_COLOR_CODE_MAP[code]) return { color: HERO_COLOR_CODE_MAP[code], code };

  if (code.includes("BK")) return { color: "Black", code };

  return { color: null, code };
}

// heuristic detect color near "Color" keyword OR anywhere in doc using common tokens
function detectColorFromText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return null;

  const m1 = raw.match(/\b(?:COLOUR|COLOR)\s*[:\-]?\s*([A-Z][A-Z\s\/]{2,25})\b/i);
if (m1) {
  const captured = String(m1[1] || "").trim();
  // ❌ invoice header: "Color HSN No" -> ignore
  if (/hsn/i.test(captured)) {
    // ignore
  } else {
    const c = normalizeColor(captured);
    if (c) return c;
  }
}

  // common pattern in tables: "... BLACK ..." OR "... BLK ..."
  const tokens = raw
    .replace(/\r/g, "\n")
    .replace(/[,;|]/g, " ")
    .split(/\s+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean);

  for (const t of tokens) {
    if (COLOR_MAP.has(t)) return COLOR_MAP.get(t);
  }

  return null;
}

function detectColorForPair(pairHintText, fullText) {
  // try near-row first
  const near = detectColorFromText(pairHintText || "");
  if (near) return near;

  // fallback to whole invoice
  return detectColorFromText(fullText || "");
}

// ----------------------------
// ✅ Phase-2: Model/Variant detection (DB-driven)
// ----------------------------
function normTextForMatch(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// returns { model_id, model_name, variant_id, variant_name, debug }
async function detectModelVariantFromText(text) {
  const t = normTextForMatch(text);
  if (!t) return { model_id: null, model_name: null, variant_id: null, variant_name: null, debug: { reason: "empty_text" } };

  const [models] = await db.query(`SELECT id, model_name FROM vehicle_models WHERE is_active=1`);
  let bestModel = null;

  // prefer longer names first to avoid partial clashes
  const modelSorted = (models || [])
    .map((m) => ({ id: Number(m.id), name: String(m.model_name || "") }))
    .filter((m) => m.id && m.name)
    .sort((a, b) => b.name.length - a.name.length);

  for (const m of modelSorted) {
    const needle = normTextForMatch(m.name);
    if (!needle) continue;
    if (t.includes(needle)) {
      bestModel = m;
      break;
    }
  }

  if (!bestModel) {
    return {
      model_id: null,
      model_name: null,
      variant_id: null,
      variant_name: null,
      debug: { reason: "no_model_match" },
    };
  }

  const [variants] = await db.query(
    `SELECT id, model_id, variant_name FROM vehicle_variants WHERE is_active=1 AND model_id=?`,
    [bestModel.id]
  );

  let bestVariant = null;
  const variantSorted = (variants || [])
    .map((v) => ({ id: Number(v.id), model_id: Number(v.model_id), name: String(v.variant_name || "") }))
    .filter((v) => v.id && v.name)
    .sort((a, b) => b.name.length - a.name.length);

  for (const v of variantSorted) {
    const needle = normTextForMatch(v.name);
    if (!needle) continue;
    if (t.includes(needle)) {
      bestVariant = v;
      break;
    }
  }

  return {
    model_id: bestModel.id,
    model_name: bestModel.name,
    variant_id: bestVariant ? bestVariant.id : null,
    variant_name: bestVariant ? bestVariant.name : null,
    debug: {
      reason: bestVariant ? "model+variant_match" : "model_only_match",
      matched_model: bestModel.name,
      matched_variant: bestVariant?.name || null,
    },
  };
}

async function detectModelVariantForPair(pairHintText, combinedText) {
  // 1) try only the line around engine/chassis (best)
  const mvNear = await detectModelVariantFromText(pairHintText || "");
  if (mvNear?.model_id) return mvNear;

  // 2) fallback to entire invoice
  return await detectModelVariantFromText(combinedText || "");
}

// ----------------------------
// ✅ Phase-2: Duplicate detection helper (preview stage + create stage)
// ----------------------------
async function getDuplicateStatus(engine_number, chassis_number) {
  const eng = normalizeToken(engine_number);
  const chs = normalizeToken(chassis_number);

  if (!eng || !chs) {
    return { code: "INVALID", label: "Invalid", vehicle_id: null, sale_id: null, is_sold: false, is_unlinked: false };
  }

  // Find existing by chassis OR engine (unique both)
  const [rows] = await db.query(
    `
    SELECT
      cv.id,
      cv.contact_id,
      cv.is_deleted,
      s.id AS sale_id
    FROM contact_vehicles cv
    LEFT JOIN sales s
      ON s.contact_vehicle_id = cv.id
     AND s.is_cancelled = 0
    WHERE cv.chassis_number = ? OR cv.engine_number = ?
    ORDER BY cv.id DESC
    LIMIT 1
    `,
    [chs, eng]
  );

  if (!rows.length) {
    return { code: "NEW", label: "New", vehicle_id: null, sale_id: null, is_sold: false, is_unlinked: false };
  }

  const r = rows[0];
  const vehicle_id = Number(r.id);
  const sale_id = r.sale_id ? Number(r.sale_id) : null;
  const is_sold = !!sale_id;
  const is_unlinked = !r.contact_id; // contact_id NULL -> unlinked

  if (is_sold) {
    return { code: "SOLD", label: `Already Sold (Sale ID: ${sale_id})`, vehicle_id, sale_id, is_sold: true, is_unlinked };
  }

  if (is_unlinked) {
    return { code: "UNLINKED", label: `Exists but Unlinked (Vehicle ID: ${vehicle_id})`, vehicle_id, sale_id: null, is_sold: false, is_unlinked: true };
  }

  return { code: "DUPLICATE", label: `Already Exists (Vehicle ID: ${vehicle_id})`, vehicle_id, sale_id: null, is_sold: false, is_unlinked: false };
}

// =====================================================
// Duplicate Preview API (manual inline preview)
// POST /api/vehicles/_duplicate/status
// Body: { engine_number, chassis_number }
// =====================================================
exports.duplicateStatus = async (req, res) => {
  try {
    const engine_number = String(req.body?.engine_number || "").trim();
    const chassis_number = String(req.body?.chassis_number || "").trim();

    const status = await getDuplicateStatus(engine_number, chassis_number);
    return res.json({ success: true, status });
  } catch (e) {
    console.error("vehicles duplicateStatus:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// Bulk Duplicate Preview API
// POST /api/vehicles/_duplicate/status-bulk
// Body: { vehicles: [{engine_number, chassis_number}] }
// =====================================================
exports.duplicateStatusBulk = async (req, res) => {
  try {
    const list = Array.isArray(req.body?.vehicles) ? req.body.vehicles : [];
    if (!list.length) return res.json({ success: true, data: [] });

    const out = [];
    for (const row of list) {
      const engine_number = String(row?.engine_number || "").trim();
      const chassis_number = String(row?.chassis_number || "").trim();
      const status = await getDuplicateStatus(engine_number, chassis_number);
      out.push({ engine_number, chassis_number, status });
    }

    return res.json({ success: true, data: out });
  } catch (e) {
    console.error("vehicles duplicateStatusBulk:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// parseInvoiceText (enhanced, preserves old logic)
// =====================================================
function parseInvoiceText(text, opts = {}) {
  const out = {
    invoice_number: null,
    invoice_date: null,
    customer_name: null,
    customer_phone: null,
    vehicles: [],
    raw_hint: null,
  };

  const raw = String(text || "").replace(/\r/g, "\n");

  // ---------------- HEADER (keep old behavior) ----------------
  const inv = raw.match(/Invoice\s*#\s*([A-Z0-9\-\/]+)\b/i);
  if (inv) out.invoice_number = inv[1];

  const dt = raw.match(/\bDate\s+(\d{2}\/\d{2}\/\d{4})\b/i);
  if (dt) out.invoice_date = dt[1];

  const cn = raw.match(/Name of the Customer\s+([^\n\r]+)/i);
  if (cn) out.customer_name = String(cn[1] || "").trim();

  const cp10 = raw.match(/\b(\d{10})\b/);
  if (cp10) out.customer_phone = cp10[1];

  // ---------------- VEHICLES ----------------
  const pairs = extractHeroEngineChassisPairs(raw);

  out._pairs_raw = pairs;

  // ✅ Phase-2: color, model, variant from text (global heuristics)
  // (Best effort — if not detected -> null and frontend defaults to Other)
  out.vehicles = pairs.map((p) => ({
    model: null,
    variant: null,
    color: null,
    engine_number: p.engine_number,
    chassis_number: p.chassis_number,
  }));

  if (!out.vehicles.length) {
    out.raw_hint = "No vehicle rows found. (Hero invoice detected but engine/chassis not found in text).";
  }

  return out;
}

// =====================================================
// OCR HELPERS
// =====================================================
function execFileAsync(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }));
      resolve({ stdout, stderr });
    });
  });
}

async function makeTesseractWorker() {
  if (!createWorker) throw new Error("tesseract.js not installed");

  let worker = null;

  try {
    worker = await createWorker("eng");
  } catch {
    worker = await createWorker();
  }

  if (worker && typeof worker.loadLanguage === "function") {
    await worker.loadLanguage("eng");
  }
  if (worker && typeof worker.initialize === "function") {
    await worker.initialize("eng");
  }

  if (worker && typeof worker.reinitialize === "function") {
    try {
      await worker.reinitialize("eng");
    } catch {}
  }

  return worker;
}

async function ocrPdfToText(pdfPath) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdfocr-"));
  const prefix = path.join(workDir, "page");

  try {
const pdftoppmBin = process.env.PDFTOPPM_BIN || "pdftoppm";
await execFileAsync(pdftoppmBin, ["-png", "-r", "250", pdfPath, prefix]);
    const files = fs
      .readdirSync(workDir)
      .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
      .sort((a, b) => {
        const ai = Number(a.match(/page-(\d+)\.png/)?.[1] || 0);
        const bi = Number(b.match(/page-(\d+)\.png/)?.[1] || 0);
        return ai - bi;
      });

    if (!files.length) return "";

    const worker = await makeTesseractWorker();
    try {
      let fullText = "";
      for (const f of files) {
        const imgPath = path.join(workDir, f);
        const { data } = await worker.recognize(imgPath);
        fullText += "\n" + (data?.text || "");
      }
      return fullText;
    } finally {
      try {
        await worker.terminate();
      } catch {}
    }
  } finally {
    try {
      for (const f of fs.readdirSync(workDir)) {
        try {
          fs.unlinkSync(path.join(workDir, f));
        } catch {}
      }
      try {
        fs.rmdirSync(workDir);
      } catch {}
    } catch {}
  }
}

// =====================================================
// POST /api/vehicles/_invoice/extract
// =====================================================
exports.extractInvoicePdf = async (req, res) => {
  const filepath = req.file?.path;
  const debug = String(req.query.debug || "0") === "1";

  // Debug payload buckets
  let rawPdfText = "";
  let rawOcrText = "";
  let used = "pdf-parse";

  try {
    if (!filepath) return res.status(400).json({ success: false, message: "PDF file required" });

    const dataBuffer = fs.readFileSync(filepath);

    // 1) Try pdf-parse first
    let text = "";
    try {
      const parsed = await pdfParse(dataBuffer);
      text = parsed?.text || "";
    } catch (e) {
      console.warn("pdf-parse failed, will try OCR:", e?.message || e);
    }

    rawPdfText = text || "";
    let result = parseInvoiceText(text);

    // 2) If failed, OCR fallback
    if (!result?.vehicles?.length) {
      used = "ocr";
      console.log("No vehicles via pdf-parse. Running OCR fallback...");
      try {
        const ocrText = await ocrPdfToText(filepath);
        rawOcrText = ocrText || "";

        const ocrResult = parseInvoiceText(ocrText);

        if (ocrResult?.vehicles?.length) {
          result = ocrResult;
        } else {
          result.raw_hint = (result.raw_hint || "No vehicles found.") + " (OCR tried)";
        }
      } catch (e) {
        console.error("OCR failed:", e?.message || e);
        result.raw_hint = (result.raw_hint || "No vehicles found.") + ` (OCR failed: ${e?.message || "error"})`;
      }
    }

    // ✅ Phase-2 enhancements:
    // per-row model/variant detection + per-row color + duplicate status
    const combinedText = `${rawPdfText || ""}\n${rawOcrText || ""}`;

    const enrichedVehicles = [];
    const detectedPairs = [];

    // doc-level fallback color (only if per-row not found)
    const docColor = detectColorFromText(combinedText);

    for (let i = 0; i < (result.vehicles || []).length; i++) {
      const v = result.vehicles[i];

      const engine_number = normalizeToken(v.engine_number || "");
      const chassis_number = normalizeToken(v.chassis_number || "");

      detectedPairs.push({ engine_number, chassis_number });

      // ✅ duplicate status
      const status = await getDuplicateStatus(engine_number, chassis_number);

      // ✅ per-row hint line around engine/chassis (from extractor)
      const pairHint =
        (result._pairs_raw && result._pairs_raw[i] && result._pairs_raw[i].hint_text) || "";

      // ✅ per-row model/variant (IMPORTANT FIX: stops “only HF DELUXE”)
      const mv = await detectModelVariantForPair(pairHint, combinedText);

      // ✅ per-row color: try table-code first (BKB etc), else fallback to doc-level
     const hintColor = detectColorFromHintLine(pairHint); // {color, code}
const rowColor = hintColor.color || docColor || null;

      enrichedVehicles.push({
        engine_number,
        chassis_number,

        model: mv.model_name || null,
        variant: mv.variant_name || null,
        color: rowColor,

        color_code: hintColor.code || null,
        model_id: mv.model_id || null,
        variant_id: mv.variant_id || null,

        status,

        // debug per row
        _match_debug: debug
          ? {
              pairHint,
              mv_debug: mv.debug || null,
              hintColor,
              docColor,
            }
          : undefined,
      });
    }

    const response = {
      success: true,
      data: {
        ...result,
        vehicles: enrichedVehicles,
      },
    };

    if (debug) {
      const cleanedTokens = combinedText
        .replace(/\r/g, "\n")
        .replace(/[,;|]/g, " ")
        .split(/\s+/)
        .map((t) => normalizeToken(t))
        .filter(Boolean)
        .slice(0, 400);

      response.debug = {
        used,
        raw_pdf_text_2000: (rawPdfText || "").slice(0, 2000),
        raw_ocr_text_2000: (rawOcrText || "").slice(0, 2000),
        cleaned_tokens: cleanedTokens,
        detected_pairs: detectedPairs,
        matching_logic: {
          doc_color: docColor,
          note: "Per-row model/variant uses pairHint first, then invoice fallback. Per-row color uses code near HSN first.",
        },
      };
    }

    return res.json(response);
  } catch (e) {
    console.error("vehicles extractInvoicePdf:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    try {
      if (filepath && fs.existsSync(filepath)) fs.unlinkSync(filepath);
    } catch {}
  }
};
// =====================================================
// ✅ NEW: POST /api/vehicles/_invoice/create-bulk
// Server-side duplicate prevention (no crash / no ER_DUP_ENTRY to UI)
// =====================================================
exports.createVehiclesFromInvoiceBulk = async (req, res) => {
  const debug = String(req.query.debug || "0") === "1";
  const role = String(req.user?.role || "").toLowerCase();

  try {
    const body = req.body || {};
    const vehicles = Array.isArray(body.vehicles) ? body.vehicles : [];

    const contact_id_raw = body.contact_id;
    const contact_id = contact_id_raw ? Number(contact_id_raw) : null;

    const vehicle_make = body.vehicle_make ? String(body.vehicle_make).trim() : "Hero";

    if (!vehicles.length) {
      return res.status(400).json({ success: false, message: "vehicles[] required" });
    }

    if (contact_id) {
      const [c] = await db.query(`SELECT id FROM contacts WHERE id=? LIMIT 1`, [contact_id]);
      if (!c.length) return res.status(400).json({ success: false, message: "Contact not found" });
    }

    let inserted = 0;
    let skipped = 0;
    const details = [];

    // One-by-one with safe skip (simple + reliable)
    for (const v of vehicles) {
      const chassis_number = normalizeToken(v?.chassis_number || "");
      const engine_number = normalizeToken(v?.engine_number || "");
      if (!chassis_number || !engine_number) {
        skipped++;
        details.push({ chassis_number, engine_number, action: "skipped", reason: "missing_engine_or_chassis" });
        continue;
      }

      // Re-check duplicates server-side
      const status = await getDuplicateStatus(engine_number, chassis_number);
      if (status.code !== "NEW") {
        skipped++;
        details.push({ chassis_number, engine_number, action: "skipped", reason: status.label, status });
        continue;
      }

      const model_id = v?.model_id ? Number(v.model_id) : null;
      const variant_id = v?.variant_id ? Number(v.variant_id) : null;

      const color = v?.color ? String(v.color).trim() : null;
      const vehicle_model = v?.vehicle_model ? String(v.vehicle_model).trim() : null;

      try {
        await db.query(
          `INSERT INTO contact_vehicles
            (contact_id, chassis_number, engine_number, model_id, variant_id, vehicle_make, vehicle_model, color)
           VALUES (?,?,?,?,?,?,?,?)`,
          [contact_id, chassis_number, engine_number, model_id, variant_id, vehicle_make, vehicle_model, color]
        );
        inserted++;
        details.push({ chassis_number, engine_number, action: "inserted" });
      } catch (e) {
        // If race condition creates duplicate, still skip safely
        if (String(e?.code) === "ER_DUP_ENTRY") {
          skipped++;
          details.push({ chassis_number, engine_number, action: "skipped", reason: "duplicate_race_condition" });
          continue;
        }
        throw e;
      }
    }

    const resp = { success: true, inserted, skipped };
    if (debug) resp.details = details;
    return res.json(resp);
  } catch (e) {
    console.error("vehicles createVehiclesFromInvoiceBulk:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

