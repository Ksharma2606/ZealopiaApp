import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, View } from 'react-native';
import { AppleAuthenticationButton, AppleAuthenticationButtonStyle, AppleAuthenticationButtonType } from 'expo-apple-authentication';
import { signInWithApple, isAppleSignInAvailable } from '@/lib/firebase/auth/apple';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AppleSignInButtonProps {
  onSuccess?: (user: FirebaseAuthTypes.UserCredential) => void;
  onError?: (error: Error) => void;
  style?: any;
}

export default function AppleSignInButton({ onSuccess, onError, style }: AppleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    // Check if Apple Sign In is available
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    const available = await isAppleSignInAvailable();
    setIsAvailable(available);
  };

  // If Apple Sign In is not available on this device, don't render the button
  if (!isAvailable) {
    return null;
  }

  const handlePress = async () => {
    try {
      setIsLoading(true);
      const userCredential = await signInWithApple();
      
      if (onSuccess) {
        onSuccess(userCredential);
      }
    } catch (error) {
      console.error('Apple sign-in error:', error);
      // Display error alert
      Alert.alert(
        'Authentication Error',
        error instanceof Error ? error.message : 'Failed to sign in with Apple'
      );
      
      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Use native Apple button for better UX
  return (
    <AppleAuthenticationButton
      buttonType={AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={8}
      style={[styles.button, style]}
      onPress={handlePress}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 48,
  },
});