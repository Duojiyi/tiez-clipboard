import { describe, it, expect, beforeEach } from "vitest";
import {
  canShowWinVConflictPrompt,
  dismissWinVConflictForSession,
  resetWinVConflictSession,
} from "../../lib/winVConflictSession";

/**
 * ClipboardSettingsGroup Win+V 冲突提示会话标志单元测试（任务 5.5 / 需求 24.7）。
 *
 * 被测：ClipboardSettingsGroup.tsx 中 Win+V 接管注册失败、系统占用时的弹窗判定逻辑。
 * 该判定由会话标志纯函数 winVConflictSession 承载（组件直接复用）：
 *   - 注册失败且系统占用（无明确占用应用名）时，仅当本会话未关闭过提示才弹出；
 *   - 用户关闭提示后，同一运行会话内不再重复弹出。
 *
 * vitest 运行在 node 环境（无 React 渲染器），故此处对会话标志驱动的弹窗判定
 * 纯逻辑进行验证，等价于组件 applyWinVTakeover 失败分支的核心行为。
 */

/**
 * 模拟组件 applyWinVTakeover 失败分支中「是否弹出冲突提示」的判定：
 * 系统占用（occupier 为 null）且本会话允许时返回 true（应弹出）。
 */
function shouldPromptOnConflict(occupier: string | null): boolean {
  if (occupier) {
    // 指明占用来源应用名，走 Toast 而非确认弹窗（需求 24.8）
    return false;
  }
  return canShowWinVConflictPrompt();
}

beforeEach(() => {
  // 每个用例模拟一次全新运行会话
  resetWinVConflictSession();
});

describe("Win+V 冲突提示会话标志（需求 24.7）", () => {
  it("会话初始（未关闭过）允许弹出冲突提示", () => {
    expect(canShowWinVConflictPrompt()).toBe(true);
  });

  it("系统占用且本会话首次冲突时应弹出确认提示", () => {
    expect(shouldPromptOnConflict(null)).toBe(true);
  });

  it("用户关闭提示后，同会话内再次冲突不再重复弹出", () => {
    // 首次冲突：弹出
    expect(shouldPromptOnConflict(null)).toBe(true);

    // 用户点击「取消」关闭提示
    dismissWinVConflictForSession();

    // 同会话内后续多次冲突均不再弹出
    expect(shouldPromptOnConflict(null)).toBe(false);
    expect(shouldPromptOnConflict(null)).toBe(false);
  });

  it("关闭后 canShowWinVConflictPrompt 持续返回 false（标志持久于会话）", () => {
    dismissWinVConflictForSession();
    expect(canShowWinVConflictPrompt()).toBe(false);
    // 模拟设置面板重新打开（不重置会话），仍记住决定
    expect(canShowWinVConflictPrompt()).toBe(false);
  });

  it("检测到明确占用来源（PowerToys/Ditto 等）时不弹确认提示，交由 Toast 指明（需求 24.8）", () => {
    expect(shouldPromptOnConflict("PowerToys")).toBe(false);
    // 即使有占用来源也不会改变会话标志，未关闭则后续系统占用仍可弹出
    expect(canShowWinVConflictPrompt()).toBe(true);
    expect(shouldPromptOnConflict(null)).toBe(true);
  });

  it("新运行会话（重置后）恢复允许弹出，验证标志为会话级而非永久", () => {
    dismissWinVConflictForSession();
    expect(canShowWinVConflictPrompt()).toBe(false);

    // 模拟应用重启 → 新会话
    resetWinVConflictSession();
    expect(canShowWinVConflictPrompt()).toBe(true);
  });
});
