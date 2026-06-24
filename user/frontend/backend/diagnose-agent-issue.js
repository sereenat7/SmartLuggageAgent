import db from "./db.js";

function diagnoseAgentIssue() {
  return new Promise((resolve, reject) => {
    console.log("🔍 DIAGNOSING AGENT VISIBILITY ISSUE...\n");

    // Check if agents exist
    db.query(`SELECT * FROM support_agents`, (err1, agents) => {
      if (err1) {
        console.error("❌ Error fetching agents:", err1);
        return reject(err1);
      }

      console.log(`📋 Agents in database: ${agents.length}`);
      agents.forEach((a) => {
        console.log(
          `   - Agent #${a.agent_id}: ${a.name} (Phone: ${a.phone}, Status: ${a.status})`
        );
      });

      // Check the booking
      db.query(
        `SELECT id, status, assignment_status FROM bookings WHERE id = 103`,
        (err2, bookings) => {
          if (err2) {
            console.error("❌ Error fetching booking:", err2);
            return reject(err2);
          }

          if (bookings.length === 0) {
            console.log(`\n❌ Booking #103 NOT FOUND`);
            return resolve();
          }

          console.log(`\n📦 Booking #103:`);
          console.log(`   Status: ${bookings[0].status}`);
          console.log(`   Assignment Status: ${bookings[0].assignment_status}`);

          // Check the queue entry
          db.query(
            `SELECT * FROM agent_queue WHERE booking_id = 103`,
            (err3, queue) => {
              if (err3) {
                console.error("❌ Error fetching queue:", err3);
                return reject(err3);
              }

              if (queue.length === 0) {
                console.log(`\n❌ Booking NOT in agent_queue!`);
              } else {
                console.log(`\n✅ Booking in agent_queue:`);
                queue.forEach((q) => {
                  console.log(
                    `   - Queue ID: ${q.id}, Preferred Agent: ${q.preferred_agent_id}, Status: ${q.status}`
                  );
                });

                // Check if preferred agent exists
                const preferredAgentId = queue[0].preferred_agent_id;
                db.query(
                  `SELECT * FROM support_agents WHERE agent_id = ?`,
                  [preferredAgentId],
                  (err4, prefAgent) => {
                    if (err4) {
                      console.error("❌ Error fetching preferred agent:", err4);
                      return reject(err4);
                    }

                    if (prefAgent.length === 0) {
                      console.log(
                        `\n⚠️  Preferred Agent #${preferredAgentId} DOES NOT EXIST!`
                      );
                    } else {
                      console.log(
                        `\n✅ Preferred Agent exists: ${prefAgent[0].name} (${prefAgent[0].phone})`
                      );
                    }

                    console.log(`\n🔑 KEY ISSUE:`);
                    console.log(
                      `   Booking will only show to Agent #${preferredAgentId}`
                    );
                    console.log(`   If agent logs in with different ID/phone, they won't see it!`);

                    console.log(`\n✅ DIAGNOSIS COMPLETE`);
                    resolve();
                  }
                );
              }
            }
          );
        }
      );
    });
  });
}

diagnoseAgentIssue().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
