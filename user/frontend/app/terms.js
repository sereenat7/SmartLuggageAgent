import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  LayoutAnimation,
  UIManager,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TERMS_SECTIONS = [
  {
    id: 1,
    title: 'Accurate Information',
    icon: 'information-circle-outline',
    content: 'Users must provide correct pickup, delivery, and contact details while booking luggage services. Incorrect information may cause delays or unsuccessful deliveries.',
  },
  {
    id: 2,
    title: 'Prohibited Items',
    icon: 'ban-outline',
    content: 'Users are strictly prohibited from carrying illegal, dangerous, flammable, or hazardous items inside the luggage. Smart Luggage reserves the right to reject such bookings.',
  },
  {
    id: 3,
    title: 'User Responsibility',
    icon: 'shield-checkmark-outline',
    content: 'Users are responsible for securely packing their luggage before pickup. Fragile or valuable items should be packed carefully.',
  },
  {
    id: 4,
    title: 'Booking & Cancellation',
    icon: 'calendar-outline',
    content: 'Bookings can be cancelled before the pickup process begins. Cancellation charges may apply after assignment.',
  },
  {
    id: 5,
    title: 'Delivery & Tracking',
    icon: 'location-outline',
    content: 'Delivery times shown in the application are estimated and may vary due to traffic or operational delays.',
  },
  {
    id: 6,
    title: 'Privacy & Security',
    icon: 'lock-closed-outline',
    content: 'User information and location data are used only for booking, tracking, and support purposes.',
  },
];

export default function TermsConditionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <View style={styles.container}>
      {/* Translucent status bar matching the top header gradient background color transition */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Top Gradient Header Area matching your Report screen layout */}
      <LinearGradient
        colors={['#ff0033', '#ff6600']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={26} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </LinearGradient>

      {/* Main Scrollable Body Panel */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Card Showcase Banner */}
        <LinearGradient
          colors={['#ff0033', '#ff6600']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featuredIntroCard}
        >
          <View style={styles.featuredIconContainer}>
            <Ionicons name="document-text" size={32} color="#ffffff" />
          </View>
          <Text style={styles.featuredTitle}>Terms of Service</Text>
          <Text style={styles.featuredSubtitle}>
            Please read the following terms carefully before using Smart Luggage services.
          </Text>
        </LinearGradient>

        {/* Accordion Cards Blocks */}
        {TERMS_SECTIONS.map((section) => {
          const isExpanded = expandedSection === section.id;
          
          return (
            <View key={section.id} style={[styles.cardContainer, isExpanded && styles.cardContainerActive]}>
              <TouchableOpacity
                style={[styles.cardHeader, isExpanded && styles.cardHeaderExpanded]}
                onPress={() => toggleSection(section.id)}
                activeOpacity={0.8}
              >
                <View style={styles.titleRow}>
                  <View style={[styles.iconWrapper, isExpanded ? styles.iconWrapperActive : styles.iconWrapperDefault]}>
                    <Ionicons 
                      name={section.icon} 
                      size={20} 
                      color={isExpanded ? '#ffffff' : '#ff0033'} 
                    />
                  </View>
                  <Text style={[styles.sectionTitle, isExpanded && styles.sectionTitleActive]}>
                    {section.title}
                  </Text>
                </View>
                <Ionicons 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={isExpanded ? "#ff0033" : "#8e8e93"} 
                />
              </TouchableOpacity>

              {/* Smooth text rollout wrapper panel */}
              {isExpanded && (
                <View style={styles.cardContent}>
                  <Text style={styles.contentText}>{section.content}</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Privacy Terms Disclaimer Context Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.agreementText}>
            By using Smart Luggage services, you agree to these terms and conditions.
          </Text>
          <Text style={styles.dateText}>Last Updated: May 2026</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  headerGradient: {
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerRightPlaceholder: {
    width: 34, 
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  featuredIntroCard: {
    borderRadius: 28,
    padding: 26,
    marginBottom: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#ff0033',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  featuredIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  featuredSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 22,
    fontWeight: '500',
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardContainerActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardHeaderExpanded: {
    backgroundColor: '#ffffff',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconWrapperDefault: {
    backgroundColor: '#fef2f2',
  },
  iconWrapperActive: {
    backgroundColor: '#ff0033',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  sectionTitleActive: {
    color: '#ff0033',
    fontWeight: '800',
  },
  cardContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 0,
    backgroundColor: '#fafbfc',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  contentText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 21,
    fontWeight: '500',
  },
  footerContainer: {
    marginTop: 28,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  agreementText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
});