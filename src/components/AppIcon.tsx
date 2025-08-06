import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

// Icon mapping with proper vector icons
const iconMap: { [key: string]: { library: 'MaterialCommunityIcons' | 'MaterialIcons'; name: string } } = {
  // Navigation icons
  'home': { library: 'MaterialCommunityIcons', name: 'home' },
  'camera': { library: 'MaterialCommunityIcons', name: 'camera' },
  'library': { library: 'MaterialCommunityIcons', name: 'library' },
  'scanner': { library: 'MaterialCommunityIcons', name: 'document-text' },
  
  // Auth icons
  'spark': { library: 'MaterialCommunityIcons', name: 'lightning-bolt' },
  'brain': { library: 'MaterialCommunityIcons', name: 'brain' },
  'email': { library: 'MaterialCommunityIcons', name: 'email' },
  'lock': { library: 'MaterialCommunityIcons', name: 'lock' },
  'eye': { library: 'MaterialCommunityIcons', name: 'eye' },
  'eye-off': { library: 'MaterialCommunityIcons', name: 'eye-off' },
  'google': { library: 'MaterialCommunityIcons', name: 'google' },
  'apple': { library: 'MaterialCommunityIcons', name: 'apple' },
  
  // Action icons
  'search': { library: 'MaterialCommunityIcons', name: 'magnify' },
  'filter': { library: 'MaterialCommunityIcons', name: 'filter' },
  'sort': { library: 'MaterialCommunityIcons', name: 'sort' },
  'add': { library: 'MaterialCommunityIcons', name: 'plus' },
  'edit': { library: 'MaterialCommunityIcons', name: 'pencil' },
  'delete': { library: 'MaterialCommunityIcons', name: 'delete' },
  'share': { library: 'MaterialCommunityIcons', name: 'share' },
  
  // Status icons
  'check': { library: 'MaterialCommunityIcons', name: 'check' },
  'error': { library: 'MaterialCommunityIcons', name: 'alert-circle' },
  'warning': { library: 'MaterialCommunityIcons', name: 'alert' },
  'info': { library: 'MaterialCommunityIcons', name: 'information' },
  
  // Additional useful icons
  'menu': { library: 'MaterialCommunityIcons', name: 'menu' },
  'close': { library: 'MaterialCommunityIcons', name: 'close' },
  'back': { library: 'MaterialCommunityIcons', name: 'arrow-left' },
  'forward': { library: 'MaterialCommunityIcons', name: 'arrow-right' },
  'up': { library: 'MaterialCommunityIcons', name: 'arrow-up' },
  'down': { library: 'MaterialCommunityIcons', name: 'arrow-down' },
  'settings': { library: 'MaterialCommunityIcons', name: 'cog' },
  'account-cog': { library: 'MaterialCommunityIcons', name: 'account-cog' },
  'profile': { library: 'MaterialCommunityIcons', name: 'account' },
  'logout': { library: 'MaterialCommunityIcons', name: 'logout' },
  'refresh': { library: 'MaterialCommunityIcons', name: 'refresh' },
  'save': { library: 'MaterialCommunityIcons', name: 'content-save' },
  'loading': { library: 'MaterialCommunityIcons', name: 'loading' },
  'heart': { library: 'MaterialCommunityIcons', name: 'heart' },
  'star': { library: 'MaterialCommunityIcons', name: 'star' },
  'bookmark': { library: 'MaterialCommunityIcons', name: 'bookmark' },
  'copy': { library: 'MaterialCommunityIcons', name: 'content-copy' },
  'paste': { library: 'MaterialCommunityIcons', name: 'content-paste' },
  'download': { library: 'MaterialCommunityIcons', name: 'download' },
  'upload': { library: 'MaterialCommunityIcons', name: 'upload' },  
  'folder': { library: 'MaterialCommunityIcons', name: 'folder' },
  'file': { library: 'MaterialCommunityIcons', name: 'file' },
  'image': { library: 'MaterialCommunityIcons', name: 'image' },
  'play': { library: 'MaterialCommunityIcons', name: 'play' },
  'pause': { library: 'MaterialCommunityIcons', name: 'pause' },
  'stop': { library: 'MaterialCommunityIcons', name: 'stop' },
  
  // Fallback
  'default': { library: 'MaterialCommunityIcons', name: 'help' },
};

export const AppIcon: React.FC<AppIconProps> = ({ 
  name, 
  size = 24, 
  color = '#000000',
  style 
}) => {
  const iconConfig = iconMap[name];
  
  if (!iconConfig) {
    // Fallback to a default icon if not found
    return <MaterialCommunityIcons name="help" size={size} color={color} style={style} />;
  }

  if (iconConfig.library === 'MaterialCommunityIcons') {
    return <MaterialCommunityIcons name={iconConfig.name} size={size} color={color} style={style} />;
  } else {
    return <MaterialIcons name={iconConfig.name} size={size} color={color} style={style} />;
  }
};

export default AppIcon;
