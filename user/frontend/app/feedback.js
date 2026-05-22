import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SmartLuggageFeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // State Hooks
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');

  const categories = [
    'App Experience',
    'Booking Experience',
    'Delivery Experience',
    'Payment Issue',
    'Suggestion',
    'Report Bug',
  ];

  const handleSubmit = () => {
    if (!selectedCategory) {
      Alert.alert('Selection Required', 'Please select a feedback topic.');
      return;
    }
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please pick a star rating.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Message Required', 'Please type a short description of your experience.');
      return;
    }

    Alert.alert(
      'Thank you!',
      'Your feedback helps us perfect our logistics experience.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ==================================================== */}
      {/* HEADER SECTION                                       */}
      {/* ==================================================== */}
      <LinearGradient
        colors={['#ff0033', '#ff6600']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerBar, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Send Feedback</Text>
        <View style={styles.headerRightSpacer} />
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* ==================================================== */}
          {/* HERO BANNER CARD (Matches Terms & Report layouts)     */}
          {/* ==================================================== */}
          <LinearGradient
            colors={['#ff0033', '#ff6600']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBannerCard}
          >
            <View style={styles.heroIconCircle}>
              <Ionicons name="chatbubble-ellipses" size={28} color="#ffffff" />
            </View>
            <Text style={styles.heroTitle}>Help us Improve</Text>
            <Text style={styles.heroSubtitle}>
              Share your thoughts to help us perfect our Smart Luggage logistics desk.
            </Text>
          </LinearGradient>

          {/* ==================================================== */}
          {/* SECTION 1 — SYMMETRICAL CATEGORY CHIPS               */}
          {/* ==================================================== */}
          <Text style={styles.sectionHeading}>What is your feedback about?</Text>
          <View style={styles.gridWrapper}>
            {categories.map((item) => {
              const isSelected = selectedCategory === item;
              return (
                <View key={item} style={styles.gridItemColumn}>
                  {isSelected ? (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedCategory(item)}>
                      <LinearGradient
                        colors={['#ff0033', '#ff6600']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.chipSelectedFill}
                      >
                        <Text style={styles.chipTextSelected}>{item}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setSelectedCategory(item)}
                      style={styles.chipDefaultBorder}
                    >
                      <Text style={styles.chipTextDefault}>{item}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* ==================================================== */}
          {/* SECTION 2 — RATING BOX                               */}
          {/* ==================================================== */}
          <View style={styles.cardContainer}>
            <Text style={styles.cardTitle}>How was your experience?</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  activeOpacity={0.6}
                  onPress={() => setRating(star)}
                  style={styles.starAnchor}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? '#ff6600' : '#cbd5e1'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ==================================================== */}
          {/* SECTION 3 — INPUT MESSAGE TEXTBOX                     */}
          {/* ==================================================== */}
          <View style={styles.cardContainer}>
            <Text style={styles.cardTitle}>Share your thoughts</Text>
            <TextInput
              style={styles.customTextArea}
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what went wrong or what we can improve..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={800}
            />
          </View>

          {/* ==================================================== */}
          {/* SECTION 4 — SUBMIT ACTION TRIGGER                     */}
          {/* ==================================================== */}
          <TouchableOpacity activeOpacity={0.8} onPress={handleSubmit} style={styles.submitContainer}>
            <LinearGradient
              colors={['#ff0033', '#ff6600']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradientFill}
            >
              <Text style={styles.submitText}>Submit Feedback</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Footer Branding text */}
          <Text style={styles.footerMicroText}>
            Your insights directly support our terminal engineering and local delivery lines.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backButton: {
    padding: 4,
  },
  headerBarTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerRightSpacer: {
    width: 32,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  /* Styled card layout matching image_30127a.jpg and image_332aad.jpg */
  heroBannerCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#ff0033',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  heroIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  /* Symmetrical Two-Column Grid Setup */
  gridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gridItemColumn: {
    width: '48.5%',
    marginBottom: 10,
  },
  chipDefaultBorder: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chipTextDefault: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipSelectedFill: {
    borderRadius: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  /* Card structures mirroring the main layout containers */
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c1f24',
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  starAnchor: {
    padding: 2,
  },
  customTextArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    height: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1c1f24',
  },
  /* Action button element layout tracking */
  submitContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#ff0033',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  submitGradientFill: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerMicroText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 24,
  },
});