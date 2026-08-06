import React from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import apiService from '@/lib/services/ApiService';

// E.164: a leading '+', a non-zero first digit, then up to 14 more digits (15 digits max total).
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export const isValidE164PhoneNumber = (phoneNumber: string): boolean =>
  E164_REGEX.test(phoneNumber);

export interface PhoneAuthResult {
  success: boolean;
  verificationId?: string;
  error?: string;
  autoVerified?: boolean;
}

export interface OTPVerificationResult {
  success: boolean;
  user?: FirebaseAuthTypes.User;
  error?: string;
  needsBackendRegistration?: boolean;
}

export interface PhoneAuthState {
  verificationId: string | null;
  phoneNumber: string | null;
  isLoading: boolean;
  error: string | null;
  canResend: boolean;
}

class PhoneAuthService {
  private static instance: PhoneAuthService;
  private authState: PhoneAuthState = {
    verificationId: null,
    phoneNumber: null,
    isLoading: false,
    error: null,
    canResend: false,
  };

  private listeners: ((state: PhoneAuthState) => void)[] = [];

  private constructor() {}

  public static getInstance(): PhoneAuthService {
    if (!PhoneAuthService.instance) {
      PhoneAuthService.instance = new PhoneAuthService();
    }
    return PhoneAuthService.instance;
  }

