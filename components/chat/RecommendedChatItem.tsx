import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

interface MedicData {
  name: string;
  title?: string;
}

interface RecommendedGroupData {
  id: number;
  name: string;
  description: string;
  defaultGroupPicUrl?: string;
  cost: number;
  numMembers: number;
  maxNumMembers: number;
  status: string;
  medic?: MedicData;
  firebaseUid: string;
}

interface RecommendedChatItemProps {
  group: RecommendedGroupData;
  onPress: () => void;
}

export default function RecommendedChatItem({ group, onPress }: RecommendedChatItemProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        {group.defaultGroupPicUrl ? (
          <Image 
            source={{ uri: group.defaultGroupPicUrl }} 
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {group.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.groupName} numberOfLines={1}>
            {group.name}
          </Text>
          {group.cost > 0 && (
            <Text style={styles.cost}>₹{group.cost}</Text>
          )}
        </View>
        
        <Text style={styles.description} numberOfLines={2}>
          {group.description}
        </Text>
        
        <View style={styles.footer}>
          <Text style={styles.memberCount}>
            {group.numMembers}/{group.maxNumMembers} members
          </Text>
          {group.medic && (
            <Text style={styles.medicName} numberOfLines={1}>
              Dr. {group.medic.name}
            </Text>
          )}
        </View>
        
        {group.status !== 'active' && (
          <View style={styles.statusContainer}>
            <Text style={styles.status}>{group.status}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#f8f9fa',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  cost: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 12,
    color: '#999',
  },
  medicName: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  statusContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#ffc107',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  status: {
    fontSize: 10,
    color: '#000',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});