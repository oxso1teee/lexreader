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
    // Capacitor native platform projects (android/, ios/) — not part of
    // the Next.js/TS project at all, but a local `./gradlew assembleDebug`
    // drops generated JS (bundled Capacitor bridge, node_modules copies)
    // under android/app/build/ that ESLint would otherwise happily lint as
    // if it were our own source.
    "android/**",
    "ios/**",
  ]),
]);

export default eslintConfig;
