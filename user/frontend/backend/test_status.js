const db = require('./db');

async function checkDb() {
  const [sessions] = await db.promise().query("SELECT * FROM agent_sessions WHERE status = 'active'");
  console.log("Active Sessions:", sessions.length);
  for (const s of sessions) {
    const [bookings] = await db.promise().query("SELECT id, status, pickup_verified, pickup_verified_at FROM bookings WHERE id = ?", [s.booking_id]);
    console.log("Booking for session:", s.booking_id, bookings[0]);
  }
  process.exit(0);
}

checkDb().catch(console.error);
