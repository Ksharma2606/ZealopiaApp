import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Gradients, {GradientContainerStyle} from '@/constants/Gradients';
import { useAuth } from '@/lib/context/AuthContext';
import { BaseText as Text } from '@/components/ui/Base';
import Colors from '@/constants/Colors';

export default function ZoraIntroScreen() {
  const { backendUser, refreshUserData, updateUserProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Check for soul bot group on component mount
  useEffect(() => {
    const checkSoulBotGroup = async () => {
      if (!backendUser?.soul_bot_group_uid) {
        console.log('Soul bot group not found, refreshing user data...');
        setIsLoading(true);
        setLoadingMessage('Setting up your Soul Bot...');
        
        try {
          await refreshUserData();
          console.log('User data refreshed in Zora intro');
        } catch (error) {
          console.error('Error refreshing user data in Zora intro:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (backendUser) {
      checkSoulBotGroup();
    }
  }, [backendUser?.id, refreshUserData]); // Use user ID to trigger when user data is available

  const waitForSoulBotGroupCreation = async (maxAttempts = 10, intervalMs = 2000) => {
    console.log('Waiting for soul bot group creation from Zora intro...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Refresh user data from backend
        await refreshUserData();
        
        if (backendUser?.soul_bot_group_uid) {
          console.log('Soul bot group created successfully in Zora intro:', backendUser.soul_bot_group_uid);
          return true;
        }
        
        console.log(`Soul bot group not ready yet in Zora intro (attempt ${attempt}/${maxAttempts})`);
        
        // Wait before the next attempt (except for the last attempt)
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        console.error(`Error checking soul bot group creation in Zora intro (attempt ${attempt}):`, error);
        
        // Continue trying even if there's an error, but log it
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
    }
    
    console.warn('Soul bot group creation timed out in Zora intro after', maxAttempts, 'attempts');
    return false;
  };

  const handleGetStarted = async () => {
    setIsLoading(true);
    setLoadingMessage('Preparing your Soul Bot experience...');

    try {
      // If soul bot group is not available, wait for it
      if (!backendUser?.soul_bot_group_uid) {
        console.log('Soul bot group not available, waiting for creation...');
        const success = await waitForSoulBotGroupCreation();
        
        if (!success) {
          console.warn('Proceeding without soul bot group - will handle in soul bot chat screen');
        }
      }

      // Mark signup as completed
      console.log('Marking signup as completed in Zora intro...');
      updateUserProfile({
        is_signup_completed: true,
      });

      // Navigate to soul bot chat
      console.log('Navigating to soul bot chat from Zora intro...');
      router.replace('/soul-bot-chat');
    } catch (error) {
      console.error('Error in Zora intro handleGetStarted:', error);
      // Still navigate even if there's an error
      updateUserProfile({
        is_signup_completed: true,
      });
      router.replace('/soul-bot-chat');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={Gradients.onboarding.colors}
      locations={Gradients.onboarding.locations}
      style={GradientContainerStyle}
    >
      <View style={styles.content}>
        {/* Zora Character */}
        <View style={styles.characterContainer}>
          <Image 
            source={require('@/assets/images/zora-intro.png')}
            style={styles.characterImage}
          />
        </View>

        {/* Welcome Text */}
        <Text style={styles.greeting}>Hi {backendUser?.user_profile?.name?.split(' ')[0]}!</Text>
        
        <Text style={styles.introduction}>
          I am <Text style={styles.zoraText}>Zora</Text>, your first soul-friend
        </Text>

        <Text style={styles.welcomeText}>Welcome to Zealopia</Text>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featureText}>My job is to help you...</Text>
          <Text style={styles.featureText}>🌸 Understand yourself better</Text>
          <Text style={styles.featureText}>🌸 Find your soul matches</Text>
          <Text style={styles.featureText}>🌸 Unlock exciting micro content</Text>
          <Text style={styles.featureText}>🌸 Craft your soul journey</Text>
        </View>

        {/* Get Started Button */}
        <Pressable 
          style={[styles.getStartedButton, isLoading && styles.disabledButton]}
          onPress={handleGetStarted}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="white" />
              <Text style={[styles.getStartedText, { marginLeft: 8 }]}>
                {loadingMessage || 'Loading...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.getStartedText}>Get Started</Text>
          )}
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  characterContainer: {
    width: 266,
    height: 358,
    marginBottom: 10,
    position: 'relative',
  },
  characterImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  heart: {
    fontSize: 20,
    position: 'absolute',
  },
  heartTop: {
    top: -15,
    right: 10,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 3,
    color: Colors.secondaryText
  },
  introduction: {
    fontSize: 20,
    fontWeight: '500',
    color: Colors.secondaryText,
    marginBottom: 20,
    textAlign: 'center',
  },
  zoraText: {
    fontSize: 20,
    fontWeight: '500',
    color: Colors.primary,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '500',
    color: Colors.headerFooter,
    marginBottom: 20,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 16,
    color: Colors.secondaryText,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 16,
    color: Colors.secondaryText,
    textAlign: 'center',
    marginBottom: 2
  },
  getStartedButton: {
    marginTop: 20,
    backgroundColor: Colors.headerFooter,
    paddingHorizontal: 70,
    paddingVertical: 15,
    borderRadius: 30,
  },
  disabledButton: {
    backgroundColor: '#CBD5E0',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    color: Colors.primaryText,
    fontSize: 16,
    fontWeight: '500',
  },
});