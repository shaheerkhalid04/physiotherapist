"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

/**
 * Swagger UI is client only and heavy, so it is loaded on demand rather than shipped in the
 * main bundle. The patient side runs on low-end Android handsets and must not carry the
 * weight of a documentation viewer it will never open.
 */
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-ink-muted">Loading API documentation</p>,
});

export function SwaggerViewer() {
  return <SwaggerUI url="/api/openapi" />;
}
