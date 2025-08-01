import { hapticService } from './src/services/HapticService';
import RNBootSplash from "react-native-bootsplash";
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme, adaptNavigationTheme, useTheme } from 'react-native-paper';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppIcon from './src/components/AppIcon';

// Firebase Authentication
import { AuthProvider, useAuth } from './src/contexts/AuthContext';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ToneSelectionScreen from './src/screens/ToneSelectionScreen';
import EditorScreen from './src/screens/EditorScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import AuthScreen from './src/screens/AuthScreen';

// Custom NoteSpark AI Theme
const noteSparkLightColors = {
  ...MD3LightTheme.colors,
  primary: '#6366F1', // Indigo-500 - Modern, professional
  primaryContainer: '#E0E7FF', // Indigo-100
  secondary: '#10B981', // Emerald-500 - Success/AI accent
  secondaryContainer: '#D1FAE5', // Emerald-100
  tertiary: '#F59E0B', // Amber-500 - Warning/highlights
  tertiaryContainer: '#FEF3C7', // Amber-100
  surface: '#FFFFFF',
  surfaceVariant: '#F8FAFC', // Slate-50
  background: '#FEFEFE', // Pure white with slight warmth
  error: '#EF4444', // Red-500
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onSurface: '#1E293B', // Slate-800
  onSurfaceVariant: '#64748B', // Slate-500
  outline: '#E2E8F0', // Slate-200
  shadow: '#000000',
};

const noteSparkDarkColors = {
  ...MD3DarkTheme.colors,
  primary: '#818CF8', // Indigo-400 - Softer for dark mode
  primaryContainer: '#312E81', // Indigo-800
  secondary: '#34D399', // Emerald-400
  secondaryContainer: '#064E3B', // Emerald-800
  tertiary: '#FBBF24', // Amber-400
  tertiaryContainer: '#92400E', // Amber-800
  surface: '#1E293B', // Slate-800
  surfaceVariant: '#334155', // Slate-700
  background: '#0F172A', // Slate-900
  error: '#F87171', // Red-400
  onPrimary: '#FFFFFF',
  onSecondary: '#000000',
  onSurface: '#F1F5F9', // Slate-100
  onSurfaceVariant: '#94A3B8', // Slate-400
  outline: '#475569', // Slate-600
  shadow: '#000000',
};

const noteSparkLightTheme = {
  ...MD3LightTheme,
  colors: noteSparkLightColors,
};

const noteSparkDarkTheme = {
  ...MD3DarkTheme,
  colors: noteSparkDarkColors,
};

// Navigation themes
const { LightTheme, DarkTheme: NavigationDarkTheme } = adaptNavigationTheme({
  reactNavigationLight: DefaultTheme,
  reactNavigationDark: DarkTheme,
});

// Navigation types
export type RootTabParamList = {
  Home: undefined;
  Scanner: undefined;
  Library: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  ToneSelection: { scannedText: string };
  Editor: { 
    originalText: string; 
    tone: string;
    enhancedText?: string;
  };
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Main Tab Navigator
function MainTabs() {
  const theme = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Scanner':
              iconName = 'camera';
              break;
            case 'Library':
              iconName = 'library';
              break;
            default:
              iconName = 'default';
          }

          return <AppIcon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          borderTopWidth: 0.5,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        headerShown: false,
      })}
      screenListeners={{
        tabPress: (e) => {
          hapticService.tabPress();
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Scanner" 
        component={ScannerScreen}
        options={{ title: 'Scan Text' }}
      />
      <Tab.Screen 
        name="Library" 
        component={LibraryScreen}
        options={{ title: 'My Notes' }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator
function AppNavigator() {
  const theme = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: {
          fontWeight: 'bold',
          color: theme.colors.onSurface,
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ToneSelection" 
        component={ToneSelectionScreen}
        options={{ 
          title: 'Choose Tone',
          presentation: 'modal',
          headerTitleAlign: 'center',
        }}
      />
      <Stack.Screen 
        name="Editor" 
        component={EditorScreen}
        options={{ 
          title: 'Edit Note',
          headerTitleAlign: 'center',
        }}
      />
    </Stack.Navigator>
  );
}

// Main App Component with Authentication
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  
  const navigationTheme = colorScheme === 'dark' ? NavigationDarkTheme : LightTheme;

  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#FEFEFE',
      }}>
        <ActivityIndicator 
          size="large" 
          color={colorScheme === 'dark' ? '#818CF8' : '#6366F1'} 
        />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <AppNavigator />
    </NavigationContainer>
  );
};

// Main App Component
export default function App() {
  const colorScheme = useColorScheme();
  const paperTheme = colorScheme === 'dark' ? noteSparkDarkTheme : noteSparkLightTheme;

  useEffect(() => {
    RNBootSplash.hide({ fade: true });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
