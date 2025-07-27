import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import screens (we'll create these)
import HomeScreen from './src/screens/HomeScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ToneSelectionScreen from './src/screens/ToneSelectionScreen';
import EditorScreen from './src/screens/EditorScreen';
import LibraryScreen from './src/screens/LibraryScreen';

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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home';
              break;
            case 'Scanner':
              iconName = focused ? 'camera-alt' : 'camera-alt';
              break;
            case 'Library':
              iconName = focused ? 'library-books' : 'library-books';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6200EE',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
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
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#6200EE',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
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
          presentation: 'modal'
        }}
      />
      <Stack.Screen 
        name="Editor" 
        component={EditorScreen}
        options={{ 
          title: 'Edit Note',
          headerBackTitle: 'Back'
        }}
      />
    </Stack.Navigator>
  );
}

// Main App Component
export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </PaperProvider>
  );
}
