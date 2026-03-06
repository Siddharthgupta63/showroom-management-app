// controllers/renewalController.js

const db = require("../db");

// --------------------------------------------------
// CREATE a renewal record for a sale
// POST /api/renewal/:sale_id
// --------------------------------------------------
exports.createRenewal = async (req, res) => {
  try {
    const sale_id = req.params.sale_id;

    const {
      renewal_type,
      company,
      policy_number,
      invoice_number,
      premium_amount,
      renewal_date,
      notes,
    } = req.body;

    const renewal_file = req.file ? req.file.filename : null;
    const uploaded_by = req.user.id;

    // Ensure sale exists
    const [sale] = await db.query(
      'SELECT id FROM sales WHERE id = ?',
      [sale_id]
    );

    if (sale.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    // Check if renewal already exists for this sale
    const [existing] = await db.query(
      'SELECT id FROM renewal WHERE sale_id = ?',
      [sale_id]
    );

    if (existing.length > 0) {
      return res
        .status(400)
        .json({ message: 'Renewal already exists — use UPDATE instead' });
    }

    const insertQuery = `
      INSERT INTO renewal
        (sale_id, renewal_type, company, policy_number, invoice_number,
         premium_amount, renewal_date, renewal_uploaded_by, renewal_file, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(insertQuery, [
      sale_id,
      renewal_type,
      company,
      policy_number,
      invoice_number,
      premium_amount,
      renewal_date,
      uploaded_by,
      renewal_file,
      notes,
    ]);

    return res.status(201).json({
      message: 'Renewal created',
      renewalId: result.insertId,
    });
  } catch (err) {
    console.error('createRenewal error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------
// GET renewal details for a sale
// GET /api/renewal/:sale_id
// --------------------------------------------------
exports.getRenewal = async (req, res) => {
  try {
    const sale_id = req.params.sale_id;

    const [renewal] = await db.query(
      'SELECT * FROM renewal WHERE sale_id = ?',
      [sale_id]
    );

    if (renewal.length === 0) {
      return res
        .status(404)
        .json({ message: 'No renewal record for this sale' });
    }

    return res.json({ renewal: renewal[0] });
  } catch (err) {
    console.error('getRenewal error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------
// UPDATE renewal details for a sale
// PUT /api/renewal/:sale_id
// --------------------------------------------------
exports.updateRenewal = async (req, res) => {
  try {
    const sale_id = req.params.sale_id;

    const {
      renewal_type,
      company,
      policy_number,
      invoice_number,
      premium_amount,
      renewal_date,
      notes,
    } = req.body;

    // Check existing record
    const [existing] = await db.query(
      'SELECT * FROM renewal WHERE sale_id = ?',
      [sale_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: 'Cannot update — renewal record not found',
      });
    }

    const renewal_file = req.file
      ? req.file.filename
      : existing[0].renewal_file;

    const uploaded_by = req.user.id;

    const updateQuery = `
      UPDATE renewal SET
        renewal_type = ?,
        company = ?,
        policy_number = ?,
        invoice_number = ?,
        premium_amount = ?,
        renewal_date = ?,
        renewal_uploaded_by = ?,
        renewal_file = ?,
        notes = ?
      WHERE sale_id = ?
    `;

    await db.query(updateQuery, [
      renewal_type,
      company,
      policy_number,
      invoice_number,
      premium_amount,
      renewal_date,
      uploaded_by,
      renewal_file,
      notes,
      sale_id,
    ]);

    return res.json({
      message: 'Renewal updated',
      sale_id,
    });
  } catch (err) {
    console.error('updateRenewal error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------
// DELETE renewal record for a sale
// DELETE /api/renewal/:sale_id
// --------------------------------------------------
exports.deleteRenewal = async (req, res) => {
  try {
    const sale_id = req.params.sale_id;

    const [existing] = await db.query(
      'SELECT id FROM renewal WHERE sale_id = ?',
      [sale_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Renewal not found' });
    }

    await db.query('DELETE FROM renewal WHERE sale_id = ?', [sale_id]);

    return res.json({
      message: 'Renewal deleted',
      sale_id,
    });
  } catch (err) {
    console.error('deleteRenewal error:', err);
    return res.status(500).json({ error: err.message });
  }
};
