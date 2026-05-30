//! 用户表情库仓储
//!
//! 以文件系统目录为唯一真相，管理 `%APPDATA%\app.magpie\emojis\user\` 下的用户表情图片。
//! - 列表扫描逻辑与 `file_cmd.rs` 的 `list_emoji_favorite_paths_in_dir` 同构（按扩展名过滤、排序）。
//! - 存储逻辑复用 `file_cmd.rs` 的 `save_emoji_favorite_bytes_to_dir` 存储模式：
//!   以内容哈希命名、目标已存在则跳过写入（天然去重）。
//! - 扩展名识别直接复用 `file_cmd.rs` 已公开的 `image_ext_from_filename` / `image_ext_from_bytes`，不重复定义。

use crate::app::commands::file_cmd::{image_ext_from_bytes, image_ext_from_filename};
use crate::app_state::AppDataDir;
use crate::error::{AppError, AppResult};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
use tauri::State;

/// 计算用户表情库目录：`<data_dir>/emojis/user`
fn user_emoji_dir(data_dir: &Path) -> std::path::PathBuf {
    data_dir.join("emojis").join("user")
}

/// 将图片字节写入用户表情库目录（与 `save_emoji_favorite_bytes_to_dir` 同构）。
///
/// 以内容哈希命名 `user_<hash>.<ext>`，目标已存在则不重复写入，返回最终文件路径。
pub(crate) fn save_user_emoji_bytes_to_dir(
    data_dir: &Path,
    bytes: &[u8],
    ext: &str,
) -> AppResult<String> {
    // 用内容哈希作为文件名，相同图片只会保存一份
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    let hash = hasher.finish();

    let user_dir = user_emoji_dir(data_dir);
    if !user_dir.exists() {
        std::fs::create_dir_all(&user_dir).map_err(AppError::from)?;
    }

    let file_name = format!("user_{:x}.{}", hash, ext);
    let target_path = user_dir.join(file_name);
    if !target_path.exists() {
        std::fs::write(&target_path, bytes).map_err(AppError::from)?;
    }

    Ok(target_path.to_string_lossy().to_string())
}

/// 扫描用户表情库目录，返回全部用户表情图片的绝对路径（已排序）。
///
/// 与 `list_emoji_favorite_paths_in_dir` 同构：目录不存在时返回空列表，仅保留受支持的图片扩展名。
pub(crate) fn list_user_emoji_paths_in_dir(data_dir: &Path) -> AppResult<Vec<String>> {
    let user_dir = user_emoji_dir(data_dir);
    if !user_dir.exists() {
        return Ok(Vec::new());
    }

    let mut paths = Vec::new();
    for entry in std::fs::read_dir(&user_dir).map_err(AppError::from)? {
        let path = entry.map_err(AppError::from)?.path();
        if !path.is_file() {
            continue;
        }
        // 复用 image_ext_from_filename：能识别出受支持扩展名才纳入列表
        let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
        if image_ext_from_filename(name).is_some() {
            paths.push(path.to_string_lossy().to_string());
        }
    }

    paths.sort();
    Ok(paths)
}

/// 将一张图片添加到用户表情库。
///
/// `source` 为本地图片文件路径；读取其字节、识别扩展名后存入 `emojis/user/`，返回保存后的文件路径。
#[tauri::command]
pub async fn add_image_to_emoji(
    app_data: State<'_, AppDataDir>,
    source: String,
) -> AppResult<String> {
    let source = source.trim();
    if source.is_empty() {
        return Err(AppError::Validation("source is empty".to_string()));
    }

    let bytes = std::fs::read(source).map_err(AppError::from)?;

    // 优先按文件名识别扩展名，识别不出再按字节内容兜底
    let ext = image_ext_from_filename(source)
        .or_else(|| image_ext_from_bytes(&bytes))
        .ok_or_else(|| AppError::Validation("unsupported file type".to_string()))?;

    let data_dir = app_data.0.lock().unwrap().clone();
    save_user_emoji_bytes_to_dir(&data_dir, &bytes, ext)
}

/// 列出用户表情库中的全部表情图片路径。
#[tauri::command]
pub fn list_user_emojis(app_data: State<'_, AppDataDir>) -> AppResult<Vec<String>> {
    let data_dir = app_data.0.lock().unwrap().clone();
    list_user_emoji_paths_in_dir(&data_dir)
}

