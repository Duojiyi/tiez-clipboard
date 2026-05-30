# Implementation Plan: Magpie v0.4.1（实现计划）

## Overview

本实现计划将 `design.md` 的设计落地为可由编码 agent 增量执行的编码/测试任务。组织原则：

- **按 A/U/F/C/V 五类标注，按 Week 节奏排优先级**：P0 项（A10、U1、U2、F1、F2、F3、C1、C2、C5）排在最前，其次 P1，再 P2/P3。每个顶层任务标题以 `[类别·优先级]` 标注，便于与 `docs/v0.4.1-plan.md` 双向追溯。
- **可测性优先的重构**：副作用与纯逻辑分离（`apply_win_v_toggle` 纯函数、迁移用临时目录可重复执行、`parse_scope`/`merge_tags_union`/`dedup_key_for`/`redact` 纯函数、自启动状态可注入建模），以支撑属性测试（proptest / fast-check）。
- **零回归与零触碰**：不修改兼容字段（`tiez.log`、`<!--TIEZ_RICH_IMAGE:`、`tiez-sync`、`tiez_xxx`、`tiez/tiez_xxx`）；数据 100% 无损；仅 Windows；不启用 `opt-level="z"`；快捷键缺 Scope 字段默认 `Global` 保证逐字节一致。
- **属性测试约束**：design.md 的 12 条 Correctness Property 各以**单个**属性测试实现，最少运行 **100 次迭代**，并在测试代码顶部标注注释：
  `// Feature: magpie-v0-4-1, Property {number}: {property_text}`
  Property 1–7、9–12 用 Rust `proptest`；Property 8 用前端 `fast-check`。
- **任务粒度**：每个任务聚焦少数文件、可独立验证；测试类子任务以 `*` 标注为可选（核心实现任务不标 `*`）。

> 说明：以下需求覆盖功能性需求与可由编码 agent 完成的约束校验。需求 34（V7 主题截图重截）与需求 14（U5 限时调研结论本身）含必须由人工完成的部分（截图、实机复现），不作为编码任务列出，仅在 Notes 中标注其编码可承载部分（截图文件替换、调研文档与可修复点）。

## Tasks

- [x] 1. [U1·P0] 空白内容捕获保真（需求 10）
  - [x] 1.1 在 `services/clipboard/utils.rs` 新增判空与比较键纯函数
    - 新增 `pub fn is_empty_clipboard_content(raw: &str) -> bool`（仅 `raw.is_empty()` 为真）
    - 新增 `pub fn dedup_key_for(raw: &str) -> String`（对副本 `trim` 归一并 `\r\n`→`\n`；若 trim 后为空则回退原始内容）
    - _文件：`src-tauri/src/services/clipboard/utils.rs`_
    - _Requirements: 10.2, 10.3, 10.4, 10.5_

  - [x]* 1.2 为判空逻辑编写属性测试
    - **Property 2: 判空仅依据原始长度**
    - **Validates: Requirements 10.2, 10.4**
    - 库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 2: 判空仅依据原始长度`
    - _文件：`src-tauri/src/services/clipboard/utils.rs`（`#[cfg(test)]`）_

  - [x]* 1.3 为比较键生成编写属性测试
    - **Property 3: 比较键生成不改原文且区分纯空白**
    - **Validates: Requirements 10.3, 10.5**
    - 库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 3: 比较键生成不改原文且区分纯空白`
    - _文件：`src-tauri/src/services/clipboard/utils.rs`（`#[cfg(test)]`）_

  - [x] 1.4 修正捕获判空与存储不再 trim
    - `services/clipboard/mod.rs`：`read_clipboard_text_fresh` 改用 `is_empty_clipboard_content`（按原始长度判空），不再 `trim().is_empty()` 丢弃纯空白
    - `services/clipboard/pipeline.rs`：`TransformationStage` 不再对 `content` 做 `trim()`，仅做 `\r\n`→`\n` 行尾归一；去重比较改用 `dedup_key_for`，存储原始内容不变；富文本以其纯文本表示按同规则判空与去重
    - _文件：`src-tauri/src/services/clipboard/mod.rs`、`src-tauri/src/services/clipboard/pipeline.rs`_
    - _Requirements: 10.1, 10.3, 10.6_

  - [x]* 1.5 为捕获保真编写属性测试
    - **Property 1: 捕获保真往返**
    - **Validates: Requirements 10.1, 10.6**
    - 库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 1: 捕获保真往返`
    - _文件：`src-tauri/src/services/clipboard/mod.rs`（`#[cfg(test)]`）_

