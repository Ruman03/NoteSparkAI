import { NotesService } from '../NotesService';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Mock Firebase modules
jest.mock('@react-native-firebase/firestore', () => {
  const mockAdd = jest.fn();
  const docObj = {
    set: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    onSnapshot: jest.fn(),
  };
  const mockDoc = jest.fn(() => docObj);
  const orderByObj = {
    limit: jest.fn(() => ({
      get: jest.fn(),
      onSnapshot: jest.fn(),
    })),
    get: jest.fn(),
    onSnapshot: jest.fn(),
  };
  const mockOrderBy = jest.fn(() => orderByObj);
  const whereObj = {
    orderBy: mockOrderBy,
    get: jest.fn(),
    onSnapshot: jest.fn(),
  };
  const mockWhere = jest.fn(() => whereObj);
  const mockCollection = {
    add: mockAdd,
    doc: mockDoc,
    where: mockWhere,
    orderBy: mockOrderBy,
    get: jest.fn(),
    onSnapshot: jest.fn(),
  };
  const mockFirestoreInstance = {
    collection: jest.fn(() => mockCollection),
  };
  const defaultExport = jest.fn(() => mockFirestoreInstance);
  return { __esModule: true, default: defaultExport };
});

jest.mock('@react-native-firebase/auth', () => {
  const defaultExport = jest.fn(() => ({
    currentUser: {
      uid: 'test-user-id',
      email: 'test@example.com',
    },
  }));
  return { __esModule: true, default: defaultExport };
});

