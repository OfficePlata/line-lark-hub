# LINE × Lark 拡張ツール — セットアップガイド

## Phase 1: Webhook基盤の構築

### 前提条件

- Node.js 18以上がインストール済み
- Cloudflare アカウントあり
- LINE Developers でチャネル作成済み
- Lark（Feishu）で自作アプリ作成済み


---

### STEP 1: Wrangler セットアップ

```bash
# Wrangler インストール（まだの場合）
npm install -g wrangler

# Cloudflare にログイン
wrangler login

# プロジェクトディレクトリに移動
cd line-lark-hub
```


---

### STEP 2: D1 データベース作成

```bash
# D1 データベースを作成
wrangler d1 create line-lark-db

# ↑ 表示される database_id を wrangler.toml に貼り付け
# 例: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# スキーマを適用
wrangler d1 execute line-lark-db --file=./schema.sql
```


---

### STEP 3: KV ネームスペース作成

```bash
# KV を作成
wrangler kv namespace create LINE_LARK_KV

# ↑ 表示される id を wrangler.toml に貼り付け
```


---

### STEP 4: Secrets（環境変数）を設定

```bash
# LINE チャネルシークレット
wrangler secret put LINE_CHANNEL_SECRET
# → LINE Developers > チャネル基本設定 から取得して貼り付け

# LINE チャネルアクセストークン
wrangler secret put LINE_CHANNEL_TOKEN
# → LINE Developers > Messaging API設定 > 長期チャネルアクセストークン

# Lark アプリ情報
wrangler secret put LARK_APP_ID
wrangler secret put LARK_APP_SECRET
# → Lark 開発者コンソール > アプリ > 基本情報

# Lark Bot Webhook URL
wrangler secret put LARK_BOT_WEBHOOK_URL
# → Lark グループチャット > 設定 > ボット > カスタムBot > Webhook URL

# Lark BASE 情報
wrangler secret put LARK_BASE_APP_TOKEN
# → Lark BASE の URL から取得: https://xxx.larksuite.com/base/XXXXXXXX
wrangler secret put LARK_BASE_TABLE_ID
# → BASE テーブルの URL から取得
```


---

### STEP 5: Lark BASE テーブル準備

Lark BASE に以下のフィールドでテーブルを作成してください：

| フィールド名 | フィールドタイプ |
|---|---|
| LINE_USER_ID | テキスト |
| 表示名 | テキスト |
| ステータス | 単一選択（active / blocked） |
| 友だち追加日時 | テキスト |
| 最終アクション | テキスト |
| タグ | テキスト |

> **ポイント**: LINE_USER_ID をキーとして、Workers から自動で
> レコードが追加・更新されます。手動での入力は不要です。


---

### STEP 6: デプロイ

```bash
# ローカルで動作確認
wrangler dev

# 本番デプロイ
wrangler deploy
```

デプロイ後に表示される URL（例: `https://line-lark-hub.your-subdomain.workers.dev`）
をメモしてください。


---

### STEP 7: LINE Webhook URL を設定

1. LINE Developers にログイン
2. 対象チャネルの「Messaging API設定」を開く
3. Webhook URL に以下を設定:

```
https://line-lark-hub.your-subdomain.workers.dev/webhook/line
```

4. 「Webhookの利用」をオンにする
5. 「検証」ボタンを押して成功を確認


---

### STEP 8: 動作テスト

1. LINEで対象アカウントを友だち追加
2. 以下を確認:
   - ✅ Lark グループチャットに「友だち追加」通知カードが届く
   - ✅ Lark BASE に新しいレコードが追加される
   - ✅ `https://your-worker.workers.dev/api/stats` でユーザー数が確認できる

3. テストメッセージを送信
4. 以下を確認:
   - ✅ Lark に「メッセージ受信」通知が届く（LINE通数ゼロ！）


---

### トラブルシューティング

```bash
# ログを確認
wrangler tail

# D1 の中身を確認
wrangler d1 execute line-lark-db --command="SELECT * FROM users"
wrangler d1 execute line-lark-db --command="SELECT * FROM event_logs ORDER BY id DESC LIMIT 10"
```


---

### 次のステップ（Phase 2 で実装）

- タグマスターテーブルの設計
- セグメント条件ロジックの実装
- リッチメニュー動的切替
- キーワード自動応答の条件分岐
