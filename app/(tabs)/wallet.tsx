import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreditStore } from '@/lib/services/CreditService';
import { BaseText as Text } from '@/components/ui/Base';
import Colors from '@/constants/Colors';

export default function WalletTab() {
  const {
    creditBalance,
    expiringText,
    creditTransactions,
    isLoading,
    error,
    fetchCreditDetails,
  } = useCreditStore();

  useEffect(() => {
    fetchCreditDetails();
  }, [fetchCreditDetails]);

  const formatDate = (dateString: string) => {
    // Backend sends date in DD/MM/YYYY format, just return it as is
    try {
      // Validate the format and return as DD/MM/YYYY
      const [day, month, year] = dateString.split('/');
      if (day && month && year && day.length <= 2 && month.length <= 2 && year.length === 4) {
        return dateString; // Return original DD/MM/YYYY format
      }
      return dateString; // Return original if validation fails
    } catch (error) {
      console.warn('Error parsing date:', dateString, error);
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    // Since backend only sends date (DD/MM/YYYY), we don't have time info
    // Return empty string or a default time
    return '';
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>{error?.userMessage || 'An error occurred'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchCreditDetails}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Credit Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Zealopia Credits Balance:</Text>
          </View>

          <View style={styles.balanceContentContainer}>
            <View style={styles.balanceContent}>
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.secondaryText} />
              ) : (
                <Text style={styles.balanceAmount}>{creditBalance}</Text>
              )}
              <Text style={styles.balanceCurrency}>ZC</Text>
            </View>
            <View>
              <Text style={styles.balanceCurrencyHelper}>1 ZC= 1 ₹</Text>
            </View>
          </View>
          
          {expiringText && (
            <Text style={styles.expiringText}>{expiringText}</Text>
          )}
        </View>

        {/* Transaction History */}
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Credit History</Text>
          
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
                  <Text style={styles.transactionTitle}>{transaction.title}</Text>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDate}>
                      {formatDate(transaction.dt)}
                    </Text>
                    <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  </View>
                  
                  <View style={styles.transactionAmount}>
                    <Text style={[
                      styles.transactionAmountText,
                      { color: transaction.type === 'Credit' ? Colors.chatNotification : Colors.primary }
                    ]}>
                      {transaction.amount_str}
                    </Text>
                    {/* Show expiry info for credit transactions if available */}
                    {transaction.type === 'Credit' && transaction.title === 'Credits Add' && (
                      <Text style={styles.expiryText}>
                        Expiry: 20/10/2024
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.secondaryBg,
  },
  scrollView: {
    flex: 1,
    // paddingVertical: 16,
    paddingHorizontal: 8,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  balanceHeader: {
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 24,
    fontWeight: 600,
    color: '#666',
    marginTop: 8,
  },
  balanceContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  balanceContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: '60%',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 600,
    color: Colors.secondaryText,
  },
  balanceCurrency: {
    fontSize: 24,
    fontWeight: 600,
    color: Colors.secondaryText,
  },
  balanceCurrencyHelper: {
    fontSize: 16,
    color: Colors.black
  },
  balanceEquivalent: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  expiringText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 8,
    textAlign: 'left',
  },
  historyCard: {
    borderRadius: 12,
    padding: 16,
    // marginBottom: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.secondaryText,
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
    gap: 16,
  },
  transactionItem: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 24,
    borderRadius: 12
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
    width: '35%'
  },
  transactionDescription: {
    fontSize: 12,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  expiryText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
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