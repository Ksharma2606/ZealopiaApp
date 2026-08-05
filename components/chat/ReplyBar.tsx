import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '@/lib/stores/chatStore';

// Exact colors from Flutter Flow theme
const COLORS = {
  secondaryBackground: '#D9D9D9', // Reply bar background
  primaryText: '#000000',         // Black text
  secondaryText: '#919191',       // Gray text
};

export function ReplyBar() {
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const { replyingTo, isReplyingToSet, clearReply } = useChatStore();

  useEffect(() => {
    if (isReplyingToSet) {
      // Animate in - matches Flutter Flow's 300ms easeIn
      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      // Animate out
      Animated.timing(animatedHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [isReplyingToSet]);

  if (!replyingTo || !isReplyingToSet) {
    return null;
  }


  const animatedStyle = {
    maxHeight: animatedHeight.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 80], // Approximate height
    }),
    opacity: animatedHeight,
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.content}>
        {/* Color-coded vertical bar matching sender's color */}
        <View 
          style={[
            styles.colorBar, 
            { backgroundColor: replyingTo.color }
          ]} 
        />
        
        {/* Reply content */}
        <View style={styles.textContent}>
          <Text style={styles.senderName}>{replyingTo.name}</Text>
          <Text style={styles.messageText} numberOfLines={2}>
            {replyingTo.msgText}
          </Text>
        </View>
        
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={clearReply}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={COLORS.secondaryText} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.secondaryBackground,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  colorBar: {
    width: 5,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  textContent: {
    flex: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 12,
    color: COLORS.secondaryText,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});