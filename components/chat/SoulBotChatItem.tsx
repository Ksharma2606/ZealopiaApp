import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGroupChatStore } from '@/lib/stores/groupChatStore';
import UnreadBadge from '@/components/ui/UnreadBadge';
import Gradients from '@/constants/Gradients';
import Colors from '@/constants/Colors';
import { useAuth } from '@/lib/context/AuthContext';

// Soul Bot specific colors
const COLORS = {
  soulBotPrimary: '#7C3AED',
  soulBotSecondary: '#A78BFA',
  soulBotBg: '#F3E8FF',
  primaryText: '#000000',
  secondaryText: '#6B7280',
  white: '#FFFFFF',
};

interface SoulBotChatItemProps {
  soulBotGroupId: string;
  lastMessage?: {
    messageText: string;
    sentAt: Date;
  };
}

export function SoulBotChatItem({ soulBotGroupId, lastMessage }: SoulBotChatItemProps) {
  const router = useRouter();
  
  // Get unread count from the centralized store
  const unreadCount = useGroupChatStore(state => {
    const groupWithUnread = state.groups.get(soulBotGroupId);
    return groupWithUnread?.unreadCount || 0;
  });

  const { backendUser } = useAuth();

  const handlePress = () => {
    router.push('/soul-bot-chat');
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <LinearGradient
        colors={Gradients.onboarding.colors}
        locations={Gradients.onboarding.locations}
        style={styles.container}
      >
        {/* Soul Bot Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Image source={require('@/assets/images/zora-avatar.png')} style={styles.avatarImage} resizeMode="contain" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Zora</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={2}>
            {backendUser?.last_soul_profile_generated_at ? 'Continue learning about yourself with me 🌸' : 'Finish profiling to see your soul-matches'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {lastMessage?.sentAt && (
            <Text style={styles.timestamp}>
              {formatTime(lastMessage.sentAt)}
            </Text>
          )}
          <UnreadBadge 
            count={unreadCount} 
            style={styles.unreadBadge}
          />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 20,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 4,
      height: 24,
    },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primaryText,
  },
  lastMessage: {
    fontSize: 12,
    lineHeight: 15,
    color: Colors.primaryText,
    marginRight: 30
  },
  timestamp: {
    fontSize: 12,
    color: Colors.primaryText,
  },
  unreadBadge: {
    backgroundColor: Colors.chatNotification,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    color: COLORS.soulBotPrimary,
    fontWeight: '600',
  },
  ctaText: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: '600',
  },
});