const db = require("../db");
const ExcelJS = require("exceljs");

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  return s || null;
}

function normalizeString(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s || null;
}

function applyLike(value) {
  return `%${value}%`;
}

function formatDateOnly(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getTodayDateString() {
  return formatDateOnly(new Date());
}

function getMonthStart(dateString) {
  const d = new Date(dateString);
  d.setDate(1);
  return formatDateOnly(d);
}

function getFinancialYearStart(dateString) {
  const d = new Date(dateString);
  const year = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-04-01`;
}

function getFinancialYearMonthLabels(dateString) {
  const fyStart = new Date(getFinancialYearStart(dateString));
  const end = new Date(dateString);
  const labels = [];

  const cur = new Date(fyStart);
  while (cur <= end) {
    labels.push({
      key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
      label: cur.toLocaleString("en-IN", { month: "short" }),
      year: cur.getFullYear(),
      month: cur.getMonth() + 1,
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  return labels;
}

function safeDateString(value) {
  if (!value) return null;
  return String(value).trim().slice(0, 10);
}

function previousDate(dateString) {
  const d = new Date(dateString);
  d.setDate(d.getDate() - 1);
  return formatDateOnly(d);
}

// use inward_date when available, otherwise fallback to created_at
const STOCK_DATE_EXPR = `COALESCE(vpi.inward_date, vpi.created_at)`;

// --------------------------------------------------
// SALES REPORT
// --------------------------------------------------
exports.getSalesReport = async (req, res) => {
  try {
    const fromDate = normalizeDate(req.query.fromDate);
    const toDate = normalizeDate(req.query.toDate);
    const branchId = normalizeString(req.query.branchId);
    const search = normalizeString(req.query.search);

    let where = ` WHERE 1 = 1 `;
    const params = [];

    if (fromDate) {
      where += ` AND DATE(s.sale_date) >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      where += ` AND DATE(s.sale_date) <= ? `;
      params.push(toDate);
    }

    if (branchId) {
      where += ` AND s.branch_id = ? `;
      params.push(branchId);
    }

    if (search) {
      where += ` AND (
        s.customer_name LIKE ?
        OR s.mobile_number LIKE ?
        OR s.vehicle_model LIKE ?
        OR s.chassis_number LIKE ?
        OR s.engine_number LIKE ?
        OR s.invoice_number LIKE ?
      ) `;
      const q = applyLike(search);
      params.push(q, q, q, q, q, q);
    }

    const rowsSql = `
      SELECT
        s.id,
        s.sale_date,
        s.invoice_number,
        s.customer_name,
        s.mobile_number,
        s.vehicle_model,
        s.chassis_number,
        s.engine_number,
        s.branch_id,
        COALESCE(sb.branch_name, '') AS branch_name,
        COALESCE(s.sale_price, 0) AS sale_price
      FROM sales s
      LEFT JOIN showroom_branches sb ON sb.id = s.branch_id
      ${where}
      ORDER BY s.sale_date DESC, s.id DESC
    `;

    const [rows] = await db.query(rowsSql, params);

    const summarySql = `
      SELECT
        COUNT(*) AS total_sales,
        COALESCE(SUM(s.sale_price), 0) AS total_amount,
        COALESCE(SUM(s.sale_price), 0) AS total_ex_showroom,
        0 AS total_insurance,
        0 AS total_accessories
      FROM sales s
      ${where}
    `;

    const [summaryRows] = await db.query(summarySql, params);

    return res.json({
      success: true,
      rows,
      summary: summaryRows[0] || {
        total_sales: 0,
        total_amount: 0,
        total_ex_showroom: 0,
        total_insurance: 0,
        total_accessories: 0,
      },
    });
  } catch (error) {
    console.error("getSalesReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sales report",
      error: error.message,
    });
  }
};

