"use client";

import { useEffect } from "react";

// Persists an onboarding form's in-progress state to sessionStorage so
// back/forward navigation within the tab restores what the user typed — without
// writing unsaved (and sometimes sensitive, e.g. SSN/ITIN) input to the server.
// Per-tab, cleared when the tab closes, and cleared explicitly on successful
// submit so a completed page doesn't restore stale input next visit.

export function readSessionFormDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearSessionFormDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// Writes `value` to sessionStorage whenever it changes, but only once `enabled`
// is true — pass `!isHydrating` so we never persist a half-loaded state over a
// good draft while the page is still rehydrating from the backend.
export function useSessionFormDraft<T>(key: string, value: T, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [key, value, enabled]);
}
