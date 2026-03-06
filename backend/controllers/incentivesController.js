// controllers/incentivesController.js

const db = require("../db");

// --------------------------------------------------
// CREATE incentive
// POST /api/incentives
// --------------------------------------------------
exports.createIncentive = async (req, res) => {
  try {
    const {
      title,
      description,
      incentive_type,
      amount,
      start_date,
      end_date,
      is_active,
    } = req.body;

    const created_by = req.user.id || null;

    const insertQuery = `
      INSERT INTO incentives
        (title, description, incentive_type, amount,
         start_date, end_date, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(insertQuery, [
      title,
      description,
      incentive_type,
      amount,
      start_date,
      end_date,
      is_active ? 1 : 0,
      created_by,
    ]);

    return res.status(201).json({
      message: 'Incentive created',
      incentiveId: result.insertId,
    });
  } catch (err) {
    console.error('createIncentive error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------
// GET incentives (optionally filter by active)
// GET /api/incentives
// --------------------------------------------------
exports.getIncentives = async (req, res) => {
  try {
    const { active } = req.query;

    let sql = 'SELECT * FROM incentives';
    const params = [];

    if (active === 'true') {
      sql += ' WHERE is_active = 1';
    } else if (active === 'false') {
      sql += ' WHERE is_active = 0';
    }

    const [rows] = await db.query(sql, params);

    return res.json({ incentives: rows });
  } catch (err) {
    console.error('getIncentives error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------
// UPDATE incentive
// PUT /api/incentives/:id
// --------------------------------------------------
exports.updateIncentive = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      title,
      description,
      incentive_type,
      amount,
      start_date,
      end_date,
      is_active,
    } = req.body;

    const [existing] = await db.query(
      'SELECT id FROM incentives WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Incentive not found' });
    }

    const updateQuery = `
      UPDATE incentives SET
        title = ?,
        description = ?,
        incentive_type = ?,
        amount = ?,
        start_date = ?,
        end_date = ?,
        is_active = ?
      WHERE id = ?
    `;

    await db.query(updateQuery, [
      title,
      description,
      incentive_type,
      amount,
      start_date,
      end_date,
      is_active ? 1 : 0,
      id,
    ]);

    return res.json({
      message: 'Incentive updated',
      id,
    });
  } catch (err) {
    console.error('updateIncentive error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------
// DELETE incentive
// DELETE /api/incentives/:id
// --------------------------------------------------
exports.deleteIncentive = async (req, res) => {
  try {
    const id = req.params.id;

    const [existing] = await db.query(
      'SELECT id FROM incentives WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Incentive not found' });
    }

    await db.query('DELETE FROM incentives WHERE id = ?', [id]);

    return res.json({
      message: 'Incentive deleted',
      id,
    });
  } catch (err) {
    console.error('deleteIncentive error:', err);
    return res.status(500).json({ error: err.message });
  }
};
