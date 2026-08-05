import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '@/lib/services/ApiService';
import { router } from 'expo-router';

interface WithdrawGroupModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
}

export default function WithdrawGroupModal({
  visible,
  onClose,
  groupId,
  groupName,
}: WithdrawGroupModalProps) {
  const [loading, setLoading] = useState(false);

  const handleWithdrawFromGroup = async () => {
    try {
      setLoading(true);
      const response = await apiService.withdrawFromGroup(groupId);
      
      if (response.success) {
        Alert.alert('Success', 'You have withdrawn your request successfully');
        onClose();
        // Navigate back to chat home
        router.replace('/(tabs)/chat');
      } else {
        Alert.alert('Error', response.error || 'Failed to withdraw from group');
      }
    } catch (error) {
      console.error('Error withdrawing from group:', error);
      Alert.alert('Error', 'An error occurred while withdrawing from the group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* Content */}
          <Text style={styles.title}>
            Withdraw Request
          </Text>

          <Text style={styles.description}>
            Are you sure you want to withdraw your request to join "{groupName}"?
          </Text>

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.yesButton]}
              onPress={handleWithdrawFromGroup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Yes, Withdraw</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.noButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.buttonText, styles.noButtonText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#FFD700', // Zeal gold color
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
    zIndex: 1,
  },
  title: {
    fontSize: 18,
    color: '#000',
    fontWeight: '600',
    marginBottom: 15,
    marginTop: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#000',
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  yesButton: {
    backgroundColor: '#007AFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  noButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  noButtonText: {
    color: '#000',
  },
});