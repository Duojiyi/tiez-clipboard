// @ts-check
/**
 * 静态校验脚本（Magpie v0.4.1 / 任务 33.1）
 *
 * 校验项（任一失败则以非 0 退出码退出并打印中文错误）：
 *   1. 源码（src/、src-tauri/src/、docs/）无 `my.feishu.cn` 链接（A6 / 需求 5.5）。
 *   2. 内部兼容字段仍保留（需求 36）：`tiez.log`、`<!--TIEZ_RICH_IMAGE:`、`tiez-sync`、`tiez_`、`tiez/tiez_`。
 *   3. `src-tauri/Cargo.toml` 不含 `opt-level = "z"`（需求 37）。
 *   4. README/CHANGELOG 含 GPL-3.0 与上游 `jimuzhe/tiez-clipboard` 署名（需求 40）。
 *   5. 关键设置项 ID 未变（V6.2）：核查已知关键设置项 ID 仍出现在 src/features/settings 中。
 *
 * 运行方式：node scripts/static-checks.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, extname, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// 仓库根目录 = scripts/ 的上一级。
const ROOT = resolve(__dirname, "..");

// 需要扫描的文本文件扩展名（排除图片等二进制资源）。
const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".rs", ".md", ".css", ".scss", ".json", ".html", ".toml", ".txt",
]);

// 遍历时始终跳过的目录名。
const SKIP_DIRS = new Set(["node_modules", "target", "dist", ".git", "images", "gen"]);

/** 递归收集 dir 下的文本文件绝对路径。dir 不存在时返回空数组。 */
function collectTextFiles(dir) {
  /** @type {string[]} */
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) continue;
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = join(cur, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        stack.push(full);
      } else if (ent.isFile() && TEXT_EXTS.has(extname(ent.name).toLowerCase())) {
        out.push(full);
      }
    }
  }
  return out;
}

/** 读取文本文件内容，失败返回空串。 */
function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** 仓库相对路径，统一使用正斜杠便于展示与匹配。 */
function rel(file) {
  return relative(ROOT, file).split(sep).join("/");
}

/** 在内容中查找子串出现的所有行（1 基），用于精确报错。 */
function findLines(content, needle) {
  /** @type {number[]} */
  const lines = [];
  const arr = content.split(/\r?\n/);
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].includes(needle)) lines.push(i + 1);
  }
  return lines;
}

// ============ 校验 1：源码无 my.feishu.cn 链接（A6 / 5.5）============
function checkNoFeishu() {
  const needle = "my.feishu.cn";
  // 扫描范围：产品源码与用户可见文档。
  const dirs = [
    join(ROOT, "src"),
    join(ROOT, "src-tauri", "src"),
    join(ROOT, "docs"),
  ];
  // 排除项：内部规划文档 docs/v0.4.1-plan.md。该文档（A6 条目）以内联代码形式
  // 引用「被替换掉的」旧飞书链接（`https://my.feishu.cn/docx/...`）以说明改造背景，
  // 属于变更历史记录，并非面向用户的活跃教程链接，故不视为需求 5.5 违规。
  const excludes = new Set(["docs/v0.4.1-plan.md"]);

  /** @type {string[]} */
  const hits = [];
  for (const dir of dirs) {
    for (const file of collectTextFiles(dir)) {
      const r = rel(file);
      if (excludes.has(r)) continue;
      const content = readText(file);
      if (content.includes(needle)) {
        for (const ln of findLines(content, needle)) {
          hits.push(`${r}:${ln}`);
        }
      }
    }
  }

  if (hits.length > 0) {
    return {
      name: "1. 源码无 my.feishu.cn 链接（A6 / 5.5）",
      passed: false,
      messages: [
        `检测到残留的飞书链接 ${needle}，共 ${hits.length} 处：`,
        ...hits.map((h) => `    - ${h}`),
        "  请将云同步教程链接替换为本仓库 GitHub 教程。",
      ],
    };
  }
  return {
    name: "1. 源码无 my.feishu.cn 链接（A6 / 5.5）",
    passed: true,
    messages: ["src/、src-tauri/src/、docs/（排除记录改造历史的内部规划文档）均无 my.feishu.cn 链接。"],
  };
}

// ============ 校验 2：内部兼容字段仍保留（需求 36）============
function checkCompatFields() {
  // 每个兼容字段需在产品源码中至少出现一次（区分大小写）。
  const tokens = ["tiez.log", "<!--TIEZ_RICH_IMAGE:", "tiez-sync", "tiez_", "tiez/tiez_"];
  const dirs = [join(ROOT, "src"), join(ROOT, "src-tauri", "src")];
  const files = dirs.flatMap((d) => collectTextFiles(d));
  const contents = files.map((f) => ({ r: rel(f), text: readText(f) }));

  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const found = [];
  for (const token of tokens) {
    const hit = contents.find((c) => c.text.includes(token));
    if (hit) {
      found.push(`${token}（如 ${hit.r}）`);
    } else {
      missing.push(token);
    }
  }

  if (missing.length > 0) {
    return {
      name: "2. 内部兼容字段仍保留（需求 36）",
      passed: false,
      messages: [
        `以下兼容字段在源码中已缺失，违反需求 36：`,
        ...missing.map((m) => `    - ${m}`),
      ],
    };
  }
  return {
    name: "2. 内部兼容字段仍保留（需求 36）",
    passed: true,
    messages: found.map((f) => `已保留：${f}`),
  };
}

