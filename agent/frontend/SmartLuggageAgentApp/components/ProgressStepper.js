// components/ProgressStepper.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

const { width } = Dimensions.get('window');

const STEP_LABELS = [
  'Personal',
  'ID Proof',
  'Address',
  'Selfie',
  'Bank',
  'Vehicle',
  'Emergency',
  'Consent',
];

function StepCircleItem({ index, label, isCompleted, isCurrent }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = useState(false);

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.spring(scaleAnim, {
      toValue: 1.25,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.stepItem}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            styles.stepCircle,
            isCompleted && styles.stepCompleted,
            isCurrent && styles.stepCurrent,
            isPressed && styles.stepHovered,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {isCompleted ? (
            <Ionicons name="checkmark" size={12} color={Colors.textWhite} />
          ) : (
            <Text
              style={[
                styles.stepNumber,
                (isCompleted || isCurrent) && styles.stepNumberActive,
                isPressed && styles.stepNumberHovered,
              ]}
            >
              {index + 1}
            </Text>
          )}
        </Animated.View>
      </TouchableOpacity>
      {(isCurrent || isCompleted) && (
        <Text
          style={[
            styles.stepLabel,
            isCurrent && styles.stepLabelCurrent,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

export default function ProgressStepper({ currentStep, totalSteps = 8 }) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: currentStep,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, totalSteps - 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground} />
        <Animated.View
          style={[
            styles.progressBarFill,
            { width: progressWidth },
          ]}
        />
      </View>

      {/* Step indicators */}
      <View style={styles.stepsContainer}>
        {STEP_LABELS.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <StepCircleItem
              key={index}
              index={index}
              label={label}
              isCompleted={isCompleted}
              isCurrent={isCurrent}
            />
          );
        })}
      </View>

      {/* Current step indicator */}
      <View style={styles.currentStepContainer}>
        <Text style={styles.currentStepText}>
          Step {currentStep + 1} of {totalSteps}
        </Text>
        <Text style={styles.currentStepLabel}>{STEP_LABELS[currentStep]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.borderLight,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  stepCurrent: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepHovered: {
    backgroundColor: Colors.primaryAccent,
    borderColor: Colors.primaryAccent,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  stepNumberActive: {
    color: Colors.textWhite,
  },
  stepNumberHovered: {
    color: Colors.textWhite,
  },
  stepLabel: {
    fontSize: 8,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelCurrent: {
    color: Colors.primary,
    fontWeight: '600',
  },
  currentStepContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  currentStepText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  currentStepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});
