import db from "./db.js";

function updateRequestedAt() {
  return new Promise((resolve, reject) => {
    console.log("⏰ Updating all agent_queue entries to CURRENT_TIMESTAMP...\n");

    db.query(
      `UPDATE agent_queue 
       SET requested_at = CURRENT_TIMESTAMP 
       WHERE 1=1`,
      (err, result) => {
        if (err) {
          console.error("❌ Error updating:", err);
          return reject(err);
        }

        console.log(`✅ Updated ${result.affectedRows} rows`);

        // Verify the update
        db.query(
          `SELECT COUNT(*) as total, MIN(requested_at) as oldest, MAX(requested_at) as newest
           FROM agent_queue`,
          (err2, rows) => {
            if (err2) {
              console.error("❌ Error verifying:", err2);
              return reject(err2);
            }

            console.log(`\n📊 Agent Queue Status:`);
            console.log(`  Total bookings: ${rows[0].total}`);
            console.log(`  Oldest: ${rows[0].oldest}`);
            console.log(`  Newest: ${rows[0].newest}`);

            console.log(`\n✅ All bookings are now recent (within past 2 days)!`);
            resolve();
          }
        );
      }
    );
  });
}

updateRequestedAt().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
