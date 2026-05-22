import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { MotiView, MotiText } from 'moti';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Index() {
  const [animationFinished, setAnimationFinished] = useState(false);

  // Layout Constants - Scaled up for better visibility
  const HOUSE_POS = 50;
  const AIRPORT_POS = width - 90;
  const JOURNEY_DURATION = 2500; // Fast and snappy (2.5 seconds)

  return (
    <View style={styles.container}>
      
      {/* 1. App Name */}
      <MotiText 
        from={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={styles.appName}>
        Aero
      </MotiText>

      {/* 2. The Journey Animation Area */}
      <View style={styles.journeyContainer}>
        
        {/* House Icon - Increased size to 50 */}
        <MaterialCommunityIcons 
            name="home-variant-outline" 
            size={50} 
            color="#FF4B2B" 
            style={styles.houseIcon} 
        />

        {/* The Animated Path Line - Increased thickness to 4 */}
        <MotiView 
          from={{ width: 0 }}
          animate={{ width: AIRPORT_POS - HOUSE_POS }}
          transition={{ duration: JOURNEY_DURATION, type: 'timing' }}
          style={styles.pathLine}
        />

        {/* The Moving Luggage - Increased size to 40 */}
        <MotiView
          from={{ translateX: HOUSE_POS }}
          animate={{ translateX: AIRPORT_POS - 15 }}
          transition={{ duration: JOURNEY_DURATION, type: 'timing' }}
          onDidAnimate={(path, finished) => {
            if (finished) setAnimationFinished(true);
          }}
          style={styles.luggageWrapper}
        >
          <MaterialCommunityIcons name="bag-checked" size={40} color="#FF4B2B" />
        </MotiView>

        {/* The Airport Icon - Increased size to 60 */}
        <MotiView
          animate={{ 
            opacity: animationFinished ? 1 : 0.2,
            scale: animationFinished ? 1.15 : 1,
          }}
          style={[styles.airportIcon, animationFinished && styles.airportGlow]}
        >
          <MaterialCommunityIcons 
            name="airport" 
            size={60} 
            color={animationFinished ? "#FF4B2B" : "#FFFFFF"} 
          />
        </MotiView>
      </View>

      {/* 3. Bottom Button Area */}
      <MotiView
        from={{ opacity: 0, y: 30 }}
        animate={{ 
          opacity: animationFinished ? 1 : 0, 
          y: animationFinished ? 0 : 30 
        }}
        transition={{ type: 'spring' }}
        style={styles.buttonContainer}
      >
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.push("/(auth)/login")} 
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
        
        <Text style={styles.tagline}>Seamlessly from your door to the gate.</Text>
      </MotiView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 56, // Slightly larger logo
    fontWeight: 'bold',
    color: '#FF4B2B',
    position: 'absolute',
    top: 120,
    letterSpacing: 2,
  },
  journeyContainer: {
    width: '100%',
    height: 120, // Increased height for larger icons
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pathLine: {
    height: 4, // Thicker line to fill space
    backgroundColor: '#FF4B2B',
    position: 'absolute',
    left: 85, // Adjusted for larger home icon
    top: 60,
  },
  houseIcon: {
    position: 'absolute',
    left: 25,
    top: 35,
  },
  airportIcon: {
    position: 'absolute',
    right: 25,
    top: 25,
  },
  airportGlow: {
    shadowColor: '#FF4B2B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 15,
  },
  luggageWrapper: {
    position: 'absolute',
    top: 40,
    zIndex: 10,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 90,
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#FF4B2B',
    paddingVertical: 18,
    paddingHorizontal: 85,
    borderRadius: 40,
    shadowColor: '#FF4B2B',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 20, // Larger text for the button
    fontWeight: 'bold',
  },
  tagline: {
    color: '#666',
    marginTop: 20,
    fontSize: 14,
    fontStyle: 'italic',
  }
});