  // Subscribe to auth state changes
  public subscribe(listener: (state: PhoneAuthState) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of state changes
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.authState }));
  }

  // Update auth state
  private updateState(updates: Partial<PhoneAuthState>): void {
    this.authState = { ...this.authState, ...updates };
    this.notifyListeners();
  }

  // Get current auth state
  public getState(): PhoneAuthState {
    return { ...this.authState };
  }

  // Send OTP to phone number
  public async sendOTP(phoneNumber: string): Promise<PhoneAuthResult> {
    try {
      // Validate phone number format (E.164 - works for any country's dial code)
      if (!isValidE164PhoneNumber(phoneNumber)) {
        return {
          success: false,
          error: 'Invalid phone number format. Please check the number and try again.',
        };
      }

      this.updateState({
        isLoading: true,
        error: null,
        phoneNumber,
      });

      console.log('Sending OTP to:', phoneNumber);

      // For web platform, use different approach
      if (Platform.OS === 'web') {
        const confirmationResult = await auth().signInWithPhoneNumber(phoneNumber);
        
        this.updateState({
          verificationId: confirmationResult.verificationId,
          isLoading: false,
          canResend: true,
        });

        return {
          success: true,
          verificationId: confirmationResult.verificationId ?? undefined,
        };
      }

      // For mobile platforms, use verifyPhoneNumber with callback pattern
      return new Promise<PhoneAuthResult>((resolve) => {
        auth()
          .verifyPhoneNumber(phoneNumber, 60)
          .on('state_changed', (phoneAuthSnapshot) => {
            console.log('Phone auth state changed:', phoneAuthSnapshot.state);

            switch (phoneAuthSnapshot.state) {
              case auth.PhoneAuthState.CODE_SENT:
                console.log('OTP sent, verification ID:', phoneAuthSnapshot.verificationId);

                this.updateState({
                  verificationId: phoneAuthSnapshot.verificationId,
                  isLoading: false,
                  canResend: true,
                });

                resolve({
                  success: true,
                  verificationId: phoneAuthSnapshot.verificationId,
                });
                break;

              case auth.PhoneAuthState.AUTO_VERIFY_TIMEOUT:
                console.log('Auto verify timeout');
                // This is normal, user needs to enter OTP manually
                break;

              case auth.PhoneAuthState.AUTO_VERIFIED:
                console.log('Auto verified, signing in...');

                // Create credential and sign in
                const credential = auth.PhoneAuthProvider.credential(
                  phoneAuthSnapshot.verificationId,
                  phoneAuthSnapshot.code ?? undefined
                );
                
                auth()
                  .signInWithCredential(credential)
                  .then(() => {
                    this.updateState({
                      isLoading: false,
                      error: null,
                    });

                    resolve({
                      success: true,
                      autoVerified: true,
                    });
                  })
                  .catch((signInError) => {
                    console.error('Auto sign-in error:', signInError);
                    
                    const errorMessage = this.getPhoneAuthErrorMessage(signInError);
                    this.updateState({
                      isLoading: false,
                      error: errorMessage,
                    });

                    resolve({
                      success: false,
                      error: errorMessage,
                    });
                  });
                break;

              case auth.PhoneAuthState.ERROR:
                console.error('Phone auth error:', phoneAuthSnapshot.error);
                
                const errorMessage = this.getPhoneAuthErrorMessage(phoneAuthSnapshot.error);
                this.updateState({
                  isLoading: false,
                  error: errorMessage,
                });

                resolve({
                  success: false,
                  error: errorMessage,
                });
                break;

              default:
                console.log('Unhandled phone auth state:', phoneAuthSnapshot.state);
                break;
            }
          }, (error) => {
            console.error('Phone auth listener error:', error);
            
            const errorMessage = this.getPhoneAuthErrorMessage(error);
            this.updateState({
              isLoading: false,
              error: errorMessage,
            });

            resolve({
              success: false,
              error: errorMessage,
            });
          });
      });
    } catch (error) {
      console.error('Send OTP error:', error);
      
      const errorMessage = this.getPhoneAuthErrorMessage(error);
      this.updateState({
        isLoading: false,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Verify OTP code
  public async verifyOTP(code: string): Promise<OTPVerificationResult> {
    try {
      if (!this.authState.verificationId) {
        return {
          success: false,
          error: 'No verification ID found. Please request OTP again.',
        };
      }

      this.updateState({
        isLoading: true,
        error: null,
      });

      console.log('Verifying OTP code:', code);

      // Create phone auth credential
      const credential = auth.PhoneAuthProvider.credential(
        this.authState.verificationId,
        code
      );

      // Sign in with credential
      const userCredential = await auth().signInWithCredential(credential);
      const user = userCredential.user;

      console.log('OTP verification successful, user:', user.uid);

      this.updateState({
        isLoading: false,
        error: null,
      });

      // Check if user needs backend registration
      const needsBackendRegistration = await this.checkIfUserNeedsBackendRegistration(user);

      return {
        success: true,
        user,
        needsBackendRegistration,
      };
    } catch (error) {
      console.error('OTP verification error:', error);
      
      const errorMessage = this.getOTPVerificationErrorMessage(error);
      this.updateState({
        isLoading: false,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Resend OTP - forces a fresh SMS to be sent for the same phone number
  public async resendOTP(): Promise<PhoneAuthResult> {
    if (!this.authState.phoneNumber) {
      return {
        success: false,
        error: 'No phone number found. Please start over.',
      };
    }

    try {
      this.updateState({
        isLoading: true,
        error: null,
      });

      console.log('Resending OTP to:', this.authState.phoneNumber);

      // For web platform, use different approach
      if (Platform.OS === 'web') {
        const confirmationResult = await auth().signInWithPhoneNumber(this.authState.phoneNumber);

        this.updateState({
          verificationId: confirmationResult.verificationId,
          isLoading: false,
          canResend: true,
        });

        return {
          success: true,
          verificationId: confirmationResult.verificationId ?? undefined,
        };
      }

      // For mobile platforms, use verifyPhoneNumber with forceResend so a fresh SMS is always sent
      return new Promise<PhoneAuthResult>((resolve) => {
        auth()
          .verifyPhoneNumber(this.authState.phoneNumber!, 60, true)
          .on('state_changed', (phoneAuthSnapshot) => {
            console.log('Phone auth state changed (resend):', phoneAuthSnapshot.state);

            switch (phoneAuthSnapshot.state) {
              case auth.PhoneAuthState.CODE_SENT:
                console.log('OTP resent, new verification ID:', phoneAuthSnapshot.verificationId);

                this.updateState({
                  verificationId: phoneAuthSnapshot.verificationId,
                  isLoading: false,
                  canResend: true,
                });

                resolve({
                  success: true,
                  verificationId: phoneAuthSnapshot.verificationId,
                });
                break;

              case auth.PhoneAuthState.AUTO_VERIFY_TIMEOUT:
                console.log('Auto verify timeout (resend)');
                // This is normal, user needs to enter OTP manually
                break;

              case auth.PhoneAuthState.AUTO_VERIFIED:
                console.log('Auto verified on resend, signing in...');
                
                // Create credential and sign in
                const credential = auth.PhoneAuthProvider.credential(
                  phoneAuthSnapshot.verificationId,
                  phoneAuthSnapshot.code ?? undefined
                );

                auth()
                  .signInWithCredential(credential)
                  .then(() => {
                    this.updateState({
                      isLoading: false,
                      error: null,
                    });

                    resolve({
                      success: true,
                      autoVerified: true,
                    });
                  })
                  .catch((signInError) => {
                    console.error('Auto sign-in error (resend):', signInError);
                    
                    const errorMessage = this.getPhoneAuthErrorMessage(signInError);
                    this.updateState({
                      isLoading: false,
                      error: errorMessage,
                    });

                    resolve({
                      success: false,
                      error: errorMessage,
                    });
                  });
                break;

              case auth.PhoneAuthState.ERROR:
                console.error('Phone auth error (resend):', phoneAuthSnapshot.error);
                
                const errorMessage = this.getPhoneAuthErrorMessage(phoneAuthSnapshot.error);
                this.updateState({
                  isLoading: false,
                  error: errorMessage,
                });

                resolve({
                  success: false,
                  error: errorMessage,
                });
                break;

              default:
                console.log('Unhandled phone auth state (resend):', phoneAuthSnapshot.state);
                break;
            }
          }, (error) => {
            console.error('Phone auth listener error (resend):', error);
            
            const errorMessage = this.getPhoneAuthErrorMessage(error);
            this.updateState({
              isLoading: false,
              error: errorMessage,
            });

            resolve({
              success: false,
              error: errorMessage,
            });
          });
      });
    } catch (error) {
      console.error('Resend OTP error:', error);
      
      const errorMessage = this.getPhoneAuthErrorMessage(error);
      this.updateState({
        isLoading: false,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Register with backend after successful Firebase auth
  public async registerWithBackend(user: FirebaseAuthTypes.User): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Registering user with backend:', user.uid);

      // Get Firebase ID token
      const idToken = await user.getIdToken();

      // Register with backend
      const response = await apiService.registerFirebaseToken(idToken);

      if (response.success) {
        console.log('Backend registration successful');
        return { success: true };
      } else {
        console.error('Backend registration failed:', response.error);
        return { 
          success: false, 
          error: response.error || 'Failed to register with backend' 
        };
      }
    } catch (error) {
      console.error('Backend registration error:', error);
      return { 
        success: false, 
        error: 'Network error during registration' 
      };
    }
  }

  // Check if user needs backend registration
  private async checkIfUserNeedsBackendRegistration(user: FirebaseAuthTypes.User): Promise<boolean> {
    try {
      // Get fresh Firebase token first
      const idToken = await user.getIdToken(true);
      
      // Try to get current user from backend with the token
      const response = await apiService.getCurrentUser();
      
      // If we get a successful response with user data, registration is not needed
      if (response.success && response.data) {
        console.log('User already exists in backend');
        return false;
      }
      
      // If we don't have user data or the request failed, registration is needed
      console.log('User not found in backend or request failed, needs registration');
      return true;
    } catch (error) {
      console.log('Error checking backend user, assuming registration needed:', error);
      return true;
    }
  }

  // Clear auth state
  public clearState(): void {
    this.authState = {
      verificationId: null,
      phoneNumber: null,
      isLoading: false,
      error: null,
      canResend: false,
    };
    this.notifyListeners();
  }

  // Get user-friendly error message for phone auth errors
  private getPhoneAuthErrorMessage(error: any): string {
    const code = error?.code || '';
    
    switch (code) {
      case 'auth/invalid-phone-number':
        return 'Invalid phone number format. Please check and try again.';
      case 'auth/too-many-requests':
        return 'Too many requests. Please try again later.';
      case 'auth/quota-exceeded':
        return 'SMS quota exceeded. Please try again later.';
      case 'auth/user-disabled':
        return 'This phone number has been disabled. Contact support.';
      case 'auth/operation-not-allowed':
        return 'Phone authentication is not enabled. Contact support.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/app-not-authorized':
        return __DEV__
          ? 'Configuration error: this app is not authorized for phone sign-in. Check that the debug SHA-1/SHA-256 fingerprints are registered in Firebase Console (Project Settings > Your apps > Android app), and that google-services.json is up to date.'
          : 'Phone sign-in is temporarily unavailable. Please try again later or contact support.';
      case 'auth/captcha-check-failed':
        return 'Captcha verification failed. Please try again.';
      default:
        if (error?.message) {
          return error.message;
        }
        return 'Failed to send OTP. Please try again.';
    }
  }

  // Get user-friendly error message for OTP verification errors
  private getOTPVerificationErrorMessage(error: any): string {
    const code = error?.code || '';
    
    switch (code) {
      case 'auth/invalid-verification-code':
        return 'Invalid OTP code. Please check and try again.';
      case 'auth/invalid-verification-id':
        return 'Invalid verification session. Please request a new OTP.';
      case 'auth/code-expired':
        return 'OTP code has expired. Please request a new one.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact support.';
      default:
        if (error?.message) {
          return error.message;
        }
        return 'Invalid OTP. Please try again.';
    }
  }
}

// Export singleton instance
export const phoneAuthService = PhoneAuthService.getInstance();

// Export convenience functions
export const sendOTP = (phoneNumber: string) => phoneAuthService.sendOTP(phoneNumber);
export const verifyOTP = (code: string) => phoneAuthService.verifyOTP(code);
export const resendOTP = () => phoneAuthService.resendOTP();
export const registerWithBackend = (user: FirebaseAuthTypes.User) => phoneAuthService.registerWithBackend(user);
export const usePhoneAuthState = () => {
  const [state, setState] = React.useState(phoneAuthService.getState());
  
  React.useEffect(() => {
    const unsubscribe = phoneAuthService.subscribe(setState);
    return unsubscribe;
  }, []);
  
  return state;
};