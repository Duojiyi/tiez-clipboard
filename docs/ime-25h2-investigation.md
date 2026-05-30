# Windows 25H2 微软输入法吞字冲突调研（U5 / 需求 14）

> 对应需求 14（U5）：Windows 25H2 与微软输入法的 IME hook 冲突吞字。
> 本文记录限时 spike 的复现条件、根因分析与结论。需求 14 的完成定义为
> 「能修则修，否则产出调研文档」二者满足其一——本次同时产出本调研文档（14.3），
> 并对定位到的、可干净修复的冲突点做了保守修复（14.2，见第 6 节）。

## 1. 结论摘要

- **冲突点已定位**：罪魁是 `src-tauri/src/app/hooks/mod.rs` 的低级键盘钩子 `keyboard_proc`
  中「全局导航键」分支（第 5 段，`// 5. Global Navigation Keys`）。当 Magpie 主窗口可见时，
  它对 `Up / Down / Enter / Esc` 在 keydown 时返回 `LRESULT(1)` **系统级吞掉该按键**。
  而这几个键恰好是输入法「候选导航 / 上屏 / 取消合成」所用的键，导致用户在**其他应用**里
  用微软输入法打字时合成被打断、出现吞字。
- **能干净修复的部分已修复**：在导航键拦截前增加「前台窗口是否正在 IME 合成」的守卫
  （`foreground_ime_composing()`），合成进行中时**放行**这些键给输入法。该改动是
  **纯增量、只会放宽拦截、绝不会吞掉更多按键**，因此对既有行为零回归（见第 6 节）。
- **无法在编码内根除的部分**：Windows 25H2 默认的微软输入法是基于 TSF（Text Services
  Framework）的实现，其合成状态不一定经 IMM32 兼容层暴露；从全局低级钩子里**跨进程**
  可靠探测 TSF 合成态没有干净、稳定的官方手段。因此本次修复对 IMM32 兼容路径有效，
  对纯 TSF 路径会回退到原行为（不恶化）。实机复现与最终验证属人工范畴（见第 7 节）。

## 2. 背景与现象

微软输入法用户反馈：在 Windows 25H2 上，Magpie 处于运行/可见状态时，于其他应用
（如浏览器地址栏、聊天框）使用微软拼音输入中文会**吞字**——表现为：

- 打字过程中按 `Enter` 上屏，候选/合成串被丢弃，字没上屏；
- 按 `↑/↓` 翻候选页或选候选时，光标/选择不响应或合成被打断；
- 按 `Esc` 想取消合成时，反而触发了 Magpie 的「Esc 关闭窗口」。

上游 issue 标注为「Windows 25H2 + 微软输入法」组合下的冲突，优先级 P1、限时调研。

## 3. 复现条件（待人工实机验证）

满足以下全部条件时最易复现：

1. 操作系统：Windows 11 25H2，使用**默认微软输入法**（TSF 模式）。
2. Magpie 主窗口处于**可见**状态：
   - 固定窗口（pinned）模式常驻显示；或
   - 刚通过主快捷键唤起、尚未隐藏。
3. 设置项**「方向键选择」(`app.arrow_key_selection`) 已开启**。
   - 这是当前 `keyboard_proc` 导航分支生效的前置条件（默认 `false`，故默认配置下导航键不被吞，
     冲突主要出现在用户开启该选项后）。
4. 焦点在**其他应用**的文本框里（Magpie 窗口非前台、不持有焦点——这是本应用 `WS_EX_NOACTIVATE`
   + `set_focusable(false)` 的设计常态）。
5. 用微软输入法输入中文，在合成未上屏时按 `Enter / ↑ / ↓ / Esc`。

> 备注：`Ctrl/Alt/Win + 数字` 的「数字快捷粘贴」分支（第 4 段）默认 `quick_paste_modifier=disabled`
> 不拦截数字键；仅当用户启用某修饰键时，合成中按「修饰键+数字」选候选页才可能受影响，属次要面，
> 见第 7 节建议。

## 4. 代码层根因分析

### 4.1 低级键盘钩子的拦截语义

`keyboard_proc`（`WH_KEYBOARD_LL`，安装于 `app/setup.rs::init_win32_hooks` 的独立线程）在系统
把按键投递到任何线程输入队列**之前**就能看到原始按键。回调返回 `LRESULT(1)` 即**吞掉**该按键，
后续的输入法、目标窗口都收不到它。

