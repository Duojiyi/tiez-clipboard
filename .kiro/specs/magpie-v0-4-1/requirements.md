# Requirements Document

## Introduction

本文档定义 Magpie 剪贴板工具 **v0.4.1** 发布的需求。Magpie 是一款 Windows 平台、本地优先的剪贴板增强工具（Tauri 2 + Rust + React + TypeScript），fork 自上游 `jimuzhe/tiez-clipboard`，自 v0.4.0 起以 Magpie 名义独立维护，遵循 GPL-3.0 协议。

v0.4.1 的主题是 **Stability + UX + UI 升级**（合并原 v0.4.2 计划），覆盖五大类工作：

- **A 类（迁移巩固 / Hotfix）**：基于 v0.4.0 上线后的实际反馈，巩固改名迁移链路、卸载体验、自启动、反馈入口等。
- **U 类（上游 bug 借鉴）**：修复已确认本仓库同样存在的上游开放 issue。
- **F 类（UX 增强）**：快速打标签、数字快捷粘贴、敏感标记、表情包、快捷键 scope 分离。
- **C 类（性能 / 稳定性内功）**：基准测试、大列表、内存、启动、Win+V 接管、panic 兜底、CI、测试体系。
- **V 类（UI 升级）**：空状态文案、Toast、图标统一、卡片密度、设置面板重组、主题截图、README。

需求来源为已定稿的 `docs/v0.4.1-plan.md`，本文档将其中各项转化为结构化、可测试的 EARS 格式需求。需求按功能分类组织，并在末尾以非功能性需求 / 约束的形式固化关键边界条件（兼容字段不可触碰、仅 Windows、零回归、GPL-3.0 署名、优先级分布等）。

每条需求在标题中标注其计划编号与优先级（P0/P1/P2/P3），便于与 `docs/v0.4.1-plan.md` 双向追溯。

## Glossary

