import { defineConfig, devices } from "@playwright/test";

// Magpie e2e / 性能脚手架的 Playwright 配置。
// 大列表实测脚手架（C2 / 需求 21）通过 Vite dev server 提供 e2e/harness 下的页面。
// 注意：完整的 Tauri e2e（F1/C5/A10，任务 32）依赖桌面运行时，本配置先覆盖可在浏览器中
// 运行的纯前端脚手架，后续可在此基础上扩展 project。

export default defineConfig({
  testDir: "./e2e",
  // 大数据量渲染较慢，给单测留足超时余量。
  timeout: 120_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // 复用现有 Vite dev server（端口 1420，strictPort）。
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
