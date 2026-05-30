import { test, expect, type Page } from "@playwright/test";

// F1 快速打标签 e2e（C9 / 需求 27.1、27.4）。
//
// 复用 e2e-harness 脚手架（与 10.1 大列表脚手架同构：harness 页面 + Tauri mock）。
// 在纯 Chromium 中驱动真实组件 FloatingTagInput 与共享纯函数（mergeTagsUnion/normalizeTag）：
// 选中条目 → 按 T 打开浮动输入框 → 输入标签 → 回车 → invoke("update_tags") 持久化。
// 覆盖 happy path：成功打标签、空白忽略保持打开、已含同名标签去重不重复调用。

const HARNESS_URL = "/e2e/harness/e2e-harness.html?case=f1";

/** 等待脚手架就绪并返回 invoke 调用记录读取器。 */
async function gotoF1(page: Page) {
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => (window as unknown as { __e2eReady?: boolean }).__e2eReady === true);
}

/** 读取目前为止记录到的所有 update_tags 调用。 */
async function getUpdateTagsCalls(page: Page) {
  return page.evaluate(() => {
    const log = (window as unknown as { __invokeLog?: { cmd: string; args: Record<string, unknown> }[] }).__invokeLog || [];
    return log.filter((c) => c.cmd === "update_tags");
  });
}

test.describe("F1 快速打标签 (需求 15)", () => {
  test("选中条目按 T 输入标签回车后关联并持久化", async ({ page }) => {
    await gotoF1(page);

    // 选中第二条（初始无标签），按 T 打开浮动输入框
    await page.getByTestId("clip-item-2").click();
    await page.getByTestId("clip-item-2").press("t");

    const input = page.locator(".tag-input");
    await expect(input).toBeVisible();

    // 输入标签并回车提交
    await input.fill("工作");
    await input.press("Enter");

    // update_tags 被调用一次，参数为目标 id 与并集去重后的标签
    const calls = await getUpdateTagsCalls(page);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual({ id: 2, tags: ["工作"] });

    // 列表即时刷新展示新标签
    await expect(page.getByTestId("tags-2")).toHaveText("工作");
  });

  test("输入纯空白回车被忽略且输入框保持打开", async ({ page }) => {
    await gotoF1(page);

    await page.getByTestId("clip-item-2").click();
    await page.getByTestId("clip-item-2").press("t");

    const input = page.locator(".tag-input");
    await expect(input).toBeVisible();

    // 纯空白回车：被忽略，输入框保持打开（需求 15.7）
    await input.fill("   ");
    await input.press("Enter");

    await expect(input).toBeVisible();
    const calls = await getUpdateTagsCalls(page);
    expect(calls).toHaveLength(0);
  });

  test("对已含同名标签的条目打同名标签不重复持久化", async ({ page }) => {
    await gotoF1(page);

    // 第一条已含标签「已存在」
    await page.getByTestId("clip-item-1").click();
    await page.getByTestId("clip-item-1").press("t");

    const input = page.locator(".tag-input");
    await expect(input).toBeVisible();

    // 提交同名标签：并集去重后无变化，不调用 update_tags（需求 15.2）
    await input.fill("已存在");
    await input.press("Enter");

    const calls = await getUpdateTagsCalls(page);
    expect(calls).toHaveLength(0);
    // 标签不变
    await expect(page.getByTestId("tags-1")).toHaveText("已存在");
  });
});
