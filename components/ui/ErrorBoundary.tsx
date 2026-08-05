import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { errorService, ErrorType, AppError } from '../../lib/services/ErrorService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: AppError) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: AppError | null;
  resetTimeoutId: number | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      resetTimeoutId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Convert JavaScript error to AppError
    const appError = errorService.createError(
      ErrorType.UNKNOWN,
      error.message || 'An unexpected error occurred',
      {
        details: { originalError: error, stack: error.stack },
        retryable: true,
      }
    );

    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const appError = this.state.error;
    
    if (appError) {
      // Log the error
      errorService.handleError(appError, {
        logError: true,
        showAlert: false,
      });

      // Call onError callback if provided
      if (this.props.onError) {
        this.props.onError(appError);
      }
    }

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError, resetTimeoutId } = this.state;

    // Reset error state if specified props change
    if (
      hasError &&
      prevProps.resetKeys !== resetKeys &&
      (resetOnPropsChange || resetKeys)
    ) {
      if (resetKeys) {
        const hasResetKeyChanged = resetKeys.some(
          (key, index) => prevProps.resetKeys?.[index] !== key
        );
        
        if (hasResetKeyChanged) {
          this.resetError();
        }
      } else if (resetOnPropsChange) {
        this.resetError();
      }
    }

    // Clear existing reset timeout if new error occurs
    if (hasError && !prevProps.children && resetTimeoutId) {
      clearTimeout(resetTimeoutId);
      this.setState({ resetTimeoutId: null });
    }
  }

  componentWillUnmount() {
    if (this.state.resetTimeoutId) {
      clearTimeout(this.state.resetTimeoutId);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      resetTimeoutId: null,
    });
  };

  handleRetry = () => {
    this.resetError();
    
    // Set a timeout to auto-reset if the same error occurs quickly
    const timeoutId = window.setTimeout(() => {
      this.setState({ resetTimeoutId: null });
    }, 5000);
    
    this.setState({ resetTimeoutId: timeoutId });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <Ionicons 
              name="alert-circle-outline" 
              size={64} 
              color="#FF6B6B" 
              style={styles.errorIcon}
            />
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorMessage}>
              {error.userMessage || 'An unexpected error occurred'}
            </Text>
            
            {error.retryable && (
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={this.handleRetry}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" style={styles.retryIcon} />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => {
                // You could navigate to a safe screen here
                console.log('Navigate to safe screen');
              }}
            >
              <Text style={styles.secondaryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return children;
  }
}

// Hook version for functional components
export const useErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
};

// HOC for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  errorIcon: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
});