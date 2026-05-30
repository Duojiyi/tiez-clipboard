//! 全局 panic 兜底（C6 / 需求 25）
//!
//! 通过 `std::panic::set_hook` 安装全局 panic 钩子：
//! - 任意线程发生 panic 时，将 panic 信息追加写入 `tiez.log`（需求 25.1）；
//! - 主线程发生 panic 时，额外尝试对数据库执行 `PRAGMA wal_checkpoint` 落盘（需求 25.2）。
//!
//! 重要约束：release 构建为 `panic = "abort"`，无法 unwind，`catch_unwind` 不会捕获 panic。
//! 因此本 hook **不依赖** `catch_unwind`（需求 25.4），而是保证自身绝不调用任何可能 panic
//! 的 API：所有 IO / 加锁 / 状态访问一律用 `let _ = ...` 或 `if let Ok(..)` 吞错，避免在
//! panic 处理过程中再次 panic 导致递归或直接 abort。
//!
//! 日志写入不复用 `logger::log`：后者内部使用 `unwrap()`，在锁中毒（panic 期间常见）时
//! 会再次 panic。故 hook 直接以 append 模式写入传入的 `log_path`（即 `tiez.log`，兼容字段，
//! 不可更名）。

use std::path::PathBuf;
use std::thread::ThreadId;
use tauri::{AppHandle, Manager};

/// 安装全局 panic hook。
///
/// - `log_path`：`tiez.log` 的绝对路径。直接以 append 方式写入，不修改该兼容字段。
/// - `app`：用于在主线程 panic 时取得数据库连接执行 `wal_checkpoint` 落盘。
///
/// 必须在主线程（`main.rs` 的 setup 流程）调用：安装时记录主线程 ID，hook 触发时据此
/// 区分主线程 panic 与后台线程 panic。
pub fn install_panic_hook(log_path: PathBuf, app: AppHandle) {
    // 安装发生在主线程，记录主线程 ID；hook 触发时据此判断是否为主线程 panic。
    let main_thread_id: ThreadId = std::thread::current().id();

    std::panic::set_hook(Box::new(move |info| {
        // —— 1. 组装 panic 描述（format! 在常规输入下不会 panic）——
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown>".to_string());

        let payload = panic_payload_message(info);

        let thread = std::thread::current();
        let is_main = thread.id() == main_thread_id;
        let thread_label = if is_main { "main" } else { "background" };
        let thread_name = thread.name().unwrap_or("<unnamed>").to_string();

        let message = format!(
            "[PANIC] thread={} (name={}) at {} :: {}",
            thread_label, thread_name, location, payload
        );

        // —— 2. 追加写入 tiez.log（吞错，绝不 panic）——
        append_panic_log(&log_path, &message);

        // —— 3. 主线程 panic：尝试数据库落盘（吞错）——
        if is_main {
            try_checkpoint_database(&app, &log_path);
        }
    }));
}

/// 从 `PanicHookInfo` 尽力提取可读的 panic 消息，覆盖 `&str` 与 `String` 两种常见 payload。
fn panic_payload_message(info: &std::panic::PanicHookInfo<'_>) -> String {
    if let Some(s) = info.payload().downcast_ref::<&str>() {
        (*s).to_string()
    } else if let Some(s) = info.payload().downcast_ref::<String>() {
        s.clone()
    } else {
        "<non-string panic payload>".to_string()
    }
}

/// 以 append 方式向 `tiez.log` 写入一行（带时间戳）。所有错误一律吞掉，绝不 panic。
fn append_panic_log(log_path: &PathBuf, message: &str) {
    use std::io::Write;
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let timestamp = chrono::Utc::now()
            .format("%Y-%m-%d %H:%M:%S%.3f")
            .to_string();
        let _ = writeln!(file, "[{}] {}", timestamp, message);
    }
}

/// 主线程 panic 时尝试对数据库执行 `PRAGMA wal_checkpoint(TRUNCATE)` 将 WAL 落盘。
///
/// 使用 `try_lock` 而非 `lock`：若 panic 恰好发生在持有连接锁的线程，`lock` 会死锁、
/// 或在锁中毒时 panic；`try_lock` 拿不到锁即放弃。所有失败均吞掉。
fn try_checkpoint_database(app: &AppHandle, log_path: &PathBuf) {
    if let Some(db_state) = app.try_state::<crate::database::DbState>() {
        if let Ok(conn) = db_state.conn.try_lock() {
            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
            append_panic_log(log_path, "[PANIC] 已尝试 wal_checkpoint 落盘");
        } else {
            append_panic_log(log_path, "[PANIC] 数据库连接忙，跳过 wal_checkpoint");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{append_panic_log, panic_payload_message};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// 在系统临时目录下创建唯一的 tiez.log 路径（不预先创建文件，验证 append 自建文件）。
    fn temp_log_path(tag: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "magpie_panic_hook_{}_{}_{}",
            tag,
            std::process::id(),
            unique
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("tiez.log")
    }

    #[test]
    fn append_panic_log_写入并追加日志() {
        let path = temp_log_path("append");
        // 文件初始不存在，append 应自动创建
        append_panic_log(&path, "[PANIC] 第一条");
        append_panic_log(&path, "[PANIC] 第二条");

        let content = std::fs::read_to_string(&path).expect("日志文件应已被写入");
        assert!(content.contains("[PANIC] 第一条"), "应写入第一条 panic 记录");
        assert!(content.contains("[PANIC] 第二条"), "应追加第二条而非覆盖");
        // 每行带时间戳前缀 [YYYY-..]，至少两行
        assert_eq!(content.lines().count(), 2, "两次写入应产生两行日志");
        assert!(content.starts_with('['), "日志行应以时间戳 [..] 开头");

        let _ = std::fs::remove_dir_all(path.parent().unwrap());
    }

    // Requirements 25.1：模拟 panic 时（unwind 可用的 test 构建下）panic 信息被写入 tiez.log。
    #[test]
    fn 模拟_panic_时日志被写入() {
        let path = temp_log_path("panic");
        let path_for_hook = path.clone();

        // 保存当前全局 hook，安装一个复用本模块真实写日志逻辑的 hook：
        // 用 panic_payload_message 提取消息、append_panic_log 落盘，与 install_panic_hook 内部一致。
        let prev = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            let payload = panic_payload_message(info);
            let location = info
                .location()
                .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
                .unwrap_or_else(|| "<unknown>".to_string());
            append_panic_log(
                &path_for_hook,
                &format!("[PANIC] at {} :: {}", location, payload),
            );
        }));

        // 触发 panic（test 构建默认 unwind 可用），由 catch_unwind 接住，避免测试进程退出
        let result = std::panic::catch_unwind(|| {
            panic!("模拟崩溃-Zq9boom");
        });

        // 还原原始 hook，避免影响其他并行测试
        std::panic::set_hook(prev);

        assert!(result.is_err(), "panic 应被 catch_unwind 捕获");
        let content = std::fs::read_to_string(&path).expect("panic 发生时日志应已写入");
        assert!(
            content.contains("模拟崩溃-Zq9boom"),
            "tiez.log 应记录 panic 的消息内容，实际：{}",
            content
        );
        assert!(content.contains("[PANIC]"), "日志应带 [PANIC] 标记");

        let _ = std::fs::remove_dir_all(path.parent().unwrap());
    }
}
