import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * useHotkeyConfig 单元测试（任务 13.6 / 需求 19.6、19.8）。
 *
 * 覆盖两条核心逻辑：
 * - 恢复默认还原 Scope（需求 19.6）：resetHotkeyScopes 将所有作用域写回默认 "Global"、
 *   触发后端重新分流，并给出中文成功反馈。
 * - 注册失败 Toast 中文提示（需求 19.8）：当 Global/BackgroundOnly 快捷键全局注册失败时，
 *   通过 pushToast 给出中文冲突提示，且不影响其他快捷键（其他 saveAppSetting/register 不被回滚）。
 *
 * 由于 vitest 运行在 node 环境（无 React 渲染器），这里将 React 的
 * useCallback / useEffect mock 为同步直通：useCallback 原样返回回调、useEffect 不执行副作用，
 * 从而可在普通函数调用下取得 hook 返回的纯回调进行断言。
 */

// React：useCallback 直通返回函数；useEffect 空实现，避免 node 环境下的副作用
vi.mock("react", () => ({
  useCallback: <T,>(fn: T) => fn,
  useEffect: () => {},
}));

// Tauri invoke：默认 resolve；个别用例覆盖为 reject 模拟注册失败
const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// Tauri event listen：返回一个 unlisten promise，测试不依赖事件
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

import { useHotkeyConfig, SCOPED_HOTKEY_IDS } from "../useHotkeyConfig";

// 中文文案（与 src/locales.ts zh 对齐），测试断言用中文
const T: Record<string, string> = {
  hotkey_scope_reset_success: "已恢复所有快捷键作用域为默认值",
  hotkey_register_failed: "快捷键注册失败: ",
  global_hotkey: "全局快捷键",
  sequential_paste_hotkey_label: "连续粘贴快捷键",
  rich_paste_hotkey_label: "富文本粘贴快捷键",
  search_hotkey_label: "搜索快捷键",
  hotkey_conflict_toast: "快捷键冲突：此按键已分配给「{name}」，请避免重复设置",
};
const t = (key: string) => T[key] ?? key;

/** 构造一份完整的 useHotkeyConfig 入参，公共字段集中管理，便于各用例覆盖。 */
function buildOptions(overrides: Record<string, unknown> = {}) {
  const saveAppSetting = vi.fn();
  const pushToast = vi.fn().mockReturnValue(0);
  const noop = vi.fn();

  const options = {
    hotkey: "Alt+C",
    setHotkey: vi.fn(),
    sequentialHotkey: "Alt+S",
    setSequentialHotkey: vi.fn(),
    richPasteHotkey: "Alt+R",
    setRichPasteHotkey: vi.fn(),
    searchHotkey: "Alt+F",
    setSearchHotkey: vi.fn(),
    sensitiveHotkey: "S",
    setSensitiveHotkey: vi.fn(),
    sequentialMode: false,
    isRecording: false,
    setIsRecording: noop,
    isRecordingSequential: false,
    setIsRecordingSequential: noop,
    isRecordingRich: false,
    setIsRecordingRich: noop,
    isRecordingSearch: false,
    setIsRecordingSearch: noop,
    isRecordingSensitive: false,
    setIsRecordingSensitive: noop,
    saveAppSetting,
    t,
    pushToast,
    ...overrides,
  };

  return { options, saveAppSetting, pushToast };
}

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(undefined);
});

