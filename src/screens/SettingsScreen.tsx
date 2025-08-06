// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import {
  Appbar,
  Card,
  List,
  Switch,
  useTheme,
  Avatar,
  Divider,
  Portal,
  Modal,
  Text,
  Button,
  TextInput,
  SegmentedButtons,
  ActivityIndicator,
  Chip,
  Surface,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { hapticService } from '../services/HapticService';
import AppIcon from '../components/AppIcon';
import type { SettingsScreenNavigationProp } from '../types/navigation';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { 
    preferences, 
    subscription, 
    updatePreference, 
    resetPreferences, 
    upgradeSubscription,
    isLoading: settingsLoading 
  } = useSettings();
  
  // Local state for modals and UI
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Handle display name update
  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    try {
      setIsUpdatingProfile(true);
      hapticService.light();
      
      await auth().currentUser?.updateProfile({
        displayName: newDisplayName.trim()
      });
      
      setEditingDisplayName(false);
      Alert.alert('Success', 'Display name updated successfully!');
      hapticService.success();
    } catch (error) {
      console.error('Error updating display name:', error);
      Alert.alert('Error', 'Failed to update display name. Please try again.');
      hapticService.error();
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle preference updates with haptic feedback
  const handlePreferenceUpdate = async <K extends keyof typeof preferences>(
    key: K,
    value: typeof preferences[K]
  ) => {
    try {
      hapticService.light();
      await updatePreference(key, value);
      hapticService.success();
    } catch (error) {
      hapticService.error();
    }
  };

  // Handle subscription upgrade
  const handleUpgrade = async (plan: 'pro' | 'premium') => {
    try {
      hapticService.medium();
      await upgradeSubscription(plan);
      hapticService.success();
    } catch (error) {
      hapticService.error();
    }
  };

  // Handle reset preferences
  const handleResetPreferences = async () => {
    try {
      hapticService.medium();
      await resetPreferences();
      setShowResetModal(false);
      Alert.alert('Success', 'All preferences have been reset to defaults.');
      hapticService.success();
    } catch (error) {
      hapticService.error();
    }
  };

  // Handle sign out
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticService.medium();
              await signOut();
              hapticService.success();
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
              hapticService.error();
            }
          },
        },
      ]
    );
  };

  // Contact support
  const handleContactSupport = () => {
    const email = 'support@notesparkai.com';
    const subject = 'NoteSpark AI Support Request';
    const body = `Hi NoteSpark AI Team,\n\nI need help with:\n\n[Please describe your issue here]\n\nDevice: ${Platform.OS}\nApp Version: 1.0.0\nUser ID: ${user?.uid || 'N/A'}`;
    
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.openURL(mailtoUrl).catch(() => {
      Alert.alert(
        'Email App Not Available',
        `Please email us at: ${email}`,
        [
          { text: 'Copy Email', onPress: () => {/* TODO: Copy to clipboard */} },
          { text: 'OK' }
        ]
      );
    });
  };

  // Rate app
  const handleRateApp = () => {
    const storeUrl = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/notespark-ai'
      : 'https://play.google.com/store/apps/details?id=com.notesparkai';
    
    Linking.openURL(storeUrl).catch(() => {
      Alert.alert('Error', 'Unable to open app store. Please search for "NoteSpark AI" in your app store.');
    });
  };

  if (settingsLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.Content title="Settings" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginTop: 16 }}>
            Loading settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.Content title="Settings" titleStyle={{ fontWeight: 'bold' }} />
      </Appbar.Header>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Section */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Account
            </Text>
            
            <List.Item
              title={user?.displayName || user?.email || 'User'}
              description={user?.email}
              left={() => (
                <Avatar.Text 
                  size={48} 
                  label={(user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                  style={{ backgroundColor: theme.colors.primary }}
                />
              )}
              right={() => <List.Icon icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
              onPress={() => setShowProfileModal(true)}
              style={styles.profileItem}
            />
          </Card.Content>
        </Card>

        {/* Subscription Section */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.subscriptionHeader}>
              <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Subscription
              </Text>
              <Chip 
                icon="crown" 
                mode="flat"
                style={[
                  styles.planBadge, 
                  { 
                    backgroundColor: subscription.plan === 'free' 
                      ? theme.colors.surfaceVariant 
                      : theme.colors.primaryContainer 
                  }
                ]}
                textStyle={{ 
                  color: subscription.plan === 'free' 
                    ? theme.colors.onSurfaceVariant 
                    : theme.colors.onPrimaryContainer,
                  fontWeight: 'bold'
                }}
              >
                {subscription.plan.toUpperCase()}
              </Chip>
            </View>
            
            {subscription.plan === 'free' && (
              <>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
                  Upgrade to unlock advanced features and unlimited notes
                </Text>
                <View style={styles.upgradeButtons}>
                  <Button 
                    mode="contained" 
                    onPress={() => handleUpgrade('pro')}
                    style={styles.upgradeButton}
                    icon="crown"
                  >
                    Upgrade to Pro
                  </Button>
                  <Button 
                    mode="outlined" 
                    onPress={() => handleUpgrade('premium')}
                    style={styles.upgradeButton}
                  >
                    Go Premium
                  </Button>
                </View>
              </>
            )}
            
            {subscription.plan !== 'free' && (
              <List.Item
                title={`${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan Active`}
                description="Thank you for supporting NoteSpark AI!"
                left={() => <List.Icon icon="crown" color={theme.colors.primary} />}
                right={() => <List.Icon icon="check-circle" color={theme.colors.primary} />}
              />
            )}
          </Card.Content>
        </Card>

        {/* Preferences Section */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              App Preferences
            </Text>
            
            {/* Enhanced Image Processing */}
            <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
              Image Processing
            </List.Subheader>
            <Card style={styles.preferenceCard}>
              <List.Item
                title="Enhanced Image Processing"
                description="Advanced AI-powered text recognition with table detection, handwriting support, and document structure analysis"
                left={(props) => <List.Icon {...props} icon="image-outline" />}
                right={() => (
                  <Switch
                    value={preferences.enhancedImageProcessing}
                    onValueChange={(value) => handlePreferenceUpdate('enhancedImageProcessing', value)}
                    disabled={subscription.plan === 'free'}
                  />
                )}
              />
            </Card>
            {subscription.plan === 'free' && (
              <Text variant="bodySmall" style={[styles.proFeatureNote, { color: theme.colors.error }]}>
                Enhanced processing requires Pro subscription. Free tier includes basic text recognition.
              </Text>
            )}

            {/* Default Tone */}
            <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
              Default Note Tone
            </List.Subheader>
            <SegmentedButtons
              value={preferences.defaultTone}
              onValueChange={(value) => handlePreferenceUpdate('defaultTone', value as 'professional' | 'casual' | 'simplified')}
              buttons={[
                { value: 'professional', label: 'Professional' },
                { value: 'casual', label: 'Casual' },
                { value: 'simplified', label: 'Simplified' },
              ]}
              style={styles.segmentedButtons}
            />

            {/* Auto-save */}
            <List.Item
              title="Auto-save"
              description={`Automatically save notes every ${preferences.autoSaveInterval} seconds`}
              left={() => <List.Icon icon="content-save-auto" color={theme.colors.primary} />}
              right={() => (
                <Switch
                  value={preferences.autoSave}
                  onValueChange={(value) => handlePreferenceUpdate('autoSave', value)}
                />
              )}
            />

            {/* Auto-save Interval */}
            {preferences.autoSave && (
              <>
                <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>
                  Auto-save Interval
                </List.Subheader>
                <SegmentedButtons
                  value={preferences.autoSaveInterval.toString()}
                  onValueChange={(value) => handlePreferenceUpdate('autoSaveInterval', parseInt(value))}
                  buttons={[
                    { value: '1', label: '1s' },
                    { value: '3', label: '3s' },
                    { value: '5', label: '5s' },
                    { value: '10', label: '10s' },
                  ]}
                  style={styles.segmentedButtons}
                />
              </>
            )}

            {/* Haptics */}
            <List.Item
              title="Haptic Feedback"
              description="Vibration feedback for app interactions"
              left={() => <List.Icon icon="vibrate" color={theme.colors.primary} />}
              right={() => (
                <Switch
                  value={preferences.haptics}
                  onValueChange={(value) => handlePreferenceUpdate('haptics', value)}
                />
              )}
            />

            {/* Notifications */}
            <List.Item
              title="Notifications"
              description="Receive app notifications and updates"
              left={() => <List.Icon icon="bell" color={theme.colors.primary} />}
              right={() => (
                <Switch
                  value={preferences.notificationsEnabled}
                  onValueChange={(value) => handlePreferenceUpdate('notificationsEnabled', value)}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* Help & Support Section */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Help & Support
            </Text>
            
            <List.Item
              title="Contact Support"
              description="Get help with issues or questions"
              left={() => <List.Icon icon="help-circle" color={theme.colors.primary} />}
              right={() => <List.Icon icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
              onPress={handleContactSupport}
            />
            
            <List.Item
              title="Rate NoteSpark AI"
              description="Help us improve by leaving a review"
              left={() => <List.Icon icon="star" color={theme.colors.primary} />}
              right={() => <List.Icon icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
              onPress={handleRateApp}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Reset Preferences"
              description="Reset all settings to default values"
              left={() => <List.Icon icon="restore" color={theme.colors.error} />}
              right={() => <List.Icon icon="chevron-right" color={theme.colors.onSurfaceVariant} />}
              onPress={() => setShowResetModal(true)}
            />
          </Card.Content>
        </Card>

        {/* App Information */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              About
            </Text>
            
            <List.Item
              title="Version"
              description="1.0.0 (Beta)"
              left={() => <List.Icon icon="information" color={theme.colors.primary} />}
            />
            
            <List.Item
              title="Privacy Policy"
              description="Review our privacy policy"
              left={() => <List.Icon icon="shield-check" color={theme.colors.primary} />}
              right={() => <List.Icon icon="open-in-new" color={theme.colors.onSurfaceVariant} />}
              onPress={() => Linking.openURL('https://notesparkai.com/privacy')}
            />
            
            <List.Item
              title="Terms of Service"
              description="Review our terms of service"
              left={() => <List.Icon icon="file-document" color={theme.colors.primary} />}
              right={() => <List.Icon icon="open-in-new" color={theme.colors.onSurfaceVariant} />}
              onPress={() => Linking.openURL('https://notesparkai.com/terms')}
            />
          </Card.Content>
        </Card>

        {/* Sign Out Button */}
        <Button
          mode="outlined"
          onPress={handleSignOut}
          icon="logout"
          style={[styles.signOutButton, { borderColor: theme.colors.error }]}
          textColor={theme.colors.error}
        >
          Sign Out
        </Button>
      </ScrollView>

      {/* Profile Edit Modal */}
      <Portal>
        <Modal
          visible={showProfileModal}
          onDismiss={() => setShowProfileModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            Edit Profile
          </Text>
          
          <View style={styles.avatarSection}>
            <Avatar.Text 
              size={80} 
              label={(user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              style={{ backgroundColor: theme.colors.primary }}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              {user?.email}
            </Text>
          </View>

          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
            Display Name
          </Text>
          <TextInput
            value={newDisplayName}
            onChangeText={setNewDisplayName}
            mode="outlined"
            placeholder="Enter your display name"
            style={styles.textInput}
            disabled={isUpdatingProfile}
          />

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowProfileModal(false)}
              style={styles.modalButton}
              disabled={isUpdatingProfile}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleUpdateDisplayName}
              style={styles.modalButton}
              loading={isUpdatingProfile}
              disabled={isUpdatingProfile || !newDisplayName.trim()}
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Reset Preferences Modal */}
      <Portal>
        <Modal
          visible={showResetModal}
          onDismiss={() => setShowResetModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <AppIcon name="warning" size={48} color={theme.colors.error} style={styles.warningIcon} />
          <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            Reset Preferences
          </Text>
          <Text variant="bodyMedium" style={[styles.modalDescription, { color: theme.colors.onSurfaceVariant }]}>
            This will reset all your app preferences to their default values. This action cannot be undone.
          </Text>

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowResetModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleResetPreferences}
              style={styles.modalButton}
              buttonColor={theme.colors.error}
            >
              Reset
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  profileItem: {
    paddingVertical: 8,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planBadge: {
    borderRadius: 16,
  },
  upgradeButtons: {
    gap: 8,
  },
  upgradeButton: {
    borderRadius: 8,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  preferenceCard: {
    marginBottom: 8,
    borderRadius: 8,
  },
  proFeatureNote: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  divider: {
    marginVertical: 8,
  },
  signOutButton: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  modalDescription: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  textInput: {
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    minWidth: 80,
  },
  warningIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
});

export default SettingsScreen;
