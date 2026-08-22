import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    // feat/page-transitions (PR #35) wraps every (app) route in a
    // fade+8px motion.div (src/app/(app)/template.tsx, 0.2s). An axe scan
    // that lands mid-fade briefly sees text at less than full opacity over
    // its background — a transient, false-positive color-contrast
    // violation, not a real a11y bug. e2e/practice-brain-a11y.spec.ts's
    // "Review Session ... question and revealed states" test already hit
    // the identical race for the unrelated .flip-reveal CSS animation and
    // fixed it locally via page.emulateMedia({ reducedMotion: "reduce" })
    // (see the comment there) — template.tsx affects every (app) page, not
    // one test, so this sets the same thing globally instead of patching
    // every affected a11y spec individually. Every animation in this app
    // is gated behind useReducedMotion() and is purely decorative (see
    // globals.css's flip-reveal, session-complete.tsx, daily-goal-row.tsx,
    // type-word-mode.tsx, multiple-choice-mode.tsx, template.tsx) — this
    // makes tests see the same settled, fully-accessible state a
    // prefers-reduced-motion user actually gets, not an artifact of
    // whatever moment axe happened to sample mid-transition.
    // This Playwright version nests it under contextOptions, not directly
    // on `use` (confirmed via node_modules/playwright/types/test.d.ts —
    // TestOptions.reducedMotion isn't a top-level property here).
    contextOptions: {
      reducedMotion: "reduce",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
