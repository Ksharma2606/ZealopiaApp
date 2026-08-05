import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService, { MedicProfile } from '@/lib/services/ApiService';
import razorpayService from '@/lib/services/RazorpayService';
import { useCreditStore, CreditCalculator } from '@/lib/services/CreditService';
import { router } from 'expo-router';
import { useAuthContext } from '@/lib/context/AuthContext';
import Colors from '@/constants/Colors';

interface JoinGroupModalProps {
  visible: boolean;
  onClose: () => void;
  // Group props (for regular groups)
  groupId?: number;
  groupName?: string;
  groupDescription?: string;
  groupCost?: number;
  expiryDate?: string;
  isFreeGroup?: boolean;
  onJoinSuccess?: (groupId: number) => void;
  // 1:1 chat props
  isOneOnOne?: boolean;
  medic?: MedicProfile | null;
  onOneOnOneSuccess?: (firebaseUid: string) => void;
  // Match text from therapist matches API
  matchText?: string;
}

export default function JoinGroupModal({
  visible,
  onClose,
  groupId,
  groupName,
  groupDescription,
  groupCost = 0,
  expiryDate,
  isFreeGroup,
  onJoinSuccess,
  // 1:1 chat props
  isOneOnOne = false,
  medic,
  onOneOnOneSuccess,
  matchText,
}: JoinGroupModalProps) {
  const [loading, setLoading] = useState(false);
  const [useCredits, setUseCredits] = useState(false);
  const [creditsToUse, setCreditsToUse] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const { user } = useAuthContext();
  const {
    creditBalance,
    fetchCreditDetails,
    isLoading: creditLoading
  } = useCreditStore();

  // Determine the cost based on mode
  const cost = isOneOnOne ? (medic?.one_on_one_price || 0) : groupCost;
  const isFree = isOneOnOne ? cost === 0 : isFreeGroup;
  const displayName = isOneOnOne ? `${medic?.name || 'Medic'}` : groupName;

  const canJoinFreeGroup = true; // Removed 2 free group limitation
  const maxCreditsUsable = CreditCalculator.getMaxCreditsUsable(creditBalance, cost);

  // Fetch credit details when modal opens for paid groups/chats
  useEffect(() => {
    if (visible && !isFree && cost > 0) {
      fetchCreditDetails();
    }
    // Reset state when modal opens
    if (visible) {
      setUseCredits(false);
      setCreditsToUse(0);
      setPaymentAmount(cost);
    }
  }, [visible, isFree, cost, fetchCreditDetails]);

  // Update payment amount when credits usage changes
  useEffect(() => {
    if (useCredits) {
      const creditAmount = maxCreditsUsable;
      setCreditsToUse(creditAmount);
      setPaymentAmount(CreditCalculator.getPaymentAmount(cost, creditAmount));
    } else {
      setCreditsToUse(0);
      setPaymentAmount(cost);
    }
  }, [useCredits, maxCreditsUsable, cost]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleJoinOneOnOne = async () => {
    if (!medic) return;

    try {
      setLoading(true);

      if (!user) {
        Alert.alert('Error', 'Please log in to start 1:1 chat');
        return;
      }

      let paymentId: string | undefined;

      // Handle payment for paid chats
      if (!isFree && cost > 0) {
        if (paymentAmount > 0) {
          const userEmail = user.email || '';
          const userPhone = user.phoneNumber || '';
          const userName = user.displayName || 'User';

          if (!userEmail && !userPhone) {
            Alert.alert('Error', 'User email or phone number is required for payment');
            return;
          }

          // Step 1: Create Razorpay order
          const orderResponse = await apiService.createOneOnOneOrder(medic.id, creditsToUse);

          if (!orderResponse.success || !orderResponse.data) {
            Alert.alert('Error', orderResponse.error || 'Failed to create payment order');
            return;
          }

          const orderData = orderResponse.data;

          // Step 2: Process Razorpay payment
          const paymentResult = await razorpayService.processGroupJoinPayment(
            medic.id,
            `1:1 Chat with ${medic.name}`,
            orderData.payment_amount,
            userEmail,
            userPhone,
            userName,
            user.uid,
            orderData.order_id
          );

          if (!paymentResult.success) {
            if (paymentResult.error !== 'Payment was cancelled') {
              Alert.alert('Payment Failed', paymentResult.error || 'Payment was not completed');
            }
            return;
          }

          paymentId = paymentResult.paymentId;

          // Step 3: Verify payment signature
          if (paymentResult.paymentId && paymentResult.signature && paymentResult.orderId) {
            const verifyResponse = await apiService.verifyPaymentSignature(
              paymentResult.orderId,
              paymentResult.paymentId,
              paymentResult.signature
            );

            if (!verifyResponse.success || !verifyResponse.data?.is_valid) {
              console.warn('Payment verification warning:', verifyResponse.error);
              // Continue anyway as the backend will also verify
            }
          }
        }
      }

      // Step 4: Create 1:1 group
      const createResponse = await apiService.createOneOnOneGroup(
        medic.id,
        paymentId,
        creditsToUse
      );

      if (!createResponse.success || !createResponse.data) {
        Alert.alert('Error', createResponse.error || 'Failed to create 1:1 chat');
        return;
      }

      // Success! Call success callback with firebase_uid
      if (onOneOnOneSuccess && createResponse.data.firebase_uid) {
        onOneOnOneSuccess(createResponse.data.firebase_uid);
      }

      onClose();
    } catch (error: any) {
      console.error('Error starting 1:1 chat:', error);
      Alert.alert('Error', error.message || 'Failed to start 1:1 chat');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!groupId) return;

    try {
      setLoading(true);

      // Check if user is available
      if (!user) {
        Alert.alert('Error', 'Please log in to join groups');
        return;
      }

      let paymentId: string | undefined;
      let orderId: string | undefined;

      // Handle payment for paid groups
      if (!isFreeGroup && groupCost > 0) {
        console.log('Processing paid group join:', {
          groupCost,
          paymentAmount,
          creditsToUse,
          useCredits
        });

        // Only process payment if there's an amount to pay after credits
        if (paymentAmount > 0) {
          // Get user details for payment
          const userEmail = user.email || '';
          const userPhone = user.phoneNumber || '';
          const userName = user.displayName || 'User';

          console.log('User details for payment:', {
            userEmail,
            userPhone,
            userName,
            userUid: user.uid
          });

          if (!userEmail && !userPhone) {
            Alert.alert('Error', 'User email or phone number is required for payment');
            return;
          }

          // Step 1: Create Razorpay order
          console.log('Creating Razorpay order for amount:', paymentAmount);
          const orderResponse = await apiService.createRazorpayOrder(groupId, creditsToUse);

          if (!orderResponse.success || !orderResponse.data) {
            Alert.alert('Error', orderResponse.error || 'Failed to create payment order');
            return;
          }

          const orderData = orderResponse.data;
          orderId = orderData.order_id;

          console.log('Order created successfully:', orderData);

          // Step 2: Process Razorpay payment with order
          console.log('Initiating Razorpay payment with order:', orderId);
          const paymentResult = await razorpayService.processGroupJoinPayment(
            groupId,
            groupName || 'Group',
            orderData.payment_amount, // Use exact amount from order
            userEmail,
            userPhone,
            userName,
            user.uid,
            orderId // Pass the order ID
          );

          console.log('Razorpay payment result:', paymentResult);

          if (!paymentResult.success) {
            if (paymentResult.error !== 'Payment was cancelled') {
              Alert.alert('Payment Failed', paymentResult.error || 'Payment failed. Please try again.');
            }
            return;
          }

          paymentId = paymentResult.paymentId;
          console.log('Payment successful, paymentId:', paymentId, 'orderId:', paymentResult.orderId);

          // Optional: Verify payment signature for additional security
          if (paymentResult.signature && paymentResult.orderId) {
            console.log('Verifying payment signature...');
            const signatureResponse = await apiService.verifyPaymentSignature(
              paymentResult.orderId,
              paymentResult.paymentId || '',
              paymentResult.signature
            );

            if (signatureResponse.success && signatureResponse.data?.is_valid) {
              console.log('Payment signature verified successfully');
            } else {
              console.warn('Payment signature verification failed:', signatureResponse.error);
              // Continue anyway as the backend will also verify
            }
          }
        } else {
          console.log('Payment amount is 0, skipping Razorpay');
        }
        // If paymentAmount is 0 (fully covered by credits), no payment needed
      } else {
        console.log('Free group or zero cost, skipping payment');
      }

      // Join group with payment ID (if paid) and credits used
      const joinData: { payment_id?: string; credits_used?: number } = {};
      if (paymentId) {
        joinData.payment_id = paymentId;
      }
      if (creditsToUse > 0) {
        joinData.credits_used = creditsToUse;
      }

      console.log('Calling joinGroup API with data:', joinData);
      const response = await apiService.joinGroup(groupId, joinData);

      console.log('Join group response:', response);
      console.log('Join group response data:', JSON.stringify(response.data, null, 2));

      if (response.success) {
        // Close modal first
        onClose();

        // Get the Firebase UID for the group from the response
        // The response contains a GroupMembership object with a nested group object
        const groupFirebaseUid = response.data?.group?.firebase_uid;

        console.log('Extracted Firebase UID:', groupFirebaseUid);

        if (groupFirebaseUid) {
          // Navigate directly to the chat screen for this group
          console.log('Navigating to chat-detail with groupId:', groupFirebaseUid);
          router.push({
            pathname: '/chat-detail',
            params: {
              groupId: groupFirebaseUid
            }
          });
        } else {
          // Fallback to chat home if we don't have the Firebase UID
          console.log('No Firebase UID found, falling back to chat home');
          router.replace('/(tabs)/chat');
        }

        // Call success callback if provided
        if (onJoinSuccess) {
          onJoinSuccess(groupId);
        }
      } else {
        // If payment was successful but join failed, show error with payment ID
        if (paymentId) {
          console.error('Join failed after payment:', {
            paymentId,
            error: response.error,
            status: response.status
          });
          Alert.alert(
            'Join Failed',
            `Payment was successful but failed to join group. Please contact support with payment ID: ${paymentId}\n\nError: ${response.error || 'Unknown error'}`
          );
        } else {
          Alert.alert('Error', response.error || 'Failed to join group');
        }
      }
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('Error', 'An error occurred while joining the group');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    if (isOneOnOne) {
      handleJoinOneOnOne();
    } else {
      handleJoinGroup();
    }
  };

  const getButtonText = () => {
    if (isFree) {
      return isOneOnOne ? 'Start Chat for Free' : 'Join for Free';
    }
    if (paymentAmount === 0) {
      return isOneOnOne ? 'Start Chat with Credits' : 'Join with Credits';
    }
    return isOneOnOne
      ? `Start Chat for ₹${paymentAmount}`
      : `Join Group for ₹${paymentAmount}`;
  };

  // For 1:1, always use paid styling (pink background)
  const usePaidStyling = isOneOnOne || !isFreeGroup;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, usePaidStyling ? styles.paidModalContainer : styles.freeModalContainer]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <Text style={styles.groupName}>{displayName}</Text>
            {isFree ? (
              <Text style={styles.freeTag}>{isOneOnOne ? 'Free Chat' : 'Free Group'}</Text>
            ) : (
              <Text style={styles.priceTag}>₹{cost}{isOneOnOne ? '/month' : ''}</Text>
            )}

            {/* Description - only for groups */}
            {!isOneOnOne && groupDescription && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Who should join this Group?</Text>
                <Text style={styles.sectionContent}>{groupDescription}</Text>
              </View>
            )}

            {/* About Therapist - only for 1:1 chats with bio */}
            {isOneOnOne && medic?.bio && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About {medic.name}</Text>
                <Text style={styles.sectionContent}>{medic.bio}</Text>
              </View>
            )}

            {/* Why are you a match? - only for 1:1 chats with match text */}
            {isOneOnOne && matchText && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Why are you a match?</Text>
                <Text style={styles.sectionContent}>{matchText}</Text>
              </View>
            )}

            {/* Validity Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isOneOnOne ? 'Chat Expiration' : 'Group Expiration Date'}
              </Text>
              <Text style={styles.sectionContent}>
                {isOneOnOne
                  ? 'This chat would expire in 30 days. You can choose to extend it later'
                  : expiryDate ? `This Group dissolves on ${formatDate(expiryDate)}` : ''
                }
              </Text>
              {!isOneOnOne && isFreeGroup && (
                <Text style={styles.sectionContent}>
                  You can leave the group anytime you want. Once you leave any free group you cannot join it again for 15 days.
                </Text>
              )}
            </View>

            {/* Rules */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isOneOnOne ? 'Chat Guidelines' : 'Rules of the group'}
              </Text>
              <Text style={styles.sectionContent}>
                1. Be kind to each other{'\n'}
                2. No abusive or insulting language{'\n'}
                3. Any form of bullying is not permitted{'\n'}
                4. No discussions about politics or religion are permitted
              </Text>
            </View>

            <Text style={styles.warningText}>
              Not following these rules will lead to removal{isOneOnOne ? '' : ' from the group'} without refund.
            </Text>

            {/* Credits section for paid groups/chats */}
            {!isFree && cost > 0 && maxCreditsUsable > 0 && (
              <View style={styles.creditsSection}>
                <TouchableOpacity
                  style={styles.creditsCheckbox}
                  onPress={() => setUseCredits(!useCredits)}
                  disabled={creditLoading}
                >
                  <View style={[styles.checkbox, useCredits && styles.checkboxChecked]}>
                    {useCredits && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <Text style={styles.creditsText}>
                    {useCredits
                      ? `Using ${CreditCalculator.formatCreditAmount(creditsToUse)}`
                      : `Use ${CreditCalculator.formatCreditWithRupee(maxCreditsUsable)}`
                    }
                  </Text>
                </TouchableOpacity>

                {creditLoading && (
                  <ActivityIndicator size="small" color="#000" style={styles.creditLoader} />
                )}
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.joinButton,
                  (!canJoinFreeGroup || loading) && styles.joinButtonDisabled
                ]}
                onPress={handleJoin}
                disabled={!canJoinFreeGroup || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.joinButtonText}>{getButtonText()}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 12,
    padding: 24,
    paddingVertical: 48,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  freeModalContainer: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
  },
  paidModalContainer: {
    backgroundColor: Colors.myChat,
    borderRadius: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
    zIndex: 1,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    paddingRight: 40,
  },
  freeTag: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 20,
  },
  priceTag: {
    fontSize: 18,
    color: '#000',
    fontWeight: '600',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  warningText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
    // textAlign: 'center',
    marginTop: 8,
    marginBottom: 16
  },
  groupLimit: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  groupLimitError: {
    color: '#FF3B30',
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  joinButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  joinButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
  },
  joinButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  creditsSection: {
    marginBottom: 16,
    alignItems: 'center',
  },
  creditsCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#000',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  creditsText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  creditLoader: {
    marginTop: 8,
  },
  paymentSummary: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  paymentSummaryText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
