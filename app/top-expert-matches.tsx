import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BaseText as Text } from '@/components/ui/Base';
import Colors from '@/constants/Colors';
import apiService, { MedicProfile } from '@/lib/services/ApiService';
import razorpayService from '@/lib/services/RazorpayService';
import { useAuth } from '@/lib/context/AuthContext';
import { useCreditStore } from '@/lib/services/CreditService';
import Gradients from '@/constants/Gradients';
import JoinGroupModal from '@/components/modals/group/JoinGroupModal';

const { width: screenWidth } = Dimensions.get('window');

interface TherapistMatch {
  medic: {
    id: number;
    name: string;
    raw_name: string;
    title: string;
    designation: string;
    bio: string;
    years_of_experience: number;
    field_of_expertise: string;
    one_on_one_price: number;
    one_on_one_price_3_months: number;
    max_one_on_one_chats: number;
    available_slots: number;
    profile_picture_url: string | null;
    modalities: Array<{ id: number; name: string; description: string }>;
  };
  match_percentage: number;
  match_text: string;
  top_matching_traits: string[];
  existing_group_firebase_uid?: string | null;
}

// Match percentage to emoji mapping
const getMatchEmoji = (percentage: number): string => {
  if (percentage >= 95) return '\u{1F497}'; // 💗
  if (percentage >= 90) return '\u{1F970}'; // 🥰
  if (percentage >= 80) return '\u{1F60A}'; // 😊
  return '\u{1F610}'; // 😐
};

