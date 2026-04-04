const db = require("../db");
const fs = require("fs");
const ExcelJS = require("exceljs");
const excelUpload = require("../middleware/excelUpload");

// =====================================================
// helpers
// =====================================================
function normalizeStr(v) {
  return String(v || "").trim();
}

function normalizeUpper(v) {
  return normalizeStr(v).toUpperCase();
}

function parseNullableNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseNullableDate(v) {
  const s = normalizeStr(v);
  return s || null;
}

function isOwnerAdminManager(req) {
  const role = String(req.user?.role || "").toLowerCase();
  return role === "owner" || role === "admin" || role === "manager";
}

function isOwnerAdmin(req) {
  const role = String(req.user?.role || "").toLowerCase();
  return role === "owner" || role === "admin";
}

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

const ALLOWED_ENTRY_TYPES = new Set(["invoice", "challan", "import"]);
const ALLOWED_STATUS = new Set([
  "in_stock",
  "booked",
  "sold",
  "delivered",
  "cancelled",
  "damaged",
]);

async function getDefaultBranchId(conn) {
  const [rows] = await conn.query(
    `
    SELECT id
    FROM showroom_branches
    WHERE is_active = 1
    ORDER BY
      CASE WHEN LOWER(TRIM(branch_name)) = LOWER('Main Showroom') THEN 0 ELSE 1 END,
      id ASC
    LIMIT 1
    `
  );
  return rows?.[0]?.id || null;
}

async function getModelIdByName(name) {
  const modelName = normalizeStr(name);
  if (!modelName) return null;
  const [rows] = await db.query(
    `SELECT id FROM vehicle_models WHERE LOWER(model_name) = LOWER(?) LIMIT 1`,
    [modelName]
  );
  return rows?.[0]?.id || null;
}

async function getVariantIdByName(modelId, variantName) {
  if (!modelId) return null;
  const name = normalizeStr(variantName);
  if (!name) return null;

  const [rows] = await db.query(
    `SELECT id
     FROM vehicle_variants
     WHERE model_id = ? AND LOWER(variant_name) = LOWER(?)
     LIMIT 1`,
    [modelId, name]
  );
  return rows?.[0]?.id || null;
}

async function ensureBranchExists(branchId) {
  if (!branchId) return true;
  const [rows] = await db.query(
    `SELECT id FROM showroom_branches WHERE id = ? LIMIT 1`,
    [branchId]
  );
  return rows.length > 0;
}

async function ensureSaleExists(saleId) {
  if (!saleId) return true;
  const [rows] = await db.query(`SELECT id FROM sales WHERE id = ? LIMIT 1`, [saleId]);
  return rows.length > 0;
}

async function ensureVehicleItemExists(itemId) {
  const [rows] = await db.query(
    `SELECT id, status_code, sale_id FROM vehicle_purchase_items WHERE id = ? LIMIT 1`,
    [itemId]
  );
  return rows?.[0] || null;
}

