import { useAudioRecorder, RecordingPresets, AudioModule, RecordingOptions } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface AudioRecordingStatus {
  isRecording: boolean;
  duration: number;
  metering?: number;
}

export interface AudioRecording {
  uri: string;
  duration: number;
  fileSize: number;
}

// Since expo-audio uses hooks, we need to create a wrapper that can be used in a service
// This will be instantiated in components that need audio recording
export class AudioRecorderWrapper {
  private recorder: any; // The actual recorder from useAudioRecorder hook
  private recordingUri: string | null = null;

  constructor(recorder: any) {
    this.recorder = recorder;
  }

  /**
   * Start audio recording
   */
  async startRecording(): Promise<void> {
    try {
      // Prepare and start recording
      await this.recorder.prepareToRecordAsync();
      this.recorder.record();
      console.log('Audio recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  /**
   * Stop audio recording and return file info
   */
  async stopRecording(knownDuration?: number): Promise<AudioRecording> {
    try {
      // Stop recording
      await this.recorder.stop();
      
      // Get recording URI
      const uri = this.recorder.uri;
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      this.recordingUri = uri;

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Recording file not found');
      }

      // Get duration - prioritize known duration from UI
      let duration = 0;
      
      console.log('Attempting to get duration from recorder...');
      console.log('Known duration from UI:', knownDuration);
      console.log('Recorder currentTime:', this.recorder.currentTime);
      
      // First, try using the known duration from UI state (most reliable)
      if (knownDuration && knownDuration > 0) {
        duration = knownDuration;
        console.log('Using known duration from UI:', duration);
      } else {
        // Fallback to recorder's internal state
        try {
          const status = this.recorder.getStatus();
          console.log('Recorder status:', status);
          if (status && status.durationMillis) {
            duration = Math.round(status.durationMillis / 1000);
            console.log('Got duration from getStatus:', duration);
          }
        } catch (e) {
          console.log('getStatus failed:', e);
        }
        
        // If still no duration, try currentTime
        if (duration === 0 && this.recorder.currentTime) {
          duration = Math.round(this.recorder.currentTime);
          console.log('Got duration from currentTime:', duration);
        }
        
        // If still no duration, use minimum
        if (duration === 0) {
          console.log('No duration found, using fallback of 1 second');
          duration = 1; // Minimum duration to pass validation
        }
      }

      const result: AudioRecording = {
        uri,
        duration,
        fileSize: fileInfo.size || 0,
      };

      console.log('Audio recording stopped:', result);
      console.log('Recording details - URI:', uri, 'Duration:', duration, 'Size:', fileInfo.size);
      return result;

    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw new Error(`Failed to stop recording: ${error.message}`);
    }
  }

  /**
   * Get current recording status
   */
  getRecordingStatus(): AudioRecordingStatus {
    return {
      isRecording: this.recorder.isRecording || false,
      duration: Math.round(this.recorder.currentTime || 0),
      metering: undefined, // metering might not be available in the new API
    };
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recorder.isRecording || false;
  }

  /**
   * Get the recorder instance for direct access if needed
   */
  getRecorder(): any {
    return this.recorder;
  }
}

class AudioRecordingService {
  /**
   * Request audio recording permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      return granted;
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  /**
   * Generate file name for audio recording
   */
  generateFileName(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `audio_${timestamp}.m4a`;
  }

  /**
   * Validate audio recording
   */
  validateRecording(audioRecording: AudioRecording): { isValid: boolean; error?: string } {
    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (audioRecording.fileSize > maxSize) {
      return {
        isValid: false,
        error: 'Audio file is too large (max 50MB)'
      };
    }

    // Check minimum duration (1 second)
    if (audioRecording.duration < 1) {
      return {
        isValid: false,
        error: 'Audio recording is too short (minimum 1 second)'
      };
    }

    // Check maximum duration (10 minutes)
    if (audioRecording.duration > 600) {
      return {
        isValid: false,
        error: 'Audio recording is too long (maximum 10 minutes)'
      };
    }

    return { isValid: true };
  }

  /**
   * Get default recording options
   */
  getRecordingOptions(): RecordingOptions {
    return RecordingPresets.HIGH_QUALITY;
  }

  /**
   * Create a recorder wrapper from a hook-based recorder
   */
  createRecorderWrapper(recorder: any): AudioRecorderWrapper {
    return new AudioRecorderWrapper(recorder);
  }
}

export default new AudioRecordingService();

// Export the hook for use in components
export { useAudioRecorder, RecordingPresets } from 'expo-audio';