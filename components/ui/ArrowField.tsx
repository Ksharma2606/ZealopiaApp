import React from 'react';
import {
  View,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { Typography } from '@/components/ui/Base';
import { BaseText as Text } from '@/components/ui/Base';
import { colors, radii, spacing } from '@/theme';

interface ArrowFieldProps extends Omit<TextInputProps, 'style'> {
  onPress: () => void;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  containerStyle?: object;
  inputStyle?: object;
  disabled?: boolean;
  arrowSize?: number;
  placeholderTextColor?: string;
  error?: string;
  success?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

const ArrowField: React.FC<ArrowFieldProps> = ({
  onPress,
  placeholder = "Add referral code",
  value,
  onChangeText,
  containerStyle,
  inputStyle,
  placeholderTextColor = colors.text.inverse,
  arrowSize = 48,
  disabled = false,
  error,
  success,
  autoCapitalize = 'none',
  ...textInputProps
}) => {
  return (
    <View>
      <View style={[styles.container, containerStyle]}>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={placeholderTextColor}
          editable={!disabled}
          autoCapitalize={autoCapitalize}
          {...textInputProps}
        />
        <Pressable
          style={[styles.arrowButton, disabled && styles.disabledButton]}
          onPress={onPress}
          disabled={disabled}
        >
          <Image
            source={require('@/assets/images/arrow_send.png')}
            style={[styles.arrowIcon, { width: arrowSize, height: arrowSize }]}
            resizeMode="contain"
          />
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {success && <Text style={styles.success}>{success}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent.otp,
    borderRadius: radii.field,
  },
  input: {
    ...Typography.base,
    fontSize: 14,
    color: colors.text.inverse,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    fontWeight: '600',
  },
  arrowButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  arrowIcon: {},
  disabledButton: {
    opacity: 0.5,
  },
  error: {
    color: colors.feedback.danger,
    fontSize: 12,
    marginLeft: spacing.sm,
  },
  success: {
    color: colors.feedback.success,
    fontSize: 12,
    marginLeft: spacing.sm,
  },
});

export default ArrowField;
