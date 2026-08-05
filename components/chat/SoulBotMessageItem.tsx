import React from 'react';
import { View, Text, StyleSheet, Dimensions, Linking } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import Colors from '@/constants/Colors';

interface SoulBotMessageItemProps {
  message: {
    id: string;
    messageText: string;
    sentAt: Date;
    sentBy: string;
  };
  isOwnMessage: boolean;
}

const { width } = Dimensions.get('window');
const messageWidth = width * 0.75;

export function SoulBotMessageItem({ message, isOwnMessage }: SoulBotMessageItemProps) {
  const isSoulBot = message.sentBy === 'soul_bot';

  const formatTime = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'just now';
    }
  };

  // Render text with clickable links
  const renderTextWithLinks = (text: string, isOwn: boolean) => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        parts.push(
          <Text key={key++} style={isOwn ? styles.ownMessageText : styles.otherMessageText}>
            {text.substring(lastIndex, match.index)}
          </Text>
        );
      }

      // Add clickable link
      const url = match[0];
      parts.push(
        <Text
          key={key++}
          style={[isOwn ? styles.ownMessageText : styles.otherMessageText, styles.linkText]}
          onPress={() => Linking.openURL(url).catch(err => console.error('Failed to open URL:', err))}
        >
          {url}
        </Text>
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last URL
    if (lastIndex < text.length) {
      parts.push(
        <Text key={key++} style={isOwn ? styles.ownMessageText : styles.otherMessageText}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    // If no links found, return plain text
    if (parts.length === 0) {
      return (
        <Text style={isOwn ? styles.ownMessageText : styles.otherMessageText}>
          {text}
        </Text>
      );
    }

    return <Text style={styles.messageText}>{parts}</Text>;
  };

  return (
    <View style={[
      styles.container,
      isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
    ]}>
      
      <View style={[
        styles.messageBubble,
        isOwnMessage ? styles.ownMessageBubble : 
        isSoulBot ? styles.soulBotBubble : styles.otherMessageBubble
      ]}>
        {/* Soul Bot label */}
        <View style={isSoulBot ? styles.soulBotLabelTimeContainer : styles.userLabelTimeContainer}>
          {isSoulBot ? (
            <View style={styles.soulBotLabel}>
              <Text style={styles.soulBotLabelText}>Zora</Text>
            </View>
          ) : (
            <View style={styles.userLabel}>
              <Text style={styles.userLabelText}>You</Text>
            </View>
          )}

          <Text style={[
            styles.timeText,
            isOwnMessage ? styles.ownTimeText : styles.otherTimeText
          ]}>
            {formatTime(message.sentAt)}
          </Text>
        </View>
        
        <View style={styles.messageTextContainer}>
          {renderTextWithLinks(message.messageText, isOwnMessage)}
        </View>
        
        
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  
  // Avatars
  avatarContainer: {
    marginHorizontal: 8,
    justifyContent: 'flex-end',
  },
  
  // Message bubbles
  messageBubble: {
    // minWidth: '60%',
    // maxWidth: '80%',
    width: messageWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 6,
    borderRadius: 20,
  },
  ownMessageBubble: {
    backgroundColor: Colors.myChat,
    borderBottomRightRadius: 4,
  },
  soulBotBubble: {
    backgroundColor: Colors.headerFooter,
    borderBottomLeftRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: Colors.headerFooter,
    borderBottomLeftRadius: 4,
  },

  soulBotLabelTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignContent: 'center',
    marginBottom: 4,
  },

  userLabelTimeContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignContent: 'center',
    marginBottom: 4,
  },

  // Soul Bot label
  soulBotLabel: {
  },
  soulBotLabelText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '600',
  },

  userLabel: {
    alignSelf: 'flex-end',
  },
  userLabelText: {
    fontSize: 13,
    color: Colors.black,
    fontWeight: '600',
  },
  
  // Message text
  messageTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  ownMessageText: {
    color: Colors.black,
    fontSize: 13,
    lineHeight: 18,
  },
  otherMessageText: {
    color: Colors.black,
    fontSize: 13,
    lineHeight: 18,
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  
  // Time text
  timeText: {
    fontSize: 12,
    marginTop: 4,
  },
  ownTimeText: {
    color: Colors.secondaryText,
  },
  otherTimeText: {
    color: Colors.white,
  },
});