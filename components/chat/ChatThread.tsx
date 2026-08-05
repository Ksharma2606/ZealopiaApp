import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '@/lib/context/AuthContext';
import { useChatStore } from '@/lib/stores/chatStore';
import { useGroupChatStore } from '@/lib/stores/groupChatStore';
import { db } from '@/lib/firebase';
import firestore from '@react-native-firebase/firestore';
import { MessageInput } from './MessageInput';
import { MessageItem } from './MessageItem';
import { RenewalReminderMessage } from './RenewalReminderMessage';
import { TherapistRatingCard } from './TherapistRatingCard';
import { SharePreviousSummaryPrompt } from './SharePreviousSummaryPrompt';
import { ShareSoulProfilePrompt } from './ShareSoulProfilePrompt';
import { ReplyBar } from './ReplyBar';
import { PinnedMessagesBar } from './PinnedMessagesBar';
import UserService, { UserData } from '@/lib/services/UserService';
import FirebaseService from '@/lib/services/FirebaseService';
import { FirebaseChatManager } from '@/lib/services/FirebaseChatManager';
import apiService, { GroupDetails, GroupMember } from '@/lib/services/ApiService';

interface ChatThreadProps {
  groupId: string;
  keyboardHeight?: number;
}

export function ChatThread({ groupId, keyboardHeight = 0 }: ChatThreadProps) {
  const { firebaseUser, backendUser } = useAuth();

  const flatListRef = useRef<FlatList>(null);
  const [userCache, setUserCache] = useState<Map<string, UserData>>(new Map());
  const [membershipCache, setMembershipCache] = useState<Map<string, any>>(new Map());
  const [currentUserMembership, setCurrentUserMembership] = useState<any>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const messageSnapshotDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const currentGroupIdRef = useRef<string | null>(null);
  const {
    currentGroup,
    messages,
    setCurrentGroup,
    setMessages,
    getCanWriteChat,
    setCurrentMembership,
    setGroupMembers,
    setFirebaseUidToDjangoIdMapping,
    setMembershipExpiryStatus,
    membershipExpiryStatus
  } = useChatStore();
  
  // Get markGroupAsRead function for automatic read marking
  const markGroupAsRead = useGroupChatStore(state => state.markGroupAsRead);

  // Round robin color palette for consistent user colors
  const roundRobinColors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FECA57', // Yellow
    '#9B59B6', // Purple
    '#E17055', // Orange
    '#74B9FF', // Light Blue
    '#00B894', // Dark Green
    '#FDCB6E', // Light Orange
    '#6C5CE7', // Violet
    '#A29BFE', // Light Purple
  ];

  // Compute consistent round robin color for a user
  const computeUserColor = (userId: string): string => {
    if (!userId || userId === 'unknown') return '#808080';

    // Convert user ID to a consistent color index
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const colorIndex = Math.abs(hash) % roundRobinColors.length;
    return roundRobinColors[colorIndex];
  };

  useEffect(() => {
    if (!groupId || !firebaseUser) return;

    // Update current group ID ref for cross-contamination prevention
    currentGroupIdRef.current = groupId;

    // Clear messages immediately when switching to prevent cross-chat contamination
    setMessages([]);
    setIsLoadingMessages(true);

    // Subscribe to current user's membership via FirebaseChatManager
    const membershipUnsubscribe = FirebaseChatManager.subscribeToMembership(
      groupId,
      (membership) => {
        if (membership) {
          setCurrentUserMembership(membership);
          setCurrentMembership(membership);
        }
      },
      (error) => {
        console.error('[ChatThread] Error loading current user membership:', error);
      }
    );

    // Load group details with soul profile match data
    const loadGroupDetails = async (groupBackendId: number) => {
      try {
        const response = await apiService.getGroupDetails(groupBackendId);

        // console.log('response', response.data);

        if (response.success && response.data) {
          const groupDetails: GroupDetails = response.data;

          // Convert members array to lookup object for efficient access
          const membersLookup: Record<number, any> = {};
          const firebaseUidToDjangoIdMapping: Record<string, number> = {};

          groupDetails.members.forEach(member => {
            membersLookup[member.user_id] = {
              name: member.name,
              role: member.role,
              profilePicture: member.profile_picture,
              userId: member.user_id,
              soulMatchEmoji: member.soul_match_emoji,
              soulMatchPercentage: member.soul_match_percentage
            };

            // Create Firebase UID to Django ID mapping
            if (member.firebase_uid) {
              firebaseUidToDjangoIdMapping[member.firebase_uid] = member.user_id;
            }
          });

          setGroupMembers(membersLookup);
          setFirebaseUidToDjangoIdMapping(firebaseUidToDjangoIdMapping);
          // console.log('[ChatThread] Group members with soul matches loaded:', Object.keys(membersLookup).length);
          // console.log('[ChatThread] Members lookup:', membersLookup);
        }
      } catch (error) {
        console.error('[ChatThread] Error loading group details:', error);
        // Don't fail the chat loading if group details fail
      }
    };

    // Load membership expiry status
    const loadMembershipExpiryStatus = async (groupFirebaseUid: string) => {
      try {
        const response = await apiService.getMembershipStatus(groupFirebaseUid);

        if (response.success && response.data) {
          // Parse rating status if available
          const ratingStatus = response.data.rating_status ? {
            hasRated: response.data.rating_status.has_rated,
            rating: response.data.rating_status.rating,
            feedback: response.data.rating_status.feedback,
            submittedAt: response.data.rating_status.submitted_at,
          } : undefined;

          setMembershipExpiryStatus({
            hasMembership: response.data.has_membership,
            status: response.data.status,
            expiryOn: response.data.expiry_on,
            daysUntilExpiry: response.data.days_until_expiry,
            inGracePeriod: response.data.in_grace_period || false,
            canExtend: response.data.can_extend || false,
            extensionOptions: response.data.extension_options,
            groupName: response.data.group_name,
            isOneOnOne: response.data.is_one_on_one,
            ratingStatus: ratingStatus,
            soulProfileShared: response.data.soul_profile_shared,
          });
        } else {
          // No membership found or API error
          setMembershipExpiryStatus(null);
        }
      } catch (error) {
        console.error('[ChatThread] Error loading membership expiry status:', error);
        // Don't fail chat loading if membership status fails
        setMembershipExpiryStatus(null);
      }
    };

    // Mark as read when user opens chat (via FirebaseChatManager)
    // This is debounced and deduplicated automatically
    FirebaseChatManager.markAsRead(groupId);

    // Set up real-time listener for group data via FirebaseChatManager
    // Capture the groupId at listener creation time to prevent stale closure issues
    const listenerGroupId = groupId;
    let messagesUnsubscribe: (() => void) | null = null;
    let hasLoadedGroupDetails = false; // Track if we've already loaded group details
    let lastGroupDataHash = ''; // Track group data changes to prevent unnecessary re-renders

    const groupUnsubscribe = FirebaseChatManager.subscribeToGroupData(
      listenerGroupId,
      (groupData) => {
        // VALIDATION: Ensure this data is for the current group
        if (groupData.uid !== listenerGroupId) {
          console.warn('[ChatThread] Group data mismatch! Expected:', listenerGroupId, 'Got:', groupData.uid);
          return; // Ignore this update
        }

        // DEDUPLICATION: Create hash of essential group data to detect actual changes
        // Only update state if group data has actually changed (prevent infinite re-render loop)
        const currentHash = JSON.stringify({
          uid: groupData.uid,
          name: groupData.name,
          type: groupData.type,
          status: groupData.status,
          id: groupData.id
        });

        if (currentHash === lastGroupDataHash) {
          // Group data hasn't changed, skip state update to prevent re-render cascade
          return;
        }

        lastGroupDataHash = currentHash;
        setCurrentGroup(groupData);
        setIsLoadingGroup(false);

        // Load group details with soul match data ONLY ONCE (not on every snapshot update)
        // This prevents repeated API calls when the group document updates (e.g., readBy changes)
        if (groupData.id && !hasLoadedGroupDetails) {
          hasLoadedGroupDetails = true;
          loadGroupDetails(groupData.id);
          // Also load membership expiry status
          loadMembershipExpiryStatus(groupData.uid);
        }

        // Set up real-time listener for messages (direct Firebase subscription)
        // Note: This needs to stay as direct subscription because it requires the messagesRef
        // from the group data, which changes per group
        const messagesRef = groupData.messages;
        if (messagesRef && !messagesUnsubscribe) {
          // CRITICAL FIX: Store the current groupId in a variable that won't be stale
          // This prevents cross-chat message contamination when switching groups quickly
          const currentListenerGroupId = groupId;
          const currentGroupUid = groupData.uid;

          messagesUnsubscribe = messagesRef.collection('messages')
              .where('status', '==', 'visible')
              .orderBy('sentAt', 'desc')
              .limit(250)
              .onSnapshot(async (querySnapshot) => {
                // CRITICAL VALIDATION: Prevent cross-chat message contamination
                // Check against the ref which always contains the most current groupId
                if (currentGroupIdRef.current !== currentListenerGroupId) {
                  console.warn('[ChatThread] BLOCKED cross-chat contamination! Message listener for group:', currentListenerGroupId,
                    'but current active group is:', currentGroupIdRef.current, '- ignoring stale update');
                  return; // Block this stale update to prevent message crossover
                }
                
                // Debounce rapid message updates to prevent cascade rendering
                if (messageSnapshotDebounceRef.current) {
                  clearTimeout(messageSnapshotDebounceRef.current);
                }
                
                messageSnapshotDebounceRef.current = setTimeout(async () => {
                  const messagesData: any[] = [];

                  // Set loading to false once we get the first snapshot
                  setIsLoadingMessages(false);
                
                querySnapshot.forEach((messageDoc) => {
                  const data = messageDoc.data();
                  
                  // Handle serverTimestamp properly - it can be null initially
                  let sentAtDate: Date;
                  if (data.sentAt && typeof data.sentAt.toDate === 'function') {
                    sentAtDate = data.sentAt.toDate();
                  } else if (data.sentAt) {
                    // Handle case where it might be a different timestamp format
                    sentAtDate = new Date(data.sentAt);
                  } else {
                    // Fallback to current time if sentAt is null
                    sentAtDate = new Date();
                  }
                  
                  // Get sender UID from document reference or direct value
                  let senderUid: string;
                  if (data.sentBy?.id) {
                    senderUid = data.sentBy.id;
                  } else if (typeof data.sentBy === 'string') {
                    senderUid = data.sentBy;
                  } else {
                    senderUid = 'unknown';
                  }
                  
                  messagesData.push({
                    id: messageDoc.id,
                    messageText: data.messageText,
                    sentAt: sentAtDate,
                    sentBy: senderUid,
                    status: data.status || 'visible',
                    isReply: data.isReply || false,
                    replyTo: data.replyTo || null,
                    attachments: data.attachments || [],
                    visibleToUserIds: data.visibleToUserIds || undefined,
                    messageMetadata: data.messageMetadata || undefined,
                    isPinned: data.isPinned || false,
                    pinnedBy: data.pinnedBy || undefined,
                  });
                });
                
                // Filter messages based on visibleToUserIds
                // If a message has visibleToUserIds set, only show it to those specific users
                const currentUserFirebaseUid = firebaseUser?.uid;
                const filteredMessages = messagesData.filter((msg) => {
                  if (!msg.visibleToUserIds || msg.visibleToUserIds.length === 0) {
                    // No visibility restriction - show to everyone
                    return true;
                  }
                  // Check if current user is in the visibility list
                  return currentUserFirebaseUid && msg.visibleToUserIds.includes(currentUserFirebaseUid);
                });

                // Check if this is a new message (not just status updates)
                const hasNewMessages = filteredMessages.length > lastMessageCount;
                const isNewMessage = filteredMessages.length > 0 && filteredMessages[0].id !== lastMessageId;

                // Update messages first
                setMessages(filteredMessages);
                
                // Update tracking variables
                setLastMessageCount(filteredMessages.length);
                if (filteredMessages.length > 0) {
                  setLastMessageId(filteredMessages[0].id);
                }

                // Auto-mark as read when new messages arrive (via FirebaseChatManager)
                // This is debounced and deduplicated automatically
                if (hasNewMessages || isNewMessage) {
                  FirebaseChatManager.markAsRead(groupId);
                }
                
                // Preload user data and memberships for all unique senders (async operation)
                const uniqueSenders = [...new Set(messagesData.map(msg => msg.sentBy))];
                const validSenders = uniqueSenders.filter(uid => uid !== 'unknown' && uid !== firebaseUser?.uid && uid !== 'zealopia' && uid !== 'soul_bot');
                
                if (validSenders.length > 0) {
                  try {
                    // Only load users that aren't already in cache
                    const uncachedSenders = validSenders.filter(uid => !userCache.has(uid));
                    
                    if (uncachedSenders.length > 0) {
                      // PERFORMANCE FIX: Make user preloading non-blocking but update cache when complete
                      UserService.preloadUsers(uncachedSenders)
                        .then(() => {
                          // Force cache refresh with newly loaded users using functional update to avoid stale closure
                          setUserCache(currentCache => {
                            const refreshedUserCache = new Map(currentCache);
                            uncachedSenders.forEach(uid => {
                              const freshUserData = UserService.getCachedUser(uid);
                              if (freshUserData) {
                                refreshedUserCache.set(uid, freshUserData);
                              }
                            });
                            return refreshedUserCache;
                          });

                          // AFTER user preloading: Load memberships with fully loaded user data
                          const membershipPromises = [];
                          const uncachedMemberships = validSenders.filter(uid => !membershipCache.has(uid));

                          if (uncachedMemberships.length > 0) {

                            for (const uid of uncachedMemberships) {
                              // Now user data should be fully loaded with memberships reference
                              const userData = UserService.getCachedUser(uid);

                              if (userData?.memberships) {
                                const promise = userData.memberships.collection('groups')
                                  .where('groupId', '==', groupId)
                                  .limit(1)
                                  .get()
                                  .then(snapshot => {
                                    if (!snapshot.empty) {
                                      const membership = snapshot.docs[0].data();

                                      // Ensure color is set - use Firebase color or compute fallback
                                      if (!membership.color) {
                                        membership.color = computeUserColor(uid);
                                      }

                                      // Use functional update to avoid race conditions
                                      setMembershipCache(prevCache => {
                                        const updatedCache = new Map(prevCache);

                                        // Preserve existing color if user already has one (synthetic or real)
                                        const existingMembership = updatedCache.get(uid);
                                        if (existingMembership?.color) {
                                          membership.color = existingMembership.color;
                                        }

                                        updatedCache.set(uid, membership);
                                        return updatedCache;
                                      });
                                      // console.log('[ChatThread] Added membership for user:', uid, 'role:', membership.role, 'color:', membership.color);
                                    } else {
                                      console.warn('[ChatThread] No membership found for user:', uid, 'in group:', groupId);
                                    }
                                  })
                                  .catch(err => {
                                    console.error('[ChatThread] Error loading membership for user', uid, ':', err);
                                  });
                                membershipPromises.push(promise);
                              } else {
                                console.warn('[ChatThread] User', uid, 'has no memberships reference after preloading');
                              }
                            }

                            // Make membership loading non-blocking but track completion
                            Promise.all(membershipPromises)
                              .then(() => {
                                // Create synthetic memberships for users without Firebase membership data
                                // This ensures all users get consistent colors instead of default blue
                                setTimeout(() => {
                                  setMembershipCache(prevCache => {
                                    const updatedCache = new Map(prevCache);
                                    let syntheticCount = 0;

                                    // Only create synthetic memberships for users who still don't have membership data
                                    // after all Firebase queries completed
                                    validSenders.forEach(uid => {
                                      if (!updatedCache.has(uid) && uid !== firebaseUser?.uid) {
                                        // Create synthetic membership with computed color
                                        const syntheticMembership = {
                                          groupId,
                                          userId: uid,
                                          role: 'Member' as const,
                                          color: computeUserColor(uid),
                                          _synthetic: true // Mark as app-generated
                                        };
                                        updatedCache.set(uid, syntheticMembership);
                                        syntheticCount++;
                                      }
                                    });

                                    return updatedCache;
                                  });
                                }, 100); // Small delay to ensure all Firebase attempts complete
                              })
                              .catch(error => console.warn('[ChatThread] Membership loading failed:', error));
                          }
                        })
                        .catch(error => console.warn('[ChatThread] User preloading failed:', error));
                    }
                    
                    // STABLE COLOR FIX: Only update caches when there are actual new users
                    // This prevents unnecessary re-renders and color switching on every message
                    let hasNewUsers = false;
                    let hasNewMemberships = false;
                    const newUserCache = new Map(userCache);

                    // Check if we have any new users to add
                    for (const uid of validSenders) {
                      const userData = UserService.getCachedUser(uid);
                      if (userData && !userCache.has(uid)) {
                        newUserCache.set(uid, userData);
                        hasNewUsers = true;
                      }
                    }

                    // Only update user cache if we have new users
                    if (hasNewUsers) {
                      setUserCache(newUserCache);
                    }

                  } catch (error) {
                    console.error('[ChatThread] Error preloading user data:', error);
                  }
                }
                
                // Smart auto-scroll: only scroll if user is near bottom AND it's a new message
                if ((hasNewMessages || isNewMessage) && isUserNearBottom && messagesData.length > 0) {
                  setTimeout(() => {
                    if (flatListRef.current) {
                      flatListRef.current.scrollToIndex({
                        index: 0,
                        animated: true,
                      });
                    }
                  }, 100);
                }
                }, 50); // 50ms debounce delay
              }, (error) => {
                console.error('Error listening to messages:', error);
                setMessages([]);
                setIsLoadingMessages(false);
              });

          // Messages listener is stored in the outer scope variable
        }
      },
      (error) => {
        console.error('[ChatThread] Error listening to group:', error);
        setIsLoadingGroup(false);
      }
    );

    // Cleanup function
    return () => {
      // Flush any pending mark-as-read operations for this group
      // This ensures the read state is saved before navigating away
      FirebaseChatManager.flushPendingMarkAsRead();

      // Cleanup all listeners
      groupUnsubscribe();
      membershipUnsubscribe();
      if (messagesUnsubscribe) {
        messagesUnsubscribe();
      }

      // ENHANCED CLEANUP: Clear both local and UserService caches for this group
      setMembershipCache(new Map());
      setCurrentUserMembership(null);
      setUserCache(new Map()); // Clear local user cache too
      setMembershipExpiryStatus(null); // Clear membership expiry status

      // Clear group-specific data from UserService to prevent cross-contamination
      UserService.clearCacheForGroup?.(groupId);

      // Clear message snapshot debounce timer
      if (messageSnapshotDebounceRef.current) {
        clearTimeout(messageSnapshotDebounceRef.current);
        messageSnapshotDebounceRef.current = null;
      }

      // Clear group ID ref to prevent any stale references
      currentGroupIdRef.current = null;

      // Reset scroll tracking variables
      setIsUserNearBottom(true);
      setLastMessageCount(0);
      setLastMessageId(null);
    };
  }, [groupId, firebaseUser]);

  const handleDeleteMessage = async (messageId: string) => {
    try {
      if (!currentGroup?.messages) return;
      
      // Update message status to 'deleted' instead of actually deleting
      await currentGroup.messages.collection('messages')
        .doc(messageId)
        .update({
          status: 'deleted'
        });
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  // Handle pinning a message
  const handlePinMessage = async (messageId: string) => {
    try {
      await FirebaseChatManager.pinMessage(groupId, messageId);
    } catch (error) {
      console.error('Error pinning message:', error);
      Alert.alert('Error', 'Failed to pin message');
    }
  };

  // Handle unpinning a message
  const handleUnpinMessage = async (messageId: string) => {
    try {
      await FirebaseChatManager.unpinMessage(groupId, messageId);
    } catch (error) {
      console.error('Error unpinning message:', error);
      Alert.alert('Error', 'Failed to unpin message');
    }
  };

  // Compute pinned messages from the messages array (memoized)
  const pinnedMessages = useMemo(
    () => messages.filter(msg => msg.isPinned === true),
    [messages]
  );

  const scrollToMessage = (messageId: string) => {
    if (!flatListRef.current || !messages.length) {
      return;
    }

    // Find the message index in the current messages array
    const messageIndex = messages.findIndex(msg => msg.id === messageId);

    if (messageIndex !== -1) {
      try {
        // Scroll to the message with animation
        flatListRef.current.scrollToIndex({
          index: messageIndex,
          animated: true,
          viewPosition: 0.5, // Center the message in the view
        });
      } catch (error) {
        console.error('Error scrolling to message:', error);
        // Fallback: scroll to approximate offset
        try {
          flatListRef.current.scrollToOffset({
            offset: messageIndex * 100, // Rough estimate
            animated: true,
          });
        } catch (fallbackError) {
          // Fallback scroll also failed
        }
      }
    }
  };

  // Callback to refresh membership status after rating submission
  const handleRatingSubmitted = useCallback(async () => {
    try {
      const response = await apiService.getMembershipStatus(groupId);
      if (response.success && response.data) {
        const ratingStatus = response.data.rating_status ? {
          hasRated: response.data.rating_status.has_rated,
          rating: response.data.rating_status.rating,
          feedback: response.data.rating_status.feedback,
          submittedAt: response.data.rating_status.submitted_at,
        } : undefined;

        setMembershipExpiryStatus({
          hasMembership: response.data.has_membership,
          status: response.data.status,
          expiryOn: response.data.expiry_on,
          daysUntilExpiry: response.data.days_until_expiry,
          inGracePeriod: response.data.in_grace_period || false,
          canExtend: response.data.can_extend || false,
          extensionOptions: response.data.extension_options,
          groupName: response.data.group_name,
          isOneOnOne: response.data.is_one_on_one,
          ratingStatus: ratingStatus,
        });
      }
    } catch (error) {
      console.error('[ChatThread] Error refreshing membership status after rating:', error);
    }
  }, [groupId, setMembershipExpiryStatus]);

  // Check if rating card should be shown
  const shouldShowRatingCard = useCallback((messageIndex: number, message: any): boolean => {
    // Only show for 1:1 groups
    if (!membershipExpiryStatus?.isOneOnOne) return false;

    // Only show when the group/membership has expired
    // We don't delete groups for 7 days after expiry, so users can still see feedback UI
    if (membershipExpiryStatus?.status !== 'MembershipExpired') return false;

    // Only show after renewal reminder messages
    if (message.messageMetadata?.type !== 'renewal_reminder') return false;

    // Only show for the most recent (first in array due to inversion) renewal reminder
    // Find the first renewal reminder in messages
    const firstRenewalReminderIndex = messages.findIndex(
      m => m.messageMetadata?.type === 'renewal_reminder'
    );

    // Show card for the most recent renewal reminder (shows rating form or thank you message)
    return messageIndex === firstRenewalReminderIndex;
  }, [membershipExpiryStatus, messages]);

  const renderMessage = useCallback(({ item, index }: { item: any; index: number }) => {
    // Check if this is a special message type that needs custom rendering
    if (item.messageMetadata?.type === 'renewal_reminder') {
      const showRating = shouldShowRatingCard(index, item);
      return (
        <View>
          <RenewalReminderMessage
            message={item}
            groupId={groupId}
          />
          {/* Show rating card AFTER renewal reminder (appears below in inverted list) */}
          {showRating && (
            <TherapistRatingCard
              groupId={groupId}
              ratingStatus={membershipExpiryStatus?.ratingStatus}
              onRatingSubmitted={handleRatingSubmitted}
            />
          )}
        </View>
      );
    }

    // Check if this is a share previous summary prompt
    if (item.messageMetadata?.type === 'share_previous_summary_prompt') {
      return (
        <SharePreviousSummaryPrompt
          message={item}
          groupId={groupId}
        />
      );
    }

    // Check if this is a share soul profile prompt
    if (item.messageMetadata?.type === 'share_soul_profile_prompt') {
      return (
        <ShareSoulProfilePrompt
          message={item}
          groupId={groupId}
        />
      );
    }

    // Check if this is an extension confirmation (system message - render differently)
    if (item.messageMetadata?.type === 'extension_confirmation') {
      // For now, render as a regular message from Zealopia
      // Could create a custom component for this later
    }

    const isOwnMessage = item.sentBy === firebaseUser?.uid;
    const senderData = userCache.get(item.sentBy);
    const senderMembership = membershipCache.get(item.sentBy);


    return (
      <MessageItem
        message={item}
        isOwnMessage={isOwnMessage}
        ownName={backendUser?.user_profile?.name || 'You'}
        senderData={senderData}
        membership={senderMembership}
        currentUserMembership={currentUserMembership}
        groupId={groupId}
        canWriteChat={getCanWriteChat()}
        onDelete={handleDeleteMessage}
        onScrollToMessage={scrollToMessage}
        onPin={handlePinMessage}
        onUnpin={handleUnpinMessage}
      />
    );
  }, [firebaseUser?.uid, userCache, membershipCache, backendUser?.user_profile?.name, currentUserMembership, groupId, getCanWriteChat, handleDeleteMessage, scrollToMessage, handlePinMessage, handleUnpinMessage, shouldShowRatingCard, membershipExpiryStatus, handleRatingSubmitted]);

  const handleScrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      // Use setTimeout to defer scroll animation until after UI updates complete
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToIndex({
            index: 0,
            animated: true,
          });
        }
      }, 0); // 0ms timeout = next tick, allows UI to update first

      // Reset user position tracking immediately (don't wait for animation)
      setIsUserNearBottom(true);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    
    // Calculate if user is near the bottom
    // Since FlatList is inverted, check if user is near the top (which is actually the bottom)
    const threshold = 200; // pixels threshold
    const isNearBottom = contentOffset.y <= threshold;

    if (isNearBottom !== isUserNearBottom) {
      setIsUserNearBottom(isNearBottom);
    }
  };

  // Show loading state for initial group and messages load
  if (isLoadingGroup || (isLoadingMessages && messages.length === 0)) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4B39EF" />
          <Text style={styles.loadingText}>
            {isLoadingGroup ? 'Loading chat...' : 'Loading messages...'}
          </Text>
        </View>
      </View>
    );
  }

  const containerPaddingBottom = Platform.OS === 'android' && keyboardHeight > 0 
    ? Math.max(0, keyboardHeight) // Adjust for input height
    : 0;

  return (
    <View style={[styles.container, { paddingBottom: containerPaddingBottom }]}>
      {/* Pinned Messages Bar */}
      <PinnedMessagesBar
        pinnedMessages={pinnedMessages}
        onMessagePress={scrollToMessage}
      />

      {/* Messages List */}
      <View style={styles.messagesContainer}>
        {messages.length === 0 && !isLoadingMessages ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>No messages yet</Text>
            <Text style={styles.emptyStateSubtext}>Start a conversation!</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted // Show newest messages at bottom
            showsVerticalScrollIndicator={false}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            onScroll={handleScroll}
            scrollEventThrottle={100} // Throttle scroll events for better performance
            onScrollToIndexFailed={(info) => {
              console.warn('Scroll to index failed:', info);
              setTimeout(() => handleScrollToBottom(), 100);
            }}
            // Performance optimizations
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={21}
            initialNumToRender={15}
            updateCellsBatchingPeriod={50}
            getItemLayout={undefined} // Let FlatList calculate item heights dynamically
          />
        )}
      </View>

      {/* Reply Bar */}
      <ReplyBar />
      
      {/* Message Input */}
      <MessageInput 
        groupId={groupId}
        canWrite={getCanWriteChat()}
        onMessageSent={handleScrollToBottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  
  // Empty state
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#919191',
    textAlign: 'center',
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#919191',
    marginTop: 12,
    textAlign: 'center',
  },
});