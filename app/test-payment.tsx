import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import razorpayService from '@/lib/services/RazorpayService';
import { BaseText as Text } from '@/components/ui/Base';

export default function TestPaymentScreen() {
  const [loading, setLoading] = useState(false);

  const testPayment = async () => {
    setLoading(true);
    try {
      const result = await razorpayService.processPayment(
        100, // ₹100 test amount
        'Test Payment for Zealopia',
        'test@zealopia.in',
        '9999999999',
        'Test User'
      );

      if (result.success) {
        Alert.alert('Payment Success!', `Payment ID: ${result.paymentId}`);
      } else {
        Alert.alert('Payment Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Test payment error:', error);
      Alert.alert('Error', 'Test payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Razorpay Payment Test</Text>
      <Text style={styles.subtitle}>Test the payment integration</Text>
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={testPayment}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Processing...' : 'Test Payment (₹100)'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        This will open Razorpay test payment gateway.{'\n'}
        Use test card: 4111 1111 1111 1111{'\n'}
        Any future date, any CVV
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  note: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});