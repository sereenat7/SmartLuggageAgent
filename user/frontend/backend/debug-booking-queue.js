const db = require('./db');

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

async function debug() {
  try {
    console.log('\n📊 DEBUGGING BOOKING QUEUE SYSTEM...\n');

    // Check agents in both tables
    console.log('1️⃣ AGENTS IN DATABASE:');
    try {
      const agents = await runQuery('SELECT agent_id, name, phone, status, latitude, longitude FROM support_agents LIMIT 10');
      console.log(`Found ${agents.length} agents in support_agents table`);
      if (agents.length > 0) {
        agents.forEach(a => {
          console.log(`  - Agent #${a.agent_id}: ${a.name} (${a.phone}) - ${a.status} - Lat: ${a.latitude}, Lng: ${a.longitude}`);
        });
      } else {
        console.log('  ❌ NO AGENTS FOUND - THIS IS THE PROBLEM!');
        console.log('  💡 TIP: Run: node add-test-agent.js');
      }
    } catch (err) {
      console.log('  ⚠️ support_agents table not accessible, trying agents table...');
      try {
        const agents = await runQuery('SELECT * FROM agents LIMIT 5');
        console.log(`Found ${agents.length} agents in agents table`);
        if (agents.length === 0) {
          console.log('  ❌ NO AGENTS FOUND');
        }
      } catch (e) {
        console.log('  ❌ Neither table accessible');
      }
    }

    // Check bookings
    console.log('\n2️⃣ RECENT BOOKINGS:');
    const bookings = await runQuery('SELECT id, phone, airline_name, flight_number, status, assignment_status, assigned_agent_id FROM bookings ORDER BY id DESC LIMIT 10');
    console.log(`Found ${bookings.length} bookings`);
    if (bookings.length > 0) {
      bookings.forEach(b => {
        console.log(`  - Booking #${b.id}: ${b.airline_name} ${b.flight_number} - Status: ${b.status} - Assignment: ${b.assignment_status} - Agent: ${b.assigned_agent_id || 'NONE'}`);
      });
    } else {
      console.log('  ❌ NO BOOKINGS FOUND');
    }

    // Check agent queue
    console.log('\n3️⃣ AGENT QUEUE (WAITING BOOKINGS):');
    const queue = await runQuery('SELECT id, booking_id, preferred_agent_id, status FROM agent_queue ORDER BY id DESC LIMIT 10');
    console.log(`Found ${queue.length} queued bookings`);
    if (queue.length > 0) {
      queue.forEach(q => {
        console.log(`  - Queue #${q.id}: Booking #${q.booking_id} - Preferred Agent: ${q.preferred_agent_id} - Status: ${q.status}`);
      });
    } else {
      console.log('  ❌ NO BOOKINGS IN QUEUE - They\'re not being queued after payment!');
    }

    // Check users
    console.log('\n4️⃣ USERS IN DATABASE:');
    const users = await runQuery('SELECT id, phone, name FROM users LIMIT 5');
    console.log(`Found ${users.length} users`);
    users.forEach(u => {
      console.log(`  - User #${u.id}: ${u.name} (${u.phone})`);
    });

    console.log('\n✅ DEBUG COMPLETE\n');

  } catch (error) {
    console.error('❌ DEBUG ERROR:', error.message);
  } finally {
    process.exit(0);
  }
}

debug();
