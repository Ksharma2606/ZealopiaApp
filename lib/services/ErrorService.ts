import { Alert } from 'react-native';

// Error Types
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  FIREBASE = 'FIREBASE',
  PAYMENT = 'PAYMENT',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code?: string;
  details?: any;
  timestamp: Date;
  retryable: boolean;
  supportContactInfo?: string;
}

export interface ErrorHandlingOptions {
  showAlert?: boolean;
  showToast?: boolean;
  logError?: boolean;
  retryable?: boolean;
  customMessage?: string;
  onRetry?: () => void | Promise<void>;
}

class ErrorService {
  private static instance: ErrorService;

  private constructor() {}

  public static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  // Create standardized error objects
  public createError(
    type: ErrorType,
    message: string,
    options: Partial<AppError> = {}
  ): AppError {
    const userMessage = this.generateUserFriendlyMessage(type, message);
    
    return {
      type,
      severity: options.severity || this.getDefaultSeverity(type),
      message,
      userMessage: options.userMessage || userMessage,
      code: options.code,
      details: options.details,
      timestamp: new Date(),
      retryable: options.retryable ?? this.isRetryableByDefault(type),
      supportContactInfo: options.supportContactInfo,
    };
  }

  // Handle errors with configurable options
  public handleError(
    error: Error | AppError | string,
    options: ErrorHandlingOptions = {}
  ): AppError {
    const appError = this.normalizeError(error);

    // Log error
    if (options.logError !== false) {
      this.logError(appError);
    }

    // Show user feedback
    if (options.showAlert) {
      this.showAlert(appError, options);
    }

    // TODO: Show toast notification when toast library is added
    if (options.showToast) {
      this.showToast(appError);
    }

    return appError;
  }

  // Convert various error types to AppError
  private normalizeError(error: Error | AppError | string): AppError {
    if (typeof error === 'string') {
      return this.createError(ErrorType.UNKNOWN, error);
    }

    if ('type' in error && 'severity' in error) {
      return error as AppError;
    }

    const errorMessage = error.message || 'Unknown error occurred';
    const errorType = this.inferErrorType(errorMessage);

    return this.createError(errorType, errorMessage, {
      details: error,
    });
  }

  // Infer error type from error message or object
  private inferErrorType(message: string): ErrorType {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || 
        lowerMessage.includes('connection') || lowerMessage.includes('timeout')) {
      return ErrorType.NETWORK;
    }

