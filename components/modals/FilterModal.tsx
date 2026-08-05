import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FilterOption {
  label: string;
  value: number;
}

interface FilterState {
  selectedMedics: number[];
  selectedTopics: number[];
  costFilter: 'all' | 'free' | 'paid';
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  availableMedics: FilterOption[];
  availableTopics: FilterOption[];
  currentFilters: FilterState;
  onApplyFilters: (filters: FilterState) => void;
  onUpdateFilterOptions?: (filters: Partial<FilterState>) => Promise<void>;
}

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  availableMedics,
  availableTopics,
  currentFilters,
  onApplyFilters,
  onUpdateFilterOptions,
}) => {
  const [localFilters, setLocalFilters] = useState<FilterState>(currentFilters);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['cost', 'topics', 'medics']));
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  useEffect(() => {
    setLocalFilters(currentFilters);
  }, [currentFilters, visible, availableMedics, availableTopics, expandedSections]);
  
  // Ensure all sections are expanded when modal opens and data is available
  useEffect(() => {
    if (visible && (availableMedics.length > 0 || availableTopics.length > 0)) {
      setExpandedSections(new Set(['cost', 'topics', 'medics']));
    }
  }, [visible, availableMedics.length, availableTopics.length]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const toggleMedic = (medicId: number) => {
    const newMedics = localFilters.selectedMedics.includes(medicId)
      ? localFilters.selectedMedics.filter(id => id !== medicId)
      : [...localFilters.selectedMedics, medicId];
    
    setLocalFilters(prev => ({
      ...prev,
      selectedMedics: newMedics,
    }));
  };

  const toggleTopic = (topicId: number) => {
    const newTopics = localFilters.selectedTopics.includes(topicId)
      ? localFilters.selectedTopics.filter(id => id !== topicId)
      : [...localFilters.selectedTopics, topicId];
    
    setLocalFilters(prev => ({
      ...prev,
      selectedTopics: newTopics,
    }));
  };

  const setCostFilter = (costFilter: 'all' | 'free' | 'paid') => {
    // Allow toggling cost filters like Flutter Flow does
    // If the same filter is selected, unselect it (go back to 'all')
    const newCostFilter = localFilters.costFilter === costFilter ? 'all' : costFilter;
    
    setLocalFilters(prev => ({
      ...prev,
      costFilter: newCostFilter,
    }));
  };

  const handleApply = async () => {
    // Update filter options when applying (like Flutter Flow dynamic updates)
    if (onUpdateFilterOptions) {
      setFilterOptionsLoading(true);
      try {
        await onUpdateFilterOptions(localFilters);
      } catch (error) {
        console.error('Error updating filter options:', error);
      } finally {
        setFilterOptionsLoading(false);
      }
    }
    
    onApplyFilters(localFilters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters: FilterState = {
      selectedMedics: [],
      selectedTopics: [],
      costFilter: 'all',
    };
    setLocalFilters(clearedFilters);
    onApplyFilters(clearedFilters);
    onClose();
  };

  const hasActiveFilters = 
    localFilters.selectedMedics.length > 0 || 
    localFilters.selectedTopics.length > 0 || 
    localFilters.costFilter !== 'all';

  const renderSection = (title: string, key: string, children: React.ReactNode) => {
    const isExpanded = expandedSections.has(key);
    
    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(key)}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
        <View style={styles.sectionContent}>
          {isExpanded ? children : <Text style={styles.emptyText}>Section collapsed</Text>}
        </View>
      </View>
    );
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
            <Text style={styles.title}>Filter Groups</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Cost Filter */}
            {renderSection('Group Type', 'cost', (
              <View style={styles.costOptions}>
                <TouchableOpacity
                  style={[
                    styles.costOption,
                    localFilters.costFilter === 'all' && styles.selectedCostOption,
                  ]}
                  onPress={() => setCostFilter('all')}
                  disabled={filterOptionsLoading}
                >
                  <Text style={[
                    styles.costOptionText,
                    localFilters.costFilter === 'all' && styles.selectedCostOptionText,
                  ]}>
                    All Groups
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.costOption,
                    localFilters.costFilter === 'free' && styles.selectedCostOption,
                  ]}
                  onPress={() => setCostFilter('free')}
                  disabled={filterOptionsLoading}
                >
                  <Text style={[
                    styles.costOptionText,
                    localFilters.costFilter === 'free' && styles.selectedCostOptionText,
                  ]}>
                    Free Groups
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.costOption,
                    localFilters.costFilter === 'paid' && styles.selectedCostOption,
                  ]}
                  onPress={() => setCostFilter('paid')}
                  disabled={filterOptionsLoading}
                >
                  <Text style={[
                    styles.costOptionText,
                    localFilters.costFilter === 'paid' && styles.selectedCostOptionText,
                  ]}>
                    Paid Groups
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Topics Filter */}
            {renderSection('Topics', 'topics', (
              <View style={styles.checkboxList}>
                {availableTopics.length > 0 ? (
                  availableTopics.map((topic) => (
                    <TouchableOpacity
                      key={topic.value}
                      style={styles.checkboxItem}
                      onPress={() => toggleTopic(topic.value)}
                    >
                      <View style={[
                        styles.checkbox,
                        localFilters.selectedTopics.includes(topic.value) && styles.checkedBox,
                      ]}>
                        {localFilters.selectedTopics.includes(topic.value) && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>{topic.label}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No topics available</Text>
                )}
              </View>
            ))}

            {/* Medics Filter */}
            {renderSection('Medical Professionals', 'medics', (
              <View style={styles.checkboxList}>
                {availableMedics.length > 0 ? (
                  availableMedics.map((medic) => (
                    <TouchableOpacity
                      key={medic.value}
                      style={styles.checkboxItem}
                      onPress={() => toggleMedic(medic.value)}
                    >
                      <View style={[
                        styles.checkbox,
                        localFilters.selectedMedics.includes(medic.value) && styles.checkedBox,
                      ]}>
                        {localFilters.selectedMedics.includes(medic.value) && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>{medic.label}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No medical professionals available</Text>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={handleClear}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.applyButton, filterOptionsLoading && styles.buttonDisabled]}
              onPress={handleApply}
              disabled={filterOptionsLoading}
            >
              <Text style={styles.applyButtonText}>
                {filterOptionsLoading ? 'Applying...' : `Apply${hasActiveFilters ? ' Filters' : ''}`}
              </Text>
            </TouchableOpacity>
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
    minHeight: '70%',
    maxHeight: '80%',
    paddingBottom: 34, // Safe area padding
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
  content: {
    flex: 1,
    minHeight: 200,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 50,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    minHeight: 40,
  },
  costOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  costOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  selectedCostOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  costOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedCostOptionText: {
    color: '#fff',
    fontWeight: '500',
  },
  checkboxList: {
    gap: 12,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#007AFF',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default FilterModal;