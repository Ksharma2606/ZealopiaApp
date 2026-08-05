import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseText as Text } from '@/components/ui/Base';
import Colors from '@/constants/Colors';

export interface GroupCardData {
  id: number;
  name: string;
  description: string;
  cost: number;
  num_members: number;
  max_num_members: number;
  template?: {
    max_number_of_members?: number;
  };
  topic?: {
    id: number;
    name: string;
  };
  medic: {
    id?: number;
    name: string;
    title?: string;
    designation?: string;
    years_of_experience?: number;
  };
  medic_soul_match_emoji?: string;
  medic_soul_match_percentage?: number;
  status: string;
  defaultGroupPicUrl?: string;
}

interface GroupCardProps {
  group: GroupCardData | any;
  onPress: (group: GroupCardData) => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function GroupCard({ group, onPress, loading = false, disabled = false }: GroupCardProps) {
  const isPaidGroup = group.cost > 0;
  
  return (
    <View style={[
      styles.groupCard,
      isPaidGroup ? styles.paidGroupCard : styles.freeGroupCard
    ]}>
      <View style={styles.cardContent}>
        {/* Avatar on the left */}
        <View style={styles.avatarContainer}>
          <Image 
            source={{ 
              uri: group.defaultGroupPicUrl || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'
            }} 
            style={styles.avatarCircle}
            defaultSource={{ uri: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png' }}
            onError={() => {
              // Fallback handled by defaultSource
            }}
          />
        </View>
        
        {/* Content on the right */}
        <View style={styles.contentContainer}>
          {/* Top row: Group name with cost and info button */}
          <View style={styles.topRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={[styles.groupCost, isPaidGroup ? styles.paidCost : styles.freeCost]}>
                {group.cost === 0 ? '(Free)' : `(₹${group.cost}/month)`}
              </Text>
            </View>
            <TouchableOpacity style={styles.infoButton} onPress={() => onPress(group)}>
              <Ionicons name="information-circle-outline" size={20} color="#333" />
            </TouchableOpacity>
          </View>
          
          {/* Middle row: Medic info */}
          <View>
            <Text style={styles.medicInfo}>
              By {group.medic.title ? `${group.medic.title}- ` : ''}{group.medic.name}
              {group.medic_soul_match_emoji && (
                <Text style={styles.medicSoulMatchEmoji}> {group.medic_soul_match_emoji}</Text>
              )}
            </Text>
            {(group.medic.designation || group.medic.years_of_experience) && (
              <Text style={styles.medicCredentials}>
                {group.medic.designation}{group.medic.designation && group.medic.years_of_experience ? ' - ' : ''}{group.medic.years_of_experience ? `${group.medic.years_of_experience} yrs exp` : ''}
              </Text>
            )}
          </View>
          
          {/* Bottom row: Members count and join button */}
          <View style={styles.bottomRow}>
            <Text style={styles.membersCount}>
              {group.num_members || 0}/{group.max_num_members || 12} members
            </Text>
            
            <TouchableOpacity
              style={[styles.joinButton, (loading || disabled) && styles.joinButtonDisabled]}
              onPress={() => onPress(group)}
              disabled={loading || disabled}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>Join Group</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    borderRadius: 16,
    marginBottom: 12,
    marginHorizontal: 8,
    overflow: 'hidden',
    
  },
  paidGroupCard: {
    backgroundColor: '#F8D7E4', // Light pink background for paid groups
  },
  freeGroupCard: {
    backgroundColor: '#FFF4C4', // Light yellow background for free groups
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  contentContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    // marginBottom: 4,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginRight: 6,
  },
  groupCost: {
    fontSize: 12,
    fontWeight: '400',
  },
  paidCost: {
    color: '#C2185B', // Dark pink for paid groups
  },
  freeCost: {
    color: '#F57C00', // Orange for free groups
  },
  infoButton: {
    padding: 2,
    marginLeft: 8,
  },
  medicInfo: {
    fontSize: 13,
    color: '#333',
    // marginBottom: 2,
  },
  medicSoulMatchEmoji: {
    fontSize: 13,
    marginLeft: 4,
  },
  medicCredentials: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // marginTop: -12
  },
  membersCount: {
    fontSize: 12,
    color: Colors.secondaryText,
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: Colors.primary, // Pink join button to match design
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
});