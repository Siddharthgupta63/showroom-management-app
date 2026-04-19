const db = require("../db");

exports.getPurchaseVsSales = async (req, res) => {
  try {
    const { from, to, branchId, model } = req.query;

    // ---------------- SALES FILTER ----------------
    const salesFilters = [];
    const salesParams = [];

    if (from) {
      salesFilters.push("DATE(s.sale_date) >= ?");
      salesParams.push(from);
    }

    if (to) {
      salesFilters.push("DATE(s.sale_date) <= ?");
      salesParams.push(to);
    }

    if (branchId) {
      salesFilters.push("s.branch_id = ?");
      salesParams.push(branchId);
    }

    if (model) {
      salesFilters.push("COALESCE(s.vehicle_model, '') LIKE ?");
      salesParams.push(`%${model}%`);
    }

    const salesWhere = salesFilters.length
      ? `WHERE ${salesFilters.join(" AND ")}`
      : "";

    // ---------------- PURCHASE FILTER ----------------
    const purchaseFilters = [];
    const purchaseParams = [];

    if (from) {
      purchaseFilters.push("DATE(COALESCE(vpi.inward_date, vpi.created_at)) >= ?");
      purchaseParams.push(from);
    }

    if (to) {
      purchaseFilters.push("DATE(COALESCE(vpi.inward_date, vpi.created_at)) <= ?");
      purchaseParams.push(to);
    }

    if (branchId) {
      purchaseFilters.push("vpi.current_branch_id = ?");
      purchaseParams.push(branchId);
    }

    if (model) {
      purchaseFilters.push("COALESCE(vm.model_name, '') LIKE ?");
      purchaseParams.push(`%${model}%`);
    }

    const purchaseWhere = purchaseFilters.length
      ? `WHERE ${purchaseFilters.join(" AND ")}`
      : "";

    // ---------------- SUMMARY ----------------
    const [salesSummary] = await db.query(
      `
      SELECT 
        COUNT(*) AS sale_count,
        COALESCE(SUM(s.sale_price), 0) AS sale_amount
      FROM sales s
      ${salesWhere}
      `,
      salesParams
    );

    const [purchaseSummary] = await db.query(
      `
      SELECT 
        COUNT(*) AS purchase_count,
        COALESCE(SUM(vpi.purchase_price), 0) AS purchase_amount
      FROM vehicle_purchase_items vpi
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      ${purchaseWhere}
      `,
      purchaseParams
    );

    // ---------------- TREND ----------------
    const [salesTrend] = await db.query(
      `
      SELECT 
        DATE(s.sale_date) AS date,
        COUNT(*) AS sales
      FROM sales s
      ${salesWhere}
      GROUP BY DATE(s.sale_date)
      ORDER BY DATE(s.sale_date)
      `,
      salesParams
    );

    const [purchaseTrend] = await db.query(
      `
      SELECT 
        DATE(COALESCE(vpi.inward_date, vpi.created_at)) AS date,
        COUNT(*) AS purchase
      FROM vehicle_purchase_items vpi
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      ${purchaseWhere}
      GROUP BY DATE(COALESCE(vpi.inward_date, vpi.created_at))
      ORDER BY DATE(COALESCE(vpi.inward_date, vpi.created_at))
      `,
      purchaseParams
    );

    const trendMap = {};

    salesTrend.forEach((r) => {
      const d = String(r.date).slice(0, 10);
      if (!trendMap[d]) trendMap[d] = { date: d, sales: 0, purchase: 0 };
      trendMap[d].sales = Number(r.sales || 0);
    });

    purchaseTrend.forEach((r) => {
      const d = String(r.date).slice(0, 10);
      if (!trendMap[d]) trendMap[d] = { date: d, sales: 0, purchase: 0 };
      trendMap[d].purchase = Number(r.purchase || 0);
    });

    const trend = Object.values(trendMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // ---------------- BRANCH ----------------
    const [branchSales] = await db.query(
      `
      SELECT 
        COALESCE(sb.branch_name, 'Unknown') AS branch,
        COUNT(*) AS sales
      FROM sales s
      LEFT JOIN showroom_branches sb ON sb.id = s.branch_id
      ${salesWhere}
      GROUP BY COALESCE(sb.branch_name, 'Unknown')
      ORDER BY sales DESC
      `,
      salesParams
    );

    const [branchPurchase] = await db.query(
      `
      SELECT 
        COALESCE(sb.branch_name, 'Unknown') AS branch,
        COUNT(*) AS purchase
      FROM vehicle_purchase_items vpi
      LEFT JOIN showroom_branches sb ON sb.id = vpi.current_branch_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      ${purchaseWhere}
      GROUP BY COALESCE(sb.branch_name, 'Unknown')
      ORDER BY purchase DESC
      `,
      purchaseParams
    );

    const branchMap = {};

    branchSales.forEach((r) => {
      const key = r.branch || "Unknown";
      if (!branchMap[key]) {
        branchMap[key] = { branch: key, sales: 0, purchase: 0 };
      }
      branchMap[key].sales = Number(r.sales || 0);
    });

    branchPurchase.forEach((r) => {
      const key = r.branch || "Unknown";
      if (!branchMap[key]) {
        branchMap[key] = { branch: key, sales: 0, purchase: 0 };
      }
      branchMap[key].purchase = Number(r.purchase || 0);
    });

    const branchWise = Object.values(branchMap).sort(
      (a, b) => b.purchase + b.sales - (a.purchase + a.sales)
    );

    // ---------------- MODEL ----------------
    const [modelSales] = await db.query(
      `
      SELECT 
        COALESCE(s.vehicle_model, 'Unknown') AS model,
        COUNT(*) AS sales
      FROM sales s
      ${salesWhere}
      GROUP BY COALESCE(s.vehicle_model, 'Unknown')
      ORDER BY sales DESC
      `,
      salesParams
    );

    const [modelPurchase] = await db.query(
      `
      SELECT 
        COALESCE(vm.model_name, 'Unknown') AS model,
        COUNT(*) AS purchase
      FROM vehicle_purchase_items vpi
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      ${purchaseWhere}
      GROUP BY COALESCE(vm.model_name, 'Unknown')
      ORDER BY purchase DESC
      `,
      purchaseParams
    );

    const modelMap = {};

    modelSales.forEach((r) => {
      const key = r.model || "Unknown";
      if (!modelMap[key]) {
        modelMap[key] = { model: key, sales: 0, purchase: 0 };
      }
      modelMap[key].sales = Number(r.sales || 0);
    });

    modelPurchase.forEach((r) => {
      const key = r.model || "Unknown";
      if (!modelMap[key]) {
        modelMap[key] = { model: key, sales: 0, purchase: 0 };
      }
      modelMap[key].purchase = Number(r.purchase || 0);
    });

    const modelWise = Object.values(modelMap).sort(
      (a, b) => b.purchase + b.sales - (a.purchase + a.sales)
    );

    return res.json({
      success: true,
      summary: {
        purchase_count: Number(purchaseSummary[0]?.purchase_count || 0),
        purchase_amount: Number(purchaseSummary[0]?.purchase_amount || 0),
        sale_count: Number(salesSummary[0]?.sale_count || 0),
        sale_amount: Number(salesSummary[0]?.sale_amount || 0),
      },
      trend,
      branchWise,
      modelWise,
      data: {
        summary: {
          purchase_count: Number(purchaseSummary[0]?.purchase_count || 0),
          purchase_amount: Number(purchaseSummary[0]?.purchase_amount || 0),
          sale_count: Number(salesSummary[0]?.sale_count || 0),
          sale_amount: Number(salesSummary[0]?.sale_amount || 0),
        },
        trend,
        branchWise,
        modelWise,
      },
    });
  } catch (error) {
    console.error("Purchase vs Sales Controller Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate report",
      message: error.message,
    });
  }
};