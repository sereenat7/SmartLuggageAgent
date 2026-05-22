// NativeSplashScreen.js
// Pure React Native animated splash — mirrors the web CSS splash exactly.
// Sequence:
//   0.2s  ring pops in (scale 0→1, spring)
//   0.5s  spinner arc starts rotating (loop)
//   0.9s  wordmark fades up
//   1.1s  progress bar wrapper fades up
//   1.3s  progress bar fills 0→100% (1.6s)
//   3.0s  entire screen slides up and out (0.7s)
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
} from 'react-native';
import LogoIcon from './components/LogoIcon';

const { width: W, height: H } = Dimensions.get('window');
const PRIMARY = '#ff6600';
const BG      = '#1A0D08';

export default function NativeSplashScreen({ onFinish }) {
  // Ring pop-in
  const ringScale   = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  // Spinner arc rotation
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Wordmark
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordY       = useRef(new Animated.Value(12)).current;

  // Progress bar wrapper
  const barWrapOpacity = useRef(new Animated.Value(0)).current;
  const barWrapY       = useRef(new Animated.Value(10)).current;

  // Progress bar fill (0 → W_bar width in px)
  const BAR_W = 160;
  const barFill = useRef(new Animated.Value(0)).current;

  // Fade-out at end
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Ring pops in at 200ms
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(ringScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 2. Spinner starts at 500ms (continuous loop)
    Animated.sequence([
      Animated.delay(500),
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]).start();

    // 3. Wordmark fades up at 900ms
    Animated.sequence([
      Animated.delay(900),
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wordY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 4. Bar wrapper fades up at 1100ms
    Animated.sequence([
      Animated.delay(1100),
      Animated.parallel([
        Animated.timing(barWrapOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(barWrapY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 5. Bar fills at 1300ms over 1600ms
    Animated.sequence([
      Animated.delay(1300),
      Animated.timing(barFill, {
        toValue: BAR_W,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false, // width can't use native driver
      }),
    ]).start();

    // 6. Fade out at 3000ms over 600ms then call onFinish
    Animated.sequence([
      Animated.delay(3000),
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 600,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onFinish) onFinish();
    });
  }, []);

  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>

      {/* Ring + Spinner */}
      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      >
        {/* Spinning arc — a circle with only the top border colored */}
        <Animated.View
          style={[
            styles.spinnerArc,
            { transform: [{ rotate: spinRotation }] },
          ]}
        />

        {/* Logo box */}
        <LogoIcon size={88} borderRadius={26} />
      </Animated.View>

      {/* Wordmark */}
      <Animated.View
        style={{
          opacity: wordOpacity,
          transform: [{ translateY: wordY }],
          alignItems: 'center',
          marginTop: 28,
        }}
      >
        <Text style={styles.wordmarkTitle}>Smart Luggage</Text>
        <Text style={styles.wordmarkSub}>AGENT PORTAL</Text>
      </Animated.View>

      {/* Progress bar */}
      <Animated.View
        style={[
          styles.barWrap,
          {
            opacity: barWrapOpacity,
            transform: [{ translateY: barWrapY }],
          },
        ]}
      >
        <Animated.View style={[styles.bar, { width: barFill }]} />
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: 'rgba(255,75,51,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerArc: {
    position: 'absolute',
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: PRIMARY,
    top: -7,
    left: -7,
  },
  wordmarkTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  wordmarkSub: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: PRIMARY,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  barWrap: {
    marginTop: 40,
    width: 160,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#E8521A',
    borderRadius: 2,
  },
});