export default function TopExpertMatchesScreen() {
  const router = useRouter();
  const { backendUser } = useAuth();
  const { creditBalance } = useCreditStore();
  const [matches, setMatches] = useState<TherapistMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soulProfileSummary, setSoulProfileSummary] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [userMatchesCount, setUserMatchesCount] = useState<number>(0);

  // 1:1 chat modal state
  const [oneOnOneModalVisible, setOneOnOneModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<TherapistMatch | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch therapist matches and soul profile in parallel
      const [matchesResponse, userResponse] = await Promise.all([
        apiService.getTherapistMatches(2), // Get top 2 matches
        apiService.getCurrentUser(),
      ]);

      if (matchesResponse.success && matchesResponse.data) {
        // Sort by match_percentage descending
        const sortedMatches = [...(matchesResponse.data.matches || [])].sort(
          (a, b) => (b.match_percentage || 0) - (a.match_percentage || 0)
        );
        setMatches(sortedMatches);
        setUserMatchesCount(matchesResponse.data.user_matches_count || 0);
      } else {
        console.error('[TopExpertMatches] Failed to fetch matches:', matchesResponse.error);
      }

      // Get soul profile summary from user data
      if (userResponse.success && userResponse.data?.soul_profile?.summary) {
        setSoulProfileSummary(userResponse.data.soul_profile.summary);
      }
    } catch (err) {
      console.error('[TopExpertMatches] Error fetching data:', err);
      setError('Failed to load matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleChat = (match: TherapistMatch) => {
    // If user already has an existing 1:1 group with this medic, navigate directly to chat
    if (match.existing_group_firebase_uid) {
      // Replace current screen so back button goes to Zora chat, not this screen
      router.replace({
        pathname: '/chat-detail',
        params: { groupId: match.existing_group_firebase_uid }
      });
      return;
    }

    // Otherwise, show the join modal
    setSelectedMatch(match);
    setOneOnOneModalVisible(true);
  };

  const handleOneOnOneSuccess = (firebaseUid: string) => {
    setOneOnOneModalVisible(false);
    setSelectedMatch(null);
    // Navigate to the chat - replace so back button goes to Zora chat, not this screen
    router.replace({
      pathname: '/chat-detail',
      params: { groupId: firebaseUid }
    });
  };

  // Convert TherapistMatch medic to MedicProfile format
  const getMedicProfile = (match: TherapistMatch): MedicProfile => ({
    id: match.medic.id,
    name: match.medic.name,
    raw_name: match.medic.raw_name,
    title: match.medic.title,
    designation: match.medic.designation,
    bio: match.medic.bio,
    years_of_experience: match.medic.years_of_experience,
    field_of_expertise: match.medic.field_of_expertise,
    one_on_one_price: match.medic.one_on_one_price,
    one_on_one_price_3_months: match.medic.one_on_one_price_3_months,
    max_one_on_one_chats: match.medic.max_one_on_one_chats,
    recent_one_on_one_count: match.medic.max_one_on_one_chats - match.medic.available_slots,
    available_slots: match.medic.available_slots,
    profile_picture_url: match.medic.profile_picture_url || undefined,
  });

  const handleViewMoreMatches = () => {
    router.push('/top-user-matches');
  };

  const handleExploreMoreChats = () => {
    // Navigate back to tabs and switch to explore tab
    // Using dismissAll + replace ensures clean navigation state
    router.dismissAll();
    router.replace('/(tabs)/explore');
  };

  const handleDownloadProfile = async () => {
    if (isProcessingPayment) return;

    try {
      setIsProcessingPayment(true);

      // Check if user has already paid for the report
      const statusResponse = await apiService.getSoulProfileReportStatus();

      if (!statusResponse.success) {
        Alert.alert('Error', statusResponse.error || 'Failed to check report status');
        return;
      }

      const { has_paid, report_fee, latest_report } = statusResponse.data;

      // If user has already paid, just trigger regeneration/get the report
      if (has_paid) {
        // If there's already a completed report for current profile, open the PDF
        if (latest_report?.status === 'completed' && latest_report?.pdf_url) {
          await Linking.openURL(latest_report.pdf_url);
          return;
        }

        // Trigger regeneration for already paid user
        const purchaseResponse = await apiService.purchaseSoulProfileReport();
        if (purchaseResponse.success) {
          Alert.alert(
            'Generating Report',
            'Your Soul Profile Report is being generated. You will receive a message in Zora chat when it is ready.',
            [
              {
                text: 'Go to Zora Chat',
                onPress: () => router.back(),
              },
            ]
          );
        } else {
          Alert.alert('Error', purchaseResponse.error || 'Failed to generate report');
        }
        return;
      }

      // New purchase flow
      const creditsToUse = Math.min(creditBalance, report_fee);
      const paymentAmount = Math.max(0, report_fee - creditsToUse);

      // Create order
      const orderResponse = await apiService.createSoulProfileReportOrder(creditsToUse);

      if (!orderResponse.success) {
        Alert.alert('Error', orderResponse.error || 'Failed to create order');
        return;
      }

      // If fully covered by credits, skip payment
      if (orderResponse.data.skip_payment) {
        const purchaseResponse = await apiService.purchaseSoulProfileReport(undefined, creditsToUse);
        if (purchaseResponse.success) {
          Alert.alert(
            'Success',
            'Your Soul Profile Report is being generated using your credits. You will receive a message in Zora chat when it is ready.',
            [
              {
                text: 'Go to Chat',
                onPress: () => router.back(),
              },
            ]
          );
        } else {
          Alert.alert('Error', purchaseResponse.error || 'Failed to process purchase');
        }
        return;
      }

      // Process Razorpay payment
      const paymentResult = await razorpayService.processPayment(
        orderResponse.data.payment_amount,
        'Soul Profile Report',
        backendUser?.email || '',
        backendUser?.mobile || '',
        backendUser?.userprofile?.name || 'User',
        orderResponse.data.order_id
      );

      if (!paymentResult.success) {
        if (paymentResult.error !== 'Payment was cancelled') {
          Alert.alert('Payment Failed', paymentResult.error || 'Payment could not be completed');
        }
        return;
      }

      // Complete purchase
      const purchaseResponse = await apiService.purchaseSoulProfileReport(
        paymentResult.paymentId,
        creditsToUse
      );

      if (purchaseResponse.success) {
        Alert.alert(
          'Payment Successful',
          'Your Soul Profile Report is being generated. You will receive a message in Zora chat when it is ready.',
          [
            {
              text: 'Go to Chat',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Error', purchaseResponse.error || 'Failed to process purchase');
      }
    } catch (err) {
      console.error('[TopExpertMatches] Error in handleDownloadProfile:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const truncateSummary = (summary: string, maxLength: number = 150): string => {
    if (summary.length <= maxLength) return summary;
    return summary.substring(0, maxLength) + '...(continued in Zora Chat)';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your matches...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={Gradients.vibrant.colors}
      locations={Gradients.vibrant.locations}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Top Expert Matches</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Matches List */}
          <View style={styles.matchesContainer}>
            {matches.map((match, index) => (
              <TherapistMatchCard
                key={match.medic.id}
                match={match}
                onChat={() => handleChat(match)}
              />
            ))}

            {matches.length === 0 && !error && (
              <View style={styles.noMatchesContainer}>
                <Text style={styles.noMatchesText}>
                  No matches available yet. Please complete your soul profile.
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={fetchData} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* User Matches Count Button */}
          <TouchableOpacity
            style={styles.userMatchesButton}
            onPress={handleViewMoreMatches}
          >
            <Text style={styles.userMatchesText}>
              You have {userMatchesCount} user matches
            </Text>
          </TouchableOpacity>

          {/* Soul Profile Section */}
          <View style={styles.soulProfileSection}>
            <Text style={styles.soulProfileTitle}>
              Your <Text style={styles.soulText}>Soul</Text> Profile
            </Text>

            {soulProfileSummary ? (
              <Text style={styles.soulProfileSummary}>
                Summary: {truncateSummary(soulProfileSummary)}
              </Text>
            ) : (
              <Text style={styles.soulProfileSummary}>
                Your soul profile summary will appear here.
              </Text>
            )}

            <Text style={styles.soulProfileSummary}>
              You can download a detailed version here that reflects your scores
            </Text>

            <TouchableOpacity
              onPress={handleDownloadProfile}
              activeOpacity={0.85}
              style={styles.downloadButtonWrapper}
              disabled={isProcessingPayment}
            >
              <LinearGradient
                colors={Gradients.vibrant.colors}
                style={[styles.downloadButton, isProcessingPayment && styles.downloadButtonDisabled]}
                locations={Gradients.vibrant.locations}
              >
                {isProcessingPayment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.downloadButtonText}>
                    Download Complete Soul Profile
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* User Matches Count Button */}
            <TouchableOpacity
              style={styles.userMatchesButton}
              onPress={handleExploreMoreChats}
            >
              <Text style={styles.userMatchesText}>
                Explore more chats here
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Join One-on-One Modal */}
        {selectedMatch && (
          <JoinGroupModal
            visible={oneOnOneModalVisible}
            onClose={() => {
              setOneOnOneModalVisible(false);
              setSelectedMatch(null);
            }}
            isOneOnOne={true}
            medic={getMedicProfile(selectedMatch)}
            matchText={selectedMatch.match_text}
            onOneOnOneSuccess={handleOneOnOneSuccess}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// Therapist Match Card Component
interface TherapistMatchCardProps {
  match: TherapistMatch;
  onChat: () => void;
}

function TherapistMatchCard({ match, onChat }: TherapistMatchCardProps) {
  const { medic, match_percentage, match_text } = match;
  const emoji = getMatchEmoji(match_percentage);

  // Check if slots are available (or if user already has existing chat)
  const hasExistingChat = !!match.existing_group_firebase_uid;
  const slotsAvailable = medic.available_slots > 0 || hasExistingChat;

  return (
    <View style={styles.matchCard}>
      {/* Match Percentage Badge */}
      <View style={styles.matchBadge}>
        <Text style={styles.matchBadgeText}>
          {emoji} {match_percentage}% Match
        </Text>
      </View>

      <View style={styles.matchCardContent}>
        {/* Profile Image */}
        <TouchableOpacity style={styles.profileImageContainer} onPress={onChat}>
          {medic.profile_picture_url ? (
            <Image
              source={{ uri: medic.profile_picture_url }}
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
              <Ionicons name="person" size={40} color="#999" />
            </View>
          )}
          {/* Info Button */}
          <View style={styles.infoButton}>
            <Ionicons name="information-circle-outline" size={24} color={Colors.black} />
          </View>
        </TouchableOpacity>

        {/* Details */}
        <View style={styles.matchDetails}>
          <Text style={styles.medicName}>{medic.raw_name}</Text>
          <Text style={styles.medicDesignation}>{medic.designation}</Text>

          {/* Match Text Box */}
          <View style={styles.matchTextBox}>
            <Text style={styles.matchTextContent}>{match_text}</Text>
          </View>

          {/* Chat Button */}
          <TouchableOpacity
            style={[styles.chatButton, !slotsAvailable && styles.chatButtonDisabled]}
            onPress={slotsAvailable ? onChat : undefined}
            activeOpacity={slotsAvailable ? 0.7 : 1}
            disabled={!slotsAvailable}
          >
            <Text style={styles.chatButtonText}>Chat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.secondaryText,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  matchesContainer: {
    paddingHorizontal: 20,
  },
  matchCard: {
    marginBottom: 20,
  },
  matchBadge: {
    backgroundColor: Colors.primaryText,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: -15,
    marginLeft: -80,
    zIndex: 1,
  },
  matchBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  matchCardContent: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: screenWidth * 0.4,
    height: screenWidth * 0.55,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  profileImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButton: {
    position: 'absolute',
    top: 20,
    right: 5,
    borderRadius: 12,
    padding: 2,
  },
  matchDetails: {
    flex: 1,
    paddingLeft: 12,
    paddingTop: 20
  },
  medicName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  medicDesignation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  matchTextBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  matchTextContent: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  chatButton: {
    backgroundColor: Colors.black,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chatButtonDisabled: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  chatButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  noMatchesContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noMatchesText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  userMatchesButton: {
    backgroundColor: Colors.black,
    marginHorizontal: 40,
    marginVertical: 20,
    paddingVertical: 11,
    borderRadius: 25,
    alignItems: 'center',
  },
  userMatchesText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  soulProfileSection: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  soulProfileTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 12,
  },
  soulText: {
    color: Colors.primary, // Gold/yellow color for "Soul"
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  soulProfileSummary: {
    fontSize: 14,
    color: Colors.white,
    lineHeight: 20,
    marginBottom: 12,
  },
  downloadButtonWrapper: {
    // Drop shadow for iOS and Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 10,
    marginHorizontal: 20
  },
  downloadButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
