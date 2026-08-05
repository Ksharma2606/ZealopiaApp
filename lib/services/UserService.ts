import { db } from '@/lib/firebase';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface UserData {
  uid: string;
  id: number;
  name?: string;
  displayName?: string;
  email?: string;
  photoUrl?: string;
  memberships?: FirebaseFirestoreTypes.DocumentReference;
}

class UserService {
  private userCache = new Map<string, UserData>();
  private userListeners = new Map<string, () => void>();
  private membershipCache = new Map<string, Map<string, any>>(); // uid -> groupId -> membership

  /**
   * Get user data by Firebase UID with caching
   */
  async getUserByUid(uid: string): Promise<UserData | null> {
    // Check cache first
    if (this.userCache.has(uid)) {
      console.log('[UserService] Returning cached user:', uid);
      return this.userCache.get(uid)!;
    }
    
    console.log('[UserService] Loading user from Firebase:', uid);

    try {
      const userQuery = await db.collection('user')
        .where('uid', '==', uid)
        .limit(1)
        .get();

      if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];
        const userData: UserData = {
          uid: userDoc.data().uid,
          id: userDoc.data().id,
          name: userDoc.data().name,
          displayName: userDoc.data().displayName,
          email: userDoc.data().email,
          photoUrl: userDoc.data().photoUrl,
          memberships: userDoc.data().memberships,
        };

        // Cache the user data
        this.userCache.set(uid, userData);
        console.log('[UserService] User cached:', uid, userData.name || userData.displayName);
        return userData;
      }

      return null;
    } catch (error) {
      console.error('Error fetching user by UID:', error);
      return null;
    }
  }

  /**
   * Get user data by user document reference
   */
  async getUserByReference(userRef: FirebaseFirestoreTypes.DocumentReference): Promise<UserData | null> {
    try {
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        const data = userDoc.data();
        const userData: UserData = {
          uid: data?.uid || userDoc.id,
          id: data?.id || 0,
          name: data?.name,
          displayName: data?.displayName,
          email: data?.email,
          photoUrl: data?.photoUrl,
        };

        // Cache the user data using UID if available
        if (userData.uid) {
          this.userCache.set(userData.uid, userData);
        }

        return userData;
      }

      return null;
    } catch (error) {
      console.error('Error fetching user by reference:', error);
      return null;
    }
  }

  /**
   * Get display name for a user, with fallback logic
   */
  getDisplayName(userData: UserData | null): string {
    if (!userData) return 'Unknown User';
    
    return userData.name || 
           userData.displayName || 
           userData.email?.split('@')[0] || 
           'User';
  }

  /**
   * Subscribe to real-time user updates
   */
  subscribeToUser(
    uid: string, 
    onUpdate: (userData: UserData | null) => void
  ): () => void {
    // Clean up existing listener if any
    this.unsubscribeFromUser(uid);

    const unsubscribe = db.collection('user')
      .where('uid', '==', uid)
      .limit(1)
      .onSnapshot(
        (snapshot) => {
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData: UserData = {
              uid: userDoc.data().uid,
              id: userDoc.data().id,
              name: userDoc.data().name,
              displayName: userDoc.data().displayName,
              email: userDoc.data().email,
              photoUrl: userDoc.data().photoUrl,
            };

            // Update cache
            this.userCache.set(uid, userData);
            onUpdate(userData);
          } else {
            onUpdate(null);
          }
        },
        (error) => {
          console.error('Error in user subscription:', error);
          onUpdate(null);
        }
      );

    // Store the unsubscribe function
    this.userListeners.set(uid, unsubscribe);
    
    return unsubscribe;
  }

  /**
   * Unsubscribe from user updates
   */
  unsubscribeFromUser(uid: string): void {
    const unsubscribe = this.userListeners.get(uid);
    if (unsubscribe) {
      unsubscribe();
      this.userListeners.delete(uid);
    }
  }

  /**
   * Clear all user data and listeners
   */
  clearCache(): void {
    console.log('[UserService] Clearing cache - users:', this.userCache.size, 'listeners:', this.userListeners.size);
    // Unsubscribe from all listeners
    this.userListeners.forEach((unsubscribe) => unsubscribe());
    this.userListeners.clear();
    
    // Clear cache
    this.userCache.clear();
    this.membershipCache.clear();
  }
  
  /**
   * Clear cache for specific user
   */
  clearUserCache(uid: string): void {
    console.log('[UserService] Clearing cache for user:', uid);
    this.userCache.delete(uid);
    this.membershipCache.delete(uid);
    this.unsubscribeFromUser(uid);
  }

  /**
   * Get cached user data without making API calls
   */
  getCachedUser(uid: string): UserData | null {
    return this.userCache.get(uid) || null;
  }

  /**
   * Pre-fetch and cache multiple users
   */
  async preloadUsers(uids: string[]): Promise<void> {
    const uncachedUids = uids.filter(uid => !this.userCache.has(uid));
    console.log('[UserService] Preloading', uncachedUids.length, 'uncached users out of', uids.length, 'requested');
    
    if (uncachedUids.length === 0) return;
    
    const promises = uncachedUids.map(uid => this.getUserByUid(uid));
    await Promise.all(promises);
  }
  
  /**
   * Get cached membership for a user in a group
   */
  getCachedMembership(uid: string, groupId: string): any | null {
    const userMemberships = this.membershipCache.get(uid);
    return userMemberships?.get(groupId) || null;
  }
  
  /**
   * Cache membership data
   */
  cacheMembership(uid: string, groupId: string, membership: any): void {
    if (!this.membershipCache.has(uid)) {
      this.membershipCache.set(uid, new Map());
    }
    this.membershipCache.get(uid)!.set(groupId, membership);
    console.log('[UserService] Cached membership for user:', uid, 'in group:', groupId);
  }

  /**
   * Clear cached data for a specific group context
   * Helps prevent cross-contamination between groups
   */
  clearCacheForGroup(groupId: string): void {
    console.log('[UserService] Clearing cache for group:', groupId);
    
    // Clear membership cache entries for this group
    this.membershipCache.forEach((userMemberships, uid) => {
      userMemberships.delete(groupId);
      if (userMemberships.size === 0) {
        this.membershipCache.delete(uid);
      }
    });
    
    console.log('[UserService] Cleared cache entries for group:', groupId);
  }
}

export default new UserService();