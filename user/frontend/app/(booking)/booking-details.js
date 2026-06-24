import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Platform, Modal
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bookingSync from '../../utils/bookingSync';

export default function BookingDetailsScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [cancellationModalVisible, setCancellationModalVisible] = useState(false);
  const [cancellationDetails, setCancellationDetails] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const pollingRef = useRef(null);

  const API_URL = `${process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.127:5000'}/api/bookings`;

  const fetchBookingDetails = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert("Error", "Not authenticated");
        return null;
      }

      const response = await fetch(`${API_URL}/${bookingId}?_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      const data = await response.json();
      console.log('📋 Booking Details:', data);

      if (data.success && data.booking) {
        setBooking(data.booking);
        return token;
      }
      return null;
    } catch (error) {
      console.error('Error fetching booking:', error);
      Alert.alert("Error", "Failed to load booking details");
      return null;
    } finally {
      setLoading(false);
    }
  }, [API_URL, bookingId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const bootstrap = async () => {
        setLoading(true);
        const token = await fetchBookingDetails();
        if (!isActive || !token || !bookingId) return;

        if (pollingRef.current) {
          bookingSync.stopBookingPolling(pollingRef.current);
        }

        pollingRef.current = bookingSync.startBookingPolling(
          bookingId,
          token,
          (updatedBooking) => {
            if (!isActive) return;
            setBooking(updatedBooking);
          },
          5000
        );
      };

      bootstrap();

      return () => {
        isActive = false;
        if (pollingRef.current) {
          bookingSync.stopBookingPolling(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }, [bookingId, fetchBookingDetails])
  );

  const handleTrackBooking = async () => {
    if (!bookingId) return;
    await bookingSync.setActiveTrackingBooking(bookingId);
    router.push({
      pathname: '/(tabs)/track',
      params: { bookingId: String(bookingId) }
    });
  };

  const isCancellable = () => {
    if (!booking) return false;
    const stage = bookingSync.getBookingStage(booking);
    // Stages 1-3: Booking Confirmed, Agent Assigned, In Progress
    return stage >= 1 && stage <= 3;
  };

  const getCancellationPreview = () => {
    if (!booking) return { fee: 0, refund: 0 };
    const totalAmount = Number(booking.amount || 0);
    const stage = bookingSync.getBookingStage(booking);

    if (stage <= 1) {
      return { fee: 0, refund: totalAmount };
    }
    if (stage === 2) {
      return { fee: 0, refund: totalAmount };
    }
    if (stage === 3) {
      const fee = 150;
      return { fee, refund: Math.max(totalAmount - fee, 0) };
    }
    return { fee: 0, refund: 0 };
  };

  const handleCancelClick = async () => {
    if (!isCancellable()) {
      Alert.alert("Cannot Cancel", "This booking cannot be cancelled at this stage.");
      return;
    }

    const preview = getCancellationPreview();
    setCancellationDetails(preview);
    setCancellationModalVisible(true);
  };

  const confirmCancellation = async () => {
    setCancelling(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert("Error", "Not authenticated");
        setCancelling(false);
        return;
      }

      const response = await fetch(`${API_URL}/cancel/${bookingId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Customer initiated cancellation'
        })
      });

      const data = await response.json();
      console.log('📋 Cancellation Response:', data);

      setCancelling(false);
      setCancellationModalVisible(false);

      if (data.success) {
        // Update local booking state
        setBooking(data.booking);
        const refundAmount = Math.max(data.cancellationDetails?.refundAmount || 0, 0);
        
        // Clear booking cache to ensure fresh data on homepage
        await bookingSync.clearBookingCache(bookingId);
        await bookingSync.setActiveTrackingBooking(null);
        
        Alert.alert("Success", `Booking cancelled successfully!\n\nRefund Amount: ₹${refundAmount}`, [
          {
            text: "OK",
            onPress: () => {
              // Add small delay to ensure server processes cancellation
              setTimeout(() => {
                router.back();
              }, 300);
            }
          }
        ]);
      } else {
        Alert.alert("Cannot Cancel", data.message || "Failed to cancel booking");
      }
    } catch (error) {
      console.error("❌ Error cancelling booking:", error);
      setCancelling(false);
      Alert.alert("Error", "Failed to cancel booking");
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

  const trackingLabel = bookingSync.getTrackingStatusLabel(booking);
  const trackingStage = bookingSync.getBookingStage(booking);
  const statusColor = bookingSync.isCancelledBooking(booking)
    ? '#F44336'
    : trackingStage >= 5
      ? '#4CAF50'
      : trackingStage >= 3
        ? '#2196F3'
        : trackingStage >= 2
          ? '#FF9800'
          : '#999';

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

  const renderDetailRow = (label, value, numberOfLines = 1) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={numberOfLines}>{value}</Text>
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
        <View style={[styles.statusCard, { borderLeftColor: statusColor }]}> 
          <View style={styles.statusCardContent}> 
            <Text style={styles.bookingNumber}>Booking #{booking.id || booking.booking_id}</Text> 
            <View style={styles.statusRow}> 
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} /> 
              <Text style={styles.statusLabel}>{trackingLabel}</Text> 
            </View>
          </View>
          <View style={styles.paymentBadge}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.paymentText}>Paid</Text>
          </View>
        </View>

        {/* TRACKING TIMELINE */}
        {renderSection(
          'Tracking Progress',
          'clock-time-eight',
          <View style={styles.timeline}>
            {bookingSync.buildTimeline(booking).map((item, index) => (
              <View key={index}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: item.active ? '#ff6600' : '#cbd5e1' }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineStatus}>{item.title}</Text>
                    <Text style={styles.timelineTime}>{item.timestamp}</Text>
                  </View>
                </View>
                {index < bookingSync.buildTimeline(booking).length - 1 && <View style={styles.timelineLine} />}
              </View>
            ))}
          </View>
        )}

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
            {renderDetailRow('Address', `${booking.pickup_address || 'N/A'}`, 2)}
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
            {renderDetailRow('Total Weight', `${String(booking.bag_weight || 0).replace(/\s*kg\s*$/i, '')} kg`)}
            {renderDetailRow('Fragile Items', `${booking.is_fragile ? 'Yes' : 'No'}`)}
            {booking.photo_proof && renderDetailRow('Photo Proof', 'Uploaded')}
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
        {(bookingSync.isCancelledBooking(booking)) ? (
          <View style={styles.cancelledNotice}>
            <MaterialCommunityIcons name="information-outline" size={20} color="#F44336" />
            <Text style={styles.cancelledNoticeText}>This booking has been cancelled</Text>
          </View>
        ) : isCancellable() ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.actionButton, { flex: 1, marginRight: 8 }]} 
              activeOpacity={0.8} 
              onPress={handleTrackBooking}
            >
              <MaterialCommunityIcons name="map-marker-path" size={20} color="white" />
              <Text style={styles.actionButtonText}>Track</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.cancelButton, { flex: 1 }]} 
              activeOpacity={0.8} 
              onPress={handleCancelClick}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8} onPress={handleTrackBooking}>
            <MaterialCommunityIcons name="map-marker-path" size={20} color="white" />
            <Text style={styles.actionButtonText}>
              {(booking.status === 'completed' || booking.booking_status === 'completed' || booking.status === 'on_the_way' || booking.booking_status === 'on_the_way') ? 'View Delivery Details' : 'Track Booking'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cancellation Breakdown Modal */}
      <Modal
        visible={cancellationModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !cancelling && setCancellationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => !cancelling && setCancellationModalVisible(false)}
            >
              <MaterialCommunityIcons name="close" size={24} color="#1A1C1E" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Cancel Booking?</Text>

            <ScrollView style={styles.breakdownScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownLabel}>Booking Details</Text>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownKey}>Booking ID</Text>
                  <Text style={styles.breakdownValue}>#{booking.id || booking.booking_id}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownKey}>Status</Text>
                  <Text style={styles.breakdownValue}>{trackingLabel}</Text>
                </View>
              </View>

              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownLabel}>Refund Breakdown</Text>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownKey}>Total Amount Paid</Text>
                  <Text style={styles.breakdownValue}>₹{booking.amount || 0}</Text>
                </View>
                <View style={[styles.breakdownRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <Text style={styles.breakdownKey}>Cancellation Fee</Text>
                  <Text style={styles.breakdownValue}>₹{cancellationDetails?.fee ?? booking.cancellation_fee ?? 0}</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={[styles.breakdownRow, { paddingTop: 12 }]}>
                  <Text style={styles.breakdownKeyBold}>Refund Amount</Text>
                  <Text style={styles.breakdownValueBold}>₹{Math.max(cancellationDetails?.refund ?? ((booking.amount || 0) - (booking.cancellation_fee || 0)), 0)}</Text>
                </View>
              </View>

              <View style={styles.warningBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FF6600" />
                <Text style={styles.warningText}>This action cannot be undone. Are you sure you want to cancel this booking?</Text>
              </View>
            </ScrollView>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => !cancelling && setCancellationModalVisible(false)}
                disabled={cancelling}
              >
                <Text style={styles.modalButtonSecondaryText}>Keep Booking</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, cancelling && { opacity: 0.6 }]}
                onPress={confirmCancellation}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Confirm Cancellation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderBottomColor: '#F3F4F6',
    alignItems: 'flex-start'
  },
  detailLabel: { fontSize: 13, color: '#666', fontWeight: '600', flex: 0.35 },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#1A1C1E', flex: 0.65, flexWrap: 'wrap', textAlign: 'right' },
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
  buttonRow: {
    flexDirection: 'row',
    width: '100%'
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
  cancelButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F44336',
    borderRadius: 12,
    paddingVertical: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  actionButtonText: { color: 'white', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  cancelledNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F44336'
  },
  cancelledNoticeText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: '85%'
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginRight: -8,
    marginTop: -8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1C1E',
    marginBottom: 20
  },
  breakdownScroll: {
    maxHeight: 300,
    marginBottom: 16
  },
  breakdownSection: {
    marginBottom: 16
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  breakdownKey: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500'
  },
  breakdownKeyBold: {
    fontSize: 14,
    color: '#1A1C1E',
    fontWeight: '700'
  },
  breakdownValue: {
    fontSize: 13,
    color: '#1A1C1E',
    fontWeight: '600'
  },
  breakdownValueBold: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '800'
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFB74D'
  },
  warningText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666'
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white'
  }
});

