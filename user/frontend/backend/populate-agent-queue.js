const db = require('./db');

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

async function populateAgentQueue() {
  try {
    console.log('\n🔄 POPULATING AGENT QUEUE FOR EXISTING BOOKINGS...\n');

    // Get all queued bookings that don't have an entry in agent_queue
    const bookings = await runQuery(`
      SELECT b.id, b.phone, u.id as user_id 
      FROM bookings b
      LEFT JOIN users u ON u.phone = b.phone
      LEFT JOIN agent_queue aq ON aq.booking_id = b.id
      WHERE b.assignment_status = 'queued' 
        AND aq.id IS NULL
      ORDER BY b.id DESC
    `);

    console.log(`Found ${bookings.length} bookings without agent queue entries\n`);

    // Get an available agent
    const agents = await runQuery(`
      SELECT agent_id FROM support_agents WHERE status = 'available' LIMIT 1
    `);

    if (agents.length === 0) {
      console.log('❌ No available agents found!');
      process.exit(1);
    }

    const preferredAgentId = agents[0].agent_id;
    console.log(`Using Agent #${preferredAgentId} as the default preferred agent\n`);

    let queuedCount = 0;

    // Insert each booking into agent_queue
    for (const booking of bookings) {
      try {
        const result = await runQuery(`
          INSERT INTO agent_queue (user_id, booking_id, preferred_agent_id, status)
          VALUES (?, ?, ?, 'waiting')
        `, [booking.user_id || null, booking.id, preferredAgentId]);

        console.log(`✅ Queued Booking #${booking.id} for Agent #${preferredAgentId}`);
        queuedCount++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️ Booking #${booking.id} already in queue (skipped)`);
        } else {
          console.log(`❌ Error queuing Booking #${booking.id}: ${err.message}`);
        }
      }
    }

    console.log(`\n✅ COMPLETE: ${queuedCount} bookings queued for agents\n`);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

populateAgentQueue();
