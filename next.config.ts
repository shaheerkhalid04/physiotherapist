import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

/**
 * Next 16 runs Turbopack by default. @serwist/next is a webpack plugin and has no stable
 * Turbopack equivalent yet, so dev and build are pinned to webpack with an explicit flag in
 * package.json rather than silently producing an app with no service worker.
 *
 * Revisit when @serwist/turbopack is stable: the PWA requirement is not optional here, since
 * the patient side has to work with the radio off.
 */
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // A stale cached shell during development makes every change look like it did not apply.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: ["@prisma/client", "exceljs"],
};

export default withSerwist(nextConfig);
