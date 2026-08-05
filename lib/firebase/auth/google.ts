import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { auth } from '../index';

// Initialize GoogleSignin with your web client ID
GoogleSignin.configure({
  webClientId: '782181631788-99o999vqnleoggst0nc4kif9but06b0v.apps.googleusercontent.com',
  forceCodeForRefreshToken: true, // Forces account selection dialog
});

/**
 * Signs in a user with Google authentication
 * @returns A promise that resolves to the user credential
 */
export const signInWithGoogle = async () => {
  try {
    // Check if your device supports Google Play services
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Clear Google SDK cached session to force account picker
    // This only affects the Google SDK, not Firebase auth
    try {
      await GoogleSignin.signOut();
    } catch (signOutError) {
      // Ignore sign out errors as user might not be signed in to Google SDK
      console.log('Google SDK sign out (for account picker):', signOutError);
    }
    
    // Get the user's ID token with account picker
    const signInResult = await GoogleSignin.signIn();

    // Try the new style of google-sign in result (from v13+)
    let idToken = signInResult.data?.idToken;
    if (!idToken) {
      // For older versions of google-signin, try old style result
      idToken = signInResult.idToken;
    }
    
    if (!idToken) {
      throw new Error('No ID token found from Google Sign-In');
    }

    // Create a Google credential with the token
    const googleCredential = GoogleAuthProvider.credential(idToken);

    // Sign in the user with the credential
    return auth.signInWithCredential(googleCredential);
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

/**
 * Signs out the current Google user
 */
export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
    await auth.signOut();
  } catch (error) {
    console.error('Google sign-out error:', error);
    throw error;
  }
};

/**
 * Gets the current Google user information if signed in
 * @returns The current user or null if not signed in
 */
export const getCurrentGoogleUser = async () => {
  try {
    const isSignedIn = await GoogleSignin.isSignedIn();
    if (isSignedIn) {
      return await GoogleSignin.getCurrentUser();
    }
    return null;
  } catch (error) {
    console.error('Error getting current Google user:', error);
    return null;
  }
};