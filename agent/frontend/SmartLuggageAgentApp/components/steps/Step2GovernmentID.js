// components/steps/Step2GovernmentID.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import StepContainer from '../StepContainer';
import AnimatedInput from '../AnimatedInput';
import FileUploadBox from '../FileUploadBox';
import Colors from '../../constants/colors';

export default function Step2GovernmentID({ formData, updateFormData, errors, direction }) {
  return (
    <StepContainer
      title="Government ID"
      description="Upload a valid government-issued ID (Passport, Driving License, or National ID)"
      animationDirection={direction}
    >
      <View style={styles.form}>
        <AnimatedInput
          label="ID Type"
          value={formData.idType}
          onChangeText={(text) => updateFormData('idType', text)}
          placeholder="e.g., Passport, Driving License"
          icon="card-outline"
          error={errors.idType}
        />

        <AnimatedInput
          label="ID Number"
          value={formData.idNumber}
          onChangeText={(text) => updateFormData('idNumber', text)}
          placeholder="Enter your ID number"
          icon="finger-print-outline"
          error={errors.idNumber}
          autoCapitalize="characters"
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📋 Document Requirements</Text>
          <Text style={styles.infoText}>• Document must be valid and not expired</Text>
          <Text style={styles.infoText}>• All four corners must be visible</Text>
          <Text style={styles.infoText}>• Text must be clearly readable</Text>
          <Text style={styles.infoText}>• No glare or shadows</Text>
        </View>

        <FileUploadBox
          label="Front of ID"
          value={formData.idFront}
          onFileSelect={(file) => updateFormData('idFront', file)}
          error={errors.idFront}
          placeholder="Upload front side of your ID"
        />

        <FileUploadBox
          label="Back of ID"
          value={formData.idBack}
          onFileSelect={(file) => updateFormData('idBack', file)}
          error={errors.idBack}
          placeholder="Upload back side of your ID (if applicable)"
        />
      </View>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textPrimary,
    marginBottom: 4,
    paddingLeft: 4,
  },
});

