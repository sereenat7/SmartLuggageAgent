// components/steps/Step8Consent.js
import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StepContainer from '../StepContainer';
import AnimatedCheckbox from '../AnimatedCheckbox';
import Colors from '../../constants/colors';

export default function Step8Consent({ formData, updateFormData, errors, direction }) {
  const openTerms = () => {
    Linking.openURL('https://example.com/terms');
  };

  const openPrivacy = () => {
    Linking.openURL('https://example.com/privacy');
  };

  return (
    <StepContainer
      title="Terms & Consent"
      description="Please review and accept the terms to complete your KYC verification"
      animationDirection={direction}
    >
      <View style={styles.form}>
        <View style={styles.summaryBox}>
          <View style={styles.summaryHeader}>
            <Ionicons name="document-text" size={24} color={Colors.primary} />
            <Text style={styles.summaryTitle}>Application Summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Personal Info</Text>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Government ID</Text>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Address Proof</Text>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Facial Verification</Text>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Bank Details</Text>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Emergency Contact</Text>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
        </View>

        <View style={styles.consentSection}>
          <Text style={styles.consentTitle}>Please accept the following:</Text>

          <AnimatedCheckbox
            label="I confirm that all information provided is accurate and true to the best of my knowledge."
            value={formData.confirmAccuracy}
            onChange={(value) => updateFormData('confirmAccuracy', value)}
            error={errors.confirmAccuracy}
          />

          <AnimatedCheckbox
            label="I agree to the Terms of Service and understand my rights and obligations."
            value={formData.agreeTerms}
            onChange={(value) => updateFormData('agreeTerms', value)}
            error={errors.agreeTerms}
            linkText="Read Terms of Service"
            onLinkPress={openTerms}
          />

          <AnimatedCheckbox
            label="I agree to the Privacy Policy and consent to the collection and processing of my personal data."
            value={formData.agreePrivacy}
            onChange={(value) => updateFormData('agreePrivacy', value)}
            error={errors.agreePrivacy}
            linkText="Read Privacy Policy"
            onLinkPress={openPrivacy}
          />

          <AnimatedCheckbox
            label="I consent to receive communications about my luggage and service updates via email and SMS."
            value={formData.agreeCommunications}
            onChange={(value) => updateFormData('agreeCommunications', value)}
          />
        </View>

        <View style={styles.finalNote}>
          <Ionicons name="shield-checkmark" size={40} color={Colors.success} />
          <Text style={styles.finalNoteTitle}>Almost there!</Text>
          <Text style={styles.finalNoteText}>
            By submitting this form, your KYC verification will begin. You'll receive a confirmation once your documents are verified.
          </Text>
        </View>
      </View>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
  },
  summaryBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  consentSection: {
    marginBottom: 24,
  },
  consentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  finalNote: {
    backgroundColor: Colors.successLight,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  finalNoteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success,
    marginTop: 12,
    marginBottom: 8,
  },
  finalNoteText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

