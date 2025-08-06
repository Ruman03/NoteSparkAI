import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { Surface, Button, Text, useTheme, Card, IconButton, ProgressBar } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import type { HomeScreenNavigationProp } from '../types/navigation';
import type { Note } from '../types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { NotesService } from '../services/NotesService';
import { hapticService } from '../services/HapticService';
import auth from '@react-native-firebase/auth';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [stats, setStats] = useState({
    totalNotes: 0,
    totalWords: 0,
    notesToday: 0,
    streak: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const notesService = NotesService.getInstance();

  // Get time-based greeting with motivational message
  const getGreeting = () => {
    const hour = new Date().getHours();
    const firstName = user?.displayName || user?.email?.split('@')[0] || 'there';
    
    let timeGreeting = '';
    if (hour < 12) timeGreeting = `Good morning, ${firstName}!`;
    else if (hour < 17) timeGreeting = `Good afternoon, ${firstName}!`;
    else timeGreeting = `Good evening, ${firstName}!`;
    
    return timeGreeting;
  };

  const getMotivationalMessage = () => {
    const messages = [
      "Ready to capture your thoughts?",
      "What will you discover today?", 
      "Your ideas are waiting to be explored",
      "Time to turn thoughts into notes",
      "Ready to spark some creativity?"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  // Calculate comprehensive statistics
  const calculateStats = (notes: Note[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalWords = notes.reduce((sum, note) => {
      return sum + (note.plainText ? note.plainText.split(/\s+/).filter(word => word.length > 0).length : 0);
    }, 0);
    
    const notesToday = notes.filter(note => {
      if (!note.createdAt) return false;
      const noteDate = new Date(note.createdAt);
      if (isNaN(noteDate.getTime())) return false;
      noteDate.setHours(0, 0, 0, 0);
      return noteDate.getTime() === today.getTime();
    }).length;
    
    // Simple streak calculation (consecutive days with notes)
    let streak = 0;
    const sortedNotes = notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (sortedNotes.length > 0) {
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < 30; i++) { // Check last 30 days
        const hasNoteOnDay = sortedNotes.some(note => {
          const noteDate = new Date(note.createdAt);
          noteDate.setHours(0, 0, 0, 0);
          return noteDate.getTime() === currentDate.getTime();
        });
        
        if (hasNoteOnDay) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else if (i === 0) {
          // No notes today, check yesterday
          currentDate.setDate(currentDate.getDate() - 1);
          const hasNoteYesterday = sortedNotes.some(note => {
            const noteDate = new Date(note.createdAt);
            noteDate.setHours(0, 0, 0, 0);
            return noteDate.getTime() === currentDate.getTime();
          });
          if (hasNoteYesterday) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }
    
    return {
      totalNotes: notes.length,
      totalWords,
      notesToday,
      streak
    };
  };

  // Load user data
  const loadUserData = async () => {
    try {
      setIsLoading(true);
      
      const user = auth().currentUser;
      if (!user) {
        console.error('HomeScreen: No authenticated user found');
        return;
      }
      
      // Use Promise.all to load data concurrently and add a minimum loading time for smooth UX
      const [notes] = await Promise.all([
        notesService.getUserNotes(user.uid),
        new Promise(resolve => setTimeout(resolve, 800)) // Minimum 800ms for smooth loading experience
      ]);
      
      const calculatedStats = calculateStats(notes);
      setStats(calculatedStats);
      // Get 5 most recent notes
      setRecentNotes(notes.slice(0, 5));
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  const handleScanDocument = () => {
    hapticService.medium();
    navigation.navigate('Scanner');
  };

  const handleViewLibrary = () => {
    hapticService.light();
    navigation.navigate('Library');
  };

  const handleCreateBlankNote = () => {
    hapticService.medium();
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('Editor', { 
        noteText: '', 
        tone: 'professional' 
      });
    }
  };

  const handleDocumentUpload = () => {
    hapticService.medium();
    navigation.navigate('DocumentUploadScreen');
  };

  const handleNotePress = (note: Note) => {
    hapticService.light();
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('Editor', {
        noteText: note.content,
        tone: note.tone,
        originalText: note.originalText
      });
    }
  };

  const renderRecentNote = ({ item }: { item: Note }) => {
    // Determine note type icon based on source
    const getNoteTypeIcon = (note: Note) => {
      if (note.sourceImageUrl) return 'camera';
      if (note.originalText && note.originalText.length > note.content.length) return 'file-document';
      return 'pencil';
    };

    // Get content preview (first 80 characters)
    const getContentPreview = (note: Note) => {
      const content = note.plainText || note.content || 'No content available';
      return content.length > 80 ? content.substring(0, 80) + '...' : content;
    };

    return (
      <Card 
        style={[styles.recentNoteCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => handleNotePress(item)}
        elevation={1}
      >
        <Card.Content style={styles.recentNoteContent}>
          {/* Header with icon and title */}
          <View style={styles.recentNoteHeader}>
            <View style={[styles.noteTypeIconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon 
                name={getNoteTypeIcon(item)} 
                size={14} 
                color={theme.colors.onPrimaryContainer}
              />
            </View>
            <Text variant="titleSmall" numberOfLines={1} style={[styles.noteTitle, { color: theme.colors.onSurface }]}>
              {item.title || 'Untitled Note'}
            </Text>
          </View>

          {/* Content preview with fade-out gradient */}
          <View style={styles.notePreviewContainer}>
            <Text variant="bodySmall" numberOfLines={3} style={[styles.notePreview, { color: theme.colors.onSurfaceVariant }]}>
              {getContentPreview(item)}
            </Text>
            <LinearGradient
              colors={[`${theme.colors.surface}00`, theme.colors.surface]}
              style={styles.fadeGradient}
              pointerEvents="none"
            />
          </View>

          {/* Footer with date */}
          <Text variant="labelSmall" style={[styles.noteDate, { color: theme.colors.onSurfaceVariant }]}>
            {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            }) : 'Unknown'}
          </Text>
        </Card.Content>
      </Card>
    );
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
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <Surface style={[styles.loadingIconContainer, { backgroundColor: theme.colors.primaryContainer }]} elevation={3}>
              <Icon name="lightning-bolt" size={48} color={theme.colors.primary} />
            </Surface>
            <Text variant="headlineSmall" style={[styles.loadingTitle, { color: theme.colors.onSurface }]}>
              NoteSpark AI
            </Text>
            <Text variant="bodyMedium" style={[styles.loadingSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Preparing your intelligent dashboard
            </Text>
            <View style={styles.loadingIndicator}>
              <ProgressBar 
                indeterminate 
                color={theme.colors.primary}
                style={styles.progressBar}
              />
            </View>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Dynamic Header with Greeting */}
          <View style={styles.header}>
            <Text variant="headlineLarge" style={styles.title}>
              {getGreeting()}
            </Text>
            <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              {getMotivationalMessage()}
            </Text>
          </View>

          {/* Enhanced Usage Statistics */}
          <View style={styles.statsContainer}>
            <Surface style={[styles.statCard, { backgroundColor: theme.colors.primaryContainer }]} elevation={1}>
              <Text variant="headlineSmall" style={{ color: theme.colors.onPrimaryContainer, fontWeight: 'bold' }}>
                {stats.totalNotes}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                {stats.totalNotes === 1 ? 'Note Created' : 'Notes Created'}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8, marginTop: 4 }}>
                {stats.totalNotes > 0 ? 'Keep it up!' : 'Start your journey!'}
              </Text>
            </Surface>
            
            <Surface style={[styles.statCard, { backgroundColor: theme.colors.secondaryContainer }]} elevation={1}>
              <Text variant="headlineSmall" style={{ color: theme.colors.onSecondaryContainer, fontWeight: 'bold' }}>
                {stats.totalWords.toLocaleString()}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
                Total Words
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSecondaryContainer, opacity: 0.8, marginTop: 4 }}>
                {stats.totalWords > 1000 ? 'Impressive!' : 'Growing strong!'}
              </Text>
            </Surface>
          </View>

          {/* Additional Stats Row */}
          <View style={styles.statsContainer}>
            <Surface style={[styles.statCard, { backgroundColor: theme.colors.tertiaryContainer }]} elevation={1}>
              <Text variant="headlineSmall" style={{ color: theme.colors.onTertiaryContainer, fontWeight: 'bold' }}>
                {stats.notesToday}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onTertiaryContainer }}>
                Notes Today
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onTertiaryContainer, opacity: 0.8, marginTop: 4 }}>
                {stats.notesToday > 0 ? 'Productive day!' : 'Ready to start?'}
              </Text>
            </Surface>
            
            <Surface style={[styles.statCard, { backgroundColor: theme.colors.errorContainer }]} elevation={1}>
              <Text variant="headlineSmall" style={{ color: theme.colors.onErrorContainer, fontWeight: 'bold' }}>
                {stats.streak}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer }}>
                Day Streak
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onErrorContainer, opacity: 0.8, marginTop: 4 }}>
                {stats.streak > 0 ? '🔥 On fire!' : 'Start today!'}
              </Text>
            </Surface>
          </View>

          {/* Recent Notes Section */}
          {recentNotes.length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.sectionHeader}>
                <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Recent Notes
                </Text>
                <IconButton
                  icon="arrow-right"
                  size={24}
                  iconColor={theme.colors.primary}
                  onPress={handleViewLibrary}
                />
              </View>
              <FlatList
                data={recentNotes}
                renderItem={renderRecentNote}
                keyExtractor={(item: Note) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentNotesList}
              />
            </View>
          )}

          {/* First-Time User Welcome State */}
          {recentNotes.length === 0 && (
            <View style={styles.welcomeSection}>
              <Surface style={[styles.welcomeCard, { backgroundColor: theme.colors.secondaryContainer }]} elevation={3}>
                <View style={styles.welcomeContent}>
                  <Icon 
                    name="star-shooting" 
                    size={64} 
                    color={theme.colors.secondary}
                    style={styles.welcomeIcon}
                  />
                  <Text 
                    variant="headlineSmall" 
                    style={[styles.welcomeTitle, { color: theme.colors.onSecondaryContainer }]}
                  >
                    Welcome to NoteSpark AI! ✨
                  </Text>
                  <Text 
                    variant="bodyLarge" 
                    style={[styles.welcomeSubtitle, { color: theme.colors.onSecondaryContainer, opacity: 0.8 }]}
                  >
                    Transform your documents and thoughts into intelligent notes with AI-powered insights.
                  </Text>
                  <Text 
                    variant="bodyMedium" 
                    style={[styles.welcomeHint, { color: theme.colors.onSecondaryContainer, opacity: 0.7 }]}
                  >
                    Get started by scanning your first document or creating a new note below!
                  </Text>
                  <Button
                    mode="contained"
                    onPress={handleScanDocument}
                    style={[styles.welcomeButton, { backgroundColor: theme.colors.secondary }]}
                    contentStyle={styles.welcomeButtonContent}
                    labelStyle={{ color: theme.colors.onSecondary, fontWeight: 'bold' }}
                    icon="camera-plus"
                  >
                    Scan Your First Document
                  </Button>
                </View>
              </Surface>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.actionsContainer}>
            <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onSurface, marginBottom: 16 }]}>
              Quick Actions
            </Text>
            
            <Surface style={[styles.actionCard, { backgroundColor: theme.colors.primaryContainer }]} elevation={2}>
              <TouchableOpacity style={styles.actionContent} onPress={handleScanDocument}>
                <Icon 
                  name="camera-plus" 
                  size={48} 
                  color={theme.colors.onPrimaryContainer} 
                  style={styles.actionIcon}
                />
                <View style={styles.actionText}>
                  <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer, fontWeight: 'bold' }}>
                    Scan Document
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}>
                    Capture and transform documents with AI
                  </Text>
                </View>
                <Icon 
                  name="chevron-right" 
                  size={24} 
                  color={theme.colors.onPrimaryContainer} 
                />
              </TouchableOpacity>
            </Surface>

            <Surface style={[styles.actionCard, { backgroundColor: theme.colors.secondaryContainer }]} elevation={2}>
              <TouchableOpacity style={styles.actionContent} onPress={handleDocumentUpload}>
                <Icon 
                  name="file-upload" 
                  size={48} 
                  color={theme.colors.onSecondaryContainer} 
                  style={styles.actionIcon}
                />
                <View style={styles.actionText}>
                  <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer, fontWeight: 'bold' }}>
                    Upload Document
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSecondaryContainer, opacity: 0.8 }}>
                    Import PDF, Word, or text files
                  </Text>
                </View>
                <Icon 
                  name="chevron-right" 
                  size={24} 
                  color={theme.colors.onSecondaryContainer} 
                />
              </TouchableOpacity>
            </Surface>

            <Surface style={[styles.actionCard, { backgroundColor: theme.colors.tertiaryContainer }]} elevation={2}>
              <TouchableOpacity style={styles.actionContent} onPress={handleCreateBlankNote}>
                <Icon 
                  name="note-plus" 
                  size={48} 
                  color={theme.colors.onTertiaryContainer} 
                  style={styles.actionIcon}
                />
                <View style={styles.actionText}>
                  <Text variant="titleMedium" style={{ color: theme.colors.onTertiaryContainer, fontWeight: 'bold' }}>
                    Create Blank Note
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onTertiaryContainer, opacity: 0.8 }}>
                    Start writing from scratch
                  </Text>
                </View>
                <Icon 
                  name="chevron-right" 
                  size={24} 
                  color={theme.colors.onTertiaryContainer} 
                />
              </TouchableOpacity>
            </Surface>

            <Surface style={[styles.actionCard, { backgroundColor: theme.colors.errorContainer }]} elevation={2}>
              <TouchableOpacity style={styles.actionContent} onPress={handleViewLibrary}>
                <Icon 
                  name="library" 
                  size={48} 
                  color={theme.colors.onErrorContainer} 
                  style={styles.actionIcon}
                />
                <View style={styles.actionText}>
                  <Text variant="titleMedium" style={{ color: theme.colors.onErrorContainer, fontWeight: 'bold' }}>
                    View Library
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onErrorContainer, opacity: 0.8 }}>
                    Browse all your notes and folders
                  </Text>
                </View>
                <Icon 
                  name="chevron-right" 
                  size={24} 
                  color={theme.colors.onErrorContainer} 
                />
              </TouchableOpacity>
            </Surface>
          </View>

          <Button 
            mode="outlined" 
            onPress={handleSignOut}
            style={styles.signOutButton}
          >
            Sign Out
          </Button>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.8,
  },
  loadingIndicator: {
    width: 200,
    alignItems: 'center',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  recentSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  recentNotesList: {
    paddingHorizontal: 4,
  },
  recentNoteCard: {
    width: 180,
    marginRight: 12,
    borderRadius: 16,
  },
  recentNoteContent: {
    padding: 16,
  },
  recentNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  noteTypeIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  noteTitle: {
    flex: 1,
    fontWeight: '600',
  },
  notePreviewContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  notePreview: {
    lineHeight: 18,
    minHeight: 54, // 3 lines minimum
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 18, // Height of one line
  },
  noteDate: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  recentNoteFooter: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionCard: {
    borderRadius: 16,
    marginBottom: 12,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  actionIcon: {
    marginRight: 16,
  },
  actionText: {
    flex: 1,
  },
  signOutButton: {
    marginTop: 24,
    marginBottom: 32,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeCard: {
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 4,
  },
  welcomeContent: {
    alignItems: 'center',
    textAlign: 'center',
  },
  welcomeIcon: {
    marginBottom: 16,
  },
  welcomeTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  welcomeHint: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  welcomeButton: {
    borderRadius: 12,
    elevation: 2,
  },
  welcomeButtonContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
