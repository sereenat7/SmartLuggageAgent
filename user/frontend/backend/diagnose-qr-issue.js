import db from "./db.js";
import { attachQrDataToBooking, verifyQrPayload } from "./utils/bookingQr.js";

async function diagnoseQrIssue() {
  console.log("🔍 QR CODE DIAGNOSTIC REPORT\n");

  try {
    // Step 1: Get booking
    const booking = await new Promise((resolve, reject) => {
      db.query(`SELECT * FROM bookings WHERE id = 103 LIMIT 1`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });

    if (!booking) {
      console.log("❌ Booking not found");
      return;
    }

    console.log("✅ Booking #103 found");
    console.log(`   Status: ${booking.status}`);
    console.log(`   Assignment: ${booking.assignment_status}`);
    console.log(`   Has QR Manifest: ${!!booking.qr_manifest}\n`);

    // Step 2: Get QR images
    const bookingWithQr = await attachQrDataToBooking(booking);

    console.log("📸 QR IMAGE INFORMATION:");
    if (bookingWithQr.pickup_qr_image) {
      console.log(`   ✅ Pickup QR: ${bookingWithQr.pickup_qr_image.length} bytes`);
      console.log(`      Format: PNG Data URL`);
      console.log(`      Preview: ${bookingWithQr.pickup_qr_image.substring(0, 50)}...`);
    } else {
      console.log("   ❌ Pickup QR image is NULL");
    }

    if (bookingWithQr.destination_qr_image) {
      console.log(`   ✅ Destination QR: ${bookingWithQr.destination_qr_image.length} bytes`);
      console.log(`      Format: PNG Data URL`);
    } else {
      console.log("   ⚠️  Destination QR: NULL (likely locked)");
    }

    // Step 3: Test verification with the stored payload
    console.log("\n🔐 QR SIGNATURE VERIFICATION:");

    const manifest = bookingWithQr.qr_manifest;
    if (!manifest || !manifest.pickup) {
      console.log("❌ No manifest or pickup payload");
      return;
    }

    const pickupPayload = manifest.pickup.payload;
    console.log(`   Payload length: ${pickupPayload.length} bytes`);
    console.log(`   Payload preview: ${pickupPayload.substring(0, 60)}...`);

    // Try verifying with this payload
    const verifyResult = verifyQrPayload({
      bookingId: bookingWithQr.id,
      qrType: 'pickup',
      qrValue: pickupPayload,
      manifest: manifest,
      bookingRow: bookingWithQr
    });
    
    if (verifyResult.success) {
      console.log(`   ✅ Signature verified successfully!`);
      console.log(`   Status: ${verifyResult.status}`);
      console.log(`   Type: ${verifyResult.type}`);
    } else {
      console.log(`   ❌ Signature verification failed`);
      console.log(`   Reason: ${verifyResult.reason}`);
    }

    // Step 4: Simulate scanning the QR
    console.log("\n📱 SIMULATING AGENT SCAN:");
    console.log(`   Agent would send this payload to /verify-qr/103`);
    console.log(`   Expected result: success=true`);

    // Step 5: Recommendations
    console.log("\n💡 DIAGNOSTIC RECOMMENDATIONS:");
    console.log("   1. Verify receipt displays QR image correctly (check for blur/corruption)");
    console.log("   2. Test actual QR scan: Point agent camera at receipt QR");
    console.log("   3. If still failing, check agent camera library version (expo-camera)");
    console.log("   4. Check if QR generation library (qrcode) is up to date");
    console.log("   5. Add console.log to QrScannerScreen to log exact scanned data");

    console.log("\n✅ DIAGNOSTIC COMPLETE");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

diagnoseQrIssue();
