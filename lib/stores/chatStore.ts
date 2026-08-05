import { create } from 'zustand';
import { errorService, ErrorType, AppError } from '../services/ErrorService';

// Types matching Flutter Flow's exact data structures
export interface ReplyToState {
  color: string;
  name: string;
  msgText: string;
  group_id: string;
  messageDocRef: string;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'audio' | 'video';
  url: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
}

// Extension option for renewal reminder messages
export interface ExtensionOption {
  months: number;
  price: number;
  label: string;
}

// Message metadata for special message types (e.g., renewal reminders)
export interface MessageMetadata {
  type: 'renewal_reminder' | 'extension_confirmation' | 'share_previous_summary_prompt' | 'share_summary_confirmation' | 'share_soul_profile_prompt' | 'soul_profile_shared' | 'soul_profile_share_confirmation' | string;
  reminderType?: '5_days' | '3_days' | '6_hours';
  membershipExpiry?: string;
  groupId?: string;
  extensionOptions?: ExtensionOption[];
  extendedBy?: string;
  extendedByName?: string;
  months?: number;
  newExpiry?: string;
  // For share_previous_summary_prompt and share_soul_profile_prompt
  medicId?: number;
  medicName?: string;
  // For share_summary_confirmation
  previousGroupsCount?: number;
  // For soul_profile_shared
  sharedBy?: string;
  hasPdfReport?: boolean;
}

export interface MessageData {
  id: string;
  messageText: string;
  sentAt: Date;
  sentBy: string;
  status: 'visible' | 'deleted';
  isReply: boolean;
  replyTo?: ReplyToState;
  attachments?: MessageAttachment[];
  // User-specific message visibility
  visibleToUserIds?: string[];
  // Special message metadata (e.g., renewal reminders)
  messageMetadata?: MessageMetadata;
  // Pinned/sticky message fields
  isPinned?: boolean;
  pinnedBy?: string; // UID of user who pinned
  // Optimistic update fields
  _isPending?: boolean;
  _isFailed?: boolean;
  _tempId?: string;
  _error?: string;
}

export interface GroupData {
  uid: string;
  name: string;
  status: 'Active' | 'Waiting' | 'Expired' | 'Closed';
  type: 'group' | 'dm' | 'zealopia_dm' | 'one_on_one' | 'soul_bot';
  currentMembers: string[];
  visible: boolean;
  // For 1:1 medic chats - share previous summary feature
  sharePreviousSummaryRequested?: boolean;
  hasPreviousMedicChats?: boolean;
}

export interface GroupMembership {
  role: 'Admin' | 'Member';
  color: string;
  groupId: string;
  lastSeenMessage?: string;
  userId?: number;
  soulMatchEmoji?: string;
  soulMatchPercentage?: number;
}

// Rating status for 1:1 therapist chats
export interface RatingStatus {
  hasRated: boolean;
  rating?: number;
  feedback?: string;
  submittedAt?: string;
}

// Membership expiry status (from backend API)
export interface MembershipExpiryStatus {
  hasMembership: boolean;
  status?: string;
  expiryOn?: string;
  daysUntilExpiry?: number;
  inGracePeriod: boolean;
  canExtend: boolean;
  extensionOptions?: ExtensionOption[];
  groupName?: string;
  isOneOnOne?: boolean;
  ratingStatus?: RatingStatus;
  soulProfileShared?: boolean;
}

export interface GroupMemberWithSoulMatch {
  name: string;
  role: 'Admin' | 'Member';
  profilePicture: string;
  userId: number;
  soulMatchEmoji: string;
  soulMatchPercentage: number;
}

interface ChatState {
  // Reply system state (matches FFAppState().replyingTo)
  replyingTo: ReplyToState | null;
  isReplyingToSet: boolean;

  // Current chat data
  currentGroup: GroupData | null;
  currentMembership: GroupMembership | null;
  messages: MessageData[];
  groupMembers: Record<number, GroupMemberWithSoulMatch>; // userId -> member with soul match data
  firebaseUidToDjangoId: Record<string, number>; // Firebase UID -> Django user ID mapping

  // Membership expiry state
  membershipExpiryStatus: MembershipExpiryStatus | null;

  // UI state
  canWriteChat: boolean;
  isLoading: boolean;
  
  // Error handling state
  error: AppError | null;
  lastError: AppError | null;
  retryableOperations: Record<string, () => Promise<void>>;
  
  // Actions
  setReplyingTo: (reply: ReplyToState | null) => void;
  clearReply: () => void;
  setCurrentGroup: (group: GroupData | null) => void;
  setCurrentMembership: (membership: GroupMembership | null) => void;
  setMessages: (messages: MessageData[]) => void;
  addMessage: (message: MessageData) => void;
  updateMessageStatus: (tempId: string, realId?: string, failed?: boolean, error?: string) => void;
  removeMessage: (messageId: string) => void;
  updateCanWriteChat: (canWrite: boolean) => void;
  setLoading: (loading: boolean) => void;
  setGroupMembers: (members: Record<number, GroupMemberWithSoulMatch>) => void;
  updateMemberSoulMatch: (userId: number, soulMatchEmoji: string, soulMatchPercentage: number) => void;
  setFirebaseUidToDjangoIdMapping: (mapping: Record<string, number>) => void;
  setMembershipExpiryStatus: (status: MembershipExpiryStatus | null) => void;
  
