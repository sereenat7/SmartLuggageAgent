# Razorpay Payment Flow Analysis - User Frontend App

## Payment-Related Files

### Frontend Payment Files

#### 1. [user/frontend/app/(booking)/confirm.js](user/frontend/app/(booking)/confirm.js)
**Purpose:** Booking confirmation screen where payment is initiated  
**Key Flow:**
- User reviews booking summary
- Clicks "Proceed to Payment" button
- Calls `createRazorpayOrder()` to create order at backend
- Shows payment modal with Razorpay checkout

**Key Code Snippet:**
```javascript
const handleConfirmBooking = async () => {
  // Prepares booking data (flight, luggage, pickup, drop details)
  const bookingData = {
    username: userName,
    isInternational, isDomestic,
    airlineName, flightNumber, terminal,
    departureCity, departureAirport, departureDate, departureTime,
    bagCount, bagWeight, isFragile, isCheckin,
    pincode,
    pickupAddress, pickupLatitude, pickupLongitude, pickupTime,
    dropAddress, dropLatitude, dropLongitude,
    photos, additionalInfo,
    amount: calculatedPrice,
    paymentMethod: 'card',
  };

  // Step 1: Create Razorpay Order
  const orderResponse = await createRazorpayOrder(
    calculatedPrice,
    bookingData,
    userToken
  );

  // Step 2: Show Razorpay Payment Modal
  setPaymentData({
    orderId: orderResponse.orderId,
    amount: orderResponse.amount,
    apiKey: orderResponse.key,
    userName: bookingData.username,
    userPhone: '+919004223553',
    bookingData: bookingData,
    userToken: userToken,
  });
  setShowRazorpayModal(true);
};
```

---

#### 2. [user/frontend/app/(booking)/payment.js](user/frontend/app/(booking)/payment.js)
**Purpose:** WebView-based Razorpay checkout modal  
**Key Features:**
- Uses WebView to render Razorpay checkout.js library
- Handles payment success, error, and cancellation callbacks
- Communicates with React Native via `ReactNativeWebView.postMessage()`

**Payment Methods Configured:**
- UPI
- Netbanking
- Card
- Wallet
- Retry enabled (max 3 attempts)

**Key Code Snippets:**

**Razorpay Configuration:**
```javascript
const options = {
  key: '${apiKey}',
  amount: ${amount},
  currency: 'INR',
  name: 'Smart Luggage Agent',
  order_id: '${orderId}',
  prefill: {
    name: '${userName}',
    email: '${userEmail}',
    contact: '${userPhone}'
  },
  theme: {
    color: '#667eea',
  },
  method: {
    upi: true,
    netbanking: true,
    card: true,
    wallet: true,
  },
  retry: {
    enabled: true,
    max_count: 3
  },
  handler: function(response) {
    // Success handler
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'PAYMENT_SUCCESS',
      data: response
    }));
  },
  modal: {
    ondismiss: function() {
      // Cancellation handler
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAYMENT_CANCEL'
      }));
    },
    confirm_close: true,
    escape: true
  }
};
```

**Success Callback Handler:**
```javascript
const handlePaymentSuccess = async (paymentResponse) => {
  // STEP 1: Parse payment response
  const paymentDetails = {
    razorpayOrderId: paymentResponse.razorpay_order_id,
    razorpayPaymentId: paymentResponse.razorpay_payment_id,
    razorpaySignature: paymentResponse.razorpay_signature,
  };

  // STEP 5-7: Call backend to verify payment
  const response = await fetch(`${apiUrl}/api/payment/verify-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      ...paymentDetails,
      bookingData: bookingData,
    }),
  });

  // STEP 8: Navigate to receipt on success
  if (data.success) {
    router.replace({
      pathname: '/(booking)/receipt',
      params: { bookingId: data.bookingId },
    });
  }
};
```

**Error Handler:**
```javascript
const handlePaymentError = (error) => {
  Alert.alert(
    'Payment Failed',
    error.description || 'Payment failed. Please try again.',
    [
      { text: 'Try Again', onPress: () => router.back() },
      { text: 'Cancel', onPress: () => router.back() },
    ]
  );
};
```

**Cancel Handler:**
```javascript
const handlePaymentCancel = () => {
  Alert.alert(
    'Payment Cancelled',
    'You have cancelled the payment. Please try again.',
    [{ text: 'Go Back', onPress: () => router.back() }]
  );
};
```

---

#### 3. [user/frontend/app/(booking)/payment-success.js](user/frontend/app/(booking)/payment-success.js)
**Purpose:** Success screen shown after payment verification  
**Features:**
- Animated checkmark with spring animation
- Displays booking ID
- Two CTAs: "View Receipt" and "Continue to Home"

**Key Code:**
```javascript
export default function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scaleAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleViewReceipt = () => {
    router.push({
      pathname: '/(booking)/receipt',
      params: { bookingId: params.bookingId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.checkmarkContainer, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient colors={['#34C759', '#30B0C0']}>
          <Feather name="check" size={80} color="#FFF" />
        </LinearGradient>
      </Animated.View>

      <Text style={styles.successTitle}>Booking Confirmed!</Text>
      <Text style={styles.successSubtitle}>Your luggage booking has been successfully confirmed</Text>

      <View style={styles.bookingIdBox}>
        <Text style={styles.bookingIdLabel}>Booking ID</Text>
        <Text style={styles.bookingIdValue}>{params.bookingId}</Text>
      </View>

      <TouchableOpacity onPress={handleViewReceipt}>
        {/* View Receipt Button */}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
        {/* Continue to Home Button */}
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

---

#### 4. [user/frontend/utils/paymentService.js](user/frontend/utils/paymentService.js)
**Purpose:** Payment API service functions  
**Key Functions:**

```javascript
// Create Razorpay Order
export const createRazorpayOrder = async (amount, bookingDetails, token) => {
  const response = await fetch(`${API_URL}/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount: parseFloat(amount),
      bookingDetails: bookingDetails,
    }),
  });
  // Returns: { success: true, orderId, amount, currency, key }
};

