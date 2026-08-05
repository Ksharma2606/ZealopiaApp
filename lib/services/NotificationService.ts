import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import functions from '@react-native-firebase/functions';
import { Platform, Alert, Linking, PermissionsAndroid, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { auth } from '@/lib/firebase';
import { groupChatStore } from '../stores/groupChatStore';
import firebase from '@react-native-firebase/app';
import { DeviceUtils } from '@/lib/utils/DeviceUtils';

// Configure how notifications are displayed when app is in foreground
// Prevent notifications from showing when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show notifications when app is open
    shouldPlaySound: false, // Don't play sound when app is open
    shouldSetBadge: true,   // Still update badge count
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private notificationListener: any;
  private responseListener: any;
  private appStateListener: any;
  private navigationQueue: { groupId: string; type?: string }[] = [];
  private isAppReady: boolean = false;
  private hasInitialNotification: boolean = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    try {
      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Notification permissions not granted');
        return;
      }

      // Set up message handlers
      this.setupMessageHandlers();

      // Set up notification response handler (when user taps on notification)
      this.setupNotificationResponseHandler();

      // Set up app state change handler (to clear badges)
      this.setupAppStateHandler();

      // Handle initial notification (if app was opened from notification)
      await this.handleInitialNotification();

      // Don't get FCM token here - it will be called from AuthContext after authentication

    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  }

  private async requestPermissions(): Promise<boolean> {
    try {
      // For Android 13+ (API level 33+), we need to request POST_NOTIFICATIONS permission
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message: 'Zealopia needs notification permission to keep you updated about your groups and messages.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Android notification permission denied');
          return false;
        }
      }
      
      // Now request Firebase messaging permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Notification permissions granted');
        return true;
      }

      // If not granted, prompt user to enable in settings
      Alert.alert(
        'Enable Notifications',
        'Please enable notifications to receive updates about your groups and messages.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  private async getAndStoreFCMToken() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log('No user logged in, skipping FCM token storage');
        return;
      }

      console.log('[FCM] Starting FCM token retrieval for user:', currentUser.uid);
      
      // Wait for the user to be fully authenticated before calling Cloud Function
      // This ensures the Firebase Auth token is available for the function call
      const idToken = await currentUser.getIdToken(true); // Force refresh the token
      console.log('[FCM] User ID token obtained, proceeding with FCM token storage');
      console.log('[FCM] User UID:', currentUser.uid);
      console.log('[FCM] User email verified:', currentUser.emailVerified);
      console.log('[FCM] ID token first 50 chars:', idToken.substring(0, 50));

      // Register device for remote messages on iOS
      if (Platform.OS === 'ios') {
        await messaging().registerDeviceForRemoteMessages();
      }

      // Check if app has notification permissions
      const authStatus = await messaging().hasPermission();
      console.log('[FCM] Current permission status:', authStatus);
      
      if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED && 
          authStatus !== messaging.AuthorizationStatus.PROVISIONAL) {
        console.log('[FCM] No notification permissions, requesting...');
        const newAuthStatus = await messaging().requestPermission();
        if (newAuthStatus !== messaging.AuthorizationStatus.AUTHORIZED && 
            newAuthStatus !== messaging.AuthorizationStatus.PROVISIONAL) {
          console.error('[FCM] Permission denied by user');
          return;
        }
      }

      const fcmToken = await messaging().getToken();
      console.log('[FCM] Token retrieved:', fcmToken ? `${fcmToken.substring(0, 20)}...` : 'null');

      // Get device ID for deduplication
      const deviceId = await DeviceUtils.getDeviceId();
      console.log('[FCM] Device ID:', deviceId);

      // Call cloud function to store token
      // Note: The function is deployed in asia-south1 region
      console.log('[FCM] Setting up functions instance');
      
      // Create functions instance with explicit app reference (default region)
      const app = firebase.app(); // Get the default Firebase app
      const functionsInstance = functions(app);
      
      // Set the functions emulator URL for development (comment out for production)
      // functionsInstance.useEmulator('localhost', 5001);
      
      console.log('[FCM] Functions instance created with app reference');
      console.log('[FCM] App options:', {
        projectId: app.options.projectId,
        appId: app.options.appId,
        authDomain: app.options.authDomain
      });
      
      const addFcmTokenDefault = functionsInstance.httpsCallable('addFcmTokenDefault');
      console.log('[FCM] Callable function reference created');
      
      console.log('Calling addFcmTokenDefault with:', {
        userDocPath: `user/${currentUser.uid}`,
        fcmTokenLength: fcmToken.length,
        deviceType: Platform.OS,
        deviceId: deviceId,
      });
      
      try {
        console.log('[FCM] Attempting Cloud Function call...');
        
        // Wait a bit to ensure Firebase Auth state is fully established
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Double-check that we still have a valid user and token
        const freshUser = auth.currentUser;
        if (!freshUser) {
          throw new Error('User signed out during FCM token storage');
        }
        
        // Get a fresh ID token right before the call
        const freshIdToken = await freshUser.getIdToken(true);
        console.log('[FCM] Fresh ID token obtained:', freshIdToken.substring(0, 50));
        
        // First, test basic authentication with a simple function
        // try {
        //   console.log('[FCM] Testing authentication with testAuth function...');
        //   const testAuthFunction = functionsInstance.httpsCallable('testAuth');
        //   const testResult = await testAuthFunction({ test: 'data' });
        //   console.log('[FCM] Test auth result:', testResult.data);
          
        //   if (!testResult.data.success) {
        //     throw new Error('Test authentication failed: ' + testResult.data.message);
        //   }
        // } catch (testError) {
        //   console.error('[FCM] Test authentication failed:', testError);
        //   throw new Error('Authentication test failed before FCM token storage');
        // }
        
        const result = await addFcmTokenDefault({
          userDocPath: `user/${currentUser.uid}`,
          fcmToken: fcmToken,
          deviceType: Platform.OS,
          deviceId: deviceId,
        });
        
        console.log('FCM token storage result:', result.data);
      } catch (functionError: any) {
        console.error('[FCM] Cloud function call failed:', functionError);
        console.error('[FCM] Function error code:', functionError.code);
        console.error('[FCM] Function error message:', functionError.message);
        console.error('[FCM] Function error details:', functionError.details);
        
        // Log additional debug info
        console.log('[FCM] Current user auth state:', {
          uid: currentUser.uid,
          emailVerified: currentUser.emailVerified,
          isAnonymous: currentUser.isAnonymous,
          providerData: currentUser.providerData?.map(p => ({ providerId: p.providerId, uid: p.uid }))
        });
        
        // Try a different approach - make HTTP request directly with Authorization header
        console.log('[FCM] Trying direct HTTP request approach...');
        try {
          const httpResult = await this.callFunctionDirectly(idToken, {
            userDocPath: `user/${currentUser.uid}`,
            fcmToken: fcmToken,
            deviceType: Platform.OS,
            deviceId: deviceId,
          });
          console.log('[FCM] Direct HTTP request succeeded:', httpResult);
        } catch (httpError) {
          console.error('[FCM] Direct HTTP request also failed:', httpError);
          throw functionError; // Re-throw original error
        }
      }

      // Listen for token refresh
      messaging().onTokenRefresh(async (newToken) => {
        console.log('FCM token refreshed:', newToken);
        try {
          // Get device ID for the refresh as well
          const refreshDeviceId = await DeviceUtils.getDeviceId();

          const app = firebase.app();
          const functionsForRefresh = functions(app);
          const addFcmTokenRefresh = functionsForRefresh.httpsCallable('addFcmTokenDefault');
          const refreshResult = await addFcmTokenRefresh({
            userDocPath: `user/${currentUser.uid}`,
            fcmToken: newToken,
            deviceType: Platform.OS,
            deviceId: refreshDeviceId,
          });
          console.log('FCM token refresh result:', refreshResult.data);
        } catch (refreshError) {
          console.error('Error refreshing FCM token:', refreshError);
        }
      });
    } catch (error: any) {
      console.error('[FCM] Error storing FCM token:', error);
      console.error('[FCM] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      
      // Check specific error types
      if (error.code === 'functions/not-found') {
        console.error('[FCM] Cloud function not found. Ensure the function is deployed in asia-south1 region.');
      } else if (error.code === 'functions/unauthenticated') {
        console.error('[FCM] User not authenticated. Ensure user is signed in before storing FCM token.');
      } else if (error.message?.includes('NOT_FOUND')) {
        console.error('[FCM] Firebase project or function not found. Check Firebase configuration.');
      }
    }
  }

  private setupMessageHandlers() {
    // Handle messages when app is in foreground
    messaging().onMessage(async (remoteMessage) => {
      console.log('Received foreground message:', remoteMessage);

      // Check if this is a Firebase Auth verification message
      // These messages have 'com.google.firebase.auth' in their data
      // and must be handled by Firebase Auth SDK, not by us
      if (remoteMessage.data && remoteMessage.data['com.google.firebase.auth']) {
        console.log('Firebase Auth verification message detected, letting Firebase handle it');
        // Don't return or process - Firebase Auth SDK will handle it automatically
        return;
      }

      // Don't show any notifications when app is open/in foreground
      // The message will still be received and processed, but no notification will show
      console.log('App is in foreground, not showing notification for message');
      return;
    });

    // Handle notification taps when app is in background (but not killed)
    messaging().onNotificationOpenedApp(async (remoteMessage) => {
      console.log('FCM notification opened app from background:', remoteMessage);
      const data = remoteMessage.data;

      if (data?.groupId) {
        // Handle different notification types
        // - 'open_zora': Opens Zora (Soul Bot) chat (from periodic notifications)
        // - 'new_message': Opens specific group chat (from message notifications)
        const notificationType = (data.type as string) || 'new_message';
        console.log(`Navigating to group from FCM notification (type: ${notificationType}):`, data.groupId);
        this.queueNavigation(data.groupId as string, notificationType);
      } else {
        console.log('No groupId found in FCM notification data');
      }
    });

    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Received background message:', remoteMessage);
      // Note: We don't need to show notification here as FCM handles it
    });
  }

  private async showLocalNotification(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
    const { notification, data } = remoteMessage;
    
    if (notification) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title || 'New Message',
          body: notification.body || '',
          data: data || {},
          sound: true,
        },
        trigger: null, // Show immediately
      });
    }
  }

  private setupNotificationResponseHandler() {
    // Handle notification taps
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Local notification tapped:', response);

      try {
        // Access data from the notification content
        const data = response.notification?.request?.content?.data;

        if (data && data.groupId) {
          // Check if user is currently in a chat screen
          const currentGroupId = groupChatStore.getState().currentGroupId;

          // If user is already in a chat, don't navigate away
          if (currentGroupId) {
            console.log('User is already in chat:', currentGroupId, 'Ignoring navigation to:', data.groupId);
            return; // Don't navigate away from current chat
          }

          // Handle different notification types
          // - 'open_zora': Opens Zora (Soul Bot) chat (from periodic notifications)
          // - 'new_message': Opens specific group chat (from message notifications)
          const notificationType = (data.type as string) || 'new_message';
          console.log(`Navigating to group from local notification (type: ${notificationType}):`, data.groupId);
          // Navigate to specific group chat
          this.queueNavigation(data.groupId as string, notificationType);
        } else {
          console.log('No groupId found in local notification data:', data);
        }
      } catch (error) {
        console.error('Error handling local notification tap:', error);
      }
    });
  }

  private setupAppStateHandler() {
    // Handle app state changes to clear badge when app becomes active
    this.appStateListener = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('App became active, clearing notification badge');
        await this.clearNotificationBadge();
      }
    });
  }

  private async clearNotificationBadge() {
    try {
      // Clear the notification badge
      await Notifications.setBadgeCountAsync(0);
      console.log('Notification badge cleared');
    } catch (error) {
      console.error('Error clearing notification badge:', error);
    }
  }

  private async handleInitialNotification() {
    // Check if app was opened from a notification
    const initialNotification = await messaging().getInitialNotification();

    if (initialNotification) {
      console.log('[NotificationService] App opened from notification (killed state):', initialNotification);
      const data = initialNotification.data;

      if (data?.groupId) {
        // Handle different notification types
        // - 'open_zora': Opens Zora (Soul Bot) chat (from periodic notifications)
        // - 'new_message': Opens specific group chat (from message notifications)
        const notificationType = (data.type as string) || 'new_message';
        console.log(`[NotificationService] Initial notification has groupId (type: ${notificationType}):`, data.groupId);
        this.hasInitialNotification = true;
        // Queue navigation to be processed when app is ready
        // Mark this as high priority navigation from killed state
        this.queueNavigation(data.groupId as string, notificationType);
      } else {
        console.log('[NotificationService] Initial notification missing groupId:', data);
      }
    } else {
      console.log('[NotificationService] No initial notification found');
    }
  }

  private async navigateToGroup(groupId: string, type: string = 'new_message') {
    console.log('[NotificationService] Navigating to group:', groupId, 'type:', type);

    // Determine target screen based on notification type
    const isZoraChat = type === 'open_zora';
    const targetScreen = isZoraChat ? '/soul-bot-chat' : `/chat-detail?groupId=${groupId}`;
    console.log('[NotificationService] Target screen:', targetScreen);

    // Import groupChatStore dynamically to avoid circular dependency
    const { groupChatStore } = await import('@/lib/stores/groupChatStore');

    // Wait for auth and store to be ready
    const maxAttempts = 30; // 15 seconds max wait
    let attempts = 0;

    const checkReadyAndNavigate = async () => {
      attempts++;
      const currentUser = auth.currentUser;
      const storeState = groupChatStore.getState();
      const isStoreInitialized = storeState.isInitialized;
      const isStoreLoading = storeState.isLoading;

      console.log('[NotificationService] Navigation check attempt:', attempts, {
        hasUser: !!currentUser,
        storeInitialized: isStoreInitialized,
        storeLoading: isStoreLoading
      });

      if (currentUser && isStoreInitialized && !isStoreLoading) {
        console.log('[NotificationService] User authenticated and store ready, pre-loading group and navigating:', groupId);

        // Pre-load the group to ensure it's available (only for regular chat, not Zora)
        if (!isZoraChat) {
          try {
            await groupChatStore.getState().fetchGroupIfNeeded(groupId);
            console.log('[NotificationService] Group pre-loaded successfully');
          } catch (error) {
            console.log('[NotificationService] Group pre-load failed, continuing anyway:', error);
          }
        }

        // Ensure user is in authenticated area first, then navigate to chat
        console.log('[NotificationService] Navigating to authenticated area and then to:', targetScreen);

        // First ensure we're in the main app area
        router.replace('/(tabs)');

        // Then navigate to the specific chat after a small delay
        setTimeout(() => {
          console.log('[NotificationService] Executing navigation to:', targetScreen);
          router.push(targetScreen);
        }, 300);
      } else if (attempts < maxAttempts) {
        const delay = attempts < 10 ? 500 : 1000; // Start with 500ms, then slow down
        console.log('[NotificationService] Waiting for auth and store...', {
          attempt: attempts,
          nextCheckIn: delay + 'ms'
        });
        setTimeout(checkReadyAndNavigate, delay);
      } else {
        console.log('[NotificationService] Timeout waiting for auth/store, attempting navigation anyway');

        // Try to pre-load group if possible (only for regular chat, not Zora)
        if (!isZoraChat) {
          try {
            if (currentUser && isStoreInitialized) {
              await groupChatStore.getState().fetchGroupIfNeeded(groupId);
              console.log('[NotificationService] Group pre-loaded during timeout scenario');
            }
          } catch (error) {
            console.log('[NotificationService] Group pre-load failed during timeout:', error);
          }
        }

        // Try to navigate anyway - might work if everything loaded in the meantime
        console.log('[NotificationService] Timeout scenario - ensuring main app area and then navigating to:', targetScreen);
        router.replace('/(tabs)');
        setTimeout(() => {
          router.push(targetScreen);
        }, 300);
      }
    };

    // Start checking with a small initial delay
    setTimeout(checkReadyAndNavigate, 100);
  }

  private queueNavigation(groupId: string, type: string = 'new_message') {
    console.log('[NotificationService] Queueing navigation to group:', groupId, 'type:', type, 'App ready:', this.isAppReady);

    // Clear any existing queued navigations and add this one
    this.navigationQueue = [{ groupId, type }];

    // If app is ready, process the queue immediately
    if (this.isAppReady) {
      console.log('[NotificationService] App already ready, processing immediately');
      setTimeout(() => {
        this.processNavigationQueue();
      }, 100);
    } else {
      console.log('[NotificationService] App not ready yet, navigation queued');
    }
  }

  private processNavigationQueue() {
    console.log('[NotificationService] Processing navigation queue, items:', this.navigationQueue.length);

    if (this.navigationQueue.length === 0) {
      console.log('[NotificationService] Navigation queue is empty');
      return;
    }

    // Process the first item in the queue
    const navigation = this.navigationQueue.shift();
    if (navigation) {
      console.log('[NotificationService] Processing queued navigation to group:', navigation.groupId, 'type:', navigation.type);
      this.hasInitialNotification = false; // Clear the flag
      this.navigateToGroup(navigation.groupId, navigation.type);
    }

    // Clear any remaining items as we only need to navigate to one group
    this.navigationQueue = [];
  }

  // Call this method when the app is ready to handle navigation
  setAppReady() {
    console.log('[NotificationService] App is ready for navigation, queue length:', this.navigationQueue.length);
    this.isAppReady = true;

    // Process navigation queue with a small delay to ensure navigation stack is ready
    setTimeout(() => {
      this.processNavigationQueue();
    }, 500);
  }

  // Helper method to call Cloud Function directly via HTTP with Authorization header
  private async callFunctionDirectly(idToken: string, data: any) {
    const functionUrl = 'https://us-central1-zeal2-3435c.cloudfunctions.net/addFcmTokenDefault';
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        data: data
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    return result;
  }

  cleanup() {
    // Remove listeners
    if (this.notificationListener) {
      this.notificationListener();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
  }

  // Method to manually refresh FCM token (useful after login)
  async refreshFCMToken() {
    // Add a delay to ensure user authentication is complete
    // This gives time for the Firebase Auth context to be fully established
    setTimeout(async () => {
      await this.getAndStoreFCMToken();
    }, 3000); // Increased delay to 3 seconds
  }

  // Method to check if there's a pending navigation from notification
  hasPendingNavigation(): boolean {
    return this.navigationQueue.length > 0 || this.hasInitialNotification;
  }


  // Method to remove FCM token on logout (device-specific)
  async removeFCMToken() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log('No user logged in, skipping FCM token removal');
        return;
      }

      console.log('[FCM] Starting FCM token removal for user:', currentUser.uid);

      // Get device ID for precise removal
      const deviceId = await DeviceUtils.getDeviceId();
      console.log('[FCM] Device ID for removal:', deviceId);

      // Create functions instance
      const app = firebase.app();
      const functionsInstance = functions(app);

      const removeFcmTokenFunction = functionsInstance.httpsCallable('removeFcmToken');

      const result = await removeFcmTokenFunction({
        userDocPath: `user/${currentUser.uid}`,
        deviceId: deviceId,
      });

      console.log('[FCM] Token removal result:', result.data);

    } catch (error) {
      console.error('[FCM] Error removing FCM token:', error);
    }
  }

}