import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Surface, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HomeScreenNavigationProp } from '../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const theme = useTheme();
  const { user, signOut } = useAuth();

  const handleScanDocument = () => {
    navigation.navigate('Scanner');
  };

  const handleViewLibrary = () => {
    navigation.navigate('Library');
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineLarge" style={styles.title}>
            NoteSpark AI
          </Text>
          <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Transform your documents into smart notes
          </Text>
        </View>

        {/* Main Actions */}
        <View style={styles.actionsContainer}>
          <Surface style={[styles.actionCard, { backgroundColor: theme.colors.primaryContainer }]} elevation={2}>
            <View style={styles.actionContent}>
              <Icon 
                name="camera-plus" 
                size={48} 
                color={theme.colors.onPrimaryContainer} 
                style={styles.actionIcon}
              />
              <Text variant="headlineSmall" style={[styles.actionTitle, { color: theme.colors.onPrimaryContainer }]}>
                Scan Document
              </Text>
              <Text variant="bodyMedium" style={[styles.actionDescription, { color: theme.colors.onPrimaryContainer }]}>
                Capture text from images and transform it with AI
              </Text>
              <Button 
                mode="contained" 
                onPress={handleScanDocument}
                style={styles.actionButton}
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
              >
                Start Scanning
              </Button>
            </View>
          </Surface>

          <Surface style={[styles.actionCard, { backgroundColor: theme.colors.secondaryContainer }]} elevation={2}>
            <View style={styles.actionContent}>
              <Icon 
                name="library" 
                size={48} 
                color={theme.colors.onSecondaryContainer} 
                style={styles.actionIcon}
              />
              <Text variant="headlineSmall" style={[styles.actionTitle, { color: theme.colors.onSecondaryContainer }]}>
                My Notes
              </Text>
              <Text variant="bodyMedium" style={[styles.actionDescription, { color: theme.colors.onSecondaryContainer }]}>
                View and manage your transformed notes
              </Text>
              <Button 
                mode="contained" 
                onPress={handleViewLibrary}
                style={styles.actionButton}
                buttonColor={theme.colors.secondary}
                textColor={theme.colors.onSecondary}
              >
                View Library
              </Button>
            </View>
          </Surface>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>0</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Notes Created</Text>
          </Surface>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>0</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Documents Scanned</Text>
          </Surface>
        </View>

        {/* User Info & Sign Out */}
        <View style={styles.userSection}>
          <Text variant="bodySmall" style={[styles.userInfo, { color: theme.colors.onSurfaceVariant }]}>
            Signed in as: {user?.email}
          </Text>
          <Button 
            mode="outlined" 
            onPress={handleSignOut}
            style={styles.signOutButton}
            textColor={theme.colors.error}
            icon="logout"
          >
            Sign Out
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
  },
  actionsContainer: {
    flex: 1,
    gap: 16,
  },
  actionCard: {
    borderRadius: 16,
    padding: 24,
    flex: 1,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  actionIcon: {
    marginBottom: 16,
  },
  actionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  actionDescription: {
    textAlign: 'center',
    marginBottom: 24,
  },
  actionButton: {
    paddingHorizontal: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  userSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  userInfo: {
    marginBottom: 12,
    textAlign: 'center',
  },
  signOutButton: {
    paddingHorizontal: 24,
  },
});
