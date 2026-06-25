// components/steps/Step5BankDetails.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StepContainer from '../StepContainer';
import AnimatedInput from '../AnimatedInput';
import Colors from '../../constants/colors';

export default function Step5BankDetails({ formData, updateFormData, errors, direction }) {
  return (
    <StepContainer
      title="Bank Details"
      description="Add your bank account for receiving payments and refunds"
      animationDirection={direction}
    >
      <View style={styles.form}>
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={20} color={Colors.primary} />
          <Text style={styles.securityText}>
            Your banking information is encrypted and secure
          </Text>
        </View>

        <AnimatedInput
          label="Account Holder Name"
          value={formData.accountName}
          onChangeText={(text) => updateFormData('accountName', text)}
          placeholder="Name as it appears on account"
          icon="person-outline"
          error={errors.accountName}
          autoCapitalize="words"
        />

        <AnimatedInput
          label="Bank Name"
          value={formData.bankName}
          onChangeText={(text) => updateFormData('bankName', text)}
          placeholder="Enter your bank name"
          icon="business-outline"
          error={errors.bankName}
          autoCapitalize="words"
        />

        <AnimatedInput
          label="Account Number"
          value={formData.accountNumber}
          onChangeText={(text) => updateFormData('accountNumber', text)}
          placeholder="Enter your account number"
          icon="card-outline"
          error={errors.accountNumber}
          keyboardType="number-pad"
        />

        <AnimatedInput
          label="IFSC / Swift Code"
          value={formData.ifscCode}
          onChangeText={(text) => updateFormData('ifscCode', text)}
          placeholder="Enter IFSC or Swift code"
          icon="code-outline"
          error={errors.ifscCode}
          autoCapitalize="characters"
        />

        <AnimatedInput
          label="Branch Name"
          value={formData.branchName}
          onChangeText={(text) => updateFormData('branchName', text)}
          placeholder="Enter branch name (optional)"
          icon="git-branch-outline"
          autoCapitalize="words"
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Why we need this</Text>
          <Text style={styles.infoText}>
            Your bank details are required for processing refunds and payments for lost or delayed luggage claims.
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
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primaryDark,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

