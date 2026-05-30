import { test, expect, type Page } from "@playwright/test";

// A10 开机自启动 e2e（C9 / 需求 27.1、27.4）。
//
// 复用 e2e-harness 脚手架 + Tauri mock。模拟后端 happy path：
// is_autostart_enabled 反推开关状态，toggle_autostart(enabled) 成功。
// 验证开关交互正向路径：启动读状态反推 → 开启/关闭调用 toggle_autostart 携正确参数。

const HARNESS_URL = "/e2e/harness/e2e-harness.html?case=a10";

async function gotoA10(page: Page, results: Record<string, unknown>) {
  await page.addInitScript((r) => {
    (window as unknown as { __mockConfig?: unknown }).__mockConfig = { results: r };
  }, results);
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => (window as unknown as { __e2eReady?: boolean }).__e2eReady === true);
}

async function getCalls(page: Page, cmd: string) {
  return page.evaluate((c) => {
    const log = (window as unknown as { __invokeLog?: { cmd: string; args: Record<string, unknown> }[] }).__invokeLog || [];
    return log.filter((x) => x.cmd === c);
  }, cmd);
}

test.describe("A10 开机自启动 (需求 8)", () => {
  test("启动读 is_autostart_enabled 反推开关为开启", async ({ page }) => {
    await gotoA10(page, { is_autostart_enabled: true });

    // 状态查询命令被调用且开关反推为开启（需求 8.6）
    await expect(page.getByTestId("autostart-status")).toContainText("ready=true");
    await expect(page.getByTestId("autostart-toggle")).toBeChecked();
    expect((await getCalls(page, "is_autostart_enabled")).length).toBeGreaterThanOrEqual(1);
  });

  test("开启自启动调用 toggle_autostart(true)", async ({ page }) => {
    await gotoA10(page, { is_autostart_enabled: false, toggle_autostart: null });

    await expect(page.getByTestId("autostart-status")).toContainText("ready=true");
    await page.getByTestId("autostart-toggle").check();

    const calls = await getCalls(page, "toggle_autostart");
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual({ enabled: true });
    await expect(page.getByTestId("autostart-toggle")).toBeChecked();
  });
});
