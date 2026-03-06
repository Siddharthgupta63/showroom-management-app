// controllers/rcController.js

const db = require("../db");

// GET /api/rc
// Optional query params: ?page=1&pageSize=20&status=pending
const getRCs = async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const pageSize = parseInt(req.query.pageSize || '20', 10);
  const offset = (page - 1) * pageSize;
  const status = req.query.status || null;

  try {
    const whereClause = status ? 'WHERE status = ?' : '';
    const params = status ? [status, pageSize, offset] : [pageSize, offset];

    const [rows] = await db.query(
      `SELECT
         id,
         owner_name,
         vehicle_no,
         rc_no,
         status,
         issue_date,
         created_by,
         created_at
       FROM rc
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM rc ${status ? 'WHERE status = ?' : ''}`,
      status ? [status] : []
    );

    const total = countRows[0]?.total || 0;

    return res.json({
      data: rows,
      page,
      pageSize,
      total,
    });
  } catch (err) {
    console.error('getRCs error:', err);
    return res.status(500).json({ message: 'Server error fetching RC records' });
  }
};

// POST /api/rc
// Body: { owner_name, vehicle_no, rc_no, issue_date, status }
const createRC = async (req, res) => {
  const {
    owner_name,
    vehicle_no,
    rc_no,
    issue_date,
    status = 'active',
  } = req.body;

  if (!owner_name || !vehicle_no || !rc_no || !issue_date) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const createdBy = req.user?.id || null;

    const [result] = await db.query(
      `INSERT INTO rc
        (owner_name, vehicle_no, rc_no, issue_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [owner_name, vehicle_no, rc_no, issue_date, status, createdBy]
    );

    return res.status(201).json({
      id: result.insertId,
      owner_name,
      vehicle_no,
      rc_no,
      issue_date,
      status,
      created_by: createdBy,
    });
  } catch (err) {
    console.error('createRC error:', err);
    return res.status(500).json({ message: 'Server error creating RC record' });
  }
};

// PUT /api/rc/:id
// Body may update: { owner_name, vehicle_no, rc_no, issue_date, status }
const updateRC = async (req, res) => {
  const { id } = req.params;
  const {
    owner_name,
    vehicle_no,
    rc_no,
    issue_date,
    status,
  } = req.body;

  if (!owner_name || !vehicle_no || !rc_no || !issue_date || !status) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [result] = await db.query(
      `UPDATE rc
       SET owner_name = ?, vehicle_no = ?, rc_no = ?, issue_date = ?, status = ?
       WHERE id = ?`,
      [owner_name, vehicle_no, rc_no, issue_date, status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'RC record not found' });
    }

    return res.json({
      id: Number(id),
      owner_name,
      vehicle_no,
      rc_no,
      issue_date,
      status,
    });
  } catch (err) {
    console.error('updateRC error:', err);
    return res.status(500).json({ message: 'Server error updating RC record' });
  }
};

// DELETE /api/rc/:id
const deleteRC = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `DELETE FROM rc WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'RC record not found' });
    }

    return res.json({ message: 'RC record deleted successfully' });
  } catch (err) {
    console.error('deleteRC error:', err);
    return res.status(500).json({ message: 'Server error deleting RC record' });
  }
};

module.exports = {
  getRCs,
  createRC,
  updateRC,
  deleteRC,
};
