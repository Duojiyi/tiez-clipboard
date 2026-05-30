import { defineConfig } from "vitest/config";

// 前端单元测试配置（vitest）。
// - 仅扫描 src 下的 *.test.ts/tsx，避免误扫 e2e/ 的 Playwright *.spec.ts。
// - 纯逻辑测试使用 node 环境即可，无需 jsdom。
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
