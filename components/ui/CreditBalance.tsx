import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCreditStore } from '@/lib/services/CreditService';

interface CreditBalanceProps {
  showNavigateButton?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export default function CreditBalance({ 
  showNavigateButton = true, 
  size = 'medium',
  style 
}: CreditBalanceProps) {
  const { creditBalance, isLoading, fetchCreditDetails } = useCreditStore();

  useEffect(() => {
    fetchCreditDetails();
  }, [fetchCreditDetails]);

  const handleNavigateToCredits = () => {
    router.push('/credits');
  };

  const sizeStyles = {
    small: {
      container: styles.containerSmall,
      balance: styles.balanceSmall,
      label: styles.labelSmall,
      icon: 16,
    },
    medium: {
      container: styles.containerMedium,
      balance: styles.balanceMedium,
      label: styles.labelMedium,
      icon: 20,
    },
    large: {
      container: styles.containerLarge,
      balance: styles.balanceLarge,
      label: styles.labelLarge,
      icon: 24,
    },
  };

  const currentSize = sizeStyles[size];

  if (isLoading) {
    return (
      <View style={[currentSize.container, style]}>
        <ActivityIndicator size="small" color="#FFD700" />
        <Text style={currentSize.label}>Loading credits...</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[currentSize.container, style]}
      onPress={showNavigateButton ? handleNavigateToCredits : undefined}
      disabled={!showNavigateButton}
    >
      <View style={styles.content}>
        <Ionicons name="wallet" size={currentSize.icon} color="#FFD700" />
        <View style={styles.textContainer}>
          <Text style={currentSize.balance}>{creditBalance} ZC</Text>
          <Text style={currentSize.label}>Credits</Text>
        </View>
        {showNavigateButton && (
          <Ionicons name="chevron-forward" size={16} color="#666" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 8,
    flex: 1,
  },
  
  // Small size
  containerSmall: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  balanceSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
  },
  labelSmall: {
    fontSize: 12,
    color: '#666',
  },
  
  // Medium size
  containerMedium: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceMedium: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
  },
  labelMedium: {
    fontSize: 14,
    color: '#666',
  },
  
  // Large size
  containerLarge: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLarge: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFD700',
  },
  labelLarge: {
    fontSize: 16,
    color: '#666',
  },
});