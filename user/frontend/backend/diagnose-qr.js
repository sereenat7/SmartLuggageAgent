import db from "./db.js";

function diagnoseQrIssue() {
  return new Promise((resolve, reject) => {
    console.log("🔍 DIAGNOSING QR CODE ISSUE...\n");

    db.query(
      `SELECT id, status, qr_manifest FROM bookings WHERE id = 103`,
      (err, rows) => {
        if (err) {
          console.error("❌ Error:", err);
          return reject(err);
        }

        if (rows.length === 0) {
          console.log("❌ Booking #103 not found");
          return resolve();
        }

        const booking = rows[0];
        console.log(`📦 Booking #103 Status: ${booking.status}`);

        console.log(`\n🔍 QR Code Check:`);
        if (booking.qr_manifest) {
          console.log(`   ✅ qr_manifest exists (${booking.qr_manifest.length} bytes)`);
          try {
            const manifest = JSON.parse(booking.qr_manifest);
            console.log(`   Structure: ${Object.keys(manifest).join(", ")}`);
            if (manifest.pickup) {
              console.log(`   ✅ Pickup QR: ${Object.keys(manifest.pickup).join(", ")}`);
            }
            if (manifest.destination) {
              console.log(`   ✅ Destination QR: ${Object.keys(manifest.destination).join(", ")}`);
            }
          } catch (e) {
            console.log(`   ⚠️  Could not parse qr_manifest: ${e.message}`);
          }
        } else {
          console.log(`   ❌ qr_manifest is NULL - QR was never generated!`);
        }

        console.log(`\n📊 Issue Summary:`);
        if (!booking.qr_manifest) {
          console.log(`   🔴 PROBLEM: QR manifest was never generated during booking creation`);
          console.log(`   Solution: Need to generate QR codes after the fact`);
        } else {
          console.log(`   ✅ QR manifest exists - issue might be in verification`);
        }

        resolve();
      }
    );
  });
}

diagnoseQrIssue().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
