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
  FlatList,
  Linking,
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
  const [taskDetails, setTaskDetails] = useState(booking);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSuccess, setMessageSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes (300 seconds)
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  const [luggagePhotos, setLuggagePhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [weight, setWeight] = useState(booking?.bag_weight ? String(booking.bag_weight) : '');
  const [pickupConfirmed, setPickupConfirmed] = useState(false);
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);
  const [pickupVerificationDetails, setPickupVerificationDetails] = useState(route?.params?.pickupVerificationDetails || null);
  
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
  const customerName = taskDetails?.customerName || taskDetails?.username || taskDetails?.name || taskDetails?.userName || 'Customer';
  const customerPhone = taskDetails?.phone || taskDetails?.phoneNumber || taskDetails?.customerPhone || taskDetails?.userPhone || '';
  const pickupLocation = taskDetails?.pickup_address || taskDetails?.pickupLocation || taskDetails?.pickupAddress || 'Pickup location pending';
  const dropLocation = taskDetails?.drop_address || taskDetails?.dropLocation || taskDetails?.dropAddress || 'Drop location pending';
  const pickupTime = taskDetails?.pickup_time || taskDetails?.pickupTime || taskDetails?.timeSlot || 'Time slot pending';
  const luggageCount = Number(taskDetails?.bag_count || taskDetails?.luggage || taskDetails?.bagCount || 1);
  const bookingId = taskDetails?.bookingId || taskDetails?.booking_id || (String(taskDetails?.id).includes('session') || String(taskDetails?.id).includes('request') ? null : taskDetails?.id);
  const referenceImageUri = (() => {
    let candidate = taskDetails?.referenceImage || taskDetails?.reference_image || taskDetails?.photos || taskDetails?.photo || taskDetails?.image || null;
    if (!candidate) return null;
    if (typeof candidate === 'string') {
      if (candidate.startsWith('[') && candidate.endsWith(']')) {
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed) && parsed.length > 0) {
            candidate = parsed[0];
          } else {
            return null;
          }
        } catch (e) {
          // Keep candidate as is if not valid JSON
        }
      } else {
        return candidate;
      }
    }
    if (typeof candidate === 'string') return candidate;
    if (Array.isArray(candidate)) {
      const first = candidate[0];
      if (typeof first === 'string') return first;
      return first?.uri || first?.url || null;
    }
    if (typeof candidate === 'object') return candidate.uri || candidate.url || null;
    return null;
  })();
  const referenceImage = referenceImageUri;

  const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
  const isOnTheWay = normalizeStatus(currentStatus) === 'on-the-way' || normalizeStatus(currentStatus) === 'on_the_way' || normalizeStatus(currentStatus) === 'picked_up';

  const formatVerifiedAt = (dateStr) => {
    if (!dateStr) return 'Just now';
    if (dateStr === 'Just now') return 'Just now';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  // Poll booking details from backend to keep UI fully in sync (wait timers, no-show status, etc.)
  useEffect(() => {
    if (!bookingId) return;

    let isMounted = true;
    const fetchBookingDetails = async () => {
      try {
        const resp = await fetch(`${USER_API_URL}/api/bookings/agent-details/${bookingId}`);
        const data = await resp.json().catch(() => ({}));
        if (isMounted && resp.ok && data?.customer) {
          setTaskDetails(prev => ({
            ...prev,
            ...data.customer,
            bookingId: bookingId,
            booking_id: bookingId,
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch booking details:', err);
      }
    };

    fetchBookingDetails();
    const interval = setInterval(fetchBookingDetails, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [bookingId]);

  // Sync currentStatus when taskDetails updates
  useEffect(() => {
    if (taskDetails?.status || taskDetails?.assignmentStatus) {
      setCurrentStatus(String(taskDetails.status || taskDetails.assignmentStatus || 'pending').toLowerCase());
    }
  }, [taskDetails?.status, taskDetails?.assignmentStatus]);

  // Poll chat messages from backend when chat is visible
  useEffect(() => {
    if (!isChatVisible || !bookingId) return;

    let isMounted = true;
    const fetchChatMessages = async () => {
      try {
        const resp = await fetch(`${USER_API_URL}/api/agents/messages/${bookingId}`);
        const data = await resp.json().catch(() => ({}));
        if (isMounted && resp.ok && data?.messages) {
          setChatMessages(data.messages);
        }
      } catch (err) {
        console.warn('Failed to fetch chat messages:', err);
      }
    };

    fetchChatMessages();
    const interval = setInterval(fetchChatMessages, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isChatVisible, bookingId]);

  // Countdown timer for arrival wait
  const arrivedAtStr = taskDetails?.arrivedAt || taskDetails?.arrived_at || null;
  const isAtPickup = String(taskDetails?.assignmentStatus || taskDetails?.assignment_status || '').toLowerCase() === 'at_pickup';

  useEffect(() => {
    if (!arrivedAtStr || !isAtPickup) return;

    const updateTimer = () => {
      const arrivedTime = new Date(arrivedAtStr).getTime();
      const elapsed = (Date.now() - arrivedTime) / 1000;
      const remaining = Math.max(0, 300 - Math.floor(elapsed));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [arrivedAtStr, isAtPickup]);

  const formatTimeLeft = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // In-app messaging for due diligence
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    try {
      setIsSendingMessage(true);
      const resp = await fetch(`${USER_API_URL}/api/agents/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingId,
          sender: 'agent',
          message: messageText.trim()
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Failed to send message');
      }
      setMessageText('');
      setMessageSuccess('Message sent to customer!');
      setTimeout(() => setMessageSuccess(''), 3000);
      
      // Instantly refresh message count
      const detailsResp = await fetch(`${USER_API_URL}/api/bookings/agent-details/${bookingId}`);
      const detailsData = await detailsResp.json().catch(() => ({}));
      if (detailsResp.ok && detailsData?.customer) {
        setTaskDetails(prev => ({
          ...prev,
          ...detailsData.customer,
          bookingId: bookingId,
          booking_id: bookingId,
        }));
      }
    } catch (err) {
      Alert.alert('Message Error', err.message || 'Failed to send message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Trigger distance-based cancellation on customer no-show
  const handleNoShowCancel = async () => {
    Alert.alert(
      'Confirm No-Show Cancellation',
      'Are you sure the customer is a no-show? This will charge the customer a distance-based cancellation fee and cancel this booking.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            try {
               setIsProcessing(true);
               const resp = await fetch(`${USER_API_URL}/api/agents/no-show`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                   bookingId: bookingId,
                   agentId: taskDetails?.agentId || taskDetails?.agent_id || booking?.agentId || 1
                 })
               });
               const data = await resp.json().catch(() => ({}));
               if (!resp.ok || !data.success) {
                 throw new Error(data.message || 'No-show cancellation failed');
               }
               
               Alert.alert(
                 'Booking Cancelled',
                 `Booking has been cancelled as customer no-show. A fee of ${data.cancellationFee} Rs has been charged to their profile.`,
                 [
                   {
                     text: 'OK',
                     onPress: () => {
                       navigation.navigate('Dashboard', { activeTab: 'In Progress', refreshInbox: true });
                     }
                   }
                 ]
               );
            } catch (err) {
              Alert.alert('Cancellation Error', err.message || 'Failed to cancel booking.');
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    const verifiedFromRoute = Boolean(route?.params?.pickupVerified || route?.params?.pickupVerificationDetails);
    const verifiedFromBooking = Boolean(
      taskDetails?.pickupVerified || 
      taskDetails?.pickup_verified || 
      taskDetails?.pickupVerifiedAt || 
      taskDetails?.pickup_verified_at
    );
    
    const statusLower = normalizeStatus(taskDetails?.status);
    const assignmentLower = normalizeStatus(taskDetails?.assignmentStatus || taskDetails?.assignment_status);

    if (
      verifiedFromRoute || 
      verifiedFromBooking || 
      statusLower === 'picked_up' || 
      statusLower === 'on-the-way' || 
      statusLower === 'on_the_way' || 
      assignmentLower === 'picked_up' || 
      assignmentLower === 'at_airport' || 
      assignmentLower === 'delivered'
    ) {
      setPickupConfirmed(true);
      if (verifiedFromRoute && route?.params?.pickupVerificationDetails) {
        setPickupVerificationDetails(route.params.pickupVerificationDetails);
      }
      return;
    } else {
      setPickupConfirmed(false);
    }
  }, [
    taskDetails?.status, 
    taskDetails?.assignmentStatus, 
    taskDetails?.assignment_status, 
    taskDetails?.pickupVerified, 
    taskDetails?.pickup_verified, 
    route?.params?.pickupVerified, 
    route?.params?.pickupVerificationDetails
  ]);

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

  const handleMessageCustomer = () => {
    if (!customerPhone) {
      Alert.alert('Error', 'No phone number available');
      return;
    }
    let cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const whatsappUrl = `https://wa.me/${cleanPhone}`;
    Linking.openURL(whatsappUrl).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on this device');
    });
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
    navigation.navigate('QrScanner', {
      bookingId,
      qrType: 'pickup',
      bookingTitle: 'Scan Pickup QR',
      agentId: booking?.agentId || booking?.agent_id || 0,
      agentName: booking?.agentName || booking?.username || booking?.name || 'Agent',
      task: booking,
    });
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
          : 'Pickup confirmed. Status updated to on the way.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Dashboard', { activeTab: 'Completed', refreshInbox: true });
            }
          }
        ]
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
    navigation.navigate('QrScanner', {
      bookingId,
      qrType: 'destination',
      bookingTitle: 'Scan Destination QR',
      agentId: booking?.agentId || booking?.agent_id || 0,
      agentName: booking?.agentName || booking?.username || booking?.name || 'Agent',
      task: booking,
    });
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

  const statusLowerHelper = normalizeStatus(taskDetails?.status || currentStatus);
  const assignmentLowerHelper = normalizeStatus(taskDetails?.assignmentStatus || taskDetails?.assignment_status);
  const isAtAirport = assignmentLowerHelper === 'at_airport';
  const isDelivered = assignmentLowerHelper === 'delivered' || statusLowerHelper === 'delivered';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Dashboard', { activeTab: 'In Progress' })}
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
          <ScrollView 
            style={styles.scrollContent} 
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
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

              <View style={styles.contactRow}>
                <TouchableOpacity
                  style={[styles.callButtonCall, !customerPhone && styles.callButtonDisabled]}
                  onPress={handleCallCustomer}
                  disabled={!customerPhone}
                >
                  <Ionicons name="call" size={18} color="#fff" />
                  <Text style={styles.callButtonText}>Call Customer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.callButtonMsg, !customerPhone && styles.callButtonDisabled]}
                  onPress={handleMessageCustomer}
                  disabled={!customerPhone}
                >
                  <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Booking Details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Booking Details</Text>

              {bookingId && (
                <View style={styles.infoRow}>
                  <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Booking ID</Text>
                    <Text style={styles.infoValue}>#{bookingId}</Text>
                  </View>
                </View>
              )}

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

            {/* Pickup Wait & Due Diligence Card */}
            {isAtPickup && !pickupConfirmed && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Wait Time</Text>
                
                {/* No Show Cancellation Button */}
                <TouchableOpacity
                  style={[
                    styles.noShowBtn, 
                    (timeLeft > 0 || isProcessing) && styles.noShowBtnDisabled
                  ]}
                  onPress={handleNoShowCancel}
                  disabled={timeLeft > 0 || isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.noShowBtnText}>
                        {timeLeft > 0 
                          ? `Wait ${formatTimeLeft(timeLeft)}` 
                          : 'Mark Customer No Show'
                        }
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pickup QR</Text>

              {!pickupConfirmed ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.pickupButton]}
                  onPress={handleConfirmPickup}
                  disabled={isProcessing}
                >
                  <>
                    <Ionicons name="qr-code-outline" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Scan Pickup QR</Text>
                  </>
                </TouchableOpacity>
              ) : (
                <View style={styles.verificationSuccessContainer}>
                  <View style={styles.verificationSuccessRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={styles.verificationSuccessTitle}>Pickup successfully verified</Text>
                  </View>
                  <Text style={styles.verificationSuccessText}>
                    Verified at: {formatVerifiedAt(
                      pickupVerificationDetails?.verifiedAt || 
                      booking?.pickupVerifiedAt || 
                      booking?.pickup_verified_at
                    )}
                  </Text>
                </View>
              )}
            </View>

            {/* Delivery QR - only show if pickup confirmed and assignment status is at_airport or delivered */}
            {pickupConfirmed && (isAtAirport || isDelivered) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Delivery QR</Text>

                {!isDelivered ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.pickupButton]}
                    onPress={handleCompleteDelivery}
                    disabled={isProcessing}
                  >
                    <>
                      <Ionicons name="qr-code-outline" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Scan Destination QR</Text>
                    </>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.verificationSuccessContainer}>
                    <View style={styles.verificationSuccessRow}>
                      <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                      <Text style={styles.verificationSuccessTitle}>Delivery successfully verified</Text>
                    </View>
                    <Text style={styles.verificationSuccessText}>
                      Verified at: {formatVerifiedAt(
                        taskDetails?.deliveryVerifiedAt || 
                        taskDetails?.delivered_at ||
                        booking?.deliveryVerifiedAt || 
                        booking?.delivered_at
                      )}
                    </Text>
                  </View>
                )}
              </View>
            )}

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

        {/* Chat Modal */}
        <Modal
          visible={isChatVisible}
          animationType="slide"
          onRequestClose={() => setIsChatVisible(false)}
        >
          <SafeAreaView style={styles.chatSafeArea}>
            {/* Header */}
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={() => setIsChatVisible(false)} style={styles.chatCloseBtn}>
                <Ionicons name="arrow-back" size={24} color="#1A1C1E" />
              </TouchableOpacity>
              <Text style={styles.chatHeaderTitle}>{customerName}</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Message List */}
            <FlatList
              data={chatMessages}
              keyExtractor={(item) => String(item.id || item.created_at || Math.random())}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              renderItem={({ item }) => {
                const isAgent = item.sender === 'agent';
                return (
                  <View style={[
                    styles.msgBubbleContainer,
                    isAgent ? styles.msgBubbleAgentContainer : styles.msgBubbleUserContainer
                  ]}>
                    <View style={[
                      styles.msgBubble,
                      isAgent ? styles.msgBubbleAgent : styles.msgBubbleUser
                    ]}>
                      <Text style={[
                        styles.msgText,
                        isAgent ? styles.msgTextAgent : styles.msgTextUser
                      ]}>
                        {item.message}
                      </Text>
                      {item.created_at && (
                        <Text style={[
                          styles.msgTime,
                          isAgent ? styles.msgTimeAgent : styles.msgTimeUser
                        ]}>
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              }}
            />

            {/* Input Footer */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
              <View style={styles.chatFooter}>
                <TextInput
                  style={styles.chatModalInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#94A3B8"
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.chatModalSendBtn, (!messageText.trim() || isSendingMessage) && styles.chatModalSendBtnDisabled]}
                  onPress={handleSendMessage}
                  disabled={!messageText.trim() || isSendingMessage}
                >
                  {isSendingMessage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

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
  verificationSuccessContainer: {
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  verificationSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verificationSuccessTitle: {
    color: '#166534',
    fontSize: 15,
    fontWeight: '700',
  },
  verificationSuccessText: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 18,
  },
  detailsButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  detailsButtonText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
  },
  verificationDetailsCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  verificationDetailsTitle: {
    color: '#14532D',
    fontSize: 13,
    fontWeight: '700',
  },
  verificationDetailText: {
    color: '#374151',
    fontSize: 12,
    lineHeight: 17,
  },
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
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  timerTextContainer: {
    flex: 1,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  timerValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  timerActive: {
    color: '#ff6600',
  },
  timerCompleted: {
    color: '#22c55e',
  },
  diligenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  diligenceText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chatInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1A1C1E',
    backgroundColor: '#F8FAFC',
  },
  sendBtn: {
    backgroundColor: '#ff6600',
    borderRadius: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  successText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  noShowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    marginTop: 8,
  },
  noShowBtnDisabled: {
    backgroundColor: '#CBD5E1',
    opacity: 0.7,
  },
  noShowBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  callButtonCall: {
    flex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 10,
  },
  callButtonMsg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
  },
  chatSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  chatCloseBtn: {
    padding: 8,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1C1E',
  },
  msgBubbleContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    width: '100%',
  },
  msgBubbleAgentContainer: {
    justifyContent: 'flex-end',
  },
  msgBubbleUserContainer: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
    elevation: 1,
  },
  msgBubbleAgent: {
    backgroundColor: '#ff6600',
    borderTopRightRadius: 2,
  },
  msgBubbleUser: {
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 2,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 18,
  },
  msgTextAgent: {
    color: '#FFFFFF',
  },
  msgTextUser: {
    color: '#1A1C1E',
  },
  msgTime: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  msgTimeAgent: {
    color: 'rgba(255,255,255,0.7)',
  },
  msgTimeUser: {
    color: '#64748B',
  },
  chatFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  chatModalInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: '#1A1C1E',
  },
  chatModalSendBtn: {
    backgroundColor: '#ff6600',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatModalSendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
});
