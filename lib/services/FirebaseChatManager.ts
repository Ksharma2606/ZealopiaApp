/**
 * FirebaseChatManager - Single source of truth for all chat operations
 *
 * This service centralizes all Firebase chat-related operations:
 * - Group subscriptions (medic + regular groups)
 * - Message subscriptions and sending
 * - Read state management (with deduplication + debouncing)
 * - Membership management
 *
 * Benefits:
 * - No direct Firebase calls from React components
 * - Built-in deduplication and debouncing
 * - Centralized cache management
 * - Easier testing and maintenance
 */

import firestore from '@react-native-firebase/firestore';
import FirebaseService from './FirebaseService';
import { RequestManager } from '../utils/RequestManager';
import { db } from '../firebase';
import type { Group, GroupMessage, GroupMembership } from '../types/chat';
import type { MessageAttachment } from '../services/FirebaseService';

// Callback types for subscribers
type GroupsUpdateCallback = (groups: Group[]) => void;
type MessagesUpdateCallback = (messages: GroupMessage[]) => void;
type MembershipUpdateCallback = (membership: GroupMembership | null) => void;
type GroupDataUpdateCallback = (group: Group) => void;
type ErrorCallback = (error: Error) => void;

// Internal state types
interface ActiveGroupSubscription {
  groupId: string;
  groupDataUnsubscribe: (() => void) | null;
  messagesUnsubscribe: (() => void) | null;
  membershipUnsubscribe: (() => void) | null;
  lastMessageCount: number;
  lastGroupDataHash?: string; // For deduplication
}

interface PendingMarkAsRead {
  groupId: string;
  messageRef: FirebaseFirestoreTypes.DocumentReference | null;
  timestamp: number;
}

class FirebaseChatManagerClass {
  // Current user
  private currentUserId: string | null = null;
  private isMedicUser: boolean = false;

  // Group subscriptions (unified for all groups)
  private groupsUnsubscribe: (() => void) | null = null;
  private lastGroupsHash: string = '';

  // Active group-specific subscriptions (messages, membership)
  private activeGroupSubscriptions: Map<string, ActiveGroupSubscription> = new Map();

  // Read state management
  private markAsReadDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingMarkAsRead: Map<string, PendingMarkAsRead> = new Map();
  private markAsReadRequestManager = new RequestManager<void>('MarkAsRead');

  // Debounce configuration
  private readonly MARK_AS_READ_DEBOUNCE_MS = 500; // 500ms debounce

  /**
   * Initialize the chat manager for a specific user
   */
  initialize(userId: string, isMedic: boolean = false): void {
    // Clean up previous user's subscriptions
    if (this.currentUserId && this.currentUserId !== userId) {
      this.cleanup();
    }

    this.currentUserId = userId;
    this.isMedicUser = isMedic;
  }

