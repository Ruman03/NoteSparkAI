import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Text,
  useTheme,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

import { AIService, AITransformationRequest } from '../services/AIService';
import { NotesService } from '../services/NotesService';
import { hapticService } from '../services/HapticService';
import type { EditorScreenNavigationProp, RootStackParamList } from '../types/navigation';
import auth from '@react-native-firebase/auth';

type EditorRouteProp = RouteProp<RootStackParamList, 'Editor'>;

export default function EditorScreen() {
  const theme = useTheme();
  const navigation = useNavigation<EditorScreenNavigationProp>();
  const route = useRoute<EditorRouteProp>();

  const richText = useRef<RichEditor>(null);
  const noteIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [noteTitle, setNoteTitle] = useState('New Note');
  const [initialContent, setInitialContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [noteId, setNoteId] = useState<string | null>(null);
    const [toneMode, setToneMode] = useState<string>('standard');
  const [lastContent, setLastContent] = useState('');
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      console.log('EditorScreen: Screen focused');
      setIsScreenFocused(true);
      return () => {
        console.log('EditorScreen: Screen unfocused');
        setIsScreenFocused(false);
      };
    }, [])
  );

  const { noteId: routeNoteId, noteText, tone, originalText, noteTitle: routeNoteTitle } = route.params;

  // Initialize noteId with routeNoteId when editing existing notes
  useEffect(() => {
    if (routeNoteId && !noteId) {
      setNoteId(routeNoteId);
      console.log('EditorScreen: Setting noteId from route params:', routeNoteId);
    }
  }, [routeNoteId, noteId]);

  // Initialize noteTitle with routeNoteTitle when editing existing notes
  useEffect(() => {
    if (routeNoteTitle && noteTitle === 'New Note') {
      setNoteTitle(routeNoteTitle);
      shouldGenerateTitleRef.current = false; // Don't regenerate existing titles
      console.log('EditorScreen: Setting noteTitle from route params:', routeNoteTitle);
    }
  }, [routeNoteTitle, noteTitle]);

  // Update ref when noteId changes
  useEffect(() => {
    noteIdRef.current = noteId;
  }, [noteId]);

  // Debounced auto-save with smart change detection
  const lastContentRef = useRef('');
  const shouldGenerateTitleRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized auto-save function to prevent recreation on every render
  const autoSave = useCallback(async () => {
    if (!richText.current || !isScreenFocused) return;
    
    try {
      console.log('EditorScreen: Starting auto-save check');
      const html = await richText.current.getContentHtml();
      
      // Smart change detection - only proceed if content actually changed
      if (!html || html.trim() === '' || html === lastContentRef.current) {
        console.log('EditorScreen: No content changes detected, skipping save');
        return;
      }

      console.log('EditorScreen: Content changed, proceeding with save');
      lastContentRef.current = html;
      setLastContent(html);
      setIsSaving(true);
      
      // Calculate word count
      const textContent = html.replace(/<[^>]*>/g, '');
      const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
      console.log('EditorScreen: Word count calculated:', words.length);
      
      // Generate title using AI only once or when explicitly needed
      let currentTitle = noteTitle;
      if (shouldGenerateTitleRef.current && (noteTitle === 'New Note' || !noteTitle)) {
        console.log('EditorScreen: Generating new title with AI');
        const aiService = AIService.getInstance();
        currentTitle = await aiService.generateNoteTitle(textContent);
        setNoteTitle(currentTitle);
        shouldGenerateTitleRef.current = false; // Prevent unnecessary title generation
        console.log('EditorScreen: AI generated title:', currentTitle);
      }
      
      // Save to database - update existing note if we have an ID, create new one if not
      const notesService = NotesService.getInstance();
      const user = auth().currentUser;
      if (!user) {
        console.error('EditorScreen: No authenticated user found');
        return;
      }

      // Check if we have a note ID (either from route params or created previously)
      const currentNoteId = routeNoteId || noteIdRef.current;
      console.log('EditorScreen: Auto-save check - routeNoteId:', routeNoteId, 'noteIdRef.current:', noteIdRef.current, 'currentNoteId:', currentNoteId);
      
      if (currentNoteId) {
        // Update existing note
        console.log('EditorScreen: Updating existing note with ID:', currentNoteId);
        await notesService.updateNote(user.uid, currentNoteId, {
          title: currentTitle,
          content: html,
          plainText: textContent,
          tone,
          originalText: originalText || '',
          tags: [],
          updatedAt: new Date()
        });
        console.log(`EditorScreen: Auto-saved note: Updated existing note with ID: ${currentNoteId}`);
        
        // Ensure the noteId state is properly set
        if (!noteIdRef.current) {
          setNoteId(currentNoteId);
          noteIdRef.current = currentNoteId;
        }
      } else {
        // Create new note and store the ID
        console.log('EditorScreen: Creating new note');
        const newNoteId = await notesService.saveNote(user.uid, {
          title: currentTitle,
          content: html,
          plainText: textContent,
          tone,
          originalText: originalText || '',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        setNoteId(newNoteId);
        noteIdRef.current = newNoteId;
        console.log(`EditorScreen: Auto-saved note: Created new note with ID: ${newNoteId}`);
      }
      
      setLastSaved(new Date());
      setIsSaving(false);
    } catch (error) {
      console.error('EditorScreen: Auto-save failed:', error);
      setIsSaving(false);
      
      // Show user-friendly error message for persistent failures
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('EditorScreen: Save failed due to connection timeout - will retry on next interval');
      }
    }
  }, [isScreenFocused, noteTitle, tone, originalText, routeNoteId]);

  // Debounced auto-save effect - only triggers when content changes
  const debouncedAutoSave = useCallback(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new debounced timeout
    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000); // 2 second debounce - more reasonable than 3 second intervals
  }, [autoSave]);

  // Set up auto-save interval - only when screen is focused
  useEffect(() => {
    if (!isScreenFocused) return;

    console.log('EditorScreen: Setting up auto-save interval');
    const interval = setInterval(() => {
      console.log('EditorScreen: Auto-save interval trigger');
      autoSave();
    }, 5000); // Increased to 5 seconds to reduce API calls
    
    return () => {
      console.log('EditorScreen: Cleaning up auto-save interval');
      clearInterval(interval);
    };
  }, [isScreenFocused, autoSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const processNote = async () => {
      setIsLoading(true);
      try {
        if (noteText) {
          if (routeNoteId) {
            // Editing existing note - use content and title as-is
            console.log('EditorScreen: Processing existing note for editing');
            setInitialContent(noteText); // noteText is already HTML for existing notes
            lastContentRef.current = noteText;
            
            // Calculate word count from HTML content
            const plainText = noteText.replace(/<[^>]*>/g, '');
            const words = plainText.trim().split(/\s+/).filter(word => word.length > 0);
            setWordCount(words.length);
            
            // Title should already be set from routeNoteTitle in the useEffect above
            console.log('EditorScreen: Existing note processed, title:', noteTitle);
          } else {
            // Creating new note from scanned text - needs title generation and HTML conversion
            console.log('EditorScreen: Processing new note from scanned text');
            const aiService = AIService.getInstance();
            const title = await aiService.generateNoteTitle(noteText);
            setNoteTitle(title);
            shouldGenerateTitleRef.current = false; // Mark title as generated
            
            // Convert plain text to HTML for rich text editor
            const htmlContent = noteText
              .split('\n\n')
              .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
              .join('');
            setInitialContent(htmlContent);
            lastContentRef.current = htmlContent; // Initialize content tracking
            
            // Calculate initial word count
            const words = noteText.trim().split(/\s+/).filter(word => word.length > 0);
            setWordCount(words.length);
            console.log('EditorScreen: New note processed, title:', title);
          }
        }
      } catch (error) {
        console.error("Failed to process note:", error);
        setInitialContent('<p>Failed to load content. Please try again.</p>');
      } finally {
        setIsLoading(false);
      }
    };

    processNote();
  }, [noteText, routeNoteId, noteTitle]);

  const handleSave = async () => {
    if (!richText.current) return;
    
    try {
      setIsSaving(true);
      const html = await richText.current.getContentHtml();
      const textContent = html.replace(/<[^>]*>/g, '').trim();
      
      if (textContent.length === 0) {
        Alert.alert('Error', 'Please add some content before saving.');
        return;
      }
      
      // Update last content to prevent auto-save conflicts
      lastContentRef.current = html;
      setLastContent(html);
      
      // Generate title using AI (only if we don't have a title yet)
      let currentTitle = noteTitle;
      if (noteTitle === 'New Note' || !noteTitle) {
        const aiService = AIService.getInstance();
        currentTitle = await aiService.generateNoteTitle(textContent);
        setNoteTitle(currentTitle);
        shouldGenerateTitleRef.current = false; // Mark title as generated
      }
      
      // Save note
      const notesService = NotesService.getInstance();
      const user = auth().currentUser;
      if (!user) {
        console.error('EditorScreen: No authenticated user found');
        return;
      }
      
      if (noteIdRef.current) {
        // Update existing note
        await notesService.updateNote(user.uid, noteIdRef.current, {
          title: currentTitle,
          content: html,
          plainText: textContent,
          tone,
          originalText: originalText || '',
          tags: [],
          updatedAt: new Date()
        });
      } else {
        // Create new note and store the ID
        const newNoteId = await notesService.saveNote(user.uid, {
          title: currentTitle,
          content: html,
          plainText: textContent,
          tone,
          originalText: originalText || '',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        setNoteId(newNoteId);
        noteIdRef.current = newNoteId;
      }
      
      setLastSaved(new Date());
      hapticService.success();
      Alert.alert('Success', 'Note saved successfully!');
      navigation.navigate('MainTabs', { screen: 'Library' });
    } catch (error) {
      console.error("Failed to save note:", error);
      hapticService.error();
      Alert.alert('Error', 'Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const regenerateWithDifferentTone = async (newTone: string) => {
    if (!originalText) return;
    
    try {
      setIsLoading(true);
      const request: AITransformationRequest = {
        text: originalText,
        tone: newTone as 'professional' | 'casual' | 'simplified',
      };
      
      const aiService = AIService.getInstance();
      const response = await aiService.transformTextToNote(request);
      
      const title = await aiService.generateNoteTitle(response.transformedText);
      setNoteTitle(title);
      shouldGenerateTitleRef.current = false; // Mark title as generated
      
      const htmlContent = response.transformedText
        .split('\n\n')
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
      
      if (richText.current) {
        richText.current.setContentHTML(htmlContent);
        lastContentRef.current = htmlContent; // Update content tracking
        hapticService.success();
      }
    } catch (error) {
      console.error("Failed to regenerate content:", error);
      hapticService.error();
      Alert.alert('Error', 'Failed to regenerate content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurface }}>
          Generating your notes...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={noteTitle} titleStyle={[styles.headerTitle, { color: theme.colors.onSurface }]} />
        <Button 
          mode="contained" 
          onPress={handleSave} 
          loading={isSaving} 
          disabled={isSaving}
          style={styles.saveButton}
        >
          Save
        </Button>
      </Appbar.Header>

      {/* Status bar with save info and word count */}
      <View style={[styles.statusBar, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {isSaving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Not saved'}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {wordCount} words
        </Text>
      </View>

      <ScrollView style={styles.scrollContainer}>
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <RichEditor
              ref={richText}
              style={styles.editor}
              initialContentHTML={initialContent}
              placeholder="Start writing your amazing notes..."
              editorStyle={{
                backgroundColor: theme.colors.surface,
                color: theme.colors.onSurface,
                contentCSSText: 'font-size: 16px; line-height: 24px; padding: 16px; min-height: 400px;'
              }}
              onChange={(content) => {
                // Update word count on content change
                const textContent = content.replace(/<[^>]*>/g, '');
                const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
                setWordCount(words.length);
                
                // Trigger debounced auto-save on content change
                debouncedAutoSave();
              }}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Rich Text Toolbar */}
      <RichToolbar
        style={[styles.toolbar, { backgroundColor: theme.colors.surface }]}
        editor={richText}
        selectedIconTint={theme.colors.primary}
        iconTint={theme.colors.onSurface}
        actions={[
          actions.undo,
          actions.redo,
          actions.setBold,
          actions.setItalic,
          actions.heading1,
          actions.heading2,
          actions.insertBulletsList,
          actions.insertOrderedList,
          actions.keyboard
        ]}
      />

      {/* Tone regeneration options (if available) */}
      {originalText && (
        <View style={[styles.toneBar, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginRight: 8 }}>
            Regenerate:
          </Text>
          <Button
            mode="outlined"
            compact
            onPress={() => regenerateWithDifferentTone('professional')}
            style={styles.toneButton}
          >
            Professional
          </Button>
          <Button
            mode="outlined"
            compact
            onPress={() => regenerateWithDifferentTone('casual')}
            style={styles.toneButton}
          >
            Casual
          </Button>
          <Button
            mode="outlined"
            compact
            onPress={() => regenerateWithDifferentTone('simplified')}
            style={styles.toneButton}
          >
            Simple
          </Button>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  saveButton: {
    marginRight: 8,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  card: {
    flex: 1,
    margin: 8,
    elevation: 2,
  },
  cardContent: {
    padding: 0,
  },
  editor: {
    minHeight: 400,
    flex: 1,
  },
  toolbar: {
    elevation: 2,
    paddingVertical: 8,
  },
  toneBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 1,
  },
  toneButton: {
    marginRight: 8,
    minWidth: 80,
  },
});
