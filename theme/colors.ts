export const colors = {
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  surface: {
    canvas: '#FCF7FF',
    default: '#FFFFFF',
    subtle: '#F8F2FB',
  },
  border: {
    default: '#E9D9EE',
    subtle: '#E5D0EE',
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#666666',
    muted: '#A49AAE',
    inverse: '#FFFFFF',
  },
  action: {
    primary: '#DD7896',
    primaryPressed: '#B65E7C',
    secondary: '#6F62B1',
    secondaryPressed: '#A893D6',
  },
  feedback: {
    success: '#4CAF50',
    warning: '#FFC107',
    danger: '#E53935',
  },
  icon: '#5C4E96',
  placeholder: '#B7A4C9',
  shadow: '#00000033',
  chat: {
    outgoing: '#F8D5E0',
    incoming: '#D6F8F4',
    notification: '#62F82D',
  },
  accent: {
    gold: '#FFE58A',
    otp: '#AAF0B1',
    splash: '#F6F058',
  },
  navigation: {
    header: '#C1BBDD',
    profileHeader: '#F8E2EE',
    activeTab: '#000000',
    inactiveTab: '#FFFFFF',
  },
} as const;

export type AppColors = typeof colors;
