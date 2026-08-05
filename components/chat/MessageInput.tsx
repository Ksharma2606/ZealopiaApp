import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text, Alert, Pressable, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import firestore from '@react-native-firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/context/AuthContext';
import { useChatStore } from '@/lib/stores/chatStore';
import { useGroupChatStore } from '@/lib/stores/groupChatStore';
import { FirebaseChatManager } from '@/lib/services/FirebaseChatManager';
import FileUploadService, { AttachmentData } from '@/lib/services/FileUploadService';
import AudioRecordingService, { AudioRecording } from '@/lib/services/AudioRecordingService';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets } from 'expo-audio';
import * as Audio from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import apiService from '@/lib/services/ApiService';
import Colors from '@/constants/Colors';
import { ImagePreviewModal } from './ImagePreviewModal';

// Exact colors from Flutter Flow theme
const COLORS = {
  primaryButton: '#DD7896',  // Pink border on input
  primary: '#4B39EF',       // Purple accent
  primaryText: '#000000',    // Black text
  secondaryText: '#919191',  // Gray text
};

// Audio recording constants
const MAX_RECORDING_DURATION_SECONDS = 90; // 1 minute 30 seconds

interface MessageInputProps {
  groupId: string;
  canWrite: boolean;
  onMessageSent?: () => void;
}

