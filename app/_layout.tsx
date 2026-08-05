// // Patch console.log to show device ID prefix (first 4 chars)
// import { DeviceUtils } from '@/lib/utils/DeviceUtils';

// let devicePrefix = '????';
// (async () => {
//   const deviceId = await DeviceUtils.getDeviceId();
//   devicePrefix = deviceId.substring(0, 4);
// })();

// const originalLog = console.log;
// console.log = (...args) => {
//   originalLog(`[${devicePrefix}]`, ...args);
// };

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/lib/context/AuthContext';
import { RouteGuard } from '@/components/RouteGuard';
import Colors from '@/constants/Colors';
import { useChatInitializer } from '@/lib/hooks/useChatInitializer';
import { NotificationService } from '@/lib/services/NotificationService';
import { DeepLinkHandler } from '@/lib/utils/DeepLinkHandler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DeviceUtils } from '@/lib/utils/DeviceUtils';
import * as Audio from 'expo-audio';
import { Platform } from 'react-native';

// Import Firebase to initialize it
import { auth } from '@/lib/firebase';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure initial route exists
  initialRouteName: '(auth)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [firebaseReady, setFirebaseReady] = useState(false);

  // Wait for Firebase to be ready and initialize device ID
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize device ID on app launch
        console.log('[RootLayout] Initializing device ID...');
        await DeviceUtils.initialize();

        // Configure audio mode to allow mixing/ducking with other apps (like Spotify)
        // IMPORTANT: This must be set BEFORE any audio components are created
        console.log('[RootLayout] Configuring audio mode for background audio compatibility...');
        try {
          await Audio.setAudioModeAsync({
            // iOS: Mix with other apps' audio (allows Spotify to keep playing)
            interruptionMode: 'mixWithOthers',
            // Android: Duck (lower volume of) other apps when our app plays audio
            // Note: Android doesn't support 'mixWithOthers', so audio will duck but not pause
            interruptionModeAndroid: 'duckOthers',
            // Don't activate audio in silent mode
            playsInSilentMode: false,
            // Don't play audio in background
            shouldPlayInBackground: false,
          });
          console.log('[RootLayout] Audio mode configured successfully');
        } catch (audioError) {
          console.warn('[RootLayout] Failed to configure audio mode:', audioError);
        }

        // Simple check to ensure Firebase auth is available
        if (auth) {
          setFirebaseReady(true);
        }
      } catch (error) {
        console.error('App initialization error:', error);
        // Set as ready anyway to prevent infinite loading
        setFirebaseReady(true);
      }
    };

    initializeApp();
  }, []);

  if (!firebaseReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Colors.background,
      card: Colors.surface,
      text: Colors.textPrimary,
      border: Colors.border,
      primary: Colors.primary,
    },
  };

  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <SplashScreenManager>
            <ChatInitializer>
              <RouteGuard>
                <ThemeProvider value={navigationTheme}>
                  <Stack>
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                    <Stack.Screen
                      name="chat-detail"
                      options={{
                        headerShown: true,
                        animation: 'slide_from_right',
                      }}
                    />
                    <Stack.Screen
                      name="generating-soul-profile"
                      options={{
                        headerShown: false,
                        animation: 'fade',
                      }}
                    />
                    <Stack.Screen
                      name="top-expert-matches"
                      options={{
                        headerShown: false,
                        animation: 'slide_from_right',
                      }}
                    />
                    <Stack.Screen
                      name="top-user-matches"
                      options={{
                        headerShown: false,
                        animation: 'slide_from_right',
                      }}
                    />
                  </Stack>
                </ThemeProvider>
              </RouteGuard>
            </ChatInitializer>
          </SplashScreenManager>
        </AuthProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}

// Component to manage splash screen based on auth state
function SplashScreenManager({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  
  useEffect(() => {
    // Hide splash screen when auth loading is complete
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);
  
  return <>{children}</>;
}

// Component that initializes chat store
function ChatInitializer({ children }: { children: React.ReactNode }) {
  useChatInitializer();

  // Initialize notifications when user is authenticated
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const notificationService = NotificationService.getInstance();
    notificationService.initialize();

    // Initialize deep link handler
    const deepLinkHandler = DeepLinkHandler.getInstance();
    deepLinkHandler.initialize();

    // Mark app as ready for navigation after authentication and navigation is ready
    // Increase delay to ensure navigation stack is fully mounted
    const timer = setTimeout(() => {
      console.log('[ChatInitializer] Setting app ready for notifications');
      notificationService.setAppReady();
    }, 2000); // Increased delay to ensure navigation is ready

    return () => {
      clearTimeout(timer);
      notificationService.cleanup();
      deepLinkHandler.cleanup();
    };
  }, [isAuthenticated]); // Re-run when auth state changes

  return <>{children}</>;
}
