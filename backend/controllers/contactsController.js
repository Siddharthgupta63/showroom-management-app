// backend/controllers/contactsController.js
const db = require("../db");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });
exports._uploadMiddleware = upload.single("file");

// ---------- helpers ----------
function isTenDigitMobile(s) {
  return /^[0-9]{10}$/.test(String(s || "").trim());
}
function normalizeName(s) {
  return String(s || "").trim();
}
function safeText(s) {
  const v = String(s ?? "").trim();
  return v ? v : null;
}

async function fetchPhones(contactId) {
  const [phones] = await db.query(
    `SELECT id, phone, is_primary, is_active, added_at, deactivated_at
     FROM contact_phones
     WHERE contact_id = ?
     ORDER BY is_active DESC, is_primary DESC, added_at DESC, id DESC`,
    [contactId]
  );
  return phones;
}

async function fetchVehicles(contactId) {
  const [vehicles] = await db.query(
    `SELECT cv.*, vm.model_name, vv.variant_name
     FROM contact_vehicles cv
     LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
     LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
     WHERE cv.contact_id = ?
     ORDER BY cv.created_at DESC, cv.id DESC`,
    [contactId]
  );
  return vehicles;
}

function pickPrimaryPhone(phones) {
  const active = phones.filter((p) => Number(p.is_active) === 1);
  const primary =
    active.find((p) => Number(p.is_primary) === 1)?.phone ||
    active[0]?.phone ||
    null;
  return primary;
}