// =====================================================
// GET /api/stock
// =====================================================
exports.listStock = async (req, res) => {
  try {
    const q = normalizeStr(req.query.q);
    const status_code = normalizeStr(req.query.status_code);
    const model_id = parseNullableNumber(req.query.model_id);
    const variant_id = parseNullableNumber(req.query.variant_id);
    const color = normalizeStr(req.query.color);
    const entry_type = normalizeStr(req.query.entry_type);
    const branch_id = parseNullableNumber(req.query.branch_id);
    const purchase_from = normalizeStr(req.query.purchase_from);
    const invoice_pending =
      req.query.invoice_pending === undefined
        ? null
        : Number(req.query.invoice_pending) === 1
        ? 1
        : 0;

    const date_from = parseNullableDate(req.query.date_from);
    const date_to = parseNullableDate(req.query.date_to);

    const where = ["1=1"];
    const params = [];

    if (q) {
      const like = `%${q}%`;
      where.push(`
        (
          vpi.chassis_number LIKE ?
          OR vpi.engine_number LIKE ?
          OR COALESCE(vm.model_name,'') LIKE ?
          OR COALESCE(vv.variant_name,'') LIKE ?
          OR COALESCE(vpi.color,'') LIKE ?
          OR COALESCE(vp.purchase_from,'') LIKE ?
          OR COALESCE(vp.document_number,'') LIKE ?
          OR COALESCE(vp.invoice_number,'') LIKE ?
          OR CAST(vpi.id AS CHAR) LIKE ?
        )
      `);
      params.push(like, like, like, like, like, like, like, like, like);
    }

   if (status_code) {
  const normalizedStatus = String(status_code).toLowerCase();

  where.push(`LOWER(vpi.status_code) = ?`);
  params.push(normalizedStatus);

  if (normalizedStatus === "in_stock") {
    where.push(`vpi.sale_id IS NULL`);
    where.push(`
      NOT EXISTS (
        SELECT 1
        FROM sales s
        WHERE s.stock_item_id = vpi.id
          AND COALESCE(s.is_cancelled, 0) = 0
      )
    `);
  }
}
    if (model_id) {
      where.push(`vpi.model_id = ?`);
      params.push(model_id);
    }
    if (variant_id) {
      where.push(`vpi.variant_id = ?`);
      params.push(variant_id);
    }
    if (color) {
      where.push(`COALESCE(vpi.color,'') LIKE ?`);
      params.push(`%${color}%`);
    }
    if (entry_type) {
      where.push(`vp.entry_type = ?`);
      params.push(entry_type);
    }
      if (branch_id) {
      where.push(`vpi.current_branch_id = ?`);
      params.push(branch_id);
    }
    if (purchase_from) {
      where.push(`COALESCE(vp.purchase_from,'') LIKE ?`);
      params.push(`%${purchase_from}%`);
    }
    if (invoice_pending !== null) {
      where.push(`vp.invoice_pending = ?`);
      params.push(invoice_pending);
    }
    if (date_from) {
      where.push(`
        DATE(COALESCE(vp.received_date, vp.document_date, vp.purchase_date, vp.invoice_date, vp.created_at)) >= ?
      `);
      params.push(date_from);
    }
    if (date_to) {
      where.push(`
        DATE(COALESCE(vp.received_date, vp.document_date, vp.purchase_date, vp.invoice_date, vp.created_at)) <= ?
      `);
      params.push(date_to);
    }

    const fromSql = `
      FROM vehicle_purchase_items vpi
      JOIN vehicle_purchases vp ON vp.id = vpi.purchase_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN showroom_branches sb ON sb.id = vpi.current_branch_id
      WHERE ${where.join(" AND ")}
    `;

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total ${fromSql}`,
      params
    );
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await db.query(
      `
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
        vpi.booked_by,
        vpi.sold_at,
        vpi.delivered_at,
        vpi.import_batch_no,
        vpi.remarks,
        vpi.sale_id,
        vpi.existing_vehicle_id,
        vpi.existing_sale_id,
        vpi.created_at,

        vp.purchase_from,
        vp.entry_type,
        vp.document_number,
        vp.document_date,
        vp.invoice_pending,
        vp.supplier_name,
        vp.received_date,
        vp.invoice_received_at,
        vp.updated_invoice_by,
               vp.branch_id AS purchase_branch_id,
        vpi.current_branch_id,
        vp.invoice_number,
        vp.invoice_date,
        vp.purchase_date,
        vp.total_amount,
        vp.invoice_file,
        vp.notes,

        vm.model_name,
        vv.variant_name,
        sb.branch_name AS branch_name
      ${fromSql}
      ORDER BY vpi.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      data: rows,
      total,
    });
  } catch (e) {
    console.error("stock listStock:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// POST /api/stock/purchase
// body:
// {
//   purchase_from,
//   entry_type,
//   document_number,
//   document_date,
//   invoice_pending,
//   supplier_name,
//   received_date,
//   branch_id,
//   invoice_number,
//   invoice_date,
//   purchase_date,
//   total_amount,
//   notes,
//   items: [{ chassis_number, engine_number, model_id, variant_id, color, purchase_price, remarks }]
// }
// =====================================================
exports.createPurchase = async (req, res) => {
  let conn;
  try {
    const userId = req.user?.id || null;

    const purchase_from = normalizeStr(req.body?.purchase_from);
    const entry_type = normalizeStr(req.body?.entry_type || "invoice").toLowerCase();
    const document_number = normalizeStr(req.body?.document_number) || null;
    const document_date = parseNullableDate(req.body?.document_date);
    const invoice_pending = Number(req.body?.invoice_pending) === 1 ? 1 : 0;
    const supplier_name = normalizeStr(req.body?.supplier_name) || null;
    const received_date = parseNullableDate(req.body?.received_date);
    let branch_id = parseNullableNumber(req.body?.branch_id);
    const invoice_number = normalizeStr(req.body?.invoice_number) || null;
    const invoice_date = parseNullableDate(req.body?.invoice_date);
    const purchase_date = parseNullableDate(req.body?.purchase_date);
    const total_amount = req.body?.total_amount === "" || req.body?.total_amount === undefined || req.body?.total_amount === null
      ? 0
      : Number(req.body.total_amount);
    const notes = normalizeStr(req.body?.notes) || null;

    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!purchase_from) {
      return res.status(400).json({ success: false, message: "purchase_from is required" });
    }

    if (!ALLOWED_ENTRY_TYPES.has(entry_type)) {
      return res.status(400).json({ success: false, message: "Invalid entry_type" });
    }

    if (!items.length) {
      return res.status(400).json({ success: false, message: "At least one stock item is required" });
    }

    if (branch_id && !(await ensureBranchExists(branch_id))) {
      return res.status(400).json({ success: false, message: "Invalid branch_id" });
    }

    if (entry_type === "invoice" && !invoice_number && !document_number) {
      return res.status(400).json({
        success: false,
        message: "For invoice entry, invoice_number or document_number is required",
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    if (!branch_id) {
  branch_id = await getDefaultBranchId(conn);
}

if (!branch_id) {
  await conn.rollback();
  return res.status(400).json({
    success: false,
    message: "No active branch found. Please create/activate a branch first.",
  });
}

    for (let i = 0; i < items.length; i++) {
      const row = items[i] || {};
      const chassis_number = normalizeUpper(row.chassis_number);
      const engine_number = normalizeUpper(row.engine_number);

      if (!chassis_number) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Row ${i + 1}: chassis_number is required` });
      }
      if (!engine_number) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Row ${i + 1}: engine_number is required` });
      }

      const [dupRows] = await conn.query(
        `
        SELECT id, chassis_number, engine_number
        FROM vehicle_purchase_items
        WHERE chassis_number = ? OR engine_number = ?
        LIMIT 1
        `,
        [chassis_number, engine_number]
      );

      if (dupRows.length) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          message: `Row ${i + 1}: duplicate chassis_number or engine_number already exists`,
          existing: dupRows[0],
        });
      }
    }

    const [purchaseResult] = await conn.query(
      `
      INSERT INTO vehicle_purchases
      (
        purchase_from,
        entry_type,
        document_number,
        document_date,
        invoice_pending,
        supplier_name,
        received_date,
        branch_id,
        invoice_number,
        invoice_date,
        purchase_date,
        total_amount,
        notes,
        created_by
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        purchase_from,
        entry_type,
        document_number,
        document_date,
        invoice_pending,
        supplier_name,
        received_date,
        branch_id,
        invoice_number,
        invoice_date,
        purchase_date,
        Number.isFinite(total_amount) ? total_amount : 0,
        notes,
        userId,
      ]
    );

    const purchaseId = purchaseResult.insertId;

    for (const row of items) {
      const chassis_number = normalizeUpper(row.chassis_number);
      const engine_number = normalizeUpper(row.engine_number);
      const model_id = parseNullableNumber(row.model_id);
      const variant_id = parseNullableNumber(row.variant_id);
      const color = normalizeStr(row.color) || null;
      const purchase_price = row.purchase_price === "" || row.purchase_price === undefined || row.purchase_price === null
        ? 0
        : Number(row.purchase_price);
      const remarks = normalizeStr(row.remarks) || null;

      await conn.query(
        `
       INSERT INTO vehicle_purchase_items
(
  purchase_id,
  current_branch_id,
  chassis_number,
  engine_number,
  model_id,
  variant_id,
  color,
  purchase_price,
  status_code,
  remarks
)
VALUES (?,?,?,?,?,?,?,?,?,?)
        `,
        [
  purchaseId,
  branch_id,
  chassis_number,
  engine_number,
  model_id,              
  variant_id,
  color,
  Number.isFinite(purchase_price) ? purchase_price : 0,
  "in_stock",
  remarks,
]
      );
    }

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      purchase_id: purchaseId,
      items_created: items.length,
    });
  } catch (e) {
    try {
      if (conn) await conn.rollback();
    } catch {}
    console.error("stock createPurchase:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    try {
      if (conn) conn.release();
    } catch {}
  }
};

// =====================================================
// PATCH /api/stock/purchase/:id/update-invoice
// owner/admin/manager
// =====================================================
exports.updateInvoice = async (req, res) => {
  try {
    if (!isOwnerAdminManager(req)) {
      return res.status(403).json({ success: false, message: "Only owner/admin/manager" });
    }

    const purchaseId = Number(req.params.id);
    if (!Number.isFinite(purchaseId) || purchaseId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid purchase id" });
    }

    const invoice_number = normalizeStr(req.body?.invoice_number) || null;
    const invoice_date = parseNullableDate(req.body?.invoice_date);
    const total_amount = req.body?.total_amount === "" || req.body?.total_amount === undefined || req.body?.total_amount === null
      ? null
      : Number(req.body.total_amount);
    const invoice_file = normalizeStr(req.body?.invoice_file) || null;

    const [existing] = await db.query(
      `SELECT id FROM vehicle_purchases WHERE id = ? LIMIT 1`,
      [purchaseId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    await db.query(
      `
      UPDATE vehicle_purchases
      SET
        invoice_number = COALESCE(?, invoice_number),
        invoice_date = COALESCE(?, invoice_date),
        total_amount = COALESCE(?, total_amount),
        invoice_file = COALESCE(?, invoice_file),
        invoice_pending = 0,
        invoice_received_at = NOW(),
        updated_invoice_by = ?
      WHERE id = ?
      `,
      [
        invoice_number,
        invoice_date,
        Number.isFinite(total_amount) ? total_amount : null,
        invoice_file,
        req.user?.id || null,
        purchaseId,
      ]
    );

    return res.json({ success: true, message: "Invoice updated successfully" });
  } catch (e) {
    console.error("stock updateInvoice:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// PATCH /api/stock/:id/book
// =====================================================
exports.bookVehicle = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid stock id" });
    }

    const item = await ensureVehicleItemExists(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Stock item not found" });
    }

    if (item.status_code !== "in_stock") {
      return res.status(400).json({
        success: false,
        message: `Only in_stock vehicle can be booked. Current status: ${item.status_code}`,
      });
    }

    await db.query(
      `
      UPDATE vehicle_purchase_items
      SET status_code = 'booked',
          booked_at = NOW(),
          booked_by = ?
      WHERE id = ?
      `,
      [req.user?.id || null, id]
    );

    return res.json({ success: true, message: "Vehicle booked successfully" });
  } catch (e) {
    console.error("stock bookVehicle:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// PATCH /api/stock/:id/unbook
// =====================================================
exports.unbookVehicle = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid stock id" });
    }

    const item = await ensureVehicleItemExists(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Stock item not found" });
    }

    if (item.status_code !== "booked") {
      return res.status(400).json({
        success: false,
        message: `Only booked vehicle can be unbooked. Current status: ${item.status_code}`,
      });
    }

    await db.query(
      `
      UPDATE vehicle_purchase_items
      SET status_code = 'in_stock',
          booked_at = NULL,
          booked_by = NULL
      WHERE id = ?
      `,
      [id]
    );

    return res.json({ success: true, message: "Vehicle unbooked successfully" });
  } catch (e) {
    console.error("stock unbookVehicle:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// PATCH /api/stock/:id/sold
// body: { sale_id }
// =====================================================
exports.markSold = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sale_id = parseNullableNumber(req.body?.sale_id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid stock id" });
    }
    if (!sale_id) {
      return res.status(400).json({ success: false, message: "sale_id is required" });
    }
    if (!(await ensureSaleExists(sale_id))) {
      return res.status(400).json({ success: false, message: "Invalid sale_id" });
    }

    const item = await ensureVehicleItemExists(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Stock item not found" });
    }

    if (!["in_stock", "booked"].includes(item.status_code)) {
      return res.status(400).json({
        success: false,
        message: `Only in_stock or booked vehicle can be marked sold. Current status: ${item.status_code}`,
      });
    }

    await db.query(
      `
      UPDATE vehicle_purchase_items
      SET status_code = 'sold',
          sold_at = NOW(),
          sale_id = ?
      WHERE id = ?
      `,
      [sale_id, id]
    );

    return res.json({ success: true, message: "Vehicle marked sold successfully" });
  } catch (e) {
    console.error("stock markSold:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// PATCH /api/stock/:id/delivered
// =====================================================
exports.markDelivered = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid stock id" });
    }

    const item = await ensureVehicleItemExists(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Stock item not found" });
    }

    if (item.status_code !== "sold") {
      return res.status(400).json({
        success: false,
        message: `Only sold vehicle can be marked delivered. Current status: ${item.status_code}`,
      });
    }

    await db.query(
      `
      UPDATE vehicle_purchase_items
      SET status_code = 'delivered',
          delivered_at = NOW()
      WHERE id = ?
      `,
      [id]
    );

    return res.json({ success: true, message: "Vehicle marked delivered successfully" });
  } catch (e) {
    console.error("stock markDelivered:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// GET /api/stock/import/sample
// owner/admin only
// =====================================================
exports.downloadStockImportSample = async (req, res) => {
  try {
    if (!isOwnerAdmin(req)) {
      return res.status(403).json({ success: false, message: "Only owner/admin" });
    }

    const wb = new ExcelJS.Workbook();

    const ws = wb.addWorksheet("Stock Import");
    ws.columns = [
      { header: "chassis_number", key: "chassis_number", width: 24 },
      { header: "engine_number", key: "engine_number", width: 24 },
      { header: "model_name", key: "model_name", width: 22 },
      { header: "variant_name", key: "variant_name", width: 22 },
      { header: "color", key: "color", width: 16 },
      { header: "purchase_price", key: "purchase_price", width: 16 },
      { header: "purchase_from", key: "purchase_from", width: 24 },
      { header: "document_type", key: "document_type", width: 16 },
      { header: "document_number", key: "document_number", width: 20 },
      { header: "document_date", key: "document_date", width: 16 },
      { header: "remarks", key: "remarks", width: 30 },
    ];

    ws.addRow({
      chassis_number: "MBLHA10ABC12345",
      engine_number: "HA11F6ABC12345",
      model_name: "Splendor Plus",
      variant_name: "Drum",
      color: "Black",
      purchase_price: 64000,
      purchase_from: "Old Register",
      document_type: "import",
      document_number: "IMP-001",
      document_date: "2026-03-15",
      remarks: "Old stock import",
    });

    ws.addRow({
      chassis_number: "MBLHA10ABC12346",
      engine_number: "HA11F6ABC12346",
      model_name: "HF Deluxe",
      variant_name: "Self",
      color: "Red",
      purchase_price: 61500,
      purchase_from: "Hero Dispatch",
      document_type: "challan",
      document_number: "CH-201",
      document_date: "2026-03-15",
      remarks: "Received on challan",
    });

    const ins = wb.addWorksheet("Instructions");
    ins.getCell("A1").value = "Do not change column names.";
    ins.getCell("A2").value = "model_name and variant_name must exist in master.";
    ins.getCell("A3").value = "chassis_number and engine_number must be unique.";
    ins.getCell("A4").value = "document_type allowed values: import, challan, invoice";
    ins.getCell("A5").value = "document_date format: YYYY-MM-DD";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vehicle_stock_import_sample.xlsx"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("stock downloadStockImportSample:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// POST /api/stock/import
// owner/admin only
// form-data: file
// =====================================================
exports.importStockExcel = [
  excelUpload.single("file"),
  async (req, res) => {
    let filepath = null;
    let conn;
    try {
      if (!isOwnerAdmin(req)) {
        return res.status(403).json({ success: false, message: "Only owner/admin" });
      }

      filepath = req.file?.path;
      if (!filepath) {
        return res.status(400).json({ success: false, message: "Excel file required" });
      }

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filepath);
      const ws = wb.worksheets[0];
      if (!ws) {
        return res.status(400).json({ success: false, message: "Invalid Excel" });
      }

      const header = {};
      ws.getRow(1).eachCell((cell, col) => {
        header[String(cell.value || "").trim().toLowerCase()] = col;
      });

      const get = (row, key) => {
        const c = header[String(key).toLowerCase()];
        if (!c) return "";
        return String(row.getCell(c).value || "").trim();
      };

      const rows = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const chassis_number = normalizeUpper(get(row, "chassis_number"));
        const engine_number = normalizeUpper(get(row, "engine_number"));

        if (!chassis_number && !engine_number) continue;

        rows.push({
          row_no: r,
          chassis_number,
          engine_number,
          model_name: normalizeStr(get(row, "model_name")),
          variant_name: normalizeStr(get(row, "variant_name")),
          color: normalizeStr(get(row, "color")) || null,
          purchase_price: get(row, "purchase_price"),
          purchase_from: normalizeStr(get(row, "purchase_from")) || "Old Stock Import",
          document_type: normalizeStr(get(row, "document_type")).toLowerCase() || "import",
          document_number: normalizeStr(get(row, "document_number")) || null,
          document_date: parseNullableDate(get(row, "document_date")),
          remarks: normalizeStr(get(row, "remarks")) || null,
        });
      }

      if (!rows.length) {
        return res.status(400).json({ success: false, message: "No data rows found in file" });
      }

      const errors = [];
      const seenChassis = new Set();
      const seenEngine = new Set();

      for (const row of rows) {
        if (!row.chassis_number) {
          errors.push({ row: row.row_no, reason: "Missing chassis_number" });
          continue;
        }
        if (!row.engine_number) {
          errors.push({ row: row.row_no, reason: "Missing engine_number" });
          continue;
        }
        if (!row.model_name) {
          errors.push({ row: row.row_no, reason: "Missing model_name" });
          continue;
        }
        if (!row.variant_name) {
          errors.push({ row: row.row_no, reason: "Missing variant_name" });
          continue;
        }
        if (!ALLOWED_ENTRY_TYPES.has(row.document_type)) {
          errors.push({ row: row.row_no, reason: "Invalid document_type" });
          continue;
        }
        if (seenChassis.has(row.chassis_number)) {
          errors.push({ row: row.row_no, reason: "Duplicate chassis_number inside file" });
          continue;
        }
        if (seenEngine.has(row.engine_number)) {
          errors.push({ row: row.row_no, reason: "Duplicate engine_number inside file" });
          continue;
        }

        seenChassis.add(row.chassis_number);
        seenEngine.add(row.engine_number);

        const model_id = await getModelIdByName(row.model_name);
        if (!model_id) {
          errors.push({ row: row.row_no, reason: `Model not found: ${row.model_name}` });
          continue;
        }
        row.model_id = model_id;

        const variant_id = await getVariantIdByName(model_id, row.variant_name);
        if (!variant_id) {
          errors.push({
            row: row.row_no,
            reason: `Variant not found for model ${row.model_name}: ${row.variant_name}`,
          });
          continue;
        }
        row.variant_id = variant_id;

        const [dupDb] = await db.query(
          `
          SELECT id
          FROM vehicle_purchase_items
          WHERE chassis_number = ? OR engine_number = ?
          LIMIT 1
          `,
          [row.chassis_number, row.engine_number]
        );
        if (dupDb.length) {
          errors.push({
            row: row.row_no,
            reason: "Duplicate chassis_number or engine_number already exists in DB",
          });
          continue;
        }
      }

      const validRows = rows.filter((r) => !errors.some((e) => e.row === r.row_no));

      if (!validRows.length) {
        return res.status(400).json({
          success: false,
          message: "No valid rows to import",
          summary: { total: rows.length, success_count: 0, failed_count: errors.length },
          errors,
        });
      }

      conn = await db.getConnection();
      await conn.beginTransaction();

      const defaultBranchId = await getDefaultBranchId(conn);
      if (!defaultBranchId) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: "No active branch found. Please create/activate a branch first.",
        });
      }

      const batchNo = `IMP-${Date.now()}`;

      const [purchaseResult] = await conn.query(
        `
        INSERT INTO vehicle_purchases
        (
          purchase_from,
          entry_type,
          document_number,
          document_date,
          invoice_pending,
          supplier_name,
          received_date,
          branch_id,
          notes,
          created_by
        )
        VALUES (?,?,?,?,?,?,?,?,?,?)
        `,
        [
          "Old Stock Import",
          "import",
          batchNo,
          new Date().toISOString().slice(0, 10),
          1,
          null,
          new Date().toISOString().slice(0, 10),
          defaultBranchId,
          "Imported from excel",
          req.user?.id || null,
        ]
      );

      const purchaseId = purchaseResult.insertId;

      for (const row of validRows) {
        await conn.query(
          `
          INSERT INTO vehicle_purchase_items
          (
            purchase_id,
            current_branch_id,
            chassis_number,
            engine_number,
            model_id,
            variant_id,
            color,
            purchase_price,
            status_code,
            import_batch_no,
            remarks
          )
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
          `,
          [
            purchaseId,
            defaultBranchId,
            row.chassis_number,
            row.engine_number,
            row.model_id,
            row.variant_id,
            row.color,
            row.purchase_price === "" || row.purchase_price === null || row.purchase_price === undefined
              ? 0
              : Number(row.purchase_price),
            "in_stock",
            batchNo,
            row.remarks,
          ]
        );
      }

      await conn.commit();

      return res.json({
        success: true,
        message: "Import completed",
        summary: {
          total: rows.length,
          success_count: validRows.length,
          failed_count: errors.length,
        },
        batch_no: batchNo,
        purchase_id: purchaseId,
        default_branch_id: defaultBranchId,
        errors,
      });
    } catch (e) {
      try {
        if (conn) await conn.rollback();
      } catch {}
      console.error("stock importStockExcel:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      try {
        if (conn) conn.release();
      } catch {}
      try {
        if (filepath && fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch {}
    }
  },
];

// =====================================================
// GET /api/stock/branch-summary
// =====================================================
// =====================================================
// GET /api/stock/branch-summary
// =====================================================
exports.getBranchSummary = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        sb.id AS branch_id,
        sb.branch_name,

        COUNT(vpi.id) AS total_count,

        SUM(CASE WHEN LOWER(COALESCE(vpi.status_code, '')) = 'in_stock' THEN 1 ELSE 0 END) AS in_stock_count,
        SUM(CASE WHEN LOWER(COALESCE(vpi.status_code, '')) = 'sold' THEN 1 ELSE 0 END) AS sold_count,
        SUM(CASE WHEN LOWER(COALESCE(vpi.status_code, '')) = 'delivered' THEN 1 ELSE 0 END) AS delivered_count,
        SUM(
          CASE
            WHEN LOWER(COALESCE(vpi.status_code, '')) NOT IN ('in_stock', 'sold', 'delivered')
            THEN 1
            ELSE 0
          END
        ) AS other_count

      FROM showroom_branches sb
      LEFT JOIN vehicle_purchase_items vpi
        ON vpi.current_branch_id = sb.id
      WHERE sb.is_active = 1
      GROUP BY sb.id, sb.branch_name
      ORDER BY sb.branch_name ASC
    `);

    return res.json({
      success: true,
      data: rows || [],
    });
  } catch (e) {
    console.error("stock getBranchSummary:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};