// NoteSpark AI - TypeScript Type Definitions
// Clean, comprehensive type definitions for the entire app

// Core Note interface
export interface Note {
  id: string;
  title: string;
  content: string; // HTML content from rich text editor
  plainText: string; // Plain text for search/preview
  tone: 'professional' | 'casual' | 'simplified';
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  tags: string[];
  isStarred: boolean;
  sourceImageUrl?: string; // Original scanned document image
  originalText?: string; // Original text before AI transformation
}

// Document scanning types
export interface DocumentScanResult {
  text: string;
  confidence: number;
  boundingBoxes: BoundingBox[];
  imageUri: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Page file interface for scanner
export interface PageFile {
  path: string;
  uri: string;
}

// Multi-page scanning types
export interface ScannedPage {
  id: string;
  imageUri: string;
  text?: string;
  confidence?: number;
  timestamp: Date;
  isProcessed: boolean;
}

export interface MultiPageScanSession {
  id: string;
  pages: ScannedPage[];
  isProcessing: boolean;
  totalPages: number;
  currentPageIndex: number;
  createdAt: Date;
  combinedText?: string;
}

export interface ScanMode {
  type: 'single' | 'multi';
  maxPages?: number;
  freeUserLimit?: number;
}

export interface PageProcessingProgress {
  currentPage: number;
  totalPages: number;
  isProcessing: boolean;
  processedPages: number;
}

// AI transformation types
export type ToneType = 'professional' | 'casual' | 'simplified';

export interface ToneOption {
  id: ToneType;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface AITransformationRequest {
  text: string;
  tone: ToneType;
}

export interface AITransformationResponse {
  transformedText: string;
  title: string;
  wordCount: number;
}

// User authentication types
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Scanner: undefined;
  DocumentUpload: undefined;
  DocumentPreview: {
    uploadSession: UploadSession;
  };
  ToneSelection: {
    extractedText?: string;
    imageUri?: string;
    imageUris?: string[]; // For multi-page scanning
    isMultiPage?: boolean;
    documentText?: string; // For document uploads
    documentMetadata?: DocumentMetadata;
    isDocumentUpload?: boolean;
  };
  Editor: {
    noteId?: string;
    ocrText?: string;
    tone?: ToneType;
  };
  Library: undefined;
  Profile: undefined;
  Login: undefined;
  Register: undefined;
};

// Library/Search types
export interface SearchFilter {
  query: string;
  tone?: ToneType;
  tags: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy: 'createdAt' | 'updatedAt' | 'title' | 'wordCount';
  sortOrder: 'asc' | 'desc';
}

export interface LibraryState {
  notes: Note[];
  isLoading: boolean;
  searchFilter: SearchFilter;
  selectedNotes: string[];
  error: string | null;
}

// Network and sync types
export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt?: Date;
  pendingOperations: number;
  syncInProgress: boolean;
}

export interface OperationQueue {
  id: string;
  type: 'document_scan' | 'note_save' | 'note_sync' | 'note_delete';
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

// Editor types
export interface EditorState {
  content: string;
  title: string;
  isDirty: boolean;
  isAutoSaving: boolean;
  lastSavedAt?: Date;
  wordCount: number;
}

// App state types
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
  autoSaveInterval: number; // in milliseconds
  defaultTone: ToneType;
  ocrLanguage: string;
  notificationSettings: {
    syncComplete: boolean;
    autoSaveComplete: boolean;
    weeklyReview: boolean;
  };
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// API response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AppError;
  timestamp: Date;
}

// Firebase Firestore types
export interface FirestoreNote {
  id: string;
  title: string;
  content: string;
  plainText: string;
  tone: ToneType;
  wordCount: number;
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
  userId: string;
  tags: string[];
  isStarred: boolean;
  sourceImageUrl?: string;
}

// Component prop types
export interface NoteCardProps {
  note: Note;
  onPress: (note: Note) => void;
  onLongPress?: (note: Note) => void;
  isSelected?: boolean;
}

export interface ToneSelectionCardProps {
  option: ToneOption;
  isSelected: boolean;
  onPress: (tone: ToneType) => void;
}

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  showFilters?: boolean;
  onFilterPress?: () => void;
}

// Hook return types
export interface UseNotesReturn {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  createNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  searchNotes: (filter: SearchFilter) => Promise<Note[]>;
  refreshNotes: () => Promise<void>;
}

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export interface UseNetworkReturn {
  isOnline: boolean;
  networkType: string | null;
  queueSize: number;
  syncStatus: SyncStatus;
  retrySync: () => Promise<void>;
}

// Document Upload types for Feature 1.2
export interface DocumentFile {
  uri: string;
  name: string;
  type: string;
  size: number;
  lastModified?: number;
}

export interface SupportedDocumentType {
  mimeType: string;
  extension: string;
  displayName: string;
  icon: string;
  maxSize: number; // in bytes
  description: string;
}

export interface DocumentUploadProgress {
  phase: 'uploading' | 'processing' | 'extracting' | 'transforming' | 'complete' | 'error';
  percentage: number;
  message: string;
  currentStep?: number;
  totalSteps?: number;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  pageCount?: number;
  wordCount?: number;
  createdDate?: Date;
  modifiedDate?: Date;
  fileSize: number;
  mimeType: string;
}

export interface ProcessingOptions {
  extractImages: boolean;
  preserveFormatting: boolean;
  autoTagging: boolean;
  generateSummary: boolean;
  chunkLargeDocuments: boolean;
  maxChunkSize?: number;
}

export interface DocumentProcessingResult {
  extractedText: string;
  metadata: DocumentMetadata;
  images?: string[]; // Base64 encoded images
  structure?: DocumentStructure;
  tags?: string[];
  summary?: string;
  chunks?: DocumentChunk[];
}

export interface DocumentStructure {
  headings: Array<{
    level: number;
    text: string;
    position: number;
  }>;
  paragraphs: Array<{
    text: string;
    position: number;
    style?: string;
  }>;
  lists: Array<{
    type: 'ordered' | 'unordered';
    items: string[];
    position: number;
  }>;
  tables?: Array<{
    headers: string[];
    rows: string[][];
    position: number;
  }>;
}

export interface DocumentChunk {
  id: string;
  text: string;
  startPosition: number;
  endPosition: number;
  metadata: {
    pageNumber?: number;
    chunkIndex: number;
    wordCount: number;
  };
}

export interface UploadSession {
  id: string;
  file: DocumentFile;
  progress: DocumentUploadProgress;
  result?: DocumentProcessingResult;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// Utility types
export type Tone = ToneType;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type OptionalExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;
