const db = require("../db");

function normalizeStr(v) {
  return String(v || "").trim();
}

function parseId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function parseMoney(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function computeTotals({
  subtotal_amount = 0,
  freight_amount = 0,
  loading_amount = 0,
  unloading_amount = 0,
  other_cost_amount = 0,
  discount_amount = 0,
  tax_amount = 0,
}) {
  const subtotal = parseMoney(subtotal_amount);
  const freight = parseMoney(freight_amount);
  const loading = parseMoney(loading_amount);
  const unloading = parseMoney(unloading_amount);
  const other = parseMoney(other_cost_amount);
  const discount = parseMoney(discount_amount);
  const tax = parseMoney(tax_amount);

  const grand = subtotal + freight + loading + unloading + other + tax - discount;

  return {
    subtotal_amount: subtotal,
    freight_amount: freight,
    loading_amount: loading,
    unloading_amount: unloading,
    other_cost_amount: other,
    discount_amount: discount,
    tax_amount: tax,
    grand_total_amount: parseMoney(grand),
  };
}

async function generateNextChallanNumber(conn, challanDate) {
  const year = String(challanDate || "").slice(0, 4) || new Date().getFullYear().toString();
  const prefix = `TR-${year}-`;

  const [rows] = await conn.query(
    `
    SELECT challan_number
    FROM stock_transfer_challans
    WHERE challan_number LIKE ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [`${prefix}%`]
  );

  let nextSeq = 1;

  if (rows.length && rows[0].challan_number) {
    const lastNumber = String(rows[0].challan_number);
    const lastSeq = Number(lastNumber.replace(prefix, ""));
    if (Number.isFinite(lastSeq) && lastSeq > 0) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

async function getBranchById(conn, id) {
  const [rows] = await conn.query(
    `
    SELECT id, branch_name, is_active
    FROM showroom_branches
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );
  return rows?.[0] || null;
}

async function getChallanById(conn, id, { forUpdate = false } = {}) {
  const [rows] = await conn.query(
    `
    SELECT *
    FROM stock_transfer_challans
    WHERE id = ?
    LIMIT 1
    ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [id]
  );
  return rows?.[0] || null;
}

async function getChallanItems(conn, challanId, { forUpdate = false } = {}) {
  const [rows] = await conn.query(
    `
    SELECT
      stci.*,
      vm.model_name,
      vv.variant_name
    FROM stock_transfer_challan_items stci
    LEFT JOIN vehicle_models vm ON vm.id = stci.model_id
    LEFT JOIN vehicle_variants vv ON vv.id = stci.variant_id
    WHERE stci.challan_id = ?
    ORDER BY stci.id ASC
    ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [challanId]
  );
  return rows || [];
}

async function getStockItemForTransfer(conn, stockItemId, { forUpdate = false } = {}) {
  const [rows] = await conn.query(
    `
    SELECT
      vpi.id,
      vpi.purchase_id,
      vpi.model_id,
      vpi.variant_id,
      vpi.color,
      vpi.purchase_price,
      vpi.status_code,
      vpi.sale_id,
      vpi.contact_vehicle_id,
      vpi.current_branch_id,
      vpi.chassis_number,
      vpi.engine_number,
      vm.model_name,
      vv.variant_name,

      (
        SELECT s.id
        FROM sales s
        WHERE s.stock_item_id = vpi.id
          AND COALESCE(s.is_cancelled, 0) = 0
        ORDER BY s.id DESC
        LIMIT 1
      ) AS active_sale_by_stock_id,

      (
        SELECT s2.id
        FROM sales s2
        WHERE s2.contact_vehicle_id = vpi.contact_vehicle_id
          AND COALESCE(s2.is_cancelled, 0) = 0
        ORDER BY s2.id DESC
        LIMIT 1
      ) AS active_sale_by_vehicle_id

    FROM vehicle_purchase_items vpi
    LEFT JOIN vehicle_models vm ON vm.id = vpi.model_id
    LEFT JOIN vehicle_variants vv ON vv.id = vpi.variant_id
    WHERE vpi.id = ?
    LIMIT 1
    ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [stockItemId]
  );
  return rows?.[0] || null;
}

async function refreshChallanTotals(conn, challanId) {
  const [sumRows] = await conn.query(
    `
    SELECT
      COUNT(*) AS total_vehicles,
      COALESCE(SUM(line_amount), 0) AS subtotal_amount
    FROM stock_transfer_challan_items
    WHERE challan_id = ?
    `,
    [challanId]
  );

  const summary = sumRows?.[0] || {};
  const challan = await getChallanById(conn, challanId, { forUpdate: true });
  if (!challan) return null;

  const totals = computeTotals({
    subtotal_amount: summary.subtotal_amount || 0,
    freight_amount: challan.freight_amount || 0,
    loading_amount: challan.loading_amount || 0,
    unloading_amount: challan.unloading_amount || 0,
    other_cost_amount: challan.other_cost_amount || 0,
    discount_amount: challan.discount_amount || 0,
    tax_amount: challan.tax_amount || 0,
  });

  await conn.query(
    `
    UPDATE stock_transfer_challans
    SET
      total_vehicles = ?,
      subtotal_amount = ?,
      freight_amount = ?,
      loading_amount = ?,
      unloading_amount = ?,
      other_cost_amount = ?,
      discount_amount = ?,
      tax_amount = ?,
      grand_total_amount = ?
    WHERE id = ?
    `,
    [
      Number(summary.total_vehicles || 0),
      totals.subtotal_amount,
      totals.freight_amount,
      totals.loading_amount,
      totals.unloading_amount,
      totals.other_cost_amount,
      totals.discount_amount,
      totals.tax_amount,
      totals.grand_total_amount,
      challanId,
    ]
  );

  return true;
}

exports.listChallans = async (req, res) => {
  try {
    const q = normalizeStr(req.query.q);
    const status = normalizeStr(req.query.status);
    const fromBranchId = parseId(req.query.from_branch_id);
    const toBranchId = parseId(req.query.to_branch_id);
    const dateFrom = normalizeStr(req.query.date_from);
    const dateTo = normalizeStr(req.query.date_to);

    const where = ["1=1"];
    const params = [];

    if (q) {
      const like = `%${q}%`;
      where.push(`
        (
          stc.challan_number LIKE ?
          OR stc.transporter_name LIKE ?
          OR stc.vehicle_number LIKE ?
          OR stc.driver_name LIKE ?
          OR stc.driver_mobile LIKE ?
          OR stc.lr_number LIKE ?
        )
      `);
      params.push(like, like, like, like, like, like);
    }

    if (status) {
      where.push(`stc.status = ?`);
      params.push(status);
    }

    if (fromBranchId) {
      where.push(`stc.from_branch_id = ?`);
      params.push(fromBranchId);
    }

    if (toBranchId) {
      where.push(`stc.to_branch_id = ?`);
      params.push(toBranchId);
    }

    if (dateFrom) {
      where.push(`stc.challan_date >= ?`);
      params.push(dateFrom);
    }

    if (dateTo) {
      where.push(`stc.challan_date <= ?`);
      params.push(dateTo);
    }

    const [rows] = await db.query(
      `
      SELECT
        stc.id,
        stc.challan_number,
        stc.challan_date,
        stc.from_branch_id,
        stc.to_branch_id,
        stc.transporter_name,
        stc.vehicle_number,
        stc.driver_name,
        stc.driver_mobile,
        stc.lr_number,
        stc.notes,
        stc.remarks,
        stc.subtotal_amount,
        stc.freight_amount,
        stc.loading_amount,
        stc.unloading_amount,
        stc.other_cost_amount,
        stc.discount_amount,
        stc.tax_amount,
        stc.grand_total_amount,
        stc.total_vehicles,
        stc.status,
        stc.created_by,
        stc.created_at,
        stc.updated_at,
        stc.posted_at,
        stc.posted_by,
        stc.cancelled_at,
        stc.cancelled_by,

        fb.branch_name AS from_branch_name,
        tb.branch_name AS to_branch_name,
        cu.name AS created_by_name,
        pu.name AS posted_by_name,
        xu.name AS cancelled_by_name
      FROM stock_transfer_challans stc
      LEFT JOIN showroom_branches fb ON fb.id = stc.from_branch_id
      LEFT JOIN showroom_branches tb ON tb.id = stc.to_branch_id
      LEFT JOIN users cu ON cu.id = stc.created_by
      LEFT JOIN users pu ON pu.id = stc.posted_by
      LEFT JOIN users xu ON xu.id = stc.cancelled_by
      WHERE ${where.join(" AND ")}
      ORDER BY stc.challan_date DESC, stc.id DESC
      `,
      params
    );

    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error("listChallans error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getChallanById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid challan id" });
    }

    const [headerRows] = await db.query(
      `
      SELECT
        stc.*,
        fb.branch_name AS from_branch_name,
        tb.branch_name AS to_branch_name,
        cu.name AS created_by_name,
        pu.name AS posted_by_name,
        xu.name AS cancelled_by_name
      FROM stock_transfer_challans stc
      LEFT JOIN showroom_branches fb ON fb.id = stc.from_branch_id
      LEFT JOIN showroom_branches tb ON tb.id = stc.to_branch_id
      LEFT JOIN users cu ON cu.id = stc.created_by
      LEFT JOIN users pu ON pu.id = stc.posted_by
      LEFT JOIN users xu ON xu.id = stc.cancelled_by
      WHERE stc.id = ?
      LIMIT 1
      `,
      [id]
    );

    const header = headerRows?.[0];
    if (!header) {
      return res.status(404).json({ success: false, message: "Challan not found" });
    }

    const [items] = await db.query(
      `
      SELECT
        stci.*,
        vm.model_name,
        vv.variant_name
      FROM stock_transfer_challan_items stci
      LEFT JOIN vehicle_models vm ON vm.id = stci.model_id
      LEFT JOIN vehicle_variants vv ON vv.id = stci.variant_id
      WHERE stci.challan_id = ?
      ORDER BY stci.id ASC
      `,
      [id]
    );

    return res.json({
      success: true,
      data: {
        header,
        items: items || [],
      },
    });
  } catch (err) {
    console.error("getChallanById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createChallan = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let challanNumber = normalizeStr(req.body?.challan_number);
    const challanDate = normalizeStr(req.body?.challan_date);
    const fromBranchId = parseId(req.body?.from_branch_id);
    const toBranchId = parseId(req.body?.to_branch_id);

    const transporterName = normalizeStr(req.body?.transporter_name) || null;
    const vehicleNumber = normalizeStr(req.body?.vehicle_number) || null;
    const driverName = normalizeStr(req.body?.driver_name) || null;
    const driverMobile = normalizeStr(req.body?.driver_mobile) || null;
    const lrNumber = normalizeStr(req.body?.lr_number) || null;
    const notes = normalizeStr(req.body?.notes) || null;
    const remarks = normalizeStr(req.body?.remarks) || null;

    const userId = req.user?.id || null;



    if (!challanDate) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "challan_date is required" });
    }

        if (!challanNumber) {
  challanNumber = await generateNextChallanNumber(conn, challanDate);
}

    if (!fromBranchId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "from_branch_id is required" });
    }

    if (!toBranchId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "to_branch_id is required" });
    }

    if (fromBranchId === toBranchId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "From and To branch cannot be same" });
    }

    const fromBranch = await getBranchById(conn, fromBranchId);
    const toBranch = await getBranchById(conn, toBranchId);

    if (!fromBranch) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid from branch" });
    }

    if (!toBranch) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid to branch" });
    }

    const [dup] = await conn.query(
      `
      SELECT id
      FROM stock_transfer_challans
      WHERE challan_number = ?
      LIMIT 1
      `,
      [challanNumber]
    );

    if (dup.length) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Challan number already exists" });
    }

    const totals = computeTotals({
      subtotal_amount: 0,
      freight_amount: req.body?.freight_amount,
      loading_amount: req.body?.loading_amount,
      unloading_amount: req.body?.unloading_amount,
      other_cost_amount: req.body?.other_cost_amount,
      discount_amount: req.body?.discount_amount,
      tax_amount: req.body?.tax_amount,
    });

    const [ins] = await conn.query(
      `
      INSERT INTO stock_transfer_challans
      (
        challan_number,
        challan_date,
        from_branch_id,
        to_branch_id,
        transporter_name,
        vehicle_number,
        driver_name,
        driver_mobile,
        lr_number,
        notes,
        remarks,
        subtotal_amount,
        freight_amount,
        loading_amount,
        unloading_amount,
        other_cost_amount,
        discount_amount,
        tax_amount,
        grand_total_amount,
        total_vehicles,
        status,
        created_by
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        challanNumber,
        challanDate,
        fromBranchId,
        toBranchId,
        transporterName,
        vehicleNumber,
        driverName,
        driverMobile,
        lrNumber,
        notes,
        remarks,
        totals.subtotal_amount,
        totals.freight_amount,
        totals.loading_amount,
        totals.unloading_amount,
        totals.other_cost_amount,
        totals.discount_amount,
        totals.tax_amount,
        totals.grand_total_amount,
        0,
        "draft",
        userId,
      ]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Transfer challan created successfully",
      data: {
        id: ins.insertId,
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("createChallan error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  } finally {
    conn.release();
  }
};

exports.addChallanItem = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const challanId = parseId(req.params.id);
    const stockItemId = parseId(req.body?.stock_item_id);
    const unitAmountInput = req.body?.unit_amount;

    if (!challanId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid challan id" });
    }

    if (!stockItemId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "stock_item_id is required" });
    }

    const challan = await getChallanById(conn, challanId, { forUpdate: true });
    if (!challan) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Challan not found" });
    }

    if (challan.status !== "draft") {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Only draft challan can be edited" });
    }

    const stock = await getStockItemForTransfer(conn, stockItemId, { forUpdate: true });
    if (!stock) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Stock item not found" });
    }

   const stockStatus = String(stock.status_code || "").toLowerCase();

