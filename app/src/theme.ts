export const colors = {
  // Deep Midnight Slate (softer and richer than harsh pure black)
  background: '#0B0D13',
  surface: '#13161F',
  surfaceSubtle: '#191D29',
  surfaceElevated: '#212636',
  surfacePressed: '#2A3044',

  // Subtle Slate & Jade Borders
  border: '#242938',
  borderSubtle: '#1C202C',
  borderHighlight: '#363D52',
  borderActive: '#10B981',

  // Softened Pearl & Silver Typography (eliminates blinding glare)
  text: '#F1F4F9',
  textSecondary: '#D0D6E2',
  textMuted: '#8E98AB',
  textDim: '#60697D',
  textInverted: '#0B0D13',

  // Luxe Emerald / Mint Accent (Premium Fintech aesthetic, non-blue)
  primary: '#10B981',
  primaryHover: '#059669',
  primaryPressed: '#047857',
  primarySoft: '#0E2920',
  primaryBorder: '#164835',
  primaryText: '#FFFFFF',

  // Warm Gold / Amber Accent for financial highlights
  accentGold: '#F59E0B',
  accentGoldSoft: '#281B0C',
  accentGoldBorder: '#4E3414',

  // Status Colors
  success: '#34D399',
  successSoft: '#0E261D',
  successBorder: '#174735',

  danger: '#FB7185', // Warm Coral Rose
  dangerSoft: '#291219',
  dangerBorder: '#501C2A',

  warning: '#FBBF24',
  warningSoft: '#281C0C',
  warningBorder: '#4E3514',

  disabled: '#242938',
  disabledText: '#50586C',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xxs: 11,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;