exports.getSalesAnalytics = async (req, res) => {
  try {
    const fromDate = normalizeDate(req.query.fromDate);
    const toDate = normalizeDate(req.query.toDate) || getTodayDateString();
    const branchId = normalizeString(req.query.branchId);
    const search = normalizeString(req.query.search);

    const reportToDate = toDate;
    const mtdFromDate = getMonthStart(reportToDate);
    const ytdFromDate = getFinancialYearStart(reportToDate);
    const defaultAnalysisFromDate = fromDate || ytdFromDate;
    const defaultAnalysisToDate = reportToDate;

    let baseWhere = ` WHERE 1 = 1 `;
    const baseParams = [];

    if (fromDate) {
      baseWhere += ` AND DATE(s.sale_date) >= ? `;
      baseParams.push(fromDate);
    }

    if (toDate) {
      baseWhere += ` AND DATE(s.sale_date) <= ? `;
      baseParams.push(toDate);
    }

    if (branchId) {
      baseWhere += ` AND s.branch_id = ? `;
      baseParams.push(branchId);
    }

    if (search) {
      baseWhere += ` AND (
        s.customer_name LIKE ?
        OR s.mobile_number LIKE ?
        OR s.vehicle_model LIKE ?
        OR s.chassis_number LIKE ?
        OR s.engine_number LIKE ?
        OR s.invoice_number LIKE ?
      ) `;
      const q = applyLike(search);
      baseParams.push(q, q, q, q, q, q);
    }

    const rowsSql = `
      SELECT
        s.id,
        s.sale_date,
        s.invoice_number,
        s.customer_name,
        s.mobile_number,
        s.vehicle_model,
        s.chassis_number,
        s.engine_number,
        COALESCE(sb.branch_name, '') AS branch_name,
        COALESCE(s.sale_price, 0) AS sale_price
      FROM sales s
      LEFT JOIN showroom_branches sb ON sb.id = s.branch_id
      ${baseWhere}
      ORDER BY s.sale_date DESC, s.id DESC
    `;

    const [rows] = await db.query(rowsSql, baseParams);

    const summarySql = `
      SELECT
        COUNT(*) AS total_sales,
        COALESCE(SUM(s.sale_price), 0) AS total_amount,
        COALESCE(SUM(s.sale_price), 0) AS total_ex_showroom,
        0 AS total_insurance,
        0 AS total_accessories
      FROM sales s
      ${baseWhere}
    `;

    const [summaryRows] = await db.query(summarySql, baseParams);

    let mtdWhere = ` WHERE DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ? `;
    const mtdParams = [mtdFromDate, reportToDate];

    if (branchId) {
      mtdWhere += ` AND s.branch_id = ? `;
      mtdParams.push(branchId);
    }

    if (search) {
      mtdWhere += ` AND (
        s.customer_name LIKE ?
        OR s.mobile_number LIKE ?
        OR s.vehicle_model LIKE ?
        OR s.chassis_number LIKE ?
        OR s.engine_number LIKE ?
        OR s.invoice_number LIKE ?
      ) `;
      const q = applyLike(search);
      mtdParams.push(q, q, q, q, q, q);
    }

    const [mtdRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_sales,
        COALESCE(SUM(s.sale_price), 0) AS total_amount
      FROM sales s
      ${mtdWhere}
      `,
      mtdParams
    );

    let ytdWhere = ` WHERE DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ? `;
    const ytdParams = [ytdFromDate, reportToDate];

    if (branchId) {
      ytdWhere += ` AND s.branch_id = ? `;
      ytdParams.push(branchId);
    }

    if (search) {
      ytdWhere += ` AND (
        s.customer_name LIKE ?
        OR s.mobile_number LIKE ?
        OR s.vehicle_model LIKE ?
        OR s.chassis_number LIKE ?
        OR s.engine_number LIKE ?
        OR s.invoice_number LIKE ?
      ) `;
      const q = applyLike(search);
      ytdParams.push(q, q, q, q, q, q);
    }

    const [ytdRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_sales,
        COALESCE(SUM(s.sale_price), 0) AS total_amount
      FROM sales s
      ${ytdWhere}
      `,
      ytdParams
    );

    let analysisWhere = ` WHERE DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ? `;
    const analysisParams = [defaultAnalysisFromDate, defaultAnalysisToDate];

    if (branchId) {
      analysisWhere += ` AND s.branch_id = ? `;
      analysisParams.push(branchId);
    }

    if (search) {
      analysisWhere += ` AND (
        s.customer_name LIKE ?
        OR s.mobile_number LIKE ?
        OR s.vehicle_model LIKE ?
        OR s.chassis_number LIKE ?
        OR s.engine_number LIKE ?
        OR s.invoice_number LIKE ?
      ) `;
      const q = applyLike(search);
      analysisParams.push(q, q, q, q, q, q);
    }

    const [modelWiseRows] = await db.query(
      `
      SELECT
        COALESCE(s.vehicle_model, 'Unknown') AS vehicle_model,
        COUNT(*) AS retail_count,
        COALESCE(SUM(s.sale_price), 0) AS total_amount,
        COALESCE(AVG(NULLIF(s.sale_price, 0)), 0) AS avg_amount
      FROM sales s
      ${analysisWhere}
      GROUP BY COALESCE(s.vehicle_model, 'Unknown')
      ORDER BY retail_count DESC, total_amount DESC
      `,
      analysisParams
    );

    const [branchWiseRows] = await db.query(
      `
      SELECT
        COALESCE(sb.branch_name, 'Unknown') AS branch_name,
        COUNT(*) AS retail_count,
        COALESCE(SUM(s.sale_price), 0) AS total_amount
      FROM sales s
      LEFT JOIN showroom_branches sb ON sb.id = s.branch_id
      ${analysisWhere}
      GROUP BY COALESCE(sb.branch_name, 'Unknown')
      ORDER BY retail_count DESC, total_amount DESC
      `,
      analysisParams
    );

    const [dateWiseRaw] = await db.query(
      `
      SELECT
        DAY(s.sale_date) AS day_no,
        COUNT(*) AS retail_count,
        COALESCE(SUM(s.sale_price), 0) AS total_amount
      FROM sales s
      ${analysisWhere}
      GROUP BY DAY(s.sale_date)
      ORDER BY DAY(s.sale_date)
      `,
      analysisParams
    );

    const dateWiseRows = [];
    const startDay = new Date(defaultAnalysisFromDate);
    const endDay = new Date(defaultAnalysisToDate);

    const sameMonth =
      startDay.getFullYear() === endDay.getFullYear() &&
      startDay.getMonth() === endDay.getMonth();

    if (sameMonth) {
      const lastDay = endDay.getDate();
      for (let d = 1; d <= lastDay; d++) {
        const found = dateWiseRaw.find((x) => Number(x.day_no) === d);
        dateWiseRows.push({
          day_no: d,
          retail_count: found ? Number(found.retail_count) : 0,
          total_amount: found ? Number(found.total_amount) : 0,
        });
      }
    } else {
      dateWiseRaw.forEach((r) =>
        dateWiseRows.push({
          day_no: Number(r.day_no),
          retail_count: Number(r.retail_count),
          total_amount: Number(r.total_amount),
        })
      );
    }

    let monthWhere = ` WHERE DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ? `;
    const monthParams = [ytdFromDate, reportToDate];

    if (branchId) {
      monthWhere += ` AND s.branch_id = ? `;
      monthParams.push(branchId);
    }

    if (search) {
      monthWhere += ` AND (
        s.customer_name LIKE ?
        OR s.mobile_number LIKE ?
        OR s.vehicle_model LIKE ?
        OR s.chassis_number LIKE ?
        OR s.engine_number LIKE ?
        OR s.invoice_number LIKE ?
      ) `;
      const q = applyLike(search);
      monthParams.push(q, q, q, q, q, q);
    }

    const [monthWiseRaw] = await db.query(
      `
      SELECT
        YEAR(s.sale_date) AS year_no,
        MONTH(s.sale_date) AS month_no,
        COUNT(*) AS retail_count,
        COALESCE(SUM(s.sale_price), 0) AS total_amount
      FROM sales s
      ${monthWhere}
      GROUP BY YEAR(s.sale_date), MONTH(s.sale_date)
      ORDER BY YEAR(s.sale_date), MONTH(s.sale_date)
      `,
      monthParams
    );

    const fyLabels = getFinancialYearMonthLabels(reportToDate);

    const monthWiseRows = fyLabels.map((m) => {
      const found = monthWiseRaw.find(
        (x) => Number(x.year_no) === m.year && Number(x.month_no) === m.month
      );
      return {
        month_key: m.key,
        month_label: m.label,
        retail_count: found ? Number(found.retail_count) : 0,
        total_amount: found ? Number(found.total_amount) : 0,
      };
    });

    return res.json({
      success: true,
      filters: {
        fromDate,
        toDate,
        branchId,
        search,
        mtdFromDate,
        ytdFromDate,
        analysisFromDate: defaultAnalysisFromDate,
        analysisToDate: defaultAnalysisToDate,
      },
      summary: summaryRows[0] || {
        total_sales: 0,
        total_amount: 0,
        total_ex_showroom: 0,
        total_insurance: 0,
        total_accessories: 0,
      },
      mtd: mtdRows[0] || {
        total_sales: 0,
        total_amount: 0,
      },
      ytd: ytdRows[0] || {
        total_sales: 0,
        total_amount: 0,
      },
      rows,
      modelWise: modelWiseRows || [],
      branchWise: branchWiseRows || [],
      dateWise: dateWiseRows || [],
      monthWise: monthWiseRows || [],
    });
  } catch (error) {
    console.error("getSalesAnalytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sales analytics",
      error: error.message,
    });
  }
};

