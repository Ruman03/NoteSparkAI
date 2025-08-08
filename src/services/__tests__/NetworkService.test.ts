import { NetworkService } from '../NetworkService';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('NetworkService', () => {
  let networkService: NetworkService;

  beforeEach(() => {
    networkService = NetworkService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = NetworkService.getInstance();
      const instance2 = NetworkService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('checkConnectivity', () => {
    it('should return online status', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
      });

      const status = await networkService.checkConnectivity();
      
      expect(status).toEqual({
        isOnline: true,
        connectionType: 'wifi',
        isInternetReachable: true,
      });
    });

    it('should return offline status', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
      });

      const status = await networkService.checkConnectivity();
      
      expect(status).toEqual({
        isOnline: false,
        connectionType: 'none',
        isInternetReachable: false,
      });
    });

    it('should handle NetInfo errors gracefully', async () => {
      (NetInfo.fetch as jest.Mock).mockRejectedValueOnce(new Error('NetInfo error'));

      await expect(networkService.checkConnectivity()).rejects.toThrow('NetInfo error');
    });
  });

  describe('queueOperation', () => {
    beforeEach(() => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    });

    it('should queue an operation', async () => {
      const operation = {
        type: 'note_save' as const,
        data: { title: 'Test Note', content: 'Test content' },
        maxRetries: 3,
      };

      await networkService.queueOperation(operation);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'notespark_offline_queue',
        expect.any(String)
      );
    });

    it('should handle queue storage errors', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const operation = {
        type: 'note_save' as const,
        data: { title: 'Test Note' },
        maxRetries: 3,
      };

      await expect(networkService.queueOperation(operation)).rejects.toThrow('Storage error');
    });
  });

  describe('clearQueue', () => {
    it('should clear the operation queue', () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      networkService.clearQueue();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'notespark_offline_queue',
        '[]'
      );
    });
  });

  describe('getQueueSize', () => {
    it('should return the current queue size', () => {
      const size = networkService.getQueueSize();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('testInternetConnectivity', () => {
    it('should test internet connectivity successfully', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const isConnected = await networkService.testInternetConnectivity();

      expect(isConnected).toBe(true);
      expect(fetch).toHaveBeenCalledWith('https://www.google.com', {
        method: 'HEAD',
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle connectivity test failure', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      const isConnected = await networkService.testInternetConnectivity();

      expect(isConnected).toBe(false);
    });

    it('should handle timeout', async () => {
      global.fetch = jest.fn().mockImplementationOnce(
  () => new Promise(resolve => { const t = setTimeout(resolve, 6000); (t as any).unref?.(); }) // 6 seconds, longer than 5s timeout
      );

      const isConnected = await networkService.testInternetConnectivity();

      expect(isConnected).toBe(false);
    });
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
      });
      (NetInfo.addEventListener as jest.Mock).mockReturnValueOnce(jest.fn());

      await expect(networkService.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        type: 'wifi',
      });
      (NetInfo.addEventListener as jest.Mock).mockReturnValueOnce(jest.fn());

      await expect(networkService.initialize()).resolves.not.toThrow();
    });
  });

  describe('queue persistence', () => {
    it('should handle corrupted queue data during initialization', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid json');
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        type: 'wifi',
      });
      (NetInfo.addEventListener as jest.Mock).mockReturnValueOnce(jest.fn());

      await expect(networkService.initialize()).resolves.not.toThrow();
    });

    it('should handle empty queue data during initialization', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        type: 'wifi',
      });
      (NetInfo.addEventListener as jest.Mock).mockReturnValueOnce(jest.fn());

      await expect(networkService.initialize()).resolves.not.toThrow();
    });
  });
});
