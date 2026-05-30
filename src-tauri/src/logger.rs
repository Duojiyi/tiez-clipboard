use chrono::{DateTime, Utc};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::SystemTime;

static LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn init(path: PathBuf) {
    // 可恢复：日志路径锁若因其他线程 panic 而中毒，仍可取回内部值继续写入日志路径，
    // 不应让日志初始化本身 panic（启动热路径）。
    let mut guard = LOG_PATH.lock().unwrap_or_else(|e| e.into_inner());
    *guard = Some(path);
}

pub fn log(msg: &str) {
    // 可恢复：锁中毒时取回内部值继续写日志（吞写入错误即可），避免某线程 panic 后日志彻底失效。
    let guard = match LOG_PATH.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };
    if let Some(path) = &*guard {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
            let now: DateTime<Utc> = SystemTime::now().into();
            let timestamp = now.format("%Y-%m-%d %H:%M:%S%.3f").to_string();
            let _ = writeln!(f, "[{}] {}", timestamp, msg);
        }
    }
    drop(guard);
    // Also print to console for development
    println!("{}", msg);
}

#[macro_export]
macro_rules! info {
    ($($arg:tt)*) => {
        $crate::logger::log(&format!($($arg)*))
    };
}

#[macro_export]
macro_rules! error {
    ($($arg:tt)*) => {
        $crate::logger::log(&format!("[ERROR] {}", format!($($arg)*)))
    };
}
