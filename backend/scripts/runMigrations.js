const fs = require("fs");
const path = require("path");
const db = require("../db");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT NOT NULL AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_schema_migrations_filename (filename)
    )
  `);
}

async function getAppliedMigrations() {
  const [rows] = await db.query(
    `SELECT filename FROM schema_migrations ORDER BY filename`
  );
  return new Set(rows.map((r) => String(r.filename)));
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".sql"))
    .sort();
}

function splitSqlStatements(sqlText) {
  const lines = sqlText.split("\n");
  const cleaned = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // skip full-line comments
    if (
      trimmed.startsWith("--") ||
      trimmed.startsWith("#") ||
      trimmed === ""
    ) {
      continue;
    }

    cleaned.push(line);
  }

  const sql = cleaned.join("\n");

  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runMigrationFile(filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const sqlText = fs.readFileSync(fullPath, "utf8").trim();

  if (!sqlText) {
    console.log(`⚠️ Skipping empty migration: ${filename}`);
    return;
  }

  const statements = splitSqlStatements(sqlText);

  if (statements.length === 0) {
    console.log(`⚠️ No executable SQL found in: ${filename}`);
    return;
  }

  console.log(`➡️ Running migration: ${filename}`);

  for (const stmt of statements) {
    await db.query(stmt);
  }

  await db.query(
    `INSERT INTO schema_migrations (filename) VALUES (?)`,
    [filename]
  );

  console.log(`✅ Applied migration: ${filename}`);
}

async function main() {
  try {
    await ensureMigrationsTable();

    const applied = await getAppliedMigrations();
    const files = getMigrationFiles();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭️ Already applied: ${file}`);
        continue;
      }

      await runMigrationFile(file);
    }

    console.log("🎉 Migration run complete");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

main();