import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BaseText as Text } from '@/components/ui/Base';
import { useAuth } from '@/lib/context/AuthContext';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import ChatItem from '@/components/chat/ChatItem';
import GroupCard, { GroupCardData } from '@/components/ui/GroupCard';
import JoinGroupModal from '@/components/modals/group/JoinGroupModal';
import { ErrorBanner, ErrorState, LoadingWithError } from '@/components/ui/ErrorComponents';
import { useJoinGroup } from '@/lib/hooks/useJoinGroup';
import FirebaseService, { Group } from '@/lib/services/FirebaseService';
import ApiService, { RecommendedGroup } from '@/lib/services/ApiService';
import { errorService, AppError } from '@/lib/services/ErrorService';
import { SoulBotChatItem } from '@/components/chat/SoulBotChatItem';
import { useGroupChatStore } from '@/lib/stores/groupChatStore';
import Colors from '@/constants/Colors';

export default function ChatHomeScreen() {
  const { firebaseUser, backendUser, loading: authLoading, isSignupComplete } = useAuth();
  const router = useRouter();
  
  // Get groups from the centralized store instead of local state
  const {
    isInitialized: chatStoreInitialized,
    isLoading: chatStoreLoading,
    error: chatStoreError,
    getUserGroups,
    getMedicGroups,
    isUserMedic: isUserMedicFromStore,
    clearError: clearChatStoreError
  } = useGroupChatStore();

  // Still need local state for recommended groups (not in ChatStore)
  const [recommendedGroups, setRecommendedGroups] = useState<RecommendedGroup[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [recommendedError, setRecommendedError] = useState<AppError | null>(null);

  // Use medic status from store (Firebase profiles) instead of backend medical_profile
  const isUserMedic = isUserMedicFromStore;

  // Get groups based on user type
  const allGroups = getUserGroups(); // For regular users
  const medicGroups = getMedicGroups(); // For medic users

  // Process groups based on user type and group properties
  // Keep full GroupWithUnreadCount to access membership's per-user recentMessage
  const processedGroups = useMemo(() => {
    if (!isUserMedic) {
      // For regular users: all groups are "live groups"
      return {
        liveGroupsWithMembership: allGroups,
        groupsYouRunWithMembership: [],
        groupsYouJoinedWithMembership: []
      };
    } else {
      // For medics: use the properly categorized groups from Firebase queries
      return {
        liveGroupsWithMembership: [],
        groupsYouRunWithMembership: medicGroups.groupsYouRun,
        groupsYouJoinedWithMembership: medicGroups.groupsYouJoined
      };
    }
  }, [allGroups, medicGroups, isUserMedic]);

  const { liveGroupsWithMembership, groupsYouRunWithMembership, groupsYouJoinedWithMembership } = processedGroups;

  // Also extract just the groups for legacy usage (e.g., Soul Bot lookup)
  const liveGroups = liveGroupsWithMembership.map(g => g.group);
  const groupsYouRun = groupsYouRunWithMembership.map(g => g.group);
  const groupsYouJoined = groupsYouJoinedWithMembership.map(g => g.group);

  // Handle pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear error state
      setError(null);
      clearChatStoreError();
      
      // Refresh recommended groups for regular users
      if (!isUserMedic) {
        await fetchRecommendedGroups();
      }
      
      // Note: ChatStore groups will refresh automatically via real-time listeners
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Join group functionality
  const {
    joinModalVisible,
    selectedGroup,
    groupDetailsLoading,
    loadingGroupId,
    handleJoinGroup,
    closeJoinModal,
  } = useJoinGroup(handleRefresh);

  // Fetch recommended groups from API with enhanced error handling
  const fetchRecommendedGroups = async () => {
    setLoadingRecommended(true);
    setRecommendedError(null);
    
    try {
      const response = await ApiService.getRecommendedGroupsWithRetry(3);
      if (response.success && response.data) {
        setRecommendedGroups(response.data);
      } else {
        const appError = response.appError || errorService.handleError(
          response.error || 'Failed to fetch recommended groups',
          { logError: true, showAlert: false }
        );
        setRecommendedError(appError);
      }
    } catch (err) {
      const appError = errorService.handleError(err, { 
        logError: true, 
        showAlert: false 
      });
      setRecommendedError(appError);
    } finally {
      setLoadingRecommended(false);
    }
  };

  // Initial setup for non-medic users (fetch recommended groups)
  useEffect(() => {
    if (!isUserMedic && chatStoreInitialized) {
      fetchRecommendedGroups();
    }
  }, [isUserMedic, chatStoreInitialized]);

  // Handle chat item press - navigate to chat detail screen
  const handleChatPress = (group: Group) => {
    router.push({
      pathname: '/chat-detail',
      params: { groupId: group.uid }
    });
  };

  // Convert RecommendedGroup to GroupCardData format
  const convertToGroupCardData = (recommendedGroup: RecommendedGroup): GroupCardData => {
    return {
      ...recommendedGroup,
      // id: recommendedGroup.id,
      // name: recommendedGroup.name,
      // description: recommendedGroup.description,
      // cost: recommendedGroup.cost,
      // num_members: recommendedGroup.num_members,
      // max_num_members: recommendedGroup.max_num_members,
      // medic: {
      //   name: recommendedGroup.medic?.name || 'Unknown',
      //   title: recommendedGroup.medic?.designation || recommendedGroup.medic?.title,
      // },
      // medic_soul_match_emoji: recommendedGroup.medic_soul_match_emoji,
      // medic_soul_match_percentage: recommendedGroup.medic_soul_match_percentage,
      // status: recommendedGroup.status,
      defaultGroupPicUrl: recommendedGroup.default_group_pic_url,
    };
  };

  // Handle recommended chat press - now uses join group functionality
  const handleRecommendedChatPress = (group: GroupCardData) => {
    handleJoinGroup(group);
  };

  // Handle create group press (for medics)
  const handleCreateGroupPress = () => {
    router.push('/(tabs)/create-group');
  };

  // Loading state
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }
  
  // Loading groups state (using ChatStore loading state)
  if (chatStoreLoading && !chatStoreError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {isUserMedic ? 'Loading your groups...' : 'Loading your conversations...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not authenticated state
  if (!firebaseUser || !backendUser) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Please log in to view chats</Text>
      </View>
    );
  }

  // // Signup not completed state
  // if (!isSignupComplete) {
  //   return (
  //     <View style={styles.errorContainer}>
  //       <Text style={styles.errorText}>Please complete your profile setup</Text>
  //     </View>
  //   );
  // }

  return (
    <View style={styles.container}>
      {/* Error display - combine ChatStore and local errors */}
      {(error || chatStoreError) && (
        <ErrorBanner 
          error={error || chatStoreError} 
          onDismiss={() => {
            setError(null);
            clearChatStoreError();
          }}
          dismissible={true}
        />
      )}

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.headerFooter]}
            tintColor={Colors.headerFooter}
          />
        }
      >
        {/* Content based on user type */}
        {!isUserMedic ? (
          // Regular user view
          <>
            {/* Soul Bot Chat - Always visible for regular users */}
            <View style={styles.soulBotSection}>
              {backendUser?.soul_bot_group_uid ? (
                <SoulBotChatItem 
                  soulBotGroupId={backendUser.soul_bot_group_uid}
                  lastMessage={
                    liveGroups
                      .find(group => group.uid === backendUser.soul_bot_group_uid)
                      ?.recentMessage ? {
                        messageText: liveGroups.find(group => group.uid === backendUser.soul_bot_group_uid)!.recentMessage!.messageText,
                        sentAt: FirebaseService.convertTimestampToDate(liveGroups.find(group => group.uid === backendUser.soul_bot_group_uid)!.recentMessage!.sentAt)
                      } : undefined
                  }
                />
              ) : (
                <View style={styles.soulBotUnavailable}>
                  <Text style={styles.soulBotUnavailableText}>
                    Soul Bot is being set up for your account...
                  </Text>
                </View>
              )}
            </View>

            {/* Live Chats */}
            <CollapsibleSection title="Live Chats" initialExpanded={true}>
              {liveGroupsWithMembership.filter(g => g.group.type !== 'soul_bot').length > 0 ? (
                liveGroupsWithMembership.filter(g => g.group.type !== 'soul_bot').map((groupWithMembership) => {
                  const group = groupWithMembership.group;
                  const membership = groupWithMembership.membership;
                  return (
                    <ChatItem
                      key={group.uid}
                      group={{
                        uid: group.uid,
                        name: group.name,
                        description: group.description,
                        defaultGroupPicUrl: group.defaultGroupPicUrl,
                        recentMessage: group.recentMessage ? {
                          messageText: group.recentMessage.messageText,
                          sentAt: FirebaseService.convertTimestampToDate(group.recentMessage.sentAt),
                          sentByName: group.recentMessage.sentByName,
                          readBy: group.recentMessage.readBy,
                        } : undefined,
                        cost: undefined,
                        currentMembers: group.currentMembers,
                      }}
                      memberRecentMessage={membership?.recentMessage ? {
                        messageText: membership.recentMessage.messageText,
                        sentAt: FirebaseService.convertTimestampToDate(membership.recentMessage.sentAt),
                        sentByName: membership.recentMessage.sentByName,
                        readBy: membership.recentMessage.readBy || [],
                      } : undefined}
                      onPress={() => handleChatPress(group)}
                    />
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No active chats yet</Text>
                </View>
              )}
            </CollapsibleSection>

            {/* Recommended Chats */}
            <CollapsibleSection title="Recommended Chats" initialExpanded={true}>
              <LoadingWithError
                loading={loadingRecommended}
                error={recommendedError}
                onRetry={fetchRecommendedGroups}
                loadingComponent={
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading recommendations...</Text>
                  </View>
                }
              >
                {recommendedGroups.length > 0 ? (
                  <>
                    {recommendedGroups.map((group) => {
                      const groupCardData = convertToGroupCardData(group);
                      return (
                        <GroupCard
                          key={group.id}
                          group={groupCardData}
                          onPress={handleRecommendedChatPress}
                          loading={loadingGroupId === group.id}
                        />
                      );
                    })}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No recommended groups available</Text>
                  </View>
                )}
              </LoadingWithError>
            </CollapsibleSection>
          </>
        ) : (
          // Medic user view
          <>
            {/* Soul Bot Chat - Also visible for medics */}
            <View style={styles.soulBotSection}>
              {backendUser?.soul_bot_group_uid ? (
                <SoulBotChatItem 
                  soulBotGroupId={backendUser.soul_bot_group_uid}
                  lastMessage={
                    // For medics, search in both groups arrays
                    [...medicGroups.groupsYouRun, ...medicGroups.groupsYouJoined]
                      .find(g => g.group.uid === backendUser.soul_bot_group_uid)
                      ?.group.recentMessage ? {
                        messageText: [...medicGroups.groupsYouRun, ...medicGroups.groupsYouJoined]
                          .find(g => g.group.uid === backendUser.soul_bot_group_uid)!.group.recentMessage!.messageText,
                        sentAt: FirebaseService.convertTimestampToDate([...medicGroups.groupsYouRun, ...medicGroups.groupsYouJoined]
                          .find(g => g.group.uid === backendUser.soul_bot_group_uid)!.group.recentMessage!.sentAt)
                      } : undefined
                  }
                />
              ) : (
                <View style={styles.soulBotUnavailable}>
                  <Text style={styles.soulBotUnavailableText}>
                    Soul Bot is being set up for your account...
                  </Text>
                </View>
              )}
            </View>

            {/* Create Group Button */}
            <View style={styles.createButtonContainer}>
              <TouchableOpacity style={styles.createButton} onPress={handleCreateGroupPress}>
                <Ionicons name="add" size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {/* Groups you run */}
            <CollapsibleSection title="Groups you run" initialExpanded={true}>
              {groupsYouRunWithMembership.length > 0 ? (
                groupsYouRunWithMembership.map((groupWithMembership) => {
                  const group = groupWithMembership.group;
                  const membership = groupWithMembership.membership;
                  return (
                    <ChatItem
                      key={group.uid}
                      group={{
                        uid: group.uid,
                        name: group.name,
                        description: group.description,
                        defaultGroupPicUrl: group.defaultGroupPicUrl,
                        recentMessage: group.recentMessage ? {
                          messageText: group.recentMessage.messageText,
                          sentAt: FirebaseService.convertTimestampToDate(group.recentMessage.sentAt),
                          sentByName: group.recentMessage.sentByName,
                          readBy: group.recentMessage.readBy,
                        } : undefined,
                        cost: group.cost,
                        currentMembers: group.currentMembers,
                        status: group.status,
                      }}
                      memberRecentMessage={membership?.recentMessage ? {
                        messageText: membership.recentMessage.messageText,
                        sentAt: FirebaseService.convertTimestampToDate(membership.recentMessage.sentAt),
                        sentByName: membership.recentMessage.sentByName,
                        readBy: membership.recentMessage.readBy || [],
                      } : undefined}
                      onPress={() => handleChatPress(group)}
                      showStatus={true}
                    />
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No groups created yet</Text>
                </View>
              )}
            </CollapsibleSection>

            {/* Groups you joined */}
            <CollapsibleSection title="Groups you joined" initialExpanded={true}>
              {groupsYouJoinedWithMembership.length > 0 ? (
                groupsYouJoinedWithMembership.map((groupWithMembership) => {
                  const group = groupWithMembership.group;
                  const membership = groupWithMembership.membership;
                  return (
                    <ChatItem
                      key={group.uid}
                      group={{
                        uid: group.uid,
                        name: group.name,
                        description: group.description,
                        defaultGroupPicUrl: group.defaultGroupPicUrl,
                        recentMessage: group.recentMessage ? {
                          messageText: group.recentMessage.messageText,
                          sentAt: FirebaseService.convertTimestampToDate(group.recentMessage.sentAt),
                          sentByName: group.recentMessage.sentByName,
                          readBy: group.recentMessage.readBy,
                        } : undefined,
                        cost: group.cost,
                        currentMembers: group.currentMembers,
                        status: group.status,
                      }}
                      memberRecentMessage={membership?.recentMessage ? {
                        messageText: membership.recentMessage.messageText,
                        sentAt: FirebaseService.convertTimestampToDate(membership.recentMessage.sentAt),
                        sentByName: membership.recentMessage.sentByName,
                        readBy: membership.recentMessage.readBy || [],
                      } : undefined}
                      onPress={() => handleChatPress(group)}
                      showStatus={true}
                    />
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No joined groups yet</Text>
                </View>
              )}
            </CollapsibleSection>
          </>
        )}

        {/* Spacer */}
        <View style={{ paddingBottom: 16 }}></View>
      </ScrollView>

      {/* Join Group Modal */}
      {selectedGroup && (
        <JoinGroupModal
          visible={joinModalVisible}
          onClose={closeJoinModal}
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          groupDescription={selectedGroup.description}
          groupCost={selectedGroup.cost}
          expiryDate={selectedGroup.expiryDate}
          isFreeGroup={selectedGroup.isFreeGroup}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.secondaryText,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#ff3b30',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorBannerText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  createButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  createButton: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  soulBotSection: {
    marginTop: 8,
  },
  soulBotUnavailable: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  soulBotUnavailableText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});