- **Magpie**：本应用，Windows 平台本地优先剪贴板增强工具。下文需求中作为系统主体之一。
- **Magpie_App**：运行中的 Magpie 应用进程（前端 webview + Rust 后端的整体）。
- **NSIS_Uninstaller**：NSIS 生成的卸载程序。
- **Migration_Service**：负责 `com.tiez` → `app.magpie` 数据目录迁移的后端逻辑。
- **Update_Checker**：负责向 GitHub Releases 拉取 `latest.json` 检查更新的模块。
- **Data_Path_Resolver**：启动时根据 `datapath.txt` 与便携模式标志解析数据目录的后端逻辑。
- **Autostart_Manager**：负责开机自启动注册与查询的后端逻辑，v0.4.1 统一基于 `tauri_plugin_autostart`。
- **Diagnostics_Exporter**：负责收集并复制诊断信息到剪贴板的模块（A9）。
- **Clipboard_Capture**：捕获系统剪贴板内容并写入历史的后端逻辑。
- **Tag_Service**：标签数据与关联逻辑（对应 `tag_repo`）。
- **Dedup_Service**：重复内容检测与合并逻辑。
- **Hotkey_Manager**：快捷键注册与分发逻辑（含 scope 分流）。
- **Quick_Paste_Service**：数字快捷粘贴（Ctrl+1~9）逻辑。
- **Emoji_Service**：表情包管理逻辑，含内置表情包与用户表情库（`user_emoji_repo`）。
- **Win_V_Takeover**：Win+V 接管系统快捷键的注册表操作与 UI 开关（对应 `trigger_registry_win_v_optimization`）。
- **Settings_Panel**：前端设置面板。
- **Clipboard_List**：前端剪贴板历史列表（对应 `VirtualClipboardList`）。
- **Toast_Component**：统一的 Toast 提示组件（`<Toast>`）。
- **Benchmark_Suite**：基于 criterion 的 Rust 基准测试套件（`benches/`）。
- **Panic_Handler**：全局 panic 兜底逻辑（`panic_hook`）。
- **CI_Pipeline**：GitHub Actions 持续集成流水线。
- **E2E_Suite**：基于 Playwright 的端到端测试套件。
- **Unit_Test_Suite**：基于 vitest 的前端单元测试套件。
- **Scope**：快捷键作用域，取值 `Global` / `InAppOnly` / `BackgroundOnly`。
- **Sensitive_Tag**：内置保留标签 `__sensitive__`，用于标记敏感内容。
- **Compat_Identifier**：v0.4.0 立下的内部兼容标识符集合，包括日志文件名 `tiez.log`、富文本 marker `<!--TIEZ_RICH_IMAGE:`、WebDAV 路径 `tiez-sync`、localStorage 前缀 `tiez_xxx`、MQTT topic 前缀 `tiez/tiez_xxx`。
- **Portable_Mode**：便携模式，由 exe 同目录是否存在 `data` 文件夹决定。
- **Diagnostic_Redaction**：诊断信息脱敏规则，过滤密码、token、URL query string 等敏感字段。
- **App_Data_Dir**：标准模式下的数据目录 `%APPDATA%\app.magpie\`。
- **Legacy_Data_Dir**：旧数据目录 `%APPDATA%\com.tiez\`。
- **团队**：负责 v0.4.1 交付的开发团队，作为开发过程型需求（如基准测试、调研、补齐翻译）的责任主体。
- **仓库**：Magpie 的 Git 代码仓库，作为交付物（文档、教程、截图、目录结构）所在的主体。
- **打包脚本**：便携包构建脚本 `scripts/build-portable.ps1`。
- **构建配置**：Cargo 构建配置（`Cargo.toml` 的 profile 等）。
- **代码**：Magpie 的源代码，作为重构型需求（如替换 `.unwrap()`）的主体。
- **README**：Magpie 的中英文 README 文档。
- **样式**：前端全局 CSS 样式表，作为样式兜底型需求的主体。

## Requirements

---

## A 类：迁移巩固 / Hotfix

### Requirement 1: （A2）卸载体验改善 — P1

**User Story:** 作为正在卸载 Magpie 的用户，我希望卸载程序在 Magpie 仍在运行时友好提示我先关闭，而不是强制杀进程，以便我的数据能正常落盘、卸载过程不丢失未保存状态。

#### Acceptance Criteria

1. WHILE Magpie_App 进程正在运行 AND 卸载以交互（非静默）方式启动, THE NSIS_Uninstaller SHALL 显示中文提示「请先关闭 Magpie 后重试」并终止本次卸载流程。
2. WHILE 卸载以静默方式启动（命令行包含 `/S` 参数）, THE NSIS_Uninstaller SHALL 跳过提示弹窗。
3. WHEN 卸载以静默方式启动 AND Magpie_App 进程正在运行, THE NSIS_Uninstaller SHALL 向 Magpie_App 发送 `WM_CLOSE` 消息以触发正常关闭流程。
4. IF 发送 `WM_CLOSE` 后 Magpie_App 进程在 5 秒内未退出, THEN THE NSIS_Uninstaller SHALL 执行 `taskkill` 强制结束该进程作为兜底。

### Requirement 2: （A3）迁移日志可见性 — P1

**User Story:** 作为遇到迁移问题需要自查的用户或维护者，我希望迁移过程在日志中留下清晰的记录，以便快速定位数据从哪里迁到哪里、规模多大。

#### Acceptance Criteria

1. WHEN Migration_Service 执行 `com.tiez` → `app.magpie` 的数据迁移, THE Migration_Service SHALL 在 `tiez.log` 头部输出一行包含前缀 `[MIGRATION v040]` 的记录。
2. WHEN Migration_Service 写入迁移日志记录, THE Migration_Service SHALL 在该记录中包含源目录字段 `from`、目标目录字段 `to`、数据库大小字段 `db_size`。

### Requirement 3: （A4）更新检查错误分类 — P2

**User Story:** 作为检查更新失败的用户，我希望看到能看懂的中文错误提示，以便判断是网络问题还是其他问题，而不是一段英文异常。

#### Acceptance Criteria

1. IF Update_Checker 因 DNS 解析失败而无法访问 GitHub, THEN THE Update_Checker SHALL 显示中文提示，说明 GitHub 暂时不可达且原因为网络解析问题。
2. IF Update_Checker 因 TLS 握手失败而无法访问 GitHub, THEN THE Update_Checker SHALL 显示中文提示，说明安全连接建立失败。
3. WHEN Update_Checker 向用户展示更新检查失败信息, THE Update_Checker SHALL 以中文呈现错误分类，不直接抛出原始英文异常文本。

### Requirement 4: （A5）datapath.txt 健康检查 — P2

**User Story:** 作为曾经把数据目录设到外接盘的用户，我希望当那个盘符不存在时应用仍能正常启动，以便我不会因为盘符丢失而打不开应用。

#### Acceptance Criteria

1. WHEN Magpie_App 启动 AND `datapath.txt` 存在, THE Data_Path_Resolver SHALL 校验该文件指向的盘符是否存在。
2. IF `datapath.txt` 指向的盘符不存在, THEN THE Data_Path_Resolver SHALL 回退到默认数据目录 App_Data_Dir。
3. WHEN Data_Path_Resolver 因盘符不存在而回退到默认目录, THE Data_Path_Resolver SHALL 在 `tiez.log` 写入一条说明回退原因的日志记录。

### Requirement 5: （A6）云同步教程链接替换为本仓库 GitHub 教程 — P1

**User Story:** 作为配置云端同步的用户，我希望「查看教程」按钮指向本仓库自有的、可离线查阅的教程，以便链接长期有效且国外用户也能访问。

#### Acceptance Criteria

1. THE 仓库 SHALL 包含 MQTT 同步教程文件 `docs/cloud-sync-tutorial-mqtt.md`。
2. THE 仓库 SHALL 包含 WebDAV 同步教程文件 `docs/cloud-sync-tutorial-webdav.md`。
3. WHEN 用户在 `SyncSettingsGroup.tsx` 中点击「查看教程」, THE Settings_Panel SHALL 打开指向本仓库 GitHub 上对应教程文件的链接（`https://github.com/Duojiyi/magpie/blob/master/docs/cloud-sync-tutorial-mqtt.md` 或 `webdav` 对应文件）。
4. WHEN 用户在 `CloudSyncSettingsGroup.tsx` 中点击「查看教程」, THE Settings_Panel SHALL 打开指向本仓库 GitHub 上对应教程文件的链接。
5. THE Settings_Panel SHALL NOT 在云同步教程入口处保留任何指向飞书域名（`my.feishu.cn`）的链接。
6. WHEN 便携包打包脚本 `scripts/build-portable.ps1` 生成便携包, THE 打包脚本 SHALL 将 `cloud-sync-tutorial-mqtt.md` 与 `cloud-sync-tutorial-webdav.md` 两份文件放入便携包，与 README/LICENSE 同级。

### Requirement 6: （A8）迁移失败回滚 / 幂等性 — P1

**User Story:** 作为从 v0.4.0 之前升级的用户，我希望即使迁移中途失败，应用也能安全降级而不是卡在启动，以便我的数据不丢失、应用仍可用。

