/**
 * Enhanced Version History Service
 * Manages note versioning with comprehensive error handling and enterprise-grade reliability
 * OPTIMIZED: Enhanced with retry logic, input validation, metrics tracking, and performance improvements
 */

import firestore from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { NoteVersion, VersionHistoryConfig, VersionMetadata } from '../types/versionHistory';

// Enhanced interfaces for better type safety and functionality
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface VersionHistoryMetrics {
  versionsCreated: number;
  versionsRestored: number;
  versionsDeleted: number;
  errorCount: number;
  averageVersionSize: number;
  cleanupOperations: number;
  lastSuccess?: Date;
  lastError?: string;
}

interface VersionOperation {
  id: string;
  type: 'save' | 'restore' | 'delete' | 'cleanup';
  noteId: string;
  startTime: number;
  status: 'pending' | 'completed' | 'failed';
}

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  backoffFactor: 2
};

const VERSION_OPERATION_TIMEOUT = 30000; // 30 seconds timeout for version operations
const MAX_CONCURRENT_OPERATIONS = 5; // Maximum concurrent version operations
const BATCH_SIZE_LIMIT = 500; // Maximum number of operations per batch

const NON_RETRYABLE_ERRORS = [
  'permission denied',
  'not found',
  'invalid argument',
  'unauthenticated',
  'quota exceeded'
];

/**
 * Enhanced Version History Service
 * OPTIMIZED: Comprehensive error handling, retry logic, and performance monitoring
 */

export class VersionHistoryService {
  private static instance: VersionHistoryService;
  private config: VersionHistoryConfig = {
    maxVersions: 50,
    autoSaveInterval: 15, // 15 minutes
    retentionDays: 90,
    enableCompression: true,
  };
  private metrics: VersionHistoryMetrics = {
    versionsCreated: 0,
    versionsRestored: 0,
    versionsDeleted: 0,
    errorCount: 0,
    averageVersionSize: 0,
    cleanupOperations: 0
  };
  private activeOperations = new Set<string>();

  static getInstance(): VersionHistoryService {
    if (!VersionHistoryService.instance) {
      VersionHistoryService.instance = new VersionHistoryService();
    }
    return VersionHistoryService.instance;
  }

  /**
   * Enhanced retry mechanism with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: RetryOptions = DEFAULT_RETRY_OPTIONS
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        
        // Don't retry for non-retryable errors
        if (NON_RETRYABLE_ERRORS.some(nonRetryableError => errorMessage.includes(nonRetryableError))) {
          this.updateMetrics('error', { error: errorMessage });
          throw error;
        }
        
        if (attempt === options.maxRetries) {
          break;
        }
        
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffFactor, attempt),
          options.maxDelay
        );
        
        console.log(`${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms:`, errorMessage);
  await new Promise(resolve => { const t = setTimeout(resolve, delay); (t as any).unref?.(); });
      }
    }
    
    this.updateMetrics('error', { error: lastError!.message });
    throw new Error(`${operationName} failed after ${options.maxRetries + 1} attempts: ${lastError!.message}`);
  }

  /**
   * Validate input parameters
   */
  private validateInput(noteId: string, operation: string): void {
    if (!noteId || typeof noteId !== 'string' || noteId.trim().length === 0) {
      throw new Error(`${operation}: Invalid noteId provided`);
    }
  }

  /**
   * Check if service is available
   */
  private isServiceAvailable(): boolean {
    try {
      return firestore() !== null;
    } catch (error) {
      console.error('Version History Service not available:', error);
      return false;
    }
  }

  /**
   * Update service metrics
   */
  private updateMetrics(operation: string, data: any = {}): void {
    try {
      switch (operation) {
        case 'version_created':
          this.metrics.versionsCreated++;
          this.metrics.lastSuccess = new Date();
          if (data.size) {
            this.metrics.averageVersionSize = 
              (this.metrics.averageVersionSize * (this.metrics.versionsCreated - 1) + data.size) / 
              this.metrics.versionsCreated;
          }
          break;
        case 'version_restored':
          this.metrics.versionsRestored++;
          this.metrics.lastSuccess = new Date();
          break;
        case 'version_deleted':
          this.metrics.versionsDeleted++;
          this.metrics.lastSuccess = new Date();
          break;
        case 'cleanup_completed':
          this.metrics.cleanupOperations++;
          this.metrics.lastSuccess = new Date();
          break;
        case 'error':
          this.metrics.errorCount++;
          this.metrics.lastError = data.error || 'Unknown error';
          break;
      }
    } catch (error) {
      console.error('Error updating version history metrics:', error);
    }
  }

