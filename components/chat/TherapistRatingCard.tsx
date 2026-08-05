import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useChatStore, RatingStatus } from '@/lib/stores/chatStore';
import apiService from '@/lib/services/ApiService';
import Colors from '@/constants/Colors';

interface TherapistRatingCardProps {
  groupId: string;
  ratingStatus: RatingStatus | null | undefined;
  onRatingSubmitted: () => void;
}

const { width } = Dimensions.get('window');
const messageWidth = width * 0.75;

export function TherapistRatingCard({ groupId, ratingStatus, onRatingSubmitted }: TherapistRatingCardProps) {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // If already rated, show thank you message
  if (ratingStatus?.hasRated) {
    return (
      <View style={styles.messageContainer}>
        <View style={styles.otherMessage}>
          <View style={styles.messageBubble}>
            <View style={styles.userInfoContainer}>
              <View style={styles.userInfo}>
                <View style={styles.userColorIndicator} />
                <Text style={styles.senderName}>Zealopia</Text>
              </View>
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(new Date())}</Text>
              </View>
            </View>
            <Text style={styles.thankYouText}>Thanks for your feedback.</Text>
          </View>
        </View>
      </View>
    );
  }

  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiService.submitTherapistRating({
        groupFirebaseUid: groupId,
        rating: selectedRating,
        feedback: feedback.trim() || undefined,
      });

      if (response.success) {
        onRatingSubmitted();
      } else {
        Alert.alert('Error', response.error || 'Failed to submit rating. Please try again.');
      }
    } catch (error: any) {
      console.error('[TherapistRatingCard] Error submitting rating:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setSelectedRating(i)}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.star,
            i <= selectedRating ? styles.starFilled : styles.starEmpty
          ]}>
            {i <= selectedRating ? '\u2605' : '\u2605'}
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  // Only show feedback input for ratings 3 or below
  const showFeedbackInput = selectedRating > 0 && selectedRating <= 5;

  return (
    <View style={styles.messageContainer}>
      <View style={styles.otherMessage}>
        <View style={styles.messageBubble}>
          {/* User info header */}
          <View style={styles.userInfoContainer}>
            <View style={styles.userInfo}>
              <View style={styles.userColorIndicator} />
              <Text style={styles.senderName}>Zealopia</Text>
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(new Date())}</Text>
            </View>
          </View>

          {/* Rating prompt */}
          <Text style={styles.promptText}>Please Rate your experience with the expert:</Text>

          {/* Star rating */}
          <View style={styles.starsContainer}>
            {renderStars()}
          </View>

          {/* Feedback input - only shown for low ratings */}
          {showFeedbackInput && (
            <>
              <Text style={styles.feedbackLabel}>Reasons for not re-booking:</Text>
              <View style={styles.feedbackInputContainer}>
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Write text here"
                  placeholderTextColor={Colors.secondaryText}
                  value={feedback}
                  onChangeText={setFeedback}
                  multiline
                  numberOfLines={4}
                  editable={!isSubmitting}
                  textAlignVertical="top"
                />
              </View>
            </>
          )}

          {/* Submit button */}
          {selectedRating > 0 && (
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmitRating}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Rating</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 5,
    paddingHorizontal: 2,
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    width: messageWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
    borderRadius: 8,
    backgroundColor: Colors.gold,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: -14,
    marginLeft: -8,
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.black,
    marginRight: 6,
  },
  senderName: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.black,
    marginRight: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: Colors.secondaryText,
    textAlign: 'right',
  },
  promptText: {
    marginVertical: 8,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primaryText,
  },
  starsContainer: {
    flexDirection: 'row',
    marginVertical: 8,
    gap: 4,
  },
  star: {
    fontSize: 28,
  },
  starFilled: {
    color: Colors.primary,
  },
  starEmpty: {
    color: Colors.white,
  },
  feedbackLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primaryText,
  },
  feedbackInputContainer: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    minHeight: 80,
  },
  feedbackInput: {
    padding: 10,
    fontSize: 14,
    color: Colors.primaryText,
    minHeight: 80,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 40,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  thankYouText: {
    marginVertical: 8,
    fontSize: 12,
    color: Colors.primaryText,
  },
});
