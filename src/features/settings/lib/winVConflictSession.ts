// Win+V 接管冲突提示的「同会话内只弹一次」会话标志（需求 24.7）。
//
// 注册 Win+V 失败且为系统占用时，弹出中文确认提示；用户关闭后，
// 同一运行会话内不再重复弹出。会话标志以模块级状态保存，使设置面板
// 重新打开后仍记住本次会话的决定。

let dismissedThisSession = false;

/** 是否允许弹出 Win+V 冲突提示：本会话未被关闭过时才允许（需求 24.7）。 */
export function canShowWinVConflictPrompt(): boolean {
  return !dismissedThisSession;
}

/** 标记用户已关闭冲突提示：同会话内不再重复弹出（需求 24.7）。 */
export function dismissWinVConflictForSession(): void {
  dismissedThisSession = true;
}

/** 重置会话标志（仅供测试用，模拟新的运行会话）。 */
export function resetWinVConflictSession(): void {
  dismissedThisSession = false;
}