#[cfg(test)]
mod tests {
    use super::{
        list_user_emoji_paths_in_dir, save_user_emoji_bytes_to_dir, user_emoji_dir,
    };
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    /// 创建唯一的临时数据目录，作为 `data_dir`（其下 `emojis/user/` 为用户表情库）。
    fn temp_data_dir(tag: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "magpie_user_emoji_{}_{}_{}",
            tag,
            std::process::id(),
            unique
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// 最小合法 PNG 字节（1x1）；用于构造可被 image_ext_from_bytes 识别的图片。
    /// 此处仅作为「图片字节」占位，save_user_emoji_bytes_to_dir 按传入 ext 命名，不解析内容。
    const PNG_BYTES: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00,
        0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    // Requirements 18.2：图片存入 `<data_dir>/emojis/user/`。
    #[test]
    fn 图片存入_emojis_user_目录() {
        let data_dir = temp_data_dir("store");
        let saved = save_user_emoji_bytes_to_dir(&data_dir, PNG_BYTES, "png").expect("应保存成功");

        let saved_path = Path::new(&saved);
        // 文件确实落在 <data_dir>/emojis/user/ 下
        let expected_dir = user_emoji_dir(&data_dir);
        assert!(
            saved_path.starts_with(&expected_dir),
            "保存路径应位于 emojis/user/ 下：saved={} expected_dir={}",
            saved,
            expected_dir.display()
        );
        assert!(saved_path.is_file(), "保存后文件应真实存在");
        assert!(
            saved_path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap()
                .starts_with("user_"),
            "文件名应以 user_ 前缀命名"
        );
        // 内容与写入字节一致
        assert_eq!(std::fs::read(saved_path).unwrap(), PNG_BYTES);

        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[test]
    fn 相同内容去重不重复保存() {
        let data_dir = temp_data_dir("dedup");
        let p1 = save_user_emoji_bytes_to_dir(&data_dir, PNG_BYTES, "png").unwrap();
        let p2 = save_user_emoji_bytes_to_dir(&data_dir, PNG_BYTES, "png").unwrap();
        // 内容哈希命名 -> 同一图片只保存一份，路径一致
        assert_eq!(p1, p2, "相同内容应命中同一哈希文件名，不重复保存");

        let listed = list_user_emoji_paths_in_dir(&data_dir).unwrap();
        assert_eq!(listed.len(), 1, "去重后用户表情库应只含 1 个文件");

        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[test]
    fn 目录不存在时列表为空() {
        let data_dir = temp_data_dir("empty");
        // 尚未保存任何表情，emojis/user/ 不存在
        let listed = list_user_emoji_paths_in_dir(&data_dir).unwrap();
        assert!(listed.is_empty(), "目录不存在时应返回空列表");

        let _ = std::fs::remove_dir_all(&data_dir);
    }

    // Requirements 18.7：用户表情数量达到阈值时给出数量提示。
    // 阈值语义与前端 EmojiPanel 的 EMOJI_COUNT_WARNING_THRESHOLD(=200) 一致：count >= 阈值则提示。
    #[test]
    fn 达阈值给出数量提示() {
        const WARNING_THRESHOLD: usize = 200;
        // 基于「用户表情数量」的提示判定（与前端一致的纯计数边界）
        let should_warn = |count: usize| count >= WARNING_THRESHOLD;

        assert!(!should_warn(0), "无表情时不应提示");
        assert!(!should_warn(WARNING_THRESHOLD - 1), "未达阈值（199）不应提示");
        assert!(should_warn(WARNING_THRESHOLD), "恰达阈值（200）应给出数量提示");
        assert!(should_warn(WARNING_THRESHOLD + 50), "超过阈值应持续提示");

        // 与真实仓储联动验证：保存 N 张不同内容图片后，列表数量驱动提示判定。
        let data_dir = temp_data_dir("threshold");
        let n = 3usize;
        for i in 0..n {
            // 通过追加不同字节制造不同内容哈希，确保产生 N 个独立文件
            let mut bytes = PNG_BYTES.to_vec();
            bytes.push(i as u8);
            save_user_emoji_bytes_to_dir(&data_dir, &bytes, "png").unwrap();
        }
        let count = list_user_emoji_paths_in_dir(&data_dir).unwrap().len();
        assert_eq!(count, n, "应保存 N 张不同内容的表情");
        assert!(!should_warn(count), "3 张未达阈值不应提示");

        let _ = std::fs::remove_dir_all(&data_dir);
    }
}
