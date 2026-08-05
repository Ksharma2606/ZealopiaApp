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

interface LeaveGroupModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
  groupFirebaseUid?: string;
  groupCost?: number;
  isAdmin?: boolean;
}

export default function LeaveGroupModal({
  visible,
  onClose,
  groupId,
  groupName,
  groupFirebaseUid,
  groupCost = 0,
  isAdmin = false,
}: LeaveGroupModalProps) {
  const [loading, setLoading] = useState(false);

  const handleLeaveGroup = async () => {
    try {
      setLoading(true);
      const response = await apiService.leaveGroup(groupId);
      
      if (response.success) {
        Alert.alert('Success', 'You have left the group successfully');
        onClose();
        // Navigate back to chat home
        router.replace('/(tabs)/chat');
      } else {
        Alert.alert('Error', response.error || 'Failed to leave group');
      }
    } catch (error) {
      console.error('Error leaving group:', error);
      Alert.alert('Error', 'An error occurred while leaving the group');
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
            You are about to leave this group before its expiration. Please note, if you leave now:
          </Text>

          <View style={styles.warningsList}>
            {groupCost === 0 ? (
              // Free Group Warnings
              <>
                <View style={styles.warningItem}>
                  <Text style={styles.warningNumber}>1.</Text>
                  <Text style={styles.warningText}>
                    You will not be allowed to join this group for the next 15 days
                  </Text>
                </View>

                <View style={styles.warningItem}>
                  <Text style={styles.warningNumber}>2.</Text>
                  <Text style={styles.warningText}>
                    If you leave more than 3 groups in a week, you will not be able to join any free group for 30 days
                  </Text>
                </View>
              </>
            ) : (
              // Paid Group Warning
              <View style={styles.warningItem}>
                <Text style={styles.warningNumber}>•</Text>
                <Text style={styles.warningText}>
                  You will not be compensated for the time remaining. All payments are non-refundable.
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.confirmText}>Are you sure you want to leave?</Text>

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.yesButton]}
              onPress={handleLeaveGroup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Yes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.noButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.buttonText, styles.noButtonText]}>No</Text>
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
    fontSize: 14,
    color: '#000',
    marginBottom: 20,
    marginTop: 10,
    lineHeight: 20,
  },
  warningsList: {
    marginBottom: 20,
  },
  warningItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  warningNumber: {
    fontSize: 14,
    color: '#000',
    marginRight: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#000',
    flex: 1,
    lineHeight: 20,
  },
  confirmText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
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