import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BookingDetailsScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);

  const API_URL = `${process.env.EXPO_PUBLIC_API_URL || 'http://10.88.246.52:5000'}/api/bookings`;

  useEffect(() => {
    fetchBookingDetails();
  }, []);

  const fetchBookingDetails = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

      const response = await fetch(`${API_URL}/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      console.log('📋 Booking Details:', data);

      if (data.success && data.booking) {
        setBooking(data.booking);
      } else {
        Alert.alert("Error", "Could not load booking details");
      }
    } catch (error) {
      console.error("❌ Error fetching booking:", error);
      Alert.alert("Error", "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6600" />
      </View>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>
    );
  }

  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch(statusLower) {
      case 'assigned': return '#FF9800';
      case 'in transit': case 'picked': return '#2196F3';
      case 'delivered': case 'completed': return '#4CAF50';
      default: return '#999';
    }
  };

  const getStatusLabel = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch(statusLower) {
      case 'assigned': return 'Assigned';
      case 'in transit': case 'picked': return 'In Transit';
      case 'delivered': case 'completed': return 'Delivered';
      default: return status;
    }
  };

  const renderSection = (title, icon, content) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon} size={22} color="#FF6600" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>
        {content}
      </View>
    </View>
  );

  const renderDetailRow = (label, value) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ROUNDED HEADER */}
      <LinearGradient colors={['#ff0033', '#ff6600']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 30 }} />
      </LinearGradient>

      {/* SCROLLABLE AREA */}
      <ScrollView 
        style={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollInner}
      >
        {/* STATUS CARD - Now with extra margin top to bring it down */}
        <View style={[styles.statusCard, { borderLeftColor: getStatusColor(booking.booking_status) }]}>
          <View style={styles.statusCardContent}>
            <Text style={styles.bookingNumber}>Booking #{booking.id || booking.booking_id}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.booking_status) }]} />
              <Text style={styles.statusLabel}>{getStatusLabel(booking.booking_status)}</Text>
            </View>
          </View>
          <View style={styles.paymentBadge}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.paymentText}>Paid</Text>
          </View>
        </View>

        {/* Flight Details */}
        {renderSection(
          'Flight Details',
          'airplane',
          <View>
            {renderDetailRow('Airline', `${booking.airline_name || 'N/A'}`)}
            {renderDetailRow('Flight Number', `${booking.flight_number || 'N/A'}`)}
            {renderDetailRow('From', `${booking.departure_city || 'N/A'}`)}
            {renderDetailRow('Terminal', `${booking.terminal || 'N/A'}`)}
            {renderDetailRow('Departure', `${booking.departure_date || 'N/A'} ${booking.departure_time || ''}`)}
          </View>
        )}

        {/* Pickup Details */}
        {renderSection(
          'Pickup Details',
          'map-marker',
          <View>
            {renderDetailRow('Address', `${booking.pickup_address || 'N/A'}`)}
            {renderDetailRow('Pincode', `${booking.pincode || 'N/A'}`)}
            {renderDetailRow('Pickup Time', `${booking.pickup_time || 'N/A'}`)}
            {booking.additional_info && renderDetailRow('Additional Info', `${booking.additional_info}`)}
          </View>
        )}

        {/* Luggage Details */}
        {renderSection(
          'Luggage Details',
          'bag-checked',
          <View>
            {renderDetailRow('Number of Bags', `${booking.bag_count || 0}`)}
            {renderDetailRow('Total Weight', `${booking.bag_weight || 0} kg`)}
            {renderDetailRow('Fragile Items', `${booking.is_fragile ? 'Yes' : 'No'}`)}
            {booking.photo_proof && renderDetailRow('Photo Proof', 'Uploaded')}
          </View>
        )}

        {/* Tracking Timeline */}
        {renderSection(
          'Tracking Timeline',
          'timeline',
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: '#4CAF50' }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>Assigned</Text>
                <Text style={styles.timelineTime}>{booking.assigned_time || 'In progress'}</Text>
              </View>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: booking.booking_status === 'delivered' || booking.booking_status === 'picked' ? '#4CAF50' : '#DDD' }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>Picked Up</Text>
                <Text style={styles.timelineTime}>{booking.pickup_time || 'Pending'}</Text>
              </View>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: booking.booking_status === 'in transit' || booking.booking_status === 'delivered' ? '#2196F3' : '#DDD' }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>In Transit</Text>
                <Text style={styles.timelineTime}>{booking.in_transit_time || 'Pending'}</Text>
              </View>
            </View>
            <View style={styles.timelineLine} />
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: booking.booking_status === 'delivered' ? '#4CAF50' : '#DDD' }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>Delivered</Text>
                <Text style={styles.timelineTime}>{booking.delivered_time || 'Pending'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment Details */}
        {renderSection(
          'Payment Details',
          'credit-card',
          <View>
            {renderDetailRow('Amount', `₹${booking.amount || 0}`)}
            {renderDetailRow('Payment Status', `${booking.payment_status ? booking.payment_status.toUpperCase() : 'PENDING'}`)}
            {renderDetailRow('Payment Method', `${booking.payment_method || 'Online'}`)}
            {booking.razorpay_payment_id && renderDetailRow('Transaction ID', `${booking.razorpay_payment_id}`)}
          </View>
        )}

        {/* Additional Instructions */}
        {booking.special_instructions && renderSection(
          'Additional Instructions',
          'note-text',
          <Text style={styles.instructionText}>{booking.special_instructions}</Text>
        )}

        {/* Bottom spacing for scroll */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FIXED BOTTOM ACTION BAR */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
          <MaterialCommunityIcons name="phone" size={20} color="white" />
          <Text style={styles.actionButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight + 20) : 50,
    paddingBottom: 25,
    borderBottomLeftRadius: 30, // ROUNDED CORNERS
    borderBottomRightRadius: 30, // ROUNDED CORNERS
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '700' },
  scrollContent: { flex: 1 },
  scrollInner: { 
    paddingHorizontal: 16, 
    paddingTop: 30, // BRINGS BOOKING CARD DOWN
    paddingBottom: 20 
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  statusCardContent: { flex: 1 },
  bookingNumber: { fontSize: 16, fontWeight: '800', color: '#1A1C1E', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusLabel: { fontSize: 14, fontWeight: '700', color: '#555' },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  paymentText: { marginLeft: 6, fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1C1E', marginLeft: 10 },
  sectionContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  detailLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#1A1C1E' },
  timeline: { paddingVertical: 4 },
  timelineItem: { flexDirection: 'row', marginBottom: 4 },
  timelineDot: { width: 14, height: 14, borderRadius: 7, marginTop: 3, marginRight: 12 },
  timelineContent: { flex: 1 },
  timelineStatus: { fontSize: 13, fontWeight: '700', color: '#1A1C1E' },
  timelineTime: { fontSize: 12, color: '#999', marginTop: 2 },
  timelineLine: { height: 20, width: 2, marginLeft: 6, backgroundColor: '#E5E7EB', marginVertical: -6 },
  instructionText: { fontSize: 13, color: '#555', lineHeight: 20 },
  bottomButtonContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'android' ? 40 : 24,
    paddingTop: 12,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB'
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ff6600',
    borderRadius: 12,
    paddingVertical: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  actionButtonText: { color: 'white', fontSize: 16, fontWeight: '700', marginLeft: 10 }
});