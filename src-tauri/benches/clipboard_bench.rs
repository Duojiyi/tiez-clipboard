// Magpie 剪贴板核心操作基准测试（C1 / 需求 20.1、20.2）
//
// 覆盖三个核心操作：
//   - get_history(0, 100)
//   - search("keyword", 1000 条预填充数据)
//   - insert_clipboard()
//
// 设计说明：
// `benches/` 目标只能链接到库 crate（magpie_lib，当前为占位入口），
// 而仓储逻辑（database / clipboard_repo）声明在二进制 crate（main.rs）中，
// 无法直接从基准里调用。因此本基准在临时 SQLite 上**精确复现**真实查询路径：
//   - 表结构与索引镜像自 `infrastructure/repository/migrations.rs` 迁移完成后的最终状态；
//   - get_history / search / insert 的 SQL 逐字复制自
//     `infrastructure/repository/clipboard_repo.rs` 的默认（非 portable）代码路径。
// 这样基准测得的数据库查询成本与真实运行路径一致。

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use rusqlite::{params, Connection};
use std::path::PathBuf;

/// 与 `crate::database::SENSITIVE_TAGS` 保持一致的敏感标签集合，
/// 用于复现 search 默认路径里的「排除敏感条目」子查询。
const SENSITIVE_TAGS: &[&str] = &["sensitive", "密码"];

/// 临时数据库：用进程内唯一文件名落到系统临时目录，析构时清理 db / wal / shm。
struct TempDb {
    path: PathBuf,
    conn: Connection,
}

impl TempDb {
    /// 打开临时数据库，套用与 `init_db` 相同的 pragma，并建好镜像 schema。
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("magpie_bench_{}.db", uuid::Uuid::new_v4()));
        let conn = Connection::open(&path).expect("打开临时基准数据库失败");
        // 镜像 database::init_db 的性能 pragma
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA auto_vacuum = FULL;
            ",
        )
        .expect("设置 pragma 失败");
        create_schema(&conn);
        Self { path, conn }
    }
}

impl Drop for TempDb {
    fn drop(&mut self) {
        // 显式关闭连接后清理磁盘残留文件
        let _ = std::fs::remove_file(&self.path);
        let _ = std::fs::remove_file(format!("{}-wal", self.path.display()));
        let _ = std::fs::remove_file(format!("{}-shm", self.path.display()));
    }
}

/// 建立与 migrations.rs 迁移完成后一致的最终表结构与索引。
fn create_schema(conn: &Connection) {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS clipboard_history (
            id INTEGER PRIMARY KEY,
            content_type TEXT NOT NULL,
            content TEXT NOT NULL,
            source_app TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            preview TEXT NOT NULL,
            is_pinned INTEGER NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '[]',
            use_count INTEGER NOT NULL DEFAULT 0,
            pinned_order INTEGER NOT NULL DEFAULT 0,
            content_hash INTEGER NOT NULL DEFAULT 0,
            html_content TEXT,
            is_external INTEGER NOT NULL DEFAULT 0,
            source_app_path TEXT
        );
        CREATE TABLE IF NOT EXISTS entry_tags (
            entry_id INTEGER NOT NULL,
            tag TEXT NOT NULL,
            PRIMARY KEY (entry_id, tag)
        );
        CREATE INDEX IF NOT EXISTS idx_clipboard_history_pinned_order_time
            ON clipboard_history (is_pinned, pinned_order, timestamp);
        CREATE INDEX IF NOT EXISTS idx_clipboard_history_type_hash
            ON clipboard_history (content_type, content_hash);
        CREATE INDEX IF NOT EXISTS idx_clipboard_history_timestamp
            ON clipboard_history (timestamp);
        CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags (tag);
        CREATE INDEX IF NOT EXISTS idx_entry_tags_entry ON entry_tags (entry_id);
        ",
    )
    .expect("创建基准 schema 失败");
}

/// 预填充 count 条文本记录；每 10 条混入一条含 "keyword" 的内容，
/// 以保证 search 基准能命中结果。同时为部分条目写入 entry_tags。
fn seed_entries(conn: &Connection, count: i64) {
    let tx = conn.unchecked_transaction().expect("开启事务失败");
    for i in 0..count {
        let content = if i % 10 == 0 {
            format!("benchmark entry {i} contains keyword in body")
        } else {
            format!("benchmark entry {i} with some sample clipboard text")
        };
        let tags_json = if i % 5 == 0 { "[\"work\"]" } else { "[]" };
        tx.execute(
            "INSERT INTO clipboard_history (content_type, content, html_content, source_app, timestamp, preview, is_pinned, content_hash, tags, is_external, pinned_order, source_app_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                "text",
                content,
                Option::<String>::None,
                "BenchApp",
                1_700_000_000_000_i64 + i,
                format!("preview {i}"),
                0_i32,
                i,
                tags_json,
                0_i32,
                0_i64,
                Option::<String>::None
            ],
        )
        .expect("预填充插入失败");
        if i % 5 == 0 {
            let id = tx.last_insert_rowid();
            let _ = tx.execute(
                "INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?1, ?2)",
                params![id, "work"],
            );
        }
    }
    tx.commit().expect("提交预填充事务失败");
}

