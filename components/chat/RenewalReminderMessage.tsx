import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageData, ExtensionOption, useChatStore } from '@/lib/stores/chatStore';
import { useAuth } from '@/lib/context/AuthContext';
import apiService from '@/lib/services/ApiService';
import razorpayService from '@/lib/services/RazorpayService';
import { useCreditStore, CreditCalculator } from '@/lib/services/CreditService';
import Colors from '@/constants/Colors';
import Gradients from '@/constants/Gradients';

interface RenewalReminderMessageProps {
  message: MessageData;
  groupId: string;
}

const { width } = Dimensions.get('window');
const messageWidth = width * 0.75;

export function RenewalReminderMessage({ message, groupId }: RenewalReminderMessageProps) {
  const { backendUser } = useAuth();
  const { membershipExpiryStatus, setMembershipExpiryStatus } = useChatStore();
  const { creditBalance, fetchCreditDetails } = useCreditStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const metadata = message.messageMetadata;
  const extensionOptions: ExtensionOption[] = metadata?.extensionOptions || [
    { months: 1, price: 5000, label: '1 Month' },
    { months: 3, price: 10000, label: '3 Months' },
  ];

  // Fetch credit details when component mounts
  useEffect(() => {
    fetchCreditDetails();
  }, [fetchCreditDetails]);

  // Check if we should show the extension buttons
  const shouldShowButtons = (): boolean => {
    if (!membershipExpiryStatus) {
      return false;
    }

    if (!metadata?.membershipExpiry) {
      return true;
    }

    if (!membershipExpiryStatus.expiryOn) {
      return true;
    }

    const messageExpiry = new Date(metadata.membershipExpiry);
    const currentExpiry = new Date(membershipExpiryStatus.expiryOn);

    return currentExpiry <= messageExpiry;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatPrice = (price: number): string => {
    return `₹${price.toLocaleString('en-IN')}`;
  };

  const formatExpiryDate = (isoString?: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get the effective price after applying credits
  const getEffectivePrice = (originalPrice: number): { payAmount: number; creditsUsed: number } => {
    const creditsUsed = Math.min(creditBalance, originalPrice);
    const payAmount = Math.max(0, originalPrice - creditsUsed);
    return { payAmount, creditsUsed };
  };

  // Get button text showing credits usage
  const getButtonText = (option: ExtensionOption): string => {
    const { payAmount, creditsUsed } = getEffectivePrice(option.price);

    if (creditsUsed > 0 && payAmount === 0) {
      // Fully covered by credits
      return `Extend ${option.label}\n(${formatPrice(creditsUsed)} credits)`;
    } else if (creditsUsed > 0) {
      // Partial credits
      return `Extend ${option.label}\n${formatPrice(payAmount)} (+${formatPrice(creditsUsed)} credits)`;
    } else {
      // No credits
      return `Extend ${option.label}\n${formatPrice(option.price)}`;
    }
  };

  const refreshMembershipStatus = async () => {
    try {
      const response = await apiService.getMembershipStatus(groupId);
      if (response.success && response.data) {
        setMembershipExpiryStatus({
          hasMembership: response.data.has_membership,
          status: response.data.status,
          expiryOn: response.data.expiry_on,
          daysUntilExpiry: response.data.days_until_expiry,
          inGracePeriod: response.data.in_grace_period,
          canExtend: response.data.can_extend,
          extensionOptions: response.data.extension_options,
          groupName: response.data.group_name,
          isOneOnOne: response.data.is_one_on_one,
        });
      }
    } catch (error) {
      console.error('[RenewalReminder] Failed to refresh membership status:', error);
    }
  };

  const handleExtendSubscription = async (option: ExtensionOption) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setSelectedOption(option.months);

    try {
      // Calculate credits to use
      const { creditsUsed } = getEffectivePrice(option.price);

      console.log('[RenewalReminder] Creating extension order for', option.months, 'months, credits:', creditsUsed);

      // Step 1: Create order via backend (with credits)
      const orderResponse = await apiService.createExtensionOrder(
        groupId,
        option.months as 1 | 3,
        creditsUsed
      );

      if (!orderResponse.success || !orderResponse.data) {
        throw new Error(orderResponse.error || 'Failed to create payment order');
      }

      // Check if extension is not available for this group type (non-monthly groups)
      // Silently return without showing error - this shouldn't happen in normal flow
      if (orderResponse.data.extension_not_available) {
        console.log('[RenewalReminder] Extension not available for this group type');
        return;
      }

      const { skip_payment, order_id, payment_amount, credits_used } = orderResponse.data;
      console.log('[RenewalReminder] Order response:', { skip_payment, order_id, payment_amount, credits_used });

      // Step 2: Handle payment or credits-only
      let paymentId: string | undefined;
      let orderId: string | undefined;
      let signature: string | undefined;

      if (!skip_payment && payment_amount > 0) {
        // Need to process Razorpay payment
        if (!order_id) {
          throw new Error('No order ID received for payment');
        }

        const userEmail = backendUser?.email || '';
        const userContact = backendUser?.user_profile?.phone_number || '';
        const userName = backendUser?.user_profile?.name || 'User';

        const paymentResult = await razorpayService.processPayment(
          payment_amount,
          `Extend subscription by ${option.months} month${option.months > 1 ? 's' : ''}`,
          userEmail,
          userContact,
          userName,
          order_id
        );

        if (!paymentResult.success) {
          if (paymentResult.error === 'Payment was cancelled') {
            console.log('[RenewalReminder] Payment cancelled by user');
            return;
          }
          throw new Error(paymentResult.error || 'Payment failed');
        }

        console.log('[RenewalReminder] Payment successful:', paymentResult.paymentId);
        paymentId = paymentResult.paymentId;
        orderId = order_id;
        signature = paymentResult.signature;
      } else {
        console.log('[RenewalReminder] Skipping Razorpay - fully covered by credits');
      }

      // Step 3: Extend subscription via backend
      const extendResponse = await apiService.extendSubscription({
        groupFirebaseUid: groupId,
        months: option.months as 1 | 3,
        paymentId,
        orderId,
        signature,
        creditsUsed: credits_used,
      });

      if (!extendResponse.success) {
        throw new Error(extendResponse.error || 'Failed to extend subscription');
      }

      console.log('[RenewalReminder] Subscription extended successfully');

      // Refresh membership status and credit balance
      await Promise.all([
        refreshMembershipStatus(),
        fetchCreditDetails(),
      ]);

    } catch (error: any) {
      console.error('[RenewalReminder] Extension error:', error);
      Alert.alert(
        'Extension Failed',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
      setSelectedOption(null);
    }
  };

  const showButtons = shouldShowButtons();

  return (
    <View style={styles.messageContainer}>
      <View style={styles.otherMessage}>
        <View style={styles.messageBubble}>
          {/* User info header - same as Zealopia messages */}
          <View style={styles.userInfoContainer}>
            <View style={styles.userInfo}>
              <View style={styles.userColorIndicator} />
              <Text style={styles.senderName}>Zealopia</Text>
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(message.sentAt)}</Text>
            </View>
          </View>

          {/* Message text */}
          <Text style={styles.messageText}>{message.messageText}</Text>

          {/* Credit balance info */}
          {showButtons && creditBalance > 0 && (
            <Text style={styles.creditInfo}>
              You have {formatPrice(creditBalance)} in credits
            </Text>
          )}

          {/* Extension buttons - only show if membership status loaded and not already renewed */}
          {showButtons && (
            <View style={styles.buttonsContainer}>
              {extensionOptions.map((option) => {
                const isOneMonth = option.months === 1;
                const isDisabled = isProcessing && selectedOption !== option.months;
                const isActive = isProcessing && selectedOption === option.months;

                const buttonContent = (
                  <>
                    {isActive ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={[
                        styles.extendButtonText,
                        isDisabled && styles.extendButtonTextDisabled,
                      ]}>
                        {getButtonText(option)}
                      </Text>
                    )}
                  </>
                );

                const buttonStyle = [
                  styles.extendButton,
                  isActive && styles.extendButtonActive,
                  isDisabled && styles.extendButtonDisabled,
                ];

                return (
                  <TouchableOpacity
                    key={option.months}
                    style={isOneMonth ? buttonStyle : styles.extendButtonContainer}
                    onPress={() => handleExtendSubscription(option)}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                  >
                    {isOneMonth ? (
                      buttonContent
                    ) : (
                      <LinearGradient
                        colors={Gradients.vibrant.colors}
                        locations={Gradients.vibrant.locations}
                        style={buttonStyle}
                      >
                        {buttonContent}
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 5,
    paddingHorizontal: 2,
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    width: messageWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
    borderRadius: 8,
    backgroundColor: Colors.gold,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: -14,
    marginLeft: -8,
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.black,
    marginRight: 6,
  },
  senderName: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.black,
    marginRight: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: Colors.secondaryText,
    textAlign: 'right',
  },
  messageText: {
    marginVertical: 5,
    fontSize: 12,
    lineHeight: 15,
    color: Colors.primaryText,
  },
  creditInfo: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 2,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  extendButtonContainer: {
    // flex: 1,
  },
  extendButton: {
    // flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    marginRight: 10
  },
  extendButtonActive: {
    opacity: 0.8,
  },
  extendButtonDisabled: {
    backgroundColor: Colors.secondaryBg,
  },
  extendButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
    marginLeft: 5,
    marginRight: 5
  },
  extendButtonTextDisabled: {
    color: Colors.secondaryText,
  },
});
