// run: node scripts/setPassword.js email@example.com newPassword
const bcrypt = require("bcrypt");
const db = require("../db");
const [,, identifier, newPass] = process.argv;
if (!identifier || !newPass) {
  console.log("Usage: node setPassword.js <email|mobile> <newpass>");
  process.exit(1);
}
(async () => {
  const hashed = await bcrypt.hash(newPass, 10);
  // determine if is email or mobile by simple test
  if (identifier.includes("@")) {
    await db.query("UPDATE users SET password = ? WHERE email = ?", [hashed, identifier]);
  } else {
    await db.query("UPDATE users SET password = ? WHERE mobile = ?", [hashed, identifier]);
  }
  console.log("Password updated");
  process.exit(0);
})();
