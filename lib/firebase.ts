import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User, setPersistence, browserLocalPersistence, linkWithCredential, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { getFirestore, initializeFirestore, collection, doc, addDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp, setDoc, increment } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';
import { isEmailAdmin } from './admin-security';
import { firebaseConfig, isFirebaseConfigured } from './site-config';

export { isFirebaseConfigured } from './site-config';

export function assertFirebaseConfigured(feature = 'This Firebase feature'): void {
  if (!isFirebaseConfigured) {
    throw new Error(
      `${feature} requires Firebase configuration. Copy .env.example to .env.local and set the six core NEXT_PUBLIC_FIREBASE_* variables.`
    );
  }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Analytics (only in browser environment with tracking support)
let analytics: any = null;
let analyticsInitialized = false;

const initializeAnalytics = async () => {
  if (typeof window !== 'undefined' && isFirebaseConfigured && !analyticsInitialized) {
    try {
      const supported = await isSupported();
      if (supported) {
        analytics = getAnalytics(app);
        analyticsInitialized = true;
        // Analytics initialized silently
      }
    } catch (error) {
      // Analytics initialization failed silently
    }
  }
};

// Initialize analytics immediately if in browser
if (typeof window !== 'undefined' && isFirebaseConfigured) {
  initializeAnalytics();
}


// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Enable persistence
if (isFirebaseConfigured) {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Failed to set persistence:', error);
  });
}

// Initialize Cloud Firestore with Safari/Incognito-friendly transport
export const db = (() => {
  try {
    if (typeof window !== 'undefined') {
      return initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      } as any);
    }
  } catch (e) {
    // Fall back to default
  }
  return getFirestore(app);
})();

// Initialize Storage
export const storage = getStorage(app);

// Upload a single diagram asset blob and return a downloadable URL
export const uploadDiagramAsset = async (
  diagramId: string,
  assetKey: string,
  blob: Blob,
  contentType?: string
): Promise<string> => {
  assertFirebaseConfigured('Diagram asset uploads');
  await signInAnonymouslyIfNeeded();
  const safeKey = assetKey.replace(/[^a-zA-Z0-9-_\.]/g, '_');
  const extFromType = (ct?: string) => {
    if (!ct) return 'bin';
    if (ct.includes('png')) return 'png';
    if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
    if (ct.includes('gif')) return 'gif';
    if (ct.includes('svg')) return 'svg';
    if (ct.includes('webp')) return 'webp';
    return 'bin';
  };
  const ext = extFromType(contentType || blob.type);
  const path = `diagrams/${diagramId}/assets/${safeKey}.${ext}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob, { contentType: contentType || blob.type });
  const url = await getDownloadURL(ref);
  return url;
};

// Anonymous authentication helper with smart session reuse
export const signInAnonymouslyIfNeeded = async (): Promise<User> => {
  if (!isFirebaseConfigured) {
    return {
      uid: 'local-anonymous',
      isAnonymous: true,
      email: null,
      displayName: null,
      photoURL: null,
    } as unknown as User;
  }

  // Server-side guard: API routes can't access browser storage; return a stub user
  if (typeof window === 'undefined') {
    return { uid: 'server-anonymous', isAnonymous: true } as unknown as User;
  }
  // Import dynamically to avoid circular dependency
  const { smartAuth } = await import('./smart-auth');
  const user = await smartAuth.ensureAuthenticated();

  // CRITICAL: Wait a bit for auth token to propagate to Firestore SDK
  // This prevents "Missing or insufficient permissions" errors on immediate writes
  await new Promise(resolve => setTimeout(resolve, 100));

  return user;
};

// Helper function to generate meaningful default whiteboard names
const generateDefaultWhiteboardName = (): string => {
  const adjectives = ['Quick', 'System', 'Architecture', 'Design', 'Draft', 'Concept', 'Planning', 'Brainstorm'];
  const nouns = ['Sketch', 'Diagram', 'Blueprint', 'Design', 'Plan', 'Board', 'Layout', 'Schema'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${adjective} ${noun} - ${timestamp}`;
};

// Core data types
export type FirebaseDiagram = {
  id?: string;
  title: string;
  canvas: any; // tldraw document state
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // User UID
  visibility?: 'private' | 'public'; // Overall diagram visibility for sharing
  views?: number; // View count for analytics
  rev?: number; // Monotonic version for conflict detection
  // Per-page sharing controls: sharedPages[pageId] = { visibility: 'public' | 'private' }
  sharedPages?: Record<string, { visibility: 'private' | 'public'; updatedAt?: any }>;
  // Lightweight pages index (for quick list / routing)
  pages?: Array<{ id: string; name?: string; index?: string | number }>;
};

export type FirebaseDiagramPage = {
  id?: string;
  diagramId: string;
  pageId: string; // TLDraw page ID - used for everything (storage, sharing, indexing)
  title?: string; // optional page title derived from page record
  pageName?: string;
  records: any[]; // filtered TL records for this page (+document + assets)
  visibility: 'private' | 'public';
  views?: number; // View count for analytics
  pageRev?: number; // Monotonic per-page version
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
};

export type FirebaseProject = {
  id?: string;
  title: string;
  description: string;
  status: 'planning' | 'in-progress' | 'completed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  visibility: 'private' | 'public';
  createdBy: string; // User UID

  // Basic project data
  requirements?: string[];
  diagrams?: string[]; // array of diagram IDs
  whiteboardId?: string; // Reference to project's shared whiteboard (auto-created)
};

export type FirebaseQuizAttempt = {
  id?: string;
  userId: string;
  topicId: string; // e.g., 'scalability-basics'
  score: number; // 0-100
  answers: any[]; // user answers
  timeSpent: number; // seconds
  completedAt: Timestamp;
};

export type FirebaseLearningProgress = {
  id?: string;
  userId: string;
  lessonSlug: string; // e.g., 'scalability-basics'
  category: 'fundamentals' | 'case-studies' | 'tools' | 'reference' | 'technology' | 'genai' | 'ml-systems'; // learning category
  completedAt: Timestamp;
  timeSpent?: number; // seconds spent on lesson
  lastAccessed: Timestamp;
};

// New types for reference components
export type FirebaseScenarioProgress = {
  id?: string;
  userId: string;
  scenarioId: string; // e.g., 'latency-vs-throughput-scenarios'
  completedScenarios: number[]; // array of completed scenario indices
  updatedAt: Timestamp;
};

export type FirebaseEnvelopeChallenge = {
  id?: string;
  userId: string;
  challengeId: string; // e.g., 'twitter-storage'
  completed: boolean;
  attempts: number;
  bestEstimate?: number;
  lastAttempt: Timestamp;
};

export type FirebaseReferenceQuiz = {
  id?: string;
  userId: string;
  category: string; // e.g., 'latencies'
  answeredQuestions: string[]; // array of question IDs
  score: number;
  totalQuestions: number;
  lastUpdated: Timestamp;
};

export type FirebaseReferenceProgress = {
  id?: string;
  userId: string;
  topicId: string; // e.g., 'latencies', 'data-sizes'
  visited: boolean;
  quizScore?: number;
  challengesCompleted?: number;
  lastVisited: Timestamp;
};

// Firestore collection references
export const diagramsCollection = collection(db, 'diagrams');
export const projectsCollection = collection(db, 'projects');
export const learningProgressCollection = collection(db, 'progress'); // Consolidated per-user progress document
export const annotationsCollection = collection(db, 'annotations'); // Per-user annotations document
// export const scenarioProgressCollection = collection(db, 'scenarioProgress'); // REMOVED - use consolidated progress collection
export const feedbackCollection = collection(db, 'feedback');

// Diagram operations (Whiteboard)
export const createDiagram = async (diagramData: Omit<FirebaseDiagram, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string> => {
  assertFirebaseConfigured('Saved diagrams');
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('Authentication required to create diagrams');
  }
  const now = Timestamp.now();
  
  const docRef = await addDoc(diagramsCollection, {
    ...diagramData,
    createdAt: now,
    updatedAt: now,
    createdBy: user.uid
  });

  // Do NOT maintain any diagrams index in user document
  
  return docRef.id;
};

export const getDiagram = async (diagramId: string): Promise<FirebaseDiagram | null> => {
  assertFirebaseConfigured('Saved diagrams');
  // Ensure we have an authenticated context for Firestore rules (public reads still require auth)
  await signInAnonymouslyIfNeeded();
  const docRef = doc(db, 'diagrams', diagramId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as FirebaseDiagram;
  }
  
  return null;
};

export const updateDiagram = async (diagramId: string, updates: Partial<Pick<FirebaseDiagram, 'title' | 'canvas' | 'sharedPages' | 'pages' | 'visibility'>>): Promise<void> => {
  assertFirebaseConfigured('Saved diagrams');
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('Authentication required to update diagrams');
  }
  const docRef = doc(db, 'diagrams', diagramId);

  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
    rev: increment(1)
  });
};

// Diagram Pages (per-page sharing)
export const getDiagramPage = async (diagramId: string, pageId: string): Promise<FirebaseDiagramPage | null> => {
  assertFirebaseConfigured('Saved diagram pages');
  await signInAnonymouslyIfNeeded();
  const pagesCol = collection(db, 'diagrams', diagramId, 'pages');
  const qy = query(pagesCol, where('pageId', '==', pageId), limit(1));
  const qs = await getDocs(qy);
  if (!qs.empty) {
    const d = qs.docs[0];
    return { id: d.id, diagramId, ...(d.data() as any) } as FirebaseDiagramPage;
  }
  return null;
};

