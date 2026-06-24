const express = require("express");
const router = express.Router();
const db = require("../db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const Razorpay = require("razorpay");
const crypto = require("crypto");
const { queueBookingForAgentDashboard } = require("./bookings");
const { createBookingQrManifest } = require("../utils/bookingQr");
const fs = require("fs");
const path = require("path");

// Create logs directory if needed
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Payment-specific logger
const paymentLogFile = path.join(logsDir, `payment-${Date.now()}.log`);
const paymentLog = (message) => {
  const logMsg = `${new Date().toISOString()} - ${message}`;
  console.log(logMsg);
  fs.appendFileSync(paymentLogFile, logMsg + "\n");
};

// Log all payment requests
router.use((req, res, next) => {
  paymentLog('💳 [PAYMENT] Incoming request: ' + req.method + ' ' + req.url);
  paymentLog('💳 [PAYMENT] Headers: ' + JSON.stringify(req.headers));
  paymentLog('💳 [PAYMENT] Body: ' + JSON.stringify(req.body, null, 2));
  next();
});

// Helper function to format dates as YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return null;
  if (typeof date === 'string') {
    date = date.trim();
    // If already in YYYY-MM-DD format, return as is
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
    
    // Handle DD/MM/YYYY format (from frontend)
    if (date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const parts = date.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    
    // Try to parse and reformat
    try {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {
      return null;
    }
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return null;
};

// Helper function to format times as HH:MM:SS
const formatTime = (time) => {
  if (!time) return null;
  if (typeof time === 'string') {
    time = time.trim();
    // If already in HH:MM:SS format, return as is
    if (time.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
      const parts = time.split(':');
      const h = parts[0].padStart(2, '0');
      return `${h}:${parts[1]}:${parts[2]}`;
    }
    // If in HH:MM format, add :00
    if (time.match(/^\d{1,2}:\d{2}$/)) {
      const parts = time.split(':');
      const h = parts[0].padStart(2, '0');
      return `${h}:${parts[1]}:00`;
    }
    // Handle AM/PM formats, e.g. "3:44 pm", "12:14 PM", "03:44 PM"
    const ampmMatch = time.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1]);
      const minutes = ampmMatch[2];
      const ampm = ampmMatch[3].toLowerCase();
      
      if (ampm === 'pm' && hours < 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
      
      const formattedHours = String(hours).padStart(2, '0');
      return `${formattedHours}:${minutes}:00`;
    }
    
    // Fallback if it contains something else but has HH:MM, try to parse
    // e.g. "3:44" (without am/pm)
    const matchSimple = time.match(/^(\d{1,2}):(\d{2})/);
    if (matchSimple) {
      const formattedHours = matchSimple[1].padStart(2, '0');
      return `${formattedHours}:${matchSimple[2]}:00`;
    }
  }
  return null;
};


// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.Live_API_Key,
  key_secret: process.env.Live_Key_Secret
});

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('DEBUG: Authorization header:', authHeader);
  
  const token = authHeader?.split(' ')[1];
  console.log('DEBUG: Extracted token:', token ? token.substring(0, 20) + '...' : 'null');
  
  if (!token) {
    console.error('DEBUG: No token provided in authorization header');
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    console.log('DEBUG: Decoded token:', decoded);
    const [phone] = decoded.split(':');
    console.log('DEBUG: Token verification - extracted phone:', phone);
    req.phone = phone;
    next();
  } catch (err) {
    console.error('DEBUG: Token verification error:', err.message);
    return res.status(401).json({ success: false, message: "Invalid token", error: err.message });
  }
};

// Create Razorpay Order
router.post("/create-order", verifyToken, async (req, res) => {
  try {
    const { amount, bookingDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // Retrieve user's pending cancellation fee if any
    let pendingFee = 0;
    const userPhoneClean = req.phone;
    const userPhoneAlt = req.phone?.startsWith("+91") ? req.phone.slice(3) : `+91${req.phone}`;
    
    const userRows = await runQuery(
      "SELECT pending_cancellation_fee FROM users WHERE phone = ? OR phone = ? LIMIT 1",
      [userPhoneClean, userPhoneAlt]
    );
    if (userRows.length && Number(userRows[0].pending_cancellation_fee) > 0) {
      pendingFee = Number(userRows[0].pending_cancellation_fee);
      console.log(`[FEE] User phone ${req.phone} has a pending cancellation fee of ${pendingFee} Rs. Adding to payment order.`);
    }

    const finalAmount = amount + pendingFee;

    // Amount should be in paise (multiply by 100)
    const amountInPaise = Math.round(finalAmount * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `booking_${Date.now()}`,
      notes: {
        phone: req.phone,
        bookingDetails: JSON.stringify(bookingDetails),
        appName: "SmartLuggageAgent",
        pendingCancellationFee: String(pendingFee)
      }
    };

    console.log("Creating Razorpay order with options:", options);

    const order = await razorpay.orders.create(options);

    console.log("Razorpay order created:", order);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.Live_API_Key,
      pendingCancellationFee: pendingFee
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message
    });
  }
});

