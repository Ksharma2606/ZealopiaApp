import React, { useState, useEffect } from 'react';
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
  Image,
  Linking,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { BaseText as Text } from '@/components/ui/Base';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle, sendOTP, phoneAuthService, signInWithApple, isAppleSignInAvailable } from '@/lib/firebase/auth';
import CountryCodeModal from '@/components/modals/CountryCodeModal';
import { CountryDialCode, getFlagEmoji } from '@/constants/CountryCodes';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  withDelay,
} from 'react-native-reanimated';
import { StyleSheet as RNStyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

// Local subscriber number length varies by country, so we accept a broad range
// rather than a fixed digit count (the old hardcoded 10-digit India-only check).
const MIN_PHONE_LENGTH = 4;
const MAX_PHONE_LENGTH = 12;

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryDialCode>({
    name: 'India',
    iso2: 'IN',
    dialCode: '+91',
  });
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);
  
  // Animation values
  const logoTranslateY = useSharedValue(100);
  const titleTranslateY = useSharedValue(100);
  const animationProgress = useSharedValue(0);
  const splashOpacity = useSharedValue(0); // Start invisible
  const [animationComplete, setAnimationComplete] = useState(false);

  // Clear phone auth state when screen focuses (only if we don't have active auth flow)
  useFocusEffect(
    React.useCallback(() => {
      const currentState = phoneAuthService.getState();
      // Only clear if we don't have an active verification session
      if (!currentState.verificationId) {
        console.log('LoginScreen - Clearing phone auth state on focus');
        phoneAuthService.clearState();
      } else {
        console.log('LoginScreen - Active verification session detected, not clearing state');
      }
    }, [])
  );

  // Check real device/runtime support for Sign in with Apple (Platform.OS === 'ios'
  // alone isn't enough - e.g. it's unavailable on iOS versions before 13)
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    isAppleSignInAvailable().then(setAppleSignInAvailable);
  }, []);

  // Start animations when component mounts
  useEffect(() => {
    // Start with splash screen animations
    setTimeout(() => {
      // Fade in the logo and title first
      splashOpacity.value = withTiming(1, { duration: 300 });
      
      // Logo animation - move down then up (matching Flutter implementation)
      logoTranslateY.value = withSequence(
        withTiming(120, { duration: 500 }),
        withTiming(80, { duration: 500 })
      );

      // Title animation - move up then down (opposite of logo)
      titleTranslateY.value = withSequence(
        withTiming(90, { duration: 500 }),
        withTiming(110, { duration: 500 })
      );

      // After splash animation, start transition to login screen
      setTimeout(() => {
        // Animate progress from 0 to 1 for smooth transitions
        animationProgress.value = withTiming(1, { duration: 1000 }, () => {
          runOnJS(setAnimationComplete)(true);
        });

        // Move logo and title up to their final positions
        logoTranslateY.value = withTiming(0, { duration: 1000 });
        titleTranslateY.value = withTiming(0, { duration: 1000 });
      }, 1200);
    }, 300);
  }, []);

  // Handle phone number input - only allow numbers, limited by the selected country's max length
  const handlePhoneChange = (text: string) => {
    const numbersOnly = text.replace(/[^0-9]/g, '');
    if (numbersOnly.length <= MAX_PHONE_LENGTH) {
      setPhoneNumber(numbersOnly);
    }
  };

  // Handle phone number submission
  const handlePhoneSubmit = async () => {
    if (phoneNumber.length < MIN_PHONE_LENGTH) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number');
      return;
    }

    const fullPhoneNumber = `${selectedCountry.dialCode}${phoneNumber}`;
    setLoading(true);
    
    try {
      console.log('Sending OTP to:', fullPhoneNumber);
      
      // Send OTP using Firebase phone auth
      const result = await sendOTP(fullPhoneNumber);
      
      if (result.success) {
        if (result.autoVerified) {
          // Auto-verification successful, user is already signed in
          // Navigation will be handled by AuthContext
          console.log('Auto-verification successful');
        } else {
          // OTP sent successfully, navigate to OTP verification screen
          console.log('OTP sent successfully, navigating to verification screen');
          console.log('Navigation params:', { 
            phoneNumber: fullPhoneNumber,
            verificationId: result.verificationId || ''
          });
          
          // Navigate to OTP verification screen with parameters as backup
          router.replace({
            pathname: '/otp-verify',
            params: { 
              phoneNumber: fullPhoneNumber,
              verificationId: result.verificationId || ''
            }
          });
        }
      } else {
        // Show user-friendly error message
        Alert.alert('Failed to Send OTP', result.error || 'Please check your phone number and try again.');
      }
    } catch (error) {
      console.error('Phone auth error:', error);
      Alert.alert('Error', 'Failed to send OTP. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Navigation will be handled by AuthContext
    } catch (error) {
      console.error('Google sign-in error:', error);
      // Alert.alert('Google Sign-In Failed', 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Handle Apple Sign In
  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      await signInWithApple();
      // Navigation will be handled by AuthContext
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      if (error.message !== 'Sign in cancelled') {
        Alert.alert('Apple Sign-In Failed', 'Please try again.');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handlePrivacyPolicy = async () => {
    try {
      await Linking.openURL('https://www.zealopia.com/privacy');
    } catch (error) {
      Alert.alert('Error', 'Could not open Privacy Policy');
    }
  };

  const handleTOS = async () => {
    try {
      await Linking.openURL('https://www.zealopia.com/terms');
    } catch (error) {
      Alert.alert('Error', 'Could not open Terms of Service');
    }
  };

  // Title animation style
  const titleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: titleTranslateY.value }],
      opacity: splashOpacity.value,
    };
  });

  // Background color animation (from splash orange to login purple)
  const containerAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    
    // For smooth color transition, we'll need to handle this differently
    // Since color interpolation is complex, we'll use opacity transition
    return {
      backgroundColor: '#1F163D',
    };
  });

  // Logo image style - starts invisible and fades in
  const logoImageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: logoTranslateY.value }],
      opacity: splashOpacity.value,
    };
  });

  // Form section animation (fade in and slide up)
  const formAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      animationProgress.value,
      [0, 0.7, 1],
      [50, 50, 0],
      Extrapolation.CLAMP
    );
    
    const opacity = interpolate(
      animationProgress.value,
      [0, 0.7, 1],
      [0, 0, 1],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      <Image
        source={require('@/assets/login-1.1/May 22, 2026, 03_22_20 AM 1.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -70}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          <View style={styles.content}>
            {/* Logo Section - Initially centered, then moves to top */}
            <View style={styles.logoSection}>
              {/* Wordmark - visible from the start */}
              <Animated.Image
                source={require('@/assets/login-1.1/ChatGPT Image May 22, 2026, 11_05_03 AM 1.png')}
                style={[styles.wordmarkImage, titleAnimatedStyle]}
                resizeMode="contain"
              />

              <Animated.Text style={[styles.tagline, logoImageAnimatedStyle]}>
                for your mind, your heart, and your weird little soul
              </Animated.Text>
            </View>

            {/* Login Form Section - Only show after animation */}
            <Animated.View style={[styles.formSection, formAnimatedStyle]}>

            {/* Phone Input */}
            <View
              style={[styles.phonePill, phoneNumber.length < MIN_PHONE_LENGTH && styles.phonePillDisabled]}
            >
              <TouchableOpacity
                style={styles.countryBadge}
                onPress={() => setCountryModalVisible(true)}
                disabled={loading}
              >
                <Text style={styles.countryBadgeText}>
                  {getFlagEmoji(selectedCountry.iso2)} {selectedCountry.dialCode}
                </Text>
                <Ionicons name="chevron-down" size={12} color="#fff" style={styles.countryBadgeChevron} />
              </TouchableOpacity>
              <TextInput
                style={styles.phonePillInput}
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder="Continue with Phone"
                placeholderTextColor="rgba(255,255,255,0.85)"
                keyboardType="numeric"
                maxLength={MAX_PHONE_LENGTH}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.phonePillArrow}
                onPress={handlePhoneSubmit}
                disabled={loading || phoneNumber.length < MIN_PHONE_LENGTH}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="chevron-forward" size={22} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            <CountryCodeModal
              visible={countryModalVisible}
              onClose={() => setCountryModalVisible(false)}
              selectedDialCode={selectedCountry.dialCode}
              onSelectCountry={setSelectedCountry}
            />

            {/* Social Login Buttons */}
            <View style={styles.socialButtonsContainer}>
              {/* Google Sign In */}
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
              >
                <Image
                  source={require('@/assets/images/google.png')}
                  style={styles.socialIcon}
                />
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Apple Sign In - Only show on iOS */}
              {Platform.OS === 'ios' && appleSignInAvailable && (
                <TouchableOpacity
                  style={[styles.appleButton, appleLoading && styles.appleButtonLoading]}
                  onPress={handleAppleSignIn}
                  disabled={appleLoading}
                  activeOpacity={0.7}
                >
                  <Image
                    source={require('@/assets/login-1.1/Apple Login.png')}
                    style={styles.appleButtonImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}
            </View>
            </Animated.View>

            {/* Terms and Privacy - Also animated */}
            <Animated.View style={[styles.termsContainer, formAnimatedStyle]}>
              <Text style={styles.termsText}>
                By logging in, you agree to our{' '}
                <Text onPress={handleTOS} style={styles.linkText}>terms of service</Text>
                {' '}and{' '}
                <Text onPress={handlePrivacyPolicy} style={styles.linkText}>privacy policy</Text>
              </Text>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12052B',
  },
  backgroundImage: {
    ...RNStyleSheet.absoluteFillObject,
  },
  scrollContent: {
    flex: 1,
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: width * 0.118,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 22,
    // Center vertically initially, animation will move it up
    marginTop: height * 0.09,
  },
  wordmarkImage: {
    alignSelf: 'center',
    width: width * 0.72,
    aspectRatio: 440 / 293,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    fontFamily: 'KoHo',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  formSection: {
    marginBottom: 22,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2350',
    borderRadius: 31,
    paddingLeft: 8,
    paddingRight: 18,
    minHeight: 62,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  phonePillDisabled: {
    opacity: 0.8,
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 10, 40, 0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  countryBadgeChevron: {
    marginLeft: 4,
  },
  countryBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  phonePillInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  phonePillArrow: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  socialButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(17, 7, 49, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  appleButton: {
    width: '100%',
  },
  appleButtonLoading: {
    opacity: 0.7,
  },
  appleButtonImage: {
    width: '100%',
    aspectRatio: 337 / 49,
  },
  socialIcon: {
    width: 19,
    height: 19,
    resizeMode: 'contain',
  },
  socialButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  termsContainer: {
    paddingHorizontal: 20,
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#C7B8FF',
    fontWeight: '600',
    lineHeight: 18,
  },
});
