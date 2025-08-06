// src/contexts/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface AppPreferences {
  enhancedImageProcessing: boolean; // NEW: Single toggle for Gemini advanced features
  defaultTone: 'professional' | 'casual' | 'simplified';
  autoSave: boolean;
  autoSaveInterval: number; // in seconds
  darkMode: 'auto' | 'light' | 'dark';
  haptics: boolean;
  notificationsEnabled: boolean;
  language: string;
}

export interface SubscriptionStatus {
  plan: 'free' | 'pro' | 'premium';
  expiresAt?: Date;
  isActive: boolean;
  features: {
    advancedImageAnalysis: boolean; // NEW: Replaces cloudVisionOCR with Gemini features
    unlimitedNotes: boolean;
    exportFormats: boolean;
    prioritySupport: boolean;
    advancedAI: boolean;
  };
}

interface SettingsContextType {
  preferences: AppPreferences;
  subscription: SubscriptionStatus;
  updatePreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => Promise<void>;
  resetPreferences: () => Promise<void>;
  upgradeSubscription: (plan: 'pro' | 'premium') => Promise<void>;
  isLoading: boolean;
}

const defaultPreferences: AppPreferences = {
  enhancedImageProcessing: true, // Enable Gemini's advanced features by default
  defaultTone: 'professional',
  autoSave: true,
  autoSaveInterval: 3, // 3 seconds
  darkMode: 'auto',
  haptics: true,
  notificationsEnabled: true,
  language: 'en',
};

const defaultSubscription: SubscriptionStatus = {
  plan: 'free',
  isActive: true,
  features: {
    advancedImageAnalysis: false, // Free tier gets basic Gemini processing
    unlimitedNotes: false,
    exportFormats: false,
    prioritySupport: false,
    advancedAI: false,
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const PREFERENCES_KEY = '@notespark_preferences';
const SUBSCRIPTION_KEY = '@notespark_subscription';

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [subscription, setSubscription] = useState<SubscriptionStatus>(defaultSubscription);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on app start
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      
      // Load preferences
      const storedPreferences = await AsyncStorage.getItem(PREFERENCES_KEY);
      if (storedPreferences) {
        const parsed = JSON.parse(storedPreferences);
        setPreferences({ ...defaultPreferences, ...parsed });
      }

      // Load subscription status
      const storedSubscription = await AsyncStorage.getItem(SUBSCRIPTION_KEY);
      if (storedSubscription) {
        const parsed = JSON.parse(storedSubscription);
        setSubscription({ ...defaultSubscription, ...parsed });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load app settings. Using defaults.');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async <K extends keyof AppPreferences>(
    key: K, 
    value: AppPreferences[K]
  ): Promise<void> => {
    try {
      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);
      
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPreferences));
      
      console.log(`Settings updated: ${key} = ${value}`);
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
      throw error;
    }
  };

  const resetPreferences = async (): Promise<void> => {
    try {
      setPreferences(defaultPreferences);
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(defaultPreferences));
      console.log('Settings reset to defaults');
    } catch (error) {
      console.error('Error resetting preferences:', error);
      Alert.alert('Error', 'Failed to reset settings. Please try again.');
      throw error;
    }
  };

  const upgradeSubscription = async (plan: 'pro' | 'premium'): Promise<void> => {
    try {
      // In a real app, this would integrate with a payment processor
      // For now, we'll simulate the upgrade
      const newSubscription: SubscriptionStatus = {
        plan,
        isActive: true,
        expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)), // 1 year from now
        features: {
          advancedImageAnalysis: true, // Pro/Premium get advanced Gemini features
          unlimitedNotes: plan === 'premium' ? true : false,
          exportFormats: true,
          prioritySupport: plan === 'premium' ? true : false,
          advancedAI: plan === 'premium' ? true : false,
        },
      };

      setSubscription(newSubscription);
      await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(newSubscription));
      
      Alert.alert(
        'Upgrade Successful!', 
        `Welcome to NoteSpark AI ${plan.charAt(0).toUpperCase() + plan.slice(1)}! 🎉\n\nYour new features are now available.`
      );
      
      console.log(`Subscription upgraded to ${plan}`);
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      Alert.alert('Upgrade Failed', 'Unable to process upgrade. Please try again.');
      throw error;
    }
  };

  const contextValue: SettingsContextType = {
    preferences,
    subscription,
    updatePreference,
    resetPreferences,
    upgradeSubscription,
    isLoading,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext;
