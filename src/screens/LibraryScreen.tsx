import React, { useState, useCallback, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  RefreshControl, 
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { 
  Text, 
  useTheme, 
  FAB,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LibraryScreenNavigationProp } from '../types/navigation';
import { NotesService } from '../services/NotesService';
import type { Note } from '../types';
import auth from '@react-native-firebase/auth';

import { hapticService } from '../services/HapticService';
import LibraryHeader from '../components/library/LibraryHeader';
import NoteCard from '../components/library/NoteCard';
import LibraryEmptyState from '../components/library/LibraryEmptyState';
import NoteActionsModal from '../components/library/NoteActionsModal';

const { width } = Dimensions.get('window');

export default function LibraryScreen() {
  const navigation = useNavigation<LibraryScreenNavigationProp>();
  const theme = useTheme();
  const notesService = NotesService.getInstance();

  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTone, setSelectedTone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'tone'>('date');
  
  // Actions modal state
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const loadNotes = useCallback(async () => {
    const user = auth().currentUser;
    if (!user) {
      console.error('LibraryScreen: No authenticated user found');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      console.log('LibraryScreen: Starting to load notes for user:', user.uid);
      setIsLoading(true);
      const userNotes = await notesService.getUserNotes(user.uid);
      console.log('LibraryScreen: Loaded notes:', userNotes.length, 'notes found');
      setNotes(userNotes);
    } catch (error) {
      console.error('LibraryScreen: Failed to load notes:', error);
      setNotes([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [notesService]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const filteredNotes = useMemo(() => {
    let filtered = [...notes];

    if (searchQuery && searchQuery.trim().length > 0) {
      const queryLower = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(note => 
        (note.title && note.title.toLowerCase().includes(queryLower)) ||
        (note.plainText && note.plainText.toLowerCase().includes(queryLower)) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(queryLower)))
      );
    }

    if (selectedTone) {
      filtered = filtered.filter(note => note.tone === selectedTone);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'tone':
          return (a.tone || '').localeCompare(b.tone || '');
        case 'date':
        default:
          const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bDate - aDate;
      }
    });

    return filtered;
  }, [notes, searchQuery, selectedTone, sortBy]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadNotes();
  }, [loadNotes]);

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

  const handleScanNew = useCallback(() => {
    hapticService.medium();
    // Navigate to Scanner tab
    navigation.navigate('Scanner');
  }, [navigation]);

  const handleShowActions = useCallback((note: Note) => {
    setSelectedNote(note);
    setShowActionsModal(true);
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

  const renderNoteCard = useCallback(({ item }: { item: Note }) => (
    <NoteCard 
      note={item} 
      onPress={() => handleNotePress(item)} 
      onShowActions={() => handleShowActions(item)}
      viewMode={viewMode}
    />
  ), [viewMode, handleNotePress, handleShowActions]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading your notes...
          </Text>
        </View>
      );
    }

    if (filteredNotes.length === 0) {
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
      <FlashList
        data={filteredNotes}
        renderItem={renderNoteCard}
        keyExtractor={(item: Note) => item.id}
        contentContainerStyle={styles.notesList}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={viewMode === 'grid' ? 180 : 150}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode} // Re-render on viewMode change
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: viewMode === 'list' ? 12 : 0 }} />}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface }]} edges={['top']}>
      <View style={[styles.content, { backgroundColor: theme.colors.background }]}>
        <LibraryHeader
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          selectedTone={selectedTone}
          onToneFilter={setSelectedTone}
          viewMode={viewMode}
          onViewModeChange={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onRefresh={handleRefresh}
        />
        
        {renderContent()}
        
        <FAB
          icon="camera-plus"
          onPress={handleScanNew}
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
        />

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
  notesList: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
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
  },
});
