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

async function autoHealUnlinkedStockItems(db, purchaseId) {
  try {
    // find stuck rows
    const [rows] = await db.query(
      `
      SELECT vpi.id, vpi.existing_vehicle_id
      FROM vehicle_purchase_items vpi
      JOIN contact_vehicles cv ON cv.id = vpi.existing_vehicle_id
      LEFT JOIN sales s
        ON s.contact_vehicle_id = cv.id
       AND s.is_cancelled = 0
      WHERE vpi.purchase_id = ?
        AND vpi.contact_vehicle_id IS NULL
        AND vpi.existing_vehicle_id IS NOT NULL
        AND UPPER(COALESCE(vpi.status_code, '')) = 'UNLINKED'
        AND cv.contact_id IS NULL
AND s.id IS NULL

      `,
      [purchaseId]
    );

    if (!rows.length) return;

    for (const r of rows) {
      // restore vehicle
      await db.query(
        `
        UPDATE contact_vehicles
        SET is_deleted = 0,
            deleted_at = NULL,
            deleted_by = NULL
        WHERE id = ?
        `,
        [r.existing_vehicle_id]
      );

      // link purchase item
      await db.query(
        `
        UPDATE vehicle_purchase_items
        SET contact_vehicle_id = ?,
            status_code = 'in_stock',
            existing_vehicle_id = NULL,
            existing_sale_id = NULL
        WHERE id = ?
        `,
        [r.existing_vehicle_id, r.id]
      );
    }

    console.log(`✅ Auto-healed ${rows.length} stock items for purchase ${purchaseId}`);
  } catch (err) {
    console.error("Auto-heal failed:", err.message);
  }
}

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

  return rows?.[0]?.id ? Number(rows[0].id) : null;
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
// -----------------------------------------------------
// Duplicate status helper
// - checks existing vehicle by engine/chassis
// - supports reusable soft-deleted vehicle master rows
// -----------------------------------------------------
async function findVehicleMasterMatch(connOrDb, engine_number, chassis_number, opts = {}) {
  const eng = normalizeToken(engine_number);
  const chs = normalizeToken(chassis_number);
  const excludeVehicleId = Number(opts.excludeVehicleId || 0);

  if (!eng || !chs) return null;

  const [rows] = await connOrDb.query(
    `
    SELECT
      cv.id,
      cv.contact_id,
      cv.is_deleted,
      cv.deleted_at,
      cv.deleted_by,
      ${opts.includePurchaseId ? "cv.purchase_id," : ""}
      (
        SELECT s.id
        FROM sales s
        WHERE s.contact_vehicle_id = cv.id
          AND s.is_cancelled = 0
        ORDER BY s.id DESC
        LIMIT 1
      ) AS active_sale_id,
      (
        SELECT COUNT(*)
        FROM sale_vehicle_links svl
        WHERE svl.vehicle_id = cv.id
      ) AS link_count
    FROM contact_vehicles cv
    WHERE cv.id <> ?
      AND (cv.chassis_number = ? OR cv.engine_number = ?)
    ORDER BY cv.is_deleted ASC, cv.id DESC
    LIMIT 1
    `,
    [excludeVehicleId, chs, eng]
  );

  return rows?.[0] || null;
}

async function resolveVehicleModelText(conn, model_id, variant_id) {
  if (variant_id) {
    const [variantRows] = await conn.query(
      `SELECT variant_name FROM vehicle_variants WHERE id = ? LIMIT 1`,
      [variant_id]
    );
    if (variantRows.length) {
      const txt = String(variantRows[0].variant_name || "").trim();
      if (txt) return txt;
    }
  }

  if (model_id) {
    const [modelRows] = await conn.query(
      `SELECT model_name FROM vehicle_models WHERE id = ? LIMIT 1`,
      [model_id]
    );
    if (modelRows.length) {
      const txt = String(modelRows[0].model_name || "").trim();
      if (txt) return txt;
    }
  }

  return null;
}