  /**
   * Subscribe to all groups for the current user
   * Handles both medic and regular group subscriptions
   */
  subscribeToGroups(
    onUpdate: GroupsUpdateCallback,
    onError: ErrorCallback
  ): () => void {
    if (!this.currentUserId) {
      console.error('[FirebaseChatManager] Cannot subscribe to groups: no user initialized');
      return () => {};
    }

    // Clean up existing subscription
    if (this.groupsUnsubscribe) {
      this.groupsUnsubscribe();
      this.groupsUnsubscribe = null;
    }

    const userId = this.currentUserId;
    const isMedic = this.isMedicUser;

    // Create unified subscription based on user type
    if (isMedic) {
      // Medic users: subscribe to both created and joined groups (separate subscriptions)
      let createdGroups: Group[] = [];
      let joinedGroups: Group[] = [];
      let createdGroupsReady = false;
      let joinedGroupsReady = false;

      const mergeAndUpdate = () => {
        // Only merge and update after both subscriptions have fired at least once
        if (!createdGroupsReady || !joinedGroupsReady) {
          return;
        }

        // Merge and deduplicate
        const allGroups = [...createdGroups, ...joinedGroups];

        // Create hash using a stable timestamp representation
        // IMPORTANT: Include unread count to detect when new messages arrive
        const currentHash = allGroups.map(g => {
          const sentAtValue = g.recentMessage?.sentAt;
          const sentAtStr = sentAtValue?.seconds ? sentAtValue.seconds.toString() : '';
          const unreadCount = g.members?.find(m => m.userId === userId)?.numUnread || 0;
          return `${g.uid}:${g.recentMessage?.messageText || ''}:${sentAtStr}:${unreadCount}`;
        }).sort().join('|');

        if (currentHash === this.lastGroupsHash) {
          return; // Skip duplicate
        }

        this.lastGroupsHash = currentHash;
        onUpdate(allGroups);
      };

      const unsubscribeCreated = FirebaseService.subscribeToMedicGroupsCreated(
        userId,
        (groups) => {
          createdGroups = groups;
          createdGroupsReady = true;
          mergeAndUpdate();
        },
        onError
      );

      const unsubscribeJoined = FirebaseService.subscribeToMedicGroupsJoined(
        userId,
        (groups) => {
          joinedGroups = groups;
          joinedGroupsReady = true;
          mergeAndUpdate();
        },
        onError
      );

      // Store both unsubscribe functions
      this.groupsUnsubscribe = () => {
        unsubscribeCreated();
        unsubscribeJoined();
      };
    } else {
      // Regular users: subscribe to user groups (unified subscription)
      const unsubscribe = FirebaseService.subscribeToUserGroups(
        userId,
        (groups) => {
          // Deduplication using hash that includes recentMessage AND unread count to detect updates
          const currentHash = groups.map(g => {
            const sentAtValue = g.recentMessage?.sentAt;
            const sentAtStr = sentAtValue?.seconds ? sentAtValue.seconds.toString() : sentAtValue?.toString() || '';
            const unreadCount = g.members?.find(m => m.userId === userId)?.numUnread || 0;
            return `${g.uid}:${g.recentMessage?.messageText || ''}:${sentAtStr}:${unreadCount}`;
          }).sort().join('|');

          if (currentHash === this.lastGroupsHash) {
            return; // Skip duplicate
          }

          this.lastGroupsHash = currentHash;
          onUpdate(groups);
        },
        onError
      );

      this.groupsUnsubscribe = unsubscribe;
    }

    // Return unsubscribe function
    return () => {
      if (this.groupsUnsubscribe) {
        this.groupsUnsubscribe();
        this.groupsUnsubscribe = null;
      }
      this.lastGroupsHash = '';
    };
  }

