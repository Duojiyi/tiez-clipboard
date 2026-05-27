# Magpie 中长期 Roadmap

> 最后更新：v0.4.0 发布后
> 本文档用于规划 v0.4.1 之后的版本主题。每个版本上线前会从这里挑题，单独写 vX.Y.Z-plan.md。

---

## 版本节奏

```
v0.4.0  ✅ 已发布   - 重大改名 Magpie + 数据迁移 + 全套 icon 替换
v0.4.1  📋 已规划   - Stability & Performance（含 Win+V 修复 + 上游 bug 纳入）
v0.4.2  📋 本文档   - UX 增强：快速打标签、数字快捷粘贴、敏感标签
v0.5.0  📋 本文档   - 大功能版本：Snippets + 快捷键全局/应用内分离
v0.6.0  💭 远期     - OCR / Smart Actions / 本地 AI（待评估）
```

---

## v0.4.2 — UX 增强（"小步快跑"版本）

**周期**：v0.4.1 发布后 1~2 周开发，目标 1 周内发版。
**主题**：不动架构，专补 v0.3.x 上游用户呼声最高的几个体验小痛点。

### 主线

| 编号 | 内容 | 来源 | 设计要点 |
|------|------|------|----------|
| **U6**（[#96](https://github.com/jimuzhe/tiez-clipboard/issues/96)） | **条目快速打标签**：选中条目按 `T` 弹快速标签输入框，即时回车保存 | 上游 issue | 复用 `tag_repo`，UI 在 ClipboardItem 上叠 floating 输入框 |
| **U7**（[#95](https://github.com/jimuzhe/tiez-clipboard/issues/95)） | **数字快捷粘贴 Ctrl+1~9**：可选开关，启用后在主面板可见时按 `Ctrl+1~9` 直接粘贴对应顺序条目 | 上游 issue | 当前 `quick_paste_modifier` 只支持 modifier+点击，扩展为 modifier+数字键 |
| **U8**（[#85](https://github.com/jimuzhe/tiez-clipboard/issues/85)） | **快速给敏感内容标"敏感"标签**：选中条目按 `S`（或自定义快捷键）一键打"敏感"标签，列表内对应条目用色块强调显示 | 上游 issue | 复用 U6 的标签机制，预置一个保留标签 `__sensitive__` |
| **U9** | **标签批量管理**：已有 TagManager 面板，但缺批量"合并、改色、改名" | 自补 | 在 TagManager 中加多选与批量操作 |

### 次要

- 主面板搜索框中输入 `tag:xxx` 时按 tag 过滤（已有 tag UI 但搜索语法没明示）
- 条目右键菜单加"复制为纯文本"快捷项

### 验收

- 100 条条目下，`T` 键到标签写入完成耗时 < 500 ms
- 数字快捷粘贴在主面板隐藏时不监听（避免全局快捷键噪音）

### 风险

- 数字快捷键和 `Ctrl+1~9` 在浏览器/IDE 中默认是切标签，**只能在主面板可见时局部监听**，做错了用户会怒
- 标签 UI 改造可能与现有 TagManager 视觉冲突

---

## v0.5.0 — 大功能版本（Snippets + 快捷键架构升级）

**周期**：v0.4.2 发布后 3~4 周开发，目标 1 个月内发版。
**主题**：引入两个**会改变用户使用范式**的能力。值得 minor bump。

### 1. Snippets（自定义文本片段）

参考 macOS Paste / Alfred Snippets，但保持隐私优先。

#### 数据模型

```sql
CREATE TABLE snippets (
    id INTEGER PRIMARY KEY,
    keyword TEXT NOT NULL,        -- 触发关键词，如 ":eml"
    body TEXT NOT NULL,           -- 展开内容（纯文本/富文本/图片 base64）
    body_type TEXT NOT NULL,      -- 'text' | 'rich' | 'image'
    tag_id INTEGER,               -- 可选标签关联
    use_count INTEGER DEFAULT 0,  -- 使用频次（用于排序）
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (tag_id) REFERENCES tags(id)
);
CREATE UNIQUE INDEX idx_snippets_keyword ON snippets(keyword);
```

#### 唤起方式

**A. 主面板搜索匹配**（必做）：
- 用户在主面板搜索框输入 `:` 时切换到"snippet 搜索模式"，列表只显示 keyword 匹配的 snippet
- 双击或回车 → 直接粘贴 body

**B. 独立"Snippet 库"标签页**（必做）：
- 主面板顶栏除"全部历史"外加"Snippet"tab，纯托盘项
- 增删改查独立面板

**C. 全局打字时自动展开**（**不做**）：
- 需要全局键盘 hook，与杀毒软件冲突高
- 留到后续看用户呼声

#### UI 工作量

- 新增 `src/features/snippets/` 模块（components / hooks / api）
- TagManager 已有的标签面板可复用
- 设置面板加 Snippet 入口

### 2. 全局 vs 应用内快捷键分离（[#98](https://github.com/jimuzhe/tiez-clipboard/issues/98)）

**当前问题**：所有快捷键都是 tauri-plugin-global-shortcut 注册，全局生效。结果：
- `Ctrl+Shift+Z` 在 IDE 里被全局拦截，干扰用户的 IDE 使用
- 主面板内才用的方向键、Enter 等无法只在面板可见时响应

**改造方案**：

```rust
enum HotkeyScope {
    Global,           // 唤起主面板（仅 main_hotkey）
    InAppOnly,        // 主面板可见时才生效
    BackgroundOnly,   // 主面板隐藏时才生效（如顺序粘贴热键）
}
```

- `register_hotkey` 根据 scope 走不同路径
- InAppOnly 用 webview 内的 `window.addEventListener('keydown')`，不走全局注册
- 设置面板每个快捷键加 scope 选择

工作量：中等（要把 hotkey 设置 UI 重构）。但方案清晰，无未知风险。

### 验收

- Snippet 列表可承载 1000+ 条，搜索 < 100 ms
- 主快捷键之外的快捷键全部支持 InAppOnly 模式
- 改造后所有 v0.4.x 用户的快捷键设置能无损迁移（默认全标 InAppOnly 或 Global，保持原有行为）

---

## v0.6.0 — 远期方向（仅占位）

下面这些不承诺时间表，仅记录候选方向。每一项都需要 v0.5.0 后单独再评估。

### A. OCR / 图片转文字

- 选型：本地优先用 `tesseract-rs` 或微软 Windows.Media.Ocr（系统自带）
- 触发：图片条目右键 → "OCR 提取文字" → 自动追加到剪贴板
- 拒绝外部 API（违背隐私优先）

### B. Smart Actions

- 检测到 URL → 显示"打开"按钮
- 检测到代码块 → 显示"复制为代码 / Markdown" 按钮
- 检测到颜色码 → 显示色卡和复制其他格式

### C. 本地翻译 / 摘要

- 仅当桌面端有可调用的本地小模型时启用（如系统自带模型）
- 不引入外部 LLM API

### D. 插件系统

- 暴露剪贴板事件总线
- 用户可写 JS 脚本扩展 Smart Actions

---

## v0.4.x 期间不变的承诺

- ❌ 不动 HTML marker `<!--TIEZ_RICH_IMAGE:`
- ❌ 不动 WebDAV 默认路径 `tiez-sync`
- ❌ 不动日志文件名 `tiez.log`
- ❌ 不动 localStorage 前缀 `tiez_xxx`
- ❌ 不动 MQTT topic `tiez/tiez_xxx`、client_id 前缀 `tiez_pc_xxx`

这些是 v0.4.0 立下的兼容承诺。**v0.5.0 minor bump 时**可以一次性配套迁移这些内部标识符，但需要在 CHANGELOG 显式声明并出迁移代码（参考 v0.4.0 的 `perform_migration_v040`）。

---

## 上游 jimuzhe/tiez-clipboard 同步策略

- 持续监控上游 issue 和 PR
- 与 Magpie 相关、价值高的 bug 修复 → cherry-pick + 在 CHANGELOG 标注作者
- 与 Magpie 不相关的（macOS 专用、Linux 等）→ 跳过
- 重大架构改动 → 不跟，因为我们已经独立维护

---

最后更新：v0.4.0 发布前。