    if (lowerMessage.includes('auth') || lowerMessage.includes('token') || 
        lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
      return ErrorType.AUTHENTICATION;
    }

    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || 
        lowerMessage.includes('required') || lowerMessage.includes('format')) {
      return ErrorType.VALIDATION;
    }

    if (lowerMessage.includes('firebase') || lowerMessage.includes('firestore')) {
      return ErrorType.FIREBASE;
    }

    if (lowerMessage.includes('payment') || lowerMessage.includes('razorpay') || 
        lowerMessage.includes('transaction')) {
      return ErrorType.PAYMENT;
    }

    return ErrorType.UNKNOWN;
  }

  // Generate user-friendly messages
  private generateUserFriendlyMessage(type: ErrorType, originalMessage: string): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Please check your internet connection and try again.';
      case ErrorType.AUTHENTICATION:
        return 'Please log in again to continue.';
      case ErrorType.VALIDATION:
        return '';
      case ErrorType.FIREBASE:
        return 'Unable to sync your data. Please try again.';
      case ErrorType.PAYMENT:
        return 'Payment processing failed. Please try again or contact support.';
      case ErrorType.BUSINESS_LOGIC:
        return originalMessage; // Business logic errors are usually user-friendly
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  // Get default severity based on error type
  private getDefaultSeverity(type: ErrorType): ErrorSeverity {
    switch (type) {
      case ErrorType.AUTHENTICATION:
        return ErrorSeverity.HIGH;
      case ErrorType.PAYMENT:
        return ErrorSeverity.CRITICAL;
      case ErrorType.NETWORK:
        return ErrorSeverity.MEDIUM;
      case ErrorType.FIREBASE:
        return ErrorSeverity.MEDIUM;
      case ErrorType.VALIDATION:
        return ErrorSeverity.LOW;
      case ErrorType.BUSINESS_LOGIC:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  // Determine if error type is retryable by default
  private isRetryableByDefault(type: ErrorType): boolean {
    switch (type) {
      case ErrorType.NETWORK:
      case ErrorType.FIREBASE:
        return true;
      case ErrorType.AUTHENTICATION:
      case ErrorType.VALIDATION:
        return false;
      case ErrorType.PAYMENT:
        return true; // Can retry payment
      case ErrorType.BUSINESS_LOGIC:
        return false; // Usually not retryable
      default:
        return true;
    }
  }

  // Log error with context
  private logError(error: AppError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.type}] ${error.message}`;
    
    console[logLevel]('Error:', {
      type: error.type,
      severity: error.severity,
      message: error.message,
      userMessage: error.userMessage,
      code: error.code,
      timestamp: error.timestamp,
      details: error.details,
    });

    // TODO: Send to crash analytics service in production
    // this.sendToAnalytics(error);
  }

  // Get appropriate console log level
  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'error';
    }
  }

  // Show alert with retry option
  private showAlert(error: AppError, options: ErrorHandlingOptions): void {
    const buttons: any[] = [
      {
        text: 'OK',
        style: 'default',
      }
    ];

    if (error.retryable && options.onRetry) {
      buttons.unshift({
        text: 'Retry',
        onPress: options.onRetry,
      });
    }

    if (error.severity === ErrorSeverity.CRITICAL && error.supportContactInfo) {
      buttons.push({
        text: 'Contact Support',
        onPress: () => this.contactSupport(error),
      });
    }

    Alert.alert(
      this.getAlertTitle(error.type),
      options.customMessage || error.userMessage,
      buttons
    );
  }

  // Get alert title based on error type
  private getAlertTitle(type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Connection Error';
      case ErrorType.AUTHENTICATION:
        return 'Authentication Required';
      case ErrorType.VALIDATION:
        return 'Invalid Input';
      case ErrorType.FIREBASE:
        return 'Sync Error';
      case ErrorType.PAYMENT:
        return 'Payment Error';
      case ErrorType.BUSINESS_LOGIC:
        return 'Action Failed';
      default:
        return 'Error';
    }
  }

  // Placeholder for toast notifications
  private showToast(error: AppError): void {
    // TODO: Implement when toast library is added
    console.log('Toast:', error.userMessage);
  }

  // Contact support functionality
  private contactSupport(error: AppError): void {
    // TODO: Implement support contact (email, in-app chat, etc.)
    console.log('Contact support for error:', error);
  }

  // Utility methods for common error scenarios
  public handleNetworkError(error: any, retryFn?: () => void | Promise<void>): AppError {
    return this.handleError(error, {
      showAlert: true,
      onRetry: retryFn,
    });
  }

  public handleAuthError(error: any): AppError {
    return this.handleError(error, {
      showAlert: true,
      customMessage: 'Your session has expired. Please log in again.',
    });
  }

  public handleValidationError(message: string): AppError {
    return this.handleError(this.createError(ErrorType.VALIDATION, message), {
      showToast: true,
    });
  }

  public handlePaymentError(error: any, paymentId?: string): AppError {
    const paymentError = this.createError(ErrorType.PAYMENT, error.message || 'Payment failed', {
      severity: ErrorSeverity.CRITICAL,
      supportContactInfo: paymentId ? `Payment ID: ${paymentId}` : undefined,
    });

    return this.handleError(paymentError, {
      showAlert: true,
      customMessage: paymentId 
        ? `Payment failed. Please contact support with Payment ID: ${paymentId}`
        : undefined,
    });
  }

  public handleCouponRedemptionError(error: any, couponCode?: string): AppError {
    let errorMessage = 'Failed to redeem coupon';
    let errorType = ErrorType.VALIDATION;
    
    if (error.message) {
      if (error.message.includes('Invalid code') || error.message.includes('Already used')) {
        errorType = ErrorType.VALIDATION;
        errorMessage = error.message;
      } else if (error.message.includes('Server returned') || error.message.includes('parse')) {
        errorType = ErrorType.NETWORK;
        errorMessage = 'Server error while processing coupon. Please try again.';
      } else {
        errorMessage = error.message;
      }
    }

    const couponError = this.createError(errorType, errorMessage, {
      severity: ErrorSeverity.MEDIUM,
      details: { couponCode, originalError: error },
      retryable: errorType === ErrorType.NETWORK,
      supportContactInfo: couponCode ? `Coupon Code: ${couponCode}` : undefined,
    });

    return this.handleError(couponError, {
      showAlert: true,
      logError: true,
    });
  }

  public handleFirebaseError(error: any, retryFn?: () => void | Promise<void>): AppError {
    return this.handleError(this.createError(ErrorType.FIREBASE, error.message || 'Firebase error'), {
      showAlert: false, // Usually shown in UI components
      showToast: true,
      onRetry: retryFn,
    });
  }
}

// Export singleton instance
export const errorService = ErrorService.getInstance();

// Utility functions for common patterns
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  errorOptions: ErrorHandlingOptions = {}
): Promise<{ success: boolean; data?: T; error?: AppError }> => {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const appError = errorService.handleError(error, errorOptions);
    return { success: false, error: appError };
  }
};

export const createRetryableOperation = (
  operation: () => Promise<any>,
  maxRetries: number = 3,
  retryDelay: number = 1000
) => {
  let retryCount = 0;

  const execute = async (): Promise<any> => {
    try {
      return await operation();
    } catch (error) {
      retryCount++;
      
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
        return execute();
      }
      
      throw error;
    }
  };

  return execute;
};