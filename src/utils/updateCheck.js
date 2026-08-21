// In-app update check.
//
// The app fetches a tiny version manifest from the deployed web host and
// compares its versionCode against the installed build's. When the manifest is
// newer, the UI surfaces an "update available" banner with the changelog and a
// download link. The check is fully optional — offline, unreachable hosts, or
// an unconfigured URL simply skip it.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const CHECK_TIMEOUT_MS = 8000;

// Prefer the explicitly configured update URL (set VITE_UPDATE_URL when
// building the app for distribution). On the web the manifest lives next to
// the bundle, so the page's own origin works; in the native WebView the origin
// is a local server, so an explicit URL is required.
const NATIVE_UPDATE_URL = (import.meta.env.VITE_UPDATE_URL || '').trim();

function versionUrl() {
  if (NATIVE_UPDATE_URL) return NATIVE_UPDATE_URL;
  if (!Capacitor.isNativePlatform()) return `${window.location.origin}/version.json`;
  return '';
}

/** Returns update info if a newer build exists, otherwise null. Never throws. */
export async function checkForUpdate() {
  const url = versionUrl();
  if (!url || !navigator.onLine) return null;

  let localCode = 0;
  try {
    const info = await App.getInfo();
    localCode = Number(info.build) || 0;
  } catch {
    // Not running on a native device (e.g. browser dev) — nothing to compare.
    if (!Capacitor.isNativePlatform()) localCode = 0;
    else return null;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const manifest = await res.json();
    const remoteCode = Number(manifest.versionCode) || 0;
    if (remoteCode <= localCode) return null;
    return {
      versionCode: remoteCode,
      versionName: manifest.versionName || '',
      notes: manifest.notes || '',
      apkUrl: manifest.apkUrl ? new URL(manifest.apkUrl, window.location.origin).href : '',
    };
  } catch {
    return null;
  }
}