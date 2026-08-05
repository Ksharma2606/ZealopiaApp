import React from 'react';
import { 
  Modal, 
  View, 
  Image, 
  StyleSheet, 
  TouchableOpacity, 
  Text, 
  Dimensions,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string;
  onSend: () => void;
  onCancel: () => void;
  isSending?: boolean;
}

export function ImagePreviewModal({ 
  visible, 
  imageUri, 
  onSend, 
  onCancel,
  isSending = false 
}: ImagePreviewModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={onCancel}
            disabled={isSending}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Image</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: imageUri }} 
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={isSending}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.sendButton, isSending && styles.sendButtonDisabled]}
            onPress={onSend}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.sendButtonText}>Send</Text>
                <Ionicons name="send" size={20} color="#fff" style={styles.sendIcon} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  image: {
    width: screenWidth - 32,
    height: screenHeight * 0.6,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sendButton: {
    backgroundColor: Colors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sendIcon: {
    marginLeft: 8,
  },
});