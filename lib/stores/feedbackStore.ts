import { create } from 'zustand';

export type FeedbackCategory = 'bug' | 'feature' | 'content' | 'ui' | 'general';
export type ConsoleLevel = 'error' | 'warn' | 'all';
export type HtmlScope = 'full' | 'viewport' | 'selections';

/**
 * Unified capture model — a capture links element info and/or a screenshot.
 * Either part can be removed independently; a capture with neither is dropped.
 */
export interface FeedbackCapture {
  id: string;
  elementInfo?: string;
  elementHtml?: string;
  position?: { x: number; y: number };
  screenshot?: string; // base64 data URL (uploaded to storage at submit time)
}

export interface FeedbackAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string; // base64 data URL (uploaded to storage at submit time)
}

// ---- Settings persistence (manual localStorage, NOT zustand persist) ----

interface FeedbackSettings {
  wantNotification: boolean;
  notifyEmail: string;
  includeMetadata: boolean;
  includeConsole: boolean;
  consoleLevel: ConsoleLevel;
  consoleLimit: number;
  includeNetwork: boolean;
  networkLimit: number;
  includeHtml: boolean;
  htmlScope: HtmlScope;
}

const SETTINGS_KEY = 'feedback-settings';

const DEFAULT_SETTINGS: FeedbackSettings = {
  wantNotification: false,
  notifyEmail: '',
  includeMetadata: true,
  includeConsole: false,
  consoleLevel: 'error',
  consoleLimit: 50,
  includeNetwork: false,
  networkLimit: 25,
  includeHtml: true,
  htmlScope: 'selections',
};

function loadSettings(): FeedbackSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<FeedbackSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: FeedbackSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota errors */
  }
}

let captureIdCounter = 0;
function nextCaptureId(): string {
  captureIdCounter += 1;
  return `cap_${captureIdCounter}_${Date.now()}`;
}

interface FeedbackState extends FeedbackSettings {
  isOpen: boolean;
  isMinimized: boolean;
  hideTrigger: boolean;
  title: string;
  description: string;
  category: FeedbackCategory;
  currentUrl: string;

  captures: FeedbackCapture[];
  attachments: FeedbackAttachment[];

  isElementSelecting: boolean;
  isPinpointing: boolean;

  videoBlob: Blob | null;
  videoUrl: string | null;
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  isAudioRecording: boolean;
  recordingSeconds: number;

  isSubmitting: boolean;

  // dialog lifecycle
  open: () => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
  reset: () => void;
  setHideTrigger: (val: boolean) => void;

  // form
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setCategory: (category: FeedbackCategory) => void;

  // captures
  addCapture: (capture: Omit<FeedbackCapture, 'id'>) => string;
  addScreenshotToCapture: (id: string, screenshot: string) => void;
  addScreenshot: (screenshot: string) => string;
  updateCaptureScreenshot: (id: string, screenshot: string) => void;
  removeCapture: (id: string) => void;
  removeCaptureScreenshot: (id: string) => void;
  removeCaptureElement: (id: string) => void;

  // attachments
  addAttachment: (attachment: Omit<FeedbackAttachment, 'id'>) => void;
  removeAttachment: (id: string) => void;

  // capture modes
  setIsElementSelecting: (val: boolean) => void;
  setIsPinpointing: (val: boolean) => void;

  // media
  setVideoBlob: (blob: Blob | null) => void;
  setVideoUrl: (url: string | null) => void;
  setIsRecording: (val: boolean) => void;
  removeVideo: () => void;
  setAudioBlob: (blob: Blob | null) => void;
  setAudioUrl: (url: string | null) => void;
  setIsAudioRecording: (val: boolean) => void;
  removeAudio: () => void;
  setRecordingSeconds: (val: number) => void;

  setIsSubmitting: (val: boolean) => void;

  // settings (persisted)
  setWantNotification: (val: boolean) => void;
  setNotifyEmail: (val: string) => void;
  setIncludeMetadata: (val: boolean) => void;
  setIncludeConsole: (val: boolean) => void;
  setConsoleLevel: (val: ConsoleLevel) => void;
  setConsoleLimit: (val: number) => void;
  setIncludeNetwork: (val: boolean) => void;
  setNetworkLimit: (val: number) => void;
  setIncludeHtml: (val: boolean) => void;
  setHtmlScope: (val: HtmlScope) => void;
}

const transientInitialState = {
  isOpen: false,
  isMinimized: false,
  title: '',
  description: '',
  category: 'general' as FeedbackCategory,
  currentUrl: '',
  captures: [] as FeedbackCapture[],
  attachments: [] as FeedbackAttachment[],
  isElementSelecting: false,
  isPinpointing: false,
  videoBlob: null as Blob | null,
  videoUrl: null as string | null,
  isRecording: false,
  audioBlob: null as Blob | null,
  audioUrl: null as string | null,
  isAudioRecording: false,
  recordingSeconds: 0,
  isSubmitting: false,
};

