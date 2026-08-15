import * as Sentry from "@sentry/nextjs";

/** Edge runtime reporting. Same privacy posture as the server config. */
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
});
