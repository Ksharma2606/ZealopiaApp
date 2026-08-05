import RazorpayCheckout from 'react-native-razorpay';

interface RazorpayOptions {
  description: string;
  image?: string;
  currency: string;
  key: string;
  amount: number; // in paise (multiply by 100)
  name: string;
  order_id?: string; // Add order_id support
  prefill: {
    email: string;
    contact: string;
    name: string;
  };
  theme: {
    color: string;
  };
}

interface PaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface PaymentErrorResponse {
  code: string;
  description: string;
  source: string;
  step: string;
  reason: string;
  metadata: {
    order_id?: string;
    payment_id?: string;
  };
}

class RazorpayService {
  // Razorpay keys from Flutter app
  private readonly RAZORPAY_TEST_KEY = 'rzp_test_0pOlF9ugdlUzwM';
  private readonly RAZORPAY_LIVE_KEY = 'rzp_live_nq2t7ZRPLRfIQt';
  private readonly BUSINESS_NAME = 'Zealopia Technologies Private Limited';
  
  // Use test key for now - switch to live in production
  private readonly isTestMode = false;
  
  private getRazorpayKey(): string {
    // return this.RAZORPAY_TEST_KEY;
    return this.RAZORPAY_LIVE_KEY;
    return this.isTestMode ? this.RAZORPAY_TEST_KEY : this.RAZORPAY_LIVE_KEY;
  }

  async processPayment(
    amount: number, // in rupees
    description: string,
    userEmail: string,
    userContact: string,
    userName: string,
    orderId?: string
  ): Promise<{ success: boolean; paymentId?: string; orderId?: string; signature?: string; error?: string }> {
    try {
      const options: RazorpayOptions = {
        description,
        image: 'https://zealopia.in/logo.png', // Add your logo URL
        currency: 'INR',
        key: this.getRazorpayKey(),
        amount: amount * 100, // Convert to paise
        name: this.BUSINESS_NAME,
        prefill: {
          email: userEmail,
          contact: userContact,
          name: userName,
        },
        theme: {
          color: '#FFD700', // Zealopia gold color
        },
      };

      // Add order_id if provided
      if (orderId) {
        options.order_id = orderId;
      }

      console.log('Opening Razorpay checkout with options:', {
        ...options,
        key: options.key.substring(0, 10) + '...' // Log partial key for security
      });

      const response = await RazorpayCheckout.open(options);
      
      console.log('Razorpay response:', response);
      
      return {
        success: true,
        paymentId: response.razorpay_payment_id,
        orderId: response.razorpay_order_id,
        signature: response.razorpay_signature,
      };
    } catch (error: any) {
      console.error('Razorpay payment error:', error);
      
      // Handle user cancellation
      if (error.code === 'PAYMENT_CANCELLED' || error.code === 2) {
        return {
          success: false,
          error: 'Payment was cancelled',
        };
      }
      
      // Handle payment failure
      return {
        success: false,
        error: error.description || 'Payment failed. Please try again.',
      };
    }
  }

  async processGroupJoinPayment(
    groupId: number,
    groupName: string,
    amount: number,
    userEmail: string,
    userContact: string,
    userName: string,
    userUid: string,
    orderId?: string
  ): Promise<{ success: boolean; paymentId?: string; orderId?: string; signature?: string; error?: string }> {
    const description = `Joining Group(${groupId}) for User(${userContact},${userEmail},${userUid})`;
    
    return this.processPayment(
      amount,
      description,
      userEmail,
      userContact,
      userName,
      orderId
    );
  }
}

export default new RazorpayService();