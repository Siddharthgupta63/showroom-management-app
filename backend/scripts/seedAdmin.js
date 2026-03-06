/**
 * scripts/seedAdmin.js
 *
 * This script creates the FIRST ADMIN user if not already present.
 * It reads ADMIN_PASSWORD from .env
 * Admin username = 'admin'
 * Admin email    = 'admin@localhost'
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require("../db"); // MySQL pool

async function seedAdmin() {
  try {
    console.log("\n🔍 Checking if admin user already exists...");

    // Check whether admin user exists
    const [rows] = await db.query(
      "SELECT id FROM users WHERE username = 'admin' LIMIT 1"
    );

    if (rows.length > 0) {
      console.log("✅ Admin user already exists.\n");
      process.exit(0);
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("❌ ERROR: ADMIN_PASSWORD missing in .env");
      process.exit(1);
    }

    // Hash admin password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Insert admin into database
    await db.query(
      `INSERT INTO users (username, email, mobile, password, role, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      ['admin', 'admin@localhost', '', hashedPassword, 'admin']
    );

    console.log("🎉 ADMIN USER CREATED SUCCESSFULLY!");
    console.log("👤 Username: admin");
    console.log(`🔑 Password: ${adminPassword}\n`);
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error seeding admin:", error);
    process.exit(1);
  }
}

seedAdmin();
