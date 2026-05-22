import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import RNPickerSelect from 'react-native-picker-select';

export default function Report() {
  const router = useRouter();

  const [issueType, setIssueType] = useState(null);
  const [customIssue, setCustomIssue] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const issueOptions = [
    { label: 'Lost luggage', value: 'Lost luggage' },
    { label: 'Delayed pickup', value: 'Delayed pickup' },
    { label: 'Damaged luggage', value: 'Damaged luggage' },
    { label: 'Payment issue', value: 'Payment issue' },
    { label: 'App bug', value: 'App bug' },
    { label: 'Other', value: 'Other' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <LinearGradient
        colors={['#FF1F1F', '#FF8C00']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Report a Problem</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* TOP CARD */}
        <LinearGradient
          colors={['#FF3B2F', '#FF8C00']}
          style={styles.issueCard}
        >
          <Ionicons name="warning-outline" size={28} color="#fff" />
          <Text style={styles.issueTitle}>Report an Issue</Text>
          <Text style={styles.issueSub}>
            Help us improve our service by reporting any problems or concerns
          </Text>
        </LinearGradient>

        {/* DISCLAIMER */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>Disclaimer</Text>
          <Text style={styles.disclaimerText}>
            Please use this page to report a serious incident or problem only.
            For order related queries, please use our chat support or contact help center.
          </Text>
        </View>

        {/* FORM */}
        <View style={styles.form}>
          <Text style={styles.label}>How can we help you?</Text>
          <View style={styles.pickerWrapper}>
             <RNPickerSelect
              placeholder={{ label: 'Select an issue type', value: null, color: '#9CA3AF' }}
              onValueChange={(value) => setIssueType(value)}
              items={issueOptions}
              style={pickerSelectStyles}
              useNativeAndroidPickerStyle={false} // This ensures our custom styling works
              Icon={() => <Ionicons name="chevron-down" size={18} color="#9CA3AF" />}
            />
          </View>

          {/* Show this only if 'Other' is selected */}
          {issueType === 'Other' && (
            <TextInput
              placeholder="Specify the issue"
              style={[styles.input, { marginTop: 10 }]}
              value={customIssue}
              onChangeText={setCustomIssue}
            />
          )}

          <Text style={styles.label}>Name</Text>
          <TextInput
            placeholder="Enter your full name"
            style={styles.input}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="Enter your email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            placeholder="Enter your phone number"
            style={styles.input}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            placeholder="Describe the problem in detail..."
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            multiline={true}
            value={message}
            onChangeText={setMessage}
          />

          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  issueCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  issueTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
  },
  issueSub: {
    color: '#fff',
    marginTop: 5,
    fontSize: 13,
  },
  disclaimer: {
    backgroundColor: '#1F2937',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
  },
  disclaimerTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 5,
  },
  disclaimerText: {
    color: '#D1D5DB',
    fontSize: 13,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
  },
  label: {
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 10,
    color: '#374151',
  },
  pickerWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 46, // Matching the height of your TextInput
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 46, // Explicit height to match the picker
    color: '#374151',
  },
  button: {
    backgroundColor: '#FF4B2B',
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});

const pickerSelectStyles = {
  inputIOS: {
    fontSize: 14,
    paddingHorizontal: 12,
    color: '#374151',
    paddingRight: 30, // to ensure it doesn't overlap with the icon
  },
  inputAndroid: {
    fontSize: 14,
    paddingHorizontal: 12,
    color: '#374151',
    paddingRight: 30,
  },
  iconContainer: {
    top: 13,
    right: 12,
  },
};