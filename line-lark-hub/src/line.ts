// src/line.ts
import { Env } from './types';

/**
 * LINE Webhook署名検証
 * X-Line-Signature ヘッダーの HMAC-SHA256 を検証する
 */
export async function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hash = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return hash === signature;
}

/**
 * LINEユーザーのプロフィールを取得
 */
export async function getLineProfile(
  userId: string,
  token: string
): Promise<{ displayName: string; pictureUrl?: string } | null> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json() as { displayName: string; pictureUrl?: string };
  } catch {
    return null;
  }
}

/**
 * LINEにリプライメッセージを送信
 */
export async function replyMessage(
  replyToken: string,
  messages: Array<{ type: string; text: string }>,
  token: string
): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

/**
 * LINEにプッシュメッセージを送信（通数1カウント）
 */
export async function pushMessage(
  to: string,
  messages: Array<{ type: string; text: string }>,
  token: string
): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  });
}
