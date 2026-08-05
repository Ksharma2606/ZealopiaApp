import {
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
  StyleSheet,
} from 'react-native';
import { colors, fontFamilyForWeight, typography } from '@/theme';
import type { TextVariant } from '@/theme';

export type { TextVariant } from '@/theme';

interface BaseTextProps extends RNTextProps {
  variant?: TextVariant;
}

const typographyVariants: Record<TextVariant, TextStyle> = {
  body: { ...typography.body, color: colors.text.primary },
  label: { ...typography.label, color: colors.text.secondary },
  subtitle: { ...typography.subtitle, color: colors.text.primary },
  title: { ...typography.title, color: colors.text.primary },
  caption: { ...typography.caption, color: colors.text.muted },
  button: { ...typography.button, color: colors.text.inverse },
};

export const BaseText = ({
  children,
  variant = 'body',
  style,
  ...props
}: BaseTextProps) => {
  const styleObject = StyleSheet.flatten(style) || {};
  const mergedStyle = {
    ...typographyVariants[variant],
    ...styleObject,
  };
  const textStyle = {
    ...mergedStyle,
    fontFamily: styleObject.fontFamily || fontFamilyForWeight(mergedStyle.fontWeight),
  };

  return (
    <RNText style={[textStyle, style]} {...props}>
      {children}
    </RNText>
  );
};

export const Heading = ({
  children,
  style,
  ...props
}: Omit<BaseTextProps, 'variant'>) => (
  <BaseText variant="title" style={style} {...props}>
    {children}
  </BaseText>
);

export const Subheading = ({
  children,
  style,
  ...props
}: Omit<BaseTextProps, 'variant'>) => (
  <BaseText variant="subtitle" style={style} {...props}>
    {children}
  </BaseText>
);

export const Caption = ({
  children,
  style,
  ...props
}: Omit<BaseTextProps, 'variant'>) => (
  <BaseText variant="caption" style={style} {...props}>
    {children}
  </BaseText>
);

export const Typography = {
  base: typographyVariants.body,
  body: typographyVariants.body,
  label: typographyVariants.label,
  subtitle: typographyVariants.subtitle,
  title: typographyVariants.title,
  caption: typographyVariants.caption,
  button: typographyVariants.button,
};
