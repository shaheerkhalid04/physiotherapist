/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly } from "serwist";

/**
 * Service worker.
 *
 * The patient shell is precached so the app opens with the radio off. Writes are never
 * cached or replayed by the service worker: they go to the IndexedDB outbox in
 * lib/offline/queue.ts, which is the only thing that knows how to reconcile a duplicate.
 * Two independent replay mechanisms would be a good way to create the duplicate records
 * the acceptance criteria forbid.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // The sync endpoint is never served from cache and never background replayed here.
      matcher: ({ url }) => url.pathname.startsWith("/api/sync"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/auth"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
