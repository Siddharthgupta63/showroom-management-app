// backend/controllers/salesController.js
const db = require("../db");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// =====================================================
// Upload storage (documents)
// =====================================================
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "sales");

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {}
}
ensureDir(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    ensureDir(UPLOAD_DIR);
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const safe = String(file.originalname || "file").replace(/[^\w.\-]+/g, "_").slice(-120);
    const name = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// =====================================================
// Helpers
// =====================================================
function toDateISO(d) {
  if (!d) return null;

  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const s = String(d).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeText(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function numOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toIntOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function safeJsonArrayOrNull(v) {
  if (!v) return null;
  try {
    const obj = typeof v === "string" ? JSON.parse(v) : v;
    if (!Array.isArray(obj)) return null;
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function getPageParams(req, defaults = { page: 1, pageSize: 50 }) {
  const page = clampInt(req.query.page, defaults.page, 1, 1000000);
  const pageSize = clampInt(req.query.pageSize ?? req.query.limit, defaults.pageSize, 1, 500);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function normalizeSaleExtraFields(body) {
  return {
    father_name: safeText(body.father_name),
    age: body.age != null ? toIntOrNull(body.age) : null,

    nominee_name: safeText(body.nominee_name),
    nominee_relation: safeText(body.nominee_relation),

    key_no: safeText(body.key_no),
    tyre: safeText(body.tyre),
    battery_no: safeText(body.battery_no),
    helmet: safeText(body.helmet),

    insurance_number: safeText(body.insurance_number || body.insurance_no),
    insurance_company: safeText(body.insurance_company),
    cpa_insurance_number: safeText(body.cpa_insurance_number || body.cpa_insurance_no),
    insurance_broker: safeText(body.insurance_broker),

    finance_company: safeText(body.finance_company),

    aadhaar_number: safeText(body.aadhaar_number),
    sb_tools: safeText(body.sb_tools),
    good_life_no: safeText(body.good_life_no),
  };
}

// =====================================================
// Snapshot helpers (HSRP/RC column-safe)
// =====================================================
async function pickExistingColumn(conn, tableName, candidates) {
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME IN (${candidates.map(() => "?").join(",")})`,
    [tableName, ...candidates]
  );
  const set = new Set(cols.map((r) => r.COLUMN_NAME));
  return candidates.find((c) => set.has(c)) || null;
}

async function getLatestHsrp(conn, saleId) {
  const orderCol = await pickExistingColumn(conn, "hsrp", [
    "order_no",
    "order_number",
    "hsrp_order_no",
    "hsrp_order_number",
    "orderId",
    "order_id",
  ]);

  const sql = orderCol
    ? `SELECT hsrp_number, \`${orderCol}\` AS order_no
       FROM hsrp
       WHERE sale_id = ?
       ORDER BY id DESC
       LIMIT 1`
    : `SELECT hsrp_number, NULL AS order_no
       FROM hsrp
       WHERE sale_id = ?
       ORDER BY id DESC
       LIMIT 1`;

  const [rows] = await conn.query(sql, [saleId]);
  return rows?.[0] || null;
}

async function getLatestRc(conn, saleId) {
  const appCol = await pickExistingColumn(conn, "rc", ["application_no", "rc_application_no"]);
  const rcNoCol = await pickExistingColumn(conn, "rc", ["rc_number", "rc_no", "number"]);

  const sql = `
    SELECT
      ${rcNoCol ? `\`${rcNoCol}\`` : "NULL"} AS rc_number,
      ${appCol ? `\`${appCol}\`` : "NULL"} AS application_no
    FROM rc
    WHERE sale_id = ?
    ORDER BY id DESC
    LIMIT 1
  `;

  const [rows] = await conn.query(sql, [saleId]);
  return rows?.[0] || null;
}

async function getBranchName(conn, branchId) {
  if (!branchId) return null;
  const [rows] = await conn.query(`SELECT branch_name FROM showroom_branches WHERE id = ? LIMIT 1`, [
    branchId,
  ]);
  return rows?.[0]?.branch_name || null;
}

// =====================================================
// Insurance helpers (NEW)
// =====================================================
async function getExistingColumns(conn, tableName, candidates) {
  if (!candidates.length) return new Set();
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME IN (${candidates.map(() => "?").join(",")})`,
    [tableName, ...candidates]
  );
  return new Set(rows.map((r) => r.COLUMN_NAME));
}

async function upsertInsuranceFromSale(conn, saleId, payload, reqUserId, opts = {}) {
  const remarksSuffix = safeText(opts.remarksSuffix);
 const vehicleNo =
  safeText(payload.vehicle_no) ||
  safeText(payload.registration_number) ||
  safeText(payload.registration_no) ||
  "";

 const baseData = {
  sale_id: saleId,
  chassis_number: payload.chassis_number || null,
  engine_number: payload.engine_number || null,
  customer_name: payload.customer_name || null,
  vehicle_no: vehicleNo,
  phone: payload.mobile_number || null,
  insurance_type: "new",
  company: payload.insurance_company || null,
  policy_number: payload.insurance_number || null,
  cpa_included: payload.cpa_applicable ? 1 : 0,
  cpa_number: payload.cpa_insurance_number || null,
  premium_amount: payload.premium_amount != null ? numOrZero(payload.premium_amount) : 0,
  start_date: payload.sale_date || null,
  invoice_number: payload.invoice_number || null,
  remarks: remarksSuffix || "Auto synced from sale",
};

  const hasEnoughData =
    baseData.customer_name ||
    baseData.phone ||
    baseData.vehicle_no ||
    baseData.company ||
    baseData.policy_number ||
    baseData.chassis_number;

  if (!hasEnoughData) return;

const insuranceCols = await getExistingColumns(conn, "insurance", [
  "sale_id",
  "chassis_number",
  "engine_number",
  "customer_name",
  "vehicle_no",
  "phone",
  "insurance_type",
  "company",
  "policy_number",
  "cpa_included",
  "cpa_number",
  "premium_amount",
  "start_date",
  "expiry_date",
  "invoice_number",
  "renewed_by",
  "remarks",
  "agent_name",
  "agent",
  "insurance_broker",
  "broker",
  "is_cancelled",
  "cancelled_at",
  "cancelled_by",
]);

  const insertData = {};

  for (const [k, v] of Object.entries(baseData)) {
    if (insuranceCols.has(k)) insertData[k] = v;
  }

  if (insuranceCols.has("renewed_by")) insertData.renewed_by = reqUserId || null;
  if (insuranceCols.has("insurance_broker")) insertData.insurance_broker = payload.insurance_broker || null;
  if (insuranceCols.has("broker")) insertData.broker = payload.insurance_broker || null;
  if (insuranceCols.has("agent_name")) insertData.agent_name = payload.insurance_broker || null;
  if (insuranceCols.has("agent")) insertData.agent = payload.insurance_broker || null;
  if (insuranceCols.has("is_cancelled")) insertData.is_cancelled = 0;
  if (insuranceCols.has("cancelled_at")) insertData.cancelled_at = null;
  if (insuranceCols.has("cancelled_by")) insertData.cancelled_by = null;

  const [existing] = await conn.query(
    `SELECT id FROM insurance WHERE sale_id = ? LIMIT 1`,
    [saleId]
  );

  if (!existing.length) {
    if (insuranceCols.has("expiry_date")) {
      insertData.expiry_date = null;
    }

    const cols = Object.keys(insertData);
    if (!cols.length) return;

    await conn.query(
      `INSERT INTO insurance (${cols.join(",")})
       VALUES (${cols.map(() => "?").join(",")})`,
      cols.map((c) => insertData[c])
    );
    return;
  }

  const updates = {};

  for (const [k, v] of Object.entries(insertData)) {
    if (k !== "sale_id") updates[k] = v;
  }

  if (insuranceCols.has("expiry_date")) {
    updates.expiry_date = null;
  }

  const updateCols = Object.keys(updates);
  if (!updateCols.length) return;

  await conn.query(
    `UPDATE insurance
     SET ${updateCols.map((c) => `${c} = ?`).join(", ")}
     WHERE sale_id = ?`,
    [...updateCols.map((c) => updates[c]), saleId]
  );
}

async function cancelLinkedInsurance(conn, saleId, reqUserId) {
  const insuranceCols = await getExistingColumns(conn, "insurance", [
    "is_cancelled",
    "cancelled_at",
    "cancelled_by",
    "remarks",
  ]);

  const setParts = [];
  const params = [];

  if (insuranceCols.has("is_cancelled")) {
    setParts.push("is_cancelled = 1");
  }

  if (insuranceCols.has("cancelled_at")) {
    setParts.push("cancelled_at = NOW()");
  }

  if (insuranceCols.has("cancelled_by")) {
    setParts.push("cancelled_by = ?");
    params.push(reqUserId || null);
  }

  if (insuranceCols.has("remarks")) {
    setParts.push(
      `remarks = CASE
         WHEN remarks IS NULL OR remarks = '' THEN 'Cancelled because linked sale was cancelled'
         ELSE CONCAT(remarks, ' | Cancelled because linked sale was cancelled')
       END`
    );
  }

  if (!setParts.length) return;

  await conn.query(
    `UPDATE insurance
     SET ${setParts.join(", ")}
     WHERE sale_id = ?`,
    [...params, saleId]
  );
}

// =====================================================
// ✅ Branch + SOLD-lock validators (NEW)
// =====================================================
async function assertValidBranch(conn, branchId, { required = false } = {}) {
  const bid = branchId != null && String(branchId).trim() !== "" ? Number(branchId) : null;

  if (!bid) {
    if (required) {
      const err = new Error("branch_id is required");
      err.statusCode = 400;
      throw err;
    }
    return null;
  }

  const [rows] = await conn.query(
    `SELECT id, is_active
     FROM showroom_branches
     WHERE id = ?
     LIMIT 1`,
    [bid]
  );

  if (!rows.length) {
    const err = new Error("Invalid branch_id");
    err.statusCode = 400;
    throw err;
  }

  if (Number(rows[0].is_active) === 0) {
    const err = new Error("Branch is inactive");
    err.statusCode = 400;
    throw err;
  }

  return bid;
}

async function assertVehicleNotSold(conn, vehicleId, saleIdToExclude) {
  const vid = vehicleId != null && String(vehicleId).trim() !== "" ? Number(vehicleId) : null;
  if (!vid) return;

  const excludeId = saleIdToExclude ? Number(saleIdToExclude) : 0;

  const [sold] = await conn.query(
    `SELECT id
     FROM sales
     WHERE contact_vehicle_id = ?
       AND is_cancelled = 0
       AND id != ?
     LIMIT 1`,
    [vid, excludeId]
  );

  if (sold.length) {
    const err = new Error("Vehicle already sold");
    err.statusCode = 409;
    throw err;
  }
}

async function buildSnapshotObject(conn, saleId) {
  const [sRows] = await conn.query(
    `SELECT s.*
     FROM sales s
     WHERE s.id = ?
     LIMIT 1`,
    [saleId]
  );
  if (!sRows.length) return null;
  const s = sRows[0];

  let contact = null;
  let primaryPhone = null;
  if (s.contact_id) {
    const [cRows] = await conn.query(
      `SELECT id, first_name, last_name, full_name, address
       FROM contacts
       WHERE id = ?
       LIMIT 1`,
      [s.contact_id]
    );
    contact = cRows?.[0] || null;

    if (contact) {
      const [pRows] = await conn.query(
        `SELECT phone
         FROM contact_phones
         WHERE contact_id = ? AND is_active = 1
         ORDER BY is_primary DESC, added_at DESC, id DESC
         LIMIT 1`,
        [contact.id]
      );
      primaryPhone = pRows?.[0]?.phone || null;
    }
  }

  let vehicle = null;
  if (s.contact_vehicle_id) {
    const [vRows] = await conn.query(
      `SELECT cv.*,
              vm.model_name,
              vv.variant_name
       FROM contact_vehicles cv
       LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
       LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
       WHERE cv.id = ?
       LIMIT 1`,
      [s.contact_vehicle_id]
    );
    vehicle = vRows?.[0] || null;
  }

  const insurance = {
    insurance_company: s.insurance_company,
    policy_number: s.insurance_number,
    cpa_number: s.cpa_insurance_number || s.cpa_number,
    insurance_broker: s.insurance_broker,
  };

  const hsrp = await getLatestHsrp(conn, saleId);
  const rc = await getLatestRc(conn, saleId);
  const branch = await getBranchName(conn, s.branch_id);

  const snap = {
    sale: {
      id: s.id,
      sale_date: toDateISO(s.sale_date),
      invoice_number: s.invoice_number,
      sale_price: s.sale_price,
      is_cancelled: Number(s.is_cancelled || 0),
      notes: s.notes || null,
    },
    branch,
    customer: {
      contact_id: s.contact_id || null,
      name: s.customer_name || contact?.full_name || null,
      mobile: s.mobile_number || primaryPhone || null,
      address: s.address || contact?.address || null,
      father_name: s.father_name || null,
      age: s.age ?? null,
      nominee_name: s.nominee_name || null,
      nominee_relation: s.nominee_relation || null,
      aadhaar_required: Number(s.aadhaar_required || 0),
      aadhaar_number: s.aadhaar_number || null,
    },
    vehicle: {
      vehicle_id: s.contact_vehicle_id || null,
      vehicle_make: s.vehicle_make || null,
      vehicle_color: vehicle?.color || null,
      model_id: vehicle?.model_id || null,
      model_name: vehicle?.model_name || null,
      variant_id: vehicle?.variant_id || null,
      variant_name: vehicle?.variant_name || null,
      vehicle_model_text: s.vehicle_model || vehicle?.model_name || null,
      chassis_number: s.chassis_number || vehicle?.chassis_number || null,
      engine_number: s.engine_number || vehicle?.engine_number || null,
      battery_no: s.battery_no || null,
      key_no: s.key_no || null,
      tyre: s.tyre || null,
      helmet: s.helmet || null,
      finance_company: s.finance_company || null,
    },
    insurance,
    hsrp: {
      hsrp_number: hsrp?.hsrp_number || null,
      hsrp_order_no: hsrp?.order_no || null,
    },
    rc: {
      rc_number: rc?.rc_number || null,
      rc_application_no: rc?.application_no || null,
    },
  };

  return snap;
}

async function upsertSaleRegisterSnapshot(conn, snap) {
  const s = snap.sale || {};
  const c = snap.customer || {};
  const v = snap.vehicle || {};
  const ins = snap.insurance || {};

  const row = {
    sale_id: Number(s.id),
    sale_date: toDateISO(s.sale_date),
    invoice_number: s.invoice_number,
    sale_price: s.sale_price,
    is_cancelled: Number(s.is_cancelled || 0),

    contact_id: c.contact_id,
    customer_name: c.name,
    mobile: c.mobile,
    address: c.address,
    father_name: c.father_name,
    age: c.age,
    nominee_name: c.nominee_name,
    nominee_relation: c.nominee_relation,

    vehicle_id: v.vehicle_id,
    vehicle_make: v.vehicle_make,
    vehicle_color: v.vehicle_color,
    model_id: v.model_id,
    model_name: v.model_name,
    variant_id: v.variant_id,
    variant_name: v.variant_name,
    vehicle_model_text: v.vehicle_model_text,
    chassis_number: v.chassis_number,
    engine_number: v.engine_number,
    battery_no: v.battery_no,
    key_no: v.key_no,
    tyre: v.tyre,
    helmet: v.helmet,

    finance_company: v.finance_company,

    insurance_company: ins.insurance_company,
    policy_number: ins.policy_number,
    cpa_number: ins.cpa_number,
    insurance_broker: ins.insurance_broker,

    aadhaar_required: c.aadhaar_required ? 1 : 0,
    aadhaar_number: c.aadhaar_number,

    hsrp_number: snap.hsrp?.hsrp_number || null,
    hsrp_order_no: snap.hsrp?.hsrp_order_no || null,

    rc_number: snap.rc?.rc_number || null,
    rc_application_no: snap.rc?.rc_application_no || null,
  };

  const cols = Object.keys(row);
  const vals = cols.map((k) => row[k]);

  await conn.query(
    `
    INSERT INTO sale_register_snapshots (${cols.join(",")})
    VALUES (${cols.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE
      ${cols
        .filter((c) => c !== "sale_id")
        .map((c) => `${c}=VALUES(${c})`)
        .join(",")}
    `,
    vals
  );
}

async function createVersionedSaleSnapshot(conn, saleId, snapshotJson, reason, createdBy) {
  const [vr] = await conn.query(
    `SELECT COALESCE(MAX(version), 0) AS v FROM sale_snapshots WHERE sale_id = ?`,
    [saleId]
  );
  const nextVer = Number(vr?.[0]?.v || 0) + 1;

  await conn.query(
    `INSERT INTO sale_snapshots (sale_id, version, snapshot_json, reason, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [saleId, nextVer, JSON.stringify(snapshotJson), reason || null, createdBy || null]
  );

  await conn.query(`UPDATE sales SET latest_snapshot_version = ? WHERE id = ?`, [nextVer, saleId]);

  return nextVer;
}

async function refreshSnapshots(conn, saleId, reason, reqUserId) {
  const snap = await buildSnapshotObject(conn, saleId);
  if (!snap) return null;

  await upsertSaleRegisterSnapshot(conn, snap);
  const ver = await createVersionedSaleSnapshot(conn, saleId, snap, reason, reqUserId);
  return { snap, ver };
}

// =====================================================
// ✅ Trace sales
// =====================================================
exports.traceSales = async (req, res) => {
  try {
    const { page, pageSize, offset } = getPageParams(req, { page: 1, pageSize: 20 });

    let chassisVal = safeText(req.query.chassis);
    let engineVal = safeText(req.query.engine);
    const vehicleId = req.query.vehicle_id ? Number(req.query.vehicle_id) : null;

    if (vehicleId && (!chassisVal || !engineVal)) {
      const [vRows] = await db.query(
        `SELECT chassis_number, engine_number
         FROM contact_vehicles
         WHERE id = ?
         LIMIT 1`,
        [vehicleId]
      );
      if (vRows.length) {
        if (!chassisVal) chassisVal = String(vRows[0].chassis_number || "").trim();
        if (!engineVal) engineVal = String(vRows[0].engine_number || "").trim();
      }
    }

    if (!chassisVal && !engineVal) {
      return res.json({ success: true, data: [], page, pageSize, total: 0 });
    }

    const where = [];
    const params = [];

    if (chassisVal) {
      where.push(`(s.chassis_number = ? OR s.chassis_number LIKE ?)`);
      params.push(chassisVal, `%${chassisVal}%`);
    }
    if (engineVal) {
      where.push(`(s.engine_number = ? OR s.engine_number LIKE ?)`);
      params.push(engineVal, `%${engineVal}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" OR ")}` : "";

    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM sales s ${whereSql}`, params);
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await db.query(
      `SELECT s.id, s.customer_name, s.mobile_number, s.chassis_number, s.engine_number,
              s.sale_date, s.invoice_number, s.is_cancelled
       FROM sales s
       ${whereSql}
       ORDER BY s.sale_date DESC, s.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json({ success: true, data: rows || [], page, pageSize, total });
  } catch (err) {
    console.error("traceSales error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// ✅ List sales
// =====================================================
exports.getAllSales = async (req, res) => {
  try {
    const { page, pageSize, offset } = getPageParams(req, { page: 1, pageSize: 50 });

    const q = String(req.query.search || req.query.q || req.query.keyword || req.query.term || "").trim();

    const branchId =
      req.query.branch_id != null && String(req.query.branch_id).trim() !== ""
        ? Number(req.query.branch_id)
        : null;

    const isCancelled =
      req.query.is_cancelled != null && String(req.query.is_cancelled).trim() !== ""
        ? Number(req.query.is_cancelled) === 1
          ? 1
          : 0
        : null;

    const where = [];
    const params = [];

    const dateFrom = String(req.query.date_from || "").trim();
    const dateTo = String(req.query.date_to || "").trim();

    if (q) {
      where.push(
        `(s.customer_name LIKE ? OR s.mobile_number LIKE ? OR s.invoice_number LIKE ? OR s.chassis_number LIKE ? OR s.engine_number LIKE ?)`
      );
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    if (branchId) {
      where.push(`s.branch_id = ?`);
      params.push(branchId);
    }

    if (isCancelled !== null) {
      where.push(`s.is_cancelled = ?`);
      params.push(isCancelled);
    }

    if (dateFrom) {
      where.push(`s.sale_date >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push(`s.sale_date <= ?`);
      params.push(dateTo);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM sales s ${whereSql}`, params);
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await db.query(
      `SELECT
         s.id,
         s.sale_date,
         s.invoice_number,
         s.sale_price,
         s.is_cancelled,
         s.customer_name,
         s.mobile_number,
         s.vehicle_model,
         s.chassis_number,
         s.engine_number,
         s.contact_id,
         s.contact_vehicle_id,
         s.branch_id,
         b.branch_name,
         s.created_at,
         s.updated_at
       FROM sales s
       LEFT JOIN showroom_branches b ON b.id = s.branch_id
       ${whereSql}
       ORDER BY s.sale_date DESC, s.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json({ success: true, data: rows || [], page, pageSize, total });
  } catch (err) {
    console.error("getAllSales error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// ✅ Create Sale
// =====================================================
exports.createSale = async (req, res) => {
  try {
    const body = req.body || {};

    const contactId = body.contact_id ? Number(body.contact_id) : null;
    const vehicleId = body.contact_vehicle_id ? Number(body.contact_vehicle_id) : null;

    if (!contactId || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Select contact + vehicle first (hard rule).",
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const branchId = await assertValidBranch(conn, body.branch_id, { required: true });
      await assertVehicleNotSold(conn, vehicleId, 0);

      const [cRows] = await conn.query(
        `SELECT id, first_name, last_name, full_name, address
         FROM contacts
         WHERE id = ?
         LIMIT 1`,
        [contactId]
      );
      if (!cRows.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Contact not found." });
      }
      const contact = cRows[0];

      const [vRows] = await conn.query(
        `SELECT cv.*,
                vm.model_name,
                vv.variant_name
         FROM contact_vehicles cv
         LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
         LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
         WHERE cv.id = ?
         LIMIT 1`,
        [vehicleId]
      );
      if (!vRows.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Vehicle not found." });
      }
      const vehicle = vRows[0];

      const [pRows] = await conn.query(
        `SELECT phone
         FROM contact_phones
         WHERE contact_id = ? AND is_active = 1
         ORDER BY is_primary DESC, added_at DESC, id DESC
         LIMIT 1`,
        [contactId]
      );
      const primaryPhone = pRows?.[0]?.phone || null;

      const fullName =
        contact.full_name ||
        [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();

      const extra = normalizeSaleExtraFields(body);

      const payload = {
        contact_id: contactId,
        contact_vehicle_id: vehicleId,
        branch_id: branchId,

        customer_name: safeText(body.customer_name) || safeText(fullName),
        mobile_number: safeText(body.mobile_number) || safeText(primaryPhone),
        address: safeText(body.address) || safeText(contact.address),

        vehicle_make: safeText(body.vehicle_make) || safeText(vehicle.make) || null,
        vehicle_model:
          safeText(body.vehicle_model) ||
          safeText(vehicle.variant_name ? `${vehicle.model_name} ${vehicle.variant_name}` : vehicle.model_name) ||
          safeText(vehicle.model_name) ||
          null,

        vehicle_no:
          safeText(body.vehicle_no) ||
          safeText(body.registration_number) ||
          safeText(body.registration_no) ||
          safeText(vehicle.vehicle_no) ||
          safeText(vehicle.registration_number) ||
          null,

        chassis_number: safeText(body.chassis_number) || safeText(vehicle.chassis_number),
        engine_number: safeText(body.engine_number) || safeText(vehicle.engine_number),

        sale_date: toDateISO(body.sale_date) || toDateISO(new Date()),
        sale_price: body.sale_price != null ? numOrZero(body.sale_price) : 0,
        invoice_number: safeText(body.invoice_number),

        rc_required: body.rc_required ? 1 : 0,
        aadhaar_required: body.aadhaar_required ? 1 : 0,

        created_by: req.user?.id || null,
        invoice_uploaded_by: req.user?.id || null,

        ...extra,

        cpa_applicable:
          body.cpa_applicable === 1 ||
          body.cpa_applicable === true ||
          String(body.cpa_applicable || "").toLowerCase() === "1" ||
          String(body.cpa_applicable || "").toLowerCase() === "true"
            ? 1
            : 0,

        documents_json: safeJsonArrayOrNull(body.documents_json),
        is_cancelled: 0,
        notes: safeText(body.notes),
      };

      const insertCols = Object.keys(payload).filter((k) => k !== "vehicle_no");
      const insertVals = insertCols.map((k) => payload[k]);
      const placeholders = insertCols.map(() => "?").join(",");

      const [ins] = await conn.query(
        `INSERT INTO sales (${insertCols.join(",")}) VALUES (${placeholders})`,
        insertVals
      );

      const saleId = ins.insertId;

      await conn.query(
        `INSERT INTO sale_vehicle_links (sale_id, vehicle_id, contact_id)
         VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE contact_id = VALUES(contact_id)`,
        [saleId, vehicleId, contactId]
      );

      await conn.query(
        `INSERT INTO vahan (sale_id, insurance_done, hsrp_done, rc_done, rc_required, aadhaar_required)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           rc_required = VALUES(rc_required),
           aadhaar_required = VALUES(aadhaar_required)`,
        [saleId, 0, 0, 0, payload.rc_required, payload.aadhaar_required]
      );

      await conn.query(
        `INSERT INTO incentives (sale_id)
         VALUES (?)
         ON DUPLICATE KEY UPDATE sale_id = sale_id`,
        [saleId]
      );

      // NEW: auto create insurance from sale data
      await upsertInsuranceFromSale(conn, saleId, payload, req.user?.id || null, {
        remarksSuffix: "Auto created from sale",
      });

      await refreshSnapshots(conn, saleId, "create", req.user?.id || null);

      await conn.commit();

      const [rows] = await conn.query(
        `SELECT s.*, b.branch_name
         FROM sales s
         LEFT JOIN showroom_branches b ON b.id = s.branch_id
         WHERE s.id = ? LIMIT 1`,
        [saleId]
      );

      return res.status(201).json({ success: true, data: rows?.[0] || { id: saleId } });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}

      if (e?.statusCode) {
        return res.status(e.statusCode).json({ success: false, message: e.message });
      }

      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("createSale error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
};

// =====================================================
// GET /api/sales/:id
// =====================================================
exports.getSaleById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

    const [rows] = await db.query(
      `SELECT s.*, b.branch_name
       FROM sales s
       LEFT JOIN showroom_branches b ON b.id = s.branch_id
       WHERE s.id = ?
       LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Not found" });

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getSaleById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// PUT /api/sales/:id
// =====================================================
exports.updateSale = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

    const body = req.body || {};
    const extra = normalizeSaleExtraFields(body);

    await conn.beginTransaction();

    const [curRows] = await conn.query(`SELECT * FROM sales WHERE id = ? LIMIT 1`, [id]);
    if (!curRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Sale not found" });
    }
    const cur = curRows[0];

    const branchId =
      body.branch_id != null
        ? await assertValidBranch(conn, body.branch_id, { required: true })
        : await assertValidBranch(conn, cur.branch_id, { required: true });

    const newContactId =
      body.contact_id != null && String(body.contact_id).trim() !== ""
        ? Number(body.contact_id)
        : cur.contact_id;

    const newVehicleId =
      body.contact_vehicle_id != null && String(body.contact_vehicle_id).trim() !== ""
        ? Number(body.contact_vehicle_id)
        : cur.contact_vehicle_id;

    const changingLink =
      (body.contact_id != null && newContactId !== cur.contact_id) ||
      (body.contact_vehicle_id != null && newVehicleId !== cur.contact_vehicle_id);

    if (changingLink) {
      if (!newContactId || !newVehicleId) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: "contact_id and contact_vehicle_id are required together",
        });
      }
    }

    if (newVehicleId && newVehicleId !== cur.contact_vehicle_id) {
      await assertVehicleNotSold(conn, newVehicleId, id);
    }

    let hydrated = null;
    if (changingLink) {
      const [cRows] = await conn.query(
        `SELECT id, first_name, last_name, full_name, address
         FROM contacts
         WHERE id = ?
         LIMIT 1`,
        [newContactId]
      );
      if (!cRows.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Contact not found." });
      }
      const contact = cRows[0];

      const [vRows] = await conn.query(
        `SELECT cv.*,
                vm.model_name,
                vv.variant_name
         FROM contact_vehicles cv
         LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
         LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
         WHERE cv.id = ?
         LIMIT 1`,
        [newVehicleId]
      );
      if (!vRows.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Vehicle not found." });
      }
      const vehicle = vRows[0];

      const [pRows] = await conn.query(
        `SELECT phone
         FROM contact_phones
         WHERE contact_id = ? AND is_active = 1
         ORDER BY is_primary DESC, added_at DESC, id DESC
         LIMIT 1`,
        [newContactId]
      );
      const primaryPhone = pRows?.[0]?.phone || null;

      const fullName =
        contact.full_name ||
        [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();

      hydrated = {
        contact_id: newContactId,
        contact_vehicle_id: newVehicleId,
        customer_name: safeText(body.customer_name) || safeText(fullName) || cur.customer_name,
        mobile_number: safeText(body.mobile_number) || safeText(primaryPhone) || cur.mobile_number,
        address: safeText(body.address) || safeText(contact.address) || cur.address,

        vehicle_make: safeText(body.vehicle_make) || safeText(vehicle.make) || cur.vehicle_make,
        vehicle_model:
          safeText(body.vehicle_model) ||
          safeText(vehicle.variant_name ? `${vehicle.model_name} ${vehicle.variant_name}` : vehicle.model_name) ||
          safeText(vehicle.model_name) ||
          cur.vehicle_model,

        vehicle_no:
          safeText(body.vehicle_no) ||
          safeText(body.registration_number) ||
          safeText(body.registration_no) ||
          safeText(vehicle.vehicle_no) ||
          safeText(vehicle.registration_number) ||
          null,

        chassis_number: safeText(body.chassis_number) || safeText(vehicle.chassis_number) || cur.chassis_number,
        engine_number: safeText(body.engine_number) || safeText(vehicle.engine_number) || cur.engine_number,
      };
    }

    const updates = {
      ...(hydrated ? { contact_id: hydrated.contact_id, contact_vehicle_id: hydrated.contact_vehicle_id } : {}),

      father_name: extra.father_name,
      age: extra.age,

      customer_name: hydrated ? hydrated.customer_name : safeText(body.customer_name),
      mobile_number: hydrated ? hydrated.mobile_number : safeText(body.mobile_number),
      address: hydrated ? hydrated.address : safeText(body.address),

      nominee_name: extra.nominee_name,
      nominee_relation: extra.nominee_relation,

      vehicle_make: hydrated ? hydrated.vehicle_make : safeText(body.vehicle_make),
      vehicle_model: hydrated ? hydrated.vehicle_model : safeText(body.vehicle_model),
      chassis_number: hydrated ? hydrated.chassis_number : safeText(body.chassis_number),
      engine_number: hydrated ? hydrated.engine_number : safeText(body.engine_number),

      sale_date: toDateISO(body.sale_date) || toDateISO(cur.sale_date),
      sale_price: body.sale_price != null ? numOrZero(body.sale_price) : cur.sale_price,
      invoice_number: safeText(body.invoice_number),

      insurance_number: extra.insurance_number,
      insurance_company: extra.insurance_company,
      insurance_broker: extra.insurance_broker,
      cpa_insurance_number: extra.cpa_insurance_number,
      cpa_applicable:
        body.cpa_applicable === 1 ||
        body.cpa_applicable === true ||
        String(body.cpa_applicable || "").toLowerCase() === "1" ||
        String(body.cpa_applicable || "").toLowerCase() === "true"
          ? 1
          : 0,

      finance_company: extra.finance_company,
      tyre: extra.tyre,
      battery_no: extra.battery_no,
      key_no: extra.key_no,

      rc_required: body.rc_required ? 1 : 0,
      aadhaar_required: body.aadhaar_required ? 1 : 0,
      aadhaar_number: extra.aadhaar_number,

      sb_tools: extra.sb_tools,
      good_life_no: extra.good_life_no,
      helmet: extra.helmet,

      notes: safeText(body.notes),

      branch_id: branchId,
    };

    const cols = Object.keys(updates).filter((k) => k !== undefined);
    const setSql = cols.map((c) => `${c} = ?`).join(", ");
    const vals = cols.map((k) => updates[k]);

    await conn.query(`UPDATE sales SET ${setSql} WHERE id = ?`, [...vals, id]);

    if (hydrated && hydrated.contact_vehicle_id && hydrated.contact_id) {
      await conn.query(
        `INSERT INTO sale_vehicle_links (sale_id, vehicle_id, contact_id)
         VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE contact_id = VALUES(contact_id)`,
        [id, hydrated.contact_vehicle_id, hydrated.contact_id]
      );
    }

    await conn.query(
      `INSERT INTO vahan (sale_id, insurance_done, hsrp_done, rc_done, rc_required, aadhaar_required)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         rc_required = VALUES(rc_required),
         aadhaar_required = VALUES(aadhaar_required)`,
      [id, 0, 0, 0, updates.rc_required, updates.aadhaar_required]
    );

    // NEW: sync insurance on sale edit
   const insurancePayload = {
  customer_name: updates.customer_name ?? cur.customer_name,
  mobile_number: updates.mobile_number ?? cur.mobile_number,
  vehicle_model: updates.vehicle_model ?? cur.vehicle_model,
  vehicle_no:
  hydrated?.vehicle_no ||
  safeText(body.vehicle_no) ||
  safeText(body.registration_number) ||
  safeText(body.registration_no) ||
  "",
  chassis_number: updates.chassis_number ?? cur.chassis_number,
  engine_number: updates.engine_number ?? cur.engine_number,
  insurance_company: updates.insurance_company,
  insurance_number: updates.insurance_number,
  cpa_insurance_number: updates.cpa_insurance_number,
  insurance_broker: updates.insurance_broker,
  cpa_applicable: updates.cpa_applicable,
  sale_date: updates.sale_date ?? toDateISO(cur.sale_date),
  invoice_number: updates.invoice_number ?? cur.invoice_number,
  premium_amount: body.premium_amount != null ? numOrZero(body.premium_amount) : 0,
};

    await upsertInsuranceFromSale(conn, id, insurancePayload, req.user?.id || null, {
      remarksSuffix: "Auto updated from sale edit",
    });

    await refreshSnapshots(conn, id, "update", req.user?.id || null);

    await conn.commit();

    const [rows] = await conn.query(
      `SELECT s.*, b.branch_name
       FROM sales s
       LEFT JOIN showroom_branches b ON b.id = s.branch_id
       WHERE s.id = ? LIMIT 1`,
      [id]
    );

    return res.json({ success: true, data: rows?.[0] || null });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    if (err?.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }

    console.error("updateSale error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  } finally {
    conn.release();
  }
};

// =====================================================
// POST /api/sales/:id/cancel
// =====================================================
exports.cancelSale = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

    await conn.beginTransaction();

    await conn.query(
      `UPDATE sales
       SET is_cancelled = 1, cancelled_at = NOW(), cancelled_by = ?
       WHERE id = ?`,
      [req.user?.id || null, id]
    );

    await cancelLinkedInsurance(conn, id, req.user?.id || null);
    await refreshSnapshots(conn, id, "cancel", req.user?.id || null);

    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error("cancelSale error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
};

// =====================================================
// DELETE /api/sales/:id (hard delete)
// =====================================================
exports.deleteSale = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

    await db.query(`DELETE FROM sales WHERE id = ?`, [id]);
    return res.json({ success: true });
  } catch (err) {
    console.error("deleteSale error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// =====================================================
// Upload Sale Documents
// =====================================================
exports.uploadSaleDocuments = [
  upload.array("files", 10),
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid sale id" });

      const files = req.files || [];
      if (!files.length) return res.status(400).json({ success: false, message: "No files" });

      await conn.beginTransaction();

      const [rows] = await conn.query(
        `SELECT documents_json
         FROM sales
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [id]
      );

      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Sale not found" });
      }

      let current = [];
      try {
        const raw = rows[0].documents_json;

        if (Array.isArray(raw)) {
          current = raw;
        } else if (raw && typeof raw === "object") {
          current = Array.isArray(raw) ? raw : [];
        } else if (typeof raw === "string") {
          const parsed = raw ? JSON.parse(raw) : [];
          current = Array.isArray(parsed) ? parsed : [];
        } else {
          current = [];
        }
      } catch {
        current = [];
      }

      const nowIso = new Date().toISOString();

      const added = files.map((f) => ({
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        filename: f.filename,
        url: `/uploads/sales/${f.filename}`,
        uploaded_at: nowIso,
        name: f.originalname,
        type: f.mimetype,
      }));

      const updated = [...current, ...added];

      await conn.query(`UPDATE sales SET documents_json = ? WHERE id = ?`, [
        JSON.stringify(updated),
        id,
      ]);

      await conn.commit();
      return res.json({ success: true, data: updated });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      console.error("uploadSaleDocuments error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  },
];

// =====================================================
// Upload OLD sales
// =====================================================
exports.uploadOldSales = [
  upload.single("file"),
  async (req, res) => {
    return res.status(501).json({
      success: false,
      message:
        "upload-old endpoint is present. If you want Excel import, paste your old working import logic here.",
    });
  },
];

// =====================================================
// ✅ Printable Dealer Format (HTML)
// =====================================================
exports.getSalePrintData = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).send("Invalid sale id");

    const conn = await db.getConnection();
    try {
      const snap = await buildSnapshotObject(conn, id);
      if (!snap) return res.status(404).send("Sale not found");

      await upsertSaleRegisterSnapshot(conn, snap);

      const s = snap.sale;
      const c = snap.customer;
      const v = snap.vehicle;
      const ins = snap.insurance;

      const esc = (x) =>
        String(x ?? "").replace(/[&<>"']/g, (m) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m]));

      const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sale Register - #${esc(id)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, sans-serif; color: #111; }
    .title { font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 6px; }
    .sub { font-size: 11px; text-align: center; color: #444; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    td, th { border: 1px solid #222; padding: 6px; vertical-align: top; }
    th { background: #f2f2f2; text-align: left; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .box { border: 1px solid #222; padding: 8px; }
    .box h3 { margin: 0 0 6px; font-size: 12px; }
    .muted { color: #555; }
    .sign { margin-top: 18px; display:flex; justify-content: space-between; gap: 24px; }
    .sign .line { border-top: 1px solid #111; padding-top: 6px; text-align:center; font-size: 11px; }
  </style>
</head>
<body>
  <div class="title">SALE REGISTER (DEALER FORMAT)</div>
  <div class="sub">
    Sale ID: <b>#${esc(id)}</b>
    &nbsp; | &nbsp; Date: <b>${esc(s.sale_date)}</b>
    &nbsp; | &nbsp; Invoice: <b>${esc(s.invoice_number || "-")}</b>
    &nbsp; | &nbsp; Branch: <b>${esc(snap.branch || "-")}</b>
  </div>

  <div class="grid">
    <div class="box">
      <h3>Customer</h3>
      <table>
        <tr><th>Name</th><td>${esc(c.name)}</td></tr>
        <tr><th>Mobile</th><td>${esc(c.mobile)}</td></tr>
        <tr><th>Address</th><td>${esc(c.address)}</td></tr>
        <tr><th>Father</th><td>${esc(c.father_name)}</td></tr>
        <tr><th>Age</th><td>${esc(c.age)}</td></tr>
        <tr><th>Nominee</th><td>${esc(c.nominee_name)} <span class="muted">(${esc(
        c.nominee_relation
      )})</span></td></tr>
        <tr><th>Aadhaar</th><td>${esc(c.aadhaar_required ? "Required" : "Not Required")} ${
        c.aadhaar_number ? " - " + esc(c.aadhaar_number) : ""
      }</td></tr>
      </table>
    </div>

    <div class="box">
      <h3>Vehicle</h3>
      <table>
        <tr><th>Model</th><td>${esc(v.vehicle_model_text || "-")}</td></tr>
        <tr><th>Make</th><td>${esc(v.vehicle_make || "-")}</td></tr>
        <tr><th>Color</th><td>${esc(v.vehicle_color || "-")}</td></tr>
        <tr><th>Chassis</th><td>${esc(v.chassis_number || "-")}</td></tr>
        <tr><th>Engine</th><td>${esc(v.engine_number || "-")}</td></tr>
        <tr><th>Battery</th><td>${esc(v.battery_no || "-")}</td></tr>
        <tr><th>Key</th><td>${esc(v.key_no || "-")}</td></tr>
        <tr><th>Tyre</th><td>${esc(v.tyre || "-")}</td></tr>
        <tr><th>Helmet</th><td>${esc(v.helmet || "-")}</td></tr>
      </table>
    </div>
  </div>

  <div class="box" style="margin-top:8px;">
    <h3>Sale + Insurance</h3>
    <table>
      <tr>
        <th>Sale Price</th><td>${esc(s.sale_price)}</td>
        <th>Finance Company</th><td>${esc(v.finance_company || "-")}</td>
      </tr>
      <tr>
        <th>Insurance Company</th><td>${esc(ins.insurance_company || "-")}</td>
        <th>Policy Number</th><td>${esc(ins.policy_number || "-")}</td>
      </tr>
      <tr>
        <th>CPA Number</th><td>${esc(ins.cpa_number || "-")}</td>
        <th>Broker</th><td>${esc(ins.insurance_broker || "-")}</td>
      </tr>
      <tr>
        <th>HSRP</th><td>${esc(snap.hsrp.hsrp_number || "-")} <span class="muted">${
        snap.hsrp.hsrp_order_no ? "(Order: " + esc(snap.hsrp.hsrp_order_no) + ")" : ""
      }</span></td>
        <th>RC</th><td>${esc(snap.rc.rc_number || "-")} <span class="muted">${
        snap.rc.rc_application_no ? "(App: " + esc(snap.rc.rc_application_no) + ")" : ""
      }</span></td>
      </tr>
      <tr>
        <th>Notes</th><td colspan="3">${esc(s.notes || "")}</td>
      </tr>
    </table>
  </div>

  <div class="sign">
    <div class="line">Customer Signature</div>
    <div class="line">Dealer / Authorized Signature</div>
  </div>
</body>
</html>
      `.trim();

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("getSalePrintData error:", e);
    return res.status(500).send("Server error");
  }
};

// =====================================================
// ✅ Export Sales CSV
// =====================================================
exports.exportSalesCSV = async (req, res) => {
  try {
    const q = String(req.query.q || req.query.search || "").trim();
    const branchId =
      req.query.branch_id != null && String(req.query.branch_id).trim() !== ""
        ? Number(req.query.branch_id)
        : null;
    const isCancelled =
      req.query.is_cancelled != null && String(req.query.is_cancelled).trim() !== ""
        ? Number(req.query.is_cancelled) === 1
          ? 1
          : 0
        : null;

    const dateFrom = String(req.query.date_from || "").trim();
    const dateTo = String(req.query.date_to || "").trim();

    const where = [];
    const params = [];

    if (q) {
      where.push(
        `(s.customer_name LIKE ? OR s.mobile_number LIKE ? OR s.invoice_number LIKE ? OR s.chassis_number LIKE ? OR s.engine_number LIKE ?)`
      );
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    if (branchId) {
      where.push(`s.branch_id = ?`);
      params.push(branchId);
    }

    if (isCancelled !== null) {
      where.push(`s.is_cancelled = ?`);
      params.push(isCancelled);
    }

    if (dateFrom) {
      where.push(`s.sale_date >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push(`s.sale_date <= ?`);
      params.push(dateTo);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT
        s.id,
        s.sale_date,
        s.invoice_number,
        s.customer_name,
        s.mobile_number,
        s.branch_id,
        b.branch_name,
        s.vehicle_make,
        s.vehicle_model,
        s.chassis_number,
        s.engine_number,
        s.sale_price,
        s.is_cancelled
       FROM sales s
       LEFT JOIN showroom_branches b ON b.id = s.branch_id
       ${whereSql}
       ORDER BY s.sale_date DESC, s.id DESC`,
      params
    );

    const filename = `sales_export_${Date.now()}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const header = [
      "id",
      "sale_date",
      "invoice_number",
      "customer_name",
      "mobile_number",
      "branch_name",
      "vehicle_make",
      "vehicle_model",
      "chassis_number",
      "engine_number",
      "sale_price",
      "is_cancelled",
    ];

    const esc = (v) => {
      const s = v == null ? "" : String(v);
      const needs = /[",\n\r]/.test(s);
      const out = s.replace(/"/g, '""');
      return needs ? `"${out}"` : out;
    };

    res.write(header.join(",") + "\n");
    for (const r of rows || []) {
      const line = [
        r.id,
        r.sale_date,
        r.invoice_number,
        r.customer_name,
        r.mobile_number,
        r.branch_name,
        r.vehicle_make,
        r.vehicle_model,
        r.chassis_number,
        r.engine_number,
        r.sale_price,
        r.is_cancelled,
      ]
        .map(esc)
        .join(",");
      res.write(line + "\n");
    }
    return res.end();
  } catch (err) {
    console.error("exportSalesCSV error:", err);
    return res.status(500).json({ success: false, message: "Export failed" });
  }
};