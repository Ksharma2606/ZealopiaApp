import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions, Text } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useAuth } from '@/lib/context/AuthContext';
import Colors from '@/constants/Colors';

// const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { firebaseUser, backendUser, loading, isSignupComplete } = useAuth();
  
  // Animation values
  const logoTranslateY = useSharedValue(0);
  const titleTranslateY = useSharedValue(0);
  const animationComplete = useSharedValue(false);
  
  // In dev mode, add a longer delay to view the splash screen
  // Dev mode: 3 seconds, Production: 500ms
  const navigationDelay = __DEV__ ? 500 : 500;

  // Handle case where user navigates back to splash screen
  useFocusEffect(
    React.useCallback(() => {
      // If auth loading is complete and there's no user, redirect immediately to login
      if (!loading && !firebaseUser) {
        console.log('SplashScreen - Focus detected without user, redirecting to login immediately');
        router.replace('/(auth)/login');
        return;
      }
    }, [loading, firebaseUser, router])
  );

  // Start animations after component mounts
  useEffect(() => {
    const startAnimations = async () => {
      // Wait a bit for everything to load
      setTimeout(() => {
        // Logo animation - move down then up (matching Flutter implementation)
        logoTranslateY.value = withSequence(
          withTiming(10, { duration: 500 }),
          withTiming(-10, { duration: 500 })
        );

        // Title animation - move up then down (opposite of logo)
        titleTranslateY.value = withSequence(
          withTiming(-10, { duration: 500 }),
          withTiming(10, { duration: 500 }, () => {
            animationComplete.value = true;
            runOnJS(handleAnimationComplete)();
          })
        );
      }, 100);
    };

    startAnimations();
  }, []);

  // Handle navigation after animations complete
  const handleAnimationComplete = () => {
    setTimeout(() => {
      if (!loading) {
        navigateToNextScreen();
      }
    }, navigationDelay); // Use configurable delay (longer in dev mode)
  };

  // Navigation logic - only navigate to login if no user after loading is complete
  const navigateToNextScreen = () => {
    if (!loading && !firebaseUser) {
      // No user after loading complete, go to login
      console.log('SplashScreen - No user found, navigating to login');
      router.replace('/(auth)/login');
    }
    // Let RouteGuard handle other navigation scenarios
  };

  // Watch for auth state changes and navigate when ready
  useEffect(() => {
    if (!loading && animationComplete.value) {
      navigateToNextScreen();
    }
  }, [loading, firebaseUser]);

  // Animated styles
  const logoAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: logoTranslateY.value }],
    };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: titleTranslateY.value }],
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        
        <Animated.View style={[styles.titleContainer, titleAnimatedStyle]}>
          <Text style={styles.logoText}>ZEALOPIA</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.splashScreen, // Matching Flutter splash1 color
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 194,
    height: 196,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    width: 200,
    height: 60,
  },
  logoText: {
    fontFamily: 'KoHo',
    fontWeight: '600',
    color: Colors.white,
    fontSize: 58,
    letterSpacing: 2
  }
});