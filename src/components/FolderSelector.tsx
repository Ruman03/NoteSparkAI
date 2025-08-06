// src/components/FolderSelector.tsx
// NoteSpark AI - Folder Selection Component
// Allows users to select existing folders or create new ones during note creation

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Surface,
  Text,
  useTheme,
  IconButton,
  Button,
  Card,
  Divider,
  TextInput,
  Chip,
  Avatar,
} from 'react-native-paper';
import { useFolders } from '../contexts/FolderContext';
import { hapticService } from '../services/HapticService';
import type { Folder } from '../types/folders';

interface FolderSelectorProps {
  visible: boolean;
  onDismiss: () => void;
  onFolderSelected: (folderId: string | null, folderName?: string) => void;
  selectedFolderId?: string | null;
  title?: string;
  showCreateFolder?: boolean;
}

export default function FolderSelector({
  visible,
  onDismiss,
  onFolderSelected,
  selectedFolderId,
  title = 'Select Folder',
  showCreateFolder = true,
}: FolderSelectorProps) {
  const theme = useTheme();
  const { folders, createFolder } = useFolders();
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleFolderSelect = (folderId: string | null, folderName?: string) => {
    hapticService.light();
    onFolderSelected(folderId, folderName);
    onDismiss();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    try {
      setIsCreating(true);
      const success = await createFolder({
        name: newFolderName.trim(),
        description: '',
        color: '#6366F1',
        icon: 'folder',
      });

      if (success) {
        setNewFolderName('');
        setIsCreating(false);
        // Refresh folders list, then let user select manually
        hapticService.success();
        Alert.alert('Success', 'Folder created successfully!');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      Alert.alert('Error', 'Failed to create folder. Please try again.');
      setIsCreating(false);
    }
  };

  const renderFolderItem = (folder: Folder) => (
    <TouchableOpacity
      key={folder.id}
      onPress={() => handleFolderSelect(folder.id, folder.name)}
    >
      <Card style={[
        styles.folderCard,
        selectedFolderId === folder.id && {
          backgroundColor: theme.colors.primaryContainer,
          borderColor: theme.colors.primary,
          borderWidth: 2,
        }
      ]}>
        <Card.Content style={styles.folderContent}>
          <Avatar.Icon
            size={40}
            icon={folder.icon || 'folder'}
            style={{ backgroundColor: folder.color }}
          />
          <View style={styles.folderInfo}>
            <Text variant="titleMedium">{folder.name}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {folder.noteCount} {folder.noteCount === 1 ? 'note' : 'notes'}
            </Text>
          </View>
          {selectedFolderId === folder.id && (
            <IconButton
              icon="check"
              iconColor={theme.colors.primary}
              size={20}
            />
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
    >
      <View style={[
        styles.modal,
        { backgroundColor: theme.colors.surface }
      ]}>
        <Surface style={styles.modalContent} elevation={3}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            {title}
          </Text>
          <IconButton
            icon="close"
            onPress={onDismiss}
          />
        </View>

        <Divider />

        {/* Inbox Option */}
        <TouchableOpacity
          onPress={() => handleFolderSelect(null, 'Inbox')}
        >
          <Card style={[
            styles.folderCard,
            selectedFolderId === null && {
              backgroundColor: theme.colors.primaryContainer,
              borderColor: theme.colors.primary,
              borderWidth: 2,
            }
          ]}>
            <Card.Content style={styles.folderContent}>
              <Avatar.Icon
                size={40}
                icon="inbox"
                style={{ backgroundColor: theme.colors.secondary }}
              />
              <View style={styles.folderInfo}>
                <Text variant="titleMedium">Inbox</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Unorganized notes
                </Text>
              </View>
              {selectedFolderId === null && (
                <IconButton
                  icon="check"
                  iconColor={theme.colors.primary}
                  size={20}
                />
              )}
            </Card.Content>
          </Card>
        </TouchableOpacity>

        {/* Folders List */}
        <ScrollView style={styles.foldersContainer} showsVerticalScrollIndicator={false}>
          {folders.map(renderFolderItem)}
        </ScrollView>

        {/* Create New Folder */}
        {showCreateFolder && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.createSection}>
              <Text variant="titleSmall" style={styles.createTitle}>
                Create New Folder
              </Text>
              <TextInput
                mode="outlined"
                label="Folder Name"
                value={newFolderName}
                onChangeText={setNewFolderName}
                style={styles.textInput}
                disabled={isCreating}
                onSubmitEditing={handleCreateFolder}
              />
              <Button
                mode="contained"
                onPress={handleCreateFolder}
                loading={isCreating}
                disabled={!newFolderName.trim() || isCreating}
                style={styles.createButton}
              >
                Create Folder
              </Button>
            </View>
          </>
        )}
      </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: 'center',
    margin: 20,
  },
  modalContent: {
    borderRadius: 16,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  foldersContainer: {
    maxHeight: 300,
    padding: 16,
  },
  folderCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  folderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  folderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  divider: {
    marginVertical: 8,
  },
  createSection: {
    padding: 16,
  },
  createTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  textInput: {
    marginBottom: 12,
  },
  createButton: {
    alignSelf: 'flex-start',
  },
});
