import React from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  SafeAreaView, Platform, StatusBar, ActivityIndicator, Alert, Modal 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { createBooking } from '../../utils/bookingService';
import { calculatePrice, calculateDistance } from '../../utils/pricingCalculator';
import { createRazorpayOrder, verifyRazorpayPayment } from '../../utils/paymentService';
import { normalizeImageList } from '../utils/imageHelpers';
import { useState, useMemo, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

export default function BookingSummary() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const [isLoading, setIsLoading] = useState(false);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const webViewRef = useRef(null);
  
  // State for pickup coordinates (freshly loaded from AsyncStorage)
  const [pickupCoords, setPickupCoords] = useState({
    latitude: params.pickupLatitude ? parseFloat(params.pickupLatitude) : null,
    longitude: params.pickupLongitude ? parseFloat(params.pickupLongitude) : null
  });

  // Load latest pickup coordinates from AsyncStorage on mount
  useEffect(() => {
    const loadPickupCoordinates = async () => {
      try {
        const pickupDetails = await AsyncStorage.getItem('pickupLocationDetails');
        if (pickupDetails) {
          const data = JSON.parse(pickupDetails);
          setPickupCoords({
            latitude: data.latitude,
            longitude: data.longitude
          });
        }
      } catch (error) {
        console.error("Error loading pickup coordinates:", error);
      }
    };

    loadPickupCoordinates();
  }, []);

  // Destructure all data passed through the chain
  const { 
    // From flight.js
    airline = "Not selected", 
    flightNo = "N/A", 
    depCity = "", 
    depTime = "",
    depDate = "",
    terminal = "T2",
    depAirport = "",
    isInternational = "false",
    
    // From luggage.js
    bags = "0", 
    weight = "0 kg",
    checkin = false,
    fragile = false,
    dropLocation = "Not available",
    dropLatitude = "",
    dropLongitude = "",
    photos = "[]",

    // From pickup.js
    pickupAddress = "Not provided", 
    pickupTime = "",
    pincode = "",
    additionalInfo = "",
    pickupLatitude = "",
    pickupLongitude = ""
  } = params;

  // Calculate price and distance dynamically
  const { calculatedPrice, distance } = useMemo(() => {
    try {
      // Use pickup coordinates from state (freshly loaded from AsyncStorage)
      const pLat = pickupCoords.latitude;
      const pLon = pickupCoords.longitude;
      const dLat = parseFloat(dropLatitude);
      const dLon = parseFloat(dropLongitude);

      // Calculate distance if we have valid coordinates
      let dist = 0;
      if (!isNaN(pLat) && !isNaN(pLon) && !isNaN(dLat) && !isNaN(dLon)) {
        dist = calculateDistance(pLat, pLon, dLat, dLon);
      }

      // Parse bag count (convert to number)
      const bagCount = parseInt(bags) || 1;

      // Calculate final price
      const price = calculatePrice(bagCount, weight, dist);

      return { calculatedPrice: price, distance: dist.toFixed(2) };
    } catch (error) {
      console.error("Error calculating price:", error);
      // Fallback to base price if calculation fails
      return { calculatedPrice: 299, distance: "0" };
    }
  }, [bags, weight, dropLatitude, dropLongitude, pickupCoords]);

  // Function to fetch coordinates for drop location
  const getDropLocationCoordinates = async (address) => {
    try {
      const GEO_API_KEY = "6a6f5450f3164727b88686b4a5a0fffd";
      console.log("Fetching coordinates for address:", address);
      
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${GEO_API_KEY}`
      );
      const data = await response.json();
      
      console.log("Geoapify API Response:", JSON.stringify(data, null, 2));
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        
        // Handle coordinates from geometry
        let latitude = null;
        let longitude = null;
        
        if (feature.geometry && feature.geometry.coordinates) {
          // Geoapify returns [lon, lat] in geometry.coordinates
          [longitude, latitude] = feature.geometry.coordinates;
        } else if (feature.properties) {
          // Try to get from properties
          latitude = feature.properties.lat;
          longitude = feature.properties.lon;
        }
        
        console.log("Extracted coordinates - Latitude:", latitude, "Longitude:", longitude);
        
        if (latitude && longitude) {
          return { latitude, longitude };
        }
      }
      
      console.warn("No valid coordinates found in Geoapify response");
      return { latitude: null, longitude: null };
    } catch (error) {
      console.error("Error fetching drop location coordinates:", error);
      return { latitude: null, longitude: null };
    }
  };

  const handleConfirmBooking = async () => {
    setIsLoading(true);
    try {
      // Get user details and token from AsyncStorage
      const userName = await AsyncStorage.getItem('userName');
      const userToken = await AsyncStorage.getItem('authToken');

      console.log('DEBUG: Retrieved token from AsyncStorage:', userToken);
      
      if (!userToken) {
        Alert.alert('Error', 'Please login to continue');
        setIsLoading(false);
        return;
      }

      // Use the drop location coordinates passed through the flow
      const dropCoords = {
        latitude: dropLatitude ? parseFloat(dropLatitude) : null,
        longitude: dropLongitude ? parseFloat(dropLongitude) : null
      };
      
      console.log("Using drop coordinates from flow:", dropCoords);

      // Parse photos array
      let photosArray = [];
      try {
        photosArray = photos ? JSON.parse(photos) : [];
      } catch (e) {
        console.log("Could not parse photos:", e);
      }

      const normalizedPhotos = await normalizeImageList(photosArray);

      // Prepare booking data
      const bookingData = {
        // User details
        username: userName || 'User',
        
        // Flight Details
        isInternational: isInternational === 'true',
        isDomestic: !(isInternational === 'true'),
        airlineName: airline,
        flightNumber: flightNo,
        terminal: terminal || 'T2',
        departureCity: depCity,
        departureAirport: depAirport,
        departureDate: depDate,
        departureTime: depTime,
        arrivalCity: depCity, // You may want to add this to params
        arrivalAirport: depAirport, // You may want to add this to params
        arrivalDate: depDate, // You may want to add this to params
        arrivalTime: depTime, // You may want to add this to params

        // Luggage Details
        bagCount: parseInt(bags) || 1,
        bagWeight: weight,
        isFragile: fragile === 'true' || fragile === true,
        isCheckin: checkin === 'true' || checkin === true,

        // Pincode
        pincode: pincode,

        // Pickup Location with coordinates from state
        pickupAddress: pickupAddress,
        pickupLatitude: pickupCoords.latitude,
        pickupLongitude: pickupCoords.longitude,
        pickupTime: pickupTime,

        // Drop Location with coordinates
        dropAddress: dropLocation,
        dropLatitude: dropCoords.latitude,
        dropLongitude: dropCoords.longitude,

        // Photos
        photos: normalizedPhotos,

        // Additional Info
        additionalInfo: additionalInfo,

        // Payment Info
        amount: calculatedPrice,
        paymentMethod: 'card',
      };

      // Step 1: Create Razorpay Order
      console.log('Creating Razorpay order for amount:', calculatedPrice);
      const orderResponse = await createRazorpayOrder(
        calculatedPrice,
        bookingData,
        userToken
      );

      if (!orderResponse.success) {
        Alert.alert('Error', orderResponse.message || 'Failed to create payment order');
        setIsLoading(false);
        return;
      }

      console.log('Order created successfully:', orderResponse);
      setIsLoading(false);

      // Step 2: Show Razorpay Payment Modal
      setPaymentData({
        orderId: orderResponse.orderId,
        amount: orderResponse.amount,
        apiKey: orderResponse.key,
        userName: bookingData.username,
        userEmail: '',
        userPhone: '+919004223553',
        bookingData: bookingData,
        userToken: userToken,
      });
      setShowRazorpayModal(true);
    } catch (error) {
      console.error('Error confirming booking:', error);
      Alert.alert('Error', error.message || 'Failed to confirm booking');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentResponse) => {
    try {
      setIsLoading(true);
      setShowRazorpayModal(false);
      console.log('Payment Success Response:', paymentResponse);

      // Verify payment with backend
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://10.159.173.44:5000'}/api/payment/verify-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${paymentData.userToken}`,
          },
          body: JSON.stringify({
            razorpayOrderId: paymentResponse.razorpay_order_id,
            razorpayPaymentId: paymentResponse.razorpay_payment_id,
            razorpaySignature: paymentResponse.razorpay_signature,
            bookingData: paymentData.bookingData,
          }),
        }
      );

      const data = await response.json();
      setIsLoading(false);

      if (data.success) {
        // Navigate to success page
        router.push({
          pathname: '/(booking)/payment-success',
          params: {
            bookingId: data.bookingId,
          },
        });
      } else {
        Alert.alert('Verification Failed', data.message || 'Could not verify payment');
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Error verifying payment:', error);
      Alert.alert('Error', 'Failed to verify payment');
    }
  };

  const handlePaymentError = (error) => {
    console.error('Payment Error:', error);
    Alert.alert(
      'Payment Failed',
      error.description || error.message || 'Payment failed. Please try again.'
    );
  };

  const generatePaymentHTML = () => {
    if (!paymentData) return '';

    const injectedJavaScript = `
      (function() {
        console.log('Razorpay payment script initializing...');
        
        const options = {
          key: '${paymentData.apiKey}',
          amount: ${paymentData.amount},
          currency: 'INR',
          name: 'Smart Luggage Agent',
          description: '${paymentData.bookingData.flightNumber}',
          image: 'https://rzp.io/l/eMB5hml',
          order_id: '${paymentData.orderId}',
          prefill: {
            name: '${paymentData.userName || 'User'}',
            email: '${paymentData.userEmail || 'user@example.com'}',
            contact: '${paymentData.userPhone || '9004223553'}'
          },
          theme: {
            color: '#FF9500'
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
            emandate: 'netbanking'
          },
          display: 'page',
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

        const rzp1 = new Razorpay(options);
        
        rzp1.on('payment.failed', function (response) {
          console.log('Payment Failed:', response);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAYMENT_ERROR',
            data: response
          }));
        });

        // Show loading screen, then open with full payment options
        setTimeout(() => {
          document.getElementById('loadingScreen').style.display = 'none';
          rzp1.open();
        }, 800);
      })();
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Smart Luggage Agent - Payment</title>
        <script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            background: #f5f5f5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          #loadingScreen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: #f5f5f5;
            z-index: 9999;
          }
          .spinner {
            border: 4px solid #f0f0f0;
            border-top: 4px solid #ff9500;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .loading-text {
            color: #333;
            font-size: 16px;
            font-weight: 500;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div id="loadingScreen">
          <div class="spinner"></div>
          <p class="loading-text">Opening payment gateway...</p>
        </div>
        <script>
          ${injectedJavaScript}
        <\/script>
      </body>
      </html>
    `;

    return htmlContent;
  };

  const handlePaymentCancel = () => {
    setShowRazorpayModal(false);
    Alert.alert(
      'Payment Cancelled',
      'You have cancelled the payment. Please try again.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={26} color="#1A1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirmation</Text>
        <View style={{ width: 44 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.hero}>
          <View style={styles.iconWrapper}>
            <LinearGradient colors={['#FFF1F1', '#FFE4E4']} style={styles.iconCircle}>
              <Feather name="file-text" size={32} color="#FF5F5F" />
            </LinearGradient>
          </View>
          <Text style={styles.heroTitle}>Booking Summary</Text>
          <Text style={styles.heroSub}>Review your trip details below</Text>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.tag}>SUMMARY</Text>
            <Text style={styles.idText}>#LB-88291</Text>
          </View>

          {/* DYNAMIC FLIGHT DETAILS */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconBg}>
              <Feather name="send" size={16} color="#FF5F5F" />
            </View>
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Flight</Text>
              <Text style={styles.detailMain}>{flightNo} • {airline}</Text>
              <Text style={styles.detailSub}>{depCity} • {depTime}</Text>
            </View>
          </View>

          {/* DYNAMIC LUGGAGE DETAILS */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconBg}>
              <Feather name="shopping-bag" size={16} color="#FF5F5F" />
            </View>
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Luggage</Text>
              <Text style={styles.detailMain}>{bags} {parseInt(bags) === 1 ? 'Bag' : 'Bags'} ({checkin ? 'Check-in' : 'Cargo'})</Text>
              <Text style={styles.detailSub}>Max {weight} total{fragile ? ' • Fragile' : ''}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIconBg}>
              <Feather name="map-pin" size={16} color="#FF5F5F" />
            </View>
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Pickup Location</Text>
              <Text style={styles.detailMain}>{pickupAddress}</Text>
              {pickupTime ? <Text style={styles.detailSub}>{pickupTime}</Text> : null}
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIconBg}>
              <Feather name="navigation" size={16} color="#FF5F5F" />
            </View>
            <View style={styles.detailTexts}>
              <Text style={styles.detailLabel}>Drop Location</Text>
              <Text style={styles.detailMain}>{dropLocation}</Text>
            </View>
          </View>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Total to Pay</Text>
          <Text style={styles.priceValue}>₹{calculatedPrice.toFixed(2)}</Text>
          <Text style={styles.priceBreakdown}>
            {distance > 0 ? `${distance} km away` : "Calculating..."}
          </Text>
          <View style={styles.dotLine} />
          <Text style={styles.priceInfo}>EVERYTHING INCLUDED</Text>
        </View>

        <TouchableOpacity activeOpacity={0.9} style={styles.payButton} onPress={handleConfirmBooking} disabled={isLoading}>
          <LinearGradient 
            colors={['#FF6B6B', '#FF8E53']} 
            start={{x: 0, y: 0}} 
            end={{x: 1, y: 1}} 
            style={styles.gradientBtn}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.payButtonText}>Proceed to Payment</Text>
                <Feather name="chevron-right" size={20} color="#FFF" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.modifyBtn} onPress={() => router.back()}>
          <Text style={styles.modifyText}>Modify Booking</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Razorpay Payment Modal */}
      <Modal
        visible={showRazorpayModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowRazorpayModal(false);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
            <TouchableOpacity onPress={() => {
              setShowRazorpayModal(false);
            }}>
              <Feather name="arrow-left" size={28} color="#1A1C1E" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1C1E' }}>Payment</Text>
            <View style={{ width: 28 }} />
          </View>

          <WebView
            ref={webViewRef}
            source={{ html: generatePaymentHTML() }}
            onMessage={(event) => {
              try {
                const message = JSON.parse(event.nativeEvent.data);
                console.log('Message from WebView:', message);

                switch (message.type) {
                  case 'PAYMENT_SUCCESS':
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
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            scrollEnabled={true}
            style={{ flex: 1 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 45 : 20, 
    height: Platform.OS === 'android' ? 100 : 80,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1C1E', letterSpacing: -0.5 },
  scrollContent: { paddingHorizontal: 24 },
  hero: { alignItems: 'center', marginTop: 10, marginBottom: 25 },
  iconWrapper: { marginBottom: 12 },
  iconCircle: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#1A1C1E', letterSpacing: -0.8 },
  heroSub: { fontSize: 15, color: '#8E8E93', marginTop: 4 },
  mainCard: { backgroundColor: '#FFF', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: '#F2F2F7', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 4, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  tag: { fontSize: 11, fontWeight: '800', color: '#FF5F5F', letterSpacing: 1 },
  idText: { fontSize: 13, fontWeight: '600', color: '#AEAEB2' },
  detailRow: { flexDirection: 'row', marginBottom: 20 },
  detailIconBg: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF5F5', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  detailTexts: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '500', marginBottom: 2 },
  detailMain: { fontSize: 15, color: '#1A1C1E', fontWeight: '700' },
  detailSub: { fontSize: 13, color: '#C7C7CC', marginTop: 2 },
  priceCard: { backgroundColor: '#FAFAFC', borderRadius: 24, padding: 20, alignItems: 'center', marginBottom: 25, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#E5E5EA' },
  priceLabel: { fontSize: 14, color: '#8E8E93', fontWeight: '600' },
  priceValue: { fontSize: 38, fontWeight: '900', color: '#1C1C1E', marginVertical: 4 },
  priceBreakdown: { fontSize: 12, color: '#A7A7AC', fontWeight: '500', marginTop: 4, marginBottom: 8 },
  dotLine: { width: 30, height: 2, backgroundColor: '#E5E5EA', marginVertical: 8 },
  priceInfo: { fontSize: 10, color: '#C7C7CC', fontWeight: '800' },
  payButton: { shadowColor: '#FF6B6B', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  gradientBtn: { height: 64, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  payButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800', marginRight: 8 },
  modifyBtn: { alignSelf: 'center', marginTop: 15 },
  modifyText: { color: '#C7C7CC', fontWeight: '700', fontSize: 14 },
});
