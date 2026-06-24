import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Platform, Image, TextInput
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildTimeline } from '../../utils/bookingSync';

export default function BookingDetailsScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const handleSubmitRating = async () => {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please select a star rating between 1 and 5.");
      return;
    }

    try {
      setSubmittingRating(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

      const response = await fetch(`${API_URL}/rating/${bookingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating, comment })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert("Thank You", "Your feedback has been submitted successfully!");
        fetchBookingDetails();
      } else {
        Alert.alert("Failed", data.message || "Failed to submit rating");
      }
    } catch (error) {
      console.error("❌ Error submitting rating:", error);
      Alert.alert("Error", "Failed to submit rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  const renderStars = (count, interactive = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          disabled={!interactive}
          onPress={() => setRating(i)}
          style={{ marginRight: 6 }}
        >
          <MaterialCommunityIcons
            name={i <= count ? "star" : "star-outline"}
            size={32}
            color={i <= count ? "#FF6600" : "#cbd5e1"}
          />
        </TouchableOpacity>
      );
    }
    return <View style={{ flexDirection: 'row', marginVertical: 10 }}>{stars}</View>;
  };

  const API_URL = `${process.env.EXPO_PUBLIC_API_URL || 'http://172.16.111.44:5000'}/api/bookings`;

  useEffect(() => {
    fetchBookingDetails();

    const interval = setInterval(() => {
      fetchBookingDetails();
    }, 8000);

    return () => clearInterval(interval);
  }, [bookingId]);

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

  const handleCancelBooking = async () => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const token = await AsyncStorage.getItem('authToken');
              if (!token) {
                Alert.alert("Error", "Not authenticated");
                return;
              }

              const response = await fetch(`${API_URL}/cancel/${bookingId}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason: "User Cancelled" })
              });

              const data = await response.json();
              if (data.success) {
                Alert.alert(
                  "Booking Cancelled",
                  `Booking cancelled successfully.\n\nCancellation Charge: ₹${data.cancellationFee}\nRefund Amount: ₹${data.refundAmount}`,
                  [{ text: "OK", onPress: () => fetchBookingDetails() }]
                );
              } else {
                Alert.alert("Cancellation Failed", data.message || "Failed to cancel booking");
              }
            } catch (error) {
              console.error("❌ Error cancelling booking:", error);
              Alert.alert("Error", "Failed to cancel booking");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
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

  const formatVerificationTime = (value) => {
    if (!value) return 'Pending';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const statusValue = String(booking?.booking_status || booking?.status || '').toLowerCase();
  const isPickupVerified = Boolean(
    booking.pickup_verified ||
    booking.pickupVerified ||
    booking.pickup_verified_at ||
    booking.pickupVerifiedAt ||
    statusValue === 'picked' ||
    statusValue === 'picked_up' ||
    statusValue === 'in transit' ||
    statusValue === 'delivered'
  );

  const pickupVerificationAgentName = booking.pickup_verified_by_agent_name || booking.pickupVerifiedByAgentName || booking.verified_by_agent_name || 'Agent';
  const pickupVerificationAgentId = booking.pickup_verified_by_agent_id || booking.pickupVerifiedByAgentId || 'N/A';
  const pickupVerificationTimestamp = booking.pickup_verified_at || booking.pickupVerifiedAt;

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
          <View style={styles.timelineContainer}>
            {buildTimeline(booking).map((node, index, arr) => {
              const isLast = index === arr.length - 1;
              const isActive = node.active;
              return (
                <View key={node.title} style={styles.timelineNodeBlockRow}>
                  <View style={styles.timelineLeftTrackIndicatorCol}>
                    <View style={[
                      styles.timelineNodeCircle, 
                      { backgroundColor: isActive ? '#ff6600' : '#cbd5e1' }
                    ]} />
                    {!isLast && <View style={styles.timelineVerticalLine} />}
                  </View>
                  <View style={styles.timelineContentDataBlock}>
                    <Text style={[styles.timelineNodeTitleText, !isActive && styles.dimmedTimelineText]}>{node.title}</Text>
                    <Text style={[styles.timelineNodeTimestampText, !isActive && styles.dimmedTimelineText]}>{node.timestamp}</Text>
                  </View>
                </View>
              );
            })}
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

        {/* Pickup Verification Status */}
        {renderSection(
          'Pickup Verification',
          'check-decagram',
          <View>
            {isPickupVerified ? (
              <View style={styles.verificationSuccessCard}>
                <View style={styles.verificationIconRow}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#2E7D32" />
                  <Text style={styles.verificationTitle}>Pickup Verified</Text>
                </View>
                <Text style={styles.verificationLabel}>Verified By</Text>
                <Text style={styles.verificationValue}>Agent Name: {pickupVerificationAgentName}</Text>
                <Text style={styles.verificationValue}>Agent ID: {pickupVerificationAgentId}</Text>
                <Text style={styles.verificationLabel}>Verified At</Text>
                <Text style={styles.verificationValue}>{formatVerificationTime(pickupVerificationTimestamp)}</Text>
                <Text style={styles.verificationLabel}>Status</Text>
                <Text style={styles.verificationValue}>Pickup Successfully Verified</Text>
              </View>
            ) : (
              <View style={styles.verificationPendingCard}>
                <View style={styles.verificationIconRow}>
                  <MaterialCommunityIcons name="clock-outline" size={24} color="#B45309" />
                  <Text style={styles.verificationTitle}>Pickup Verification Pending</Text>
                </View>
                <Text style={styles.verificationValue}>Waiting for the assigned agent to complete pickup verification.</Text>
              </View>
            )}
          </View>
        )}

        {/* Luggage Verification QR */}
        {renderSection(
          'Luggage Verification QR',
          'qrcode',
          <View>
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>Pickup QR</Text>
              {booking.pickup_qr_image ? (
                <Image source={{ uri: booking.pickup_qr_image }} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>Pickup QR unavailable</Text>
                </View>
              )}
            </View>
            {booking.destination_qr_image ? (
              <View style={styles.qrCard}>
                <Text style={styles.qrTitle}>Delivery QR</Text>
                <Image source={{ uri: booking.destination_qr_image }} style={styles.qrImage} />
              </View>
            ) : (
              <View style={[styles.qrCard, styles.qrCardLocked]}>
                <View style={styles.lockedQrHeader}>
                  <MaterialCommunityIcons name="lock" size={24} color="#F59E0B" />
                  <Text style={styles.qrTitle}>Delivery QR Locked</Text>
                </View>
                <Text style={styles.lockedQrText}>
                  This QR code will become available after the assigned agent reaches the destination/airport.
                </Text>
                <Text style={styles.lockedQrTextSecondary}>
                  Please wait for the delivery process to progress.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Agent Feedback / Rating Section */}
        {(statusValue === 'delivered' || statusValue === 'completed') && renderSection(
          'Agent Feedback',
          'star-circle',
          <View style={styles.feedbackContainer}>
            {booking.rating !== null && booking.rating !== undefined ? (
              <View style={styles.submittedFeedback}>
                <Text style={styles.feedbackLabel}>Your Rating</Text>
                {renderStars(booking.rating, false)}
                {booking.rating_comment ? (
                  <View style={styles.commentBox}>
                    <Text style={styles.commentText}>"{booking.rating_comment}"</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.ratingForm}>
                <Text style={styles.feedbackText}>How was your experience with our agent?</Text>
                {renderStars(rating, true)}
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Leave a comment (optional)..."
                  placeholderTextColor="#94a3b8"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={[styles.submitFeedbackBtn, submittingRating && styles.submitFeedbackBtnDisabled]}
                  onPress={handleSubmitRating}
                  disabled={submittingRating}
                >
                  {submittingRating ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.submitFeedbackBtnText}>Submit Feedback</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
        {booking.status !== 'cancelled' && booking.status !== 'completed' && booking.status !== 'delivered' ? (
          <View style={styles.bottomButtonsRow}>
            <TouchableOpacity
              style={styles.trackButton}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/(tabs)/track', params: { bookingId: booking.id } })}
            >
              <MaterialCommunityIcons name="routes" size={20} color="white" />
              <Text style={styles.buttonText}>Track</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, isPickupVerified && styles.disabledCancelButton]}
              activeOpacity={isPickupVerified ? 1 : 0.8}
              onPress={isPickupVerified ? null : handleCancelBooking}
              disabled={isPickupVerified}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.actionButton} 
            activeOpacity={0.8} 
            onPress={() => Alert.alert("Contact Support", "Please call our helpline for support.")}
          >
            <MaterialCommunityIcons name="phone" size={20} color="white" />
            <Text style={styles.actionButtonText}>Contact Support</Text>
          </TouchableOpacity>
        )}
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
  verificationSuccessCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  verificationPendingCard: {
    backgroundColor: '#FFF7E6',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD59A',
  },
  verificationIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  verificationTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    marginLeft: 8,
  },
  verificationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 8,
  },
  verificationValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 2,
  },
  verificationButton: {
    marginTop: 12,
    backgroundColor: '#FF6600',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  verificationButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
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
    opacity: 0.9,
    backgroundColor: '#FFF8E1',
  },
  lockedQrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lockedQrText: {
    textAlign: 'center',
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  lockedQrTextSecondary: {
    textAlign: 'center',
    color: '#B45309',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
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
  actionButtonText: { color: 'white', fontSize: 16, fontWeight: '700', marginLeft: 10 },
  bottomButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ff6600',
    borderRadius: 12,
    paddingVertical: 14,
    marginRight: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    marginLeft: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  disabledCancelButton: {
    backgroundColor: '#cbd5e1',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  timelineContainer: {
    paddingVertical: 4,
  },
  timelineNodeBlockRow: {
    flexDirection: 'row',
  },
  timelineLeftTrackIndicatorCol: {
    alignItems: 'center',
    width: 24,
    marginRight: 14,
    position: 'relative',
  },
  timelineNodeCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    zIndex: 2,
  },
  timelineVerticalLine: {
    width: 2,
    backgroundColor: '#cbd5e1',
    position: 'absolute',
    top: 14,
    bottom: -22,
    left: 11,
    zIndex: 1,
  },
  timelineContentDataBlock: {
    flex: 1,
    paddingBottom: 22,
  },
  timelineNodeTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  timelineNodeTimestampText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '500',
  },
  dimmedTimelineText: {
    color: '#94a3b8',
  },
  feedbackContainer: {
    paddingVertical: 4,
  },
  feedbackText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  feedbackLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  submittedFeedback: {
    alignItems: 'flex-start',
  },
  commentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  commentText: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  ratingForm: {
    width: '100%',
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    textAlignVertical: 'top',
    minHeight: 60,
    marginTop: 8,
    marginBottom: 12,
  },
  submitFeedbackBtn: {
    backgroundColor: '#FF6600',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitFeedbackBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  submitFeedbackBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});

