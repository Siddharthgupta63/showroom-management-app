// create_owner.js (script to add default owner user)
const bcrypt = require("bcryptjs");
const db = require("../db"); // use same pool

async function run() {
  const passwordPlain = "Owner2025";
  const hash = await bcrypt.hash(passwordPlain, 10);
  // INSERT all values in one line to avoid syntax errors
  await db.query(
    "INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)",
    ["Admin", "admin@gmail.com", hash, "owner", 1]
  );
  console.log("Owner inserted with email admin@gmail.com and password Owner2025");
  process.exit(0);
}
run().catch(e => {
  console.error(e);
  process.exit(1);
});
