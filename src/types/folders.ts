// src/types/folders.ts
// NoteSpark AI - Folder Organization System Types
// Comprehensive type definitions for hierarchical note organization

export interface Folder {
  id: string;
  name: string;
  description?: string;
  color: string; // Hex color for visual organization
  icon: string; // Material Design icon name
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  noteCount: number;
  isDefault?: boolean; // For system folders like "Inbox"
  isArchived?: boolean; // For soft deletion
  parentId?: string; // For nested folders (future enhancement)
  order: number; // For custom ordering
}

export interface FolderWithNotes extends Folder {
  notes: Note[];
}

export interface FolderStats {
  totalNotes: number;
  recentNotes: number; // Notes created in last 7 days
  totalSize: number; // Total content size in bytes
  lastActivity: Date; // Most recent note creation/update
}

export interface FolderPreferences {
  defaultView: 'list' | 'grid' | 'cards';
  sortBy: 'updated' | 'created' | 'alphabetical' | 'size';
  sortOrder: 'asc' | 'desc';
  showPreview: boolean;
  autoOrganize: boolean; // Auto-categorize new notes
}

// Extended Note interface to include folder reference
export interface Note {
  id: string;
  title: string;
  content: string;
  folderId?: string | null; // Optional folder reference
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tone?: string;
  tags?: string[];
  size: number; // Content size in bytes
  wordCount: number;
  isArchived?: boolean;
  isPinned?: boolean;
}

// Folder creation/update requests
export interface CreateFolderRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface UpdateFolderRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isArchived?: boolean;
  order?: number;
}

// Folder organization operations
export interface MoveNotesRequest {
  noteIds: string[];
  targetFolderId: string | null; // null for moving to Inbox
  sourceMenuId?: string; // For analytics
}

export interface FolderAnalytics {
  folderId: string;
  viewCount: number;
  notesCreated: number;
  notesAccessed: number;
  lastViewed: Date;
  userEngagement: 'high' | 'medium' | 'low';
}

// Pre-defined folder templates
export interface FolderTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  suggestedFor: string; // "students", "professionals", "researchers", etc.
  defaultPreferences: FolderPreferences;
}

// Folder search and filtering
export interface FolderFilter {
  searchQuery?: string;
  color?: string;
  hasNotes?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  sortBy?: 'name' | 'created' | 'updated' | 'noteCount';
  sortOrder?: 'asc' | 'desc';
}

// Smart folder rules (future enhancement)
export interface SmartFolderRule {
  id: string;
  folderId: string;
  type: 'tag' | 'keyword' | 'tone' | 'date' | 'size';
  condition: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
  value: string | number | Date;
  isActive: boolean;
}

// Bulk operations
export interface BulkFolderOperation {
  operation: 'move' | 'delete' | 'archive' | 'unarchive' | 'duplicate';
  folderIds: string[];
  targetFolderId?: string; // For move operations
  preserveStructure?: boolean; // For nested folder operations
}

// Folder sharing (future enhancement)
export interface FolderShare {
  id: string;
  folderId: string;
  sharedBy: string;
  sharedWith: string[];
  permissions: 'view' | 'edit' | 'admin';
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

// Default system folders
export const SYSTEM_FOLDERS = {
  INBOX: {
    id: 'inbox',
    name: 'Inbox',
    description: 'Unorganized notes',
    icon: 'inbox',
    color: '#607D8B',
    isDefault: true,
  },
  FAVORITES: {
    id: 'favorites',
    name: 'Favorites',
    description: 'Pinned and important notes',
    icon: 'star',
    color: '#FF9800',
    isDefault: true,
  },
  ARCHIVE: {
    id: 'archive',
    name: 'Archive',
    description: 'Archived notes and folders',
    icon: 'archive',
    color: '#9E9E9E',
    isDefault: true,
  },
} as const;

// Folder color palette
export const FOLDER_COLORS = [
  '#2196F3', // Blue
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#F44336', // Red
  '#00BCD4', // Cyan
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#E91E63', // Pink
  '#3F51B5', // Indigo
  '#009688', // Teal
  '#CDDC39', // Lime
] as const;

// Folder icons
export const FOLDER_ICONS = [
  'folder',
  'folder-outline',
  'briefcase',
  'school',
  'heart',
  'star',
  'lightbulb',
  'book',
  'camera',
  'music',
  'palette',
  'code-tags',
  'chart-line',
  'map',
  'coffee',
  'home',
  'car',
  'airplane',
  'medical-bag',
  'dumbbell',
] as const;

export type FolderColor = typeof FOLDER_COLORS[number];
export type FolderIcon = typeof FOLDER_ICONS[number];
export type SystemFolderId = keyof typeof SYSTEM_FOLDERS;
