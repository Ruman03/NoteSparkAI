// src/screens/EnhancedLibraryScreen.tsx
// NoteSpark AI - Enhanced Library with Folder Organization
// Professional library management with folder navigation and organization tools

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  Appbar,
  Card,
  Text,
  Button,
  IconButton,
  useTheme,
  ActivityIndicator,
  Chip,
  Surface,
  Searchbar,
  FAB,
  Menu,
  Divider,
  Avatar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { useFolders } from '../contexts/FolderContext';
import { useAuth } from '../contexts/AuthContext';
import { Folder, Note } from '../types/folders';
import { hapticService } from '../services/HapticService';
import AppIcon from '../components/AppIcon';
import type { LibraryScreenNavigationProp } from '../types/navigation';

interface EnhancedLibraryScreenProps {
  navigation: LibraryScreenNavigationProp;
}

type ViewMode = 'folders' | 'notes' | 'search';
type SortMode = 'updated' | 'created' | 'alphabetical' | 'size';

const EnhancedLibraryScreen: React.FC<EnhancedLibraryScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { user } = useAuth();
  const {
    folders,
    currentFolder,
    isLoading,
    error,
    refreshFolders,
    setCurrentFolder,
    navigateToFolder,
    getNotesInFolder,
    createFolder,
    deleteFolder,
    searchFoldersAndNotes,
    availableColors,
    availableIcons,
  } = useFolders();

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('folders');
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ folders: Folder[]; notes: Note[] }>({ folders: [], notes: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [folderMenuVisible, setFolderMenuVisible] = useState<{[key: string]: boolean}>({});
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [isGridView, setIsGridView] = useState(false);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      if (viewMode === 'folders') {
        refreshFolders();
      } else if (viewMode === 'notes') {
        loadNotesForCurrentFolder();
      }
    }, [viewMode, currentFolder])
  );

  // Load notes for current folder
  const loadNotesForCurrentFolder = useCallback(async () => {
    try {
      const folderNotes = await getNotesInFolder(currentFolder?.id || null, true);
      setNotes(folderNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  }, [currentFolder?.id, getNotesInFolder]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapticService.light();
    
    if (viewMode === 'folders') {
      await refreshFolders();
    } else if (viewMode === 'notes') {
      await loadNotesForCurrentFolder();
    } else if (viewMode === 'search' && searchQuery) {
      await handleSearch(searchQuery);
    }
    
    setRefreshing(false);
  }, [viewMode, refreshFolders, loadNotesForCurrentFolder, searchQuery]);

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults({ folders: [], notes: [] });
      return;
    }

    try {
      const results = await searchFoldersAndNotes(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    }
  }, [searchFoldersAndNotes]);

  // Handle folder selection
  const handleFolderPress = useCallback(async (folder: Folder) => {
    hapticService.light();
    await navigateToFolder(folder.id);
    setViewMode('notes');
  }, [navigateToFolder]);

  // Handle note selection
  const handleNotePress = useCallback((note: Note) => {
    hapticService.light();
    navigation.navigate('Editor', { 
      noteText: note.content,
      tone: (note.tone as 'professional' | 'casual' | 'simplified') || 'professional',
      noteId: note.id,
      noteTitle: note.title,
    });
  }, [navigation]);

  // Handle back navigation
  const handleBackPress = useCallback(() => {
    if (viewMode === 'notes' && currentFolder) {
      setCurrentFolder(null);
      setViewMode('folders');
    } else if (viewMode === 'search') {
      setViewMode('folders');
      setSearchQuery('');
    }
  }, [viewMode, currentFolder, setCurrentFolder]);

  // Create new folder with improved error handling
  const handleCreateFolder = useCallback(() => {
    hapticService.light();
    
    // Use a custom dialog since Alert.prompt may not work consistently
    Alert.alert(
      'Create New Folder',
      'What would you like to name your folder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: () => {
            // Navigate to a simple text input screen or use a different approach
            createFolderWithPrompt();
          },
        },
      ]
    );
  }, []);

  const createFolderWithPrompt = useCallback(async () => {
    try {
      // For now, let's create a simple folder with default name and allow editing later
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const defaultName = `New Folder ${timestamp}`;
      
      const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
      const success = await createFolder({
        name: defaultName,
        color: randomColor,
        icon: 'folder',
        description: 'Created from library'
      });
      
      if (success) {
        hapticService.success();
        Alert.alert(
          'Folder Created!', 
          `"${defaultName}" has been created. You can rename it by tapping and holding on the folder.`,
          [{ text: 'Got it!' }]
        );
      } else {
        Alert.alert('Error', 'Failed to create folder. Please try again.');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      Alert.alert('Error', 'Failed to create folder. Please check your connection and try again.');
    }
  }, [createFolder, availableColors]);

  // Delete folder with confirmation
  const handleDeleteFolder = useCallback((folder: Folder) => {
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete "${folder.name}"? ${folder.noteCount > 0 ? 'Notes will be moved to Inbox.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteFolder(folder.id);
            if (success) {
              hapticService.success();
            }
          },
        },
      ]
    );
  }, [deleteFolder]);

  // Handle edit folder
  const handleEditFolder = useCallback((folder: Folder) => {
    setEditingFolder(folder);
    setFolderMenuVisible(prev => ({ ...prev, [folder.id]: false }));
    // Navigate to folder edit screen or show edit modal
    // For now, let's use a simple prompt approach
    Alert.prompt(
      'Edit Folder',
      'Enter a new name for the folder:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newName?: string) => {
            if (newName && newName.trim()) {
              // We'll need to implement updateFolder in FolderContext
              // For now, just show a message
              Alert.alert('Info', 'Folder editing feature will be implemented in the next update.');
            }
          },
        },
      ],
      'plain-text',
      folder.name
    );
  }, []);

  // Toggle folder menu visibility
  const toggleFolderMenu = useCallback((folderId: string) => {
    setFolderMenuVisible(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  }, []);

  // Close all folder menus
  const closeFolderMenus = useCallback(() => {
    setFolderMenuVisible({});
  }, []);

  // Optimized sort functions for React Native performance
  const sortedFolders = React.useMemo(() => {
    return [...folders].sort((a, b) => {
      switch (sortMode) {
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'size':
          return b.noteCount - a.noteCount;
        default: // updated
          return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
    });
  }, [folders, sortMode]);

  const sortedNotes = React.useMemo(() => {
    return [...notes].sort((a, b) => {
      switch (sortMode) {
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'size':
          return (b.size || 0) - (a.size || 0);
        default: // updated
          return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
    });
  }, [notes, sortMode]);

  // Render folder item with proper icon handling
  const renderFolderItem = ({ item: folder }: { item: Folder }) => (
    <TouchableOpacity onPress={() => handleFolderPress(folder)}>
      <Card style={[styles.folderCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.folderContent}>
          <View style={styles.folderHeader}>
            <Avatar.Icon
              size={48}
              icon={folder.icon === 'folder' ? 'folder' : folder.icon || 'folder-outline'}
              style={{ backgroundColor: folder.color || theme.colors.primaryContainer }}
            />
            <View style={styles.folderInfo}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                {folder.name}
              </Text>
              {folder.description && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {folder.description}
                </Text>
              )}
              <View style={styles.folderMeta}>
                <Chip mode="outlined" compact>
                  {folder.noteCount} note{folder.noteCount !== 1 ? 's' : ''}
                </Chip>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {formatDistanceToNow(folder.updatedAt)} ago
                </Text>
              </View>
            </View>
            <Menu
              visible={folderMenuVisible[folder.id] || false}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  onPress={() => toggleFolderMenu(folder.id)}
                />
              }
              onDismiss={() => setFolderMenuVisible(prev => ({ ...prev, [folder.id]: false }))}
            >
              <Menu.Item
                onPress={() => handleEditFolder(folder)}
                title="Edit"
                leadingIcon="pencil"
              />
              <Menu.Item
                onPress={() => {
                  setFolderMenuVisible(prev => ({ ...prev, [folder.id]: false }));
                  handleDeleteFolder(folder);
                }}
                title="Delete"
                leadingIcon="delete"
              />
            </Menu>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Render note item
  const renderNoteItem = ({ item: note }: { item: Note }) => (
    <TouchableOpacity onPress={() => handleNotePress(note)}>
      <Card style={[styles.noteCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Text variant="titleMedium" numberOfLines={2} style={{ color: theme.colors.onSurface }}>
            {note.title}
          </Text>
          <Text
            variant="bodySmall"
            numberOfLines={3}
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
          >
            {note.content.replace(/<[^>]*>/g, '').substring(0, 150)}...
          </Text>
          <View style={styles.noteMeta}>
            {note.tone && (
              <Chip mode="outlined" compact>
                {note.tone}
              </Chip>
            )}
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatDistanceToNow(note.updatedAt)} ago
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Render header
  const renderHeader = () => {
    const showBackButton = viewMode !== 'folders';
    const title = viewMode === 'search' ? 'Search Results' : 
                  viewMode === 'notes' ? (currentFolder?.name || 'Inbox') : 'Library';
    
    return (
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        {showBackButton && (
          <Appbar.BackAction onPress={handleBackPress} />
        )}
        <Appbar.Content title={title} titleStyle={{ fontWeight: 'bold' }} />
        
        {viewMode !== 'search' && (
          <>
            <Menu
              visible={showSortMenu}
              onDismiss={() => setShowSortMenu(false)}
              anchor={
                <Appbar.Action 
                  icon="sort" 
                  onPress={() => setShowSortMenu(true)}
                />
              }
            >
              <Menu.Item
                onPress={() => { setSortMode('updated'); setShowSortMenu(false); }}
                title="Last Updated"
                leadingIcon={sortMode === 'updated' ? 'check' : undefined}
              />
              <Menu.Item
                onPress={() => { setSortMode('created'); setShowSortMenu(false); }}
                title="Date Created"
                leadingIcon={sortMode === 'created' ? 'check' : undefined}
              />
              <Menu.Item
                onPress={() => { setSortMode('alphabetical'); setShowSortMenu(false); }}
                title="Alphabetical"
                leadingIcon={sortMode === 'alphabetical' ? 'check' : undefined}
              />
              <Menu.Item
                onPress={() => { setSortMode('size'); setShowSortMenu(false); }}
                title="Size"
                leadingIcon={sortMode === 'size' ? 'check' : undefined}
              />
            </Menu>
            
            <Appbar.Action 
              icon={isGridView ? 'view-list' : 'view-grid'} 
              onPress={() => setIsGridView(!isGridView)}
            />
          </>
        )}
        
        <Appbar.Action 
          icon="magnify" 
          onPress={() => setViewMode('search')}
        />
      </Appbar.Header>
    );
  };

  // Render content based on view mode
  const renderContent = () => {
    if (viewMode === 'search') {
      return (
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search folders and notes..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            onSubmitEditing={() => handleSearch(searchQuery)}
            style={styles.searchBar}
          />
          
          {searchQuery && (
            <View style={styles.searchResults}>
              {searchResults.folders.length > 0 && (
                <>
                  <Text variant="titleMedium" style={styles.searchSectionTitle}>
                    Folders ({searchResults.folders.length})
                  </Text>
                  <FlatList
                    data={searchResults.folders}
                    renderItem={renderFolderItem}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </>
              )}
              
              {searchResults.notes.length > 0 && (
                <>
                  <Text variant="titleMedium" style={styles.searchSectionTitle}>
                    Notes ({searchResults.notes.length})
                  </Text>
                  <FlatList
                    data={searchResults.notes}
                    renderItem={renderNoteItem}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </>
              )}
              
              {searchResults.folders.length === 0 && searchResults.notes.length === 0 && (
                <View style={styles.emptyState}>
                  <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                    No results found for "{searchQuery}"
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      );
    }

    if (isLoading && (viewMode === 'folders' ? folders.length === 0 : notes.length === 0)) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
            Loading {viewMode}...
          </Text>
        </View>
      );
    }

    const data = viewMode === 'folders' ? sortedFolders : sortedNotes;

    if (data.length === 0) {
      return (
        <View style={styles.emptyState}>
          <AppIcon 
            name={viewMode === 'folders' ? 'folder-outline' : 'note-outline'} 
            size={64} 
            color={theme.colors.onSurfaceVariant} 
          />
          <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, marginTop: 16 }}>
            No {viewMode} yet
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 8 }}>
            {viewMode === 'folders' 
              ? 'Create your first folder to organize your notes'
              : currentFolder
                ? `No notes in "${currentFolder.name}" yet`
                : 'No notes in your inbox yet'
            }
          </Text>
          {viewMode === 'folders' && (
            <Button
              mode="contained"
              onPress={handleCreateFolder}
              style={styles.createButton}
            >
              Create Folder
            </Button>
          )}
        </View>
      );
    }

    if (viewMode === 'folders') {
      return (
        <FlatList
          data={sortedFolders}
          renderItem={renderFolderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          numColumns={isGridView ? 2 : 1}
          key={isGridView ? 'grid' : 'list'}
        />
      );
    } else {
      return (
        <FlatList
          data={sortedNotes}
          renderItem={renderNoteItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          numColumns={isGridView ? 2 : 1}
          key={isGridView ? 'grid' : 'list'}
        />
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TouchableOpacity 
        style={{ flex: 1 }} 
        activeOpacity={1} 
        onPress={closeFolderMenus}
      >
        {renderHeader()}
        
        {error && (
          <Surface style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
            <Text style={{ color: theme.colors.onErrorContainer }}>{error}</Text>
          </Surface>
        )}
        
        {renderContent()}
      </TouchableOpacity>
      
      {viewMode === 'folders' && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={handleCreateFolder}
        />
      )}
      
      {viewMode === 'notes' && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.navigate('Editor', { 
            noteText: '', 
            tone: 'professional' 
          })}
        />
      )}
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorBanner: {
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  folderCard: {
    marginBottom: 12,
    elevation: 2,
  },
  folderContent: {
    paddingVertical: 16,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  folderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  noteCard: {
    marginBottom: 12,
    elevation: 1,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  searchContainer: {
    flex: 1,
  },
  searchBar: {
    margin: 16,
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchSectionTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  createButton: {
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
});

export default EnhancedLibraryScreen;
