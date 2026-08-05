import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { useAuth } from '@/lib/context/AuthContext';
import { useGroupChatStore } from '@/lib/stores/groupChatStore';
import ApiService from '@/lib/services/ApiService';
import Colors from '@/constants/Colors';

// Soul Bot specific colors
const COLORS = {
  soulBotPrimary: '#7C3AED',    // Purple for Soul Bot
  soulBotSecondary: '#A78BFA',  // Light purple
  soulBotBg: '#EDE9FE',         // Very light purple
  primaryText: '#000000',
  secondaryText: '#919191',
  white: '#FFFFFF',
};

interface SoulBotMessageInputProps {
  groupId: string;
  onMessageSent?: () => void;
  onOptimisticMessage?: (messageText: string) => void;
  onSoulProfileGenerationTriggered?: () => void;
}

export function SoulBotMessageInput({ groupId, onMessageSent, onOptimisticMessage, onSoulProfileGenerationTriggered }: SoulBotMessageInputProps) {
  const { firebaseUser } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Get mark as read function from GroupChatStore
  const markGroupAsRead = useGroupChatStore(state => state.markGroupAsRead);

  const handleSendMessage = async () => {
    if (!messageText.trim() || isSending || !firebaseUser) {
      return;
    }

    const messageToSend = messageText.trim();
    
    // Clear input immediately for better UX
    setMessageText('');
    
    // Add optimistic message to UI immediately
    onOptimisticMessage?.(messageToSend);
    
    setIsSending(true);

    try {
      // Send message via API in the background
      const response = await ApiService.sendSoulBotMessage(messageToSend);

      // AUTO-READ: Mark the soul bot group as read since user just sent a message (fire-and-forget)
      setTimeout(() => markGroupAsRead(groupId), 0);
      console.log('Marked soul bot group as read after sending message');

      // Callback for scrolling to bottom (already done in optimistic update)
      onMessageSent?.();

      console.log('Message sent to Soul Bot successfully');

      // Check if soul profile generation was triggered
      if (response.success && response.data?.will_trigger_soul_profile_generation) {
        console.log('[SoulBotMessageInput] Soul profile generation triggered, navigating in 1 second...');
        // Wait 1 second before navigating to generating screen
        setTimeout(() => {
          onSoulProfileGenerationTriggered?.();
        }, 1000);
      }

    } catch (error) {
      console.error('Error sending message to Soul Bot:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      // On error, we might want to remove the optimistic message
      // For now, we'll keep it simple and let it be replaced when Firebase updates
    } finally {
      setIsSending(false);
    }
  };

  const getCharacterCount = () => messageText.length;
  const isAtLimit = getCharacterCount() >= 500;
  const canSend = messageText.trim().length > 0 && !isSending;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.textInput,
            isAtLimit && styles.textInputAtLimit
          ]}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Share your thoughts..."
          placeholderTextColor={COLORS.secondaryText}
          multiline
          maxLength={500}
          textAlignVertical="top"
          returnKeyType="send"
          onSubmitEditing={handleSendMessage}
          editable={!isSending}
        />
        
        <View style={styles.sendButtonContainer}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              !canSend && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!canSend}
          >
            <Image source={require('@/assets/images/arrow_send.png')} style={styles.sendButtonIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingRight: 44,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 14,
    color: Colors.primaryText,
    backgroundColor: Colors.white,
  },
  textInputAtLimit: {
    borderColor: '#FF6B6B',
  },
  sendButtonContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 45,
    height: 45,
  },
  sendButtonIcon: {
    width: 42,
    height: 42,
  },
  sendButtonDisabled: {
    // backgroundColor: Colors.headerFooter,
  },
});