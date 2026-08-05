import { ColorValue } from 'react-native';

export type GradientDefinition = {
  colors: [ColorValue, ColorValue, ...ColorValue[]];
  locations: [number, number, ...number[]];
};

export const gradients: Record<'topicSelection' | 'onboarding' | 'vibrant', GradientDefinition> = {
  topicSelection: {
    colors: ['#F8E2EE', '#FDDFD7', '#FDDFD8'],
    locations: [0.29, 0.49, 0.76],
  },
  onboarding: {
    colors: ['#E5BAFE', '#FECEF9', '#FFFFFF'],
    locations: [0, 0.39, 0.65],
  },
  vibrant: {
    colors: ['#C90142', '#7426B8'],
    locations: [0, 1],
  },
};
