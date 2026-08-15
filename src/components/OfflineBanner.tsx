"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { onQueueChange, pendingCount, startAutoSync } from "@/lib/offline/queue";
import { translate, type Locale } from "@/i18n/messages";

/** Connectivity is external state, so it is read rather than mirrored into a state variable. */
function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Tells the patient the truth about where their data is.
 *
 * Silence would be worse than a banner: a patient who does not know their session is still
 * on the phone may assume the team has seen it.
 */
export function OfflineBanner({ locale }: { locale: Locale }) {
  const online = useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    // Server render assumes online, so the banner never flashes during hydration.
    () => true,
  );
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    void pendingCount().then(setQueued);
    const stopAutoSync = startAutoSync(setQueued);
    const unsubscribe = onQueueChange(setQueued);
    return () => {
      stopAutoSync();
      unsubscribe();
    };
  }, []);

  if (online && queued === 0) return null;

  const message = online ? "offline.syncing" : "offline.queued";

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="flex items-center gap-2 bg-accent-quiet px-4 py-2 text-base text-ink"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-current">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 3a1 1 0 011 1v4a1 1 0 01-2 0V6a1 1 0 011-1zm0 9.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
      </svg>
      <span>
        {translate(locale, message)}
        {queued > 0 ? ` (${queued})` : ""}
      </span>
    </div>
  );
}
