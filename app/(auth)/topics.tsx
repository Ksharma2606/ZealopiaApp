import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import apiService from '@/lib/services/ApiService';
import { ErrorState } from '@/components/ui/ErrorComponents';
import { AppError } from '@/lib/services/ErrorService';
import { useAuth } from '@/lib/context/AuthContext';
import LogoHeader from '@/components/LogoHeader';
import { LinearGradient } from 'expo-linear-gradient';
import Gradients, { GradientContainerStyle } from '@/constants/Gradients';
import Colors from '@/constants/Colors';
import { BaseText as Text } from '@/components/ui/Base';

const { width } = Dimensions.get('window');

interface Topic {
  id: number;
  name: string;
  default_group_pic_url?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
}

interface TopicCardProps {
  topic: Topic;
  isSelected: boolean;
  onToggle: () => void;
}

function TopicCard({ topic, isSelected, onToggle }: TopicCardProps) {
  return (
    <TouchableOpacity
      style={[styles.topicCard, isSelected && styles.selectedTopicCard]}
      onPress={onToggle}
    >
      <Text style={[styles.topicText, isSelected && styles.selectedTopicText]}>
        {topic.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function TopicsScreen() {
  const router = useRouter();
  const { updateUserProfile, backendUser, refreshUserData } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Saving...');
  const [fetchingTopics, setFetchingTopics] = useState(true);
  const [showError, setShowError] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      setFetchingTopics(true);
      setError(null);
      
      const response = await apiService.getTopics();
      
      if (response.success && response.data) {
        setTopics(response.data);
      } else {
        setError(response.appError || {
          type: 'NETWORK' as any,
          severity: 'MEDIUM' as any,
          message: response.error || 'Failed to fetch topics',
          userMessage: 'Unable to load topics. Please try again.',
          timestamp: new Date(),
          retryable: true,
        });
      }
    } catch (err) {
      console.error('Error fetching topics:', err);
      setError({
        type: 'NETWORK' as any,
        severity: 'MEDIUM' as any,
        message: 'Network error',
        userMessage: 'Unable to connect. Please check your internet connection.',
        timestamp: new Date(),
        retryable: true,
      });
    } finally {
      setFetchingTopics(false);
    }
  };

  const toggleTopic = (topicId: number) => {
    setSelectedTopics(prev => {
      if (prev.includes(topicId)) {
        return prev.filter(id => id !== topicId);
      } else {
        return [...prev, topicId];
      }
    });
    setShowError(false);
  };

  const waitForSoulBotGroupCreation = async (maxAttempts = 10, intervalMs = 2000) => {
    console.log('Waiting for soul bot group creation...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Refresh user data from backend
        const response = await apiService.getCurrentUser();
        
        if (response.success && response.data?.soul_bot_group_uid) {
          console.log('Soul bot group created successfully:', response.data.soul_bot_group_uid);
          return response.data;
        }
        
        console.log(`Soul bot group not ready yet (attempt ${attempt}/${maxAttempts})`);
        
        // Wait before the next attempt (except for the last attempt)
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        console.error(`Error checking soul bot group creation (attempt ${attempt}):`, error);
        
        // Continue trying even if there's an error, but log it
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
    }
    
    console.warn('Soul bot group creation timed out after', maxAttempts, 'attempts');
    return null;
  };

  const handleSubmit = async () => {
    if (selectedTopics.length === 0) {
      setShowError(true);
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.updateUserTopics(selectedTopics);
      
      if (response.success) {
        // Mark signup as completed now that topics are saved
        updateUserProfile({
          is_signup_completed: true,
        });
        
        // Wait for soul bot group to be created by the backend
        console.log('Topics saved successfully, waiting for soul bot group creation...');
        setLoadingMessage('Setting up your Soul Bot...');
        const updatedUser = await waitForSoulBotGroupCreation();
        
        if (updatedUser) {
          // Update the context with the fresh user data including soul_bot_group_uid
          // We need to call refreshUserData from AuthContext to update the backend user
          await refreshUserData();
          console.log('Soul bot group ready, navigating to main app');
        } else {
          console.warn('Soul bot group creation timed out, but proceeding to main app');
        }
        
        // Navigate to main app
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', response.error || 'Failed to save topics. Please try again.');
      }
    } catch (error) {
      console.error('Topics submission error:', error);
      Alert.alert('Error', 'Failed to save topics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState 
          error={error} 
          onRetry={fetchTopics}
          illustration="network"
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={Gradients.choosingTopic.colors}
      locations={Gradients.choosingTopic.locations}
      style={GradientContainerStyle}
    >
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <LogoHeader />
        <Text style={styles.helloText}>Hello {backendUser?.user_profile?.name}</Text>
        <View style={styles.header}>
          <Text style={styles.title}>Please select topics.</Text>
          <Text style={styles.subtitle}>
            This will help us recommend you support groups of people who are going through similar challenges in their lives.
          </Text>
        </View>

        {/* Loading State */}
        {fetchingTopics ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFB6C1" />
            <Text style={styles.loadingText}>Loading topics...</Text>
          </View>
        ) : (
          <>
            {/* Topics Grid */}
            <View style={styles.topicsContainer}>
              <View style={styles.topicsGrid}>
                {topics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    isSelected={selectedTopics.includes(topic.id)}
                    onToggle={() => toggleTopic(topic.id)}
                  />
                ))}
              </View>
            </View>

            {/* Error Message */}
            {showError && (
              <Text style={styles.errorText}>Please select at least 1 topic</Text>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? loadingMessage : 'Submit'}
              </Text>
            </TouchableOpacity>

            {/* Selection Count */}
            <Text style={styles.selectionCount}>
              {selectedTopics.length} topic{selectedTopics.length !== 1 ? 's' : ''} selected
            </Text>
          </>
        )}
      </ScrollView>
    </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 36,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  helloText: {
    fontSize: 30,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 20,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1F163D',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#51466F',
    textAlign: 'center',
    lineHeight: 22,
  },
  topicsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#4A5568',
    marginTop: 12,
  },
  topicCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    width: (width - 70) / 2,
    alignItems: 'center',
    marginBottom: 15,
    minHeight: 80,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(111, 98, 177, 0.16)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  selectedTopicCard: {
    backgroundColor: '#6F62B1',
  },
  topicText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
    textAlign: 'center',
    lineHeight: 22,
  },
  selectedTopicText: {
    color: 'white',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#DD7896',
    borderRadius: 16,
    paddingVertical: 16,
    marginHorizontal: 40,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    marginBottom: 15,
  },
  disabledButton: {
    backgroundColor: '#CBD5E0',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  selectionCount: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
  },
});
