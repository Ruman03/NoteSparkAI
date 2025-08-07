import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo, useReducer } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  Animated,
  Easing
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
  Tooltip,
  Surface,
  Chip,
  Portal,
  Modal,
  Badge,
  ProgressBar,
  Snackbar
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { RichEditor, RichToolbar, actions, FONT_SIZE } from 'react-native-pell-rich-editor';

import { AIService, AITransformationRequest } from '../services/AIService';
import { NotesService } from '../services/NotesService';
import { hapticService } from '../services/HapticService';
import { useAutoSaveWithVersioning } from '../hooks/useAutoSaveWithVersioning';
import VoiceInput from '../components/voice/VoiceInput';
import FolderSelector from '../components/FolderSelector';
import type { EditorScreenNavigationProp, RootStackParamList } from '../types/navigation';
import auth from '@react-native-firebase/auth';

type EditorRouteProp = RouteProp<RootStackParamList, 'Editor'>;

// Enhanced interfaces for enterprise-grade analytics and Gemini integration
interface EditorMetrics {
  totalEditorSessions: number;
  totalWordsWritten: number;
  averageSessionDuration: number;
  geminiSuggestionsUsed: number;
  voiceInputSessions: number;
  averageWordsPerMinute: number;
  lastSessionTime?: Date;
  aiAssistanceAcceptanceRate: number;
}

interface GeminiAssistance {
  isActive: boolean;
  currentSuggestion: string;
  suggestionType: 'completion' | 'grammar' | 'style' | 'structure';
  confidence: number;
  lastSuggestionTime?: Date;
}

interface WritingAnalytics {
  sessionStartTime: Date;
  wordsWritten: number;
  keystrokesCount: number;
  pausesCount: number;
  backspacesCount: number;
  averageTypingSpeed: number;
}

// OPTIMIZED: Consolidated state management with useReducer
interface EditorState {
  isLoading: boolean;
  isSaving: boolean;
  noteTitle: string;
  initialContent: string;
  wordCount: number;
  noteId: string | null;
  toneMode: string;
  lastContent: string;
  currentContent: string;
  isScreenFocused: boolean;
  showVoiceInput: boolean;
  isVoiceActive: boolean;
  activeStyles: string[];
  isEditorReady: boolean;
  selectedFolderId: string | null;
  selectedFolderName: string;
  showFolderSelector: boolean;
  showFontMenu: boolean;
  showColorPicker: boolean;
  showTableModal: boolean;
  showMoreMenu: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  showLinkModal: boolean;
  selectedFontSize: number;
  linkUrl: string;
  linkText: string;
  tableRows: number;
  tableCols: number;
  refreshing: boolean;
  showGeminiAssist: boolean;
  showAnalytics: boolean;
  metrics: EditorMetrics;
  geminiAssistance: GeminiAssistance;
  writingAnalytics: WritingAnalytics;
}

type EditorAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_NOTE_TITLE'; payload: string }
  | { type: 'SET_INITIAL_CONTENT'; payload: string }
  | { type: 'SET_WORD_COUNT'; payload: number }
  | { type: 'SET_NOTE_ID'; payload: string | null }
  | { type: 'SET_CURRENT_CONTENT'; payload: string }
  | { type: 'SET_SCREEN_FOCUSED'; payload: boolean }
  | { type: 'SET_VOICE_INPUT'; payload: boolean }
  | { type: 'SET_VOICE_ACTIVE'; payload: boolean }
  | { type: 'SET_EDITOR_READY'; payload: boolean }
  | { type: 'SET_SELECTED_FOLDER'; payload: { id: string | null; name: string } }
  | { type: 'SET_ACTIVE_STYLES'; payload: string[] }
  | { type: 'TOGGLE_FOLDER_SELECTOR' }
  | { type: 'TOGGLE_FONT_MENU' }
  | { type: 'TOGGLE_COLOR_PICKER' }
  | { type: 'TOGGLE_TABLE_MODAL' }
  | { type: 'TOGGLE_LINK_MODAL' }
  | { type: 'TOGGLE_MORE_MENU' }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_FONT_SIZE'; payload: number }
  | { type: 'SET_TABLE_ROWS'; payload: number }
  | { type: 'SET_TABLE_COLS'; payload: number }
  | { type: 'SET_LINK_TEXT'; payload: string }
  | { type: 'SET_LINK_URL'; payload: string }
  | { type: 'RESET_MODALS' }
  | { type: 'TOGGLE_GEMINI_ASSIST' }
  | { type: 'TOGGLE_ANALYTICS' }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'UPDATE_METRICS'; payload: Partial<EditorMetrics> }
  | { type: 'UPDATE_GEMINI_SUGGESTION'; payload: Partial<GeminiAssistance> }
  | { type: 'UPDATE_WRITING_ANALYTICS'; payload: Partial<WritingAnalytics> };

