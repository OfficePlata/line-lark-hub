// src/index.ts
import { Env, LineWebhookBody, LineEvent } from './types';
import { verifyLineSignature, getLineProfile, replyMessage } from './line';
import { notifyLarkBot, syncUserToBase } from './lark';
import { initDatabase, upsertUser, logEvent, getUserStats } from './db';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ========================================
    // ルーティング
    // ========================================
    switch (url.pathname) {
      case '/webhook/line':
        return handleLineWebhook(request, env, ctx);

      case '/api/init-db':
        // 初回のみ実行：D1テーブル作成
        await initDatabase(env.DB);
        return jsonResponse({ ok: true, message: 'Database initialized' });

      case '/api/stats':
        // ダッシュボード用：ユーザー統計
        const stats = await getUserStats(env.DB);
        return jsonResponse(stats);

      case '/health':
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });

      default:
        return new Response('Not Found', { status: 404 });
    }
  },

  // Phase 3 で使用：ステップ配信スケジューラ
  // async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  //   // Cron Trigger で定期実行
  // },
};

// ========================================
// LINE Webhook メインハンドラー
// ========================================
async function handleLineWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // POST のみ受付
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // ① 署名検証
  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';
  const valid = await verifyLineSignature(body, signature, env.LINE_CHANNEL_SECRET);

  if (!valid) {
    console.error('Invalid LINE signature');
    return new Response('Unauthorized', { status: 401 });
  }

  // ② イベント解析
  const webhook: LineWebhookBody = JSON.parse(body);

  // 各イベントを非同期で処理（レスポンスは先に返す）
  ctx.waitUntil(
    Promise.all(
      webhook.events.map((event) => processEvent(event, env))
    )
  );

  // LINE には即座に 200 を返す
  return new Response('OK', { status: 200 });
}

// ========================================
// イベント振り分け処理
// ========================================
async function processEvent(event: LineEvent, env: Env): Promise<void> {
  const userId = event.source.userId;
  if (!userId) return;

  try {
    switch (event.type) {
      case 'follow':
        await handleFollow(userId, event, env);
        break;

      case 'unfollow':
        await handleUnfollow(userId, env);
        break;

      case 'message':
        await handleMessage(userId, event, env);
        break;

      case 'postback':
        await handlePostback(userId, event, env);
        break;

      default:
        // その他のイベントはログのみ
        await logEvent(env.DB, userId, event.type);
    }
  } catch (e) {
    console.error(`Error processing ${event.type} for ${userId}:`, e);
  }
}

// ========================================
// 友だち追加
// ========================================
async function handleFollow(
  userId: string,
  event: LineEvent,
  env: Env
): Promise<void> {
  // LINEプロフィール取得
  const profile = await getLineProfile(userId, env.LINE_CHANNEL_TOKEN);

  // ③ D1にユーザー保存
  const user = await upsertUser(env.DB, {
    line_user_id: userId,
    display_name: profile?.displayName || null,
    picture_url: profile?.pictureUrl || null,
    status: 'active',
  });

  // ログ記録
  await logEvent(env.DB, userId, 'follow');

  // ④ Lark Bot で管理者通知（通数ゼロ！）
  await notifyLarkBot(env.LARK_BOT_WEBHOOK_URL, {
    title: '🎉 友だち追加',
    content: `**${profile?.displayName || '(名前未取得)'}** さんが友だち追加しました`,
    color: 'green',
    fields: [
      { label: 'User ID', value: userId.substring(0, 12) + '...' },
      { label: 'ステータス', value: 'active' },
    ],
  });

  // ⑤ Lark BASE にユーザー同期
  if (user) {
    await syncUserToBase(env, {
      line_user_id: user.line_user_id,
      display_name: user.display_name,
      status: user.status,
      followed_at: user.followed_at,
      last_action_at: user.last_action_at,
      tags: user.tags,
    });
  }
}

// ========================================
// ブロック（友だち解除）
// ========================================
async function handleUnfollow(userId: string, env: Env): Promise<void> {
  await upsertUser(env.DB, {
    line_user_id: userId,
    status: 'blocked',
  });

  await logEvent(env.DB, userId, 'unfollow');

  // 管理者に通知（ブロックされたことをLarkで把握）
  await notifyLarkBot(env.LARK_BOT_WEBHOOK_URL, {
    title: '⚠️ ブロック',
    content: `ユーザーがブロック（友だち解除）しました`,
    color: 'red',
    fields: [
      { label: 'User ID', value: userId.substring(0, 12) + '...' },
    ],
  });

  // BASE のステータスも更新
  await syncUserToBase(env, {
    line_user_id: userId,
    display_name: null,
    status: 'blocked',
    followed_at: '',
    last_action_at: new Date().toISOString(),
    tags: '[]',
  });
}

// ========================================
// メッセージ受信
// ========================================
async function handleMessage(
  userId: string,
  event: LineEvent,
  env: Env
): Promise<void> {
  const text = event.message?.text || '';

  // D1更新（last_action_at）
  await upsertUser(env.DB, { line_user_id: userId });
  await logEvent(env.DB, userId, 'message', { text });

  // 管理者通知（Larkへ → 通数ゼロ）
  await notifyLarkBot(env.LARK_BOT_WEBHOOK_URL, {
    title: '💬 メッセージ受信',
    content: `**内容:** ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
    color: 'blue',
    fields: [
      { label: 'User ID', value: userId.substring(0, 12) + '...' },
      { label: '種別', value: event.message?.type || 'unknown' },
    ],
  });

  // ここに自動応答ロジックを追加（Phase 2）
  // 例: キーワードマッチ → タグ付与 → リッチメニュー切替
}

// ========================================
// Postback 受信
// ========================================
async function handlePostback(
  userId: string,
  event: LineEvent,
  env: Env
): Promise<void> {
  const data = event.postback?.data || '';

  await upsertUser(env.DB, { line_user_id: userId });
  await logEvent(env.DB, userId, 'postback', { data });

  // 管理者通知
  await notifyLarkBot(env.LARK_BOT_WEBHOOK_URL, {
    title: '🔘 Postback受信',
    content: `**Data:** ${data}`,
    color: 'yellow',
    fields: [
      { label: 'User ID', value: userId.substring(0, 12) + '...' },
    ],
  });

  // Postback の data に応じた処理を追加（Phase 2）
  // 例: action=menu_tap&item=service → タグ「興味:サービス」付与
}

// ========================================
// ユーティリティ
// ========================================
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
