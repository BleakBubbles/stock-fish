/**
 * Installing the app (PWA). Chromium browsers fire `beforeinstallprompt` once,
 * early, when the app can be installed; we keep it so Settings can offer an
 * Install button later. Safari has no such event: there, people use Share →
 * Add to Home Screen.
 */
import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  /** Running as an installed app. */
  | 'installed'
  /** The browser can install it now (show a button). */
  | 'available'
  /** iPhone or iPad Safari: Share → Add to Home Screen. */
  | 'ios'
  /** Other browsers: their own menu, if they support it. */
  | 'menu';

let deferred: InstallPromptEvent | undefined;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Call once at startup, before the browser's event can fire. */
export function watchInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Keep it for our own button instead of the browser's mini-bar.
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = undefined;
    installed = true;
    notify();
  });
}

function standalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own flag for home-screen apps.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, but has touch.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function current(): InstallState {
  if (installed || standalone()) return 'installed';
  if (deferred) return 'available';
  return isIos() ? 'ios' : 'menu';
}

export function useInstallState(): InstallState {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, current);
}

/** Show the browser's install dialog. Only works in state 'available'. */
export async function promptInstall(): Promise<void> {
  const e = deferred;
  if (!e) return;
  deferred = undefined;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'accepted') installed = true;
  notify();
}
