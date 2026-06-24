import db from "./db.js";

function checkBookingStatus() {
  return new Promise((resolve, reject) => {
    console.log("📋 CHECKING BOOKING STATUS FOR VERIFICATION...\n");

    db.query(`SELECT id, status, assignment_status, qr_manifest FROM bookings WHERE id = 103 LIMIT 1`, (err, rows) => {
      if (err) {
        console.error("❌ Error:", err);
        return reject(err);
      }

      const booking = rows[0];
      console.log(`📦 Booking #${booking.id}\n`);
      console.log(`Status: ${booking.status}`);
      console.log(`Assignment Status: ${booking.assignment_status}\n`);

      // Check what statuses allow pickup verification
      console.log("🔍 Verification Eligibility:\n");

      // Pickup can be verified at any time
      console.log("✅ Pickup QR: Can verify (no status restrictions)\n");

      // Destination is locked until agent arrives
      const isDestinationUnlocked = 
        booking.status === 'in-progress' || 
        booking.status === 'picked_up' || 
        booking.status === 'delivered' ||
        booking.assignment_status === 'at_pickup' ||
        booking.assignment_status === 'picked_up' ||
        booking.assignment_status === 'delivered';

      console.log(`🔒 Destination QR: ${isDestinationUnlocked ? '✅ UNLOCKED' : '🔴 LOCKED'}`);
      console.log(`   Reason: Status must be in-progress/picked_up/delivered`);
      console.log(`   Current status: ${booking.status}`);

      if (booking.status === 'in-progress') {
        console.log("\n✅ Booking is ready for QR verification!");
      } else {
        console.log(`\n⚠️  Booking is in '${booking.status}' status`);
        console.log("   Need to update to 'in-progress' before scanning");
      }

      resolve();
    });
  });
}

checkBookingStatus().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