#### Acceptance Criteria

1. WHEN Magpie_App 启动, THE Migration_Service SHALL 检测 App_Data_Dir 是否处于「半迁移状态」，其判定条件为：存在剪贴板数据库但缺少 settings 等关键配置文件，或存在 `app.magpie.tmp` 残留目录。
2. WHEN Migration_Service 开始一次迁移, THE Migration_Service SHALL 先删除任何已存在的 `app.magpie.tmp` 残留，再在 App_Data_Dir 的同一父目录（`%APPDATA%`）下创建该临时目录以保证后续为同卷原子重命名。
3. WHILE 一次迁移正在进行, THE Migration_Service SHALL 通过单实例机制互斥写入，禁止并发迁移同时操作目标目录。
4. WHEN Migration_Service 执行迁移, THE Migration_Service SHALL 先将数据完整复制到 `app.magpie.tmp`，校验完整后再原子重命名为 `app.magpie`。
5. IF 迁移过程任一步骤失败（含原子重命名失败）, THEN THE Migration_Service SHALL 删除不完整的 `app.magpie.tmp`、保持 Legacy_Data_Dir（`com.tiez`）数据不被修改、本次降级使用 Legacy_Data_Dir 继续启动，并向用户显示中文提示且在 `tiez.log` 写入可供排查的失败记录。
6. WHEN Migration_Service 在已完成迁移的环境中再次启动, THE Migration_Service SHALL 不重复执行迁移（幂等）。
7. IF 上一次启动因迁移失败而降级到 Legacy_Data_Dir 且本次启动迁移仍未完成, THEN THE Migration_Service SHALL 在本次启动重试迁移，而非永久停留在 Legacy_Data_Dir。

### Requirement 7: （A9）应用内反馈入口 — 复制诊断信息 — P1

**User Story:** 作为要提交 GitHub Issue 的用户，我希望一键复制诊断信息到剪贴板，以便我无需手动翻找日志目录就能附上排查所需信息。

#### Acceptance Criteria

1. THE Settings_Panel SHALL 在「反馈」按钮旁提供一个「复制诊断信息」按钮。
2. WHEN 用户点击「复制诊断信息」, THE Diagnostics_Exporter SHALL 将以下内容写入剪贴板：`tiez.log` 最后 200 行、系统信息（Windows 版本、应用版本、是否便携版、数据路径）、当前活跃设置摘要。
3. WHEN Diagnostics_Exporter 收集诊断信息, THE Diagnostics_Exporter SHALL 不向任何外部端点上传数据。
4. WHEN Diagnostics_Exporter 生成诊断信息, THE Diagnostics_Exporter SHALL 按 Diagnostic_Redaction 规则过滤密码、token、URL 中的 query string 等敏感字段。

### Requirement 8: （A10）便携版开机自启动失效修复 — P0

**User Story:** 作为便携版用户，我希望勾选「开机自启动」后它能真正在每次开机时生效，即使我移动了便携版文件夹，以便我不必每次手动启动。

#### Acceptance Criteria

1. WHEN 用户开启开机自启动开关, THE Autostart_Manager SHALL 仅通过 `tauri_plugin_autostart` 的 `autolaunch` API 注册，不再直接写入注册表 `Run` 项。
2. WHEN 用户关闭开机自启动开关, THE Autostart_Manager SHALL 仅通过 `tauri_plugin_autostart` 的 `autolaunch` API 取消注册。
3. THE Autostart_Manager SHALL NOT 保留自定义的 `toggle_autostart` / `is_autostart_enabled` 注册表直写实现。
4. WHEN Autostart_Manager 注册自启动命令, THE Autostart_Manager SHALL 在命令中保留 `--minimized` 参数。
5. WHEN Autostart_Manager 执行一次注册操作, THE Autostart_Manager SHALL 在同一次操作中清理旧的 `Run\TieZ`、`Run\tie-z` 及旧的绝对路径式 `Run\Magpie` 残留，最终仅保留插件 productName（Magpie）对应的注册项。
6. WHEN Settings_Panel 展示开机自启动开关状态, THE Autostart_Manager SHALL 以 `autolaunch().is_enabled()` 的返回值为准，使界面状态与插件实际注册状态一致。
7. IF 注册或取消注册操作失败, THEN THE Autostart_Manager SHALL 保持开关状态不变、向用户显示错误提示并在 `tiez.log` 写入失败记录。
8. IF Magpie_App 启动时检测到期望处于 Portable_Mode 但 `exe_dir/data/` 目录不存在, THEN THE Magpie_App SHALL 降级为标准模式启动（使用标准模式用户数据目录 `%APPDATA%\app.magpie`）、在 `tiez.log` 写入说明日志，并显示已降级为标准模式运行的提示。

### Requirement 9: （A7）Mac 同步设置输入框样式兜底 — P3

**User Story:** 作为未来可能在 Mac 上使用的用户，我希望同步设置的输入框不会因为系统默认样式而显得灰色不可填，以便为将来的 Mac 适配除雷，同时不影响 Windows。

#### Acceptance Criteria

1. THE 样式 SHALL 为 `.search-input`、`input[type="text"]`、`input[type="password"]` 显式设定 `background-color`、`color` 与 `-webkit-appearance: none`。
2. THE 样式兜底 SHALL 以 additive（仅新增）方式实现，对 Windows 平台现有外观零影响。
3. WHERE 应用运行在所有平台, THE 样式 SHALL 覆盖全部输入框字段，而不仅限于同步面板。

> 说明：A7 标注「未在 Mac 实机验证」，本仓库无法验证 Mac 实机表现，仅做明显正确的 additive 样式兜底。

