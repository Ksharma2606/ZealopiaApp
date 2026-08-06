import React, { useState } from 'react';
import { View, StyleSheet, Image, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { BaseText as Text } from '@/components/ui/Base';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// No backend "soul colour" model exists yet (see progress log). This screen picks a color from a
// placeholder 2D gradient field and passes it forward via local state + navigation params only.
// "magic purple" is the one name shown in the Figma export; a real per-color naming system is
// pending backend work, so it's used here as a static placeholder label rather than invented copy.
const DEFAULT_NAME = 'magic purple';

const FIELD_CORNERS = {
  topLeft: { r: 155, g: 109, b: 255 }, // violet
  topRight: { r: 74, g: 222, b: 128 }, // green
  bottomLeft: { r: 251, g: 107, b: 91 }, // coral
  bottomRight: { r: 255, g: 179, b: 92 }, // orange
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

const fieldColorAt = (x: number, y: number) => {
  const top = {
    r: lerp(FIELD_CORNERS.topLeft.r, FIELD_CORNERS.topRight.r, x),
    g: lerp(FIELD_CORNERS.topLeft.g, FIELD_CORNERS.topRight.g, x),
    b: lerp(FIELD_CORNERS.topLeft.b, FIELD_CORNERS.topRight.b, x),
  };
  const bottom = {
    r: lerp(FIELD_CORNERS.bottomLeft.r, FIELD_CORNERS.bottomRight.r, x),
    g: lerp(FIELD_CORNERS.bottomLeft.g, FIELD_CORNERS.bottomRight.g, x),
    b: lerp(FIELD_CORNERS.bottomLeft.b, FIELD_CORNERS.bottomRight.b, x),
  };
  const r = lerp(top.r, bottom.r, y);
  const g = lerp(top.g, bottom.g, y);
  const b = lerp(top.b, bottom.b, y);
  return { r, g, b, hex: toHex(r, g, b) };
};

const lightenHex = (r: number, g: number, b: number, amount = 0.4) =>
  toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);

const PICKER_SIZE = Math.min(width * 0.78, 320);
const SWATCH_SIZE = 132;
const DEFAULT_POS = { x: 0.66, y: 0.58 }; // lands in the pink/orange region, matching the Figma default preview
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 72 : 56;

export default function SoulColourScreen() {
  const router = useRouter();
  const [hasInteracted, setHasInteracted] = useState(false);
  const [selected, setSelected] = useState(() => fieldColorAt(DEFAULT_POS.x, DEFAULT_POS.y));

  const posX = useSharedValue(PICKER_SIZE * DEFAULT_POS.x);
  const posY = useSharedValue(PICKER_SIZE * DEFAULT_POS.y);

  const updateSelectedColor = (nx: number, ny: number) => {
    setSelected(fieldColorAt(nx, ny));
    setHasInteracted(true);
  };

  const pan = Gesture.Pan().onChange((event) => {
    'worklet';
    const nextX = Math.min(Math.max(posX.value + event.changeX, 0), PICKER_SIZE);
    const nextY = Math.min(Math.max(posY.value + event.changeY, 0), PICKER_SIZE);
    posX.value = nextX;
    posY.value = nextY;
    runOnJS(updateSelectedColor)(nextX / PICKER_SIZE, nextY / PICKER_SIZE);
  });

  const cursorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value - SWATCH_SIZE / 2 },
      { translateY: posY.value - SWATCH_SIZE / 2 },
    ],
  }));

  const handleContinue = () => {
    if (!hasInteracted) return;
    router.push({
      pathname: '/(auth)/soul-colour-answer',
      params: { color: selected.hex, colorName: DEFAULT_NAME },
    });
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/soulcolor-1.3/Ellipse 31.png')}
        style={[styles.blob, styles.blobBottomLeft]}
        resizeMode="contain"
      />
      <Image
        source={require('@/assets/soulcolor-1.3/Ellipse 32.png')}
        style={[styles.blob, styles.blobBottomCenter]}
        resizeMode="contain"
      />
      <Image
        source={require('@/assets/soulcolor-1.3/Ellipse 33.png')}
        style={[styles.blob, styles.blobRight]}
        resizeMode="contain"
      />
      <Image
        source={require('@/assets/soulcolor-1.3/Ellipse 34.png')}
        style={[styles.blob, styles.blobTopRight]}
        resizeMode="contain"
      />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>before anything</Text>
        <Text style={styles.heading}>choose a soul colour</Text>
      </View>

      <View style={styles.pickerWrap}>
        <GestureDetector gesture={pan}>
          <View style={{ width: PICKER_SIZE, height: PICKER_SIZE }}>
            <Animated.View style={[styles.swatch, cursorStyle]}>
              <LinearGradient
                colors={[lightenHex(selected.r, selected.g, selected.b), selected.hex]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.swatchFill}
              />
            </Animated.View>
          </View>
        </GestureDetector>
      </View>

      <TouchableOpacity
        style={[styles.okayButton, !hasInteracted && styles.okayButtonDisabled]}
        onPress={handleContinue}
        disabled={!hasInteracted}
        activeOpacity={0.85}
      >
        <Text style={[styles.okayText, !hasInteracted && styles.okayTextDisabled]}>okay</Text>
      </TouchableOpacity>

      <Text style={styles.colorName}>{DEFAULT_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16112B',
    alignItems: 'center',
  },
  blob: {
    position: 'absolute',
    width: width * 0.9,
    height: height * 0.4,
  },
  blobBottomLeft: {
    left: -width * 0.25,
    top: height * 0.42,
  },
  blobBottomCenter: {
    left: width * 0.05,
    top: height * 0.5,
  },
  blobRight: {
    right: -width * 0.2,
    top: height * 0.28,
  },
  blobTopRight: {
    right: -width * 0.05,
    top: height * 0.18,
    width: width * 0.5,
    height: height * 0.3,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    paddingTop: HEADER_TOP_PADDING,
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontFamily: 'KoHo',
    fontWeight: '700',
    fontSize: 16,
    color: '#9B6DFF',
    marginBottom: 6,
  },
  heading: {
    fontFamily: 'KoHo',
    fontWeight: '700',
    fontSize: width < 360 ? 26 : 30,
    color: '#F7F3EA',
    textAlign: 'center',
  },
  pickerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    position: 'absolute',
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    borderWidth: 2,
    borderColor: '#BCB4B4',
    overflow: 'hidden',
  },
  swatchFill: {
    width: '100%',
    height: '100%',
  },
  okayButton: {
    backgroundColor: '#655C8A',
    borderRadius: 999,
    paddingHorizontal: 48,
    paddingVertical: 14,
    marginBottom: 12,
  },
  okayButtonDisabled: {
    backgroundColor: '#4B4468',
    opacity: 0.7,
  },
  okayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E4DEEF',
  },
  okayTextDisabled: {
    color: '#8A81A3',
  },
  colorName: {
    fontFamily: 'KoHo',
    fontWeight: '700',
    fontSize: 16,
    color: '#F7F3EA',
    marginBottom: 40,
  },
});
