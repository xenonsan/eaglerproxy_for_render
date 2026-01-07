import { ServerDeviceCodeResponse, auth } from "../auth.js";
import { config } from "../config.js";

const LINK_STR = `
<!doctype html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connect - EaglerProxy</title>
    <style>
        :root {
            --bg: #ffffff;
            --text: #111827;
            --muted: #6b7280;
            --accent: #059669;
            --border: #e5e7eb;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #000000;
                --text: #f9fafb;
                --muted: #9ca3af;
                --border: #262626;
            }
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            line-height: 1.5;
        }
        .container {
            max-width: 480px;
            width: 90%;
            padding: 2rem;
        }
        h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; letter-spacing: -0.025em; }
        p { color: var(--muted); margin-bottom: 2rem; font-size: 0.95rem; }
        .box {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.25rem;
            margin-bottom: 1.5rem;
        }
        .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 0.5rem; display: block; }
        code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.85rem;
            color: var(--accent);
            word-break: break-all;
            display: block;
            margin-bottom: 1rem;
        }
        .btn {
            background: var(--text);
            color: var(--bg);
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
        }
        .btn:hover { opacity: 0.85; }
        .warn {
            font-size: 0.875rem;
            color: #d97706;
            border: 1px solid rgba(217, 119, 6, 0.2);
            background: rgba(217, 119, 6, 0.05);
            padding: 1rem;
            border-radius: 8px;
            margin-top: 2rem;
        }
    </style>
    <script>
      window.addEventListener("load", () => {
        const u = new URLSearchParams(window.location.search).get("url");
        if (!u) {
            document.body.innerHTML = "URL missing";
            return;
        }
        
        try {
            const p = new URL(u), s = JSON.parse(p.searchParams.get("session"));
            if (s.expires_on < Date.now()) {
                document.getElementById("status").innerText = "⚠️ セッションの期限が切れています。リロードして新しいリンクを取得してください。";
                document.getElementById("status").style.color = "#dc2626";
            }
        } catch (e) {}
      
        const f = u.replace("wss:", window.location.protocol == "https:" ? "wss:" : "ws:");
        document.getElementById("c1").innerText = f;
        
        const v = new URL(u);
        document.getElementById("c2").innerText = 
            "vanilla+online://" + v.searchParams.get("ip") + ":" + v.searchParams.get("port") + "/?session=" + v.searchParams.get("session");
      });

      function copy(id, b) {
          const t = document.getElementById(id).innerText;
          navigator.clipboard.writeText(t).then(() => {
              const o = b.innerText;
              b.innerText = "コピーしました";
              setTimeout(() => b.innerText = o, 2000);
          });
      }
    </script>
</head>
<body>
    <div class="container">
      <h1>サーバーに接続</h1>
      <p id="status">以下のアドレスを使用して EaglercraftX から接続してください。</p>

      <div class="box">
        <span class="label">標準接続URL</span>
        <code id="c1">loading...</code>
        <button class="btn" onclick="copy('c1', this)">コピー</button>
      </div>

      <div class="box">
        <span class="label">Vanilla プロトコル対応URL</span>
        <code id="c2">loading...</code>
        <button class="btn" onclick="copy('c2', this)">コピー</button>
      </div>

      <div class="warn">
        <strong>セッションについて:</strong> セッションには有効期限があります。期限切れの場合は再度ログインが必要です。
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