async function fetchContactById(id) {
  const [rows] = await db.query(
    `SELECT id, first_name, last_name, full_name, notes, state, district, tehsil, address, created_at, updated_at
     FROM contacts
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;

  const contact = rows[0];
  const phones = await fetchPhones(id);
  const vehicles = await fetchVehicles(id);

  return {
    ...contact,
    primary_phone: pickPrimaryPhone(phones),
    phones,
    vehicles,
  };
}

// IMPORTANT: This avoids MySQL trigger 1442 by doing:
// 1) Insert phones with is_primary=0
// 2) Then do UPDATEs to enforce exactly one primary
async function enforceSinglePrimary(conn, contactId, makePrimaryPhoneId) {
  // Clear all primaries among active phones
  await conn.query(
    `UPDATE contact_phones
     SET is_primary = 0
     WHERE contact_id = ? AND is_active = 1`,
    [contactId]
  );

  // Set chosen as primary
  await conn.query(
    `UPDATE contact_phones
     SET is_primary = 1, is_active = 1
     WHERE id = ? AND contact_id = ?`,
    [makePrimaryPhoneId, contactId]
  );
}

async function ensureSomePrimary(conn, contactId) {
  const [prim] = await conn.query(
    `SELECT id FROM contact_phones
     WHERE contact_id=? AND is_active=1 AND is_primary=1
     LIMIT 1`,
    [contactId]
  );

  if (prim.length) return;

  const [latest] = await conn.query(
    `SELECT id FROM contact_phones
     WHERE contact_id=? AND is_active=1
     ORDER BY added_at DESC, id DESC
     LIMIT 1`,
    [contactId]
  );

  if (latest.length) {
    await enforceSinglePrimary(conn, contactId, latest[0].id);
  }
}

// ---------- list/search ----------
// ---------- list/search (with pagination) ----------
exports.listSearch = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    // pagination
    let page = parseInt(String(req.query.page || "1"), 10);
    let pageSize = parseInt(String(req.query.pageSize || "20"), 10);

    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(pageSize) || pageSize < 10) pageSize = 10;
    if (pageSize > 200) pageSize = 200;

    const offset = (page - 1) * pageSize;

    // WHERE clause (keep same search behavior)
    let whereSql = `WHERE 1=1`;
    const whereParams = [];

    if (q) {
      const like = `%${q}%`;
      whereSql += `
        AND (
          c.full_name LIKE ?
          OR c.first_name LIKE ?
          OR c.last_name LIKE ?
          OR EXISTS (
            SELECT 1 FROM contact_phones p
            WHERE p.contact_id=c.id AND p.is_active=1 AND p.phone LIKE ?
          )
          OR EXISTS (
            SELECT 1 FROM contact_vehicles v
            WHERE v.contact_id=c.id AND v.chassis_number LIKE ?
          )
          OR EXISTS (
            SELECT 1 FROM contact_vehicles v
            WHERE v.contact_id=c.id AND v.engine_number LIKE ?
          )
        )
      `;
      whereParams.push(like, like, like, like, like, like);
    }

    // 1) total count
    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM contacts c
      ${whereSql}
      `,
      whereParams
    );
    const total = Number(countRows?.[0]?.total || 0);

    // 2) paginated rows
    const [rows] = await db.query(
      `
      SELECT
        c.id, c.first_name, c.last_name, c.full_name, c.updated_at,
        (
          SELECT cp.phone
          FROM contact_phones cp
          WHERE cp.contact_id = c.id AND cp.is_active = 1
          ORDER BY cp.is_primary DESC, cp.added_at DESC, cp.id DESC
          LIMIT 1
        ) AS primary_phone,
        (SELECT COUNT(*) FROM contact_vehicles cv WHERE cv.contact_id = c.id) AS vehicles_count
      FROM contacts c
      ${whereSql}
      ORDER BY c.updated_at DESC, c.id DESC
      LIMIT ? OFFSET ?
      `,
      [...whereParams, pageSize, offset]
    );

    return res.json({
      success: true,
      data: rows,
      total,
      page,
      pageSize,
    });
  } catch (e) {
    console.error("contacts listSearch:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// ---------- create ----------
exports.createContact = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const {
      first_name,
      last_name,
      notes,
      state,
      district,
      tehsil,
      address,
      phones = [],
      vehicles = [],
    } = req.body || {};

    const fn = normalizeName(first_name);
    const ln = normalizeName(last_name);

    if (!fn) return res.status(400).json({ success: false, message: "First name is required" });
    if (!ln) return res.status(400).json({ success: false, message: "Last name is required" });

    const phoneList = Array.isArray(phones) ? phones : [];
    const cleanedPhones = phoneList
      .map((p) => ({
        phone: String(p?.phone ?? "").trim(),
        is_primary: Number(p?.is_primary) === 1 ? 1 : 0,
      }))
      .filter((p) => isTenDigitMobile(p.phone));

    if (cleanedPhones.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one 10-digit mobile number is required",
      });
    }

    // ensure one "desired primary"
    if (!cleanedPhones.some((p) => p.is_primary === 1)) cleanedPhones[0].is_primary = 1;

    await conn.beginTransaction();

    const [ins] = await conn.query(
      `INSERT INTO contacts (first_name, last_name, notes, state, district, tehsil, address)
       VALUES (?,?,?,?,?,?,?)`,
      [fn, ln, safeText(notes), safeText(state), safeText(district), safeText(tehsil), safeText(address)]
    );

    const contactId = ins.insertId;

    // Insert phones SAFELY with is_primary=0 (avoid trigger 1442)
    const inserted = [];
    for (const p of cleanedPhones) {
      const [r] = await conn.query(
        `INSERT INTO contact_phones (contact_id, phone, is_primary, is_active)
         VALUES (?,?,0,1)`,
        [contactId, p.phone]
      );
      inserted.push({ id: r.insertId, wantPrimary: p.is_primary === 1 });
    }

    // Enforce exactly one primary by UPDATEs
    const primaryId = inserted.find((x) => x.wantPrimary)?.id || inserted[0]?.id;
    if (primaryId) {
      await enforceSinglePrimary(conn, contactId, primaryId);
    }

    // vehicles
    const vList = Array.isArray(vehicles) ? vehicles : [];
    for (const v of vList) {
      const chassis = String(v?.chassis_number || "").trim();
      const engine = String(v?.engine_number || "").trim();
      if (!chassis || !engine) continue;

      await conn.query(
        `INSERT INTO contact_vehicles (contact_id, chassis_number, engine_number, model_id, variant_id)
         VALUES (?,?,?,?,?)`,
        [contactId, chassis, engine, v.model_id || null, v.variant_id || null]
      );
    }

    await conn.commit();

    const data = await fetchContactById(contactId);
    return res.status(201).json({ success: true, data });
  } catch (e) {
    try { await conn.rollback(); } catch {}

    console.error("createContact:", e);
    if (String(e?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Duplicate found (mobile/chassis/engine). Please check and try again.",
      });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
};

