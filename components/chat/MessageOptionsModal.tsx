import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  Pressable,
  Alert,
  Clipboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore, MessageData } from '@/lib/stores/chatStore';
import { useAuth } from '@/lib/context/AuthContext';

// Exact colors from Flutter Flow theme
const COLORS = {
  primaryText: '#000000',
  secondaryText: '#919191',
  dangerRed: '#FF6B6B',
  primary: '#4B39EF',
};

interface MessageOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  message: MessageData | null;
  senderName?: string;
  senderColor?: string;
  groupId?: string;
  canWriteChat?: boolean;
  isAdmin?: boolean;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
}

export function MessageOptionsModal({
  visible,
  onClose,
  message,
  senderName,
  senderColor = '#4B39EF',
  groupId = '',
  canWriteChat = true,
  isAdmin = false,
  onDelete,
  onPin,
  onUnpin
}: MessageOptionsModalProps) {
  const { firebaseUser } = useAuth();
  const { setReplyingTo } = useChatStore();

  if (!message) return null;

  const isOwnMessage = message.sentBy === firebaseUser?.uid;
  // Only show delete for own messages OR if user is admin (matches Flutter Flow logic)
  const canDelete = isOwnMessage || isAdmin;

  // Pin/unpin logic: only admins can pin/unpin messages
  const isPinned = message.isPinned === true;
  const canPin = isAdmin && !isPinned;
  const canUnpin = isAdmin && isPinned;
  
  const handleReply = () => {
    if (!canWriteChat) return;
    
    setReplyingTo({
      color: senderColor,
      name: senderName || (isOwnMessage ? 'You' : 'User'),
      msgText: message.messageText,
      group_id: groupId,
      messageDocRef: message.id,
    });
    onClose();
  };
  
  const handleDelete = () => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete?.(message.id);
            onClose();
          },
        },
      ]
    );
  };
  
  const handleCopy = async () => {
    try {
      await Clipboard.setString(message.messageText);
      // Optionally show a brief toast/alert
      // Alert.alert('', 'Message copied to clipboard', [{ text: 'OK' }], { duration: 1000 });
      onClose();
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handlePin = () => {
    onPin?.(message.id);
    onClose();
  };

  const handleUnpin = () => {
    onUnpin?.(message.id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Options</Text>
            
            {/* Reply option - only show if user can write */}
            {canWriteChat && (
              <TouchableOpacity style={styles.option} onPress={handleReply}>
                <Ionicons name="arrow-undo" size={20} color={COLORS.primary} />
                <Text style={styles.optionText}>Reply to this message</Text>
              </TouchableOpacity>
            )}
            
            {/* Copy option */}
            <TouchableOpacity style={styles.option} onPress={handleCopy}>
              <Ionicons name="copy" size={20} color={COLORS.primaryText} />
              <Text style={styles.optionText}>Copy</Text>
            </TouchableOpacity>

            {/* Pin option - only admins can pin */}
            {canPin && (
              <TouchableOpacity style={styles.option} onPress={handlePin}>
                <Ionicons name="pin" size={20} color={COLORS.primaryText} />
                <Text style={styles.optionText}>Pin Message</Text>
              </TouchableOpacity>
            )}

            {/* Unpin option - only admins can unpin */}
            {canUnpin && (
              <TouchableOpacity style={styles.option} onPress={handleUnpin}>
                <Ionicons name="pin-outline" size={20} color={COLORS.primaryText} />
                <Text style={styles.optionText}>Unpin Message</Text>
              </TouchableOpacity>
            )}

            {/* Delete option - show for own messages or if admin */}
            {canDelete && (
              <TouchableOpacity style={styles.option} onPress={handleDelete}>
                <Ionicons name="trash" size={20} color={COLORS.dangerRed} />
                <Text style={[styles.optionText, styles.dangerText]}>Delete Message</Text>
              </TouchableOpacity>
            )}
            
            {/* Cancel option */}
            <TouchableOpacity style={styles.cancelOption} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    margin: 20,
    maxWidth: 300,
    width: '80%',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primaryText,
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  optionText: {
    fontSize: 16,
    color: COLORS.primaryText,
    marginLeft: 12,
  },
  dangerText: {
    color: COLORS.dangerRed,
  },
  cancelOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.secondaryText,
    fontWeight: '500',
  },
});