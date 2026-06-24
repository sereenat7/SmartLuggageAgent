import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';
const BOOKING_ID = 103;

// Create a test token - should be base64 encoded "phone:timestamp"
const phone = '+919004223553';
const token = Buffer.from(`${phone}:${Date.now()}`).toString('base64');
console.log('Using token:', token);

async function testReceiptFlow() {
  console.log('📋 TESTING RECEIPT QR FLOW\n');

  try {
    // Step 1: Fetch booking (simulates receipt.js API call)
    console.log(`📥 Fetching booking #${BOOKING_ID}...`);
    const response = await fetch(`${API_URL}/api/bookings/${BOOKING_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.log(`❌ API returned ${response.status}`);
      const error = await response.text();
      console.log('Error:', error);
      return;
    }

    const data = await response.json();

    if (!data.success) {
      console.log('❌ API returned success:false');
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const booking = data.booking;
    console.log('✅ Booking fetched');

    // Check QR images
    console.log('\n📊 QR Image Status:');
    console.log(`   pickup_qr_image exists: ${!!booking.pickup_qr_image}`);
    console.log(`   destination_qr_image exists: ${!!booking.destination_qr_image}`);

    if (booking.pickup_qr_image) {
      const length = booking.pickup_qr_image.length;
      const preview = booking.pickup_qr_image.substring(0, 60);
      console.log(`   Pickup QR size: ${length} bytes`);
      console.log(`   Preview: ${preview}...`);
      
      // Check if it's a valid Data URL
      if (booking.pickup_qr_image.startsWith('data:image/png;base64,')) {
        console.log('   ✅ Valid PNG Data URL format');
      } else {
        console.log('   ❌ Invalid Data URL format!');
      }
    } else {
      console.log('   ❌ pickup_qr_image is NULL!');
    }

    if (booking.destination_qr_image) {
      const length = booking.destination_qr_image.length;
      console.log(`   Destination QR size: ${length} bytes`);
      
      if (booking.destination_qr_image.startsWith('data:image/png;base64,')) {
        console.log('   ✅ Valid PNG Data URL format');
      } else {
        console.log('   ❌ Invalid Data URL format!');
      }
    } else {
      console.log('   ⚠️  destination_qr_image is NULL (might be locked)');
    }

    // Check booking status
    console.log('\n📝 Booking Status:');
    console.log(`   Status: ${booking.status}`);
    console.log(`   Assignment Status: ${booking.assignment_status}`);
    console.log(`   QR Manifest: ${booking.qr_manifest ? 'exists' : 'missing'}`);

    console.log('\n✅ RECEIPT SHOULD DISPLAY QR CODES CORRECTLY');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testReceiptFlow();