- [x] 2. [U2·P0] 重复合并标签并集保留（需求 11）
  - [x] 2.1 去重合并保留并集标签、求和计数、保留置顶
    - `services/clipboard/pipeline.rs`：去重命中 `existing_id` 后先读取已有条目标签，与新捕获标签做并集去重后写回 `entry.tags` 再 UPDATE
    - 新增私有纯函数 `fn merge_tags_union(existing: &[String], incoming: &[String]) -> Vec<String>`（标签名逐字节比较、HashSet 去重）
    - `infrastructure/repository/clipboard_repo.rs::save_with_conn`（id>0 UPDATE 分支）：`use_count = old + new`、保留 `is_pinned`/`pinned_order`、保留已有标签（不以空集覆盖）
    - _文件：`src-tauri/src/services/clipboard/pipeline.rs`、`src-tauri/src/infrastructure/repository/clipboard_repo.rs`_
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

  - [x]* 2.2 为标签并集合并编写属性测试
    - **Property 4: 标签合并并集往返一致性**
    - **Validates: Requirements 11.1, 11.3, 11.4**
    - 库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 4: 标签合并并集往返一致性`
    - _文件：`src-tauri/src/infrastructure/repository/clipboard_repo.rs`（`#[cfg(test)]`）_

  - [x]* 2.3 为合并数值不变量编写属性测试
    - **Property 5: 合并数值不变量（计数求和与置顶保留）**
    - **Validates: Requirements 11.6, 11.7**
    - 库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 5: 合并数值不变量（计数求和与置顶保留）`
    - _文件：`src-tauri/src/infrastructure/repository/clipboard_repo.rs`（`#[cfg(test)]`）_

  - [x]* 2.4 为「保留已有条目不新建」编写单元测试
    - 验证去重命中时更新已有条目（更新最近使用时间、提升排序），不新建独立重复条目
    - _Requirements: 11.5_
    - _文件：`src-tauri/src/infrastructure/repository/clipboard_repo.rs`（`#[cfg(test)]`）_

- [x] 3. 检查点 — 确保 U1/U2 全部测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. [A10·P0] 便携版开机自启动失效修复（需求 8）
  - [x] 4.1 自启动命令委托 `autolaunch` 并删除注册表直写
    - `app/commands/system_cmd.rs`：删除自定义 `toggle_autostart`/`is_autostart_enabled` 的注册表 `Run` 直写实现
    - `toggle_autostart(app: AppHandle, enabled)` 改为 `app.autolaunch().enable()/disable()`；`is_autostart_enabled(app: AppHandle)` 返回 `app.autolaunch().is_enabled()`；命令名保留以零改前端
    - 确认 `--minimized` 参数在 `main.rs` 插件初始化中保留
    - _文件：`src-tauri/src/app/commands/system_cmd.rs`、`src-tauri/src/main.rs`_
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

  - [x] 4.2 清理旧 Run 残留与注册失败兜底
    - enable 时在同一操作内删除 `Run\TieZ`、`Run\tie-z` 及旧的绝对路径式 `Run\Magpie`，再由插件写入插件格式项（最终仅保留 productName `Magpie`）
    - enable/disable 失败时不改前端开关状态、emit `autostart-error` 事件、写 `tiez.log`
    - _文件：`src-tauri/src/app/commands/system_cmd.rs`_
    - _Requirements: 8.5, 8.7_

  - [x] 4.3 便携模式缺失 data 目录时降级标准模式
    - `app/setup.rs::resolve_data_dir`：期望便携但 `exe_dir/data/` 不存在时，使用 `%APPDATA%\app.magpie`、以 append 方式写 `tiez.log`、emit「已降级为标准模式运行」提示
    - _文件：`src-tauri/src/app/setup.rs`_
    - _Requirements: 8.8_

  - [x]* 4.4 为自启动状态查询编写属性测试
    - **Property 11: 自启动状态查询往返一致性**
    - **Validates: Requirements 8.6**
    - 将自启动状态抽象为可注入的状态后端建模；库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 11: 自启动状态查询往返一致性`
    - _文件：`src-tauri/src/app/commands/system_cmd.rs`（`#[cfg(test)]`）_

  - [x]* 4.5 为便携模式降级编写单元测试
    - 验证缺 `data/` 目录时回退路径解析为 `%APPDATA%\app.magpie`
    - _Requirements: 8.8_
    - _文件：`src-tauri/src/app/setup.rs`（`#[cfg(test)]`）_

- [x] 5. [C5·P0] Win+V 接管系统快捷键（需求 24）
  - [x] 5.1 抽离 `DisabledHotkeys` 变换纯函数并复用 trigger
    - `app/commands/system_cmd.rs`：抽 `pub fn apply_win_v_toggle(current: &str, enable: bool) -> Option<String>`（enable 追加 `V` 保留其他字符；disable 移除 `V` 保留其他字符，空则返回 None 表示删键）
    - `trigger_registry_win_v_optimization` 与 `is_registry_win_v_optimized` 复用该纯函数；成功写入仅提示需手动重启资源管理器，不自动重启
    - _文件：`src-tauri/src/app/commands/system_cmd.rs`_
    - _Requirements: 24.2, 24.3, 24.4, 24.5, 24.6_

  - [x]* 5.2 为 `DisabledHotkeys` 变换编写属性测试
    - **Property 10: Win+V 接管的 DisabledHotkeys 变换不变量**
    - **Validates: Requirements 24.2, 24.4**
    - 库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 10: Win+V 接管的 DisabledHotkeys 变换不变量`
    - _文件：`src-tauri/src/app/commands/system_cmd.rs`（`#[cfg(test)]`）_

  - [x] 5.3 新增占用来源探测命令
    - `app/commands/system_cmd.rs`：新增 `detect_win_v_occupier() -> Option<String>`，探测 PowerToys / Ditto 进程并返回应用名；`main.rs` 注册
    - _文件：`src-tauri/src/app/commands/system_cmd.rs`、`src-tauri/src/main.rs`_
    - _Requirements: 24.8_

  - [x] 5.4 设置面板 Win+V 接管开关与冲突提示
    - `ClipboardSettingsGroup.tsx`：新增「让 Magpie 接管 Win+V」开关，开关状态读注册表反推；开启调用 `trigger_registry_win_v_optimization(true)`
    - 注册失败且系统占用时中文提示「需要释放系统 Win+V，是否启用接管？」，同会话关闭后用会话标志不再重复弹；占用来源指明应用名
    - _文件：`src/features/settings/components/ClipboardSettingsGroup.tsx`_
    - _Requirements: 24.1, 24.7, 24.8_

  - [x]* 5.5 为冲突提示会话标志编写单元测试（vitest）
    - 验证同会话内关闭后不再重复弹出
    - _Requirements: 24.7_
    - _文件：`src/features/settings/components/__tests__/ClipboardSettingsGroup.winv.test.ts`_

