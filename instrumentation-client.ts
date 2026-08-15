import * as Sentry from "@sentry/nextjs";

/**
 * Browser error reporting.
 *
 * Session replay is deliberately not enabled. Replaying a patient session would record their
 * pain scores, their wound photographs and whatever they typed into the "Something is wrong"
 * box, and send it to a third party.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  beforeSend(event) {
    if (event.user) event.user = { id: event.user.id };
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
