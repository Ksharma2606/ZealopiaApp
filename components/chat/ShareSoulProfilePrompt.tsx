import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { MessageData, useChatStore } from '@/lib/stores/chatStore';
import apiService from '@/lib/services/ApiService';
import Colors from '@/constants/Colors';

interface ShareSoulProfilePromptProps {
  message: MessageData;
  groupId: string;
}

const { width } = Dimensions.get('window');
const messageWidth = width * 0.75;

export function ShareSoulProfilePrompt({ message, groupId }: ShareSoulProfilePromptProps) {
  const { membershipExpiryStatus, setMembershipExpiryStatus } = useChatStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const metadata = message.messageMetadata;
  const medicName = metadata?.medicName || 'your therapist';

  // Check if we should show the share button
  // Don't show if already shared (from membership status API)
  const shouldShowButton = (): boolean => {
    if (membershipExpiryStatus?.soulProfileShared) {
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

  const handleShareSoulProfile = async () => {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      console.log('[ShareSoulProfilePrompt] Sharing soul profile for group:', groupId);

      const response = await apiService.shareSoulProfile(groupId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to share soul profile');
      }

      console.log('[ShareSoulProfilePrompt] Soul profile shared successfully');

      // Update local membership status to hide the button
      if (membershipExpiryStatus) {
        setMembershipExpiryStatus({
          ...membershipExpiryStatus,
          soulProfileShared: true,
        });
      }

      Alert.alert(
        'Soul Profile Shared',
        `Your Soul Profile has been shared with ${medicName}. This will help them understand you better.`,
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('[ShareSoulProfilePrompt] Error:', error);
      Alert.alert(
        'Share Failed',
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

          {/* Share button - only show if not already shared */}
          {showButton && (
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[
                  styles.shareButton,
                  isProcessing && styles.shareButtonActive,
                ]}
                onPress={handleShareSoulProfile}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.shareButtonText}>
                    Share Soul Profile with {medicName}
                  </Text>
                )}
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
});