  // Error handling actions
  setError: (error: AppError | null) => void;
  clearError: () => void;
  handleFirebaseError: (error: any, operation?: string, retryFn?: () => Promise<void>) => AppError;
  retry: (operationKey: string) => Promise<void>;
  
  // Computed values
  getCanWriteChat: () => boolean;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  replyingTo: null,
  isReplyingToSet: false,
  currentGroup: null,
  currentMembership: null,
  messages: [],
  groupMembers: {},
  firebaseUidToDjangoId: {},
  membershipExpiryStatus: null,
  canWriteChat: false,
  isLoading: false,

  // Error handling state
  error: null,
  lastError: null,
  retryableOperations: {},
  
  // Reply actions
  setReplyingTo: (reply) => set({ 
    replyingTo: reply, 
    isReplyingToSet: reply !== null 
  }),
  
  clearReply: () => set({ 
    replyingTo: null, 
    isReplyingToSet: false 
  }),
  
  // Group and membership actions
  setCurrentGroup: (group) => {
    set({ currentGroup: group });
  },
  setCurrentMembership: (membership) => {
    set({ currentMembership: membership });
  },

  // Message actions
  setMessages: (messages) => {
    set({ messages });
  },
  addMessage: (message) => {

    set((state) => ({
      messages: [message, ...state.messages] // Add to beginning (reversed list)
    }));
  },

  updateMessageStatus: (tempId, realId, failed = false, error) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === tempId || msg._tempId === tempId) {
          if (realId) {
            // Message was successfully sent - update with real ID
            return {
              ...msg,
              id: realId,
              _isPending: false,
              _isFailed: false,
              _error: undefined,
              _tempId: undefined,
            };
          } else if (failed) {
            // Message failed to send
            return {
              ...msg,
              _isPending: false,
              _isFailed: true,
              _error: error,
            };
          }
        }
        return msg;
      })
    }));
  },

  removeMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== messageId && msg._tempId !== messageId)
    }));
  },
  
  // UI actions
  updateCanWriteChat: (canWrite) => {
    set({ canWriteChat: canWrite });
  },
  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  // Group member actions
  setGroupMembers: (members) => {
    set({ groupMembers: members });
  },
  updateMemberSoulMatch: (userId, soulMatchEmoji, soulMatchPercentage) => {
    set((state) => ({
      groupMembers: {
        ...state.groupMembers,
        [userId]: state.groupMembers[userId] 
          ? { ...state.groupMembers[userId], soulMatchEmoji, soulMatchPercentage }
          : state.groupMembers[userId]
      }
    }));
  },
  setFirebaseUidToDjangoIdMapping: (mapping) => {
    set({ firebaseUidToDjangoId: mapping });
  },
  setMembershipExpiryStatus: (status) => {
    set({ membershipExpiryStatus: status });
  },

  // Error handling actions
  setError: (error) => set((state) => ({ 
    error, 
    lastError: error || state.lastError 
  })),
  
  clearError: () => set({ error: null }),
  
  handleFirebaseError: (error: any, operation = 'Firebase operation', retryFn?: () => Promise<void>) => {
    const appError = errorService.createError(
      ErrorType.FIREBASE,
      error?.message || `${operation} failed`,
      {
        details: { originalError: error, operation },
        retryable: true,
      }
    );

    set((state) => ({
      error: appError,
      lastError: appError,
      isLoading: false,
      retryableOperations: retryFn 
        ? { ...state.retryableOperations, [operation]: retryFn }
        : state.retryableOperations,
    }));

    // Log the error
    errorService.handleError(appError, { logError: true, showAlert: false });
    
    return appError;
  },
  
  retry: async (operationKey: string) => {
    const { retryableOperations } = get();
    const retryFn = retryableOperations[operationKey];
    
    if (retryFn) {
      set({ error: null, isLoading: true });
      try {
        await retryFn();
        // Remove the retry operation on success
        set((state) => {
          const newOperations = { ...state.retryableOperations };
          delete newOperations[operationKey];
          return { retryableOperations: newOperations, isLoading: false };
        });
      } catch (retryError) {
        get().handleFirebaseError(retryError, operationKey, retryFn);
      }
    }
  },
  
  // Computed values - matches Flutter Flow's canWriteChat logic
  getCanWriteChat: () => {
    const { currentGroup, currentMembership, membershipExpiryStatus } = get();

    if (!currentGroup || currentGroup.status !== 'Active') {
      return false;
    }

    // Check membership expiry status
    // Admins are exempt from expiry restrictions
    if (currentMembership?.role !== 'Admin' && membershipExpiryStatus) {
      // If membership is expired and not in grace period, disable chat
      if (membershipExpiryStatus.status === 'MembershipExpired' && !membershipExpiryStatus.inGracePeriod) {
        return false;
      }
    }

    // For group types: all members can write
    // For soul_bot types: all members can write
    // For one_on_one types: all members can write
    // For DM/other types: only admins can write
    if (currentGroup.type === 'group' || currentGroup.type === 'soul_bot' || currentGroup.type === 'one_on_one') {
      return true;
    } else {
      return currentMembership?.role === 'Admin';
    }
  }
}));