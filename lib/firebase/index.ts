// Import Firebase for React Native
import firebase from '@react-native-firebase/app';
import firebaseAuth from '@react-native-firebase/auth';
import firebaseFirestore from '@react-native-firebase/firestore';

// Firebase is automatically initialized from config files:
// - ios/zealopia/GoogleService-Info.plist  
// - android/app/google-services.json

// Wait for Firebase to initialize
const initializeFirebase = () => {
  return new Promise((resolve) => {
    // Firebase initializes automatically in React Native
    // Just export the auth instance
    resolve(firebaseAuth());
  });
};

// Export the auth and firestore instances directly
export const auth = firebaseAuth();
export const db = firebaseFirestore();

// Export initialization function if needed
export { initializeFirebase };