export const setDiagramPage = async (
  diagramId: string,
  pageId: string,
  data: Partial<Omit<FirebaseDiagramPage, 'diagramId' | 'pageId' | 'createdAt' | 'updatedAt' | 'createdBy'>> & { records?: any[]; visibility?: 'private' | 'public'; title?: string; pageName?: string }
): Promise<void> => {
  assertFirebaseConfigured('Saved diagram pages');
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('Authentication required to manage diagram pages');
  }
  // Use the TLDraw pageId as the document ID for uniqueness
  // Each TLDraw page gets its own Firestore document
  const pageRef = doc(db, 'diagrams', diagramId, 'pages', pageId);
  const existing = await getDoc(pageRef);
  const now = Timestamp.now();
  
  if (existing.exists()) {
    // Update existing page
    await updateDoc(pageRef, { ...data, pageId, updatedAt: now, pageRev: increment(1) } as any);
  } else {
    // Create new page
    await setDoc(pageRef, {
      diagramId,
      pageId,
      title: data.title || '',
      pageName: data.pageName || '',
      records: Array.isArray(data.records) ? data.records : [],
      visibility: data.visibility || 'private',
      createdAt: now,
      updatedAt: now,
      pageRev: 1,
      createdBy: user.uid
    } as any);
  }
};

export const incrementDiagramPageViews = async (diagramId: string, pageId: string): Promise<void> => {
  assertFirebaseConfigured('Diagram view tracking');
  await signInAnonymouslyIfNeeded();
  const pageRef = doc(db, 'diagrams', diagramId, 'pages', pageId);
  await updateDoc(pageRef, { views: increment(1), updatedAt: Timestamp.now() });
};

// Get page by pageId directly (simpler than index-based lookup)
export const getDiagramPageById = async (diagramId: string, pageId: string): Promise<FirebaseDiagramPage | null> => {
  assertFirebaseConfigured('Saved diagram pages');
  await signInAnonymouslyIfNeeded();
  const pageRef = doc(db, 'diagrams', diagramId, 'pages', pageId);
  const pageSnap = await getDoc(pageRef);
  if (pageSnap.exists()) {
    return { id: pageSnap.id, diagramId, ...(pageSnap.data() as any) } as FirebaseDiagramPage;
  }
  return null;
};

export const getDiagramPageByIndex = async (diagramId: string, pageIndex: number): Promise<FirebaseDiagramPage | null> => {
  assertFirebaseConfigured('Saved diagram pages');
  await signInAnonymouslyIfNeeded();
  const pagesCol = collection(db, 'diagrams', diagramId, 'pages');
  const qy = query(pagesCol, where('pageIndex', '==', pageIndex), limit(1));
  const qs = await getDocs(qy);
  if (!qs.empty) {
    const d = qs.docs[0];
    return { id: d.id, diagramId, ...(d.data() as any) } as FirebaseDiagramPage;
  }
  return null;
};

export const getDiagramPageByTlId = async (diagramId: string, tlPageId: string): Promise<FirebaseDiagramPage | null> => {
  assertFirebaseConfigured('Saved diagram pages');
  await signInAnonymouslyIfNeeded();
  const pagesCol = collection(db, 'diagrams', diagramId, 'pages');
  const qy = query(pagesCol, where('pageId', '==', tlPageId), limit(1));
  const qs = await getDocs(qy);
  if (!qs.empty) {
    const d = qs.docs[0];
    return { id: d.id, diagramId, ...(d.data() as any) } as FirebaseDiagramPage;
  }
  return null;
};

export const incrementDiagramViews = async (diagramId: string): Promise<void> => {
  assertFirebaseConfigured('Diagram view tracking');
  // Ensure we have an auth context (anonymous is fine)
  await signInAnonymouslyIfNeeded();
  const docRef = doc(db, 'diagrams', diagramId);
  await updateDoc(docRef, { views: increment(1), updatedAt: Timestamp.now() });
};

