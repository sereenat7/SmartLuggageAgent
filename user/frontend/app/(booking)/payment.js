import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function RazorpayPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    orderId,
    amount,
    apiKey,
    userName,
    userEmail,
    userPhone,
    bookingData: bookingDataString,
    userToken,
  } = params;

  // Test backend connectivity
  const testBackendConnection = async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.227.242.44:5000';
      console.log('🔌 Testing backend connectivity to:', apiUrl);
      
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      console.log('✅ Backend connectivity test successful:', data);
      return true;
    } catch (error) {
      console.error('❌ Backend connectivity test FAILED:', error);
      console.error('Error message:', error.message);
      return false;
    }
  };

  useEffect(() => {
    if (!orderId || !amount || !apiKey) {
      Alert.alert('Error', 'Missing payment information');
      router.back();
    }
    // Test backend connectivity on component load
    testBackendConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, amount, apiKey]);

  const handlePaymentSuccess = async (paymentResponse) => {
    try {
      setIsLoading(true);
      console.log('✅ STEP 1: Payment Success Response:', paymentResponse);

      let bookingData = {};
      try {
        bookingData = bookingDataString ? JSON.parse(bookingDataString) : {};
        console.log('✅ STEP 2: Booking Data parsed:', bookingData);
      } catch (parseErr) {
        console.error('❌ STEP 2 ERROR: Failed to parse booking data:', parseErr.message);
        throw parseErr;
      }

      // Prepare payment details for verification
      const paymentDetails = {
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpaySignature: paymentResponse.razorpay_signature,
      };

      console.log('✅ STEP 3: Payment Details prepared:', paymentDetails);

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.227.242.44:5000';
      const verifyUrl = `${apiUrl}/api/payment/verify-payment`;
      console.log(`✅ STEP 4: API URL ready: ${verifyUrl}`);
      console.log(`✅ STEP 4: Token: ${userToken ? userToken.substring(0, 20) + '...' : 'NO TOKEN'}`);

      // Verify payment with backend
      console.log('🔄 STEP 5: About to call fetch...');
      
      let response;
      try {
        response = await fetch(verifyUrl, {
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
        console.log('✅ STEP 6: Fetch completed, Status:', response.status);
      } catch (fetchErr) {
        console.error('❌ STEP 6 ERROR: Fetch failed:', fetchErr.message);
        console.error('Fetch error type:', fetchErr.constructor.name);
        console.error('Fetch error details:', JSON.stringify(fetchErr));
        throw new Error(`Network request failed: ${fetchErr.message}`);
      }

      let data;
      try {
        data = await response.json();
        console.log('✅ STEP 7: Response parsed:', data);
      } catch (jsonErr) {
        console.error('❌ STEP 7 ERROR: Failed to parse response JSON:', jsonErr.message);
        console.error('Raw response status:', response.status);
        throw jsonErr;
      }

      if (data.success) {
        // Auto-navigate to receipt without showing alert
        console.log('✅ STEP 8: Payment verified successfully. Navigating to receipt...');
        router.replace({
          pathname: '/(booking)/receipt',
          params: {
            bookingId: data.bookingId,
          },
        });
      } else {
        console.error('❌ STEP 8 ERROR: Verification failed:', data.message);
        Alert.alert('Verification Failed', data.message || 'Could not verify payment', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('❌ CRITICAL ERROR in handlePaymentSuccess:', error);
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Full error object:', JSON.stringify(error));
      Alert.alert('Error', `Failed to verify payment: ${error.message}`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentError = (error) => {
    console.error('Payment Error:', error);
    Alert.alert(
      'Payment Failed',
      error.description || error.message || 'Payment failed. Please try again.',
      [
        {
          text: 'Try Again',
          onPress: () => router.back(),
        },
        {
          text: 'Cancel',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const handlePaymentCancel = () => {
    Alert.alert(
      'Payment Cancelled',
      'You have cancelled the payment. Please try again.',
      [
        {
          text: 'Go Back',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const injectedJavaScript = `
    (function() {
      console.log('🔧 Razorpay payment script initializing...');
      console.log('🔧 Checking ReactNativeWebView availability...');
      console.log('🔧 ReactNativeWebView:', typeof window.ReactNativeWebView !== 'undefined' ? 'AVAILABLE' : 'NOT AVAILABLE');
      
      // Razorpay configuration with all payment methods prominently displayed
      const options = {
        key: '${apiKey}',
        amount: ${amount},
        currency: 'INR',
        name: 'Smart Luggage Agent',
        description: '${bookingDataString ? JSON.parse(bookingDataString).flightNumber : 'Luggage Booking'}',
        image: 'https://rzp.io/l/eMB5hml',
        order_id: '${orderId}',
        prefill: {
          name: '${userName || 'User'}',
          email: '${userEmail || 'user@example.com'}',
          contact: '${userPhone || '9004223553'}'
        },
        theme: {
          color: '#667eea',
          backdrop_color: 'rgba(102, 126, 234, 0.1)',
          hide_topbar: false
        },
        notes: {
          booking_type: 'luggage_booking',
          app: 'smart_luggage_agent'
        },
        method: {
          upi: true,
          netbanking: true,
          card: true,
          wallet: true,
          google_pay: false,
          opl: false,
          paylater: false,
          emandate: 'netbanking'
        },
        retry: {
          enabled: true,
          max_count: 3
        },
        handler: function(response) {
          console.log('🎉 Razorpay handler called - Payment Success:', response);
          const message = {
            type: 'PAYMENT_SUCCESS',
            data: response
          };
          console.log('📤 Sending message to React Native:', message);
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
            console.log('✅ Message sent via ReactNativeWebView');
          } else {
            console.error('❌ ReactNativeWebView not available - cannot send message');
          }
        },
        modal: {
          ondismiss: function() {
            console.log('🚫 Payment modal dismissed by user');
            const message = { type: 'PAYMENT_CANCEL' };
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(message));
            }
          },
          confirm_close: true,
          escape: true
        }
      };

      console.log('🔧 Creating Razorpay instance...');
      // Create and open Razorpay
      const rzp1 = new Razorpay(options);
      
      rzp1.on('payment.failed', function (response) {
        console.log('❌ Payment Failed event:', response);
        const message = {
          type: 'PAYMENT_ERROR',
          data: response
        };
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      });

      rzp1.on('payment.success', function (response) {
        console.log('✅ Payment Success event fired:', response);
      });

      console.log('🔧 Opening Razorpay payment gateway...');
      // Open payment gateway immediately
      rzp1.open();
    })();
  `;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Smart Luggage Agent - Payment</title>
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #f5f5f5;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .loader-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .spinner {
          border: 4px solid #f0f0f0;
          border-top: 4px solid #ff9500;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading-text {
          color: #333;
          font-size: 16px;
          font-weight: 500;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="loader-container">
          <div class="spinner"></div>
          <h2 class="loading-text">Opening payment gateway...</h2>
        </div>
      </div>
      <script>
        ${injectedJavaScript}
      </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      {isLoading && (
        <View style={styles.webViewLoader}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.webViewLoaderText}>Initializing Secure Payment...</Text>
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        onMessage={(event) => {
          console.log('📨 RECEIVED MESSAGE FROM WEBVIEW');
          console.log('Raw event:', event);
          try {
            const messageData = event.nativeEvent.data;
            console.log('📨 Message data received:', messageData);
            
            const message = JSON.parse(messageData);
            console.log('📨 Parsed message:', message);
            console.log('📨 Message type:', message.type);

            switch (message.type) {
              case 'PAYMENT_SUCCESS':
                console.log('✅ PAYMENT_SUCCESS received - calling handlePaymentSuccess');
                setIsLoading(true);
                handlePaymentSuccess(message.data);
                break;
              case 'PAYMENT_ERROR':
                console.log('❌ PAYMENT_ERROR received - calling handlePaymentError');
                handlePaymentError(message.data);
                break;
              case 'PAYMENT_CANCEL':
                console.log('🚫 PAYMENT_CANCEL received - calling handlePaymentCancel');
                handlePaymentCancel();
                break;
              default:
                console.log('❓ Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('❌ Error parsing WebView message:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
        }}
        onLoadStart={() => {
          console.log('🔧 WebView onLoadStart');
          setIsLoading(true);
        }}
        onLoadEnd={() => {
          console.log('✅ WebView onLoadEnd - Payment gateway should now be visible');
          setIsLoading(false);
        }}
        onError={(syntheticEvent) => {
          console.error('❌ WebView error:', syntheticEvent.nativeEvent);
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        style={styles.webView}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webView: {
    flex: 1,
  },
  webViewLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    zIndex: 1000,
  },
  webViewLoaderText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
});
