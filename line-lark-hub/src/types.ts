// src/types.ts

export interface Env {
  // D1 Database
  DB: D1Database;
  // KV Namespace
  KV: KVNamespace;
  // LINE
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_TOKEN: string;
  // Lark
  LARK_APP_ID: string;
  LARK_APP_SECRET: string;
  LARK_BOT_WEBHOOK_URL: string;
  LARK_BASE_APP_TOKEN: string;
  LARK_BASE_TABLE_ID: string;
}

// ========================================
// LINE Webhook イベント型
// ========================================
export interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

export interface LineEvent {
  type: string;
  timestamp: number;
  source: {
    type: string;
    userId: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  postback?: {
    data: string;
  };
}

// ========================================
// D1 ユーザーレコード型
// ========================================
export interface UserRecord {
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  status: string; // 'active' | 'blocked' | 'unfollowed'
  tags: string;   // JSON array string: '["tag1","tag2"]'
  segment: string | null;
  richmenu_id: string | null;
  followed_at: string;
  last_action_at: string;
  created_at: string;
  updated_at: string;
}
