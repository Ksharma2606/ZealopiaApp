import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets } from 'expo-audio';
import * as Audio from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import Colors from '@/constants/Colors';

export interface AudioRecording {
  uri: string;
  duration: number;
  fileSize: number;
}

interface AudioRecorderProps {
  visible: boolean;
  onClose: () => void;
  onRecordingComplete: (recording: AudioRecording) => void;
}

export function AudioRecorder({ visible, onClose, onRecordingComplete }: AudioRecorderProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // Use expo-audio hooks directly as per documentation
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 100); // Update every 100ms

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      checkPermissions();
    }
  }, [visible]);

  useEffect(() => {
    if (isRecording) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isRecording]);

  const checkPermissions = async () => {
    try {
      const status = await Audio.requestRecordingPermissionsAsync();
      setHasPermission(status.granted);
      
      if (!status.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow microphone access to record audio messages.',
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      setHasPermission(false);
    }
  };

  const startRecording = async () => {
    try {
      if (!hasPermission) {
        await checkPermissions();
        return;
      }

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

  const stopRecording = async () => {
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

      const recording: AudioRecording = {
        uri: recordingUri,
        duration,
        fileSize: fileInfo.size || 0,
      };

      onRecordingComplete(recording);
      onClose();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to save recording. Please try again.');
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (isRecording) {
      audioRecorder.stop().catch(console.error);
      setIsRecording(false);
    }
    onClose();
  };

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentDuration = () => {
    return Math.round((recorderState.durationMillis || 0) / 1000);
  };

  if (hasPermission === false) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Microphone Permission Required</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={Colors.primaryText} />
              </TouchableOpacity>
            </View>
            <Text style={styles.permissionText}>
              Please grant microphone access in your device settings to record audio messages.
            </Text>
            <TouchableOpacity style={styles.button} onPress={checkPermissions}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Voice Message</Text>
            <TouchableOpacity style={styles.closeButton} onPress={cancelRecording}>
              <Ionicons name="close" size={24} color={Colors.primaryText} />
            </TouchableOpacity>
          </View>

          <View style={styles.recordingArea}>
            <Animated.View style={[styles.recordButton, { transform: [{ scale: pulseAnim }] }]}>
              <TouchableOpacity
                style={[
                  styles.recordButtonInner,
                  isRecording ? styles.recordButtonRecording : styles.recordButtonIdle,
                ]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={hasPermission === null}
              >
                <Ionicons
                  name={isRecording ? "stop" : "mic"}
                  size={40}
                  color="white"
                />
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.instruction}>
              {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
            </Text>

            {isRecording && (
              <View style={styles.recordingStatus}>
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording</Text>
                </View>
                <Text style={styles.durationText}>
                  {formatDuration(getCurrentDuration())}
                </Text>
              </View>
            )}
          </View>

          {isRecording && (
            <TouchableOpacity style={styles.cancelButton} onPress={cancelRecording}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primaryText,
  },
  closeButton: {
    padding: 4,
  },
  recordingArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  recordButton: {
    marginBottom: 16,
  },
  recordButtonInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonIdle: {
    backgroundColor: Colors.primary,
  },
  recordButtonRecording: {
    backgroundColor: '#FF6B6B',
  },
  instruction: {
    fontSize: 16,
    color: Colors.primaryText,
    textAlign: 'center',
    marginBottom: 16,
  },
  recordingStatus: {
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.primaryText,
  },
  cancelButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: Colors.secondaryBg,
  },
  cancelButtonText: {
    fontSize: 16,
    color: Colors.primaryText,
    fontWeight: '500',
  },
  permissionText: {
    fontSize: 16,
    color: Colors.primaryText,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});