import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, Button, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface LibraryEmptyStateProps {
  isSearching: boolean;
  onClearFilters: () => void;
  onScanNew: () => void;
  onNewNote: () => void;
}

const LibraryEmptyState: React.FC<LibraryEmptyStateProps> = ({
  isSearching,
  onClearFilters,
  onScanNew,
  onNewNote,
}) => {
  const theme = useTheme();

  if (isSearching) {
    return (
      <View style={styles.emptyContainer}>
        <Surface style={[styles.emptyIconContainer, { backgroundColor: theme.colors.secondaryContainer }]} elevation={0}>
          <Icon name="magnify-close" size={64} color={theme.colors.secondary} />
        </Surface>
        <Text variant="headlineMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          No Results Found
        </Text>
        <Text variant="bodyLarge" style={[styles.emptyDescription, { color: theme.colors.onSurfaceVariant }]}>
          Try adjusting your search or filter criteria
        </Text>
        <Button
          mode="outlined"
          icon="filter-remove"
          onPress={onClearFilters}
          style={styles.emptyButton}
        >
          Clear Filters
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <Surface style={[styles.emptyIconContainer, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
        <Icon name="rocket-launch" size={72} color={theme.colors.primary} />
      </Surface>
      <Text variant="headlineLarge" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
        Welcome to NoteSpark AI!
      </Text>
      <Text variant="bodyLarge" style={[styles.emptyDescription, { color: theme.colors.onSurfaceVariant }]}>
        Transform your documents into intelligent, AI-enhanced notes in seconds
      </Text>
      
      <View style={styles.emptyFeatures}>
        <View style={styles.emptyFeature}>
          <Icon name="camera-plus" size={24} color={theme.colors.primary} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
            Scan documents with OCR
          </Text>
        </View>
        <View style={styles.emptyFeature}>
          <Icon name="robot" size={24} color={theme.colors.primary} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
            AI-powered tone enhancement
          </Text>
        </View>
        <View style={styles.emptyFeature}>
          <Icon name="text-box-edit" size={24} color={theme.colors.primary} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
            Rich text editing with auto-save
          </Text>
        </View>
      </View>

      <Button
        mode="contained"
        icon="camera-plus"
        onPress={onScanNew}
        style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
        contentStyle={styles.emptyButtonContent}
        labelStyle={styles.emptyButtonLabel}
      >
        Scan Your First Document
      </Button>
      
      <Button
        mode="outlined"
        icon="note-plus"
        onPress={onNewNote}
        style={[styles.emptyButton, { marginTop: 12 }]}
      >
        Or Create a Blank Note
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    emptyDescription: {
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
        opacity: 0.8,
    },
    emptyFeatures: {
        alignSelf: 'stretch',
        marginBottom: 32,
    },
    emptyFeature: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    emptyButton: {
        borderRadius: 24,
        elevation: 4,
    },
    emptyButtonContent: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    emptyButtonLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LibraryEmptyState;
