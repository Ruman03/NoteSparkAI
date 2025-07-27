// NoteSpark AI - Centralized Theme Configuration
// Material Design 3 theme with custom colors and design tokens

import { MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

// Custom color palette for NoteSpark AI
const colors = {
  // Primary colors - Blue theme for professionalism
  primary: '#1976D2',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E3F2FD',
  onPrimaryContainer: '#0D47A1',

  // Secondary colors - Green theme for AI/tech
  secondary: '#388E3C',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8F5E8',
  onSecondaryContainer: '#1B5E20',

  // Tertiary colors - Orange theme for creativity
  tertiary: '#F57C00',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFF3E0',
  onTertiaryContainer: '#E65100',

  // Surface colors
  surface: '#FEFBFF',
  onSurface: '#1C1B1F',
  surfaceVariant: '#F4F4F4',
  onSurfaceVariant: '#49454F',

  // Background colors
  background: '#FEFBFF',
  onBackground: '#1C1B1F',

  // Error colors
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',

  // Outline colors
  outline: '#79747E',
  outlineVariant: '#CAC4D0',

  // Custom colors for different tones
  toneColors: {
    professional: '#1976D2',
    casual: '#388E3C',
    simplified: '#9C27B0',
    academic: '#795548',
    creative: '#E91E63',
    technical: '#FF9800',
  },

  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  info: '#2196F3',

  // Gradient colors for cards
  gradients: {
    primary: ['#1976D2', '#42A5F5'],
    secondary: ['#388E3C', '#66BB6A'],
    tertiary: ['#F57C00', '#FFB74D'],
  },
};

// Typography configuration
const fontConfig = {
  web: {
    regular: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: '500',
    },
    light: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: '300',
    },
    thin: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: '100',
    },
  },
  ios: {
    regular: {
      fontFamily: 'SF Pro Display',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'SF Pro Display',
      fontWeight: '500',
    },
    light: {
      fontFamily: 'SF Pro Display',
      fontWeight: '300',
    },
    thin: {
      fontFamily: 'SF Pro Display',
      fontWeight: '100',
    },
  },
  android: {
    regular: {
      fontFamily: 'Roboto',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'Roboto',
      fontWeight: '500',
    },
    light: {
      fontFamily: 'Roboto',
      fontWeight: '300',
    },
    thin: {
      fontFamily: 'Roboto',
      fontWeight: '100',
    },
  },
};

// Spacing system
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius system
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

// Elevation/Shadow system
export const elevation = {
  none: 0,
  sm: 1,
  md: 2,
  lg: 4,
  xl: 8,
};

// Animation timing
export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
};

// NoteSpark AI Custom Theme
export const noteSparkTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...colors,
  },
  // Use default fonts for now - can be customized later
};

// Utility functions for theme
export const getContrastColor = (backgroundColor: string): string => {
  // Simple contrast calculation - can be enhanced
  const rgb = backgroundColor.replace('#', '');
  const r = parseInt(rgb.substr(0, 2), 16);
  const g = parseInt(rgb.substr(2, 2), 16);
  const b = parseInt(rgb.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#FFFFFF';
};

export const getToneColor = (tone: string): string => {
  return colors.toneColors[tone as keyof typeof colors.toneColors] || colors.primary;
};

export const getGradientColors = (type: keyof typeof colors.gradients) => {
  return colors.gradients[type];
};

export default noteSparkTheme;
