// User Profile Types
export interface UserProfile {
  id: number;
  name: string;
  birth_year?: number;
  status: string;
  user: number;
  profile_picture?: string;
  created_at: string;
  updated_at: string;
  pronouns?: string;
  is_signup_completed: boolean;
  credit_balance: number;
  referral_code?: string;
  num_of_free_groups: number;
}

// Credit System Types
export interface CreditTransaction {
  title: string;
  description: string;
  amount_str: string;
  dt: string;
  type: 'credit' | 'debit';
}

export interface CreditDetail {
  credit_balance: number;
  expiring_text: string;
  credit_transactions: CreditTransaction[];
}

// Coupon Types
export interface CouponRedemption {
  coupon_code: string;
  is_referral?: boolean;
}

export interface CouponResponse {
  success: boolean;
  message: string;
  credits?: number;
}