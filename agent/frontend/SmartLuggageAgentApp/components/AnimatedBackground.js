// components/AnimatedBackground.js
import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../constants/colors';

const { width, height } = Dimensions.get('window');

const FloatingDot = ({ delay, size, startX, startY }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = () => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -30,
              duration: 3000,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.6,
              duration: 1500,
              delay,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 0,
              duration: 3000,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.3,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    };
    animate();
  }, []);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: startX,
          top: startY,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
};

export default function AnimatedBackground({ children }) {
  const gradientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: false,
        }),
        Animated.timing(gradientAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const dots = [
    { delay: 0, size: 8, startX: width * 0.1, startY: height * 0.2 },
    { delay: 500, size: 6, startX: width * 0.8, startY: height * 0.15 },
    { delay: 1000, size: 10, startX: width * 0.5, startY: height * 0.4 },
    { delay: 1500, size: 7, startX: width * 0.2, startY: height * 0.6 },
    { delay: 2000, size: 9, startX: width * 0.9, startY: height * 0.5 },
    { delay: 2500, size: 5, startX: width * 0.3, startY: height * 0.8 },
    { delay: 3000, size: 8, startX: width * 0.7, startY: height * 0.7 },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundSecondary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {dots.map((dot, index) => (
        <FloatingDot key={index} {...dot} />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  dot: {
    position: 'absolute',
    backgroundColor: Colors.primaryLight,
  },
});