- [x] 6. [F1·P0] 条目快速打标签（需求 15）
  - [x] 6.1 实现浮动标签输入框组件
    - 新建 `FloatingTagInput.tsx`：叠加于焦点条目；聚焦时展示预置标签建议（含保留标签 `__sensitive__`）；Esc 或失焦关闭且不创建标签；空/纯空白回车被忽略且保持打开
    - _文件：`src/features/tag/components/FloatingTagInput.tsx`_
    - _Requirements: 15.1, 15.3, 15.6, 15.7_

  - [x] 6.2 接入 `T` 键并复用 `update_tags` 持久化
    - `useKeyboardNavigation.ts`：选中 ≥1 条目按 `T` 显示输入框，未选中按 `T` 不显示不操作；输入 1–50 非空白字符回车 → trim 后对全部选中条目调用 `invoke("update_tags", { id, tags })`（已含同名标签的条目不重复添加），保存后关闭并即时刷新列表
    - _文件：`src/shared/hooks/useKeyboardNavigation.ts`_
    - _Requirements: 15.1, 15.2, 15.4, 15.5_

  - [x]* 6.3 为 F1 边界编写单元测试（vitest）
    - 覆盖未选中按 T、空/纯空白回车忽略、已含同名标签不重复
    - _Requirements: 15.2, 15.5, 15.7_
    - _文件：`src/features/tag/components/__tests__/FloatingTagInput.test.ts`_

- [x] 7. [F3·P0] 敏感内容快速标记（需求 17）
  - [x] 7.1 接入 `S` 键关联 `__sensitive__` 并统一敏感标识
    - `useKeyboardNavigation.ts`：选中条目按 `S` 复用 `update_tags` 关联保留标签 `__sensitive__`；支持自定义快捷键覆盖默认 `S`
    - `database.rs::has_sensitive_tag`：识别集合扩展为 {`sensitive`, `__sensitive__`}，新写入统一用 `__sensitive__`
    - _文件：`src/shared/hooks/useKeyboardNavigation.ts`、`src-tauri/src/database.rs`_
    - _Requirements: 17.1, 17.3_

  - [x] 7.2 列表视觉强调敏感条目
    - `ClipboardItem.tsx` + `clipboard-item.css`：带 `__sensitive__` 标签的条目用色块或图标视觉强调
    - _文件：`src/features/clipboard/components/ClipboardItem.tsx`、`src/styles/components/clipboard-item.css`_
    - _Requirements: 17.2_

  - [x]* 7.3 为敏感标记编写单元测试（vitest）
    - 验证按 S 关联 `__sensitive__` 且列表渲染强调样式
    - _Requirements: 17.1, 17.2_
    - _文件：`src/features/clipboard/components/__tests__/ClipboardItem.sensitive.test.ts`_

- [x] 8. [F2·P0] 数字快捷粘贴 Ctrl+1~9（需求 16）
  - [x] 8.1 webview keydown 实现 InAppOnly 数字快捷粘贴
    - `useKeyboardNavigation.ts`：主面板可见时监听 `Ctrl+Digit`（1~9），按当前过滤后可见列表第 N 个条目粘贴；可见条目 < N 时无操作不报错；不进行全局注册（隐藏/开关关闭时透传）
    - _文件：`src/shared/hooks/useKeyboardNavigation.ts`_
    - _Requirements: 16.2, 16.3, 16.5, 16.6, 16.7_

  - [x] 8.2 设置开关与成功后隐藏面板
    - `ClipboardSettingsGroup.tsx`：新增「启用数字快捷粘贴」开关（绑定 InAppOnly 行为，保留现有 `quick_paste_modifier` 兼容）；成功粘贴后隐藏主面板
    - _文件：`src/features/settings/components/ClipboardSettingsGroup.tsx`_
    - _Requirements: 16.1, 16.4_

  - [x]* 8.3 为索引选取边界编写单元测试（vitest）
    - 覆盖过滤后第 N 个、可见条目少于 N 无操作
    - _Requirements: 16.2, 16.3_
    - _文件：`src/shared/hooks/__tests__/quickPasteIndex.test.ts`_

- [x] 9. [C1·P0] 基准测试套件（需求 20）
  - [x] 9.1 编写 criterion 基准并加入构建配置
    - `Cargo.toml`：新增 `[dev-dependencies] criterion`、`proptest`，新增 `[[bench]]`
    - 新建 `benches/clipboard_bench.rs`：覆盖 `get_history(0,100)`、`search('keyword', 1000条)`、`insert_clipboard()`，用临时 SQLite 预填充数据
    - _文件：`src-tauri/Cargo.toml`、`src-tauri/benches/clipboard_bench.rs`_
    - _Requirements: 20.1, 20.2_

  - [x] 9.2 创建性能基线文档骨架
    - 新建 `docs/perf-baseline.md`，预置三项操作的基线表格结构（运行 `cargo bench` 后回填数值）
    - _文件：`docs/perf-baseline.md`_
    - _Requirements: 20.3_

