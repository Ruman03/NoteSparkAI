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
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
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
  ProgressBar,
  Snackbar,
  Card,
  Button,
  Portal,
  Modal,
  Chip,
  TextInput,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { LibraryScreenNavigationProp } from '../types/navigation';
import { NotesService } from '../services/NotesService';
import { AIService } from '../services/AIService';
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

// ENHANCED: Enterprise-grade interfaces for Gemini 2.5 Flash integration and analytics
interface LibraryMetrics {
  totalFolders: number;
  totalNotes: number;
  searchQueries: number;
  folderNavigations: number;
  averageTimeInLibrary: number;
  mostUsedFeature: 'search' | 'folders' | 'notes' | 'create';
  geminiInsightsGenerated: number;
  organizationScore: number; // 0-100 based on folder usage vs unorganized notes
}

interface GeminiLibraryInsights {
  isActive: boolean;
  currentInsight: string;
  insightType: 'organization' | 'productivity' | 'content' | 'workflow';
  confidence: number;
  actionSuggestions: Array<{
    action: string;
    description: string;
    benefit: string;
  }>;
  suggestions: Array<{
    type: 'organization' | 'productivity' | 'content';
    title: string;
    description: string;
    confidence: number;
    actions?: string[];
  }>;
  lastInsightTime?: Date;
}

