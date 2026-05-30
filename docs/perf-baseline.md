# Magpie 性能基线（perf-baseline）

> 对应需求 20（C1 基准测试套件）。本文件记录 Magpie 核心操作的性能基线，
> 数值由 `cargo bench` 运行 criterion 基准（`src-tauri/benches/clipboard_bench.rs`）后回填。

## 运行方式

```powershell
# 在 src-tauri 目录下运行
cargo bench --bench clipboard_bench
```

criterion 会在 `src-tauri/target/criterion/` 生成详细报告（含 HTML），
取各基准的 `time:` 中位数（median）回填到下表「基线耗时」列。

## 测量环境

运行基准前请填写本机环境，便于后续版本横向对比：

| 项目 | 值 |
|------|-----|
| 采集日期 | TBD |
| Magpie 版本 | v0.4.1 |
| CPU | TBD |
| 内存 | TBD |
| 操作系统 | TBD（Windows 版本号） |
| Rust 版本 | TBD（`rustc --version`） |
| 构建配置 | release（criterion 默认） |

## 基线数据

三项核心操作对应 `clipboard_bench.rs` 中的 criterion 基准。
「基线耗时」列在运行 `cargo bench` 前保持 `TBD`，运行后回填 criterion 报告的中位数。

| 操作名称 | criterion 基准名 | 样本数 / 迭代 | 基线耗时（中位数） | 备注 |
|----------|------------------|----------------|--------------------|------|
| 读取历史 | `get_history(0,100)` | 1000 条预填充，取 limit=100 / offset=0；criterion 默认 100 样本 | TBD | 镜像 `clipboard_repo::get_history` 无 content_type 过滤路径 |
| 搜索 | `search('keyword', 1000条)` | 1000 条预填充（每 10 条含 `keyword`），term=`keyword` / limit=200；criterion 默认 100 样本 | TBD | 镜像 `clipboard_repo::search` 默认非敏感条目路径 |
| 插入条目 | `insert_clipboard()` | 单条 INSERT + 一条标签同步；criterion 默认 100 样本 | TBD | 镜像 `clipboard_repo::save_with_conn` 新增条目 INSERT 路径 |

## 备注

- criterion 默认每个基准至少采集 100 个样本，单位通常为 µs/ns，回填时保留 criterion 报告原始单位。
- 数值仅在同一台机器、同一构建配置下纵向对比才有意义；跨机器对比需结合「测量环境」一并参考。
- C4（启动速度优化，需求 23.1）要求冷启动比 v0.4.0 基线快 ≥30%，相关冷启动数值在本文件之外单独采集，不在上表范围内。
