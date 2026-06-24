import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SavedAddressesScreen() {
  const router = useRouter();
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load saved addresses when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadSavedAddresses();
    }, [])
  );

  const loadSavedAddresses = async () => {
    try {
      setLoading(true);
      const addresses = await AsyncStorage.getItem("savedPickupAddresses");
      if (addresses) {
        const parsed = JSON.parse(addresses);
        setSavedAddresses(Array.isArray(parsed) ? parsed : []);
      } else {
        setSavedAddresses([]);
      }
    } catch (err) {
      console.error("Error loading saved addresses:", err);
      setSavedAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = (index) => {
    Alert.alert("Delete Address", "Are you sure you want to delete this address?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Delete",
        onPress: async () => {
          try {
            const updated = savedAddresses.filter((_, i) => i !== index);
            await AsyncStorage.setItem("savedPickupAddresses", JSON.stringify(updated));
            setSavedAddresses(updated);
            Alert.alert("Deleted", "Address removed successfully");
          } catch (err) {
            Alert.alert("Error", "Failed to delete address");
          }
        },
        style: "destructive"
      }
    ]);
  };

  const selectAddress = async (address) => {
    try {
      // Save as current pickup details
      await AsyncStorage.setItem("pickupDetails", JSON.stringify({
        address: address.address,
        userSelected: true,
        ...address
      }));

      // Navigate to map with all address data pre-filled
      router.push({
        pathname: "/(booking)/map",
        params: {
          selectedAddress: address.address,
          lat: address.latitude,
          lon: address.longitude,
          house: address.house || "",
          name: address.name || "",
          mobile: address.mobile || "",
          tag: address.tag || "Home",
          sourceScreen: "saved-addresses"
        }
      });
    } catch (err) {
      Alert.alert("Error", "Failed to select address");
    }
  };

  const renderAddressCard = ({ item, index }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => selectAddress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.tagIcon}>
          <Ionicons
            name={
              item.tag === "Home" ? "home" :
              item.tag === "Shop" ? "business" :
              "location"
            }
            size={22}
            color="#000"
          />
        </View>
        <View style={styles.tagInfo}>
          <Text style={styles.tagName}>{item.tag || "Address"}</Text>
          <Text style={styles.senderInfo}>{item.name} • {item.mobile}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        {item.house && (
          <Text style={styles.detail}>
            <Text style={styles.label}>House/Apartment:</Text> {item.house}
          </Text>
        )}
        <Text style={styles.detail}>
          <Text style={styles.label}>Address:</Text> {item.address}
        </Text>
        {item.pincode && (
          <Text style={styles.detail}>
            <Text style={styles.label}>Pincode:</Text> {item.pincode}
          </Text>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => selectAddress(item)}
        >
          <Ionicons name="pencil" size={18} color="#FF5F5F" />
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => deleteAddress(index)}
        >
          <Ionicons name="trash" size={18} color="#FF5F5F" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.mapIconContainer}>
        <Ionicons name="location" size={80} color="#8B9DC3" />
      </View>
      <Text style={styles.emptyText}>No Saved Addresses!</Text>
      <Text style={styles.emptySubtext}>Add them now for a faster, smoother booking experience.</Text>
      <TouchableOpacity
        style={styles.addNewBtn}
        onPress={() => router.push({
          pathname: "/(booking)/search_pickup",
          params: { sourceScreen: "saved-addresses" }
        })}
      >
        <Text style={styles.addNewText}>+ Add New Address</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER WITH + ADD BUTTON - ALWAYS VISIBLE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Addresses</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push({
            pathname: "/(booking)/search_pickup",
            params: { sourceScreen: "saved-addresses" }
          })}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FF5F5F" />
        </View>
      ) : savedAddresses.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={savedAddresses}
          renderItem={renderAddressCard}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff"
  },
  title: { fontSize: 22, fontWeight: "700", color: "#000", flex: 1, marginLeft: 16 },
  addBtn: { 
    borderWidth: 2,
    borderColor: "#FF5F5F", 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 10,
    backgroundColor: "#fff"
  },
  addBtnText: { color: "#FF5F5F", fontWeight: "700", fontSize: 14 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 60
  },
  mapIconContainer: {
    marginBottom: 30,
    opacity: 0.6
  },
  emptyText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
    textAlign: "center"
  },
  emptySubtext: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
    textAlign: "center",
    lineHeight: 22
  },
  addNewBtn: {
    backgroundColor: "#FF5F5F",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center"
  },
  addNewText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  listContent: { paddingHorizontal: 16, paddingVertical: 24, paddingTop: 32 },
  card: { 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    marginBottom: 16, 
    overflow: "hidden", 
    borderWidth: 1, 
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  cardHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: "#f5f5f5" 
  },
  tagIcon: { 
    width: 44, 
    height: 44, 
    borderRadius: 10, 
    backgroundColor: "#f0f0f0", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  tagInfo: { marginLeft: 12, flex: 1 },
  tagName: { fontSize: 16, fontWeight: "700", color: "#000" },
  senderInfo: { fontSize: 13, color: "#666", marginTop: 3 },
  cardBody: { paddingHorizontal: 16, paddingVertical: 14 },
  detail: { fontSize: 13, color: "#555", marginBottom: 8, lineHeight: 18 },
  label: { fontWeight: "600", color: "#333" },
  cardActions: { 
    flexDirection: "row", 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderTopWidth: 1, 
    borderTopColor: "#f5f5f5", 
    gap: 20
  },
  editBtn: { 
    flex: 1, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 10, 
    borderRadius: 8, 
    backgroundColor: "transparent",
    borderWidth: 0
  },
  editText: { color: "#FF5F5F", fontWeight: "600", fontSize: 14, marginLeft: 6 },
  deleteBtn: { 
    flex: 1, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 10, 
    borderRadius: 8, 
    backgroundColor: "transparent",
    borderWidth: 0
  },
  deleteText: { color: "#FF5F5F", fontWeight: "600", fontSize: 14, marginLeft: 6 }
});
