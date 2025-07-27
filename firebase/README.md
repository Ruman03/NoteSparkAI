# Firebase Database Setup & Deployment

This directory contains Firebase configuration files for NoteSpark AI.

## Files Overview

- **`firestore.indexes.json`**: Database indexes for optimal query performance
- **`firestore.rules`**: Security rules for Firestore database
- **`storage.rules`**: Security rules for Firebase Storage
- **`firebase.json`**: Firebase project configuration
- **`.firebaserc`**: Firebase project settings

## Database Indexes

The following indexes are configured for optimal performance:

### Primary Indexes
1. **`userId + updatedAt (DESC)`** - For fetching user's notes sorted by update time
2. **`userId + tone + updatedAt (DESC)`** - For filtering notes by tone
3. **`userId + isStarred + updatedAt (DESC)`** - For fetching starred notes
4. **`userId + createdAt (DESC)`** - For sorting by creation date
5. **`userId + tags (CONTAINS) + updatedAt (DESC)`** - For tag-based filtering

## Security Rules

### Firestore Rules
- Users can only access their own notes (`userId` field enforcement)
- Comprehensive data validation for note creation/updates
- Field-level validation (title length, content size, etc.)

### Storage Rules
- User-specific folders for document images
- File type validation (images, PDFs)
- Size limits: 10MB for documents, 5MB for attachments, 2MB for profiles

## Deployment Commands

### Install Firebase CLI (if not installed)
```bash
npm install -g firebase-tools
```

### Login to Firebase
```bash
firebase login
```

### Deploy Firestore Rules and Indexes
```bash
cd firebase
firebase deploy --only firestore
```

### Deploy Storage Rules
```bash
firebase deploy --only storage
```

### Deploy All Firebase Configuration
```bash
firebase deploy
```

### Local Development with Emulators
```bash
firebase emulators:start
```

## Query Patterns Supported

Based on the NotesService implementation, these indexes support:

1. **`getUserNotes()`**: userId + updatedAt DESC
2. **`getNotesByTone(tone)`**: userId + tone + updatedAt DESC
3. **`getStarredNotes()`**: userId + isStarred + updatedAt DESC
4. **`searchNotes(query)`**: userId + updatedAt DESC (with client-side filtering)
5. **Tag filtering**: userId + tags (contains) + updatedAt DESC

## Performance Considerations

- All queries include `userId` for security and performance
- Primary sorting by `updatedAt` for recent notes first
- Array-contains support for tag filtering
- Client-side full-text search (consider Algolia for production scale)

## Next Steps

1. Deploy the indexes: `firebase deploy --only firestore:indexes`
2. Deploy security rules: `firebase deploy --only firestore:rules storage`
3. Test queries in Firebase Console
4. Monitor query performance in Firebase Console

## Maintenance

- Monitor index usage in Firebase Console
- Update indexes when adding new query patterns
- Review security rules periodically
- Consider composite indexes for complex queries
