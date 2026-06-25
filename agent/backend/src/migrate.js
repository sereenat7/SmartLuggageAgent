import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { getPool } from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const pool = getPool();

  // Verify local MySQL Workbench is reachable before running migrations
  try {
    await pool.query("SELECT 1");
    console.log(`Connected to MySQL at ${process.env.MYSQL_HOST || "localhost"}:${process.env.MYSQL_PORT || 3306}`);
  } catch (err) {
    console.error("Could not connect to database:", err.message);
    console.error("Make sure MySQL Workbench is running and .env credentials are correct.");
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, "..", "migrations");
  const entries = await fs.readdir(migrationsDir);
  const sqlFiles = entries.filter((e) => e.endsWith(".sql")).sort();

  for (const file of sqlFiles) {
    const fullPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(fullPath, "utf8");
    await pool.query(sql);
    // eslint-disable-next-line no-console
    console.log(`Applied ${file}`);
  }

  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


