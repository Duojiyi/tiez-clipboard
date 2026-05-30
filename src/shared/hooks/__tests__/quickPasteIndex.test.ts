import { describe, it, expect } from "vitest";
import {
  parseQuickPasteDigit,
  quickPasteTargetIndex,
} from "../../lib/quickPasteIndex";

/**
 * 数字快捷粘贴索引选取边界单元测试（任务 8.3 / 需求 16.2、16.3）。
 *
 * 被测：useKeyboardNavigation 复用的数字快捷粘贴索引选取纯逻辑
 *（src/shared/lib/quickPasteIndex.ts）。
 * - 取过滤后可见列表第 N 个（按可见结果计数，需求 16.2）。
 * - 可见条目少于 N 时无操作、不报错（返回 null，需求 16.3）。
 */

describe("parseQuickPasteDigit — Ctrl+N 键码解析", () => {
  it("Digit1~Digit9 解析为 1~9", () => {
    for (let n = 1; n <= 9; n++) {
      expect(parseQuickPasteDigit(`Digit${n}`)).toBe(n);
    }
  });

  it("Digit0 不在 1~9 范围，返回 null", () => {
    expect(parseQuickPasteDigit("Digit0")).toBeNull();
  });

  it("非数字键码返回 null", () => {
    expect(parseQuickPasteDigit("KeyA")).toBeNull();
    expect(parseQuickPasteDigit("Numpad1")).toBeNull();
    expect(parseQuickPasteDigit("")).toBeNull();
  });
});

describe("quickPasteTargetIndex — 取过滤后可见列表第 N 个（需求 16.2）", () => {
  it("第 1 个映射到下标 0", () => {
    expect(quickPasteTargetIndex(1, 5)).toBe(0);
  });

  it("第 N 个映射到下标 N-1（按可见结果计数）", () => {
    expect(quickPasteTargetIndex(3, 5)).toBe(2);
    expect(quickPasteTargetIndex(5, 5)).toBe(4);
  });

  it("过滤后可见列表更短时，第 N 个仍以可见计数为准", () => {
    // 过滤后仅剩 3 条，按 Ctrl+3 取第 3 条 → 下标 2
    expect(quickPasteTargetIndex(3, 3)).toBe(2);
  });
});

describe("quickPasteTargetIndex — 可见条目少于 N 时无操作（需求 16.3）", () => {
  it("可见条目数小于 N 时返回 null（不执行粘贴）", () => {
    expect(quickPasteTargetIndex(5, 3)).toBeNull();
    expect(quickPasteTargetIndex(9, 8)).toBeNull();
  });

  it("空可见列表按任意数字均返回 null", () => {
    for (let n = 1; n <= 9; n++) {
      expect(quickPasteTargetIndex(n, 0)).toBeNull();
    }
  });

  it("恰好等于可见条目数时命中最后一个（边界）", () => {
    expect(quickPasteTargetIndex(3, 3)).toBe(2);
    expect(quickPasteTargetIndex(1, 1)).toBe(0);
  });

  it("超出 1~9 合法范围的 N 返回 null", () => {
    expect(quickPasteTargetIndex(0, 5)).toBeNull();
    expect(quickPasteTargetIndex(10, 100)).toBeNull();
  });
});
