import mysql from "mysql2/promise";

let pool;

// Connects to local MySQL Workbench instance — no Docker required.
// Configure host/port/credentials in the .env file at the backend root.
export function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306), // 3307 matches local MySQL Workbench default in .env
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "smartluggage",
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    queueLimit: 0,
    multipleStatements: true,
  });

  return pool;
}

// Verify local DB connectivity on startup and log a clear message.
export async function testConnection() {
  const pool = getPool();
  try {
    const conn = await pool.getConnection();
    conn.release();
    console.log(
      `✅ MySQL connected — host=${process.env.MYSQL_HOST || "localhost"} port=${process.env.MYSQL_PORT || 3307} db=${process.env.MYSQL_DATABASE || "smartluggage"}`
    );
  } catch (err) {
    console.error("❌ MySQL connection failed:", err.message);
    console.error(
      "   Check that MySQL Workbench is running on port",
      process.env.MYSQL_PORT || 3306,
      "and that .env credentials are correct."
    );
    process.exit(1);
  }
}