exports.exportSalesReport = async (req, res) => {
  try {
    const fromDate = normalizeDate(req.query.fromDate);
    const toDate = normalizeDate(req.query.toDate);
    const branchId = normalizeString(req.query.branchId);
    const search = normalizeString(req.query.search);

    let where = ` WHERE 1 = 1 `;
    const params = [];

    if (fromDate) {
      where += ` AND DATE(s.sale_date) >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      where += ` AND DATE(s.sale_date) <= ? `;
      params.push(toDate);
    }

    if (branchId) {
      where += ` AND s.branch_id = ? `;
      params.push(branchId);
    }

    if (search) {
      where += ` AND (
        s.customer_name LIKE ?
        OR s.mobile_number LIKE ?
        OR s.vehicle_model LIKE ?
        OR s.chassis_number LIKE ?
        OR s.engine_number LIKE ?
        OR s.invoice_number LIKE ?
      ) `;
      const q = applyLike(search);
      params.push(q, q, q, q, q, q);
    }

    const sql = `
      SELECT
        s.id AS ID,
        DATE_FORMAT(s.sale_date, '%Y-%m-%d') AS sale_date,
        COALESCE(s.invoice_number, '') AS invoice_number,
        COALESCE(s.customer_name, '') AS customer_name,
        COALESCE(s.mobile_number, '') AS mobile_number,
        COALESCE(sb.branch_name, '') AS branch_name,
        COALESCE(s.vehicle_model, '') AS vehicle_model,
        COALESCE(s.chassis_number, '') AS chassis_number,
        COALESCE(s.engine_number, '') AS engine_number,
        COALESCE(s.sale_price, 0) AS total_amount
      FROM sales s
      LEFT JOIN showroom_branches sb ON sb.id = s.branch_id
      ${where}
      ORDER BY s.sale_date DESC, s.id DESC
    `;

    const [rows] = await db.query(sql, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    worksheet.columns = [
      { header: "ID", key: "ID", width: 10 },
      { header: "Sale Date", key: "sale_date", width: 14 },
      { header: "Invoice No", key: "invoice_number", width: 18 },
      { header: "Customer", key: "customer_name", width: 28 },
      { header: "Mobile", key: "mobile_number", width: 16 },
      { header: "Branch", key: "branch_name", width: 18 },
      { header: "Vehicle", key: "vehicle_model", width: 22 },
      { header: "Chassis", key: "chassis_number", width: 24 },
      { header: "Engine", key: "engine_number", width: 24 },
      { header: "Total Amount", key: "total_amount", width: 14 },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="sales-report.xlsx"'
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("exportSalesReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export sales report",
      error: error.message,
    });
  }
};

// --------------------------------------------------
// STOCK REPORT
// --------------------------------------------------
exports.getStockReport = async (req, res) => {
  try {
    const fromDate = normalizeDate(req.query.fromDate);
    const toDate = normalizeDate(req.query.toDate);
    const branchId = normalizeString(req.query.branchId);
    const status = normalizeString(req.query.status);
    const search = normalizeString(req.query.search);

    let where = ` WHERE 1 = 1 `;
    const params = [];

    if (fromDate) {
      where += ` AND DATE(${STOCK_DATE_EXPR}) >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      where += ` AND DATE(${STOCK_DATE_EXPR}) <= ? `;
      params.push(toDate);
    }

    if (branchId) {
      where += ` AND vpi.current_branch_id = ? `;
      params.push(branchId);
    }

    if (status) {
      where += ` AND vpi.status_code = ? `;
      params.push(status);
    }

    if (search) {
      where += ` AND (
        COALESCE(s.customer_name, '') LIKE ?
        OR COALESCE(s.mobile_number, '') LIKE ?
        OR COALESCE(vpi.chassis_number, '') LIKE ?
        OR COALESCE(vpi.engine_number, '') LIKE ?
        OR COALESCE(vm.model_name, '') LIKE ?
        OR COALESCE(vv.variant_name, '') LIKE ?
      ) `;
      const q = applyLike(search);
      params.push(q, q, q, q, q, q);
    }

    const rowsSql = `
      SELECT
        vpi.id,
        ${STOCK_DATE_EXPR} AS stock_date,
        COALESCE(sb.branch_name, '') AS branch_name,
        CONCAT_WS(' / ', vm.model_name, vv.variant_name, vpi.color) AS vehicle_name,
        COALESCE(vpi.chassis_number, '') AS chassis_number,
        COALESCE(vpi.engine_number, '') AS engine_number,
        COALESCE(vpi.status_code, '') AS status_code,
        COALESCE(s.customer_name, '') AS customer_name,
        COALESCE(s.mobile_number, '') AS mobile_number,
        DATEDIFF(CURDATE(), DATE(${STOCK_DATE_EXPR})) AS ageing_days
      FROM vehicle_purchase_items vpi
      LEFT JOIN showroom_branches sb ON sb.id = vpi.current_branch_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${where}
      ORDER BY vpi.id DESC
    `;

    const [rows] = await db.query(rowsSql, params);

    const summarySql = `
      SELECT
        COUNT(*) AS total_stock,
        SUM(CASE WHEN vpi.status_code = 'in_stock' THEN 1 ELSE 0 END) AS in_stock_count,
        SUM(CASE WHEN vpi.status_code = 'sold' THEN 1 ELSE 0 END) AS sold_count,
        SUM(CASE WHEN DATEDIFF(CURDATE(), DATE(${STOCK_DATE_EXPR})) BETWEEN 0 AND 30 THEN 1 ELSE 0 END) AS ageing_0_30,
        SUM(CASE WHEN DATEDIFF(CURDATE(), DATE(${STOCK_DATE_EXPR})) BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS ageing_31_60,
        SUM(CASE WHEN DATEDIFF(CURDATE(), DATE(${STOCK_DATE_EXPR})) BETWEEN 61 AND 90 THEN 1 ELSE 0 END) AS ageing_61_90,
        SUM(CASE WHEN DATEDIFF(CURDATE(), DATE(${STOCK_DATE_EXPR})) > 90 THEN 1 ELSE 0 END) AS ageing_90_plus
      FROM vehicle_purchase_items vpi
      LEFT JOIN sales s ON s.id = vpi.sale_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      ${where}
    `;

    const [summaryRows] = await db.query(summarySql, params);

    return res.json({
      success: true,
      rows,
      summary: summaryRows[0] || {
        total_stock: 0,
        in_stock_count: 0,
        sold_count: 0,
        ageing_0_30: 0,
        ageing_31_60: 0,
        ageing_61_90: 0,
        ageing_90_plus: 0,
      },
    });
  } catch (error) {
    console.error("getStockReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock report",
      error: error.message,
    });
  }
};

