import { useTheme } from 'react-native-paper';
import { MD3Theme } from 'react-native-paper';

export const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime())) {
      return 'Unknown date';
    }
    
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
};

export const getToneColor = (tone: string, theme: MD3Theme) => {
    const toneColors: { [key: string]: string } = {
      'professional': theme.colors.primary,
      'casual': theme.colors.secondary,
      'academic': theme.colors.tertiary,
      'creative': '#E91E63', // Pink
      'technical': '#FF9800', // Orange
      'simplified': '#9C27B0', // Purple
    };
    return toneColors[tone] || theme.colors.onSurfaceVariant;
};

export const getToneIcon = (tone: string) => {
    const toneIcons: { [key: string]: string } = {
      'professional': 'briefcase',
      'casual': 'chat',
      'academic': 'school',
      'creative': 'palette',
      'technical': 'code-tags',
      'simplified': 'lightbulb',
    };
    return toneIcons[tone] || 'note-text';
};
