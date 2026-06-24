// screens/LoginScreen.js — styled to match user app login/register
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../config';
import { USER_API_URL } from '../config';
import * as Location from 'expo-location';
import { BrandGradient, BRAND_ORANGE, SCREEN_BG } from '../constants/colors';

export default function LoginScreen({ navigation, route }) {
  const [isLogin, setIsLogin] = useState(route.params?.showSignUp ? false : true);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState('');

  const syncLocationToMatcher = async (agent, token) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let vehicleType = null;
      try {
        const kycResp = await fetch(`${API_URL}/api/kyc`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (kycResp.ok) {
          const kycData = await kycResp.json();
          vehicleType = kycData?.kyc?.vehicle_type || null;
        }
      } catch (_kycErr) {
        // optional
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await fetch(`${USER_API_URL}/api/agents/agent-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent?.id,
          phone: agent?.mobile,
          name: agent?.fullName,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          vehicleType,
        }),
      });
    } catch (error) {
      console.log('Agent location sync skipped:', error.message);
    }
  };

  const handleLogin = async () => {
    console.log('AGENT LOGIN API_URL', API_URL);
    if (mobile.trim() === '' || password.trim() === '') {
      Alert.alert('Validation', 'Please enter mobile number and password.');
      return;
    }

    setLoading(true);
    try {
      const requestUrl = `${API_URL}/api/auth/login`;
      console.log('AGENT LOGIN request', requestUrl, { mobile: mobile.trim() });
      const resp = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim(), password }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        Alert.alert('Error', data.error || 'Login failed');
        setLoading(false);
        return;
      }

      setLoading(false);
      syncLocationToMatcher(data.user, data.token);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard', params: { user: data.user, token: data.token } }],
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', 'Network error. Check backend URL.');
      console.error(err);
    }
  };

  const handleSignup = async () => {
    if (name.trim() === '' || mobile.trim() === '' || password.trim() === '' || confirmPassword.trim() === '') {
      Alert.alert('Validation', 'Please fill all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Validation', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name.trim(),
          mobile: mobile.trim(),
          password,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setLoading(false);
        Alert.alert('Error', data.error || 'Signup failed');
        return;
      }

      setLoading(false);
      Alert.alert('Success', 'Account created! Now complete KYC verification.');
      navigation.navigate('KYCForm', {
        agentName: data.user.fullName,
        agentPhone: data.user.mobile,
        userId: data.user.id,
        token: data.token,
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', 'Network error. Check backend URL.');
      console.error(err);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: SCREEN_BG }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <LinearGradient colors={BrandGradient} style={styles.header}>
            <Text style={styles.appName}>Smart Luggage</Text>
            <Text style={styles.appSub}>Secure luggage pickup service</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Access your account securely' : 'Create your account to start deliveries'}
            </Text>

            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleBtn, isLogin && styles.toggleBtnActive]}
                onPress={() => setIsLogin(true)}
              >
                <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]}
                onPress={() => setIsLogin(false)}
              >
                <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {isLogin ? (
              <>
                <Text style={styles.label}>
                  Phone Number <Text style={styles.star}>*</Text>
                </Text>
                <View style={styles.phoneRow}>
                  <Text style={styles.code}>+91</Text>
                  <TextInput
                    placeholder="Enter phone number"
                    keyboardType="numeric"
                    style={[styles.input, focus === 'phone' && styles.focus]}
                    value={mobile}
                    onChangeText={setMobile}
                    onFocus={() => setFocus('phone')}
                    onBlur={() => setFocus('')}
                    placeholderTextColor="#9E9E9E"
                  />
                </View>

                <Text style={styles.label}>
                  Password <Text style={styles.star}>*</Text>
                </Text>
                <TextInput
                  placeholder="Enter password"
                  secureTextEntry
                  style={[styles.input, focus === 'password' && styles.focus]}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocus('password')}
                  onBlur={() => setFocus('')}
                  placeholderTextColor="#9E9E9E"
                />

                <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
                  <LinearGradient colors={BrandGradient} style={styles.gradientBtn}>
                    <Text style={styles.btnText}>{loading ? 'Please wait...' : 'Login'}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsLogin(false)}>
                  <Text style={styles.bottomText}>
                    Don't have an account? <Text style={styles.register}>Register</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>
                  Full Name <Text style={styles.star}>*</Text>
                </Text>
                <TextInput
                  placeholder="Enter your full name"
                  style={[styles.input, focus === 'name' && styles.focus]}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocus('name')}
                  onBlur={() => setFocus('')}
                  placeholderTextColor="#9E9E9E"
                />

                <Text style={styles.label}>
                  Phone Number <Text style={styles.star}>*</Text>
                </Text>
                <View style={styles.phoneRow}>
                  <Text style={styles.code}>+91</Text>
                  <TextInput
                    placeholder="Enter phone number"
                    keyboardType="numeric"
                    style={[styles.input, focus === 'phone' && styles.focus]}
                    value={mobile}
                    onChangeText={setMobile}
                    onFocus={() => setFocus('phone')}
                    onBlur={() => setFocus('')}
                    placeholderTextColor="#9E9E9E"
                  />
                </View>

                <Text style={styles.label}>
                  Password <Text style={styles.star}>*</Text>
                </Text>
                <TextInput
                  placeholder="Create password"
                  secureTextEntry
                  style={[styles.input, focus === 'password' && styles.focus]}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocus('password')}
                  onBlur={() => setFocus('')}
                  placeholderTextColor="#9E9E9E"
                />

                <Text style={styles.label}>
                  Confirm Password <Text style={styles.star}>*</Text>
                </Text>
                <TextInput
                  placeholder="Confirm password"
                  secureTextEntry
                  style={[styles.input, focus === 'confirm' && styles.focus]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocus('confirm')}
                  onBlur={() => setFocus('')}
                  placeholderTextColor="#9E9E9E"
                />

                <TouchableOpacity style={styles.btn} onPress={handleSignup} disabled={loading}>
                  <LinearGradient colors={BrandGradient} style={styles.gradientBtn}>
                    <Text style={styles.btnText}>{loading ? 'Please wait...' : 'Create Account'}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsLogin(true)}>
                  <Text style={styles.bottomText}>
                    Already have an account? <Text style={styles.register}>Login</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BG },
  header: {
    height: 240,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  appSub: { color: '#fff', fontSize: 14, marginTop: 5 },
  card: { padding: 25 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1E1F23' },
  subtitle: { color: 'gray', marginBottom: 20, marginTop: 5 },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 18,
    alignSelf: 'flex-start',
    backgroundColor: '#ECEEF3',
    borderRadius: 999,
    padding: 4,
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 999,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(255,102,0,0.12)',
  },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#666B75' },
  toggleTextActive: { color: BRAND_ORANGE },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 4 },
  star: { color: 'red', fontWeight: 'normal' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  code: {
    backgroundColor: '#eee',
    padding: 13,
    borderRadius: 10,
    marginRight: 10,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#eee',
    flex: 1,
    padding: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    fontSize: 14,
    color: '#2B2E33',
  },
  focus: { borderColor: BRAND_ORANGE, borderWidth: 2 },
  btn: { borderRadius: 30, overflow: 'hidden', marginTop: 16 },
  gradientBtn: { padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  bottomText: { textAlign: 'center', marginTop: 20, color: 'gray' },
  register: { color: BRAND_ORANGE, fontWeight: 'bold' },
});
