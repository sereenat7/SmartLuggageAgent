// screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Dimensions,
  Platform,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../constants/colors';

import { API_URL } from '../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_SMALL_DEVICE = SCREEN_WIDTH < 380;

export default function ProfileScreen({ navigation, route }) {
  const { agentData, token } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [kycComponents, setKycComponents] = useState([]);
  const [kycFiles, setKycFiles] = useState([]);
  
  const [profileData, setProfileData] = useState({
    fullName: agentData?.fullName || agentData?.full_name || '',
    email: agentData?.email || '',
    phone: agentData?.phone || agentData?.mobile || '',
    dateOfBirth: agentData?.dateOfBirth || agentData?.date_of_birth || '',
    idNumber: agentData?.idNumber || agentData?.id_number || '',
    streetAddress: agentData?.streetAddress || agentData?.street_address || '',
    city: agentData?.city || '',
    state: agentData?.state || '',
    postalCode: agentData?.postalCode || agentData?.postal_code || '',
    bankAccountNumber: agentData?.bankAccountNumber || agentData?.account_number || '',
    emergencyContactName: agentData?.emergencyContactName || agentData?.emergency_name || '',
    emergencyContactPhone: agentData?.emergencyContactPhone || agentData?.emergency_phone || '',
  });

  const fetchProfile = async () => {
    if (!token) {
        // Only alert if we really expected a token (e.g. not a pure preview)
        // But for this app, token is required.
        console.log('ProfileScreen: No token found in params');
        return;
    }

    setLoading(true);
    try {
      console.log('ProfileScreen: Fetching from', `${API_URL}/api/kyc`);
      const resp = await fetch(`${API_URL}/api/kyc`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await resp.json();
      
      if (resp.ok && data.kyc) {
        console.log('ProfileScreen: Loaded data', data.kyc);
        const kyc = data.kyc;
        setProfileData({
          fullName: kyc.full_name || kyc.fullName || '',
          email: kyc.email || '',
          phone: kyc.phone || kyc.mobile || '',
          dateOfBirth: kyc.date_of_birth || kyc.dateOfBirth || '',
          idNumber: kyc.id_number || kyc.idNumber || '',
          streetAddress: kyc.street_address || kyc.streetAddress || '',
          city: kyc.city || '',
          state: kyc.state || '',
          postalCode: kyc.postal_code || kyc.postalCode || '',
          bankAccountNumber: kyc.account_number || kyc.bankAccountNumber || '',
          emergencyContactName: kyc.emergency_name || kyc.emergencyContactName || '',
          emergencyContactPhone: kyc.emergency_phone || kyc.emergencyContactPhone || '',
        });
        setKycComponents(Array.isArray(data.components) ? data.components : []);
        setKycFiles(Array.isArray(data.files) ? data.files : []);
      } else if (resp.ok && !data.kyc) {
        console.log('ProfileScreen: No KYC data yet for this agent');
        setKycComponents(Array.isArray(data.components) ? data.components : []);
        setKycFiles(Array.isArray(data.files) ? data.files : []);
      } else {
         console.log('ProfileScreen: Fetch failed', resp.status, data);
      }
    } catch (err) {
      console.error('Error fetching profile in ProfileScreen:', err);
      Alert.alert('Error', 'Failed to refresh profile data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch latest profile data on mount
  useEffect(() => {
    fetchProfile();
  }, [token]);

  const onRefresh = React.useCallback(() => {
    fetchProfile();
  }, [token]);

  const openKycStep = (startStep) => {
    navigation.navigate('KYCForm', {
      token,
      agentName: profileData.fullName,
      agentPhone: profileData.phone,
      userId: agentData?.id,
      startStep,
    });
  };


  const doLogout = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Landing' }] })
    );
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) doLogout();
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', onPress: doLogout, style: 'destructive' },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <LinearGradient
          colors={['#FF1F1F', '#FF8C00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.headerGradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={IS_SMALL_DEVICE ? 20 : 24} color={Colors.textWhite} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Profile</Text>
            <View style={styles.spacer} />
          </View>

          <View style={styles.topPanel}>
            <View style={styles.avatarSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profileData.fullName
                    ? profileData.fullName.split(' ').map(n => n[0]).join('')
                    : 'AG'}
                </Text>
              </View>
              <Text style={styles.agentName}>{profileData.fullName || 'Agent Name'}</Text>
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={16} color={Colors.textWhite} />
                <Text style={styles.agentPhone}>{profileData.phone || 'Phone Number'}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

      <ScrollView 
        style={styles.scrollContent} 
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      >
        <View style={styles.settingsSection}>
          <Text style={styles.sectionHeader}>ACCOUNT</Text>
          <View style={styles.listCard}>
            <SettingsRow
              icon="person-outline"
              title="Edit Profile"
              color="#4F46E5"
              background="#EEF2FF"
              onPress={() => openKycStep(0)}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon="create-outline"
              title="Complete Verification"
              color="#E11D48"
              background="#FFE4E6"
              onPress={() => openKycStep(0)}
            />
          </View>

          <View style={styles.savedAddressCard}>
            <Text style={styles.savedAddressLabel}>Saved Address</Text>
            <Text style={styles.savedAddressText} numberOfLines={2}>
              {profileData.streetAddress || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionHeader}>VERIFICATION</Text>
          <View style={styles.listCard}>
            <SettingsRow
              icon="document-text-outline"
              title="Documents"
              color="#10B981"
              background="#ECFDF5"
              onPress={() => openKycStep(1)}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon="home-outline"
              title="Address"
              color="#F59E0B"
              background="#FFF7ED"
              onPress={() => openKycStep(2)}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon="card-outline"
              title="Bank Details"
              color="#8B5CF6"
              background="#F5F3FF"
              onPress={() => openKycStep(4)}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon="people-outline"
              title="Emergency Contact"
              color="#DB2777"
              background="#FCE7F3"
              onPress={() => openKycStep(6)}
            />
          </View>
        </View>

        <View style={styles.spacerBottom} />
      </ScrollView>

      {/* Fixed Logout Button at bottom */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
    </SafeAreaView>
  );
}

function formatComponentName(key) {
  if (!key) return 'KYC Component';
  return key
    .replace(/^step\d+_/, '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatFieldName(field) {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  header: {
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: IS_SMALL_DEVICE ? 12 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 10,
    marginLeft: -4,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: IS_SMALL_DEVICE ? 20 : 24,
    color: Colors.textWhite,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: IS_SMALL_DEVICE ? 16 : 18,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  spacer: {
    width: 40,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: IS_SMALL_DEVICE ? 10 : 16,
    paddingBottom: 20,
  },
  topPanel: {
    paddingHorizontal: IS_SMALL_DEVICE ? 16 : 20,
    paddingBottom: 18,
  },
  settingsIntro: {
    marginBottom: 14,
  },
  settingsTag: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ff6600',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  settingsTitle: {
    fontSize: IS_SMALL_DEVICE ? 18 : 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  settingsSubtitle: {
    fontSize: IS_SMALL_DEVICE ? 12 : 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  settingsSection: {
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: IS_SMALL_DEVICE ? 12 : 13,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  listCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderRadius: 22,
    overflow: 'hidden',
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 74,
  },
  savedAddressCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  savedAddressLabel: {
    fontSize: IS_SMALL_DEVICE ? 11 : 12,
    color: Colors.textSecondary,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  savedAddressText: {
    fontSize: IS_SMALL_DEVICE ? 13 : 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  summaryLabel: {
    fontSize: IS_SMALL_DEVICE ? 12 : 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: IS_SMALL_DEVICE ? 12 : 13,
    color: Colors.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  settingsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingsRowTitle: {
    fontSize: IS_SMALL_DEVICE ? 13 : 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  avatar: {
    width: IS_SMALL_DEVICE ? 76 : 100,
    height: IS_SMALL_DEVICE ? 76 : 100,
    borderRadius: IS_SMALL_DEVICE ? 38 : 50,
    backgroundColor: Colors.buttonPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  avatarText: {
    color: Colors.textWhite,
    fontSize: IS_SMALL_DEVICE ? 24 : 32,
    fontWeight: '700',
  },
  agentName: {
    fontSize: IS_SMALL_DEVICE ? 18 : 20,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 4,
  },
  agentPhone: {
    fontSize: IS_SMALL_DEVICE ? 12 : 13,
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 8,
    marginLeft: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editProfileBtn: {
    backgroundColor: Colors.buttonPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  editProfileBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: IS_SMALL_DEVICE ? 12 : 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: IS_SMALL_DEVICE ? 14 : 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: IS_SMALL_DEVICE ? 11 : 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  value: {
    fontSize: IS_SMALL_DEVICE ? 13 : 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  logoutContainer: {
    paddingHorizontal: IS_SMALL_DEVICE ? 10 : 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    ...Platform.select({
      ios: {
        paddingBottom: 28,
      },
      android: {
        paddingBottom: 12,
      },
    }),
  },
  logoutButton: {
    backgroundColor: Colors.error,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 16,
  },
  spacerBottom: {
    height: 8,
  },
  componentBlock: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  componentTitle: {
    fontSize: IS_SMALL_DEVICE ? 13 : 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  componentRow: {
    marginBottom: 10,
  },
  componentField: {
    fontSize: IS_SMALL_DEVICE ? 11 : 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  componentValue: {
    fontSize: IS_SMALL_DEVICE ? 13 : 14,
    color: Colors.textPrimary,
  },
  componentEmpty: {
    fontSize: IS_SMALL_DEVICE ? 12 : 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});

function SettingsRow({ icon, title, color, background, onPress }) {
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.settingsIconWrap, { backgroundColor: background }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.settingsRowTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}
