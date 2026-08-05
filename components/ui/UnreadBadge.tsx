import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BaseText as Text } from '@/components/ui/Base';
import { colors, radii, spacing } from '@/theme';

interface UnreadBadgeProps {
  count: number;
  maxDisplayCount?: number;
  style?: any;
}

export default function UnreadBadge({ 
  count, 
  maxDisplayCount = 99, 
  style 
}: UnreadBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const displayCount = count > maxDisplayCount ? `${maxDisplayCount}+` : count.toString();

  return (
    <View style={[styles.badge, style]}>
      <Text style={[styles.badgeText]}>
        {displayCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.chat.notification,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
    borderRadius: radii.badge,
    paddingHorizontal: spacing.hairline,
  },
  badgeText: {
    color: colors.text.inverse,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
    fontSize: 12,
  },
});
