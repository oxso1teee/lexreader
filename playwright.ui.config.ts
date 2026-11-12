import { defineConfig, devices } from "@playwright/test";

// UI-kit тесты (e2e-ui/): без Supabase и логина — /dev/ui публичная страница
// справочника, поэтому нет globalSetup основного набора (e2e/global-setup.ts
// создаёт тестового пользователя в локальной базе). Порт 3100, чтобы не
// конфликтовать с `npm run dev` на 3000.
const PORT = Number(process.env.UI_KIT_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e-ui",
  fullyParallel: true,
  // next dev компилирует маршруты лениво: больше двух воркеров дают таймауты
  // навигации (ложные падения), на production-сборке ограничение не нужно.
  workers: process.env.CI ? 4 : 2,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/dev/ui`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
