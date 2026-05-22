// screens/KYCFormScreen.js
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { API_URL } from '../config';
import Colors from '../constants/colors';
import ProgressStepper from '../components/ProgressStepper';
import Step1PersonalInfo from '../components/steps/Step1PersonalInfo';
import Step2GovernmentID from '../components/steps/Step2GovernmentID';
import Step3AddressProof from '../components/steps/Step3AddressProof';
import Step4FacialRecognition from '../components/steps/Step4FacialRecognition';
import Step5BankDetails from '../components/steps/Step5BankDetails';
import Step6VehicleDetails from '../components/steps/Step6VehicleDetails';
import Step7EmergencyContact from '../components/steps/Step7EmergencyContact';
import Step8Consent from '../components/steps/Step8Consent';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 8;

const initialFormData = {
  // Step 1: Personal Info
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  nationality: '',
  
  // Step 2: Government ID
  idType: '',
  idNumber: '',
  idFront: null,
  idBack: null,
  
  // Step 3: Address
  streetAddress: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  addressProof: null,
  isPermAddressDifferent: false,
  permStreetAddress: '',
  permCity: '',
  permState: '',
  permPostalCode: '',
  permCountry: '',
  
  // Step 4: Selfie
  selfie: null,
  
  // Step 5: Bank Details
  accountName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branchName: '',
  
  // Step 6: Vehicle (optional)
  vehicleType: '',
  vehicleModel: '',
  vehicleColor: '',
  licensePlate: '',
  registrationNumber: '',
  vehicleDocument: null,
  drivingLicense: null,
  
  // Step 7: Emergency Contact
  emergencyName: '',
  emergencyRelation: '',
  emergencyPhone: '',
  emergencyAltPhone: '',
  emergencyEmail: '',
  emergencyAddress: '',
  
  // Step 8: Consent
  confirmAccuracy: false,
  agreeTerms: false,
  agreePrivacy: false,
  agreeCommunications: false,
};

