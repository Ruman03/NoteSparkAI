// Re-export all screens for easier imports
export { default as HomeScreen } from './screens/HomeScreen';
export { default as ScannerScreen } from './screens/ScannerScreen';
export { default as ToneSelectionScreen } from './screens/ToneSelectionScreen';
export { default as EditorScreen } from './screens/EditorScreen';
export { default as LibraryScreen } from './screens/LibraryScreen';

// Re-export all services
export { NotesService } from './services/NotesService';
export { AIService } from './services/AIService';
export { NetworkService } from './services/NetworkService';

// Re-export all types
export * from './types';

// Re-export navigation types (avoiding conflicts)
export type { 
  HomeScreenNavigationProp,
  ScannerScreenNavigationProp, 
  ToneSelectionScreenNavigationProp,
  EditorScreenNavigationProp,
  LibraryScreenNavigationProp
} from './types/navigation';

// Re-export navigation
export { default as AppNavigator } from './navigation/AppNavigator';
