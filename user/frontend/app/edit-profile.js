import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedName = await AsyncStorage.getItem('userName');
        const pickupLocationDetails = await AsyncStorage.getItem('pickupLocationDetails');
        const pickupDetails = await AsyncStorage.getItem('pickupDetails');

        if (storedName) {
          setName(storedName);
        }

        const savedLocation = pickupLocationDetails || pickupDetails;
        if (savedLocation) {
          const parsed = JSON.parse(savedLocation);
          setAddress(parsed.address || '');
        }
      } catch (error) {
        console.error('Edit profile load error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const saveProfile = async () => {
    try {
      setSaving(true);
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const trimmedAddress = address.trim();

      if (trimmedName) {
        await AsyncStorage.setItem('userName', trimmedName);
      }

      const currentPickupLocation = await AsyncStorage.getItem('pickupLocationDetails');
      const currentPickupDetails = await AsyncStorage.getItem('pickupDetails');
      const parsedLocation = currentPickupLocation ? JSON.parse(currentPickupLocation) : {};
      const parsedPickup = currentPickupDetails ? JSON.parse(currentPickupDetails) : {};

      const nextAddressPayload = {
        ...parsedLocation,
        ...parsedPickup,
        address: trimmedAddress,
        userSelected: true,
      };

      await AsyncStorage.setItem('pickupDetails', JSON.stringify({
        ...parsedPickup,
        address: trimmedAddress,
        userSelected: true,
      }));

      await AsyncStorage.setItem('pickupLocationDetails', JSON.stringify(nextAddressPayload));

      if (trimmedEmail) {
        await AsyncStorage.setItem('userEmail', trimmedEmail);
      }

      Alert.alert('Profile updated', 'Your saved address has been updated.');
      router.back();
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FF4B2B" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#FF4B2B', '#FF8C00']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <Text style={styles.subtitle}>Update your saved details and address</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#9CA3AF" />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Your email" placeholderTextColor="#9CA3AF" keyboardType="email-address" />

          <Text style={styles.label}>Saved Address</Text>
          <TextInput
            style={[styles.input, styles.addressInput]}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter your saved address"
            placeholderTextColor="#9CA3AF"
            multiline
          />

          <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: 30 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  backButton: { alignSelf: 'flex-start', marginBottom: 18 },
  title: { fontSize: 30, fontWeight: '800', color: '#FFF' },
  subtitle: { marginTop: 6, color: 'rgba(255,255,255,0.9)', fontSize: 15 },
  card: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: -16, borderRadius: 24, padding: 18, elevation: 3, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
  addressInput: { minHeight: 110, textAlignVertical: 'top' },
  saveButton: { marginTop: 22, backgroundColor: '#FF4B2B', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});