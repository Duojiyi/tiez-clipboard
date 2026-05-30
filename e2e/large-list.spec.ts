import { test, expect, type Page } from "@playwright/test";

// 大列表实测脚手架（C2 / 需求 21.1、21.2）。
// 以 5000 / 20000 / 100000 三档 mock 数据驱动 VirtualClipboardList 渲染，
// 记录滚动帧率（fps）、JS 堆内存占用与搜索响应时间，作为大列表性能基准采集入口。
// 本脚手架负责「驱动 + 测量 + 输出」，具体基准数值由 CI/本地运行回填到 docs/perf-baseline.md。

const HARNESS_URL = "/e2e/harness/large-list-harness.html";

/** 三档数据量，对应需求 21.1。 */
const DATA_SIZES = [5000, 20000, 100000] as const;

interface ScrollFpsResult {
  frames: number;
  durationMs: number;
  fps: number;
}

/** 等待脚手架与虚拟列表测试钩子就绪。 */
async function waitForHarnessReady(page: Page, expectedCount: number) {
  await page.waitForFunction(
    (count) => {
      const w = window as unknown as {
        __magpieHarness?: { getVisibleCount: () => number };
        __magpieVirtualList?: { getItemCount: () => number };
      };
      return (
        !!w.__magpieHarness &&
        !!w.__magpieVirtualList &&
        w.__magpieVirtualList.getItemCount() === count
      );
    },
    expectedCount,
    { timeout: 60_000 }
  );
}

/** 通过测试钩子注入指定条数的 mock 数据。 */
async function injectData(page: Page, count: number) {
  await page.evaluate((n) => {
    const w = window as unknown as { __magpieHarness?: { injectData: (n: number) => void } };
    w.__magpieHarness?.injectData(n);
  }, count);
  await waitForHarnessReady(page, count);
}

/**
 * 测量一次连续滚动过程的平均帧率。
 * 注意：headless 浏览器不一定按真实 vsync 触发 requestAnimationFrame，frames 可能为 0；
 * 因此 fps 为「best-effort」指标，由报告记录，不作为脚手架通过/失败的判据。
 * 采集真实帧率请以 headed 模式运行（PWDEBUG=1 或 --headed）。
 */
async function measureScrollFps(page: Page): Promise<ScrollFpsResult> {
  return page.evaluate(async () => {
    const w = window as unknown as {
      __magpieVirtualList?: { scrollToIndex: (i: number, a?: "start" | "center" | "end") => void; getItemCount: () => number };
    };
    const handle = w.__magpieVirtualList;
    if (!handle) throw new Error("虚拟列表测试钩子未就绪");

    const total = handle.getItemCount();
    const steps = 30; // 在列表范围内分 30 段滚动
    let frames = 0;
    let running = true;
    const countFrame = () => {
      if (!running) return;
      frames += 1;
      requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);

    const start = performance.now();
    for (let i = 0; i < steps; i++) {
      const index = Math.floor((i / steps) * (total - 1));
      handle.scrollToIndex(index, "center");
      // 每段留出渲染时间（约两帧）
      await new Promise((r) => setTimeout(r, 32));
    }
    const durationMs = performance.now() - start;
    running = false;

    return { frames, durationMs, fps: durationMs > 0 ? (frames / durationMs) * 1000 : 0 };
  });
}

/** 通过测试钩子查询当前实际渲染到 DOM 的条目数量（验证虚拟化是否生效）。 */
async function countRenderedItems(page: Page): Promise<number> {
  return page.locator(".harness-item").count();
}

/** 读取当前 JS 堆已用内存（MB）；非 Chromium 或不支持时返回 null。 */
async function measureHeapMb(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return mem ? Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 100) / 100 : null;
  });
}

/** 测量一次搜索过滤的响应时间（从设置关键词到可见计数稳定）。 */
async function measureSearchResponseMs(page: Page, keyword: string): Promise<number> {
  return page.evaluate(async (kw) => {
    const w = window as unknown as {
      __magpieHarness?: { setSearch: (s: string) => void; getVisibleCount: () => number };
    };
    const harness = w.__magpieHarness;
    if (!harness) throw new Error("脚手架测试钩子未就绪");

    const start = performance.now();
    harness.setSearch(kw);
    // 轮询等待过滤结果稳定（用 setTimeout 而非 rAF，兼容 headless 不触发 vsync 的情况）
    let prev = -1;
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 10));
      const current = harness.getVisibleCount();
      if (current === prev) break;
      prev = current;
    }
    return Math.round((performance.now() - start) * 100) / 100;
  }, keyword);
}

test.describe("大列表性能脚手架 (需求 21)", () => {
  for (const size of DATA_SIZES) {
    test(`数据量 ${size}: 渲染 / 滚动帧率 / 内存 / 搜索响应`, async ({ page }) => {
      await page.goto(`${HARNESS_URL}?count=${size}`);
      await waitForHarnessReady(page, size);

      // 列表已渲染且条目计数与注入量一致（覆盖三档加载，需求 21.1）。
      const status = page.getByTestId("harness-status");
      await expect(status).toContainText(`total=${size}`);

      // 演示通过测试钩子重新注入数据（脚手架可被外部驱动注入任意档位）。
      await injectData(page, size);

      // 验证虚拟化确实生效：渲染到 DOM 的条目数远小于总数据量（否则大列表会卡死）。
      const renderedCount = await countRenderedItems(page);
      expect(renderedCount).toBeGreaterThan(0);
      expect(renderedCount).toBeLessThan(size);

      const fps = await measureScrollFps(page);
      const heapMb = await measureHeapMb(page);
      const searchMs = await measureSearchResponseMs(page, "keyword");

      // 搜索过滤生效：关键词 "keyword" 命中数据集的 1/8（KEYWORDS 第 5 个），可见数应小于总量且大于 0。
      const visibleAfterSearch = await page.evaluate(() => {
        const w = window as unknown as { __magpieHarness?: { getVisibleCount: () => number } };
        return w.__magpieHarness?.getVisibleCount() ?? -1;
      });
      expect(visibleAfterSearch).toBeGreaterThan(0);
      expect(visibleAfterSearch).toBeLessThan(size);

      // 将实测结果输出到测试报告，供回填 perf-baseline.md（需求 21.2）。
      const record = {
        size,
        renderedItems: renderedCount,
        scrollFps: Math.round(fps.fps * 100) / 100,
        scrollFrames: fps.frames,
        scrollDurationMs: Math.round(fps.durationMs * 100) / 100,
        heapMb,
        searchResponseMs: searchMs,
        visibleAfterSearch,
      };
      // eslint-disable-next-line no-console
      console.log(`[large-list-perf] ${JSON.stringify(record)}`);
      await test.info().attach(`large-list-perf-${size}.json`, {
        body: JSON.stringify(record, null, 2),
        contentType: "application/json",
      });

      // 脚手架健全性断言：搜索响应被成功测量（fps.frames 在 headless 下可能为 0，不作判据）。
      expect(searchMs).toBeGreaterThanOrEqual(0);
    });
  }
});