关键在于：**低级键盘钩子看到的是物理按键的 `vkCode`，而不是 `VK_PROCESSKEY (0xE5)`。**
`VK_PROCESSKEY` 只出现在窗口消息层（`GetMessage`/`TranslateMessage` 之后、IME 认领按键时），
低级钩子层早于该阶段，因此**无法靠在钩子里识别 `VK_PROCESSKEY` 来区分"这个键是不是给输入法的"**。
这一点决定了"在钩子里直接判断 IME 合成消息"的朴素思路不可行。

### 4.2 冲突分支：全局导航键（第 5 段）

```rust
// 5. Global Navigation Keys (Up/Down, Enter, Esc)
if NAVIGATION_ENABLED.load(Ordering::SeqCst) && !IS_RECORDING.load(...) {
    if IS_HIDDEN.load(...) { return CallNextHookEx(...); }       // 隐藏时放行
    let allow_navigation = settings.arrow_key_selection;          // 默认 false
    if !allow_navigation { return CallNextHookEx(...); }          // 关闭时放行
    let is_navigation_key = vk == 0x26 || vk == 0x28 || vk == 0x0D || vk == 0x1B; // ↑ ↓ Enter Esc
    if is_navigation_key && is_down {
        // ……无 Ctrl/Alt/Win 时：
        return LRESULT(1);   // ← 系统级吞掉该键
    }
}
```

- 该分支的设计意图：让用户**即使 Magpie 没有焦点**（非前台、`WS_EX_NOACTIVATE`），也能用方向键
  在历史列表里导航、`Enter` 粘贴、`Esc` 关闭。这是「全局导航」特性，本身依赖低级钩子在非前台时也拦截。
- 副作用：当窗口可见且 `arrow_key_selection` 开启时，**无论用户此刻是不是在别的应用里用输入法打字**，
  这些键都被吞。这与输入法的 `Enter` 上屏、`↑/↓` 选候选、`Esc` 取消合成**直接冲突** → 吞字。

### 4.3 为什么不能简单地"Magpie 非前台就不拦截"

「全局导航」恰恰是为"Magpie 非前台时仍能用方向键操作列表"而设计的（窗口以非激活方式显示，
前台仍是用户原来的应用）。若改成"仅当 Magpie 是前台才拦截"，会直接废掉该特性，属功能回归，
不可接受。因此唯一干净的判别维度是：**前台焦点控件此刻是否正处于 IME 合成态**——
合成中放行、未合成时维持原导航行为。

## 5. 为什么"完全干净修复"困难（25H2 / TSF）

1. **TSF 与 IMM32 的差异**：Windows 8 以后、尤其 25H2 默认的微软输入法走 TSF。其合成状态由
   TSF 维护，不保证经 IMM32 兼容层（`ImmGetCompositionStringW` 等）对外暴露。某些 25H2 场景下
   `ImmGetCompositionStringW` 对纯 TSF 合成返回 0，等于"探测不到合成"。
2. **跨进程探测无官方稳定手段**：从 Magpie 的钩子线程去读取**另一个进程**前台控件的 TSF 合成态，
   没有干净、受支持的 API。`ITfThreadMgr`/`ITfContext` 等 TSF 接口面向"宿主自身"的输入栈，
   不适合跨进程窥探他人合成状态。
3. **热路径约束**：低级键盘钩子回调必须快速返回（超时会被系统静默丢弃/摘钩），且**绝不能 panic**
   （panic 会破坏全局钩子，使所有快捷键失效）。任何探测都必须是 µs 级、不阻塞、不 panic。
4. **无法实机闭环**：编码环境无法在 25H2 真机 + 微软输入法下复现与回归验证；硬塞一个未经真机验证的
   "深度修复"违背「避免引入回归」的约束。

综合 1–4：在编码任务范围内，**只能做"对 IMM32 兼容路径有效、对纯 TSF 路径安全回退"的保守修复**，
不能保证在所有 25H2 微软输入法配置下根除吞字。

## 6. 已采取的保守修复（需求 14.2 可干净修复部分）

在 `app/hooks/mod.rs` 增加一个**只读、快速、不会 panic** 的辅助函数
`foreground_ime_composing()`，并在导航键拦截前作为前置守卫：

- 取前台窗口 → 经 `GetGUIThreadInfo` 取其线程真正持有键盘焦点的控件 →
  `ImmGetContext` + `ImmGetCompositionStringW(GCS_COMPSTR, 长度查询)`；