const initialEditorState: EditorState = {
  isLoading: true,
  isSaving: false,
  noteTitle: 'New Note',
  initialContent: '',
  wordCount: 0,
  noteId: null,
  toneMode: 'standard',
  lastContent: '',
  currentContent: '',
  isScreenFocused: true,
  showVoiceInput: false,
  isVoiceActive: false,
  activeStyles: [],
  isEditorReady: false,
  selectedFolderId: null,
  selectedFolderName: 'Inbox',
  showFolderSelector: false,
  showFontMenu: false,
  showColorPicker: false,
  showTableModal: false,
  showMoreMenu: false,
  isOnline: true,
  isSyncing: false,
  showLinkModal: false,
  selectedFontSize: 16,
  linkUrl: '',
  linkText: '',
  tableRows: 2,
  tableCols: 2,
  refreshing: false,
  showGeminiAssist: false,
  showAnalytics: false,
  metrics: {
    totalEditorSessions: 0,
    totalWordsWritten: 0,
    averageSessionDuration: 0,
    geminiSuggestionsUsed: 0,
    voiceInputSessions: 0,
    averageWordsPerMinute: 0,
    aiAssistanceAcceptanceRate: 0
  },
  geminiAssistance: {
    isActive: false,
    currentSuggestion: '',
    suggestionType: 'completion',
    confidence: 0
  },
  writingAnalytics: {
    sessionStartTime: new Date(),
    wordsWritten: 0,
    keystrokesCount: 0,
    pausesCount: 0,
    backspacesCount: 0,
    averageTypingSpeed: 0
  }
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };
    case 'SET_NOTE_TITLE':
      return { ...state, noteTitle: action.payload };
    case 'SET_INITIAL_CONTENT':
      return { ...state, initialContent: action.payload };
    case 'SET_WORD_COUNT':
      return { ...state, wordCount: action.payload };
    case 'SET_NOTE_ID':
      return { ...state, noteId: action.payload };
    case 'SET_CURRENT_CONTENT':
      return { ...state, currentContent: action.payload };
    case 'SET_SCREEN_FOCUSED':
      return { ...state, isScreenFocused: action.payload };
    case 'SET_VOICE_INPUT':
      return { ...state, showVoiceInput: action.payload, isVoiceActive: action.payload };
    case 'SET_VOICE_ACTIVE':
      return { ...state, isVoiceActive: action.payload };
    case 'SET_EDITOR_READY':
      return { ...state, isEditorReady: action.payload };
    case 'SET_SELECTED_FOLDER':
      return { 
        ...state, 
        selectedFolderId: action.payload.id, 
        selectedFolderName: action.payload.name 
      };
    case 'SET_ACTIVE_STYLES':
      return { ...state, activeStyles: action.payload };
    case 'TOGGLE_FOLDER_SELECTOR':
      return { ...state, showFolderSelector: !state.showFolderSelector };
    case 'TOGGLE_FONT_MENU':
      return { ...state, showFontMenu: !state.showFontMenu };
    case 'TOGGLE_COLOR_PICKER':
      return { ...state, showColorPicker: !state.showColorPicker };
    case 'TOGGLE_TABLE_MODAL':
      return { ...state, showTableModal: !state.showTableModal };
    case 'TOGGLE_LINK_MODAL':
      return { ...state, showLinkModal: !state.showLinkModal };
    case 'TOGGLE_MORE_MENU':
      return { ...state, showMoreMenu: !state.showMoreMenu };
    case 'SET_SYNCING':
      return { ...state, isSyncing: action.payload };
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };
    case 'SET_FONT_SIZE':
      return { ...state, selectedFontSize: action.payload };
    case 'SET_TABLE_ROWS':
      return { ...state, tableRows: action.payload };
    case 'SET_TABLE_COLS':
      return { ...state, tableCols: action.payload };
    case 'SET_LINK_TEXT':
      return { ...state, linkText: action.payload };
    case 'SET_LINK_URL':
      return { ...state, linkUrl: action.payload };
    case 'RESET_MODALS':
      return { 
        ...state, 
        showFontMenu: false, 
        showColorPicker: false, 
        showTableModal: false, 
        showMoreMenu: false, 
        showLinkModal: false 
      };
    case 'TOGGLE_GEMINI_ASSIST':
      return { 
        ...state, 
        showGeminiAssist: !state.showGeminiAssist,
        geminiAssistance: {
          ...state.geminiAssistance,
          isActive: !state.showGeminiAssist
        }
      };
    case 'TOGGLE_ANALYTICS':
      return { ...state, showAnalytics: !state.showAnalytics };
    case 'SET_REFRESHING':
      return { ...state, refreshing: action.payload };
    case 'UPDATE_METRICS':
      return { 
        ...state, 
        metrics: { ...state.metrics, ...action.payload } 
      };
    case 'UPDATE_GEMINI_SUGGESTION':
      return {
        ...state,
        geminiAssistance: { ...state.geminiAssistance, ...action.payload }
      };
    case 'UPDATE_WRITING_ANALYTICS':
      return {
        ...state,
        writingAnalytics: { ...state.writingAnalytics, ...action.payload }
      };
    default:
      return state;
  }
}