// ============ 校验 3：Cargo.toml 不含 opt-level = "z"（需求 37）============
function checkCargoOptLevel() {
  const cargoPath = join(ROOT, "src-tauri", "Cargo.toml");
  if (!existsSync(cargoPath)) {
    return {
      name: '3. Cargo.toml 不含 opt-level = "z"（需求 37）',
      passed: false,
      messages: [`未找到文件：${rel(cargoPath)}`],
    };
  }
  const lines = readText(cargoPath).split(/\r?\n/);
  // 仅检测「生效的」赋值：先剥离行内注释（# 之后），再匹配 opt-level = "z"。
  const re = /opt-level\s*=\s*"z"/;
  /** @type {string[]} */
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const code = lines[i].split("#")[0];
    if (re.test(code)) hits.push(`${rel(cargoPath)}:${i + 1}`);
  }

  if (hits.length > 0) {
    return {
      name: '3. Cargo.toml 不含 opt-level = "z"（需求 37）',
      passed: false,
      messages: [
        `检测到 opt-level = "z"（违反需求 37，体积优化不得牺牲性能）：`,
        ...hits.map((h) => `    - ${h}`),
      ],
    };
  }
  return {
    name: '3. Cargo.toml 不含 opt-level = "z"（需求 37）',
    passed: true,
    messages: ['未启用 opt-level = "z"。'],
  };
}

// ============ 校验 4：README/CHANGELOG 含 GPL-3.0 与上游署名（需求 40）============
function checkLicenseAttribution() {
  const targets = ["README.md", "README.zh-CN.md", "CHANGELOG.md"];
  const required = ["GPL-3.0", "jimuzhe/tiez-clipboard"];

  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const ok = [];
  for (const name of targets) {
    const p = join(ROOT, name);
    if (!existsSync(p)) {
      problems.push(`${name}：文件不存在`);
      continue;
    }
    const text = readText(p);
    const miss = required.filter((tok) => !text.includes(tok));
    if (miss.length > 0) {
      problems.push(`${name}：缺少 ${miss.join("、")}`);
    } else {
      ok.push(`${name}：已含 GPL-3.0 与 jimuzhe/tiez-clipboard 署名`);
    }
  }

  if (problems.length > 0) {
    return {
      name: "4. README/CHANGELOG 含 GPL-3.0 与上游署名（需求 40）",
      passed: false,
      messages: ["以下文件未满足署名要求：", ...problems.map((p) => `    - ${p}`)],
    };
  }
  return {
    name: "4. README/CHANGELOG 含 GPL-3.0 与上游署名（需求 40）",
    passed: true,
    messages: ok,
  };
}

// ============ 校验 5：关键设置项 ID 未变（V6.2）============
function checkSettingIds() {
  // 已知关键设置项 ID（与 src/features/settings 中实际使用一致）。
  // 任一缺失即视为 ID 被改动，违反 V6.2「设置项 ID 不变，仅改分组归属」。
  const ids = [
    // GeneralSettingsGroup
    "check_update_on_startup", "show_search_box", "show_scroll_top_button",
    "emoji_panel_enabled", "tag_manager_enabled",
    "arrow_key_selection", "card_density",
    // ClipboardSettingsGroup
    "persistent_limit", "persistent_limit_enabled", "rich_text_snapshot_preview",
    "quick_paste_in_app_enabled", "delete_after_paste", "move_to_top_after_paste",
    // AppearanceSettingsGroup
    "theme", "color_mode", "language", "show_source_app_icon", "compact_mode",
    "clipboard_item_font_size", "clipboard_tag_font_size",
    // CloudSyncSettingsGroup / AiSettingsGroup / FileTransferSettingsGroup
    "cloud_sync_webdav_base_path", "ai_enabled", "file_transfer_path",
  ];

  const settingsDir = join(ROOT, "src", "features", "settings");
  if (!existsSync(settingsDir)) {
    return {
      name: "5. 关键设置项 ID 未变（V6.2）",
      passed: false,
      messages: [`未找到设置目录：${rel(settingsDir)}`],
    };
  }
  const corpus = collectTextFiles(settingsDir).map(readText).join("\n");

  // ID 必须以带引号的字符串字面量形式出现（'id' 或 "id"），避免误判通用单词。
  const missing = ids.filter((id) => {
    return !corpus.includes(`'${id}'`) && !corpus.includes(`"${id}"`);
  });

  if (missing.length > 0) {
    return {
      name: "5. 关键设置项 ID 未变（V6.2）",
      passed: false,
      messages: [
        `以下关键设置项 ID 在 src/features/settings 中已不存在（可能被重命名）：`,
        ...missing.map((m) => `    - ${m}`),
      ],
    };
  }
  return {
    name: "5. 关键设置项 ID 未变（V6.2）",
    passed: true,
    messages: [`已核查 ${ids.length} 个关键设置项 ID，全部保持不变。`],
  };
}

// ============ 主流程 ============
function main() {
  console.log("==== Magpie v0.4.1 静态校验（任务 33.1）====\n");

  const checks = [
    checkNoFeishu,
    checkCompatFields,
    checkCargoOptLevel,
    checkLicenseAttribution,
    checkSettingIds,
  ];

  let allPassed = true;
  for (const run of checks) {
    const result = run();
    const tag = result.passed ? "[通过]" : "[失败]";
    console.log(`${tag} ${result.name}`);
    for (const msg of result.messages) {
      console.log(`  ${msg}`);
    }
    console.log("");
    if (!result.passed) allPassed = false;
  }

  if (allPassed) {
    console.log("==== 总结：全部 5 项静态校验通过 ✅ ====");
    process.exit(0);
  } else {
    console.error("==== 总结：存在未通过的静态校验，请按上方中文提示修复 ❌ ====");
    process.exit(1);
  }
}

main();