  /**
   * Save a new version of a note with enhanced error handling and validation
   */
  async saveVersion(
    noteId: string,
    title: string,
    content: string,
    userId: string,
    isAutoSave: boolean = true
  ): Promise<NoteVersion> {
    const operationId = `save_${noteId}_${Date.now()}`;
    
    try {
      // Input validation
      this.validateInput(noteId, 'saveVersion');
      if (!title || typeof title !== 'string') {
        throw new Error('saveVersion: Invalid title provided');
      }
      if (!content || typeof content !== 'string') {
        throw new Error('saveVersion: Invalid content provided');
      }
      if (!userId || typeof userId !== 'string') {
        throw new Error('saveVersion: Invalid userId provided');
      }

      // Service availability check
      if (!this.isServiceAvailable()) {
        throw new Error('Version History service is not available');
      }

      // Concurrency control
      if (this.activeOperations.size >= MAX_CONCURRENT_OPERATIONS) {
        throw new Error('Maximum concurrent operations limit reached');
      }

      this.activeOperations.add(operationId);

      return await this.withRetry(async () => {
        const versionRef = firestore()
          .collection('notes')
          .doc(noteId)
          .collection('versions')
          .doc();

        const metadata: VersionMetadata = {
          wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
          characterCount: content.length,
          source: isAutoSave ? 'auto-save' : 'manual-save',
        };

        const version: NoteVersion = {
          id: versionRef.id,
          noteId,
          version: await this.getNextVersionNumber(noteId),
          title: title.trim(),
          content,
          createdAt: new Date(),
          createdBy: userId,
          size: new Blob([content]).size,
          isAutoSave,
          metadata,
        };

        // Set with timeout protection
        const savePromise = versionRef.set(version);
        const timeoutPromise = new Promise((_, reject) => 
          (() => { const t = setTimeout(() => reject(new Error('Version save timeout')), VERSION_OPERATION_TIMEOUT); (t as any).unref?.(); })()
        );

        await Promise.race([savePromise, timeoutPromise]);

        // Clean up old versions if needed
        try {
          await this.cleanupOldVersions(noteId);
        } catch (cleanupError) {
          console.warn('Cleanup failed but version was saved:', cleanupError);
        }

        this.updateMetrics('version_created', { size: version.size });
        return version;
      }, 'saveVersion');

    } catch (error) {
      console.error('Error saving version:', error);
      this.updateMetrics('error', { error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to save version: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Get all versions for a note with enhanced error handling and validation
   */
  async getVersionHistory(noteId: string): Promise<NoteVersion[]> {
    try {
      // Input validation
      this.validateInput(noteId, 'getVersionHistory');

      // Service availability check
      if (!this.isServiceAvailable()) {
        console.warn('Version History service not available, returning empty array');
        return [];
      }

      return await this.withRetry(async () => {
        const queryPromise = firestore()
          .collection('notes')
          .doc(noteId)
          .collection('versions')
          .orderBy('createdAt', 'desc')
          .limit(this.config.maxVersions)
          .get();

        const timeoutPromise = new Promise<never>((_, reject) => 
          (() => { const t = setTimeout(() => reject(new Error('Version history fetch timeout')), VERSION_OPERATION_TIMEOUT); (t as any).unref?.(); })()
        );

        const snapshot = await Promise.race([queryPromise, timeoutPromise]);

        if (snapshot.empty) {
          return [];
        }

        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          } as NoteVersion;
        });
      }, 'getVersionHistory');

    } catch (error) {
      console.error('Error fetching version history:', error);
      this.updateMetrics('error', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Restore a specific version with enhanced error handling and validation
   */
  async restoreVersion(noteId: string, versionId: string): Promise<boolean> {
    const operationId = `restore_${noteId}_${versionId}_${Date.now()}`;

    try {
      // Input validation
      this.validateInput(noteId, 'restoreVersion');
      if (!versionId || typeof versionId !== 'string' || versionId.trim().length === 0) {
        throw new Error('restoreVersion: Invalid versionId provided');
      }

      // Service availability check
      if (!this.isServiceAvailable()) {
        throw new Error('Version History service is not available');
      }

      // Concurrency control
      if (this.activeOperations.size >= MAX_CONCURRENT_OPERATIONS) {
        throw new Error('Maximum concurrent operations limit reached');
      }

      this.activeOperations.add(operationId);

      return await this.withRetry(async () => {
        const versionDocPromise = firestore()
          .collection('notes')
          .doc(noteId)
          .collection('versions')
          .doc(versionId)
          .get();

        const timeoutPromise = new Promise<never>((_, reject) => 
          (() => { const t = setTimeout(() => reject(new Error('Version restore timeout')), VERSION_OPERATION_TIMEOUT); (t as any).unref?.(); })()
        );

        const versionDoc = await Promise.race([versionDocPromise, timeoutPromise]);

        if (!versionDoc.exists) {
          throw new Error('Version not found');
        }

        const version = versionDoc.data() as NoteVersion;

        if (!version.title || !version.content) {
          throw new Error('Version data is incomplete or corrupted');
        }

        // Update the main note document with timeout protection
        const updatePromise = firestore().collection('notes').doc(noteId).update({
          title: version.title,
          content: version.content,
          updatedAt: new Date(),
          lastModifiedBy: version.createdBy,
        });

        const updateTimeoutPromise = new Promise<never>((_, reject) => 
          (() => { const t = setTimeout(() => reject(new Error('Note update timeout')), VERSION_OPERATION_TIMEOUT); (t as any).unref?.(); })()
        );

        await Promise.race([updatePromise, updateTimeoutPromise]);

        this.updateMetrics('version_restored');
        return true;
      }, 'restoreVersion');

    } catch (error) {
      console.error('Error restoring version:', error);
      this.updateMetrics('error', { error: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Delete a specific version with enhanced error handling and validation
   */
  async deleteVersion(noteId: string, versionId: string): Promise<boolean> {
    const operationId = `delete_${noteId}_${versionId}_${Date.now()}`;

    try {
      // Input validation
      this.validateInput(noteId, 'deleteVersion');
      if (!versionId || typeof versionId !== 'string' || versionId.trim().length === 0) {
        throw new Error('deleteVersion: Invalid versionId provided');
      }

      // Service availability check
      if (!this.isServiceAvailable()) {
        throw new Error('Version History service is not available');
      }

      // Concurrency control
      if (this.activeOperations.size >= MAX_CONCURRENT_OPERATIONS) {
        throw new Error('Maximum concurrent operations limit reached');
      }

      this.activeOperations.add(operationId);

      return await this.withRetry(async () => {
        // First check if version exists
        const versionDoc = await firestore()
          .collection('notes')
          .doc(noteId)
          .collection('versions')
          .doc(versionId)
          .get();

        if (!versionDoc.exists) {
          console.warn(`Version ${versionId} not found for note ${noteId}`);
          return true; // Consider it successful if already deleted
        }

        // Delete with timeout protection
        const deletePromise = firestore()
          .collection('notes')
          .doc(noteId)
          .collection('versions')
          .doc(versionId)
          .delete();

        const timeoutPromise = new Promise<never>((_, reject) => 
          (() => { const t = setTimeout(() => reject(new Error('Version delete timeout')), VERSION_OPERATION_TIMEOUT); (t as any).unref?.(); })()
        );

        await Promise.race([deletePromise, timeoutPromise]);

        this.updateMetrics('version_deleted');
        return true;
      }, 'deleteVersion');

    } catch (error) {
      console.error('Error deleting version:', error);
      this.updateMetrics('error', { error: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Get the next version number for a note with enhanced error handling
   */
  private async getNextVersionNumber(noteId: string): Promise<number> {
    try {
      return await this.withRetry(async () => {
        const queryPromise = firestore()
          .collection('notes')
          .doc(noteId)
          .collection('versions')
          .orderBy('version', 'desc')
          .limit(1)
          .get();

        const timeoutPromise = new Promise<never>((_, reject) => 
          (() => { const t = setTimeout(() => reject(new Error('Version number fetch timeout')), VERSION_OPERATION_TIMEOUT); (t as any).unref?.(); })()
        );

        const snapshot = await Promise.race([queryPromise, timeoutPromise]);

        if (snapshot.empty) {
          return 1;
        }

        const latestVersion = snapshot.docs[0].data() as NoteVersion;
        const nextVersion = (latestVersion.version || 0) + 1;
        
        // Ensure version number is valid
        if (isNaN(nextVersion) || nextVersion <= 0) {
          console.warn('Invalid version number detected, resetting to 1');
          return 1;
        }

        return nextVersion;
      }, 'getNextVersionNumber');
    } catch (error) {
      console.error('Error getting next version number:', error);
      // Return 1 as fallback
      return 1;
    }
  }

  /**
   * Clean up old versions with enhanced error handling and batch processing
   */
  private async cleanupOldVersions(noteId: string): Promise<void> {
    try {
      await this.withRetry(async () => {
        // Get all versions to determine which ones to delete
        const allVersionsPromise = firestore()
          .collection('notes')
          .doc(noteId)
          .collection('versions')
          .orderBy('createdAt', 'desc')
          .get();

        const timeoutPromise = new Promise<never>((_, reject) => 
          (() => { const t = setTimeout(() => reject(new Error('Cleanup versions fetch timeout')), VERSION_OPERATION_TIMEOUT); (t as any).unref?.(); })()
        );

        const allVersionsSnapshot = await Promise.race([allVersionsPromise, timeoutPromise]);
        
        if (allVersionsSnapshot.empty) {
          return;
        }

        const batch = firestore().batch();
        let deletionCount = 0;
        
        // Remove versions beyond max limit
        if (allVersionsSnapshot.docs.length > this.config.maxVersions) {
          const versionsToDelete = allVersionsSnapshot.docs.slice(this.config.maxVersions);
          versionsToDelete.forEach((doc) => {
            if (deletionCount < BATCH_SIZE_LIMIT) {
              batch.delete(doc.ref);
              deletionCount++;
            }
          });
        }

        // Remove versions older than retention period
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

        const oldVersionsPromise = firestore()
          .collection('notes')
          .doc(noteId)
          .collection('versions')
          .where('createdAt', '<', cutoffDate)
          .get();

        const oldTimeoutPromise = new Promise<never>((_, reject) => 
          (() => { const t = setTimeout(() => reject(new Error('Old versions fetch timeout')), VERSION_OPERATION_TIMEOUT); (t as any).unref?.(); })()
        );

        const oldSnapshot = await Promise.race([oldVersionsPromise, oldTimeoutPromise]);

        oldSnapshot.docs.forEach((doc) => {
          if (deletionCount < BATCH_SIZE_LIMIT) {
            batch.delete(doc.ref);
            deletionCount++;
          }
        });

        if (deletionCount > 0) {
          const batchPromise = batch.commit();
          const batchTimeoutPromise = new Promise<never>((_, reject) => 
            (() => { const t = setTimeout(() => reject(new Error('Batch cleanup timeout')), VERSION_OPERATION_TIMEOUT); (t as any).unref?.(); })()
          );

          await Promise.race([batchPromise, batchTimeoutPromise]);
          this.updateMetrics('cleanup_completed', { deletedCount: deletionCount });
        }
      }, 'cleanupOldVersions');
    } catch (error) {
      console.error('Error cleaning up old versions:', error);
      this.updateMetrics('error', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get service health status and metrics
   */
  public getServiceHealth(): {
    isHealthy: boolean;
    metrics: VersionHistoryMetrics;
    activeOperations: number;
    serviceStatus: string;
  } {
    const isHealthy = this.isServiceAvailable() && this.metrics.errorCount < 10;
    
    return {
      isHealthy,
      metrics: { ...this.metrics },
      activeOperations: this.activeOperations.size,
      serviceStatus: isHealthy ? 'healthy' : 'degraded'
    };
  }

  /**
   * Get service statistics
   */
  public getServiceStatistics(): {
    totalOperations: number;
    successRate: number;
    averageVersionSize: number;
    uptime: string;
  } {
    const totalOperations = this.metrics.versionsCreated + this.metrics.versionsRestored + 
                           this.metrics.versionsDeleted + this.metrics.cleanupOperations;
    const successfulOperations = totalOperations - this.metrics.errorCount;
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 100;

    return {
      totalOperations,
      successRate: Math.round(successRate * 100) / 100,
      averageVersionSize: Math.round(this.metrics.averageVersionSize),
      uptime: this.metrics.lastSuccess ? 
        `Last success: ${this.metrics.lastSuccess.toISOString()}` : 
        'No successful operations yet'
    };
  }

  /**
   * Reset service metrics (for testing/debugging)
   */
  public resetMetrics(): void {
    this.metrics = {
      versionsCreated: 0,
      versionsRestored: 0,
      versionsDeleted: 0,
      errorCount: 0,
      averageVersionSize: 0,
      cleanupOperations: 0
    };
    this.activeOperations.clear();
  }
}
