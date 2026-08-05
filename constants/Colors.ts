import { colors } from '@/theme';

const tintColorLight = '#7A6DCB';
const tintColorDark = colors.white;

// Compatibility facade for existing feature screens. New shared UI should use
// semantic tokens from @/theme directly.
const Colors = {
  white: colors.white,
  black: colors.black,
  background: colors.surface.canvas,
  surface: colors.surface.default,
  surfaceAlt: colors.surface.subtle,
  card: colors.surface.default,
  border: colors.border.default,
  divider: colors.border.subtle,
  shadow: colors.shadow,
  headerFooter: colors.navigation.header,
  primary: colors.action.primary,
  primaryVariant: colors.action.primaryPressed,
  secondary: colors.action.secondary,
  secondaryVariant: colors.action.secondaryPressed,
  success: colors.feedback.success,
  warning: colors.feedback.warning,
  danger: colors.feedback.danger,
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  textMuted: colors.text.muted,
  textInverse: colors.text.inverse,
  icon: colors.icon,
  placeholder: colors.placeholder,
  myChat: colors.chat.outgoing,
  otherChat: colors.chat.incoming,
  chatNotification: colors.chat.notification,
  gold: colors.accent.gold,
  otpBackground: colors.accent.otp,
  splashScreen: colors.accent.splash,
  // Legacy aliases used by existing screens.
  primaryText: colors.text.primary,
  secondaryText: colors.text.secondary,
  secondaryBg: colors.surface.subtle,
  light: { text: colors.black, background: colors.white, tint: tintColorLight, tabIconDefault: '#ccc', tabIconSelected: tintColorLight },
  dark: { text: colors.white, background: colors.black, tint: tintColorDark, tabIconDefault: '#ccc', tabIconSelected: tintColorDark },
};

export default Colors;
