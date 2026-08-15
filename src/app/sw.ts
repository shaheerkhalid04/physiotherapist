/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, NetworkFirst } from "serwist";

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
    {
      /**
       * The prescription is never served from the HTTP cache.
       *
       * A cached HTTP response carries no fetch timestamp the application can reason about,
       * so it would age invisibly and defeat the age bound in lib/offline/prescription. The
       * device copy lives in IndexedDB, stamped, and the client falls back to that.
       */
      matcher: ({ url }) => url.pathname.startsWith("/api/prescription"),
      handler: new NetworkOnly(),
    },
    {
      /**
       * Patient page shells, network first so a reload with no connection still opens the
       * app. These documents carry no clinical data by design: /today renders its exercises
       * on the client from the stamped IndexedDB copy, so caching the markup caches a shell
       * and not a prescription.
       */
      matcher: ({ request, url }) =>
        request.mode === "navigate" &&
        (url.pathname === "/today" ||
          url.pathname === "/progress" ||
          url.pathname === "/offline"),
      handler: new NetworkFirst({
        cacheName: "patient-shell",
        networkTimeoutSeconds: 5,
      }),
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
