import React from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Card, Text, Avatar, Chip, IconButton, useTheme } from 'react-native-paper';
import type { Note } from '../../types';
import { formatDate, getToneColor, getToneIcon } from '../../utils/ui';

const { width } = Dimensions.get('window');

interface NoteCardProps {
  note: Note;
  viewMode: 'list' | 'grid';
  onPress: (note: Note) => void;
  onShowActions?: (note: Note) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, viewMode, onPress, onShowActions }) => {
  const theme = useTheme();
  const isGridView = viewMode === 'grid';
  const cardWidth = isGridView ? (width - 48) / 2 : width - 32;

  // Determine note source type
  const getNoteSourceIcon = () => {
    if (note.sourceImageUrl) return 'camera';
    if (note.originalText && note.originalText.length > note.content.length) return 'file-document';
    return 'pencil';
  };

  const getNoteSourceColor = () => {
    if (note.sourceImageUrl) return theme.colors.secondary;
    if (note.originalText && note.originalText.length > note.content.length) return theme.colors.tertiary;
    return theme.colors.primary;
  };

  return (
    <TouchableOpacity onPress={() => onPress(note)} activeOpacity={0.7}>
      <Card 
        style={[
          styles.noteCard, 
          { backgroundColor: theme.colors.surface, width: cardWidth },
          isGridView && styles.gridNoteCard
        ]} 
        elevation={3}
      >
        <Card.Content style={[styles.noteContent, isGridView && styles.gridNoteContent]}>
          {/* Note Source Type Indicator */}
          <View style={styles.sourceTypeIndicator}>
            <Avatar.Icon
              size={24}
              icon={getNoteSourceIcon()}
              style={{ 
                backgroundColor: getNoteSourceColor() + '20',
                borderWidth: 1,
                borderColor: getNoteSourceColor() + '40'
              }}
              color={getNoteSourceColor()}
            />
          </View>

          <View style={[styles.noteHeader, isGridView && styles.gridNoteHeader]}>
            <View style={styles.noteHeaderLeft}>
              <Avatar.Icon
                size={isGridView ? 36 : 48}
                icon={getToneIcon(note.tone)}
                style={{ backgroundColor: getToneColor(note.tone, theme) + '20' }}
                color={getToneColor(note.tone, theme)}
              />
              <View style={styles.noteTitleContainer}>
                <Text 
                  variant={isGridView ? "titleSmall" : "titleMedium"} 
                  style={[styles.noteTitle, { color: theme.colors.onSurface }]} 
                  numberOfLines={isGridView ? 3 : 2}
                >
                  {note.title || 'Untitled Note'}
                </Text>
                {!isGridView && (
                  <Text 
                    variant="bodySmall" 
                    style={[styles.noteDate, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {note.updatedAt ? formatDate(new Date(note.updatedAt)) : 'Unknown date'} • {(note.plainText || '').split(' ').filter(word => word.length > 0).length} words
                  </Text>
                )}
              </View>
            </View>
            {!isGridView && (
              <IconButton
                icon="dots-vertical"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={() => onShowActions?.(note)}
                style={styles.menuButton}
              />
            )}
          </View>

          <Text 
            variant="bodyMedium" 
            style={[styles.notePreview, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={isGridView ? 2 : 3}
          >
            {note.plainText || 'No content available'}
          </Text>

          <View style={[styles.noteFooter, isGridView && styles.gridNoteFooter]}>
            <Chip
              icon={getToneIcon(note.tone)}
              style={[
                styles.toneChip, 
                isGridView && styles.gridToneChip,
                { backgroundColor: getToneColor(note.tone, theme) + '15' }
              ]}
              textStyle={{ 
                color: getToneColor(note.tone, theme), 
                fontSize: isGridView ? 12 : 12, 
                fontWeight: '600'
              }}
              compact={!isGridView}
            >
              {note.tone || 'unknown'}
            </Chip>
            
            {isGridView && (
              <Text 
                variant="labelSmall" 
                style={[styles.gridNoteDate, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {note.updatedAt ? formatDate(new Date(note.updatedAt)) : 'Unknown date'}
              </Text>
            )}
            
            {!isGridView && note.tags && note.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {note.tags.slice(0, 2).map((tag, tagIndex) => (
                  <Chip
                    key={tagIndex}
                    style={[styles.tagChip, { backgroundColor: theme.colors.primaryContainer }]}
                    textStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 10 }}
                    compact
                  >
                    #{tag}
                  </Chip>
                ))}
                {note.tags.length > 2 && (
                  <Text style={[styles.moreTagsText, { color: theme.colors.onSurfaceVariant }]}>
                    +{note.tags.length - 2} more
                  </Text>
                )}
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
    noteCard: {
        borderRadius: 16,
        marginHorizontal: 4,
        marginVertical: 2,
    },
    noteContent: {
        padding: 16,
        position: 'relative',
    },
    sourceTypeIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1,
    },
    noteHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    noteHeaderLeft: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'flex-start',
    },
    noteTitleContainer: {
        flex: 1,
        marginLeft: 12,
    },
    noteTitle: {
        fontWeight: 'bold',
        lineHeight: 24,
        marginBottom: 4,
    },
    noteDate: {
        fontSize: 12,
        opacity: 0.7,
    },
    menuButton: {
        margin: 0,
    },
    notePreview: {
        lineHeight: 20,
        marginBottom: 16,
    },
    noteFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toneChip: {
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
    },
    gridToneChip: {
        height: 32,
        borderRadius: 16,
        marginBottom: 6,
        paddingHorizontal: 8,
    },
    tagsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tagChip: {
        height: 24,
        borderRadius: 12,
    },
    moreTagsText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    gridNoteCard: {
        marginHorizontal: 6,
    },
    gridNoteContent: {
        paddingBottom: 14,
        paddingHorizontal: 14,
    },
    gridNoteHeader: {
        marginBottom: 8,
    },
    gridNoteFooter: {
        marginTop: 14,
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        width: '100%',
    },
    gridNoteDate: {
        marginTop: 0,
        fontSize: 11,
        opacity: 0.7,
        lineHeight: 14,
    },
});

export default NoteCard;
