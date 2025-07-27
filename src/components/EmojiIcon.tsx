import React from 'react';
import { Text, ViewStyle } from 'react-native';

interface EmojiIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

const iconMap: { [key: string]: string } = {
  // Navigation icons
  'home': '🏠',
  'camera': '📷',
  'library': '📚',
  'scanner': '📄',
  
  // Auth icons
  'brain': '🧠',
  'email': '📧',
  'lock': '🔒',
  'eye': '👁️',
  'eye-off': '🙈',
  'google': '🌐',
  'apple': '🍎',
  
  // Action icons
  'search': '🔍',
  'filter': '🔽',
  'sort': '📊',
  'add': '➕',
  'edit': '✏️',
  'delete': '🗑️',
  'share': '📤',
  
  // Status icons
  'check': '✅',
  'error': '❌',
  'warning': '⚠️',
  'info': 'ℹ️',
  
  // Default fallback
  'default': '⭐',
};

export const EmojiIcon: React.FC<EmojiIconProps> = ({ 
  name, 
  size = 24, 
  color, 
  style 
}) => {
  const emoji = iconMap[name] || iconMap['default'];
  
  return (
    <Text 
      style={[
        {
          fontSize: size,
          lineHeight: size,
          textAlign: 'center',
          ...style
        }
      ]}
    >
      {emoji}
    </Text>
  );
};

export default EmojiIcon;
