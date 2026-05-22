// components/steps/Step1PersonalInfo.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import StepContainer from '../StepContainer';
import AnimatedInput from '../AnimatedInput';

export default function Step1PersonalInfo({ formData, updateFormData, errors, direction }) {
  return (
    <StepContainer
      title="Personal Information"
      description="Let's start with your basic details. This helps us verify your identity."
      animationDirection={direction}
    >
      <View style={styles.form}>
        <AnimatedInput
          label="Full Name"
          value={formData.fullName}
          onChangeText={(text) => updateFormData('fullName', text)}
          placeholder="Enter your full name"
          icon="person-outline"
          error={errors.fullName}
          autoCapitalize="words"
        />

        <AnimatedInput
          label="Email Address"
          value={formData.email}
          onChangeText={(text) => updateFormData('email', text)}
          placeholder="Enter your email address"
          icon="mail-outline"
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <AnimatedInput
          label="Phone Number"
          value={formData.phone}
          onChangeText={(text) => updateFormData('phone', text)}
          placeholder="Enter your phone number"
          icon="call-outline"
          error={errors.phone}
          keyboardType="phone-pad"
        />

        <AnimatedInput
          label="Date of Birth"
          value={formData.dateOfBirth}
          onChangeText={(text) => updateFormData('dateOfBirth', text)}
          placeholder="DD/MM/YYYY"
          icon="calendar-outline"
          error={errors.dateOfBirth}
          keyboardType="numbers-and-punctuation"
        />

        <AnimatedInput
          label="Nationality"
          value={formData.nationality}
          onChangeText={(text) => updateFormData('nationality', text)}
          placeholder="Enter your nationality"
          icon="globe-outline"
          error={errors.nationality}
          autoCapitalize="words"
        />
      </View>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
  },
});
