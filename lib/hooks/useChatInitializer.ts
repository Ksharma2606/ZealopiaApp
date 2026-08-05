import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGroupChatStore } from '../stores/groupChatStore';

/**
 * Hook that automatically initializes the GroupChatStore when user is authenticated
 * This should be used at the app level to ensure chat data is always available
 */
export const useChatInitializer = () => {
  const { firebaseUser, loading } = useAuth();
  
  // Get store functions and state separately to avoid infinite loops
  const initialize = useGroupChatStore((state) => state.initialize);
  const cleanup = useGroupChatStore((state) => state.cleanup);
  const isInitialized = useGroupChatStore((state) => state.isInitialized);
  const currentUserId = useGroupChatStore((state) => state.currentUserId);

  useEffect(() => {
    console.log('[useChatInitializer] Auth state changed:', {
      hasFirebaseUser: !!firebaseUser,
      firebaseUid: firebaseUser?.uid,
      loading,
      isInitialized,
      currentUserId
    });

    // Don't do anything while auth is still loading
    if (loading) {
      return;
    }

    // If user is authenticated and chat store isn't initialized for this user
    if (firebaseUser && firebaseUser.uid) {
      if (!isInitialized || currentUserId !== firebaseUser.uid) {
        console.log('[useChatInitializer] Initializing chat store for user:', firebaseUser.uid);
        initialize(firebaseUser.uid).catch(error => {
          console.error('[useChatInitializer] Failed to initialize chat store:', error);
        });
      }
    } else {
      // User is not authenticated, cleanup chat store
      if (isInitialized) {
        console.log('[useChatInitializer] User logged out, cleaning up chat store');
        cleanup();
      }
    }
  }, [firebaseUser?.uid, loading, isInitialized, currentUserId, initialize, cleanup]);

  // Return minimal state for debugging/monitoring (avoid accessing complex objects)
  const isLoading = useGroupChatStore((state) => state.isLoading);
  const error = useGroupChatStore((state) => state.error);
  const groupCount = useGroupChatStore((state) => state.groups.size);
  
  return {
    isInitialized,
    isLoading,
    error,
    groupCount,
  };
};