- 合成串长度 `> 0` 视为"用户正在输入法合成中" → 对 `Up/Down/Enter/Esc` **放行**
  （`CallNextHookEx`），把键交还给输入法；
- 探测不到合成（含纯 TSF 返回 0、API 失败、句柄为空）→ 返回 `false`，**回退到原导航行为**。

该修复的安全性论证（零回归）：

- 守卫**只会让钩子"少吞键"**（合成时放行），**永远不会让它"多吞键"**，因此当前的吞字失败模式
  不可能因此变得更糟；
- 仅在「导航分支已生效（窗口可见 + `arrow_key_selection` 开启）」且按下的是 `↑/↓/Enter/Esc`、keydown 时
  才执行探测，**对绝大多数按键零额外开销**；
- 探测失败一律回退原行为，与改动前逐字节一致；
- 函数内部全部使用 `is_null()/is_err()/let _ =` 等不会 panic 的写法，符合钩子热路径约束。

> 依赖：`windows` crate 已启用 `Win32_UI_Input_Ime`（`ImmGetContext`/`ImmGetCompositionStringW`/
> `ImmReleaseContext`/`GCS_COMPSTR`）与 `Win32_UI_WindowsAndMessaging`（`GetForegroundWindow`/
> `GetWindowThreadProcessId`/`GetGUIThreadInfo`/`GUITHREADINFO`），无需新增 feature。

## 7. 残留风险与后续建议

- **纯 TSF 微软输入法仍可能吞字**：若真机验证发现 25H2 默认输入法下 `ImmGetCompositionStringW`
  返回 0，则本守卫不生效。届时建议的兜底（按收益/风险排序）：
  1. **缩小拦截窗口（推荐、低风险）**：将「全局导航键拦截」进一步限定为「Magpie 主窗口持有焦点
     或刚被激活（`activate_window_focus` 后的短时窗口）」，把"非前台也吞导航键"从默认行为改为
     可选项，从根上避免与他人输入法争抢 `Enter/↑/↓/Esc`。需配合产品决策（可能弱化全局导航手感）。
  2. **改用应用内 keydown（中风险）**：呼应 F5（需求 19）的 `InAppOnly` scope——导航键不走全局钩子，
     只在 webview 聚焦时由前端 `keydown` 处理，彻底不与系统级输入法冲突。需要将导航特性接入 scope 体系。
  3. **TSF 感知（高成本）**：在 Magpie 自身进程内建立 TSF 文本服务以感知输入栈状态，复杂度高、
     与"非前台全局拦截"模型不匹配，不建议在 v0.4.1 投入。
- **数字快捷粘贴分支（第 4 段）**：当用户把 `quick_paste_modifier` 设为某修饰键时，合成中按
  「修饰键+数字」选候选页可能被拦截。建议同样接入 IME 合成守卫或迁移到 `InAppOnly` scope（F5）。
- **`arrow_key_selection` 默认值**：保持默认 `false` 可显著降低普通用户遭遇本冲突的概率；
  文案上可在该开关旁提示"开启后在部分输入法场景可能影响打字"。

## 8. 实机复现与验证清单（人工）

编码无法覆盖的人工步骤，建议在 Windows 11 25H2 真机执行：

1. 安装 Magpie，开启「方向键选择」，设为固定窗口（pinned）常驻可见。
2. 切换到微软拼音输入法，在浏览器地址栏/记事本输入拼音进入合成态。
3. 分别按 `Enter`（上屏）、`↑/↓`（翻候选）、`Esc`（取消），记录是否吞字。
4. 对照修复前后版本各测一轮；记录输入法类型（IMM32 兼容 vs 纯 TSF）。
5. 若纯 TSF 下仍吞字，按第 7 节建议 1/2 推进，并把真机结论回填本文件。

## 9. 参考

- LowLevelKeyboardProc 回调与拦截语义（Microsoft Learn）。内容已改写以符合授权要求。
- WM_IME_COMPOSITION / ImmGetCompositionString 处理（Microsoft Learn）。内容已改写以符合授权要求。
- Input Method Editors (IME) 概述（Microsoft Learn）。内容已改写以符合授权要求。
- 社区普遍现象：CJK 输入法合成中 `Enter` 被上层当作"提交/导航"误触发，需以"合成态检测"区分。

> 内容已根据来源改写，以符合内容授权与署名要求。
