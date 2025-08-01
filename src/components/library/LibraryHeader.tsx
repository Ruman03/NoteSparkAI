import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Surface, Text, Searchbar, Chip, IconButton, useTheme, Icon } from 'react-native-paper';

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

  const handleSortChange = React.useCallback((newSortBy: 'date' | 'title' | 'tone') => {
    onSortChange(newSortBy);
    setMenuVisible(false);
  }, [onSortChange]);

  const handleMenuToggle = React.useCallback(() => {
    setMenuVisible(!menuVisible);
  }, [menuVisible]);

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
            <View>
              <IconButton
                icon="sort"
                size={24}
                iconColor={menuVisible ? theme.colors.primary : theme.colors.onSurface}
                style={styles.headerButton}
                onPress={handleMenuToggle}
              />
              
              {menuVisible && (
                <View style={[styles.sortDropdown, { backgroundColor: theme.colors.surface }]}>
                  <TouchableOpacity 
                    style={[
                      styles.sortOption,
                      sortBy === 'date' && { backgroundColor: theme.colors.primaryContainer }
                    ]}
                    onPress={() => handleSortChange('date')}
                  >
                    <View style={styles.sortOptionContent}>
                      <Icon 
                        source="calendar" 
                        size={20} 
                        color={sortBy === 'date' ? theme.colors.onPrimaryContainer : theme.colors.onSurface}
                      />
                      <Text style={[
                        styles.sortOptionText, 
                        { 
                          color: sortBy === 'date' ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                          fontWeight: sortBy === 'date' ? '600' : '400'
                        }
                      ]}>
                        Sort by Date
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.sortOption,
                      sortBy === 'title' && { backgroundColor: theme.colors.primaryContainer }
                    ]}
                    onPress={() => handleSortChange('title')}
                  >
                    <View style={styles.sortOptionContent}>
                      <Icon 
                        source="format-title" 
                        size={20} 
                        color={sortBy === 'title' ? theme.colors.onPrimaryContainer : theme.colors.onSurface}
                      />
                      <Text style={[
                        styles.sortOptionText, 
                        { 
                          color: sortBy === 'title' ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                          fontWeight: sortBy === 'title' ? '600' : '400'
                        }
                      ]}>
                        Sort by Title
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.sortOption,
                      sortBy === 'tone' && { backgroundColor: theme.colors.primaryContainer }
                    ]}
                    onPress={() => handleSortChange('tone')}
                  >
                    <View style={styles.sortOptionContent}>
                      <Icon 
                        source="palette" 
                        size={20} 
                        color={sortBy === 'tone' ? theme.colors.onPrimaryContainer : theme.colors.onSurface}
                      />
                      <Text style={[
                        styles.sortOptionText, 
                        { 
                          color: sortBy === 'tone' ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                          fontWeight: sortBy === 'tone' ? '600' : '400'
                        }
                      ]}>
                        Sort by Tone
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
    sortDropdown: {
        position: 'absolute',
        top: 45,
        right: 0,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.12)',
        minWidth: 170,
        paddingVertical: 8,
        zIndex: 1000,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    sortOption: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        marginHorizontal: 4,
    },
    sortOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    sortOptionText: {
        fontSize: 16,
        flex: 1,
    },
});

export default LibraryHeader;
