import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, Searchbar, Chip, IconButton, Menu, useTheme } from 'react-native-paper';

interface LibraryHeaderProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  viewMode: 'list' | 'grid';
  onViewModeChange: () => void;
  sortBy: 'date' | 'title' | 'tone';
  onSortChange: (sortBy: 'date' | 'title' | 'tone') => void;
  onRefresh: () => void;
  selectedTone: string | null;
  onToneFilter: (tone: string | null) => void;
}

const LibraryHeader: React.FC<LibraryHeaderProps> = ({
  searchQuery,
  onSearch,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  onRefresh,
  selectedTone,
  onToneFilter,
}) => {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = React.useState(false);

  const toneFilters = [
    { label: 'All', value: null, icon: 'filter-variant' },
    { label: 'Professional', value: 'professional', icon: 'briefcase' },
    { label: 'Casual', value: 'casual', icon: 'chat' },
    { label: 'Academic', value: 'academic', icon: 'school' },
  ];

  return (
    <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <View style={styles.headerContent}>
        <View style={styles.headerTop}>
          <Text variant="headlineSmall" style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            My Library
          </Text>
          <View style={styles.headerActions}>
            <IconButton
              icon="refresh"
              size={24}
              iconColor={theme.colors.primary}
              onPress={onRefresh}
            />
            <IconButton
              icon={viewMode === 'grid' ? 'view-list' : 'view-grid'}
              size={24}
              iconColor={theme.colors.onSurface}
              onPress={onViewModeChange}
            />
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="sort"
                  size={24}
                  iconColor={theme.colors.onSurface}
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              <Menu.Item onPress={() => onSortChange('date')} title="Sort by Date" />
              <Menu.Item onPress={() => onSortChange('title')} title="Sort by Title" />
              <Menu.Item onPress={() => onSortChange('tone')} title="Sort by Tone" />
            </Menu>
          </View>
        </View>
        
        <Searchbar
          placeholder="Search notes, content, tags..."
          onChangeText={onSearch}
          value={searchQuery}
          style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
          inputStyle={{ fontSize: 14 }}
          iconColor={theme.colors.onSurfaceVariant}
        />
        
        <View style={styles.filters}>
          {toneFilters.map(filter => (
            <Chip
              key={filter.label}
              selected={selectedTone === filter.value}
              onPress={() => onToneFilter(filter.value)}
              style={[
                styles.filterChip,
                selectedTone === filter.value && { backgroundColor: theme.colors.primaryContainer }
              ]}
              textStyle={{ 
                fontSize: 12, 
                color: selectedTone === filter.value ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant 
              }}
              icon={filter.icon}
              compact
            >
              {filter.label}
            </Chip>
          ))}
        </View>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
    header: {
        paddingBottom: 16,
    },
    headerContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
    },
    searchbar: {
        elevation: 0,
        marginBottom: 16,
        borderRadius: 12,
    },
    filters: {
        flexDirection: 'row',
        gap: 8,
    },
    filterChip: {
        height: 36,
        borderRadius: 18,
    },
});

export default LibraryHeader;
