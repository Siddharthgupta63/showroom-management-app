// backend/controllers/hsrpController.js

const db = require("../db");

function toBool(v) {
  return Number(v || 0) === 1;
}

function cleanStr(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function cleanNum(v, fallback = 0) {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function hsrpStatusOf(row) {
  const hasNumber = !!String(row.hsrp_number || "").trim();
  const plateReceived = toBool(row.plate_received);
  const installed = toBool(row.hsrp_installed);

  if (!hasNumber) return "Pending Order";
  if (!plateReceived) return "Ordered";
  if (!installed) return "Plate Received / Fitment Pending";
  return "Fitment Done";
}

async function ensureHsrpRow(saleId, userId) {
  const [rows] = await db.query(
    `SELECT * FROM hsrp WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
    [saleId]
  );
  if (rows.length) return rows[0];

  const [result] = await db.query(
    `INSERT INTO hsrp
      (sale_id, hsrp_required, hsrp_uploaded_by, plate_received)
     VALUES (?, 1, ?, 0)`,
    [saleId, userId || null]
  );

  const [fresh] = await db.query(
    `SELECT * FROM hsrp WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return fresh[0];
}

async function ensureFitmentRow(saleId, userId) {
  const [rows] = await db.query(
    `SELECT * FROM hsrp_fitment WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
    [saleId]
  );
  if (rows.length) return rows[0];

  const [result] = await db.query(
    `INSERT INTO hsrp_fitment
      (sale_id, fitment_by, fitment_by_name, hsrp_installed, amount_paid, incentive_amount)
     VALUES (?, ?, NULL, 0, 0, 0)`,
    [saleId, userId || null]
  );

  const [fresh] = await db.query(
    `SELECT * FROM hsrp_fitment WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return fresh[0];
}

function buildDateFilter(columnName, fromDate, toDate, params) {
  let sql = "";
  if (fromDate) {
    sql += ` AND DATE(${columnName}) >= ? `;
    params.push(fromDate);
  }
  if (toDate) {
    sql += ` AND DATE(${columnName}) <= ? `;
    params.push(toDate);
  }
  return sql;
}

async function fetchHSRPRows({ fromDate, toDate, search, status }) {
  const params = [];
  let whereSql = `
    WHERE COALESCE(s.is_cancelled, 0) = 0
      AND COALESCE(vs.payment_done, 0) = 1
      AND COALESCE(vs.application_number, '') <> ''
  `;

  whereSql += buildDateFilter("s.sale_date", fromDate, toDate, params);

  if (search) {
    whereSql += `
      AND (
        LOWER(COALESCE(s.customer_name, '')) LIKE ?
        OR LOWER(COALESCE(s.mobile_number, '')) LIKE ?
        OR LOWER(CONCAT_WS(' ', NULLIF(s.vehicle_make, ''), NULLIF(s.vehicle_model, ''))) LIKE ?
        OR LOWER(COALESCE(h.hsrp_number, '')) LIKE ?
        OR LOWER(COALESCE(vs.rto_number, '')) LIKE ?
        OR CAST(s.id AS CHAR) LIKE ?
      )
    `;
    const like = `%${String(search).trim().toLowerCase()}%`;
    params.push(like, like, like, like, like, like);
  }

  const [rows] = await db.query(
    `
    SELECT
      s.id AS sale_id,
      s.customer_name,
      s.mobile_number,
      CONCAT_WS(' ', NULLIF(s.vehicle_make, ''), NULLIF(s.vehicle_model, '')) AS vehicle_model,
      s.sale_date,

      vs.application_number,
      COALESCE(vs.payment_done, 0) AS payment_done,
      vs.rto_number,

      h.id AS hsrp_id,
      h.hsrp_number,
      h.hsrp_issued_date,
      COALESCE(h.plate_received, 0) AS plate_received,
      h.plate_received_date,
      h.plate_received_by,
      h.notes,

      hf.id AS fitment_id,
      COALESCE(hf.hsrp_installed, 0) AS hsrp_installed,
      hf.fitment_date,
      hf.amount_paid,
      hf.fitment_by,
      hf.fitment_by_name

    FROM sales s

    LEFT JOIN (
      SELECT x.*
      FROM vahan_submission x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM vahan_submission
        GROUP BY sale_id
      ) t ON t.max_id = x.id
    ) vs ON vs.sale_id = s.id

    LEFT JOIN (
      SELECT x.*
      FROM hsrp x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM hsrp
        GROUP BY sale_id
      ) t ON t.max_id = x.id
    ) h ON h.sale_id = s.id

    LEFT JOIN (
      SELECT x.*
      FROM hsrp_fitment x
      INNER JOIN (
        SELECT sale_id, MAX(id) AS max_id
        FROM hsrp_fitment
        GROUP BY sale_id
      ) t ON t.max_id = x.id
    ) hf ON hf.sale_id = s.id

    ${whereSql}
    ORDER BY s.id DESC
    `,
    params
  );

  let data = rows.map((r) => {
    const finalHsrpNumber = cleanStr(r.hsrp_number) || cleanStr(r.rto_number) || "";

    return {
      sale_id: r.sale_id,
      customer_name: r.customer_name || "",
      mobile_number: r.mobile_number || "",
      vehicle_model: r.vehicle_model || "-",
      sale_date: r.sale_date,
      rto_number: r.rto_number || "",
      hsrp_number: finalHsrpNumber,
      hsrp_issued_date: r.hsrp_issued_date,
      plate_received: Number(r.plate_received || 0),
      plate_received_date: r.plate_received_date,
      hsrp_installed: Number(r.hsrp_installed || 0),
      fitment_date: r.fitment_date,
      amount_paid: r.amount_paid ?? "",
      fitment_by: r.fitment_by ?? null,
      fitment_by_name: r.fitment_by_name || "",
      notes: r.notes || "",
      status: hsrpStatusOf({
        hsrp_number: finalHsrpNumber,
        plate_received: r.plate_received,
        hsrp_installed: r.hsrp_installed,
      }),
    };
  });

  if (status && String(status).trim().toLowerCase() !== "all") {
    const want = String(status).trim().toLowerCase();
    data = data.filter((r) => String(r.status || "").trim().toLowerCase() === want);
  }

  return data;
}
const getHSRPRequests = async (req, res) => {
  try {
    const fromDate = cleanStr(req.query.from_date);
    const toDate = cleanStr(req.query.to_date);
    const search = cleanStr(req.query.search);
    const status = cleanStr(req.query.status);

    const data = await fetchHSRPRows({ fromDate, toDate, search, status });
    return res.json(data);
  } catch (err) {
    console.error("getHSRPRequests error:", err);
    return res.status(500).json({ message: "Server error fetching HSRP records" });
  }
};

const exportHSRPRequests = async (req, res) => {
  try {
    const fromDate = cleanStr(req.query.from_date);
    const toDate = cleanStr(req.query.to_date);
    const search = cleanStr(req.query.search);
    const status = cleanStr(req.query.status);

    const rows = await fetchHSRPRows({ fromDate, toDate, search, status });

    const header = [
      "Sale ID",
      "Customer Name",
      "Mobile Number",
      "Vehicle Model",
      "Sale Date",
      "RTO Number",
      "HSRP Number",
      "Order Date",
      "Plate Received",
      "Plate Received Date",
      "Fitment Done",
      "Fitment Date",
      "Amount Paid",
      "Fitment By",
      "Notes",
      "Status",
    ];

    const lines = [header.map(csvEscape).join(",")];

    for (const r of rows) {
      lines.push(
        [
          r.sale_id,
          r.customer_name,
          r.mobile_number,
          r.vehicle_model,
          r.sale_date || "",
          r.rto_number || "",
          r.hsrp_number || "",
          r.hsrp_issued_date || "",
          Number(r.plate_received || 0) === 1 ? "Yes" : "No",
          r.plate_received_date || "",
          Number(r.hsrp_installed || 0) === 1 ? "Yes" : "No",
          r.fitment_date || "",
          r.amount_paid ?? "",
          r.fitment_by_name || "",
          r.notes || "",
          r.status || "",
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    const csv = "\uFEFF" + lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="hsrp_export.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error("exportHSRPRequests error:", err);
    return res.status(500).json({ message: "Server error exporting HSRP records" });
  }
};

const createHSRPRequest = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const saleId = Number(req.body.sale_id);

    if (!saleId) {
      return res.status(400).json({ message: "sale_id is required" });
    }

    const [saleRows] = await db.query(
      `
      SELECT
        s.id AS sale_id,
        vs.application_number,
        COALESCE(vs.payment_done, 0) AS payment_done,
        vs.rto_number
      FROM sales s
      LEFT JOIN (
        SELECT x.*
        FROM vahan_submission x
        INNER JOIN (
          SELECT sale_id, MAX(id) AS max_id
          FROM vahan_submission
          GROUP BY sale_id
        ) t ON t.max_id = x.id
      ) vs ON vs.sale_id = s.id
      WHERE s.id = ?
        AND COALESCE(s.is_cancelled, 0) = 0
      LIMIT 1
      `,
      [saleId]
    );

    if (!saleRows.length) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const sale = saleRows[0];

    if (!cleanStr(sale.application_number) || Number(sale.payment_done || 0) !== 1) {
      return res.status(400).json({
        message: "HSRP can be updated only after VAHAN is completed",
      });
    }

    const plateReceived = Number(req.body.plate_received || 0) === 1 ? 1 : 0;
    const installed = Number(req.body.hsrp_installed || 0) === 1 ? 1 : 0;
    const plateReceivedDate = cleanStr(req.body.plate_received_date);
    const fitmentDate = cleanStr(req.body.fitment_date);
    const hsrpIssuedDate = cleanStr(req.body.hsrp_issued_date);
    const amountPaidRaw = req.body.amount_paid;
    const amountPaid = cleanNum(amountPaidRaw, 0);
    const notes = cleanStr(req.body.notes);

    const fitment_by = req.body.fitment_by ? Number(req.body.fitment_by) : null;
    let fitment_by_name = null;

    const finalHsrpNumber =
      cleanStr(sale.rto_number) ||
      cleanStr(req.body.hsrp_number) ||
      null;

    if (!finalHsrpNumber) {
      return res.status(400).json({ message: "HSRP number not available from VAHAN RTO number" });
    }

    if (plateReceived === 1 && !plateReceivedDate) {
      return res.status(400).json({ message: "Plate received date is required" });
    }

    if (installed === 1 && plateReceived !== 1) {
      return res.status(400).json({ message: "Cannot mark fitment done before plate received" });
    }

    if (installed === 1 && !fitmentDate) {
      return res.status(400).json({ message: "Fitment date is required when fitment is done" });
    }

    if (installed === 1 && !fitment_by) {
      return res.status(400).json({ message: "Fitment by is required when fitment is done" });
    }

    if (amountPaidRaw === "" || amountPaidRaw === null || amountPaidRaw === undefined) {
      return res.status(400).json({ message: "Amount paid is required" });
    }

        if (fitment_by) {
      const [userRows] = await db.query(
        `SELECT id, name, username FROM users WHERE id = ? LIMIT 1`,
        [fitment_by]
      );

      if (!userRows.length) {
        return res.status(400).json({ message: "Selected fitment employee not found" });
      }

      fitment_by_name =
        cleanStr(userRows[0].name) ||
        cleanStr(userRows[0].username) ||
        `User #${fitment_by}`;
    }

    await ensureHsrpRow(saleId, userId);
    await ensureFitmentRow(saleId, userId);

    await db.query(
      `
      UPDATE hsrp
      SET
        hsrp_required = 1,
        hsrp_number = ?,
        hsrp_issued_date = ?,
        plate_received = ?,
        plate_received_date = ?,
        plate_received_by = ?,
        notes = ?
      WHERE sale_id = ?
      `,
      [
        finalHsrpNumber,
        hsrpIssuedDate,
        plateReceived,
        plateReceivedDate,
        plateReceived ? userId : null,
        notes,
        saleId,
      ]
    );

        await db.query(
      `
      UPDATE hsrp_fitment
      SET
        hsrp_installed = ?,
        fitment_date = ?,
        amount_paid = ?,
        fitment_by = ?,
        fitment_by_name = ?
      WHERE sale_id = ?
      `,
      [
        installed,
        fitmentDate,
        amountPaid,
        installed ? fitment_by : null,
        installed ? fitment_by_name : null,
        saleId,
      ]
    );

    return res.json({ success: true, message: "HSRP saved successfully" });
  } catch (err) {
    console.error("createHSRPRequest error:", err);
    return res.status(500).json({ message: "Server error saving HSRP" });
  }
};

const updateHSRPRequest = async (req, res) => {
  req.body.sale_id = Number(req.params.id);
  return createHSRPRequest(req, res);
};

const deleteHSRPRequest = async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    if (!saleId) {
      return res.status(400).json({ message: "Invalid sale id" });
    }

    await db.query(`DELETE FROM hsrp_fitment WHERE sale_id = ?`, [saleId]);
    await db.query(`DELETE FROM hsrp WHERE sale_id = ?`, [saleId]);

    return res.json({ success: true, message: "HSRP deleted successfully" });
  } catch (err) {
    console.error("deleteHSRPRequest error:", err);
    return res.status(500).json({ message: "Server error deleting HSRP" });
  }
};

const createOldCustomerFitment = async (req, res) => {
  try {
    const userId = req.user?.id || null;

    const customer_name = cleanStr(req.body.customer_name);
    const mobile_number = cleanStr(req.body.mobile_number);
    const hsrp_number = cleanStr(req.body.hsrp_number);
    const fitment_date = cleanStr(req.body.fitment_date);
    const amount_paid_raw = req.body.amount_paid;
    const amount_paid = cleanNum(amount_paid_raw, 0);
    const fitment_by = req.body.fitment_by ? Number(req.body.fitment_by) : null;
    const notes = cleanStr(req.body.notes);

    if (!customer_name) {
      return res.status(400).json({ message: "Customer name is required" });
    }
    if (!hsrp_number) {
      return res.status(400).json({ message: "HSRP number is required" });
    }
    if (!fitment_date) {
      return res.status(400).json({ message: "Fitment date is required" });
    }
    if (amount_paid_raw === "" || amount_paid_raw === null || amount_paid_raw === undefined) {
      return res.status(400).json({ message: "Amount paid is required" });
    }
    if (!fitment_by) {
      return res.status(400).json({ message: "Fitment by is required" });
    }

    const [userRows] = await db.query(
      `SELECT id, name, username FROM users WHERE id = ? LIMIT 1`,
      [fitment_by]
    );

    if (!userRows.length) {
      return res.status(400).json({ message: "Selected fitment employee not found" });
    }

    const fitment_by_name =
      cleanStr(userRows[0].name) ||
      cleanStr(userRows[0].username) ||
      `User #${fitment_by}`;

    const [result] = await db.query(
      `
      INSERT INTO hsrp_old_fitments
      (
        customer_name,
        mobile_number,
        hsrp_number,
        fitment_date,
        amount_paid,
        fitment_by,
        fitment_by_name,
        notes,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        customer_name,
        mobile_number,
        hsrp_number,
        fitment_date,
        amount_paid,
        fitment_by,
        fitment_by_name,
        notes,
        userId,
      ]
    );

    return res.json({
      success: true,
      message: "Old customer HSRP fitment saved successfully",
      id: result.insertId,
    });
  } catch (err) {
    console.error("createOldCustomerFitment error:", err);
    return res.status(500).json({ message: "Server error saving old customer fitment" });
  }
};

const getOldCustomerFitments = async (req, res) => {
  try {
    const params = [];
    let whereSql = ` WHERE 1 = 1 `;

    const fromDate = cleanStr(req.query.from_date);
    const toDate = cleanStr(req.query.to_date);
    const search = cleanStr(req.query.search);

    whereSql += buildDateFilter("fitment_date", fromDate, toDate, params);

    if (search) {
      const like = `%${String(search).trim().toLowerCase()}%`;
      whereSql += `
        AND (
          LOWER(COALESCE(customer_name, '')) LIKE ?
          OR LOWER(COALESCE(mobile_number, '')) LIKE ?
          OR LOWER(COALESCE(hsrp_number, '')) LIKE ?
          OR LOWER(COALESCE(fitment_by_name, '')) LIKE ?
          OR CAST(id AS CHAR) LIKE ?
        )
      `;
      params.push(like, like, like, like, like);
    }

    const [rows] = await db.query(
      `
      SELECT
        id,
        customer_name,
        mobile_number,
        hsrp_number,
        fitment_date,
        amount_paid,
        fitment_by,
        fitment_by_name,
        notes,
        created_at
      FROM hsrp_old_fitments
      ${whereSql}
      ORDER BY id DESC
      `,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error("getOldCustomerFitments error:", err);
    return res.status(500).json({ message: "Server error fetching old customer fitments" });
  }
};

const exportOldCustomerFitments = async (req, res) => {
  try {
    const params = [];
    let whereSql = ` WHERE 1 = 1 `;

    const fromDate = cleanStr(req.query.from_date);
    const toDate = cleanStr(req.query.to_date);
    const search = cleanStr(req.query.search);

    whereSql += buildDateFilter("fitment_date", fromDate, toDate, params);

    if (search) {
      const like = `%${String(search).trim().toLowerCase()}%`;
      whereSql += `
        AND (
          LOWER(COALESCE(customer_name, '')) LIKE ?
          OR LOWER(COALESCE(mobile_number, '')) LIKE ?
          OR LOWER(COALESCE(hsrp_number, '')) LIKE ?
          OR LOWER(COALESCE(fitment_by_name, '')) LIKE ?
          OR CAST(id AS CHAR) LIKE ?
        )
      `;
      params.push(like, like, like, like, like);
    }

    const [rows] = await db.query(
      `
      SELECT
        id,
        customer_name,
        mobile_number,
        hsrp_number,
        fitment_date,
        amount_paid,
        fitment_by,
        fitment_by_name,
        notes,
        created_at
      FROM hsrp_old_fitments
      ${whereSql}
      ORDER BY id DESC
      `,
      params
    );

    const header = [
      "ID",
      "Customer Name",
      "Mobile Number",
      "HSRP Number",
      "Fitment Date",
      "Amount Paid",
      "Fitment By",
      "Notes",
      "Created At",
    ];

    const lines = [header.map(csvEscape).join(",")];

    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.customer_name,
          r.mobile_number,
          r.hsrp_number,
          r.fitment_date,
          r.amount_paid,
          r.fitment_by_name,
          r.notes,
          r.created_at,
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    const csv = "\uFEFF" + lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="hsrp_old_customer_fitment_export.csv"`
    );
    return res.send(csv);
  } catch (err) {
    console.error("exportOldCustomerFitments error:", err);
    return res.status(500).json({ message: "Server error exporting old customer fitments" });
  }
};

const getFitmentEmployees = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        COALESCE(NULLIF(name,''), NULLIF(username,''), CONCAT('User #',id)) AS name,
        role
      FROM users
      WHERE COALESCE(is_active,1)=1
      AND LOWER(COALESCE(role,'')) NOT IN ('owner','admin')
      ORDER BY name ASC
    `);

    return res.json(rows);
  } catch (err) {
    console.error("getFitmentEmployees error:", err);
    return res.status(500).json({ message: "Server error fetching employees" });
  }
};

module.exports = {
  getHSRPRequests,
  exportHSRPRequests,
  createHSRPRequest,
  updateHSRPRequest,
  deleteHSRPRequest,
  createOldCustomerFitment,
  getOldCustomerFitments,
  exportOldCustomerFitments,
  getFitmentEmployees,
};