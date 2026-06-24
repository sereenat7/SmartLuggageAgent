// components/LogoIcon.js
// Uses the exact Logo.png from assets — no custom drawing.
import React from 'react';
import { Image, StyleSheet } from 'react-native';

const LOGO = require('../assets/Logo.png');

export default function LogoIcon({ size = 44, borderRadius = 12 }) {
  return (
    <Image
      source={LOGO}
      style={[
        styles.img,
        { width: size, height: size, borderRadius },
      ]}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  img: {
    overflow: 'hidden',
  },
});
