// src/types/versionHistory.ts
export interface NoteVersion {
  id: string;
  noteId: string;
  version: number;
  title: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  size: number; // Content size in bytes
  changesSummary?: string; // Brief description of changes
  isAutoSave: boolean;
  metadata: VersionMetadata;
}

export interface VersionMetadata {
  wordCount: number;
  characterCount: number;
  deviceInfo?: string;
  appVersion?: string;
  source: 'auto-save' | 'manual-save' | 'restore';
}

export interface VersionHistoryConfig {
  maxVersions: number; // Maximum versions to keep
  autoSaveInterval: number; // Minutes between auto-saves
  retentionDays: number; // Days to keep versions
  enableCompression: boolean;
}

export interface VersionComparison {
  oldVersion: NoteVersion;
  newVersion: NoteVersion;
  additions: string[];
  deletions: string[];
  modifications: string[];
}

// Firestore collection structure:
// notes/{noteId}/versions/{versionId}
