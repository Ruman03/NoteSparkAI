import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Text,
  useTheme,
  IconButton,
  Menu,
  Divider,
  TextInput,
  Surface,
  Chip,
  Portal,
  Modal,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { RichEditor, RichToolbar, actions, FONT_SIZE } from 'react-native-pell-rich-editor';

import { AIService, AITransformationRequest } from '../services/AIService';
import { NotesService } from '../services/NotesService';
import { hapticService } from '../services/HapticService';
import { useAdaptiveAutoSave } from '../hooks/useAdaptiveAutoSave';
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
  const [currentContent, setCurrentContent] = useState('');
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [showAutoSaveSettings, setShowAutoSaveSettings] = useState(false);
  
  // Track active formatting styles for toolbar state
  const [activeStyles, setActiveStyles] = useState<string[]>([]);
  
  // Track editor initialization state
  const [isEditorReady, setIsEditorReady] = useState(false);
  
  // Advanced editor states
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedFontSize, setSelectedFontSize] = useState(16);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);

  // Advanced editor functions
  const insertTable = useCallback(() => {
    if (richText.current) {
      let tableHtml = '<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
      for (let i = 0; i < tableRows; i++) {
        tableHtml += '<tr>';
        for (let j = 0; j < tableCols; j++) {
          tableHtml += '<td style="border: 1px solid #ccc; padding: 8px; min-width: 50px;">&nbsp;</td>';
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</table>';
      
      richText.current.insertHTML(tableHtml);
      setShowTableModal(false);
    }
  }, [tableRows, tableCols]);

  const insertLink = useCallback(() => {
    if (richText.current && linkUrl && linkText) {
      // Add URL validation
      const urlPattern = new RegExp('^(https?|ftp)://[^\\s/$.?#].[^\\s]*$');
      if (urlPattern.test(linkUrl)) {
        const linkHtml = `<a href="${linkUrl}" style="color: #007bff; text-decoration: underline;">${linkText}</a>`;
        richText.current.insertHTML(linkHtml);
        setShowLinkModal(false);
        setLinkUrl('');
        setLinkText('');
      } else {
        // Alert the user if the URL is invalid
        Alert.alert("Invalid URL", "Please enter a valid URL starting with http://, https://, or ftp://");
      }
    }
  }, [linkUrl, linkText]);

  const setFontSize = useCallback((size: number) => {
    if (richText.current) {
      // Map size to FONT_SIZE enum: 1 = 10px, 2 = 13px, 3 = 16px, 4 = 18px, 5 = 24px, 6 = 32px, 7 = 48px
      let fontSize: FONT_SIZE = 3; // default 16px
      if (size <= 10) fontSize = 1;
      else if (size <= 13) fontSize = 2;
      else if (size <= 16) fontSize = 3;
      else if (size <= 18) fontSize = 4;
      else if (size <= 24) fontSize = 5;
      else if (size <= 32) fontSize = 6;
      else fontSize = 7;
      
      richText.current.setFontSize(fontSize);
      setSelectedFontSize(size);
      setShowFontMenu(false);
    }
  }, []);

  const setTextColor = useCallback((color: string) => {
    if (richText.current) {
      richText.current.setForeColor(color);
      setShowColorPicker(false);
    }
  }, []);

  const setHighlightColor = useCallback((color: string) => {
    if (richText.current) {
      richText.current.setHiliteColor(color);
      setShowColorPicker(false);
    }
  }, []);

  const insertHorizontalRule = useCallback(() => {
    if (richText.current) {
      richText.current.insertHTML('<hr style="margin: 20px 0; border: none; border-top: 2px solid #ccc;">');
    }
  }, []);

  const setTextAlignment = useCallback(async (alignment: 'left' | 'center' | 'right' | 'justify') => {
    if (richText.current) {
      console.log(`${alignment} alignment button pressed - advanced approach`);
      richText.current.focusContentEditor();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      switch (alignment) {
        case 'left':
          richText.current.sendAction(actions.alignLeft, 'result');
          break;
        case 'center':
          richText.current.sendAction(actions.alignCenter, 'result');
          break;
        case 'right':
          richText.current.sendAction(actions.alignRight, 'result');
          break;
        case 'justify':
          richText.current.sendAction(actions.alignFull, 'result');
          break;
      }
    }
  }, []);

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

  // Register toolbar listener to get formatting state updates
  useEffect(() => {
    if (richText.current) {
      richText.current.registerToolbar((items) => {
        // Convert the toolbar items to an array of active style names
        const styles = items.map(item => {
          if (typeof item === 'string') {
            return item;
          } else if (item && typeof item === 'object' && 'type' in item) {
            return item.type;
          }
          return '';
        }).filter(Boolean);
        
        setActiveStyles(styles);
      });
    }
  }, [initialContent]); // Re-register when content is loaded

  const { noteId: routeNoteId, noteText, tone, originalText, noteTitle: routeNoteTitle } = route.params;

  // Enhanced save function for adaptive auto-save
  const saveNoteContent = useCallback(async (content: string, noteIdToSave: string) => {
    if (!content || !isScreenFocused) return;
    
    const notesService = NotesService.getInstance();
    const user = auth().currentUser;
    if (!user) {
      throw new Error('No authenticated user found');
    }

    // Generate title if needed
    let currentTitle = noteTitle;
    if (shouldGenerateTitleRef.current && (noteTitle === 'New Note' || !noteTitle)) {
      const aiService = AIService.getInstance();
      const textContent = content.replace(/<[^>]*>/g, '');
      currentTitle = await aiService.generateNoteTitle(textContent);
      setNoteTitle(currentTitle);
      shouldGenerateTitleRef.current = false;
    }

    const textContent = content.replace(/<[^>]*>/g, '');
    const currentNoteId = routeNoteId || noteIdRef.current;

    if (currentNoteId) {
      // Update existing note
      await notesService.updateNote(user.uid, currentNoteId, {
        title: currentTitle,
        content: content,
        plainText: textContent,
        tone,
        originalText: originalText || '',
        tags: [],
        updatedAt: new Date()
      });
    } else {
      // Create new note
      const newNoteId = await notesService.saveNote(user.uid, {
        title: currentTitle,
        content: content,
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
  }, [isScreenFocused, noteTitle, tone, originalText, routeNoteId]);

  // Adaptive auto-save hook integration
  const {
    saveSettings,
    triggerSave: manualSave,
    hasUnsavedChanges,
    updateSaveFrequency,
    getCurrentInterval,
    getNextSaveTime
  } = useAdaptiveAutoSave(
    currentContent,
    noteId || 'temp', 
    saveNoteContent
  );

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

  // Keep necessary refs for compatibility
  const shouldGenerateTitleRef = useRef(true);

  useEffect(() => {
    const processNote = async () => {
      setIsLoading(true);
      try {
        if (noteText) {
          if (routeNoteId) {
            // Editing existing note - use content and title as-is
            console.log('EditorScreen: Processing existing note for editing');
            setInitialContent(noteText); // noteText is already HTML for existing notes
            setCurrentContent(noteText); // Initialize adaptive auto-save content
            
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
            setCurrentContent(htmlContent); // Initialize adaptive auto-save content
            
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
  }, [noteText, routeNoteId]);

  const handleSave = async () => {
    if (!richText.current) return;
    
    try {
      setIsSaving(true);
      const html = await richText.current.getContentHtml();
      const textContent = html.replace(/<[^>]*>/g, '').trim();
      
      if (textContent.length === 0) {
        Alert.alert('Error', 'Please add some content before saving.');
        setIsSaving(false);
        return;
      }
      
      // Update current content to trigger adaptive auto-save
      setCurrentContent(html);
      
      // Trigger manual save through adaptive auto-save hook
      const saveSuccessful = await manualSave();
      
      if (saveSuccessful) {
        hapticService.success();
        Alert.alert('Success', 'Note saved successfully!');
      } else {
        hapticService.error();
        Alert.alert('Error', 'Failed to save note. Please try again.');
      }
      
      setIsSaving(false);
    } catch (error) {
      console.error('Manual save failed:', error);
      setIsSaving(false);
      hapticService.error();
      Alert.alert('Error', 'Failed to save note. Please try again.');
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
        setCurrentContent(htmlContent); // Update adaptive auto-save content
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

      {/* Enhanced status bar with adaptive auto-save info and word count */}
      <View style={[styles.statusBar, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={styles.statusLeft}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {hasUnsavedChanges 
              ? saveSettings.frequency === 'manual' 
                ? 'Unsaved changes' 
                : `Auto-saving (${saveSettings.frequency})`
              : lastSaved 
                ? `Saved ${lastSaved.toLocaleTimeString()}`
                : 'Not saved'
            }
          </Text>
          {saveSettings.frequency === 'adaptive' && (
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
              Next save in {Math.ceil(getCurrentInterval() / 1000)}s
            </Text>
          )}
        </View>
        <View style={styles.statusRight}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {wordCount} words
          </Text>
          <IconButton
            icon="cog"
            size={16}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={() => setShowAutoSaveSettings(true)}
            style={{ margin: 0, padding: 4 }}
          />
        </View>
      </View>

      <ScrollView style={styles.scrollContainer}>
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <RichEditor
              ref={richText}
              style={styles.editor}
              initialContentHTML={initialContent}
              placeholder="Start writing your amazing notes..."
              editorInitializedCallback={() => {
                console.log('Editor fully initialized and ready!');
                setIsEditorReady(true);
              }}
              editorStyle={{
                backgroundColor: theme.colors.surface,
                color: theme.colors.onSurface,
                contentCSSText: `
                  font-size: 16px; 
                  line-height: 24px; 
                  padding: 16px; 
                  min-height: 400px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                `
              }}
              onChange={(content) => {
                // Update current content for adaptive auto-save
                setCurrentContent(content);
                
                // Update word count on content change
                const textContent = content.replace(/<[^>]*>/g, '');
                const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
                setWordCount(words.length);
                
                // Note: Auto-save is now handled by the useAdaptiveAutoSave hook
                // The hook automatically triggers saves based on user patterns and content changes
              }}
              // Enhanced editor capabilities
              useContainer={true}
              initialHeight={400}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Advanced Rich Text Toolbar */}
      <Surface style={[styles.advancedToolbar, { backgroundColor: theme.colors.surface }]} elevation={3}>
        {/* First Row - Basic Formatting */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarRow}>
          <View style={styles.toolbarGroup}>
            <IconButton
              icon="undo"
              size={20}
              iconColor={theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Undo button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.undo, 'result');
                }
              }}
              style={styles.toolbarButton}
            />
            <IconButton
              icon="redo"
              size={20}
              iconColor={theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Redo button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.redo, 'result');
                }
              }}
              style={styles.toolbarButton}
            />
          </View>
          
          <Divider style={styles.toolbarDivider} />
          
          <View style={styles.toolbarGroup}>
            <Menu
              visible={showFontMenu}
              onDismiss={() => setShowFontMenu(false)}
              anchor={
                <Button 
                  mode="outlined" 
                  compact 
                  onPress={() => setShowFontMenu(true)}
                  style={styles.fontSizeButton}
                >
                  {selectedFontSize}px
                </Button>
              }
            >
              {[12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                <Menu.Item key={size} onPress={() => setFontSize(size)} title={`${size}px`} />
              ))}
            </Menu>
            
            <IconButton
              icon="format-bold"
              size={20}
              iconColor={activeStyles.includes('bold') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Bold button pressed - advanced approach');
                if (richText.current) {
                  // Focus the editor and ensure it's ready
                  richText.current.focusContentEditor();
                  // Small delay to ensure focus is complete
                  await new Promise(resolve => setTimeout(resolve, 50));
                  // Send the action
                  richText.current.sendAction(actions.setBold, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('bold') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-italic"
              size={20}
              iconColor={activeStyles.includes('italic') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Italic button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.setItalic, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('italic') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-underline"
              size={20}
              iconColor={activeStyles.includes('underline') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Underline button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.setUnderline, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('underline') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-strikethrough"
              size={20}
              iconColor={activeStyles.includes('strikeThrough') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Strikethrough button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.setStrikethrough, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('strikeThrough') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
          </View>
          
          <Divider style={styles.toolbarDivider} />
          
          <View style={styles.toolbarGroup}>
            <Menu
              visible={showColorPicker}
              onDismiss={() => setShowColorPicker(false)}
              anchor={
                <IconButton
                  icon="palette"
                  size={20}
                  iconColor={theme.colors.onSurface}
                  onPress={() => setShowColorPicker(true)}
                  style={styles.toolbarButton}
                />
              }
            >
              <Menu.Item onPress={() => setTextColor('#000000')} title="Black" />
              <Menu.Item onPress={() => setTextColor('#FF0000')} title="Red" />
              <Menu.Item onPress={() => setTextColor('#00FF00')} title="Green" />
              <Menu.Item onPress={() => setTextColor('#0000FF')} title="Blue" />
              <Menu.Item onPress={() => setTextColor('#FFA500')} title="Orange" />
              <Menu.Item onPress={() => setTextColor('#800080')} title="Purple" />
              <Divider />
              <Menu.Item onPress={() => setHighlightColor('#FFFF00')} title="Highlight Yellow" />
              <Menu.Item onPress={() => setHighlightColor('#90EE90')} title="Highlight Green" />
              <Menu.Item onPress={() => setHighlightColor('#FFB6C1')} title="Highlight Pink" />
            </Menu>
          </View>
          
          <Divider style={styles.toolbarDivider} />
          
          <View style={styles.toolbarGroup}>
            <IconButton
              icon="format-align-left"
              size={20}
              iconColor={activeStyles.includes('alignLeft') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={() => setTextAlignment('left')}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('alignLeft') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-align-center"
              size={20}
              iconColor={activeStyles.includes('alignCenter') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={() => setTextAlignment('center')}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('alignCenter') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-align-right"
              size={20}
              iconColor={activeStyles.includes('alignRight') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={() => setTextAlignment('right')}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('alignRight') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-align-justify"
              size={20}
              iconColor={activeStyles.includes('alignFull') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={() => setTextAlignment('justify')}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('alignFull') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
          </View>
        </ScrollView>

        {/* Second Row - Advanced Features */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarRow}>
          <View style={styles.toolbarGroup}>
            <IconButton
              icon="format-header-1"
              size={20}
              iconColor={activeStyles.includes('heading1') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('H1 button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.heading1, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('heading1') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-header-2"
              size={20}
              iconColor={activeStyles.includes('heading2') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('H2 button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.heading2, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('heading2') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-header-3"
              size={20}
              iconColor={activeStyles.includes('heading3') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('H3 button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.heading3, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('heading3') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
          </View>
          
          <Divider style={styles.toolbarDivider} />
          
          <View style={styles.toolbarGroup}>
            <IconButton
              icon="format-list-bulleted"
              size={20}
              iconColor={activeStyles.includes('unorderedList') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Bullet list button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.insertBulletsList, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('unorderedList') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-list-numbered"
              size={20}
              iconColor={activeStyles.includes('orderedList') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Numbered list button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.insertOrderedList, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('orderedList') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="format-indent-increase"
              size={20}
              iconColor={theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Indent button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.indent, 'result');
                }
              }}
              style={styles.toolbarButton}
            />
            <IconButton
              icon="format-indent-decrease"
              size={20}
              iconColor={theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Outdent button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.outdent, 'result');
                }
              }}
              style={styles.toolbarButton}
            />
          </View>
          
          <Divider style={styles.toolbarDivider} />
          
          <View style={styles.toolbarGroup}>
            <IconButton
              icon="table"
              size={20}
              iconColor={theme.colors.onSurface}
              onPress={() => setShowTableModal(true)}
              style={styles.toolbarButton}
            />
            <IconButton
              icon="link"
              size={20}
              iconColor={theme.colors.onSurface}
              onPress={() => setShowLinkModal(true)}
              style={styles.toolbarButton}
            />
            <IconButton
              icon="minus"
              size={20}
              iconColor={theme.colors.onSurface}
              onPress={insertHorizontalRule}
              style={styles.toolbarButton}
            />
            <IconButton
              icon="format-quote-close"
              size={20}
              iconColor={activeStyles.includes('quote') ? theme.colors.primary : theme.colors.onSurface}
              disabled={!isEditorReady}
              onPress={async () => {
                console.log('Blockquote button pressed - advanced approach');
                if (richText.current) {
                  richText.current.focusContentEditor();
                  await new Promise(resolve => setTimeout(resolve, 50));
                  richText.current.sendAction(actions.blockquote, 'result');
                }
              }}
              style={[
                styles.toolbarButton,
                { backgroundColor: activeStyles.includes('quote') ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
          </View>
          
          <Divider style={styles.toolbarDivider} />
          
          <View style={styles.toolbarGroup}>
            <IconButton
              icon="keyboard-close"
              size={20}
              iconColor={theme.colors.onSurface}
              onPress={() => richText.current?.blurContentEditor()}
              style={styles.toolbarButton}
            />
          </View>
        </ScrollView>
      </Surface>

      {/* Table Creation Modal */}
      <Portal>
        <Modal
          visible={showTableModal}
          onDismiss={() => setShowTableModal(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            Insert Table
          </Text>
          
          <View style={styles.tableInputContainer}>
            <View style={styles.tableInputGroup}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Rows:</Text>
              <TextInput
                mode="outlined"
                value={tableRows.toString()}
                onChangeText={(text) => setTableRows(parseInt(text) || 2)}
                keyboardType="numeric"
                style={styles.tableInput}
              />
            </View>
            
            <View style={styles.tableInputGroup}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Columns:</Text>
              <TextInput
                mode="outlined"
                value={tableCols.toString()}
                onChangeText={(text) => setTableCols(parseInt(text) || 2)}
                keyboardType="numeric"
                style={styles.tableInput}
              />
            </View>
          </View>
          
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setShowTableModal(false)} style={styles.modalButton}>
              Cancel
            </Button>
            <Button mode="contained" onPress={insertTable} style={styles.modalButton}>
              Insert Table
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Link Creation Modal */}
      <Portal>
        <Modal
          visible={showLinkModal}
          onDismiss={() => setShowLinkModal(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            Insert Link
          </Text>
          
          <TextInput
            mode="outlined"
            label="Link Text"
            value={linkText}
            onChangeText={setLinkText}
            style={styles.linkInput}
          />
          
          <TextInput
            mode="outlined"
            label="URL"
            value={linkUrl}
            onChangeText={setLinkUrl}
            style={styles.linkInput}
            autoCapitalize="none"
          />
          
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setShowLinkModal(false)} style={styles.modalButton}>
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={insertLink} 
              disabled={!linkUrl || !linkText}
              style={styles.modalButton}
            >
              Insert Link
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Auto-save Settings Modal */}
      <Portal>
        <Modal 
          visible={showAutoSaveSettings} 
          onDismiss={() => setShowAutoSaveSettings(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="headlineSmall" style={styles.modalTitle}>Auto-save Settings</Text>
          
          <Text variant="bodyMedium" style={styles.modalSubtitle}>
            Choose how frequently your notes are automatically saved
          </Text>

          <View style={styles.settingsContainer}>
            {[
              { key: 'realtime', label: 'Real-time', description: 'Save every few seconds' },
              { key: 'adaptive', label: 'Adaptive (Recommended)', description: 'Learns your editing patterns' },
              { key: 'conservative', label: 'Conservative', description: 'Save every 10 seconds' },
              { key: 'manual', label: 'Manual Only', description: 'Save only when you tap Save' }
            ].map((option) => (
              <View key={option.key} style={styles.settingOption}>
                <View style={styles.settingInfo}>
                  <Text variant="bodyLarge">{option.label}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {option.description}
                  </Text>
                </View>
                <IconButton
                  icon={saveSettings.frequency === option.key ? 'radiobox-marked' : 'radiobox-blank'}
                  iconColor={saveSettings.frequency === option.key ? theme.colors.primary : theme.colors.onSurface}
                  onPress={() => updateSaveFrequency(option.key as any)}
                />
              </View>
            ))}
          </View>

          {saveSettings.frequency === 'adaptive' && saveSettings.userPattern && (
            <View style={styles.patternInfo}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Learned pattern: {saveSettings.userPattern.editingStyle} editing, 
                {Math.round(saveSettings.userPattern.averageEditingSpeed)} WPM
              </Text>
            </View>
          )}

          <Button 
            mode="contained" 
            onPress={() => setShowAutoSaveSettings(false)}
            style={styles.modalButton}
          >
            Done
          </Button>
        </Modal>
      </Portal>

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
  statusLeft: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  advancedToolbar: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    elevation: 3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  toolbarRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  toolbarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  toolbarButton: {
    margin: 0,
    width: 36,
    height: 36,
  },
  toolbarDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  fontSizeButton: {
    marginHorizontal: 4,
    minWidth: 60,
  },
  modalContainer: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  modalSubtitle: {
    marginBottom: 24,
    textAlign: 'center',
    color: '#666',
  },
  settingsContainer: {
    marginBottom: 24,
  },
  settingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingInfo: {
    flex: 1,
  },
  patternInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  tableInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  tableInputGroup: {
    alignItems: 'center',
    gap: 8,
  },
  tableInput: {
    width: 80,
    height: 50,
  },
  linkInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  modalButton: {
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
  colorPickerContainer: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  colorItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    margin: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#333',
    borderWidth: 3,
  },
});
