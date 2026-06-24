import db from "./db.js";

function fixRequestedAt() {
  return new Promise((resolve, reject) => {
    console.log("🔄 Checking agent_queue for NULL requested_at...");

    // Check how many have NULL requested_at
    db.query(
      `SELECT COUNT(*) as count FROM agent_queue WHERE requested_at IS NULL`,
      (err, rows) => {
        if (err) {
          console.error("❌ Error checking NULL rows:", err);
          return reject(err);
        }

        console.log(`📊 Found ${rows[0].count} rows with NULL requested_at`);

        if (rows[0].count > 0) {
          console.log("✏️  Updating all NULL requested_at to CURRENT_TIMESTAMP...");

          db.query(
            `UPDATE agent_queue 
             SET requested_at = CURRENT_TIMESTAMP 
             WHERE requested_at IS NULL`,
            (updateErr, result) => {
              if (updateErr) {
                console.error("❌ Error updating rows:", updateErr);
                return reject(updateErr);
              }

              console.log(`✅ Updated ${result.affectedRows} rows`);

              // Verify the update
              db.query(
                `SELECT COUNT(*) as count FROM agent_queue WHERE requested_at IS NULL`,
                (verifyErr, verifyRows) => {
                  if (verifyErr) {
                    console.error("❌ Error verifying:", verifyErr);
                    return reject(verifyErr);
                  }

                  console.log(
                    `✔️  Remaining NULL requested_at: ${verifyRows[0].count}`
                  );

                  // Show sample of updated data
                  db.query(
                    `SELECT id, booking_id, requested_at 
                     FROM agent_queue 
                     ORDER BY requested_at DESC 
                     LIMIT 5`,
                    (sampleErr, samples) => {
                      if (sampleErr) {
                        console.error("❌ Error getting samples:", sampleErr);
                        return reject(sampleErr);
                      }

                      console.log("\n📋 Sample of updated data:");
                      samples.forEach((row) => {
                        console.log(
                          `  - Queue ID ${row.id}, Booking ${row.booking_id}: ${row.requested_at}`
                        );
                      });

                      console.log("\n✔️  Done!");
                      resolve();
                    }
                  );
                }
              );
            }
          );
        } else {
          console.log("✅ All rows already have requested_at values");
          resolve();
        }
      }
    );
  });
}

fixRequestedAt().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
