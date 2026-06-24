import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  TextInput, SafeAreaView, Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function PickupDetails() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  
  const [pincode, setPincode] = useState('');
  const [pickupAddress, setPickupAddress] = useState(''); 
  const [pickupTime, setPickupTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);

  // Robust AM/PM Formatter
  const formatTimeToAMPM = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  };

  const getTravelTimeMinutes = (address) => {
    if (!address) return 60;
    const addr = address.toLowerCase();
    if (addr.includes('virar')) return 120; 
    if (addr.includes('bandra')) return 45;
    if (addr.includes('andheri')) return 20;
    return 60;
  };

  // ✅ FETCH AND SAVE COORDINATES WHEN PICKUP ADDRESS CHANGES
  const fetchAndSavePickupCoordinates = useCallback(async (address) => {
    if (!address) return;

    try {
      const GEO_API_KEY = "6a6f5450f3164727b88686b4a5a0fffd";
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${GEO_API_KEY}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        let latitude = null;
        let longitude = null;

        if (feature.geometry && feature.geometry.coordinates) {
          // Geoapify returns [lon, lat]
          [longitude, latitude] = feature.geometry.coordinates;
        } else if (feature.properties) {
          latitude = feature.properties.lat;
          longitude = feature.properties.lon;
        }

        if (latitude && longitude) {
          // Save to AsyncStorage
          await AsyncStorage.setItem(
            "pickupLocationDetails",
            JSON.stringify({
              address: address,
              latitude: latitude,
              longitude: longitude,
              userSelected: true
            })
          );
        }
      }
    } catch (error) {
      console.error("Error fetching pickup coordinates:", error);
    }
  }, []);

  // ✅ FORCED 24H CALCULATION LOGIC
  const updateDynamicPickupTime = useCallback(() => {
    if (!params.depTime || !pickupAddress) return;

    setIsCalculating(true);
    try {
      // 1. Parse "6:05 PM" manually
      const timeMatch = params.depTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!timeMatch) return;

      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3].toUpperCase();

      // Convert to 24-hour clock for math
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      // 2. Create Date Object (Anchor to today)
      const calculationDate = new Date();
      calculationDate.setHours(hours, minutes, 0, 0);

      // 3. Subtract Logic (Domestic 2h, Intl 3h) + Travel + 30m Buffer
      const isIntl = params.isInternational === 'true';
      const airportLeadTime = isIntl ? 180 : 120; 
      const travelTime = getTravelTimeMinutes(pickupAddress);
      const buffer = 30;

      const totalMinutesBack = airportLeadTime + travelTime + buffer;
      
      // Apply the subtraction
      const finalPickupDate = new Date(calculationDate.getTime() - (totalMinutesBack * 60000));
      
      setPickupTime(finalPickupDate);
    } catch (e) {
      console.error("Calculation Error:", e);
    } finally {
      setTimeout(() => setIsCalculating(false), 300);
    }
  }, [params.depTime, params.isInternational, pickupAddress]);

  useEffect(() => {
    updateDynamicPickupTime();
    fetchAndSavePickupCoordinates(pickupAddress);
  }, [pickupAddress, params.isInternational, updateDynamicPickupTime, fetchAndSavePickupCoordinates]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadData = async () => {
        try {
          const storedLoc = await AsyncStorage.getItem("homepageLocation");
          if (storedLoc && isActive) setPickupAddress(storedLoc);
          
          const savedDetails = await AsyncStorage.getItem("pickupDetails");
          if (savedDetails && isActive) {
            const data = JSON.parse(savedDetails);
            if (data.address) setPickupAddress(data.address);
          }
        } catch (e) { console.log(e); }
      };
      loadData();
      return () => { isActive = false };
    }, [])
  );

  const handleConfirm = async () => {
    try {
      // Get pickup location coordinates from AsyncStorage
      const pickupDetails = await AsyncStorage.getItem('pickupLocationDetails');
      const pickupData = pickupDetails ? JSON.parse(pickupDetails) : {};

      router.push({
        pathname: '/(booking)/confirm',
        params: { 
          ...params,
          pincode,
          pickupAddress,
          pickupTime: formatTimeToAMPM(pickupTime), 
          additionalInfo,
          // Pass coordinates through params
          pickupLatitude: pickupData.latitude ? String(pickupData.latitude) : "",
          pickupLongitude: pickupData.longitude ? String(pickupData.longitude) : "",
        }
      });
    } catch (error) {
      console.error("Error in handleConfirm:", error);
      router.push({
        pathname: '/(booking)/confirm',
        params: { 
          ...params,
          pincode,
          pickupAddress,
          pickupTime: formatTimeToAMPM(pickupTime), 
          additionalInfo,
        }
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerAction}>
          <Ionicons name="arrow-back" size={24} color="#1A1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Pickup</Text>
        <View style={styles.headerAction} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

        {/* Progress Bar */}
        <View style={styles.stepperRow}>
          <View style={styles.stepItem}><View style={[styles.stepCircle, styles.stepCompleted]}><Ionicons name="checkmark" size={16} color="#FFF" /></View><Text style={styles.stepLabelActive}>Flight</Text></View>
          <View style={[styles.stepLine, { backgroundColor: '#10B981' }]} />
          <View style={styles.stepItem}><View style={[styles.stepCircle, styles.stepCompleted]}><Ionicons name="checkmark" size={16} color="#FFF" /></View><Text style={styles.stepLabelActive}>Luggage</Text></View>
          <View style={[styles.stepLine, { backgroundColor: '#FF3B2F' }]} />
          {/* FIXED LINE 140 BELOW */}
          <View style={styles.stepItem}><View style={[styles.stepCircle, styles.stepCurrent]}><Text style={styles.stepNum}>3</Text></View><Text style={styles.stepLabelActive}>Pickup</Text></View>
        </View>

        <View style={styles.infoBanner}>
          <View style={styles.greenIconCircle}><Ionicons name="flash" size={20} color="#FFF" /></View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Pickup Details</Text>
            <Text style={styles.infoSub}>Almost there! Enter your pickup details below.</Text>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Pickup Address</Text>
          <TouchableOpacity
            style={styles.inputWrapper}
            onPress={() => router.push({
              pathname: "/(booking)/search_pickup",
              params: { address: pickupAddress, sourceScreen: "pickup", ...params },
            })}
          >
            <Ionicons name="location-sharp" size={20} color="#10B981" style={{ marginRight: 10 }} />
            <Text style={{ flex: 1, color: "#1A1C1E" }} numberOfLines={2}>
              {pickupAddress || "Choose on map"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Pincode */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Area Pincode</Text>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.singleInput} placeholder="6-digit pincode" keyboardType="number-pad" value={pincode} onChangeText={setPincode} />
          </View>
        </View>

        {/* Time Display */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Pickup Time</Text>
          <TouchableOpacity style={styles.timeSlotBtn} onPress={() => setShowTimePicker(true)}>
            <Ionicons name="time-outline" size={20} color="#FF3B2F" />
            <Text style={styles.timeSlotText}>
              {isCalculating ? "Syncing..." : formatTimeToAMPM(pickupTime)}
            </Text>
            {isCalculating && <ActivityIndicator size="small" color="#FF3B2F" style={{marginLeft: 10}} />}
          </TouchableOpacity>

          <Text style={styles.helperText}>
            We recommend this pickup time to help you reach the airport comfortably.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Additional Information</Text>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.singleInput} placeholder="Flat no, landmark, etc." value={additionalInfo} onChangeText={setAdditionalInfo} />
          </View>
        </View>

        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <LinearGradient colors={['#FF5F5F', '#FF8C00']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.gradient}>
            <Text style={styles.confirmBtnText}>Confirm Booking</Text>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{marginLeft: 8}} />
          </LinearGradient>
        </TouchableOpacity>

      </KeyboardAwareScrollView>

      {showTimePicker && (
        <DateTimePicker
          value={pickupTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedTime) => {
            if (selectedTime) setPickupTime(selectedTime);
            if (Platform.OS === 'android') setShowTimePicker(false);
          }}
          is24Hour={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10, paddingBottom: 15, alignItems: 'center' },
  headerAction: { width: 40 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1C1E' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  stepCompleted: { backgroundColor: '#10B981' },
  stepCurrent: { backgroundColor: '#FF3B2F' },
  stepNum: { color: '#FFF', fontWeight: 'bold' },
  stepLabelActive: { fontSize: 11, color: '#1A1C1E', marginTop: 4, fontWeight: '700' },
  stepLine: { width: 40, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 8, marginTop: -15 },
  infoBanner: { backgroundColor: '#EFFFF4', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#D1FAE5' },
  greenIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  infoTextContainer: { marginLeft: 12, flex: 1 },
  infoTitle: { fontWeight: '800', fontSize: 16, color: '#064E3B' },
  infoSub: { fontSize: 12, color: '#065F46', marginTop: 2 },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12, color: '#1A1C1E' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 12 },
  singleInput: { flex: 1, fontSize: 14, color: '#1A1C1E' },
  timeSlotBtn: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF', marginBottom: 10, flexDirection:'row', alignItems:'center' },
  timeSlotText: { marginLeft: 8, fontSize: 14, color: '#1A1C1E', fontWeight: '600' },
  helperText: { fontSize: 12, color: '#6B7280', marginTop: -4, marginBottom: 12, fontStyle: 'italic' },
  confirmBtn: { marginTop: 10, marginBottom: 20 },
  gradient: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});