import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

interface OneOnOneInfoModalProps {
  visible: boolean;
  onClose: () => void;
  medicName: string;
  medicBio?: string;
  expiresAt?: Date | null;
}

export default function OneOnOneInfoModal({
  visible,
  onClose,
  medicName,
  medicBio,
  expiresAt,
}: OneOnOneInfoModalProps) {
  const formatExpiryDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <Text style={styles.medicName}>{medicName}</Text>

            {/* About Therapist */}
            {medicBio && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About {medicName}</Text>
                <Text style={styles.sectionContent}>{medicBio}</Text>
              </View>
            )}

            {/* Chat Expiration */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chat Expiration</Text>
              <Text style={styles.sectionContent}>
                {expiresAt ? (
                  <>
                    This chat expires on {formatExpiryDate(expiresAt)}.{' '}
                    {getDaysRemaining(expiresAt) > 0
                      ? `(${getDaysRemaining(expiresAt)} days remaining)`
                      : '(Expired)'}
                    {'\n\n'}You can choose to extend it before expiry.
                  </>
                ) : (
                  'This chat would expire in 30 days from the start date. You can choose to extend it later.'
                )}
              </Text>
            </View>

            {/* Chat Guidelines */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chat Guidelines</Text>
              <Text style={styles.sectionContent}>
                1. Be kind to each other{'\n'}
                2. No abusive or insulting language{'\n'}
                3. Any form of bullying is not permitted{'\n'}
                4. No discussions about politics or religion are permitted
              </Text>
            </View>

            <Text style={styles.warningText}>
              Not following these rules will lead to removal without refund.
            </Text>
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
    backgroundColor: Colors.myChat,
    borderRadius: 12,
    padding: 24,
    paddingVertical: 48,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
    zIndex: 1,
  },
  medicName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
    paddingRight: 40,
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
    marginTop: 8,
    marginBottom: 16,
  },
});
