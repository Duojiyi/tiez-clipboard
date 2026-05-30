// Magpie e2e 关键路径脚手架（C9 / 需求 27）。
//
// 在纯 Chromium 中以确定性 happy path 驱动 F1/C5/A10/迁移四类前端关键路径：
// - 通过 URL ?case= 选择用例（f1 / c5 / a10 / migration）；
// - 用 installTauriMock 接管 Tauri 桥接，记录 invoke 调用、为命令返回 happy path 结果；
// - F1 复用真实组件 FloatingTagInput 与共享纯函数 mergeTagsUnion/normalizeTag，
//   C5/A10/迁移复用与真实设置面板一致的命令名与交互逻辑。
// 仅用于 e2e 测量，不进入生产打包。

import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import FloatingTagInput from "../../src/features/tag/components/FloatingTagInput";
import { mergeTagsUnion, normalizeTag } from "../../src/shared/lib/clipboardCore";
import type { ClipboardEntry } from "../../src/shared/types";
import { installTauriMock, type InvokeHandler } from "./tauri-mock";

/** 极简文案函数：e2e 不校验 i18n，回填占位即可。 */
const t = (key: string) => key;

/** 从 URL 读取用例标识。 */
function readCase(): string {
  return new URLSearchParams(window.location.search).get("case") || "f1";
}

// ------------------------------ F1：快速打标签 ------------------------------
// 选中条目 → 浮动输入框输入标签 → 回车 → 复用 mergeTagsUnion 去重后 invoke("update_tags")。
// 验证：去重（已含同名不重复）、空白忽略（输入框保持打开）。

function buildF1Entries(): ClipboardEntry[] {
  const now = Date.now();
  return [
    { id: 1, content_type: "text", content: "第一条剪贴板内容", source_app: "e2e", timestamp: now, preview: "第一条剪贴板内容", is_pinned: false, tags: ["已存在"], use_count: 0 },
    { id: 2, content_type: "text", content: "第二条剪贴板内容", source_app: "e2e", timestamp: now - 1000, preview: "第二条剪贴板内容", is_pinned: false, tags: [], use_count: 0 },
  ];
}

function F1Case() {
  const [history, setHistory] = useState<ClipboardEntry[]>(buildF1Entries);
  // 当前选中条目（F1 要求至少选中 1 条才显示输入框，需求 15.1/15.5）
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // 浮动标签输入框是否打开
  const [tagInputOpen, setTagInputOpen] = useState(false);

  const selected = history.find((item) => item.id === selectedId) || null;
  const suggestions = useMemo(() => {
    const set = new Set<string>();
    history.forEach((item) => item.tags.forEach((tag) => set.add(tag)));
    return Array.from(set);
  }, [history]);

  // 提交标签：复用真实纯函数做并集去重；无变化则不调用后端（已含同名不重复，需求 15.2）
  const handleSubmit = (rawTag: string) => {
    const tag = normalizeTag(rawTag);
    if (!tag || !selected) return;
    const merged = mergeTagsUnion(selected.tags, [tag]);
    if (merged.length !== selected.tags.length) {
      void invoke("update_tags", { id: selected.id, tags: merged });
      setHistory((prev) => prev.map((item) => (item.id === selected.id ? { ...item, tags: merged } : item)));
    }
    setTagInputOpen(false);
  };

  return (
    <>
      <div className="case-toolbar">F1 快速打标签 · 点击条目选中后按 T 打标签</div>
      <div data-testid="clip-list">
        {history.map((item) => (
          <div
            key={item.id}
            id={`clipboard-item-${item.id}`}
            className={`clip-item${selectedId === item.id ? " selected" : ""}`}
            data-testid={`clip-item-${item.id}`}
            tabIndex={0}
            onClick={() => setSelectedId(item.id)}
            onKeyDown={(e) => {
              // 选中条目按 T 打开浮动输入框（需求 15.1）；未选中时上层不渲染该处理
              if (e.key.toLowerCase() === "t" && selectedId === item.id) {
                e.preventDefault();
                setTagInputOpen(true);
              }
            }}
          >
            <div className="content">{item.content}</div>
            <div className="tags" data-testid={`tags-${item.id}`}>
              {item.tags.length > 0 ? item.tags.join(",") : "（无标签）"}
            </div>
          </div>
        ))}
      </div>
      {tagInputOpen && selected && (
        <FloatingTagInput
          t={t}
          theme="light"
          suggestions={suggestions}
          existingTags={selected.tags}
          onSubmit={handleSubmit}
          onClose={() => setTagInputOpen(false)}
        />
      )}
    </>
  );
}

// ------------------------------ C5：Win+V 接管开关 ------------------------------
// 复用真实设置面板的命令名与交互：打开读 is_registry_win_v_optimized 反推开关；
// 开启 → trigger_registry_win_v_optimization(true) 成功 → emit toast 成功。

