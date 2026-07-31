# ゲーム売買相場ナビ

ゲームパッケージ版中古ソフトとゲーム機本体の参考相場、買い時・売り時、価格推移を掲載する静的サイトです。現在はSwitchソフトの月次相場、現行ゲーム機3モデル、レトロゲーム機3モデルの型番別中古価格を公開し、本体価格比較表から横断検索できます。

## 管理ドキュメント

- [実装履歴](docs/IMPLEMENTATION_HISTORY.md)：公開した機能、コミット、検証結果
- [運用・拡充計画](docs/OPERATIONS_PLAN.md)：更新頻度、品質基準、次の実装、KPI

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

CSVを更新してGitHubへpushすると、`data/price-trends.json` が再生成され、価格推移ページ、作品詳細の相場欄、トップページの値上がり・値下がり・買取率ランキングが自動で更新されます。月次履歴に加えて、複数店舗の最新販売確認がある作品は、その確認点も推移グラフに表示します。買取価格を確認していない時点は、買取線を補間せず空欄として扱います。

掲載価格は参考値であり、実際の販売価格・買取価格や価格上昇を保証するものではありません。

## 自分のアクセスを計測から外す

自分のブラウザでサイトURLに `?analytics=off` を一度付けて開くと、そのブラウザのGA4計測を停止します。再開するときは `?analytics=on` を付けて開いてください。Google検索からの流入は、Search Consoleのクリック数を基準に確認します。

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
