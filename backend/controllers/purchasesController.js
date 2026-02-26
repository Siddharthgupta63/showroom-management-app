// backend/controllers/purchasesController.js
const db = require("../db");
const ExcelJS = require("exceljs");

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function normalizeToken(tok) {
  return String(tok || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function getHeaderAmountValue(bodyVal) {
  if (bodyVal == null || bodyVal === "") return 0;
  const n = Number(bodyVal);
  return Number.isFinite(n) ? n : 0;
}

// Accepts: YYYY-MM-DD OR DD/MM/YYYY
function parseDateToYMD(val) {
  const s = String(val || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

// -----------------------------------------------------
// Schema cache (supports older tables safely)
// -----------------------------------------------------
let _schemaCache = null;
let _schemaCacheAt = 0;
const SCHEMA_CACHE_TTL_MS = 30 * 1000;

async function getSchemaCached() {
  const now = Date.now();
  if (_schemaCache && now - _schemaCacheAt < SCHEMA_CACHE_TTL_MS) return _schemaCache;

  const [pCols] = await db.query(`SHOW COLUMNS FROM vehicle_purchases`);
  const [iCols] = await db.query(`SHOW COLUMNS FROM vehicle_purchase_items`);
  const [cvCols] = await db.query(`SHOW COLUMNS FROM contact_vehicles`);

  const purchaseCols = new Set(pCols.map((c) => String(c.Field)));
  const itemCols = new Set(iCols.map((c) => String(c.Field)));
  const contactVehicleCols = new Set(cvCols.map((c) => String(c.Field)));

  // header amount col (your DB has total_amount)
  const headerAmountCol =
    (purchaseCols.has("purchase_amount") && "purchase_amount") ||
    (purchaseCols.has("purchase_total") && "purchase_total") ||
    (purchaseCols.has("total_amount") && "total_amount") ||
    (purchaseCols.has("amount") && "amount") ||
    null;

  // item price col (your DB has purchase_price)
  const itemPriceCol =
    (itemCols.has("purchase_price") && "purchase_price") ||
    (itemCols.has("amount") && "amount") ||
    null;

  _schemaCache = {
    purchaseCols,
    itemCols,
    contactVehicleCols,
    headerAmountCol,
    itemPriceCol,
    hasInvoiceDate: purchaseCols.has("invoice_date"),
    hasInvoiceFile: purchaseCols.has("invoice_file"),
    hasCvPurchaseId: contactVehicleCols.has("purchase_id"),
  };
  _schemaCacheAt = now;
  return _schemaCache;
}

function purchaseAmountSelectExpr(pAlias, headerAmountCol) {
  // Always return as purchase_amount for frontend consistency
  if (headerAmountCol) return `${pAlias}.${headerAmountCol} AS purchase_amount`;
  return `0 AS purchase_amount`;
}

// -----------------------------------------------------
// Duplicate status helper
// - checks existing vehicle by engine/chassis
// - checks if sold (sale exists)
// -----------------------------------------------------
async function getDuplicateStatus(engine_number, chassis_number) {
  const eng = normalizeToken(engine_number);
  const chs = normalizeToken(chassis_number);

  if (!eng || !chs) {
    return { code: "INVALID", label: "Invalid", vehicle_id: null, sale_id: null };
  }

  const [rows] = await db.query(
    `
    SELECT
      cv.id,
      cv.contact_id,
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
    return { code: "NEW", label: "New", vehicle_id: null, sale_id: null };
  }

  const r = rows[0];
  const vehicle_id = Number(r.id);
  const sale_id = r.sale_id ? Number(r.sale_id) : null;

  if (sale_id) {
    return { code: "SOLD", label: `Already Sold (Sale ID: ${sale_id})`, vehicle_id, sale_id };
  }
  if (!r.contact_id) {
    return {
      code: "UNLINKED",
      label: `Exists but Unlinked (Vehicle ID: ${vehicle_id})`,
      vehicle_id,
      sale_id: null,
    };
  }
  return { code: "DUPLICATE", label: `Already Exists (Vehicle ID: ${vehicle_id})`, vehicle_id, sale_id: null };
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
// POST /api/purchases/from-invoice
// Create purchase header + items + insert ONLY NEW vehicles
// =====================================================
exports.createPurchaseFromInvoice = async (req, res) => {
  const role = String(req.user?.role || "").toLowerCase();
  const isOwnerAdminManager = role === "owner" || role === "admin" || role === "manager";
  if (!isOwnerAdminManager) return res.status(403).json({ success: false, message: "Only owner/admin/manager" });

  const conn = await db.getConnection();
  try {
    const schema = await getSchemaCached();

    const body = req.body || {};
    const vehicles = Array.isArray(body.vehicles) ? body.vehicles : [];

    const purchase_from = body.purchase_from ? String(body.purchase_from).trim() : null;
    const invoice_number = body.invoice_number ? String(body.invoice_number).trim() : null;

    // IMPORTANT: support invoice_date + purchase_date
    const invoice_date = parseDateToYMD(body.invoice_date) || null;
    const purchase_date = parseDateToYMD(body.purchase_date) || (body.purchase_date ? String(body.purchase_date).trim() : null);

    const purchase_amount = getHeaderAmountValue(body.purchase_amount);
    const notes = body.notes ? String(body.notes) : null;

    // used when inserting new vehicles
    const contact_id =
      body.contact_id != null && String(body.contact_id).trim() !== "" ? Number(body.contact_id) : null;

    const vehicle_make = body.vehicle_make ? String(body.vehicle_make).trim() : "HERO BIKE";
    const invoice_file = body.invoice_file ? String(body.invoice_file).trim() : null;

    if (!vehicles.length) return res.status(400).json({ success: false, message: "No vehicles provided" });

    await conn.beginTransaction();

    // 1) Create purchase header (store into whichever amount column exists)
    const created_by = req.user?.id || null;

    const headerCols = ["purchase_from", "invoice_number"];
    const headerVals = [purchase_from, invoice_number];

    if (schema.hasInvoiceDate) {
      headerCols.push("invoice_date");
      headerVals.push(invoice_date);
    }

    headerCols.push("purchase_date");
    headerVals.push(purchase_date);

    if (schema.headerAmountCol) {
      headerCols.push(schema.headerAmountCol);
      headerVals.push(purchase_amount);
    }

    if (schema.hasInvoiceFile) {
      headerCols.push("invoice_file");
      headerVals.push(invoice_file);
    }

    headerCols.push("notes", "created_by");
    headerVals.push(notes, created_by);

    const [insP] = await conn.query(
      `INSERT INTO vehicle_purchases (${headerCols.join(",")}) VALUES (${headerCols.map(() => "?").join(",")})`,
      headerVals
    );
    const purchase_id = insP.insertId;

    let inserted = 0;
    let skipped = 0;

    // 2) Each row -> compute status; store item; if NEW -> insert vehicle
    for (const v of vehicles) {
      const engine_number = normalizeToken(v.engine_number || "");
      const chassis_number = normalizeToken(v.chassis_number || "");

      const model_id = v.model_id != null && v.model_id !== "" ? Number(v.model_id) : null;
      const variant_id = v.variant_id != null && v.variant_id !== "" ? Number(v.variant_id) : null;
      const color = v.color ? String(v.color).trim() : null;

      // UI can send purchase_price or amount
      const rowPrice =
        (v.purchase_price != null && v.purchase_price !== "" ? Number(v.purchase_price) : null) ??
        (v.amount != null && v.amount !== "" ? Number(v.amount) : null);

      const vehicle_model = v.vehicle_model ? String(v.vehicle_model).trim() : null;

      const status = await getDuplicateStatus(engine_number, chassis_number);

      let contact_vehicle_id = null;

      if (status.code === "NEW") {
        const cvCols = [
          "contact_id",
          "chassis_number",
          "engine_number",
          "model_id",
          "variant_id",
          "vehicle_make",
          "vehicle_model",
          "color",
        ];
        const cvVals = [
          contact_id,
          chassis_number,
          engine_number,
          model_id,
          variant_id,
          vehicle_make,
          vehicle_model,
          color,
        ];

        if (schema.hasCvPurchaseId) {
          cvCols.push("purchase_id");
          cvVals.push(purchase_id);
        }

        const [insV] = await conn.query(
          `INSERT INTO contact_vehicles (${cvCols.join(",")}) VALUES (${cvCols.map(() => "?").join(",")})`,
          cvVals
        );

        contact_vehicle_id = insV.insertId;
        inserted++;
      } else {
        skipped++;
      }

      const priceCol = schema.itemPriceCol || "purchase_price";

      await conn.query(
        `
        INSERT INTO vehicle_purchase_items
          (purchase_id, contact_vehicle_id, chassis_number, engine_number, model_id, variant_id, color, ${priceCol},
           status_code, existing_vehicle_id, existing_sale_id)
        VALUES
          (?,?,?,?,?,?,?,?,?,?,?)
        `,
        [
          purchase_id,
          contact_vehicle_id,
          chassis_number,
          engine_number,
          model_id,
          variant_id,
          color,
          rowPrice,
          status.code === "NEW" ? "NEW" : status.code,
          status.vehicle_id,
          status.sale_id,
        ]
      );
    }

    await conn.commit();

    return res.json({
      success: true,
      purchase_id,
      summary: { inserted, skipped, total: vehicles.length },
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    console.error("purchases createPurchaseFromInvoice:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    try {
      conn.release();
    } catch {}
  }
};

// =====================================================
// GET /api/purchases/:id
// =====================================================
exports.getPurchaseById = async (req, res) => {
  try {
    const schema = await getSchemaCached();

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid ID" });

    const headerAmountSel = purchaseAmountSelectExpr("p", schema.headerAmountCol);

    const [p] = await db.query(
      `
      SELECT
        p.*,
        ${headerAmountSel}
      FROM vehicle_purchases p
      WHERE p.id=? LIMIT 1
      `,
      [id]
    );
    if (!p.length) return res.status(404).json({ success: false, message: "Not found" });

    const priceCol = schema.itemPriceCol || "purchase_price";

    const [items] = await db.query(
      `
      SELECT
        id,
        purchase_id,
        contact_vehicle_id,
        chassis_number,
        engine_number,
        model_id,
        variant_id,
        color,
        ${priceCol} AS purchase_price,
        status_code,
        existing_vehicle_id,
        existing_sale_id,
        created_at
      FROM vehicle_purchase_items
      WHERE purchase_id=?
      ORDER BY id ASC
      `,
      [id]
    );

    return res.json({ success: true, data: { purchase: p[0], items } });
  } catch (e) {
    console.error("purchases getPurchaseById:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// GET /api/purchases
// List purchases with counts (keeps old filter logic)
// =====================================================
exports.listPurchases = async (req, res) => {
  try {
    const schema = await getSchemaCached();

    const q = String(req.query.q || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    const purchase_from = String(req.query.purchase_from || "").trim();

    const page = clampInt(req.query.page, 1, 1, 1000000);
    const pageSize = clampInt(req.query.pageSize, 10, 1, 200);
    const offset = (page - 1) * pageSize;

    const where = ["1=1"];
    const params = [];

    if (purchase_from) {
      where.push("COALESCE(p.purchase_from,'') = ?");
      params.push(purchase_from);
    }
    if (from) {
      where.push("p.purchase_date >= ?");
      params.push(from);
    }
    if (to) {
      where.push("p.purchase_date <= ?");
      params.push(to);
    }

    if (q) {
      const like = `%${q}%`;
      where.push(`(
        COALESCE(p.purchase_from,'') LIKE ?
        OR COALESCE(p.invoice_number,'') LIKE ?
        OR CAST(p.id AS CHAR) LIKE ?
      )`);
      params.push(like, like, like);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM vehicle_purchases p ${whereSql}`, params);
    const total = Number(countRows?.[0]?.total || 0);

    const headerAmountSel = purchaseAmountSelectExpr("p", schema.headerAmountCol);

    const [rows] = await db.query(
      `
      SELECT
        p.id,
        p.purchase_from,
        p.invoice_number,
        p.purchase_date,
        ${headerAmountSel},
        p.notes,
        p.created_at,

        COALESCE(x.total_items, 0) AS total_items,
        COALESCE(x.inserted_items, 0) AS inserted_items,
        COALESCE(x.skipped_items, 0) AS skipped_items

      FROM vehicle_purchases p
      LEFT JOIN (
        SELECT
          purchase_id,
          COUNT(*) AS total_items,
          SUM(CASE WHEN status_code = 'NEW' THEN 1 ELSE 0 END) AS inserted_items,
          SUM(CASE WHEN status_code <> 'NEW' THEN 1 ELSE 0 END) AS skipped_items
        FROM vehicle_purchase_items
        GROUP BY purchase_id
      ) x ON x.purchase_id = p.id

      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    return res.json({ success: true, data: rows, page, pageSize, total });
  } catch (e) {
    console.error("purchases listPurchases:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// GET /api/purchases/_export
// =====================================================
exports.exportPurchasesExcel = async (req, res) => {
  try {
    const schema = await getSchemaCached();

    const q = String(req.query.q || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    const purchase_from = String(req.query.purchase_from || "").trim();

    const where = ["1=1"];
    const params = [];

    if (purchase_from) {
      where.push("COALESCE(p.purchase_from,'') = ?");
      params.push(purchase_from);
    }
    if (from) {
      where.push("p.purchase_date >= ?");
      params.push(from);
    }
    if (to) {
      where.push("p.purchase_date <= ?");
      params.push(to);
    }
    if (q) {
      const like = `%${q}%`;
      where.push(`(
        COALESCE(p.purchase_from,'') LIKE ?
        OR COALESCE(p.invoice_number,'') LIKE ?
        OR CAST(p.id AS CHAR) LIKE ?
      )`);
      params.push(like, like, like);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const headerAmountSel = purchaseAmountSelectExpr("p", schema.headerAmountCol);

    const [rows] = await db.query(
      `
      SELECT
        p.id,
        p.purchase_from,
        p.invoice_number,
        p.purchase_date,
        ${headerAmountSel},
        p.notes,
        p.created_at,
        COALESCE(x.total_items, 0) AS total_items,
        COALESCE(x.inserted_items, 0) AS inserted_items,
        COALESCE(x.skipped_items, 0) AS skipped_items
      FROM vehicle_purchases p
      LEFT JOIN (
        SELECT
          purchase_id,
          COUNT(*) AS total_items,
          SUM(CASE WHEN status_code = 'NEW' THEN 1 ELSE 0 END) AS inserted_items,
          SUM(CASE WHEN status_code <> 'NEW' THEN 1 ELSE 0 END) AS skipped_items
        FROM vehicle_purchase_items
        GROUP BY purchase_id
      ) x ON x.purchase_id = p.id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT 5000
      `,
      params
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Purchases");

    ws.columns = [
      { header: "Purchase ID", key: "id", width: 12 },
      { header: "Purchase From", key: "purchase_from", width: 26 },
      { header: "Invoice Number", key: "invoice_number", width: 20 },
      { header: "Purchase Date", key: "purchase_date", width: 14 },
      { header: "Purchase Amount", key: "purchase_amount", width: 16 },
      { header: "Vehicles Total", key: "total_items", width: 14 },
      { header: "Inserted", key: "inserted_items", width: 12 },
      { header: "Skipped", key: "skipped_items", width: 12 },
      { header: "Notes", key: "notes", width: 30 },
      { header: "Created At", key: "created_at", width: 20 },
    ];

    rows.forEach((r) => ws.addRow(r));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="purchases_export.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("purchases exportPurchasesExcel:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// GET /api/purchases/:id/_export-items
// =====================================================
exports.exportPurchaseItemsExcel = async (req, res) => {
  try {
    const schema = await getSchemaCached();

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid ID" });

    const headerAmountSel = purchaseAmountSelectExpr("p", schema.headerAmountCol);

    const [p] = await db.query(
      `
      SELECT
        p.id,
        p.purchase_from,
        p.invoice_number,
        p.purchase_date,
        ${headerAmountSel}
      FROM vehicle_purchases p
      WHERE p.id=? LIMIT 1
      `,
      [id]
    );
    if (!p.length) return res.status(404).json({ success: false, message: "Not found" });

    const priceCol = schema.itemPriceCol || "purchase_price";

    const [items] = await db.query(
      `
      SELECT
        id,
        purchase_id,
        contact_vehicle_id,
        engine_number,
        chassis_number,
        model_id,
        variant_id,
        color,
        ${priceCol} AS purchase_price,
        status_code,
        existing_vehicle_id,
        existing_sale_id,
        created_at
      FROM vehicle_purchase_items
      WHERE purchase_id=?
      ORDER BY id ASC
      `,
      [id]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Purchase Items");

    ws.addRow(["Purchase ID", p[0].id]);
    ws.addRow(["Purchase From", p[0].purchase_from || ""]);
    ws.addRow(["Invoice Number", p[0].invoice_number || ""]);
    ws.addRow(["Purchase Date", p[0].purchase_date || ""]);
    ws.addRow(["Purchase Amount", p[0].purchase_amount ?? ""]);
    ws.addRow([]);

    ws.columns = [
      { header: "Item ID", key: "id", width: 10 },
      { header: "Vehicle ID", key: "contact_vehicle_id", width: 12 },
      { header: "Engine", key: "engine_number", width: 20 },
      { header: "Chassis", key: "chassis_number", width: 22 },
      { header: "Color", key: "color", width: 10 },
      { header: "Purchase Price", key: "purchase_price", width: 14 },
      { header: "Status", key: "status_code", width: 14 },
      { header: "Existing Vehicle", key: "existing_vehicle_id", width: 16 },
      { header: "Existing Sale", key: "existing_sale_id", width: 14 },
      { header: "Created At", key: "created_at", width: 20 },
    ];

    items.forEach((r) => ws.addRow(r));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="purchase_${id}_items.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("purchases exportPurchaseItemsExcel:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