export const getUserDiagrams = async (): Promise<FirebaseDiagram[]> => {
  assertFirebaseConfigured('Saved diagrams');
  const user = await signInAnonymouslyIfNeeded();
  const q = query(
    diagramsCollection,
    where('createdBy', '==', user.uid),
    orderBy('updatedAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as FirebaseDiagram));
};

export const deleteDiagram = async (diagramId: string): Promise<void> => {
  assertFirebaseConfigured('Saved diagrams');
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('Authentication required to delete diagrams');
  }

  // Delete the main diagram document
  const diagramRef = doc(db, 'diagrams', diagramId);
  await deleteDoc(diagramRef);

  // Delete all pages in the subcollection
  try {
    const pagesRef = collection(db, 'diagrams', diagramId, 'pages');
    const pagesSnapshot = await getDocs(pagesRef);
    const deletePromises = pagesSnapshot.docs.map(pageDoc => deleteDoc(pageDoc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.warn('Failed to delete some pages:', error);
  }

  // Do NOT maintain any diagrams index in user document
};

// Duplicate an existing whiteboard (diagram) including all pages
export const duplicateWhiteboard = async (sourceId: string, newTitle?: string): Promise<string> => {
  assertFirebaseConfigured('Saved whiteboards');
  const user = await signInAnonymouslyIfNeeded();

  // Read source diagram
  const sourceDiagram = await getDiagram(sourceId);
  if (!sourceDiagram) {
    throw new Error('Source whiteboard not found');
  }

  // Create new whiteboard metadata to get a deterministic id and user linkage
  const targetTitle = newTitle || `${sourceDiagram.title || 'Untitled'} (Copy)`;
  const newId = await createWhiteboardMetadata(targetTitle);
  console.log('[Duplicate] Start copy', { sourceId, newId, title: targetTitle });

  // Copy main diagram fields (canvas, visibility, pages index, sharedPages)
  try {
    const baseCopy: any = {
      title: targetTitle,
      canvas: Array.isArray(sourceDiagram.canvas) ? sourceDiagram.canvas : (sourceDiagram.canvas || []),
      visibility: 'private', // Always private for copies
    };
    if (Array.isArray(sourceDiagram.pages)) baseCopy.pages = [...sourceDiagram.pages];
    await updateDiagram(newId, baseCopy);
    console.log('[Duplicate] Base diagram fields copied', { hasCanvas: Array.isArray(baseCopy.canvas) && baseCopy.canvas.length > 0, pagesLen: baseCopy.pages?.length || 0 });
  } catch (e) {
    console.warn('[Duplicate] Failed to copy base diagram fields:', e);
  }

  // Copy all page subdocuments
  try {
    const pagesRef = collection(db, 'diagrams', sourceId, 'pages');
    const pagesSnap = await getDocs(pagesRef);
    const writePromises: Promise<any>[] = [];
    console.log('[Duplicate] Copying pages...', { count: pagesSnap.size });

    pagesSnap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const pageId = data.pageId || docSnap.id;
      const targetRef = doc(db, 'diagrams', newId, 'pages', pageId);
      const payload = {
        ...data,
        diagramId: newId,
        // Reset analytics and timestamps; keep pageId and content
        views: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        pageRev: 1,
        createdBy: user.uid,
      };
      writePromises.push(setDoc(targetRef, payload));
    });

    await Promise.all(writePromises);
    console.log('[Duplicate] Pages copied successfully', { newId });
  } catch (e) {
    console.warn('[Duplicate] Failed to copy some pages:', e);
  }

  return newId;
};

// Project operations
export const createProject = async (projectData: Omit<FirebaseProject, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'whiteboardId'>): Promise<string> => {
  assertFirebaseConfigured('Cloud projects');
  const user = await signInAnonymouslyIfNeeded();
  const now = Timestamp.now();

  // 1. Create project document first (without whiteboardId)
  const docRef = await addDoc(projectsCollection, {
    ...projectData,
    createdAt: now,
    updatedAt: now,
    createdBy: user.uid
  });

  const projectId = docRef.id;

  // 2. Create dedicated whiteboard for this project (with projectId for deletion protection)
  const whiteboardId = await createWhiteboardMetadata(
    `${projectData.title} - Diagrams`,
    `Whiteboard for project: ${projectData.title}`,
    projectId  // Link whiteboard to project
  );

  // 3. Update project with whiteboard reference
  await updateDoc(docRef, {
    whiteboardId,
    updatedAt: now
  });

  return projectId;
};

export const getProject = async (projectId: string): Promise<FirebaseProject | null> => {
  assertFirebaseConfigured('Cloud projects');
  const docRef = doc(db, 'projects', projectId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as FirebaseProject;
  }
  
  return null;
};

export const updateProject = async (projectId: string, updates: Partial<Pick<FirebaseProject, 'title' | 'description' | 'status' | 'visibility' | 'requirements' | 'diagrams'>>): Promise<void> => {
  assertFirebaseConfigured('Cloud projects');
  const docRef = doc(db, 'projects', projectId);
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
};

export const getUserProjects = async (): Promise<FirebaseProject[]> => {
  assertFirebaseConfigured('Cloud projects');
  const user = await signInAnonymouslyIfNeeded();
  const q = query(
    projectsCollection, 
    where('createdBy', '==', user.uid),
    orderBy('updatedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  } as FirebaseProject));
};

export const getPublicProjects = async (): Promise<FirebaseProject[]> => {
  assertFirebaseConfigured('Cloud projects');
  const q = query(
    projectsCollection, 
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  } as FirebaseProject));
};

// Quiz operations
// DEPRECATED: Use UnifiedStorage.setQuizAttempt() instead - stores in consolidated progress collection
export const saveQuizAttempt = async (quizData: Omit<FirebaseQuizAttempt, 'id' | 'completedAt'>): Promise<string> => {
  assertFirebaseConfigured('Cloud quiz progress');
  // Consolidated model: write into progress.quizzes array instead of quizAttempts collection
  const user = await signInAnonymouslyIfNeeded();
  const current: any = await getLearningProgress(user.uid);
  const quizzes: any[] = Array.isArray(current.quizzes) ? current.quizzes : [];
  const idx = quizzes.findIndex(q => q.topicId === quizData.topicId);
  if (idx >= 0) {
    const existing = quizzes[idx];
    quizzes[idx] = {
      ...existing,
      topicId: quizData.topicId,
      bestScore: Math.max(existing?.bestScore || 0, quizData.score || 0),
      attempts: (existing?.attempts || 0) + 1,
      lastAttempt: Timestamp.now(),
      timeSpent: (existing?.timeSpent || 0) + (quizData.timeSpent || 0),
    };
  } else {
    quizzes.push({
      topicId: quizData.topicId,
      bestScore: quizData.score || 0,
      attempts: 1,
      lastAttempt: Timestamp.now(),
      timeSpent: quizData.timeSpent || 0,
    });
  }
  current.quizzes = quizzes;
  await setLearningProgress(user.uid, current);
  return `${quizData.topicId}-${Date.now()}`;
};

export const getUserQuizAttempts = async (userId: string): Promise<FirebaseQuizAttempt[]> => {
  assertFirebaseConfigured('Cloud quiz progress');
  try {
    // Get quiz attempts from the consolidated progress document (quizzes array)
    const userProgress: any = await getLearningProgress(userId);
    const quizzes: any[] = Array.isArray(userProgress.quizzes) ? userProgress.quizzes : [];

    const firebaseQuizAttempts: FirebaseQuizAttempt[] = quizzes.map((q: any) => {
      let completedAtDate: Date;
      if (q?.lastAttempt?.toDate) {
        completedAtDate = q.lastAttempt.toDate();
      } else if (typeof q?.lastAttempt === 'string') {
        completedAtDate = new Date(q.lastAttempt);
      } else {
        completedAtDate = new Date();
      }
      return {
        id: `${userId}-${q.topicId}`,
        userId,
        topicId: q.topicId,
        score: q.bestScore || 0,
        answers: [],
        timeSpent: q.timeSpent || 0,
        completedAt: Timestamp.fromDate(completedAtDate),
        attempts: q.attempts || 0
      } as any;
    });

    return firebaseQuizAttempts.sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
  } catch (error) {
    console.error('Error fetching quiz attempts:', error);
    return [];
  }
};

// Learning progress operations - Updated to use consolidated progress/{user-id} structure
export const markLessonCompleted = async (lessonSlug: string, category: 'fundamentals' | 'case-studies' | 'practice' | 'tools' | 'reference' | 'technology' | 'genai' | 'ml-systems', timeSpent?: number): Promise<void> => {
  assertFirebaseConfigured('Cloud lesson progress');
  const user = await signInAnonymouslyIfNeeded();

  // Get current progress document
  const currentProgress = await getLearningProgress(user.uid);

  // Initialize category if it doesn't exist
  if (!currentProgress[category]) {
    currentProgress[category] = {};
  }

  // Check if already completed - update existing or create new
  if (currentProgress[category][lessonSlug]) {
    // Update existing progress
    currentProgress[category][lessonSlug] = {
      ...currentProgress[category][lessonSlug],
      section: category,
      item: lessonSlug,
      completed: true,
      completedAt: new Date().toISOString(),
      timeSpent: timeSpent || currentProgress[category][lessonSlug].timeSpent || 0
    };
  } else {
    // Create new progress record
    currentProgress[category][lessonSlug] = {
      section: category,
      item: lessonSlug,
      completed: true,
      completedAt: new Date().toISOString(),
      timeSpent: timeSpent || 0
    };
  }

  // Save back to consolidated progress document
  await setLearningProgress(user.uid, currentProgress);

  // Check for global lesson completion milestones (async, don't block)
  if (!user.isAnonymous) {
    checkLessonCompletionMilestone(lessonSlug, category).catch(err =>
      console.error('Error checking lesson milestone:', err)
    );
  }
};

// Helper function to check and notify about lesson completion milestones
async function checkLessonCompletionMilestone(lessonSlug: string, category: string) {
  try {
    const { NotificationService } = await import('./notification-service');
    const { getContentById } = await import('./content-registry');

    // Get all users' progress for this lesson
    const progressRef = collection(db, 'progress');
    const allProgress = await getDocs(progressRef);

    let totalCompletions = 0;
    allProgress.forEach(doc => {
      const data = doc.data();
      if (data[category] && data[category][lessonSlug]?.completed) {
        totalCompletions++;
      }
    });

    // Check if this hits a milestone
    const milestones = [100, 500, 1000, 5000];
    const reachedMilestone = milestones.find(m => totalCompletions === m);

    if (reachedMilestone) {
      const contentInfo = getContentById(lessonSlug);
      await NotificationService.notifyContentMilestone({
        lessonSlug,
        title: contentInfo?.title || lessonSlug,
        completions: totalCompletions,
        milestone: reachedMilestone,
      });
    }
  } catch (error) {
    console.error('Error in checkLessonCompletionMilestone:', error);
  }
}

export const unmarkLessonCompleted = async (lessonSlug: string): Promise<void> => {
  assertFirebaseConfigured('Cloud lesson progress');
  const user = await signInAnonymouslyIfNeeded();

  // Get current progress document
  const currentProgress = await getLearningProgress(user.uid);

  // Find and remove the lesson from all categories
  let found = false;
  for (const category of Object.keys(currentProgress)) {
    if (currentProgress[category] && currentProgress[category][lessonSlug]) {
      delete currentProgress[category][lessonSlug];
      found = true;
    }
  }

  // Save back to consolidated progress document if we found and removed something
  if (found) {
    await setLearningProgress(user.uid, currentProgress);
  }
};

export const markQuizCompleted = async (
  quizSlug: string,
  category: string,
  score: number,
  totalQuestions: number,
  answers: any[],
  timeSpent?: number
): Promise<void> => {
  assertFirebaseConfigured('Cloud quiz progress');
  const user = await signInAnonymouslyIfNeeded();

  // Calculate percentage
  const percentage = Math.round((score / totalQuestions) * 100);

  // Create new quiz progress record as individual document
  await addDoc(learningProgressCollection, {
    userId: user.uid,
    lessonSlug: quizSlug,
    category,
    type: 'quiz', // Distinguish from lesson progress
    completedAt: Timestamp.now(),
    lastAccessed: Timestamp.now(),
    timeSpent: timeSpent || 0,
    // Quiz-specific fields
    score,
    totalQuestions,
    percentage,
    answers: answers || [],
    attempt: 1 // For now, we'll handle multiple attempts later
  });
};

export const getLessonProgress = async (userId: string, lessonSlug: string): Promise<FirebaseLearningProgress | null> => {
  assertFirebaseConfigured('Cloud lesson progress');
  // Get consolidated progress document
  const currentProgress = await getLearningProgress(userId);

  // Search across all categories for the lesson
  for (const [category, categoryProgress] of Object.entries(currentProgress)) {
    if (categoryProgress && typeof categoryProgress === 'object' && categoryProgress[lessonSlug]) {
      const lessonData = categoryProgress[lessonSlug];
      if (lessonData && lessonData.completed) {
        // Convert to legacy format for backward compatibility
        return {
          id: `${category}-${lessonSlug}`,
          userId,
          lessonSlug,
          category: category as any,
          completedAt: lessonData.completedAt ? Timestamp.fromDate(new Date(lessonData.completedAt)) : Timestamp.now(),
          lastAccessed: lessonData.completedAt ? Timestamp.fromDate(new Date(lessonData.completedAt)) : Timestamp.now(),
          timeSpent: lessonData.timeSpent || 0,
          visited: true
        } as FirebaseLearningProgress;
      }
    }
  }

  return null;
};

export const getUserLearningProgress = async (userId?: string): Promise<FirebaseLearningProgress[]> => {
  assertFirebaseConfigured('Cloud lesson progress');
  let targetUserId = userId;
  if (!targetUserId) {
    const user = await signInAnonymouslyIfNeeded();
    targetUserId = user.uid;
  }

  // Get consolidated progress document
  const currentProgress = await getLearningProgress(targetUserId);
  const progressArray: FirebaseLearningProgress[] = [];

  // Convert consolidated structure to legacy format array
  for (const [category, categoryProgress] of Object.entries(currentProgress)) {
    if (categoryProgress && typeof categoryProgress === 'object') {
      for (const [lessonSlug, lessonData] of Object.entries(categoryProgress)) {
        if (lessonData && typeof lessonData === 'object' && (lessonData as any).completed) {
          progressArray.push({
            id: `${category}-${lessonSlug}`,
            userId: targetUserId,
            lessonSlug,
            category: category as any,
            completedAt: (lessonData as any).completedAt ? Timestamp.fromDate(new Date((lessonData as any).completedAt)) : Timestamp.now(),
            lastAccessed: (lessonData as any).completedAt ? Timestamp.fromDate(new Date((lessonData as any).completedAt)) : Timestamp.now(),
            timeSpent: (lessonData as any).timeSpent || 0,
            visited: true
          } as FirebaseLearningProgress);
        }
      }
    }
  }

  return progressArray;
};

export const getCategoryProgress = async (category: 'fundamentals' | 'case-studies' | 'practice' | 'tools' | 'reference' | 'technology' | 'genai' | 'ml-systems'): Promise<FirebaseLearningProgress[]> => {
  assertFirebaseConfigured('Cloud lesson progress');
  const user = await signInAnonymouslyIfNeeded();

  // Get consolidated progress document
  const currentProgress = await getLearningProgress(user.uid);
  const categoryProgress = currentProgress[category] || {};
  const progressArray: FirebaseLearningProgress[] = [];

  // Convert category progress to legacy format array
  for (const [lessonSlug, lessonData] of Object.entries(categoryProgress)) {
    if (lessonData && typeof lessonData === 'object' && (lessonData as any).completed) {
      progressArray.push({
        id: `${category}-${lessonSlug}`,
        userId: user.uid,
        lessonSlug,
        category: category as any,
        completedAt: (lessonData as any).completedAt ? Timestamp.fromDate(new Date((lessonData as any).completedAt)) : Timestamp.now(),
        lastAccessed: (lessonData as any).completedAt ? Timestamp.fromDate(new Date((lessonData as any).completedAt)) : Timestamp.now(),
        timeSpent: (lessonData as any).timeSpent || 0,
        visited: true
      } as FirebaseLearningProgress);
    }
  }

  // Sort by completed date (most recent first)
  return progressArray.sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());
};

