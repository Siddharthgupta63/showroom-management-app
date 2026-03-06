// backend/config.js
require("dotenv").config();

module.exports = {
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,        // ✅ no root fallback
    password: process.env.DB_PASS,    // ✅ no empty fallback
    database: process.env.DB_NAME || "showroom_db",
  },
  jwtSecret: process.env.JWT_SECRET || "your_default_secret",
};
