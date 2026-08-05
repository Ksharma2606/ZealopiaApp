import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '@/lib/services/ApiService';
import Colors from '@/constants/Colors';

interface Topic {
  id: number;
  name: string;
}

interface TopicsSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (selectedTopics: Topic[]) => void;
  currentTopics?: Topic[];
}

export default function TopicsSelectionModal({
  visible,
  onClose,
  onSave,
  currentTopics = [],
}: TopicsSelectionModalProps) {
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initialize selected topics when modal opens
  useEffect(() => {
    if (visible) {
      const currentTopicIds = new Set(currentTopics.map(topic => topic.id));
      setSelectedTopicIds(currentTopicIds);
      loadAllTopics();
    }
  }, [visible, currentTopics]);

  const loadAllTopics = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getTopics();
      
      if (response.success && response.data) {
        setAllTopics(response.data);
      } else {
        Alert.alert('Error', 'Failed to load topics. Please try again.');
      }
    } catch (error) {
      console.error('Error loading topics:', error);
      Alert.alert('Error', 'Failed to load topics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = (topicId: number) => {
    const newSelected = new Set(selectedTopicIds);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      newSelected.add(topicId);
    }
    setSelectedTopicIds(newSelected);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Call API to update user topics
      const selectedTopicIdsArray = Array.from(selectedTopicIds);
      const response = await ApiService.updateUserTopics(selectedTopicIdsArray);
      
      if (response.success) {
        // Get the selected topic objects
        const selectedTopics = allTopics.filter(topic => selectedTopicIds.has(topic.id));
        onSave(selectedTopics);
        onClose();
      } else {
        Alert.alert('Error', 'Failed to save interests. Please try again.');
      }
    } catch (error) {
      console.error('Error saving topics:', error);
      Alert.alert('Error', 'Failed to save interests. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  const selectedCount = selectedTopicIds.size;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={saving}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Select Your Interests</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Choose topics that interest you to get better group recommendations
        </Text>

        {/* Selected count */}
        <View style={styles.selectedCountContainer}>
          <Text style={styles.selectedCountText}>
            {selectedCount} topic{selectedCount !== 1 ? 's' : ''} selected
          </Text>
        </View>

        {/* Topics List */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading topics...</Text>
            </View>
          ) : (
            <View style={styles.topicsList}>
              {allTopics.map((topic) => {
                const isSelected = selectedTopicIds.has(topic.id);
                return (
                  <TouchableOpacity
                    key={topic.id}
                    style={[
                      styles.topicItem,
                      isSelected && styles.topicItemSelected,
                    ]}
                    onPress={() => toggleTopic(topic.id)}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.topicText,
                        isSelected && styles.topicTextSelected,
                      ]}
                    >
                      {topic.name}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={Colors.primary}
                        style={styles.checkIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (loading || saving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={loading || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Interests</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    lineHeight: 20,
  },
  selectedCountContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  selectedCountText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  topicsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topicItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#f8f9ff',
  },
  topicText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  topicTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});