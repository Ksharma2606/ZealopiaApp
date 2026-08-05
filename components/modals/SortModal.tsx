import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SortOption {
  value: string;
  label: string;
  description?: string;
}

interface SortModalProps {
  visible: boolean;
  onClose: () => void;
  selectedOption?: string;
  onSelectOption: (option: string) => void;
}

const SORT_OPTIONS: SortOption[] = [
  { value: '', label: 'Default', description: 'Recommended order' },
  { value: 'cost', label: 'Price: Low to High', description: 'Cheapest first' },
  { value: '-cost', label: 'Price: High to Low', description: 'Most expensive first' },
  { value: '-created_at', label: 'Date: Newest to Oldest', description: 'Recently created first' },
  { value: 'created_at', label: 'Date: Oldest to Newest', description: 'Oldest first' },
  { value: '-num_members', label: 'Members: Most to Least', description: 'Most popular first' },
  { value: 'num_members', label: 'Members: Least to Most', description: 'Smallest groups first' },
];

const SortModal: React.FC<SortModalProps> = ({
  visible,
  onClose,
  selectedOption = '',
  onSelectOption,
}) => {
  const handleOptionSelect = (value: string) => {
    onSelectOption(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Sort By</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.optionsList}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  selectedOption === option.value && styles.selectedOption,
                ]}
                onPress={() => handleOptionSelect(option.value)}
              >
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionLabel,
                    selectedOption === option.value && styles.selectedLabel,
                  ]}>
                    {option.label}
                  </Text>
                  {option.description && (
                    <Text style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  )}
                </View>
                {selectedOption === option.value && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34, // Safe area padding for home indicator
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    paddingVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#f0f8ff',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  selectedLabel: {
    color: '#007AFF',
  },
  optionDescription: {
    fontSize: 12,
    color: '#666',
  },
});

export default SortModal;