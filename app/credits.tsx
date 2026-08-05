import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCreditStore } from '@/lib/services/CreditService';
import { ErrorState, RetryButton } from '@/components/ui/ErrorComponents';
import { BaseText as Text } from '@/components/ui/Base';

export default function CreditsScreen() {
  const [couponCode, setCouponCode] = useState('');
  const [isRedeemingCoupon, setIsRedeemingCoupon] = useState(false);

  const {
    creditBalance,
    expiringText,
    creditTransactions,
    isLoading,
    error,
    fetchCreditDetails,
    redeemCoupon,
    resetError,
  } = useCreditStore();

  useEffect(() => {
    fetchCreditDetails();
  }, [fetchCreditDetails]);

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) {
      Alert.alert('Error', 'Enter a code');
      return;
    }

    setIsRedeemingCoupon(true);
    try {
      const result = await redeemCoupon(couponCode.trim().toUpperCase());
      
      if (result.success) {
        Alert.alert('Success!', result.message);
        setCouponCode('');
      } else {
        Alert.alert('Failed', result.message);
      }
    } catch (error) {
      console.error('Error redeeming coupon:', error);
      Alert.alert('Error', 'An error occurred while redeeming coupon');
    } finally {
      setIsRedeemingCoupon(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Zealopia Credits</Text>
          <View style={{ width: 24 }} />
        </View>

        <ErrorState 
          error={error} 
          onRetry={fetchCreditDetails}
          illustration="network"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zealopia Credits</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Credit Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet" size={32} color="#FFD700" />
            <Text style={styles.balanceLabel}>Available Credits</Text>
          </View>
          
          {isLoading ? (
            <ActivityIndicator size="large" color="#FFD700" style={styles.balanceLoader} />
          ) : (
            <View style={styles.balanceContent}>
              <Text style={styles.balanceAmount}>{creditBalance} ZC</Text>
              <Text style={styles.balanceEquivalent}>≈ ₹{creditBalance}</Text>
              {expiringText && (
                <Text style={styles.expiringText}>{expiringText}</Text>
              )}
            </View>
          )}
        </View>

        {/* Coupon Redemption */}
        <View style={styles.couponCard}>
          <Text style={styles.couponTitle}>Redeem Coupon</Text>
          <View style={styles.couponInputContainer}>
            <TextInput
              style={styles.couponInput}
              placeholder="Enter coupon code"
              value={couponCode}
              onChangeText={setCouponCode}
              autoCapitalize="characters"
              maxLength={20}
            />
            <TouchableOpacity
              style={[styles.redeemButton, (!couponCode.trim() || isRedeemingCoupon) && styles.redeemButtonDisabled]}
              onPress={handleRedeemCoupon}
              disabled={!couponCode.trim() || isRedeemingCoupon}
            >
              {isRedeemingCoupon ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.redeemButtonText}>Redeem</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction History */}
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Transaction History</Text>
          
          {isLoading ? (
            <View style={styles.historyLoader}>
              <ActivityIndicator size="small" color="#666" />
              <Text style={styles.historyLoaderText}>Loading transactions...</Text>
            </View>
          ) : creditTransactions.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <Text style={styles.emptyHistoryText}>No transactions yet</Text>
              <Text style={styles.emptyHistorySubtext}>
                Your credit transactions will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {creditTransactions.map((transaction, index) => (
                <View key={index} style={styles.transactionItem}>
                  <View style={styles.transactionIcon}>
                    <Ionicons
                      name={transaction.type === 'credit' ? 'add-circle' : 'remove-circle'}
                      size={24}
                      color={transaction.type === 'credit' ? '#34C759' : '#FF3B30'}
                    />
                  </View>
                  
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionTitle}>{transaction.title}</Text>
                    <Text style={styles.transactionDescription}>{transaction.description}</Text>
                    <Text style={styles.transactionDate}>
                      {formatDate(transaction.dt)} at {formatTime(transaction.dt)}
                    </Text>
                  </View>
                  
                  <View style={styles.transactionAmount}>
                    <Text style={[
                      styles.transactionAmountText,
                      { color: transaction.type === 'credit' ? '#34C759' : '#FF3B30' }
                    ]}>
                      {transaction.type === 'credit' ? '+' : '-'}{transaction.amount_str}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Zealopia Credits</Text>
          <Text style={styles.infoText}>
            • 1 ZC = ₹1{'\n'}
            • Use credits to reduce group joining fees{'\n'}
            • Earn credits through referrals and coupons{'\n'}
            • Credits are non-transferable and non-refundable
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  balanceContent: {
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  balanceEquivalent: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  expiringText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
  },
  balanceLoader: {
    marginTop: 20,
  },
  couponCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  couponTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  couponInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 12,
    backgroundColor: '#f9f9f9',
  },
  redeemButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  redeemButtonDisabled: {
    backgroundColor: '#ccc',
  },
  redeemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  historyLoader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  historyLoaderText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 12,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionIcon: {
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  transactionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});