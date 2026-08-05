import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseText as Text } from '@/components/ui/Base';
import { colors, spacing } from '@/theme';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  initialExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  style?: any;
  headerStyle?: any;
  titleStyle?: any;
  contentStyle?: any;
}

export default function CollapsibleSection({ 
  title, 
  children, 
  initialExpanded = true,
  onToggle,
  style,
  headerStyle,
  titleStyle,
  contentStyle
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const toggleExpanded = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    onToggle?.(newExpandedState);
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity 
        style={[styles.header, headerStyle]} 
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <Text style={[styles.title, titleStyle]}>{title}</Text>
        <Ionicons 
          name={isExpanded ? 'chevron-down' : 'chevron-forward'} 
          size={20} 
          color={colors.text.secondary}
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={[styles.content, contentStyle]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.sectionInset,
    marginVertical: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sectionInset,
    paddingVertical: spacing.xl,
    backgroundColor: colors.transparent,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.secondary,
    marginRight: 5
  },
  content: {},
});