  /**
   * Subscribe to group data for a specific group
   * Returns real-time updates for group document changes
   */
  subscribeToGroupData(
    groupId: string,
    onUpdate: GroupDataUpdateCallback,
    onError: ErrorCallback
  ): () => void {
    if (!this.currentUserId) {
      console.error('[FirebaseChatManager] Cannot subscribe to group data: no user initialized');
      return () => {};
    }

    // Check if already subscribed
    const existing = this.activeGroupSubscriptions.get(groupId);
    if (existing?.groupDataUnsubscribe) {
      return existing.groupDataUnsubscribe;
    }

    // Subscribe to group document with deduplication
    // IMPORTANT: includeMetadataChanges: false prevents snapshots from firing on metadata-only changes
    // This drastically reduces Firebase reads when the document is being updated frequently
    const unsubscribe = db.collection('group').doc(groupId).onSnapshot(
      {
        includeMetadataChanges: false, // Only fire on actual data changes, not metadata
      },
      (doc) => {
        if (doc.exists) {
          const groupData = { uid: doc.id, ...doc.data() } as Group;

          // DEDUPLICATION: Create hash of essential group data to prevent unnecessary callbacks
          // This prevents re-renders when non-essential fields change (e.g., recentMessage.readBy)
          const currentHash = JSON.stringify({
            uid: groupData.uid,
            name: groupData.name,
            type: groupData.type,
            status: groupData.status,
            id: groupData.id,
            // Include recentMessage to detect new messages
            recentMessageText: groupData.recentMessage?.messageText,
            recentMessageSentAt: groupData.recentMessage?.sentAt?.seconds || groupData.recentMessage?.sentAt?.toString(),
          });

          // Get subscription to check/update hash
          const subscription = this.activeGroupSubscriptions.get(groupId);
          if (subscription?.lastGroupDataHash === currentHash) {
            // Group data hasn't changed meaningfully, skip callback
            return;
          }

          // Update hash
          if (subscription) {
            subscription.lastGroupDataHash = currentHash;
          }

          onUpdate(groupData);
        } else {
          onError(new Error('Group not found'));
        }
      },
      (error) => {
        console.error('[FirebaseChatManager] Group data subscription error:', error);
        onError(error as Error);
      }
    );

    // Track subscription
    const subscription = this.activeGroupSubscriptions.get(groupId) || {
      groupId,
      groupDataUnsubscribe: null,
      messagesUnsubscribe: null,
      membershipUnsubscribe: null,
      lastMessageCount: 0,
    };
    subscription.groupDataUnsubscribe = unsubscribe;
    this.activeGroupSubscriptions.set(groupId, subscription);

    // Return unsubscribe function
    return () => {
      unsubscribe();

      const sub = this.activeGroupSubscriptions.get(groupId);
      if (sub) {
        sub.groupDataUnsubscribe = null;
        // Clean up subscription if nothing is active
        if (!sub.messagesUnsubscribe && !sub.membershipUnsubscribe) {
          this.activeGroupSubscriptions.delete(groupId);
        }
      }
    };
  }

