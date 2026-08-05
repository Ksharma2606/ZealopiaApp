import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BaseText as Text } from '@/components/ui/Base';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { verifyOTP, resendOTP, registerWithBackend, usePhoneAuthState, phoneAuthService } from '@/lib/firebase/auth';
import Cloud from '@/components/svgs/Cloud';
import LogoHeader from '@/components/LogoHeader';
import Colors from '@/constants/Colors';

const { width, height } = Dimensions.get('window');

export default function OTPVerifyScreen() {
  const router = useRouter();
  const { phoneNumber: routePhoneNumber, verificationId: routeVerificationId } = useLocalSearchParams<{ 
    phoneNumber?: string; 
    verificationId?: string; 
  }>();
  
  // Use phone auth state from the service
  const phoneAuthState = usePhoneAuthState();
  
  // Get phone number from either route params or auth service
  const phoneNumber = routePhoneNumber || phoneAuthState.phoneNumber || '';
  const verificationId = routeVerificationId || phoneAuthState.verificationId || '';

  // Check if we have valid auth state when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      // If we don't have phone number or verification ID, user may have navigated incorrectly
      if (!phoneNumber || !verificationId) {
        console.log('OTPVerifyScreen - Missing auth data, redirecting to login:', {
          phoneNumber: !!phoneNumber,
          verificationId: !!verificationId
        });
        // Clear any partial auth state and redirect to login
        phoneAuthService.clearState();
        router.replace('/(auth)/login');
        return;
      }
    }, [phoneNumber, verificationId, router])
  );

  // Debug logging
  console.log('OTP Screen - Route params:', { routePhoneNumber, routeVerificationId });
  console.log('OTP Screen - Auth state:', { 
    phoneNumber: phoneAuthState.phoneNumber, 
    verificationId: phoneAuthState.verificationId 
  });
  console.log('OTP Screen - Using:', { phoneNumber, verificationId });
  console.log('OTP Screen - Full auth state:', phoneAuthState);
  
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [isResendAllowed, setIsResendAllowed] = useState(false);
  const [numResends, setNumResends] = useState(0);

  // Ref for single OTP input
  const otpInputRef = useRef<TextInput>(null);
  
  // Update loading state from phone auth service
  useEffect(() => {
    if (phoneAuthState.isLoading !== loading) {
      setLoading(phoneAuthState.isLoading);
    }
  }, [phoneAuthState.isLoading]);
  
  // Show errors from phone auth service
  useEffect(() => {
    if (phoneAuthState.error) {
      Alert.alert('Error', phoneAuthState.error);
    }
  }, [phoneAuthState.error]);

  // Timer countdown effect - start immediately on page load
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0 && !isResendAllowed) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            // Timer ended, allow resend
            setIsResendAllowed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer, isResendAllowed]);

  // Handle OTP input change
  const handleOtpChange = (value: string) => {
    // Only allow numbers and limit to 6 digits (matching design)
    const numbersOnly = value.replace(/[^0-9]/g, '');
    if (numbersOnly.length <= 6) {
      setOtp(numbersOnly);
    }
  };

  // Handle OTP verification
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a complete 6-digit OTP');
      return;
    }

    try {
      console.log('Verifying OTP:', otp);
      
      // Verify OTP using Firebase phone auth
      const result = await verifyOTP(otp);
      
      if (result.success && result.user) {
        console.log('OTP verification successful for user:', result.user.uid);
        
        // Register with backend if needed
        if (result.needsBackendRegistration) {
          console.log('Registering user with backend...');
          
          const backendResult = await registerWithBackend(result.user);
          
          if (!backendResult.success) {
            Alert.alert('Registration Failed', backendResult.error || 'Failed to complete registration. Please try again.');
            return;
          }
          
          console.log('Backend registration successful');
        }
        
        // Navigation will be handled by AuthContext based on user state
        // The RouteGuard will determine if user needs profile setup or can go to main app
        console.log('Authentication complete, AuthContext will handle navigation');
        
      } else {
        Alert.alert('Verification Failed', result.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      Alert.alert('Verification Failed', 'Failed to verify OTP. Please try again.');
    }
  };

  // Handle resend OTP - matching Flutter Flow logic
  const handleResendOtp = async () => {
    setResendLoading(true);
    try {
      console.log('Resending OTP to:', phoneNumber);
      
      // Resend OTP using Firebase phone auth (same as initial send)
      const result = await resendOTP();
      
      if (result.success) {
        // Increment resend count
        setNumResends(prev => prev + 1);
        
        // Reset timer and UI state
        setTimer(30);
        setIsResendAllowed(false);
        setOtp('');
        otpInputRef.current?.focus();
        
        Alert.alert('OTP Sent', 'A new OTP has been sent to your phone number');
        console.log('OTP resent successfully, resend count:', numResends + 1);
      } else {
        Alert.alert('Failed to Resend OTP', result.error || 'Please try again.');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      Alert.alert('Error', 'Failed to resend OTP. Please check your connection and try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -70}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={[styles.content, { paddingTop: Platform.OS === 'ios' ? 60 : 0 }]}>
          <LogoHeader />

          {/* Cloud decoration at top */}
          <View style={styles.cloudTop}>
            <Cloud />
          </View>

          {/* Main content */}
          <View style={styles.mainContent}>
            <Text style={styles.subtitle}>
              We have sent a 6-digit OTP to{'\n'}your mobile number
            </Text>
            <Text style={styles.phoneText}>{phoneNumber}</Text>

            {/* OTP Input */}
            <View style={styles.otpInputContainer}>
              <TextInput
                ref={otpInputRef}
                style={styles.otpInput}
                value={otp}
                onChangeText={handleOtpChange}
                placeholder="Enter OTP"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={6}
                textAlign="center"
              />
            </View>

            {/* Timer and Resend */}
            <View style={styles.timerContainer}>
              {!isResendAllowed ? (
                <Text style={styles.timerText}>
                  Resend OTP in {timer} seconds
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOtp} disabled={resendLoading}>
                  <Text style={styles.resendText}>
                    {resendLoading ? 'Sending...' : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Log In Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                otp.length !== 6 && styles.loginButtonDisabled
              ]}
              onPress={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Verifying...' : 'Log In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cloud decorations at bottom */}
          <View style={styles.cloudBottomRight}>
            <Cloud />
          </View>
          <View style={styles.cloudBottomLeft}>
            <Cloud />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F163D',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    position: 'relative',
    minHeight: height,
    paddingVertical: 40,
  },
  cloudTop: {
    position: 'absolute',
    top: 128,
    alignSelf: 'center',
    opacity: 0.9,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 160,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 26,
  },
  phoneText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 40,
  },
  otpInputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  otpInput: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 18,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  timerText: {
    fontSize: 16,
    color: 'white',
  },
  resendText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  loginButton: {
    backgroundColor: '#DD7896',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  loginButtonDisabled: {
    backgroundColor: '#E0C5D5',
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cloudBottomRight: {
    position: 'absolute',
    bottom: 120,
    right: -50,
    opacity: 0.8,
  },
  cloudBottomLeft: {
    position: 'absolute',
    bottom: 20,
    left: -80,
    opacity: 0.7,
    transform: [{ scale: 0.8 }],
  },
});
