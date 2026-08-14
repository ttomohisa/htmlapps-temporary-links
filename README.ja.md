# Temporary Links

[English](README.md)

![Temporary Links preview](assets/social-preview.png)

作業中だけ必要な **Webリンクやローカルファイルパスを一時置き** する、単一HTMLのブラウザーツールです。

長期保存するブックマーク管理ではなく、「いまの作業で使う参照先」をタブの代わりに置いておき、終わったら消すための小さな作業キューを想定しています。

## デモ

このリポジトリを GitHub Pages で公開すると、次のURLで開けます。

- `https://ttomohisa.github.io/htmlapps-temporary-links/`
- `temporary-links.html` の直接URLも利用できます。

## 主な機能

- `temporary-links.html` 1ファイルで動作
- 実行時の外部依存なし
- Content Security Policy でアプリからの実行時通信を遮断
- リンク・メモ・パスはブラウザー内に保存
- 日本語 / 英語切替
- `http://` / `https://` のWebリンク
- `file:///...`、Windowsパス、UNCパス、絶対パス
- メモと保持期間
- 「このタブを閉じるまで」は `sessionStorage` に保存
- 永続データは既存の `temporary-links-v1` を継続利用
- 使用中 / すべて / 完了 / 期限切れの絞り込み
- タイトル・URL・パス・メモの検索
- ローカルパス、親フォルダー、ファイル名のコピー
- Markdown保存
- Document Picture-in-Picture によるフローティング表示
- スマホでも崩れにくいレスポンシブUI

## 使い方

1. `temporary-links.html` をダウンロードして開くか、GitHub Pages版を開きます。
2. Web URL またはローカルパスを貼り付けます。
3. 必要ならメモと保持期間を指定します。
4. **追加** を押します。

通常のリスト機能はローカルHTMLでも利用できます。フローティング表示で使っている Document Picture-in-Picture API は、対応ブラウザーの **安全なコンテキスト（HTTPS）** が必要です。この機能を使う場合は GitHub Pages 版などを利用してください。

## 入力できるもの

| 種類 | 例 | 主な操作 |
|---|---|---|
| Web URL | `https://example.com` | 新しいタブで開く |
| File URL | `file:///C:/Users/name/report.xlsx` | ローカルパスをコピー |
| Windowsパス | `C:\work\report.xlsx` | パス / フォルダー / 名前をコピー |
| UNCパス | `\\server\share\report.xlsx` | パス / フォルダー / 名前をコピー |
| 絶対パス | `/Users/name/report.pdf` | パス / フォルダー / 名前をコピー |

通常のWebページから任意のローカルファイルやデスクトップアプリを直接開く動作はブラウザー制約の影響を受けます。そのため、ローカルパスには誤解を招く「開く」ボタンを付けず、コピー操作を提供しています。

## 保持期間

| 設定 | 保存方法 / 動作 |
|---|---|
| このタブを閉じるまで | `sessionStorage`。タブのセッション終了時に消えます |
| 今日まで | 当日の終わりに期限切れ |
| 3日後まで | 3日後の日末に期限切れ |
| 7日後まで | 7日後の日末に期限切れ |
| 削除するまで | 手動で削除するまで保持 |

期限切れの項目は **すべて** / **期限切れ** から確認でき、必要なタイミングで削除できます。

## 旧版データとの互換性

永続データのキーは引き続き次を利用します。

```text
temporary-links-v1
```

旧版で `expiresAt` が `session` だった項目は、初回読み込み時に新しいタブセッション用ストレージへ自動移行します。既存の永続リンクは手作業で移行する必要はありません。

## フローティング表示

安全なコンテキストで `window.documentPictureInPicture` が利用できる場合、**フローティング表示** から使用中の項目だけを小さな常時手前ウィンドウに出せます。

フローティング側では次の操作ができます。

- 使用中リンクの確認
- Webリンクを開く
- ローカルパスをコピー
- 完了にする
- 削除する
- URL / パスを「このタブを閉じるまで」で追加する

APIが利用できない環境ではボタンを無効化し、通常のリスト機能はそのまま使えます。

## プライバシーとオフライン動作

Temporary Links には、解析、テレメトリ、アップロード、リモートログ、CDN、実行時の外部依存を入れていません。

HTMLには `connect-src 'none'` を含む Content Security Policy を設定しています。Webリンクを開く操作はユーザーが明示的に行うページ遷移であり、アプリ自身がリンク先を取得することはありません。

ブラウザープロファイルを共用している場合、同じプロファイルを使う他の人からローカル保存内容を見られる可能性があります。暗号化された秘密情報の保管用途には使わないでください。

## リポジトリ構成

```text
htmlapps-temporary-links/
├── index.html                 # GitHub Pages ルート用リダイレクト
├── temporary-links.html       # アプリ本体・単一HTML配布物
├── README.md
├── README.ja.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
└── assets/
    └── social-preview.png
```

## 開発時の確認

このアプリにビルド工程はありません。公開前に以下を確認します。

1. インラインJavaScriptの構文チェック
2. CDNや実行時ネットワーク依存がないこと
3. Web URL、`file:///`、Windowsパス、UNCパス、絶対パス
4. 各保持期間と4種類の絞り込み
5. 日本語 / 英語UI
6. ローカルHTMLでの通常機能と、HTTPSでのフローティング表示を分けて確認
7. Markdown保存と削除確認ダイアログ

## ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。