describe("resetHotkeyScopes — 恢复默认还原所有 Scope（需求 19.6）", () => {
  it("将每个可配置快捷键的作用域写回默认值 Global", async () => {
    const { options, saveAppSetting } = buildOptions();
    const { resetHotkeyScopes } = useHotkeyConfig(options as never);

    await resetHotkeyScopes();

    // 每个 id 都被写回 "Global"
    for (const id of SCOPED_HOTKEY_IDS) {
      expect(saveAppSetting).toHaveBeenCalledWith(`hotkey.scope.${id}`, "Global");
    }
    expect(saveAppSetting).toHaveBeenCalledTimes(SCOPED_HOTKEY_IDS.length);
  });

  it("触发后端 sync_hotkeys 以重新分流生效", async () => {
    const { options } = buildOptions();
    const { resetHotkeyScopes } = useHotkeyConfig(options as never);

    await resetHotkeyScopes();

    expect(invokeMock).toHaveBeenCalledWith("sync_hotkeys");
  });

  it("给出中文成功反馈", async () => {
    const { options, pushToast } = buildOptions();
    const { resetHotkeyScopes } = useHotkeyConfig(options as never);

    await resetHotkeyScopes();

    expect(pushToast).toHaveBeenCalledWith("已恢复所有快捷键作用域为默认值", 3000);
  });

  it("即使后端 sync_hotkeys 失败也照常给出成功反馈（不阻断恢复默认）", async () => {
    invokeMock.mockRejectedValue("sync failed");
    const { options, pushToast, saveAppSetting } = buildOptions();
    const { resetHotkeyScopes } = useHotkeyConfig(options as never);

    await resetHotkeyScopes();

    expect(saveAppSetting).toHaveBeenCalledTimes(SCOPED_HOTKEY_IDS.length);
    expect(pushToast).toHaveBeenCalledWith("已恢复所有快捷键作用域为默认值", 3000);
  });
});

describe("updateHotkey — 注册失败时中文 Toast 且不影响其他快捷键（需求 19.8）", () => {
  it("register_hotkey 失败时通过 pushToast 显示中文注册失败提示", async () => {
    // test_hotkey_available 通过；register_hotkey 失败（模拟全局注册冲突）
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "register_hotkey") return Promise.reject("已被其他应用占用");
      return Promise.resolve(true);
    });

    const { options, pushToast } = buildOptions();
    const { updateHotkey } = useHotkeyConfig(options as never);

    await updateHotkey("Ctrl+Alt+V");

    // 中文提示前缀 + 原始错误串
    expect(pushToast).toHaveBeenCalledWith(
      "快捷键注册失败: 已被其他应用占用",
      3000
    );
  });

  it("注册失败不回滚本快捷键的设置写入，也不触碰其他快捷键的设置项", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "register_hotkey") return Promise.reject("conflict");
      return Promise.resolve(true);
    });

    const { options, saveAppSetting } = buildOptions();
    const { updateHotkey } = useHotkeyConfig(options as never);

    await updateHotkey("Ctrl+Alt+V");

    // 本快捷键设置已写入（保留原配置，不影响其它快捷键）
    expect(saveAppSetting).toHaveBeenCalledWith("hotkey", "Ctrl+Alt+V");
    // 不应误写其他快捷键设置项
    expect(saveAppSetting).not.toHaveBeenCalledWith(
      "sequential_hotkey",
      expect.anything()
    );
    expect(saveAppSetting).not.toHaveBeenCalledWith(
      "search_hotkey",
      expect.anything()
    );
    expect(saveAppSetting).toHaveBeenCalledTimes(1);
  });

  it("注册成功（不冲突）时不弹出注册失败提示", async () => {
    // 全部命令 resolve
    const { options, pushToast } = buildOptions();
    const { updateHotkey } = useHotkeyConfig(options as never);

    await updateHotkey("Ctrl+Alt+V");

    expect(pushToast).not.toHaveBeenCalled();
  });

  it("清空快捷键（空串）时注册失败回调不弹中文提示（避免误报）", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "register_hotkey") return Promise.reject("noop");
      return Promise.resolve(true);
    });

    const { options, pushToast } = buildOptions();
    const { updateHotkey } = useHotkeyConfig(options as never);

    await updateHotkey("");

    // 空串场景下注册失败不应提示（newHotkey 为空时静默）
    expect(pushToast).not.toHaveBeenCalled();
  });
});