export default function EditorScreen() {
  const theme = useTheme();
  const navigation = useNavigation<EditorScreenNavigationProp>();
  const route = useRoute<EditorRouteProp>();

  // OPTIMIZED: Consolidated state management with useReducer
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  
  // Keep essential refs
  const richText = useRef<RichEditor>(null);
  const noteIdRef = useRef<string | null>(null);
  const shouldGenerateTitleRef = useRef(true);

  // Destructure state for easier access
  const {
    isLoading, isSaving, noteTitle, initialContent, wordCount, noteId,
    currentContent, isScreenFocused, showVoiceInput, isVoiceActive,
    activeStyles, isEditorReady, selectedFolderId, selectedFolderName,
    showFolderSelector, showFontMenu, showColorPicker, showTableModal,
    showMoreMenu, isOnline, isSyncing, showLinkModal, selectedFontSize,
    linkUrl, linkText, tableRows, tableCols, refreshing, showGeminiAssist,
    showAnalytics, metrics, geminiAssistance, writingAnalytics
  } = state;

  // OPTIMIZED: Advanced editor functions using dispatch
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
      dispatch({ type: 'RESET_MODALS' });
    }
  }, [tableRows, tableCols]);

  const insertLink = useCallback(() => {
    if (richText.current && linkUrl && linkText) {
      // Add URL validation
      const urlPattern = new RegExp('^(https?|ftp)://[^\\s/$.?#].[^\\s]*$');
      if (urlPattern.test(linkUrl)) {
        const linkHtml = `<a href="${linkUrl}" style="color: #007bff; text-decoration: underline;">${linkText}</a>`;
        richText.current.insertHTML(linkHtml);
        dispatch({ type: 'RESET_MODALS' });
      } else {
        // Alert the user if the URL is invalid
        Alert.alert("Invalid URL", "Please enter a valid URL starting with http://, https://, or ftp://");
      }
    }
  }, [linkUrl, linkText]);

  // OPTIMIZED: Voice input handlers with proper dependencies and cleanup
  const handleVoiceTranscription = useCallback((text: string, isFinal: boolean) => {
    if (!isEditorReady || !text.trim()) return;
    
    if (isFinal && richText.current) {
      // Insert the final transcription at current cursor position
      const formattedText = text.endsWith('.') ? text : text + '.';
      richText.current.insertText(formattedText + ' ');
      
      // Update current content for auto-save using async operation
      richText.current.getContentHtml().then((html) => {
        dispatch({ type: 'SET_CURRENT_CONTENT', payload: html });
      }).catch(console.error);
    }
  }, [isEditorReady]);

  const handleVoiceError = useCallback((error: string) => {
    dispatch({ type: 'SET_VOICE_ACTIVE', payload: false });
    console.error('Voice input error:', error);
    Alert.alert('Voice Input Error', error);
  }, []);

  const handleVoiceSessionComplete = useCallback((metrics: any) => {
    dispatch({ type: 'SET_VOICE_ACTIVE', payload: false });
    console.log('Voice session completed:', metrics);
    
    // Log analytics event
    console.log('Voice session analytics:', {
      words_transcribed: metrics.wordsTranscribed,
      session_duration: metrics.totalDuration,
      average_confidence: metrics.averageConfidence,
    });
  }, []);

  const toggleVoiceInput = useCallback(() => {
    dispatch({ type: 'SET_VOICE_INPUT', payload: !showVoiceInput });
  }, []);

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
      dispatch({ type: 'SET_FONT_SIZE', payload: size });
      dispatch({ type: 'TOGGLE_FONT_MENU' });
    }
  }, []);

  const setTextColor = useCallback((color: string) => {
    if (richText.current) {
      richText.current.setForeColor(color);
      dispatch({ type: 'RESET_MODALS' });
    }
  }, []);

  const setHighlightColor = useCallback((color: string) => {
    if (richText.current) {
      richText.current.setHiliteColor(color);
      dispatch({ type: 'RESET_MODALS' });
    }
  }, []);

  const insertHorizontalRule = useCallback(() => {
    if (richText.current) {
      richText.current.insertHTML('<hr style="margin: 20px 0; border: none; border-top: 2px solid #ccc;">');
    }
  }, []);

  // More menu actions
  const executeBlockquote = useCallback(async () => {
    dispatch({ type: 'TOGGLE_MORE_MENU' });
    if (richText.current) {
      richText.current.focusContentEditor();
      await new Promise(resolve => setTimeout(resolve, 50));
      richText.current.sendAction(actions.blockquote, 'result');
    }
  }, []);

  const executeHorizontalRule = useCallback(() => {
    dispatch({ type: 'TOGGLE_MORE_MENU' });
    insertHorizontalRule();
  }, [insertHorizontalRule]);

  // Network status helper
  const getNetworkIcon = () => {
    if (isSyncing) return 'cloud-sync';
    if (isOnline) return 'cloud-check';
    return 'cloud-off-outline';
  };

  const getNetworkColor = () => {
    if (isSyncing) return theme.colors.primary;
    if (isOnline) return theme.colors.primary;
    return theme.colors.error;
  };

  const getNetworkStatusMessage = () => {
    if (isSyncing) return 'Syncing to cloud...';
    if (isOnline) return 'Connected - Changes saved to cloud';
    return 'Offline - Changes saved locally only';
  };

  const executeStrikethrough = useCallback(async () => {
    dispatch({ type: 'TOGGLE_MORE_MENU' });
    if (richText.current) {
      richText.current.focusContentEditor();
      await new Promise(resolve => setTimeout(resolve, 50));
      richText.current.sendAction(actions.setStrikethrough, 'result');
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
      dispatch({ type: 'SET_SCREEN_FOCUSED', payload: true });
      return () => {
        console.log('EditorScreen: Screen unfocused');
        dispatch({ type: 'SET_SCREEN_FOCUSED', payload: false });
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
        
        dispatch({ type: 'SET_ACTIVE_STYLES', payload: styles });
      });
    }
  }, [initialContent]); // Re-register when content is loaded

  const { 
    noteId: routeNoteId, 
    noteText, 
    tone, 
    originalText, 
    noteTitle: routeNoteTitle,
    folderId: routeFolderId,
    folderName: routeFolderName
  } = route.params;

  // Enhanced save function for adaptive auto-save
  const saveNoteContent = useCallback(async (content: string, noteIdToSave: string) => {
    if (!content || !isScreenFocused) return;
    
    dispatch({ type: 'SET_SYNCING', payload: true }); // Start syncing indicator
    
    try {
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
        dispatch({ type: 'SET_NOTE_TITLE', payload: currentTitle });
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
          folderId: selectedFolderId,
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
          folderId: selectedFolderId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        dispatch({ type: 'SET_NOTE_ID', payload: newNoteId });
        noteIdRef.current = newNoteId;
      }

      dispatch({ type: 'SET_ONLINE', payload: true }); // Successful save indicates we're online
    } catch (error) {
      console.error('Save failed:', error);
      dispatch({ type: 'SET_ONLINE', payload: false }); // Failed save might indicate network issues
      throw error;
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false }); // End syncing indicator
    }
  }, [isScreenFocused, noteTitle, tone, originalText, routeNoteId]);

  // Get current user for versioning
  const currentUser = auth().currentUser;

  // Auto-save with versioning hook integration
  const {
    isSaving: isAutoSaving,
    lastSaved,
    lastVersioned,
    manualSave,
  } = useAutoSaveWithVersioning(
    noteId || '',
    noteTitle,
    currentContent,
    currentUser?.uid || '',
    {
      enabled: !!noteId && !!currentUser,
      autoSaveInterval: 2,
      versionInterval: 15,
      minChangesForVersion: 50,
    }
  );

  // OPTIMIZED: Combined all initialization effects into single useLayoutEffect
  useLayoutEffect(() => {
    // Initialize noteId with routeNoteId when editing existing notes
    if (routeNoteId && !noteId) {
      dispatch({ type: 'SET_NOTE_ID', payload: routeNoteId });
      console.log('EditorScreen: Setting noteId from route params:', routeNoteId);
    }

    // Initialize noteTitle with routeNoteTitle when editing existing notes
    if (routeNoteTitle && noteTitle === 'New Note') {
      dispatch({ type: 'SET_NOTE_TITLE', payload: routeNoteTitle });
      shouldGenerateTitleRef.current = false; // Don't regenerate existing titles
      console.log('EditorScreen: Setting noteTitle from route params:', routeNoteTitle);
    }

    // Initialize folder selection from route parameters
    if (routeFolderId !== undefined) {
      dispatch({ type: 'SET_SELECTED_FOLDER', payload: { id: routeFolderId, name: routeFolderName || 'Inbox' } });
      console.log('EditorScreen: Setting selectedFolderId from route params:', routeFolderId);
    }
    if (routeFolderName) {
      console.log('EditorScreen: Setting selectedFolderName from route params:', routeFolderName);
    }

    // Update ref when noteId changes
    noteIdRef.current = noteId;
  }, [routeNoteId, noteId, routeNoteTitle, noteTitle, routeFolderId, routeFolderName]);

  useEffect(() => {
    const processNote = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        if (noteText) {
          if (routeNoteId) {
            // Editing existing note - use content and title as-is
            console.log('EditorScreen: Processing existing note for editing');
            dispatch({ type: 'SET_INITIAL_CONTENT', payload: noteText }); // noteText is already HTML for existing notes
            dispatch({ type: 'SET_CURRENT_CONTENT', payload: noteText }); // Initialize adaptive auto-save content
            
            // Calculate word count from HTML content
            const plainText = noteText.replace(/<[^>]*>/g, '');
            const words = plainText.trim().split(/\s+/).filter(word => word.length > 0);
            dispatch({ type: 'SET_WORD_COUNT', payload: words.length });
            
            // Title should already be set from routeNoteTitle in the useEffect above
            console.log('EditorScreen: Existing note processed, title:', noteTitle);
          } else {
            // Creating new note from scanned text - needs title generation and HTML conversion
            console.log('EditorScreen: Processing new note from scanned text');
            const aiService = AIService.getInstance();
            const title = await aiService.generateNoteTitle(noteText);
            dispatch({ type: 'SET_NOTE_TITLE', payload: title });
            shouldGenerateTitleRef.current = false; // Mark title as generated
            
            // Convert plain text to HTML for rich text editor
            const htmlContent = noteText
              .split('\n\n')
              .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
              .join('');
            dispatch({ type: 'SET_INITIAL_CONTENT', payload: htmlContent });
            dispatch({ type: 'SET_CURRENT_CONTENT', payload: htmlContent }); // Initialize adaptive auto-save content
            
            // Calculate initial word count
            const words = noteText.trim().split(/\s+/).filter(word => word.length > 0);
            dispatch({ type: 'SET_WORD_COUNT', payload: words.length });
            console.log('EditorScreen: New note processed, title:', title);
          }
        }
      } catch (error) {
        console.error("Failed to process note:", error);
        dispatch({ type: 'SET_INITIAL_CONTENT', payload: '<p>Failed to load content. Please try again.</p>' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    processNote();
  }, [noteText, routeNoteId]);

  // OPTIMIZED: Simplified manual save with clear separation of concerns
  const handleSave = useCallback(async () => {
    if (!richText.current || !currentUser) return;
    
    try {
      dispatch({ type: 'SET_SAVING', payload: true });
      const html = await richText.current.getContentHtml();
      const textContent = html.replace(/<[^>]*>/g, '').trim();
      
      if (textContent.length === 0) {
        Alert.alert('Error', 'Please add some content before saving.');
        return;
      }
      
      const notesService = NotesService.getInstance();
      const isNewNote = !routeNoteId;
      
      if (isNewNote) {
        await createNewNote(notesService, html, textContent);
      } else {
        await updateExistingNote(html);
      }
      
      hapticService.success();
      const message = isNewNote ? 'Note saved successfully!' : 'Note updated successfully!';
      Alert.alert('Success', message, [
        {
          text: 'OK',
          onPress: isNewNote ? () => navigation.navigate('MainTabs', { screen: 'Library' }) : undefined
        }
      ]);
      
    } catch (error) {
      console.error('Save failed:', error);
      hapticService.error();
      Alert.alert('Error', 'Failed to save note. Please try again.');
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [routeNoteId, currentUser, noteTitle, selectedFolderId, originalText, navigation]);

  // Helper function for creating new notes
  const createNewNote = useCallback(async (notesService: any, html: string, textContent: string) => {
    const newNoteId = await notesService.saveNote(currentUser!.uid, {
      title: noteTitle,
      content: html,
      plainText: textContent,
      folderId: selectedFolderId,
      tone: 'professional',
      originalText: originalText || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: []
    });
    
    console.log('EditorScreen: New note created with ID:', newNoteId);
    dispatch({ type: 'SET_NOTE_ID', payload: newNoteId });
    
    // Update navigation params
    navigation.setParams({ 
      noteId: newNoteId,
      folderId: selectedFolderId 
    });
  }, [currentUser, noteTitle, selectedFolderId, originalText, navigation]);

  // Helper function for updating existing notes
  const updateExistingNote = useCallback(async (html: string) => {
    dispatch({ type: 'SET_CURRENT_CONTENT', payload: html });
    await manualSave();
  }, [manualSave]);

  const regenerateWithDifferentTone = async (newTone: string) => {
    if (!originalText) return;
    
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const request: AITransformationRequest = {
        text: originalText,
        tone: newTone as 'professional' | 'casual' | 'simplified',
      };
      
      const aiService = AIService.getInstance();
      const response = await aiService.transformTextToNote(request);
      
      const title = await aiService.generateNoteTitle(response.transformedText);
      dispatch({ type: 'SET_NOTE_TITLE', payload: title });
      shouldGenerateTitleRef.current = false; // Mark title as generated
      
      const htmlContent = response.transformedText
        .split('\n\n')
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
      
      if (richText.current) {
        richText.current.setContentHTML(htmlContent);
        dispatch({ type: 'SET_CURRENT_CONTENT', payload: htmlContent }); // Update adaptive auto-save content
        hapticService.success();
      }
    } catch (error) {
      console.error("Failed to regenerate content:", error);
      hapticService.error();
      Alert.alert('Error', 'Failed to regenerate content. Please try again.');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Folder selection handlers
  const handleFolderSelected = useCallback((folderId: string | null, folderName?: string) => {
    dispatch({ type: 'SET_SELECTED_FOLDER', payload: { id: folderId, name: folderName || 'Inbox' } });
    hapticService.light();
  }, []);

  // ENHANCED: Gemini 2.5 Flash Smart Content Assistance
  const handleGeminiSuggestion = useCallback(async (text: string) => {
    try {
      if (text.length < 50) return; // Only trigger for substantial content
      
      const aiService = AIService.getInstance();
      
      // Use existing generateNoteTitle for basic suggestions
      const plainText = text.replace(/<[^>]*>/g, '');
      if (plainText.length > 100) {
        const suggestion = await aiService.generateNoteTitle(plainText);
        
        if (suggestion && suggestion.length > 10) {
          dispatch({ 
            type: 'UPDATE_GEMINI_SUGGESTION', 
            payload: {
              currentSuggestion: suggestion,
              suggestionType: 'completion',
              confidence: 0.8,
              isActive: true
            }
          });
          
          // Update metrics
          dispatch({
            type: 'UPDATE_METRICS',
            payload: { geminiSuggestionsUsed: state.metrics.geminiSuggestionsUsed + 1 }
          });
        }
      }
    } catch (error) {
      console.error('Gemini suggestion error:', error);
    }
  }, [state.metrics.geminiSuggestionsUsed]);

  const acceptGeminiSuggestion = useCallback(() => {
    if (state.geminiAssistance.currentSuggestion && richText.current) {
      const currentContent = state.currentContent;
      const newContent = currentContent + state.geminiAssistance.currentSuggestion;
      
      richText.current.setContentHTML(newContent);
      dispatch({ type: 'SET_CURRENT_CONTENT', payload: newContent });
      dispatch({ 
        type: 'UPDATE_GEMINI_SUGGESTION', 
        payload: { currentSuggestion: '', isActive: false }
      });
      
      // Update acceptance rate
      const currentRate = state.metrics.aiAssistanceAcceptanceRate;
      const newRate = (currentRate + 1) / 2; // Simple moving average
      dispatch({
        type: 'UPDATE_METRICS',
        payload: { aiAssistanceAcceptanceRate: newRate }
      });
      
      hapticService.success();
    }
  }, [state.geminiAssistance.currentSuggestion, state.currentContent, state.metrics.aiAssistanceAcceptanceRate]);

  // ENHANCED: Analytics tracking functions
  const updateWritingAnalytics = useCallback((content: string) => {
    const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length;
    const now = new Date();
    const sessionDuration = (now.getTime() - state.writingAnalytics.sessionStartTime.getTime()) / 60000; // minutes
    
    dispatch({
      type: 'UPDATE_WRITING_ANALYTICS',
      payload: {
        wordsWritten: wordCount,
        keystrokesCount: state.writingAnalytics.keystrokesCount + 1,
        averageTypingSpeed: sessionDuration > 0 ? wordCount / sessionDuration : 0
      }
    });
  }, [state.writingAnalytics.sessionStartTime, state.writingAnalytics.keystrokesCount]);

  // ENHANCED: Pull-to-refresh functionality
  const onRefresh = useCallback(async () => {
    dispatch({ type: 'SET_REFRESHING', payload: true });
    
    try {
      // Refresh analytics and suggestions
      await Promise.all([
        handleGeminiSuggestion(state.currentContent),
        // Update session metrics
        new Promise(resolve => {
          dispatch({
            type: 'UPDATE_METRICS',
            payload: { totalEditorSessions: state.metrics.totalEditorSessions + 1 }
          });
          resolve(true);
        })
      ]);
      
      hapticService.success();
    } catch (error) {
      console.error('Refresh error:', error);
      hapticService.error();
    } finally {
      dispatch({ type: 'SET_REFRESHING', payload: false });
    }
  }, [state.currentContent, state.metrics.totalEditorSessions, handleGeminiSuggestion]);

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
    <>
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={noteTitle} titleStyle={[styles.headerTitle, { color: theme.colors.onSurface }]} />
        {(noteId || routeNoteId) && (
          <IconButton
            icon="history"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => navigation.navigate('VersionHistory', { 
              noteId: (noteId || routeNoteId)!, 
              noteTitle 
            })}
            style={{ marginRight: 8 }}
          />
        )}
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

      {/* Folder Selection */}
      <View style={[styles.folderSection, { backgroundColor: theme.colors.surface }]}>
        <Chip
          icon={selectedFolderId ? 'folder' : 'inbox'}
          onPress={() => dispatch({ type: 'TOGGLE_FOLDER_SELECTOR' })}
          style={[styles.folderChip, { backgroundColor: theme.colors.primaryContainer }]}
          textStyle={{ color: theme.colors.onPrimaryContainer }}
        >
          📁 {selectedFolderName}
        </Chip>
      </View>

      {/* Enhanced status bar with version tracking and word count */}
      <View style={[styles.statusBar, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={styles.statusLeft}>
          <View style={styles.statusSaveSection}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {isAutoSaving
                ? 'Auto-saving...'
                : lastSaved 
                  ? `Saved ${lastSaved.toLocaleTimeString()}`
                  : 'Not saved'
              }
            </Text>
            <Tooltip title={getNetworkStatusMessage()}>
              <IconButton
                icon={getNetworkIcon()}
                size={14}
                iconColor={getNetworkColor()}
                style={{ margin: 0, padding: 2, marginLeft: 8 }}
              />
            </Tooltip>
          </View>
          {lastVersioned && (
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
              Last version: {lastVersioned.toLocaleTimeString()}
            </Text>
          )}
        </View>
        <View style={styles.statusRight}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {wordCount} words
          </Text>
          {(noteId || routeNoteId) && (
            <IconButton
              icon="history"
              size={16}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={() => navigation.navigate('VersionHistory', { 
                noteId: (noteId || routeNoteId)!, 
                noteTitle 
              })}
              style={{ margin: 0, padding: 4 }}
            />
          )}
        </View>
      </View>

      {/* ENHANCED: Gemini Assistance Panel */}
      {showGeminiAssist && (
        <Surface style={[styles.assistancePanel, { backgroundColor: theme.colors.primaryContainer }]} elevation={2}>
          <View style={styles.assistanceHeader}>
            <View style={styles.assistanceTitle}>
              <IconButton 
                icon="sparkles" 
                size={20} 
                iconColor={theme.colors.primary}
                style={{ margin: 0 }}
              />
              <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer }}>
                Gemini Assistance
              </Text>
            </View>
            <IconButton
              icon="close"
              size={20}
              iconColor={theme.colors.onPrimaryContainer}
              onPress={() => dispatch({ type: 'TOGGLE_GEMINI_ASSIST' })}
              style={{ margin: 0 }}
            />
          </View>
          {geminiAssistance.isActive && geminiAssistance.currentSuggestion ? (
            <View style={styles.suggestionContent}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, marginBottom: 8 }}>
                {geminiAssistance.currentSuggestion}
              </Text>
              <View style={styles.suggestionActions}>
                <Button 
                  mode="contained-tonal" 
                  compact 
                  onPress={acceptGeminiSuggestion}
                  icon="check"
                >
                  Accept
                </Button>
                <Button 
                  mode="text" 
                  compact 
                  onPress={() => dispatch({ 
                    type: 'UPDATE_GEMINI_SUGGESTION', 
                    payload: { currentSuggestion: '', isActive: false }
                  })}
                >
                  Dismiss
                </Button>
              </View>
            </View>
          ) : (
            <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.7 }}>
              Continue writing to receive smart suggestions...
            </Text>
          )}
        </Surface>
      )}

      {/* ENHANCED: Analytics Panel */}
      {showAnalytics && (
        <Surface style={[styles.analyticsPanel, { backgroundColor: theme.colors.secondaryContainer }]} elevation={2}>
          <View style={styles.analyticsHeader}>
            <View style={styles.analyticsTitle}>
              <IconButton 
                icon="chart-line" 
                size={20} 
                iconColor={theme.colors.secondary}
                style={{ margin: 0 }}
              />
              <Text variant="titleSmall" style={{ color: theme.colors.onSecondaryContainer }}>
                Writing Analytics
              </Text>
            </View>
            <IconButton
              icon="close"
              size={20}
              iconColor={theme.colors.onSecondaryContainer}
              onPress={() => dispatch({ type: 'TOGGLE_ANALYTICS' })}
              style={{ margin: 0 }}
            />
          </View>
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsStat}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer, opacity: 0.7 }}>
                Session Words
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                {writingAnalytics.wordsWritten}
              </Text>
            </View>
            <View style={styles.analyticsStat}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer, opacity: 0.7 }}>
                Typing Speed
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                {Math.round(writingAnalytics.averageTypingSpeed)} WPM
              </Text>
            </View>
            <View style={styles.analyticsStat}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer, opacity: 0.7 }}>
                AI Suggestions
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                {metrics.geminiSuggestionsUsed}
              </Text>
            </View>
            <View style={styles.analyticsStat}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer, opacity: 0.7 }}>
                Acceptance Rate
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                {Math.round(metrics.aiAssistanceAcceptanceRate * 100)}%
              </Text>
            </View>
          </View>
        </Surface>
      )}

      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            title="Refreshing Gemini Assistance..."
          />
        }
      >
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <RichEditor
              ref={richText}
              style={styles.editor}
              initialContentHTML={initialContent}
              placeholder="Start writing your amazing notes..."
              editorInitializedCallback={() => {
                console.log('Editor fully initialized and ready!');
                dispatch({ type: 'SET_EDITOR_READY', payload: true });
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
                dispatch({ type: 'SET_CURRENT_CONTENT', payload: content });
                
                // Update word count on content change
                const textContent = content.replace(/<[^>]*>/g, '');
                const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
                dispatch({ type: 'SET_WORD_COUNT', payload: words.length });
                
                // ENHANCED: Update writing analytics
                updateWritingAnalytics(content);
                
                // ENHANCED: Trigger Gemini suggestions for substantial content
                if (geminiAssistance.isActive && textContent.length > 100) {
                  const debounceTimer = setTimeout(() => {
                    handleGeminiSuggestion(textContent);
                  }, 2000); // 2 second debounce
                  
                  return () => clearTimeout(debounceTimer);
                }
                
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
              onDismiss={() => dispatch({ type: 'TOGGLE_FONT_MENU' })}
              anchor={
                <Button 
                  mode="outlined" 
                  compact 
                  onPress={() => dispatch({ type: 'TOGGLE_FONT_MENU' })}
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
          </View>
          
          <Divider style={styles.toolbarDivider} />
          
          <View style={styles.toolbarGroup}>
            <Menu
              visible={showColorPicker}
              onDismiss={() => dispatch({ type: 'TOGGLE_COLOR_PICKER' })}
              anchor={
                <IconButton
                  icon="palette"
                  size={20}
                  iconColor={theme.colors.onSurface}
                  onPress={() => dispatch({ type: 'TOGGLE_COLOR_PICKER' })}
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
              onPress={() => dispatch({ type: 'TOGGLE_TABLE_MODAL' })}
              style={styles.toolbarButton}
            />
            <IconButton
              icon="link"
              size={20}
              iconColor={theme.colors.onSurface}
              onPress={() => dispatch({ type: 'TOGGLE_LINK_MODAL' })}
              style={styles.toolbarButton}
            />
            <Menu
              visible={showMoreMenu}
              onDismiss={() => dispatch({ type: 'TOGGLE_MORE_MENU' })}
              anchor={
                <IconButton
                  icon="dots-horizontal"
                  size={20}
                  iconColor={theme.colors.onSurface}
                  onPress={() => dispatch({ type: 'TOGGLE_MORE_MENU' })}
                  style={styles.toolbarButton}
                />
              }
            >
              <Menu.Item 
                onPress={executeBlockquote}
                title="Blockquote"
                leadingIcon="format-quote-close"
              />
              <Menu.Item 
                onPress={executeHorizontalRule}
                title="Horizontal Rule"
                leadingIcon="minus"
              />
              <Menu.Item 
                onPress={executeStrikethrough}
                title="Strikethrough"
                leadingIcon="format-strikethrough"
              />
            </Menu>
          </View>
          
          <Divider style={styles.toolbarDivider} />
          
          {/* ENHANCED: Gemini Assistance & Analytics Controls */}
          <View style={styles.toolbarGroup}>
            <IconButton
              icon="sparkles"
              size={20}
              iconColor={showGeminiAssist ? theme.colors.primary : theme.colors.onSurface}
              onPress={() => dispatch({ type: 'TOGGLE_GEMINI_ASSIST' })}
              style={[
                styles.toolbarButton,
                { backgroundColor: showGeminiAssist ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
            <IconButton
              icon="chart-line"
              size={20}
              iconColor={showAnalytics ? theme.colors.secondary : theme.colors.onSurface}
              onPress={() => dispatch({ type: 'TOGGLE_ANALYTICS' })}
              style={[
                styles.toolbarButton,
                { backgroundColor: showAnalytics ? theme.colors.secondaryContainer : 'transparent' }
              ]}
            />
          </View>
          
          <Divider style={styles.toolbarDivider} />
          
          <View style={styles.toolbarGroup}>
            <IconButton
              icon={showVoiceInput ? "microphone" : "microphone-outline"}
              size={20}
              iconColor={showVoiceInput ? theme.colors.primary : theme.colors.onSurface}
              onPress={toggleVoiceInput}
              style={[
                styles.toolbarButton,
                { backgroundColor: showVoiceInput ? theme.colors.primaryContainer : 'transparent' }
              ]}
            />
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

      {/* Voice Input Modal */}
      {showVoiceInput && (
        <Portal>
          <Modal
            visible={showVoiceInput}
            onDismiss={() => dispatch({ type: 'SET_VOICE_INPUT', payload: false })}
            contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
          >
            <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Voice Input
            </Text>
            <VoiceInput
              onTranscription={handleVoiceTranscription}
              onError={handleVoiceError}
              onSessionComplete={handleVoiceSessionComplete}
              disabled={false}
            />
          </Modal>
        </Portal>
      )}

      {/* Table Creation Modal */}
      <Portal>
        <Modal
          visible={showTableModal}
          onDismiss={() => dispatch({ type: 'TOGGLE_TABLE_MODAL' })}
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
                onChangeText={(text) => dispatch({ type: 'SET_TABLE_ROWS', payload: parseInt(text) || 2 })}
                keyboardType="numeric"
                style={styles.tableInput}
              />
            </View>
            
            <View style={styles.tableInputGroup}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Columns:</Text>
              <TextInput
                mode="outlined"
                value={tableCols.toString()}
                onChangeText={(text) => dispatch({ type: 'SET_TABLE_COLS', payload: parseInt(text) || 2 })}
                keyboardType="numeric"
                style={styles.tableInput}
              />
            </View>
          </View>
          
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => dispatch({ type: 'TOGGLE_TABLE_MODAL' })} style={styles.modalButton}>
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
          onDismiss={() => dispatch({ type: 'TOGGLE_LINK_MODAL' })}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            Insert Link
          </Text>
          
          <TextInput
            mode="outlined"
            label="Link Text"
            value={linkText}
            onChangeText={(text) => dispatch({ type: 'SET_LINK_TEXT', payload: text })}
            style={styles.linkInput}
          />
          
          <TextInput
            mode="outlined"
            label="URL"
            value={linkUrl}
            onChangeText={(text) => dispatch({ type: 'SET_LINK_URL', payload: text })}
            style={styles.linkInput}
            autoCapitalize="none"
          />
          
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => dispatch({ type: 'TOGGLE_LINK_MODAL' })} style={styles.modalButton}>
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

    {/* Folder Selector Modal */}
    <FolderSelector
      visible={showFolderSelector}
      onDismiss={() => dispatch({ type: 'TOGGLE_FOLDER_SELECTOR' })}
      onFolderSelected={handleFolderSelected}
      selectedFolderId={selectedFolderId}
      title="Select Folder for Note"
    />
    </>
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
  statusSaveSection: {
    flexDirection: 'row',
    alignItems: 'center',
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
  folderSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  folderChip: {
    alignSelf: 'flex-start',
  },
  // ENHANCED: Gemini Assistance Panel Styles
  assistancePanel: {
    margin: 8,
    marginBottom: 0,
    padding: 12,
    borderRadius: 8,
  },
  assistanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assistanceTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionContent: {
    paddingVertical: 8,
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  // ENHANCED: Analytics Panel Styles
  analyticsPanel: {
    margin: 8,
    marginTop: 0,
    marginBottom: 0,
    padding: 12,
    borderRadius: 8,
  },
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  analyticsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  analyticsStat: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 8,
  },
});
