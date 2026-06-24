import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Share,
  StatusBar,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Image } from 'react-native';

export default function ReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [sharingPDF, setSharingPDF] = useState(false);

  useEffect(() => {
    fetchReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.bookingId]);

  const fetchReceipt = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await AsyncStorage.getItem('authToken');
      const bookingId = params.bookingId;

      console.log('📋 Receipt Debug:', { bookingId, hasToken: !!token });

      if (!bookingId) {
        console.warn('❌ No booking ID provided');
        // Create a fallback receipt
        setReceipt({
          success: true,
          booking: {
            id: 'N/A',
            username: await AsyncStorage.getItem('userName') || 'User',
            phone: await AsyncStorage.getItem('userPhone') || 'N/A',
            airline_name: 'N/A',
            flight_number: 'N/A',
            departure_date: new Date().toLocaleDateString(),
            departure_time: 'N/A',
            terminal: 'N/A',
            pickup_address: 'N/A',
            status: 'confirmed'
          },
          payment: {
            amount: 0,
            status: 'paid',
            method: 'Razorpay',
            transactionId: 'N/A'
          },
          bookingCreatedAt: new Date().toISOString()
        });
        return;
      }

      // Try to fetch booking details
      try {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || 'http://172.16.111.44:5000'}/api/bookings/${bookingId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` })
            },
            timeout: 10000
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Receipt data fetched:', data);

          if (data.success && data.booking) {
            const booking = data.booking;
            setReceipt({
              success: true,
              booking: {
                id: booking.id || bookingId,
                username: booking.username || 'User',
                phone: booking.phone || 'N/A',
                airline_name: booking.airline_name || 'N/A',
                flight_number: booking.flight_number || 'N/A',
                departure_date: booking.departure_date || 'N/A',
                departure_time: booking.departure_time || 'N/A',
                terminal: booking.terminal || 'N/A',
                airport: booking.arrival_airport || booking.airport || 'N/A',
                pickup_address: booking.pickup_address || 'N/A',
                pickup_time: booking.pickup_time || 'N/A',
                luggage_count: booking.bag_count || 0,
                total_weight: booking.bag_weight || 0,
                fragile_items: booking.is_fragile || false,
                status: booking.status || 'confirmed',
                pickup_qr_image: booking.pickup_qr_image || null,
                destination_qr_image: booking.destination_qr_image || null,
              },
              payment: {
                amount: booking.amount || 0,
                status: booking.payment_status || 'completed',
                method: booking.payment_method || 'Razorpay',
                transactionId: booking.razorpay_payment_id || 'N/A',
                orderId: booking.razorpay_order_id || 'N/A',
                paymentTime: booking.created_at || new Date().toISOString()
              },
              bookingCreatedAt: booking.created_at || new Date().toISOString()
            });
            return;
          }
        }
      } catch (fetchErr) {
        console.warn('⚠️ API fetch failed:', fetchErr.message);
      }

      // If API fails, create a basic receipt from available data
      const userName = await AsyncStorage.getItem('userName');
      const userPhone = await AsyncStorage.getItem('userPhone');

      setReceipt({
        success: true,
        booking: {
          id: bookingId,
          username: userName || 'User',
          phone: userPhone || 'N/A',
          airline_name: 'Pending',
          flight_number: 'Pending',
          departure_date: new Date().toLocaleDateString(),
          departure_time: 'Pending',
          terminal: 'Pending',
          airport: 'Pending',
          pickup_address: 'Pending',
          pickup_time: 'Pending',
          luggage_count: 0,
          total_weight: 0,
          fragile_items: false,
          status: 'confirmed',
          pickup_qr_image: null,
          destination_qr_image: null,
        },
        payment: {
          amount: 0,
          status: 'completed',
          method: 'Razorpay',
          transactionId: 'N/A',
          orderId: 'N/A',
          paymentTime: new Date().toISOString()
        },
        bookingCreatedAt: new Date().toISOString()
      });

    } catch (err) {
      console.error('❌ Error in fetchReceipt:', err);
      // Still show a receipt even if there's an error
      try {
        const userName = await AsyncStorage.getItem('userName');
        const userPhone = await AsyncStorage.getItem('userPhone');
        const bookingId = params.bookingId || 'N/A';

        setReceipt({
          success: true,
          booking: {
            id: bookingId,
            username: userName || 'User',
            phone: userPhone || 'N/A',
            airline_name: 'N/A',
            flight_number: 'N/A',
            departure_date: new Date().toLocaleDateString(),
            departure_time: 'N/A',
            terminal: 'N/A',
            airport: 'N/A',
            pickup_address: 'N/A',
            pickup_time: 'N/A',
            luggage_count: 0,
            total_weight: 0,
            fragile_items: false,
            status: 'confirmed',
            pickup_qr_image: null,
            destination_qr_image: null,
          },
          payment: {
            amount: 0,
            status: 'completed',
            method: 'Razorpay',
            transactionId: 'N/A',
            orderId: 'N/A',
            paymentTime: new Date().toISOString()
          },
          bookingCreatedAt: new Date().toISOString()
        });
      } catch (fallbackErr) {
        setError('Failed to load receipt. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateReceiptHTML = () => {
    if (!receipt) return '';

    const { booking, payment, bookingCreatedAt } = receipt;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Arial', sans-serif;
            background: #f5f5f5;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .logo-section {
            margin-bottom: 20px;
          }
          .logo-text {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 8px;
            letter-spacing: 1px;
          }
          .tagline {
            font-size: 14px;
            opacity: 0.9;
          }
          .status-badge {
            display: inline-block;
            background: #34C759;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .amount-section {
            background: linear-gradient(135deg, rgba(255, 107, 107, 0.05) 0%, rgba(255, 142, 83, 0.05) 100%);
            padding: 30px;
            text-align: center;
            border-bottom: 1px solid #eee;
          }
          .amount-label {
            font-size: 14px;
            color: #999;
            font-weight: 600;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .amount-value {
            font-size: 48px;
            font-weight: bold;
            color: #34C759;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
          }
          .currency {
            font-size: 28px;
          }
          .section {
            padding: 30px;
            border-bottom: 1px solid #f0f0f0;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #FF8E53;
            display: inline-block;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 14px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #f5f5f5;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #666;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .info-value {
            color: #333;
            font-weight: 500;
            font-size: 13px;
            text-align: right;
            font-family: 'Courier New', monospace;
          }
          .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #ddd, transparent);
            margin: 20px 0;
          }
          .location-card {
            background: #f9f9f9;
            border-left: 4px solid #FF8E53;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 4px;
          }
          .location-type {
            font-size: 12px;
            font-weight: bold;
            color: #FF8E53;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          .location-address {
            font-size: 13px;
            color: #333;
            font-weight: 500;
            line-height: 1.5;
          }
          .location-time {
            font-size: 12px;
            color: #999;
            margin-top: 5px;
          }
          .footer {
            background: #f9f9f9;
            padding: 30px;
            text-align: center;
            border-top: 2px solid #f0f0f0;
          }
          .footer-message {
            font-size: 14px;
            color: #666;
            margin-bottom: 15px;
            line-height: 1.6;
          }
          .footer-contact {
            font-size: 12px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .receipt-id {
            background: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            margin-top: 10px;
          }
          .qr-section {
            text-align: center;
            padding: 30px;
          }
          .qr-section-title {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #FF8E53;
            display: inline-block;
            padding-bottom: 12px;
          }
          .qr-code-image {
            max-width: 200px;
            height: auto;
            margin: 0 auto;
            display: block;
            border: 2px solid #f0f0f0;
            padding: 10px;
            border-radius: 8px;
            background: white;
          }
          .qr-instructions {
            font-size: 12px;
            color: #666;
            margin-top: 15px;
            font-style: italic;
          }
          .print-divider {
            page-break-after: avoid;
          }
          @media print {
            body {
              padding: 0;
              background: white;
            }
            .container {
              box-shadow: none;
              border-radius: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-section">
              <div class="logo-text">Payment Receipt</div>
              <div class="tagline">Booking Receipt</div>
            </div>
            <div class="status-badge">✓ Payment Confirmed</div>
          </div>

          <div class="amount-section">
            <div class="amount-label">Amount Paid</div>
            <div class="amount-value">
              <span class="currency">₹</span>
              <span>${payment.amount}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Booking Information</div>
            <div class="info-row">
              <span class="info-label">Booking ID</span>
              <span class="info-value">${booking.id}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Customer Name</span>
              <span class="info-value">${booking.username}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Phone</span>
              <span class="info-value">${booking.phone}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Booking Date</span>
              <span class="info-value">${bookingCreatedAt}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status</span>
              <span class="info-value" style="color: #34C759; font-weight: bold;">${booking.status.toUpperCase()}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Flight Details</div>
            <div class="info-row">
              <span class="info-label">Airline</span>
              <span class="info-value">${booking.airline_name || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Flight Number</span>
              <span class="info-value">${booking.flight_number || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Departure Date</span>
              <span class="info-value">${booking.departure_date || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Departure Time</span>
              <span class="info-value">${booking.departure_time || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Terminal</span>
              <span class="info-value">${booking.terminal || 'N/A'}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Luggage Details</div>
            <div class="info-row">
              <span class="info-label">Number of Bags</span>
              <span class="info-value">${booking.luggage_count || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Total Weight</span>
              <span class="info-value">${booking.total_weight || 'N/A'} kg</span>
            </div>
            <div class="info-row">
              <span class="info-label">Fragile Items</span>
              <span class="info-value">${booking.fragile_items ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Locations</div>
            <div class="location-card">
              <div class="location-type">📍 Pickup Location</div>
              <div class="location-address">${booking.pickup_address || 'N/A'}</div>
              <div class="location-time">Time: ${booking.pickup_time || 'N/A'}</div>
            </div>
            <div class="location-card">
              <div class="location-type">📌 Airport</div>
              <div class="location-address">${booking.airport || 'N/A'} - ${booking.terminal || 'N/A'}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Payment Details</div>
            <div class="info-row">
              <span class="info-label">Amount</span>
              <span class="info-value">₹${payment.amount || 0}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Payment Method</span>
              <span class="info-value">${payment.method || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Order ID</span>
              <span class="info-value">${payment.orderId || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Transaction ID</span>
              <span class="info-value">${payment.transactionId || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Payment Time</span>
              <span class="info-value">${payment.paymentTime ? new Date(payment.paymentTime).toLocaleString() : 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status</span>
              <span class="info-value" style="color: #34C759; font-weight: bold;">${payment.status ? payment.status.toUpperCase() : 'PAID'}</span>
            </div>
          </div>

          <div class="section qr-section">
            <div class="qr-section-title">Luggage Verification QR</div>
            ${booking.pickup_qr_image ? `
              <img src="${booking.pickup_qr_image}" alt="Pickup QR Code" class="qr-code-image" />
              <div class="qr-instructions">
                Present this QR code to the agent at pickup time for verification
              </div>
            ` : `
              <div style="color: #999; font-size: 13px;">QR code not available</div>
            `}
          </div>

          <div class="footer">
            <div class="footer-message">
              Thank you for choosing Smart Luggage Agent!<br>
              We look forward to serving you again.
            </div>
            <div class="receipt-id">Receipt ID: ${booking.id}</div>
            <div class="footer-contact">
              For support, contact: support@smartluggageagent.com
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleGeneratePDF = async () => {
    try {
      setGeneratingPDF(true);
      console.log('=== Starting PDF Generation ===');
      
      const html = generateReceiptHTML();
      
      // Step 1: Generate PDF to temporary location
      console.log('Step 1: Generating PDF...');
      const { uri: tempUri } = await Print.printToFileAsync({ html });
      console.log('✓ Temp PDF created at:', tempUri);
      
      // Step 2: Create filename
      const fileName = `Receipt_${receipt.booking.id}_${Date.now()}.pdf`;
      console.log('Step 2: Filename:', fileName);
      
      // Step 3: Use documentDirectory which is persistent and accessible
      const documentDir = FileSystem.documentDirectory;
      console.log('Document directory:', documentDir);
      
      const pdfUri = documentDir + fileName;
      console.log('Step 3: Target path:', pdfUri);

      // Step 4: Copy from temp to permanent location
      console.log('Step 4: Copying file...');
      await FileSystem.copyAsync({
        from: tempUri,
        to: pdfUri,
      });
      console.log('✓ File copied successfully');

      // Step 5: Verify file exists and get size
      console.log('Step 5: Verifying file...');
      const fileInfo = await FileSystem.getInfoAsync(pdfUri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('File was not created successfully');
      }

      console.log('✓ File verified. Size:', fileInfo.size, 'bytes');

      // Step 6: Store path globally
      global.pdfPath = pdfUri;
      global.pdfFileName = fileName;
      console.log('Step 6: Path stored globally');
      
      console.log('=== PDF Generation Complete ===');

      // Step 7: Show success
      Alert.alert(
        '✓ PDF Downloaded!',
        `${fileName}\n\nSize: ${(fileInfo.size / 1024).toFixed(2)} KB\n\nReady to share`,
        [{ text: 'OK', onPress: () => {} }],
        { cancelable: true }
      );

    } catch (error) {
      console.error('❌ PDF Generation Error:', error);
      console.error('Error stack:', error.stack);
      Alert.alert(
        'Error', 
        `Failed to save PDF:\n${error.message}`
      );
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleSharePDF = async () => {
    try {
      setSharingPDF(true);
      console.log('=== Starting PDF Share ===');
      console.log('PDF Path:', global.pdfPath);
      
      if (!global.pdfPath) {
        Alert.alert('⚠️ No PDF Found', 'Please download PDF first before sharing');
        setSharingPDF(false);
        return;
      }

      // Verify file still exists
      console.log('Checking if file exists...');
      const fileInfo = await FileSystem.getInfoAsync(global.pdfPath);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        Alert.alert('⚠️ PDF Not Found', 'The PDF file was deleted. Please download again.');
        global.pdfPath = null;
        setSharingPDF(false);
        return;
      }

      console.log('✓ File verified. Starting share...');
      
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Error', 'Sharing not available on this device');
        setSharingPDF(false);
        return;
      }

      console.log('Opening share dialog for:', global.pdfPath);
      
      await Sharing.shareAsync(global.pdfPath, {
        mimeType: 'application/pdf',
        dialogTitle: `Receipt - ${receipt.booking.id}`,
        filename: global.pdfFileName || 'receipt.pdf',
      });
      
      console.log('=== Share Complete ===');
      
    } catch (error) {
      console.error('❌ Share Error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Only show error if user didn't cancel
      if (error.message !== 'User did not share' && error.code !== 'CANCELED') {
        Alert.alert('Error', `Failed to share:\n${error.message}`);
      }
    } finally {
      setSharingPDF(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Feather name="alert-circle" size={60} color="#FF3B30" />
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              fetchReceipt();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!receipt) {
    return null;
  }

  const { booking, payment } = receipt;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#FF6B6B', '#FF8E53']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Feather name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Booking Receipt</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Badge */}
        <View style={styles.successBadge}>
          <LinearGradient
            colors={['#34C759', '#30B0C0']}
            style={styles.badgeGradient}
          >
            <Feather name="check-circle" size={70} color="#fff" />
          </LinearGradient>
          <Text style={styles.successText}>Payment Successful!</Text>
          <Text style={styles.transactionId}>{payment.transactionId || 'N/A'}</Text>
        </View>

        {/* Amount Section - Card Style */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount Paid</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currency}>₹</Text>
            <Text style={styles.amount}>{payment.amount || 0}</Text>
          </View>
          <Text style={styles.currencyCode}>INR</Text>
          <View style={styles.amountDivider} />
          <Text style={styles.amountNote}>Payment completed successfully</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="shield" size={20} color="#FF8E53" />
            <Text style={styles.sectionTitle}>Luggage Verification QR</Text>
          </View>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Pickup QR</Text>
            {booking.pickup_qr_image ? (
              <Image source={{ uri: booking.pickup_qr_image }} style={styles.qrImage} />
            ) : (
              <View style={styles.qrPlaceholder}><Text style={styles.qrPlaceholderText}>Pickup QR unavailable</Text></View>
            )}
          </View>
        </View>

        {/* Booking Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="book-open" size={20} color="#FF8E53" />
            <Text style={styles.sectionTitle}>Booking Information</Text>
          </View>
          <View style={styles.sectionContent}>
            <InfoRow label="Booking ID" value={booking.id} />
            <View style={styles.divider} />
            <InfoRow label="Name" value={booking.username} />
            <View style={styles.divider} />
            <InfoRow label="Phone" value={booking.phone} />
            <View style={styles.divider} />
            <InfoRow label="Status" value={booking.status ? booking.status.toUpperCase() : 'CONFIRMED'} valueStyle={styles.statusConfirmed} />
          </View>
        </View>

        {/* Flight Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="send" size={20} color="#FF8E53" />
            <Text style={styles.sectionTitle}>Flight Details</Text>
          </View>
          <View style={styles.sectionContent}>
            <InfoRow label="Airline" value={booking.airline_name || 'N/A'} />
            <View style={styles.divider} />
            <InfoRow label="Flight Number" value={booking.flight_number || 'N/A'} />
            <View style={styles.divider} />
            <InfoRow label="Departure Date" value={booking.departure_date || 'N/A'} />
            <View style={styles.divider} />
            <InfoRow label="Departure Time" value={booking.departure_time || 'N/A'} />
            <View style={styles.divider} />
            <InfoRow label="Terminal" value={booking.terminal || 'N/A'} />
          </View>
        </View>

        {/* Luggage Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="package" size={20} color="#FF8E53" />
            <Text style={styles.sectionTitle}>Luggage Details</Text>
          </View>
          <View style={styles.sectionContent}>
            <InfoRow label="Number of Bags" value={`${booking.luggage_count || 'N/A'}`} />
            <View style={styles.divider} />
            <InfoRow label="Total Weight" value={`${booking.total_weight || 'N/A'} kg`} />
            <View style={styles.divider} />
            <InfoRow label="Fragile Items" value={booking.fragile_items ? 'Yes' : 'No'} />
          </View>
        </View>

        {/* Pickup & Drop Location */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="map-pin" size={20} color="#FF8E53" />
            <Text style={styles.sectionTitle}>Locations</Text>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.locationCard}>
              <View style={styles.locationIconBg}>
                <Feather name="navigation-2" size={18} color="#FF8E53" />
              </View>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Pickup Location</Text>
                <Text style={styles.locationAddress}>{booking.pickup_address || 'N/A'}</Text>
                <Text style={styles.locationTime}>Time: {booking.pickup_time || 'N/A'}</Text>
              </View>
            </View>
            <View style={[styles.locationCard, { marginTop: 12 }]}>
              <View style={styles.locationIconBg}>
                <Feather name="map-pin" size={18} color="#FF6B6B" />
              </View>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Airport</Text>
                <Text style={styles.locationAddress}>{booking.airport || 'N/A'} - {booking.terminal || 'N/A'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="credit-card" size={20} color="#FF8E53" />
            <Text style={styles.sectionTitle}>Payment Details</Text>
          </View>
          <View style={styles.sectionContent}>
            <InfoRow label="Amount" value={`₹${payment.amount || 0}`} />
            <View style={styles.divider} />
            <InfoRow label="Payment Method" value={payment.method || 'N/A'} />
            <View style={styles.divider} />
            <InfoRow label="Order ID" value={payment.orderId || 'N/A'} />
            <View style={styles.divider} />
            <InfoRow label="Transaction ID" value={payment.transactionId || 'N/A'} />
            <View style={styles.divider} />
            <InfoRow label="Payment Time" value={payment.paymentTime ? new Date(payment.paymentTime).toLocaleString() : 'N/A'} />
            <View style={styles.divider} />
            <InfoRow label="Status" value={payment.status ? payment.status.toUpperCase() : 'PAID'} valueStyle={styles.statusConfirmed} />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.downloadButton]}
            onPress={handleGeneratePDF}
            disabled={generatingPDF}
          >
            <Feather name="download" size={20} color="#fff" />
            <Text style={styles.buttonText}>
              {generatingPDF ? 'Generating...' : 'Download PDF'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.shareButton]}
            onPress={handleSharePDF}
            disabled={sharingPDF || generatingPDF}
          >
            <Feather name="share-2" size={20} color="#fff" />
            <Text style={styles.buttonText}>
              {sharingPDF ? 'Sharing...' : 'Share PDF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* View Bookings Button */}
        <TouchableOpacity
          style={styles.viewBookingsButton}
          onPress={() => router.push('/(tabs)/bookings')}
        >
          <Feather name="list" size={20} color="#FF8E53" />
          <Text style={styles.viewBookingsButtonText}>View All Bookings</Text>
        </TouchableOpacity>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.continueGradient}
          >
            <Text style={styles.continueButtonText}>Continue to Home</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, valueStyle }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  successBadge: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badgeGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 10,
    shadowColor: '#FF8E53',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  successText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  transactionId: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  amountCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderLeftWidth: 5,
    borderLeftColor: '#FF8E53',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  currency: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FF8E53',
    marginRight: 4,
  },
  amount: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FF8E53',
    letterSpacing: -1,
  },
  currencyCode: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  amountDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  amountNote: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  qrCardLocked: {
    opacity: 0.72,
  },
  qrTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  qrImage: {
    width: 180,
    height: 180,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    padding: 16,
  },
  qrPlaceholderText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    textAlign: 'right',
    maxWidth: '50%',
  },
  statusConfirmed: {
    color: '#34C759',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF8E53',
  },
  locationIconBg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 142, 83, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF8E53',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationAddress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
  },
  locationTime: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  downloadButton: {
    backgroundColor: '#FF8E53',
  },
  shareButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  continueButton: {
    marginHorizontal: 0,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#FF8E53',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    marginBottom: 20,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  viewBookingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#FFF3E0',
    marginHorizontal: 0,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FF8E53',
    elevation: 2,
    shadowColor: '#FF8E53',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  viewBookingsButtonText: {
    color: '#FF8E53',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
});

