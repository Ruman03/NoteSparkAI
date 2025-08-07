// src/screens/EnhancedLibraryScreen.tsx
// NoteSpark AI - Enhanced Library with Folder Organization
// Professional library management with folder navigation and organization tools

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
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  interpolateColor,
} from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { 
  Text, 
  useTheme, 
  FAB,
  SegmentedButtons,
  Surface,
  Chip,
  IconButton,
  Badge,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DocumentPickerResponse, pick, types } from '@react-native-documents/picker';

import type { LibraryScreenNavigationProp } from '../types/navigation';
import { NotesService } from '../services/NotesService';
import type { Note } from '../types';
import type { Folder } from '../types/folders';
import auth from '@react-native-firebase/auth';

import { hapticService } from '../services/HapticService';
import { useFolders } from '../contexts/FolderContext';
import LibraryHeader from '../components/library/LibraryHeader';
import NoteCard from '../components/library/NoteCard';
import FolderCard from '../components/library/FolderCard';
import LibraryEmptyState from '../components/library/LibraryEmptyState';
import NoteActionsModal from '../components/library/NoteActionsModal';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 180;
const CARD_MARGIN = 8;
const GRID_ITEM_WIDTH = (width - 32 - CARD_MARGIN) / 2;

interface EnhancedLibraryScreenProps {
  navigation: LibraryScreenNavigationProp;
}

// Performance optimization constants
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const AUTO_REFRESH_INTERVAL = 30 * 1000; // 30 seconds
const SCROLL_THRESHOLD = 100;