// Scenario Progress operations - REMOVED
// Use UnifiedStorage for progress tracking - stores in consolidated progress/{userId} collection

// Envelope Challenge operations
export const saveEnvelopeChallenge = async (challengeId: string, completed: boolean, estimate?: number): Promise<void> => {
  assertFirebaseConfigured('Cloud challenge progress');
  const user = await signInAnonymouslyIfNeeded();

  // Get consolidated progress document
  const currentProgress = await getLearningProgress(user.uid);

  // Initialize envelopeChallenges if it doesn't exist
  if (!currentProgress.envelopeChallenges) {
    currentProgress.envelopeChallenges = {};
  }

  // Update or create challenge data
  const existingChallenge = currentProgress.envelopeChallenges[challengeId];
  currentProgress.envelopeChallenges[challengeId] = {
    challengeId,
    completed,
    attempts: existingChallenge ? (existingChallenge.attempts || 0) + 1 : 1,
    bestEstimate: estimate,
    lastAttempt: new Date().toISOString()
  };

  // Save back to consolidated progress document
  await setLearningProgress(user.uid, currentProgress);
};

export const getEnvelopeChallenges = async (): Promise<FirebaseEnvelopeChallenge[]> => {
  assertFirebaseConfigured('Cloud challenge progress');
  const user = await signInAnonymouslyIfNeeded();

  const currentProgress = await getLearningProgress(user.uid);
  const envelopeChallenges = currentProgress.envelopeChallenges || {};

  return Object.entries(envelopeChallenges).map(([challengeId, data]) => ({
    id: challengeId,
    userId: user.uid,
    ...(data as any)
  } as FirebaseEnvelopeChallenge));
};

// Reference Quiz operations
export const saveReferenceQuizProgress = async (
  category: string,
  answeredQuestions: string[],
  score: number,
  totalQuestions: number
): Promise<void> => {
  assertFirebaseConfigured('Cloud reference quiz progress');
  const user = await signInAnonymouslyIfNeeded();

  const currentProgress = await getLearningProgress(user.uid);

  // Initialize reference quizzes if it doesn't exist
  if (!currentProgress.referenceQuizzes) {
    currentProgress.referenceQuizzes = {};
  }

  // Save quiz progress in consolidated structure
  currentProgress.referenceQuizzes[category] = {
    answeredQuestions,
    score,
    totalQuestions,
    lastUpdated: Timestamp.now()
  };

  await setLearningProgress(user.uid, currentProgress);
};

export const getReferenceQuizProgress = async (category: string): Promise<FirebaseReferenceQuiz | null> => {
  assertFirebaseConfigured('Cloud reference quiz progress');
  const user = await signInAnonymouslyIfNeeded();

  const currentProgress = await getLearningProgress(user.uid);
  const quizProgress = currentProgress.referenceQuizzes?.[category];

  if (quizProgress) {
    return {
      id: category,
      userId: user.uid,
      category,
      ...quizProgress
    } as FirebaseReferenceQuiz;
  }

  return null;
};

// Reference Progress operations
export const saveReferenceProgress = async (
  topicId: string,
  visited: boolean,
  quizScore?: number,
  challengesCompleted?: number
): Promise<void> => {
  assertFirebaseConfigured('Cloud reference progress');
  const user = await signInAnonymouslyIfNeeded();

  const currentProgress = await getLearningProgress(user.uid);

  // Initialize reference progress if it doesn't exist
  if (!currentProgress.referenceProgress) {
    currentProgress.referenceProgress = {};
  }

  // Get existing progress or create new
  const existingProgress = currentProgress.referenceProgress[topicId] || {};

  // Update progress in consolidated structure
  currentProgress.referenceProgress[topicId] = {
    ...existingProgress,
    visited,
    ...(quizScore !== undefined && { quizScore }),
    ...(challengesCompleted !== undefined && { challengesCompleted }),
    lastVisited: Timestamp.now()
  };

  await setLearningProgress(user.uid, currentProgress);
};

export const getReferenceProgress = async (): Promise<Map<string, FirebaseReferenceProgress>> => {
  assertFirebaseConfigured('Cloud reference progress');
  const user = await signInAnonymouslyIfNeeded();

  const currentProgress = await getLearningProgress(user.uid);
  const referenceProgress = currentProgress.referenceProgress || {};
  const progressMap = new Map<string, FirebaseReferenceProgress>();

  Object.entries(referenceProgress).forEach(([topicId, data]) => {
    progressMap.set(topicId, {
      id: topicId,
      userId: user.uid,
      topicId,
      ...(data as any)
    } as FirebaseReferenceProgress);
  });

  return progressMap;
};

// Google Authentication operations
export const signInWithGoogle = async (): Promise<User> => {
  assertFirebaseConfigured('Google sign-in');
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    // Log error but don't fail - CORS warnings are often non-blocking
    if (error.code === 'auth/cancelled-popup-request' || 
        error.code === 'auth/popup-closed-by-user') {
      console.log('Sign-in cancelled by user');
      throw error;
    }
    
    // For other errors, log but continue
    console.error('Google sign-in error (may still succeed):', error);
    throw error;
  }
};

export const linkAnonymousAccountWithGoogle = async (): Promise<User> => {
  assertFirebaseConfigured('Account linking');
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.isAnonymous) {
    throw new Error('No anonymous user to link or user is already linked');
  }

  try {
    // Get Google credential through popup
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential) {
      throw new Error('Failed to get Google credential');
    }

    // Link the anonymous account with Google credential
    await linkWithCredential(currentUser, credential);
    const authed = auth.currentUser!;
    // NOTE: Data migration is now handled automatically by UnifiedStorage
    return authed;
  } catch (error: any) {
    // Handle case where credential is already in use
    if (error.code === 'auth/credential-already-in-use') {
      // The Google account is already linked to another Firebase account
      // Sign in with that account instead
      const anonymousUid = auth.currentUser?.uid;
      const result = await signInWithPopup(auth, googleProvider);
      // NOTE: Data migration is now handled automatically by UnifiedStorage
      return result.user;
    }
    throw error;
  }
};

// Email/Password Authentication
export const signUpWithEmail = async (email: string, password: string, displayName?: string): Promise<User> => {
  assertFirebaseConfigured('Email sign-up');
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Update display name if provided
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName });
    }

    return result.user;
  } catch (error: any) {
    // Provide user-friendly error messages
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Please sign in instead.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use at least 6 characters.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.');
    }
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  assertFirebaseConfigured('Email sign-in');
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    // Provide user-friendly error messages
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email. Please sign up first.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled. Please contact support.');
    }
    throw error;
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  assertFirebaseConfigured('Password reset');
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.');
    }
    throw error;
  }
};

export const getUserAuthState = (): { 
  isSignedIn: boolean; 
  isAnonymous: boolean; 
  user: User | null;
  isAdmin: boolean;
} => {
  const user = auth.currentUser;
  // Admin status is driven by the NEXT_PUBLIC_ADMIN_EMAILS allow-list (see lib/site-config.ts).
  const isAdmin = user && !user.isAnonymous && isEmailAdmin(user.email);
  
  return {
    isSignedIn: !!user,
    isAnonymous: user?.isAnonymous || false,
    user,
    isAdmin: !!isAdmin
  };
};

export const signOutAndReturnToAnonymous = async (): Promise<User> => {
  assertFirebaseConfigured('Sign-out');
  await signOut(auth);
  return await signInAnonymouslyIfNeeded();
};

// User Document Structure
export interface UserDocument {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  isAdmin: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  
  // User Annotations
  annotations: {
    highlights: Array<{
      id: string;
      text: string;
      context: string;
      pageUrl: string;
      pageTitle: string;
      timestamp: Timestamp;
    }>;
    notes: Array<{
      id: string;
      text: string;
      note: string;
      pageUrl: string;
      pageTitle: string;
      timestamp: Timestamp;
    }>;
  };
  
  // Settings & Preferences
  preferences: {
    theme?: 'light' | 'dark' | 'system';
    emailNotifications: boolean;
    language: string;
  };

