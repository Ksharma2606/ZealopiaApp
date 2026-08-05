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

interface DeleteGroupModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
}

export default function DeleteGroupModal({
  visible,
  onClose,
  groupId,
  groupName,
}: DeleteGroupModalProps) {
  const [loading, setLoading] = useState(false);

  const handleDeleteGroup = async () => {
    try {
      setLoading(true);
      const response = await apiService.deleteGroup(groupId);
      
      if (response.success) {
        Alert.alert('Success', 'Group has been deleted successfully');
        onClose();
        // Navigate back to chat home
        router.replace('/(tabs)/chat');
      } else {
        Alert.alert('Error', response.error || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      Alert.alert('Error', 'An error occurred while deleting the group');
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
            Delete Group
          </Text>

          <Text style={styles.description}>
            Are you sure you want to delete "{groupName}"? This action cannot be undone and all members will be notified.
          </Text>

          <Text style={styles.warning}>
            This will permanently delete the group and remove all members.
          </Text>

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleDeleteGroup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Delete Group</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
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
    marginBottom: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  warning: {
    fontSize: 12,
    color: '#CC0000',
    marginBottom: 20,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '500',
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
  deleteButton: {
    backgroundColor: '#FF3B30',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButtonText: {
    color: '#000',
  },
});