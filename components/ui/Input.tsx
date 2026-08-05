import React from 'react';
import { TextInput, View, StyleSheet, TextInputProps } from 'react-native';
import { BaseText } from './Base';
import { colors, fontFamilies, radii, spacing } from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: object;
}

export default function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <BaseText variant="label" style={styles.label}>{label}</BaseText> : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.placeholder}
        {...props}
      />
      {error ? <BaseText variant="caption" style={styles.error}>{error}</BaseText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.sm,
    color: colors.text.secondary,
  },
  input: {
    backgroundColor: colors.surface.default,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.input,
    color: colors.text.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    fontFamily: fontFamilies.regular,
  },
  error: {
    marginTop: spacing.xs,
    color: colors.feedback.danger,
  },
});
