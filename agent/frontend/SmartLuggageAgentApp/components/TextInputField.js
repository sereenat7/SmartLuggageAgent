// components/TextInputField.js
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

/*
 Reusable text input with label.
 Props:
 - label (string)
 - value, onChangeText
 - placeholder
 - secureTextEntry (bool)
 - keyboardType (string)
*/
export default function TextInputField({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#ffecec"
        style={styles.input}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  label: { color: '#fff', marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#7f1a1a',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#9b2b2b',
  },
});