  // Gamification Stats
  stats?: {
    totalXP: number;
    level: number;
    xpToNextLevel: number;
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Timestamp;
    streakFrozen: boolean;
    totalLessonsCompleted: number;
    totalQuizzesTaken: number;
    averageQuizScore: number;
    perfectQuizStreak: number;
    totalTimeSpent: number;
    unlockedAchievements: Array<{
      achievementId: string;
      unlockedAt: Timestamp;
      isNew: boolean;
    }>;
    achievementProgress: Record<string, number>;
  };

  // Project tracking
  projects?: {
    owned: Array<{
      id: string;
      title: string;
      templateType: string;
      status: 'draft' | 'active' | 'completed' | 'archived';
      lastUpdated: Timestamp;
      pageCount: number;
      completion: number;
      createdAt: Timestamp;
    }>;
    shared: Array<{
      id: string;
      title: string;
      role: 'viewer' | 'editor' | 'admin';
      sharedAt: Timestamp;
    }>;
    recent: string[]; // Recent project IDs (max 10)
  };
}

// Feedback types and operations
export interface FirebaseFeedback {
  id?: string;
  feedback: string;
  category: 'general' | 'bug' | 'feature' | 'content' | 'ui';
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userPhotoURL: string | null;
  isAnonymous: boolean;
  timestamp: Date;
  url: string;
  userAgent: string;
  createdAt?: Timestamp;
  resolved?: boolean;
  adminNotes?: string;
  metadata?: {
    selectionType?: 'feedback' | 'highlight' | 'note';
    selectedText?: string;
    textContext?: string;
    pageTitle?: string;
    [key: string]: any;
  };
}

export const submitFeedback = async (feedbackData: Omit<FirebaseFeedback, 'id' | 'createdAt'>): Promise<string> => {
  assertFirebaseConfigured('Firebase feedback mirroring');
  const docRef = await addDoc(feedbackCollection, {
    ...feedbackData,
    createdAt: Timestamp.now(),
    resolved: false
  });
  
  return docRef.id;
};

export const getFeedback = async (limitCount: number = 20, startAfter?: any): Promise<{feedback: FirebaseFeedback[], hasMore: boolean}> => {
  assertFirebaseConfigured('Feedback admin views');
  let q = query(
    feedbackCollection,
    orderBy('createdAt', 'desc'),
    limit(limitCount + 1) // Get one extra to check if there are more
  );

  if (startAfter) {
    q = query(q, startAfter);
  }

  const querySnapshot = await getDocs(q);
  const feedbackList = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as FirebaseFeedback[];

  const hasMore = feedbackList.length > limitCount;
  if (hasMore) {
    feedbackList.pop(); // Remove the extra item
  }

  return { feedback: feedbackList, hasMore };
};

export const updateFeedbackStatus = async (
  feedbackId: string,
  resolved: boolean,
  adminNotes?: string,
  userEmail?: string
): Promise<void> => {
  assertFirebaseConfigured('Feedback status updates');
  const docRef = doc(feedbackCollection, feedbackId);
  await updateDoc(docRef, {
    resolved,
    adminNotes: adminNotes || '',
    updatedAt: Timestamp.now()
  });

  // Send email notification when feedback is resolved
  if (resolved && userEmail) {
    await sendFeedbackResolvedEmail(feedbackId, userEmail, adminNotes || '');
  }
};

/**
 * Send email notification to user when their feedback is resolved
 */
