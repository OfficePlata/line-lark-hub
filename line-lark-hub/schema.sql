-- schema.sql
-- D1データベース初期化用
-- 実行: wrangler d1 execute line-lark-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  line_user_id   TEXT PRIMARY KEY,
  display_name   TEXT,
  picture_url    TEXT,
  status         TEXT DEFAULT 'active',     -- active / blocked / unfollowed
  tags           TEXT DEFAULT '[]',          -- JSON配列: ["tag1","tag2"]
  segment        TEXT,                       -- セグメント名
  richmenu_id    TEXT,                       -- 現在適用中のリッチメニューID
  followed_at    TEXT,                       -- 友だち追加日時
  last_action_at TEXT,                       -- 最終アクション日時
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id   TEXT,
  event_type     TEXT,                       -- follow / unfollow / message / postback
  event_data     TEXT,                       -- JSON: イベント詳細
  created_at     TEXT DEFAULT (datetime('now'))
);

-- Phase 2 で追加するテーブル
-- CREATE TABLE IF NOT EXISTS tags_master (
--   tag_id    TEXT PRIMARY KEY,
--   tag_name  TEXT NOT NULL,
--   category  TEXT,
--   created_at TEXT DEFAULT (datetime('now'))
-- );
--
-- CREATE TABLE IF NOT EXISTS segments (
--   segment_id   TEXT PRIMARY KEY,
--   segment_name TEXT NOT NULL,
--   conditions   TEXT,                      -- JSON: 条件式
--   richmenu_id  TEXT,                      -- 紐づくリッチメニュー
--   created_at   TEXT DEFAULT (datetime('now'))
-- );
--
-- CREATE TABLE IF NOT EXISTS step_schedules (
--   id            INTEGER PRIMARY KEY AUTOINCREMENT,
--   line_user_id  TEXT,
--   step_name     TEXT,
--   step_index    INTEGER DEFAULT 0,
--   next_fire_at  TEXT,                     -- 次回配信予定日時
--   status        TEXT DEFAULT 'active',    -- active / completed / cancelled
--   created_at    TEXT DEFAULT (datetime('now'))
-- );

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_segment ON users(segment);
CREATE INDEX IF NOT EXISTS idx_event_logs_user ON event_logs(line_user_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
