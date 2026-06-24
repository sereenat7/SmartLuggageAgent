import db from "./db.js";
import crypto from 'crypto';

const QR_SECRET = process.env.BOOKING_QR_SECRET || process.env.JWT_SECRET || 'smart-luggage-booking-qr';

function testQrVerification() {
  return new Promise((resolve, reject) => {
    console.log("🧪 TESTING QR VERIFICATION...\n");

    db.query(`SELECT id, qr_manifest FROM bookings WHERE id = 103 LIMIT 1`, (err, rows) => {
      if (err) {
        console.error("❌ Error:", err);
        return reject(err);
      }

      if (!rows || rows.length === 0) {
        console.log("❌ Booking not found");
        return resolve();
      }

      const booking = rows[0];
      console.log(`📦 Booking #${booking.id}\n`);

      if (!booking.qr_manifest) {
        console.log("❌ No QR manifest");
        return resolve();
      }

      try {
        const manifest = JSON.parse(booking.qr_manifest);
        console.log("✅ Manifest parsed\n");

        // Test pickup QR
        const pickupPayload = manifest.pickup.payload;
        const pickupData = JSON.parse(pickupPayload);

        console.log("🔍 Pickup QR Analysis:");
        console.log(`   Raw payload: ${pickupPayload.substring(0, 80)}...`);
        console.log(`   Booking ID: ${pickupData.bookingId}`);
        console.log(`   Phase: ${pickupData.phase}`);
        console.log(`   Issued At: ${pickupData.issuedAt}`);
        console.log(`   Nonce: ${pickupData.nonce}`);
        console.log(`   Signature (received): ${pickupData.signature.substring(0, 16)}...`);

        // Recalculate signature
        const canonical = `${pickupData.bookingId}|${pickupData.phase}|${pickupData.issuedAt}|${pickupData.nonce}`;
        const expectedSig = crypto
          .createHmac('sha256', QR_SECRET)
          .update(canonical)
          .digest('hex');

        console.log(`   Signature (expected): ${expectedSig.substring(0, 16)}...`);
        console.log(`   ✅ Match: ${pickupData.signature === expectedSig}`);

        if (pickupData.signature !== expectedSig) {
          console.log(`\n   ⚠️  MISMATCH DETAILS:`);
          console.log(`   Secret used: "${QR_SECRET}"`);
          console.log(`   Canonical string: "${canonical}"`);
          console.log(`   Full received sig: ${pickupData.signature}`);
          console.log(`   Full expected sig: ${expectedSig}`);
        }

        resolve();
      } catch (e) {
        console.error("❌ Error:", e.message);
        reject(e);
      }
    });
  });
}

testQrVerification().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
