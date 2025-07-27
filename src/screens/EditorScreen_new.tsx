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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';

import { AIService, AITransformationRequest } from '../services/AIService';
import { NotesService } from '../services/NotesService';
import type { EditorScreenNavigationProp, RootStackParamList } from '../types/navigation';

type EditorRouteProp = RouteProp<RootStackParamList, 'Editor'>;

export default function EditorScreen() {
  const theme = useTheme();
  const navigation = useNavigation<EditorScreenNavigationProp>();
  const route = useRoute<EditorRouteProp>();

  const richText = useRef<RichEditor>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [noteTitle, setNoteTitle] = useState('New Note');
  const [initialContent, setInitialContent] = useState('');
  const [wordCount, setWordCount] = useState(0);

  const { noteText, tone, originalText } = route.params;

  // Auto-save functionality
  const autoSave = async () => {
    if (!richText.current) return;
    
    try {
      const html = await richText.current.getContentHtml();
      
      if (html && html.trim() !== '') {
        // Calculate word count
        const textContent = html.replace(/<[^>]*>/g, '');
        const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
        setWordCount(words.length);
        
        // Generate title using AI
        const aiService = AIService.getInstance();
        const title = await aiService.generateNoteTitle(textContent);
        setNoteTitle(title);
        
        // Save to database
        const notesService = NotesService.getInstance();
        await notesService.saveNote({
          title,
          content: html,
          plainText: textContent,
          tone,
          originalText: originalText || '',
          tags: [],
          createdAt: lastSaved ? new Date(lastSaved) : new Date(),
          updatedAt: new Date()
        });
        
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Auto-save every 3 seconds
  useEffect(() => {
    const interval = setInterval(autoSave, 3000);
    return () => clearInterval(interval);
  }, [noteTitle]);

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
      
      // Generate title using AI
      const aiService = AIService.getInstance();
      const title = await aiService.generateNoteTitle(textContent);
      
      // Save note
      const notesService = NotesService.getInstance();
      await notesService.saveNote({
        title,
        content: html,
        plainText: textContent,
        tone,
        originalText: originalText || '',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      setLastSaved(new Date());
      Alert.alert('Success', 'Note saved successfully!');
      navigation.navigate('MainTabs', { screen: 'Library' });
    } catch (error) {
      console.error("Failed to save note:", error);
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
      }
    } catch (error) {
      console.error("Failed to regenerate content:", error);
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
