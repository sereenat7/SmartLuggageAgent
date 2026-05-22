import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scaleAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleViewReceipt = () => {
    router.push({
      pathname: '/(booking)/receipt',
      params: {
        bookingId: params.bookingId,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.content}>
        {/* Animated Checkmark */}
        <Animated.View style={[styles.checkmarkContainer, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={['#34C759', '#30B0C0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.checkmarkCircle}
          >
            <Feather name="check" size={80} color="#FFF" strokeWidth={3} />
          </LinearGradient>
        </Animated.View>

        {/* Success Text */}
        <Text style={styles.successTitle}>Booking Confirmed!</Text>
        <Text style={styles.successSubtitle}>Your luggage booking has been successfully confirmed</Text>

        {/* Booking ID */}
        <View style={styles.bookingIdBox}>
          <Text style={styles.bookingIdLabel}>Booking ID</Text>
          <Text style={styles.bookingIdValue}>{params.bookingId}</Text>
        </View>

        {/* View Receipt Button */}
        <TouchableOpacity 
          style={styles.viewReceiptButton}
          onPress={handleViewReceipt}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>View Receipt</Text>
            <Feather name="arrow-right" size={20} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Continue to Home */}
        <TouchableOpacity 
          style={styles.continueButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.continueText}>Continue to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  checkmarkContainer: {
    marginBottom: 40,
  },
  checkmarkCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#34C759',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1C1E',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  bookingIdBox: {
    backgroundColor: '#F5F5F7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    alignItems: 'center',
    width: '100%',
  },
  bookingIdLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingIdValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1C1E',
    letterSpacing: 0.5,
  },
  viewReceiptButton: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  continueButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueText: {
    color: '#C7C7CC',
    fontSize: 14,
    fontWeight: '700',
  },
};
