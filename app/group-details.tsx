import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Image,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import apiService from '../lib/services/ApiService';
import { useAuth } from '../lib/context/AuthContext';
import LeaveGroupModal from '../components/modals/group/LeaveGroupModal';
import RemoveMemberModal from '../components/modals/group/RemoveMemberModal';
import JoinGroupModal from '../components/modals/group/JoinGroupModal';
import WithdrawGroupModal from '../components/modals/group/WithdrawGroupModal';
import DeleteGroupModal from '../components/modals/group/DeleteGroupModal';
import Colors from '@/constants/Colors';
import { BaseText as Text } from '@/components/ui/Base';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Move Header component outside and pass insets as props
const Header = ({ insets, groupDetails, titleText, titleDisabled, handleHeaderPress }: { insets: any, groupDetails: any, titleText: string, titleDisabled: boolean, handleHeaderPress: () => void }) => {

  const handleShare = async () => {
    if (!groupDetails) {
      console.error('Group details not found');
      return;
    }

    try {
      const message = `Follow this link to join a Zealopia group to chat with strangers who can understand you and a therapist. Let's get happy together: https://api2.zealopia.com/group/${groupDetails.id}`;

      await Share.share({
        message,
        title: groupDetails.name,
      });
    } catch (error) {
      console.error('Error sharing group:', error);
    }
  };

  return (
    <View style={{ 
      backgroundColor: Colors.headerFooter,
      paddingTop: insets.top + 10,
      paddingHorizontal: 16,
      paddingBottom: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
    }}>
      <TouchableOpacity
        onPress={() => router.back()} 
        style={{
          padding: 8,
          position: 'absolute',
          left: 5,
          bottom: 10
        }}
      >
        <Ionicons name="chevron-back-outline" size={24} color={Colors.white} />
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={titleDisabled ? undefined : handleHeaderPress}
        disabled={titleDisabled}
      >
        <Text style={{
          fontSize: 20,
          fontWeight: '600',
          color: Colors.white,
        }}>{titleText}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleShare} style={[
        styles.shareButton,
        {
          position: 'absolute',
          right: 5,
          bottom: 15
        }
      ]}>
        <Ionicons name="share-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

interface GroupDetails {
  id: number;
  name: string;
  description: string;
  cost?: number;
  num_members?: number;
  status?: string;
  expiry_on?: string;
  firebase_uid?: string;
  topic?: {
    id: number;
    name: string;
  };
  medic?: {
    id: number;
    name: string;
    title?: string;
    bio?: string;
    profile_picture?: string;
  };
  template?: {
    max_number_of_members: number;
    expiry_months: number;
  };
  is_member: boolean;
  is_admin: boolean;
  membership_status?: string;
  members?: GroupMember[]; // Members data from backend
}

interface GroupMember {
  name: string;
  role: 'Admin' | 'Member';
  profile_picture?: string;
  group_id: number;
  user_id: number;
}

export default function GroupDetailsScreen() {
  const params = useLocalSearchParams<{ 
    groupId: string;
    groupFirebaseUid?: string;
    groupName?: string;
  }>();
  const { backendUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'members'>('details');
  const [error, setError] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: number; userId: number; name: string } | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadGroupData();
  }, [params.groupId]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load group details
      const detailsResponse = await apiService.getGroupDetails(parseInt(params.groupId));
      if (detailsResponse.success && detailsResponse.data) {
        // Backend returns members data in the same response
        const groupData = detailsResponse.data;
        const isAdmin = groupData.members?.some(member => 
          member.user_id === backendUser?.id && member.role === 'Admin'
        ) || false;

        console.log('Group Details Debug:', {
          groupId: params.groupId,
          status: groupData.status,
          isAdmin,
          isMember: true,
          backendUserId: backendUser?.id,
          members: groupData.members?.map(m => ({ user_id: m.user_id, role: m.role }))
        });

        // Also try to get group card data to get complete information including max_members
        let cardData = null;
        try {
          const cardResponse = await apiService.getGroupCard(parseInt(params.groupId));
          if (cardResponse.success && cardResponse.data) {
            cardData = cardResponse.data;
          }
        } catch (error) {
          console.log('Could not get group card data:', error);
        }

        setGroupDetails({
          id: parseInt(params.groupId), // Add the group ID from params
          ...groupData,
          // Add data from group card if available
          num_members: cardData?.num_members || groupData.members?.length || 0,
          template: cardData?.template || { max_number_of_members: 12, expiry_months: 1 },
          cost: cardData?.cost !== undefined ? cardData.cost : 0,
          status: cardData?.status || groupData.status || 'Active',
          is_member: true, // If we get a successful response, user is a member
          is_admin: isAdmin,
        });
        
        // Set members from the response
        if (groupData.members) {
          setMembers(groupData.members);
        }
      } else if (detailsResponse.status === 403) {
        // User is not a member, try to get group card info instead
        const cardResponse = await apiService.getGroupCard(parseInt(params.groupId));
        if (cardResponse.success && cardResponse.data) {
          // Show join modal or limited info
          setGroupDetails({
            id: cardResponse.data.id,
            name: cardResponse.data.name,
            description: cardResponse.data.description,
            cost: cardResponse.data.cost,
            num_members: cardResponse.data.num_members,
            status: cardResponse.data.status,
            expiry_on: cardResponse.data.expiry_on || '',
            firebase_uid: cardResponse.data.firebase_uid || '',
            topic: cardResponse.data.topic,
            medic: cardResponse.data.medic,
            template: cardResponse.data.template || { max_number_of_members: 12, expiry_months: 1 },
            is_member: false,
            is_admin: false,
          });
        } else {
          setError('You need to be a member to view this group');
        }
      } else {
        setError(detailsResponse.error || 'Failed to load group details');
      }
    } catch (error) {
      console.error('Error loading group data:', error);
      setError('An error occurred while loading group details');
    } finally {
      setLoading(false);
    }
  };

  

  const handleLeaveGroup = () => {
    setShowLeaveModal(true);
  };

  const handleJoinGroup = () => {
    setShowJoinModal(true);
  };

  const handleWithdrawGroup = () => {
    setShowWithdrawModal(true);
  };

  const handleDeleteGroup = () => {
    setShowDeleteModal(true);
  };

  const handleMemberAction = (member: GroupMember) => {
    setSelectedMember({
      id: member.group_id, // Use group_id as id since we don't have membership id
      userId: member.user_id,
      name: member.name,
    });
    setShowRemoveMemberModal(true);
  };

  const handleMemberClick = async (member: GroupMember) => {
    // Only allow admin users to click on non-admin members for direct messaging
    if (!groupDetails?.is_admin || member.role === 'Admin') {
      return;
    }

    try {
      setLoading(true);
      
      // Call API to get or create DM group
      const response = await apiService.getDMGroupFirebaseUID(member.user_id);
      
      if (response.success && response.data) {
        // Get the Firebase group document using the returned firebase_uid
        const groupDoc = await firestore()
          .collection('group')
          .doc(response.data.firebase_uid)
          .get();
        
        if (groupDoc.exists) {
          // Navigate to chat detail with the Firebase document ID
          router.push({
            pathname: '/chat-detail',
            params: { 
              groupId: groupDoc.id
            }
          });
        } else {
          Alert.alert('Error', 'Unable to create direct message conversation');
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to create direct message');
      }
    } catch (error) {
      console.error('Error creating DM:', error);
      Alert.alert('Error', 'An error occurred while creating the conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMemberSuccess = () => {
    // Reload members list
    loadGroupData();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            header: () => (
              <Header 
                groupDetails={groupDetails || null}
                insets={insets} 
                titleText={params.groupName || 'Loading...'} 
                titleDisabled={false} 
                handleHeaderPress={() => {}} 
              />
            )
          }}
        />
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error || !groupDetails) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen
          options={{
            title: 'Error',
            headerStyle: { backgroundColor: '#1B1B1B' },
            headerTintColor: '#fff',
          }}
        />
        <Text style={styles.errorText}>{error || 'Group not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadGroupData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          header: () => (
            <Header 
              groupDetails={groupDetails || null}
              insets={insets} 
              titleText={params.groupName || 'Loading...'} 
              titleDisabled={false} 
              handleHeaderPress={() => {}} 
            />
          )
        }}
      />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
            Details
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.activeTab]}
          onPress={() => setActiveTab('members')}
        >
          <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
            Members
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'details' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.sectionContent}>{groupDetails.description}</Text>
          </View>

          {/* Expiration Section */}
          {groupDetails.expiry_on && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group Expiration Date</Text>
              <Text style={styles.sectionContent}>
                This Group dissolves on {formatDate(groupDetails.expiry_on)}. You can leave the group anytime you want but you will not be compensated for the time remaining.
              </Text>
            </View>
          )}

          {/* Medic Section */}
          {groupDetails.medic && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About {groupDetails.medic.name}</Text>
              <Text style={styles.sectionContent}>
                {groupDetails.medic.name} is a {groupDetails.medic.title || 'medical professional'}. {groupDetails.medic.bio || `${groupDetails.medic.name} is an expert in the field of ${groupDetails.topic?.name || 'this topic'}.`}
              </Text>
            </View>
          )}

          {/* Rules Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rules of the group:</Text>
            <Text style={styles.sectionContent}>
              1. Be kind to each other{'\n'}
              2. No abusive or insulting language{'\n'}
              3. Any form of bullying is not permitted{'\n'}
              4. No discussions about politics or religion are permitted
            </Text>
          </View>

          {/* Warning */}
          <View style={styles.section}>
            <Text style={styles.sectionContent}>
              Not following these rules will lead to removal from the group without refund.
            </Text>
          </View>

          {/* Action Buttons */}
          {!groupDetails.is_member && (
            <TouchableOpacity style={styles.joinButton} onPress={handleJoinGroup}>
              <Text style={styles.joinButtonText}>
                {groupDetails.cost === 0 ? 'Join for Free' : `Join for ₹${groupDetails.cost}`}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Member Count */}
          <Text style={styles.memberCount}>
            {members.length}/{groupDetails.template?.max_number_of_members || 12} Members
          </Text>

          {/* Members List */}
          {members.length > 0 ? (
            <View style={styles.membersList}>
              {members.map((member, index) => (
                <View key={`${member.user_id}-${index}`} style={styles.memberItem}>
                  <TouchableOpacity 
                    style={styles.memberClickableArea}
                    onPress={() => handleMemberClick(member)}
                    disabled={!groupDetails?.is_admin || member.role === 'Admin'}
                  >
                    <View style={styles.memberAvatar}>
                      <Image source={require('@/assets/images/zeal-cat.png')} style={styles.memberAvatarImage} resizeMode="contain" />
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {member.name}
                        {member.role === 'Admin' && <Text style={styles.adminBadge}> (admin)</Text>}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {/* Admin Actions */}
                  {groupDetails.is_admin && member.role !== 'Admin' && (
                    <TouchableOpacity 
                      style={styles.moreButton}
                      onPress={() => handleMemberAction(member)}
                    >
                      <Image source={require('@/assets/images/icons/trash.png')} style={styles.trashIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyMembers}>
              <Text style={styles.emptyMembersText}>
                {groupDetails.is_member ? 'No members to display' : 'Join the group to see members'}
              </Text>
            </View>
          )}
          
          {/* Group Action Buttons based on status and user role */}
          {groupDetails.is_member && (
            <View style={styles.bottomActions}>
              {/* Debug info */}
              {/* <Text style={styles.memberCount}>
                Debug: Status="{groupDetails.status}", Admin={groupDetails.is_admin ? 'Yes' : 'No'}
              </Text> */}

              {(groupDetails.status === 'Active' || !groupDetails.status) && !groupDetails.is_admin && (
                // Active groups - non-admin members can leave
                <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
                  <Text style={styles.leaveButtonText}>Leave Group</Text>
                </TouchableOpacity>
              )}
              
              {groupDetails.status === 'Waiting' && !groupDetails.is_admin && (
                // Waiting groups - non-admin members can withdraw request
                <TouchableOpacity style={styles.withdrawButton} onPress={handleWithdrawGroup}>
                  <Text style={styles.withdrawButtonText}>Withdraw Request</Text>
                </TouchableOpacity>
              )}
              
              {groupDetails.status === 'Waiting' && groupDetails.is_admin && (
                // Waiting groups - admin can delete group
                <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteGroup}>
                  <Text style={styles.deleteButtonText}>Delete Group</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Leave Group Modal */}
      {groupDetails && (
        <LeaveGroupModal
          visible={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          groupId={groupDetails.id}
          groupName={groupDetails.name}
          groupFirebaseUid={params.groupFirebaseUid}
          groupCost={groupDetails.cost}
          isAdmin={groupDetails.is_admin}
        />
      )}

      {/* Remove Member Modal */}
      {groupDetails && selectedMember && (
        <RemoveMemberModal
          visible={showRemoveMemberModal}
          onClose={() => {
            setShowRemoveMemberModal(false);
            setSelectedMember(null);
          }}
          groupId={groupDetails.id}
          userId={selectedMember.userId}
          userName={selectedMember.name}
          onSuccess={handleRemoveMemberSuccess}
        />
      )}

      {/* Join Group Modal */}
      {groupDetails && !groupDetails.is_member && (
        <JoinGroupModal
          visible={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          groupId={groupDetails.id}
          groupName={groupDetails.name}
          groupDescription={groupDetails.description}
          groupCost={groupDetails.cost}
          expiryDate={groupDetails.expiry_on || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
          isFreeGroup={groupDetails.cost === 0}
        />
      )}

      {/* Withdraw Group Modal */}
      {groupDetails && (
        <WithdrawGroupModal
          visible={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
          groupId={groupDetails.id}
          groupName={groupDetails.name}
        />
      )}

      {/* Delete Group Modal */}
      {groupDetails && (
        <DeleteGroupModal
          visible={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          groupId={groupDetails.id}
          groupName={groupDetails.name}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E5E7EB',
    textAlign: 'center',
    marginTop: 2,
  },
  shareButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginTop: 4,
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 12,
    lineHeight: 15,
    color: '#000',
  },
  warningText: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
  leaveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  leaveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  withdrawButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  withdrawButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  deleteButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memberCount: {
    fontSize: 16,
    color: Colors.primaryText,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 20,
  },
  membersList: {
    marginBottom: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  memberClickableArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarImage: {
    width: 44,
    height: 44,
  },
  memberAvatarText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  adminBadge: {
    fontSize: 14,
  },
  memberStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  emptyMembers: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyMembersText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  bottomActions: {
    paddingVertical: 20,
    paddingHorizontal: 30,
    marginTop: 20,
  },
  reportButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  reportButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  trashIcon: {
    width: 20,
    height: 20,
  },
});