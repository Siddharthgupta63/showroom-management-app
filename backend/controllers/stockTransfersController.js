const db = require("../db");

function normalizeStr(v) {
  return String(v || "").trim();
}

function parseId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

async function getBranchById(conn, id, { forUpdate = false } = {}) {
  const [rows] = await conn.query(
    `
    SELECT id, branch_name, is_active
    FROM showroom_branches
    WHERE id = ?
    LIMIT 1
    ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [id]
  );
  return rows?.[0] || null;
}

async function getStockItemForTransfer(conn, stockItemId) {
  const [rows] = await conn.query(
    `
    SELECT
      vpi.id,
      vpi.status_code,
      vpi.sale_id,
      vpi.current_branch_id,
      vpi.chassis_number,
      vpi.engine_number,
      vm.model_name,
      vv.variant_name
    FROM vehicle_purchase_items vpi
    LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
    LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
    WHERE vpi.id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [stockItemId]
  );
  return rows?.[0] || null;
}

exports.createTransfer = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const stockItemId = parseId(req.body?.stock_item_id);
    const toBranchId = parseId(req.body?.to_branch_id);
    const notes = normalizeStr(req.body?.notes) || null;
    const transferDate = normalizeStr(req.body?.transfer_date) || null;
    const userId = req.user?.id || null;

    if (!stockItemId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "stock_item_id is required" });
    }

    if (!toBranchId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "to_branch_id is required" });
    }

    const stock = await getStockItemForTransfer(conn, stockItemId);
    if (!stock) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Stock item not found" });
    }

    const fromBranchId = parseId(stock.current_branch_id);
    if (!fromBranchId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Current branch is missing on stock item" });
    }

    if (Number(fromBranchId) === Number(toBranchId)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "From and To branch cannot be same" });
    }

    const fromBranch = await getBranchById(conn, fromBranchId, { forUpdate: true });
    const toBranch = await getBranchById(conn, toBranchId, { forUpdate: true });

    if (!fromBranch) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid current branch" });
    }

    if (!toBranch) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid destination branch" });
    }

    const status = String(stock.status_code || "").toLowerCase();

    if (status !== "in_stock") {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: `Only in_stock vehicle can be transferred. Current status: ${stock.status_code}`,
      });
    }

    if (stock.sale_id) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Sold/linked stock cannot be transferred",
      });
    }

    await conn.query(
      `
      UPDATE vehicle_purchase_items
      SET current_branch_id = ?
      WHERE id = ?
      `,
      [toBranchId, stockItemId]
    );

    const [ins] = await conn.query(
      `
      INSERT INTO stock_transfers
      (
        stock_item_id,
        from_branch_id,
        to_branch_id,
        transfer_date,
        notes,
        created_by
      )
      VALUES (?, ?, ?, COALESCE(?, NOW()), ?, ?)
      `,
      [stockItemId, fromBranchId, toBranchId, transferDate, notes, userId]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Stock transferred successfully",
      data: {
        id: ins.insertId,
        stock_item_id: stockItemId,
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("createTransfer error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Server error",
    });
  } finally {
    conn.release();
  }
};

exports.listTransfers = async (req, res) => {
  try {
    const stockItemId = parseId(req.query.stock_item_id);
    const fromBranchId = parseId(req.query.from_branch_id);
    const toBranchId = parseId(req.query.to_branch_id);

    const where = ["1=1"];
    const params = [];

    if (stockItemId) {
      where.push("st.stock_item_id = ?");
      params.push(stockItemId);
    }

    if (fromBranchId) {
      where.push("st.from_branch_id = ?");
      params.push(fromBranchId);
    }

    if (toBranchId) {
      where.push("st.to_branch_id = ?");
      params.push(toBranchId);
    }

    const [rows] = await db.query(
      `
      SELECT
        st.id,
        st.stock_item_id,
        st.from_branch_id,
        st.to_branch_id,
        st.transfer_date,
        st.notes,
        st.created_by,
        st.created_at,

        fb.branch_name AS from_branch_name,
        tb.branch_name AS to_branch_name,
        u.name AS created_by_name,

        vpi.chassis_number,
        vpi.engine_number,
        vm.model_name,
        vv.variant_name
      FROM stock_transfers st
      INNER JOIN vehicle_purchase_items vpi ON vpi.id = st.stock_item_id
      LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
      LEFT JOIN showroom_branches fb ON fb.id = st.from_branch_id
      LEFT JOIN showroom_branches tb ON tb.id = st.to_branch_id
      LEFT JOIN users u ON u.id = st.created_by
      WHERE ${where.join(" AND ")}
      ORDER BY st.transfer_date DESC, st.id DESC
      `,
      params
    );

    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error("listTransfers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getTransferHistory = async (req, res) => {
  try {
    const stockItemId = parseId(req.params.stockItemId);
    if (!stockItemId) {
      return res.status(400).json({ success: false, message: "Invalid stock item id" });
    }

    const [rows] = await db.query(
      `
      SELECT
        st.id,
        st.stock_item_id,
        st.from_branch_id,
        st.to_branch_id,
        st.transfer_date,
        st.notes,
        st.created_at,
        st.created_by,
        fb.branch_name AS from_branch_name,
        tb.branch_name AS to_branch_name,
        u.name AS created_by_name
      FROM stock_transfers st
      LEFT JOIN showroom_branches fb ON fb.id = st.from_branch_id
      LEFT JOIN showroom_branches tb ON tb.id = st.to_branch_id
      LEFT JOIN users u ON u.id = st.created_by
      WHERE st.stock_item_id = ?
      ORDER BY st.transfer_date DESC, st.id DESC
      `,
      [stockItemId]
    );

    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error("getTransferHistory error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};