"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function useLearningInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt>();
  const [installed, setInstalled] = useState(false);
  const [offline, setOffline] = useState<"preparing" | "ready" | "unavailable">(
    "preparing",
  );
  useEffect(() => {
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    );
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(undefined);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    let alive = true;
    let worker: ServiceWorkerContainer | undefined;
    try {
      worker = navigator.serviceWorker;
    } catch {
      /* Unavailable in restricted browser contexts. */
    }
    const receive = (event: MessageEvent) => {
      if (event.data?.type === "LEARNING_OFFLINE_READY" && alive)
        setOffline("ready");
      if (event.data?.type === "LEARNING_OFFLINE_UNAVAILABLE" && alive)
        setOffline("unavailable");
    };
    worker?.addEventListener("message", receive);
    if (process.env.NODE_ENV === "production" && worker) {
      const serviceWorker = worker;
      serviceWorker
        .getRegistration("/learn")
        .then((existing) =>
          serviceWorker
            .register("/learning-sw.js", {
              scope: "/learn",
              updateViaCache: "none",
            })
            .catch((error) => {
              if (existing) return existing;
              throw error;
            }),
        )
        .then(() => serviceWorker.ready)
        .then((registration) => {
          if (!alive) return;
          const assets = [
            ...Array.from(document.scripts).map((script) => script.src),
            ...Array.from(document.images).map(
              (image) => image.currentSrc || image.src,
            ),
            ...Array.from(
              document.querySelectorAll<HTMLLinkElement>(
                'link[rel="stylesheet"]',
              ),
            ).map((link) => link.href),
            ...performance
              .getEntriesByType("resource")
              .map((entry) => entry.name),
          ].filter((url) => {
            try {
              const asset = new URL(url);
              return (
                asset.origin === location.origin &&
                (asset.pathname.startsWith("/_next/static/") ||
                  asset.pathname.startsWith("/icons/") ||
                  asset.pathname.startsWith("/learning/"))
              );
            } catch {
              return false;
            }
          });
          registration.active?.postMessage({
            type: "PREPARE_LEARNING_OFFLINE",
            assets: [...new Set(assets)],
          });
        })
        .catch(() => {
          if (alive) setOffline("unavailable");
        });
    } else setOffline("unavailable");
    return () => {
      alive = false;
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
      worker?.removeEventListener("message", receive);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } finally {
      setPrompt(undefined);
    }
  }
  return { installed, available: Boolean(prompt), install, offline };
}

export default function LearningInstall({
  state,
}: {
  state: ReturnType<typeof useLearningInstall>;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700">
      <h3 className="flex items-center gap-2 font-semibold">
        <Smartphone className="h-4 w-4" /> Learning on your phone
      </h3>
      {state.installed ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Added to your home screen.
        </p>
      ) : state.available ? (
        <button
          onClick={() => void state.install()}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
        >
          <Download className="h-4 w-4" /> Add to home screen
        </button>
      ) : (
        <p className="text-sm leading-6 text-neutral-500">
          In Safari on iPhone, open Share, then Add to Home Screen. In Chrome on
          Android, open the browser menu and choose Install app or Add to Home
          screen.
        </p>
      )}
      <p role="status" className="text-xs leading-5 text-neutral-500">
        {state.offline === "ready"
          ? "Ready for offline visits. Exercises you open online remain available on this device. New exercises and account sync need a connection."
          : state.offline === "preparing"
            ? "Preparing this device for offline visits…"
            : "Offline visits are unavailable in this browser right now. You can keep learning online."}
      </p>
    </section>
  );
}
