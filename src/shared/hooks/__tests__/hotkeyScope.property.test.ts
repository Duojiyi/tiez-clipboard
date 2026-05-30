// Feature: magpie-v0-4-1, Property 8: 快捷键 Scope 与可见性触发真值表
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { HotkeyScope } from "../useHotkeyConfig";
import { shouldHotkeyTrigger } from "../../lib/hotkeyScope";

/**
 * Property 8: 快捷键 Scope 与可见性触发真值表
 * **Validates: Requirements 19.1, 19.2, 19.3, 19.7**
 *
 * 对任意 Scope 取值（Global / InAppOnly / BackgroundOnly）与
 *（主面板是否可见、webview 是否聚焦）状态组合，断言生产函数
 * shouldHotkeyTrigger 的返回严格符合需求规则：
 * - Global         任意状态均触发（需求 19.3）
 * - InAppOnly      当且仅当 主面板可见 且 webview 聚焦 时触发（需求 19.2）
 * - BackgroundOnly 当且仅当 主面板不可见 时触发（需求 19.7）
 *
 * expected 由需求规则独立写出，不复用被测函数实现，避免自证。
 */

const scopeArb: fc.Arbitrary<HotkeyScope> = fc.constantFrom(
  "Global",
  "InAppOnly",
  "BackgroundOnly"
);

const stateArb = fc.record({
  panelVisible: fc.boolean(),
  webviewFocused: fc.boolean(),
});

describe("Property 8: 快捷键 Scope 与可见性触发真值表（需求 19.1/19.2/19.3/19.7）", () => {
  it("对任意 Scope×可见性组合，shouldHotkeyTrigger 严格符合真值表规则", () => {
    fc.assert(
      fc.property(scopeArb, stateArb, (scope, state) => {
        // 期望值依据需求规则独立推导，不引用被测函数实现
        let expected: boolean;
        if (scope === "Global") {
          // 需求 19.3：Global 无论可见与否均触发
          expected = true;
        } else if (scope === "InAppOnly") {
          // 需求 19.2：仅主面板可见且 webview 聚焦时触发
          expected = state.panelVisible && state.webviewFocused;
        } else {
          // 需求 19.7：仅主面板不可见时触发
          expected = !state.panelVisible;
        }

        // 断言生产代码（src/shared/lib/hotkeyScope.ts）的返回与真值表一致
        expect(shouldHotkeyTrigger(scope, state)).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });
});