if (stockStatus !== "in_stock") {
  await conn.rollback();
  return res.status(409).json({
    success: false,
    message: `Only in_stock vehicle can be added. Current status: ${stock.status_code}`,
  });
}

if (
  stock.sale_id ||
  stock.active_sale_by_stock_id ||
  stock.active_sale_by_vehicle_id
) {
  await conn.rollback();
  return res.status(409).json({
    success: false,
    message: "Sold vehicle cannot be added in transfer challan",
  });
}

    if (parseId(stock.current_branch_id) !== parseId(challan.from_branch_id)) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Selected stock item does not belong to challan source branch",
      });
    }

    const [dup] = await conn.query(
      `
      SELECT id
      FROM stock_transfer_challan_items
      WHERE challan_id = ? AND stock_item_id = ?
      LIMIT 1
      `,
      [challanId, stockItemId]
    );

    if (dup.length) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Stock item already added in challan" });
    }

    const unitAmount =
      unitAmountInput != null && String(unitAmountInput).trim() !== ""
        ? parseMoney(unitAmountInput)
        : parseMoney(stock.purchase_price || 0);

    await conn.query(
      `
      INSERT INTO stock_transfer_challan_items
      (
        challan_id,
        stock_item_id,
        model_id,
        variant_id,
        color,
        chassis_number,
        engine_number,
        unit_amount,
        line_amount
      )
      VALUES (?,?,?,?,?,?,?,?,?)
      `,
      [
        challanId,
        stockItemId,
        stock.model_id || null,
        stock.variant_id || null,
        stock.color || null,
        stock.chassis_number || null,
        stock.engine_number || null,
        unitAmount,
        unitAmount,
      ]
    );

    await refreshChallanTotals(conn, challanId);
    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Stock item added to challan",
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("addChallanItem error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  } finally {
    conn.release();
  }
};

