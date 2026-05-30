import { test, expect, type Page } from "@playwright/test";

// C5 Win+V 接管 e2e（C9 / 需求 27.1、27.4）。
//
// 复用 e2e-harness 脚手架 + Tauri mock。模拟后端 happy path：
// is_registry_win_v_optimized 返回初始未接管，trigger_registry_win_v_optimization 成功。
// 验证开关交互正向路径：打开面板反推开关状态 → 开启 → 调用接管命令(true) → emit 成功 toast。

const HARNESS_URL = "/e2e/harness/e2e-harness.html?case=c5";

/** 在页面加载前注入 mock 后端返回值（happy path）。 */
async function gotoC5(page: Page, results: Record<string, unknown>) {
  await page.addInitScript((r) => {
    (window as unknown as { __mockConfig?: unknown }).__mockConfig = { results: r };
  }, results);
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => (window as unknown as { __e2eReady?: boolean }).__e2eReady === true);
}

/** 读取指定命令的调用记录。 */
async function getCalls(page: Page, cmd: string) {
  return page.evaluate((c) => {
    const log = (window as unknown as { __invokeLog?: { cmd: string; args: Record<string, unknown> }[] }).__invokeLog || [];
    return log.filter((x) => x.cmd === c);
  }, cmd);
}

test.describe("C5 Win+V 接管 (需求 24)", () => {
  test("初始未接管时开关读注册表反推为关闭", async ({ page }) => {
    await gotoC5(page, { is_registry_win_v_optimized: false, trigger_registry_win_v_optimization: true });

    // 反推状态命令被调用，开关呈关闭
    await expect.poll(async () => (await getCalls(page, "is_registry_win_v_optimized")).length).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId("winv-toggle")).not.toBeChecked();
  });

  test("开启接管调用 trigger(true) 成功并发出成功 toast", async ({ page }) => {
    await gotoC5(page, { is_registry_win_v_optimized: false, trigger_registry_win_v_optimization: true });

    await page.getByTestId("winv-toggle").check();

    // 接管命令以 enable=true 被调用（需求 24.2）
    const triggerCalls = await getCalls(page, "trigger_registry_win_v_optimization");
    expect(triggerCalls).toHaveLength(1);
    expect(triggerCalls[0].args).toEqual({ enable: true });

    // 成功后发出 toast 事件（Tauri v2 emit 底层走 plugin:event|emit，需求 24.3 成功反馈）
    await expect.poll(async () => (await getCalls(page, "plugin:event|emit")).length).toBeGreaterThanOrEqual(1);

    // 开关与状态行反映已接管
    await expect(page.getByTestId("winv-toggle")).toBeChecked();
    await expect(page.getByTestId("winv-status")).toContainText("applied=enabled");
  });
});
