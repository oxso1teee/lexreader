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
  {
    rules: {
      // next/font/google скачивает шрифты с fonts.googleapis.com во время
      // `next build`; Google периодически отвечает URL-ами без расширения
      // (…/l/font?kit=…&skey=…), на которых сборка падает случайным образом
      // (Turbopack: "next/font/google queries have exactly one entry",
      // webpack: "Cannot read properties of null (reading '1')").
      // Шрифты лежат в src/app/fonts/ — см. README.md рядом.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/font/google",
              message:
                "Use next/font/local with a committed woff2 (see src/app/fonts/README.md): next/font/google makes `next build` flaky.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