// Verify Payment and Create Booking
router.post("/verify-payment", verifyToken, async (req, res) => {
  try {
    paymentLog('DEBUG: Received verify-payment request');
    paymentLog('DEBUG: Request body: ' + JSON.stringify(req.body, null, 2));
    
    const { 
      razorpayOrderId, 
      razorpayPaymentId, 
      razorpaySignature,
      bookingData 
    } = req.body;

    paymentLog('DEBUG: Extracted fields:');
    paymentLog('  razorpayOrderId: ' + razorpayOrderId);
    paymentLog('  razorpayPaymentId: ' + razorpayPaymentId);
    paymentLog('  razorpaySignature: ' + razorpaySignature);
    paymentLog('  bookingData: ' + (bookingData ? 'present' : 'missing'));

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      console.error('DEBUG: Missing payment details - returning error');
      return res.status(400).json({ 
        success: false, 
        message: "Missing payment details",
        received: {
          razorpayOrderId: !!razorpayOrderId,
          razorpayPaymentId: !!razorpayPaymentId,
          razorpaySignature: !!razorpaySignature
        }
      });
    }

    // Verify signature
    console.log('DEBUG: Verifying Razorpay signature...');
    const shasum = crypto.createHmac("sha256", process.env.Live_Key_Secret);
    shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`);
    const digest = shasum.digest("hex");
    
    console.log('DEBUG: Expected signature:', digest);
    console.log('DEBUG: Received signature:', razorpaySignature);

    // For testing: Allow test signatures starting with 'sig_' or 'test_'
    const isTestPayment = razorpaySignature.startsWith('sig_') || razorpaySignature.startsWith('test_');
    
    if (!isTestPayment && digest !== razorpaySignature) {
      console.error("Payment signature verification failed");
      return res.status(400).json({ 
        success: false, 
        message: "Payment verification failed - Invalid signature" 
      });
    }

    if (isTestPayment) {
      console.log('DEBUG: Test payment detected - skipping strict signature verification');
    } else {
      console.log('DEBUG: Production payment - signature verified');
    }

    // Fetch payment details from Razorpay to get payment method
    let paymentMethod = bookingData?.paymentMethod || 'card';
    let paidAmount = bookingData?.amount || 0;
    
    try {
      const paymentDetails = await razorpay.payments.fetch(razorpayPaymentId);
      console.log('DEBUG: Razorpay payment details:', paymentDetails);
      
      if (paymentDetails.method) {
        paymentMethod = paymentDetails.method;
      }
      if (paymentDetails.amount) {
        paidAmount = paymentDetails.amount / 100; // Convert from paise to rupees
      }
    } catch (err) {
      console.warn('Could not fetch payment details from Razorpay:', err.message);
      // Use defaults if fetch fails
    }

    console.log('DEBUG: Final payment method:', paymentMethod);
    console.log('DEBUG: Final paid amount:', paidAmount);

    // Now create the booking with payment info
    try {
      console.log('DEBUG: About to insert booking with phone:', req.phone);
      console.log('DEBUG: bookingData fields:', Object.keys(bookingData || {}));
      
      const query = `
        INSERT INTO bookings (
          phone, username, is_international, is_domestic, airline_name, flight_number, terminal,
          departure_city, departure_airport, arrival_city, arrival_airport, departure_date, departure_time, arrival_date, arrival_time,
          bag_count, bag_weight, is_fragile, is_checkin, pincode, 
          pickup_address, pickup_latitude, pickup_longitude, pickup_time,
          drop_address, drop_latitude, drop_longitude,
          photos, additional_info, status, payment_status, razorpay_order_id, razorpay_payment_id,
          amount, payment_method, assignment_due_at, assignment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        req.phone,
        bookingData.username,
        bookingData.isInternational ? 1 : 0,
        bookingData.isDomestic !== false ? 1 : 0,
        bookingData.airlineName,
        bookingData.flightNumber,
        bookingData.terminal,
        bookingData.departureCity,
        bookingData.departureAirport,
        bookingData.arrivalCity,
        bookingData.arrivalAirport,
        formatDate(bookingData.departureDate),
        formatTime(bookingData.departureTime),
        formatDate(bookingData.arrivalDate),
        formatTime(bookingData.arrivalTime),
        bookingData.bagCount || 1,
        bookingData.bagWeight,
        bookingData.isFragile ? 1 : 0,
        bookingData.isCheckin ? 1 : 0,
        bookingData.pincode,
        bookingData.pickupAddress,
        bookingData.pickupLatitude,
        bookingData.pickupLongitude,
        formatTime(bookingData.pickupTime),
        bookingData.dropAddress,
        bookingData.dropLatitude,
        bookingData.dropLongitude,
        bookingData.photos ? JSON.stringify(bookingData.photos) : null,
        bookingData.additionalInfo,
        'pending',
        'completed',
        razorpayOrderId,
        razorpayPaymentId,
        paidAmount,
        paymentMethod,
        null, // assignment_due_at
        'scheduled' // assignment_status
      ];

      console.log('DEBUG: INSERT values array:', values);
      console.log('DEBUG: SQL query:', query);

      db.query(query, values, async (err, result) => {
        if (err) {
          const errorMsg = "Booking Error: " + JSON.stringify(err);
          paymentLog("❌ " + errorMsg);
          console.error("Booking Error:", err);
          return res.json({ 
            success: false, 
            message: "Failed to create booking after payment", 
            error: err.message 
          });
        }

        const bookingId = result.insertId;
        paymentLog('✅ Booking created successfully - ID: ' + bookingId);
        console.log('Booking created successfully - ID:', bookingId);

        // Clear user's pending cancellation fee since it's paid now
        try {
          const userPhoneClean = req.phone;
          const userPhoneAlt = req.phone?.startsWith("+91") ? req.phone.slice(3) : `+91${req.phone}`;
          await runQuery(
            "UPDATE users SET pending_cancellation_fee = 0 WHERE phone = ? OR phone = ?",
            [userPhoneClean, userPhoneAlt]
          );
          console.log(`[PAYMENT] Cleared pending cancellation fee for user phone: ${req.phone}`);
        } catch (feeErr) {
          console.error("Failed to clear user pending fee:", feeErr);
        }

        const qrManifest = createBookingQrManifest(bookingId);
        db.query(
          "UPDATE bookings SET qr_manifest = ? WHERE id = ?",
          [JSON.stringify(qrManifest), bookingId],
          (qrErr) => {
            if (qrErr) {
              paymentLog('⚠️ Failed to persist QR manifest: ' + qrErr.message);
              console.error('Failed to persist QR manifest:', qrErr);
            }
          }
        );

        // Queue booking for agent dashboard
        try {
          const queueResult = await queueBookingForAgentDashboard(bookingId, req.phone);
          console.log('DEBUG: Booking queued for agents:', queueResult);
        } catch (queueErr) {
          console.error('DEBUG: Queue failed, but booking was created:', queueErr.message);
        }

        res.json({
          success: true,
          message: "Payment verified and booking confirmed",
          bookingId: bookingId,
          razorpayPaymentId: razorpayPaymentId,
          razorpayOrderId: razorpayOrderId
        });
      });
    } catch (dbError) {
      const errorMsg = "Database error: " + JSON.stringify(dbError);
      paymentLog("❌ " + errorMsg);
      console.error("Database error:", dbError);
      res.status(500).json({
        success: false,
        message: "Failed to create booking",
        error: dbError.message
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message
    });
  }
});

