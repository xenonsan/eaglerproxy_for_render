import { ServerDeviceCodeResponse, auth } from "../auth.js";
import { config } from "../config.js";

const LINK_STR = `
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EagPAAS - サーバー接続</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #10b981;
            --bg: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --text: #f8fafc;
            --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg);
            background-image: 
                radial-gradient(circle at 0% 0%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 100% 100%, rgba(99, 102, 241, 0.1) 0%, transparent 50%);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 1rem;
        }
        .container {
            max-width: 600px;
            width: 100%;
            padding: 2.5rem;
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.8s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        h1 { font-size: 2rem; font-weight: 600; margin-bottom: 1.5rem; text-align: center; }
        .info-card {
            background: rgba(15, 23, 42, 0.8);
            padding: 1.5rem;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            margin-bottom: 1.5rem;
        }
        .label { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block; }
        code {
            font-family: 'Consolas', monospace;
            color: var(--primary);
            font-size: 1rem;
            word-break: break-all;
            display: block;
            margin-bottom: 1rem;
            background: rgba(0, 0, 0, 0.2);
            padding: 0.75rem;
            border-radius: 8px;
        }
        .copy-btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 0.6rem 1rem;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
            width: 100%;
        }
        .copy-btn:hover { opacity: 0.9; transform: translateY(-1px); background: #059669; }
        .copy-btn:active { transform: translateY(0); }
        .warning {
            color: #fbbf24;
            font-size: 0.9rem;
            padding: 1rem;
            background: rgba(251, 191, 36, 0.1);
            border-radius: 12px;
            margin-top: 1.5rem;
            line-height: 1.5;
        }
    </style>
    <script type="text/javascript">
      window.addEventListener("load", () => {
        let param = new URLSearchParams(window.location.search),
            url = param.get("url")
        if (url == null) {
            document.body.innerHTML = "<div class='container'><h1>エラー</h1><p style='text-align:center'>URLが見つかりません</p></div>";
            return;
        }
        
        try {
            const parsed = new URL(url), session = JSON.parse(parsed.searchParams.get("session"))
            if (session.expires_on < Date.now()) {
                document.getElementById("status-msg").innerHTML = "⚠️ セッションの期限が切れています！新しいリンクを取得してください。";
                document.getElementById("status-msg").style.color = "#ef4444";
            }
        } catch (_e) {
            console.error(_e)
        }
      
        const finalUrl = url.replace("wss:", window.location.protocol == "https:" ? "wss:" : "ws:");
        document.getElementById("connect-url").innerText = finalUrl;
        
        const parsedURL = new URL(url)
        document.getElementById("connect-url-vanilla").innerText = 
            "vanilla+online://" + parsedURL.searchParams.get("ip") + ":" + parsedURL.searchParams.get("port") + "/?session=" + parsedURL.searchParams.get("session")
      })

      function copyText(id, btn) {
          const text = document.getElementById(id).innerText;
          navigator.clipboard.writeText(text).then(() => {
              const original = btn.innerText;
              btn.innerText = "コピー完了！";
              setTimeout(() => btn.innerText = original, 2000);
          });
      }
    </script>
  </head>
  <body>
    <div class="container">
      <h1>サーバーに接続</h1>
      <p id="status-msg" style="text-align: center; margin-bottom: 1.5rem; color: var(--text-muted);">
        以下のURLを使用して EaglercraftX から接続してください。
      </p>

      <div class="info-card">
        <span class="label">標準接続URL (Direct Connect 用)</span>
        <code id="connect-url">読み込み中...</code>
        <button class="copy-btn" onclick="copyText('connect-url', this)">URLをコピー</button>
      </div>

      <div class="info-card">
        <span class="label">Vanilla プロトコル対応URL (対応クライアント用)</span>
        <code id="connect-url-vanilla">読み込み中...</code>
        <button class="copy-btn" onclick="copyText('connect-url-vanilla', this)">URLをコピー</button>
      </div>

      <div class="warning">
        <strong>注意:</strong> セッションには有効期限があります。期限が切れた場合は、再度プロキシ経由でログインする必要があります。
      </div>
    </div>
  </body>
</html>
`;

export async function registerEndpoints() {
  const proxy = PLUGIN_MANAGER.proxy;
  proxy.on("httpConnection", (req, res, ctx) => {
    if (req.url.startsWith("/eagpaas/link")) {
      ctx.handled = true;
      res.setHeader("Content-Type", "text/html").writeHead(200).end(LINK_STR);
    } else if (req.url.startsWith("/eagpaas/metadata")) {
      ctx.handled = true;
      res.writeHead(200).end(
        JSON.stringify({
          branding: "EagProxyAAS",
          version: "1",
        })
      );
    } else if (req.url.startsWith("/eagpaas/validate")) {
      ctx.handled = true;
      if (config.authentication.enabled) {
        if (req.headers["authorization"] !== `Basic ${config.authentication.password} `) {
          return res.writeHead(403).end(
            JSON.stringify({
              success: false,
              reason: "Access Denied",
            })
          );
        }
      }
      res.writeHead(200).end(
        JSON.stringify({
          success: true,
        })
      );
    }
  });

  proxy.on("wsConnection", (ws, req, ctx) => {
    try {
      if (req.url.startsWith("/eagpaas/token")) {
        ctx.handled = true;
        if (config.authentication.enabled) {
          if (req.headers.authorization !== `Basic ${config.authentication.password} `) {
            ws.send(
              JSON.stringify({
                type: "ERROR",
                error: "Access Denied",
              })
            );
            ws.close();
            return;
          }
        }

        const quit = { quit: false },
          authHandler = auth(quit),
          codeCallback = (code: ServerDeviceCodeResponse) => {
            ws.send(
              JSON.stringify({
                type: "CODE",
                data: code,
              })
            );
          };
        ws.once("close", () => {
          quit.quit = true;
        });
        authHandler
          .on("code", codeCallback)
          .on("error", (err) => {
            ws.send(
              JSON.stringify({
                type: "ERROR",
                reason: err,
              })
            );
            ws.close();
          })
          .on("done", (result) => {
            ws.send(
              JSON.stringify({
                type: "COMPLETE",
                data: result,
              })
            );
            ws.close();
          });
      } else if (req.url.startsWith("/eagpaas/ping")) {
        ctx.handled = true;
        if (config.authentication.enabled) {
          if (req.headers.authorization !== `Basic ${config.authentication.password} `) {
            ws.send(
              JSON.stringify({
                type: "ERROR",
                error: "Access Denied",
              })
            );
            ws.close();
            return;
          }
        }

        ws.once("message", (_) => {
          ws.send(_);
          ws.close();
        });
      }
    } catch (err) { }
  });
}
