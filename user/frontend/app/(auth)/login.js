import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { triggerLoginNotification } from "../../utils/notificationService";


export default function LoginScreen() {
  const params = useLocalSearchParams();
  const phoneFromParams = params?.phone?.replace("+91", "") || "";
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.16.111.44:5000';

  const [mode, setMode] = useState("password");
  const [focus, setFocus] = useState("");
  const [phone, setPhone] = useState(phoneFromParams);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef();

  const handleAuth = async () => {
    if (phone.length !== 10) {
      Alert.alert("Invalid Input", "Enter a valid 10-digit phone number");
      return;
    }

    if (mode === "password" && !password) {
      Alert.alert("Invalid Input", "Please enter your password");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "otp" ? "/send-otp" : "/login";
      const body = mode === "otp" 
        ? { phone: "+91" + phone } 
        : { phone: "+91" + phone, password: password };

      const requestUrl = `${API_URL}/api/auth${endpoint}`;
      console.log('USER LOGIN request', requestUrl, body);

      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        if (mode === "otp") {
          Alert.alert("OTP Sent!", "Please check your phone for the OTP.");
          router.push({
            pathname: "/(auth)/otp",
            params: { phone: "+91" + phone }
          });
        } else {
          // Success: Save token and pass the name from DB to the dashboard
          console.log('DEBUG LOGIN: data object:', data);
          console.log('DEBUG LOGIN: data.token:', data.token);
          if (data.token) {
            await AsyncStorage.setItem('authToken', data.token);
            const savedToken = await AsyncStorage.getItem('authToken');
            console.log('DEBUG LOGIN: Token saved successfully to AsyncStorage:', savedToken);
          } else {
            console.error('DEBUG LOGIN: No token received from backend!');
          }
          
          // Save full user data to AsyncStorage
          if (data.user) {
            await AsyncStorage.setItem('userName', data.user.name);
            await AsyncStorage.setItem('userPhone', data.user.phone);
            await AsyncStorage.setItem('userEmail', data.user.email || '');
            await AsyncStorage.setItem('userData', JSON.stringify({
              name: data.user.name,
              phone: data.user.phone,
              email: data.user.email
            }));
            console.log('DEBUG LOGIN: User data saved:', data.user.name, data.user.phone);
          }
          
          global.userPhone = data.user.phone;
          console.log("LOGIN PHONE:", global.userPhone);
          
          // Trigger OS-level notification
          await triggerLoginNotification(data.user?.name || "User");
          
          router.replace({
            pathname: "/(tabs)",
            params: { userName: data.user?.name || "User" }
          });
        }
      } else {
        Alert.alert("Login Failed", data.message || "Invalid credentials");
      }
    } catch (err) {
      console.error("USER LOGIN fetch error:", err);
      Alert.alert(
        "Network error",
        `Make sure laptop & phone are on same Wi-Fi.\n${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: "#f5f6fa" }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.container}>
          <LinearGradient
            colors={["#ff0033", "#ff6600"]}
            style={styles.header}
          >
            <Text style={styles.appName}>Smart Luggage</Text>
            <Text style={styles.appSub}>Secure luggage pickup service</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.title}>Login</Text>
            <Text style={styles.subtitle}>Access your account securely</Text>

            <View style={styles.radioRow}>
              <TouchableOpacity style={styles.radioBtn} onPress={() => setMode("otp")}>
                <View style={styles.radioOuter}>{mode === "otp" && <View style={styles.radioInner} />}</View>
                <Text style={styles.radioText}>OTP</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.radioBtn} onPress={() => setMode("password")}>
                <View style={styles.radioOuter}>{mode === "password" && <View style={styles.radioInner} />}</View>
                <Text style={styles.radioText}>Password</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Phone Number <Text style={styles.star}>*</Text></Text>
            <View style={styles.phoneRow}>
              <Text style={styles.code}>+91</Text>
              <TextInput
                placeholder="Enter phone number"
                keyboardType="numeric"
                style={[styles.input, focus === "phone" && styles.focus]}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => { setFocus("phone"); scrollRef.current?.scrollTo({ y: 100, animated: true }); }}
                onBlur={() => setFocus("")}
              />
            </View>

            {mode === "password" && (
              <View style={{ marginBottom: 15 }}>
                <Text style={styles.label}>Password <Text style={styles.star}>*</Text></Text>
                <TextInput
                  placeholder="Enter password"
                  secureTextEntry
                  style={[styles.input, focus === "password" && styles.focus]}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => { setFocus("password"); scrollRef.current?.scrollTo({ y: 150, animated: true }); }}
                  onBlur={() => setFocus("")}
                />
              </View>
            )}

            <TouchableOpacity style={styles.btn} onPress={handleAuth} disabled={loading}>
              <LinearGradient colors={["#ff0033", "#ff6600"]} style={styles.gradientBtn}>
                <Text style={styles.btnText}>
                  {loading ? "Please wait..." : mode === "otp" ? "Send OTP" : "Login"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.bottomText}>
                Don't have an account? <Text style={styles.register}>Register</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  header: { height: 240, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, alignItems: "center", justifyContent: "center" },
  appName: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  appSub: { color: "#fff", fontSize: 14, marginTop: 5 },
  card: { padding: 25 },
  title: { fontSize: 26, fontWeight: "bold" },
  subtitle: { color: "gray", marginBottom: 20, marginTop: 5 },
  radioRow: { flexDirection: "row", marginBottom: 20 },
  radioBtn: { flexDirection: "row", alignItems: "center", marginRight: 20 },
  radioOuter: { height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: "#ff6600", alignItems: "center", justifyContent: "center", marginRight: 8 },
  radioInner: { height: 10, width: 10, borderRadius: 5, backgroundColor: "#ff6600" },
  radioText: { fontSize: 15 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 5 },
  star: { color: "red", fontWeight: "normal" },
  phoneRow: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  code: { backgroundColor: "#eee", padding: 13, borderRadius: 10, marginRight: 10, fontWeight: "600" },
  input: { backgroundColor: "#eee", flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: "#eee" },
  focus: { borderColor: "#ff6600", borderWidth: 2 },
  btn: { borderRadius: 30, overflow: "hidden" },
  gradientBtn: { padding: 16, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  bottomText: { textAlign: "center", marginTop: 20, color: "gray" },
  register: { color: "#ff6600", fontWeight: "bold" }
});