---

## U 类：上游 Bug 借鉴

### Requirement 10: （U1）复制空格 / Tab 缩进时内容为空 — P0

**User Story:** 作为复制代码片段的开发者，我希望以空格或 Tab 缩进开头的内容能被完整保存，以便代码缩进不丢失、历史条目不为空。

#### Acceptance Criteria

1. WHEN Clipboard_Capture 捕获以空格或 Tab 字符开头的文本内容, THE Clipboard_Capture SHALL 将该内容连同全部前导及内部的空白字符（空格、Tab、换行、回车）完整写入历史，且写入历史的字符序列与系统剪贴板提供的原始文本逐一对应、完全一致。
2. IF 捕获文本去任何空白处理前的原始长度大于 0 且仅由空白字符（空格、Tab、换行、回车）组成, THEN THE Clipboard_Capture SHALL 将其作为有效内容完整保留并写入历史，不得判定为空内容而丢弃。
3. WHEN Clipboard_Capture 为重复检测进行比较, THE Clipboard_Capture SHALL 仅对原始内容的副本执行去除首尾空白的归一化以生成比较键，并保持实际存储的原始内容不被修改。
4. THE Clipboard_Capture SHALL 仅依据内容去任何空白处理前的原始长度是否为 0 来判定是否为空内容；对于去除空白后为空但原始长度大于 0 的内容，THE Clipboard_Capture SHALL NOT 将其判定为空内容。
5. IF 用于重复检测的内容在去除首尾空白后为空字符串（即纯空白内容）, THEN THE Clipboard_Capture SHALL 改用其去空白前的原始内容作为该次重复检测的比较键，以避免不同的纯空白内容被误判为重复。
6. WHERE 捕获的内容为富文本（HTML）, THE Clipboard_Capture SHALL 完整保留其前导及内部空白字符，并以该富文本对应的纯文本表示按与纯文本相同的规则进行空内容判定与重复检测。

### Requirement 11: （U2）重复内容合并后已打标签的条目标签消失 — P0

**User Story:** 作为给条目打过标签的用户，我希望当重复内容被合并时已有的标签关联得到保留，以便我的标签意图不会因为再次复制相同内容而丢失。

#### Acceptance Criteria

1. WHEN Dedup_Service 合并一条与已有带标签条目重复的新内容, THE Tag_Service SHALL 保留该已有条目原有的全部标签关联，使合并结果条目的标签数量不少于合并前该已有条目的标签数量。
2. WHEN Dedup_Service 完成重复内容合并, THE Clipboard_List SHALL 在合并结果条目上即时展示其全部标签（含并集后新增的标签）。
3. IF 参与合并的多条条目分别带有不同标签, THEN THE Tag_Service SHALL 使合并结果条目的标签集合等于各参与条目标签集合的并集，其中两个标签当且仅当标签名逐字节完全相同方视为同一标签，且每个不同标签在结果条目上恰好关联一次（去重）。
4. FOR ALL 单条标签数在 0~50 之间的带标签条目集合、且长度在 1~100 之间的重复内容合并序列, 合并结果条目的标签集合 SHALL 等于参与合并各条目标签集合的并集——既不丢失任一参与标签，也不产生重复标签关联（标签合并往返一致性属性）。
5. WHEN Dedup_Service 判定新捕获内容与一条已有条目重复, THE Dedup_Service SHALL 以该已有条目为保留条目（更新其最近使用时间并提升排序位置），不新建独立的重复条目。
6. WHEN Dedup_Service 完成重复内容合并, THE Dedup_Service SHALL 将合并结果条目的使用次数（use_count）设为参与合并各条目使用次数之和。
7. IF 参与合并的任一条目处于置顶（pinned）状态, THEN THE Dedup_Service SHALL 使合并结果条目保持置顶状态。

### Requirement 12: （U3）鼠标滚轮穿透到其他应用 — P1

**User Story:** 作为使用固定窗口模式的用户，我希望在 Magpie 窗口上滚动鼠标滚轮时滚动作用于 Magpie 而非下层应用，以便浏览历史时不会误操作背后的窗口。

#### Acceptance Criteria

1. WHILE Magpie_App 处于固定窗口模式 AND 鼠标指针悬停在 Magpie 窗口上, THE Magpie_App SHALL 将鼠标滚轮事件作用于 Magpie 自身的列表滚动。
2. WHILE Magpie_App 处于固定窗口模式 AND 鼠标指针悬停在 Magpie 窗口上, THE Magpie_App SHALL 阻止鼠标滚轮事件穿透到下层的其他应用。

### Requirement 13: （U4）多屏幕显示位置与图层 — P2

**User Story:** 作为多显示器用户，我希望 Magpie 窗口在任意屏幕上都显示在正确位置和图层，以便我不会找不到窗口或被其他窗口遮挡。

#### Acceptance Criteria

1. WHEN Magpie_App 在多显示器环境中被唤起, THE Magpie_App SHALL 将窗口显示在预期的目标屏幕上的预期位置。
2. WHEN Magpie_App 在多显示器环境中显示窗口, THE Magpie_App SHALL 将窗口置于正确的前台图层，不被意外遮挡。

> 说明：U4 优先级 P2，计划要求「复测当前行为后定」，本需求作为复测后修复的验收基准。

### Requirement 14: （U5）Windows 25H2 与微软输入法冲突吞字 — P1（限时调研）

**User Story:** 作为使用微软输入法的中文用户，我希望在 Windows 25H2 上输入不再吞字，或至少得到明确的调研结论，以便我了解兼容现状。

