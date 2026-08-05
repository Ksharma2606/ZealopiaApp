import React, { useEffect, useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { router, Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useChatStore } from '@/lib/stores/chatStore';
import { useGroupChatStore } from '@/lib/stores/groupChatStore';
import { ChatThread } from '@/components/chat/ChatThread';
import { BaseText as Text } from '@/components/ui/Base';
import Colors from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OneOnOneInfoModal from '@/components/modals/group/OneOnOneInfoModal';
import apiService from '@/lib/services/ApiService';

// Move Header component outside and pass insets as props
const Header = ({ insets, titleText, titleDisabled, handleHeaderPress }: { insets: any, titleText: string, titleDisabled: boolean, handleHeaderPress: () => void }) => {
  return (
    <View style={{ 
      backgroundColor: Colors.headerFooter,
      paddingTop: insets.top + 10,
      paddingHorizontal: 16,
      paddingBottom: 20,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          padding: 8,
          position: 'absolute',
          left: 5,
          bottom: Platform.OS === 'ios' ? 10 : 15
        }}
      >
        <Ionicons name="chevron-back-outline" size={24} color={Colors.white} />
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={titleDisabled ? undefined : handleHeaderPress}
        disabled={titleDisabled}
      >
        <Text style={{
          fontSize: 20,
          fontWeight: '600',
          // fontFamily: 'Poppins-SemiBold',
          color: Colors.white,
        }}>{titleText}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ChatDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { currentGroup, isLoading, setCurrentGroup, setLoading } = useChatStore();
  const { setCurrentGroupId, markGroupAsRead } = useGroupChatStore();
  const insets = useSafeAreaInsets();

  // State for 1:1 info modal
  const [oneOnOneInfoModalVisible, setOneOnOneInfoModalVisible] = useState(false);
  const [oneOnOneInfo, setOneOnOneInfo] = useState<{
    medicName: string;
    medicBio?: string;
    expiresAt?: Date | null;
  } | null>(null);

  useEffect(() => {
    console.log('[ChatDetail] GroupId changed:', groupId);
    console.log('[ChatDetail] Current group before effect:', currentGroup?.uid);
    
    if (groupId) {
      // Set current group ID for push notification filtering
      setCurrentGroupId(groupId);
      
      // Only reset if we're switching to a completely different group
      if (currentGroup && currentGroup.uid !== groupId) {
        console.log('[ChatDetail] Switching to different group, keeping previous group data to avoid spinner');
        // Don't reset to null - let ChatThread handle the transition
      } else if (!currentGroup) {
        console.log('[ChatDetail] No current group, initial load');
      }
    }
    
    // Cleanup: clear current group ID when component unmounts or groupId changes
    return () => {
      if (!groupId) {
        setCurrentGroupId(null);
      }
    };
  }, [groupId, currentGroup, setCurrentGroupId]);
  
  // Clear current group ID when component unmounts
  useEffect(() => {
    return () => {
      setCurrentGroupId(null);
    };
  }, [setCurrentGroupId]);

  // Mark group as read when chat screen comes into focus (fire-and-forget)
  useFocusEffect(
    useCallback(() => {
      if (groupId) {
        console.log('[ChatDetail] Screen focused, marking group as read:', groupId);
        // Fire-and-forget: UI gets immediate feedback, Firebase happens in background
        setTimeout(() => markGroupAsRead(groupId), 0);
        console.log('[ChatDetail] markGroupAsRead fired in background');
      }
    }, [groupId, markGroupAsRead])
  );

  const getHeaderTitle = () => {
    if (!currentGroup) return 'Chat';
    
    // For DM chats, show participant name
    if (currentGroup.type === 'dm' || currentGroup.type === 'zealopia_dm') {
      // TODO: Get participant name from currentMembers
      return 'Direct Message';
    }
    
    return currentGroup.name;
  };

  const handleHeaderPress = async () => {
    if (currentGroup && currentGroup.type === 'group') {
      // Use the numeric ID from the group data
      const groupId = (currentGroup as any).id;

      if (groupId) {
        router.push({
          pathname: '/group-details',
          params: {
            groupId: groupId.toString(),
            groupFirebaseUid: currentGroup.uid,
            groupName: currentGroup.name,
          }
        });
      } else {
        console.warn('Group ID not found in group data:', currentGroup);
      }
    } else if (currentGroup && currentGroup.type === 'one_on_one') {
      // For 1:1 chats, fetch membership status and show info modal
      try {
        const response = await apiService.getMembershipStatus(currentGroup.uid);
        if (response.success && response.data) {
          setOneOnOneInfo({
            medicName: response.data.medic?.name || currentGroup.name,
            medicBio: response.data.medic?.bio,
            expiresAt: response.data.expiry_on ? new Date(response.data.expiry_on) : null,
          });
          setOneOnOneInfoModalVisible(true);
        }
      } catch (error) {
        console.error('Failed to fetch 1:1 info:', error);
      }
    }
  };

  // Only show loading spinner on initial load, not when switching between groups
  if (isLoading && !currentGroup && !groupId) {
    console.log('[ChatDetail] Showing loading spinner - no group data yet');
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#4B39EF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Fixed Header - Always at top, never affected by keyboard */}
      <Header
        insets={insets}
        titleText={getHeaderTitle()}
        titleDisabled={currentGroup?.type !== 'group' && currentGroup?.type !== 'one_on_one'}
        handleHeaderPress={handleHeaderPress}
      />
      
      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -insets.bottom}
      >
        <SafeAreaView style={[
          styles.safeArea,
          { paddingBottom: Platform.OS === 'ios' ? 20 : insets.bottom }
        ]}>
          {groupId ? (
            <ChatThread groupId={groupId} />
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>No group selected</Text>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* 1:1 Info Modal */}
      {oneOnOneInfo && (
        <OneOnOneInfoModal
          visible={oneOnOneInfoModalVisible}
          onClose={() => setOneOnOneInfoModalVisible(false)}
          medicName={oneOnOneInfo.medicName}
          medicBio={oneOnOneInfo.medicBio}
          expiresAt={oneOnOneInfo.expiresAt}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  contentContainer: {
    backgroundColor: '#fff',
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#919191',
  },
});