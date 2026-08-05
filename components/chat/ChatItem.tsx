import Colors from '@/constants/Colors';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import UnreadBadge from '@/components/ui/UnreadBadge';
import { useGroupChatStore } from '@/lib/stores/groupChatStore';

interface MessageAttachment {
  id: string;
  type: 'image' | 'audio' | 'video';
  url: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
}

interface RecentMessage {
  messageText: string;
  sentAt: Date;
  sentByName: string;
  readBy: string[];
  attachments?: MessageAttachment[];
}

interface GroupData {
  uid: string;
  name: string;
  description?: string;
  defaultGroupPicUrl?: string;
  default_group_pic_url?: string;
  recentMessage?: RecentMessage;
  cost?: number;
  currentMembers: string[];
  status?: string;
}

interface ChatItemProps {
  group: GroupData;
  onPress: () => void;
  showStatus?: boolean;
  // Per-user recent message for user-specific messages (e.g., renewal reminders)
  memberRecentMessage?: RecentMessage;
}

export default function ChatItem({ group, onPress, showStatus = false, memberRecentMessage }: ChatItemProps) {
  // Get unread count from the centralized store - check all maps (regular, medicCreated, medicJoined)
  const unreadCount = useGroupChatStore(state => {
    // Check regular groups first
    const regularGroup = state.groups.get(group.uid);
    if (regularGroup) return regularGroup.unreadCount || 0;

    // Check medic groups created
    const medicCreated = state.medicGroupsCreated.get(group.uid);
    if (medicCreated) return medicCreated.unreadCount || 0;

    // Check medic groups joined
    const medicJoined = state.medicGroupsJoined.get(group.uid);
    if (medicJoined) return medicJoined.unreadCount || 0;

    return 0;
  });

  // Determine the effective recent message (use member's if more recent than group's)
  const effectiveRecentMessage = React.useMemo(() => {
    if (!memberRecentMessage && !group.recentMessage) {
      return undefined;
    }

    if (!memberRecentMessage) {
      return group.recentMessage;
    }

    if (!group.recentMessage) {
      return memberRecentMessage;
    }

    // Both exist - compare timestamps and use the more recent one
    const memberTime = memberRecentMessage.sentAt?.getTime() || 0;
    const groupTime = group.recentMessage.sentAt?.getTime() || 0;

    return memberTime > groupTime ? memberRecentMessage : group.recentMessage;
  }, [memberRecentMessage, group.recentMessage]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Show time format for messages less than 24 hours old
    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getMessagePreview = (recentMessage?: RecentMessage): string => {
    if (!recentMessage) {
      return 'No messages yet';
    }

    // If message has attachments, show attachment type instead of text
    if (recentMessage.attachments && recentMessage.attachments.length > 0) {
      const attachment = recentMessage.attachments[0]; // Show first attachment
      const count = recentMessage.attachments.length;

      switch (attachment.type) {
        case 'image':
          return count > 1 ? `📷 ${count} images` : '📷 Image';
        case 'audio':
          return count > 1 ? `🎵 ${count} audio files` : '🎵 Audio';
        case 'video':
          return count > 1 ? `🎬 ${count} videos` : '🎬 Video';
        default:
          return count > 1 ? `📎 ${count} attachments` : '📎 Attachment';
      }
    }

    // If no attachments but has text, show the text
    if (recentMessage.messageText && recentMessage.messageText.trim()) {
      return recentMessage.messageText;
    }

    // If we have a recent message but no text and no attachments,
    // it might be an attachment message where attachment data isn't included in recentMessage
    // Show a generic "Message" instead of "No messages yet"
    if (recentMessage.sentAt) {
      return 'Message';
    }

    // Fallback for empty messages
    return 'No messages yet';
  };

  const shouldShowStatus = (status?: string): boolean => {
    if (!showStatus || !status) return false;
    // Skip showing "Active" status as requested
    return status !== 'Active';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Waiting':
        return Colors.primary; // Orange color for waiting
      case 'Closed':
        return 'red'; // Red color for expired
      default:
        return '#999'; // Default gray
    }
  };

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
        </View>
        {shouldShowStatus(group.status) && (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: getStatusColor(group.status!) }]}>
              Group Status: {group.status}
            </Text>
          </View>
        )}
        <View style={styles.messageContainer}>
          <Text style={styles.lastMessage} numberOfLines={2}>
            {getMessagePreview(effectiveRecentMessage)}
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        {effectiveRecentMessage?.sentAt && (
          <Text style={styles.timestamp}>
            {formatTime(effectiveRecentMessage.sentAt)}
          </Text>
        )}
        <UnreadBadge 
          count={unreadCount} 
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: Colors.secondaryBg,
    marginHorizontal: 6,
    marginVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    backgroundColor: '#007AFF',
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
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  messageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 12,
    lineHeight: 15,
    color: Colors.primaryText,
    flex: 1,
    marginRight: 8,
  },
  cost: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  memberCount: {
    fontSize: 12,
    color: '#999',
  },
  statusContainer: {
    marginBottom: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
});