#### Acceptance Criteria

1. THE 团队 SHALL 在 2~3 天的限时 spike 内定位 Windows 25H2 与微软输入法的 IME hook 冲突点。
2. IF spike 定位到可干净修复的冲突点, THEN THE Magpie_App SHALL 修复该冲突，使微软输入法在 Windows 25H2 上输入时不再吞字。
3. IF spike 未能定位到可干净修复的方案, THEN THE 团队 SHALL 产出文档 `docs/ime-25h2-investigation.md`，记录复现条件与调研结论。

> 说明：U5 为限时调研型需求，其完成定义为「能修则修，否则产出调研文档」二者满足其一。

---

## F 类：UX 增强

### Requirement 15: （F1）条目快速打标签 — P0

**User Story:** 作为整理剪贴板历史的用户，我希望选中条目按 `T` 就能快速打标签，以便我无需打开标签管理面板就能即时归类。

#### Acceptance Criteria

1. WHEN 用户选中一个或多个条目并按下 `T`, THE Magpie_App SHALL 在焦点条目上叠加显示一个浮动标签输入框。
2. WHEN 用户在浮动标签输入框中输入 1 到 50 个字符的非空白文本并按回车, THE Tag_Service SHALL 将去除首尾空白后的标签关联到全部当前选中条目、持久化保存，并在保存后关闭该浮动标签输入框；若某选中条目已关联同名标签，则对该条目不重复添加。
3. WHEN 浮动标签输入框获得焦点, THE Magpie_App SHALL 展示预置标签建议，其中包含保留标签 Sensitive_Tag（`__sensitive__`）。
4. WHEN 标签保存成功, THE Clipboard_List SHALL 无需用户手动刷新即在对应条目上展示新标签。
5. IF 用户未选中任何条目时按下 `T`, THEN THE Magpie_App SHALL 不显示浮动标签输入框且不执行任何标签操作。
6. WHEN 浮动标签输入框处于显示状态且用户按下 `Esc` 键或该输入框失去焦点, THE Magpie_App SHALL 关闭浮动标签输入框且不创建或关联任何标签。
7. IF 浮动标签输入框中的内容为空或仅由空白字符组成时用户按下回车, THEN THE Magpie_App SHALL 忽略该回车、不创建任何标签关联，且保持浮动标签输入框处于打开状态。

### Requirement 16: （F2）数字快捷粘贴 Ctrl+1~9 — P0

**User Story:** 作为高频粘贴用户，我希望主面板可见时按 `Ctrl+数字` 直接粘贴对应顺序的条目，以便快速取用最近内容，同时不在后台干扰其他应用。

#### Acceptance Criteria

1. THE Settings_Panel SHALL 提供一个可选开关用于启用 / 关闭数字快捷粘贴。
2. WHILE 数字快捷粘贴开关已启用 AND 主面板可见, WHEN 用户按下 `Ctrl+N`（N 为 1~9）, THE Quick_Paste_Service SHALL 粘贴当前可见列表中从顶部起第 N 个条目；当已应用搜索或过滤时，「第 N 个」按过滤后可见结果计数。
3. IF 当前可见列表的条目数少于 N 时用户按下 `Ctrl+N`, THEN THE Quick_Paste_Service SHALL 不执行粘贴、不改变剪贴板与列表状态，且不弹出错误提示。
4. WHEN Quick_Paste_Service 成功粘贴一个条目, THE Magpie_App SHALL 隐藏主面板。
5. THE 数字快捷粘贴对应的快捷键 Scope SHALL 为 `InAppOnly`（仅经 webview keydown 响应、不进行全局注册）。
6. WHILE 数字快捷粘贴开关关闭, THE Quick_Paste_Service SHALL NOT 拦截或响应 `Ctrl+1~9`，使其透传至前台应用。
7. WHILE 主面板隐藏, THE Quick_Paste_Service SHALL NOT 拦截或响应 `Ctrl+1~9`，使其透传至前台应用。

### Requirement 17: （F3）敏感内容快速标记 — P0

**User Story:** 作为复制过密码或隐私内容的用户，我希望选中条目按 `S` 一键打敏感标签并在列表中被视觉强调，以便我快速识别并谨慎处理这些条目。

#### Acceptance Criteria

1. WHEN 用户选中一个条目并按下 `S`, THE Tag_Service SHALL 将 Sensitive_Tag（`__sensitive__`）关联到该条目。
2. WHILE 一个条目带有 Sensitive_Tag, THE Clipboard_List SHALL 用色块或图标对该条目进行视觉强调。
3. WHERE 用户自定义了敏感标记快捷键, THE Magpie_App SHALL 使用自定义快捷键替代默认的 `S` 触发敏感标记。

### Requirement 18: （F4）图片快速添加到表情包 + 内置精选表情包 — P1

**User Story:** 作为爱斗图的用户，我希望把图片条目一键加入表情包，并开箱即用一批内置表情，以便我能快速管理和取用常用图片。

#### Acceptance Criteria

