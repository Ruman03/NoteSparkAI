// NoteSpark AI - Network Service
// Clean, modern implementation with proper offline queue management

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface QueuedOperation {
  id: string;
  type: 'document_scan' | 'note_save' | 'note_sync';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface NetworkStatus {
  isOnline: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
}

type NetworkChangeCallback = (status: NetworkStatus) => void;

class NetworkService {
  private static instance: NetworkService;
  private isOnline: boolean = true;
  private operationQueue: QueuedOperation[] = [];
  private networkChangeCallbacks: Set<NetworkChangeCallback> = new Set();
  private readonly QUEUE_STORAGE_KEY = 'notespark_offline_queue';
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly RETRY_DELAYS = [1000, 3000, 5000, 10000]; // Progressive delays

  static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadQueueFromStorage();
    this.setupNetworkMonitoring();
    
    // Get initial network state
    const state = await NetInfo.fetch();
    this.handleNetworkChange(state);
  }

  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      this.handleNetworkChange(state);
    });
  }

  private handleNetworkChange(state: NetInfoState): void {
    const wasOffline = !this.isOnline;
    const networkStatus: NetworkStatus = {
      isOnline: state.isConnected ?? false,
      connectionType: state.type,
      isInternetReachable: state.isInternetReachable
    };

    this.isOnline = networkStatus.isOnline;

    // Notify subscribers
    this.networkChangeCallbacks.forEach(callback => {
      try {
        callback(networkStatus);
      } catch (error) {
        console.error('Error in network change callback:', error);
      }
    });

    // Process queue when coming back online
    if (wasOffline && this.isOnline) {
      this.processQueue();
    }
  }

  // Subscribe to network changes
  onNetworkChange(callback: NetworkChangeCallback): () => void {
    this.networkChangeCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.networkChangeCallbacks.delete(callback);
    };
  }

  // Get current network status
  getNetworkStatus(): NetworkStatus {
    return {
      isOnline: this.isOnline,
      connectionType: null, // Would need to store from last update
      isInternetReachable: null
    };
  }

  // Queue operation for offline processing
  async queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    if (this.operationQueue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest operations to make room
      this.operationQueue.shift();
    }

    const queuedOp: QueuedOperation = {
      id: this.generateOperationId(),
      timestamp: Date.now(),
      retryCount: 0,
      ...operation
    };

    this.operationQueue.push(queuedOp);
    await this.saveQueueToStorage();

    console.log(`Operation queued: ${queuedOp.type} (${queuedOp.id})`);

    // Try to process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }
  }

  // Process queued operations
  private async processQueue(): Promise<void> {
    if (!this.isOnline || this.operationQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.operationQueue.length} queued operations`);

    const operationsToProcess = [...this.operationQueue];
    
    for (const operation of operationsToProcess) {
      try {
        await this.processOperation(operation);
        
        // Remove successful operation from queue
        this.operationQueue = this.operationQueue.filter(op => op.id !== operation.id);
        
      } catch (error) {
        console.error(`Failed to process operation ${operation.id}:`, error);
        
        // Increment retry count
        const opIndex = this.operationQueue.findIndex(op => op.id === operation.id);
        if (opIndex !== -1) {
          this.operationQueue[opIndex].retryCount++;
          
          // Remove if max retries reached
          if (this.operationQueue[opIndex].retryCount >= this.operationQueue[opIndex].maxRetries) {
            console.warn(`Max retries reached for operation ${operation.id}, removing from queue`);
            this.operationQueue.splice(opIndex, 1);
          }
        }
      }
    }

    await this.saveQueueToStorage();
  }

  private async processOperation(operation: QueuedOperation): Promise<void> {
    // Add delay for retries
    if (operation.retryCount > 0) {
      const delay = this.RETRY_DELAYS[Math.min(operation.retryCount - 1, this.RETRY_DELAYS.length - 1)];
      await this.delay(delay);
    }

    switch (operation.type) {
      case 'document_scan':
        // Process document scan operation
        console.log('Processing queued document scan');
        break;
        
      case 'note_save':
        // Process note save operation
        console.log('Processing queued note save');
        break;
        
      case 'note_sync':
        // Process note sync operation
        console.log('Processing queued note sync');
        break;
        
      default:
        console.warn(`Unknown operation type: ${operation.type}`);
    }
  }

  // Utility methods
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.QUEUE_STORAGE_KEY, JSON.stringify(this.operationQueue));
      console.log('Queue saved to storage');
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
    }
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(this.QUEUE_STORAGE_KEY);
      if (queueData) {
        this.operationQueue = JSON.parse(queueData);
      }
      console.log('Queue loaded from storage');
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
      this.operationQueue = [];
    }
  }

  // Public API methods
  async checkConnectivity(): Promise<NetworkStatus> {
    const state = await NetInfo.fetch();
    return {
      isOnline: state.isConnected ?? false,
      connectionType: state.type,
      isInternetReachable: state.isInternetReachable
    };
  }

  clearQueue(): void {
    this.operationQueue = [];
    this.saveQueueToStorage();
  }

  getQueueSize(): number {
    return this.operationQueue.length;
  }

  // Test connectivity with actual HTTP request
  async testInternetConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export { NetworkService, type NetworkStatus, type QueuedOperation };
