// components/CameraSelfie.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

// Placeholder for Camera until expo-camera is configured correctly for web
export default function CameraSelfie({
  label,
  value,
  onCapture,
  error,
  required = false,
}) {
  const [showCamera, setShowCamera] = useState(false);

  // Mock camera behavior
  const openCamera = () => {
     setShowCamera(true);
  };

  const takePicture = () => {
    // Simulate taking a photo
    setShowCamera(false);
    onCapture({ uri: 'https://via.placeholder.com/300/CCCCCC/FFFFFF?text=Selfie', width: 300, height: 300 }); 
  };
  
  const retake = () => {
    onCapture(null);
  };
  
  if (showCamera) {
      return (
        <View style={styles.cameraContainer}>
            <View style={styles.cameraMock}>
                <Ionicons name="person" size={80} color="#ccc" />
                <Text style={{color:'white', marginTop:20}}>Camera View (Mock)</Text>
                <Text style={{color:'#aaa', fontSize:12}}>Real camera requires expo-camera setup</Text>
            </View>

          {/* Controls */}
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="close" size={24} color={Colors.textWhite} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      );
  }

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, error && styles.labelError]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      {value ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: value.uri }} style={styles.previewImage} />
          <TouchableOpacity style={styles.retakeButton} onPress={retake}>
            <Ionicons name="refresh" size={20} color={Colors.textWhite} />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.successText}>Verified</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
            style={[styles.uploadBox, error && styles.uploadBoxError]}
            onPress={openCamera}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              <View style={styles.faceIconCircle}>
                <Ionicons name="person" size={40} color={Colors.primary} />
              </View>
              <View style={styles.cameraIconBadge}>
                <Ionicons name="camera" size={16} color={Colors.textWhite} />
              </View>
            </View>
            <Text style={styles.uploadText}>Take a Selfie</Text>
            <Text style={styles.uploadSubtext}>
              Tap to verify identity
            </Text>
        </TouchableOpacity>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={14} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.textSecondary },
  labelError: { color: Colors.error },
  required: { color: Colors.error },
  uploadBox: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: 16,
    padding: 24, alignItems: 'center', backgroundColor: Colors.backgroundSecondary,
  },
  uploadBoxError: { borderColor: Colors.error },
  iconContainer: { marginBottom: 16, position: 'relative' },
  faceIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  cameraIconBadge: {
    position: 'absolute', bottom: -4, right: -4, backgroundColor: Colors.secondary,
    width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  uploadText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  uploadSubtext: { fontSize: 12, color: Colors.textSecondary },
  previewContainer: {
    height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000',
    position: 'relative',
  },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  retakeButton: {
    position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6,
  },
  retakeText: { color: Colors.textWhite, fontSize: 13, fontWeight: '600' },
  successBadge: {
    position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6,
  },
  successText: { color: Colors.success, fontSize: 12, fontWeight: '700' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  errorText: { color: Colors.error, fontSize: 12 },
  
  cameraContainer: {
    height: 400, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center'
  },
  cameraMock: {
    flex: 1, justifyContent: 'center', alignItems: 'center'
  },
  cameraControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingBottom: 20,
  },
  captureButton: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  captureButtonInner: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.textWhite,
  },
  cancelButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
});

