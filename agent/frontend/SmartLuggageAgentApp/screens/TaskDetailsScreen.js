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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 60) / 3;

export default function TaskDetailsScreen({ navigation, route }) {
  const { task } = route.params;
  const referenceImage = task.referenceImage || task.customerReferenceImage || task.luggageReferenceImage || null;
  const expectedOtp = String(task.deliveryOtp || task.otp || '1234');
  const otpLength = expectedOtp.length === 6 ? 6 : 4;
  const [weight, setWeight] = useState(task.weight ? String(task.weight) : '');
  const [status, setStatus] = useState(task.status);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [luggagePhotos, setLuggagePhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [otp, setOtp] = useState(Array(otpLength).fill(''));
  const [otpFocused, setOtpFocused] = useState(-1);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const otpInputRefs = useRef([]);

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const timer = setInterval(() => {
      setResendTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleCallCustomer = () => {
    Alert.alert('Call Customer', `Calling ${task.agentName} at ${task.phoneNumber}`);
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
      setIsUploadingPhoto(true);
      // Simulate upload delay
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
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>{'<'} </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <View style={styles.spacer} />
      </View>

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
                {task.agentName.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{task.agentName}</Text>
              <Text style={styles.customerId}>{task.agentId}</Text>
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
            <Text style={styles.callText}>Call Customer</Text>
          </TouchableOpacity>
        </View>

        {/* Task Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Task Information</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoItemWithIcon}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="time-outline" size={17} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Time Slot</Text>
                <Text style={styles.infoValue}>{task.timeSlot}</Text>
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
                <Text style={styles.infoValue}>{task.pickupLocation}</Text>
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
                <Text style={styles.infoValue}>{task.dropLocation}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Update Delivery Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Update Delivery Status</Text>

          <View style={styles.statusSelector}>
            <Text style={styles.statusLabel}>Select Status</Text>
            <TouchableOpacity
              style={styles.statusDropdown}
              onPress={() => setShowStatusDropdown(!showStatusDropdown)}
            >
              <Text style={[styles.statusDropdownText, { color: getStatusColor(status) }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
              <Text style={styles.dropdownIcon}>{showStatusDropdown ? '^' : 'v'}</Text>
            </TouchableOpacity>

            {showStatusDropdown && (
              <View style={styles.dropdownMenu}>
                {['assigned', 'in-progress', 'completed'].map(st => (
                  <TouchableOpacity
                    key={st}
                    style={styles.dropdownItem}
                    onPress={() => handleUpdateStatus(st)}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        { color: getStatusColor(st) },
                      ]}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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
              <Text style={styles.referenceStatusText}>{referenceImage ? 'Available' : 'Missing'}</Text>
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

          {referenceImage && luggagePhotos.length > 0 && (
            <View style={styles.compareRow}>
              <View style={styles.comparePane}>
                <Text style={styles.compareLabel}>Customer</Text>
                <Image source={{ uri: referenceImage }} style={styles.compareImage} />
              </View>
              <View style={styles.comparePane}>
                <Text style={styles.compareLabel}>Agent</Text>
                <Image source={{ uri: luggagePhotos[0].uri }} style={styles.compareImage} />
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
              <Text style={styles.uploadingText}>Uploading photo...</Text>
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