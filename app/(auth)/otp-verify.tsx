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
import { COUNTRY_CODES } from '@/constants/CountryCodes';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

const { width } = Dimensions.get('window');

type OtpErrorType = 'incorrect' | 'expired' | 'other';

// Presentation-only: splits "+919619589824" into "+91 9619589824" for display,
// using the same dial codes the country picker offers - never touches the raw value used for auth calls.
const formatPhoneForDisplay = (fullNumber: string): string => {
  const match = [...COUNTRY_CODES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => fullNumber.startsWith(c.dialCode));
  if (!match) return fullNumber;
  return `${match.dialCode} ${fullNumber.slice(match.dialCode.length)}`;
};

const formatTimer = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

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
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpErrorType, setOtpErrorType] = useState<OtpErrorType | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  // Ref for the (visually hidden) OTP input
  const otpInputRef = useRef<TextInput>(null);

  // Update loading state from phone auth service
  useEffect(() => {
    if (phoneAuthState.isLoading !== loading) {
      setLoading(phoneAuthState.isLoading);
    }
  }, [phoneAuthState.isLoading]);

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
      if (otpError) {
        setOtpError(null);
        setOtpErrorType(null);
      }
    }
  };

  // Handle OTP verification
  const handleVerifyOtp = async () => {
    if (loading) {
      return;
    }

    if (otp.length !== 6) {
      setOtpError('Please enter the complete 6-digit code.');
      setOtpErrorType('other');
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
            setOtpError(backendResult.error || 'Failed to complete registration. Please try again.');
            setOtpErrorType('other');
            return;
          }

          console.log('Backend registration successful');
        }

        // Navigation will be handled by AuthContext based on user state
        // The RouteGuard will determine if user needs profile setup or can go to main app
        console.log('Authentication complete, AuthContext will handle navigation');

      } else {
        const message = result.error || 'Invalid OTP. Please try again.';
        setOtpError(message);
        setOtpErrorType(message.toLowerCase().includes('expired') ? 'expired' : 'incorrect');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setOtpError('Failed to verify OTP. Please try again.');
      setOtpErrorType('other');
    }
  };

  // Handle resend OTP - matching Flutter Flow logic
  const handleResendOtp = async () => {
    if (resendLoading) {
      return;
    }

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
        setOtpError(null);
        setOtpErrorType(null);
        otpInputRef.current?.focus();

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

  // Handle editing the phone number - reuses the same clear+redirect pattern already
  // used above when this screen is reached without valid auth state
  const handleEditPhoneNumber = () => {
    phoneAuthService.clearState();
    router.replace('/(auth)/login');
  };

  // Handle pasting an OTP copied from an SMS - reuses the existing validated setter
  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      handleOtpChange(text);
    } catch (error) {
      console.error('Clipboard read error:', error);
    }
  };

  const showResendAction = isResendAllowed || !!otpError;
  const verifyDisabled = loading || otp.length !== 6;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -70}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>Enter the{'\n'}6-digit code</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.phoneRowText}>Sent to {formatPhoneForDisplay(phoneNumber)}</Text>
              <TouchableOpacity onPress={handleEditPhoneNumber} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.otpBoxRow}>
            {Array.from({ length: 6 }).map((_, index) => {
              const digit = otp[index];
              const isFilled = !!digit;
              const isNextCursor = !isFilled && index === otp.length && inputFocused && !otpError;
              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    isFilled && (otpErrorType === 'incorrect' ? styles.otpBoxFilledError : styles.otpBoxFilled),
                  ]}
                >
                  {isFilled ? (
                    <Text style={[styles.otpDigit, otpErrorType === 'incorrect' && styles.otpDigitError]}>
                      {digit}
                    </Text>
                  ) : isNextCursor ? (
                    <View style={styles.otpCursor} />
                  ) : null}
                </View>
              );
            })}
            <TextInput
              ref={otpInputRef}
              value={otp}
              onChangeText={handleOtpChange}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              keyboardType="numeric"
              maxLength={6}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
              style={styles.hiddenInput}
              caretHidden
            />
          </View>

          {otpError ? (
            <Text style={[styles.statusText, otpErrorType === 'expired' ? styles.statusTextExpired : styles.statusTextError]}>
              {otpErrorType === 'expired' ? otpError : `‼ ${otpError}`}
            </Text>
          ) : !isResendAllowed ? (
            <Text style={styles.statusText}>Resend code in {formatTimer(timer)}</Text>
          ) : null}

          {showResendAction ? (
            <TouchableOpacity style={styles.actionPill} onPress={handleResendOtp} disabled={resendLoading}>
              <Text style={styles.actionPillTextActive}>
                {resendLoading ? 'Sending...' : 'Resend code'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionPill} onPress={handlePasteFromClipboard}>
              <Text style={styles.actionPillText}>Paste from clipboard</Text>
            </TouchableOpacity>
          )}

          <View style={styles.spacer} />

          <TouchableOpacity
            style={styles.verifyButtonWrapper}
            onPress={handleVerifyOtp}
            disabled={verifyDisabled}
            activeOpacity={0.85}
          >
            {verifyDisabled ? (
              <View style={[styles.verifyButton, styles.verifyButtonDisabled]}>
                <Text style={styles.verifyButtonTextDisabled}>{loading ? 'Verifying...' : 'Verify'}</Text>
              </View>
            ) : (
              <LinearGradient
                colors={['#9B6DFF', '#ED4B94']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.verifyButton}
              >
                <Text style={styles.verifyButtonText}>Verify</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16112B',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 56,
    paddingBottom: 40,
  },
  headerBlock: {
    marginBottom: 28,
  },
  heading: {
    fontFamily: 'KoHo',
    fontWeight: '700',
    fontSize: width < 360 ? 34 : 40,
    lineHeight: width < 360 ? 38 : 44,
    color: '#F7F3EA',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  phoneRowText: {
    fontSize: 14,
    color: '#B9B2D4',
  },
  editText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EC4899',
  },
  otpBoxRow: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 12,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 58 / 67,
    marginHorizontal: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#9B6DFF',
    backgroundColor: '#211A3D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    backgroundColor: '#2C2350',
    borderColor: '#9B6DFF',
  },
  otpBoxFilledError: {
    backgroundColor: '#5A2C39',
    borderColor: '#FB6B5B',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: '#9B6DFF',
  },
  otpDigitError: {
    color: '#FB6B5B',
  },
  otpCursor: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: '#9B6DFF',
  },
  hiddenInput: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  statusText: {
    fontSize: 13,
    color: '#B9B2D4',
    marginBottom: 14,
    textAlign: 'center',
  },
  statusTextError: {
    color: '#FB6B5B',
    fontWeight: '600',
  },
  statusTextExpired: {
    color: '#FBBF24',
    fontWeight: '600',
  },
  actionPill: {
    alignSelf: 'center',
    width: '49%',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2350',
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  actionPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#756E96',
  },
  actionPillTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B9B2D4',
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  verifyButtonWrapper: {
    alignSelf: 'center',
    width: '52%',
  },
  verifyButton: {
    borderRadius: 31,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9B6DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  verifyButtonDisabled: {
    backgroundColor: '#211A3D',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    color: '#F7F3EA',
    fontSize: 16,
    fontWeight: '700',
  },
  verifyButtonTextDisabled: {
    color: '#756E96',
    fontSize: 16,
    fontWeight: '700',
  },
});
