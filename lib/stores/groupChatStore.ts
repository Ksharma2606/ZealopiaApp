import { create } from 'zustand';
import { Platform } from 'react-native';
import FirebaseService, { Group, GroupMembership, GroupMember } from '../services/FirebaseService';
import { FirebaseChatManager } from '../services/FirebaseChatManager';

// Enhanced group interface with unread count
export interface GroupWithUnreadCount {
  group: Group;
  unreadCount: number;
  membership: GroupMember | null; // GroupMember from group.members array (includes per-user recentMessage)
}

// Medic group categories interface
export interface MedicGroups {
  groupsYouRun: GroupWithUnreadCount[];
  groupsYouJoined: GroupWithUnreadCount[];
}

// Store state interface
interface GroupChatStore {
  // State
  groups: Map<string, GroupWithUnreadCount>;
  medicGroupsCreated: Map<string, GroupWithUnreadCount>; // Groups medic created/runs
  medicGroupsJoined: Map<string, GroupWithUnreadCount>; // Groups medic joined
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  currentUserId: string | null;
  currentGroupId: string | null; // Track currently open group
  isUserMedic: boolean; // Track if current user is medic
  
  // Private subscription management
  groupSubscriptions: Map<string, () => void>;
  markAsReadPromises: Map<string, Promise<void>>; // Track in-progress markGroupAsRead calls
  
  // Actions
  initialize: (userId: string) => Promise<void>;
  cleanup: () => void;
  markGroupAsRead: (groupId: string) => Promise<void>;
  openGroupFromNotification: (groupId: string) => void;
  clearError: () => void;
  setCurrentGroupId: (groupId: string | null) => void;
  optimisticallyUpdateRecentMessage: (groupId: string, messageText: string, userId: string) => void;
  
  // Getters
  getUserGroups: () => GroupWithUnreadCount[];
  getMedicGroups: () => MedicGroups;
  getGroupById: (groupId: string) => GroupWithUnreadCount | undefined;
  getTotalUnreadCount: () => number;
  fetchGroupIfNeeded: (groupId: string) => Promise<GroupWithUnreadCount | null>;
}

