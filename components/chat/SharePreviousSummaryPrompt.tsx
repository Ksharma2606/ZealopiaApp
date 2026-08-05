import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { MessageData, useChatStore } from '@/lib/stores/chatStore';
import apiService from '@/lib/services/ApiService';
import Colors from '@/constants/Colors';

interface SharePreviousSummaryPromptProps {
  message: MessageData;
  groupId: string;
}

const { width } = Dimensions.get('window');
const messageWidth = width * 0.75;

export function SharePreviousSummaryPrompt({ message, groupId }: SharePreviousSummaryPromptProps) {
  const { currentGroup, setCurrentGroup } = useChatStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const metadata = message.messageMetadata;
  const medicName = metadata?.medicName || 'your therapist';

  // Check if we should show the share button
  // Don't show if already requested (either from local state or Firebase group data)
  const shouldShowButton = (): boolean => {
    // Check group-level flag from Firebase
    if (currentGroup?.sharePreviousSummaryRequested) {
      return false;
    }
    return true;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleShareSummary = async () => {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      console.log('[SharePreviousSummaryPrompt] Requesting to share previous summary for group:', groupId);

      const response = await apiService.sharePreviousSummary(groupId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to submit share request');
      }

      console.log('[SharePreviousSummaryPrompt] Share request submitted successfully');

      // Update local group state to hide the button
      if (currentGroup) {
        setCurrentGroup({
          ...currentGroup,
          sharePreviousSummaryRequested: true,
        });
      }

      Alert.alert(
        'Request Submitted',
        `Your request to share your previous chat summary with ${medicName} has been submitted. Our team will review and share the relevant information.`,
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('[SharePreviousSummaryPrompt] Error:', error);
      Alert.alert(
        'Request Failed',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const showButton = shouldShowButton();

  return (
    <View style={styles.messageContainer}>
      <View style={styles.otherMessage}>
        <View style={styles.messageBubble}>
          {/* User info header - same as Zealopia messages */}
          <View style={styles.userInfoContainer}>
            <View style={styles.userInfo}>
              <View style={styles.userColorIndicator} />
              <Text style={styles.senderName}>Zealopia</Text>
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(message.sentAt)}</Text>
            </View>
          </View>

          {/* Message text */}
          <Text style={styles.messageText}>{message.messageText}</Text>

          {/* Share button - only show if not already requested */}
          {showButton && (
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[
                  styles.shareButton,
                  isProcessing && styles.shareButtonActive,
                ]}
                onPress={handleShareSummary}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.shareButtonText}>
                    Share Summary with {medicName}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => {
                  // Update local state to hide the button (user chose to skip)
                  if (currentGroup) {
                    setCurrentGroup({
                      ...currentGroup,
                      sharePreviousSummaryRequested: true,
                    });
                  }
                }}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.skipButtonText}>No, thanks</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: Colors.gold, // Light blue for share prompt messages
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
  messageText: {
    marginVertical: 5,
    fontSize: 12,
    lineHeight: 15,
    color: Colors.primaryText,
  },
  buttonsContainer: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
  },
  shareButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  shareButtonActive: {
    opacity: 0.8,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.secondaryText,
    textAlign: 'center',
  },
});
