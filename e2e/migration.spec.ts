import { test, expect, type Page } from "@playwright/test";

// 数据迁移 e2e（C9 / 需求 27.1、27.4：含一个数据迁移用例）。
//
// 复用 e2e-harness 脚手架 + Tauri mock。迁移在真机为后端 com.tiez → app.magpie 的目录迁移；
// 本用例从前端可观察行为切入：迁移成功后前端通过 get_data_path 读取数据目录，
// mock 返回迁移目标目录 app.magpie，验证前端落到目标目录（迁移成功后使用目标目录）。

const HARNESS_URL = "/e2e/harness/e2e-harness.html?case=migration";

async function gotoMigration(page: Page, results: Record<string, unknown>) {
  await page.addInitScript((r) => {
    (window as unknown as { __mockConfig?: unknown }).__mockConfig = { results: r };
  }, results);
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => (window as unknown as { __e2eReady?: boolean }).__e2eReady === true);
}

test.describe("数据迁移结果 (需求 6)", () => {
  test("迁移成功后前端读取数据目录落在目标目录 app.magpie", async ({ page }) => {
    const targetPath = "C:\\Users\\tester\\AppData\\Roaming\\app.magpie";
    await gotoMigration(page, { get_data_path: targetPath });

    // 前端展示的数据目录为迁移目标目录，且被判定为「使用目标目录」
    await expect(page.getByTestId("data-path")).toHaveText(targetPath);
    await expect(page.getByTestId("migration-using-target")).toContainText("usingTarget=true");
  });
});
