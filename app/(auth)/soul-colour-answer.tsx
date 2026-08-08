import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { BaseText as Text } from '@/components/ui/Base';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const DEFAULT_COLOR = '#EC4899';
const DEFAULT_NAME = 'magic purple';

export default function SoulColourAnswerScreen() {
  const router = useRouter();
  const { color, colorName } = useLocalSearchParams<{ color?: string; colorName?: string }>();

  const selectedColor = color || DEFAULT_COLOR;
  const selectedName = colorName || DEFAULT_NAME;

  const handleContinue = () => {
    router.push('/(auth)/zora-choose-name');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.glow, { backgroundColor: selectedColor, shadowColor: selectedColor }]} />

      <Text style={styles.heading}>your choice shows me{'\n'}{selectedName}</Text>

      <View style={styles.spacer} />

      <TouchableOpacity onPress={handleContinue} activeOpacity={0.85}>
        <LinearGradient
          colors={['#9B6DFF', '#ED4B94']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.continueButton}
        >
          <Ionicons name="arrow-forward" size={22} color="#F7F3EA" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16112B',
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: 32,
    paddingBottom: 56,
  },
  glow: {
    width: 118,
    height: 118,
    borderRadius: 59,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 12,
    marginBottom: 56,
  },
  heading: {
    width: '100%',
    fontFamily: 'KoHo',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 32,
    color: '#F7F3EA',
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  continueButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9B6DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
});
