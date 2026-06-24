import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function EditAddressScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const addressIndex = params?.addressIndex;

  const [name, setName] = useState(params?.name || "");
  const [mobile, setMobile] = useState(params?.mobile || "");
  const [house, setHouse] = useState(params?.house || "");
  const [address, setAddress] = useState(params?.address || "");
  const [pincode, setPincode] = useState(params?.pincode || "");
  const [tag, setTag] = useState(params?.tag || "Home");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !mobile || !address) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    setSaving(true);
    try {
      const savedAddrs = await AsyncStorage.getItem("savedPickupAddresses");
      let addressList = savedAddrs ? JSON.parse(savedAddrs) : [];

      addressList[addressIndex] = {
        name,
        mobile,
        house,
        address,
        pincode,
        tag,
        latitude: params?.latitude,
        longitude: params?.longitude,
        street: params?.street,
        city: params?.city,
        state: params?.state,
        country: params?.country
      };

      await AsyncStorage.setItem("savedPickupAddresses", JSON.stringify(addressList));
      Alert.alert("Success", "Address updated successfully");
      router.back();
    } catch (err) {
      Alert.alert("Error", "Failed to update address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Address</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter name"
            />
          </View>

          {/* Mobile */}
          <View style={styles.field}>
            <Text style={styles.label}>Mobile Number *</Text>
            <TextInput
              style={styles.input}
              value={mobile}
              onChangeText={(text) => {
                const cleaned = text.replace(/\D/g, '').slice(-10);
                setMobile(cleaned);
              }}
              placeholder="10-digit number"
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          {/* House */}
          <View style={styles.field}>
            <Text style={styles.label}>House / Apartment / Shop</Text>
            <TextInput
              style={styles.input}
              value={house}
              onChangeText={setHouse}
              placeholder="Enter house details"
            />
          </View>

          {/* Address */}
          <View style={styles.field}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter address"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Pincode */}
          <View style={styles.field}>
            <Text style={styles.label}>Pincode</Text>
            <TextInput
              style={styles.input}
              value={pincode}
              onChangeText={setPincode}
              placeholder="Enter pincode"
              keyboardType="numeric"
            />
          </View>

          {/* Tag Selection */}
          <Text style={styles.label}>Save as</Text>
          <View style={styles.tagContainer}>
            {["Home", "Shop", "Other"].map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tagBtn,
                  tag === t && styles.activeTag
                ]}
                onPress={() => setTag(t)}
              >
                <Text style={[
                  styles.tagText,
                  tag === t && styles.activeTagText
                ]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff"
  },
  title: { fontSize: 18, fontWeight: "700", color: "#000" },
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#000" },
  textArea: { height: 80, textAlignVertical: "top", paddingVertical: 12 },
  tagContainer: { flexDirection: "row", gap: 8, marginBottom: 24 },
  tagBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ddd", alignItems: "center" },
  activeTag: { borderColor: "#2D6CDF", backgroundColor: "#E8F0FF" },
  tagText: { fontSize: 14, fontWeight: "600", color: "#666" },
  activeTagText: { color: "#2D6CDF" },
  saveBtn: { backgroundColor: "#2D6CDF", paddingVertical: 14, marginHorizontal: 16, marginVertical: 16, borderRadius: 8, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
