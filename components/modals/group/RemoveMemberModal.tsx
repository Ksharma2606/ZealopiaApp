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

interface RemoveMemberModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: number;
  userId: number;
  userName: string;
  onSuccess: () => void;
}

export default function RemoveMemberModal({
  visible,
  onClose,
  groupId,
  userId,
  userName,
  onSuccess,
}: RemoveMemberModalProps) {
  const [loading, setLoading] = useState(false);

  const handleRemoveMember = async () => {
    try {
      setLoading(true);
      const response = await apiService.removeMemberFromGroup(groupId, userId);
      
      if (response.success) {
        Alert.alert('Success', 'Member removed successfully');
        onSuccess();
        onClose();
      } else {
        Alert.alert('Error', response.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      Alert.alert('Error', 'An error occurred while removing the member');
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
          <Text style={styles.message}>
            If this person has violated any rule, we insist that you DM the person and give them a chance to correct themselves.
          </Text>

          <Text style={styles.confirmText}>
            Are you sure you want to remove {userName}?
          </Text>

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.yesButton]}
              onPress={handleRemoveMember}
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
  message: {
    fontSize: 14,
    color: '#000',
    marginBottom: 20,
    marginTop: 10,
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