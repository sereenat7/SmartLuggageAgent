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

      {/* ---------- SEARCH BAR AT TOP ---------- */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#777" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search for Address"
            value={query}
            onChangeText={handleSearch}
            style={styles.searchInput}
            placeholderTextColor="#999"
          />
          {query ? (
            <TouchableOpacity onPress={() => { setQuery(""); setSuggestions([]); }}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="mic" size={20} color="#FF5F5F" />
          )}
        </View>
      </View>

      {/* ---------- ACTION BUTTONS ---------- */}
      {suggestions.length === 0 && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({
              pathname: "/(booking)/map",
              params: { sourceScreen: sourceScreen }
            })}
          >
            <Ionicons name="map" size={20} color="#FF5F5F" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Select on map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push("/(booking)/saved-addresses")}
          >
            <Ionicons name="heart" size={20} color="#FF5F5F" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Saved Addresses</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ---------- SEARCH RESULTS ---------- */}
      {suggestions.length > 0 && (
        <FlatList
          contentContainerStyle={{ paddingBottom: 0, marginLeft: 16 }}
          data={suggestions}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              onPress={() => selectAddress(item)} 
              style={styles.addressItem}
            >
              <Ionicons name="location-sharp" size={20} color="#2D6CDF" style={{ marginRight: 12, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressItemTitle}>{item.formatted.split(',')[0]}</Text>
                <Text style={styles.addressItemSubtitle}>{item.formatted}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFF",
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F9FF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: "#FF5F5F",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1A1C1E",
    marginHorizontal: 8
  },
  actionsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 40,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center"
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 0
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF5F5F",
    marginLeft: 6
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 0,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0"
  },
  addressItemTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1A1C1E",
    marginBottom: 3
  },
  addressItemSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 1
  }
}); 