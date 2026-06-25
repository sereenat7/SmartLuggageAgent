// components/steps/Step4FacialRecognition.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StepContainer from '../StepContainer';
import CameraSelfie from '../CameraSelfie';
import Colors from '../../constants/colors';

export default function Step4FacialRecognition({ formData, updateFormData, errors, direction }) {
  return (
    <StepContainer
      title="Facial Verification"
      description="Take a selfie so we can verify your identity by matching it with your ID photo"
      animationDirection={direction}
    >
      <View style={styles.form}>
        <View style={styles.securityNote}>
          <View style={styles.securityIcon}>
            <Ionicons name="shield-checkmark" size={24} color={Colors.success} />
          </View>
          <View style={styles.securityTextContainer}>
            <Text style={styles.securityTitle}>Your data is secure</Text>
            <Text style={styles.securityText}>
              We use advanced encryption to protect your biometric data. Your selfie is only used for verification.
            </Text>
          </View>
        </View>

        <CameraSelfie
          label="Selfie Photo"
          value={formData.selfie}
          onCapture={(photo) => updateFormData('selfie', photo)}
          error={errors.selfie}
        />

        <View style={styles.processBox}>
          <Text style={styles.processTitle}>Verification Process</Text>
          <View style={styles.processStep}>
            <View style={styles.processNumber}>
              <Text style={styles.processNumberText}>1</Text>
            </View>
            <Text style={styles.processText}>Take a clear selfie</Text>
          </View>
          <View style={styles.processStep}>
            <View style={styles.processNumber}>
              <Text style={styles.processNumberText}>2</Text>
            </View>
            <Text style={styles.processText}>AI matches with your ID photo</Text>
          </View>
          <View style={styles.processStep}>
            <View style={styles.processNumber}>
              <Text style={styles.processNumberText}>3</Text>
            </View>
            <Text style={styles.processText}>Instant verification result</Text>
          </View>
        </View>
      </View>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
  },
  securityNote: {
    flexDirection: 'row',
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  securityIcon: {
    marginRight: 12,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: 4,
  },
  securityText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  processBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
  },
  processTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  processStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  processNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  processNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  processText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});

