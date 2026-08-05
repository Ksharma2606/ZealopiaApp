import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Colors from '@/constants/Colors';

interface AudioPlayerProps {
  visible: boolean;
  audioUrl: string;
  fileName?: string;
  duration?: number;
  onClose: () => void;
}

export function AudioPlayer({ visible, audioUrl, fileName, duration, onClose }: AudioPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Create audio player using expo-audio hook - start with no source
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Load audio when modal opens
  useEffect(() => {
    if (visible && audioUrl) {
      console.log('Loading audio URL:', audioUrl);
      setIsLoading(true);
      
      try {
        // Replace audio source
        player.replace({ uri: audioUrl });
        
        // Set a timeout to stop loading if it takes too long
        const timeout = setTimeout(() => {
          console.warn('Audio loading timeout');
          setIsLoading(false);
          Alert.alert('Error', 'Audio file took too long to load. Please check your connection.');
        }, 10000); // 10 second timeout
        
        setLoadTimeout(timeout);
        
        // Clear timeout when component unmounts or modal closes
        return () => {
          if (timeout) clearTimeout(timeout);
        };
      } catch (error) {
        console.error('Error replacing audio source:', error);
        setIsLoading(false);
        Alert.alert('Error', 'Failed to load audio file');
      }
    }
  }, [visible, audioUrl]);

  // Update loading state based on player status
  useEffect(() => {
    console.log('Audio player status:', {
      isLoaded: status.isLoaded,
      playing: status.playing,
      currentTime: status.currentTime,
      duration: status.duration,
      id: status.id
    });
    
    if (status.isLoaded) {
      setIsLoading(false);
      // Clear the timeout when audio loads successfully
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        setLoadTimeout(null);
      }
    }
  }, [status.isLoaded, status.playing, status.currentTime]);

  const togglePlayback = () => {
    try {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const handleClose = () => {
    try {
      if (status.playing) {
        player.pause();
      }
      // Reset position to beginning
      player.seekTo(0);
    } catch (error) {
      console.warn('Error cleaning up audio player:', error);
    }
    onClose();
  };

  const totalDuration = status.duration || duration || 0;
  const currentPosition = status.currentTime || 0;
  const progressPercentage = totalDuration > 0 ? (currentPosition / totalDuration) * 100 : 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Audio Player</Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={24} color={Colors.primaryText} />
              </TouchableOpacity>
            </View>

            {/* Audio Info */}
            <View style={styles.audioInfo}>
              <View style={styles.audioIcon}>
                <Ionicons name="musical-notes" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.fileName} numberOfLines={2}>
                {fileName || 'Audio Message'}
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: `${progressPercentage}%` }]} 
                />
              </View>
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>
                <Text style={styles.timeText}>{formatTime(totalDuration)}</Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={[styles.playButton, (isLoading || !status.isLoaded) && styles.playButtonDisabled]}
                onPress={togglePlayback}
                disabled={isLoading || !status.isLoaded}
              >
                {isLoading || !status.isLoaded ? (
                  <Ionicons name="hourglass" size={32} color="white" />
                ) : (
                  <Ionicons 
                    name={status.playing ? "pause" : "play"} 
                    size={32} 
                    color="white" 
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
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
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primaryText,
  },
  closeButton: {
    padding: 4,
  },
  audioInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  audioIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.secondaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primaryText,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.secondaryBg,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
    color: Colors.secondaryText,
  },
  controls: {
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonDisabled: {
    backgroundColor: Colors.secondaryText,
  },
});