async function restoreVehicleMaster(conn, vehicleId, purchaseId, schema) {
  const sets = [
    "is_deleted = 0",
    "deleted_at = NULL",
    "deleted_by = NULL",
  ];
  const vals = [];

  if (schema.hasCvPurchaseId) {
    sets.push("purchase_id = COALESCE(purchase_id, ?)");
    vals.push(purchaseId || null);
  }

  vals.push(vehicleId);

  await conn.query(
    `
    UPDATE contact_vehicles
    SET ${sets.join(", ")}
    WHERE id = ?
    `,
    vals
  );
}

async function updateVehicleMasterFields(
  conn,
  vehicleId,
  { engine_number, chassis_number, model_id, variant_id, color, vehicle_make, vehicle_model, purchaseId },
  schema
) {
  const updates = [
    "engine_number = ?",
    "chassis_number = ?",
    "model_id = ?",
    "variant_id = ?",
    "color = ?",
  ];

  const vals = [
    engine_number,
    chassis_number,
    model_id,
    variant_id,
    color,
  ];

  if (schema.contactVehicleCols.has("vehicle_make")) {
    updates.push("vehicle_make = ?");
    vals.push(vehicle_make || null);
  }

  if (schema.contactVehicleCols.has("vehicle_model")) {
    updates.push("vehicle_model = ?");
    vals.push(vehicle_model || null);
  }

  if (schema.hasCvPurchaseId) {
    updates.push("purchase_id = COALESCE(purchase_id, ?)");
    vals.push(purchaseId || null);
  }

  vals.push(vehicleId);

  await conn.query(
    `
    UPDATE contact_vehicles
    SET ${updates.join(", ")}
    WHERE id = ?
    `,
    vals
  );
}

async function createVehicleMaster(
  conn,
  {
    purchaseId,
    contact_id,
    engine_number,
    chassis_number,
    model_id,
    variant_id,
    color,
    vehicle_make,
    vehicle_model,
  },
  schema
) {
  const cols = [
    "contact_id",
    "chassis_number",
    "engine_number",
    "model_id",
    "variant_id",
    "vehicle_make",
    "vehicle_model",
    "color",
  ];

  const vals = [
    contact_id ?? null,
    chassis_number,
    engine_number,
    model_id,
    variant_id,
    vehicle_make || null,
    vehicle_model || null,
    color || null,
  ];

  if (schema.hasCvPurchaseId) {
    cols.push("purchase_id");
    vals.push(purchaseId || null);
  }

  const [ins] = await conn.query(
    `INSERT INTO contact_vehicles (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    vals
  );

  return ins.insertId;
}

async function ensureVehicleMasterForPurchaseItem(
  conn,
  {
    purchaseId,
    linkedVehicleId,
    contact_id,
    engine_number,
    chassis_number,
    model_id,
    variant_id,
    color,
    vehicle_make,
    vehicle_model,
  },
  schema
) {
  const eng = normalizeToken(engine_number);
  const chs = normalizeToken(chassis_number);

  if (!eng || !chs) {
    throw new Error("Engine and chassis are required");
  }

  const modelText =
    vehicle_model ||
    (await resolveVehicleModelText(conn, model_id, variant_id)) ||
    null;

  // 1) If item is already linked, prefer healing/reusing that row
  if (linkedVehicleId) {
    const [linkedRows] = await conn.query(
      `
      SELECT
        cv.id,
        cv.contact_id,
        cv.is_deleted,
        (
          SELECT s.id
          FROM sales s
          WHERE s.contact_vehicle_id = cv.id
            AND s.is_cancelled = 0
          ORDER BY s.id DESC
          LIMIT 1
        ) AS active_sale_id,
        (
          SELECT COUNT(*)
          FROM sale_vehicle_links svl
          WHERE svl.vehicle_id = cv.id
        ) AS link_count
      FROM contact_vehicles cv
      WHERE cv.id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [linkedVehicleId]
    );

    if (linkedRows.length) {
      const linked = linkedRows[0];

      if (Number(linked.is_deleted || 0) === 1) {
        if (linked.contact_id || linked.active_sale_id || Number(linked.link_count || 0) > 0) {
          throw new Error(
            `Deleted vehicle master cannot be restored because it is already used (Vehicle ID: ${linked.id})`
          );
        }

        await restoreVehicleMaster(conn, linked.id, purchaseId, schema);
      }

      await updateVehicleMasterFields(
        conn,
        linked.id,
        {
          purchaseId,
          engine_number: eng,
          chassis_number: chs,
          model_id,
          variant_id,
          color,
          vehicle_make,
          vehicle_model: modelText,
        },
        schema
      );

      return { vehicleId: linked.id, action: "LINKED_EXISTING" };
    }
  }

  // 2) Find another row by chassis/engine
  const match = await findVehicleMasterMatch(conn, eng, chs, {
    excludeVehicleId: linkedVehicleId || 0,
    includePurchaseId: true,
  });

  if (!match) {
    const newId = await createVehicleMaster(
      conn,
      {
        purchaseId,
        contact_id,
        engine_number: eng,
        chassis_number: chs,
        model_id,
        variant_id,
        color,
        vehicle_make,
        vehicle_model: modelText,
      },
      schema
    );

    return { vehicleId: newId, action: "CREATED_NEW" };
  }

  // 3) Sold / active linked conflict
  if (match.active_sale_id) {
    throw new Error(
      `Engine/chassis already sold (Vehicle ID: ${match.id}, Sale ID: ${match.active_sale_id})`
    );
  }

  // 4) Soft-deleted row -> revive if truly safe
  if (Number(match.is_deleted || 0) === 1) {
    if (match.contact_id || Number(match.link_count || 0) > 0) {
      throw new Error(
        `Deleted vehicle master already has protected history (Vehicle ID: ${match.id})`
      );
    }

    await restoreVehicleMaster(conn, match.id, purchaseId, schema);

    await updateVehicleMasterFields(
      conn,
      match.id,
      {
        purchaseId,
        engine_number: eng,
        chassis_number: chs,
        model_id,
        variant_id,
        color,
        vehicle_make,
        vehicle_model: modelText,
      },
      schema
    );

    return { vehicleId: Number(match.id), action: "RESTORED_DELETED" };
  }

  // 5) Active + customer-linked -> real duplicate conflict
  if (match.contact_id) {
    throw new Error(
      `Engine/chassis already exists in vehicle master (Vehicle ID: ${match.id})`
    );
  }

  // 6) Active but unlinked -> reuse safely
  await updateVehicleMasterFields(
    conn,
    match.id,
    {
      purchaseId,
      engine_number: eng,
      chassis_number: chs,
      model_id,
      variant_id,
      color,
      vehicle_make,
      vehicle_model: modelText,
    },
    schema
  );

  return { vehicleId: Number(match.id), action: "REUSED_UNLINKED" };
}