// Verify Payment with Signature
export const verifyRazorpayPayment = async (paymentDetails, bookingData, token) => {
  const response = await fetch(`${API_URL}/verify-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      razorpayOrderId: paymentDetails.razorpayOrderId,
      razorpayPaymentId: paymentDetails.razorpayPaymentId,
      razorpaySignature: paymentDetails.razorpaySignature,
      bookingData: bookingData,
    }),
  });
  // Returns: { success: true, bookingId, ... }
};

// Get Payment Receipt
export const getPaymentReceipt = async (bookingId, token) => {
  // Endpoint: GET /api/payment/receipt/:bookingId
};

// Get Payment Status
export const getPaymentStatus = async (orderId, token) => {
  // Endpoint: GET /api/payment/status/:orderId
};
```

---

### Backend Payment Files

#### 5. [user/frontend/backend/routes/payment.js](user/frontend/backend/routes/payment.js)
**Purpose:** Backend payment processing and Razorpay integration  
**Razorpay Configuration:**
```javascript
const razorpay = new Razorpay({
  key_id: process.env.Live_API_Key,
  key_secret: process.env.Live_Key_Secret
});
```

**API Endpoints:**

##### POST `/api/payment/create-order`
**Flow:**
1. Verify user token (extract phone)
2. Convert amount to paise (multiply by 100)
3. Create Razorpay order with booking details in notes
4. Return orderId, amount, currency, and API key

**Code:**
```javascript
router.post("/create-order", verifyToken, async (req, res) => {
  const { amount, bookingDetails } = req.body;
  
  const amountInPaise = Math.round(amount * 100);
  const options = {
    amount: amountInPaise,
    currency: "INR",
    receipt: `booking_${Date.now()}`,
    notes: {
      phone: req.phone,
      bookingDetails: JSON.stringify(bookingDetails),
      appName: "SmartLuggageAgent"
    }
  };

  const order = await razorpay.orders.create(options);
  
  res.json({
    success: true,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: process.env.Live_API_Key
  });
});
```

##### POST `/api/payment/verify-payment`
**Flow:**
1. Verify user token
2. Validate payment details (orderId, paymentId, signature)
3. Verify Razorpay signature (HMAC-SHA256)
4. Fetch payment details from Razorpay
5. Insert booking into database with payment info
6. Create QR manifest for booking
7. Queue booking for agent assignment
8. Return bookingId

**Code:**
```javascript
router.post("/verify-payment", verifyToken, async (req, res) => {
  const { 
    razorpayOrderId, 
    razorpayPaymentId, 
    razorpaySignature,
    bookingData 
  } = req.body;

  // Verify Signature
  const shasum = crypto.createHmac("sha256", process.env.Live_Key_Secret);
  shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`);
  const digest = shasum.digest("hex");

  if (digest !== razorpaySignature) {
    return res.status(400).json({ 
      success: false, 
      message: "Payment verification failed - Invalid signature" 
    });
  }

  // Fetch payment details from Razorpay
  const paymentDetails = await razorpay.payments.fetch(razorpayPaymentId);
  let paymentMethod = paymentDetails.method;
  let paidAmount = paymentDetails.amount / 100; // Convert from paise

  // Insert booking into database
  const query = `
    INSERT INTO bookings (
      phone, username, is_international, is_domestic, airline_name, flight_number, terminal,
      departure_city, departure_airport, arrival_city, arrival_airport, departure_date, departure_time,
      bag_count, bag_weight, is_fragile, is_checkin, pincode, 
      pickup_address, pickup_latitude, pickup_longitude, pickup_time,
      drop_address, drop_latitude, drop_longitude,
      photos, additional_info, status, payment_status, razorpay_order_id, razorpay_payment_id,
      amount, payment_method, assignment_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, values, async (err, result) => {
    if (err) {
      return res.json({ 
        success: false, 
        message: "Failed to create booking after payment", 
        error: err.message 
      });
    }

    const bookingId = result.insertId;

    // Create QR Manifest
    const qrManifest = createBookingQrManifest(bookingId);
    db.query(
      "UPDATE bookings SET qr_manifest = ? WHERE id = ?",
      [JSON.stringify(qrManifest), bookingId]
    );

    // Queue for agent dashboard
    await queueBookingForAgentDashboard(bookingId, req.phone);

    res.json({
      success: true,
      message: "Payment verified and booking confirmed",
      bookingId: bookingId,
      razorpayPaymentId: razorpayPaymentId,
      razorpayOrderId: razorpayOrderId
    });
  });
});
```

##### GET `/api/payment/receipt/:bookingId`
**Flow:**
1. Verify user token
2. Fetch booking from database (where phone matches)
3. Fetch payment details from Razorpay
4. Return receipt with booking and payment info

**Returns:**
```javascript
{
  success: true,
  booking: {
    id, username, phone, airline, flightNumber,
    departureDate, departureTime, terminal,
    bagCount, bagWeight, pickupAddress, pickupTime, dropAddress, status
  },
  payment: {
    amount, currency, method, status,
    paymentId, orderId, createdAt, email, contact
  },
  bookingCreatedAt
}
```

##### GET `/api/payment/status/:orderId`
**Purpose:** Check payment status by order ID

---

## Database Schema

### Bookings Table Payment Fields
```sql
ALTER TABLE bookings ADD payment_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE bookings ADD razorpay_order_id VARCHAR(100);
ALTER TABLE bookings ADD razorpay_payment_id VARCHAR(100);
ALTER TABLE bookings ADD payment_method VARCHAR(50);
```

**Status Values:**
- `payment_status`: 'pending' → 'completed'
- `status`: 'pending' → 'completed'
- `assignment_status`: 'scheduled'

---

## Complete Payment Flow Diagram

```
User → Booking Summary Screen (confirm.js)
  ↓
[User clicks "Proceed to Payment"]
  ↓
Call createRazorpayOrder() → Backend /create-order
  ↓
Backend: 
  - Verify token (extract phone)
  - Convert amount to paise
  - Create Razorpay order
  ↓ (Returns: orderId, amount, key)
  ↓
Show RazorpayPayment Modal (payment.js - WebView)
  ↓
User enters payment details
  ↓
Razorpay Checkout Gateway
  ├→ UPI / Card / Netbanking / Wallet
  ├→ Handler: window.ReactNativeWebView.postMessage()
  ├→ Success: type: 'PAYMENT_SUCCESS'
  ├→ Error: type: 'PAYMENT_ERROR'
  └→ Cancel: type: 'PAYMENT_CANCEL'
  ↓
Payment Response → handlePaymentSuccess()
  ↓
Call verifyRazorpayPayment() → Backend /verify-payment
  ↓
Backend:
  - Verify Razorpay signature
  - Fetch payment details from Razorpay
  - Insert booking with payment info
  - Create QR manifest
  - Queue for agent assignment
  ↓ (Returns: bookingId)
  ↓
Navigate to Receipt Screen (payment-success.js)
  ↓
[Animated success screen with booking ID]
  ↓
User can view receipt or continue to home
```

---

## Error Handling

### Current Error Handling

**Frontend:**
- Payment Success Failures: Alert + back navigation
- Payment Errors: Alert with error message
- Payment Cancellation: Confirmation alert

**Backend:**
- Signature verification failures: Return 400 with invalid signature message
- Database errors: Return 500 with error message
- Razorpay API failures: Return appropriate error response

### Logging
- Payment requests logged to file: `logs/payment-{timestamp}.log`
- Detailed logging of all steps with timestamps

---

## Key Implementation Details

### Token Format
- Token is base64-encoded string: `phone:password`
- Decoded in verifyToken middleware to extract phone

### Amount Conversion
- Frontend: Amount in INR (e.g., 499)
- Backend: Converts to paise (multiply by 100): 49900
- Razorpay API: Works with paise
- Receipt: Amount divided by 100 to show INR

### Payment Methods Configuration
```javascript
method: {
  upi: true,           // Enabled
  netbanking: true,    // Enabled
  card: true,          // Enabled
  wallet: true,        // Enabled
  google_pay: false,   // Disabled
  opl: false,          // Disabled
  paylater: false,     // Disabled
}
```

### Retry Logic
- Max 3 retry attempts enabled
- User can retry failed payments

### Booking Assignment
- After payment verification, booking is automatically queued for agent assignment
- Assignment status: 'scheduled'
- Payment status: 'completed'

---

## Environment Variables Required

```
EXPO_PUBLIC_API_URL=http://10.110.169.52:5000
Live_API_Key=<Razorpay API Key>
Live_Key_Secret=<Razorpay Key Secret>
```

---

## Navigation Flow After Payment

- **Success:** confirm.js → payment.js (modal) → payment-success.js → receipt.js
- **Failure:** payment.js (error alert) → back to confirm.js
- **Cancellation:** payment.js (cancel alert) → back to confirm.js

---

## Testing URLs/Endpoints

- Create Order: `POST /api/payment/create-order`
- Verify Payment: `POST /api/payment/verify-payment`
- Get Receipt: `GET /api/payment/receipt/:bookingId`
- Payment Status: `GET /api/payment/status/:orderId`
