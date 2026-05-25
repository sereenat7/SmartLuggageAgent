import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams(); 
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [focusIndex, setFocusIndex] = useState(null);
  const inputs = useRef([]);

  const handleVerify = async () => {
    const otpValue = otp.join("");
    if (otpValue.length !== 6) { Alert.alert("Error", "Please enter a 6-digit OTP"); return; }
    
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://10.227.242.44:5000'}/api/auth/verify-otp`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpValue })
      });
      
      const data = await res.json();
      console.log('DEBUG OTP: Received data from backend:', data);
      console.log('DEBUG OTP: Token value:', data.token);
      
      if (data.success) { 
        // Save token from response
        if (data.token) {
          await AsyncStorage.setItem('authToken', data.token);
          const savedToken = await AsyncStorage.getItem('authToken');
          console.log('DEBUG OTP: Token saved to AsyncStorage:', savedToken);
        } else {
          console.error('DEBUG OTP: No token received from backend!');
        }
        
        // SAVE NAME TO STORAGE PERMANENTLY
        if (data.user?.name) {
          await AsyncStorage.setItem("userName", data.user.name);
        }
         global.userPhone = data.user.phone;
         console.log("LOGIN PHONE:", global.userPhone);
        // Navigate to tabs
        router.replace('/(tabs)'); 
      }
      else { 
        Alert.alert("Failed", data.message || "Invalid OTP"); 
      }
    } catch (err) { 
      Alert.alert("Network error", "Check server connection."); 
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} backgroundColor="#fff">
        <LinearGradient colors={["#ff0033", "#ff6600"]} style={styles.header}>
          <Text style={styles.appName}>Smart Luggage</Text>
          <Text style={styles.subtitle}>OTP Verification</Text>
        </LinearGradient>
        
        <View style={styles.card}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.infoText}>Enter the 6-digit code sent to {phone}</Text>
          
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputs.current[index] = ref)}
                style={[styles.otpBox, focusIndex === index && styles.focus]}
                keyboardType="numeric" maxLength={1} value={digit}
                onFocus={() => setFocusIndex(index)} onBlur={() => setFocusIndex(null)}
                onChangeText={(text) => {
                  let newOtp = [...otp]; newOtp[index] = text; setOtp(newOtp);
                  if (text && index < 5) inputs.current[index + 1]?.focus();
                  if (!text && index > 0) inputs.current[index - 1]?.focus();
                }}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleVerify}>
            <LinearGradient colors={["#ff0033", "#ff6600"]} style={styles.gradientBtn}>
              <Text style={styles.btnText}>Verify OTP</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => console.log("Resend")}>
            <Text style={styles.resendText}>Didn't receive OTP? <Text style={styles.resendLink}>Resend</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { height: 220, alignItems: "center", justifyContent: "center" },
  appName: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  subtitle: { color: "#fff", marginTop: 5, fontSize: 16 },
  card: { padding: 30 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 10 },
  infoText: { textAlign: "center", color: "#666", marginBottom: 30, fontSize: 14 },
  otpRow: { flexDirection: "row", justifyContent: "center", marginBottom: 30 },
  otpBox: { width: 45, height: 50, backgroundColor: "#f0f0f0", borderRadius: 4, textAlign: "center", fontSize: 20, fontWeight: "bold", marginHorizontal: 5 },
  focus: { borderColor: "#ff6600", borderWidth: 2 },
  btn: { borderRadius: 4, overflow: "hidden", marginBottom: 20 },
  gradientBtn: { padding: 18, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  resendText: { textAlign: "center", color: "#666", fontSize: 14 },
  resendLink: { color: "#ff6600", fontWeight: "bold" }
});
