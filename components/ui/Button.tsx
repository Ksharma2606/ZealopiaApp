import React from 'react';
import { Pressable, TextStyle, ViewStyle, StyleSheet } from 'react-native';
import { BaseText } from './Base';
import { colors, motion, radii, spacing } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.action.primary,
  },
  secondary: {
    backgroundColor: colors.action.secondary,
  },
  ghost: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variantStyles[variant],
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      <BaseText variant="button" style={[styles.text, textStyle]}>{title}</BaseText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: spacing.touchTarget,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.control,
  },
  buttonPressed: {
    opacity: motion.opacity.pressed,
  },
  buttonDisabled: {
    opacity: motion.opacity.disabled,
  },
  text: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
});
