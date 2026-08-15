import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Emitted by @serwist/next on every build. Linting a bundled artefact tells us nothing
    // about code anyone wrote.
    "public/sw.js",
    "public/sw.js.map",
    "public/swe-worker-*.js",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
