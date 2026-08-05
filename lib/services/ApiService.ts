import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';
import { errorService, ErrorType, AppError, createRetryableOperation } from './ErrorService';
import { storageService } from './StorageService';

// Enhanced types for API responses with error handling
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  appError?: AppError;
  status?: number;
  retryable?: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  access_token_expires_at: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  access_token_expires_at: string;
  user: {
    id: number;
    firebase_uid: string;
    email?: string;
    mobile?: string;
    user_profile: {
      id: number;
      name?: string;
      email?: string;
      is_signup_completed: boolean;
    };
    medical_profile?: {
      id?: number;
      name?: string;
      title?: string;
      bio?: string;
    };
    soul_bot_group_uid?: string;
    last_soul_profile_generated_at?: string;
  };
}

export interface RecommendedGroup {
  id: number;
  name: string;
  description: string;
  default_group_pic_url?: string;
  cost: number;
  num_members: number;
  max_num_members: number;
  status: string;
  firebase_uid: string;
  medic?: {
    name: string;
    designation?: string;
    title?: string;
    years_of_experience?: number;
  };
  medic_soul_match_emoji: string;
  medic_soul_match_percentage: number;
}

export interface GroupMember {
  name: string;
  role: 'Admin' | 'Member';
  profile_picture: string;
  group_id: number;
  user_id: number;
  firebase_uid: string;
  soul_match_emoji: string;
  soul_match_percentage: number;
}

export interface GroupDetails {
  name: string;
  description: string;
  expiry_on: string | null;
  medic: {
    name: string;
    designation?: string;
    title?: string;
    years_of_experience?: number;
  };
  members: GroupMember[];
}

// Medic 1-1 Chat related interfaces
export interface MedicProfile {
  id: number;
  name: string;
  raw_name: string;
  title: string;
  designation: string;
  bio: string;
  years_of_experience: number;
  field_of_expertise: string;
  one_on_one_price: number;
  one_on_one_price_3_months: number;
  max_one_on_one_chats: number;
  recent_one_on_one_count: number;
  available_slots: number;
  profile_picture_url?: string;
  match_percentage?: number;
  match_emoji?: string;
  score_breakdown?: string;
  match_text?: string;
}

export interface OneOnOneDetails {
  id: number;
  name: string;
  title: string;
  designation: string;
  bio: string;
  years_of_experience: number;
  field_of_expertise: string;
  one_on_one_price: number;
  one_on_one_price_3_months: number;
  profile_picture_url?: string;
}

export interface OneOnOneOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  receipt: string;
  payment_amount: number;
  credits_to_use: number;
}

export interface OneOnOneGroupResponse {
  firebase_uid: string;
}

// User match interface for top-matches screen
export interface UserMatch {
  user_id: number;
  name: string;
  pronouns?: string | null;
  orientation?: string | null;
  match_percentage: number;
  match_emoji?: string;
}

export interface TopUserMatchesResponse {
  matches: UserMatch[];
  total_count: number;
}

// Interface for handling auth state changes with backend integration
export interface AuthStateChangeHandler {
  onSignIn: (userData: any) => void;
  onSignOut: () => void;
  onError: (error: Error) => void;
}

class ApiService {
  // private baseUrl: string = 'https://up4ma5gt3qd0.share.zrok.io/v1'; // Update this with your actual backend URL
  // private baseUrl: string = 'https://zealopia.vivekagr.com/v1';
  private baseUrl: string = 'https://api2.zealopia.com/v1';
  private authToken: string | null = null;
  private refreshToken: string | null = null;
  // private tokenRefreshPromise: Promise<boolean> | null = null;
  private registrationPromise: Promise<ApiResponse<LoginResponse>> | null = null;

  constructor() {
    this.loadAuthToken();
    // this.initializeTokenRefresh();
  }

