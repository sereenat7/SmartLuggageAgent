import mysql from "mysql2/promise";
import "dotenv/config";

const config = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "smart_luggage",
};

async function fixRequestedAt() {
  const connection = await mysql.createConnection(config);

  try {
    console.log("🔄 Checking agent_queue for NULL requested_at...");

    // Check how many have NULL requested_at
    const [nullRows] = await connection.query(
      `SELECT COUNT(*) as count FROM agent_queue WHERE requested_at IS NULL`
    );

    console.log(`📊 Found ${nullRows[0].count} rows with NULL requested_at`);

    if (nullRows[0].count > 0) {
      console.log("✏️  Updating all NULL requested_at to CURRENT_TIMESTAMP...");

      const [updateResult] = await connection.query(
        `UPDATE agent_queue 
         SET requested_at = CURRENT_TIMESTAMP 
         WHERE requested_at IS NULL`
      );

      console.log(`✅ Updated ${updateResult.affectedRows} rows with CURRENT_TIMESTAMP`);

      // Verify the update
      const [verifyRows] = await connection.query(
        `SELECT COUNT(*) as count FROM agent_queue WHERE requested_at IS NULL`
      );

      console.log(`✔️  Remaining NULL requested_at: ${verifyRows[0].count}`);

      // Show sample of updated data
      const [samples] = await connection.query(
        `SELECT id, booking_id, requested_at 
         FROM agent_queue 
         ORDER BY requested_at DESC 
         LIMIT 5`
      );

      console.log("\n📋 Sample of updated data:");
      samples.forEach((row) => {
        console.log(
          `  - Queue ID ${row.id}, Booking ${row.booking_id}: ${row.requested_at}`
        );
      });
    } else {
      console.log("✅ All rows already have requested_at values");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.end();
    console.log("\n✔️  Done!");
  }
}

fixRequestedAt();
