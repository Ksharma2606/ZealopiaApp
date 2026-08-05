import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { setupAuthStateListener, isSignupComplete } from '@/lib/services/ApiService';
import apiService from '@/lib/services/ApiService';
import { storageService } from '@/lib/services/StorageService';
import { auth } from '@/lib/firebase';

// Interface for the user profile data from the backend
interface UserProfile {
  id: number;
  name: string | null;
  email: string | null;
  is_signup_completed: boolean;
  credit_balance?: number;
  referral_code?: string;
  birth_year?: number | null;
  pronouns?: string | null;
  orientation?: string | null;
  interested_in_user_chat?: boolean;
  // Add other user profile fields as needed
}

// Interface for the medical profile data from the backend
interface MedicalProfile {
  id?: number;
  name?: string;
  title?: string;
  bio?: string;
  percentage_commission?: number;
  is_verified?: boolean;
  profile_picture?: string;
  // Add other medical profile fields as needed
}

// Soul Profile dimension structure
interface DimensionData {
  score: number;
  explanation: string;
}

// Soul Profile report status
interface SoulProfileReportStatus {
  status: 'pending' | 'generating' | 'completed' | 'failed';
  pdf_url?: string | null;
  has_paid: boolean;
}

// Soul Profile data structure
interface SoulProfileData {
  id: number;
  dimensions_data: {
    hidden_bias?: DimensionData;
    emotional_resilience?: DimensionData;
    shadow_desires?: DimensionData;
    kindness_compassion?: DimensionData;
    imagination_creativity?: DimensionData;
    empathy_sensitivity?: DimensionData;
    self_awareness?: DimensionData;
    authenticity_vulnerability?: DimensionData;
    playfulness_curiosity?: DimensionData;
    emotional_reactivity?: DimensionData;
    meaning_purpose?: DimensionData;
  };
  summary: string;
  created_at: string;
  updated_at: string;
  report_status?: SoulProfileReportStatus | null;
}

// The complete user data structure returned from the backend
interface BackendUser {
  id: number;
  firebase_uid: string;
  email: string | null;
  mobile: string | null;
  user_profile: UserProfile;
  medical_profile?: MedicalProfile;
  soul_bot_group_uid?: string;
  last_soul_profile_generated_at?: string;
  soul_profile_last_viewed_at?: string;
  current_streak?: number;
  last_seven_days_activity?: Record<string, boolean>;
  soul_profile?: SoulProfileData;
}

// Define the shape of our context
interface AuthContextType {
  firebaseUser: FirebaseAuthTypes.User | null;
  backendUser: BackendUser | null;
  user: FirebaseAuthTypes.User | null; // Alias for firebaseUser for compatibility
  loading: boolean;
  isAuthenticated: boolean; // Stable boolean for navigation logic
  isSignupComplete: boolean;
  isUsingCachedData: boolean;
  refreshUserData: () => Promise<void>;
  refreshUserDataSilently: () => Promise<void>;
  updateUserProfile: (profileData: Partial<UserProfile>) => void;
  signOut: () => Promise<void>;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  backendUser: null,
  user: null,
  loading: true,
  isAuthenticated: false,
  isSignupComplete: false,
  isUsingCachedData: false,
  refreshUserData: async () => {},
  refreshUserDataSilently: async () => {},
  updateUserProfile: () => {},
  signOut: async () => {},
});