export const useFeedbackStore = create<FeedbackState>((set, get) => {
  const persist = () => {
    const s = get();
    saveSettings({
      wantNotification: s.wantNotification,
      notifyEmail: s.notifyEmail,
      includeMetadata: s.includeMetadata,
      includeConsole: s.includeConsole,
      consoleLevel: s.consoleLevel,
      consoleLimit: s.consoleLimit,
      includeNetwork: s.includeNetwork,
      networkLimit: s.networkLimit,
      includeHtml: s.includeHtml,
      htmlScope: s.htmlScope,
    });
  };

  const revokeMediaUrls = () => {
    const { videoUrl, audioUrl } = get();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  };

  return {
    ...transientInitialState,
    ...loadSettings(),
    hideTrigger: false,

    open: () =>
      set({
        isOpen: true,
        isMinimized: false,
        currentUrl:
          typeof window !== 'undefined' ? window.location.href : '',
      }),
    close: () => {
      revokeMediaUrls();
      set({ ...transientInitialState });
    },
    minimize: () => set({ isMinimized: true }),
    restore: () => set({ isMinimized: false, isOpen: true }),
    reset: () => {
      revokeMediaUrls();
      set({ ...transientInitialState });
    },
    setHideTrigger: (val) => set({ hideTrigger: val }),

    setTitle: (title) => set({ title }),
    setDescription: (description) => set({ description }),
    setCategory: (category) => set({ category }),

    addCapture: (capture) => {
      const id = nextCaptureId();
      set((state) => ({ captures: [...state.captures, { id, ...capture }] }));
      return id;
    },
    addScreenshotToCapture: (id, screenshot) =>
      set((state) => ({
        captures: state.captures.map((c) =>
          c.id === id ? { ...c, screenshot } : c
        ),
      })),
    addScreenshot: (screenshot) => {
      const id = nextCaptureId();
      set((state) => ({ captures: [...state.captures, { id, screenshot }] }));
      return id;
    },
    updateCaptureScreenshot: (id, screenshot) =>
      set((state) => ({
        captures: state.captures.map((c) =>
          c.id === id ? { ...c, screenshot } : c
        ),
      })),
    removeCapture: (id) =>
      set((state) => ({ captures: state.captures.filter((c) => c.id !== id) })),
    removeCaptureScreenshot: (id) =>
      set((state) => ({
        captures: state.captures
          .map((c) => (c.id === id ? { ...c, screenshot: undefined } : c))
          .filter((c) => c.elementInfo || c.screenshot),
      })),
    removeCaptureElement: (id) =>
      set((state) => ({
        captures: state.captures
          .map((c) =>
            c.id === id
              ? {
                  ...c,
                  elementInfo: undefined,
                  elementHtml: undefined,
                  position: undefined,
                }
              : c
          )
          .filter((c) => c.elementInfo || c.screenshot),
      })),

    addAttachment: (attachment) =>
      set((state) => ({
        attachments: [
          ...state.attachments,
          { id: nextCaptureId(), ...attachment },
        ],
      })),
    removeAttachment: (id) =>
      set((state) => ({
        attachments: state.attachments.filter((a) => a.id !== id),
      })),

    setIsElementSelecting: (val) => set({ isElementSelecting: val }),
    setIsPinpointing: (val) => set({ isPinpointing: val }),

    setVideoBlob: (videoBlob) => set({ videoBlob }),
    setVideoUrl: (videoUrl) => set({ videoUrl }),
    setIsRecording: (isRecording) => set({ isRecording }),
    removeVideo: () => {
      const { videoUrl } = get();
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      set({ videoBlob: null, videoUrl: null });
    },
    setAudioBlob: (audioBlob) => set({ audioBlob }),
    setAudioUrl: (audioUrl) => set({ audioUrl }),
    setIsAudioRecording: (isAudioRecording) => set({ isAudioRecording }),
    removeAudio: () => {
      const { audioUrl } = get();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      set({ audioBlob: null, audioUrl: null });
    },
    setRecordingSeconds: (recordingSeconds) => set({ recordingSeconds }),

    setIsSubmitting: (isSubmitting) => set({ isSubmitting }),

    setWantNotification: (wantNotification) => {
      set({ wantNotification });
      persist();
    },
    setNotifyEmail: (notifyEmail) => {
      set({ notifyEmail });
      persist();
    },
    setIncludeMetadata: (includeMetadata) => {
      set({ includeMetadata });
      persist();
    },
    setIncludeConsole: (includeConsole) => {
      set({ includeConsole });
      persist();
    },
    setConsoleLevel: (consoleLevel) => {
      set({ consoleLevel });
      persist();
    },
    setConsoleLimit: (consoleLimit) => {
      set({ consoleLimit });
      persist();
    },
    setIncludeNetwork: (includeNetwork) => {
      set({ includeNetwork });
      persist();
    },
    setNetworkLimit: (networkLimit) => {
      set({ networkLimit });
      persist();
    },
    setIncludeHtml: (includeHtml) => {
      set({ includeHtml });
      persist();
    },
    setHtmlScope: (htmlScope) => {
      set({ htmlScope });
      persist();
    },
  };
});
