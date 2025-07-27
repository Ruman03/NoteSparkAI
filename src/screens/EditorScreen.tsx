import React, { useRef, useState, useEffect } from 'react';
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

  const { noteText, tone, originalText } = route.params;

  // Update ref when noteId changes
  useEffect(() => {
    noteIdRef.current = noteId;
  }, [noteId]);

  // Auto-save functionality
  const autoSave = async () => {
    if (!richText.current) return;
    
    try {
      console.log('EditorScreen: Starting auto-save');
      const html = await richText.current.getContentHtml();
      
      // Only save if content has changed and is not empty
      if (html && html.trim() !== '' && html !== lastContent) {
        console.log('EditorScreen: Content changed, proceeding with save');
        setLastContent(html);
        setIsSaving(true);
        
        // Calculate word count
        const textContent = html.replace(/<[^>]*>/g, '');
        const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
        setWordCount(words.length);
        console.log('EditorScreen: Word count calculated:', words.length);
        
        // Generate title using AI (only if we don't have a title yet)
        let currentTitle = noteTitle;
        if (noteTitle === 'New Note' || !noteTitle) {
          console.log('EditorScreen: Generating new title with AI');
          const aiService = AIService.getInstance();
          currentTitle = await aiService.generateNoteTitle(textContent);
          setNoteTitle(currentTitle);
          console.log('EditorScreen: AI generated title:', currentTitle);
        }
        
        // Save to database - update existing note if we have an ID, create new one if not
        const notesService = NotesService.getInstance();
        const user = auth().currentUser;
        if (!user) {
          console.error('EditorScreen: No authenticated user found');
          return;
        }
        
        if (noteIdRef.current) {
          // Update existing note
          console.log('EditorScreen: Updating existing note with ID:', noteIdRef.current);
          await notesService.updateNote(user.uid, noteIdRef.current, {
            title: currentTitle,
            content: html,
            plainText: textContent,
            tone,
            originalText: originalText || '',
            tags: [],
            updatedAt: new Date()
          });
          console.log(`EditorScreen: Auto-saved note: Updated existing note with ID: ${noteIdRef.current}`);
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
      } else {
        console.log('EditorScreen: No content changes detected, skipping save');
      }
    } catch (error) {
      console.error('EditorScreen: Auto-save failed:', error);
      setIsSaving(false);
      
      // Show user-friendly error message for persistent failures
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('EditorScreen: Save failed due to connection timeout - will retry on next interval');
      }
    }
  };

  // Auto-save every 3 seconds - clean up when component unmounts
  useEffect(() => {
    console.log('EditorScreen: Setting up auto-save interval');
    const interval = setInterval(() => {
      if (isScreenFocused) {
        autoSave();
      } else {
        console.log('EditorScreen: Skipping auto-save - screen not focused');
      }
    }, 3000);
    
    return () => {
      console.log('EditorScreen: Cleaning up auto-save interval');
      clearInterval(interval);
    };
  }, [isScreenFocused]); // Add isScreenFocused dependency

  useEffect(() => {
    const processNote = async () => {
      setIsLoading(true);
      try {
        if (noteText) {
          // Generate title from AI transformed text
          const aiService = AIService.getInstance();
          const title = await aiService.generateNoteTitle(noteText);
          setNoteTitle(title);
          
          // Convert plain text to HTML for rich text editor
          const htmlContent = noteText
            .split('\n\n')
            .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
          setInitialContent(htmlContent);
          
          // Calculate initial word count
          const words = noteText.trim().split(/\s+/).filter(word => word.length > 0);
          setWordCount(words.length);
        }
      } catch (error) {
        console.error("Failed to process note:", error);
        setInitialContent('<p>Failed to load content. Please try again.</p>');
      } finally {
        setIsLoading(false);
      }
    };

    processNote();
  }, [noteText]);

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
      setLastContent(html);
      
      // Generate title using AI (only if we don't have a title yet)
      let currentTitle = noteTitle;
      if (noteTitle === 'New Note' || !noteTitle) {
        const aiService = AIService.getInstance();
        currentTitle = await aiService.generateNoteTitle(textContent);
        setNoteTitle(currentTitle);
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
      
      const htmlContent = response.transformedText
        .split('\n\n')
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
      
      if (richText.current) {
        richText.current.setContentHTML(htmlContent);
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
