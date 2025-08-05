import React from 'react';
import {
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import {
  Surface,
  IconButton,
  Text,
  useTheme,
  Badge,
  ActivityIndicator,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScannedPage } from '../types';
import { hapticService } from '../services/HapticService';

const { width: screenWidth } = Dimensions.get('window');
const THUMBNAIL_WIDTH = 80;
const THUMBNAIL_HEIGHT = 100;

interface PageThumbnailGalleryProps {
  pages: ScannedPage[];
  onDeletePage: (pageId: string) => void;
  onReorderPages: (pages: ScannedPage[]) => void;
  onPreviewPage: (page: ScannedPage) => void;
  isProcessing?: boolean;
  currentProcessingPage?: number;
}

const PageThumbnailGallery: React.FC<PageThumbnailGalleryProps> = ({
  pages,
  onDeletePage,
  onReorderPages,
  onPreviewPage,
  isProcessing = false,
  currentProcessingPage,
}) => {
  const theme = useTheme();

  const handleDeletePage = (page: ScannedPage) => {
    hapticService.light();
    Alert.alert(
      'Delete Page',
      `Remove page ${pages.indexOf(page) + 1} from this scan?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            hapticService.medium();
            onDeletePage(page.id);
          },
        },
      ]
    );
  };

  const handlePreviewPage = (page: ScannedPage) => {
    hapticService.light();
    onPreviewPage(page);
  };

  const renderPageThumbnail = (page: ScannedPage, index: number) => {
    const isCurrentlyProcessing = isProcessing && currentProcessingPage === index;
    const isProcessed = page.isProcessed;

    return (
      <Surface
        key={page.id}
        style={[
          styles.thumbnailContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isCurrentlyProcessing 
              ? theme.colors.primary 
              : isProcessed 
                ? theme.colors.outline 
                : theme.colors.surfaceVariant,
          },
        ]}
        elevation={2}
      >
        <TouchableOpacity
          style={styles.thumbnailTouchable}
          onPress={() => handlePreviewPage(page)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: page.imageUri }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
          
          {/* Processing overlay */}
          {isCurrentlyProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
              />
            </View>
          )}
          
          {/* Page number badge */}
          <Badge
            style={[
              styles.pageNumberBadge,
              {
                backgroundColor: isProcessed 
                  ? theme.colors.primary 
                  : theme.colors.surfaceVariant,
              },
            ]}
            size={18}
          >
            {index + 1}
          </Badge>
          
          {/* Status indicator */}
          {isProcessed && !isCurrentlyProcessing && (
            <View style={[styles.statusIndicator, { backgroundColor: theme.colors.primary }]}>
              <Icon name="check" size={12} color={theme.colors.onPrimary} />
            </View>
          )}
          
          {/* Delete button */}
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: theme.colors.errorContainer }]}
            onPress={() => handleDeletePage(page)}
          >
            <Icon name="close" size={14} color={theme.colors.onErrorContainer} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Surface>
    );
  };

  if (pages.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: theme.colors.onSurface }]}>
          Pages ({pages.length})
        </Text>
        {isProcessing && (
          <View style={styles.processingIndicator}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.processingText, { color: theme.colors.primary }]}>
              Processing...
            </Text>
          </View>
        )}
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {pages.map((page, index) => renderPageThumbnail(page, index))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  processingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  thumbnailContainer: {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbnailTouchable: {
    flex: 1,
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumberBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    minWidth: 18,
    height: 18,
  },
  statusIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PageThumbnailGallery;
