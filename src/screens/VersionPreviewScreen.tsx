// src/screens/VersionPreviewScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Appbar,
  Card,
  Button,
  useTheme,
  SegmentedButtons,
  Divider,
  Text,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { formatDistanceToNow, format } from 'date-fns';
import { NoteVersion } from '../types/versionHistory';
import { VersionHistoryService } from '../services/VersionHistoryService';
import type { VersionPreviewScreenNavigationProp, RootStackParamList } from '../types/navigation';

type VersionPreviewRouteProp = RouteProp<RootStackParamList, 'VersionPreview'>;

const VersionPreviewScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<VersionPreviewScreenNavigationProp>();
  const route = useRoute<VersionPreviewRouteProp>();

  const { noteId, versionId, noteTitle } = route.params;
  const [version, setVersion] = useState<NoteVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'version' | 'comparison'>('version');
  const versionService = VersionHistoryService.getInstance();

  useEffect(() => {
    loadVersionData();
  }, [noteId, versionId]);

  const loadVersionData = async () => {
    try {
      setLoading(true);
      const versions = await versionService.getVersionHistory(noteId);
      const foundVersion = versions.find(v => v.id === versionId);
      if (foundVersion) {
        setVersion(foundVersion);
      } else {
        Alert.alert('Error', 'Version not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading version:', error);
      Alert.alert('Error', 'Failed to load version');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Generate HTML for WebView display
  const generateWebViewHTML = (content: string, isDark: boolean = false) => {
    const backgroundColor = isDark ? '#1E293B' : '#FFFFFF';
    const textColor = isDark ? '#F1F5F9' : '#1E293B';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              background-color: ${backgroundColor} !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 16px;
              line-height: 1.6;
              color: ${textColor};
              background-color: ${backgroundColor} !important;
              padding: 16px;
              word-wrap: break-word;
              overflow-wrap: break-word;
              min-height: 100vh;
            }
            * {
              max-width: 100%;
              background-color: transparent !important;
            }
            img {
              width: 100%;
              height: auto;
            }
            pre {
              background-color: ${isDark ? '#334155' : '#F8FAFC'} !important;
              padding: 12px;
              border-radius: 8px;
              overflow-x: auto;
            }
            code {
              background-color: ${isDark ? '#334155' : '#F8FAFC'} !important;
              padding: 2px 4px;
              border-radius: 4px;
            }
            blockquote {
              border-left: 4px solid #6366F1;
              margin: 16px 0;
              padding-left: 16px;
              font-style: italic;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 16px 0;
            }
            th, td {
              border: 1px solid ${isDark ? '#475569' : '#E2E8F0'};
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: ${isDark ? '#334155' : '#F8FAFC'} !important;
              font-weight: bold;
            }
            .placeholder {
              color: ${isDark ? '#94A3B8' : '#64748B'};
              font-style: italic;
              text-align: center;
              padding: 40px 20px;
            }
            /* Force background colors for all elements */
            div, p, span, h1, h2, h3, h4, h5, h6, ul, ol, li {
              background-color: transparent !important;
            }
          </style>
        </head>
        <body>
          ${content || '<div class="placeholder">No content available</div>'}
        </body>
      </html>
    `;
  };

  const handleRestore = () => {
    if (!version) return;

    Alert.alert(
      'Restore Version',
      `Are you sure you want to restore this version? This will replace the current content.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await versionService.restoreVersion(
                version.noteId,
                version.id
              );
              if (success) {
                Alert.alert('Success', 'Version restored successfully', [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.navigate('Editor', { 
                        noteId: version.noteId,
                        noteText: version.content,
                        tone: 'professional' as const,
                        noteTitle: noteTitle,
                      });
                    },
                  },
                ]);
              } else {
                Alert.alert('Error', 'Failed to restore version');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to restore version');
            }
          },
        },
      ]
    );
  };

  const renderVersionInfo = () => {
    if (!version) return null;

    return (
      <Card style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            Version {version.version}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            {format(version.createdAt, 'PPpp')}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
            {formatDistanceToNow(version.createdAt)} ago
          </Text>

          <View style={styles.metadataContainer}>
            <View style={styles.metadataItem}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Words
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                {version.metadata.wordCount}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Characters
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                {version.metadata.characterCount}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Size
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                {(version.size / 1024).toFixed(1)} KB
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderContent = () => {
    if (!version) return null;

    return (
      <Card style={[styles.contentCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface, marginBottom: 12 }}>
            Content
          </Text>
          {version.content ? (
            <WebView
              source={{ 
                html: generateWebViewHTML(version.content, theme.dark) 
              }}
              style={styles.webView}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              showsHorizontalScrollIndicator={false}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              )}
              onError={(error) => {
                console.error('WebView error:', error);
              }}
              // Security settings
              originWhitelist={['*']}
              javaScriptEnabled={false}
              domStorageEnabled={false}
              allowsInlineMediaPlayback={false}
              mediaPlaybackRequiresUserAction={true}
              // Background color to match theme
              backgroundColor={theme.dark ? '#1E293B' : '#FFFFFF'}
              opacity={0.99} // Slight opacity to force background rendering
            />
          ) : (
            <View style={styles.emptyContent}>
              <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
                No content available
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Loading..." />
        </Appbar.Header>
        <ActivityIndicator size="large" style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!version) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Version Not Found" />
        </Appbar.Header>
        <Text variant="bodyLarge" style={{ textAlign: 'center', marginTop: 100 }}>
          Version not found
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content 
          title={`Version ${version.version}`}
          subtitle={noteTitle}
        />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {renderVersionInfo()}
        {renderContent()}
      </ScrollView>

      <View style={[styles.actionContainer, { backgroundColor: theme.colors.surface }]}>
        <Button
          mode="contained"
          onPress={handleRestore}
          style={styles.restoreButton}
          icon="restore"
        >
          Restore This Version
        </Button>
      </View>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    marginBottom: 16,
    elevation: 2,
  },
  contentCard: {
    marginBottom: 100, // Space for action container
    elevation: 2,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  metadataItem: {
    alignItems: 'center',
  },
  contentScrollView: {
    maxHeight: 400,
  },
  webView: {
    flex: 1,
    minHeight: 300,
    backgroundColor: 'transparent',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  emptyContent: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
    opacity: 0.6,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 8,
  },
  restoreButton: {
    width: '100%',
  },
});

export default VersionPreviewScreen;
