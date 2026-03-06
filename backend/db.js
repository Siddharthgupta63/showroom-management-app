// backend/db.js
require("dotenv").config(); // ✅ ensure env is loaded even if server.js loads late

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),

  // ✅ strong fallbacks (prevents '' user + password NO)
  user: process.env.DB_USER || "showroom",
  password: process.env.DB_PASS || process.env.DB_PASSWORD || "Showroom@12345",
  database: process.env.DB_NAME || "showroom_db",

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
