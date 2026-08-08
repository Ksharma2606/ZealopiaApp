import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BaseText as Text } from '@/components/ui/Base';

const { width } = Dimensions.get('window');

// Figma 1.5 "Zora - Choose Name" (node 1:514) / 1.5.1 "Zora - Writing Name" (node 1:936),
// implemented as two states (empty vs. has-text) of one screen, not two routes.
//
// Name is intentionally local-only for now: kept in component state and passed forward via
// navigation params. Does not call apiService.updateUserProfile() and does not touch the
// existing profile-setup.tsx flow or its combined name/birth_year/pronouns/orientation API
// contract - this is a deliberate, temporary choice per explicit instruction.
export default function ZoraChooseNameScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);

  const trimmedName = name.trim();
  const hasName = trimmedName.length > 0;

  const handleContinue = () => {
    if (!hasName) return;
    // Forward destination is the 1.6 "Zora - Message" placeholder route - see
    // zora-message.tsx and react_native_rewrite_progress.md for why this is provisional.
    router.push({
      pathname: '/(auth)/zora-message',
      params: { name: trimmedName },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -70}
    >
      <View style={styles.content}>
        <Image
          source={require('@/assets/1.5 Zora - Choose Name/ChatGPT Image May 22, 2026, 09_22_51 PM 1.png')}
          style={styles.mascot}
          resizeMode="contain"
        />

        <Text style={styles.heading}>
          hello! I am zora{'\n'}what should I call you?
        </Text>

        <View style={styles.inputBlock}>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="you can be whoever you want"
            placeholderTextColor="#756E96"
            style={[styles.input, focused && styles.inputFocused]}
            maxLength={40}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleContinue}
              disabled={!hasName}
              activeOpacity={0.85}
            >
              {hasName ? (
                <LinearGradient
                  colors={['#9B6DFF', '#ED4B94']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.okayButton}
                >
                  <Text style={styles.okayText}>okay</Text>
                  <Ionicons name="arrow-forward" size={18} color="#F7F3EA" />
                </LinearGradient>
              ) : (
                <View style={[styles.okayButton, styles.okayButtonDisabled]}>
                  <Text style={styles.okayTextDisabled}>okay</Text>
                  <Ionicons name="arrow-forward" size={18} color="#B9B2D4" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16112B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 56,
  },
  mascot: {
    width: width * 0.925,
    aspectRatio: 407 / 271,
    alignSelf: 'center',
    marginBottom: 30,
  },
  heading: {
    fontFamily: 'KoHo',
    fontWeight: '700',
    fontSize: width < 360 ? 24 : 28,
    lineHeight: width < 360 ? 30 : 34,
    color: '#FFFFFF',
  },
  inputBlock: {
    marginTop: 40,
  },
  input: {
    height: 64,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#9B6DFF',
    backgroundColor: '#211A3D',
    paddingHorizontal: 20,
    fontFamily: 'KoHo',
    fontSize: 15,
    color: '#F7F3EA',
  },
  // Inferred - no Figma export exists for the focused state (1.5.1's own writing-state
  // border wasn't included in the export). Brightened border reuses the same active-violet
  // treatment already established for OTP's focused box cursor.
  inputFocused: {
    borderColor: '#D8C4FF',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  okayButton: {
    minWidth: 110,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Matches the Figma export exactly - this is the screen's default/empty-input state.
  okayButtonDisabled: {
    backgroundColor: '#756E96',
  },
  // Inferred - no Figma export shows text entered, so the enabled gradient (see JSX above)
  // and this label color reuse the same enabled-primary-action treatment already established
  // on OTP's Verify button and Soul Colour Answer's continue button.
  okayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F7F3EA',
  },
  okayTextDisabled: {
    color: '#B9B2D4',
  },
});
