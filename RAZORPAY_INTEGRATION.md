# Razorpay Payment Integration Guide

## Overview
This guide explains how the Razorpay payment integration works in the Smart Luggage Agent application. The system handles the complete payment flow from order creation to receipt generation.

## Components Created

### 1. Backend Payment Routes (`backend/routes/payment.js`)
- **POST /api/payment/create-order** - Creates a Razorpay order
  - Accepts: amount, bookingDetails
  - Returns: orderId, amount, currency, key
  
- **POST /api/payment/verify-payment** - Verifies payment and creates booking
  - Accepts: razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingData
  - Creates booking with payment status = 'completed'
  - Returns: bookingId, razorpayPaymentId, razorpayOrderId

- **GET /api/payment/receipt/:bookingId** - Retrieves payment receipt
  - Returns: booking details + payment details from Razorpay

- **GET /api/payment/status/:orderId** - Checks payment status
  - Returns: order status and payment information

### 2. Database Schema Updates
Added columns to `bookings` table:
- `payment_status` VARCHAR(50) - Payment status (pending/completed/failed)
- `razorpay_order_id` VARCHAR(100) - Razorpay Order ID
- `razorpay_payment_id` VARCHAR(100) - Razorpay Payment ID
- `amount` DECIMAL(10, 2) - Booking amount
- `payment_method` VARCHAR(50) - Payment method used

### 3. Frontend Payment Service (`app/utils/paymentService.js`)
Utilities for payment handling:
- `createRazorpayOrder()` - Creates order on backend
- `verifyRazorpayPayment()` - Verifies payment signature
- `getPaymentReceipt()` - Fetches receipt details
- `getPaymentStatus()` - Checks payment status
- `formatCurrency()` - Formats amount for display

### 4. Receipt Screen (`app/(booking)/receipt.js`)
Displays payment receipt with:
- Payment success confirmation
- Booking details
- Flight information
- Luggage details
- Pickup/Drop locations
- Payment details and transaction ID
- Share and download receipt options

### 5. Updated Booking Confirmation (`app/(booking)/confirm.js`)
Integrated payment flow:
- Creates Razorpay order
- Simulates payment (ready for real SDK integration)
- Verifies payment signature
- Creates booking in database
- Navigates to receipt screen

## Payment Flow

```
1. User clicks "Proceed to Payment" on confirmation screen
   ↓
2. System calculates total amount
   ↓
3. Backend creates Razorpay order
   ↓
4. Razorpay checkout opens (payment gateway)
   ↓
5. User completes payment
   ↓
6. Frontend verifies signature with backend
   ↓
7. Backend confirms booking with payment_status = 'completed'
   ↓
8. Receipt screen displays all transaction details
```

## Configuration

### Environment Variables (.env)
```
Live_API_Key=rzp_live_SZQx72g7wEu5Oc
Live_Key_Secret=phhMoJ15VNlZ8j9CJHHhVHK8
PORT=5000
```

### Backend Setup
1. Install dependencies:
   ```bash
   cd user/frontend
   npm install razorpay
   ```

2. Payment routes are automatically registered in `server.js`

### Frontend Setup
1. Backend API URL is set to `http://192.168.0.104:5000` in paymentService.js
   - Update this to your actual backend URL if different

## Integration Steps for Real Razorpay Checkout

Currently, the payment is simulated. To use real Razorpay checkout:

### Option 1: React Native SDK (Recommended)
```bash
cd user/frontend
npm install @razorpay/react-native
```

Then update `app/(booking)/confirm.js`:
```javascript
import RazorpayCheckout from '@razorpay/react-native';

// Replace the payment simulation with:
RazorpayCheckout.open({
  key: orderResponse.key,
  amount: calculatedPrice * 100, // Amount in paise
  currency: 'INR',
  name: 'Smart Luggage Agent',
  description: `Luggage Service - Flight ${flightNo}`,
  image: 'https://your-logo-url.com/logo.png',
  order_id: orderResponse.orderId,
  prefill: {
    email: userEmail,
    contact: userPhone
  },
  theme: { color: '#FF6B6B' }
})
.then(data => {
  // Handle successful payment
  verifyRazorpayPayment(data, bookingData, userToken);
})
.catch(error => {
  Alert.alert('Payment Failed', error.message);
});
```

