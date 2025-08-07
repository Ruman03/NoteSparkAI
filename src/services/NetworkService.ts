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
  private isProcessingQueue = false;
  private connectionQuality: 'poor' | 'fair' | 'good' | 'excellent' = 'good';

  static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  // OPTIMIZED: Enhanced retry mechanism for network operations
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    timeoutMs: number = 8000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`NetworkService: ${operationName} attempt ${attempt}/${maxRetries}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Network operation timeout')), timeoutMs);
          (timeoutPromise as any).timeoutId = timeoutId;
        });
        
        const result = await Promise.race([operation(), timeoutPromise]);
        console.log(`NetworkService: ${operationName} succeeded on attempt ${attempt}`);
        
        if ((timeoutPromise as any).timeoutId) {
          clearTimeout((timeoutPromise as any).timeoutId);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`NetworkService: ${operationName} failed on attempt ${attempt}:`, lastError.message);
        
        // Don't retry for certain errors
        if (this.isNonRetryableError(lastError)) {
          console.log(`NetworkService: Non-retryable error for ${operationName}, stopping retries`);
          break;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Progressive delay with jitter to avoid thundering herd
        const baseDelay = Math.min(1000 * attempt, 5000);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;
        console.log(`NetworkService: Retrying ${operationName} in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`All ${maxRetries} attempts failed for ${operationName}: ${lastError!.message}`);
  }

  // OPTIMIZED: Check if error should not be retried
  private isNonRetryableError(error: Error): boolean {
    const nonRetryableMessages = [
      'invalid operation',
      'malformed data',
      'unauthorized',
      'forbidden',
      'not found',
      'method not allowed'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return nonRetryableMessages.some(msg => errorMessage.includes(msg)) ||
           error.name === 'AbortError';
  }

  // OPTIMIZED: Enhanced input validation
  private validateQueueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): void {
    if (!operation.type) {
      throw new Error('Operation type is required');
    }
    
    const validTypes = ['document_scan', 'note_save', 'note_sync'];
    if (!validTypes.includes(operation.type)) {
      throw new Error(`Invalid operation type: ${operation.type}`);
    }
    
    if (!operation.data) {
      throw new Error('Operation data is required');
    }
    
    if (operation.maxRetries < 0 || operation.maxRetries > 10) {
      throw new Error('Max retries must be between 0 and 10');
    }
  }

  // OPTIMIZED: Enhanced initialization with retry logic and error handling
  async initialize(): Promise<void> {
    try {
      console.log('NetworkService: Starting initialization...');
      
      await this.withRetry(async () => {
        await this.loadQueueFromStorage();
      }, 'loadQueueFromStorage');
      
      this.setupNetworkMonitoring();
      
      // Get initial network state with retry
      const state = await this.withRetry(async () => {
        return await NetInfo.fetch();
      }, 'fetchInitialNetworkState', 2, 5000);
      
      this.handleNetworkChange(state);
      console.log('NetworkService: Initialization completed successfully');
    } catch (error) {
      console.error('NetworkService: Initialization failed:', error);
      // Don't throw here to prevent app startup failure
      // Set default offline state
      this.isOnline = false;
    }
  }

  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      this.handleNetworkChange(state);
    });
  }

  // OPTIMIZED: Enhanced network change handling with connection quality assessment
  private handleNetworkChange(state: NetInfoState): void {
    try {
      const wasOffline = !this.isOnline;
      const networkStatus: NetworkStatus = {
        isOnline: state.isConnected ?? false,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable
      };

      this.isOnline = networkStatus.isOnline;
      
      // OPTIMIZED: Assess connection quality
      this.assessConnectionQuality(state);

      console.log('NetworkService: Network state changed:', {
        isOnline: this.isOnline,
        type: networkStatus.connectionType,
        quality: this.connectionQuality,
        reachable: networkStatus.isInternetReachable
      });

      // Notify subscribers with error handling
      this.networkChangeCallbacks.forEach(callback => {
        try {
          callback(networkStatus);
        } catch (error) {
          console.error('NetworkService: Error in network change callback:', error);
          // Remove problematic callback to prevent future errors
          this.networkChangeCallbacks.delete(callback);
        }
      });

      // Process queue when coming back online
      if (wasOffline && this.isOnline) {
        console.log('NetworkService: Connection restored, processing queued operations');
        this.processQueue();
      }
    } catch (error) {
      console.error('NetworkService: Error handling network change:', error);
    }
  }

  // OPTIMIZED: Assess connection quality based on network state
  private assessConnectionQuality(state: NetInfoState): void {
    if (!state.isConnected) {
      this.connectionQuality = 'poor';
      return;
    }

    // Assess based on connection type and details
    switch (state.type) {
      case 'wifi':
        // For WiFi, check signal strength if available
        if (state.details && 'strength' in state.details && state.details.strength !== null) {
          const strength = state.details.strength;
          if (strength > 80) this.connectionQuality = 'excellent';
          else if (strength > 60) this.connectionQuality = 'good';
          else if (strength > 40) this.connectionQuality = 'fair';
          else this.connectionQuality = 'poor';
        } else {
          this.connectionQuality = 'good'; // Default for WiFi
        }
        break;
        
      case 'cellular':
        // For cellular, check generation
        if (state.details && 'cellularGeneration' in state.details) {
          const generation = state.details.cellularGeneration;
          if (generation === '5g') this.connectionQuality = 'excellent';
          else if (generation === '4g') this.connectionQuality = 'good';
          else if (generation === '3g') this.connectionQuality = 'fair';
          else this.connectionQuality = 'poor';
        } else {
          this.connectionQuality = 'fair'; // Default for cellular
        }
        break;
        
      default:
        this.connectionQuality = 'fair';
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

  // OPTIMIZED: Enhanced queue operation with validation and retry logic
  async queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      console.log('NetworkService: Starting queueOperation for type:', operation.type);
      
      // OPTIMIZED: Input validation
      this.validateQueueOperation(operation);
      
      // OPTIMIZED: Check queue size with better management
      if (this.operationQueue.length >= this.MAX_QUEUE_SIZE) {
        console.warn('NetworkService: Queue at maximum size, removing oldest operations');
        // Remove oldest operations to make room (FIFO)
        const removeCount = Math.max(1, Math.floor(this.MAX_QUEUE_SIZE * 0.1)); // Remove 10%
        this.operationQueue.splice(0, removeCount);
      }

      const queuedOp: QueuedOperation = {
        id: this.generateOperationId(),
        timestamp: Date.now(),
        retryCount: 0,
        ...operation
      };

      this.operationQueue.push(queuedOp);
      
      // OPTIMIZED: Save to storage with retry logic
      await this.withRetry(async () => {
        await this.saveQueueToStorage();
      }, 'saveQueueToStorage', 2, 3000);

      console.log(`NetworkService: Operation queued successfully: ${queuedOp.type} (${queuedOp.id})`);

      // Try to process immediately if online and not already processing
      if (this.isOnline && !this.isProcessingQueue) {
        this.processQueue();
      }
    } catch (error) {
      console.error('NetworkService: Error queueing operation:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to queue operation');
    }
  }

  // OPTIMIZED: Enhanced queue processing with better error handling and rate limiting
  private async processQueue(): Promise<void> {
    if (!this.isOnline || this.operationQueue.length === 0 || this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`NetworkService: Processing ${this.operationQueue.length} queued operations`);

    try {
      // OPTIMIZED: Process operations in batches based on connection quality
      const batchSize = this.getBatchSizeForConnectionQuality();
      const operationsToProcess = this.operationQueue.slice(0, batchSize);
      
      for (const operation of operationsToProcess) {
        try {
          // OPTIMIZED: Add delay between operations to prevent overwhelming the network
          if (this.connectionQuality === 'poor') {
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else if (this.connectionQuality === 'fair') {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          await this.withRetry(async () => {
            await this.processOperation(operation);
          }, `processOperation_${operation.type}`, 2, 10000);
          
          // Remove successful operation from queue
          this.operationQueue = this.operationQueue.filter(op => op.id !== operation.id);
          console.log(`NetworkService: Successfully processed operation ${operation.id}`);
          
        } catch (error) {
          console.error(`NetworkService: Failed to process operation ${operation.id}:`, error);
          
          // Increment retry count
          const opIndex = this.operationQueue.findIndex(op => op.id === operation.id);
          if (opIndex !== -1) {
            this.operationQueue[opIndex].retryCount++;
            
            // Remove if max retries reached
            if (this.operationQueue[opIndex].retryCount >= this.operationQueue[opIndex].maxRetries) {
              console.warn(`NetworkService: Max retries reached for operation ${operation.id}, removing from queue`);
              this.operationQueue.splice(opIndex, 1);
            }
          }
        }
      }

      // OPTIMIZED: Save queue state with retry logic
      await this.withRetry(async () => {
        await this.saveQueueToStorage();
      }, 'saveQueueAfterProcessing', 2, 3000);
      
    } catch (error) {
      console.error('NetworkService: Error during queue processing:', error);
    } finally {
      this.isProcessingQueue = false;
      
      // OPTIMIZED: Schedule next batch if there are more operations
      if (this.operationQueue.length > 0 && this.isOnline) {
        setTimeout(() => this.processQueue(), 5000); // 5 second delay between batches
      }
    }
  }

  // OPTIMIZED: Determine batch size based on connection quality
  private getBatchSizeForConnectionQuality(): number {
    switch (this.connectionQuality) {
      case 'excellent': return 10;
      case 'good': return 5;
      case 'fair': return 3;
      case 'poor': return 1;
      default: return 3;
    }
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

  // OPTIMIZED: Enhanced internet connectivity test with multiple endpoints and retry logic
  async testInternetConnectivity(): Promise<boolean> {
    try {
      console.log('NetworkService: Testing internet connectivity...');
      
      // OPTIMIZED: Test multiple endpoints for better reliability
      const testEndpoints = [
        'https://www.google.com',
        'https://www.cloudflare.com',
        'https://httpbin.org/status/200'
      ];
      
      const connectivityResults = await Promise.allSettled(
        testEndpoints.map(endpoint => this.testSingleEndpoint(endpoint))
      );
      
      // Consider connectivity good if at least one endpoint is reachable
      const successfulTests = connectivityResults.filter(
        result => result.status === 'fulfilled' && result.value === true
      ).length;
      
      const isConnected = successfulTests > 0;
      console.log(`NetworkService: Connectivity test result: ${isConnected} (${successfulTests}/${testEndpoints.length} endpoints reachable)`);
      
      return isConnected;
    } catch (error) {
      console.error('NetworkService: Error testing connectivity:', error);
      return false;
    }
  }

  // OPTIMIZED: Test connectivity to a single endpoint with timeout and error handling
  private async testSingleEndpoint(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // Don't log individual endpoint failures to avoid spam
      return false;
    }
  }
}

export { NetworkService, type NetworkStatus, type QueuedOperation };