  // Load auth token from storage
  private async loadAuthToken(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      this.authToken = token;
    } catch (error) {
      console.error('Error loading auth token:', error);
    }
  }

  // Save auth token to storage
  private async saveAuthToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('auth_token', token);
      this.authToken = token;
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
  }

  // // Initialize Firebase token management
  // private async initializeTokenRefresh(): Promise<void> {
  //   try {
  //     // Firebase handles token refresh automatically
  //     // We just need to ensure we're using fresh tokens for API calls
  //     console.log('Firebase token management initialized - tokens refresh automatically');
  //   } catch (error) {
  //     console.error('Error initializing token refresh:', error);
  //   }
  // }

  // // Firebase token refresh (tokens are automatically refreshed by Firebase)
  // private async refreshFirebaseToken(): Promise<boolean> {
  //   try {
  //     const currentUser = auth.currentUser;
  //     if (currentUser) {
  //       console.log('Refreshing Firebase token...');
  //       // Firebase automatically handles token refresh, we just need to get a fresh one
  //       await currentUser.getIdToken(true);
  //       console.log('Firebase token refresh successful');
  //       return true;
  //     }
  //     console.error('No Firebase user available for token refresh');
  //     return false;
  //   } catch (error) {
  //     console.error('Error refreshing Firebase token:', error);
  //     return false;
  //   }
  // }

  // Clear auth token - made public for sign out
  public async clearAuthTokens(): Promise<void> {
    try {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('refresh_token');
      this.authToken = null;
      this.refreshToken = null;
      await storageService.clearAll();
    } catch (error) {
      console.error('Error clearing auth tokens:', error);
    }
  }
  
  // Alias for backward compatibility
  private async clearAuthToken(): Promise<void> {
    return this.clearAuthTokens();
  }

  // // Save all auth tokens (access, refresh, expiry)
  // private async saveTokens(tokens: AuthTokens): Promise<void> {
  //   try {
  //     // Save individual tokens to AsyncStorage for backward compatibility
  //     await AsyncStorage.setItem('auth_token', tokens.access);
  //     await AsyncStorage.setItem('refresh_token', tokens.refresh);
  //     await AsyncStorage.setItem('token_expiry', tokens.access_token_expires_at);
      
  //     // Update instance variables
  //     this.authToken = tokens.access;
  //     this.refreshToken = tokens.refresh;
      
  //     // Cache tokens with storage service
  //     await storageService.cacheAuthTokens(tokens);
      
  //     console.log('Tokens saved successfully');
  //   } catch (error) {
  //     console.error('Error saving tokens:', error);
  //   }
  // }

  // Enhanced generic request method with comprehensive error handling
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOptions?: { maxRetries?: number; retryDelay?: number; skipAuth?: boolean }
  ): Promise<ApiResponse<T>> {
    const executeRequest = async (): Promise<ApiResponse<T>> => {
      try {
        // For protected endpoints, always use Firebase ID tokens
        const protectedEndpoints = [
          '/user/me',
          '/user/profile',
          '/user/credits',
          '/user/redeem_coupon',
          '/user/my_topics',
          '/user/topics',
          '/user/top_matches',
          '/user/express_interest_in_user_chat',
          '/group/recommended',
          '/group',
          '/group-template',
          '/soul-bot/message',
          '/soul-bot/profile',
          '/soul-profile/report',
          '/chat/attachment',
          '/user/track_activity',
          '/medic/available_for_chat',
          '/medic/',
          '/subscription/create-extension-order',
          '/subscription/extend',
          '/subscription/status/',
          '/subscription/rate-therapist',
          '/subscription/share-previous-summary',
          '/subscription/share-soul-profile'
        ];
        const isProtectedEndpoint = protectedEndpoints.some(ep => endpoint.includes(ep)) && !retryOptions?.skipAuth;

        let authToken: string | null = null;
        
        if (isProtectedEndpoint) {
          // Always use Firebase ID token for protected endpoints
          if (auth.currentUser) {
            try {
              authToken = await auth.currentUser.getIdToken(true);
            } catch (tokenError) {
              console.error('Failed to get Firebase token:', tokenError);
              const appError = errorService.createError(
                ErrorType.AUTHENTICATION,
                'Failed to get authentication token',
                { details: tokenError, retryable: true }
              );
              return {
                success: false,
                error: appError.userMessage,
                appError,
                retryable: appError.retryable,
              };
            }
          } else {
            console.error('No Firebase user available for protected endpoint');
            const appError = errorService.createError(
              ErrorType.AUTHENTICATION,
              'User not authenticated',
              { retryable: false }
            );
            return {
              success: false,
              error: appError.userMessage,
              appError,
              retryable: appError.retryable,
            };
          }
        }

        const url = `${this.baseUrl}${endpoint}`;
        const headers: { [key: string]: string } = {
          'Content-Type': 'application/json',
        };

        // Add any additional headers
        if (options.headers) {
          Object.assign(headers, options.headers);
        }

        // Add auth token if available
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        } else if (isProtectedEndpoint) {
          const appError = errorService.createError(
            ErrorType.AUTHENTICATION,
            'No authentication token available',
            { retryable: false }
          );
          return {
            success: false,
            error: appError.userMessage,
            appError,
            retryable: appError.retryable,
          };
        }
        
        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Handle both JSON and HTML responses
        let responseData: any;
        const contentType = response.headers.get('content-type');
        
        try {
          if (contentType?.includes('application/json')) {
            responseData = await response.json();
          } else {
            // If not JSON, get text (likely HTML error page)
            const responseText = await response.text();
            responseData = { 
              error: `Server returned ${response.status} error`,
              details: responseText.substring(0, 500) // Truncate long HTML
            };
          }
        } catch (parseError) {
          // If parsing fails completely, create generic error
          responseData = { 
            error: `Failed to parse server response (${response.status})`,
            parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
          };
        }

        if (response.ok) {
          return {
            success: true,
            data: responseData,
            status: response.status,
            retryable: false,
          };
        } else {
          // Create appropriate error based on status code
          const errorType = this.getErrorTypeFromStatus(response.status);
          const errorMessage = responseData.message || responseData.error || 'Request failed';
          
          const appError = errorService.createError(errorType, errorMessage, {
            code: response.status.toString(),
            details: { url, status: response.status, responseData, body: options.body },
            retryable: this.isRetryableStatus(response.status),
          });

          return {
            success: false,
            error: appError.userMessage,
            appError,
            status: response.status,
            retryable: appError.retryable,
          };
        }
      } catch (networkError) {
        const appError = errorService.createError(
          ErrorType.NETWORK,
          networkError instanceof Error ? networkError.message : 'Network error',
          {
            details: { endpoint, options, error: networkError },
            retryable: true
          }
        );

        return {
          success: false,
          error: appError.userMessage,
          appError,
          retryable: appError.retryable,
        };
      }
    };

    // Apply retry logic if specified
    if (retryOptions?.maxRetries && retryOptions.maxRetries > 0) {
      const retryableOperation = createRetryableOperation(
        executeRequest,
        retryOptions.maxRetries,
        retryOptions.retryDelay
      );
      return retryableOperation();
    }

    return executeRequest();
  }

  // Helper method to determine error type from HTTP status
  private getErrorTypeFromStatus(status: number): ErrorType {
    if (status === 401 || status === 403) {
      return ErrorType.AUTHENTICATION;
    }
    if (status >= 400 && status < 500) {
      return ErrorType.VALIDATION;
    }
    if (status >= 500) {
      return ErrorType.NETWORK;
    }
    return ErrorType.UNKNOWN;
  }

  // Helper method to determine if status code is retryable
  private isRetryableStatus(status: number): boolean {
    // Retry server errors and some client errors
    return status >= 500 || status === 408 || status === 429;
  }

  // Soul Bot methods
  async sendSoulBotMessage(message: string): Promise<ApiResponse> {
    return this.makeRequest('/soul-bot/message', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getSoulProfile(): Promise<ApiResponse> {
    return this.makeRequest('/soul-bot/profile', {
      method: 'GET',
    });
  }

  async markSoulProfileAsViewed(): Promise<ApiResponse> {
    return this.makeRequest('/soul-bot/profile/mark-viewed', {
      method: 'POST',
    });
  }

  // Soul Profile Report methods
  async getSoulProfileReportStatus(): Promise<ApiResponse> {
    return this.makeRequest('/soul-profile/report/status', {
      method: 'GET',
    });
  }

  async createSoulProfileReportOrder(creditsToUse: number = 0): Promise<ApiResponse> {
    return this.makeRequest('/soul-profile/report/create-order', {
      method: 'POST',
      body: JSON.stringify({ credits_to_use: creditsToUse }),
    });
  }

  async purchaseSoulProfileReport(paymentId?: string, creditsUsed: number = 0): Promise<ApiResponse> {
    return this.makeRequest('/soul-profile/report/purchase', {
      method: 'POST',
      body: JSON.stringify({
        payment_id: paymentId,
        credits_used: creditsUsed,
      }),
    });
  }

  // Authentication methods
  async requestOTP(mobile: string): Promise<ApiResponse> {
    return this.makeRequest('/login/request_otp', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    });
  }

  async verifyOTP(mobile: string, otp: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.makeRequest<LoginResponse>('/login/verify_otp', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp }),
    });

    // Save auth token if login successful
    if (response.success && response.data?.access) {
      await this.saveAuthToken(response.data.access);
    }

    return response;
  }

  async registerFirebaseToken(firebaseToken: string): Promise<ApiResponse<any>> {
    // If registration is already in progress, wait for it
    if (this.registrationPromise) {
      return this.registrationPromise;
    }

    this.registrationPromise = this.performFirebaseTokenRegistration(firebaseToken);
    
    try {
      const result = await this.registrationPromise;
      return result;
    } finally {
      this.registrationPromise = null;
    }
  }

  private async performFirebaseTokenRegistration(firebaseToken: string): Promise<ApiResponse<any>> {
    const response = await this.makeRequest<any>('/login/register_firebase_token', {
      method: 'POST',
      body: JSON.stringify({ token: firebaseToken }),
    }, { maxRetries: 3, retryDelay: 2000, skipAuth: true }); // Add retry logic for this critical endpoint

    return response;
  }

  // Auth flow helper methods
  async completeAuthFlow(): Promise<any> {
    try {
      // Get the current Firebase user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No Firebase user is logged in');
      }

      // Get the Firebase ID token with force refresh
      let firebaseToken: string;
      try {
        firebaseToken = await currentUser.getIdToken(true);
      } catch (tokenError: any) {
        // If token fetch fails, check if it's a network error
        if (tokenError.code === 'auth/network-request-failed' || 
            tokenError.message?.includes('fetch failed')) {
          throw new Error('Network connection error. Please check your internet connection.');
        }
        throw tokenError;
      }

      // Register the token with the backend
      const response = await this.registerFirebaseToken(firebaseToken);

      if (!response.success) {
        throw new Error(response.error || 'Failed to register Firebase token');
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  setupAuthStateListener(handlers: AuthStateChangeHandler) {
    let retryCount = 0;
    const maxRetries = 3;
    let isHandlingAuthChange = false;
    
    return auth.onAuthStateChanged(async (user) => {
      // Prevent concurrent auth state handling
      if (isHandlingAuthChange) {
        return;
      }

      isHandlingAuthChange = true;

      try {
        if (user) {
          // User is signed in, complete the auth flow with backend
          const authenticateWithRetry = async (): Promise<any> => {
            try {
              const userData = await this.completeAuthFlow();
              retryCount = 0; // Reset retry count on success
              return userData;
            } catch (error: any) {
              
              // Check if error is network related
              const isNetworkError = error.message?.includes('Connection closed') || 
                                   error.message?.includes('Network request failed') ||
                                   error.message?.includes('fetch failed') ||
                                   error.code === 'auth/network-request-failed' ||
                                   error.code === 'auth/internal-error';
              
              if (isNetworkError && retryCount < maxRetries - 1) {
                retryCount++;
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, retryCount - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return authenticateWithRetry();
              }
              
              throw error;
            }
          };
          
          try {
            const userData = await authenticateWithRetry();
            // Cache the user data on successful authentication
            if (userData?.user) {
              await storageService.cacheBackendUser(userData.user);
            }
            handlers.onSignIn(userData);
          } catch (error) {
            handlers.onError(error instanceof Error ? error : new Error('Authentication failed'));
          }
        } else {
          // User is signed out
          await this.clearAuthToken();
          handlers.onSignOut();
          retryCount = 0; // Reset retry count
        }
      } catch (error) {
        handlers.onError(error instanceof Error ? error : new Error('Unknown error'));
      } finally {
        isHandlingAuthChange = false;
      }
    });
  }

  // Group methods
  async getRecommendedGroups(): Promise<ApiResponse<RecommendedGroup[]>> {
    return this.makeRequest<RecommendedGroup[]>('/group/recommended');
  }

  async getGroupDetails(groupId: number): Promise<ApiResponse<GroupDetails>> {
    return this.makeRequest<GroupDetails>(`/group/${groupId}/details`);
  }

  async updateUserProfile(profileData: {
    name?: string;
    birth_year?: string | number;
    pronouns?: string;
    orientation?: string;
  }): Promise<ApiResponse<LoginResponse['user']>> {
    // Convert birth_year to string if it's a number, matching Flutter Flow implementation
    const formattedData = {
      ...profileData,
      birth_year: typeof profileData.birth_year === 'number'
        ? profileData.birth_year.toString()
        : profileData.birth_year
    };

    return this.makeRequest<LoginResponse['user']>('/user/me', {
      method: 'PATCH',
      body: JSON.stringify(formattedData),
    });
  }

  // User methods
  async getCurrentUser(): Promise<ApiResponse<LoginResponse['user']>> {
    const response = await this.makeRequest<LoginResponse['user']>('/user/me');
    
    // Cache successful user data
    if (response.success && response.data) {
      await storageService.cacheBackendUser(response.data);
    }
    
    return response;
  }

  // User topics methods
  async getUserTopics(): Promise<ApiResponse<Array<{ id: number; name: string }>>> {
    return this.makeRequest('/user/my_topics', {
      method: 'GET',
    });
  }

  async updateUserTopics(topicIds: number[]): Promise<ApiResponse<any>> {
    return this.makeRequest('/user/topics', {
      method: 'POST',
      body: JSON.stringify({ topics: topicIds }),
    });
  }

  // Medic profile methods
  async updateMedicProfilePicture(imageAsset: any): Promise<ApiResponse<any>> {
    // Create form data for image upload
    const formData = new FormData();
    formData.append('profile_picture', {
      uri: imageAsset.uri,
      type: 'image/jpeg',
      name: 'profile_picture.jpg',
    } as any);

    return this.makeRequest('/medic/profile_picture', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });
  }

  // Medic 1-1 Chat methods
  async getAvailableMedicsForChat(): Promise<ApiResponse<Array<MedicProfile>>> {
    return this.makeRequest<Array<MedicProfile>>('/medic/available_for_chat', {
      method: 'GET',
    });
  }

  async getOneOnOneDetails(medicId: number): Promise<ApiResponse<OneOnOneDetails>> {
    return this.makeRequest<OneOnOneDetails>(`/medic/${medicId}/one_on_one_details`, {
      method: 'GET',
    });
  }

  async createOneOnOneOrder(medicId: number, creditsToUse: number = 0): Promise<ApiResponse<OneOnOneOrderResponse>> {
    return this.makeRequest<OneOnOneOrderResponse>(`/medic/${medicId}/create_one_on_one_order`, {
      method: 'POST',
      body: JSON.stringify({ credits_to_use: creditsToUse }),
    });
  }

  async createOneOnOneGroup(medicId: number, paymentId?: string, creditsUsed: number = 0): Promise<ApiResponse<OneOnOneGroupResponse>> {
    return this.makeRequest<OneOnOneGroupResponse>(`/medic/${medicId}/create_one_on_one_group`, {
      method: 'POST',
      body: JSON.stringify({
        payment_id: paymentId,
        credits_used: creditsUsed
      }),
    });
  }

  // Therapist matching methods
  async getTherapistMatches(limit: number = 3): Promise<ApiResponse<{
    matches: Array<{
      medic: {
        id: number;
        name: string;
        title: string;
        designation: string;
        bio: string;
        years_of_experience: number;
        field_of_expertise: string;
        one_on_one_price: number;
        one_on_one_price_3_months: number;
        max_one_on_one_chats: number;
        available_slots: number;
        profile_picture_url: string | null;
        modalities: Array<{ id: number; name: string; description: string }>;
      };
      match_percentage: number;
      match_text: string;
      top_matching_traits: string[];
      existing_group_firebase_uid?: string | null;
    }>;
    user_matches_count: number;
  }>> {
    return this.makeRequest(`/medic/therapist_matches?limit=${limit}`, {
      method: 'GET',
    });
  }

  // User matching methods
  async getTopUserMatches(limit: number = 10): Promise<ApiResponse<TopUserMatchesResponse>> {
    return this.makeRequest<TopUserMatchesResponse>(`/user/top_matches?limit=${limit}`, {
      method: 'GET',
    });
  }

  async expressInterestInUserChat(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.makeRequest<{ success: boolean; message: string }>('/user/express_interest_in_user_chat', {
      method: 'POST',
    });
  }

  // Check if user profile setup is complete
  isSignupComplete(userData: any): boolean {
    try {
      return userData?.user?.user_profile?.is_signup_completed === true;
    } catch (error) {
      console.error('Error checking signup status:', error);
      return false;
    }
  }

  // Topic methods
  async getTopics(): Promise<ApiResponse<Array<{ id: number; name: string }>>> {
    return this.makeRequest<Array<{ id: number; name: string }>>('/topic');
  }

  // Group template methods
  async createGroupTemplate(data: {
    name: string;
    description: string;
    topic: number;
    cost: number;
    expiry_months: 1 | 2;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('/group-template', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Group search and discovery methods
  async searchGroups(params: {
    search?: string;
    ordering?: string;
    medic__in?: string;
    topic__in?: string;
    cost?: string;
    cost__gt?: string;
  }): Promise<ApiResponse<Array<{
    id: number;
    name: string;
    description: string;
    cost: number;
    num_members: number;
    template: {
      max_number_of_members: number;
    };
    topic: {
      id: number;
      name: string;
    };
    medic: {
      id: number;
      name: string;
      title: string;
    };
    status: string;
  }>>> {
    // Build query string
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });

    const queryString = queryParams.toString();
    const url = `/group${queryString ? `?${queryString}` : ''}`;

    return this.makeRequest(url, {
      method: 'GET',
    });
  }

  async getGroupsByTopic(topicId: number): Promise<ApiResponse<Array<any>>> {
    return this.makeRequest(`/group/list_by_topic?topic=${topicId}`, {
      method: 'GET',
    });
  }

  async getFilterOptions(filters: {
    is_free?: boolean;
    medics?: number[];
    topics?: number[];
  }): Promise<ApiResponse<{
    medics: Array<{ label: string; value: number }>;
    topics: Array<{ label: string; value: number }>;
  }>> {
    return this.makeRequest('/group/get_filter_options', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  }

  async createRazorpayOrder(groupId: number, creditsToUse: number): Promise<ApiResponse<{
    order_id: string;
    amount: number;
    currency: string;
    receipt: string;
    payment_amount: number;
    credits_to_use: number;
  }>> {
    return this.makeRequest(`/group/${groupId}/create_order`, {
      method: 'POST',
      body: JSON.stringify({ credits_to_use: creditsToUse }),
    });
  }

  async verifyPaymentSignature(orderId: string, paymentId: string, signature: string): Promise<ApiResponse<{
    is_valid: boolean;
  }>> {
    return this.makeRequest('/group/verify_payment_signature', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        payment_id: paymentId,
        signature: signature,
      }),
    });
  }

  async joinGroup(groupId: number, joinData: {
    payment_id?: string;
    credits_used?: number;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest(`/group/${groupId}/join`, {
      method: 'POST',
      body: JSON.stringify(joinData),
    });
  }

  async getGroupCard(groupId: number): Promise<ApiResponse<any>> {
    return this.makeRequest(`/group/${groupId}/join_card`, {
      method: 'GET',
    });
  }

  // Group Details & Management methods  
  async getGroupDetails(groupId: number): Promise<ApiResponse<{
    name: string;
    description: string;
    expiry_on?: string;
    medic?: {
      id: number;
      name: string;
      title?: string;
      bio?: string;
      profile_picture?: string;
    };
    members?: Array<{
      name: string;
      role: 'Admin' | 'Member';
      profile_picture?: string;
      group_id: number;
      user_id: number;
    }>;
  }>> {
    return this.makeRequest(`/group/${groupId}/details`, {
      method: 'GET',
    });
  }

  async getGroupMembers(groupId: number): Promise<ApiResponse<Array<{
    id: number;
    user: {
      id: number;
      firebase_uid: string;
      user_profile: {
        id: number;
        name: string;
        profile_picture?: string;
      };
    };
    status: string;
    joined_at: string;
    is_admin: boolean;
  }>>> {
    return this.makeRequest(`/group/${groupId}/members`, {
      method: 'GET',
    });
  }

  async leaveGroup(groupId: number): Promise<ApiResponse<any>> {
    return this.makeRequest(`/group/${groupId}/leave`, {
      method: 'POST',
    });
  }

  async withdrawFromGroup(groupId: number): Promise<ApiResponse<any>> {
    return this.makeRequest(`/group/${groupId}/withdraw`, {
      method: 'POST',
    });
  }

  async removeMemberFromGroup(groupId: number, userId: number): Promise<ApiResponse<any>> {
    return this.makeRequest(`/group/${groupId}/remove_member`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async deleteGroup(groupId: number): Promise<ApiResponse<any>> {
    return this.makeRequest(`/group/${groupId}/delete`, {
      method: 'POST',
    });
  }

  async getDMGroupFirebaseUID(userId: number): Promise<ApiResponse<{ firebase_uid: string }>> {
    return this.makeRequest(`/group/dm_group_firebase_uid?user_id=${userId}`, {
      method: 'GET',
    });
  }

  // Credit System methods
  async getCreditDetails(): Promise<ApiResponse<{
    credit_balance: number;
    expiring_text: string;
    credit_transactions: Array<{
      title: string;
      description: string;
      amount_str: string;
      dt: string;
      type: string;
    }>;
  }>> {
    return this.makeRequest('/user/credits', {
      method: 'GET',
    });
  }

  async redeemCoupon(couponCode: string, isReferral: boolean = false): Promise<ApiResponse<{
    success: boolean;
    message: string;
    credits?: number;
  }>> {
    return this.makeRequest('/user/redeem_coupon', {
      method: 'POST',
      body: JSON.stringify({
        coupon_code: couponCode,
        is_referral: isReferral,
      }),
    });
  }

  // File Upload methods
  async getPresignedUploadUrl(uploadRequest: {
    file_name: string;
    file_size: number;
    file_type: string;
    group_id: string;
    width?: number;
    height?: number;
    duration?: number;
  }): Promise<ApiResponse<{
    attachment_id: string;
    presigned_url: string;
    public_url: string;
    expires_at: string;
    s3_key: string;
    attachment_type: 'image' | 'audio' | 'video';
    file_name: string;
    file_size: number;
    file_type: string;
  }>> {
    return this.makeRequest('/chat/attachment/upload', {
      method: 'POST',
      body: JSON.stringify(uploadRequest),
    });
  }

  async markAttachmentUploaded(attachmentId: string, messageId?: string): Promise<ApiResponse<any>> {
    return this.makeRequest('/chat/attachment/mark-uploaded', {
      method: 'POST',
      body: JSON.stringify({
        attachment_id: attachmentId,
        message_id: messageId
      }),
    });
  }

  // Enhanced API methods with built-in retry and error handling
  async getRecommendedGroupsWithRetry(maxRetries: number = 3): Promise<ApiResponse<RecommendedGroup[]>> {
    return this.makeRequest<RecommendedGroup[]>('/group/recommended', {
      method: 'GET',
    }, { maxRetries, retryDelay: 1000 });
  }

  async joinGroupWithRetry(
    groupId: number, 
    joinData: { payment_id?: string; credits_used?: number; },
    maxRetries: number = 2
  ): Promise<ApiResponse<any>> {
    return this.makeRequest(`/group/${groupId}/join`, {
      method: 'POST',
      body: JSON.stringify(joinData),
    }, { maxRetries, retryDelay: 2000 });
  }

  async getCreditDetailsWithRetry(maxRetries: number = 3): Promise<ApiResponse<any>> {
    return this.makeRequest('/user/credits', {
      method: 'GET',
    }, { maxRetries, retryDelay: 1000 });
  }

  async searchGroupsWithRetry(
    query: { search?: string; sort?: string; filters?: any },
    maxRetries: number = 2
  ): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (query.search) searchParams.append('search', query.search);
    if (query.sort) searchParams.append('sort', query.sort);
    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        if (value) searchParams.append(key, String(value));
      });
    }

    return this.makeRequest(`/group?${searchParams.toString()}`, {
      method: 'GET',
    }, { maxRetries, retryDelay: 1000 });
  }

  // Utility method to handle common error patterns
  async withErrorHandling<T>(
    operation: () => Promise<ApiResponse<T>>,
    errorOptions: {
      showUserError?: boolean;
      customErrorMessage?: string;
      onError?: (error: AppError) => void;
    } = {}
  ): Promise<ApiResponse<T>> {
    const result = await operation();
    
    if (!result.success && result.appError) {
      if (errorOptions.onError) {
        errorOptions.onError(result.appError);
      }
      
      if (errorOptions.showUserError) {
        errorService.handleError(result.appError, {
          showAlert: true,
          customMessage: errorOptions.customErrorMessage,
        });
      }
    }
    
    return result;
  }

  // Track user activity for message sending (for streak calculation)
  async trackMessageActivity(): Promise<ApiResponse<any>> {
    return this.makeRequest('/user/track_activity', {
      method: 'POST',
    });
  }

  // =============================================================================
  // SUBSCRIPTION EXTENSION METHODS
  // =============================================================================

  /**
   * Get membership status for a group
   */
  async getMembershipStatus(groupFirebaseUid: string): Promise<ApiResponse<{
    has_membership: boolean;
    status?: string;
    expiry_on?: string;
    days_until_expiry?: number;
    in_grace_period?: boolean;
    can_extend?: boolean;
    extension_options?: Array<{
      months: number;
      price: number;
      label: string;
    }>;
    group_name: string;
    group_cost: number;
    is_one_on_one: boolean;
    rating_status?: {
      has_rated: boolean;
      rating?: number;
      feedback?: string;
      submitted_at?: string;
    };
    soul_profile_shared?: boolean;
    medic?: {
      id: number;
      name: string;
      bio?: string;
      title?: string;
      designation?: string;
    };
  }>> {
    return this.makeRequest(`/subscription/status/${groupFirebaseUid}`, {
      method: 'GET',
    });
  }

  /**
   * Create a Razorpay order for subscription extension
   * Returns skip_payment=true if fully covered by credits
   */
  async createExtensionOrder(groupFirebaseUid: string, months: 1 | 3, creditsUsed: number = 0): Promise<ApiResponse<{
    skip_payment: boolean;
    order_id?: string;
    total_amount: number;
    credits_used: number;
    payment_amount: number;
    currency?: string;
    months: number;
    group_name: string;
    current_expiry?: string;
  }>> {
    return this.makeRequest('/subscription/create-extension-order', {
      method: 'POST',
      body: JSON.stringify({
        group_id: groupFirebaseUid,
        months: months,
        credits_used: creditsUsed,
      }),
    });
  }

  /**
   * Extend subscription after successful payment or credits-only
   * payment_id is optional if fully paid with credits
   */
  async extendSubscription(params: {
    groupFirebaseUid: string;
    months: 1 | 3;
    paymentId?: string;
    orderId?: string;
    signature?: string;
    creditsUsed?: number;
  }): Promise<ApiResponse<{
    success: boolean;
    new_expiry: string;
    months_extended: number;
    was_reactivated: boolean;
    credits_used: number;
    payment_amount: number;
    group_name: string;
  }>> {
    return this.makeRequest('/subscription/extend', {
      method: 'POST',
      body: JSON.stringify({
        group_id: params.groupFirebaseUid,
        months: params.months,
        payment_id: params.paymentId,
        order_id: params.orderId,
        signature: params.signature,
        credits_used: params.creditsUsed || 0,
      }),
    });
  }

  /**
   * Submit a rating for a therapist in a 1:1 chat
   */
  async submitTherapistRating(params: {
    groupFirebaseUid: string;
    rating: number;
    feedback?: string;
  }): Promise<ApiResponse<{
    success: boolean;
    rating: number;
    feedback?: string;
    submitted_at: string;
  }>> {
    return this.makeRequest('/subscription/rate-therapist', {
      method: 'POST',
      body: JSON.stringify({
        group_id: params.groupFirebaseUid,
        rating: params.rating,
        feedback: params.feedback || '',
      }),
    });
  }

  /**
   * Request to share previous medic chat summary with new therapist
   */
  async sharePreviousSummary(groupFirebaseUid: string): Promise<ApiResponse<{
    success: boolean;
    previous_groups_count: number;
    message: string;
  }>> {
    return this.makeRequest('/subscription/share-previous-summary', {
      method: 'POST',
      body: JSON.stringify({
        group_id: groupFirebaseUid,
      }),
    });
  }

  /**
   * Share soul profile with medic in a 1:1 chat
   */
  async shareSoulProfile(groupFirebaseUid: string): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.makeRequest('/subscription/share-soul-profile', {
      method: 'POST',
      body: JSON.stringify({
        group_id: groupFirebaseUid,
      }),
    });
  }
}

// Create and export singleton instance
const apiService = new ApiService();
export default apiService;

// Export utility functions for easier migration from backend.ts
export const setupAuthStateListener = (handlers: AuthStateChangeHandler) => {
  return apiService.setupAuthStateListener(handlers);
};

export const isSignupComplete = (userData: any): boolean => {
  return apiService.isSignupComplete(userData);
};