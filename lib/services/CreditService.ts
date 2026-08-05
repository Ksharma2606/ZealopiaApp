import { create } from 'zustand';
import apiService from './ApiService';
import { errorService, AppError, ErrorType } from './ErrorService';

// Types
export interface CreditTransaction {
  title: string;
  description: string;
  amount_str: string;
  dt: string;
  type: string;
}

export interface CreditDetail {
  credit_balance: number;
  expiring_text: string;
  credit_transactions: CreditTransaction[];
}

// Zustand store for credit state
interface CreditStore {
  creditBalance: number;
  expiringText: string;
  creditTransactions: CreditTransaction[];
  isLoading: boolean;
  error: AppError | null;
  
  // Actions
  fetchCreditDetails: () => Promise<void>;
  redeemCoupon: (couponCode: string, isReferral?: boolean) => Promise<{ success: boolean; message: string }>;
  calculateMaxCreditsUsable: (groupCost: number) => number;
  calculatePaymentAmount: (groupCost: number, creditsToUse: number) => number;
  resetError: () => void;
}

export const useCreditStore = create<CreditStore>((set, get) => ({
  creditBalance: 0,
  expiringText: '',
  creditTransactions: [],
  isLoading: false,
  error: null,

  fetchCreditDetails: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await apiService.getCreditDetailsWithRetry(3);
      
      if (response.success && response.data) {
        set({
          creditBalance: response.data.credit_balance,
          expiringText: response.data.expiring_text,
          creditTransactions: response.data.credit_transactions,
          isLoading: false,
        });
      } else {
        const appError = response.appError || errorService.createError(
          ErrorType.NETWORK,
          response.error || 'Failed to fetch credit details',
          { retryable: true }
        );
        set({ error: appError, isLoading: false });
      }
    } catch (error) {
      const appError = errorService.handleError(error, { logError: true, showAlert: false });
      set({ error: appError, isLoading: false });
    }
  },

  redeemCoupon: async (couponCode: string, isReferral: boolean = false) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await apiService.redeemCoupon(couponCode, isReferral);
      
      if (response.success && response.data) {
        // Refresh credit details after successful redemption
        if (response.data.success) {
          await get().fetchCreditDetails();
        }
        
        set({ isLoading: false });
        
        return {
          success: response.data.success,
          message: response.data.message,
        };
      } else {
        const appError = response.appError || errorService.handleCouponRedemptionError(
          { message: response.error || 'Failed to redeem coupon' },
          couponCode
        );
        set({ error: appError, isLoading: false });
        return {
          success: false,
          message: appError.userMessage,
        };
      }
    } catch (error) {
      const appError = errorService.handleCouponRedemptionError(error, couponCode);
      set({ error: appError, isLoading: false });
      return {
        success: false,
        message: appError.userMessage,
      };
    }
  },

  calculateMaxCreditsUsable: (groupCost: number) => {
    const { creditBalance } = get();
    return Math.min(creditBalance, groupCost);
  },

  calculatePaymentAmount: (groupCost: number, creditsToUse: number) => {
    return Math.max(0, groupCost - creditsToUse);
  },

  resetError: () => {
    set({ error: null });
  },
}));

// Utility functions for credit calculations
export const CreditCalculator = {
  // Calculate maximum credits that can be used for a group
  getMaxCreditsUsable: (creditBalance: number, groupCost: number): number => {
    return Math.min(creditBalance, groupCost);
  },

  // Calculate payment amount after applying credits
  getPaymentAmount: (groupCost: number, creditsUsed: number): number => {
    return Math.max(0, groupCost - creditsUsed);
  },

  // Format credit amount for display
  formatCreditAmount: (amount: number): string => {
    return `${amount} ZC`;
  },

  // Format credit amount with rupee equivalent
  formatCreditWithRupee: (amount: number): string => {
    return `${amount} ZC (₹${amount})`;
  },

  // Validate credit usage
  isValidCreditUsage: (creditsToUse: number, maxCreditsUsable: number): boolean => {
    return creditsToUse >= 0 && creditsToUse <= maxCreditsUsable;
  },
};

export default useCreditStore;