// Tauri invoke 桥接的浏览器 mock（C9 / 需求 27 e2e 关键路径）。
//
// F1/C5/A10/迁移这些功能在真机依赖 Tauri 桌面运行时（后端 invoke 命令）。
// 在纯 Chromium 的 Playwright 环境下，本 mock 接管 `@tauri-apps/api` 的底层桥接
// `window.__TAURI_INTERNALS__`，使前端关键路径可在浏览器中以确定性 happy path 运行：
// - `invoke(cmd, args)` 会被记录到 `window.__invokeLog`，供测试断言「前端调用了正确的后端命令与参数」；
// - 可注入 `handler` 为指定命令返回确定结果（成功值），模拟后端 happy path；
// - `emit(event, payload)` 在 Tauri v2 中底层走 `invoke('plugin:event|emit', ...)`，因此也会被记录，
//   测试可据此断言 toast 等事件被发出。
//
// 该 mock 仅用于 e2e 脚手架，不进入生产打包。

/** 一次被记录的 invoke 调用。 */
export interface InvokeCall {
  cmd: string;
  args: Record<string, unknown>;
}

/**
 * 命令处理器：根据命令名与参数返回确定结果（happy path 的后端返回值）。
 * 返回 `undefined` 表示该命令无返回值；抛出/拒绝表示模拟后端失败。
 */
export type InvokeHandler = (cmd: string, args: Record<string, unknown>) => unknown | Promise<unknown>;

interface TauriMockWindow {
  __invokeLog?: InvokeCall[];
  __TAURI_INTERNALS__?: Record<string, unknown>;
  isTauri?: boolean;
}

/**
 * 安装 Tauri 桥接 mock。必须在任何 `invoke` 调用发生前（即挂载组件前）调用。
 *
 * @param handler 可选的命令处理器，用于为指定命令返回确定的成功结果。
 * @returns 调用记录数组（与 `window.__invokeLog` 为同一引用），便于在挂载侧读取。
 */
export function installTauriMock(handler?: InvokeHandler): InvokeCall[] {
  const calls: InvokeCall[] = [];
  const callbacks = new Map<number, (payload: unknown) => void>();
  let callbackSeq = 0;

  const w = window as unknown as TauriMockWindow;
  w.__invokeLog = calls;
  w.isTauri = true;
  w.__TAURI_INTERNALS__ = {
    // listen/Channel 会用到：登记回调并返回标识；本 mock 不主动回推消息。
    transformCallback(cb: (payload: unknown) => void) {
      const id = ++callbackSeq;
      callbacks.set(id, cb);
      return id;
    },
    unregisterCallback(id: number) {
      callbacks.delete(id);
    },
    convertFileSrc(filePath: string) {
      return filePath;
    },
    async invoke(cmd: string, args?: Record<string, unknown>) {
      const normalizedArgs = args ?? {};
      calls.push({ cmd, args: normalizedArgs });
      if (handler) {
        return await handler(cmd, normalizedArgs);
      }
      return undefined;
    },
  };

  return calls;
}
