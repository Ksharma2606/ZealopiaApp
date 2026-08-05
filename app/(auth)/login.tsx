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
} from 'react-native';
import { BaseText as Text } from '@/components/ui/Base';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle, sendOTP, phoneAuthService, signInWithApple } from '@/lib/firebase/auth';
import Colors from '@/constants/Colors';
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

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  
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

  // Handle phone number input - only allow numbers and limit to 10 digits
  const handlePhoneChange = (text: string) => {
    const numbersOnly = text.replace(/[^0-9]/g, '');
    if (numbersOnly.length <= 10) {
      setPhoneNumber(numbersOnly);
    }
  };

  // Handle phone number submission
  const handlePhoneSubmit = async () => {
    if (phoneNumber.length !== 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit phone number');
      return;
    }

    const fullPhoneNumber = `+91${phoneNumber}`;
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
      backgroundColor: Colors.splashScreen,
    };
  });

  // Overlay for background color transition
  const overlayAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      animationProgress.value,
      [0, 0.3, 1],
      [0, 0, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      backgroundColor: Colors.headerFooter,
    };
  });

  // Logo container animation (circle appearance)
  const logoContainerAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      animationProgress.value,
      [0, 0.5, 1],
      [0, 0, 1],
      Extrapolation.CLAMP
    );
    
    const opacity = interpolate(
      animationProgress.value,
      [0, 0.5, 1],
      [0, 0, 1],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
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
      {/* Background color overlay for smooth transition */}
      <Animated.View 
        style={[RNStyleSheet.absoluteFillObject, overlayAnimatedStyle]} 
        pointerEvents="none"
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
              {/* Logo container with both circle and image */}
              <View style={styles.logoWrapper}>
                {/* White circle background - appears during transition */}
                <Animated.View style={[styles.logoContainer, logoContainerAnimatedStyle]} />
                
                {/* Logo image - visible from the start */}
                <Animated.Image 
                  source={require('@/assets/images/logo.png')} 
                  style={[styles.logo, logoImageAnimatedStyle]} 
                />
              </View>
              
              <Animated.Text style={[styles.appName, titleAnimatedStyle]}>ZEALOPIA</Animated.Text>
            </View>

            {/* Login Form Section - Only show after animation */}
            <Animated.View style={[styles.formSection, formAnimatedStyle]}>
            <Text style={styles.loginTitle}>Log In Now</Text>

            {/* Phone Input */}
            <View style={styles.phoneInputContainer}>
              <View style={styles.phoneIcon}>
                <Ionicons name="phone-portrait-outline" size={20} color="#666" />
              </View>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder="Mobile Number"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            {/* OTP Button */}
            <TouchableOpacity
              style={[styles.otpButton, phoneNumber.length !== 10 && styles.otpButtonDisabled]}
              onPress={handlePhoneSubmit}
              disabled={loading || phoneNumber.length !== 10}
            >
              <Text style={styles.otpButtonText}>
                {loading ? 'Sending OTP...' : 'Log In using OTP'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

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
              </TouchableOpacity>

              {/* Apple Sign In - Only show on iOS */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.socialButton, styles.appleSocialButton]}
                  onPress={handleAppleSignIn}
                  disabled={appleLoading}
                >
                  <Ionicons name="logo-apple" size={24} color="#fff" />
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
    backgroundColor: Colors.splashScreen, // Start with splash screen color
  },
  scrollContent: {
    flex: 1,
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 10,
    // Center vertically initially, animation will move it up
    marginTop: height * 0.05,
  },
  logoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoContainer: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 194,
    height: 196,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: width < 360 ? 52 : 58,
    color: 'white',
    letterSpacing: 2,
    fontFamily: 'KoHo'
  },
  formSection: {
    marginBottom: 40,
  },
  loginTitle: {
    fontSize: 20,
    color: 'white',
    textAlign: 'center',
    marginBottom: 30,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  phoneIcon: {
    marginRight: 10,
  },
  countryCode: {
    fontSize: 16,
    color: '#333',
    marginRight: 10,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  otpButton: {
    backgroundColor: Colors.myChat, // Pink color matching the image
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  otpButtonDisabled: {
    backgroundColor: Colors.myChat,
    opacity: 0.9,
  },
  otpButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  orText: {
    color: 'white',
    fontSize: 14,
    marginHorizontal: 15,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  appleSocialButton: {
    backgroundColor: '#000',
  },
  socialIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  termsContainer: {
    paddingHorizontal: 20,
  },
  termsText: {
    fontSize: 12,
    color: 'white',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: 'white',
    fontWeight: '600',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
});