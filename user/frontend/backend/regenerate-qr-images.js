import db from "./db.js";
import { attachQrDataToBooking } from "./utils/bookingQr.js";

async function regenerateQrImages() {
  console.log("🔄 REGENERATING QR IMAGES FOR BOOKING #103...\n");

  try {
    // Fetch the booking
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

    console.log("✅ Booking loaded");
    console.log(`   ID: ${booking.id}`);
    console.log(`   Has qr_manifest: ${!!booking.qr_manifest}`);

    // Attach QR data (generates images)
    const bookingWithQr = await attachQrDataToBooking(booking);

    console.log("\n✅ QR Data Attached");
    console.log(`   pickup_qr_image length: ${bookingWithQr.pickup_qr_image?.length || 0}`);
    console.log(`   destination_qr_image length: ${bookingWithQr.destination_qr_image?.length || 0}`);

    if (bookingWithQr.pickup_qr_image) {
      console.log(`   Pickup QR preview: ${bookingWithQr.pickup_qr_image.substring(0, 50)}...`);
    }

    console.log("\n✅ QR IMAGES SUCCESSFULLY GENERATED!");
    console.log("\n📝 Note: Images are Data URLs stored in-memory for the receipt.");
    console.log("   The /api/bookings/:bookingId endpoint will generate them on-demand.");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

regenerateQrImages();