describe('NotesService', () => {
  let notesService: NotesService;
  let mockFirestore: any;
  let mockCollection: any;
  let mockDoc: any;
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    notesService = NotesService.getInstance();
    mockFirestore = firestore();
    mockCollection = mockFirestore.collection();
    mockDoc = mockCollection.doc();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = NotesService.getInstance();
      const instance2 = NotesService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('saveNote', () => {
    const mockNote = {
      title: 'Test Note',
      content: '<p>Test content</p>',
      plainText: 'Test content',
      tone: 'professional' as const,
      originalText: 'Original text',
      tags: ['tag1', 'tag2'],
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    it('should save a new note successfully', async () => {
      const mockNoteId = 'test-note-id';
      mockCollection.add.mockResolvedValueOnce({ id: mockNoteId });

      const result = await notesService.saveNote(mockUserId, mockNote);

      expect(result).toBe(mockNoteId);
      expect(mockFirestore.collection).toHaveBeenCalledWith('notes');
      expect(mockCollection.add).toHaveBeenCalledWith({
        ...mockNote,
        userId: 'test-user-id',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should handle save errors gracefully', async () => {
      mockCollection.add.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(notesService.saveNote(mockUserId, mockNote)).rejects.toThrow('Firestore error');
    });

    it('should require user authentication', async () => {
      // Mock unauthenticated user
      (auth as any).mockReturnValueOnce({
        currentUser: null,
      });

      await expect(notesService.saveNote(mockUserId, mockNote)).rejects.toThrow('User not authenticated');
    });
  });

  describe('updateNote', () => {
    const mockNoteId = 'test-note-id';
    const mockUpdates = {
      title: 'Updated Title',
      content: '<p>Updated content</p>',
      updatedAt: new Date(),
    };

    it('should update a note successfully', async () => {
      mockDoc.update.mockResolvedValueOnce(undefined);

      await notesService.updateNote(mockUserId, mockNoteId, mockUpdates);

      expect(mockFirestore.collection).toHaveBeenCalledWith('notes');
      expect(mockCollection.doc).toHaveBeenCalledWith(mockNoteId);
      expect(mockDoc.update).toHaveBeenCalledWith({
        ...mockUpdates,
        updatedAt: expect.any(Date),
      });
    });

    it('should handle update errors gracefully', async () => {
      mockDoc.update.mockRejectedValueOnce(new Error('Update failed'));

      await expect(notesService.updateNote(mockUserId, mockNoteId, mockUpdates)).rejects.toThrow('Update failed');
    });
  });

  describe('deleteNote', () => {
    const mockNoteId = 'test-note-id';

    it('should delete a note successfully', async () => {
      mockDoc.delete.mockResolvedValueOnce(undefined);

      await notesService.deleteNote(mockUserId, mockNoteId);

      expect(mockFirestore.collection).toHaveBeenCalledWith('notes');
      expect(mockCollection.doc).toHaveBeenCalledWith(mockNoteId);
      expect(mockDoc.delete).toHaveBeenCalled();
    });

    it('should handle delete errors gracefully', async () => {
      mockDoc.delete.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(notesService.deleteNote(mockUserId, mockNoteId)).rejects.toThrow('Delete failed');
    });
  });

  describe('getNote', () => {
    const mockNoteId = 'test-note-id';
    const mockNoteData = {
      title: 'Test Note',
      content: '<p>Test content</p>',
      plainText: 'Test content',
      tone: 'professional',
      createdAt: { toDate: () => new Date('2025-01-01') },
      updatedAt: { toDate: () => new Date('2025-01-01') },
    };

    it('should retrieve a note successfully', async () => {
      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        id: mockNoteId,
        data: () => mockNoteData,
      });

      const result = await notesService.getNoteById(mockUserId, mockNoteId);

      expect(result).toEqual({
        id: mockNoteId,
        ...mockNoteData,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      });
      expect(mockFirestore.collection).toHaveBeenCalledWith('notes');
      expect(mockCollection.doc).toHaveBeenCalledWith(mockNoteId);
      expect(mockDoc.get).toHaveBeenCalled();
    });

    it('should return null for non-existent note', async () => {
      mockDoc.get.mockResolvedValueOnce({
        exists: false,
      });

      const result = await notesService.getNoteById(mockUserId, mockNoteId);

      expect(result).toBeNull();
    });

    it('should handle retrieval errors gracefully', async () => {
      mockDoc.get.mockRejectedValueOnce(new Error('Retrieval failed'));

      await expect(notesService.getNoteById(mockUserId, mockNoteId)).rejects.toThrow('Retrieval failed');
    });
  });

  describe('getUserNotes', () => {
    const mockNotesData = [
      {
        id: 'note1',
        data: () => ({
          title: 'Note 1',
          content: '<p>Content 1</p>',
          tone: 'professional',
          createdAt: { toDate: () => new Date('2025-01-01') },
          updatedAt: { toDate: () => new Date('2025-01-01') },
        }),
      },
      {
        id: 'note2',
        data: () => ({
          title: 'Note 2',
          content: '<p>Content 2</p>',
          tone: 'casual',
          createdAt: { toDate: () => new Date('2025-01-02') },
          updatedAt: { toDate: () => new Date('2025-01-02') },
        }),
      },
    ];

    it('should retrieve user notes successfully', async () => {
      const mockOrderBy = { get: jest.fn() };
      const mockWhere = { orderBy: jest.fn(() => mockOrderBy) };
      mockCollection.where.mockReturnValueOnce(mockWhere);
      mockOrderBy.get.mockResolvedValueOnce({
        docs: mockNotesData,
      });

      const result = await notesService.getUserNotes(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('note1');
      expect(result[0].title).toBe('Note 1');
      expect(result[1].id).toBe('note2');
      expect(result[1].title).toBe('Note 2');

      expect(mockCollection.where).toHaveBeenCalledWith('userId', '==', 'test-user-id');
      expect(mockWhere.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    });

    it('should handle empty results', async () => {
      const mockOrderBy = { get: jest.fn() };
      const mockWhere = { orderBy: jest.fn(() => mockOrderBy) };
      mockCollection.where.mockReturnValueOnce(mockWhere);
      mockOrderBy.get.mockResolvedValueOnce({
        docs: [],
      });

      const result = await notesService.getUserNotes(mockUserId);

      expect(result).toEqual([]);
    });

    it('should handle query errors gracefully', async () => {
      const mockOrderBy = { get: jest.fn() };
      const mockWhere = { orderBy: jest.fn(() => mockOrderBy) };
      mockCollection.where.mockReturnValueOnce(mockWhere);
      mockOrderBy.get.mockRejectedValueOnce(new Error('Query failed'));

      await expect(notesService.getUserNotes(mockUserId)).rejects.toThrow('Query failed');
    });
  });

  describe('searchNotes', () => {
    const mockSearchResults = [
      {
        id: 'note1',
        data: () => ({
          title: 'Meeting Notes',
          content: '<p>Project discussion</p>',
          plainText: 'Project discussion',
          tone: 'professional',
          createdAt: { toDate: () => new Date('2025-01-01') },
          updatedAt: { toDate: () => new Date('2025-01-01') },
        }),
      },
    ];

    it('should search notes by title', async () => {
      const mockOrderBy = { get: jest.fn() };
      const mockWhere = { orderBy: jest.fn(() => mockOrderBy) };
      mockCollection.where.mockReturnValueOnce(mockWhere);
      mockOrderBy.get.mockResolvedValueOnce({
        docs: mockSearchResults,
      });

      const result = await notesService.searchNotes(mockUserId, 'meeting');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Meeting Notes');
      expect(mockCollection.where).toHaveBeenCalledWith('userId', '==', 'test-user-id');
    });

    it('should handle empty search query', async () => {
      const result = await notesService.searchNotes(mockUserId, '');
      expect(result).toEqual([]);
    });

    it('should handle search errors gracefully', async () => {
      const mockOrderBy = { get: jest.fn() };
      const mockWhere = { orderBy: jest.fn(() => mockOrderBy) };
      mockCollection.where.mockReturnValueOnce(mockWhere);
      mockOrderBy.get.mockRejectedValueOnce(new Error('Search failed'));

      await expect(notesService.searchNotes(mockUserId, 'test')).rejects.toThrow('Search failed');
    });
  });

  // Note: real-time subscriptions not implemented in current NotesService
  /*
  describe('real-time subscriptions', () => {
    it('should subscribe to note changes', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      const mockOrderBy = { onSnapshot: jest.fn(() => mockUnsubscribe) };
      const mockWhere = { orderBy: jest.fn(() => mockOrderBy) };
      mockCollection.where.mockReturnValueOnce(mockWhere);

      const unsubscribe = notesService.subscribeToUserNotes(mockCallback);

      expect(mockCollection.where).toHaveBeenCalledWith('userId', '==', 'test-user-id');
      expect(mockWhere.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
      expect(mockOrderBy.onSnapshot).toHaveBeenCalledWith(mockCallback);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });
  */

  // Note: batch operations not implemented in current NotesService
  /*
  describe('batch operations', () => {
    it('should delete multiple notes', async () => {
      const noteIds = ['note1', 'note2', 'note3'];
      mockDoc.delete.mockResolvedValue(undefined);

      await notesService.deleteMultipleNotes(noteIds);

      expect(mockCollection.doc).toHaveBeenCalledTimes(3);
      expect(mockDoc.delete).toHaveBeenCalledTimes(3);
    });

    it('should handle batch delete errors', async () => {
      const noteIds = ['note1', 'note2'];
      mockDoc.delete
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'));

      await expect(notesService.deleteMultipleNotes(noteIds)).rejects.toThrow('Delete failed');
    });
  });
  */

  // Note: note statistics not implemented in current NotesService
  /*
  describe('note statistics', () => {
    it('should get user note statistics', async () => {
      const mockStats = {
        docs: [
          { data: () => ({ tone: 'professional', plainText: 'word1 word2 word3' }) },
          { data: () => ({ tone: 'casual', plainText: 'word1 word2' }) },
          { data: () => ({ tone: 'professional', plainText: 'word1' }) },
        ],
      };

      const mockWhere = { get: jest.fn(() => Promise.resolve(mockStats)) };
      mockCollection.where.mockReturnValueOnce(mockWhere);

      const result = await notesService.getUserNoteStats();

      expect(result).toEqual({
        totalNotes: 3,
        totalWords: 6,
        toneBreakdown: {
          professional: 2,
          casual: 1,
          simplified: 0,
        },
        averageWordsPerNote: 2,
      });
    });
  });
  */
});
