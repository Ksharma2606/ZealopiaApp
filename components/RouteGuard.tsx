import React, { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/lib/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import Colors from '@/constants/Colors';
import { NotificationService } from '@/lib/services/NotificationService';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { firebaseUser, backendUser, loading, isAuthenticated, isSignupComplete } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  
  // Track if we've done the initial auth check
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Track when initial load is complete
  useEffect(() => {
    if (!loading && !initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [loading, initialLoadComplete]);

  useEffect(() => {
    if (loading && !initialLoadComplete) {
      return;
    }

    if (!segments || segments.length === 0) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const currentScreen = segments[1];
    const notificationService = NotificationService.getInstance();

    if (notificationService.hasPendingNavigation()) {
      return;
    }

    if (!isAuthenticated) {
      const unauthenticatedScreens = ['login', 'otp-verify', 'splash'];

      if (inAuthGroup && currentScreen && unauthenticatedScreens.includes(currentScreen)) {
        return;
      }

      router.replace('/login');
      return;
    }

    if (!isSignupComplete) {
      const onboardingScreens = ['profile-setup', 'zora-intro'];

      if (inAuthGroup && currentScreen && onboardingScreens.includes(currentScreen)) {
        return;
      }

      router.replace('/profile-setup');
      return;
    }

    const postSignupAllowedScreens = ['zora-intro', 'soul-bot-chat'];
    if (inAuthGroup && currentScreen && !postSignupAllowedScreens.includes(currentScreen)) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, loading, isSignupComplete, segments, initialLoadComplete, router]);

  // Only show loading screen during initial app load
  // After initial load, always render children to prevent unmounting
  if (loading && !initialLoadComplete) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F058' }}>
        {/* <ActivityIndicator size="small" color={Colors.primary} /> */}
      </View>
    );
  }

  return <>{children}</>;
}