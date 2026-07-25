'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Camera,
  Crosshair,
  MousePointer,
  ChevronDown,
  X,
  Maximize2,
  Minimize2,
  Loader2,
  ExternalLink,
  Pencil,
  Mic,
  Video,
  Square,
  Settings,
  Bell,
  Paperclip,
  Trash2,
  ImagePlus,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useFeedbackStore,
  FeedbackCategory,
  ConsoleLevel,
  HtmlScope,
} from '@/lib/stores/feedbackStore';
import { useAuth } from '@/hooks/useAuth';
import {
  isFirebaseConfigured,
  submitFeedback as submitFirebaseFeedback,
} from '@/lib/firebase';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';
import { useToast } from '@/components/ui/toast';
import ScreenshotAnnotator from './ScreenshotAnnotator';
import {
  uploadFeedbackBlob,
  uploadFeedbackDataUrl,
  uploadFeedbackText,
} from '@/lib/feedback/upload';
import {
  getBrowserMetadata,
  getConsoleLogs,
  getNetworkLogs,
  capturePageHtml,
} from '@/lib/feedback/diagnostics';

const CATEGORIES: { value: FeedbackCategory; label: string; color: string }[] = [
  { value: 'bug', label: 'Bug', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800' },
  { value: 'feature', label: 'Feature Request', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  { value: 'ui', label: 'UI/UX', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { value: 'content', label: 'Content', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { value: 'general', label: 'General', color: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700' },
];

const MAX_RECORDING_SECONDS = 60;
const MAX_AUDIO_SECONDS = 600;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px), (pointer: coarse)');
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener('change', check);
    return () => mq.removeEventListener('change', check);
  }, []);
  return isMobile;
}

// --- Native Screen Capture helpers ---

async function captureNativeScreenshot(): Promise<string> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' } as MediaTrackConstraints,
    // @ts-expect-error preferCurrentTab is Chrome-only
    preferCurrentTab: true,
  });
  const track = stream.getVideoTracks()[0];
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  track.stop();
  stream.getTracks().forEach((t) => t.stop());
  return canvas.toDataURL('image/png');
}

async function withWidgetHidden<T>(fn: () => Promise<T>): Promise<T> {
  const root = document.getElementById('feedback-widget-root');
  if (root) root.style.display = 'none';
  await new Promise((r) => setTimeout(r, 100));
  try {
    return await fn();
  } finally {
    if (root) root.style.display = '';
  }
}

function cropToElement(base64: string, rect: DOMRect): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scaleX = img.width / window.innerWidth;
      const scaleY = img.height / window.innerHeight;
      const padding = 8;
      const cropLeft = Math.max(0, (rect.left - padding) * scaleX);
      const cropTop = Math.max(0, (rect.top - padding) * scaleY);
      const cropWidth = Math.min((rect.width + padding * 2) * scaleX, img.width - cropLeft);
      const cropHeight = Math.min((rect.height + padding * 2) * scaleY, img.height - cropTop);
      const canvas = document.createElement('canvas');
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      canvas
        .getContext('2d')!
        .drawImage(img, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = base64;
  });
}

