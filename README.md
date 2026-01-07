# EaglerProxy for Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/xenonsan/eaglerproxy_for_render)

EaglerProxyを [Render.com](https://render.com) で簡単に動かせるように最適化したリポジトリです。
TypeScript 1.8.9 EaglercraftX クライアントに対応したプロキシサーバーです。

## 特徴

- **Render.com 最適化**: ポート番号の自動割り当て（環境変数 `PORT`）に完全対応。
- **簡単デプロイ**: 上記の「Deploy to Render」ボタンを押すだけでデプロイ可能。
- **EagProxyAAS 搭載**: 通常のMinecraft 1.8.9 サーバーへの接続を可能にする A-A-S プラグインを同梱。
- **最新環境対応**: TypeScript 4.9 および Node.js 18 以降で動作確認済み。

## デプロイ方法

### 1. ワンクリックデプロイ

1. 上部にある **[Deploy to Render]** ボタンをクリックします。
2. Render.com のダッシュボードが開くので、リポジトリを連携します。
3. `render.yaml` が自動的に読み込まれ、ビルドと起動が開始されます。

### 2. 手動デプロイ

1. Render.com で **Web Service** を新規作成します。
2. このリポジトリを指定します。
3. 設定を以下のように入力します：
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free` (または任意)

## 設定 (Environment Variables)

必要に応じて、Render.com の Environment 画面で以下の変数を設定できます。

| 変数名 | デフォルト値 | 説明 |
| :--- | :--- | :--- |
| `PORT` | `8080` (自動) | Renderが割り当てるポート番号です。 |
| `NODE_VERSION` | `18` | 使用する Node.js のバージョンです。 |

## 🛠 ローカル開発

ローカル環境で実行する場合は、以下の手順で行います。

```bash
# 依存関係のインストール
npm install

# ビルド (TypeScriptのコンパイル)
npm run build

# 起動
npm start
```

## 注意事項

- **接続先サーバー**: デフォルトでは `127.0.0.1:1111` に接続しようとします。実際にサーバーを運用する場合は、`src/config.ts` または EagProxyAAS の設定を変更してください。
- **無料プラン**: Render.com の無料プランを使用している場合、しばらくアクセスがないとスリープ状態になります。再起動には数十秒かかる場合があります。

---

このプロジェクトは [WorldEditAxe/eaglerproxy](https://github.com/WorldEditAxe/eaglerproxy) をベースに Render.com 向けにカスタマイズしたものです。
