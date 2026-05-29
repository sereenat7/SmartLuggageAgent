import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, ScrollView, 
  ActivityIndicator, StatusBar 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Double check your IPv4 address using 'ipconfig'
// 2. Ensure port is 5000 (from your server.js)
const API_URL = `${process.env.EXPO_PUBLIC_API_URL || 'http://10.159.173.44:5000'}/api/auth/user-profile`;

const ProfileOption = ({ icon, title, color, onPress }) => (
  <TouchableOpacity style={styles.optionRow} onPress={onPress}>
    <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.optionText}>{title}</Text>
    <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
  </TouchableOpacity>
);

export default function Profile() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  async function fetchProfile() {
    try {
      setLoading(true);

      const testPhone = global.userPhone; // ✅ use stored phone
      console.log("PROFILE PHONE:", testPhone);

      const response = await fetch(
        `${API_URL}?phone=${encodeURIComponent(testPhone)}`
      );

      const result = await response.json();

      console.log("DEBUG RESULT:", result);

      if (result.success) {
        const nameParts = result.name.trim().split(' ');
        const initials = nameParts.length > 1
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : nameParts[0][0].toUpperCase();

        setUserData({ ...result, initials });
      } else {
        // Fallback to AsyncStorage
        const storedName = await AsyncStorage.getItem("userName");
        if (storedName) {
          const nameParts = storedName.trim().split(' ');
          const initials = nameParts.length > 1
            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
            : nameParts[0][0].toUpperCase();
          setUserData({ name: storedName, phone: testPhone, email: "-", initials });
        } else {
          setUserData({ name: "No User", phone: "-", email: "-", initials: "?" });
        }
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      // Fallback to AsyncStorage on network error
      const storedName = await AsyncStorage.getItem("userName");
      if (storedName) {
        const nameParts = storedName.trim().split(' ');
        const initials = nameParts.length > 1
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : nameParts[0][0].toUpperCase();
        setUserData({ name: storedName, phone: global.userPhone, email: "-", initials });
      } else {
        setUserData({ name: "Error Loading", phone: "Check Server", email: "Try Again", initials: "!" });
      }
    } finally {
      setLoading(false);
    }
  }

  fetchProfile();
}, []);
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FF4B2B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <LinearGradient 
          colors={['#FF1F1F', '#FF8C00']} 
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.8 }} 
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>My Profile</Text>
              <Text style={styles.headerSub}>Manage your account settings</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <LinearGradient colors={['#FF4B2B', '#FF8C00']} style={styles.avatarGradient}>
              <Text style={styles.avatarText}>{userData?.initials || 'U'}</Text>
            </LinearGradient>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{userData?.name}</Text>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="phone" size={16} color="#64748B" />
              <Text style={styles.detailText}>{userData?.phone}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="email" size={16} color="#64748B" />
              <Text style={styles.detailText}>{userData?.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.listContainer}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.cardGroup}>
            <ProfileOption icon="account-edit" title="Edit Profile" color="#4F46E5" onPress={() => router.push('/editprofile')} />
            <View style={styles.divider} />
            <ProfileOption icon="map-marker" title="Saved Address" color="#10B981" onPress={() => router.push('/(booking)/saved-addresses')} />
          </View>

          <Text style={styles.sectionLabel}>SUPPORT</Text>
          <View style={styles.cardGroup}>
            <ProfileOption icon="file-document" title="Terms and Conditions" color="#8B5CF6" onPress={() => router.push('/terms')} />
            <View style={styles.divider} />
            <ProfileOption icon="help-circle" title="Help and Support" color="#F59E0B" onPress={() => router.push('/support')} />
            <View style={styles.divider} />
            <ProfileOption icon="alert-circle" title="Report a Problem" color="#EF4444" onPress={() => router.push('/report')} />
            <View style={styles.divider} />
            <ProfileOption icon="message-draw" title="Send Feedback" color="#6366F1" onPress={() => router.push('/feedback')} />
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={() => router.replace('/')}>
            <MaterialCommunityIcons name="logout" size={22} color="#FF4B2B" />
            <Text style={styles.logoutLabel}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerGradient: { height: 240, borderBottomLeftRadius: 50, borderBottomRightRadius: 50, paddingHorizontal: 25 },
  headerContent: { marginTop: 35 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 5 },
  scrollContent: { paddingBottom: 50 },
  listContainer: { paddingHorizontal: 20 },
  profileCard: { backgroundColor: '#FFF', borderRadius: 30, padding: 20, flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: -70, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 15, zIndex: 10 },
  avatarGradient: { width: 85, height: 85, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  userInfo: { marginLeft: 18, flex: 1 },
  userName: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  detailText: { fontSize: 14, color: '#64748B', marginLeft: 10, fontWeight: '500' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 15, marginTop: 15, marginLeft: 5 },
  cardGroup: { backgroundColor: '#FFF', borderRadius: 25, paddingHorizontal: 18, marginBottom: 20, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  iconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  optionText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#334155' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 60 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', paddingVertical: 18, borderRadius: 22, borderWidth: 1, borderColor: '#FEE2E2', marginTop: 10, elevation: 2 },
  logoutLabel: { fontSize: 17, fontWeight: '700', color: '#ff6600', marginLeft: 12 },
});
