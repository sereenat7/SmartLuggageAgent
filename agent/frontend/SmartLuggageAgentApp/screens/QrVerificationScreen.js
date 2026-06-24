import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { USER_API_URL } from '../config';

export default function QrVerificationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const [confirming, setConfirming] = useState(false);

  // Data passed from QrScannerScreen
  const { verificationStatus, booking: rawBooking, bookingId, qrType } = route.params || {};
  const booking = {
    ...(rawBooking || {}),
    bookingId: rawBooking?.bookingId ?? rawBooking?.id ?? rawBooking?.booking_id ?? bookingId,
    bookingStatus:
      rawBooking?.bookingStatus || rawBooking?.status || rawBooking?.booking_status || 'pending',
    bookingDate:
      rawBooking?.bookingDate || rawBooking?.created_at || rawBooking?.createdAt || new Date().toISOString(),
    customerName:
      rawBooking?.customerName || rawBooking?.username || rawBooking?.name || rawBooking?.userName || 'Unknown',
    customerPhone:
      rawBooking?.customerPhone || rawBooking?.phone || rawBooking?.mobile || rawBooking?.phoneNumber || 'N/A',
    customerEmail:
      rawBooking?.customerEmail || rawBooking?.email || rawBooking?.userEmail || '',
    pickupLocation:
      rawBooking?.pickupLocation || rawBooking?.pickup_address || rawBooking?.pickupAddress || 'Unknown',
    destinationLocation:
      rawBooking?.destinationLocation || rawBooking?.drop_address || rawBooking?.destination_location || rawBooking?.destinationAddress || 'Unknown',
    bagCount:
      rawBooking?.bagCount ?? rawBooking?.bag_count ?? rawBooking?.luggage_count ?? rawBooking?.bags ?? 0,
    airline: rawBooking?.airline || rawBooking?.airline_name || '',
    flightNumber: rawBooking?.flightNumber || rawBooking?.flight_number || '',
    terminal: rawBooking?.terminal || rawBooking?.terminal_name || '',
  };

  const isPickup = qrType === 'pickup';
  const isValid = verificationStatus?.status === 'valid';
  const isLocked = verificationStatus?.status === 'locked';
  const isAlreadyUsed = verificationStatus?.status === 'already-used';
  const isInvalid = verificationStatus?.status === 'invalid' || verificationStatus?.status === 'error';
  const bookingIdValue = booking.bookingId ?? bookingId;

  const handleConfirmVerification = async () => {
    try {
      setConfirming(true);

      const agentId = route.params?.agentId ?? 0;
      const agentName = route.params?.agentName || 'Agent';

      const API_URL = `${USER_API_URL}/api/bookings`;
      const targetBookingId = bookingIdValue ?? bookingId;

      const response = await fetch(`${API_URL}/confirm-qr-verification/${targetBookingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrType,
          agentId: Number(agentId),
          agentName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const verifiedAt = result.booking?.pickupVerifiedAt || result.booking?.verifiedAt || new Date().toISOString();
        const verifiedByName = result.booking?.pickupVerifiedByAgentName || result.booking?.verifiedByAgentName || agentName;
        const verifiedById = result.booking?.pickupVerifiedByAgentId || result.booking?.verifiedByAgentId || agentId;

        navigation.navigate('TaskDetails', {
          bookingId,
          pickupVerified: true,
          pickupVerificationDetails: {
            verifiedByName,
            verifiedById,
            verifiedAt,
          },
          task: {
            ...route.params?.task,
            ...result.booking,
            status: result.booking?.status || 'picked_up',
          },
        });
      } else {
        Alert.alert('Error', result.message || 'Verification failed');
      }
    } catch (error) {
      console.error('Confirmation error:', error);
      Alert.alert('Error', 'Failed to confirm verification');
    } finally {
      setConfirming(false);
    }
  };

  // LOADING STATE
  if (!verificationStatus) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Verifying QR Code...</Text>
        </View>
      </SafeAreaView>
    );
  }



  // VALID PICKUP QR
  if (isValid && isPickup) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={[styles.header, styles.headerSuccess]}>
            <MaterialCommunityIcons name="check-circle" size={80} color="#FFF" />
            <Text style={styles.headerTitle}>Pickup Verification</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>✓ Valid QR</Text>
            </View>
          </View>

          {/* Booking Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Information</Text>
            <InfoRow label="Booking ID" value={`#${booking.bookingId}`} />
            <InfoRow label="Status" value={booking.bookingStatus.toUpperCase()} />
            <InfoRow label="Booking Date" value={new Date(booking.bookingDate).toLocaleDateString()} />
          </View>

          {/* Customer Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <InfoRow label="Name" value={booking.customerName} />
            <InfoRow label="Phone" value={booking.customerPhone} />
            {booking.customerEmail && <InfoRow label="Email" value={booking.customerEmail} />}
          </View>

          {/* Journey Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Journey Information</Text>
            <InfoRow label="Pickup Location" value={booking.pickupLocation} />
            <InfoRow label="Destination" value={booking.destinationLocation} />
            <InfoRow label="Bags" value={booking.bagCount ? `${booking.bagCount} bag(s)` : 'N/A'} />
            {booking.airline && <InfoRow label="Airline" value={booking.airline} />}
            {booking.flightNumber && <InfoRow label="Flight" value={booking.flightNumber} />}
            {booking.terminal && <InfoRow label="Terminal" value={booking.terminal} />}
          </View>

          {/* QR Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QR Information</Text>
            <InfoRow label="QR Type" value="PICKUP" valueStyle={{ color: '#4CAF50', fontWeight: 'bold' }} />
            <InfoRow label="Scanned At" value={new Date().toLocaleTimeString()} />
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmVerification}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="check" size={24} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.confirmButtonText}>Confirm Pickup Verification</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // VALID DESTINATION QR
  if (isValid && !isPickup) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={[styles.header, styles.headerSuccess]}>
            <MaterialCommunityIcons name="check-circle" size={80} color="#FFF" />
            <Text style={styles.headerTitle}>Delivery Verification</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>✓ Valid QR</Text>
            </View>
          </View>

          {/* Booking Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Information</Text>
            <InfoRow label="Booking ID" value={`#${booking.bookingId}`} />
            <InfoRow label="Status" value={booking.bookingStatus.toUpperCase()} />
            <InfoRow label="Booking Date" value={new Date(booking.bookingDate).toLocaleDateString()} />
          </View>

          {/* Customer Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <InfoRow label="Name" value={booking.customerName} />
            <InfoRow label="Phone" value={booking.customerPhone} />
          </View>

          {/* Delivery Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Information</Text>
            <InfoRow label="Destination" value={booking.destinationLocation} />
            <InfoRow label="Bags" value={booking.bagCount ? `${booking.bagCount} bag(s)` : 'N/A'} />
          </View>

          {/* QR Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QR Information</Text>
            <InfoRow label="QR Type" value="DESTINATION" valueStyle={{ color: '#2196F3', fontWeight: 'bold' }} />
            <InfoRow label="Scanned At" value={new Date().toLocaleTimeString()} />
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.confirmButton, styles.confirmButtonDestination]}
            onPress={handleConfirmVerification}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="hand-right" size={24} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.confirmButtonText}>Confirm Luggage Handover</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // LOCKED DESTINATION QR
  if (isLocked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="lock" size={80} color="#FFA500" />
          <Text style={styles.statusTitle}>Destination QR Locked</Text>
          <Text style={styles.statusMessage}>
            This QR cannot be used yet. The assigned agent has not marked the booking as "Arrived at Destination".
          </Text>
          <View style={styles.statusInfoBox}>
            <Text style={styles.statusInfoLabel}>Current Status:</Text>
            <Text style={styles.statusInfoValue}>{verificationStatus.currentStatus?.toUpperCase()}</Text>
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ALREADY USED QR
  if (isAlreadyUsed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="alert-circle" size={80} color="#FF9800" />
          <Text style={styles.statusTitle}>QR Already Used</Text>
          <View style={styles.statusInfoBox}>
            <Text style={styles.statusInfoLabel}>Booking ID:</Text>
            <Text style={styles.statusInfoValue}>#{booking.bookingId}</Text>
            <Text style={styles.statusInfoLabel}>Previously Verified:</Text>
            <Text style={styles.statusInfoValue}>{new Date(verificationStatus.verifiedAt).toLocaleString()}</Text>
            <Text style={styles.statusInfoLabel}>By Agent ID:</Text>
            <Text style={styles.statusInfoValue}>{verificationStatus.verifiedByAgentId}</Text>
          </View>
          <Text style={styles.statusMessage}>No further action is required.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // INVALID QR
  if (isInvalid) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="close-circle" size={80} color="#F44336" />
          <Text style={styles.statusTitle}>Invalid QR Code</Text>
          <Text style={styles.statusMessage}>Reason: {verificationStatus.reason}</Text>
          <View style={styles.statusInfoBox}>
            <Text style={styles.statusInfoValue}>{verificationStatus.message}</Text>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.backButton, { flex: 1 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.supportButton, { flex: 1, marginLeft: 12 }]}
              onPress={() => Alert.alert('Support', 'Contact support team for assistance')}
            >
              <MaterialCommunityIcons name="phone" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.backButtonText}>Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

function InfoRow({ label, value, valueStyle }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  header: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerSuccess: {
    backgroundColor: '#4CAF50',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
  },
  statusBadge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
  },
  statusBadgeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  confirmButton: {
    marginHorizontal: 16,
    marginVertical: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  confirmButtonDestination: {
    backgroundColor: '#2196F3',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  statusInfoBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statusInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  statusInfoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 20,
  },
  backButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#666',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  supportButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FF9800',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});
