import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/context/AuthContext';
import { BaseText as Text } from '@/components/ui/Base';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { backendUser } = useAuth();

  const getUserName = () => {
    if (backendUser?.user_profile?.name) {
      return backendUser.user_profile.name;
    }
    return 'User';
  };

  const handleGetStarted = () => {
    router.replace('/(auth)/topics');
  };

  return (
    <View style={styles.container}>
      {/* Main Content */}
      <View style={styles.content}>
        {/* Welcome Image */}
        <View style={styles.imageContainer}>
          <Image
            source={require('@/assets/images/zeal.png')}
            style={styles.welcomeImage}
            resizeMode="contain"
          />
        </View>

        {/* Welcome Text */}
        <Text style={styles.greeting}>Hi {getUserName()}!</Text>
        <Text style={styles.title}>Welcome to Zealopia</Text>
        <Text style={styles.subtitle}>
          Your happy place!{'\n'}Where we help you find the people who understand you...
        </Text>

        {/* Get Started Button */}
        <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F163D',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  imageContainer: {
    marginBottom: 20,
  },
  welcomeImage: {
    width: 344,
    height: 339,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
    marginTop: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F4B7D1',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#D9D1ED',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  getStartedButton: {
    backgroundColor: '#DD7896',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 40,
    width: width * 0.6,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
