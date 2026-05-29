// screens/TaskDetailsScreen.js
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
import { uriToDataUrl } from '../utils/imageHelpers';
import { USER_API_URL } from '../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 60) / 3;

export default function TaskDetailsScreen({ navigation, route }) {
  const task = route?.params?.task || {};
  const bookingId = route?.params?.bookingId || task.bookingId || null;
  console.log('DEBUG: TaskDetailsScreen task object:', task);
  console.log('DEBUG: TaskDetailsScreen bookingId:', bookingId);
  console.log('DEBUG: TaskDetailsScreen task.pickupTime:', task.pickupTime);
  console.log('DEBUG: TaskDetailsScreen task.timeSlot:', task.timeSlot);
  console.log('DEBUG: TaskDetailsScreen task.photos:', task.photos);
  console.log('DEBUG: TaskDetailsScreen task.referenceImage:', task.referenceImage);
  const normalizePhotoList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  };
  const [bookingDetails, setBookingDetails] = useState(null);
  const [isLoadingBookingDetails, setIsLoadingBookingDetails] = useState(Boolean(bookingId));
  const [bookingDetailsError, setBookingDetailsError] = useState('');
  const booking = bookingDetails?.booking || {};
  const bookingLocations = bookingDetails?.locations || [];
  const pickupLocation = bookingDetails?.pickupLocation || bookingLocations.find((item) => String(item.location_type).toLowerCase() === 'pickup') || null;
  const dropLocation = bookingDetails?.dropLocation || bookingLocations.find((item) => String(item.location_type).toLowerCase() === 'drop') || null;
  const bookingPhotos = normalizePhotoList(bookingDetails?.photos || booking.photos || task.photos || task.referenceImage);
  const displayedCustomerName = booking.username || task.customerName || task.agentName || 'Customer';
  const displayedCustomerPhone = booking.phone || task.customerPhone || task.phoneNumber || '';
  const referenceImage = bookingPhotos[0] || booking.referenceImage || booking.photo_proof || task.referenceImage || task.customerReferenceImage || task.luggageReferenceImage || task.photos?.[0] || null;
  console.log('DEBUG: bookingPhotos:', bookingPhotos);
  console.log('DEBUG: referenceImage:', referenceImage);
  const expectedOtp = String(task.deliveryOtp || task.otp || '1234');
  const otpLength = expectedOtp.length === 6 ? 6 : 4;
  const [weight, setWeight] = useState(task.weight ? String(task.weight) : '');
  const [status, setStatus] = useState(task.status);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [luggagePhotos, setLuggagePhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isVerifyingReference, setIsVerifyingReference] = useState(false);
  const [isReferenceMatched, setIsReferenceMatched] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [otp, setOtp] = useState(Array(otpLength).fill(''));
  const [otpFocused, setOtpFocused] = useState(-1);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const otpInputRefs = useRef([]);

  const agentComparisonImage = luggagePhotos[0]?.uri || null;

  const renderDetailRow = (label, value) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value ? String(value) : 'N/A'}</Text>
    </View>
  );

  const renderPhotoPreview = (uri, key) => (
    <TouchableOpacity key={key} style={styles.photoThumb} activeOpacity={0.9} onPress={() => openImagePreview(uri)}>
      <Image source={{ uri }} style={styles.photoThumbImage} />
    </TouchableOpacity>
  );

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const timer = setInterval(() => {
      setResendTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  useEffect(() => {
    setIsReferenceMatched(false);
  }, [referenceImage, agentComparisonImage]);

  useEffect(() => {
    let cancelled = false;

    if (!bookingId) {
      console.log('DEBUG: No bookingId, skipping fetch');
      setIsLoadingBookingDetails(false);
      return undefined;
    }

    const loadBookingDetails = async () => {
      console.log('DEBUG: Fetching booking details for bookingId:', bookingId);
      setIsLoadingBookingDetails(true);
      setBookingDetailsError('');

      try {
        const url = `${USER_API_URL}/api/agents/booking-details/${bookingId}`;
        console.log('DEBUG: Fetch URL:', url);
        const response = await fetch(url);
        const data = await response.json().catch(() => ({}));
        console.log('DEBUG: Booking details response:', data);

        if (!cancelled && response.ok && data?.success) {
          console.log('DEBUG: Booking details loaded successfully');
          setBookingDetails(data);
        } else if (!cancelled) {
          console.log('DEBUG: Booking details error:', data?.message);
          setBookingDetailsError(data?.message || 'Could not load booking details.');
        }
      } catch (error) {
        console.log('DEBUG: Booking details fetch error:', error);
        if (!cancelled) {
          setBookingDetailsError(error.message || 'Could not load booking details.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBookingDetails(false);
        }
      }
    };

    loadBookingDetails();
    return () => { cancelled = true; };
  }, [bookingId]);

  const handleCallCustomer = () => {
    Alert.alert('Call Customer', `Calling ${displayedCustomerName}${displayedCustomerPhone ? ` at ${displayedCustomerPhone}` : ''}`);
  };

  const verifyReferenceMatch = async (agentImage) => {
    if (!bookingId || !referenceImage || !agentImage) return false;

    try {
      const response = await fetch(`${USER_API_URL}/api/agents/verify-luggage-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          agentImage,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        const matched = Boolean(result.matched);
        setIsReferenceMatched(matched);
        return matched;
      }

      setIsReferenceMatched(false);
      return false;
    } catch (error) {
      console.log('Reference match failed:', error.message);
      setIsReferenceMatched(false);
      return false;
    }
  };

  const addAgentPhoto = async (uri) => {
    setIsUploadingPhoto(true);
    setIsReferenceMatched(false);

    try {
      const dataUrl = await uriToDataUrl(uri);
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        Alert.alert(
          'Photo upload failed',
          'The image could not be prepared for matching on this device. Please try another photo.'
        );
        return;
      }

      const photoId = Date.now();
      setLuggagePhotos(prev => [...prev, { uri: dataUrl, id: photoId }]);
      setIsVerifyingReference(true);
      await verifyReferenceMatch(dataUrl);
    } finally {
      setIsVerifyingReference(false);
      setIsUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos of luggage.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      await addAgentPhoto(result.assets[0].uri);
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
      await addAgentPhoto(result.assets[0].uri);
    }
  };

  const handleRemovePhoto = (photoId) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setLuggagePhotos(prev => prev.filter(p => p.id !== photoId)),
      },
    ]);
  };

  const handleAddPhoto = () => {
    Alert.alert('Add Luggage Photo', 'Choose how to add a photo', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Gallery', onPress: handlePickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openImagePreview = (uri) => {
    setPreviewImageUri(uri);
    setIsPreviewVisible(true);
  };

  const handleOtpChange = (value, index) => {
    const cleanDigit = value.replace(/[^0-9]/g, '').slice(-1);
    const updatedOtp = [...otp];
    updatedOtp[index] = cleanDigit;
    setOtp(updatedOtp);

    if (otpError) setOtpError('');
    if (otpSuccess) setOtpSuccess('');

    if (cleanDigit && index < otpLength - 1) {
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
    if (enteredOtp.length !== otpLength) {
      setOtpError('Please enter complete OTP');
      setOtpSuccess('');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');
    setOtpSuccess('');

    setTimeout(() => {
      if (enteredOtp === expectedOtp) {
        setOtpSuccess('Delivery Verified');
      } else {
        setOtpError('Invalid OTP');
      }
      setIsVerifyingOtp(false);
    }, 900);
  };

  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    setResendTimer(30);
    setOtp(Array(otpLength).fill(''));
    setOtpError('');
    setOtpSuccess('');
    otpInputRefs.current[0]?.focus();
    Alert.alert('OTP Sent', 'A new OTP has been sent to the customer.');
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  const handleUpdateWeight = () => {
    if (!weight.trim()) {
      Alert.alert('Validation', 'Please enter the weight.');
      return;
    }
    Alert.alert('Success', `Weight updated to ${weight} kg`);
  };

  const handleUpdateStatus = (newStatus) => {
    setStatus(newStatus);
    setShowStatusDropdown(false);
    Alert.alert('Success', `Status updated to ${newStatus}`);
  };

  const pickupTimeValue = booking.pickup_time || task.pickupTime || task.timeSlot || 'N/A';

  const bookingSummary = [
    booking.airline_name || task.airlineName ? `Airline: ${booking.airline_name || task.airlineName}` : null,
    booking.flight_number || task.flightNumber ? `Flight: ${booking.flight_number || task.flightNumber}` : null,
    booking.terminal || task.terminal ? `Terminal: ${booking.terminal || task.terminal}` : null,
  ].filter(Boolean).join(' • ');

  const luggageSummary = [
    booking.bag_count ?? task.luggage ? `${booking.bag_count ?? task.luggage} bag${Number(booking.bag_count ?? task.luggage) === 1 ? '' : 's'}` : null,
    booking.bag_weight || task.weight ? `Weight: ${booking.bag_weight || task.weight}` : null,
    booking.is_fragile || task.isFragile ? 'Fragile' : null,
    booking.is_checkin || task.isCheckin ? 'Check-in' : null,
    booking.pincode ? `Pincode: ${booking.pincode}` : null,
  ].filter(Boolean).join(' • ');

  const isLoadingDetails = isLoadingBookingDetails && !booking.id;

  const getStatusColor = (st) => {
    if (st === 'assigned') return '#FF9100';
    if (st === 'in-progress') return '#2196F3';
    if (st === 'completed') return '#4CAF50';
    return Colors.textSecondary;
  };

  const getTaskTypeColor = (type) => {
    return type === 'Pickup' ? '#7C3AED' : '#10B981';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            // Navigate back to Dashboard (In Progress view)
            if (navigation.canGoBack && navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Dashboard', { activeTab: 'Assigned' });
            }
          }}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>{'<'} </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <View style={styles.spacer} />
      </View>

      {bookingDetailsError ? (
        <View style={styles.inlineNotice}>
          <Ionicons name="warning-outline" size={16} color="#B45309" />
          <Text style={styles.inlineNoticeText}>{bookingDetailsError}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Customer Card */}
        <View style={styles.card}>
          <View style={styles.customerHeader}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: getTaskTypeColor(task.type) },
              ]}
            >
              <Text style={styles.avatarText}>
                {displayedCustomerName.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{displayedCustomerName}</Text>
              <Text style={styles.customerId}>{displayedCustomerPhone || task.agentId || `Booking #${bookingId || 'N/A'}`}</Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: getTaskTypeColor(task.type) }]}>
              <Text style={styles.typeText}>{task.type}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCallCustomer}
          >
            <Text style={styles.callIcon}>Call</Text>
            <Text style={styles.callText}>Customer</Text>
          </TouchableOpacity>
        </View>


        {/* Task Information Card */}
<View style={styles.card}>
  <Text style={styles.cardTitle}>Task Information</Text>

  <View style={styles.infoRow}>
    <View style={styles.infoItemWithIcon}>
      <View style={styles.infoIconWrap}>
        <Ionicons name="receipt-outline" size={17} color={Colors.primary} />
      </View>
      <View>
        <Text style={styles.infoLabel}>Booking ID</Text>
        <Text style={styles.infoValue}>{booking.id || task.bookingId || bookingId || 'N/A'}</Text>
      </View>
    </View>
  </View>

  <View style={styles.infoRow}>
    <View style={styles.infoItemWithIcon}>
      <View style={styles.infoIconWrap}>
        <Ionicons name="time-outline" size={17} color={Colors.primary} />
      </View>
      <View>
        <Text style={styles.infoLabel}>Time Slot</Text>
        <Text style={styles.infoValue}>{pickupTimeValue}</Text>
      </View>
    </View>
  </View>

  <View style={styles.infoRow}>
    <View style={styles.infoItemWithIcon}>
      <View style={styles.infoIconWrap}>
        <Ionicons name="briefcase-outline" size={17} color={Colors.primary} />
      </View>
      <View>
        <Text style={styles.infoLabel}>Luggage</Text>
        <Text style={styles.infoValue}>{task.luggage} bags</Text>
      </View>
    </View>
  </View>

  <View style={styles.infoRow}>
    <View style={styles.infoItemWithIcon}>
      <View style={styles.infoIconWrap}>
        <Ionicons name="navigate-circle-outline" size={17} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>Pickup Address</Text>
        <Text style={styles.infoValue}>{pickupLocation?.fullAddress || booking.pickup_address || task.pickupLocation}</Text>
      </View>
    </View>
  </View>

  <View style={styles.infoRow}>
    <View style={styles.infoItemWithIcon}>
      <View style={styles.infoIconWrap}>
        <Ionicons name="location-outline" size={17} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>Drop Address</Text>
        <Text style={styles.infoValue}>{dropLocation?.fullAddress || booking.drop_address || task.dropLocation}</Text>
      </View>
    </View>
  </View>

  {(pickupLocation || dropLocation) && (
    <>
      {pickupLocation ? renderDetailRow('Pickup Contact', pickupLocation.contactName || booking.pickup_contact_name || task.customerName) : null}
      {pickupLocation ? renderDetailRow('Pickup Notes', pickupLocation.notes || booking.pickup_notes || booking.pickup_address) : null}
      {dropLocation ? renderDetailRow('Drop Contact', dropLocation.contactName || booking.drop_contact_name) : null}
      {dropLocation ? renderDetailRow('Drop Notes', dropLocation.notes || booking.drop_notes) : null}
    </>
  )}
</View>
        {/* Luggage Weight */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Luggage Weight</Text>
          <Text style={styles.weightLabel}>Enter Weight (kg)</Text>
          <TextInput
            style={styles.weightInput}
            placeholder="Enter weight"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.textPlaceholder}
          />

          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdateWeight}
          >
            <Text style={styles.updateButtonText}>Update</Text>
          </TouchableOpacity>
        </View>

        {/* Customer Luggage Reference */}
        <View style={styles.referenceCard}>
          <View style={styles.referenceHeaderRow}>
            <View style={styles.referenceIconWrap}>
              <Ionicons name="images-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.referenceTitleBlock}>
              <Text style={styles.referenceTitle}>Customer Luggage Reference</Text>
              <Text style={styles.referenceSubtitle}>Photo uploaded by customer for verification</Text>
            </View>
            <View style={styles.referenceStatusChip}>
              <Text style={[styles.referenceStatusText, isReferenceMatched && styles.referenceStatusTextMatched]}>
                {isReferenceMatched ? 'Matched' : referenceImage ? 'Available' : 'Missing'}
              </Text>
            </View>
          </View>

          {referenceImage ? (
            <TouchableOpacity
              style={styles.referenceImageCard}
              activeOpacity={0.9}
              onPress={() => openImagePreview(referenceImage)}
            >
              <Image source={{ uri: referenceImage }} style={styles.referenceImage} />
            </TouchableOpacity>
          ) : (
            <View style={styles.referencePlaceholder}>
              <Text style={styles.referencePlaceholderText}>No reference photo provided</Text>
            </View>
          )}

          <View style={styles.referenceHintBox}>
            <Ionicons name="checkmark-circle-outline" size={15} color="#0F8A4B" />
            <Text style={styles.referenceHint}>Match this before pickup</Text>
          </View>

          {referenceImage && agentComparisonImage && (
            <View style={styles.compareRow}>
              <View style={styles.comparePane}>
                <Text style={styles.compareLabel}>Customer</Text>
                <Image source={{ uri: referenceImage }} style={styles.compareImage} />
              </View>
              <View style={styles.comparePane}>
                <Text style={styles.compareLabel}>Agent</Text>
                <Image source={{ uri: agentComparisonImage }} style={styles.compareImage} />
              </View>
            </View>
          )}

          {isReferenceMatched && (
            <View style={styles.matchSuccessBox}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.matchSuccessText}>Reference matched</Text>
            </View>
          )}

          {bookingPhotos.length > 0 && (
            <View style={styles.bookingPhotosBlock}>
              <Text style={styles.photoDescription}>Photos uploaded during booking</Text>
              <View style={styles.bookingPhotoStrip}>
                {bookingPhotos.map((uri, index) => renderPhotoPreview(uri, `booking-photo-${index}`))}
              </View>
            </View>
          )}
        </View>

        {/* Luggage Photos */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Luggage Photos</Text>
          <Text style={styles.photoDescription}>
            Capture live photos of the luggage for verification and records.
          </Text>

          {/* Photo Grid */}
          {luggagePhotos.length > 0 && (
            <View style={styles.photoGrid}>
              {luggagePhotos.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.photoRemoveButton}
                    onPress={() => handleRemovePhoto(photo.id)}
                  >
                    <Ionicons name="close-circle" size={22} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {isUploadingPhoto && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.uploadingText}>
                {isVerifyingReference ? 'Verifying match...' : 'Uploading photo...'}
              </Text>
            </View>
          )}

          {/* Add Photo Buttons */}
          <View style={styles.photoButtonsRow}>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={22} color={Colors.textWhite} />
              <Text style={styles.cameraButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.galleryButton}
              onPress={handlePickPhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="image" size={22} color={Colors.primary} />
              <Text style={styles.galleryButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          {luggagePhotos.length > 0 && (
            <Text style={styles.photoCount}>
              {luggagePhotos.length} photo{luggagePhotos.length !== 1 ? 's' : ''} uploaded
            </Text>
          )}
        </View>

        {/* Status Indicators */}
        {task.status === 'in-progress' && task.weight && (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>OK</Text>
            <Text style={styles.successText}>Weight updated: {task.weight} kg</Text>
          </View>
        )}

        {task.status === 'completed' && (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>OK</Text>
            <Text style={styles.successText}>OTP Verified</Text>
          </View>
        )}

        {/* Delivery OTP Verification */}
        <View style={styles.otpCard}>
          <Text style={styles.otpTitle}>Delivery OTP Verification</Text>
          <Text style={styles.otpSubtitle}>Enter OTP provided by customer to complete delivery</Text>

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
                textContentType="oneTimeCode"
                maxLength={1}
                style={[
                  styles.otpInputBox,
                  otpFocused === index && styles.otpInputBoxFocused,
                  digit !== '' && styles.otpInputBoxFilled,
                  !!otpError && styles.otpInputBoxError,
                  !!otpSuccess && digit !== '' && styles.otpInputBoxSuccess,
                ]}
                returnKeyType="done"
                caretHidden
              />
            ))}
          </View>

          {!!otpError && <Text style={styles.otpErrorText}>{otpError}</Text>}
          {!!otpSuccess && <Text style={styles.otpSuccessText}>{otpSuccess}</Text>}

          <TouchableOpacity
            style={[styles.verifyOtpButton, (!isOtpComplete || isVerifyingOtp) && styles.verifyOtpButtonDisabled]}
            onPress={handleVerifyOtp}
            disabled={!isOtpComplete || isVerifyingOtp}
            activeOpacity={0.85}
          >
            {isVerifyingOtp ? (
              <ActivityIndicator size="small" color={Colors.textWhite} />
            ) : (
              <Text style={styles.verifyOtpButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendOtp}
            disabled={resendTimer > 0}
          >
            <Text style={[styles.resendButtonText, resendTimer > 0 && styles.resendButtonTextDisabled]}>
              {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

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
              <Ionicons name="close" size={22} color={Colors.textWhite} />
            </TouchableOpacity>
            {!!previewImageUri && (
              <Image source={{ uri: previewImageUri }} style={styles.previewImage} resizeMode="contain" />
            )}
          </View>
        </View>
      </Modal>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 24,
    color: Colors.textWhite,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  spacer: {
    width: 40,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  keyboardContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inlineNotice: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: -2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingText: {
    marginLeft: 10,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  detailRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  detailLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    lineHeight: 20,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 16,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  customerId: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    color: Colors.textWhite,
    fontSize: 11,
    fontWeight: '600',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  callIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  callText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoItemWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 3,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusSelector: {
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  statusDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusDropdownText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownIcon: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  weightLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  weightInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  updateButton: {
    backgroundColor: Colors.buttonPrimary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: Colors.textWhite,
    fontWeight: '600',
    fontSize: 14,
  },
  referenceCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  referenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  referenceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  referenceTitleBlock: {
    flex: 1,
  },
  referenceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  referenceSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  referenceStatusChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  referenceStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  referenceStatusTextMatched: {
    color: Colors.success,
  },
  referenceImageCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  referenceImage: {
    width: '100%',
    height: 220,
  },
  referencePlaceholder: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 34,
    paddingHorizontal: 12,
  },
  referencePlaceholderText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  referenceHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 6,
  },
  referenceHintBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  comparePane: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.background,
    padding: 8,
  },
  compareLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  compareImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: Colors.backgroundSecondary,
  },
  matchSuccessBox: {
    marginTop: 12,
    backgroundColor: Colors.successLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchSuccessText: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  successCard: {
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  successIcon: {
    fontSize: 18,
    color: Colors.success,
    marginRight: 10,
    fontWeight: '700',
  },
  successText: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '500',
  },
  photoDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  bookingPhotosBlock: {
    marginTop: 12,
  },
  bookingPhotoStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cameraButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.buttonPrimary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  cameraButtonText: {
    color: Colors.textWhite,
    fontWeight: '600',
    fontSize: 14,
  },
  galleryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 8,
  },
  galleryButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 10,
    gap: 8,
  },
  uploadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  photoCount: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 10,
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewContent: {
    width: '92%',
    maxWidth: 480,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: SCREEN_WIDTH * 1.1,
    maxHeight: 560,
  },
  otpCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  otpTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  otpSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  otpInputsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 10,
  },
  otpInputBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8C4B0',
    backgroundColor: Colors.background,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  otpInputBoxFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  otpInputBoxFilled: {
    borderColor: '#D4845E',
    backgroundColor: '#FFF8F5',
  },
  otpInputBoxError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  otpInputBoxSuccess: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  verifyOtpButton: {
    backgroundColor: Colors.buttonPrimary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  verifyOtpButtonDisabled: {
    backgroundColor: '#E8A58D',
  },
  verifyOtpButtonText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  otpErrorText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  otpSuccessText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  resendButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  resendButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: Colors.textTertiary,
  },
});