export function MessageInput({ groupId, canWrite, onMessageSent }: MessageInputProps) {
  const { firebaseUser } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentData[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<AudioRecording | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [previewImage, setPreviewImage] = useState<{ uri: string; attachment?: AttachmentData } | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Audio recording setup
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 500); // Update every 500ms instead of 100ms to reduce re-renders

  // Animation for recording indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Track if we've already triggered auto-stop to prevent duplicate calls
  const hasAutoStopped = useRef(false);
  
  // Use selective Zustand subscriptions to prevent unnecessary re-renders
  const replyingTo = useChatStore(state => state.replyingTo);
  const isReplyingToSet = useChatStore(state => state.isReplyingToSet);
  const currentGroup = useChatStore(state => state.currentGroup);
  
  // Memoize functions to prevent recreating them on every render
  const clearReply = useChatStore(state => state.clearReply);
  const setReplyingTo = useChatStore(state => state.setReplyingTo);
  const addMessage = useChatStore(state => state.addMessage);
  const updateMessageStatus = useChatStore(state => state.updateMessageStatus);
  
  // Get functions from GroupChatStore with memoization
  const markGroupAsRead = useGroupChatStore(state => state.markGroupAsRead);
  const optimisticallyUpdateRecentMessage = useGroupChatStore(state => state.optimisticallyUpdateRecentMessage);

  // Effects
  useEffect(() => {
    if (isRecording) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isRecording]);

  // Auto-stop recording when max duration is reached
  useEffect(() => {
    if (isRecording && recorderState.durationMillis && !hasAutoStopped.current) {
      const currentDurationSeconds = Math.round(recorderState.durationMillis / 1000);

      if (currentDurationSeconds >= MAX_RECORDING_DURATION_SECONDS) {
        console.log('Max recording duration reached, auto-stopping...');
        hasAutoStopped.current = true; // Mark as triggered to prevent duplicate calls

        stopAudioRecording().then(() => {
          Alert.alert(
            'Recording Finished',
            'Recording time limit reached. You can send this audio and record more.',
            [{ text: 'OK', style: 'default' }]
          );
        });
      }
    }
  }, [isRecording, recorderState.durationMillis]);

  // Audio permission check
  const checkAudioPermissions = async () => {
    try {
      const status = await Audio.requestRecordingPermissionsAsync();
      setHasAudioPermission(status.granted);
      
      if (!status.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow microphone access to record audio messages.'
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Permission check failed:', error);
      setHasAudioPermission(false);
      return false;
    }
  };

  // Animation methods
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  // Format recording duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Memoize duration calculation and only update when recording
  const getCurrentDuration = useCallback(() => {
    if (!isRecording) return 0;
    return Math.round((recorderState.durationMillis || 0) / 1000);
  }, [isRecording, recorderState.durationMillis]);

  const handleImagePicker = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return;
      }

      // Launch image picker - ONLY images, no videos
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // Only images, no videos
        allowsEditing: false, // No cropping - use image as-is
        quality: 0.8,
        exif: false,
        allowsMultipleSelection: false, // Only one image at a time
        selectionLimit: 1, // Ensure only one image
      });

      if (!result.canceled && result.assets[0]) {
        // Show preview modal instead of immediately uploading
        setPreviewImage({ uri: result.assets[0].uri });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to open image picker');
    }
  };

  const handleFileUpload = async (fileUri: string, type: 'image' | 'audio' | 'video') => {
    try {
      setIsUploading(true);

      let finalFileUri = fileUri;
      let finalFileName = '';
      let finalFileType = '';
      let finalFileSize = 0;

      if (type === 'image') {
        // Get original image dimensions to calculate resize
        const Image = require('react-native').Image;
        const { width: originalWidth, height: originalHeight } = await new Promise<{width: number, height: number}>((resolve, reject) => {
          Image.getSize(fileUri, 
            (width, height) => resolve({ width, height }),
            reject
          );
        });

        // Calculate resize parameters if image is wider than 1024px
        const maxWidth = 1024;
        let resizeOperations: any[] = [];
        
        if (originalWidth > maxWidth) {
          const aspectRatio = originalHeight / originalWidth;
          const newHeight = Math.round(maxWidth * aspectRatio);
          
          resizeOperations = [{
            resize: {
              width: maxWidth,
              height: newHeight,
            }
          }];
        }

        // Convert image to JPEG format with resize and compression
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          fileUri,
          resizeOperations, // Resize if needed, otherwise empty array
          {
            compress: 0.75, // 75% quality JPEG compression
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        finalFileUri = manipulatedImage.uri;
        
        // Get file info for the converted image
        const fileInfo = await FileUploadService.getFileInfo(finalFileUri);
        
        // Generate a proper JPEG filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        finalFileName = `image_${timestamp}.jpg`; // Always use .jpg extension
        finalFileType = 'image/jpeg'; // Force JPEG MIME type
        finalFileSize = fileInfo.size;
      } else {
        // For non-images, use original file
        const fileInfo = await FileUploadService.getFileInfo(fileUri);
        finalFileName = fileInfo.name;
        finalFileType = fileInfo.type;
        finalFileSize = fileInfo.size;
      }
      
      // Validate file
      const validation = FileUploadService.validateFile(
        finalFileName,
        finalFileSize,
        finalFileType
      );

      if (!validation.isValid) {
        Alert.alert('Invalid File', validation.error);
        return;
      }

      // Get final image dimensions if it's an image
      let width: number | undefined;
      let height: number | undefined;
      
      if (type === 'image') {
        // For images, get dimensions of the final processed image
        const Image = require('react-native').Image;
        const { width: w, height: h } = await new Promise<{width: number, height: number}>((resolve, reject) => {
          Image.getSize(finalFileUri, 
            (width, height) => resolve({ width, height }),
            reject
          );
        });
        width = w;
        height = h;
      }

      // Upload file
      const attachment = await FileUploadService.uploadFile(
        finalFileUri,
        {
          file_name: finalFileName,
          file_size: finalFileSize,
          file_type: finalFileType,
          group_id: groupId,
          width,
          height
        }
      );

      // Store the attachment data for later use
      if (type === 'image') {
        // Update preview with attachment data and send if already in preview mode
        if (previewImage) {
          // If we're already in preview mode, send the image
          await sendImageMessage(attachment);
        } else {
          // This shouldn't happen normally, but handle it just in case
          setPreviewImage({ uri: finalFileUri, attachment });
        }
      } else {
        // For non-images (audio, etc.), keep the existing preview flow
        setAttachments([attachment]);
      }

    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const handleSendPreviewImage = async () => {
    if (!previewImage) return;
    
    setIsProcessingImage(true);
    
    try {
      // If attachment already exists (image was already uploaded), send it
      if (previewImage.attachment) {
        await sendImageMessage(previewImage.attachment);
        setPreviewImage(null);
      } else {
        // Upload and send the image
        await handleFileUpload(previewImage.uri, 'image');
        // Note: sendImageMessage will be called from handleFileUpload
      }
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewImage(null);
    setIsProcessingImage(false);
  };

  const sendImageMessage = async (attachment: AttachmentData) => {
    if (!canWrite || !firebaseUser || !currentGroup) {
      return;
    }

    // Generate temporary ID for optimistic update
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create optimistic message for immediate UI update
    const optimisticMessage = {
      id: tempId,
      messageText: '', // Empty text for image-only messages
      sentAt: new Date(),
      sentBy: firebaseUser.uid,
      status: 'visible' as const,
      isReply: false,
      attachments: [attachment], // Image attachment
      _isPending: true,
      _tempId: tempId,
    };

    // Add message to UI immediately (optimistic update)
    addMessage(optimisticMessage);

    // Optimistically update recent message in chats list
    optimisticallyUpdateRecentMessage(groupId, '📷 Image', firebaseUser.uid);

    // Clear preview after adding to UI
    setPreviewImage(null);

    // Callback for scrolling to bottom
    onMessageSent?.();

    // Send message to Firebase in background
    sendImageToFirebase(tempId, attachment);
  };

  const sendImageToFirebase = async (tempId: string, attachment: AttachmentData) => {
    try {
      // Send image message via FirebaseChatManager
      const messageId = await FirebaseChatManager.sendMessage(
        groupId,
        '', // Empty text for image-only messages
        {
          contentType: 'image',
          attachment: attachment,
        }
      );

      // Update the optimistic message with real ID
      updateMessageStatus(tempId, messageId);

      console.log('Image message sent successfully:', messageId);

      // Mark attachment as uploaded with message_id for transcription linking (non-blocking)
      apiService.markAttachmentUploaded(attachment.id, messageId)
        .then(() => console.log('Marked image attachment as uploaded with message_id'))
        .catch((markError) => console.warn('Failed to mark image attachment with message_id:', markError));

      // Track user activity for streak purposes (non-blocking)
      apiService.trackMessageActivity()
        .then(() => console.log('Message activity tracked for streak'))
        .catch((activityError) => console.log('Activity tracking failed (non-critical):', activityError));

    } catch (error) {
      console.error('Error sending image message:', error);

      // Mark the message as failed
      updateMessageStatus(tempId, undefined, true, error.message || 'Failed to send image message');
    }
  };

  // Start audio recording
  const startAudioRecording = async () => {
    try {
      // Check permissions first
      const hasPermission = await checkAudioPermissions();
      if (!hasPermission) return;

      // Reset auto-stop flag for new recording
      hasAutoStopped.current = false;

      console.log('Starting recording...');
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  // Stop audio recording and enter preview mode
  const stopAudioRecording = async () => {
    try {
      console.log('Stopping recording...');
      await audioRecorder.stop();
      setIsRecording(false);

      const recordingUri = audioRecorder.uri;
      if (!recordingUri) {
        throw new Error('No recording URI available');
      }

      console.log('Recording URI:', recordingUri);

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(recordingUri);
      if (!fileInfo.exists) {
        throw new Error('Recording file does not exist');
      }

      // Get duration from recorder state (in milliseconds, convert to seconds)
      const duration = Math.round((recorderState.durationMillis || 0) / 1000);
      
      console.log('Recording completed:', {
        uri: recordingUri,
        duration,
        fileSize: fileInfo.size || 0
      });

      // Validate minimum duration
      if (duration < 1) {
        Alert.alert('Recording Too Short', 'Please record for at least 1 second.');
        return;
      }

      // Note: Maximum duration is enforced by auto-stop in useEffect
      // This ensures recordings are capped at MAX_RECORDING_DURATION_SECONDS

      // Store the recording for preview instead of sending immediately
      setRecordedAudio({
        uri: recordingUri,
        duration,
        fileSize: fileInfo.size || 0,
      });
      setRecordedDuration(duration);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to save recording. Please try again.');
      setIsRecording(false);
    }
  };

  // Send the recorded audio
  const sendRecordedAudio = async () => {
    if (!recordedAudio) return;
    
    await sendAudioMessage(recordedAudio);
    
    // Clear the recorded audio after sending
    setRecordedAudio(null);
    setRecordedDuration(0);
  };

  // Delete the recorded audio
  const deleteRecordedAudio = () => {
    setRecordedAudio(null);
    setRecordedDuration(0);
  };

  // Send audio message directly
  const sendAudioMessage = async (recording: AudioRecording) => {
    if (!canWrite || !firebaseUser || !currentGroup) {
      return;
    }

    setIsUploading(true);

    try {
      // Generate file name
      const fileName = AudioRecordingService.generateFileName();

      // Upload audio file first
      const attachment = await FileUploadService.uploadFile(
        recording.uri,
        {
          file_name: fileName,
          file_size: recording.fileSize,
          file_type: 'audio/mp4', // m4a is technically mp4 audio
          group_id: groupId,
          duration: recording.duration
        }
      );

      setIsUploading(false);

      // Generate temporary ID for optimistic update
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create optimistic message for immediate UI update
      const optimisticMessage = {
        id: tempId,
        messageText: '', // Empty text for audio-only messages
        sentAt: new Date(),
        sentBy: firebaseUser.uid,
        status: 'visible' as const,
        isReply: false,
        attachments: [attachment], // Audio attachment
        _isPending: true,
        _tempId: tempId,
      };

      // Add message to UI immediately (optimistic update)
      addMessage(optimisticMessage);

      // Optimistically update recent message in chats list
      optimisticallyUpdateRecentMessage(groupId, '🎤 Voice message', firebaseUser.uid);

      // Callback for scrolling to bottom
      onMessageSent?.();

      // Send message to Firebase in background
      sendAudioToFirebase(tempId, attachment);

    } catch (error) {
      console.error('Error uploading audio or sending message:', error);
      setIsUploading(false);
      Alert.alert('Error', 'Failed to send audio message. Please try again.');
    }
  };

  const sendAudioToFirebase = async (tempId: string, attachment: any) => {
    try {
      // Send audio message via FirebaseChatManager
      const messageId = await FirebaseChatManager.sendMessage(
        groupId,
        '', // Empty text for audio-only messages
        {
          contentType: 'audio',
          attachment: attachment,
          audioDuration: attachment.duration,
        }
      );

      // Update the optimistic message with real ID
      updateMessageStatus(tempId, messageId);

      console.log('Audio message sent successfully:', messageId);

      // Mark attachment as uploaded with message_id for transcription linking (non-blocking)
      apiService.markAttachmentUploaded(attachment.id, messageId)
        .then(() => console.log('Marked attachment as uploaded with message_id'))
        .catch((markError) => console.warn('Failed to mark attachment with message_id:', markError));

      // Track user activity for streak purposes (non-blocking)
      apiService.trackMessageActivity()
        .then(() => console.log('Message activity tracked for streak'))
        .catch((activityError) => console.log('Activity tracking failed (non-critical):', activityError));

    } catch (error) {
      console.error('Error sending audio message:', error);

      // Mark the message as failed
      updateMessageStatus(tempId, undefined, true, error.message || 'Failed to send audio message');
    }
  };

  const handleSendMessage = async () => {
    // If we have recorded audio, send that instead
    if (recordedAudio) {
      await sendRecordedAudio();
      return;
    }

    if ((!messageText.trim() && attachments.length === 0) || !canWrite || !firebaseUser || !currentGroup) {
      return;
    }

    // Store the values before clearing
    const messageToSend = messageText.trim();
    const attachmentsToSend = [...attachments];
    const replyToSend = isReplyingToSet ? replyingTo : null;

    // Generate temporary ID for optimistic update
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create optimistic message for immediate UI update
    const optimisticMessage = {
      id: tempId,
      messageText: messageToSend,
      sentAt: new Date(),
      sentBy: firebaseUser.uid,
      status: 'visible' as const,
      isReply: replyToSend !== null,
      ...(attachmentsToSend.length > 0 && { attachments: attachmentsToSend }),
      ...(replyToSend && { replyTo: replyToSend }),
      _isPending: true,
      _tempId: tempId,
    };

    // Add message to UI immediately (optimistic update)
    addMessage(optimisticMessage);

    // Optimistically update recent message in chats list
    optimisticallyUpdateRecentMessage(groupId, messageToSend, firebaseUser.uid);

    // Clear input immediately for better UX - user can type next message right away
    setMessageText('');
    setAttachments([]);
    clearReply();

    // Callback for scrolling to bottom
    onMessageSent?.();

    // Send message to Firebase in background
    sendMessageToFirebase(tempId, messageToSend, attachmentsToSend, replyToSend);
  };

  const sendMessageToFirebase = async (
    tempId: string,
    messageToSend: string,
    attachmentsToSend: any[],
    replyToSend: any
  ) => {
    try {
      // Send message via FirebaseChatManager
      const messageId = await FirebaseChatManager.sendMessage(
        groupId,
        messageToSend,
        {
          contentType: 'text',
          isReply: replyToSend !== null,
          replyTo: replyToSend ? {
            color: replyToSend.color,
            name: replyToSend.name,
            msgText: replyToSend.msgText,
            group_id: replyToSend.group_id,
            messageDocRef: replyToSend.messageDocRef,
          } : undefined,
        }
      );

      // Update the optimistic message with real ID
      updateMessageStatus(tempId, messageId);

      console.log('Message sent successfully:', messageId);

      // Mark attachments as uploaded with message_id for transcription linking
      if (attachmentsToSend.length > 0) {
        Promise.all(
          attachmentsToSend.map(attachment =>
            apiService.markAttachmentUploaded(attachment.id, messageId)
          )
        ).then(() => console.log('Marked attachments as uploaded with message_id'))
          .catch((markError) => console.warn('Failed to mark attachments with message_id:', markError));
      }

      // Track user activity for streak purposes (non-blocking)
      apiService.trackMessageActivity()
        .then(() => console.log('Message activity tracked for streak'))
        .catch((activityError) => console.log('Activity tracking failed (non-critical):', activityError));
    } catch (error) {
      console.error('Error sending message:', error);

      // Mark the message as failed
      updateMessageStatus(tempId, undefined, true, error.message || 'Failed to send message');
    }
  };

  // Memoize character count to prevent excessive calculations
  const characterCount = useMemo(() => {
    return messageText.length;
  }, [messageText]);
  
  const isAtLimit = characterCount >= 500;
  
  // Memoize canSend calculation to prevent infinite re-renders
  const canSend = useMemo(() => {
    const result = (messageText.trim().length > 0 || attachments.length > 0 || recordedAudio !== null) && canWrite && !isUploading && !isRecording;
    return result;
  }, [messageText, attachments.length, recordedAudio, canWrite, isUploading, isRecording]);
  
  const canSendAudio = recordedAudio !== null && canWrite && !isUploading;

  // These useMemo hooks MUST be above the early return to avoid "Rendered fewer hooks than expected" error
  const textInputStyle = useMemo(() => [
    styles.textInput,
    styles.textInputWithAttachment,
    isAtLimit && styles.textInputAtLimit
  ], [isAtLimit]);

  const placeholderText = useMemo(() => {
    if (isRecording) {
      return `Recording... ${formatDuration(getCurrentDuration())} (${formatDuration(MAX_RECORDING_DURATION_SECONDS - getCurrentDuration())} left)`;
    }
    if (recordedAudio) {
      return (isSending || isUploading) ? "Sending voice message..." : `Voice message (${formatDuration(recordedDuration)})`;
    }
    return "Type a message...";
  }, [isRecording, recordedAudio, isSending, isUploading, recordedDuration, getCurrentDuration]);

  const placeholderColor = useMemo(() =>
    isRecording || recordedAudio ? Colors.primary : COLORS.secondaryText,
    [isRecording, recordedAudio]
  );

  if (!canWrite) {
    return (
      <View style={styles.disabledContainer}>
        <Text style={styles.disabledText}>
          You don't have permission to send messages in this chat
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <View style={styles.attachmentPreview}>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentItem}>
              {attachment.type === 'image' ? (
                <Image source={{ uri: attachment.url }} style={styles.attachmentImage} />
              ) : (
                <View style={styles.attachmentIcon}>
                  <Ionicons 
                    name={attachment.type === 'audio' ? 'musical-notes' : 'videocam'} 
                    size={20} 
                    color={Colors.primary} 
                  />
                </View>
              )}
              <View style={styles.attachmentInfo}>
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {attachment.fileName}
                </Text>
                <Text style={styles.attachmentSize}>
                  {attachment.type === 'image' ? 'Image' : attachment.type === 'audio' ? 'Audio' : 'Video'} • {(attachment.fileSize / 1024 / 1024).toFixed(1)} MB
                  {attachment.duration && ` • ${Math.floor(attachment.duration / 60)}:${(attachment.duration % 60).toString().padStart(2, '0')}`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeAttachmentButton}
                onPress={() => removeAttachment(attachment.id)}
              >
                <Ionicons name="close-circle" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputContainer}>
        {/* <Pressable style={styles.flowerButton} onPress={() => {
          Alert.alert('Coming soon');
        }}>
          <Text style={styles.flowerButtonText}>🌸</Text>
        </Pressable> */}
        <View style={styles.attachmentButtons}>
          <Pressable style={styles.attachmentButton} onPress={handleImagePicker} disabled={isUploading}>
            <Ionicons 
              name="image" 
              size={18} 
              color={isUploading ? Colors.secondaryText : Colors.primary} 
            />
          </Pressable>
          <Animated.View style={{ transform: [{ scale: isRecording ? pulseAnim : 1 }] }}>
            <Pressable 
              style={[styles.attachmentButton, styles.audioButton, isRecording && styles.recordingButton]} 
              onPress={startAudioRecording} 
              disabled={isUploading || isRecording || recordedAudio !== null}
            >
              <Ionicons 
                name="mic" 
                size={18} 
                color={isRecording ? Colors.primary : (isUploading || recordedAudio ? Colors.secondaryText : Colors.primary)} 
              />
            </Pressable>
          </Animated.View>
        </View>
        <TextInput
          style={textInputStyle}
          value={isRecording || recordedAudio ? '' : messageText}
          onChangeText={setMessageText}
          placeholder={placeholderText}
          placeholderTextColor={placeholderColor}
          multiline
          maxLength={500}
          textAlignVertical="top"
          returnKeyType="send"
          onSubmitEditing={handleSendMessage}
          editable={!isUploading && !isRecording && !recordedAudio}
        />
        
        {/* Delete button when audio is recorded */}
        {recordedAudio && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={deleteRecordedAudio}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
        
        <View style={styles.sendButtonContainer}>
          {isRecording ? (
            <TouchableOpacity
              style={styles.stopRecordingButton}
              onPress={stopAudioRecording}
            >
              <Ionicons name="stop" size={24} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.sendButton,
                !canSend && styles.sendButtonDisabled
              ]}
              onPress={() => {
                if (!canSend) {
                  return;
                }
                handleSendMessage();
              }}
              disabled={!canSend}
            >
              <Image source={require('@/assets/images/arrow_send.png')} style={styles.sendButtonIcon} resizeMode="contain" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        visible={!!previewImage}
        imageUri={previewImage?.uri || ''}
        onSend={handleSendPreviewImage}
        onCancel={handleCancelPreview}
        isSending={isProcessingImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  attachmentPreview: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  attachmentImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 8,
  },
  attachmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: Colors.secondaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primaryText,
  },
  attachmentSize: {
    fontSize: 12,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  removeAttachmentButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  attachmentButtons: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    gap: 4,
  },
  flowerButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  flowerButtonText: {
    fontSize: 20,
    color: Colors.primary,
  },
  attachmentButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  audioButton: {
    // Additional styles for audio button if needed
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  stopRecordingButton: {
    width: 42,
    height: 42,
    marginTop: -3,
    borderRadius: 22.5,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    position: 'absolute',
    right: 60,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  }, 
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingLeft: 50,
    paddingRight: 50,
    paddingVertical: 10,
    marginRight: 12,
    fontSize: 14,
    color: Colors.primaryText,
    backgroundColor: '#fff',
  },
  textInputWithAttachment: {
    paddingLeft: 70, // Make room for both attachment buttons
  },
  textInputAtLimit: {
    borderColor: Colors.primary,
  },
  sendButtonContainer: {
    position: 'absolute',
    top: 2,
    bottom: 0,
    right: 7,
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
    opacity: 0.9
  },
  counterContainer: {
    alignItems: 'flex-end',
  },
  characterCounter: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  characterCounterAtLimit: {
    color: Colors.primary,
    fontWeight: '600',
  },
  disabledContainer: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  disabledText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
  },
});