// Create a provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  
  // Stable authentication state for navigation (only changes on sign in/out)
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load cached user data on app start
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const cachedUser = await storageService.getCachedBackendUser();
        if (cachedUser) {
          console.log('AuthContext - Loading cached user data');
          setBackendUser(cachedUser);
          setIsUsingCachedData(true);
          setIsAuthenticated(true); // Set authenticated if we have cached user data
          
          // Check how long since last sync
          const timeSinceSync = await storageService.getTimeSinceLastSync();
          if (timeSinceSync && timeSinceSync > 60 * 60 * 1000) { // More than 1 hour
            console.log('AuthContext - Cached data is stale, will refresh when possible');
          }
        }
      } catch (error) {
        console.error('AuthContext - Error loading cached data:', error);
      }
    };
    
    loadCachedData();
  }, []);

  useEffect(() => {
    // Setup the auth state listener with backend integration
    const unsubscribe = setupAuthStateListener({
      onSignIn: async (userData) => {
        console.log('AuthContext - onSignIn callback triggered');
        // Store the user data from the backend
        if (userData && userData.user) {
          setBackendUser(userData.user);
          setIsUsingCachedData(false); // Fresh data received
          setIsAuthenticated(true); // Mark as authenticated for navigation
          
          // Refresh FCM token after successful sign in
          try {
            const NotificationService = (await import('@/lib/services/NotificationService')).NotificationService;
            await NotificationService.getInstance().refreshFCMToken();
          } catch (error) {
            console.error('Error refreshing FCM token:', error);
          }
        }
        console.log('AuthContext - onSignIn setting loading to false');
        setLoading(false);
      },
      onSignOut: () => {
        // Clear the backend user data
        setBackendUser(null);
        setIsAuthenticated(false); // Mark as not authenticated for navigation
        setLoading(false);
      },
      onError: (error) => {
        console.error('Auth state change error:', error);
        setLoading(false);
      }
    });

    // This is a separate listener just for the Firebase user
    const firebaseUnsubscribe = setupFirebaseUserListener();

    // Unsubscribe from both listeners on unmount
    return () => {
      unsubscribe();
      firebaseUnsubscribe();
    };
  }, []);

  // Setup a listener just for the Firebase user
  const setupFirebaseUserListener = () => {
    return auth.onAuthStateChanged((user: FirebaseAuthTypes.User | null) => {
      setFirebaseUser(user);
    });
  };

  // Function to refresh user data from backend
  const refreshUserData = useCallback(async () => {
    try {
      console.log('AuthContext - refreshUserData called, setting loading to true');
      setLoading(true);
      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        setBackendUser(response.data);
        setIsUsingCachedData(false); // Fresh data received
        // Note: Don't change isAuthenticated here - it's stable for navigation
      } else {
        // If API call fails but we have cached data, keep using it
        if (!backendUser) {
          const cachedUser = await storageService.getCachedBackendUser();
          if (cachedUser) {
            console.log('AuthContext - API failed, using cached user data');
            setBackendUser(cachedUser);
            setIsUsingCachedData(true);
          }
        } else {
          // Keep existing user data if API call fails
          console.log('AuthContext - API failed, keeping existing user data');
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      
      // If we don't have backend user data, try to load from cache
      if (!backendUser) {
        try {
          const cachedUser = await storageService.getCachedBackendUser();
          if (cachedUser) {
            console.log('AuthContext - Using cached user data due to error');
            setBackendUser(cachedUser);
            setIsUsingCachedData(true);
          }
        } catch (cacheError) {
          console.error('Error loading cached user data:', cacheError);
        }
      }
    } finally {
      console.log('AuthContext - refreshUserData finished, setting loading to false');
      setLoading(false);
    }
  }, [backendUser]);

  // Function to refresh user data silently (without triggering loading state)
  const refreshUserDataSilently = useCallback(async () => {
    try {
      console.log('AuthContext - refreshUserDataSilently called, NOT setting loading state');
      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        setBackendUser(response.data);
        setIsUsingCachedData(false); // Fresh data received
        // Note: Don't change isAuthenticated here - it's stable for navigation
      } else {
        // If API call fails but we have cached data, keep using it
        if (!backendUser) {
          const cachedUser = await storageService.getCachedBackendUser();
          if (cachedUser) {
            console.log('AuthContext - Silent API failed, using cached user data');
            setBackendUser(cachedUser);
            setIsUsingCachedData(true);
          }
        } else {
          // Keep existing user data if API call fails
          console.log('AuthContext - Silent API failed, keeping existing user data');
        }
      }
    } catch (error) {
      console.error('Error silently refreshing user data:', error);
      
      // If we don't have backend user data, try to load from cache
      if (!backendUser) {
        try {
          const cachedUser = await storageService.getCachedBackendUser();
          if (cachedUser) {
            console.log('AuthContext - Using cached user data due to silent refresh error');
            setBackendUser(cachedUser);
            setIsUsingCachedData(true);
          }
        } catch (cacheError) {
          console.error('Error loading cached user data during silent refresh:', cacheError);
        }
      }
    }
    // Note: No setLoading(false) here as we never set it to true
  }, [backendUser]);

  // Function to update user profile in context
  const updateUserProfile = useCallback((profileData: Partial<UserProfile>) => {
    if (backendUser) {
      setBackendUser({
        ...backendUser,
        user_profile: {
          ...backendUser.user_profile,
          ...profileData
        }
      });
    }
  }, [backendUser]);

  // Memoize the signOut function
  const signOut = useCallback(async () => {
    try {
      // Remove FCM token for this specific device before signing out
      try {
        const NotificationService = (await import('@/lib/services/NotificationService')).NotificationService;
        await NotificationService.getInstance().removeFCMToken();
      } catch (error) {
        console.error('Error removing FCM tokens during signOut:', error);
        // Continue with signout even if token removal fails
      }
      
      // Sign out from Firebase
      await auth.signOut();
    } catch (error) {
      console.error('Error during signOut:', error);
      throw error;
    }
  }, []);

  // Value provided to consuming components
  const value = useMemo(() => ({
    firebaseUser,
    backendUser,
    user: firebaseUser, // Add alias for compatibility
    loading,
    isAuthenticated,
    isSignupComplete: backendUser ? isSignupComplete({ user: backendUser }) : false,
    isUsingCachedData,
    refreshUserData,
    refreshUserDataSilently,
    updateUserProfile,
    signOut,
  }), [firebaseUser, backendUser, loading, isAuthenticated, isUsingCachedData, refreshUserData, refreshUserDataSilently, updateUserProfile, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
}

// Alias for compatibility - since some files expect useAuthContext
export const useAuthContext = useAuth;