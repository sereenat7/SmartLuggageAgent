import { useState } from "react";
import {
    Alert,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

import Checkbox from "expo-checkbox";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { router } from "expo-router";

export default function RegisterScreen() {
    const [agree, setAgree] = useState(false);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const [errors, setErrors] = useState({});
    const [focus, setFocus] = useState("");

    // Backend connection URL from .env file
    const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.104:5000'}/api/auth`;

    const handleRegister = async () => {
        let newErrors = {};

        // Validation Logic
        if (!name.trim()) newErrors.name = "Full Name is required";
        if (phone.length !== 10) newErrors.phone = "Enter valid 10-digit number";
        if (!email.trim()) newErrors.email = "Email is required";
        else if (!email.includes("@")) newErrors.email = "Enter a valid email address";
        
        if (password.length < 4) newErrors.password = "Minimum 4 characters required";
        if (password !== confirm) newErrors.confirm = "Passwords do not match";
        if (!agree) newErrors.agree = "Please accept Terms & Conditions";

        setErrors(newErrors);

        if (Object.keys(newErrors).length === 0) {
            Keyboard.dismiss();

            try {
                const response = await fetch(`${BASE_URL}/register`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: name.trim(),
                        phone: "+91" + phone,
                        email: email.trim(),
                        password: password
                    })
                });

                const data = await response.json();

                if (data.success) {
                    Alert.alert("Success", "Account created successfully!", [
                        {
                            text: "Login Now",
                            onPress: () => {
                                router.replace({
                                    pathname: "/(auth)/login",
                                    params: { phone: phone }
                                });
                            }
                        }
                    ]);
                } else {
                    Alert.alert("Registration Failed", data.message || "Something went wrong");
                }
            } catch (error) {
                console.error("Register Error:", error);
                Alert.alert("Server Error", "Unable to connect to the server. Check your IP and connection.");
            }
        }
    };

    return (
        <KeyboardAwareScrollView
            style={styles.mainContainer}
            enableOnAndroid={true}
            extraScrollHeight={20}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
        >
            <View style={styles.container}>
                <LinearGradient colors={["#ff0033", "#ff6600"]} style={styles.header}>
                    <Text style={styles.appName}>Smart Luggage</Text>
                    <Text style={styles.appSub}>Create your account</Text>
                </LinearGradient>

                <View style={styles.card}>
                    <Text style={styles.title}>Register</Text>
                    <Text style={styles.subtitle}>Fill details to create account</Text>

                    {/* Name Input */}
                    <Text style={styles.label}>Full Name <Text style={styles.star}>*</Text></Text>
                    <TextInput
                        placeholder="Enter your full name"
                        style={[styles.input, focus === "name" && styles.focus]}
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            if (text.trim() !== "") setErrors(prev => ({ ...prev, name: null }));
                        }}
                        onFocus={() => setFocus("name")}
                        onBlur={() => setFocus("")}
                    />
                    {errors.name && <Text style={styles.error}>{errors.name}</Text>}

                    {/* Phone Input */}
                    <Text style={styles.label}>Phone Number <Text style={styles.star}>*</Text></Text>
                    <View style={styles.phoneRow}>
                        <Text style={styles.code}>+91</Text>
                        <TextInput
                            placeholder="Enter phone number"
                            keyboardType="numeric"
                            maxLength={10}
                            style={[styles.phoneInput, focus === "phone" && styles.focus]}
                            value={phone}
                            onChangeText={(text) => {
                                setPhone(text);
                                if (text.length === 10) setErrors(prev => ({ ...prev, phone: null }));
                            }}
                            onFocus={() => setFocus("phone")}
                            onBlur={() => setFocus("")}
                        />
                    </View>
                    {errors.phone && <Text style={styles.error}>{errors.phone}</Text>}

                    {/* Email Input */}
                    <Text style={styles.label}>Email <Text style={styles.star}>*</Text></Text>
                    <TextInput
                        placeholder="Enter email address"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={[styles.input, focus === "email" && styles.focus]}
                        value={email}
                        onChangeText={(text) => {
                            setEmail(text);
                            if (text.trim() !== "") setErrors(prev => ({ ...prev, email: null }));
                        }}
                        onFocus={() => setFocus("email")}
                        onBlur={() => setFocus("")}
                    />
                    {errors.email && <Text style={styles.error}>{errors.email}</Text>}

                    {/* Password Input */}
                    <Text style={styles.label}>Password <Text style={styles.star}>*</Text></Text>
                    <TextInput
                        placeholder="Create password"
                        secureTextEntry
                        style={[styles.input, focus === "pass" && styles.focus]}
                        value={password}
                        onChangeText={(text) => {
                            setPassword(text);
                            if (text.length >= 4) setErrors(prev => ({ ...prev, password: null }));
                        }}
                        onFocus={() => setFocus("pass")}
                        onBlur={() => setFocus("")}
                    />

                    {/* Confirm Password */}
                    <Text style={styles.label}>Confirm Password <Text style={styles.star}>*</Text></Text>
                    <TextInput
                        placeholder="Re-enter password"
                        secureTextEntry
                        style={[styles.input, focus === "confirm" && styles.focus]}
                        value={confirm}
                        onChangeText={(text) => {
                            setConfirm(text);
                            if (text === password) setErrors(prev => ({ ...prev, confirm: null }));
                        }}
                        onFocus={() => setFocus("confirm")}
                        onBlur={() => setFocus("")}
                    />
                    {errors.confirm && <Text style={styles.error}>{errors.confirm}</Text>}

                    {/* Terms Checkbox */}
                    <View style={styles.termsRow}>
                        <Checkbox
                            value={agree}
                            onValueChange={(value) => {
                                setAgree(value);
                                if (value) setErrors(prev => ({ ...prev, agree: null }));
                            }}
                            color={agree ? "#ff6600" : undefined}
                        />
                        <Text style={styles.termsText}>
                            I agree to Smart Luggage <Text style={styles.link}>Terms & Conditions</Text>
                        </Text>
                    </View>
                    {errors.agree && <Text style={styles.error}>{errors.agree}</Text>}

                    {/* Submit Button */}
                    <TouchableOpacity style={styles.btn} onPress={handleRegister}>
                        <LinearGradient colors={["#ff0033", "#ff6600"]} style={styles.gradientBtn}>
                            <Text style={styles.btnText}>Create Account</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                        <Text style={styles.bottomText}>
                            Already have an account? <Text style={styles.link}>Login</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAwareScrollView>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: "#f5f6fa" },
    container: { flex: 1, backgroundColor: "#f5f6fa" },
    header: { height: 220, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, alignItems: "center", justifyContent: "center" },
    appName: { color: "#fff", fontSize: 26, fontWeight: "bold" },
    appSub: { color: "#fff", fontSize: 14, marginTop: 5 },
    card: { padding: 20 },
    title: { fontSize: 26, fontWeight: "bold" },
    subtitle: { color: "gray", marginBottom: 10, marginTop: 4 },
    label: { fontSize: 14, fontWeight: "600", marginBottom: 5, marginTop: 6 },
    star: { color: "red", fontWeight: "normal" },
    input: { backgroundColor: "#eee", padding: 13, borderRadius: 10, borderWidth: 1, borderColor: "#eee" },
    focus: { borderColor: "#ff6600", borderWidth: 2 },
    phoneRow: { flexDirection: "row", alignItems: "center" },
    code: { backgroundColor: "#eee", padding: 13, borderRadius: 10, marginRight: 10, fontWeight: "600" },
    phoneInput: { backgroundColor: "#eee", flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: "#eee" },
    termsRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
    termsText: { marginLeft: 8, fontSize: 14, color: "#444", flex: 1 },
    link: { color: "#ff6600", fontWeight: "bold" },
    error: { color: "red", fontSize: 12, marginTop: 3 },
    btn: { marginTop: 18, borderRadius: 30, overflow: "hidden" },
    gradientBtn: { padding: 15, alignItems: "center" },
    btnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
    bottomText: { textAlign: "center", marginTop: 15, color: "gray" }
});