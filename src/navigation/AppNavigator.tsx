// NoteSpark AI - Main Navigation
// Clean React Navigation v7 setup with TypeScript

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../types/navigation';
import { hapticService } from '../services/HapticService';

// Import screens (we'll create these next)
import HomeScreen from '../screens/HomeScreen';
import ScannerScreen from '../screens/ScannerScreen';
import DocumentUploadScreen from '../screens/DocumentUploadScreen';
import DocumentPreviewScreen from '../screens/DocumentPreviewScreen';
import ToneSelectionScreen from '../screens/ToneSelectionScreen';
import EditorScreen from '../screens/EditorScreen';
import LibraryScreen from '../screens/LibraryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Main Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6200EE',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
        },
      }}>
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          // We'll add icons later
        }}
        listeners={{
          tabPress: () => {
            hapticService.light();
          },
        }}
      />
      <Tab.Screen 
        name="Scanner" 
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          // We'll add icons later
        }}
        listeners={{
          tabPress: () => {
            hapticService.light();
          },
        }}
      />
      <Tab.Screen 
        name="Library" 
        component={LibraryScreen}
        options={{
          tabBarLabel: 'Library',
          // We'll add icons later
        }}
        listeners={{
          tabPress: () => {
            hapticService.light();
          },
        }}
      />
    </Tab.Navigator>
  );
}

// Root Stack Navigator
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="MainTabs"
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: '#6200EE',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}>
        <Stack.Screen 
          name="MainTabs" 
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="DocumentUpload" 
          component={DocumentUploadScreen}
          options={{ 
            title: 'Upload Document',
            presentation: 'modal',
          }}
        />
        <Stack.Screen 
          name="DocumentPreview" 
          component={DocumentPreviewScreen}
          options={{ 
            title: 'Document Preview',
          }}
        />
        <Stack.Screen 
          name="ToneSelection" 
          component={ToneSelectionScreen}
          options={{ 
            title: 'Select Tone',
            presentation: 'modal',
          }}
        />
        <Stack.Screen 
          name="Editor" 
          component={EditorScreen}
          options={{ 
            title: 'Edit Note',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
