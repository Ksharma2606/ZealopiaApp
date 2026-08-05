import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = '@zealopia_device_id';

export class DeviceUtils {
  private static deviceId: string | null = null;

  /**
   * Gets the unique device ID. Creates one if it doesn't exist.
   * This ID persists across app launches, user sessions, and app reinstalls (unless storage is cleared).
   */
  static async getDeviceId(): Promise<string> {
    // Return cached ID if already loaded
    if (DeviceUtils.deviceId) {
      console.log('[DeviceUtils] Using cached device ID:', DeviceUtils.deviceId);
      return DeviceUtils.deviceId;
    }

    try {
      // Try to get existing device ID from storage
      const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

      if (storedDeviceId) {
        console.log('[DeviceUtils] Found existing device ID:', storedDeviceId);
        DeviceUtils.deviceId = storedDeviceId;
        return storedDeviceId;
      }

      // Generate new device ID if none exists
      console.log('[DeviceUtils] No device ID found, generating new one...');
      const newDeviceId = await DeviceUtils.generateDeviceId();

      // Store the new device ID
      await AsyncStorage.setItem(DEVICE_ID_KEY, newDeviceId);
      console.log('[DeviceUtils] Generated and stored new device ID:', newDeviceId);

      // Cache it
      DeviceUtils.deviceId = newDeviceId;

      return newDeviceId;
    } catch (error) {
      console.error('[DeviceUtils] Error getting/creating device ID:', error);

      // Fallback: generate a device ID without storing it
      const fallbackId = await DeviceUtils.generateDeviceId();
      DeviceUtils.deviceId = fallbackId;
      return fallbackId;
    }
  }

  /**
   * Generates a new unique device ID using crypto and platform info
   */
  private static async generateDeviceId(): Promise<string> {
    try {
      // Create a UUID v4 using expo-crypto
      const uuid = Crypto.randomUUID();

      // Add platform and timestamp for additional uniqueness
      const platform = Platform.OS;
      const timestamp = Date.now();

      // Combine into a unique device identifier
      const deviceString = `${platform}_${timestamp}_${uuid}`;

      // Create a hash for a cleaner ID
      const deviceId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        deviceString,
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      // Take first 32 characters for a reasonable length
      return deviceId.substring(0, 32);
    } catch (error) {
      console.error('[DeviceUtils] Error generating device ID with crypto, using fallback:', error);

      // Fallback method using Math.random and timestamp
      const randomString = Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now().toString(36);
      const platform = Platform.OS;

      return `${platform}_${timestamp}_${randomString}`;
    }
  }

  /**
   * Clears the device ID (for testing purposes only - don't use in production)
   */
  static async clearDeviceId(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DEVICE_ID_KEY);
      DeviceUtils.deviceId = null;
      console.log('[DeviceUtils] Device ID cleared');
    } catch (error) {
      console.error('[DeviceUtils] Error clearing device ID:', error);
    }
  }

  /**
   * Initialize device ID on app launch
   */
  static async initialize(): Promise<void> {
    try {
      const deviceId = await DeviceUtils.getDeviceId();
      console.log('[DeviceUtils] Initialized with device ID:', deviceId);
    } catch (error) {
      console.error('[DeviceUtils] Error initializing device utils:', error);
    }
  }
}