# Switch資産価値ナビ

Switchパッケージ版中古ソフトの参考相場、買い時・売り時、価格推移を掲載する静的サイトです。

## 月次の価格更新

価格履歴は `data/price-history.csv` で管理します。月1回、各30作品について1行ずつ追加してください。

```csv
month,game_id,title,used_sale_price,buyback_price,source_name,source_url,note
2026-07,game-001,ゼルダの伝説 ブレス オブ ザ ワイルド,4800,3600,駿河屋,https://www.suruga-ya.jp/,2026年7月確認
```

- `month` は `YYYY-MM` 形式にします。
- `game_id` と `title` は既存行と同じものを使います。
- `used_sale_price` は中古販売の参考価格、`buyback_price` は買取の参考価格です。
- `source_name` と `source_url` には確認元を記録します。
- 同じ作品・同じ月の行は1つだけにします。

CSVを更新してGitHubへpushすると、価格推移ページ、作品詳細の相場欄、トップページの急騰・急落・買取率ランキングが自動で更新されます。初月は基準月として表示し、2か月目から前月比を表示します。

掲載価格は参考値であり、実際の販売価格・買取価格や価格上昇を保証するものではありません。
