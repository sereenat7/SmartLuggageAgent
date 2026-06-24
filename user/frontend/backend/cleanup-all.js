import db from "./db.js";

function cleanupDatabase() {
  return new Promise((resolve, reject) => {
    console.log("🗑️  CLEANING UP DATABASE...\n");

    // Delete in order of dependencies (child tables first)
    db.query(`DELETE FROM agent_queue`, (err1) => {
      if (err1) {
        console.error("❌ Error deleting agent_queue:", err1);
        return reject(err1);
      }
      console.log("✅ Deleted all entries from agent_queue");

      db.query(`DELETE FROM agent_sessions`, (err2) => {
        if (err2) {
          console.error("❌ Error deleting agent_sessions:", err2);
          return reject(err2);
        }
        console.log("✅ Deleted all entries from agent_sessions");

        db.query(`DELETE FROM luggage_photos`, (err3) => {
          if (err3) {
            console.error("❌ Error deleting luggage_photos:", err3);
            return reject(err3);
          }
          console.log("✅ Deleted all entries from luggage_photos");

          db.query(`DELETE FROM booking_locations`, (err4) => {
            if (err4) {
              console.error("❌ Error deleting booking_locations:", err4);
              return reject(err4);
            }
            console.log("✅ Deleted all entries from booking_locations");

            db.query(`DELETE FROM payments`, (err5) => {
              if (err5) {
                console.error("❌ Error deleting payments:", err5);
                return reject(err5);
              }
              console.log("✅ Deleted all entries from payments");

              db.query(`DELETE FROM bookings`, (err6) => {
                if (err6) {
                  console.error("❌ Error deleting bookings:", err6);
                  return reject(err6);
                }
                console.log("✅ Deleted all entries from bookings");

                // Verify cleanup
                db.query(
                  `SELECT 
                    (SELECT COUNT(*) FROM bookings) as booking_count,
                    (SELECT COUNT(*) FROM agent_queue) as queue_count,
                    (SELECT COUNT(*) FROM payments) as payment_count`,
                  (err7, rows) => {
                    if (err7) {
                      console.error("❌ Error verifying:", err7);
                      return reject(err7);
                    }

                    console.log(`\n📊 Database Status After Cleanup:`);
                    console.log(`  Bookings: ${rows[0].booking_count}`);
                    console.log(`  Agent Queue: ${rows[0].queue_count}`);
                    console.log(`  Payments: ${rows[0].payment_count}`);
                    console.log(`\n✅ DATABASE READY FOR NEW BOOKINGS!`);
                    resolve();
                  }
                );
              });
            });
          });
        });
      });
    });
  });
}

cleanupDatabase().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
