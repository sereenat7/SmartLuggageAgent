import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandGradient } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OvalHeaderBackground({ children, style }) {
  return (
    <View style={[styles.wrapper, style]}>
      <LinearGradient colors={BrandGradient} style={styles.gradient}>
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    overflow: 'hidden',        // ← this is the key, clips the curve cleanly
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  gradient: {
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
});

