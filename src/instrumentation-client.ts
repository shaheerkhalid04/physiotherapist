import * as Sentry from "@sentry/nextjs";

/**
 * Browser error reporting.
 *
 * The defaults are wrong for this application and are overridden deliberately:
 *
 * - `dataCollection.userInfo: false` and `httpBodies: []`. Left on, Sentry ships user data
 *   and request bodies. In this app a request body can be a pain score, a symptom log or
 *   whatever a patient typed into the "Something is wrong" box.
 * - `enableLogs: false`. Console output is forwarded when this is on, and this application
 *   logs one time passcodes and phone numbers to the console in development.
 * - `tracesSampleRate: 0.1` rather than 1. Tracing every request on a clinical tool is both
 *   expensive and more data leaving the building than is needed to find a bug.
 * - Session replay is not enabled and must not be. Replaying a patient session would record
 *   their pain scores, their wound photographs and their free text.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  enableLogs: false,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  beforeSend(event) {
    // Belt and braces, in case a future breadcrumb carries something it should not.
    if (event.user) event.user = { id: event.user.id };
    if (event.request?.cookies) delete event.request.cookies;
    if (event.request?.data) delete event.request.data;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
