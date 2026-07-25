'use client';

import { User } from 'firebase/auth';
import {
  addUserHighlight,
  addUserNote,
  getUserAnnotationsForPage,
  setLearningProgress,
  getLearningProgress,
  markLessonCompleted,
  saveQuizAttempt
} from './firebase';

// Data Types
export interface ProgressData {
  section: string;
  item: string;
  completed: boolean;
  completedAt?: string;
  score?: number;
  timeSpent?: number;
}

export interface QuizAttempt {
  quizId: string;
  score: number;
  attempts: number;
  lastAttempt: string;
  answers?: Record<string, any>;
  timeSpent?: number;
}

export interface UserHighlight {
  id: string;
  text: string;
  context: string;
  pageUrl: string;
  pageTitle: string;
  timestamp: string;
  // Code block specific fields
  codeBlockId?: string;
  textStartIndex?: number;
  textEndIndex?: number;
  isCodeHighlight?: boolean;
}

export interface UserNote {
  id: string;
  text: string;
  note: string;
  pageUrl: string;
  pageTitle: string;
  timestamp: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  language: string;
}

// Unified Storage Interface
export class UnifiedStorage {
  private user: User | null = null;
  private isInitialized = false;
  private migrationPromise: Promise<void> | null = null;
  private batchTimer: NodeJS.Timeout | null = null;
  private pendingProgressUpdates: Map<string, ProgressData> = new Map();

  constructor() {}

  // Batch progress updates to reduce Firebase writes
  private async flushPendingProgress(): Promise<void> {
    if (this.pendingProgressUpdates.size === 0 || !this.isAuthenticated()) {
      return;
    }

    console.log('📦 BATCH FLUSH: Processing', this.pendingProgressUpdates.size, 'pending progress updates');

    try {
      // Get current progress from Firebase
      const currentProgress = await getLearningProgress(this.user!.uid);

      // Apply all pending updates
      for (const [key, progressData] of this.pendingProgressUpdates) {
        const { section, item } = progressData;
        if (!currentProgress[section]) {
          currentProgress[section] = {};
        }
        currentProgress[section][item] = progressData;
      }

      // Single Firebase write for all updates
      const sanitizedProgress = this.sanitizeForFirebase(currentProgress);
      await setLearningProgress(this.user!.uid, sanitizedProgress);

      // Clear pending updates
      this.pendingProgressUpdates.clear();

      console.log('✅ BATCH FLUSH: Successfully wrote all pending updates in single operation');
    } catch (error) {
      console.error('❌ BATCH FLUSH: Failed to flush pending progress:', error);
      // Keep pending updates for retry
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      console.log('🔄 BATCH TIMER: Reset (was already scheduled)');
    } else {
      console.log('⏰ BATCH TIMER: Starting new 100ms timer');
    }

    // Batch updates and flush after 100ms of no new updates
    this.batchTimer = setTimeout(() => {
      console.log('⏱️ BATCH TIMER: Timer fired, flushing', this.pendingProgressUpdates.size, 'updates');
      this.flushPendingProgress();
      this.batchTimer = null;
    }, 100);
  }

  // Force immediate flush for urgent updates (like quiz completion)
  async flushImmediately(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    await this.flushPendingProgress();
  }