const sendFeedbackResolvedEmail = async (
  feedbackId: string,
  userEmail: string,
  resolutionNotes: string
): Promise<void> => {
  try {
    // Get the original feedback for context
    const feedbackDoc = await getDoc(doc(feedbackCollection, feedbackId));
    if (!feedbackDoc.exists()) {
      console.error('Feedback not found:', feedbackId);
      return;
    }

    const feedbackData = feedbackDoc.data() as FirebaseFeedback;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://systemdesigner.net';

    // Create email with resolution details
    const emailData = {
      to: userEmail,
      bcc: ['system-designer@googlegroups.com'], // BCC admin group
      message: {
        subject: `Your feedback has been addressed - System Designer`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Feedback Resolved</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
              .header { background: #10B981; color: white; padding: 24px; }
              .content { padding: 24px; }
              .feedback-box { background: #f9fafb; border-left: 4px solid #6366f1; padding: 16px; margin: 16px 0; border-radius: 4px; }
              .resolution-box { background: #f0fdf4; border-left: 4px solid #10B981; padding: 16px; margin: 16px 0; border-radius: 4px; }
              .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
              .footer { padding: 20px; background: #f9fafb; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
              .category-badge { display: inline-block; background: #e0e7ff; color: #4f46e5; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">✅ Your Feedback Has Been Addressed</h1>
                <p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 16px;">Thank you for helping us improve System Designer</p>
              </div>

              <div class="content">
                <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
                  Hi ${feedbackData.userName || 'there'},
                </p>

                <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
                  We wanted to let you know that your feedback has been reviewed and addressed by our team.
                </p>

                <div class="feedback-box">
                  <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                    <span>Your Original Feedback</span>
                    <span class="category-badge">${feedbackData.category}</span>
                  </div>
                  <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0; white-space: pre-wrap;">${feedbackData.feedback}</p>
                  ${feedbackData.url ? `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                      <a href="${feedbackData.url}" style="color: #6366f1; font-size: 13px; text-decoration: none;">View page →</a>
                    </div>
                  ` : ''}
                </div>

                ${resolutionNotes ? `
                  <div class="resolution-box">
                    <div style="color: #059669; font-size: 12px; text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">
                      💬 Resolution Details
                    </div>
                    <p style="font-size: 15px; line-height: 1.6; color: #065f46; margin: 0; white-space: pre-wrap;">${resolutionNotes}</p>
                  </div>
                ` : `
                  <div class="resolution-box">
                    <p style="font-size: 15px; line-height: 1.6; color: #059669; margin: 0;">
                      ✅ Your feedback has been reviewed and the necessary changes have been made.
                    </p>
                  </div>
                `}

                <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-top: 24px;">
                  Your input is invaluable in helping us build a better learning experience. We really appreciate you taking the time to share your thoughts!
                </p>

                <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                  If you have any follow-up questions or additional feedback, please don't hesitate to reach out.
                </p>

                ${feedbackData.url ? `
                  <div style="text-align: center; margin-top: 32px;">
                    <a href="${feedbackData.url}" class="button">Return to Page</a>
                  </div>
                ` : ''}

                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
                  <p style="margin: 0;">Best regards,<br>The System Designer Team</p>
                </div>
              </div>

              <div class="footer">
                <p>This is an automated notification from <a href="${baseUrl}" style="color: #6366f1;">System Designer</a></p>
                <p>Have more feedback? <a href="${baseUrl}/?feedback=true" style="color: #6366f1;">Let us know</a></p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hi ${feedbackData.userName || 'there'},

Your feedback has been addressed!

Your Original Feedback (${feedbackData.category}):
${feedbackData.feedback}

${resolutionNotes ? `Resolution Details:\n${resolutionNotes}` : 'Your feedback has been reviewed and the necessary changes have been made.'}

Thank you for helping us improve System Designer!

Best regards,
The System Designer Team

---
This is an automated notification from System Designer
${baseUrl}
        `
      }
    };

    // Queue email via Firestore Email Extension
    await addDoc(collection(db, 'mail'), emailData);

    console.log('✅ Feedback resolution email sent to:', userEmail);
    console.log('📧 BCC sent to: system-designer@googlegroups.com');

  } catch (error) {
    console.error('Error sending feedback resolution email:', error);
    // Don't throw - feedback is still marked as resolved even if email fails
  }
};

// User Document Operations
export const usersCollection = collection(db, 'users');

// Cache for user documents to reduce Firebase reads
const userDocCache = new Map<string, { data: UserDocument; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// CRITICAL: In-memory deduplication for new user notifications
// This prevents duplicate notifications when onAuthStateChanged fires multiple times
const newUserNotificationSent = new Set<string>();

// Invalidate user document cache for a specific user
export const invalidateUserDocCache = (uid: string): void => {
  userDocCache.delete(uid);
  console.log('🗑️ [CACHE] Invalidated user document cache for user:', uid);
};

export const createOrUpdateUserDocument = async (user: User): Promise<UserDocument> => {
  // Do NOT write user docs for anonymous sessions (incognito viewers)
  if (user.isAnonymous) {
    return {
      uid: user.uid,
      isAdmin: false,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      annotations: { highlights: [], notes: [] },
      preferences: { emailNotifications: false, language: 'en' }
    } as unknown as UserDocument;
  }

  const userRef = doc(usersCollection, user.uid);
  const now = Timestamp.now();

  // Capture device information with IP and geolocation
  let deviceInfo: any = null;
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    const { getEnrichedDeviceInfo, generateDeviceFingerprint } = await import('./device-info');

    // Get enriched device info (includes IP and geolocation from server)
    const enrichedDevice = await getEnrichedDeviceInfo();
    const deviceFingerprint = generateDeviceFingerprint(enrichedDevice);

    deviceInfo = {
      ...enrichedDevice,
      fingerprint: deviceFingerprint,
    };
  }

  try {
    const existingDoc = await getDoc(userRef);

    if (existingDoc.exists()) {
      // Update existing user document
      const userData = existingDoc.data() as any;
      const updatedData: any = {
        ...(user.email && { email: user.email }),
        ...(user.displayName && { displayName: user.displayName }),
        ...(user.photoURL && { photoURL: user.photoURL }),
        isAdmin: isEmailAdmin(user.email), // Update admin status based on current email
        lastLoginAt: now,
      };

      // Update last device info
      if (deviceInfo) {
        updatedData.lastDevice = {
          userAgent: deviceInfo.userAgent,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          device: deviceInfo.device,
          isMobile: deviceInfo.isMobile,
        };
      }

      // Update or create devices array to track all devices
      if (deviceInfo) {
        const existingDevices = userData.devices || [];
        const deviceFingerprint = deviceInfo.fingerprint;

        // Find if this device already exists
        const deviceIndex = existingDevices.findIndex(
          (d: any) => d.fingerprint === deviceFingerprint
        );

        if (deviceIndex >= 0) {
          // Update existing device (including IP and location)
          const updatedDevices = [...existingDevices];
          updatedDevices[deviceIndex] = {
            ...updatedDevices[deviceIndex],
            lastSeen: now,
            loginCount: (updatedDevices[deviceIndex].loginCount || 0) + 1,
            userAgent: deviceInfo.userAgent,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            device: deviceInfo.device,
            isMobile: deviceInfo.isMobile,
            ipAddress: deviceInfo.ip, // Update IP on each login
            location: deviceInfo.location || updatedDevices[deviceIndex].location, // Update location
          };
          updatedData.devices = updatedDevices;
        } else {
          // Add new device with full location data
          const newDevice = {
            userAgent: deviceInfo.userAgent,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            device: deviceInfo.device,
            isMobile: deviceInfo.isMobile,
            fingerprint: deviceFingerprint,
            ipAddress: deviceInfo.ip,
            firstSeen: now,
            lastSeen: now,
            loginCount: 1,
            location: deviceInfo.location || {
              timezone: deviceInfo.timezone,
            },
          };
          updatedData.devices = [...existingDevices, newDevice];
        }
      }

      await updateDoc(userRef, updatedData);

      const fullUserData: UserDocument = {
        ...userData,
        ...updatedData,
      };

      // Cache the result
      userDocCache.set(user.uid, { data: fullUserData, timestamp: Date.now() });
      return fullUserData;
    } else {
      // Create new user document
      const newUserData: any = {
        uid: user.uid,
        ...(user.email && { email: user.email }),
        ...(user.displayName && { displayName: user.displayName }),
        ...(user.photoURL && { photoURL: user.photoURL }),
        isAdmin: isEmailAdmin(user.email), // Automatically set admin status based on email
        createdAt: now,
        lastLoginAt: now,
        annotations: {
          highlights: [],
          notes: [],
        },
        preferences: {
          emailNotifications: true,
          language: 'en',
        },
        whiteboards: [], // Simple array of whiteboard metadata
      };

      // Add device info for new user
      if (deviceInfo) {
        newUserData.lastDevice = {
          userAgent: deviceInfo.userAgent,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          device: deviceInfo.device,
          isMobile: deviceInfo.isMobile,
        };

        newUserData.devices = [{
          userAgent: deviceInfo.userAgent,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          device: deviceInfo.device,
          isMobile: deviceInfo.isMobile,
          fingerprint: deviceInfo.fingerprint,
          ipAddress: deviceInfo.ip,
          firstSeen: now,
          lastSeen: now,
          loginCount: 1,
          location: deviceInfo.location || {
            timezone: deviceInfo.timezone,
          },
        }];
      }

      await setDoc(userRef, newUserData);

      // Trigger admin notification for new user registration (with multi-layer deduplication)
      try {
        // CRITICAL: Only send notification ONCE per user registration
        // Use multiple layers of deduplication to prevent spam
        const { NotificationService } = await import('./notification-service');

        // Layer 1: In-memory Set (immediate protection against rapid-fire calls)
        if (newUserNotificationSent.has(user.uid)) {
          console.log('🚫 [DEDUP] Notification already sent for user (in-memory):', user.uid.substring(0, 8));
          return newUserData;
        }

        // Layer 2: sessionStorage (protection across page reloads in same session)
        const notificationSentKey = `new_user_notification_sent_${user.uid}`;
        const alreadySentInSession = typeof window !== 'undefined'
          ? sessionStorage.getItem(notificationSentKey) === 'true'
          : false;

        if (alreadySentInSession) {
          console.log('🚫 [DEDUP] Notification already sent for user (sessionStorage):', user.uid.substring(0, 8));
          newUserNotificationSent.add(user.uid); // Also mark in memory
          return newUserData;
        }

        // All checks passed - send notification
        console.log('✅ [NOTIFY] Sending new user notification:', user.uid.substring(0, 8));

        // Mark as sent IMMEDIATELY (before async call) to prevent race conditions
        newUserNotificationSent.add(user.uid);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(notificationSentKey, 'true');
        }

        // Now send the notification (fire and forget, don't block)
        NotificationService.notifyNewUser({
          uid: user.uid,
          email: user.email || undefined,
          displayName: user.displayName || undefined,
          deviceInfo: deviceInfo ? {
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            device: deviceInfo.device,
            isMobile: deviceInfo.isMobile,
            location: deviceInfo.location,
            ip: deviceInfo.ip,
          } : undefined,
        }).catch(err => {
          console.error('Error sending new user notification:', err);
        });

      } catch (notificationError) {
        console.error('Error in new user notification flow:', notificationError);
        // Don't fail user creation if notification fails
      }

      // Cache the result
      userDocCache.set(user.uid, { data: newUserData, timestamp: Date.now() });
      return newUserData;
    }
  } catch (error) {
    console.error('Error creating/updating user document:', error);
    throw error;
  }
};

export const getUserDocument = async (uid: string): Promise<UserDocument | null> => {
  assertFirebaseConfigured('Cloud user profiles');
  // Check cache first
  const cached = userDocCache.get(uid);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const userRef = doc(usersCollection, uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserDocument;
      // Cache the result
      userDocCache.set(uid, { data: userData, timestamp: Date.now() });
      return userData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user document:', error);
    return null;
  }
};

// REMOVED: updateUserProgress() and updateUserQuizScore()
// All progress tracking now handled by consolidated progress/{userId} collection
// Use: markLessonCompleted() and saveQuizAttempt() instead

export const addUserHighlight = async (
  uid: string,
  highlight: { id: string; text: string; context: string; pageUrl: string; pageTitle: string; category?: string; color?: string }
): Promise<void> => {
  assertFirebaseConfigured('Cloud annotations');
  const annRef = doc(annotationsCollection, uid);
  const annDoc = await getDoc(annRef);

  const newHighlight = {
    ...highlight,
    timestamp: Timestamp.now(),
  };

  if (annDoc.exists()) {
    const data = annDoc.data() as any;
    const current = Array.isArray(data.highlights) ? data.highlights : [];
    await updateDoc(annRef, {
      highlights: [...current, newHighlight],
      'stats.totalHighlights': (data?.stats?.totalHighlights || 0) + 1,
      'stats.lastActivityAt': Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } else {
    await setDoc(annRef, {
      userId: uid,
      highlights: [newHighlight],
      notes: [],
      stats: {
        totalHighlights: 1,
        totalNotes: 0,
        lastActivityAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    });
  }
};

export const addUserNote = async (
  uid: string,
  note: { id: string; text: string; note: string; pageUrl: string; pageTitle: string; category?: string; tags?: string[] }
): Promise<void> => {
  assertFirebaseConfigured('Cloud annotations');
  const annRef = doc(annotationsCollection, uid);
  const annDoc = await getDoc(annRef);

  const newNote = {
    ...note,
    timestamp: Timestamp.now(),
  };

  if (annDoc.exists()) {
    const data = annDoc.data() as any;
    const current = Array.isArray(data.notes) ? data.notes : [];
    await updateDoc(annRef, {
      notes: [...current, newNote],
      'stats.totalNotes': (data?.stats?.totalNotes || 0) + 1,
      'stats.lastActivityAt': Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } else {
    await setDoc(annRef, {
      userId: uid,
      highlights: [],
      notes: [newNote],
      stats: {
        totalHighlights: 0,
        totalNotes: 1,
        lastActivityAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    });
  }
};

export const getUserAnnotationsForPage = async (uid: string, pageUrl: string) => {
  assertFirebaseConfigured('Cloud annotations');
  const annRef = doc(annotationsCollection, uid);
  const annSnap = await getDoc(annRef);
  if (!annSnap.exists()) return { highlights: [], notes: [] };
  const data = annSnap.data() as any;
  const highlights = (data?.highlights || []).filter((h: any) => h.pageUrl === pageUrl);
  const notes = (data?.notes || []).filter((n: any) => n.pageUrl === pageUrl);
  return { highlights, notes };
};

// Remove specific highlight from user document
export const removeUserHighlightFromDocument = async (uid: string, highlightId: string): Promise<void> => {
  assertFirebaseConfigured('Cloud annotations');
  const annRef = doc(annotationsCollection, uid);
  const annDoc = await getDoc(annRef);
  if (!annDoc.exists()) return;
  const data = annDoc.data() as any;
  const updated = (data?.highlights || []).filter((h: any) => h.id !== highlightId);
  await updateDoc(annRef, {
    highlights: updated,
    updatedAt: Timestamp.now(),
  });
};

// Remove specific note from user document
export const removeUserNoteFromDocument = async (uid: string, noteId: string): Promise<void> => {
  assertFirebaseConfigured('Cloud annotations');
  const annRef = doc(annotationsCollection, uid);
  const annDoc = await getDoc(annRef);
  if (!annDoc.exists()) return;
  const data = annDoc.data() as any;
  const updated = (data?.notes || []).filter((n: any) => n.id !== noteId);
  await updateDoc(annRef, {
    notes: updated,
    updatedAt: Timestamp.now(),
  });
};

// Update specific note in user document
export const updateUserNoteInDocument = async (uid: string, noteId: string, updatedNote: string): Promise<void> => {
  assertFirebaseConfigured('Cloud annotations');
  const annRef = doc(annotationsCollection, uid);
  const annDoc = await getDoc(annRef);
  if (!annDoc.exists()) return;
  const data = annDoc.data() as any;
  const updated = (data?.notes || []).map((n: any) => n.id === noteId ? { ...n, note: updatedNote, timestamp: Timestamp.now() } : n);
  await updateDoc(annRef, {
    notes: updated,
    updatedAt: Timestamp.now(),
  });
};

// Get all highlights from user document
export const getUserHighlightsFromDocument = async (uid: string): Promise<any[]> => {
  assertFirebaseConfigured('Cloud annotations');
  const annRef = doc(annotationsCollection, uid);
  const annSnap = await getDoc(annRef);
  return annSnap.exists() ? (annSnap.data() as any).highlights || [] : [];
};

// Get all notes from user document
export const getUserNotesFromDocument = async (uid: string): Promise<any[]> => {
  assertFirebaseConfigured('Cloud annotations');
  const annRef = doc(annotationsCollection, uid);
  const annSnap = await getDoc(annRef);
  return annSnap.exists() ? (annSnap.data() as any).notes || [] : [];
};

// Simple whiteboard metadata management
export interface WhiteboardMetadata {
  id: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  projectId?: string;  // If set, whiteboard is linked to a project (deletion protection)
}

// Get user's whiteboard metadata from user document
export const getUserWhiteboards = async (): Promise<WhiteboardMetadata[]> => {
  assertFirebaseConfigured('Saved whiteboards');
  const user = await signInAnonymouslyIfNeeded();
  const doc = await getUserDocument(user.uid);
  const whiteboards = (doc && Array.isArray((doc as any).whiteboards)) ? (doc as any).whiteboards : [];
  return whiteboards.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

// Create new whiteboard metadata AND diagram document
export const createWhiteboardMetadata = async (title: string, description?: string, projectId?: string): Promise<string> => {
  assertFirebaseConfigured('Saved whiteboards');
  const user = await signInAnonymouslyIfNeeded();
  const id = `wb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();

  // Create the whiteboard metadata
  const newWhiteboard: WhiteboardMetadata = {
    id,
    title,
    description: description || '',
    createdAt: now,
    updatedAt: now,
    ...(projectId && { projectId })  // Add projectId if provided (for deletion protection)
  };
  
  // Create the actual diagram document with the specific ID
  const diagramRef = doc(diagramsCollection, id);
  await setDoc(diagramRef, {
    title,
    canvas: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: user.uid
  });
  
  // Add metadata to user document
  const userRef = doc(usersCollection, user.uid);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const data = userDoc.data() as any;
    const whiteboards = Array.isArray(data.whiteboards) ? data.whiteboards : [];
    whiteboards.unshift(newWhiteboard);
    await updateDoc(userRef, { whiteboards });
    // Bust cache so UI reload sees the fresh list
    invalidateUserDocCache(user.uid);
  } else {
    await createOrUpdateUserDocument(user);
    await updateDoc(userRef, { whiteboards: [newWhiteboard] });
    // Bust cache so UI reload sees the fresh list
    invalidateUserDocCache(user.uid);
  }

  // Trigger whiteboard creation notification (async, don't block)
  if (!user.isAnonymous) {
    notifyWhiteboardCreated(user.uid, id, title).catch(err =>
      console.error('Error sending whiteboard notification:', err)
    );
  }

  return id;
};

// Helper to notify admins about whiteboard creation
async function notifyWhiteboardCreated(userId: string, boardId: string, boardTitle: string) {
  try {
    const { NotificationService } = await import('./notification-service');
    const userDoc = await getUserDocument(userId);
    if (!userDoc) return;

    await NotificationService.notifyWhiteboardActivity({
      userId,
      userEmail: userDoc.email,
      userName: userDoc.displayName,
      activityType: 'created',
      boardId,
      boardTitle,
    });
  } catch (error) {
    console.error('Error in notifyWhiteboardCreated:', error);
  }
}

// Update whiteboard metadata
export const updateWhiteboardMetadata = async (id: string, title: string, description?: string): Promise<void> => {
  assertFirebaseConfigured('Saved whiteboards');
  const user = await signInAnonymouslyIfNeeded();
  const userRef = doc(usersCollection, user.uid);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const data = userDoc.data() as any;
    const whiteboards = Array.isArray(data.whiteboards) ? data.whiteboards : [];
    const index = whiteboards.findIndex((wb: any) => wb.id === id);
    
    if (index !== -1) {
      whiteboards[index] = {
        ...whiteboards[index],
        title,
        description: description || '',
        updatedAt: new Date()
      };
      await updateDoc(userRef, { whiteboards });
      // Bust cache so UI reload sees the fresh list
      invalidateUserDocCache(user.uid);
    }
  }
};

// Delete whiteboard metadata and content
export const deleteWhiteboard = async (id: string): Promise<void> => {
  assertFirebaseConfigured('Saved whiteboards');
  const user = await signInAnonymouslyIfNeeded();

  // PROTECTION: Check if whiteboard is linked to a project
  const userRef = doc(usersCollection, user.uid);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    const data = userDoc.data() as any;
    const whiteboards = Array.isArray(data.whiteboards) ? data.whiteboards : [];
    const whiteboard = whiteboards.find((wb: any) => wb.id === id);

    // Check deletion protection
    if (whiteboard && whiteboard.projectId) {
      throw new Error(
        `Cannot delete whiteboard "${whiteboard.title}". ` +
        `It is linked to a project. Please delete the project first, or unlink the whiteboard.`
      );
    }

    // Safe to delete - remove from user document
    const filtered = whiteboards.filter((wb: any) => wb.id !== id);
    await updateDoc(userRef, { whiteboards: filtered });
    // Bust cache so UI reload sees the fresh list
    invalidateUserDocCache(user.uid);
  }

  // Delete actual diagram content if it exists
  try {
    const diagramRef = doc(diagramsCollection, id);
    await deleteDoc(diagramRef);
  } catch (error) {
    // Diagram might not exist yet, that's ok
  }
};

// REMOVED: Legacy separate collections - use consolidated user documents instead
// const highlightsCollection = collection(db, 'highlights'); // REMOVED
// const notesCollection = collection(db, 'notes'); // REMOVED

// Learning Progress Operations
export const setLearningProgress = async (uid: string, progress: Record<string, any>): Promise<void> => {
  assertFirebaseConfigured('Cloud lesson progress');
  console.log('🔥 PROGRESS WRITE:', {
    uid: uid.substring(0, 8) + '...',
    timestamp: new Date().toISOString(),
    stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n'),
    progressKeys: Object.keys(progress),
    quizzesCount: Array.isArray(progress.quizzes) ? progress.quizzes.length : 'none'
  });
  const docRef = doc(learningProgressCollection, uid);
  await setDoc(docRef, { userId: uid, ...progress }, { merge: true });
};

export const getLearningProgress = async (uid: string): Promise<Record<string, any>> => {
  assertFirebaseConfigured('Cloud lesson progress');
  const docRef = doc(learningProgressCollection, uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : {};
};

// Quiz Attempts Operations
// DEPRECATED legacy quizAttempts helpers removed in favor of consolidated progress.quizzes

// REMOVED: Legacy Highlights & Notes Operations
// Use: addUserHighlight(), getUserHighlightsFromDocument(), addUserNote(), getUserNotesFromDocument()

// REMOVED: Legacy removal & update functions
// Use: removeUserHighlightFromDocument(), removeUserNoteFromDocument(), updateUserNoteInDocument()


// ====================================
// GOOGLE ANALYTICS FUNCTIONS
// ====================================

// Analytics event tracking functions
export const trackEvent = async (eventName: string, eventParams: Record<string, any> = {}) => {
  try {
    if (!isFirebaseConfigured) return;

    // Ensure analytics is initialized
    await initializeAnalytics();

    if (analytics && analyticsInitialized) {
      logEvent(analytics, eventName, eventParams);
      // Event tracked silently
    }
  } catch (error) {
    // Event tracking failed silently
  }
};

// Page view tracking
export const trackPageView = (page_title: string, page_location?: string) => {
  if (isFirebaseConfigured && analytics) {
    logEvent(analytics, 'page_view', {
      page_title,
      page_location: page_location || window.location.href,
    });
  }
};

// Learning analytics
export const trackLessonStarted = (lesson_slug: string, category: string) => {
  trackEvent('lesson_started', {
    lesson_slug,
    category,
    timestamp: Date.now(),
  });
};

export const trackLessonCompleted = (lesson_slug: string, category: string, time_spent?: number) => {
  trackEvent('lesson_completed', {
    lesson_slug,
    category,
    time_spent,
    timestamp: Date.now(),
  });
};

export const trackQuizAttempt = (quiz_id: string, score: number, total_questions: number, time_spent?: number) => {
  trackEvent('quiz_attempt', {
    quiz_id,
    score,
    total_questions,
    success_rate: (score / total_questions) * 100,
    time_spent,
    timestamp: Date.now(),
  });
};

// User interaction analytics  
export const trackSearchUsage = (search_query: string, results_count: number) => {
  trackEvent('search', {
    search_term: search_query,
    results_count,
    timestamp: Date.now(),
  });
};

export const trackToolUsage = (tool_name: string, action: string) => {
  trackEvent('tool_usage', {
    tool_name,
    action,
    timestamp: Date.now(),
  });
};

export const trackDiagramAction = (action: string, diagram_type?: string) => {
  trackEvent('diagram_action', {
    action,
    diagram_type,
    timestamp: Date.now(),
  });
};

export const trackUserEngagement = (engagement_type: 'feedback' | 'highlight' | 'note', content_type?: string) => {
  trackEvent('user_engagement', {
    engagement_type,
    content_type,
    timestamp: Date.now(),
  });
};

// Navigation analytics
export const trackNavigationPath = (from_page: string, to_page: string, navigation_type: 'click' | 'breadcrumb' | 'menu' | 'search') => {
  trackEvent('navigation', {
    from_page,
    to_page,
    navigation_type,
    timestamp: Date.now(),
  });
};

// Performance analytics
export const trackLoadTime = (page_type: string, load_time_ms: number) => {
  trackEvent('page_performance', {
    page_type,
    load_time_ms,
    timestamp: Date.now(),
  });
};

// User authentication analytics
export const trackAuthAction = (action: 'login' | 'logout' | 'signup', method?: string) => {
  trackEvent('auth_action', {
    action,
    method,
    timestamp: Date.now(),
  });
};

// Content interaction analytics
export const trackContentInteraction = (content_id: string, interaction_type: string, content_category?: string) => {
  trackEvent('content_interaction', {
    content_id,
    interaction_type,
    content_category,
    timestamp: Date.now(),
  });
};

// Error tracking
export const trackError = (error_type: string, error_message: string, page_location?: string) => {
  trackEvent('error', {
    error_type,
    error_message,
    page_location: page_location || window.location.href,
    timestamp: Date.now(),
  });
};

// Feature usage analytics
export const trackFeatureUsage = (feature_name: string, feature_category: string, usage_details?: Record<string, any>) => {
  trackEvent('feature_usage', {
    feature_name,
    feature_category,
    ...usage_details,
    timestamp: Date.now(),
  });
};

// AI Conversation Types
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIConversation {
  id?: string;
  userId: string;
  pageUrl: string;
  pageTitle: string;
  selectedText?: string;
  messages: AIMessage[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  sessionCount?: number; // How many times user has reset
}

export interface AIConversationHistory {
  id?: string;
  userId: string;
  pageUrl: string;
  pageTitle: string;
  selectedText?: string;
  messages: AIMessage[];
  sessionNumber: number; // Which session this was (1st, 2nd, etc)
  createdAt: Date; // When conversation originally started
  archivedAt: Date; // When it was archived
}

// Helper to generate deterministic conversation ID
const generateConversationId = (userId: string, pageUrl: string): string => {
  // Create a hash-like ID from userId + pageUrl
  const combined = `${userId}_${pageUrl}`;
  // Simple base64-like encoding for consistent ID
  return btoa(combined)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// AI Conversation Management
export const saveConversation = async (conversation: Omit<AIConversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  assertFirebaseConfigured('Cloud AI conversation history');
  const user = await signInAnonymouslyIfNeeded();

  // Generate deterministic ID based on user + page
  const conversationId = generateConversationId(user.uid, conversation.pageUrl);
  const docRef = doc(db, 'conversations', conversationId);

  // Check if document exists
  const existingDoc = await getDoc(docRef);

  const conversationData = {
    ...conversation,
    userId: user.uid,
    updatedAt: Timestamp.now(),
    // Only set createdAt if this is a new document
    ...(existingDoc.exists() ? {} : { createdAt: Timestamp.now() }),
  };

  // Use setDoc with merge to create or update
  await setDoc(docRef, conversationData, { merge: true });

  return conversationId;
};

export const updateConversation = async (conversationId: string, updates: Partial<AIConversation>): Promise<void> => {
  assertFirebaseConfigured('Cloud AI conversation history');
  const user = await signInAnonymouslyIfNeeded();
  const conversationRef = doc(db, 'conversations', conversationId);

  // Use setDoc with merge to create or update (same as saveConversation)
  await setDoc(conversationRef, {
    ...updates,
    userId: user.uid,
    updatedAt: Timestamp.now(),
  }, { merge: true });
};

export const getConversation = async (conversationId: string): Promise<AIConversation | null> => {
  assertFirebaseConfigured('Cloud AI conversation history');
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);

  if (!conversationDoc.exists()) {
    return null;
  }

  const data = conversationDoc.data();
  return {
    id: conversationDoc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    messages: data.messages?.map((msg: any) => ({
      ...msg,
      timestamp: msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp),
    })) || [],
  } as AIConversation;
};

export const getPageConversation = async (pageUrl: string): Promise<AIConversation | null> => {
  assertFirebaseConfigured('Cloud AI conversation history');
  const user = await signInAnonymouslyIfNeeded();

  // Generate the deterministic ID for this user + page
  const conversationId = generateConversationId(user.uid, pageUrl);
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);

  if (!conversationDoc.exists()) {
    return null;
  }

  const data = conversationDoc.data();

  // Only return if it's active
  if (!data.isActive) {
    return null;
  }

  return {
    id: conversationDoc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    messages: data.messages?.map((msg: any) => ({
      ...msg,
      timestamp: msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp),
    })) || [],
  } as AIConversation;
};

// Legacy: Get all conversations for a page (for history view)
export const getPageConversations = async (pageUrl: string): Promise<AIConversation[]> => {
  assertFirebaseConfigured('Cloud AI conversation history');
  const user = await signInAnonymouslyIfNeeded();

  const conversationsQuery = query(
    collection(db, 'conversations'),
    where('userId', '==', user.uid),
    where('pageUrl', '==', pageUrl),
    orderBy('updatedAt', 'desc'),
    limit(10)
  );

  const snapshot = await getDocs(conversationsQuery);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      messages: data.messages?.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp),
      })) || [],
    } as AIConversation;
  });
};