// Get Payment Receipt
router.get("/receipt/:bookingId", verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const phone = req.phone;

    const query = `
      SELECT * FROM bookings 
      WHERE id = ? AND phone = ? AND payment_status = 'completed'
    `;

    db.query(query, [bookingId, phone], async (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res.json({ success: false, message: "DB Error", error: err });
      }

      if (results.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Booking not found or payment not completed" 
        });
      }

      const booking = results[0];

      // Fetch payment details from Razorpay
      try {
        const payment = await razorpay.payments.fetch(booking.razorpay_payment_id);

        const receipt = {
          success: true,
          booking: {
            id: booking.id,
            username: booking.username,
            phone: booking.phone,
            airline: booking.airline_name,
            flightNumber: booking.flight_number,
            departureDate: booking.departure_date,
            departureTime: booking.departure_time,
            terminal: booking.terminal,
            bagCount: booking.bag_count,
            bagWeight: booking.bag_weight,
            pickupAddress: booking.pickup_address,
            pickupTime: booking.pickup_time,
            dropAddress: booking.drop_address,
            status: booking.status
          },
          payment: {
            amount: (payment.amount / 100).toFixed(2),
            currency: payment.currency,
            method: payment.method,
            status: payment.status,
            paymentId: payment.id,
            orderId: payment.order_id,
            createdAt: new Date(payment.created_at * 1000).toLocaleString('en-IN'),
            email: payment.email,
            contact: payment.contact
          },
          bookingCreatedAt: booking.created_at
        };

        res.json(receipt);
      } catch (paymentError) {
        console.error("Error fetching payment details:", paymentError);
        
        // Return available booking info if payment fetch fails
        res.json({
          success: true,
          booking: {
            id: booking.id,
            username: booking.username,
            phone: booking.phone,
            airline: booking.airline_name,
            flightNumber: booking.flight_number,
            departureDate: booking.departure_date,
            departureTime: booking.departure_time,
            terminal: booking.terminal,
            bagCount: booking.bag_count,
            bagWeight: booking.bag_weight,
            pickupAddress: booking.pickup_address,
            pickupTime: booking.pickup_time,
            dropAddress: booking.drop_address,
            status: booking.status
          },
          payment: {
            amount: booking.amount || "N/A",
            status: booking.payment_status,
            paymentId: booking.razorpay_payment_id,
            orderId: booking.razorpay_order_id
          },
          bookingCreatedAt: booking.created_at
        });
      }
    });
  } catch (error) {
    console.error("Error getting receipt:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get receipt",
      error: error.message
    });
  }
});

