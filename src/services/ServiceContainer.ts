// src/services/ServiceContainer.ts
// OPTIMIZED: Enhanced Dependency Injection Container with comprehensive error handling and monitoring

// Enhanced interfaces for better type safety and functionality
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface ServiceMetrics {
  registrationsCount: number;
  instantiationsCount: number;
  instantiationErrors: number;
  retrievalsCount: number;
  retrievalErrors: number;
  lastSuccess?: Date;
  lastError?: string;
}

interface ServiceHealth {
  isHealthy: boolean;
  lastInstantiation?: Date;
  instantiationCount: number;
  errorCount: number;
  status: 'healthy' | 'degraded' | 'failed';
}

type ServiceFactory<T> = () => T;
type ServiceInstance<T> = T;

interface ServiceDefinition<T> {
  factory: ServiceFactory<T>;
  instance?: ServiceInstance<T>;
  singleton: boolean;
  health: ServiceHealth;
  created: Date;
  dependencies?: string[];
}

// Enhanced constants
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 5000,
  backoffFactor: 2
};

const SERVICE_INSTANTIATION_TIMEOUT = 10000; // 10 seconds timeout for service instantiation
const MAX_SERVICE_NAME_LENGTH = 100;
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

const NON_RETRYABLE_ERRORS = [
  'service not registered',
  'circular dependency',
  'invalid service key',
  'factory not provided'
];

/**
 * Enhanced Service Container
 * OPTIMIZED: Comprehensive error handling, retry logic, and service monitoring
 */
