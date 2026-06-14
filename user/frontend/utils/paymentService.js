import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend API URL from .env file - change EXPO_PUBLIC_API_URL in .env to update
const API_URL = `${process.env.EXPO_PUBLIC_API_URL || 'http://10.236.235.44:5000'}/api/payment`;

/**
 * Create a Razorpay order
 * @param {number} amount - Amount to be charged (in INR)
 * @param {object} bookingDetails - Booking details to include in order notes
 * @param {string} token - User authentication token
 * @returns {Promise<object>} - Order details with orderId and key
 */
export const createRazorpayOrder = async (amount, bookingDetails, token) => {
  try {
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

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to create payment order');
    }

    return data;
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw error;
  }
};

/**
 * Verify payment with Razorpay signature
 * @param {object} paymentDetails - Payment verification details
 * @param {string} paymentDetails.razorpayOrderId - Razorpay Order ID
 * @param {string} paymentDetails.razorpayPaymentId - Razorpay Payment ID
 * @param {string} paymentDetails.razorpaySignature - Razorpay Signature
 * @param {object} bookingData - Booking data to create after payment
 * @param {string} token - User authentication token
 * @returns {Promise<object>} - Verification response with booking details
 */
export const verifyRazorpayPayment = async (
  paymentDetails,
  bookingData,
  token
) => {
  try {
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

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Payment verification failed');
    }

    return data;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};

/**
 * Get payment receipt
 * @param {number} bookingId - Booking ID
 * @param {string} token - User authentication token
 * @returns {Promise<object>} - Receipt details
 */
export const getPaymentReceipt = async (bookingId, token) => {
  try {
    const response = await fetch(`${API_URL}/receipt/${bookingId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch receipt');
    }

    return data;
  } catch (error) {
    console.error('Error fetching receipt:', error);
    throw error;
  }
};

/**
 * Get payment status
 * @param {string} orderId - Razorpay Order ID
 * @param {string} token - User authentication token
 * @returns {Promise<object>} - Payment status
 */
export const getPaymentStatus = async (orderId, token) => {
  try {
    const response = await fetch(`${API_URL}/status/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching payment status:', error);
    throw error;
  }
};

/**
 * Initialize Razorpay payment
 * Requires Razorpay app to be installed or web checkout
 * @param {object} options - Razorpay checkout options
 * @returns {Promise} - Payment response
 */
export const initiateRazorpayPayment = (options) => {
  return new Promise((resolve, reject) => {
    // This would typically use a Razorpay React Native SDK
    // For now, we'll use a WebView-based approach
    try {
      // You need to integrate with Razorpay's official SDK
      // Install: expo install @razorpay/react-native
      // Then use it like:
      // RazorpayCheckout.open(options)
      //   .then(onPaymentSuccess)
      //   .catch(onPaymentError);

      // For testing without SDK, you can simulate payment
      console.log('Razorpay payment initiated with options:', options);

      // Simulated successful payment response
      const paymentResponse = {
        razorpay_payment_id: 'pay_' + Math.random().toString(36).substr(2, 14),
        razorpay_order_id: options.order_id,
        razorpay_signature:
          'signature_' + Math.random().toString(36).substr(2, 32),
      };

      resolve(paymentResponse);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Format currency for display
 * @param {number} amount - Amount in INR
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount) => {
  return `₹${parseFloat(amount).toFixed(2)}`;
};

/**
 * Calculate total price for booking
 * @param {number} bagCount - Number of bags
 * @param {string} weight - Total weight
 * @param {number} distance - Distance in KM
 * @returns {number} - Total price
 */
export const calculateBookingPrice = (bagCount, weight, distance) => {
  const basePrice = 299;
  const perBagPrice = 100;
  const perKmPrice = 10;

  let totalPrice = basePrice + bagCount * perBagPrice + distance * perKmPrice;

  // Apply discount for fragile items if needed
  return totalPrice;
};
