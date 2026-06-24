import db from "./db.js";

function analyzeRequestedAt() {
  return new Promise((resolve, reject) => {
    console.log("📊 Analyzing agent_queue requested_at distribution...\n");

    db.query(
      `SELECT 
        COUNT(*) as total,
        MIN(requested_at) as oldest,
        MAX(requested_at) as newest,
        DATE(requested_at) as date_only
       FROM agent_queue
       GROUP BY DATE(requested_at)
       ORDER BY DATE(requested_at) DESC`,
      (err, rows) => {
        if (err) {
          console.error("❌ Error:", err);
          return reject(err);
        }

        console.log("📋 Requested dates distribution:");
        rows.forEach((row) => {
          const daysOld = Math.floor(
            (Date.now() - new Date(row.date_only).getTime()) / (1000 * 60 * 60 * 24)
          );
          console.log(
            `  ${row.date_only}: ${row.total} bookings (${daysOld} days ago)`
          );
        });

        console.log("\n🔍 Checking 2-day filter...");
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        console.log(`  Current time: ${new Date().toISOString()}`);
        console.log(`  2 days ago:   ${twoDaysAgo.toISOString()}`);

        db.query(
          `SELECT COUNT(*) as count FROM agent_queue 
           WHERE requested_at >= DATE_SUB(NOW(), INTERVAL 2 DAY)`,
          (err2, rows2) => {
            if (err2) {
              console.error("❌ Error:", err2);
              return reject(err2);
            }

            console.log(`\n✅ Bookings in past 2 days: ${rows2[0].count}`);
            console.log(`❌ Bookings older than 2 days: ${rows.reduce((a, r) => a + r.total, 0) - rows2[0].count}`);

            resolve();
          }
        );
      }
    );
  });
}

analyzeRequestedAt().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
