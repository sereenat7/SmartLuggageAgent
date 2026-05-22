import React, { useState } from "react";
import { 
  View, TextInput, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Platform 
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import axios from "axios";


export default function Pickup() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sourceScreen = params?.sourceScreen || "home"; // Default to home if not specified
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const GEOAPIFY_KEY = "6a6f5450f3164727b88686b4a5a0fffd"; // your key

  const handleSearch = async (text) => {
    setQuery(text);
    if (!text) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await axios.get(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&limit=5&apiKey=${GEOAPIFY_KEY}`
      );

      if (res.data?.features) {
        const addresses = res.data.features.map(f => {
  const p = f.properties;
  return {
    formatted: `${p.street || ""} ${p.housenumber || ""}, ${p.city || p.county || ""}, ${p.state || ""}, ${p.country || ""}, ${p.postcode || ""}`.trim().replace(/ ,/g, ","),
    lat: p.lat,
    lon: p.lon
  };
});
        setSuggestions(addresses);
      }
    } catch (err) {
      console.log("Geoapify error:", err);
    }
  };

  const selectAddress = (item) => {
  // Use replace instead of push to avoid nested navigation stack
  // This makes the stack: pickup → map (instead of pickup → search → map)
  router.replace({
    pathname: "/(booking)/map",
    params: { 
      selectedAddress: item.formatted, 
      lat: item.lat, 
      lon: item.lon,
      sourceScreen: sourceScreen,
      // Preserve all booking parameters
      dropLocation: params?.dropLocation,
      dropLatitude: params?.dropLatitude,
      dropLongitude: params?.dropLongitude,
      isInternational: params?.isInternational,
      airline: params?.airline,
      flightNo: params?.flightNo,
      terminal: params?.terminal,
      depCity: params?.depCity,
      depAirport: params?.depAirport,
      depDate: params?.depDate,
      depTime: params?.depTime,
      bags: params?.bags,
      weight: params?.weight,
      fragile: params?.fragile,
      checkin: params?.checkin,
      photos: params?.photos,
      pincode: params?.pincode,
      additionalInfo: params?.additionalInfo
    }
  });
};
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      
      {/* ---------- HEADER ---------- */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Where is your pickup?</Text>
      </View>

      {/* ---------- SEARCH BAR ---------- */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#777" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search for address"
            value={query}
            onChangeText={handleSearch}
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* ---------- ADDRESS SUGGESTIONS ---------- */}
      <FlatList
        contentContainerStyle={{ paddingBottom: 120 }}
        data={suggestions}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => selectAddress(item)} 
            style={styles.addressItem}
          >
            <Ionicons name="location-sharp" size={20} color="#0A66FF" style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 14, color: "#1A1C1E" }}>{item.formatted}</Text>
          </TouchableOpacity>
        )}
      />

      {/* ---------- BOTTOM BUTTON ---------- */}
      <TouchableOpacity 
        onPress={() => router.push({
          pathname: "/(booking)/map",
          params: { sourceScreen: sourceScreen }
        })}
        style={styles.selectMapBtn}
      >
        <Ionicons name="map" size={20} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.selectMapBtnText}>Select on Map</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 50 : 50,
    paddingBottom: 20,
    backgroundColor: "#FFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  backBtn: {
    marginRight: 15,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F3F4F6"
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1C1E"
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 25
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  searchInput: {
    flex: 1,
    fontSize: 14
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F3F3",
    backgroundColor: "#FFF",
    marginTop: 5,
    marginHorizontal: 10,
    borderRadius: 12
  },
  selectMapBtn: {
    position: "absolute",
    bottom: 25,
    left: 20,
    right: 20,
    flexDirection: "row",
    backgroundColor: "#FF5F5F",
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5
  },
  selectMapBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16
  }
}); 