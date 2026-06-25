// components/steps/Step3AddressProof.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import StepContainer from '../StepContainer';
import AnimatedInput from '../AnimatedInput';
import FileUploadBox from '../FileUploadBox';
import CheckboxField from '../CheckboxField';
import Colors from '../../constants/colors';

export default function Step3AddressProof({ formData, updateFormData, errors, direction }) {
  const [loadingLocation, setLoadingLocation] = useState(false);

  const handleUseCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to auto-fill your address.');
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Location Disabled', 'Please enable location services and try again.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const results = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (results && results.length > 0) {
        const addr = results[0];
        const streetParts = [addr.streetNumber, addr.street].filter(Boolean);
        updateFormData('streetAddress', streetParts.join(' ') || addr.name || '');
        updateFormData('city', addr.city || addr.subregion || '');
        updateFormData('state', addr.region || '');
        updateFormData('postalCode', addr.postalCode || '');
        updateFormData('country', addr.country || '');
      } else {
        Alert.alert('Not Found', 'Could not determine address from your location.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not fetch location. Please fill in manually.');
    } finally {
      setLoadingLocation(false);
    }
  };

  return (
    <StepContainer
      title="Address Verification"
      description="Provide your current residential address and proof of address"
      animationDirection={direction}
    >
      <View style={styles.form}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleUseCurrentLocation}
          disabled={loadingLocation}
        >
          {loadingLocation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="location" size={20} color="#fff" />
              <Text style={styles.locationButtonText}>Auto-fill from Current Location</Text>
            </>
          )}
        </TouchableOpacity>

        <AnimatedInput
          label="Street Address"
          value={formData.streetAddress}
          onChangeText={(text) => updateFormData('streetAddress', text)}
          placeholder="e.g. 42 MG Road, Apt 3B"
          icon="location-outline"
          error={errors.streetAddress}
          multiline
          numberOfLines={2}
        />

        <AnimatedInput
          label="City"
          value={formData.city}
          onChangeText={(text) => updateFormData('city', text)}
          placeholder="Enter your city"
          icon="business-outline"
          error={errors.city}
          autoCapitalize="words"
        />

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <AnimatedInput
              label="State / Province"
              value={formData.state}
              onChangeText={(text) => updateFormData('state', text)}
              placeholder="State"
              error={errors.state}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.halfWidth}>
            <AnimatedInput
              label="Postal Code"
              value={formData.postalCode}
              onChangeText={(text) => updateFormData('postalCode', text)}
              placeholder="Postal code"
              error={errors.postalCode}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <AnimatedInput
          label="Country"
          value={formData.country}
          onChangeText={(text) => updateFormData('country', text)}
          placeholder="Enter your country"
          icon="earth-outline"
          error={errors.country}
          autoCapitalize="words"
        />

        <View style={styles.separator} />

        <CheckboxField
          label="Permanent address is different from current address"
          value={formData.isPermAddressDifferent}
          onValueChange={(val) => updateFormData('isPermAddressDifferent', val)}
        />

        {formData.isPermAddressDifferent && (
          <View style={styles.permAddressContainer}>
            <Text style={styles.permAddressTitle}>Permanent Address</Text>

            <AnimatedInput
              label="Street Address"
              value={formData.permStreetAddress}
              onChangeText={(text) => updateFormData('permStreetAddress', text)}
              placeholder="Enter permanent street address"
              icon="location-outline"
              multiline
              numberOfLines={2}
            />
            <AnimatedInput
              label="City"
              value={formData.permCity}
              onChangeText={(text) => updateFormData('permCity', text)}
              placeholder="Enter permanent city"
              icon="business-outline"
              autoCapitalize="words"
            />
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <AnimatedInput
                  label="State / Province"
                  value={formData.permState}
                  onChangeText={(text) => updateFormData('permState', text)}
                  placeholder="State"
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.halfWidth}>
                <AnimatedInput
                  label="Postal Code"
                  value={formData.permPostalCode}
                  onChangeText={(text) => updateFormData('permPostalCode', text)}
                  placeholder="Postal code"
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <AnimatedInput
              label="Country"
              value={formData.permCountry}
              onChangeText={(text) => updateFormData('permCountry', text)}
              placeholder="Enter permanent country"
              icon="earth-outline"
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📄 Accepted Documents</Text>
          <Text style={styles.infoText}>• Utility bill (electricity, water, gas)</Text>
          <Text style={styles.infoText}>• Bank statement</Text>
          <Text style={styles.infoText}>• Government letter</Text>
          <Text style={styles.infoText}>• Rental agreement</Text>
          <Text style={styles.infoNote}>Document must be dated within the last 3 months</Text>
        </View>

        <FileUploadBox
          label="Proof of Address Document"
          value={formData.addressProof}
          onFileSelect={(file) => updateFormData('addressProof', file)}
          error={errors.addressProof}
          placeholder="Upload your proof of address"
        />
      </View>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  form: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  halfWidth: { flex: 1 },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.buttonPrimary,
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  locationButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 12,
  },
  permAddressContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  permAddressTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
    color: Colors.textPrimary,
  },
  infoBox: {
    backgroundColor: 'rgba(255,75,51,0.06)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    marginTop: 8,
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
  infoNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 4,
  },
});

