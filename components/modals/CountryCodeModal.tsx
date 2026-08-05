import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRY_CODES, CountryDialCode, getFlagEmoji } from '@/constants/CountryCodes';

interface CountryCodeModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDialCode: string;
  onSelectCountry: (country: CountryDialCode) => void;
}

const CountryCodeModal: React.FC<CountryCodeModalProps> = ({
  visible,
  onClose,
  selectedDialCode,
  onSelectCountry,
}) => {
  const [query, setQuery] = useState('');

  const filteredCountries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      (country) =>
        country.name.toLowerCase().includes(normalized) ||
        country.dialCode.includes(normalized)
    );
  }, [query]);

  const handleSelect = (country: CountryDialCode) => {
    onSelectCountry(country);
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Country Code</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search country or code"
              placeholderTextColor="#999"
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.iso2}
            keyboardShouldPersistTaps="handled"
            style={styles.optionsList}
            renderItem={({ item }) => {
              const isSelected = item.dialCode === selectedDialCode;
              return (
                <TouchableOpacity
                  style={[styles.option, isSelected && styles.selectedOption]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.flag}>{getFlagEmoji(item.iso2)}</Text>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionLabel, isSelected && styles.selectedLabel]}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={[styles.dialCode, isSelected && styles.selectedLabel]}>
                    {item.dialCode}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" style={styles.checkmark} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No countries match your search</Text>
            }
          />
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
    maxHeight: '75%',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f2f2f2',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    padding: 0,
  },
  optionsList: {
    paddingVertical: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#f0f8ff',
  },
  flag: {
    fontSize: 22,
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  selectedLabel: {
    color: '#007AFF',
  },
  dialCode: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  checkmark: {
    marginLeft: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 24,
  },
});

export default CountryCodeModal;
