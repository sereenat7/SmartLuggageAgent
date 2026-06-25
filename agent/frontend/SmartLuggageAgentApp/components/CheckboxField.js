// components/CheckboxField.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/*
 Simple checkbox field.
 Props:
 - value (bool)
 - onValueChange
 - label (string)
*/
export default function CheckboxField({ value, onValueChange, label }) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onValueChange(!value)}>
      <View style={[styles.box, value ? styles.boxChecked : null]}>
        {value ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7f1a1a',
  },
  boxChecked: { backgroundColor: '#ff6b6b' },
  check: { color: '#fff', fontWeight: '700' },
  label: { color: '#fff', marginLeft: 10, flex: 1 },
});

