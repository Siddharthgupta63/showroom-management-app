const db = require("../db");

db.query('SELECT 1')
  .then(() => {
    console.log("Database connection successful!");
    process.exit();
  })
  .catch(err => {
    console.error("Database connection failed:", err);
    process.exit();
  });
