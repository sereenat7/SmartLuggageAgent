// screens/TaskDetailsScreen.js - SIMPLIFIED BOOKING FLOW
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../constants/colors';
import { USER_API_URL } from '../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 60) / 3;

export default function TaskDetailsScreen({ navigation, route }) {
  // Get booking object from route params (passed from DashboardScreen)
  const booking = route?.params?.task || {};
  console.log('[TaskDetails] Received booking:', booking);

  // Local state for actions
  const [luggagePhotos, setLuggagePhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [weight, setWeight] = useState(booking?.bag_weight ? String(booking.bag_weight) : '');
  const [pickupConfirmed, setPickupConfirmed] = useState(false);
  
  // OTP fields
  const [otp, setOtp] = useState(Array(4).fill(''));
  const [otpFocused, setOtpFocused] = useState(-1);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  
  // Action states
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(String(booking?.status || booking?.assignment_status || 'pending').toLowerCase());
  
  const otpInputRefs = useRef([]);

  // Safe getters for booking fields
  const customerName = booking?.username || booking?.name || 'Customer';
  const customerPhone = booking?.phone || '';
  const pickupLocation = booking?.pickup_address || booking?.pickupLocation || 'Pickup location pending';
  const dropLocation = booking?.drop_address || booking?.dropLocation || 'Drop location pending';
  const pickupTime = booking?.pickup_time || booking?.pickupTime || 'Time slot pending';
  const luggageCount = Number(booking?.bag_count || booking?.luggage || 1);
  const bookingId = booking?.id || booking?.bookingId;
  const referenceImageUri = (() => {
    const candidate = booking?.referenceImage || booking?.reference_image || booking?.photos || booking?.photo || booking?.image || null;
    if (!candidate) return null;
    if (typeof candidate === 'string') return candidate;
    if (Array.isArray(candidate)) return candidate[0]?.uri || candidate[0]?.url || null;
    if (typeof candidate === 'object') return candidate.uri || candidate.url || null;
    return null;
  })();
  const referenceImage =
    referenceImageUri;

  const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
  const isOnTheWay = normalizeStatus(currentStatus) === 'on-the-way' || normalizeStatus(currentStatus) === 'on_the_way' || normalizeStatus(currentStatus) === 'picked_up';

  useEffect(() => {
    if (normalizeStatus(booking?.status) === 'on-the-way' || normalizeStatus(booking?.status) === 'on_the_way' || normalizeStatus(booking?.status) === 'picked_up') {
      setPickupConfirmed(true);
    }
  }, [booking?.status]);

  // Resend OTP timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleCallCustomer = () => {
    if (!customerPhone) {
      Alert.alert('Error', 'No phone number available');
      return;
    }
    Alert.alert('Call Customer', `Calling ${customerName} at ${customerPhone}`);
  };

  const handleTakePhoto = async () => {
    const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setIsUploadingPhoto(true);
      setTimeout(() => {
        setLuggagePhotos(prev => [...prev, { uri: result.assets[0].uri, id: Date.now() }]);
        setIsUploadingPhoto(false);
      }, 1000);
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setIsUploadingPhoto(true);
      setTimeout(() => {
        setLuggagePhotos(prev => [...prev, { uri: result.assets[0].uri, id: Date.now() }]);
        setIsUploadingPhoto(false);
      }, 1000);
    }
  };

  const handleRemovePhoto = (photoId) => {
    Alert.alert('Remove Photo', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setLuggagePhotos(prev => prev.filter(p => p.id !== photoId)),
      },
    ]);
  };

  const handleAddPhoto = () => {
    Alert.alert('Add Photo', 'Choose how to add', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Gallery', onPress: handlePickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openImagePreview = (uri) => {
    setPreviewImageUri(uri);
    setIsPreviewVisible(true);
  };

  const handleConfirmPickup = () => {
    handleStatusUpdate('on-the-way');
  };

  const handleOtpChange = (value, index) => {
    const cleanDigit = value.replace(/[^0-9]/g, '').slice(-1);
    const updatedOtp = [...otp];
    updatedOtp[index] = cleanDigit;
    setOtp(updatedOtp);

    if (otpError) setOtpError('');
    if (otpSuccess) setOtpSuccess('');

    if (cleanDigit && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length !== 4) {
      setOtpError('Please enter complete OTP');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');
    setOtpSuccess('');

    setTimeout(() => {
      if (enteredOtp === '1234') {
        setOtpSuccess('Delivery Verified');
        // Here you could call API to mark delivered
        handleStatusUpdate('delivered');
      } else {
        setOtpError('Invalid OTP');
      }
      setIsVerifyingOtp(false);
    }, 900);
  };

  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    setResendTimer(30);
    setOtp(Array(4).fill(''));
    setOtpError('');
    setOtpSuccess('');
    otpInputRefs.current[0]?.focus();
    Alert.alert('OTP Sent', 'A new OTP has been sent.');
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  // Handle status updates using new simplified API
  const handleStatusUpdate = async (newStatus) => {
    if (!bookingId) {
      Alert.alert('Error', 'No booking ID');
      return;
    }

    try {
      setIsProcessing(true);
      let endpoint = '';

      if (newStatus === 'picked_up' || newStatus === 'on-the-way' || newStatus === 'on_the_way') {
        endpoint = `/api/bookings/pickup/${bookingId}`;
      } else if (newStatus === 'delivered') {
        endpoint = `/api/bookings/delivered/${bookingId}`;
      } else {
        throw new Error('Invalid status');
      }

      console.log('[TaskDetails] Updating status to:', newStatus, 'Endpoint:', endpoint);

      const response = await fetch(`${USER_API_URL}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data?.message || `Failed to update status (${response.status})`);
      }

      console.log('[TaskDetails] Status updated successfully:', data.booking);
      if (newStatus === 'delivered') {
        setCurrentStatus('delivered');
      } else {
        setCurrentStatus('on-the-way');
        setPickupConfirmed(true);
      }
      Alert.alert(
        'Success',
        newStatus === 'delivered'
          ? 'Delivery completed!'
          : 'Pickup confirmed. Status updated to on the way.'
      );
    } catch (error) {
      console.error('[TaskDetails] Error:', error);
      Alert.alert('Error', error?.message || 'Failed to update status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartPickup = () => {
    Alert.alert(
      'Start Pickup',
      'Are you ready to pick up the luggage?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          style: 'destructive',
          onPress: () => handleStatusUpdate('on-the-way'),
        },
      ]
    );
  };

  const handleCompleteDelivery = () => {
    Alert.alert(
      'Complete Delivery',
      'Verify OTP from customer to complete delivery.',
      [{ text: 'OK', style: 'cancel' }]
    );
  };

  const getStatusColor = (status) => {
    switch (normalizeStatus(status)) {
      case 'pending': return '#FF9100';
      case 'accepted': return '#2196F3';
      case 'picked_up':
      case 'on-the-way':
      case 'on_the_way': return '#2563EB';
      case 'delivered': return '#4CAF50';
      default: return '#64748B';
    }
  };

  const getStatusLabel = (status) => {
    switch (normalizeStatus(status)) {
      case 'pending': return 'Pending Acceptance';
      case 'accepted': return 'Accepted';
      case 'picked_up':
      case 'on-the-way':
      case 'on_the_way': return 'On The Way';
      case 'delivered': return 'Delivered';
      default: return status;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← </Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={styles.spacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Status Card */}
            <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: getStatusColor(currentStatus) }]}>
              <View style={styles.statusHeader}>
                <View>
                  <Text style={styles.bookingId}>Booking #{bookingId}</Text>
                  <Text style={[styles.statusBadge, { color: getStatusColor(currentStatus) }]}>
                    ● {getStatusLabel(currentStatus)}
                  </Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(currentStatus) }]} />
              </View>
            </View>

            {/* Customer Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Customer Information</Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={16} color={Colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>{customerName}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={16} color={Colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{customerPhone || 'N/A'}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.callButton, !customerPhone && styles.callButtonDisabled]}
                onPress={handleCallCustomer}
                disabled={!customerPhone}
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.callButtonText}>Call Customer</Text>
              </TouchableOpacity>
            </View>

            {/* Booking Details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Booking Details</Text>

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Pickup Time</Text>
                  <Text style={styles.infoValue}>{pickupTime}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={Colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Pickup Address</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>{pickupLocation}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="flag-outline" size={16} color={Colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Drop Address</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>{dropLocation}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="bag-outline" size={16} color={Colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Luggage Count</Text>
                  <Text style={styles.infoValue}>{luggageCount} bags</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Actions</Text>

              {!pickupConfirmed ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.pickupButton]}
                  onPress={handleConfirmPickup}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Pickup Confirmed</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.actionButton, styles.completedButton]}>
                  <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Pickup Confirmed</Text>
                </View>
              )}
            </View>

            {/* Luggage Reference */}
            {referenceImage && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Customer Luggage Reference</Text>
                <TouchableOpacity
                  onPress={() => openImagePreview(referenceImage)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: referenceImage }}
                    style={styles.referenceImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                <Text style={styles.referenceHint}>Tap to view full image</Text>
              </View>
            )}

            {/* Luggage Photos */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Capture Photos</Text>
              <Text style={styles.photoDescription}>
                Take photos for verification and records.
              </Text>

              {luggagePhotos.length > 0 && (
                <View style={styles.photoGrid}>
                  {luggagePhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoItem}>
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                      <TouchableOpacity
                        style={styles.photoRemoveButton}
                        onPress={() => handleRemovePhoto(photo.id)}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {isUploadingPhoto && (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.uploadingText}>Uploading...</Text>
                </View>
              )}

              <View style={styles.photoButtonsRow}>
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={handleTakePhoto}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.galleryButton}
                  onPress={handlePickPhoto}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image" size={20} color={Colors.primary} />
                  <Text style={styles.galleryButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>

              {luggagePhotos.length > 0 && (
                <Text style={styles.photoCount}>
                  {luggagePhotos.length} photo{luggagePhotos.length !== 1 ? 's' : ''} captured
                </Text>
              )}
            </View>

            {/* OTP Verification - Only show when picked up */}
            {currentStatus === 'picked_up' && false && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Delivery OTP</Text>
                <Text style={styles.otpSubtitle}>Enter OTP from customer</Text>

                <View style={styles.otpInputsRow}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={`otp-${index}`}
                      ref={(ref) => { otpInputRefs.current[index] = ref; }}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={(event) => handleOtpKeyPress(event, index)}
                      onFocus={() => setOtpFocused(index)}
                      onBlur={() => setOtpFocused(-1)}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={[
                        styles.otpInputBox,
                        otpFocused === index && styles.otpInputBoxFocused,
                        digit !== '' && styles.otpInputBoxFilled,
                        !!otpError && styles.otpInputBoxError,
                        !!otpSuccess && styles.otpInputBoxSuccess,
                      ]}
                      caretHidden
                    />
                  ))}
                </View>

                {!!otpError && <Text style={styles.otpErrorText}>{otpError}</Text>}
                {!!otpSuccess && <Text style={styles.otpSuccessText}>{otpSuccess}</Text>}

                <TouchableOpacity
                  style={[
                    styles.verifyOtpButton,
                    (!isOtpComplete || isVerifyingOtp || isProcessing) && styles.verifyOtpButtonDisabled
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={!isOtpComplete || isVerifyingOtp || isProcessing}
                  activeOpacity={0.85}
                >
                  {isVerifyingOtp || isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.verifyOtpButtonText}>Verify OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleResendOtp}
                  disabled={resendTimer > 0}
                >
                  <Text
                    style={[
                      styles.resendButtonText,
                      resendTimer > 0 && styles.resendButtonTextDisabled
                    ]}
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Image Preview Modal */}
        <Modal
          visible={isPreviewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsPreviewVisible(false)}
        >
          <View style={styles.previewModalContainer}>
            <TouchableOpacity
              style={styles.previewBackdrop}
              activeOpacity={1}
              onPress={() => setIsPreviewVisible(false)}
            />
            <View style={styles.previewContent}>
              <TouchableOpacity
                style={styles.previewCloseButton}
                onPress={() => setIsPreviewVisible(false)}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
              {!!previewImageUri && (
                <Image
                  source={{ uri: previewImageUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: '#ff6600',
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backButton: { padding: 8, marginLeft: -8 },
  backButtonText: { fontSize: 24, color: '#fff', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  spacer: { width: 40 },
  keyboardContainer: { flex: 1 },
  scrollContent: { flex: 1, paddingHorizontal: 14, paddingTop: 14 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingId: { fontSize: 14, fontWeight: '700', color: '#1A1C1E', marginBottom: 4 },
  statusBadge: { fontSize: 14, fontWeight: '600' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1A1C1E', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  infoContent: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1A1C1E' },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 10,
    marginTop: 8,
  },
  callButtonDisabled: { backgroundColor: '#D1D5DB', opacity: 0.5 },
  callButtonText: { color: '#fff', fontWeight: '600', marginLeft: 8, fontSize: 14 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginVertical: 8,
  },
  pickupButton: { backgroundColor: '#2563EB' },
  deliveryButton: { backgroundColor: '#DC2626' },
  completedButton: { backgroundColor: '#4CAF50', opacity: 0.7 },
  actionButtonText: { color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 14 },
  photoDescription: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 10,
    marginRight: 12,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: { width: '100%', height: '100%' },
  photoRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cameraButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#ff6600',
    borderRadius: 10,
  },
  galleryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoButtonText: { color: '#fff', fontWeight: '600', marginLeft: 8 },
  galleryButtonText: { color: Colors.primary, fontWeight: '600', marginLeft: 8 },
  photoCount: { fontSize: 12, color: '#64748B', marginTop: 8 },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  uploadingText: { marginLeft: 8, color: Colors.primary, fontWeight: '600' },
  referenceImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 8,
  },
  referenceHint: { fontSize: 11, color: '#64748B', textAlign: 'center' },
  otpInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  otpInputBox: {
    width: '22%',
    height: 50,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1C1E',
  },
  otpInputBoxFocused: { borderColor: Colors.primary, backgroundColor: '#F0F9FF' },
  otpInputBoxFilled: { borderColor: Colors.primary },
  otpInputBoxError: { borderColor: '#EF4444' },
  otpInputBoxSuccess: { borderColor: '#10B981' },
  otpSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  otpErrorText: { color: '#EF4444', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  otpSuccessText: { color: '#10B981', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  verifyOtpButton: {
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 8,
  },
  verifyOtpButtonDisabled: { backgroundColor: '#93C5FD', opacity: 0.7 },
  verifyOtpButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  resendButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  resendButtonText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  resendButtonTextDisabled: { color: '#94A3B8' },
  previewModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  previewContent: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  previewCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  previewImage: { width: '90%', height: '80%' },
});
