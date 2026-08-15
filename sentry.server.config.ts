import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error reporting.
 *
 * `sendDefaultPii` is off and stays off. This application handles medical record numbers,
 * wound photographs and free text a patient wrote about their own hand; none of that belongs
 * in a third-party error tracker. The scrubbing below is a second line of defence in case a
 * future breadcrumb carries something it should not.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

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
