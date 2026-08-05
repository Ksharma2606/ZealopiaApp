import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Animated
} from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/lib/context/AuthContext';
import { db } from '@/lib/firebase';
import FirebaseService from '@/lib/services/FirebaseService';
import { FirebaseChatManager } from '@/lib/services/FirebaseChatManager';
import { SoulBotMessageInput } from '@/components/chat/SoulBotMessageInput';
import { SoulBotMessageItem } from '@/components/chat/SoulBotMessageItem';
import { useSoulProfilePolling } from '@/lib/hooks/useSoulProfilePolling';
import Colors from '@/constants/Colors';
import Gradients from '@/constants/Gradients';
import SoulChatClouds from '@/components/svgs/SoulChatClouds';
import SafeViewAndroid from '@/components/ui/SafeViewAndroid';
import { BaseText as Text } from '@/components/ui/Base';
import SoulBotExitModal from '@/components/modals/SoulBotExitModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
  id: string;
  messageText: string;
  sentAt: Date;
  sentBy: string;
  status?: string;
  isOptimistic?: boolean; // Flag to identify optimistic messages
}

export default function SoulBotChatScreen() {
  const { firebaseUser, backendUser, refreshUserData, loading } = useAuth();
  const router = useRouter();
  // const segments = useSegments();

  // console.log('SoulBotChatScreen - Component rendered:', {
  //   hasFirebaseUser: !!firebaseUser,
  //   hasBackendUser: !!backendUser,
  //   loading,
  //   segments,
  //   timestamp: new Date().toISOString()
  // });

  // // Track segment changes in this component
  // useEffect(() => {
  //   console.log('SoulBotChatScreen - Segments changed:', segments);
  // }, [segments]);

  // // Track auth loading state changes
  // useEffect(() => {
  //   console.log('SoulBotChatScreen - Auth loading state changed:', loading);
  // }, [loading]);
  const flatListRef = useRef<FlatList>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [waitingForSoulBot, setWaitingForSoulBot] = useState(false);
  const [soulBotGroupId, setSoulBotGroupId] = useState<string | null>(null);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  
  // Animation value for floating effect
  const floatAnim = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets();

  // Setup floating animation
  useEffect(() => {
    const floatingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -20,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    
    floatingAnimation.start();
    
    return () => {
      floatingAnimation.stop();
    };
  }, []);

  // Handle back navigation - if user completed signup, go to main app
  const handleBackNavigation = () => {
    // console.log('SoulBotChatScreen - handleBackNavigation called');
    // Check if soul profile has been generated
    if (!backendUser?.last_soul_profile_generated_at) {
      // Show exit confirmation modal if profile not generated
      // console.log('SoulBotChatScreen - No soul profile generated, showing exit modal');
      setShowExitModal(true);
    } else {
      // Profile generated, proceed with normal navigation
      if (backendUser?.user_profile?.is_signup_completed) {
        // console.log('SoulBotChatScreen - User completed signup, navigating back');
        router.back();
      } else {
        // console.log('SoulBotChatScreen - User not completed signup, going back normally');
        router.back();
      }
    }
  };

  // Handle confirmed exit from modal
  const handleConfirmedExit = () => {
    // console.log('SoulBotChatScreen - handleConfirmedExit called');
    setShowExitModal(false);
    if (backendUser?.user_profile?.is_signup_completed) {
      // console.log('SoulBotChatScreen - Signup completed, replacing to tabs');
      router.replace('/(tabs)');
    } else {
      // console.log('SoulBotChatScreen - Signup not completed, going back');
      router.back();
    }
  };

  // Use the polling hook to track profile generation
  // const { hasProfile, isPolling, profileGeneratedAt, isProfileJustGenerated } = useSoulProfilePolling();

  // Handle profile generation completion
  // useEffect(() => {
  //   if (isProfileJustGenerated) {
  //     // console.log('SoulBotChatScreen - Soul Profile just generated at:', profileGeneratedAt);
  //     // console.log('SoulBotChatScreen - Navigating to soul profile result screen');
  //     // Navigate to soul profile result screen
  //     router.push('/soul-profile-result');
  //   }
  // }, [isProfileJustGenerated]);

  // useEffect(() => {
  //   if (hasProfile) {
  //     router.push('/soul-profile-result');
  //   }
  // }, [hasProfile]);

  // Debug polling state - only log when important changes happen
  // useEffect(() => {
  //   if (isProfileJustGenerated) {
  //     console.log('Soul Profile just generated!');
  //   }
  // }, [isProfileJustGenerated]);

  // Function to wait for soul bot group creation
  const waitForSoulBotGroupCreation = useCallback(async (maxAttempts = 15, intervalMs = 2000) => {
    // console.log('SoulBotChatScreen - Soul bot group not found, waiting for creation...');
    setWaitingForSoulBot(true);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // console.log(`SoulBotChatScreen - Checking for soul bot group (attempt ${attempt}/${maxAttempts})`);
        // console.log('SoulBotChatScreen - About to call refreshUserData, this may trigger loading state change');
        await refreshUserData();
        
        // Check if the soul bot group was created
        if (backendUser?.soul_bot_group_uid) {
          // console.log('SoulBotChatScreen - Soul bot group found:', backendUser.soul_bot_group_uid);
          setWaitingForSoulBot(false);
          return backendUser.soul_bot_group_uid;
        }
        
        // Wait before the next attempt (except for the last attempt)
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        console.error(`Error checking soul bot group (attempt ${attempt}):`, error);
        
        // Continue trying even if there's an error
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
    }
    
    console.warn('Soul bot group creation timed out after', maxAttempts, 'attempts');
    setWaitingForSoulBot(false);
    return null;
  }, [backendUser, refreshUserData]);

  useEffect(() => {
    // console.log('SoulBotChatScreen - Main initialization useEffect triggered');
    const initializeSoulBotChat = async () => {
      if (!firebaseUser) {
        // console.log('SoulBotChatScreen - No firebase user, ending initialization');
        setIsLoading(false);
        return;
      }

      // If soul bot group already exists, use it
      if (backendUser?.soul_bot_group_uid) {
        // console.log('SoulBotChatScreen - Soul bot group already exists, using it:', backendUser.soul_bot_group_uid);
        setSoulBotGroupId(backendUser.soul_bot_group_uid);
        setIsLoading(false);
        return;
      }

      // console.log('SoulBotChatScreen - No soul bot group found, waiting for creation');
      // If no soul bot group, try to wait for it to be created
      const groupId = await waitForSoulBotGroupCreation();
      if (groupId) {
        setSoulBotGroupId(groupId);
      }
      
      setIsLoading(false);
    };

    initializeSoulBotChat();

    // // Cleanup function to detect unmounting
    // return () => {
    //   console.log('SoulBotChatScreen - Component unmounting or effect cleanup');
    // };
  }, [firebaseUser, backendUser?.soul_bot_group_uid, waitForSoulBotGroupCreation]);

  useEffect(() => {
    if (!firebaseUser || !soulBotGroupId) {
      return;
    }

    console.log('Setting up Soul Bot chat for group:', soulBotGroupId);

    // Mark messages as read when opening chat (via FirebaseChatManager)
    console.log('[SoulBotChat] Marking group as read via FirebaseChatManager');
    FirebaseChatManager.markAsRead(soulBotGroupId);

    // Set up real-time listener for messages via FirebaseChatManager
    const unsubscribe = FirebaseChatManager.subscribeToMessages(
      soulBotGroupId,
      (messagesData) => {
        // Remove optimistic messages when real messages arrive
        setMessages(prevMessages => {
          // Get all optimistic message texts from previous state
          const optimisticTexts = prevMessages
            .filter(msg => msg.isOptimistic)
            .map(msg => msg.messageText.toLowerCase().trim());

          // Filter out messages from Firebase that match optimistic messages
          const filteredNewMessages = messagesData.filter(newMsg => {
            const newMsgText = newMsg.messageText.toLowerCase().trim();
            // Keep the message if it's not matching any optimistic message text
            return !optimisticTexts.includes(newMsgText);
          });

          // Combine optimistic messages with filtered new messages
          const optimisticMessages = prevMessages.filter(msg => msg.isOptimistic);

          // Check if any optimistic messages have been confirmed (exist in Firebase data)
          const confirmedOptimisticTexts = new Set();
          messagesData.forEach(firebaseMsg => {
            const firebaseMsgText = firebaseMsg.messageText.toLowerCase().trim();
            optimisticMessages.forEach(optMsg => {
              if (optMsg.messageText.toLowerCase().trim() === firebaseMsgText) {
                confirmedOptimisticTexts.add(optMsg.messageText);
              }
            });
          });

          // Remove confirmed optimistic messages
          const remainingOptimisticMessages = optimisticMessages.filter(
            msg => !confirmedOptimisticTexts.has(msg.messageText)
          );

          // Return combined messages
          return [...remainingOptimisticMessages, ...messagesData];
        });

        setIsLoading(false);

        // Only auto-scroll to bottom if new messages were added
        const hasNewMessages = messagesData.length > previousMessageCount;
        if (hasNewMessages) {
          setTimeout(() => {
            if (flatListRef.current && messages.length > 0) {
              flatListRef.current.scrollToIndex({
                index: 0,
                animated: true,
              });
            }
          }, 100);
        }

        // Update the previous message count
        setPreviousMessageCount(messagesData.length);
      },
      (error) => {
        console.error('[SoulBotChat] Error listening to Soul Bot messages:', error);
        setIsLoading(false);
      }
    );

    // Cleanup
    return () => {
      console.log('[SoulBotChat] Flushing pending mark-as-read operations');
      FirebaseChatManager.flushPendingMarkAsRead();
      unsubscribe();
    };
  }, [firebaseUser, soulBotGroupId]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sentBy === firebaseUser?.uid;
    
    return (
      <SoulBotMessageItem 
        message={item}
        isOwnMessage={isOwnMessage}
      />
    );
  };

  const handleScrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToIndex({
        index: 0,
        animated: true,
      });
    }
  };

  // Handle adding optimistic message
  const handleOptimisticMessage = (messageText: string) => {
    if (!firebaseUser) return;

    const optimisticMessage: Message = {
      id: `optimistic-${Date.now()}`,
      messageText,
      sentAt: new Date(),
      sentBy: firebaseUser.uid,
      status: 'visible',
      isOptimistic: true,
    };

    // Add optimistic message to the beginning of the array (since messages are inverted)
    setMessages(prevMessages => [optimisticMessage, ...prevMessages]);

    // Scroll to bottom after adding message
    setTimeout(() => handleScrollToBottom(), 100);
  };

  // Handle navigation to generating soul profile screen
  const handleSoulProfileGenerationTriggered = useCallback(() => {
    console.log('[SoulBotChat] Soul profile generation triggered, navigating to generating screen...');
    router.push('/generating-soul-profile');
  }, [router]);

  if (isLoading || waitingForSoulBot) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>
          {waitingForSoulBot ? 'Setting up your Soul Bot...' : 'Connecting to Soul Bot...'}
        </Text>
      </View>
    );
  }

  if (!soulBotGroupId) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Soul Bot is being set up</Text>
        <Text style={styles.errorSubtext}>
          Your Soul Bot is being prepared. Please try again in a few moments.
        </Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      enabled={true}
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      {/* Custom Header with Gradient */}
      <LinearGradient
        colors={Gradients.choosingTopic.colors}
        locations={Gradients.choosingTopic.locations}
        style={[styles.container, { paddingBottom: insets.bottom }, SafeViewAndroid.AndroidSafeArea]}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.cloudContainer}>
            <SoulChatClouds width={'100%'} />
          </View>
          <TouchableOpacity 
            onPress={handleBackNavigation} 
            style={styles.headerBackButton}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.secondaryText} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => {
            if (backendUser?.soul_profile?.created_at) {
              router.push('/top-expert-matches');
            }
            }}
            style={styles.zoraChatImageContainer}
          >
            <Animated.Image
              source={require('@/assets/images/zora-chat.png')} 
              style={[
                styles.zoraChatImage,
                {
                  transform: [{ translateY: floatAnim }]
                }
              ]} 
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Messages Container */}
          <View style={styles.messagesContainer}>
            {/* Messages List */}
            {messages.length > 0 && (
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                inverted
                showsVerticalScrollIndicator={false}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                onScrollToIndexFailed={() => {
                  setTimeout(() => handleScrollToBottom(), 100);
                }}
              />
            )}
          </View>

          {/* Message Input */}
          <SoulBotMessageInput
            groupId={soulBotGroupId}
            onMessageSent={handleScrollToBottom}
            onOptimisticMessage={handleOptimisticMessage}
            onSoulProfileGenerationTriggered={handleSoulProfileGenerationTriggered}
          />
        </SafeAreaView>
      </LinearGradient>
      
      {/* Exit Confirmation Modal */}
      <SoulBotExitModal
        visible={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={handleConfirmedExit}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  
  // Header
  container: {
    flex: 1,
  },
  headerBackButton: {
    padding: 8,
    marginLeft: 8,
  },

  cloudContainer: {
    position: 'absolute',
    top: '20%',
    left: 0,
    right: 0,
    bottom: '20%',
    width: '100%',
    height: '100%',
  },

  zoraChatImageContainer: {
    flex: 1,
    maxHeight: '40%',
  },

  zoraChatImage: {
    height: '90%',
    alignSelf: 'center',
  },
  
  // Messages
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  
  // Loading & Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.primary,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    color: Colors.secondaryText,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.secondaryText,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: Colors.secondaryText,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginLeft: 16,
  },
  backButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});