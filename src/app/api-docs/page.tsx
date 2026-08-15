import { SwaggerViewer } from "@/components/SwaggerViewer";

export const metadata = {
  title: "API documentation",
};

/**
 * Swagger UI.
 *
 * Public, because it documents shapes and rules rather than data. Every endpoint it
 * describes is behind a session, so an unauthenticated reader can see what the API does and
 * nothing about anybody's hand.
 */
export default function ApiDocsPage() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-border bg-surface px-6 py-4">
        <h1 className="text-lg font-semibold">API documentation</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every endpoint below requires a session. Nothing here can create or alter a
          prescription.
        </p>
      </header>
      <SwaggerViewer />
    </div>
  );
}