  // Utility function to remove undefined values from objects before Firebase save
  private sanitizeForFirebase(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForFirebase(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          sanitized[key] = this.sanitizeForFirebase(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  async setUser(user: User | null) {
    const previousUser = this.user;
    this.user = user;

    // If transitioning from anonymous/null to authenticated, migrate data ONCE
    if ((!previousUser || previousUser?.isAnonymous) && user && !user.isAnonymous) {
      // Check if we've already migrated for this user ID
      const migrationKey = `migration_complete_${user.uid}`;
      if (!localStorage.getItem(migrationKey)) {
        console.log('🔄 Starting one-time migration for user:', user.uid.substring(0, 8) + '...');
        this.migrationPromise = this.migrateFromLocalStorage();
        // Mark migration as complete for this user
        this.migrationPromise.then(() => {
          localStorage.setItem(migrationKey, 'true');
        });
      } else {
        console.log('✅ Migration already complete for user:', user.uid.substring(0, 8) + '...');
      }
    }

    this.isInitialized = true;
  }

  private async waitForMigration() {
    if (this.migrationPromise) {
      await this.migrationPromise;
      this.migrationPromise = null;
    }
  }

  private isAuthenticated(): boolean {
    // Only authenticated if user exists and is not anonymous
    return !!(this.user && !this.user.isAnonymous);
  }

  // Progress Management
  async setProgress(section: string, item: string, progress: Omit<ProgressData, 'section' | 'item'>): Promise<void> {
    console.log('📈 UNIFIED STORAGE setProgress:', {
      section,
      item,
      completed: progress.completed,
      score: progress.score,
      timeSpent: progress.timeSpent,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack?.split('\n').slice(1, 3).join('\n')
    });
    await this.waitForMigration();

    const fullProgress: ProgressData = {
      section,
      item,
      ...progress,
      // Only set completedAt if the item is completed or if there's already a valid completedAt date
      // Never set undefined values as Firebase doesn't allow them
      ...(progress.completed
        ? { completedAt: new Date().toISOString() }
        : progress.completedAt
          ? { completedAt: progress.completedAt }
          : {}
      ),
    };

    if (this.isAuthenticated()) {
      // Add to batch for Firebase write
      const batchKey = `${section}:${item}`;
      this.pendingProgressUpdates.set(batchKey, fullProgress);
      console.log('📥 BATCH ADD:', {
        batchKey,
        pendingCount: this.pendingProgressUpdates.size,
        item: fullProgress.item,
        section: fullProgress.section
      });
      this.scheduleBatchFlush();

      // Also store in localStorage as backup
      this.setLocalProgress(fullProgress);
    } else {
      // Store in localStorage
      this.setLocalProgress(fullProgress);
    }
  }

  async getProgress(section?: string): Promise<Record<string, ProgressData>> {
    await this.waitForMigration();

    if (this.isAuthenticated()) {
      try {
        return await this.getFirebaseProgress(section);
      } catch (error) {
        console.error('Failed to get progress from Firebase, falling back to localStorage:', error);
        return this.getLocalProgress(section);
      }
    } else {
      return this.getLocalProgress(section);
    }
  }

  // Quiz Management
  async setQuizAttempt(quizId: string, attempt: Omit<QuizAttempt, 'quizId'>): Promise<void> {
    console.log('🎯 UNIFIED STORAGE setQuizAttempt:', {
      quizId,
      score: attempt.score,
      timeSpent: attempt.timeSpent,
      attempts: attempt.attempts,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack?.split('\n').slice(1, 3).join('\n')
    });
    await this.waitForMigration();

    const fullAttempt: QuizAttempt = { quizId, ...attempt };

    if (this.isAuthenticated()) {
      try {
        await this.setFirebaseQuizAttempt(fullAttempt);
        // Flush any pending progress updates immediately after quiz save
        await this.flushImmediately();
      } catch (error) {
        console.error('Failed to save quiz attempt to Firebase, falling back to localStorage:', error);
        this.setLocalQuizAttempt(fullAttempt);
      }
    } else {
      this.setLocalQuizAttempt(fullAttempt);
    }
  }

  async getQuizAttempts(): Promise<Record<string, QuizAttempt>> {
    await this.waitForMigration();

    if (this.isAuthenticated()) {
      try {
        return await this.getFirebaseQuizAttempts();
      } catch (error) {
        console.error('Failed to get quiz attempts from Firebase, falling back to localStorage:', error);
        return this.getLocalQuizAttempts();
      }
    } else {
      return this.getLocalQuizAttempts();
    }
  }

  // Highlights Management
  async addHighlight(highlight: Omit<UserHighlight, 'id' | 'timestamp'>): Promise<void> {
    await this.waitForMigration();

    const fullHighlight: UserHighlight = {
      ...highlight,
      id: `highlight-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    if (this.isAuthenticated()) {
      try {
        await addUserHighlight(this.user!.uid, {
          id: fullHighlight.id,
          text: fullHighlight.text,
          context: fullHighlight.context,
          pageUrl: fullHighlight.pageUrl,
          pageTitle: fullHighlight.pageTitle,
        });
        console.log('Highlight saved to Firebase');
      } catch (error) {
        console.error('Failed to save highlight to Firebase, falling back to localStorage:', error);
        this.addLocalHighlight(fullHighlight);
      }
    } else {
      // User not authenticated, save to localStorage
      this.addLocalHighlight(fullHighlight);
    }
  }

  async getHighlights(pageUrl?: string): Promise<UserHighlight[]> {
    await this.waitForMigration();

    if (this.isAuthenticated()) {
      try {
        if (pageUrl) {
          const annotations = await getUserAnnotationsForPage(this.user!.uid, pageUrl);
          return annotations.highlights.map((h: any) => ({
            ...h,
            timestamp: h.timestamp.toDate().toISOString(),
          }));
        }
        return await this.getAllFirebaseHighlights();
      } catch (error) {
        console.error('Failed to get highlights from Firebase, falling back to localStorage:', error);
        return this.getLocalHighlights(pageUrl);
      }
    } else {
      // For anonymous users, always use localStorage
      return this.getLocalHighlights(pageUrl);
    }
  }

  // Notes Management
  async removeHighlight(highlightId: string): Promise<void> {
    await this.waitForMigration();

    if (this.isAuthenticated()) {
      try {
        const { removeUserHighlightFromDocument } = await import('./firebase');
        await removeUserHighlightFromDocument(this.user!.uid, highlightId);
        console.log('✅ Highlight removed from Firebase user document');
      } catch (error) {
        console.error('Failed to remove highlight from Firebase:', error);
      }
    }

    // Remove from localStorage
    this.removeLocalHighlight(highlightId);
  }

  async removeNote(noteId: string): Promise<void> {
    await this.waitForMigration();

    if (this.isAuthenticated()) {
      try {
        const { removeUserNoteFromDocument } = await import('./firebase');
        await removeUserNoteFromDocument(this.user!.uid, noteId);
        console.log('✅ Note removed from Firebase user document');
      } catch (error) {
        console.error('Failed to remove note from Firebase:', error);
      }
    }

    // Remove from localStorage
    this.removeLocalNote(noteId);
  }

  async updateNote(noteId: string, updatedNote: string): Promise<void> {
    await this.waitForMigration();

    if (this.isAuthenticated()) {
      try {
        const { updateUserNoteInDocument } = await import('./firebase');
        await updateUserNoteInDocument(this.user!.uid, noteId, updatedNote);
        console.log('✅ Note updated in Firebase user document');
      } catch (error) {
        console.error('Failed to update note in Firebase:', error);
      }
    }

    // Update in localStorage
    this.updateLocalNote(noteId, updatedNote);
  }

  async addNote(note: Omit<UserNote, 'id' | 'timestamp'>): Promise<void> {
    await this.waitForMigration();

    const fullNote: UserNote = {
      ...note,
      id: `note-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    if (this.isAuthenticated()) {
      try {
        await addUserNote(this.user!.uid, {
          id: fullNote.id,
          text: fullNote.text,
          note: fullNote.note,
          pageUrl: fullNote.pageUrl,
          pageTitle: fullNote.pageTitle,
        });
        console.log('Note saved to Firebase');
      } catch (error) {
        console.error('Failed to save note to Firebase, falling back to localStorage:', error);
        this.addLocalNote(fullNote);
      }
    } else {
      // User not authenticated, save to localStorage
      this.addLocalNote(fullNote);
    }
  }

  async getNotes(pageUrl?: string): Promise<UserNote[]> {
    await this.waitForMigration();

    if (this.isAuthenticated()) {
      try {
        if (pageUrl) {
          const annotations = await getUserAnnotationsForPage(this.user!.uid, pageUrl);
          return annotations.notes.map((n: any) => ({
            ...n,
            timestamp: n.timestamp.toDate().toISOString(),
          }));
        }
        return await this.getAllFirebaseNotes();
      } catch (error) {
        console.error('Failed to get notes from Firebase, falling back to localStorage:', error);
        return this.getLocalNotes(pageUrl);
      }
    } else {
      // For anonymous users, always use localStorage
      return this.getLocalNotes(pageUrl);
    }
  }

  // Migration Logic
  private async migrateFromLocalStorage(): Promise<void> {
    if (!this.user || this.user.isAnonymous) return;

    console.log('Migrating user data from localStorage to Firebase...');

    try {
      // Ensure user document exists before migration
      const { createOrUpdateUserDocument } = await import('./firebase');
      await createOrUpdateUserDocument(this.user);
      console.log('User document initialized for migration');
      // Migrate progress
      const localProgress = this.getLocalProgress();
        for (const [, items] of Object.entries(localProgress)) {
        for (const [, progress] of Object.entries(items)) {
          await this.setFirebaseProgress(progress);
        }
      }

      // Migrate quiz attempts
      const localQuizAttempts = this.getLocalQuizAttempts();
      for (const attempt of Object.values(localQuizAttempts)) {
        await this.setFirebaseQuizAttempt(attempt);
      }

      // Migrate highlights
      const localHighlights = this.getLocalHighlights();
      for (const highlight of localHighlights) {
        await addUserHighlight(this.user.uid, {
          id: highlight.id,
          text: highlight.text,
          context: highlight.context,
          pageUrl: highlight.pageUrl,
          pageTitle: highlight.pageTitle,
        });
      }

      // Migrate notes
      const localNotes = this.getLocalNotes();
      for (const note of localNotes) {
        await addUserNote(this.user.uid, {
          id: note.id,
          text: note.text,
          note: note.note,
          pageUrl: note.pageUrl,
          pageTitle: note.pageTitle,
        });
      }

      console.log('Migration completed successfully');

      // Clear localStorage after successful migration
      localStorage.removeItem('user-progress');
      localStorage.removeItem('quiz-attempts');
      localStorage.removeItem('textHighlights');
      localStorage.removeItem('userNotes');

    } catch (error) {
      console.error('Migration failed:', error);
      // Don't clear localStorage if migration failed
    }
  }

  // LocalStorage Implementations
  private setLocalProgress(progress: ProgressData): void {
    try {
      const allProgress = JSON.parse(localStorage.getItem('user-progress') || '{}');
      const sectionProgress = allProgress[progress.section] || {};
      sectionProgress[progress.item] = progress;
      allProgress[progress.section] = sectionProgress;
      localStorage.setItem('user-progress', JSON.stringify(allProgress));
    } catch (error) {
      console.error('Failed to save progress to localStorage:', error);
    }
  }

  private getLocalProgress(section?: string): Record<string, ProgressData> {
    try {
      const allProgress = JSON.parse(localStorage.getItem('user-progress') || '{}');
      if (section) {
        return allProgress[section] || {};
      }
      return allProgress;
    } catch (error) {
      console.error('Failed to get progress from localStorage:', error);
      return {};
    }
  }

  private setLocalQuizAttempt(attempt: QuizAttempt): void {
    try {
      const allAttempts = JSON.parse(localStorage.getItem('quiz-attempts') || '{}');
      allAttempts[attempt.quizId] = attempt;
      localStorage.setItem('quiz-attempts', JSON.stringify(allAttempts));
    } catch (error) {
      console.error('Failed to save quiz attempt to localStorage:', error);
    }
  }

  private getLocalQuizAttempts(): Record<string, QuizAttempt> {
    try {
      return JSON.parse(localStorage.getItem('quiz-attempts') || '{}');
    } catch (error) {
      console.error('Failed to get quiz attempts from localStorage:', error);
      return {};
    }
  }

  private addLocalHighlight(highlight: UserHighlight): void {
    try {
      const highlights = JSON.parse(localStorage.getItem('textHighlights') || '[]');
      highlights.push(highlight);
      localStorage.setItem('textHighlights', JSON.stringify(highlights));
      console.log('Highlight saved to localStorage');
    } catch (error) {
      console.error('Failed to save highlight to localStorage:', error);
    }
  }

  private getLocalHighlights(pageUrl?: string): UserHighlight[] {
    try {
      const highlights = JSON.parse(localStorage.getItem('textHighlights') || '[]');
      const filteredHighlights = pageUrl ? highlights.filter((h: UserHighlight) => h.pageUrl === pageUrl) : highlights;
      console.log('Retrieved highlights from localStorage:', filteredHighlights.length, 'highlights', pageUrl ? `for page: ${pageUrl}` : '(all pages)');
      return filteredHighlights;
    } catch (error) {
      console.error('Failed to get highlights from localStorage:', error);
      return [];
    }
  }

  private addLocalNote(note: UserNote): void {
    try {
      const notes = JSON.parse(localStorage.getItem('userNotes') || '[]');
      notes.push(note);
      localStorage.setItem('userNotes', JSON.stringify(notes));
      console.log('Note saved to localStorage');
    } catch (error) {
      console.error('Failed to save note to localStorage:', error);
    }
  }

  private removeLocalNote(noteId: string): void {
    try {
      const notes = JSON.parse(localStorage.getItem('userNotes') || '[]');
      const filteredNotes = notes.filter((note: UserNote) => note.id !== noteId);
      localStorage.setItem('userNotes', JSON.stringify(filteredNotes));
      console.log('Note removed from localStorage');
    } catch (error) {
      console.error('Failed to remove note from localStorage:', error);
    }
  }

  private updateLocalNote(noteId: string, updatedNote: string): void {
    try {
      const notes = JSON.parse(localStorage.getItem('userNotes') || '[]');
      const noteIndex = notes.findIndex((note: UserNote) => note.id === noteId);
      if (noteIndex !== -1) {
        notes[noteIndex].note = updatedNote;
        notes[noteIndex].timestamp = new Date().toISOString();
        localStorage.setItem('userNotes', JSON.stringify(notes));
        console.log('Note updated in localStorage');
      }
    } catch (error) {
      console.error('Failed to update note in localStorage:', error);
    }
  }

  private removeLocalHighlight(highlightId: string): void {
    try {
      const highlights = JSON.parse(localStorage.getItem('textHighlights') || '[]');
      const filteredHighlights = highlights.filter((highlight: UserHighlight) => highlight.id !== highlightId);
      localStorage.setItem('textHighlights', JSON.stringify(filteredHighlights));
      console.log('Highlight removed from localStorage');
    } catch (error) {
      console.error('Failed to remove highlight from localStorage:', error);
    }
  }

  private getLocalNotes(pageUrl?: string): UserNote[] {
    try {
      const notes = JSON.parse(localStorage.getItem('userNotes') || '[]');
      const filteredNotes = pageUrl ? notes.filter((n: UserNote) => n.pageUrl === pageUrl) : notes;
      console.log('Retrieved notes from localStorage:', filteredNotes.length, 'notes', pageUrl ? `for page: ${pageUrl}` : '(all pages)');
      return filteredNotes;
    } catch (error) {
      console.error('Failed to get notes from localStorage:', error);
      return [];
    }
  }

  // Firebase Implementations
  private async setFirebaseProgress(progress: ProgressData): Promise<void> {
    if (!this.user?.uid) return;

    const currentProgress = await getLearningProgress(this.user.uid);
    const sectionProgress = currentProgress[progress.section] || {};

    // Sanitize progress data to remove undefined values before saving to Firebase
    const sanitizedProgress = this.sanitizeForFirebase(progress);
    sectionProgress[progress.item] = sanitizedProgress;
    currentProgress[progress.section] = sectionProgress;

    // Sanitize the entire progress object before saving
    const sanitizedCurrentProgress = this.sanitizeForFirebase(currentProgress);
    await setLearningProgress(this.user.uid, sanitizedCurrentProgress);
  }

  private async getFirebaseProgress(section?: string): Promise<Record<string, ProgressData>> {
    if (!this.user?.uid) return {};
    
    const allProgress = await getLearningProgress(this.user.uid);
    if (section) {
      return allProgress[section] || {};
    }
    return allProgress;
  }

  private async setFirebaseQuizAttempt(attempt: QuizAttempt): Promise<void> {
    if (!this.user?.uid) return;

    // Store quiz attempts in consolidated progress document as quizzes array
    // Structure: progress/{userId} -> { quizzes: Array<{ topicId, bestScore, attempts, lastAttempt, timeSpent }> }
    const { getLearningProgress, setLearningProgress } = await import('./firebase');
    const currentProgress: any = await getLearningProgress(this.user.uid);
    const quizzes: any[] = Array.isArray(currentProgress.quizzes) ? currentProgress.quizzes : [];

    const idx = quizzes.findIndex((q: any) => q && q.topicId === attempt.quizId);
    if (idx >= 0) {
      const existing = quizzes[idx] || {};
      quizzes[idx] = {
        ...existing,
        topicId: attempt.quizId,
        bestScore: Math.max(existing.bestScore || 0, attempt.score || 0),
        attempts: (existing.attempts || 0) + 1,
        lastAttempt: new Date().toISOString(),
        timeSpent: (existing.timeSpent || 0) + (attempt.timeSpent || 0),
      };
    } else {
      quizzes.push({
        topicId: attempt.quizId,
        bestScore: attempt.score || 0,
        attempts: attempt.attempts || 1,
        lastAttempt: new Date().toISOString(),
        timeSpent: attempt.timeSpent || 0,
      });
    }

    currentProgress.quizzes = quizzes;

    // Sanitize the entire progress object before saving to prevent undefined values
    const sanitizedCurrentProgress = this.sanitizeForFirebase(currentProgress);
    await setLearningProgress(this.user.uid, sanitizedCurrentProgress);
    console.log(`Quiz attempt saved for ${attempt.quizId} in progress document (quizzes array)`);
  }

  private async getFirebaseQuizAttempts(): Promise<Record<string, QuizAttempt>> {
    if (!this.user?.uid) return {};

    // Read from consolidated progress's quizzes array and map to legacy shape
    const { getLearningProgress } = await import('./firebase');
    const currentProgress: any = await getLearningProgress(this.user.uid);
    const quizzes: any[] = Array.isArray(currentProgress.quizzes) ? currentProgress.quizzes : [];
    const attemptsMap: Record<string, QuizAttempt> = {};
    for (const q of quizzes) {
      if (!q || !q.topicId) continue;
      let lastAttemptIso: string;
      if (q?.lastAttempt?.toDate) {
        lastAttemptIso = q.lastAttempt.toDate().toISOString();
      } else if (typeof q?.lastAttempt === 'string') {
        lastAttemptIso = q.lastAttempt;
      } else {
        lastAttemptIso = new Date().toISOString();
      }
      attemptsMap[q.topicId] = {
        quizId: q.topicId,
        score: q.bestScore || 0,
        attempts: q.attempts || 0,
        lastAttempt: lastAttemptIso,
      };
    }
    return attemptsMap;
  }

  private async getAllFirebaseHighlights(): Promise<UserHighlight[]> {
    if (!this.user?.uid) return [];

    const { getUserHighlightsFromDocument } = await import('./firebase');
    return await getUserHighlightsFromDocument(this.user.uid);
  }

  private async getAllFirebaseNotes(): Promise<UserNote[]> {
    if (!this.user?.uid) return [];

    const { getUserNotesFromDocument } = await import('./firebase');
    return await getUserNotesFromDocument(this.user.uid);
  }
}

// Global instance
export const userStorage = new UnifiedStorage();