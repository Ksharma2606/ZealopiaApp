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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import ApiService, { MedicProfile } from '@/lib/services/ApiService';
import { useAuthContext } from '@/lib/context/AuthContext';
import SortModal from '@/components/modals/SortModal';
import FilterModal from '@/components/modals/FilterModal';
import JoinGroupModal from '@/components/modals/group/JoinGroupModal';
import GroupCard, { GroupCardData } from '@/components/ui/GroupCard';
import MedicCard from '@/components/ui/MedicCard';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import { useJoinGroup } from '@/lib/hooks/useJoinGroup';
import Colors from '@/constants/Colors';
import { BaseText as Text } from '@/components/ui/Base';

// Use GroupCardData from the component

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

export default function ExploreTab() {
  const { user } = useAuthContext();
  const params = useLocalSearchParams<{ joinGroupId?: string }>();
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
  const [processedJoinGroupId, setProcessedJoinGroupId] = useState<string | null>(null);

  // Medic 1-1 chat states
  const [availableMedics, setAvailableMedics] = useState<MedicProfile[]>([]);
  const [medicsLoading, setMedicsLoading] = useState(false);
  const [expandedMedics, setExpandedMedics] = useState(true);
  const [selectedMedic, setSelectedMedic] = useState<MedicProfile | null>(null);
  const [oneOnOneModalVisible, setOneOnOneModalVisible] = useState(false);

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

  // onRefresh function for useJoinGroup hook
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

  // Join group functionality
  const {
    joinModalVisible,
    selectedGroup,
    groupDetailsLoading,
    loadingGroupId,
    handleJoinGroup,
    closeJoinModal,
  } = useJoinGroup(onRefresh);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Handle deep link join group parameter
  useEffect(() => {
    if (params.joinGroupId && !loading && params.joinGroupId !== processedJoinGroupId) {
      // Data has loaded and we haven't processed this group ID yet
      console.log('[Explore] Deep link join request for group:', params.joinGroupId);

      // Mark this group ID as processed to prevent re-triggering
      setProcessedJoinGroupId(params.joinGroupId);

      // Find the group in loaded data and trigger join modal
      const groupId = parseInt(params.joinGroupId);

      // Create a mock group object with just the ID to trigger the join flow
      // The useJoinGroup hook will fetch full details
      handleJoinGroup({ id: groupId } as any);
    }
  }, [params.joinGroupId, loading, processedJoinGroupId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTopics(),
        loadFilterOptions(),
        loadAvailableMedics(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableMedics = async () => {
    try {
      setMedicsLoading(true);
      const response = await ApiService.getAvailableMedicsForChat();
      if (response.success && response.data) {
        // Sort by match_percentage descending
        const sortedMedics = [...response.data].sort(
          (a, b) => (b.match_percentage || 0) - (a.match_percentage || 0)
        );
        setAvailableMedics(sortedMedics);
      }
    } catch (error) {
      console.error('Error loading available medics:', error);
    } finally {
      setMedicsLoading(false);
    }
  };

  const handleMedicClick = (medic: MedicProfile) => {
    setSelectedMedic(medic);
    setOneOnOneModalVisible(true);
  };

  const handleOneOnOneSuccess = (firebaseUid: string) => {
    setOneOnOneModalVisible(false);
    setSelectedMedic(null);

    // Navigate to chat
    router.push({
      pathname: '/chat-detail',
      params: { groupId: firebaseUid }
    });

    // Refresh medics list
    loadAvailableMedics();
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


  const handleSortChange = useCallback((sortOption: string) => {
    setSelectedSortOption(sortOption);
    setTimeout(() => handleSearch(searchText), 100);
  }, [handleSearch, searchText]);

  const handleFiltersChange = useCallback((filters: FilterState) => {
    setCurrentFilters(filters);
    setTimeout(() => handleSearch(searchText), 100);
  }, [handleSearch, searchText]);
  
  const handleUpdateFilterOptions = useCallback(async (filters: Partial<FilterState>) => {
    // Update filter options dynamically like Flutter Flow does
    await loadFilterOptions(filters);
  }, []);


  const renderGroupCard = (group: any) => (
    <GroupCard
      key={group.id}
      group={{
        ...group,
        defaultGroupPicUrl: group.default_group_pic_url || group.defaultGroupPicUrl || undefined
      }}
      onPress={handleJoinGroup}
      loading={loadingGroupId === group.id}
    />
  );

  const renderSearchResults = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
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
        {groups.map((group) => renderGroupCard(group))}
      </View>
    );
  };

  const handleTopicToggle = (topicId: number, isExpanded: boolean) => {
    const newExpanded = new Set(expandedTopics);
    if (isExpanded) {
      newExpanded.add(topicId);
      // Load groups when expanding if not already loaded
      if (!topicGroups[topicId]) {
        loadGroupsByTopic(topicId);
      }
    } else {
      newExpanded.delete(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const renderTopicSection = (topic: Topic) => {
    const isExpanded = expandedTopics.has(topic.id);
    const groups = topicGroups[topic.id] || [];
    const isLoading = topicGroupsLoading[topic.id] || false;

    return (
      <CollapsibleSection
        key={topic.id}
        title={topic.name}
        initialExpanded={isExpanded}
        onToggle={(expanded) => handleTopicToggle(topic.id, expanded)}
        style={styles.topicSection}
        headerStyle={styles.topicHeader}
        titleStyle={styles.topicName}
        contentStyle={styles.topicContent}
      >
        {isLoading ? (
          <View style={styles.topicLoading}>
            <ActivityIndicator size="small" color="#FFD700" />
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyTopicState}>
            <Text style={styles.emptyTopicText}>No groups available for this topic yet</Text>
          </View>
        ) : (
          groups.map((group) => renderGroupCard(group))
        )}
      </CollapsibleSection>
    );
  };

  const renderMedicsSection = () => {
    return (
      <CollapsibleSection
        title="Expert Matches"
        initialExpanded={expandedMedics}
        onToggle={(expanded) => setExpandedMedics(expanded)}
        style={styles.topicSection}
        headerStyle={styles.topicHeader}
        titleStyle={styles.topicName}
        contentStyle={styles.topicContent}
      >
        {medicsLoading ? (
          <View style={styles.topicLoading}>
            <ActivityIndicator size="small" color="#FFD700" />
            <Text style={styles.loadingText}>Loading medics...</Text>
          </View>
        ) : availableMedics.length === 0 ? (
          <View style={styles.emptyTopicContainer}>
            <Text style={styles.emptyTopicText}>No medics available for 1-1 chat at the moment</Text>
          </View>
        ) : (
          <View>
            {availableMedics.map((medic, i) => (
              <MedicCard
                key={medic.id}
                medic={medic}
                onPress={handleMedicClick}
                gradient={i < 2}
              />
            ))}
          </View>
        )}
      </CollapsibleSection>
    );
  };

  const renderTopicBrowser = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading topics...</Text>
        </View>
      );
    }

    return (
      <View style={styles.topicBrowser}>
        {renderMedicsSection()}
        {topics.map(renderTopicSection)}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for groups here"
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text);
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
            <Ionicons name="funnel-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>Sort</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="options-outline" size={20} color={Colors.primary} />
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

      {/* Join One-on-One Modal */}
      <JoinGroupModal
        visible={oneOnOneModalVisible}
        onClose={() => {
          setOneOnOneModalVisible(false);
          setSelectedMedic(null);
        }}
        isOneOnOne={true}
        medic={selectedMedic}
        matchText={selectedMedic?.match_text}
        onOneOnOneSuccess={handleOneOnOneSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    // backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
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
    color: Colors.primary,
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
    paddingHorizontal: 16,
  },
  searchResults: {
    paddingTop: 16,
  },
  topicBrowser: {
    paddingTop: 16,
  },
  // Topic section styles - now using CollapsibleSection component
  topicSection: {
    marginBottom: 8,
    marginHorizontal: 6,
  },
  topicHeader: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.secondaryText,
  },
  topicContent: {
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
});