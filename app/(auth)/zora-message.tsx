import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BaseText as Text } from '@/components/ui/Base';

// Placeholder only - Figma 1.6 "Zora - Message" has not been implemented yet.
// This file exists solely so zora-choose-name.tsx (1.5 / 1.5.1) has a real forward
// destination instead of routing somewhere unrelated. Replace with the real 1.6
// implementation when that Figma screen is picked up.
export default function ZoraMessageScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {name ? `hi ${name} — ` : ''}1.6 Zora - Message{'\n'}(not yet implemented)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16112B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  text: {
    fontFamily: 'KoHo',
    fontWeight: '700',
    fontSize: 20,
    color: '#F7F3EA',
    textAlign: 'center',
  },
});
