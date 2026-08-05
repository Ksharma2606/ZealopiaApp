import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedData<T> {
  data: T;
  timestamp: number;
  expiryTime?: number;
}

class StorageService {
  private static instance: StorageService;
  
  // Storage keys
  private readonly KEYS = {
    BACKEND_USER: 'cached_backend_user',
    AUTH_TOKENS: 'cached_auth_tokens',
    TOKEN_EXPIRY: 'token_expiry_time',
    LAST_SYNC: 'last_backend_sync',
  };

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Save data with optional expiry
  async setItem<T>(key: string, data: T, expiryMinutes?: number): Promise<void> {
    try {
      const cached: CachedData<T> = {
        data,
        timestamp: Date.now(),
        expiryTime: expiryMinutes ? Date.now() + (expiryMinutes * 60 * 1000) : undefined,
      };
      await AsyncStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
      console.error('StorageService - Error saving item:', key, error);
    }
  }

  // Get data if not expired
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const storedData = await AsyncStorage.getItem(key);
      if (!storedData) return null;

      const cached: CachedData<T> = JSON.parse(storedData);
      
      // Check if data has expired
      if (cached.expiryTime && Date.now() > cached.expiryTime) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.error('StorageService - Error getting item:', key, error);
      return null;
    }
  }

  // Remove item
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('StorageService - Error removing item:', key, error);
    }
  }

  // Cache backend user data
  async cacheBackendUser(userData: any): Promise<void> {
    await this.setItem(this.KEYS.BACKEND_USER, userData, 60 * 24); // Cache for 24 hours
    await this.setItem(this.KEYS.LAST_SYNC, Date.now());
  }

  // Get cached backend user
  async getCachedBackendUser(): Promise<any | null> {
    return this.getItem(this.KEYS.BACKEND_USER);
  }

  // Cache auth tokens with expiry
  async cacheAuthTokens(tokens: {
    access: string;
    refresh: string;
    access_token_expires_at: string;
  }): Promise<void> {
    await this.setItem(this.KEYS.AUTH_TOKENS, tokens);
    
    // Store token expiry time for proactive refresh
    const expiryTime = new Date(tokens.access_token_expires_at).getTime();
    await this.setItem(this.KEYS.TOKEN_EXPIRY, expiryTime);
  }

  // Get cached auth tokens
  async getCachedAuthTokens(): Promise<any | null> {
    return this.getItem(this.KEYS.AUTH_TOKENS);
  }

  // Check if token needs refresh (5 minutes before expiry)
  async shouldRefreshToken(): Promise<boolean> {
    try {
      const expiryTime = await this.getItem<number>(this.KEYS.TOKEN_EXPIRY);
      if (!expiryTime) {
        console.log('StorageService - No token expiry found, should refresh');
        return true; // No expiry stored, refresh to be safe
      }
      
      const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
      const shouldRefresh = fiveMinutesFromNow >= expiryTime;
      
      console.log('StorageService - Token refresh check:', {
        currentTime: new Date(Date.now()).toISOString(),
        expiryTime: new Date(expiryTime).toISOString(),
        fiveMinutesFromNow: new Date(fiveMinutesFromNow).toISOString(),
        shouldRefresh
      });
      
      return shouldRefresh;
    } catch (error) {
      console.error('StorageService - Error checking token expiry:', error);
      return true; // Refresh on error
    }
  }

  // Get time since last sync
  async getTimeSinceLastSync(): Promise<number | null> {
    const lastSync = await this.getItem<number>(this.KEYS.LAST_SYNC);
    if (!lastSync) return null;
    return Date.now() - lastSync;
  }

  // Clear all cached data
  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        this.removeItem(this.KEYS.BACKEND_USER),
        this.removeItem(this.KEYS.AUTH_TOKENS),
        this.removeItem(this.KEYS.TOKEN_EXPIRY),
        this.removeItem(this.KEYS.LAST_SYNC),
      ]);
    } catch (error) {
      console.error('StorageService - Error clearing cache:', error);
    }
  }
}

export const storageService = StorageService.getInstance();