export default function KYCFormScreen({ navigation, route }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [direction, setDirection] = useState('right');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  // Get token and initial data from params
  const { token, agentName, agentPhone, userId } = route.params || {};

  // Initialize form with passed data if not already set
  React.useEffect(() => {
    if (agentName || agentPhone) {
      setFormData(prev => ({
        ...prev,
        fullName: agentName || prev.fullName,
        phone: agentPhone || prev.phone,
      }));
    }
  }, [agentName, agentPhone]);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);

  const validateStep = (step) => {
    const newErrors = {};

    // Only validate email format if the user has entered an email
    if (step === 0 && formData.email.trim() && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep < TOTAL_STEPS - 1) {
      setDirection('right');
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection('left');
      setCurrentStep(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Create FormData object formultipart upload
    const data = new FormData();
    // Append all text fields
    Object.keys(formData).forEach(key => {
      // Skip file keys and undefined values
      if (['idFront', 'idBack', 'addressProof', 'selfie', 'vehicleDocument', 'drivingLicense'].includes(key)) {
        return; 
      }
      if (formData[key] !== undefined && formData[key] !== null) {
        data.append(key, String(formData[key]));
      }
    });

    // Handle files - depends on platform (web vs native)
    const appendFile = (key, fileObj) => {
      if (!fileObj) return;

      if (Platform.OS === 'web') {
        data.append(key, fileObj);
      } else {
        // Native
        data.append(key, {
          uri: fileObj.uri,
          type: fileObj.mimeType || 'image/jpeg', 
          name: fileObj.name || `${key}.jpg`,
        });
      }
    };

    appendFile('idFront', formData.idFront);
    appendFile('idBack', formData.idBack);
    appendFile('addressProof', formData.addressProof);
    appendFile('selfie', formData.selfie);
    appendFile('vehicleDocument', formData.vehicleDocument);
    appendFile('drivingLicense', formData.drivingLicense);

    try {
      if (!token) {
        throw new Error('Authentication token missing. Please login again.');
      }

      const response = await fetch(`${API_URL}/api/kyc`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type manually for FormData, fetch does it with boundary
        },
        body: data,
      });

      if (!response.ok) {
        const txt = await response.text();
        let errData;
        try { errData = JSON.parse(txt); } catch(e) { errData = { error: txt }; }
        throw new Error(errData.error || 'KYC submission failed');
      }

      // Success
      setIsSubmitting(false);
      setIsComplete(true);
      
      // Success animation
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

    } catch (error) {
      console.error('KYC Submit Error:', error);
      setIsSubmitting(false);
      if (Platform.OS === 'web') {
        window.alert(error.message || 'Failed to submit KYC.');
      } else {
        Alert.alert('Error', error.message || 'Failed to submit KYC.');
      }
    }
  };

  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const renderStep = () => {
    const stepProps = {
      formData,
      updateFormData,
      errors,
      direction,
    };

    switch (currentStep) {
      case 0:
        return <Step1PersonalInfo {...stepProps} />;
      case 1:
        return <Step2GovernmentID {...stepProps} />;
      case 2:
        return <Step3AddressProof {...stepProps} />;
      case 3:
        return <Step4FacialRecognition {...stepProps} />;
      case 4:
        return <Step5BankDetails {...stepProps} />;
      case 5:
        return <Step6VehicleDetails {...stepProps} />;
      case 6:
        return <Step7EmergencyContact {...stepProps} />;
      case 7:
        return <Step8Consent {...stepProps} />;
      default:
        return null;
    }
  };

  if (isComplete) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Animated.View
            style={[
              styles.successContent,
              {
                transform: [{ scale: successScale }],
                opacity: successOpacity,
              },
            ]}
          >
            <View style={styles.successIconContainer}>
              <LinearGradient
                colors={[Colors.success, '#2E7D32']}
                style={styles.successIconGradient}
              >
                <Ionicons name="checkmark" size={60} color={Colors.textWhite} />
              </LinearGradient>
            </View>
            <Text style={styles.successTitle}>KYC Submitted!</Text>
            <Text style={styles.successText}>
              Your verification is being processed. You'll receive a confirmation within 24-48 hours.
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => navigation.reset({
                index: 0,
                routes: [{ 
                  name: 'Dashboard', 
                  params: { 
                    user: { ...formData, id: userId }, // Pass as 'user' to match Dashboard expectation
                    token: token 
                  } 
                }],
              })}
            >
              <Text style={styles.successButtonText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>KYC Verification</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              Alert.alert(
                'Exit KYC',
                'Your progress will be saved. Are you sure you want to exit?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Exit', onPress: () => navigation.goBack() },
                ]
              );
            }}
          >
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Progress Stepper */}
        <ProgressStepper currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        {/* Step Content */}
        <View style={styles.stepContent} key={currentStep}>
          {renderStep()}
        </View>

        {/* Bottom Buttons */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.backBtn, currentStep === 0 && styles.backBtnFirst]}
            onPress={handleBack}
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={currentStep === 0 ? Colors.textSecondary : Colors.primary}
            />
            <Text
              style={[
                styles.backBtnText,
                currentStep === 0 && styles.backBtnTextFirst,
              ]}
            >
              {currentStep === 0 ? 'Cancel' : 'Back'}
            </Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[styles.nextBtn, isSubmitting && styles.nextBtnDisabled]}
              onPress={handleNext}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextBtnGradient}
              >
                {isSubmitting ? (
                  <Text style={styles.nextBtnText}>Submitting...</Text>
                ) : (
                  <>
                    <Text style={styles.nextBtnText}>
                      {currentStep === TOTAL_STEPS - 1 ? 'Submit' : 'Continue'}
                    </Text>
                    <Ionicons
                      name={currentStep === TOTAL_STEPS - 1 ? 'checkmark' : 'arrow-forward'}
                      size={20}
                      color={Colors.textWhite}
                    />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContent: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 6,
    minHeight: 48,
  },
  backBtnFirst: {
    borderColor: Colors.border,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  backBtnTextFirst: {
    color: Colors.textSecondary,
  },
  nextBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextBtnDisabled: {
    opacity: 0.7,
  },
  nextBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 16,
    gap: 8,
    minHeight: 48,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successContent: {
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  successButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
});
