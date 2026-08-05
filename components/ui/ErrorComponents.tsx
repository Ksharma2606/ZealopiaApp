import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppError, ErrorType, ErrorSeverity } from '../../lib/services/ErrorService';
import { colors, radii, shadows, spacing } from '@/theme';

// Error Banner for inline error display
interface ErrorBannerProps {
  error: string | AppError;
  onDismiss?: () => void;
  style?: ViewStyle;
  dismissible?: boolean;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onDismiss,
  style,
  dismissible = true,
}) => {
  const errorMessage = typeof error === 'string' ? error : error.userMessage;
  const errorType = typeof error === 'string' ? ErrorType.UNKNOWN : error.type;

  const getBackgroundColor = () => {
    switch (errorType) {
      case ErrorType.NETWORK:
        return colors.feedback.warning;
      case ErrorType.AUTHENTICATION:
        return colors.feedback.danger;
      case ErrorType.VALIDATION:
        return colors.feedback.warning;
      case ErrorType.PAYMENT:
        return colors.feedback.danger;
      default:
        return colors.feedback.danger;
    }
  };

  return (
    <View style={[styles.errorBanner, { backgroundColor: getBackgroundColor() }, style]}>
      <Ionicons 
        name={getErrorIcon(errorType)} 
        size={20} 
        color={colors.text.inverse}
        style={styles.errorIcon}
      />
      <Text style={styles.errorBannerText} numberOfLines={2}>
        {errorMessage}
      </Text>
      {dismissible && onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={20} color={colors.text.inverse} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Full-screen error state for when entire screen fails to load
interface ErrorStateProps {
  error: string | AppError;
  onRetry?: () => void;
  retryLoading?: boolean;
  illustration?: 'network' | 'general' | 'empty';
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onRetry,
  retryLoading = false,
  illustration = 'general',
  style,
}) => {
  const errorObj = typeof error === 'string' 
    ? { userMessage: error, type: ErrorType.UNKNOWN, retryable: true }
    : error;

  const getIllustrationIcon = () => {
    switch (illustration) {
      case 'network':
        return 'wifi-outline';
      case 'empty':
        return 'documents-outline';
      default:
        return 'alert-circle-outline';
    }
  };

  const getIllustrationColor = () => {
    switch (errorObj.type) {
      case ErrorType.NETWORK:
        return colors.feedback.warning;
      case ErrorType.AUTHENTICATION:
        return colors.feedback.danger;
      default:
        return colors.text.muted;
    }
  };

  return (
    <View style={[styles.errorStateContainer, style]}>
      <Ionicons 
        name={getIllustrationIcon()} 
        size={80} 
        color={getIllustrationColor()}
        style={styles.errorIllustration}
      />
      <Text style={styles.errorStateTitle}>
        {getErrorTitle(errorObj.type)}
      </Text>
      <Text style={styles.errorStateMessage}>
        {errorObj.userMessage}
      </Text>
      {errorObj.retryable && onRetry && (
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={onRetry}
          disabled={retryLoading}
        >
          {retryLoading ? (
            <ActivityIndicator color={colors.text.inverse} size="small" />
          ) : (
            <Text style={styles.retryButtonText}>Try Again</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

// Inline error message for form fields
interface ErrorMessageProps {
  message: string;
  style?: TextStyle;
  icon?: boolean;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  style,
  icon = true,
}) => {
  return (
    <View style={styles.errorMessageContainer}>
      {icon && (
        <Ionicons 
          name="alert-circle" 
          size={16} 
          color={colors.feedback.danger}
          style={styles.errorMessageIcon}
        />
      )}
      <Text style={[styles.errorMessageText, style]}>
        {message}
      </Text>
    </View>
  );
};

// Loading state with error fallback
interface LoadingWithErrorProps {
  loading: boolean;
  error: string | AppError | null;
  onRetry?: () => void;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
}

export const LoadingWithError: React.FC<LoadingWithErrorProps> = ({
  loading,
  error,
  onRetry,
  children,
  loadingComponent,
  errorComponent,
}) => {
  if (error) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.gold} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return <>{children}</>;
};

// Retry button component
interface RetryButtonProps {
  onRetry: () => void;
  loading?: boolean;
  text?: string;
  style?: ViewStyle;
  size?: 'small' | 'medium' | 'large';
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry,
  loading = false,
  text = 'Retry',
  style,
  size = 'medium',
}) => {
  const getButtonStyle = () => {
    switch (size) {
      case 'small':
        return styles.retryButtonSmall;
      case 'large':
        return styles.retryButtonLarge;
      default:
        return styles.retryButton;
    }
  };

  const getTextStyle = () => {
    switch (size) {
      case 'small':
        return styles.retryButtonTextSmall;
      case 'large':
        return styles.retryButtonTextLarge;
      default:
        return styles.retryButtonText;
    }
  };

  return (
    <TouchableOpacity 
      style={[getButtonStyle(), style]} 
      onPress={onRetry}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={colors.text.inverse} size="small" />
      ) : (
        <>
          <Ionicons name="refresh" size={16} color={colors.text.inverse} style={styles.retryIcon} />
          <Text style={getTextStyle()}>{text}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// Helper functions
const getErrorIcon = (type: ErrorType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case ErrorType.NETWORK:
      return 'wifi-outline';
    case ErrorType.AUTHENTICATION:
      return 'lock-closed-outline';
    case ErrorType.VALIDATION:
      return 'information-circle-outline';
    case ErrorType.PAYMENT:
      return 'card-outline';
    case ErrorType.FIREBASE:
      return 'cloud-offline-outline';
    default:
      return 'alert-circle-outline';
  }
};

const getErrorTitle = (type: ErrorType): string => {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Connection Problem';
    case ErrorType.AUTHENTICATION:
      return 'Authentication Required';
    case ErrorType.VALIDATION:
      return 'Invalid Input';
    case ErrorType.PAYMENT:
      return 'Payment Failed';
    case ErrorType.FIREBASE:
      return 'Sync Problem';
    case ErrorType.BUSINESS_LOGIC:
      return 'Action Failed';
    default:
      return 'Something Went Wrong';
  }
};

const styles = StyleSheet.create({
  // Error Banner Styles
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.xxl,
    marginVertical: spacing.sm,
    borderRadius: radii.small,
    ...shadows.raised,
  },
  errorIcon: {
    marginRight: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '500',
  },
  dismissButton: {
    padding: spacing.xxs,
    marginLeft: spacing.sm,
  },

  // Error State Styles
  errorStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.huge,
    backgroundColor: colors.surface.default,
  },
  errorIllustration: {
    marginBottom: spacing.huge,
  },
  errorStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorStateMessage: {
    fontSize: 16,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.huge,
    lineHeight: 22,
  },

  // Error Message Styles
  errorMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
    marginBottom: spacing.sm,
  },
  errorMessageIcon: {
    marginRight: spacing.xs,
  },
  errorMessageText: {
    fontSize: 14,
    color: colors.feedback.danger,
    flex: 1,
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.huge,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.muted,
  },

  // Retry Button Styles
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.gold,
    paddingHorizontal: spacing.huge,
    paddingVertical: spacing.md,
    borderRadius: radii.small,
    ...shadows.navigation,
  },
  retryButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.gold,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
    borderRadius: radii.compact,
  },
  retryButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.gold,
    paddingHorizontal: spacing.oversized,
    paddingVertical: spacing.xxl,
    borderRadius: radii.medium,
    ...shadows.navigation,
  },
  retryIcon: {
    marginRight: spacing.sm,
  },
  retryButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  retryButtonTextSmall: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  retryButtonTextLarge: {
    color: colors.text.inverse,
    fontSize: 18,
    fontWeight: '600',
  },
});
