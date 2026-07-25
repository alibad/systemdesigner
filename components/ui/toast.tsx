"use client";

import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { readonly children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration (default 5 seconds)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const contextValue = React.useMemo(() => ({ toasts, addToast, removeToast }), [toasts, addToast, removeToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastViewport() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="fixed inset-x-0 z-[10050] flex w-full flex-col items-center gap-2 px-4 sm:right-0 sm:left-auto sm:top-auto sm:items-end md:max-w-[420px]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { readonly toast: Toast; readonly onRemove: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false);

  React.useEffect(() => {
    // Trigger animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 150);
  };

  const variantStyles = {
    default: "border border-neutral-200/70 dark:border-neutral-800/70 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md text-neutral-950 dark:text-neutral-50",
    destructive: "border-red-300/70 dark:border-red-800/70 bg-red-50/90 dark:bg-red-950/90 backdrop-blur-md text-red-900 dark:text-red-50",
    success: "border-green-300/70 dark:border-green-800/70 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md text-neutral-900 dark:text-neutral-50"
  } as const;

  const iconStyles = {
    default: "text-blue-500",
    destructive: "text-red-500", 
    success: "text-green-500"
  };

  const getIcon = () => {
    switch (toast.variant) {
      case "destructive":
        return (
          <svg className={`h-5 w-5 ${iconStyles.destructive}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "success":
        return (
          <svg className={`h-5 w-5 ${iconStyles.success}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      default:
        return (
          <svg className={`h-5 w-5 ${iconStyles.default}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`
        group pointer-events-auto relative flex w-full max-w-[520px] items-center justify-between space-x-4 overflow-hidden rounded-xl border p-4 sm:p-5 pr-8 shadow-2xl transition-all
        ${variantStyles[toast.variant || "default"]}
        ${isVisible ? "animate-in slide-in-from-bottom sm:slide-in-from-right-full" : "animate-out slide-out-to-bottom sm:slide-out-to-right-full"}
      `}
    >
      {/* Accent bar */}
      <div
        className={`absolute left-0 top-0 h-full w-1 sm:w-1.5 ${(() => {
          if (toast.variant === 'destructive') return 'bg-red-500';
          if (toast.variant === 'success') return 'bg-green-500';
          return 'bg-blue-500';
        })()}`}
      />
      <div className="flex items-start space-x-3">
        {getIcon()}
        <div className="grid gap-1">
          {toast.title && (
            <div className="text-sm font-semibold">{toast.title}</div>
          )}
          {toast.description && (
            <div className="text-sm opacity-90">{toast.description}</div>
          )}
        </div>
      </div>
      
      <button
        onClick={handleClose}
        className="absolute right-2 top-2 rounded-md p-1 text-neutral-950/50 opacity-0 transition-opacity hover:text-neutral-950 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 dark:text-neutral-50/50 dark:hover:text-neutral-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
