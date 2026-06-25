// components/FileUploadField.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/*
 Simple placeholder file upload component.
 - label: field name
 - file: object { name, sizeBytes } or null
 - onSimulateUpload: callback to set simulated file
 Replace the internals with expo-document-picker or expo-image-picker as needed.
*/
export default function FileUploadField({ label, file, onSimulateUpload }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={onSimulateUpload}>
          <Text style={styles.buttonText}>Upload</Text>
        </TouchableOpacity>
        <View style={styles.meta}>
          <Text style={styles.fileText}>{file ? file.name : 'No file selected'}</Text>
          {file ? <Text style={styles.fileSubText}>{(file.sizeBytes / 1024).toFixed(1)} KB</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10 },
  label: { color: '#fff', marginBottom: 6, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  button: {
    backgroundColor: '#c33b3b',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  meta: { marginLeft: 12 },
  fileText: { color: '#fff' },
  fileSubText: { color: '#ffdcdc', fontSize: 12 },
});

