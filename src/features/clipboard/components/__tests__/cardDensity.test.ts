import { describe, it, expect } from "vitest";
import { densityItemHeight, densityListKey } from "../../lib/cardDensity";
import type { CardDensity } from "../../../app/types";

/**
 * 卡片密度 itemHeight 重算单元测试（任务 23.2 / 需求 32.3）。
 *
 * 被测：VirtualClipboardList 复用的卡片密度纯逻辑（src/features/clipboard/lib/cardDensity.ts）。
 * - 密度档位（紧凑/标准/宽松）映射到不同 itemHeight（需求 32.2/32.3）。
 * - 密度切换时虚拟列表重算键随之改变，强制 Virtuoso 重挂载、全量重算行高（需求 32.3）。
 */

const DENSITIES: CardDensity[] = ["compact", "standard", "loose"];

describe("densityItemHeight — 三档密度映射到不同 itemHeight（需求 32.2/32.3）", () => {
  it("每档密度都返回正整数高度", () => {
    for (const d of DENSITIES) {
      const h = densityItemHeight(d);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThan(0);
    }
  });

  it("三档高度两两不同（紧凑/标准/宽松映射到不同 itemHeight）", () => {
    const heights = DENSITIES.map(densityItemHeight);
    expect(new Set(heights).size).toBe(DENSITIES.length);
  });

  it("高度严格递增：紧凑 < 标准 < 宽松", () => {
    expect(densityItemHeight("compact")).toBeLessThan(densityItemHeight("standard"));
    expect(densityItemHeight("standard")).toBeLessThan(densityItemHeight("loose"));
  });
});

describe("densityListKey — 密度切换触发虚拟列表重算（需求 32.3）", () => {
  it("不同密度生成不同的重算键，迫使 Virtuoso 重挂载", () => {
    const keys = DENSITIES.map((d) => densityListKey(d, false));
    expect(new Set(keys).size).toBe(DENSITIES.length);
  });

  it("紧凑模式开关变化也改变重算键", () => {
    expect(densityListKey("standard", false)).not.toBe(
      densityListKey("standard", true)
    );
  });

  it("相同密度与紧凑模式生成稳定一致的键（不触发无谓重挂载）", () => {
    expect(densityListKey("loose", true)).toBe(densityListKey("loose", true));
  });

  it("重算键包含密度标识，便于调试与定位", () => {
    expect(densityListKey("compact", false)).toContain("compact");
    expect(densityListKey("loose", true)).toContain("loose");
  });
});
