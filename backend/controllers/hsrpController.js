// controllers/hsrpController.js

const db = require("../db");

// GET /api/hsrp
// Optional query params: ?page=1&pageSize=20&status=pending
const getHSRPRequests = async (req, res) => {
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
         order_no,
         status,
         appointment_date,
         created_by,
         created_at
       FROM hsrp
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM hsrp ${status ? 'WHERE status = ?' : ''}`,
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
    console.error('getHSRPRequests error:', err);
    return res
      .status(500)
      .json({ message: 'Server error fetching HSRP requests' });
  }
};

// POST /api/hsrp
// Body: { owner_name, vehicle_no, order_no, appointment_date, status }
const createHSRPRequest = async (req, res) => {
  const {
    owner_name,
    vehicle_no,
    order_no,
    appointment_date,
    status = 'pending',
  } = req.body;

  if (!owner_name || !vehicle_no || !order_no || !appointment_date) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const createdBy = req.user?.id || null;

    const [result] = await db.query(
      `INSERT INTO hsrp 
        (owner_name, vehicle_no, order_no, appointment_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [owner_name, vehicle_no, order_no, appointment_date, status, createdBy]
    );

    return res.status(201).json({
      id: result.insertId,
      owner_name,
      vehicle_no,
      order_no,
      appointment_date,
      status,
      created_by: createdBy,
    });
  } catch (err) {
    console.error('createHSRPRequest error:', err);
    return res
      .status(500)
      .json({ message: 'Server error creating HSRP request' });
  }
};

// PUT /api/hsrp/:id
// Body may update: { owner_name, vehicle_no, order_no, appointment_date, status }
const updateHSRPRequest = async (req, res) => {
  const { id } = req.params;
  const {
    owner_name,
    vehicle_no,
    order_no,
    appointment_date,
    status,
  } = req.body;

  if (!owner_name || !vehicle_no || !order_no || !appointment_date || !status) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [result] = await db.query(
      `UPDATE hsrp
       SET owner_name = ?, vehicle_no = ?, order_no = ?, appointment_date = ?, status = ?
       WHERE id = ?`,
      [owner_name, vehicle_no, order_no, appointment_date, status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'HSRP request not found' });
    }

    return res.json({
      id: Number(id),
      owner_name,
      vehicle_no,
      order_no,
      appointment_date,
      status,
    });
  } catch (err) {
    console.error('updateHSRPRequest error:', err);
    return res
      .status(500)
      .json({ message: 'Server error updating HSRP request' });
  }
};

// DELETE /api/hsrp/:id
const deleteHSRPRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `DELETE FROM hsrp WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'HSRP request not found' });
    }

    return res.json({ message: 'HSRP request deleted successfully' });
  } catch (err) {
    console.error('deleteHSRPRequest error:', err);
    return res
      .status(500)
      .json({ message: 'Server error deleting HSRP request' });
  }
};

module.exports = {
  getHSRPRequests,
  createHSRPRequest,
  updateHSRPRequest,
  deleteHSRPRequest,
};
