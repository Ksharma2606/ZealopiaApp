import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { useAuth } from '@/lib/context/AuthContext';
import { CacheManager } from '@/lib/utils/CacheManager';
import { RequestManager } from '@/lib/utils/RequestManager';

// Type definitions based on Firebase schema
export interface MessageAttachment {
  id: string;
  type: 'image' | 'audio' | 'video';
  url: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  transcription?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionConfidence?: number;
}

export interface RecentMessage {
  messageText: string;
  sentAt: FirebaseFirestoreTypes.Timestamp | null;
  sentBy: FirebaseFirestoreTypes.DocumentReference;
  sentByName: string;
  readBy: string[];
  attachments?: MessageAttachment[];
  ref?: FirebaseFirestoreTypes.DocumentReference;
}

export interface Message {
  id: string;
  messageText: string;
  sentAt: FirebaseFirestoreTypes.Timestamp;
  sentBy: FirebaseFirestoreTypes.DocumentReference;
  sentByName: string;
  readBy?: string[];
}

export interface GroupMembership {
  groupId: string;
  userId: string;
  lastSeenMessage?: FirebaseFirestoreTypes.DocumentReference; // Maps to last_seen_message in Firestore
  joinedAt: FirebaseFirestoreTypes.Timestamp;
}

export interface GroupMember {
  userId: string;
  current: boolean;
  numUnread: number;
  role: string;
  lastSeenMessage?: FirebaseFirestoreTypes.DocumentReference; // Reference to last seen message
  // Per-user recent message for user-specific messages (e.g., renewal reminders)
  recentMessage?: RecentMessage;
  tenures: Array<{
    start: FirebaseFirestoreTypes.Timestamp;
    end?: FirebaseFirestoreTypes.Timestamp;
  }>;
}

export interface Group {
  uid: string;
  id: number;
  name: string;
  description?: string;
  status: string;
  type: string;
  visible: boolean;
  cost?: number;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  createdBy: FirebaseFirestoreTypes.DocumentReference;
  medic?: FirebaseFirestoreTypes.DocumentReference;
  currentMembers: string[];
  members: GroupMember[];
  recentMessage?: RecentMessage;
  defaultGroupPicUrl?: string;
  messages?: FirebaseFirestoreTypes.DocumentReference;
  // For 1:1 medic chats
  sharePreviousSummaryRequested?: boolean;
  hasPreviousMedicChats?: boolean;
}

export interface User {
  uid: string;
  id: number;
  name?: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  phoneNumber?: string;
  profiles: string[];
  createdTime: FirebaseFirestoreTypes.Timestamp;
  memberships?: FirebaseFirestoreTypes.DocumentReference;
}

interface CachedUserDocument {
  data: any;
  timestamp: number;
}

class FirebaseService {
  private db = firestore();

  // User document cache with TTL
  private static userCache = new Map<string, CachedUserDocument>();
  private static USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Cache managers for different data types (Flutter Flow pattern)
  private static membershipCacheManager = new CacheManager<GroupMembership | null>('Membership', 5 * 60 * 1000);
  private static groupCacheManager = new CacheManager<Group | null>('Group', 5 * 60 * 1000);
  private static userDisplayNameCacheManager = new CacheManager<string>('UserDisplayName', 5 * 60 * 1000);

  // Request managers to prevent duplicate in-flight requests
  private static userDisplayNameRequestManager = new RequestManager<string>();
  private static membershipRequestManager = new RequestManager<GroupMembership | null>();

  // Get user document with caching
  private async getCachedUserDocument(userId: string): Promise<any> {
    // Check if we have a cached version that's still valid
    const cached = FirebaseService.userCache.get(userId);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < FirebaseService.USER_CACHE_TTL) {
      return cached.data;
    }

    // Cache miss or expired - fetch from Firebase
    const userDoc = await this.db.collection('user').doc(userId).get();
    const userData = userDoc.data();

    // Cache the result
    FirebaseService.userCache.set(userId, {
      data: userData,
      timestamp: now
    });