function compressImage(base64: string, maxWidth = 1920, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

function fmtTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Self-contained confirm dialog (no native confirm()) ---

function ConfirmDialog({
  open,
  title,
  message,
  confirmText,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-2xl p-5">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{title}</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface FeedbackWidgetProps {
  onOpenAI?: () => void;
}

interface FeedbackDeliveryStatus {
  configured: boolean;
  issuesUrl: string;
}

export default function FeedbackWidget({ onOpenAI }: FeedbackWidgetProps) {
  const store = useFeedbackStore();
  const { user } = useAuth();
  const { triggerFeedback } = useNotificationTriggers();
  const { addToast } = useToast();
  const isMobile = useIsMobile();
  const hasMediaStorage = isFirebaseConfigured;

  const [annotatingImg, setAnnotatingImg] = useState<string | null>(null);
  const [annotatingCaptureId, setAnnotatingCaptureId] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [selectToolMode, setSelectToolMode] = useState<'select' | 'pinpoint'>('select');
  const [selectDropdownOpen, setSelectDropdownOpen] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<{
    rect: DOMRect;
    info: string;
    dims: string;
  } | null>(null);
  const [pinpointCursor, setPinpointCursor] = useState<{ x: number; y: number } | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'notifications' | 'diagnostics'>('notifications');
  const [confirmDeleteAudio, setConfirmDeleteAudio] = useState(false);
  const [confirmDeleteVideo, setConfirmDeleteVideo] = useState(false);
  const [deliveryStatus, setDeliveryStatus] =
    useState<FeedbackDeliveryStatus | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const selectDropdownRef = useRef<HTMLDivElement>(null);

  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!store.isOpen || deliveryStatus) return;
    let active = true;

    fetch('/api/feedback')
      .then(async (response) => {
        if (!response.ok) throw new Error('Feedback status unavailable');
        return response.json() as Promise<FeedbackDeliveryStatus>;
      })
      .then((status) => {
        if (active) setDeliveryStatus(status);
      })
      .catch(() => {
        // A transient status check should not hide a working submission path.
      });

    return () => {
      active = false;
    };
  }, [deliveryStatus, store.isOpen]);

  // ---- File handling ----

  const readFile = useCallback((file: File) => {
    const s = useFeedbackStore.getState();
    if (file.size > MAX_FILE_BYTES) {
      addToast({ title: 'File too large', description: 'Max 10MB per file', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      if (file.type.startsWith('image/')) {
        if (isMobile) {
          s.addScreenshot(reader.result);
        } else {
          setAnnotatingCaptureId(null);
          setAnnotatingImg(reader.result);
        }
      } else {
        s.addAttachment({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  }, [addToast, isMobile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach(readFile);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(readFile);
  };

  // Paste images while dialog open
  useEffect(() => {
    if (!store.isOpen || store.isMinimized) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            readFile(file);
          }
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [store.isOpen, store.isMinimized, readFile]);

  // ---- Screenshot button ----

  const captureScreenshot = useCallback(async () => {
    const s = useFeedbackStore.getState();
    s.minimize();
    setIsCapturing(true);
    await new Promise((r) => setTimeout(r, 200));
    try {
      const img = await withWidgetHidden(() => captureNativeScreenshot());
      s.restore();
      if (isMobile) {
        s.addScreenshot(img);
      } else {
        setAnnotatingCaptureId(null);
        setAnnotatingImg(img);
      }
    } catch {
      s.restore();
      addToast({ title: 'Screenshot cancelled', description: 'Capture was cancelled or not supported', variant: 'destructive' });
    } finally {
      setIsCapturing(false);
    }
  }, [addToast, isMobile]);

  // ---- Element Select ----

  const startElementSelect = useCallback(() => {
    setSelectDropdownOpen(false);
    const s = useFeedbackStore.getState();
    s.minimize();
    s.setIsElementSelecting(true);
  }, []);

  const startSelectTool = useCallback(() => {
    setSelectDropdownOpen(false);
    const s = useFeedbackStore.getState();
    s.minimize();
    if (selectToolMode === 'pinpoint') {
      s.setIsPinpointing(true);
    } else {
      s.setIsElementSelecting(true);
    }
  }, [selectToolMode]);

  const elementUnderPoint = (x: number, y: number, overlayId: string): HTMLElement | null => {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.style.pointerEvents = 'none';
    const target = document.elementFromPoint(x, y) as HTMLElement | null;
    if (overlay) overlay.style.pointerEvents = '';
    if (
      !target ||
      target === document.documentElement ||
      target === document.body ||
      target.closest('#feedback-widget-root')
    ) {
      return null;
    }
    return target;
  };

  const describeElement = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classes =
      el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
        : '';
    const rect = el.getBoundingClientRect();
    const dims = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
    const text = el.textContent?.trim().slice(0, 80) || '';
    return {
      rect,
      info: `<${tag}${id}${classes}>`,
      dims,
      full: `<${tag}${id}${classes}> ${dims}${text ? ` — "${text}"` : ''}`,
      html: el.outerHTML.slice(0, 50_000),
    };
  };

  const handleElementSelectMove = (e: React.PointerEvent) => {
    const el = elementUnderPoint(e.clientX, e.clientY, 'feedback-element-select-overlay');
    if (!el) {
      setHoveredElement(null);
      return;
    }
    const d = describeElement(el);
    setHoveredElement({ rect: d.rect, info: d.info, dims: d.dims });
  };

  const handleElementSelectClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const s = useFeedbackStore.getState();
    const el = elementUnderPoint(e.clientX, e.clientY, 'feedback-element-select-overlay');
    s.setIsElementSelecting(false);
    setHoveredElement(null);
    if (!el) {
      s.restore();
      return;
    }
    const d = describeElement(el);
    const rect = el.getBoundingClientRect();
    const captureId = s.addCapture({
      elementInfo: d.full,
      elementHtml: d.html,
      position: { x: Math.round(e.clientX), y: Math.round(e.clientY) },
    });
    if (!hasMediaStorage || isMobile) {
      s.restore();
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
    try {
      const cropped = await withWidgetHidden(async () => {
        const full = await captureNativeScreenshot();
        return cropToElement(full, rect);
      });
      s.addScreenshotToCapture(captureId, cropped);
    } catch {
      /* element info still captured */
    }
    s.restore();
  };

  // ---- Pinpoint ----

  const handlePinpointClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const s = useFeedbackStore.getState();
    const clickX = e.clientX;
    const clickY = e.clientY;
    const el = elementUnderPoint(clickX, clickY, 'feedback-pinpoint-overlay');
    const info = el ? describeElement(el).full : 'unknown';
    const captureId = s.addCapture({
      elementInfo: info,
      elementHtml: el ? describeElement(el).html : undefined,
      position: { x: Math.round(clickX), y: Math.round(clickY) },
    });
    s.setIsPinpointing(false);
    setPinpointCursor(null);

    const marker = document.createElement('div');
    marker.id = 'feedback-pinpoint-marker';
    marker.style.cssText = `position:fixed;left:${clickX - 24}px;top:${clickY - 24}px;z-index:99998;pointer-events:none;`;
    marker.innerHTML = `<svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="rgba(239,68,68,0.15)" stroke="#EF4444" stroke-width="2.5"/><circle cx="24" cy="24" r="3" fill="#EF4444"/><line x1="24" y1="2" x2="24" y2="14" stroke="#EF4444" stroke-width="2.5"/><line x1="24" y1="34" x2="24" y2="46" stroke="#EF4444" stroke-width="2.5"/><line x1="2" y1="24" x2="14" y2="24" stroke="#EF4444" stroke-width="2.5"/><line x1="34" y1="24" x2="46" y2="24" stroke="#EF4444" stroke-width="2.5"/></svg>`;
    document.body.appendChild(marker);
    await new Promise((r) => setTimeout(r, 200));
    try {
      if (hasMediaStorage) {
        const base64 = await withWidgetHidden(() => captureNativeScreenshot());
        s.addScreenshotToCapture(captureId, base64);
      }
    } catch {
      /* element info still captured */
    } finally {
      marker.remove();
      s.restore();
    }
  };

  // Close select dropdown on outside click
  useEffect(() => {
    if (!selectDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
        setSelectDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [selectDropdownOpen]);

  // ---- Voice recording ----

  const stopAudioRecording = useCallback(() => {
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    useFeedbackStore.getState().setIsAudioRecording(false);
  }, []);

  const startAudioRecording = useCallback(async () => {
    const s = useFeedbackStore.getState();
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      const recorder = new MediaRecorder(micStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        micStream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        const st = useFeedbackStore.getState();
        st.setAudioBlob(blob);
        st.setAudioUrl(URL.createObjectURL(blob));
      };
      recorder.start(1000);
      audioRecorderRef.current = recorder;
      audioStreamRef.current = micStream;
      s.setIsAudioRecording(true);
      s.setRecordingSeconds(0);
      let elapsed = 0;
      audioTimerRef.current = setInterval(() => {
        elapsed += 1;
        useFeedbackStore.getState().setRecordingSeconds(elapsed);
        if (elapsed >= MAX_AUDIO_SECONDS) stopAudioRecording();
      }, 1000);
    } catch {
      addToast({ title: 'Microphone blocked', description: 'Could not access the microphone', variant: 'destructive' });
    }
  }, [addToast, stopAudioRecording]);

  // ---- Screen recording ----

  const stopRecording = useCallback(() => {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      videoRecorderRef.current.stop();
    }
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }
    useFeedbackStore.getState().setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    const s = useFeedbackStore.getState();
    s.minimize();
    try {
      const displayStream = await withWidgetHidden(() =>
        navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' } as MediaTrackConstraints,
          // @ts-expect-error preferCurrentTab is Chrome-only
          preferCurrentTab: true,
        })
      );
      const tracks: MediaStreamTrack[] = [...displayStream.getVideoTracks()];
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tracks.push(...micStream.getAudioTracks());
      } catch {
        /* record without mic */
      }
      const combined = new MediaStream(tracks);
      videoStreamRef.current = displayStream;
      displayStream.getVideoTracks()[0].addEventListener('ended', () => stopRecording());

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';
      const recorder = new MediaRecorder(combined, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const st = useFeedbackStore.getState();
        st.setVideoBlob(blob);
        st.setVideoUrl(URL.createObjectURL(blob));
        st.restore();
      };
      recorder.start(1000);
      videoRecorderRef.current = recorder;
      s.setIsRecording(true);
      s.setRecordingSeconds(0);
      let elapsed = 0;
      videoTimerRef.current = setInterval(() => {
        elapsed += 1;
        useFeedbackStore.getState().setRecordingSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) stopRecording();
      }, 1000);
    } catch {
      s.restore();
      addToast({ title: 'Recording cancelled', description: 'Screen recording was cancelled or not supported', variant: 'destructive' });
    }
  }, [addToast, stopRecording]);

  // Cleanup recorders on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      stopAudioRecording();
    };
  }, [stopRecording, stopAudioRecording]);

  // ESC cascade: select/pinpoint → annotator → lightbox → minimize
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useFeedbackStore.getState();
      if (s.isElementSelecting || s.isPinpointing) {
        s.setIsElementSelecting(false);
        s.setIsPinpointing(false);
        setHoveredElement(null);
        setPinpointCursor(null);
        s.restore();
      } else if (annotatingImg) {
        // annotator handles its own escape
      } else if (lightbox) {
        setLightbox(null);
      } else if (s.isOpen && !s.isMinimized) {
        s.minimize();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [annotatingImg, lightbox]);

  // ---- Submit ----

  const buildDiagnostics = async (s: ReturnType<typeof useFeedbackStore.getState>) => {
    const diagnostics: Record<string, unknown> = {};
    if (s.includeMetadata) diagnostics.metadata = getBrowserMetadata();
    if (hasMediaStorage && s.includeConsole) {
      const logs = getConsoleLogs()
        .filter((e) => {
          if (s.consoleLevel === 'error') return e.level === 'error';
          if (s.consoleLevel === 'warn') return e.level === 'error' || e.level === 'warn';
          return true;
        })
        .slice(-s.consoleLimit);
      if (logs.length) {
        diagnostics.consoleUrl = await uploadFeedbackText(
          JSON.stringify(logs, null, 2),
          'console.txt'
        );
      }
    }
    if (hasMediaStorage && s.includeNetwork) {
      const logs = getNetworkLogs().slice(-s.networkLimit);
      if (logs.length) {
        diagnostics.networkUrl = await uploadFeedbackText(
          JSON.stringify(logs, null, 2),
          'network.txt'
        );
      }
    }
    if (hasMediaStorage && s.includeHtml) {
      const html =
        s.htmlScope === 'selections'
          ? s.captures
              .map((capture) => capture.elementHtml)
              .filter((value): value is string => Boolean(value))
              .join('\n\n<!-- ---- -->\n\n')
          : capturePageHtml(s.htmlScope);
      if (html) diagnostics.htmlUrl = await uploadFeedbackText(html, 'page-snapshot.txt');
    }
    return Object.keys(diagnostics).length ? diagnostics : undefined;
  };

  const handleSubmit = async () => {
    const s = useFeedbackStore.getState();
    if (!s.title.trim()) return;
    if (deliveryStatus?.configured === false) return;
    if (s.isRecording || s.isAudioRecording) {
      addToast({ title: 'Recording in progress', description: 'Stop the recording before submitting', variant: 'destructive' });
      return;
    }

    const title = s.title;
    const description = s.description;
    const category = s.category;
    const currentUrl = s.currentUrl || window.location.href;

    s.setIsSubmitting(true);
    try {
      const uploadedCaptures = await Promise.all(
        s.captures.map(async (c, i) => {
          let screenshotUrl: string | undefined;
          if (hasMediaStorage && c.screenshot) {
            const compressed = await compressImage(c.screenshot);
            screenshotUrl = await uploadFeedbackDataUrl(compressed, `capture-${i}.jpg`);
          }
          return { elementInfo: c.elementInfo, position: c.position, screenshotUrl };
        })
      );

      let videoUrl: string | undefined;
      let audioUrl: string | undefined;
      if (hasMediaStorage && s.videoBlob) {
        videoUrl = await uploadFeedbackBlob(s.videoBlob, 'recording.webm', s.videoBlob.type);
      }
      if (hasMediaStorage && s.audioBlob) {
        audioUrl = await uploadFeedbackBlob(s.audioBlob, 'voice.webm', s.audioBlob.type);
      }

      const uploadedAttachments = hasMediaStorage
        ? await Promise.all(
            s.attachments.map(async (a) => ({
              name: a.name,
              type: a.type,
              size: a.size,
              url: await uploadFeedbackDataUrl(a.dataUrl, a.name),
            }))
          )
        : [];

      const diagnostics = await buildDiagnostics(s);
      const email =
        s.wantNotification && s.notifyEmail.trim() ? s.notifyEmail.trim() : undefined;

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          captures: uploadedCaptures,
          videoUrl,
          audioUrl,
          attachments: uploadedAttachments,
          diagnostics,
          pagePath: window.location.pathname,
          currentUrl,
          userAgent: navigator.userAgent,
          email,
        }),
      });
      const result = await res.json();

      // Mirror to Firebase and fire notifications when that optional backend exists.
      if (isFirebaseConfigured) {
        try {
          const feedbackId = await submitFirebaseFeedback({
            feedback: `${title}\n\n${description}`,
            category,
            userId: user?.uid || null,
            userEmail: user?.email || null,
            userName: user?.displayName || null,
            userPhotoURL: user?.photoURL || null,
            isAnonymous: user?.isAnonymous ?? true,
            timestamp: new Date(),
            url: currentUrl,
            userAgent: navigator.userAgent,
          });
          await triggerFeedback({
            id: feedbackId,
            feedback: `${title}\n\n${description}`,
            category,
            userEmail: user?.email || undefined,
            urgent:
              description.toLowerCase().includes('urgent') ||
              description.toLowerCase().includes('critical') ||
              category === 'bug',
            url: currentUrl,
            pageTitle: document.title,
          });
        } catch (firebaseErr) {
          console.error('Firebase feedback mirror failed:', firebaseErr);
        }
      }

      if (result.success) {
        setSuccessUrl(result.issueUrl || null);
        store.reset();
        addToast({ title: 'Feedback submitted', description: 'Thank you for your feedback!', variant: 'success' });
        setTimeout(() => setSuccessUrl(null), 4000);
      } else {
        if (result.code === 'setup_required') {
          setDeliveryStatus({
            configured: false,
            issuesUrl:
              result.issuesUrl ||
              'https://github.com/alibad/systemdesigner/issues/new/choose',
          });
        }
        addToast({ title: 'Submission failed', description: result.error || 'Please try again', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Submit error:', error);
      addToast({ title: 'Error', description: 'Something went wrong while submitting', variant: 'destructive' });
    } finally {
      useFeedbackStore.getState().setIsSubmitting(false);
    }
  };

  // ---- Annotator ----
  if (annotatingImg) {
    return (
      <div id="feedback-widget-root">
        <ScreenshotAnnotator
          imageData={annotatingImg}
          onSave={(annotated) => {
            const s = useFeedbackStore.getState();
            if (annotatingCaptureId) {
              s.updateCaptureScreenshot(annotatingCaptureId, annotated);
            } else {
              s.addScreenshot(annotated);
            }
            setAnnotatingImg(null);
            setAnnotatingCaptureId(null);
          }}
          onCancel={() => {
            setAnnotatingImg(null);
            setAnnotatingCaptureId(null);
          }}
        />
      </div>
    );
  }

  // ---- Element Select overlay ----
  if (store.isElementSelecting) {
    return (
      <div
        id="feedback-element-select-overlay"
        className="fixed inset-0 z-[99999] cursor-crosshair"
        onPointerMove={handleElementSelectMove}
        onClick={handleElementSelectClick}
      >
        {hoveredElement && (
          <>
            <div
              className="pointer-events-none fixed border-2 border-blue-500 bg-blue-500/10 rounded-sm"
              style={{
                left: hoveredElement.rect.left,
                top: hoveredElement.rect.top,
                width: hoveredElement.rect.width,
                height: hoveredElement.rect.height,
              }}
            />
            <div
              className="pointer-events-none fixed bg-neutral-900 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg flex items-center gap-2 max-w-xs"
              style={{
                left: hoveredElement.rect.left,
                top:
                  hoveredElement.rect.bottom + 60 > window.innerHeight
                    ? hoveredElement.rect.top - 32
                    : hoveredElement.rect.bottom + 4,
              }}
            >
              <span className="font-mono text-blue-300">{hoveredElement.info}</span>
              <span className="text-neutral-400">{hoveredElement.dims}</span>
            </div>
          </>
        )}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <MousePointer className="w-4 h-4 text-blue-400" />
          Hover to inspect, click to select. Press Esc to cancel.
        </div>
      </div>
    );
  }

  // ---- Pinpoint overlay ----
  if (store.isPinpointing) {
    return (
      <div
        id="feedback-pinpoint-overlay"
        className="fixed inset-0 z-[99999]"
        style={{ cursor: 'none' }}
        onClick={handlePinpointClick}
        onPointerMove={(e) => setPinpointCursor({ x: e.clientX, y: e.clientY })}
        onPointerLeave={() => setPinpointCursor(null)}
      >
        {pinpointCursor && (
          <svg
            className="pointer-events-none fixed"
            style={{ left: pinpointCursor.x - 24, top: pinpointCursor.y - 24, width: 48, height: 48 }}
            viewBox="0 0 48 48"
          >
            <circle cx="24" cy="24" r="18" fill="none" stroke="#EF4444" strokeWidth="2.5" />
            <circle cx="24" cy="24" r="3" fill="#EF4444" />
            <line x1="24" y1="2" x2="24" y2="14" stroke="#EF4444" strokeWidth="2.5" />
            <line x1="24" y1="34" x2="24" y2="46" stroke="#EF4444" strokeWidth="2.5" />
            <line x1="2" y1="24" x2="14" y2="24" stroke="#EF4444" strokeWidth="2.5" />
            <line x1="34" y1="24" x2="46" y2="24" stroke="#EF4444" strokeWidth="2.5" />
          </svg>
        )}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-red-400" />
          Click on the element you want to report. Press Esc to cancel.
        </div>
      </div>
    );
  }

  // ---- Capture-in-progress overlay ----
  if (isCapturing) {
    return (
      <div id="feedback-widget-root">
        <div className="fixed inset-0 z-[99999] bg-white/10 flex items-center justify-center">
          <div className="bg-neutral-900 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            Capturing screenshot...
          </div>
        </div>
      </div>
    );
  }

  // ---- Lightbox ----
  if (lightbox) {
    return (
      <div
        className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-8"
        onClick={() => setLightbox(null)}
      >
        <button className="absolute top-4 right-4 text-white hover:text-neutral-300" onClick={() => setLightbox(null)}>
          <X className="w-6 h-6" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lightbox} alt="Screenshot" className="max-w-full max-h-full object-contain rounded" onClick={(e) => e.stopPropagation()} />
      </div>
    );
  }

  // ---- Success state ----
  if (successUrl !== null) {
    return (
      <div id="feedback-widget-root" className="fixed bottom-6 right-6 z-50">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl p-6 w-80 text-center">
          <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Thank you!</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">Your feedback has been submitted.</p>
          {successUrl && (
            <a href={successUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
              View Issue <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    );
  }

  const toolBtn =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50';

  return (
    <div id="feedback-widget-root">
      {/* Floating recording indicator */}
      {store.isRecording && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 bg-neutral-900 text-white rounded-full shadow-lg px-4 py-3 border border-neutral-700">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium tabular-nums">{fmtTime(MAX_RECORDING_SECONDS - store.recordingSeconds)}</span>
          <button onClick={stopRecording} className="ml-1 inline-flex items-center gap-1 text-sm bg-red-600 hover:bg-red-700 rounded-full px-2.5 py-1">
            <Square className="w-3 h-3" /> Stop
          </button>
        </div>
      )}

      {/* Unified learning and feedback launcher */}
      {!store.isOpen && !store.hideTrigger && !store.isRecording && (
        <div
          className="fixed bottom-6 right-6 z-50 flex h-12 items-stretch overflow-hidden rounded-full border border-border bg-background/95 text-foreground shadow-lg backdrop-blur-md"
          role="group"
          aria-label="Learning assistance and feedback"
        >
          {onOpenAI && (
            <button
              type="button"
              onClick={onOpenAI}
              className="flex h-12 items-center gap-2 px-3 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              title="Ask AI about this page or selected text"
              aria-label="Ask AI about this page or selected text"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>
          )}
          {onOpenAI && <span className="my-2 w-px bg-border" aria-hidden="true" />}
          <button
            type="button"
            onClick={() => store.open()}
            className="flex h-12 w-12 items-center justify-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            title="Send feedback"
            aria-label="Send feedback"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Minimized pill */}
      {store.isOpen && store.isMinimized && !store.isRecording && (
        <button
          onClick={() => store.restore()}
          className="fixed bottom-6 right-6 z-50 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full shadow-lg px-4 py-3 flex items-center gap-2 hover:shadow-xl transition-all"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="text-sm font-medium">Continue feedback</span>
        </button>
      )}

      {/* Main dialog */}
      {store.isOpen && !store.isMinimized && (
        <>
          <div className="fixed inset-0 z-[49] bg-black/20" onClick={() => store.minimize()} />
          <div
            className={
              isMobile
                ? 'fixed inset-0 z-50 bg-white dark:bg-neutral-900 flex flex-col'
                : 'fixed bottom-6 right-6 z-50 w-[420px] max-h-[90vh] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden'
            }
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 relative">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Send Feedback</h2>
              <div className="flex items-center gap-1">
                {onOpenAI && (
                  <button
                    onClick={() => {
                      store.minimize();
                      onOpenAI();
                    }}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300"
                    title="Ask AI about this page"
                    aria-label="Ask AI about this page"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setShowSettings((v) => !v)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                  title="Settings"
                  aria-label="Feedback settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {!isMobile && (
                  <button
                    onClick={() => store.minimize()}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                    title="Minimize"
                    aria-label="Minimize feedback"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => store.close()}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                  title="Close"
                  aria-label="Close feedback"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Settings popover */}
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setShowSettings(false)} />
                  <div className="absolute right-3 top-full z-[61] w-72 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-2xl overflow-hidden">
                    <div className="flex border-b border-neutral-200 dark:border-neutral-700 text-sm">
                      {(['notifications', 'diagnostics'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setSettingsTab(tab)}
                          className={`flex-1 px-3 py-2 capitalize ${settingsTab === tab ? 'border-b-2 border-blue-500 text-neutral-900 dark:text-neutral-100 font-medium' : 'text-neutral-500'}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-64 overflow-y-auto p-3 space-y-3 text-sm">
                      {settingsTab === 'notifications' ? (
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                            <input
                              type="checkbox"
                              checked={store.wantNotification}
                              onChange={(e) => store.setWantNotification(e.target.checked)}
                            />
                            <Bell className="w-3.5 h-3.5" /> Notify me when resolved
                          </label>
                          {store.wantNotification && (
                            <input
                              type="email"
                              value={store.notifyEmail}
                              onChange={(e) => store.setNotifyEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 text-neutral-700 dark:text-neutral-300">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={store.includeMetadata} onChange={(e) => store.setIncludeMetadata(e.target.checked)} />
                            Browser metadata
                          </label>

                          {hasMediaStorage && (
                            <div>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" checked={store.includeConsole} onChange={(e) => store.setIncludeConsole(e.target.checked)} />
                                Console logs
                              </label>
                              {store.includeConsole && (
                                <div className="pl-6 pt-1.5 space-y-1">
                                  {(['error', 'warn', 'all'] as ConsoleLevel[]).map((lvl) => (
                                    <label key={lvl} className="flex items-center gap-2 text-xs">
                                      <input type="radio" name="consoleLevel" checked={store.consoleLevel === lvl} onChange={() => store.setConsoleLevel(lvl)} />
                                      {lvl === 'error' ? 'Errors only' : lvl === 'warn' ? 'Warnings+' : 'All levels'}
                                    </label>
                                  ))}
                                  <label className="flex items-center gap-1.5 text-xs">
                                    Last
                                    <input
                                      type="number"
                                      min={5}
                                      max={100}
                                      value={store.consoleLimit}
                                      onChange={(e) => store.setConsoleLimit(Number(e.target.value))}
                                      className="w-14 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                    />
                                    entries
                                  </label>
                                </div>
                              )}
                            </div>
                          )}

                          {hasMediaStorage && (
                            <div>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" checked={store.includeNetwork} onChange={(e) => store.setIncludeNetwork(e.target.checked)} />
                                Network requests
                              </label>
                              {store.includeNetwork && (
                                <label className="flex items-center gap-1.5 text-xs pl-6 pt-1.5">
                                  Last
                                  <input
                                    type="number"
                                    min={5}
                                    max={50}
                                    value={store.networkLimit}
                                    onChange={(e) => store.setNetworkLimit(Number(e.target.value))}
                                    className="w-14 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                  />
                                  entries
                                </label>
                              )}
                            </div>
                          )}

                          {hasMediaStorage && (
                            <div>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" checked={store.includeHtml} onChange={(e) => store.setIncludeHtml(e.target.checked)} />
                                Page HTML
                              </label>
                              {store.includeHtml && (
                                <div className="pl-6 pt-1.5 space-y-1">
                                  {(['selections', 'viewport', 'full'] as HtmlScope[]).map((sc) => (
                                    <label key={sc} className="flex items-center gap-2 text-xs">
                                      <input type="radio" name="htmlScope" checked={store.htmlScope === sc} onChange={() => store.setHtmlScope(sc)} />
                                      {sc === 'selections'
                                        ? 'Selected elements'
                                        : sc === 'viewport'
                                          ? 'Visible viewport'
                                          : 'Full page'}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {deliveryStatus?.configured === false && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                  role="status"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">In-app submission is not configured here.</p>
                    <a
                      href={deliveryStatus.issuesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      Open the GitHub issue form
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}
              {/* Category pills */}
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => store.setCategory(cat.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        store.category === cat.value
                          ? `${cat.color} ring-2 ring-offset-1 ring-neutral-400 dark:ring-neutral-500 dark:ring-offset-neutral-900`
                          : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label htmlFor="feedback-title" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Title</label>
                <input
                  id="feedback-title"
                  type="text"
                  value={store.title}
                  onChange={(e) => store.setTitle(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="feedback-desc" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Description</label>
                <textarea
                  id="feedback-desc"
                  value={store.description}
                  onChange={(e) => store.setDescription(e.target.value)}
                  placeholder={isMobile ? 'Describe in detail (you can paste screenshots too)...' : 'Describe in detail...'}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Capture tools */}
              <div className="flex flex-wrap gap-2">
                {!hasMediaStorage ? (
                  <button
                    type="button"
                    onClick={startElementSelect}
                    className={`${toolBtn} ${isMobile ? 'w-full min-h-11 justify-center' : ''}`}
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                    Select element
                  </button>
                ) : isMobile ? (
                  <>
                    <button
                      type="button"
                      onClick={startElementSelect}
                      className={`${toolBtn} min-h-11 flex-1 justify-center`}
                    >
                      <MousePointer className="w-4 h-4" />
                      Select element
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`${toolBtn} w-full justify-center min-h-11`}
                    >
                      <ImagePlus className="w-4 h-4" /> Add Screenshot or Photo
                    </button>
                    <button
                      type="button"
                      onClick={store.isAudioRecording ? stopAudioRecording : startAudioRecording}
                      className={`${toolBtn} min-h-11 flex-1 justify-center ${store.isAudioRecording ? 'ring-2 ring-red-500' : ''}`}
                    >
                      {store.isAudioRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      {store.isAudioRecording ? `Stop ${fmtTime(store.recordingSeconds)}` : 'Voice'}
                    </button>
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      className={`${toolBtn} min-h-11 flex-1 justify-center`}
                    >
                      <Paperclip className="w-3.5 h-3.5" /> Attach
                    </button>
                  </>
                ) : (
                  <>
                    {/* Select / Pinpoint split button */}
                    <div className="relative inline-flex" ref={selectDropdownRef}>
                      <button type="button" onClick={startSelectTool} className={`${toolBtn} rounded-r-none`}>
                        {selectToolMode === 'select' ? <MousePointer className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />}
                        {selectToolMode === 'select' ? 'Select' : 'Pinpoint'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectDropdownOpen((v) => !v)}
                        className={`${toolBtn} rounded-l-none border-l-0 px-1.5`}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {selectDropdownOpen && (
                        <div className="absolute bottom-full mb-1 left-0 w-44 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-xl py-1 z-10">
                          <button type="button" onClick={() => { setSelectToolMode('select'); setSelectDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2">
                            <MousePointer className="w-3.5 h-3.5 text-blue-500" /> Select Element
                          </button>
                          <button type="button" onClick={() => { setSelectToolMode('pinpoint'); setSelectDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2">
                            <Crosshair className="w-3.5 h-3.5 text-red-500" /> Pinpoint
                          </button>
                        </div>
                      )}
                    </div>

                    <button type="button" onClick={captureScreenshot} className={toolBtn}>
                      <Camera className="w-3.5 h-3.5" /> Screenshot
                    </button>
                    <button type="button" onClick={startRecording} className={toolBtn}>
                      <Video className="w-3.5 h-3.5" /> Record
                    </button>
                    <button
                      type="button"
                      onClick={store.isAudioRecording ? stopAudioRecording : startAudioRecording}
                      className={`${toolBtn} ${store.isAudioRecording ? 'ring-2 ring-red-500' : ''}`}
                    >
                      {store.isAudioRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      {store.isAudioRecording ? `Stop ${fmtTime(store.recordingSeconds)}` : 'Voice'}
                    </button>
                  </>
                )}
                {hasMediaStorage && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={isMobile ? 'image/*' : '*/*'}
                      multiple
                      className="hidden"
                      onChange={handleFileInput}
                    />
                    {isMobile && (
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileInput}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Audio recording inline indicator */}
              {store.isAudioRecording && (
                <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Recording voice... {fmtTime(MAX_AUDIO_SECONDS - store.recordingSeconds)} left
                </div>
              )}

              {/* Captures */}
              {store.captures.length > 0 && (
                <div className="space-y-2">
                  {store.captures.map((c) => (
                    <div key={c.id} className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                      {c.elementInfo && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800/60">
                          <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 truncate">
                            <MousePointer className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <code className="font-mono truncate">{c.elementInfo}</code>
                          </span>
                          <button onClick={() => store.removeCaptureElement(c.id)} className="text-neutral-400 hover:text-red-500 shrink-0" title="Remove element">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {c.screenshot && (
                        <div className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.screenshot} alt="Capture" className="w-full h-24 object-cover cursor-pointer" onClick={() => setLightbox(c.screenshot!)} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                            {!isMobile && (
                              <button onClick={() => { setAnnotatingCaptureId(c.id); setAnnotatingImg(c.screenshot!); }} className="p-1 bg-white/90 rounded text-neutral-800 hover:bg-white" title="Annotate">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => store.removeCaptureScreenshot(c.id)} className="p-1 bg-red-500/90 rounded text-white hover:bg-red-500" title="Remove screenshot">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone (desktop) */}
              {!isMobile && hasMediaStorage && (
                <div
                  className="border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-lg p-3 text-center text-xs text-neutral-400 dark:text-neutral-500 cursor-pointer hover:border-blue-400"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400'); }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('border-blue-400')}
                  onDrop={(e) => { e.currentTarget.classList.remove('border-blue-400'); handleDrop(e); }}
                >
                  Drop images or files here, paste, or click to upload
                </div>
              )}

              {/* Attachments */}
              {store.attachments.length > 0 && (
                <div className="space-y-1.5">
                  {store.attachments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
                      <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 truncate">
                        <Paperclip className="w-3.5 h-3.5 shrink-0" /> {a.name}
                      </span>
                      <button onClick={() => store.removeAttachment(a.id)} className="text-neutral-400 hover:text-red-500 shrink-0" title="Remove">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Video preview */}
              {store.videoUrl && (
                <div className="space-y-1.5">
                  <video src={store.videoUrl} controls className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700" />
                  <button onClick={() => setConfirmDeleteVideo(true)} className="text-xs text-red-600 dark:text-red-400 inline-flex items-center gap-1 hover:underline">
                    <Trash2 className="w-3.5 h-3.5" /> Remove recording
                  </button>
                </div>
              )}

              {/* Audio preview */}
              {store.audioUrl && (
                <div className="space-y-1.5">
                  <audio src={store.audioUrl} controls className="w-full" />
                  <button onClick={() => setConfirmDeleteAudio(true)} className="text-xs text-red-600 dark:text-red-400 inline-flex items-center gap-1 hover:underline">
                    <Trash2 className="w-3.5 h-3.5" /> Remove voice note
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => store.close()}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={
                  !store.title.trim() ||
                  store.isSubmitting ||
                  store.isRecording ||
                  store.isAudioRecording ||
                  deliveryStatus?.configured === false
                }
              >
                {store.isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Destructive confirmations */}
      <ConfirmDialog
        open={confirmDeleteVideo}
        title="Delete recording?"
        message="This screen recording will be permanently removed. You can record a new one."
        confirmText="Delete"
        onConfirm={() => { store.removeVideo(); setConfirmDeleteVideo(false); }}
        onCancel={() => setConfirmDeleteVideo(false)}
      />
      <ConfirmDialog
        open={confirmDeleteAudio}
        title="Delete voice note?"
        message="This voice note will be permanently removed. You can re-record a new one."
        confirmText="Delete"
        onConfirm={() => { store.removeAudio(); setConfirmDeleteAudio(false); }}
        onCancel={() => setConfirmDeleteAudio(false)}
      />
    </div>
  );
}
