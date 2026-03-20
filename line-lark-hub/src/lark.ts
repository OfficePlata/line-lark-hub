// src/lark.ts
import { Env } from './types';

// ========================================
// Lark Bot Webhook 通知（通数ゼロ！）
// 管理者グループチャットへの通知に使用
// ========================================

interface LarkNotifyOptions {
  title: string;
  content: string;
  color?: 'blue' | 'green' | 'red' | 'yellow';
  fields?: Array<{ label: string; value: string }>;
}

/**
 * Lark Bot Webhook でカード形式の通知を送信
 * → LINE通数を使わずに管理者へリアルタイム通知
 */
export async function notifyLarkBot(
  webhookUrl: string,
  options: LarkNotifyOptions
): Promise<boolean> {
  const { title, content, color = 'blue', fields = [] } = options;

  // Interactive Card 形式で送信
  const card = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: title },
        template: color,
      },
      elements: [
        {
          tag: 'markdown',
          content: content,
        },
        // フィールドがあれば追加
        ...(fields.length > 0
          ? [
              {
                tag: 'div',
                fields: fields.map((f) => ({
                  is_short: true,
                  text: {
                    tag: 'lark_md',
                    content: `**${f.label}**\n${f.value}`,
                  },
                })),
              },
            ]
          : []),
        // タイムスタンプ
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: `📍 ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
            },
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    return res.ok;
  } catch (e) {
    console.error('Lark Bot notification failed:', e);
    return false;
  }
}

// ========================================
// Lark BASE（Bitable）連携
// ユーザーマスターをBASEに同期
// ========================================

/**
 * Lark Tenant Access Token を取得
 */
async function getTenantToken(appId: string, appSecret: string): Promise<string> {
  const res = await fetch(
    'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    }
  );
  const data = (await res.json()) as { tenant_access_token: string };
  return data.tenant_access_token;
}

/**
 * Lark BASE にユーザーレコードを upsert（追加 or 更新）
 */
export async function syncUserToBase(
  env: Env,
  user: {
    line_user_id: string;
    display_name: string | null;
    status: string;
    followed_at: string;
    last_action_at: string;
    tags: string;
  }
): Promise<boolean> {
  try {
    const token = await getTenantToken(env.LARK_APP_ID, env.LARK_APP_SECRET);
    const baseUrl = `https://open.larksuite.com/open-apis/bitable/v1/apps/${env.LARK_BASE_APP_TOKEN}/tables/${env.LARK_BASE_TABLE_ID}/records`;

    // まず既存レコードを検索（LINE User ID で）
    const searchRes = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: 'LINE_USER_ID',
              operator: 'is',
              value: [user.line_user_id],
            },
          ],
        },
      }),
    });
    const searchData = (await searchRes.json()) as {
      data?: { items?: Array<{ record_id: string }> };
    };

    const fields = {
      LINE_USER_ID: user.line_user_id,
      表示名: user.display_name || '(未取得)',
      ステータス: user.status,
      友だち追加日時: user.followed_at,
      最終アクション: user.last_action_at,
      タグ: user.tags,
    };

    if (searchData.data?.items && searchData.data.items.length > 0) {
      // 既存レコード更新
      const recordId = searchData.data.items[0].record_id;
      await fetch(`${baseUrl}/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fields }),
      });
    } else {
      // 新規レコード作成
      await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fields }),
      });
    }

    return true;
  } catch (e) {
    console.error('Lark BASE sync failed:', e);
    return false;
  }
}