exports.removeChallanItem = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const challanId = parseId(req.params.id);
    const itemId = parseId(req.params.itemId);

    if (!challanId || !itemId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid challan/item id" });
    }

    const challan = await getChallanById(conn, challanId, { forUpdate: true });
    if (!challan) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Challan not found" });
    }

    if (challan.status !== "draft") {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Only draft challan can be edited" });
    }

    const [del] = await conn.query(
      `
      DELETE FROM stock_transfer_challan_items
      WHERE id = ? AND challan_id = ?
      `,
      [itemId, challanId]
    );

    if (!del.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Challan item not found" });
    }

    await refreshChallanTotals(conn, challanId);
    await conn.commit();

    return res.json({
      success: true,
      message: "Challan item removed successfully",
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("removeChallanItem error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  } finally {
    conn.release();
  }
};

exports.postChallan = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const challanId = parseId(req.params.id);
    const userId = req.user?.id || null;

    if (!challanId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid challan id" });
    }

    const challan = await getChallanById(conn, challanId, { forUpdate: true });
    if (!challan) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Challan not found" });
    }

    if (challan.status !== "draft") {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Only draft challan can be posted" });
    }

    const items = await getChallanItems(conn, challanId, { forUpdate: true });
    if (!items.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Cannot post empty challan" });
    }

    for (const item of items) {
      const stock = await getStockItemForTransfer(conn, item.stock_item_id, { forUpdate: true });
      if (!stock) {
        await conn.rollback();
        return res.status(404).json({
          success: false,
          message: `Stock item not found: ${item.stock_item_id}`,
        });
      }

     const stockStatus = String(stock.status_code || "").toLowerCase();

if (stockStatus !== "in_stock") {
  await conn.rollback();
  return res.status(409).json({
    success: false,
    message: `Stock item ${item.stock_item_id} is not in stock`,
  });
}

if (
  stock.sale_id ||
  stock.active_sale_by_stock_id ||
  stock.active_sale_by_vehicle_id
) {
  await conn.rollback();
  return res.status(409).json({
    success: false,
    message: `Stock item ${item.stock_item_id} is already sold and cannot be transferred`,
  });
}

      if (parseId(stock.current_branch_id) !== parseId(challan.from_branch_id)) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          message: `Stock item ${item.stock_item_id} is not in source branch`,
        });
      }

      await conn.query(
        `
        UPDATE vehicle_purchase_items
        SET current_branch_id = ?
        WHERE id = ?
        `,
        [challan.to_branch_id, item.stock_item_id]
      );

      await conn.query(
        `
        INSERT INTO stock_transfers
        (
          challan_id,
          stock_item_id,
          from_branch_id,
          to_branch_id,
          transfer_date,
          notes,
          created_by
        )
        VALUES (?, ?, ?, ?, NOW(), ?, ?)
        `,
        [
          challanId,
          item.stock_item_id,
          challan.from_branch_id,
          challan.to_branch_id,
          challan.notes || null,
          userId,
        ]
      );
    }

    await refreshChallanTotals(conn, challanId);

    await conn.query(
      `
      UPDATE stock_transfer_challans
      SET
        status = 'posted',
        posted_at = NOW(),
        posted_by = ?
      WHERE id = ?
      `,
      [userId, challanId]
    );

    await conn.commit();

    return res.json({
      success: true,
      message: "Challan posted successfully",
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("postChallan error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  } finally {
    conn.release();
  }
};

exports.cancelChallan = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const challanId = parseId(req.params.id);
    const cancelReason = normalizeStr(req.body?.cancel_reason) || null;
    const userId = req.user?.id || null;

    if (!challanId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid challan id" });
    }

    const challan = await getChallanById(conn, challanId, { forUpdate: true });
    if (!challan) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Challan not found" });
    }

    if (challan.status !== "draft") {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Only draft challan can be cancelled",
      });
    }

    await conn.query(
      `
      UPDATE stock_transfer_challans
      SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = ?,
        cancel_reason = ?
      WHERE id = ?
      `,
      [userId, cancelReason, challanId]
    );

    await conn.commit();

    return res.json({
      success: true,
      message: "Challan cancelled successfully",
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("cancelChallan error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  } finally {
    conn.release();
  }
};

exports.getNextChallanNumber = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const challanDate = normalizeStr(req.query.challan_date) || new Date().toISOString().slice(0, 10);
    const challanNumber = await generateNextChallanNumber(conn, challanDate);

    return res.json({
      success: true,
      data: {
        challan_number: challanNumber,
      },
    });
  } catch (err) {
    console.error("getNextChallanNumber error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
};

exports.exportChallanItems = async (req, res) => {
  try {
    const dateFrom = normalizeStr(req.query.date_from);
    const dateTo = normalizeStr(req.query.date_to);
    const fromBranchId = parseId(req.query.from_branch_id);
    const toBranchId = parseId(req.query.to_branch_id);
    const status = normalizeStr(req.query.status);

    const where = ["1=1"];
    const params = [];

    if (dateFrom) {
      where.push("stc.challan_date >= ?");
      params.push(dateFrom);
    }

    if (dateTo) {
      where.push("stc.challan_date <= ?");
      params.push(dateTo);
    }

    if (fromBranchId) {
      where.push("stc.from_branch_id = ?");
      params.push(fromBranchId);
    }

    if (toBranchId) {
      where.push("stc.to_branch_id = ?");
      params.push(toBranchId);
    }

    if (status) {
      where.push("stc.status = ?");
      params.push(status);
    }

    const [rows] = await db.query(
      `
      SELECT
        stc.id AS challan_id,
        stc.challan_number,
        stc.challan_date,
        stc.status,
        fb.branch_name AS from_branch_name,
        tb.branch_name AS to_branch_name,
        stc.transporter_name,
        stc.vehicle_number,
        stc.driver_name,
        stc.driver_mobile,
        stc.lr_number,
        stc.notes,
        stc.remarks,

        stci.id AS challan_item_id,
        stci.stock_item_id,
        stci.color,
        stci.chassis_number,
        stci.engine_number,
        stci.unit_amount,
        stci.line_amount,

        vm.model_name,
        vv.variant_name
      FROM stock_transfer_challans stc
      INNER JOIN stock_transfer_challan_items stci
        ON stci.challan_id = stc.id
      LEFT JOIN showroom_branches fb
        ON fb.id = stc.from_branch_id
      LEFT JOIN showroom_branches tb
        ON tb.id = stc.to_branch_id
      LEFT JOIN vehicle_models vm
        ON vm.id = stci.model_id
      LEFT JOIN vehicle_variants vv
        ON vv.id = stci.variant_id
      WHERE ${where.join(" AND ")}
      ORDER BY stc.challan_date DESC, stc.id DESC, stci.id ASC
      `,
      params
    );

    return res.json({
      success: true,
      data: rows || [],
    });
  } catch (err) {
    console.error("exportChallanItems error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.updateChallan = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const challanId = parseId(req.params.id);
    if (!challanId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid challan id" });
    }

    const challan = await getChallanById(conn, challanId, { forUpdate: true });
    if (!challan) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Challan not found" });
    }

    if (String(challan.status || "").toLowerCase() !== "draft") {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Only draft challan can be edited",
      });
    }

    const challanDate = normalizeStr(req.body?.challan_date) || challan.challan_date;
    const fromBranchId = parseId(req.body?.from_branch_id) || parseId(challan.from_branch_id);
    const toBranchId = parseId(req.body?.to_branch_id) || parseId(challan.to_branch_id);

    const transporterName = normalizeStr(req.body?.transporter_name) || null;
    const vehicleNumber = normalizeStr(req.body?.vehicle_number) || null;
    const driverName = normalizeStr(req.body?.driver_name) || null;
    const driverMobile = normalizeStr(req.body?.driver_mobile) || null;
    const lrNumber = normalizeStr(req.body?.lr_number) || null;
    const notes = normalizeStr(req.body?.notes) || null;
    const remarks = normalizeStr(req.body?.remarks) || null;

    if (!challanDate) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "challan_date is required" });
    }

    if (!fromBranchId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "from_branch_id is required" });
    }

    if (!toBranchId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "to_branch_id is required" });
    }

    if (fromBranchId === toBranchId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "From and To branch cannot be same" });
    }

    const fromBranch = await getBranchById(conn, fromBranchId);
    const toBranch = await getBranchById(conn, toBranchId);

    if (!fromBranch) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid from branch" });
    }

    if (!toBranch) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid to branch" });
    }

    const [sumRows] = await conn.query(
      `
      SELECT
        COUNT(*) AS total_vehicles,
        COALESCE(SUM(line_amount), 0) AS subtotal_amount
      FROM stock_transfer_challan_items
      WHERE challan_id = ?
      `,
      [challanId]
    );

    const summary = sumRows?.[0] || {};

    const totals = computeTotals({
      subtotal_amount: summary.subtotal_amount || 0,
      freight_amount: req.body?.freight_amount,
      loading_amount: req.body?.loading_amount,
      unloading_amount: req.body?.unloading_amount,
      other_cost_amount: req.body?.other_cost_amount,
      discount_amount: req.body?.discount_amount,
      tax_amount: req.body?.tax_amount,
    });

    await conn.query(
      `
      UPDATE stock_transfer_challans
      SET
        challan_date = ?,
        from_branch_id = ?,
        to_branch_id = ?,
        transporter_name = ?,
        vehicle_number = ?,
        driver_name = ?,
        driver_mobile = ?,
        lr_number = ?,
        notes = ?,
        remarks = ?,
        subtotal_amount = ?,
        freight_amount = ?,
        loading_amount = ?,
        unloading_amount = ?,
        other_cost_amount = ?,
        discount_amount = ?,
        tax_amount = ?,
        grand_total_amount = ?,
        total_vehicles = ?
      WHERE id = ?
      `,
      [
        challanDate,
        fromBranchId,
        toBranchId,
        transporterName,
        vehicleNumber,
        driverName,
        driverMobile,
        lrNumber,
        notes,
        remarks,
        totals.subtotal_amount,
        totals.freight_amount,
        totals.loading_amount,
        totals.unloading_amount,
        totals.other_cost_amount,
        totals.discount_amount,
        totals.tax_amount,
        totals.grand_total_amount,
        Number(summary.total_vehicles || 0),
        challanId,
      ]
    );

    await conn.commit();

    return res.json({
      success: true,
      message: "Challan updated successfully",
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("updateChallan error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Server error",
    });
  } finally {
    conn.release();
  }
};