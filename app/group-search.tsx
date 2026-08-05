import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../lib/services/ApiService';
import { useAuth } from '../lib/context/AuthContext';
import SortModal from '../components/modals/SortModal';
import FilterModal from '../components/modals/FilterModal';
import JoinGroupModal from '../components/modals/group/JoinGroupModal';
import { BaseText as Text } from '@/components/ui/Base';
import { useJoinGroup } from '@/lib/hooks/useJoinGroup';
import GroupCard, { GroupCardData } from '@/components/ui/GroupCard';

// Remove GroupCard interface as we're using GroupCardData from the component

interface FilterOption {
  label: string;
  value: number;
}

interface Topic {
  id: number;
  name: string;
}

interface FilterState {
  selectedMedics: number[];
  selectedTopics: number[];
  costFilter: 'all' | 'free' | 'paid';
}

const GroupSearchScreen = () => {
  const { user } = useAuth();
  
  // Join group functionality
  const {
    joinModalVisible,
    selectedGroup,
    groupDetailsLoading,
    loadingGroupId,
    handleJoinGroup,
    closeJoinModal,
  } = useJoinGroup(() => {
    // Refresh the current view after successful join
    handleSearch(searchText);
  });
  const [searchText, setSearchText] = useState('');
  const [groups, setGroups] = useState<GroupCardData[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchApplied, setSearchApplied] = useState(false);
  const [showingTopicView, setShowingTopicView] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
  const [topicGroups, setTopicGroups] = useState<Record<number, GroupCardData[]>>({});
  const [topicGroupsLoading, setTopicGroupsLoading] = useState<Record<number, boolean>>({});

  // Filter states
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [selectedSortOption, setSelectedSortOption] = useState<string>('');
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    selectedMedics: [],
    selectedTopics: [],
    costFilter: 'all',
  });
  const [availableFilters, setAvailableFilters] = useState<{
    medics: FilterOption[];
    topics: FilterOption[];
  }>({ medics: [], topics: [] });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTopics(),
        loadFilterOptions(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTopics = async () => {
    try {
      const response = await ApiService.getTopics();
      if (response.success && response.data) {
        setTopics(response.data);
        // Initialize expanded topics (all expanded by default like Flutter)
        const initialExpanded = new Set(response.data.map(topic => topic.id));
        setExpandedTopics(initialExpanded);
        
        // Load groups for all topics initially
        await Promise.all(response.data.map(topic => loadGroupsByTopic(topic.id)));
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  };

  const loadGroupsByTopic = async (topicId: number) => {
    if (topicGroups[topicId] || topicGroupsLoading[topicId]) {
      return; // Already loaded or loading
    }

    try {
      setTopicGroupsLoading(prev => ({ ...prev, [topicId]: true }));
      const response = await ApiService.getGroupsByTopic(topicId);
      
      if (response.success && response.data) {
        setTopicGroups(prev => ({ ...prev, [topicId]: response.data || [] }));
      } else {
        setTopicGroups(prev => ({ ...prev, [topicId]: [] }));
      }
    } catch (error) {
      console.error(`Error loading groups for topic ${topicId}:`, error);
      setTopicGroups(prev => ({ ...prev, [topicId]: [] }));
    } finally {
      setTopicGroupsLoading(prev => ({ ...prev, [topicId]: false }));
    }
  };

  const loadFilterOptions = async (filters?: Partial<FilterState>) => {
    try {
      // Build filter options request like Flutter Flow does
      const filterOptionsRequest: any = {};
      
      // Add cost filter
      if (filters?.costFilter) {
        if (filters.costFilter === 'free') {
          filterOptionsRequest.is_free = true;
        } else if (filters.costFilter === 'paid') {
          filterOptionsRequest.is_free = false;
        }
      }
      
      // Add selected topics
      if (filters?.selectedTopics && filters.selectedTopics.length > 0) {
        filterOptionsRequest.topics = filters.selectedTopics;
      }
      
      // Add selected medics
      if (filters?.selectedMedics && filters.selectedMedics.length > 0) {
        filterOptionsRequest.medics = filters.selectedMedics;
      }
      
      const response = await ApiService.getFilterOptions(filterOptionsRequest);
      
      if (response.success && response.data) {
        setAvailableFilters(response.data);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const buildSearchParams = useCallback((searchQuery?: string) => {
    const params: any = {};
    
    if (searchQuery && searchQuery.trim() !== '') {
      params.search = searchQuery.trim();
    }
    
    if (selectedSortOption) {
      params.ordering = selectedSortOption;
    }
    
    // Add filter parameters
    if (currentFilters.selectedMedics.length > 0) {
      params.medic__in = currentFilters.selectedMedics.join(',');
    }
    
    if (currentFilters.selectedTopics.length > 0) {
      params.topic__in = currentFilters.selectedTopics.join(',');
    }
    
    if (currentFilters.costFilter === 'free') {
      params.cost = '0';
    } else if (currentFilters.costFilter === 'paid') {
      params.cost__gt = '0';
    }
    
    return params;
  }, [selectedSortOption, currentFilters]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    const hasSearchQuery = searchQuery.trim() !== '';
    const hasFilters = currentFilters.selectedMedics.length > 0 || 
                     currentFilters.selectedTopics.length > 0 || 
                     currentFilters.costFilter !== 'all';
    
    if (!hasSearchQuery && !hasFilters) {
      setSearchApplied(false);
      setShowingTopicView(true);
      setGroups([]);
      return;
    }

    setSearchApplied(true);
    setShowingTopicView(false);
    setLoading(true);

    try {
      const params = buildSearchParams(searchQuery);
      const response = await ApiService.searchGroups(params);

      if (response.success && response.data) {
        setGroups(response.data);
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.error('Error searching groups:', error);
      Alert.alert('Error', 'Failed to search groups. Please try again.');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [buildSearchParams, currentFilters]);

  // handleJoinGroup is now provided by useJoinGroup hook

  const handleSortChange = useCallback((sortOption: string) => {
    setSelectedSortOption(sortOption);
    // Re-run search with new sort option
    setTimeout(() => handleSearch(searchText), 100);
  }, [handleSearch, searchText]);

  const handleFiltersChange = useCallback((filters: FilterState) => {
    setCurrentFilters(filters);
    // Re-run search with new filters
    setTimeout(() => handleSearch(searchText), 100);
  }, [handleSearch, searchText]);
  
  const handleUpdateFilterOptions = useCallback(async (filters: Partial<FilterState>) => {
    // Update filter options dynamically like Flutter Flow does
    await loadFilterOptions(filters);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (searchApplied) {
        await handleSearch(searchText);
      } else {
        await loadInitialData();
      }
    } finally {
      setRefreshing(false);
    }
  }, [searchApplied, searchText, handleSearch]);

  const renderGroupCard = (group: GroupCardData) => (
    <GroupCard
      key={group.id}
      group={group}
      onPress={handleJoinGroup}
      loading={loadingGroupId === group.id}
    />
  );

  const renderSearchResults = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching groups...</Text>
        </View>
      );
    }

    if (groups.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Groups Found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your search terms or filters
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.searchResults}>
        <Text style={styles.sectionTitle}>
          Available Groups ({groups.length} found)
        </Text>
        {groups.map(renderGroupCard)}
      </View>
    );
  };

  const toggleTopicExpansion = (topicId: number) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
      // Load groups when expanding if not already loaded
      if (!topicGroups[topicId]) {
        loadGroupsByTopic(topicId);
      }
    }
    setExpandedTopics(newExpanded);
  };

  const renderTopicSection = (topic: Topic) => {
    const isExpanded = expandedTopics.has(topic.id);
    const groups = topicGroups[topic.id] || [];
    const isLoading = topicGroupsLoading[topic.id] || false;

    return (
      <View key={topic.id} style={styles.topicSection}>
        {/* Topic Header */}
        <TouchableOpacity
          style={styles.topicHeader}
          onPress={() => toggleTopicExpansion(topic.id)}
        >
          <Text style={styles.topicName}>{topic.name}</Text>
          <Ionicons 
            name={isExpanded ? "chevron-down" : "chevron-forward"} 
            size={20} 
            color="#007AFF" 
          />
        </TouchableOpacity>

        {/* Expanded Content */}
        {isExpanded && (
          <View style={styles.topicContent}>
            {isLoading ? (
              <View style={styles.topicLoading}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>Loading groups...</Text>
              </View>
            ) : groups.length === 0 ? (
              <View style={styles.emptyTopicState}>
                <Text style={styles.emptyTopicText}>No groups available for this topic yet</Text>
              </View>
            ) : (
              groups.map(renderGroupCard)
            )}
          </View>
        )}
      </View>
    );
  };

  const renderTopicBrowser = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading topics...</Text>
        </View>
      );
    }

    return (
      <View style={styles.topicBrowser}>
        <Text style={styles.sectionTitle}>Browse by Topic</Text>
        {topics.map(renderTopicSection)}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Groups</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#007AFF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for groups here"
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text);
              // Debounce search
              setTimeout(() => handleSearch(text), 500);
            }}
            placeholderTextColor="#666"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchText('');
                handleSearch('');
              }}
            >
              <Ionicons name="close" size={20} color="#ff6b6b" />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort and Filter Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setSortModalVisible(true)}
          >
            <Ionicons name="funnel-outline" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Sort</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="options-outline" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Filter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {showingTopicView ? renderTopicBrowser() : renderSearchResults()}
      </ScrollView>

      {/* Modals */}
      <SortModal
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        selectedOption={selectedSortOption}
        onSelectOption={handleSortChange}
      />

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        availableMedics={availableFilters.medics}
        availableTopics={availableFilters.topics}
        currentFilters={currentFilters}
        onApplyFilters={handleFiltersChange}
        onUpdateFilterOptions={handleUpdateFilterOptions}
      />
      
      {/* Join Group Modal */}
      {selectedGroup && (
        <JoinGroupModal
          visible={joinModalVisible}
          onClose={closeJoinModal}
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          groupDescription={selectedGroup.description}
          groupCost={selectedGroup.cost}
          expiryDate={selectedGroup.expiryDate}
          isFreeGroup={selectedGroup.isFreeGroup}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  centerContainer: {
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  searchResults: {
    padding: 16,
  },
  topicBrowser: {
    padding: 16,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  topicName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  groupCost: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  groupDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  groupMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medicInfo: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  joinButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Topic section styles
  topicSection: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  topicContent: {
    padding: 16,
    paddingTop: 0,
  },
  topicLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyTopicState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyTopicText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
});

export default GroupSearchScreen;