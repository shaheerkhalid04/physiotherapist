export const dynamic = "force-static";

/**
 * Offline fallback for navigations the service worker cannot satisfy.
 *
 * It is deliberately plain and gives no clinical guidance, because an offline device cannot
 * know what a clinician would say.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">You are offline</h1>
      <p className="text-lg">
        Your exercises and anything you have recorded are saved on this phone. They will be sent
        to the hand team as soon as you have signal.
      </p>
      <p className="text-base text-ink-muted">
        If you are worried about your hand, telephone the hand department directly.
      </p>
    </div>
  );
}