- [x] 10. [C2·P0] 大列表实测脚手架（需求 21）
  - [x] 10.1 编写大列表 mock 数据注入测试脚手架
    - 新建可注入 5000/20000/100000 条 mock 数据的测试脚手架（Playwright/Node），驱动 `VirtualClipboardList` 渲染以供记录滚动帧率、内存、搜索响应；必要时为列表加测试钩子
    - _文件：`e2e/large-list.spec.ts`、`src/features/clipboard/components/VirtualClipboardList.tsx`_
    - _Requirements: 21.1, 21.2_

- [x] 11. 检查点 — 确保 P0 全部测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. [A8/A3·P1] 迁移回滚/幂等 + 迁移日志（需求 6、2）
  - [x] 12.1 重写迁移为 tmp + 原子重命名 + MigrationOutcome
    - `migration.rs::perform_migration_v040` 重写：在 `%APPDATA%` 下建 `app.magpie.tmp`（同卷），复制并校验完整后 `fs::rename` 原子重命名为 `app.magpie`；返回 `enum MigrationOutcome { UseTarget, DegradedToLegacy(PathBuf) }`
    - _文件：`src-tauri/src/migration.rs`_
    - _Requirements: 6.2, 6.4_

  - [x] 12.2 半迁移检测、幂等标记与失败回滚降级
    - 开始迁移先删除已存在的 `app.magpie.tmp` 残留；半迁移检测（有 db 缺关键配置 或 存在 tmp 残留）；成功写 `migration_v040.done` 幂等标记；任一步失败则删 tmp、保留 `com.tiez` 不动、本次降级用 legacy、**不写** done 以便下次重试
    - _文件：`src-tauri/src/migration.rs`_
    - _Requirements: 6.1, 6.3, 6.5, 6.6, 6.7_

  - [x] 12.3 写入可见迁移日志（A3）
    - 迁移内部以 `OpenOptions::append` 直接写目标 `tiez.log`（此阶段 logger 未初始化）：`[MIGRATION v040] from={old} to={target} db_size={bytes}`；失败写 `[MIGRATION v040] FAILED ...`
    - _文件：`src-tauri/src/migration.rs`_
    - _Requirements: 2.1, 2.2_

  - [x] 12.4 启动流程消费 MigrationOutcome 降级
    - `app/setup.rs::resolve_data_dir`：迁移返回 `DegradedToLegacy` 时本次启动改用 `%APPDATA%\com.tiez`，并 emit 中文提示「数据迁移未完成，已使用原有数据启动」
    - _文件：`src-tauri/src/app/setup.rs`_
    - _Requirements: 6.5, 6.7_

  - [x]* 12.5 为迁移原子性/幂等/回滚编写属性测试
    - **Property 6: 迁移原子性、幂等性与失败回滚**
    - **Validates: Requirements 6.4, 6.5, 6.6, 6.7**
    - 用临时目录 + 失败注入；库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 6: 迁移原子性、幂等性与失败回滚`
    - _文件：`src-tauri/src/migration.rs`（`#[cfg(test)]`）_

  - [x]* 12.6 为半迁移检测编写属性测试
    - **Property 7: 半迁移状态检测**
    - **Validates: Requirements 6.1**
    - 库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 7: 半迁移状态检测`
    - _文件：`src-tauri/src/migration.rs`（`#[cfg(test)]`）_

  - [x]* 12.7 为迁移日志格式与 tmp 同卷编写单元测试
    - 验证日志行包含 `[MIGRATION v040]`/`from`/`to`/`db_size`，tmp 建在 `%APPDATA%` 同卷
    - _Requirements: 2.1, 2.2, 6.2_
    - _文件：`src-tauri/src/migration.rs`（`#[cfg(test)]`）_

