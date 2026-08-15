import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error reporting.
 *
 * See src/instrumentation-client.ts for why the defaults are overridden. The short version:
 * this application handles medical record numbers, wound photographs, pain scores and free
 * text a patient wrote about their own hand, and none of it belongs in a third-party error
 * tracker. `enableLogs` in particular would forward the console, and the OTP path logs
 * passcodes and phone numbers when no SMS gateway is configured.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  enableLogs: false,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies;
    if (event.request?.data) delete event.request.data;
    if (event.user) {
      // An internal id is enough to correlate. Names, emails and phone numbers are not.
      event.user = { id: event.user.id };
    }
    return event;
  },
});