const EnhancedLibraryScreen: React.FC<EnhancedLibraryScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const notesService = NotesService.getInstance();
  const { 
    folders, 
    currentFolder, 
    isLoading: foldersLoading, 
    refreshFolders,
    getNotesInFolder,
    navigateToFolder,
    setCurrentFolder,
    createFolder
  } = useFolders();

  // Enhanced state management
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTone, setSelectedTone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'tone'>('date');
  const [contentType, setContentType] = useState<'folders' | 'notes'>('folders');
  
  // Advanced UI state
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [fabVisible, setFabVisible] = useState(true);
  
  // Actions modal state
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [fabOpen, setFabOpen] = useState(false);

  // Animation values for premium UX
  const scrollY = useSharedValue(0);
  const transitionProgress = useSharedValue(0);
  const searchProgress = useSharedValue(0);
  const refreshProgress = useSharedValue(0);

  // Performance caching with intelligent invalidation
  const [notesCache, setNotesCache] = useState<Record<string, Note[]>>({});
  const [lastRefresh, setLastRefresh] = useState<Record<string, number>>({});
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 });
  
  // Auto-refresh timer
  const autoRefreshTimer = useRef<NodeJS.Timeout | null>(null);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Enhanced scroll handler with performance optimizations
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      
      // Intelligent header collapsing
      const shouldCollapse = event.contentOffset.y > SCROLL_THRESHOLD;
      if (shouldCollapse !== headerCollapsed) {
        runOnJS(setHeaderCollapsed)(shouldCollapse);
      }
      
      // FAB visibility based on scroll direction
      if (event.contentOffset.y > 50) {
        if (fabVisible) runOnJS(setFabVisible)(false);
      } else {
        if (!fabVisible) runOnJS(setFabVisible)(true);
      }
    },
  });

  // Intelligent data loading with advanced caching
  const loadNotesWithCache = useCallback(async (forceRefresh: boolean = false) => {
    const user = auth().currentUser;
    if (!user) {
      console.error('LibraryScreen: No authenticated user found');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const cacheKey = currentFolder?.id || 'all_notes';
      const now = Date.now();
      
      // Smart cache strategy
      const cacheEntry = notesCache[cacheKey];
      const lastRefreshTime = lastRefresh[cacheKey];
      const isCacheValid = cacheEntry && lastRefreshTime && (now - lastRefreshTime) < CACHE_TIMEOUT;
      
      if (!forceRefresh && isCacheValid) {
        console.log('📦 Cache hit for:', cacheKey);
        setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
        setNotes(cacheEntry);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      console.log('🔄 Cache miss, fetching fresh data for:', cacheKey);
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      setIsLoading(true);
      
      let userNotes: Note[];
      if (currentFolder) {
        // Load notes from folder using the service
        const folderNotes = await getNotesInFolder(currentFolder.id);
        // Convert folder notes to match Note interface with proper type casting
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
        const allNotes = await notesService.getUserNotes(user.uid);
        userNotes = allNotes.filter(note => !note.folderId || note.folderId === '');
      }
      
      console.log(`📝 Loaded ${userNotes.length} notes for ${currentFolder?.name || 'All Notes'}`);
      
      // Update cache with metadata
      setNotesCache(prev => ({
        ...prev,
        [cacheKey]: userNotes
      }));
      setLastRefresh(prev => ({
        ...prev,
        [cacheKey]: now
      }));
      
      setNotes(userNotes);
    } catch (error) {
      console.error('❌ Failed to load notes:', error);
      setNotes([]);
      Alert.alert('Error', 'Failed to load notes. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentFolder, notesCache, lastRefresh, getNotesInFolder]);

  // Auto-refresh setup for real-time updates
  useEffect(() => {
    if (autoRefreshTimer.current) {
      clearInterval(autoRefreshTimer.current);
    }
    
    autoRefreshTimer.current = setInterval(() => {
      if (!isLoading && !isRefreshing) {
        console.log('🔄 Auto-refreshing data...');
        if (contentType === 'folders') {
          refreshFolders();
        } else {
          loadNotesWithCache(true);
        }
      }
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (autoRefreshTimer.current) {
        clearInterval(autoRefreshTimer.current);
      }
    };
  }, [contentType, isLoading, isRefreshing, refreshFolders, loadNotesWithCache]);

  useFocusEffect(
    useCallback(() => {
      if (contentType === 'folders') {
        refreshFolders();
      } else {
        loadNotesWithCache();
      }
    }, [contentType, refreshFolders, loadNotesWithCache])
  );

  // Enhanced filtering and sorting with search optimization
  const processedData = useMemo(() => {
    let data: (Note | Folder)[] = [];
    
    if (contentType === 'folders') {
      data = folders.filter(folder => {
        if (searchQuery && searchQuery.trim().length > 0) {
          const queryLower = searchQuery.toLowerCase().trim();
          return folder.name.toLowerCase().includes(queryLower) ||
                 (folder.description && folder.description.toLowerCase().includes(queryLower));
        }
        return true;
      });
    } else {
      let filtered = [...notes];

      // Advanced search across multiple fields
      if (searchQuery && searchQuery.trim().length > 0) {
        const queryLower = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(note => 
          (note.title && note.title.toLowerCase().includes(queryLower)) ||
          (note.plainText && note.plainText.toLowerCase().includes(queryLower)) ||
          (note.tags && note.tags.some(tag => tag.toLowerCase().includes(queryLower))) ||
          (note.content && note.content.toLowerCase().includes(queryLower))
        );
      }

      // Tone filtering
      if (selectedTone) {
        filtered = filtered.filter(note => note.tone === selectedTone);
      }

      // Enhanced sorting with multiple criteria
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'title':
            const titleComparison = (a.title || '').localeCompare(b.title || '');
            return titleComparison !== 0 ? titleComparison : 
                   new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          case 'tone':
            const toneComparison = (a.tone || '').localeCompare(b.tone || '');
            return toneComparison !== 0 ? toneComparison : 
                   new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          case 'date':
          default:
            const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bDate - aDate;
        }
      });

      data = filtered;
    }

    return data;
  }, [contentType, folders, notes, searchQuery, selectedTone, sortBy]);

  // Smooth view mode transitions
  const handleViewModeChange = useCallback(() => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid';
    
    // Animate transition
    transitionProgress.value = withSpring(newMode === 'grid' ? 1 : 0, {
      damping: 20,
      stiffness: 300,
    });
    
    setViewMode(newMode);
    hapticService.light();
  }, [viewMode, transitionProgress]);

  // Enhanced refresh with visual feedback
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refreshProgress.value = withTiming(1, { duration: 300 });
    
    if (contentType === 'folders') {
      refreshFolders().finally(() => {
        refreshProgress.value = withTiming(0, { duration: 300 });
      });
    } else {
      loadNotesWithCache(true);
    }
    
    hapticService.medium();
  }, [contentType, refreshFolders, loadNotesWithCache, refreshProgress]);

  // Folder navigation with breadcrumbs
  const handleFolderPress = useCallback(async (folder: Folder) => {
    hapticService.light();
    await navigateToFolder(folder.id);
    setContentType('notes');
    
    // Animate content type change
    transitionProgress.value = withSpring(0, {
      damping: 15,
      stiffness: 200,
    });
  }, [navigateToFolder, transitionProgress]);

  const handleBackToFolders = useCallback(() => {
    hapticService.light();
    setCurrentFolder(null);
    setContentType('folders');
    
    // Reset search when switching content types
    setSearchQuery('');
    setSelectedTone(null);
  }, [setCurrentFolder]);

  // Search functionality with animations
  const toggleSearch = useCallback(() => {
    const newShowSearch = !showSearchBar;
    setShowSearchBar(newShowSearch);
    
    searchProgress.value = withSpring(newShowSearch ? 1 : 0, {
      damping: 20,
      stiffness: 300,
    });
    
    if (!newShowSearch) {
      setSearchQuery('');
    }
    
    hapticService.light();
  }, [showSearchBar, searchProgress]);

  // Note actions
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

  const handleShowActions = useCallback((note: Note) => {
    setSelectedNote(note);
    setShowActionsModal(true);
    hapticService.medium();
  }, []);

  const handleNoteDeleted = useCallback((noteId: string) => {
    hapticService.light();
    setNotes(prev => prev.filter(note => note.id !== noteId));
    
    // Clear cache for affected folders
    setNotesCache({});
    setLastRefresh({});
    
    setShowActionsModal(false);
    setSelectedNote(null);
  }, []);

  const handleEditNote = useCallback((note: Note) => {
    setShowActionsModal(false);
    setSelectedNote(null);
    handleNotePress(note);
  }, [handleNotePress]);

  // FAB actions
  const handleScanNew = useCallback(() => {
    hapticService.medium();
    navigation.navigate('Scanner');
  }, [navigation]);

  const handleDocumentUpload = useCallback(() => {
    hapticService.medium();
    navigation.navigate('DocumentUploadScreen');
  }, [navigation]);

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
                  color: '#2196F3' 
                });
                hapticService.success();
              } catch (error) {
                Alert.alert('Error', 'Failed to create folder. Please try again.');
              }
            }
          },
        },
      ],
      'plain-text'
    );
  }, [createFolder]);

  // Add missing folder actions handler
  const handleShowFolderActions = useCallback((folder: Folder) => {
    hapticService.medium();
    Alert.alert(
      folder.name,
      'Folder actions',
      [
        { text: 'Rename', onPress: () => console.log('Rename folder:', folder.name) },
        { text: 'Delete', style: 'destructive', onPress: () => console.log('Delete folder:', folder.name) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  // Animated styles for smooth transitions
  const animatedContainerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      transitionProgress.value,
      [0, 0.5, 1],
      [1, 0.95, 1]
    );
    
    const scale = interpolate(
      transitionProgress.value,
      [0, 0.5, 1],
      [1, 0.98, 1]
    );
    
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // Header animated style
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [0, -SCROLL_THRESHOLD / 2]
    );
    
    const opacity = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [1, 0.8]
    );
    
    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  // FAB animated style
  const fabAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withSpring(fabVisible ? 0 : 100, {
            damping: 20,
            stiffness: 300,
          }),
        },
      ],
    };
  });

  // Render functions
  const renderNoteCard = useCallback(({ item }: { item: Note }) => (
    <NoteCard 
      note={item} 
      onPress={() => handleNotePress(item)} 
      onShowActions={() => handleShowActions(item)}
      viewMode={viewMode}
    />
  ), [viewMode, handleNotePress, handleShowActions]);

  const renderFolderCard = useCallback(({ item }: { item: Folder }) => (
    <FolderCard 
      folder={item} 
      onPress={() => handleFolderPress(item)} 
      onShowActions={() => handleShowFolderActions(item)}
      viewMode={viewMode}
    />
  ), [viewMode, handleFolderPress, handleShowFolderActions]);

  // Get current data based on content type
  const getCurrentData = () => {
    return processedData;
  };

  const currentData = getCurrentData();

  const renderContent = () => {
    if (isLoading || foldersLoading) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading {contentType === 'folders' ? 'folders' : 'notes'}...
          </Text>
        </View>
      );
    }

    if (currentData.length === 0) {
      return (
        <LibraryEmptyState
          isSearching={searchQuery.trim().length > 0 || selectedTone !== null}
          onClearFilters={() => {
            setSearchQuery('');
            setSelectedTone(null);
          }}
          onScanNew={handleScanNew}
          onNewNote={() => {
            const parentNavigation = navigation.getParent();
            if (parentNavigation) {
              parentNavigation.navigate('Editor', { noteText: '', tone: 'professional' });
            }
          }}
        />
      );
    }

    return (
      <Animated.View style={[{ flex: 1 }, animatedContainerStyle]}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          <FlashList
            data={currentData as any[]}
            renderItem={contentType === 'folders' ? renderFolderCard as any : renderNoteCard as any}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={{
              ...styles.notesList,
              ...(viewMode === 'grid' && { paddingHorizontal: 8 })
            }}
            estimatedItemSize={viewMode === 'grid' ? 160 : 140}
            numColumns={viewMode === 'grid' ? 2 : 1}
            key={`${viewMode}-${contentType}`}
            ItemSeparatorComponent={() => <View style={{ height: viewMode === 'list' ? 12 : 8 }} />}
            scrollEnabled={false} // Disable inner scroll since we have outer scroll
          />
        </Animated.ScrollView>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface }]} edges={['top']}>
      <StatusBar 
        barStyle={theme.dark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.surface} 
      />
      
      <View style={[styles.content, { backgroundColor: theme.colors.background }]}>
        {/* Enhanced Header */}
        <Animated.View style={[styles.header, headerAnimatedStyle]}>
          <LibraryHeader
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            selectedTone={selectedTone}
            onToneFilter={setSelectedTone}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onRefresh={handleRefresh}
          />
          
          {/* Content Type Selector with enhanced styling */}
          <Surface style={[styles.contentTypeSelector, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <SegmentedButtons
              value={contentType}
              onValueChange={(value) => setContentType(value as 'notes' | 'folders')}
              buttons={[
                {
                  value: 'folders',
                  label: 'Folders',
                  icon: 'folder',
                  showSelectedCheck: true,
                },
                {
                  value: 'notes',
                  label: currentFolder ? currentFolder.name : 'All Notes',
                  icon: 'note-text',
                  showSelectedCheck: true,
                },
              ]}
              style={styles.segmentedButtons}
              density="small"
            />
            
            {/* Enhanced breadcrumb navigation */}
            {currentFolder && contentType === 'notes' && (
              <View style={styles.breadcrumb}>
                <Surface style={[styles.breadcrumbChip, { backgroundColor: theme.colors.primaryContainer }]} elevation={1}>
                  <Text 
                    variant="bodySmall" 
                    style={[styles.breadcrumbText, { color: theme.colors.onPrimaryContainer }]}
                    onPress={handleBackToFolders}
                  >
                    ← Back to Folders
                  </Text>
                </Surface>
              </View>
            )}
            
            {/* Stats display */}
            <View style={styles.statsContainer}>
              <Chip 
                icon="folder" 
                mode="outlined" 
                compact
                style={styles.statChip}
              >
                {folders.length} folders
              </Chip>
              <Chip 
                icon="note-text" 
                mode="outlined" 
                compact
                style={styles.statChip}
              >
                {notes.length} notes
              </Chip>
              {cacheStats.hits > 0 && (
                <Chip 
                  icon="flash" 
                  mode="outlined" 
                  compact
                  style={styles.statChip}
                >
                  {Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)}% cached
                </Chip>
              )}
            </View>
          </Surface>
        </Animated.View>
        
        {renderContent()}
        
        {/* Enhanced FAB with intelligent positioning */}
        <Animated.View 
          style={[
            styles.fabContainer,
            fabAnimatedStyle,
          ]}
        >
          <FAB.Group
            open={fabOpen}
            visible={fabVisible}
            icon={fabOpen ? 'close' : 'plus'}
            actions={[
              ...(contentType === 'folders' ? [{
                icon: 'folder-plus',
                label: 'New Folder',
                onPress: handleNewFolder,
                style: { backgroundColor: theme.colors.tertiary },
              }] : []),
              {
                icon: 'camera-plus',
                label: 'Scan Document',
                onPress: handleScanNew,
                style: { backgroundColor: theme.colors.primary },
              },
              {
                icon: 'file-upload',
                label: 'Upload Document',
                onPress: handleDocumentUpload,
                style: { backgroundColor: theme.colors.secondary },
              },
            ]}
            onStateChange={({ open }) => setFabOpen(open)}
            style={styles.fab}
            fabStyle={{ 
              backgroundColor: theme.colors.primary,
              borderRadius: 16,
            }}
            color={theme.colors.onPrimary}
          />
        </Animated.View>

        {/* Enhanced Note Actions Modal */}
        <NoteActionsModal
          visible={showActionsModal}
          note={selectedNote}
          onDismiss={() => setShowActionsModal(false)}
          onEditNote={handleEditNote}
          onNoteDeleted={handleNoteDeleted}
        />
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
  },
  header: {
    zIndex: 1000,
  },
  contentTypeSelector: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  segmentedButtons: {
    marginBottom: 12,
  },
  breadcrumb: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  breadcrumbChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statChip: {
    height: 28,
  },
  notesList: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 120, // Extra space for FAB
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  fab: {
    borderRadius: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default EnhancedLibraryScreen;
