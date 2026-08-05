import { useState } from 'react';
import { Alert } from 'react-native';
import ApiService from '@/lib/services/ApiService';
import { GroupCardData } from '@/components/ui/GroupCard';

export interface JoinGroupData {
  id: number;
  name: string;
  description: string;
  cost: number;
  expiryDate: string;
  isFreeGroup: boolean;
}

export interface UseJoinGroupReturn {
  joinModalVisible: boolean;
  selectedGroup: JoinGroupData | null;
  groupDetailsLoading: boolean;
  loadingGroupId: number | null;
  handleJoinGroup: (group: GroupCardData) => Promise<void>;
  setJoinModalVisible: (visible: boolean) => void;
  setSelectedGroup: (group: JoinGroupData | null) => void;
  closeJoinModal: () => void;
}

export function useJoinGroup(onRefresh?: () => void): UseJoinGroupReturn {
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<JoinGroupData | null>(null);
  const [groupDetailsLoading, setGroupDetailsLoading] = useState(false);
  const [loadingGroupId, setLoadingGroupId] = useState<number | null>(null);

  const handleJoinGroup = async (group: GroupCardData) => {
    try {
      setGroupDetailsLoading(true);
      setLoadingGroupId(group.id);
      
      // Get full group details including expiry date
      const response = await ApiService.getGroupCard(group.id);
      
      if (response.success && response.data) {
        const groupData = response.data;

        // Prepare data for join modal - use API response data as the source of truth
        setSelectedGroup({
          id: groupData.id,
          name: groupData.name,
          description: groupData.description,
          cost: groupData.cost,
          expiryDate: groupData.expiry_on || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default to 30 days if not provided
          isFreeGroup: groupData.cost === 0,
        });
        setJoinModalVisible(true);
      } else {
        Alert.alert('Error', 'Failed to load group details');
      }
    } catch (error) {
      console.error('Error loading group details:', error);
      Alert.alert('Error', 'Failed to load group details. Please try again.');
    } finally {
      setGroupDetailsLoading(false);
      setLoadingGroupId(null);
    }
  };

  const closeJoinModal = () => {
    setJoinModalVisible(false);
    setSelectedGroup(null);
    setLoadingGroupId(null);
    // Refresh the current view if callback provided
    if (onRefresh) {
      onRefresh();
    }
  };

  return {
    joinModalVisible,
    selectedGroup,
    groupDetailsLoading,
    loadingGroupId,
    handleJoinGroup,
    setJoinModalVisible,
    setSelectedGroup,
    closeJoinModal,
  };
}