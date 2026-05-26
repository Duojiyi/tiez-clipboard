# 更新日志

本仓库 fork 自 [`jimuzhe/tiez-clipboard`](https://github.com/jimuzhe/tiez-clipboard)，依据 GPL-3.0 协议二次分发。仅记录本仓库相对于上游的变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.4.0] - 2026-05-27

> ⚠️ **重大变更**：v0.4.0 是改名版本。原 TieZ 本仓库自此以 **Magpie** 名义独立维护。
>
> 老用户首次升级 v0.4.0 时数据会**自动迁移**（`%APPDATA%\com.tiez\` → `%APPDATA%\app.magpie\`），旧目录保留作为安全网，确认新版本工作正常后可手动删除。

### 重大变更：项目改名为 Magpie

- **项目正式更名为 Magpie**（喜鹊）。原名 TieZ 来自上游 jimuzhe/tiez-clipboard，本仓库自 v0.4.0 起以 Magpie 名义独立维护。
- **GitHub 仓库**从 `Duojiyi/tiez-clipboard` 重命名为 `Duojiyi/magpie`，老 URL 由 GitHub 自动 301 重定向。
- **GitHub 仓库**已脱离 fork 关系，作为独立项目维护。
- **应用 identifier** 从 `com.tiez` 改为 `app.magpie`。这意味着默认数据目录从 `%APPDATA%\com.tiez\` 变为 `%APPDATA%\app.magpie\`。
- **数据自动迁移**：首次启动 v0.4.0 时，旧目录 `com.tiez` 中的数据库、日志、设置会被自动复制到新目录 `app.magpie`。旧目录保留作为安全网。
- **自启动注册表项**从 `TieZ` 切换到 `Magpie`，旧值在切换时自动清理。
- **可执行文件名**从 `tiez-app.exe` 改为 `magpie.exe`；安装包名从 `TieZ_x.x.x_x64-setup.exe` 改为 `Magpie_x.x.x_x64-setup.exe`。
- **NSIS 卸载脚本**保留对旧名 (`TieZ` / `tiez-app` / `tie-z`) 的兼容清理，确保从老版本卸载升级链路无损。

### 内部不变

为保证用户已有数据可用，下列内部标识符**保持不变**：
- 数据库内 HTML 富文本回退 marker (`<!--TIEZ_RICH_IMAGE:` 等)
- WebDAV 同步路径默认值 `tiez-sync`
- 日志文件名 `tiez.log`
- localStorage 前缀 `tiez_xxx`
- MQTT topic 默认前缀 `tiez/tiez_xxx`、client_id 默认前缀 `tiez_pc_xxx`

如需彻底清理这些内部标识符，可在更未来的版本中做配套迁移。

### 0.3.x 累积变更（基线说明）

- **检查更新**指向本仓库 GitHub Releases（静态 `latest.json`），不再请求上游官网域名 `tiez.name666.top`。
- **公告/心跳** (`useAnnouncements`) 已禁用，不再向上游域名发送启动 ping。
- **主题商店**：默认 API 基址置空，未配置 `VITE_API_BASE_URL` 时不向任何域名发请求。商店入口在外观设置组中条件渲染（默认隐藏）。商店面板加中文友好「暂未启用」提示。
- **启动期主题处理**：用户旧设置中的 `theme: store-xxx` 在商店未启用时静默回退到默认主题 `mica`。
- **新增「启动时检查更新」开关**：默认开启，关闭后启动期不再向 GitHub 发请求；版本号旁的按钮始终可用，用于手动检查。
- **设置面板「官网」按钮** 改为打开本仓库 Releases 页面。
- **设置面板「反馈」卡片** 改为打开 GitHub Issues 页面，不再复制邮箱到剪贴板。
- **Tauri opener 白名单** 调整为本仓库相关地址（移除 `tiez.name666.top` 与 `jimuzhe/tie-z`）。
- **检查更新失败** 时按钮上显示错误详情（前 120 字符），便于无 devtools 的便携版定位问题。
- **Issue 模板 `config.yml`**：移除上游官网/赞助链接，新增 Latest Release 与 Upstream Project 入口。
- **便携版构建脚本** `scripts/build-portable.ps1` 与 `npm run build:portable`。
- **GitHub Actions** `release.yml` 重写：tag push 后一次性出 nsis、msi、portable zip 与 `latest.json`。
- 移除 6 处来自上游的 `[THEME DEBUG]` 调试 `console.log`。

### 包含的上游 PR 修复（自 v0.3.5 起）

- **PR [#87](https://github.com/jimuzhe/tiez-clipboard/pull/87)** 修复"固定窗口模式下点击标签管理后无法粘贴"。来自 [@Gao-Qian-Long](https://github.com/Gao-Qian-Long)。
- **PR [#103](https://github.com/jimuzhe/tiez-clipboard/pull/103)** 修复"窗口隐藏时 GPU 仍持续占用约 5%"。来自 [@Roxy-0304](https://github.com/Roxy-0304)。

## [0.3.8] - 2026-05-27

### 改进

- **新增「启动时检查更新」开关**：默认开启（与历史行为一致）。关闭后应用启动不再向 GitHub 发更新请求；版本号旁的按钮始终可用，用于手动检查。
- **主题商店面板**：未配置 `VITE_API_BASE_URL` 时显示中文友好提示「主题商店暂未启用」，不再是冷冰冰的空列表/加载失败。
- **主题商店入口**：未启用时不在外观设置组中渲染按钮，避免误点。
- **启动期 store-theme 处理**：用户保存的主题为 `store-xxx` 但商店未启用时，静默回退到默认主题（`mica`），避免应用启动时反复尝试拉取已下线的主题资源。

### 修复

- 移除 6 处来自上游的 `[THEME DEBUG]` 调试 `console.log`（涉及 `useSettingsInit.ts`、`AppearanceSettingsGroup.tsx`、`App.tsx`），减少 Tauri 内核日志噪声。

## [0.3.7] - 2026-05-27

### 改进

- **检查更新失败**时按钮上会显示错误详情（前 120 字符），便于无 devtools 的便携版/release 版定位问题。错误提示自动 8 秒后清除。

## [0.3.6] - 2026-05-26

### 变更

- **检查更新**改为指向本仓库 GitHub Releases（静态 `latest.json`），不再请求上游官网域名 `tiez.name666.top`。
  - 应用内"检查更新"按钮拉取 `https://github.com/Duojiyi/magpie/releases/latest/download/latest.json`。
  - 配套替换了 Tauri updater 公钥（私钥仅用于发布签名，不入库）。
- **设置面板"官网"按钮**改为打开本仓库的 Releases 页面。
- **设置面板"反馈"卡片**改为打开 GitHub Issues 页面，不再复制邮箱到剪贴板。
- **公告/心跳**（`useAnnouncements`）已禁用，不再向上游域名发送启动 ping。
- **主题商店**：默认 API 基址置空，未通过 `VITE_API_BASE_URL` 配置时不向任何域名发请求；功能保留代码，可在自部署后端时启用。
- **Tauri 配置 `opener` 白名单**调整为本仓库相关地址（移除 `tiez.name666.top` 与 `jimuzhe/tie-z`）。
- **Issue 模板 `config.yml`**：移除上游官网/赞助链接，新增 Latest Release 与 Upstream Project 入口。

### 新增

- **便携版构建脚本** `scripts/build-portable.ps1` 与 `npm run build:portable`，产物 `artifacts/portable/TieZ_<version>_x64_portable.zip`，包含 `TieZ.exe`、`data/`（触发运行时便携模式）、`LICENSE.txt`、`README*.md` 与使用说明。
- **GitHub Actions `release.yml` 重写**：tag push 后一次性出 nsis、msi、portable zip 与 `latest.json`（用于 updater）。

### 协议合规

- README/CHANGELOG 保留对上游 `jimuzhe/tiez-clipboard` 与 GPL-3.0 的署名与变更说明。

## [0.3.5] - 2026-05-26

基线版本：上游 `jimuzhe/tiez-clipboard@v0.3.4` (`ddf4060`)。

### 修复

- **修复"固定窗口"模式下点击标签管理后鼠标点击无法粘贴的问题。**
  - 原因：`TagManager` 根容器上的 `onMouseDown` 调用 `activate_window_focus`，固定窗口模式下会与全局焦点管理冲突，导致后续点击无法触发粘贴。
  - 修复：移除该 `onMouseDown` handler。
  - 来源：上游 PR [#87](https://github.com/jimuzhe/tiez-clipboard/pull/87) — 作者 [@Gao-Qian-Long](https://github.com/Gao-Qian-Long)。
  - 影响文件：`src/features/tag/components/TagManager.tsx`

- **修复窗口隐藏时 GPU 仍持续占用约 5% 的问题。**
  - 原因：窗口隐藏后 Mica/Acrylic vibrancy 效果未被清理，DWM 持续合成空透明窗口产生无谓 GPU 渲染。
  - 修复：在所有隐藏路径（关闭按钮、blur、`toggle_window`、`hide_window_cmd`）触发前调用 `window_vibrancy::clear_vibrancy`；在窗口重新显示时根据当前主题重新 `apply_mica` / `apply_acrylic`。仅作用于 Windows。
  - 来源：上游 PR [#103](https://github.com/jimuzhe/tiez-clipboard/pull/103) — 作者 [@Roxy-0304](https://github.com/Roxy-0304)。
  - 影响文件：`src-tauri/src/app/setup.rs`、`src-tauri/src/app/window_manager.rs`

### 其他变更

- README 调整：更新仓库链接指向本 fork，移除上游的赞助和社区入口，新增 fork 与协议合规说明。
- 补充 `vitest` 开发依赖以让 `tsc` 顺利通过对仓库内 `*.test.ts` 文件的类型检查。

[0.4.0]: https://github.com/Duojiyi/magpie/releases/tag/v0.4.0
[0.3.8]: https://github.com/Duojiyi/magpie/releases/tag/v0.3.8
[0.3.7]: https://github.com/Duojiyi/magpie/releases/tag/v0.3.7
[0.3.6]: https://github.com/Duojiyi/magpie/releases/tag/v0.3.6
[0.3.5]: https://github.com/Duojiyi/magpie/releases/tag/v0.3.5