/// 复现 clipboard_repo::get_history 无 content_type 过滤的查询路径。
fn run_get_history(conn: &Connection, limit: i32, offset: i32) -> usize {
    let mut stmt = conn
        .prepare(
            "SELECT id, content_type, content, html_content, source_app, timestamp, preview, is_pinned, tags, use_count, is_external, pinned_order, source_app_path
             FROM clipboard_history
             ORDER BY is_pinned DESC, pinned_order DESC, timestamp DESC, id DESC
             LIMIT ? OFFSET ?",
        )
        .expect("准备 get_history 语句失败");
    let rows = stmt
        .query_map(params![limit, offset], |row| {
            let tags_str: String = row.get(8).unwrap_or_else(|_| "[]".to_string());
            // 镜像真实路径中对 tags JSON 的反序列化开销
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            let id: i64 = row.get(0)?;
            let content: String = row.get(2)?;
            Ok((id, content, tags))
        })
        .expect("执行 get_history 查询失败");
    rows.filter_map(|r| r.ok()).count()
}

/// 复现 clipboard_repo::search 默认（非 portable）非敏感条目的查询路径。
fn run_search(conn: &Connection, term: &str, limit: i32) -> usize {
    let sensitive_tags_sql = {
        let parts: Vec<String> = SENSITIVE_TAGS
            .iter()
            .map(|t| format!("'{}'", t.replace('\'', "''")))
            .collect();
        format!("({})", parts.join(","))
    };
    let sql = format!(
        "SELECT DISTINCT ch.id, ch.content_type, ch.content, ch.html_content, ch.source_app, ch.timestamp, ch.preview, ch.is_pinned, ch.tags, ch.use_count, ch.is_external, ch.pinned_order, ch.source_app_path
         FROM clipboard_history ch
         LEFT JOIN entry_tags et ON ch.id = et.entry_id
         WHERE NOT EXISTS (
             SELECT 1 FROM entry_tags se
             WHERE se.entry_id = ch.id
               AND se.tag COLLATE NOCASE IN {}
         )
           AND (
             ch.content LIKE '%' || ?1 || '%'
             OR ch.source_app LIKE '%' || ?1 || '%'
             OR et.tag LIKE '%' || ?1 || '%'
           )
         ORDER BY ch.timestamp DESC, ch.id DESC
         LIMIT ?2",
        sensitive_tags_sql
    );
    let mut stmt = conn.prepare(&sql).expect("准备 search 语句失败");
    let term_norm = term.trim().to_lowercase();
    let rows = stmt
        .query_map(params![term_norm, limit], |row| {
            let id: i64 = row.get(0)?;
            let content: String = row.get(2)?;
            Ok((id, content))
        })
        .expect("执行 search 查询失败");
    rows.filter_map(|r| r.ok()).count()
}

/// 复现 clipboard_repo::save_with_conn 的新增条目 INSERT 路径（含一条标签同步）。
fn run_insert(conn: &Connection, seq: i64) {
    conn.execute(
        "INSERT INTO clipboard_history (content_type, content, html_content, source_app, timestamp, preview, is_pinned, content_hash, tags, is_external, pinned_order, source_app_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            "text",
            format!("inserted clipboard content number {seq}"),
            Option::<String>::None,
            "BenchApp",
            1_800_000_000_000_i64 + seq,
            format!("preview {seq}"),
            0_i32,
            seq,
            "[\"work\"]",
            0_i32,
            0_i64,
            Option::<String>::None
        ],
    )
    .expect("insert 失败");
    let id = conn.last_insert_rowid();
    let _ = conn.execute(
        "INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?1, ?2)",
        params![id, "work"],
    );
}

fn bench_get_history(c: &mut Criterion) {
    let db = TempDb::new();
    seed_entries(&db.conn, 1000);
    c.bench_function("get_history(0,100)", |b| {
        b.iter(|| {
            let n = run_get_history(black_box(&db.conn), black_box(100), black_box(0));
            black_box(n);
        })
    });
}

fn bench_search(c: &mut Criterion) {
    let db = TempDb::new();
    seed_entries(&db.conn, 1000);
    c.bench_function("search('keyword', 1000条)", |b| {
        b.iter(|| {
            let n = run_search(black_box(&db.conn), black_box("keyword"), black_box(200));
            black_box(n);
        })
    });
}

fn bench_insert(c: &mut Criterion) {
    let db = TempDb::new();
    let mut seq: i64 = 0;
    c.bench_function("insert_clipboard()", |b| {
        b.iter(|| {
            run_insert(black_box(&db.conn), black_box(seq));
            seq += 1;
        })
    });
}

criterion_group!(benches, bench_get_history, bench_search, bench_insert);
criterion_main!(benches);