function C5Case() {
  const [winVTakeover, setWinVTakeover] = useState(false);
  const [applied, setApplied] = useState<string>("");

  // 打开面板读注册表反推开关状态（需求 24.5/24.6）
  useEffect(() => {
    invoke<boolean>("is_registry_win_v_optimized")
      .then((enabled) => setWinVTakeover(enabled))
      .catch(() => undefined);
  }, []);

  const applyWinVTakeover = async (enable: boolean) => {
    await invoke<boolean>("trigger_registry_win_v_optimization", { enable });
    setWinVTakeover(enable);
    if (enable) {
      // 成功后提示需手动重启资源管理器（需求 24.3）
      await emit("toast", { msg: t("win_v_takeover_success"), variant: "success" });
      setApplied("enabled");
    } else {
      setApplied("disabled");
    }
  };

  return (
    <>
      <div className="case-toolbar">C5 Win+V 接管</div>
      <div className="setting-row">
        <span className="label">让 Magpie 接管 Win+V</span>
        <label className="switch">
          <input
            data-testid="winv-toggle"
            type="checkbox"
            checked={winVTakeover}
            onChange={(e) => void applyWinVTakeover(e.target.checked)}
          />
        </label>
      </div>
      <div className="status-line" data-testid="winv-status">
        takeover={String(winVTakeover)} applied={applied}
      </div>
    </>
  );
}

// ------------------------------ A10：自启动开关 ------------------------------
// 复用真实命令名：打开读 is_autostart_enabled 反推开关；切换 → toggle_autostart(enabled)。

function A10Case() {
  const [autoStart, setAutoStart] = useState(false);
  const [ready, setReady] = useState(false);

  // 启动读自启动状态反推开关（需求 8.6）
  useEffect(() => {
    invoke<boolean>("is_autostart_enabled")
      .then((enabled) => setAutoStart(enabled))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const handleToggle = (enabled: boolean) => {
    setAutoStart(enabled);
    void invoke("toggle_autostart", { enabled });
  };

  return (
    <>
      <div className="case-toolbar">A10 开机自启动</div>
      <div className="setting-row">
        <span className="label">开机自启动</span>
        <label className="switch">
          <input
            data-testid="autostart-toggle"
            type="checkbox"
            checked={autoStart}
            onChange={(e) => handleToggle(e.target.checked)}
          />
        </label>
      </div>
      <div className="status-line" data-testid="autostart-status">
        ready={String(ready)} autostart={String(autoStart)}
      </div>
    </>
  );
}

// ------------------------------ 迁移：迁移成功后使用目标目录 ------------------------------
// 迁移成功后前端通过 get_data_path 读取数据目录；mock 返回迁移目标目录 app.magpie，
// 验证前端可观察到「已切换到目标目录」。

function MigrationCase() {
  const [dataPath, setDataPath] = useState<string>("");

  // 启动读取数据目录（与 useAppBootstrap 一致，需求 6 迁移后落到目标目录）
  useEffect(() => {
    invoke<string>("get_data_path")
      .then(setDataPath)
      .catch(() => undefined);
  }, []);

  // 目标目录判定：迁移成功后应落在 app.magpie（而非旧的 com.tiez）
  const usingTarget = dataPath.includes("app.magpie");

  return (
    <>
      <div className="case-toolbar">数据迁移结果</div>
      <div className="status-line" data-testid="data-path">{dataPath || "(loading)"}</div>
      <div className="status-line" data-testid="migration-using-target">
        usingTarget={String(usingTarget)}
      </div>
    </>
  );
}

// ------------------------------ 装配与挂载 ------------------------------

// 测试可在页面加载前（addInitScript）设置 window.__mockConfig 来定制后端 happy path 返回值：
// - results: 命令名 → 返回值的映射（同步值）。
// 默认空映射：未指定的命令返回 undefined（足够覆盖纯「记录调用」的断言）。
interface MockConfig {
  results?: Record<string, unknown>;
}

function buildHandler(): InvokeHandler {
  const cfg = (window as unknown as { __mockConfig?: MockConfig }).__mockConfig || {};
  const results = cfg.results || {};
  return (cmd: string) => {
    if (Object.prototype.hasOwnProperty.call(results, cmd)) {
      return results[cmd];
    }
    return undefined;
  };
}

function CaseDispatcher() {
  const which = readCase();
  switch (which) {
    case "c5":
      return <C5Case />;
    case "a10":
      return <A10Case />;
    case "migration":
      return <MigrationCase />;
    case "f1":
    default:
      return <F1Case />;
  }
}

// 先安装 Tauri 桥接 mock，再挂载（确保任何 invoke 都被记录、有确定返回）。
installTauriMock(buildHandler());

// 不使用 StrictMode：避免开发模式下 effect 双调用污染 invoke 调用记录，保证断言确定性。
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<CaseDispatcher />);

// 标记脚手架就绪，供 Playwright 等待。
(window as unknown as { __e2eReady?: boolean }).__e2eReady = true;
