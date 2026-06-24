import db from "./db.js";

function diagnoseBookings() {
  return new Promise((resolve, reject) => {
    console.log("🔍 DIAGNOSING BOOKING VISIBILITY...\n");

    // Check bookings
    db.query(`SELECT COUNT(*) as total FROM bookings`, (err1, rows1) => {
      if (err1) {
        console.error("❌ Error checking bookings:", err1);
        return reject(err1);
      }

      console.log(`📊 Bookings in database: ${rows1[0].total}`);

      if (rows1[0].total > 0) {
        db.query(
          `SELECT id, status, assignment_status, created_at FROM bookings ORDER BY created_at DESC LIMIT 3`,
          (err, bookings) => {
            if (err) {
              console.error("❌ Error fetching bookings:", err);
              return reject(err);
            }

            console.log(`   Recent bookings:`);
            bookings.forEach((b) => {
              console.log(
                `   - ID ${b.id}: status=${b.status}, assignment_status=${b.assignment_status}, created=${b.created_at}`
              );
            });
          }
        );
      }

      // Check agent_queue
      db.query(
        `SELECT COUNT(*) as total FROM agent_queue`,
        (err2, rows2) => {
          if (err2) {
            console.error("❌ Error checking agent_queue:", err2);
            return reject(err2);
          }

          console.log(`\n📋 Entries in agent_queue: ${rows2[0].total}`);

          if (rows2[0].total > 0) {
            db.query(
              `SELECT id, booking_id, status, requested_at FROM agent_queue ORDER BY requested_at DESC LIMIT 3`,
              (err, queues) => {
                if (err) {
                  console.error("❌ Error fetching queue:", err);
                  return reject(err);
                }

                console.log(`   Recent queue entries:`);
                queues.forEach((q) => {
                  const daysOld = Math.floor(
                    (Date.now() - new Date(q.requested_at).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  console.log(
                    `   - Queue ID ${q.id}: Booking ${q.booking_id}, status=${q.status}, requested=${q.requested_at} (${daysOld} days ago)`
                  );
                });
              }
            );
          }

          // Check 2-day filter result
          db.query(
            `SELECT COUNT(*) as count FROM agent_queue 
             WHERE status = 'waiting' 
             AND requested_at >= DATE_SUB(NOW(), INTERVAL 2 DAY)`,
            (err3, rows3) => {
              if (err3) {
                console.error("❌ Error checking filter:", err3);
                return reject(err3);
              }

              console.log(`\n✔️  Bookings in past 2 days: ${rows3[0].count}`);

              const now = new Date();
              const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

              console.log(`\n🕐 Time Check:`);
              console.log(`   Current: ${now.toISOString()}`);
              console.log(`   2 days ago: ${twoDaysAgo.toISOString()}`);

              console.log(`\n✅ DIAGNOSIS COMPLETE`);
              resolve();
            }
          );
        }
      );
    });
  });
}

diagnoseBookings().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