exports.exportStockReport = async (req, res) => {
  try {
    const fromDate = normalizeDate(req.query.fromDate);
    const toDate = normalizeDate(req.query.toDate);
    const branchId = normalizeString(req.query.branchId);
    const status = normalizeString(req.query.status);
    const search = normalizeString(req.query.search);

    let where = ` WHERE 1 = 1 `;
    const params = [];

    if (fromDate) {
      where += ` AND DATE(${STOCK_DATE_EXPR}) >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      where += ` AND DATE(${STOCK_DATE_EXPR}) <= ? `;
      params.push(toDate);
    }

    if (branchId) {
      where += ` AND vpi.current_branch_id = ? `;
      params.push(branchId);
    }

    if (status) {
      where += ` AND vpi.status_code = ? `;
      params.push(status);
    }

    if (search) {
      where += ` AND (
        COALESCE(s.customer_name, '') LIKE ?
        OR COALESCE(s.mobile_number, '') LIKE ?
        OR COALESCE(vpi.chassis_number, '') LIKE ?
        OR COALESCE(vpi.engine_number, '') LIKE ?
        OR COALESCE(vm.model_name, '') LIKE ?
        OR COALESCE(vv.variant_name, '') LIKE ?
      ) `;
      const q = applyLike(search);
      params.push(q, q, q, q, q, q);
    }

    const sql = `
      SELECT
        vpi.id AS row_id,
        DATE_FORMAT(${STOCK_DATE_EXPR}, '%Y-%m-%d') AS purchase_date,
        COALESCE(sb.branch_name, '') AS branch_name,
        CONCAT_WS(' / ', vm.model_name, vv.variant_name, vpi.color) AS vehicle_name,
        COALESCE(vpi.chassis_number, '') AS chassis_number,
        COALESCE(vpi.engine_number, '') AS engine_number,
        COALESCE(vpi.status_code, '') AS status_code,
        COALESCE(s.customer_name, '') AS customer_name,
        COALESCE(s.mobile_number, '') AS mobile_number,
        COALESCE(DATEDIFF(CURDATE(), DATE(${STOCK_DATE_EXPR})), 0) AS ageing_days
      FROM vehicle_purchase_items vpi
      LEFT JOIN showroom_branches sb ON sb.id = vpi.current_branch_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${where}
      ORDER BY vpi.id DESC
    `;

    const [rows] = await db.query(sql, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Stock Report");

    worksheet.columns = [
      { header: "ID", key: "row_id", width: 10 },
      { header: "Purchase Date", key: "purchase_date", width: 14 },
      { header: "Branch", key: "branch_name", width: 18 },
      { header: "Vehicle", key: "vehicle_name", width: 28 },
      { header: "Chassis", key: "chassis_number", width: 24 },
      { header: "Engine", key: "engine_number", width: 24 },
      { header: "Status", key: "status_code", width: 14 },
      { header: "Customer", key: "customer_name", width: 26 },
      { header: "Mobile", key: "mobile_number", width: 16 },
      { header: "Ageing Days", key: "ageing_days", width: 12 },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="stock-report.xlsx"'
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("exportStockReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export stock report",
      error: error.message,
    });
  }
};

// --------------------------------------------------
// ODRC REPORT
// --------------------------------------------------
exports.getStockOdrcReport = async (req, res) => {
  try {
    const reportDate = safeDateString(req.query.reportDate) || safeDateString(new Date());
    const branchId = normalizeString(req.query.branchId);
    const search = normalizeString(req.query.search);
    const prevDate = previousDate(reportDate);

    let commonWhere = ` WHERE 1 = 1 `;
    const commonParams = [];

    if (branchId) {
      commonWhere += ` AND vpi.current_branch_id = ? `;
      commonParams.push(branchId);
    }

    if (search) {
      commonWhere += ` AND (
        COALESCE(vpi.chassis_number, '') LIKE ?
        OR COALESCE(vpi.engine_number, '') LIKE ?
        OR COALESCE(vm.model_name, '') LIKE ?
        OR COALESCE(vv.variant_name, '') LIKE ?
        OR COALESCE(s.customer_name, '') LIKE ?
        OR COALESCE(s.mobile_number, '') LIKE ?
      ) `;
      const q = applyLike(search);
      commonParams.push(q, q, q, q, q, q);
    }

    const retailExtraWhere = `
      ${branchId ? " AND vpi.current_branch_id = ? " : ""}
      ${search ? `
        AND (
          COALESCE(vpi.chassis_number, '') LIKE ?
          OR COALESCE(vpi.engine_number, '') LIKE ?
          OR COALESCE(vm.model_name, '') LIKE ?
          OR COALESCE(vv.variant_name, '') LIKE ?
          OR COALESCE(s.customer_name, '') LIKE ?
          OR COALESCE(s.mobile_number, '') LIKE ?
        )
      ` : ""}
    `;

    const retailExtraParams = [
      ...(branchId ? [branchId] : []),
      ...(search ? (() => {
        const q = applyLike(search);
        return [q, q, q, q, q, q];
      })() : []),
    ];

    const overallSql = `
      SELECT
        (
          SELECT COUNT(*)
          FROM vehicle_purchase_items vpi
          LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
          LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
          LEFT JOIN sales s ON s.id = vpi.sale_id
          ${commonWhere}
          AND DATE(${STOCK_DATE_EXPR}) <= ?
        ) AS opening_stock,

        (
          SELECT COUNT(*)
          FROM vehicle_purchase_items vpi
          LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
          LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
          LEFT JOIN sales s ON s.id = vpi.sale_id
          ${commonWhere}
          AND DATE(${STOCK_DATE_EXPR}) = ?
        ) AS dispatch_count,

        (
          SELECT COUNT(*)
          FROM sales s
          LEFT JOIN vehicle_purchase_items vpi ON vpi.sale_id = s.id
          LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
          LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
          WHERE DATE(s.sale_date) = ?
          ${retailExtraWhere}
        ) AS retail_count,

        (
          SELECT COUNT(*)
          FROM vehicle_purchase_items vpi
          LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
          LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
          LEFT JOIN sales s ON s.id = vpi.sale_id
          ${commonWhere}
          AND DATE(${STOCK_DATE_EXPR}) <= ?
        )
        +
        (
          SELECT COUNT(*)
          FROM vehicle_purchase_items vpi
          LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
          LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
          LEFT JOIN sales s ON s.id = vpi.sale_id
          ${commonWhere}
          AND DATE(${STOCK_DATE_EXPR}) = ?
        )
        -
        (
          SELECT COUNT(*)
          FROM sales s
          LEFT JOIN vehicle_purchase_items vpi ON vpi.sale_id = s.id
          LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
          LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
          WHERE DATE(s.sale_date) = ?
          ${retailExtraWhere}
        ) AS closing_stock
    `;

    const overallParams = [
      ...commonParams, prevDate,
      ...commonParams, reportDate,
      reportDate, ...retailExtraParams,
      ...commonParams, prevDate,
      ...commonParams, reportDate,
      reportDate, ...retailExtraParams,
    ];

    const [overallRows] = await db.query(overallSql, overallParams);

    let branchWhere = ` WHERE 1 = 1 `;
    const branchParams = [];

    if (branchId) {
      branchWhere += ` AND sb.id = ? `;
      branchParams.push(branchId);
    }

    const [branchRows] = await db.query(
      `
      SELECT
        sb.id AS branch_id,
        sb.branch_name,
        SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) <= ? THEN 1 ELSE 0 END) AS opening_stock,
        SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) = ? THEN 1 ELSE 0 END) AS dispatch_count,
        SUM(CASE WHEN DATE(s.sale_date) = ? THEN 1 ELSE 0 END) AS retail_count,
        (
          SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) <= ? THEN 1 ELSE 0 END)
          + SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) = ? THEN 1 ELSE 0 END)
          - SUM(CASE WHEN DATE(s.sale_date) = ? THEN 1 ELSE 0 END)
        ) AS closing_stock
      FROM showroom_branches sb
      LEFT JOIN vehicle_purchase_items vpi ON vpi.current_branch_id = sb.id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${branchWhere}
      GROUP BY sb.id, sb.branch_name
      ORDER BY sb.branch_name
      `,
      [prevDate, reportDate, reportDate, prevDate, reportDate, reportDate, ...branchParams]
    );

    let modelWhere = ` WHERE 1 = 1 `;
    const modelParams = [];

    if (branchId) {
      modelWhere += ` AND vpi.current_branch_id = ? `;
      modelParams.push(branchId);
    }

    if (search) {
      modelWhere += ` AND (
        COALESCE(vpi.chassis_number, '') LIKE ?
        OR COALESCE(vpi.engine_number, '') LIKE ?
        OR COALESCE(vm.model_name, '') LIKE ?
        OR COALESCE(vv.variant_name, '') LIKE ?
        OR COALESCE(s.customer_name, '') LIKE ?
        OR COALESCE(s.mobile_number, '') LIKE ?
      ) `;
      const q = applyLike(search);
      modelParams.push(q, q, q, q, q, q);
    }

    const [modelRows] = await db.query(
      `
      SELECT
        CONCAT_WS(' / ', vm.model_name, vv.variant_name) AS model_label,
        SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) <= ? THEN 1 ELSE 0 END) AS opening_stock,
        SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) = ? THEN 1 ELSE 0 END) AS dispatch_count,
        SUM(CASE WHEN DATE(s.sale_date) = ? THEN 1 ELSE 0 END) AS retail_count,
        (
          SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) <= ? THEN 1 ELSE 0 END)
          + SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) = ? THEN 1 ELSE 0 END)
          - SUM(CASE WHEN DATE(s.sale_date) = ? THEN 1 ELSE 0 END)
        ) AS closing_stock
      FROM vehicle_purchase_items vpi
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${modelWhere}
      GROUP BY vm.model_name, vv.variant_name
      HAVING model_label IS NOT NULL AND model_label <> ''
      ORDER BY closing_stock DESC, model_label
      `,
      [prevDate, reportDate, reportDate, prevDate, reportDate, reportDate, ...modelParams]
    );

    return res.json({
      success: true,
      filters: {
        reportDate,
        branchId,
        search,
      },
      summary: overallRows[0] || {
        opening_stock: 0,
        dispatch_count: 0,
        retail_count: 0,
        closing_stock: 0,
      },
      branchWise: branchRows || [],
      modelWise: modelRows || [],
    });
  } catch (error) {
    console.error("getStockOdrcReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch ODRC report",
      error: error.message,
    });
  }
};

exports.exportStockOdrcReport = async (req, res) => {
  try {
    const reportDate = safeDateString(req.query.reportDate) || safeDateString(new Date());
    const branchId = normalizeString(req.query.branchId);
    const search = normalizeString(req.query.search);
    const prevDate = previousDate(reportDate);

    let modelWhere = ` WHERE 1 = 1 `;
    const modelParams = [];

    if (branchId) {
      modelWhere += ` AND vpi.current_branch_id = ? `;
      modelParams.push(branchId);
    }

    if (search) {
      modelWhere += ` AND (
        COALESCE(vpi.chassis_number, '') LIKE ?
        OR COALESCE(vpi.engine_number, '') LIKE ?
        OR COALESCE(vm.model_name, '') LIKE ?
        OR COALESCE(vv.variant_name, '') LIKE ?
        OR COALESCE(s.customer_name, '') LIKE ?
        OR COALESCE(s.mobile_number, '') LIKE ?
      ) `;
      const q = applyLike(search);
      modelParams.push(q, q, q, q, q, q);
    }

    const [rows] = await db.query(
      `
      SELECT
        CONCAT_WS(' / ', vm.model_name, vv.variant_name) AS model_label,
        SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) <= ? THEN 1 ELSE 0 END) AS opening_stock,
        SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) = ? THEN 1 ELSE 0 END) AS dispatch_count,
        SUM(CASE WHEN DATE(s.sale_date) = ? THEN 1 ELSE 0 END) AS retail_count,
        (
          SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) <= ? THEN 1 ELSE 0 END)
          + SUM(CASE WHEN DATE(${STOCK_DATE_EXPR}) = ? THEN 1 ELSE 0 END)
          - SUM(CASE WHEN DATE(s.sale_date) = ? THEN 1 ELSE 0 END)
        ) AS closing_stock
      FROM vehicle_purchase_items vpi
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${modelWhere}
      GROUP BY vm.model_name, vv.variant_name
      HAVING model_label IS NOT NULL AND model_label <> ''
      ORDER BY closing_stock DESC, model_label
      `,
      [prevDate, reportDate, reportDate, prevDate, reportDate, reportDate, ...modelParams]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("ODRC Report");

    worksheet.columns = [
      { header: "Model", key: "model_label", width: 32 },
      { header: "Opening Stock", key: "opening_stock", width: 16 },
      { header: "Dispatch", key: "dispatch_count", width: 12 },
      { header: "Retail", key: "retail_count", width: 12 },
      { header: "Closing Stock", key: "closing_stock", width: 16 },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="odrc-report-${reportDate}.xlsx"`
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("exportStockOdrcReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export ODRC report",
      error: error.message,
    });
  }
};

