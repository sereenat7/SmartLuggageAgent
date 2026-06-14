import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, Text, TextInput, TouchableOpacity, 
  ScrollView, ActivityIndicator, Alert, StatusBar, 
  KeyboardAvoidingView, Platform 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const IP_ADDRESS = process.env.EXPO_PUBLIC_API_HOST || "10.236.235.44";
const API_URL = `http://${IP_ADDRESS}:5000/api/auth`;

export default function EditProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  
  const [currentPassword, setCurrentPassword] = useState(""); 
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showCurrentPass, setShowCurrentPass] = useState(false); 
  const [showNewPass, setShowNewPass] = useState(false);

  useEffect(() => {
    async function fetchCurrentData() {
      try {
        const userPhone = global.userPhone; 
        const response = await fetch(`${API_URL}/user-profile?phone=${encodeURIComponent(userPhone)}`);
        const result = await response.json();

        if (result.success) {
          setName(result.name);
          setPhone(result.phone);
          setEmail(result.email && result.email !== "Not provided" ? result.email : "");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to load profile data");
      } finally {
        setLoading(false);
      }
    }
    fetchCurrentData();
  }, []);

  const handleUpdate = async () => {
    if (!name || !phone) {
      Alert.alert("Error", "Name and Phone are required");
      return;
    }

    if (isChangingPassword) {
      if (newPassword.length < 6) {
        Alert.alert("Error", "New password must be at least 6 characters");
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match!");
        return;
      }
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          password: isChangingPassword ? newPassword : null, 
          originalPhone: global.userPhone 
        }),
      });

      const result = await response.json();
      if (result.success) {
        global.userPhone = phone; 
        Alert.alert("Success", "Profile updated successfully", [{ text: "OK", onPress: () => router.back() }]);
      } else {
        Alert.alert("Update Failed", result.message);
      }
    } catch (error) {
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#FF4B2B" /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <LinearGradient colors={['#FF1F1F', '#FF8C00']} style={styles.header}>
            <SafeAreaView edges={['top']}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <MaterialCommunityIcons name="chevron-left" size={32} color="white" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit Profile</Text>
              <Text style={styles.headerSub}>Update your personal information</Text>
            </SafeAreaView>
          </LinearGradient>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="account-outline" size={22} color="#64748B" />
                <TextInput style={styles.input} value={name} onChangeText={setName} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="phone-outline" size={22} color="#64748B" />
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="email-outline" size={22} color="#64748B" />
                <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
              </View>
            </View>

            {/* Current Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock-outline" size={22} color="#64748B" />
                
                <TextInput 
                  style={styles.input} 
                  value={currentPassword} 
                  onChangeText={setCurrentPassword}
                  placeholder="Enter your password"
                  secureTextEntry={!showCurrentPass}
                  underlineColorAndroid="transparent"
                />

                <TouchableOpacity 
                  onPress={() => setShowCurrentPass(!showCurrentPass)}
                  style={{ padding: 5 }}
                >
                  <MaterialCommunityIcons 
                    name={showCurrentPass ? "eye-off" : "eye"} 
                    size={24} 
                    color={showCurrentPass ? "#FF4B2B" : "#64748B"} 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.changeBtnLink} onPress={() => setIsChangingPassword(!isChangingPassword)}>
                <Text style={styles.changeBtnText}>
                  {isChangingPassword ? "Cancel Change" : "Change Password?"}
                </Text>
              </TouchableOpacity>
            </View>

            {isChangingPassword && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="lock-plus-outline" size={22} color="#64748B" />
                    <TextInput 
                      style={styles.input} 
                      secureTextEntry={!showNewPass} 
                      value={newPassword} 
                      onChangeText={setNewPassword} 
                      placeholder="Enter new password"
                    />
                    <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)}>
                      <MaterialCommunityIcons name={showNewPass ? "eye-off" : "eye"} size={22} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm New Password</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="lock-check-outline" size={22} color="#64748B" />
                    <TextInput 
                      style={styles.input} 
                      secureTextEntry={!showNewPass} 
                      value={confirmPassword} 
                      onChangeText={setConfirmPassword} 
                      placeholder="Confirm new password"
                    />
                    <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)}>
                      <MaterialCommunityIcons name={showNewPass ? "eye-off" : "eye"} size={22} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleUpdate} disabled={saving}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  header: { paddingBottom: 60, paddingHorizontal: 25, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  backButton: { width: 42, height: 42, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#FFF', marginTop: 5 },
  headerSub: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 5 },
  formCard: { backgroundColor: '#FFF', borderRadius: 30, padding: 25, marginHorizontal: 20, marginTop: -40, elevation: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 15, paddingHorizontal: 15, height: 60, borderWidth: 1, borderColor: '#E2E8F0' },
  
  input: { 
    flex: 1, 
    marginLeft: 12, 
    fontSize: 16, 
    color: '#334155',
    minWidth: 100   // ✅ FIX
  },

  changeBtnLink: { alignSelf: 'flex-end', marginTop: 5 },
  changeBtnText: { color: '#FF4B2B', fontWeight: '700', fontSize: 13 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  cancelButton: { flex: 0.46, height: 58, justifyContent: 'center', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  cancelText: { fontWeight: '700', color: '#64748B' },
  saveButton: { flex: 0.46, height: 58, backgroundColor: '#FF4B2B', justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
  saveText: { fontWeight: '700', color: '#FFF' },
});