export const useGroupChatStore = create<GroupChatStore>((set, get) => ({
  // Initial state
  groups: new Map(),
  medicGroupsCreated: new Map(),
  medicGroupsJoined: new Map(),
  isInitialized: false,
  isLoading: false,
  error: null,
  currentUserId: null,
  currentGroupId: null,
  isUserMedic: false,
  groupSubscriptions: new Map(),
  markAsReadPromises: new Map(),
  
  // Initialize store with user's groups
  initialize: async (userId: string) => {
    const state = get();

    // Prevent double initialization
    if (state.isInitialized && state.currentUserId === userId) {
      return;
    }

    // Cleanup existing subscriptions if switching users
    if (state.currentUserId !== userId) {
      state.cleanup();
    }

    set({ isLoading: true, error: null, currentUserId: userId });

    try {
      // First, check if user is medic by getting their Firebase profiles
      const userProfiles = await FirebaseService.getUserProfiles(userId);
      const isUserMedic = FirebaseService.isUserMedic(userProfiles);

      set({ isUserMedic });

      // Initialize FirebaseChatManager for this user
      FirebaseChatManager.initialize(userId, isUserMedic);

      // Subscribe to groups via FirebaseChatManager (unified for both medic and regular users)
      const unsubscribe = FirebaseChatManager.subscribeToGroups(
        (groups) => {

          // Separate groups based on user type
          if (isUserMedic) {
            // For medics, separate into created and joined groups
            const groupsCreated = new Map<string, GroupWithUnreadCount>();
            const groupsJoined = new Map<string, GroupWithUnreadCount>();
            const currentState = get();

            for (const group of groups) {
              try {
                const userMember = group.members?.find(m => m.userId === userId);

                // Always use the server value from Firebase
                // Optimistic updates happen immediately, but we trust server updates when they arrive
                const unreadCount = userMember?.numUnread || 0;

                const groupWithUnread: GroupWithUnreadCount = {
                  group,
                  unreadCount,
                  membership: userMember || null
                };

                // Categorize based on createdBy
                if (group.createdBy?.path === `user/${userId}`) {
                  groupsCreated.set(group.uid, groupWithUnread);
                } else {
                  // Filter out soul bot groups from joined
                  if (group.type !== 'soul_bot') {
                    groupsJoined.set(group.uid, groupWithUnread);
                  }
                }
              } catch (error) {
                // Error processing medic group
              }
            }

            set({
              medicGroupsCreated: groupsCreated,
              medicGroupsJoined: groupsJoined,
              isLoading: false,
              isInitialized: true,
            });
          } else {
            // For regular users, use single groups map
            const groupsWithUnreadCount = new Map<string, GroupWithUnreadCount>();
            const currentState = get();

            for (const group of groups) {
              try {
                const userMember = group.members?.find(m => m.userId === userId);

                // Always use the server value from Firebase
                // Optimistic updates happen immediately, but we trust server updates when they arrive
                const unreadCount = userMember?.numUnread || 0;

                groupsWithUnreadCount.set(group.uid, {
                  group,
                  unreadCount,
                  membership: userMember || null
                });
              } catch (error) {
                groupsWithUnreadCount.set(group.uid, {
                  group,
                  unreadCount: 0,
                  membership: null
                });
              }
            }

            set({
              groups: groupsWithUnreadCount,
              isLoading: false,
              isInitialized: true,
              error: null,
            });
          }
        },
        (error) => {
          set({
            error: error.message,
            isLoading: false
          });
        }
      );

      // Store the groups subscription
      get().groupSubscriptions.set('__main__', unsubscribe);

    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize chat store',
        isLoading: false
      });
    }
  },
  
  
  // Mark a group as read - delegates to FirebaseChatManager
  markGroupAsRead: async (groupId: string) => {
    const state = get();

    if (!state.currentUserId) {
      return;
    }

    // STEP 1: Immediate optimistic UI update (happens instantly)
    set(state => {
      const updatedGroups = new Map(state.groups);
      const updatedMedicCreated = new Map(state.medicGroupsCreated);
      const updatedMedicJoined = new Map(state.medicGroupsJoined);

      // Helper function to update group in any map
      const updateGroupInMap = (groupsMap: Map<string, GroupWithUnreadCount>) => {
        const existingGroup = groupsMap.get(groupId);
        if (existingGroup) {
          groupsMap.set(groupId, {
            ...existingGroup,
            unreadCount: 0
          });
          return true;
        }
        return false;
      };

      // Try to update in all possible group maps
      let updated = false;
      updated = updateGroupInMap(updatedGroups) || updated;
      updated = updateGroupInMap(updatedMedicCreated) || updated;
      updated = updateGroupInMap(updatedMedicJoined) || updated;

      return {
        groups: updatedGroups,
        medicGroupsCreated: updatedMedicCreated,
        medicGroupsJoined: updatedMedicJoined,
      };
    });

    // STEP 2: Delegate to FirebaseChatManager (debounced, deduplicated)
    const firebasePromise = (async () => {
      try {
        await FirebaseChatManager.markAsRead(groupId);
      } catch (error) {
        // markAsRead failed
      }
    })();

    // Return the promise (but callers shouldn't await it for fire-and-forget)
    return firebasePromise;
  },
  
  // Handle opening group from push notification
  openGroupFromNotification: (groupId: string) => {
    const state = get();
    const group = state.groups.get(groupId);

    if (!group) {
      // Group not found in store, may need to initialize
      return;
    }
    
    // Mark as read when opened from notification
    state.markGroupAsRead(groupId);
    
    // Note: Actual navigation should be handled by the notification service
    // This method just ensures the group is properly loaded and marked as read
  },
  
  // Cleanup all subscriptions
  cleanup: () => {
    const state = get();

    // Unsubscribe from all group subscriptions
    state.groupSubscriptions.forEach((unsubscribe, key) => {
      try {
        unsubscribe();
      } catch (error) {
        // Error unsubscribing
      }
    });

    // Cleanup FirebaseChatManager (will flush pending mark-as-read operations)
    FirebaseChatManager.cleanup();

    // Reset state
    set({
      groups: new Map(),
      medicGroupsCreated: new Map(),
      medicGroupsJoined: new Map(),
      isInitialized: false,
      isLoading: false,
      error: null,
      currentUserId: null,
      currentGroupId: null,
      isUserMedic: false,
      groupSubscriptions: new Map(),
      markAsReadPromises: new Map(),
    });
  },
  
  // Clear error state
  clearError: () => {
    set({ error: null });
  },
  
  // Set the currently open group
  setCurrentGroupId: (groupId: string | null) => {
    set({ currentGroupId: groupId });
  },

  // Optimistically update recent message for immediate UI feedback
  optimisticallyUpdateRecentMessage: (groupId: string, messageText: string, userId: string) => {
    return;
    console.log('[GroupChatStore] Optimistically updating recent message for group:', groupId, messageText.substring(0, 50));
    
    set(state => {
      const updatedGroups = new Map(state.groups);
      const updatedMedicCreated = new Map(state.medicGroupsCreated);
      const updatedMedicJoined = new Map(state.medicGroupsJoined);
      
      // Helper function to update group in a map
      const updateGroupInMap = (groupsMap: Map<string, GroupWithUnreadCount>) => {
        const existingGroup = groupsMap.get(groupId);
        if (existingGroup) {
          groupsMap.set(groupId, {
            ...existingGroup,
            group: {
              ...existingGroup.group,
              recentMessage: {
                messageText: messageText,
                sentAt: new Date(), // Immediate local timestamp
                sentByName: 'You',
                readBy: [userId],
                sentBy: { path: `user/${userId}` } // Matches Firebase reference format
              }
            }
          });
          return true;
        }
        return false;
      };
      
      // Try to update in all possible group maps
      let updated = false;
      updated = updateGroupInMap(updatedGroups) || updated;
      updated = updateGroupInMap(updatedMedicCreated) || updated;
      updated = updateGroupInMap(updatedMedicJoined) || updated;
      
      if (updated) {
        console.log('[GroupChatStore] Recent message optimistically updated for group:', groupId);
      } else {
        console.warn('[GroupChatStore] Group not found for optimistic update:', groupId);
      }
      
      return { 
        groups: updatedGroups,
        medicGroupsCreated: updatedMedicCreated,
        medicGroupsJoined: updatedMedicJoined
      };
    });
  },
  
  // Get all user groups as array (for regular users)
  getUserGroups: () => {
    const state = get();
    return Array.from(state.groups.values()).sort((a, b) => {
      // Sort by recent message timestamp (most recent first)
      // Handle different timestamp formats safely
      const getTimestamp = (sentAt: any): number => {
        if (!sentAt) return 0;
        
        // If it's a Firestore Timestamp with toDate method
        if (typeof sentAt.toDate === 'function') {
          return sentAt.toDate().getTime();
        }
        
        // If it's already a Date object
        if (sentAt instanceof Date) {
          return sentAt.getTime();
        }
        
        // If it's a number (timestamp)
        if (typeof sentAt === 'number') {
          return sentAt;
        }
        
        // If it's a string that can be parsed as date
        if (typeof sentAt === 'string') {
          const parsed = new Date(sentAt);
          return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        }
        
        // Fallback
        return 0;
      };
      
      const aTime = getTimestamp(a.group.recentMessage?.sentAt);
      const bTime = getTimestamp(b.group.recentMessage?.sentAt);
      return bTime - aTime;
    });
  },

  // Get medic groups categorized (for medic users)
  getMedicGroups: (): MedicGroups => {
    const state = get();
    
    const sortGroups = (groups: GroupWithUnreadCount[]) => {
      return groups.sort((a, b) => {
        // Sort by recent message timestamp (most recent first)
        const getTimestamp = (sentAt: any): number => {
          if (!sentAt) return 0;
          
          if (typeof sentAt.toDate === 'function') {
            return sentAt.toDate().getTime();
          }
          
          if (sentAt instanceof Date) {
            return sentAt.getTime();
          }
          
          if (typeof sentAt === 'string') {
            return new Date(sentAt).getTime();
          }
          
          if (typeof sentAt === 'number') {
            return sentAt;
          }
          
          return 0;
        };
        
        const aTime = getTimestamp(a.group.recentMessage?.sentAt);
        const bTime = getTimestamp(b.group.recentMessage?.sentAt);
        
        return bTime - aTime;
      });
    };

    return {
      groupsYouRun: sortGroups(Array.from(state.medicGroupsCreated.values())),
      groupsYouJoined: sortGroups(Array.from(state.medicGroupsJoined.values()))
    };
  },
  
  // Get specific group by ID
  getGroupById: (groupId: string) => {
    const state = get();
    // Check all possible group maps
    return state.groups.get(groupId) || 
           state.medicGroupsCreated.get(groupId) || 
           state.medicGroupsJoined.get(groupId);
  },
  
  // Get total unread count across all groups
  getTotalUnreadCount: () => {
    const state = get();
    let total = 0;

    // Add regular groups unread count
    total += Array.from(state.groups.values()).reduce((sum, group) => sum + group.unreadCount, 0);

    // Add medic groups unread counts
    total += Array.from(state.medicGroupsCreated.values()).reduce((sum, group) => sum + group.unreadCount, 0);
    total += Array.from(state.medicGroupsJoined.values()).reduce((sum, group) => sum + group.unreadCount, 0);

    return total;
  },

  // Fetch a specific group if it's not already in the store
  fetchGroupIfNeeded: async (groupId: string): Promise<GroupWithUnreadCount | null> => {
    const state = get();

    // First check if group is already in store
    const existingGroup = state.getGroupById(groupId);
    if (existingGroup) {
      return existingGroup;
    }

    // If not in store and user is authenticated, fetch it
    if (!state.currentUserId) {
      return null;
    }

    try {
      const group = await FirebaseService.getGroupById(groupId);

      if (!group) {
        return null;
      }

      // Get membership and unread count
      const membership = await FirebaseService.getUserGroupMembership(state.currentUserId, groupId);
      const unreadCount = await FirebaseService.getUnreadMessageCount(groupId, state.currentUserId);

      const groupWithUnread: GroupWithUnreadCount = {
        group,
        unreadCount,
        membership
      };

      // Add to store
      set(state => {
        const updatedGroups = new Map(state.groups);
        updatedGroups.set(groupId, groupWithUnread);
        return { groups: updatedGroups };
      });

      // No individual subscription needed - unread counts come from server

      return groupWithUnread;
    } catch (error) {
      return null;
    }
  },
  
}));

// Export a singleton instance for direct access outside of React components
export const groupChatStore = useGroupChatStore;