// --------------------------------------------------
// STOCK AGEING REPORT
// --------------------------------------------------
exports.getStockAgeingReport = async (req, res) => {
  try {
    const asOnDate = safeDateString(req.query.asOnDate) || safeDateString(new Date());
    const branchId = normalizeString(req.query.branchId);
    const search = normalizeString(req.query.search);
    const status = normalizeString(req.query.status) || "in_stock";

    let where = `
      WHERE 1 = 1
      AND ${STOCK_DATE_EXPR} IS NOT NULL
    `;
    const params = [];

    if (status) {
      where += ` AND vpi.status_code = ? `;
      params.push(status);
    }

    if (branchId) {
      where += ` AND vpi.current_branch_id = ? `;
      params.push(branchId);
    }

    if (search) {
      where += ` AND (
        COALESCE(vpi.chassis_number, '') LIKE ?
        OR COALESCE(vpi.engine_number, '') LIKE ?
        OR COALESCE(vm.model_name, '') LIKE ?
        OR COALESCE(vv.variant_name, '') LIKE ?
        OR COALESCE(vpi.color, '') LIKE ?
        OR COALESCE(s.customer_name, '') LIKE ?
        OR COALESCE(s.mobile_number, '') LIKE ?
      ) `;
      const q = applyLike(search);
      params.push(q, q, q, q, q, q, q);
    }

    const rowsSql = `
      SELECT
        vpi.id,
        ${STOCK_DATE_EXPR} AS inward_date,
        COALESCE(sb.branch_name, '') AS branch_name,
        CONCAT_WS(' / ', vm.model_name, vv.variant_name, vpi.color) AS vehicle_name,
        COALESCE(vpi.chassis_number, '') AS chassis_number,
        COALESCE(vpi.engine_number, '') AS engine_number,
        COALESCE(vpi.status_code, '') AS status_code,
        COALESCE(s.customer_name, '') AS customer_name,
        COALESCE(s.mobile_number, '') AS mobile_number,
        DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) AS ageing_days,
        CASE
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 0 AND 7 THEN '0-7 Days'
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 8 AND 15 THEN '8-15 Days'
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 16 AND 30 THEN '16-30 Days'
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 31 AND 60 THEN '31-60 Days'
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 61 AND 90 THEN '61-90 Days'
          ELSE '90+ Days'
        END AS ageing_bucket
      FROM vehicle_purchase_items vpi
      LEFT JOIN showroom_branches sb ON sb.id = vpi.current_branch_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${where}
      ORDER BY DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) DESC, vpi.id DESC
    `;

    const [rows] = await db.query(rowsSql, [
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      ...params,
      asOnDate,
    ]);

    const summarySql = `
      SELECT
        COUNT(*) AS total_units,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 0 AND 7 THEN 1 ELSE 0 END) AS bucket_0_7,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 8 AND 15 THEN 1 ELSE 0 END) AS bucket_8_15,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 16 AND 30 THEN 1 ELSE 0 END) AS bucket_16_30,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS bucket_31_60,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 61 AND 90 THEN 1 ELSE 0 END) AS bucket_61_90,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) > 90 THEN 1 ELSE 0 END) AS bucket_90_plus
      FROM vehicle_purchase_items vpi
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${where}
    `;

    const [summaryRows] = await db.query(summarySql, [
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      ...params,
    ]);

    const branchSql = `
      SELECT
        COALESCE(sb.branch_name, 'Unknown') AS branch_name,
        COUNT(*) AS total_units,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 0 AND 7 THEN 1 ELSE 0 END) AS bucket_0_7,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 8 AND 15 THEN 1 ELSE 0 END) AS bucket_8_15,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 16 AND 30 THEN 1 ELSE 0 END) AS bucket_16_30,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS bucket_31_60,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 61 AND 90 THEN 1 ELSE 0 END) AS bucket_61_90,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) > 90 THEN 1 ELSE 0 END) AS bucket_90_plus
      FROM vehicle_purchase_items vpi
      LEFT JOIN showroom_branches sb ON sb.id = vpi.current_branch_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${where}
      GROUP BY COALESCE(sb.branch_name, 'Unknown')
      ORDER BY total_units DESC, branch_name
    `;

    const [branchRows] = await db.query(branchSql, [
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      ...params,
    ]);

    const modelSql = `
      SELECT
        CONCAT_WS(' / ', vm.model_name, vv.variant_name) AS model_label,
        COUNT(*) AS total_units,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 0 AND 7 THEN 1 ELSE 0 END) AS bucket_0_7,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 8 AND 15 THEN 1 ELSE 0 END) AS bucket_8_15,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 16 AND 30 THEN 1 ELSE 0 END) AS bucket_16_30,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS bucket_31_60,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 61 AND 90 THEN 1 ELSE 0 END) AS bucket_61_90,
        SUM(CASE WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) > 90 THEN 1 ELSE 0 END) AS bucket_90_plus
      FROM vehicle_purchase_items vpi
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${where}
      GROUP BY vm.model_name, vv.variant_name
      HAVING model_label IS NOT NULL AND model_label <> ''
      ORDER BY total_units DESC, model_label
    `;

    const [modelRows] = await db.query(modelSql, [
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      ...params,
    ]);

    return res.json({
      success: true,
      filters: {
        asOnDate,
        branchId,
        search,
        status,
      },
      summary: summaryRows[0] || {
        total_units: 0,
        bucket_0_7: 0,
        bucket_8_15: 0,
        bucket_16_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_90_plus: 0,
      },
      branchWise: branchRows || [],
      modelWise: modelRows || [],
      rows: rows || [],
    });
  } catch (error) {
    console.error("getStockAgeingReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock ageing report",
      error: error.message,
    });
  }
};

