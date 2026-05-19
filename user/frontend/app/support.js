import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SmartLuggageSupport() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Navigation state engine: 'HOME' | 'BOOKING' | 'PICKUP_DELIVERY' | 'PAYMENTS' | 'ACCOUNT'
  const [currentView, setCurrentView] = useState('HOME');

  // Booking Simulation Flags
  const [agentAssigned, setAgentAssigned] = useState(false);
  const [bufferTimeExpired, setBufferTimeExpired] = useState(false);

  // Reusable Component: Premium Gradient Button Wrapper
  const GradientButton = ({ title, onPress, disabled }) => (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.8} 
      disabled={disabled}
      style={[styles.buttonWrapper, disabled && styles.disabledButton]}
    >
      <LinearGradient
        colors={disabled ? ['#e2e8f0', '#cbd5e1'] : ['#ff0033', '#ff6600']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientButtonFill}
      >
        <Text style={[styles.buttonText, disabled && styles.disabledButtonText]}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  // Reusable Component: Sub-screen Header Navigation Anchor
  const renderSubHeader = (title, backView = 'HOME') => (
    <LinearGradient
      colors={['#ff0033', '#ff6600']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.subHeaderContainer, { paddingTop: Platform.OS === 'ios' ? 54 : 44 }]}
    >
      <TouchableOpacity style={styles.headerBackButton} onPress={() => setCurrentView(backView)} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </TouchableOpacity>
      <Text style={styles.subHeaderTitle}>{title}</Text>
      <View style={styles.headerRightSpacer} />
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ==================================================== */}
      {/* VIEW PANEL 1: MAIN NAVIGATION ROOT (HOME)            */}
      {/* ==================================================== */}
      {currentView === 'HOME' && (
        <View style={styles.flexView}>
          <LinearGradient
            colors={['#ff0033', '#ff6600']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.mainHeader, { paddingTop: Platform.OS === 'ios' ? 54 : 44 }]}
          >
            <TouchableOpacity style={styles.headerIconBack} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.mainHeaderTitle}>Help & Support</Text>
            <View style={styles.headerRightSpacer} />
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* HERO BANNER CARD */}
            <LinearGradient
              colors={['#ff0033', '#ff6600']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBannerCard}
            >
              <View style={styles.heroIconCircle}>
                <Ionicons name="headset" size={28} color="#ffffff" />
              </View>
              <Text style={styles.heroHeading}>Need help with your luggage booking or delivery?</Text>
              <TouchableOpacity style={styles.heroBannerButton} activeOpacity={0.9} onPress={() => Alert.alert("Live Chat Support", "Connecting to a logistics agent...")}>
                <Text style={styles.heroBannerButtonText}>Contact Support</Text>
              </TouchableOpacity>
            </LinearGradient>

            <Text style={styles.sectionLabelTitle}>Support Categories</Text>

            {/* CATEGORY LIST ITEMS */}
            <TouchableOpacity style={styles.menuRowItemCard} onPress={() => setCurrentView('BOOKING')} activeOpacity={0.7}>
              <View style={styles.menuItemLeftFrame}>
                <View style={styles.menuIconBox}><Ionicons name="cube-outline" size={20} color="#ff0033" /></View>
                <View style={styles.menuItemTextFrame}>
                  <Text style={styles.menuItemTitle}>Booking Issues</Text>
                  <Text style={styles.menuItemSubtitle}>Unconfirmed slots and pickup updates</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRowItemCard} onPress={() => setCurrentView('PICKUP_DELIVERY')} activeOpacity={0.7}>
              <View style={styles.menuItemLeftFrame}>
                <View style={styles.menuIconBox}><Ionicons name="bicycle-outline" size={20} color="#ff0033" /></View>
                <View style={styles.menuItemTextFrame}>
                  <Text style={styles.menuItemTitle}>Pickup & Delivery</Text>
                  <Text style={styles.menuItemSubtitle}>Delays, tracking, unreachable runner</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRowItemCard} onPress={() => setCurrentView('PAYMENTS')} activeOpacity={0.7}>
              <View style={styles.menuItemLeftFrame}>
                <View style={styles.menuIconBox}><Ionicons name="card-outline" size={20} color="#ff0033" /></View>
                <View style={styles.menuItemTextFrame}>
                  <Text style={styles.menuItemTitle}>Payments & Refunds</Text>
                  <Text style={styles.menuItemSubtitle}>Failed transactions, invoices, accounting</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRowItemCard} onPress={() => setCurrentView('ACCOUNT')} activeOpacity={0.7}>
              <View style={styles.menuItemLeftFrame}>
                <View style={styles.menuIconBox}><Ionicons name="person-outline" size={20} color="#ff0033" /></View>
                <View style={styles.menuItemTextFrame}>
                  <Text style={styles.menuItemTitle}>Account & Profile</Text>
                  <Text style={styles.menuItemSubtitle}>Saved coordinates, privacy, profile details</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            {/* FOOTER */}
            <View style={styles.appSupportContactFooter}>
              <View style={styles.footerContactEmailLine}>
                <Ionicons name="mail" size={16} color="#ff0033" style={{ marginRight: 6 }} />
                <Text style={styles.supportEmailText}>support@smartluggage.com</Text>
              </View>
              <Text style={styles.supportTimeframeText}>Our support team usually responds within 24 hours.</Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* ==================================================== */}
      {/* VIEW PANEL 2: BOOKING ISSUES                         */}
      {/* ==================================================== */}
      {currentView === 'BOOKING' && (
        <View style={styles.flexView}>
          {renderSubHeader('Booking Issues')}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            <View style={styles.issueResolutionCard}>
              <Text style={styles.issueTitleText}>Booking not confirmed</Text>
              <Text style={styles.issueDescriptionBody}>
                Your booking may remain unconfirmed due to payment verification or agent availability.
              </Text>
              <GradientButton title="Retry Booking" onPress={() => Alert.alert("Success", "Booking retry requested.")} />
            </View>

            <View style={styles.issueResolutionCard}>
              <Text style={styles.issueTitleText}>Change Pickup Address</Text>
              <Text style={styles.issueDescriptionBody}>
                Pickup address can be modified within 5 minutes of booking before agent assignment.
              </Text>

              <View style={styles.realtimeStateAuditFrame}>
                <TouchableOpacity style={styles.auditTogglePill} onPress={() => setAgentAssigned(!agentAssigned)} activeOpacity={0.8}>
                  <Text style={styles.auditToggleText}>Agent Assigned: {agentAssigned ? "YES" : "NO"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.auditTogglePill} onPress={() => setBufferTimeExpired(!bufferTimeExpired)} activeOpacity={0.8}>
                  <Text style={styles.auditToggleText}>5 Mins Passed: {bufferTimeExpired ? "YES" : "NO"}</Text>
                </TouchableOpacity>
              </View>

              {(agentAssigned || bufferTimeExpired) ? (
                <View style={styles.warningAlertBannerContainer}>
                  <Ionicons name="lock-closed" size={16} color="#ff0033" style={{ marginRight: 6 }} />
                  <Text style={styles.warningAlertText}>Address modification unavailable.</Text>
                </View>
              ) : (
                <GradientButton title="Change Address" onPress={() => Alert.alert("Address", "Change Address screen requested.")} />
              )}
            </View>

          </ScrollView>
        </View>
      )}

      {/* ==================================================== */}
      {/* VIEW PANEL 3: PICKUP & DELIVERY                     */}
      {/* ==================================================== */}
      {currentView === 'PICKUP_DELIVERY' && (
        <View style={styles.flexView}>
          {renderSubHeader('Pickup & Delivery')}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            <View style={styles.issueResolutionCard}>
              <Text style={styles.issueTitleText}>Pickup Delayed</Text>
              <Text style={styles.issueDescriptionBody}>
                Pickup may be delayed due to traffic or agent availability.
              </Text>
              <View style={styles.etaDataTelemetryBadge}>
                <Text style={styles.etaLabelText}>Estimated Delay:</Text>
                <Text style={styles.etaTimeValueText}>15–20 mins</Text>
              </View>
              <View style={styles.dualActionButtonsRow}>
                <View style={{ flex: 1 }}>
                  <GradientButton title="Track Agent" onPress={() => Alert.alert("Tracking", "Opening map status...")} />
                </View>
                <View style={{ flex: 1 }}>
                  <GradientButton title="Contact Support" onPress={() => Alert.alert("Support", "Calling agent helpdesk...")} />
                </View>
              </View>
            </View>

            <View style={styles.issueResolutionCard}>
              <Text style={styles.issueTitleText}>Luggage Not Delivered</Text>
              <Text style={styles.issueDescriptionBody}>
                If your luggage has not arrived after the estimated delivery time, please contact support.
              </Text>
              <GradientButton title="Raise Support Request" onPress={() => Alert.alert("Ticket Raised", "Support ticket opened.")} />
            </View>

            <View style={styles.issueResolutionCard}>
              <Text style={styles.issueTitleText}>Agent Not Reachable</Text>
              <Text style={styles.issueDescriptionBody}>
                If the assigned agent is unreachable, our support team can assist you.
              </Text>
              <GradientButton title="Contact Support" onPress={() => Alert.alert("Calling Support", "Connecting to agent manager...")} />
            </View>
          </ScrollView>
        </View>
      )}

      {/* ==================================================== */}
      {/* VIEW PANEL 4: PAYMENTS & REFUNDS                     */}
      {/* ==================================================== */}
      {currentView === 'PAYMENTS' && (
        <View style={styles.flexView}>
          {renderSubHeader('Payments & Refunds')}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.issueResolutionCard}>
              <Text style={styles.issueTitleText}>Payment Failed</Text>
              <Text style={styles.issueDescriptionBody}>Your payment could not be completed due to network, bank issues, or timeout.</Text>
              <GradientButton title="Retry Payment" onPress={() => Alert.alert("Payment", "Launching payment flow...")} />
            </View>

            <View style={styles.issueResolutionCard}>
              <Text style={styles.issueTitleText}>Payment Deducted but Booking Failed</Text>
              <Text style={styles.issueDescriptionBody}>If money was deducted but booking failed, refunds are usually processed within 3–5 business days.</Text>
              <GradientButton title="Check Refund Status" onPress={() => Alert.alert("Refunds", "Checking processing logs...")} />
            </View>

            <View style={styles.issueResolutionCard}>
              <Text style={styles.issueTitleText}>Need Invoice</Text>
              <Text style={styles.issueDescriptionBody}>Download your booking invoice or payment receipt.</Text>
              <GradientButton title="Download Invoice" onPress={() => Alert.alert("Downloading", "Downloading receipt PDF...")} />
            </View>
          </ScrollView>
        </View>
      )}

      {/* ==================================================== */}
      {/* VIEW PANEL 5: ACCOUNT & PROFILE                     */}
      {/* ==================================================== */}
      {currentView === 'ACCOUNT' && (
        <View style={styles.flexView}>
          {renderSubHeader('Account & Profile')}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.profileRedirectGroupWrapper}>
              
              <TouchableOpacity style={styles.profileRedirectItemLineRow} onPress={() => router.push('editprofile')} activeOpacity={0.7}>
                <View style={styles.profileItemLeftContainer}>
                  <Ionicons name="person-circle-outline" size={20} color="#1c1f24" style={{ marginRight: 12 }} />
                  <Text style={styles.profileItemTitleText}>Edit Profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.profileRedirectItemLineRow} onPress={() => Alert.alert("Addresses", "Redirecting to Saved Addresses...")} activeOpacity={0.7}>
                <View style={styles.profileItemLeftContainer}>
                  <Ionicons name="map-outline" size={20} color="#1c1f24" style={{ marginRight: 12 }} />
                  <Text style={styles.profileItemTitleText}>Manage Saved Addresses</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.profileRedirectItemLineRow} onPress={() => Alert.alert(
                "Terms and Conditions", 
                "By using Smart Luggage services, you agree that your data is handled securely to facilitate courier assignment. Luggage transit updates, handling liabilities, and secure coordinate tracking adhere fully to our terms of operational safety and terminal handling procedures."
              )} activeOpacity={0.7}>
                <View style={styles.profileItemLeftContainer}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#1c1f24" style={{ marginRight: 12 }} />
                  <Text style={styles.profileItemTitleText}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.profileRedirectItemLineRow, { borderBottomWidth: 0 }]} onPress={() => Alert.alert("Delete", "Account scheduled for removal.")} activeOpacity={0.7}>
                <View style={styles.profileItemLeftContainer}>
                  <Ionicons name="trash-outline" size={20} color="#ff0033" style={{ marginRight: 12 }} />
                  <Text style={[styles.profileItemTitleText, { color: '#ff0033', fontWeight: '600' }]}>Delete Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ff0033" />
              </TouchableOpacity>

            </View>
          </ScrollView>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  flexView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  mainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerIconBack: {
    padding: 4,
  },
  mainHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerRightSpacer: {
    width: 32,
  },
  scrollContent: {
    padding: 20,
  },
  heroBannerCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
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
  heroHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 22,
    marginBottom: 16,
  },
  heroBannerButton: {
    backgroundColor: '#ffffff',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBannerButtonText: {
    color: '#ff0033',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionLabelTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  menuRowItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  menuItemLeftFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuItemTextFrame: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  appSupportContactFooter: {
    marginTop: 24,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footerContactEmailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  supportEmailText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  supportTimeframeText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  subHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerBackButton: {
    padding: 4,
  },
  subHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  issueResolutionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  issueTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  issueDescriptionBody: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 14,
  },
  buttonWrapper: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#ff0033',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  gradientButtonFill: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
  realtimeStateAuditFrame: {
    flexDirection: 'row',
    marginBottom: 14,
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  auditTogglePill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  auditToggleText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '700',
  },
  warningAlertBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fde2e4',
    padding: 12,
    borderRadius: 10,
  },
  warningAlertText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
    flex: 1,
  },
  etaDataTelemetryBadge: {
    backgroundColor: '#fff7f0',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  etaLabelText: {
    fontSize: 12,
    color: '#ea580c',
    fontWeight: '700',
  },
  etaTimeValueText: {
    fontSize: 13,
    color: '#ea580c',
    fontWeight: '800',
  },
  dualActionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  profileRedirectGroupWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  profileRedirectItemLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  profileItemLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileItemTitleText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
});