export const closeConversation = async (conversationId: string): Promise<void> => {
  await updateConversation(conversationId, { isActive: false });
};

// Archive current active conversation and start fresh
export const resetConversation = async (pageUrl: string): Promise<void> => {
  assertFirebaseConfigured('Cloud AI conversation history');
  const user = await signInAnonymouslyIfNeeded();
  const conversationId = generateConversationId(user.uid, pageUrl);
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);

  console.log('🔄 Reset: conversation exists?', conversationDoc.exists());

  if (conversationDoc.exists()) {
    const data = conversationDoc.data();
    const currentSessionCount = data.sessionCount || 1;

    // Build history data, filtering out undefined values
    const historyData: any = {
      userId: user.uid,
      pageUrl: data.pageUrl || pageUrl,
      pageTitle: data.pageTitle || 'Untitled',
      messages: data.messages || [],
      sessionNumber: currentSessionCount,
      createdAt: data.createdAt || Timestamp.now(),
      archivedAt: Timestamp.now(),
    };

    // Only add selectedText if it's defined
    if (data.selectedText !== undefined) {
      historyData.selectedText = data.selectedText;
    }

    console.log('📦 Archiving conversation with', data.messages?.length, 'messages to history');

    // Archive to history collection (skip if no messages - nothing to archive)
    if (data.messages && data.messages.length > 0) {
      await addDoc(collection(db, 'conversationHistory'), historyData);
      console.log('✅ Archived to conversationHistory');
    } else {
      console.log('⏭️ Skipping archive - no messages to save');
    }

    // Delete the active conversation document entirely (simpler than clearing)
    await deleteDoc(conversationRef);
    console.log('🧹 Deleted active conversation document');
  }
};