- [x] 13. [F5·P1] 全局/应用内快捷键 Scope 分离（需求 19、39）
  - [x] 13.1 定义 HotkeyScope 枚举与兜底解析纯函数
    - `app/commands/hotkey_cmd.rs`：新增 `enum HotkeyScope { Global, InAppOnly, BackgroundOnly }` 与 `pub fn parse_scope(raw: Option<&str>) -> HotkeyScope`（None/未知 → Global）；settings 以 `app.hotkey.scope.<id>` 持久化
    - _文件：`src-tauri/src/app/commands/hotkey_cmd.rs`_
    - _Requirements: 19.1, 19.4_

  - [x]* 13.2 为缺字段默认 Global 编写属性测试
    - **Property 9: 缺 Scope 字段默认 Global（零回归）**
    - **Validates: Requirements 19.4, 39.1**
    - 库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 9: 缺 Scope 字段默认 Global（零回归）`
    - _文件：`src-tauri/src/app/commands/hotkey_cmd.rs`（`#[cfg(test)]`）_

  - [x] 13.3 注册分流与 BackgroundOnly 判定
    - `hotkey_cmd.rs::sync_registered_hotkeys`：仅对 `Global`/`BackgroundOnly` 全局注册，`InAppOnly` 跳过；`app/hooks/mod.rs::handle_global_shortcut`：`BackgroundOnly` 在主面板可见时 return
    - _文件：`src-tauri/src/app/commands/hotkey_cmd.rs`、`src-tauri/src/app/hooks/mod.rs`_
    - _Requirements: 19.2, 19.3, 19.7, 19.8_

  - [x] 13.4 前端 Scope 控件、恢复默认与即时重新分流
    - `useHotkeyConfig.ts` + 各设置组：为每个快捷键加 Scope 选择控件；「恢复默认」还原所有 Scope（既有快捷键默认 Global）并给成功反馈；改 Scope 后触发 `sync_registered_hotkeys`，1 秒内重新分流生效
    - _文件：`src/shared/hooks/useHotkeyConfig.ts`、`src/features/settings/components/HotkeySettingsGroup.tsx`_
    - _Requirements: 19.5, 19.6, 19.9_

  - [x]* 13.5 为 Scope×可见性真值表编写属性测试（fast-check）
    - **Property 8: 快捷键 Scope 与可见性触发真值表**
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.7**
    - 库：`fast-check`（`package.json` 新增 devDep）；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 8: 快捷键 Scope 与可见性触发真值表`
    - _文件：`src/shared/hooks/__tests__/hotkeyScope.property.test.ts`_

  - [x]* 13.6 为恢复默认/注册失败编写单元测试（vitest）
    - 覆盖恢复默认还原 Scope、Global/BackgroundOnly 注册失败时 Toast 中文提示且不影响其他快捷键
    - _Requirements: 19.6, 19.8_
    - _文件：`src/shared/hooks/__tests__/useHotkeyConfig.test.ts`_

- [x] 14. [A9·P1] 诊断信息复制（需求 7）
  - [x] 14.1 实现 copy_diagnostics 命令与脱敏纯函数
    - 新建 `app/commands/diagnostics_cmd.rs`：`copy_diagnostics(app, state) -> AppResult<String>` 收集 `tiez.log` 末 200 行 + 系统信息（Windows 版本/应用版本/是否便携/数据路径）+ 活跃设置摘要；抽纯函数 `fn redact(input: &str) -> String` 掩码 password/token/secret 值与 URL query string；不做任何网络上传；`main.rs` 注册
    - _文件：`src-tauri/src/app/commands/diagnostics_cmd.rs`、`src-tauri/src/main.rs`_
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 14.2 设置面板新增「复制诊断信息」按钮
    - `GeneralSettingsGroup.tsx`：在「反馈」按钮旁加「复制诊断信息」按钮，调用 `copy_diagnostics` 并写剪贴板
    - _文件：`src/features/settings/components/GeneralSettingsGroup.tsx`_
    - _Requirements: 7.1_

  - [x]* 14.3 为脱敏不泄露编写属性测试
    - **Property 12: 诊断信息脱敏不泄露**
    - **Validates: Requirements 7.4**
    - 库：`proptest`；≥100 次迭代；单个测试；顶部注释 `// Feature: magpie-v0-4-1, Property 12: 诊断信息脱敏不泄露`
    - _文件：`src-tauri/src/app/commands/diagnostics_cmd.rs`（`#[cfg(test)]`）_

  - [x]* 14.4 为诊断内容组成编写单元测试
    - 验证含日志末 200 行、系统信息、设置摘要且无网络调用
    - _Requirements: 7.2, 7.3_
    - _文件：`src-tauri/src/app/commands/diagnostics_cmd.rs`（`#[cfg(test)]`）_

- [x] 15. [A2·P1] 卸载体验改善（需求 1）
  - [x] 15.1 编写 NSIS 卸载钩子
    - 新建 `src-tauri/nsis/hooks.nsh`：`NSIS_HOOK_PREUNINSTALL` 检测 `Magpie.exe`；交互卸载且进程在跑 → 中文「请先关闭 Magpie 后重试」并 `Abort`；静默（`/S`）跳过弹窗，进程在跑则 `SendMessage WM_CLOSE` 轮询 5 秒，超时 `taskkill /F`
    - `tauri.windows.conf.json`：`bundle.windows.nsis.installerHooks` 引用该脚本
    - _文件：`src-tauri/nsis/hooks.nsh`、`src-tauri/tauri.windows.conf.json`_
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 16. [A6·P1] 云同步教程链接替换（需求 5）
  - [x] 16.1 替换教程链接并新建本仓库教程文档
    - 新建 `docs/cloud-sync-tutorial-mqtt.md`、`docs/cloud-sync-tutorial-webdav.md`
    - `SyncSettingsGroup.tsx`/`CloudSyncSettingsGroup.tsx`：「查看教程」改指 `https://github.com/Duojiyi/magpie/blob/master/docs/cloud-sync-tutorial-*.md`，移除全部 `my.feishu.cn` 链接
    - _文件：`docs/cloud-sync-tutorial-mqtt.md`、`docs/cloud-sync-tutorial-webdav.md`、`src/features/settings/components/SyncSettingsGroup.tsx`、`src/features/settings/components/CloudSyncSettingsGroup.tsx`_
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 16.2 便携包打包脚本附带教程
    - `scripts/build-portable.ps1`：将两份教程复制到便携包根目录（与 README/LICENSE 同级）
    - _文件：`scripts/build-portable.ps1`_
    - _Requirements: 5.6_

