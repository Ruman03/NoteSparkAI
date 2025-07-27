import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  Animated,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { 
  Surface, 
  Text, 
  useTheme, 
  Card, 
  Chip,
  FAB,
  Searchbar,
  Button,
  Avatar,
  Menu,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LibraryScreenNavigationProp } from '../types/navigation';
import { NotesService } from '../services/NotesService';
import type { Note } from '../types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

export default function LibraryScreen() {
  const navigation = useNavigation<LibraryScreenNavigationProp>();
  const theme = useTheme();
  const notesService = NotesService.getInstance();

  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTone, setSelectedTone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'tone'>('date');
  const [menuVisible, setMenuVisible] = useState(false);

  const fadeAnim = new Animated.Value(0);

  const loadNotes = async () => {
    try {
      console.log('LibraryScreen: Starting to load notes');
      const userNotes = await notesService.getUserNotes();
      console.log('LibraryScreen: Loaded notes:', userNotes.length, 'notes found');
      setNotes(userNotes);
      setFilteredNotes(userNotes);
      
      // Animate notes appearance
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('LibraryScreen: Failed to load notes:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadNotes();
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    filterNotes(query, selectedTone);
  };

  const handleToneFilter = (tone: string | null) => {
    setSelectedTone(tone);
    filterNotes(searchQuery, tone);
  };

  const filterNotes = (query: string, toneFilter: string | null) => {
    console.log('LibraryScreen: filterNotes called with query:', query, 'toneFilter:', toneFilter);
    console.log('LibraryScreen: Starting with notes.length:', notes.length);
    let filtered = notes;

    if (query) {
      filtered = filtered.filter(note => 
        note.title.toLowerCase().includes(query.toLowerCase()) ||
        note.plainText.toLowerCase().includes(query.toLowerCase()) ||
        note.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      console.log('LibraryScreen: After query filter, filtered.length:', filtered.length);
    }

    if (toneFilter) {
      filtered = filtered.filter(note => note.tone === toneFilter);
      console.log('LibraryScreen: After tone filter, filtered.length:', filtered.length);
    }

    // Sort notes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'tone':
          return a.tone.localeCompare(b.tone);
        case 'date':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    console.log('LibraryScreen: Final filtered.length before setFilteredNotes:', filtered.length);
    setFilteredNotes(filtered);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getToneColor = (tone: string) => {
    const toneColors: { [key: string]: string } = {
      'professional': theme.colors.primary,
      'casual': theme.colors.secondary,
      'academic': theme.colors.tertiary,
      'creative': '#E91E63', // Pink
      'technical': '#FF9800', // Orange
      'simplified': '#9C27B0', // Purple
    };
    return toneColors[tone] || theme.colors.onSurfaceVariant;
  };

  const getToneIcon = (tone: string) => {
    const toneIcons: { [key: string]: string } = {
      'professional': 'briefcase',
      'casual': 'chat',
      'academic': 'school',
      'creative': 'palette',
      'technical': 'code-tags',
      'simplified': 'lightbulb',
    };
    return toneIcons[tone] || 'note-text';
  };

  const handleNotePress = (note: Note) => {
    navigation.navigate('Editor', {
      noteText: note.content,
      tone: note.tone,
      originalText: note.originalText || ''
    });
  };

  const handleScanNew = () => {
    navigation.navigate('Scanner');
  };

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [])
  );

  const renderNoteCard = ({ item: note, index }: { item: Note, index: number }) => (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0],
            }),
          }],
        }}
      >
        <TouchableOpacity
          onPress={() => handleNotePress(note)}
          activeOpacity={0.7}
        >
          <Card 
            style={[styles.noteCard, { backgroundColor: theme.colors.surface }]} 
            elevation={3}
          >
            <Card.Content style={styles.noteContent}>
              <View style={styles.noteHeader}>
                <View style={styles.noteHeaderLeft}>
                  <Avatar.Icon
                    size={48}
                    icon={getToneIcon(note.tone)}
                    style={{ backgroundColor: getToneColor(note.tone) + '20' }}
                  color={getToneColor(note.tone)}
                />
                <View style={styles.noteTitleContainer}>
                  <Text 
                    variant="titleMedium" 
                    style={[styles.noteTitle, { color: theme.colors.onSurface }]} 
                    numberOfLines={2}
                  >
                    {note.title}
                  </Text>
                  <Text 
                    variant="bodySmall" 
                    style={[styles.noteDate, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {formatDate(new Date(note.updatedAt))} • {note.plainText.split(' ').length} words
                  </Text>
                </View>
              </View>
              <IconButton
                icon="dots-vertical"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={() => {}}
                style={styles.menuButton}
              />
            </View>

            <Text 
              variant="bodyMedium" 
              style={[styles.notePreview, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={3}
            >
              {note.plainText}
            </Text>

            <View style={styles.noteFooter}>
              <Chip
                icon={getToneIcon(note.tone)}
                style={[styles.toneChip, { backgroundColor: getToneColor(note.tone) + '15' }]}
                textStyle={{ color: getToneColor(note.tone), fontSize: 12, fontWeight: '600' }}
                compact
              >
                {note.tone}
              </Chip>
              
              {note.tags && note.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {note.tags.slice(0, 2).map((tag, tagIndex) => (
                    <Chip
                      key={tagIndex}
                      style={[styles.tagChip, { backgroundColor: theme.colors.primaryContainer }]}
                      textStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 10 }}
                      compact
                    >
                      #{tag}
                    </Chip>
                  ))}
                  {note.tags.length > 2 && (
                    <Text style={[styles.moreTagsText, { color: theme.colors.onSurfaceVariant }]}>
                      +{note.tags.length - 2} more
                    </Text>
                  )}
                </View>
              )}
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Surface style={[styles.emptyIconContainer, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
        <Icon name="library-outline" size={64} color={theme.colors.primary} />
      </Surface>
      <Text variant="headlineMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
        No Notes Yet
      </Text>
      <Text variant="bodyLarge" style={[styles.emptyDescription, { color: theme.colors.onSurfaceVariant }]}>
        Start your AI-powered note-taking journey by scanning your first document
      </Text>
      <Button
        mode="contained"
        icon="camera-plus"
        onPress={handleScanNew}
        style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
        contentStyle={styles.emptyButtonContent}
        labelStyle={styles.emptyButtonLabel}
      >
        Scan First Document
      </Button>
    </View>
  );

  const toneFilters = [
    { label: 'All', value: null, icon: 'filter-variant' },
    { label: 'Professional', value: 'professional', icon: 'briefcase' },
    { label: 'Casual', value: 'casual', icon: 'chat' },
    { label: 'Academic', value: 'academic', icon: 'school' },
    { label: 'Creative', value: 'creative', icon: 'palette' },
    { label: 'Technical', value: 'technical', icon: 'code-tags' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with Search and Filters */}
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Text variant="headlineSmall" style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
              My Library
            </Text>
            <View style={styles.headerActions}>
              <IconButton
                icon="refresh"
                size={24}
                iconColor={theme.colors.primary}
                onPress={() => {
                  console.log('LibraryScreen: Manual refresh triggered');
                  setIsRefreshing(true);
                  loadNotes();
                }}
              />
              <IconButton
                icon={viewMode === 'grid' ? 'view-list' : 'view-grid'}
                size={24}
                iconColor={theme.colors.onSurface}
                onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              />
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <IconButton
                    icon="sort"
                    size={24}
                    iconColor={theme.colors.onSurface}
                    onPress={() => setMenuVisible(true)}
                  />
                }
              >
                <Menu.Item onPress={() => setSortBy('date')} title="Sort by Date" />
                <Menu.Item onPress={() => setSortBy('title')} title="Sort by Title" />
                <Menu.Item onPress={() => setSortBy('tone')} title="Sort by Tone" />
              </Menu>
            </View>
          </View>
          
          <Searchbar
            placeholder="Search notes, content, tags..."
            onChangeText={handleSearch}
            value={searchQuery}
            style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
            inputStyle={{ fontSize: 14 }}
            iconColor={theme.colors.onSurfaceVariant}
          />
          
          <View style={styles.filters}>
            {toneFilters.slice(0, 4).map(filter => (
              <Chip
                key={filter.label}
                selected={selectedTone === filter.value}
                onPress={() => handleToneFilter(filter.value)}
                style={[
                  styles.filterChip,
                  selectedTone === filter.value && { backgroundColor: theme.colors.primaryContainer }
                ]}
                textStyle={{ 
                  fontSize: 12, 
                  color: selectedTone === filter.value ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant 
                }}
                icon={filter.icon}
                compact
              >
                {filter.label}
              </Chip>
            ))}
          </View>
        </View>
      </Surface>

      {/* Notes List */}
      {isLoading ? (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading your notes...
          </Text>
        </View>
      ) : (() => {
        console.log('LibraryScreen: Rendering decision - filteredNotes.length:', filteredNotes.length);
        return filteredNotes.length === 0;
      })() ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredNotes}
          renderItem={renderNoteCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.notesList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}      {/* Floating Action Button */}
      <FAB
        icon="camera-plus"
        onPress={handleScanNew}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
  },
  searchbar: {
    elevation: 0,
    marginBottom: 16,
    borderRadius: 12,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    height: 36,
    borderRadius: 18,
  },
  notesList: {
    padding: 16,
    paddingTop: 8,
  },
  noteCard: {
    borderRadius: 16,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  noteContent: {
    padding: 16,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  noteHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  noteTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  noteTitle: {
    fontWeight: 'bold',
    lineHeight: 24,
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  menuButton: {
    margin: 0,
  },
  notePreview: {
    lineHeight: 20,
    marginBottom: 16,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toneChip: {
    height: 28,
    borderRadius: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagChip: {
    height: 24,
    borderRadius: 12,
  },
  moreTagsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    opacity: 0.8,
  },
  emptyButton: {
    borderRadius: 24,
    elevation: 4,
  },
  emptyButtonContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emptyButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
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