async function getDuplicateStatus(engine_number, chassis_number) {
  const eng = normalizeToken(engine_number);
  const chs = normalizeToken(chassis_number);

  if (!eng || !chs) {
    return { code: "INVALID", label: "Invalid", vehicle_id: null, sale_id: null };
  }

  const row = await findVehicleMasterMatch(db, eng, chs);

  if (!row) {
    return { code: "NEW", label: "New", vehicle_id: null, sale_id: null };
  }

  const vehicle_id = Number(row.id);
  const sale_id = row.active_sale_id ? Number(row.active_sale_id) : null;

  if (sale_id) {
    return { code: "SOLD", label: `Already Sold (Sale ID: ${sale_id})`, vehicle_id, sale_id };
  }

  if (Number(row.is_deleted || 0) === 1) {
    if (!row.contact_id && Number(row.link_count || 0) === 0) {
      return {
        code: "RESTORABLE",
        label: `Deleted / Reusable (Vehicle ID: ${vehicle_id})`,
        vehicle_id,
        sale_id: null,
      };
    }

    return {
      code: "DUPLICATE",
      label: `Deleted Vehicle Exists (Vehicle ID: ${vehicle_id})`,
      vehicle_id,
      sale_id: null,
    };
  }

  if (!row.contact_id) {
    return {
      code: "UNLINKED",
      label: `Exists but Unlinked (Vehicle ID: ${vehicle_id})`,
      vehicle_id,
      sale_id: null,
    };
  }

  return {
    code: "DUPLICATE",
    label: `Already Exists (Vehicle ID: ${vehicle_id})`,
    vehicle_id,
    sale_id: null,
  };
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
// =====================================================
// POST /api/purchases/from-invoice
// Create purchase header + items + insert ONLY NEW vehicles
// =====================================================
exports.createPurchaseFromInvoice = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const schema = await getSchemaCached();

    const body = req.body || {};
    const vehicles = Array.isArray(body.vehicles) ? body.vehicles : [];

    const purchase_from = body.purchase_from ? String(body.purchase_from).trim() : null;
    const transporter_name = body.transporter_name ? String(body.transporter_name).trim() : null;
    const lr_number = body.lr_number ? String(body.lr_number).trim() : null;
    const transport_vehicle_number = body.transport_vehicle_number
      ? String(body.transport_vehicle_number).trim()
      : null;

    const invoice_number = body.invoice_number ? String(body.invoice_number).trim() : null;
    const invoice_date = parseDateToYMD(body.invoice_date) || null;
    const purchase_date =
      parseDateToYMD(body.purchase_date) ||
      (body.purchase_date ? String(body.purchase_date).trim() : null);

    const purchase_amount = getHeaderAmountValue(body.purchase_amount);
    const notes = body.notes ? String(body.notes) : null;

    const contact_id =
      body.contact_id != null && String(body.contact_id).trim() !== ""
        ? Number(body.contact_id)
        : null;

    const requested_branch_id =
      body.branch_id != null && String(body.branch_id).trim() !== ""
        ? Number(body.branch_id)
        : null;

    const vehicle_make = body.vehicle_make ? String(body.vehicle_make).trim() : "HERO BIKE";
    const invoice_file = body.invoice_file ? String(body.invoice_file).trim() : null;

    if (!vehicles.length) {
      return res.status(400).json({ success: false, message: "No vehicles provided" });
    }

    await conn.beginTransaction();

    // 1) Resolve branch safely without breaking old logic
    const created_by = req.user?.id || null;

    let final_branch_id = requested_branch_id;

    if (!Number.isFinite(final_branch_id) || final_branch_id <= 0) {
      final_branch_id = await getDefaultBranchId(conn);
    }

    if (!final_branch_id) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: "No active branch found. Please create or activate a branch first.",
      });
    }

    // 2) Create purchase header
    const headerCols = [
      "purchase_from",
      "transporter_name",
      "lr_number",
      "transport_vehicle_number",
      "invoice_number",
    ];

    const headerVals = [
      purchase_from,
      transporter_name,
      lr_number,
      transport_vehicle_number,
      invoice_number,
    ];

    // add branch_id only if column exists
    if (schema.purchaseCols.has("branch_id")) {
      headerCols.push("branch_id");
      headerVals.push(final_branch_id);
    }

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
      `INSERT INTO vehicle_purchases (${headerCols.join(",")}) VALUES (${headerCols
        .map(() => "?")
        .join(",")})`,
      headerVals
    );
    const purchase_id = insP.insertId;

    let inserted = 0;
    let skipped = 0;

    // 3) Each row -> create/reuse/restore vehicle master safely
    for (const v of vehicles) {
      const engine_number = normalizeToken(v.engine_number || "");
      const chassis_number = normalizeToken(v.chassis_number || "");

      const model_id = v.model_id != null && v.model_id !== "" ? Number(v.model_id) : null;
      const variant_id =
        v.variant_id != null && v.variant_id !== "" ? Number(v.variant_id) : null;
      const color = v.color ? String(v.color).trim() : null;

      const rowPrice =
        (v.purchase_price != null && v.purchase_price !== ""
          ? Number(v.purchase_price)
          : null) ??
        (v.amount != null && v.amount !== "" ? Number(v.amount) : null);

      const vehicle_model = v.vehicle_model ? String(v.vehicle_model).trim() : null;

      const previewStatus = await getDuplicateStatus(engine_number, chassis_number);

      let contact_vehicle_id = null;
      let itemStatusCode = previewStatus.code;
      let existing_vehicle_id = previewStatus.vehicle_id;
      let existing_sale_id = previewStatus.sale_id;

      if (["NEW", "UNLINKED", "RESTORABLE"].includes(previewStatus.code)) {
        const ensured = await ensureVehicleMasterForPurchaseItem(
          conn,
          {
            purchaseId: purchase_id,
            linkedVehicleId: null,
            contact_id,
            engine_number,
            chassis_number,
            model_id,
            variant_id,
            color,
            vehicle_make,
            vehicle_model,
          },
          schema
        );

        contact_vehicle_id = ensured.vehicleId;
        itemStatusCode = "in_stock";
        existing_vehicle_id = null;
        existing_sale_id = null;
        inserted++;
      } else {
        skipped++;
      }

      const priceCol = schema.itemPriceCol || "purchase_price";

      // add current_branch_id only if column exists
      if (schema.itemCols.has("current_branch_id")) {
        await conn.query(
          `
          INSERT INTO vehicle_purchase_items
            (purchase_id, current_branch_id, contact_vehicle_id, chassis_number, engine_number, model_id, variant_id, color, ${priceCol},
             status_code, existing_vehicle_id, existing_sale_id)
          VALUES
            (?,?,?,?,?,?,?,?,?,?,?,?)
          `,
          [
            purchase_id,
            final_branch_id,
            contact_vehicle_id,
            chassis_number,
            engine_number,
            model_id,
            variant_id,
            color,
            rowPrice,
            itemStatusCode,
            existing_vehicle_id,
            existing_sale_id,
          ]
        );
      } else {
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
            itemStatusCode,
            existing_vehicle_id,
            existing_sale_id,
          ]
        );
      }
    }

    await conn.commit();

    return res.json({
      success: true,
      purchase_id,
      branch_id: final_branch_id,
      summary: { inserted, skipped, total: vehicles.length },
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    console.error("purchases createPurchaseFromInvoice:", e);
    return res.status(500).json({ success: false, message: e.message || "Server error" });
  } finally {
    try {
      conn.release();
    } catch {}
  }
};

