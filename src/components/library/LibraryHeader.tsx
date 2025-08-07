import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Surface, Text, Searchbar, Chip, IconButton, useTheme, Menu } from 'react-native-paper';

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

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleSortChange = React.useCallback((newSortBy: 'date' | 'title' | 'tone') => {
    onSortChange(newSortBy);
    closeMenu();
  }, [onSortChange]);

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
              style={styles.headerButton}
            />
            <IconButton
              icon={viewMode === 'grid' ? 'view-list' : 'view-grid'}
              size={24}
              iconColor={theme.colors.onSurface}
              onPress={onViewModeChange}
              style={styles.headerButton}
            />
            <Menu
              visible={menuVisible}
              onDismiss={closeMenu}
              anchor={
                <IconButton
                  icon="sort"
                  size={24}
                  iconColor={menuVisible ? theme.colors.primary : theme.colors.onSurface}
                  style={styles.headerButton}
                  onPress={openMenu}
                />
              }
              anchorPosition="bottom"
            >
              <Menu.Item
                onPress={() => handleSortChange('date')}
                title="Sort by Date"
                leadingIcon="calendar"
                titleStyle={{
                  color: sortBy === 'date' ? theme.colors.primary : theme.colors.onSurface,
                  fontWeight: sortBy === 'date' ? '600' : '400'
                }}
              />
              <Menu.Item
                onPress={() => handleSortChange('title')}
                title="Sort by Title"
                leadingIcon="format-title"
                titleStyle={{
                  color: sortBy === 'title' ? theme.colors.primary : theme.colors.onSurface,
                  fontWeight: sortBy === 'title' ? '600' : '400'
                }}
              />
              <Menu.Item
                onPress={() => handleSortChange('tone')}
                title="Sort by Tone"
                leadingIcon="palette"
                titleStyle={{
                  color: sortBy === 'tone' ? theme.colors.primary : theme.colors.onSurface,
                  fontWeight: sortBy === 'tone' ? '600' : '400'
                }}
              />
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
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filters}
        >
          {toneFilters.map(filter => (
            <Chip
              key={filter.label}
              selected={selectedTone === filter.value}
              onPress={() => onToneFilter(filter.value)}
              style={[
                styles.filterChip,
                selectedTone === filter.value && { 
                  backgroundColor: theme.colors.primaryContainer,
                  borderColor: theme.colors.primary,
                  borderWidth: 1,
                }
              ]}
              textStyle={{ 
                fontSize: 13, 
                fontWeight: selectedTone === filter.value ? '600' : '500',
                color: selectedTone === filter.value ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant 
              }}
              icon={filter.icon}
              compact={false}
            >
              {filter.label}
            </Chip>
          ))}
        </ScrollView>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
    header: {
        paddingBottom: 16,
        zIndex: 1,
        marginTop: 0,
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
        alignItems: 'center',
        position: 'relative',
    },
    headerButton: {
        margin: 0,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchbar: {
        elevation: 0,
        marginBottom: 16,
        borderRadius: 12,
    },
    filtersContainer: {
        marginHorizontal: -16,
        paddingHorizontal: 16,
    },
    filters: {
        flexDirection: 'row',
        gap: 10,
        paddingRight: 16,
    },
    filterChip: {
        height: 40,
        borderRadius: 20,
        minWidth: 90,
        justifyContent: 'center',
        elevation: 1,
    },
});

export default LibraryHeader;
