// src/screens/LibraryScreen.tsx
// NoteSpark AI - Clean, Modern Library Screen
// Simple, Eye-Catching & Functional Design

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  RefreshControl, 
  ActivityIndicator,
  Dimensions,
  Alert,
  StatusBar,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { 
  Text, 
  useTheme, 
  FAB,
  Surface,
  IconButton,
  Searchbar,
  SegmentedButtons,
  Badge,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LibraryScreenNavigationProp } from '../types/navigation';
import { NotesService } from '../services/NotesService';
import type { Note } from '../types';
import type { Folder } from '../types/folders';
import auth from '@react-native-firebase/auth';

import { hapticService } from '../services/HapticService';
import { useFolders } from '../contexts/FolderContext';
import NoteCard from '../components/library/NoteCard';
import NoteActionsModal from '../components/library/NoteActionsModal';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 120;
const SEARCH_DEBOUNCE_MS = 300;

interface LibraryScreenProps {
  navigation: LibraryScreenNavigationProp;
}

const LibraryScreen: React.FC<LibraryScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const notesService = NotesService.getInstance();
  const { 
    folders, 
    isLoading: foldersLoading, 
    refreshFolders,
    getNotesInFolder,
    navigateToFolder,
    setCurrentFolder,
    createFolder
  } = useFolders();

  // Clean State Management - No Complex Caching
  const [activeTab, setActiveTab] = useState<'folders' | 'notes'>('folders');
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  
  // Actions modal state
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Animation values
  const searchAnimation = useSharedValue(0);
  const tabTransition = useSharedValue(activeTab === 'folders' ? 0 : 1);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // OPTIMIZED: Stable loadData function with proper memoization
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    const user = auth().currentUser;
    if (!user) return;

    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      if (activeTab === 'folders') {
        // Only refresh folders if not already loading
        if (!foldersLoading) {
          await refreshFolders();
        }
      } else {
        let userNotes: Note[];
        if (selectedFolder) {
          // Load notes from selected folder
          const folderNotes = await getNotesInFolder(selectedFolder.id);
          userNotes = folderNotes.map(note => ({
            id: note.id,
            title: note.title,
            content: note.content,
            plainText: note.content || '',
            tone: (note.tone as 'professional' | 'casual' | 'simplified') || 'professional',
            wordCount: note.wordCount || 0,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            userId: user.uid,
            createdBy: note.createdBy,
            tags: note.tags || [],
            isStarred: false,
            folderId: note.folderId,
          }));
        } else {
          // Load all notes
          const allNotes = await notesService.getUserNotes(user.uid);
          userNotes = allNotes.filter(note => !note.folderId || note.folderId === '');
        }
        setNotes(userNotes);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, selectedFolder?.id, refreshFolders, getNotesInFolder, notesService, foldersLoading]); // Stable dependencies

  // OPTIMIZED: Stable useFocusEffect with proper dependency management
  const shouldLoadDataRef = useRef(true);
  
  useFocusEffect(
    useCallback(() => {
      // Only load if we should load and not already loading
      if (shouldLoadDataRef.current && !isLoading && !foldersLoading) {
        loadData();
        shouldLoadDataRef.current = false; // Prevent immediate reloads
      }
      
      // Reset the flag after a short delay to allow future loads
      const timer = setTimeout(() => {
        shouldLoadDataRef.current = true;
      }, 1000);
      
      return () => {
        clearTimeout(timer);
      };
    }, [loadData, isLoading, foldersLoading]) // Include stable dependencies
  );

  // OPTIMIZED: Handle tab change with stable state management
  const handleTabChange = useCallback((tab: 'folders' | 'notes') => {
    if (tab === activeTab) return;
    
    hapticService.light();
    setActiveTab(tab);
    setSearchQuery(''); // Clear search when switching tabs
    
    // Animate tab transition
    tabTransition.value = withTiming(tab === 'folders' ? 0 : 1, { duration: 300 });
    
    // Reset selected folder when going back to folders
    if (tab === 'folders') {
      setSelectedFolder(null);
    }
    
    // Allow data loading for new tab
    shouldLoadDataRef.current = true;
  }, [activeTab, tabTransition]);

  // Handle search with debouncing
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      // Search will be handled by the filtered data computation
      hapticService.light();
    }, SEARCH_DEBOUNCE_MS);
    
    setSearchTimeout(timeout);
  }, [searchTimeout]);

  // Toggle search bar
  const toggleSearch = useCallback(() => {
    const newShowSearch = !showSearch;
    setShowSearch(newShowSearch);
    
    searchAnimation.value = withTiming(newShowSearch ? 1 : 0, { duration: 300 });
    
    if (!newShowSearch) {
      setSearchQuery('');
    }
    
    hapticService.light();
  }, [showSearch, searchAnimation]);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    if (activeTab === 'folders') {
      if (!query) return folders;
      return folders.filter(folder => 
        folder.name.toLowerCase().includes(query) ||
        (folder.description && folder.description.toLowerCase().includes(query))
      );
    } else {
      if (!query) return notes;
      return notes.filter(note => 
        (note.title && note.title.toLowerCase().includes(query)) ||
        (note.plainText && note.plainText.toLowerCase().includes(query)) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
  }, [activeTab, folders, notes, searchQuery]);

  // Get note count for folder
  const getFolderNoteCount = useCallback(async (folderId: string) => {
    try {
      const folderNotes = await getNotesInFolder(folderId);
      return folderNotes.length;
    } catch (error) {
      return 0;
    }
  }, [getNotesInFolder]);

  // Handle folder press
  const handleFolderPress = useCallback(async (folder: Folder) => {
    hapticService.light();
    setSelectedFolder(folder);
    setActiveTab('notes');
    await navigateToFolder(folder.id);
  }, [navigateToFolder]);

  // Handle note press
  const handleNotePress = useCallback((note: Note) => {
    hapticService.light();
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('Editor', {
        noteId: note.id,
        noteText: note.content,
        tone: note.tone,
        originalText: note.originalText || ''
      });
    }
  }, [navigation]);

  // Handle note actions
  const handleShowNoteActions = useCallback((note: Note) => {
    setSelectedNote(note);
    setShowActionsModal(true);
    hapticService.medium();
  }, []);

  const handleNoteDeleted = useCallback((noteId: string) => {
    hapticService.light();
    setNotes(prev => prev.filter(note => note.id !== noteId));
    setShowActionsModal(false);
    setSelectedNote(null);
  }, []);

  const handleEditNote = useCallback((note: Note) => {
    setShowActionsModal(false);
    setSelectedNote(null);
    handleNotePress(note);
  }, [handleNotePress]);

  // FAB actions
  const handleNewFolder = useCallback(() => {
    hapticService.medium();
    Alert.prompt(
      'Create New Folder',
      'Enter a name for your new folder:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (folderName: string | undefined) => {
            if (folderName && folderName.trim()) {
              try {
                await createFolder({ 
                  name: folderName.trim(),
                  description: '', 
                  color: theme.colors.primary 
                });
                hapticService.success();
                loadData(true); // Refresh data
              } catch (error) {
                Alert.alert('Error', 'Failed to create folder. Please try again.');
              }
            }
          },
        },
      ],
      'plain-text'
    );
  }, [createFolder, theme.colors.primary]); // Remove loadData dependency

  const handleScanDocument = useCallback(() => {
    hapticService.medium();
    navigation.navigate('Scanner');
  }, [navigation]);

  // Animated styles
  const searchBarStyle = useAnimatedStyle(() => {
    const opacity = interpolate(searchAnimation.value, [0, 1], [0, 1]);
    const height = interpolate(searchAnimation.value, [0, 1], [0, 56]);
    
    return {
      opacity,
      height,
      overflow: 'hidden',
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      flex: 1,
    };
  });

  // Render folder card with proper touch handling
  const renderFolderCard = useCallback(({ item }: { item: Folder }) => (
    <TouchableOpacity 
      onPress={() => handleFolderPress(item)}
      activeOpacity={0.7}
    >
      <Surface 
        style={[styles.folderCard, { backgroundColor: theme.colors.surface }]} 
        elevation={1}
      >
        <View style={styles.folderContent}>
          <View style={styles.folderHeader}>
            <IconButton 
              icon="folder" 
              size={24} 
              iconColor={theme.colors.primary}
              style={styles.folderIcon}
            />
            <View style={styles.folderInfo}>
              <Text variant="titleMedium" style={styles.folderName}>
                {item.name}
              </Text>
              <Text variant="bodySmall" style={[styles.folderMeta, { color: theme.colors.onSurfaceVariant }]}>
                Tap to view notes
              </Text>
            </View>
            <IconButton 
              icon="chevron-right" 
              size={20} 
              iconColor={theme.colors.onSurfaceVariant}
            />
          </View>
          {item.description && (
            <Text 
              variant="bodySmall" 
              style={[styles.folderDescription, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}
        </View>
      </Surface>
    </TouchableOpacity>
  ), [theme.colors, handleFolderPress]);

  // Render note card
  const renderNoteCard = useCallback(({ item }: { item: Note }) => (
    <NoteCard 
      note={item} 
      onPress={() => handleNotePress(item)} 
      onShowActions={() => handleShowNoteActions(item)}
      viewMode="list"
    />
  ), [handleNotePress, handleShowNoteActions]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <StatusBar 
        barStyle={theme.dark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.surface} 
      />
      
      {/* Header */}
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <Text variant="headlineSmall" style={styles.title}>
              📚 Library
            </Text>
            <IconButton 
              icon="magnify" 
              size={24} 
              onPress={toggleSearch}
              iconColor={theme.colors.onSurface}
            />
          </View>
          
          {/* Search Bar */}
          <Animated.View style={searchBarStyle}>
            <Searchbar
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChangeText={handleSearch}
              style={[styles.searchBar, { backgroundColor: theme.colors.surfaceVariant }]}
              inputStyle={{ color: theme.colors.onSurface }}
            />
          </Animated.View>
          
          {/* Tab Bar */}
          <SegmentedButtons
            value={activeTab}
            onValueChange={handleTabChange}
            buttons={[
              {
                value: 'folders',
                label: 'Folders',
                icon: 'folder',
                showSelectedCheck: true,
              },
              {
                value: 'notes',
                label: selectedFolder ? selectedFolder.name : 'All Notes',
                icon: 'note-text',
                showSelectedCheck: true,
              },
            ]}
            style={styles.tabBar}
            density="small"
          />
          
          {/* Breadcrumb for folder navigation */}
          {selectedFolder && activeTab === 'notes' && (
            <TouchableOpacity 
              style={styles.breadcrumb}
              onPress={() => {
                setSelectedFolder(null);
                setActiveTab('folders');
                hapticService.light();
              }}
            >
              <Text 
                variant="bodySmall" 
                style={[styles.breadcrumbText, { color: theme.colors.primary }]}
              >
                ← Back to Folders
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Surface>
      
      {/* Content */}
      <Animated.View style={[styles.content, contentStyle]}>
        {(isLoading && !isRefreshing) ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
              Loading {activeTab}...
            </Text>
          </View>
        ) : filteredData.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text variant="headlineSmall" style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}>
              {searchQuery ? 'No Results Found' : `No ${activeTab} Yet`}
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyDescription, { color: theme.colors.onSurfaceVariant }]}>
              {searchQuery 
                ? `Try adjusting your search terms` 
                : activeTab === 'folders' 
                  ? 'Create your first folder to organize notes'
                  : 'Start by scanning or creating a new note'
              }
            </Text>
          </View>
        ) : (
          <FlashList
            data={filteredData as readonly any[]}
            renderItem={({ item }: { item: any }) => {
              if (activeTab === 'folders') {
                return renderFolderCard({ item: item as Folder });
              } else {
                return renderNoteCard({ item: item as Note });
              }
            }}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={styles.listContent}
            estimatedItemSize={80}
            refreshControl={
              <RefreshControl 
                refreshing={isRefreshing} 
                onRefresh={() => loadData(true)}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )}
      </Animated.View>
      
      {/* Context-Aware FAB */}
      <FAB
        icon={activeTab === 'folders' ? 'folder-plus' : 'camera-plus'}
        label={activeTab === 'folders' ? 'New Folder' : 'Scan Note'}
        onPress={activeTab === 'folders' ? handleNewFolder : handleScanDocument}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
      />
      
      {/* Note Actions Modal */}
      <NoteActionsModal
        visible={showActionsModal}
        note={selectedNote}
        onDismiss={() => setShowActionsModal(false)}
        onEditNote={handleEditNote}
        onNoteDeleted={handleNoteDeleted}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 8,
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  title: {
    fontWeight: '600',
  },
  searchBar: {
    marginVertical: 8,
  },
  tabBar: {
    marginVertical: 8,
  },
  breadcrumb: {
    paddingVertical: 4,
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 80, // Space for FAB
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDescription: {
    textAlign: 'center',
    marginBottom: 24,
  },
  folderCard: {
    borderRadius: 12,
    marginVertical: 4,
  },
  folderContent: {
    padding: 16,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderIcon: {
    margin: 0,
    marginRight: 8,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  folderMeta: {
    fontSize: 12,
  },
  folderDescription: {
    marginTop: 8,
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 16,
  },
});

export default LibraryScreen;