- [x] 17. [F4·P1] 图片加入表情包 + 内置精选（需求 18）
  - [x] 17.1 新增用户表情库仓储与命令
    - 新建 `infrastructure/repository/user_emoji_repo.rs`：目录扫描提供列表（与 `list_emoji_favorite_paths_in_dir` 同构）
    - 命令 `add_image_to_emoji(app_data, source) -> AppResult<String>`（存入 `%APPDATA%\app.magpie\emojis\user\`，复用 `save_emoji_favorite_bytes_to_dir` 存储模式）、`list_user_emojis(app_data) -> AppResult<Vec<String>>`；`main.rs` 注册
    - _文件：`src-tauri/src/infrastructure/repository/user_emoji_repo.rs`、`src-tauri/src/main.rs`_
    - _Requirements: 18.2, 18.5_

  - [x] 17.2 首启拷贝内置精选表情并打包资源
    - 新增内置资源目录 `src-tauri/resources/emojis/builtin/`（约 50–100 张，单张 <100KB，总 <5MB）
    - `app/setup.rs`：首启拷贝到 `%APPDATA%\app.magpie\emojis\builtin\`，用 `.builtin_v1.done` 标记防重复
    - `tauri.conf.json`：`bundle.resources` 打包内置表情
    - _文件：`src-tauri/src/app/setup.rs`、`src-tauri/resources/emojis/builtin/`、`src-tauri/tauri.conf.json`_
    - _Requirements: 18.3, 18.6_

  - [x] 17.3 右键菜单「添加到表情包」与设置开关
    - `ClipboardItem.tsx`：图片条目右键菜单加「添加到表情包」调用 `add_image_to_emoji`
    - `EmojiPanel.tsx`：复用渲染展示用户表情；设置面板提供关闭内置表情包选项（`app.builtin_emojis_enabled`）；达阈值时数量提示
    - _文件：`src/features/clipboard/components/ClipboardItem.tsx`、`src/features/emoji/components/EmojiPanel.tsx`_
    - _Requirements: 18.1, 18.4, 18.7_

  - [x]* 17.4 为表情存入与阈值提示编写单元测试
    - 验证图片存入 `emojis/user/`、达阈值给出数量提示
    - _Requirements: 18.2, 18.7_
    - _文件：`src-tauri/src/infrastructure/repository/user_emoji_repo.rs`（`#[cfg(test)]`）_

- [x] 18. [C4·P1] 启动速度优化（需求 23）
  - [x] 18.1 异步 schema 检查、窗口骨架先显示、服务并行启动
    - `database.rs::init_db`：schema 检查放后台任务异步执行
    - `app/setup.rs`：主题应用前先显示窗口骨架；`start_services` 用 `tokio::join!` 并行启动后台服务（保证 DbState 等依赖先 manage）
    - _文件：`src-tauri/src/database.rs`、`src-tauri/src/app/setup.rs`_
    - _Requirements: 23.2, 23.3, 23.4_

- [x] 19. [C6·P1] Panic 兜底（需求 25）
  - [x] 19.1 安装全局 panic hook
    - 新建 `panic_hook` 模块：`pub fn install_panic_hook(log_path, app)` 通过 `std::panic::set_hook` 将 panic 写 `tiez.log`，主线程 panic 尝试 `PRAGMA wal_checkpoint` 落盘；release 为 `panic = "abort"`，hook 内所有操作用 `let _ = ...` 吞错、不调用可能 panic 的 API（不依赖 catch_unwind）；`main.rs` 安装
    - _文件：`src-tauri/src/panic_hook.rs`、`src-tauri/src/main.rs`_
    - _Requirements: 25.1, 25.2, 25.4_

  - [x] 19.2 替换热路径可恢复 unwrap
    - 将启动/钩子热路径中可恢复的 `.unwrap()` 替换为 `.unwrap_or_else(...)` 等不致 panic 的处理
    - _文件：`src-tauri/src/logger.rs`、`src-tauri/src/app/hooks/mod.rs`_
    - _Requirements: 25.3_

  - [x]* 19.3 为 panic hook 写日志编写单元测试
    - 验证模拟 panic 时日志被写入（在 unwind 可用的 test 构建下）
    - _Requirements: 25.1_
    - _文件：`src-tauri/src/panic_hook.rs`（`#[cfg(test)]`）_

- [x] 20. [U3·P1] 滚轮穿透修复（需求 12）
  - [x] 20.1 固定窗口模式下滚轮作用于自身
    - `app/hooks/mod.rs::mouse_proc`：悬停在 Magpie 窗口矩形内时不让 `WM_MOUSEWHEEL` 穿透
    - `VirtualClipboardList.tsx`：滚动容器对 `wheel` 事件确保命中可滚动区域并 `stopPropagation`
    - _文件：`src-tauri/src/app/hooks/mod.rs`、`src/features/clipboard/components/VirtualClipboardList.tsx`_
    - _Requirements: 12.1, 12.2_

- [x] 35. [U4·P2] 多屏显示位置与图层复测修复（需求 13）
  - [x] 35.1 复测多屏唤起位置与前台图层并按需修复
    - 复测多显示器环境下唤起窗口的目标屏/位置与前台图层行为；必要时在 `toggle_window`/show 路径补 `set_focus` + 前台置顶，复用现有 `repair_window_position_if_needed`/`clamp_window_rect_to_monitor`
    - _文件：`src-tauri/src/app/setup.rs`、`src-tauri/src/app/window_manager.rs`_
    - _Requirements: 13.1, 13.2_

- [x] 21. [C3·P1] 内存泄漏收口（需求 22）
  - [x] 21.1 richTextSnapshot 缓存加上限
    - `shared/lib/richTextSnapshot.ts`：缓存 Map 增加 LRU/容量上限
    - _文件：`src/shared/lib/richTextSnapshot.ts`_
    - _Requirements: 22.2_

  - [x] 21.2 sensitive_align 队列清理
    - `services/sensitive_align.rs`：确保队列消费/清理，避免无界增长
    - _文件：`src-tauri/src/services/sensitive_align.rs`_
    - _Requirements: 22.2_

  - [x]* 21.3 为 LRU 上限编写单元测试（vitest）
    - 验证缓存超上限时淘汰最旧项
    - _Requirements: 22.1, 22.2_
    - _文件：`src/shared/lib/__tests__/richTextSnapshot.test.ts`_

