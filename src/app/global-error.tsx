"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort error boundary.
 *
 * It says nothing clinical and offers no reassurance, because at this point the application
 * does not know what state it is in. The one useful thing it can do is give the patient the
 * route that does not depend on this software working: telephone the department.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Something went wrong</h1>
          <p style={{ fontSize: "1.125rem", lineHeight: 1.6 }}>
            Please close the app and open it again. Anything you had already saved on this phone
            has not been lost.
          </p>
          <p style={{ marginTop: "1rem", lineHeight: 1.6 }}>
            If you are worried about your hand, telephone the hand department directly rather
            than waiting for the app.
          </p>
        </main>
      </body>
    </html>
  );
}
