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

  useEffect(() => {
    if (!orderId || !amount || !apiKey) {
      Alert.alert('Error', 'Missing payment information');
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, amount, apiKey]);

  const handlePaymentSuccess = async (paymentResponse) => {
    try {
      setIsLoading(true);
      console.log('Payment Success Response:', paymentResponse);

      const bookingData = bookingDataString ? JSON.parse(bookingDataString) : {};

      // Prepare payment details for verification
      const paymentDetails = {
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpaySignature: paymentResponse.razorpay_signature,
      };

      console.log('Verifying payment with backend...');

      // Verify payment with backend
      const response = await fetch(
        'http://10.166.255.52:5000/api/payment/verify-payment',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            ...paymentDetails,
            bookingData: bookingData,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          'Payment Successful! 🎉',
          'Your luggage booking is confirmed!',
          [
            {
              text: 'View Receipt',
              onPress: () => {
                router.push({
                  pathname: '/(booking)/receipt',
                  params: {
                    bookingId: data.bookingId,
                  },
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('Verification Failed', data.message || 'Could not verify payment');
        router.back();
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      Alert.alert('Error', 'Failed to verify payment');
      router.back();
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
      console.log('Razorpay payment script initializing...');
      
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
          console.log('Payment Success:', response);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAYMENT_SUCCESS',
            data: response
          }));
        },
        modal: {
          ondismiss: function() {
            console.log('Payment modal dismissed');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_CANCEL'
            }));
          },
          confirm_close: true,
          escape: true
        }
      };

      // Create and open Razorpay
      const rzp1 = new Razorpay(options);
      
      rzp1.on('payment.failed', function (response) {
        console.log('Payment Failed:', response);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PAYMENT_ERROR',
          data: response
        }));
      });

      rzp1.on('payment.success', function (response) {
        console.log('Payment Success Event:', response);
      });

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
          try {
            const message = JSON.parse(event.nativeEvent.data);
            console.log('Message from WebView:', message);

            switch (message.type) {
              case 'PAYMENT_SUCCESS':
                setIsLoading(true);
                handlePaymentSuccess(message.data);
                break;
              case 'PAYMENT_ERROR':
                handlePaymentError(message.data);
                break;
              case 'PAYMENT_CANCEL':
                handlePaymentCancel();
                break;
              default:
                console.log('Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
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
