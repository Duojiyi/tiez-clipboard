import type { HotkeyScope } from "../hooks/useHotkeyConfig";

/** 快捷键触发判定所需的可见性状态。 */
export interface HotkeyVisibilityState {
  /** 主面板是否可见 */
  panelVisible: boolean;
  /** webview 是否获得焦点 */
  webviewFocused: boolean;
}

/**
 * 判定某 Scope 的快捷键在给定可见性状态下是否应触发（需求 19.1/19.2/19.3/19.7）。
 *
 * 规则：
 * - Global：无论可见与否均触发（需求 19.3）。
 * - InAppOnly：当且仅当主面板可见且 webview 聚焦时触发（需求 19.2）。
 * - BackgroundOnly：当且仅当主面板不可见时触发（需求 19.7）。
 */
export function shouldHotkeyTrigger(
  scope: HotkeyScope,
  state: HotkeyVisibilityState
): boolean {
  switch (scope) {
    case "Global":
      return true;
    case "InAppOnly":
      return state.panelVisible && state.webviewFocused;
    case "BackgroundOnly":
      return !state.panelVisible;
  }
}
