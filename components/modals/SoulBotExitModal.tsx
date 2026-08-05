import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
} from 'react-native';
import { BaseText as Text } from '@/components/ui/Base';
import Colors from '@/constants/Colors';

interface SoulBotExitModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SoulBotExitModal({
  visible,
  onClose,
  onConfirm,
}: SoulBotExitModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Purple character with decorations */}
          

          {/* Message content */}
          <View style={styles.messageContainer}>
            <Text style={styles.messageTitle}>Oh Golly! 😨</Text>
            <Text style={styles.messageText}>
              We are just a few more{'\n'}
              chats away from{'\n'}
              discovering the real you.
            </Text>
            
            <Text style={styles.questionText}>
              Are you sure you want to exit{'\n'}
              now?
            </Text>

            {/* Action buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.yesButton]}
                onPress={onConfirm}
              >
                <Text style={styles.yesButtonText}>Yes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.noButton]}
                onPress={onClose}
              >
                <Text style={styles.noButtonText}>No</Text>
              </TouchableOpacity>
            </View>
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
    width: '90%',
    maxWidth: 350,
    alignItems: 'center',
  },
  messageContainer: {
    backgroundColor: Colors.splashScreen,
    borderRadius: 20,
    padding: 24,
    paddingTop: 60,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  questionText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 10,
  },
  yesButton: {
    backgroundColor: Colors.primary,
  },
  noButton: {
    backgroundColor: Colors.otherChat,
  },
  yesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});