// screens/LoginScreen.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';
import { USER_API_URL } from '../config';
import * as Location from 'expo-location';
import Colors from '../constants/colors';
import LogoIcon from '../components/LogoIcon';

export default function LoginScreen({ navigation, route }) {
  const [isLogin, setIsLogin] = useState(route.params?.showSignUp ? false : true);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const syncLocationToMatcher = async (agent, token) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      let vehicleType = null;
      try {
        const kycResp = await fetch(`${API_URL}/api/kyc`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (kycResp.ok) {
          const kycData = await kycResp.json();
          vehicleType = kycData?.kyc?.vehicle_type || null;
        }
      } catch (_kycErr) {
        // vehicle type unavailable on first sync; dashboard pings will set it
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
    if (mobile.trim() === '' || password.trim() === '') {
      Alert.alert('Validation', 'Please enter mobile number and password.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mobile: mobile.trim(),
          password: password,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        Alert.alert('Error', data.error || 'Login failed');
        setLoading(false);
        return;
      }

      setLoading(false);
      syncLocationToMatcher(data.user, data.token);
      // Store token securely? For now just navigate
      // Maybe params.token navigation?
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
    // Add logging to debug
    console.log('Signup clicked', { name, mobile, password, confirmPassword });

    if (name.trim() === '' || mobile.trim() === '' || password.trim() === '' || confirmPassword.trim() === '') {
      if (Platform.OS === 'web') {
        window.alert('Validation: Please fill all fields.');
      } else {
        Alert.alert('Validation', 'Please fill all fields.');
      }
      return;
    }
    if (password !== confirmPassword) {
      if (Platform.OS === 'web') {
        window.alert('Validation: Passwords do not match.');
      } else {
        Alert.alert('Validation', 'Passwords do not match.');
      }
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: name.trim(),
          mobile: mobile.trim(),
          password: password,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setLoading(false);
        if (Platform.OS === 'web') {
          window.alert(data.error || 'Signup failed');
        } else {
          Alert.alert('Error', data.error || 'Signup failed');
        }
        return;
      }

      setLoading(false);
      if (Platform.OS === 'web') {
        window.alert('Success: Account created! Now complete KYC verification.');
      } else {
        Alert.alert('Success', 'Account created! Now complete KYC verification.');
      }
      navigation.navigate('KYCForm', {
        agentName: data.user.fullName,
        agentPhone: data.user.mobile,
        userId: data.user.id,
        token: data.token,
      });
    } catch (err) {
      setLoading(false);
      if (Platform.OS === 'web') {
        window.alert('Error: Network error. Check backend URL.');
      } else {
        Alert.alert('Error', 'Network error. Check backend URL.');
      }
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <View style={styles.header}>
          <LogoIcon size={64} borderRadius={12} />
          <Text style={styles.headerTitle}>Smart Luggage</Text>
          <Text style={styles.headerSubtitle}>Secure luggage pickup service</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>{isLogin ? 'Login' : 'Sign Up'}</Text>
          <Text style={styles.sectionSubtitle}>
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
              <Text style={styles.label}>Phone Number *</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  placeholderTextColor={Colors.textPlaceholder}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  placeholderTextColor={Colors.textPlaceholder}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginText}>{loading ? 'Please wait...' : 'Login'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsLogin(false)}>
                <Text style={styles.bottomLink}>Don't have an account? <Text style={styles.bottomLinkAccent}>Register</Text></Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textPlaceholder}
              />

              <Text style={styles.label}>Phone Number *</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  placeholderTextColor={Colors.textPlaceholder}
                />
              </View>

              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create password"
                  secureTextEntry={!showPassword}
                  placeholderTextColor={Colors.textPlaceholder}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirm Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  secureTextEntry={!showConfirmPassword}
                  placeholderTextColor={Colors.textPlaceholder}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showConfirmPassword ? 'eye' : 'eye-off'} size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.loginButton} onPress={handleSignup}>
                <Text style={styles.loginText}>{loading ? 'Please wait...' : 'Create Account'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsLogin(true)}>
                <Text style={styles.bottomLink}>Already have an account? <Text style={styles.bottomLinkAccent}>Login</Text></Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F3F7',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F3F7',
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: 10,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    padding: 20,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E1F23',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6F727B',
    marginBottom: 18,
  },
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
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666B75',
  },
  toggleTextActive: {
    color: Colors.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2329',
    marginBottom: 8,
    marginTop: 10,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCodeBox: {
    backgroundColor: '#E8ECF3',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginRight: 8,
  },
  countryCodeText: {
    color: '#2B2E33',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#E8ECF3',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#2B2E33',
  },
  phoneInput: {
    flex: 1,
    height: 52,
  },
  loginButton: {
    backgroundColor: Colors.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  loginText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 15,
  },
  bottomLink: {
    fontSize: 12,
    color: '#7B7F88',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  bottomLinkAccent: {
    color: Colors.primary,
    fontWeight: '700',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8ECF3',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#2B2E33',
  },
  eyeIcon: {
    marginLeft: 10,
  },
});