class ServiceContainer {
  private static instance: ServiceContainer;
  private services: Map<string, ServiceDefinition<any>> = new Map();
  private metrics: ServiceMetrics = {
    registrationsCount: 0,
    instantiationsCount: 0,
    instantiationErrors: 0,
    retrievalsCount: 0,
    retrievalErrors: 0
  };
  private instantiationStack: Set<string> = new Set(); // For circular dependency detection

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * Enhanced retry mechanism with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T> | T,
    operationName: string,
    options: RetryOptions = DEFAULT_RETRY_OPTIONS
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
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
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    this.updateMetrics('error', { error: lastError!.message });
    throw new Error(`${operationName} failed after ${options.maxRetries + 1} attempts: ${lastError!.message}`);
  }

  /**
   * Validate service registration parameters
   */
  private validateServiceRegistration<T>(key: string, factory: ServiceFactory<T>): void {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('Service key must be a non-empty string');
    }

    if (key.length > MAX_SERVICE_NAME_LENGTH) {
      throw new Error(`Service key too long (max ${MAX_SERVICE_NAME_LENGTH} characters)`);
    }

    if (!factory || typeof factory !== 'function') {
      throw new Error('Service factory must be a function');
    }

    // Check for invalid characters in service key
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      throw new Error('Service key contains invalid characters (only alphanumeric, underscore, and dash allowed)');
    }
  }

  /**
   * Update service metrics
   */
  private updateMetrics(operation: string, data: any = {}): void {
    try {
      switch (operation) {
        case 'registration':
          this.metrics.registrationsCount++;
          this.metrics.lastSuccess = new Date();
          break;
        case 'instantiation':
          this.metrics.instantiationsCount++;
          this.metrics.lastSuccess = new Date();
          break;
        case 'retrieval':
          this.metrics.retrievalsCount++;
          this.metrics.lastSuccess = new Date();
          break;
        case 'instantiation_error':
          this.metrics.instantiationErrors++;
          this.metrics.lastError = data.error || 'Unknown instantiation error';
          break;
        case 'retrieval_error':
          this.metrics.retrievalErrors++;
          this.metrics.lastError = data.error || 'Unknown retrieval error';
          break;
        case 'error':
          this.metrics.lastError = data.error || 'Unknown error';
          break;
      }
    } catch (error) {
      console.error('Error updating service container metrics:', error);
    }
  }

  /**
   * Register a service with enhanced validation and error handling
   */
  register<T>(
    key: string, 
    factory: ServiceFactory<T>, 
    singleton: boolean = true,
    dependencies: string[] = []
  ): void {
    try {
      // Validate input parameters
      this.validateServiceRegistration(key, factory);

      // Check for existing registration
      if (this.services.has(key)) {
        console.warn(`Service '${key}' is already registered. Overriding existing registration.`);
      }

      // Create service definition with health tracking
      const serviceDefinition: ServiceDefinition<T> = {
        factory,
        singleton,
        dependencies,
        created: new Date(),
        health: {
          isHealthy: true,
          instantiationCount: 0,
          errorCount: 0,
          status: 'healthy'
        }
      };

      this.services.set(key, serviceDefinition);
      this.updateMetrics('registration');
      
      console.log(`Service '${key}' registered successfully`);
    } catch (error) {
      console.error(`Failed to register service '${key}':`, error);
      this.updateMetrics('error', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get a service instance with enhanced error handling and circular dependency detection
   */
  get<T>(key: string): T {
    try {
      // Input validation
      if (!key || typeof key !== 'string' || key.trim().length === 0) {
        throw new Error('Service key must be a non-empty string');
      }

      this.updateMetrics('retrieval');

      return this.withRetry(() => {
        const serviceDefinition = this.services.get(key);
        
        if (!serviceDefinition) {
          throw new Error(`Service '${key}' not registered`);
        }

        // Check for circular dependency
        if (this.instantiationStack.has(key)) {
          const dependencyChain = Array.from(this.instantiationStack).join(' -> ') + ' -> ' + key;
          throw new Error(`Circular dependency detected: ${dependencyChain}`);
        }

        // If singleton and already instantiated, return existing instance
        if (serviceDefinition.singleton && serviceDefinition.instance) {
          return serviceDefinition.instance;
        }

        // Add to instantiation stack for circular dependency detection
        this.instantiationStack.add(key);

        try {
          // Create new instance with timeout protection
          const instance = this.createServiceInstance(serviceDefinition, key);
          
          // Store instance if singleton
          if (serviceDefinition.singleton) {
            serviceDefinition.instance = instance;
          }

          // Update health metrics
          serviceDefinition.health.instantiationCount++;
          serviceDefinition.health.lastInstantiation = new Date();
          serviceDefinition.health.isHealthy = true;
          serviceDefinition.health.status = 'healthy';

          this.updateMetrics('instantiation');
          return instance;

        } finally {
          // Remove from instantiation stack
          this.instantiationStack.delete(key);
        }
      }, `getService(${key})`) as T;

    } catch (error) {
      console.error(`Failed to get service '${key}':`, error);
      
      // Update service health if service exists
      const serviceDefinition = this.services.get(key);
      if (serviceDefinition) {
        serviceDefinition.health.errorCount++;
        serviceDefinition.health.isHealthy = false;
        serviceDefinition.health.status = serviceDefinition.health.errorCount > 5 ? 'failed' : 'degraded';
      }
      
      this.updateMetrics('retrieval_error', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Create service instance with timeout protection
   */
  private createServiceInstance<T>(serviceDefinition: ServiceDefinition<T>, key: string): T {
    try {
      // Create instance with timeout protection
      const factoryPromise = new Promise<T>((resolve, reject) => {
        try {
          const result = serviceDefinition.factory();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Service instantiation timeout for '${key}'`)), SERVICE_INSTANTIATION_TIMEOUT)
      );

      // For synchronous factories, this will resolve immediately
      // For asynchronous factories, this provides timeout protection
      return Promise.race([factoryPromise, timeoutPromise]) as any;

    } catch (error) {
      this.updateMetrics('instantiation_error', { error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to instantiate service '${key}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a service is registered with enhanced validation
   */
  has(key: string): boolean {
    try {
      if (!key || typeof key !== 'string') {
        return false;
      }
      return this.services.has(key);
    } catch (error) {
      console.error('Error checking service registration:', error);
      return false;
    }
  }

  /**
   * Clear a specific service instance with enhanced error handling
   */
  clearInstance(key: string): boolean {
    try {
      if (!key || typeof key !== 'string' || key.trim().length === 0) {
        throw new Error('Service key must be a non-empty string');
      }

      const serviceDefinition = this.services.get(key);
      if (serviceDefinition) {
        serviceDefinition.instance = undefined;
        console.log(`Service instance '${key}' cleared successfully`);
        return true;
      }
      
      console.warn(`Service '${key}' not found for instance clearing`);
      return false;
    } catch (error) {
      console.error(`Failed to clear service instance '${key}':`, error);
      return false;
    }
  }

  /**
   * Clear all service instances with enhanced error handling
   */
  clearAllInstances(): { cleared: number; errors: number } {
    let cleared = 0;
    let errors = 0;

    try {
      this.services.forEach((definition, key) => {
        try {
          definition.instance = undefined;
          cleared++;
        } catch (error) {
          console.error(`Error clearing instance for service '${key}':`, error);
          errors++;
        }
      });

      console.log(`Cleared ${cleared} service instances (${errors} errors)`);
      return { cleared, errors };
    } catch (error) {
      console.error('Error clearing all service instances:', error);
      return { cleared, errors: errors + 1 };
    }
  }

  /**
   * Get all registered service keys with health status
   */
  getRegisteredServices(): Array<{
    key: string;
    singleton: boolean;
    hasInstance: boolean;
    health: ServiceHealth;
    created: Date;
    dependencies: string[];
  }> {
    try {
      return Array.from(this.services.entries()).map(([key, definition]) => ({
        key,
        singleton: definition.singleton,
        hasInstance: !!definition.instance,
        health: { ...definition.health },
        created: definition.created,
        dependencies: definition.dependencies || []
      }));
    } catch (error) {
      console.error('Error getting registered services:', error);
      return [];
    }
  }

  /**
   * Get service health status
   */
  getServiceHealth(key: string): ServiceHealth | null {
    try {
      const serviceDefinition = this.services.get(key);
      return serviceDefinition ? { ...serviceDefinition.health } : null;
    } catch (error) {
      console.error(`Error getting health for service '${key}':`, error);
      return null;
    }
  }

  /**
   * Get container health status and metrics
   */
  getContainerHealth(): {
    isHealthy: boolean;
    metrics: ServiceMetrics;
    servicesCount: number;
    healthyServices: number;
    unhealthyServices: number;
    containerStatus: string;
  } {
    try {
      const services = Array.from(this.services.values());
      const healthyServices = services.filter(s => s.health.isHealthy).length;
      const unhealthyServices = services.length - healthyServices;
      const isHealthy = unhealthyServices === 0 && this.metrics.instantiationErrors < 10;

      return {
        isHealthy,
        metrics: { ...this.metrics },
        servicesCount: services.length,
        healthyServices,
        unhealthyServices,
        containerStatus: isHealthy ? 'healthy' : unhealthyServices > services.length / 2 ? 'failed' : 'degraded'
      };
    } catch (error) {
      console.error('Error getting container health:', error);
      return {
        isHealthy: false,
        metrics: { ...this.metrics },
        servicesCount: 0,
        healthyServices: 0,
        unhealthyServices: 0,
        containerStatus: 'failed'
      };
    }
  }

  /**
   * Clean up the container with enhanced error handling
   */
  cleanup(): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // Clear all instances first
      const clearResult = this.clearAllInstances();
      if (clearResult.errors > 0) {
        errors.push(`${clearResult.errors} errors occurred while clearing instances`);
      }

      // Clear the services map
      this.services.clear();
      
      // Reset metrics
      this.metrics = {
        registrationsCount: 0,
        instantiationsCount: 0,
        instantiationErrors: 0,
        retrievalsCount: 0,
        retrievalErrors: 0
      };

      // Clear instantiation stack
      this.instantiationStack.clear();

      console.log('ServiceContainer cleanup completed successfully');
      return { success: errors.length === 0, errors };
    } catch (error) {
      const errorMessage = `Failed to cleanup ServiceContainer: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      errors.push(errorMessage);
      return { success: false, errors };
    }
  }

  /**
   * Reset metrics (for testing/debugging)
   */
  resetMetrics(): void {
    try {
      this.metrics = {
        registrationsCount: 0,
        instantiationsCount: 0,
        instantiationErrors: 0,
        retrievalsCount: 0,
        retrievalErrors: 0
      };
      console.log('ServiceContainer metrics reset successfully');
    } catch (error) {
      console.error('Error resetting ServiceContainer metrics:', error);
    }
  }
}

/**
 * Enhanced Service registry for easy service registration and retrieval
 * OPTIMIZED: Comprehensive error handling and enhanced service management
 */
export class ServiceRegistry {
  private static container = ServiceContainer.getInstance();
  private static initialized = false;

  /**
   * Register services with enhanced error handling and validation
   */
  static registerServices(): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      if (this.initialized) {
        console.warn('ServiceRegistry already initialized. Skipping re-registration.');
        return { success: true, errors: [] };
      }

      // Helper function to safely register a service
      const registerService = (key: string, modulePath: string, className: string, dependencies: string[] = []) => {
        try {
          this.container.register(key, () => {
            try {
              const serviceModule = require(modulePath);
              const ServiceClass = serviceModule[className];
              
              if (!ServiceClass) {
                throw new Error(`Service class '${className}' not found in module '${modulePath}'`);
              }
              
              if (typeof ServiceClass.getInstance !== 'function') {
                throw new Error(`Service class '${className}' does not have getInstance method`);
              }
              
              return ServiceClass.getInstance();
            } catch (moduleError) {
              console.error(`Error loading service module '${modulePath}':`, moduleError);
              throw new Error(`Failed to load service '${key}': ${moduleError instanceof Error ? moduleError.message : String(moduleError)}`);
            }
          }, true, dependencies);
          
          console.log(`Service '${key}' registered successfully`);
        } catch (error) {
          const errorMessage = `Failed to register service '${key}': ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMessage);
          errors.push(errorMessage);
        }
      };

      // Register all services with their dependencies
      registerService('authService', './AuthService', 'AuthService');
      registerService('notesService', './NotesService', 'NotesService', ['authService']);
      registerService('folderService', './FolderService', 'FolderService', ['authService']);
      registerService('aiService', './AIService', 'AIService');
      registerService('hapticService', './HapticService', 'HapticService');
      registerService('networkService', './NetworkService', 'NetworkService');
      registerService('visionService', './VisionService', 'VisionService');
      registerService('voiceToTextService', './VoiceToTextService', 'VoiceToTextService');
      registerService('versionHistoryService', './VersionHistoryService', 'VersionHistoryService');
      registerService('imageQualityService', './ImageQualityService', 'ImageQualityService');
      registerService('imageCroppingService', './ImageCroppingService', 'ImageCroppingService');
      registerService('documentProcessor', './DocumentProcessor', 'DocumentProcessor');

      this.initialized = true;
      console.log(`ServiceRegistry initialization completed. ${this.container.getRegisteredServices().length} services registered (${errors.length} errors)`);
      
      return { success: errors.length === 0, errors };
    } catch (error) {
      const errorMessage = `Critical error during service registration: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      errors.push(errorMessage);
      return { success: false, errors };
    }
  }

  /**
   * Get a service instance with enhanced error handling
   */
  static getService<T>(key: string): T {
    try {
      if (!this.initialized) {
        console.warn('ServiceRegistry not initialized. Attempting to initialize...');
        const initResult = this.registerServices();
        if (!initResult.success) {
          throw new Error(`Failed to initialize ServiceRegistry: ${initResult.errors.join(', ')}`);
        }
      }

      return this.container.get<T>(key);
    } catch (error) {
      console.error(`Failed to get service '${key}':`, error);
      throw new Error(`Service '${key}' is not available: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if service is available with enhanced validation
   */
  static hasService(key: string): boolean {
    try {
      if (!key || typeof key !== 'string') {
        return false;
      }
      return this.container.has(key);
    } catch (error) {
      console.error(`Error checking service availability '${key}':`, error);
      return false;
    }
  }

  /**
   * Get service health status
   */
  static getServiceHealth(key: string): ServiceHealth | null {
    try {
      return this.container.getServiceHealth(key);
    } catch (error) {
      console.error(`Error getting service health '${key}':`, error);
      return null;
    }
  }

  /**
   * Get all registered services with health status
   */
  static getAllServices(): Array<{
    key: string;
    singleton: boolean;
    hasInstance: boolean;
    health: ServiceHealth;
    created: Date;
    dependencies: string[];
  }> {
    try {
      return this.container.getRegisteredServices();
    } catch (error) {
      console.error('Error getting all services:', error);
      return [];
    }
  }

  /**
   * Get registry health status
   */
  static getRegistryHealth(): {
    isHealthy: boolean;
    initialized: boolean;
    containerHealth: any;
  } {
    try {
      return {
        isHealthy: this.initialized && this.container.getContainerHealth().isHealthy,
        initialized: this.initialized,
        containerHealth: this.container.getContainerHealth()
      };
    } catch (error) {
      console.error('Error getting registry health:', error);
      return {
        isHealthy: false,
        initialized: false,
        containerHealth: null
      };
    }
  }

  /**
   * Clean up specific service with enhanced error handling
   */
  static cleanupService(key: string): boolean {
    try {
      return this.container.clearInstance(key);
    } catch (error) {
      console.error(`Error cleaning up service '${key}':`, error);
      return false;
    }
  }

  /**
   * Clean up all services with enhanced error handling
   */
  static cleanupAll(): { success: boolean; errors: string[] } {
    try {
      const cleanupResult = this.container.cleanup();
      this.initialized = false;
      console.log('ServiceRegistry cleanup completed');
      return cleanupResult;
    } catch (error) {
      const errorMessage = `Error during ServiceRegistry cleanup: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      return { success: false, errors: [errorMessage] };
    }
  }

  /**
   * Reinitialize the registry (useful for testing or recovery)
   */
  static reinitialize(): { success: boolean; errors: string[] } {
    try {
      console.log('Reinitializing ServiceRegistry...');
      const cleanupResult = this.cleanupAll();
      const initResult = this.registerServices();
      
      return {
        success: cleanupResult.success && initResult.success,
        errors: [...cleanupResult.errors, ...initResult.errors]
      };
    } catch (error) {
      const errorMessage = `Error during ServiceRegistry reinitialization: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      return { success: false, errors: [errorMessage] };
    }
  }
}

// Initialize services on app start with error handling
try {
  const initResult = ServiceRegistry.registerServices();
  if (!initResult.success) {
    console.error('ServiceRegistry initialization completed with errors:', initResult.errors);
  }
} catch (error) {
  console.error('Critical error during ServiceRegistry initialization:', error);
}

export default ServiceContainer;