### Option 2: Web View (Alternative)
Use WebView to open Razorpay hosted checkout page.

## Receipt Features

The receipt screen includes:
- ✓ Payment confirmation badge
- ✓ Total amount paid
- ✓ Booking information
- ✓ Flight details
- ✓ Luggage details
- ✓ Pickup & drop locations
- ✓ Payment transaction details
- ✓ Share receipt functionality
- ✓ Download receipt option

### To Generate Receipt PDF (Future Enhancement)
Install a PDF library:
```bash
npm install react-native-pdf react-native-html-to-pdf
```

## API Response Examples

### Create Order Response:
```json
{
  "success": true,
  "orderId": "order_abc123xyz",
  "amount": 50000,
  "currency": "INR",
  "key": "rzp_live_SZQx72g7wEu5Oc"
}
```

### Verify Payment Response:
```json
{
  "success": true,
  "message": "Payment verified and booking confirmed",
  "bookingId": 42,
  "razorpayPaymentId": "pay_XYZ123",
  "razorpayOrderId": "order_abc123xyz"
}
```

### Receipt Response:
```json
{
  "success": true,
  "booking": {
    "id": 42,
    "username": "John Doe",
    "airline": "IndiGo",
    "flightNumber": "6E5432",
    "departureDate": "2025-04-15",
    "departureTime": "10:30 AM",
    "bagCount": 2,
    "bagWeight": "25kg"
  },
  "payment": {
    "amount": "500.00",
    "currency": "INR",
    "method": "card",
    "status": "captured",
    "paymentId": "pay_XYZ123",
    "orderId": "order_abc123xyz",
    "createdAt": "April 6, 2025 2:30 PM"
  }
}
```

## Troubleshooting

### Payment Order Creation Fails
- Check if Razorpay API keys are correct in .env
- Verify backend is running on correct port (5000)
- Check network connectivity

### Signature Verification Fails
- Ensure `Live_Key_Secret` matches your Razorpay account
- Check that order ID and payment ID are correct
- Verify crypto library is installed

### Receipt Not Loading
- Confirm booking ID is correct
- Check if payment was marked as 'completed' in database
- Verify user token is valid

### Receipt Screen Not Showing
- Check route path: `/(booking)/receipt`
- Ensure bookingId is passed as navigation parameter
- Verify AsyncStorage has saved userToken

## Testing Razorpay

For testing purposes, Razorpay provides test credentials:
- **Test Mode Order ID**: orders created in test mode
- **Test Cards**: Use provided test card numbers for simulating payments
- See: https://razorpay.com/docs/payments/payments-gateway/test-mode/

## Security Notes

⚠️ **Important Security Measures:**
1. Never expose `Live_Key_Secret` in frontend code (only in backend)
2. Always verify payment signatures on backend
3. Create booking only after successful signature verification
4. Store payment details securely in database
5. Use HTTPS for all payment communications
6. Rotate API keys periodically

## Next Steps

1. ✅ Backend payment routes created
2. ✅ Frontend UI components created
3. ✅ Receipt screen implemented
4. ⏳ Install and integrate Razorpay React Native SDK
5. ⏳ Test with real Razorpay test credentials
6. ⏳ Configure payment email notifications
7. ⏳ Implement payment failure handling & refunds
8. ⏳ Add SMS notifications for payment confirmation

## Support

For Razorpay documentation and support:
- Docs: https://razorpay.com/docs/
- Dashboard: https://dashboard.razorpay.com
- Support: https://razorpay.com/support/

## Files Modified/Created

```
Created:
- backend/routes/payment.js (Payment API routes)
- app/utils/paymentService.js (Frontend payment utilities)
- app/(booking)/receipt.js (Receipt display screen)

Modified:
- backend/server.js (Added payment routes)
- backend/initDB.js (Added payment columns)
- app/(booking)/confirm.js (Integrated payment flow)
```

---
**Last Updated**: April 6, 2025
**Integration Status**: Backend Ready, Frontend UI Ready, Awaiting Real SDK Integration
