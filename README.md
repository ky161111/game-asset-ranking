# ゲーム売買相場ナビ

ゲームパッケージ版中古ソフトとゲーム機本体の参考相場、買い時・売り時、価格推移を掲載する静的サイトです。現在はSwitchソフトの月次相場、現行ゲーム機3モデル、レトロゲーム機3モデルの型番別中古価格を公開し、本体価格比較表から横断検索できます。

## 月次の価格更新

価格履歴は `data/price-history.csv` で管理します。月1回、各30作品について1行ずつ追加してください。

```csv
month,platform,game_id,title,used_sale_price,buyback_price,source_name,source_url,note
2026-07,switch,game-001,ゼルダの伝説 ブレス オブ ザ ワイルド,4800,3600,駿河屋,https://www.suruga-ya.jp/,2026年7月確認
```

- `month` は `YYYY-MM` 形式にします。
- `platform`、`game_id`、`title` は `data/game-catalog.csv` の値と一致させます。
- `used_sale_price` は中古販売の参考価格、`buyback_price` は買取の参考価格です。
- `source_name` と `source_url` には確認元を記録します。
- 同じ作品・同じ月の行は1つだけにします。

CSVを更新してGitHubへpushすると、価格推移ページ、作品詳細の相場欄、トップページの急騰・急落・買取率ランキングが自動で更新されます。初月は基準月として表示し、2か月目から前月比を表示します。

掲載価格は参考値であり、実際の販売価格・買取価格や価格上昇を保証するものではありません。

## 重点作品の複数価格

人気作品の同一日・同一条件の確認価格は `data/price-observations.csv` に1店舗1行で記録します。`npm run build` により中央値、確認範囲、前回記録との差、参考判定を `data/market-summary.json` に生成します。

## ゲーム機本体の価格

本体モデルは `data/hardware-catalog.csv`、確認価格は `data/hardware-observations.csv` で管理します。`era` で現行機とレトロ機を分類します。型番・言語仕様・ドライブ有無を固定し、欠品・状態難・ランクBを除いた通常中古品だけを記録します。`npm run build` により `data/hardware-summary.json` を生成します。3店舗未満のモデルはサイト上で「参考度：低」と表示します。

## 公開前の生成と検査

Node.jsが使える環境で次を実行します。

```bash
npm test
```

この処理で、各HTMLの説明文・canonical・パンくず構造化データ・未完成ページのnoindex、信頼性ページへのリンク、サイトマップを生成し、SEO情報とJSON-LDを検査します。

- `tracking` の作品ページは検索対象にします。
- `pending` のPS5・PS4カテゴリと作品ページは価格確認が完了するまで `noindex` とし、サイトマップにも含めません。
- `pages/methodology.html` に価格の対象条件と更新方法を掲載します。
