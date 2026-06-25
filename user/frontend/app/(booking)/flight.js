import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, TextInput, 
  ScrollView, Modal, FlatList, Dimensions, Platform, Alert, KeyboardAvoidingView, SafeAreaView, StatusBar
} from 'react-native';
import { MotiView } from 'moti';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

import { 
  loadGlobalAirports, 
  loadIndianAirports, 
  loadGlobalAirlines 
} from '../airportUtils';
import { normalizeAirportName } from '../../utils/airportMappings';
import pincodes from '../../assets/data/pincodes.json';

const { width } = Dimensions.get('window');

export default function FlightDetails() {
  // --- States ---
  const [pinModalVisible, setPinModalVisible] = useState(true);
  const [userPin, setUserPin] = useState('');
  const [isInternational, setIsInternational] = useState(false);
  const [airline, setAirline] = useState(null);
  const [flightNo, setFlightNo] = useState(''); 
  const [terminal, setTerminal] = useState('T2');
  const [depCity, setDepCity] = useState(null);
  
  const [depDate, setDepDate] = useState(new Date());
  const [depTime, setDepTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(null);

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchType, setSearchType] = useState('dep'); 
  const [searchText, setSearchText] = useState('');

  const [airportsData, setAirportsData] = useState([]);
  const [airlinesData, setAirlinesData] = useState([]);

  // --- Data Loading ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [indian, global, airlines] = await Promise.all([
          loadIndianAirports(),
          loadGlobalAirports(),
          loadGlobalAirlines()
        ]);

        const airportMap = new Map();
        global.forEach(a => airportMap.set(a.iata, { ...a, isDomestic: false }));
        indian.forEach(a => airportMap.set(a.iata, { ...a, isDomestic: true }));

        setAirportsData(Array.from(airportMap.values()));
        setAirlinesData(airlines);
      } catch (error) {
        console.error("FlightDetails Data Load Error:", error);
      }
    };
    fetchData();
  }, []);

  // --- Logic Handlers ---
  const checkPinCode = () => {
    if (userPin.length < 6) {
      Alert.alert("Invalid PIN", "Please enter a valid 6-digit PIN code.");
      return;
    }
    if (pincodes.includes(userPin)) {
      setPinModalVisible(false);
    } else {
      Alert.alert(
        "Service Unavailable", 
        "Sorry, we currently do not offer pickup services in this area.", 
        [{ text: "Go Back", onPress: () => router.replace('/(tabs)') }]
      );
    }
  };

  const handleContinue = () => {
    if (!airline || !depCity || !flightNo) {
        Alert.alert("Missing Information", "Please ensure all flight details are filled.");
        return;
    }
    
    // Normalize airport name to expand abbreviations
    const normalizedAirportName = normalizeAirportName(depCity.name);
    
    router.push({ 
        pathname: '/luggage', 
        params: { 
            isInternational: isInternational.toString(), 
            airline: airline.name, 
            flightNo, 
            terminal, 
            depCity: depCity.city,
            depAirport: normalizedAirportName,
            depDate: depDate.toLocaleDateString('en-GB'),
            depTime: depTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}),
        } 
    });
  };

  const onPickerChange = (event, selectedValue) => {
    if (Platform.OS === 'android') setShowPicker(null);
    if (selectedValue) {
        if (showPicker === 'depDate') setDepDate(selectedValue);
        if (showPicker === 'depTime') setDepTime(selectedValue);
    }
  };

  const filteredData = () => {
    const query = searchText.toLowerCase().trim();
    if (searchType === 'airline') {
      const majorAirlines = ["Air India", "Air India Express", "Air Asia", "Akasa Air", "Alliance Air", "GoFirst", "IndiGo", "SpiceJet", "Star Air", "Vistara"];
      if (!query) return majorAirlines.map(name => ({ name, isIndian: true }));
      return airlinesData
        .filter(a => a.name?.toLowerCase().includes(query))
        .sort((a, b) => {
          const aIsMajor = majorAirlines.some(m => a.name?.includes(m));
          const bIsMajor = majorAirlines.some(m => b.name?.includes(m));
          if (aIsMajor && !bIsMajor) return -1;
          if (!aIsMajor && bIsMajor) return 1;
          return 0;
        })
        .slice(0, 20);
    }
    if (!query) {
      const majorIATA = ['DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU', 'COK', 'AMD', 'PNQ', 'GOI'];
      return airportsData
        .filter(a => majorIATA.includes(a.iata))
        .sort((a, b) => majorIATA.indexOf(a.iata) - majorIATA.indexOf(b.iata));
    }
    return airportsData
      .filter(a =>
        a.city?.toLowerCase().includes(query) ||
        a.name?.toLowerCase().includes(query) ||
        a.iata?.toLowerCase().includes(query)
      )
      .sort((a, b) => (a.isDomestic === b.isDomestic ? 0 : a.isDomestic ? -1 : 1))
      .slice(0, 20);
  };

  return (
    <View style={styles.container}>
      <Modal visible={pinModalVisible} transparent={true} animationType="fade">
        <View style={styles.pinOverlay}>
          <KeyboardAvoidingView behavior="padding" style={styles.pinContent}>
            <View style={styles.pinIconCircle}>
              <MaterialCommunityIcons name="map-marker-radius" size={50} color="#FF4B2B" />
            </View>
            <Text style={styles.pinTitle}>Check Serviceability</Text>
            <Text style={styles.pinSub}>Enter your area PIN code to proceed with the booking.</Text>
            <TextInput 
              style={styles.pinInput} 
              placeholder="000000" 
              keyboardType="number-pad" 
              maxLength={6} 
              value={userPin} 
              onChangeText={setUserPin} 
            />
            <TouchableOpacity style={styles.pinBtn} onPress={checkPinCode}>
                <LinearGradient colors={['#FF4B2B', '#FF8C00']} style={styles.pinGradient}>
                  <Text style={styles.pinBtnText}>Verify Area</Text>
                </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.pinCancelBtn}>
              <Text style={styles.pinCancelText}>Cancel</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <SafeAreaView style={{ backgroundColor: '#FFF' }}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#1A1C1E" />
            </TouchableOpacity>
            <Text style={styles.title}>Flight Details</Text>
            <View style={{width: 24}} /> 
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.stepContainer}>
            <View style={styles.stepItem}>
                <View style={[styles.stepCircle, styles.activeStep]}><Text style={styles.stepTextActive}>1</Text></View>
                <Text style={styles.stepLabelActive}>Flight Info</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepItem}>
                <View style={styles.stepCircle}><Text style={styles.stepText}>2</Text></View>
                <Text style={styles.stepLabel}>Luggage</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepItem}>
                <View style={styles.stepCircle}><Text style={styles.stepText}>3</Text></View>
                <Text style={styles.stepLabel}>Pickup</Text>
            </View>
        </View>

        <View style={styles.toggleWrapper}>
            <View style={styles.toggleBg}>
                <MotiView 
                  animate={{ translateX: isInternational ? (width - 40) / 2 : 0 }} 
                  transition={{ type: 'timing', duration: 200 }} 
                  style={styles.slidingPill}
                >
                  <LinearGradient colors={['#FF4B2B', '#FF8C00']} style={styles.pillGradient} />
                </MotiView>
                <TouchableOpacity style={styles.toggleBtn} onPress={() => setIsInternational(false)}>
                    <MaterialCommunityIcons name="airplane-takeoff" size={18} color={!isInternational ? "#FFF" : "#A0A0A0"} />
                    <Text style={[styles.toggleBtnText, !isInternational && styles.activeBtnText]}>Domestic</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toggleBtn} onPress={() => setIsInternational(true)}>
                    <MaterialCommunityIcons name="earth" size={18} color={isInternational ? "#FFF" : "#A0A0A0"} />
                    <Text style={[styles.toggleBtnText, isInternational && styles.activeBtnText]}>International</Text>
                </TouchableOpacity>
            </View>
        </View>

        <Text style={styles.inputLabel}>Select Airline</Text>
        <TouchableOpacity style={styles.cityCard} onPress={() => {setSearchType('airline'); setSearchText(''); setSearchVisible(true);}}>
            <View style={styles.iconCircle}><MaterialCommunityIcons name="airplane" size={20} color="#FF4B2B" /></View>
            <View style={styles.cityInfo}>
                <Text style={styles.cityName}>{airline ? airline.name : "Select Airline"}</Text>
                <Text style={styles.airportName}>{airline ? "Selected Carrier" : "Choose your carrier"}</Text>
            </View>
        </TouchableOpacity>

        <Text style={styles.inputLabel}>Flight Number</Text>
        <View style={styles.cityCard}>
            <View style={styles.iconCircle}><MaterialCommunityIcons name="numeric" size={20} color="#FF4B2B" /></View>
            <TextInput 
              style={{fontWeight: '700', color: '#000', fontSize: 16, flex: 1, marginLeft: 15}} 
              placeholder="e.g. AI-102" 
              value={flightNo} 
              onChangeText={setFlightNo} 
              autoCapitalize="characters" 
            />
        </View>

        <Text style={styles.inputLabel}>Departure City</Text>
        <TouchableOpacity style={styles.cityCard} onPress={() => {setSearchType('dep'); setSearchText(''); setSearchVisible(true);}}>
            <View style={styles.iconCircle}><MaterialCommunityIcons name="map-marker-right" size={20} color="#FF4B2B" /></View>
            <View style={styles.cityInfo}>
                <Text style={styles.cityName}>{depCity ? `${depCity.city} (${depCity.iata})` : "Select Departure"}</Text>
                <Text style={styles.airportName}>{depCity ? depCity.name : "Choose departure airport"}</Text>
            </View>
        </TouchableOpacity>

        <Text style={styles.inputLabel}>Select Terminal</Text>
        <View style={styles.terminalRow}>
            {['T1', 'T2', 'T3'].map((t, idx) => (
                <TouchableOpacity key={t} onPress={() => setTerminal(t)} style={styles.terminalBtnWrapper}>
                    <View style={[styles.terminalBtn, terminal === t && styles.activeTerminal]}>
                        {terminal === t && <LinearGradient colors={['#FF4B2B', '#FF8C00']} style={StyleSheet.absoluteFill} />}
                        <Text style={[styles.terminalTxt, terminal === t && styles.activeBtnText]}>{t}</Text>
                        <View style={[styles.perforation, terminal === t && {backgroundColor: 'rgba(255,255,255,0.4)'}]} />
                        <Text style={[styles.terminalSub, terminal === t && styles.activeBtnText]}>Terminal {idx + 1}</Text>
                    </View>
                </TouchableOpacity>
            ))}
        </View>
        <Text style={styles.terminalNote}>If your city doesn't have terminals, select Terminal 1.</Text>
        
        <Text style={styles.inputLabel}>Departure Date and Time</Text>
        <View style={styles.sideBySideRow}>
            <TouchableOpacity style={styles.dateBox} onPress={() => setShowPicker('depDate')}>
              <MaterialCommunityIcons name="calendar-month" size={18} color="#FF4B2B" />
              <Text style={styles.dateTimeValText}>{depDate.toLocaleDateString('en-GB')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.timeBox} onPress={() => setShowPicker('depTime')}>
              <MaterialCommunityIcons name="clock-outline" size={18} color="#FF4B2B" />
              <Text style={styles.dateTimeValText}>{depTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12: true})}</Text>
            </TouchableOpacity>
        </View>

        {showPicker && (
          <DateTimePicker 
            value={new Date()} 
            mode={showPicker.includes('Time') ? 'time' : 'date'} 
            display="spinner" 
            is24Hour={false} 
            onChange={onPickerChange} 
          />
        )}

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
            <LinearGradient colors={['#FF4B2B', '#FF8C00']} style={styles.gradientBtn}>
              <Text style={styles.continueTxt}>Continue</Text>
            </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={searchVisible} animationType="slide">
        <View style={styles.modal}>
            <View style={styles.modalHeader}>
                <TextInput 
                  style={styles.searchInput} 
                  placeholder={`Search ${searchType === 'airline' ? 'Airlines' : 'Airports'}...`} 
                  value={searchText} 
                  onChangeText={setSearchText} 
                  autoFocus 
                />
                <TouchableOpacity onPress={() => {setSearchVisible(false); setSearchText('');}}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            </View>
            <FlatList 
              data={filteredData()} 
              keyExtractor={(item, index) => index.toString()} 
              renderItem={({item}) => (
                <TouchableOpacity style={styles.resItem} onPress={() => { 
                    if (searchType === 'airline') setAirline(item);
                    else if (searchType === 'dep') setDepCity(item);
                    setSearchVisible(false); 
                    setSearchText('');
                }}>
                    <Text style={styles.resCity}>
                      {searchType === 'airline' ? item.name : `${item.city} (${item.iata})`}
                    </Text>
                    <Text style={styles.resAir}>
                      {searchType === 'airline' ? "Commercial Airline" : item.name}
                    </Text>
                </TouchableOpacity>
            )} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10, paddingBottom: 15, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#1A1C1E' },
  pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  pinContent: { width: width * 0.9, backgroundColor: '#FFF', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 10 },
  pinIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFF5F3', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  pinTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  pinSub: { fontSize: 13, color: '#7D848D', textAlign: 'center', marginVertical: 15, lineHeight: 18 },
  pinInput: { width: '100%', height: 60, backgroundColor: '#F5F7FA', borderRadius: 15, textAlign: 'center', fontSize: 26, fontWeight: '700', color: '#FF4B2B', marginBottom: 20 },
  pinBtn: { width: '100%', borderRadius: 15, overflow: 'hidden' },
  pinGradient: { paddingVertical: 18, alignItems: 'center' },
  pinBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  pinCancelBtn: { marginTop: 12, padding: 10 },
  pinCancelText: { color: '#999', fontWeight: '700', fontSize: 14 },
  stepContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  activeStep: { backgroundColor: '#FF4B2B' },
  stepText: { color: '#999', fontWeight: '700' },
  stepTextActive: { color: '#FFF', fontWeight: '700' },
  stepLabel: { fontSize: 10, color: '#999', marginTop: 4 },
  stepLabelActive: { fontSize: 10, color: '#333', fontWeight: '600', marginTop: 4 },
  stepLine: { width: 40, height: 2, backgroundColor: '#F0F0F0', marginHorizontal: 10, marginBottom: 15 },
  toggleWrapper: { marginBottom: 30 },
  toggleBg: { height: 56, backgroundColor: '#F5F7FA', borderRadius: 28, flexDirection: 'row', padding: 4 },
  slidingPill: { position: 'absolute', width: '50%', height: '100%', top: 4, left: 4, borderRadius: 24 },
  pillGradient: { flex: 1, borderRadius: 24 },
  toggleBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  toggleBtnText: { marginLeft: 8, fontWeight: '700', color: '#A0A0A0', fontSize: 14 },
  activeBtnText: { color: '#FFF' },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 10, marginTop: 10 },
  cityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 18, marginBottom: 15, borderWidth: 1, borderColor: '#F1F5F9' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  cityInfo: { marginLeft: 15, flex: 1 },
  cityName: { fontSize: 16, fontWeight: '700', color: '#000' },
  airportName: { fontSize: 11, color: '#7D848D', marginTop: 2 },
  terminalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  terminalBtnWrapper: { width: (width - 60) / 3 },
  terminalBtn: { height: 85, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#F0F2F5', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  activeTerminal: { elevation: 3, shadowColor: '#FF4B2B', shadowOpacity: 0.15 },
  terminalTxt: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  perforation: { width: '60%', height: 1, backgroundColor: '#EEE', marginVertical: 8, borderStyle: 'dashed' },
  terminalSub: { fontSize: 9, fontWeight: '600', color: '#7D848D' },
  terminalNote: { fontSize: 11, color: '#7D848D', fontStyle: 'italic', textAlign: 'center', marginBottom: 20 },
  sideBySideRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  dateBox: { flex: 1.4, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', padding: 16, borderRadius: 16, marginRight: 10 },
  timeBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', padding: 16, borderRadius: 16 },
  dateTimeValText: { marginLeft: 10, fontWeight: '700', color: '#1A1A1A', fontSize: 14 },
  continueBtn: { marginTop: 30, borderRadius: 18, overflow: 'hidden' },
  gradientBtn: { paddingVertical: 18, alignItems: 'center' },
  continueTxt: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#FFF', paddingTop: 60 },
  modalHeader: { flexDirection: 'row', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE', alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#F5F7FA', padding: 12, borderRadius: 10, color: '#000' },
  cancelText: { marginLeft: 15, color: '#FF4B2B', fontWeight: '700' },
  resItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F5F7FA' },
  resCity: { fontSize: 16, fontWeight: '700', color: '#333' },
  resAir: { fontSize: 12, color: '#999' }
});
