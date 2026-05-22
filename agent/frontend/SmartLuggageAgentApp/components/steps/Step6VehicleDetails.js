// components/steps/Step6VehicleDetails.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import StepContainer from '../StepContainer';
import AnimatedInput from '../AnimatedInput';
import FileUploadBox from '../FileUploadBox';
import Colors from '../../constants/colors';

export default function Step6VehicleDetails({ formData, updateFormData, errors, direction }) {
  return (
    <StepContainer
      title="Vehicle Details"
      description="Provide your vehicle information for delivery and pickup services"
      animationDirection={direction}
    >
      <View style={styles.form}>
        <View style={styles.optionalNote}>
          <Text style={styles.optionalText}>
            This section is optional but recommended for faster delivery services
          </Text>
        </View>

        <AnimatedInput
          label="Vehicle Type"
          value={formData.vehicleType}
          onChangeText={(text) => updateFormData('vehicleType', text)}
          placeholder="e.g., Car, Motorcycle, Van"
          icon="car-outline"
          autoCapitalize="words"
        />

        <AnimatedInput
          label="Vehicle Make & Model"
          value={formData.vehicleModel}
          onChangeText={(text) => updateFormData('vehicleModel', text)}
          placeholder="e.g., Toyota Camry, Honda Civic"
          icon="speedometer-outline"
          autoCapitalize="words"
        />

        <AnimatedInput
          label="Vehicle Color"
          value={formData.vehicleColor}
          onChangeText={(text) => updateFormData('vehicleColor', text)}
          placeholder="e.g., White, Black, Silver"
          icon="color-palette-outline"
          autoCapitalize="words"
        />

        <AnimatedInput
          label="License Plate Number"
          value={formData.licensePlate}
          onChangeText={(text) => updateFormData('licensePlate', text)}
          placeholder="Enter license plate number"
          icon="document-text-outline"
          autoCapitalize="characters"
        />

        <AnimatedInput
          label="Registration Number"
          value={formData.registrationNumber}
          onChangeText={(text) => updateFormData('registrationNumber', text)}
          placeholder="Vehicle registration number"
          icon="clipboard-outline"
          autoCapitalize="characters"
        />

        <FileUploadBox
          label="Vehicle Registration Document"
          value={formData.vehicleDocument}
          onFileSelect={(file) => updateFormData('vehicleDocument', file)}
          placeholder="Upload RC book or registration certificate"
        />

        <FileUploadBox
          label="Driving License"
          value={formData.drivingLicense}
          onFileSelect={(file) => updateFormData('drivingLicense', file)}
          placeholder="Upload your driving license"
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>🚗 Why provide vehicle details?</Text>
          <Text style={styles.infoText}>
            Vehicle information helps us coordinate luggage delivery and pickup services more efficiently. Our delivery agents can easily identify your vehicle for seamless handover.
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
  optionalNote: {
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  optionalText: {
    fontSize: 13,
    color: Colors.warning,
    fontWeight: '500',
    textAlign: 'center',
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
