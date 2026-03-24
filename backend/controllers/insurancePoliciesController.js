const db = require("../db");
const ExcelJS = require("exceljs");

function normalizePhone(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 10);
}

function isValidPhone10(v) {
  return /^\d{10}$/.test(String(v || ""));
}

function boolFromAny(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function normalizePolicyStatus(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "expired" ? "expired" : "running";
}

function publicUploadPath(file) {
  if (!file || !file.filename) return null;
  return `/uploads/inspection/${file.filename}`;
}

function firstUploadedFile(req) {
  if (req?.files?.uploaded_file?.[0]) return req.files.uploaded_file[0];
  if (req?.files?.inspection_photo?.[0]) return req.files.inspection_photo[0];
  if (req?.file) return req.file;
  return null;
}

function calcExpiryDate(startDate) {
  const sd = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(sd.getTime())) return null;
  const expiry = new Date(sd);
  expiry.setFullYear(expiry.getFullYear() + 1);
  expiry.setDate(expiry.getDate() - 1);
  const y = expiry.getFullYear();
  const m = String(expiry.getMonth() + 1).padStart(2, "0");
  const d = String(expiry.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function getDropdownRows(type) {
  const [rows] = await db.query(
    `SELECT id, value, label
     FROM dropdown_master
     WHERE type = ? AND is_active = 1
     ORDER BY id ASC`,
    [type]
  );
  return rows || [];
}

async function getContactSnapshot(contactId) {
  const [[contact]] = await db.query(
    `
    SELECT id, first_name, last_name, full_name, address, state, district, tehsil
    FROM contacts
    WHERE id = ?
    LIMIT 1
    `,
    [contactId]
  );

  if (!contact) return null;

  const [[phoneRow]] = await db.query(
    `
    SELECT phone
    FROM contact_phones
    WHERE contact_id = ? AND is_active = 1
    ORDER BY is_primary DESC, added_at DESC, id DESC
    LIMIT 1
    `,
    [contactId]
  );

  const customerName =
    String(contact.full_name || "").trim() ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();

  return {
    contact,
    customer_name: customerName || null,
    phone: phoneRow?.phone || null,
  };
}

async function getVehicleSnapshot(contactVehicleId) {
  const [[vehicle]] = await db.query(
    `
    SELECT
      cv.id,
      cv.contact_id,
      cv.chassis_number,
      cv.engine_number,
      cv.rto_number,
      cv.model_id,
      cv.variant_id,
      vm.model_name,
      vv.variant_name
    FROM contact_vehicles cv
    LEFT JOIN vehicle_models vm ON vm.id = cv.model_id
    LEFT JOIN vehicle_variants vv ON vv.id = cv.variant_id
    WHERE cv.id = ?
    LIMIT 1
    `,
    [contactVehicleId]
  );

  return vehicle || null;
}

exports.getFormMeta = async (_req, res) => {
  try {
    const [insurance_company, cpa_included, policy_status] = await Promise.all([
      getDropdownRows("insurance_company"),
      getDropdownRows("cpa_included"),
      getDropdownRows("policy_status"),
    ]);

    return res.json({
      success: true,
      data: {
        insurance_company,
        cpa_included,
        policy_status,
      },
    });
  } catch (err) {
    console.error("getFormMeta error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllPolicies = async (_req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        p.id,
        p.contact_id,
        p.contact_vehicle_id,
        p.policy_no,
        p.customer_name,
        p.vehicle_no,
        p.model_name,
        p.variant_name,
        p.company,
        p.phone,
        p.cpa_included,
        p.policy_status,
        p.inspection_required,
        p.inspection_photo,
        p.uploaded_file,
        p.start_date,
        p.expiry_date,
        p.premium,
        p.survey_charge,
        p.invoice_number,
        p.notes,
        p.followup1_date,
        p.followup1_remark,
        p.followup2_date,
        p.followup2_remark,
        p.followup3_date,
        p.followup3_remark,
        cv.chassis_number,
        cv.engine_number
      FROM insurance_policies p
      LEFT JOIN contact_vehicles cv ON cv.id = p.contact_vehicle_id
      ORDER BY p.expiry_date ASC, p.id DESC
      `
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getAllPolicies error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createPolicy = async (req, res) => {
  try {
    const {
      contact_id,
      contact_vehicle_id,
      vehicle_no,
      policy_no,
      company,
      start_date,
      premium,
      survey_charge,
      cpa_included,
      policy_status,
      invoice_number,
      notes,
    } = req.body || {};

    const contactId = Number(contact_id || 0);
    const contactVehicleId = Number(contact_vehicle_id || 0);

    if (!contactId) {
      return res.status(400).json({ success: false, message: "contact_id is required" });
    }
    if (!contactVehicleId) {
      return res.status(400).json({ success: false, message: "contact_vehicle_id is required" });
    }
    if (!start_date) {
      return res.status(400).json({ success: false, message: "start_date is required" });
    }

    const contactSnap = await getContactSnapshot(contactId);
    if (!contactSnap) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    const vehicleSnap = await getVehicleSnapshot(contactVehicleId);
    if (!vehicleSnap) {
      return res.status(404).json({ success: false, message: "Vehicle not found" });
    }

    if (Number(vehicleSnap.contact_id) !== contactId) {
      return res.status(400).json({
        success: false,
        message: "Selected vehicle does not belong to selected contact",
      });
    }

    const phoneClean = normalizePhone(contactSnap.phone || "");
    if (!isValidPhone10(phoneClean)) {
      return res.status(400).json({
        success: false,
        message: "Selected contact must have one valid primary 10-digit phone",
      });
    }

    const autoVehicleNo =
      String(vehicle_no || "").trim() ||
      String(vehicleSnap.rto_number || "").trim();

    if (!autoVehicleNo) {
      return res.status(400).json({
        success: false,
        message: "Selected vehicle does not have RTO number / vehicle number",
      });
    }

    const status = normalizePolicyStatus(policy_status);
    const inspectionRequired = status === "expired" ? 1 : 0;
    const uploaded = publicUploadPath(firstUploadedFile(req));
    const expiryDate = calcExpiryDate(start_date);

    if (!expiryDate) {
      return res.status(400).json({ success: false, message: "Invalid start_date" });
    }

    if (status === "expired" && !uploaded) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file is required when policy status is expired",
      });
    }

    await db.query(
      `
      INSERT INTO insurance_policies
      (
        contact_id,
        contact_vehicle_id,
        policy_no,
        customer_name,
        vehicle_no,
        model_name,
        variant_name,
        company,
        phone,
        cpa_included,
        policy_status,
        inspection_required,
        inspection_photo,
        uploaded_file,
        start_date,
        expiry_date,
        premium,
        survey_charge,
        invoice_number,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        contactId,
        contactVehicleId,
        String(policy_no || "").trim() || null,
        contactSnap.customer_name,
        autoVehicleNo,
        vehicleSnap.model_name || null,
        vehicleSnap.variant_name || null,
        String(company || "").trim() || null,
        phoneClean,
        boolFromAny(cpa_included) ? 1 : 0,
        status,
        inspectionRequired,
        uploaded,
        uploaded,
        start_date,
        expiryDate,
        premium === "" || premium == null ? null : Number(premium),
        survey_charge === "" || survey_charge == null ? null : Number(survey_charge),
        String(invoice_number || "").trim() || null,
        String(notes || "").trim() || null,
      ]
    );

    return res.json({ success: true, message: "Insurance policy added" });
  } catch (err) {
    console.error("createPolicy error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePolicyBasic = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, expiry_date, premium, phone } = req.body || {};

    const phoneClean = normalizePhone(phone);
    if (!start_date) {
      return res.status(400).json({ success: false, message: "start_date is required" });
    }
    if (!isValidPhone10(phoneClean)) {
      return res.status(400).json({ success: false, message: "phone must be 10 digits" });
    }

    await db.query(
      `
      UPDATE insurance_policies
      SET
        phone = ?,
        start_date = ?,
        expiry_date = ?,
        premium = ?
      WHERE id = ?
      `,
      [
        phoneClean,
        start_date,
        expiry_date || calcExpiryDate(start_date),
        premium === "" || premium == null ? null : Number(premium),
        id,
      ]
    );

    return res.json({ success: true, message: "Policy updated" });
  } catch (err) {
    console.error("updatePolicyBasic error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkImportPolicies = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const contactId = Number(row.contact_id || 0);
        const contactVehicleId = Number(row.contact_vehicle_id || 0);
        const vehicleNo = String(row.vehicle_no || "").trim();
        const startDate = String(row.start_date || "").trim();
        if (!contactId || !contactVehicleId || !vehicleNo || !startDate) {
          skipped++;
          continue;
        }

        const contactSnap = await getContactSnapshot(contactId);
        const vehicleSnap = await getVehicleSnapshot(contactVehicleId);
        if (!contactSnap || !vehicleSnap || Number(vehicleSnap.contact_id) !== contactId) {
          skipped++;
          continue;
        }

        const phoneClean = normalizePhone(contactSnap.phone || "");
        if (!isValidPhone10(phoneClean)) {
          skipped++;
          continue;
        }

        const status = normalizePolicyStatus(row.policy_status);
        const expiryDate = calcExpiryDate(startDate);

        await db.query(
          `
          INSERT INTO insurance_policies
          (
            contact_id,
            contact_vehicle_id,
            policy_no,
            customer_name,
            vehicle_no,
            model_name,
            variant_name,
            company,
            phone,
            cpa_included,
            policy_status,
            inspection_required,
            start_date,
            expiry_date,
            premium,
            survey_charge,
            invoice_number,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            contactId,
            contactVehicleId,
            String(row.policy_no || "").trim() || null,
            contactSnap.customer_name,
            vehicleNo,
            vehicleSnap.model_name || null,
            vehicleSnap.variant_name || null,
            String(row.company || "").trim() || null,
            phoneClean,
            boolFromAny(row.cpa_included) ? 1 : 0,
            status,
            status === "expired" ? 1 : 0,
            startDate,
            expiryDate,
            row.premium === "" || row.premium == null ? null : Number(row.premium),
            row.survey_charge === "" || row.survey_charge == null ? null : Number(row.survey_charge),
            String(row.invoice_number || "").trim() || null,
            String(row.notes || "").trim() || null,
          ]
        );

        inserted++;
      } catch {
        skipped++;
      }
    }

    return res.json({
      success: true,
      message: "Bulk import finished",
      inserted,
      skipped,
    });
  } catch (err) {
    console.error("bulkImportPolicies error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.importPoliciesExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Excel file is required" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return res.status(400).json({ success: false, message: "Sheet not found" });
    }

    const headerRow = sheet.getRow(1);
    const headers = headerRow.values.map((x) => String(x || "").trim().toLowerCase());

    let inserted = 0;
    let skipped = 0;

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const item = {};
      headers.forEach((h, idx) => {
        if (!h || idx === 0) return;
        item[h] = row.getCell(idx).value;
      });

      try {
        const contactId = Number(item.contact_id || 0);
        const contactVehicleId = Number(item.contact_vehicle_id || 0);
        const vehicleNo = String(item.vehicle_no || "").trim();
        const startDate = String(item.start_date || "").trim();

        if (!contactId || !contactVehicleId || !vehicleNo || !startDate) {
          skipped++;
          continue;
        }

        const contactSnap = await getContactSnapshot(contactId);
        const vehicleSnap = await getVehicleSnapshot(contactVehicleId);
        if (!contactSnap || !vehicleSnap || Number(vehicleSnap.contact_id) !== contactId) {
          skipped++;
          continue;
        }

        const phoneClean = normalizePhone(contactSnap.phone || "");
        if (!isValidPhone10(phoneClean)) {
          skipped++;
          continue;
        }

        const status = normalizePolicyStatus(item.policy_status);
        const expiryDate = calcExpiryDate(startDate);

        await db.query(
          `
          INSERT INTO insurance_policies
          (
            contact_id,
            contact_vehicle_id,
            policy_no,
            customer_name,
            vehicle_no,
            model_name,
            variant_name,
            company,
            phone,
            cpa_included,
            policy_status,
            inspection_required,
            start_date,
            expiry_date,
            premium,
            survey_charge,
            invoice_number,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            contactId,
            contactVehicleId,
            String(item.policy_no || "").trim() || null,
            contactSnap.customer_name,
            vehicleNo,
            vehicleSnap.model_name || null,
            vehicleSnap.variant_name || null,
            String(item.company || "").trim() || null,
            phoneClean,
            boolFromAny(item.cpa_included) ? 1 : 0,
            status,
            status === "expired" ? 1 : 0,
            startDate,
            expiryDate,
            item.premium === "" || item.premium == null ? null : Number(item.premium),
            item.survey_charge === "" || item.survey_charge == null ? null : Number(item.survey_charge),
            String(item.invoice_number || "").trim() || null,
            String(item.notes || "").trim() || null,
          ]
        );

        inserted++;
      } catch {
        skipped++;
      }
    }

    return res.json({
      success: true,
      message: "Excel import finished",
      inserted,
      skipped,
    });
  } catch (err) {
    console.error("importPoliciesExcel error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportPolicies = async (_req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        p.id,
        p.contact_id,
        p.contact_vehicle_id,
        p.policy_no,
        p.customer_name,
        p.phone,
        p.vehicle_no,
        p.model_name,
        p.variant_name,
        cv.chassis_number,
        cv.engine_number,
        p.company,
        p.cpa_included,
        p.policy_status,
        p.start_date,
        p.expiry_date,
        p.premium,
        p.survey_charge,
        p.invoice_number,
        p.notes,
        COALESCE(p.uploaded_file, p.inspection_photo) AS uploaded_file
      FROM insurance_policies p
      LEFT JOIN contact_vehicles cv ON cv.id = p.contact_vehicle_id
      ORDER BY p.id DESC
      `
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Insurance Policies");

    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Contact ID", key: "contact_id", width: 12 },
      { header: "Vehicle ID", key: "contact_vehicle_id", width: 12 },
      { header: "Policy No", key: "policy_no", width: 18 },
      { header: "Customer Name", key: "customer_name", width: 24 },
      { header: "Phone", key: "phone", width: 14 },
      { header: "Vehicle No", key: "vehicle_no", width: 16 },
      { header: "Model", key: "model_name", width: 18 },
      { header: "Variant", key: "variant_name", width: 18 },
      { header: "Chassis No", key: "chassis_number", width: 24 },
      { header: "Engine No", key: "engine_number", width: 24 },
      { header: "Company", key: "company", width: 20 },
      { header: "CPA Included", key: "cpa_included", width: 12 },
      { header: "Policy Status", key: "policy_status", width: 14 },
      { header: "Start Date", key: "start_date", width: 14 },
      { header: "Expiry Date", key: "expiry_date", width: 14 },
      { header: "Premium", key: "premium", width: 12 },
      { header: "Survey Charge", key: "survey_charge", width: 14 },
      { header: "Invoice Number", key: "invoice_number", width: 18 },
      { header: "Notes", key: "notes", width: 24 },
      { header: "Uploaded File", key: "uploaded_file", width: 28 },
    ];

    rows.forEach((r) => sheet.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=insurance_policies.xlsx");

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error("exportPolicies error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};