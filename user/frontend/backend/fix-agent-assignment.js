import db from "./db.js";

function fixBookingAssignment() {
  return new Promise((resolve, reject) => {
    console.log("🔧 FIXING BOOKING ASSIGNMENT...\n");

    // Update the booking to be assigned to Agent #1 (Anjali Mishra)
    db.query(
      `UPDATE agent_queue 
       SET preferred_agent_id = 1 
       WHERE booking_id = 103`,
      (err, result) => {
        if (err) {
          console.error("❌ Error updating agent_queue:", err);
          return reject(err);
        }

        console.log(`✅ Updated agent_queue: reassigned to Agent #1`);

        // Verify the update
        db.query(
          `SELECT preferred_agent_id, status FROM agent_queue WHERE booking_id = 103`,
          (err2, rows) => {
            if (err2) {
              console.error("❌ Error verifying:", err2);
              return reject(err2);
            }

            console.log(
              `\n✔️  Booking #103 now assigned to Agent #${rows[0].preferred_agent_id}`
            );

            // Get Agent #1 details
            db.query(
              `SELECT agent_id, name, phone FROM support_agents WHERE agent_id = 1`,
              (err3, agent) => {
                if (err3) {
                  console.error("❌ Error fetching agent:", err3);
                  return reject(err3);
                }

                if (agent.length > 0) {
                  console.log(
                    `\n📱 Agent #1 Details:`
                  );
                  console.log(`   Name: ${agent[0].name}`);
                  console.log(`   Phone: ${agent[0].phone}`);
                  console.log(`\n✅ Agent can now log in and see the booking!`);
                }

                resolve();
              }
            );
          }
        );
      }
    );
  });
}

fixBookingAssignment().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
