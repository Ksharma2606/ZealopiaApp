import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { auth } from '@/lib/firebase';
import apiService from '@/lib/services/ApiService';

export class DeepLinkHandler {
  private static instance: DeepLinkHandler;
  private linkingListener: ReturnType<typeof Linking.addEventListener> | null = null;

  private constructor() {}

  static getInstance(): DeepLinkHandler {
    if (!DeepLinkHandler.instance) {
      DeepLinkHandler.instance = new DeepLinkHandler();
    }
    return DeepLinkHandler.instance;
  }

  /**
   * Initialize deep link handling
   * Should be called once during app initialization
   */
  initialize() {
    console.log('[DeepLinkHandler] Initializing deep link handler');

    // Handle initial URL (app opened via link)
    this.handleInitialURL();

    // Listen for incoming links (app opened while running)
    this.linkingListener = Linking.addEventListener('url', this.handleDeepLink);
  }

  /**
   * Handle initial URL when app is opened via deep link
   */
  private async handleInitialURL() {
    try {
      const initialUrl = await Linking.getInitialURL();

      if (initialUrl) {
        console.log('[DeepLinkHandler] App opened with initial URL:', initialUrl);
        this.processURL(initialUrl);
      }
    } catch (error) {
      console.error('[DeepLinkHandler] Error handling initial URL:', error);
    }
  }

  /**
   * Handle incoming deep links while app is running
   */
  private handleDeepLink = (event: { url: string }) => {
    console.log('[DeepLinkHandler] Received deep link:', event.url);
    this.processURL(event.url);
  };

  /**
   * Process and navigate based on URL
   * Only processes if user is authenticated, otherwise ignores the link
   */
  private async processURL(url: string) {
    try {
      const parsed = Linking.parse(url);
      console.log('[DeepLinkHandler] Parsed URL:', {
        scheme: parsed.scheme,
        hostname: parsed.hostname,
        path: parsed.path,
        queryParams: parsed.queryParams,
      });

      // Check if user is authenticated
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log('[DeepLinkHandler] User not authenticated, ignoring deep link');
        return;
      }

      // Handle different URL patterns
      // Pattern 1: https://api2.zealopia.com/group/123
      //   - hostname: "api2.zealopia.com"
      //   - path: "/group/123"
      // Pattern 2: zealopia://group/123
      //   - hostname: "group"
      //   - path: "123"

      let groupId: string | null = null;

      // Check if using custom scheme (zealopia://)
      if (parsed.scheme === 'zealopia' && parsed.hostname === 'group' && parsed.path) {
        // Format: zealopia://group/123
        groupId = parsed.path.replace(/^\//, ''); // Remove leading slash if present
      } else if (parsed.path) {
        // Format: https://api2.zealopia.com/group/123
        const pathParts = parsed.path.split('/').filter(Boolean);
        if (pathParts[0] === 'group' && pathParts[1]) {
          groupId = pathParts[1];
        }
      }

      if (groupId) {
        console.log('[DeepLinkHandler] Processing group deep link:', groupId);
        await this.handleGroupDeepLink(groupId);
      } else {
        console.warn('[DeepLinkHandler] Could not extract group ID from URL');
      }
    } catch (error) {
      console.error('[DeepLinkHandler] Error processing URL:', error);
    }
  }

  /**
   * Handle group deep link navigation
   * Checks if user is a member and navigates accordingly
   */
  private async handleGroupDeepLink(groupId: string) {
    try {
      console.log('[DeepLinkHandler] Checking group membership for group:', groupId);

      // First, check if user is a member by calling getGroupDetails
      const detailsResponse = await apiService.getGroupDetails(parseInt(groupId));

      if (detailsResponse.success && detailsResponse.data) {
        // User is a member - now get the Firebase UID from group card
        console.log('[DeepLinkHandler] User is member, getting Firebase UID');

        const cardResponse = await apiService.getGroupCard(parseInt(groupId));

        if (cardResponse.success && cardResponse.data?.firebase_uid) {
          const firebaseUid = cardResponse.data.firebase_uid;
          console.log('[DeepLinkHandler] Firebase UID obtained, navigating to chat');

          // Navigate directly to chat detail
          router.push({
            pathname: '/chat-detail',
            params: {
              groupId: firebaseUid,
            }
          });
        } else {
          console.error('[DeepLinkHandler] Could not get Firebase UID from group card');
        }
      } else if (detailsResponse.status === 403) {
        // User is not a member - navigate to explore tab with join modal
        console.log('[DeepLinkHandler] User is not member, navigating to explore with join modal');

        // Navigate to explore tab with the group ID parameter
        // The explore tab will handle showing the join modal once data is loaded
        router.push({
          pathname: '/(tabs)/explore',
          params: {
            joinGroupId: groupId,
          }
        });
      } else {
        console.error('[DeepLinkHandler] Error checking group membership:', detailsResponse.error);
      }
    } catch (error) {
      console.error('[DeepLinkHandler] Error handling group deep link:', error);
    }
  }

  /**
   * Cleanup listeners
   */
  cleanup() {
    if (this.linkingListener) {
      this.linkingListener.remove();
      this.linkingListener = null;
    }
  }
}