// ---------- get ----------
exports.getContact = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid contact id" });

    const data = await fetchContactById(id);
    if (!data) return res.status(404).json({ success: false, message: "Contact not found" });

    return res.json({ success: true, data });
  } catch (e) {
    console.error("getContact:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- update ----------
exports.updateContact = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid contact id" });

    const { first_name, last_name, notes, state, district, tehsil, address } = req.body || {};
    const fn = normalizeName(first_name);
    const ln = normalizeName(last_name);

    if (!fn) return res.status(400).json({ success: false, message: "First name is required" });
    if (!ln) return res.status(400).json({ success: false, message: "Last name is required" });

    const [r] = await db.query(
      `UPDATE contacts
       SET first_name=?, last_name=?, notes=?, state=?, district=?, tehsil=?, address=?
       WHERE id=?`,
      [fn, ln, safeText(notes), safeText(state), safeText(district), safeText(tehsil), safeText(address), id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    const data = await fetchContactById(id);
    return res.json({ success: true, data });
  } catch (e) {
    console.error("updateContact:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- add phone ----------
exports.addPhone = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const contactId = Number(req.params.id);
    if (!contactId) return res.status(400).json({ success: false, message: "Invalid contact id" });

    const p = String(req.body?.phone || "").trim();
    const makePrimary = Number(req.body?.is_primary) === 1 ? 1 : 0;

    if (!isTenDigitMobile(p)) {
      return res.status(400).json({ success: false, message: "Mobile must be 10 digits" });
    }

    await conn.beginTransaction();

    // insert with is_primary=0 always (avoid trigger 1442)
    const [ins] = await conn.query(
      `INSERT INTO contact_phones (contact_id, phone, is_primary, is_active)
       VALUES (?,?,0,1)`,
      [contactId, p]
    );

    const newPhoneId = ins.insertId;

    // make it primary if requested OR if no primary exists
    if (makePrimary) {
      await enforceSinglePrimary(conn, contactId, newPhoneId);
    } else {
      await ensureSomePrimary(conn, contactId);
    }

    await conn.commit();

    const data = await fetchContactById(contactId);
    return res.status(201).json({ success: true, data });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("addPhone:", e);
    if (String(e?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This mobile number is already active for another contact.",
      });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
};

// ---------- set primary ----------
exports.setPrimaryPhone = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const contactId = Number(req.params.id);
    const phoneId = Number(req.params.phoneId);
    if (!contactId || !phoneId) return res.status(400).json({ success: false, message: "Invalid id" });

    await conn.beginTransaction();
    await enforceSinglePrimary(conn, contactId, phoneId);
    await conn.commit();

    const data = await fetchContactById(contactId);
    return res.json({ success: true, data });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("setPrimaryPhone:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
};

// ---------- deactivate ----------
exports.deactivatePhone = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const contactId = Number(req.params.id);
    const phoneId = Number(req.params.phoneId);
    if (!contactId || !phoneId) return res.status(400).json({ success: false, message: "Invalid id" });

    await conn.beginTransaction();

    await conn.query(
      `UPDATE contact_phones
       SET is_active=0, deactivated_at=NOW(), is_primary=0
       WHERE id=? AND contact_id=?`,
      [phoneId, contactId]
    );

    // ensure we still have a primary among remaining active phones
    await ensureSomePrimary(conn, contactId);

    await conn.commit();

    const data = await fetchContactById(contactId);
    return res.json({ success: true, data });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("deactivatePhone:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
};

// ---------- add vehicle ----------
exports.addVehicle = async (req, res) => {
  try {
    const contactId = Number(req.params.id);
    if (!contactId) return res.status(400).json({ success: false, message: "Invalid contact id" });

    const { chassis_number, engine_number, model_id, variant_id } = req.body || {};
    const chassis = String(chassis_number || "").trim();
    const engine = String(engine_number || "").trim();

    if (!chassis) return res.status(400).json({ success: false, message: "Chassis number is required" });
    if (!engine) return res.status(400).json({ success: false, message: "Engine number is required" });

    await db.query(
      `INSERT INTO contact_vehicles (contact_id, chassis_number, engine_number, model_id, variant_id)
       VALUES (?,?,?,?,?)`,
      [contactId, chassis, engine, model_id || null, variant_id || null]
    );

    const data = await fetchContactById(contactId);
    return res.status(201).json({ success: true, data });
  } catch (e) {
    console.error("addVehicle:", e);
    if (String(e?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Duplicate chassis/engine found. This vehicle is already assigned to another contact.",
      });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- Excel helpers (LAZY LOAD) ----------
function loadExcelJSOrThrow() {
  try {
    // lazy require so backend DOES NOT crash on start
    return require("exceljs");
  } catch (e) {
    const msg =
      "Excel import feature is not ready because dependency is missing.\n" +
      "Fix it like this:\n" +
      "  cd backend\n" +
      "  npm i lodash.union\n" +
      "  (optional) rm -rf node_modules package-lock.json && npm i\n" +
      "Then restart backend.\n\n" +
      "Original error: " + (e?.message || "unknown");
    const err = new Error(msg);
    err._isExcelMissing = true;
    throw err;
  }
}

// ---------- import template ----------
exports.downloadImportTemplate = async (req, res) => {
  try {
    const ExcelJS = loadExcelJSOrThrow();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Contacts");

    ws.columns = [
      { header: "first_name*", key: "first_name", width: 18 },
      { header: "last_name*", key: "last_name", width: 18 },
      { header: "primary_mobile*", key: "primary_mobile", width: 16 },
      { header: "other_mobiles (comma separated)", key: "other_mobiles", width: 28 },
      { header: "state", key: "state", width: 16 },
      { header: "district", key: "district", width: 16 },
      { header: "tehsil", key: "tehsil", width: 16 },
      { header: "address", key: "address", width: 30 },
      { header: "model_name", key: "model_name", width: 20 },
      { header: "variant_name", key: "variant_name", width: 20 },
      { header: "chassis_number", key: "chassis_number", width: 18 },
      { header: "engine_number", key: "engine_number", width: 18 },
    ];

    ws.addRow({
      first_name: "Siddharth",
      last_name: "Gupta",
      primary_mobile: "9999990000",
      other_mobiles: "8888880000,7777770000",
      state: "Madhya Pradesh",
      district: "Umaria",
      tehsil: "Bandhavgarh",
      address: "Near Main Road, Umaria",
      model_name: "Splendor Plus",
      variant_name: "i3S",
      chassis_number: "CH123456789",
      engine_number: "EN987654321",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="contacts_import_template.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("downloadImportTemplate:", e);
    if (e?._isExcelMissing) return res.status(500).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- import ----------
exports.importContactsExcel = [
  (req, res, next) => exports._uploadMiddleware(req, res, next),
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      const ExcelJS = loadExcelJSOrThrow();

      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: "File is required" });
      }

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

      let created = 0;
      let updated = 0;
      let vehiclesAdded = 0;
      const errors = [];

      const header = {};
      ws.getRow(1).eachCell((cell, colNumber) => {
        header[String(cell.value || "").trim().toLowerCase()] = colNumber;
      });

      const get = (row, key) => {
        const col = header[key];
        if (!col) return "";
        return String(row.getCell(col).value || "").trim();
      };

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const first_name = get(row, "first_name*") || get(row, "first_name");
        const last_name = get(row, "last_name*") || get(row, "last_name");
        const primary_mobile = get(row, "primary_mobile*") || get(row, "primary_mobile");

        if (!first_name || !last_name || !primary_mobile) continue;

        if (!isTenDigitMobile(primary_mobile)) {
          errors.push(`Row ${r}: primary_mobile must be 10 digits`);
          continue;
        }

        const other_mobiles =
          get(row, "other_mobiles (comma separated)") || get(row, "other_mobiles");
        const state = get(row, "state");
        const district = get(row, "district");
        const tehsil = get(row, "tehsil");
        const address = get(row, "address");
        const model_name = get(row, "model_name");
        const variant_name = get(row, "variant_name");
        const chassis_number = get(row, "chassis_number");
        const engine_number = get(row, "engine_number");

        const [existingPhone] = await db.query(
          `SELECT contact_id FROM contact_phones WHERE phone=? AND is_active=1 LIMIT 1`,
          [primary_mobile]
        );

        let contactId;

        await conn.beginTransaction();

        if (existingPhone.length) {
          contactId = existingPhone[0].contact_id;
          updated++;

          await conn.query(
            `UPDATE contacts SET first_name=?, last_name=?, state=?, district=?, tehsil=?, address=? WHERE id=?`,
            [first_name, last_name, safeText(state), safeText(district), safeText(tehsil), safeText(address), contactId]
          );
        } else {
          const [ins] = await conn.query(
            `INSERT INTO contacts (first_name,last_name,state,district,tehsil,address) VALUES (?,?,?,?,?,?)`,
            [first_name, last_name, safeText(state), safeText(district), safeText(tehsil), safeText(address)]
          );
          contactId = ins.insertId;
          created++;

          // Insert primary phone safely then enforce as primary
          const [pIns] = await conn.query(
            `INSERT INTO contact_phones (contact_id, phone, is_primary, is_active) VALUES (?,?,0,1)`,
            [contactId, primary_mobile]
          );
          await enforceSinglePrimary(conn, contactId, pIns.insertId);
        }

        if (other_mobiles) {
          const list = other_mobiles
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

          for (const p of list) {
            if (!isTenDigitMobile(p)) continue;
            try {
              await conn.query(
                `INSERT INTO contact_phones (contact_id, phone, is_primary, is_active) VALUES (?,?,0,1)`,
                [contactId, p]
              );
            } catch {
              // ignore duplicates
            }
          }
        }

        if (chassis_number && engine_number) {
          let model_id = null;
          let variant_id = null;

          if (model_name) model_id = modelMap.get(String(model_name).toLowerCase()) || null;
          if (model_id && variant_name) {
            variant_id =
              variantMap.get(`${model_id}::${String(variant_name).toLowerCase()}`) || null;
          }

          try {
            await conn.query(
              `INSERT INTO contact_vehicles (contact_id, chassis_number, engine_number, model_id, variant_id)
               VALUES (?,?,?,?,?)`,
              [contactId, chassis_number, engine_number, model_id, variant_id]
            );
            vehiclesAdded++;
          } catch (e) {
            if (String(e?.code) === "ER_DUP_ENTRY") {
              errors.push(`Row ${r}: duplicate chassis/engine (${chassis_number}/${engine_number})`);
            }
          }
        }

        // Ensure there is a primary among active phones
        await ensureSomePrimary(conn, contactId);

        await conn.commit();
      }

      return res.json({
        success: true,
        message: "Import completed",
        summary: { created, updated, vehiclesAdded, errorsCount: errors.length },
        errors: errors.slice(0, 50),
      });
    } catch (e) {
      try { await conn.rollback(); } catch {}
      console.error("importContactsExcel:", e);
      if (e?._isExcelMissing) return res.status(500).json({ success: false, message: e.message });
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  },
];

exports.deactivateVehicle = async (req, res) => {
  try {
    const contactId = Number(req.params.id);
    const vehicleId = Number(req.params.vehicleId);

    if (!contactId) return res.status(400).json({ success: false, message: "Invalid contact id" });
    if (!vehicleId) return res.status(400).json({ success: false, message: "Invalid vehicle id" });

    // Try soft-delete first (if columns exist)
    try {
      const [r] = await db.query(
        `UPDATE contact_vehicles
         SET is_active = 0, deactivated_at = NOW()
         WHERE id = ? AND contact_id = ?`,
        [vehicleId, contactId]
      );

      if (r.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Vehicle not found" });
      }
    } catch (e) {
      // If table doesn't have is_active/deactivated_at, fallback hard delete
      if (String(e?.code) === "ER_BAD_FIELD_ERROR") {
        const [r2] = await db.query(
          `DELETE FROM contact_vehicles WHERE id = ? AND contact_id = ?`,
          [vehicleId, contactId]
        );
        if (r2.affectedRows === 0) {
          return res.status(404).json({ success: false, message: "Vehicle not found" });
        }
      } else {
        throw e;
      }
    }

    const data = await fetchContactById(contactId);
    return res.json({ success: true, data });
  } catch (e) {
    console.error("deactivateVehicle:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------- lightweight search for Sale creation ----------
// GET /api/contacts/search?q=
// Searches across:
//  - contact name
//  - active phones
//  - chassis/engine (contact_vehicles)
// Returns flattened rows so frontend can let user select the *exact vehicle*.
exports.searchForSale = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ success: true, data: [] });

    const like = `%${q}%`;

    // We return one row per vehicle (if vehicle exists).
    // If a contact has no vehicles, it can still appear (vehicle fields null).
    const [rows] = await db.query(
      `
      SELECT
        c.id AS contact_id,
        c.first_name,
        c.last_name,
        c.full_name,
        c.address,
        c.state,
        c.district,
        c.tehsil,
        (
          SELECT cp.phone
          FROM contact_phones cp
          WHERE cp.contact_id = c.id AND cp.is_active = 1
          ORDER BY cp.is_primary DESC, cp.added_at DESC, cp.id DESC
          LIMIT 1
        ) AS primary_phone,

        cv.id AS vehicle_id,
        cv.chassis_number,
        cv.engine_number,
        cv.model_id,
        cv.variant_id,
        vm.model_name,
        vv.variant_name

      FROM contacts c
      LEFT JOIN contact_vehicles cv ON cv.contact_id = c.id
      LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id

      WHERE (
        c.full_name LIKE ?
        OR c.first_name LIKE ?
        OR c.last_name LIKE ?
        OR EXISTS (
          SELECT 1
          FROM contact_phones p
          WHERE p.contact_id = c.id AND p.is_active = 1 AND p.phone LIKE ?
        )
        OR (cv.chassis_number IS NOT NULL AND cv.chassis_number LIKE ?)
        OR (cv.engine_number IS NOT NULL AND cv.engine_number LIKE ?)
      )

      ORDER BY c.updated_at DESC, c.id DESC, cv.id DESC
      LIMIT 200
      `,
      [like, like, like, like, like, like]
    );

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error("contacts searchForSale:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.addVehicleToContact = async (req, res) => {
  try {
    const contactId = Number(req.params.id);
    if (!contactId) {
      return res.status(400).json({ success: false, message: "Invalid contact id" });
    }

    const { chassis_number, engine_number, model_id, variant_id } = req.body || {};

    const chassis = String(chassis_number || "").trim();
    const engine = String(engine_number || "").trim();
    const modelId = Number(model_id) || null;
    const variantId = Number(variant_id) || null;

    if (!chassis || !engine) {
      return res.status(400).json({
        success: false,
        message: "Chassis number and Engine number are required",
      });
    }

    // Verify contact exists
    const [c] = await db.query(`SELECT id FROM contacts WHERE id = ? LIMIT 1`, [contactId]);
    if (!c.length) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    // Insert vehicle
    const [ins] = await db.query(
      `INSERT INTO contact_vehicles (contact_id, model_id, variant_id, chassis_number, engine_number)
       VALUES (?,?,?,?,?)`,
      [contactId, modelId, variantId, chassis, engine]
    );

    const vehicleId = ins.insertId;

    const [rows] = await db.query(
      `SELECT cv.id as vehicle_id, cv.chassis_number, cv.engine_number,
              vm.model_name, vv.variant_name
       FROM contact_vehicles cv
       LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
       LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
       WHERE cv.id = ? LIMIT 1`,
      [vehicleId]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    // Handle duplicate chassis/engine
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This chassis or engine number already exists in another contact.",
      });
    }
    console.error("addVehicleToContact error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// --------------------------
// GET /api/contacts/_export?q=
// --------------------------
exports.exportContactsExcel = async (req, res) => {
  try {
    const ExcelJS = loadExcelJSOrThrow();

    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;

    let sql = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.full_name,
        c.state,
        c.district,
        c.tehsil,
        c.address,
        (
          SELECT cp.phone
          FROM contact_phones cp
          WHERE cp.contact_id = c.id AND cp.is_active = 1
          ORDER BY cp.is_primary DESC, cp.added_at DESC, cp.id DESC
          LIMIT 1
        ) AS primary_phone,
        (
          SELECT GROUP_CONCAT(cp2.phone ORDER BY cp2.is_primary DESC, cp2.added_at DESC SEPARATOR ',')
          FROM contact_phones cp2
          WHERE cp2.contact_id = c.id AND cp2.is_active = 1
        ) AS all_phones,
        (
          SELECT COUNT(*)
          FROM contact_vehicles cv
          WHERE cv.contact_id = c.id
        ) AS vehicles_count,
        c.created_at,
        c.updated_at
      FROM contacts c
      WHERE 1=1
    `;

    const params = [];
    if (q) {
      sql += `
        AND (
          c.full_name LIKE ?
          OR c.first_name LIKE ?
          OR c.last_name LIKE ?
          OR EXISTS (
            SELECT 1 FROM contact_phones p
            WHERE p.contact_id=c.id AND p.is_active=1 AND p.phone LIKE ?
          )
          OR EXISTS (
            SELECT 1 FROM contact_vehicles v
            WHERE v.contact_id=c.id AND v.chassis_number LIKE ?
          )
          OR EXISTS (
            SELECT 1 FROM contact_vehicles v
            WHERE v.contact_id=c.id AND v.engine_number LIKE ?
          )
        )
      `;
      params.push(like, like, like, like, like, like);
    }

    sql += ` ORDER BY c.updated_at DESC, c.id DESC LIMIT 5000`;

    const [rows] = await db.query(sql, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Contacts");

    ws.columns = [
      { header: "id", key: "id", width: 8 },
      { header: "first_name", key: "first_name", width: 16 },
      { header: "last_name", key: "last_name", width: 16 },
      { header: "full_name", key: "full_name", width: 22 },
      { header: "primary_phone", key: "primary_phone", width: 16 },
      { header: "all_phones", key: "all_phones", width: 26 },
      { header: "state", key: "state", width: 18 },
      { header: "district", key: "district", width: 18 },
      { header: "tehsil", key: "tehsil", width: 18 },
      { header: "address", key: "address", width: 30 },
      { header: "vehicles_count", key: "vehicles_count", width: 14 },
      { header: "created_at", key: "created_at", width: 22 },
      { header: "updated_at", key: "updated_at", width: 22 },
    ];

    rows.forEach((r) => ws.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="contacts_export.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("contacts export:", e);
    if (e?._isExcelMissing) return res.status(500).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
