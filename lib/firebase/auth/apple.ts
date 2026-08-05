import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import auth from '@react-native-firebase/auth';

/**
 * Signs in a user with Apple authentication
 * @returns A promise that resolves to the user credential
 */
export const signInWithApple = async () => {
  try {
    // Generate a nonce for security
    const nonce = Math.random().toString(36).substring(2, 10);
    
    // Hash the nonce using expo-crypto
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      nonce,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    // Start the Apple authentication flow with Expo
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
      nonce: hashedNonce,
    });

    // Ensure Apple returned an identityToken
    if (!credential.identityToken) {
      throw new Error('Apple Sign-In failed - no identity token returned');
    }

    // Create a Firebase credential from the response
    const { identityToken } = credential;
    const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);

    // Sign in the user with the credential
    const userCredential = await auth().signInWithCredential(appleCredential);

    // Handle user info if this is the first sign in
    if (credential.fullName && userCredential.additionalUserInfo?.isNewUser) {
      // Update the user profile with Apple-provided name
      const displayName = [credential.fullName.givenName, credential.fullName.familyName]
        .filter(Boolean)
        .join(' ');
      
      if (displayName) {
        await userCredential.user.updateProfile({ displayName });
      }
    }

    return userCredential;
  } catch (error: any) {
    if (error.code === 'ERR_CANCELED') {
      // User cancelled the sign-in flow
      throw new Error('Sign in cancelled');
    }
    console.error('Apple sign-in error:', error);
    throw error;
  }
};

/**
 * Signs out the current user
 */
export const signOut = async () => {
  try {
    await auth().signOut();
  } catch (error) {
    console.error('Sign-out error:', error);
    throw error;
  }
};

/**
 * Checks if Apple Sign In is available on the device
 * @returns Boolean indicating if Apple Sign In is supported
 */
export const isAppleSignInAvailable = async () => {
  return await AppleAuthentication.isAvailableAsync();
};