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
<!-- Served by ${meta.PROXY_BRANDING} (version: ${meta.PROXY_VERSION}) -->
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${meta.PROXY_BRANDING} - 接続案内</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #6366f1;
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
                radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 100% 100%, rgba(168, 85, 247, 0.15) 0%, transparent 50%);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            overflow: hidden;
        }
        .container {
            max-width: 600px;
            width: 90%;
            padding: 2.5rem;
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            text-align: center;
            animation: fadeIn 0.8s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        h1 { font-size: 2rem; font-weight: 600; margin-bottom: 1rem; color: var(--text); }
        p { color: var(--text-muted); line-height: 1.6; margin-bottom: 2rem; font-size: 1.05rem; }
        .url-box {
            background: rgba(15, 23, 42, 0.8);
            padding: 1.25rem;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            margin-bottom: 2rem;
        }
        @media (min-width: 480px) {
            .url-box { flex-direction: row; justify-content: space-between; }
        }
        code { font-family: 'Consolas', monospace; color: var(--primary); font-size: 1.1rem; word-break: break-all; text-align: left; }
        .copy-btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 0.6rem 1.2rem;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .copy-btn:hover { opacity: 0.9; transform: scale(1.05); background: #4f46e5; }
        .copy-btn:active { transform: scale(0.98); }
        .footer { font-size: 0.875rem; color: var(--text-muted); margin-top: 1rem; }
    </style>
    <script>
        window.addEventListener('load', () => {
            const connectUrl = window.location.href.replace(window.location.protocol, window.location.protocol == "https:" ? "wss:" : "ws:");
            document.getElementById("connect-url").innerText = connectUrl;
        });
        function copyUrl() {
            const url = document.getElementById("connect-url").innerText;
            navigator.clipboard.writeText(url).then(() => {
                const btn = document.querySelector('.copy-btn');
                const original = btn.innerText;
                btn.innerText = 'コピー完了！';
                setTimeout(() => btn.innerText = original, 2000);
            });
        }
    </script>
</head>
<body>
    <div class="container">
        <h1>接続には設定が必要です</h1>
        <p>
            EaglerProxy のランディングページへようこそ。<br>
            このページから直接サーバーに参加することはできません。接続するには、EaglercraftX クライアントで以下のアドレスを使用してください。
        </p>
        <div class="url-box">
            <code id="connect-url">読み込み中...</code>
            <button class="copy-btn" onclick="copyUrl()">URLをコピー</button>
        </div>
        <p style="font-size: 0.9rem; margin-top: -1rem;">
            [マルチプレイ] > [ダイレクト接続] から接続できます。
        </p>
        <div class="footer">
            Powered by ${meta.PROXY_BRANDING} v${meta.PROXY_VERSION}
        </div>
    </div>
</body>
</html>`;
