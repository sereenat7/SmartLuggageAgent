// components/steps/Step7EmergencyContact.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StepContainer from '../StepContainer';
import AnimatedInput from '../AnimatedInput';
import Colors from '../../constants/colors';

export default function Step7EmergencyContact({ formData, updateFormData, errors, direction }) {
  return (
    <StepContainer
      title="Emergency Contact"
      description="Provide an emergency contact person we can reach if needed"
      animationDirection={direction}
    >
      <View style={styles.form}>
        <View style={styles.importantNote}>
          <Ionicons name="warning" size={20} color={Colors.warning} />
          <Text style={styles.importantText}>
            This contact will only be used in case of emergencies
          </Text>
        </View>

        <AnimatedInput
          label="Contact Name"
          value={formData.emergencyName}
          onChangeText={(text) => updateFormData('emergencyName', text)}
          placeholder="Full name of emergency contact"
          icon="person-outline"
          error={errors.emergencyName}
          autoCapitalize="words"
        />

        <AnimatedInput
          label="Relationship"
          value={formData.emergencyRelation}
          onChangeText={(text) => updateFormData('emergencyRelation', text)}
          placeholder="e.g., Spouse, Parent, Sibling"
          icon="people-outline"
          error={errors.emergencyRelation}
          autoCapitalize="words"
        />

        <AnimatedInput
          label="Phone Number"
          value={formData.emergencyPhone}
          onChangeText={(text) => updateFormData('emergencyPhone', text)}
          placeholder="Emergency contact phone number"
          icon="call-outline"
          error={errors.emergencyPhone}
          keyboardType="phone-pad"
        />

        <AnimatedInput
          label="Alternate Phone"
          value={formData.emergencyAltPhone}
          onChangeText={(text) => updateFormData('emergencyAltPhone', text)}
          placeholder="Alternate phone number (optional)"
          icon="call-outline"
          keyboardType="phone-pad"
        />

        <AnimatedInput
          label="Email Address"
          value={formData.emergencyEmail}
          onChangeText={(text) => updateFormData('emergencyEmail', text)}
          placeholder="Emergency contact email (optional)"
          icon="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <AnimatedInput
          label="Address"
          value={formData.emergencyAddress}
          onChangeText={(text) => updateFormData('emergencyAddress', text)}
          placeholder="Emergency contact address (optional)"
          icon="location-outline"
          multiline
          numberOfLines={2}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📞 When will we contact them?</Text>
          <Text style={styles.infoText}>• In case of lost luggage that cannot be delivered</Text>
          <Text style={styles.infoText}>• Medical emergencies during travel</Text>
          <Text style={styles.infoText}>• Verification purposes if we can't reach you</Text>
        </View>
      </View>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
  },
  importantNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  importantText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning,
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
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
    paddingLeft: 4,
  },
});

