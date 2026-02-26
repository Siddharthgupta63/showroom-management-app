// backend/controllers/vehiclesController.js
const db = require("../db");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });
exports._uploadMiddleware = upload.single("file");

// ---------- Excel helpers (LAZY LOAD) ----------
function loadExcelJSOrThrow() {
  try {
    return require("exceljs");
  } catch (e) {
    const msg =
      "Excel feature is not ready because dependency is missing.\n" +
      "Fix it like this:\n" +
      "  cd backend\n" +
      "  npm i exceljs\n" +
      "Then restart backend.\n\n" +
      "Original error: " + (e?.message || "unknown");
    const err = new Error(msg);
    err._isExcelMissing = true;
    throw err;
  }
}

function safeText(s) {
  const v = String(s ?? "").trim();
  return v ? v : null;
}
function norm(s) {
  return String(s ?? "").trim();
}

// ---------- list/search ----------
// GET /api/vehicles?q=
exports.listSearch = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;

    let sql = `
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
      WHERE 1=1
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

    sql += ` ORDER BY cv.created_at DESC, cv.id DESC LIMIT 300`;

    const [rows] = await db.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error("vehicles listSearch:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- create ----------
// POST /api/vehicles
exports.createVehicle = async (req, res) => {
  try {
    const contact_id = Number(req.body?.contact_id);
    const chassis_number = norm(req.body?.chassis_number);
    const engine_number = norm(req.body?.engine_number);
    const model_id = req.body?.model_id ? Number(req.body.model_id) : null;
    const variant_id = req.body?.variant_id ? Number(req.body.variant_id) : null;
    const vehicle_make = safeText(req.body?.vehicle_make);
    const vehicle_model = safeText(req.body?.vehicle_model);
    const color = safeText(req.body?.color);

    if (!contact_id) return res.status(400).json({ success: false, message: "contact_id is required" });
    if (!chassis_number) return res.status(400).json({ success: false, message: "chassis_number is required" });
    if (!engine_number) return res.status(400).json({ success: false, message: "engine_number is required" });

    const [c] = await db.query(`SELECT id FROM contacts WHERE id=? LIMIT 1`, [contact_id]);
    if (!c.length) return res.status(400).json({ success: false, message: "Contact not found" });

    const [ins] = await db.query(
      `INSERT INTO contact_vehicles
        (contact_id, chassis_number, engine_number, model_id, variant_id, vehicle_make, vehicle_model, color)
       VALUES (?,?,?,?,?,?,?,?)`,
      [contact_id, chassis_number, engine_number, model_id || null, variant_id || null, vehicle_make, vehicle_model, color]
    );

    return res.status(201).json({ success: true, id: ins.insertId });
  } catch (e) {
    console.error("createVehicle:", e);
    if (String(e?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Duplicate chassis/engine found. This vehicle already exists.",
      });
    }
    if (String(e?.code) === "ER_BAD_FIELD_ERROR") {
      return res.status(500).json({
        success: false,
        message:
          "Backend expects contact_vehicles.color column. Run: ALTER TABLE contact_vehicles ADD COLUMN color VARCHAR(50) NULL AFTER vehicle_model;",
      });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- import template ----------
exports.downloadImportTemplate = async (req, res) => {
  try {
    const ExcelJS = loadExcelJSOrThrow();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Vehicles");

    ws.columns = [
      { header: "contact_id*", key: "contact_id", width: 12 },
      { header: "model_name", key: "model_name", width: 20 },
      { header: "variant_name", key: "variant_name", width: 20 },
      { header: "vehicle_make", key: "vehicle_make", width: 14 },
      { header: "vehicle_model (text)", key: "vehicle_model", width: 20 },
      { header: "color", key: "color", width: 12 },
      { header: "chassis_number*", key: "chassis_number", width: 18 },
      { header: "engine_number*", key: "engine_number", width: 18 },
    ];

    ws.addRow({
      contact_id: 1,
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
    console.error("vehicles downloadImportTemplate:", e);
    if (e?._isExcelMissing) return res.status(500).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- import ----------
exports.importVehiclesExcel = [
  (req, res, next) => exports._uploadMiddleware(req, res, next),
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      const ExcelJS = loadExcelJSOrThrow();
      if (!req.file?.buffer) return res.status(400).json({ success: false, message: "File is required" });

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer);
      const ws = wb.worksheets[0];
      if (!ws) return res.status(400).json({ success: false, message: "Invalid Excel file" });

      const [models] = await db.query(`SELECT id, model_name FROM vehicle_models WHERE is_active=1`);
      const modelMap = new Map(models.map((m) => [String(m.model_name).toLowerCase(), m.id]));

      const [variants] = await db.query(
        `SELECT v.id, v.variant_name, v.model_id FROM vehicle_variants v WHERE v.is_active=1`
      );
      const variantMap = new Map(
        variants.map((v) => [`${v.model_id}::${String(v.variant_name).toLowerCase()}`, v.id])
      );

      const header = {};
      ws.getRow(1).eachCell((cell, colNumber) => {
        header[String(cell.value || "").trim().toLowerCase()] = colNumber;
      });

      const get = (row, key) => {
        const col = header[key];
        if (!col) return "";
        return String(row.getCell(col).value || "").trim();
      };

      let inserted = 0;
      const errors = [];

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const contact_id = Number(get(row, "contact_id*") || get(row, "contact_id"));
        const model_name = get(row, "model_name");
        const variant_name = get(row, "variant_name");
        const vehicle_make = safeText(get(row, "vehicle_make"));
        const vehicle_model = safeText(get(row, "vehicle_model (text)") || get(row, "vehicle_model"));
        const color = safeText(get(row, "color"));
        const chassis_number = norm(get(row, "chassis_number*") || get(row, "chassis_number"));
        const engine_number = norm(get(row, "engine_number*") || get(row, "engine_number"));

        if (!contact_id || !chassis_number || !engine_number) continue;

        const [c] = await db.query(`SELECT id FROM contacts WHERE id=? LIMIT 1`, [contact_id]);
        if (!c.length) {
          errors.push(`Row ${r}: contact_id not found`);
          continue;
        }

        let model_id = null;
        let variant_id = null;
        if (model_name) model_id = modelMap.get(String(model_name).toLowerCase()) || null;
        if (model_id && variant_name) {
          variant_id = variantMap.get(`${model_id}::${String(variant_name).toLowerCase()}`) || null;
        }

        await conn.beginTransaction();
        try {
          await conn.query(
            `INSERT INTO contact_vehicles
              (contact_id, chassis_number, engine_number, model_id, variant_id, vehicle_make, vehicle_model, color)
             VALUES (?,?,?,?,?,?,?,?)`,
            [contact_id, chassis_number, engine_number, model_id, variant_id, vehicle_make, vehicle_model, color]
          );
          await conn.commit();
          inserted++;
        } catch (e) {
          try { await conn.rollback(); } catch {}
          if (String(e?.code) === "ER_DUP_ENTRY") errors.push(`Row ${r}: duplicate chassis/engine`);
          else errors.push(`Row ${r}: ${e?.message || "error"}`);
        }
      }

      return res.json({ success: true, inserted, errors });
    } catch (e) {
      console.error("vehicles import:", e);
      if (e?._isExcelMissing) return res.status(500).json({ success: false, message: e.message });
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  },
];

// ---------- export ----------
// GET /api/vehicles/_export?q=
exports.exportVehiclesExcel = async (req, res) => {
  try {
    const ExcelJS = loadExcelJSOrThrow();
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
      WHERE 1=1
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
      { header: "id", key: "id", width: 10 },
      { header: "contact_id", key: "contact_id", width: 12 },
      { header: "model_name", key: "model_name", width: 20 },
      { header: "variant_name", key: "variant_name", width: 20 },
      { header: "vehicle_make", key: "vehicle_make", width: 14 },
      { header: "vehicle_model", key: "vehicle_model", width: 20 },
      { header: "color", key: "color", width: 12 },
      { header: "chassis_number", key: "chassis_number", width: 18 },
      { header: "engine_number", key: "engine_number", width: 18 },
      { header: "created_at", key: "created_at", width: 22 },
    ];

    rows.forEach((r) => ws.addRow(r));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="vehicles_export.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("vehicles export:", e);
    if (e?._isExcelMissing) return res.status(500).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
