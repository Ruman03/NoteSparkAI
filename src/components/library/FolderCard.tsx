import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Card, Text, Avatar, useTheme, IconButton, Badge } from 'react-native-paper';
import type { Folder } from '../../types/folders';
import { useFolders } from '../../contexts/FolderContext';
import { formatDate } from '../../utils/ui';

const { width } = Dimensions.get('window');

interface FolderCardProps {
  folder: Folder;
  viewMode: 'list' | 'grid';
  onPress: (folder: Folder) => void;
  onShowActions?: (folder: Folder) => void;
}

const FolderCard: React.FC<FolderCardProps> = ({ 
  folder, 
  viewMode, 
  onPress, 
  onShowActions 
}) => {
  const theme = useTheme();
  const { getFolderStats } = useFolders();
  const [noteCount, setNoteCount] = useState(folder.noteCount || 0);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const isGridView = viewMode === 'grid';
  const cardWidth = isGridView ? (width - 48) / 2 : width - 32;

  // Load folder stats
  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const stats = await getFolderStats(folder.id);
        if (stats) {
          setNoteCount(stats.totalNotes);
          setLastActivity(stats.lastActivity);
        }
      } catch (error) {
        console.error('Error loading folder stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [folder.id, getFolderStats]);

  const getFolderDescription = () => {
    if (folder.description) return folder.description;
    if (noteCount === 0) return 'No notes yet';
    if (noteCount === 1) return '1 note';
    return `${noteCount} notes`;
  };

  const getLastActivityText = () => {
    if (!lastActivity) return 'No recent activity';
    return `Updated ${formatDate(lastActivity)}`;
  };

  return (
    <TouchableOpacity 
      onPress={() => onPress(folder)} 
      activeOpacity={0.7}
      style={styles.touchableContainer}
    >
      <Card 
        style={[
          styles.folderCard, 
          { 
            backgroundColor: theme.colors.surface, 
            width: cardWidth,
            borderLeftColor: folder.color,
            borderLeftWidth: 4,
          },
          isGridView && styles.gridFolderCard
        ]} 
        elevation={isGridView ? 2 : 3}
      >
        <Card.Content style={[styles.folderContent, isGridView && styles.gridFolderContent]}>
          {/* Note count badge */}
          {noteCount > 0 && (
            <View style={styles.badgeContainer}>
              <Badge 
                size={isGridView ? 20 : 24}
                style={{ 
                  backgroundColor: folder.color,
                  color: theme.colors.onPrimary 
                }}
              >
                {noteCount > 99 ? '99+' : noteCount}
              </Badge>
            </View>
          )}

          <View style={[styles.folderHeader, isGridView && styles.gridFolderHeader]}>
            <View style={styles.folderHeaderLeft}>
              <Avatar.Icon
                size={isGridView ? 40 : 56}
                icon={folder.icon}
                style={{ 
                  backgroundColor: folder.color + '20',
                  borderWidth: 2,
                  borderColor: folder.color + '40'
                }}
                color={folder.color}
              />
              <View style={styles.folderTitleContainer}>
                <Text 
                  variant={isGridView ? "titleMedium" : "titleLarge"} 
                  style={[styles.folderTitle, { color: theme.colors.onSurface }]} 
                  numberOfLines={isGridView ? 2 : 1}
                >
                  {folder.name}
                </Text>
                {!isGridView && (
                  <Text 
                    variant="bodySmall" 
                    style={[styles.folderDescription, { color: theme.colors.onSurfaceVariant }]}
                    numberOfLines={1}
                  >
                    {getFolderDescription()}
                  </Text>
                )}
              </View>
            </View>
            
            {!isGridView && onShowActions && (
              <IconButton
                icon="dots-vertical"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={() => onShowActions(folder)}
                style={styles.menuButton}
              />
            )}
          </View>

          {/* Grid view description and activity */}
          {isGridView && (
            <View style={styles.gridInfo}>
              <Text 
                variant="bodySmall" 
                style={[styles.gridDescription, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={2}
              >
                {getFolderDescription()}
              </Text>
              
              <View style={styles.gridFooter}>
                <Text 
                  variant="labelSmall" 
                  style={[styles.gridActivity, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {getLastActivityText()}
                </Text>
                
                {onShowActions && (
                  <IconButton
                    icon="dots-vertical"
                    size={16}
                    iconColor={theme.colors.onSurfaceVariant}
                    onPress={() => onShowActions(folder)}
                    style={styles.gridMenuButton}
                  />
                )}
              </View>
            </View>
          )}

          {/* List view activity */}
          {!isGridView && (
            <View style={styles.listFooter}>
              <Text 
                variant="bodySmall" 
                style={[styles.lastActivity, { color: theme.colors.onSurfaceVariant }]}
              >
                {getLastActivityText()}
              </Text>
              
              {folder.isDefault && (
                <View style={[styles.systemBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Text 
                    variant="labelSmall"
                    style={[styles.systemBadgeText, { color: theme.colors.onPrimaryContainer }]}
                  >
                    System
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchableContainer: {
    marginHorizontal: 4,
    marginVertical: 2,
  },
  folderCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  folderContent: {
    padding: 16,
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  folderHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  folderTitleContainer: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },
  folderTitle: {
    fontWeight: 'bold',
    lineHeight: 24,
    marginBottom: 2,
  },
  folderDescription: {
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 16,
  },
  menuButton: {
    margin: 0,
    marginTop: -8,
  },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  lastActivity: {
    fontSize: 12,
    opacity: 0.7,
    flex: 1,
  },
  systemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  systemBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  // Grid specific styles
  gridFolderCard: {
    marginHorizontal: 6,
    marginVertical: 6,
  },
  gridFolderContent: {
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  gridFolderHeader: {
    marginBottom: 8,
  },
  gridInfo: {
    marginTop: 4,
  },
  gridDescription: {
    lineHeight: 16,
    marginBottom: 8,
    minHeight: 32,
  },
  gridFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  gridActivity: {
    flex: 1,
    fontSize: 10,
    opacity: 0.7,
    lineHeight: 12,
  },
  gridMenuButton: {
    margin: 0,
    padding: 0,
    width: 20,
    height: 20,
  },
});

export default FolderCard;
