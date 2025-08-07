// src/services/ServiceContainer.ts
// OPTIMIZED: Dependency Injection Container to Replace Singletons

type ServiceFactory<T> = () => T;
type ServiceInstance<T> = T;

interface ServiceDefinition<T> {
  factory: ServiceFactory<T>;
  instance?: ServiceInstance<T>;
  singleton: boolean;
}

class ServiceContainer {
  private static instance: ServiceContainer;
  private services: Map<string, ServiceDefinition<any>> = new Map();

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * Register a service with the container
   */
  register<T>(
    key: string, 
    factory: ServiceFactory<T>, 
    singleton: boolean = true
  ): void {
    this.services.set(key, {
      factory,
      singleton,
    });
  }

  /**
   * Get a service instance
   */
  get<T>(key: string): T {
    const serviceDefinition = this.services.get(key);
    
    if (!serviceDefinition) {
      throw new Error(`Service '${key}' not registered`);
    }

    // If singleton and already instantiated, return existing instance
    if (serviceDefinition.singleton && serviceDefinition.instance) {
      return serviceDefinition.instance;
    }

    // Create new instance
    const instance = serviceDefinition.factory();
    
    // Store instance if singleton
    if (serviceDefinition.singleton) {
      serviceDefinition.instance = instance;
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Clear a specific service instance (useful for cleanup)
   */
  clearInstance(key: string): void {
    const serviceDefinition = this.services.get(key);
    if (serviceDefinition) {
      serviceDefinition.instance = undefined;
    }
  }

  /**
   * Clear all service instances (useful for testing or app cleanup)
   */
  clearAllInstances(): void {
    this.services.forEach(definition => {
      definition.instance = undefined;
    });
  }

  /**
   * Get all registered service keys
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clean up the container (useful for app shutdown)
   */
  cleanup(): void {
    this.clearAllInstances();
    this.services.clear();
  }
}

// Service registry for easy service registration and retrieval
export class ServiceRegistry {
  private static container = ServiceContainer.getInstance();

  /**
   * Register services with the container
   */
  static registerServices() {
    // Import services dynamically to avoid circular dependencies
    const registerService = (key: string, modulePath: string, className: string) => {
      this.container.register(key, () => {
        const serviceModule = require(modulePath);
        const ServiceClass = serviceModule[className];
        return ServiceClass.getInstance();
      });
    };

    // Register all services
    registerService('notesService', './NotesService', 'NotesService');
    registerService('folderService', './FolderService', 'FolderService');
    registerService('aiService', './AIService', 'AIService');
    registerService('authService', './AuthService', 'AuthService');
    registerService('hapticService', './HapticService', 'HapticService');
  }

  /**
   * Get a service instance
   */
  static getService<T>(key: string): T {
    return this.container.get<T>(key);
  }

  /**
   * Check if service is available
   */
  static hasService(key: string): boolean {
    return this.container.has(key);
  }

  /**
   * Clean up specific service
   */
  static cleanupService(key: string): void {
    this.container.clearInstance(key);
  }

  /**
   * Clean up all services
   */
  static cleanupAll(): void {
    this.container.cleanup();
  }
}

// Initialize services on app start
ServiceRegistry.registerServices();

export default ServiceContainer;
