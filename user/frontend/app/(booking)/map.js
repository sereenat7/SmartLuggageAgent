import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  PanResponder,
  TextInput,
  Modal,
  FlatList,
  Alert
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as Contacts from "expo-contacts";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFonts } from "expo-font";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import AsyncStorage from "@react-native-async-storage/async-storage";

const GEO_API_KEY = "6a6f5450f3164727b88686b4a5a0fffd";

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sourceScreen = params?.sourceScreen || "home"; // Determine where to return to
  const scrollRef = useRef(null);

  const [region, setRegion] = useState(null);
  const [markerCoord, setMarkerCoord] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [house, setHouse] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  const [selectedTag, setSelectedTag] = useState("Home");
  const [customTag, setCustomTag] = useState("");

  const [lockExpand, setLockExpand] = useState(false);
  const [userSelected, setUserSelected] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactsList, setContactsList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");

  const sheetHeight = useRef(new Animated.Value(160)).current;

  const initialLoadDone = useRef(false);
  const manualSelectionDone = useRef(false);

  // Autofill login user details
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Try to load from userData first
        const userData = await AsyncStorage.getItem("userData");
        if (userData) {
          const user = JSON.parse(userData);
          setName(user.name || "");
          // Clean phone number: remove +91 and non-digits, keep last 10 digits
          const cleanedPhone = (user.phone || "").replace(/\D/g, '').slice(-10);
          setMobile(cleanedPhone);
          console.log("✅ Sender details auto-filled from login:", user.name, cleanedPhone);
          return;
        }
        
        // Fallback: load from individual fields
        const userName = await AsyncStorage.getItem("userName");
        const userPhone = await AsyncStorage.getItem("userPhone");
        if (userName) setName(userName);
        if (userPhone) {
          const cleanedPhone = userPhone.replace(/\D/g, '').slice(-10);
          setMobile(cleanedPhone);
        }
        console.log("✅ Sender details auto-filled from individual fields:", userName, userPhone?.replace(/\D/g, '').slice(-10));
      } catch (err) {
        console.log("Error loading user from storage:", err);
      }
    };

    loadUser();
  }, []);

  // Initial location
  useEffect(() => {
    if (!initialLoadDone.current) {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        // ✅ FIX: high accuracy
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        const { latitude, longitude } = loc.coords;

        if (!manualSelectionDone.current) {
          setRegion({
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
          setMarkerCoord({ latitude, longitude });
          reverseGeocode(latitude, longitude);
        }

        initialLoadDone.current = true;
      })();
    }
  }, []);

  // From search screen
  useEffect(() => {
    if (params?.lat && params?.lon && params?.selectedAddress) {
      const lat = parseFloat(params.lat);
      const lon = parseFloat(params.lon);

      setRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      setMarkerCoord({ latitude: lat, longitude: lon });
      setSelectedAddress(params.selectedAddress);

      // Load saved address data if coming from saved addresses
      if (params.sourceScreen === "saved-addresses") {
        if (params.house) setHouse(params.house);
        if (params.name) setName(params.name);
        if (params.mobile) setMobile(params.mobile);
        if (params.tag) setSelectedTag(params.tag);
      }

      manualSelectionDone.current = true;
    }
  }, [params.lat, params.lon, params.selectedAddress]);

  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEO_API_KEY}`
      );
      const data = await res.json();
      if (data.features?.length > 0) {
        setSelectedAddress(data.features[0].properties.formatted);
      }
    } catch {}
  };

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });
    reverseGeocode(latitude, longitude);

    manualSelectionDone.current = true;
  };

  const pickContact = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Please allow access to contacts");
      return;
    }

    setLoadingContacts(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      // Filter contacts that have phone numbers
      const contactsWithPhone = data.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0);
      
      if (contactsWithPhone.length === 0) {
        Alert.alert("No Contacts", "No contacts with phone numbers found");
        return;
      }

      setContactsList(contactsWithPhone);
      setShowContactModal(true);
    } catch (err) {
      console.error("Error loading contacts:", err);
      Alert.alert("Error", "Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  };

  const selectContact = (contact) => {
    // Get first phone number
    const phoneNumber = contact.phoneNumbers?.[0]?.number || "";
    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    
    setName(contact.name || "");
    setMobile(cleanPhone);
    setShowContactModal(false);
    setContactSearchQuery(""); // Clear search
    console.log("✅ Contact selected:", contact.name, cleanPhone);
  };

  const getFilteredContacts = () => {
    if (!contactSearchQuery.trim()) return contactsList;
    
    const query = contactSearchQuery.toLowerCase();
    return contactsList.filter(contact => {
      const nameMatch = (contact.name || "").toLowerCase().includes(query);
      const phoneMatch = (contact.phoneNumbers?.[0]?.number || "").includes(contactSearchQuery);
      return nameMatch || phoneMatch;
    });
  };

  const expandSheet = () => {
    setExpanded(true);
    setLockExpand(true);

    Animated.spring(sheetHeight, {
      toValue: 520,
      useNativeDriver: false,
    }).start();
  };

  const collapseSheet = () => {
    if (lockExpand) return;

    setExpanded(false);

    Animated.spring(sheetHeight, {
      toValue: 160,
      useNativeDriver: false,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
      onPanResponderMove: (_, g) => {
        if (lockExpand) return;
        let newHeight = expanded ? 520 - g.dy : 160 - g.dy;
        if (newHeight < 160) newHeight = 160;
        if (newHeight > 550) newHeight = 550;
        sheetHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_, g) => {
        if (lockExpand) return;
        if (g.dy < -50) expandSheet();
        else if (g.dy > 50) collapseSheet();
      },
    })
  ).current;

  // ✅ SAVE + GO BACK TO SOURCE SCREEN
  const handleConfirm = async () => {
  const pickupData = {
    address: selectedAddress,
    house,
    name,
    mobile,
    tag: selectedTag === "Other" ? customTag : selectedTag,
    latitude: markerCoord?.latitude,
    longitude: markerCoord?.longitude,
    userSelected: true, // ✅ IMPORTANT FLAG
    street: selectedAddress.split(',')[0] || '',
    city: selectedAddress.split(',')[1] || '',
    state: selectedAddress.split(',')[2] || '',
    postalCode: '',
    country: 'IN',
    phone: mobile,
  };

  try {
   await AsyncStorage.setItem(
  "pickupDetails",
  JSON.stringify({
    address: selectedAddress,
    userSelected: true,
    ...pickupData
  })
);

  // ✅ Also save full pickup location details for the booking database
  await AsyncStorage.setItem(
    "pickupLocationDetails",
    JSON.stringify(pickupData)
  );

  // ✅ ONLY SAVE TO SAVED ADDRESSES LIST IF COMING FROM SAVED-ADDRESSES (EXPLICIT ADD)
  if (sourceScreen === "saved-addresses" && selectedTag) {
    try {
      const savedAddrs = await AsyncStorage.getItem("savedPickupAddresses");
      let addressList = savedAddrs ? JSON.parse(savedAddrs) : [];
      
      // Check if address already exists
      const exists = addressList.findIndex(addr => addr.tag === pickupData.tag && addr.address === pickupData.address);
      
      if (exists === -1) {
        // Add new address only if coming from saved-addresses
        addressList.push(pickupData);
        await AsyncStorage.setItem("savedPickupAddresses", JSON.stringify(addressList));
        console.log("✅ Address saved to saved addresses:", pickupData.tag);
      }
    } catch (err) {
      console.log("Error saving to address list:", err);
    }
  }

    // ✅ Route back based on source screen
    // IMPORTANT: Use router.back() to preserve the entire navigation stack
    if (sourceScreen === "search_pickup" || sourceScreen === "pickup" || sourceScreen === "saved-addresses") {
      // Save pickup to AsyncStorage, then use back button to return with data preserved
      router.back();
    } else {
      router.push("/(tabs)");
    }
  } catch (err) {
    console.log("Error saving pickup:", err);
  }
};

  if (!region) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <MapView
        style={{ flex: 1 }}
        region={region}   // ✅ FIXED
        onPress={handleMapPress}
        showsUserLocation={true}
        followsUserLocation={false}
      >
        {markerCoord && <Marker coordinate={markerCoord} />}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} />
      </TouchableOpacity>

      <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
        <View {...panResponder.panHandlers} style={styles.dragHandleWrapper}>
          <View style={styles.dragHandle} />
        </View>

        {!expanded && (
          <>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={20} color="#0A66FF" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.place}>{selectedAddress.split(",")[0]}</Text>
                <Text style={styles.address}>{selectedAddress}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={expandSheet}>
              <Text style={styles.confirmText}>Confirm Pickup Location</Text>
            </TouchableOpacity>
          </>
        )}

        {expanded && (
          <KeyboardAwareScrollView
            showsVerticalScrollIndicator={false}
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            extraScrollHeight={50}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 0 }}
            ref={scrollRef}
          >
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={20} color="#00C853" />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.place}>{selectedAddress.split(",")[0]}</Text>
                <Text style={styles.address}>{selectedAddress}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() =>
                  router.push({
                    pathname: "/(booking)/search_pickup",
                    params: { focusSearch: true, sourceScreen: sourceScreen },
                  })
                }
              >
                <Ionicons name="create-outline" size={14} color="#2D6CDF" />
                <Text style={styles.changeText}> Change</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>House / Apartment / Shop</Text>
              <TextInput style={styles.input} value={house} onChangeText={setHouse} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Sender's Name</Text>
              <View style={styles.inputRow}>
                <TextInput style={{ flex: 1 }} value={name} onChangeText={setName} />
                <TouchableOpacity onPress={pickContact}>
                  <Ionicons name="person-circle-outline" size={22} color="#0A66FF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Sender's Mobile number</Text>
              <TextInput 
                style={styles.input} 
                value={mobile} 
                onChangeText={(text) => {
                  // Remove all non-digits, then keep only last 10 digits
                  const cleaned = text.replace(/\D/g, '').slice(-10);
                  setMobile(cleaned);
                }} 
                keyboardType="phone-pad"
                placeholder="10-digit number"
                maxLength={10}
              />
            </View>

            {/* ✅ SAME UI KEPT */}
            <Text style={styles.saveTitle}>Save as (optional)</Text>
            <View style={styles.saveRow}>
              <TouchableOpacity style={[styles.saveBtn, selectedTag === "Home" && styles.activeSave]} onPress={() => setSelectedTag("Home")}>
                <Ionicons name="home" size={16} color={selectedTag === "Home" ? "#2D6CDF" : "#444"} />
                <Text style={styles.saveText}> Home</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.saveBtn, selectedTag === "Shop" && styles.activeSave]} onPress={() => setSelectedTag("Shop")}>
                <Ionicons name="business" size={16} color={selectedTag === "Shop" ? "#2D6CDF" : "#444"} />
                <Text style={styles.saveText}> Shop</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.saveBtn, selectedTag === "Other" && styles.activeSave]} onPress={() => setSelectedTag("Other")}>
                <Ionicons name="heart" size={16} color={selectedTag === "Other" ? "#2D6CDF" : "#444"} />
                <Text style={styles.saveText}> Other</Text>
              </TouchableOpacity>
            </View>

            {selectedTag === "Other" && (
              <View style={styles.field}>
                <Text style={styles.label}>Save as</Text>
                <TextInput style={styles.input} value={customTag} onChangeText={setCustomTag} />
              </View>
            )}

            <TouchableOpacity style={styles.finalBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirm And Proceed</Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        )}
      </Animated.View>

      {/* Contact Picker Modal */}
      <Modal visible={showContactModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Contact</Text>
              <TouchableOpacity onPress={() => {
                setShowContactModal(false);
                setContactSearchQuery("");
              }}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or phone"
                value={contactSearchQuery}
                onChangeText={setContactSearchQuery}
                placeholderTextColor="#999"
              />
              {contactSearchQuery ? (
                <TouchableOpacity onPress={() => setContactSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>

            {loadingContacts ? (
              <View style={styles.centerLoader}>
                <ActivityIndicator size="large" color="#2D6CDF" />
              </View>
            ) : (
              <FlatList
                data={getFilteredContacts()}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => selectContact(item)}
                  >
                    <View style={styles.contactIcon}>
                      <Ionicons name="person-circle" size={40} color="#2D6CDF" />
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{item.name}</Text>
                      <Text style={styles.contactPhone}>
                        {item.phoneNumbers?.[0]?.number || "No phone"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search" size={48} color="#ddd" />
                    <Text style={styles.emptyText}>No contacts found</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  backBtn: { position: "absolute", top: 50, left: 15, padding: 8, borderRadius: 10, backgroundColor: "#F3F4F6" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20
  },
  dragHandleWrapper: { alignItems: "center", paddingVertical: 3 },
  dragHandle: { width: 40, height: 5, backgroundColor: "#ccc", borderRadius: 10 },
  locationRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  place: { fontSize: 16, fontWeight: "700" },
  address: { fontSize: 13, color: "#666" },
  confirmBtn: { backgroundColor: "#2D6CDF", paddingVertical: 15, borderRadius: 12, alignItems: "center", marginBottom: 20 },
  confirmText: { color: "#fff" },
  field: { marginTop: 18 },
  label: { position: "absolute", top: -8, left: 12, backgroundColor: "#fff", paddingHorizontal: 4, fontSize: 12, color: "#666", zIndex: 1 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 14 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ddd", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 3 },
  saveTitle: { marginTop: 20, fontSize: 13, color: "#888" },
  saveRow: { flexDirection: "row", marginTop: 10 },
  saveBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 20, marginRight: 10 },
  activeSave: { backgroundColor: "#E8F0FF", borderColor: "#2D6CDF" },
  saveText: { fontSize: 13, color: "#444" },
  changeBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#2D6CDF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#F5F9FF" },
  changeText: { color: "#2D6CDF", fontWeight: "600", fontSize: 13 },
  finalBtn: { backgroundColor: "#2D6CDF", padding: 15, borderRadius: 12, marginTop: 20, alignItems: "center" },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", paddingBottom: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#eee" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#000" },
  searchContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#f9f9f9" },
  searchInput: { flex: 1, marginHorizontal: 10, paddingVertical: 8, fontSize: 14, color: "#000" },
  centerLoader: { flex: 1, justifyContent: "center", alignItems: "center" },
  contactItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  contactIcon: { marginRight: 12 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: "600", color: "#000" },
  contactPhone: { fontSize: 13, color: "#999", marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, color: "#999", marginTop: 10 }
});
