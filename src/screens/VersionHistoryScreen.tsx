// src/screens/VersionHistoryScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Appbar,
  Card,
  Chip,
  useTheme,
  ActivityIndicator,
  Button,
  Text,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { NoteVersion } from '../types/versionHistory';
import { VersionHistoryService } from '../services/VersionHistoryService';
import type { VersionHistoryScreenNavigationProp, RootStackParamList } from '../types/navigation';

type VersionHistoryRouteProp = RouteProp<RootStackParamList, 'VersionHistory'>;

const VersionHistoryScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<VersionHistoryScreenNavigationProp>();
  const route = useRoute<VersionHistoryRouteProp>();

  const { noteId, noteTitle } = route.params;
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const versionService = VersionHistoryService.getInstance();

  // Utility function to strip HTML tags for preview
  const stripHtmlTags = (html: string): string => {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .trim(); // Remove leading/trailing whitespace
  };

  useEffect(() => {
    loadVersionHistory();
  }, []);

  const loadVersionHistory = async () => {
    try {
      const historyData = await versionService.getVersionHistory(noteId);
      setVersions(historyData);
    } catch (error) {
      console.error('Failed to load version history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVersionHistory();
    setRefreshing(false);
  };

  const handleRestoreVersion = (version: NoteVersion) => {
    Alert.alert(
      'Restore Version',
      `Are you sure you want to restore this version from ${formatDistanceToNow(
        version.createdAt
      )} ago? This will replace the current content.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await versionService.restoreVersion(
                noteId,
                version.id
              );
              if (success) {
                Alert.alert('Success', 'Version restored successfully');
                navigation.goBack();
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

  const handleViewVersion = (version: NoteVersion) => {
    navigation.navigate('VersionPreview', {
      noteId,
      versionId: version.id,
      noteTitle,
    });
  };

  const renderVersionItem = ({ item }: { item: NoteVersion }) => (
    <Card style={[styles.versionCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <View style={styles.versionHeader}>
          <View style={styles.versionInfo}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Version {item.version}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              {formatDistanceToNow(item.createdAt)} ago
            </Text>
          </View>
          <View style={styles.versionBadges}>
            {item.isAutoSave ? (
              <Chip mode="outlined" compact>
                Auto-saved
              </Chip>
            ) : (
              <Chip mode="outlined" compact textStyle={{ color: theme.colors.primary }}>
                Manual
              </Chip>
            )}
          </View>
        </View>

        <Text
          variant="bodyMedium"
          style={[styles.contentPreview, { color: theme.colors.onSurfaceVariant }]}
          numberOfLines={2}
        >
          {item.content 
            ? `${stripHtmlTags(item.content).substring(0, 100)}${stripHtmlTags(item.content).length > 100 ? '...' : ''}`
            : 'No content available'
          }
        </Text>

        <View style={styles.versionMeta}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {item.metadata.wordCount} words • {item.metadata.characterCount} characters
          </Text>
        </View>

        <View style={styles.versionActions}>
          <Button
            mode="outlined"
            onPress={() => handleViewVersion(item)}
            style={styles.actionButton}
          >
            Preview
          </Button>
          <Button
            mode="contained"
            onPress={() => handleRestoreVersion(item)}
            style={styles.actionButton}
          >
            Restore
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Version History" />
        </Appbar.Header>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content 
          title="Version History" 
          subtitle={noteTitle}
        />
      </Appbar.Header>

      {versions.length === 0 ? (
        <View style={[styles.container, styles.centered]}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            No version history available
          </Text>
        </View>
      ) : (
        <FlatList
          data={versions}
          renderItem={renderVersionItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  versionCard: {
    marginVertical: 4,
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  versionInfo: {
    flex: 1,
  },
  versionBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  contentPreview: {
    lineHeight: 20,
    marginVertical: 8,
  },
  versionMeta: {
    marginBottom: 12,
  },
  versionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  separator: {
    height: 8,
  },
});

export default VersionHistoryScreen;