// Admin: Get all conversation history for a page (across all users)
export const getPageConversationHistory = async (pageUrl: string): Promise<AIConversationHistory[]> => {
  assertFirebaseConfigured('Cloud AI conversation history');
  const historyQuery = query(
    collection(db, 'conversationHistory'),
    where('pageUrl', '==', pageUrl),
    orderBy('archivedAt', 'desc'),
    limit(100)
  );

  const snapshot = await getDocs(historyQuery);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      archivedAt: data.archivedAt?.toDate() || new Date(),
      messages: data.messages?.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp),
      })) || [],
    } as AIConversationHistory;
  });
};

// Admin: Get all active conversations for a user
// Requires Firestore composite index: userId (Ascending) + isActive (Ascending) + updatedAt (Descending)
export const getUserActiveConversations = async (userId: string): Promise<AIConversation[]> => {
  assertFirebaseConfigured('Cloud AI conversation history');
  const conversationsQuery = query(
    collection(db, 'conversations'),
    where('userId', '==', userId),
    where('isActive', '==', true),
    orderBy('updatedAt', 'desc'),
    limit(100)
  );

  const snapshot = await getDocs(conversationsQuery);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      messages: data.messages?.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp),
      })) || [],
    } as AIConversation;
  });
};

// Admin: Get all conversation history for a user (archived)
export const getUserConversationHistory = async (userId: string): Promise<AIConversationHistory[]> => {
  assertFirebaseConfigured('Cloud AI conversation history');
  const historyQuery = query(
    collection(db, 'conversationHistory'),
    where('userId', '==', userId),
    orderBy('archivedAt', 'desc'),
    limit(100)
  );

  const snapshot = await getDocs(historyQuery);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      archivedAt: data.archivedAt?.toDate() || new Date(),
      messages: data.messages?.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp),
      })) || [],
    } as AIConversationHistory;
  });
};
