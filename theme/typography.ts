import { TextStyle } from 'react-native';

export type TextVariant = 'body' | 'label' | 'subtitle' | 'title' | 'caption' | 'button';

export const fontFamilies = {
  regular: 'PoppinsRegular',
  medium: 'PoppinsMedium',
  semibold: 'PoppinsSemiBold',
  display: 'KoHo',
  mono: 'SpaceMono',
} as const;

export const typography: Record<TextVariant, TextStyle> = {
  body: { fontFamily: fontFamilies.regular, fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label: { fontFamily: fontFamilies.medium, fontSize: 12, fontWeight: '500', lineHeight: 16 },
  subtitle: { fontFamily: fontFamilies.medium, fontSize: 16, fontWeight: '500', lineHeight: 22 },
  title: { fontFamily: fontFamilies.semibold, fontSize: 20, fontWeight: '600', lineHeight: 28 },
  caption: { fontFamily: fontFamilies.regular, fontSize: 12, fontWeight: '400', lineHeight: 16 },
  button: { fontFamily: fontFamilies.semibold, fontSize: 14, fontWeight: '600', lineHeight: 20 },
};

export const fontFamilyForWeight = (weight?: TextStyle['fontWeight']) => {
  if (weight === '600' || weight === '700' || weight === 'bold' || weight === 'semibold') {
    return fontFamilies.semibold;
  }

  if (weight === '500' || weight === 'medium') {
    return fontFamilies.medium;
  }

  return fontFamilies.regular;
};