// =====================================================
// GET /api/purchases/:id
// =====================================================
// =====================================================
// GET /api/purchases/:id
// =====================================================
exports.getPurchaseById = async (req, res) => {
  
  try {
    const schema = await getSchemaCached();

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid ID" });

await autoHealUnlinkedStockItems(db, id);

    const headerAmountSel = purchaseAmountSelectExpr("p", schema.headerAmountCol);

    const [p] = await db.query(
      `
      SELECT
        p.*,
        ${headerAmountSel}
      FROM vehicle_purchases p
      WHERE p.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!p.length) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const priceCol = schema.itemPriceCol || "purchase_price";

    const [items] = await db.query(
      `
      SELECT
        i.id,
        i.purchase_id,
        i.contact_vehicle_id,
        i.chassis_number,
        i.engine_number,
        i.model_id,
        i.variant_id,
        vm.model_name,
        vv.variant_name,
        TRIM(
          CONCAT(
            COALESCE(vm.model_name, ''),
            CASE
              WHEN vv.variant_name IS NOT NULL AND vv.variant_name <> ''
              THEN CONCAT(' / ', vv.variant_name)
              ELSE ''
            END
          )
        ) AS vehicle_name,
        i.color,
        i.${priceCol} AS purchase_price,
        i.status_code,
        i.existing_vehicle_id,
        i.existing_sale_id,
        i.created_at
      FROM vehicle_purchase_items i
      LEFT JOIN vehicle_models vm ON vm.id = i.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = i.variant_id
      WHERE i.purchase_id = ?
      ORDER BY i.id ASC
      `,
      [id]
    );

    return res.json({
      success: true,
      data: {
        purchase: p[0],
        items,
      },
    });
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
          SUM(CASE WHEN status_code = 'in_stock' THEN 1 ELSE 0 END) AS inserted_items,
SUM(CASE WHEN status_code <> 'in_stock' THEN 1 ELSE 0 END) AS skipped_items
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
          SUM(CASE WHEN status_code = 'in_stock' THEN 1 ELSE 0 END) AS inserted_items,
SUM(CASE WHEN status_code <> 'in_stock' THEN 1 ELSE 0 END) AS skipped_items
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
      WHERE p.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!p.length) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const priceCol = schema.itemPriceCol || "purchase_price";

    const [items] = await db.query(
      `
      SELECT
        i.id,
        i.purchase_id,
        i.contact_vehicle_id,
        i.engine_number,
        i.chassis_number,
        i.model_id,
        i.variant_id,
        vm.model_name,
        vv.variant_name,
        TRIM(
          CONCAT(
            COALESCE(vm.model_name, ''),
            CASE
              WHEN vv.variant_name IS NOT NULL AND vv.variant_name <> ''
              THEN CONCAT(' / ', vv.variant_name)
              ELSE ''
            END
          )
        ) AS vehicle_name,
        i.color,
        i.${priceCol} AS purchase_price,
        i.status_code,
        i.existing_vehicle_id,
        i.existing_sale_id,
        i.created_at
      FROM vehicle_purchase_items i
      LEFT JOIN vehicle_models vm ON vm.id = i.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = i.variant_id
      WHERE i.purchase_id = ?
      ORDER BY i.id ASC
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
      { header: "Vehicle Name", key: "vehicle_name", width: 28 },
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

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="purchase_${id}_items.xlsx"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("purchases exportPurchaseItemsExcel:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

async function deletePurchaseItemAndMaybeVehicleMaster(
  conn,
  { purchaseId, itemId, userId = null }
) {
  const [itemRows] = await conn.query(
    `
    SELECT
      id,
      purchase_id,
      contact_vehicle_id,
      chassis_number,
      engine_number,
      status_code,
      sale_id
    FROM vehicle_purchase_items
    WHERE id = ? AND purchase_id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [itemId, purchaseId]
  );

  if (!itemRows.length) {
    throw new Error(`Purchase item not found: ${itemId}`);
  }

  const item = itemRows[0];
  const contactVehicleId = item.contact_vehicle_id ? Number(item.contact_vehicle_id) : null;

  // If this stock item is already sold / linked to sale, do not allow delete
  if (item.sale_id) {
    throw new Error(
      `Cannot remove purchase item because it is linked to Sale ID ${item.sale_id}`
    );
  }

  if (String(item.status_code || "").toLowerCase() === "sold") {
    throw new Error(
      `Cannot remove purchase item because stock is already marked sold (${item.chassis_number})`
    );
  }

  const [saleRows] = await conn.query(
    `
    SELECT id
    FROM sales
    WHERE stock_item_id = ?
      AND is_cancelled = 0
    LIMIT 1
    `,
    [itemId]
  );

  if (saleRows.length) {
    throw new Error(
      `Cannot remove purchase item because it is linked to active sale (${item.chassis_number})`
    );
  }

  // Delete stock item row first
  await conn.query(
    `DELETE FROM vehicle_purchase_items WHERE id = ? AND purchase_id = ?`,
    [itemId, purchaseId]
  );

  // If linked vehicle master exists, delete it only if it is not used elsewhere
  if (contactVehicleId) {
    const [otherItemRows] = await conn.query(
      `
      SELECT id
      FROM vehicle_purchase_items
      WHERE contact_vehicle_id = ?
      LIMIT 1
      `,
      [contactVehicleId]
    );

    const [otherSaleRows] = await conn.query(
      `
      SELECT id
      FROM sales
      WHERE contact_vehicle_id = ?
        AND is_cancelled = 0
      LIMIT 1
      `,
      [contactVehicleId]
    );

    const [saleLinkRows] = await conn.query(
      `
      SELECT id
      FROM sale_vehicle_links
      WHERE vehicle_id = ?
      LIMIT 1
      `,
      [contactVehicleId]
    );

    if (!otherItemRows.length && !otherSaleRows.length && !saleLinkRows.length) {
      await conn.query(
        `
        UPDATE contact_vehicles
        SET is_deleted = 1,
            deleted_at = NOW(),
            deleted_by = ?
        WHERE id = ?
          AND is_deleted = 0
        `,
        [userId, contactVehicleId]
      );
    }
  }
}

async function deletePurchaseHeaderIfEmpty(conn, purchaseId) {
  const [countRows] = await conn.query(
    `
    SELECT COUNT(*) AS cnt
    FROM vehicle_purchase_items
    WHERE purchase_id = ?
    `,
    [purchaseId]
  );

  const cnt = Number(countRows?.[0]?.cnt || 0);

  if (cnt === 0) {
    await conn.query(
      `DELETE FROM vehicle_purchases WHERE id = ?`,
      [purchaseId]
    );
    return true;
  }

  return false;
}
// =====================================================
// PUT /api/purchases/:id
// Update purchase header only
// =====================================================
// =====================================================
// PUT /api/purchases/:id
// Update purchase header + existing item rows
// =====================================================
// =====================================================
// PUT /api/purchases/:id
// Update purchase header + existing item rows
// Also sync linked contact_vehicles safely
// =====================================================
// =====================================================
// PUT /api/purchases/:id
// Update purchase header + existing item rows
// Also sync linked contact_vehicles safely
// =====================================================
exports.updatePurchaseById = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const schema = await getSchemaCached();

    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const [existingRows] = await conn.query(
      `SELECT id FROM vehicle_purchases WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    const body = req.body || {};

    const purchase_from =
      body.purchase_from != null ? String(body.purchase_from).trim() : null;

    const transporter_name =
      body.transporter_name != null && String(body.transporter_name).trim() !== ""
        ? String(body.transporter_name).trim()
        : null;

    const lr_number =
      body.lr_number != null && String(body.lr_number).trim() !== ""
        ? String(body.lr_number).trim()
        : null;

    const transport_vehicle_number =
      body.transport_vehicle_number != null &&
      String(body.transport_vehicle_number).trim() !== ""
        ? String(body.transport_vehicle_number).trim()
        : null;

    const invoice_number =
      body.invoice_number != null ? String(body.invoice_number).trim() : null;

    const invoice_date =
      body.invoice_date != null && String(body.invoice_date).trim() !== ""
        ? parseDateToYMD(body.invoice_date)
        : null;

    const purchase_date =
      body.purchase_date != null && String(body.purchase_date).trim() !== ""
        ? parseDateToYMD(body.purchase_date)
        : null;

    const purchase_amount = getHeaderAmountValue(body.purchase_amount);

    const notes =
      body.notes != null && String(body.notes).trim() !== ""
        ? String(body.notes)
        : null;

    const items = Array.isArray(body.items) ? body.items : [];

    if (!purchase_from) {
      return res.status(400).json({
        success: false,
        message: "Purchase From is required",
      });
    }

    if (!purchase_date) {
      return res.status(400).json({
        success: false,
        message: "Purchase Date is required",
      });
    }

    const seenEngine = new Set();
    const seenChassis = new Set();

    for (const row of items) {
      const eng = normalizeToken(row.engine_number || "");
      const chs = normalizeToken(row.chassis_number || "");

      if (!eng || !chs) {
        return res.status(400).json({
          success: false,
          message: "Engine and chassis are required for all items",
        });
      }

      if (seenEngine.has(eng)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate engine in request: ${eng}`,
        });
      }

      if (seenChassis.has(chs)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate chassis in request: ${chs}`,
        });
      }

      seenEngine.add(eng);
      seenChassis.add(chs);
    }

    await conn.beginTransaction();

    // ----------------------------
    // Update header first
    // ----------------------------
    const updates = [];
    const values = [];

    updates.push("purchase_from = ?");
    values.push(purchase_from);

    updates.push("transporter_name = ?");
    values.push(transporter_name);

    updates.push("lr_number = ?");
    values.push(lr_number);

    updates.push("transport_vehicle_number = ?");
    values.push(transport_vehicle_number);

    updates.push("invoice_number = ?");
    values.push(invoice_number);

    if (schema.hasInvoiceDate) {
      updates.push("invoice_date = ?");
      values.push(invoice_date);
    }

    updates.push("purchase_date = ?");
    values.push(purchase_date);

    if (schema.headerAmountCol) {
      updates.push(`${schema.headerAmountCol} = ?`);
      values.push(purchase_amount);
    }

    updates.push("notes = ?");
    values.push(notes);

    values.push(id);

    await conn.query(
      `
      UPDATE vehicle_purchases
      SET ${updates.join(", ")}
      WHERE id = ?
      `,
      values
    );

    const priceCol = schema.itemPriceCol || "purchase_price";

    const [dbItems] = await conn.query(
      `
      SELECT id, contact_vehicle_id
      FROM vehicle_purchase_items
      WHERE purchase_id = ?
      `,
      [id]
    );

    const allowedMap = new Map(
      dbItems.map((r) => [Number(r.id), r.contact_vehicle_id ? Number(r.contact_vehicle_id) : null])
    );

    const submittedItemIds = new Set(
      items.map((r) => Number(r.id)).filter((x) => Number.isFinite(x) && x > 0)
    );

    // ---------------------------------------------------
    // DELETE REMOVED ITEMS FROM PURCHASE/STOCK
    // ---------------------------------------------------
    for (const dbRow of dbItems) {
      const dbItemId = Number(dbRow.id);
      if (!submittedItemIds.has(dbItemId)) {
        await deletePurchaseItemAndMaybeVehicleMaster(conn, {
          purchaseId: id,
          itemId: dbItemId,
          userId: req.user?.id || null,
        });
      }
    }

    // ---------------------------------------------------
    // If all items removed -> delete full purchase header
    // ---------------------------------------------------
    if (!items.length) {
      const deletedPurchase = await deletePurchaseHeaderIfEmpty(conn, id);

      await conn.commit();

      return res.json({
        success: true,
        deleted_purchase: deletedPurchase,
        message: deletedPurchase
          ? "Purchase deleted successfully"
          : "Purchase updated successfully",
      });
    }

    // Refresh current map after deletes
    const [dbItemsAfterDelete] = await conn.query(
      `
      SELECT id, contact_vehicle_id
      FROM vehicle_purchase_items
      WHERE purchase_id = ?
      `,
      [id]
    );

    const currentMap = new Map(
      dbItemsAfterDelete.map((r) => [Number(r.id), r.contact_vehicle_id ? Number(r.contact_vehicle_id) : null])
    );

    for (const row of items) {
      const itemId = Number(row.id);
      if (!itemId || !currentMap.has(itemId)) {
        throw new Error(`Invalid item id: ${row.id}`);
      }

      const currentLinkedVehicleId = currentMap.get(itemId);

      const engine_number = normalizeToken(row.engine_number || "");
      const chassis_number = normalizeToken(row.chassis_number || "");

      const model_id =
        row.model_id != null && String(row.model_id).trim() !== ""
          ? Number(row.model_id)
          : null;

      const variant_id =
        row.variant_id != null && String(row.variant_id).trim() !== ""
          ? Number(row.variant_id)
          : null;

      const color =
        row.color != null && String(row.color).trim() !== ""
          ? String(row.color).trim()
          : null;

      const purchase_price =
        row.purchase_price != null && String(row.purchase_price).trim() !== ""
          ? Number(row.purchase_price)
          : null;

      const [dupItemRows] = await conn.query(
        `
        SELECT id
        FROM vehicle_purchase_items
        WHERE id <> ?
          AND (chassis_number = ? OR engine_number = ?)
        LIMIT 1
        `,
        [itemId, chassis_number, engine_number]
      );

      if (dupItemRows.length) {
        throw new Error(
          `Engine/chassis already exists in another purchase item (${engine_number} / ${chassis_number})`
        );
      }

      const ensured = await ensureVehicleMasterForPurchaseItem(
        conn,
        {
          purchaseId: id,
          linkedVehicleId: currentLinkedVehicleId,
          contact_id: null,
          engine_number,
          chassis_number,
          model_id,
          variant_id,
          color,
          vehicle_make: "HERO BIKE",
          vehicle_model: null,
        },
        schema
      );

      await conn.query(
        `
        UPDATE vehicle_purchase_items
        SET
          contact_vehicle_id = ?,
          engine_number = ?,
          chassis_number = ?,
          model_id = ?,
          variant_id = ?,
          color = ?,
          ${priceCol} = ?,
          status_code = 'in_stock',
          existing_vehicle_id = NULL,
          existing_sale_id = NULL
        WHERE id = ? AND purchase_id = ?
        `,
        [
          ensured.vehicleId,
          engine_number,
          chassis_number,
          model_id,
          variant_id,
          color,
          purchase_price,
          itemId,
          id,
        ]
      );
    }

    await conn.commit();

    return res.json({
      success: true,
      message: "Purchase updated successfully",
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    console.error("purchases updatePurchaseById:", e);
    return res.status(500).json({
      success: false,
      message: e.message || "Server error",
    });
  } finally {
    try {
      conn.release();
    } catch {}
  }
};