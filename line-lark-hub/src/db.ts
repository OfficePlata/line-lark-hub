// src/db.ts
import { Env, UserRecord } from './types';

/**
 * D1 テーブル初期化（初回デプロイ時に実行）
 * wrangler d1 execute line-lark-db --file=./schema.sql でも可
 */
export async function initDatabase(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      line_user_id   TEXT PRIMARY KEY,
      display_name   TEXT,
      picture_url    TEXT,
      status         TEXT DEFAULT 'active',
      tags           TEXT DEFAULT '[]',
      segment        TEXT,
      richmenu_id    TEXT,
      followed_at    TEXT,
      last_action_at TEXT,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event_logs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id   TEXT,
      event_type     TEXT,
      event_data     TEXT,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_users_segment ON users(segment);
    CREATE INDEX IF NOT EXISTS idx_event_logs_user ON event_logs(line_user_id);
    CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
  `);
}

/**
 * ユーザーを upsert（追加 or 更新）
 */
export async function upsertUser(
  db: D1Database,
  data: {
    line_user_id: string;
    display_name?: string | null;
    picture_url?: string | null;
    status?: string;
  }
): Promise<UserRecord | null> {
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO users (line_user_id, display_name, picture_url, status, followed_at, last_action_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?5)
       ON CONFLICT(line_user_id) DO UPDATE SET
         display_name = COALESCE(?2, display_name),
         picture_url  = COALESCE(?3, picture_url),
         status       = COALESCE(?4, status),
         last_action_at = ?5,
         updated_at     = ?5`
    )
    .bind(
      data.line_user_id,
      data.display_name || null,
      data.picture_url || null,
      data.status || 'active',
      now
    )
    .run();

  return getUser(db, data.line_user_id);
}

/**
 * ユーザーを取得
 */
export async function getUser(
  db: D1Database,
  lineUserId: string
): Promise<UserRecord | null> {
  return db
    .prepare('SELECT * FROM users WHERE line_user_id = ?1')
    .bind(lineUserId)
    .first<UserRecord>();
}

/**
 * ユーザーのタグを更新
 */
export async function updateUserTags(
  db: D1Database,
  lineUserId: string,
  tags: string[]
): Promise<void> {
  await db
    .prepare('UPDATE users SET tags = ?1, updated_at = ?2 WHERE line_user_id = ?3')
    .bind(JSON.stringify(tags), new Date().toISOString(), lineUserId)
    .run();
}

/**
 * イベントログを記録
 */
export async function logEvent(
  db: D1Database,
  lineUserId: string,
  eventType: string,
  eventData: Record<string, unknown> = {}
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO event_logs (line_user_id, event_type, event_data) VALUES (?1, ?2, ?3)'
    )
    .bind(lineUserId, eventType, JSON.stringify(eventData))
    .run();
}

/**
 * セグメント別ユーザー数を取得（ダッシュボード用）
 */
export async function getUserStats(
  db: D1Database
): Promise<{ total: number; active: number; blocked: number }> {
  const result = await db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
       FROM users`
    )
    .first<{ total: number; active: number; blocked: number }>();
  return result || { total: 0, active: 0, blocked: 0 };
}
