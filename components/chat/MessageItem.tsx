import React, { useState, useRef, memo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { MessageData, GroupMembership, useChatStore } from '@/lib/stores/chatStore';
import { MessageOptionsModal } from './MessageOptionsModal';
import { ImageViewer } from './ImageViewer';
import { createAudioPlayer, AudioPlayer, AudioStatus } from 'expo-audio';
import { UserData } from '@/lib/services/UserService';
import Colors from '@/constants/Colors';

// Define attachment interface
interface MessageAttachment {
  id: string;
  type: 'image' | 'audio' | 'video';
  url: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  transcription?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionConfidence?: number;
}

interface MessageItemProps {
  message: MessageData;
  isOwnMessage: boolean;
  ownName: string;
  senderData?: UserData | null;
  membership?: GroupMembership | null;
  currentUserMembership?: GroupMembership | null;
  groupId: string;
  canWriteChat: boolean;
  onDelete?: (messageId: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
}

const { width } = Dimensions.get('window');
const messageWidth = width * 0.75;

function MessageItemComponent({ message, isOwnMessage, ownName, senderData, membership, currentUserMembership, groupId, canWriteChat, onDelete, onScrollToMessage, onPin, onUnpin }: MessageItemProps) {
  const { setReplyingTo, currentGroup, groupMembers, firebaseUidToDjangoId } = useChatStore();
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<MessageAttachment | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<AudioStatus | null>(null);
  const translateX = useSharedValue(0);
  const replyIconOpacity = useSharedValue(0);

  // Audio player for inline playback - created lazily only when needed
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  const getMessageBackgroundColor = () => {
    // Zealopia admin messages get special gold color
    if (message.sentBy === 'zealopia') {
      return Colors.gold;
    }
    
    // Own messages get pink, others get teal
    return isOwnMessage ? Colors.myChat : Colors.otherChat;
  };

  const getUserColor = () => {
    // Zealopia user (system messages)
    if (message.sentBy === 'zealopia' || message.sentBy === 'soul_bot') {
      return Colors.black;
    }

    // Logged in user (who is chatting right now)
    if (isOwnMessage) {
      return Colors.black;
    }

    // Admin users get pink color
    if (membership?.role === 'Admin') {
      return Colors.primary;
    }

    // Use pre-computed color from membership cache (computed in ChatThread)
    return membership?.color || '#808080';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getSoulMatchEmoji = () => {
    // Don't show for own messages or bot messages
    if (isOwnMessage || message.sentBy === 'zealopia' || message.sentBy === 'soul_bot') {
      return '';
    }
    
    // Try to get Django user ID from Firebase UID
    const djangoUserId = firebaseUidToDjangoId[message.sentBy];
    
    // // Debug logging
    // console.log('[MessageItem] Getting soul match emoji for:', {
    //   messageId: message.id,
    //   senderFirebaseUid: message.sentBy,
    //   mappedDjangoUserId: djangoUserId,
    //   senderDataId: senderData?.id,
    //   senderName: senderData?.name,
    //   hasGroupMembers: Object.keys(groupMembers).length > 0,
    //   groupMembersKeys: Object.keys(groupMembers),
    //   hasDjangoMapping: Object.keys(firebaseUidToDjangoId).length > 0,
    //   memberData: djangoUserId ? groupMembers[djangoUserId] : 'NO_MAPPING'
    // });
    
    // Check if we can find the member using Django ID from Firebase UID mapping
    if (djangoUserId && groupMembers[djangoUserId]) {
      const emoji = groupMembers[djangoUserId].soulMatchEmoji || '';
      // console.log('[MessageItem] Found via Firebase UID mapping, returning emoji:', emoji);
      return emoji;
    }
    
    // Fallback: try using senderData.id directly (in case Firebase mapping is not available)
    if (senderData?.id && groupMembers[senderData.id]) {
      const emoji = groupMembers[senderData.id].soulMatchEmoji || '';
      // console.log('[MessageItem] Found via senderData.id fallback, returning emoji:', emoji);
      return emoji;
    }
    
    // console.log('[MessageItem] No emoji - returning empty string');
    return '';
  };

  const handleLongPress = () => {
    setShowOptionsModal(true);
  };

  const handleReply = () => {
    if (!canWriteChat) return;
    
    setReplyingTo({
      color: getUserColor(),
      name: getSenderName(),
      msgText: message.messageText,
      group_id: groupId,
      messageDocRef: message.id,
    });
  };

  // Pan gesture for swipe-to-reply
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-100, 100])
    .onChange((event) => {
      'worklet';
      if (!canWriteChat) return;

      const swipeThreshold = 50;
      const maxTranslation = swipeThreshold * 1.5;

      if (isOwnMessage) {
        // For own messages, swipe left (negative translationX)
        if (event.translationX < 0) {
          const clampedTranslation = Math.max(event.translationX, -maxTranslation);
          const progress = Math.max(0, Math.min(1, Math.abs(clampedTranslation) / swipeThreshold));
          translateX.value = clampedTranslation;
          replyIconOpacity.value = progress;
        } else {
          translateX.value = 0;
          replyIconOpacity.value = 0;
        }
      } else {
        // For other messages, swipe right (positive translationX)
        if (event.translationX > 0) {
          const clampedTranslation = Math.min(event.translationX, maxTranslation);
          const progress = Math.max(0, Math.min(1, clampedTranslation / swipeThreshold));
          translateX.value = clampedTranslation;
          replyIconOpacity.value = progress;
        } else {
          translateX.value = 0;
          replyIconOpacity.value = 0;
        }
      }
    })
    .onEnd((event) => {
      'worklet';
      if (!canWriteChat) return;

      const swipeThreshold = 50;
      const shouldReply = (isOwnMessage && event.translationX < -swipeThreshold) || 
                         (!isOwnMessage && event.translationX > swipeThreshold);

      // Animate back to original position
      translateX.value = withSpring(0, { 
        damping: 15,
        stiffness: 150,
        mass: 1,
        overshootClamping: false,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 2,
      });
      replyIconOpacity.value = withSpring(0, { 
        damping: 15,
        stiffness: 150,
      });

      if (shouldReply) {
        runOnJS(handleReply)();
      }
    });

  // Animated styles for swipe gesture
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  }, []);

  const getSenderName = (): string => {
    if (isOwnMessage) return ownName || 'You';
    if (message.sentBy === 'zealopia' || message.sentBy === 'soul_bot') return 'Zealopia';
    if (senderData) {
      return senderData.displayName || senderData.name || senderData.email?.split('@')[0] || 'User';
    }
    return 'User';
  };


  const truncateReplyText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '…';
  };

  const formatDuration = (seconds: number): string => {
    const roundedSeconds = Math.round(seconds);
    const mins = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to detect URLs in text and render with links
  const renderTextWithLinks = (text: string) => {
    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
    
    const parts = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        parts.push(
          <Text key={key++} style={styles.messageText}>
            {text.substring(lastIndex, match.index)}
          </Text>
        );
      }

      // Format the URL for display and opening
      let url = match[0];
      let displayUrl = url;
      
      // Ensure the URL has a protocol for Linking.openURL
      if (!url.match(/^https?:\/\//i)) {
        if (url.startsWith('www.')) {
          url = 'https://' + url;
        } else if (url.match(/^[a-zA-Z0-9]+\.[a-zA-Z]{2,}/)) {
          // Check if it looks like a domain
          url = 'https://' + url;
        }
      }

      // Add the URL as a clickable link
      parts.push(
        <Text
          key={key++}
          style={[styles.messageText, styles.linkText]}
          onPress={() => Linking.openURL(url).catch(err => console.error('Failed to open URL:', err))}
        >
          {displayUrl}
        </Text>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last URL
    if (lastIndex < text.length) {
      parts.push(
        <Text key={key++} style={styles.messageText}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    // If no URLs were found, return the original text
    if (parts.length === 0) {
      return <Text style={styles.messageText}>{text}</Text>;
    }

    return <Text style={styles.messageText}>{parts}</Text>;
  };

  const handleReplyPress = () => {
    if (message.replyTo?.messageDocRef && onScrollToMessage) {
      // Extract the document ID from the Firestore DocumentReference
      let messageId: string;
      
      if (typeof message.replyTo.messageDocRef === 'string') {
        // If it's already a string, use it directly
        messageId = message.replyTo.messageDocRef;
      } else if (message.replyTo.messageDocRef && typeof message.replyTo.messageDocRef === 'object') {
        // If it's a Firestore DocumentReference, extract the ID
        const docRef = message.replyTo.messageDocRef as any;
        if (docRef._documentPath && docRef._documentPath._parts) {
          // Get the last part of the document path (the document ID)
          const parts = docRef._documentPath._parts;
          messageId = parts[parts.length - 1];
        } else if (docRef.id) {
          messageId = docRef.id;
        } else {
          console.error('Unable to extract message ID from DocumentReference:', docRef);
          return;
        }
      } else {
        console.error('Invalid messageDocRef format:', message.replyTo.messageDocRef);
        return;
      }
      
      console.log('Scrolling to quoted message ID:', messageId);
      onScrollToMessage(messageId);
    }
  };

  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        try {
          // Pause first to prevent threading issues
          audioPlayerRef.current.pause();
          // Note: remove() can cause threading issues on Android
          // The player will be garbage collected automatically
          // audioPlayerRef.current.remove();
        } catch (error) {
          console.warn('[MessageItem] Error cleaning up audio player:', error);
        }
        audioPlayerRef.current = null;
      }
    };
  }, []);

  // Audio player methods
  const toggleAudioPlayback = async (attachment: MessageAttachment) => {
    try {
      // Create player lazily on first use
      if (!audioPlayerRef.current) {
        console.log('[MessageItem] Creating audio player (lazy initialization)');
        audioPlayerRef.current = createAudioPlayer();

        // Subscribe to status updates
        audioPlayerRef.current.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          setPlayerStatus(status);
        });
      }

      const player = audioPlayerRef.current;
      const status = playerStatus;

      if (playingAudioId === attachment.id && status?.playing) {
        // Pause if currently playing this audio
        player.pause();
      } else {
        // Play audio (load if different or start if paused)
        if (playingAudioId !== attachment.id) {
          player.replace({ uri: attachment.url });
          setPlayingAudioId(attachment.id);
        } else if (playingAudioId === attachment.id && status?.isLoaded) {
          // Check if audio has finished playing (currentTime >= duration)
          const currentTime = status.currentTime || 0;
          const duration = status.duration || attachment.duration || 0;

          if (currentTime >= duration - 0.5) { // Small buffer to account for precision
            // Audio has finished, restart from beginning
            player.seekTo(0);
          }
        }
        player.play();
      }
    } catch (error) {
      console.error('Error toggling audio playback:', error);
    }
  };

  const renderAttachment = (attachment: MessageAttachment) => {
    const handleAttachmentPress = () => {
      setSelectedAttachment(attachment);
      if (attachment.type === 'image') {
        setShowImageViewer(true);
      } else if (attachment.type === 'video') {
        // For video, open in external app
        Linking.openURL(attachment.url);
      }
      // Audio attachments now use inline player, no modal needed
    };

    switch (attachment.type) {
      case 'image':
        return (
          <TouchableOpacity 
            key={attachment.id}
            onPress={handleAttachmentPress}
            style={styles.imageAttachment}
          >
            <Image 
              source={{ uri: attachment.url }}
              style={[
                styles.attachmentImage,
                attachment.width && attachment.height && {
                  aspectRatio: attachment.width / attachment.height
                }
              ]}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay}>
              <Ionicons name="expand" size={20} color="white" />
            </View>
          </TouchableOpacity>
        );

      case 'audio':
        const isCurrentlyPlaying = playingAudioId === attachment.id && playerStatus?.playing;
        const isCurrentlyLoaded = playingAudioId === attachment.id && playerStatus?.isLoaded;
        const currentTime = isCurrentlyLoaded ? playerStatus.currentTime || 0 : 0;
        const totalDuration = attachment.duration || playerStatus?.duration || 0;
        const progressPercentage = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

        return (
          <View key={attachment.id} style={styles.audioAttachment}>
            {/* Play/Pause Button */}
            <TouchableOpacity
              style={styles.audioPlayButton}
              onPress={() => toggleAudioPlayback(attachment)}
            >
              <Ionicons 
                name={isCurrentlyPlaying ? "pause" : "play"} 
                size={20} 
                color="white" 
              />
            </TouchableOpacity>

            {/* Audio Info and Progress */}
            <View style={styles.audioInfo}>
              <View style={styles.audioHeader}>
                <Text style={styles.audioLabel}>Voice message</Text>
                {attachment.transcriptionStatus && (
                  <View style={styles.transcriptionStatusContainer}>
                    {attachment.transcriptionStatus === 'pending' && (
                      <Text style={styles.transcriptionStatus}>⏳ Transcribing...</Text>
                    )}
                    {attachment.transcriptionStatus === 'processing' && (
                      <Text style={styles.transcriptionStatus}>🔄 Processing...</Text>
                    )}
                    {attachment.transcriptionStatus === 'failed' && (
                      <Text style={styles.transcriptionStatusError}>❌ Failed</Text>
                    )}
                  </View>
                )}
              </View>
              
              {/* Progress Bar */}
              <View style={styles.audioProgressContainer}>
                <View style={styles.audioProgressBar}>
                  <View 
                    style={[
                      styles.audioProgressFill, 
                      { width: `${progressPercentage}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.audioCurrentTime}>
                  {formatDuration(currentTime)} / {formatDuration(totalDuration)}
                </Text>
              </View>

              {/* Transcription Text */}
              {attachment.transcription && attachment.transcriptionStatus === 'completed' && (
                <View style={styles.transcriptionContainer}>
                  <Text style={styles.transcriptionIcon}>💬</Text>
                  <Text style={styles.transcriptionText}>{attachment.transcription}</Text>
                  {attachment.transcriptionConfidence && attachment.transcriptionConfidence < 0.7 && (
                    <Text style={styles.transcriptionNote}>
                      (Low confidence transcription)
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <View style={styles.messageContainer}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.animatedContainer, animatedStyle]}>
            <TouchableOpacity
              onLongPress={handleLongPress}
              activeOpacity={0.8}
            >
              <View style={[isOwnMessage ? styles.ownMessage : styles.otherMessage ]}>
                {/* Message bubble */}
                <View
                  style={[
                    styles.messageBubble,
                    { backgroundColor: getMessageBackgroundColor() },
                    message._isPending && styles.pendingMessage,
                    message._isFailed && styles.failedMessage
                  ]}
                >
                  <View style={[
                    styles.userInfoContainer,
                    isOwnMessage ? { flexDirection: 'row-reverse', marginRight: -8 } : { marginLeft: -8 }
                  ]}>
                    <View style={[styles.userInfo, isOwnMessage && styles.userInfoOwn]}>
                      <View 
                        style={[
                          styles.userColorIndicator, 
                          { backgroundColor: getUserColor() },
                          isOwnMessage ? { marginLeft: 6 } : { marginRight: 6 }
                        ]}
                      />
                      <Text style={[styles.senderName, isOwnMessage ? { marginLeft: 12 } : { marginRight: 12 }, { color: getUserColor() }]}>
                        {getSenderName()}
                        {getSoulMatchEmoji() && (
                          <Text style={styles.soulMatchEmoji}> {getSoulMatchEmoji()}</Text>
                        )}
                      </Text>
                    </View>
                    <View style={styles.timeContainer}>
                      <Text style={styles.timeText}>
                        {formatTime(message.sentAt)}
                      </Text>
                      {/* Pending/failed indicators for own messages */}
                      {isOwnMessage && (
                        <>
                          {message._isPending && (
                            <Ionicons
                              name="time-outline"
                              size={12}
                              color={Colors.secondaryText}
                              style={styles.statusIcon}
                            />
                          )}
                        </>
                      )}
                    </View>
                  </View>

                  {message.isReply && message.replyTo && (
                    <TouchableOpacity 
                      style={styles.replyContainer}
                      onPress={handleReplyPress}
                      activeOpacity={0.7}
                    >
                      <View 
                        style={[
                          styles.replyBar, 
                          { backgroundColor: message.replyTo.color }
                        ]} 
                      />
                      <View style={styles.replyContent}>
                        <Text style={styles.replyName}>{message.replyTo.name}</Text>
                        <Text style={styles.replyText}>
                          {truncateReplyText(message.replyTo.msgText)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Render attachments */}
                  {(message as any).attachments && (message as any).attachments.length > 0 && (
                    <View style={styles.attachmentsContainer}>
                      {(message as any).attachments.map((attachment: MessageAttachment) => 
                        renderAttachment(attachment)
                      )}
                    </View>
                  )}

                  {/* Render message text if it exists */}
                  {message.messageText && renderTextWithLinks(message.messageText)}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      </View>
      
      {/* Message Options Modal */}
      <MessageOptionsModal
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        message={message}
        senderName={getSenderName()}
        senderColor={getUserColor()}
        groupId={groupId}
        canWriteChat={canWriteChat}
        isAdmin={currentUserMembership?.role === 'Admin'}
        onDelete={onDelete}
        onPin={onPin}
        onUnpin={onUnpin}
      />

      {/* Image Viewer Modal */}
      {selectedAttachment && selectedAttachment.type === 'image' && (
        <ImageViewer
          visible={showImageViewer}
          imageUrl={selectedAttachment.url}
          fileName={selectedAttachment.fileName}
          onClose={() => {
            setShowImageViewer(false);
            setSelectedAttachment(null);
          }}
        />
      )}

    </>
  );
}

// Memoize MessageItem to prevent unnecessary re-renders
export const MessageItem = memo(MessageItemComponent, (prevProps, nextProps) => {
  // Only re-render if the message content or sender data actually changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.messageText === nextProps.message.messageText &&
    prevProps.message._isPending === nextProps.message._isPending &&
    prevProps.message._isFailed === nextProps.message._isFailed &&
    prevProps.isOwnMessage === nextProps.isOwnMessage &&
    prevProps.canWriteChat === nextProps.canWriteChat &&
    JSON.stringify(prevProps.message.attachments) === JSON.stringify(nextProps.message.attachments) &&
    // Include sender data comparison to re-render when user data loads
    prevProps.senderData?.id === nextProps.senderData?.id &&
    prevProps.senderData?.name === nextProps.senderData?.name &&
    prevProps.senderData?.displayName === nextProps.senderData?.displayName &&
    // Include membership comparison for role/color changes
    prevProps.membership?.role === nextProps.membership?.role &&
    prevProps.membership?.color === nextProps.membership?.color
  );
});

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 5,
    paddingHorizontal: 2,
    position: 'relative',
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  animatedContainer: {
    width: '100%',
  },
  messageBubble: {
    width: messageWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
    borderRadius: 8,
  },
  messageText: {
    marginVertical: 5,
    fontSize: 12,
    lineHeight: 15,
    color: Colors.primaryText,
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
  statusIcon: {
    marginLeft: 4,
  },
  pendingMessage: {
    opacity: 0.7,
  },
  failedMessage: {
    opacity: 0.5,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  
  // Reply styling
  replyContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    backgroundColor: Colors.secondaryBg,
    borderRadius: 8,
    padding: 8,
  },
  replyBar: {
    width: 5,
    marginRight: 8,
    borderRadius: 2,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryText,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: Colors.secondaryText,
    lineHeight: 18,
  },
  
  // User info
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: -14,
    justifyContent: 'space-between',
  },
  userInfoContainerOwn: {
    flexDirection: 'row-reverse',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfoOwn: {
    flexDirection: 'row-reverse',
  },
  userColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  senderName: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  soulMatchEmoji: {
    fontSize: 12,
    marginLeft: 4,
  },
  
  // Attachment styles
  attachmentsContainer: {
    marginVertical: 8,
  },
  imageAttachment: {
    position: 'relative',
    marginBottom: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: '100%',
    minHeight: 150,
    maxHeight: 300,
    borderRadius: 8,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primaryText,
    marginBottom: 2,
  },
  fileDetails: {
    fontSize: 12,
    color: Colors.secondaryText,
  },
  
  // Audio attachment styles
  audioAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginVertical: 4,
    minWidth: 200,
  },
  audioPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  audioInfo: {
    flex: 1,
  },
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  audioLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primaryText,
  },
  audioDuration: {
    fontSize: 12,
    color: Colors.secondaryText,
  },
  audioProgressContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flexGrow: 1
  },
  audioProgressBar: {
    flex: 1,
    width: '80%',
    height: 4,
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  audioCurrentTime: {
    fontSize: 12,
    color: Colors.secondaryText,
    marginTop: 6,
    textAlign: 'right',
  },
  
  // Transcription styles
  transcriptionStatusContainer: {
    alignItems: 'flex-end',
  },
  transcriptionStatus: {
    fontSize: 10,
    color: Colors.secondaryText,
    fontStyle: 'italic',
  },
  transcriptionStatusError: {
    fontSize: 10,
    color: '#FF6B6B',
    fontStyle: 'italic',
  },
  transcriptionContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  transcriptionIcon: {
    fontSize: 12,
    marginRight: 6,
    marginTop: 1,
  },
  transcriptionText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.primaryText,
    fontStyle: 'italic',
  },
  transcriptionNote: {
    fontSize: 10,
    color: Colors.secondaryText,
    marginTop: 4,
    fontStyle: 'italic',
  },
  
  // Link styling
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});