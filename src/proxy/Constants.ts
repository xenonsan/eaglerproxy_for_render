import * as meta from "../meta.js";

export namespace Constants {
    export const EAGLERCRAFT_SKIN_CHANNEL_NAME: string = "EAG|Skins-1.8";
    export const MAGIC_ENDING_SERVER_SKIN_DOWNLOAD_BUILTIN: number[] = [0x00, 0x00, 0x00];
    export const MAGIC_ENDING_CLIENT_UPLOAD_SKIN_BUILTIN: number[] = [0x00, 0x05, 0x01, 0x00, 0x00, 0x00];
    export const EAGLERCRAFT_SKIN_CUSTOM_LENGTH = 64 ** 2 * 4;

    export const JOIN_SERVER_PACKET = 0x01;
    export const PLAYER_LOOK_PACKET = 0x08;

    export const ICON_SQRT = 64;
    export const END_BUFFER_LENGTH = ICON_SQRT ** 8;
    export const IMAGE_DATA_PREPEND = "data:image/png;base64,";
}

export const UPGRADE_REQUIRED_RESPONSE = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EaglerProxy</title>
    <style>
        :root {
            --bg: #ffffff;
            --text: #111827;
            --muted: #6b7280;
            --accent: #2563eb;
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
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-bottom: 1.5rem;
        }
        code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.9rem;
            color: var(--accent);
            word-break: break-all;
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
            text-align: center;
        }
        .btn:hover { opacity: 0.85; }
        .steps { font-size: 0.875rem; color: var(--muted); }
        .steps ol { padding-left: 1.25rem; margin-top: 0.5rem; }
        .footer { margin-top: 3rem; font-size: 0.75rem; color: var(--muted); }
    </style>
    <script>
        window.addEventListener('load', () => {
            const url = window.location.href.replace(window.location.protocol, window.location.protocol == "https:" ? "wss:" : "ws:");
            document.getElementById("u").innerText = url;
        });
        function copy() {
            const t = document.getElementById("u").innerText;
            navigator.clipboard.writeText(t).then(() => {
                const b = document.querySelector('.btn');
                const o = b.innerText;
                b.innerText = 'コピーしました';
                setTimeout(() => b.innerText = o, 2000);
            });
        }
    </script>
</head>
<body>
    <div class="container">
        <h1>EaglerProxy</h1>
        <p>このページからは接続できません。以下の手順で参加してください。</p>
        
        <div class="box">
            <code id="u">loading...</code>
            <button class="btn" onclick="copy()">アドレスをコピー</button>
        </div>

        <div class="steps">
            <strong>接続方法:</strong>
            <ol>
                <li>EaglercraftX クライアントを開く</li>
                <li>[マルチプレイ] > [ダイレクト接続] を選択</li>
                <li>コピーしたアドレスを貼り付けて参加</li>
            </ol>
        </div>

        <div class="footer">
            ${meta.PROXY_BRANDING} ${meta.PROXY_VERSION}
        </div>
    </div>
</body>
</html>`;
