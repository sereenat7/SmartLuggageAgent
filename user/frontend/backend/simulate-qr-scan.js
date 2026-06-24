import db from "./db.js";
import fetch from "node-fetch";

async function testQrScan() {
  console.log("🧪 SIMULATING QR CODE SCAN...\n");

  try {
    // Get the booking with QR manifest
    const getBooking = () => {
      return new Promise((resolve, reject) => {
        db.query(`SELECT id, qr_manifest FROM bookings WHERE id = 103`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        });
      });
    };

    const booking = await getBooking();
    const manifest = JSON.parse(booking.qr_manifest);
    const pickupPayload = manifest.pickup.payload;

    console.log("📦 QR Payload to scan:");
    console.log(`  Length: ${pickupPayload.length} bytes`);
    console.log(`  Preview: ${pickupPayload.substring(0, 80)}...\n`);

    // Simulate the agent app scanning this QR code
    console.log("📤 Sending to /api/bookings/verify-qr/103...\n");

    const response = await fetch("http://localhost:5000/api/bookings/verify-qr/103", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        qrType: "pickup",
        qrValue: pickupPayload,
      }),
    });

    const result = await response.json();

    console.log(`📥 Response Status: ${response.status}`);
    console.log(`📥 Response Success: ${result.success}`);

    if (result.success) {
      console.log(`\n✅ VERIFICATION SUCCESSFUL!`);
      console.log(`   Status: ${result.verificationStatus?.status}`);
      console.log(`   Message: ${result.message}`);
    } else {
      console.log(`\n❌ VERIFICATION FAILED`);
      if (result.verificationStatus) {
        console.log(`   Status: ${result.verificationStatus.status}`);
        console.log(`   Reason: ${result.verificationStatus.reason}`);
        console.log(`   Message: ${result.verificationStatus.message}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }

    console.log(`\n📊 Full Response:`, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testQrScan();