    return userData;
  }

  // Clear user cache (useful when user data might have changed)
  static clearUserCache(userId?: string): void {
    if (userId) {
      FirebaseService.userCache.delete(userId);
    } else {
      FirebaseService.userCache.clear();
    }
  }

  // Clear all cache managers (useful when user logs out or data needs refresh)
  static clearAllCaches(): void {
    FirebaseService.userCache.clear();
    FirebaseService.membershipCacheManager.clear();
    FirebaseService.groupCacheManager.clear();
    FirebaseService.userDisplayNameCacheManager.clear();
  }

  // Clear membership cache for a specific user-group pair
  static clearMembershipCache(userId: string, groupId: string): void {
    const cacheKey = `${userId}_${groupId}`;
    FirebaseService.membershipCacheManager.clearKey(cacheKey);
  }

  // Clear group cache for a specific group
  static clearGroupCache(groupId: string): void {
    FirebaseService.groupCacheManager.clearKey(groupId);
  }

  // Group queries
  getUserGroups(userId: string): FirebaseFirestoreTypes.Query<Group> {
    return this.db
      .collection('group')
      .where('currentMembers', 'array-contains', userId)
      .where('visible', '==', true)
      .orderBy('recentMessage.sentAt', 'desc')
      .limit(25) as FirebaseFirestoreTypes.Query<Group>;
  }

  getGroupsCreatedByUser(userRef: FirebaseFirestoreTypes.DocumentReference): FirebaseFirestoreTypes.Query<Group> {
    return this.db
      .collection('group')
      .where('createdBy', '==', userRef)
      .where('type', 'in', ['group', 'dm', 'one_on_one']) // Include regular groups, DM groups, and 1-1 groups created by medic
      .where('currentMembers', 'array-contains', userRef.id)
      .orderBy('recentMessage.sentAt', 'desc')
      .limit(25) as FirebaseFirestoreTypes.Query<Group>;
  }

  getGroupsJoinedByUser(userId: string, userRef: FirebaseFirestoreTypes.DocumentReference): FirebaseFirestoreTypes.Query<Group> {
    return this.db
      .collection('group')
      .where('currentMembers', 'array-contains', userId)
      .where('createdBy', '!=', userRef)
      .where('visible', '==', true)
      .orderBy('createdBy')
      .orderBy('recentMessage.sentAt', 'desc')
      .limit(25) as FirebaseFirestoreTypes.Query<Group>;
  }

  // Get a specific group by ID (with caching)
  async getGroupById(groupId: string, overrideCache: boolean = false): Promise<Group | null> {
    try {
      // Use CacheManager to cache group data (Flutter Flow pattern)
      return await FirebaseService.groupCacheManager.performRequest(
        groupId,
        async () => {
          const groupDoc = await this.db.collection('group').doc(groupId).get();
          if (groupDoc.exists) {
            return { uid: groupDoc.id, ...groupDoc.data() } as Group;
          }
          return null;
        },
        overrideCache
      );
    } catch (error) {
      console.error('[FirebaseService] Error fetching group by ID:', error);
      return null;
    }
  }

  // User queries
  getUser(userId: string): FirebaseFirestoreTypes.DocumentReference<User> {
    return this.db.collection('user').doc(userId) as FirebaseFirestoreTypes.DocumentReference<User>;
  }

  getUserByUid(uid: string): FirebaseFirestoreTypes.Query<User> {
    return this.db
      .collection('user')
      .where('uid', '==', uid)
      .limit(1) as FirebaseFirestoreTypes.Query<User>;
  }

  // Utility methods
  convertTimestampToDate(timestamp: FirebaseFirestoreTypes.Timestamp | null | undefined): Date {
    if (!timestamp) {
      return new Date(); // Return current date as fallback
    }
    
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Fallback for other timestamp formats
    return new Date(timestamp as any);
  }

  createUserReference(userId: string): FirebaseFirestoreTypes.DocumentReference {
    return this.db.collection('user').doc(userId);
  }

  // Real-time listeners
  subscribeToUserGroups(
    userId: string,
    onSnapshot: (groups: Group[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    // Use a more inclusive query similar to Flutter Flow approach
    // Remove the visible requirement to include DM groups and filter in-memory instead
    return this.db
      .collection('group')
      .where('currentMembers', 'array-contains', userId)
      .orderBy('recentMessage.sentAt', 'desc')
      .limit(25)
      .onSnapshot(
        async (snapshot) => {
          const groups: Group[] = [];
          
          // Process each group and transform DM group names
          for (const doc of snapshot.docs) {
            const data = doc.data();
            let group = {
              ...data,
              uid: doc.id,
            } as Group;
            
            // In-memory filtering: include groups that are either visible OR are DM/1-1 groups
            if (group.visible === true || group.type === 'dm' || group.type === 'one_on_one') {
              // Transform DM group names to show the other person's name
              if (group.type === 'dm') {
                group = await this.transformDMGroupName(group, userId);
              }
              groups.push(group);
            }
          }
          
          onSnapshot(groups);
        },
        onError
      );
  }

  subscribeToGroupsCreatedByUser(
    userRef: FirebaseFirestoreTypes.DocumentReference,
    onSnapshot: (groups: Group[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    return this.getGroupsCreatedByUser(userRef).onSnapshot(
      (snapshot) => {
        const groups: Group[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          groups.push({
            ...data,
            uid: doc.id,
          } as Group);
        });
        onSnapshot(groups);
      },
      onError
    );
  }

  subscribeToGroupsJoinedByUser(
    userId: string,
    userRef: FirebaseFirestoreTypes.DocumentReference,
    onSnapshot: (groups: Group[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    return this.getGroupsJoinedByUser(userId, userRef).onSnapshot(
      (snapshot) => {
        const groups: Group[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          groups.push({
            ...data,
            uid: doc.id,
          } as Group);
        });
        onSnapshot(groups);
      },
      onError
    );
  }

  // Check if user is medic
  isUserMedic(userProfiles: string[]): boolean {
    return userProfiles.includes('medic'); // Adjust this constant as needed
  }

  // Get user's display name by Firebase UID (with caching and request deduplication)
  async getUserDisplayName(userFirebaseUid: string): Promise<string> {
    try {
      // Use CacheManager for caching AND RequestManager to prevent duplicate in-flight requests
      // This is especially important when transforming multiple DM groups in parallel
      return await FirebaseService.userDisplayNameCacheManager.performRequest(
        userFirebaseUid,
        async () => {
          // Use RequestManager to prevent multiple simultaneous requests for same user
          return await FirebaseService.userDisplayNameRequestManager.performRequest(
            userFirebaseUid,
            async () => {
              const userData = await this.getCachedUserDocument(userFirebaseUid);
              return userData?.name || userData?.displayName || 'Unknown User';
            }
          );
        }
      );
    } catch (error) {
      console.error('Error getting user display name:', error);
      return 'Unknown User';
    }
  }

  // Transform DM group to show the other person's name
  async transformDMGroupName(group: Group, currentUserFirebaseUid: string): Promise<Group> {
    if (group.type !== 'dm') {
      return group; // Not a DM group, return as-is
    }

    try {
      // Find the other member's UID (not the current user)
      const otherMemberUid = group.currentMembers.find(memberUid => memberUid !== currentUserFirebaseUid);
      
      if (otherMemberUid) {
        // Get the other person's name
        const otherPersonName = await this.getUserDisplayName(otherMemberUid);
        
        // Return group with modified name
        return {
          ...group,
          name: otherPersonName
        };
      }
    } catch (error) {
      console.error('Error transforming DM group name:', error);
    }

    return group; // Fallback to original group
  }

  // Add method to get Firebase user profiles
  async getUserProfiles(userId: string): Promise<string[]> {
    try {
      const userData = await this.getCachedUserDocument(userId);
      return userData?.profiles || [];
    } catch (error) {
      console.error('Error getting user profiles:', error);
      return [];
    }
  }

  // Subscribe to medic-specific groups (groups they created/run)
  subscribeToMedicGroupsCreated(
    userId: string,
    onSnapshot: (groups: Group[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const userRef = this.createUserReference(userId);
    return this.getGroupsCreatedByUser(userRef).onSnapshot(
      async (snapshot) => {
        const groups: Group[] = [];
        
        // Process each group and transform DM group names
        for (const doc of snapshot.docs) {
          const data = doc.data();
          let group = {
            ...data,
            uid: doc.id,
          } as Group;
          
          // Transform DM group names to show the other person's name
          if (group.type === 'dm') {
            group = await this.transformDMGroupName(group, userId);
          }
          
          groups.push(group);
        }
        
        onSnapshot(groups);
      },
      onError
    );
  }

  // Subscribe to medic-specific groups (groups they joined)
  subscribeToMedicGroupsJoined(
    userId: string,
    onSnapshot: (groups: Group[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const userRef = this.createUserReference(userId);
    
    // Use a more inclusive query that matches Flutter Flow approach
    // Remove the visible requirement to include DM groups and filter in-memory instead
    return this.db
      .collection('group')
      .where('currentMembers', 'array-contains', userId)
      .where('createdBy', '!=', userRef)
      .orderBy('createdBy')
      .orderBy('recentMessage.sentAt', 'desc')
      .limit(25)
      .onSnapshot(
        async (snapshot) => {
          const groups: Group[] = [];
          
          // Process each group and transform DM group names
          for (const doc of snapshot.docs) {
            const data = doc.data();
            let group = {
              ...data,
              uid: doc.id,
            } as Group;
            
            // In-memory filtering: include groups that are either visible OR are DM/1-1 groups
            if (group.visible === true || group.type === 'dm' || group.type === 'one_on_one') {
              // Transform DM group names to show the other person's name
              if (group.type === 'dm') {
                group = await this.transformDMGroupName(group, userId);
              }
              groups.push(group);
            }
          }
          
          onSnapshot(groups);
        },
        onError
      );
  }

  // Unread message count methods
  async getUnreadMessageCount(
    groupId: string,
    userId: string,
    lastSeenMessageRef?: FirebaseFirestoreTypes.DocumentReference
  ): Promise<number> {
    try {
      // Based on the logs, messages are stored in 'message' collection, not 'group' collection
      const messagesRef = this.db.collection('message').doc(groupId).collection('messages');
      
      if (!lastSeenMessageRef) {
        // PERFORMANCE FIX: Use aggregateCount without complex queries to avoid index issues
        try {
          // Simple count without status filter to avoid collection group index requirement
          const snapshot = await messagesRef.count().get();
          const count = snapshot.data().count;
          return count;
        } catch (error) {
          // Fallback: Use simple query without status filter
          const snapshot = await messagesRef.get();
          return snapshot.size;
        }
      }

      // console.log('Getting last seen message timestamp from:', lastSeenMessageRef.path);
      // Get the last seen message timestamp
      const lastSeenDoc = await lastSeenMessageRef.get();
      if (!lastSeenDoc.exists) {
        // PERFORMANCE FIX: Use count aggregation without status filter
        try {
          const snapshot = await messagesRef.count().get();
          const count = snapshot.data().count;
          return count;
        } catch (error) {
          const snapshot = await messagesRef.get();
          return snapshot.size;
        }
      }

      const lastSeenData = lastSeenDoc.data();
      const lastSeenTimestamp = lastSeenData?.sentAt;
      // console.log('Last seen timestamp:', lastSeenTimestamp);

      if (!lastSeenTimestamp) {
        // PERFORMANCE FIX: Use count aggregation without status filter
        try {
          const snapshot = await messagesRef.count().get();
          const count = snapshot.data().count;
          return count;
        } catch (error) {
          const snapshot = await messagesRef.get();
          return snapshot.size;
        }
      }

      // Add 1 second buffer to exclude the last seen message itself
      const bufferTimestamp = firestore.Timestamp.fromDate(
        new Date(lastSeenTimestamp.toDate().getTime() + 1000)
      );
      // console.log('Buffer timestamp:', bufferTimestamp.toDate());

      // Count messages sent after the last seen message - OPTIMIZED without status filter
      try {
        // Remove status filter to avoid collection group index requirement
        // Assumption: Most messages are visible, so the count will be close to accurate
        const query = messagesRef.where('sentAt', '>', bufferTimestamp);
        const snapshot = await query.count().get();
        const count = snapshot.data().count;
        return count;
      } catch (error) {
        // Fallback to old method if count() is not available
        const query = messagesRef.where('sentAt', '>', bufferTimestamp);
        const snapshot = await query.get();
        const count = snapshot.size;
        return count;
      }
    } catch (error) {
      console.error('Error getting unread message count:', error);
      return 0;
    }
  }

  // Update last seen message for a user in a group
  async updateLastSeenMessage(
    userId: string,
    groupId: string,
    messageRef: FirebaseFirestoreTypes.DocumentReference
  ): Promise<void> {
    try {
      // Based on Flutter Flow implementation, the correct path is:
      // user/{firebaseUID} -> memberships (DocumentReference) -> groups/{groupId}

      // 1. Get the user document to get the memberships reference (using cache)
      const userData = await this.getCachedUserDocument(userId);

      if (!userData?.memberships) {
        throw new Error('User has no memberships reference');
      }

      // 2. The memberships field is a DocumentReference to the membership document
      const membershipRef = userData.memberships as FirebaseFirestoreTypes.DocumentReference;

      // 3. Query the user's group membership in the correct subcollection
      const groupMembershipQuery = await membershipRef
        .collection('groups')
        .where('groupId', '==', groupId)
        .limit(1)
        .get();

      if (groupMembershipQuery.empty) {
        throw new Error(`No group membership found for group ${groupId}`);
      }

      // 4. Update the last_seen_message field
      const groupMembershipDoc = groupMembershipQuery.docs[0];

      await groupMembershipDoc.ref.update({
        last_seen_message: messageRef
      });

      // IMPORTANT: Also update the group document's members array
      // This triggers onGroupUpdate Cloud Function to recompute numUnread
      const groupRef = firestore().collection('group').doc(groupId);
      const groupDoc = await groupRef.get();

      if (groupDoc.exists) {
        const groupData = groupDoc.data();
        const members = groupData?.members || [];

        // Find and update the member's lastSeenMessage
        const updatedMembers = members.map((member: any) => {
          if (member.userId === userId) {
            return {
              ...member,
              lastSeenMessage: messageRef
            };
          }
          return member;
        });

        // Update group document with new members array
        await groupRef.update({ members: updatedMembers });
      }

      // Invalidate membership cache since lastSeenMessage changed
      FirebaseService.clearMembershipCache(userId, groupId);
    } catch (error) {
      console.error('Error updating last seen message:', error);
      throw error;
    }
  }

  // Get user's group membership with last seen message
  async getUserGroupMembership(userId: string, groupId: string, overrideCache: boolean = false): Promise<GroupMembership | null> {
    return this.getGroupMembership(userId, groupId, overrideCache);
  }

  async getGroupMembership(userId: string, groupId: string, overrideCache: boolean = false): Promise<GroupMembership | null> {
    try {
      // Use CacheManager to cache membership queries (Flutter Flow pattern)
      // This is critical because membership queries are expensive and frequent
      const cacheKey = `${userId}_${groupId}`;

      return await FirebaseService.membershipCacheManager.performRequest(
        cacheKey,
        async () => {
          // Use RequestManager to prevent duplicate in-flight requests
          return await FirebaseService.membershipRequestManager.performRequest(
            cacheKey,
            async () => {
              // Based on Flutter Flow implementation, the correct path is:
              // user/{firebaseUID} -> memberships (DocumentReference) -> groups/{groupId}

              // 1. Get the user document to get the memberships reference (using cache)
              const userData = await this.getCachedUserDocument(userId);

              if (!userData?.memberships) {
                // console.log('getGroupMembership: User has no memberships reference');
                return null;
              }

              // 2. The memberships field is a DocumentReference to the membership document
              const membershipRef = userData.memberships as FirebaseFirestoreTypes.DocumentReference;

              // 3. Query the user's group membership in the correct subcollection
              const groupMembershipQuery = await membershipRef
                .collection('groups')
                .where('groupId', '==', groupId)
                .limit(1)
                .get();

              if (groupMembershipQuery.empty) {
                return null;
              }

              const doc = groupMembershipQuery.docs[0];
              const data = doc.data();

              return {
                groupId,
                userId,
                lastSeenMessage: data?.last_seen_message, // Use snake_case field name
                joinedAt: data?.joinedAt || firestore.Timestamp.now()
              };
            }
          );
        },
        overrideCache
      );
    } catch (error) {
      console.error('Error getting group membership:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time updates for a user's group membership
   */
  subscribeToGroupMembership(
    userId: string,
    groupId: string,
    onUpdate: (membership: GroupMembership | null) => void,
    onError: (error: Error) => void
  ): () => void {
    let unsubscribeFn: (() => void) | null = null;

    // Set up the subscription asynchronously
    (async () => {
      try {
        // Get the user's membership reference
        const userData = await this.getCachedUserDocument(userId);

        if (!userData?.memberships) {
          onUpdate(null);
          return;
        }

        const membershipRef = userData.memberships as FirebaseFirestoreTypes.DocumentReference;

        // Query the user's group membership
        const querySnapshot = await membershipRef
          .collection('groups')
          .where('groupId', '==', groupId)
          .limit(1)
          .get();

        if (querySnapshot.empty) {
          onUpdate(null);
          return;
        }

        // Subscribe to the membership document
        const membershipDoc = querySnapshot.docs[0];
        unsubscribeFn = membershipDoc.ref.onSnapshot(
          (doc) => {
            if (doc.exists) {
              const data = doc.data();
              const membership: GroupMembership = {
                groupId,
                userId,
                lastSeenMessage: data?.last_seen_message,
                joinedAt: data?.joinedAt || firestore.Timestamp.now(),
                role: data?.role,
                color: data?.color,
              };
              onUpdate(membership);
            } else {
              onUpdate(null);
            }
          },
          (error) => {
            onError(error as Error);
          }
        );
      } catch (error) {
        onError(error as Error);
      }
    })();

    // Return unsubscribe function
    return () => {
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }

  /**
   * Get unread count on-demand (no real-time listener)
   * Optimized version that doesn't set up subscriptions
   *
   * Flutter Flow Reference:
   * - old_flutterflow_app/lib/components/live_chat_item_widget.dart:52-59
   */
  async getUnreadCountOnDemand(
    groupId: string,
    userId: string,
    lastSeenMessageRef?: FirebaseFirestoreTypes.DocumentReference
  ): Promise<number> {
    try {
      // If no lastSeenMessageRef provided, fetch it from membership
      if (!lastSeenMessageRef) {
        const userData = await this.getCachedUserDocument(userId);

        if (!userData?.memberships) {
          return 0;
        }

        const membershipRef = userData.memberships as FirebaseFirestoreTypes.DocumentReference;
        const groupMembershipQuery = await membershipRef
          .collection('groups')
          .where('groupId', '==', groupId)
          .limit(1)
          .get();

        if (groupMembershipQuery.empty) {
          return 0;
        }

        const membershipData = groupMembershipQuery.docs[0].data();
        lastSeenMessageRef = membershipData?.last_seen_message;
      }

      // Get the count using the existing method
      return await this.getUnreadMessageCount(groupId, userId, lastSeenMessageRef);
    } catch (error) {
      console.error('[FirebaseService] Error getting on-demand unread count:', error);
      return 0;
    }
  }

  /**
   * DEPRECATED: Use getUnreadCountOnDemand instead
   * This method sets up real-time listeners which cause excessive queries
   *
   * Subscribe to unread count changes for a specific group
   */
  subscribeToUnreadCount(
    groupId: string,
    userId: string,
    onUnreadCountChanged: (count: number) => void,
    onError?: (error: Error) => void
  ): () => void {
    let lastSeenMessageRef: FirebaseFirestoreTypes.DocumentReference | undefined;
    let unsubscribeMembership: (() => void) | undefined;
    let debounceTimer: NodeJS.Timeout | undefined;
    
    // Debounced function to calculate and emit unread count
    // This prevents rapid-fire updates during race conditions
    const debouncedUpdateCount = async (reason: string) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(async () => {
        try {
          const count = await this.getUnreadMessageCount(groupId, userId, lastSeenMessageRef);
          // console.log(`[FirebaseService] Unread count for group ${groupId} (${reason}):`, count);
          onUnreadCountChanged(count);
        } catch (error) {
          console.error('[FirebaseService] Error calculating unread count:', error);
          onError?.(error as Error);
        }
      }, 1000); // 1 second debounce - allows membership updates to propagate
    };
    
    // Set up the subscription asynchronously since we need to get the user's membership reference first
    const setupSubscription = async () => {
      try {
        // Get the user document to get the memberships reference (using cache)
        const userData = await this.getCachedUserDocument(userId);

        if (!userData?.memberships) {
          onUnreadCountChanged(0); // No memberships means no unread messages
          return;
        }

        // The memberships field is a DocumentReference to the membership document
        const membershipRef = userData.memberships as FirebaseFirestoreTypes.DocumentReference;

        // Query the user's group membership in the correct subcollection
        const groupMembershipQuery = await membershipRef
          .collection('groups')
          .where('groupId', '==', groupId)
          .limit(1)
          .get();

        if (groupMembershipQuery.empty) {
          onUnreadCountChanged(0); // No membership means no unread messages
          return;
        }

        // Set up real-time listener on the group membership document
        const groupMembershipDoc = groupMembershipQuery.docs[0];
        
        unsubscribeMembership = groupMembershipDoc.ref.onSnapshot(
          async (membershipDoc) => {
            if (membershipDoc.exists) {
              const membershipData = membershipDoc.data();
              lastSeenMessageRef = membershipData?.last_seen_message;
            }

            // Use debounced update to prevent race conditions
            await debouncedUpdateCount('membership update');
          },
          (error) => {
            onError?.(error);
          }
        );
      } catch (error) {
        onError?.(error as Error);
      }
    };

    let unsubscribeMessages: (() => void) | undefined;

    // Set up membership subscription first, then messages after a small delay
    const initializeSubscriptions = async () => {
      await setupSubscription();
      
      // Small delay to ensure membership subscription is established
      setTimeout(() => {
        // Subscribe to new messages to update count in real-time
        // Use a more targeted query to reduce overhead
        const messagesRef = this.db.collection('message').doc(groupId).collection('messages');
        let messageCount = 0;
        
        unsubscribeMessages = messagesRef
          .orderBy('sentAt', 'desc')
          .limit(1) // Only listen to the latest message (removed status filter to avoid index issues)
          .onSnapshot(
            async (snapshot) => {
              if (!snapshot.empty && snapshot.size > 0) {
                // Only recalculate if we have a new message
                const newMessageCount = snapshot.size;
                if (newMessageCount !== messageCount) {
                  messageCount = newMessageCount;

                  // Check if the latest message is from the current user
                  const latestMessage = snapshot.docs[0];
                  const messageData = latestMessage.data();
                  const sentByRef = messageData?.sentBy;

                  if (sentByRef && sentByRef.path === `user/${userId}`) {
                    // User's own message - should be auto-read, set count to 0 immediately
                    onUnreadCountChanged(0);
                    return;
                  }

                  // Use debounced update to prevent race conditions with membership updates
                  await debouncedUpdateCount('new message');
                }
              }
            },
            onError
          );
      }, 100); // 100ms delay to ensure membership listener is ready
    };

    initializeSubscriptions();

    // Return combined unsubscribe function
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (unsubscribeMembership) unsubscribeMembership();
      if (unsubscribeMessages) unsubscribeMessages();
    };
  }

  // Get latest message reference for a group (used to mark as last seen)
  async getLatestMessageRef(groupId: string): Promise<FirebaseFirestoreTypes.DocumentReference | null> {
    try {
      const messagesRef = this.db.collection('message').doc(groupId).collection('messages');
      const snapshot = await messagesRef
        .orderBy('sentAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0].ref;
    } catch (error) {
      console.error('Error getting latest message reference:', error);
      return null;
    }
  }

  // Update user's lastSeenMessage to mark messages as read
  async updateUserLastSeenMessage(groupId: string, userId: string): Promise<void> {
    try {
      // Get the latest message reference
      const latestMessageRef = await this.getLatestMessageRef(groupId);

      if (!latestMessageRef) {
        return;
      }

      // Get group document and update user's lastSeenMessage
      const groupRef = this.db.collection('group').doc(groupId);
      const groupDoc = await groupRef.get();

      if (!groupDoc.exists) {
        throw new Error(`Group ${groupId} not found`);
      }

      const groupData = groupDoc.data();
      const members = groupData?.members || [];

      // Update the specific user's lastSeenMessage
      const updatedMembers = members.map((member: any) =>
        member.userId === userId
          ? { ...member, lastSeenMessage: latestMessageRef }
          : member
      );

      await groupRef.update({ members: updatedMembers });
    } catch (error) {
      console.error('Error updating user lastSeenMessage:', error);
      throw error;
    }
  }
}

export default new FirebaseService();