exports.exportStockAgeingReport = async (req, res) => {
  try {
    const asOnDate = safeDateString(req.query.asOnDate) || safeDateString(new Date());
    const branchId = normalizeString(req.query.branchId);
    const search = normalizeString(req.query.search);
    const status = normalizeString(req.query.status) || "in_stock";

    let where = `
      WHERE 1 = 1
      AND ${STOCK_DATE_EXPR} IS NOT NULL
    `;
    const params = [];

    if (status) {
      where += ` AND vpi.status_code = ? `;
      params.push(status);
    }

    if (branchId) {
      where += ` AND vpi.current_branch_id = ? `;
      params.push(branchId);
    }

    if (search) {
      where += ` AND (
        COALESCE(vpi.chassis_number, '') LIKE ?
        OR COALESCE(vpi.engine_number, '') LIKE ?
        OR COALESCE(vm.model_name, '') LIKE ?
        OR COALESCE(vv.variant_name, '') LIKE ?
        OR COALESCE(vpi.color, '') LIKE ?
        OR COALESCE(s.customer_name, '') LIKE ?
        OR COALESCE(s.mobile_number, '') LIKE ?
      ) `;
      const q = applyLike(search);
      params.push(q, q, q, q, q, q, q);
    }

    const sql = `
      SELECT
        vpi.id AS row_id,
        DATE_FORMAT(${STOCK_DATE_EXPR}, '%Y-%m-%d') AS inward_date,
        COALESCE(sb.branch_name, '') AS branch_name,
        CONCAT_WS(' / ', vm.model_name, vv.variant_name, vpi.color) AS vehicle_name,
        COALESCE(vpi.chassis_number, '') AS chassis_number,
        COALESCE(vpi.engine_number, '') AS engine_number,
        COALESCE(vpi.status_code, '') AS status_code,
        COALESCE(s.customer_name, '') AS customer_name,
        COALESCE(s.mobile_number, '') AS mobile_number,
        COALESCE(DATEDIFF(?, DATE(${STOCK_DATE_EXPR})), 0) AS ageing_days,
        CASE
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 0 AND 7 THEN '0-7 Days'
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 8 AND 15 THEN '8-15 Days'
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 16 AND 30 THEN '16-30 Days'
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 31 AND 60 THEN '31-60 Days'
          WHEN DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) BETWEEN 61 AND 90 THEN '61-90 Days'
          ELSE '90+ Days'
        END AS ageing_bucket
      FROM vehicle_purchase_items vpi
      LEFT JOIN showroom_branches sb ON sb.id = vpi.current_branch_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN sales s ON s.id = vpi.sale_id
      ${where}
      ORDER BY DATEDIFF(?, DATE(${STOCK_DATE_EXPR})) DESC, vpi.id DESC
    `;

    const [rows] = await db.query(sql, [
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      asOnDate,
      ...params,
      asOnDate,
    ]);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Stock Ageing Report");

    worksheet.columns = [
      { header: "ID", key: "row_id", width: 10 },
      { header: "Inward Date", key: "inward_date", width: 14 },
      { header: "Branch", key: "branch_name", width: 18 },
      { header: "Vehicle", key: "vehicle_name", width: 30 },
      { header: "Chassis", key: "chassis_number", width: 24 },
      { header: "Engine", key: "engine_number", width: 24 },
      { header: "Status", key: "status_code", width: 14 },
      { header: "Customer", key: "customer_name", width: 24 },
      { header: "Mobile", key: "mobile_number", width: 16 },
      { header: "Ageing Days", key: "ageing_days", width: 12 },
      { header: "Ageing Bucket", key: "ageing_bucket", width: 14 },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="stock-ageing-report-${asOnDate}.xlsx"`
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("exportStockAgeingReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export stock ageing report",
      error: error.message,
    });
  }
};