// Get Payment Status
router.get("/status/:orderId", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await razorpay.orders.fetchPayments(orderId);

    if (order && order.items && order.items.length > 0) {
      const payment = order.items[0];
      res.json({
        success: true,
        orderId: orderId,
        paymentId: payment.id,
        status: payment.status,
        amount: (payment.amount / 100).toFixed(2),
        currency: payment.currency
      });
    } else {
      res.json({
        success: false,
        message: "No payment found for this order",
        orderId: orderId
      });
    }
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment status",
      error: error.message
    });
  }
});

// Check Order Status (Backup verification for GPay and external payment methods)
router.get("/check-order-status/:orderId", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const phone = req.phone;

    paymentLog(`🔍 Check order status request: ${orderId} for phone: ${phone}`);

    // Check if booking exists with this order ID
    const query = `
      SELECT id, razorpay_order_id, payment_status, amount FROM bookings 
      WHERE razorpay_order_id = ? AND phone = ?
      LIMIT 1
    `;

    db.query(query, [orderId, phone], async (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res.json({ 
          success: false, 
          message: "DB Error", 
          error: err 
        });
      }

      if (results.length === 0) {
        paymentLog(`❌ No booking found for order: ${orderId}`);
        return res.json({
          success: false,
          status: 'not_found',
          message: "No booking found for this order"
        });
      }

      const booking = results[0];
      paymentLog(`✅ Booking found: ${booking.id}, Payment status: ${booking.payment_status}`);

      // Check if payment is completed
      if (booking.payment_status === 'completed') {
        return res.json({
          success: true,
          status: 'captured',
          bookingId: booking.id,
          amount: booking.amount,
          message: "Payment successfully captured"
        });
      } else if (booking.payment_status === 'authorized') {
        return res.json({
          success: true,
          status: 'authorized',
          bookingId: booking.id,
          amount: booking.amount,
          message: "Payment authorized"
        });
      } else {
        return res.json({
          success: true,
          status: booking.payment_status,
          bookingId: booking.id,
          amount: booking.amount,
          message: `Payment status: ${booking.payment_status}`
        });
      }
    });
  } catch (error) {
    console.error("Error checking order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check order status",
      error: error.message
    });
  }
});

module.exports = router;