1. WHEN 用户在一个图片条目上打开右键菜单, THE Magpie_App SHALL 提供「添加到表情包」菜单项。
2. WHEN 用户点击「添加到表情包」, THE Emoji_Service SHALL 将该图片存入用户表情库目录 `%APPDATA%\app.magpie\emojis\user\`。
3. WHEN Magpie_App 首次启动, THE Emoji_Service SHALL 将内置精选表情包拷贝到 `%APPDATA%\app.magpie\emojis\builtin\`。
4. THE Settings_Panel SHALL 提供关闭内置表情包的选项。
5. THE Emoji_Service SHALL 通过新建的 `user_emoji_repo` 管理用户表情，并复用 `EmojiPanel` 的渲染逻辑。
6. THE 内置表情包 SHALL 包含约 50~100 张表情，单张大小小于 100 KB，内置表情总大小小于 5 MB。
7. WHERE 用户表情数量达到提示阈值, THE Emoji_Service SHALL 向用户给出数量提示以避免磁盘空间不受控增长。

### Requirement 19: （F5）全局 vs 应用内快捷键分离 — P1

**User Story:** 作为同时在多种场景使用快捷键的用户，我希望每个快捷键可以指定作用域，以便应用内快捷键不污染全局、且现有快捷键行为零回归。

#### Acceptance Criteria

1. THE Hotkey_Manager SHALL 为每个快捷键提供 Scope 字段，取值为 `Global` / `InAppOnly` / `BackgroundOnly`。
2. WHILE 主面板可见且 webview 获得焦点, WHERE 一个快捷键的 Scope 为 `InAppOnly`, THE Hotkey_Manager SHALL 通过 webview 内的 `keydown` 处理该快捷键且不进行全局注册；主面板隐藏或 webview 失焦时不触发该快捷键。
3. WHERE 一个快捷键的 Scope 为 `Global`, THE Hotkey_Manager SHALL 进行全局注册，无论主面板是否可见均可触发。
4. WHEN 加载快捷键配置且某快捷键缺少 Scope 字段（来自 v0.4.0）, THE Hotkey_Manager SHALL 将其视为 `Global`，使其行为与 v0.4.0 逐字节一致。
5. THE Settings_Panel SHALL 为每个快捷键提供 Scope 选择控件。
6. WHEN 用户点击「恢复默认」按钮, THE Settings_Panel SHALL 将所有快捷键的 Scope 还原为各自默认值（v0.4.0 既有快捷键默认 `Global`）并给出成功反馈。
7. WHERE 一个快捷键的 Scope 为 `BackgroundOnly`, THE Hotkey_Manager SHALL 进行全局注册，但仅在主面板不可见时响应，主面板可见时忽略该快捷键。
8. IF Scope 为 `Global` 或 `BackgroundOnly` 的快捷键全局注册失败（与系统或其他应用冲突）, THEN THE Hotkey_Manager SHALL 保留该快捷键原配置、通过 Toast_Component 显示中文冲突提示，且不影响其他快捷键的注册。
9. WHEN 用户更改任一快捷键的 Scope, THE Hotkey_Manager SHALL 在 1 秒内按新 Scope 重新分流生效，无需重启应用。

---

## C 类：性能 / 稳定性内功

### Requirement 20: （C1）基准测试套件 — P0

**User Story:** 作为关注性能回归的维护者，我希望有可重复运行的基准测试和基线文档，以便量化核心操作的性能并在后续版本对比。

#### Acceptance Criteria

1. THE 仓库 SHALL 包含 `benches/` 目录，基于 criterion 实现基准测试。
2. THE Benchmark_Suite SHALL 覆盖三个核心操作：`get_history(0, 100)`、`search('keyword', 1000条)`、`insert_clipboard()`。
3. WHEN Benchmark_Suite 运行完成, THE 团队 SHALL 产出基线文档 `perf-baseline.md`。

### Requirement 21: （C2）大列表实测 — P0

**User Story:** 作为有海量历史的重度用户，我希望大数据量下列表仍然流畅，以便我滚动和搜索时不卡顿。

#### Acceptance Criteria

1. WHEN 测试以 5000、20000、100000 条 mock 数据加载, THE Clipboard_List（`VirtualClipboardList`）SHALL 被实测记录滚动帧率、内存占用与搜索响应时间。
2. THE 团队 SHALL 记录上述三档数据量下的实测结果作为大列表性能基准。

### Requirement 22: （C3）内存泄漏排查 — P1

**User Story:** 作为长期挂着 Magpie 的用户，我希望它长时间运行也不会内存暴涨，以便我可以全天候开着它而不担心拖慢系统。

#### Acceptance Criteria

1. WHILE Magpie_App 持续监听剪贴板 24 小时（测试脚本每秒写入一次文本）, THE Magpie_App 的 RSS 内存增长 SHALL 小于 50 MB。
2. WHEN 排查内存增长来源, THE 团队 SHALL 重点检查 `richTextSnapshot` 缓存 Map 与 `sensitive_align` 队列。

### Requirement 23: （C4）启动速度优化 — P1

**User Story:** 作为每天多次启动应用的用户，我希望它启动更快，以便我能更快开始使用。

#### Acceptance Criteria

1. WHEN Magpie_App 冷启动, THE Magpie_App 的冷启动耗时 SHALL 比 v0.4.0 基线快至少 30%。
2. WHEN Magpie_App 启动, THE Magpie_App SHALL 异步执行 `init_db` 的 schema 检查。
3. WHEN Magpie_App 启动, THE Magpie_App SHALL 在主题应用之前先显示窗口骨架。
4. WHEN Magpie_App 启动后台服务, THE Magpie_App SHALL 通过 `tokio::join!` 并行启动 `start_services`。

### Requirement 24: （C5）Win+V 接管系统快捷键 — P0

**User Story:** 作为想用 `Win+V` 作为主快捷键的用户，我希望 Magpie 能接管系统占用的 Win+V，并在失败时给我清晰提示，以便我顺利用上首选快捷键。

#### Acceptance Criteria

1. THE Settings_Panel（ClipboardSettingsGroup）SHALL 提供「让 Magpie 接管 Win+V」开关。
2. WHEN 用户启用接管开关, THE Win_V_Takeover SHALL 调用 `trigger_registry_win_v_optimization(true)`，向 `DisabledHotkeys` 追加 `V` 并保留其中已有的其他字符。
3. WHEN Win_V_Takeover 成功写入接管设置, THE Magpie_App SHALL 显示中文提示告知用户需手动重启资源管理器方可生效，且不自动重启资源管理器。
4. WHEN 用户关闭接管开关, THE Win_V_Takeover SHALL 仅从 `DisabledHotkeys` 中移除自己追加的 `V` 并保留其他字符；若移除后值为空则删除该注册表键。
5. WHEN 用户打开 ClipboardSettingsGroup, THE Win_V_Takeover SHALL 读取 `DisabledHotkeys` 的实际值并据此反推接管开关的开/关状态，使界面状态与注册表一致。
6. THE Win_V_Takeover SHALL 以用户级注册表 `DisabledHotkeys` 的实际值为接管状态的唯一判定依据，重装或数据迁移不重置该状态。
7. IF 注册 Win+V 失败且原因为系统占用, THEN THE Magpie_App SHALL 弹出中文提示「需要释放系统 Win+V，是否启用接管？」，且在同一运行会话内被关闭后不再重复弹出。
8. IF 检测到 PowerToys 或 Ditto 占用 Win+V, THEN THE Magpie_App SHALL 向用户指明占用来源的应用名称并提示释放后重试。

### Requirement 25: （C6）Panic 兜底 — P1

**User Story:** 作为遇到偶发崩溃的用户，我希望崩溃信息被记录且数据不丢，以便问题可被排查且我的历史得以保全。

#### Acceptance Criteria

1. WHEN Magpie_App 任意线程发生 panic, THE Panic_Handler SHALL 将 panic 信息写入 `tiez.log`。
2. WHEN Magpie_App 主线程发生 panic, THE Panic_Handler SHALL 尝试将数据库优雅落盘。
3. THE 代码 SHALL 将可恢复的 `.unwrap()` 调用替换为 `.unwrap_or_else(...)` 等不致 panic 的处理。
4. IF Panic_Handler 自身在写文件时发生 panic, THEN THE Panic_Handler SHALL 通过 `std::panic::catch_unwind` 兜底以避免无限递归。

### Requirement 26: （C8）CI 加 Rust cache — P2

**User Story:** 作为提交代码的贡献者，我希望 CI 更快完成，以便我能更快得到反馈。

#### Acceptance Criteria

1. THE CI_Pipeline SHALL 集成 `Swatinem/rust-cache@v2` 缓存 Rust 构建产物。
2. WHEN CI_Pipeline 运行完整流程, THE CI_Pipeline 的总耗时 SHALL 小于 15 分钟。

### Requirement 27: （C9）测试体系起步 — P1

**User Story:** 作为维护者，我希望关键路径有自动化测试并接入 CI，以便最易回归的功能在每次提交时被自动验证。

#### Acceptance Criteria

1. THE E2E_Suite SHALL 基于 Playwright 为 F1（快速打标签）、C5（Win+V 接管）、A10（便携版自启动）编写端到端测试。
2. THE Unit_Test_Suite SHALL 基于 vitest 为剪贴板核心操作（去空白、标签关联）编写单元测试。
3. THE CI_Pipeline SHALL 在 GitHub Actions 上运行 E2E_Suite 与 Unit_Test_Suite。
4. THE 测试范围 SHALL 聚焦最容易回归的 happy path，端到端 happy path 数量不少于 6（含一个数据迁移用例）。

---

## V 类：UI 升级

### Requirement 28: （V1）空状态文案精修 — P2

**User Story:** 作为遇到空列表的用户，我希望看到友好清晰的空状态文案，以便我知道当前为何为空、下一步可以做什么。

#### Acceptance Criteria

1. WHEN 搜索无结果, THE Clipboard_List SHALL 显示一句中英文空状态文案并配图标。
2. WHEN 历史为空, THE Clipboard_List SHALL 显示一句中英文空状态文案并配图标。
3. WHEN 标签下无条目, THE Magpie_App SHALL 显示一句中英文空状态文案并配图标。

### Requirement 29: （V2）Toast 提示统一 — P2

**User Story:** 作为操作后期待反馈的用户，我希望所有 Toast 提示风格一致，以便提示清晰且观感统一。

#### Acceptance Criteria

1. THE Magpie_App SHALL 提供统一的 Toast_Component（`<Toast>`）。
2. WHEN 复制成功、复制失败或网络错误发生, THE Magpie_App SHALL 通过 Toast_Component 呈现提示。
3. THE Toast_Component SHALL 在颜色、图标与消失时长上保持统一风格。

### Requirement 30: （V3）设置面板 group icon 统一为 lucide — P2

**User Story:** 作为浏览设置的用户，我希望各分组图标风格统一，以便界面更协调。

#### Acceptance Criteria

1. THE Settings_Panel SHALL 对所有设置分组使用 `lucide-react` 图标。
2. THE Settings_Panel SHALL NOT 在分组标题处混用 emoji 图标。

### Requirement 31: （V4）错误信息中英对照核查 — P2

**User Story:** 作为中文用户，我希望所有暴露给我的错误信息都有中文，以便我能看懂每条错误。

#### Acceptance Criteria

1. THE Magpie_App SHALL 为所有暴露给用户的错误信息提供中文文案。
2. WHEN 核查 `locales.ts`, THE 团队 SHALL 为缺少中文翻译的错误信息补齐中文。

### Requirement 32: （V5）卡片密度可切换 — P1

**User Story:** 作为在意信息密度的用户，我希望能切换卡片密度，以便一屏看到更多或更舒适地阅读。

#### Acceptance Criteria

1. THE Settings_Panel SHALL 暴露卡片密度切换选项，提供「紧凑 / 标准 / 宽松」三档。
2. WHEN 用户切换卡片密度, THE Clipboard_List SHALL 按所选密度调整条目高度与间距。
3. WHEN 卡片密度切换时, THE Clipboard_List（`VirtualClipboardList`）SHALL 强制重算 `itemHeight` 以保证虚拟列表渲染正确。

### Requirement 33: （V6）设置面板分组重组 — P1

**User Story:** 作为查找设置项的用户，我希望设置面板按主次重组，以便我更快找到需要的设置。

#### Acceptance Criteria

1. THE Settings_Panel SHALL 将设置分组重组为「常用 / 同步 / 高级」三大分组并支持 tab 切换。
2. THE Settings_Panel SHALL 保持所有设置项的 ID 不变，仅改变其分组归属。
3. WHEN 用户首次升级到重组后的版本, THE Settings_Panel SHALL 弹出一次性提示「设置面板已重组」。

### Requirement 34: （V7）主题截图重截 — P1

**User Story:** 作为查看项目展示图的潜在用户，我希望截图体现新版 Magpie 而非旧 TieZ，以便第一印象准确。

#### Acceptance Criteria

1. THE 仓库 SHALL 用新版 Magpie 重新截取毛玻璃、书、便利贴、3D 四套主题的截图。
2. THE 主题截图 SHALL NOT 包含任何 TieZ 标题栏残留。

### Requirement 35: （V8）新版 README — P1

**User Story:** 作为阅读 README 的访客，我希望 README 体现新版视觉与「轻量信息中枢」定位，以便理解 Magpie 的方向。

#### Acceptance Criteria

1. THE README SHALL 用新版主题截图替换旧截图。
2. THE README SHALL 在表述上从「剪贴板工具」过渡到「轻量信息中枢」。
3. THE 团队 SHALL 同步更新中文与英文两份 README。

---

## 非功能性需求与约束（Non-Functional Requirements & Constraints）

### Requirement 36: 内部兼容字段保护（约束）

**User Story:** 作为已有 v0.4.0 数据的用户，我希望 v0.4.1 不破坏内部兼容标识符，以便我的历史数据、同步配置、富文本继续可用。

#### Acceptance Criteria

1. THE Magpie_App SHALL 继续使用日志文件名 `tiez.log`，不得更改。
2. THE Magpie_App SHALL 继续使用富文本回退 marker `<!--TIEZ_RICH_IMAGE:`，不得更改。
3. THE Magpie_App SHALL 继续使用 WebDAV 同步路径默认值 `tiez-sync`，不得更改。
4. THE Magpie_App SHALL 继续使用 localStorage 前缀 `tiez_xxx`，不得更改。
5. THE Magpie_App SHALL 继续使用 MQTT topic 前缀 `tiez/tiez_xxx`，不得更改。

### Requirement 37: 性能优化手段约束

**User Story:** 作为关注性能的维护者，我希望体积优化不以牺牲运行性能为代价，以便桌面应用保持流畅。

#### Acceptance Criteria

1. THE 构建配置 SHALL NOT 启用 Cargo `opt-level = "z"`。
2. WHERE 需要做体积优化, THE 构建配置 SHALL 仅采用不损失性能的手段（如 `lto = "fat"` 与 `strip`）。

### Requirement 38: 平台范围约束

**User Story:** 作为 Windows 用户，我希望 v0.4.1 聚焦 Windows 平台质量，以便核心体验扎实。

#### Acceptance Criteria

1. THE v0.4.1 SHALL 以 Windows 为唯一目标平台实现并验证全部功能性需求。
2. WHERE 涉及 Mac 平台（仅限需求 9 / A7）, THE 改动 SHALL 限于 additive CSS 样式兜底，且不在 Mac 实机验证。

### Requirement 39: 快捷键零回归约束

**User Story:** 作为 v0.4.0 老用户，我希望升级后既有快捷键行为完全不变，以便我的使用习惯不被打断。

#### Acceptance Criteria

1. WHEN 用户从 v0.4.0 升级到 v0.4.1 且未修改快捷键配置, THE Hotkey_Manager SHALL 使所有既有快捷键的行为与 v0.4.0 逐字节一致（默认全部为 `Global` Scope）。

### Requirement 40: 开源协议署名约束

**User Story:** 作为关注合规的用户与上游作者，我希望 v0.4.1 保留上游 GPL-3.0 署名，以便遵守开源协议。

#### Acceptance Criteria

1. THE 仓库 SHALL 在 README 与 CHANGELOG 中保留对上游 `jimuzhe/tiez-clipboard` 的署名与 GPL-3.0 协议说明。

### Requirement 41: 优先级交付约束

**User Story:** 作为项目负责人，我希望按优先级有序交付，以便高价值项必达、低优先项视进度推进。

#### Acceptance Criteria

1. THE v0.4.1 SHALL 完成全部标记为 P0 的需求（A10、U1、U2、F1、F2、F3、C1、C2、C5）。
2. THE v0.4.1 SHALL 尽量完成标记为 P1 的需求。
3. WHERE 进度紧张, THE 团队 SHALL 允许将 P2 / P3 需求推迟到后续版本。
4. WHILE 处于 Week 5 起的 feature freeze 阶段, THE 团队 SHALL 只修复缺陷，不新增功能。





