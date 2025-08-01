import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
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
                  iconColor={menuVisible ? theme.colors.primary : theme.colors.onSurface}
                  style={[
                    styles.sortButton,
                    menuVisible && { 
                      backgroundColor: theme.colors.primaryContainer + '40',
                      transform: [{ scale: 0.95 }]
                    }
                  ]}
                  onPress={() => setMenuVisible(!menuVisible)}
                />
              }
              contentStyle={styles.sortMenu}
            >
              <Menu.Item 
                onPress={() => { 
                  onSortChange('date'); 
                  setMenuVisible(false); 
                }} 
                title="Sort by Date" 
                leadingIcon="calendar"
                titleStyle={sortBy === 'date' ? { color: theme.colors.primary, fontWeight: '600' } : {}}
              />
              <Menu.Item 
                onPress={() => { 
                  onSortChange('title'); 
                  setMenuVisible(false); 
                }} 
                title="Sort by Title" 
                leadingIcon="format-title"
                titleStyle={sortBy === 'title' ? { color: theme.colors.primary, fontWeight: '600' } : {}}
              />
              <Menu.Item 
                onPress={() => { 
                  onSortChange('tone'); 
                  setMenuVisible(false); 
                }} 
                title="Sort by Tone" 
                leadingIcon="palette"
                titleStyle={sortBy === 'tone' ? { color: theme.colors.primary, fontWeight: '600' } : {}}
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
    sortButton: {
        borderRadius: 12,
        margin: 0,
        backgroundColor: 'transparent',
    },
    sortMenu: {
        borderRadius: 12,
        marginTop: 8,
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
