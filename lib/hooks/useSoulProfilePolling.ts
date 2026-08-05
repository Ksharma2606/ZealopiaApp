import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

export const useSoulProfilePolling = () => {
  const { backendUser, refreshUserData } = useAuth();
  const [previousProfileState, setPreviousProfileState] = useState<string | null>(null);
  const [isProfileJustGenerated, setIsProfileJustGenerated] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasProfileRef = useRef<boolean>(false);

  // Update the has profile ref
  hasProfileRef.current = !!backendUser?.last_soul_profile_generated_at;

  // Store stable reference to refreshUserData
  const refreshUserDataRef = useRef(refreshUserData);
  refreshUserDataRef.current = refreshUserData;

  // Single effect to manage polling
  useEffect(() => {
    const hasProfile = !!backendUser?.last_soul_profile_generated_at;
    
    // Stop any existing polling
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Start polling if no profile exists
    if (!hasProfile) {
      intervalRef.current = setInterval(async () => {
        // Double check we still don't have a profile
        if (!hasProfileRef.current) {
          try {
            await refreshUserDataRef.current();
          } catch (error) {
            console.error('Error polling user data:', error);
          }
        }
      }, 3000);
    }

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [backendUser?.last_soul_profile_generated_at]);

  // Separate effect for tracking profile generation
  useEffect(() => {
    const currentProfileState = backendUser?.last_soul_profile_generated_at;
    const lastViewedAt = backendUser?.soul_profile_last_viewed_at;
    
    if (currentProfileState && currentProfileState !== previousProfileState) {
      const wasJustGenerated = !previousProfileState;
      // Check if profile was generated but not yet viewed
      const isUnviewed = !lastViewedAt || new Date(currentProfileState) > new Date(lastViewedAt);
      
      if (wasJustGenerated && isUnviewed) {
        setIsProfileJustGenerated(true);
        // Reset after delay
        setTimeout(() => setIsProfileJustGenerated(false), 1000);
      }
      setPreviousProfileState(currentProfileState);
    } else if (!currentProfileState) {
      setPreviousProfileState(null);
      setIsProfileJustGenerated(false);
    }
  }, [backendUser?.last_soul_profile_generated_at, backendUser?.soul_profile_last_viewed_at, previousProfileState]);

  return {
    hasProfile: !!backendUser?.last_soul_profile_generated_at,
    isPolling: !!intervalRef.current && !hasProfileRef.current,
    profileGeneratedAt: backendUser?.last_soul_profile_generated_at,
    isProfileJustGenerated
  };
};