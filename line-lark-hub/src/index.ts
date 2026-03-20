export interface Env {
  KV: KVNamespace;
  DB: D1Database;
  // 後ほどLINEやLarkのAPIキーをここに定義します
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. URLのパスがルート(/)以外、またはPOST以外のリクエストは弾く
    if (request.method !== "POST") {
      return new Response("Sasa-Yell Webhook Server is running!", { status: 200 });
    }

    try {
      // 2. LINEから送られてきたJSONデータを読み込む
      const body = await request.json<any>();

      // 3. イベントの中身を確認して振り分ける
      if (body.events && body.events.length > 0) {
        for (const event of body.events) {
          const userId = event.source.userId;

          // パターンA: ユーザーからテキストメッセージが送られてきた時
          if (event.type === "message" && event.message.type === "text") {
            const text = event.message.text;
            console.log(`💬 [メッセージ受信] ユーザーID: ${userId}`);
            console.log(`📝 内容: ${text}`);
            
            // 👉 次のステップで、ここに「Larkへ通知を送る処理」を書きます
          }

          // パターンB: リッチメニューのタブやボタンが押された時
          else if (event.type === "postback") {
            const postbackData = event.postback.data;
            console.log(`👆 [ポストバック受信] ユーザーID: ${userId}`);
            console.log(`📊 データ: ${postbackData}`);
            
            // 👉 次のステップで、ここに「Larkのタグ更新」や「メニュー切り替え処理」を書きます
          }
        }
      }

      // 4. LINEのサーバーに「無事に受け取りました」という200番の返事をする（必須）
      return new Response("OK", { status: 200 });

    } catch (error) {
      console.error("エラーが発生しました:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
