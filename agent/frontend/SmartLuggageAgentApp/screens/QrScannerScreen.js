import React, { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { USER_API_URL } from '../config';

export default function QrScannerScreen({ navigation, route }) {
  const bookingId = route?.params?.bookingId;
  const qrType = route?.params?.qrType || 'pickup';
  const title = route?.params?.bookingTitle || (qrType === 'destination' ? 'Scan Destination QR' : 'Scan Pickup QR');
  const agentId = route?.params?.agentId ?? 0;
  const agentName = route?.params?.agentName || 'Agent';
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBarcodeScanned = async ({ data }) => {
    if (isProcessing || !data) return;
    setIsProcessing(true);
    
    try {
      // Verify QR with user booking backend
      const API_URL = `${USER_API_URL}/api/bookings`;
      
      console.log('🔍 QR SCAN INITIATED');
      console.log('   Booking ID:', bookingId);
      console.log('   QR Type:', qrType);
      console.log('   Backend URL:', API_URL);
      console.log('   Scanned Data Length:', data.length);
      console.log('   Data Preview:', data.substring(0, 80));
      
      const response = await fetch(`${API_URL}/verify-qr/${bookingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrType,
          qrValue: data,
        }),
      });

      console.log('   API Response Status:', response.status);
      
      const result = await response.json();

      console.log('🔍 QR VERIFICATION RESPONSE');
      console.log('   Success:', result.success);
      console.log('   Response Keys:', Object.keys(result));
      console.log('   Verification Status:', result.verificationStatus);
      console.log('   Full Response:', JSON.stringify(result, null, 2));

      if (result.success) {
        navigation.replace('QrVerification', {
          verificationStatus: result.verificationStatus,
          booking: result.booking,
          bookingId,
          qrType,
          agentId,
          agentName,
          task: route?.params?.task,
        });
      } else {
        const fallbackMessage = result.message || 'Unable to verify this QR code';
        navigation.replace('QrVerification', {
          verificationStatus: result.verificationStatus || {
            status: 'invalid',
            reason: result.message || 'Verification failed',
            message: fallbackMessage,
          },
          booking: result.booking || null,
          bookingId,
          qrType,
          agentId,
          agentName,
          task: route?.params?.task,
        });
      }
    } catch (error) {
      console.error('❌ QR SCAN ERROR');
      console.error('   Error Type:', error.name);
      console.error('   Error Message:', error.message);
      console.error('   Full Error:', error);
      navigation.replace('QrVerification', {
        verificationStatus: {
          status: 'error',
          reason: 'Network error',
          message: error.message || 'Failed to verify QR code',
        },
        booking: null,
        bookingId,
        qrType,
        task: route?.params?.task,
      });
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.centerText}>Requesting camera access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <Ionicons name="camera-outline" size={42} color={Colors.primary} />
          <Text style={styles.title}>Camera permission required</Text>
          <Text style={styles.centerText}>Allow camera access to scan the luggage QR code.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.cameraFrame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={styles.overlay}>
          <View style={styles.targetBox} />
          <Text style={styles.guidance}>
            {qrType === 'destination'
              ? 'Scan the destination QR after the agent arrives.'
              : 'Scan the pickup QR to confirm handover.'}
          </Text>
          {isProcessing ? <Text style={styles.processingText}>Verifying QR...</Text> : null}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827', flex: 1, textAlign: 'center' },
  spacer: { width: 40 },
  cameraFrame: { flex: 1, backgroundColor: '#000' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  targetBox: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginBottom: 28,
  },
  guidance: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 },
  processingText: { color: '#E2E8F0', fontSize: 12, marginTop: 10 },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  centerState: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 14, marginBottom: 8, textAlign: 'center' },
  centerText: { color: '#6B7280', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 18,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#111827', fontWeight: '700', fontSize: 14 },
});