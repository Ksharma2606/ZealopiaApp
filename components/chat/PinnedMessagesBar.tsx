import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageData } from '@/lib/stores/chatStore';
import { UserData } from '@/lib/services/UserService';
import Colors from '@/constants/Colors';

interface PinnedMessagesBarProps {
  pinnedMessages: MessageData[];
  onMessagePress: (messageId: string) => void;
}

export function PinnedMessagesBar({
  pinnedMessages,
  onMessagePress
}: PinnedMessagesBarProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sort pinned messages by sentAt (newest first)
  const sortedPinnedMessages = useMemo(() => {
    return [...pinnedMessages].sort((a, b) =>
      new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
  }, [pinnedMessages]);

  // Don't render if no pinned messages
  if (sortedPinnedMessages.length === 0) {
    return null;
  }

  // Ensure current index is within bounds
  const safeIndex = Math.min(currentIndex, sortedPinnedMessages.length - 1);
  const currentMessage = sortedPinnedMessages[safeIndex];
  const hasMultipleMessages = sortedPinnedMessages.length > 1;

  const handlePrevious = () => {
    setCurrentIndex((prev) =>
      prev > 0 ? prev - 1 : sortedPinnedMessages.length - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) =>
      prev < sortedPinnedMessages.length - 1 ? prev + 1 : 0
    );
  };

  const handlePress = () => {
    onMessagePress(currentMessage.id);
  };

  // Get display text for the message
  const getDisplayText = () => {
    // If message has text, use that
    if (currentMessage.messageText && currentMessage.messageText.trim().length > 0) {
      return currentMessage.messageText.length > 50
        ? currentMessage.messageText.substring(0, 50) + '...'
        : currentMessage.messageText;
    }

    // If message has attachments, show attachment type
    if (currentMessage.attachments && currentMessage.attachments.length > 0) {
      const attachmentType = currentMessage.attachments[0].type;
      switch (attachmentType) {
        case 'audio':
          return 'Voice Note';
        case 'image':
          return 'Image';
        case 'video':
          return 'Video';
        default:
          return 'Attachment';
      }
    }

    return '';
  };

  const truncatedText = getDisplayText();

  return (
    <View style={styles.container}>
      {/* Pin icon */}
      <View style={styles.pinIcon}>
        <Image source={require('@/assets/images/icons/pin.png')} style={styles.pinIcon} />
      </View>
      
      {/* Left arrow (only if multiple messages) */}
      {hasMultipleMessages && (
        <TouchableOpacity onPress={handlePrevious} style={styles.arrowButton}>
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
      )}

      {/* Message content (tappable) */}
      <TouchableOpacity style={styles.messageContent} onPress={handlePress} activeOpacity={0.7}>
        <Text style={styles.messageText} numberOfLines={1}>
          {truncatedText}
        </Text>
      </TouchableOpacity>

      {/* Right arrow (only if multiple messages) */}
      {hasMultipleMessages && (
        <TouchableOpacity onPress={handleNext} style={styles.arrowButton}>
          <Ionicons name="chevron-forward" size={20} color={Colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.otpBackground,
    paddingHorizontal: 2,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  arrowButton: {
    padding: 4,
  },
  pinIcon: {
    marginLeft: 4,
    marginRight: 4,
    height: 23,
    width: 23
  },
  messageContent: {
    flex: 1,
    marginRight: 8,
  },
  messageText: {
    fontSize: 14,
    color: Colors.black,
    fontFamily: 'Poppins-Regular',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondaryBg,
  },
});

export default PinnedMessagesBar;
