// screens/NativeLandingScreen.js
// Mobile landing page matching the web design: dark hero, bold headline,
// Register / Login / Guest CTAs.
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LogoIcon from '../components/LogoIcon';

const { width: W } = Dimensions.get('window');
const PRIMARY = '#ff6600';
const BG      = '#FFFFFF';

export default function NativeLandingScreen({ navigation }) {
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY       = useRef(new Animated.Value(24)).current;
  const ctaOpacity  = useRef(new Animated.Value(0)).current;
  const ctaY        = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1, duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroY, {
          toValue: 0, duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1, duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaY, {
          toValue: 0, duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.navbar}>
          <View style={styles.navBrand}>
            <LogoIcon size={36} borderRadius={9} />
            <Text style={styles.navTitle}>Smart Luggage</Text>
          </View>
          <TouchableOpacity
            style={styles.navCta}
            onPress={() => navigation.navigate('Login', { showSignUp: true })}
            activeOpacity={0.85}
          >
            <Text style={styles.navCtaText}>Register as Agent</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroStrip} />

          <Animated.View
            style={[
              styles.badge,
              { opacity: heroOpacity, transform: [{ translateY: heroY }] },
            ]}
          >
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Official Agent Portal - Smart Luggage System</Text>
          </Animated.View>

          <Animated.View
            style={{ opacity: heroOpacity, transform: [{ translateY: heroY }] }}
          >
            <Text style={styles.heroLine}>Handle Luggage.</Text>
            <Text style={[styles.heroLine, styles.heroAccent]}>Build Trust.</Text>
            <Text style={styles.heroLine}>Earn Reliably.</Text>
          </Animated.View>

          <Animated.Text
            style={[
              styles.subCopy,
              { opacity: heroOpacity, transform: [{ translateY: heroY }] },
            ]}
          >
            Join a verified network of airline luggage agents. Manage pickups,
            deliveries, and digital check-ins through one secure, professional
            platform designed for field agents.
          </Animated.Text>

          <Animated.View
            style={[
              styles.pills,
              { opacity: heroOpacity, transform: [{ translateY: heroY }] },
            ]}
          >
            {[
              { icon: 'shield-checkmark-outline', label: 'KYC Verified' },
              { icon: 'briefcase-outline', label: 'Instant Tasks' },
              { icon: 'cash-outline', label: 'Fast Payouts' },
            ].map((p) => (
              <View key={p.label} style={styles.pill}>
                <Ionicons name={p.icon} size={13} color={PRIMARY} />
                <Text style={styles.pillText}>{p.label}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View
            style={[
              styles.ctas,
              { opacity: ctaOpacity, transform: [{ translateY: ctaY }] },
            ]}
          >
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Login', { showSignUp: true })}
              activeOpacity={0.85}
            >
              <Ionicons name="rocket-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Register as Agent</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Login', { showSignUp: false })}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Agent Login</Text>
              <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Guest')}
              activeOpacity={0.7}
            >
              <Text style={styles.guestLink}>Continue as Guest</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[
              styles.statsRow,
              { opacity: ctaOpacity },
            ]}
          >
            {[
              { value: '500+', label: 'Active Agents' },
              { value: '99%', label: 'Delivery Rate' },
              { value: '24/7', label: 'Support' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={styles.statDivider} />}
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  heroCard: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 102, 0, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 6,
  },
  heroStrip: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 7,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: PRIMARY,
  },

  // Nav
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navTitle: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  navCta: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232,82,26,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,82,26,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 7,
    marginTop: 28,
    marginBottom: 24,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  badgeText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '600',
  },

  // Hero
  heroLine: {
    fontSize: W < 380 ? 32 : 36,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -1,
    lineHeight: W < 380 ? 40 : 44,
  },
  heroAccent: {
    color: PRIMARY,
  },

  // Sub-copy
  subCopy: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 14,
    maxWidth: 340,
  },

  // Pills
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(232,82,26,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232,82,26,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    color: '#444444',
    fontSize: 12,
    fontWeight: '600',
  },

  // CTAs
  ctas: {
    marginTop: 28,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  secondaryBtnText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '600',
  },
  guestLink: {
    color: '#999999',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 4,
    textDecorationLine: 'underline',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#1A1A1A',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    color: '#999999',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
  },
});
