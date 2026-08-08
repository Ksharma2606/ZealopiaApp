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

const FIELD_CORNERS = {
  topLeft: { r: 155, g: 109, b: 255 }, // violet
  topRight: { r: 74, g: 222, b: 128 }, // green
  bottomLeft: { r: 251, g: 107, b: 91 }, // coral
  bottomRight: { r: 255, g: 179, b: 92 }, // orange
};

// "magic purple" is the only color name that exists anywhere in this project (Figma export,
// Flutter reference, backend) - confirmed by search before adding the rest. There's no real
// per-color naming system to reuse, so these are derived from hue, anchored to the field's own
// four corner colors (coral/orange/green/purple all match an actual corner above) plus three
// transitional names for the blends between them, all reusing the same "magic ___" convention
// rather than inventing an unrelated naming scheme.
const COLOR_ANCHORS: { hue: number; name: string }[] = [
  { hue: 6, name: 'magic coral' }, // bottomLeft corner
  { hue: 32, name: 'magic orange' }, // bottomRight corner
  { hue: 80, name: 'magic gold' },
  { hue: 142, name: 'magic green' }, // topRight corner
  { hue: 195, name: 'magic teal' },
  { hue: 259, name: 'magic purple' }, // topLeft corner
  { hue: 320, name: 'magic pink' },
];

const lerp = (a: number, b: number, t: number) => {
  'worklet';
  return a + (b - a) * t;
};

// Same bilinear field as fieldColorAt below, but worklet-safe (no toHex/string ops) so it can run
// on the UI thread inside the pan gesture without crossing the JS bridge on every frame.
const hueAt = (x: number, y: number) => {
  'worklet';
  const r = lerp(
    lerp(FIELD_CORNERS.topLeft.r, FIELD_CORNERS.topRight.r, x),
    lerp(FIELD_CORNERS.bottomLeft.r, FIELD_CORNERS.bottomRight.r, x),
    y
  );
  const g = lerp(
    lerp(FIELD_CORNERS.topLeft.g, FIELD_CORNERS.topRight.g, x),
    lerp(FIELD_CORNERS.bottomLeft.g, FIELD_CORNERS.bottomRight.g, x),
    y
  );
  const b = lerp(
    lerp(FIELD_CORNERS.topLeft.b, FIELD_CORNERS.topRight.b, x),
    lerp(FIELD_CORNERS.bottomLeft.b, FIELD_CORNERS.bottomRight.b, x),
    y
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return hue;
};

// Nearest color-family by hue, wrapping around the 0/360 boundary. The field is a continuous
// gradient with no "empty" gaps, so every position always resolves to a valid name - matching the
// "retain the nearest valid colour" behavior rather than ever showing no label.
const colorNameForHue = (hue: number) => {
  'worklet';
  let closest = COLOR_ANCHORS[0].name;
  let closestDist = 999;
  for (let i = 0; i < COLOR_ANCHORS.length; i++) {
    let dist = Math.abs(hue - COLOR_ANCHORS[i].hue);
    if (dist > 180) dist = 360 - dist;
    if (dist < closestDist) {
      closestDist = dist;
      closest = COLOR_ANCHORS[i].name;
    }
  }
  return closest;
};

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
  const [selectedName, setSelectedName] = useState(() => colorNameForHue(hueAt(DEFAULT_POS.x, DEFAULT_POS.y)));

  const posX = useSharedValue(PICKER_SIZE * DEFAULT_POS.x);
  const posY = useSharedValue(PICKER_SIZE * DEFAULT_POS.y);
  // Tracks the last name sent across the bridge so onChange only calls runOnJS when the
  // detected color family actually changes, not on every pixel of drag movement.
  const lastColorName = useSharedValue(selectedName);

  const updateSelectedColor = (nx: number, ny: number) => {
    setSelected(fieldColorAt(nx, ny));
    setHasInteracted(true);
  };

  const updateSelectedName = (name: string) => {
    setSelectedName(name);
  };

  const pan = Gesture.Pan().onChange((event) => {
    'worklet';
    const nextX = Math.min(Math.max(posX.value + event.changeX, 0), PICKER_SIZE);
    const nextY = Math.min(Math.max(posY.value + event.changeY, 0), PICKER_SIZE);
    posX.value = nextX;
    posY.value = nextY;

    const nx = nextX / PICKER_SIZE;
    const ny = nextY / PICKER_SIZE;
    runOnJS(updateSelectedColor)(nx, ny);

    const name = colorNameForHue(hueAt(nx, ny));
    if (name !== lastColorName.value) {
      lastColorName.value = name;
      runOnJS(updateSelectedName)(name);
    }
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
      params: { color: selected.hex, colorName: selectedName },
    });
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/1.3-soulcolor/Ellipse 31.png')}
        style={[styles.blob, styles.blobBottomLeft]}
        resizeMode="contain"
      />
      <Image
        source={require('@/assets/1.3-soulcolor/Ellipse 32.png')}
        style={[styles.blob, styles.blobBottomCenter]}
        resizeMode="contain"
      />
      <Image
        source={require('@/assets/1.3-soulcolor/Ellipse 33.png')}
        style={[styles.blob, styles.blobRight]}
        resizeMode="contain"
      />
      <Image
        source={require('@/assets/1.3-soulcolor/Ellipse 34.png')}
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
            <Animated.View
              style={[
                styles.swatch,
                cursorStyle,
                { borderColor: selected.hex, shadowColor: selected.hex },
              ]}
            >
              <View style={styles.swatchClip}>
                <LinearGradient
                  colors={[lightenHex(selected.r, selected.g, selected.b), selected.hex]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.swatchFill}
                />
              </View>
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

      <Text style={styles.colorName}>{selectedName}</Text>
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },
  swatchClip: {
    width: '100%',
    height: '100%',
    borderRadius: SWATCH_SIZE / 2,
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
