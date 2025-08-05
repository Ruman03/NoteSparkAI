// NoteSpark AI - Document Preview Screen
// Feature 1.2: Smart Document Upload System
// Preview extracted content before tone selection

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions
} from 'react-native';
import {
  Surface,
  Text,
  useTheme,
  Button,
  Card,
  IconButton,
  Chip,
  Divider
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { hapticService } from '../services/HapticService';
import DocumentProcessor from '../services/DocumentProcessor';
import type { 
  RootStackParamList,
  UploadSession,
  DocumentMetadata 
} from '../types';
import type { 
  NativeStackNavigationProp,
  NativeStackScreenProps 
} from '@react-navigation/native-stack';

type DocumentPreviewScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type DocumentPreviewScreenProps = NativeStackScreenProps<RootStackParamList, 'DocumentPreview'>;

const { width } = Dimensions.get('window');

export default function DocumentPreviewScreen() {
  const navigation = useNavigation<DocumentPreviewScreenNavigationProp>();
  const route = useRoute<DocumentPreviewScreenProps['route']>();
  const theme = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);

  const { uploadSession } = route.params;
  const { file, result } = uploadSession;

  useEffect(() => {
    if (!result) {
      Alert.alert(
        'Error',
        'No processing result available. Please try uploading the file again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [result, navigation]);

  if (!result) {
    return null; // Will navigate back due to useEffect
  }

  const handleContinueToToneSelection = () => {
    hapticService.medium();
    setIsProcessing(true);

    // Navigate to tone selection with document data
    navigation.navigate('ToneSelection', {
      documentText: result.extractedText,
      documentMetadata: result.metadata,
      isDocumentUpload: true
    });
  };

  const handleRetry = () => {
    hapticService.light();
    navigation.goBack();
  };

  const renderMetadataCard = (metadata: DocumentMetadata) => (
    <Card style={styles.metadataCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>
          Document Information
        </Text>
        <View style={styles.metadataGrid}>
          <View style={styles.metadataItem}>
            <Icon name="file" size={20} color={theme.colors.primary} />
            <View style={styles.metadataText}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                File Name
              </Text>
              <Text variant="bodyMedium">
                {metadata.title || file.name}
              </Text>
            </View>
          </View>

          <View style={styles.metadataItem}>
            <Icon name="file-outline" size={20} color={theme.colors.primary} />
            <View style={styles.metadataText}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                File Size
              </Text>
              <Text variant="bodyMedium">
                {DocumentProcessor.formatFileSize(metadata.fileSize)}
              </Text>
            </View>
          </View>

          {metadata.wordCount !== undefined && (
            <View style={styles.metadataItem}>
              <Icon name="format-text" size={20} color={theme.colors.primary} />
              <View style={styles.metadataText}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Word Count
                </Text>
                <Text variant="bodyMedium">
                  {metadata.wordCount.toLocaleString()} words
                </Text>
              </View>
            </View>
          )}

          {metadata.pageCount !== undefined && (
            <View style={styles.metadataItem}>
              <Icon name="file-multiple" size={20} color={theme.colors.primary} />
              <View style={styles.metadataText}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Estimated Pages
                </Text>
                <Text variant="bodyMedium">
                  {metadata.pageCount} {metadata.pageCount === 1 ? 'page' : 'pages'}
                </Text>
              </View>
            </View>
          )}

          {metadata.author && (
            <View style={styles.metadataItem}>
              <Icon name="account" size={20} color={theme.colors.primary} />
              <View style={styles.metadataText}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Author
                </Text>
                <Text variant="bodyMedium">
                  {metadata.author}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const renderTagsCard = () => {
    if (!result.tags || result.tags.length === 0) return null;

    return (
      <Card style={styles.tagsCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Auto-Generated Tags
          </Text>
          <View style={styles.tagsContainer}>
            {result.tags.map((tag, index) => (
              <Chip 
                key={index} 
                icon="tag"
                style={styles.tag}
                textStyle={{ color: theme.colors.onSecondaryContainer }}
                mode="outlined"
              >
                {tag}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderContentPreview = () => (
    <Card style={styles.contentCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitle}>
          Extracted Content Preview
        </Text>
        <ScrollView 
          style={styles.contentPreview}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          <Text variant="bodyMedium" style={styles.contentText}>
            {result.extractedText.length > 2000 
              ? result.extractedText.substring(0, 2000) + '...\n\n[Content continues...]'
              : result.extractedText
            }
          </Text>
        </ScrollView>
      </Card.Content>
    </Card>
  );

  const renderStructureInfo = () => {
    if (!result.structure) return null;

    const { headings, paragraphs, lists } = result.structure;
    const totalElements = headings.length + paragraphs.length + lists.length;

    if (totalElements === 0) return null;

    return (
      <Card style={styles.structureCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Document Structure
          </Text>
          <View style={styles.structureStats}>
            {headings.length > 0 && (
              <View style={styles.structureStat}>
                <Icon name="format-header-1" size={16} color={theme.colors.primary} />
                <Text variant="bodySmall" style={{ marginLeft: 4 }}>
                  {headings.length} {headings.length === 1 ? 'heading' : 'headings'}
                </Text>
              </View>
            )}
            {paragraphs.length > 0 && (
              <View style={styles.structureStat}>
                <Icon name="format-paragraph" size={16} color={theme.colors.primary} />
                <Text variant="bodySmall" style={{ marginLeft: 4 }}>
                  {paragraphs.length} {paragraphs.length === 1 ? 'paragraph' : 'paragraphs'}
                </Text>
              </View>
            )}
            {lists.length > 0 && (
              <View style={styles.structureStat}>
                <Icon name="format-list-bulleted" size={16} color={theme.colors.primary} />
                <Text variant="bodySmall" style={{ marginLeft: 4 }}>
                  {lists.length} {lists.length === 1 ? 'list' : 'lists'}
                </Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <Text variant="headlineSmall" style={styles.title}>
          Document Preview
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Message */}
        <Surface 
          style={[styles.successBanner, { backgroundColor: theme.colors.primaryContainer }]} 
          elevation={1}
        >
          <Icon name="check-circle" size={24} color={theme.colors.onPrimaryContainer} />
          <Text 
            variant="titleSmall" 
            style={[styles.successText, { color: theme.colors.onPrimaryContainer }]}
          >
            Document processed successfully!
          </Text>
        </Surface>

        {/* Document Metadata */}
        {renderMetadataCard(result.metadata)}

        {/* Document Structure */}
        {renderStructureInfo()}

        {/* Auto-Generated Tags */}
        {renderTagsCard()}

        {/* Content Preview */}
        {renderContentPreview()}

        {/* Summary */}
        {result.summary && (
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Quick Summary
              </Text>
              <Text variant="bodyMedium" style={styles.summaryText}>
                {result.summary}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Button
            mode="contained"
            onPress={handleContinueToToneSelection}
            style={styles.continueButton}
            loading={isProcessing}
            disabled={isProcessing}
            icon="arrow-right"
          >
            {isProcessing ? 'Processing...' : 'Continue to Tone Selection'}
          </Button>
          
          <Button
            mode="outlined"
            onPress={handleRetry}
            style={styles.retryButton}
            disabled={isProcessing}
          >
            Upload Different File
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  successText: {
    marginLeft: 12,
    fontWeight: '600',
  },
  metadataCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  metadataGrid: {
    gap: 16,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metadataText: {
    marginLeft: 12,
    flex: 1,
  },
  structureCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  structureStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  structureStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagsCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    marginRight: 0,
  },
  contentCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  contentPreview: {
    maxHeight: 300,
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  contentText: {
    lineHeight: 22,
  },
  summaryCard: {
    marginBottom: 24,
    borderRadius: 12,
  },
  summaryText: {
    lineHeight: 22,
    fontStyle: 'italic',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  continueButton: {
    paddingVertical: 8,
  },
  retryButton: {
    paddingVertical: 8,
  },
});
