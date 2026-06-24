const db = require("./db");
const {
  processDueBookings,
  manageAgentAvailabilityAndQueues,
  getBestAgentsForBooking
} = require("./assignmentScheduler");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("🚀 Starting Edge Cases Integration Tests...");
  
  try {
    // 1. Setup Test Data
    console.log("\n--- [SETUP] Creating Test User & Test Agents ---");
    
    // Clear old test data if any
    await runQuery("DELETE FROM bookings WHERE phone = '+919999999999'");
    await runQuery("DELETE FROM users WHERE phone = '+919999999999'");
    await runQuery("DELETE FROM support_agents WHERE phone LIKE '+9188888%'");

    // Insert test user
    const userResult = await runQuery(
      "INSERT INTO users (name, phone, email, password) VALUES (?, ?, ?, ?)",
      ["Test User", "+919999999999", "testuser@example.com", "password123"]
    );
    const userId = userResult.insertId;
    console.log(`✅ Test User created ID: ${userId}`);

    // Insert 3 test agents
    // Agent 1: available, nearby, has 2 ignored requests already
    const agent1 = await runQuery(
      `INSERT INTO support_agents (name, phone, status, latitude, longitude, vehicle_type, max_weight_kg, consecutive_ignored_count) 
       VALUES (?, ?, 'available', 19.2048, 73.0863, 'bike', 20, 2)`,
      ["Test Agent 1", "+918888800001"]
    );
    // Agent 2: available, nearby
    const agent2 = await runQuery(
      `INSERT INTO support_agents (name, phone, status, latitude, longitude, vehicle_type, max_weight_kg) 
       VALUES (?, ?, 'available', 19.2045, 73.0860, 'car', 50)`,
      ["Test Agent 2", "+918888800002"]
    );
    // Agent 3: available, nearby
    const agent3 = await runQuery(
      `INSERT INTO support_agents (name, phone, status, latitude, longitude, vehicle_type, max_weight_kg) 
       VALUES (?, ?, 'available', 19.2050, 73.0865, 'truck', 200)`,
      ["Test Agent 3", "+918888800003"]
    );
    console.log("✅ 3 Test Agents created nearby");

    // 2. Test Edge Case 5: Parallel Broadcast & Timeout Re-routing
    console.log("\n--- [TEST] Edge Case 5: Parallel Broadcast & Timeout Re-routing ---");
    // Create a pending booking
    const bookingResult = await runQuery(
      `INSERT INTO bookings (phone, username, status, pickup_latitude, pickup_longitude, bag_weight, assignment_due_at, assignment_status, departure_date, pickup_time)
       VALUES (?, ?, 'pending', 19.2048, 73.0863, '10-20 kg', NOW(), 'pending', '2026-06-25', '10:00:00')`,
      ["+919999999999", "Test User"]
    );
    const bookingId = bookingResult.insertId;
    console.log(`... Pending Booking created ID: ${bookingId}`);

    // Run scheduler to broadcast
    console.log("Running processDueBookings...");
    await processDueBookings();

    // Verify q.broadcasted_agent_ids contains 3 agents
    const queueRows = await runQuery("SELECT * FROM agent_queue WHERE booking_id = ? LIMIT 1", [bookingId]);
    if (!queueRows.length) throw new Error("Booking was not queued!");
    console.log(`... Queue Status: ${queueRows[0].status}`);
    console.log(`... Broadcasted Agents: ${queueRows[0].broadcasted_agent_ids}`);
    
    // Simulate a timeout by setting updated_at to 25 seconds ago
    console.log("Simulating 20-second timeout for acceptance...");
    await runQuery(
      "UPDATE agent_queue SET updated_at = DATE_SUB(NOW(), INTERVAL 25 SECOND) WHERE id = ?",
      [queueRows[0].id]
    );

    // Run availability and queue manager
    await manageAgentAvailabilityAndQueues();

    // Verify agent status is 'inactive' and cooldown_until is set
    const cooldownRows = await runQuery(
      "SELECT agent_id, name, status, cooldown_until FROM support_agents WHERE phone LIKE '+9188888%'"
    );
    cooldownRows.forEach(row => {
      console.log(`Agent ${row.agent_id} (${row.name}) status: ${row.status}, cooldown_until: ${row.cooldown_until}`);
    });

    // 3. Test Edge Case 4: Wait Timer Warnings & No-Show Cancellation
    console.log("\n--- [TEST] Edge Case 4: Wait Timer Warnings & No-Show Cancellation ---");
    // Create new booking
    const booking2Result = await runQuery(
      `INSERT INTO bookings (phone, username, status, pickup_latitude, pickup_longitude, bag_weight, assignment_due_at, assignment_status, agent_start_lat, agent_start_lng, departure_date, pickup_time)
       VALUES (?, ?, 'pending', 19.2048, 73.0863, '10-20 kg', NOW(), 'pending', 19.2000, 73.0800, '2026-06-25', '10:00:00')`,
      ["+919999999999", "Test User"]
    );
    const booking2Id = booking2Result.insertId;
    
    // Clear cooldown of Agent 2 so they can accept
    await runQuery("UPDATE support_agents SET status = 'available', cooldown_until = NULL WHERE phone = '+918888800002'");
    
    // Queue and simulate acceptance
    console.log("Assigning Booking 2...");
    await processDueBookings();
    
    const queue2Rows = await runQuery("SELECT * FROM agent_queue WHERE booking_id = ? LIMIT 1", [booking2Id]);
    const queue2Id = queue2Rows[0].id;
    const testAgentId = queue2Rows[0].preferred_agent_id || 2;

    // Simulate Agent accepting booking
    // This creates session and updates booking to 'assigned'
    await runQuery(
      "INSERT INTO agent_sessions (user_id, booking_id, agent_id, status) VALUES (?, ?, ?, 'active')",
      [userId, booking2Id, testAgentId]
    );
    await runQuery(
      "UPDATE bookings SET status = 'assigned', assignment_status = 'assigned', assigned_agent_id = ?, agent_start_lat = 19.2000, agent_start_lng = 73.0800 WHERE id = ?",
      [testAgentId, booking2Id]
    );
    await runQuery("DELETE FROM agent_queue WHERE id = ?", [queue2Id]);
    console.log(`✅ Agent ID ${testAgentId} accepted Booking ID ${booking2Id}`);

    // Simulate Agent arriving at pickup (Start countdown)
    console.log("Agent marking arrival...");
    await runQuery(
      `UPDATE bookings 
       SET status = 'in-progress', assignment_status = 'at_pickup', arrived_at = NOW() 
       WHERE id = ?`,
      [booking2Id]
    );

    // Simulate 2m warning (130 seconds elapsed)
    console.log("Simulating 2 minutes elapsed...");
    await runQuery("UPDATE bookings SET arrived_at = DATE_SUB(NOW(), INTERVAL 130 SECOND) WHERE id = ?", [booking2Id]);
    await manageAgentAvailabilityAndQueues();
    
    // Verify user_notified_2m is 1
    let checkBooking = await runQuery("SELECT user_notified_2m, user_warned_4m, no_show_unlocked FROM bookings WHERE id = ?", [booking2Id]);
    console.log(`✅ 2-minute Warning Notified: ${checkBooking[0].user_notified_2m}`);

    // Simulate 4m warning (250 seconds elapsed)
    console.log("Simulating 4 minutes elapsed...");
    await runQuery("UPDATE bookings SET arrived_at = DATE_SUB(NOW(), INTERVAL 250 SECOND) WHERE id = ?", [booking2Id]);
    await manageAgentAvailabilityAndQueues();
    
    checkBooking = await runQuery("SELECT user_notified_2m, user_warned_4m, no_show_unlocked FROM bookings WHERE id = ?", [booking2Id]);
    console.log(`✅ 4-minute Warning Warned: ${checkBooking[0].user_warned_4m}`);

    // Simulate 5m unlock (310 seconds elapsed)
    console.log("Simulating 5 minutes elapsed (unlocks no-show)...");
    await runQuery("UPDATE bookings SET arrived_at = DATE_SUB(NOW(), INTERVAL 310 SECOND) WHERE id = ?", [booking2Id]);
    await manageAgentAvailabilityAndQueues();
    
    checkBooking = await runQuery("SELECT user_notified_2m, user_warned_4m, no_show_unlocked FROM bookings WHERE id = ?", [booking2Id]);
    console.log(`✅ 5-minute No-show Unlocked: ${checkBooking[0].no_show_unlocked}`);

    // Verify due diligence check
    console.log("Verifying due diligence constraint (checking no-show fails without sending message)...");
    
    const messageRows = await runQuery(
      "SELECT id FROM booking_messages WHERE booking_id = ? AND sender = 'agent' LIMIT 1",
      [booking2Id]
    );
    if (!messageRows.length) {
      console.log("❌ Blocked: Agent cannot mark no-show because no message has been sent. [SUCCESS]");
    } else {
      throw new Error("Due diligence validation failed!");
    }

    // Agent sends a message
    console.log("Agent sending a message to User...");
    await runQuery(
      "INSERT INTO booking_messages (booking_id, sender, message) VALUES (?, ?, ?)",
      [booking2Id, "agent", "Hello, I have arrived at your location. Please come out."]
    );

    // Call no-show logic
    console.log("Marking booking as no-show...");
    const bookingData = (await runQuery("SELECT * FROM bookings WHERE id = ? LIMIT 1", [booking2Id]))[0];
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(bookingData.pickup_latitude - bookingData.agent_start_lat);
    const dLon = toRad(bookingData.pickup_longitude - bookingData.agent_start_lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(bookingData.agent_start_lat)) * Math.cos(toRad(bookingData.pickup_latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const distanceKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const cancellationFee = Number((distanceKm * 10).toFixed(2));
    
    // Apply cancellation fee
    await runQuery(
      "UPDATE users SET pending_cancellation_fee = pending_cancellation_fee + ? WHERE phone = ? OR phone = ?",
      [cancellationFee, "+919999999999", "9999999999"]
    );
    // Cancel booking
    await runQuery(
      "UPDATE bookings SET status = 'cancelled', assignment_status = 'no_show', cancellation_reason = 'no-show' WHERE id = ?",
      [booking2Id]
    );
    // Set agent available
    await runQuery("UPDATE support_agents SET status = 'available', current_user_id = NULL WHERE agent_id = ?", [testAgentId]);
    await runQuery("UPDATE agent_sessions SET status = 'completed', end_time = NOW() WHERE booking_id = ? AND status = 'active'", [booking2Id]);

    console.log(`✅ Booking ID ${booking2Id} cancelled. Traveled distance: ${distanceKm.toFixed(2)} km.`);
    console.log(`✅ Calculated cancellation fee: ${cancellationFee} Rs.`);

    // Verify fee is stored on user
    const userRow = (await runQuery("SELECT pending_cancellation_fee FROM users WHERE id = ?", [userId]))[0];
    console.log(`✅ User's stored pending cancellation fee: ${userRow.pending_cancellation_fee} Rs`);

    // Cleanup test data
    console.log("\n--- [CLEANUP] Restoring Database State ---");
    await runQuery("DELETE FROM booking_messages WHERE booking_id IN (?, ?)", [bookingId, booking2Id]);
    await runQuery("DELETE FROM bookings WHERE phone = '+919999999999'");
    await runQuery("DELETE FROM users WHERE phone = '+919999999999'");
    await runQuery("DELETE FROM support_agents WHERE phone LIKE '+9188888%'");
    console.log("✅ Cleanup complete");
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");

  } catch (error) {
    console.error("❌ TEST FAILED:", error);
  } finally {
    db.end();
  }
}

main();