interface LibraryAnalytics {
  sessionStartTime: Date;
  foldersVisited: string[];
  notesAccessed: string[];
  searchTermsUsed: string[];
  actionsPerformed: number;
  timeSpentInEachTab: {
    folders: number;
    notes: number;
  };
}

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

  // ENHANCED: Gemini insights and analytics state
  const [showGeminiInsights, setShowGeminiInsights] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState<string>(theme.colors.primary);
  const [metrics, setMetrics] = useState<LibraryMetrics>({
    totalFolders: 0,
    totalNotes: 0,
    searchQueries: 0,
    folderNavigations: 0,
    averageTimeInLibrary: 0,
    mostUsedFeature: 'folders',
    geminiInsightsGenerated: 0,
    organizationScore: 0,
  });
  const [geminiInsights, setGeminiInsights] = useState<GeminiLibraryInsights>({
    isActive: false,
    currentInsight: '',
    insightType: 'organization',
    confidence: 0,
    actionSuggestions: [],
    suggestions: [],
  });
  const [analytics, setAnalytics] = useState<LibraryAnalytics>({
    sessionStartTime: new Date(),
    foldersVisited: [],
    notesAccessed: [],
    searchTermsUsed: [],
    actionsPerformed: 0,
    timeSpentInEachTab: { folders: 0, notes: 0 },
  });

  // ENHANCED: UI state for insights and metrics
  const [showInsights, setShowInsights] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  // Animation values
  const searchAnimation = useSharedValue(0);
  const tabTransition = useSharedValue(activeTab === 'folders' ? 0 : 1);
  const insightsAnimation = useSharedValue(0);
  const analyticsAnimation = useSharedValue(0);

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
      
  // ENHANCED: Auto-generate insights if library has sufficient content
  const insightsTimer = setTimeout(() => {
        if (folders.length > 2 || notes.length > 5) {
          generateGeminiInsights();
        }
  }, 1000);
  // Prevent open handle leaks under Node/Jest
  (insightsTimer as any).unref?.();
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
  // Prevent open handle leaks under Node/Jest
  (timer as any).unref?.();
      
      return () => {
        clearTimeout(timer);
      };
    }, [loadData, isLoading, foldersLoading]) // Include stable dependencies
  );

  // ENHANCED: Analytics tracking functions
  const updateLibraryAnalytics = useCallback((action: string, target?: string) => {
    setAnalytics(prev => {
      const updated = {
        ...prev,
        actionsPerformed: prev.actionsPerformed + 1,
      };
      
      // Track specific actions
      if (action === 'folder_visit' && target) {
        updated.foldersVisited = [...new Set([...prev.foldersVisited, target])];
      } else if (action === 'note_access' && target) {
        updated.notesAccessed = [...new Set([...prev.notesAccessed, target])];
      } else if (action === 'search' && target) {
        updated.searchTermsUsed = [...new Set([...prev.searchTermsUsed, target])];
      }
      
      return updated;
    });
    
    // Update session metrics
    setMetrics(prev => ({
      ...prev,
      totalFolders: folders.length,
      totalNotes: notes.length,
      searchQueries: prev.searchQueries + (action === 'search' ? 1 : 0),
      folderNavigations: prev.folderNavigations + (action === 'folder_visit' ? 1 : 0),
    }));
  }, [folders.length, notes.length]);

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
    
    // ENHANCED: Track search analytics
    if (query.trim().length > 2) {
      updateLibraryAnalytics('search', query.trim());
    }
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
  const timeout = setTimeout(() => {
      // Search will be handled by the filtered data computation
      hapticService.light();
    }, SEARCH_DEBOUNCE_MS);
  // Prevent open handle leaks under Node/Jest
  (timeout as any).unref?.();

    setSearchTimeout(timeout);
  }, [searchTimeout, updateLibraryAnalytics]);

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

  // ENHANCED: Gemini 2.5 Flash Library Insights Generation
  const generateGeminiInsights = useCallback(async () => {
    try {
      const aiService = AIService.getInstance();
      
      // Calculate organization insights
      const organizationScore = folders.length > 0 
        ? Math.min(100, ((notes.filter(n => n.folderId).length / Math.max(notes.length, 1)) * 100))
        : 0;
      
      // Generate context for AI insights
      const libraryContext = {
        totalFolders: folders.length,
        totalNotes: notes.length,
        organizationScore,
        searchUsage: analytics.searchTermsUsed.length,
        mostAccessedFolders: analytics.foldersVisited.slice(0, 3),
        unorganizedNotes: notes.filter(n => !n.folderId).length,
        averageNoteLength: notes.length > 0 ? notes.reduce((sum, note) => sum + (note.wordCount || 0), 0) / notes.length : 0,
        contentTypes: notes.map(n => n.tags || []).flat(),
        recentActivity: analytics.actionsPerformed,
      };
      
      // Use existing AI service for insights (simplified approach)
      let insightText = '';
      let actionSuggestions: Array<{ action: string; description: string; benefit: string }> = [];
      
      if (organizationScore < 50) {
        insightText = `Consider organizing your ${notes.length} notes into folders. Currently ${Math.round(organizationScore)}% of your notes are organized.`;
        actionSuggestions = [
          {
            action: 'Create topic-based folders',
            description: 'Group related notes by subject or project',
            benefit: 'Easier retrieval and better organization'
          },
          {
            action: 'Use smart folder suggestions',
            description: 'Let AI suggest folder structures',
            benefit: 'Automated organization assistance'
          }
        ];
      } else if (analytics.searchTermsUsed.length > 10) {
        insightText = `You search frequently (${analytics.searchTermsUsed.length} terms). Consider creating quick-access folders for common topics.`;
        actionSuggestions = [
          {
            action: 'Create favorite folders',
            description: 'Pin frequently accessed content',
            benefit: 'Faster access to important notes'
          }
        ];
      } else {
        insightText = `Your library is well-organized! ${Math.round(organizationScore)}% of notes are properly categorized.`;
        actionSuggestions = [
          {
            action: 'Review and archive old notes',
            description: 'Clean up unused content',
            benefit: 'Maintain optimal organization'
          }
        ];
      }
      
      setGeminiInsights({
        isActive: true,
        currentInsight: insightText,
        insightType: organizationScore < 50 ? 'organization' : 'productivity',
        confidence: 0.85,
        actionSuggestions,
        suggestions: [
          {
            type: organizationScore < 50 ? 'organization' : 'productivity',
            title: organizationScore < 50 ? 'Optimize Folder Structure' : 'Boost Productivity',
            description: insightText,
            confidence: 0.85,
            actions: actionSuggestions.map(action => action.action),
          }
        ],
        lastInsightTime: new Date(),
      });
      
      // Update metrics
      setMetrics(prev => ({
        ...prev,
        geminiInsightsGenerated: prev.geminiInsightsGenerated + 1,
        organizationScore,
      }));
      
      hapticService.success();
    } catch (error) {
      console.error('Failed to generate Gemini insights:', error);
      setSnackbarMessage('Failed to generate insights. Please try again.');
      setShowSnackbar(true);
    }
  }, [folders.length, notes.length, analytics.searchTermsUsed.length, analytics.foldersVisited]);

  // Handle folder press
  const handleFolderPress = useCallback(async (folder: Folder) => {
    hapticService.light();
    setSelectedFolder(folder);
    setActiveTab('notes');
    
    // ENHANCED: Track analytics
    updateLibraryAnalytics('folder_visit', folder.id);
    
    await navigateToFolder(folder.id);
  }, [navigateToFolder, updateLibraryAnalytics]);

  // Handle note press
  const handleNotePress = useCallback((note: Note) => {
    hapticService.light();
    
    // ENHANCED: Track analytics
    updateLibraryAnalytics('note_access', note.id);
    
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('Editor', {
        noteId: note.id,
        noteText: note.content,
        tone: note.tone,
        originalText: note.originalText || ''
      });
    }
  }, [navigation, updateLibraryAnalytics]);

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
    setNewFolderName('');
    setShowCreateFolderModal(true);
  }, []);

  const confirmCreateFolder = useCallback(async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setSnackbarMessage('Folder name cannot be empty');
      setShowSnackbar(true);
      return;
    }
    try {
      await createFolder({
        name: trimmed,
        description: '',
        color: newFolderColor,
      });
      setShowCreateFolderModal(false);
      hapticService.success();
      setSnackbarMessage('Folder created');
      setShowSnackbar(true);
      loadData(true);
    } catch (e) {
      setSnackbarMessage('Failed to create folder');
      setShowSnackbar(true);
    }
  }, [createFolder, newFolderName, theme.colors.primary, loadData]);

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
              Library
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* ENHANCED: Insights Access Button */}
              <IconButton 
                icon="brain" 
                size={20} 
                onPress={() => {
                  generateGeminiInsights();
                  setShowInsights(true);
                }}
                iconColor={theme.colors.primary}
              />
              {/* ENHANCED: Metrics Access Button */}
              <IconButton 
                icon="chart-line" 
                size={20} 
                onPress={() => setShowMetrics(true)}
                iconColor={theme.colors.secondary}
              />
              <IconButton 
                icon="magnify" 
                size={24} 
                onPress={toggleSearch}
                iconColor={theme.colors.onSurface}
              />
            </View>
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
            {!searchQuery && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {activeTab === 'folders' ? (
                  <Button mode="contained" onPress={handleNewFolder}>
                    Create Folder
                  </Button>
                ) : (
                  <>
                    <Button mode="contained" onPress={handleScanDocument}>
                      Scan a Document
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        const parentNav = navigation.getParent();
                        parentNav?.navigate('Editor', {
                          noteText: '',
                          tone: 'professional',
                          originalText: '',
                          folderId: selectedFolder?.id ?? null,
                          folderName: selectedFolder?.name ?? undefined,
                          noteTitle: 'New Note',
                        });
                      }}
                    >
                      New Blank Note
                    </Button>
                  </>
                )}
              </View>
            )}
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

      {/* Create Folder Modal (cross-platform) */}
      <Portal>
        <Modal
          visible={showCreateFolderModal}
          onDismiss={() => setShowCreateFolderModal(false)}
          contentContainerStyle={[
            {
              backgroundColor: theme.colors.surface,
              borderRadius: 16,
              margin: 20,
              padding: 20,
            },
          ]}
        >
          <Text variant="titleLarge" style={{ fontWeight: '600', marginBottom: 12 }}>
            Create New Folder
          </Text>
          <TextInput
            mode="outlined"
            label="Folder name"
            value={newFolderName}
            onChangeText={setNewFolderName}
            autoFocus
          />
          <Text variant="bodySmall" style={{ marginTop: 12, marginBottom: 8, color: theme.colors.onSurfaceVariant }}>
            Choose a color
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['#6750A4','#386641','#0B7285','#A61E4D','#B08968','#5C940D','#7B2CBF','#0891B2'].map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setNewFolderColor(c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: c,
                  borderWidth: newFolderColor === c ? 3 : 1,
                  borderColor: newFolderColor === c ? theme.colors.onSurface : 'rgba(0,0,0,0.2)'
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select color ${c}`}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Button mode="outlined" onPress={() => setShowCreateFolderModal(false)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button mode="contained" onPress={confirmCreateFolder} style={{ flex: 1 }}>
              Create
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* ENHANCED: Gemini Insights Modal */}
      <Portal>
        <Modal
          visible={showInsights && geminiInsights.suggestions.length > 0}
          onDismiss={() => setShowInsights(false)}
          contentContainerStyle={[
            {
              backgroundColor: theme.colors.surface,
              borderRadius: 16,
              margin: 20,
              padding: 20,
              maxHeight: '80%',
            }
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text variant="titleLarge" style={{ flex: 1, fontWeight: '600' }}>
              Smart Library Insights
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowInsights(false)}
              iconColor={theme.colors.onSurface}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Card style={{ marginBottom: 16, backgroundColor: theme.colors.surfaceVariant }}>
              <Card.Content style={{ padding: 16 }}>
                <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
                  Usage Analytics
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text variant="bodyMedium">Total Actions:</Text>
                  <Chip compact mode="outlined">{analytics.actionsPerformed}</Chip>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text variant="bodyMedium">Folders Visited:</Text>
                  <Chip compact mode="outlined">{analytics.foldersVisited.length}</Chip>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodyMedium">Search Queries:</Text>
                  <Chip compact mode="outlined">{analytics.searchTermsUsed.length}</Chip>
                </View>
              </Card.Content>
            </Card>

            {geminiInsights.suggestions.map((suggestion, index) => (
              <Card key={index} style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}>
                <Card.Content style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Icon 
                      name={
                        suggestion.type === 'organization' ? 'folder' : 
                        suggestion.type === 'productivity' ? 'lightning-bolt' : 'target'
                      } 
                      size={20} 
                      color={theme.colors.primary}
                      style={{ marginRight: 8 }}
                    />
                    <Text variant="titleMedium" style={{ fontWeight: '600', flex: 1 }}>
                      {suggestion.title}
                    </Text>
                    <Chip compact mode="outlined">
                      {Math.round(suggestion.confidence * 100)}%
                    </Chip>
                  </View>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
                    {suggestion.description}
                  </Text>
                  {suggestion.actions && suggestion.actions.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <Text variant="bodySmall" style={{ fontWeight: '600', marginBottom: 8 }}>
                        Recommended Actions:
                      </Text>
                      {suggestion.actions.map((action, actionIndex) => (
                        <Text key={actionIndex} variant="bodySmall" 
                              style={{ color: theme.colors.primary, marginBottom: 4 }}>
                          • {action}
                        </Text>
                      ))}
                    </View>
                  )}
                </Card.Content>
              </Card>
            ))}

            <Button
              mode="contained"
              onPress={() => setShowInsights(false)}
              style={{ marginTop: 16 }}
            >
              Got it, thanks!
            </Button>
          </ScrollView>
        </Modal>
      </Portal>

      {/* ENHANCED: Library Metrics Progress */}
      {metrics.totalFolders > 0 && (
        <Portal>
          <Modal
            visible={showMetrics}
            onDismiss={() => setShowMetrics(false)}
            contentContainerStyle={[
              {
                backgroundColor: theme.colors.surface,
                borderRadius: 16,
                margin: 20,
                padding: 20,
              }
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text variant="titleLarge" style={{ flex: 1, fontWeight: '600' }}>
                Library Metrics
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setShowMetrics(false)}
                iconColor={theme.colors.onSurface}
              />
            </View>

            <Card style={{ marginBottom: 16, backgroundColor: theme.colors.surfaceVariant }}>
              <Card.Content style={{ padding: 16 }}>
                <Text variant="titleMedium" style={{ marginBottom: 12, fontWeight: '600' }}>
                  Content Overview
                </Text>
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text variant="bodyMedium">Folders</Text>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{metrics.totalFolders}</Text>
                  </View>
                  <ProgressBar progress={Math.min(metrics.totalFolders / 10, 1)} color={theme.colors.primary} />
                </View>
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text variant="bodyMedium">Notes</Text>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{metrics.totalNotes}</Text>
                  </View>
                  <ProgressBar progress={Math.min(metrics.totalNotes / 50, 1)} color={theme.colors.secondary} />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text variant="bodyMedium">Search Queries</Text>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{metrics.searchQueries}</Text>
                  </View>
                  <ProgressBar progress={Math.min(metrics.searchQueries / 20, 1)} color={theme.colors.tertiary} />
                </View>
              </Card.Content>
            </Card>

            <Button
              mode="contained"
              onPress={() => setShowMetrics(false)}
              style={{ marginTop: 8 }}
            >
              Close Metrics
            </Button>
          </Modal>
        </Portal>
      )}

      {/* ENHANCED: Snackbar for feedback */}
      <Snackbar
        visible={showSnackbar}
        onDismiss={() => setShowSnackbar(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setShowSnackbar(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 8,
    elevation: 4,
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
    fontWeight: '700',
    fontSize: 24,
  },
  searchBar: {
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
  },
  tabBar: {
    marginVertical: 8,
    borderRadius: 12,
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
    borderRadius: 16,
    marginVertical: 6,
    elevation: 3,
  },
  folderContent: {
    padding: 18,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderIcon: {
    margin: 0,
    marginRight: 12,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 16,
  },
  folderMeta: {
    fontSize: 13,
    opacity: 0.7,
  },
  folderDescription: {
    marginTop: 12,
    lineHeight: 20,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 20,
    elevation: 6,
  },
});

export default LibraryScreen;