  /**
   * Subscribe to messages for a specific group
   *
   * Note: Components should use this method for message subscriptions.
   * The messages collection is accessed via the group's messages reference.
   */
  subscribeToMessages(
    groupId: string,
    onUpdate: MessagesUpdateCallback,
    onError: ErrorCallback
  ): () => void {
    if (!this.currentUserId) {
      console.error('[FirebaseChatManager] Cannot subscribe to messages: no user initialized');
      return () => {};
    }

    // Check if already subscribed
    const existing = this.activeGroupSubscriptions.get(groupId);
    if (existing?.messagesUnsubscribe) {
      return existing.messagesUnsubscribe;
    }

    // First, get the group to access its messages reference
    let unsubscribeFn: (() => void) | null = null;

    db.collection('group').doc(groupId).get()
      .then((groupDoc) => {
        if (!groupDoc.exists) {
          onError(new Error('Group not found'));
          return;
        }

        const groupData = groupDoc.data();
        const messagesRef = groupData?.messages;

        if (!messagesRef) {
          onError(new Error('No messages reference found in group'));
          return;
        }

        // Subscribe to messages
        unsubscribeFn = messagesRef.collection('messages')
          .where('status', '==', 'visible')
          .orderBy('sentAt', 'desc')
          .limit(250)
          .onSnapshot(
            (querySnapshot: any) => {
              const messagesData: GroupMessage[] = [];

              querySnapshot.forEach((messageDoc: any) => {
                const data = messageDoc.data();

                // Handle serverTimestamp properly
                let sentAtDate: Date;
                if (data.sentAt && typeof data.sentAt.toDate === 'function') {
                  sentAtDate = data.sentAt.toDate();
                } else if (data.sentAt) {
                  sentAtDate = new Date(data.sentAt);
                } else {
                  sentAtDate = new Date();
                }

                // Get sender UID
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
                });
              });

              onUpdate(messagesData);
            },
            (error: any) => {
              console.error('[FirebaseChatManager] Messages subscription error:', error);
              onError(error as Error);
            }
          );

        // Track subscription
        const subscription = this.activeGroupSubscriptions.get(groupId) || {
          groupId,
          groupDataUnsubscribe: null,
          messagesUnsubscribe: null,
          membershipUnsubscribe: null,
          lastMessageCount: 0,
        };
        subscription.messagesUnsubscribe = unsubscribeFn;
        this.activeGroupSubscriptions.set(groupId, subscription);
      })
      .catch((error) => {
        console.error('[FirebaseChatManager] Error getting group for messages subscription:', error);
        onError(error as Error);
      });

    // Return unsubscribe function
    return () => {
      if (unsubscribeFn) {
        unsubscribeFn();
      }

      const sub = this.activeGroupSubscriptions.get(groupId);
      if (sub) {
        sub.messagesUnsubscribe = null;
        // Clean up subscription if nothing is active
        if (!sub.membershipUnsubscribe && !sub.groupDataUnsubscribe) {
          this.activeGroupSubscriptions.delete(groupId);
        }
      }
    };
  }

  /**
   * Subscribe to current user's membership for a specific group
   */
  subscribeToMembership(
    groupId: string,
    onUpdate: MembershipUpdateCallback,
    onError: ErrorCallback
  ): () => void {
    if (!this.currentUserId) {
      console.error('[FirebaseChatManager] Cannot subscribe to membership: no user initialized');
      return () => {};
    }

    const userId = this.currentUserId;

    // Subscribe to membership
    const unsubscribe = FirebaseService.subscribeToGroupMembership(
      userId,
      groupId,
      (membership) => {
        onUpdate(membership);
      },
      onError
    );

    // Track subscription
    const subscription = this.activeGroupSubscriptions.get(groupId) || {
      groupId,
      groupDataUnsubscribe: null,
      messagesUnsubscribe: null,
      membershipUnsubscribe: null,
      lastMessageCount: 0,
    };
    subscription.membershipUnsubscribe = unsubscribe;
    this.activeGroupSubscriptions.set(groupId, subscription);

    // Return unsubscribe function
    return () => {
      unsubscribe();

      const sub = this.activeGroupSubscriptions.get(groupId);
      if (sub) {
        sub.membershipUnsubscribe = null;
        // Clean up subscription if nothing is active
        if (!sub.messagesUnsubscribe && !sub.groupDataUnsubscribe) {
          this.activeGroupSubscriptions.delete(groupId);
        }
      }
    };
  }

  /**
   * Send a message to a group
   * Handles text, image, and audio messages with attachments
   */
  async sendMessage(
    groupId: string,
    messageText: string,
    options?: {
      contentType?: 'text' | 'image' | 'audio';
      attachment?: MessageAttachment;
      audioDuration?: number;
      isReply?: boolean;
      replyTo?: any;
    }
  ): Promise<string> {
    if (!this.currentUserId) {
      throw new Error('Cannot send message: no user initialized');
    }

    const contentType = options?.contentType || 'text';

    try {
      // Get group document
      const groupDoc = await db.collection('group').doc(groupId).get();
      if (!groupDoc.exists) {
        throw new Error('Group not found');
      }

      const groupData = groupDoc.data();
      const messagesRef = groupData?.messages;
      if (!messagesRef) {
        throw new Error('No messages reference found in group');
      }

      // Build message data
      const messageData: any = {
        messageText: messageText || '',
        sentAt: firestore.FieldValue.serverTimestamp(),
        sentBy: db.collection('user').doc(this.currentUserId),
        status: 'visible',
        isReply: options?.isReply || false,
      };

      // Add reply data if this is a reply
      if (options?.replyTo) {
        messageData.replyTo = options.replyTo;
      }

      // Add attachments if provided
      if (options?.attachment) {
        messageData.attachments = [options.attachment];
      }

      // For audio messages, add duration
      if (contentType === 'audio' && options?.audioDuration) {
        messageData.audioDuration = options.audioDuration;
      }

      // Add message to Firestore
      const messageRef = await messagesRef.collection('messages').add(messageData);

      // Update group's recent message (fire-and-forget)
      const groupRef = db.collection('group').doc(groupId);

      // Determine recent message text based on content type
      let recentMessageText = messageText;
      if (contentType === 'image') {
        recentMessageText = '📷 Image';
      } else if (contentType === 'audio') {
        recentMessageText = '🎤 Audio';
      }

      groupRef.update({
        'recentMessage.messageText': recentMessageText,
        'recentMessage.sentAt': firestore.FieldValue.serverTimestamp(),
        'recentMessage.sentBy': db.collection('user').doc(this.currentUserId),
        'recentMessage.sentByName': 'You',
        'recentMessage.ref': messageRef,
        'recentMessage.readBy': [this.currentUserId], // Mark as read by sender
      }).catch(() => {
        // Failed to update recent message
      });

      // After sending, mark as read (debounced)
      this.markAsRead(groupId);

      return messageRef.id;
    } catch (error) {
      console.error('[FirebaseChatManager] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Pin a message in a group
   * Any user can pin a message
   */
  async pinMessage(groupId: string, messageId: string): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Cannot pin message: no user initialized');
    }

    try {
      // Get group document to access messages reference
      const groupDoc = await db.collection('group').doc(groupId).get();
      if (!groupDoc.exists) {
        throw new Error('Group not found');
      }

      const groupData = groupDoc.data();
      const messagesRef = groupData?.messages;
      if (!messagesRef) {
        throw new Error('No messages reference found in group');
      }

      // Update the message document
      await messagesRef.collection('messages').doc(messageId).update({
        isPinned: true,
        pinnedBy: this.currentUserId,
      });
    } catch (error) {
      console.error('[FirebaseChatManager] Error pinning message:', error);
      throw error;
    }
  }

  /**
   * Unpin a message in a group
   * Only the user who pinned the message can unpin it
   */
  async unpinMessage(groupId: string, messageId: string): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Cannot unpin message: no user initialized');
    }

    try {
      // Get group document to access messages reference
      const groupDoc = await db.collection('group').doc(groupId).get();
      if (!groupDoc.exists) {
        throw new Error('Group not found');
      }

      const groupData = groupDoc.data();
      const messagesRef = groupData?.messages;
      if (!messagesRef) {
        throw new Error('No messages reference found in group');
      }

      // Update the message document
      await messagesRef.collection('messages').doc(messageId).update({
        isPinned: false,
        pinnedBy: firestore.FieldValue.delete(),
      });
    } catch (error) {
      console.error('[FirebaseChatManager] Error unpinning message:', error);
      throw error;
    }
  }

  /**
   * Mark a group as read (with deduplication and debouncing)
   *
   * Smart behavior:
   * - Deduplicates simultaneous calls for the same group
   * - Debounces rapid calls (e.g., when sending multiple messages)
   * - Cancels old pending operations if new message arrives
   * - Flushes immediately on cleanup/navigation
   */
  markAsRead(
    groupId: string,
    messageRef?: FirebaseFirestoreTypes.DocumentReference
  ): Promise<void> {
    if (!this.currentUserId) {
      console.error('[FirebaseChatManager] Cannot mark as read: no user initialized');
      return Promise.resolve();
    }

    const userId = this.currentUserId;

    // Clear existing debounce timer for this group
    const existingTimer = this.markAsReadDebounceTimers.get(groupId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Store pending operation (will be overridden if newer message arrives)
    this.pendingMarkAsRead.set(groupId, {
      groupId,
      messageRef: messageRef || null,
      timestamp: Date.now(),
    });

    // Create debounced operation
    const debouncedPromise = new Promise<void>((resolve) => {
      const timer = setTimeout(async () => {
        const pending = this.pendingMarkAsRead.get(groupId);
        if (!pending) {
          resolve();
          return;
        }

        // Clear pending operation
        this.pendingMarkAsRead.delete(groupId);
        this.markAsReadDebounceTimers.delete(groupId);

        // Execute the actual mark as read operation with deduplication
        const requestKey = `${groupId}_${pending.messageRef?.id || 'latest'}`;

        try {
          await this.markAsReadRequestManager.performRequest(
            requestKey,
            async () => {
              // Get latest message ref if not provided
              let finalMessageRef = pending.messageRef;
              if (!finalMessageRef) {
                finalMessageRef = await FirebaseService.getLatestMessageRef(groupId);
                if (!finalMessageRef) {
                  return;
                }
              }

              // Update last seen message
              await FirebaseService.updateLastSeenMessage(
                userId,
                groupId,
                finalMessageRef
              );
            }
          );
        } catch (error) {
          console.error('[FirebaseChatManager] Error marking group as read:', error);
        }

        resolve();
      }, this.MARK_AS_READ_DEBOUNCE_MS);

      this.markAsReadDebounceTimers.set(groupId, timer);
    });

    return debouncedPromise;
  }

  /**
   * Flush all pending mark-as-read operations immediately
   * Call this before navigation/cleanup to ensure all reads are recorded
   */
  async flushPendingMarkAsRead(): Promise<void> {
    // Clear all timers
    for (const [groupId, timer] of this.markAsReadDebounceTimers.entries()) {
      clearTimeout(timer);
    }
    this.markAsReadDebounceTimers.clear();

    // Execute all pending operations immediately
    const pendingOps = Array.from(this.pendingMarkAsRead.values());
    this.pendingMarkAsRead.clear();

    await Promise.all(
      pendingOps.map(async (pending) => {
        if (!this.currentUserId) return;

        const requestKey = `${pending.groupId}_${pending.messageRef?.id || 'latest'}`;

        try {
          await this.markAsReadRequestManager.performRequest(
            requestKey,
            async () => {
              let finalMessageRef = pending.messageRef;
              if (!finalMessageRef) {
                finalMessageRef = await FirebaseService.getLatestMessageRef(pending.groupId);
                if (!finalMessageRef) return;
              }

              await FirebaseService.updateLastSeenMessage(
                this.currentUserId!,
                pending.groupId,
                finalMessageRef
              );
            }
          );
        } catch (error) {
          console.error('[FirebaseChatManager] Error flushing markAsRead:', error);
        }
      })
    );
  }

  /**
   * Get group membership (with caching via FirebaseService)
   */
  async getGroupMembership(
    groupId: string,
    bypassCache: boolean = false
  ): Promise<GroupMembership | null> {
    if (!this.currentUserId) {
      console.error('[FirebaseChatManager] Cannot get membership: no user initialized');
      return null;
    }

    return FirebaseService.getGroupMembership(
      this.currentUserId,
      groupId,
      bypassCache
    );
  }

  /**
   * Get group by ID (with caching via FirebaseService)
   */
  async getGroupById(
    groupId: string,
    bypassCache: boolean = false
  ): Promise<Group | null> {
    return FirebaseService.getGroupById(groupId, bypassCache);
  }

  /**
   * Cleanup all subscriptions and pending operations
   * Call this when user logs out or component unmounts
   */
  async cleanup(): Promise<void> {
    // Flush pending mark-as-read operations
    await this.flushPendingMarkAsRead();

    // Unsubscribe from groups
    if (this.groupsUnsubscribe) {
      this.groupsUnsubscribe();
      this.groupsUnsubscribe = null;
    }

    // Unsubscribe from all active group subscriptions
    for (const [groupId, subscription] of this.activeGroupSubscriptions.entries()) {
      if (subscription.groupDataUnsubscribe) {
        subscription.groupDataUnsubscribe();
      }
      if (subscription.messagesUnsubscribe) {
        subscription.messagesUnsubscribe();
      }
      if (subscription.membershipUnsubscribe) {
        subscription.membershipUnsubscribe();
      }
    }
    this.activeGroupSubscriptions.clear();

    // Reset state
    this.lastGroupsHash = '';
    this.currentUserId = null;
    this.isMedicUser = false;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Check if user is initialized
   */
  isInitialized(): boolean {
    return this.currentUserId !== null;
  }

  /**
   * Get active group subscriptions (for debugging)
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.activeGroupSubscriptions.keys());
  }
}

// Export singleton instance
export const FirebaseChatManager = new FirebaseChatManagerClass();
