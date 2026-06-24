// components/FileUploadBox.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../constants/colors';

export default function FileUploadBox({
  label,
  value,
  onFileSelect,
  error,
  required = false,
  accept = 'image/*',
  placeholder = 'Upload file or take photo',
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [isUploading, setIsUploading] = React.useState(false);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pickImage = async () => {
    handlePress();
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      simulateUpload(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    handlePress();
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      simulateUpload(result.assets[0].uri);
    }
  };

  const pickDocument = async () => {
    handlePress();
    
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
    });

    if (!result.canceled) {
      simulateUpload(result.assets[0].uri, result.assets[0].name);
    }
  };

  const simulateUpload = (uri, name = 'image') => {
    setIsUploading(true);
    progressAnim.setValue(0);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: false,
    }).start(() => {
      setIsUploading(false);
      onFileSelect({ uri, name });
    });
  };

  const removeFile = () => {
    onFileSelect(null);
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

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
          {value.uri && value.uri.match(/\.(jpg|jpeg|png|gif)$/i) ? (
            <Image source={{ uri: value.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.filePreview}>
              <Ionicons name="document-text" size={40} color={Colors.primary} />
              <Text style={styles.fileName} numberOfLines={1}>
                {value.name || 'Document'}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.removeButton} onPress={removeFile}>
            <Ionicons name="close-circle" size={28} color={Colors.error} />
          </TouchableOpacity>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.successText}>Uploaded</Text>
          </View>
        </View>
      ) : (
        <Animated.View
          style={[
            styles.uploadBox,
            { transform: [{ scale: scaleAnim }] },
            error && styles.uploadBoxError,
          ]}
        >
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.uploadingText}>Uploading...</Text>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[styles.progressFill, { width: progressWidth }]}
                />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.uploadIcon}>
                <Ionicons name="cloud-upload-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.uploadText}>{placeholder}</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                  <Ionicons name="image-outline" size={20} color={Colors.primary} />
                  <Text style={styles.buttonText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                  <Text style={styles.buttonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
                  <Ionicons name="document-outline" size={20} color={Colors.primary} />
                  <Text style={styles.buttonText}>File</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
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
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.textSecondary,
  },
  labelError: {
    color: Colors.error,
  },
  required: {
    color: Colors.error,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  uploadBoxError: {
    borderColor: Colors.error,
  },
  uploadIcon: {
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 6,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  uploadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundSecondary,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  filePreview: {
    padding: 30,
    alignItems: 'center',
  },
  fileName: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.background,
    borderRadius: 14,
  },
  successBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  successText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginLeft: 4,
  },
});
