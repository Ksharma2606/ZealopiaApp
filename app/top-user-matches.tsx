import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BaseText as Text } from '@/components/ui/Base';
import Colors from '@/constants/Colors';
import Gradients from '@/constants/Gradients';
import apiService, { UserMatch } from '@/lib/services/ApiService';
import { useAuth } from '@/lib/context/AuthContext';
import { getAvatarImage } from '@/lib/utils/avatarHelper';
import { Header } from '@/app/(tabs)/_layout';

// Match percentage to emoji mapping
const getMatchEmoji = (percentage: number): string => {
  if (percentage >= 95) return '\u{1F497}'; // 💗
  if (percentage >= 90) return '\u{1F970}'; // 🥰
  if (percentage >= 80) return '\u{1F60A}'; // 😊
  return '\u{1F610}'; // 😐
};

export default function TopMatchesTab() {
  const { backendUser, refreshUserDataSilently } = useAuth();
  const [matches, setMatches] = useState<UserMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInterestedLoading, setIsInterestedLoading] = useState(false);
  const [isInterested, setIsInterested] = useState(false);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadData();
    // Check if user has already expressed interest
    if (backendUser?.user_profile?.interested_in_user_chat) {
      setIsInterested(true);
    }
  }, [backendUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getTopUserMatches(10);
      if (response.success && response.data) {
        setMatches(response.data.matches || []);
      } else {
        setError(response.error || 'Failed to load matches');
      }
    } catch (err) {
      console.error('[TopMatches] Error loading data:', err);
      setError('Failed to load matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleBack = () => {
    router.back();
  };

  const handleInterestedPress = async () => {
    if (isInterested || isInterestedLoading) return;

    try {
      setIsInterestedLoading(true);
      const response = await apiService.expressInterestInUserChat();

      if (response.success) {
        setIsInterested(true);
        Alert.alert(
          'Interest Recorded',
          "Thank you for your interest! We'll notify you when user chat becomes available.",
          [{ text: 'OK' }]
        );
        // Refresh user data to update the flag
        await refreshUserDataSilently();
      } else {
        Alert.alert('Error', response.error || 'Failed to record your interest. Please try again.');
      }
    } catch (err) {
      console.error('[TopMatches] Error expressing interest:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsInterestedLoading(false);
    }
  };

  const renderMatchCard = (match: UserMatch, index: number) => {
    const isGradient = index < 2;
    const emoji = getMatchEmoji(match.match_percentage);
    const avatarSource = getAvatarImage(match.pronouns, match.orientation);

    const cardContent = (
      <View style={styles.cardContent}>
        <View style={styles.avatarContainer}>
          <Image source={avatarSource} style={styles.avatar} />
        </View>
        <View style={styles.matchInfo}>
          <Text style={isGradient ? styles.nameTextGradient : styles.nameText}>
            {match.name || 'Name'}
          </Text>
          <Text style={isGradient ? styles.matchTextGradient : styles.matchText}>
            {emoji} {match.match_percentage}% match
          </Text>
        </View>
      </View>
    );

    if (isGradient) {
      return (
        <LinearGradient
          key={match.user_id}
          colors={Gradients.vibrant.colors as [string, string, ...string[]]}
          locations={Gradients.vibrant.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.matchCard}
        >
          {cardContent}
        </LinearGradient>
      );
    }

    return (
      <View key={match.user_id} style={[styles.matchCard, styles.matchCardPlain]}>
        {cardContent}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your matches...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <Header
              insets={insets}
              backButtonVisible={true}
            />
          )
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            We currently don't allow you to chat with each other.{'\n'}
            Let us know if you would be interested to chat with others
          </Text>

          {!isInterested && (
            <TouchableOpacity
              style={[
                styles.interestedButton,
                (isInterested || isInterestedLoading) && styles.interestedButtonDisabled,
              ]}
              onPress={handleInterestedPress}
              disabled={isInterested || isInterestedLoading}
            >
              {isInterestedLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.interestedButtonText}>
                  {isInterested ? 'Interest Recorded' : 'I am Interested'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Top Matches Section */}
        <View style={styles.matchesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Matches</Text>
            <Ionicons name="chevron-down" size={20} color={Colors.secondaryText} />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadData} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : matches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No matches available yet. Complete your soul profile to see your matches.
              </Text>
            </View>
          ) : (
            <View style={styles.matchesList}>
              {matches.map((match, index) => renderMatchCard(match, index))}
            </View>
          )}
        </View>
      </ScrollView>
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
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.secondaryText,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 50,
  },
  infoSection: {
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 8,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: Colors.primary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  interestedButton: {
    backgroundColor: Colors.black,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  interestedButtonDisabled: {
    opacity: 0.6,
  },
  interestedButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  matchesSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.secondaryText,
    marginRight: 4,
  },
  matchesList: {
    gap: 12,
  },
  matchCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  matchCardPlain: {
    backgroundColor: Colors.headerFooter,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E7EB',
  },
  matchInfo: {
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: 4,
  },
  nameTextGradient: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.black,
  },
  matchTextGradient: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.secondaryText,
    textAlign: 'center',
  },
});
