import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet,
  Image,
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Colors from '@/constants/Colors';
import ApiService from '@/lib/services/ApiService';
import { useAuth } from '@/lib/context/AuthContext';
import { BaseText as Text } from '@/components/ui/Base';

const NAMES = [
  'Rahul', 'Shrey', 'Amit', 'Pranav', 'Kunal',
  'Sneha', 'Anjali', 'Vikram', 'Priya', 'Rohit',
  'Neha', 'Siddharth', 'Pooja', 'Arjun', 'Meera'
];

interface MatchData {
  heartMatches: number;
  excellentMatches: number;
  totalSoulFriends: number;
}

export default function SoulProfileResultScreen() {
  const router = useRouter();
  const { refreshUserData } = useAuth();
  const [matchData, setMatchData] = useState<MatchData>({
    heartMatches: 0,
    excellentMatches: 0,
    totalSoulFriends: 0,
  });

  useEffect(() => {
    // Generate random numbers as specified
    const heartMatches = Math.floor(Math.random() * (8 - 2 + 1)) + 2; // 2-8
    const excellentMatches = Math.floor(Math.random() * (100 - 50 + 1)) + 50; // 50-100
    const totalSoulFriends = Math.floor(Math.random() * (200 - 150 + 1)) + 150; // 150-200

    setMatchData({
      heartMatches,
      excellentMatches,
      totalSoulFriends,
    });

    // Mark the soul profile as viewed
    markProfileAsViewed();
  }, []);

  const markProfileAsViewed = async () => {
    try {
      await ApiService.markSoulProfileAsViewed();
      // Refresh user data to update the soul_profile_last_viewed_at timestamp
      await refreshUserData();
    } catch (error) {
      console.error('Error marking soul profile as viewed:', error);
    }
  };

  const handleBackPress = () => {
    // Navigate to chat home and clear the stack
    router.back();
  };

  const handleTakeToGroupChats = () => {
    // Navigate to group chats/explore screen
    router.replace('/(tabs)/explore');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.myChat} />
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.mainTitle}>Your Soul Profile is ready!</Text>
          
          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Wowza! you have {matchData.totalSoulFriends} soul friends!!
          </Text>

          {/* Soul Friends Explanation Card */}
          <View style={styles.explanationCard}>
            <View style={styles.soulMatchImageContainer}>
              <Image resizeMode='contain' source={require('@/assets/images/soul-matches.png')} style={styles.soulMatchImage} />
            </View>
            <View style={styles.explanationContent}>
              <Text style={styles.explanationTitle}>A soul friend is a person</Text>
              <Text style={styles.explanationTitle}>whose soul profile matches</Text>
              <Text style={styles.explanationTitle}>yours.</Text>
              
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <Text style={styles.heartEmoji}>💗</Text>
                  <Text style={styles.legendText}>= Complete Soul Match</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.starEmoji}>🥰</Text>
                  <Text style={styles.legendText}>= Excellent Soul Match</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.goodEmoji}>😊</Text>
                  <Text style={styles.legendText}>= Great Soul Match</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.okEmoji}>🔵</Text>
                  <Text style={styles.legendText}>= Not much in common</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.noMatchEmoji}>💀</Text>
                  <Text style={styles.legendText}>= No Match</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Update Notice */}
          <Text style={styles.updateNotice}>
            Your profile keeps updating timely as you chat more
          </Text>

          {/* Matches Section */}
          <Text style={styles.matchesTitle}>Your Matches</Text>
          
          <View style={styles.matchesContainer}>
            {/* Heart Matches */}
            <View
              style={styles.matchCard}
            >
              <Text style={styles.matchEmoji}>💗</Text>
              <Text style={styles.matchNumber}>{matchData.heartMatches}</Text>
              <View style={{ position: 'relative' }}>
                <Text style={styles.matchNames}>
                  {NAMES
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 5)
                    .join(', ')
                  }
                </Text>
                <BlurView tint="light" experimentalBlurMethod='dimezisBlurView' intensity={10} style={{ position: 'absolute', height:'100%', width:'100%'}} />
              </View>
              <Text style={styles.matchDescription}>
                You are a soul replica of each other. You care about the same things and are worried about the same things
              </Text>
            </View>

            {/* Excellent Matches */}
            <View
              style={styles.matchCard}
            >
              <Text style={styles.matchEmoji}>🥰</Text>
              <Text style={styles.matchNumber}>{matchData.excellentMatches}</Text>
              <View style={{ position: 'relative' }}>
                <Text style={styles.matchNames}>
                  {NAMES
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 5)
                    .join(', ')
                  }
                </Text>
                <BlurView tint="light" experimentalBlurMethod='dimezisBlurView' intensity={10} style={{ position: 'absolute', height:'100%', width:'100%'}} />
              </View>
              <Text style={styles.matchDescription}>
                You have similar outlook on life. You are also going through similar life challenges.
              </Text>
            </View>
          </View>

          {/* Bottom Notice */}
          <Text style={styles.bottomNotice}>
            Currently we do not allow you to chat with each other 1 on 1 but you can find and chat with your soul friends on our group chats.
          </Text>

          {/* Action Button */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleTakeToGroupChats}
          >
            <Text style={styles.actionButtonText}>Take me to group chats</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.myChat,
  },
  scrollView: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
  },

  blurContainer: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    margin: 4,
    textAlign: 'center',
    justifyContent: 'center',
    // overflow: 'hidden',
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 15,
    paddingBottom: 30,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.primaryText,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 28,
  },
  explanationCard: {
    backgroundColor: Colors.headerFooter,
    padding: 10,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  soulMatchImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40
  },
  soulMatchImage: {
    width: 140,
    height: 140,
  },
  infinitySymbol: {
    fontSize: 36,
    color: Colors.white,
    fontWeight: 'bold',
  },
  explanationContent: {
    flex: 1,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryText,
    textAlign: 'center',
    lineHeight: 22,
  },
  legendContainer: {
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  heartEmoji: {
    fontSize: 16,
    marginRight: 8,
    width: 20,
  },
  starEmoji: {
    fontSize: 16,
    marginRight: 8,
    width: 20,
  },
  goodEmoji: {
    fontSize: 16,
    marginRight: 8,
    width: 20,
  },
  okEmoji: {
    fontSize: 16,
    marginRight: 8,
    width: 20,
  },
  noMatchEmoji: {
    fontSize: 16,
    marginRight: 8,
    width: 20,
  },
  legendText: {
    fontSize: 14,
    color: Colors.primaryText,
  },
  updateNotice: {
    fontSize: 14,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  matchesTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.secondaryText,
    marginBottom: 20,
  },
  matchesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 12,
  },
  matchCard: {
    flex: 1,
    backgroundColor: Colors.headerFooter,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
    minHeight: 200,
    // justifyContent: 'center',
  },
  matchEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  matchNumber: {
    fontSize: 70,
    fontWeight: '600',
    color: Colors.white,
    // marginBottom: 2,
  },
  matchNames: {
    fontSize: 14,
    marginVertical: 5,
    marginHorizontal: 5,
  },
  matchDescription: {
    fontSize: 14,
    color: Colors.primaryText,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 8
  },
  bottomNotice: {
    fontSize: 16,
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButton: {
    marginHorizontal: 20,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 80,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
});