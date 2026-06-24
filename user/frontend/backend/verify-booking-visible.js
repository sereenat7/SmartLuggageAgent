import fetch from "node-fetch";

async function verifyBookingVisible() {
  console.log("✅ VERIFYING BOOKING IS NOW VISIBLE...\n");

  try {
    // Test with Agent #1's phone
    console.log("🔍 Querying /api/agents/inbox with Agent #1 phone (9004223553)");
    const res = await fetch(
      "http://localhost:5000/api/agents/inbox?phone=9004223553",
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await res.json();

    if (data.success && data.waiting && data.waiting.length > 0) {
      console.log(`\n✅ SUCCESS! Found ${data.waiting.length} booking(s):\n`);

      data.waiting.forEach((booking) => {
        console.log(`📦 Booking #${booking.bookingId}:`);
        console.log(`   User: ${booking.name} (${booking.phone})`);
        console.log(`   Pickup: ${booking.pickupAddress}`);
        console.log(`   Drop: ${booking.dropAddress}`);
        console.log(`   Airline: ${booking.airlineName} ${booking.flightNumber}`);
        console.log(`   Status: ${booking.status || "waiting"}`);
      });
    } else {
      console.log(`❌ No bookings found`);
      console.log(`Response:`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

verifyBookingVisible();
