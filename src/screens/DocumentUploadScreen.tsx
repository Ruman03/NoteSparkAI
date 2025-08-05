// NoteSpark AI - Document Upload Screen
// Feature 1.2: Smart Document Upload System
// Drag-and-drop interface for PDF, DOCX, PPTX uploads

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
  Easing
} from 'react-native';
import {
  Surface,
  Text,
  useTheme,
  Button,
  Card,
  IconButton,
  ProgressBar,
  Chip
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import DocumentPicker from '@react-native-documents/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { hapticService } from '../services/HapticService';
import DocumentProcessor from '../services/DocumentProcessor';
import type { 
  RootStackParamList,
  DocumentFile, 
  SupportedDocumentType,
  UploadSession,
  DocumentUploadProgress 
} from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type DocumentUploadScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width, height } = Dimensions.get('window');

export default function DocumentUploadScreen() {
  const navigation = useNavigation<DocumentUploadScreenNavigationProp>();
  const theme = useTheme();
  const [uploadSessions, setUploadSessions] = useState<UploadSession[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<DocumentFile[]>([]);
  
  // Animation values
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const documentProcessor = DocumentProcessor.getInstance();
  const supportedTypes = DocumentProcessor.SUPPORTED_TYPES;

  // Animate upload area when files are being dragged
  const animateUploadArea = useCallback((isActive: boolean) => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isActive ? 1.05 : 1,
        useNativeDriver: true,
        tension: 200,
        friction: 8
      }),
      Animated.timing(fadeAnim, {
        toValue: isActive ? 0.8 : 1,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: true
      })
    ]).start();
  }, [scaleAnim, fadeAnim]);

  // Handle file selection
  const handleFilePicker = useCallback(async () => {
    try {
      hapticService.medium();
      
      const results = await DocumentPicker.pick({
        type: [
          DocumentPicker.types.pdf,
          DocumentPicker.types.doc,
          DocumentPicker.types.docx,
          DocumentPicker.types.ppt,
          DocumentPicker.types.pptx,
          DocumentPicker.types.plainText
        ],
        allowMultiSelection: true,
        copyTo: 'documentDirectory'
      });

      const files: DocumentFile[] = results.map((result: any) => ({
        uri: result.copyTo || result.uri,
        name: result.name || 'Unknown File',
        type: result.type || 'application/octet-stream',
        size: result.size || 0,
        lastModified: Date.now()
      }));

      setSelectedFiles(files);
      
      // Auto-process if single file
      if (files.length === 1) {
        await processFiles(files);
      }

    } catch (error: any) {
      if (error?.code === 'DOCUMENT_PICKER_CANCELED') {
        console.log('User cancelled file picker');
      } else {
        console.error('DocumentPicker Error:', error);
        Alert.alert('Error', 'Failed to select files. Please try again.');
      }
    }
  }, []);

  // Process selected files
  const processFiles = useCallback(async (files: DocumentFile[]) => {
    const newSessions: UploadSession[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      progress: {
        phase: 'uploading',
        percentage: 0,
        message: 'Starting upload...'
      },
      startedAt: new Date()
    }));

    setUploadSessions(prev => [...prev, ...newSessions]);
    setSelectedFiles([]);

    // Process each file
    for (const session of newSessions) {
      try {
        const result = await documentProcessor.processDocument(
          session.file,
          documentProcessor.getDefaultOptions(),
          (progress: DocumentUploadProgress) => {
            setUploadSessions(prev => prev.map(s => 
              s.id === session.id 
                ? { ...s, progress }
                : s
            ));
          }
        );

        // Update session with result
        setUploadSessions(prev => prev.map(s => 
          s.id === session.id 
            ? { 
                ...s, 
                result, 
                completedAt: new Date(),
                progress: {
                  phase: 'complete',
                  percentage: 100,
                  message: 'Processing complete!'
                }
              }
            : s
        ));

        // Navigate to preview after a short delay
        setTimeout(() => {
          const completedSession = { ...session, result, completedAt: new Date() };
          navigation.navigate('DocumentPreview', { uploadSession: completedSession });
        }, 1000);

      } catch (error) {
        console.error('File processing error:', error);
        
        setUploadSessions(prev => prev.map(s => 
          s.id === session.id 
            ? { 
                ...s, 
                error: error instanceof Error ? error.message : 'Processing failed',
                progress: {
                  phase: 'error',
                  percentage: 0,
                  message: error instanceof Error ? error.message : 'Processing failed'
                }
              }
            : s
        ));
      }
    }
  }, [documentProcessor, navigation]);

  // Remove file from selection
  const removeSelectedFile = useCallback((index: number) => {
    hapticService.light();
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Retry failed upload
  const retryUpload = useCallback(async (sessionId: string) => {
    const session = uploadSessions.find(s => s.id === sessionId);
    if (!session) return;

    await processFiles([session.file]);
  }, [uploadSessions, processFiles]);

  // Remove upload session
  const removeSession = useCallback((sessionId: string) => {
    hapticService.light();
    setUploadSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  // Render supported file type card
  const renderFileTypeCard = (type: SupportedDocumentType) => (
    <Surface
      key={type.extension}
      style={[styles.fileTypeCard, { backgroundColor: theme.colors.surfaceVariant }]}
      elevation={1}
    >
      <Icon 
        name={type.icon} 
        size={32} 
        color={theme.colors.primary}
        style={styles.fileTypeIcon}
      />
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
        {type.extension.toUpperCase()}
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7, textAlign: 'center' }}>
        {type.displayName}
      </Text>
    </Surface>
  );

  // Render upload progress
  const renderUploadProgress = (session: UploadSession) => (
    <Card key={session.id} style={styles.progressCard}>
      <Card.Content style={styles.progressContent}>
        <View style={styles.progressHeader}>
          <View style={styles.progressInfo}>
            <Text variant="titleSmall" numberOfLines={1}>
              {session.file.name}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {DocumentProcessor.formatFileSize(session.file.size)} • {session.progress.message}
            </Text>
          </View>
          <IconButton
            icon="close"
            size={20}
            onPress={() => removeSession(session.id)}
          />
        </View>
        
        {session.error ? (
          <View style={styles.errorContainer}>
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
              {session.error}
            </Text>
            <Button 
              mode="outlined" 
              onPress={() => retryUpload(session.id)}
              style={styles.retryButton}
            >
              Retry
            </Button>
          </View>
        ) : (
          <ProgressBar 
            progress={session.progress.percentage / 100} 
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        )}
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text variant="headlineSmall" style={styles.title}>
            Upload Document
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Main Upload Area */}
        <Animated.View
          style={[
            styles.uploadContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim
            }
          ]}
        >
          <Surface
            style={[
              styles.uploadArea,
              { 
                backgroundColor: theme.colors.primaryContainer,
                borderColor: dragActive ? theme.colors.primary : 'transparent'
              }
            ]}
            elevation={dragActive ? 4 : 2}
          >
            <TouchableOpacity
              style={styles.uploadTouchable}
              onPress={handleFilePicker}
              activeOpacity={0.8}
            >
              <Icon 
                name="cloud-upload" 
                size={64} 
                color={theme.colors.onPrimaryContainer}
                style={styles.uploadIcon}
              />
              <Text 
                variant="headlineSmall" 
                style={[styles.uploadTitle, { color: theme.colors.onPrimaryContainer }]}
              >
                Upload Documents
              </Text>
              <Text 
                variant="bodyLarge" 
                style={[styles.uploadSubtitle, { color: theme.colors.onPrimaryContainer, opacity: 0.8 }]}
              >
                Tap to select or drag files here
              </Text>
              <Text 
                variant="bodyMedium" 
                style={[styles.uploadHint, { color: theme.colors.onPrimaryContainer, opacity: 0.6 }]}
              >
                Support for PDF, Word, PowerPoint, and text files
              </Text>
            </TouchableOpacity>
          </Surface>
        </Animated.View>

        {/* Supported File Types */}
        <View style={styles.supportedTypesContainer}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Supported Formats
          </Text>
          <View style={styles.fileTypesGrid}>
            {supportedTypes.slice(0, 6).map(renderFileTypeCard)}
          </View>
        </View>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <View style={styles.selectedFilesContainer}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Selected Files ({selectedFiles.length})
            </Text>
            {selectedFiles.map((file, index) => (
              <Card key={index} style={styles.selectedFileCard}>
                <Card.Content style={styles.selectedFileContent}>
                  <Icon 
                    name={DocumentProcessor.getFileIcon(file.type)} 
                    size={24} 
                    color={theme.colors.primary}
                  />
                  <View style={styles.selectedFileInfo}>
                    <Text variant="titleSmall" numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {DocumentProcessor.formatFileSize(file.size)}
                    </Text>
                  </View>
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={() => removeSelectedFile(index)}
                  />
                </Card.Content>
              </Card>
            ))}
            <Button
              mode="contained"
              onPress={() => processFiles(selectedFiles)}
              style={styles.processButton}
              disabled={selectedFiles.length === 0}
            >
              Process {selectedFiles.length} {selectedFiles.length === 1 ? 'File' : 'Files'}
            </Button>
          </View>
        )}

        {/* Upload Progress */}
        {uploadSessions.length > 0 && (
          <View style={styles.progressContainer}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Processing Files
            </Text>
            {uploadSessions.map(renderUploadProgress)}
          </View>
        )}

        {/* Features Info */}
        <View style={styles.featuresContainer}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            What happens next?
          </Text>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Icon name="file-search" size={24} color={theme.colors.primary} />
              <Text variant="bodyMedium" style={{ flex: 1, marginLeft: 12, color: theme.colors.onSurface }}>
                Intelligent text extraction with content analysis
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="tag-multiple" size={24} color={theme.colors.primary} />
              <Text variant="bodyMedium" style={{ flex: 1, marginLeft: 12, color: theme.colors.onSurface }}>
                Automatic tagging and categorization
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="format-text" size={24} color={theme.colors.primary} />
              <Text variant="bodyMedium" style={{ flex: 1, marginLeft: 12, color: theme.colors.onSurface }}>
                AI-powered formatting and structure enhancement
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="brain" size={24} color={theme.colors.primary} />
              <Text variant="bodyMedium" style={{ flex: 1, marginLeft: 12, color: theme.colors.onSurface }}>
                Smart note creation with your preferred tone
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontWeight: 'bold',
  },
  uploadContainer: {
    marginBottom: 32,
  },
  uploadArea: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  uploadTouchable: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  uploadIcon: {
    marginBottom: 16,
  },
  uploadTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadSubtitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadHint: {
    textAlign: 'center',
  },
  supportedTypesContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  fileTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fileTypeCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: (width - 64) / 3,
    flex: 1,
  },
  fileTypeIcon: {
    marginBottom: 8,
  },
  selectedFilesContainer: {
    marginBottom: 32,
  },
  selectedFileCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  selectedFileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  selectedFileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  processButton: {
    marginTop: 16,
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  progressContent: {
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  progressInfo: {
    flex: 1,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  retryButton: {
    marginLeft: 12,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
