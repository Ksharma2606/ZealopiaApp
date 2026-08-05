import React from 'react';
import NetInfo from '@react-native-community/netinfo';
import { errorService, ErrorType } from './ErrorService';

// Network state interface
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

// Network monitoring service
class NetworkService {
  private static instance: NetworkService;
  private networkState: NetworkState = {
    isConnected: false,
    isInternetReachable: null,
    type: 'unknown',
  };
  private listeners: Set<(state: NetworkState) => void> = new Set();

  private constructor() {
    this.initializeNetworkMonitoring();
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  // Initialize network monitoring
  private initializeNetworkMonitoring(): void {
    NetInfo.addEventListener((state) => {
      const networkState: NetworkState = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      };

      const wasOffline = !this.networkState.isConnected;
      const isNowOnline = networkState.isConnected;

      this.networkState = networkState;

      // Notify listeners of network state change
      this.listeners.forEach(listener => listener(networkState));

      // Log significant network changes
      if (wasOffline && isNowOnline) {
        console.log('Network: Back online');
      } else if (!wasOffline && !isNowOnline) {
        console.log('Network: Gone offline');
      }
    });
  }

  // Get current network state
  public getCurrentState(): NetworkState {
    return { ...this.networkState };
  }

  // Check if device is online
  public isOnline(): boolean {
    return this.networkState.isConnected;
  }

  // Check if internet is reachable
  public isInternetReachable(): boolean {
    return this.networkState.isInternetReachable === true;
  }

  // Add network state listener
  public addListener(listener: (state: NetworkState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Check network before making API requests
  public async checkNetworkAndThrow(): Promise<void> {
    const state = await this.refreshNetworkState();
    
    if (!state.isConnected) {
      throw errorService.createError(
        ErrorType.NETWORK,
        'No internet connection available',
        {
          retryable: true,
          userMessage: 'Please check your internet connection and try again.',
        }
      );
    }

    if (state.isInternetReachable === false) {
      throw errorService.createError(
        ErrorType.NETWORK,
        'Internet is not reachable',
        {
          retryable: true,
          userMessage: 'Unable to reach the internet. Please check your connection.',
        }
      );
    }
  }

  // Refresh network state (useful before critical operations)
  public async refreshNetworkState(): Promise<NetworkState> {
    try {
      const state = await NetInfo.fetch();
      const networkState: NetworkState = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      };
      
      this.networkState = networkState;
      return networkState;
    } catch (error) {
      console.error('Failed to refresh network state:', error);
      return this.networkState;
    }
  }

  // Wait for network connection
  public async waitForConnection(timeoutMs: number = 10000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isOnline()) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeoutMs);

      const unsubscribe = this.addListener((state) => {
        if (state.isConnected) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  // Retry operation when network becomes available
  public async retryWhenOnline<T>(
    operation: () => Promise<T>,
    maxWaitTime: number = 30000
  ): Promise<T> {
    if (this.isOnline()) {
      return operation();
    }

    const isOnline = await this.waitForConnection(maxWaitTime);
    
    if (isOnline) {
      return operation();
    } else {
      throw errorService.createError(
        ErrorType.NETWORK,
        'Network connection timeout',
        {
          retryable: true,
          userMessage: 'Unable to establish network connection. Please try again.',
        }
      );
    }
  }
}

// Export singleton instance
export const networkService = NetworkService.getInstance();

// Utility hook for React components
export const useNetworkState = () => {
  const [networkState, setNetworkState] = React.useState<NetworkState>(
    networkService.getCurrentState()
  );

  React.useEffect(() => {
    const unsubscribe = networkService.addListener(setNetworkState);
    return unsubscribe;
  }, []);

  return {
    ...networkState,
    isOnline: networkState.isConnected,
    isInternetReachable: networkState.isInternetReachable === true,
  };
};

// Decorator for automatic network checking
export const withNetworkCheck = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    await networkService.checkNetworkAndThrow();
    return fn(...args);
  };
};

// Note: This requires @react-native-community/netinfo to be installed
// Add to package.json: "@react-native-community/netinfo": "^11.0.0"