- [x] 22. 检查点 — 确保 P1 阶段测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. [V5·P1] 卡片密度可切换（需求 32）
  - [x] 23.1 密度设置项与 itemHeight 重算
    - 设置面板新增「紧凑/标准/宽松」三档（存 `app.card_density`，默认 standard）
    - `VirtualClipboardList.tsx`：切换时强制重算 `itemHeight`（`resetAfterIndex` 或重挂载）；`compact-mode.css` 调整高度与间距
    - _文件：`src/features/settings/components/GeneralSettingsGroup.tsx`、`src/features/clipboard/components/VirtualClipboardList.tsx`、`src/styles/components/compact-mode.css`_
    - _Requirements: 32.1, 32.2, 32.3_

  - [x]* 23.2 为 itemHeight 重算编写单元测试（vitest）
    - 验证密度切换映射到不同 itemHeight 且触发虚拟列表重算
    - _Requirements: 32.3_
    - _文件：`src/features/clipboard/components/__tests__/cardDensity.test.ts`_

- [x] 24. [V6·P1] 设置面板分组重组（需求 33）
  - [x] 24.1 三大分组 tab 切换与一次性提示
    - `SettingsPanel.tsx`：重组为「常用/同步/高级」三大分组 + tab 切换；保持所有设置项 ID 不变仅改分组归属；首次升级用 `tiez_` 前缀 localStorage 标记弹一次「设置面板已重组」
    - _文件：`src/features/settings/components/SettingsPanel.tsx`_
    - _Requirements: 33.1, 33.2, 33.3_

- [x] 25. [V8·P1] 新版 README（需求 35、40）
  - [x] 25.1 更新中英 README 表述与署名
    - `README.md`/`README.zh-CN.md`：引用新版主题截图占位、表述从「剪贴板工具」过渡到「轻量信息中枢」、中英同步、保留上游 `jimuzhe/tiez-clipboard` 署名与 GPL-3.0 说明
    - _文件：`README.md`、`README.zh-CN.md`_
    - _Requirements: 35.1, 35.2, 35.3, 40.1_

- [x] 26. [U5·P1] Windows 25H2 IME 调研（需求 14）
  - [x] 26.1 产出调研文档并尝试修复 hook 冲突
    - 新建 `docs/ime-25h2-investigation.md` 记录复现条件与结论；若定位到可干净修复点，调整 `app/hooks/mod.rs` 的 `keyboard_proc` 对 IME 合成消息处理
    - _文件：`docs/ime-25h2-investigation.md`、`src-tauri/src/app/hooks/mod.rs`_
    - _Requirements: 14.1, 14.2, 14.3_

- [x] 27. [A4·P2] 更新检查错误分类（需求 3）
  - [x] 27.1 实现 classifyUpdateError 并补中文文案
    - `useAutoUpdate.ts`：新增 `classifyUpdateError(raw: string): string`（DNS/TLS/通用三类中文），不暴露原始英文异常；文案进 `locales.ts`
    - _文件：`src/shared/hooks/useAutoUpdate.ts`、`src/locales.ts`_
    - _Requirements: 3.1, 3.2, 3.3_

  - [x]* 27.2 为三类错误分类编写单元测试（vitest）
    - 覆盖 DNS、TLS、通用三类映射
    - _Requirements: 3.1, 3.2, 3.3_
    - _文件：`src/shared/hooks/__tests__/classifyUpdateError.test.ts`_

- [x] 28. [A5·P2] datapath.txt 健康检查（需求 4）
  - [x] 28.1 盘符存在性校验与回退
    - `app/setup.rs::resolve_data_dir`：新增 `fn drive_root_exists(path: &str) -> bool`，盘符根不存在时回退 `%APPDATA%\app.magpie` 并以 append 写 `tiez.log` 说明回退原因
    - _文件：`src-tauri/src/app/setup.rs`_
    - _Requirements: 4.1, 4.2, 4.3_

  - [x]* 28.2 为盘符回退编写单元测试
    - 验证盘符不存在时解析为默认目录
    - _Requirements: 4.2_
    - _文件：`src-tauri/src/app/setup.rs`（`#[cfg(test)]`）_

- [x] 29. [V1/V2/V3/V4·P2] UI 收尾（需求 28、29、30、31）
  - [x] 29.1 空状态文案与 Toast 统一
    - `VirtualClipboardList.tsx`：搜索无结果/历史为空/标签下无条目三种空状态各配中英文文案 + lucide 图标
    - `ToastContainer.tsx` + `toast.css`：统一 `<Toast>` 颜色/图标/消失时长，复制成功/失败/网络错误均走该组件
    - _文件：`src/features/clipboard/components/VirtualClipboardList.tsx`、`src/shared/components/ToastContainer.tsx`、`src/styles/components/toast.css`_
    - _Requirements: 28.1, 28.2, 28.3, 29.1, 29.2, 29.3_

  - [x] 29.2 分组图标统一 lucide 与错误中英补齐
    - 各 `*SettingsGroup.tsx` 标题区统一用 `lucide-react`，不混 emoji
    - `locales.ts`：核查并为缺中文的错误信息补齐中文（zh/zh-TW）
    - _文件：`src/features/settings/components/*SettingsGroup.tsx`、`src/locales.ts`_
    - _Requirements: 30.1, 30.2, 31.1, 31.2_

