// src/services/VersionHistoryService.ts
import firestore from '@react-native-firebase/firestore';
import { NoteVersion, VersionHistoryConfig, VersionMetadata } from '../types/versionHistory';

export class VersionHistoryService {
  private static instance: VersionHistoryService;
  private config: VersionHistoryConfig = {
    maxVersions: 50,
    autoSaveInterval: 15, // 15 minutes
    retentionDays: 90,
    enableCompression: true,
  };

  static getInstance(): VersionHistoryService {
    if (!VersionHistoryService.instance) {
      VersionHistoryService.instance = new VersionHistoryService();
    }
    return VersionHistoryService.instance;
  }

  /**
   * Save a new version of a note
   */
  async saveVersion(
    noteId: string,
    title: string,
    content: string,
    userId: string,
    isAutoSave: boolean = true
  ): Promise<NoteVersion> {
    try {
      const versionRef = firestore()
        .collection('notes')
        .doc(noteId)
        .collection('versions')
        .doc();

      const metadata: VersionMetadata = {
        wordCount: content.split(/\s+/).length,
        characterCount: content.length,
        source: isAutoSave ? 'auto-save' : 'manual-save',
      };

      const version: NoteVersion = {
        id: versionRef.id,
        noteId,
        version: await this.getNextVersionNumber(noteId),
        title,
        content,
        createdAt: new Date(),
        createdBy: userId,
        size: new Blob([content]).size,
        isAutoSave,
        metadata,
      };

      await versionRef.set(version);

      // Clean up old versions if needed
      await this.cleanupOldVersions(noteId);

      return version;
    } catch (error) {
      console.error('Error saving version:', error);
      throw new Error('Failed to save version');
    }
  }

  /**
   * Get all versions for a note, sorted by creation date (newest first)
   */
  async getVersionHistory(noteId: string): Promise<NoteVersion[]> {
    try {
      const snapshot = await firestore()
        .collection('notes')
        .doc(noteId)
        .collection('versions')
        .orderBy('createdAt', 'desc')
        .limit(this.config.maxVersions)
        .get();

      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt.toDate(),
      })) as NoteVersion[];
    } catch (error) {
      console.error('Error fetching version history:', error);
      return [];
    }
  }

  /**
   * Restore a specific version as the current note content
   */
  async restoreVersion(noteId: string, versionId: string): Promise<boolean> {
    try {
      const versionDoc = await firestore()
        .collection('notes')
        .doc(noteId)
        .collection('versions')
        .doc(versionId)
        .get();

      if (!versionDoc.exists) {
        throw new Error('Version not found');
      }

      const version = versionDoc.data() as NoteVersion;

      // Update the main note document
      await firestore().collection('notes').doc(noteId).update({
        title: version.title,
        content: version.content,
        updatedAt: new Date(),
        lastModifiedBy: version.createdBy,
      });

      return true;
    } catch (error) {
      console.error('Error restoring version:', error);
      return false;
    }
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(noteId: string, versionId: string): Promise<boolean> {
    try {
      await firestore()
        .collection('notes')
        .doc(noteId)
        .collection('versions')
        .doc(versionId)
        .delete();
      
      return true;
    } catch (error) {
      console.error('Error deleting version:', error);
      return false;
    }
  }

  /**
   * Get the next version number for a note
   */
  private async getNextVersionNumber(noteId: string): Promise<number> {
    const snapshot = await firestore()
      .collection('notes')
      .doc(noteId)
      .collection('versions')
      .orderBy('version', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return 1;
    }

    const latestVersion = snapshot.docs[0].data() as NoteVersion;
    return latestVersion.version + 1;
  }

  /**
   * Clean up old versions based on configuration
   */
  private async cleanupOldVersions(noteId: string): Promise<void> {
    try {
      // Get all versions to determine which ones to delete
      const allVersionsSnapshot = await firestore()
        .collection('notes')
        .doc(noteId)
        .collection('versions')
        .orderBy('createdAt', 'desc')
        .get();

      const batch = firestore().batch();
      
      // Remove versions beyond max limit
      if (allVersionsSnapshot.docs.length > this.config.maxVersions) {
        const versionsToDelete = allVersionsSnapshot.docs.slice(this.config.maxVersions);
        versionsToDelete.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }

      // Remove versions older than retention period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const oldSnapshot = await firestore()
        .collection('notes')
        .doc(noteId)
        .collection('versions')
        .where('createdAt', '<', cutoffDate)
        .get();

      oldSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error cleaning up old versions:', error);
    }
  }
}
