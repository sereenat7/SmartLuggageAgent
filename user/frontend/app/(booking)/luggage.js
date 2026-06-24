import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Image, SafeAreaView, Platform, StatusBar, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createDropLocation } from '../../utils/airportMappings';

export default function LuggageDetails() {
  const router = useRouter();
  const flightParams = useLocalSearchParams();
  
  const [bagCount, setBagCount] = useState(1);
  const [selectedWeight, setSelectedWeight] = useState('10-20 kg');
  const [photos, setPhotos] = useState([]);
  const [checkinSelected, setCheckinSelected] = useState(false); 
  const [fragile, setFragile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // UPDATED LOGIC: Supports Multiple Gallery Selection & Continuous Camera
  const pickImage = async (useCamera = true, indexToReplace = null) => {
    let status;
    if (useCamera) {
      const cameraResp = await ImagePicker.requestCameraPermissionsAsync();
      status = cameraResp.status;
    } else {
      const libraryResp = await ImagePicker.requestMediaLibraryPermissionsAsync();
      status = libraryResp.status;
    }

    if (status !== 'granted') {
      Alert.alert('Permission Denied', `We need ${useCamera ? 'camera' : 'gallery'} permissions.`);
      return;
    }

    if (useCamera) {
      // Camera Loop: Allows clicking as many as you want until "Cancel"
      let result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
      
      if (!result.canceled) {
        const newUri = result.assets[0].uri;
        if (indexToReplace !== null) {
          const updatedPhotos = [...photos];
          updatedPhotos[indexToReplace] = newUri;
          setPhotos(updatedPhotos);
        } else {
          setPhotos(prev => [...prev, newUri]);
          // Recursively call again to allow "as many times as I want"
          Alert.alert("Photo Added", "Would you like to take another?", [
            { text: "No, I'm Done", style: "cancel" },
            { text: "Take Another", onPress: () => pickImage(true) }
          ]);
        }
      }
    } else {
      // Gallery: Allows Multiple Selection
      let result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        selectionLimit: 10, 
        quality: 0.8,
      });

      if (!result.canceled) {
        const selectedUris = result.assets.map(asset => asset.uri);
        if (indexToReplace !== null) {
          const updatedPhotos = [...photos];
          updatedPhotos[indexToReplace] = selectedUris[0];
          setPhotos(updatedPhotos);
        } else {
          setPhotos(prev => [...prev, ...selectedUris]);
        }
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerAction}>
          <Ionicons name="arrow-back" size={24} color="#1A1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Luggage Details</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Stepper */}
        <View style={styles.stepperRow}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepCompleted]}>
              <Ionicons name="checkmark" size={16} color="#FFF" />
            </View>
            <Text style={styles.stepLabelActive}>Flight Info</Text>
          </View>
          <View style={[styles.stepLine, { backgroundColor: '#10B981' }]} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepCurrent]}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.stepLabelActive}>Luggage</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumGray}>3</Text>
            </View>
            <Text style={styles.stepLabel}>Pickup</Text>
          </View>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <View style={styles.orangeIconCircle}><Ionicons name="cube" size={20} color="#FFF" /></View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Luggage Details</Text>
            <Text style={styles.infoSub}>Tell us about your baggage for a smooth pickup</Text>
          </View>
        </View>

        {/* Bag Counter */}
        <View style={styles.sectionCard}>
          <Text style={styles.innerLabel}>How many bags?</Text>
          <View style={styles.counterMainRow}>
            <TouchableOpacity onPress={() => setBagCount(Math.max(1, bagCount - 1))} style={styles.counterSquareBtn}>
              <Ionicons name="remove" size={24} color="#1A1C1E" />
            </TouchableOpacity>
            <View style={styles.counterDisplay}>
              <Text style={styles.counterBigNum}>{bagCount}</Text>
              <Text style={styles.counterSubText}>bag</Text>
            </View>
            <TouchableOpacity onPress={() => setBagCount(bagCount + 1)} style={styles.counterSquareBtnAdd}>
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Luggage Type Card */}
        <Text style={styles.sectionLabel}>Luggage Type</Text>
        <TouchableOpacity 
          style={[styles.gridItem, checkinSelected && styles.gridItemActive]}
          onPress={() => {
            if (checkinSelected) {
              setCheckinSelected(false);
              setFragile(false); 
            } else {
              setCheckinSelected(true);
              setFragile(false); 
            }
          }}
        >
          <Text style={{fontSize: 24, marginBottom: 8}}>🧳</Text>
          <Text style={[styles.gridLabel, checkinSelected && styles.gridLabelActive]}>Check-in</Text>
          <Text style={styles.gridSub}>Up to 25kg</Text>
        </TouchableOpacity>

        {checkinSelected && (
          <TouchableOpacity style={styles.fragileRow} onPress={() => setFragile(!fragile)}>
            <View style={[styles.checkbox, fragile && styles.checkboxActive]}>
              {fragile && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </View>
            <Text style={styles.fragileText}>Contains fragile items</Text>
          </TouchableOpacity>
        )}

        <View style={styles.disclaimerCard}>
          <Ionicons name="alert-circle" size={16} color="#B91C1C" />
          <Text style={styles.disclaimerText}> Ensure your ticket allows check-in luggage.</Text>
        </View>

        {/* Weight Selection */}
        <Text style={styles.sectionLabel}>Total Weight (approx.)</Text>
        <View style={styles.weightGrid}>
          {['Under 10 kg', '10-20 kg', '20-30 kg', 'Over 30 kg'].map((weight) => (
            <TouchableOpacity 
              key={weight}
              onPress={() => setSelectedWeight(weight)}
              style={[styles.weightBtn, selectedWeight === weight && styles.weightBtnActive]}
            >
              <Text style={[styles.weightText, selectedWeight === weight && styles.weightTextActive]}>{weight}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Photo Proof */}
        <Text style={styles.sectionLabel}>Photo Proof (Optional)</Text>
        <View style={styles.sectionCard}>
          {photos.length === 0 ? (
            <View style={styles.uploadBox}>
              <Ionicons name="camera-outline" size={32} color="#D1D5DB" />
              <Text style={styles.uploadText}>Add Bag Photos</Text>
              <Text style={styles.uploadSubText}>Keep the full bag in view</Text>
              
              <View style={styles.uploadActionRow}>
                <TouchableOpacity style={styles.miniUploadBtn} onPress={() => pickImage(true)}>
                  <Ionicons name="camera" size={18} color="#FF5F5F" />
                  <Text style={styles.miniBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.miniUploadBtn} onPress={() => pickImage(false)}>
                  <Ionicons name="images" size={18} color="#FF5F5F" />
                  <Text style={styles.miniBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.previewImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.retakeOverlay} onPress={() => pickImage(true, index)}>
                    <Ionicons name="refresh" size={14} color="#FFF" />
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => setPhotos(photos.filter((_, i) => i !== index))}>
                    <Ionicons name="close-circle" size={20} color="#FF3B2F" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addMoreBtn} onPress={() => pickImage(true)}>
                <Ionicons name="add" size={30} color="#D1D5DB" />
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* Continue Button */}
        <TouchableOpacity 
          style={styles.nextBtn} 
          disabled={isLoading}
          onPress={async () => {
            setIsLoading(true);
            try {
              const dropLocation = await createDropLocation(flightParams.depAirport, flightParams.terminal);
              router.push({
                pathname: '/(booking)/pickup', 
                params: {
                  ...flightParams, 
                  bags: bagCount,
                  weight: selectedWeight,
                  fragile: fragile,
                  checkin: checkinSelected,
                  dropLocation: dropLocation.address,
                  dropLatitude: dropLocation.latitude.toString(),
                  dropLongitude: dropLocation.longitude.toString(),
                  photos: JSON.stringify(photos) 
                }
              });
            } catch (error) {
              console.error('Error fetching drop location:', error);
              Alert.alert('Error', 'Failed to fetch drop location. Please try again.');
            } finally {
              setIsLoading(false);
            }
          }}
        >
          <LinearGradient 
            colors={['#FF5F5F', '#FF8C00']} 
            start={{x:0, y:0}} 
            end={{x:1, y:0}} 
            style={styles.gradient}
          >
            <Text style={styles.nextBtnText}>{isLoading ? 'Fetching location...' : 'Continue to Pickup Details'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10, paddingBottom: 15, alignItems: 'center' },
  headerAction: { width: 40 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1C1E' },
  scrollContent: { paddingHorizontal: 20 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  stepCompleted: { backgroundColor: '#10B981' },
  stepCurrent: { backgroundColor: '#FF3B2F' },
  stepNum: { color: '#FFF', fontWeight: 'bold' },
  stepNumGray: { color: '#9CA3AF', fontWeight: 'bold' },
  stepLabelActive: { fontSize: 11, color: '#1A1C1E', marginTop: 4, fontWeight: '700' },
  stepLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  stepLine: { width: 50, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 10, marginTop: -15 },
  infoBanner: { backgroundColor: '#FFF5F0', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#FFE4D6' },
  orangeIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF8C00', justifyContent: 'center', alignItems: 'center' },
  infoTextContainer: { marginLeft: 12, flex: 1 },
  infoTitle: { fontWeight: '800', fontSize: 16, color: '#1A1C1E' },
  infoSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12, color: '#1A1C1E', marginTop: 10 },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 15, elevation: 3 },
  innerLabel: { fontSize: 15, fontWeight: '700', color: '#1A1C1E', marginBottom: 15 },
  counterMainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', borderRadius: 16, padding: 8 },
  counterSquareBtn: { width: 48, height: 48, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  counterSquareBtnAdd: { width: 48, height: 48, backgroundColor: '#FF5F5F', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  counterDisplay: { alignItems: 'center' },
  counterBigNum: { fontSize: 24, fontWeight: '800', color: '#1A1C1E' },
  counterSubText: { fontSize: 12, color: '#9CA3AF', marginTop: -4 },
  gridItem: { width: '48%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2 },
  gridItemActive: { borderColor: '#FF3B2F', backgroundColor: '#FFF9F9' },
  gridLabel: { fontSize: 14, fontWeight: '700', color: '#4B5563' },
  gridLabelActive: { color: '#FF3B2F' },
  gridSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  fragileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 10 },
  fragileText: { marginLeft: 8, fontSize: 13, fontWeight: '600', color: '#1A1C1E' },
  checkbox: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#FF3B2F', borderColor: '#FF3B2F' },
  disclaimerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3F2', borderRadius: 12, padding: 10, marginBottom: 20, borderWidth: 1, borderColor: '#FECACA' },
  disclaimerText: { fontSize: 13, color: '#B91C1C', marginLeft: 5 },
  weightGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  weightBtn: { width: '48%', height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginBottom: 10, backgroundColor: '#FFF' },
  weightBtnActive: { borderColor: '#FF3B2F', backgroundColor: '#FFF9F9' },
  weightText: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  weightTextActive: { color: '#FF3B2F' },
  uploadBox: { padding: 20, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 16, alignItems: 'center' },
  uploadText: { marginTop: 8, fontSize: 14, fontWeight: '700', color: '#4B5563' },
  uploadSubText: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  uploadActionRow: { flexDirection: 'row', marginTop: 15, width: '100%', justifyContent: 'space-evenly' },
  miniUploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FFECEC' },
  miniBtnText: { marginLeft: 6, fontSize: 12, fontWeight: '700', color: '#FF5F5F' },
  gallery: { marginTop: 5 },
  photoContainer: { marginRight: 15, position: 'relative', paddingVertical: 10 },
  previewImg: { width: 120, height: 120, borderRadius: 12 },
  deleteBtn: { position: 'absolute', top: 0, right: -5, backgroundColor: '#FFF', borderRadius: 10 },
  retakeOverlay: { position: 'absolute', bottom: 10, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingVertical: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  retakeText: { color: '#FFF', fontSize: 11, fontWeight: '700', marginLeft: 5 },
  addMoreBtn: { width: 120, height: 120, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  nextBtn: { marginTop: 10 },
  gradient: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});