- [x] 30. [A7·P3] Mac 输入框样式兜底（需求 9）
  - [x] 30.1 additive 输入框样式
    - `src/styles/base.css`：为 `.search-input`、`input[type="text"]`、`input[type="password"]` 显式设 `background-color`、`color`、`-webkit-appearance: none`；仅新增规则、覆盖全部输入框、对 Windows 零影响
    - _文件：`src/styles/base.css`_
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 31. [C8·P2] CI 加 Rust cache（需求 26）
  - [x] 31.1 集成 rust-cache 并建 CI workflow
    - `.github/workflows/`：集成 `Swatinem/rust-cache@v2`，优化使总耗时 < 15 分钟
    - _文件：`.github/workflows/ci.yml`_
    - _Requirements: 26.1, 26.2_

- [x] 32. [C9·P1] 测试体系起步（需求 27）
  - [x] 32.1 vitest 剪贴板核心单测
    - 为去空白（U1）、标签关联（F1/U2）核心操作编写 vitest 单测
    - _文件：`src/shared/lib/__tests__/clipboardCore.test.ts`_
    - _Requirements: 27.2_

  - [x] 32.2 Playwright e2e 关键路径
    - 为 F1（快速打标签）、C5（Win+V 接管）、A10（自启动）+ 数据迁移用例编写 e2e，happy path ≥6
    - _文件：`e2e/f1-tagging.spec.ts`、`e2e/c5-winv.spec.ts`、`e2e/a10-autostart.spec.ts`、`e2e/migration.spec.ts`_
    - _Requirements: 27.1, 27.4_

  - [x] 32.3 CI 运行 e2e + 单测 + 属性测试
    - `.github/workflows/ci.yml`：运行 E2E_Suite、Unit_Test_Suite 与属性测试
    - _文件：`.github/workflows/ci.yml`_
    - _Requirements: 27.3_

- [x] 33. [约束·静态校验] 兼容字段与构建约束校验（需求 36、37、40 + A6）
  - [x]* 33.1 编写静态校验脚本
    - 校验：源码无 `my.feishu.cn` 链接（A6/5.5）；兼容字段仍保留（grep `tiez.log`/`TIEZ_RICH_IMAGE`/`tiez-sync`/`tiez_`/`tiez/tiez_`，需求 36）；`Cargo.toml` 无 `opt-level = "z"`（需求 37）；README/CHANGELOG 含 GPL-3.0 与上游署名（需求 40）；设置项 ID 未变（V6.2）
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.5, 37.1, 40.1_
    - _文件：`scripts/static-checks.mjs`_

- [x] 34. 最终检查点 — 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- 标 `*` 的子任务为可选测试任务，可为 MVP 跳过；编码 agent 默认不执行 `*` 子任务，默认执行未标 `*` 的子任务。
- 第 32 组（C9 测试体系）的子任务为需求 27 的一等交付物（建立测试 + CI 基础设施），因此不标 `*`。
- 每条 Correctness Property 对应**单个**属性测试（Property 1–7、9–12 用 proptest，Property 8 用 fast-check），最少 100 次迭代，且测试顶部带 `// Feature: magpie-v0-4-1, Property {number}: {property_text}` 注释。
- 为可测性做了纯逻辑/副作用分离：`apply_win_v_toggle`、`merge_tags_union`、`dedup_key_for`/`is_empty_clipboard_content`、`parse_scope`、`redact`、`drive_root_exists` 为纯函数；迁移逻辑用临时目录可重复执行；自启动状态用可注入后端建模。
- 非编码交付（不在任务列表）：需求 34（V7 主题截图重截需运行应用人工截图）、需求 14（U5 实机复现）的人工部分、C1/C2/C3 的性能数值采集（任务仅提供基准/脚手架代码，数值回填由 `cargo bench`/压测脚本运行产生）。
- 全程不修改兼容字段、保证数据无损、仅 Windows、不启用 `opt-level="z"`、快捷键缺 Scope 字段默认 Global 以零回归。

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.3", "5.1", "6.1", "9.1", "12.1", "13.1", "14.1", "15.1", "16.1", "21.1", "21.2", "24.1", "25.1", "27.1", "30.1", "31.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "5.2", "5.4", "6.2", "6.3", "9.2", "10.1", "12.2", "13.2", "14.2", "14.3", "16.2", "17.1", "21.3", "27.2", "28.1"] },
    { "id": 2, "tasks": ["1.3", "1.5", "2.1", "5.3", "5.5", "7.1", "12.3", "13.3", "14.4", "17.4", "19.1", "28.2"] },
    { "id": 3, "tasks": ["2.2", "4.1", "7.2", "8.1", "12.4", "12.5", "13.4", "19.3", "20.1"] },
    { "id": 4, "tasks": ["2.3", "4.2", "7.3", "8.2", "12.6", "13.5", "17.3", "18.1", "23.1", "26.1"] },
    { "id": 5, "tasks": ["2.4", "4.4", "8.3", "12.7", "13.6", "17.2", "19.2", "23.2", "29.1"] },
    { "id": 6, "tasks": ["4.5", "29.2", "32.1", "32.2"] },
    { "id": 7, "tasks": ["32.3", "33.1", "35.1"] }
  ]
}
```
