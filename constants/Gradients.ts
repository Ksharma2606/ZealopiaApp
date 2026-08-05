import { ViewStyle } from 'react-native';
import { gradients } from '@/theme';

// Compatibility facade for existing feature screens.
const Gradients = {
  choosingTopic: gradients.topicSelection,
  onboarding: gradients.onboarding,
  vibrant: gradients.vibrant,
};

export const GradientContainerStyle: ViewStyle = { minHeight: '100%' };

export default Gradients;
